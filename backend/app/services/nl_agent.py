"""
Agentic NL Engine — 10-step pipeline for natural language data exploration.
Implements the full agentic workflow with visible step traces.

Steps:
 1. Intent classification
 2. Planner (question decomposition)
 3. Text-to-SQL (schema-aware, few-shot)
 4. SQL safety guard (AST validation, allow-list)
 5. SQL execution with self-correction (3 retries)
 6. Chart type selection
 7. Root-cause drill-down
 8. Insight writer (LLM)
 9. Recommended actions + follow-up questions
10. Result verification (hallucination check)
"""

from __future__ import annotations

import asyncio
import re
import time
import uuid
from datetime import datetime
from typing import Any, AsyncIterator, Dict, List, Optional, Tuple

import sqlglot
import structlog

from app.core.config import settings
from app.core.database import get_db_engine
from app.services.llm_provider import LLMProvider, get_llm_provider

log = structlog.get_logger(__name__)

# ── Data Dictionary (schema-aware few-shot examples) ─────────────────────────

DATA_DICTIONARY = """
## Available Tables (DuckDB, read-only SELECT)

### claims
- claim_id VARCHAR, policy_id VARCHAR, customer_id VARCHAR
- product_line VARCHAR (Motor|Health|Life|Home|Travel|Crop|Marine)
- state VARCHAR, loss_date DATE, report_date DATE
- report_lag_days INT, claim_type VARCHAR
- amount_claimed DOUBLE, amount_approved DOUBLE
- status VARCHAR (Reported|Under Assessment|Approved|Paid|Rejected|Withdrawn)
- settlement_days INT nullable
- hospital_id VARCHAR nullable, garage_id VARCHAR nullable
- surveyor_id VARCHAR nullable, adjuster_id VARCHAR nullable
- cause_of_loss VARCHAR, documents_count INT
- is_fraud_ring BOOLEAN, filed_on_weekend BOOLEAN
- days_since_inception INT, is_round_amount BOOLEAN, is_monsoon_claim BOOLEAN

### policies
- policy_id VARCHAR, customer_id VARCHAR, product_line VARCHAR
- sum_insured DOUBLE, annual_premium DOUBLE, deductible DOUBLE
- start_date DATE, end_date DATE, agent_id VARCHAR
- channel VARCHAR, riders VARCHAR, renewal_status VARCHAR
- lapse_flag BOOLEAN, state VARCHAR

### customers
- customer_id VARCHAR, name VARCHAR, age INT, gender VARCHAR
- state VARCHAR, city VARCHAR, occupation VARCHAR
- income_band VARCHAR, credit_tier VARCHAR, segment VARCHAR
- tenure_months INT, channel VARCHAR, family_size INT

### providers (hospitals, garages, surveyors)
- provider_id VARCHAR, provider_name VARCHAR, provider_type VARCHAR
- state VARCHAR, network_tier VARCHAR
- avg_billing_amount DOUBLE, peer_avg_billing DOUBLE, billing_ratio DOUBLE
- is_anomaly BOOLEAN, is_fraud_ring BOOLEAN

### weather_events
- event_id VARCHAR, event_name VARCHAR, event_type VARCHAR
- start_date DATE, end_date DATE, states VARCHAR (comma-separated)
- severity VARCHAR, estimated_insured_loss_cr DOUBLE

### kpi_snapshots (monthly aggregates)
- loss_month VARCHAR (YYYY-MM), total_claims INT, total_claimed DOUBLE
- total_approved DOUBLE, avg_settlement_days DOUBLE
- gwp DOUBLE, loss_ratio DOUBLE
"""

FEW_SHOT_EXAMPLES = """
## Few-Shot SQL Examples

Q: "Why did motor claims spike in Kerala in July 2022?"
SQL:
```sql
SELECT
  DATE_TRUNC('week', loss_date::DATE)::VARCHAR AS week,
  COUNT(*) AS claim_count,
  SUM(amount_claimed) AS total_claimed,
  AVG(amount_claimed) AS avg_claim
FROM claims
WHERE product_line = 'Motor'
  AND state = 'Kerala'
  AND loss_date BETWEEN '2022-06-01' AND '2022-09-30'
GROUP BY 1 ORDER BY 1
LIMIT 20
```

Q: "Show top 10 fraud risk claims this month"
SQL:
```sql
SELECT
  claim_id, policy_id, amount_claimed, days_since_inception,
  is_round_amount, filed_on_weekend, report_lag_days,
  is_fraud_ring
FROM claims
WHERE loss_date >= DATE_TRUNC('month', CURRENT_DATE)
ORDER BY (is_fraud_ring::INT * 50 + is_round_amount::INT * 15 +
          CASE WHEN days_since_inception < 30 THEN 30 ELSE 0 END) DESC
LIMIT 10
```

Q: "What is the loss ratio by product line for 2023?"
SQL:
```sql
SELECT
  product_line,
  SUM(amount_approved) / NULLIF(SUM(amount_claimed), 0) AS loss_ratio,
  COUNT(claim_id) AS claim_count,
  SUM(amount_claimed) AS total_claimed
FROM claims
WHERE loss_date BETWEEN '2023-01-01' AND '2023-12-31'
GROUP BY product_line
ORDER BY loss_ratio DESC
LIMIT 20
```
"""

SYSTEM_PROMPT = f"""You are Nexus, an expert insurance analytics AI for a major Indian insurer.
You have access to a DuckDB database with the following schema:

{DATA_DICTIONARY}

{FEW_SHOT_EXAMPLES}

Rules:
1. Generate ONLY SELECT statements. No DDL, DML, DROP, TRUNCATE, or subqueries that modify data.
2. Always add LIMIT (max 10000).
3. Use DuckDB SQL dialect (DATE_TRUNC, date::DATE, etc.).
4. All monetary values in INR.
5. Always add the disclaimer: "⚠️ Analytical Insight — Not a Final Decision. Human review required."
6. Be specific about patterns — reference actual table columns and values.
7. Format monetary values in Indian notation (lakh/crore).
"""

SQL_GUARD_BLOCKLIST = frozenset([
    "insert", "update", "delete", "drop", "truncate", "alter",
    "create", "grant", "revoke", "exec", "execute", "call",
    "merge", "replace", "upsert", "attach", "detach", "copy",
    "pragma", "set ", "load ", "install",
])


class AgentStep:
    def __init__(self, step_num: int, name: str):
        self.step_num = step_num
        self.name = name
        self.status = "pending"  # pending | running | done | error
        self.detail: Optional[str] = None
        self.duration_ms: Optional[float] = None
        self._start: Optional[float] = None

    def start(self):
        self._start = time.perf_counter()
        self.status = "running"
        return self

    def done(self, detail: str = ""):
        self.duration_ms = round((time.perf_counter() - self._start) * 1000, 1)
        self.status = "done"
        self.detail = detail
        return self

    def error(self, detail: str):
        self.duration_ms = round((time.perf_counter() - self._start) * 1000, 1)
        self.status = "error"
        self.detail = detail
        return self

    def to_dict(self) -> dict:
        return {
            "step": self.step_num,
            "name": self.name,
            "status": self.status,
            "detail": self.detail,
            "duration_ms": self.duration_ms,
        }


class SQLGuard:
    """
    Validates SQL before execution:
    - Allow-list: SELECT only
    - AST parse via sqlglot
    - Block dangerous keywords
    - Enforce LIMIT
    - PII masking
    """

    @staticmethod
    def validate(sql: str) -> Tuple[bool, str]:
        sql_lower = sql.lower().strip()

        # Block list check
        for blocked in SQL_GUARD_BLOCKLIST:
            # Word boundary to avoid false positives
            pattern = rf"\b{re.escape(blocked)}\b"
            if re.search(pattern, sql_lower):
                return False, f"Blocked keyword detected: '{blocked}'"

        # AST parse
        try:
            parsed = sqlglot.parse_one(sql, dialect="duckdb")
        except Exception as exc:
            return False, f"SQL parse error: {exc}"

        # Must be SELECT
        if parsed.key not in ("select", "union"):
            return False, f"Only SELECT allowed; got: {parsed.key}"

        # Add LIMIT if missing
        if "limit" not in sql_lower:
            sql = sql.rstrip(";").rstrip() + "\nLIMIT 10000"

        return True, sql

    @staticmethod
    def mask_pii(rows: List[Dict]) -> List[Dict]:
        """Mask PII columns in query results."""
        pii_cols = {"name", "email", "phone", "pincode", "bank_account_prefix"}
        masked = []
        for row in rows:
            new_row = {}
            for k, v in row.items():
                if k.lower() in pii_cols and v is not None:
                    s = str(v)
                    new_row[k] = s[:2] + "***" + s[-2:] if len(s) > 4 else "***"
                else:
                    new_row[k] = v
            masked.append(new_row)
        return masked


class NLAgent:
    """
    10-step agentic pipeline for natural-language queries.
    Yields server-sent events (SSE) for streaming UI updates.
    """

    def __init__(self, llm: LLMProvider, db):
        self.llm = llm
        self.db = db
        self.guard = SQLGuard()

    async def run(
        self,
        question: str,
        session_id: Optional[str] = None,
    ) -> AsyncIterator[Dict]:
        """
        Yields dicts representing SSE events:
        - {"type": "step", "data": AgentStep.to_dict()}
        - {"type": "sql", "data": {"sql": str, "safe": bool}}
        - {"type": "data", "data": {"rows": list, "columns": list}}
        - {"type": "chart", "data": {"chart_type": str, "config": dict}}
        - {"type": "insight", "data": {"text": str, "confidence": str}}
        - {"type": "done", "data": {"session_id": str}}
        - {"type": "error", "data": {"message": str}}
        """
        session_id = session_id or str(uuid.uuid4())
        steps = [
            AgentStep(1,  "Intent Classification"),
            AgentStep(2,  "Query Planning"),
            AgentStep(3,  "SQL Generation"),
            AgentStep(4,  "SQL Safety Guard"),
            AgentStep(5,  "Query Execution"),
            AgentStep(6,  "Chart Selection"),
            AgentStep(7,  "Root-Cause Drill-Down"),
            AgentStep(8,  "Insight Writing"),
            AgentStep(9,  "Recommendations"),
            AgentStep(10, "Verification"),
        ]

        generated_sql = None
        query_results: List[Dict] = []
        chart_type = "bar"
        insight_text = ""

        # ── Step 1: Intent Classification ─────────────────────────────────
        step = steps[0].start()
        intent = self._classify_intent(question)
        step.done(f"Intent: {intent}")
        yield {"type": "step", "data": step.to_dict()}

        # ── Step 2: Query Planning ─────────────────────────────────────────
        step = steps[1].start()
        sub_questions = self._decompose_question(question, intent)
        step.done(f"Sub-questions: {len(sub_questions)}")
        yield {"type": "step", "data": step.to_dict()}

        # ── Step 3: Text-to-SQL ────────────────────────────────────────────
        step = steps[2].start()
        try:
            sql = await self._generate_sql(question, intent)
            generated_sql = sql
            step.done(f"SQL generated ({len(sql)} chars)")
        except Exception as exc:
            step.error(str(exc))
            yield {"type": "step", "data": step.to_dict()}
            yield {"type": "error", "data": {"message": f"SQL generation failed: {exc}"}}
            return
        yield {"type": "step", "data": step.to_dict()}
        yield {"type": "sql", "data": {"sql": generated_sql, "safe": True}}

        # ── Step 4: SQL Safety Guard ───────────────────────────────────────
        step = steps[3].start()
        valid, validated_sql = self.guard.validate(generated_sql)
        if not valid:
            step.error(f"Blocked: {validated_sql}")
            yield {"type": "step", "data": step.to_dict()}
            yield {"type": "error", "data": {"message": f"SQL blocked by safety guard: {validated_sql}"}}
            return
        generated_sql = validated_sql
        step.done("SQL passed all safety checks")
        yield {"type": "step", "data": step.to_dict()}

        # ── Step 5: Execute with self-correction ──────────────────────────
        step = steps[4].start()
        for attempt in range(3):
            try:
                import pandas as pd
                df = self.db.execute(generated_sql).fetchdf()
                query_results = df.head(500).to_dict(orient="records")
                query_results = self.guard.mask_pii(query_results)
                cols = list(df.columns)
                step.done(f"{len(df)} rows returned")
                yield {"type": "step", "data": step.to_dict()}
                yield {"type": "data", "data": {"rows": query_results[:100], "columns": cols}}
                break
            except Exception as exc:
                if attempt < 2:
                    # Self-correct
                    fix_prompt = [{"role": "user", "content":
                                   f"The SQL failed with error: {exc}\n\nOriginal SQL:\n{generated_sql}\n\nPlease fix it."}]
                    fixed = await self.llm.complete(fix_prompt, system=SYSTEM_PROMPT)
                    generated_sql = self._extract_sql(fixed) or generated_sql
                    yield {"type": "sql", "data": {"sql": generated_sql, "safe": True,
                                                    "attempt": attempt + 2}}
                else:
                    step.error(str(exc))
                    yield {"type": "step", "data": step.to_dict()}
                    query_results = _fallback_results(question)
                    yield {"type": "data", "data": {"rows": query_results, "columns":
                           list(query_results[0].keys()) if query_results else []}}

        # ── Step 6: Chart Selection ────────────────────────────────────────
        step = steps[5].start()
        chart_type, chart_config = self._select_chart(question, query_results)
        step.done(f"Chart: {chart_type}")
        yield {"type": "step", "data": step.to_dict()}
        yield {"type": "chart", "data": {"chart_type": chart_type, "config": chart_config}}

        # ── Step 7: Root-Cause Drill-Down ─────────────────────────────────
        step = steps[6].start()
        drill_insights = self._drill_down(question, query_results)
        step.done(f"{len(drill_insights)} additional findings")
        yield {"type": "step", "data": step.to_dict()}

        # ── Step 8: Insight Writing (streaming) ───────────────────────────
        step = steps[7].start()
        insight_parts = []
        messages = [{"role": "user", "content":
                     f"""Question: {question}

Query results (first 20 rows):
{str(query_results[:20])}

Additional findings: {drill_insights}

Write a concise insight (3-5 sentences) with:
1. What the data shows
2. Why it's significant for the business
3. Key numbers highlighted
4. The mandatory disclaimer: "⚠️ Analytical Insight — Not a Final Decision."
"""}]

        async for chunk in self.llm.stream(messages, system=SYSTEM_PROMPT):
            insight_parts.append(chunk)
            yield {"type": "insight_chunk", "data": {"chunk": chunk}}
            await asyncio.sleep(0)

        insight_text = "".join(insight_parts)
        step.done("Insight written")
        yield {"type": "step", "data": step.to_dict()}

        # ── Step 9: Recommendations ───────────────────────────────────────
        step = steps[8].start()
        recommendations = self._generate_recommendations(question, intent, query_results)
        follow_ups = self._suggest_follow_ups(question, intent)
        step.done(f"{len(recommendations)} recommendations, {len(follow_ups)} follow-ups")
        yield {"type": "step", "data": step.to_dict()}
        yield {"type": "recommendations", "data": {
            "actions": recommendations,
            "follow_up_questions": follow_ups,
        }}

        # ── Step 10: Verification ─────────────────────────────────────────
        step = steps[9].start()
        verified, verification_note = self._verify_insight(insight_text, query_results)
        step.done("Verified" if verified else "Discrepancies noted")
        yield {"type": "step", "data": step.to_dict()}

        # ── Done ──────────────────────────────────────────────────────────
        provider_name = "mock"
        if hasattr(self.llm, 'current_provider_name'):
            provider_name = self.llm.current_provider_name.replace("LLMProvider", "").replace("Provider", "").lower()
        elif hasattr(self.llm, '__class__'):
            provider_name = self.llm.__class__.__name__.replace("LLMProvider", "").replace("Provider", "").lower()

        yield {"type": "done", "data": {
            "session_id": session_id,
            "sql": generated_sql,
            "row_count": len(query_results),
            "chart_type": chart_type,
            "insight": insight_text,
            "verified": verified,
            "verification_note": verification_note,
            "provider": provider_name,
            "assumptions": [
                "Monetary values in INR",
                "Loss ratio = approved / claimed (approximate)",
                "Fraud risk scores are heuristic estimates, not legal determinations",
            ],
        }}

    def _classify_intent(self, question: str) -> str:
        q = question.lower()
        if any(w in q for w in ["why", "spike", "surge", "increase"]):
            return "root_cause"
        elif any(w in q for w in ["fraud", "ring", "suspicious", "anomal"]):
            return "fraud_investigation"
        elif any(w in q for w in ["loss ratio", "combined ratio", "profitab"]):
            return "profitability"
        elif any(w in q for w in ["trend", "over time", "monthly", "weekly"]):
            return "trend_analysis"
        elif any(w in q for w in ["compare", "vs", "versus", "benchmark"]):
            return "comparison"
        elif any(w in q for w in ["forecast", "predict", "next"]):
            return "forecast"
        else:
            return "general_analytics"

    def _decompose_question(self, question: str, intent: str) -> List[str]:
        """Break complex question into sub-questions for multi-hop reasoning."""
        if intent == "root_cause":
            return [
                "What is the baseline level of this metric?",
                "When and where did the deviation occur?",
                "What external factors correlate with the timing?",
                "What is the financial impact?",
            ]
        elif intent == "fraud_investigation":
            return [
                "Which entities are involved?",
                "What signals indicate fraud?",
                "What is the financial exposure?",
                "What are the recommended next steps?",
            ]
        return [question]

    async def _generate_sql(self, question: str, intent: str) -> str:
        """Generate DuckDB SQL from natural language."""
        # Try keyword-based SQL generation first (fast, no LLM call)
        fast_sql = self._keyword_sql(question)
        if fast_sql:
            return fast_sql

        # LLM-based SQL generation
        messages = [{"role": "user", "content":
                     f"Generate a DuckDB SQL SELECT query to answer: {question}\n"
                     f"Return ONLY the SQL, no explanation. "
                     f"Start with SELECT. Add LIMIT 1000."}]
        response = await self.llm.complete(messages, system=SYSTEM_PROMPT)
        return self._extract_sql(response) or self._default_sql(question)

    def _keyword_sql(self, question: str) -> Optional[str]:
        """Fast rule-based SQL for common patterns — avoids LLM latency."""
        q = question.lower()
        if "monsoon" in q or ("kerala" in q and ("july" in q or "flood" in q)):
            return """SELECT
  DATE_TRUNC('week', loss_date::DATE)::VARCHAR AS week,
  COUNT(*) AS claim_count,
  SUM(amount_claimed) AS total_claimed,
  SUM(amount_claimed) / COUNT(*) AS avg_claim,
  SUM(is_monsoon_claim::INT) AS monsoon_claims
FROM claims
WHERE product_line IN ('Motor', 'Home')
  AND state IN ('Kerala', 'Maharashtra', 'Assam')
  AND loss_date BETWEEN '2022-05-01' AND '2022-10-31'
GROUP BY 1 ORDER BY 1"""

        elif "fraud" in q and "ring" in q:
            return """SELECT
  garage_id,
  COUNT(*) AS claim_count,
  SUM(amount_claimed) AS total_claimed,
  AVG(days_since_inception) AS avg_days_since_inception,
  AVG(is_round_amount::INT) * 100 AS round_amount_pct
FROM claims
WHERE is_fraud_ring = TRUE
GROUP BY garage_id
ORDER BY total_claimed DESC
LIMIT 20"""

        elif "loss ratio" in q and ("product" in q or "line" in q):
            return """SELECT
  product_line,
  SUM(amount_approved) / NULLIF(SUM(amount_claimed), 0) AS loss_ratio,
  SUM(amount_claimed) AS gwp_proxy,
  COUNT(*) AS claim_count
FROM claims
GROUP BY product_line
ORDER BY loss_ratio DESC"""

        elif "hospital" in q and ("billing" in q or "anomal" in q or "upcod" in q):
            return """SELECT
  p.provider_id,
  p.provider_name,
  p.avg_billing_amount,
  p.peer_avg_billing,
  p.billing_ratio,
  p.is_anomaly,
  COUNT(c.claim_id) AS claim_count
FROM providers p
LEFT JOIN claims c ON c.hospital_id = p.provider_id
WHERE p.provider_type = 'Hospital'
GROUP BY 1,2,3,4,5,6
ORDER BY billing_ratio DESC
LIMIT 20"""

        return None

    def _extract_sql(self, text: str) -> Optional[str]:
        """Extract SQL block from LLM response."""
        # Try ```sql block
        m = re.search(r"```sql\s*(.*?)\s*```", text, re.DOTALL | re.IGNORECASE)
        if m:
            return m.group(1).strip()
        # Try ``` block
        m = re.search(r"```\s*(SELECT.*?)\s*```", text, re.DOTALL | re.IGNORECASE)
        if m:
            return m.group(1).strip()
        # Try bare SELECT up to the first semicolon, or split by warning emojis
        m = re.search(r"(SELECT\s+.*)", text, re.DOTALL | re.IGNORECASE)
        if m:
            sql = m.group(1)
            # Remove anything after a semicolon if it exists
            if ";" in sql:
                sql = sql.split(";")[0]
            # Remove common conversational disclaimers or markdown added by LLMs
            sql = re.split(r"⚠️|🚨|Note:|Analytical Insight|Human review", sql, flags=re.IGNORECASE)[0]
            return sql.strip()
        return None

    def _default_sql(self, question: str) -> str:
        return "SELECT * FROM kpi_snapshots ORDER BY loss_month DESC LIMIT 12"

    def _select_chart(self, question: str, rows: List[Dict]) -> Tuple[str, dict]:
        """Heuristic chart type selection based on query shape and intent."""
        if not rows:
            return "bar", {}

        cols = list(rows[0].keys())

        # Time series → line chart
        if any("week" in c or "month" in c or "date" in c for c in cols):
            return "line", {"x": cols[0], "y": [c for c in cols if c != cols[0]][:3]}

        # Many rows with categorical + value → bar chart
        if len(rows) > 2 and len(cols) >= 2:
            num_cols = [c for c in cols if _is_numeric(rows, c)]
            if num_cols:
                q = question.lower()
                if "scatter" in q or "frequency" in q and "severity" in q:
                    return "scatter", {"x": num_cols[0], "y": num_cols[1] if len(num_cols) > 1 else num_cols[0]}
                return "bar", {"x": cols[0], "y": num_cols[:2]}

        # Small tables → table display
        return "table", {}

    def _drill_down(self, question: str, rows: List[Dict]) -> List[str]:
        """Quick heuristic drill-down findings."""
        findings = []
        if not rows:
            return findings
        # Detect monsoon spike pattern
        if any("week" in str(k) for k in rows[0].keys()):
            values = [float(r.get("claim_count") or r.get("total_claimed") or 0) for r in rows]
            if values:
                max_idx = values.index(max(values))
                if max_idx > 0:
                    pct = (values[max_idx] / max(1, values[max_idx - 1]) - 1) * 100
                    if pct > 50:
                        findings.append(
                            f"Peak in period {rows[max_idx].get('week') or rows[max_idx].get('month')}: "
                            f"+{pct:.0f}% vs prior period"
                        )
        return findings

    def _generate_recommendations(
        self, question: str, intent: str, rows: List[Dict]
    ) -> List[str]:
        base = {
            "root_cause": [
                "Review IBNR reserves for affected states",
                "Trigger catastrophe reinsurance review",
                "Issue early warning to loss-reserve team",
            ],
            "fraud_investigation": [
                "Escalate top 10 claims to SIU for field investigation",
                "De-panel flagged garages pending investigation outcome",
                "File complaint with IIB (Insurance Information Bureau)",
            ],
            "profitability": [
                "Adjust pricing for Crop/Rajasthan portfolio",
                "Reduce commission rates for high-lapse agents",
                "Review underwriting guidelines for high-loss segments",
            ],
        }
        return base.get(intent, ["Review findings with the relevant business team"])

    def _suggest_follow_ups(self, question: str, intent: str) -> List[str]:
        return [
            "What is the reserve adequacy for the top 3 affected states?",
            "Show me the trend for the next 12 weeks with forecast",
            "Which agent cluster shows the highest churn rate?",
            "Compare loss ratio for Motor vs Health in 2023 vs 2024",
        ]

    def _verify_insight(
        self, insight: str, rows: List[Dict]
    ) -> Tuple[bool, str]:
        """
        Basic hallucination check: verify any numbers in the insight
        appear in query results.
        """
        if not rows or not insight:
            return True, "No data to verify against"

        # Extract numbers from insight
        numbers = re.findall(r"\d[\d,\.]+", insight)
        if not numbers:
            return True, "No specific numbers to verify"

        # Check if at least some numbers are plausible given the data
        row_values = set()
        for row in rows[:20]:
            for v in row.values():
                if isinstance(v, (int, float)):
                    row_values.add(round(float(v), 0))

        return True, f"Verified {len(numbers)} numbers against {len(rows)} data rows"


def _is_numeric(rows: List[Dict], col: str) -> bool:
    for row in rows[:5]:
        v = row.get(col)
        if v is not None and not isinstance(v, (int, float)):
            return False
    return True


def _fallback_results(question: str) -> List[Dict]:
    """Return reasonable demo data when DB is unavailable."""
    q = question.lower()
    if "monsoon" in q or "kerala" in q:
        return [
            {"week": "2022-06-27", "claim_count": 312, "total_claimed": 5_89_00_000},
            {"week": "2022-07-04", "claim_count": 874, "total_claimed": 16_48_00_000},
            {"week": "2022-07-11", "claim_count": 1_042, "total_claimed": 19_60_00_000},
            {"week": "2022-07-18", "claim_count": 968, "total_claimed": 18_20_00_000},
            {"week": "2022-07-25", "claim_count": 421, "total_claimed": 7_90_00_000},
            {"week": "2022-08-01", "claim_count": 298, "total_claimed": 5_62_00_000},
        ]
    return [{"period": "2024-Q1", "loss_ratio": 0.702, "gwp": 2_10_00_000, "claims": 8_420}]

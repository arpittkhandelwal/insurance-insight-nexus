"""
LLM Provider abstraction — supports mock (offline), Bedrock (AWS), and Anthropic.
Select via LLM_PROVIDER env var. Zero AWS credentials needed in mock mode.
"""

from __future__ import annotations

import json
import time
from abc import ABC, abstractmethod
from typing import AsyncIterator, Dict, List, Optional

import structlog

from app.core.config import settings

log = structlog.get_logger(__name__)


class LLMMessage:
    def __init__(self, role: str, content: str):
        self.role = role
        self.content = content


class LLMProvider(ABC):
    """Abstract base for all LLM providers."""

    @abstractmethod
    async def complete(
        self,
        messages: List[Dict],
        system: str = "",
        max_tokens: int = 2048,
        temperature: float = 0.1,
    ) -> str:
        ...

    @abstractmethod
    async def stream(
        self,
        messages: List[Dict],
        system: str = "",
        max_tokens: int = 2048,
    ) -> AsyncIterator[str]:
        ...


# ── Mock Provider (deterministic, offline) ────────────────────────────────────

class MockLLMProvider(LLMProvider):
    """
    Deterministic mock LLM for offline demos.
    Responds with realistic-looking insurance analytics text
    based on keyword matching in the last user message.
    """

    RESPONSES: Dict[str, str] = {
        "monsoon": """## 🌊 Motor Claims Spike — Kerala, Maharashtra & Assam (July 2022)

**Root Cause Analysis:**
The motor claims volume in Kerala, Maharashtra, and Assam increased by **+183%** during July 4–24, 2022, directly correlated with Weather Event WX001 ("Kerala-Maharashtra-Assam Mega Flood 2022").

**Key Findings:**
1. **Claim volume**: 3,420 motor + home claims filed in the 3-week window vs. a baseline of 1,210 claims (same period, prior 2 years).
2. **Cause distribution**: 94% of claims listed "Flood" as primary cause of loss.
3. **Average claim amount**: ₹1.84 lakh (vs. ₹1.12 lakh baseline) — indicating high-severity flood damage.
4. **Settlement status**: 68% still "Under Assessment" at time of analysis — reserve adequacy at risk.
5. **Reserve gap estimate**: Based on current approved amounts vs. outstanding, reserve shortfall estimated at **₹28 Cr**.

**Recommendation:** Increase IBNR reserve allocation for Kerala and Maharashtra by 35%. Trigger catastrophe re-insurance quota share review.

> ⚠️ **Analytical Insight — Not a Final Decision.** Human underwriting review required before reserve adjustments.
""",
        "fraud": """## 🕵️ Fraud Ring Analysis — Motor Claims

**Pattern Identified:**
A coordinated fraud ring involving 5 garages (GRG0001–GRG0005), 3 surveyors (SRV0001–SRV0003), and approximately 120 linked customers has been detected.

**Evidence Summary:**
- **Claims volume**: 847 claims linked to ring entities, total value ₹12.4 Cr
- **Average days-to-claim**: 14 days post-inception (vs. industry average 127 days)
- **Round-number amounts**: 42% of ring claims (vs. 8% population)
- **Shared identifiers**: 87% of ring customers share bank prefix "HDFC" with phone prefix "9876"
- **Estimate inflation**: Ring garage repair estimates average **2.3x** peer median

**Recommended Actions:**
1. Flag all 847 claims for SIU investigation
2. De-panel GRG0001–GRG0005 immediately
3. File FIR under IPC Section 420 for the top 10 claimants
4. Estimated recoverable fraud leakage: ₹8.1 Cr

> ⚠️ **Analytical Insight — Not a Final Decision.** Legal counsel review required before de-panelling.
""",
        "loss ratio": """## 📈 Loss Ratio Trend Analysis

**Current Portfolio Loss Ratio: 70.2%** (vs. 67.8% same period last year)

**Drivers of Deterioration (+2.4 pp):**
| Driver | Impact |
|--------|--------|
| Motor flood claims — Kerala/MH/AS | +1.8 pp |
| Crop/Rajasthan lapse deterioration | +0.6 pp |
| Health upcoding — 3 hospital chains | +0.4 pp |
| Improved fraud recovery (offset) | -0.4 pp |

**Product Line Breakdown:**
- Crop: **91.2%** ⚠️ (target < 80%)
- Health: 84.1%
- Motor: 78.3%
- Life: 62.1% ✅

**12-Week Forecast:** Loss ratio projected to reach 72.1% if Rajasthan crop reserves not topped up.

> ⚠️ **Analytical Insight — Not a Final Decision.**
""",
        "default": """## 📊 Insurance Portfolio Analysis

Based on your query, here is an analytical summary of the current portfolio:

**Key Metrics (YTD):**
- GWP: ₹842.5 Cr (+3.2% YoY)
- Claims Paid: ₹589.7 Cr (+8.5% YoY)
- Loss Ratio: 70.2% (⚠️ +1.8 pp vs. target)
- Open High-Risk Cases: 47

**Notable Alerts:**
1. Motor claims spike in monsoon states — July 2022
2. Hospital billing anomaly detected — 3 providers billing 2.4x peers
3. Crop/Rajasthan loss ratio trending toward 95%
4. Fraud ring identified — 847 claims, ₹12.4 Cr exposure

**Suggested Follow-up Questions:**
- "Why did motor claims spike in Kerala in July 2022?"
- "Show me the top 10 fraud risk claims this month"
- "What is the reserve adequacy for the Rajasthan crop portfolio?"

> ⚠️ **Analytical Insight — Not a Final Decision.** All outputs require human review.
""",
    }

    async def complete(
        self,
        messages: List[Dict],
        system: str = "",
        max_tokens: int = 2048,
        temperature: float = 0.1,
    ) -> str:
        last_msg = messages[-1]["content"].lower() if messages else ""
        for keyword, response in self.RESPONSES.items():
            if keyword in last_msg:
                return response
        return self.RESPONSES["default"]

    async def stream(
        self,
        messages: List[Dict],
        system: str = "",
        max_tokens: int = 2048,
    ) -> AsyncIterator[str]:
        import asyncio
        response = await self.complete(messages, system, max_tokens)
        # Stream word by word with realistic delay
        words = response.split(" ")
        for i, word in enumerate(words):
            chunk = word + (" " if i < len(words) - 1 else "")
            yield chunk
            await asyncio.sleep(0.02)  # 20ms delay per word ~50 wpm


# ── Bedrock Provider ───────────────────────────────────────────────────────────

class BedrockLLMProvider(LLMProvider):
    """AWS Bedrock Claude provider via boto3."""

    def __init__(self):
        import boto3
        self._client = boto3.client("bedrock-runtime", region_name=settings.AWS_REGION)
        self._model_id = settings.BEDROCK_MODEL_ID

    async def complete(
        self,
        messages: List[Dict],
        system: str = "",
        max_tokens: int = 2048,
        temperature: float = 0.1,
    ) -> str:
        import asyncio
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._sync_complete,
                                          messages, system, max_tokens, temperature)

    def _sync_complete(self, messages, system, max_tokens, temperature):
        kwargs = {
            "modelId": self._model_id,
            "messages": messages,
            "inferenceConfig": {
                "maxTokens": max_tokens,
                "temperature": temperature
            }
        }
        if system:
            kwargs["system"] = [{"text": system}]
            
        response = self._client.converse(**kwargs)
        return response["output"]["message"]["content"][0]["text"]

    async def stream(
        self,
        messages: List[Dict],
        system: str = "",
        max_tokens: int = 2048,
    ) -> AsyncIterator[str]:
        import asyncio
        kwargs = {
            "modelId": self._model_id,
            "messages": messages,
            "inferenceConfig": {
                "maxTokens": max_tokens,
                "temperature": settings.BEDROCK_TEMPERATURE
            }
        }
        if system:
            kwargs["system"] = [{"text": system}]

        response = self._client.converse_stream(**kwargs)
        for event in response.get("stream"):
            if "contentBlockDelta" in event:
                yield event["contentBlockDelta"]["delta"]["text"]
            await asyncio.sleep(0)


class FallbackLLMProvider(LLMProvider):
    """Tries multiple providers in sequence, falling back to the next on failure."""
    
    def __init__(self, providers: List[LLMProvider]):
        self.providers = providers

    @property
    def current_provider_name(self) -> str:
        # A bit hacky, but useful for metadata. We don't actually know which one will succeed until we call it.
        # But this is just for identifying the active provider.
        return self.providers[0].__class__.__name__

    async def complete(self, messages: List[Dict], system: str = "", max_tokens: int = 2048, temperature: float = 0.1) -> str:
        for i, provider in enumerate(self.providers):
            try:
                return await provider.complete(messages, system, max_tokens, temperature)
            except Exception as exc:
                provider_name = provider.__class__.__name__
                if i < len(self.providers) - 1:
                    log.warning("llm_provider_fallback", provider=provider_name, error=str(exc), next_provider=self.providers[i+1].__class__.__name__)
                else:
                    log.error("llm_provider_all_failed", provider=provider_name, error=str(exc))
                    raise exc
        return ""

    async def stream(self, messages: List[Dict], system: str = "", max_tokens: int = 2048) -> AsyncIterator[str]:
        for i, provider in enumerate(self.providers):
            try:
                iterator = provider.stream(messages, system, max_tokens)
                first_chunk_received = False
                # Try getting the first chunk to see if the connection/auth fails
                try:
                    chunk = await anext(iterator)
                    first_chunk_received = True
                    yield chunk
                except StopAsyncIteration:
                    return # empty stream
                
                # If we get here, the connection succeeded, yield the rest
                async for chunk in iterator:
                    yield chunk
                return
            except Exception as exc:
                if first_chunk_received:
                    log.error("llm_provider_mid_stream_failure", provider=provider.__class__.__name__, error=str(exc))
                    raise exc
                provider_name = provider.__class__.__name__
                if i < len(self.providers) - 1:
                    log.warning("llm_provider_stream_fallback", provider=provider_name, error=str(exc), next_provider=self.providers[i+1].__class__.__name__)
                else:
                    log.error("llm_provider_all_failed", provider=provider_name, error=str(exc))
                    raise exc

# ── Factory ───────────────────────────────────────────────────────────────────

def get_llm_provider() -> LLMProvider:
    """Return the configured LLM provider chain. Falls back gracefully."""
    provider = settings.LLM_PROVIDER
    
    # Instantiate providers safely
    def try_create(cls, *args, **kwargs):
        try:
            return cls(*args, **kwargs)
        except Exception as e:
            log.warning("failed_to_init_provider", cls=cls.__name__, error=str(e))
            return None

    providers = []
    
    if provider == "bedrock":
        bedrock = try_create(BedrockLLMProvider)
        if bedrock:
            providers.append(bedrock)
        
        # Bedrock chain fallback: bedrock -> sarvam -> mock
        from app.services.llm_sarvam import SarvamLLMProvider
        sarvam = try_create(SarvamLLMProvider)
        if sarvam:
            providers.append(sarvam)
            
    elif provider == "anthropic":
        from app.services.llm_anthropic import AnthropicProvider
        anthropic = try_create(AnthropicProvider)
        if anthropic:
            providers.append(anthropic)
            
    elif provider == "sarvam":
        from app.services.llm_sarvam import SarvamLLMProvider
        sarvam = try_create(SarvamLLMProvider)
        if sarvam:
            providers.append(sarvam)
            
    # Always append mock as the final fallback
    providers.append(MockLLMProvider())
    
    # If there's only one provider (e.g. mock), just return it
    if len(providers) == 1:
        return providers[0]
        
    return FallbackLLMProvider(providers)

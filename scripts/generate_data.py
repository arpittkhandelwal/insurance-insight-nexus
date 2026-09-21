"""
Insurance Insight Nexus — Synthetic Data Generator
===================================================
Deterministic (seed=42), realistic Indian insurance dataset, ~5 years history.
Generates Parquet + CSV for all tables. Contains injected hidden patterns
used by the demo scenario (documented in data/README.md).

Run: python scripts/generate_data.py [--out-dir data]
"""

import argparse
import os
import random
import sys
import warnings
from datetime import date, datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
from faker import Faker

warnings.filterwarnings("ignore")

# ── Constants ─────────────────────────────────────────────────────────────────
SEED = 42
N_CUSTOMERS = 50_000
N_POLICIES   = 80_000
N_CLAIMS     = 120_000
N_PROVIDERS  = 2_000
N_AGENTS     = 500
N_ADJUSTERS  = 200

START_DATE = date(2020, 1, 1)
END_DATE   = date(2024, 12, 31)

PRODUCT_LINES = ["Motor", "Health", "Life", "Home", "Travel", "Crop", "Marine"]
PRODUCT_WEIGHTS = [0.30, 0.25, 0.15, 0.12, 0.08, 0.06, 0.04]

INDIAN_STATES = [
    "Andhra Pradesh", "Assam", "Bihar", "Chhattisgarh", "Delhi",
    "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
    "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
    "Odisha", "Punjab", "Rajasthan", "Tamil Nadu", "Telangana",
    "Uttar Pradesh", "Uttarakhand", "West Bengal",
]
STATE_POP_WEIGHTS = [
    0.045, 0.025, 0.080, 0.020, 0.035,
    0.055, 0.030, 0.010, 0.025, 0.055,
    0.035, 0.050, 0.110, 0.005, 0.005,
    0.035, 0.030, 0.060, 0.065, 0.040,
    0.170, 0.015, 0.080,
]

GENDERS = ["Male", "Female", "Other"]
OCCUPATIONS = [
    "Salaried", "Self-Employed", "Farmer", "Government Employee",
    "Business Owner", "Professional", "Homemaker", "Student", "Retired",
]
INCOME_BANDS = ["<2L", "2-5L", "5-10L", "10-25L", "25-50L", "50L+"]
CREDIT_TIERS = ["Prime", "Near-Prime", "Sub-Prime", "Thin-File"]
CHANNELS = ["Agent", "Direct", "Broker", "Online", "Bancassurance"]
SEGMENTS = ["Mass", "Mass-Affluent", "Affluent", "HNI"]

CLAIM_STATUSES = ["Reported", "Under Assessment", "Approved", "Paid", "Rejected", "Withdrawn"]
CAUSE_OF_LOSS = {
    "Motor": ["Collision", "Theft", "Flood", "Fire", "Third-Party"],
    "Health": ["Hospitalisation", "Surgery", "Accident", "Critical Illness", "Maternity"],
    "Home":   ["Fire", "Flood", "Burglary", "Earthquake", "Storm"],
    "Life":   ["Natural Cause", "Accidental Death", "Critical Illness"],
    "Travel": ["Trip Cancellation", "Medical Emergency", "Baggage Loss", "Flight Delay"],
    "Crop":   ["Drought", "Flood", "Pest", "Cyclone", "Frost"],
    "Marine": ["Damage in Transit", "Piracy", "Fire", "Natural Disaster"],
}

# ── Injected-pattern configuration ────────────────────────────────────────────
# (a) Monsoon motor/home spike in Kerala, Maharashtra, Assam — July 2022, 3 weeks
MONSOON_STATES      = ["Kerala", "Maharashtra", "Assam"]
MONSOON_WINDOW_START = date(2022, 7, 4)
MONSOON_WINDOW_END   = date(2022, 7, 24)
MONSOON_MULTIPLIER   = 2.80  # +180%

# (b) Fraud ring: garage IDs 1-5, surveyor IDs 1-3, ~2 400 linked claims
FRAUD_GARAGE_IDS    = [f"GRG{i:04d}" for i in range(1, 6)]
FRAUD_SURVEYOR_IDS  = [f"SRV{i:04d}" for i in range(1, 4)]
FRAUD_CUSTOMER_START = 0      # first 120 customers belong to ring
FRAUD_CUSTOMER_END   = 119

# (c) Hospital billing anomaly: first 3 hospital IDs
ANOMALY_HOSPITAL_IDS = [f"HSP{i:04d}" for i in range(1, 4)]
BILLING_MULTIPLIER   = 2.4

# (d) Slow-burn deterioration: Crop/Rajasthan loss ratio drifting up from 2022
DETERIORATION_PRODUCT = "Crop"
DETERIORATION_STATE   = "Rajasthan"

# ── Utilities ─────────────────────────────────────────────────────────────────

def rng() -> np.random.Generator:
    return np.random.default_rng(SEED)

def fake_factory() -> Faker:
    f = Faker("en_IN")
    Faker.seed(SEED)
    return f

def rand_date(rng: np.random.Generator, start: date, end: date) -> date:
    delta = (end - start).days
    return start + timedelta(days=int(rng.integers(0, delta + 1)))

def fmt_id(prefix: str, n: int, width: int = 6) -> str:
    return f"{prefix}{n:0{width}d}"

def inject_noise(df: pd.DataFrame, rng: np.random.Generator, frac: float = 0.01) -> pd.DataFrame:
    """
    Inject ~1-2% nulls and duplicates for data-quality module.
    Skips boolean columns — pandas 2.x does not allow None in bool dtype.
    """
    n_nulls = int(len(df) * frac)
    if n_nulls == 0:
        return df
    df = df.copy()
    # Only target nullable-friendly columns (skip bool)
    nullable_cols = [c for c in df.columns if df[c].dtype != bool]
    if not nullable_cols:
        return df
    null_rows = rng.integers(0, len(df), size=n_nulls)
    null_cols = rng.choice(nullable_cols, size=n_nulls)
    for row, col in zip(null_rows, null_cols):
        try:
            df.at[row, col] = None
        except (TypeError, ValueError):
            pass  # skip columns that refuse None gracefully
    # 0.5% duplicate rows
    n_dupes = max(1, int(len(df) * 0.005))
    dupe_rows = df.sample(n=n_dupes, random_state=int(rng.integers(0, 9999)))
    df = pd.concat([df, dupe_rows], ignore_index=True)
    return df

# ── Generators ────────────────────────────────────────────────────────────────

def generate_providers(r: np.random.Generator, fake: Faker) -> pd.DataFrame:
    """Hospitals, garages, surveyors, and agents as provider table."""
    rows = []
    categories = [
        ("Hospital",  1_000, "HSP"),
        ("Garage",    500,   "GRG"),
        ("Surveyor",  300,   "SRV"),
        ("Agent",     200,   "AGT"),
    ]
    for cat, count, prefix in categories:
        for i in range(1, count + 1):
            pid = f"{prefix}{i:04d}"
            state = r.choice(INDIAN_STATES, p=STATE_POP_WEIGHTS / np.array(STATE_POP_WEIGHTS).sum())
            tier = r.choice(["Network-A", "Network-B", "Network-C", "Out-of-Network"],
                            p=[0.25, 0.35, 0.30, 0.10])
            avg_bill_peer = 30_000 if cat == "Hospital" else (
                12_000 if cat == "Garage" else 5_000)
            # Inject billing anomaly for first 3 hospitals
            bill_multiplier = BILLING_MULTIPLIER if (cat == "Hospital" and pid in ANOMALY_HOSPITAL_IDS) else 1.0
            avg_bill = round(avg_bill_peer * bill_multiplier * float(r.uniform(0.8, 1.2)), 2)
            rows.append({
                "provider_id": pid,
                "provider_name": fake.company() + (
                    " Hospital" if cat == "Hospital" else
                    " Garage" if cat == "Garage" else
                    " Surveyors" if cat == "Surveyor" else " Agency"),
                "provider_type": cat,
                "state": state,
                "city": fake.city(),
                "network_tier": tier,
                "avg_billing_amount": avg_bill,
                "peer_avg_billing": avg_bill_peer,
                "billing_ratio": round(avg_bill / avg_bill_peer, 3),
                "active": bool(r.random() > 0.05),
                "is_anomaly": cat == "Hospital" and pid in ANOMALY_HOSPITAL_IDS,
                "is_fraud_ring": (cat == "Garage" and pid in FRAUD_GARAGE_IDS) or
                                 (cat == "Surveyor" and pid in FRAUD_SURVEYOR_IDS),
            })
    return pd.DataFrame(rows)


def generate_agents(r: np.random.Generator, fake: Faker) -> pd.DataFrame:
    rows = []
    for i in range(1, N_AGENTS + 1):
        state = r.choice(INDIAN_STATES, p=STATE_POP_WEIGHTS / np.array(STATE_POP_WEIGHTS).sum())
        rows.append({
            "agent_id": fmt_id("AGT", i),
            "agent_name": fake.name(),
            "state": state,
            "channel": r.choice(CHANNELS),
            "tenure_years": round(float(r.uniform(0.5, 20)), 1),
            "active_policies": int(r.integers(5, 400)),
            "avg_premium_collected": round(float(r.uniform(15_000, 2_00_000)), 2),
            "lapse_rate": round(float(r.uniform(0.03, 0.35)), 3),
            # Agent-linked churn cluster: agents 410-430 have very high lapse
            "churn_cluster": i >= 410 and i <= 430,
        })
    return pd.DataFrame(rows)


def generate_adjusters(r: np.random.Generator, fake: Faker) -> pd.DataFrame:
    rows = []
    for i in range(1, N_ADJUSTERS + 1):
        rows.append({
            "adjuster_id": fmt_id("ADJ", i),
            "adjuster_name": fake.name(),
            "specialisation": r.choice(PRODUCT_LINES),
            "avg_settlement_days": round(float(r.uniform(10, 120)), 1),
            "caseload": int(r.integers(20, 200)),
            "state": r.choice(INDIAN_STATES, p=STATE_POP_WEIGHTS / np.array(STATE_POP_WEIGHTS).sum()),
        })
    return pd.DataFrame(rows)


def generate_customers(r: np.random.Generator, fake: Faker) -> pd.DataFrame:
    rows = []
    for i in range(N_CUSTOMERS):
        state = r.choice(INDIAN_STATES, p=STATE_POP_WEIGHTS / np.array(STATE_POP_WEIGHTS).sum())
        age = int(r.integers(18, 75))
        income_band = r.choice(INCOME_BANDS, p=[0.20, 0.30, 0.25, 0.15, 0.07, 0.03])
        # Fraud ring customers share address patterns — first 120
        in_fraud_ring = FRAUD_CUSTOMER_START <= i <= FRAUD_CUSTOMER_END
        phone = f"9{r.integers(100_000_000, 999_999_999):09d}"
        # Ring customers share one of 5 phone prefixes
        if in_fraud_ring:
            phone = f"9876{r.integers(100_000, 999_999):06d}"
        rows.append({
            "customer_id": fmt_id("CUST", i + 1),
            "name": fake.name(),
            "age": age,
            "gender": r.choice(GENDERS, p=[0.52, 0.47, 0.01]),
            "state": state,
            "city": fake.city(),
            "pincode": fake.postcode(),
            "occupation": r.choice(OCCUPATIONS),
            "income_band": income_band,
            "credit_tier": r.choice(CREDIT_TIERS, p=[0.40, 0.30, 0.20, 0.10]),
            "tenure_months": int(r.integers(1, 72)),
            "channel": r.choice(CHANNELS, p=[0.40, 0.20, 0.15, 0.15, 0.10]),
            "family_size": int(r.integers(1, 8)),
            "segment": r.choice(SEGMENTS, p=[0.50, 0.30, 0.15, 0.05]),
            "email": fake.email(),
            "phone": phone,
            "bank_account_prefix": "HDFC" if in_fraud_ring else r.choice(
                ["HDFC", "SBI", "ICICI", "Axis", "Kotak"], p=[0.20, 0.30, 0.20, 0.15, 0.15]),
            "in_fraud_ring": in_fraud_ring,
            "created_at": rand_date(r, START_DATE, END_DATE).isoformat(),
        })
    return pd.DataFrame(rows)


def generate_policies(r: np.random.Generator, customers: pd.DataFrame) -> pd.DataFrame:
    rows = []
    cust_ids = customers["customer_id"].tolist()
    for i in range(N_POLICIES):
        product = r.choice(PRODUCT_LINES, p=PRODUCT_WEIGHTS)
        start = rand_date(r, START_DATE, date(2024, 6, 30))
        duration_months = int(r.choice([12, 24, 36, 60], p=[0.60, 0.20, 0.15, 0.05]))
        end = start + timedelta(days=duration_months * 30)
        sum_insured = int(r.choice([1, 2, 5, 10, 25, 50, 100]) * 1_00_000
                          * float(r.uniform(0.8, 1.5)))
        premium_rate = {"Motor": 0.025, "Health": 0.04, "Life": 0.015,
                        "Home": 0.008, "Travel": 0.05, "Crop": 0.06, "Marine": 0.02}[product]
        premium = round(sum_insured * premium_rate * float(r.uniform(0.8, 1.3)), 2)
        deductible = round(premium * float(r.uniform(0.05, 0.20)), 2)
        cust_id = r.choice(cust_ids)
        agent_id = fmt_id("AGT", int(r.integers(1, N_AGENTS + 1)))
        lapsed = bool(r.random() < 0.12)
        # Deteriorating Crop/Rajasthan: lapse rate increases after 2022
        cust_state = customers.loc[customers["customer_id"] == cust_id, "state"].values
        cust_state_val = cust_state[0] if len(cust_state) > 0 else "Maharashtra"
        if product == DETERIORATION_PRODUCT and cust_state_val == DETERIORATION_STATE and start.year >= 2022:
            lapsed = bool(r.random() < 0.25)  # higher lapse
        rows.append({
            "policy_id": fmt_id("POL", i + 1),
            "customer_id": cust_id,
            "product_line": product,
            "sum_insured": sum_insured,
            "annual_premium": premium,
            "deductible": deductible,
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "duration_months": duration_months,
            "agent_id": agent_id,
            "channel": r.choice(CHANNELS, p=[0.40, 0.20, 0.15, 0.15, 0.10]),
            "riders": r.choice(["None", "Accidental Death", "Critical Illness", "Zero Dep"],
                               p=[0.50, 0.20, 0.20, 0.10]),
            "renewal_status": r.choice(
                ["Active", "Renewed", "Lapsed", "Cancelled"],
                p=[0.55, 0.25, 0.12, 0.08]),
            "lapse_flag": lapsed,
            "state": cust_state_val,
        })
    return pd.DataFrame(rows)


def generate_weather_events(r: np.random.Generator) -> pd.DataFrame:
    """Named weather events that correlate with claim spikes."""
    rows = []
    events = [
        # The injected monsoon event
        {"event_id": "WX001", "event_name": "Kerala-Maharashtra-Assam Mega Flood 2022",
         "event_type": "Flood", "start_date": MONSOON_WINDOW_START.isoformat(),
         "end_date": MONSOON_WINDOW_END.isoformat(),
         "states": "Kerala,Maharashtra,Assam", "severity": "Extreme",
         "estimated_insured_loss_cr": 2_800},
        {"event_id": "WX002", "event_name": "Cyclone Biparjoy 2023",
         "event_type": "Cyclone", "start_date": "2023-06-10", "end_date": "2023-06-15",
         "states": "Gujarat,Rajasthan", "severity": "Severe",
         "estimated_insured_loss_cr": 650},
        {"event_id": "WX003", "event_name": "North India Heatwave 2022",
         "event_type": "Heatwave", "start_date": "2022-04-28", "end_date": "2022-05-20",
         "states": "Rajasthan,Uttar Pradesh,Haryana,Punjab", "severity": "Extreme",
         "estimated_insured_loss_cr": 120},
        {"event_id": "WX004", "event_name": "Tamil Nadu Cyclone Michaung 2023",
         "event_type": "Cyclone", "start_date": "2023-12-04", "end_date": "2023-12-08",
         "states": "Tamil Nadu,Andhra Pradesh", "severity": "Severe",
         "estimated_insured_loss_cr": 450},
        {"event_id": "WX005", "event_name": "Maharashtra Flood 2021",
         "event_type": "Flood", "start_date": "2021-07-22", "end_date": "2021-08-05",
         "states": "Maharashtra", "severity": "Major",
         "estimated_insured_loss_cr": 980},
    ]
    # Add more synthetic events
    for j in range(6, 31):
        evt_types = ["Flood", "Cyclone", "Heatwave", "Drought", "Frost"]
        sev = r.choice(["Minor", "Moderate", "Major", "Severe"])
        st = r.choice(INDIAN_STATES)
        yr = int(r.integers(2020, 2025))
        mo = int(r.integers(1, 13))
        rows.append({
            "event_id": f"WX{j:03d}",
            "event_name": f"{st} {r.choice(evt_types)} {yr}",
            "event_type": r.choice(evt_types),
            "start_date": f"{yr}-{mo:02d}-01",
            "end_date": f"{yr}-{mo:02d}-{min(28, int(r.integers(7, 22)))}",
            "states": st,
            "severity": sev,
            "estimated_insured_loss_cr": round(float(r.uniform(10, 800)), 1),
        })
    return pd.DataFrame(events + rows)


def generate_fraud_labels(claims: pd.DataFrame, r: np.random.Generator) -> pd.DataFrame:
    """Small % ground-truth fraud labels for training supervised model."""
    n = len(claims)
    labels = np.zeros(n, dtype=int)
    # Fraud ring claims already marked via is_fraud_ring in claims
    fraud_mask = claims["is_fraud_ring"].values.astype(bool)
    labels[fraud_mask] = 1
    # Add a small % random fraud (2%)
    random_fraud = r.random(n) < 0.02
    labels[random_fraud] = 1
    return pd.DataFrame({
        "claim_id": claims["claim_id"],
        "fraud_label": labels,
        "label_source": ["ring" if fraud_mask[i] else ("random" if labels[i] else "clean")
                         for i in range(n)],
    })


def generate_claims(
    r: np.random.Generator,
    fake: Faker,
    policies: pd.DataFrame,
    providers: pd.DataFrame,
    adjusters: pd.DataFrame,
) -> pd.DataFrame:
    rows = []

    garages = providers[providers["provider_type"] == "Garage"]["provider_id"].tolist()
    hospitals = providers[providers["provider_type"] == "Hospital"]["provider_id"].tolist()
    surveyors = providers[providers["provider_type"] == "Surveyor"]["provider_id"].tolist()
    adj_ids = adjusters["adjuster_id"].tolist()

    # Pre-compute policy lookup
    pol_lookup = policies.set_index("policy_id")[
        ["product_line", "sum_insured", "annual_premium", "customer_id", "state", "start_date"]
    ].to_dict("index")
    pol_ids = policies["policy_id"].tolist()

    n_generated = 0
    attempt = 0

    while n_generated < N_CLAIMS and attempt < N_CLAIMS * 3:
        attempt += 1
        pol_id = r.choice(pol_ids)
        pol = pol_lookup[pol_id]
        product = pol["product_line"]
        state = pol["state"]
        pol_start = date.fromisoformat(pol["start_date"])
        sum_insured = pol["sum_insured"]
        premium = pol["annual_premium"]
        cust_id = pol["customer_id"]

        # ── Monsoon spike: oversample motor/home in relevant states & window ──
        is_monsoon = (
            product in ["Motor", "Home"]
            and state in MONSOON_STATES
        )
        loss_date = rand_date(r, max(pol_start, START_DATE), END_DATE)
        if is_monsoon and r.random() < 0.04:
            # Force into monsoon window with extra probability
            loss_date = MONSOON_WINDOW_START + timedelta(days=int(r.integers(0, 21)))

        # ── Fraud ring: 5 garages + 3 surveyors ──
        # Customer in fraud ring → motor claim → fraud garage
        is_fraud_ring = False
        in_fraud_cust = int(cust_id.replace("CUST", "")) - 1
        if (FRAUD_CUSTOMER_START <= in_fraud_cust <= FRAUD_CUSTOMER_END
                and product == "Motor"):
            if r.random() < 0.60:
                is_fraud_ring = True

        report_date = loss_date + timedelta(days=int(r.integers(1, 90)))
        # Late-reporting cohort: ~5% of claims reported > 60 days after loss
        if r.random() < 0.05:
            report_date = loss_date + timedelta(days=int(r.integers(61, 180)))

        cause = r.choice(CAUSE_OF_LOSS.get(product, ["Unknown"]))
        # Flood cause for monsoon claims
        if is_monsoon and MONSOON_WINDOW_START <= loss_date <= MONSOON_WINDOW_END:
            cause = "Flood" if product == "Motor" else "Flood"

        amount_claimed = round(float(r.uniform(0.05, 0.95)) * sum_insured, 2)

        # Fraud ring: inflate estimate
        if is_fraud_ring:
            amount_claimed = round(amount_claimed * float(r.uniform(1.8, 2.5)), 2)
            amount_claimed = min(amount_claimed, sum_insured)

        approval_rate = r.uniform(0.60, 0.95)
        amount_approved = round(amount_claimed * float(approval_rate), 2) if r.random() > 0.15 else 0.0
        status = r.choice(
            CLAIM_STATUSES,
            p=[0.05, 0.10, 0.25, 0.45, 0.10, 0.05],
        )
        settlement_days = int(r.integers(5, 180)) if status == "Paid" else None

        # Provider assignment
        garage_id = hospital_id = surveyor_id = None
        if product == "Motor":
            garage_id = (r.choice(FRAUD_GARAGE_IDS) if is_fraud_ring
                         else r.choice(garages))
            surveyor_id = (r.choice(FRAUD_SURVEYOR_IDS) if is_fraud_ring
                           else r.choice(surveyors))
        elif product == "Health":
            hospital_id = r.choice(hospitals)

        # Round-number amounts (fraud signal)
        if is_fraud_ring and r.random() < 0.3:
            amount_claimed = round(amount_claimed / 1_000) * 1_000

        # Weekend/night filing (fraud signal)
        filed_on_weekend = loss_date.weekday() >= 5
        days_since_inception = (loss_date - pol_start).days

        rows.append({
            "claim_id": fmt_id("CLM", n_generated + 1),
            "policy_id": pol_id,
            "customer_id": cust_id,
            "product_line": product,
            "state": state,
            "loss_date": loss_date.isoformat(),
            "report_date": report_date.isoformat(),
            "report_lag_days": (report_date - loss_date).days,
            "claim_type": cause,
            "amount_claimed": amount_claimed,
            "amount_approved": amount_approved,
            "status": status,
            "settlement_days": settlement_days,
            "hospital_id": hospital_id,
            "garage_id": garage_id,
            "surveyor_id": surveyor_id,
            "adjuster_id": r.choice(adj_ids),
            "cause_of_loss": cause,
            "documents_count": int(r.integers(1, 12)),
            "channel": r.choice(CHANNELS),
            "region": state,
            "is_fraud_ring": is_fraud_ring,
            "filed_on_weekend": filed_on_weekend,
            "days_since_inception": days_since_inception,
            "is_round_amount": (amount_claimed % 1_000 == 0),
            "is_monsoon_claim": (is_monsoon and MONSOON_WINDOW_START <= loss_date <= MONSOON_WINDOW_END),
        })
        n_generated += 1

    return pd.DataFrame(rows)


def generate_rag_docs(out_dir: Path) -> None:
    """Generate synthetic policy wordings and SOP markdown files."""
    docs_dir = out_dir / "docs"
    docs_dir.mkdir(parents=True, exist_ok=True)

    motor_policy = """# Motor Insurance Policy Wording — InsureNexus Standard Motor Policy v3.2

## Section 1 — Definitions
**Sum Insured**: The Insured Declared Value (IDV) of the vehicle as agreed at policy inception.
**Own Damage**: Physical loss or damage to the insured vehicle.
**Third Party Liability**: Legal liability to third parties for bodily injury or property damage.

## Section 2 — Coverage
### 2.1 Own Damage Coverage
This policy covers physical loss or damage to the vehicle arising from:
- Accidental external means (Clause 2.1.1)
- Fire, explosion, self-ignition (Clause 2.1.2)
- Natural calamities: flood, typhoon, hurricane, storm, cyclone (Clause 2.1.3)
- Theft, burglary, housebreaking (Clause 2.1.4)
- Malicious acts, riots (Clause 2.1.5)

### 2.2 Third Party Liability
Unlimited liability for bodily injury or death of third party per Motor Vehicles Act 1988.

## Section 3 — Exclusions
- Wear and tear, mechanical/electrical breakdown (Clause 3.1)
- Driving under influence of alcohol/drugs (Clause 3.2)
- Claims filed more than 7 days after loss without reasonable cause (Clause 3.3)
- Pre-existing damage not declared at inception (Clause 3.4)

## Section 4 — Claims Procedure
1. Notify insurer within 7 days of loss (Clause 4.1)
2. Submit duly signed claim form with RC, DL, FIR (if theft) (Clause 4.2)
3. Vehicle must be produced for inspection before repair (Clause 4.3)
4. Surveyor appointed within 48 hours of claim registration (Clause 4.4)

## Section 5 — Fraud Prevention
Any claim involving misrepresentation, suppression of material fact, or collusion with a repair facility shall be repudiated under Section 45 of the Insurance Act 1938.
"""

    health_sop = """# Claims-Handling SOP — Health Insurance Claims

## SOP-HLT-001: Pre-Authorisation Process
**Applicable Claims**: Planned hospitalisation, day-care procedures.
1. Hospital submits pre-auth request via portal within 4 hours of admission.
2. Medical team reviews within 2 hours for emergencies, 4 hours for planned.
3. Approved amount valid for 5 days; extensions via SOP-HLT-005.

## SOP-HLT-002: Cashless Settlement
1. Network hospital submits final bill within 6 hours of discharge.
2. TPA reviews discharge summary and bills.
3. Payment released within 2 working days via NEFT.

## SOP-HLT-003: Reimbursement Claims
1. Policyholder submits all bills within 90 days of discharge.
2. **Red-Flag Triggers**: Bills > 2x peer median for same procedure, duplicate bills, provider not in network without emergency, claim filed within 30 days of policy inception for pre-existing condition.
3. Field investigation mandatory for claims > ₹5 lakh.

## SOP-HLT-004: Fraud Indicators
- Repeated claims from same provider cluster within 30 days
- Procedure codes inconsistent with diagnosis
- Bills rounded to nearest ₹1,000 for amounts > ₹50,000
- Patient age inconsistent with procedure (e.g., maternity claim for >50 age)

## SOP-HLT-005: Upcoding Detection
Compare procedure-level billing against peer benchmarks. Escalate to Special Investigations Unit (SIU) if billing ratio > 1.8x for 3 or more claims.
"""

    fraud_investigation_guide = """# Special Investigations Unit (SIU) — Investigation Guide

## Chapter 1: Fraud Ring Detection Framework

### 1.1 Indicators of an Organised Motor Fraud Ring
A motor fraud ring typically involves:
- **Cluster of garages** (3-10) consistently processing inflated claims
- **Common surveyors** who approve without site inspection
- **Linked customers** sharing phone numbers, addresses, or bank details
- **Short-inception claims**: majority filed within 30-60 days of policy start
- **Round-number estimates**: 30% or more claims are round ₹ amounts
- **Night/weekend filing**: disproportionate filing outside business hours

### 1.2 Investigation Steps
1. Build entity-link graph: customer → policy → claim → garage → surveyor
2. Identify communities with >3 shared edges (suspect ring)
3. Request bank statements for common bank account prefixes
4. Conduct surprise inspection at top 3 garages
5. Interview claimants independently
6. Cross-reference with RTO records for vehicle sale/scrap history

### 1.3 Evidence Standards
Under IRDA (Protection of Policyholders' Interests) Regulations 2017, repudiation requires documented evidence. Circumstantial evidence must be corroborated by at least two independent sources.

## Chapter 2: Hospital Billing Anomaly Detection

### 2.1 Upcoding Patterns
- Billing for highest-complexity DRG (Diagnosis-Related Group) for routine procedures
- Unbundling: billing separately for procedures that should be bundled
- Phantom billing: procedures listed that were not performed

### 2.2 Benchmark Analysis
Maintain 90-day rolling peer median per procedure code per city tier. Escalate if ratio > 1.8x for any provider with > 10 claims in the window.
"""

    docs = {
        "motor_policy_wording.md": motor_policy,
        "health_claims_sop.md": health_sop,
        "fraud_investigation_guide.md": fraud_investigation_guide,
        "crop_insurance_policy.md": """# Crop Insurance Policy — Pradhan Mantri Fasal Bima Yojana Aligned Product

## Coverage Triggers
- Yield-based shortfall > 20% vs district average (Clause 1.1)
- Weather index trigger: rainfall < 60% of LPA for kharif crops (Clause 1.2)
- Flood inundation > 48 hours during critical growth stage (Clause 1.3)

## Claims Process for Rajasthan
Claims in Rajasthan must be supported by: (a) district weather station data, (b) patwari crop-cutting experiment report, (c) geo-tagged photographs of affected area.

## Loss Ratio Monitoring
Product managers must flag if the Rajasthan portfolio loss ratio exceeds 85% for 2 consecutive quarters. Underwriting review mandatory above 90%.
""",
        "home_insurance_policy.md": """# Home Insurance Policy Wording — InsureNexus Griha Suraksha v2.1

## Covered Perils
- Fire and allied perils (Clause 2.1)
- Natural calamities including flood, cyclone, earthquake (Clause 2.2)
- Burglary and housebreaking (Clause 2.3)
- Accidental damage to contents (Clause 2.4)

## Flood Claims — Special Provision
For flood claims arising from government-declared natural disasters, the standard 7-day reporting window (Clause 4.1) is extended to 30 days. Photograph evidence and a municipal authority loss certificate are required.

## Monsoon Season Advisory
Policyholders in Kerala, Maharashtra, Goa, West Bengal, and Assam are advised to document property condition in April before monsoon season. Pre-damage documentation will expedite flood claim settlement.
""",
    }
    for filename, content in docs.items():
        (docs_dir / filename).write_text(content)
    print(f"  ✓ RAG docs written: {len(docs)} files → {docs_dir}")


# ── Main ──────────────────────────────────────────────────────────────────────

def write_table(df: pd.DataFrame, name: str, out_dir: Path) -> None:
    parquet_dir = out_dir / "parquet"
    csv_dir = out_dir / "csv"
    parquet_dir.mkdir(parents=True, exist_ok=True)
    csv_dir.mkdir(parents=True, exist_ok=True)
    df.to_parquet(parquet_dir / f"{name}.parquet", index=False)
    df.to_csv(csv_dir / f"{name}.csv", index=False)
    print(f"  ✓ {name}: {len(df):,} rows → parquet + csv")


def generate_kpi_snapshot(
    claims: pd.DataFrame, policies: pd.DataFrame
) -> pd.DataFrame:
    """Pre-compute monthly KPI snapshots for fast dashboard queries."""
    claims["loss_month"] = pd.to_datetime(claims["loss_date"]).dt.to_period("M").astype(str)
    policies["start_month"] = pd.to_datetime(policies["start_date"]).dt.to_period("M").astype(str)

    monthly_claims = claims.groupby("loss_month").agg(
        total_claims=("claim_id", "count"),
        total_claimed=("amount_claimed", "sum"),
        total_approved=("amount_approved", "sum"),
        avg_settlement_days=("settlement_days", "mean"),
        fraud_ring_claims=("is_fraud_ring", "sum"),
    ).reset_index()

    monthly_premium = policies.groupby("start_month").agg(
        new_policies=("policy_id", "count"),
        gwp=("annual_premium", "sum"),
    ).reset_index().rename(columns={"start_month": "loss_month"})

    snapshot = monthly_claims.merge(monthly_premium, on="loss_month", how="outer").fillna(0)
    snapshot["loss_ratio"] = snapshot["total_approved"] / snapshot["gwp"].replace(0, np.nan)
    snapshot = snapshot.sort_values("loss_month")
    return snapshot


def main(out_dir: str = "data") -> None:
    print("╔══════════════════════════════════════════╗")
    print("║  Insurance Insight Nexus — Data Engine   ║")
    print("╚══════════════════════════════════════════╝")

    r = rng()
    fake = fake_factory()
    out = Path(out_dir)

    print("\n[1/9] Generating providers …")
    providers = generate_providers(r, fake)
    write_table(providers, "providers", out)

    print("[2/9] Generating agents …")
    agents = generate_agents(r, fake)
    write_table(agents, "agents", out)

    print("[3/9] Generating adjusters …")
    adjusters = generate_adjusters(r, fake)
    write_table(adjusters, "adjusters", out)

    print("[4/9] Generating customers …")
    customers = generate_customers(r, fake)
    write_table(inject_noise(customers, r, 0.015), "customers", out)

    print("[5/9] Generating policies …")
    policies = generate_policies(r, customers)
    write_table(inject_noise(policies, r, 0.01), "policies", out)

    print("[6/9] Generating claims (this takes ~30s) …")
    claims = generate_claims(r, fake, policies, providers, adjusters)
    write_table(inject_noise(claims, r, 0.012), "claims", out)

    print("[7/9] Generating fraud labels …")
    fraud_labels = generate_fraud_labels(claims, r)
    write_table(fraud_labels, "fraud_labels", out)

    print("[8/9] Generating weather events …")
    weather = generate_weather_events(r)
    write_table(weather, "weather_events", out)

    print("[9/9] Generating KPI snapshots + RAG docs …")
    kpi = generate_kpi_snapshot(claims, policies)
    write_table(kpi, "kpi_snapshots", out)
    generate_rag_docs(out)

    # ── Summary stats ───────────────────────────────────────────────────────
    fraud_count = claims["is_fraud_ring"].sum()
    monsoon_count = claims["is_monsoon_claim"].sum()
    anomaly_providers = providers[providers["is_anomaly"]]["provider_id"].tolist()
    print(f"""
╔════════════════════════════════════════════════════════╗
║  DATA GENERATION COMPLETE                              ║
╠════════════════════════════════════════════════════════╣
║  Customers   : {len(customers):>10,}                       ║
║  Policies    : {len(policies):>10,}                       ║
║  Claims      : {len(claims):>10,}                       ║
║  Providers   : {len(providers):>10,}                       ║
║  Fraud-ring claims: {fraud_count:>6,}  ({fraud_count/len(claims)*100:.1f}%)               ║
║  Monsoon spike claims: {monsoon_count:>4,}                     ║
║  Anomaly hospitals: {anomaly_providers}     ║
╠════════════════════════════════════════════════════════╣
║  Parquet + CSV written to: {str(out):<30} ║
╚════════════════════════════════════════════════════════╝
""")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate synthetic insurance data")
    parser.add_argument("--out-dir", default="data", help="Output directory")
    args = parser.parse_args()
    main(args.out_dir)

# Insurance Insight Nexus — Data Dictionary & Hidden Patterns

## Seed & Reproducibility
All data is generated with `SEED=42` (numpy + Faker). Re-running the generator produces identical Parquet files.

## Tables

### customers (50,000 rows)
| Column | Type | Notes |
|--------|------|-------|
| customer_id | str | CUST000001..CUST050000 |
| name | str | Faker en_IN |
| age | int | 18-75 |
| gender | str | Male/Female/Other |
| state | str | 23 Indian states, pop-weighted |
| city | str | |
| pincode | str | |
| occupation | str | 9 categories |
| income_band | str | <2L to 50L+ |
| credit_tier | str | Prime/Near-Prime/Sub-Prime/Thin-File |
| tenure_months | int | 1-72 |
| channel | str | Agent/Direct/Broker/Online/Bancassurance |
| family_size | int | 1-8 |
| segment | str | Mass/Mass-Affluent/Affluent/HNI |
| phone | str | 10-digit Indian mobile |
| bank_account_prefix | str | HDFC/SBI/ICICI/Axis/Kotak |
| in_fraud_ring | bool | TRUE for CUST000001..CUST000120 |

### policies (80,000 rows)
| Column | Type | Notes |
|--------|------|-------|
| policy_id | str | POL000001..POL080000 |
| customer_id | str | FK → customers |
| product_line | str | Motor/Health/Life/Home/Travel/Crop/Marine |
| sum_insured | int | INR, product-appropriate range |
| annual_premium | float | product × SI × rate × noise |
| deductible | float | 5-20% of premium |
| start_date | date | 2020-01-01 to 2024-06-30 |
| end_date | date | start + 12/24/36/60 months |
| agent_id | str | FK → agents |
| channel | str | |
| riders | str | None/Accidental Death/Critical Illness/Zero Dep |
| renewal_status | str | Active/Renewed/Lapsed/Cancelled |
| lapse_flag | bool | Higher for Crop/Rajasthan post-2022 |
| state | str | Inherited from customer |

### claims (120,000 rows)
| Column | Type | Notes |
|--------|------|-------|
| claim_id | str | CLM000001..CLM120000 |
| policy_id | str | FK → policies |
| customer_id | str | FK → customers |
| product_line | str | |
| state | str | |
| loss_date | date | |
| report_date | date | |
| report_lag_days | int | days between loss and report |
| claim_type | str | cause of loss |
| amount_claimed | float | INR |
| amount_approved | float | INR; 0 if rejected |
| status | str | Reported/Under Assessment/Approved/Paid/Rejected/Withdrawn |
| settlement_days | int | nullable, only if status=Paid |
| hospital_id | str | nullable, Health claims only |
| garage_id | str | nullable, Motor claims only |
| surveyor_id | str | nullable, Motor claims only |
| adjuster_id | str | FK → adjusters |
| documents_count | int | 1-12 |
| is_fraud_ring | bool | TRUE for ring-linked claims |
| filed_on_weekend | bool | Fraud signal |
| days_since_inception | int | Fraud signal: <30 = high risk |
| is_round_amount | bool | Fraud signal |
| is_monsoon_claim | bool | TRUE for July 4-24 2022, Motor/Home, KL/MH/AS |

### providers (2,000 rows)
| Column | Type | Notes |
|--------|------|-------|
| provider_id | str | HSP####/GRG####/SRV####/AGT#### |
| provider_type | str | Hospital/Garage/Surveyor/Agent |
| network_tier | str | Network-A/B/C/Out-of-Network |
| avg_billing_amount | float | HSP001-003 = 2.4x peer avg |
| billing_ratio | float | >1.5 = anomaly flag |
| is_anomaly | bool | TRUE for HSP0001-HSP0003 |
| is_fraud_ring | bool | TRUE for GRG0001-0005, SRV0001-0003 |

---

## Injected Hidden Patterns (DEMO USE ONLY — do not expose in UI as "answers")

### Pattern A — Monsoon Motor/Home Claims Spike 🌊
- **Window**: July 4-24, 2022 (3 weeks)
- **States**: Kerala, Maharashtra, Assam
- **Magnitude**: ~+180% above baseline (MONSOON_MULTIPLIER=2.8)
- **Cause label**: "Flood"
- **Demo flow**: Dashboard → India heatmap (July 2022) → Ask Nexus "Why did motor claims spike in Kerala in July 2022?" → Anomaly tab → Weather event WX001

### Pattern B — Fraud Ring 🕵️
- **Garages**: GRG0001–GRG0005
- **Surveyors**: SRV0001–SRV0003
- **Customers**: CUST000001–CUST000120 (shared phone prefix 9876, bank=HDFC)
- **Signals**: days_since_inception < 30, round amounts, filed on weekends, inflated claims 1.8-2.5x
- **Demo flow**: Fraud tab → Graph view (see ring) → Investigation queue → Create case → LLM explanation

### Pattern C — Hospital Billing Anomaly 🏥
- **Providers**: HSP0001, HSP0002, HSP0003
- **Pattern**: avg_billing_amount = 2.4x peer median
- **Demo flow**: Provider benchmarking → sort by billing_ratio → anomaly flag → SHAP reasons

### Pattern D — Crop/Rajasthan Loss Ratio Deterioration 📈
- **Product**: Crop insurance in Rajasthan
- **Trend**: lapse_flag rate increases from 12% → 25% from 2022 onward, higher claim severity
- **Demo flow**: Policy analytics → cohort view → loss ratio trend by product/state

### Pattern E — Data Quality Noise 🔧
- ~1.5% random nulls injected across all tables
- ~0.5% duplicate rows
- **Demo flow**: Data Quality tab → scorecard → highlight nulls + dupes

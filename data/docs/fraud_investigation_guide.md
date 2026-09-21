# Special Investigations Unit (SIU) — Investigation Guide

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

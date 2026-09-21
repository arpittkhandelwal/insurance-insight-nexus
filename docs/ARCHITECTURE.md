# Insurance Insight Nexus Architecture

<div align="center">
  <p><b>A Blueprint for Next-Generation Insurance Analytics</b></p>
</div>

---

## Overview

Insurance Insight Nexus is a high-performance, AI-driven analytics platform for insurance carriers. It provides real-time insights into claims, fraud patterns, and portfolio risk.

> [!TIP]
> **Performance First!** The entire stack is optimized for sub-second analytical querying using DuckDB while leveraging AWS serverless architecture for infinite scalability.

---

## The Architecture Diagram

```mermaid
graph TD
    %% Define styles
    classDef aws fill:#FF9900,stroke:#232F3E,stroke-width:2px,color:white;
    classDef react fill:#61DAFB,stroke:#282C34,stroke-width:2px,color:black;
    classDef python fill:#3776AB,stroke:#FFD43B,stroke-width:2px,color:white;
    classDef db fill:#4CAF50,stroke:#1B5E20,stroke-width:2px,color:white;
    classDef ai fill:#9C27B0,stroke:#4A148C,stroke-width:2px,color:white;

    %% Components
    User((User))
    
    subgraph "Frontend Layer"
        CF[Amazon CloudFront]:::aws
        S3[Amazon S3 (React SPA)]:::react
    end
    
    subgraph "Compute Layer"
        ALB[Application Load Balancer]:::aws
        ECS[ECS Fargate (FastAPI)]:::python
    end
    
    subgraph "Data & AI Layer"
        DuckDB[(DuckDB + Parquet)]:::db
        Dynamo[(DynamoDB Audit Log)]:::aws
        Bedrock[Amazon Bedrock]:::ai
        Sarvam[Sarvam AI]:::ai
    end

    %% Flow
    User -->|Visits App| CF
    CF -->|Serves Static Assets| S3
    CF -->|Routes /api/*| ALB
    ALB -->|Proxies HTTP| ECS
    
    ECS -->|SQL Queries| DuckDB
    ECS -->|Logs Decisions| Dynamo
    ECS <-->|Agentic Intents| Bedrock
    ECS <-->|Speech to Text| Sarvam
```

---

## Deep Dive into Components

### Frontend (React 18 / Vite / Tailwind)
- **Framework:** React 18 powered by Vite for lightning-fast HMR and building.
- **Styling:** Beautiful and responsive Tailwind CSS with custom UI components (Tremor, Recharts).
- **Hosting:** Served globally at the edge via **Amazon CloudFront** from an **S3 Bucket**.

### Backend (FastAPI / Uvicorn)
- **API Framework:** FastAPI for asynchronous, high-performance HTTP endpoints.
- **Agentic Engine:** A robust 10-step Natural Language to SQL engine. It translates human intent into complex DuckDB analytical queries.
- **AI Resilience:** Fallback mechanism between Amazon Bedrock (Claude 3.5 Sonnet) and Sarvam AI ensures the demo **never** breaks.
- **Compute Environment:** Containerized in Docker and run serverlessly on **Amazon ECS Fargate**.

### Data Layer
- **Analytical DB:** **DuckDB** operates directly over columnar Parquet files! No heavy database server needed—just raw speed.
- **Compliance Storage:** **AWS DynamoDB** acts as an immutable ledger. Every Human-in-the-Loop decision (approvals/rejections) is logged permanently.

### Infrastructure (AWS CDK)
> [!IMPORTANT]
> Infrastructure is code! If it's not in the CDK, it doesn't exist.

- All AWS resources are strictly provisioned via `infra/` using **AWS CDK (Python)**.
- Secrets are securely managed via **AWS Secrets Manager**.
- Live telemetry is beamed to **CloudWatch Dashboards**.

---

## System Flow in Action

1. A user opens the React SPA, served instantly from **CloudFront edge caches**.
2. API calls map seamlessly to `/api/*`, passing through CloudFront directly to the **Application Load Balancer**.
3. The ALB distributes traffic across serverless **ECS Fargate** tasks running FastAPI.
4. FastAPI orchestrates **Amazon Bedrock** for intelligent query generation and rips through Parquet files with **DuckDB**.
5. User interactions (e.g., flagging a fraudulent claim) are immutably appended to **DynamoDB**.

# Insurance Insight Nexus Architecture

## Overview
Insurance Insight Nexus is a high-performance, AI-driven analytics platform for insurance carriers. It provides real-time insights into claims, fraud patterns, and portfolio risk.

## Components

### Frontend (React 18 / Vite / Tailwind)
- **Framework:** React 18 with Vite for lightning-fast HMR and building.
- **Styling:** Tailwind CSS with custom UI components (Tremor, Recharts).
- **State Management:** React hooks and context.
- **Hosting:** Deployed to Amazon S3 and served globally via Amazon CloudFront.

### Backend (FastAPI / Uvicorn)
- **API Framework:** FastAPI for asynchronous, high-performance API endpoints.
- **LLM Agentic Engine:** A robust 10-step NL-to-SQL engine utilizing LangChain concepts, querying DuckDB.
- **LLM Providers:** Supports Amazon Bedrock (Claude 3.5 Sonnet) and Sarvam AI. Employs a resilient fallback mechanism (Bedrock -> Sarvam -> Mock) to ensure the demo never breaks.
- **Hosting:** Containerized (Docker) and deployed to Amazon ECS (Fargate) behind an Application Load Balancer (ALB). Cost: ~$30-40/month.

### Data Layer
- **Analytical DB:** DuckDB operating directly over Parquet files, providing rapid columnar analytics without a heavy database server.
- **Persistent Storage:** AWS DynamoDB (on-demand) used for storing case management audit logs and decisions.

### Infrastructure (AWS CDK)
- All infrastructure is defined as code using AWS CDK (Python).
- **Resources:**
  - ECR Repository
  - ECS Fargate Service & Application Load Balancer
  - S3 + CloudFront
  - DynamoDB Table
  - Secrets Manager
  - CloudWatch Dashboards

## System Flow
1. User interacts with the React SPA served via CloudFront.
2. API calls are routed through CloudFront (at `/api/*`) directly to the public ALB in front of the ECS Fargate tasks.
3. FastAPI backend queries DuckDB for analytics data or invokes Amazon Bedrock/Sarvam for AI insights.
4. User decisions (e.g., approving/rejecting a case) are written to DynamoDB for auditability.

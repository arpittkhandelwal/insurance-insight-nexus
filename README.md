# Insurance Insight Nexus

**Status:** AWS Deployment Ready 🚀

Insurance Insight Nexus is a high-performance, AI-driven analytics platform designed for insurance carriers. It provides real-time insights into claims, fraud patterns, and portfolio risk.

## Hackathon Deliverables Checklist
- [x] **Agentic NL Engine (Ask Nexus):** Converts natural language to DuckDB SQL queries over local Parquet data, executed via a 10-step planning agent.
- [x] **LLM Integration:** Supports Amazon Bedrock (Claude 3.5 Sonnet) and Sarvam AI models with a resilient fallback mechanism ensuring the demo never breaks.
- [x] **AWS Deployment:** Full deployment pipeline targeting Amazon ECS Fargate + ALB (Backend), S3 + CloudFront (Frontend), and DynamoDB (Audit logs).
- [x] **Infrastructure as Code:** 100% defined in AWS CDK (Python).
- [x] **CI/CD:** Automated GitHub Actions workflows for testing, security scanning (Trivy), and deployment.
- [x] **Compliance & Audit:** Case management decisions are audit-logged to DynamoDB, and UI prominently displays AI insight disclaimers.

## Documentation
- [Architecture & System Flow](docs/ARCHITECTURE.md)
- [AWS Deployment Guide](docs/DEPLOYMENT_GUIDE.md)
- [CI/CD Pipeline Details](docs/CICD.md)

## Quickstart (Local Development)

### Prerequisites
- Node.js 18+
- Python 3.12+
- Docker & Docker Compose (optional for container testing)

### Run Locally (Demo Mode)
To run the full stack locally with mock data and zero cloud dependencies:
```bash
# 1. Start the backend
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 2. Start the frontend
cd ../frontend
npm install
npm run dev
```

### Run via Docker Compose
```bash
docker compose up --build
```
Verify the health check at `http://localhost:8080/api/health`.

## Submission
To generate the final zip for hackathon submission:
```bash
chmod +x scripts/package_submission.sh
./scripts/package_submission.sh
```

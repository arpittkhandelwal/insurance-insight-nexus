# Insurance Insight Nexus

Insurance Insight Nexus is a high-performance, conversational analytics and fraud detection platform designed for modern insurance portfolios. It leverages an agentic AI architecture on top of an embedded analytical database to democratize data access for executives, data analysts, and compliance officers.

## Architecture & Technology Stack

The platform is strictly divided into an interactive frontend, a highly optimized analytical backend, and a scalable cloud infrastructure framework.

### Frontend
- Framework: React 18 with Vite
- Styling: TailwindCSS
- Visualization: Recharts, React-Globe, D3
- State Management: React Query

### Backend
- Framework: FastAPI and Uvicorn
- Data Layer: DuckDB (operating over Parquet files for sub-second analytical querying)
- Data Processing: Pandas, NumPy
- AI Core: Amazon Bedrock (Agentic intent mapping and dynamic SQL generation)
- Speech-to-Text: Sarvam AI

### Infrastructure (AWS CDK)
- Compute: Amazon ECS Fargate (Serverless Containers)
- Networking: Application Load Balancer (ALB) and CloudFront
- Storage: Amazon S3 (Frontend hosting)
- Database: Amazon DynamoDB (Compliance Audit Logging)
- Secrets: AWS Secrets Manager

## Key Capabilities

1. Natural Language Analytics (Ask Nexus)
The platform features an advanced agentic workflow that translates natural language inquiries into secure, optimized SQL. The system autonomously maps intents, generates queries against the DuckDB data layer, selects appropriate visualization parameters, and provides immediate analytical insights without requiring manual data engineering.

2. Fraud Network Visualization
Instead of treating claims in isolation, the platform continuously scores incoming claims and constructs entity relationship networks. Investigators can visually identify coordinated fraud rings by analyzing shared providers, geographic hotspots, and linked policyholders.

3. Human-in-the-Loop Compliance
To ensure regulatory compliance within the financial sector, AI outputs are strictly treated as analytical insights, not final decisions. The platform enforces a Case Management queue where human investigators review high-risk flags. Every approval, rejection, or escalation is immutably written to a DynamoDB Audit Log.

4. Executive Command Center
A unified dashboard delivering a real-time pulse of portfolio health, including live tracking of total policies, active claims, lapse rates, and immediate fraud exposure metrics.

## Security & Guardrails

- Dynamic SQL Validation: All AI-generated SQL undergoes strict AST validation to prevent data manipulation (blocking DELETE, DROP, INSERT, TRUNCATE) before execution.
- Least Privilege Access: AWS IAM roles are precisely scoped. The ECS Task Role is granted exclusive access only to required Bedrock models and the specific DynamoDB audit table.
- Infrastructure as Code: The entire environment is provisioned immutably via AWS CDK, ensuring repeatable, secure deployments with built-in rollback mechanisms.

## Deployment Guide

The deployment is fully automated using AWS CDK and is designed to run efficiently on an AWS account.

### Prerequisites
- AWS CLI configured with active credentials
- Node.js (for AWS CDK and Frontend build)
- Python 3.10+ (for Backend runtime)
- Docker (for container builds)

### Automated Deployment
Execute the bootstrap and deployment script from the project root:

```bash
export AWS_REGION=us-east-2
./scripts/first_deploy.sh
```

The script will sequentially:
1. Provision an Amazon ECR repository.
2. Build and push the FastAPI backend Docker image.
3. Deploy the ECS Fargate cluster, ALB, and DynamoDB tables.
4. Build the React frontend and sync it to the provisioned S3 bucket.
5. Invalidate the CloudFront distribution to serve the latest application state.

### Local Development

To run the platform locally without deploying to AWS:

1. Backend:
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

2. Frontend:
```bash
cd frontend
npm install
npm run dev
```

## Screenshots

<img src="Screenshot 2026-09-21 at 9.57.59 PM.png" alt="Screenshot 1" width="800"/>
<img src="Screenshot 2026-09-21 at 9.58.12 PM.png" alt="Screenshot 2" width="800"/>
<img src="Screenshot 2026-09-21 at 9.58.24 PM.png" alt="Screenshot 3" width="800"/>

## Licensing

This project is provided for hackathon demonstration purposes. Ensure all dependencies and cloud resources comply with your organizational security policies before adopting in production.

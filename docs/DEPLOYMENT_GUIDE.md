# Insurance Insight Nexus - Architecture & Deployment Guide

This document details the architectural topology, cloud provisioning methodology, and operational procedures required to deploy and maintain the Insurance Insight Nexus platform in a production AWS environment.

## 1. Architectural Topology

The platform leverages a serverless containerized architecture optimized for high-throughput analytical queries and deterministic compliance logging. 

### Core Components
- **Frontend Layer**: Amazon S3 paired with Amazon CloudFront for globally distributed, low-latency static asset delivery. The frontend SPA handles client-side routing and state management.
- **API Proxy**: CloudFront routes all `/api/*` traffic to the Application Load Balancer (ALB) via an HTTP Origin, preventing direct internet exposure of backend resources.
- **Compute Layer**: Amazon Elastic Container Service (ECS) running on AWS Fargate. The FastAPI/DuckDB container operates serverlessly, scaled by demand, without underlying EC2 instance management.
- **State & Compliance**: Amazon DynamoDB serves as an immutable ledger for the Human-in-the-Loop Case Management system. AWS Secrets Manager securely injects necessary API tokens into the ECS Task Definition at runtime.

## 2. Infrastructure as Code (AWS CDK)

All infrastructure is defined immutably using the AWS Cloud Development Kit (CDK) in Python (`infra/`).

### Stacks
- **InsuranceInsightEcrStack**: Provisions the isolated Amazon Elastic Container Registry (ECR).
- **InsuranceInsightAppStack**: Provisions the VPC, Subnets, Fargate Cluster, Load Balancer, S3 Bucket, CloudFront Distribution, DynamoDB Audit Table, and associated IAM Roles with least-privilege policies.

## 3. Prerequisite Tooling

To deploy this architecture, the host machine requires the following configuration:

1. **AWS CLI v2**: Configured with an administrative or highly permissive IAM user (`aws configure`).
2. **Node.js (v18+)**: Required for AWS CDK execution and React frontend compilation.
3. **Python 3.10+**: Required for CDK synthesis and backend runtime environment.
4. **Docker Engine**: Required to build the FastAPI/DuckDB container image prior to ECR upload.

## 4. Automated Deployment Procedure

The entire deployment lifecycle is encapsulated within an idempotent bash script.

### Step-by-Step Execution

1. **Set Deployment Region**
   Determine the target AWS region. By default, the script will fall back to `ap-south-1`, but can be overridden via environment variables.
   ```bash
   export AWS_REGION=us-east-2
   ```

2. **Execute the Deployment Script**
   Navigate to the repository root and run the deployment automation script.
   ```bash
   ./scripts/first_deploy.sh
   ```

### Script Execution Lifecycle
The deployment script executes the following sequence autonomously:
1. Installs AWS CDK globally via npm.
2. Installs Python dependencies for the CDK stack (using `--break-system-packages` to bypass PEP-668 restrictions on environments like macOS).
3. Bootstraps the AWS environment (`cdk bootstrap`).
4. Deploys the `InsuranceInsightEcrStack`.
5. Authenticates the local Docker daemon to the newly provisioned ECR registry.
6. Builds the FastAPI Docker image and pushes it to ECR.
7. Deploys the `InsuranceInsightAppStack` referencing the pushed image tag.
8. Forces an ECS service update to cycle any pre-existing tasks to the new image.
9. Compiles the React Vite frontend (`npm run build`).
10. Synchronizes the compiled `dist/` directory to the newly provisioned S3 bucket.
11. Creates a CloudFront invalidation for `/*` to ensure edge caches serve the latest frontend.
12. Executes HTTP smoke tests against the CloudFront domain and the `/api/health` endpoint.

## 5. Post-Deployment Configuration

Following a successful deployment, one manual configuration step is required for the LLM integration:

1. Navigate to the AWS Management Console.
2. Open **AWS Secrets Manager**.
3. Locate the secret named `insurance-nexus/sarvam-api-key`.
4. Update the secret value with your valid Sarvam AI API token. The ECS Fargate task will automatically resolve this secret during inference.

## 6. Teardown Procedure

To completely remove the platform and halt all associated AWS billing, execute the destruction sequence:

```bash
cd infra
cdk destroy --all
```

*Note: S3 buckets and ECR repositories are configured with `RemovalPolicy.DESTROY` and will be purged automatically.*

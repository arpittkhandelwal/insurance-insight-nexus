# Insurance Insight Nexus Deployment Guide

<div align="center">
  <p><b>From Zero to Production in Minutes</b></p>
</div>

---

This document details the architectural topology, cloud provisioning methodology, and operational procedures required to deploy and maintain the **Insurance Insight Nexus** platform in a production AWS environment.

---

## 1. Architectural Topology

The platform leverages a **serverless containerized architecture** optimized for high-throughput analytical queries and deterministic compliance logging.

### Core Components
- **Frontend Layer**: Amazon S3 paired with Amazon CloudFront for globally distributed, low-latency static asset delivery. 
- **API Proxy**: CloudFront routes all `/api/*` traffic to the Application Load Balancer (ALB) via an HTTP Origin, completely shielding backend resources from the open internet.
- **Compute Layer**: Amazon Elastic Container Service (ECS) running on AWS Fargate. The FastAPI/DuckDB container operates serverlessly and scales by demand!
- **State & Compliance**: Amazon DynamoDB serves as an immutable ledger for the Human-in-the-Loop Case Management system. AWS Secrets Manager securely injects API tokens.

---

## 2. Infrastructure as Code (AWS CDK)

> [!TIP]
> **No ClickOps!** All infrastructure is defined immutably using the AWS Cloud Development Kit (CDK) in Python (`infra/`).

### The Stacks
- **`InsuranceInsightEcrStack`**: Provisions the isolated Amazon Elastic Container Registry (ECR).
- **`InsuranceInsightAppStack`**: Provisions the VPC, Subnets, Fargate Cluster, Load Balancer, S3 Bucket, CloudFront Distribution, DynamoDB Audit Table, and IAM Roles with strict least-privilege policies.

---

## 3. Prerequisite Tooling

Before launching the rockets, ensure your machine is equipped with:

- [x] **AWS CLI v2**: Configured with an administrative IAM user (`aws configure`).
- [x] **Node.js (v18+)**: Required for AWS CDK execution and React frontend compilation.
- [x] **Python 3.10+**: Required for CDK synthesis and backend runtime.
- [x] **Docker Engine**: Required to build the FastAPI container before pushing to ECR.

---

## 4. Automated Deployment Procedure

> [!IMPORTANT]
> The entire deployment lifecycle is completely automated by an idempotent bash script. Grab a coffee, we've got this.

### Step-by-Step Execution

**1. Set Deployment Region**  
Determine your target AWS region (defaults to `ap-south-1` if unset).
```bash
export AWS_REGION=us-east-2
```

**2. Execute the Deployment Script**  
Navigate to the root directory and let it rip!
```bash
./scripts/first_deploy.sh
```

### What happens during the script?
1. Installs AWS CDK globally.
2. Installs Python dependencies (bypassing PEP-668 restrictions gracefully).
3. Bootstraps the AWS environment (`cdk bootstrap`).
4. Deploys the ECR Stack.
5. Authenticates local Docker to ECR, builds the FastAPI image, and pushes it.
6. Deploys the mighty App Stack.
7. Forces an ECS service update to cycle any existing tasks.
8. Compiles the React Vite frontend.
9. Syncs `dist/` to the S3 bucket.
10. Invalidates CloudFront edge caches (`/*`).
11. Executes HTTP smoke tests against the health endpoints.

---

## 5. Post-Deployment Configuration

> [!WARNING]
> One manual step is required to unlock AI magic!

1. Navigate to the **AWS Management Console**.
2. Open **AWS Secrets Manager**.
3. Locate the secret: `insurance-nexus/sarvam-api-key`.
4. Update the secret value with your valid **Sarvam AI API token**. 
*(The ECS task will dynamically resolve this at runtime.)*

---

## 6. Teardown Procedure

> [!CAUTION]
> Executing this will completely obliterate the platform and stop all AWS billing. Use with care.

```bash
cd infra
cdk destroy --all
```

*Note: S3 buckets and ECR repositories are configured with `RemovalPolicy.DESTROY` and will automatically vanish!*

# Deployment Guide

This guide explains how to deploy Insurance Insight Nexus to AWS from a clean account.

## Prerequisites
- Node.js 18+
- Python 3.12+
- Docker installed and running
- AWS CLI configured with Administrator access
- CDK CLI installed globally (`npm install -g aws-cdk`)

## 1. Initial Setup Deploy (Idempotent)
To solve the chicken-and-egg problem of ECS Fargate requiring an existing ECR image, we provide an automated script that deploys the ECR repository, builds the Docker image, pushes it, and then deploys the rest of the application.

Run the following script:
```bash
chmod +x scripts/first_deploy.sh
./scripts/first_deploy.sh
```

**What this script does:**
1. Bootstraps the AWS CDK environment in your account.
2. Deploys the `InsuranceInsightEcrStack` to create the ECR repository.
3. Builds the FastAPI backend into a Docker image and pushes it to ECR.
4. Deploys the `InsuranceInsightAppStack` (ECS Fargate, ALB, DynamoDB, Secrets Manager, S3, CloudFront).
5. Builds the React frontend and syncs it to the newly created S3 bucket.
6. Invalidates the CloudFront cache.

## 2. Secrets Configuration
After the first deployment, you must set the Sarvam API key in AWS Secrets Manager:
1. Go to AWS Secrets Manager in the AWS Console.
2. Find the secret named `insurance-nexus/sarvam-api-key`.
3. Set its value to your actual API key (in plaintext, no JSON formatting required).

## 3. Subsequent Deployments
For ongoing deployments, you can simply push to the `main` branch to trigger the GitHub Actions CI/CD pipeline, or run the standard deploy script locally:
```bash
./scripts/deploy.sh
```

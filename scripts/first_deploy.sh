#!/usr/bin/env bash
set -e

echo "🚀 Starting First Deploy (Idempotent)..."

export AWS_REGION=${AWS_REGION:-ap-south-1}
export ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo "1. Deploying ECR Repository..."
cd infra
npm install -g aws-cdk
pip3 install -r requirements.txt --break-system-packages
pip3 install -r requirements-dev.txt --break-system-packages 2>/dev/null || true
cdk bootstrap aws://$ACCOUNT_ID/$AWS_REGION
cdk deploy InsuranceInsightEcrStack --require-approval never

echo "2. Building and Pushing Docker Image..."
cd ../backend
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
docker build -t insurance-insight-nexus-backend .
docker tag insurance-insight-nexus-backend:latest $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/insurance-insight-nexus-backend:latest
docker push $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/insurance-insight-nexus-backend:latest

echo "3. Deploying Application Stack..."
cd ../infra
cdk deploy InsuranceInsightAppStack --require-approval never -c imageTag=latest

echo "4. Forcing ECS Deployment..."
CLUSTER_NAME=$(aws cloudformation describe-stacks --stack-name InsuranceInsightAppStack --query 'Stacks[0].Outputs[?OutputKey==`EcsClusterName`].OutputValue' --output text)
SERVICE_NAME=$(aws cloudformation describe-stacks --stack-name InsuranceInsightAppStack --query 'Stacks[0].Outputs[?OutputKey==`EcsServiceName`].OutputValue' --output text)

aws ecs update-service --cluster $CLUSTER_NAME --service $SERVICE_NAME --force-new-deployment
echo "Waiting for ECS service to become stable (this may take a few minutes)..."
aws ecs wait services-stable --cluster $CLUSTER_NAME --services $SERVICE_NAME

echo "5. Deploying Frontend to S3..."
cd ../frontend
npm install
npm run build
S3_BUCKET=$(aws cloudformation describe-stacks --stack-name InsuranceInsightAppStack --query 'Stacks[0].Outputs[?OutputKey==`S3BucketName`].OutputValue' --output text)
aws s3 sync dist/ s3://$S3_BUCKET --delete

# Invalidate CloudFront
CF_DIST_ID=$(aws cloudformation describe-stacks --stack-name InsuranceInsightAppStack --query 'Stacks[0].Outputs[?OutputKey==`DistributionId`].OutputValue' --output text || true)
if [ ! -z "$CF_DIST_ID" ] && [ "$CF_DIST_ID" != "None" ]; then
    aws cloudfront create-invalidation --distribution-id $CF_DIST_ID --paths "/*"
fi

CF_DOMAIN=$(aws cloudformation describe-stacks --stack-name InsuranceInsightAppStack --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' --output text)

echo "6. Running Smoke Tests..."
echo "Testing $CF_DOMAIN/api/health..."
curl -s -f "$CF_DOMAIN/api/health" | grep "ok" || (echo "API Health Check Failed!" && exit 1)
echo "Testing $CF_DOMAIN/..."
curl -s -f "$CF_DOMAIN/" | grep "<title>" || (echo "Frontend Load Failed!" && exit 1)

echo "✅ First Deploy Complete! App is live at $CF_DOMAIN"

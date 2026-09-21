# CI/CD Pipeline

Insurance Insight Nexus uses GitHub Actions for continuous integration and continuous deployment.

## Workflows

### 1. CI Pipeline (`ci.yml`)
Triggers on: `push` and `pull_request` to `main`.
**Jobs:**
- **test-backend:** Runs Ruff linter and Pytest test suite for the FastAPI backend.
- **test-frontend:** Runs ESLint and Vite build to verify the React frontend.
- **security-scan:** Runs Trivy vulnerability scanner to catch high/critical CVEs in the codebase.

### 2. CD Pipeline (`deploy.yml`)
Triggers on: `push` to `main`.
**Process:**
1. Assumes the AWS IAM role via OIDC (or falls back to AWS access keys if configured).
2. Sets up Node.js, Python, and the AWS CDK CLI.
3. Executes `./scripts/deploy.sh` which:
   - Builds and pushes the Docker image to ECR.
   - Deploys the CDK infrastructure.
   - Builds the frontend and syncs to S3.
   - Invalidates CloudFront cache.

## Setup Requirements for GitHub Actions
To enable the CD pipeline, configure the following repository secret in GitHub:
- `AWS_ROLE_ARN`: The ARN of the IAM role configured with an OIDC identity provider for GitHub Actions (this role must have permissions to assume the CDK deploy roles).

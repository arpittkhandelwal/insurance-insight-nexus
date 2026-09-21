#!/usr/bin/env bash
set -e

echo "📦 Packaging Insurance Insight Nexus for Submission..."

# Output filename
OUTPUT_FILE="insurance_insight_nexus_submission.zip"

# Clean up previous build/cache directories to reduce size
echo "Cleaning up..."
rm -rf frontend/node_modules frontend/dist
rm -rf backend/venv backend/.pytest_cache backend/__pycache__ backend/app/__pycache__ backend/app/core/__pycache__ backend/app/services/__pycache__ backend/app/routers/__pycache__ backend/tests/__pycache__
rm -rf infra/cdk.out infra/node_modules infra/.venv

# Zip the project, excluding git history and IDE files
echo "Creating zip archive..."
cd ..
zip -r insurance-insight-nexus/$OUTPUT_FILE insurance-insight-nexus \
    -x "*/\.git/*" \
    -x "*/\.gemini/*" \
    -x "*/\.vscode/*" \
    -x "*/\.idea/*" \
    -x "*/\.DS_Store" \
    -x "insurance-insight-nexus/$OUTPUT_FILE"

cd insurance-insight-nexus
echo "✅ Submission packaged successfully into $OUTPUT_FILE"

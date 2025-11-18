#!/bin/bash

# Stonepot Restaurant - Google Cloud Secrets Setup
# Creates necessary secrets in Google Cloud Secret Manager

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔐 Stonepot Restaurant - Secrets Setup"
echo "======================================"
echo ""

# Configuration
PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-$(gcloud config get-value project)}"
CREDENTIALS_PATH="../../../credentials/google-cloud-vertex-ai.json"

if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}❌ GOOGLE_CLOUD_PROJECT not set${NC}"
    exit 1
fi

echo "Project ID: $PROJECT_ID"
echo ""

# Enable Secret Manager API
echo -e "${YELLOW}🔧 Enabling Secret Manager API...${NC}"
gcloud services enable secretmanager.googleapis.com --project="$PROJECT_ID"

# Create vertex-ai-credentials secret
echo -e "${YELLOW}📝 Creating vertex-ai-credentials secret...${NC}"
if [ -f "$CREDENTIALS_PATH" ]; then
    if gcloud secrets describe vertex-ai-credentials --project="$PROJECT_ID" &>/dev/null; then
        echo "Secret already exists, creating new version..."
        gcloud secrets versions add vertex-ai-credentials \
            --data-file="$CREDENTIALS_PATH" \
            --project="$PROJECT_ID"
    else
        gcloud secrets create vertex-ai-credentials \
            --data-file="$CREDENTIALS_PATH" \
            --replication-policy="automatic" \
            --project="$PROJECT_ID"
    fi
    echo -e "${GREEN}✅ vertex-ai-credentials secret created${NC}"
else
    echo -e "${RED}❌ Credentials file not found: $CREDENTIALS_PATH${NC}"
    echo "Please ensure the file exists before running this script."
    exit 1
fi

# Create cloudflare-auth-token secret
echo -e "${YELLOW}📝 Creating cloudflare-auth-token secret...${NC}"
echo "Please enter the Cloudflare auth token (or press Enter to skip):"
read -s CLOUDFLARE_TOKEN

if [ -n "$CLOUDFLARE_TOKEN" ]; then
    if gcloud secrets describe cloudflare-auth-token --project="$PROJECT_ID" &>/dev/null; then
        echo "Secret already exists, creating new version..."
        echo -n "$CLOUDFLARE_TOKEN" | gcloud secrets versions add cloudflare-auth-token \
            --data-file=- \
            --project="$PROJECT_ID"
    else
        echo -n "$CLOUDFLARE_TOKEN" | gcloud secrets create cloudflare-auth-token \
            --data-file=- \
            --replication-policy="automatic" \
            --project="$PROJECT_ID"
    fi
    echo -e "${GREEN}✅ cloudflare-auth-token secret created${NC}"
else
    echo -e "${YELLOW}⚠️  Skipped cloudflare-auth-token (optional)${NC}"
fi

# Grant Cloud Run service account access to secrets
echo ""
echo -e "${YELLOW}🔑 Granting Cloud Run access to secrets...${NC}"

# Get Cloud Run service account
SERVICE_ACCOUNT="${PROJECT_ID}@${PROJECT_ID}.iam.gserviceaccount.com"

# Try default compute service account if custom one doesn't exist
COMPUTE_SERVICE_ACCOUNT="${PROJECT_ID}-compute@developer.gserviceaccount.com"

echo "Service Account: $COMPUTE_SERVICE_ACCOUNT"

# Grant access to secrets
gcloud secrets add-iam-policy-binding vertex-ai-credentials \
    --member="serviceAccount:$COMPUTE_SERVICE_ACCOUNT" \
    --role="roles/secretmanager.secretAccessor" \
    --project="$PROJECT_ID" || true

gcloud secrets add-iam-policy-binding cloudflare-auth-token \
    --member="serviceAccount:$COMPUTE_SERVICE_ACCOUNT" \
    --role="roles/secretmanager.secretAccessor" \
    --project="$PROJECT_ID" 2>/dev/null || true

echo ""
echo -e "${GREEN}✅ Secrets setup complete!${NC}"
echo ""
echo "Created secrets:"
echo "   - vertex-ai-credentials"
echo "   - cloudflare-auth-token (if provided)"
echo ""
echo "Next step: Run ./deploy.sh to deploy to Cloud Run"
echo ""

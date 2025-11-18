#!/bin/bash

# Stonepot Restaurant - Cloud Run Deployment Script
# Deploys the restaurant ordering service to Google Cloud Run

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🍽️  Stonepot Restaurant - Cloud Run Deployment"
echo "=============================================="
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI not found. Please install: https://cloud.google.com/sdk/docs/install${NC}"
    exit 1
fi

# Configuration
PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-$(gcloud config get-value project)}"
SERVICE_NAME="${SERVICE_NAME:-stonepot-restaurant}"
REGION="${REGION:-us-central1}"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

# Validate required environment variables
if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}❌ GOOGLE_CLOUD_PROJECT not set${NC}"
    echo "Set it with: export GOOGLE_CLOUD_PROJECT=your-project-id"
    exit 1
fi

echo -e "${YELLOW}📋 Deployment Configuration:${NC}"
echo "   Project ID: $PROJECT_ID"
echo "   Service: $SERVICE_NAME"
echo "   Region: $REGION"
echo "   Image: $IMAGE_NAME"
echo ""

# Confirm deployment
read -p "Continue with deployment? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 0
fi

# Build and push Docker image
echo -e "${YELLOW}🏗️  Building Docker image...${NC}"
gcloud builds submit --tag "$IMAGE_NAME" \
    --timeout=10m \
    --project="$PROJECT_ID"

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Docker build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker image built successfully${NC}"
echo ""

# Deploy to Cloud Run
echo -e "${YELLOW}🚀 Deploying to Cloud Run...${NC}"
echo "Using Application Default Credentials (ADC) via IAM roles"

gcloud run deploy "$SERVICE_NAME" \
    --image="$IMAGE_NAME" \
    --platform=managed \
    --region="$REGION" \
    --project="$PROJECT_ID" \
    --allow-unauthenticated \
    --port=8080 \
    --memory=1Gi \
    --cpu=1 \
    --timeout=300 \
    --concurrency=80 \
    --min-instances=0 \
    --max-instances=10 \
    --set-env-vars="NODE_ENV=production,ENVIRONMENT=production,CLOUDFLARE_WORKER_URL=https://theme-edge-worker.suyesh.workers.dev,ALLOWED_ORIGINS=https://stonepot-restaurant-client.suyesh.workers.dev https://*.thestonepot.pro"

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Cloud Run deployment failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Deployment successful!${NC}"
echo ""

# Get service URL
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
    --platform=managed \
    --region="$REGION" \
    --project="$PROJECT_ID" \
    --format='value(status.url)')

echo -e "${GREEN}🎉 Service deployed successfully!${NC}"
echo ""
echo "   📍 Service URL: $SERVICE_URL"
echo "   🏥 Health Check: $SERVICE_URL/health"
echo ""
echo "Next steps:"
echo "   1. Test the health endpoint:"
echo "      curl $SERVICE_URL/health"
echo ""
echo "   2. Create a session:"
echo "      curl -X POST $SERVICE_URL/api/restaurant/sessions \\"
echo "        -H 'Content-Type: application/json' \\"
echo "        -d '{\"tenantId\":\"test-restaurant\",\"language\":\"en\"}'"
echo ""
echo "   3. Monitor logs:"
echo "      gcloud run logs tail $SERVICE_NAME --region=$REGION"
echo ""

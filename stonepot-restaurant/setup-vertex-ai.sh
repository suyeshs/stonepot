#!/bin/bash

# Setup Vertex AI for Stonepot Restaurant
# Run this script to enable Vertex AI and grant necessary permissions

set -e

PROJECT_ID="sahamati-labs"
REGION="us-central1"

echo "🔧 Setting up Vertex AI for Stonepot Restaurant"
echo "=========================================="

# Set project
echo "📋 Setting project to ${PROJECT_ID}..."
gcloud config set project ${PROJECT_ID}

# Enable required APIs
echo "🔌 Enabling required APIs..."
gcloud services enable aiplatform.googleapis.com \
  compute.googleapis.com \
  run.googleapis.com \
  logging.googleapis.com \
  monitoring.googleapis.com

# Get project number
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

echo "👤 Cloud Run service account: ${SERVICE_ACCOUNT}"

# Grant Vertex AI permissions
echo "🔐 Granting Vertex AI permissions..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/aiplatform.user" \
  --condition=None

echo "✅ Vertex AI setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Deploy the application: ./deploy.sh"
echo "2. Test the endpoint: https://stonepot-restaurant-${PROJECT_NUMBER}.${REGION}.run.app"
echo ""
echo "🧪 To test Vertex AI access:"
echo "curl -H \"Authorization: Bearer \$(gcloud auth print-access-token)\" \\"
echo "  \"https://${REGION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${REGION}/publishers/google/models/gemini-2.0-flash-exp\""
echo ""

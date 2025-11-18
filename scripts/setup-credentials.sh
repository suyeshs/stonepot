#!/bin/bash

# Stonepot Credentials Setup Script
# This script helps you set up credentials for all Stonepot projects

set -e

CREDENTIALS_DIR="./credentials"
CONFIG_DIR="./config"

echo "🔐 Stonepot Credentials Setup"
echo "=============================="
echo ""

# Check if credentials directory exists
if [ ! -d "$CREDENTIALS_DIR" ]; then
    echo "❌ Credentials directory not found!"
    echo "   Run this script from the root of the stonepot repository"
    exit 1
fi

echo "📁 Credentials directory: $CREDENTIALS_DIR"
echo ""

# Function to check if file exists
check_file() {
    if [ -f "$1" ]; then
        echo "✅ $2"
        return 0
    else
        echo "❌ $2 (missing)"
        return 1
    fi
}

# Check credentials
echo "Checking credentials..."
echo "----------------------"

ALL_PRESENT=true

if ! check_file "$CREDENTIALS_DIR/firebase-admin-sdk.json" "Firebase Admin SDK"; then
    ALL_PRESENT=false
fi

if ! check_file "$CREDENTIALS_DIR/google-cloud-vertex-ai.json" "Vertex AI credentials"; then
    ALL_PRESENT=false
fi

if ! check_file "$CREDENTIALS_DIR/cloudflare-api-token.txt" "Cloudflare API token (optional)"; then
    echo "   ⚠️  Optional - only needed for Cloudflare deployments"
fi

echo ""

# If not all present, show instructions
if [ "$ALL_PRESENT" = false ]; then
    echo "❌ Some required credentials are missing!"
    echo ""
    echo "Please follow these steps:"
    echo ""
    echo "1. Firebase Admin SDK:"
    echo "   - Go to https://console.firebase.google.com/"
    echo "   - Select your project"
    echo "   - Go to Project Settings → Service Accounts"
    echo "   - Click 'Generate New Private Key'"
    echo "   - Save as: $CREDENTIALS_DIR/firebase-admin-sdk.json"
    echo ""
    echo "2. Vertex AI credentials:"
    echo "   - Go to https://console.cloud.google.com/"
    echo "   - Navigate to IAM & Admin → Service Accounts"
    echo "   - Create service account with 'Vertex AI User' role"
    echo "   - Create JSON key"
    echo "   - Save as: $CREDENTIALS_DIR/google-cloud-vertex-ai.json"
    echo ""
    echo "3. Cloudflare API token (optional):"
    echo "   - Go to https://dash.cloudflare.com/"
    echo "   - My Profile → API Tokens"
    echo "   - Create token with Workers permissions"
    echo "   - Save as: $CREDENTIALS_DIR/cloudflare-api-token.txt"
    echo ""
    echo "See $CREDENTIALS_DIR/README.md for detailed instructions"
    echo ""
    exit 1
fi

# Set file permissions
echo "Setting file permissions..."
chmod 600 "$CREDENTIALS_DIR"/*.json 2>/dev/null || true
chmod 600 "$CREDENTIALS_DIR"/*.txt 2>/dev/null || true
echo "✅ Permissions set"
echo ""

# Check environment files
echo "Checking environment files..."
echo "----------------------------"

check_env_file() {
    local project=$1
    local env_file="$project/.env"
    local example_file="$project/.env.example"

    if [ -f "$env_file" ]; then
        echo "✅ $project/.env exists"
    else
        if [ -f "$example_file" ]; then
            echo "⚠️  $project/.env missing (example available)"
            echo "   Run: cp $example_file $env_file"
        else
            echo "❌ $project/.env missing (no example)"
        fi
    fi
}

check_env_file "stonepot-financial"
check_env_file "stonepot-restaurant"
check_env_file "stonepot-restaurant-client"

echo ""

# Verify credentials can be loaded
echo "Verifying credentials..."
echo "------------------------"

if command -v node &> /dev/null; then
    node -e "
    import('$CONFIG_DIR/shared.js').then(config => {
        const required = ['firebase', 'vertexai'];
        const isValid = config.validateCredentials(required);
        process.exit(isValid ? 0 : 1);
    }).catch(err => {
        console.error('Error loading config:', err.message);
        process.exit(1);
    });
    " && echo "✅ Credentials validated successfully" || echo "⚠️  Credential validation failed"
else
    echo "⚠️  Node.js not found, skipping validation"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Copy and configure environment files for each project"
echo "2. Run 'npm run install:all' to install dependencies"
echo "3. Start developing!"
echo ""

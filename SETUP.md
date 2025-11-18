# Stonepot Setup Guide

Complete guide to setting up the Stonepot development environment.

## Prerequisites

- **Bun**: >= 1.0.0 ([Install Bun](https://bun.sh/))
- **Node.js**: >= 18.0.0
- **npm**: >= 9.0.0
- **Google Cloud account** with billing enabled
- **Firebase project**
- **Cloudflare account** (for restaurant service)

## Quick Start

```bash
# 1. Clone repository
git clone <repository-url>
cd stonepot

# 2. Set up credentials (interactive)
./scripts/setup-credentials.sh

# 3. Install all dependencies
npm run install:all

# 4. Configure environment variables
cp config/shared.env.example .env

# 5. Start services (see individual project READMEs)
```

## Detailed Setup

### 1. Credentials Setup

Stonepot uses a centralized credentials directory at `/credentials/`.

#### A. Firebase Admin SDK

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Project Settings** → **Service Accounts**
4. Click **"Generate New Private Key"**
5. Save the JSON file as:
   ```
   credentials/firebase-admin-sdk.json
   ```

#### B. Google Cloud / Vertex AI

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **IAM & Admin** → **Service Accounts**
3. Create a new service account with these roles:
   - **Vertex AI User**
   - **Vertex AI Service Agent**
4. Create a JSON key for the service account
5. Save the JSON file as:
   ```
   credentials/google-cloud-vertex-ai.json
   ```

#### C. Cloudflare API Token (Optional)

Only needed for deploying the restaurant display service.

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **My Profile** → **API Tokens**
3. Create a token with these permissions:
   - Account: **Workers Scripts** (Edit)
   - Account: **Workers KV Storage** (Edit)
   - Account: **D1** (Edit)
   - Account: **R2 Storage** (Edit)
4. Save the token in:
   ```
   credentials/cloudflare-api-token.txt
   ```

#### Verify Credentials

Run the setup script to verify all credentials are in place:

```bash
./scripts/setup-credentials.sh
```

### 2. Environment Configuration

#### Shared Configuration

Copy the shared environment template:

```bash
cp config/shared.env.example .env
```

Edit `.env` with your project details:

```bash
# Google Cloud
GOOGLE_CLOUD_PROJECT=your-project-id
FIREBASE_PROJECT_ID=your-project-id
VERTEX_PROJECT_ID=your-project-id
VERTEX_LOCATION=us-central1

# Cloudflare
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_WORKER_URL=https://your-worker.workers.dev
```

#### Project-Specific Configuration

Each project has its own `.env.example`. Copy and configure:

**Financial Service:**
```bash
cd stonepot-financial
cp .env.example .env
# Edit .env with project-specific settings
```

**Restaurant Service:**
```bash
cd stonepot-restaurant
cp .env.example .env
# Edit .env with project-specific settings
```

**Restaurant Client:**
```bash
cd stonepot-restaurant-client
cp .env.example .env.local
# Edit .env.local with worker URL
```

### 3. Install Dependencies

Install dependencies for all projects:

```bash
npm run install:all
```

Or install individually:

```bash
# Financial service
cd stonepot-financial && bun install

# Restaurant service
cd stonepot-restaurant && bun install

# Restaurant display (Cloudflare)
cd stonepot-restaurant-display && npm install

# Restaurant client (Frontend)
cd stonepot-restaurant-client && npm install
```

### 4. Google Cloud Setup

#### Enable Required APIs

```bash
gcloud services enable \
  aiplatform.googleapis.com \
  firestore.googleapis.com \
  cloudrun.googleapis.com
```

#### Set Default Project

```bash
gcloud config set project YOUR_PROJECT_ID
```

#### Authenticate

```bash
gcloud auth login
gcloud auth application-default login
```

### 5. Firebase Setup

1. Create a Firestore database:
   - Go to Firebase Console → Firestore Database
   - Create database in **production mode**
   - Choose location: **us-central1** (or your preferred region)

2. Set up security rules (optional for development):
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if true;  // DEVELOPMENT ONLY!
       }
     }
   }
   ```

3. Enable required authentication methods:
   - Go to Authentication → Sign-in method
   - Enable methods as needed

### 6. Cloudflare Setup (Restaurant Service Only)

#### Create Resources

```bash
cd stonepot-restaurant-display

# Create D1 database
npx wrangler d1 create restaurant-sessions

# Create R2 bucket
npx wrangler r2 bucket create restaurant-menu-images

# Create KV namespace
npx wrangler kv:namespace create TENANT_CONFIG
```

#### Update wrangler.toml

Copy the IDs from the command outputs and update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "restaurant-sessions"
database_id = "YOUR_D1_ID_HERE"

[[r2_buckets]]
binding = "IMAGES"
bucket_name = "restaurant-menu-images"

[[kv_namespaces]]
binding = "TENANT_CONFIG"
id = "YOUR_KV_ID_HERE"
```

#### Set Secrets

```bash
npx wrangler secret put AUTH_SECRET
# Enter a secure random token when prompted
```

## Running Services

### Development Mode

**Financial Service:**
```bash
npm run dev:financial
# Runs on http://localhost:3000
```

**Restaurant Service (all components):**

Terminal 1 - Backend:
```bash
npm run dev:restaurant
# Runs on http://localhost:3001
```

Terminal 2 - Display WebSocket:
```bash
npm run dev:display
# Runs on http://localhost:8787
```

Terminal 3 - Frontend:
```bash
npm run dev:client
# Runs on http://localhost:3000
```

### Production Deployment

See individual project READMEs:
- [Financial Service Deployment](./stonepot-financial/README.md)
- [Restaurant Service Deployment](./stonepot-restaurant/README.md)

## Troubleshooting

### Credentials Not Found

If you see warnings about missing credentials:

1. Check files exist in `/credentials/`:
   ```bash
   ls -la credentials/
   ```

2. Verify file permissions:
   ```bash
   chmod 600 credentials/*.json
   chmod 600 credentials/*.txt
   ```

3. Run the setup script:
   ```bash
   ./scripts/setup-credentials.sh
   ```

### Import Errors

If you see `Cannot find module '@/../config/shared.js'`:

1. Make sure you're running from the correct directory
2. Check the import path is relative to the project root
3. Verify Node.js version >= 18

### Vertex AI Errors

If Vertex AI connections fail:

1. Verify credentials:
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS=credentials/google-cloud-vertex-ai.json
   gcloud auth application-default print-access-token
   ```

2. Check API is enabled:
   ```bash
   gcloud services list --enabled | grep aiplatform
   ```

3. Verify project ID matches across configs

### Cloudflare Errors

If Durable Objects fail:

1. Verify you're on a Workers Paid plan
2. Check wrangler.toml configuration
3. Ensure secrets are set:
   ```bash
   npx wrangler secret list
   ```

## Directory Structure

```
stonepot/
├── credentials/           # Shared credentials (git-ignored)
│   ├── firebase-admin-sdk.json
│   ├── google-cloud-vertex-ai.json
│   └── cloudflare-api-token.txt
├── config/               # Shared configuration
│   ├── shared.js
│   └── shared.env.example
├── scripts/              # Setup and utility scripts
│   └── setup-credentials.sh
├── stonepot-financial/   # Financial service
├── stonepot-restaurant/  # Restaurant backend
├── stonepot-restaurant-display/  # Cloudflare DO
└── stonepot-restaurant-client/   # Frontend
```

## Security Best Practices

1. **Never commit credentials** to version control
2. **Rotate credentials regularly** (every 90 days)
3. **Use different credentials** for development and production
4. **Set appropriate file permissions** (600 for credential files)
5. **Use service accounts** with minimal required permissions
6. **Enable audit logging** in Google Cloud
7. **Review Firestore security rules** before production

## Next Steps

1. ✅ Complete setup above
2. 📖 Read individual project READMEs
3. 🔧 Configure environment variables
4. 🚀 Start development servers
5. 📝 Review architecture documentation

## Getting Help

- Check project-specific README files
- Review `/credentials/README.md` for credential setup
- See architecture docs in `/docs/`
- Contact the development team

## Resources

- [Firebase Console](https://console.firebase.google.com/)
- [Google Cloud Console](https://console.cloud.google.com/)
- [Cloudflare Dashboard](https://dash.cloudflare.com/)
- [Vertex AI Documentation](https://cloud.google.com/vertex-ai/docs)
- [Durable Objects Documentation](https://developers.cloudflare.com/durable-objects/)

# Stonepot Restaurant Client - Deployment Guide

## Overview

The Stonepot Restaurant Client is a Next.js application deployed to **Cloudflare Pages** using the OpenNext Cloudflare adapter.

## Deployment Information

- **Platform**: Cloudflare Pages
- **Project Name**: stonepot-restaurant-client
- **Production URL**: https://stonepot-restaurant-client.pages.dev
- **Preview URL**: https://cfffba53.stonepot-restaurant-client.pages.dev
- **Account ID**: 0f3287b287060e3215662501ee96292e

## Architecture

The application uses:
- **Next.js 14.2.x** - React framework
- **@opennextjs/cloudflare** - Adapter for running Next.js on Cloudflare Workers
- **Cloudflare Pages** - Hosting and edge deployment
- **Tailwind CSS** - Styling

## Build Process

### Prerequisites

```bash
# Ensure you have Node.js and npm installed
node -v  # Should be >= 18.x
npm -v   # Should be >= 9.x
```

### Local Development

```bash
# Install dependencies
bun install

# Run development server
npm run dev

# App will be available at http://localhost:3000
```

### Building for Cloudflare

```bash
# Build the Next.js app and convert it for Cloudflare
npm run pages:build

# This will:
# 1. Run next build
# 2. Use @opennextjs/cloudflare to convert the output
# 3. Generate .open-next directory with Cloudflare Worker
```

### Local Preview

```bash
# Preview the built app locally with Wrangler
npm run pages:dev

# App will be available at http://localhost:8788
```

## Deployment

### Manual Deployment

```bash
# Set your Cloudflare account ID
export CLOUDFLARE_ACCOUNT_ID=0f3287b287060e3215662501ee96292e

# Build and deploy
npm run pages:build
npx wrangler pages deploy .open-next --project-name=stonepot-restaurant-client --commit-dirty=true --branch=main
```

### Quick Deploy Script

```bash
# Single command deployment
npm run pages:deploy
```

## Environment Variables

The application uses the following environment variables:

### Production
- `NEXT_PUBLIC_WORKER_URL`: https://theme-edge-worker.suyesh.workers.dev
- `NEXT_PUBLIC_API_URL`: https://stonepot-restaurant-api.run.app

### Preview
- Same as production (can be customized in wrangler.toml)

## Configuration Files

### wrangler.toml
Main Cloudflare Pages configuration:
- Project name
- Compatibility settings
- Environment variables
- Build output directory

### open-next.config.ts
OpenNext Cloudflare adapter configuration:
- Wrapper: cloudflare-node
- Converter: edge
- Cache settings
- Middleware settings

### next.config.mjs
Next.js configuration:
- Output mode: standalone
- Environment variables
- React strict mode

## CI/CD Setup

To set up automated deployments via GitHub Actions or Cloudflare's Git integration:

### Option 1: Cloudflare Git Integration (Recommended)

1. Go to Cloudflare Dashboard → Pages
2. Connect your GitHub repository
3. Configure build settings:
   - **Build command**: `npm run pages:build`
   - **Build output directory**: `.open-next`
   - **Root directory**: `stonepot-restaurant-client`

### Option 2: GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloudflare Pages

on:
  push:
    branches:
      - main
    paths:
      - 'stonepot-restaurant-client/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        working-directory: ./stonepot-restaurant-client
        run: npm install

      - name: Build
        working-directory: ./stonepot-restaurant-client
        run: npm run pages:build

      - name: Deploy to Cloudflare Pages
        working-directory: ./stonepot-restaurant-client
        run: npx wrangler pages deploy .open-next --project-name=stonepot-restaurant-client
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

## Troubleshooting

### Build Fails

```bash
# Clear build cache
rm -rf .next .open-next node_modules
bun install
npm run pages:build
```

### Deployment Fails

```bash
# Check wrangler authentication
npx wrangler whoami

# Login if needed
npx wrangler login

# Verify project exists
npx wrangler pages project list
```

### Environment Variables Not Working

Make sure variables are properly set in both:
1. `wrangler.toml` (for local/preview)
2. Cloudflare Dashboard → Pages → Settings → Environment Variables (for production)

## Performance

- **Edge Deployment**: Served from Cloudflare's global edge network
- **Cold Start**: ~50-200ms (Cloudflare Workers)
- **Build Time**: ~30-60 seconds
- **Deploy Time**: ~5-10 seconds

## Monitoring

- **Analytics**: Available in Cloudflare Dashboard → Pages → Analytics
- **Logs**: Use `npx wrangler pages deployment tail` for real-time logs
- **Errors**: Check Cloudflare Dashboard → Pages → Deployments → Logs

## Rollback

To rollback to a previous deployment:

1. Go to Cloudflare Dashboard → Pages → stonepot-restaurant-client
2. Click on "View build" for the deployment you want to rollback to
3. Click "Rollback to this deployment"

Or via CLI:
```bash
npx wrangler pages deployment list --project-name=stonepot-restaurant-client
npx wrangler pages deployment tail <deployment-id>
```

## Custom Domain Setup

To use a custom domain (e.g., app.thestonepot.pro):

1. Go to Cloudflare Dashboard → Pages → stonepot-restaurant-client → Custom domains
2. Click "Set up a custom domain"
3. Enter your domain (e.g., `app.thestonepot.pro`)
4. Follow DNS configuration instructions
5. Wait for SSL certificate provisioning (~5-10 minutes)

## Cost

Cloudflare Pages Free Tier includes:
- Unlimited requests
- 500 builds per month
- 100GB bandwidth per month
- Concurrent builds: 1

For higher limits, upgrade to Pages Pro ($20/month).

## Support

- **Documentation**: https://developers.cloudflare.com/pages/
- **OpenNext Cloudflare**: https://opennext.js.org/cloudflare
- **Issues**: File issues in the main Stonepot repository

---

**Last Updated**: November 14, 2025
**Version**: 1.0.0
**Status**: Production

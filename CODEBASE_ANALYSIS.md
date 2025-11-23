# Codebase Analysis — Stonepot

This document captures a compact, persistent summary of the repository to be used as context for future work and onboarding.

## High-level overview
- Monorepo housing multiple services focused on voice-enabled AI: financial advisory and restaurant ordering/display.
- Primary runtimes: Bun for backend services, Node (Next.js) for frontend, Cloudflare Workers/Durable Objects for real-time display.
- Voice/AI integration: Google Vertex AI (Live / Gemini) and Google Cloud Speech / Text-to-Speech in some services.
- Persistence: Firestore (session persistence is referenced in README and used by multiple services).

## Top-level projects
- `stonepot-financial` — Bun server (voice-first financial agent). Entry: `server.js`. Uses Vertex AI, Google Speech/TTS, Firebase Admin.
- `stonepot-restaurant` — Bun server for restaurant ordering and Vertex AI integration. Main: `src/index.js` (see `package.json`).
- `stonepot-restaurant-display` — Cloudflare Worker + Durable Objects (WebSocket display). Contains `wrangler.toml` and deployment scripts.
- `stonepot-restaurant-client` — Next.js 14 frontend (TypeScript + Tailwind). Development and Cloudflare/Vercel targets present.

## Key files and locations
- Repo root: `package.json` (workspaces), `README.md`, `SETUP.md`, `credentials/` (sensitive keys). 
- Credentials README: `credentials/README.md` — lists expected files: `firebase-admin-sdk.json`, `google-cloud-vertex-ai.json`, `cloudflare-api-token.txt`.
- Workspaces: listed in root `package.json` and have their own `package.json` files (see `stonepot-financial`, `stonepot-restaurant`, `stonepot-restaurant-client`, `stonepot-restaurant-display`).
- Deploy helpers: `deploy.sh` files and `cloudbuild.yaml` exist under some services (e.g., `stonepot-financial`, `stonepot-restaurant`).

## Runtime & dependencies
- Primary runtime: Bun (>=1.0) for backend projects; Node >=18 for frontend and some scripts.
- Backends depend on `@google-cloud/vertexai`, `firebase-admin`, `google-auth-library`, `ws`, and other multimedia/voice libs (`@google-cloud/speech`, `@google-cloud/text-to-speech`, `prism-media`).
- Frontend uses `next@14`, React 18, Tailwind, and Cloudflare/OpenNext tooling.

## Integration & infra points
- Vertex AI: referenced in project docs and appears in backend `package.json` dependencies. Service account JSON expected at `credentials/google-cloud-vertex-ai.json`.
- Firestore / Firebase Admin: used for session persistence; service account expected at `credentials/firebase-admin-sdk.json`.
- Cloudflare: `wrangler` and Cloudflare Workers Durable Objects used for display and WebSocket hibernation. Token expected at `credentials/cloudflare-api-token.txt`.
- ONNX model files: present under `public/` (e.g., `568bf886c02ac597add4.onnx`, `silero_vad.onnx`) — used for local ML/voice processing.

## Entry & run commands (quick)
- Root workspace scripts to start each project in development (see `package.json`):
  - `npm run dev:financial` — runs `stonepot-financial` dev (Bun)
  - `npm run dev:restaurant` — runs `stonepot-restaurant` dev (Bun)
  - `npm run dev:display` — runs `stonepot-restaurant-display` dev (npm)
  - `npm run dev:client` — runs `stonepot-restaurant-client` dev (Next.js)

## Security & credentials notes
- Credentials are centralized in `credentials/` and documented in `credentials/README.md`.
- Ensure `credentials/` files are in `.gitignore` and were never committed — verify repo history for accidental commits.
- Recommended file permissions: `chmod 600 credentials/*` (documented).
- Consider adding a secret scanning GitHub Action (or similar) to detect accidental commits of JSON keys.

## Observations / potential issues
- Mixed runtimes (Bun + Node) increase developer setup complexity — ensure setup docs clearly describe which tools to install and which shell config is required.
- Several sensitive integrations (Vertex AI, Firebase, Cloudflare). Onboarding should include service-account creation steps and minimal IAM roles.
- Public model files (ONNX) in `public/` are fine if intentionally included, but validate licensing and size.

## Suggested next steps / improvements
1. Add an automated secret-scan workflow (GitHub Actions) to block accidental credential commits.
2. Add a `CHECKLIST.md` or extend `SETUP.md` with step-by-step local dev setup for Bun + Node + Cloudflare (including required versions and quick verification commands).
3. Add a `make` or top-level shell script that bootstraps environment (validate credentials exist, run installs in workspaces, and verify simple smoke checks).
4. Verify the `.gitignore` excludes `credentials/` and typical build artifacts (`node_modules`, `.next`, `dist`, etc.).
5. Add a short CI smoke test that runs `bun --version`, `node --version`, and `npm ci` for the frontend to catch dependency regressions.

## Where to look for code related to agents / conversation flows
- README references these locations — confirm in repo before changes:
  - `stonepot-financial/src/agents/` (financial agent code)
  - `stonepot-restaurant/src/agents/` (restaurant agent code)
  - `stonepot-restaurant-display/` (Durable Object and WebSocket code)

## Contact & ownership
- Author/maintainer references exist in `package.json` files (e.g., Suyesh Shankar). Use repository issues or internal team contact for access to credentials and deployment accounts.

---
Generated: automatic snapshot of repository state for context (keep this file up-to-date manually or via a future script).

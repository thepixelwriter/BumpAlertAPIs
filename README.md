# BumpAlert Server

This is the backend API for BumpAlert. It handles user authentication, password reset, Google sign-in, and user-scoped anomaly reports.

## Tech stack

- Node.js
- TypeScript
- Express
- Cloudflare Workers
- Cloudflare D1 with SQLite
- JWT for authentication
- bcrypt for password hashing
- Zod for validation

## Features

- User registration and login
- Password reset flow
- Google sign-in support
- Secure JWT-based auth
- User-scoped road anomaly storage
- Report listing and status updates
- SQLite storage through Cloudflare D1

## Requirements

- Node.js 20+
- npm
- Cloudflare account
- Wrangler

## Setup

1. Open the server folder.
2. Copy the example environment file:

```bash
copy .env.example .env
```

3. Update the values in `.env` for local development.

Example:

```env
PORT=3000
JWT_SECRET=change_this_to_a_secure_secret
JWT_EXPIRES_IN=365d
CORS_ORIGIN=http://localhost:4200
GOOGLE_CLIENT_ID=
```

## Run locally

```bash
npm install
npm run dev
```

Wrangler uses a local D1 database for development.

## Install dependencies

```bash
npm install
```

## Apply the remote D1 schema

```bash
npx wrangler d1 migrations apply bumpalert-db --remote
```

## Configure secrets

```bash
npx wrangler secret put JWT_SECRET
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put RESEND_API_KEY
```

Verify the sender domain in Resend before deploying. The sender address is configured as `noreply@bumpalert.thepixelwriter.com`.

## Deploy the API

```bash
npm run deploy
```

The API is deployed to `https://api.bumpalert.thepixelwriter.com`.

## API overview

Interactive API documentation is available at:

```text
https://api.bumpalert.thepixelwriter.com/api/swagger
```

The raw OpenAPI document is available at:

```text
https://api.bumpalert.thepixelwriter.com/api/swagger.json
```

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/google`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

### Reports

All report routes require a bearer token.

- `POST /api/reports`
- `GET /api/reports`
- `GET /api/reports/nearby`
- `GET /api/reports/:id`
- `PATCH /api/reports/:id/status`

## Security notes

- Passwords are hashed before storage.
- JWT tokens are used for authenticated requests. Sessions last up to 365 days by default and are invalidated when the account password is changed.
- CORS allows the hosted web app during the transition, local development, and the default Capacitor origins (`https://localhost` on Android and `capacitor://localhost` on iOS). Capacitor preflight requests do not consume the stricter authentication rate limit.
- The planned distribution is native-only: Android and iOS apps will call the API, while `bumpalert.thepixelwriter.com` will become a landing page linking to the app stores. Once that replaces the hosted PWA, remove its origin and the local web development origins from the production `CORS_ORIGIN` allowlist; retain only the origins required by native clients.
- User data is isolated by user ID.
- The Worker applies Cloudflare rate limits of 120 requests per minute per client IP overall and 10 per minute for authentication routes.
- API responses are marked `Cache-Control: no-store`; the API custom domain is served through Cloudflare's edge proxy/CDN without caching personalized responses.
- JSON request bodies are limited to 64 KiB, report submissions are capped at 100 hazards, and outbound password-reset email requests time out after 8 seconds.
- Structured request/security events are available through Worker observability and Wrangler tail logs. Workers cannot run host-based Fail2ban; rate-limit bindings provide automated request mitigation.
- Configure Cloudflare zone WAF rules separately in the Cloudflare dashboard: enable the managed ruleset for `api.bumpalert.thepixelwriter.com`, then add a custom rule matching `http.host eq "api.bumpalert.thepixelwriter.com" and not http.request.method in {"GET" "HEAD" "POST" "PATCH" "OPTIONS"}` with the Block action. Zone-level WAF rules are not deployable from this Worker configuration.
- Worker execution and D1 operations are bounded by Cloudflare platform limits; Node HTTP server keep-alive/header timeout settings are not supported in the Workers runtime.

## Notes

This server keeps user-specific anomaly records separate in D1 and runs entirely on Cloudflare Workers.

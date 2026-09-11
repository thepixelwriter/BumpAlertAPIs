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
```

## Deploy the API

```bash
npm run deploy
```

The API is deployed to `https://api.bumpalert.thepixelwriter.com`.

## API overview

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
- JWT tokens are used for authenticated requests.
- CORS is restricted to the frontend origin.
- User data is isolated by user ID.

## Notes

This server keeps user-specific anomaly records separate in D1 and runs entirely on Cloudflare Workers.

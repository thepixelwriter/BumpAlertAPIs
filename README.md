# BumpAlert Server

This is the backend API for BumpAlert. It handles user authentication, password reset, Google sign-in, and user-scoped anomaly reports.

## Tech stack

- Node.js
- TypeScript
- Express
- PostgreSQL
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
- PostgreSQL storage for future relational data needs

## Requirements

- Node.js 20+
- npm
- Docker and Docker Compose
- PostgreSQL

## Setup

1. Open the server folder.
2. Copy the example environment file:

```bash
copy .env.example .env
```

3. Update the values in `.env` for your local environment.

Example:

```env
PORT=3000
DB_URL=postgresql://postgres:postgres@localhost:5432/bumpalert
JWT_SECRET=change_this_to_a_secure_secret
CORS_ORIGIN=http://localhost:4200
GOOGLE_CLIENT_ID=
```

## Start PostgreSQL

```bash
docker compose up -d
```

This starts a local PostgreSQL instance on port 5432.

## Install dependencies

```bash
npm install
```

## Run in development mode

```bash
npm run dev
```

## Build the server

```bash
npm run build
```

## Start the compiled server

```bash
npm start
```

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

This server is designed to keep user-specific anomaly records separate from other app data and to support future relational features in the same PostgreSQL database.

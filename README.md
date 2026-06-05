# launch-ready

LaunchReady scans your GitHub repositories for production-readiness gaps and generates a pull request to fix them.

## Getting started

**1. Clone and install**

```bash
git clone https://github.com/<you>/launch-ready-hub.git
cd launch-ready-hub
npm install
```

**2. Configure environment**

```bash
cp .env.example .env
```

Fill in `.env` with your Supabase URL/keys, GitHub OAuth credentials, and session secret. See `.env.example` for all required variables.

**3. Run in development**

```bash
npm run dev
```

The app starts at `http://localhost:5173` (or the port in `APP_URL`).

## Build

```bash
npm run build
npm start
```

## Test

```bash
npm test
```

## Deployment

Set the environment variables from `.env.example` on your host, then run the build and start commands above. The `APP_URL` env var must match your public domain so GitHub OAuth callbacks resolve correctly.

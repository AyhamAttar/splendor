# Deploying the Splendor frontend on Railway

The frontend is a **Next.js app** (a long-lived Node server via `next start`). It
runs as its **own Railway service**, separate from the backend API and Postgres.
It talks to the backend over HTTPS/WSS using a single build-time variable,
`NEXT_PUBLIC_API_URL`.

> Why a dedicated Dockerfile? The frontend imports `@splendor/engine`
> (`workspace:*`), so it must be built from the repo root with the full pnpm
> workspace — Railway's "set root directory = frontend" alone can't resolve that
> workspace dependency. [`Dockerfile.frontend`](../Dockerfile.frontend) builds
> from the root, exactly like the backend image.

## Prerequisites
- Backend already deployed on Railway and healthy (`/health` returns `{"status":"ok"}`).
- Its public URL, e.g. `https://splendor-production-d537.up.railway.app`.

## 1. Create a second Railway service
1. Open your existing Railway **project** (the one with the backend + Postgres).
2. **+ New → GitHub Repo** → pick this repo. (Deploying the same repo again as a
   second service is expected and correct.)
3. A new service appears. Rename it to something like `frontend` for clarity.

## 2. Point the service at the frontend Dockerfile
Railway would otherwise auto-detect the root `Dockerfile` (the backend). Override it:

1. Frontend service → **Settings → Build**.
2. Set **Builder** = `Dockerfile`.
3. Set **Dockerfile Path** = `Dockerfile.frontend`.
4. Leave **Root Directory** empty / `/` — the build context must be the repo root
   for the workspace to resolve.

## 3. Set the build-time API URL
`NEXT_PUBLIC_API_URL` is inlined at **build time**, so it must be a **build
argument**, not just a runtime variable.

1. Frontend service → **Settings → Build → Build Args** (a.k.a. build-time
   variables).
2. Add:
   ```
   NEXT_PUBLIC_API_URL=https://<your-backend>.up.railway.app
   ```
   Use your real backend URL, no trailing slash.

> If Railway's UI only offers a single "Variables" list, add `NEXT_PUBLIC_API_URL`
> there too — Railway passes service variables as Docker build args when a
> matching `ARG` exists (it does, in `Dockerfile.frontend`). Setting it in both
> Build Args and Variables is harmless.

## 4. Generate a public domain
1. Frontend service → **Settings → Networking → Generate Domain**.
2. You get a URL like `https://splendor-frontend-production.up.railway.app`.
   **This is the website you open in a browser.**

## 5. Allow the frontend origin on the backend (CORS)
On the **backend** service → Variables, set `CORS_ORIGINS` to the frontend domain
from step 4 (comma-separate if you have several), then let it redeploy:
```
CORS_ORIGINS=https://splendor-frontend-production.up.railway.app
```
Without this the browser blocks API/WebSocket calls even though both services are healthy.

## 6. Deploy and verify
1. Deploy the frontend service (Railway builds `Dockerfile.frontend`).
2. Open the frontend domain in a browser — the Splendor UI should load.
3. Open the browser devtools **Network** tab: API calls should hit your backend
   URL and succeed (200/websocket 101), not CORS-error.

## If you change NEXT_PUBLIC_API_URL later
Because it's baked in at build time, you must **rebuild** the frontend service
(a redeploy) for a new value to take effect — editing it at runtime does nothing.

## Note on cookies (auth)
The backend refresh cookie is `SameSite=None; Secure`. That works across
different Railway subdomains (frontend vs backend) as long as both are HTTPS,
which Railway domains always are. No change needed.

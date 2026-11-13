# CloudNest

A file storage and planning app built with React, Express, and JSON-file metadata storage.

## Requirements

- Node.js 24 or later
- npm
- Docker Desktop with Compose (optional)

## Run locally

Open two terminals from the repository root.

```powershell
cd backend
npm ci
Copy-Item .env.example .env
npm run dev
```

```powershell
cd frontend
npm ci
$env:HOST='127.0.0.1'
$env:DANGEROUSLY_DISABLE_HOST_CHECK='true'
$env:REACT_APP_API_URL='http://127.0.0.1:5000/api'
npm start
```

Open <http://127.0.0.1:3000>. The API listens on <http://127.0.0.1:5000> and its health endpoint is `/api/health`.

The backend defaults to loopback only and refuses the development fallback secret when bound to a non-loopback address. Its `.env` supports `PORT`, `HOST`, `JWT_SECRET`, `CORS_ORIGINS`, `PUBLIC_API_URL`, `REGISTRATION_INVITES`, `DATA_FILE`, and `UPLOAD_DIR`. Generate a private JWT secret for your local account data, for example:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Put the result in `backend/.env` as `JWT_SECRET=...`. Never commit `.env` files.
The frontend command above keeps the dev server on loopback. Keep `HOST` at `127.0.0.1`; do not use `0.0.0.0` with the host-check override.

## Deploy to one web server

`docker-compose.production.yml` builds a production React bundle, serves it through Caddy, routes `/api` to Express, and requests HTTPS certificates automatically. It publishes only ports 80 and 443; the API is private on the Compose network. This deployment keeps the current JSON metadata and local upload storage, so run exactly one backend instance and back up `backend/data` and `backend/uploads` together.

1. Point a domain's DNS `A`/`AAAA` record to the server. Allow inbound ports 80 and 443 in its firewall.
2. Copy `.env.example` to `.env`. Set `DOMAIN` to that domain (without a scheme or trailing slash), and replace `JWT_SECRET` with a randomly generated secret. Set `REGISTRATION_INVITES` as comma-separated `email:code` pairs, with a different random code of at least 32 bytes for each approved address. For example, run `openssl rand -hex 32` once per tester, then share each code privately with only that tester. The production registration form asks for a code; each code works only with its assigned email, and invite secrets stay on the backend rather than in the frontend bundle. Leave `REGISTRATION_INVITES` empty to disable signups. Restrict `.env` to the server operator (for example, `chmod 600 .env`) and do not commit it.
3. Ensure the persistent directories exist and are writable by the container's `node` user (UID/GID 1000 by default). On a Linux server with an empty or copied data directory:

   ```sh
   mkdir -p backend/data backend/uploads
   sudo chown -R 1000:1000 backend/data backend/uploads
   ```

   If your server uses a different UID/GID mapping, adjust ownership to match the `node` user in `backend/Dockerfile`. This changes file ownership only; it does not remove data.
4. Validate and start the stack:

   ```sh
   docker compose -f docker-compose.production.yml config > /dev/null
   docker compose -f docker-compose.production.yml up -d --build
   docker compose -f docker-compose.production.yml ps
   ```

   `config` expands environment values, so its output is redirected to avoid printing secrets. Check startup logs with `docker compose -f docker-compose.production.yml logs -f`.
5. Open `https://<your-domain>`. Caddy needs public DNS resolution and access to ports 80/443 to issue and renew certificates.

Run `docker compose -f docker-compose.production.yml down` to stop the app without removing persistent directories or Caddy's named certificate volumes. Do not use `down -v` unless you intend to remove Caddy's stored certificate/configuration data. The production Compose file is a single-server starter, not an automated deployment pipeline.

This setup is suitable for a small, controlled beta on one host. Production registration requires the exact email and its assigned invitation code; an empty `REGISTRATION_INVITES` value disables new accounts. Codes are reusable and do not verify mailbox ownership, so rotate a code immediately if it leaks. Before opening signup broadly or scaling to multiple instances, add login/upload rate limits and operational backups, migrate metadata to a transactional database and uploads to object storage, and revisit the browser's localStorage bearer-token model. Login remains internet-reachable and is not rate-limited, so do not treat this as ready for a broad public launch.

## Persistent data

The default metadata file is `backend/data/drive-store.json`; uploaded file contents are in `backend/uploads/`. Both paths are ignored by Git. JSON writes use a temporary file and rename, and the server stops on malformed or unsupported metadata instead of replacing it with an empty store. Back up both directories together.
Interrupted permanent folder deletion uses a private staging directory under `backend/uploads`; startup restores staged bytes when metadata remains, or removes staged bytes after metadata was committed.

This storage is for one backend process on one server. It is not a multi-instance database and does not provide database transactions, concurrent writers, or remote backups. Keep the development server bound to loopback for personal demos. The single-host production Compose setup provides HTTPS and persistent mounts, but a broad public or scaled deployment needs a database, private object storage, stronger abuse controls, and a reviewed secret configuration.

## Docker development

From the repository root:

```powershell
Copy-Item .env.example .env
# Replace JWT_SECRET with a generated secret before using the app.
docker compose up --build
```

Open <http://127.0.0.1:3000>. Compose binds both ports to `127.0.0.1`, waits for a healthy API, and mounts metadata and uploads from `backend/data` and `backend/uploads`. Stop with `docker compose down`; do not use `docker compose down -v` if you want to keep the dependency cache volumes.

The backend Dockerfile has a non-root `production` target; the frontend Dockerfile has `build` and Caddy-backed `production` targets. The production Compose setup above builds and runs them locally on the server; it does not publish images or deploy to a hosting provider.

## Checks

```powershell
cd backend
npm test
```

```powershell
cd frontend
npm run lint
npm test -- --runInBand --watchAll=false
npm run build
```

## Security notes

- Passwords are hashed with bcrypt. Registration requires a 12-character password; bcrypt's 72-byte limit is enforced.
- API authentication uses bearer headers. The EventSource connection uses a short-lived, single-use ticket instead of putting the JWT in its URL.
- Uploaded files are not served from a public static directory; downloads and previews check user access.
- Do not treat localStorage auth tokens as suitable for a public production deployment.
- See [my-drivev2-threat-model.md](my-drivev2-threat-model.md) for repository-specific trust boundaries and remaining risks.

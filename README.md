# My Drive v2

A local file-drive demo built with React, Express, and JSON-file metadata storage.

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

The backend defaults to loopback only and refuses the development fallback secret when bound to a non-loopback address. Its `.env` supports `PORT`, `HOST`, `JWT_SECRET`, `CORS_ORIGINS`, `DATA_FILE`, and `UPLOAD_DIR`. Generate a private JWT secret for your local account data, for example:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Put the result in `backend/.env` as `JWT_SECRET=...`. Never commit `.env` files.
The frontend command above keeps the dev server on loopback. Keep `HOST` at `127.0.0.1`; do not use `0.0.0.0` with the host-check override.

## Persistent data

The default metadata file is `backend/data/drive-store.json`; uploaded file contents are in `backend/uploads/`. Both paths are ignored by Git. JSON writes use a temporary file and rename, and the server stops on malformed or unsupported metadata instead of replacing it with an empty store. Back up both directories together.
Interrupted permanent folder deletion uses a private staging directory under `backend/uploads`; startup restores staged bytes when metadata remains, or removes staged bytes after metadata was committed.

This storage is for one local server process. It is not a multi-instance database and does not provide database transactions, concurrent writers, or remote backups. Keep the server bound to loopback for personal demos. A public or multi-user deployment needs a database, private object storage, HTTPS, stronger operational controls, and a reviewed secret configuration.

## Docker development

From the repository root:

```powershell
Copy-Item .env.example .env
# Replace JWT_SECRET with a generated secret before using the app.
docker compose up --build
```

Open <http://127.0.0.1:3000>. Compose binds both ports to `127.0.0.1`, waits for a healthy API, and mounts metadata and uploads from `backend/data` and `backend/uploads`. Stop with `docker compose down`; do not use `docker compose down -v` if you want to keep the dependency cache volumes.

The backend Dockerfile also has a `production` target. The frontend Dockerfile has a `build` target for generating the static React bundle. This repository does not publish or deploy either image.

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

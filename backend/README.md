# Backend

Express API for My Drive v2. The backend uses bearer JWT authentication, bcrypt password hashes, private disk uploads, and versioned JSON metadata persistence for local/demo use.

See the repository [README](../README.md) for setup, environment variables, data backup locations, test commands, and Docker Compose.

The metadata store is single-process JSON storage, not a multi-instance database. The server binds to `127.0.0.1` by default and refuses the development fallback secret on non-loopback hosts. In production, `JWT_SECRET` must be set explicitly.

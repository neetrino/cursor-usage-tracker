# SQLite backup and restore

## Where the database file lives

Prisma resolves `DATABASE_URL="file:./dev.db"` **relative to the directory containing `schema.prisma`**.

In this repo, that is typically:

- `apps/web/prisma/dev.db` during local development (when migrating from `apps/web` with the provided `apps/web/.env`)

For production on a VPS, prefer an absolute path on persistent storage, for example:

- `DATABASE_URL="file:/data/cursor-usage.db"`

Do **not** place the production database under:

- `.next/`
- `node_modules/`
- ephemeral container layers without a mounted volume

## WAL files

SQLite WAL mode may create companion files alongside the main DB file (for example `-wal` / `-shm`). Treat these as part of the database for backups while the app is stopped, or use SQLite’s online backup APIs for hot backups.

## Backup procedure (simple)

1. Stop the web app and worker (quiesce writers).
2. Copy the database file (and WAL/SHM if present) to durable object storage or another host.
3. Optionally verify integrity:

```bash
sqlite3 /data/cursor-usage.db "PRAGMA integrity_check;"
```

## Restore procedure

1. Stop services.
2. Replace the database file path referenced by `DATABASE_URL` with the backup copy.
3. Start services.

## Notes

- Keep backups encrypted at rest if they leave trusted infrastructure.
- Document your retention policy internally (this MVP does not automate retention).

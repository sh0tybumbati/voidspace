# Deploying Voidspace

Two processes and a Postgres database: the API (`node apps/api/dist/index.js`) and the web app (`next start`).

## Build

```bash
npm ci
npm run build
npm run db:deploy -w packages/database     # applies pending migrations; safe to repeat
```

`NEXT_PUBLIC_API_URL` is baked into the web build. Set it to the public API address and rebuild when it changes.

## API environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `JWT_SECRET` | 32+ random characters (`openssl rand -base64 32`). The API refuses to start in production with an example value |
| `FRONTEND_URL` | The web app's public address. Controls CORS and the links in emails |
| `PORT` | API port |
| `REQUIRE_EMAIL_VERIFICATION=1` | Posting, voting and creating spaces need a verified email. Turn this on for a public site |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Outgoing email. Without `SMTP_HOST`, emails are written to the log (fine for development, useless in production) |
| `TRUST_PROXY=1` | Set behind Cloudflare Tunnel, nginx or any proxy. Without it every visitor shares one rate-limit bucket |
| `RATE_LIMIT_MAX_REQUESTS` | Per-address requests a minute across the API (default 300). Sign-in, sign-up and email requests have their own tighter limits |
| `UPLOAD_DIR` | Where uploaded images are kept (default `./uploads`). Back this up |
| `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET_NAME`, `S3_REGION`, `CDN_URL` | Use object storage instead of the local disk. **Not yet tested against a real bucket** |
| `ALLOW_LAN_ORIGINS=1` | Home installs only: accept requests from private-network addresses |

On start the API checks these and refuses to run with a bad production setup; warnings are printed for the optional ones.

## Before opening to the public

1. Set `REQUIRE_EMAIL_VERIFICATION=1` with working SMTP, and send yourself a verification and a reset email.
2. Put the API and web behind HTTPS (a tunnel or reverse proxy) and set `TRUST_PROXY=1`.
3. Make an admin: `./make-admin.sh <username>`. Sign the warrant canary from Admin, then Notices and canary, and renew it before it expires.
4. Have a lawyer review `/terms` and `/privacy` (they are drafts), and decide who receives legal notices.
5. Know what deletion does. Accounts are anonymised, not removed (`deleted_xxxx`), so threads, mod logs and election tallies stay intact; people can also erase their own posts, comments and uploads. Decide how long backups are kept, because deleted data lives on in them until they roll over, and say so in the privacy page.
6. Back up the database and the upload directory (`pg_dump`, plus a copy of `UPLOAD_DIR`).

## Known gaps

- S3 storage is implemented but untested.
- Real-time updates use an in-process event bus, so they work with one API process. For several processes, move it to Redis pub/sub.
- Notifications are in-app only (no email digests).

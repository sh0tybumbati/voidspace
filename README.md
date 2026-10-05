# Voidspace

A community site where members elect their moderators, every moderation decision is public, and anyone can appeal.

## What is different

- **Elected moderators.** Members nominate, discuss, then vote. 60% approval and 10% turnout to pass; 75% to remove a founder. A space always keeps a moderator.
- **Community votes** on rules, ads, privacy and deleting the space.
- **Public mod log** with the moderator's name and reason on every removal and ban.
- **Appeals** within 30 days, reviewed by a different moderator, escalating to site admins.
- **Admins are accountable.** Every admin action needs a written justification, published on the transparency page, along with legal notices and a warrant canary.
- Reports, a mod queue, image uploads (re-encoded, metadata stripped), live notifications, private spaces, NSFW gating.
- Pinned posts (two slots per space, every pin and unpin in the public mod log).
- Self-service data export and account deletion (anonymised, with an option to erase your own content).

The numbers above live in one place, `apps/api/src/services/governance.ts` (`RULES`), and the governance page reads them from the API, so the UI cannot drift from the code.

## Layout

```
apps/api        Express 4 + TypeScript + Prisma 6. createApp() in src/app.ts, jobs in src/jobs
apps/web        Next.js 14 (app router), Tailwind 3, no UI kit; tokens in src/app/globals.css
packages/database   Prisma schema and migrations
docs/deployment.md  Going live: env, email, proxy, storage, backups
```

## Run it locally

Needs Node 20+ and PostgreSQL 14+.

```bash
npm install
cp apps/api/.env.example apps/api/.env          # set DATABASE_URL and JWT_SECRET
cp apps/web/.env.local.example apps/web/.env.local
npm run db:deploy -w packages/database          # apply migrations
npm run db:generate -w packages/database
npm run dev                                     # API :3001, web :3000
```

Fill it with a demo community (spaces, threads, an open election and vote, appeals, a legal notice):

```bash
npm run seed:demo -w apps/api                   # add -- --reset to start over
```

Every demo account uses the password `voidspace-demo`: `mara` (founder of v/gardening), `wren` (candidate in the open election), `zeph` (banned, appealing), `root` (admin).

## Tests

```bash
cp apps/api/.env.test.example apps/api/.env.test   # point it at a throwaway database
npm test -w apps/api                               # 57 tests over real HTTP
npx tsc --noEmit -w apps/web && npm run build      # web typecheck and production build
```

The API tests start the app in-process against a separate database and cover moderation, appeals, elections, community votes, transparency, auth hardening, uploads, notifications (including the live stream) and private spaces.

## Changing the schema

`prisma migrate dev` needs a terminal. In scripts and CI, generate the migration from the diff and apply it with `db:deploy`:

```bash
cd packages/database
npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url "$SHADOW_DATABASE_URL" --script > prisma/migrations/<timestamp>_name/migration.sql
npm run db:deploy
```

## Going live

Read [docs/deployment.md](docs/deployment.md). The Terms and Privacy pages are plain-language drafts and need legal review before the site is public.

## License

TBD

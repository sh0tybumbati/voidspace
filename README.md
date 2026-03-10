# Voidspace

A community-driven discussion platform with democratic governance and transparent moderation.

## Features

- **Democratic Governance**: Community votes for adding and removing moderators
- **Transparent Moderation**: All mod actions logged publicly with required justifications
- **Appeals System**: Users can appeal mod decisions to different moderators
- **NSFW Support**: Proper age-gating and blur system for adult content
- **Community Ads**: Non-intrusive ads only with community opt-in and revenue sharing
- **Minimal Censorship**: Platform only removes illegal content, communities self-moderate

## Tech Stack

- **Frontend**: Next.js 14 with App Router, Tailwind CSS
- **Backend**: Node.js + Express
- **Database**: PostgreSQL + Redis (caching)
- **Auth**: NextAuth.js with JWT
- **File Storage**: S3-compatible (Cloudflare R2, AWS S3, or Backblaze B2)
- **Monorepo**: Turborepo

## Project Structure

```
voidspace/
├── apps/
│   ├── web/              # Next.js frontend
│   └── api/              # Express backend
├── packages/
│   ├── database/         # Prisma schema & client
│   ├── ui/               # Shared UI components
│   ├── types/            # TypeScript types
│   └── config/           # Shared configs
├── turbo.json            # Turborepo configuration
└── package.json          # Root package.json
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm 9+
- PostgreSQL 14+
- Redis 6+

### Installation

1. **Clone the repository**

```bash
git clone <repository-url>
cd voidspace
```

2. **Install dependencies**

```bash
npm install
```

3. **Set up environment variables**

```bash
# Copy example env files
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.local.example apps/web/.env.local
cp packages/database/.env.example packages/database/.env

# Edit the .env files with your configuration
```

4. **Set up the database**

```bash
# Navigate to database package
cd packages/database

# Run migrations
npm run db:migrate

# Generate Prisma client
npm run db:generate
```

5. **Start development servers**

```bash
# From root directory
npm run dev
```

This will start:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

## Development

### Available Scripts

```bash
npm run dev      # Start all apps in development mode
npm run build    # Build all apps
npm run lint     # Lint all apps
npm run test     # Run tests
npm run clean    # Clean build artifacts
```

### Database Commands

```bash
cd packages/database

npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema changes (dev)
npm run db:migrate   # Create and run migrations
npm run db:studio    # Open Prisma Studio
npm run db:seed      # Seed database
```

## Database Schema

The project uses 17 tables organized into three categories:

**Core Tables:**
- users
- spaces (communities)
- posts
- comments
- votes
- subscriptions

**Moderation & Governance:**
- moderators
- mod_actions (public log)
- admin_actions (public log)
- bans
- appeals
- mod_elections
- election_votes
- community_votes
- reports

**Legal & Compliance:**
- legal_notices
- transparency_canary

## Implementation Roadmap

### Phase 1: Core Features (Week 1-2)
- [x] Project setup
- [ ] Authentication & user system
- [ ] Spaces & posts
- [ ] Comments & voting

### Phase 2: Moderation (Week 3)
- [ ] Moderator permissions
- [ ] Public mod log
- [ ] Content removal & bans
- [ ] Appeals system
- [ ] Report system

### Phase 3: Governance (Week 4)
- [ ] Mod elections
- [ ] Community votes
- [ ] Admin system

### Phase 4: Media & NSFW (Week 5)
- [ ] NSFW age-gating
- [ ] Image/video upload
- [ ] Rich text editor

### Phase 5: Ads & Monetization (Week 6)
- [ ] Ad system
- [ ] Revenue sharing
- [ ] Community ad votes

### Phase 6: Polish (Week 7)
- [ ] Search functionality
- [ ] Redis caching
- [ ] Rate limiting
- [ ] Performance optimization
- [ ] Mobile responsiveness

### Phase 7: Testing & Launch (Week 8)
- [ ] Unit & integration tests
- [ ] E2E tests
- [ ] Legal documents
- [ ] Admin tools
- [ ] Deployment setup
- [ ] Monitoring & analytics

## Contributing

This project is currently in active development. Contribution guidelines will be added soon.

## License

TBD

## Version

Current version: 0.1.0

**Note:** Remember to update the version number when pushing to git. The version number appears on the index page.

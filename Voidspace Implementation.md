# Voidspace Implementation Plan
## Reddit Alternative with Community Self-Governance

---

## Table of Contents
1. [Core Philosophy](#core-philosophy)
2. [Tech Stack](#tech-stack)
3. [Database Schema](#database-schema)
4. [API Endpoints](#api-endpoints)
5. [Frontend Structure](#frontend-structure)
6. [Governance System](#governance-system)
7. [Moderation System](#moderation-system)
8. [NSFW Implementation](#nsfw-implementation)
9. [Advertising System](#advertising-system)
10. [Development Roadmap](#development-roadmap)
11. [Legal Requirements](#legal-requirements)
12. [Launch Strategy](#launch-strategy)

---

## Core Philosophy

### What Makes Voidspace Different

**Minimal Platform Censorship**
- Only remove content that's illegal under reasonable laws
- No political coercion or unreasonable censorship
- Transparent about all admin actions

**Community Self-Governance**
- Communities moderate themselves
- No super mods or admin overreach
- Admins only intervene to remove abusive mods
- Democratic mod elections and removal

**User-Friendly Monetization**
- Only non-intrusive ads (text/static images)
- Community opt-in for ads
- No tracking beyond basic impressions
- Revenue sharing with communities

**NSFW Friendly**
- NSFW content allowed with proper age-gating
- Space-level 18+ flagging
- Clear content warnings

---

## Tech Stack

### Recommended Stack

**Frontend**
- Framework: Next.js 14+ (React) or SvelteKit
- Styling: Tailwind CSS
- State Management: Zustand or React Context
- Forms: React Hook Form + Zod validation

**Backend**
- Runtime: Node.js + Express OR Go (better performance)
- API: RESTful or GraphQL
- Real-time: WebSockets for live updates (optional v2)

**Database**
- Primary: PostgreSQL (relational data)
- Cache: Redis (hot posts, sessions)
- Search: Elasticsearch or PostgreSQL full-text search

**Authentication**
- NextAuth.js or Supabase Auth
- JWT tokens
- Optional: OAuth providers (Google, GitHub)

**File Storage**
- Images/Videos: S3-compatible storage (AWS S3, Cloudflare R2, Backblaze B2)
- CDN: CloudFlare

**Hosting**
- Frontend: Vercel or Netlify
- Backend: Railway, Render, or DigitalOcean
- Database: Managed PostgreSQL (Supabase, Railway, Neon)
- Alternative: All-in-one with Supabase

**Development Tools**
- Monorepo: Turborepo or Nx
- Testing: Jest + React Testing Library
- E2E: Playwright
- CI/CD: GitHub Actions

---

## Database Schema

### Core Tables
```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  alignment INTEGER DEFAULT 0,
  avatar_url TEXT,
  bio TEXT,
  preferences JSONB,
  is_admin BOOLEAN DEFAULT FALSE,
  is_over_18 BOOLEAN DEFAULT FALSE,
  banned BOOLEAN DEFAULT FALSE,
  INDEX idx_username (username),
  INDEX idx_email (email)
);

-- Spaces (subreddit equivalent)
CREATE TABLE spaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  creator_id UUID REFERENCES users(id),
  subscriber_count INTEGER DEFAULT 0,
  rules JSONB,
  sidebar_content TEXT,
  is_nsfw BOOLEAN DEFAULT FALSE,
  nsfw_type VARCHAR(20), -- 'partial' or 'full'
  ad_enabled BOOLEAN DEFAULT FALSE,
  INDEX idx_name (name),
  INDEX idx_created_at (created_at)
);

-- Posts
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID REFERENCES spaces(id) ON DELETE CASCADE,
  author_id UUID REFERENCES users(id),
  title VARCHAR(300) NOT NULL,
  content TEXT,
  post_type VARCHAR(20) NOT NULL, -- 'text', 'link', 'image', 'video'
  url TEXT, -- for link/image/video posts
  created_at TIMESTAMP DEFAULT NOW(),
  edited_at TIMESTAMP,
  vote_score INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  is_nsfw BOOLEAN DEFAULT FALSE,
  is_pinned BOOLEAN DEFAULT FALSE,
  removed BOOLEAN DEFAULT FALSE,
  removed_by UUID REFERENCES users(id),
  removal_reason TEXT,
  INDEX idx_space_created (space_id, created_at),
  INDEX idx_space_score (space_id, vote_score),
  INDEX idx_author (author_id)
);

-- Comments
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  author_id UUID REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  edited_at TIMESTAMP,
  vote_score INTEGER DEFAULT 0,
  depth_level INTEGER DEFAULT 0,
  removed BOOLEAN DEFAULT FALSE,
  removed_by UUID REFERENCES users(id),
  removal_reason TEXT,
  INDEX idx_post_created (post_id, created_at),
  INDEX idx_parent (parent_comment_id),
  INDEX idx_author (author_id)
);

-- Votes
CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  target_id UUID NOT NULL,
  target_type VARCHAR(20) NOT NULL, -- 'post' or 'comment'
  vote_value INTEGER NOT NULL, -- 1 or -1
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, target_id, target_type),
  INDEX idx_target (target_id, target_type)
);

-- Subscriptions
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  space_id UUID REFERENCES spaces(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, space_id),
  INDEX idx_user (user_id),
  INDEX idx_space (space_id)
);
```

### Moderation & Governance Tables
```sql
-- Moderators
CREATE TABLE moderators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  space_id UUID REFERENCES spaces(id),
  permissions JSONB, -- granular permissions
  added_at TIMESTAMP DEFAULT NOW(),
  added_by UUID REFERENCES users(id),
  is_founder BOOLEAN DEFAULT FALSE,
  UNIQUE(user_id, space_id),
  INDEX idx_space (space_id),
  INDEX idx_user (user_id)
);

-- Mod Actions (PUBLIC LOG)
CREATE TABLE mod_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mod_id UUID REFERENCES users(id),
  space_id UUID REFERENCES spaces(id),
  action_type VARCHAR(50) NOT NULL, -- 'remove_post', 'remove_comment', 'ban_user', 'unban_user'
  target_id UUID NOT NULL,
  target_type VARCHAR(20) NOT NULL, -- 'post', 'comment', 'user'
  reason TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  reversed_by UUID REFERENCES users(id),
  reversed_at TIMESTAMP,
  INDEX idx_space_created (space_id, created_at),
  INDEX idx_mod (mod_id),
  INDEX idx_target (target_id, target_type)
);

-- Admin Actions (PUBLIC LOG)
CREATE TABLE admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES users(id),
  action_type VARCHAR(50) NOT NULL, -- 'remove_mod', 'legal_takedown', 'ban_user'
  target_id UUID NOT NULL,
  target_type VARCHAR(20) NOT NULL,
  justification TEXT NOT NULL,
  evidence TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_created (created_at)
);

-- Bans
CREATE TABLE bans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  space_id UUID REFERENCES spaces(id), -- NULL for site-wide ban
  banned_by UUID REFERENCES users(id),
  reason TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP, -- NULL for permanent
  is_active BOOLEAN DEFAULT TRUE,
  INDEX idx_user_space (user_id, space_id),
  INDEX idx_expires (expires_at)
);

-- Appeals
CREATE TABLE appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  space_id UUID REFERENCES spaces(id),
  mod_action_id UUID REFERENCES mod_actions(id),
  reason TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'denied'
  reviewed_by UUID REFERENCES users(id),
  reviewer_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_user (user_id)
);

-- Mod Elections
CREATE TABLE mod_elections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID REFERENCES spaces(id),
  candidate_id UUID REFERENCES users(id),
  election_type VARCHAR(20) NOT NULL, -- 'add_mod' or 'remove_mod'
  nomination_date TIMESTAMP DEFAULT NOW(),
  election_start TIMESTAMP NOT NULL,
  election_end TIMESTAMP NOT NULL,
  votes_for INTEGER DEFAULT 0,
  votes_against INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'passed', 'failed'
  INDEX idx_space_status (space_id, status)
);

-- Election Votes
CREATE TABLE election_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id UUID REFERENCES mod_elections(id),
  user_id UUID REFERENCES users(id),
  vote BOOLEAN NOT NULL, -- true = for, false = against
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(election_id, user_id)
);

-- Community Votes (governance)
CREATE TABLE community_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID REFERENCES spaces(id),
  vote_type VARCHAR(50) NOT NULL, -- 'enable_ads', 'change_rules', 'go_private'
  proposal TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  ends_at TIMESTAMP NOT NULL,
  votes_for INTEGER DEFAULT 0,
  votes_against INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',
  result JSONB,
  INDEX idx_space_status (space_id, status)
);

-- Reports
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES users(id),
  target_id UUID NOT NULL,
  target_type VARCHAR(20) NOT NULL, -- 'post', 'comment', 'user'
  reason TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  reviewed_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_target (target_id, target_type)
);
```

### Legal & Compliance Tables
```sql
-- Legal Notices (transparency)
CREATE TABLE legal_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_type VARCHAR(50) NOT NULL, -- 'dmca', 'court_order', 'government_request'
  affected_content_type VARCHAR(20),
  affected_content_id UUID,
  jurisdiction VARCHAR(100),
  date_received TIMESTAMP NOT NULL,
  action_taken TEXT NOT NULL,
  public_summary TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_date (date_received)
);

-- Canary
CREATE TABLE transparency_canary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  statement TEXT NOT NULL,
  valid_until TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_valid (valid_until)
);
```

---

## API Endpoints

### Authentication
```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me
POST   /api/auth/verify-age
PATCH  /api/auth/password
```

### Users
```
GET    /api/users/:username
PATCH  /api/users/:username (own profile only)
GET    /api/users/:username/posts
GET    /api/users/:username/comments
GET    /api/users/:username/alignment
```

### Spaces
```
GET    /api/spaces (list/search)
POST   /api/spaces (create)
GET    /api/spaces/:name
PATCH  /api/spaces/:name (mods only)
DELETE /api/spaces/:name (founder only with vote)
POST   /api/spaces/:name/subscribe
DELETE /api/spaces/:name/subscribe
GET    /api/spaces/:name/subscribers
GET    /api/spaces/:name/rules
PATCH  /api/spaces/:name/rules (mods only)
```

### Posts
```
GET    /api/posts (feed - all/subscribed)
GET    /api/spaces/:name/posts
POST   /api/posts (create)
GET    /api/posts/:id
PATCH  /api/posts/:id (edit - author only)
DELETE /api/posts/:id (author or mod)
POST   /api/posts/:id/vote
DELETE /api/posts/:id/vote
```

### Comments
```
GET    /api/posts/:postId/comments
POST   /api/comments (create)
GET    /api/comments/:id
PATCH  /api/comments/:id (edit - author only)
DELETE /api/comments/:id (author or mod)
POST   /api/comments/:id/vote
DELETE /api/comments/:id/vote
```

### Moderation
```
GET    /api/spaces/:name/mod-log (public)
GET    /api/spaces/:name/mod-queue (mods only)
POST   /api/mod/remove-post
POST   /api/mod/remove-comment
POST   /api/mod/ban-user
POST   /api/mod/unban-user
POST   /api/mod/pin-post
GET    /api/mod/reports (mods only)
PATCH  /api/mod/reports/:id (resolve)
```

### Governance
```
GET    /api/spaces/:name/mods
POST   /api/spaces/:name/nominate-mod
GET    /api/spaces/:name/elections
POST   /api/elections/:id/vote
GET    /api/spaces/:name/votes (community votes)
POST   /api/spaces/:name/propose-vote
POST   /api/community-votes/:id/cast
```

### Appeals
```
POST   /api/appeals (create)
GET    /api/appeals (user's appeals)
GET    /api/spaces/:name/appeals (mods only)
PATCH  /api/appeals/:id (review - mods only)
```

### Admin
```
GET    /api/admin-log (public)
POST   /api/admin/remove-mod (with justification)
POST   /api/admin/ban-user (with justification)
POST   /api/admin/legal-takedown (documented)
GET    /api/admin/reports
```

### Transparency
```
GET    /api/transparency/canary
GET    /api/transparency/legal-notices
GET    /api/transparency/annual-report
GET    /api/transparency/stats
```

---

## Frontend Structure

### Pages & Routes
```
Public Pages:
/                           - Home feed (all/popular)
/v/:spaceName               - Space view
/v/:spaceName/post/:postId  - Post detail
/u/:username                - User profile
/login                      - Login page
/register                   - Registration
/about                      - About Voidspace
/transparency               - Transparency report
/admin-log                  - Public admin actions

Protected Pages:
/submit                     - Create post
/settings                   - User settings
/settings/preferences       - User preferences
/messages                   - DMs (future)

Space Management (Mods):
/v/:spaceName/edit          - Space settings
/v/:spaceName/modlog        - Mod action log
/v/:spaceName/queue         - Mod queue
/v/:spaceName/governance    - Elections & votes
/v/:spaceName/appeals       - Appeal queue

Admin Pages:
/admin                      - Admin dashboard
/admin/reports              - Reported content
/admin/legal                - Legal notices
```

### Component Structure
```
components/
├── layout/
│   ├── Navbar.tsx
│   ├── Sidebar.tsx
│   ├── Footer.tsx
│   └── MobileNav.tsx
├── posts/
│   ├── PostCard.tsx
│   ├── PostDetail.tsx
│   ├── PostForm.tsx
│   └── VoteButtons.tsx
├── comments/
│   ├── CommentTree.tsx
│   ├── Comment.tsx
│   ├── CommentForm.tsx
│   └── CommentVoteButtons.tsx
├── spaces/
│   ├── SpaceCard.tsx
│   ├── SpaceSidebar.tsx
│   ├── SpaceHeader.tsx
│   └── SpaceRules.tsx
├── moderation/
│   ├── ModLog.tsx
│   ├── ModQueue.tsx
│   ├── RemovalForm.tsx
│   ├── BanForm.tsx
│   └── AppealCard.tsx
├── governance/
│   ├── ElectionCard.tsx
│   ├── VoteProposal.tsx
│   ├── ModNomination.tsx
│   └── GovernanceStats.tsx
├── user/
│   ├── UserCard.tsx
│   ├── UserProfile.tsx
│   ├── UserSettings.tsx
│   └── AlignmentDisplay.tsx
├── common/
│   ├── Modal.tsx
│   ├── Button.tsx
│   ├── Input.tsx
│   ├── Dropdown.tsx
│   ├── Tabs.tsx
│   ├── Toast.tsx
│   └── Loading.tsx
└── nsfw/
    ├── AgeGate.tsx
    ├── NSFWBlur.tsx
    └── NSFWWarning.tsx
```

---

## Governance System

### Mod Election System

**Becoming a Moderator:**
1. User must meet requirements:
   - Account age: 30+ days
   - Alignment in space: 100+ points
   - No active bans
2. User nominates themselves or is nominated
3. Nomination period: 3 days for discussion
4. Voting period: 7 days
5. Requirements to pass:
   - 60% approval rate
   - 10% of subscribers must vote
6. If passed, user becomes moderator

**Removing a Moderator:**
1. Any user can propose removal (same requirements)
2. Must provide justification
3. Same voting process as election
4. Founder mods require 75% to remove

**Implementation:**
```javascript
// Election logic
const createModElection = async (spaceId, candidateId, type) => {
  const election = await db.mod_elections.create({
    space_id: spaceId,
    candidate_id: candidateId,
    election_type: type,
    election_start: Date.now() + 3 * 24 * 60 * 60 * 1000, // 3 days
    election_end: Date.now() + 10 * 24 * 60 * 60 * 1000    // 10 days
  });
  return election;
};

const finalizeElection = async (electionId) => {
  const election = await db.mod_elections.findById(electionId);
  const space = await db.spaces.findById(election.space_id);
  
  const totalVotes = election.votes_for + election.votes_against;
  const approvalRate = election.votes_for / totalVotes;
  const turnoutRate = totalVotes / space.subscriber_count;
  
  if (approvalRate >= 0.6 && turnoutRate >= 0.1) {
    // Election passed
    if (election.election_type === 'add_mod') {
      await db.moderators.create({
        user_id: election.candidate_id,
        space_id: election.space_id
      });
    } else if (election.election_type === 'remove_mod') {
      await db.moderators.delete({
        user_id: election.candidate_id,
        space_id: election.space_id
      });
    }
    election.status = 'passed';
  } else {
    election.status = 'failed';
  }
  
  await election.save();
};
```

### Community Voting System

**What Communities Can Vote On:**
- Enable/disable ads in space
- Major rule changes
- Go private/public
- Merge with another space
- Delete space

**Voting Requirements:**
- Proposal must be clear and specific
- Discussion period: 3 days
- Voting period: 7 days
- Pass threshold: 60% approval, 15% turnout
- Mods cannot veto (but can participate)

**Implementation:**
```javascript
const createCommunityVote = async (spaceId, voteType, proposal) => {
  const vote = await db.community_votes.create({
    space_id: spaceId,
    vote_type: voteType,
    proposal: proposal,
    ends_at: Date.now() + 10 * 24 * 60 * 60 * 1000
  });
  return vote;
};
```

---

## Moderation System

### Mod Powers & Limitations

**What Mods Can Do:**
- Remove posts/comments (must provide reason)
- Ban users (temporary or permanent, must provide reason)
- Pin posts
- Edit space rules and sidebar
- Approve/deny reported content
- Set post flair requirements

**What Mods CANNOT Do:**
- Edit user posts or comments
- Shadow ban (all bans are visible)
- Access user IP addresses
- See who voted on what
- Remove other mods (requires election)
- Disable appeals system

### Public Mod Log

**All mod actions are logged publicly:**
```javascript
const logModAction = async (modId, spaceId, actionType, targetId, reason) => {
  await db.mod_actions.create({
    mod_id: modId,
    space_id: spaceId,
    action_type: actionType,
    target_id: targetId,
    target_type: getTargetType(targetId),
    reason: reason
  });
};

// Example: Removing a post
const removePost = async (postId, modId, reason) => {
  await db.posts.update(postId, { 
    removed: true, 
    removed_by: modId,
    removal_reason: reason 
  });
  
  await logModAction(modId, post.space_id, 'remove_post', postId, reason);
  
  // Notify post author
  await sendNotification(post.author_id, {
    type: 'post_removed',
    reason: reason,
    appeal_link: `/appeals/new?action=${modAction.id}`
  });
};
```

### Appeals System

**How Appeals Work:**
1. User receives notification when content removed
2. User can appeal within 30 days
3. Appeal goes to mod queue
4. Different mod (not original) reviews
5. Mod can:
   - Approve appeal (restore content)
   - Deny appeal (with explanation)
   - Escalate to admin (if mod abuse suspected)
6. User gets notification of decision

**Implementation:**
```javascript
const createAppeal = async (userId, modActionId, reason) => {
  const modAction = await db.mod_actions.findById(modActionId);
  
  const appeal = await db.appeals.create({
    user_id: userId,
    space_id: modAction.space_id,
    mod_action_id: modActionId,
    reason: reason,
    status: 'pending'
  });
  
  return appeal;
};

const reviewAppeal = async (appealId, reviewerId, decision, notes) => {
  const appeal = await db.appeals.findById(appealId);
  
  // Reviewer cannot be original moderator
  if (reviewerId === appeal.mod_action.mod_id) {
    throw new Error('Original moderator cannot review appeal');
  }
  
  if (decision === 'approved') {
    // Restore content
    const modAction = await db.mod_actions.findById(appeal.mod_action_id);
    await restoreContent(modAction.target_id, modAction.target_type);
    
    // Mark original action as reversed
    await db.mod_actions.update(appeal.mod_action_id, {
      reversed_by: reviewerId,
      reversed_at: new Date()
    });
  }
  
  await db.appeals.update(appealId, {
    status: decision,
    reviewed_by: reviewerId,
    reviewer_notes: notes,
    resolved_at: new Date()
  });
};
```

### Admin Intervention

**When Admins Can Act:**
1. Mod abuse (removing content arbitrarily, banning without reason)
2. Illegal content (CSAM, direct threats, etc.)
3. Legal requests (DMCA, court orders)
4. Platform-level TOS violations

**Admin Action Process:**
```javascript
const adminRemoveMod = async (adminId, modId, spaceId, justification, evidence) => {
  // Log public admin action
  await db.admin_actions.create({
    admin_id: adminId,
    action_type: 'remove_mod',
    target_id: modId,
    target_type: 'user',
    justification: justification,
    evidence: evidence
  });
  
  // Remove moderator
  await db.moderators.delete({
    user_id: modId,
    space_id: spaceId
  });
  
  // Notify space and user
  await notifySpace(spaceId, {
    type: 'mod_removed_by_admin',
    mod_username: mod.username,
    justification: justification
  });
  
  await notifyUser(modId, {
    type: 'removed_as_mod',
    justification: justification,
    appeal_link: '/contact/admin-appeal'
  });
};
```

---

## NSFW Implementation

### Space-Level NSFW
```javascript
// Space settings
const spaceNSFWSettings = {
  is_nsfw: boolean,
  nsfw_type: 'none' | 'partial' | 'full',
  // none = SFW space
  // partial = SFW space that allows NSFW posts (tagged)
  // full = entire space is 18+
};
```

### Age Gate

**First-time visitors to NSFW content:**
```jsx
const AgeGate = ({ onConfirm }) => {
  return (
    <Modal>
      <h2>Adult Content Warning</h2>
      <p>This space contains content intended for adults.</p>
      <p>You must be 18 years or older to view this content.</p>
      
      <Checkbox>
        I am 18 years of age or older
      </Checkbox>
      
      <Button onClick={onConfirm}>
        Continue
      </Button>
      
      <Button variant="secondary" onClick={() => router.back()}>
        Go Back
      </Button>
    </Modal>
  );
};
```

**Storing preference:**
```javascript
// Cookie-based (no account required)
const confirmAge = () => {
  document.cookie = 'over18=true; max-age=31536000; path=/';
  // Cookie lasts 1 year
};

// Account-based
const confirmAgeAccount = async (userId) => {
  await db.users.update(userId, { is_over_18: true });
};
```

### NSFW Post Handling

**Blurred Thumbnails:**
```jsx
const NSFWBlur = ({ imageUrl, isNSFW }) => {
  const [revealed, setRevealed] = useState(false);
  
  if (!isNSFW) {
    return <img src={imageUrl} alt="Post image" />;
  }
  
  return (
    <div className="relative">
      <img 
        src={imageUrl} 
        alt="NSFW content"
        className={revealed ? '' : 'blur-3xl'}
      />
      {!revealed && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Button onClick={() => setRevealed(true)}>
            Click to reveal NSFW content
          </Button>
        </div>
      )}
    </div>
  );
};
```

**User Settings:**
```javascript
const userNSFWSettings = {
  show_nsfw: boolean, // Show NSFW posts in feed
  blur_nsfw: boolean,  // Blur NSFW images
};
```

---

## Advertising System

### Ad Specifications

**Allowed Ad Formats:**
- Text ads (max 200 characters)
- Static image ads (300x250px or 728x90px)
- No video, no audio, no animation

**Ad Placement:**
- Sidebar (desktop)
- Between posts (every 10 posts on mobile)
- Never in comments
- Never on NSFW spaces

**No Tracking:**
- No cookies
- No fingerprinting
- Only count impressions (how many times shown)
- No click tracking beyond basic count

### Ad System Implementation
```javascript
// Ad model
const Ad = {
  id: UUID,
  advertiser_id: UUID,
  title: String,
  content: String, // text or image URL
  ad_type: 'text' | 'image',
  target_spaces: Array<UUID>, // which spaces opted in
  impressions: Number,
  clicks: Number,
  budget: Number, // cost per 1000 impressions
  active: Boolean
};

// Serving ads
const getAdForSpace = async (spaceId) => {
  // Check if space has ads enabled
  const space = await db.spaces.findById(spaceId);
  if (!space.ad_enabled) return null;
  
  // Get active ads targeting this space
  const ads = await db.ads.find({
    target_spaces: { $contains: spaceId },
    active: true,
    budget: { $gt: 0 }
  });
  
  // Random selection (or use simple rotation)
  const ad = ads[Math.floor(Math.random() * ads.length)];
  
  // Increment impression count
  await db.ads.update(ad.id, {
    impressions: ad.impressions + 1,
    budget: ad.budget - 0.001 // deduct from budget
  });
  
  return ad;
};
```

### Revenue Sharing
```javascript
// Monthly revenue calculation
const distributeAdRevenue = async () => {
  const spaces = await db.spaces.find({ ad_enabled: true });
  
  for (const space of spaces) {
    // Calculate impressions in this space
    const totalImpressions = await calculateImpressions(space.id);
    const revenue = totalImpressions * 0.001; // $1 per 1000 impressions
    
    // 50/50 split
    const spaceShare = revenue * 0.5;
    const platformShare = revenue * 0.5;
    
    // Credit space mods
    await creditSpaceMods(space.id, spaceShare);
    
    // Platform keeps its share
    await db.platform_revenue.create({
      space_id: space.id,
      amount: platformShare,
      month: new Date()
    });
  }
};

// Distribute to mods equally
const creditSpaceMods = async (spaceId, amount) => {
  const mods = await db.moderators.find({ space_id: spaceId });
  const perMod = amount / mods.length;
  
  for (const mod of mods) {
    await db.mod_earnings.create({
      user_id: mod.user_id,
      space_id: spaceId,
      amount: perMod,
      month: new Date()
    });
  }
};
```

### Community Ad Vote
```javascript
const proposeEnableAds = async (spaceId, proposerId) => {
  const vote = await db.community_votes.create({
    space_id: spaceId,
    vote_type: 'enable_ads',
    proposal: 'Enable non-intrusive ads in this space. 50% of revenue goes to mods.',
    created_at: new Date(),
    ends_at: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
  });
  
  return vote;
};
```

---

## Development Roadmap

### Sprint 1-2: Foundation (2-3 weeks)

**Week 1:**
- [ ] Set up project structure (monorepo)
- [ ] Initialize Next.js frontend
- [ ] Set up PostgreSQL database
- [ ] Create database schema
- [ ] Implement authentication (register/login)
- [ ] Create user profiles

**Week 2:**
- [ ] Space creation and viewing
- [ ] Post creation (text posts only)
- [ ] Post listing/feed
- [ ] Comment system (basic)
- [ ] Voting system (posts/comments)
- [ ] Subscribe to spaces

**Deliverable:** Users can create accounts, create spaces, post, comment, and vote

---

### Sprint 3-4: Moderation (2-3 weeks)

**Week 3:**
- [ ] Moderator system
- [ ] Mod permissions
- [ ] Remove posts/comments
- [ ] Ban users
- [ ] Public mod log
- [ ] Report system

**Week 4:**
- [ ] Appeals system
- [ ] Mod queue (reported content)
- [ ] NSFW tagging (posts)
- [ ] NSFW space settings
- [ ] Age gate modal
- [ ] User settings for NSFW

**Deliverable:** Full moderation system with transparency and appeals

---

### Sprint 5-6: Governance (2-3 weeks)

**Week 5:**
- [ ] Mod election system
- [ ] Nomination process
- [ ] Voting on mod elections
- [ ] Community vote system
- [ ] Governance UI

**Week 6:**
- [ ] Admin action logging (public)
- [ ] Admin dashboard
- [ ] Legal notice system
- [ ] Transparency canary
- [ ] Space governance page

**Deliverable:** Democratic governance system operational

---

### Sprint 7-8: Polish & Launch Prep (2-3 weeks)

**Week 7:**
- [ ] Image/video uploads
- [ ] Link posts with previews
- [ ] Rich text editor
- [ ] Search functionality
- [ ] User alignment calculation
- [ ] Performance optimization

**Week 8:**
- [ ] Mobile responsive design
- [ ] Dark mode
- [ ] Accessibility (WCAG 2.1)
- [ ] SEO optimization
- [ ] Terms of Service
- [ ] Privacy Policy
- [ ] Bug fixes and testing

**Deliverable:** Production-ready MVP

---

### Post-Launch (Months 2-6)

**Month 2:**
- [ ] User feedback integration
- [ ] Performance monitoring
- [ ] Bug fixes
- [ ] Notifications system

**Month 3:**
- [ ] Ad system (if communities vote yes)
- [ ] Direct messages
- [ ] User flair
- [ ] Post flair

**Month 4:**
- [ ] Advanced search (Elasticsearch)
- [ ] Mobile apps (React Native)
- [ ] Multi-space feeds (custom)
- [ ] Save posts

**Month 5-6:**
- [ ] API documentation
- [ ] Third-party apps support
- [ ] Mod tools improvements
- [ ] Analytics dashboard

---

## Key Algorithms

### Ranking Algorithm (Hot)
```javascript
const calculateHotScore = (post) => {
  const score = post.vote_score; // upvotes - downvotes
  const ageInHours = (Date.now() - post.created_at) / (1000 * 60 * 60);
  
  // Reddit-style hot algorithm
  const hotScore = score / Math.pow(ageInHours + 2, 1.5);
  
  return hotScore;
};

// Update hot scores periodically
const updateHotScores = async () => {
  const posts = await db.posts.find({ removed: false });
  
  for (const post of posts) {
    const hotScore = calculateHotScore(post);
    await db.posts.update(post.id, { hot_score: hotScore });
  }
};

// Run every 5 minutes
setInterval(updateHotScores, 5 * 60 * 1000);
```

### Feed Algorithm
```javascript
const getFeed = async (userId, feedType = 'hot', page = 1, limit = 25) => {
  let query = { removed: false };
  
  if (feedType === 'subscribed' && userId) {
    // Get user's subscribed spaces
    const subscriptions = await db.subscriptions.find({ user_id: userId });
    const spaceIds = subscriptions.map(s => s.space_id);
    query.space_id = { $in: spaceIds };
  }
  
  // Sort based on feed type
  let sortBy;
  switch (feedType) {
    case 'hot':
      sortBy = { hot_score: -1 };
      break;
    case 'new':
      sortBy = { created_at: -1 };
      break;
    case 'top':
      sortBy = { vote_score: -1 };
      break;
    default:
      sortBy = { hot_score: -1 };
  }
  
  const posts = await db.posts
    .find(query)
    .sort(sortBy)
    .skip((page - 1) * limit)
    .limit(limit);
    
  return posts;
};
```

### Comment Threading
```javascript
const getCommentTree = async (postId, maxDepth = 8) => {
  // Fetch all comments for post
  const comments = await db.comments.find({ 
    post_id: postId, 
    removed: false 
  });
  
  // Build tree structure
  const commentMap = new Map();
  const rootComments = [];
  
  // First pass: create comment objects
  comments.forEach(comment => {
    commentMap.set(comment.id, {
      ...comment,
      children: []
    });
  });
  
  // Second pass: build tree
  comments.forEach(comment => {
    if (comment.parent_comment_id) {
      const parent = commentMap.get(comment.parent_comment_id);
      if (parent && comment.depth_level <= maxDepth) {
        parent.children.push(commentMap.get(comment.id));
      }
    } else {
      rootComments.push(commentMap.get(comment.id));
    }
  });
  
  return rootComments;
};
```

### Alignment Calculation
```javascript
const calculateAlignment = async (userId) => {
  // Post alignment
  const postAlignment = await db.posts
    .find({ author_id: userId, removed: false })
    .sum('vote_score');
  
  // Comment alignment
  const commentAlignment = await db.comments
    .find({ author_id: userId, removed: false })
    .sum('vote_score');
  
  const totalAlignment = postAlignment + commentAlignment;
  
  await db.users.update(userId, { alignment: totalAlignment });
  
  return totalAlignment;
};

// Update alignment periodically or on vote
```

---

## Legal Requirements

### Before Launch

**Terms of Service (ToS):**
- User responsibilities
- Content policy
- Account termination conditions
- Limitation of liability
- Dispute resolution
- Governing law

**Privacy Policy:**
- What data is collected
- How data is used
- Data retention
- User rights (access, deletion)
- GDPR compliance (if EU users)
- Cookie policy

**DMCA Policy:**
- Designated agent information
- Takedown procedure
- Counter-notice procedure
- Repeat infringer policy

**Age Verification Compliance:**
- Age gate for NSFW content
- Reasonable age verification methods
- Comply with regional laws (e.g., COPPA in US)

**Legal Structure:**
- Register business entity (LLC recommended)
- Get EIN (Employer Identification Number)
- Register for sales tax if applicable
- Get liability insurance (optional but recommended)

**Registered Agent:**
- Designate agent for legal notices
- Publish agent information in ToS

### Content Policy

**Platform Rules (Minimal):**
1. No illegal content (US law)
2. No doxxing (publishing private information)
3. No brigading or coordinated harassment
4. No impersonation
5. No spam or malicious links
6. No ban evasion
7. No child sexual abuse material (zero tolerance)
8. No direct threats of violence

**What's NOT Banned:**
- Controversial opinions
- NSFW content (if properly tagged)
- Criticism of platform/mods/admins
- Political content of any leaning
- Offensive speech (within legal bounds)

**Space-Level Rules:**
- Each space sets own rules
- Must follow platform rules
- Can be more restrictive, not less
- Rules must be clearly posted

### Ongoing Legal Obligations

**Transparency Reports:**
- Publish semi-annually
- Include:
  - Number of admin actions
  - Legal requests received
  - Content removed by category
  - Mod elections held
  - User statistics

**Warrant Canary:**
```javascript
// Update monthly
const canaryStatement = `
As of [DATE], Voidspace has not:
- Received any National Security Letters
- Received any gag orders
- Been compelled to modify code to facilitate surveillance
- Received any requests to hand over encryption keys
- Been required to log user activity beyond normal operations

This statement will be updated on the first of each month.
If this statement is not updated, users should assume it is no longer accurate.
`;
```

**Legal Request Handling:**
1. Verify legitimacy of request
2. Consult with lawyer
3. Comply if legally required
4. Document everything
5. Publish summary in transparency report (if not gagged)

**User Data Requests:**
- GDPR: Provide data within 30 days
- Right to deletion: Delete within 30 days
- Authenticate requestor
- Log all data requests

---

## Launch Strategy

### Phase 1: Private Alpha (Week 1-2)

**Goal:** Test core functionality with trusted users

**Tasks:**
- [ ] Invite 20-50 tech-savvy friends
- [ ] Create 5-10 seed communities
- [ ] Test all core features
- [ ] Gather feedback
- [ ] Fix critical bugs

**Metrics:**
- 100+ posts created
- 500+ comments
- 10+ mod actions logged
- 0 critical bugs

---

### Phase 2: Closed Beta (Week 3-6)

**Goal:** Scale to 1,000 users, test moderation

**Tasks:**
- [ ] Invite-only signups
- [ ] Announce on personal social media
- [ ] Reach out to Reddit power users
- [ ] Monitor server performance
- [ ] Iterate based on feedback

**Metrics:**
- 1,000 active users
- 50+ active spaces
- 5,000+ posts
- Mod election system tested
- Appeal system tested

---

### Phase 3: Public Beta (Month 2-3)

**Goal:** Open to public, drive growth

**Announcement Strategy:**
- [ ] Post on r/RedditAlternatives
- [ ] Post on Hacker News
- [ ] Tweet announcement
- [ ] Email tech journalists
- [ ] Create landing page with waitlist (if needed)

**Positioning:**
- "Reddit alternative with community self-governance"
- "No super mods, minimal censorship"
- "Transparent moderation"
- "Built for communities, not corporations"

**Growth Tactics:**
- Feature comparison vs Reddit
- Import tool (help users migrate communities)
- Referral system (invite friends)
- Highlight mod abuse stories from Reddit

**Metrics:**
- 10,000+ users in first month
- 100+ active spaces
- 50,000+ posts
- <1% admin intervention rate
- Positive press coverage

---

### Phase 4: Full Launch (Month 4+)

**Goal:** Sustainable growth, introduce ads

**Tasks:**
- [ ] Announce full launch
- [ ] Publish first transparency report
- [ ] Propose ads to communities (with votes)
- [ ] Launch mobile apps
- [ ] Establish sustainability model

**Sustainability:**
- Ad revenue from opted-in communities
- Optional premium features (custom themes, longer posts)
- Donations (crypto-friendly)
- Merchandise (optional)

**Long-term Goals:**
- 100,000+ users in first year
- 1,000+ active spaces
- Self-sustaining (revenue covers costs)
- Positive community reputation
- Feature parity with Reddit

---

## Technical Considerations

### Performance Optimization

**Database:**
- Index frequently queried columns
- Use read replicas for scaling
- Implement connection pooling
- Cache hot posts/comments in Redis

**Frontend:**
- Lazy load images
- Infinite scroll for feeds
- Code splitting
- CDN for static assets

**API:**
- Rate limiting (100 requests/minute per user)
- Pagination for all lists
- Compress responses (gzip)
- Cache common queries

### Security

**Best Practices:**
- Hash passwords (bcrypt, 12+ rounds)
- Use HTTPS everywhere
- CSRF protection
- SQL injection prevention (parameterized queries)
- XSS prevention (sanitize user input)
- Rate limiting on auth endpoints

**User Privacy:**
- Don't log IP addresses (unless legal requirement)
- Encrypt sensitive data at rest
- Allow account deletion
- Provide data export

### Monitoring

**Tools:**
- Error tracking: Sentry
- Analytics: Plausible or self-hosted
- Performance: DataDog or self-hosted
- Uptime: UptimeRobot

**Metrics to Track:**
- Response times
- Error rates
- User growth
- Post/comment volume
- Mod action frequency
- Admin intervention rate

---

## Success Metrics

### Community Health

**Primary Metrics:**
- Daily Active Users (DAU)
- Monthly Active Users (MAU)
- Posts per day
- Comments per day
- Space creation rate
- User retention (D1, D7, D30)

**Governance Metrics:**
- Mod elections held
- Voter turnout rate
- Community votes participation
- Appeal resolution time
- Mod removal rate

**Moderation Quality:**
- Mod action frequency (target: <5% of posts)
- Appeal rate (target: <10% of mod actions)
- Admin intervention rate (target: <1% of mod actions)
- User satisfaction with moderation

**Platform Health:**
- Admin actions per month (target: <10)
- Legal takedowns per month (hopefully 0)
- Uptime (target: 99.9%)
- Response time (target: <200ms)

---

## Risk Mitigation

### Potential Risks

**Content Moderation:**
- Risk: Illegal content slips through
- Mitigation: Clear reporting system, responsive admin team, automated CSAM detection

**Mod Abuse:**
- Risk: Mods abuse power despite transparency
- Mitigation: Appeals system, public logs, community elections, admin oversight

**Legal Issues:**
- Risk: Lawsuits, DMCA abuse, government pressure
- Mitigation: Strong ToS, DMCA policy, consult lawyers, transparency reports

**Scaling Costs:**
- Risk: Server costs outpace revenue
- Mitigation: Efficient architecture, CDN, ad revenue, donations

**Community Toxicity:**
- Risk: Platform becomes known for toxic content
- Mitigation: Clear platform rules, responsive moderation, highlight positive communities

**Competitor Response:**
- Risk: Reddit improves or copies features
- Mitigation: Focus on governance/transparency differentiator, build loyal community

---

## Next Steps for ClaudeCode

1. **Set up project structure:**
```bash
   npx create-next-app@latest voidspace
   cd voidspace
   npm install prisma @prisma/client
   npx prisma init
```

2. **Create database schema (Prisma):**
   - Copy schema from this doc to `prisma/schema.prisma`
   - Run `npx prisma migrate dev`

3. **Implement authentication:**
   - Install NextAuth.js
   - Set up providers
   - Create auth API routes

4. **Build core features in this order:**
   - User profiles
   - Space creation
   - Posts (text only first)
   - Comments
   - Voting
   - Moderation
   - Governance

5. **Test thoroughly at each stage**

6. **Deploy to staging environment**

7. **Invite alpha testers**

---

## Resources

**Design Inspiration:**
- Reddit (obviously)
- Lemmy (federated Reddit alternative)
- Discourse (forum software)
- Hacker News (minimal design)

**Technical Resources:**
- Next.js docs: https://nextjs.org/docs
- Prisma docs: https://www.prisma.io/docs
- PostgreSQL docs: https://www.postgresql.org/docs

**Legal Templates:**
- Termly (ToS/Privacy generator)
- EFF (legal resources)
- GitHub ToS examples

**Community Building:**
- r/RedditAlternatives
- Hacker News
- IndieHackers
- Twitter/X

---

## Final Notes

**Remember:**
- Start small, iterate fast
- Community comes first
- Transparency is key
- Don't compromise on core values
- Listen to users, but stay focused

**This is an ambitious project.** Break it down into small, achievable milestones. Focus on getting the core experience right before adding bells and whistles.

**The differentiator is governance, not features.** Make sure the mod transparency, elections, and minimal admin interference work perfectly.

Good luck building Voidspace! 🚀

# Voidspace Testing Guide

## Quick Start

### 1. Install Dependencies

```bash
# From root directory
npm install
```

### 2. Set Up PostgreSQL Database

```bash
# Create database
createdb voidspace

# Or using psql
psql -U postgres
CREATE DATABASE voidspace;
\q
```

### 3. Configure Environment Variables

**Backend API** (`apps/api/.env`):
```bash
cd apps/api
cp .env.example .env
```

Edit `.env`:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/voidspace"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-super-secret-jwt-key-change-this"
JWT_EXPIRY="7d"
PORT=3001
FRONTEND_URL="http://localhost:3000"
```

**Database** (`packages/database/.env`):
```bash
cd packages/database
cp .env.example .env
```

Edit `.env` with same `DATABASE_URL` as above.

**Frontend** (`apps/web/.env.local`):
```bash
cd apps/web
cp .env.local.example .env.local
```

Edit `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET="your-nextauth-secret-change-this"
```

### 4. Run Database Migrations

```bash
cd packages/database
npm install
npm run db:migrate
npm run db:generate
```

### 5. Start Redis (Optional for Phase 1-2)

```bash
# Using Docker
docker run -d -p 6379:6379 redis:latest

# Or install locally
# macOS: brew install redis && redis-server
# Linux: sudo apt-get install redis-server && redis-server
```

### 6. Start the Backend API

```bash
cd apps/api
npm install
npm run dev
```

You should see:
```
🚀 Voidspace API server running on port 3001
📍 Environment: development
✅ Alignment update job scheduled (every 5 minutes)
```

### 7. Start the Frontend (Optional)

```bash
cd apps/web
npm install
npm run dev
```

Frontend will be available at: http://localhost:3000

---

## API Testing with curl

### Authentication

**Register a new user:**
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123"
  }'
```

**Save the token from the response!**

**Login:**
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "password123"
  }'
```

**Get current user:**
```bash
curl http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Spaces

**Create a space:**
```bash
curl -X POST http://localhost:3001/api/spaces \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "name": "gaming",
    "displayName": "Gaming",
    "description": "All things gaming!",
    "rules": ["Be respectful", "No spam"]
  }'
```

**Get all spaces:**
```bash
curl http://localhost:3001/api/spaces
```

**Get specific space:**
```bash
curl http://localhost:3001/api/spaces/gaming
```

**Subscribe to space:**
```bash
curl -X POST http://localhost:3001/api/spaces/gaming/subscribe \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Unsubscribe:**
```bash
curl -X DELETE http://localhost:3001/api/spaces/gaming/subscribe \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Posts

**Create a text post:**
```bash
curl -X POST http://localhost:3001/api/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "spaceId": "SPACE_ID_FROM_CREATE_RESPONSE",
    "title": "My first post!",
    "content": "This is the content of my post.",
    "postType": "text",
    "isNsfw": false
  }'
```

**Create a link post:**
```bash
curl -X POST http://localhost:3001/api/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "spaceId": "SPACE_ID",
    "title": "Check out this cool site",
    "postType": "link",
    "url": "https://example.com"
  }'
```

**Get all posts (hot feed):**
```bash
curl "http://localhost:3001/api/posts?feed=hot&page=1&limit=25"
```

**Get posts (new):**
```bash
curl "http://localhost:3001/api/posts?sort=new"
```

**Get posts (top):**
```bash
curl "http://localhost:3001/api/posts?sort=top"
```

**Get single post:**
```bash
curl http://localhost:3001/api/posts/POST_ID
```

**Vote on post (upvote):**
```bash
curl -X POST http://localhost:3001/api/posts/POST_ID/vote \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{"voteValue": "1"}'
```

**Vote on post (downvote):**
```bash
curl -X POST http://localhost:3001/api/posts/POST_ID/vote \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{"voteValue": "-1"}'
```

**Edit post:**
```bash
curl -X PATCH http://localhost:3001/api/posts/POST_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "title": "Updated title",
    "content": "Updated content"
  }'
```

**Delete post:**
```bash
curl -X DELETE http://localhost:3001/api/posts/POST_ID \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Users

**Get user profile:**
```bash
curl http://localhost:3001/api/users/testuser
```

**Update profile:**
```bash
curl -X PATCH http://localhost:3001/api/users/testuser \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "bio": "I love gaming!"
  }'
```

**Get user's posts:**
```bash
curl http://localhost:3001/api/users/testuser/posts
```

**Get user's alignment:**
```bash
curl http://localhost:3001/api/users/testuser/alignment
```

### Comments

**Create a comment:**
```bash
curl -X POST http://localhost:3001/api/comments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "postId": "POST_ID",
    "content": "Great post! Thanks for sharing."
  }'
```

**Create a reply to a comment:**
```bash
curl -X POST http://localhost:3001/api/comments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "postId": "POST_ID",
    "parentCommentId": "PARENT_COMMENT_ID",
    "content": "I agree with this comment!"
  }'
```

**Get comments for a post:**
```bash
curl "http://localhost:3001/api/comments/posts/POST_ID/comments?sort=top"
```

**Get single comment:**
```bash
curl http://localhost:3001/api/comments/COMMENT_ID
```

**Vote on comment (upvote):**
```bash
curl -X POST http://localhost:3001/api/comments/COMMENT_ID/vote \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{"voteValue": "1"}'
```

**Vote on comment (downvote):**
```bash
curl -X POST http://localhost:3001/api/comments/COMMENT_ID/vote \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{"voteValue": "-1"}'
```

**Edit comment:**
```bash
curl -X PATCH http://localhost:3001/api/comments/COMMENT_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "content": "Updated comment content"
  }'
```

**Delete comment:**
```bash
curl -X DELETE http://localhost:3001/api/comments/COMMENT_ID \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## Testing with Frontend

### 1. Register an Account

1. Go to http://localhost:3000/register
2. Enter username, email, and password
3. Click "Create account"
4. You'll be redirected to home page

### 2. View Your Profile

1. Go to http://localhost:3000/u/YOUR_USERNAME
2. You should see:
   - Your username
   - Join date
   - Alignment score (0 initially)
   - Tabs for Posts, Comments, About

### 3. Test Login/Logout

1. Logout (if implemented in navbar)
2. Go to http://localhost:3000/login
3. Login with your credentials
4. You should be redirected back

---

## Full User Flow Test

Here's a complete test scenario:

### 1. Create Users
```bash
# User 1
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "alice", "email": "alice@test.com", "password": "password123"}'

# Save TOKEN_ALICE

# User 2
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "bob", "email": "bob@test.com", "password": "password123"}'

# Save TOKEN_BOB
```

### 2. Alice Creates a Space
```bash
curl -X POST http://localhost:3001/api/spaces \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN_ALICE" \
  -d '{
    "name": "gaming",
    "displayName": "Gaming",
    "description": "Discuss your favorite games"
  }'

# Save SPACE_ID
```

### 3. Bob Subscribes to the Space
```bash
curl -X POST http://localhost:3001/api/spaces/gaming/subscribe \
  -H "Authorization: Bearer TOKEN_BOB"
```

### 4. Alice Creates a Post
```bash
curl -X POST http://localhost:3001/api/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN_ALICE" \
  -d '{
    "spaceId": "SPACE_ID",
    "title": "What are you playing this weekend?",
    "content": "I just started Elden Ring!",
    "postType": "text"
  }'

# Save POST_ID
```

### 5. Bob Upvotes the Post
```bash
curl -X POST http://localhost:3001/api/posts/POST_ID/vote \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN_BOB" \
  -d '{"voteValue": "1"}'
```

### 6. Check Alice's Alignment (After Background Job Runs)
```bash
# Wait 5 minutes for alignment job, or trigger manually
curl http://localhost:3001/api/users/alice/alignment
# Should show alignment: 1
```

### 7. Get Feed
```bash
# All posts
curl http://localhost:3001/api/posts

# Bob's subscribed feed
curl "http://localhost:3001/api/posts?feed=subscribed" \
  -H "Authorization: Bearer TOKEN_BOB"
```

---

## Troubleshooting

### "Internal Server Error"
- Check that PostgreSQL is running
- Verify DATABASE_URL is correct
- Check API logs for specific error

### "Unauthorized"
- Make sure you're including the token: `-H "Authorization: Bearer YOUR_TOKEN"`
- Check token hasn't expired (7 day default)
- Verify JWT_SECRET is set

### "Space not found"
- Space names are lowercase
- Use the exact name from creation

### Database Connection Failed
```bash
# Test PostgreSQL connection
psql -U postgres -d voidspace -c "SELECT 1"

# Check if database exists
psql -U postgres -l | grep voidspace
```

### Prisma Client Not Generated
```bash
cd packages/database
npm run db:generate
```

---

## What's Working Now

✅ **Authentication:**
- User registration
- User login with JWT
- Token verification
- Password change
- Age verification

✅ **Users:**
- User profiles
- Profile updates
- Get user's posts
- Get user's comments
- Alignment calculation

✅ **Spaces:**
- Create spaces
- Get space list (with search)
- Get space details
- Subscribe/unsubscribe
- Update space (mods only)
- Manage rules

✅ **Posts:**
- Create posts (text, link, image, video)
- Get posts (hot, new, top feeds)
- Get posts by space
- Get single post
- Edit posts (author only)
- Delete posts (author or mod)
- **Voting system:**
  - Upvote/downvote
  - Remove vote (click same vote)
  - Change vote (click different vote)
  - Vote scores update in real-time

✅ **Comments:**
- Create comments
- Threaded replies (parent/child comments)
- Get comments for a post (sorted by top, new, old)
- Edit comments (author only)
- Delete comments (author or mod)
- **Comment voting:**
  - Upvote/downvote
  - Remove vote (click same vote)
  - Change vote (click different vote)
  - Vote scores update in real-time

✅ **Hot Score Algorithm:**
- Reddit-style hot ranking formula: `log10(max(|score|, 1)) * sign(score) + (age_in_seconds / 45000)`
- Background job to update scores (every 15 minutes)
- Posts decay over time (12.5 hour half-life)

✅ **Background Jobs:**
- Alignment updates (every 5 minutes)
- Hot score updates (every 15 minutes)

---

## What's Coming Next
- Proper feed sorting

⏳ **Frontend:**
- Space pages
- Post cards
- Feed pages
- Vote buttons
- Comment trees

---

## Database Inspection

Check your database using Prisma Studio:

```bash
cd packages/database
npm run db:studio
```

Opens at: http://localhost:5555

Or use psql:
```bash
psql -U postgres -d voidspace

# List tables
\dt

# Check users
SELECT username, email, alignment FROM users;

# Check spaces
SELECT name, display_name, subscriber_count FROM spaces;

# Check posts
SELECT title, vote_score, hot_score FROM posts;

# Exit
\q
```

---

## Performance Notes

- Alignment updates run every 5 minutes (background job)
- Hot score calculation not yet implemented (coming next)
- Redis is optional for Phase 1-2 (caching will be added in Phase 7)

Happy testing! 🚀

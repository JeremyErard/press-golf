# Press Golf - Project Context

## Overview
Press is a golf betting/side games management app. Players create rounds, add betting games, invite friends, track scores in real-time, and settle up after the round.

## Tech Stack
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Clerk Auth
- **Backend**: Fastify, TypeScript, Prisma ORM
- **Database**: Neon PostgreSQL
- **Hosting**: Vercel (web), Render (API)
- **Auth**: Clerk
- **Payments**: Stripe (subscriptions)
- **Notifications**: Web Push (VAPID)

## Project Structure
```
apps/
  api/           # Fastify backend
    src/
      routes/    # API endpoints (games.ts, rounds.ts, invites.ts, etc.)
      lib/       # Utilities (prisma.ts, notifications.ts, auth.ts)
    prisma/
      schema.prisma  # Database schema
  web/           # Next.js frontend
    src/
      app/       # App router pages
      lib/       # API client, utilities
      components/
```

## Key Commands
```bash
# Install dependencies
npm install

# Run locally (from project root)
npm run dev          # Starts both API (4000) and Web (3001)

# Database
cd apps/api
npx prisma db push   # Push schema changes to database
npx prisma studio    # Open database GUI

# Deploy
git push             # CI/CD auto-deploys to Vercel + Render

# Run edge tests
cd apps/api
npx tsx src/lib/round-game-creation-test.ts
npx tsx src/lib/invitation-flow-test.ts
```

## Game Types (10 total)
1. NASSAU - Front 9, Back 9, Overall (2 players)
2. SKINS - Per-hole winner takes pot (2+ players)
3. MATCH_PLAY - Hole-by-hole match (2 players)
4. WOLF - Rotating wolf picks partner (4 players exactly)
5. NINES - Points-based (3-4 players)
6. STABLEFORD - Points for score vs par (1+ players)
7. BINGO_BANGO_BONGO - First on, closest, first in (3+ players)
8. VEGAS - Team game with digit scoring (4 players exactly)
9. SNAKE - Last 3-putt holds snake (2+ players)
10. BANKER - Rotating banker game (3-4 players)

## Settlement Flow
1. Round completes → Settlements calculated and created
2. Payer marks "I've Paid" → Status: PENDING → PAID
3. Recipient confirms receipt → Status: PAID → SETTLED
4. Notifications sent at each step

## Production URLs
- Web: https://pressbet.golf
- API: https://press-api.onrender.com

## Service Dashboards

### Clerk (Authentication)
- Dashboard: https://dashboard.clerk.com
- Select "press-golf" application
- **Users**: View/manage user accounts, see sign-in activity
- **Sessions**: Debug auth issues, revoke sessions
- **Webhooks**: User sync webhook sends to `/webhooks/clerk` on API
- **API Keys**: `CLERK_SECRET_KEY` (API), `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (Web)

### Vercel (Web Hosting)
- Dashboard: https://vercel.com → press-golf project
- **Deployments**: View deploy history, rollback if needed
- **Logs**: Real-time function logs for debugging
- **Environment Variables**: Clerk keys, API URL config
- **Domains**: pressbet.golf DNS settings
- Auto-deploys on push to main branch

### Render (API Hosting)
- Dashboard: https://dashboard.render.com → press-api service
- **Logs**: View API server logs, error tracking
- **Environment**: All API secrets (DATABASE_URL, Clerk, Stripe, VAPID keys)
- **Manual Deploy**: Can trigger deploy without git push
- **Shell**: SSH into running service for debugging
- Auto-deploys on push to main branch

### Stripe (Subscriptions)
- Dashboard: https://dashboard.stripe.com
- **Products**: "Press Pro" subscription tier
- **Customers**: View subscriber list, payment history
- **Webhooks**: Subscription events → `/webhooks/stripe` on API
- **Test Mode**: Toggle for testing payments without real charges
- **API Keys**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

### Neon (Database)
- Dashboard: https://console.neon.tech
- **SQL Editor**: Run queries directly
- **Branches**: Database branching for testing
- **Connection String**: `DATABASE_URL` in Render env vars

## Environment Files Needed
- `apps/api/.env` - Database, Clerk, Stripe, Anthropic keys
- `apps/web/.env.local` - Clerk keys, API URL

## Database Schema Highlights
- User, Round, RoundPlayer, Game, GamePlayer
- Score (per hole per player)
- Settlement (with PENDING/PAID/SETTLED/DISPUTED status)
- Invite, Buddy relationships
- Course, Tee, Hole data

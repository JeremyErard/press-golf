# Press - Golf Betting App Architecture

> Comprehensive documentation for the Press golf betting application.
> Last updated: January 9, 2026

## Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Monorepo Structure](#monorepo-structure)
4. [Database Schema](#database-schema)
5. [API Reference](#api-reference)
6. [Frontend Architecture](#frontend-architecture)
7. [Game Engine](#game-engine)
8. [Key Features](#key-features)
9. [Environment Setup](#environment-setup)
10. [Deployment](#deployment)

---

## Project Overview

Press is a mobile-first golf betting application that helps golfers track scores, manage betting games, and settle up after rounds. The app supports 10 different golf betting game types with real-time score tracking and automatic settlement calculations.

### Core Features
- **Score Tracking**: Hole-by-hole scoring with photo-based score entry (Claude Vision)
- **10 Betting Games**: Nassau, Skins, Match Play, Wolf, Nines, Stableford, Bingo Bango Bongo, Vegas, Snake, Banker
- **Press System**: Side bets during match play (when 2-down)
- **Handicap Management**: GHIN integration, photo verification, manual entry with approval
- **Settlements**: Auto-calculate who owes whom, track payment status
- **Social Features**: Buddy system, round invites, friend network
- **Course Database**: 18,000+ US courses via GolfCourseAPI, manual entry with AI scraping

---

## Tech Stack

### Backend (apps/api)
| Technology | Purpose |
|------------|---------|
| **Fastify 4** | HTTP framework (faster than Express) |
| **TypeScript** | Type safety |
| **Prisma 5** | ORM and migrations |
| **PostgreSQL** | Database (Neon serverless) |
| **Clerk** | Authentication |
| **Stripe** | Subscription billing |
| **Claude AI** | Vision API for scorecard/handicap parsing |
| **Vercel Blob** | Image storage |

### Frontend (apps/web)
| Technology | Purpose |
|------------|---------|
| **Next.js 14** | React framework (App Router) |
| **TypeScript** | Type safety |
| **Tailwind CSS** | Styling |
| **Clerk** | Authentication UI |
| **Framer Motion** | Animations |
| **Lucide React** | Icons |

### Mobile (apps/mobile)
| Technology | Purpose |
|------------|---------|
| **Expo 54** | React Native framework |
| **Expo Router** | Navigation |
| **Clerk Expo** | Authentication |
| **Zustand** | State management |
| **React Query** | Data fetching |

### Infrastructure
| Service | Purpose |
|---------|---------|
| **Vercel** | Frontend hosting |
| **Render** | API hosting |
| **Neon** | PostgreSQL database |
| **Clerk** | Authentication provider |
| **Stripe** | Payment processing |
| **Vercel Blob** | File storage |

---

## Monorepo Structure

```
press/
├── apps/
│   ├── api/                    # Fastify backend
│   │   ├── prisma/
│   │   │   ├── schema.prisma   # Database schema (555 lines)
│   │   │   └── migrations/     # 8 migrations
│   │   ├── src/
│   │   │   ├── index.ts        # Server entry point
│   │   │   ├── routes/         # API endpoints (~8,000 lines)
│   │   │   │   ├── users.ts
│   │   │   │   ├── courses.ts
│   │   │   │   ├── rounds.ts
│   │   │   │   ├── games.ts    # Largest route (2,720 lines)
│   │   │   │   ├── handicap.ts
│   │   │   │   ├── invites.ts
│   │   │   │   ├── buddies.ts
│   │   │   │   ├── billing.ts
│   │   │   │   ├── webhooks.ts
│   │   │   │   ├── realtime.ts # SSE for live updates
│   │   │   │   └── admin.ts
│   │   │   ├── lib/
│   │   │   │   ├── auth.ts     # Clerk middleware
│   │   │   │   ├── prisma.ts   # Database client
│   │   │   │   ├── errors.ts   # Error handling
│   │   │   │   ├── blob.ts     # File uploads
│   │   │   │   ├── stripe.ts   # Payment client
│   │   │   │   ├── claude.ts   # AI integration
│   │   │   │   ├── course-hero.ts  # Hero image extraction
│   │   │   │   └── game-calculations.ts  # Game engine (25K lines)
│   │   │   └── middleware/
│   │   │       └── rate-limit.ts
│   │   ├── scripts/
│   │   │   └── import-courses.ts  # Batch import from GolfCourseAPI
│   │   └── tests/              # Vitest tests
│   │
│   ├── web/                    # Next.js frontend
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (auth)/     # Sign in/up pages
│   │   │   │   ├── (marketing)/ # Public pages (join invite)
│   │   │   │   └── (app)/      # Protected app pages
│   │   │   │       ├── page.tsx           # Dashboard
│   │   │   │       ├── rounds/            # Round management
│   │   │   │       ├── courses/           # Course browser
│   │   │   │       ├── profile/           # User settings
│   │   │   │       ├── buddies/           # Friend list
│   │   │   │       └── onboarding/        # Setup flow
│   │   │   ├── components/
│   │   │   │   ├── ui/         # Design system
│   │   │   │   ├── layout/     # Header, nav
│   │   │   │   └── [feature]/  # Feature components
│   │   │   └── lib/
│   │   │       ├── api.ts      # Typed API client
│   │   │       ├── sse-client.ts  # Real-time client
│   │   │       └── utils.ts
│   │   └── public/
│   │
│   └── mobile/                 # Expo React Native
│       ├── app/                # Expo Router pages
│       ├── components/
│       └── lib/
│
├── packages/
│   └── shared/                 # Shared TypeScript types
│
├── package.json                # Workspace config
└── .env.local                  # Root env vars
```

---

## Database Schema

### Entity Relationship Overview

```
User
├── PaymentMethod[]        (1:N) - Venmo, Zelle, etc.
├── HomeCourse[]           (N:M) - Favorite courses
├── Buddy[]                (1:N) - Golf friends
├── Round[] (created)      (1:N) - Rounds user created
├── RoundPlayer[]          (1:N) - Rounds user played in
└── Invite[]               (1:N) - Invites sent

Course
├── Tee[]                  (1:N) - Blue, White, Gold, Red
├── Hole[]                 (1:N) - 18 holes
└── Round[]                (1:N) - Rounds played here

Round
├── RoundPlayer[]          (1:N) - Players in round
├── Game[]                 (1:N) - Betting games
├── Settlement[]           (1:N) - Money owed
└── Invite[]               (1:N) - Round invites

Game
├── GameResult[]           (1:N) - Per-player results
├── Press[]                (1:N) - Side bets
├── WolfDecision[]         (1:N) - Wolf game choices
├── VegasTeam[]            (1:N) - Team assignments
├── BingoBangoBongoPoint[] (1:N) - Points per hole
└── BankerDecision[]       (1:N) - Banker rotation
```

### Key Models

#### User
```prisma
model User {
  id                    String    @id @default(cuid())
  clerkId               String    @unique
  email                 String    @unique
  firstName             String?
  lastName              String?
  displayName           String?
  avatarUrl             String?
  phone                 String?

  // Golf
  ghinNumber            String?
  handicapIndex         Decimal?  @db.Decimal(3, 1)
  handicapSource        HandicapSource?
  handicapVerifiedAt    DateTime?
  handicapProofUrl      String?
  handicapApprovalStatus ApprovalStatus?

  // Subscription
  stripeCustomerId      String?
  stripeSubscriptionId  String?
  subscriptionStatus    SubscriptionStatus @default(FREE)
  subscriptionEndsAt    DateTime?
  isFoundingMember      Boolean   @default(false)

  // Onboarding
  onboardingComplete    Boolean   @default(false)
  invitedByCode         String?

  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
}
```

#### Round
```prisma
model Round {
  id          String      @id @default(cuid())
  courseId    String
  teeId       String
  date        DateTime
  status      RoundStatus @default(SETUP)
  inviteCode  String      @unique
  createdById String

  course      Course      @relation(...)
  tee         Tee         @relation(...)
  createdBy   User        @relation(...)
  players     RoundPlayer[]
  games       Game[]
  settlements Settlement[]
}

enum RoundStatus {
  SETUP      // Setting up players and games
  ACTIVE     // Round in progress
  COMPLETED  // Round finished
}
```

#### Game
```prisma
model Game {
  id             String     @id @default(cuid())
  roundId        String
  type           GameType
  betAmount      Decimal    @db.Decimal(10, 2)
  isAutoPress    Boolean    @default(false)
  participantIds String[]   // User IDs in game
  name           String?    // Custom name
  createdById    String

  results        GameResult[]
  presses        Press[]
  wolfDecisions  WolfDecision[]
  vegasTeams     VegasTeam[]
  // ... other game-specific relations
}

enum GameType {
  NASSAU
  SKINS
  MATCH_PLAY
  WOLF
  NINES
  STABLEFORD
  BINGO_BANGO_BONGO
  VEGAS
  SNAKE
  BANKER
}
```

#### Settlement
```prisma
model Settlement {
  id         String           @id @default(cuid())
  roundId    String
  fromUserId String
  toUserId   String
  amount     Decimal          @db.Decimal(10, 2)
  status     SettlementStatus @default(PENDING)
  paidAt     DateTime?

  round      Round            @relation(...)
  fromUser   User             @relation(...)
  toUser     User             @relation(...)
}

enum SettlementStatus {
  PENDING
  PAID
  DISPUTED
}
```

---

## API Reference

### Authentication
All protected endpoints require `Authorization: Bearer <clerk_token>` header.

### Base URL
- Production: `https://api.pressbet.golf`
- Development: `http://localhost:3001`

### Endpoints

#### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/me` | Get current user profile |
| PATCH | `/api/users/me` | Update profile |
| GET | `/api/users/search?q=` | Search users (min 2 chars) |
| POST | `/api/users/me/avatar` | Upload avatar (multipart) |
| POST | `/api/users/me/complete-onboarding` | Mark onboarding done |
| GET | `/api/users/:id/payment-methods` | List payment methods |
| POST | `/api/users/me/payment-methods` | Add payment method |
| DELETE | `/api/users/me/payment-methods/:id` | Remove payment method |

#### Courses
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/courses` | List all courses |
| GET | `/api/courses/discover?lat=&lng=` | Discover nearby courses |
| GET | `/api/courses/:id` | Get course with tees/holes |
| POST | `/api/courses` | Create course manually |
| POST | `/api/courses/fetch-from-url` | Scrape course from website |
| PATCH | `/api/courses/:id` | Update course |
| POST | `/api/courses/:id/refresh-hero` | Re-fetch hero image |

#### Rounds
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rounds` | List user's rounds |
| GET | `/api/rounds/:id` | Get round details |
| POST | `/api/rounds` | Create round (requires subscription) |
| POST | `/api/rounds/join` | Join via invite code |
| PATCH | `/api/rounds/:id/status` | Update status (ACTIVE/COMPLETED) |
| DELETE | `/api/rounds/:id` | Delete round |
| POST | `/api/rounds/:id/scores` | Update hole scores |
| POST | `/api/rounds/:id/scorecard-photo` | Extract scores from photo |
| POST | `/api/rounds/:id/finalize` | Complete and calculate settlements |

#### Games
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/games` | Create game for round |
| GET | `/api/games/:id` | Get game with results |
| POST | `/api/games/:id/wolf-decision` | Record Wolf choice |
| POST | `/api/games/:id/vegas` | Set Vegas teams |
| POST | `/api/games/:id/confirm-results` | Finalize game |
| POST | `/api/games/:id/press` | Initiate press bet |

#### Handicap
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/handicap/extract` | Extract from screenshot (Claude) |
| POST | `/api/handicap/verify` | Verify from official source |
| POST | `/api/handicap/manual` | Submit for approval |
| GET | `/api/handicap/pending-approvals` | Get pending approvals |
| PATCH | `/api/handicap/:id/approve` | Approve/reject |

#### Real-time
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/realtime/subscribe/:roundId` | SSE stream for live updates |

**SSE Events**:
- `score_updated` - Player updated a hole score
- `game_updated` - Game results changed
- `player_joined` - New player joined round
- `round_completed` - Round finalized
- `ping` - Heartbeat (every 30s)

---

## Frontend Architecture

### Page Structure (Next.js App Router)

```
(auth)/                    # Public auth pages
  sign-in/[[...sign-in]]  # Clerk sign-in
  sign-up/[[...sign-up]]  # Clerk sign-up

(marketing)/              # Public marketing
  join/[code]             # Round invite landing

(app)/                    # Protected app (requires auth)
  page.tsx                # Dashboard home

  rounds/
    page.tsx              # List rounds
    new/page.tsx          # Create round wizard
    [id]/
      page.tsx            # Round overview
      scorecard/page.tsx  # Score entry
      settlement/page.tsx # Who owes whom

  courses/
    page.tsx              # Browse/search courses
    add/page.tsx          # Add new course
    [id]/page.tsx         # Course detail

  profile/
    page.tsx              # Profile overview
    edit/page.tsx         # Edit profile
    payment-methods/      # Manage Venmo/Zelle
    subscription/         # Billing

  buddies/page.tsx        # Friend list

  onboarding/
    page.tsx              # Setup flow
    handicap/page.tsx     # Handicap setup
```

### Component Library

#### UI Components (`components/ui/`)
- `button` - Primary, secondary, ghost, danger variants
- `card` - Card, CardContent, CardHeader, CardFooter
- `badge` - Status badges with color variants
- `avatar` - User avatars with fallback initials
- `input` - Form inputs with labels
- `sheet` - Bottom sheet modals
- `skeleton` - Loading states
- `fab` - Floating action button
- `empty-state` - Empty state with illustration
- `tabs` - Tab navigation
- `section-header` - Section titles

#### Design Tokens (Tailwind)
```css
/* Colors */
--background: dark gray base
--surface: slightly elevated
--elevated: cards/modals
--brand: emerald green (#10b981)
--accent: amber
--foreground: white text
--muted: gray text

/* Spacing */
xs: 4px, sm: 8px, md: 12px, lg: 16px, xl: 20px

/* Font Sizes */
hero: 3rem, score: 2.25rem, h1: 1.875rem, body: 1rem, caption: 0.75rem
```

### API Client Pattern

```typescript
// lib/api.ts
export const api = {
  async getRounds(token: string): Promise<Round[]> {
    const res = await fetch(`${API_URL}/api/rounds`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new ApiError(res);
    return res.json();
  },
  // ... 40+ typed methods
};
```

---

## Game Engine

### Supported Games

| Game | Players | Description |
|------|---------|-------------|
| **Nassau** | 2-4 | Front 9 + Back 9 + Overall (3 bets) |
| **Skins** | 2-4 | Win the hole, win a skin |
| **Match Play** | 2 | Holes won vs opponent |
| **Wolf** | 4 | Captain picks partner or goes lone |
| **Nines** | 3-4 | 9 points per hole distributed |
| **Stableford** | 2-4 | Points for scoring (eagle=4, birdie=3, par=2) |
| **Bingo Bango Bongo** | 3-4 | First on, closest, first in (3 pts/hole) |
| **Vegas** | 4 | Teams, combine scores as numbers (4+5=45) |
| **Snake** | 2-4 | Last 3-putt holder pays at end |
| **Banker** | 3-4 | One player banks against all others |

### Press System

A "press" is a new bet that starts mid-match when a player is losing by 2 or more holes:

```typescript
interface Press {
  id: string;
  gameId: string;
  segment: 'FRONT' | 'BACK' | 'OVERALL' | 'MATCH';
  startHole: number;      // Where press starts
  initiatedById: string;  // Who pressed
  status: 'ACTIVE' | 'WON' | 'LOST' | 'PUSHED' | 'CANCELED';
  betMultiplier: number;  // 1x or 2x
  parentPressId?: string; // For press-the-press
}
```

### Calculation Engine

Located in `apps/api/src/lib/game-calculations.ts` (24,755 lines):

```typescript
// Core functions
calculateCourseHandicap(handicapIndex, slopeRating, courseRating, par)
calculateStablefordPoints(strokes, par, handicapStrokes)
calculateNassauResults(scores, betAmount)
calculateSkinsResults(scores, betAmount)
calculateWolfResults(scores, wolfDecisions, betAmount)
// ... 50+ calculation functions

// Extensive test coverage (75,000+ lines of tests)
```

---

## Key Features

### 1. Handicap Verification

Three-tier verification system:

1. **GHIN/USGA** - Official handicap lookup
2. **Photo Verification** - Upload screenshot, Claude extracts handicap
3. **Manual Entry** - Requires round creator approval

```
User uploads screenshot
    ↓
Claude Vision extracts handicap (3.1 precision)
    ↓
Stored as handicapIndex with source=GHIN/USGA/CLUB
    ↓
For manual entries: pending approval workflow
```

### 2. Course Hero Images

Automatic extraction from course websites:

```typescript
// lib/course-hero.ts
async function findAndExtractHeroImage(courseName, city, state, courseId) {
  // 1. Try extracted website URL first
  // 2. Generate possible URLs (.com, .org, .net variants)
  // 3. Fetch HTML, look for golf-related content
  // 4. Extract candidates: og:image, twitter:image, hero images, banners
  // 5. Score by: course-related keywords, image size, file type
  // 6. Try downloading each candidate until success
  // 7. Upload to Vercel Blob, update course record
}
```

Scoring system for image candidates:
- og:image: +30 points
- Hero/banner class: +40 points
- Contains "banner", "portlet": +35 points
- JPG format: +10 points
- Contains logo keywords: -100 points

### 3. Real-time Score Updates

Server-Sent Events for live scoring:

```typescript
// API: /api/realtime/subscribe/:roundId
// Client: lib/sse-client.ts

const client = new SSEClient(roundId, token);
client.on('score_updated', (data) => {
  // { roundPlayerId, holeNumber, strokes, putts }
});
client.connect();
```

### 4. Photo-Based Score Entry

Upload scorecard photo, Claude extracts all scores:

```typescript
// POST /api/rounds/:id/scorecard-photo
// Uses Claude Vision to parse scorecard image
// Returns structured score data for all players
```

---

## Environment Setup

### Required Environment Variables

#### API (`apps/api/.env`)
```bash
# Database (Neon PostgreSQL)
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"
DIRECT_URL="postgresql://user:pass@host/db"  # For migrations

# Authentication
CLERK_SECRET_KEY="sk_live_..."
CLERK_PUBLISHABLE_KEY="pk_live_..."

# AI
ANTHROPIC_API_KEY="sk-ant-..."

# Payments
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_PRICE_ID="price_..."

# Storage
VERCEL_BLOB_READ_WRITE_TOKEN="vercel_blob_..."

# External APIs
GOLF_COURSE_API_KEY="..."  # For course import

# Server
PORT=3001
HOST=0.0.0.0
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
LOG_LEVEL=debug
```

#### Web (`apps/web/.env.local`)
```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_..."
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

### Development Commands

```bash
# Install all dependencies
npm install

# Database
npm run db:push       # Push schema to Neon
npm run db:migrate    # Run migrations
npm run db:studio     # Open Prisma Studio
npm run db:seed       # Seed initial data

# Development
npm run dev:api       # Start API (port 3001)
npm run dev:web       # Start web (port 3000)
npm run dev:mobile    # Start Expo

# Testing
npm run test          # Run tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report

# Type checking
npm run typecheck     # Check all packages
```

---

## Deployment

### Production URLs
- **Web**: https://www.pressbet.golf (Vercel)
- **API**: https://api.pressbet.golf (Render)
- **Database**: Neon PostgreSQL (serverless)

### Render Configuration (API)

```yaml
# render.yaml
services:
  - type: web
    name: press-api
    env: node
    plan: starter
    buildCommand: npm install && npm run build:api
    startCommand: node apps/api/dist/index.js
    envVars:
      - key: NODE_ENV
        value: production
      # ... other env vars from Render dashboard
```

### Vercel Configuration (Web)

- Framework: Next.js
- Build: `npm run build:web`
- Output: standalone
- Root: `apps/web`

### Database Migrations

```bash
# Development (push changes directly)
npm run db:push

# Production (create migration file)
npm run db:migrate

# View database
npm run db:studio
```

---

## Recent Changes (January 2026)

### Hero Image Improvements (commit 32699e2)
- Added .org and .net domain support for course websites
- Improved fallback logic: tries multiple image candidates if first fails
- Added refresh-hero API endpoint for manual re-triggering
- Fixed Blythefield Country Club hero image (og:image was 404)

### Course Import (commit be3f11d)
- GolfCourseAPI integration for batch importing courses
- Script: `apps/api/scripts/import-courses.ts`
- Supports search by name, city, state with limit

### Handicap System (commit 20260102)
- Photo-based handicap verification with Claude Vision
- Manual entry with round creator approval workflow
- GHIN number storage and lookup

---

## Contributing

### Code Style
- TypeScript strict mode (web), non-strict (api)
- ESLint + Prettier formatting
- Path aliases: `@/*` maps to `src/*`

### Testing
- Vitest for API tests
- Focus on game calculation coverage
- Property-based testing for edge cases

### Git Workflow
- Main branch for production
- Feature branches for development
- Commits co-authored with Claude

---

## Support

- **Issues**: https://github.com/JeremyErard/press-golf/issues
- **Email**: Support through app profile page

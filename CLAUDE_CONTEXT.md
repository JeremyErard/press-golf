# Press Golf - Claude Code Context Document

> Last Updated: January 7, 2026
> Use this document to onboard new Claude Code sessions with full project context.

## Project Overview

**Press Golf** is a mobile-first golf betting/wagering app that helps golfers track rounds, manage games (Nassau, Skins, Match Play, etc.), and settle bets with friends.

- **Web App**: Next.js 14 (App Router) at `apps/web/`
- **API**: Fastify at `apps/api/`
- **Database**: Neon PostgreSQL with Prisma ORM
- **Auth**: Clerk
- **Storage**: Vercel Blob (avatars, scorecards, hero images)
- **Hosting**: Vercel (web + API)

## Recent Work Completed (Jan 7, 2026)

### 1. Two-Step Scorecard Capture (Mobile Check Deposit Style)
- **Files**: `apps/web/src/app/(app)/courses/add/page.tsx`
- Users capture FRONT (scoring grid with holes 1-18) then BACK (course info with name/website)
- Clear step labels: "📊 Scoring Grid Side" and "📍 Course Info Side"
- Both images sent to extraction API

### 2. Course Creation from Scorecard Photos
- **API**: `apps/api/src/routes/courses.ts` - `/extract-from-image` endpoint
- Uses Claude Vision (claude-sonnet-4) to extract:
  - Course name, city, state, country, website
  - 18 holes with par AND handicap rank (HDCP/stroke index)
  - Multiple tees with slope/course ratings and yardages
- **Fixed**: Transaction timeout by using `createMany` batch operations instead of individual inserts

### 3. Auto Hero Image Extraction
- **File**: `apps/api/src/lib/course-hero.ts`
- Runs asynchronously after course creation
- Prioritizes extracted website URL from scorecard
- Scores image candidates: penalizes logos/crests, prefers course photos
- Looks for og:image, twitter:image, hero/banner CSS classes, background images
- Uploads to Vercel Blob and updates course record

### 4. Smart Geocoding for International Courses
- **File**: `apps/api/src/lib/geocode.ts`
- Detects US states vs international regions
- For non-US states (Scotland, Ireland, etc.), omits "USA" from search
- Uses OpenStreetMap Nominatim API

### 5. Handicap Screenshot Upload Fix
- **File**: `apps/web/src/app/(app)/onboarding/handicap/page.tsx`
- Now offers both "Choose from Photos" (gallery) and "Take Photo" (camera)
- Previously forced camera only, couldn't select existing screenshots

## Key Architecture

### Database Schema (Prisma)
```
Course -> has many Tees, Holes
Hole -> has many HoleYardages (one per tee)
Tee -> belongs to Course
Round -> belongs to Course, has many RoundPlayers, Games
```

### API Structure
- `apps/api/src/routes/` - Route handlers
- `apps/api/src/lib/` - Utilities (prisma, auth, claude, geocode, blob, course-hero)
- Auth via Clerk JWT in Authorization header

### Frontend Structure
- `apps/web/src/app/(app)/` - Authenticated app routes
- `apps/web/src/components/` - Reusable components
- `apps/web/src/lib/api.ts` - API client with typed methods

## Environment Variables

### API (`apps/api/.env`)
- `DATABASE_URL` - Neon connection string (pooled)
- `DIRECT_URL` - Neon direct connection (for migrations)
- `CLERK_SECRET_KEY`
- `ANTHROPIC_API_KEY`
- `BLOB_READ_WRITE_TOKEN` - Vercel Blob

### Web (`apps/web/.env.local`)
- `NEXT_PUBLIC_API_URL` - API endpoint
- `NEXT_PUBLIC_CLERK_*` - Clerk public keys

## Known Issues / Future Work

1. **Hero Image Quality**: Some sites have logos as og:image. Current solution scores candidates but may still pick suboptimal images.

2. **International Addresses**: Extraction now asks for country, but display still shows "City, State" format. May want "City, Country" for non-US.

3. **Home Course Feature**: Implemented - users can mark courses as "home courses" for quick access and sorting by proximity.

4. **Location-Based Sorting**: Courses sorted by GPS proximity when location available.

## Deployment

Push to `main` triggers Vercel auto-deploy. If build fails, check:
- ESLint errors (unused variables, etc.)
- TypeScript errors
- Run `npm run build --workspace=apps/web` locally to test

## Database Access

Neon SQL Editor: https://console.neon.tech
- Project: press-app
- Can run SQL directly via browser

## Testing Scorecard Extraction

1. Go to Courses > Add (+)
2. Take photo of FRONT (scoring grid with holes)
3. Take photo of BACK (course name/info side)
4. Review extracted data, edit if needed
5. Create Course

## Key Files Reference

| Feature | Files |
|---------|-------|
| Add Course UI | `apps/web/src/app/(app)/courses/add/page.tsx` |
| Course API | `apps/api/src/routes/courses.ts` |
| Hero Image | `apps/api/src/lib/course-hero.ts` |
| Geocoding | `apps/api/src/lib/geocode.ts` |
| Blob Upload | `apps/api/src/lib/blob.ts` |
| API Client | `apps/web/src/lib/api.ts` |
| Prisma Schema | `apps/api/prisma/schema.prisma` |

## Continuation Prompt

When starting a new session, you can say:

> "I'm continuing work on Press Golf. Please read CLAUDE_CONTEXT.md for full project context. [Then describe what you want to work on]"

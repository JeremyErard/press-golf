# Press ⛳️

Golf betting made simple. Track wagers, keep score, settle up.

## Quick Start

### Prerequisites
- Node.js 18+
- npm
- Expo CLI (`npm install -g expo-cli`)

### Setup

1. **Clone and install dependencies:**
   ```bash
   cd press
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   # Copy example env files
   cp apps/api/.env.example apps/api/.env

   # Edit with your keys:
   # - Clerk: clerk.com (free tier)
   # - Neon: neon.tech (free tier)
   ```

3. **Set up database:**
   ```bash
   npm run db:push      # Push schema to Neon
   # or
   npm run db:migrate   # Run migrations (for production)
   ```

4. **Start development:**
   ```bash
   # Terminal 1: Backend
   npm run dev:api

   # Terminal 2: Mobile
   npm run dev:mobile
   ```

5. **Open on your phone:**
   - Install "Expo Go" app
   - Scan the QR code from terminal

## Project Structure

```
press/
├── apps/
│   ├── api/          # Fastify backend
│   └── mobile/       # Expo React Native app
├── packages/
│   └── shared/       # Shared types
└── package.json
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Mobile | React Native + Expo |
| Backend | Node.js + Fastify + Prisma |
| Database | PostgreSQL (Neon) |
| Auth | Clerk |

## Available Scripts

```bash
npm run dev:api      # Start backend
npm run dev:mobile   # Start mobile app
npm run db:studio    # Open Prisma Studio
npm run db:migrate   # Run database migrations
npm run typecheck    # Check TypeScript
```

## Environment Variables

### Backend (`apps/api/.env`)
- `DATABASE_URL` - Neon pooled connection
- `DIRECT_URL` - Neon direct connection
- `CLERK_SECRET_KEY` - From Clerk dashboard
- `CLERK_PUBLISHABLE_KEY` - From Clerk dashboard

### Mobile (`apps/mobile/.env`)
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` - From Clerk dashboard
- `EXPO_PUBLIC_API_URL` - Backend URL (localhost:3000 for dev)

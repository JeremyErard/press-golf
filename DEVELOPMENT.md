# Press Development Quick Reference

## Quick Start

```bash
# Install dependencies
npm install

# Start database (push schema)
npm run db:push

# Start development servers (in separate terminals)
npm run dev:api    # http://localhost:3001
npm run dev:web    # http://localhost:3000
```

## Common Tasks

### Database

```bash
# Push schema changes (dev)
npm run db:push

# Create migration (prod)
npm run db:migrate

# Open Prisma Studio GUI
npm run db:studio

# Seed data
npm run db:seed
```

### Import Courses

```bash
cd apps/api
GOLF_COURSE_API_KEY=your_key npx tsx scripts/import-courses.ts --state "MI" --limit 20
```

### Testing

```bash
npm run test              # Run once
npm run test:watch        # Watch mode
npm run test:coverage     # Coverage report
```

## Key Files

| File | Purpose |
|------|---------|
| `apps/api/prisma/schema.prisma` | Database schema |
| `apps/api/src/routes/*.ts` | API endpoints |
| `apps/api/src/lib/game-calculations.ts` | Game scoring engine |
| `apps/api/src/lib/course-hero.ts` | Hero image extraction |
| `apps/web/src/lib/api.ts` | Frontend API client |
| `apps/web/src/app/(app)/**` | Protected pages |

## API Patterns

### Creating a New Route

```typescript
// apps/api/src/routes/example.ts
import { FastifyPluginAsync } from 'fastify';
import { requireAuth, getUser } from '../lib/auth.js';
import { prisma } from '../lib/prisma.js';
import { badRequest, notFound } from '../lib/errors.js';

export const exampleRoutes: FastifyPluginAsync = async (app) => {
  // Protected endpoint
  app.get('/example', { preHandler: requireAuth }, async (request, reply) => {
    const user = getUser(request);
    const data = await prisma.example.findMany({ where: { userId: user.id } });
    return { success: true, data };
  });

  // Public endpoint
  app.get('/public/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const item = await prisma.example.findUnique({ where: { id } });
    if (!item) return notFound(reply, 'Item not found');
    return item;
  });
};
```

Register in `apps/api/src/index.ts`:
```typescript
import { exampleRoutes } from './routes/example.js';
app.register(exampleRoutes, { prefix: '/api/example' });
```

### Frontend API Call

```typescript
// apps/web/src/lib/api.ts
async getExample(token: string): Promise<Example[]> {
  const res = await fetch(`${API_URL}/api/example`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new ApiError(res);
  return res.json();
}

// In component
import { useAuth } from '@clerk/nextjs';
import { api } from '@/lib/api';

const { getToken } = useAuth();
const token = await getToken();
const data = await api.getExample(token!);
```

### Database Query Patterns

```typescript
// Find with relations
const round = await prisma.round.findUnique({
  where: { id },
  include: {
    course: true,
    tee: true,
    players: {
      include: { user: true, scores: true }
    },
    games: { include: { results: true } }
  }
});

// Create with nested
const round = await prisma.round.create({
  data: {
    courseId,
    teeId,
    date: new Date(),
    inviteCode: generateCode(),
    createdById: user.id,
    players: {
      create: { userId: user.id, position: 1 }
    }
  }
});

// Upsert
await prisma.holeScore.upsert({
  where: {
    roundPlayerId_holeNumber: { roundPlayerId, holeNumber }
  },
  update: { strokes, putts },
  create: { roundPlayerId, holeNumber, strokes, putts }
});
```

## Game Types Reference

| Type | Players | Bet Unit | Description |
|------|---------|----------|-------------|
| NASSAU | 2-4 | Per 9 | Front + Back + Overall |
| SKINS | 2-4 | Per hole | Win hole = win skin |
| MATCH_PLAY | 2 | Per match | Holes won |
| WOLF | 4 | Per hole | Captain picks partner |
| NINES | 3-4 | Per hole | 9 points distributed |
| STABLEFORD | 2-4 | Per round | Points system |
| BINGO_BANGO_BONGO | 3-4 | Per hole | 3 points per hole |
| VEGAS | 4 | Per hole | Team scores combined |
| SNAKE | 2-4 | End of round | Last 3-putt pays |
| BANKER | 3-4 | Per hole | One vs all |

## Environment Variables

### API (Required)
```
DATABASE_URL=postgresql://...
CLERK_SECRET_KEY=sk_...
ANTHROPIC_API_KEY=sk-ant-...
STRIPE_SECRET_KEY=sk_...
VERCEL_BLOB_READ_WRITE_TOKEN=vercel_blob_...
```

### Web (Required)
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Debugging

### API Logs
```bash
# Pretty logs in dev
npm run dev:api  # Uses pino-pretty

# Check specific route
curl -X GET http://localhost:3001/api/rounds \
  -H "Authorization: Bearer $TOKEN"
```

### Database
```bash
# Open GUI
npm run db:studio

# Raw SQL via psql
psql $DATABASE_URL
```

### Render Logs
Dashboard → press-api → Logs

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `UNAUTHORIZED` | Missing/invalid token | Check Clerk session |
| `NOT_FOUND` | Invalid ID | Check resource exists |
| `P2002` (Prisma) | Unique constraint | Check for duplicates |
| `CORS error` | Origin not allowed | Add to CORS config |
| `Rate limited` | Too many requests | Wait or adjust limits |

## Deployment

### API (Render)
1. Push to `main` branch
2. Render auto-deploys
3. Check logs in dashboard

### Web (Vercel)
1. Push to `main` branch
2. Vercel auto-deploys
3. Preview deploys for PRs

### Database Migration (Production)
```bash
# Create migration
npm run db:migrate

# Push (after migration created)
npm run db:push
```

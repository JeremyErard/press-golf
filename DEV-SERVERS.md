# Press Golf App - Development Servers

## Quick Reference

| Service | Port | URL | Directory |
|---------|------|-----|-----------|
| **API Server** | 4000 | http://localhost:4000 | `apps/api` |
| **Web Frontend** | 3001 | http://localhost:3001 | `apps/web` |

> **Note:** Port 3000 is reserved for other projects (SDI Clarity). Press uses 3001 for web.

---

## Starting Dev Servers

### API Server (Fastify + Prisma)

```bash
cd /Users/jeremyerard/Desktop/press/apps/api
npm run dev
```

- Runs on: **http://localhost:4000**
- Health check: http://localhost:4000/health
- API endpoints: http://localhost:4000/api/*

### Web Frontend (Next.js PWA)

```bash
cd /Users/jeremyerard/Desktop/press/apps/web
PORT=3001 npm run dev
```

- Runs on: **http://localhost:3001**
- Uses Clerk for authentication
- Connects to API at localhost:4000

---

## Environment Files

### API (`apps/api/.env`)
- `DATABASE_URL` - Neon PostgreSQL connection
- `CLERK_SECRET_KEY` - Clerk backend auth
- `STRIPE_SECRET_KEY` - Stripe payments
- `FRONTEND_URL` - Set to `http://localhost:3001`

### Web (`apps/web/.env.local`)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk frontend auth
- `NEXT_PUBLIC_API_URL` - Set to `http://localhost:4000/api`

---

## Verifying Servers

```bash
# Check API
curl http://localhost:4000/health

# Check Web (should see "Press - Golf Betting Made Simple" in response)
curl -s http://localhost:3001 | grep -o "<title>.*</title>"
```

---

## Common Issues

### "Port already in use"
Another project may be using the port. Check with:
```bash
lsof -i :3000  # or :3001, :4000
```

### Prisma client not initialized
```bash
cd apps/api && npx prisma generate
```

### Web server on wrong port
Always use `PORT=3001 npm run dev` for the web frontend.

---

## Background Process Management

Dev servers started in background write logs to:
- API: `/tmp/claude/-Users-jeremyerard/tasks/b7a83af.output`
- Web: `/tmp/claude/-Users-jeremyerard/tasks/press-web.output`

To find running processes:
```bash
ps aux | grep "press/apps"
```

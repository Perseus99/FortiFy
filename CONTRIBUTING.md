# Contributing to FortifyFi

This guide is for teammates joining the project. It covers getting the app running locally, understanding the codebase, and deploying changes.

---

## Live app

**Production:** https://forti-fy.vercel.app

Any push to `main` on GitHub automatically triggers a Vercel deployment (1–2 minutes). Watch builds at https://vercel.com (ask for access).

---

## Getting access

Ask the project owner for:

1. **GitHub repo access** — https://github.com/Perseus99/FortiFy
2. **Supabase project access** — for DB and env vars
3. **Anthropic API key** — powers all AI agents (Claude Haiku) and PDF parsing (Claude Sonnet)

---

## Local setup

### 1. Clone and install

```bash
git clone https://github.com/Perseus99/FortiFy.git
cd FortiFy
npm install
```

### 2. Environment variables

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=        # Supabase → Settings → API
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # Supabase → Settings → API
SUPABASE_SERVICE_ROLE_KEY=       # Supabase → Settings → API (secret)
ANTHROPIC_API_KEY=               # console.anthropic.com
ANTHROPIC_MODEL=claude-haiku-4-5-20251001
```

### 3. Database setup

The DB is already configured in the shared Supabase project. If setting up a fresh Supabase project, run these SQL files in order via the SQL Editor:

1. `supabase/schema.sql`
2. `supabase/functions.sql`
3. `supabase/npc_conversations.sql` — required for NPC memory to work

### 4. Run locally

```bash
npm run dev
```

Open http://localhost:3000. Sign up, then either:
- Click **Upload Statement** → download a sample `.txt` from the modal → upload it (fastest)
- Or click **Set Up Account** on the dashboard to seed with synthetic data

---

## Making changes

### Workflow

```bash
git checkout -b your-feature-name
# make changes
git add <files>
git commit -m "describe what you did"
git push origin your-feature-name
# open a PR → merge to main → Vercel auto-deploys
```

### Key files by area

| What you want to change | Where |
|---|---|
| Game visuals, towers, enemies | `components/game/GameScene.ts` |
| Dashboard UI | `app/dashboard/page.tsx` |
| Landing page | `app/page.tsx` |
| Bank statement upload flow | `components/StatementUpload.tsx`, `app/api/upload-statement/`, `app/api/confirm-statement/` |
| NPC personalities | `agents/warden.ts`, `agents/scout.ts`, `agents/architect.ts`, `agents/quartermaster.ts`, `agents/medic.ts` |
| How goals are chosen | `agents/goalAgent.ts` |
| How score → wave difficulty | `agents/gameEngine.ts` |
| Financial scoring | `agents/analyst.ts` |
| Seed data | `app/api/seed/route.ts` |
| Demo statement samples | `public/samples/` |
| Shared types | `lib/types.ts` |
| Shared date utilities | `lib/utils.ts` |
| Category icons | `lib/constants.ts` |
| Sync pipeline | `app/api/weekly-loop/route.ts` |
| Claude API wrapper | `lib/claude.ts` |

### Adding a new API route

```typescript
// app/api/your-route/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { userId } = await req.json()
  const db = createAuthClient(token)
  // your logic
  return NextResponse.json({ ok: true })
}
```

### Adding a new NPC

1. Create `agents/yournpc.ts` — follow the pattern in `agents/warden.ts`
2. Add the type to `NPCType` in `agents/npc.ts`
3. Add the routing case in `runNPCAgent` in `agents/npc.ts`
4. Add config (icon, label, colors) to `NPC_CONFIG` in `components/npc/NPCPopup.tsx`
5. Add a card button on the dashboard in `app/dashboard/page.tsx`

---

## Database

The Supabase project is shared. Avoid raw SQL changes in production — test on a branch first.

### Key tables

| Table | Purpose |
|---|---|
| `profiles` | One row per user |
| `game_state` | Points, city HP, week number, towers placed |
| `weekly_goals` | One row per week per user — goal category, target, score |
| `wave_config` | Enemy wave parameters derived from financial score |
| `transactions` | User transactions (from seed or statement upload) |
| `category_preferences` | User-dismissed goal categories |
| `npc_conversations` | Persistent NPC chat history (JSONB, capped at 20 messages) |

---

## Deployment

Vercel auto-deploys from `main` — just merge a PR.

To check status: Vercel dashboard → FortiFy project → Deployments tab.

Common build failures:
- TypeScript errors — run `npx tsc --noEmit` locally before pushing
- Missing env vars — check Vercel → Settings → Environment Variables

---

## Gotchas

- **All LLM calls go through `lib/claude.ts`** — `chat()` for single-turn agents (Haiku), `chatWithPDF()` for statement parsing (Sonnet), `chatWithHistory()` for NPC conversations (Haiku).
- **`VALID_CATEGORIES` in `lib/types.ts` is the single source of truth** for valid spending categories — `SpendingCategory` is derived from it. Don't add category strings anywhere else.
- **`lib/utils.ts` has all date helpers** (`isoWeekStart`, `addDays`, etc.) — don't redefine them locally in route files.
- **Week progression is date-gated** — syncing twice in the same 7-day window won't advance the week. To force-advance for testing, update `game_state.week_number` directly in Supabase SQL Editor.
- **The game loads in `ssr: false` mode** via `next/dynamic` — Phaser doesn't run server-side.
- **NPC memory requires `npc_conversations.sql`** to be run in Supabase first — if NPC history isn't persisting, that's the likely cause.

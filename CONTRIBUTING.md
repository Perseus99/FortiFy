# Contributing to FortifyFi

This guide is for teammates joining the project. It covers getting the app running locally, understanding the codebase, and deploying changes.

---

## Live app

**Production:** https://forti-fy.vercel.app

Any push to the `main` branch on GitHub automatically triggers a Vercel deployment. It takes 1–2 minutes. You can watch the build at https://vercel.com (ask for access).

---

## Getting access

You need the following — ask the project owner:

1. **GitHub repo access** — https://github.com/Perseus99/FortiFy (read/write)
2. **Supabase project access** — https://supabase.com (for DB and env vars)
3. **Anthropic API key** — for Claude Haiku (the AI agents)
4. **Nessie API key** — https://nessieisreal.com (Capital One sandbox, free)
5. **Vercel access** — optional, only needed if you want to manage deployments

---

## Local setup

### 1. Clone the repo

```bash
git clone https://github.com/Perseus99/FortiFy.git
cd FortiFy
npm install
```

### 2. Environment variables

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=        # from Supabase → Settings → API
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # from Supabase → Settings → API
SUPABASE_SERVICE_ROLE_KEY=       # from Supabase → Settings → API (secret)
NESSIE_API_KEY=                  # from nessieisreal.com
NESSIE_BASE_URL=http://api.nessieisreal.com
ANTHROPIC_API_KEY=               # from console.anthropic.com
ANTHROPIC_MODEL=claude-haiku-4-5-20251001
```

### 3. Database setup

The DB is already set up in the shared Supabase project — you don't need to run the schema again. If you're setting up a brand new Supabase project, run these in order in the SQL Editor:

1. `supabase/schema.sql`
2. `supabase/functions.sql`

Then run this migration if the columns don't exist:

```sql
ALTER TABLE public.weekly_goals
  ADD COLUMN IF NOT EXISTS goal_category text,
  ADD COLUMN IF NOT EXISTS goal_label text;

CREATE TABLE IF NOT EXISTS public.category_preferences (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  category text not null,
  dismissed boolean default false,
  reason text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  UNIQUE(user_id, category)
);
ALTER TABLE public.category_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users can manage own preferences" ON public.category_preferences
  FOR ALL USING (auth.uid() = user_id);
```

### 4. Run locally

```bash
npm run dev
```

Open http://localhost:3000. Sign up, click "Set Up Account", wait ~30s for the data sync, then play.

---

## Making changes

### Workflow

```bash
# Always work on a branch
git checkout -b your-feature-name

# Make your changes, then:
git add <files>
git commit -m "describe what you did"
git push origin your-feature-name

# Open a pull request on GitHub → merge to main → Vercel auto-deploys
```

### Key files by area

| What you want to change | Where |
|---|---|
| Game visuals, towers, enemies | `components/game/GameScene.ts` |
| Dashboard UI | `app/dashboard/page.tsx` |
| Landing page | `app/page.tsx` |
| NPC personalities | `agents/warden.ts`, `agents/scout.ts` |
| How goals are chosen | `agents/goalAgent.ts` |
| How score → wave difficulty | `agents/gameEngine.ts` |
| Transaction categorization | `agents/analyst.ts` |
| Seed data / merchants | `lib/seed.ts` |
| Database types | `lib/types.ts` |
| Sync pipeline | `app/api/weekly-loop/route.ts` |

### Adding a new API route

Create a file at `app/api/your-route/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { data } = await req.json()
  // your logic
  return NextResponse.json({ result: 'ok' })
}
```

### Adding a new NPC

1. Create `agents/yournpc.ts` following the pattern in `agents/warden.ts`
2. Add the type to `NPCType` in `agents/npc.ts`
3. Add the routing case in `runNPCAgent`
4. Add config (icon, colors) to `NPC_CONFIG` in `components/npc/NPCPopup.tsx`

---

## Database

The Supabase project is shared. Be careful with direct SQL changes in production — prefer testing on a branch first.

### Key tables

| Table | Purpose |
|---|---|
| `profiles` | One row per user, links to Nessie account |
| `game_state` | Points, city HP, week number |
| `weekly_goals` | One row per week per user, tracks goal + score |
| `wave_config` | Enemy wave parameters, one per week |
| `transactions` | Cached Nessie transactions, re-synced each week |
| `category_preferences` | User-dismissed goal categories |

### Viewing data

Supabase → Table Editor → select table. You can also run SQL directly in the SQL Editor.

---

## Deployment

Vercel auto-deploys from `main`. You don't need to do anything manually — just merge to main.

To check deployment status: https://vercel.com → FortiFy project → Deployments tab.

If a deployment fails, click it to see the build logs. Common causes:
- TypeScript errors (run `npm run build` locally first to catch these)
- Missing environment variables (check Vercel → Settings → Environment Variables)

---

## Gotchas

- **`lib/claude.ts`** is the Anthropic SDK wrapper. All agent LLM calls go through `chat()` or `chatWithHistory()` from this file.
- **Nessie data is static** — the sandbox doesn't have real weekly transactions. "Syncing" re-scores the same data. This is expected for demo purposes.
- **Week progression** is date-gated — syncing twice in the same 7-day window won't advance the week. To force-advance for testing, update `game_state.week_number` directly in Supabase SQL Editor.
- **The game loads in `no-ssr` mode** via `next/dynamic` — Phaser doesn't work server-side.

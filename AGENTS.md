# Agent instructions for FortiFi

## Next.js version note

This project uses Next.js 16 with the App Router. APIs and conventions may differ from training data — read `node_modules/next/dist/docs/` before writing any Next.js-specific code and heed deprecation notices.

## Project context

FortiFi is a tower defense game driven by real financial data. The architecture has two layers of "agents":

1. **In-game AI agents** (`agents/` directory) — Claude Haiku-powered modules that analyze spending, set goals, and role-play NPCs
2. **Game logic** (`components/game/GameScene.ts`) — Phaser 3 scene, not AI

Live at: https://forti-fy.vercel.app

## Key conventions

- `lib/claude.ts` is the Claude API wrapper (Anthropic SDK). Three exports:
  - `chat(system, user)` — single-turn, Haiku model, used by all agents
  - `chatWithPDF(system, pdfBase64, user)` — PDF document parsing, Sonnet model, used by `/api/upload-statement`
  - `chatWithHistory(system, messages[])` — multi-turn, Haiku model, used by NPC agents
- All Supabase calls use either the public anon client (`lib/supabase.ts`) or the auth client (`createAuthClient(token)`) depending on whether RLS matters.
- API routes live in `app/api/`. All routes that touch user data require a Bearer token and use `createAuthClient`.
- The Phaser game scene (`components/game/GameScene.ts`) is loaded client-side only via `next/dynamic` with `ssr: false`.

## Agent pipeline

```
upload-statement  →  confirm-statement
                         ├─ runAnalystAgent       (agents/analyst.ts)
                         ├─ buildPlayerContext    (agents/contextAgent.ts)
                         ├─ runGoalAgent          (agents/goalAgent.ts)
                         └─ runGameEngineAgent    (agents/gameEngine.ts)

/api/weekly-loop  →  same four agents (runs on-demand sync or end-of-week close)

/api/npc          →  agents/npc.ts  →  routes to warden/scout/architect/quartermaster/medic
```

## NPC roster

| NPC | Trigger | Persona |
|-----|---------|---------|
| ⚔️ The Warden | Always available; highlighted when over budget | Financial Enforcer — militaristic, disciplined |
| 🔍 The Scout | Always available; highlighted when flagged txns exist | Spending Investigator — flags merchants, recurring charges |
| 📐 The Architect | Always available | Savings Strategist — savings rate, income allocation, runway |
| 📦 The Quartermaster | Always available | Budget Allocator — category-by-category 50/30/20 audit |
| 🏥 The Medic | Post-game triage only (HP = 0 scenario) | Recovery Specialist — 1–2 repair actions, loss-only |

NPC conversations are persisted in the `npc_conversations` Supabase table (JSONB, capped at 20 messages per NPC). The `npc_conversations.sql` migration must be run in the Supabase SQL Editor before this feature works.

## Statement upload flow

`components/StatementUpload.tsx` → modal with three steps:
1. **Picker** — select period (W1 / Mid-Week / W2), upload PDF or TXT
2. **Preview** — Claude parses the file, shows categorised transactions
3. **Confirm** — `/api/confirm-statement` wipes old data, inserts transactions, runs the full agent pipeline

Sample statements live in `public/samples/` as `.txt` files that can be uploaded directly (no PDF conversion needed).

## Key database tables

`profiles`, `transactions`, `game_state`, `weekly_goals`, `wave_config`, `category_preferences`, `npc_conversations`

## What not to change without reading first

- `supabase/schema.sql` — any schema change requires a matching SQL migration run in Supabase
- `supabase/functions.sql` — RPC functions must be re-run in Supabase SQL Editor after changes
- `supabase/npc_conversations.sql` — must be run once to enable NPC memory
- `lib/types.ts` — changes here affect all agents, API routes, and components; update all usages
- `agents/goalAgent.ts` — contains a `VALID_CATEGORIES` whitelist; merchant names must never leak in as goal categories

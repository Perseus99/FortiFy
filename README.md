# FortiFi

A tower defense game where your real spending habits determine how hard the enemy waves hit. Save more, defend better.

**Live app:** https://forti-fy.vercel.app

---

## How it works

1. **Upload your statement** — upload a bank statement PDF or TXT, or use the built-in demo samples
2. **AI analysis** — Claude parses transactions, categorizes spending, and calculates a weekly financial score (0–100)
3. **Goal Agent** — identifies your riskiest spending category and sets a targeted reduction goal
4. **Play the game** — your score sets the enemy wave difficulty. Good spending = easy wave. Overspending = relentless horde
5. **NPC advisors** — 5 AI advisors debrief you with personalized feedback based on your spending history

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend + API | Next.js 16 (App Router) |
| Game engine | Phaser 4 |
| Database + Auth | Supabase (Postgres + RLS) |
| AI agents | Claude Haiku (agents) + Claude Sonnet (PDF parsing) via Anthropic SDK |
| Deployment | Vercel (auto-deploy from `main`) |

---

## Agent architecture

| Agent | File | Purpose |
|---|---|---|
| Analyst | `agents/analyst.ts` | Categorizes transactions, calculates financial score (0–100) |
| Context | `agents/contextAgent.ts` | Builds week-over-week player history for NPC and goal memory |
| Goal Agent | `agents/goalAgent.ts` | Picks riskiest spending category, sets weekly reduction target |
| Game Engine | `agents/gameEngine.ts` | Converts score → wave difficulty, updates game state |
| The Warden | `agents/warden.ts` | NPC — strict budget enforcer, militaristic tone |
| The Scout | `agents/scout.ts` | NPC — flags suspicious transactions and recurring charges |
| The Architect | `agents/architect.ts` | NPC — savings rate, income allocation, financial runway |
| The Quartermaster | `agents/quartermaster.ts` | NPC — 50/30/20 category budget audit |
| The Medic | `agents/medic.ts` | NPC — post-loss triage, 1–2 concrete repair actions |

---

## Game mechanics

### Towers
| Tower | Cost | Damage | Speed | Special |
|---|---|---|---|---|
| Archer | 50 pts | 20 | Fast | — |
| Cannon | 120 pts | 60 | Slow | Splash damage |

### Enemy types
| Enemy | HP | Speed | City damage |
|---|---|---|---|
| Foodie 🍔 | Low | Normal | 15 |
| Impulse Buyer 🛍️ | Very low | Fast | 10 |
| Subscription Creep 📱 | High | Slow | 25 |
| Night Owl 🎬 | Medium | Fast | 15 |
| Debt Collector 💳 | Very high | Slow | 35 |

### Wave difficulty
| Financial score | Enemies | Speed multiplier |
|---|---|---|
| 80–100 | 8 | 0.8× |
| 50–79 | 14 | 1.2× |
| 0–49 | 20 | 1.6× |

### Goal rewards
| Outcome | Effect |
|---|---|
| Crush it (under 80% of target) | +75 pts, +10 HP |
| Hit target (under 100%) | +50 pts, +5 HP |
| Close miss (within 120%) | No change |
| Missed by 20–50% | −10 HP |
| Missed by 50%+ | −20 HP |

---

## Project structure

```
agents/                   AI agent logic
  analyst.ts              Financial scoring
  contextAgent.ts         Week-over-week player history
  goalAgent.ts            Goal selection
  gameEngine.ts           Wave config
  warden|scout|architect|quartermaster|medic.ts  NPC agents
app/
  api/
    upload-statement/     PDF/TXT → Claude parse → transaction preview
    confirm-statement/    Apply parsed transactions, run full agent pipeline
    weekly-loop/          On-demand sync + week close logic
    npc/                  NPC chat endpoint (persists to DB)
    npc-history/          Load persisted NPC conversation
    feedback/             Goal dismissal + recalculation
    seed/                 Seed synthetic transaction data
  dashboard/              Main dashboard page
  game/                   Game page
  login/ signup/          Auth pages
components/
  game/                   Phaser scene (GameScene.ts) + React wrapper (GameCanvas.tsx)
  npc/                    NPCPopup chat UI
  StatementUpload.tsx     Upload modal (period picker → parse → confirm)
lib/
  claude.ts               Anthropic SDK wrapper (chat / chatWithPDF / chatWithHistory)
  supabase.ts             Supabase clients (anon + auth)
  types.ts                Shared TypeScript types + VALID_CATEGORIES
  utils.ts                Date utilities (isoWeekStart, addDays, etc.)
  constants.ts            Shared UI constants (CAT_ICONS)
public/
  samples/                Demo statement TXT files (week1, week1half, week2)
supabase/
  schema.sql              DB tables + RLS policies
  functions.sql           Postgres RPC functions
  npc_conversations.sql   NPC memory table (run after schema.sql)
  fix_week_dates.sql      One-time date migration utility
```

---

## Contributing

See `CONTRIBUTING.md` for local setup, environment variables, and how to make changes.
See `TESTING.md` for a full demo walkthrough and testing checklist.

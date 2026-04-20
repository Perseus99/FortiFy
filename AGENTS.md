# Agent instructions for FortifyFi

## Next.js version note

This project uses Next.js 16 with the App Router. APIs and conventions may differ from training data — read `node_modules/next/dist/docs/` before writing any Next.js-specific code and heed deprecation notices.

## Project context

FortifyFi is a tower defense game driven by real financial data. The architecture has two layers of "agents":

1. **In-game AI agents** (`agents/` directory) — Claude Haiku-powered modules that analyze spending, set goals, and role-play NPCs
2. **Game logic** (`components/game/GameScene.ts`) — Phaser 3 scene, not AI

## Key conventions

- `lib/claude.ts` is the Claude API wrapper (Anthropic SDK). All agent LLM calls go through `chat()` or `chatWithHistory()` exported from there.
- All Supabase calls use either the public anon client (`lib/supabase.ts`) or the auth client (`createAuthClient(token)`) depending on whether RLS matters.
- API routes live in `app/api/`. All routes that touch user data require a Bearer token and use `createAuthClient`.
- The Phaser game scene (`components/game/GameScene.ts`) is loaded client-side only via `next/dynamic` with `ssr: false`.

## What not to change without reading first

- `supabase/schema.sql` — any schema change requires a matching SQL migration run in Supabase
- `supabase/functions.sql` — RPC functions must be re-run in Supabase SQL Editor after changes
- `lib/types.ts` — changes here affect all agents, API routes, and components; update all usages

# Carza — Project Rules for Claude Code

You are working on **Carza**, a local-first car community app (social feed, reels, events).
Mahdy is the lead developer. Treat this file as law. If a request conflicts with it, say so before acting.

## Product (what we're building)
**Launch app (decided 2026-10-27): exactly three tabs. Build ONLY this until told otherwise:**
- **Feed** — Threads-style social feed: text + photo posts, likes, replies, follows, profiles.
- **Reels** — short vertical car videos you swipe through.
- **Events** — anyone can host a car event (meet, cruise, show); others RSVP.
- Auth (email/password, Apple, Google) and profiles carry over.

**Parked (built, but switched off for launch):** marketplace (listings, search, selling), dealer pages and
dealer dashboard, messaging, test drives. The code stays; `HIDDEN_FOR_LAUNCH` in
`apps/web/src/lib/route-guard.ts` makes those routes 404. Don't extend parked features unless asked.

Do NOT build other features or "prepare" for them with speculative code. Keep schemas extensible, nothing more.

Launch strategy: **one metro first, then national (one country).** Never hardcode a city. Location/radius matters (nearby events), not an afterthought.

## Stack
- Monorepo: **pnpm + Turborepo**
- `apps/web` — **Next.js (App Router) + TypeScript (strict) + Tailwind + shadcn/ui**. The app (Feed, Reels, Events) plus the parked marketplace and dealer dashboard.
- `apps/mobile` — Expo (React Native). **Not yet. Do not create.**
- `packages/shared` — Zod schemas, types, pure business logic (must be reusable by mobile later)
- `packages/db` — generated Supabase types + typed query helpers
- `supabase/` — migrations, seed, config (Supabase CLI)
- Backend: **Supabase** (Postgres, Auth, Storage, Realtime, Edge Functions)
- Hosting: **Vercel**
- Email: **Resend**
- Tests: **Vitest** (unit/integration), **Playwright** (e2e)

## Hard rules
1. **Security first.**
   - Every table has **RLS enabled** with explicit policies. No exceptions.
   - The `service_role` key is NEVER used in client code or anything shipped to the browser. Server-only, and only when RLS genuinely can't express the rule.
   - Every Server Action and Route Handler verifies the user (`supabase.auth.getUser()`) and authorizes the action. Never trust IDs from the client.
   - Validate ALL input at the boundary with Zod (from `packages/shared`).
   - Never read, print, or commit `.env*` files or secrets. Use `.env.example` for variable names.
2. **Database changes only through migration files** in `supabase/migrations/`. Never change schema through the dashboard or MCP. After a migration, regenerate types into `packages/db`.
3. **Mobile-ready:** business logic and validation live in `packages/shared`, not inside React components.
4. **TypeScript strict.** No `any`, no `@ts-ignore` without a comment explaining why.
5. **Small, focused changes.** One feature or fix per branch/PR. Branch names: `feat/...`, `fix/...`, `chore/...`. Conventional commits.
6. **Ask before** adding a dependency, changing the stack, or touching auth/payment flows.
7. **Less code wins.** Prefer deleting/reusing over adding. No premature abstraction.
8. Never push to `main` directly. Never force-push. Never run destructive commands against a linked remote database.

## Commands
- `pnpm dev` — run web app
- `pnpm typecheck` / `pnpm lint` / `pnpm test` / `pnpm test:e2e` / `pnpm build`
- `supabase migration new <name>` — new migration
- `supabase db reset` — reset LOCAL db + seed
- `pnpm db:types` — regenerate Supabase types

## Environments
- Supabase: `carza-dev` (connected via MCP, read-only) and `carza-prod` (never touched by Claude).
- Vercel: Preview deploys per PR, Production from `main`.

## How to work
- New feature → use the `build-feature` skill.
- Bug → use the `fix-bug` skill (reproduce with a failing test first).
- Schema change → use the `db-migration` skill.
- Before opening a PR → `/ship`.
- Delegate to agents: `debugger`, `code-simplifier`, `security-auditor`, `test-writer`, `code-reviewer`, `db-architect`.

## Definition of done
Typecheck, lint, tests, and build pass. RLS policies exist and are tested for any new table. Security auditor found no high/critical issues. Code simplifier pass done. PR opened with a clear description.

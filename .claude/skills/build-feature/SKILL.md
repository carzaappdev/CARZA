---
name: build-feature
description: End-to-end workflow for building a new Carza feature — plan, schema, code, tests, security, simplify, PR. Use whenever Mahdy asks to build or add a feature.
---

# Build a Carza feature

Follow these steps in order. Don't skip ahead.

## 1. Scope check
- Confirm the feature is **Phase 1** in CLAUDE.md. If it's Phase 2/3, stop and say so.
- Restate the feature in 2–3 sentences: who uses it (consumer / dealer / both), what they can do, what "done" looks like.
- List anything ambiguous and ask Mahdy **before** writing code. Max 3 questions.

## 2. Plan
Write a short plan:
- Data: tables/columns/policies needed (delegate design to the `db-architect` agent if schema changes)
- Shared: Zod schemas + logic going in `packages/shared`
- Server: Server Actions / Route Handlers
- UI: pages/components, including loading, empty, and error states
- Tests: what will prove it works
Wait for Mahdy's OK if the plan touches auth, payments, or more than ~10 files.

## 3. Branch
`git checkout -b feat/<short-name>` from an up-to-date `main`.

## 4. Build in this order
1. Migration (use the `db-migration` skill) → `pnpm db:types`
2. `packages/shared` schemas + logic, with unit tests
3. Server Actions / Route Handlers (auth check + Zod validation in every one)
4. UI (Server Components by default; `"use client"` only where needed)

Commit after each step with a conventional commit message.

## 5. Verify
Run `pnpm typecheck && pnpm lint && pnpm test && pnpm build`. Fix failures (delegate to `debugger` if the cause isn't obvious).

## 6. Hardening
In parallel:
- `test-writer` agent → RLS tests + action tests + e2e if it's a critical flow
- `security-auditor` agent → fix every Critical/High

Then `code-simplifier` agent on the branch.

## 7. Ship
Run the `ship` skill.

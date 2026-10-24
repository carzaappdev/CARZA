---
name: db-migration
description: Safe workflow for any Carza database schema change — new tables, columns, indexes, RLS policies, functions, storage buckets. Use whenever the Supabase schema needs to change.
---

# Carza database migration

## Rules
- Schema changes ONLY via files in `supabase/migrations/`. Never via the dashboard or MCP write tools.
- Never run `supabase db push`, `db reset --linked`, or any command against a remote project. Mahdy applies migrations to `carza-dev` and `carza-prod`.

## Steps
1. If the change involves new tables or relationships, have the `db-architect` agent design it first and show Mahdy the plain-English summary.
2. `supabase migration new <descriptive_snake_case_name>`
3. Write the SQL. Every new table in the same file must include:
   - `alter table ... enable row level security;`
   - policies for each operation it needs (select / insert / update / delete), written as narrowly as possible
   - indexes for filtered/sorted/joined columns
   - `updated_at` trigger if the table has `updated_at`
4. Prefer additive changes. For destructive changes (drop/rename column), stop and get Mahdy's explicit OK, and write a plan for existing data.
5. `supabase db reset` (local) — must succeed with seed data.
6. `pnpm db:types` — regenerate types; fix any type errors.
7. Add/update RLS tests (delegate to `test-writer`).
8. Commit: `feat(db): <what changed>`.
9. Tell Mahdy: "Migration ready. To apply to dev: `supabase link --project-ref <dev-ref> && supabase db push`." Then, once applied, check Supabase advisors via MCP and report any security/performance warnings.

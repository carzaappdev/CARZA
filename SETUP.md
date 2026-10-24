# Carza — Claude Code Setup (do this before writing any code)

Total time: about 45 minutes. Do it in order.

---

## 0. Security first (5 min)
- [ ] Change the Gmail and Supabase passwords that were shared in chat. Use different passwords.
- [ ] Turn on 2FA for Google, GitHub, Supabase, and Vercel.
- [ ] Put all passwords in a password manager (1Password, Bitwarden). Never paste them into Claude or Claude Code.

## 1. Install tools (10 min)
```bash
# Node 20+ and pnpm
corepack enable && corepack prepare pnpm@latest --activate

# Claude Code
npm install -g @anthropic-ai/claude-code

# GitHub CLI, Supabase CLI, Vercel CLI (macOS shown; use your OS's installer otherwise)
brew install gh supabase/tap/supabase
npm install -g vercel

# Docker Desktop (needed for local Supabase) — install from docker.com
```

## 2. GitHub (5 min)
```bash
gh auth login            # pick GitHub.com → HTTPS → browser login
mkdir carza && cd carza
git init -b main
gh repo create carza --private --source=. --remote=origin
```
In GitHub → repo **Settings → Branches**, add a rule for `main`: require a pull request before merging. This is what stops anyone (including Claude) from pushing straight to `main`.

Claude Code uses the `gh` CLI for GitHub, so there's no separate GitHub connection to set up.

## 3. Drop in this kit (2 min)
Copy everything from this folder into the `carza/` repo root:
```
carza/
├── CLAUDE.md            ← project rules Claude Code reads every session
├── .mcp.json            ← Supabase + Vercel connections
├── .env.example
└── .claude/
    ├── settings.json    ← permissions (blocks .env reads, force-push, remote DB pushes)
    ├── agents/          ← debugger, code-simplifier, security-auditor, test-writer, code-reviewer, db-architect
    └── skills/          ← build-feature, fix-bug, db-migration, ship
```
Add a `.gitignore` with at least:
```
node_modules
.env
.env.*
!.env.example
.vercel
.turbo
.next
supabase/.temp
```
Commit: `git add -A && git commit -m "chore: claude code setup" && git push -u origin main`
(This is the one time you push to main directly, before the branch rule bites.)

## 4. Supabase (10 min)
1. In the Supabase dashboard, create **two** projects: `carza-dev` and `carza-prod`. Same region, close to your launch city.
2. Open `carza-dev` → **Project Settings → General** → copy the **Project ID** (the "project ref").
3. In `.mcp.json`, replace `YOUR_DEV_PROJECT_REF` with it. The project ref isn't a secret.
4. The connection is **scoped to dev only** and **read-only**. Claude can inspect tables, logs, and advisors, but can't change anything. Schema changes go through migration files that you apply. Never point the MCP at prod.
5. `supabase login` then `supabase init` in the repo.

## 5. Vercel (5 min)
1. Sign in to vercel.com with GitHub. **Add New → Project →** import the `carza` repo. (It'll fail to build until the app exists. That's fine.)
2. In the terminal: `vercel login` and `vercel link`.
3. Later, add env vars in Vercel → Project → Settings → Environment Variables. Preview = dev keys, Production = prod keys.

## 6. Connect Claude Code (5 min)
```bash
cd carza
claude
```
Inside Claude Code:
1. It will ask to approve the project's MCP servers from `.mcp.json` → approve.
2. Type `/mcp` → select **supabase** → Authenticate (browser login, choose the org with carza-dev).
3. `/mcp` → **vercel** → Authenticate.
4. Type `/agents` — you should see the 6 agents.
5. Type `/ship` — it should be recognized as a skill (then cancel; nothing to ship yet).

## 7. Smoke test
Paste this into Claude Code:
> Read CLAUDE.md. Then: list my Supabase dev tables via MCP (should be empty), list my Vercel projects via MCP, and run `gh repo view`. Confirm all three connections work. Don't change anything.

All three green → you're ready for the first build prompt (monorepo scaffold).

---

## Cheat sheet: what to use when
| You want to… | Say / type |
|---|---|
| Build a feature | "Use build-feature to add <feature>" |
| Fix something broken | "Use fix-bug: <paste error + steps>" |
| Change the database | "Use db-migration to <change>" |
| Find a weird bug | "Use the debugger agent on <problem>" |
| Shrink bloated code | "Run code-simplifier on this branch" |
| Security check | "Run security-auditor on this branch" (or the whole repo) |
| Write tests | "Use test-writer for <feature>" |
| Open a PR | `/ship` |

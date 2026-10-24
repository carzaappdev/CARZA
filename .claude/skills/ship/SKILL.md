---
name: ship
description: Pre-PR checklist and PR creation for Carza. Run with /ship when a branch is ready for review. Runs all checks, security audit, and opens a GitHub PR.
disable-model-invocation: true
---

# Ship it

Stop at the first failure, fix it (or report it), and restart the checklist.

1. **Branch check:** not on `main`. Working tree clean (commit anything pending with a conventional commit).
2. **Sync:** `git fetch origin && git rebase origin/main`. Resolve conflicts carefully; ask if unsure.
3. **Checks:** `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
4. **Secrets scan:** `git diff origin/main...HEAD` must contain no keys, tokens, passwords, or `.env` files.
5. **Reviews (in parallel):** `security-auditor` and `code-reviewer` agents on the branch. Any Critical/High security finding or "Request changes" verdict = fix first.
6. **Push:** `git push -u origin HEAD` (never force-push).
7. **PR:** `gh pr create --base main` with:
   - Title: conventional commit style
   - Body: **What** (user-facing change), **Why**, **How** (key decisions), **DB changes** (migrations + whether Mahdy must apply them), **Testing** (what ran), **Screenshots** for UI changes (ask Mahdy), **Security notes**
8. Report the PR link and remind Mahdy to check the Vercel preview deploy on the PR.

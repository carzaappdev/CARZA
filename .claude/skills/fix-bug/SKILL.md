---
name: fix-bug
description: Workflow for fixing a bug in Carza — reproduce with a failing test, find root cause, minimal fix, verify. Use whenever something is broken, erroring, or behaving wrong.
---

# Fix a Carza bug

1. **Branch:** `git checkout -b fix/<short-name>` from up-to-date `main`.
2. **Get the facts:** exact error, steps to reproduce, where it happens (local / Vercel preview / production), when it started. Ask Mahdy for anything missing.
3. **Delegate to the `debugger` agent** with everything from step 2. It must return the root cause with evidence.
4. **Failing test first:** make sure a test reproduces the bug and fails before the fix (use `test-writer` if needed).
5. **Minimal fix.** No refactors bundled in.
6. **Verify:** the new test passes, and `pnpm typecheck && pnpm lint && pnpm test && pnpm build` are green.
7. If the bug touched auth, RLS, or data exposure → run `security-auditor` on the branch.
8. **Ship** with the `ship` skill. PR description must include root cause + how it was verified.

Never close a bug by disabling RLS, skipping a test, catching and ignoring the error, or adding `any`.

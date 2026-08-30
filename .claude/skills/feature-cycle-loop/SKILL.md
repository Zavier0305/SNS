---
name: feature-cycle-loop
description: Autonomously build out this project in repeated cycles — each cycle brainstorms a batch of new features (default 10), implements them fully end-to-end (DB migrations + working UI, no stubs), verifies lint/build/security, deploys, confirms the deployment is live, and logs the cycle in chat before starting the next one. Use this whenever the user asks to "keep implementing", "run N cycles of M features", "continue building the app on your own", or gives an open-ended instruction like "実装し続けて" / "機能を追加し続けて" / "サイクルを回して" / "自動でどんどん実装して" — including when they want this repeated many times unattended and just want a log left in the chat as it goes. Also consult this skill mid-loop if the user reports a live bug in the deployed app, since it defines how to pause, reproduce, fix, and resume safely.
---

# Feature Cycle Loop

Turns a single "keep adding features" request into a disciplined, repeatable loop: pick a batch of features → implement them completely → verify → ship → confirm it's live → report back → repeat. The loop is what lets this run unattended for many cycles without drifting into half-finished work or silent breakage.

This was distilled from actually running 10 cycles (100 features) end-to-end on this Next.js + Supabase + Vercel app, including two real incidents (a security regression and a production crash) that shaped the checklists below. Follow the checklists — they exist because skipping them is exactly what caused those incidents.

## Before the first cycle

Nail down four things. If the user's request already answers one, don't re-ask it.

1. **Cycle count and features per cycle.** Default to 10 cycles × 10 features if the user doesn't say (that's the shape this was proven at). A smaller ask ("do 3 rounds of 5") is fine too — just carry the numbers through everything below.
2. **Target branch.** Use the branch already checked out, or one the user names. Never invent a new branch unless asked.
3. **Starting cycle number.** Run `git log --oneline` and look for prior commits matching `Cycle N/M: ...`. If found, resume at `N+1` and keep using the same `M` (total) unless the user changed it. If none exist, this is Cycle 1.
4. **Hard product constraints.** Read `CLAUDE.md`/`AGENTS.md` and skim recent conversation for decisions that must never be violated by a "helpful" feature idea — e.g. this project's explicit "no DM/private-chat feature" rule (kept specifically to stay outside Japan's 電気通信事業法 notification requirement). Every cycle's brainstorm must respect these, not just the first one.

State the plan back in one or two sentences (cycle count, features/cycle, starting number, branch) before starting, then proceed without waiting for further confirmation — the user asked for an autonomous loop, so don't stall on approval for each cycle.

## The per-cycle procedure

Do these steps in order for every cycle. Don't skip ahead to implementation before picking the features, and don't push before verification passes.

### 1. Pick the features

Brainstorm a batch that is genuinely new — grep prior `Cycle N/M` commit messages (`git log --grep "Cycle"`) so you don't re-propose something already shipped. Favor a mix: a couple of real DB-backed features, a couple of pure client/UX polish items, at least one moderation/safety or correctness item once the app has users generating content. State the picked list in chat before implementing (this is the "log" the user wants — see Logging below).

### 2. Implement each feature completely

No stubs, no "TODO: wire this up later." A feature isn't done until its DB migration (if any) and its UI are both working together. For each feature that touches the database:

- Apply migrations via the project's DB MCP tool (e.g. `mcp__Supabase__apply_migration`), one focused migration per logical change, named descriptively.
- **If a migration uses `CREATE OR REPLACE VIEW` (or otherwise recreates a view), explicitly carry forward `security_invoker = true`** (or set it via `ALTER VIEW ... SET (security_invoker = true)` immediately after). Recreating a view resets this to the insecure default, which makes the view run with the *creator's* privileges instead of the querying user's — silently bypassing RLS. This bit a real cycle here; don't let it happen again.
- Update the app's hand-maintained DB types file to match the new schema exactly. When in doubt about drift, regenerate types from the live schema (e.g. `mcp__Supabase__generate_typescript_types`) and re-curate rather than hand-guessing columns — a stale types file caused a real bug this way (a table used in code but missing from the types entirely).
- After **every** migration, run the DB security advisor (e.g. `mcp__Supabase__get_advisors` with `type: "security"`) and confirm no new `ERROR`-level finding appeared and no unexplained new `WARN`. A handful of expected WARNs (e.g. "public can execute this RPC" for RPCs that are deliberately public-callable) is normal — know your baseline and watch for anything new.

For features that add a new realtime subscription, background hook, or anything a shared layout component (header/nav) might *also* mount: check whether that hook/subscription could end up mounted twice on the same page (e.g. once in a shared header, once in the page itself). Some realtime client libraries dedupe by topic and throw if a second consumer tries to bind callbacks after the first has already subscribed — this caused a real production crash here. Either avoid the double-mount, or make the hook itself safe to call more than once.

### 3. Verify before shipping

Run the project's lint and build/typecheck to a clean state — for this app that's `npx eslint .` and `npx next build`, iterating until both are clean. A clean build is not optional evidence the feature works; it's the minimum bar. Don't rely on "it compiled" alone if the feature is DB-driven — re-read the RLS policies touched (`select policyname, cmd, qual, with_check from pg_policies where tablename = '...'`) when a migration adds a table/column a UI action will write to, so you're not shipping a button that will 403 in production.

Also run `node tests/smoke.mjs` (against a locally running `next dev`/`next start`, with `PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium` set in this sandbox) whenever a cycle touches shared components (Header, layout, any hook mounted on multiple pages) — it mocks every Supabase call and visits every top-level route checking for the route error boundary or an uncaught exception. This is what would have caught the /notifications double-subscription crash before it shipped; extend this file's route list when a cycle adds a new top-level page.

**Run the performance advisor too, not just security.** `mcp__Supabase__get_advisors` with `type: "performance"` catches things `type: "security"` won't: RLS policies calling `auth.uid()` unwrapped (re-evaluated per row — wrap as `(select auth.uid())`), foreign keys without a covering index, and multiple permissive policies on the same table/action/role that should be consolidated into one. A whole 10-cycle run of this project skipped this check entirely and accumulated 42 unwrapped-auth-uid policies and 23 missing indexes before anyone looked — don't repeat that. Run it after any migration that adds a table, FK, or RLS policy, the same way you'd run the security one.

### 4. Confirm the previous cycle actually deployed before or after pushing this one

Before starting a new cycle's work (or right after pushing it), check the hosting platform's deployment list (e.g. `mcp__Vercel__list_deployments` for the project) and confirm the *previous* cycle's commit reached `READY`. If it's still building, that's fine — check again shortly (`ScheduleWakeup` with a short delay, not a blocking sleep) rather than stacking more unverified pushes on top of a broken one.

### 5. Commit and push

One commit per cycle. Message format that worked well:
- First line: `Cycle N/M: <short theme of the batch>`
- Body: one paragraph per notable feature (or a few sentences each) explaining *what* it does and *why*, plus a separate paragraph for any incidental fix made along the way (schema drift, a bug noticed while building something else) — don't bury a real fix inside a feature bullet where it'll get lost.
- Push to the target branch established at the start (`git push -u origin <branch>`).

### 6. Log the cycle in chat

After pushing, send a short chat message: the cycle number, the feature list (one line each is fine), and confirmation that lint/build/advisors were clean. This is the standing "leave a log here" requirement — don't let it slide into only appearing in commit messages.

### 7. Confirm deployment, then continue

Check the new deployment reaches `READY` (poll via `ScheduleWakeup`, not a blocking wait — schedule a short wakeup, and when it fires, check again or reschedule if still building). Once confirmed, immediately start the next cycle's step 1 — don't wait for the user to say "go ahead," since the whole point of the loop is that it doesn't need per-cycle permission. Keep the `ScheduleWakeup` prompt self-contained enough that firing it resumes the loop correctly even with a fresh context (name the branch, project/team IDs, current cycle number, and what to do next).

## If the user reports a live bug mid-loop

Stop adding new features and fix it first — a crash in production outranks the next batch.

1. **Reproduce before theorizing.** Don't guess at a fix from reading code alone if you can actually reproduce it. If the sandbox can't reach the production backend directly (common — egress to a hosted DB/auth provider is often blocked), run the app's local dev server and drive it with a headless browser (Playwright is normally available), intercepting the backend's network calls and fulfilling them with realistic mock responses instead of letting them hit the real network. This is a legitimate, fast way to exercise real client-side render logic — including race conditions, hook double-mounts, and library-specific throw conditions — without needing live data. Watch for `pageerror` events and console errors, not just visual output.
   - Get the mock responses *right*, especially anything with a query-shape-dependent response format (e.g. a REST client's "single object" mode vs "array" mode based on a request header) — a sloppy mock can produce a false-positive crash that isn't a real bug. Cross-check a suspicious finding by fixing the mock and re-running before concluding it's real.
   - Smoke-test every page touched recently while you're set up to do it, not just the one the user reported — regressions cluster.
2. **Root-cause it**, don't just patch the symptom. Explain in the fix commit what the actual mechanism was.
3. **Fix, re-verify (lint/build/re-run the repro), commit, push, confirm deployment READY** — same discipline as a normal cycle, as its own dedicated commit (don't fold a bug fix silently into the next feature cycle's commit).
4. Report the root cause and fix to the user in chat.
5. Resume the feature loop where it left off.

## Wrapping up

When the last cycle's deployment is confirmed `READY`, send a closing summary organized by theme (not a flat changelog) — group the ~N×M features into a handful of categories (e.g. core content model, moderation/safety, community/social features, notifications, search/discovery, personalization, platform/UX polish) and call out any security or correctness fixes made along the way as their own section, since those matter more than another feature bullet. Keep it a wrap-up a person can skim in 30 seconds, not a changelog dump.

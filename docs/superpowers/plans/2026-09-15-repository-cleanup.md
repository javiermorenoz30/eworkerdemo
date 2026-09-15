# Repository Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce repository clutter without changing production behavior, routes, Supabase/Resend integrations, SEO content, or Cloudflare deployment.

**Architecture:** Keep the deployed file layout unchanged and remove only artifacts proven to be non-runtime historical development material. Treat `main` commit `2c68c1eb25e0846de0a4796875f33e2994382daf` as the safety baseline, do all work on `chore/repository-cleanup`, and merge only after the full test/build/deploy verification passes.

**Tech Stack:** Static HTML/CSS/JS, Node.js 22 tests, Cloudflare Workers/Wrangler 4, Supabase Edge Functions/Postgres migrations, GitHub Actions.

**Spec:** `docs/repository-cleanup-design.md`

## Global Constraints

- Do not change production HTML/JS/CSS routes or move runtime files into new folders.
- Do not modify Supabase schema/data, DNS, secrets, Resend settings, or Cloudflare account configuration.
- Preserve all historical Supabase migrations.
- Preserve `.assetsignore` allowlisting and all currently published production paths.
- Keep `npm test`, `npm run check:deploy`, and `npm run test:assets` in CI.
- Make all changes on `chore/repository-cleanup`; do not modify `main` until the cleanup PR is green.

---

### Task 1: Remove retired landing-CMS artifacts

**Files:**
- Delete: `tests/landing-schema.test.js`
- Delete: `supabase/tests/landing-rls-smoke.sql`
- Keep: `tests/repository-content.test.js`
- Keep: `supabase/migrations/2026090502_landing_content.sql`

**Interfaces:**
- Consumes: current static-content architecture documented in `README.md` and `docs/repository-cleanup-design.md`.
- Produces: test suite without retired landing-CMS schema assertions.

- [ ] **Step 1: Verify no runtime file imports the retired test files**

Search the repository for `landing-schema.test.js` and `landing-rls-smoke.sql`. Expected: references only in historical documentation or none; no runtime/build imports.

- [ ] **Step 2: Delete `tests/landing-schema.test.js`**

Delete only this test file. Do not delete `tests/repository-content.test.js`.

- [ ] **Step 3: Delete `supabase/tests/landing-rls-smoke.sql`**

Delete only this retired CMS smoke test. Do not alter `supabase/migrations/2026090502_landing_content.sql`.

- [ ] **Step 4: Run the Node suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `chore: remove retired landing cms tests`

---

### Task 2: Remove historical development documents and empty-folder marker

**Files:**
- Delete: `docs/superpowers/plans/2026-09-04-supabase-production-implementation.md`
- Delete: `docs/superpowers/plans/2026-09-05-dashboard-role-delete-realtime.md`
- Delete: `docs/superpowers/plans/2026-09-05-landing-editor-boss.md`
- Delete: `docs/superpowers/plans/2026-09-05-seo-architecture-implementation.md`
- Delete: `docs/superpowers/specs/2026-09-04-supabase-production-backend-design.md`
- Delete: `docs/superpowers/specs/2026-09-05-dashboard-role-delete-realtime-design.md`
- Delete: `docs/superpowers/specs/2026-09-05-landing-editor-boss-design.md`
- Delete: `docs/superpowers/specs/2026-09-05-seo-architecture-design.md`
- Delete at final cleanup: `docs/superpowers/plans/2026-09-15-repository-cleanup.md`
- Delete: `assets/.gitkeep`
- Keep: `docs/repository-cleanup-design.md`

**Interfaces:**
- Consumes: no runtime imports; these files are development records only.
- Produces: smaller repository with operational documentation retained.

- [ ] **Step 1: Verify `docs/superpowers/` is not referenced by build/runtime configuration**

Search `.github`, `package.json`, `scripts/`, `.assetsignore`, `wrangler.jsonc`, HTML, JS and CSS for `docs/superpowers`. Expected: no runtime/build dependency.

- [ ] **Step 2: Delete the historical plan/spec files listed above**

Delete only the listed historical files. Keep `docs/repository-cleanup-design.md` until the cleanup is complete.

- [ ] **Step 3: Delete `assets/.gitkeep`**

Confirm `assets/` contains real files before deletion. Expected: image/logo assets remain.

- [ ] **Step 4: Run the Node suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `chore: remove obsolete development artifacts`

---

### Task 3: Simplify CI to the actual production branch

**Files:**
- Modify: `.github/workflows/tests.yml`

**Interfaces:**
- Consumes: production branch `main`.
- Produces: CI on pushes to `main` and on all pull requests.

- [ ] **Step 1: Change the push branch list**

Replace:

```yaml
push:
  branches:
    - main
    - supabase-production
```

with:

```yaml
push:
  branches:
    - main
```

Keep `pull_request:` and all four job steps unchanged.

- [ ] **Step 2: Verify workflow commands remain present**

Confirm the workflow still contains:

```yaml
- run: npm ci
- run: npm test
- run: npm run check:deploy
- run: npm run test:assets
```

- [ ] **Step 3: Commit**

Commit message: `chore: align ci with main production branch`

---

### Task 4: Rewrite README for current production state

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: current production architecture from repository files and cleanup spec.
- Produces: concise operational documentation.

- [ ] **Step 1: Replace migration-era wording with current-state wording**

The README must state that:

```text
- main is the production branch.
- Cloudflare Workers deploys the allowlisted files copied into dist/.
- Public content is maintained directly in GitHub HTML/JS/CSS/assets, not via the retired landing CMS.
- Supabase provides Auth, database records and Edge Functions.
- Historical migrations are intentionally preserved.
- Secrets/API keys are never stored in the repository.
```

- [ ] **Step 2: Keep operational sections only**

Retain sections for content editing, Cloudflare deployment, Supabase/Auth/Edge Functions, email configuration, tests, and production safety. Remove stale migration-transition instructions that describe the domain as not yet active.

- [ ] **Step 3: Run repository-content and production-safety tests**

Run: `node --test tests/repository-content.test.js tests/production-safety.test.js`
Expected: PASS.

- [ ] **Step 4: Commit**

Commit message: `docs: refresh production repository guide`

---

### Task 5: Close superseded pull requests

**Files:** none; repository metadata only.

**Interfaces:**
- Consumes: PR #4 and PR #15.
- Produces: no stale open PRs for superseded implementation work.

- [ ] **Step 1: Close PR #4 without merging**

PR: `Add Boss and read-only Operator access`.
Expected state: closed, `merged=false`.

- [ ] **Step 2: Close PR #15 without merging**

PR: `Prepare eWorker for production domain cutover`.
Expected state: closed, `merged=false`.

- [ ] **Step 3: Verify PR #18 remains closed without merge**

Expected state: closed, `merged=false`.

---

### Task 6: Final verification and cleanup PR

**Files:**
- Verify: `.assetsignore`
- Verify: `wrangler.jsonc`
- Verify: `index.html`, `application.html`, `admin.html`, `recruiter.html`, `staff-login.html`, `reset-password.html`, `es/`, `en/`, `assets/`
- Delete after execution: `docs/superpowers/plans/2026-09-15-repository-cleanup.md`

**Interfaces:**
- Consumes: cleaned repository branch.
- Produces: a reviewable cleanup PR safe to merge.

- [ ] **Step 1: Run full Node tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 2: Run Cloudflare dry-run**

Run: `npm run check:deploy`
Expected: PASS; no production deployment occurs.

- [ ] **Step 3: Run static-assets runtime check**

Run: `npm run test:assets`
Expected: PASS.

- [ ] **Step 4: Verify production-critical allowlist entries**

Confirm `.assetsignore` still publishes the homepage, application/admin/recruiter/login/reset/legal pages, JS/CSS modules, `es/`, `en/`, sitemap/robots, redirects, and every required image asset.

- [ ] **Step 5: Delete this temporary implementation plan**

Delete `docs/superpowers/plans/2026-09-15-repository-cleanup.md` so the final repository does not retain the development-plan folder being removed. Keep `docs/repository-cleanup-design.md` as the concise cleanup record.

- [ ] **Step 6: Open cleanup PR against `main`**

Title: `Clean up obsolete repository artifacts`

PR body must summarize removed files, preserved runtime/database history, CI/README updates, and verification commands.

- [ ] **Step 7: Wait for GitHub and Cloudflare checks**

Require all checks to complete successfully before merge.

- [ ] **Step 8: Merge only if all checks are green**

Use squash or merge according to repository defaults. Never force-update `main`.

# eWorker360 Repository Cleanup Design

## Goal

Reduce repository clutter and remove obsolete development artifacts without changing the behavior of the public site, dashboard, forms, authentication, Supabase integration, Resend/Gmail notifications, SEO pages, or Cloudflare deployment.

## Safety baseline

The cleanup starts from `main` commit `2c68c1eb25e0846de0a4796875f33e2994382daf`, where the Node test suite, GitHub build/deploy checks, and Cloudflare Workers build are green. All cleanup work happens on `chore/repository-cleanup`; `main` is not modified until the cleanup branch passes the same checks.

## Preserve without restructuring

Keep the current public/runtime file layout. Do not move root HTML, JS, or CSS files into new folders because their current paths are part of the deployed site and are referenced by redirects, HTML imports, tests, Supabase Auth redirects, and Cloudflare static-asset publication.

Keep:

- public pages and scripts: `index.html`, `application.html`, `admin.html`, `recruiter.html`, `staff-login.html`, `reset-password.html`, `faq.html`, `privacy.html`, `terms.html`, their JS/CSS modules, and `assets/`;
- SEO content under `es/` and `en/` plus `seo-pages.css`, `sitemap.xml`, and `robots.txt`;
- Cloudflare configuration: `wrangler.jsonc`, `_redirects`, `.assetsignore`, `scripts/build-assets.js`, package files, and the GitHub Actions workflow;
- active Supabase functions/configuration;
- every historical Supabase migration, including `2026090502_landing_content.sql`, because migrations are part of database history even when the related UI has been retired;
- active tests covering production behavior, authentication, forms, RLS-related structure, CORS, dashboard behavior, SEO, Cloudflare assets, deployment safety, and local homepage images.

## Remove obsolete repository artifacts

Remove artifacts that are no longer runtime dependencies and are explicitly superseded by the current static-content architecture:

1. `docs/superpowers/` — historical design/implementation documents from prior development phases. They are not read by build/runtime code and duplicate current documentation.
2. `assets/.gitkeep` — no longer needed because `assets/` contains real files.
3. `tests/landing-schema.test.js` — validates the retired landing CMS schema, while the public site now uses repository HTML directly.
4. `supabase/tests/landing-rls-smoke.sql` — smoke test for the retired landing CMS tables. Historical migration files remain untouched.

Do not remove `tests/repository-content.test.js`; it protects the current decision that the public site must not activate the retired CMS/preview flow.

## CI cleanup

Update `.github/workflows/tests.yml` so push CI targets only `main`. Keep pull-request CI enabled. Remove the stale `supabase-production` push trigger; production is documented as `main`.

Do not reduce the verification commands: keep `npm test`, `npm run check:deploy`, and `npm run test:assets`.

## Documentation cleanup

Rewrite `README.md` so it describes the current production state instead of the migration period. Keep only operationally useful sections: architecture, content editing, Cloudflare build/deploy, Supabase/Auth/Edge Functions, email configuration, tests, and production safety notes.

The README must explicitly state that:

- `main` is production;
- public content is maintained in GitHub files, not the retired landing CMS;
- historical migrations are intentionally preserved;
- `.assetsignore` is an allowlist for what Cloudflare publishes;
- secrets remain outside GitHub.

## Pull-request cleanup

Close stale PRs that represent superseded work and are no longer intended for merge:

- PR #4 `Add Boss and read-only Operator access`;
- PR #15 `Prepare eWorker for production domain cutover`.

PR #18 is already closed without merge.

## Branch cleanup

Audit old branches after the code cleanup. Because branch deletion is repository metadata rather than runtime behavior, only branches that are clearly superseded by merged/current `main` work should be candidates. If the available GitHub connection does not expose branch deletion, report the exact stale branch list instead of force-moving or repurposing refs.

Never delete or alter `main` as part of branch cleanup.

## Verification

Before proposing merge:

1. verify the removed files have no runtime/build imports or required workflow references;
2. run the full Node suite;
3. run Cloudflare deploy dry-run;
4. run the HTTP/static-assets runtime check;
5. verify production-critical paths are still present in `.assetsignore`;
6. verify `index.html`, `application.html`, `admin.html`, `recruiter.html`, login/reset pages, `es/`, `en/`, and all required image assets remain in the published set;
7. require all GitHub/Cloudflare checks on the cleanup PR to finish successfully before merge.

No external Supabase schema, data, secrets, DNS, Resend settings, or Cloudflare account configuration is changed by this cleanup.

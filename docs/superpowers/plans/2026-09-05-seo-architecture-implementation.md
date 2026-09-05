# eWorker360 SEO Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a bilingual SEO foundation and high-value landing-page architecture for Dominican job seekers and U.S. BPO buyers on `https://eworker360dominicana.com/`.

**Architecture:** Keep the site static-first and Cloudflare-compatible. Create separate `/es/` and `/en/` indexable HTML trees, use page-specific metadata/canonicals/hreflang/JSON-LD, preserve current application and dashboard flows, and add redirects/sitemap/noindex rules plus automated SEO regression tests.

**Tech Stack:** Static HTML/CSS/JavaScript, Cloudflare Workers static assets, Node.js `node:test`, Wrangler 4.129.0.

**Spec:** `docs/superpowers/specs/2026-09-05-seo-architecture-design.md`

## Global Constraints

- Canonical production domain: `https://eworker360dominicana.com/`.
- Spanish employment content targets candidates in the Dominican Republic only.
- English commercial content targets U.S. buyers, prioritizing Florida, New York, New Jersey, Massachusetts, and Pennsylvania.
- Do not create doorway pages, thin state pages, fake jobs, keyword stuffing, or unverified business claims.
- Use `es-DO` and `en-US` for language targeting.
- Keep primary content crawlable in server-delivered/static HTML.
- Preserve current application, admin, recruiter, login, reset-password, and dashboard functionality.
- Do not merge to `main` until tests pass and the user explicitly approves the implementation PR.

---

## File Structure

Create focused static-page groups rather than adding more behavior to `index.html`.

- `es/index.html`: Spanish home for Dominican candidates and local buyers.
- `en/index.html`: English home for U.S. BPO buyers.
- `es/empleos/index.html`: employment hub.
- `es/empleos/call-center/index.html`: call-center employment intent.
- `es/empleos/servicio-al-cliente/index.html`: customer-service employment intent.
- `es/empleos/la-vega/index.html`: La Vega employment intent.
- `es/empleos/republica-dominicana/index.html`: national employment intent.
- `en/bpo/index.html`: BPO hub.
- `en/nearshore-outsourcing/index.html`: nearshore intent.
- `en/customer-service-outsourcing/index.html`: customer-service outsourcing intent.
- `en/bpo-united-states/index.html`: national U.S. commercial hub.
- `en/bpo-florida/index.html`
- `en/bpo-new-york/index.html`
- `en/bpo-new-jersey/index.html`
- `en/bpo-massachusetts/index.html`
- `en/bpo-pennsylvania/index.html`
- `seo-pages.css`: shared styles for new SEO landing pages, reusing existing visual tokens where practical.
- `tests/seo.test.js`: static SEO regression suite.
- `.assetsignore`: explicitly publish new pages and `seo-pages.css`.
- `_redirects`: permanent redirects from old public URLs where appropriate and clean extensionless routes for new pages.
- `sitemap.xml`: canonical indexable URLs only.
- `robots.txt`: retain sitemap declaration.
- Existing utility/auth HTML files: add `noindex,follow` where they should not rank.

---

### Task 1: Add SEO regression tests before creating pages

**Files:**
- Create: `tests/seo.test.js`

**Interfaces:**
- Consumes: static files in the repository.
- Produces: regression rules for metadata, canonical host, language, hreflang, sitemap inclusion, and noindex utility pages.

- [ ] **Step 1: Write the failing test**

Create `tests/seo.test.js` with a manifest for the Phase 1 pages and tests like:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')
const domain = 'https://eworker360dominicana.com'

const pages = [
  ['es/index.html', 'es-DO', '/es/'],
  ['es/empleos/index.html', 'es-DO', '/es/empleos/'],
  ['es/empleos/call-center/index.html', 'es-DO', '/es/empleos/call-center/'],
  ['es/empleos/servicio-al-cliente/index.html', 'es-DO', '/es/empleos/servicio-al-cliente/'],
  ['es/empleos/la-vega/index.html', 'es-DO', '/es/empleos/la-vega/'],
  ['es/empleos/republica-dominicana/index.html', 'es-DO', '/es/empleos/republica-dominicana/'],
  ['en/index.html', 'en-US', '/en/'],
  ['en/bpo/index.html', 'en-US', '/en/bpo/'],
  ['en/nearshore-outsourcing/index.html', 'en-US', '/en/nearshore-outsourcing/'],
  ['en/customer-service-outsourcing/index.html', 'en-US', '/en/customer-service-outsourcing/'],
  ['en/bpo-united-states/index.html', 'en-US', '/en/bpo-united-states/'],
  ['en/bpo-florida/index.html', 'en-US', '/en/bpo-florida/'],
  ['en/bpo-new-york/index.html', 'en-US', '/en/bpo-new-york/'],
  ['en/bpo-new-jersey/index.html', 'en-US', '/en/bpo-new-jersey/'],
  ['en/bpo-massachusetts/index.html', 'en-US', '/en/bpo-massachusetts/'],
  ['en/bpo-pennsylvania/index.html', 'en-US', '/en/bpo-pennsylvania/'],
]

test('Phase 1 SEO pages have unique crawlable metadata and production canonicals', async () => {
  const titles = new Set()
  const descriptions = new Set()
  for (const [path, lang, route] of pages) {
    const html = await read(path)
    assert.match(html, new RegExp(`<html[^>]+lang=["']${lang}["']`))
    assert.match(html, new RegExp(`<link[^>]+rel=["']canonical["'][^>]+href=["']${domain}${route.replaceAll('/', '\\/')}["']`))
    const title = html.match(/<title>([^<]+)<\/title>/)?.[1]
    const description = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/)?.[1]
    assert.ok(title?.trim(), `${path} needs a title`)
    assert.ok(description?.trim(), `${path} needs a description`)
    assert.ok(!titles.has(title), `duplicate title: ${title}`)
    assert.ok(!descriptions.has(description), `duplicate description: ${description}`)
    titles.add(title)
    descriptions.add(description)
    assert.match(html, /<h1[\s>]/)
  }
})

test('utility and authenticated pages are not intended for indexing', async () => {
  for (const path of ['application.html', 'admin.html', 'recruiter.html', 'staff-login.html', 'reset-password.html']) {
    assert.match(await read(path), /<meta\s+name=["']robots["']\s+content=["']noindex,follow["']/i)
  }
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`

Expected: FAIL because the new language/page files and noindex tags do not exist yet.

- [ ] **Step 3: Commit the red test**

```bash
git add tests/seo.test.js
git commit -m "test: define SEO architecture requirements"
```

---

### Task 2: Create bilingual homes and migration-safe routing

**Files:**
- Create: `es/index.html`
- Create: `en/index.html`
- Create: `seo-pages.css`
- Modify: `_redirects`
- Modify: `.assetsignore`

**Interfaces:**
- Produces: crawlable `/es/` and `/en/` home entry points used by all later landing pages.

- [ ] **Step 1: Add failing routing assertions**

Extend `tests/cloudflare-runtime.js` so `/es/` and `/en/` must resolve to their respective `index.html` assets and preserve query parameters.

Example assertion:

```js
for (const route of ['es/', 'en/']) {
  const response = await fetch(`${origin}/${route}?route_check=1`)
  assert.equal(response.status, 200)
  assert.equal(new URL(response.url).searchParams.get('route_check'), '1')
}
```

- [ ] **Step 2: Run runtime test and confirm failure**

Run: `npm run test:assets`

Expected: FAIL because the new routes/assets are not published yet.

- [ ] **Step 3: Implement the two homes**

Each home must include:

```html
<html lang="es-DO">
<head>
  <title>Empleos, Call Center y BPO en República Dominicana | eWorker360</title>
  <meta name="description" content="Encuentra oportunidades de empleo en call center, servicio al cliente y ventas en República Dominicana, o conoce soluciones BPO de eWorker360." />
  <link rel="canonical" href="https://eworker360dominicana.com/es/" />
  <link rel="alternate" hreflang="es-DO" href="https://eworker360dominicana.com/es/" />
  <link rel="alternate" hreflang="en-US" href="https://eworker360dominicana.com/en/" />
  <link rel="alternate" hreflang="x-default" href="https://eworker360dominicana.com/es/" />
</head>
```

Use a genuinely English counterpart in `en/index.html` with a commercial BPO title/description rather than a literal translation.

Reuse the existing brand/logo/assets and link normal anchors to the employment/BPO hubs.

- [ ] **Step 4: Publish assets and routes**

Add to `.assetsignore`:

```text
!/seo-pages.css
!/es/
!/en/
```

Add clean route rules in `_redirects` without creating redirect chains. Root should permanently redirect to Spanish as the primary Dominican market entry:

```text
/ /es/ 301
/index /es/ 301
/index/ /es/ 301
```

Retain existing utility routes.

- [ ] **Step 5: Run tests**

Run:

```bash
npm test
npm run test:assets
```

Expected: SEO suite still fails only for pages not yet implemented; `/es/` and `/en/` routing passes.

- [ ] **Step 6: Commit**

```bash
git add es/index.html en/index.html seo-pages.css _redirects .assetsignore tests/cloudflare-runtime.js
git commit -m "feat: add bilingual SEO home routes"
```

---

### Task 3: Build the Dominican employment cluster

**Files:**
- Create: `es/empleos/index.html`
- Create: `es/empleos/call-center/index.html`
- Create: `es/empleos/servicio-al-cliente/index.html`
- Create: `es/empleos/la-vega/index.html`
- Create: `es/empleos/republica-dominicana/index.html`

**Interfaces:**
- Consumes: `seo-pages.css`, current `application.html` conversion flow.
- Produces: candidate landing pages linking to the existing application form.

- [ ] **Step 1: Add content-specific failing assertions**

In `tests/seo.test.js`, assert each employment page contains a distinct H1 and a normal application link:

```js
for (const path of employmentPages) {
  const html = await read(path)
  assert.match(html, /href=["']\/application(?:\.html)?["']/)
  assert.doesNotMatch(html, /employment in (Florida|New York|New Jersey|Massachusetts|Pennsylvania)/i)
}
```

- [ ] **Step 2: Run test and verify failure**

Run: `npm test`

Expected: FAIL because employment pages do not exist.

- [ ] **Step 3: Implement unique pages**

Use distinct intents, for example:

- `/es/empleos/`: “Empleos y oportunidades de trabajo en República Dominicana”.
- `/es/empleos/call-center/`: “Empleos de call center en República Dominicana”.
- `/es/empleos/servicio-al-cliente/`: “Empleos de servicio al cliente en República Dominicana”.
- `/es/empleos/la-vega/`: “Empleos en La Vega con eWorker360”.
- `/es/empleos/republica-dominicana/`: “Vacantes y trabajos en República Dominicana”.

Each page must include visible explanatory body copy, role expectations, why eWorker360 is relevant, links to neighboring employment pages, and a CTA to `/application.html`.

Do not invent salaries, benefits, schedules, open positions, certifications, or hiring guarantees.

- [ ] **Step 4: Add breadcrumb JSON-LD**

For a child page use visible breadcrumbs plus matching JSON-LD, e.g.:

```html
<script type="application/ld+json">
{
  "@context":"https://schema.org",
  "@type":"BreadcrumbList",
  "itemListElement":[
    {"@type":"ListItem","position":1,"name":"Inicio","item":"https://eworker360dominicana.com/es/"},
    {"@type":"ListItem","position":2,"name":"Empleos","item":"https://eworker360dominicana.com/es/empleos/"},
    {"@type":"ListItem","position":3,"name":"Call Center","item":"https://eworker360dominicana.com/es/empleos/call-center/"}
  ]
}
</script>
```

- [ ] **Step 5: Run tests and commit**

```bash
npm test
git add es/empleos tests/seo.test.js
git commit -m "feat: add Dominican employment SEO cluster"
```

---

### Task 4: Build the U.S. BPO hub and service pages

**Files:**
- Create: `en/bpo/index.html`
- Create: `en/nearshore-outsourcing/index.html`
- Create: `en/customer-service-outsourcing/index.html`
- Create: `en/bpo-united-states/index.html`

**Interfaces:**
- Consumes: existing public business contact section/form URL.
- Produces: commercial hub pages that state pages link back to.

- [ ] **Step 1: Add failing commercial-intent tests**

Add assertions that these pages contain commercial CTAs and Dominican nearshore context, but no job-application positioning.

```js
for (const path of buyerPages) {
  const html = await read(path)
  assert.match(html, /(BPO|nearshore|outsourcing|customer service)/i)
  assert.match(html, /(Dominican Republic|Dominicana)/i)
  assert.doesNotMatch(html, /apply for a job|job vacancy/i)
}
```

- [ ] **Step 2: Run test and verify failure**

Run: `npm test`

- [ ] **Step 3: Implement the four pages**

Use distinct primary intents:

- `/en/bpo/`: full BPO capabilities.
- `/en/nearshore-outsourcing/`: nearshore model and proximity to U.S. operations.
- `/en/customer-service-outsourcing/`: customer support outsourcing use cases.
- `/en/bpo-united-states/`: national commercial landing page linking to five state pages.

Use factual language only. Describe time-zone/proximity advantages generically unless exact service hours or SLAs are verified.

- [ ] **Step 4: Add Organization/Breadcrumb structured data and internal links**

Every page must link back to `/en/`, to at least one sibling service page, and toward the business contact CTA.

- [ ] **Step 5: Run tests and commit**

```bash
npm test
git add en/bpo en/nearshore-outsourcing en/customer-service-outsourcing en/bpo-united-states tests/seo.test.js
git commit -m "feat: add U.S. BPO SEO hubs"
```

---

### Task 5: Create five materially distinct state pages

**Files:**
- Create: `en/bpo-florida/index.html`
- Create: `en/bpo-new-york/index.html`
- Create: `en/bpo-new-jersey/index.html`
- Create: `en/bpo-massachusetts/index.html`
- Create: `en/bpo-pennsylvania/index.html`

**Interfaces:**
- Consumes: `/en/bpo-united-states/` national hub.
- Produces: state-specific commercial landing pages.

- [ ] **Step 1: Add anti-doorway failing tests**

Create a helper that strips markup and compares normalized text. Fail if two state pages are effectively duplicates.

```js
const normalize = (html) => html
  .replace(/<script[\s\S]*?<\/script>/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

for (let i = 0; i < statePages.length; i++) {
  for (let j = i + 1; j < statePages.length; j++) {
    assert.notEqual(normalize(await read(statePages[i])), normalize(await read(statePages[j])))
  }
}
```

Also assert each page contains its own state name and links to `/en/bpo-united-states/`.

- [ ] **Step 2: Run test and verify failure**

Run: `npm test`

- [ ] **Step 3: Implement unique state content**

Give each page a different business narrative and use-case mix. Keep claims qualitative unless sourced/verified. Each must include:

- state-specific H1/title/description;
- why a Dominican nearshore team can fit businesses serving that state;
- 2–3 distinct use-case sections;
- service links;
- state-specific FAQ copy visible on the page;
- CTA to contact eWorker360;
- breadcrumbs and canonical.

Do not claim physical offices or local staff in those states.

- [ ] **Step 4: Run tests and commit**

```bash
npm test
git add en/bpo-florida en/bpo-new-york en/bpo-new-jersey en/bpo-massachusetts en/bpo-pennsylvania tests/seo.test.js
git commit -m "feat: add priority U.S. state BPO pages"
```

---

### Task 6: Apply noindex rules to utility/authenticated surfaces

**Files:**
- Modify: `application.html`
- Modify: `admin.html`
- Modify: `recruiter.html`
- Modify: `staff-login.html`
- Modify: `reset-password.html`

**Interfaces:**
- Produces: explicit non-indexing intent without affecting authentication/access.

- [ ] **Step 1: Use the already-failing test from Task 1**

Confirm the noindex test still fails before editing.

Run: `npm test`

- [ ] **Step 2: Add metadata only**

Inside each `<head>` add:

```html
<meta name="robots" content="noindex,follow" />
```

Do not block these URLs in `robots.txt`; Google must be able to crawl the HTML to see the noindex directive.

- [ ] **Step 3: Run tests and commit**

```bash
npm test
git add application.html admin.html recruiter.html staff-login.html reset-password.html
git commit -m "chore: noindex utility and staff pages"
```

---

### Task 7: Finish sitemap, redirects, hreflang, publishing allowlist, and runtime coverage

**Files:**
- Modify: `sitemap.xml`
- Modify: `robots.txt`
- Modify: `_redirects`
- Modify: `.assetsignore`
- Modify: `tests/seo.test.js`
- Modify: `tests/cloudflare-runtime.js`

**Interfaces:**
- Produces: crawl/discovery and Cloudflare serving rules for the entire Phase 1 set.

- [ ] **Step 1: Add failing sitemap assertions**

In `tests/seo.test.js`:

```js
test('sitemap contains every canonical Phase 1 public page and excludes utility pages', async () => {
  const sitemap = await read('sitemap.xml')
  for (const [, , route] of pages) assert.match(sitemap, new RegExp(`${domain}${route.replaceAll('/', '\\/')}`))
  for (const route of ['/admin', '/recruiter', '/staff-login', '/reset-password', '/application']) {
    assert.doesNotMatch(sitemap, new RegExp(route))
  }
})
```

Add reciprocal hreflang checks at least for `/es/`↔`/en/` and any true equivalent page pairs implemented.

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test`

- [ ] **Step 3: Replace sitemap with canonical Phase 1 URLs**

Use only `https://eworker360dominicana.com/...` URLs. Do not include utility/auth pages.

- [ ] **Step 4: Keep robots simple**

`robots.txt` should remain:

```text
User-agent: *
Allow: /
Sitemap: https://eworker360dominicana.com/sitemap.xml
```

- [ ] **Step 5: Add clean extensionless routes**

Add `_redirects` rules so every new clean route resolves to its `index.html` without redirect loops, for example:

```text
/es/empleos /es/empleos/index.html 200
/es/empleos/ /es/empleos/index.html 200
/en/bpo /en/bpo/index.html 200
/en/bpo/ /en/bpo/index.html 200
```

Repeat for all Phase 1 pages.

- [ ] **Step 6: Extend runtime asset verification**

Update `tests/cloudflare-runtime.js` to request each new clean route and verify status 200 and the exact underlying file bytes where practical.

- [ ] **Step 7: Run all validation**

```bash
npm test
npm run check:deploy
npm run test:assets
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add sitemap.xml robots.txt _redirects .assetsignore tests/seo.test.js tests/cloudflare-runtime.js
git commit -m "feat: complete technical SEO routing and discovery"
```

---

### Task 8: Final content/structured-data review and implementation PR

**Files:**
- Review all Phase 1 HTML files.
- No unrelated code changes.

**Interfaces:**
- Produces: review-ready PR; no merge/deploy yet.

- [ ] **Step 1: Check metadata uniqueness programmatically**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 2: Check production packaging**

Run:

```bash
npm run check:deploy
npm run test:assets
```

Expected: PASS.

- [ ] **Step 3: Manually inspect representative pages**

Inspect at minimum:

- `/es/`
- `/es/empleos/`
- `/es/empleos/call-center/`
- `/en/`
- `/en/bpo/`
- `/en/bpo-united-states/`
- `/en/bpo-florida/`

Confirm: one H1, readable mobile layout, working internal links, no unverified claims, correct language, canonical and CTA.

- [ ] **Step 4: Validate JSON-LD syntax**

Parse every `application/ld+json` block in `tests/seo.test.js` using `JSON.parse` and fail on malformed blocks.

- [ ] **Step 5: Create implementation PR**

Open a PR from the implementation branch to `main` with a summary of:

- bilingual URL architecture;
- candidate and buyer clusters;
- five state pages;
- structured data/hreflang/canonical work;
- noindex rules;
- sitemap/redirect changes;
- full test results.

Do not merge until the user explicitly says to merge.

---

## Post-Merge Migration Checklist

These are operational steps after the code PR is merged and the real domain is serving the new structure; they are not reasons to block implementation development.

1. Confirm `https://eworker360dominicana.com/es/` and `/en/` return 200 on the real domain.
2. Confirm HTTP→HTTPS and any `www` variant redirect directly to the canonical HTTPS host with a single permanent redirect.
3. Confirm `/` redirects directly to `/es/` with no chain.
4. Verify Google Search Console Domain Property for `eworker360dominicana.com`.
5. Submit `https://eworker360dominicana.com/sitemap.xml`.
6. Inspect representative Spanish employment and English BPO URLs in Search Console.
7. Connect/align the Google Business Profile website URL and verified business information if a profile exists.
8. Configure Bing Webmaster Tools and submit the sitemap.
9. Monitor indexing, canonical selection, Core Web Vitals, candidate queries, BPO queries, applications, and qualified business leads.

## Self-Review Results

- Spec coverage: Phase 1 URL architecture, Dominican candidate targeting, U.S. buyer targeting, five priority states, canonicals, hreflang, structured data, internal links, sitemap, redirects, noindex rules, Cloudflare publishing, performance constraints, and post-migration indexing are covered.
- Placeholder scan: no `TODO`, `TBD`, or unspecified implementation steps remain.
- Interface consistency: new pages use static HTML/CSS and existing application/business contact flows; tests use the existing Node `node:test` and Wrangler scripts from `package.json`.

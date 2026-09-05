# Landing Editor + Boss Role Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `boss` role with full Admin parity and turn the existing Admin “Contenido” area into a simple, bilingual landing-page editor with image uploads, templates, draft preview, and atomic publishing.

**Architecture:** Keep the current static site and visual CSS as the rendering base, but move editable landing content into two Supabase versions (`draft` and `published`) composed of ordered `landing_sections` rows. The public site loads only published content and keeps the current `index.html` markup as a safe fallback; the Admin editor works on the draft, Preview reads the draft behind Admin/Boss auth, and Publish transactionally copies the draft into the published version. Images live in the public `landing-media` Storage bucket while all write operations remain restricted to Admin/Boss.

**Tech Stack:** Static HTML/CSS/ES modules, `@supabase/supabase-js@2`, Supabase Postgres/RLS/RPC/Storage/Auth, Deno Edge Functions, Cloudflare Workers static deployment, Node built-in `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-05-landing-editor-boss-design.md`

## Global Constraints

- `boss` and `admin` must have exactly the same effective permissions.
- The editor applies only to the public landing page; internal application/login/legal pages remain outside the editor.
- Editing is template-based; do not expose arbitrary HTML, CSS, or JavaScript editing.
- The workflow is **Borrador → Vista previa → Publicar**.
- The public site may read only published content; draft content is readable only by authenticated Admin/Boss users.
- Keep Spanish and English content. Empty English fields fall back to Spanish.
- Store landing images in Supabase Storage bucket `landing-media`; only Admin/Boss may upload, replace, or delete objects.
- Preserve the current public visual design as the base and keep the current static landing markup as a fallback when the content service cannot load.
- Remove visible technical wording such as “Datos centralizados”, “Backend conectado”, “Supabase Auth”, “RLS”, and “Base de datos conectada” from the management UI.
- Do not broaden invitation behavior: invited accounts remain `recruiter`; Boss creation is handled by changing an existing profile role.
- Do not commit Supabase service-role keys, database passwords, or other secrets.

---

## File Map

**Create**
- `supabase/migrations/20260905_boss_role.sql` — expands valid roles and makes database Admin checks include Boss.
- `supabase/migrations/20260905_landing_content.sql` — landing versions/sections, RLS, transactional draft save/publish RPCs, Storage bucket/policies, and initial content seed.
- `supabase/tests/landing-rls-smoke.sql` — public/draft and Storage-policy security smoke checks.
- `landing-content.js` — pure template definitions and draft manipulation helpers.
- `landing-api.js` — browser API for published/draft content, save/publish RPCs, and Storage media operations.
- `landing-renderer.js` — safe DOM renderer for all landing section templates.
- `landing-bootstrap.js` — public bootstrap: replace fallback markup only after published content loads successfully, then start `app.js`.
- `landing-editor.js` — Admin/Boss editor UI and interactions.
- `landing-editor.css` — focused editor styles, including mobile behavior.
- `preview.html` — authenticated noindex draft preview shell.
- `preview.js` — Admin/Boss guard + draft renderer.
- `tests/landing-content.test.js` — pure template/reorder/localization tests.
- `tests/landing-structure.test.js` — public renderer/bootstrap/preview structure checks.
- `tests/landing-schema.test.js` — migration/RLS/RPC/Storage structure checks.

**Modify**
- `domain.js` — reusable Admin/Boss role helper and Boss routing.
- `auth.js` — allow active Boss through Admin guard.
- `admin.html` — replace simple content form with editor mount; remove technical warnings; load editor stylesheet.
- `admin.js` — label Boss correctly, expose profile role change for existing users, initialize the landing editor, remove old Hero/content settings bindings.
- `admin.css` — remove obsolete technical-readiness styling only when no longer referenced; retain general panel styles.
- `data-api.js` — keep operational/settings API; remove landing-Hero coupling once the new editor uses `landing-api.js`.
- `index.html` — give the public `<main>` a stable mount id and load `landing-bootstrap.js` instead of starting `app.js` directly; retain full static fallback markup.
- `app.js` — preserve existing language/filter/contact behaviors and make DOM lookups tolerant of optional template sections.
- `supabase/functions/manage-staff/index.ts` — allow Boss callers with the same privilege as Admin; invitation still creates Recruiter.
- `tests/domain.test.js` — Boss routing/manager-role tests.
- `tests/auth-structure.test.js` — Boss Admin-guard structural assertions.
- `tests/admin-structure.test.js` — editor mount, warning removal, and role-control assertions.
- `tests/edge-functions-structure.test.js` — Boss authorization in `manage-staff`.
- `tests/schema.test.js` — ensure historical migration remains untouched while follow-up migrations are present.
- `README.md` — deployment order for the new migrations, Edge Function redeploy, Storage, and frontend.

---

### Task 1: Add Boss as a true Admin-equivalent role

**Files:**
- Modify: `tests/domain.test.js`
- Modify: `tests/auth-structure.test.js`
- Modify: `tests/admin-structure.test.js`
- Modify: `tests/edge-functions-structure.test.js`
- Modify: `domain.js`
- Modify: `auth.js`
- Modify: `admin.js`
- Modify: `supabase/functions/manage-staff/index.ts`
- Create: `supabase/migrations/20260905_boss_role.sql`

**Interfaces:**
- Produces `MANAGER_ROLES = ['admin', 'boss']` and `isManagerProfile(profile)` from `domain.js`.
- `routeForProfile({ role: 'boss', active: true })` returns `admin.html`.
- `requireAdmin()` authorizes active Admin or Boss.
- Database helper `public.is_admin()` keeps its existing name but returns true for active `admin` or `boss`; existing RLS policies therefore inherit Boss parity without duplicating policies.
- Existing invitation remains Recruiter-only, but `manage-staff` accepts either Admin or Boss as caller.

- [ ] **Step 1: Write the failing Boss role tests**

Add to `tests/domain.test.js`:

```js
import { applicationMetrics, buildApplicationRecord, csvForApplications, isManagerProfile, routeForProfile } from '../domain.js'

test('Boss has the same dashboard route and manager status as Admin', () => {
  assert.equal(routeForProfile({ role: 'boss', active: true }), 'admin.html')
  assert.equal(isManagerProfile({ role: 'admin', active: true }), true)
  assert.equal(isManagerProfile({ role: 'boss', active: true }), true)
  assert.equal(isManagerProfile({ role: 'boss', active: false }), false)
  assert.equal(isManagerProfile({ role: 'recruiter', active: true }), false)
})
```

Add structural assertions:

```js
// tests/auth-structure.test.js
assert.match(auth, /isManagerProfile/)

// tests/edge-functions-structure.test.js
assert.match(code, /\['admin',\s*'boss'\]\.includes\(callerProfile\?\.role\)/)
```

In `tests/admin-structure.test.js`, assert that the team UI logic contains all three labels `Administrador`, `Boss`, and `Reclutador`, plus a role control such as `data-staff-role`.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
node --test tests/domain.test.js tests/auth-structure.test.js tests/admin-structure.test.js tests/edge-functions-structure.test.js
```

Expected: FAIL because Boss is not yet routed/authorized/labeled.

- [ ] **Step 3: Implement the minimal shared manager helper**

In `domain.js`:

```js
export const MANAGER_ROLES = ['admin', 'boss']

export function isManagerProfile(profile) {
  return Boolean(profile?.active && MANAGER_ROLES.includes(profile.role))
}

export function routeForProfile(profile) {
  if (!profile?.active) return null
  if (MANAGER_ROLES.includes(profile.role)) return 'admin.html'
  if (profile.role === 'recruiter') return 'recruiter.html'
  return null
}
```

Update `auth.js` to import `isManagerProfile` and use it inside `requireAdmin()` instead of `profile.role !== 'admin'`.

- [ ] **Step 4: Add the production-safe role migration**

Create `supabase/migrations/20260905_boss_role.sql` without editing the historical migration:

```sql
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'boss', 'recruiter'));

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and active = true
      and role in ('admin', 'boss')
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;
```

- [ ] **Step 5: Give Boss parity in `manage-staff` without changing invite role**

Replace the single-role caller check with:

```ts
const managerRoles = ['admin', 'boss']
if (profileError || !managerRoles.includes(callerProfile?.role) || callerProfile?.active !== true) {
  return jsonResponse(req, { error: 'Manager access required' }, 403)
}
```

Keep the profile upsert exactly `role: 'recruiter'`.

- [ ] **Step 6: Add a simple existing-user role selector in Team**

In `admin.js`, define:

```js
const staffRoles = [
  ['admin', 'Administrador'],
  ['boss', 'Boss'],
  ['recruiter', 'Reclutador'],
]
```

Render a `<select data-staff-role="PROFILE_ID">` beside each profile. Disable the current session profile selector so the user cannot accidentally demote the account they are actively using. On change, call `updateProfile(profile.id, { role: target.value })`, update local state only after success, and restore the previous value on failure.

- [ ] **Step 7: Re-run focused tests**

Run the Step 2 command.

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add domain.js auth.js admin.js supabase/functions/manage-staff/index.ts supabase/migrations/20260905_boss_role.sql tests/domain.test.js tests/auth-structure.test.js tests/admin-structure.test.js tests/edge-functions-structure.test.js
git commit -m "feat: add Boss admin parity"
```

---

### Task 2: Create the landing content model, RLS, RPCs, Storage, and seed

**Files:**
- Create: `tests/landing-schema.test.js`
- Create: `supabase/migrations/20260905_landing_content.sql`
- Create: `supabase/tests/landing-rls-smoke.sql`

**Interfaces:**
- Produces tables `landing_versions` and `landing_sections`.
- Maintains exactly one row with `status = 'draft'` and one with `status = 'published'` via a unique constraint on `status`.
- Produces RPC `save_landing_draft(sections_payload jsonb)` for atomic draft replacement.
- Produces RPC `publish_landing()` that transactionally replaces the published section set with the current draft section set.
- Produces RPC `landing_media_is_referenced(media_path text)` for safe cleanup decisions.
- Creates public Storage bucket `landing-media`; object writes are Admin/Boss-only through `public.is_admin()`.
- Seeds both published and draft versions with the current `index.html` landing content so the first editor load matches the existing site.

- [ ] **Step 1: Write migration structure tests**

Create `tests/landing-schema.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('landing migration creates draft/published content with transactional RPCs', async () => {
  const sql = await read('supabase/migrations/20260905_landing_content.sql')
  assert.match(sql, /create table(?: if not exists)? public\.landing_versions/i)
  assert.match(sql, /create table(?: if not exists)? public\.landing_sections/i)
  assert.match(sql, /status[^\n]+check[^\n]+draft[^\n]+published/i)
  assert.match(sql, /create or replace function public\.save_landing_draft\(sections_payload jsonb\)/i)
  assert.match(sql, /create or replace function public\.publish_landing\(\)/i)
  assert.match(sql, /landing_media_is_referenced/i)
  assert.match(sql, /landing-media/)
})

test('anonymous users can only read published visible sections', async () => {
  const sql = await read('supabase/migrations/20260905_landing_content.sql')
  assert.match(sql, /landing_versions_public_select/i)
  assert.match(sql, /status = 'published'/i)
  assert.match(sql, /landing_sections_public_select/i)
  assert.match(sql, /visible = true/i)
  assert.match(sql, /public\.is_admin\(\)/i)
})
```

- [ ] **Step 2: Run the new test and verify RED**

Run:

```bash
node --test tests/landing-schema.test.js
```

Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Create the tables and indexes**

Core schema in `20260905_landing_content.sql`:

```sql
create table if not exists public.landing_versions (
  id uuid primary key default gen_random_uuid(),
  status text not null unique check (status in ('draft', 'published')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create table if not exists public.landing_sections (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.landing_versions(id) on delete cascade,
  type text not null,
  position integer not null check (position >= 0),
  visible boolean not null default true,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists landing_sections_version_position_idx
  on public.landing_sections(version_id, position);
```

Attach the existing `public.set_updated_at()` trigger to both new tables.

- [ ] **Step 4: Implement public/manager RLS**

Enable RLS and use separate public and manager policies. The public version policy must require `status = 'published'`. The public section policy must require both `visible = true` and an owning version with `status = 'published'`. Manager policies must use `public.is_admin()` for select/insert/update/delete.

Grant anonymous users SELECT on the two landing tables only; RLS prevents draft access. Grant authenticated users the needed table privileges, with RLS deciding Manager vs non-Manager access.

- [ ] **Step 5: Implement atomic draft save**

`save_landing_draft` must be `security definer`, set `search_path = public`, reject callers for whom `public.is_admin()` is false, validate that `sections_payload` is a JSON array, delete only the existing draft sections, and insert the supplied rows with normalized zero-based positions.

The insertion shape is:

```sql
select
  draft_id,
  coalesce(item->>'type', ''),
  ordinality - 1,
  coalesce((item->>'visible')::boolean, true),
  coalesce(item->'content', '{}'::jsonb)
from jsonb_array_elements(sections_payload) with ordinality as payload(item, ordinality)
```

Reject an empty `type` before the insert.

- [ ] **Step 6: Implement atomic publish**

`publish_landing()` must lock both version rows, validate that the draft contains at least one visible section, delete the current published sections, copy every draft section in order into the published version, and update `published_at` only inside the same transaction/function call. Any exception must roll back automatically, leaving the old public content intact.

- [ ] **Step 7: Create Storage bucket and policies**

Insert the bucket id/name `landing-media` with `public = true`. Add `storage.objects` INSERT/UPDATE/DELETE policies restricted to authenticated callers for whom `public.is_admin()` is true and `bucket_id = 'landing-media'`. Do not add public write policies.

Create `landing_media_is_referenced(media_path text)` that checks both draft and published JSON with recursive JSONPath equality and returns true while any `landing_sections.content` value contains that exact path.

- [ ] **Step 8: Seed the current landing exactly once**

The migration must insert one `published` version and one `draft` version with `on conflict (status) do nothing`, then insert the current landing sections only when that version has no sections.

Seed the current visible structure in the same order as `index.html`:

```text
hero
metrics
routes
services
business
culture
objectives
jobs
employment
about/timeline
resources/gallery
contact
faq
```

Use the existing Spanish text, existing `data-en` English text, existing links, and existing asset paths from `index.html`. Map repeated layouts onto the approved templates (`cards`, `text_image`, `cta`, `gallery`) while keeping section-specific `variant` values in `content` so the renderer can preserve current classes/styles. Include `assets/hero-professional.webp` / `.png` references for the Hero. Seed the same content into draft and published so the first public render and first editor load are identical.

- [ ] **Step 9: Add manual SQL smoke checks**

`supabase/tests/landing-rls-smoke.sql` must run in a transaction and verify:

```sql
set local role anon;
select * from public.landing_versions where status = 'published';
select * from public.landing_sections where visible = true;
```

Then assert there are zero anonymously visible draft versions/sections. Also inspect `pg_policies` to assert Storage INSERT/UPDATE/DELETE policies call `public.is_admin()` and are scoped to `landing-media`. End with `rollback;`.

- [ ] **Step 10: Run tests**

Run:

```bash
node --test tests/landing-schema.test.js tests/schema.test.js
```

Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add supabase/migrations/20260905_landing_content.sql supabase/tests/landing-rls-smoke.sql tests/landing-schema.test.js tests/schema.test.js
git commit -m "feat: add landing content storage and publishing"
```

---

### Task 3: Add pure landing template and editing helpers

**Files:**
- Create: `tests/landing-content.test.js`
- Create: `landing-content.js`

**Interfaces:**
- Produces `LANDING_TEMPLATES` keyed by `hero`, `metrics`, `cards`, `text_image`, `routes`, `jobs`, `gallery`, `testimonials`, `cta`, `contact`, and `faq`.
- Produces `localized(es, en)`, `localizedValue(value, locale)`, `createSection(type, id)`, `normalizeSectionPositions(sections)`, `moveSection(sections, id, delta)`, `duplicateSection(sections, id, newId)`, and `removeSection(sections, id)`.
- A section is `{ id, type, position, visible, content }`.
- `faq` is included because the current landing already contains an FAQ; this is required to preserve the current site and is not a new public feature.

- [ ] **Step 1: Write pure behavior tests**

Create tests that assert:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createSection,
  duplicateSection,
  localizedValue,
  moveSection,
  normalizeSectionPositions,
} from '../landing-content.js'

test('English content falls back to Spanish', () => {
  assert.equal(localizedValue({ es: 'Hola', en: '' }, 'en'), 'Hola')
  assert.equal(localizedValue({ es: 'Hola', en: 'Hello' }, 'en'), 'Hello')
})

test('moving sections always rewrites contiguous positions', () => {
  const source = [
    { id: 'a', position: 0 },
    { id: 'b', position: 1 },
    { id: 'c', position: 2 },
  ]
  assert.deepEqual(moveSection(source, 'b', -1).map(({ id, position }) => [id, position]), [
    ['b', 0], ['a', 1], ['c', 2],
  ])
})

test('duplicating a section creates a new id directly after the source', () => {
  const result = duplicateSection([{ id: 'a', type: 'hero', position: 0, visible: true, content: { title: { es: 'X', en: '' } } }], 'a', 'copy')
  assert.equal(result[1].id, 'copy')
  assert.equal(result[1].position, 1)
  assert.deepEqual(result[1].content, result[0].content)
  assert.notEqual(result[1].content, result[0].content)
})
```

Also assert every approved template can be created with a deterministic initial `content` object and no executable HTML fields.

- [ ] **Step 2: Run test and verify RED**

Run:

```bash
node --test tests/landing-content.test.js
```

Expected: FAIL because `landing-content.js` does not exist.

- [ ] **Step 3: Implement localized-value helpers and immutable section operations**

Use deep cloning through `structuredClone()` for duplicated/default content. `localizedValue` must trim neither language automatically; the editor owns input trimming so intentional spacing is not silently changed.

- [ ] **Step 4: Define template field schemas for the editor**

Each template entry must expose a human-readable label and field schema. Example:

```js
hero: {
  label: 'Portada',
  fields: [
    { key: 'eyebrow', label: 'Texto pequeño', type: 'localizedText' },
    { key: 'title', label: 'Título', type: 'localizedText' },
    { key: 'highlight', label: 'Palabras destacadas', type: 'localizedText' },
    { key: 'description', label: 'Descripción', type: 'localizedTextarea' },
    { key: 'primaryButton', label: 'Botón principal', type: 'localizedLink' },
    { key: 'secondaryButton', label: 'Enlace secundario', type: 'localizedLink' },
    { key: 'image', label: 'Foto principal', type: 'image' },
  ],
  defaults: { ... }
}
```

Use a separate `highlight` value instead of storing `<em>` markup so Admin/Boss never types HTML. The renderer will safely emphasize the first matching phrase.

For repeated-card templates (`metrics`, `cards`, `routes`, `gallery`, `testimonials`, `faq`) define array item schemas so the editor can add/remove/reorder items without understanding JSON.

- [ ] **Step 5: Run pure tests**

Run the Step 2 command.

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add landing-content.js tests/landing-content.test.js
git commit -m "feat: add landing template model"
```

---

### Task 4: Add the landing data/Storage browser API

**Files:**
- Create: `landing-api.js`
- Create: `tests/landing-api-structure.test.js`

**Interfaces:**
- Produces `getPublishedLanding()` → `{ version, sections }` sorted by position.
- Produces `getDraftLanding()` → `{ version, sections }` sorted by position; RLS restricts it to Admin/Boss.
- Produces `saveDraft(sections)` → calls `save_landing_draft` RPC with normalized payload.
- Produces `publishDraft()` → calls `publish_landing` RPC.
- Produces `uploadLandingImage(file)` → `{ path, publicUrl }`.
- Produces `removeLandingImage(path)` → only removes the Storage object when `landing_media_is_referenced(path)` returns false.
- Produces `publicLandingImageUrl(path)`.

- [ ] **Step 1: Write structural tests**

`tests/landing-api-structure.test.js` must assert that `landing-api.js` exports all six functions, queries `landing_versions`/`landing_sections`, calls both RPC names, and uses `supabase.storage.from('landing-media')`.

Also assert the upload path is generated rather than trusting the local filename directly. The implementation path shape must be:

```js
const extension = safeExtension(file.name)
const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`
```

Supported extensions: `jpg`, `jpeg`, `png`, `webp`, `gif`. Reject other extensions and files larger than 10 MB before sending them to Supabase.

- [ ] **Step 2: Run test and verify RED**

Run:

```bash
node --test tests/landing-api-structure.test.js
```

Expected: FAIL because `landing-api.js` does not exist.

- [ ] **Step 3: Implement read APIs**

`getPublishedLanding` queries exactly the `published` version and its visible sections. `getDraftLanding` queries exactly the `draft` version and all of its sections. Both return sections sorted numerically by `position`.

Do not silently fall back from draft to published inside `getDraftLanding`; Preview and Editor need an explicit error if the protected draft cannot be read.

- [ ] **Step 4: Implement save/publish API**

Before `saveDraft`, call `normalizeSectionPositions`. Send only `{ type, visible, content }` for each section to the RPC; server-side ordinality is the source of positions.

`publishDraft` must contain only the RPC call and error handling; do not emulate publishing with multiple browser updates.

- [ ] **Step 5: Implement image API**

Use `storage.upload(path, file, { cacheControl: '31536000', upsert: false })`. Return the public URL with `getPublicUrl(path)`.

`removeLandingImage(path)` must first call `landing_media_is_referenced`. If referenced, return `{ removed: false, reason: 'in-use' }`; otherwise call Storage `remove([path])` and return `{ removed: true }`.

- [ ] **Step 6: Run test**

Run the Step 2 command.

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add landing-api.js tests/landing-api-structure.test.js
git commit -m "feat: add landing content API"
```

---

### Task 5: Build the safe shared renderer and public bootstrap

**Files:**
- Create: `landing-renderer.js`
- Create: `landing-bootstrap.js`
- Create: `tests/landing-structure.test.js`
- Modify: `index.html`
- Modify: `app.js`

**Interfaces:**
- Produces `renderLanding(root, sections, { locale = 'es' } = {})`.
- Produces one renderer per template type with no use of untrusted `innerHTML` for free-form Admin/Boss text.
- `landing-bootstrap.js` calls `getPublishedLanding`; only after success does it replace the fallback `<main id="landing-root">`. On failure it leaves static markup untouched. It then dynamically imports `./app.js` so language/filter/contact bindings always attach to the final DOM.
- Renderer preserves the DOM contracts already used by `app.js`: `#language`, `.filter`, `#job-list`, `#job-search`, `.audience`, `#contact-form`, `#employment-form`, section ids such as `#vacantes`, and current CSS class names/variants.

- [ ] **Step 1: Write renderer/bootstrap structure tests**

Assert that:

```js
const html = await read('index.html')
assert.match(html, /<main[^>]+id="landing-root"/)
assert.match(html, /type="module" src="landing-bootstrap\.js/)

const bootstrap = await read('landing-bootstrap.js')
assert.match(bootstrap, /getPublishedLanding/)
assert.match(bootstrap, /renderLanding/)
assert.match(bootstrap, /import\(['"]\.\/app\.js['"]\)/)
assert.match(bootstrap, /catch/)
```

Assert `landing-renderer.js` contains render branches for every template key from Task 3 and does not contain `eval`, `new Function`, or an Admin-content passthrough like `root.innerHTML = section.content`.

- [ ] **Step 2: Run test and verify RED**

Run:

```bash
node --test tests/landing-structure.test.js
```

Expected: FAIL because renderer/bootstrap files do not exist and `index.html` has no stable mount.

- [ ] **Step 3: Implement safe text/render primitives**

Build nodes with `document.createElement`, `.textContent`, `.dataset.es`, `.dataset.en`, and explicit attributes. Provide a helper that renders title highlighting by splitting the localized title around the configured localized `highlight` phrase and wrapping only that phrase in `<em>` created by DOM APIs.

Image content shape is `{ path, alt: { es, en } }`. If `path` starts with `assets/`, use it directly; otherwise resolve through `publicLandingImageUrl(path)`. Add `onerror` that hides the failed `<img>` or restores the template's built-in visual placeholder; do not throw and blank the whole landing.

- [ ] **Step 4: Implement template renderers that preserve current class contracts**

Map seeded variants to the existing CSS:

```text
hero -> .hero
metrics -> .metrics
routes -> .split-section / .route-grid
cards variant=services -> .services / .service-grid
text_image variant=business -> .business-section
text_image variant=culture -> .culture
cards variant=objectives -> .objectives
jobs -> .jobs / #job-list / #job-search / .filter
cta variant=employment -> .employment / #employment-form
text_image variant=about -> existing about/timeline classes
gallery variant=resources -> .news
contact -> .contact / #contact-form / .audience
faq -> .faq
```

Do not rewrite `styles.css` in this task; the renderer must adapt to the current styling hooks.

- [ ] **Step 5: Make `app.js` tolerant of optional sections**

Every direct query that assumes an editable section always exists must be guarded. For example:

```js
const jobSearch = document.querySelector('#job-search')
jobSearch?.addEventListener('input', ...)

const contactForm = document.querySelector('#contact-form')
contactForm?.addEventListener('submit', ...)
```

This is required because Boss/Admin may hide or remove Jobs, Contact, FAQ, or other sections.

- [ ] **Step 6: Add bootstrap to `index.html` while keeping the static fallback**

Add `id="landing-root"` to the existing `<main>`. Replace the direct `app.js` module tag with `landing-bootstrap.js`. Do not delete the current section markup; it remains the failure fallback and preserves a crawlable baseline.

- [ ] **Step 7: Run focused tests**

Run:

```bash
node --test tests/landing-structure.test.js tests/contact-structure.test.js tests/cloudflare-assets.test.js
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add landing-renderer.js landing-bootstrap.js index.html app.js tests/landing-structure.test.js
git commit -m "feat: render published landing content"
```

---

### Task 6: Build authenticated draft Preview

**Files:**
- Create: `preview.html`
- Create: `preview.js`
- Modify: `tests/landing-structure.test.js`

**Interfaces:**
- `preview.html` is `noindex,nofollow`, loads `styles.css`, contains `<main id="landing-root">`, and loads `preview.js`.
- `preview.js` calls `requireAdmin()`, then `getDraftLanding()`, then `renderLanding()`.
- Anonymous/recruiter access never receives draft data because both browser guard and RLS deny it.

- [ ] **Step 1: Add failing preview tests**

Extend `tests/landing-structure.test.js`:

```js
const previewHtml = await read('preview.html')
const previewJs = await read('preview.js')
assert.match(previewHtml, /noindex,nofollow/)
assert.match(previewHtml, /id="landing-root"/)
assert.match(previewJs, /requireAdmin/)
assert.match(previewJs, /getDraftLanding/)
assert.match(previewJs, /renderLanding/)
```

- [ ] **Step 2: Run and verify RED**

Run:

```bash
node --test tests/landing-structure.test.js
```

Expected: FAIL because Preview files do not exist.

- [ ] **Step 3: Implement Preview**

Use the exact public renderer from Task 5. Show a small fixed management-only banner outside `#landing-root` that says `Vista previa del borrador` with a link back to `admin.html`. Do not load `app.js` form-submit behaviors in Preview; preview is visual, not a place to submit real contact/application actions.

If the draft fails to load, show a user-facing message `No pudimos cargar la vista previa del borrador.` and keep the page noindex.

- [ ] **Step 4: Run test**

Run the Step 2 command.

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add preview.html preview.js tests/landing-structure.test.js
git commit -m "feat: add protected landing preview"
```

---

### Task 7: Replace Admin “Contenido” with the simple landing editor

**Files:**
- Create: `landing-editor.js`
- Create: `landing-editor.css`
- Modify: `admin.html`
- Modify: `admin.js`
- Modify: `data-api.js`
- Modify: `tests/admin-structure.test.js`
- Create: `tests/landing-editor-structure.test.js`

**Interfaces:**
- Produces `mountLandingEditor(root, { onError })`.
- Editor state owns a cloned in-memory draft until `Guardar borrador` succeeds.
- Top actions: `Guardar borrador`, `Vista previa`, `Publicar`.
- Each section card: name/summary, `Editar`, drag handle, and `•••` menu containing duplicate, hide/show, delete.
- `+ Agregar sección` opens the Task 3 template list.
- Text fields use `Español` / `Inglés` tabs; no JSON/HTML/Storage URL fields are exposed.

- [ ] **Step 1: Write failing panel/editor structure tests**

Update `tests/admin-structure.test.js` to assert:

```js
assert.doesNotMatch(html, /Datos centralizados|Backend conectado|Supabase Auth|\bRLS\b|Base de datos conectada/i)
assert.match(html, /Editar página principal/)
assert.match(html, /id="landing-editor"/)
assert.match(html, /landing-editor\.css/)
```

Create `tests/landing-editor-structure.test.js` and assert that `landing-editor.js` imports `LANDING_TEMPLATES`, `getDraftLanding`, `saveDraft`, `publishDraft`, and `uploadLandingImage`, and contains visible labels `Guardar borrador`, `Vista previa`, `Publicar`, `Agregar sección`, `Cambiar foto`, and `Eliminar foto`.

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
node --test tests/admin-structure.test.js tests/landing-editor-structure.test.js
```

Expected: FAIL because the old simple content form and technical notices remain.

- [ ] **Step 3: Replace only the Content view markup**

In `admin.html`, remove `#content-form` and replace it with:

```html
<section class="view" id="content">
  <div class="section-heading">
    <div>
      <p class="eyebrow">PÁGINA PRINCIPAL</p>
      <h2>Editar página principal</h2>
      <p>Cambia textos, fotos y secciones. La web no cambia hasta que publiques.</p>
    </div>
  </div>
  <div id="landing-editor" aria-live="polite"></div>
</section>
```

Load `landing-editor.css` after `admin.css`.

Remove the global “Datos centralizados” notice and replace the Settings technical readiness card with plain product language or remove that card entirely if it contains no actionable setting.

- [ ] **Step 4: Detach old landing fields from `site_settings`**

In `admin.js`, stop populating/submitting `brandName`, `contactEmail`, `contactPhone`, `whatsapp`, `heroTitle`, and `heroLead` through `#content-form`. Keep `site_settings` only for operational notification settings still used by the backend.

Initialize the editor after `requireAdmin()` succeeds:

```js
await mountLandingEditor(byId('landing-editor'), { onError: showError })
```

- [ ] **Step 5: Implement the simple section-list screen**

On mount, call `getDraftLanding()`, clone the returned sections, and render cards. Desktop drag should use the card handle and native drag events; provide explicit `Subir` / `Bajar` actions in the `•••` menu for touch/mobile accessibility. Both paths must call `normalizeSectionPositions`.

Hide/show changes only local draft state until Save. Delete requires one confirmation. Duplicate uses `crypto.randomUUID()` and inserts immediately after source.

- [ ] **Step 6: Implement the section editor form from template schemas**

Render only schema-defined fields. Localized fields have two tabs and store `{ es, en }`. Array fields have simple `Agregar` / `Eliminar` / `Subir` / `Bajar` item controls. Link fields expose human labels `Texto del botón` and `Destino`.

Do not allow `javascript:` destinations. Accept only fragment links (`#servicios`), same-site relative paths (`application.html`), `https://`, `mailto:`, and `tel:`.

- [ ] **Step 7: Implement image controls**

For every image field show thumbnail, `Cambiar foto`, and `Eliminar foto`; array image templates also show `Agregar foto`. On file selection, call `uploadLandingImage(file)` and update the in-memory content only after upload success. On failure keep the prior image reference untouched.

When removing/replacing a draft reference, add the old Storage path to an in-memory `cleanupCandidates` set but do not physically delete it yet because the published version may still use it.

- [ ] **Step 8: Implement Save / Preview / Publish**

`Guardar borrador`: call `saveDraft(sections)`, then show `Borrador guardado` only after success.

`Vista previa`: if there are unsaved changes, save first; then open `preview.html` in a new tab.

`Publicar`: if there are unsaved changes, save first; show one confirmation `¿Publicar estos cambios en la página principal?`; call `publishDraft()`; on success show `Cambios publicados` and process `cleanupCandidates` through `removeLandingImage` so only unreferenced files are deleted.

If publish fails, show `No pudimos publicar. La página anterior sigue activa.` and retain the editable draft.

- [ ] **Step 9: Style for simplicity and mobile**

`landing-editor.css` must keep the existing Admin visual language. Use a clear top action bar, one-column cards on small screens, large touch targets (minimum 44px height for main controls), image thumbnails, language tabs, and a focused edit panel. No infrastructure terminology belongs in visible copy.

- [ ] **Step 10: Run tests**

Run:

```bash
node --test tests/admin-structure.test.js tests/landing-editor-structure.test.js tests/landing-content.test.js
```

Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add admin.html admin.js admin.css data-api.js landing-editor.js landing-editor.css tests/admin-structure.test.js tests/landing-editor-structure.test.js
git commit -m "feat: add simple landing editor"
```

---

### Task 8: Verify migrated content, bilingual behavior, and failure fallback

**Files:**
- Modify: `tests/landing-structure.test.js`
- Modify: `tests/landing-content.test.js`
- Modify: `tests/production-safety.test.js`
- Modify: `README.md`

**Interfaces:**
- Confirms the seeded database representation can render the same current section order/classes.
- Confirms `data-en` continues working because renderer creates localized datasets before `app.js` initializes.
- Confirms static fallback remains visible if Supabase published-content fetch fails.

- [ ] **Step 1: Add current-site contract tests**

Assert the renderer preserves at least these current IDs/classes used by CSS/JS:

```text
.hero
.metrics
.split-section
.services
#servicios
#vacantes
#job-list
#job-search
.employment
.contact
#contact-form
.faq
```

Assert generated localized elements set both `dataset.es` and `dataset.en`, with `en` receiving the Spanish fallback when the stored English value is empty.

- [ ] **Step 2: Add failure-fallback structural test**

Assert `landing-bootstrap.js` catches `getPublishedLanding()` failures without clearing `#landing-root`, and imports `app.js` in both success and failure paths.

- [ ] **Step 3: Extend production safety checks**

Add new browser files to the no-secret/no-localStorage scan:

```js
'landing-content.js',
'landing-api.js',
'landing-renderer.js',
'landing-bootstrap.js',
'landing-editor.js',
'preview.js',
```

- [ ] **Step 4: Update deployment documentation**

`README.md` must document this exact release order:

```text
1. Run 20260905_boss_role.sql in Supabase.
2. Run 20260905_landing_content.sql in Supabase.
3. Run supabase/tests/landing-rls-smoke.sql and confirm it completes inside its rollback transaction.
4. Redeploy manage-staff so Boss authorization is live.
5. Confirm Storage bucket landing-media exists and is public-read / manager-write.
6. Deploy the frontend/Cloudflare build.
7. Log in as Admin, open Editar página principal, save a draft, preview it, then publish one harmless text change.
8. Confirm an anonymous browser sees only the published result and cannot access draft data.
```

Also document how to promote an existing profile to Boss from Team; invitation itself still creates Recruiter.

- [ ] **Step 5: Run the complete local verification suite**

Run:

```bash
npm test
npm run check:deploy
npm run test:assets
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

```bash
git add tests README.md
git commit -m "test: verify landing editor release"
```

---

### Task 9: Production verification before merge

**Files:**
- No source changes unless verification exposes a defect.

**Interfaces:**
- Produces evidence that database authorization, draft/public isolation, image writes, Preview, and Cloudflare rendering work end-to-end.

- [ ] **Step 1: Verify database migration in Supabase**

Confirm:
- `profiles.role` accepts `admin`, `boss`, `recruiter` only;
- `public.is_admin()` returns true for an active Boss session;
- `landing_versions` has one draft and one published row;
- both versions have seeded sections;
- anonymous SQL smoke sees published but not draft content.

- [ ] **Step 2: Verify Admin and Boss parity manually**

Using one Admin account and one Boss account, verify both can:
- enter `admin.html`;
- open Editar página principal;
- save a draft;
- open Preview;
- publish;
- upload/change/remove a photo;
- change another existing user's role or active state.

Verify Recruiter cannot perform those operations through direct Supabase requests even if UI controls are manually invoked from DevTools.

- [ ] **Step 3: Verify editorial isolation**

Make a visible draft-only title change. In a separate incognito browser, confirm the public landing still shows the old published title. Open Preview while authenticated and confirm it shows the draft title. Publish, then confirm the incognito browser shows the new title.

- [ ] **Step 4: Verify image lifecycle**

Upload a new image from the editor, save draft, preview it, and confirm the published page still uses the old image. Publish and confirm the public page uses the new image. Remove an image from draft and verify Storage deletion is deferred while the published version still references it.

- [ ] **Step 5: Verify language and optional-section resilience**

Switch ES→EN on the public site after a publish. Confirm translated values appear and an intentionally blank English test field falls back to Spanish. Hide one optional section, publish, and confirm `app.js` produces no console error because the corresponding DOM hook is absent.

- [ ] **Step 6: Verify fallback behavior**

Temporarily block the Supabase request in browser DevTools and reload the landing. Confirm the existing static `index.html` fallback remains usable rather than a blank page.

- [ ] **Step 7: Capture final CI evidence**

Push the implementation branch / open the PR and wait for the GitHub Actions `Tests` workflow on the final head commit. Do not call the feature complete until the workflow conclusion is `success` and the three local verification commands from Task 8 have also passed.

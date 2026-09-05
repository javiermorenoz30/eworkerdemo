# Landing Editor + Boss Role Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `boss` role with full Admin parity and turn the existing Admin “Contenido” area into a simple, bilingual landing-page editor with image uploads, templates, draft preview, and atomic publishing.

**Architecture:** Keep the current static site and CSS as the rendering base, but move editable landing content into two Supabase versions (`draft` and `published`) composed of ordered `landing_sections` rows. The public site reads only published content and keeps the current `index.html` markup as a safe fallback; Admin/Boss edit the draft, Preview reads the draft behind authentication, and Publish transactionally copies the draft into the published version. Images live in a public-read `landing-media` Storage bucket while all writes remain Admin/Boss-only.

**Tech Stack:** Static HTML/CSS/ES modules, `@supabase/supabase-js@2`, Supabase Postgres/RLS/RPC/Storage/Auth, Deno Edge Functions, Cloudflare Workers static deployment, Node built-in `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-05-landing-editor-boss-design.md`

## Global Constraints

- `boss` and `admin` must have exactly the same effective permissions.
- The editor applies only to the public landing page; internal application/login/legal pages remain outside the editor.
- Editing is template-based; never expose arbitrary HTML, CSS, JavaScript, JSON, or Storage URLs to the owner.
- The workflow is **Borrador → Vista previa → Publicar**.
- The public site may read only published content; draft content is readable only by authenticated Admin/Boss users.
- Keep Spanish and English content. Empty English fields fall back to Spanish.
- Store uploaded landing images in Supabase Storage bucket `landing-media`; only Admin/Boss may upload, replace, or delete objects.
- Preserve the current public visual design as the base and keep the current static landing markup as a fallback when the content service cannot load.
- Remove visible technical wording such as “Datos centralizados”, “Backend conectado”, “Supabase Auth”, “RLS”, “Base de datos conectada”, and unnecessary “Supabase” infrastructure copy from the management UI.
- Do not broaden invitation behavior: invited accounts remain `recruiter`; Boss creation is handled by changing an existing profile role.
- Do not edit `supabase/migrations/20260904_initial_production_schema.sql`; production changes use follow-up migrations.
- Do not commit Supabase service-role keys, database passwords, or other secrets.

---

## File Map

**Create**
- `supabase/migrations/2026090501_boss_role.sql` — expands valid roles and makes database Admin checks include Boss.
- `supabase/migrations/2026090502_landing_content.sql` — landing versions/sections, RLS, transactional draft save/publish RPCs, Storage bucket/policies, and initial content seed.
- `supabase/tests/landing-rls-smoke.sql` — public/draft and Storage-policy security smoke checks.
- `landing-content.js` — pure template definitions and immutable draft manipulation helpers.
- `landing-api.js` — browser API for published/draft content, save/publish RPCs, and Storage media operations.
- `landing-renderer.js` — safe DOM renderer for all landing section templates.
- `landing-bootstrap.js` — public bootstrap: replace fallback markup only after published content loads successfully, then start `app.js`.
- `landing-editor.js` — Admin/Boss editor UI and interactions.
- `landing-editor.css` — focused editor styles, including mobile behavior.
- `preview.html` — authenticated noindex draft preview shell.
- `preview.js` — Admin/Boss guard + draft renderer.
- `tests/landing-content.test.js` — pure template/reorder/localization tests.
- `tests/landing-api-structure.test.js` — landing API/Storage contract checks.
- `tests/landing-structure.test.js` — public renderer/bootstrap/preview structure checks.
- `tests/landing-schema.test.js` — migration/RLS/RPC/Storage structure checks.
- `tests/landing-editor-structure.test.js` — management-editor structure/copy checks.

**Modify**
- `domain.js` — reusable Admin/Boss role helper and Boss routing.
- `auth.js` — allow active Boss through Admin guard.
- `admin.html` — replace simple content form with editor mount; remove technical warnings; load editor stylesheet.
- `admin.js` — label Boss correctly, expose profile role change for existing users, initialize the landing editor, remove old Hero/content settings bindings.
- `admin.css` — remove obsolete technical-readiness styling after its markup is removed; retain general panel styles.
- `data-api.js` — keep operational/settings API and narrow `updateSiteSettings` to notification-only fields.
- `index.html` — give the public `<main>` a stable mount id and load `landing-bootstrap.js` instead of starting `app.js` directly; retain full static fallback markup.
- `app.js` — preserve existing language/filter/contact behaviors and guard DOM lookups for optional/hidden sections.
- `supabase/functions/manage-staff/index.ts` — allow Boss callers with the same privilege as Admin; invitation still creates Recruiter.
- `tests/domain.test.js` — Boss routing/manager-role tests.
- `tests/auth-structure.test.js` — Boss Admin-guard structural assertions.
- `tests/admin-structure.test.js` — editor mount, warning removal, and role-control assertions.
- `tests/edge-functions-structure.test.js` — Boss authorization in `manage-staff`.
- `tests/schema.test.js` — ensure the historical migration stays intact and follow-up migrations exist.
- `tests/production-safety.test.js` — include new browser modules in no-secret/no-localStorage checks.
- `README.md` — deployment order for migrations, Edge Function redeploy, Storage, and frontend.

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
- Create: `supabase/migrations/2026090501_boss_role.sql`

**Interfaces:**
- Produces `MANAGER_ROLES = ['admin', 'boss']` and `isManagerProfile(profile)` from `domain.js`.
- `routeForProfile({ role: 'boss', active: true })` returns `admin.html`.
- `requireAdmin()` authorizes active Admin or Boss.
- Database helper `public.is_admin()` keeps its existing name but returns true for active `admin` or `boss`; existing Admin RLS policies therefore inherit Boss parity.
- Existing invitation remains Recruiter-only, but `manage-staff` accepts either Admin or Boss as caller.

- [ ] **Step 1: Write the failing Boss role tests**

Update the import in `tests/domain.test.js` and add:

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

Add these structural checks:

```js
// tests/auth-structure.test.js
assert.match(auth, /isManagerProfile/)

// tests/edge-functions-structure.test.js
assert.match(code, /\['admin',\s*'boss'\]\.includes\(callerProfile\?\.role\)/)
```

In `tests/admin-structure.test.js`, assert `admin.js` contains `Administrador`, `Boss`, `Reclutador`, and `data-staff-role`.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
node --test tests/domain.test.js tests/auth-structure.test.js tests/admin-structure.test.js tests/edge-functions-structure.test.js
```

Expected: FAIL because Boss is not yet routed/authorized/labeled.

- [ ] **Step 3: Implement the shared manager helper**

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

Update `auth.js` to import `isManagerProfile` and use it inside `requireAdmin()` instead of checking only `profile.role === 'admin'`.

- [ ] **Step 4: Add the production-safe role migration**

Create `supabase/migrations/2026090501_boss_role.sql`:

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

Keep the invitation profile upsert as `role: 'recruiter'`.

- [ ] **Step 6: Add an existing-user role selector in Team**

In `admin.js` define:

```js
const staffRoles = [
  ['admin', 'Administrador'],
  ['boss', 'Boss'],
  ['recruiter', 'Reclutador'],
]
```

Render `<select data-staff-role="PROFILE_ID">` beside each profile. Disable the current session profile selector so the active user cannot accidentally demote their own account. On change call `updateProfile(profile.id, { role: target.value })`, update local state only after success, and restore the previous value on failure.

- [ ] **Step 7: Re-run focused tests**

Run the Step 2 command.

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add domain.js auth.js admin.js supabase/functions/manage-staff/index.ts supabase/migrations/2026090501_boss_role.sql tests/domain.test.js tests/auth-structure.test.js tests/admin-structure.test.js tests/edge-functions-structure.test.js
git commit -m "feat: add Boss admin parity"
```

---

### Task 2: Create the landing content model, RLS, RPCs, Storage, and initial seed

**Files:**
- Create: `tests/landing-schema.test.js`
- Create: `supabase/migrations/2026090502_landing_content.sql`
- Create: `supabase/tests/landing-rls-smoke.sql`
- Modify: `tests/schema.test.js`

**Interfaces:**
- Produces tables `landing_versions` and `landing_sections`.
- Maintains exactly one row with `status = 'draft'` and one with `status = 'published'` through a unique `status` constraint.
- Produces RPC `save_landing_draft(sections_payload jsonb)` for atomic draft replacement.
- Produces RPC `publish_landing()` that transactionally replaces the published section set with the current draft section set.
- Produces RPC `landing_media_is_referenced(media_path text)` for safe media cleanup decisions.
- Creates public-read Storage bucket `landing-media`; object writes are Admin/Boss-only through `public.is_admin()`.
- Seeds both published and draft versions with the current `index.html` content so the first editor load and first dynamic public render match the current site.

- [ ] **Step 1: Write migration structure tests**

Create `tests/landing-schema.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('landing migration creates draft/published content with transactional RPCs', async () => {
  const sql = await read('supabase/migrations/2026090502_landing_content.sql')
  assert.match(sql, /create table(?: if not exists)? public\.landing_versions/i)
  assert.match(sql, /create table(?: if not exists)? public\.landing_sections/i)
  assert.match(sql, /status[^\n]+check[^\n]+draft[^\n]+published/i)
  assert.match(sql, /create or replace function public\.save_landing_draft\(sections_payload jsonb\)/i)
  assert.match(sql, /create or replace function public\.publish_landing\(\)/i)
  assert.match(sql, /create or replace function public\.landing_media_is_referenced\(media_path text\)/i)
  assert.match(sql, /landing-media/)
})

test('anonymous users can only read published visible sections', async () => {
  const sql = await read('supabase/migrations/2026090502_landing_content.sql')
  assert.match(sql, /landing_versions_public_select/i)
  assert.match(sql, /status = 'published'/i)
  assert.match(sql, /landing_sections_public_select/i)
  assert.match(sql, /visible = true/i)
  assert.match(sql, /public\.is_admin\(\)/i)
})
```

Update `tests/schema.test.js` to keep testing the historical migration and additionally assert both follow-up migration files exist; do not rewrite the old schema assertions to point at the new files.

- [ ] **Step 2: Run the new tests and verify RED**

Run:

```bash
node --test tests/landing-schema.test.js tests/schema.test.js
```

Expected: FAIL because the new migration does not exist.

- [ ] **Step 3: Create tables and indexes**

Core schema in `2026090502_landing_content.sql`:

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

Enable RLS on both tables. Create:

```sql
create policy landing_versions_public_select
on public.landing_versions for select
to anon, authenticated
using (status = 'published');

create policy landing_versions_manager_all
on public.landing_versions for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
```

For `landing_sections_public_select`, require `visible = true` and an owning `landing_versions` row with `status = 'published'`. Add a separate authenticated manager-all policy using `public.is_admin()`.

Grant SELECT on both landing tables to `anon, authenticated`; grant INSERT/UPDATE/DELETE only to `authenticated`. RLS decides whether authenticated non-managers can use those grants.

- [ ] **Step 5: Implement atomic draft save**

`save_landing_draft` must be `security definer`, set `search_path = public`, reject callers when `public.is_admin()` is false, require a JSON array, delete only current draft sections, and insert supplied rows with server-normalized zero-based positions.

Use this insertion shape:

```sql
select
  draft_id,
  item->>'type',
  ordinality - 1,
  coalesce((item->>'visible')::boolean, true),
  coalesce(item->'content', '{}'::jsonb)
from jsonb_array_elements(sections_payload) with ordinality as payload(item, ordinality)
```

Reject any element whose `type` is null/blank before deleting the old draft. Update the draft version's `created_by = auth.uid()` and `updated_at = now()` only after validation passes.

- [ ] **Step 6: Implement atomic publish**

`publish_landing()` must lock both version rows, validate that the draft contains at least one visible section, delete current published sections, copy every draft section in order into the published version, and update `published_at = now()` inside the same function call. Any exception must roll back automatically so the previous public content remains intact.

- [ ] **Step 7: Create Storage bucket, policies, and media-reference RPC**

Insert bucket id/name `landing-media` with `public = true`. Add `storage.objects` INSERT/UPDATE/DELETE policies restricted to `authenticated`, `bucket_id = 'landing-media'`, and `public.is_admin()`.

`landing_media_is_referenced(media_path text)` must be a manager-only `security definer` RPC that uses JSONPath recursive equality against `landing_sections.content` and returns true while any draft or published section references the exact Storage path.

After creating all three RPCs, lock down execution:

```sql
revoke all on function public.save_landing_draft(jsonb) from public;
revoke all on function public.publish_landing() from public;
revoke all on function public.landing_media_is_referenced(text) from public;
grant execute on function public.save_landing_draft(jsonb) to authenticated;
grant execute on function public.publish_landing() to authenticated;
grant execute on function public.landing_media_is_referenced(text) to authenticated;
```

- [ ] **Step 8: Seed the current landing exactly once**

Insert one `published` and one `draft` version with `on conflict (status) do nothing`. Insert seed sections only when the target version has no rows.

Translate the current `index.html` into these ordered records:

```text
0 hero
1 metrics
2 routes
3 cards        variant=services
4 text_image   variant=business
5 text_image   variant=culture
6 cards        variant=objectives
7 jobs
8 cta          variant=employment
9 text_image   variant=about
10 gallery     variant=resources
11 contact
12 faq
```

For every record copy the current visible Spanish content, current `data-en` English content, links, ids/variant data needed by the renderer, and existing asset references from `index.html`. Hero starts with `assets/hero-professional.webp` as primary media and keeps `assets/hero-professional.png` as its fallback asset. Seed identical JSON into draft and published versions so there is no visual change before the first edit.

- [ ] **Step 9: Add manual SQL smoke checks**

Create `supabase/tests/landing-rls-smoke.sql` inside `begin; ... rollback;`. Under `set local role anon`, verify the published version and visible published sections can be selected. Assert a query for `status = 'draft'` returns zero rows. Inspect `pg_policies` to assert Storage INSERT/UPDATE/DELETE policies are scoped to `landing-media` and call `public.is_admin()`.

- [ ] **Step 10: Run tests**

Run:

```bash
node --test tests/landing-schema.test.js tests/schema.test.js
```

Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add supabase/migrations/2026090502_landing_content.sql supabase/tests/landing-rls-smoke.sql tests/landing-schema.test.js tests/schema.test.js
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
- `faq` is included because the current landing already contains FAQ content and must survive migration.

- [ ] **Step 1: Write pure behavior tests**

Create `tests/landing-content.test.js` with:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { createSection, duplicateSection, localizedValue, moveSection } from '../landing-content.js'

test('English content falls back to Spanish', () => {
  assert.equal(localizedValue({ es: 'Hola', en: '' }, 'en'), 'Hola')
  assert.equal(localizedValue({ es: 'Hola', en: 'Hello' }, 'en'), 'Hello')
})

test('moving sections rewrites contiguous positions', () => {
  const source = [
    { id: 'a', position: 0 },
    { id: 'b', position: 1 },
    { id: 'c', position: 2 },
  ]
  assert.deepEqual(moveSection(source, 'b', -1).map(({ id, position }) => [id, position]), [
    ['b', 0], ['a', 1], ['c', 2],
  ])
})

test('duplicating creates an independent copy immediately after the source', () => {
  const result = duplicateSection([
    { id: 'a', type: 'hero', position: 0, visible: true, content: { title: { es: 'X', en: '' } } },
  ], 'a', 'copy')
  assert.equal(result[1].id, 'copy')
  assert.equal(result[1].position, 1)
  assert.deepEqual(result[1].content, result[0].content)
  assert.notEqual(result[1].content, result[0].content)
})

test('Hero defaults are safe structured fields instead of HTML', () => {
  const section = createSection('hero', 'hero-1')
  assert.equal(section.type, 'hero')
  assert.deepEqual(section.content.title, { es: 'Tu título principal', en: '' })
  assert.equal('html' in section.content, false)
})
```

Add one test that calls `createSection()` for every key in `LANDING_TEMPLATES` and asserts it returns deterministic structured content.

- [ ] **Step 2: Run test and verify RED**

Run:

```bash
node --test tests/landing-content.test.js
```

Expected: FAIL because `landing-content.js` does not exist.

- [ ] **Step 3: Implement localized-value helpers and immutable section operations**

Use `structuredClone()` for duplicated/default content. `localizedValue({ es, en }, 'en')` returns `en` only when it is non-empty; otherwise it returns `es`. `moveSection` clamps movement at list boundaries and always returns positions `0..n-1`.

- [ ] **Step 4: Define the editor template schemas**

The Hero definition must be concrete:

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
  defaults: {
    eyebrow: { es: 'BPO · NEARSHORING · LA VEGA, RD', en: 'BPO · NEARSHORING · LA VEGA, DR' },
    title: { es: 'Conectamos talento dominicano con oportunidades globales.', en: 'Connecting Dominican talent with global opportunities.' },
    highlight: { es: 'talento dominicano', en: 'Dominican talent' },
    description: { es: 'Operaciones de customer experience, televentas y soporte diseñadas para crecer con precisión, humanidad y velocidad.', en: 'Customer experience, telesales and support operations designed to grow with precision, humanity and speed.' },
    primaryButton: { text: { es: 'Escalar mi operación', en: 'Scale my operation' }, href: '#empresas' },
    secondaryButton: { text: { es: 'Encuentra tu próxima oportunidad', en: 'Find your next opportunity' }, href: '#vacantes' },
    image: {
      path: 'assets/hero-professional.webp',
      fallbackPath: 'assets/hero-professional.png',
      alt: { es: 'Profesional dominicana conectada a una red global de oportunidades', en: 'Dominican professional connected to a global opportunity network' },
    },
  },
}
```

Use a separate localized `highlight` instead of HTML markup. Define repeated-item schemas for `metrics`, `cards`, `routes`, `gallery`, `testimonials`, and `faq`, with add/remove/reorder support. Define simple structured defaults for `text_image`, `jobs`, `cta`, and `contact` using the same field types (`localizedText`, `localizedTextarea`, `localizedLink`, `image`, `items`).

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
- Produces `getDraftLanding()` → `{ version, sections }` sorted by position; RLS restricts draft access to Admin/Boss.
- Produces `saveDraft(sections)` → calls `save_landing_draft` RPC with normalized payload.
- Produces `publishDraft()` → calls `publish_landing` RPC.
- Produces `uploadLandingImage(file)` → `{ path, publicUrl }`.
- Produces `removeLandingImage(path)` → removes Storage only when `landing_media_is_referenced(path)` returns false.
- Produces `publicLandingImageUrl(path)`.

- [ ] **Step 1: Write structural tests**

`tests/landing-api-structure.test.js` must assert that `landing-api.js` exports all seven functions, queries `landing_versions` / `landing_sections`, calls both save/publish RPC names, calls `landing_media_is_referenced`, and uses `supabase.storage.from('landing-media')`.

Assert uploads generate their own path:

```js
const extension = safeExtension(file.name)
const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`
```

Supported extensions are `jpg`, `jpeg`, `png`, `webp`, `gif`. Reject other extensions and files larger than 10 MB before upload.

- [ ] **Step 2: Run test and verify RED**

Run:

```bash
node --test tests/landing-api-structure.test.js
```

Expected: FAIL because `landing-api.js` does not exist.

- [ ] **Step 3: Implement read APIs**

`getPublishedLanding` reads exactly the `published` version and its visible sections. `getDraftLanding` reads exactly the `draft` version and all its sections. Both sort numerically by `position` and throw on Supabase errors.

Do not fall back from draft to published inside `getDraftLanding`; Preview and Editor need an explicit protected-draft error.

- [ ] **Step 4: Implement save/publish API**

Before `saveDraft`, call `normalizeSectionPositions`. Send only `{ type, visible, content }` per section; server ordinality determines persisted positions. `publishDraft` performs exactly one `supabase.rpc('publish_landing')` call and does not simulate publishing with browser-side multi-step writes.

- [ ] **Step 5: Implement image API**

Upload with:

```js
const storage = supabase.storage.from('landing-media')
const { data, error } = await storage.upload(path, file, { cacheControl: '31536000', upsert: false })
```

Return the public URL from `getPublicUrl(data.path)`. `removeLandingImage(path)` calls `landing_media_is_referenced`; if referenced, return `{ removed: false, reason: 'in-use' }`. Otherwise call `storage.remove([path])` and return `{ removed: true }`.

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
- Renderer uses explicit DOM creation and never treats free-form Admin/Boss content as executable HTML.
- `landing-bootstrap.js` calls `getPublishedLanding`; only after a successful response does it replace the fallback `<main id="landing-root">`. On failure it leaves static markup untouched. It dynamically imports `./app.js` after the render attempt so behaviors attach to the final DOM.
- Renderer preserves the DOM contracts already used by `app.js`: `.filter`, `#job-list`, `#job-search`, `.audience`, `#contact-form`, `#employment-form`, section ids such as `#servicios` / `#vacantes`, and current CSS classes/variants.

- [ ] **Step 1: Write renderer/bootstrap structure tests**

Create assertions:

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

Assert `landing-renderer.js` handles every Task 3 template key and does not contain `eval`, `new Function`, or an assignment like `root.innerHTML = section.content`.

- [ ] **Step 2: Run test and verify RED**

Run:

```bash
node --test tests/landing-structure.test.js
```

Expected: FAIL because renderer/bootstrap files do not exist and `index.html` has no mount id.

- [ ] **Step 3: Implement safe text/render primitives**

Build nodes with `document.createElement`, `.textContent`, `.dataset.es`, `.dataset.en`, and explicit attributes. Implement title highlighting by splitting the localized title around its configured localized `highlight` phrase and wrapping only that phrase in an `<em>` created by DOM APIs.

Image shape is `{ path, fallbackPath, alt: { es, en } }`. If `path` starts with `assets/`, use it directly; otherwise resolve it through `publicLandingImageUrl(path)`. On image error use `fallbackPath` when present; otherwise hide the failed image/keep the template background without blanking the page.

- [ ] **Step 4: Implement template renderers with current CSS/JS contracts**

Map seeded variants to current hooks:

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
text_image variant=about -> current about/timeline classes
gallery variant=resources -> .news
contact -> .contact / #contact-form / .audience
faq -> .faq
```

Do not redesign `styles.css`; adapt renderer output to existing hooks.

- [ ] **Step 5: Make `app.js` tolerant of optional sections**

Audit every direct DOM lookup used by an editable/optional section. Add a null guard before binding. For example:

```js
const jobSearch = document.querySelector('#job-search')
if (jobSearch) {
  jobSearch.addEventListener('input', (event) => {
    const query = String(event.target.value || '').toLowerCase()
    document.querySelectorAll('#job-list article').forEach((job) => {
      job.hidden = !job.textContent.toLowerCase().includes(query)
    })
  })
}
```

Apply the same guard pattern to filters, audience buttons, `#contact-form`, `#employment-form`, and any section-specific enhancement while preserving their current callback logic.

- [ ] **Step 6: Add bootstrap to `index.html` while retaining fallback markup**

Add `id="landing-root"` to the existing `<main>`. Replace the direct `app.js` module tag with `landing-bootstrap.js`. Do not delete the current static sections; they remain the safe/crawlable fallback.

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
- Anonymous/recruiter access never receives draft data because browser guard and RLS both deny it.

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

Use the exact public renderer from Task 5. Add a small fixed management-only banner outside `#landing-root` saying `Vista previa del borrador` with a link back to `admin.html`. Do not load `app.js` form-submit behaviors in Preview; this page is visual only.

If the draft fails to load, render `No pudimos cargar la vista previa del borrador.` and keep the page noindex.

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
- Create: `tests/landing-editor-structure.test.js`
- Modify: `admin.html`
- Modify: `admin.js`
- Modify: `admin.css`
- Modify: `data-api.js`
- Modify: `tests/admin-structure.test.js`

**Interfaces:**
- Produces `mountLandingEditor(root, { onError })`.
- Editor state owns a cloned in-memory draft until `Guardar borrador` succeeds.
- Top actions are exactly `Guardar borrador`, `Vista previa`, `Publicar`.
- Each section card has name/summary, `Editar`, drag handle, and a `•••` menu with duplicate, hide/show, delete, plus `Subir` / `Bajar` for touch accessibility.
- `+ Agregar sección` opens the Task 3 template list.
- Text fields use `Español` / `Inglés` tabs; no JSON/HTML/Storage URL fields are exposed.

- [ ] **Step 1: Write failing panel/editor structure tests**

Update `tests/admin-structure.test.js`:

```js
assert.doesNotMatch(html, /Datos centralizados|Backend conectado|Supabase Auth|\bRLS\b|Base de datos conectada/i)
assert.match(html, /Editar página principal/)
assert.match(html, /id="landing-editor"/)
assert.match(html, /landing-editor\.css/)
```

Create `tests/landing-editor-structure.test.js` and assert `landing-editor.js` imports `LANDING_TEMPLATES`, `getDraftLanding`, `saveDraft`, `publishDraft`, `uploadLandingImage`, and `removeLandingImage`. Assert the file contains visible labels `Guardar borrador`, `Vista previa`, `Publicar`, `Agregar sección`, `Cambiar foto`, and `Eliminar foto`.

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
node --test tests/admin-structure.test.js tests/landing-editor-structure.test.js
```

Expected: FAIL because the old content form and technical notices remain.

- [ ] **Step 3: Replace the Content view and remove technical panel copy**

Replace the current Content markup with:

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

Remove the global “Datos centralizados” notice and remove the entire `.readiness` technical card from Settings. Replace these remaining management phrases:

```text
Topbar meta: “Gestiona la operación y el contenido del sitio.”
Sidebar footer: “eWorker360 Dominicana”
Settings description: “Configura el correo que recibirá los avisos del equipo.”
Invitation note: “La persona recibirá un correo para crear su contraseña.”
```

Update the `admin.js` `titles` metadata so no view subtitle references Supabase infrastructure.

- [ ] **Step 4: Detach landing content from `site_settings`**

In `admin.js`, stop populating/submitting `brandName`, `contactEmail`, `contactPhone`, `whatsapp`, `heroTitle`, and `heroLead` through `#content-form` because that form no longer exists.

In `data-api.js`, narrow `updateSiteSettings`:

```js
export async function updateSiteSettings(patch) {
  const allowedKeys = ['notification_email', 'email_subject', 'auto_reply']
  const allowed = Object.fromEntries(Object.entries(patch).filter(([key]) => allowedKeys.includes(key)))
  const { error } = await supabase.from('site_settings').update(allowed).eq('id', 1)
  if (error) throw error
}
```

Import `mountLandingEditor` in `admin.js` and initialize it after `requireAdmin()` succeeds:

```js
await mountLandingEditor(byId('landing-editor'), { onError: showError })
```

- [ ] **Step 5: Implement the section-list screen**

On mount call `getDraftLanding()`, clone returned sections, and render cards. Desktop drag uses a drag handle and native drag events. Mobile/touch users use `Subir` / `Bajar`. Both paths call `normalizeSectionPositions`.

Hide/show changes only local draft state until Save. Delete requires one confirmation. Duplicate uses `crypto.randomUUID()` and inserts directly after source.

- [ ] **Step 6: Implement schema-driven section forms**

Render only fields declared by `LANDING_TEMPLATES`. Localized fields use two tabs and store `{ es, en }`. Repeated items expose `Agregar`, `Eliminar`, `Subir`, `Bajar`. Link fields show `Texto del botón` and `Destino`.

Reject `javascript:` and other arbitrary schemes. Accept only fragment links beginning `#`, same-site relative files such as `application.html`, `https://`, `mailto:`, and `tel:`.

- [ ] **Step 7: Implement image controls**

For every image field show thumbnail, `Cambiar foto`, and `Eliminar foto`; array-image templates also show `Agregar foto`. After file selection call `uploadLandingImage(file)` and change in-memory content only after success. On failure keep the prior image unchanged.

When removing/replacing a Storage-backed draft image, add the old path to an in-memory `cleanupCandidates` set; do not remove the object yet because published content may still reference it.

- [ ] **Step 8: Implement Save / Preview / Publish**

`Guardar borrador`: call `saveDraft(sections)` and show `Borrador guardado` only after success.

`Vista previa`: if dirty, save first; then open `preview.html` in a new tab.

`Publicar`: if dirty, save first; ask `¿Publicar estos cambios en la página principal?`; call `publishDraft()`; on success show `Cambios publicados` and run each `cleanupCandidates` path through `removeLandingImage` so only unreferenced files are deleted.

If publish fails, show `No pudimos publicar. La página anterior sigue activa.` and retain the current draft.

- [ ] **Step 9: Style for simplicity and mobile**

`landing-editor.css` must match the current Admin visual language. Main controls have at least 44px touch height. Small screens use one-column section cards, large image thumbnails, readable language tabs, and an edit panel that fits without horizontal scrolling.

Delete obsolete `.readiness` CSS after its markup is removed.

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

### Task 8: Verify migrated content, bilingual behavior, fallback, and release docs

**Files:**
- Modify: `tests/landing-structure.test.js`
- Modify: `tests/landing-content.test.js`
- Modify: `tests/production-safety.test.js`
- Modify: `README.md`

**Interfaces:**
- Confirms the seeded representation renders the current section order/classes.
- Confirms `data-es` / `data-en` behavior remains compatible with the current language switch.
- Confirms the static fallback remains visible if published-content loading fails.

- [ ] **Step 1: Add current-site contract tests**

Assert the renderer preserves these current hooks:

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

Assert generated localized nodes set `dataset.es` and `dataset.en`, and English uses the Spanish value when stored English is blank.

- [ ] **Step 2: Add fallback structural test**

Assert `landing-bootstrap.js` catches `getPublishedLanding()` failure without clearing `#landing-root`, and imports `app.js` after either successful rendering or fallback retention.

- [ ] **Step 3: Extend production safety checks**

Add these browser files to the no-secret/no-localStorage scan:

```js
'landing-content.js',
'landing-api.js',
'landing-renderer.js',
'landing-bootstrap.js',
'landing-editor.js',
'preview.js',
```

- [ ] **Step 4: Update deployment documentation**

`README.md` must document this release order:

```text
1. Run 2026090501_boss_role.sql in Supabase.
2. Run 2026090502_landing_content.sql in Supabase.
3. Run supabase/tests/landing-rls-smoke.sql and confirm it completes inside its rollback transaction.
4. Redeploy manage-staff so Boss authorization is live.
5. Confirm Storage bucket landing-media exists and is public-read / Admin-Boss-write.
6. Deploy the frontend/Cloudflare build.
7. Log in as Admin, open Editar página principal, save a draft, preview it, then publish one harmless text change.
8. Confirm an anonymous browser sees only the published result and cannot access draft data.
```

Document that Team can promote an existing profile to Boss and that invitation itself still creates Recruiter.

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
- No planned source changes; if verification exposes a defect, write a failing regression test before fixing it.

**Interfaces:**
- Produces evidence that database authorization, draft/public isolation, image writes, Preview, and Cloudflare rendering work end-to-end.

- [ ] **Step 1: Verify database migration in Supabase**

Confirm:
- `profiles.role` accepts only `admin`, `boss`, `recruiter`;
- `public.is_admin()` returns true for an active Boss session;
- `landing_versions` has one draft and one published row;
- both versions have seeded sections;
- anonymous SQL smoke sees published content but no draft content.

- [ ] **Step 2: Verify Admin and Boss parity manually**

Using one Admin account and one Boss account, verify both can enter `admin.html`, edit/save/preview/publish landing content, upload/change/remove a photo, and change another existing user's role or active state.

Verify Recruiter cannot call landing write/publish RPCs or Storage writes directly even if UI methods are invoked from DevTools.

- [ ] **Step 3: Verify editorial isolation**

Make a visible draft-only title change. In a separate incognito browser confirm the public landing still shows the old published title. Open Preview while authenticated and confirm it shows the draft title. Publish and confirm the incognito browser then shows the new title.

- [ ] **Step 4: Verify image lifecycle**

Upload a new image, save draft, preview it, and confirm public still uses the old image. Publish and confirm public uses the new image. Remove an image from draft and verify Storage deletion is deferred while published content still references it.

- [ ] **Step 5: Verify language and optional-section resilience**

Switch ES→EN after publish. Confirm translated values appear and a deliberately blank English field falls back to Spanish. Hide one optional section, publish, and confirm `app.js` produces no console error from that missing section.

- [ ] **Step 6: Verify fallback behavior**

Block the Supabase published-content request in browser DevTools and reload. Confirm the static `index.html` fallback remains usable rather than becoming blank.

- [ ] **Step 7: Capture final CI evidence**

Push/open the implementation PR and wait for the GitHub Actions `Tests` workflow on the final head commit. Do not call the feature complete until the workflow conclusion is `success` and the three Task 8 verification commands have passed.

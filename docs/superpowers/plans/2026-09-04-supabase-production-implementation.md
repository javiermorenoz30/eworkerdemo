# eWorker360 Supabase Production Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace browser-local demo persistence/authentication with a production Supabase backend so applications, contact messages, business leads, staff access, statuses, notes, and settings are securely shared across devices.

**Architecture:** Keep GitHub Pages as the static frontend. Add Supabase Postgres + RLS for persistence/authorization, Supabase Auth for email/password staff sessions, and Supabase Edge Functions for privileged staff invitations and server-side notification email. Browser code uses only the project URL and public Publishable/Anon key.

**Tech Stack:** Static HTML/CSS/ES modules, `@supabase/supabase-js@2`, Supabase Postgres/Auth/Edge Functions, Deno Edge runtime, Resend for transactional team notifications, Node built-in `node:test` for pure JavaScript tests.

**Spec:** `docs/superpowers/specs/2026-09-04-supabase-production-backend-design.md`

## Global Constraints

- Keep the existing public-site and dashboard visual design substantially unchanged.
- Production candidate/staff data, access codes, statuses, notes, messages, and leads must never be stored in `localStorage`.
- The browser may contain only the Supabase Project URL and public Publishable/Anon key.
- Never commit `service_role`, database passwords, SMTP credentials, or Resend API keys.
- Public users may insert applications/messages/leads but may never read them back.
- Active admins and recruiters may read complete application answers, including the sensitive fields required by the client.
- Recruiters may not manage roles, profiles, invitations, or site settings.
- Email notification failure must never cause an already-persisted submission to be treated as lost.
- Domain/DNS cutover happens only after end-to-end verification on the current GitHub Pages URL.

---

## File Map

**Create**
- `package.json` — local test command only; no frontend build step.
- `supabase/migrations/20260904_initial_production_schema.sql` — schema, privileges, helper functions, RLS, settings seed.
- `supabase/tests/rls-smoke.sql` — manual SQL Editor security smoke checks.
- `supabase-config.js` — browser-safe Project URL and Publishable/Anon key supplied by the user.
- `supabase-client.js` — single browser client instance.
- `domain.js` — pure normalization/routing/metrics helpers.
- `auth.js` — Supabase Auth + profile guards.
- `data-api.js` — database and Edge Function calls.
- `application.js` — public employment form submission.
- `reset-password.html` — invitation/recovery password setup.
- `reset-password.js` — password update flow.
- `supabase/functions/manage-staff/index.ts` — admin-only recruiter invitation.
- `supabase/functions/notify-submission/index.ts` — server-side team email notifications.
- `supabase/functions/_shared/cors.ts` — allowed CORS headers.
- `tests/domain.test.js` — pure JS behavior tests.

**Modify**
- `application.html` — add stable `name` attributes, remove demo persistence script, load `application.js`.
- `index.html` — keep existing contact UI and load module-compatible `app.js`.
- `app.js` — persist contact/business submissions before success state.
- `staff-login.html` — email/password UI + recovery link.
- `staff-auth.js` — remove from production references; delete after migration.
- `admin-data.js` — remove from production references; delete after migration.
- `admin.html` — remove demo controls, add logout/messages/leads/team production controls, module entrypoint.
- `admin.js` — async Supabase-backed dashboard.
- `admin.css` — styles for full-answer rows, message/lead views, loading/error states.
- `recruiter.html` — full application detail + messages/leads views, module entrypoint.
- `recruiter.js` — async Supabase-backed recruiter workflow.
- `staff.css` — password/recovery/detail styles.
- `privacy.html` — accurately describe the categories of application data the production form collects.
- `README.md` — production configuration/deployment instructions.

---

### Task 1: Add testable domain helpers and a zero-build test harness

**Files:**
- Create: `package.json`
- Create: `domain.js`
- Create: `tests/domain.test.js`

**Interfaces:**
- Produces `buildApplicationRecord(values, id)`, `routeForProfile(profile)`, `applicationMetrics(applications)`, `csvForApplications(applications)`.
- These functions are pure and do not import Supabase, so they can run under Node and in the browser.

- [ ] **Step 1: Write the failing tests**

`package.json`:

```json
{
  "name": "eworker360-site",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/*.test.js"
  }
}
```

`tests/domain.test.js` must assert:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { applicationMetrics, buildApplicationRecord, routeForProfile } from '../domain.js'

test('routeForProfile sends active admins and recruiters to their dashboard', () => {
  assert.equal(routeForProfile({ role: 'admin', active: true }), 'admin.html')
  assert.equal(routeForProfile({ role: 'recruiter', active: true }), 'recruiter.html')
  assert.equal(routeForProfile({ role: 'recruiter', active: false }), null)
})

test('applicationMetrics counts pipeline states', () => {
  assert.deepEqual(applicationMetrics([
    { status: 'Nueva' },
    { status: 'En revisión' },
    { status: 'Entrevista' },
    { status: 'Contratada' },
  ]), { total: 4, newCount: 1, progress: 2, hired: 1 })
})

test('buildApplicationRecord keeps all answers but exposes normalized summary fields', () => {
  const record = buildApplicationRecord({
    position: 'Ventas',
    fullName: 'Ana Pérez',
    email: 'ana@example.com',
    whatsapp: '+18095550000',
    cedula: '00100000000',
    financialAssets: '1000',
  }, '11111111-1111-4111-8111-111111111111')
  assert.equal(record.id, '11111111-1111-4111-8111-111111111111')
  assert.equal(record.full_name, 'Ana Pérez')
  assert.equal(record.role_applied, 'Ventas')
  assert.equal(record.answers.cedula, '00100000000')
  assert.equal(record.answers.financialAssets, '1000')
  assert.equal('status' in record, false)
  assert.equal('internal_note' in record, false)
})
```

- [ ] **Step 2: Run tests and verify they fail because `domain.js` does not exist**

Run: `npm test`

Expected: FAIL with module-not-found for `domain.js`.

- [ ] **Step 3: Implement the minimal pure helpers**

`domain.js` must:
- return `null` from `routeForProfile` when profile is absent/inactive/unknown role;
- count `En revisión` + `Entrevista` as progress;
- generate application payloads without `status`/`internal_note`;
- preserve the entire `values` object in `answers`;
- map DB snake_case fields to UI camelCase only in explicit adapter functions, never by mutating raw rows.

- [ ] **Step 4: Run tests**

Run: `npm test`

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json domain.js tests/domain.test.js
git commit -m "test: add production domain helpers"
```

---

### Task 2: Create Supabase production schema, privileges, and RLS

**Files:**
- Create: `supabase/migrations/20260904_initial_production_schema.sql`
- Create: `supabase/tests/rls-smoke.sql`

**Interfaces:**
- Produces tables `profiles`, `applications`, `contact_messages`, `business_leads`, `site_settings`.
- Produces RLS helpers `is_active_staff()`, `is_admin()`, `is_recruiter_or_admin()`.

- [ ] **Step 1: Write migration SQL**

The migration must create the exact columns/check constraints from the approved spec, plus an `updated_at` trigger function used by all mutable tables.

Public column privileges must be deliberately narrow:

```sql
revoke all on public.profiles from anon, authenticated;
revoke all on public.applications from anon, authenticated;
revoke all on public.contact_messages from anon, authenticated;
revoke all on public.business_leads from anon, authenticated;
revoke all on public.site_settings from anon, authenticated;

grant insert (id, full_name, email, phone, role_applied, answers)
  on public.applications to anon, authenticated;
grant insert (id, name, email, subject, message)
  on public.contact_messages to anon, authenticated;
grant insert (id, company_name, contact_name, email, subject, message)
  on public.business_leads to anon, authenticated;

grant select on public.applications, public.contact_messages, public.business_leads to authenticated;
grant update (status, internal_note, updated_at) on public.applications to authenticated;
grant update (status, updated_at) on public.contact_messages, public.business_leads to authenticated;
grant select on public.profiles, public.site_settings to authenticated;
grant update (email, full_name, role, active, updated_at) on public.profiles to authenticated;
grant update (brand_name, hero_title, hero_lead, contact_email, contact_phone, whatsapp, notification_email, email_subject, auto_reply, updated_at)
  on public.site_settings to authenticated;
```

RLS policies must enforce:

```sql
create policy applications_public_insert
on public.applications for insert
to anon, authenticated
with check (status = 'Nueva' and internal_note = '');

create policy applications_staff_select
on public.applications for select
to authenticated
using (public.is_recruiter_or_admin());

create policy applications_staff_update
on public.applications for update
to authenticated
using (public.is_recruiter_or_admin())
with check (public.is_recruiter_or_admin());
```

Equivalent insert/select/update policies must be created for `contact_messages` and `business_leads`, with public insert checks requiring `status = 'Nuevo'`.

`profiles` policies:

```sql
create policy profiles_self_or_admin_select
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_admin());

create policy profiles_admin_update
on public.profiles for update
to authenticated
using (public.is_admin())
with check (public.is_admin());
```

`site_settings` policies:

```sql
create policy settings_staff_select
on public.site_settings for select
to authenticated
using (public.is_active_staff());

create policy settings_admin_update
on public.site_settings for update
to authenticated
using (public.is_admin())
with check (public.is_admin());
```

Seed the singleton settings row with the values already used by the demo, including `info@eworker360dominicana.com`.

- [ ] **Step 2: Add SQL smoke checks**

`supabase/tests/rls-smoke.sql` must be transaction-wrapped and verify at minimum:
- an `anon` role can insert a valid application;
- an `anon` role cannot select that application;
- an `anon` role cannot set `status = 'Contratada'` or `internal_note` on insert;
- public select grants are absent for all sensitive tables.

The file must end with `rollback;` so smoke-test data is never retained.

- [ ] **Step 3: User runs the migration in Supabase SQL Editor**

User action:
1. Supabase → SQL Editor → New query.
2. Paste the complete migration file.
3. Run it once.
4. Confirm all five tables appear in Table Editor.

- [ ] **Step 4: Bootstrap the existing Auth user as first admin**

User action:
1. Supabase → Authentication → Users → copy the existing user's UUID.
2. Table Editor → `profiles` → Insert row.
3. Set `id` to that exact UUID, `email` to the Auth email, `full_name` to the desired display name, `role = admin`, `active = true`.
4. Save.

Do not create a second Auth user for the same email.

- [ ] **Step 5: Run RLS smoke SQL and verify expected failures/successes**

Expected: public insert succeeds; public reads and unauthorized status/internal-note writes fail.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations supabase/tests
git commit -m "feat: add Supabase schema and RLS"
```

---

### Task 3: Add browser Supabase client, authentication, and password setup

**Files:**
- Create: `supabase-config.js`
- Create: `supabase-client.js`
- Create: `auth.js`
- Create: `reset-password.html`
- Create: `reset-password.js`
- Modify: `staff-login.html`
- Modify: `staff.css`

**Interfaces:**
- `supabase-client.js` exports `supabase`.
- `auth.js` exports `signIn(email,password)`, `signOut()`, `getCurrentProfile()`, `requireAdmin()`, `requireStaff()`, `sendPasswordRecovery(email)`.

- [ ] **Step 1: Collect browser-safe Supabase configuration from the user**

User provides only:
- Supabase **Project URL**.
- Browser **Publishable key** (or legacy `anon` key if that is what the dashboard exposes).

Never request or accept `service_role` in chat/repository.

- [ ] **Step 2: Create the browser client**

`supabase-config.js` exports the two actual browser-safe values supplied by the user.

`supabase-client.js` uses a browser ES-module import of Supabase JS v2 and creates exactly one client with persisted Supabase Auth sessions.

- [ ] **Step 3: Implement auth module and role guards**

`signIn` must:
1. call `supabase.auth.signInWithPassword({ email, password })`;
2. fetch the caller's own `profiles` row;
3. sign out and throw an authorization error if profile is missing/inactive;
4. return `{ user, profile }`.

`requireAdmin` must allow only active `role = admin`.
`requireStaff` must allow active `admin` or `recruiter`.

- [ ] **Step 4: Replace local code login UI**

In `staff-login.html`:
- rename “Código de acceso” to “Contraseña”;
- use `name="password"`;
- remove the demo/localStorage explanation;
- add “¿Olvidaste tu contraseña?” button/link;
- load only the production module entrypoint; do not load `admin-data.js` or `staff-auth.js`.

Login success routes with `routeForProfile(profile)`.

- [ ] **Step 5: Add password recovery/invitation landing page**

`reset-password.html` contains two password fields and one submit button.
`reset-password.js` verifies that a Supabase session exists, validates matching passwords with minimum length 8, then calls:

```js
await supabase.auth.updateUser({ password })
```

On success redirect to `staff-login.html?password=updated`.

- [ ] **Step 6: Manual auth verification**

User verifies:
- existing admin can log in with email/password;
- inactive/missing profile is rejected;
- direct unauthenticated access to protected pages redirects to login;
- password recovery email points to the GitHub Pages `reset-password.html` URL.

- [ ] **Step 7: Commit**

```bash
git add supabase-config.js supabase-client.js auth.js staff-login.html staff.css reset-password.html reset-password.js
git commit -m "feat: connect staff authentication to Supabase"
```

---

### Task 4: Add a single production data API and connect the employment form

**Files:**
- Create: `data-api.js`
- Create: `application.js`
- Modify: `application.html`
- Modify: `tests/domain.test.js`

**Interfaces:**
- `data-api.js` exports `submitApplication(record)`, `notifySubmission(type,id)`, plus authenticated read/update functions used by later tasks.
- Public inserts never call `.select()`.

- [ ] **Step 1: Add stable names to every employment field**

Replace label-text scraping with explicit field names. At minimum use:

```text
position
employmentMode
englishLevel
referralSource
fullName
address
birthDate
cedula
whatsapp
email
transportation
traveledAbroad
travelDestinations
hasVisa
familyAtCompany
financialAssets
financialObligations
justiceIssues
academicSummary
currentlyStudying
educationLevel
courses
technologyLevel
workSummary
job1Company
job1LastDate
job1ExitReason
job2Company
job2LastDate
job2ExitReason
job3Company
job3LastDate
job3ExitReason
currentlyEmployed
lastSalary
yearsSales
yearsCustomerService
consent
```

The page copy must no longer say the form “does not send or store information.”

- [ ] **Step 2: Extend the failing domain test for complete answer preservation**

Add assertions for `birthDate`, `cedula`, `financialAssets`, `justiceIssues`, and all three job-history groups.

- [ ] **Step 3: Implement `application.js`**

On submit:
1. disable submit button;
2. create a plain values object from `FormData`;
3. generate `id = crypto.randomUUID()`;
4. call `buildApplicationRecord(values,id)`;
5. await `submitApplication(record)`;
6. show success and reset only after DB persistence;
7. call `notifySubmission('application', id)` in a secondary `try/catch` that cannot change persisted success into failure;
8. on DB failure, preserve entered values and show retry copy;
9. restore button state in `finally`.

- [ ] **Step 4: Remove demo data source from application page**

Delete `<script src="admin-data.js">` and the inline `EWorkerDemoStore.addApplication` handler. Load `application.js` as `type="module"`.

- [ ] **Step 5: Cross-device manual test**

Submit the full form from a phone/private browser. In Supabase Table Editor verify exactly one `applications` row exists and `answers` contains the complete form.

- [ ] **Step 6: Commit**

```bash
git add data-api.js application.js application.html tests/domain.test.js
git commit -m "feat: persist employment applications in Supabase"
```

---

### Task 5: Persist the public contact form as contact messages or business leads

**Files:**
- Modify: `app.js`
- Modify: `index.html`
- Modify: `data-api.js`

**Interfaces:**
- `submitContactMessage({ id,name,email,subject,message })`
- `submitBusinessLead({ id,company_name,contact_name,email,subject,message })`

- [ ] **Step 1: Convert `app.js` to a module without changing existing navigation/language/motion behavior**

Only the contact submit branch changes behavior; all existing noncritical UI behavior remains.

- [ ] **Step 2: Implement audience-specific persistence**

For `audience = Empresa`:

```js
await submitBusinessLead({
  id: crypto.randomUUID(),
  company_name: '',
  contact_name: values.name,
  email: values.email,
  subject: values.subject,
  message: values.message,
})
```

For `audience = Talento`, insert into `contact_messages` with the equivalent fields.

- [ ] **Step 3: Correct success/error behavior**

- Disable during active request.
- Reset only after database success.
- Preserve fields after database failure.
- Invoke `notifySubmission('business_lead', id)` or `notifySubmission('contact_message', id)` only after persistence.
- Notification failure must not change the successful form result.

- [ ] **Step 4: Change `index.html` script tag to module form**

Use:

```html
<script type="module" src="app.js?v=supabase-1"></script>
```

- [ ] **Step 5: Manual test both audience paths**

Expected:
- Empresa creates one row in `business_leads`.
- Talento creates one row in `contact_messages`.
- Neither submission is readable from an anonymous browser client.

- [ ] **Step 6: Commit**

```bash
git add app.js index.html data-api.js
git commit -m "feat: persist public contact and business inquiries"
```

---

### Task 6: Replace admin demo store with shared Supabase data

**Files:**
- Modify: `admin.html`
- Modify: `admin.js`
- Modify: `admin.css`
- Modify: `data-api.js`

**Interfaces:**
- `listApplications()` returns newest-first raw DB rows.
- `updateApplication(id,{status,internal_note})` updates only allowed operational fields.
- `listContactMessages()`, `updateContactMessageStatus()`.
- `listBusinessLeads()`, `updateBusinessLeadStatus()`.
- `getSiteSettings()`, `updateSiteSettings()`.
- `listProfiles()`, `updateProfile()`.

- [ ] **Step 1: Guard admin route before rendering data**

At module startup call `await requireAdmin()`. If unauthorized, stop execution after redirect/signout.

- [ ] **Step 2: Remove demo-only controls and copy**

Remove:
- “Modo demo” label;
- `Restaurar demo`;
- `Cargar datos de muestra`;
- local-storage notice;
- temporary access-code field.

Add an explicit **Cerrar sesión** button.

- [ ] **Step 3: Load dashboard state from Supabase**

Use one async `loadDashboard()` that retrieves applications, messages, leads, settings, and profiles; render a loading state first and a visible recoverable error if any required query fails.

Do not silently fall back to demo/local data.

- [ ] **Step 4: Render complete candidate answers**

Candidate detail must render `answers` as escaped label/value rows below the summary fields. Never use raw `innerHTML` with user-supplied values unless every value is escaped first.

Keep status and internal-note editing.

- [ ] **Step 5: Add Messages and Proposals views**

Add sidebar/view entries:
- `Mensajes` -> `contact_messages`.
- `Propuestas` -> `business_leads`.

Each view shows sender/contact, subject, message, created date, current status, and an allowed status dropdown.

- [ ] **Step 6: Persist settings through `site_settings`**

The existing content/settings forms read row `id = 1` and write only via `updateSiteSettings`. Public landing content remains static in this release; update admin wording so it does not falsely promise immediate public landing changes.

- [ ] **Step 7: Replace team demo actions**

Team list uses `profiles`. Active/paused toggle calls `updateProfile(id,{active})`. The invite form contains only name + email and calls the `manage-staff` Edge Function added in Task 8.

- [ ] **Step 8: Keep CSV export using the server-loaded application array**

Never refetch anonymously. Use `csvForApplications(currentApplications)`.

- [ ] **Step 9: Manual test persistence**

Change an application status/note, refresh, and verify the change remains. Change a message/lead status and verify the same.

- [ ] **Step 10: Commit**

```bash
git add admin.html admin.js admin.css data-api.js
git commit -m "feat: connect admin dashboard to Supabase"
```

---

### Task 7: Replace recruiter demo store with shared, full-detail Supabase workflow

**Files:**
- Modify: `recruiter.html`
- Modify: `recruiter.js`
- Modify: `staff.css`

**Interfaces:**
- Consumes `requireStaff()` and the authenticated data API from earlier tasks.

- [ ] **Step 1: Guard recruiter route**

Call `await requireStaff()` before querying data. Both active admin and recruiter are allowed; inactive/missing profiles are not.

- [ ] **Step 2: Load shared applications**

Search/filter uses the server-loaded array. Remove `EWorkerDemoStore` and all local activity tracking.

- [ ] **Step 3: Add a candidate detail section**

Clicking a row shows:
- summary contact fields;
- every `answers` field, including cedula, birth date, financial, and justice-related answers;
- status selector;
- internal note editor.

Updates persist through `data-api.js`.

- [ ] **Step 4: Add recruiter Messages and Proposals views**

Recruiters can read and update operational status for `contact_messages` and `business_leads`, but no team/settings controls exist in their UI.

- [ ] **Step 5: Verify RLS beyond the UI**

From recruiter browser session, intentionally attempt a direct `profiles` update and a `site_settings` update in DevTools/Supabase client. Expected: database rejects both even though the user is authenticated.

- [ ] **Step 6: Commit**

```bash
git add recruiter.html recruiter.js staff.css
git commit -m "feat: connect recruiter portal to shared Supabase data"
```

---

### Task 8: Implement secure recruiter invitations with an Edge Function

**Files:**
- Create: `supabase/functions/_shared/cors.ts`
- Create: `supabase/functions/manage-staff/index.ts`
- Modify: `data-api.js`

**Interfaces:**
- Browser invokes `manage-staff` with `{ action: 'invite', name, email }`.
- Function returns only safe success/error metadata.

- [ ] **Step 1: Implement JWT and admin verification**

Function must:
1. require `Authorization: Bearer <user JWT>`;
2. create a caller-context Supabase client using the incoming authorization header;
3. call `auth.getUser()`;
4. query the caller's `profiles` row;
5. reject unless `active = true` and `role = 'admin'`.

- [ ] **Step 2: Create server-side admin client**

Only inside the function, create an admin client using `SUPABASE_SERVICE_ROLE_KEY` from Edge Function environment secrets.

- [ ] **Step 3: Invite recruiter and create profile**

Call Supabase Admin Auth invitation for the submitted email with redirect to the current GitHub Pages `reset-password.html`, then upsert the returned Auth user ID into `profiles` as:

```json
{
  "role": "recruiter",
  "active": true
}
```

Use the submitted name/email for profile metadata.

- [ ] **Step 4: Configure CORS to allow current production-preview origin**

Allow the GitHub Pages origin used by `javiermorenoz30.github.io`; when custom domain cutover happens, add `https://eworker360dominicana.com` as an allowed origin before switching DNS.

- [ ] **Step 5: User deploys function**

Use Supabase Dashboard Edge Functions or CLI. User never shares `service_role`; Supabase already exposes it securely to functions when configured according to platform guidance.

- [ ] **Step 6: End-to-end invitation test**

Admin invites a brand-new recruiter email, recipient opens invite, sets password on `reset-password.html`, logs in, and sees recruiter dashboard only.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/manage-staff supabase/functions/_shared data-api.js
git commit -m "feat: add secure recruiter invitation flow"
```

---

### Task 9: Implement server-side team notification email

**Files:**
- Create: `supabase/functions/notify-submission/index.ts`
- Modify: `data-api.js`

**Interfaces:**
- Browser calls `notify-submission` with `{ type: 'application'|'contact_message'|'business_lead', id: '<uuid>' }` after persistence.
- Function never returns sensitive record data.

- [ ] **Step 1: Implement strict type/table mapping**

Use an internal constant map; never accept an arbitrary table name from the request.

- [ ] **Step 2: Fetch one record server-side**

Using the service-role client, load only the supplied ID from the mapped table and load `site_settings.id = 1` for `notification_email`.

- [ ] **Step 3: Add basic duplicate suppression**

Before email delivery, derive a deterministic idempotency key from `type:id` and send it as the provider idempotency header/key. Repeated browser retries for the same record must not intentionally produce unlimited duplicate emails.

- [ ] **Step 4: Send through Resend**

Use `RESEND_API_KEY` only from Supabase Function Secrets. Sender must be a verified eWorker360 sender/domain before production cutover. Email body may include the relevant submission summary, but the function response is only `{ ok: true }`.

- [ ] **Step 5: User configures Resend outside the repository**

User actions:
1. Create/authorize Resend account.
2. Verify the sender domain when DNS access is available.
3. Add `RESEND_API_KEY` directly to Supabase Edge Function secrets.
4. Do not paste the API key in chat or GitHub.

- [ ] **Step 6: Verify persistence survives email failure**

Temporarily make notification delivery fail, submit a form, verify the DB row still exists and the public form does not claim the underlying submission was lost.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/notify-submission data-api.js
git commit -m "feat: add server-side submission notifications"
```

---

### Task 10: Remove local production data paths and update privacy/deployment docs

**Files:**
- Delete: `admin-data.js`
- Delete: `staff-auth.js`
- Modify: `privacy.html`
- Modify: `README.md`

- [ ] **Step 1: Search all production HTML/JS for removed globals**

Run:

```bash
grep -R "EWorkerDemoStore\|EWorkerStaffAuth\|eworker360-demo-v1\|eworker360-staff-session-v1" -n --exclude-dir=.git .
```

Expected before deletion: no production references except the two files themselves.

- [ ] **Step 2: Delete obsolete local data/auth files**

Delete `admin-data.js` and `staff-auth.js` only after all HTML/JS references are gone.

- [ ] **Step 3: Update privacy copy**

`privacy.html` must accurately state that employment applications may include identification, date-of-birth, financial, academic, employment-history, and justice-related information supplied by the applicant, and provide the existing contact email for access/correction/deletion requests.

Do not invent legal retention periods or compliance guarantees.

- [ ] **Step 4: Update README**

Document:
- architecture;
- required Supabase URL/public key;
- SQL migration order;
- admin bootstrap;
- Auth redirect URLs;
- Edge Function deployment;
- Resend secret handling;
- GitHub Pages test URL;
- custom-domain cutover only after acceptance tests.

- [ ] **Step 5: Run tests and secret scan**

Run:

```bash
npm test
grep -R "service_role\|SUPABASE_SERVICE_ROLE_KEY=.*\|RESEND_API_KEY=.*\|postgresql://" -n --exclude-dir=.git .
```

Expected: tests pass; no committed secret values.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: remove local demo persistence and document production setup"
```

---

### Task 11: Production acceptance test on GitHub Pages

**Files:**
- Modify only if a discovered defect requires a focused fix.

- [ ] **Step 1: Verify public application from a separate device**

Submit a complete real-format test application from a phone/private session. Confirm admin on another device sees every submitted field.

- [ ] **Step 2: Verify recruiter persistence**

Recruiter changes status + note. Refresh recruiter. Open admin on another device and verify the same values.

- [ ] **Step 3: Verify contact and business paths**

Submit both audience modes and confirm each appears in the correct dashboard view.

- [ ] **Step 4: Verify anonymous data isolation**

From a logged-out browser, direct Supabase select attempts for `applications`, `contact_messages`, `business_leads`, `profiles`, and `site_settings` must fail/return no permitted data.

- [ ] **Step 5: Verify recruiter authorization boundary**

Recruiter may read/update operational queues but cannot update profiles/settings.

- [ ] **Step 6: Verify invitation/password flow**

Invite a fresh recruiter, set password, log in, log out, recover password, log in again.

- [ ] **Step 7: Verify email notification behavior**

Confirm one team email for each of the three submission types and verify duplicate function retries do not create uncontrolled duplicate notifications.

- [ ] **Step 8: Verify no sensitive browser persistence**

Inspect Local Storage in DevTools after submitting and after admin/recruiter use. No candidate answers, staff list, notes, or access credentials may be present.

- [ ] **Step 9: Visual regression smoke check**

Check desktop + mobile for `index.html`, `application.html`, `staff-login.html`, `admin.html`, `recruiter.html`, `reset-password.html`.

- [ ] **Step 10: Commit any focused acceptance fixes and rerun all checks**

Expected: all 16 acceptance criteria in the approved spec pass.

---

### Task 12: Custom-domain cutover only after acceptance passes

**No code dependency except Auth/CORS config update.**

- [ ] **Step 1: Set GitHub Pages custom domain**

Set `eworker360dominicana.com` in repository Settings → Pages.

- [ ] **Step 2: Update Supabase Auth URLs**

Primary Site URL: `https://eworker360dominicana.com/`.
Allowed redirects include `https://eworker360dominicana.com/**` while retaining the GitHub Pages URL during transition.

- [ ] **Step 3: Update Edge Function allowed origin/config**

Allow `https://eworker360dominicana.com` in production CORS/config before DNS cutover.

- [ ] **Step 4: Point web DNS records to GitHub Pages through Cloudflare**

Change only web-hosting records. Preserve all existing MX/TXT/SPF/DKIM/DMARC records used by eWorker360 mail.

- [ ] **Step 5: Verify HTTPS + all workflows on the custom domain**

Re-run application, contact, login, recruiter, admin, password recovery, and notification smoke tests against `https://eworker360dominicana.com/`.

- [ ] **Step 6: Merge only after successful production-domain verification**

Open a PR from `supabase-production` to `main`, review the diff and secret scan, then merge.

---

## Execution Checkpoints / User Inputs

The implementation deliberately stops for the user at these points:

1. **After Task 2 migration is committed:** user runs SQL and inserts the first `profiles` admin row.
2. **Before Task 3 configuration:** user supplies only Project URL + public Publishable/Anon key.
3. **Task 8:** user deploys/configures the staff Edge Function in their Supabase project without sharing service-role credentials.
4. **Task 9:** user configures Resend and places the API key directly into Supabase Function Secrets.
5. **Task 12:** user approves domain cutover after all acceptance tests pass.

No implementation step requires the user's Supabase password, database password, `service_role` key, or email-provider API secret to be shared in chat.
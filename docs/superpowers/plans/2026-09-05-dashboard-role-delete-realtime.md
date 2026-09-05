# Dashboard Roles, Deletion, and Realtime Alerts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Admin/Boss choose invitation roles, permanently delete contact messages/business proposals with confirmation, and let authenticated Admin/Boss/Recruiter opt in to realtime in-app and browser notifications for new operational records.

**Architecture:** Keep privileged mutations server-side. Extend `manage-staff` for role-aware invites, add a narrowly scoped `manage-records` Edge Function for manager-only deletion, and add a small shared `staff-notifications.js` module that both admin and recruiter portals initialize only after their existing auth guards succeed. The realtime channel is active only after the staff member has opted in (or previously opted in on that browser); Supabase Realtime listens only for INSERT events on the three operational tables, and the browser Notification API is requested only from an explicit user gesture.

**Tech Stack:** Vanilla HTML/CSS/ES modules, Supabase JS v2, Supabase Edge Functions (Deno), Postgres/RLS/Realtime, Node built-in test runner, Cloudflare asset deployment checks.

**Spec:** `docs/superpowers/specs/2026-09-05-dashboard-role-delete-realtime-design.md`

## Global Constraints

- Do not change the public application/contact persistence flow.
- Do not change Gmail SMTP notification delivery.
- Anonymous/public-site visitors must never initialize internal staff notifications.
- Only active `admin` and `boss` profiles may invite staff or permanently delete messages/proposals.
- Invite roles are exactly `admin`, `boss`, `recruiter`; default UI value is `recruiter`.
- Applications are not deletable in this scope.
- Permanent deletion requires explicit confirmation and occurs only after server authorization.
- Browser/system notification content must be generic and contain no applicant/contact PII.
- Notification permission is requested only after the user explicitly clicks the activation control.
- In-app realtime alerts are opt-in; if the browser preference is disabled, no realtime alert channel remains active.
- Realtime/system alerts are session-bound; no service worker or closed-browser push is added.
- Do not merge or deploy without explicit user approval.

---

### Task 1: Role-aware staff invitations

**Files:**
- Modify: `admin.html`
- Modify: `admin.js`
- Modify: `data-api.js`
- Modify: `supabase/functions/manage-staff/index.ts`
- Modify: `tests/admin-structure.test.js`
- Modify: `tests/edge-functions-structure.test.js`

**Interfaces:**
- Consumes: existing `staffRoles = [['admin', ...], ['boss', ...], ['recruiter', ...]]` and authenticated `manage-staff` Edge Function.
- Produces: `inviteStaff(name: string, email: string, role: 'admin'|'boss'|'recruiter'): Promise<object>` in `data-api.js`; request body `{ action:'invite', name, email, role }`.

- [ ] **Step 1: Write failing invitation tests**

Add assertions that `admin.html` contains a named role selector with values `admin`, `boss`, `recruiter` and recruiter selected by default; `admin.js` reads `values.role`; `data-api.js` sends `role`; and `manage-staff` validates the allowlist and persists `role` rather than hard-coding recruiter.

```js
assert.match(adminHtml, /name="role"/)
for (const role of ['admin', 'boss', 'recruiter']) assert.match(adminHtml, new RegExp(`value="${role}"`))
assert.match(adminJs, /inviteStaff\([^)]*values\.role/)
assert.match(dataApi, /body:\s*\{\s*action:\s*['"]invite['"],\s*name,\s*email,\s*role\s*\}/s)
assert.match(manageStaff, /\['admin',\s*'boss',\s*'recruiter'\]/)
assert.match(manageStaff, /role,\s*active:\s*true/)
```

- [ ] **Step 2: Run the focused tests and confirm RED**

Run:
```bash
node --test tests/admin-structure.test.js tests/edge-functions-structure.test.js
```
Expected: FAIL because invite role selection and role propagation do not exist yet.

- [ ] **Step 3: Implement the role selector and request flow**

Use this shape in the team form:
```html
<label>
  Rol
  <select name="role" required>
    <option value="recruiter" selected>Reclutador</option>
    <option value="boss">Boss</option>
    <option value="admin">Administrador</option>
  </select>
</label>
```

Rename the API wrapper and pass the selected role:
```js
export async function inviteStaff(name, email, role) {
  const { data, error } = await supabase.functions.invoke('manage-staff', {
    body: { action: 'invite', name, email, role },
  })
  if (error) throw error
  return data
}
```

In `manage-staff`, parse and validate before inviting:
```ts
const allowedRoles = ['admin', 'boss', 'recruiter'] as const
const role = String(payload?.role || 'recruiter')
if (!allowedRoles.includes(role as typeof allowedRoles[number])) {
  return jsonResponse(req, { error: 'Invalid staff role' }, 400)
}
```
Persist `role` in `profiles.upsert`; authorization continues to come from `profiles`.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run:
```bash
node --test tests/admin-structure.test.js tests/edge-functions-structure.test.js
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add admin.html admin.js data-api.js supabase/functions/manage-staff/index.ts tests/admin-structure.test.js tests/edge-functions-structure.test.js
git commit -m "feat: choose staff role when inviting"
```

---

### Task 2: Manager-only permanent deletion backend

**Files:**
- Create: `supabase/functions/manage-records/index.ts`
- Create: `supabase/migrations/2026090503_manager_record_delete.sql`
- Modify: `data-api.js`
- Modify: `tests/edge-functions-structure.test.js`
- Create: `tests/manager-records-structure.test.js`

**Interfaces:**
- Consumes: authenticated Supabase bearer token; server-side secret key helpers in `supabase/functions/_shared/supabase-env.ts`; manager roles `admin|boss`.
- Produces: `deleteOperationalRecord(type: 'contact_message'|'business_lead', id: string): Promise<object>` invoking `manage-records` with `{ action:'delete', type, id }`.

- [ ] **Step 1: Write failing authorization/deletion tests**

Test for bearer-token validation, caller profile lookup, `admin|boss` allowlist, UUID validation, resource allowlist mapping only to `contact_messages` and `business_leads`, exact `.delete().eq('id', id)` targeting, and no `applications` delete path.

```js
assert.match(fn, /managerRoles\s*=\s*\['admin',\s*'boss'\]/)
assert.match(fn, /contact_message:\s*['"]contact_messages['"]/)
assert.match(fn, /business_lead:\s*['"]business_leads['"]/)
assert.doesNotMatch(fn, /application:\s*['"]applications['"]/)
assert.match(fn, /\.delete\(\)[\s\S]*\.eq\(['"]id['"],\s*id\)/)
```

- [ ] **Step 2: Run tests and confirm RED**

Run:
```bash
node --test tests/manager-records-structure.test.js tests/edge-functions-structure.test.js
```
Expected: FAIL because `manage-records` does not exist.

- [ ] **Step 3: Implement `manage-records`**

Follow the existing `manage-staff` authentication pattern. Validate session, load caller profile, require active manager, validate type/id, then delete exactly one server-side:
```ts
const resourceTables = {
  contact_message: 'contact_messages',
  business_lead: 'business_leads',
} as const

const { data, error } = await adminClient
  .from(resourceTables[type])
  .delete()
  .eq('id', id)
  .select('id')
  .maybeSingle()
```
Return 404 when no row is deleted, 200 `{ ok:true, id }` on success, and safe 400/401/403/500 responses otherwise.

The migration must not grant browser DELETE access to authenticated users; deletion remains through the server-side function.

- [ ] **Step 4: Add the browser wrapper**

```js
export async function deleteOperationalRecord(type, id) {
  const { data, error } = await supabase.functions.invoke('manage-records', {
    body: { action: 'delete', type, id },
  })
  if (error) throw error
  return data
}
```

- [ ] **Step 5: Run focused tests and confirm GREEN**

Run:
```bash
node --test tests/manager-records-structure.test.js tests/edge-functions-structure.test.js
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/manage-records/index.ts supabase/migrations/2026090503_manager_record_delete.sql data-api.js tests/manager-records-structure.test.js tests/edge-functions-structure.test.js
git commit -m "feat: add manager-only record deletion"
```

---

### Task 3: Admin/Boss delete controls with explicit confirmation

**Files:**
- Modify: `admin.js`
- Modify: `admin.css`
- Modify: `tests/admin-structure.test.js`
- Create: `tests/admin-record-delete.test.js`

**Interfaces:**
- Consumes: `deleteOperationalRecord(type, id)` from Task 2 and authenticated manager-only `admin.js` entrypoint (`requireAdmin`).
- Produces: `data-delete-message` and `data-delete-lead` actions; local state removal only after server success.

- [ ] **Step 1: Write failing UI behavior tests**

Assert each message/lead renderer exposes `Eliminar`, handlers call `window.confirm`, confirmation text contains `permanentemente`, and local state filtering occurs only after awaited delete success.

```js
assert.match(adminJs, /data-delete-message/)
assert.match(adminJs, /data-delete-lead/)
assert.match(adminJs, /window\.confirm\([^)]*permanent/i)
assert.match(adminJs, /await deleteOperationalRecord\(['"]contact_message['"]/)
assert.match(adminJs, /await deleteOperationalRecord\(['"]business_lead['"]/)
```

- [ ] **Step 2: Run tests and confirm RED**

Run:
```bash
node --test tests/admin-structure.test.js tests/admin-record-delete.test.js
```
Expected: FAIL because delete buttons and handlers do not exist.

- [ ] **Step 3: Implement manager delete actions**

Render a danger button beside status controls. On click:
```js
if (!window.confirm('Esta acción eliminará el mensaje permanentemente. ¿Deseas continuar?')) return
button.disabled = true
try {
  await deleteOperationalRecord('contact_message', id)
  state.messages = state.messages.filter((item) => item.id !== id)
  renderMessages()
  clearError()
} catch (error) {
  showError(`No se pudo eliminar el mensaje. ${error?.message || ''}`)
} finally {
  button.disabled = false
}
```
Mirror for business leads. Do not add delete controls to recruiter portal or applications.

- [ ] **Step 4: Style the danger action**

Add `.danger-action` with accessible contrast, hover/focus treatment, and disabled state without changing existing record layout semantics.

- [ ] **Step 5: Run focused tests and confirm GREEN**

Run:
```bash
node --test tests/admin-structure.test.js tests/admin-record-delete.test.js
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add admin.js admin.css tests/admin-structure.test.js tests/admin-record-delete.test.js
git commit -m "feat: let managers delete messages and proposals"
```

---

### Task 4: Shared authenticated realtime notification module

**Files:**
- Create: `staff-notifications.js`
- Modify: `admin.html`
- Modify: `admin.js`
- Modify: `admin.css`
- Modify: `recruiter.html`
- Modify: `recruiter.js`
- Modify: `staff.css`
- Create: `tests/staff-notifications.test.js`
- Modify: `tests/admin-structure.test.js`
- Create or modify: `tests/recruiter-structure.test.js`
- Modify: `tests/contact-structure.test.js`

**Interfaces:**
- Consumes: existing authenticated `supabase` client, verified profile from `requireAdmin()` or `requireStaff()`.
- Produces:
  - `initStaffNotifications({ profile, onOpen, onStateChange }) -> { setEnabled(enabled, { requestSystemPermission }), destroy }`
  - `onOpen(kind)` where `kind` is `'applications'|'messages'|'leads'`.
  - local preference key `eworker360.staffNotifications.enabled`.

- [ ] **Step 1: Write failing module/isolation tests**

Tests must assert exactly three Realtime postgres-change INSERT subscriptions for `applications`, `contact_messages`, `business_leads`; no UPDATE/DELETE subscription; module import only from admin/recruiter portals; generic system notification strings; and `Notification.requestPermission()` only in the explicit enable path.

```js
for (const table of ['applications', 'contact_messages', 'business_leads']) {
  assert.match(module, new RegExp(`event:\\s*['"]INSERT['"][\\s\\S]*table:\\s*['"]${table}['"]`))
}
assert.doesNotMatch(module, /payload\.new\.(name|email|phone|message|full_name)/)
assert.doesNotMatch(publicApp, /staff-notifications/)
assert.match(module, /setEnabled/)
assert.match(module, /removeChannel/)
```

- [ ] **Step 2: Run tests and confirm RED**

Run:
```bash
node --test tests/staff-notifications.test.js tests/admin-structure.test.js tests/contact-structure.test.js
```
Expected: FAIL because the shared notification module and controls do not exist.

- [ ] **Step 3: Implement the shared module with real opt-in**

Define:
```js
const EVENT_CONFIG = {
  applications: { kind: 'applications', title: 'Llegó una nueva solicitud' },
  contact_messages: { kind: 'messages', title: 'Llegó un nuevo mensaje de talento' },
  business_leads: { kind: 'leads', title: 'Llegó una nueva propuesta de empresa' },
}
```

`initStaffNotifications` must return inert controls unless `profile.active` and role is `admin|boss|recruiter`. It reads the local preference. If preference is `true`, it may restore the realtime channel automatically because the user previously opted in, but it must never call `Notification.requestPermission()` automatically. If preference is false, there is no active realtime channel.

`setEnabled(true, { requestSystemPermission:true })` is called only from the user's `Activar notificaciones` click. It stores the preference, creates one Supabase channel with three INSERT handlers, and may request browser permission. If permission is denied/unavailable, in-app toasts remain enabled. `setEnabled(false, ...)` stores false and removes the active channel.

For background system alerts:
```js
if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
  new Notification(config.title, { body: 'Abre eWorker360 para revisar el nuevo registro.' })
}
```
Never interpolate `payload.new` into notification title/body. `destroy()` must remove the channel without changing the saved user preference.

- [ ] **Step 4: Integrate Admin portal**

Add `Activar notificaciones`/`Desactivar notificaciones` and an `aria-live="polite"` toast host to `admin.html`. After `requireAdmin()` succeeds, call `initStaffNotifications`. The button calls `setEnabled(true, { requestSystemPermission:true })` or `setEnabled(false, { requestSystemPermission:false })`. `onOpen` switches to the related view and reloads dashboard data so the record is visible. Destroy the channel before sign-out and on unload.

- [ ] **Step 5: Integrate Recruiter portal**

Add the same control/toast host to `recruiter.html`. After `requireStaff()` succeeds, initialize the shared module. `onOpen` maps to `setView(kind)` and `loadData()`. Recruiters receive alerts but no delete controls. While touching role presentation, display `boss` as `Boss` rather than `Reclutador`.

- [ ] **Step 6: Add accessible toast/control styling**

Use keyboard-accessible toast buttons, `aria-live="polite"`, responsive fixed positioning, and clear enabled/disabled copy. Keep notification UI visually separate from error banners.

- [ ] **Step 7: Run focused tests and confirm GREEN**

Run:
```bash
node --test tests/staff-notifications.test.js tests/admin-structure.test.js tests/recruiter-structure.test.js tests/contact-structure.test.js
```
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add staff-notifications.js admin.html admin.js admin.css recruiter.html recruiter.js staff.css tests/staff-notifications.test.js tests/admin-structure.test.js tests/recruiter-structure.test.js tests/contact-structure.test.js
git commit -m "feat: add opt-in staff realtime notifications"
```

---

### Task 5: Realtime database publication and authorization verification

**Files:**
- Modify: `supabase/migrations/2026090503_manager_record_delete.sql`
- Create: `tests/realtime-security.test.js`

**Interfaces:**
- Consumes: existing RLS policies where active staff may SELECT operational tables and anonymous users may only INSERT public submissions.
- Produces: idempotent Realtime publication membership for `applications`, `contact_messages`, `business_leads` without weakening RLS.

- [ ] **Step 1: Write failing migration security test**

Assert the migration adds the three tables to `supabase_realtime` only if needed and does not add public SELECT grants, anonymous subscription privileges, or authenticated DELETE grants.

- [ ] **Step 2: Run test and confirm RED if publication support is absent**

Run:
```bash
node --test tests/realtime-security.test.js
```
Expected: FAIL until publication handling is explicit.

- [ ] **Step 3: Add idempotent publication SQL**

Use a guarded Postgres block that checks `pg_publication_tables` before each `alter publication supabase_realtime add table ...`. Do not disable RLS and do not add `grant select ... to anon` or broad `grant delete` statements.

- [ ] **Step 4: Run security test and confirm GREEN**

Run:
```bash
node --test tests/realtime-security.test.js
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/2026090503_manager_record_delete.sql tests/realtime-security.test.js
git commit -m "chore: enable secure realtime for staff inboxes"
```

---

### Task 6: Full regression verification and PR readiness

**Files:**
- Modify only if verification reveals a feature-scoped defect.
- Update the PR description/checklist after all commands pass.

**Interfaces:**
- Consumes: all previous tasks.
- Produces: a review-ready PR on `feature/dashboard-role-delete-realtime`; no merge/deploy.

- [ ] **Step 1: Run the complete Node suite**

```bash
npm test
```
Expected: PASS with no failures.

- [ ] **Step 2: Run deployment/package checks**

```bash
npm run check:deploy
npm run test:assets
```
Expected: both PASS.

- [ ] **Step 3: Verify protected regressions explicitly**

Run:
```bash
node --test tests/contact-structure.test.js tests/edge-functions-structure.test.js tests/realtime-security.test.js tests/staff-notifications.test.js
```
Expected: PASS, including existing contact persistence and Gmail notification structure assertions.

- [ ] **Step 4: Review the diff for security boundaries**

Confirm:
```text
- no service-role key in browser code
- no DELETE grant to anon/recruiter browser clients
- recruiter portal has no delete buttons
- public app imports no staff notification module
- system notification text contains no PII
- manage-staff validates invite role
- manage-records validates caller role, type, and UUID
- disabling notifications removes the realtime channel
```

- [ ] **Step 5: Open/update the PR**

The PR summary must state that Cloudflare merge does not deploy Supabase Edge Functions/migrations automatically and list the required manual Supabase deployment steps for `manage-staff`, `manage-records`, and migration application after merge approval.

- [ ] **Step 6: Stop before merge/deploy**

Report CI evidence and wait for explicit user approval before any merge or production deployment.

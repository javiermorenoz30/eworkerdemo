# eWorker360 Supabase Production Backend Design

## Goal

Convert the current static GitHub Pages demo into a production-capable application where employment applications, contact messages, business leads, staff access, statuses, notes, and site settings are shared across devices and persisted in Supabase instead of browser `localStorage`.

The existing visual design remains substantially unchanged. This is primarily a backend, authentication, persistence, and security migration.

## Current State

The site is a static GitHub Pages application. `admin-data.js` currently persists applications, staff accounts, settings, statuses, and notes in browser `localStorage`. `staff-auth.js` also keeps the staff session locally and validates an email/access-code pair against locally stored staff data. The public employment form writes a summarized application into that same local store. The public contact form only displays a success message and does not persist or send its data.

Therefore the current admin/recruiter behavior is a browser-local demo, not a shared production system.

## Architecture

The production architecture is:

- **GitHub Pages**: static public site and dashboard frontend.
- **Supabase Postgres**: persistent shared data.
- **Supabase Auth**: admin/recruiter email + password authentication.
- **Supabase Row Level Security (RLS)**: authorization and protection of candidate data.
- **Supabase Edge Functions**: server-side staff invitations and email notifications.
- **Cloudflare DNS**: custom-domain cutover only after the application is production-ready.

The browser may contain only the Supabase Project URL and public Publishable/Anon key. The `service_role` key, database password, SMTP password, and email-provider API keys must never be committed to the repository or embedded in frontend JavaScript.

## Roles

### Admin

An active admin can:

- Read the complete employment application, including sensitive fields.
- Update application status and internal notes.
- Read contact messages and business leads.
- Update operational status for messages and business leads.
- Read and update site settings.
- Read all staff profiles.
- Invite recruiters.
- Change recruiter/admin role metadata and active/paused state.

### Recruiter

An active recruiter can:

- Read the complete employment application, including sensitive fields.
- Update application status and internal notes.
- Read contact messages and business leads.
- Update operational status for messages and business leads.
- Read their own staff profile.

A recruiter cannot change site settings, invite users, change roles, or manage another user's authorization metadata.

### Public visitor

An unauthenticated visitor can:

- Submit an employment application.
- Submit the existing contact form.

The existing contact form's `audience` field determines persistence:

- `Empresa` -> create a `business_leads` record.
- `Talento` -> create a `contact_messages` record. Employment applications continue through `application.html`.

A public visitor cannot read, update, or delete any stored record after submission.

## Data Model

### `profiles`

Application-level authorization metadata for Supabase Auth users.

- `id uuid primary key references auth.users(id) on delete cascade`
- `email text not null`
- `full_name text not null default ''`
- `role text not null check (role in ('admin', 'recruiter'))`
- `active boolean not null default true`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Passwords are owned only by Supabase Auth and are never stored in this table.

### `applications`

Employment applications submitted from `application.html`.

- `id uuid primary key default gen_random_uuid()`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `full_name text not null`
- `email text not null`
- `phone text not null`
- `role_applied text not null default 'Solicitud general'`
- `status text not null default 'Nueva' check (status in ('Nueva', 'En revisión', 'Entrevista', 'Contratada', 'Descartada'))`
- `answers jsonb not null default '{}'::jsonb`
- `internal_note text not null default ''`

`answers` stores the complete current application form, including fields the client requires such as cedula/national ID, date of birth, financial information, and justice-related answers. These values are readable only by active authenticated admins/recruiters.

### `contact_messages`

General/talent messages from the existing public contact form when `audience = 'Talento'`.

- `id uuid primary key default gen_random_uuid()`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `name text not null`
- `email text not null`
- `subject text not null default ''`
- `message text not null`
- `status text not null default 'Nuevo' check (status in ('Nuevo', 'En revisión', 'Respondido', 'Cerrado'))`

### `business_leads`

Company-side proposals/inquiries from the existing public contact form when `audience = 'Empresa'`.

- `id uuid primary key default gen_random_uuid()`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `company_name text not null default ''`
- `contact_name text not null`
- `email text not null`
- `subject text not null default ''`
- `message text not null`
- `status text not null default 'Nuevo' check (status in ('Nuevo', 'Contactado', 'Propuesta enviada', 'Negociación', 'Ganado', 'Descartado'))`

The current form does not ask for company name, so `company_name` remains blank in the initial migration. A dedicated company-name field is not required for launch.

### `site_settings`

Shared configuration currently represented in the local demo store.

- `id bigint primary key`
- `brand_name text not null`
- `hero_title text not null`
- `hero_lead text not null`
- `contact_email text not null`
- `contact_phone text not null`
- `whatsapp text not null`
- `notification_email text not null`
- `email_subject text not null`
- `auto_reply boolean not null default true`
- `updated_at timestamptz not null default now()`

The implementation uses a singleton row with `id = 1`.

## Database Authorization Helpers

SQL helper functions centralize role checks for RLS:

- `public.is_active_staff()` -> active `profiles` row exists for `auth.uid()`.
- `public.is_admin()` -> active profile exists with `role = 'admin'`.
- `public.is_recruiter_or_admin()` -> active profile exists with `role in ('admin', 'recruiter')`.

They must be safe for RLS usage and must not expose profile data to callers.

## RLS and Column Privileges

RLS is enabled on all application-owned tables.

### `profiles`

- Public: no access.
- Active authenticated user: read own profile.
- Admin: read all profiles and update profile metadata.
- Recruiter: cannot update authorization metadata.

### `applications`

- Public/anon: `INSERT` only.
- Public insert policy requires `status = 'Nueva'` and `internal_note = ''` so anonymous callers cannot create a record already marked hired/reviewed or inject internal notes.
- Public/anon: no `SELECT`, `UPDATE`, or `DELETE`.
- Active admin/recruiter: `SELECT` all application fields.
- Active admin/recruiter: update only operational columns required by the UI (`status`, `internal_note`, `updated_at`) through database column privileges plus RLS.
- Initial UI has no delete action. Delete is not granted to recruiters; admin deletion is not required for first production release.

### `contact_messages`

- Public/anon: `INSERT` only with `status = 'Nuevo'`.
- Public/anon: no read/update/delete.
- Active admin/recruiter: read all.
- Active admin/recruiter: update only `status` and `updated_at`.

### `business_leads`

- Public/anon: `INSERT` only with `status = 'Nuevo'`.
- Public/anon: no read/update/delete.
- Active admin/recruiter: read all.
- Active admin/recruiter: update only `status` and `updated_at`.

### `site_settings`

- Public: no direct database access in the initial migration.
- Active staff: read.
- Admin: update.
- Recruiter: no update.

The public landing page keeps its existing static content for launch; making the public page dynamically consume `site_settings` is not part of this migration.

## Authentication

### Login

`staff-login.html` changes from email + local access code to email + password.

1. User submits email/password.
2. Frontend calls `supabase.auth.signInWithPassword()`.
3. App loads the user's `profiles` row.
4. Missing/inactive profile -> immediately sign out and display an authorization error.
5. `admin` -> `admin.html`.
6. `recruiter` -> `recruiter.html`.

### Route guards

- `admin.html`: active authenticated admin only.
- `recruiter.html`: active authenticated admin or recruiter.
- Unauthorized or expired session -> `staff-login.html`.

Frontend guards are for user experience. RLS is the real security boundary.

### Logout

Call `supabase.auth.signOut()` then redirect to `staff-login.html`.

### Password recovery / invitation setup

A dedicated `reset-password.html` supports both password recovery and first-time invited staff setup. After Supabase establishes the recovery/invite session, the page calls `supabase.auth.updateUser({ password })` and then routes the user to login/dashboard.

Until the custom domain is active, Supabase Auth Site URL/redirect URLs use the GitHub Pages deployment. After domain cutover, `https://eworker360dominicana.com/` becomes the production Site URL and is added to allowed redirects.

## Staff Invitation Flow

Future recruiters are invited from the admin dashboard without exposing `service_role` to the browser.

1. Admin submits recruiter name/email from the team section.
2. Frontend invokes an authenticated Supabase Edge Function, `manage-staff`.
3. The function verifies the caller JWT and re-checks that caller's active profile is `admin`.
4. The function uses its server-side `SUPABASE_SERVICE_ROLE_KEY` secret to call the Supabase Admin Auth API and invite the email.
5. The function creates/upserts the matching `profiles` row with `role = 'recruiter'`, `active = true`.
6. Recruiter opens the invitation link, sets a password on `reset-password.html`, then signs in normally.

Only the Edge Function can use the service-role credential. The browser never receives it.

## Frontend Modules

The production data boundary is split into focused browser modules:

- `supabase-config.js`: Project URL and public Publishable/Anon key only.
- `supabase-client.js`: initializes the Supabase browser client.
- `auth.js`: login, logout, current profile, role guards, password recovery.
- `data-api.js`: application/message/lead/settings/profile database operations.

Existing UI files consume these modules instead of directly calling `localStorage`.

Production `localStorage` may be used only for non-sensitive presentation preferences. It must not contain candidate submissions, staff identities, access codes/passwords, messages, leads, statuses, or internal notes.

## Employment Application Flow

The full current form remains visually intact.

1. Validate browser-required fields.
2. Build `full_name`, `email`, `phone`, `role_applied`, and the complete `answers` JSON object.
3. Insert exactly one `applications` row using the public Supabase client. The frontend does not send `status` or `internal_note`.
4. Only after the insert succeeds, show success and reset the form.
5. On failure, preserve all entered values and display a retry message.
6. After persistence, invoke `notify-submission` with the new record ID and type `application`.
7. If notification fails, keep the successful application and show no false database failure; email is secondary to persistence.

The public client never performs a `.select()` on the inserted application and has no RLS permission to read it back.

## Public Contact / Business Flow

The existing `#contact-form` remains one form and uses its current `audience` switch.

### `audience = 'Empresa'`

- `name` -> `business_leads.contact_name`
- `email` -> `business_leads.email`
- `subject` -> `business_leads.subject`
- `message` -> `business_leads.message`
- `company_name` remains `''` in the initial migration.
- After persistence, invoke email notification with type `business_lead`.

### `audience = 'Talento'`

- `name` -> `contact_messages.name`
- `email` -> `contact_messages.email`
- `subject` -> `contact_messages.subject`
- `message` -> `contact_messages.message`
- After persistence, invoke email notification with type `contact_message`.

For either path, the form is reset only after database persistence. On failure, values remain for retry.

## Admin Dashboard

The current visual style remains. The admin dashboard receives shared data from Supabase and includes:

- application counts and pipeline;
- application search/filter/sort;
- full candidate answers;
- status updates;
- internal notes;
- a contact-messages view;
- a business-leads view;
- admin-only shared settings editing;
- team profile list;
- invite recruiter action;
- pause/reactivate recruiter action;
- role display and admin-only role management.

Changes persist across devices and are visible after refresh. Realtime subscriptions are not required for v1.

## Recruiter Dashboard

The recruiter dashboard includes:

- application search/filter;
- full candidate answers;
- application status updates;
- internal notes;
- contact-messages view and status updates;
- business-leads view and status updates.

Recruiters do not see settings/team-management controls and cannot change authorization data through the database even if they manipulate frontend code.

## Email Notifications

Initial team notifications:

- new application -> configured notification email;
- new talent/contact message -> configured notification email;
- new business lead -> configured notification email.

The `notify-submission` Edge Function receives only `{ type, id }`, validates the allowed type, uses the server-side Supabase client to fetch that single newly-created row, then sends the notification through the selected email provider. Provider credentials are Supabase Function Secrets.

The function must not return sensitive record contents to the public caller. Basic duplicate suppression is required so repeated calls for the same record do not intentionally send unlimited duplicate notifications.

Automatic confirmation emails to candidates/external contacts are deferred until team notifications have been verified in production.

## Error Handling

Public forms:

- disable the submit button while pending;
- never clear the form before persistence succeeds;
- preserve values after a network/database error;
- show a clear retry message;
- prevent double-submit from one active browser request.

Authenticated pages:

- missing/expired session -> login;
- missing/inactive profile -> sign out + authorization error;
- database read failure -> visible recoverable error, not stale local demo data;
- failed status/note update -> restore prior UI state and show error.

Email failure never rolls back the stored application/message/lead. Supabase Postgres is the source of truth.

## Sensitive Data and Privacy

The client requires the complete form to be available to both admins and recruiters. Therefore:

- candidate submissions are stored in Supabase only, not production `localStorage`;
- anonymous reads are blocked by RLS;
- only active authenticated admins/recruiters can read applications;
- sensitive application content is not logged to the browser console;
- no backend secret is embedded in frontend code.

The client must separately confirm its legal basis, privacy notice, retention period, and operational handling for national ID, date of birth, financial information, and justice-related information. Technical access controls do not replace those obligations.

## First Admin Bootstrap

The first Supabase Auth user already exists.

1. Copy that user's UUID from Supabase Authentication -> Users.
2. Run the migration SQL.
3. Insert a matching `profiles` row using the UUID, email, display name, `role = 'admin'`, `active = true`.
4. Verify login via the new production staff login.
5. Create future recruiters through the admin invitation workflow, not local access codes.

## User-Supplied Supabase Configuration

The user will:

1. run the approved migration in Supabase SQL Editor;
2. provide the non-secret **Project URL**;
3. provide the non-secret browser **Publishable/Anon key**;
4. provide the UUID of the existing admin Auth user;
5. keep database password, `service_role`, SMTP credentials, and email-provider secrets private;
6. later add the email-provider API key directly to Supabase Function Secrets.

## Expected Repository Changes

Likely modified:

- `admin-data.js`
- `staff-auth.js`
- `staff-login.html`
- `admin.html`
- `admin.js`
- `recruiter.html`
- `recruiter.js`
- `application.html`
- `app.js`

New:

- `supabase-config.js`
- `supabase-client.js`
- `auth.js`
- `data-api.js`
- `reset-password.html`
- `supabase/migrations/<timestamp>_production_backend.sql`
- `supabase/functions/manage-staff/index.ts`
- `supabase/functions/notify-submission/index.ts`

Exact file-level steps are defined in the implementation plan; the security/data boundaries in this design are fixed requirements.

## Acceptance Criteria

1. A public visitor submits the complete employment form from one device.
2. An admin on another device sees that application after authentication.
3. Admin and recruiter can see the complete submitted answers, including the required sensitive fields.
4. Recruiter updates application status/note and admin sees the persisted change after refresh.
5. Public/anon cannot read applications, messages, leads, profiles, or settings using the public client.
6. Recruiter cannot update profiles/roles/settings even by manipulating browser requests.
7. Unauthenticated access to `admin.html`/`recruiter.html` redirects to login and protected database queries remain blocked.
8. `Empresa` contact submissions persist in `business_leads` and appear in admin/recruiter views.
9. `Talento` contact submissions persist in `contact_messages` and appear in admin/recruiter views.
10. Public form failure preserves entered values.
11. Database persistence remains successful if email notification delivery fails.
12. Admin can invite a recruiter without exposing `service_role` to the browser.
13. Invited recruiter can set a password and log in.
14. No production candidate/staff data or access codes are stored in `localStorage`.
15. No `service_role`, database password, SMTP password, or email-provider secret exists in repository files.
16. Existing public-site and dashboard styling continues to render without a major visual regression.

## Deployment Order

1. Create schema, helper functions, privileges, RLS, singleton settings row, and initial admin profile in Supabase.
2. Connect authentication and route guards on the current GitHub Pages URL.
3. Connect admin/recruiter shared data flows.
4. Connect employment form and existing contact form.
5. Verify cross-device persistence and RLS.
6. Configure staff-invite Edge Function.
7. Configure notification Edge Function and email provider.
8. Run end-to-end acceptance tests.
9. Only then point `eworker360dominicana.com` to the GitHub Pages site through Cloudflare DNS.
10. Preserve existing MX/TXT/SPF/DKIM/DMARC records during domain cutover.

The old website may remain on its previous hosting without the domain. Deleting that hosting is not part of this migration.

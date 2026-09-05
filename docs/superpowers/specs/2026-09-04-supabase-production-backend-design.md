# eWorker360 Supabase Production Backend Design

## Goal

Convert the current static GitHub Pages demo into a production-capable application where employment applications, contact messages, business leads, staff access, statuses, notes, and site settings are shared across devices and persisted in Supabase instead of browser `localStorage`.

The existing visual design should remain substantially unchanged. The work is primarily a backend, authentication, persistence, and security migration.

## Current State

The site is hosted as a static GitHub Pages application. The current demo store in `admin-data.js` persists applications, staff accounts, settings, and statuses in browser `localStorage`. `staff-auth.js` also keeps the staff session locally and validates an email/access-code pair against locally stored staff data. The public employment form currently writes a summarized application into that local store, and the public contact form only displays a success message without sending data to a server.

This means the current admin and recruiter flows are browser-local demos rather than a shared production system.

## Chosen Architecture

The production architecture will be:

- **GitHub Pages** for the static frontend.
- **Supabase Postgres** for persistent application data.
- **Supabase Auth** for admin and recruiter authentication using email + password.
- **Supabase Row Level Security (RLS)** for authorization and protection of sensitive candidate data.
- **Supabase Edge Functions** for server-side email notifications so provider secrets are never exposed in the public repository.
- **Cloudflare DNS** later for the custom domain; domain cutover is outside the backend implementation itself.

The browser will contain only the Supabase project URL and the public publishable/anon key. The `service_role` key, database password, SMTP password, and email-provider API keys must never be committed to the repository or embedded in frontend JavaScript.

## Roles and Access Model

Two application roles are required:

### Admin

An admin can:

- Read the full contents of employment applications.
- Read sensitive fields included in the application form.
- Update application status and internal notes.
- Read and update contact messages.
- Read and update business leads.
- Read and update site settings.
- Read the staff/profile directory.
- Manage role and active-state metadata for staff through an admin-controlled workflow.

Authentication identities themselves remain owned by Supabase Auth.

### Recruiter

A recruiter can:

- Read the full contents of employment applications, including sensitive fields.
- Update application status and internal notes.
- Read contact messages.
- Read business leads.
- Read their own profile.

A recruiter cannot manage roles, site-wide configuration, or other users' authorization metadata.

### Public visitor

An unauthenticated visitor can:

- Create an employment application.
- Create a contact message.
- Create a business lead.

An unauthenticated visitor cannot read, update, or delete any of those records after submission.

## Data Model

### `profiles`

Purpose: application-level metadata for Supabase Auth users.

Columns:

- `id uuid primary key references auth.users(id) on delete cascade`
- `email text not null`
- `full_name text not null default ''`
- `role text not null check (role in ('admin', 'recruiter'))`
- `active boolean not null default true`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

The user's password is never stored in this table.

### `applications`

Purpose: employment applications submitted from the public application form.

Columns:

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

The `answers` JSON object stores the complete form submission, including the current form's sensitive fields such as national ID/cedula, date of birth, financial information, and justice-related answers, because the client requires the complete form to be visible to both admins and recruiters.

These values must never be returned to unauthenticated users after insertion.

### `contact_messages`

Purpose: general messages sent from the public contact form.

Columns:

- `id uuid primary key default gen_random_uuid()`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `name text not null`
- `email text not null`
- `phone text not null default ''`
- `audience text not null default ''`
- `message text not null`
- `status text not null default 'Nuevo' check (status in ('Nuevo', 'En revisión', 'Respondido', 'Cerrado'))`

### `business_leads`

Purpose: proposals or company-side commercial inquiries.

Columns:

- `id uuid primary key default gen_random_uuid()`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `company_name text not null`
- `contact_name text not null`
- `email text not null`
- `phone text not null default ''`
- `service_interest text not null default ''`
- `message text not null default ''`
- `status text not null default 'Nuevo' check (status in ('Nuevo', 'Contactado', 'Propuesta enviada', 'Negociación', 'Ganado', 'Descartado'))`

### `site_settings`

Purpose: shared site/admin configuration that is currently stored in the local demo store.

Columns:

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

The implementation will use a singleton row with `id = 1`.

## Authorization Helpers

Database-side helper functions will centralize authorization checks instead of duplicating role logic in every RLS policy.

Required helpers:

- `is_active_staff()` returns true when `auth.uid()` has an active `profiles` row.
- `is_admin()` returns true when `auth.uid()` has an active `profiles` row with `role = 'admin'`.
- `is_recruiter_or_admin()` returns true when the authenticated user is active and has role `admin` or `recruiter`.

These functions must be safe for use inside RLS policies and should avoid exposing profile data to callers.

## Row Level Security Policies

RLS must be enabled on all application-owned tables.

### `profiles`

- Active authenticated users may read their own profile.
- Admins may read all profiles.
- Only admins may update profile role and active state through authenticated database access.
- Public users have no profile access.

### `applications`

- `anon` may `INSERT` rows.
- `anon` may not `SELECT`, `UPDATE`, or `DELETE` rows.
- Active admins and recruiters may `SELECT` all rows.
- Active admins and recruiters may update `status`, `internal_note`, and other application fields required by the panel.
- Delete access is admin-only if deletion is implemented; the initial UI does not need a delete action.

### `contact_messages`

- `anon` may `INSERT` rows.
- Active admins and recruiters may `SELECT` rows.
- Active admins and recruiters may update message status.
- Public read/update/delete access is denied.

### `business_leads`

- `anon` may `INSERT` rows.
- Active admins and recruiters may `SELECT` rows.
- Active admins and recruiters may update lead status and operational fields.
- Public read/update/delete access is denied.

### `site_settings`

- Active staff may read the shared settings needed by authenticated dashboards.
- Only admins may update settings.
- Public access is not required for the first migration unless the public landing page is explicitly changed to read settings dynamically.

## Authentication Flow

### Login

`staff-login.html` will change from email + temporary local access code to email + password.

Flow:

1. User submits email and password.
2. Frontend calls `supabase.auth.signInWithPassword`.
3. After a successful Supabase session is created, the app loads the matching `profiles` row.
4. If no active profile exists, the app signs the user out and displays an authorization error.
5. If `role = 'admin'`, redirect to `admin.html`.
6. If `role = 'recruiter'`, redirect to `recruiter.html`.

### Route guarding

Opening `admin.html` or `recruiter.html` directly must not grant access.

- `admin.html` requires an authenticated active profile with role `admin`.
- `recruiter.html` requires an authenticated active profile with role `admin` or `recruiter`.
- Unauthorized users are redirected to `staff-login.html`.

Frontend route guards improve user experience, but RLS remains the actual data-security boundary.

### Logout

Logout calls `supabase.auth.signOut()` and redirects to `staff-login.html`.

### Password recovery

A password-reset control will request a Supabase recovery email. The reset landing page will allow an authenticated recovery session to call `supabase.auth.updateUser({ password })`.

The GitHub Pages URL is used in Supabase Auth URL configuration until the custom domain is activated. After DNS cutover, the production domain will become the primary Site URL and allowed redirect URLs will include the production host.

## Frontend Data Access

A shared Supabase client module will replace the current local store as the production data boundary.

Recommended files/responsibilities:

- `supabase-config.js`: public project URL and publishable/anon key only.
- `supabase-client.js`: creates and exports the browser Supabase client.
- `auth.js`: session lookup, profile lookup, role guards, login, logout, password recovery.
- `data-api.js`: CRUD functions for applications, contact messages, business leads, settings, and profiles.

Existing UI files (`admin.js`, `recruiter.js`, `application.html`, `app.js`) should consume those modules rather than directly calling `localStorage`.

The local demo store may remain temporarily only for non-sensitive visual demo data during migration, but it must not remain the source of truth for production applications, staff accounts, candidate data, messages, or leads.

## Employment Application Flow

The complete public employment form remains visually intact.

On submit:

1. Validate required browser fields.
2. Build a normalized record containing `full_name`, `email`, `phone`, `role_applied`, and the complete form answers object.
3. Insert exactly one row into `applications` using the public Supabase client.
4. Only after the database insert succeeds, show the success state and reset the form.
5. If insertion fails, preserve all form values and display a retry message.
6. Trigger a server-side email notification after persistence is confirmed.

The user must never receive the inserted row's sensitive contents back from a public select query.

## Contact Message Flow

The existing contact form will stop pretending to send data.

On submit:

1. Validate input.
2. Insert one row into `contact_messages`.
3. On success, display confirmation and reset the form.
4. On failure, keep the user's entered values and show an error message.
5. Trigger a server-side notification to the configured team email after persistence succeeds.

## Business Lead Flow

Company-side inquiries will be normalized into `business_leads` rather than being mixed with candidate applications.

On submit:

1. Validate company/contact fields.
2. Insert a lead row.
3. Confirm only after persistence.
4. Trigger a server-side notification after persistence.

## Admin Dashboard Behavior

The existing admin visual design will be preserved.

The dashboard will load data from Supabase and support:

- Counts for total, new, in-progress, and hired applications.
- Application list filtering/search/sorting.
- Candidate detail view with full form answers.
- Application status updates.
- Internal notes.
- Contact-message review.
- Business-lead review.
- Shared settings for admin-only edits.
- Staff/profile listing and role/active-state management for admins.

Because data is server-persisted, changes made by one authenticated device must be visible to another after refresh. Realtime subscriptions are optional and are not required for the first production version.

## Recruiter Dashboard Behavior

The recruiter UI keeps its current purpose but reads shared Supabase data.

Recruiters can:

- Search/filter employment applications.
- Open the full submitted answers.
- Change application status.
- Add/update internal notes if the recruiter UI exposes that control.
- Review contact messages and business leads if those sections are exposed in the recruiter UI.

Recruiters cannot manage site settings, roles, or account authorization.

## Email Notifications

Email notification delivery must be server-side.

Initial notifications:

- New employment application -> notification to `info@eworker360dominicana.com` or the value in `site_settings.notification_email`.
- New contact message -> notification to the same configured team email.
- New business lead -> notification to the configured team email.

The preferred implementation is a Supabase Edge Function that receives only the inserted record ID/type, re-reads the permitted record server-side, and sends an email through the chosen email provider.

Provider credentials are stored as Supabase function secrets and never exposed to GitHub Pages.

Automatic confirmation emails to candidates and external contacts are deferred until inbound team notifications are verified in production.

## Error Handling

Public forms:

- Disable duplicate submission while a request is pending.
- Do not clear a form unless the database confirms persistence.
- Display a human-readable failure message on network/database errors.
- Allow retry without re-entering the form.

Authenticated screens:

- Expired/missing session -> redirect to login.
- Valid session but inactive/missing profile -> sign out and display an authorization message.
- Database query failure -> show a recoverable dashboard error rather than rendering stale local demo data as if it were production data.
- Failed status/note update -> preserve the visible previous state and display an error.

Email failures:

- Must not roll back or lose the underlying form submission.
- The database is the source of truth; email is a secondary notification channel.

## Privacy and Sensitive Data

The client requires the complete employment form, including sensitive fields, to remain available to both admins and recruiters.

Therefore:

- Candidate data is stored only in Supabase, not production `localStorage`.
- RLS prevents anonymous reads.
- Only authenticated active admin/recruiter profiles can read applications.
- Sensitive application content must not be logged to browser console in production.
- Secrets must never be embedded in frontend code.
- The client should separately confirm its legal/privacy basis and retention policy for collecting national ID, date of birth, financial information, and justice-related information. The technical implementation will enforce access restrictions but does not substitute for the client's privacy/compliance obligations.

## Initial Admin Bootstrap

The first Supabase Auth user already exists and will become the first admin.

Bootstrap steps:

1. Obtain that user's UUID from Supabase Authentication -> Users.
2. Run the database migration.
3. Insert a `profiles` row using that UUID, the user's email, desired display name, `role = 'admin'`, and `active = true`.
4. Confirm the admin can sign in through the production login screen before creating recruiter accounts.

Additional recruiter identities are created in Supabase Auth and then given matching `profiles` rows with `role = 'recruiter'`.

## Supabase Configuration Required from the User

The user must perform these actions in their Supabase project:

1. Run the approved SQL migration in the Supabase SQL Editor.
2. Provide the non-secret **Project URL**.
3. Provide the non-secret **Publishable/Anon key** intended for browser usage.
4. Provide the UUID of the already-created admin user.
5. Keep the database password, `service_role` key, and all provider secrets private.
6. Later, add the email-provider secret directly in Supabase Function Secrets rather than sharing it in chat or committing it to GitHub.

## Repository Changes Expected During Implementation

Existing files likely modified:

- `admin-data.js` — removed as the production source of truth or reduced to non-sensitive demo compatibility only.
- `staff-auth.js` — replaced by Supabase Auth logic.
- `staff-login.html` — changed to email/password login and recovery UI.
- `admin.js` — reads/writes Supabase data.
- `recruiter.js` — reads/writes Supabase data.
- `application.html` — submits to Supabase rather than `localStorage`.
- `app.js` — sends contact/business submissions to Supabase.
- `admin.html` and/or `recruiter.html` — updated script includes and any new message/lead views required by the existing UI.

New files expected:

- `supabase-config.js`
- `supabase-client.js`
- `auth.js`
- `data-api.js`
- `reset-password.html`
- `supabase/migrations/<timestamp>_production_backend.sql`
- `supabase/functions/notify-submission/index.ts` or equivalent Edge Function source

Exact file decomposition may be refined in the implementation plan, but the security and data boundaries defined in this design must remain unchanged.

## Testing and Acceptance Criteria

The migration is complete only when all of the following pass:

1. A public visitor can submit a complete employment application from one device.
2. The application is visible to an admin from a different authenticated device.
3. The full submitted answers, including sensitive fields, are visible to both admin and recruiter.
4. A recruiter can update an application status and an admin sees the persisted change after refresh.
5. Internal notes persist across devices.
6. A public visitor cannot read `applications`, `contact_messages`, `business_leads`, `profiles`, or admin-only settings through the public client.
7. A recruiter cannot alter admin-only profile roles or site settings.
8. An unauthenticated visitor opening `admin.html` or `recruiter.html` is redirected to login and cannot query protected data.
9. The contact form persists a message instead of only showing a fake confirmation.
10. Business inquiries persist separately from employment applications.
11. Failed public submissions keep the user's form data on screen for retry.
12. Database persistence succeeds even if the email notification provider is unavailable.
13. No production candidate or staff data is written to `localStorage`.
14. No `service_role`, database password, SMTP password, or email-provider secret appears in repository files.
15. GitHub Pages continues to render the current public site and dashboard styling without a major visual regression.

## Deployment Order

Production cutover should happen in this order:

1. Create database schema, functions, RLS, and initial admin profile in Supabase.
2. Connect frontend authentication and protected dashboards on the existing GitHub Pages URL.
3. Connect employment, contact, and business forms.
4. Verify cross-device persistence and RLS behavior.
5. Configure and verify team email notifications.
6. Complete end-to-end acceptance testing.
7. Only after the application is production-ready, point `eworker360dominicana.com` to the new GitHub Pages site through Cloudflare DNS.
8. Preserve existing MX/TXT/SPF/DKIM/DMARC records during domain cutover so corporate email remains operational.

The old website may remain on its previous hosting without the domain; deleting the old hosting is not a requirement for this migration.

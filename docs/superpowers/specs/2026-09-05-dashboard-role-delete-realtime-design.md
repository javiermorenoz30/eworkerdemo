# Dashboard roles, deletion, and realtime alerts

## Scope

This change extends the existing authenticated dashboard without changing the public contact/application submission flow or Gmail notification delivery.

Goals:
1. Admin and Boss can choose the invited staff role: Admin, Boss, or Recruiter.
2. Admin and Boss can permanently delete contact messages and business proposals from the dashboard after an explicit confirmation.
3. Authenticated Admin, Boss, and Recruiter users can opt in to realtime dashboard notifications for new applications, contact messages, and business proposals.
4. Anonymous/public-site visitors never receive internal notifications.

## Roles and invitation flow

The current staff invitation flow already runs through the authenticated `manage-staff` Edge Function and verifies that the caller is an active Admin or Boss. The new invitation form will add a role selector with `admin`, `boss`, and `recruiter`. The selected role is sent to `manage-staff`, validated against that allowlist, and stored in `profiles.role` for the invited user.

The UI will default to Recruiter so the existing least-privilege behavior remains the default. Admin and Boss retain the ability to change staff roles later through the existing team controls. Recruiters cannot invite staff.

## Permanent deletion of messages and proposals

Only active Admin and Boss users may permanently delete rows from `contact_messages` and `business_leads`.

Each record in the dashboard will expose an `Eliminar` action. Clicking it will require a browser confirmation that clearly says the deletion is permanent. If confirmed, the dashboard calls a dedicated authenticated server-side operation rather than granting broad delete access to browser clients.

The server operation will:
- validate the caller session;
- confirm the caller profile is active and has role `admin` or `boss`;
- accept only the supported resource type and a valid UUID;
- delete exactly one matching row;
- return success/failure without exposing service-role credentials.

After success, the dashboard removes the record from local state and updates counts immediately. Applications are intentionally excluded from deletion in this scope.

## Realtime staff notifications

The dashboard will subscribe to Supabase Realtime Postgres changes for INSERT events on:
- `applications`;
- `contact_messages`;
- `business_leads`.

The subscription is created only after the existing authentication/profile guard confirms an active staff profile with role Admin, Boss, or Recruiter. The public landing page will not import or initialize this staff notification module.

For each new row, the dashboard will show a small in-app toast such as:
- `Llegó una nueva solicitud`;
- `Llegó un nuevo mensaje de talento`;
- `Llegó una nueva propuesta de empresa`.

Selecting the toast will switch the dashboard to the related section and refresh that dataset so the new record is visible.

## Browser/system notifications

The dashboard will provide a user-controlled `Activar notificaciones` setting. It will request the browser Notifications API permission only after the user explicitly clicks the control; it will never prompt automatically on page load.

When permission is granted and the page is in the background, realtime events may also produce a browser/system notification. No applicant/contact names, email addresses, phone numbers, message bodies, or other sensitive fields will appear in the system notification; only the generic event type is shown.

This is a session-bound feature, not full push messaging. The user must have an authenticated dashboard session and an open dashboard page. If the browser/tab is fully closed, notifications are not guaranteed. Adding true push notifications while the app is closed would require a separate service-worker/push backend and is intentionally outside this scope.

The notification preference can be stored locally in the browser because it contains no sensitive business data; authorization still comes from the live Supabase session and profile role, not from the local preference.

## Realtime security

Realtime access must follow existing row-level security rather than exposing data to anonymous users. The database configuration/migration will ensure authenticated staff can receive the required INSERT events while anonymous users cannot select or subscribe to sensitive operational tables.

The dashboard subscription should use the existing authenticated Supabase client session. If the session expires or the profile is no longer active/authorized, existing auth handling will remove access; the notification channel will be cleaned up on unload/sign-out where practical.

## Files/components expected to change

- `admin.html`: role selector for invitations and notification opt-in UI if needed.
- `admin.js`: invitation role handling, delete controls/confirmations, realtime subscription, toast/system notification behavior, state refresh.
- `data-api.js`: role-aware invite request and authenticated delete operation wrapper.
- `supabase/functions/manage-staff/index.ts`: validate and persist the selected invite role.
- a new authenticated Edge Function or narrowly scoped RPC for manager-only message/lead deletion.
- Supabase migration/config for RLS/Realtime publication requirements if not already present.
- tests covering authorization, invitation role validation, permanent deletion, realtime initialization, and public-site isolation.

## Error handling

- Invalid invitation role: reject with 400 and do not create an incorrectly privileged profile.
- Unauthorized deletion: reject with 401/403.
- Missing record: return a safe not-found response; the dashboard can refresh its list.
- Realtime subscription failure: dashboard remains usable and shows a non-blocking notice; normal manual refresh/data loading continues.
- Browser notification permission denied: in-app toasts continue to work.
- Deletion failure: keep the record visible and show an error; never optimistically hide it before server confirmation.

## Testing and verification

Implementation will follow TDD. Tests will verify:
- invitation UI exposes Admin/Boss/Recruiter and sends the selected role;
- `manage-staff` accepts only the three supported roles and persists the requested role;
- Recruiter cannot invoke manager-only deletion;
- Admin/Boss deletion operations target only `contact_messages` or `business_leads` and require explicit dashboard confirmation;
- dashboard realtime subscriptions cover the three INSERT sources only after authenticated staff access;
- public scripts do not initialize internal realtime notifications;
- system notification content is generic and contains no sensitive fields;
- existing contact persistence and Gmail notification tests continue to pass;
- `npm test`, deploy checks, and asset checks remain green before the PR is marked ready.

## Deployment boundary

The feature will be developed on `feature/dashboard-role-delete-realtime` and submitted as a PR. It will not be merged or deployed without explicit approval. Supabase schema/Edge Function changes may require an additional Supabase deployment step after merge; Cloudflare deployment alone does not deploy Supabase Edge Functions.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role text not null check (role in ('admin', 'recruiter')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  full_name text not null,
  email text not null,
  phone text not null,
  role_applied text not null default 'Solicitud general',
  status text not null default 'Nueva' check (status in ('Nueva', 'En revisión', 'Entrevista', 'Contratada', 'Descartada')),
  answers jsonb not null default '{}'::jsonb,
  internal_note text not null default ''
);

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  email text not null,
  subject text not null default '',
  message text not null,
  status text not null default 'Nuevo' check (status in ('Nuevo', 'En revisión', 'Respondido', 'Cerrado'))
);

create table if not exists public.business_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  company_name text not null default '',
  contact_name text not null,
  email text not null,
  subject text not null default '',
  message text not null default '',
  status text not null default 'Nuevo' check (status in ('Nuevo', 'Contactado', 'Propuesta enviada', 'Negociación', 'Ganado', 'Descartado'))
);

create table if not exists public.site_settings (
  id bigint primary key,
  brand_name text not null,
  hero_title text not null,
  hero_lead text not null,
  contact_email text not null,
  contact_phone text not null,
  whatsapp text not null,
  notification_email text not null,
  email_subject text not null,
  auto_reply boolean not null default true,
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists applications_set_updated_at on public.applications;
create trigger applications_set_updated_at
before update on public.applications
for each row execute function public.set_updated_at();

drop trigger if exists contact_messages_set_updated_at on public.contact_messages;
create trigger contact_messages_set_updated_at
before update on public.contact_messages
for each row execute function public.set_updated_at();

drop trigger if exists business_leads_set_updated_at on public.business_leads;
create trigger business_leads_set_updated_at
before update on public.business_leads
for each row execute function public.set_updated_at();

drop trigger if exists site_settings_set_updated_at on public.site_settings;
create trigger site_settings_set_updated_at
before update on public.site_settings
for each row execute function public.set_updated_at();

create or replace function public.is_active_staff()
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
  );
$$;

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
      and role = 'admin'
  );
$$;

create or replace function public.is_recruiter_or_admin()
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
      and role in ('admin', 'recruiter')
  );
$$;

revoke all on function public.is_active_staff() from public;
revoke all on function public.is_admin() from public;
revoke all on function public.is_recruiter_or_admin() from public;
grant execute on function public.is_active_staff() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_recruiter_or_admin() to authenticated;

alter table public.profiles enable row level security;
alter table public.applications enable row level security;
alter table public.contact_messages enable row level security;
alter table public.business_leads enable row level security;
alter table public.site_settings enable row level security;

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

drop policy if exists profiles_self_or_admin_select on public.profiles;
create policy profiles_self_or_admin_select
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update
on public.profiles for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists applications_public_insert on public.applications;
create policy applications_public_insert
on public.applications for insert
to anon, authenticated
with check (status = 'Nueva' and internal_note = '');

drop policy if exists applications_staff_select on public.applications;
create policy applications_staff_select
on public.applications for select
to authenticated
using (public.is_recruiter_or_admin());

drop policy if exists applications_staff_update on public.applications;
create policy applications_staff_update
on public.applications for update
to authenticated
using (public.is_recruiter_or_admin())
with check (public.is_recruiter_or_admin());

drop policy if exists contact_messages_public_insert on public.contact_messages;
create policy contact_messages_public_insert
on public.contact_messages for insert
to anon, authenticated
with check (status = 'Nuevo');

drop policy if exists contact_messages_staff_select on public.contact_messages;
create policy contact_messages_staff_select
on public.contact_messages for select
to authenticated
using (public.is_recruiter_or_admin());

drop policy if exists contact_messages_staff_update on public.contact_messages;
create policy contact_messages_staff_update
on public.contact_messages for update
to authenticated
using (public.is_recruiter_or_admin())
with check (public.is_recruiter_or_admin());

drop policy if exists business_leads_public_insert on public.business_leads;
create policy business_leads_public_insert
on public.business_leads for insert
to anon, authenticated
with check (status = 'Nuevo');

drop policy if exists business_leads_staff_select on public.business_leads;
create policy business_leads_staff_select
on public.business_leads for select
to authenticated
using (public.is_recruiter_or_admin());

drop policy if exists business_leads_staff_update on public.business_leads;
create policy business_leads_staff_update
on public.business_leads for update
to authenticated
using (public.is_recruiter_or_admin())
with check (public.is_recruiter_or_admin());

drop policy if exists settings_staff_select on public.site_settings;
create policy settings_staff_select
on public.site_settings for select
to authenticated
using (public.is_active_staff());

drop policy if exists settings_admin_update on public.site_settings;
create policy settings_admin_update
on public.site_settings for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into public.site_settings (
  id,
  brand_name,
  hero_title,
  hero_lead,
  contact_email,
  contact_phone,
  whatsapp,
  notification_email,
  email_subject,
  auto_reply
) values (
  1,
  'eWorker360 Dominicana',
  'Conectamos talento dominicano con oportunidades globales.',
  'Operaciones de customer experience, televentas y soporte diseñadas para crecer con precisión, humanidad y velocidad.',
  'info@eworker360dominicana.com',
  '+1 809 824 2463',
  'https://wa.me/18098242463',
  'info@eworker360dominicana.com',
  'Nueva solicitud desde eWorker360',
  true
)
on conflict (id) do nothing;

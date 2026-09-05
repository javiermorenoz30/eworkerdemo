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
      and role in ('admin', 'boss', 'recruiter')
  );
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.is_recruiter_or_admin() from public;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_recruiter_or_admin() to authenticated;

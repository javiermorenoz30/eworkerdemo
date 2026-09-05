begin;

-- These checks are intended to be run manually in Supabase SQL Editor
-- after the production migration. All test data is rolled back.

-- 1) Anonymous insert of a valid application must succeed.
set local role anon;
insert into public.applications (
  id,
  full_name,
  email,
  phone,
  role_applied,
  answers
) values (
  '00000000-0000-4000-8000-000000000001',
  'RLS Test Applicant',
  'rls-test@example.invalid',
  '+10000000000',
  'Ventas',
  '{"source":"rls-smoke"}'::jsonb
);
reset role;

-- 2) Anonymous SELECT must be rejected by privileges/RLS.
do $$
declare
  was_blocked boolean := false;
begin
  begin
    set local role anon;
    perform * from public.applications
      where id = '00000000-0000-4000-8000-000000000001';
    reset role;
  exception when others then
    was_blocked := true;
    reset role;
  end;

  if not was_blocked then
    raise exception 'RLS smoke failure: anon SELECT unexpectedly succeeded';
  end if;
end;
$$;

-- 3) Anonymous callers must not be able to set an operational status.
do $$
declare
  was_blocked boolean := false;
begin
  begin
    set local role anon;
    insert into public.applications (
      id, full_name, email, phone, role_applied, answers, status
    ) values (
      '00000000-0000-4000-8000-000000000002',
      'Invalid Status Test',
      'invalid-status@example.invalid',
      '+10000000000',
      'Ventas',
      '{}'::jsonb,
      'Contratada'
    );
    reset role;
  exception when others then
    was_blocked := true;
    reset role;
  end;

  if not was_blocked then
    raise exception 'RLS smoke failure: anon set status on insert';
  end if;
end;
$$;

-- 4) Anonymous callers must not be able to inject an internal note.
do $$
declare
  was_blocked boolean := false;
begin
  begin
    set local role anon;
    insert into public.applications (
      id, full_name, email, phone, role_applied, answers, internal_note
    ) values (
      '00000000-0000-4000-8000-000000000003',
      'Invalid Note Test',
      'invalid-note@example.invalid',
      '+10000000000',
      'Ventas',
      '{}'::jsonb,
      'should never be accepted'
    );
    reset role;
  exception when others then
    was_blocked := true;
    reset role;
  end;

  if not was_blocked then
    raise exception 'RLS smoke failure: anon set internal_note on insert';
  end if;
end;
$$;

-- 5) No sensitive application-owned table may grant SELECT to anon.
do $$
declare
  exposed_count integer;
begin
  select count(*)
    into exposed_count
  from information_schema.role_table_grants
  where grantee = 'anon'
    and privilege_type = 'SELECT'
    and table_schema = 'public'
    and table_name in (
      'profiles',
      'applications',
      'contact_messages',
      'business_leads',
      'site_settings'
    );

  if exposed_count <> 0 then
    raise exception 'RLS smoke failure: anon has SELECT on % sensitive table(s)', exposed_count;
  end if;
end;
$$;

rollback;

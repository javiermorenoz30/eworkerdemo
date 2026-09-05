begin;

-- Run manually in Supabase SQL Editor after applying the 20260905 migrations.
-- All checks happen inside this transaction and are rolled back.

-- Published content is intentionally readable by anonymous visitors.
set local role anon;
select id, status from public.landing_versions where status = 'published';
select id, type, position from public.landing_sections where visible = true order by position;
reset role;

-- Anonymous callers must never see the draft version.
do $$
declare
  draft_count integer;
begin
  set local role anon;
  select count(*) into draft_count
  from public.landing_versions
  where status = 'draft';
  reset role;

  if draft_count <> 0 then
    raise exception 'Landing RLS smoke failure: anon can read the draft version';
  end if;
end;
$$;

-- Anonymous callers must never see sections owned by the draft version.
do $$
declare
  draft_section_count integer;
begin
  set local role anon;
  select count(*) into draft_section_count
  from public.landing_sections section
  where exists (
    select 1
    from public.landing_versions version
    where version.id = section.version_id
      and version.status = 'draft'
  );
  reset role;

  if draft_section_count <> 0 then
    raise exception 'Landing RLS smoke failure: anon can read draft sections';
  end if;
end;
$$;

-- Storage write policies must remain manager-only and scoped to landing-media.
do $$
declare
  policy_count integer;
begin
  select count(*) into policy_count
  from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and policyname in (
      'landing_media_manager_insert',
      'landing_media_manager_update',
      'landing_media_manager_delete'
    )
    and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) like '%landing-media%'
    and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) like '%is_admin%';

  if policy_count <> 3 then
    raise exception 'Landing RLS smoke failure: expected 3 manager Storage policies, found %', policy_count;
  end if;
end;
$$;

rollback;

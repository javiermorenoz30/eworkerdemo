-- Manager-only record deletion remains server-side through the manage-records Edge Function.
-- Do not grant DELETE on operational tables to authenticated browser clients.

-- Ensure the three operational tables are available to Supabase Realtime.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'applications'
  ) then
    alter publication supabase_realtime add table public.applications;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'contact_messages'
  ) then
    alter publication supabase_realtime add table public.contact_messages;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'business_leads'
  ) then
    alter publication supabase_realtime add table public.business_leads;
  end if;
end;
$$;

revoke delete on public.applications from anon, authenticated;
revoke delete on public.contact_messages from anon, authenticated;
revoke delete on public.business_leads from anon, authenticated;

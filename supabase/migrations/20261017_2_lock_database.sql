-- ============================================================
-- TAYEB ENGINE V2 — PART 2: LOCK THE DATABASE
-- ============================================================
-- Run this ONLY AFTER the engine-v2 code is live on Vercel.
-- The old app reads the database straight from the browser
-- and stops working once this runs.
--
-- After this, the public (anon) key in the browser can't
-- read or change anything. Only Tayeb's server, which uses
-- the service role key, can reach the data.

-- Turn on row level security everywhere.
alter table public.users enable row level security;
alter table public.shipments enable row level security;
alter table public.bids enable row level security;
alter table public.notifications enable row level security;

do $$
begin
    if to_regclass('public.subscriptions') is not null then
        execute 'alter table public.subscriptions enable row level security';
    end if;

    if to_regclass('public.feedback') is not null then
        execute 'alter table public.feedback enable row level security';
    end if;
end $$;

-- Remove every existing policy on these tables, including
-- any "allow all" policies. With no policies left, the anon
-- and authenticated roles get nothing.
do $$
declare
    p record;
begin
    for p in
        select policyname, tablename
        from pg_policies
        where schemaname = 'public'
          and tablename in ('users', 'shipments', 'bids', 'notifications', 'subscriptions', 'feedback')
    loop
        execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename);
    end loop;
end $$;

-- Check: every row should say rowsecurity = true and the
-- second query should return no rows.
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('users', 'shipments', 'bids', 'notifications', 'subscriptions', 'feedback');

select tablename, policyname
from pg_policies
where schemaname = 'public';

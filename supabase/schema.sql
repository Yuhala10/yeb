-- ============================================================
-- TAYEB DATABASE — COMPLETE SETUP FOR A NEW SUPABASE PROJECT
-- ============================================================
-- Run once in Supabase → SQL Editor → New query → Run.
-- Safe to run again: it only creates what's missing.
--
-- Only Tayeb's server (service role key) can read or write.
-- The public anon key gets no access at all.


-- ============================================================
-- USERS (shippers and drivers)
-- ============================================================

create table if not exists public.users (
    id uuid primary key default gen_random_uuid(),
    full_name text not null,
    -- Always the 9-digit Cameroon number, e.g. 681731512.
    phone_number text not null unique,
    role text not null check (role in ('SHIPPER', 'DRIVER')),

    -- Login: scrypt hash of the 4–6 digit PIN, locked 15 min after 5 wrong tries.
    pin_hash text,
    pin_failed_attempts integer not null default 0,
    pin_locked_until timestamptz,

    -- Drivers
    vehicle_type text,
    vehicle_number text,
    plate_number text,
    profile_photo text,
    base_city text,
    is_available boolean default true,
    last_seen timestamptz,

    -- Reputation: average of shipper ratings and how many there are.
    rating numeric(3, 1),
    rating_count integer not null default 0,
    total_completed_shipments integer not null default 0,

    created_at timestamptz not null default now()
);


-- ============================================================
-- SHIPMENTS (loads)
-- ============================================================
-- OPEN → MATCHED → DEPARTED → ARRIVED → COMPLETED, or OPEN → CANCELLED

create table if not exists public.shipments (
    id uuid primary key default gen_random_uuid(),

    shipper_id uuid not null references public.users (id) on delete cascade,
    shipper_name text,
    shipper_phone text,

    item_type text not null,
    -- "Akwa, Douala" for display; the city alone for matching.
    origin text not null,
    destination text not null,
    origin_city text,
    destination_city text,
    quantity numeric not null check (quantity > 0),
    initial_offer integer not null check (initial_offer > 0),
    receiver_phone text,

    status text not null default 'OPEN'
        check (status in ('OPEN', 'MATCHED', 'DEPARTED', 'ARRIVED', 'COMPLETED', 'CANCELLED')),

    driver_id uuid references public.users (id) on delete set null,
    driver_name text,
    driver_phone text,
    agreed_price integer check (agreed_price > 0),

    matched_at timestamptz,
    departed_at timestamptz,
    arrived_at timestamptz,
    completed_at timestamptz,

    -- Proof of delivery: the receiver gives this code to the driver.
    delivery_code text,
    delivery_code_attempts integer not null default 0,

    -- The shipper's rating of the driver for this delivery.
    driver_rating smallint check (driver_rating between 1 and 5),

    -- Live tracking: the truck's last known position.
    last_lat double precision,
    last_lng double precision,
    last_location_at timestamptz,
    last_location_accuracy integer,

    created_at timestamptz not null default now()
);


-- ============================================================
-- BIDS (driver prices and counter-offers)
-- ============================================================
-- proposed_price: the driver's first price.
-- counter_price: the latest price on the table; last_offer_by says who made it.

create table if not exists public.bids (
    id uuid primary key default gen_random_uuid(),
    shipment_id uuid not null references public.shipments (id) on delete cascade,
    driver_id uuid not null references public.users (id) on delete cascade,
    proposed_price integer not null check (proposed_price > 0),
    counter_price integer check (counter_price > 0),
    last_offer_by text check (last_offer_by in ('DRIVER', 'SHIPPER')),
    status text not null default 'PENDING'
        check (status in ('PENDING', 'COUNTERED', 'ACCEPTED', 'REJECTED')),
    eta text,
    note text,
    created_at timestamptz not null default now(),

    -- One offer per driver per load; changing a price updates it.
    unique (shipment_id, driver_id)
);


-- ============================================================
-- NOTIFICATIONS
-- ============================================================

create table if not exists public.notifications (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.users (id) on delete cascade,
    shipment_id uuid references public.shipments (id) on delete cascade,
    title text,
    message text,
    type text,
    read boolean not null default false,
    created_at timestamptz not null default now()
);


-- ============================================================
-- FEEDBACK
-- ============================================================

create table if not exists public.feedback (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.users (id) on delete set null,
    feedback_type text,
    message text not null,
    contact_phone text,
    status text not null default 'UNREAD',
    created_at timestamptz not null default now()
);


-- ============================================================
-- SUBSCRIPTIONS (for driver plans later; account deletion uses it)
-- ============================================================

create table if not exists public.subscriptions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.users (id) on delete cascade,
    momo_txid text,
    amount integer,
    status text not null default 'PENDING',
    created_at timestamptz not null default now()
);


-- ============================================================
-- INDEXES (fast dashboards and matching)
-- ============================================================

create index if not exists shipments_status_idx on public.shipments (status, created_at desc);
create index if not exists shipments_shipper_idx on public.shipments (shipper_id, created_at desc);
create index if not exists shipments_driver_idx on public.shipments (driver_id, created_at desc);
create index if not exists shipments_route_idx on public.shipments (origin_city, destination_city);
create index if not exists bids_shipment_idx on public.bids (shipment_id);
create index if not exists bids_driver_idx on public.bids (driver_id, created_at desc);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists users_role_idx on public.users (role);
create index if not exists subscriptions_user_idx on public.subscriptions (user_id);


-- ============================================================
-- ACCESS: SERVER ONLY
-- ============================================================
-- Row level security with no policies means the anon and
-- authenticated roles can't see or change any row. The
-- service role (Tayeb's server) bypasses it.

alter table public.users enable row level security;
alter table public.shipments enable row level security;
alter table public.bids enable row level security;
alter table public.notifications enable row level security;
alter table public.feedback enable row level security;
alter table public.subscriptions enable row level security;

revoke all on public.users, public.shipments, public.bids, public.notifications, public.feedback, public.subscriptions
    from anon, authenticated;

grant all on public.users, public.shipments, public.bids, public.notifications, public.feedback, public.subscriptions
    to service_role;


-- ============================================================
-- CHECK
-- ============================================================
-- Should list the 6 tables, all with rowsecurity = true.

select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('users', 'shipments', 'bids', 'notifications', 'feedback', 'subscriptions')
order by tablename;

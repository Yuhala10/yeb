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
-- MARKET, AFRICA-WIDE, MULTI-PHOTO (same as supabase/upgrade.sql)
-- ============================================================
-- FARMERS ARE A THIRD KIND OF ACCOUNT
-- ============================================================

alter table public.users drop constraint if exists users_role_check;

alter table public.users
    add constraint users_role_check check (role in ('SHIPPER', 'DRIVER', 'FARMER'));


-- ============================================================
-- PRODUCTS (what farmers have for sale)
-- ============================================================
-- product: a key from lib/produce.js (TOMATOES, MAIZE, …).
-- unit: KG, TONNE, BAG, CRATE, BUNCH, BASIN, BUCKET, TRAY, LITRE, PIECE.
-- quantity_available goes down when the farmer confirms an order.

create table if not exists public.products (
    id uuid primary key default gen_random_uuid(),
    farmer_id uuid not null references public.users (id) on delete cascade,

    product text not null,
    custom_name text,
    details text,

    unit text not null,
    unit_weight_kg numeric check (unit_weight_kg > 0),
    price_per_unit integer not null check (price_per_unit > 0),
    quantity_available numeric not null default 0 check (quantity_available >= 0),
    min_order numeric not null default 1 check (min_order >= 0),

    city text not null,
    area text,
    available_from date,
    available_until date,
    perishable boolean not null default false,

    photo_url text,
    photo_path text,

    status text not null default 'ACTIVE'
        check (status in ('ACTIVE', 'PAUSED', 'SOLD_OUT', 'ARCHIVED')),

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);


-- ============================================================
-- ORDERS (buyer → farmer)
-- ============================================================
-- PENDING → CONFIRMED → COMPLETED
-- PENDING → DECLINED | CANCELLED | EXPIRED (after 48 h)
-- CONFIRMED → CANCELLED (only before a driver is chosen)
--
-- Product, price and names are copied at order time so the
-- record stays right even if the listing changes later.

create table if not exists public.orders (
    id uuid primary key default gen_random_uuid(),

    product_id uuid references public.products (id) on delete set null,
    farmer_id uuid references public.users (id) on delete set null,
    buyer_id uuid references public.users (id) on delete set null,
    farmer_name text,
    buyer_name text,

    product text not null,
    custom_name text,
    unit text not null,
    unit_weight_kg numeric,
    price_per_unit integer not null check (price_per_unit > 0),
    quantity numeric not null check (quantity > 0),
    total_price bigint not null check (total_price >= 0),
    weight_kg numeric,
    perishable boolean not null default false,
    product_city text,
    product_area text,

    delivery_method text not null default 'TAYEB'
        check (delivery_method in ('TAYEB', 'PICKUP')),
    delivery_city text,
    delivery_area text,
    receiver_phone text,
    delivery_budget integer check (delivery_budget > 0),

    payment_terms text not null
        check (payment_terms in ('MOMO_ON_DELIVERY', 'MOMO_BEFORE_PICKUP', 'CASH_ON_PICKUP')),
    needed_by date,
    note text,

    status text not null default 'PENDING'
        check (status in ('PENDING', 'CONFIRMED', 'COMPLETED', 'DECLINED', 'CANCELLED', 'EXPIRED')),
    decline_reason text,
    decline_message text,

    -- The Tayeb load created when the farmer confirms (delivery orders).
    shipment_id uuid references public.shipments (id) on delete set null,

    farmer_rating smallint check (farmer_rating between 1 and 5),

    confirmed_at timestamptz,
    declined_at timestamptz,
    cancelled_at timestamptz,
    cancelled_by text,
    completed_at timestamptz,
    paid_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);


-- ============================================================
-- LOADS CREATED FROM ORDERS
-- ============================================================

alter table public.shipments add column if not exists order_id uuid references public.orders (id) on delete set null;
-- Who the driver collects from (the farmer), shown after they're chosen.
alter table public.shipments add column if not exists pickup_name text;
alter table public.shipments add column if not exists pickup_phone text;
alter table public.shipments add column if not exists weight_kg numeric;
alter table public.shipments add column if not exists perishable boolean not null default false;
alter table public.shipments add column if not exists details text;


-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists products_market_idx on public.products (status, created_at desc);
create index if not exists products_farmer_idx on public.products (farmer_id, created_at desc);
create index if not exists products_search_idx on public.products (product, city);
create index if not exists orders_farmer_idx on public.orders (farmer_id, created_at desc);
create index if not exists orders_buyer_idx on public.orders (buyer_id, created_at desc);
create index if not exists orders_status_idx on public.orders (status, created_at);
create index if not exists orders_prices_idx on public.orders (product, unit, status);
create index if not exists orders_product_idx on public.orders (product_id);
create index if not exists shipments_order_idx on public.shipments (order_id);


-- ============================================================
-- ACCESS: SERVER ONLY
-- ============================================================

alter table public.products enable row level security;
alter table public.orders enable row level security;

revoke all on public.products, public.orders from anon, authenticated;

grant all on public.products, public.orders to service_role;


-- ============================================================
-- PRODUCT PHOTOS
-- ============================================================
-- Public bucket: anyone can view photos (they appear on the
-- market and in WhatsApp previews). Only the server uploads.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('produce', 'produce', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
    set public = true,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;




-- ============================================================
-- AFRICA-WIDE: COUNTRY AND CURRENCY
-- ============================================================
-- Everything before this upgrade was in Cameroon (CM, XAF).

alter table public.users add column if not exists country text default 'CM';
update public.users set country = 'CM' where country is null;

alter table public.products add column if not exists country text not null default 'CM';
alter table public.products add column if not exists currency text not null default 'XAF';

alter table public.orders add column if not exists country text not null default 'CM';
alter table public.orders add column if not exists currency text not null default 'XAF';
alter table public.orders add column if not exists delivery_country text;

alter table public.shipments add column if not exists country text not null default 'CM';
alter table public.shipments add column if not exists currency text not null default 'XAF';

-- Phone numbers are now international digits: 681731512 → 237681731512.
-- Skipped when the international form already belongs to another account.
update public.users as u
set phone_number = '237' || u.phone_number
where u.phone_number ~ '^[26][0-9]{8}$'
  and not exists (
      select 1 from public.users as other
      where other.phone_number = '237' || u.phone_number and other.id <> u.id
  );


-- ============================================================
-- SEVERAL PHOTOS PER PRODUCT
-- ============================================================
-- photos: [{ "url": "...", "path": "..." }, …], first = cover.

alter table public.products add column if not exists photos jsonb not null default '[]'::jsonb;

update public.products
set photos = jsonb_build_array(jsonb_build_object('url', photo_url, 'path', photo_path))
where photo_url is not null and photos = '[]'::jsonb;


-- ============================================================
-- NOTIFICATIONS OPEN THE RIGHT PAGE
-- ============================================================

alter table public.notifications add column if not exists link text;


-- ============================================================
-- "TELL ME WHEN IT'S AVAILABLE"
-- ============================================================

create table if not exists public.market_alerts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.users (id) on delete cascade,
    product text not null,
    country text not null default 'CM',
    city text,
    last_notified_at timestamptz,
    created_at timestamptz not null default now()
);

create unique index if not exists market_alerts_unique_idx
    on public.market_alerts (user_id, product, country, coalesce(city, ''));
create index if not exists market_alerts_match_idx on public.market_alerts (product, country);

alter table public.market_alerts enable row level security;
revoke all on public.market_alerts from anon, authenticated;
grant all on public.market_alerts to service_role;


-- ============================================================
-- LIVE TRACKING
-- ============================================================
-- Every position the driver's phone sends while a delivery is
-- live, for the trail on the map, real speed and arrival time.

alter table public.shipments add column if not exists last_speed real;
alter table public.shipments add column if not exists last_heading real;

create table if not exists public.shipment_positions (
    id uuid primary key default gen_random_uuid(),
    shipment_id uuid not null references public.shipments (id) on delete cascade,
    lat double precision not null check (lat between -90 and 90),
    lng double precision not null check (lng between -180 and 180),
    accuracy integer,
    speed real,
    heading real,
    recorded_at timestamptz not null default now()
);

create index if not exists shipment_positions_trip_idx
    on public.shipment_positions (shipment_id, recorded_at desc);

alter table public.shipment_positions enable row level security;
revoke all on public.shipment_positions from anon, authenticated;
grant all on public.shipment_positions to service_role;


-- ============================================================
-- INDEXES FOR COUNTRIES
-- ============================================================

create index if not exists products_country_idx on public.products (country, status, created_at desc);
create index if not exists products_country_product_idx on public.products (country, product);
create index if not exists shipments_country_idx on public.shipments (country, status);


-- ============================================================
-- TAYEB GO: ON-DEMAND DELIVERY (nearest driver, fixed price)
-- ============================================================
-- Drivers go online and their phone shares where they are;
-- a customer orders a vehicle and the nearest drivers get the
-- request one after another (dispatch_offers).

alter table public.users add column if not exists vehicle_class text;
alter table public.users add column if not exists online boolean not null default false;
alter table public.users add column if not exists location_lat double precision;
alter table public.users add column if not exists location_lng double precision;
alter table public.users add column if not exists location_heading real;
alter table public.users add column if not exists location_accuracy integer;
alter table public.users add column if not exists location_at timestamptz;
alter table public.users add column if not exists jobs_cancelled integer not null default 0;

alter table public.users drop constraint if exists users_vehicle_class_check;
alter table public.users
    add constraint users_vehicle_class_check
    check (vehicle_class is null or vehicle_class in ('MOTO', 'TRICYCLE', 'PICKUP', 'VAN', 'TRUCK'));

-- BOARD: drivers send prices (as before). INSTANT: Tayeb Go.
alter table public.shipments add column if not exists mode text not null default 'BOARD';
alter table public.shipments drop constraint if exists shipments_mode_check;
alter table public.shipments add constraint shipments_mode_check check (mode in ('BOARD', 'INSTANT'));

alter table public.shipments add column if not exists vehicle_class text;
alter table public.shipments add column if not exists pickup_lat double precision;
alter table public.shipments add column if not exists pickup_lng double precision;
alter table public.shipments add column if not exists dropoff_lat double precision;
alter table public.shipments add column if not exists dropoff_lng double precision;
alter table public.shipments add column if not exists pickup_address text;
alter table public.shipments add column if not exists dropoff_address text;
alter table public.shipments add column if not exists distance_km numeric;
alter table public.shipments add column if not exists quoted_price integer;
alter table public.shipments add column if not exists payment_method text;
-- SEARCHING → ASSIGNED, or NO_DRIVER after 5 minutes.
alter table public.shipments add column if not exists dispatch_status text;
alter table public.shipments add column if not exists searching_since timestamptz;
alter table public.shipments add column if not exists at_pickup_at timestamptz;
alter table public.shipments add column if not exists cancelled_at timestamptz;
alter table public.shipments add column if not exists cancelled_by text;
alter table public.shipments add column if not exists cancel_reason text;

alter table public.shipments drop constraint if exists shipments_go_check;
alter table public.shipments
    add constraint shipments_go_check
    check (
        (pickup_lat is null or pickup_lat between -90 and 90)
        and (dropoff_lat is null or dropoff_lat between -90 and 90)
        and (pickup_lng is null or pickup_lng between -180 and 180)
        and (dropoff_lng is null or dropoff_lng between -180 and 180)
        and (quoted_price is null or quoted_price > 0)
        and (payment_method is null or payment_method in ('CASH', 'MOMO'))
        and (dispatch_status is null or dispatch_status in ('SEARCHING', 'ASSIGNED', 'NO_DRIVER'))
    );

-- One row each time a driver is asked to take a trip.
create table if not exists public.dispatch_offers (
    id uuid primary key default gen_random_uuid(),
    shipment_id uuid not null references public.shipments (id) on delete cascade,
    driver_id uuid not null references public.users (id) on delete cascade,
    wave integer not null default 1,
    distance_km numeric,
    pickup_eta_min integer,
    status text not null default 'PENDING'
        check (status in ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'TAKEN', 'CANCELLED')),
    created_at timestamptz not null default now(),
    expires_at timestamptz not null,
    responded_at timestamptz
);

create index if not exists dispatch_offers_driver_idx on public.dispatch_offers (driver_id, status, expires_at desc);
create index if not exists dispatch_offers_trip_idx on public.dispatch_offers (shipment_id, created_at);
create index if not exists users_online_idx on public.users (role, online, location_at desc);
create index if not exists shipments_mode_idx on public.shipments (mode, status, created_at desc);
create index if not exists shipments_driver_live_idx on public.shipments (driver_id, status);

alter table public.dispatch_offers enable row level security;
revoke all on public.dispatch_offers from anon, authenticated;
grant all on public.dispatch_offers to service_role;


-- ============================================================
-- CHECK
-- ============================================================
-- Should list 11 tables, all with rowsecurity = true, and the
-- produce bucket as public.

select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('users', 'shipments', 'bids', 'notifications', 'feedback', 'subscriptions', 'products', 'orders', 'market_alerts', 'shipment_positions', 'dispatch_offers')
order by tablename;

select id, public from storage.buckets where id = 'produce';

-- ============================================================
-- TAYEB UPGRADE: MARKET, AFRICA-WIDE, MULTI-PHOTO
-- ============================================================
-- Run once in Supabase → SQL Editor → New query → Run, in the
-- project where supabase/schema.sql already ran. Safe to run
-- again, and safe if supabase/marche.sql already ran.
--
-- Adds: Tayeb Marché (farmers, products, orders, photos),
-- countries and currencies across Africa, several photos per
-- product, notification links, "tell me when available"
-- alerts, live tracking, Tayeb Go (on-demand delivery) and the
-- social market (farm profiles, likes, saves, follows, voice notes).
--
-- Until this runs, Tayeb keeps working as before and the
-- market pages say "opening soon".


-- Wrong project? A project without Tayeb's tables needs
-- supabase/schema.sql (the complete setup) instead.
do $$
begin
    if to_regclass('public.users') is null then
        raise exception 'This Supabase project has no Tayeb tables. Open the project Tayeb uses (Settings → API → Project URL), or run supabase/schema.sql here for a new setup.';
    end if;
end $$;


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
-- SOCIAL MARKET: FARM PROFILES, POSTS, LIKES, SAVES, FOLLOWS
-- ============================================================
-- A farm has a page (tayeb…/farm/<handle>) with a photo, a
-- cover, a bio and the languages it speaks. A product is a
-- post: its description is the caption, written in any
-- language, with an optional voice note.

alter table public.users add column if not exists handle text;
alter table public.users add column if not exists farm_name text;
alter table public.users add column if not exists bio text;
alter table public.users add column if not exists languages text[] not null default '{}';
alter table public.users add column if not exists avatar_url text;
alter table public.users add column if not exists avatar_path text;
alter table public.users add column if not exists cover_url text;
alter table public.users add column if not exists cover_path text;
alter table public.users add column if not exists followers_count integer not null default 0;
-- Set by the Tayeb team after checking an ID card or visiting the farm.
alter table public.users add column if not exists verified_id boolean not null default false;
alter table public.users add column if not exists farm_visited boolean not null default false;

create unique index if not exists users_handle_idx on public.users (handle) where handle is not null;

alter table public.users drop constraint if exists users_handle_check;
alter table public.users
    add constraint users_handle_check
    check (handle is null or handle ~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$');

alter table public.products add column if not exists caption_lang text;
alter table public.products add column if not exists voice_url text;
alter table public.products add column if not exists voice_path text;
alter table public.products add column if not exists voice_seconds integer;
alter table public.products add column if not exists likes_count integer not null default 0;

create table if not exists public.product_likes (
    product_id uuid not null references public.products (id) on delete cascade,
    user_id uuid not null references public.users (id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (product_id, user_id)
);

create table if not exists public.product_saves (
    product_id uuid not null references public.products (id) on delete cascade,
    user_id uuid not null references public.users (id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (product_id, user_id)
);

create table if not exists public.follows (
    farmer_id uuid not null references public.users (id) on delete cascade,
    follower_id uuid not null references public.users (id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (farmer_id, follower_id),
    check (farmer_id <> follower_id)
);

create index if not exists product_likes_user_idx on public.product_likes (user_id, created_at desc);
create index if not exists product_saves_user_idx on public.product_saves (user_id, created_at desc);
create index if not exists follows_follower_idx on public.follows (follower_id);

alter table public.product_likes enable row level security;
alter table public.product_saves enable row level security;
alter table public.follows enable row level security;
revoke all on public.product_likes, public.product_saves, public.follows from anon, authenticated;
grant all on public.product_likes, public.product_saves, public.follows to service_role;

-- Voice notes: public like the photos (they play on the market),
-- only the server uploads, audio files only, 1.5 MB at most.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('voices', 'voices', true, 1572864, array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg'])
on conflict (id) do update
    set public = true,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;


-- ============================================================
-- CHECK
-- ============================================================
-- Should list 14 tables, all with rowsecurity = true, and the
-- produce bucket as public.

select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('users', 'shipments', 'bids', 'notifications', 'feedback', 'subscriptions', 'products', 'orders', 'market_alerts', 'shipment_positions', 'dispatch_offers', 'product_likes', 'product_saves', 'follows')
order by tablename;

select id, public from storage.buckets where id in ('produce', 'voices');

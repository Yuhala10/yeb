-- ============================================================
-- TAYEB MARCHÉ — FARM MARKET TABLES
-- ============================================================
-- Run once in Supabase → SQL Editor → New query → Run, in the
-- project where supabase/schema.sql already ran.
-- Safe to run again: it only creates what's missing.
--
-- Until this runs, the market pages say "opening soon" and
-- the rest of Tayeb works as before.


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
-- CHECK
-- ============================================================
-- Should show products and orders with rowsecurity = true,
-- and the produce bucket as public.

select tablename, rowsecurity
from pg_tables
where schemaname = 'public' and tablename in ('products', 'orders');

select id, public from storage.buckets where id = 'produce';

-- ============================================================
-- TAYEB ENGINE V2 — PART 1: NEW COLUMNS
-- ============================================================
-- Safe to run while the current app is live: it only adds
-- columns. Run it in Supabase → SQL Editor BEFORE deploying
-- the engine-v2 code.

-- Login with phone + PIN, locked after 5 wrong PINs.
alter table public.users add column if not exists pin_hash text;
alter table public.users add column if not exists pin_failed_attempts integer not null default 0;
alter table public.users add column if not exists pin_locked_until timestamptz;

-- The city a driver works from, used to match loads.
alter table public.users add column if not exists base_city text;

-- Ratings: average in "rating" (already exists), count here.
alter table public.users add column if not exists rating_count integer not null default 0;

-- Structured cities for matching, return loads and distances.
alter table public.shipments add column if not exists origin_city text;
alter table public.shipments add column if not exists destination_city text;

-- Proof of delivery: the receiver gives this code to the driver.
alter table public.shipments add column if not exists delivery_code text;
alter table public.shipments add column if not exists delivery_code_attempts integer not null default 0;

-- Shipper's rating of the driver for this delivery (1–5).
alter table public.shipments add column if not exists driver_rating integer;

-- Live tracking: the truck's last known position.
alter table public.shipments add column if not exists last_lat double precision;
alter table public.shipments add column if not exists last_lng double precision;
alter table public.shipments add column if not exists last_location_at timestamptz;
alter table public.shipments add column if not exists last_location_accuracy integer;

-- Phone numbers used to be saved exactly as typed
-- ("681 73 15 12", "+237681731512"). Save them all as the
-- 9-digit number the new login uses. A number is left as it
-- is if another account already has the cleaned version.
update public.users as u
set phone_number = n.clean
from (
    select
        id,
        case
            when length(digits) = 12 and digits like '237%' then substr(digits, 4)
            else digits
        end as clean
    from (
        select id, regexp_replace(coalesce(phone_number, ''), '\D', '', 'g') as digits
        from public.users
    ) as raw
) as n
where u.id = n.id
  and n.clean ~ '^[26][0-9]{8}$'
  and u.phone_number is distinct from n.clean
  and not exists (
      select 1 from public.users as other
      where other.phone_number = n.clean and other.id <> u.id
  );

-- Fast lookups for the dashboards and matching.
create index if not exists shipments_status_idx on public.shipments (status);
create index if not exists shipments_shipper_idx on public.shipments (shipper_id);
create index if not exists shipments_driver_idx on public.shipments (driver_id);
create index if not exists shipments_route_idx on public.shipments (origin_city, destination_city);
create index if not exists bids_shipment_idx on public.bids (shipment_id);
create index if not exists bids_driver_idx on public.bids (driver_id);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists users_phone_idx on public.users (phone_number);

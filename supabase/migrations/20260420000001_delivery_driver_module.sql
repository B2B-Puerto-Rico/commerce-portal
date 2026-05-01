-- =========================================================================
-- Delivery Driver Module
-- =========================================================================
-- Tables: delivery_config, delivery_zones, drivers, driver_assignments
-- Extensions to: cart_orders (delivery + tip fields)
-- =========================================================================

-- =========================================================================
-- 1. Delivery configuration per merchant
-- =========================================================================
create table delivery_config (
  mid                  text primary key references merchants(mid) on delete cascade,
  delivery_enabled     boolean not null default false,
  delivery_radius_miles numeric(5,1) not null default 10.0,
  store_latitude       numeric(10,7),
  store_longitude      numeric(10,7),
  store_address        text,
  min_order_cents      integer not null default 0,
  delivery_fee_cents   integer not null default 0,
  estimated_prep_mins  integer not null default 20,
  tipping_enabled      boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create trigger delivery_config_updated_at
  before update on delivery_config
  for each row execute function update_updated_at();

-- =========================================================================
-- 2. Delivery zones (each merchant can define multiple zones)
-- =========================================================================
create table delivery_zones (
  id          uuid primary key default gen_random_uuid(),
  mid         text not null references merchants(mid) on delete cascade,
  name        text not null,                              -- "Zone A", "Zone B", etc.
  zip_codes   text[] not null default '{}',               -- array of zip codes in this zone
  color       text not null default '#3B82F6',            -- hex color for map display
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create index idx_delivery_zones_mid on delivery_zones(mid);

-- =========================================================================
-- 3. Drivers
-- =========================================================================
create table drivers (
  id                uuid primary key default gen_random_uuid(),
  mid               text not null references merchants(mid) on delete cascade,
  full_name         text not null,
  email             text not null,
  phone             text not null,
  pay_type          text not null default 'per_delivery',  -- 'hourly' | 'per_delivery'
  pay_rate_cents    integer not null default 0,             -- rate in cents (hourly or per delivery)
  zone_ids          text[] not null default '{}',           -- assigned zone UUIDs
  status            text not null default 'pending',        -- 'pending' | 'active' | 'inactive'
  email_verified    boolean not null default false,
  verification_token text,
  avatar_url        text,
  -- Performance tracking (aggregated)
  total_deliveries  integer not null default 0,
  total_tips_cents  integer not null default 0,
  avg_delivery_mins numeric(5,1) not null default 0,
  late_count_30d    integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique(mid, email)
);

create index idx_drivers_mid on drivers(mid);
create index idx_drivers_status on drivers(mid, status);

create trigger drivers_updated_at
  before update on drivers
  for each row execute function update_updated_at();

-- =========================================================================
-- 4. Driver assignments (links orders to drivers)
-- =========================================================================
create table driver_assignments (
  id              uuid primary key default gen_random_uuid(),
  mid             text not null references merchants(mid) on delete cascade,
  order_id        uuid not null references cart_orders(id) on delete cascade,
  driver_id       uuid not null references drivers(id) on delete cascade,
  zone_id         uuid references delivery_zones(id),
  status          text not null default 'assigned',        -- 'assigned' | 'picked_up' | 'en_route' | 'delivered' | 'cancelled'
  assigned_at     timestamptz not null default now(),
  picked_up_at    timestamptz,
  delivered_at    timestamptz,
  delivery_mins   integer,                                  -- actual delivery time in minutes
  driver_notes    text,
  -- Location tracking
  last_latitude   numeric(10,7),
  last_longitude  numeric(10,7),
  last_location_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_driver_assignments_mid on driver_assignments(mid);
create index idx_driver_assignments_driver on driver_assignments(driver_id, status);
create index idx_driver_assignments_order on driver_assignments(order_id);

create trigger driver_assignments_updated_at
  before update on driver_assignments
  for each row execute function update_updated_at();

-- =========================================================================
-- 5. Extend cart_orders with delivery + tip fields
-- =========================================================================
alter table cart_orders
  add column if not exists tip_cents integer not null default 0,
  add column if not exists delivery_fee_cents integer not null default 0,
  add column if not exists delivery_address text,
  add column if not exists delivery_latitude numeric(10,7),
  add column if not exists delivery_longitude numeric(10,7),
  add column if not exists delivery_zip text,
  add column if not exists delivery_zone_id uuid references delivery_zones(id),
  add column if not exists assigned_driver_id uuid references drivers(id),
  add column if not exists delivery_status text not null default 'pending',
  add column if not exists estimated_delivery_mins integer;

-- =========================================================================
-- 6. Driver shift log (for hourly tracking)
-- =========================================================================
create table driver_shifts (
  id          uuid primary key default gen_random_uuid(),
  mid         text not null references merchants(mid) on delete cascade,
  driver_id   uuid not null references drivers(id) on delete cascade,
  clock_in    timestamptz not null default now(),
  clock_out   timestamptz,
  hours_worked numeric(5,2),
  created_at  timestamptz not null default now()
);

create index idx_driver_shifts_driver on driver_shifts(driver_id, clock_in desc);

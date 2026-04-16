-- =========================================================================
-- Migration 001: Initial Schema for B2B Commerce Platform
-- =========================================================================
-- Creates all core tables, indexes, and trigger functions.
-- RLS policies and encryption are in separate migrations.
-- =========================================================================

-- Helper: auto-update updated_at on row modification
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- =========================================================================
-- merchants: one row per connected Clover merchant
-- =========================================================================
create table merchants (
  mid                     text primary key,                -- Clover merchant UUID (13 chars)
  business_name           text not null,
  salesforce_account_id   text,                            -- link back to Salesforce
  github_repo             text,                            -- e.g. 'B2B-Puerto-Rico/acme-cafe'
  vercel_project_id       text,
  site_url                text,                            -- https://acme.b2bweb.app
  region                  text not null default 'na',      -- na | eu | latam
  environment             text not null default 'production', -- sandbox | production
  clover_access_token     text,                            -- ENCRYPTED at rest via pgsodium
  clover_refresh_token    text,                            -- ENCRYPTED
  clover_token_expires_at timestamptz,
  clover_ecommerce_pakms  text,                            -- ENCRYPTED
  clover_ecommerce_sk     text,                            -- ENCRYPTED
  webhook_verified        boolean not null default false,
  webhook_signing_secret  text,                            -- ENCRYPTED
  cart_enabled            boolean not null default false,
  cart_tier               text not null default 'free',    -- free | pro | premium
  stripe_subscription_id  text,                            -- for SaaS billing (may be Clover App Market billing instead)
  theme                   jsonb not null default '{"primaryColor": "#000000", "buttonText": "Add to Cart"}'::jsonb,
  shipping_config         jsonb,                           -- null = pickup only
  tax_config              jsonb,                           -- null = use Clover tax rates
  last_full_sync_at       timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index idx_merchants_cart_enabled on merchants(cart_enabled) where cart_enabled = true;
create index idx_merchants_sf on merchants(salesforce_account_id);

create trigger merchants_updated_at
  before update on merchants
  for each row execute function update_updated_at();

-- =========================================================================
-- products: mirror of Clover items, kept in sync
-- =========================================================================
create table products (
  mid                text references merchants(mid) on delete cascade,
  clover_item_id     text not null,
  name               text not null,
  price_cents        integer not null check (price_cents >= 0),
  price_type         text not null default 'FIXED',          -- FIXED | VARIABLE | PER_UNIT
  sku                text,
  code               text,                                   -- UPC/barcode
  description        text,
  image_url          text,                                   -- from Supabase Storage
  category_ids       text[] not null default '{}',
  modifier_group_ids text[] not null default '{}',
  tax_rate_ids       text[] not null default '{}',
  default_tax_rates  boolean not null default true,
  in_stock           boolean not null default true,
  stock_count        integer,
  hidden_online      boolean not null default false,         -- merchant-set; hides from cart
  hidden_in_clover   boolean not null default false,         -- mirrors Clover's hidden field
  display_order      integer not null default 0,
  last_synced_at     timestamptz not null default now(),
  primary key (mid, clover_item_id)
);

create index idx_products_mid_visible on products(mid)
  where hidden_online = false and hidden_in_clover = false;

-- =========================================================================
-- categories
-- =========================================================================
create table categories (
  mid                text references merchants(mid) on delete cascade,
  clover_category_id text not null,
  name               text not null,
  sort_order         integer not null default 0,
  last_synced_at     timestamptz not null default now(),
  primary key (mid, clover_category_id)
);

-- =========================================================================
-- modifier_groups
-- =========================================================================
create table modifier_groups (
  mid                  text references merchants(mid) on delete cascade,
  clover_mg_id         text not null,
  name                 text not null,
  min_required         integer not null default 0,
  max_allowed          integer not null default 1,
  show_by_default      boolean not null default false,
  sort_order           integer not null default 0,
  last_synced_at       timestamptz not null default now(),
  primary key (mid, clover_mg_id)
);

-- =========================================================================
-- modifiers
-- =========================================================================
create table modifiers (
  mid                text references merchants(mid) on delete cascade,
  clover_modifier_id text not null,
  clover_mg_id       text not null,
  name               text not null,
  price_cents        integer not null default 0,              -- price offset, can be negative
  available          boolean not null default true,
  last_synced_at     timestamptz not null default now(),
  primary key (mid, clover_modifier_id),
  foreign key (mid, clover_mg_id) references modifier_groups(mid, clover_mg_id) on delete cascade
);

-- =========================================================================
-- tax_rates
-- =========================================================================
create table tax_rates (
  mid              text references merchants(mid) on delete cascade,
  clover_tr_id     text not null,
  name             text not null,
  rate_millionths  bigint,                                    -- rate x 1,000,000 (Clover's unit)
  tax_amount_cents integer,                                   -- flat-amount alternative
  is_default       boolean not null default false,
  last_synced_at   timestamptz not null default now(),
  primary key (mid, clover_tr_id)
);

-- =========================================================================
-- cart_orders: orders placed via our cart widget
-- =========================================================================
create table cart_orders (
  id                         uuid primary key default gen_random_uuid(),
  mid                        text references merchants(mid),
  clover_order_id            text,                             -- populated after Clover creates order
  clover_checkout_session_id text,
  clover_payment_id          text,
  customer_email             text not null,
  customer_name              text,
  customer_phone             text,
  ship_to                    jsonb,                            -- address; null for pickup
  fulfillment_type           text not null default 'pickup',   -- pickup | shipping | delivery
  line_items                 jsonb not null,                   -- snapshot at checkout time
  subtotal_cents             integer not null,
  tax_cents                  integer not null default 0,
  shipping_cents             integer not null default 0,
  discount_cents             integer not null default 0,
  total_cents                integer not null,
  status                     text not null default 'pending',  -- pending | paid | failed | refunded | cancelled
  status_detail              text,                             -- decline reason, error message, etc
  hosted_checkout_url        text,
  idempotency_key            text unique not null,
  customer_ip                inet,
  customer_ua                text,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

create index idx_cart_orders_mid_status on cart_orders(mid, status, created_at desc);
create index idx_cart_orders_email on cart_orders(customer_email);

create trigger cart_orders_updated_at
  before update on cart_orders
  for each row execute function update_updated_at();

-- =========================================================================
-- sync_runs: audit log of sync operations
-- =========================================================================
create table sync_runs (
  id            uuid primary key default gen_random_uuid(),
  mid           text references merchants(mid),
  trigger       text not null,                                 -- manual | webhook | scheduled | initial
  scope         text not null,                                 -- full | incremental | single_object
  status        text not null default 'running',               -- running | success | failed | partial
  items_synced  integer not null default 0,
  errors        jsonb,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz
);

create index idx_sync_runs_mid_recent on sync_runs(mid, started_at desc);

-- =========================================================================
-- webhook_events: raw log of everything Clover/Stripe sends us
-- =========================================================================
create table webhook_events (
  id              uuid primary key default gen_random_uuid(),
  source          text not null,                               -- clover | stripe
  event_type      text,                                        -- I_UPDATE, O_CREATE, etc
  mid             text,
  object_id       text,
  raw_payload     jsonb not null,
  signature_valid boolean,
  processed       boolean not null default false,
  processed_at    timestamptz,
  error           text,
  received_at     timestamptz not null default now()
);

create index idx_webhook_events_unprocessed on webhook_events(received_at)
  where processed = false;
create index idx_webhook_events_mid_recent on webhook_events(mid, received_at desc);

-- =========================================================================
-- Storage bucket for product images
-- =========================================================================
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- =========================================================================
-- POS Wishlist: Dual Pricing + Invoices
-- =========================================================================

-- =========================================================================
-- 1. Dual pricing columns on merchants
-- =========================================================================
alter table merchants
  add column if not exists dual_pricing_enabled      boolean not null default false,
  add column if not exists card_surcharge_pct         numeric(5,2),
  add column if not exists allow_cash_on_fulfillment  boolean not null default true,
  add column if not exists dual_pricing_label         text default 'Card Service Fee';

-- Surcharge must be between 0 and 20% when dual pricing is enabled
alter table merchants
  add constraint chk_surcharge_pct
  check (
    dual_pricing_enabled = false
    or (card_surcharge_pct > 0 and card_surcharge_pct < 20)
  );

-- =========================================================================
-- 2. Payment method and dual pricing fields on cart_orders
-- =========================================================================
alter table cart_orders
  add column if not exists payment_method      text,
  add column if not exists payment_status      text,
  add column if not exists cash_total_cents    integer,
  add column if not exists card_total_cents    integer,
  add column if not exists surcharge_pct_applied numeric(5,2);

-- =========================================================================
-- 3. Invoices table
-- =========================================================================
create table if not exists invoices (
  id                   uuid primary key default gen_random_uuid(),
  mid                  text not null references merchants(mid) on delete cascade,
  order_id             uuid references cart_orders(id),
  invoice_number       text not null,
  status               text not null default 'draft',
  customer_name        text,
  customer_email       text,
  customer_phone       text,
  customer_address     jsonb,
  line_items           jsonb not null default '[]',
  subtotal_cents       integer not null default 0,
  tax_cents            integer not null default 0,
  tip_cents            integer not null default 0,
  delivery_fee_cents   integer not null default 0,
  surcharge_cents      integer not null default 0,
  surcharge_pct        numeric(5,2),
  discount_cents       integer not null default 0,
  total_cents          integer not null default 0,
  payment_method       text,
  cash_total_cents     integer,
  card_total_cents     integer,
  notes                text,
  payment_instructions text,
  due_date             date,
  paid_at              timestamptz,
  language             text not null default 'en',
  pdf_storage_path     text,
  pdf_generated_at     timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists idx_invoices_mid on invoices(mid, created_at desc);
create index if not exists idx_invoices_order on invoices(order_id);

create trigger invoices_updated_at
  before update on invoices
  for each row execute function update_updated_at();

-- =========================================================================
-- 4. Invoice number sequence
-- =========================================================================
create or replace function next_invoice_number(merchant_mid text)
returns text
language plpgsql
as $$
declare
  seq_num integer;
begin
  select coalesce(max(
    cast(regexp_replace(invoice_number, '^INV-', '') as integer)
  ), 0) + 1
  into seq_num
  from invoices
  where mid = merchant_mid;
  return 'INV-' || lpad(seq_num::text, 5, '0');
end;
$$;

-- =========================================================================
-- 5. Storage bucket for invoice PDFs
-- =========================================================================
insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', false)
on conflict (id) do nothing;

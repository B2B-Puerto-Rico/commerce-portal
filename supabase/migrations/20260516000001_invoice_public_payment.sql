-- =============================================================================
-- Public invoice payment links
-- =============================================================================
-- Adds two columns to enable customer-facing invoice payment:
--   1. invoices.public_token — opaque 36-char hex used in the URL
--      /i/{token} that customers land on after clicking the invoice email.
--   2. cart_orders.invoice_id — back-reference so when the payment processor
--      webhook fires we can flip BOTH the cart_order and the invoice it paid.
--
-- Migration is safe to run on production data:
--   - public_token is added NULLABLE, backfilled with random tokens for every
--     existing row, then made NOT NULL with a UNIQUE constraint.
--   - cart_orders.invoice_id is NULLABLE (most orders aren't invoice payments).
--   - All changes are additive; no destructive drops.
-- =============================================================================

-- 1. invoices.public_token --------------------------------------------------
alter table invoices add column if not exists public_token text;

update invoices
   set public_token = encode(gen_random_bytes(18), 'hex')
 where public_token is null;

alter table invoices alter column public_token set not null;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'invoices_public_token_key'
  ) then
    alter table invoices add constraint invoices_public_token_key unique (public_token);
  end if;
end $$;

create index if not exists invoices_public_token_idx
  on invoices (public_token);

-- 2. cart_orders.invoice_id -------------------------------------------------
alter table cart_orders
  add column if not exists invoice_id uuid references invoices(id) on delete set null;

create index if not exists cart_orders_invoice_id_idx
  on cart_orders (invoice_id)
  where invoice_id is not null;

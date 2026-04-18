-- =========================================================================
-- Migration: Valor PayTech Integration
-- =========================================================================
-- Adds Valor PayTech as a second payment processor alongside Clover.
-- Extends merchants table with Valor credentials (encrypted),
-- extends cart_orders with generic payment fields, and adds RPCs
-- for Valor credential management.
-- =========================================================================

-- =========================================================================
-- 1. Extend merchants table with Valor columns
-- =========================================================================
alter table merchants
  add column payment_provider       text not null default 'clover',
  add column valor_app_id           text,
  add column valor_app_key          text,
  add column valor_epi              text,
  add column valor_environment      text not null default 'staging',
  add column valor_checkout_mode    text not null default 'passage',
  add column valor_surcharge_enabled boolean not null default false,
  add column valor_surcharge_rate   integer not null default 0,
  add column valor_webhook_secret   text;

comment on column merchants.payment_provider is 'Active payment processor: clover | valor';
comment on column merchants.valor_app_id is 'ENCRYPTED — Valor merchant APP ID (32-char)';
comment on column merchants.valor_app_key is 'ENCRYPTED — Valor EPI-scoped APP KEY (32-char)';
comment on column merchants.valor_epi is 'ENCRYPTED — Valor device endpoint ID (10-digit, starts with 2)';
comment on column merchants.valor_environment is 'staging | production';
comment on column merchants.valor_checkout_mode is 'passage (inline iframe) | hosted_page (redirect)';
comment on column merchants.valor_surcharge_rate is 'Surcharge rate in basis points (350 = 3.5%)';
comment on column merchants.valor_webhook_secret is 'Random UUID used as secret path segment for webhook URL verification';

-- =========================================================================
-- 2. Extend cart_orders table with generic payment fields
-- =========================================================================
-- Existing clover_order_id, clover_checkout_session_id, clover_payment_id
-- columns are kept for backward compatibility with existing orders.
-- New orders use the generic columns regardless of processor.
-- =========================================================================
alter table cart_orders
  add column payment_provider text,
  add column provider_txn_id  text,
  add column provider_meta    jsonb not null default '{}',
  add column surcharge_cents  integer not null default 0;

comment on column cart_orders.payment_provider is 'Processor used for this order: clover | valor (snapshot at checkout time)';
comment on column cart_orders.provider_txn_id is 'Generic transaction ID from the payment processor';
comment on column cart_orders.provider_meta is 'Processor-specific fields needed for refunds/voids (Valor: token, ref_txn_id, rrn, auth_code)';
comment on column cart_orders.surcharge_cents is 'Surcharge amount in cents (Valor surcharge merchants only)';

-- =========================================================================
-- 3. RPC: Get Valor credentials (decrypted)
-- =========================================================================
-- Used by commerce-cart to get Valor API keys for payment processing.
-- Only works with service_role key (security definer + revoke from public).
-- =========================================================================
create or replace function get_valor_credentials(merchant_mid text)
returns table (
  mid text,
  business_name text,
  valor_environment text,
  valor_app_id text,
  valor_app_key text,
  valor_epi text,
  valor_checkout_mode text,
  valor_surcharge_enabled boolean,
  valor_surcharge_rate integer,
  valor_webhook_secret text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  select
    m.mid,
    m.business_name,
    m.valor_environment,
    public.decrypt_token(m.valor_app_id) as valor_app_id,
    public.decrypt_token(m.valor_app_key) as valor_app_key,
    public.decrypt_token(m.valor_epi) as valor_epi,
    m.valor_checkout_mode,
    m.valor_surcharge_enabled,
    m.valor_surcharge_rate,
    m.valor_webhook_secret
  from public.merchants m
  where m.mid = merchant_mid
    and m.valor_app_id is not null;
end;
$$;

revoke execute on function get_valor_credentials(text) from anon, authenticated;

comment on function get_valor_credentials(text) is
  'Returns a merchant row with Valor credentials decrypted. Service_role only.';

-- =========================================================================
-- 4. RPC: Connect a merchant to Valor (encrypts and stores credentials)
-- =========================================================================
create or replace function connect_merchant_valor(
  merchant_mid text,
  app_id text,
  app_key text,
  epi text,
  env text default 'staging',
  checkout_mode text default 'passage',
  surcharge_on boolean default false,
  surcharge_bps integer default 0,
  webhook_secret text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.merchants
  set
    payment_provider = 'valor',
    valor_app_id = public.encrypt_token(app_id),
    valor_app_key = public.encrypt_token(app_key),
    valor_epi = public.encrypt_token(epi),
    valor_environment = env,
    valor_checkout_mode = checkout_mode,
    valor_surcharge_enabled = surcharge_on,
    valor_surcharge_rate = surcharge_bps,
    valor_webhook_secret = coalesce(webhook_secret, gen_random_uuid()::text),
    updated_at = now()
  where mid = merchant_mid;
end;
$$;

revoke execute on function connect_merchant_valor(text, text, text, text, text, text, boolean, integer, text) from anon;

comment on function connect_merchant_valor is
  'Encrypts and stores Valor credentials for a merchant. Sets payment_provider to valor.';

-- =========================================================================
-- 5. RPC: Get unified payment credentials (both Clover and Valor)
-- =========================================================================
-- Used by the checkout route to get whichever credentials are needed
-- based on the merchant's payment_provider setting.
-- =========================================================================
create or replace function get_payment_credentials(merchant_mid text)
returns table (
  mid text,
  business_name text,
  region text,
  environment text,
  payment_provider text,
  -- Clover
  clover_access_token text,
  clover_refresh_token text,
  clover_token_expires_at timestamptz,
  clover_ecommerce_pakms text,
  clover_ecommerce_sk text,
  -- Valor
  valor_app_id text,
  valor_app_key text,
  valor_epi text,
  valor_environment text,
  valor_checkout_mode text,
  valor_surcharge_enabled boolean,
  valor_surcharge_rate integer,
  valor_webhook_secret text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  select
    m.mid,
    m.business_name,
    m.region,
    m.environment,
    m.payment_provider,
    -- Clover (decrypted)
    public.decrypt_token(m.clover_access_token) as clover_access_token,
    public.decrypt_token(m.clover_refresh_token) as clover_refresh_token,
    m.clover_token_expires_at,
    public.decrypt_token(m.clover_ecommerce_pakms) as clover_ecommerce_pakms,
    public.decrypt_token(m.clover_ecommerce_sk) as clover_ecommerce_sk,
    -- Valor (decrypted)
    public.decrypt_token(m.valor_app_id) as valor_app_id,
    public.decrypt_token(m.valor_app_key) as valor_app_key,
    public.decrypt_token(m.valor_epi) as valor_epi,
    m.valor_environment,
    m.valor_checkout_mode,
    m.valor_surcharge_enabled,
    m.valor_surcharge_rate,
    m.valor_webhook_secret
  from public.merchants m
  where m.mid = merchant_mid;
end;
$$;

revoke execute on function get_payment_credentials(text) from anon, authenticated;

comment on function get_payment_credentials(text) is
  'Returns a merchant row with ALL payment credentials (Clover + Valor) decrypted. Service_role only.';

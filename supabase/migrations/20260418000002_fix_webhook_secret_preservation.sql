-- =========================================================================
-- Fix: Preserve webhook secret when reconnecting Valor
-- =========================================================================
-- The original RPC always regenerated the webhook secret on every connect,
-- breaking the URL configured in Valor's portal. Now it only generates
-- a new secret if one doesn't already exist.
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
declare
  existing_secret text;
begin
  -- Preserve existing webhook secret if one already exists
  select m.valor_webhook_secret into existing_secret
  from public.merchants m
  where m.mid = merchant_mid;

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
    valor_webhook_secret = coalesce(webhook_secret, existing_secret, gen_random_uuid()::text),
    updated_at = now()
  where mid = merchant_mid;
end;
$$;

revoke execute on function connect_merchant_valor(text, text, text, text, text, text, boolean, integer, text) from anon;

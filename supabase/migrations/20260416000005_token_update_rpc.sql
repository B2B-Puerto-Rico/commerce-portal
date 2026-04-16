-- =========================================================================
-- Migration 005: RPC for updating merchant tokens after refresh
-- =========================================================================
-- Called by commerce-sync when it refreshes a Clover access token.
-- Encrypts new tokens before storing.
-- =========================================================================

create or replace function update_merchant_tokens(
  merchant_mid text,
  new_access_token text,
  new_refresh_token text,
  new_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.merchants
  set
    clover_access_token = public.encrypt_token(new_access_token),
    clover_refresh_token = public.encrypt_token(new_refresh_token),
    clover_token_expires_at = new_expires_at,
    updated_at = now()
  where mid = merchant_mid;
end;
$$;

-- Only service_role can call this
revoke execute on function update_merchant_tokens(text, text, text, timestamptz) from anon, authenticated;

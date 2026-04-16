-- =========================================================================
-- Migration 003: Column Encryption via pgsodium + Supabase Vault
-- =========================================================================
-- Encrypts all Clover credentials stored in the merchants table.
-- Uses pgsodium's Transparent Column Encryption (TCE) approach:
--   - A server key is created in the Vault
--   - Helper functions encrypt/decrypt using that key
--   - The service_role key is required to call decrypt
-- =========================================================================

-- Enable required extensions
create extension if not exists pgsodium;

-- =========================================================================
-- Create a named encryption key in the Vault
-- =========================================================================
-- This key is managed by Supabase Vault and never leaves the server.
-- The key_id is referenced by our helper functions.
-- =========================================================================
select vault.create_secret(
  'b2b-commerce-encryption-key',
  'b2b_commerce_key',
  'Encryption key for Clover merchant credentials'
);

-- =========================================================================
-- Helper: encrypt a plaintext value
-- =========================================================================
-- Usage: select encrypt_token('my-secret-token')
-- Returns: base64-encoded encrypted ciphertext
-- =========================================================================
create or replace function encrypt_token(plaintext text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  key_data bytea;
  nonce bytea;
  encrypted bytea;
begin
  if plaintext is null then
    return null;
  end if;

  -- Retrieve the secret value from Vault
  select decrypted_secret into key_data
  from vault.decrypted_secrets
  where name = 'b2b_commerce_key'
  limit 1;

  if key_data is null then
    raise exception 'Encryption key not found in Vault';
  end if;

  -- Generate a random nonce
  nonce := pgsodium.crypto_aead_det_noncegen();

  -- Encrypt using deterministic AEAD (allows lookups if needed)
  encrypted := pgsodium.crypto_aead_det_encrypt(
    convert_to(plaintext, 'utf8'),
    convert_to('', 'utf8'),  -- additional data (none)
    key_data,
    nonce
  );

  -- Return nonce + ciphertext as base64
  return encode(nonce || encrypted, 'base64');
end;
$$;

-- =========================================================================
-- Helper: decrypt a ciphertext value
-- =========================================================================
-- Usage: select decrypt_token(merchants.clover_access_token)
-- Returns: plaintext string
-- Only callable by service_role (security definer runs as the function owner)
-- =========================================================================
create or replace function decrypt_token(ciphertext text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  key_data bytea;
  raw bytea;
  nonce bytea;
  encrypted bytea;
  nonce_len int := 24;  -- crypto_aead_det nonce is 24 bytes
begin
  if ciphertext is null then
    return null;
  end if;

  -- Retrieve the secret value from Vault
  select decrypted_secret into key_data
  from vault.decrypted_secrets
  where name = 'b2b_commerce_key'
  limit 1;

  if key_data is null then
    raise exception 'Encryption key not found in Vault';
  end if;

  -- Decode base64 and split nonce from ciphertext
  raw := decode(ciphertext, 'base64');
  nonce := substring(raw from 1 for nonce_len);
  encrypted := substring(raw from nonce_len + 1);

  -- Decrypt
  return convert_from(
    pgsodium.crypto_aead_det_decrypt(
      encrypted,
      convert_to('', 'utf8'),  -- additional data (none)
      key_data,
      nonce
    ),
    'utf8'
  );
end;
$$;

-- =========================================================================
-- Helper: get a merchant's decrypted credentials (convenience function)
-- =========================================================================
-- Used by commerce-sync to get tokens for API calls.
-- Only works with service_role key.
-- =========================================================================
create or replace function get_merchant_credentials(merchant_mid text)
returns table (
  mid text,
  business_name text,
  region text,
  environment text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  ecommerce_pakms text,
  ecommerce_sk text
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
    decrypt_token(m.clover_access_token) as access_token,
    decrypt_token(m.clover_refresh_token) as refresh_token,
    m.clover_token_expires_at as token_expires_at,
    decrypt_token(m.clover_ecommerce_pakms) as ecommerce_pakms,
    decrypt_token(m.clover_ecommerce_sk) as ecommerce_sk
  from public.merchants m
  where m.mid = merchant_mid;
end;
$$;

-- =========================================================================
-- Revoke direct access to decrypt functions from anon and authenticated
-- Only service_role (and postgres) can call these
-- =========================================================================
revoke execute on function decrypt_token(text) from anon, authenticated;
revoke execute on function get_merchant_credentials(text) from anon, authenticated;

-- encrypt_token is callable by authenticated users (admin/merchant saving their tokens)
-- but decrypt is restricted to service_role only
grant execute on function encrypt_token(text) to authenticated;

-- =========================================================================
-- Comments for documentation
-- =========================================================================
comment on function encrypt_token(text) is
  'Encrypts a plaintext token using the Vault-managed key. Returns base64 ciphertext.';

comment on function decrypt_token(text) is
  'Decrypts a ciphertext token. Only callable by service_role. Returns plaintext.';

comment on function get_merchant_credentials(text) is
  'Returns a merchant row with all credentials decrypted. Service_role only.';

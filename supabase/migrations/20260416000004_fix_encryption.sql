-- =========================================================================
-- Migration 004: Fix encryption to use pgcrypto instead of raw pgsodium
-- =========================================================================
-- pgsodium's low-level functions (crypto_aead_det_*) are restricted on
-- Supabase hosted. Use pgcrypto's pgp_sym_encrypt/decrypt instead,
-- with the Vault secret as the passphrase.
-- =========================================================================

-- Replace encrypt_token: uses pgcrypto + Vault key
create or replace function encrypt_token(plaintext text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  passphrase text;
begin
  if plaintext is null then
    return null;
  end if;

  select decrypted_secret into passphrase
  from vault.decrypted_secrets
  where name = 'b2b_commerce_key'
  limit 1;

  if passphrase is null then
    raise exception 'Encryption key not found in Vault';
  end if;

  return encode(
    extensions.pgp_sym_encrypt(plaintext, passphrase),
    'base64'
  );
end;
$$;

-- Replace decrypt_token: uses pgcrypto + Vault key
create or replace function decrypt_token(ciphertext text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  passphrase text;
begin
  if ciphertext is null then
    return null;
  end if;

  select decrypted_secret into passphrase
  from vault.decrypted_secrets
  where name = 'b2b_commerce_key'
  limit 1;

  if passphrase is null then
    raise exception 'Encryption key not found in Vault';
  end if;

  return extensions.pgp_sym_decrypt(
    decode(ciphertext, 'base64'),
    passphrase
  );
end;
$$;

-- get_merchant_credentials stays the same (it calls decrypt_token)

-- Permissions stay the same
revoke execute on function decrypt_token(text) from anon, authenticated;
revoke execute on function get_merchant_credentials(text) from anon, authenticated;
grant execute on function encrypt_token(text) to authenticated;

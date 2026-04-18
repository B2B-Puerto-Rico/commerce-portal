import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = createServiceClient();
  const body = await request.json();

  const { mid, app_id, app_key, epi, environment, checkout_mode, surcharge_enabled, surcharge_rate } = body;

  if (!mid || !app_id || !app_key || !epi) {
    return NextResponse.json(
      { error: 'mid, app_id, app_key, and epi are required' },
      { status: 400 }
    );
  }

  // Use the connect_merchant_valor RPC to encrypt and store credentials
  const { error } = await supabase.rpc('connect_merchant_valor' as never, {
    merchant_mid: mid,
    app_id,
    app_key,
    epi,
    env: environment || 'staging',
    checkout_mode: checkout_mode || 'passage',
    surcharge_on: surcharge_enabled || false,
    surcharge_bps: surcharge_rate || 0,
  } as never);

  if (error) {
    // Fallback: encrypt individually and update directly
    const { data: encAppId } = await supabase.rpc('encrypt_token' as never, { plaintext: app_id } as never);
    const { data: encAppKey } = await supabase.rpc('encrypt_token' as never, { plaintext: app_key } as never);
    const { data: encEpi } = await supabase.rpc('encrypt_token' as never, { plaintext: epi } as never);

    // Preserve existing webhook secret if one exists
    const { data: existing } = await supabase
      .from('merchants')
      .select('valor_webhook_secret')
      .eq('mid', mid)
      .single();

    const { error: updateErr } = await supabase
      .from('merchants')
      .update({
        payment_provider: 'valor',
        valor_app_id: encAppId,
        valor_app_key: encAppKey,
        valor_epi: encEpi,
        valor_environment: environment || 'staging',
        valor_checkout_mode: checkout_mode || 'passage',
        valor_surcharge_enabled: surcharge_enabled || false,
        valor_surcharge_rate: surcharge_rate || 0,
        valor_webhook_secret: existing?.valor_webhook_secret || crypto.randomUUID(),
      })
      .eq('mid', mid);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }
  }

  // Fetch the webhook secret to return to the user
  const { data: merchant } = await supabase
    .from('merchants')
    .select('valor_webhook_secret')
    .eq('mid', mid)
    .single();

  // Webhook lives on the CART app, not the portal
  const cartDomain = process.env.CART_WEBHOOK_DOMAIN || 'https://commerce-cart.b2bweb.app';
  const webhookUrl = merchant?.valor_webhook_secret
    ? `${cartDomain}/api/webhook/valor/${merchant.valor_webhook_secret}`
    : null;

  return NextResponse.json({ success: true, webhook_url: webhookUrl });
}

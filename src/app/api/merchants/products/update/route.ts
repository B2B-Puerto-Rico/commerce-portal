import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = createServiceClient();
  const body = await request.json();
  const { mid, clover_item_id, name, price_cents, in_stock, hidden_online, hidden_in_clover, description, image_url_remove } = body;

  if (!mid || !clover_item_id) {
    return NextResponse.json({ error: 'mid and clover_item_id required' }, { status: 400 });
  }

  // Check tier — Pro or Premium required
  const { data: merchant } = await supabase
    .from('merchants')
    .select('cart_tier')
    .eq('mid', mid)
    .single();

  if (!merchant || merchant.cart_tier === 'free') {
    return NextResponse.json(
      { error: 'Pro or Premium tier required to edit products' },
      { status: 403 }
    );
  }

  // Get Clover credentials
  const { data: creds } = await supabase
    .rpc('get_merchant_credentials' as never, { merchant_mid: mid } as never)
    .single();

  const credentials = creds as unknown as {
    access_token: string;
    region: string;
    environment: string;
  };

  if (!credentials?.access_token) {
    return NextResponse.json({ error: 'Clover not connected' }, { status: 400 });
  }

  // Build Clover update payload (only send changed fields)
  const cloverUpdate: Record<string, unknown> = {};
  if (name !== undefined) cloverUpdate.name = name;
  if (price_cents !== undefined) cloverUpdate.price = price_cents;
  if (in_stock !== undefined) cloverUpdate.available = in_stock;
  if (hidden_in_clover !== undefined) cloverUpdate.hidden = hidden_in_clover;

  // Push to Clover API
  const baseUrl = credentials.environment === 'sandbox'
    ? 'https://apisandbox.dev.clover.com'
    : 'https://api.clover.com';

  if (Object.keys(cloverUpdate).length > 0) {
    try {
      const cloverRes = await fetch(
        `${baseUrl}/v3/merchants/${mid}/items/${clover_item_id}`,
        {
          method: 'POST', // Clover uses POST for updates
          headers: {
            Authorization: `Bearer ${credentials.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(cloverUpdate),
        }
      );

      if (!cloverRes.ok) {
        const err = await cloverRes.text();
        return NextResponse.json(
          { error: `Clover API error: ${cloverRes.status} ${err}` },
          { status: 502 }
        );
      }
    } catch (e) {
      return NextResponse.json(
        { error: `Failed to update Clover: ${e instanceof Error ? e.message : String(e)}` },
        { status: 502 }
      );
    }
  }

  // Update in Supabase
  const supabaseUpdate: Record<string, unknown> = {};
  if (name !== undefined) supabaseUpdate.name = name;
  if (price_cents !== undefined) supabaseUpdate.price_cents = price_cents;
  if (in_stock !== undefined) supabaseUpdate.in_stock = in_stock;
  if (hidden_online !== undefined) supabaseUpdate.hidden_online = hidden_online;
  if (hidden_in_clover !== undefined) supabaseUpdate.hidden_in_clover = hidden_in_clover;
  if (description !== undefined) supabaseUpdate.description = description;
  if (image_url_remove) supabaseUpdate.image_url = null;
  supabaseUpdate.last_synced_at = new Date().toISOString();

  const { error } = await supabase
    .from('products')
    .update(supabaseUpdate)
    .eq('mid', mid)
    .eq('clover_item_id', clover_item_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, synced_to_clover: Object.keys(cloverUpdate).length > 0 });
}

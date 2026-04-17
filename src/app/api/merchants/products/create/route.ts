import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = createServiceClient();
  const body = await request.json();
  const { mid, name, price_cents, description, category_id } = body;

  if (!mid || !name || price_cents === undefined) {
    return NextResponse.json({ error: 'mid, name, and price_cents required' }, { status: 400 });
  }

  // Check tier — Premium required to create items
  const { data: merchant } = await supabase
    .from('merchants')
    .select('cart_tier')
    .eq('mid', mid)
    .single();

  if (!merchant || merchant.cart_tier !== 'premium') {
    return NextResponse.json(
      { error: 'Premium tier required to create products' },
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

  const baseUrl = credentials.environment === 'sandbox'
    ? 'https://apisandbox.dev.clover.com'
    : 'https://api.clover.com';

  // Create item in Clover
  let cloverItemId: string;
  try {
    const cloverRes = await fetch(
      `${baseUrl}/v3/merchants/${mid}/items`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${credentials.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          price: price_cents,
          priceType: 'FIXED',
          available: true,
          defaultTaxRates: true,
        }),
      }
    );

    if (!cloverRes.ok) {
      const err = await cloverRes.text();
      return NextResponse.json(
        { error: `Clover API error: ${cloverRes.status} ${err}` },
        { status: 502 }
      );
    }

    const cloverItem = await cloverRes.json();
    cloverItemId = cloverItem.id;
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to create in Clover: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 }
    );
  }

  // If category specified, associate it
  if (category_id) {
    try {
      await fetch(
        `${baseUrl}/v3/merchants/${mid}/category_items`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${credentials.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            elements: [{ item: { id: cloverItemId }, category: { id: category_id } }],
          }),
        }
      );
    } catch {
      // Non-fatal — item created but category link failed
    }
  }

  // Save to Supabase
  const { error } = await supabase.from('products').insert({
    mid,
    clover_item_id: cloverItemId,
    name,
    price_cents,
    price_type: 'FIXED',
    description: description || null,
    category_ids: category_id ? [category_id] : [],
    modifier_group_ids: [],
    tax_rate_ids: [],
    default_tax_rates: true,
    in_stock: true,
    hidden_online: false,
    hidden_in_clover: false,
    display_order: 0,
    last_synced_at: new Date().toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, clover_item_id: cloverItemId });
}

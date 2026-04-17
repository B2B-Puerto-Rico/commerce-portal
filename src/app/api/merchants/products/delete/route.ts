import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = createServiceClient();
  const { mid, clover_item_id } = await request.json();

  if (!mid || !clover_item_id) {
    return NextResponse.json({ error: 'mid and clover_item_id required' }, { status: 400 });
  }

  const { data: merchant } = await supabase.from('merchants').select('cart_tier').eq('mid', mid).single();
  if (!merchant || merchant.cart_tier !== 'premium') {
    return NextResponse.json({ error: 'Premium tier required' }, { status: 403 });
  }

  const { data: creds } = await supabase.rpc('get_merchant_credentials' as never, { merchant_mid: mid } as never).single();
  const credentials = creds as unknown as { access_token: string; environment: string };
  if (!credentials?.access_token) {
    return NextResponse.json({ error: 'Clover not connected' }, { status: 400 });
  }

  const baseUrl = credentials.environment === 'sandbox' ? 'https://apisandbox.dev.clover.com' : 'https://api.clover.com';

  // Delete from Clover
  try {
    const res = await fetch(`${baseUrl}/v3/merchants/${mid}/items/${clover_item_id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${credentials.access_token}` },
    });
    if (!res.ok && res.status !== 404) {
      return NextResponse.json({ error: `Clover: ${res.status}` }, { status: 502 });
    }
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }

  // Delete from Supabase
  await supabase.from('products').delete().eq('mid', mid).eq('clover_item_id', clover_item_id);

  return NextResponse.json({ success: true });
}

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

async function getCloverConfig(supabase: ReturnType<typeof createServiceClient>, mid: string) {
  const { data: merchant } = await supabase.from('merchants').select('cart_tier').eq('mid', mid).single();
  if (!merchant || merchant.cart_tier !== 'premium') return { error: 'Premium tier required' };

  const { data: creds } = await supabase.rpc('get_merchant_credentials' as never, { merchant_mid: mid } as never).single();
  const c = creds as unknown as { access_token: string; environment: string };
  if (!c?.access_token) return { error: 'Clover not connected' };

  const baseUrl = c.environment === 'sandbox' ? 'https://apisandbox.dev.clover.com' : 'https://api.clover.com';
  return { baseUrl, token: c.access_token };
}

export async function POST(request: Request) {
  const supabase = createServiceClient();
  const body = await request.json();
  const { mid, action, clover_category_id, name, sort_order } = body;

  if (!mid || !action) {
    return NextResponse.json({ error: 'mid and action required' }, { status: 400 });
  }

  const config = await getCloverConfig(supabase, mid);
  if ('error' in config) return NextResponse.json({ error: config.error }, { status: 403 });
  const { baseUrl, token } = config;

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  if (action === 'create') {
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

    // Create in Clover
    const res = await fetch(`${baseUrl}/v3/merchants/${mid}/categories`, {
      method: 'POST', headers, body: JSON.stringify({ name, sortOrder: sort_order || 0 }),
    });
    if (!res.ok) return NextResponse.json({ error: `Clover: ${res.status} ${await res.text()}` }, { status: 502 });
    const cloverCat = await res.json();

    // Save to Supabase
    await supabase.from('categories').insert({
      mid, clover_category_id: cloverCat.id, name, sort_order: sort_order || 0,
      last_synced_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, clover_category_id: cloverCat.id });
  }

  if (action === 'update') {
    if (!clover_category_id || !name) return NextResponse.json({ error: 'clover_category_id and name required' }, { status: 400 });

    await fetch(`${baseUrl}/v3/merchants/${mid}/categories/${clover_category_id}`, {
      method: 'POST', headers, body: JSON.stringify({ name, sortOrder: sort_order }),
    });

    await supabase.from('categories').update({ name, sort_order: sort_order || 0, last_synced_at: new Date().toISOString() })
      .eq('mid', mid).eq('clover_category_id', clover_category_id);

    return NextResponse.json({ success: true });
  }

  if (action === 'delete') {
    if (!clover_category_id) return NextResponse.json({ error: 'clover_category_id required' }, { status: 400 });

    await fetch(`${baseUrl}/v3/merchants/${mid}/categories/${clover_category_id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
    });

    await supabase.from('categories').delete().eq('mid', mid).eq('clover_category_id', clover_category_id);

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

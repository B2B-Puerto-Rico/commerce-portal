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
  const { mid, action, resource } = body;

  if (!mid || !action || !resource) {
    return NextResponse.json({ error: 'mid, action, and resource required' }, { status: 400 });
  }

  const config = await getCloverConfig(supabase, mid);
  if ('error' in config) return NextResponse.json({ error: config.error }, { status: 403 });
  const { baseUrl, token } = config;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // ============================
  // MODIFIER GROUP operations
  // ============================
  if (resource === 'group') {
    const { clover_mg_id, name, min_required, max_allowed } = body;

    if (action === 'create') {
      if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
      const res = await fetch(`${baseUrl}/v3/merchants/${mid}/modifier_groups`, {
        method: 'POST', headers,
        body: JSON.stringify({ name, minRequired: min_required || 0, maxAllowed: max_allowed || 1 }),
      });
      if (!res.ok) return NextResponse.json({ error: `Clover: ${res.status} ${await res.text()}` }, { status: 502 });
      const data = await res.json();

      await supabase.from('modifier_groups').insert({
        mid, clover_mg_id: data.id, name,
        min_required: min_required || 0, max_allowed: max_allowed || 1,
        sort_order: 0, last_synced_at: new Date().toISOString(),
      });
      return NextResponse.json({ success: true, clover_mg_id: data.id });
    }

    if (action === 'update') {
      if (!clover_mg_id) return NextResponse.json({ error: 'clover_mg_id required' }, { status: 400 });
      const payload: Record<string, unknown> = {};
      if (name !== undefined) payload.name = name;
      if (min_required !== undefined) payload.minRequired = min_required;
      if (max_allowed !== undefined) payload.maxAllowed = max_allowed;

      await fetch(`${baseUrl}/v3/merchants/${mid}/modifier_groups/${clover_mg_id}`, {
        method: 'POST', headers, body: JSON.stringify(payload),
      });

      const update: Record<string, unknown> = { last_synced_at: new Date().toISOString() };
      if (name !== undefined) update.name = name;
      if (min_required !== undefined) update.min_required = min_required;
      if (max_allowed !== undefined) update.max_allowed = max_allowed;
      await supabase.from('modifier_groups').update(update).eq('mid', mid).eq('clover_mg_id', clover_mg_id);
      return NextResponse.json({ success: true });
    }

    if (action === 'delete') {
      if (!clover_mg_id) return NextResponse.json({ error: 'clover_mg_id required' }, { status: 400 });
      await fetch(`${baseUrl}/v3/merchants/${mid}/modifier_groups/${clover_mg_id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      });
      await supabase.from('modifier_groups').delete().eq('mid', mid).eq('clover_mg_id', clover_mg_id);
      return NextResponse.json({ success: true });
    }
  }

  // ============================
  // MODIFIER operations
  // ============================
  if (resource === 'modifier') {
    const { clover_mg_id, clover_modifier_id, name, price_cents } = body;

    if (action === 'create') {
      if (!clover_mg_id || !name) return NextResponse.json({ error: 'clover_mg_id and name required' }, { status: 400 });
      const res = await fetch(`${baseUrl}/v3/merchants/${mid}/modifier_groups/${clover_mg_id}/modifiers`, {
        method: 'POST', headers,
        body: JSON.stringify({ name, price: price_cents || 0 }),
      });
      if (!res.ok) return NextResponse.json({ error: `Clover: ${res.status} ${await res.text()}` }, { status: 502 });
      const data = await res.json();

      await supabase.from('modifiers').insert({
        mid, clover_modifier_id: data.id, clover_mg_id, name,
        price_cents: price_cents || 0, available: true,
        last_synced_at: new Date().toISOString(),
      });
      return NextResponse.json({ success: true, clover_modifier_id: data.id });
    }

    if (action === 'update') {
      if (!clover_mg_id || !clover_modifier_id) return NextResponse.json({ error: 'IDs required' }, { status: 400 });
      const payload: Record<string, unknown> = {};
      if (name !== undefined) payload.name = name;
      if (price_cents !== undefined) payload.price = price_cents;

      await fetch(`${baseUrl}/v3/merchants/${mid}/modifier_groups/${clover_mg_id}/modifiers/${clover_modifier_id}`, {
        method: 'POST', headers, body: JSON.stringify(payload),
      });

      const update: Record<string, unknown> = { last_synced_at: new Date().toISOString() };
      if (name !== undefined) update.name = name;
      if (price_cents !== undefined) update.price_cents = price_cents;
      await supabase.from('modifiers').update(update).eq('mid', mid).eq('clover_modifier_id', clover_modifier_id);
      return NextResponse.json({ success: true });
    }

    if (action === 'delete') {
      if (!clover_mg_id || !clover_modifier_id) return NextResponse.json({ error: 'IDs required' }, { status: 400 });
      await fetch(`${baseUrl}/v3/merchants/${mid}/modifier_groups/${clover_mg_id}/modifiers/${clover_modifier_id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      });
      await supabase.from('modifiers').delete().eq('mid', mid).eq('clover_modifier_id', clover_modifier_id);
      return NextResponse.json({ success: true });
    }
  }

  return NextResponse.json({ error: 'Invalid action or resource' }, { status: 400 });
}

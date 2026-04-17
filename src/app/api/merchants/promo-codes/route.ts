import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = createServiceClient();
  const body = await request.json();
  const { mid, action } = body;

  if (!mid || !action) {
    return NextResponse.json({ error: 'mid and action required' }, { status: 400 });
  }

  if (action === 'create') {
    const { code, discount_type, discount_value, min_order_cents, max_uses, expires_at } = body;
    if (!code || !discount_value) {
      return NextResponse.json({ error: 'code and discount_value required' }, { status: 400 });
    }

    const { data, error } = await supabase.from('promo_codes').insert({
      mid,
      code: code.toUpperCase().trim(),
      discount_type: discount_type || 'percentage',
      discount_value,
      min_order_cents: min_order_cents || 0,
      max_uses: max_uses || null,
      expires_at: expires_at || null,
    }).select().single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true, promo: data });
  }

  if (action === 'list') {
    const { data } = await supabase
      .from('promo_codes')
      .select('*')
      .eq('mid', mid)
      .order('created_at', { ascending: false });
    return NextResponse.json({ promos: data || [] });
  }

  if (action === 'toggle') {
    const { id, active } = body;
    await supabase.from('promo_codes').update({ active }).eq('id', id);
    return NextResponse.json({ success: true });
  }

  if (action === 'delete') {
    const { id } = body;
    await supabase.from('promo_codes').delete().eq('id', id);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

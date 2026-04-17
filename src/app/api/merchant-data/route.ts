import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mid = searchParams.get('mid');

  if (!mid) {
    return NextResponse.json({ error: 'mid required' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data } = await supabase
    .from('merchants')
    .select('mid, business_name, cart_enabled, cart_tier, theme, site_url')
    .eq('mid', mid)
    .single();

  if (!data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}

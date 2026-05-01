import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// GET: Fetch delivery config for a merchant
export async function GET(request: Request) {
  const supabase = createServiceClient();
  const { searchParams } = new URL(request.url);
  const mid = searchParams.get('mid');

  if (!mid) return NextResponse.json({ error: 'mid required' }, { status: 400 });

  const { data } = await supabase
    .from('delivery_config')
    .select('*')
    .eq('mid', mid)
    .single();

  return NextResponse.json(data || { mid, delivery_enabled: false, delivery_radius_miles: 10, tipping_enabled: true });
}

// POST: Create or update delivery config
export async function POST(request: Request) {
  const supabase = createServiceClient();
  const body = await request.json();
  const { mid, ...config } = body;

  if (!mid) return NextResponse.json({ error: 'mid required' }, { status: 400 });

  const { error } = await supabase
    .from('delivery_config')
    .upsert({ mid, ...config }, { onConflict: 'mid' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

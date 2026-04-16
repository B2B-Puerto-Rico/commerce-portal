import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = createServiceClient();
  const { mid } = await request.json();

  if (!mid) {
    return NextResponse.json({ error: 'mid is required' }, { status: 400 });
  }

  // Cascade delete handles products, categories, modifiers, orders, sync_runs
  const { error } = await supabase.from('merchants').delete().eq('mid', mid);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

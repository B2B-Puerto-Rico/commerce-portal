import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = createServiceClient();
  const { mid, cart_enabled } = await request.json();

  if (!mid || typeof cart_enabled !== 'boolean') {
    return NextResponse.json(
      { error: 'mid and cart_enabled (boolean) are required' },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from('merchants')
    .update({ cart_enabled })
    .eq('mid', mid);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, cart_enabled });
}

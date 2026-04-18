import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = createServiceClient();
  const { mid, payment_provider } = await request.json();

  if (!mid || !['clover', 'valor'].includes(payment_provider)) {
    return NextResponse.json(
      { error: 'mid and payment_provider (clover | valor) are required' },
      { status: 400 }
    );
  }

  // Verify the merchant actually has credentials for the target provider
  const { data: merchant } = await supabase
    .from('merchants')
    .select('clover_access_token, valor_app_id')
    .eq('mid', mid)
    .single();

  if (!merchant) {
    return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
  }

  if (payment_provider === 'clover' && !merchant.clover_access_token) {
    return NextResponse.json(
      { error: 'Clover is not connected. Connect Clover first before switching.' },
      { status: 400 }
    );
  }

  if (payment_provider === 'valor' && !merchant.valor_app_id) {
    return NextResponse.json(
      { error: 'Valor is not connected. Connect Valor first before switching.' },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from('merchants')
    .update({ payment_provider })
    .eq('mid', mid);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, payment_provider });
}

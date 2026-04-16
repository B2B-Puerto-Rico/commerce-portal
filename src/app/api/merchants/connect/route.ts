import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = createServiceClient();
  const body = await request.json();

  const { mid, access_token, ecommerce_sk, ecommerce_pakms } = body;

  if (!mid || !access_token) {
    return NextResponse.json(
      { error: 'mid and access_token are required' },
      { status: 400 }
    );
  }

  // Encrypt tokens via the encrypt_token RPC and update the merchant row
  const { error } = await supabase.rpc('connect_merchant_clover' as never, {
    merchant_mid: mid,
    token: access_token,
    sk: ecommerce_sk || null,
    pakms: ecommerce_pakms || null,
  } as never);

  if (error) {
    // Fallback: if RPC doesn't exist yet, update directly with encrypt_token
    const updates: Record<string, unknown> = {};

    // Encrypt access token
    const { data: encToken } = await supabase.rpc('encrypt_token' as never, { plaintext: access_token } as never);
    updates.clover_access_token = encToken;

    if (ecommerce_sk) {
      const { data: encSk } = await supabase.rpc('encrypt_token' as never, { plaintext: ecommerce_sk } as never);
      updates.clover_ecommerce_sk = encSk;
    }

    if (ecommerce_pakms) {
      const { data: encPk } = await supabase.rpc('encrypt_token' as never, { plaintext: ecommerce_pakms } as never);
      updates.clover_ecommerce_pakms = encPk;
    }

    const { error: updateErr } = await supabase
      .from('merchants')
      .update(updates)
      .eq('mid', mid);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}

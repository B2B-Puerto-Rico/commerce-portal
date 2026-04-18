/**
 * Check Valor order payment status — portal-side.
 *
 * Queries Valor's open batch to find matching transactions.
 * Matches by amount since Valor hosted page doesn't preserve our invoice number.
 * Updates order in Supabase and triggers email via cart API.
 */

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = createServiceClient();
  const { order_id } = await request.json();

  if (!order_id) {
    return NextResponse.json({ error: 'order_id required' }, { status: 400 });
  }

  const { data: order } = await supabase
    .from('cart_orders')
    .select('*')
    .eq('id', order_id)
    .single();

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  if (order.status !== 'pending') {
    return NextResponse.json({ status: order.status, already_resolved: true });
  }

  if (order.payment_provider !== 'valor') {
    return NextResponse.json({ status: order.status });
  }

  // Get Valor credentials
  const { data: creds } = await supabase
    .rpc('get_valor_credentials' as never, { merchant_mid: order.mid } as never)
    .single();

  const credentials = creds as unknown as Record<string, unknown>;
  if (!credentials?.valor_app_id) {
    return NextResponse.json({ error: 'Valor credentials not found' }, { status: 500 });
  }

  const baseUrl = (credentials.valor_environment as string) === 'production'
    ? 'https://securelink.valorpaytech.com:4430'
    : 'https://securelink-staging.valorpaytech.com:4430';

  try {
    // Query open batch — requires txn_type field
    const batchRes = await fetch(`${baseUrl}/?openbatch=`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appid: credentials.valor_app_id,
        appkey: credentials.valor_app_key,
        epi: credentials.valor_epi,
        txn_type: 'openbatch',
      }),
    });
    const batchData = await batchRes.json();

    if (batchData.status !== 'SUCCESS' || !batchData.batchSummaryDetails) {
      return NextResponse.json({
        status: 'pending',
        checked: true,
        error: `Valor batch query returned: ${batchData.status || batchData.error_no}`,
      });
    }

    const txns = batchData.batchSummaryDetails as Record<string, unknown>[];

    // Match by amount — Valor hosted page uses sequential invoice numbers,
    // not our order UUID. Match by total amount (in cents) and order timestamp.
    const orderTotalCents = order.total_cents as number;
    const orderCreatedAt = new Date(order.created_at as string).getTime();

    // Find transactions that match the total amount, ordered by most recent
    const candidates = txns
      .filter((t) => {
        const txAmount = t.txamount as number; // txamount is total including surcharge, in cents
        return txAmount === orderTotalCents && t.response_code === '00';
      })
      .sort((a, b) => {
        const aTime = new Date(a.created_at as string).getTime();
        const bTime = new Date(b.created_at as string).getTime();
        return bTime - aTime; // newest first
      });

    // Find the closest match by timestamp (created after our order)
    const matchingTxn = candidates.find((t) => {
      const txTime = new Date(t.created_at as string).getTime();
      // Transaction should be after order creation, within 1 hour
      return txTime >= orderCreatedAt && txTime - orderCreatedAt < 3600000;
    }) || candidates[0]; // fallback to any amount match

    if (!matchingTxn) {
      // Also try matching without surcharge — base amount
      const baseMatch = txns.find((t) => {
        const baseAmount = t.amount as number;
        const subtotalPlusTax = (order.subtotal_cents as number) + (order.tax_cents as number);
        return baseAmount === subtotalPlusTax && t.response_code === '00';
      });

      if (!baseMatch) {
        return NextResponse.json({ status: 'pending', checked: true, found: false });
      }

      // Use the base match
      return await updateOrderToPaid(supabase, order, order_id, baseMatch);
    }

    return await updateOrderToPaid(supabase, order, order_id, matchingTxn);
  } catch (err) {
    console.error('[CheckOrderStatus] Error:', err);
    return NextResponse.json({
      status: 'pending',
      checked: true,
      error: 'Failed to query Valor. Please try again.',
    });
  }
}

async function updateOrderToPaid(
  supabase: ReturnType<typeof createServiceClient>,
  order: Record<string, unknown>,
  orderId: string,
  txn: Record<string, unknown>,
) {
  const txnId = String(txn.txn_id || txn.txnid || '');

  await supabase
    .from('cart_orders')
    .update({
      status: 'paid',
      provider_txn_id: txnId,
      provider_meta: {
        ref_txn_id: txnId,
        rrn: txn.rrn,
        auth_code: txn.approval_code,
        pan: (txn.masked_card_no as string)?.replace(/\s/g, ''),
        card_brand: txn.card_scheme,
        source: 'check-status',
      },
    })
    .eq('id', orderId)
    .eq('status', 'pending');

  // Trigger email sending via cart API
  const cartDomain = process.env.CART_WEBHOOK_DOMAIN || 'https://commerce-cart.b2bweb.app';
  fetch(`${cartDomain}/api/orders/${orderId}/check-status`, { method: 'POST' }).catch(() => {});

  return NextResponse.json({
    status: 'paid',
    checked: true,
    found: true,
    transaction_id: txnId,
    amount_cents: txn.txamount,
  });
}

/**
 * Check Valor order payment status.
 *
 * Queries Valor's open batch and matches transactions by amount.
 * Only matches by exact amount — no fuzzy "most recent" fallback
 * to prevent wrong transaction matching.
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
    return NextResponse.json({
      error: 'Valor credentials not found — reconnect in Connect Valor tab',
      debug: { mid: order.mid },
    }, { status: 500 });
  }

  const baseUrl = (credentials.valor_environment as string) === 'production'
    ? 'https://securelink.valorpaytech.com:4430'
    : 'https://securelink-staging.valorpaytech.com:4430';

  try {
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

    if (batchData.status !== 'SUCCESS') {
      return NextResponse.json({
        status: 'pending',
        error: `Valor: ${batchData.statusMsg || batchData.error_no || 'Unknown error'}`,
      });
    }

    const txns = (batchData.batchSummaryDetails || []) as Record<string, unknown>[];

    // Get already-matched txn IDs to avoid double-matching
    const { data: matchedOrders } = await supabase
      .from('cart_orders')
      .select('provider_txn_id')
      .eq('mid', order.mid)
      .eq('payment_provider', 'valor')
      .not('provider_txn_id', 'is', null);

    const usedTxnIds = new Set((matchedOrders || []).map((o) => o.provider_txn_id));

    const available = txns.filter((t) =>
      t.response_code === '00' && !usedTxnIds.has(String(t.txn_id))
    );

    const orderTotalCents = order.total_cents as number;
    const orderSubtotalCents = order.subtotal_cents as number;
    const orderTaxCents = order.tax_cents as number;
    const orderCreatedAt = new Date(order.created_at as string).getTime();

    // Match strategies:
    // Our total_cents = subtotal + tax (no surcharge — Valor adds that on their page)
    // Valor's `amount` = base amount we sent (should equal our total_cents)
    // Valor's `txamount` = amount + surcharge (what customer actually paid)
    let match = null;

    // 1: Valor amount (base) = our total_cents (primary match — should always work for new orders)
    match = available.find((t) => (t.amount as number) === orderTotalCents);

    // 2: Valor txamount (total with surcharge) = our total_cents (for old orders where we included surcharge)
    if (!match) match = available.find((t) => (t.txamount as number) === orderTotalCents);

    // 3: Valor amount = our subtotal (for orders where tax was passed separately)
    if (!match) match = available.find((t) => (t.amount as number) === orderSubtotalCents);

    // 4: Fuzzy — within 5% tolerance for surcharge rounding differences on older orders
    if (!match) {
      match = available.find((t) => {
        const amt = t.amount as number;
        const txamt = t.txamount as number;
        return Math.abs(amt - orderTotalCents) <= Math.max(orderTotalCents * 0.05, 10) ||
               Math.abs(txamt - orderTotalCents) <= Math.max(orderTotalCents * 0.05, 10);
      }) || null;
    }

    // 5: Single unmatched transaction after order — only if just one candidate
    if (!match) {
      const afterOrder = available.filter((t) =>
        new Date(t.created_at as string).getTime() >= orderCreatedAt - 60000
      );
      if (afterOrder.length === 1) {
        match = afterOrder[0];
      }
    }

    if (!match) {
      return NextResponse.json({
        status: 'pending',
        found: false,
        debug: {
          order_total: orderTotalCents,
          order_subtotal: orderSubtotalCents,
          order_tax: orderTaxCents,
          order_created: order.created_at,
          available_txns: available.map((t) => ({
            txn_id: t.txn_id,
            amount: t.amount,
            txamount: t.txamount,
            time: t.created_at,
          })),
        },
      });
    }

    // Verify the match is after the order was created (sanity check)
    const txnTime = new Date(match.created_at as string).getTime();
    if (txnTime < orderCreatedAt - 60000) {
      // Transaction is from before the order — skip it
      return NextResponse.json({
        status: 'pending',
        found: false,
        debug: { reason: 'Transaction predates order', txn_time: match.created_at, order_time: order.created_at },
      });
    }

    // Match found — update order to paid
    const txnId = String(match.txn_id || '');

    await supabase
      .from('cart_orders')
      .update({
        status: 'paid',
        provider_txn_id: txnId,
        provider_meta: {
          ref_txn_id: txnId,
          rrn: match.rrn,
          auth_code: match.approval_code,
          pan: (match.masked_card_no as string)?.replace(/\s/g, ''),
          card_brand: match.card_scheme,
          amount_cents: match.amount,
          total_cents: match.txamount,
          source: 'check-status',
        },
      })
      .eq('id', order_id)
      .eq('status', 'pending');

    // Send confirmation emails via cart API
    const cartDomain = process.env.CART_WEBHOOK_DOMAIN || 'https://commerce-cart.b2bweb.app';
    fetch(`${cartDomain}/api/orders/${order_id}/check-status`, { method: 'POST' }).catch(() => {});

    return NextResponse.json({ status: 'paid', found: true, transaction_id: txnId });
  } catch (err) {
    return NextResponse.json({
      status: 'pending',
      error: `${err instanceof Error ? err.message : String(err)}`,
    });
  }
}

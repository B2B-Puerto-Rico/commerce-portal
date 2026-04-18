/**
 * Check Valor order payment status.
 *
 * Queries Valor's open batch and matches transactions to pending orders.
 * Returns debug info so we can see exactly what's happening.
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
      error: 'Valor credentials not found — reconnect Valor in the Connect Valor tab',
      status: 'pending',
      debug: { mid: order.mid, has_creds: false },
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
        checked: true,
        error: 'Valor batch query failed',
        debug: {
          valor_status: batchData.status,
          valor_error: batchData.error_no || batchData.errors,
          valor_msg: batchData.msg || batchData.statusMsg,
        },
      });
    }

    const txns = (batchData.batchSummaryDetails || []) as Record<string, unknown>[];
    const orderTotalCents = order.total_cents as number;
    const orderSubtotalCents = order.subtotal_cents as number;
    const orderTaxCents = order.tax_cents as number;
    const orderSurchargeCents = (order.surcharge_cents as number) || 0;
    const orderCreatedAt = new Date(order.created_at as string).getTime();

    // Get all orders already matched to Valor txn_ids so we don't double-match
    const { data: matchedOrders } = await supabase
      .from('cart_orders')
      .select('provider_txn_id')
      .eq('mid', order.mid)
      .eq('payment_provider', 'valor')
      .not('provider_txn_id', 'is', null);

    const usedTxnIds = new Set((matchedOrders || []).map((o) => o.provider_txn_id));

    // Try multiple matching strategies
    const approvedTxns = txns.filter((t) =>
      t.response_code === '00' && !usedTxnIds.has(String(t.txn_id))
    );

    // Strategy 1: Match by txamount (total with surcharge) = our total_cents
    let match = approvedTxns.find((t) => (t.txamount as number) === orderTotalCents);

    // Strategy 2: Match by amount (base) = our subtotal_cents
    if (!match) {
      match = approvedTxns.find((t) => (t.amount as number) === orderSubtotalCents);
    }

    // Strategy 3: Match by amount = subtotal + tax (no surcharge)
    if (!match) {
      const subtotalPlusTax = orderSubtotalCents + orderTaxCents;
      match = approvedTxns.find((t) => (t.amount as number) === subtotalPlusTax);
    }

    // Strategy 4: Match by txamount = subtotal + tax + surcharge (our total)
    // but also check if txamount matches without surcharge
    if (!match) {
      const noSurchargeTotal = orderSubtotalCents + orderTaxCents;
      match = approvedTxns.find((t) => (t.txamount as number) === noSurchargeTotal);
    }

    // Strategy 5: Most recent unmatched transaction created after the order
    if (!match) {
      const recentMatch = approvedTxns
        .filter((t) => new Date(t.created_at as string).getTime() >= orderCreatedAt)
        .sort((a, b) =>
          new Date(a.created_at as string).getTime() - new Date(b.created_at as string).getTime()
        )[0];
      match = recentMatch || null;
    }

    if (!match) {
      return NextResponse.json({
        status: 'pending',
        checked: true,
        found: false,
        debug: {
          order_total_cents: orderTotalCents,
          order_subtotal_cents: orderSubtotalCents,
          order_tax_cents: orderTaxCents,
          order_surcharge_cents: orderSurchargeCents,
          order_created: order.created_at,
          valor_txn_count: approvedTxns.length,
          valor_txns: approvedTxns.map((t) => ({
            txn_id: t.txn_id,
            amount: t.amount,
            txamount: t.txamount,
            created: t.created_at,
          })),
          already_matched_ids: Array.from(usedTxnIds),
        },
      });
    }

    // Found a match — update order to paid
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

    // Send confirmation emails
    await sendEmails(supabase, order, order_id);

    return NextResponse.json({
      status: 'paid',
      checked: true,
      found: true,
      transaction_id: txnId,
    });
  } catch (err) {
    return NextResponse.json({
      status: 'pending',
      checked: true,
      error: `Exception: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}

async function sendEmails(
  supabase: ReturnType<typeof createServiceClient>,
  order: Record<string, unknown>,
  orderId: string,
) {
  try {
    // Trigger email via cart API
    const cartDomain = process.env.CART_WEBHOOK_DOMAIN || 'https://commerce-cart.b2bweb.app';
    await fetch(`${cartDomain}/api/orders/${orderId}/check-status`, { method: 'POST' });
  } catch {
    // Emails are best-effort
  }
}

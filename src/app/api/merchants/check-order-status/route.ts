/**
 * Check Valor order payment status.
 *
 * Two modes:
 * - Single order: POST { order_id } — checks one order
 * - Bulk check: POST { order_id, bulk: true } — checks ALL pending orders for the merchant
 *
 * CRITICAL: Uses bulk matching to prevent transaction stealing.
 * All pending orders are matched simultaneously by timestamp proximity,
 * ensuring each transaction maps to exactly one order.
 */

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = createServiceClient();
  const body = await request.json();
  const { order_id } = body;

  if (!order_id) {
    return NextResponse.json({ error: 'order_id required' }, { status: 400 });
  }

  // Load the target order to get merchant ID
  const { data: targetOrder } = await supabase
    .from('cart_orders')
    .select('*')
    .eq('id', order_id)
    .single();

  if (!targetOrder) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  if (targetOrder.status !== 'pending') return NextResponse.json({ status: targetOrder.status, already_resolved: true });
  if (targetOrder.payment_provider !== 'valor') return NextResponse.json({ status: targetOrder.status });

  const mid = targetOrder.mid;

  // Get Valor credentials
  const { data: creds } = await supabase
    .rpc('get_valor_credentials' as never, { merchant_mid: mid } as never)
    .single();
  const credentials = creds as unknown as Record<string, unknown>;
  if (!credentials?.valor_app_id) {
    return NextResponse.json({ error: 'Valor credentials not found' }, { status: 500 });
  }

  const baseUrl = (credentials.valor_environment as string) === 'production'
    ? 'https://securelink.valorpaytech.com:4430'
    : 'https://securelink-staging.valorpaytech.com:4430';

  // =========================================================================
  // STEP 1: Get ALL pending Valor orders for this merchant (not just the target)
  // =========================================================================
  // Only consider orders from the last 24 hours — stale orders get auto-cancelled
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: allPendingOrders } = await supabase
    .from('cart_orders')
    .select('id, total_cents, subtotal_cents, tax_cents, tip_cents, created_at, provider_txn_id')
    .eq('mid', mid)
    .eq('payment_provider', 'valor')
    .eq('status', 'pending')
    .gte('created_at', twentyFourHoursAgo)
    .order('created_at', { ascending: true });

  const pendingOrders = allPendingOrders || [];

  // Auto-cancel orders older than 24 hours (abandoned checkouts)
  await supabase
    .from('cart_orders')
    .update({ status: 'cancelled', status_detail: 'Auto-cancelled: unpaid after 24 hours' })
    .eq('mid', mid)
    .eq('payment_provider', 'valor')
    .eq('status', 'pending')
    .lt('created_at', twentyFourHoursAgo);

  // =========================================================================
  // STEP 2: Get ALL Valor transactions from the batch
  // =========================================================================
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
      return NextResponse.json({ status: 'pending', error: 'Valor batch query failed' });
    }

    const txns = (batchData.batchSummaryDetails || []) as Record<string, unknown>[];

    // Get already-matched txn IDs
    const { data: matchedOrders } = await supabase
      .from('cart_orders')
      .select('provider_txn_id')
      .eq('mid', mid)
      .eq('payment_provider', 'valor')
      .not('provider_txn_id', 'is', null);

    const usedTxnIds = new Set((matchedOrders || []).map((o) => o.provider_txn_id));

    // Available approved transactions, sorted by time ascending
    const available = txns
      .filter((t) => t.response_code === '00' && !usedTxnIds.has(String(t.txn_id)))
      .sort((a, b) => new Date(a.created_at as string).getTime() - new Date(b.created_at as string).getTime());

    // =========================================================================
    // STEP 3: BULK MATCH — pair each pending order with its best transaction
    // =========================================================================
    // Strategy: for each pending order (sorted by time), find the best matching
    // transaction that:
    //   1. Was created AFTER the order (within 30 min window)
    //   2. Has a matching amount (exact or fuzzy)
    // Once a transaction is matched, remove it from the pool.

    const matchedTxnIds = new Set<string>();
    const results = new Map<string, { txn: Record<string, unknown> }>();

    for (const order of pendingOrders) {
      const orderTime = new Date(order.created_at).getTime();
      const orderTotal = order.total_cents;
      const orderSubtotal = order.subtotal_cents;

      // Find candidates: created after order, within 30 min, not already matched
      const candidates = available.filter((t) => {
        const txnId = String(t.txn_id);
        if (matchedTxnIds.has(txnId)) return false;

        const txnTime = new Date(t.created_at as string).getTime();
        const timeDiff = txnTime - orderTime;
        // Transaction should be after order creation, within 30 minutes
        if (timeDiff < -60000 || timeDiff > 1800000) return false;

        return true;
      });

      // Try exact amount match first, then fuzzy
      let best = candidates.find((t) => (t.amount as number) === orderTotal);
      if (!best) best = candidates.find((t) => (t.txamount as number) === orderTotal);
      if (!best) best = candidates.find((t) => (t.amount as number) === orderSubtotal);
      if (!best) best = candidates.find((t) => {
        const amt = t.amount as number;
        const txamt = t.txamount as number;
        return Math.abs(amt - orderTotal) <= Math.max(orderTotal * 0.05, 15) ||
               Math.abs(txamt - orderTotal) <= Math.max(orderTotal * 0.05, 15);
      });
      // Last resort: closest transaction in time window (only if just one candidate)
      if (!best && candidates.length === 1) best = candidates[0];

      if (best) {
        matchedTxnIds.add(String(best.txn_id));
        results.set(order.id, { txn: best });
      }
    }

    // =========================================================================
    // STEP 4: Apply matches — update all matched orders
    // =========================================================================
    let targetMatched = false;

    for (const [orderId, { txn }] of Array.from(results.entries())) {
      const txnId = String(txn.txn_id || '');

      await supabase.from('cart_orders').update({
        status: 'paid',
        provider_txn_id: txnId,
        provider_meta: {
          ref_txn_id: txnId,
          rrn: txn.rrn,
          auth_code: txn.approval_code,
          pan: (txn.masked_card_no as string)?.replace(/\s/g, ''),
          card_brand: txn.card_scheme,
          source: 'bulk-check',
        },
      }).eq('id', orderId).eq('status', 'pending');

      if (orderId === order_id) targetMatched = true;

      // Send email via cart API (best effort)
      const cartDomain = process.env.CART_WEBHOOK_DOMAIN || 'https://commerce-cart.b2bweb.app';
      fetch(`${cartDomain}/api/orders/${orderId}/check-status`, { method: 'POST' }).catch(() => {});
    }

    // Return status for the target order
    if (targetMatched) {
      const matchedTxn = results.get(order_id);
      return NextResponse.json({
        status: 'paid',
        found: true,
        transaction_id: String(matchedTxn?.txn.txn_id || ''),
        total_matched: results.size,
      });
    }

    return NextResponse.json({
      status: 'pending',
      found: false,
      total_matched: results.size,
      debug: {
        pending_orders: pendingOrders.length,
        available_txns: available.length,
        matched: results.size,
        target_total: targetOrder.total_cents,
        target_created: targetOrder.created_at,
      },
    });
  } catch (err) {
    return NextResponse.json({
      status: 'pending',
      error: `${err instanceof Error ? err.message : String(err)}`,
    });
  }
}

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { langFromCompany } from '@/lib/invoice-i18n';

/** GET: List invoices for a merchant */
export async function GET(request: Request) {
  const supabase = createServiceClient();
  const { searchParams } = new URL(request.url);
  const mid = searchParams.get('mid');

  if (!mid) {
    return NextResponse.json({ error: 'mid is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('mid', mid)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/** POST: Create a new invoice (from order or manually) */
export async function POST(request: Request) {
  const supabase = createServiceClient();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const mid = body.mid as string;
  if (!mid) {
    return NextResponse.json({ error: 'mid is required' }, { status: 400 });
  }

  // Get merchant for company tag (determines language)
  const { data: merchant } = await supabase
    .from('merchants')
    .select('company, business_name, dual_pricing_enabled, card_surcharge_pct')
    .eq('mid', mid)
    .single();

  if (!merchant) {
    return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
  }

  const language = langFromCompany(merchant.company as string);

  // Generate next invoice number
  const { data: invoiceNum } = await supabase
    .rpc('next_invoice_number', { merchant_mid: mid });

  const invoiceNumber = (invoiceNum as string) || `INV-${Date.now()}`;

  // Creating from an existing order
  if (body.order_id) {
    const { data: order } = await supabase
      .from('cart_orders')
      .select('*')
      .eq('id', body.order_id)
      .eq('mid', mid)
      .single();

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const o = order as Record<string, unknown>;

    const { data: invoice, error } = await supabase
      .from('invoices')
      .insert({
        mid,
        order_id: body.order_id,
        invoice_number: invoiceNumber,
        status: (o.status as string) === 'paid' ? 'paid' : 'unpaid',
        customer_name: o.customer_name,
        customer_email: o.customer_email,
        customer_phone: o.customer_phone,
        customer_address: o.ship_to || null,
        line_items: o.line_items,
        subtotal_cents: o.subtotal_cents,
        tax_cents: o.tax_cents,
        tip_cents: o.tip_cents || 0,
        delivery_fee_cents: o.delivery_fee_cents || 0,
        surcharge_cents: o.surcharge_cents || 0,
        surcharge_pct: o.surcharge_pct_applied || null,
        total_cents: o.total_cents,
        payment_method: o.payment_method || 'card',
        cash_total_cents: o.cash_total_cents || null,
        card_total_cents: o.card_total_cents || null,
        paid_at: (o.status as string) === 'paid' ? o.updated_at || o.created_at : null,
        language,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(invoice);
  }

  // Manual invoice creation
  const { data: invoice, error } = await supabase
    .from('invoices')
    .insert({
      mid,
      invoice_number: invoiceNumber,
      status: 'draft',
      customer_name: body.customer_name || null,
      customer_email: body.customer_email || null,
      customer_phone: body.customer_phone || null,
      customer_address: body.customer_address || null,
      line_items: body.line_items || [],
      subtotal_cents: (body.line_items as { price_cents: number; quantity: number }[] || [])
        .reduce((sum: number, li: { price_cents: number; quantity: number }) => sum + li.price_cents * li.quantity, 0),
      total_cents: (body.line_items as { price_cents: number; quantity: number }[] || [])
        .reduce((sum: number, li: { price_cents: number; quantity: number }) => sum + li.price_cents * li.quantity, 0),
      notes: body.notes || null,
      due_date: body.due_date || null,
      language,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(invoice);
}

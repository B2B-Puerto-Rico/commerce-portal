import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { langFromCompany } from '@/lib/invoice-i18n';

/**
 * 36-char hex token used in the customer-facing URL /i/{token}. 18 bytes of
 * randomness = 144 bits entropy — unguessable without DB access, and short
 * enough to fit in an email body or QR code without wrapping.
 */
function generatePublicToken(): string {
  return randomBytes(18).toString('hex');
}

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

/** POST: Create a new invoice (from order or manually).
 *
 * Optional body flags:
 *   - send_now: boolean — fire-and-forget call to the [id]/send route after
 *     creation. The send result is included in the response under `email_sent`
 *     / `email_error`, so the UI can surface failures inline.
 *   - email_message: string — personal note to render above the totals table
 *     in the email body. Ignored when send_now is false.
 */
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
  const sendNow = body.send_now === true;
  const emailMessage = typeof body.email_message === 'string' ? body.email_message : '';

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
        public_token: generatePublicToken(),
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

    const sendResult = await maybeSendInvoice(invoice as Record<string, unknown>, sendNow, emailMessage, request);
    return NextResponse.json({ ...invoice, ...sendResult });
  }

  // Manual invoice creation
  const { data: invoice, error } = await supabase
    .from('invoices')
    .insert({
      mid,
      invoice_number: invoiceNumber,
      public_token: generatePublicToken(),
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

  const sendResult = await maybeSendInvoice(invoice as Record<string, unknown>, sendNow, emailMessage, request);
  return NextResponse.json({ ...invoice, ...sendResult });
}

/**
 * If the caller asked to send the invoice immediately and we have a customer
 * email, POST to the [id]/send route on the same host. Failures are returned
 * in the response payload so the UI can show "Invoice created but email
 * failed" rather than rolling back the create.
 */
async function maybeSendInvoice(
  invoice: Record<string, unknown>,
  sendNow: boolean,
  emailMessage: string,
  request: Request,
): Promise<{ email_sent?: true; email_error?: string }> {
  if (!sendNow) return {};
  if (!invoice.customer_email) {
    return { email_error: 'No customer email — invoice created but not sent.' };
  }

  const origin =
    process.env.NEXT_PUBLIC_APP_URL ||
    new URL(request.url).origin;

  try {
    const res = await fetch(`${origin}/api/merchants/invoices/${invoice.id}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: emailMessage }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { email_error: (data && data.error) || `Send failed (${res.status})` };
    }
    return { email_sent: true };
  } catch (e) {
    return { email_error: e instanceof Error ? e.message : 'Network error sending email' };
  }
}

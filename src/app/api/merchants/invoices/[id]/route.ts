import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

/** GET: Fetch a single invoice by ID */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createServiceClient();
  const { id } = await params;

  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}

/** PATCH: Update an invoice */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createServiceClient();
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const allowed = [
    'status', 'customer_name', 'customer_email', 'customer_phone',
    'customer_address', 'line_items', 'subtotal_cents', 'tax_cents',
    'tip_cents', 'delivery_fee_cents', 'surcharge_cents', 'surcharge_pct',
    'discount_cents', 'total_cents', 'payment_method', 'cash_total_cents',
    'card_total_cents', 'notes', 'payment_instructions', 'due_date',
    'paid_at',
  ];

  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  // Clear cached PDF when invoice is updated
  updates.pdf_storage_path = null;
  updates.pdf_generated_at = null;

  const { data, error } = await supabase
    .from('invoices')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

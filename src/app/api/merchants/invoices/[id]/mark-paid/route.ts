/**
 * Mark a manual invoice as paid.
 *
 * Use this when payment was collected outside the platform — cash on pickup,
 * check, Zelle/ACH, manual card swipe on a terminal, etc. The invoice flips
 * to status='paid', stamps paid_at=now, and records the payment_method +
 * optional payment_reference for the merchant's records.
 *
 * Invoices already in status='paid' or 'cancelled' return 400 so we don't
 * silently overwrite a real payment record.
 */

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const ALLOWED_METHODS = ['cash', 'check', 'transfer', 'card', 'other'] as const;
type AllowedMethod = (typeof ALLOWED_METHODS)[number];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createServiceClient();
  const { id } = await params;

  let body: { payment_method?: string; payment_reference?: string } = {};
  try {
    body = await request.json();
  } catch {
    // Body is optional — default to method=other, no reference.
  }

  const rawMethod = (body.payment_method || 'other').toLowerCase();
  if (!ALLOWED_METHODS.includes(rawMethod as AllowedMethod)) {
    return NextResponse.json(
      { error: `payment_method must be one of: ${ALLOWED_METHODS.join(', ')}` },
      { status: 400 },
    );
  }
  const paymentMethod = rawMethod as AllowedMethod;
  const paymentReference = (body.payment_reference || '').trim().slice(0, 200) || null;

  const { data: invoice } = await supabase
    .from('invoices')
    .select('id, status, notes')
    .eq('id', id)
    .single();

  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  const currentStatus = (invoice as { status: string }).status;
  if (currentStatus === 'paid') {
    return NextResponse.json({ error: 'Invoice is already paid' }, { status: 400 });
  }
  if (currentStatus === 'cancelled') {
    return NextResponse.json({ error: 'Cannot mark a cancelled invoice as paid' }, { status: 400 });
  }

  // Append the reference to the notes field for the audit trail.
  // (We don't have a dedicated payment_reference column today; piggybacking
  // on notes keeps this PR schema-stable.)
  const existingNotes = (invoice as { notes: string | null }).notes || '';
  const stamp = new Date().toISOString().slice(0, 10);
  const referenceLine = paymentReference
    ? `[${stamp}] Marked paid (${paymentMethod}) — ref: ${paymentReference}`
    : `[${stamp}] Marked paid (${paymentMethod})`;
  const newNotes = existingNotes ? `${existingNotes}\n${referenceLine}` : referenceLine;

  const { error } = await supabase
    .from('invoices')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      payment_method: paymentMethod,
      notes: newNotes,
    })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

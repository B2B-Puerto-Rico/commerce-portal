import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getInvoiceStrings, langFromCompany, type InvoiceLang } from '@/lib/invoice-i18n';

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createServiceClient();
  const { id } = await params;

  // Fetch invoice
  const { data: invoice } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .single();

  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  const inv = invoice as Record<string, unknown>;
  const customerEmail = inv.customer_email as string;

  if (!customerEmail) {
    return NextResponse.json({ error: 'No customer email on this invoice' }, { status: 400 });
  }

  // Get merchant info
  const { data: merchant } = await supabase
    .from('merchants')
    .select('business_name, company')
    .eq('mid', inv.mid)
    .single();

  const lang = (inv.language as InvoiceLang) || langFromCompany(merchant?.company as string);
  const t = getInvoiceStrings(lang);
  const businessName = merchant?.business_name || 'Store';

  // Generate PDF first (call our own endpoint internally via fetch)
  const origin = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

  let pdfAttachment: { filename: string; content: string } | null = null;
  try {
    const pdfRes = await fetch(`${origin}/api/merchants/invoices/${id}/pdf`);
    if (pdfRes.ok) {
      const pdfBuffer = await pdfRes.arrayBuffer();
      pdfAttachment = {
        filename: `${inv.invoice_number}.pdf`,
        content: Buffer.from(pdfBuffer).toString('base64'),
      };
    }
  } catch {
    // PDF generation failed — send email without attachment
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ error: 'Email service not configured' }, { status: 500 });
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'invoices@commerce.b2bweb.app';
  const subject = `${t.invoice} ${inv.invoice_number} — ${businessName}`;

  const htmlBody = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a1a;">${t.invoice} ${inv.invoice_number}</h2>
      <p>${businessName}</p>
      <hr style="border: none; border-top: 1px solid #eee;" />
      <table style="width: 100%; margin: 16px 0;">
        <tr><td style="color: #888; font-size: 12px;">${t.total}</td><td style="text-align: right; font-weight: bold; font-size: 18px;">${formatPrice(inv.total_cents as number)}</td></tr>
        <tr><td style="color: #888; font-size: 12px;">${t.status}</td><td style="text-align: right;">${t[(inv.status as string) as keyof typeof t] || inv.status}</td></tr>
        ${inv.due_date ? `<tr><td style="color: #888; font-size: 12px;">${t.dueDate}</td><td style="text-align: right;">${inv.due_date}</td></tr>` : ''}
      </table>
      ${inv.notes ? `<p style="background: #f9fafb; padding: 12px; border-radius: 6px; font-size: 13px; color: #555;">${inv.notes}</p>` : ''}
      <p style="color: #aaa; font-size: 12px; text-align: center; margin-top: 24px;">${t.thankYou}</p>
    </div>
  `;

  const emailPayload: Record<string, unknown> = {
    from: fromEmail,
    to: customerEmail,
    subject,
    html: htmlBody,
  };

  if (pdfAttachment) {
    emailPayload.attachments = [pdfAttachment];
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(emailPayload),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: `Failed to send email: ${err}` }, { status: 500 });
  }

  // Update invoice status to 'unpaid' if it was draft
  if ((inv.status as string) === 'draft') {
    await supabase
      .from('invoices')
      .update({ status: 'unpaid' })
      .eq('id', id);
  }

  return NextResponse.json({ success: true });
}

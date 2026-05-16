import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getInvoiceStrings, langFromCompany, type InvoiceLang } from '@/lib/invoice-i18n';

// Reads runtime env (Supabase, Resend) so it can't be statically prerendered.
export const dynamic = 'force-dynamic';

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// Escape any user-supplied string before embedding in the email HTML body.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createServiceClient();
  const { id } = await params;

  // Optional `{ message }` body — merchant's personal note appended above the
  // totals table. Body is JSON but old callers (the list "Send" button) call
  // this without a body, so unparseable JSON is treated as no-message.
  let bodyMessage = '';
  try {
    const body = await request.json();
    if (body && typeof body.message === 'string') {
      bodyMessage = body.message.trim();
    }
  } catch {
    // No body — that's fine.
  }

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

  // Generate PDF first (call our own endpoint internally via fetch).
  // Precedence: explicit NEXT_PUBLIC_APP_URL → Vercel-injected URL → localhost.
  // The previous ternary returned `https://undefined` when NEXT_PUBLIC_APP_URL
  // was set but VERCEL_URL wasn't.
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

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

  // Use the verified b2bweb.app domain — commerce.b2bweb.app is a marketing
  // host and is NOT a verified Resend sender (Resend returns 403 "Domain not
  // verified"). The env var RESEND_INVOICE_FROM overrides per-environment if
  // you ever need a different inbox; the generic RESEND_FROM_EMAIL is
  // intentionally ignored here because it's been set to the unverified
  // commerce.b2bweb.app in some environments.
  const fromEmail =
    process.env.RESEND_INVOICE_FROM || 'B2B Commerce <invoice@b2bweb.app>';
  const subject = `${t.invoice} ${inv.invoice_number} — ${businessName}`;

  // Personal message from the merchant — rendered above totals, escaped + line breaks preserved.
  const personalMessageHtml = bodyMessage
    ? `<div style="background: #f8f9ff; border-left: 3px solid #2563eb; padding: 14px 16px; margin: 16px 0; border-radius: 4px; font-size: 14px; color: #333; line-height: 1.55; white-space: pre-wrap;">${escapeHtml(bodyMessage)}</div>`
    : '';

  // Pay-online CTA — only for unpaid invoices that have a public_token. The
  // token is set on creation but legacy invoices created before the migration
  // may be null; gracefully omit the button in that case so the email is
  // still useful (PDF attached, totals visible).
  const publicToken = (inv.public_token as string | null) || null;
  const cartUrl = (process.env.NEXT_PUBLIC_CART_URL || 'https://commerce.b2bweb.app').replace(/\/$/, '');
  const isPayable = (inv.status as string) !== 'paid' && (inv.status as string) !== 'cancelled';
  const payButtonHtml =
    isPayable && publicToken
      ? `
        <div style="text-align: center; margin: 24px 0;">
          <a href="${cartUrl}/i/${encodeURIComponent(publicToken)}"
             style="display: inline-block; background: #2563eb; color: #ffffff; padding: 14px 32px; border-radius: 8px; font-weight: 700; font-size: 15px; text-decoration: none; letter-spacing: 0.2px;">
            ${escapeHtml(t.payThisInvoice)} — ${formatPrice(inv.total_cents as number)}
          </a>
          <p style="color: #888; font-size: 12px; margin-top: 8px;">${escapeHtml(t.payOnlineSecure)}</p>
        </div>`
      : '';

  const htmlBody = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a1a;">${t.invoice} ${inv.invoice_number}</h2>
      <p>${escapeHtml(businessName)}</p>
      <hr style="border: none; border-top: 1px solid #eee;" />
      ${personalMessageHtml}
      <table style="width: 100%; margin: 16px 0;">
        <tr><td style="color: #888; font-size: 12px;">${t.total}</td><td style="text-align: right; font-weight: bold; font-size: 18px;">${formatPrice(inv.total_cents as number)}</td></tr>
        <tr><td style="color: #888; font-size: 12px;">${t.status}</td><td style="text-align: right;">${t[(inv.status as string) as keyof typeof t] || inv.status}</td></tr>
        ${inv.due_date ? `<tr><td style="color: #888; font-size: 12px;">${t.dueDate}</td><td style="text-align: right;">${inv.due_date}</td></tr>` : ''}
      </table>
      ${payButtonHtml}
      ${inv.notes ? `<p style="background: #f9fafb; padding: 12px; border-radius: 6px; font-size: 13px; color: #555;">${escapeHtml(inv.notes as string)}</p>` : ''}
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

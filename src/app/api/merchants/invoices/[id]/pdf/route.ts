import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import React from 'react';
import { renderToBuffer, Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { getInvoiceStrings, langFromCompany, type InvoiceLang } from '@/lib/invoice-i18n';

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica', color: '#1a1a1a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  title: { fontSize: 22, fontWeight: 'bold' },
  invoiceNum: { fontSize: 10, color: '#666', marginTop: 4 },
  brandName: { fontSize: 11, fontWeight: 'bold', textAlign: 'right' },
  merchantName: { fontSize: 9, color: '#888', textAlign: 'right', marginTop: 2 },
  statusBadge: { fontSize: 9, fontWeight: 'bold', textAlign: 'right', marginTop: 6, padding: '3 8', borderRadius: 4 },
  accentBar: { height: 3, marginBottom: 20 },
  metaRow: { flexDirection: 'row', marginBottom: 16, gap: 24 },
  metaCol: {},
  metaLabel: { fontSize: 8, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  metaValue: { fontSize: 10, fontWeight: 'bold' },
  customerBlock: { backgroundColor: '#f9fafb', padding: 12, borderRadius: 6, marginBottom: 16 },
  customerName: { fontSize: 11, fontWeight: 'bold' },
  customerDetail: { fontSize: 9, color: '#666', marginTop: 2 },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 2, paddingBottom: 6, marginBottom: 4 },
  tableHeaderCell: { fontSize: 8, fontWeight: 'bold', color: '#555', textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  tableCell: { fontSize: 10 },
  totalsContainer: { marginLeft: 'auto', width: 200, marginTop: 12 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  totalLabel: { fontSize: 10, color: '#666' },
  totalValue: { fontSize: 10 },
  grandTotalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, marginTop: 4, borderTopWidth: 2 },
  grandTotalLabel: { fontSize: 12, fontWeight: 'bold' },
  grandTotalValue: { fontSize: 14, fontWeight: 'bold' },
  dualPriceBox: { backgroundColor: '#fffbeb', padding: 8, borderRadius: 4, marginTop: 8 },
  dualPriceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  dualPriceLabel: { fontSize: 8, color: '#92400e' },
  dualPriceValue: { fontSize: 9, fontWeight: 'bold', color: '#78350f' },
  notes: { backgroundColor: '#f9fafb', padding: 12, borderRadius: 6, marginTop: 16 },
  notesLabel: { fontSize: 8, color: '#888', textTransform: 'uppercase', marginBottom: 4 },
  notesText: { fontSize: 10, color: '#444' },
  footer: { textAlign: 'center', marginTop: 24, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: '#e5e7eb' },
  footerText: { fontSize: 9, color: '#aaa' },
});

function InvoicePdf({ data, lang }: { data: Record<string, unknown>; lang: InvoiceLang }) {
  const t = getInvoiceStrings(lang);
  const company = (data.company as string) || 'b2b';
  const isSlice = company === 'slice';
  const accentColor = isSlice ? '#F97316' : '#2C5EF5';
  const brandLabel = isSlice ? 'Start Slice' : 'B2B Funding & Merchants';
  const lineItems = (data.line_items as { name: string; quantity: number; price_cents: number }[]) || [];

  const showDualTotals =
    (data.status as string) !== 'paid' &&
    (data.cash_total_cents as number) != null &&
    (data.card_total_cents as number) != null &&
    (data.cash_total_cents as number) !== (data.card_total_cents as number);

  const statusColors: Record<string, { bg: string; text: string }> = {
    draft: { bg: '#f3f4f6', text: '#4b5563' },
    unpaid: { bg: '#fefce8', text: '#a16207' },
    paid: { bg: '#f0fdf4', text: '#15803d' },
    overdue: { bg: '#fef2f2', text: '#b91c1c' },
    cancelled: { bg: '#f3f4f6', text: '#9ca3af' },
  };
  const sc = statusColors[(data.status as string)] || statusColors.draft;

  return React.createElement(Document, {},
    React.createElement(Page, { size: 'LETTER', style: styles.page },
      // Accent bar
      React.createElement(View, { style: { ...styles.accentBar, backgroundColor: accentColor } }),

      // Header
      React.createElement(View, { style: styles.header },
        React.createElement(View, {},
          React.createElement(Text, { style: { ...styles.title, color: accentColor } }, t.invoice),
          React.createElement(Text, { style: styles.invoiceNum }, data.invoice_number as string),
        ),
        React.createElement(View, {},
          React.createElement(Text, { style: styles.brandName }, brandLabel),
          React.createElement(Text, { style: styles.merchantName }, data.merchant_name as string),
          React.createElement(Text, {
            style: { ...styles.statusBadge, backgroundColor: sc.bg, color: sc.text },
          }, t[(data.status as string) as keyof typeof t] || (data.status as string)),
        ),
      ),

      // Metadata
      React.createElement(View, { style: styles.metaRow },
        React.createElement(View, { style: styles.metaCol },
          React.createElement(Text, { style: styles.metaLabel }, t.date),
          React.createElement(Text, { style: styles.metaValue }, formatDate(data.created_at as string)),
        ),
        data.due_date ? React.createElement(View, { style: styles.metaCol },
          React.createElement(Text, { style: styles.metaLabel }, t.dueDate),
          React.createElement(Text, { style: styles.metaValue }, formatDate(data.due_date as string)),
        ) : null,
        data.paid_at ? React.createElement(View, { style: styles.metaCol },
          React.createElement(Text, { style: styles.metaLabel }, t.paidOn),
          React.createElement(Text, { style: { ...styles.metaValue, color: '#15803d' } }, formatDate(data.paid_at as string)),
        ) : null,
        data.payment_method ? React.createElement(View, { style: styles.metaCol },
          React.createElement(Text, { style: styles.metaLabel }, t.paymentMethod),
          React.createElement(Text, { style: styles.metaValue },
            (data.payment_method as string) === 'cash' ? t.cash : t.card),
        ) : null,
      ),

      // Customer
      data.customer_name ? React.createElement(View, { style: styles.customerBlock },
        React.createElement(Text, { style: { ...styles.metaLabel, marginBottom: 4 } }, t.billTo),
        React.createElement(Text, { style: styles.customerName }, data.customer_name as string),
        data.customer_email ? React.createElement(Text, { style: styles.customerDetail }, data.customer_email as string) : null,
        data.customer_phone ? React.createElement(Text, { style: styles.customerDetail }, `${t.phone}: ${data.customer_phone}`) : null,
      ) : null,

      // Line items table
      React.createElement(View, { style: styles.tableHeader },
        React.createElement(Text, { style: { ...styles.tableHeaderCell, flex: 3 } }, t.item),
        React.createElement(Text, { style: { ...styles.tableHeaderCell, flex: 1, textAlign: 'center' } }, t.qty),
        React.createElement(Text, { style: { ...styles.tableHeaderCell, flex: 1.5, textAlign: 'right' } }, t.unitPrice),
        React.createElement(Text, { style: { ...styles.tableHeaderCell, flex: 1.5, textAlign: 'right' } }, t.amount),
      ),
      ...lineItems.map((item, i) =>
        React.createElement(View, { key: i, style: styles.tableRow },
          React.createElement(Text, { style: { ...styles.tableCell, flex: 3 } }, item.name),
          React.createElement(Text, { style: { ...styles.tableCell, flex: 1, textAlign: 'center', color: '#666' } }, String(item.quantity)),
          React.createElement(Text, { style: { ...styles.tableCell, flex: 1.5, textAlign: 'right', color: '#666' } }, formatPrice(item.price_cents)),
          React.createElement(Text, { style: { ...styles.tableCell, flex: 1.5, textAlign: 'right', fontWeight: 'bold' } }, formatPrice(item.price_cents * item.quantity)),
        )
      ),

      // Totals
      React.createElement(View, { style: styles.totalsContainer },
        React.createElement(View, { style: styles.totalRow },
          React.createElement(Text, { style: styles.totalLabel }, t.subtotal),
          React.createElement(Text, { style: styles.totalValue }, formatPrice(data.subtotal_cents as number)),
        ),
        (data.tax_cents as number) > 0 ? React.createElement(View, { style: styles.totalRow },
          React.createElement(Text, { style: styles.totalLabel }, t.tax),
          React.createElement(Text, { style: styles.totalValue }, formatPrice(data.tax_cents as number)),
        ) : null,
        (data.tip_cents as number) > 0 ? React.createElement(View, { style: styles.totalRow },
          React.createElement(Text, { style: styles.totalLabel }, t.tip),
          React.createElement(Text, { style: styles.totalValue }, formatPrice(data.tip_cents as number)),
        ) : null,
        (data.delivery_fee_cents as number) > 0 ? React.createElement(View, { style: styles.totalRow },
          React.createElement(Text, { style: styles.totalLabel }, t.deliveryFee),
          React.createElement(Text, { style: styles.totalValue }, formatPrice(data.delivery_fee_cents as number)),
        ) : null,
        (data.surcharge_cents as number) > 0 ? React.createElement(View, { style: styles.totalRow },
          React.createElement(Text, { style: { ...styles.totalLabel, color: '#92400e' } },
            `${t.surcharge}${data.surcharge_pct ? ` (${data.surcharge_pct}%)` : ''}`),
          React.createElement(Text, { style: { ...styles.totalValue, color: '#92400e' } }, formatPrice(data.surcharge_cents as number)),
        ) : null,
        (data.discount_cents as number) > 0 ? React.createElement(View, { style: styles.totalRow },
          React.createElement(Text, { style: { ...styles.totalLabel, color: '#15803d' } }, t.discount),
          React.createElement(Text, { style: { ...styles.totalValue, color: '#15803d' } }, `-${formatPrice(data.discount_cents as number)}`),
        ) : null,

        // Grand total
        React.createElement(View, { style: { ...styles.grandTotalRow, borderTopColor: accentColor } },
          React.createElement(Text, { style: styles.grandTotalLabel }, t.total),
          React.createElement(Text, { style: { ...styles.grandTotalValue, color: accentColor } }, formatPrice(data.total_cents as number)),
        ),

        // Dual pricing
        showDualTotals ? React.createElement(View, { style: styles.dualPriceBox },
          React.createElement(View, { style: styles.dualPriceRow },
            React.createElement(Text, { style: styles.dualPriceLabel }, t.cashTotal),
            React.createElement(Text, { style: styles.dualPriceValue }, formatPrice(data.cash_total_cents as number)),
          ),
          React.createElement(View, { style: styles.dualPriceRow },
            React.createElement(Text, { style: styles.dualPriceLabel }, t.cardTotal),
            React.createElement(Text, { style: styles.dualPriceValue }, formatPrice(data.card_total_cents as number)),
          ),
        ) : null,
      ),

      // Notes
      data.notes ? React.createElement(View, { style: styles.notes },
        React.createElement(Text, { style: styles.notesLabel }, t.notes),
        React.createElement(Text, { style: styles.notesText }, data.notes as string),
      ) : null,

      // Footer
      React.createElement(View, { style: styles.footer },
        React.createElement(Text, { style: styles.footerText }, t.thankYou),
      ),
    ),
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createServiceClient();
  const { id } = await params;

  // Fetch invoice
  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  const inv = invoice as Record<string, unknown>;

  // Check for cached PDF
  if (inv.pdf_storage_path) {
    const { data: fileData } = await supabase.storage
      .from('invoices')
      .download(inv.pdf_storage_path as string);

    if (fileData) {
      const buffer = await fileData.arrayBuffer();
      return new Response(buffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${inv.invoice_number}.pdf"`,
        },
      });
    }
  }

  // Get merchant info for branding
  const { data: merchant } = await supabase
    .from('merchants')
    .select('business_name, company')
    .eq('mid', inv.mid)
    .single();

  const enrichedData = {
    ...inv,
    merchant_name: merchant?.business_name || '',
    company: merchant?.company || 'b2b',
  };

  const lang = (inv.language as InvoiceLang) || langFromCompany(merchant?.company as string);

  // Generate PDF — renderToBuffer expects a Document element
  const docElement = InvoicePdf({ data: enrichedData, lang });
  const pdfBuffer = await renderToBuffer(docElement as React.ReactElement);

  // Convert to Uint8Array for Response and Storage compatibility
  const bytes = new Uint8Array(pdfBuffer);

  // Cache to Supabase Storage
  const storagePath = `${inv.mid}/${inv.invoice_number}.pdf`;
  await supabase.storage.from('invoices').upload(storagePath, bytes, {
    contentType: 'application/pdf',
    upsert: true,
  });

  // Update invoice record with storage path
  await supabase
    .from('invoices')
    .update({ pdf_storage_path: storagePath, pdf_generated_at: new Date().toISOString() })
    .eq('id', id);

  return new Response(bytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${inv.invoice_number}.pdf"`,
    },
  });
}

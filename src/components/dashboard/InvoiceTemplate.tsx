'use client';

import { getInvoiceStrings, type InvoiceLang } from '@/lib/invoice-i18n';

export interface InvoiceData {
  invoiceNumber: string;
  status: 'draft' | 'unpaid' | 'paid' | 'overdue' | 'cancelled';
  createdAt: string;
  dueDate?: string | null;
  paidAt?: string | null;

  // Merchant
  merchantName: string;
  company: 'b2b' | 'slice';

  // Customer
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerAddress?: { line1?: string; line2?: string; city?: string; zip?: string } | null;

  // Line items
  lineItems: { name: string; quantity: number; price_cents: number }[];

  // Totals
  subtotalCents: number;
  taxCents: number;
  tipCents: number;
  deliveryFeeCents: number;
  surchargeCents: number;
  surchargePct?: number | null;
  discountCents: number;
  totalCents: number;

  // Dual pricing
  paymentMethod?: string | null;
  cashTotalCents?: number | null;
  cardTotalCents?: number | null;

  // Extra
  notes?: string | null;
  paymentInstructions?: string | null;
  language: InvoiceLang;
}

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

const statusStyles: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  unpaid: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
  paid: 'bg-green-50 text-green-700 border border-green-200',
  overdue: 'bg-red-50 text-red-700 border border-red-200',
  cancelled: 'bg-gray-100 text-gray-400',
};

export function InvoiceTemplate({ data }: { data: InvoiceData }) {
  const t = getInvoiceStrings(data.language);
  const isSlice = data.company === 'slice';

  // Brand colors
  const accentColor = isSlice ? '#F97316' : '#2C5EF5'; // orange vs cobalt
  const brandLabel = isSlice ? 'Start Slice' : 'B2B Funding & Merchants';

  const showDualTotals =
    data.status !== 'paid' &&
    data.cashTotalCents != null &&
    data.cardTotalCents != null &&
    data.cashTotalCents !== data.cardTotalCents;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 max-w-[680px] mx-auto overflow-hidden print:shadow-none print:border-none">
      {/* Header bar */}
      <div className="px-8 py-6 flex items-start justify-between" style={{ borderBottom: `3px solid ${accentColor}` }}>
        <div>
          <p className="text-2xl font-bold tracking-tight" style={{ color: accentColor }}>
            {t.invoice}
          </p>
          <p className="text-sm text-gray-500 mt-1 font-mono">{data.invoiceNumber}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-gray-900">{brandLabel}</p>
          <p className="text-xs text-gray-400 mt-0.5">{data.merchantName}</p>
          <span className={`inline-block mt-2 text-xs font-bold px-3 py-1 rounded-full ${statusStyles[data.status] || statusStyles.draft}`}>
            {t[data.status as keyof typeof t] || data.status}
          </span>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">
        {/* Metadata row */}
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">{t.date}</p>
            <p className="font-medium text-gray-900 mt-0.5">{formatDate(data.createdAt)}</p>
          </div>
          {data.dueDate && (
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">{t.dueDate}</p>
              <p className="font-medium text-gray-900 mt-0.5">{formatDate(data.dueDate)}</p>
            </div>
          )}
          {data.paidAt && (
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">{t.paidOn}</p>
              <p className="font-medium text-green-700 mt-0.5">{formatDate(data.paidAt)}</p>
            </div>
          )}
          {data.paymentMethod && (
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">{t.paymentMethod}</p>
              <p className="font-medium text-gray-900 mt-0.5">
                {data.paymentMethod === 'cash' ? t.cash : t.card}
              </p>
            </div>
          )}
        </div>

        {/* Customer block */}
        {data.customerName && (
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1.5">{t.billTo}</p>
            <p className="text-sm font-semibold text-gray-900">{data.customerName}</p>
            {data.customerEmail && (
              <p className="text-xs text-gray-500 mt-0.5">{data.customerEmail}</p>
            )}
            {data.customerPhone && (
              <p className="text-xs text-gray-500 mt-0.5">{t.phone}: {data.customerPhone}</p>
            )}
            {data.customerAddress && (
              <p className="text-xs text-gray-500 mt-0.5">
                {data.customerAddress.line1}
                {data.customerAddress.line2 && `, ${data.customerAddress.line2}`}
                {data.customerAddress.city && `, ${data.customerAddress.city}`}
                {data.customerAddress.zip && ` ${data.customerAddress.zip}`}
              </p>
            )}
          </div>
        )}

        {/* Line items table */}
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2" style={{ borderColor: accentColor }}>
              <th className="text-left py-2 font-semibold text-gray-700">{t.item}</th>
              <th className="text-center py-2 font-semibold text-gray-700 w-16">{t.qty}</th>
              <th className="text-right py-2 font-semibold text-gray-700 w-28">{t.unitPrice}</th>
              <th className="text-right py-2 font-semibold text-gray-700 w-28">{t.amount}</th>
            </tr>
          </thead>
          <tbody>
            {data.lineItems.map((item, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-2.5 text-gray-900">{item.name}</td>
                <td className="py-2.5 text-center text-gray-600">{item.quantity}</td>
                <td className="py-2.5 text-right text-gray-600">{formatPrice(item.price_cents)}</td>
                <td className="py-2.5 text-right font-medium text-gray-900">
                  {formatPrice(item.price_cents * item.quantity)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-64 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">{t.subtotal}</span>
              <span className="font-medium">{formatPrice(data.subtotalCents)}</span>
            </div>
            {data.taxCents > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">{t.tax}</span>
                <span>{formatPrice(data.taxCents)}</span>
              </div>
            )}
            {data.tipCents > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">{t.tip}</span>
                <span>{formatPrice(data.tipCents)}</span>
              </div>
            )}
            {data.deliveryFeeCents > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">{t.deliveryFee}</span>
                <span>{formatPrice(data.deliveryFeeCents)}</span>
              </div>
            )}
            {data.surchargeCents > 0 && (
              <div className="flex justify-between text-amber-700">
                <span>{t.surcharge}{data.surchargePct ? ` (${data.surchargePct}%)` : ''}</span>
                <span>{formatPrice(data.surchargeCents)}</span>
              </div>
            )}
            {data.discountCents > 0 && (
              <div className="flex justify-between text-green-700">
                <span>{t.discount}</span>
                <span>-{formatPrice(data.discountCents)}</span>
              </div>
            )}

            <div className="border-t-2 pt-2 mt-2 flex justify-between" style={{ borderColor: accentColor }}>
              <span className="font-bold text-gray-900">{t.total}</span>
              <span className="font-bold text-lg" style={{ color: accentColor }}>
                {formatPrice(data.totalCents)}
              </span>
            </div>

            {/* Dual pricing: show both totals for unpaid invoices */}
            {showDualTotals && (
              <div className="bg-amber-50 rounded-lg p-2.5 mt-2 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-amber-700">{t.cashTotal}</span>
                  <span className="font-semibold text-amber-800">{formatPrice(data.cashTotalCents!)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-amber-700">{t.cardTotal}</span>
                  <span className="font-semibold text-amber-800">{formatPrice(data.cardTotalCents!)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        {data.notes && (
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1">{t.notes}</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{data.notes}</p>
          </div>
        )}

        {/* Payment instructions */}
        {data.paymentInstructions && (
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
            <p className="text-xs text-blue-500 font-medium uppercase tracking-wider mb-1">{t.paymentInstructions}</p>
            <p className="text-sm text-blue-800 whitespace-pre-wrap">{data.paymentInstructions}</p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-400">{t.thankYou}</p>
        </div>
      </div>
    </div>
  );
}

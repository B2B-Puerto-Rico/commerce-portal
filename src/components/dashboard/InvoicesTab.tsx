'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { InvoiceTemplate, type InvoiceData } from './InvoiceTemplate';
import { langFromCompany } from '@/lib/invoice-i18n';

interface Invoice {
  id: string;
  invoice_number: string;
  status: string;
  customer_name: string | null;
  customer_email: string | null;
  total_cents: number;
  payment_method: string | null;
  created_at: string;
  due_date: string | null;
  paid_at: string | null;
  order_id: string | null;
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const statusBadge: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  unpaid: 'bg-yellow-50 text-yellow-700',
  paid: 'bg-green-50 text-green-700',
  overdue: 'bg-red-50 text-red-700',
  cancelled: 'bg-gray-100 text-gray-400',
};

export function InvoicesTab({
  mid,
  company,
  merchantName,
  orders,
}: {
  mid: string;
  company: string;
  merchantName: string;
  orders: Record<string, unknown>[];
}) {
  const supabase = createClient();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceData | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [manualForm, setManualForm] = useState({
    customerName: '',
    customerEmail: '',
    notes: '',
    dueDate: '',
  });

  const fetchInvoices = useCallback(async () => {
    const { data } = await supabase
      .from('invoices')
      .select('id, invoice_number, status, customer_name, customer_email, total_cents, payment_method, created_at, due_date, paid_at, order_id')
      .eq('mid', mid)
      .order('created_at', { ascending: false })
      .limit(50);
    setInvoices((data as Invoice[]) || []);
    setLoading(false);
  }, [mid, supabase]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const createFromOrder = async (orderId: string) => {
    setCreating(true);
    try {
      const res = await fetch('/api/merchants/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mid, order_id: orderId }),
      });
      if (res.ok) {
        setShowCreateModal(false);
        setSelectedOrderId('');
        await fetchInvoices();
      }
    } finally {
      setCreating(false);
    }
  };

  const createManual = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/merchants/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mid,
          customer_name: manualForm.customerName,
          customer_email: manualForm.customerEmail,
          notes: manualForm.notes,
          due_date: manualForm.dueDate || null,
          line_items: [],
        }),
      });
      if (res.ok) {
        setShowCreateModal(false);
        setManualForm({ customerName: '', customerEmail: '', notes: '', dueDate: '' });
        await fetchInvoices();
      }
    } finally {
      setCreating(false);
    }
  };

  const viewInvoice = async (inv: Invoice) => {
    const { data } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', inv.id)
      .single();
    if (!data) return;
    const d = data as Record<string, unknown>;
    const lineItems = (d.line_items as { name: string; quantity: number; price_cents: number }[]) || [];
    setSelectedInvoice({
      invoiceNumber: d.invoice_number as string,
      status: d.status as InvoiceData['status'],
      createdAt: d.created_at as string,
      dueDate: d.due_date as string | null,
      paidAt: d.paid_at as string | null,
      merchantName,
      company: company as 'b2b' | 'slice',
      customerName: d.customer_name as string | null,
      customerEmail: d.customer_email as string | null,
      customerPhone: d.customer_phone as string | null,
      customerAddress: d.customer_address as InvoiceData['customerAddress'],
      lineItems,
      subtotalCents: d.subtotal_cents as number,
      taxCents: d.tax_cents as number,
      tipCents: d.tip_cents as number,
      deliveryFeeCents: d.delivery_fee_cents as number,
      surchargeCents: d.surcharge_cents as number,
      surchargePct: d.surcharge_pct as number | null,
      discountCents: d.discount_cents as number,
      totalCents: d.total_cents as number,
      paymentMethod: d.payment_method as string | null,
      cashTotalCents: d.cash_total_cents as number | null,
      cardTotalCents: d.card_total_cents as number | null,
      notes: d.notes as string | null,
      paymentInstructions: d.payment_instructions as string | null,
      language: langFromCompany(company),
    });
  };

  const downloadPdf = async (invoiceId: string) => {
    window.open(`/api/merchants/invoices/${invoiceId}/pdf`, '_blank');
  };

  const sendInvoice = async (invoiceId: string) => {
    const res = await fetch(`/api/merchants/invoices/${invoiceId}/send`, { method: 'POST' });
    if (res.ok) {
      await fetchInvoices();
    }
  };

  // Orders that don't already have invoices
  const uninvoicedOrders = orders.filter(
    (o) => (o.status as string) === 'paid' && !invoices.some((inv) => inv.order_id === o.id)
  );

  return (
    <div className="space-y-4">
      {/* Header with create button */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-glass-primary">Invoices</h3>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 text-sm font-medium bg-cobalt text-white rounded-[10px] hover:bg-cobalt-600 transition-colors"
        >
          + New Invoice
        </button>
      </div>

      {/* Invoice list */}
      <div className="bg-glass-surface rounded-2xl border border-glass-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-glass-border">
              <th className="text-left text-xs font-semibold text-glass-secondary uppercase tracking-wider px-5 py-3">Invoice</th>
              <th className="text-left text-xs font-semibold text-glass-secondary uppercase tracking-wider px-5 py-3">Customer</th>
              <th className="text-left text-xs font-semibold text-glass-secondary uppercase tracking-wider px-5 py-3">Total</th>
              <th className="text-left text-xs font-semibold text-glass-secondary uppercase tracking-wider px-5 py-3">Status</th>
              <th className="text-left text-xs font-semibold text-glass-secondary uppercase tracking-wider px-5 py-3">Date</th>
              <th className="text-left text-xs font-semibold text-glass-secondary uppercase tracking-wider px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-glass-border">
            {loading ? (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-gray-400">Loading...</td></tr>
            ) : invoices.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-gray-400">No invoices yet. Create one from an order or manually.</td></tr>
            ) : invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-glass-neutral/50">
                <td className="px-5 py-3">
                  <button onClick={() => viewInvoice(inv)} className="text-sm font-mono font-semibold text-cobalt hover:underline">
                    {inv.invoice_number}
                  </button>
                  {inv.order_id && (
                    <span className="block text-[10px] text-gray-400">From order</span>
                  )}
                </td>
                <td className="px-5 py-3">
                  <span className="text-sm text-glass-primary">{inv.customer_name || '—'}</span>
                  {inv.customer_email && <span className="block text-xs text-gray-400">{inv.customer_email}</span>}
                </td>
                <td className="px-5 py-3 text-sm font-semibold text-glass-primary">{formatPrice(inv.total_cents)}</td>
                <td className="px-5 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBadge[inv.status] || statusBadge.draft}`}>
                    {inv.status}
                  </span>
                </td>
                <td className="px-5 py-3 text-xs text-gray-400">{formatDate(inv.created_at)}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => viewInvoice(inv)} className="text-xs text-cobalt hover:underline font-medium">View</button>
                    <button onClick={() => downloadPdf(inv.id)} className="text-xs text-gray-500 hover:text-gray-700 font-medium">PDF</button>
                    {inv.customer_email && inv.status !== 'paid' && (
                      <button onClick={() => sendInvoice(inv.id)} className="text-xs text-green-600 hover:underline font-medium">Send</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Invoice Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-lg text-glass-primary">New Invoice</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* From Order */}
              {uninvoicedOrders.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-glass-primary">Create from Order</h4>
                  <select
                    value={selectedOrderId}
                    onChange={(e) => setSelectedOrderId(e.target.value)}
                    className="w-full border border-glass-border rounded-[10px] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cobalt/30"
                  >
                    <option value="">Select a paid order...</option>
                    {uninvoicedOrders.map((o) => (
                      <option key={o.id as string} value={o.id as string}>
                        {o.customer_name as string} — {formatPrice(o.total_cents as number)} — {formatDate(o.created_at as string)}
                      </option>
                    ))}
                  </select>
                  {selectedOrderId && (
                    <button
                      onClick={() => createFromOrder(selectedOrderId)}
                      disabled={creating}
                      className="w-full py-2.5 bg-cobalt text-white text-sm font-medium rounded-[10px] hover:bg-cobalt-600 disabled:opacity-50 transition-colors"
                    >
                      {creating ? 'Creating...' : 'Create Invoice from Order'}
                    </button>
                  )}
                </div>
              )}

              {uninvoicedOrders.length > 0 && (
                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
                  <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-gray-400">or</span></div>
                </div>
              )}

              {/* Manual */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-glass-primary">Create Manually</h4>
                <input
                  type="text"
                  placeholder="Customer name"
                  value={manualForm.customerName}
                  onChange={(e) => setManualForm({ ...manualForm, customerName: e.target.value })}
                  className="w-full border border-glass-border rounded-[10px] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cobalt/30"
                />
                <input
                  type="email"
                  placeholder="Customer email"
                  value={manualForm.customerEmail}
                  onChange={(e) => setManualForm({ ...manualForm, customerEmail: e.target.value })}
                  className="w-full border border-glass-border rounded-[10px] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cobalt/30"
                />
                <input
                  type="date"
                  value={manualForm.dueDate}
                  onChange={(e) => setManualForm({ ...manualForm, dueDate: e.target.value })}
                  className="w-full border border-glass-border rounded-[10px] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cobalt/30"
                />
                <textarea
                  placeholder="Notes (optional)"
                  value={manualForm.notes}
                  onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })}
                  rows={3}
                  className="w-full border border-glass-border rounded-[10px] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cobalt/30 resize-none"
                />
                <button
                  onClick={createManual}
                  disabled={creating || !manualForm.customerName}
                  className="w-full py-2.5 bg-glass-primary text-white text-sm font-medium rounded-[10px] hover:bg-gray-800 disabled:opacity-50 transition-colors"
                >
                  {creating ? 'Creating...' : 'Create Draft Invoice'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Preview Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-gray-100 rounded-2xl shadow-xl max-w-[740px] w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 bg-white rounded-t-2xl flex items-center justify-between">
              <h3 className="font-semibold text-glass-primary">{selectedInvoice.invoiceNumber}</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const inv = invoices.find((i) => i.invoice_number === selectedInvoice.invoiceNumber);
                    if (inv) downloadPdf(inv.id);
                  }}
                  className="px-3 py-1.5 text-xs font-medium bg-glass-neutral text-glass-primary rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Download PDF
                </button>
                <button onClick={() => setSelectedInvoice(null)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6">
              <InvoiceTemplate data={selectedInvoice} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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

interface ManualLineItem {
  name: string;
  quantity: number;
  /** Decimal dollars in the form input; converted to cents on submit. */
  price: string;
}

function newLineItem(): ManualLineItem {
  return { name: '', quantity: 1, price: '' };
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
  products = [],
}: {
  mid: string;
  company: string;
  merchantName: string;
  orders: Record<string, unknown>[];
  products?: Record<string, unknown>[];
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
  const [manualLineItems, setManualLineItems] = useState<ManualLineItem[]>([newLineItem()]);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  // Send-on-create state (shared between manual + from-order paths)
  const [sendOnCreate, setSendOnCreate] = useState(true);
  const [emailMessage, setEmailMessage] = useState('');
  const [emailMessageOpen, setEmailMessageOpen] = useState(false);
  const [createFeedback, setCreateFeedback] = useState<{ kind: 'success' | 'warn' | 'error'; text: string } | null>(null);

  // Per-row send state for the existing "Send" action in the list
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sendFeedback, setSendFeedback] = useState<{ id: string; kind: 'success' | 'error'; text: string } | null>(null);

  // Convert decimal-dollar input to integer cents at the boundary.
  // Empty / invalid → 0 cents so the running total is always defined.
  function priceToCents(price: string): number {
    const n = Number.parseFloat(price);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.round(n * 100);
  }

  const manualSubtotalCents = manualLineItems.reduce(
    (sum, li) => sum + priceToCents(li.price) * (Number(li.quantity) || 0),
    0,
  );

  function updateLineItem(idx: number, patch: Partial<ManualLineItem>) {
    setManualLineItems((prev) =>
      prev.map((li, i) => (i === idx ? { ...li, ...patch } : li)),
    );
  }

  function removeLineItem(idx: number) {
    setManualLineItems((prev) =>
      prev.length === 1 ? [newLineItem()] : prev.filter((_, i) => i !== idx),
    );
  }

  function addProductFromCatalog(p: Record<string, unknown>) {
    const name = (p.name as string) || 'Item';
    const priceCents = Number(p.price_cents) || 0;
    setManualLineItems((prev) => {
      // Replace the first blank row, otherwise append.
      const blankIdx = prev.findIndex((li) => !li.name && !li.price);
      const row: ManualLineItem = {
        name,
        quantity: 1,
        price: (priceCents / 100).toFixed(2),
      };
      if (blankIdx >= 0) {
        return prev.map((li, i) => (i === blankIdx ? row : li));
      }
      return [...prev, row];
    });
    setProductPickerOpen(false);
    setProductSearch('');
  }

  const filteredProducts = products.filter((p) => {
    if (!productSearch.trim()) return true;
    const q = productSearch.toLowerCase();
    return ((p.name as string) || '').toLowerCase().includes(q);
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
    setCreateFeedback(null);
    try {
      const res = await fetch('/api/merchants/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mid,
          order_id: orderId,
          send_now: sendOnCreate,
          email_message: sendOnCreate ? emailMessage : '',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCreateFeedback({ kind: 'error', text: data?.error || 'Failed to create invoice.' });
        return;
      }
      if (data?.email_error) {
        // Created but email failed — keep modal open so user can retry or note it.
        setCreateFeedback({ kind: 'warn', text: `Invoice created, but email failed: ${data.email_error}` });
        await fetchInvoices();
        return;
      }
      setShowCreateModal(false);
      setSelectedOrderId('');
      setEmailMessage('');
      setEmailMessageOpen(false);
      if (data?.email_sent) {
        setSendFeedback({ id: String(data.id || ''), kind: 'success', text: 'Invoice created and emailed.' });
      }
      await fetchInvoices();
    } finally {
      setCreating(false);
    }
  };

  const createManual = async () => {
    setCreating(true);
    try {
      // Strip blank rows (an empty row exists as a placeholder); the API computes
      // subtotal/total from these line_items so it must match exactly what the
      // form displayed.
      const lineItemsPayload = manualLineItems
        .filter((li) => li.name.trim() && priceToCents(li.price) > 0 && Number(li.quantity) > 0)
        .map((li) => ({
          name: li.name.trim(),
          quantity: Number(li.quantity),
          price_cents: priceToCents(li.price),
        }));

      // Only send-on-create if we have a destination email; otherwise the
      // server will error and we'd surface a confusing "no email" message.
      const wantsSend = sendOnCreate && !!manualForm.customerEmail.trim();
      const res = await fetch('/api/merchants/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mid,
          customer_name: manualForm.customerName,
          customer_email: manualForm.customerEmail,
          notes: manualForm.notes,
          due_date: manualForm.dueDate || null,
          line_items: lineItemsPayload,
          send_now: wantsSend,
          email_message: wantsSend ? emailMessage : '',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCreateFeedback({ kind: 'error', text: data?.error || 'Failed to create invoice.' });
        return;
      }
      if (data?.email_error) {
        setCreateFeedback({ kind: 'warn', text: `Invoice created, but email failed: ${data.email_error}` });
        await fetchInvoices();
        return;
      }
      setShowCreateModal(false);
      setManualForm({ customerName: '', customerEmail: '', notes: '', dueDate: '' });
      setManualLineItems([newLineItem()]);
      setEmailMessage('');
      setEmailMessageOpen(false);
      if (data?.email_sent) {
        setSendFeedback({ id: String(data.id || ''), kind: 'success', text: 'Invoice created and emailed.' });
      }
      await fetchInvoices();
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
    setSendingId(invoiceId);
    setSendFeedback(null);
    try {
      const res = await fetch(`/api/merchants/invoices/${invoiceId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSendFeedback({ id: invoiceId, kind: 'success', text: 'Email sent.' });
        await fetchInvoices();
      } else {
        setSendFeedback({
          id: invoiceId,
          kind: 'error',
          text: data?.error || 'Failed to send email.',
        });
      }
    } catch (e) {
      setSendFeedback({
        id: invoiceId,
        kind: 'error',
        text: e instanceof Error ? e.message : 'Network error',
      });
    } finally {
      setSendingId(null);
    }
  };

  // Auto-dismiss feedback after 4 seconds so the row isn't permanently noisy.
  useEffect(() => {
    if (!sendFeedback) return;
    const t = setTimeout(() => setSendFeedback(null), 4000);
    return () => clearTimeout(t);
  }, [sendFeedback]);

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
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <button onClick={() => viewInvoice(inv)} className="text-xs text-cobalt hover:underline font-medium">View</button>
                      <button onClick={() => downloadPdf(inv.id)} className="text-xs text-gray-500 hover:text-gray-700 font-medium">PDF</button>
                      {inv.customer_email && inv.status !== 'paid' && (
                        <button
                          onClick={() => sendInvoice(inv.id)}
                          disabled={sendingId === inv.id}
                          className="inline-flex items-center gap-1 text-xs text-green-600 hover:underline font-medium disabled:opacity-60 disabled:cursor-wait"
                        >
                          {sendingId === inv.id && (
                            <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="42" strokeDashoffset="20" />
                            </svg>
                          )}
                          {sendingId === inv.id ? 'Sending…' : inv.status === 'draft' ? 'Send' : 'Resend'}
                        </button>
                      )}
                    </div>
                    {sendFeedback?.id === inv.id && (
                      <span className={`text-[11px] font-medium ${
                        sendFeedback.kind === 'success' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {sendFeedback.text}
                      </span>
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
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-lg text-glass-primary">New Invoice</h3>
              <button onClick={() => { setShowCreateModal(false); setCreateFeedback(null); }} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {createFeedback && (
              <div className={`mx-6 mt-4 px-4 py-2.5 rounded-[10px] text-sm ${
                createFeedback.kind === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
                createFeedback.kind === 'warn' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {createFeedback.text}
              </div>
            )}

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
                  {selectedOrderId && (() => {
                    const order = uninvoicedOrders.find((o) => o.id === selectedOrderId);
                    const orderHasEmail = !!(order?.customer_email as string);
                    const willSend = sendOnCreate && orderHasEmail;
                    return (
                      <button
                        onClick={() => createFromOrder(selectedOrderId)}
                        disabled={creating}
                        className="w-full py-2.5 bg-cobalt text-white text-sm font-medium rounded-[10px] hover:bg-cobalt-600 disabled:opacity-50 transition-colors"
                      >
                        {creating
                          ? willSend ? 'Creating & sending…' : 'Creating…'
                          : willSend ? 'Create & Email Invoice' : 'Create Invoice from Order'}
                      </button>
                    );
                  })()}
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

                {/* Line items editor */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-glass-secondary uppercase tracking-wider">Line items</label>
                    {products.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setProductPickerOpen((v) => !v)}
                        className="text-xs font-medium text-cobalt hover:underline"
                      >
                        {productPickerOpen ? 'Hide catalog' : '+ From catalog'}
                      </button>
                    )}
                  </div>

                  {productPickerOpen && (
                    <div className="border border-glass-border rounded-[10px] p-2 max-h-48 overflow-y-auto space-y-1 bg-gray-50">
                      <input
                        type="text"
                        placeholder="Search products..."
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        className="w-full border border-glass-border rounded-md px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-cobalt/30"
                      />
                      {filteredProducts.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-3">No matching products</p>
                      ) : (
                        filteredProducts.slice(0, 30).map((p) => (
                          <button
                            type="button"
                            key={p.clover_item_id as string}
                            onClick={() => addProductFromCatalog(p)}
                            className="w-full flex items-center justify-between px-2 py-1.5 text-xs text-left rounded hover:bg-cobalt-50"
                          >
                            <span className="text-glass-primary truncate pr-2">{p.name as string}</span>
                            <span className="text-glass-secondary flex-shrink-0">{formatPrice(Number(p.price_cents) || 0)}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}

                  {manualLineItems.map((li, idx) => (
                    <div key={idx} className="flex items-start gap-1.5">
                      <input
                        type="text"
                        placeholder="Description (e.g. Consultation)"
                        value={li.name}
                        onChange={(e) => updateLineItem(idx, { name: e.target.value })}
                        className="flex-1 min-w-0 border border-glass-border rounded-[10px] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cobalt/30"
                      />
                      <input
                        type="number"
                        min={1}
                        placeholder="Qty"
                        value={li.quantity}
                        onChange={(e) => updateLineItem(idx, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                        className="w-14 border border-glass-border rounded-[10px] px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-cobalt/30"
                      />
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        placeholder="$"
                        value={li.price}
                        onChange={(e) => updateLineItem(idx, { price: e.target.value })}
                        className="w-20 border border-glass-border rounded-[10px] px-2 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-cobalt/30"
                      />
                      <button
                        type="button"
                        onClick={() => removeLineItem(idx)}
                        aria-label="Remove line"
                        className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-[10px] text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => setManualLineItems((prev) => [...prev, newLineItem()])}
                      className="text-xs font-medium text-cobalt hover:underline"
                    >
                      + Add line
                    </button>
                    <span className="text-sm font-semibold text-glass-primary">
                      Subtotal: {formatPrice(manualSubtotalCents)}
                    </span>
                  </div>
                </div>

                <textarea
                  placeholder="Notes (optional)"
                  value={manualForm.notes}
                  onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })}
                  rows={3}
                  className="w-full border border-glass-border rounded-[10px] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cobalt/30 resize-none"
                />
                <button
                  onClick={createManual}
                  disabled={creating || !manualForm.customerName || manualSubtotalCents === 0}
                  className="w-full py-2.5 bg-glass-primary text-white text-sm font-medium rounded-[10px] hover:bg-gray-800 disabled:opacity-50 transition-colors"
                >
                  {(() => {
                    if (creating) {
                      return sendOnCreate && manualForm.customerEmail
                        ? 'Creating & sending…'
                        : 'Creating…';
                    }
                    if (manualSubtotalCents === 0) return 'Add at least one line item';
                    const verb = sendOnCreate && manualForm.customerEmail ? 'Create & Email' : 'Create Draft';
                    return `${verb} Invoice — ${formatPrice(manualSubtotalCents)}`;
                  })()}
                </button>
              </div>

              {/* ============================================================ */}
              {/* Shared: Send via email options (applies to both paths above) */}
              {/* ============================================================ */}
              <div className="border-t border-gray-100 pt-5 space-y-3">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendOnCreate}
                    onChange={(e) => setSendOnCreate(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-gray-300 text-cobalt focus:ring-cobalt/30"
                  />
                  <span className="text-sm text-glass-primary">
                    Email the invoice to the customer immediately
                    <span className="block text-xs text-glass-secondary mt-0.5">
                      Uses the customer email on the invoice. Sends a PDF attached with totals.
                      Won&apos;t send if no customer email is set.
                    </span>
                  </span>
                </label>

                {sendOnCreate && (
                  <>
                    <button
                      type="button"
                      onClick={() => setEmailMessageOpen((v) => !v)}
                      className="text-xs font-medium text-cobalt hover:underline"
                    >
                      {emailMessageOpen ? '− Hide message' : '+ Add a personal message'}
                    </button>
                    {emailMessageOpen && (
                      <textarea
                        placeholder="Hi — thanks for your business. Here's the invoice for last week's work. Let me know if you have any questions."
                        value={emailMessage}
                        onChange={(e) => setEmailMessage(e.target.value)}
                        rows={3}
                        maxLength={1000}
                        className="w-full border border-glass-border rounded-[10px] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cobalt/30 resize-none"
                      />
                    )}
                  </>
                )}
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

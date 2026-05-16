/** Invoice i18n — EN/ES string maps for all invoice labels */

export type InvoiceLang = 'en' | 'es';

const strings = {
  en: {
    invoice: 'Invoice',
    invoiceNumber: 'Invoice #',
    date: 'Date',
    dueDate: 'Due Date',
    billTo: 'Bill To',
    from: 'From',
    item: 'Item',
    qty: 'Qty',
    unitPrice: 'Unit Price',
    amount: 'Amount',
    subtotal: 'Subtotal',
    tax: 'Tax',
    tip: 'Tip',
    deliveryFee: 'Delivery Fee',
    surcharge: 'Card Surcharge',
    discount: 'Discount',
    total: 'Total',
    cashTotal: 'Cash Total',
    cardTotal: 'Card Total',
    paymentMethod: 'Payment Method',
    status: 'Status',
    notes: 'Notes',
    paymentInstructions: 'Payment Instructions',
    paid: 'Paid',
    unpaid: 'Unpaid',
    draft: 'Draft',
    overdue: 'Overdue',
    cancelled: 'Cancelled',
    paidOn: 'Paid on',
    thankYou: 'Thank you for your business!',
    card: 'Card',
    cash: 'Cash',
    phone: 'Phone',
    email: 'Email',
    payThisInvoice: 'Pay this invoice',
    payOnlineSecure: 'Pay online — secure checkout',
  },
  es: {
    invoice: 'Factura',
    invoiceNumber: 'Factura #',
    date: 'Fecha',
    dueDate: 'Fecha de Vencimiento',
    billTo: 'Facturar A',
    from: 'De',
    item: 'Artículo',
    qty: 'Cant.',
    unitPrice: 'Precio Unitario',
    amount: 'Monto',
    subtotal: 'Subtotal',
    tax: 'Impuesto',
    tip: 'Propina',
    deliveryFee: 'Cargo de Entrega',
    surcharge: 'Recargo de Tarjeta',
    discount: 'Descuento',
    total: 'Total',
    cashTotal: 'Total en Efectivo',
    cardTotal: 'Total con Tarjeta',
    paymentMethod: 'Método de Pago',
    status: 'Estado',
    notes: 'Notas',
    paymentInstructions: 'Instrucciones de Pago',
    paid: 'Pagada',
    unpaid: 'Pendiente',
    draft: 'Borrador',
    overdue: 'Vencida',
    cancelled: 'Cancelada',
    paidOn: 'Pagada el',
    thankYou: '¡Gracias por su preferencia!',
    card: 'Tarjeta',
    cash: 'Efectivo',
    phone: 'Teléfono',
    email: 'Correo',
    payThisInvoice: 'Pagar esta factura',
    payOnlineSecure: 'Pagar en línea — pago seguro',
  },
};

export type InvoiceStrings = typeof strings.en;

export function getInvoiceStrings(lang: InvoiceLang): InvoiceStrings {
  return strings[lang];
}

/** Determine language from merchant company tag */
export function langFromCompany(company: string | null | undefined): InvoiceLang {
  return company === 'slice' ? 'en' : 'es';
}

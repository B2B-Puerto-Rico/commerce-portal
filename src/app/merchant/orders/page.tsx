import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(d: string): string {
  return new Date(d).toLocaleString();
}

const statusColor = (s: string) => {
  switch (s) {
    case 'paid': return 'bg-green-50 text-green-700';
    case 'pending': return 'bg-yellow-50 text-yellow-700';
    case 'failed': return 'bg-red-50 text-red-700';
    default: return 'bg-gray-50 text-gray-600';
  }
};

export default async function MerchantOrdersPage() {
  const supabase = createClient();
  const serviceClient = createServiceClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const mid = user.app_metadata?.mid;
  if (!mid) redirect('/login');

  const { data: orders } = await serviceClient
    .from('cart_orders')
    .select('*')
    .eq('mid', mid)
    .order('created_at', { ascending: false })
    .limit(100);

  const revenue = orders?.filter((o) => o.status === 'paid').reduce((sum, o) => sum + o.total_cents, 0) || 0;
  const paidCount = orders?.filter((o) => o.status === 'paid').length || 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        <p className="text-sm text-gray-500 mt-1">Orders placed through your online cart</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Orders</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{orders?.length || 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Paid</p>
          <p className="text-3xl font-bold text-green-600 mt-2">{paidCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Revenue</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{formatPrice(revenue)}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-50">
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Customer</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Total</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Status</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {(!orders || orders.length === 0) ? (
              <tr>
                <td colSpan={4} className="px-5 py-12 text-center text-sm text-gray-400">
                  No orders yet. Orders appear here when customers check out through your cart widget.
                </td>
              </tr>
            ) : orders.map((o) => (
              <tr key={o.id} className="hover:bg-gray-50/50">
                <td className="px-5 py-3">
                  <span className="text-sm font-medium text-gray-900">{o.customer_name}</span>
                  <span className="block text-xs text-gray-400">{o.customer_email}</span>
                </td>
                <td className="px-5 py-3 text-sm font-semibold text-gray-900">{formatPrice(o.total_cents)}</td>
                <td className="px-5 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor(o.status)}`}>{o.status}</span>
                </td>
                <td className="px-5 py-3 text-xs text-gray-400">{formatDate(o.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

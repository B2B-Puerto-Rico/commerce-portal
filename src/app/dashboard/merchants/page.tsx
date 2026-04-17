import { createServiceClient } from '@/lib/supabase/server';
import { AddMerchantForm } from '@/components/dashboard/AddMerchantForm';

export const dynamic = 'force-dynamic';

export default async function MerchantsPage() {
  const supabase = createServiceClient();

  const { data: merchants } = await supabase
    .from('merchants')
    .select('mid, business_name, cart_enabled, cart_tier, region, environment, last_full_sync_at, site_url, created_at')
    .order('created_at', { ascending: false });

  // Get order counts per merchant
  const { data: orderCounts } = await supabase
    .from('cart_orders')
    .select('mid')
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

  const countMap = new Map<string, number>();
  for (const o of orderCounts || []) {
    countMap.set(o.mid, (countMap.get(o.mid) || 0) + 1);
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Merchants</h1>
          <p className="text-sm text-gray-500 mt-1">
            {merchants?.length || 0} merchant{(merchants?.length || 0) !== 1 ? 's' : ''} connected
          </p>
        </div>
        <AddMerchantForm />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">
                  Merchant
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">
                  Cart
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">
                  Tier
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">
                  Orders (30d)
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">
                  Last Sync
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">
                  Region
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(merchants || []).map((m) => (
                <tr key={m.mid} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-4">
                    <a
                      href={`/dashboard/merchants/${m.mid}`}
                      className="group"
                    >
                      <span className="font-semibold text-sm text-gray-900 group-hover:text-blue-600 transition-colors">
                        {m.business_name}
                      </span>
                      <span className="block text-xs text-gray-400 font-mono mt-0.5">
                        {m.mid}
                      </span>
                    </a>
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
                        m.cart_enabled
                          ? 'bg-green-50 text-green-700'
                          : 'bg-gray-50 text-gray-500'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          m.cart_enabled ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                      />
                      {m.cart_enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-xs font-medium text-gray-600 bg-gray-50 px-2 py-0.5 rounded capitalize">
                      {m.cart_tier}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-sm text-gray-600 font-medium">
                      {countMap.get(m.mid) || 0}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-xs text-gray-400">
                      {m.last_full_sync_at
                        ? new Date(m.last_full_sync_at).toLocaleDateString()
                        : 'Never'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-xs text-gray-400 uppercase">
                      {m.region} / {m.environment}
                    </span>
                  </td>
                </tr>
              ))}

              {(!merchants || merchants.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <p className="text-sm text-gray-400">No merchants yet</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

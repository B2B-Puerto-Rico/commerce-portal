import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function MerchantProductsPage() {
  const supabase = createClient();
  const serviceClient = createServiceClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const mid = user.app_metadata?.mid;
  if (!mid) redirect('/login');

  const { data: products } = await serviceClient
    .from('products')
    .select('*')
    .eq('mid', mid)
    .order('display_order', { ascending: true });

  const { data: categories } = await serviceClient
    .from('categories')
    .select('*')
    .eq('mid', mid)
    .order('sort_order', { ascending: true });

  const visibleCount = products?.filter((p) => !p.hidden_online && !p.hidden_in_clover).length || 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Menu</h1>
        <p className="text-sm text-gray-500 mt-1">
          {products?.length || 0} products &middot; {visibleCount} visible in cart &middot; {categories?.length || 0} categories
        </p>
        <p className="text-xs text-gray-400 mt-2">
          Products sync automatically from your Clover POS. Changes you make in Clover appear here within 15 minutes.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-50">
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Product</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Price</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Status</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Visible in Cart</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {(!products || products.length === 0) ? (
              <tr>
                <td colSpan={4} className="px-5 py-12 text-center text-sm text-gray-400">
                  No products yet. Make sure your Clover account is connected and synced.
                </td>
              </tr>
            ) : products.map((p) => (
              <tr key={p.clover_item_id} className="hover:bg-gray-50/50">
                <td className="px-5 py-3">
                  <span className="font-medium text-sm text-gray-900">{p.name}</span>
                  {p.description ? <span className="block text-xs text-gray-400 mt-0.5 truncate max-w-xs">{p.description}</span> : null}
                </td>
                <td className="px-5 py-3 text-sm font-medium text-gray-700">{formatPrice(p.price_cents)}</td>
                <td className="px-5 py-3">
                  <span className={`text-xs font-medium ${p.in_stock ? 'text-green-600' : 'text-red-500'}`}>
                    {p.in_stock ? 'In stock' : 'Out of stock'}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <span className={`text-xs ${!p.hidden_online && !p.hidden_in_clover ? 'text-green-600' : 'text-gray-400'}`}>
                    {!p.hidden_online && !p.hidden_in_clover ? 'Yes' : 'Hidden'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

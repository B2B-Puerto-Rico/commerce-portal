import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { MerchantDetail } from '@/components/dashboard/MerchantDetail';

export default async function MerchantPage({
  params,
}: {
  params: { mid: string };
}) {
  const supabase = createClient();
  const { mid } = params;

  // Fetch merchant
  const { data: merchant } = await supabase
    .from('merchants')
    .select('*')
    .eq('mid', mid)
    .single();

  if (!merchant) notFound();

  // Fetch products
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('mid', mid)
    .order('display_order', { ascending: true });

  // Fetch orders
  const { data: orders } = await supabase
    .from('cart_orders')
    .select('*')
    .eq('mid', mid)
    .order('created_at', { ascending: false })
    .limit(50);

  // Fetch sync runs
  const { data: syncRuns } = await supabase
    .from('sync_runs')
    .select('*')
    .eq('mid', mid)
    .order('started_at', { ascending: false })
    .limit(20);

  // Fetch categories
  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('mid', mid)
    .order('sort_order', { ascending: true });

  return (
    <MerchantDetail
      merchant={merchant}
      products={products || []}
      orders={orders || []}
      syncRuns={syncRuns || []}
      categories={categories || []}
    />
  );
}

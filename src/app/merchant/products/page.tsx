import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { ProductsTab } from '@/components/dashboard/ProductsTab';

export const dynamic = 'force-dynamic';

export default async function MerchantProductsPage() {
  const supabase = createClient();
  const serviceClient = createServiceClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const mid = user.app_metadata?.mid;
  if (!mid) redirect('/login');

  const { data: merchant } = await serviceClient
    .from('merchants')
    .select('cart_tier, business_name')
    .eq('mid', mid)
    .single();

  const { data: products } = await serviceClient
    .from('products')
    .select('clover_item_id, name, price_cents, description, image_url, sku, in_stock, hidden_online, hidden_in_clover, last_synced_at')
    .eq('mid', mid)
    .order('display_order', { ascending: true });

  const { data: categories } = await serviceClient
    .from('categories')
    .select('clover_category_id, name')
    .eq('mid', mid)
    .order('sort_order', { ascending: true });

  const tier = merchant?.cart_tier || 'free';
  const visibleCount = products?.filter((p) => !p.hidden_online && !p.hidden_in_clover).length || 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-glass-primary">My Menu</h1>
        <p className="text-sm text-glass-secondary mt-1">
          {products?.length || 0} products &middot; {visibleCount} visible in cart &middot; {categories?.length || 0} categories
        </p>
        {tier === 'premium' && (
          <p className="text-xs text-green-600 mt-1 font-medium">
            Premium — You can edit, create, delete products and upload images
          </p>
        )}
        {tier === 'pro' && (
          <p className="text-xs text-blue-600 mt-1 font-medium">
            Pro — You can edit products and upload images
          </p>
        )}
      </div>

      <ProductsTab
        mid={mid}
        tier={tier}
        products={(products || []) as { clover_item_id: string; name: string; price_cents: number; description: string | null; image_url: string | null; sku: string | null; in_stock: boolean; hidden_online: boolean; hidden_in_clover: boolean; last_synced_at: string | null }[]}
        categories={(categories || []) as { clover_category_id: string; name: string }[]}
      />
    </div>
  );
}

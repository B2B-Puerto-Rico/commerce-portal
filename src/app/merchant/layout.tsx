import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import { MerchantSidebar } from '@/components/merchant/MerchantSidebar';
import { Header } from '@/components/dashboard/Header';
import { MerchantMobileNav } from '@/components/dashboard/MobileNav';

export default async function MerchantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const serviceClient = createServiceClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const mid = user.app_metadata?.mid;
  if (!mid) redirect('/login');

  const { data: merchant } = await serviceClient
    .from('merchants')
    .select('business_name')
    .eq('mid', mid)
    .single();

  return (
    <div className="min-h-screen bg-gray-50">
      <MerchantSidebar businessName={merchant?.business_name || 'My Store'} />
      <div className="md:pl-[240px] flex flex-col min-h-screen">
        <Header email={user.email} />
        <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6">{children}</main>
      </div>
      <MerchantMobileNav />
    </div>
  );
}

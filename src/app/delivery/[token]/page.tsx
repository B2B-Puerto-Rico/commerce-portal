import { createServiceClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function DeliveryStatusPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { action?: string };
}) {
  const supabase = createServiceClient();
  const { token } = params;
  const action = searchParams.action;

  // Find the assignment by token (stored in driver_notes)
  const { data: assignment } = await supabase
    .from('driver_assignments')
    .select('*, drivers(full_name), cart_orders(customer_name, total_cents, tip_cents, delivery_address, ship_to)')
    .eq('driver_notes', token)
    .single();

  if (!assignment) {
    return (
      <div className="min-h-screen bg-glass-neutral flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-glass-primary">Invalid Link</h1>
          <p className="text-glass-secondary mt-2">This delivery link is invalid or has expired.</p>
        </div>
      </div>
    );
  }

  // Process "delivered" action — single step, no pickup needed
  if (action === 'delivered' && assignment.status !== 'delivered') {
    const deliveryMins = assignment.assigned_at
      ? Math.round((Date.now() - new Date(assignment.assigned_at).getTime()) / 60000)
      : null;
    await supabase.from('driver_assignments')
      .update({ status: 'delivered', delivered_at: new Date().toISOString(), delivery_mins: deliveryMins })
      .eq('id', assignment.id);
    await supabase.from('cart_orders')
      .update({ delivery_status: 'delivered' })
      .eq('id', assignment.order_id);
    redirect(`/delivery/${token}?done=1`);
  }

  // Status page - no action needed, just display
  const order = assignment.cart_orders as Record<string, unknown> | null;
  const driver = assignment.drivers as Record<string, unknown> | null;
  const shipTo = order?.ship_to as Record<string, string> | null;
  const address = (order?.delivery_address as string) || (shipTo ? `${shipTo.address1}, ${shipTo.city} ${shipTo.zip}` : 'See order');

  const statusColors: Record<string, string> = {
    assigned: 'bg-blue-100 text-blue-800',
    picked_up: 'bg-amber-100 text-amber-800',
    en_route: 'bg-purple-100 text-purple-800',
    delivered: 'bg-green-100 text-green-800',
  };

  return (
    <div className="min-h-screen bg-glass-neutral flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-glass-surface rounded-2xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5 text-center text-white">
            <p className="text-blue-200 text-xs font-semibold uppercase tracking-wider">Delivery Assignment</p>
            <h1 className="text-lg font-bold mt-1">Order #{assignment.order_id.slice(0, 8).toUpperCase()}</h1>
            <p className="text-blue-200 text-sm mt-1">Driver: {(driver?.full_name as string) || 'Unknown'}</p>
          </div>

          <div className="p-6 space-y-4">
            {/* Status badge */}
            <div className="text-center">
              <span className={`inline-block px-4 py-1.5 rounded-full text-sm font-bold ${statusColors[assignment.status] || 'bg-gray-100 text-glass-secondary'}`}>
                {assignment.status === 'assigned' ? 'Assigned — Waiting for Pickup' :
                 assignment.status === 'picked_up' ? 'Picked Up — On the Way' :
                 assignment.status === 'delivered' ? 'Delivered!' :
                 assignment.status}
              </span>
            </div>

            {/* Delivery address */}
            <div className="bg-glass-neutral rounded-xl p-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Deliver To</p>
              <p className="text-sm font-semibold text-glass-primary">{(order?.customer_name as string) || 'Customer'}</p>
              <p className="text-sm text-glass-secondary mt-0.5">{address}</p>
            </div>

            {/* Order total */}
            <div className="flex justify-between items-center">
              <span className="text-sm text-glass-secondary">Order Total</span>
              <span className="text-lg font-bold text-glass-primary">${((order?.total_cents as number || 0) / 100).toFixed(2)}</span>
            </div>
            {(order?.tip_cents as number) > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-green-600 font-medium">Your Tip</span>
                <span className="text-lg font-bold text-green-600">${((order?.tip_cents as number) / 100).toFixed(2)}</span>
              </div>
            )}

            {/* Action button — single "Mark as Delivered" */}
            <div className="space-y-2 pt-2">
              {assignment.status !== 'delivered' && (
                <a href={`/delivery/${token}?action=delivered`}
                  className="block w-full text-center bg-green-600 hover:bg-green-700 text-white py-4 rounded-[10px] font-bold text-base transition-colors shadow-lg">
                  Mark as Delivered
                </a>
              )}
              {assignment.status === 'delivered' && (
                <div className="text-center py-4">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-green-700">Delivery Complete!</p>
                  <p className="text-xs text-gray-400 mt-1">Thank you for the delivery.</p>
                  {assignment.delivery_mins && (
                    <p className="text-xs text-glass-secondary mt-2">Delivered in {assignment.delivery_mins} minutes</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

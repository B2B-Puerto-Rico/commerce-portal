import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const supabase = createServiceClient();
  const { searchParams } = new URL(request.url);
  const mid = searchParams.get('mid');
  const driverId = searchParams.get('driver_id');

  if (!mid) return NextResponse.json({ error: 'mid required' }, { status: 400 });

  // Get all assignments with order details
  let query = supabase
    .from('driver_assignments')
    .select('*, drivers(full_name, email, phone, pay_type, pay_rate_cents), cart_orders(customer_name, total_cents, tip_cents, delivery_address, ship_to, created_at, fulfillment_type)')
    .eq('mid', mid)
    .order('created_at', { ascending: false });

  if (driverId) {
    query = query.eq('driver_id', driverId);
  }

  const { data: assignments } = await query;

  if (!assignments) return NextResponse.json({ assignments: [], stats: {} });

  // Compute per-driver stats
  const driverStats = new Map<string, {
    driver_id: string;
    name: string;
    total_deliveries: number;
    completed_deliveries: number;
    total_tips_cents: number;
    total_earnings_cents: number;
    avg_delivery_mins: number;
    deliveries: Record<string, unknown>[];
  }>();

  for (const a of assignments) {
    const driver = a.drivers as Record<string, unknown>;
    const order = a.cart_orders as Record<string, unknown>;
    const did = a.driver_id as string;

    if (!driverStats.has(did)) {
      driverStats.set(did, {
        driver_id: did,
        name: (driver?.full_name as string) || 'Unknown',
        total_deliveries: 0,
        completed_deliveries: 0,
        total_tips_cents: 0,
        total_earnings_cents: 0,
        avg_delivery_mins: 0,
        deliveries: [],
      });
    }

    const stats = driverStats.get(did)!;
    stats.total_deliveries++;

    if (a.status === 'delivered') {
      stats.completed_deliveries++;
      const tipCents = (order?.tip_cents as number) || 0;
      stats.total_tips_cents += tipCents;
      const payRate = (driver?.pay_rate_cents as number) || 0;
      stats.total_earnings_cents += payRate + tipCents;
    }

    // Track delivery time
    if (a.delivery_mins) {
      const currentAvg = stats.avg_delivery_mins;
      const count = stats.completed_deliveries;
      stats.avg_delivery_mins = count > 0
        ? Math.round(((currentAvg * (count - 1)) + a.delivery_mins) / count)
        : a.delivery_mins;
    }

    // Add to delivery history
    const shipTo = order?.ship_to as Record<string, string> | null;
    stats.deliveries.push({
      assignment_id: a.id,
      order_id: a.order_id,
      status: a.status,
      customer_name: order?.customer_name,
      total_cents: order?.total_cents,
      tip_cents: order?.tip_cents,
      address: (order?.delivery_address as string) || (shipTo ? `${shipTo.address1}, ${shipTo.city}` : ''),
      assigned_at: a.assigned_at,
      delivered_at: a.delivered_at,
      delivery_mins: a.delivery_mins,
    });
  }

  return NextResponse.json({
    drivers: Array.from(driverStats.values()),
  });
}

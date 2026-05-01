import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import crypto from 'crypto';

export async function POST(request: Request) {
  const supabase = createServiceClient();
  const { order_id, driver_id, mid } = await request.json();

  if (!order_id || !driver_id || !mid) {
    return NextResponse.json({ error: 'order_id, driver_id, and mid required' }, { status: 400 });
  }

  // Get driver details
  const { data: driver } = await supabase
    .from('drivers')
    .select('*')
    .eq('id', driver_id)
    .eq('mid', mid)
    .single();

  if (!driver) return NextResponse.json({ error: 'Driver not found' }, { status: 404 });

  // Get order details
  const { data: order } = await supabase
    .from('cart_orders')
    .select('*')
    .eq('id', order_id)
    .eq('mid', mid)
    .single();

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  // Get merchant name
  const { data: merchant } = await supabase
    .from('merchants')
    .select('business_name')
    .eq('mid', mid)
    .single();

  // Generate a unique token for driver status updates (no login needed)
  const actionToken = crypto.randomUUID();

  // Create or update driver assignment
  const { data: existing } = await supabase
    .from('driver_assignments')
    .select('id')
    .eq('order_id', order_id)
    .single();

  if (existing) {
    await supabase.from('driver_assignments')
      .update({ driver_id, status: 'assigned', assigned_at: new Date().toISOString() })
      .eq('id', existing.id);
  } else {
    await supabase.from('driver_assignments').insert({
      mid, order_id, driver_id, status: 'assigned',
    });
  }

  // Update order with driver info
  await supabase.from('cart_orders').update({
    assigned_driver_id: driver_id,
    delivery_status: 'assigned',
  }).eq('id', order_id);

  // Store action token on driver assignment for status updates
  await supabase.from('driver_assignments')
    .update({ driver_notes: actionToken })
    .eq('order_id', order_id);

  // Send email to driver with order details + action buttons
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey && driver.email) {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://commerce-portal.b2bweb.app';
    const deliveryAddress = order.delivery_address || (order.ship_to ? `${(order.ship_to as Record<string, string>).address1}, ${(order.ship_to as Record<string, string>).city} ${(order.ship_to as Record<string, string>).zip}` : 'See order details');
    const lineItems = (order.line_items as { name: string; quantity: number; price_cents: number }[]) || [];
    const itemsList = lineItems.map((i) => `${i.quantity}x ${i.name}`).join(', ');

    const pickedUpUrl = `${baseUrl}/delivery/${actionToken}?action=picked_up`;
    const deliveredUrl = `${baseUrl}/delivery/${actionToken}?action=delivered`;

    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'B2B Commerce <orders@b2bweb.app>',
          to: driver.email,
          subject: `New Delivery Assignment — Order #${order_id.slice(0, 8).toUpperCase()}`,
          html: `
            <div style="font-family:-apple-system,sans-serif;max-width:500px;margin:0 auto;padding:32px 16px">
              <div style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
                <div style="background:#3B82F6;padding:24px;text-align:center">
                  <h1 style="margin:0;color:#fff;font-size:20px">New Delivery!</h1>
                  <p style="margin:4px 0 0;color:#BFDBFE;font-size:13px">${merchant?.business_name || 'Restaurant'}</p>
                </div>
                <div style="padding:24px">
                  <p style="font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 4px">Order #${order_id.slice(0, 8).toUpperCase()}</p>
                  <p style="font-size:14px;color:#111827;font-weight:600;margin:0 0 4px">${order.customer_name || 'Customer'}</p>
                  <p style="font-size:13px;color:#6b7280;margin:0 0 16px">${order.customer_phone || ''}</p>

                  <div style="background:#F3F4F6;border-radius:12px;padding:16px;margin-bottom:16px">
                    <p style="font-size:11px;color:#9ca3af;text-transform:uppercase;margin:0 0 4px;font-weight:600">Deliver To</p>
                    <p style="font-size:14px;color:#111827;font-weight:600;margin:0">${deliveryAddress}</p>
                  </div>

                  <p style="font-size:12px;color:#6b7280;margin:0 0 4px"><strong>Items:</strong> ${itemsList}</p>
                  <p style="font-size:14px;color:#111827;font-weight:700;margin:8px 0 0">Total: $${(order.total_cents / 100).toFixed(2)}</p>
                  ${order.tip_cents > 0 ? `<p style="font-size:13px;color:#059669;font-weight:600;margin:4px 0 0">Tip: $${(order.tip_cents / 100).toFixed(2)}</p>` : ''}

                  <div style="margin-top:24px;text-align:center">
                    <p style="font-size:12px;color:#9ca3af;margin:0 0 12px">Update delivery status:</p>
                    <a href="${pickedUpUrl}" style="display:inline-block;background:#F59E0B;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin:0 4px">Picked Up</a>
                    <a href="${deliveredUrl}" style="display:inline-block;background:#10B981;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin:0 4px">Delivered</a>
                  </div>
                </div>
              </div>
            </div>
          `,
        }),
      });
    } catch (e) {
      console.error('[AssignDriver] Email failed:', e);
    }
  }

  return NextResponse.json({
    success: true,
    driver_name: driver.full_name,
    driver_email: driver.email,
  });
}

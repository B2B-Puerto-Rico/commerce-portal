import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import crypto from 'crypto';

// GET: List drivers for a merchant
export async function GET(request: Request) {
  const supabase = createServiceClient();
  const { searchParams } = new URL(request.url);
  const mid = searchParams.get('mid');

  if (!mid) return NextResponse.json({ error: 'mid required' }, { status: 400 });

  const { data } = await supabase
    .from('drivers')
    .select('*')
    .eq('mid', mid)
    .order('created_at', { ascending: false });

  return NextResponse.json(data || []);
}

// POST: Create or update a driver
export async function POST(request: Request) {
  const supabase = createServiceClient();
  const body = await request.json();
  const { mid, id, full_name, email, phone, pay_type, pay_rate_cents, zone_ids, status: driverStatus } = body;

  if (!mid) return NextResponse.json({ error: 'mid required' }, { status: 400 });

  if (id) {
    // Update existing driver
    const updates: Record<string, unknown> = {};
    if (full_name !== undefined) updates.full_name = full_name;
    if (email !== undefined) updates.email = email;
    if (phone !== undefined) updates.phone = phone;
    if (pay_type !== undefined) updates.pay_type = pay_type;
    if (pay_rate_cents !== undefined) updates.pay_rate_cents = pay_rate_cents;
    if (zone_ids !== undefined) updates.zone_ids = zone_ids;
    if (driverStatus !== undefined) updates.status = driverStatus;

    const { error } = await supabase
      .from('drivers')
      .update(updates)
      .eq('id', id)
      .eq('mid', mid);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // Create new driver
  if (!full_name || !email || !phone) {
    return NextResponse.json({ error: 'full_name, email, and phone are required' }, { status: 400 });
  }

  const verificationToken = crypto.randomUUID();

  const { data: driver, error } = await supabase
    .from('drivers')
    .insert({
      mid,
      full_name,
      email,
      phone,
      pay_type: pay_type || 'per_delivery',
      pay_rate_cents: pay_rate_cents || 0,
      zone_ids: zone_ids || [],
      verification_token: verificationToken,
      status: 'pending',
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A driver with this email already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Send verification email via Resend (if configured)
  // The cart app has Resend — call it via API or send directly
  try {
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const { data: merchant } = await supabase
        .from('merchants')
        .select('business_name')
        .eq('mid', mid)
        .single();

      const verifyUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://commerce-portal.b2bweb.app'}/api/merchants/drivers/verify?token=${verificationToken}`;

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'B2B Commerce <orders@b2bweb.app>',
          to: email,
          subject: `Welcome to ${merchant?.business_name || 'the team'} — Verify your driver account`,
          html: `
            <div style="font-family:-apple-system,sans-serif;max-width:500px;margin:0 auto;padding:32px">
              <h2>Welcome, ${full_name}!</h2>
              <p>You've been added as a delivery driver for <strong>${merchant?.business_name || 'the restaurant'}</strong>.</p>
              <p>Please verify your email to activate your account:</p>
              <a href="${verifyUrl}" style="display:inline-block;background:#111827;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Verify Email</a>
              <p style="color:#9ca3af;font-size:12px;margin-top:24px">If you didn't expect this, you can ignore this email.</p>
            </div>
          `,
        }),
      });
    }
  } catch (e) {
    console.error('[Drivers] Failed to send verification email:', e);
  }

  return NextResponse.json({ success: true, driver_id: driver?.id });
}

// DELETE: Remove a driver
export async function DELETE(request: Request) {
  const supabase = createServiceClient();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const mid = searchParams.get('mid');

  if (!id || !mid) return NextResponse.json({ error: 'id and mid required' }, { status: 400 });

  const { error } = await supabase
    .from('drivers')
    .delete()
    .eq('id', id)
    .eq('mid', mid);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = createServiceClient();
  const { mid, email, name } = await request.json();

  if (!mid || !email) {
    return NextResponse.json(
      { error: 'mid and email are required' },
      { status: 400 }
    );
  }

  // Verify merchant exists
  const { data: merchant } = await supabase
    .from('merchants')
    .select('mid, business_name')
    .eq('mid', mid)
    .single();

  if (!merchant) {
    return NextResponse.json(
      { error: 'Merchant not found' },
      { status: 404 }
    );
  }

  // Generate a temp password
  const tempPassword = `M${mid.slice(0, 4)}${Date.now().toString(36).slice(-4)}!`;

  // Create Supabase Auth user with merchant role
  const { data: user, error: authErr } = await supabase.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    app_metadata: {
      role: 'merchant',
      mid: mid,
    },
    user_metadata: {
      name: name || merchant.business_name,
      business_name: merchant.business_name,
    },
  });

  if (authErr) {
    return NextResponse.json(
      { error: authErr.message },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    user_id: user.user.id,
    email,
    temp_password: tempPassword,
    business_name: merchant.business_name,
  });
}

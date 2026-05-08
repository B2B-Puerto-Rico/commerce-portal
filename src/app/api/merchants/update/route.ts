import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = createServiceClient();
  const body = await request.json();
  const { mid, ...updates } = body;

  if (!mid) {
    return NextResponse.json({ error: 'mid is required' }, { status: 400 });
  }

  // Only allow specific fields to be updated
  const allowed = [
    'business_name', 'site_url', 'github_repo', 'cart_tier',
    'cart_enabled', 'theme', 'shipping_config', 'tax_config',
    'dual_pricing_enabled', 'card_surcharge_pct', 'allow_cash_on_fulfillment', 'dual_pricing_label',
  ];
  const safeUpdates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in updates) {
      safeUpdates[key] = updates[key];
    }
  }

  if (Object.keys(safeUpdates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  // For theme updates, merge with existing theme to preserve synced fields like businessHours
  if (safeUpdates.theme) {
    const { data: existing } = await supabase
      .from('merchants')
      .select('theme')
      .eq('mid', mid)
      .single();

    const existingTheme = (existing?.theme as Record<string, unknown>) || {};
    safeUpdates.theme = { ...existingTheme, ...(safeUpdates.theme as Record<string, unknown>) };
  }

  const { error } = await supabase
    .from('merchants')
    .update(safeUpdates)
    .eq('mid', mid);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

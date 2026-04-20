import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = createServiceClient();
  const body = await request.json();

  const { mid, business_name, region, environment, company } = body;

  if (!mid || !business_name) {
    return NextResponse.json(
      { error: 'mid and business_name are required' },
      { status: 400 }
    );
  }

  const { error } = await supabase.from('merchants').upsert({
    mid,
    business_name,
    region: region || 'na',
    environment: environment || 'production',
    company: company || 'b2b',
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, mid });
}

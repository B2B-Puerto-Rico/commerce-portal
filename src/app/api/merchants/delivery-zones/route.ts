import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// GET: List zones for a merchant
export async function GET(request: Request) {
  const supabase = createServiceClient();
  const { searchParams } = new URL(request.url);
  const mid = searchParams.get('mid');

  if (!mid) return NextResponse.json({ error: 'mid required' }, { status: 400 });

  const { data } = await supabase
    .from('delivery_zones')
    .select('*')
    .eq('mid', mid)
    .order('sort_order', { ascending: true });

  return NextResponse.json(data || []);
}

// POST: Create or update a zone
export async function POST(request: Request) {
  const supabase = createServiceClient();
  const body = await request.json();
  const { mid, id, name, zip_codes, color } = body;

  if (!mid || !name) return NextResponse.json({ error: 'mid and name required' }, { status: 400 });

  if (id) {
    // Update
    const { error } = await supabase
      .from('delivery_zones')
      .update({ name, zip_codes: zip_codes || [], color: color || '#3B82F6' })
      .eq('id', id)
      .eq('mid', mid);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    // Create
    const { error } = await supabase
      .from('delivery_zones')
      .insert({ mid, name, zip_codes: zip_codes || [], color: color || '#3B82F6' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// DELETE
export async function DELETE(request: Request) {
  const supabase = createServiceClient();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const mid = searchParams.get('mid');

  if (!id || !mid) return NextResponse.json({ error: 'id and mid required' }, { status: 400 });

  const { error } = await supabase
    .from('delivery_zones')
    .delete()
    .eq('id', id)
    .eq('mid', mid);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

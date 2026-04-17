import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = createServiceClient();

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const mid = formData.get('mid') as string;
  const cloverItemId = formData.get('clover_item_id') as string;

  if (!file || !mid || !cloverItemId) {
    return NextResponse.json(
      { error: 'file, mid, and clover_item_id are required' },
      { status: 400 }
    );
  }

  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      { error: 'Only JPEG, PNG, WebP, and GIF images are allowed' },
      { status: 400 }
    );
  }

  // Max 5MB
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'Image must be under 5MB' }, { status: 400 });
  }

  // Generate storage path: {mid}/{clover_item_id}_{timestamp}.{ext}
  const ext = file.name.split('.').pop() || 'jpg';
  const storagePath = `${mid}/${cloverItemId}_${Date.now()}.${ext}`;

  // Upload to Supabase Storage
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadErr } = await supabase.storage
    .from('product-images')
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadErr) {
    return NextResponse.json(
      { error: `Upload failed: ${uploadErr.message}` },
      { status: 500 }
    );
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('product-images')
    .getPublicUrl(storagePath);

  const imageUrl = urlData.publicUrl;

  // Update product with image URL
  const { error: updateErr } = await supabase
    .from('products')
    .update({ image_url: imageUrl })
    .eq('mid', mid)
    .eq('clover_item_id', cloverItemId);

  if (updateErr) {
    return NextResponse.json(
      { error: `Failed to save URL: ${updateErr.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, image_url: imageUrl });
}

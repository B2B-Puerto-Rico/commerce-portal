import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = createServiceClient();
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const mid = formData.get('mid') as string;

  if (!file || !mid) {
    return NextResponse.json({ error: 'file and mid required' }, { status: 400 });
  }

  const ext = file.name.split('.').pop() || 'jpg';
  const storagePath = `${mid}/banner_${Date.now()}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadErr } = await supabase.storage
    .from('product-images')
    .upload(storagePath, buffer, { contentType: file.type, upsert: true });

  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(storagePath);
  const bannerUrl = urlData.publicUrl;

  // Save banner URL in theme JSON
  const { data: merchant } = await supabase.from('merchants').select('theme').eq('mid', mid).single();
  const theme = (merchant?.theme as Record<string, string>) || {};
  theme.bannerUrl = bannerUrl;

  await supabase.from('merchants').update({ theme }).eq('mid', mid);

  return NextResponse.json({ success: true, banner_url: bannerUrl });
}

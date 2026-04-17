import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

const MODELS: Record<string, string> = {
  'imagen-4-ultra': 'google/imagen-4-ultra',
  'seedream-4.5': 'bytedance/seedream-4.5',
  'flux-2-pro': 'black-forest-labs/flux-2-pro',
  'flux-2-flex': 'black-forest-labs/flux-2-flex',
  'flux-2-max': 'black-forest-labs/flux-2-max',
  'nano-banana-2': 'google/nano-banana-2',
};

export async function POST(request: Request) {
  const supabase = createServiceClient();
  const { mid, clover_item_id, product_name, model } = await request.json();

  if (!mid || !product_name) {
    return NextResponse.json({ error: 'mid and product_name required' }, { status: 400 });
  }

  const apiToken = process.env.REPLICATE_API_TOKEN;
  if (!apiToken) {
    return NextResponse.json({ error: 'Replicate not configured' }, { status: 500 });
  }

  const modelId = MODELS[model] || MODELS['flux-2-pro'];

  // Professional food photography prompt
  const prompt = `Professional food photography of ${product_name}, appetizing presentation on a clean plate, restaurant quality, soft natural lighting, shallow depth of field, top-down angle, warm tones, high resolution, commercial food photography style, no text, no watermark`;

  try {
    // Create prediction using the model-specific endpoint
    const createRes = await fetch(`https://api.replicate.com/v1/models/${modelId}/predictions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        Prefer: 'wait',
      },
      body: JSON.stringify({
        input: {
          prompt,
          aspect_ratio: '1:1',
        },
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.text();
      return NextResponse.json({ error: `Replicate error: ${err}` }, { status: 502 });
    }

    let result = await createRes.json();

    // If Prefer: wait didn't complete, poll
    if (result.status !== 'succeeded' && result.status !== 'failed') {
      const startTime = Date.now();
      while (result.status !== 'succeeded' && result.status !== 'failed') {
        if (Date.now() - startTime > 120000) {
          return NextResponse.json({ error: 'Image generation timed out' }, { status: 504 });
        }
        await new Promise((r) => setTimeout(r, 2000));
        const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${result.id}`, {
          headers: { Authorization: `Bearer ${apiToken}` },
        });
        result = await pollRes.json();
      }
    }

    if (result.status === 'failed') {
      return NextResponse.json({ error: result.error || 'Image generation failed' }, { status: 502 });
    }

    // Get the image URL from Replicate
    const imageUrl = Array.isArray(result.output) ? result.output[0] : result.output;
    if (!imageUrl) {
      return NextResponse.json({ error: 'No image generated' }, { status: 502 });
    }

    // Download the image and upload to our Supabase Storage
    const imageRes = await fetch(imageUrl);
    const imageBuffer = Buffer.from(await imageRes.arrayBuffer());
    const storagePath = `${mid}/${clover_item_id || 'gen'}_ai_${Date.now()}.png`;

    const { error: uploadErr } = await supabase.storage
      .from('product-images')
      .upload(storagePath, imageBuffer, { contentType: 'image/png', upsert: true });

    if (uploadErr) {
      return NextResponse.json({ error: uploadErr.message }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(storagePath);
    const finalUrl = urlData.publicUrl;

    // Update product if clover_item_id provided
    if (clover_item_id) {
      await supabase
        .from('products')
        .update({ image_url: finalUrl })
        .eq('mid', mid)
        .eq('clover_item_id', clover_item_id);
    }

    return NextResponse.json({
      success: true,
      image_url: finalUrl,
      model: model || 'flux',
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

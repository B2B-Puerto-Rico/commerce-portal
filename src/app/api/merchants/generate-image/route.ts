import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

const MODELS = {
  flux: 'black-forest-labs/flux-1.1-pro',
  sdxl: 'stability-ai/sdxl',
  playground: 'playgroundai/playground-v2.5-1024px-aesthetic',
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

  const modelId = MODELS[model as keyof typeof MODELS] || MODELS.flux;

  // Professional food photography prompt
  const prompt = `Professional food photography of ${product_name}, appetizing presentation on a clean plate, restaurant quality, soft natural lighting, shallow depth of field, top-down angle, warm tones, high resolution, commercial food photography style, no text, no watermark`;

  try {
    // Create prediction
    const createRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelId,
        input: {
          prompt,
          width: 1024,
          height: 1024,
          num_outputs: 1,
        },
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.text();
      return NextResponse.json({ error: `Replicate error: ${err}` }, { status: 502 });
    }

    const prediction = await createRes.json();

    // Poll for completion (max 60 seconds)
    let result = prediction;
    const startTime = Date.now();
    while (result.status !== 'succeeded' && result.status !== 'failed') {
      if (Date.now() - startTime > 60000) {
        return NextResponse.json({ error: 'Image generation timed out' }, { status: 504 });
      }
      await new Promise((r) => setTimeout(r, 2000));

      const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${result.id}`, {
        headers: { Authorization: `Bearer ${apiToken}` },
      });
      result = await pollRes.json();
    }

    if (result.status === 'failed') {
      return NextResponse.json({ error: 'Image generation failed' }, { status: 502 });
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

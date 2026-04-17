import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = createServiceClient();
  const body = await request.json();
  const { mid } = body;

  if (!mid) {
    return NextResponse.json({ error: 'mid is required' }, { status: 400 });
  }

  // Get decrypted credentials
  const { data: creds, error: credErr } = await supabase
    .rpc('get_merchant_credentials' as never, { merchant_mid: mid } as never)
    .single();

  if (credErr || !creds) {
    return NextResponse.json(
      { error: `Failed to get credentials: ${credErr?.message || 'not found'}` },
      { status: 400 }
    );
  }

  const credentials = creds as unknown as {
    mid: string;
    business_name: string;
    region: string;
    environment: string;
    access_token: string;
    refresh_token: string;
    token_expires_at: string | null;
    ecommerce_pakms: string | null;
    ecommerce_sk: string | null;
  };

  if (!credentials.access_token) {
    return NextResponse.json(
      { error: 'No Clover access token configured. Connect Clover first.' },
      { status: 400 }
    );
  }

  // Run sync inline (for admin-triggered sync, we do it synchronously)
  // This calls the Clover API and upserts into Supabase
  try {
    const endpoints = getCloverEndpoints(credentials.region, credentials.environment);
    const baseUrl = endpoints.api;

    // Create sync_runs row
    const { data: syncRun } = await supabase
      .from('sync_runs')
      .insert({ mid, trigger: 'manual', scope: 'full', status: 'running' })
      .select('id')
      .single();

    const syncRunId = syncRun?.id;
    let itemsSynced = 0;
    const errors: { step: string; message: string }[] = [];

    // Helper: fetch from Clover with auth
    const cloverGet = async (path: string) => {
      const url = `${baseUrl}/v3/merchants/${mid}${path}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${credentials.access_token}`,
          Accept: 'application/json',
        },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Clover API ${res.status}: ${text}`);
      }
      return res.json();
    };

    // Helper: paginate
    const paginate = async (path: string, params = '') => {
      const all: unknown[] = [];
      let offset = 0;
      const limit = 1000;
      while (true) {
        const sep = params ? '&' : '?';
        const url = `${path}?limit=${limit}&offset=${offset}${params ? sep + params : ''}`;
        const data = await cloverGet(url);
        const batch = data.elements || [];
        if (batch.length === 0) break;
        all.push(...batch);
        offset += batch.length;
        if (batch.length < limit) break;
      }
      return all;
    };

    // Step 1: Tax rates
    try {
      const taxRates = await paginate('/tax_rates') as { id: string; name: string; rate?: number; taxAmount?: number; isDefault?: boolean }[];
      if (taxRates.length > 0) {
        const rows = taxRates.map((tr) => ({
          mid,
          clover_tr_id: tr.id,
          name: tr.name,
          rate_millionths: tr.rate ?? null,
          tax_amount_cents: tr.taxAmount ?? null,
          is_default: tr.isDefault ?? false,
          last_synced_at: new Date().toISOString(),
        }));
        const { error } = await supabase.from('tax_rates').upsert(rows, { onConflict: 'mid,clover_tr_id' });
        if (error) errors.push({ step: 'tax_rates', message: error.message });
        else itemsSynced += taxRates.length;
      }
    } catch (e) {
      errors.push({ step: 'tax_rates', message: e instanceof Error ? e.message : String(e) });
    }

    // Step 2: Categories
    try {
      const categories = await paginate('/categories', 'orderBy=sortOrder+ASC') as { id: string; name: string; sortOrder?: number }[];
      if (categories.length > 0) {
        const rows = categories.map((c) => ({
          mid,
          clover_category_id: c.id,
          name: c.name,
          sort_order: c.sortOrder ?? 0,
          last_synced_at: new Date().toISOString(),
        }));
        const { error } = await supabase.from('categories').upsert(rows, { onConflict: 'mid,clover_category_id' });
        if (error) errors.push({ step: 'categories', message: error.message });
        else itemsSynced += categories.length;
      }
    } catch (e) {
      errors.push({ step: 'categories', message: e instanceof Error ? e.message : String(e) });
    }

    // Step 3: Modifier groups + modifiers
    try {
      const groups = await paginate('/modifier_groups', 'expand=modifiers') as {
        id: string; name: string; minRequired?: number; maxAllowed?: number;
        showByDefault?: boolean; sortOrder?: number;
        modifiers?: { elements: { id: string; name: string; price?: number; available?: boolean }[] };
      }[];

      if (groups.length > 0) {
        const mgRows = groups.map((mg) => ({
          mid,
          clover_mg_id: mg.id,
          name: mg.name,
          min_required: mg.minRequired ?? 0,
          max_allowed: mg.maxAllowed ?? 1,
          show_by_default: mg.showByDefault ?? false,
          sort_order: mg.sortOrder ?? 0,
          last_synced_at: new Date().toISOString(),
        }));
        const { error } = await supabase.from('modifier_groups').upsert(mgRows, { onConflict: 'mid,clover_mg_id' });
        if (error) errors.push({ step: 'modifier_groups', message: error.message });
        else itemsSynced += groups.length;

        // Modifiers
        const allMods = groups.flatMap((mg) =>
          (mg.modifiers?.elements || []).map((mod) => ({
            mid,
            clover_modifier_id: mod.id,
            clover_mg_id: mg.id,
            name: mod.name,
            price_cents: mod.price ?? 0,
            available: mod.available ?? true,
            last_synced_at: new Date().toISOString(),
          }))
        );
        if (allMods.length > 0) {
          const { error: modErr } = await supabase.from('modifiers').upsert(allMods, { onConflict: 'mid,clover_modifier_id' });
          if (modErr) errors.push({ step: 'modifiers', message: modErr.message });
          else itemsSynced += allMods.length;
        }
      }
    } catch (e) {
      errors.push({ step: 'modifier_groups', message: e instanceof Error ? e.message : String(e) });
    }

    // Step 4: Items
    try {
      const items = await paginate('/items', 'expand=categories,modifierGroups,taxRates&orderBy=modifiedTime+ASC') as {
        id: string; name: string; price?: number; priceType?: string;
        sku?: string; code?: string; hidden?: boolean; available?: boolean;
        defaultTaxRates?: boolean;
        categories?: { elements: { id: string }[] };
        modifierGroups?: { elements: { id: string }[] };
        taxRates?: { elements: { id: string }[] };
        itemStock?: { quantity: number; stockCount: number };
      }[];

      if (items.length > 0) {
        const rows = items.map((item) => ({
          mid,
          clover_item_id: item.id,
          name: item.name,
          price_cents: item.price ?? 0,
          price_type: item.priceType ?? 'FIXED',
          sku: item.sku ?? null,
          code: item.code ?? null,
          category_ids: (item.categories?.elements || []).map((c) => c.id),
          modifier_group_ids: (item.modifierGroups?.elements || []).map((mg) => mg.id),
          tax_rate_ids: (item.taxRates?.elements || []).map((tr) => tr.id),
          default_tax_rates: item.defaultTaxRates ?? true,
          in_stock: item.available ?? true,
          stock_count: item.itemStock?.stockCount ?? null,
          hidden_in_clover: item.hidden ?? false,
          display_order: 0,
          last_synced_at: new Date().toISOString(),
        }));

        // Batch upsert (500 at a time)
        for (let i = 0; i < rows.length; i += 500) {
          const batch = rows.slice(i, i + 500);
          const { error } = await supabase.from('products').upsert(batch, { onConflict: 'mid,clover_item_id' });
          if (error) errors.push({ step: 'items', message: `Batch ${i}: ${error.message}` });
          else itemsSynced += batch.length;
        }
      }
    } catch (e) {
      errors.push({ step: 'items', message: e instanceof Error ? e.message : String(e) });
    }

    // Step 5: Reconcile — remove items/categories from Supabase that no longer exist in Clover
    try {
      // Get all Clover item IDs we just synced
      const cloverItemIds = await paginate('/items', 'fields=id');
      const cloverIds = new Set((cloverItemIds as { id: string }[]).map((i) => i.id));

      // Get all Supabase product IDs for this merchant
      const { data: supaProducts } = await supabase
        .from('products')
        .select('clover_item_id')
        .eq('mid', mid);

      // Delete products that exist in Supabase but not in Clover
      const staleIds = (supaProducts || [])
        .filter((p) => !cloverIds.has(p.clover_item_id))
        .map((p) => p.clover_item_id);

      if (staleIds.length > 0) {
        await supabase
          .from('products')
          .delete()
          .eq('mid', mid)
          .in('clover_item_id', staleIds);
        console.info(`[Sync:${mid}] Removed ${staleIds.length} stale products`);
      }

      // Same for categories
      const cloverCatIds = await paginate('/categories', 'fields=id');
      const cloverCatSet = new Set((cloverCatIds as { id: string }[]).map((c) => c.id));

      const { data: supaCats } = await supabase
        .from('categories')
        .select('clover_category_id')
        .eq('mid', mid);

      const staleCatIds = (supaCats || [])
        .filter((c) => !cloverCatSet.has(c.clover_category_id))
        .map((c) => c.clover_category_id);

      if (staleCatIds.length > 0) {
        await supabase
          .from('categories')
          .delete()
          .eq('mid', mid)
          .in('clover_category_id', staleCatIds);
        console.info(`[Sync:${mid}] Removed ${staleCatIds.length} stale categories`);
      }
    } catch (e) {
      errors.push({ step: 'reconcile', message: e instanceof Error ? e.message : String(e) });
    }

    // Fetch business hours from Clover
    let businessHours = null;
    try {
      const hoursData = await cloverGet('/opening_hours');
      if (hoursData && hoursData.elements && hoursData.elements.length > 0) {
        // Clover format: { elements: [{ monday: { elements: [{ start: 900, end: 1700 }] }, ... }] }
        const schedule = hoursData.elements[0];
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        businessHours = days.map((day) => {
          const dayData = schedule[day];
          const slots = dayData?.elements || [];
          if (slots.length === 0) {
            return { day: day.toUpperCase(), open: -1, close: -1, closed: true };
          }
          // Clover uses HHMM format: 900 = 9:00 AM, 1700 = 5:00 PM
          // Convert to minutes from midnight for easy comparison
          const startHHMM = slots[0].start;
          const endHHMM = slots[0].end;
          const openMins = Math.floor(startHHMM / 100) * 60 + (startHHMM % 100);
          const closeMins = Math.floor(endHHMM / 100) * 60 + (endHHMM % 100);
          return {
            day: day.toUpperCase(),
            open: openMins,
            close: closeMins,
            openDisplay: startHHMM, // keep original for display
            closeDisplay: endHHMM,
            closed: false,
          };
        });
      }
    } catch {
      // Non-fatal — hours not available for all merchants
    }

    // Update merchant — save hours in theme + last_full_sync_at
    const { data: currentMerchant } = await supabase
      .from('merchants')
      .select('theme')
      .eq('mid', mid)
      .single();

    const updatedTheme = { ...((currentMerchant?.theme as Record<string, unknown>) || {}) };
    if (businessHours) {
      updatedTheme.businessHours = businessHours;
    }

    await supabase
      .from('merchants')
      .update({
        last_full_sync_at: new Date().toISOString(),
        theme: updatedTheme,
      })
      .eq('mid', mid);

    // Finalize sync run
    const status = errors.length === 0 ? 'success' : 'partial';
    if (syncRunId) {
      await supabase
        .from('sync_runs')
        .update({
          status,
          items_synced: itemsSynced,
          errors: errors.length > 0 ? errors : null,
          finished_at: new Date().toISOString(),
        })
        .eq('id', syncRunId);
    }

    return NextResponse.json({
      success: true,
      status,
      items_synced: itemsSynced,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function getCloverEndpoints(region: string, environment: string) {
  const map: Record<string, Record<string, { api: string }>> = {
    na: {
      sandbox: { api: 'https://apisandbox.dev.clover.com' },
      production: { api: 'https://api.clover.com' },
    },
    eu: {
      sandbox: { api: 'https://api.eu.clover.com' },
      production: { api: 'https://api.eu.clover.com' },
    },
    latam: {
      sandbox: { api: 'https://scl-sandbox.dev.clover.com' },
      production: { api: 'https://scl.clover.com' },
    },
  };
  return map[region || 'na']?.[environment || 'production'] || map.na.production;
}

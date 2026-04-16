-- =========================================================================
-- Seed Data: Test merchant with realistic restaurant inventory
-- =========================================================================
-- Run with service_role key (bypasses RLS).
-- Use this for local development and testing.
-- =========================================================================

-- Test merchant (Clover sandbox credentials go in .env, not here)
insert into merchants (
  mid, business_name, region, environment,
  cart_enabled, cart_tier,
  site_url, github_repo,
  theme
) values (
  'SANDBOX_TEST_01',
  'Mamposteao Cafe & Lounge',
  'na',
  'sandbox',
  true,
  'pro',
  'https://mamposteao-cafe-and-lounge.b2bweb.app',
  'B2B-Puerto-Rico/mamposteao-cafe-and-lounge',
  '{"primaryColor": "#8B4513", "buttonText": "Order Now"}'::jsonb
) on conflict (mid) do update set
  business_name = excluded.business_name,
  cart_enabled = excluded.cart_enabled;

-- Categories
insert into categories (mid, clover_category_id, name, sort_order) values
  ('SANDBOX_TEST_01', 'CAT_ENTREES', 'Entrees', 1),
  ('SANDBOX_TEST_01', 'CAT_DRINKS', 'Drinks', 2),
  ('SANDBOX_TEST_01', 'CAT_DESSERTS', 'Desserts', 3),
  ('SANDBOX_TEST_01', 'CAT_SIDES', 'Sides', 4)
on conflict (mid, clover_category_id) do update set
  name = excluded.name,
  sort_order = excluded.sort_order;

-- Modifier groups
insert into modifier_groups (mid, clover_mg_id, name, min_required, max_allowed, sort_order) values
  ('SANDBOX_TEST_01', 'MG_SIZE', 'Size', 1, 1, 1),
  ('SANDBOX_TEST_01', 'MG_PROTEIN', 'Protein', 1, 1, 2),
  ('SANDBOX_TEST_01', 'MG_EXTRAS', 'Extras', 0, 3, 3)
on conflict (mid, clover_mg_id) do update set
  name = excluded.name,
  min_required = excluded.min_required,
  max_allowed = excluded.max_allowed;

-- Modifiers
insert into modifiers (mid, clover_modifier_id, clover_mg_id, name, price_cents) values
  -- Size
  ('SANDBOX_TEST_01', 'MOD_SM', 'MG_SIZE', 'Small', 0),
  ('SANDBOX_TEST_01', 'MOD_MD', 'MG_SIZE', 'Medium', 200),
  ('SANDBOX_TEST_01', 'MOD_LG', 'MG_SIZE', 'Large', 400),
  -- Protein
  ('SANDBOX_TEST_01', 'MOD_CHICKEN', 'MG_PROTEIN', 'Chicken', 0),
  ('SANDBOX_TEST_01', 'MOD_PORK', 'MG_PROTEIN', 'Pork', 0),
  ('SANDBOX_TEST_01', 'MOD_SHRIMP', 'MG_PROTEIN', 'Shrimp', 300),
  ('SANDBOX_TEST_01', 'MOD_STEAK', 'MG_PROTEIN', 'Steak', 500),
  -- Extras
  ('SANDBOX_TEST_01', 'MOD_CHEESE', 'MG_EXTRAS', 'Extra Cheese', 150),
  ('SANDBOX_TEST_01', 'MOD_AVOCADO', 'MG_EXTRAS', 'Avocado', 200),
  ('SANDBOX_TEST_01', 'MOD_TOSTONES', 'MG_EXTRAS', 'Tostones', 250)
on conflict (mid, clover_modifier_id) do update set
  name = excluded.name,
  price_cents = excluded.price_cents;

-- Tax rates (PR IVU: 11.5% = 10.5% state + 1% municipal)
insert into tax_rates (mid, clover_tr_id, name, rate_millionths, is_default) values
  ('SANDBOX_TEST_01', 'TR_IVU_STATE', 'IVU Estatal', 105000, true),
  ('SANDBOX_TEST_01', 'TR_IVU_MUNI', 'IVU Municipal', 10000, true)
on conflict (mid, clover_tr_id) do update set
  name = excluded.name,
  rate_millionths = excluded.rate_millionths;

-- Products (realistic Puerto Rican restaurant menu)
insert into products (
  mid, clover_item_id, name, price_cents, price_type,
  category_ids, modifier_group_ids, tax_rate_ids,
  description, display_order, in_stock
) values
  ('SANDBOX_TEST_01', 'ITEM_MOFONGO', 'Mofongo', 1499, 'FIXED',
   '{CAT_ENTREES}', '{MG_PROTEIN,MG_EXTRAS}', '{TR_IVU_STATE,TR_IVU_MUNI}',
   'Fried green plantains mashed with garlic and your choice of protein', 1, true),

  ('SANDBOX_TEST_01', 'ITEM_ARROZ_POLLO', 'Arroz con Pollo', 1299, 'FIXED',
   '{CAT_ENTREES}', '{MG_SIZE}', '{TR_IVU_STATE,TR_IVU_MUNI}',
   'Classic Puerto Rican chicken and rice', 2, true),

  ('SANDBOX_TEST_01', 'ITEM_PERNIL', 'Pernil', 1699, 'FIXED',
   '{CAT_ENTREES}', '{MG_SIZE,MG_EXTRAS}', '{TR_IVU_STATE,TR_IVU_MUNI}',
   'Slow-roasted pork shoulder with rice and beans', 3, true),

  ('SANDBOX_TEST_01', 'ITEM_ALCAPURRIA', 'Alcapurrias (3 pcs)', 699, 'FIXED',
   '{CAT_SIDES}', '{}', '{TR_IVU_STATE,TR_IVU_MUNI}',
   'Fried plantain and yautia fritters stuffed with beef', 4, true),

  ('SANDBOX_TEST_01', 'ITEM_EMPANADILLA', 'Empanadillas (2 pcs)', 599, 'FIXED',
   '{CAT_SIDES}', '{MG_PROTEIN}', '{TR_IVU_STATE,TR_IVU_MUNI}',
   'Hand-folded turnovers with your choice of filling', 5, true),

  ('SANDBOX_TEST_01', 'ITEM_MALTA', 'Malta India', 299, 'FIXED',
   '{CAT_DRINKS}', '{}', '{TR_IVU_STATE,TR_IVU_MUNI}',
   'Classic Puerto Rican malt beverage', 6, true),

  ('SANDBOX_TEST_01', 'ITEM_COCO_FRIO', 'Coco Frio', 499, 'FIXED',
   '{CAT_DRINKS}', '{}', '{TR_IVU_STATE,TR_IVU_MUNI}',
   'Fresh coconut water served in the shell', 7, true),

  ('SANDBOX_TEST_01', 'ITEM_FLAN', 'Flan de Queso', 699, 'FIXED',
   '{CAT_DESSERTS}', '{}', '{TR_IVU_STATE,TR_IVU_MUNI}',
   'Creamy cream cheese flan with caramel', 8, true),

  ('SANDBOX_TEST_01', 'ITEM_TEMBLEQUE', 'Tembleque', 599, 'FIXED',
   '{CAT_DESSERTS}', '{}', '{TR_IVU_STATE,TR_IVU_MUNI}',
   'Coconut pudding dusted with cinnamon', 9, true),

  -- A hidden item (should not appear in cart)
  ('SANDBOX_TEST_01', 'ITEM_SPECIAL', 'Secret Menu Item', 2499, 'FIXED',
   '{CAT_ENTREES}', '{}', '{TR_IVU_STATE,TR_IVU_MUNI}',
   'Only available in-store', 99, true)
on conflict (mid, clover_item_id) do update set
  name = excluded.name,
  price_cents = excluded.price_cents,
  category_ids = excluded.category_ids,
  modifier_group_ids = excluded.modifier_group_ids,
  description = excluded.description;

-- Mark the secret item as hidden
update products
set hidden_online = true
where mid = 'SANDBOX_TEST_01' and clover_item_id = 'ITEM_SPECIAL';

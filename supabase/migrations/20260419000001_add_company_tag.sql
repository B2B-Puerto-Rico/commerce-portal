-- =========================================================================
-- Add company tag to identify which parent company owns the merchant
-- =========================================================================
alter table merchants
  add column company text not null default 'b2b';

comment on column merchants.company is 'Parent company: b2b (B2B Funding & Merchants) | slice (Start Slice)';

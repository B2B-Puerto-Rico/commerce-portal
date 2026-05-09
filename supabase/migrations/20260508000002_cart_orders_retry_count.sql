-- Add retry_count to cart_orders for tracking failed payment attempts
ALTER TABLE cart_orders ADD COLUMN IF NOT EXISTS retry_count integer DEFAULT 0;

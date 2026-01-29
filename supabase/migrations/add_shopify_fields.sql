-- Add Shopify sync fields to products table
-- Run this migration if the columns don't exist yet

-- Note: shopify_product_id and shopify_variant_id already exist as TEXT columns
-- This migration only adds shopify_synced_at if it doesn't exist

-- Add shopify_synced_at column (nullable, stores when the last sync happened)
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS shopify_synced_at TIMESTAMP WITH TIME ZONE;

-- Add index on shopify_product_id for faster lookups (if it doesn't exist)
CREATE INDEX IF NOT EXISTS idx_products_shopify_product_id 
ON products(shopify_product_id) WHERE shopify_product_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN products.shopify_synced_at IS 'Timestamp of last successful Shopify sync';

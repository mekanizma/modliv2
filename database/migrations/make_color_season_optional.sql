-- Migration: Make color and season fields optional in wardrobe_items
-- Date: 2025-12-17
-- Description: Allow null values for color and season fields to make them optional

-- Make color column nullable
ALTER TABLE wardrobe_items 
ALTER COLUMN color DROP NOT NULL;

-- Make season column nullable
ALTER TABLE wardrobe_items 
ALTER COLUMN season DROP NOT NULL;

-- Add comment to document the change
COMMENT ON COLUMN wardrobe_items.color IS 'Optional: Color of the clothing item';
COMMENT ON COLUMN wardrobe_items.season IS 'Optional: Season suitability (summer, winter, spring, autumn, all)';


-- Update inventory_movements to support multiple warehouses
ALTER TABLE inventory_movements 
ADD COLUMN IF NOT EXISTS warehouse TEXT DEFAULT 'main' CHECK (warehouse IN ('main', 'factory', 'distribution'));

-- Make it NOT NULL after setting the default
ALTER TABLE inventory_movements ALTER COLUMN warehouse SET NOT NULL;

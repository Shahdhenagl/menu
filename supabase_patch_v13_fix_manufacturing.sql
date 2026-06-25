-- Patch v13: Fix Manufacturing BOMs RLS Policies and add distribution_products

-- Drop the old restrictive policies
DROP POLICY IF EXISTS "Allow all read access on manufacturing_recipes" ON public.manufacturing_recipes;
DROP POLICY IF EXISTS "Allow authenticated insert on manufacturing_recipes" ON public.manufacturing_recipes;
DROP POLICY IF EXISTS "Allow authenticated update on manufacturing_recipes" ON public.manufacturing_recipes;
DROP POLICY IF EXISTS "Allow authenticated delete on manufacturing_recipes" ON public.manufacturing_recipes;

-- Drop the new policy if it exists to avoid errors on multiple runs
DROP POLICY IF EXISTS "Allow all for everyone" ON public.manufacturing_recipes;

-- Create the standard public policies to match other tables
CREATE POLICY "Allow all for everyone" ON public.manufacturing_recipes FOR ALL USING (true) WITH CHECK (true);

-- Create distribution_products table if missing
CREATE TABLE IF NOT EXISTS public.distribution_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    unit TEXT NOT NULL,
    category TEXT,
    stock_quantity NUMERIC NOT NULL DEFAULT 0,
    unit_price NUMERIC NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS and add public policy for distribution_products
ALTER TABLE public.distribution_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for everyone" ON public.distribution_products;
CREATE POLICY "Allow all for everyone" ON public.distribution_products FOR ALL USING (true) WITH CHECK (true);

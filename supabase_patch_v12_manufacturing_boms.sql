-- Patch v12: Add Manufacturing BOMs and is_manufactured flag

-- 1. Add is_manufactured to inventory_items
ALTER TABLE public.inventory_items 
ADD COLUMN IF NOT EXISTS is_manufactured BOOLEAN DEFAULT false;

-- 2. Create manufacturing_recipes table
CREATE TABLE IF NOT EXISTS public.manufacturing_recipes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    manufactured_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    ingredient_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    quantity NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.manufacturing_recipes ENABLE ROW LEVEL SECURITY;

-- Create policies for manufacturing_recipes
CREATE POLICY "Allow all read access on manufacturing_recipes" 
    ON public.manufacturing_recipes FOR SELECT USING (true);

CREATE POLICY "Allow authenticated insert on manufacturing_recipes" 
    ON public.manufacturing_recipes FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated update on manufacturing_recipes" 
    ON public.manufacturing_recipes FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated delete on manufacturing_recipes" 
    ON public.manufacturing_recipes FOR DELETE USING (auth.role() = 'authenticated');

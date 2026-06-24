-- جدول تتبع حركات المخازن (الجرد الشهري)
CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
  warehouse TEXT NOT NULL DEFAULT 'main' CHECK (warehouse IN ('main', 'factory', 'distribution')),
  type TEXT NOT NULL CHECK (type IN ('in', 'out', 'waste', 'adjustment')),
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- لاحتساب الرصيد الافتتاحي للشهور القادمة، سيعتمد النظام على تجميع (in) وطرح (out, waste) 
-- بدءاً من الرصيد الحالي الذي سيتم إدراجه كـ "تعديل" (adjustment) كخطوة تأسيسية إذا لزم الأمر.

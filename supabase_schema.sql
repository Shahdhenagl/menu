-- Database Migration Schema for Meridien Restaurant
-- Run this script in your Supabase SQL Editor (https://supabase.com/dashboard/project/xrajwseaukolbidvwfsp/sql/new)

-- 1. Create Tables
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  price NUMERIC NOT NULL,
  image_url TEXT,
  description_ar TEXT,
  description_en TEXT,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  table_number TEXT NOT NULL,
  promo_code TEXT,
  items JSONB NOT NULL, -- Array of items: {id, name_ar, name_en, price, quantity}
  total_price NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, completed, cancelled
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS restaurant_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_name_ar TEXT DEFAULT 'مريديان',
  restaurant_name_en TEXT DEFAULT 'Meridien',
  logo_url TEXT,
  whatsapp_number TEXT DEFAULT '01000307171',
  promo_codes JSONB DEFAULT '{"MERIDIEN10": 10, "WELCOME": 15}'::jsonb, -- Code -> Discount Percent
  offers JSONB DEFAULT '["خصم 10% على جميع وجبات المشويات بمناسبة الصيف!", "العرض الذهبي: اطلب طبقين رئيسيين واحصل على الحلوى مجاناً!"]'::jsonb,
  facebook_url TEXT DEFAULT '',
  instagram_url TEXT DEFAULT '',
  tiktok_url TEXT DEFAULT '',
  snapchat_url TEXT DEFAULT '',
  talabat_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_settings ENABLE ROW LEVEL SECURITY;

-- 3. Create Permissive RLS Policies (Allows public anonymous read and write)
-- Note: In production, you might restrict updates/deletes to authenticated admins,
-- but for simplicity and immediate testing, we allow all operations.
DROP POLICY IF EXISTS "Allow all for everyone" ON categories;
CREATE POLICY "Allow all for everyone" ON categories FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for everyone" ON products;
CREATE POLICY "Allow all for everyone" ON products FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for everyone" ON orders;
CREATE POLICY "Allow all for everyone" ON orders FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for everyone" ON restaurant_settings;
CREATE POLICY "Allow all for everyone" ON restaurant_settings FOR ALL USING (true) WITH CHECK (true);

-- 4. Seed Initial Data
-- Insert Default Categories
INSERT INTO categories (id, name_ar, name_en, sort_order) VALUES
  ('c1111111-1111-1111-1111-111111111111', 'المقبلات والشوربة', 'Appetizers & Soups', 1),
  ('c2222222-2222-2222-2222-222222222222', 'الأطباق الرئيسية', 'Main Courses', 2),
  ('c3333333-3333-3333-3333-333333333333', 'البيتزا والباستا', 'Pizza & Pasta', 3),
  ('c4444444-4444-4444-4444-444444444444', 'الحلويات الفاخرة', 'Fine Desserts', 4),
  ('c5555555-5555-5555-5555-555555555555', 'المشروبات والقهوة', 'Drinks & Coffee', 5)
ON CONFLICT (id) DO NOTHING;

-- Insert Default Products
INSERT INTO products (category_id, name_ar, name_en, price, description_ar, description_en, image_url) VALUES
  -- Appetizers
  ('c1111111-1111-1111-1111-111111111111', 'شوربة لسان عصفور بالدجاج', 'Orzo Chicken Soup', 65, 'شوربة لسان عصفور تقليدية غنية بقطع الدجاج اللذيذة والليمون', 'Traditional orzo soup rich with delicious chicken pieces and lemon', 'https://images.unsplash.com/photo-1547592165-e1d17fed6006?auto=format&fit=crop&w=400&q=80'),
  ('c1111111-1111-1111-1111-111111111111', 'سمبوسك جبنة مشكلة', 'Mixed Cheese Sambousek', 80, 'رقائق سمبوسك مقرمشة محشوة بمزيج من الجبن الأبيض والموتزاريلا والأعشاب (4 قطع)', 'Crispy sambousek sheets stuffed with a blend of white cheese, mozzarella and herbs (4 pcs)', 'https://images.unsplash.com/photo-1601050690597-df056fb4ce78?auto=format&fit=crop&w=400&q=80'),
  ('c1111111-1111-1111-1111-111111111111', 'سلطة سيزر بالدجاج المشوي', 'Grilled Chicken Caesar Salad', 120, 'خس كابوتشا طازج، دجاج مشوي، خبز محمص، مغطى بجبنة البارميزان ودريسنج السيزر الخاص', 'Fresh lettuce, grilled chicken, croutons, topped with parmesan and signature Caesar dressing', 'https://images.unsplash.com/photo-1550304943-4f24f54ddde9?auto=format&fit=crop&w=400&q=80'),
  
  -- Main Courses
  ('c2222222-2222-2222-2222-222222222222', 'نصف دجاجة مسحبة مشوية', 'Grilled Boneless Half Chicken', 190, 'نصف دجاجة مشوية على الفحم متبلة بخلطة مريديان السرية، تقدم مع أرز بسمتي وثومية', 'Charcoal-grilled half chicken marinated in Meridien secret blend, served with basmati rice and garlic dip', 'https://images.unsplash.com/photo-1598515214211-89d3e73ae83b?auto=format&fit=crop&w=400&q=80'),
  ('c2222222-2222-2222-2222-222222222222', 'طبق كباب وكفتة مشكل', 'Mixed Kebab & Kofta Platter', 280, 'كباب لحم بقري وكفتة مشوية على الفحم، يقدم مع أرز مبهر، سلطة خضراء وطحينة', 'Beef kebab and charcoal kofta, served with spiced rice, green salad and tahini dip', 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=400&q=80'),
  ('c2222222-2222-2222-2222-222222222222', 'بيف فيليه بصوص المشروم', 'Beef Fillet with Mushroom Sauce', 320, 'قطعة فيليه بقرى فاخرة مشوية مع صوص مشروم بني كريمي، خضار سوتيه وبيوريه بطاطس', 'Premium beef fillet steak grilled with creamy brown mushroom sauce, sauteed vegetables and mashed potatoes', 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=400&q=80'),
  
  -- Pizza & Pasta
  ('c3333333-3333-3333-3333-333333333333', 'بيتزا مارجريتا كلاسيك', 'Classic Margherita Pizza', 130, 'صلصة طماطم إيطالية، موتزاريلا طبيعية، ريحان طازج وزيت زيتون بكر', 'Italian tomato sauce, natural mozzarella cheese, fresh basil, and virgin olive oil', 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?auto=format&fit=crop&w=400&q=80'),
  ('c3333333-3333-3333-3333-333333333333', 'بيتزا سوبر سوبريم', 'Super Supreme Pizza', 170, 'صلصة طماطم، موتزاريلا، سلامي، لحم مفروم، فلفل ألوان، زيتون، فطر وبصل', 'Tomato sauce, mozzarella, salami, minced beef, bell peppers, olives, mushrooms and onions', 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=400&q=80'),
  ('c3333333-3333-3333-3333-333333333333', 'باستا الفريدو بالدجاج', 'Chicken Alfredo Fettuccine', 140, 'مكرونة فوتشيني بصوص الكريمة الغني، شرائح الدجاج المشوي والمشروم والبارميزان', 'Fettuccine pasta in rich cream sauce, grilled chicken strips, fresh mushrooms and parmesan cheese', 'https://images.unsplash.com/photo-1645112411341-6c4fd023714a?auto=format&fit=crop&w=400&q=80'),
  
  -- Fine Desserts
  ('c4444444-4444-4444-4444-444444444444', 'مولتن كيك الشوكولاتة', 'Chocolate Molten Lava Cake', 85, 'كيك شوكولاتة غني بقلب شوكولاتة ذائب ودافئ، يقدم مع بولة آيس كريم فانيليا', 'Rich chocolate cake with a warm melting chocolate core, served with a scoop of vanilla ice cream', 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=400&q=80'),
  ('c4444444-4444-4444-4444-444444444444', 'تشيز كيك بالتوت البري', 'Blueberry Cheesecake', 90, 'تشيز كيك كريمي بارد على قاعدة مقرمشة من البسكويت مغطى بصوص التوت البري', 'Cold creamy cheesecake on a crunchy biscuit base topped with fresh blueberry sauce', 'https://images.unsplash.com/photo-1524351199679-46cddf530c04?auto=format&fit=crop&w=400&q=80'),
  
  -- Drinks & Coffee
  ('c5555555-5555-5555-5555-555555555555', 'إسبريسو سينجل', 'Single Espresso', 45, 'قهوة إسبريسو غنية ومحضرة من حبوب البن الفاخرة 100% أرابيكا', 'Rich espresso coffee shot made from premium 100% Arabica beans', 'https://images.unsplash.com/photo-1510707577719-ea7c183a153c?auto=format&fit=crop&w=400&q=80'),
  ('c5555555-5555-5555-5555-555555555555', 'عصير مانجو طازج', 'Fresh Mango Juice', 60, 'عصير مانجو طبيعي بارد ومنعش بدون مواد حافظة', 'Cold, refreshing natural mango juice with no preservatives', 'https://images.unsplash.com/photo-1534353436294-0dbd4bdac845?auto=format&fit=crop&w=400&q=80'),
  ('c5555555-5555-5555-5555-555555555555', 'موهيتو نعناع بارد', 'Mint Mojito', 65, 'مشروب موهيتو فوار ومنعش بالليمون والنعناع الطازج ونكهة الصودا', 'Sparkling and refreshing mojito drink with fresh lemon, mint and soda', 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=400&q=80');

-- Insert Initial Restaurant Settings Row
INSERT INTO restaurant_settings (id, restaurant_name_ar, restaurant_name_en, whatsapp_number, promo_codes, offers, facebook_url, instagram_url, tiktok_url, snapchat_url, talabat_url) VALUES
  ('a1111111-1111-1111-1111-111111111111', 'مريديان', 'Meridien', '01000307171', 
   '{"MERIDIEN10": 10, "WELCOME": 15}'::jsonb, 
   '["خصم 10% على جميع وجبات المشويات بمناسبة الصيف!", "العرض الذهبي: اطلب طبقين رئيسيين واحصل على الحلوى مجاناً!"]'::jsonb,
   'https://facebook.com', 'https://instagram.com', 'https://tiktok.com', 'https://snapchat.com', 'https://www.talabat.com/egypt')
ON CONFLICT (id) DO NOTHING;

-- 5. Add Tax and Service columns to settings table
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS tax_percent NUMERIC DEFAULT 0;
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS service_percent NUMERIC DEFAULT 0;

-- 6. Add Recipe columns to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS recipe_ar TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS recipe_en TEXT;

-- 7. Create System Users Table
CREATE TABLE IF NOT EXISTS system_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  username TEXT UNIQUE NOT NULL,
  passcode TEXT NOT NULL,
  role TEXT DEFAULT 'staff',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Create Recipe Comments Table
CREATE TABLE IF NOT EXISTS recipe_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for new tables
ALTER TABLE system_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_comments ENABLE ROW LEVEL SECURITY;

-- Permissive Policies for new tables
DROP POLICY IF EXISTS "Allow all for everyone" ON system_users;
CREATE POLICY "Allow all for everyone" ON system_users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for everyone" ON recipe_comments;
CREATE POLICY "Allow all for everyone" ON recipe_comments FOR ALL USING (true) WITH CHECK (true);

-- Seed initial admin user
INSERT INTO system_users (name, phone, username, passcode, role) VALUES
  ('Super Admin', '01000000000', 'admin', '123456', 'admin')
ON CONFLICT (username) DO NOTHING;


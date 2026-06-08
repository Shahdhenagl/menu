import { createClient } from '@supabase/supabase-js';
import type { Category, Product, Order, RestaurantSettings, Expense, SystemUser, RecipeComment } from '../types';

// Load credentials from environment
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("CRITICAL ERROR: Supabase Environment Variables are missing! The app will use the fake offline database.");
  // Optional: Only alert once per session
  if (!sessionStorage.getItem('supabase_alert_shown')) {
    alert("⚠️ تحذير: متغيرات البيئة (Environment Variables) الخاصة بـ Supabase غير موجودة! الداش بورد تعمل الآن على الداتا بيز الوهمية (المحلية) ولن يتم حفظ أي شيء في الداتا بيز الحقيقية. يرجى إضافتها في إعدادات Vercel.");
    sessionStorage.setItem('supabase_alert_shown', 'true');
  }
}

// Initialize real Supabase client only if keys are present
export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

// Initial Local Seed Data
const initialCategories: Category[] = [
  { id: 'c1111111-1111-1111-1111-111111111111', name_ar: 'المقبلات والشوربة', name_en: 'Appetizers & Soups', sort_order: 1 },
  { id: 'c2222222-2222-2222-2222-222222222222', name_ar: 'الأطباق الرئيسية', name_en: 'Main Courses', sort_order: 2 },
  { id: 'c3333333-3333-3333-3333-333333333333', name_ar: 'البيتزا والباستا', name_en: 'Pizza & Pasta', sort_order: 3 },
  { id: 'c4444444-4444-4444-4444-444444444444', name_ar: 'الحلويات الفاخرة', name_en: 'Fine Desserts', sort_order: 4 },
  { id: 'c5555555-5555-5555-5555-555555555555', name_ar: 'المشروبات والقهوة', name_en: 'Drinks & Coffee', sort_order: 5 }
];

const initialProducts: Product[] = [
  // Appetizers
  {
    id: 'p1',
    category_id: 'c1111111-1111-1111-1111-111111111111',
    name_ar: 'شوربة لسان عصفور بالدجاج',
    name_en: 'Orzo Chicken Soup',
    price: 65,
    description_ar: 'شوربة لسان عصفور تقليدية غنية بقطع الدجاج اللذيذة والليمون',
    description_en: 'Traditional orzo soup rich with delicious chicken pieces and lemon',
    image_url: 'https://images.unsplash.com/photo-1547592165-e1d17fed6006?auto=format&fit=crop&w=400&q=80',
    is_available: true
  },
  {
    id: 'p2',
    category_id: 'c1111111-1111-1111-1111-111111111111',
    name_ar: 'سمبوسك جبنة مشكلة',
    name_en: 'Mixed Cheese Sambousek',
    price: 80,
    description_ar: 'رقائق سمبوسك مقرمشة محشوة بمزيج من الجبن الأبيض والموتزاريلا والأعشاب (4 قطع)',
    description_en: 'Crispy sambousek sheets stuffed with a blend of white cheese, mozzarella and herbs (4 pcs)',
    image_url: 'https://images.unsplash.com/photo-1601050690597-df056fb4ce78?auto=format&fit=crop&w=400&q=80',
    is_available: true
  },
  {
    id: 'p3',
    category_id: 'c1111111-1111-1111-1111-111111111111',
    name_ar: 'سلطة سيزر بالدجاج المشوي',
    name_en: 'Grilled Chicken Caesar Salad',
    price: 120,
    description_ar: 'خس كابوتشا طازج، دجاج مشوي، خبز محمص، مغطى بجبنة البارميزان ودريسنج السيزر الخاص',
    description_en: 'Fresh lettuce, grilled chicken, croutons, topped with parmesan and signature Caesar dressing',
    image_url: 'https://images.unsplash.com/photo-1550304943-4f24f54ddde9?auto=format&fit=crop&w=400&q=80',
    is_available: true
  },
  // Main Courses
  {
    id: 'p4',
    category_id: 'c2222222-2222-2222-2222-222222222222',
    name_ar: 'نصف دجاجة مسحبة مشوية',
    name_en: 'Grilled Boneless Half Chicken',
    price: 190,
    description_ar: 'نصف دجاجة مشوية على الفحم متبلة بخلطة مريديان السرية، تقدم مع أرز بسمتي وثومية',
    description_en: 'Charcoal-grilled half chicken marinated in Meridien secret blend, served with basmati rice and garlic dip',
    image_url: 'https://images.unsplash.com/photo-1598515214211-89d3e73ae83b?auto=format&fit=crop&w=400&q=80',
    is_available: true
  },
  {
    id: 'p5',
    category_id: 'c2222222-2222-2222-2222-222222222222',
    name_ar: 'طبق كباب وكفتة مشكل',
    name_en: 'Mixed Kebab & Kofta Platter',
    price: 280,
    description_ar: 'كباب لحم بقري وكفتة مشوية على الفحم، يقدم مع أرز مبهر، سلطة خضراء وطحينة',
    description_en: 'Beef kebab and charcoal kofta, served with spiced rice, green salad and tahini dip',
    image_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=400&q=80',
    is_available: true
  },
  // Pizza & Pasta
  {
    id: 'p6',
    category_id: 'c3333333-3333-3333-3333-333333333333',
    name_ar: 'بيتزا مارجريتا كلاسيك',
    name_en: 'Classic Margherita Pizza',
    price: 130,
    description_ar: 'صلصة طماطم إيطالية، موتزاريلا طبيعية، ريحان طازج وزيت زيتون بكر',
    description_en: 'Italian tomato sauce, natural mozzarella cheese, fresh basil, and virgin olive oil',
    image_url: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?auto=format&fit=crop&w=400&q=80',
    is_available: true
  },
  {
    id: 'p7',
    category_id: 'c3333333-3333-3333-3333-333333333333',
    name_ar: 'بيتزا سوبر سوبريم',
    name_en: 'Super Supreme Pizza',
    price: 170,
    description_ar: 'صلصة طماطم، موتزاريلا، سلامي، لحم مفروم، فلفل ألوان، زيتون، فطر وبصل',
    description_en: 'Tomato sauce, mozzarella, salami, minced beef, bell peppers, olives, mushrooms and onions',
    image_url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=400&q=80',
    is_available: true
  },
  {
    id: 'p8',
    category_id: 'c3333333-3333-3333-3333-333333333333',
    name_ar: 'باستا الفريدو بالدجاج',
    name_en: 'Chicken Alfredo Fettuccine',
    price: 140,
    description_ar: 'مكرونة فوتشيني بصوص الكريمة الغني، شرائح الدجاج المشوي والمشروم والبارميزان',
    description_en: 'Fettuccine pasta in rich cream sauce, grilled chicken strips, fresh mushrooms and parmesan cheese',
    image_url: 'https://images.unsplash.com/photo-1645112411341-6c4fd023714a?auto=format&fit=crop&w=400&q=80',
    is_available: true
  },
  // Fine Desserts
  {
    id: 'p9',
    category_id: 'c4444444-4444-4444-4444-444444444444',
    name_ar: 'مولتن كيك الشوكولاتة',
    name_en: 'Chocolate Molten Lava Cake',
    price: 85,
    description_ar: 'كيك شوكولاتة غني بقلب شوكولاتة ذائب ودافئ، يقدم مع بولة آيس كريم فانيليا',
    description_en: 'Rich chocolate cake with a warm melting chocolate core, served with a scoop of vanilla ice cream',
    image_url: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=400&q=80',
    is_available: true
  },
  // Drinks & Coffee
  {
    id: 'p10',
    category_id: 'c5555555-5555-5555-5555-555555555555',
    name_ar: 'عصير مانجو طازج',
    name_en: 'Fresh Mango Juice',
    price: 60,
    description_ar: 'عصير مانجو طبيعي بارد ومنعش بدون مواد حافظة',
    description_en: 'Cold, refreshing natural mango juice with no preservatives',
    image_url: 'https://images.unsplash.com/photo-1534353436294-0dbd4bdac845?auto=format&fit=crop&w=400&q=80',
    is_available: true
  },
  {
    id: 'p11',
    category_id: 'c5555555-5555-5555-5555-555555555555',
    name_ar: 'موهيتو نعناع بارد',
    name_en: 'Mint Mojito',
    price: 65,
    description_ar: 'مشروب موهيتو فوار ومنعش بالليمون والنعناع الطازج ونكهة الصودا',
    description_en: 'Sparkling and refreshing mojito drink with fresh lemon, mint and soda',
    image_url: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=400&q=80',
    is_available: true
  }
];

const initialSettings: RestaurantSettings = {
  id: 'rs1',
  restaurant_name_ar: 'مريديان',
  restaurant_name_en: 'Meridien',
  logo_url: '/logo.png', // Default fallback logo will render via inline SVG/CSS if blank
  whatsapp_number: '01000307171',
  promo_codes: { 'MERIDIEN10': 10, 'WELCOME': 15, 'SUMMER20': 20 },
  offers: [
    'خصم 10% على جميع وجبات المشويات بمناسبة الصيف!',
    'العرض الذهبي: اطلب طبقين رئيسيين واحصل على الحلوى مجاناً!',
    'استخدم كود WELCOME للحصول على 15% خصم على أول طلب لك!'
  ],
  facebook_url: 'https://facebook.com/meridien',
  instagram_url: 'https://instagram.com/meridien',
  tiktok_url: 'https://tiktok.com/@meridien',
  snapchat_url: 'https://snapchat.com/add/meridien',
  talabat_url: 'https://www.talabat.com/egypt',
  tax_percent: 0,
  service_percent: 0
};

const initialOrders: Order[] = [
  {
    id: 'o1',
    customer_name: 'أحمد محمود',
    customer_phone: '01234567890',
    table_number: '3',
    promo_code: 'WELCOME',
    items: [
      { id: 'p6', name_ar: 'بيتزا مارجريتا كلاسيك', name_en: 'Classic Margherita Pizza', price: 130, quantity: 2 },
      { id: 'p10', name_ar: 'عصير مانجو طازج', name_en: 'Fresh Mango Juice', price: 60, quantity: 1 }
    ],
    total_price: 272, // (260 + 60) * 0.85 = 272
    status: 'completed',
    created_at: new Date(Date.now() - 48 * 3600 * 1000).toISOString() // 2 days ago
  },
  {
    id: 'o2',
    customer_name: 'سارة علي',
    customer_phone: '01012345678',
    table_number: '7',
    items: [
      { id: 'p4', name_ar: 'نصف دجاجة مسحبة مشوية', name_en: 'Grilled Boneless Half Chicken', price: 190, quantity: 1 },
      { id: 'p11', name_ar: 'موهيتو نعناع بارد', name_en: 'Mint Mojito', price: 65, quantity: 2 }
    ],
    total_price: 320,
    status: 'completed',
    created_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString() // 1 day ago
  },
  {
    id: 'o3',
    customer_name: 'محمود أحمد',
    customer_phone: '01234567890', // Repeat customer!
    table_number: '5',
    promo_code: 'SUMMER20',
    items: [
      { id: 'p5', name_ar: 'طبق كباب وكفتة مشكل', name_en: 'Mixed Kebab & Kofta Platter', price: 280, quantity: 1 },
      { id: 'p9', name_ar: 'مولتن كيك الشوكولاتة', name_en: 'Chocolate Molten Lava Cake', price: 85, quantity: 1 }
    ],
    total_price: 292, // (280 + 85) = 365 * 0.8 = 292
    status: 'pending',
    created_at: new Date().toISOString()
  }
];

// Helper to get from localstorage or seed
function getLocalData<T>(key: string, initial: T): T {
  const data = localStorage.getItem(key);
  if (!data) {
    localStorage.setItem(key, JSON.stringify(initial));
    return initial;
  }
  try {
    return JSON.parse(data);
  } catch {
    return initial;
  }
}

function saveLocalData<T>(key: string, data: T) {
  localStorage.setItem(key, JSON.stringify(data));
}

// Unified Database API (works against Supabase if configured, or falls back transparently to LocalStorage)
export const db = {
  isMock: !supabase,

  // --- CATEGORIES ---
  async getCategories(): Promise<Category[]> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('*')
          .order('sort_order', { ascending: true });
        if (error) throw error;
        return data || [];
      } catch (err) {
        console.warn("Supabase fetch failed, falling back to mock database.", err);
      }
    }
    return getLocalData('meridien_categories', initialCategories).sort((a, b) => a.sort_order - b.sort_order);
  },

  async addCategory(category: Omit<Category, 'id'>): Promise<Category> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('categories')
          .insert([category])
          .select()
          .single();
        if (error) throw error;
        return data;
      } catch (err) {
        console.warn("Supabase insert failed, falling back to mock database.", err);
      }
    }
    const categories = getLocalData('meridien_categories', initialCategories);
    const newCategory: Category = { ...category, id: crypto.randomUUID() };
    categories.push(newCategory);
    saveLocalData('meridien_categories', categories);
    return newCategory;
  },

  async updateCategory(id: string, category: Partial<Category>): Promise<Category> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('categories')
          .update(category)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } catch (err) {
        console.warn("Supabase update failed, falling back to mock database.", err);
      }
    }
    const categories = getLocalData('meridien_categories', initialCategories);
    const index = categories.findIndex(c => c.id === id);
    if (index === -1) throw new Error("Category not found");
    categories[index] = { ...categories[index], ...category };
    saveLocalData('meridien_categories', categories);
    return categories[index];
  },

  async deleteCategory(id: string): Promise<boolean> {
    if (supabase) {
      try {
        const { error } = await supabase
          .from('categories')
          .delete()
          .eq('id', id);
        if (error) throw error;
        return true;
      } catch (err) {
        console.warn("Supabase delete failed, falling back to mock database.", err);
      }
    }
    const categories = getLocalData('meridien_categories', initialCategories);
    const updated = categories.filter(c => c.id !== id);
    saveLocalData('meridien_categories', updated);
    return true;
  },

  // --- PRODUCTS ---
  async getProducts(): Promise<Product[]> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*');
        if (error) throw error;
        return data || [];
      } catch (err) {
        console.warn("Supabase fetch failed, falling back to mock database.", err);
      }
    }
    return getLocalData('meridien_products', initialProducts);
  },

  async addProduct(product: Omit<Product, 'id'>): Promise<Product> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('products')
          .insert([product])
          .select()
          .single();
        if (error) throw error;
        return data;
      } catch (err) {
        console.warn("Supabase insert failed, falling back to mock database.", err);
      }
    }
    const products = getLocalData('meridien_products', initialProducts);
    const newProduct: Product = { ...product, id: crypto.randomUUID() };
    products.push(newProduct);
    saveLocalData('meridien_products', products);
    return newProduct;
  },

  async updateProduct(id: string, product: Partial<Product>): Promise<Product> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('products')
          .update(product)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } catch (err) {
        console.warn("Supabase update failed, falling back to mock database.", err);
      }
    }
    const products = getLocalData('meridien_products', initialProducts);
    const index = products.findIndex(p => p.id === id);
    if (index === -1) throw new Error("Product not found");
    products[index] = { ...products[index], ...product };
    saveLocalData('meridien_products', products);
    return products[index];
  },

  async deleteProduct(id: string): Promise<boolean> {
    if (supabase) {
      try {
        const { error } = await supabase
          .from('products')
          .delete()
          .eq('id', id);
        if (error) throw error;
        return true;
      } catch (err) {
        console.warn("Supabase delete failed, falling back to mock database.", err);
      }
    }
    const products = getLocalData('meridien_products', initialProducts);
    const updated = products.filter(p => p.id !== id);
    saveLocalData('meridien_products', updated);
    return true;
  },

  // --- ORDERS ---
  async getOrders(): Promise<Order[]> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
      } catch (err) {
        console.warn("Supabase fetch failed, falling back to mock database.", err);
      }
    }
    return getLocalData('meridien_orders', initialOrders).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async addOrder(order: Omit<Order, 'id' | 'created_at'>): Promise<Order> {
    const newOrder: Order = {
      ...order,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString()
    };
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('orders')
          .insert([newOrder])
          .select()
          .single();
        if (error) throw error;
        return data;
      } catch (err) {
        console.warn("Supabase order insert failed, falling back to mock database.", err);
      }
    }
    const orders = getLocalData('meridien_orders', initialOrders);
    orders.unshift(newOrder);
    saveLocalData('meridien_orders', orders);
    return newOrder;
  },

  async updateOrderStatus(id: string, status: Order['status']): Promise<Order> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('orders')
          .update({ status })
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } catch (err) {
        console.warn("Supabase update failed, falling back to mock database.", err);
      }
    }
    const orders = getLocalData('meridien_orders', initialOrders);
    const index = orders.findIndex(o => o.id === id);
    if (index === -1) throw new Error("Order not found");
    orders[index].status = status;
    saveLocalData('meridien_orders', orders);
    return orders[index];
  },

  // --- SETTINGS ---
  async getSettings(): Promise<RestaurantSettings> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('restaurant_settings')
          .select('*')
          .single();
        if (error) {
          // If table exists but has no records, seed default row
          if (error.code === 'PGRST116') {
            const { data: seeded, error: seedErr } = await supabase
              .from('restaurant_settings')
              .insert([initialSettings])
              .select()
              .single();
            if (!seedErr && seeded) return seeded;
          }
          throw error;
        }
        return data;
      } catch (err) {
        console.warn("Supabase settings fetch failed, falling back to mock database.", err);
      }
    }
    return getLocalData('meridien_settings', initialSettings);
  },

  async updateSettings(settings: Partial<RestaurantSettings>): Promise<RestaurantSettings> {
    if (supabase) {
      try {
        const currentSettings = await this.getSettings();
        const { data, error } = await supabase
          .from('restaurant_settings')
          .update(settings)
          .eq('id', currentSettings.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } catch (err) {
        console.warn("Supabase settings update failed, falling back to mock database.", err);
      }
    }
    const current = getLocalData('meridien_settings', initialSettings);
    const updated = { ...current, ...settings };
    saveLocalData('meridien_settings', updated);
    return updated;
  },

  // --- EXPENSES ---
  async getExpenses(): Promise<Expense[]> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('expenses')
          .select('*')
          .order('expense_date', { ascending: false });
        if (!error) return data || [];
        console.warn("Supabase fetch expenses error, falling back to local storage:", error.message);
      } catch (err) {
        console.warn("Supabase fetch expenses failed, falling back to local storage.", err);
      }
    }
    return getLocalData('meridien_expenses', [] as Expense[]).sort((a, b) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime());
  },

  async addExpense(expense: Omit<Expense, 'id'>): Promise<Expense> {
    const newExpense: Expense = {
      ...expense,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString()
    };
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('expenses')
          .insert([newExpense])
          .select()
          .single();
        if (!error && data) return data;
        console.warn("Supabase insert expense error, falling back to local storage:", error?.message);
      } catch (err) {
        console.warn("Supabase insert expense failed, falling back to local storage.", err);
      }
    }
    const expenses = getLocalData('meridien_expenses', [] as Expense[]);
    expenses.unshift(newExpense);
    saveLocalData('meridien_expenses', expenses);
    return newExpense;
  },

  async deleteExpense(id: string): Promise<boolean> {
    if (supabase) {
      try {
        const { error } = await supabase
          .from('expenses')
          .delete()
          .eq('id', id);
        if (!error) return true;
        console.warn("Supabase delete expense error, falling back to local storage:", error.message);
      } catch (err) {
        console.warn("Supabase delete expense failed, falling back to local storage.", err);
      }
    }
    const expenses = getLocalData('meridien_expenses', [] as Expense[]);
    const updated = expenses.filter(e => e.id !== id);
    saveLocalData('meridien_expenses', updated);
    return true;
  },

  // --- SYSTEM USERS ---
  async getSystemUsers(): Promise<SystemUser[]> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('system_users')
          .select('*')
          .order('created_at', { ascending: true });
        if (!error) return data || [];
      } catch (err) {
        console.warn("Supabase fetch users failed", err);
      }
    }
    return getLocalData('meridien_users', [] as SystemUser[]);
  },

  async addSystemUser(user: Omit<SystemUser, 'id'>): Promise<SystemUser> {
    const newUser: SystemUser = {
      ...user,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString()
    };
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('system_users')
          .insert([newUser])
          .select()
          .single();
        if (!error && data) return data;
      } catch (err) {
        console.warn("Supabase insert user failed", err);
      }
    }
    const users = getLocalData('meridien_users', [] as SystemUser[]);
    users.push(newUser);
    saveLocalData('meridien_users', users);
    return newUser;
  },

  async deleteSystemUser(id: string): Promise<boolean> {
    if (supabase) {
      try {
        const { error } = await supabase
          .from('system_users')
          .delete()
          .eq('id', id);
        if (!error) return true;
      } catch (err) {
        console.warn("Supabase delete user failed", err);
      }
    }
    const users = getLocalData('meridien_users', [] as SystemUser[]);
    const updated = users.filter(u => u.id !== id);
    saveLocalData('meridien_users', updated);
    return true;
  },

  // --- RECIPE COMMENTS ---
  async getRecipeComments(product_id: string): Promise<RecipeComment[]> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('recipe_comments')
          .select('*')
          .eq('product_id', product_id)
          .order('created_at', { ascending: true });
        if (!error) return data || [];
      } catch (err) {
        console.warn("Supabase fetch comments failed", err);
      }
    }
    const allComments = getLocalData('meridien_recipe_comments', [] as RecipeComment[]);
    return allComments.filter(c => c.product_id === product_id).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  },

  async addRecipeComment(comment: Omit<RecipeComment, 'id'>): Promise<RecipeComment> {
    const newComment: RecipeComment = {
      ...comment,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString()
    };
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('recipe_comments')
          .insert([newComment])
          .select()
          .single();
        if (!error && data) return data;
      } catch (err) {
        console.warn("Supabase insert comment failed", err);
      }
    }
    const comments = getLocalData('meridien_recipe_comments', [] as RecipeComment[]);
    comments.push(newComment);
    saveLocalData('meridien_recipe_comments', comments);
    return newComment;
  }
};


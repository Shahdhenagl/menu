import { createClient } from '@supabase/supabase-js';
import type { Category, Product, Order, RestaurantSettings, Expense, SystemUser, RecipeComment, Printer, Supplier, InventoryItem, PurchaseInvoice, ManufacturingOrder, SystemNotification, ProductionLog, ProductRecipe, Customer, Employee, AttendanceLog, EmployeeTransaction } from '../types';
import { initialCategories, initialProducts, initialInventoryItems, initialProductRecipes } from './seedData';

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

const triggerTelegramLog = async (actionAr: string, actionEn: string, details: string, explicitUserName?: string) => {
  try {
    const { notifyAction } = await import('../utils/telegramUtils');
    const settings = await db.getSettings();
    await notifyAction(actionAr, actionEn, details, settings, explicitUserName);
  } catch(err) {
    console.error("Failed to log to Telegram:", err);
  }
};

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
    'استخدم كود WELCOME للحصول على 15% خصم على أول طبق لك!'
  ],
  facebook_url: 'https://facebook.com/meridien',
  instagram_url: 'https://instagram.com/meridien',
  tiktok_url: 'https://tiktok.com/@meridien',
  snapchat_url: 'https://snapchat.com/add/meridien',
  talabat_url: 'https://www.talabat.com/egypt',
  tax_percent: 0,
  service_percent: 0,
  telegram_bot_token: '',
  telegram_chat_id: ''
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

const initialSuppliers: Supplier[] = [
  { id: 'sup1', name: 'شركة المراعي', phone: '01000000001' },
  { id: 'sup2', name: 'مزارع دينا', phone: '01000000002' },
  { id: 'sup3', name: 'مورد لحوم البلد', phone: '01000000003' }
];

const initialPurchaseInvoices: PurchaseInvoice[] = [];


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
    await triggerTelegramLog('إضافة تصنيف', 'Add Category', `تم إضافة التصنيف: ${category.name_ar}`);
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
    await triggerTelegramLog('تعديل تصنيف', 'Update Category', `تم تعديل التصنيف (ID: ${id})`);
    if (supabase) {
      const { data, error } = await supabase
        .from('categories')
        .update(category)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    }
    const categories = getLocalData('meridien_categories', initialCategories);
    const index = categories.findIndex(c => c.id === id);
    if (index === -1) throw new Error("Category not found");
    categories[index] = { ...categories[index], ...category };
    saveLocalData('meridien_categories', categories);
    return categories[index];
  },

  async deleteCategory(id: string): Promise<boolean> {
    await triggerTelegramLog('حذف تصنيف', 'Delete Category', `تم حذف التصنيف (ID: ${id})`);
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
    await triggerTelegramLog('إضافة منتج', 'Add Product', `تم إضافة المنتج: ${product.name_ar}`);
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
    await triggerTelegramLog('تعديل منتج', 'Update Product', `تم تعديل المنتج: ${product.name_ar || '(ID: '+id+')'}`);
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
    await triggerTelegramLog('حذف منتج', 'Delete Product', `تم حذف المنتج (ID: ${id})`);
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

    // Auto-assign waiter: prefer the currently active POS waiter, fallback to round-robin among active database waiters, then fallback to round-robin among all waiters
    if (!newOrder.waiter_id) {
      try {
        // Check if a waiter is currently logged into POS locally (e.g. if order placed from POS)
        const activeWaiterRaw = typeof localStorage !== 'undefined' ? localStorage.getItem('meridien_active_pos_waiter') : null;
        if (activeWaiterRaw) {
          try {
            const aw = JSON.parse(activeWaiterRaw);
            if (aw.id && aw.name) {
              newOrder.waiter_id = aw.id;
              newOrder.waiter_name = aw.name;
            }
          } catch (e) {}
        }

        // Fallback: check database for active/logged-in waiters (essential for website/customer orders)
        if (!newOrder.waiter_id) {
          const users = await db.getSystemUsers();
          
          // Filter to waiters active in last 12 hours
          const activeWaiters = users.filter(u => {
            if (u.role !== 'waiter' || !u.is_active) return false;
            if (u.last_active_at) {
              const lastActive = new Date(u.last_active_at).getTime();
              const twelveHoursAgo = Date.now() - 12 * 60 * 60 * 1000;
              return lastActive > twelveHoursAgo;
            }
            return true;
          });

          // Use active waiters if any, otherwise fallback to all waiters
          const waitersToAssign = activeWaiters.length > 0 ? activeWaiters : users.filter(u => u.role === 'waiter');
          
          if (waitersToAssign.length > 0) {
            const orders = await db.getOrders();
            // Find the last order assigned to one of these target waiters
            const lastAssignedOrder = orders.find(o => o.waiter_id && waitersToAssign.some(w => w.id === o.waiter_id));
            
            let nextWaiter = waitersToAssign[0];
            if (lastAssignedOrder && lastAssignedOrder.waiter_id) {
              const lastIndex = waitersToAssign.findIndex(w => w.id === lastAssignedOrder.waiter_id);
              if (lastIndex !== -1 && lastIndex + 1 < waitersToAssign.length) {
                nextWaiter = waitersToAssign[lastIndex + 1];
              }
            }
            
            newOrder.waiter_id = nextWaiter.id;
            newOrder.waiter_name = nextWaiter.name;
          }
        }
      } catch (err) {
        console.error("Error assigning waiter:", err);
      }
    }

    if (newOrder.status === 'completed') {
      const cost = await this.deductInventoryForOrder(newOrder);
      newOrder.total_cost = cost;
    }

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

  async updateOrderStatus(id: string, status: Order['status'], userName?: string): Promise<Order> {
    let finalUser = userName;
    try {
      if (supabase) {
        const { data: currentOrder } = await supabase.from('orders').select('waiter_name').eq('id', id).single();
        if (currentOrder?.waiter_name) {
          finalUser = currentOrder.waiter_name;
        }
      } else {
        const orders = getLocalData('meridien_orders', initialOrders);
        const currentOrder = orders.find(o => o.id === id);
        if (currentOrder?.waiter_name) {
          finalUser = currentOrder.waiter_name;
        }
      }
    } catch (e) {
      console.warn("Failed to retrieve waiter_name for telegram log:", e);
    }
    await triggerTelegramLog('تحديث حالة طلب', 'Update Order Status', `تغيرت حالة الطلب ${id.slice(0, 6)} إلى ${status}`, finalUser);
    if (supabase) {
      try {
        const { data: currentOrder } = await supabase.from('orders').select('*').eq('id', id).single();
        if (currentOrder) {
          const updatedOrder = { ...currentOrder, status };
          let cost = updatedOrder.total_cost || 0;
          if (status === 'completed' && !currentOrder.inventory_deducted) {
            cost = await this.deductInventoryForOrder(updatedOrder);
            updatedOrder.total_cost = cost;
          }
          let { data, error } = await supabase
            .from('orders')
            .update({ status, inventory_deducted: updatedOrder.inventory_deducted, total_cost: cost })
            .eq('id', id)
            .select()
            .single();
          
          if (error) {
            console.warn("Update with total_cost failed, retrying without new columns...", error);
            const res = await supabase.from('orders').update({ status }).eq('id', id).select().single();
            data = res.data; error = res.error;
          }

          if (error) throw error;
          return data;
        }
      } catch (err) {
        console.warn("Supabase update failed, falling back to mock database.", err);
      }
    }
    const orders = getLocalData('meridien_orders', initialOrders);
    const index = orders.findIndex(o => o.id === id);
    if (index === -1) throw new Error("Order not found");
    orders[index].status = status;
    if (status === 'completed' && !orders[index].inventory_deducted) {
      orders[index].total_cost = await this.deductInventoryForOrder(orders[index]);
    }
    saveLocalData('meridien_orders', orders);
    return orders[index];
  },

  async updateOrder(id: string, updates: Partial<Order>, userName?: string): Promise<Order> {
    let finalUser = userName || updates.waiter_name;
    if (!finalUser) {
      try {
        if (supabase) {
          const { data: currentOrder } = await supabase.from('orders').select('waiter_name').eq('id', id).single();
          if (currentOrder?.waiter_name) {
            finalUser = currentOrder.waiter_name;
          }
        } else {
          const orders = getLocalData('meridien_orders', initialOrders);
          const currentOrder = orders.find(o => o.id === id);
          if (currentOrder?.waiter_name) {
            finalUser = currentOrder.waiter_name;
          }
        }
      } catch (e) {
        console.warn("Failed to retrieve waiter_name for telegram log:", e);
      }
    }
    await triggerTelegramLog('تعديل طلب', 'Update Order', `تم تعديل الطلب رقم ${id.slice(0, 6)}`, finalUser);
    if (supabase) {
      try {
        const { data: currentOrder } = await supabase.from('orders').select('*').eq('id', id).single();
        if (currentOrder) {
          const updatedOrder = { ...currentOrder, ...updates };
          if (updatedOrder.status === 'completed' && !currentOrder.inventory_deducted) {
            updates.total_cost = await this.deductInventoryForOrder(updatedOrder);
            updates.inventory_deducted = true;
          }
          let { data, error } = await supabase
            .from('orders')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
          
          if (error) {
            console.warn("Update failed, retrying without new columns...", error);
            const fallbackUpdates = { ...updates };
            delete fallbackUpdates.inventory_deducted;
            delete fallbackUpdates.total_cost;
            const res = await supabase.from('orders').update(fallbackUpdates).eq('id', id).select().single();
            data = res.data; error = res.error;
          }

          if (error) throw error;
          return data;
        }
      } catch (err) {
        console.warn("Supabase update failed, falling back to mock database.", err);
      }
    }
    const orders = getLocalData('meridien_orders', initialOrders);
    const index = orders.findIndex(o => o.id === id);
    if (index === -1) throw new Error("Order not found");
    orders[index] = { ...orders[index], ...updates };
    if (orders[index].status === 'completed' && !orders[index].inventory_deducted) {
      orders[index].total_cost = await this.deductInventoryForOrder(orders[index]);
    }
    saveLocalData('meridien_orders', orders);
    return orders[index];
  },


  async deleteOrder(id: string, userName?: string): Promise<void> {
    let finalUser = userName;
    try {
      if (supabase) {
        const { data: currentOrder } = await supabase.from('orders').select('waiter_name').eq('id', id).single();
        if (currentOrder?.waiter_name) {
          finalUser = currentOrder.waiter_name;
        }
      } else {
        const orders = getLocalData('meridien_orders', initialOrders);
        const currentOrder = orders.find(o => o.id === id);
        if (currentOrder?.waiter_name) {
          finalUser = currentOrder.waiter_name;
        }
      }
    } catch (e) {
      console.warn("Failed to retrieve waiter_name for telegram log:", e);
    }
    await triggerTelegramLog('حذف الطلب', 'Delete Order', `تم حذف الطلب رقم ${id.slice(0, 6)} نهائياً من النظام`, finalUser);
    if (supabase) {
      try {
        const { error } = await supabase.from('orders').delete().eq('id', id);
        if (error) throw error;
        return;
      } catch (err) {
        console.warn("Supabase delete failed, falling back to mock database.", err);
      }
    }
    const orders = getLocalData('meridien_orders', initialOrders);
    const updatedOrders = orders.filter(o => o.id !== id);
    saveLocalData('meridien_orders', updatedOrders);
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
    await triggerTelegramLog('تسجيل مصروف', 'Add Expense', `تم تسجيل مصروف جديد: ${expense.name} بقيمة ${expense.amount}`);
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
    await triggerTelegramLog('حذف مصروف', 'Delete Expense', `تم حذف مصروف (ID: ${id})`);
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

  async updateWaiterActiveStatus(userId: string, isActive: boolean): Promise<void> {
    if (supabase) {
      try {
        await supabase
          .from('system_users')
          .update({ is_active: isActive, last_active_at: new Date().toISOString() })
          .eq('id', userId);
      } catch (err) {
        console.warn("Failed to update active status in Supabase", err);
      }
    }
    const users = getLocalData('meridien_users', [] as SystemUser[]);
    const index = users.findIndex(u => u.id === userId);
    if (index !== -1) {
      users[index].is_active = isActive;
      users[index].last_active_at = new Date().toISOString();
      saveLocalData('meridien_users', users);
    }
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
  },

  // --- PRINTERS ---
  async getPrinters(): Promise<Printer[]> {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('printers').select('*');
        if (!error && data) {
          saveLocalData('meridien_printers', data);
          return data;
        }
      } catch (err) {
        console.warn("Supabase fetch printers failed", err);
      }
    }
    return getLocalData('meridien_printers', [] as Printer[]);
  },

  async addPrinter(printer: Omit<Printer, 'id'>): Promise<Printer> {
    const newPrinter: Printer = {
      ...printer,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString()
    };
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('printers')
          .insert([newPrinter])
          .select()
          .single();
        if (!error && data) return data;
      } catch (err) {
        console.warn("Supabase insert printer failed", err);
      }
    }
    const printers = getLocalData('meridien_printers', [] as Printer[]);
    printers.push(newPrinter);
    saveLocalData('meridien_printers', printers);
    return newPrinter;
  },

  async deletePrinter(id: string): Promise<void> {
    if (supabase) {
      try {
        const { error } = await supabase.from('printers').delete().eq('id', id);
        if (error) console.error("Supabase delete printer error:", error);
      } catch (err) {
        console.warn("Supabase delete printer failed", err);
      }
    }
    const printers = getLocalData('meridien_printers', [] as Printer[]);
    saveLocalData('meridien_printers', printers.filter(p => p.id !== id));
  },

  // --- INVENTORY: SUPPLIERS ---
  async getSuppliers(): Promise<Supplier[]> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('suppliers')
          .select('*')
          .order('name', { ascending: true });
        if (!error) return data || [];
      } catch (err) {
        console.warn("Supabase getSuppliers failed", err);
      }
    }
    return getLocalData('meridien_suppliers', initialSuppliers);
  },
  async addSupplier(supplier: Omit<Supplier, 'id'>): Promise<Supplier> {
    await triggerTelegramLog('إضافة مورد', 'Add Supplier', `تم إضافة المورد: ${supplier.name}`);
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('suppliers')
          .insert([supplier])
          .select()
          .single();
        if (!error && data) return data;
      } catch (err) {
        console.warn("Supabase addSupplier failed", err);
      }
    }
    const newSupplier = { ...supplier, id: crypto.randomUUID(), created_at: new Date().toISOString() };
    const suppliers = await this.getSuppliers();
    saveLocalData('meridien_suppliers', [...suppliers, newSupplier]);
    return newSupplier;
  },
  async deleteSupplier(id: string): Promise<void> {
    if (supabase) {
      try {
        const { error } = await supabase
          .from('suppliers')
          .delete()
          .eq('id', id);
        if (!error) return;
      } catch (err) {
        console.warn("Supabase deleteSupplier failed", err);
      }
    }
    const suppliers = await this.getSuppliers();
    saveLocalData('meridien_suppliers', suppliers.filter(s => s.id !== id));
  },

  // --- INVENTORY: ITEMS ---
  async getInventoryItems(): Promise<InventoryItem[]> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('inventory_items')
          .select('*')
          .order('name', { ascending: true });
        if (!error) return data || [];
      } catch (err) {
        console.warn("Supabase getInventoryItems failed", err);
      }
    }
    const defaultInventoryItems: InventoryItem[] = [
      ...initialInventoryItems,
      ...initialProducts.map(p => ({
        id: p.id,
        name: p.name_ar,
        unit: 'وجبة',
        stock_main: 0,
        stock_factory: 0,
        stock_distribution: 10,
        last_purchase_price: 0,
        avg_purchase_price: 0
      }))
    ];
    return getLocalData('meridien_inventory_items', defaultInventoryItems);
  },
  async addInventoryItem(item: Omit<InventoryItem, 'id'>): Promise<InventoryItem> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('inventory_items')
          .insert([item])
          .select()
          .single();
        if (!error && data) return data;
      } catch (err) {
        console.warn("Supabase addInventoryItem failed", err);
      }
    }
    const newItem = { ...item, id: crypto.randomUUID(), created_at: new Date().toISOString() };
    const items = await this.getInventoryItems();
    saveLocalData('meridien_inventory_items', [...items, newItem]);
    return newItem;
  },
  async updateInventoryItem(id: string, updates: Partial<InventoryItem>): Promise<InventoryItem> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('inventory_items')
          .update(updates)
          .eq('id', id)
          .select()
          .single();
        if (!error && data) return data;
      } catch (err) {
        console.warn("Supabase updateInventoryItem failed", err);
      }
    }
    const items = await this.getInventoryItems();
    const index = items.findIndex(i => i.id === id);
    if (index === -1) throw new Error('Item not found');
    const updated = { ...items[index], ...updates };
    items[index] = updated;
    saveLocalData('meridien_inventory_items', items);
    return updated;
  },
  async deleteInventoryItem(id: string): Promise<void> {
    if (supabase) {
      try {
        const { error } = await supabase
          .from('inventory_items')
          .delete()
          .eq('id', id);
        if (!error) return;
      } catch (err) {
        console.warn("Supabase deleteInventoryItem failed", err);
      }
    }
    const items = await this.getInventoryItems();
    saveLocalData('meridien_inventory_items', items.filter(i => i.id !== id));
  },

  // --- INVENTORY: PURCHASE INVOICES ---
  async getPurchaseInvoices(): Promise<PurchaseInvoice[]> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('purchase_invoices')
          .select('*')
          .order('invoice_date', { ascending: false });
        if (!error) return data || [];
      } catch (err) {
        console.warn("Supabase getPurchaseInvoices failed", err);
      }
    }
    return getLocalData('meridien_purchase_invoices', initialPurchaseInvoices);
  },
  async addPurchaseInvoice(invoice: Omit<PurchaseInvoice, 'id'>): Promise<PurchaseInvoice> {
    await triggerTelegramLog('إضافة فاتورة مشتريات', 'Add Purchase Invoice', `تم إضافة فاتورة مورد (${invoice.supplier_id}) بقيمة ${invoice.total_amount}`);
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('purchase_invoices')
          .insert([invoice])
          .select()
          .single();
        
        if (!error && data) {
          // Update inventory stock in Supabase as well
          for (const invItem of invoice.items) {
            const { data: itemData } = await supabase
              .from('inventory_items')
              .select('stock_main, avg_purchase_price')
              .eq('id', invItem.item_id)
              .single();
            if (itemData) {
              const oldStock = Number(itemData.stock_main) || 0;
              const oldAvg = Number(itemData.avg_purchase_price) || 0;
              const newStock = oldStock + invItem.quantity;
              const newAvg = newStock > 0 ? ((oldStock * oldAvg) + (invItem.quantity * invItem.unit_price)) / newStock : 0;
              
              await supabase
                .from('inventory_items')
                .update({
                  stock_main: newStock,
                  last_purchase_price: invItem.unit_price,
                  avg_purchase_price: newAvg
                })
                .eq('id', invItem.item_id);
            }
          }
          return data;
        }
      } catch (err) {
        console.warn("Supabase addPurchaseInvoice failed", err);
      }
    }
    const newInvoice: PurchaseInvoice = { ...invoice, id: crypto.randomUUID(), created_at: new Date().toISOString() };
    const invoices = await this.getPurchaseInvoices();
    saveLocalData('meridien_purchase_invoices', [...invoices, newInvoice]);

    // Automatically update stock and prices for each item
    const inventoryItems = await this.getInventoryItems();
    
    for (const invItem of newInvoice.items) {
      const itemIndex = inventoryItems.findIndex(i => i.id === invItem.item_id);
      if (itemIndex > -1) {
        const item = inventoryItems[itemIndex];
        
        const oldStock = item.stock_main;
        const oldAvg = item.avg_purchase_price;
        const incomingQty = invItem.quantity;
        const incomingPrice = invItem.unit_price;
        
        const newStock = oldStock + incomingQty;
        const newAvg = newStock > 0 ? ((oldStock * oldAvg) + (incomingQty * incomingPrice)) / newStock : 0;
        
        inventoryItems[itemIndex] = {
          ...item,
          stock_main: newStock,
          last_purchase_price: incomingPrice,
          avg_purchase_price: newAvg
        };
      }
    }
    
    saveLocalData('meridien_inventory_items', inventoryItems);
    
    return newInvoice;
  },
  async updatePurchaseInvoice(id: string, updates: Partial<PurchaseInvoice>): Promise<PurchaseInvoice> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('purchase_invoices')
          .update(updates)
          .eq('id', id)
          .select()
          .single();
        if (!error && data) return data;
        console.warn("Supabase updatePurchaseInvoice failed", error);
      } catch (err) {
        console.warn("Supabase updatePurchaseInvoice failed", err);
      }
    }
    const invoices = await this.getPurchaseInvoices();
    const index = invoices.findIndex(i => i.id === id);
    if (index > -1) {
      invoices[index] = { ...invoices[index], ...updates };
      saveLocalData('meridien_purchase_invoices', invoices);
      return invoices[index];
    }
    throw new Error("Invoice not found");
  },


  // --- MANUFACTURING ORDERS ---
  async getManufacturingOrders(): Promise<ManufacturingOrder[]> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('manufacturing_orders')
          .select('*')
          .order('created_at', { ascending: false });
        if (!error) return data || [];
      } catch (err) {
        console.warn("Supabase getManufacturingOrders failed", err);
      }
    }
    return getLocalData('meridien_mfg_orders', []);
  },
  async addManufacturingOrder(order: Omit<ManufacturingOrder, 'id'>): Promise<ManufacturingOrder> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('manufacturing_orders')
          .insert([order])
          .select()
          .single();
        if (!error && data) {
          await this.addNotification({
            title: 'طلب تصنيع / صرف جديد',
            message: `تم طلب صرف مواد للمطبخ بواسطة ${order.requested_by}`,
            target_role: 'inventory_manager'
          });
          return data;
        }
      } catch (err) {
        console.warn("Supabase addManufacturingOrder failed", err);
      }
    }
    const newOrder: ManufacturingOrder = { ...order, id: crypto.randomUUID(), created_at: new Date().toISOString() };
    const orders = await this.getManufacturingOrders();
    saveLocalData('meridien_mfg_orders', [...orders, newOrder]);
    
    // Create Notification
    await this.addNotification({
      title: 'طلب تصنيع / صرف جديد',
      message: `تم طلب صرف مواد للمطبخ بواسطة ${newOrder.requested_by}`,
      target_role: 'inventory_manager'
    });
    
    return newOrder;
  },
  async updateManufacturingOrderStatus(id: string, status: 'approved' | 'rejected', approved_by: string): Promise<void> {
    if (supabase) {
      try {
        const { data: order, error } = await supabase
          .from('manufacturing_orders')
          .update({ status, approved_by })
          .eq('id', id)
          .select()
          .single();
        if (!error && order) {
          if (status === 'approved') {
            for (const itemReq of order.items) {
              const { data: itemData } = await supabase
                .from('inventory_items')
                .select('stock_main, stock_factory')
                .eq('id', itemReq.item_id)
                .single();
              if (itemData) {
                const newStockMain = (Number(itemData.stock_main) || 0) - itemReq.calculated_main_quantity;
                const newStockFactory = (Number(itemData.stock_factory) || 0) + itemReq.calculated_main_quantity;
                await supabase
                  .from('inventory_items')
                  .update({ stock_main: newStockMain, stock_factory: newStockFactory })
                  .eq('id', itemReq.item_id);
              }
            }
            await this.addNotification({
              title: 'تمت الموافقة على الطلب',
              message: `تمت الموافقة على طلب الصرف من قبل ${approved_by}`,
              target_role: 'kitchen_manager'
            });
          } else {
            await this.addNotification({
              title: 'تم رفض الطلب',
              message: `تم رفض طلب الصرف من قبل ${approved_by}`,
              target_role: 'kitchen_manager'
            });
          }
          return;
        }
      } catch (err) {
        console.warn("Supabase updateManufacturingOrderStatus failed", err);
      }
    }
    const orders = await this.getManufacturingOrders();
    const orderIndex = orders.findIndex(o => o.id === id);
    if (orderIndex === -1) return;
    
    const order = orders[orderIndex];
    order.status = status;
    order.approved_by = approved_by;
    saveLocalData('meridien_mfg_orders', orders);

    if (status === 'approved') {
      const inventoryItems = await this.getInventoryItems();
      for (const itemReq of order.items) {
        const itemIndex = inventoryItems.findIndex(i => i.id === itemReq.item_id);
        if (itemIndex > -1) {
          inventoryItems[itemIndex].stock_main -= itemReq.calculated_main_quantity;
          inventoryItems[itemIndex].stock_factory += itemReq.calculated_main_quantity;
        }
      }
      saveLocalData('meridien_inventory_items', inventoryItems);
      
      await this.addNotification({
        title: 'تمت الموافقة على الطلب',
        message: `تمت الموافقة على طلب الصرف من قبل ${approved_by}`,
        target_role: 'kitchen_manager'
      });
    } else {
      await this.addNotification({
        title: 'تم رفض الطلب',
        message: `تم رفض طلب الصرف من قبل ${approved_by}`,
        target_role: 'kitchen_manager'
      });
    }
  },

  // --- NOTIFICATIONS ---
  async getNotifications(role: string): Promise<SystemNotification[]> {
    const all = getLocalData('meridien_notifications', []) as SystemNotification[];
    return all.filter(n => n.target_role === 'all' || n.target_role === role);
  },
  async addNotification(notif: Omit<SystemNotification, 'id' | 'created_at' | 'is_read'>): Promise<void> {
    const all = getLocalData('meridien_notifications', []) as SystemNotification[];
    const newNotif: SystemNotification = {
      ...notif,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      is_read: false
    };
    saveLocalData('meridien_notifications', [newNotif, ...all]);
  },
  async markNotificationRead(id: string): Promise<void> {
    const all = getLocalData('meridien_notifications', []) as SystemNotification[];
    const idx = all.findIndex(n => n.id === id);
    if (idx > -1) {
      all[idx].is_read = true;
      saveLocalData('meridien_notifications', all);
    }
  },

  // --- Production Logs (Factory to Distribution) ---
  async getProductionLogs(): Promise<ProductionLog[]> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('production_logs')
          .select('*')
          .order('created_at', { ascending: false });
        if (!error) return data || [];
      } catch (err) {
        console.warn("Supabase getProductionLogs failed", err);
      }
    }
    return getLocalData('meridien_production_logs', []) as ProductionLog[];
  },
  async addProductionLog(logData: Omit<ProductionLog, 'id' | 'created_at'>): Promise<void> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('production_logs')
          .insert([logData])
          .select()
          .single();
        if (!error && data) {
          // Process consumed items (Decrease factory stock)
          for (const consumed of logData.consumed_items) {
            const { data: itemData } = await supabase
              .from('inventory_items')
              .select('stock_factory')
              .eq('id', consumed.item_id)
              .single();
            if (itemData) {
              const newStockFactory = Math.max(0, (Number(itemData.stock_factory) || 0) - consumed.quantity);
              await supabase
                .from('inventory_items')
                .update({ stock_factory: newStockFactory })
                .eq('id', consumed.item_id);
            }
          }
          // Process produced items (Increase distribution stock)
          for (const produced of logData.produced_items) {
            const { data: itemData } = await supabase
              .from('inventory_items')
              .select('stock_distribution')
              .eq('id', produced.item_id)
              .single();
            if (itemData) {
              const newStockDist = (Number(itemData.stock_distribution) || 0) + produced.quantity;
              await supabase
                .from('inventory_items')
                .update({ stock_distribution: newStockDist })
                .eq('id', produced.item_id);
            }
          }
          return;
        }
      } catch (err) {
        console.warn("Supabase addProductionLog failed", err);
      }
    }
    const all = getLocalData('meridien_production_logs', []) as ProductionLog[];
    const newLog: ProductionLog = {
      ...logData,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString()
    };
    saveLocalData('meridien_production_logs', [newLog, ...all]);

    // Update inventory: decrease stock_factory for consumed, increase stock_distribution for produced
    const items = getLocalData('meridien_inventory_items', []) as InventoryItem[];
    let updated = false;

    // Process consumed items (Decrease factory stock)
    for (const consumed of logData.consumed_items) {
      const itemIdx = items.findIndex(i => i.id === consumed.item_id);
      if (itemIdx > -1) {
        items[itemIdx].stock_factory = Math.max(0, (items[itemIdx].stock_factory || 0) - consumed.quantity);
        updated = true;
      }
    }

    // Process produced items (Increase distribution stock)
    for (const produced of logData.produced_items) {
      const itemIdx = items.findIndex(i => i.id === produced.item_id);
      if (itemIdx > -1) {
        items[itemIdx].stock_distribution = (items[itemIdx].stock_distribution || 0) + produced.quantity;
        updated = true;
      }
    }

    if (updated) {
      saveLocalData('meridien_inventory_items', items);
    }
  },

  // --- PRODUCT RECIPES ---
  async getProductRecipes(productId: string): Promise<ProductRecipe[]> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('product_recipes')
          .select(`
            id,
            product_id,
            inventory_item_id,
            quantity,
            created_at,
            inventory_items (
              name,
              unit
            )
          `)
          .eq('product_id', productId);
        if (!error && data) {
          return data.map((d: any) => ({
            id: d.id,
            product_id: d.product_id,
            inventory_item_id: d.inventory_item_id,
            quantity: Number(d.quantity),
            created_at: d.created_at,
            inventory_item_name: d.inventory_items?.name,
            inventory_item_unit: d.inventory_items?.unit
          }));
        }
      } catch (err) {
        console.warn("Supabase getProductRecipes failed", err);
      }
    }
    const allRecipes = getLocalData('meridien_product_recipes', initialProductRecipes);
    const filtered = allRecipes.filter(r => r.product_id === productId);
    const items = await this.getInventoryItems();
    return filtered.map(r => {
      const item = items.find(i => i.id === r.inventory_item_id);
      return {
        ...r,
        inventory_item_name: item?.name || 'مكون غير معروف',
        inventory_item_unit: item?.unit || ''
      };
    });
  },

  async updateProductRecipe(productId: string, recipeItems: Array<{ inventory_item_id: string, quantity: number }>): Promise<ProductRecipe[]> {
    if (supabase) {
      try {
        await supabase
          .from('product_recipes')
          .delete()
          .eq('product_id', productId);
        
        if (recipeItems.length > 0) {
          const insertData = recipeItems.map(item => ({
            product_id: productId,
            inventory_item_id: item.inventory_item_id,
            quantity: item.quantity
          }));
          const { error } = await supabase
            .from('product_recipes')
            .insert(insertData);
          if (error) throw error;
        }
        return this.getProductRecipes(productId);
      } catch (err) {
        console.warn("Supabase updateProductRecipe failed", err);
      }
    }
    let allRecipes = getLocalData('meridien_product_recipes', initialProductRecipes);
    allRecipes = allRecipes.filter(r => r.product_id !== productId);
    
    const newRecipes = recipeItems.map(item => ({
      id: crypto.randomUUID(),
      product_id: productId,
      inventory_item_id: item.inventory_item_id,
      quantity: item.quantity,
      created_at: new Date().toISOString()
    }));
    
    allRecipes.push(...newRecipes);
    saveLocalData('meridien_product_recipes', allRecipes);
    return this.getProductRecipes(productId);
  },

  // --- AUTOMATIC CASHIER STOCK DEDUCTION ---
  async deductInventoryForOrder(order: Order): Promise<number> {
    if (order.status !== 'completed' || order.inventory_deducted) {
      return 0;
    }

    let total_cost = 0;

    try {
      if (supabase) {
        for (const item of order.items) {
          // 1. Deduct recipe ingredients
          const { data: recipes, error } = await supabase
            .from('product_recipes')
            .select('inventory_item_id, quantity')
            .eq('product_id', item.id);
          
          if (!error && recipes) {
            for (const rec of recipes) {
              const deductQty = rec.quantity * item.quantity;
              
              const { data: itemData } = await supabase
                .from('inventory_items')
                .select('name, stock_distribution, avg_purchase_price, low_stock_threshold')
                .eq('id', rec.inventory_item_id)
                .single();
              
              if (itemData) {
                total_cost += (Number(itemData.avg_purchase_price) || 0) * deductQty;
                const newStockDist = Math.max(0, (Number(itemData.stock_distribution) || 0) - deductQty);
                await supabase
                  .from('inventory_items')
                  .update({ stock_distribution: newStockDist })
                  .eq('id', rec.inventory_item_id);

                if (newStockDist <= (Number(itemData.low_stock_threshold) || 5000)) {
                  await this.addNotification({
                    title: 'تنبيه: اقتراب نفاذ المخزون',
                    message: `الخامة "${itemData.name}" اقتربت من النفاذ في المخزن الموزع. الكمية المتبقية: ${newStockDist}`,
                    target_role: 'admin'
                  });
                }
              }
            }
          }

          // 2. Also deduct the product itself if it exists in inventory_items
          const { data: prodItem } = await supabase
            .from('inventory_items')
            .select('name, stock_distribution, avg_purchase_price, low_stock_threshold')
            .eq('id', item.id)
            .single();

          if (prodItem) {
            total_cost += (Number(prodItem.avg_purchase_price) || 0) * item.quantity;
            const newStockDist = Math.max(0, (Number(prodItem.stock_distribution) || 0) - item.quantity);
            await supabase
              .from('inventory_items')
              .update({ stock_distribution: newStockDist })
              .eq('id', item.id);

            if (newStockDist <= (Number(prodItem.low_stock_threshold) || 5000)) {
              await this.addNotification({
                title: 'تنبيه: اقتراب نفاذ المخزون',
                message: `الصنف "${prodItem.name}" اقترب من النفاذ في المخزن الموزع. الكمية المتبقية: ${newStockDist}`,
                target_role: 'admin'
              });
            }
          }
        }
      } else {
        const items = await this.getInventoryItems();
        const allRecipes = getLocalData('meridien_product_recipes', initialProductRecipes);
        let updated = false;

        for (const item of order.items) {
          // 1. Deduct recipe ingredients
          const productRecipes = allRecipes.filter(r => r.product_id === item.id);
          for (const rec of productRecipes) {
            const deductQty = rec.quantity * item.quantity;
            const itemIdx = items.findIndex(i => i.id === rec.inventory_item_id);
            if (itemIdx > -1) {
              total_cost += (items[itemIdx].avg_purchase_price || 0) * deductQty;
              items[itemIdx].stock_distribution = Math.max(0, (items[itemIdx].stock_distribution || 0) - deductQty);
              updated = true;

              if (items[itemIdx].stock_distribution <= (items[itemIdx].low_stock_threshold || 5000)) {
                await this.addNotification({
                  title: 'تنبيه: اقتراب نفاذ المخزون',
                  message: `الخامة "${items[itemIdx].name}" اقتربت من النفاذ في المخزن الموزع. الكمية المتبقية: ${items[itemIdx].stock_distribution}`,
                  target_role: 'admin'
                });
              }
            }
          }

          // 2. Deduct product itself
          const prodItemIdx = items.findIndex(i => i.id === item.id);
          if (prodItemIdx > -1) {
            total_cost += (items[prodItemIdx].avg_purchase_price || 0) * item.quantity;
            items[prodItemIdx].stock_distribution = Math.max(0, (items[prodItemIdx].stock_distribution || 0) - item.quantity);
            updated = true;

            if (items[prodItemIdx].stock_distribution <= (items[prodItemIdx].low_stock_threshold || 5000)) {
              await this.addNotification({
                title: 'تنبيه: اقتراب نفاذ المخزون',
                message: `الصنف "${items[prodItemIdx].name}" اقترب من النفاذ في المخزن الموزع. الكمية المتبقية: ${items[prodItemIdx].stock_distribution}`,
                target_role: 'admin'
              });
            }
          }
        }

        if (updated) {
          saveLocalData('meridien_inventory_items', items);
        }
      }

      order.inventory_deducted = true;
    } catch (err) {
      console.error("Error in deductInventoryForOrder:", err);
    }
    return total_cost;
  },

  // --- CUSTOMERS (الحسابات الآجلة) ---
  async getCustomers(): Promise<Customer[]> {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
      } catch (err) {
        console.warn("Supabase fetch failed, falling back to mock database.", err);
      }
    }
    return getLocalData('meridien_customers', []) as Customer[];
  },

  async addCustomer(customer: Omit<Customer, 'id' | 'created_at'>): Promise<Customer> {
    const newCust = {
      ...customer,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString()
    };
    if (supabase) {
      try {
        const { data, error } = await supabase.from('customers').insert([newCust]).select().single();
        if (error) throw error;
        return data;
      } catch (err) {
        console.warn("Supabase insert failed, falling back to mock database.", err);
      }
    }
    const customers = await this.getCustomers();
    customers.unshift(newCust);
    saveLocalData('meridien_customers', customers);
    return newCust;
  },

  async updateCustomerDebt(id: string, newDebt: number): Promise<void> {
    if (supabase) {
      try {
        const { error } = await supabase.from('customers').update({ total_debt: newDebt }).eq('id', id);
        if (error) throw error;
        return;
      } catch (err) {
        console.warn("Supabase update failed, falling back to mock database.", err);
      }
    }
    const customers = await this.getCustomers();
    const idx = customers.findIndex(c => c.id === id);
    if (idx > -1) {
      customers[idx].total_debt = newDebt;
      saveLocalData('meridien_customers', customers);
    }
  },

  // --- EMPLOYEES ---
  async getEmployees(): Promise<Employee[]> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('employees')
          .select('*')
          .order('name', { ascending: true });
        if (!error) return data || [];
      } catch (err) {
        console.warn("Supabase fetch employees failed", err);
      }
    }
    return getLocalData('meridien_employees', [] as Employee[]);
  },

  async addEmployee(employee: Omit<Employee, 'id' | 'created_at'>): Promise<Employee> {
    const newEmp: Employee = {
      ...employee,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString()
    };
    if (supabase) {
      try {
        const { data, error } = await supabase.from('employees').insert([newEmp]).select().single();
        if (!error && data) return data;
      } catch (err) {
        console.warn("Supabase insert employee failed", err);
      }
    }
    const employees = getLocalData('meridien_employees', [] as Employee[]);
    employees.push(newEmp);
    saveLocalData('meridien_employees', employees);
    return newEmp;
  },

  async deleteEmployee(id: string): Promise<boolean> {
    if (supabase) {
      try {
        const { error } = await supabase.from('employees').delete().eq('id', id);
        if (!error) return true;
      } catch (err) {
        console.warn("Supabase delete employee failed", err);
      }
    }
    const employees = getLocalData('meridien_employees', [] as Employee[]);
    const updated = employees.filter(e => e.id !== id);
    saveLocalData('meridien_employees', updated);
    return true;
  },

  // --- ATTENDANCE LOGS ---
  async getAttendanceLogs(): Promise<AttendanceLog[]> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('attendance_logs')
          .select('*')
          .order('check_in_time', { ascending: false });
        if (!error) return data || [];
      } catch (err) {
        console.warn("Supabase fetch attendance failed", err);
      }
    }
    return getLocalData('meridien_attendance_logs', [] as AttendanceLog[]);
  },

  async addAttendanceLog(log: Omit<AttendanceLog, 'id' | 'created_at'>): Promise<AttendanceLog> {
    const newLog: AttendanceLog = {
      ...log,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString()
    };
    if (supabase) {
      try {
        const { data, error } = await supabase.from('attendance_logs').insert([newLog]).select().single();
        if (!error && data) return data;
      } catch (err) {
        console.warn("Supabase insert attendance failed", err);
      }
    }
    const logs = getLocalData('meridien_attendance_logs', [] as AttendanceLog[]);
    logs.unshift(newLog);
    saveLocalData('meridien_attendance_logs', logs);
    return newLog;
  },

  async updateAttendanceLog(id: string, updates: Partial<AttendanceLog>): Promise<AttendanceLog> {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('attendance_logs').update(updates).eq('id', id).select().single();
        if (!error && data) return data;
      } catch (err) {
        console.warn("Supabase update attendance failed", err);
      }
    }
    const logs = getLocalData('meridien_attendance_logs', [] as AttendanceLog[]);
    const index = logs.findIndex(l => l.id === id);
    if (index === -1) throw new Error("Attendance log not found");
    logs[index] = { ...logs[index], ...updates };
    saveLocalData('meridien_attendance_logs', logs);
    return logs[index];
  },

  // --- EMPLOYEE TRANSACTIONS ---
  async getEmployeeTransactions(): Promise<EmployeeTransaction[]> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('employee_transactions')
          .select('*')
          .order('date', { ascending: false });
        if (!error) return data || [];
      } catch (err) {
        console.warn("Supabase fetch transactions failed", err);
      }
    }
    return getLocalData('meridien_employee_transactions', [] as EmployeeTransaction[]);
  },

  async addEmployeeTransaction(tx: Omit<EmployeeTransaction, 'id' | 'created_at'>): Promise<EmployeeTransaction> {
    const newTx: EmployeeTransaction = {
      ...tx,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString()
    };
    if (supabase) {
      try {
        const { data, error } = await supabase.from('employee_transactions').insert([newTx]).select().single();
        if (!error && data) return data;
      } catch (err) {
        console.warn("Supabase insert transaction failed", err);
      }
    }
    const txs = getLocalData('meridien_employee_transactions', [] as EmployeeTransaction[]);
    txs.unshift(newTx);
    saveLocalData('meridien_employee_transactions', txs);
    return newTx;
  },

  async deleteEmployeeTransaction(id: string): Promise<boolean> {
    if (supabase) {
      try {
        const { error } = await supabase.from('employee_transactions').delete().eq('id', id);
        if (!error) return true;
      } catch (err) {
        console.warn("Supabase delete transaction failed", err);
      }
    }
    const txs = getLocalData('meridien_employee_transactions', [] as EmployeeTransaction[]);
    const updated = txs.filter(t => t.id !== id);
    saveLocalData('meridien_employee_transactions', updated);
    return true;
  }
};



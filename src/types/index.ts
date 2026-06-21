// TypeScript interfaces for Meridien Restaurant App

export interface Category {
  id: string;
  name_ar: string;
  name_en: string;
  sort_order: number;
  printer_id?: string | null;
  created_at?: string;
}

export interface Printer {
  id: string;
  name_ar: string;
  name_en: string;
  created_at?: string;
}

export interface Product {
  id: string;
  category_id: string;
  name_ar: string;
  name_en: string;
  price: number;
  image_url: string;
  description_ar: string;
  description_en: string;
  is_available: boolean;
  recipe_ar?: string;
  recipe_en?: string;
  talabat_price?: number;
  created_at?: string;
}

export interface OrderItem {
  id: string;
  name_ar: string;
  name_en: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  customer_name: string;
  customer_phone: string;
  table_number: string;
  promo_code?: string | null;
  items: OrderItem[];
  total_price: number;
  status: 'pending' | 'preparing' | 'delivered' | 'completed' | 'cancelled';
  order_type?: 'takeaway' | 'talabat' | 'dine_in' | 'delivery';
  waiter_id?: string;
  waiter_name?: string;
  payment_method?: 'cash' | 'visa' | 'wallet' | 'split';
  payment_details?: any; // JSON representation of split payments
  created_at: string;
}

export interface PromoCodeDetails {
  discount: number;
  expiryDate?: string | null; // Format YYYY-MM-DD
  usageLimit?: number | null; // Max usage per unique phone number
}

export interface RestaurantSettings {
  id: string;
  restaurant_name_ar: string;
  restaurant_name_en: string;
  logo_url: string;
  whatsapp_number: string;
  promo_codes: Record<string, number | PromoCodeDetails>; // Supports legacy number or advanced PromoCodeDetails
  offers: string[];
  facebook_url: string;
  instagram_url: string;
  tiktok_url: string;
  snapchat_url: string;
  talabat_url: string;
  tax_percent?: number;
  service_percent?: number;
}

export interface Expense {
  id: string;
  name: string;
  type: string; // classification e.g. 'بضائع', 'مرتبات', etc.
  amount: number;
  payment_method: 'cash' | 'visa' | 'wallet' | 'instapay';
  expense_date: string;
  created_at?: string;
}

export interface SystemUser {
  id: string;
  name: string;
  phone: string;
  username: string;
  passcode: string;
  role: string;
  created_at?: string;
}

export interface RecipeComment {
  id: string;
  product_id: string;
  user_name: string;
  comment: string;
  created_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  created_at?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  unit: string; // e.g. "كجم", "قطعة", "لتر"
  
  // Stock levels
  stock_main: number;
  stock_factory: number;
  stock_distribution: number;
  
  // Cost tracking
  last_purchase_price: number;
  avg_purchase_price: number;
  
  created_at?: string;
}

export interface PurchaseInvoiceItem {
  item_id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface PurchaseInvoice {
  id: string;
  supplier_id: string;
  supplier_name: string;
  invoice_date: string;
  items: PurchaseInvoiceItem[];
  total_amount: number;
  created_at?: string;
}

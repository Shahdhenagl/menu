// TypeScript interfaces for Meridien Restaurant App

export interface Category {
  id: string;
  name_ar: string;
  name_en: string;
  sort_order: number;
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
  status: 'pending' | 'completed' | 'cancelled';
  created_at: string;
}

export interface RestaurantSettings {
  id: string;
  restaurant_name_ar: string;
  restaurant_name_en: string;
  logo_url: string;
  whatsapp_number: string;
  promo_codes: Record<string, number>; // code -> discount percentage
  offers: string[];
  facebook_url: string;
  instagram_url: string;
  tiktok_url: string;
  snapchat_url: string;
}

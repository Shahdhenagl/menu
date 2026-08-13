// TypeScript interfaces for Meridien Restaurant App

export interface Category {
  id: string;
  name_ar: string;
  name_en: string;
  sort_order: number;
  printer_id?: string | null;
  department?: 'restaurant' | 'bar';
  show_on_menu?: boolean;
  created_at?: string;
}

export interface Printer {
  id: string;
  name_ar: string;
  name_en: string;
  department?: 'restaurant' | 'bar';
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
  department?: 'restaurant' | 'bar';
  created_at?: string;
}

/** الخزنة اللي بيتحصّل فيها الأوردر */
export type DrawerId = 1 | 2;

export interface OrderItem {
  id: string;
  name_ar: string;
  name_en: string;
  price: number;
  quantity: number;
  note?: string;
}

export interface Order {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_id?: string; // For deferred payment tracking
  table_number: string;
  hall?: string;            // اسم الصالة (لطلبات الصالة)
  drawer?: DrawerId;        // الخزنة اللي اتحصّل فيها (من الصالة أو باختيار الكاشير)
  partner_id?: string;       // أوردر على طاولة شريك/أونر
  partner_discount_percent?: number;
  partner_subtotal?: number;
  partner_amount_due?: number; // قيمة كشف الشريك بعد الخصم
  promo_code?: string | null;
  items: OrderItem[];
  total_price: number;
  total_cost?: number; // COGS for profit calculation
  status: 'pending' | 'preparing' | 'prepared' | 'delivered' | 'completed' | 'cancelled';
  order_type?: 'takeaway' | 'talabat' | 'dine_in' | 'delivery' | 'website';
  waiter_id?: string;
  waiter_name?: string;
  // 'staff' = طلب استاف مجاني (بيتسجل بالاسم وبيخصم من المخزون بس مبيتحسبش مبيعات)
  payment_method?: 'cash' | 'visa' | 'wallet_restaurant' | 'wallet_cafe' | 'instapay' | 'split' | 'deferred' | 'hospitality' | 'petty_cash' | 'staff' | 'partner';
  payment_details?: any; // JSON representation of split payments
  inventory_deducted?: boolean;
  operating_day?: string; // يوم التشغيل المحاسبي، مستقل عن التاريخ الميلادي بعد الإغلاق
  created_at: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  total_debt: number;
  created_at?: string;
}

export interface CustomerPayment {
  id: string;
  customer_id: string;
  amount: number;
  payment_method: 'cash' | 'visa' | 'wallet_restaurant' | 'wallet_cafe' | 'instapay';
  notes?: string;
  employee_id?: string;
  employee_name?: string;
  payment_date: string;
  drawer?: DrawerId;
  created_at?: string;
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
  location_url?: string;
  tax_percent?: number;                   // النسبة العامة (الافتراضية)
  tax_percent_delivery?: number;          // ضريبة الدليفري
  tax_percent_takeaway?: number;          // ضريبة التيك أواي
  service_percent?: number;
  // الصالات: كل صالة نسبة ضريبتها والخزنة اللي بتحصّل فيها
  halls?: { name: string; tax_percent: number; drawer?: DrawerId }[];
  drawer_1_name?: string;                 // اسم خزنة 1 (افتراضي "خزنة 1")
  drawer_2_name?: string;                 // اسم خزنة 2
  telegram_bot_token?: string;
  telegram_chat_id?: string;
  enable_qz_printing?: boolean;
  qz_printer_cashier?: string;
  qz_printer_kitchen?: string;
  qz_printer_kitchen_2?: string;
  qz_printer_bar?: string;
  qz_printer_bar_2?: string;
}

export interface Expense {
  id: string;
  name: string;
  type: string; // classification e.g. 'بضائع', 'مرتبات', etc.
  amount: number;
  payment_method: 'cash' | 'visa' | 'wallet_restaurant' | 'wallet_cafe' | 'instapay' | 'petty_cash';
  partner_id?: string;
  expense_date: string;
  drawer?: DrawerId;
  created_at?: string;
  notes?: string;
  employee_id?: string;
  employee_name?: string;
  source?: 'pos' | 'admin';
  classification_status?: 'pending' | 'general' | 'inventory_purchase';
  purchase_invoice_id?: string;
  supplier_name?: string;
  inventory_item_id?: string;
  inventory_item_name?: string;
  inventory_quantity?: number;
  inventory_unit_price?: number;
}

export interface SystemUser {
  id: string;
  name: string;
  phone: string;
  username: string;
  passcode: string;
  role: string;
  job_title?: string; // Custom job title e.g. 'أمين مخزن', 'مسؤول توزيع'
  created_at?: string;
  is_active?: boolean;
  last_active_at?: string;
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
  stock_bar: number;
  
  // Cost tracking
  last_purchase_price: number;
  avg_purchase_price: number;
  
  units_per_carton?: number;
  units_per_box?: number;
  
  low_stock_threshold?: number; // Threshold in grams/units for low stock warning
  is_manufactured?: boolean; // True if this item is manufactured in the kitchen/factory

  created_at?: string;
}

export interface ManufacturingRecipeItem {
  id: string;
  manufactured_item_id: string;
  ingredient_item_id: string;
  quantity: number;
  
  // For UI display purposes
  ingredient_name?: string;
  ingredient_unit?: string;
  
  created_at?: string;
}

export interface InventoryMovement {
  id: string;
  item_id: string;
  warehouse: 'main' | 'factory' | 'distribution';
  type: 'in' | 'out' | 'waste' | 'adjustment';
  quantity: number;
  unit_price: number;
  total_price: number;
  description?: string;
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
  paid_cash?: number;
  paid_visa?: number;
  paid_wallet?: number;
  paid_instapay?: number;
  paid_petty_cash?: number;   // مدفوع من عهدة الشريك
  partner_id?: string;        // الشريك اللي اتخصم من عهدته
  remaining_amount?: number;
  created_at?: string;
}

export interface ManufacturingOrderItem {
  item_id: string;
  item_name: string;
  quantity: number;
  unit: string; // 'kilo' | 'gram' | 'unit' | 'carton' | 'box'
  calculated_main_quantity: number; // The converted amount that will actually be deducted from the main stock
}

export interface ManufacturingOrder {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  items: ManufacturingOrderItem[];
  requested_by: string; // user name or id
  approved_by?: string; // user name or id
  created_at?: string;
}

export interface SystemNotification {
  id: string;
  title: string;
  message: string;
  target_role: string | 'all'; // e.g. 'inventory_manager', 'kitchen_manager', 'admin'
  notification_type?: 'order_new' | 'order_update' | 'order_delete' | 'mfg_request' | 'mfg_approved' | 'mfg_rejected' | 'transfer_request' | 'transfer_approved' | 'transfer_rejected' | 'low_stock' | 'general';
  is_read: boolean;
  created_at: string;
}

export interface ProductionConsumedItem {
  item_id: string;
  item_name: string;
  quantity: number;
}

export interface ProductionProducedItem {
  item_id: string;
  item_name: string;
  quantity: number;
}

export interface ProductionLog {
  id: string;
  produced_items: ProductionProducedItem[];
  consumed_items: ProductionConsumedItem[];
  recorded_by: string;
  notes?: string;
  created_at?: string;
}

// Transfer request: Kitchen → Distribution warehouse (requires approval)
export interface TransferRequestItem {
  item_id: string;
  item_name: string;
  quantity: number;
  unit: string;
}

export interface TransferRequest {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  items: TransferRequestItem[]; // Items being transferred from kitchen to distribution
  requested_by: string; // Kitchen manager/user
  approved_by?: string;  // Distribution manager/admin
  notes?: string;
  rejection_reason?: string;
  created_at?: string;
}

// Distribution warehouse product catalog
export interface BarProduct {
  id: string;
  name: string;
  unit: string;
  category?: string;
  stock_quantity: number;
  unit_price: number;
  notes?: string;
  created_at?: string;
}

export interface FinancialTransaction {
  id: string;
  type: 'fund_transfer' | 'debt_settlement';
  amount: number;
  from_method?: 'cash' | 'visa' | 'wallet_restaurant' | 'wallet_cafe' | 'instapay' | 'deferred' | 'petty_cash'; // e.g. from cash drawer
  to_method?: 'cash' | 'visa' | 'wallet_restaurant' | 'wallet_cafe' | 'instapay' | 'deferred' | 'petty_cash';   // e.g. to visa
  partner_id?: string; // used when from_method or to_method is 'petty_cash'
  description?: string;
  customer_id?: string; // used when type === 'debt_settlement'
  created_at?: string;
}

// ===== التقفيل اليومي =====
export type PaymentMethodKey = 'cash' | 'visa' | 'wallet_restaurant' | 'wallet_cafe' | 'instapay' | 'deferred' | 'petty_cash' | 'partner';

/** تقفيل وسيلة دفع واحدة داخل تقفيل اليوم */
export interface DailyClosingMethod {
  method: PaymentMethodKey;
  incoming: number;    // وارد اليوم من الوسيلة دي
  outgoing: number;    // صادر (مصروفات) من الوسيلة دي
  expected: number;    // المفروض يكون موجود = وارد - صادر
  counted: number;     // المعدود فعليًا من الكاشير
  difference: number;  // counted - expected (موجب = زيادة، سالب = عجز)
  note?: string;
}

export interface DailyClosing {
  id: string;
  closing_date: string;              // YYYY-MM-DD
  status: 'closed' | 'reopened';
  methods: DailyClosingMethod[];
  total_expected: number;
  total_counted: number;
  total_difference: number;
  orders_count: number;
  expenses_count: number;
  drawer_1_closed?: boolean;
  drawer_2_closed?: boolean;
  drawer_1_methods?: DailyClosingMethod[];
  drawer_2_methods?: DailyClosingMethod[];
  drawer_1_total_expected?: number;
  drawer_2_total_expected?: number;
  drawer_1_total_counted?: number;
  drawer_2_total_counted?: number;
  notes?: string;
  closed_by?: string;
  closed_at?: string;
  created_at?: string;
}

// ===== تقفيل الشفت (لكل صالة) =====
export interface ShiftClosingLine { name: string; qty: number; total: number }
export interface ShiftClosingCategory { name: string; qty: number; total: number; lines: ShiftClosingLine[] }
export interface ShiftClosingMethod { method: string; label: string; amount: number }
/** تفصيل حسب نوع الطلب (صالة/دليفري/تيك أواي/طلبات) */
export interface ShiftClosingTypeRow {
  type: string; label: string; orders: number; subtotal: number; tax: number; collected: number;
}
/** تجميع الضرائب حسب النسبة */
export interface ShiftClosingTaxRow {
  percent: number; base: number; tax: number; collected: number; orders: number;
}

export interface ShiftClosing {
  id: string;
  bucket: string;           // 'drawer:1' أو 'drawer:2'
  bucket_label: string;
  from_at: string;          // بداية الفترة = آخر تقفيل
  to_at: string;            // لحظة التقفيل
  orders_count: number;
  items_count: number;
  subtotal: number;
  tax: number;
  discount: number;
  collected: number;
  methods: ShiftClosingMethod[];
  order_types: ShiftClosingTypeRow[];
  tax_groups: ShiftClosingTaxRow[];
  categories: ShiftClosingCategory[];
  order_ids: string[];
  closed_by?: string;
  created_at?: string;
  /** إجمالي إيداعات العملاء خلال الفترة */
  deposits: number;
  /** إجمالي المصروفات المسحوبة خلال الفترة */
  expenses: number;
  /** صافي المتوقع = المبيعات + الإيداعات - المصروفات */
  expectedBalance: number;
  /** تفصيل الإيداعات حسب وسيلة الدفع */
  depositsByMethod: ShiftClosingMethod[];
  /** تفصيل المصروفات حسب وسيلة الدفع */
  expensesByMethod: ShiftClosingMethod[];
  /** اتحفظ على الجهاز ده بس (الداتا بيز رفضت) — الواجهة بتحذّر */
  __localOnly?: boolean;
}

export interface Partner {
  id: string;
  name: string;
  phone?: string;
  opening_balance: number; // For example: positive means partner invested this much.
  table_names?: string[];
  created_at?: string;
}

export interface PartnerTransaction {
  id: string;
  partner_id: string;
  type: 'credit' | 'debit'; // credit: additions to partner (داين), debit: deductions from partner (مدين)
  amount: number;
  description?: string;
  order_id?: string;
  hall?: string;
  table_number?: string;
  created_at?: string;
}


export interface ProductRecipe {
  id: string;
  product_id: string;
  inventory_item_id: string;
  quantity: number;
  created_at?: string;
  inventory_item_name?: string; // resolved item name for convenience in UI
  inventory_item_unit?: string; // resolved unit for convenience in UI
}

export interface Employee {
  id: string;
  name: string;
  phone: string;
  salary: number;
  allowed_vacations: number;
  working_hours?: number;
  created_at: string;
}

export interface AttendanceLog {
  id: string;
  employee_id: string;
  employee_name: string;
  check_in_time: string;
  check_out_time?: string | null;
  check_in_photo?: string;
  check_out_photo?: string;
  working_hours?: number;
  penalty_applied?: number;
  date: string; // YYYY-MM-DD
  created_at: string;
}

export interface EmployeeTransaction {
  id: string;
  employee_id: string;
  type: 'advance' | 'bonus' | 'discount' | 'vacation_paid' | 'vacation_unpaid';
  amount: number;
  date: string; // YYYY-MM-DD
  notes?: string;
  created_at: string;
}



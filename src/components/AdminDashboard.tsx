import { useState, useEffect } from 'react';
import type { Category, Product, Order, RestaurantSettings, OrderItem } from '../types';
import { db } from '../lib/supabase';
import { 
  BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, Cell, AreaChart, Area 
} from 'recharts';
import { 
  Plus, Edit, Trash2, X, PlusCircle, Save, LogOut, Lock, 
  LayoutDashboard, FolderOpen, Coffee, Users, Settings as Gear, Calendar, Sparkles
} from 'lucide-react';

interface AdminDashboardProps {
  onClose: () => void;
  categories: Category[];
  products: Product[];
  orders: Order[];
  settings: RestaurantSettings;
  refreshData: () => Promise<void>;
  language: 'ar' | 'en';
}

type TabType = 'analytics' | 'categories' | 'products' | 'orders' | 'customers' | 'settings';

export default function AdminDashboard({
  onClose,
  categories,
  products,
  orders,
  settings,
  refreshData,
  language
}: AdminDashboardProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [passcodeError, setPasscodeError] = useState('');
  
  const [activeTab, setActiveTab] = useState<TabType>('analytics');

  // --- CRUD States ---
  // Categories modal / inputs
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [catNameAr, setCatNameAr] = useState('');
  const [catNameEn, setCatNameEn] = useState('');
  const [catSortOrder, setCatSortOrder] = useState(0);

  // Products modal / inputs
  const [prodModalOpen, setProdModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [prodCatId, setProdCatId] = useState('');
  const [prodNameAr, setProdNameAr] = useState('');
  const [prodNameEn, setProdNameEn] = useState('');
  const [prodPrice, setProdPrice] = useState(0);
  const [prodImageUrl, setProdImageUrl] = useState('');
  const [prodDescAr, setProdDescAr] = useState('');
  const [prodDescEn, setProdDescEn] = useState('');
  const [prodAvailable, setProdAvailable] = useState(true);

  // Settings inputs
  const [setLogoUrl, setSetLogoUrl] = useState(settings.logo_url);
  const [setWhatsapp, setSetWhatsapp] = useState(settings.whatsapp_number);
  const [setNameAr, setSetNameAr] = useState(settings.restaurant_name_ar);
  const [setNameEn, setSetNameEn] = useState(settings.restaurant_name_en);
  const [setFacebook, setSetFacebook] = useState(settings.facebook_url);
  const [setInstagram, setSetInstagram] = useState(settings.instagram_url);
  const [setTiktok, setSetTiktok] = useState(settings.tiktok_url);
  const [setSnapchat, setSetSnapchat] = useState(settings.snapchat_url);
  const [setTalabat, setSetTalabat] = useState(settings.talabat_url || '');
  
  // Custom promos / offers management
  const [newPromoCode, setNewPromoCode] = useState('');
  const [newPromoDiscount, setNewPromoDiscount] = useState(10);
  const [newOfferText, setNewOfferText] = useState('');
  const [promos, setPromos] = useState<Record<string, number>>(settings.promo_codes || {});
  const [offers, setOffers] = useState<string[]>(settings.offers || []);

  const [loading, setLoading] = useState(false);

  // Manual orders states & filtering
  const [orderFilterType, setOrderFilterType] = useState<'all' | 'day' | 'month' | 'year'>('all');
  const [selectedFilterDay, setSelectedFilterDay] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [selectedFilterMonth, setSelectedFilterMonth] = useState<string>(() => new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [selectedFilterYear, setSelectedFilterYear] = useState<number>(() => new Date().getFullYear());

  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [manualCustName, setManualCustName] = useState('');
  const [manualCustPhone, setManualCustPhone] = useState('');
  const [manualTableNum, setManualTableNum] = useState('');
  const [manualStatus, setManualStatus] = useState<'pending' | 'completed' | 'cancelled'>('pending');
  const [manualItems, setManualItems] = useState<Record<string, number>>({}); // productId -> quantity

  // Customers tab active profile view state
  const [selectedCustPhone, setSelectedCustPhone] = useState<string | null>(null);
  const [custSearch, setCustSearch] = useState('');

  // Sync settings when they change
  useEffect(() => {
    setSetLogoUrl(settings.logo_url);
    setSetWhatsapp(settings.whatsapp_number);
    setSetNameAr(settings.restaurant_name_ar);
    setSetNameEn(settings.restaurant_name_en);
    setSetFacebook(settings.facebook_url);
    setSetInstagram(settings.instagram_url);
    setSetTiktok(settings.tiktok_url);
    setSetSnapchat(settings.snapchat_url);
    setSetTalabat(settings.talabat_url || '');
    setPromos(settings.promo_codes || {});
    setOffers(settings.offers || []);
  }, [settings]);

  // Passcode gate validation
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode === '123456' || passcode === '01000307171') {
      setIsAuthenticated(true);
      setPasscodeError('');
    } else {
      setPasscodeError(language === 'ar' ? 'رمز المرور غير صحيح!' : 'Incorrect passcode!');
    }
  };

  // --- CATEGORIES CRUD ACTIONS ---
  const handleOpenCatModal = (cat: Category | null = null) => {
    if (cat) {
      setEditingCategory(cat);
      setCatNameAr(cat.name_ar);
      setCatNameEn(cat.name_en);
      setCatSortOrder(cat.sort_order);
    } else {
      setEditingCategory(null);
      setCatNameAr('');
      setCatNameEn('');
      setCatSortOrder(categories.length + 1);
    }
    setCatModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catNameAr.trim() || !catNameEn.trim()) return;

    setLoading(true);
    try {
      if (editingCategory) {
        await db.updateCategory(editingCategory.id, {
          name_ar: catNameAr,
          name_en: catNameEn,
          sort_order: Number(catSortOrder)
        });
      } else {
        await db.addCategory({
          name_ar: catNameAr,
          name_en: catNameEn,
          sort_order: Number(catSortOrder)
        });
      }
      await refreshData();
      setCatModalOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm(language === 'ar' ? 'هل أنت متأكد من حذف هذا التصنيف وجميع منتجاته؟' : 'Are you sure you want to delete this category and all its products?')) return;
    
    setLoading(true);
    try {
      await db.deleteCategory(id);
      await refreshData();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // --- PRODUCTS CRUD ACTIONS ---
  const handleOpenProdModal = (prod: Product | null = null) => {
    if (prod) {
      setEditingProduct(prod);
      setProdCatId(prod.category_id);
      setProdNameAr(prod.name_ar);
      setProdNameEn(prod.name_en);
      setProdPrice(prod.price);
      setProdImageUrl(prod.image_url);
      setProdDescAr(prod.description_ar);
      setProdDescEn(prod.description_en);
      setProdAvailable(prod.is_available);
    } else {
      setEditingProduct(null);
      setProdCatId(categories[0]?.id || '');
      setProdNameAr('');
      setProdNameEn('');
      setProdPrice(0);
      setProdImageUrl('');
      setProdDescAr('');
      setProdDescEn('');
      setProdAvailable(true);
    }
    setProdModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodNameAr.trim() || !prodNameEn.trim() || prodPrice <= 0 || !prodCatId) return;

    setLoading(true);
    try {
      const prodData = {
        category_id: prodCatId,
        name_ar: prodNameAr,
        name_en: prodNameEn,
        price: Number(prodPrice),
        image_url: prodImageUrl,
        description_ar: prodDescAr,
        description_en: prodDescEn,
        is_available: prodAvailable
      };

      if (editingProduct) {
        await db.updateProduct(editingProduct.id, prodData);
      } else {
        await db.addProduct(prodData);
      }
      await refreshData();
      setProdModalOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm(language === 'ar' ? 'هل أنت متأكد من حذف هذا المنتج؟' : 'Are you sure you want to delete this product?')) return;
    
    setLoading(true);
    try {
      await db.deleteProduct(id);
      await refreshData();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAvailability = async (product: Product) => {
    try {
      await db.updateProduct(product.id, { is_available: !product.is_available });
      await refreshData();
    } catch (err) {
      console.error(err);
    }
  };

  // --- ORDERS STATUS ACTIONS ---
  const handleUpdateOrderStatus = async (id: string, status: Order['status']) => {
    try {
      await db.updateOrderStatus(id, status);
      await refreshData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveManualOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCustName.trim() || !manualCustPhone.trim() || !manualTableNum.trim()) {
      alert(language === 'ar' ? 'يرجى ملء كافة البيانات الأساسية!' : 'Please fill all basic info!');
      return;
    }

    const itemsList: OrderItem[] = [];
    let totalPrice = 0;
    
    Object.entries(manualItems).forEach(([prodId, qty]) => {
      if (qty > 0) {
        const prod = products.find(p => p.id === prodId);
        if (prod) {
          itemsList.push({
            id: prod.id,
            name_ar: prod.name_ar,
            name_en: prod.name_en,
            price: prod.price,
            quantity: qty
          });
          totalPrice += prod.price * qty;
        }
      }
    });

    if (itemsList.length === 0) {
      alert(language === 'ar' ? 'يرجى إضافة صنف واحد على الأقل للطلب!' : 'Please add at least one item!');
      return;
    }

    setLoading(true);
    try {
      await db.addOrder({
        customer_name: manualCustName.trim(),
        customer_phone: manualCustPhone.trim(),
        table_number: manualTableNum.trim(),
        items: itemsList,
        total_price: totalPrice,
        status: manualStatus
      });
      await refreshData();
      setOrderModalOpen(false);
      // Clean up manual states
      setManualCustName('');
      setManualCustPhone('');
      setManualTableNum('');
      setManualStatus('pending');
      setManualItems({});
      alert(language === 'ar' ? 'تم إضافة الطلب يدويًا بنجاح!' : 'Order added manually successfully!');
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء حفظ الطلب.');
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter(order => {
    if (!order.created_at) return true;
    const orderDate = new Date(order.created_at);
    if (orderFilterType === 'day') {
      const dayStr = orderDate.toISOString().split('T')[0];
      return dayStr === selectedFilterDay;
    }
    if (orderFilterType === 'month') {
      const monthStr = orderDate.toISOString().slice(0, 7);
      return monthStr === selectedFilterMonth;
    }
    if (orderFilterType === 'year') {
      return orderDate.getFullYear() === selectedFilterYear;
    }
    return true;
  });

  // --- SETTINGS ACTIONS ---
  const handleAddPromo = () => {
    if (!newPromoCode.trim()) return;
    const code = newPromoCode.toUpperCase().trim();
    setPromos(prev => ({
      ...prev,
      [code]: Number(newPromoDiscount)
    }));
    setNewPromoCode('');
  };

  const handleRemovePromo = (code: string) => {
    const updated = { ...promos };
    delete updated[code];
    setPromos(updated);
  };

  const handleAddOffer = () => {
    if (!newOfferText.trim()) return;
    setOffers(prev => [...prev, newOfferText.trim()]);
    setNewOfferText('');
  };

  const handleRemoveOffer = (idx: number) => {
    setOffers(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSaveSettings = async () => {
    setLoading(true);
    try {
      await db.updateSettings({
        restaurant_name_ar: setNameAr,
        restaurant_name_en: setNameEn,
        logo_url: setLogoUrl,
        whatsapp_number: setWhatsapp,
        promo_codes: promos,
        offers: offers,
        facebook_url: setFacebook,
        instagram_url: setInstagram,
        tiktok_url: setTiktok,
        snapchat_url: setSnapchat,
        talabat_url: setTalabat
      });
      await refreshData();
      alert(language === 'ar' ? 'تم حفظ إعدادات النظام بنجاح!' : 'System settings saved successfully!');
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء حفظ الإعدادات.");
    } finally {
      setLoading(false);
    }
  };

  // --- ANALYTICS CALCULATIONS ---
  // Stats Counters
  const completedOrders = orders.filter(o => o.status === 'completed');
  const totalRevenue = completedOrders.reduce((sum, o) => sum + o.total_price, 0);
  const totalOrdersCount = orders.length;
  const avgOrderValue = completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0;
  const activeProductsCount = products.filter(p => p.is_available).length;

  // Most Sold Products (Leaderboard data)
  const productSalesMap: Record<string, { id: string; name_ar: string; name_en: string; quantity: number; revenue: number }> = {};
  
  orders.forEach(order => {
    order.items.forEach(item => {
      if (!productSalesMap[item.id]) {
        productSalesMap[item.id] = {
          id: item.id,
          name_ar: item.name_ar,
          name_en: item.name_en,
          quantity: 0,
          revenue: 0
        };
      }
      productSalesMap[item.id].quantity += item.quantity;
      productSalesMap[item.id].revenue += item.quantity * item.price;
    });
  });

  const productSalesReport = Object.values(productSalesMap).sort((a, b) => b.quantity - a.quantity);
  
  // Custom Recharts Chart Data formatting
  const mostSoldChartData = productSalesReport.slice(0, 5).map(item => ({
    name: language === 'ar' ? item.name_ar : item.name_en,
    quantity: item.quantity,
    revenue: item.revenue
  }));

  // Customer Analytics Leaderboard (Most Interested Customers)
  const customerMap: Record<string, { name: string; phone: string; orderCount: number; totalSpent: number; lastOrder: string }> = {};

  orders.forEach(order => {
    const key = `${order.customer_name}_${order.customer_phone}`;
    if (!customerMap[key]) {
      customerMap[key] = {
        name: order.customer_name,
        phone: order.customer_phone,
        orderCount: 0,
        totalSpent: 0,
        lastOrder: order.created_at
      };
    }
    customerMap[key].orderCount += 1;
    customerMap[key].totalSpent += order.total_price;
    if (new Date(order.created_at) > new Date(customerMap[key].lastOrder)) {
      customerMap[key].lastOrder = order.created_at;
    }
  });

  const customerReport = Object.values(customerMap).sort((a, b) => b.totalSpent - a.totalSpent);

  // Unique Customers CRM Mapping
  const uniqueCustomersMap: Record<string, { 
    name: string; 
    phone: string; 
    orderCount: number; 
    totalSpent: number; 
    firstOrderDate: string; 
    lastOrderDate: string;
    preferredTable: string;
    allOrders: Order[];
  }> = {};

  orders.forEach(order => {
    const phone = order.customer_phone.trim();
    if (!uniqueCustomersMap[phone]) {
      uniqueCustomersMap[phone] = {
        name: order.customer_name,
        phone: phone,
        orderCount: 0,
        totalSpent: 0,
        firstOrderDate: order.created_at,
        lastOrderDate: order.created_at,
        preferredTable: order.table_number,
        allOrders: []
      };
    }
    
    uniqueCustomersMap[phone].orderCount += 1;
    uniqueCustomersMap[phone].totalSpent += order.total_price;
    uniqueCustomersMap[phone].allOrders.push(order);
    
    // Sort orders for this customer by date desc
    uniqueCustomersMap[phone].allOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    // Update dates
    if (new Date(order.created_at) < new Date(uniqueCustomersMap[phone].firstOrderDate)) {
      uniqueCustomersMap[phone].firstOrderDate = order.created_at;
    }
    if (new Date(order.created_at) > new Date(uniqueCustomersMap[phone].lastOrderDate)) {
      uniqueCustomersMap[phone].lastOrderDate = order.created_at;
      // Prefer the latest entered name and table
      uniqueCustomersMap[phone].name = order.customer_name;
      uniqueCustomersMap[phone].preferredTable = order.table_number;
    }
  });

  const customersList = Object.values(uniqueCustomersMap).sort((a, b) => b.totalSpent - a.totalSpent);

  // Time-based Revenue Chart Data (e.g. daily sales log)
  const dailySalesMap: Record<string, number> = {};
  orders.forEach(order => {
    if (order.status === 'completed') {
      const date = order.created_at.split('T')[0]; // YYYY-MM-DD
      dailySalesMap[date] = (dailySalesMap[date] || 0) + order.total_price;
    }
  });

  const revenueChartData = Object.entries(dailySalesMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, revenue]) => ({
      date: new Date(date).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' }),
      revenue
    }))
    .slice(-7); // Last 7 active days

  // Translations
  const t = {
    ar: {
      loginTitle: "دخول المدير الآمن 🔐",
      passcodeLabel: "أدخل رمز المرور الإداري:",
      loginBtn: "دخول النظام",
      sidebarTitle: "بوابة المدير",
      overviewTab: "نظرة عامة والتحليلات 📊",
      categoriesTab: "إدارة التصنيفات 📁",
      productsTab: "إدارة المنتجات 🍔",
      ordersTab: "إدارة الطلبات 📋",
      customersTab: "إدارة العملاء 👥",
      settingsTab: "إدارة النظام والروابط ⚙️",
      exitBtn: "خروج من الإدارة",
      
      statRevenue: "إجمالي المبيعات (المؤكدة)",
      statOrders: "إجمالي الطلبات",
      statAvgOrder: "متوسط الطلب الحالي",
      statActiveProducts: "المنتجات النشطة",
      
      chartMostSold: "المنتجات الخمسة الأكثر طلباً مبيعاً",
      chartRevenue: "مبيعات آخر الأيام النشطة",
      
      customerLeaderboard: "لوحة متصدري تفاعل العملاء (العملاء الأكثر اهتماماً)",
      custName: "اسم العميل",
      custPhone: "رقم الهاتف",
      custCount: "عدد الطلبات",
      custSpent: "إجمالي الإنفاق",
      custLast: "تاريخ آخر طلب",
      
      addCat: "إضافة تصنيف جديد",
      addProd: "إضافة منتج جديد",
      save: "حفظ البيانات",
      close: "إغلاق",
      
      thNameAr: "الاسم بالعربية",
      thNameEn: "الاسم بالإنجليزية",
      thOrder: "ترتيب العرض",
      thActions: "إجراءات",
      thPrice: "السعر",
      thCategory: "التصنيف",
      thStatus: "الحالة",
      
      orderRef: "رقم الطلب",
      orderTable: "الطاولة",
      orderTotal: "الحساب الإجمالي",
      orderItems: "أصناف الطلب",
      orderDate: "التاريخ والوقت",
      
      setLogo: "رابط اللوجو الخاص بالمطعم",
      setNameAr: "اسم المطعم بالعربية",
      setNameEn: "اسم المطعم بالإنجليزية",
      setWhatsapp: "رقم واتساب المطعم للتأكيد",
      setPromos: "إدارة الكوبونات والأكواد النشطة",
      setOffers: "شريط العروض الترويجية المتحرك",
      setSocials: "روابط التواصل الاجتماعي",
      addOfferPlaceholder: "اكتب نص العرض الترويجي الجديد هنا...",
      addPromoPlaceholder: "كود الكوبون...",
      whatsappDisclaimer: "تأكد من كتابة الرقم بالصيغة الدولية بدون (+) مثل: 01000307171"
    },
    en: {
      loginTitle: "Secure Admin Portal 🔐",
      passcodeLabel: "Enter Administrative Passcode:",
      loginBtn: "Access System",
      sidebarTitle: "Manager Portal",
      overviewTab: "Overview & Analytics 📊",
      categoriesTab: "Categories 📁",
      productsTab: "Products CRUD 🍔",
      ordersTab: "Orders Panel 📋",
      customersTab: "Customers CRM 👥",
      settingsTab: "System Customizer ⚙️",
      exitBtn: "Exit Admin",
      
      statRevenue: "Total Revenue (Confirmed)",
      statOrders: "Total Orders Logged",
      statAvgOrder: "Average Order Value",
      statActiveProducts: "Active Products",
      
      chartMostSold: "Top 5 Most Sold Products",
      chartRevenue: "Active Days Sales Log",
      
      customerLeaderboard: "Customer Loyalty Leaderboard (Most Interested Customers)",
      custName: "Customer Name",
      custPhone: "Phone Number",
      custCount: "Orders Placed",
      custSpent: "Total Spent",
      custLast: "Last Order Date",
      
      addCat: "Add New Category",
      addProd: "Add New Product",
      save: "Save Data",
      close: "Close",
      
      thNameAr: "Arabic Name",
      thNameEn: "English Name",
      thOrder: "Display Order",
      thActions: "Actions",
      thPrice: "Price",
      thCategory: "Category",
      thStatus: "Status",
      
      orderRef: "Order Reference",
      orderTable: "Table #",
      orderTotal: "Total Price",
      orderItems: "Order Items",
      orderDate: "Date & Time",
      
      setLogo: "Restaurant Logo URL",
      setNameAr: "Restaurant Name (Arabic)",
      setNameEn: "Restaurant Name (English)",
      setWhatsapp: "WhatsApp Number for redirs",
      setPromos: "Promo Codes Management",
      setOffers: "Scrolling Promotional Banners",
      setSocials: "Social Media Platform Links",
      addOfferPlaceholder: "Type the new promo text...",
      addPromoPlaceholder: "Promo code...",
      whatsappDisclaimer: "Enter in international format without + prefix (e.g. 01000307171)"
    }
  }[language];

  // Passcode login gate layout
  if (!isAuthenticated) {
    return (
      <div className="admin-modal-overlay" style={{ background: 'var(--bg-darker)' }} dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <div className="admin-modal" style={{ maxWidth: '400px' }}>
          <div className="admin-modal-header" style={{ justifyContent: 'center' }}>
            <h2 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }} className="text-gradient-gold">
              <Lock size={18} />
              {t.loginTitle}
            </h2>
          </div>
          <form onSubmit={handleLogin}>
            <div className="admin-modal-body" style={{ gap: '1rem', padding: '2rem 1.5rem' }}>
              <div className="form-group">
                <label>{t.passcodeLabel}</label>
                <input 
                  type="password" 
                  className="input-gold" 
                  placeholder="••••••" 
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '4px' }}
                  required
                  autoFocus
                />
                {passcodeError && (
                  <span style={{ color: 'var(--danger)', fontSize: '0.85rem', marginTop: '0.25rem', textAlign: 'center', display: 'block' }}>
                    {passcodeError}
                  </span>
                )}
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '0.5rem' }}>
                  {language === 'ar' ? 'تلميح: الرمز الافتراضي هو 123456' : 'Hint: Default passcode is 123456'}
                </p>
              </div>
            </div>
            <div className="admin-modal-footer" style={{ justifyContent: 'center', padding: '1rem' }}>
              <button type="submit" className="btn-gold" style={{ width: '100%' }}>
                {t.loginBtn}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-container" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* 1. Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-logo">
          <Gear size={22} className="lucide-pulse" style={{ color: 'var(--gold-primary)' }} />
          <span className="text-gradient-gold">{t.sidebarTitle}</span>
        </div>

        <nav className="admin-nav">
          <button 
            className={`admin-nav-item ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            <LayoutDashboard size={18} />
            <span>{t.overviewTab}</span>
          </button>
          
          <button 
            className={`admin-nav-item ${activeTab === 'categories' ? 'active' : ''}`}
            onClick={() => setActiveTab('categories')}
          >
            <FolderOpen size={18} />
            <span>{t.categoriesTab}</span>
          </button>

          <button 
            className={`admin-nav-item ${activeTab === 'products' ? 'active' : ''}`}
            onClick={() => setActiveTab('products')}
          >
            <Coffee size={18} />
            <span>{t.productsTab}</span>
          </button>

          <button 
            className={`admin-nav-item ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            <Calendar size={18} />
            <span>{t.ordersTab}</span>
          </button>

          <button 
            className={`admin-nav-item ${activeTab === 'customers' ? 'active' : ''}`}
            onClick={() => setActiveTab('customers')}
          >
            <Users size={18} />
            <span>{t.customersTab}</span>
          </button>

          <button 
            className={`admin-nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <Gear size={18} />
            <span>{t.settingsTab}</span>
          </button>
        </nav>

        <button className="btn-outline-gold" onClick={onClose} style={{ marginTop: 'auto', width: '100%' }}>
          <LogOut size={16} />
          {t.exitBtn}
        </button>
      </aside>

      {/* 2. Main content area */}
      <main className="admin-main">
        {/* TAB 1: OVERVIEW & ANALYTICS */}
        {activeTab === 'analytics' && (
          <div>
            <h1 className="text-gradient-gold" style={{ fontSize: '1.8rem', marginBottom: '1.5rem' }}>{t.overviewTab}</h1>

            {/* Stats Summary Grid */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon"><Users size={22} /></div>
                <div className="stat-info">
                  <h3>{t.statRevenue}</h3>
                  <p>{totalRevenue.toLocaleString()} <span style={{ fontSize: '1rem', color: 'var(--gold-primary)' }}>EGP</span></p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon"><Calendar size={22} /></div>
                <div className="stat-info">
                  <h3>{t.statOrders}</h3>
                  <p>{totalOrdersCount}</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon"><Sparkles size={22} /></div>
                <div className="stat-info">
                  <h3>{t.statAvgOrder}</h3>
                  <p>{avgOrderValue.toFixed(0)} <span style={{ fontSize: '0.9rem', color: 'var(--gold-primary)' }}>EGP</span></p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon"><Coffee size={22} /></div>
                <div className="stat-info">
                  <h3>{t.statActiveProducts}</h3>
                  <p>{activeProductsCount}</p>
                </div>
              </div>
            </div>

            {/* Graphs Panels Grid */}
            <div className="analytics-grid">
              {/* Daily Sales Chart */}
              <div className="chart-panel">
                <h2>{t.chartRevenue}</h2>
                <div style={{ width: '100%', height: '100%', minHeight: '260px' }}>
                  {revenueChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={revenueChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--gold-primary)" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="var(--gold-primary)" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} />
                        <YAxis stroke="var(--text-muted)" fontSize={11} />
                        <RechartsTooltip contentStyle={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)', color: '#fff', borderRadius: '12px' }} />
                        <Area type="monotone" dataKey="revenue" stroke="var(--gold-primary)" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRevenue)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                      No sales data yet
                    </div>
                  )}
                </div>
              </div>

              {/* Top Selling Products */}
              <div className="chart-panel">
                <h2>{t.chartMostSold}</h2>
                <div style={{ width: '100%', height: '100%', minHeight: '260px' }}>
                  {mostSoldChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsBarChart data={mostSoldChartData} layout="vertical" margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis type="number" stroke="var(--text-muted)" fontSize={10} />
                        <YAxis dataKey="name" type="category" stroke="var(--text-white)" fontSize={9} width={80} />
                        <RechartsTooltip contentStyle={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)', color: '#fff', borderRadius: '12px' }} />
                        <Bar dataKey="quantity" fill="var(--gold-primary)" radius={[0, 4, 4, 0]}>
                          {mostSoldChartData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={index === 0 ? 'var(--gold-secondary)' : 'var(--gold-primary)'} />
                          ))}
                        </Bar>
                      </RechartsBarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                      No orders placed yet
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Loyalty/Engagement Leaderboard (Customers Analytics) */}
            <div className="table-panel">
              <h2 style={{ fontSize: '1.25rem', color: 'var(--gold-secondary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Users size={20} />
                {t.customerLeaderboard}
              </h2>
              <div className="table-wrapper">
                <table className="luxury-table">
                  <thead>
                    <tr>
                      <th>{t.custName}</th>
                      <th>{t.custPhone}</th>
                      <th>{t.custCount}</th>
                      <th>{t.custSpent}</th>
                      <th>{t.custLast}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerReport.map((cust, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: '700' }}>
                          {idx === 0 && <span style={{ marginRight: '5px', color: '#ffb300' }}>👑</span>}
                          {cust.name}
                        </td>
                        <td className="font-en">{cust.phone}</td>
                        <td className="font-en">{cust.orderCount}</td>
                        <td className="font-en" style={{ color: 'var(--gold-primary)', fontWeight: '800' }}>{cust.totalSpent.toLocaleString()} EGP</td>
                        <td className="font-en" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {new Date(cust.lastOrder).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}
                        </td>
                      </tr>
                    ))}
                    {customerReport.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                          No customer logs recorded
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CATEGORIES MANAGEMENT */}
        {activeTab === 'categories' && (
          <div>
            <div className="table-panel">
              <div className="table-panel-header">
                <h1 className="text-gradient-gold" style={{ fontSize: '1.5rem', margin: 0 }}>{t.categoriesTab}</h1>
                <button className="btn-gold" onClick={() => handleOpenCatModal(null)}>
                  <PlusCircle size={16} />
                  {t.addCat}
                </button>
              </div>

              <div className="table-wrapper">
                <table className="luxury-table">
                  <thead>
                    <tr>
                      <th>{t.thNameAr}</th>
                      <th>{t.thNameEn}</th>
                      <th>{t.thOrder}</th>
                      <th>{t.thActions}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((cat) => (
                      <tr key={cat.id}>
                        <td style={{ fontWeight: '700' }}>{cat.name_ar}</td>
                        <td className="font-en">{cat.name_en}</td>
                        <td className="font-en">{cat.sort_order}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-start' }}>
                            <button className="btn-outline-gold" style={{ padding: '0.3rem 0.6rem', borderRadius: '8px' }} onClick={() => handleOpenCatModal(cat)}>
                              <Edit size={14} />
                            </button>
                            <button className="btn-outline-gold" style={{ padding: '0.3rem 0.6rem', borderRadius: '8px', color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => handleDeleteCategory(cat.id)}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PRODUCTS MANAGEMENT */}
        {activeTab === 'products' && (
          <div>
            <div className="table-panel">
              <div className="table-panel-header">
                <h1 className="text-gradient-gold" style={{ fontSize: '1.5rem', margin: 0 }}>{t.productsTab}</h1>
                <button className="btn-gold" onClick={() => handleOpenProdModal(null)}>
                  <PlusCircle size={16} />
                  {t.addProd}
                </button>
              </div>

              <div className="table-wrapper">
                <table className="luxury-table">
                  <thead>
                    <tr>
                      <th>الصورة</th>
                      <th>{t.thNameAr}</th>
                      <th>{t.thNameEn}</th>
                      <th>{t.thCategory}</th>
                      <th>{t.thPrice}</th>
                      <th>{t.thStatus}</th>
                      <th>{t.thActions}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((prod) => {
                      const category = categories.find(c => c.id === prod.category_id);
                      return (
                        <tr key={prod.id} style={{ opacity: prod.is_available ? 1 : 0.65 }}>
                          <td>
                            <div style={{ width: '45px', height: '45px', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                              {prod.image_url ? (
                                <img src={prod.image_url} alt={prod.name_en} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <div style={{ background: '#181818', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold-primary)', fontSize: '1rem' }}>🍽️</div>
                              )}
                            </div>
                          </td>
                          <td style={{ fontWeight: '700' }}>{prod.name_ar}</td>
                          <td className="font-en">{prod.name_en}</td>
                          <td>{category ? (language === 'ar' ? category.name_ar : category.name_en) : '---'}</td>
                          <td className="font-en" style={{ color: 'var(--gold-primary)', fontWeight: '800' }}>{prod.price} EGP</td>
                          <td>
                            <button 
                              className={`badge-status ${prod.is_available ? 'completed' : 'cancelled'}`}
                              onClick={() => handleToggleAvailability(prod)}
                              style={{ border: 'none', cursor: 'pointer' }}
                              title="اضغط لتغيير حالة التوفر"
                            >
                              {prod.is_available ? (language === 'ar' ? 'متوفر' : 'Available') : (language === 'ar' ? 'غير متوفر' : 'Sold Out')}
                            </button>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-start' }}>
                              <button className="btn-outline-gold" style={{ padding: '0.3rem 0.6rem', borderRadius: '8px' }} onClick={() => handleOpenProdModal(prod)}>
                                <Edit size={14} />
                              </button>
                              <button className="btn-outline-gold" style={{ padding: '0.3rem 0.6rem', borderRadius: '8px', color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => handleDeleteProduct(prod.id)}>
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: CLIENT ORDERS HISTORY */}
        {activeTab === 'orders' && (
          <div>
            <div className="table-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                  <h1 className="text-gradient-gold" style={{ fontSize: '1.5rem', margin: 0 }}>{t.ordersTab}</h1>
                  
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Filter type selector */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <label style={{ fontSize: '0.85rem', color: 'var(--text-gray)' }}>{language === 'ar' ? 'فلترة حسب:' : 'Filter by:'}</label>
                      <select 
                        value={orderFilterType} 
                        onChange={(e) => setOrderFilterType(e.target.value as any)} 
                        className="input-gold"
                        style={{ padding: '0.4rem 0.8rem', borderRadius: '10px', fontSize: '0.85rem' }}
                      >
                        <option value="all">{language === 'ar' ? 'الكل 📁' : 'All 📁'}</option>
                        <option value="day">{language === 'ar' ? 'باليوم 📅' : 'By Day 📅'}</option>
                        <option value="month">{language === 'ar' ? 'بالشهر 🗓️' : 'By Month 🗓️'}</option>
                        <option value="year">{language === 'ar' ? 'بالسنة ⏳' : 'By Year ⏳'}</option>
                      </select>
                    </div>

                    {/* Filter inputs based on type */}
                    {orderFilterType === 'day' && (
                      <input 
                        type="date" 
                        className="input-gold" 
                        value={selectedFilterDay} 
                        onChange={(e) => setSelectedFilterDay(e.target.value)} 
                        style={{ padding: '0.4rem 0.8rem', borderRadius: '10px', fontSize: '0.85rem' }} 
                      />
                    )}

                    {orderFilterType === 'month' && (
                      <input 
                        type="month" 
                        className="input-gold" 
                        value={selectedFilterMonth} 
                        onChange={(e) => setSelectedFilterMonth(e.target.value)} 
                        style={{ padding: '0.4rem 0.8rem', borderRadius: '10px', fontSize: '0.85rem' }} 
                      />
                    )}

                    {orderFilterType === 'year' && (
                      <select 
                        className="input-gold" 
                        value={selectedFilterYear} 
                        onChange={(e) => setSelectedFilterYear(Number(e.target.value))} 
                        style={{ padding: '0.4rem 0.8rem', borderRadius: '10px', fontSize: '0.85rem' }}
                      >
                        {[2024, 2025, 2026, 2027, 2028].map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    )}

                    {/* Add Manual Order Button */}
                    <button 
                      onClick={() => {
                        setManualCustName('');
                        setManualCustPhone('');
                        setManualTableNum('');
                        setManualStatus('pending');
                        setManualItems({});
                        setOrderModalOpen(true);
                      }} 
                      className="btn-gold" 
                      style={{ padding: '0.5rem 1.2rem', borderRadius: '12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                      <Plus size={16} />
                      <span>{language === 'ar' ? 'إضافة طلب يدوي' : 'Add Manual Order'}</span>
                    </button>
                  </div>
                </div>
                
                <div className="table-wrapper">
                  <table className="luxury-table">
                    <thead>
                      <tr>
                        <th>{t.orderRef}</th>
                        <th>{t.custName}</th>
                        <th>{t.custPhone}</th>
                        <th>{t.orderTable}</th>
                        <th>{t.orderItems}</th>
                        <th>{t.orderTotal}</th>
                        <th>{t.orderDate}</th>
                        <th>{t.thStatus}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.map((order) => (
                      <tr key={order.id}>
                        <td className="font-en" style={{ fontSize: '0.75rem', color: 'var(--gold-primary)', fontWeight: 'bold' }}>#{order.id.slice(0, 8)}</td>
                        <td style={{ fontWeight: '700' }}>{order.customer_name}</td>
                        <td className="font-en">{order.customer_phone}</td>
                        <td className="font-en" style={{ fontWeight: 'bold' }}>{order.table_number}</td>
                        <td style={{ fontSize: '0.85rem', maxWidth: '220px', whiteSpace: 'normal', lineHeight: '1.4' }}>
                          {order.items.map((item, idx) => (
                            <div key={idx} style={{ color: 'var(--text-gray)' }}>
                              • {item.quantity}x {language === 'ar' ? item.name_ar : item.name_en}
                            </div>
                          ))}
                        </td>
                        <td className="font-en" style={{ color: 'var(--gold-primary)', fontWeight: '800' }}>{order.total_price.toFixed(2)} EGP</td>
                        <td className="font-en" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {new Date(order.created_at).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}
                        </td>
                        <td>
                          <select 
                            value={order.status}
                            onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value as Order['status'])}
                            className="input-gold"
                            style={{ 
                              padding: '0.25rem 0.5rem', 
                              borderRadius: '8px', 
                              fontSize: '0.8rem',
                              background: order.status === 'completed' ? 'rgba(16,185,129,0.1)' : order.status === 'cancelled' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                              color: order.status === 'completed' ? 'var(--success)' : order.status === 'cancelled' ? 'var(--danger)' : 'var(--warning)',
                              borderColor: 'var(--border-color)',
                              cursor: 'pointer'
                            }}
                          >
                            <option value="pending" style={{ background: '#121212', color: 'var(--warning)' }}>Pending</option>
                            <option value="completed" style={{ background: '#121212', color: 'var(--success)' }}>Completed</option>
                            <option value="cancelled" style={{ background: '#121212', color: 'var(--danger)' }}>Cancelled</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                    {filteredOrders.length === 0 && (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-gray)', padding: '3rem 1rem' }}>
                          {language === 'ar' ? 'لا توجد طلبات مسجلة تطابق فلترة البحث!' : 'No orders found matching the filter!'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB: CUSTOMERS CRM MODULE */}
        {activeTab === 'customers' && (
          <div>
            <div className="table-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <h1 className="text-gradient-gold" style={{ fontSize: '1.5rem', margin: 0 }}>{t.customersTab} 👥</h1>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-gray)', marginTop: '0.2rem' }}>
                    {language === 'ar' ? 'شاشة عرض وتتبع حركة ونشاط العملاء المسجلين وسجل طلباتهم' : 'CRM Screen to track registered customers activity, info & transaction logs'}
                  </p>
                </div>
                
                {/* Search Customer Input */}
                <div style={{ position: 'relative', width: '300px' }}>
                  <input 
                    type="text" 
                    placeholder={language === 'ar' ? 'بحث باسم العميل أو رقم الهاتف...' : 'Search by name or phone...'} 
                    value={custSearch} 
                    onChange={(e) => setCustSearch(e.target.value)} 
                    className="input-gold" 
                    style={{ padding: '0.5rem 1rem', borderRadius: '12px', fontSize: '0.85rem', width: '100%' }}
                  />
                  {custSearch && (
                    <button 
                      onClick={() => setCustSearch('')} 
                      style={{ position: 'absolute', right: language === 'ar' ? 'auto' : '10px', left: language === 'ar' ? '10px' : 'auto', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>

              <div className="table-wrapper">
                <table className="luxury-table">
                  <thead>
                    <tr>
                      <th>{language === 'ar' ? 'العميل' : 'Customer'}</th>
                      <th>{language === 'ar' ? 'رقم الهاتف' : 'Phone Number'}</th>
                      <th>{language === 'ar' ? 'عدد الطلبات' : 'Orders Count'}</th>
                      <th>{language === 'ar' ? 'إجمالي الإنفاق' : 'Total Spent'}</th>
                      <th>{language === 'ar' ? 'الطاولة المفضلة' : 'Preferred Table'}</th>
                      <th>{language === 'ar' ? 'آخر نشاط' : 'Last Active'}</th>
                      <th>{language === 'ar' ? 'الملف الشخصي والسجل' : 'Profile & Logs'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customersList
                      .filter(cust => {
                        const term = custSearch.toLowerCase().trim();
                        if (!term) return true;
                        return cust.name.toLowerCase().includes(term) || cust.phone.includes(term);
                      })
                      .map((cust) => (
                        <tr key={cust.phone}>
                          <td style={{ fontWeight: '700' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(212, 175, 55, 0.1)', border: '1px solid var(--gold-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold-primary)', fontWeight: 'bold', fontSize: '0.9rem' }}>
                                {cust.name.trim().charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div>{cust.name}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                                  {language === 'ar' ? 'أول طلب: ' : 'First order: '}
                                  {new Date(cust.firstOrderDate).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US')}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="font-en">
                            <a 
                              href={`https://wa.me/${cust.phone.startsWith('+') ? cust.phone : '+2' + cust.phone}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              style={{ color: '#25D366', display: 'flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none', fontWeight: 'bold' }}
                            >
                              <span>{cust.phone}</span>
                              <span style={{ fontSize: '0.8rem' }}>💬</span>
                            </a>
                          </td>
                          <td className="font-en" style={{ fontWeight: 'bold' }}>
                            <span style={{ background: 'rgba(212, 175, 55, 0.1)', color: 'var(--gold-secondary)', padding: '0.2rem 0.6rem', borderRadius: '8px', border: '1px solid rgba(212,175,55,0.2)' }}>
                              {cust.orderCount} {language === 'ar' ? 'طلبات' : 'orders'}
                            </span>
                          </td>
                          <td className="font-en" style={{ color: 'var(--gold-primary)', fontWeight: '800' }}>
                            {cust.totalSpent.toFixed(2)} EGP
                          </td>
                          <td className="font-en" style={{ fontWeight: 'bold' }}>
                            {language === 'ar' ? 'طاولة ' : 'Table '} {cust.preferredTable}
                          </td>
                          <td className="font-en" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {new Date(cust.lastOrderDate).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}
                          </td>
                          <td>
                            <button 
                              className="btn-outline-gold" 
                              style={{ padding: '0.4rem 0.8rem', borderRadius: '10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }} 
                              onClick={() => setSelectedCustPhone(cust.phone)}
                            >
                              <Sparkles size={12} />
                              <span>{language === 'ar' ? 'عرض السجل 🔍' : 'View History 🔍'}</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    {customersList.length === 0 && (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-gray)', padding: '3rem 1rem' }}>
                          {language === 'ar' ? 'لا يوجد عملاء مسجلين حالياً' : 'No registered customers found yet'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: SYSTEM SETTINGS CUSTOMIZER */}
        {activeTab === 'settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div className="table-panel">
              <h2 className="text-gradient-gold" style={{ fontSize: '1.4rem', marginBottom: '1.5rem' }}>⚙️ {t.settingsTab}</h2>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                {/* Logo URL */}
                <div className="form-group">
                  <label>{t.setLogo}</label>
                  <input type="text" className="input-gold" value={setLogoUrl} onChange={(e) => setSetLogoUrl(e.target.value)} placeholder="https://..." />
                </div>
                
                {/* WhatsApp Number */}
                <div className="form-group">
                  <label>{t.setWhatsapp}</label>
                  <input type="text" className="input-gold" value={setWhatsapp} onChange={(e) => setSetWhatsapp(e.target.value)} />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.whatsappDisclaimer}</span>
                </div>

                {/* Name AR */}
                <div className="form-group">
                  <label>{t.setNameAr}</label>
                  <input type="text" className="input-gold" value={setNameAr} onChange={(e) => setSetNameAr(e.target.value)} />
                </div>

                {/* Name EN */}
                <div className="form-group">
                  <label>{t.setNameEn}</label>
                  <input type="text" className="input-gold" value={setNameEn} onChange={(e) => setSetNameEn(e.target.value)} />
                </div>
              </div>

              {/* Social Media Channels */}
              <h3 style={{ color: 'var(--gold-secondary)', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                {t.setSocials}
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                <div className="form-group">
                  <label>Facebook URL</label>
                  <input type="text" className="input-gold" value={setFacebook} onChange={(e) => setSetFacebook(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Instagram URL</label>
                  <input type="text" className="input-gold" value={setInstagram} onChange={(e) => setSetInstagram(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>TikTok URL</label>
                  <input type="text" className="input-gold" value={setTiktok} onChange={(e) => setSetTiktok(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Snapchat URL</label>
                  <input type="text" className="input-gold" value={setSnapchat} onChange={(e) => setSetSnapchat(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>رابط طلبات (Talabat URL)</label>
                  <input type="text" className="input-gold" value={setTalabat} onChange={(e) => setSetTalabat(e.target.value)} placeholder="https://www.talabat.com/..." />
                </div>
              </div>

              {/* Promo code custom additions */}
              <h3 style={{ color: 'var(--gold-secondary)', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                {t.setPromos}
              </h3>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'flex-end' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>الكود (كود كوبون الخصم)</label>
                  <input type="text" className="input-gold" placeholder={t.addPromoPlaceholder} value={newPromoCode} onChange={(e) => setNewPromoCode(e.target.value)} />
                </div>
                <div className="form-group" style={{ width: '120px' }}>
                  <label>نسبة الخصم (%)</label>
                  <input type="number" className="input-gold" min="1" max="100" value={newPromoDiscount} onChange={(e) => setNewPromoDiscount(Number(e.target.value))} />
                </div>
                <button type="button" className="btn-gold" style={{ height: '42px', borderRadius: '12px' }} onClick={handleAddPromo}>
                  <Plus size={16} />
                  <span>إضافة الكود</span>
                </button>
              </div>

              {/* Promos tags display */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '2rem' }}>
                {Object.entries(promos).map(([code, percent]) => (
                  <div key={code} style={{ background: '#1c1c1c', border: '1px solid var(--border-color)', padding: '0.4rem 0.8rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: '700', color: 'var(--gold-primary)' }}>{code}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-gray)' }}>({percent}% خصم)</span>
                    <button type="button" style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer' }} onClick={() => handleRemovePromo(code)}>
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Offers banner configuration */}
              <h3 style={{ color: 'var(--gold-secondary)', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                {t.setOffers}
              </h3>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'flex-end' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>نص الإعلان أو العرض</label>
                  <input type="text" className="input-gold" placeholder={t.addOfferPlaceholder} value={newOfferText} onChange={(e) => setNewOfferText(e.target.value)} />
                </div>
                <button type="button" className="btn-gold" style={{ height: '42px', borderRadius: '12px' }} onClick={handleAddOffer}>
                  <Plus size={16} />
                  <span>إضافة الإعلان</span>
                </button>
              </div>

              {/* Offers tags display */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '2rem' }}>
                {offers.map((offer, idx) => (
                  <div key={idx} style={{ background: '#1c1c1c', border: '1px solid var(--glass-border)', padding: '0.6rem 1rem', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-white)' }}>{offer}</span>
                    <button type="button" style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer' }} onClick={() => handleRemoveOffer(idx)}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Final save button */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-gold" disabled={loading} onClick={handleSaveSettings} style={{ padding: '0.8rem 2.5rem', borderRadius: '15px' }}>
                  <Save size={18} />
                  {t.save}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* --- CRUD DIALOG MODAL FOR CATEGORY --- */}
      {catModalOpen && (
        <div className="admin-modal-overlay" onClick={() => setCatModalOpen(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>{editingCategory ? 'تعديل التصنيف' : t.addCat}</h2>
              <button className="btn-close" onClick={() => setCatModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveCategory}>
              <div className="admin-modal-body">
                <div className="form-group">
                  <label>{t.thNameAr} *</label>
                  <input type="text" className="input-gold" value={catNameAr} onChange={(e) => setCatNameAr(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>{t.thNameEn} *</label>
                  <input type="text" className="input-gold" value={catNameEn} onChange={(e) => setCatNameEn(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>{t.thOrder} *</label>
                  <input type="number" className="input-gold" value={catSortOrder} onChange={(e) => setCatSortOrder(Number(e.target.value))} required />
                </div>
              </div>
              <div className="admin-modal-footer">
                <button type="button" className="btn-outline-gold" onClick={() => setCatModalOpen(false)}>{t.close}</button>
                <button type="submit" className="btn-gold" disabled={loading}>{t.save}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- CRUD DIALOG MODAL FOR PRODUCT --- */}
      {prodModalOpen && (
        <div className="admin-modal-overlay" onClick={() => setProdModalOpen(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>{editingProduct ? 'تعديل بيانات المنتج' : t.addProd}</h2>
              <button className="btn-close" onClick={() => setProdModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveProduct}>
              <div className="admin-modal-body">
                {/* Category Selection */}
                <div className="form-group">
                  <label>{t.thCategory} *</label>
                  <select className="input-gold" value={prodCatId} onChange={(e) => setProdCatId(e.target.value)} required>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id} style={{ background: '#121212' }}>
                        {language === 'ar' ? cat.name_ar : cat.name_en}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Name AR */}
                <div className="form-group">
                  <label>{t.thNameAr} *</label>
                  <input type="text" className="input-gold" value={prodNameAr} onChange={(e) => setProdNameAr(e.target.value)} required />
                </div>

                {/* Name EN */}
                <div className="form-group">
                  <label>{t.thNameEn} *</label>
                  <input type="text" className="input-gold" value={prodNameEn} onChange={(e) => setProdNameEn(e.target.value)} required />
                </div>

                {/* Price */}
                <div className="form-group">
                  <label>{t.thPrice} *</label>
                  <input type="number" className="input-gold" value={prodPrice} onChange={(e) => setProdPrice(Number(e.target.value))} required />
                </div>

                {/* Image URL */}
                <div className="form-group">
                  <label>رابط الصورة المباشر (Image URL)</label>
                  <input type="text" className="input-gold" value={prodImageUrl} onChange={(e) => setProdImageUrl(e.target.value)} placeholder="https://images.unsplash.com/..." />
                </div>

                {/* Ingredients AR */}
                <div className="form-group">
                  <label>مكونات الطبق بالعربية</label>
                  <textarea className="input-gold" rows={3} value={prodDescAr} onChange={(e) => setProdDescAr(e.target.value)} />
                </div>

                {/* Ingredients EN */}
                <div className="form-group">
                  <label>مكونات الطبق بالإنجليزية</label>
                  <textarea className="input-gold" rows={3} value={prodDescEn} onChange={(e) => setProdDescEn(e.target.value)} />
                </div>

                {/* Availability checkbox */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <input type="checkbox" id="avail-check" checked={prodAvailable} onChange={(e) => setProdAvailable(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: 'var(--gold-primary)' }} />
                  <label htmlFor="avail-check" style={{ fontSize: '0.9rem', color: 'var(--gold-secondary)', fontWeight: 'bold', cursor: 'pointer' }}>المنتج متوفر للطلب حالياً</label>
                </div>
              </div>
              <div className="admin-modal-footer">
                <button type="button" className="btn-outline-gold" onClick={() => setProdModalOpen(false)}>{t.close}</button>
                <button type="submit" className="btn-gold" disabled={loading}>{t.save}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MANUAL ORDER MANAGE MODAL --- */}
      {orderModalOpen && (
        <div className="admin-modal-overlay" onClick={() => setOrderModalOpen(false)}>
          <div className="admin-modal" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>{language === 'ar' ? 'إضافة طلب يدوي جديد 🍽️' : 'Add New Manual Order 🍽️'}</h2>
              <button className="btn-close" onClick={() => setOrderModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveManualOrder}>
              <div className="admin-modal-body">
                {/* Basic client info */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label>{language === 'ar' ? 'اسم العميل *' : 'Customer Name *'}</label>
                    <input type="text" className="input-gold" value={manualCustName} onChange={(e) => setManualCustName(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>{language === 'ar' ? 'رقم الهاتف *' : 'Phone Number *'}</label>
                    <input type="text" className="input-gold" value={manualCustPhone} onChange={(e) => setManualCustPhone(e.target.value)} required />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
                  <div className="form-group">
                    <label>{language === 'ar' ? 'رقم الطاولة / الطرابيزة *' : 'Table / Seat Number *'}</label>
                    <input type="text" className="input-gold" value={manualTableNum} onChange={(e) => setManualTableNum(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>{language === 'ar' ? 'حالة الطلب *' : 'Order Status *'}</label>
                    <select className="input-gold" value={manualStatus} onChange={(e) => setManualStatus(e.target.value as any)}>
                      <option value="pending" style={{ background: '#121212', color: 'var(--warning)' }}>Pending / قيد الانتظار</option>
                      <option value="completed" style={{ background: '#121212', color: 'var(--success)' }}>Completed / مكتمل</option>
                      <option value="cancelled" style={{ background: '#121212', color: 'var(--danger)' }}>Cancelled / ملغي</option>
                    </select>
                  </div>
                </div>

                {/* Items addition with count */}
                <div className="form-group" style={{ marginTop: '1.5rem' }}>
                  <label style={{ fontSize: '1rem', color: 'var(--gold-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', display: 'block', marginBottom: '1rem' }}>
                    {language === 'ar' ? 'حدد المنتجات المطلوبة والكمية:' : 'Select ordered products & quantities:'}
                  </label>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', maxHeight: '250px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                    {products.map(prod => {
                      const qty = manualItems[prod.id] || 0;
                      return (
                        <div key={prod.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '0.5rem 0.8rem', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
                          <div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>{language === 'ar' ? prod.name_ar : prod.name_en}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--gold-primary)' }}>{prod.price} EGP</div>
                          </div>
                          
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                            <button 
                              type="button" 
                              className="btn-outline-gold" 
                              style={{ padding: '0.1rem 0.5rem', borderRadius: '5px', fontSize: '0.8rem', cursor: 'pointer' }}
                              onClick={() => setManualItems(prev => ({
                                ...prev,
                                [prod.id]: Math.max(0, qty - 1)
                              }))}
                            >
                              -
                            </button>
                            <span style={{ fontWeight: 'bold', width: '20px', textAlign: 'center' }}>{qty}</span>
                            <button 
                              type="button" 
                              className="btn-outline-gold" 
                              style={{ padding: '0.1rem 0.5rem', borderRadius: '5px', fontSize: '0.8rem', cursor: 'pointer' }}
                              onClick={() => setManualItems(prev => ({
                                ...prev,
                                [prod.id]: qty + 1
                              }))}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="admin-modal-footer">
                <button type="button" className="btn-outline-gold" onClick={() => setOrderModalOpen(false)}>{t.close}</button>
                <button type="submit" className="btn-gold" disabled={loading}>{t.save}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* --- CUSTOMER PROFILE & TIMELINE MODAL --- */}
      {selectedCustPhone && (() => {
        const cust = uniqueCustomersMap[selectedCustPhone];
        if (!cust) return null;

        return (
          <div className="admin-modal-overlay" onClick={() => setSelectedCustPhone(null)}>
            <div className="admin-modal" style={{ maxWidth: '800px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
              <div className="admin-modal-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'rgba(212, 175, 55, 0.15)', border: '2px solid var(--gold-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold-primary)', fontWeight: 'bold', fontSize: '1.2rem' }}>
                    {cust.name.trim().charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '1.3rem' }}>{cust.name}</h2>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{language === 'ar' ? 'سجل العميل التفاعلي 📑' : 'Interactive Customer Profile 📑'}</p>
                  </div>
                </div>
                <button className="btn-close" onClick={() => setSelectedCustPhone(null)}><X size={20} /></button>
              </div>

              <div className="admin-modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem', maxHeight: '70vh', overflowY: 'auto' }}>
                
                {/* Summary Info Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem' }}>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--glass-border)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-gray)', marginBottom: '0.3rem' }}>{language === 'ar' ? 'رقم الهاتف' : 'Phone Number'}</div>
                    <div className="font-en" style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--gold-secondary)' }}>{cust.phone}</div>
                  </div>
                  
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--glass-border)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-gray)', marginBottom: '0.3rem' }}>{language === 'ar' ? 'إجمالي الإنفاق' : 'Total Spent'}</div>
                    <div className="font-en" style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--gold-primary)' }}>{cust.totalSpent.toFixed(2)} EGP</div>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--glass-border)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-gray)', marginBottom: '0.3rem' }}>{language === 'ar' ? 'عدد الطلبات' : 'Orders Placed'}</div>
                    <div className="font-en" style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--gold-secondary)' }}>{cust.orderCount}</div>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--glass-border)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-gray)', marginBottom: '0.3rem' }}>{language === 'ar' ? 'الطاولة المفضلة' : 'Preferred Table'}</div>
                    <div className="font-en" style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--gold-secondary)' }}>#{cust.preferredTable}</div>
                  </div>
                </div>

                {/* Timeline title */}
                <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginTop: '0.5rem' }}>
                  <h3 style={{ margin: 0, color: 'var(--gold-secondary)', fontSize: '1.1rem' }}>
                    {language === 'ar' ? 'سجل الطلبات والتعاملات 🕒' : 'Transaction & Orders Timeline 🕒'}
                  </h3>
                </div>

                {/* Vertical Timeline container */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingLeft: language === 'ar' ? '0' : '1rem', paddingRight: language === 'ar' ? '1rem' : '0', borderLeft: language === 'ar' ? 'none' : '2px solid var(--border-color)', borderRight: language === 'ar' ? '2px solid var(--border-color)' : 'none' }}>
                  {cust.allOrders.map((order) => (
                    <div key={order.id} style={{ position: 'relative', paddingBottom: '0.5rem' }}>
                      {/* Timeline dot */}
                      <div style={{ 
                        position: 'absolute', 
                        left: language === 'ar' ? 'auto' : '-23px', 
                        right: language === 'ar' ? '-23px' : 'auto', 
                        top: '4px', 
                        width: '12px', 
                        height: '12px', 
                        borderRadius: '50%', 
                        background: order.status === 'completed' ? 'var(--success)' : order.status === 'cancelled' ? 'var(--danger)' : 'var(--warning)',
                        border: '2px solid #111113',
                        boxShadow: '0 0 8px currentColor'
                      }} />
                      
                      {/* Timeline Card */}
                      <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.8rem' }}>
                          <span className="font-en" style={{ fontSize: '0.85rem', color: 'var(--gold-primary)', fontWeight: 'bold' }}>#{order.id.slice(0, 8)}</span>
                          
                          <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                            <span className="font-en" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              {new Date(order.created_at).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}
                            </span>
                            <span style={{ 
                              fontSize: '0.75rem', 
                              padding: '0.15rem 0.5rem', 
                              borderRadius: '6px', 
                              background: order.status === 'completed' ? 'rgba(16,185,129,0.1)' : order.status === 'cancelled' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                              color: order.status === 'completed' ? 'var(--success)' : order.status === 'cancelled' ? 'var(--danger)' : 'var(--warning)',
                              fontWeight: 'bold'
                            }}>
                              {order.status.toUpperCase()}
                            </span>
                          </div>
                        </div>

                        {/* Order info details */}
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', alignItems: 'center' }}>
                          {/* Items */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                            {order.items.map((item, idx) => (
                              <div key={idx} style={{ fontSize: '0.85rem', color: 'var(--text-gray)' }}>
                                • {item.quantity}x {language === 'ar' ? item.name_ar : item.name_en} 
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.4rem', marginRight: '0.4rem' }}>
                                  ({item.price} EGP)
                                </span>
                              </div>
                            ))}
                          </div>
                          
                          {/* Price & table */}
                          <div style={{ textAlign: language === 'ar' ? 'left' : 'right' }}>
                            <div className="font-en" style={{ fontSize: '1rem', color: 'var(--gold-primary)', fontWeight: '800' }}>
                              {order.total_price.toFixed(2)} EGP
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                              {language === 'ar' ? `طاولة رقم ${order.table_number}` : `Table #${order.table_number}`}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="admin-modal-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <button type="button" className="btn-gold" style={{ padding: '0.5rem 1.5rem', borderRadius: '10px' }} onClick={() => setSelectedCustPhone(null)}>
                  {language === 'ar' ? 'إغلاق نافذة العميل' : 'Close Profile'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

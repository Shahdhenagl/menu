import { useState, useEffect, useRef } from 'react';
import type { Category, Product, Order, RestaurantSettings, OrderItem, Expense, PromoCodeDetails, SystemUser, RecipeComment, Printer, Supplier, InventoryItem, PurchaseInvoice, ManufacturingOrder, SystemNotification, ProductionLog, ProductRecipe, Customer } from '../types';
import { db } from '../lib/supabase';
import { printOrderTickets } from '../utils/printUtils';
import { 
  BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, Cell, AreaChart, Area 
} from 'recharts';
import {
  Plus, Edit, Trash2, X, PlusCircle, Save, LogOut, Lock, 
  LayoutDashboard, FolderOpen, Coffee, Users, Settings as Gear, Calendar, Sparkles,
  Upload, Printer as PrinterIcon, Sun, Moon, Search, MonitorSmartphone, Package, Bell, CheckCircle
} from 'lucide-react';

interface AdminDashboardProps {
  onClose: () => void;
  categories: Category[];
  products: Product[];
  orders: Order[];
  settings: RestaurantSettings;
  refreshData: () => Promise<void>;
  language: 'ar' | 'en';
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  setLanguage: (lang: 'ar' | 'en') => void;
}

type TabType = 'analytics' | 'categories' | 'products' | 'orders' | 'customers' | 'debts' | 'invoices' | 'expenses' | 'settings' | 'recipes' | 'system_users' | 'waiters' | 'printers' | 'inventory' | 'factory';

export default function AdminDashboard({
  onClose,
  categories,
  products,
  orders,
  settings,
  refreshData,
  language,
  theme,
  toggleTheme,
  setLanguage
}: AdminDashboardProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('meridien_admin_auth') === 'true';
  });
  const [passcode, setPasscode] = useState('');
  const [loginUsername, setLoginUsername] = useState('');
  const [passcodeError, setPasscodeError] = useState('');
  const [loggedInUser, setLoggedInUser] = useState<SystemUser | null>(() => {
    const saved = localStorage.getItem('meridien_logged_in_user');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [activeTab, setActiveTab] = useState<TabType>('analytics');

  // --- CRUD States ---
  // Categories modal / inputs
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [catNameAr, setCatNameAr] = useState('');
  const [catNameEn, setCatNameEn] = useState('');
  const [catSortOrder, setCatSortOrder] = useState(0);
  const [catPrinterId, setCatPrinterId] = useState('');
  const [catDepartment, setCatDepartment] = useState<'restaurant' | 'bar'>('restaurant');

  // Products modal / inputs
  const [prodModalOpen, setProdModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [prodCatId, setProdCatId] = useState('');
  const [prodNameAr, setProdNameAr] = useState('');
  const [prodNameEn, setProdNameEn] = useState('');
  const [prodPrice, setProdPrice] = useState(0);
  const [prodTalabatPrice, setProdTalabatPrice] = useState<number | ''>('');
  const [prodImageUrl, setProdImageUrl] = useState('');
  const [prodDescAr, setProdDescAr] = useState('');
  const [prodDescEn, setProdDescEn] = useState('');
  const [prodRecipeAr, setProdRecipeAr] = useState('');
  const [prodRecipeEn, setProdRecipeEn] = useState('');
  const [prodAvailable, setProdAvailable] = useState(true);

  // Product Recipes states
  const [prodRecipes, setProdRecipes] = useState<ProductRecipe[]>([]);
  const [selectedInvItemId, setSelectedInvItemId] = useState('');
  const [recipeItemQty, setRecipeItemQty] = useState<number | ''>('');

  // Products filtering
  const [adminProdSearch, setAdminProdSearch] = useState('');
  const [adminProdCatFilter, setAdminProdCatFilter] = useState('all');

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
  const [setLocationUrl, setSetLocationUrl] = useState((settings as any).location_url || '');
  const [taxPercent, setTaxPercent] = useState<number>(settings.tax_percent || 0);
  const [servicePercent, setServicePercent] = useState<number>(settings.service_percent || 0);

  // --- DEBT CUSTOMERS STATE ---
  const [debtCustomers, setDebtCustomers] = useState<Customer[]>([]);
  const [debtSettleAmount, setDebtSettleAmount] = useState<Record<string, number>>({});

  const fetchDebtCustomers = async () => {
    try {
      const custs = await db.getCustomers();
      setDebtCustomers(custs);
    } catch (err) {
      console.error('Error loading debt customers:', err);
    }
  };
  
  // Custom promos / offers management
  const [newPromoCode, setNewPromoCode] = useState('');
  const [newPromoDiscount, setNewPromoDiscount] = useState(10);
  const [newPromoExpiryDate, setNewPromoExpiryDate] = useState('');
  const [newPromoUsageLimit, setNewPromoUsageLimit] = useState<string>('');
  const [newOfferText, setNewOfferText] = useState('');
  const [promos, setPromos] = useState<Record<string, number | PromoCodeDetails>>(settings.promo_codes || {});
  const [offers, setOffers] = useState<string[]>(settings.offers || []);

  const [loading, setLoading] = useState(false);

  // Manual orders states & filtering
  const [orderFilterType, setOrderFilterType] = useState<'all' | 'day' | 'month' | 'year'>('all');
  const [ordersDepartmentFilter, setOrdersDepartmentFilter] = useState<'all' | 'restaurant' | 'bar'>('all');
  const [selectedFilterDay, setSelectedFilterDay] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [selectedFilterMonth, setSelectedFilterMonth] = useState<string>(() => new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [selectedFilterYear, setSelectedFilterYear] = useState<number>(() => new Date().getFullYear());

  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [manualCustName, setManualCustName] = useState('');
  const [manualCustPhone, setManualCustPhone] = useState('');
  const [manualTableNum, setManualTableNum] = useState('');
  const [manualStatus, setManualStatus] = useState<'pending' | 'preparing' | 'delivered' | 'completed' | 'cancelled'>('preparing');
  const [manualItems, setManualItems] = useState<Record<string, number>>({}); // productId -> quantity

  // Customers tab active profile view state
  const [selectedCustPhone, setSelectedCustPhone] = useState<string | null>(null);
  const [custSearch, setCustSearch] = useState('');

  // Payment collection, category filter, and customer autocomplete states
  const [paymentCollectOrder, setPaymentCollectOrder] = useState<Order | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'cash' | 'visa' | 'instapay' | 'wallet'>('cash');
  const [showCustDropdown, setShowCustDropdown] = useState(false);
  const [selectedManualCat, setSelectedManualCat] = useState<string>('all');

  // --- EXPENSES & COSTS MODULE STATES ---
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expModalOpen, setExpModalOpen] = useState(false);
  const [expName, setExpName] = useState('');
  const [expType, setExpType] = useState('بضائع وخامات');
  const [expAmount, setExpAmount] = useState(0);
  const [expDate, setExpDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [expPaymentMethod, setExpPaymentMethod] = useState<'cash' | 'visa' | 'wallet' | 'instapay'>('cash');
  
  // Expenses filtering states
  const [expFilterType, setExpFilterType] = useState<'all' | 'day' | 'month' | 'year'>('all');
  const [expFilterDay, setExpFilterDay] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [expFilterMonth, setExpFilterMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [expFilterYear, setExpFilterYear] = useState<number>(() => new Date().getFullYear());

  // Analytics filtering states
  const [analyticsFilterType, setAnalyticsFilterType] = useState<'all' | 'day' | 'month' | 'year'>('all');
  const [analyticsFilterDay, setAnalyticsFilterDay] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [analyticsFilterMonth, setAnalyticsFilterMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [analyticsFilterYear, setAnalyticsFilterYear] = useState<number>(() => new Date().getFullYear());
  const [analyticsDepartmentFilter, setAnalyticsDepartmentFilter] = useState<'all' | 'restaurant' | 'bar'>('all');

  const fetchExpenses = async () => {
    try {
      const data = await db.getExpenses();
      setExpenses(data);
    } catch (err) {
      console.error("Error loading expenses:", err);
    }
  };

  // --- SYSTEM USERS MODULE STATES ---
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
  const [sysUserModalOpen, setSysUserModalOpen] = useState(false);
  const [sysName, setSysName] = useState('');
  const [sysPhone, setSysPhone] = useState('');
  const [sysUsername, setSysUsername] = useState('');
  const [sysPasscode, setSysPasscode] = useState('');
  const [sysIsAdmin, setSysIsAdmin] = useState(false);
  const [sysPermissions, setSysPermissions] = useState<string[]>(['orders']);

  const AVAILABLE_PERMISSIONS = [
    { id: 'analytics', ar: 'نظرة عامة والتحليلات', en: 'Overview & Analytics' },
    { id: 'categories', ar: 'إدارة التصنيفات', en: 'Categories' },
    { id: 'products', ar: 'إدارة المنتجات', en: 'Products' },
    { id: 'orders', ar: 'إدارة الطلبات', en: 'Orders' },
    { id: 'customers', ar: 'إدارة العملاء', en: 'Customers' },
    { id: 'expenses', ar: 'التكاليف والمصروفات', en: 'Costs & Expenses' },
    { id: 'recipes', ar: 'وصفات الشيف', en: 'Chef Recipes' },
    { id: 'system_users', ar: 'مستخدمين النظام', en: 'System Users' },
    { id: 'waiters', ar: 'إدارة الويترز', en: 'Waiters Management' },
    { id: 'settings', ar: 'إدارة النظام والروابط', en: 'Settings' },
    { id: 'pos', ar: 'نقاط البيع (كابتن أوردر)', en: 'POS System (Captain)' },
    { id: 'printers', ar: 'إعدادات الطابعات', en: 'Printers' },
    { id: 'inventory', ar: 'إدارة المخازن والموردين', en: 'Inventory & Suppliers' },
    { id: 'inventory_manager', ar: 'أمين المخزن', en: 'Inventory Manager' },
    { id: 'kitchen_manager', ar: 'مسؤول المطبخ / التصنيع', en: 'Kitchen Manager' }
  ];

  const hasPermission = (tabId: string) => {
    if (!loggedInUser) return false;
    const roles = loggedInUser.role.split(',');
    if (roles.includes('admin')) return true;
    return roles.includes(tabId);
  };
  const fetchSystemUsers = async () => {
    try {
      const data = await db.getSystemUsers();
      setSystemUsers(data);
    } catch (err) {
      console.error("Error loading system users:", err);
    }
  };

  // --- RECIPES COMMENTS STATES ---
  const [allRecipeComments, setAllRecipeComments] = useState<Record<string, RecipeComment[]>>({}); // productId -> comments[]
  const [newCommentText, setNewCommentText] = useState<{ [productId: string]: string }>({});
  const [selectedRecipeProduct, setSelectedRecipeProduct] = useState<Product | null>(null);

  const fetchCommentsForProduct = async (productId: string) => {
    try {
      const comments = await db.getRecipeComments(productId);
      setAllRecipeComments(prev => ({ ...prev, [productId]: comments }));
    } catch (err) {
      console.error("Error fetching comments:", err);
    }
  };

  const handleAddComment = async (e: React.FormEvent, productId: string) => {
    e.preventDefault();
    const text = newCommentText[productId];
    if (!text || !text.trim() || !loggedInUser) return;
    
    try {
      const comment = await db.addRecipeComment({
        product_id: productId,
        user_name: loggedInUser.name,
        comment: text.trim(),
        created_at: new Date().toISOString()
      });
      setAllRecipeComments(prev => ({
        ...prev,
        [productId]: [...(prev[productId] || []), comment]
      }));
      setNewCommentText(prev => ({ ...prev, [productId]: '' }));
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveSystemUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sysName.trim() || !sysUsername.trim() || !sysPasscode.trim()) return;
    setLoading(true);
    try {
      await db.addSystemUser({
        name: sysName,
        phone: sysPhone,
        username: sysUsername,
        passcode: sysPasscode,
        role: sysIsAdmin ? 'admin' : sysPermissions.join(',')
      });
      await fetchSystemUsers();
      setSysUserModalOpen(false);
      setSysName('');
      setSysPhone('');
      setSysUsername('');
      setSysPasscode('');
      setSysIsAdmin(false);
      setSysPermissions(['orders']);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSystemUser = async (id: string) => {
    if (!confirm(language === 'ar' ? 'هل أنت متأكد من حذف هذا المستخدم؟' : 'Are you sure you want to delete this user?')) return;
    setLoading(true);
    try {
      await db.deleteSystemUser(id);
      await fetchSystemUsers();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // --- WAITERS MODULE STATES ---
  const [waiterModalOpen, setWaiterModalOpen] = useState(false);
  const [waiterName, setWaiterName] = useState('');
  const [waiterPhone, setWaiterPhone] = useState('');
  const [waiterPasscode, setWaiterPasscode] = useState('');

  const handleSaveWaiter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waiterName.trim() || !waiterPasscode.trim()) return;
    setLoading(true);
    try {
      await db.addSystemUser({
        name: waiterName,
        phone: waiterPhone,
        username: `waiter_${Math.floor(Math.random() * 10000)}`,
        passcode: waiterPasscode,
        role: 'waiter'
      });
      await fetchSystemUsers();
      setWaiterModalOpen(false);
      setWaiterName('');
      setWaiterPhone('');
      setWaiterPasscode('');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };


  // --- PRINTERS MODULE STATES ---
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [printerModalOpen, setPrinterModalOpen] = useState(false);
  const [printerNameAr, setPrinterNameAr] = useState('');
  const [printerNameEn, setPrinterNameEn] = useState('');
  const [printerDepartment, setPrinterDepartment] = useState<'restaurant' | 'bar'>('restaurant');

  // --- INVENTORY STATES ---
  const [inventorySubTab, setInventorySubTab] = useState<'suppliers' | 'items' | 'invoices' | 'mfg_orders'>('items');
  const [factorySubTab, setFactorySubTab] = useState<'mfg_requests' | 'production'>('mfg_requests');
  const [productionLogs, setProductionLogs] = useState<ProductionLog[]>([]);
  const [producedItemId, setProducedItemId] = useState('');
  const [producedQuantity, setProducedQuantity] = useState(1);
  const [consumedItems, setConsumedItems] = useState<{item_id: string, quantity: number}[]>([]);
  const [productionModalOpen, setProductionModalOpen] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState<PurchaseInvoice[]>([]);
  
  // Suppliers modal
  const [supModalOpen, setSupModalOpen] = useState(false);
  const [supName, setSupName] = useState('');
  const [supPhone, setSupPhone] = useState('');

  // Inventory Item modal
  const [invModalOpen, setInvModalOpen] = useState(false);
  const [invName, setInvName] = useState('');
  const [invUnit, setInvUnit] = useState('كجم');
  const [invUnitsPerCarton, setInvUnitsPerCarton] = useState<number | ''>('');
  const [invUnitsPerBox, setInvUnitsPerBox] = useState<number | ''>('');

  // Purchase Invoice modal
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoiceSupplierId, setInvoiceSupplierId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [invoiceCart, setInvoiceCart] = useState<{item_id: string, quantity: number, unit_price: number}[]>([]);

  // Phase 2: Manufacturing Orders & Notifications
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  
  const [manufacturingOrders, setManufacturingOrders] = useState<ManufacturingOrder[]>([]);
  const [mfgModalOpen, setMfgModalOpen] = useState(false);
  const [mfgCart, setMfgCart] = useState<{item_id: string, item_name: string, quantity: number, unit: string, calculated_main_quantity: number}[]>([]);

  const fetchInventoryData = async () => {
    try {
      const sups = await db.getSuppliers();
      const items = await db.getInventoryItems();
      const invs = await db.getPurchaseInvoices();
      const mfg = await db.getManufacturingOrders();
      const prodLogs = await db.getProductionLogs();
      setSuppliers(sups);
      setInventoryItems(items);
      setPurchaseInvoices(invs);
      setManufacturingOrders(mfg);
      setProductionLogs(prodLogs);
      
      if (loggedInUser) {
        const notifs = await db.getNotifications(loggedInUser.role);
        setNotifications(notifs);
      }
    } catch (err) {
      console.error("Error loading inventory:", err);
    }
  };

  const prevUnreadCount = useRef(0);

  useEffect(() => {
    fetchInventoryData();
  }, [loggedInUser]);

  useEffect(() => {
    const currentUnread = notifications.filter(n => !n.is_read).length;
    if (currentUnread > prevUnreadCount.current) {
      try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContext) {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const gainNode = ctx.createGain();
          
          osc.type = 'sine';
          osc.frequency.setValueAtTime(880, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1);
          
          gainNode.gain.setValueAtTime(0, ctx.currentTime);
          gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
          
          osc.connect(gainNode);
          gainNode.connect(ctx.destination);
          
          osc.start();
          osc.stop(ctx.currentTime + 0.5);
        }
      } catch (e) {
        console.error('Audio play failed:', e);
      }
    }
    prevUnreadCount.current = currentUnread;
  }, [notifications]);

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supName.trim()) return;
    setLoading(true);
    try {
      await db.addSupplier({ name: supName, phone: supPhone });
      await fetchInventoryData();
      setSupModalOpen(false);
      setSupName('');
      setSupPhone('');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSupplier = async (id: string) => {
    if (!confirm('Are you sure you want to delete this supplier?')) return;
    try {
      await db.deleteSupplier(id);
      await fetchInventoryData();
    } catch(err) { console.error(err); }
  };

  const handleSaveInventoryItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invName.trim()) return;
    setLoading(true);
    try {
      await db.addInventoryItem({
        name: invName,
        unit: invUnit,
        stock_main: 0,
        stock_factory: 0,
        stock_distribution: 0,
        avg_purchase_price: 0,
        last_purchase_price: 0,
        units_per_carton: invUnitsPerCarton ? Number(invUnitsPerCarton) : undefined,
        units_per_box: invUnitsPerBox ? Number(invUnitsPerBox) : undefined
      });
      await fetchInventoryData();
      setInvModalOpen(false);
      setInvName('');
      setInvUnit('كجم');
      setInvUnitsPerCarton('');
      setInvUnitsPerBox('');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteInventoryItem = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    try {
      await db.deleteInventoryItem(id);
      await fetchInventoryData();
    } catch(err) { console.error(err); }
  };

  const handleSavePurchaseInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceSupplierId || invoiceCart.length === 0) {
      alert("Please select a supplier and add at least one item.");
      return;
    }
    setLoading(true);
    try {
      const sup = suppliers.find(s => s.id === invoiceSupplierId);
      let total = 0;
      const itemsToSave = invoiceCart.map(c => {
        const itemObj = inventoryItems.find(i => i.id === c.item_id);
        const itemTotal = c.quantity * c.unit_price;
        total += itemTotal;
        return {
          item_id: c.item_id,
          item_name: itemObj ? itemObj.name : 'Unknown',
          quantity: c.quantity,
          unit_price: c.unit_price,
          total_price: itemTotal
        };
      });

      await db.addPurchaseInvoice({
        supplier_id: invoiceSupplierId,
        supplier_name: sup ? sup.name : 'Unknown',
        invoice_date: invoiceDate,
        items: itemsToSave,
        total_amount: total
      });
      
      await fetchInventoryData();
      setInvoiceModalOpen(false);
      setInvoiceCart([]);
      setInvoiceSupplierId('');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveManufacturingOrder = async () => {
    if (mfgCart.length === 0) return;
    setLoading(true);
    try {
      await db.addManufacturingOrder({
        status: 'pending',
        items: mfgCart,
        requested_by: loggedInUser ? loggedInUser.name : 'Unknown'
      });
      await fetchInventoryData();
      setMfgModalOpen(false);
      setMfgCart([]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProductionLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!producedItemId || producedQuantity <= 0 || consumedItems.length === 0) {
      alert(language === 'ar' ? 'يجب اختيار منتج وإضافة خامات مستهلكة!' : 'Must select a product and add consumed items!');
      return;
    }
    setLoading(true);
    try {
      const prodItem = inventoryItems.find(i => i.id === producedItemId);
      await db.addProductionLog({
        produced_items: [{
          item_id: producedItemId,
          item_name: prodItem?.name || '',
          quantity: producedQuantity
        }],
        consumed_items: consumedItems.map(c => ({
          item_id: c.item_id,
          item_name: inventoryItems.find(i => i.id === c.item_id)?.name || '',
          quantity: c.quantity
        })),
        recorded_by: loggedInUser?.name || 'Unknown'
      });
      await fetchInventoryData();
      setProductionModalOpen(false);
      setProducedItemId('');
      setProducedQuantity(1);
      setConsumedItems([]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveManufacturingOrder = async (id: string, isApprove: boolean) => {
    setLoading(true);
    try {
      await db.updateManufacturingOrderStatus(id, isApprove ? 'approved' : 'rejected', loggedInUser ? loggedInUser.name : 'Unknown');
      await fetchInventoryData();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const markNotificationAsRead = async (id: string) => {
    await db.markNotificationRead(id);
    await fetchInventoryData();
  };

  const fetchPrinters = async () => {
    try {
      const data = await db.getPrinters();
      setPrinters(data);
    } catch (err) {
      console.error("Error loading printers:", err);
    }
  };

  const handleSavePrinter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!printerNameAr.trim() || !printerNameEn.trim()) return;
    setLoading(true);
    try {
      await db.addPrinter({
        name_ar: printerNameAr,
        name_en: printerNameEn,
        department: printerDepartment
      });
      await fetchPrinters();
      setPrinterModalOpen(false);
      setPrinterNameAr('');
      setPrinterNameEn('');
      setPrinterDepartment('restaurant');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePrinter = async (id: string) => {
    if (!confirm(language === 'ar' ? 'هل أنت متأكد من حذف هذه الطابعة؟' : 'Are you sure you want to delete this printer?')) return;
    setLoading(true);
    try {
      await db.deletePrinter(id);
      await fetchPrinters();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
    fetchSystemUsers();
    fetchPrinters();
    fetchDebtCustomers();
  }, []);

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expName.trim() || expAmount <= 0) {
      alert(language === 'ar' ? 'يرجى إدخال اسم المصروف وقيمة صالحة!' : 'Please enter cost name and a valid amount!');
      return;
    }
    setLoading(true);
    try {
      await db.addExpense({
        name: expName.trim(),
        type: expType,
        amount: Number(expAmount),
        payment_method: expPaymentMethod,
        expense_date: expDate
      });
      await fetchExpenses();
      setExpModalOpen(false);
      setExpName('');
      setExpType('بضائع وخامات');
      setExpAmount(0);
      setExpDate(new Date().toISOString().split('T')[0]);
      setExpPaymentMethod('cash');
      alert(language === 'ar' ? 'تم تسجيل المصروف بنجاح!' : 'Expense recorded successfully!');
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء حفظ المصروف.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm(language === 'ar' ? 'هل أنت متأكد من حذف هذا المصروف؟' : 'Are you sure you want to delete this expense?')) return;
    setLoading(true);
    try {
      await db.deleteExpense(id);
      await fetchExpenses();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

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
    setSetLocationUrl(settings.location_url || '');
    setTaxPercent(settings.tax_percent || 0);
    setServicePercent(settings.service_percent || 0);
    setPromos(settings.promo_codes || {});
    setOffers(settings.offers || []);
  }, [settings]);

  // Passcode gate validation
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const isMasterAdmin = (loginUsername === 'admin' && passcode === '123456');
    const matchedUser = systemUsers.find(u => u.username === loginUsername && u.passcode === passcode);

    if (isMasterAdmin || matchedUser) {
      setIsAuthenticated(true);
      localStorage.setItem('meridien_admin_auth', 'true');
      setPasscodeError('');
      if (matchedUser) {
        setLoggedInUser(matchedUser);
        localStorage.setItem('meridien_logged_in_user', JSON.stringify(matchedUser));
      } else {
        const superAdmin = { id: 'admin', name: 'Super Admin', phone: '', username: 'admin', passcode: '123456', role: 'admin' };
        setLoggedInUser(superAdmin);
        localStorage.setItem('meridien_logged_in_user', JSON.stringify(superAdmin));
      }
    } else {
      setPasscodeError(language === 'ar' ? 'اسم المستخدم أو الرمز السري غير صحيح!' : 'Incorrect username or passcode!');
    }
  };

  // --- CATEGORIES CRUD ACTIONS ---
  const handleOpenCatModal = (cat: Category | null = null) => {
    if (cat) {
      setEditingCategory(cat);
      setCatNameAr(cat.name_ar);
      setCatNameEn(cat.name_en);
      setCatSortOrder(cat.sort_order);
      setCatPrinterId(cat.printer_id || '');
      setCatDepartment(cat.department || 'restaurant');
    } else {
      setEditingCategory(null);
      setCatNameAr('');
      setCatNameEn('');
      setCatSortOrder(categories.length + 1);
      setCatPrinterId('');
      setCatDepartment('restaurant');
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
          sort_order: Number(catSortOrder),
          printer_id: catPrinterId || null,
          department: catDepartment
        });
      } else {
        await db.addCategory({
          name_ar: catNameAr,
          name_en: catNameEn,
          sort_order: Number(catSortOrder),
          printer_id: catPrinterId || null,
          department: catDepartment
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
  const handleOpenProdModal = async (prod: Product | null = null) => {
    setSelectedInvItemId('');
    setRecipeItemQty('');
    if (prod) {
      setEditingProduct(prod);
      setProdCatId(prod.category_id);
      setProdNameAr(prod.name_ar);
      setProdNameEn(prod.name_en);
      setProdPrice(prod.price);
      setProdTalabatPrice(prod.talabat_price ?? '');
      setProdImageUrl(prod.image_url);
      setProdDescAr(prod.description_ar);
      setProdDescEn(prod.description_en);
      setProdRecipeAr(prod.recipe_ar || '');
      setProdRecipeEn(prod.recipe_en || '');
      setProdAvailable(prod.is_available);
      
      try {
        const recipes = await db.getProductRecipes(prod.id);
        setProdRecipes(recipes);
      } catch (err) {
        console.error("Error fetching recipes:", err);
        setProdRecipes([]);
      }
    } else {
      setEditingProduct(null);
      setProdCatId(categories[0]?.id || '');
      setProdNameAr('');
      setProdNameEn('');
      setProdPrice(0);
      setProdTalabatPrice('');
      setProdImageUrl('');
      setProdDescAr('');
      setProdDescEn('');
      setProdRecipeAr('');
      setProdRecipeEn('');
      setProdAvailable(true);
      setProdRecipes([]);
    }
    setProdModalOpen(true);
  };

  const handleAddRecipeItem = () => {
    if (!selectedInvItemId || !recipeItemQty || Number(recipeItemQty) <= 0) {
      alert(language === 'ar' ? 'يرجى اختيار مكون وكمية صحيحة أكبر من صفر.' : 'Please select an item and a valid quantity greater than zero.');
      return;
    }

    const item = inventoryItems.find(i => i.id === selectedInvItemId);
    if (!item) return;

    if (prodRecipes.some(r => r.inventory_item_id === selectedInvItemId)) {
      alert(language === 'ar' ? 'هذا المكون موجود بالفعل في الوصفة.' : 'This ingredient is already in the recipe.');
      return;
    }

    const newRecipeItem: ProductRecipe = {
      id: crypto.randomUUID(),
      product_id: editingProduct?.id || '',
      inventory_item_id: selectedInvItemId,
      quantity: Number(recipeItemQty),
      inventory_item_name: item.name,
      inventory_item_unit: item.unit
    };

    setProdRecipes([...prodRecipes, newRecipeItem]);
    setSelectedInvItemId('');
    setRecipeItemQty('');
  };

  const handleRemoveRecipeItem = (invItemId: string) => {
    setProdRecipes(prodRecipes.filter(r => r.inventory_item_id !== invItemId));
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodNameAr.trim() || !prodNameEn.trim() || prodPrice <= 0 || !prodCatId) {
      alert(language === 'ar' ? 'يرجى إدخال اسم المنتج (عربي وإنجليزي)، والتصنيف، وسعر صحيح أكبر من صفر.' : 'Please enter the product name (AR & EN), category, and a valid price greater than zero.');
      return;
    }

    setLoading(true);
    try {
      const prodData = {
        category_id: prodCatId,
        name_ar: prodNameAr,
        name_en: prodNameEn,
        price: Number(prodPrice),
        talabat_price: prodTalabatPrice === '' ? undefined : Number(prodTalabatPrice),
        image_url: prodImageUrl,
        description_ar: prodDescAr,
        description_en: prodDescEn,
        recipe_ar: prodRecipeAr,
        recipe_en: prodRecipeEn,
        is_available: prodAvailable
      };

      let savedProd: Product | null = null;
      if (editingProduct) {
        savedProd = await db.updateProduct(editingProduct.id, prodData);
      } else {
        savedProd = await db.addProduct(prodData);
      }

      if (savedProd && savedProd.id) {
        await db.updateProductRecipe(
          savedProd.id, 
          prodRecipes.map(r => ({ inventory_item_id: r.inventory_item_id, quantity: r.quantity }))
        );
      }
      
      await refreshData();
      setProdModalOpen(false);
    } catch (err: any) {
      console.error(err);
      alert(language === 'ar' ? 'حدث خطأ أثناء حفظ المنتج.' : 'An error occurred while saving the product.');
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

  const handleCollectPayment = async (orderId: string, method: string) => {
    setLoading(true);
    try {
      await db.updateOrderStatus(orderId, `completed_${method}` as any);
      await refreshData();
      alert(language === 'ar' ? 'تم تحصيل الحساب وإكمال الطلب بنجاح! 🎉' : 'Payment collected and order completed successfully! 🎉');
      setPaymentCollectOrder(null);
    } catch (err) {
      console.error(err);
      alert(language === 'ar' ? 'حدث خطأ أثناء تحصيل الحساب.' : 'An error occurred during payment collection.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveManualOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCustName.trim() || !manualCustPhone.trim() || !manualTableNum.trim()) {
      alert(language === 'ar' ? 'يرجى ملء كافة البيانات الأساسية!' : 'Please fill all basic info!');
      return;
    }

    const itemsList: OrderItem[] = [];
    let subtotal = 0;
    
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
          subtotal += prod.price * qty;
        }
      }
    });

    if (itemsList.length === 0) {
      alert(language === 'ar' ? 'يرجى إضافة صنف واحد على الأقل للطلب!' : 'Please add at least one item!');
      return;
    }

    const servicePercent = settings.service_percent || 0;
    const serviceAmount = subtotal * (servicePercent / 100);
    const taxPercent = settings.tax_percent || 0;
    const taxAmount = (subtotal + serviceAmount) * (taxPercent / 100);
    const totalPrice = subtotal + serviceAmount + taxAmount;

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
      setManualStatus('preparing');
      setManualItems({});
      alert(language === 'ar' ? 'تم إضافة الطلب يدويًا بنجاح!' : 'Order added manually successfully!');
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء حفظ الطلب.');
    } finally {
      setLoading(false);
    }
  };

  const orderHasDepartment = (order: Order, dept: 'restaurant' | 'bar') => {
    return order.items.some(item => {
      const product = products.find(p => p.name_ar === item.name_ar || p.name_en === item.name_en);
      if (!product) return false;
      const category = categories.find(c => c.id === product.category_id);
      return category && (category.department || 'restaurant') === dept;
    });
  };

  const filteredOrders = orders.filter(order => {
    if (ordersDepartmentFilter !== 'all' && !orderHasDepartment(order, ordersDepartmentFilter)) return false;
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

  // --- EXPENSE LISTS FILTERING ---
  const filteredExpenses = expenses.filter(exp => {
    if (!exp.expense_date) return true;
    const expDateObj = new Date(exp.expense_date);
    if (expFilterType === 'day') {
      return exp.expense_date === expFilterDay;
    }
    if (expFilterType === 'month') {
      const monthStr = exp.expense_date.slice(0, 7);
      return monthStr === expFilterMonth;
    }
    if (expFilterType === 'year') {
      return expDateObj.getFullYear() === expFilterYear;
    }
    return true;
  });

  const filteredTotalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  // --- SETTINGS ACTIONS ---
  const handleAddPromo = () => {
    if (!newPromoCode.trim()) return;
    const code = newPromoCode.toUpperCase().trim();
    setPromos(prev => ({
      ...prev,
      [code]: {
        discount: Number(newPromoDiscount),
        expiryDate: newPromoExpiryDate || null,
        usageLimit: newPromoUsageLimit ? Number(newPromoUsageLimit) : null
      }
    }));
    setNewPromoCode('');
    setNewPromoExpiryDate('');
    setNewPromoUsageLimit('');
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
        talabat_url: setTalabat,
        location_url: setLocationUrl,
        tax_percent: taxPercent,
        service_percent: servicePercent
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
  const analyticsFilteredOrders = orders.filter(o => {
    if (analyticsDepartmentFilter !== 'all' && !orderHasDepartment(o, analyticsDepartmentFilter)) return false;
    if (analyticsFilterType === 'all') return true;
    if (!o.created_at) return true;
    const dateObj = new Date(o.created_at);
    if (analyticsFilterType === 'day') return dateObj.toISOString().split('T')[0] === analyticsFilterDay;
    if (analyticsFilterType === 'month') return dateObj.toISOString().slice(0, 7) === analyticsFilterMonth;
    if (analyticsFilterType === 'year') return dateObj.getFullYear() === analyticsFilterYear;
    return true;
  });

  const analyticsFilteredExpenses = expenses.filter(exp => {
    if (analyticsFilterType === 'all') return true;
    if (!exp.expense_date) return true;
    const dateObj = new Date(exp.expense_date);
    if (analyticsFilterType === 'day') return exp.expense_date === analyticsFilterDay;
    if (analyticsFilterType === 'month') return exp.expense_date.slice(0, 7) === analyticsFilterMonth;
    if (analyticsFilterType === 'year') return dateObj.getFullYear() === analyticsFilterYear;
    return true;
  });

  // Stats Counters
  const completedOrders = analyticsFilteredOrders.filter(o => o.status.startsWith('completed'));
  const totalRevenue = completedOrders.reduce((sum, o) => sum + o.total_price, 0);
  const totalOrdersCount = analyticsFilteredOrders.length;
  const avgOrderValue = completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0;
  const activeProductsCount = products.filter(p => p.is_available).length;

  // --- ADDITIONAL FINANCIAL CALCULATIONS ---
  // Total Expenses (All recorded expenses)
  const totalExpenses = analyticsFilteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  
  // Net Profit (Revenue - Total Expenses)
  const netProfit = totalRevenue - totalExpenses;

  // Combined Financial Log
  const combinedFinancialLog: Array<{
    id: string;
    type: 'income' | 'expense';
    title: string;
    amount: number;
    date: Date;
    method?: string;
  }> = [];

  completedOrders.forEach(o => {
    if (o.created_at) {
      combinedFinancialLog.push({
        id: o.id,
        type: 'income',
        title: language === 'ar' ? `تحصيل طلب #${o.id.slice(0,4)}` : `Order Collection #${o.id.slice(0,4)}`,
        amount: o.total_price,
        date: new Date(o.created_at),
        method: o.status.split('_')[1] || 'cash'
      });
    }
  });

  analyticsFilteredExpenses.forEach(e => {
    if (e.expense_date) {
      combinedFinancialLog.push({
        id: e.id,
        type: 'expense',
        title: e.name || (language === 'ar' ? 'مصروف' : 'Expense'),
        amount: e.amount,
        date: new Date(e.expense_date),
        method: e.payment_method || 'cash'
      });
    }
  });

  // Sort by date descending
  combinedFinancialLog.sort((a, b) => b.date.getTime() - a.date.getTime());

  // Bottom 5 Least Sold Products (including those with 0 sales)
  const allProductsSalesMap: Record<string, { id: string; name_ar: string; name_en: string; quantity: number; revenue: number }> = {};
  
  // Initialize map with all products as 0 sales
  products.forEach(p => {
    allProductsSalesMap[p.id] = {
      id: p.id,
      name_ar: p.name_ar,
      name_en: p.name_en,
      quantity: 0,
      revenue: 0
    };
  });
  
  // Fill in actual sales for completed orders
  analyticsFilteredOrders.forEach(order => {
    if (order.status.startsWith('completed')) {
      order.items.forEach(item => {
        if (allProductsSalesMap[item.id]) {
          allProductsSalesMap[item.id].quantity += item.quantity;
          allProductsSalesMap[item.id].revenue += item.quantity * item.price;
        }
      });
    }
  });

  const leastSoldProductsReport = Object.values(allProductsSalesMap)
    .sort((a, b) => a.quantity - b.quantity) // Ascending order (least sold first)
    .slice(0, 5);

  // Payment Methods Breakdown (Total Revenue vs Total Expenses)
  const paymentMethodsStats = {
    cash: { revenue: 0, expenses: 0, net: 0 },
    visa: { revenue: 0, expenses: 0, net: 0 },
    wallet: { revenue: 0, expenses: 0, net: 0 },
    instapay: { revenue: 0, expenses: 0, net: 0 }
  };

  analyticsFilteredOrders.forEach(order => {
    if (order.status.startsWith('completed')) {
      const parts = order.status.split('_');
      const method = parts[1] as 'cash' | 'visa' | 'wallet' | 'instapay';
      if (method && paymentMethodsStats[method]) {
        paymentMethodsStats[method].revenue += order.total_price;
      } else {
        // Fallback to cash if completed status doesn't specify a method
        paymentMethodsStats.cash.revenue += order.total_price;
      }
    }
  });

  analyticsFilteredExpenses.forEach(exp => {
    const method = exp.payment_method;
    if (method && paymentMethodsStats[method]) {
      paymentMethodsStats[method].expenses += exp.amount;
    }
  });

  // Calculate Net balance for each payment method
  (Object.keys(paymentMethodsStats) as Array<keyof typeof paymentMethodsStats>).forEach(method => {
    paymentMethodsStats[method].net = paymentMethodsStats[method].revenue - paymentMethodsStats[method].expenses;
  });

  // --- RTL A4 PRINT UTILITY ENGINE ---
  const handlePrintReport = (module: 'analytics' | 'orders' | 'expenses' | 'customers') => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    let contentHtml = '';
    let reportTitle = '';

    if (module === 'analytics') {
      reportTitle = language === 'ar' ? 'تقرير التحليلات المالية والأرباح' : 'Financial Analytics & Profit Report';
      contentHtml = `
        <div class="print-header">
          <h1>${settings.restaurant_name_ar || 'مريديان'}</h1>
          <h2>${reportTitle}</h2>
          <p class="date">${new Date().toLocaleString('ar-EG')}</p>
        </div>
        
        <div class="section-title">${language === 'ar' ? 'قائمة ملخص الأرباح والدخل التشغيلي' : 'Income Statement Summary'}</div>
        <table class="print-table">
          <thead>
            <tr>
              <th>${language === 'ar' ? 'البند المالي' : 'Financial Item'}</th>
              <th>${language === 'ar' ? 'المبلغ' : 'Amount'}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>${language === 'ar' ? 'إجمالي المبيعات والإيرادات' : 'Total Revenue'}</strong></td>
              <td class="success font-en">+${totalRevenue.toLocaleString()} EGP</td>
            </tr>
            <tr>
              <td><strong>${language === 'ar' ? 'إجمالي المصروفات والتكاليف التشغيلية' : 'Total Expenses'}</strong></td>
              <td class="danger font-en">-${totalExpenses.toLocaleString()} EGP</td>
            </tr>
            <tr style="background: rgba(212,175,55,0.06)">
              <td><strong>${language === 'ar' ? 'صافي الربح / الخسارة' : 'Net Profit / Loss'}</strong></td>
              <td class="${netProfit >= 0 ? 'success' : 'danger'} font-en" style="font-size: 1.1rem; font-weight: bold;">
                ${netProfit >= 0 ? '+' : ''}${netProfit.toLocaleString()} EGP
              </td>
            </tr>
          </tbody>
        </table>

        <div class="section-title">${language === 'ar' ? 'أرصدة طرق الدفع والتدفقات' : 'Payment Method Balances'}</div>
        <table class="print-table">
          <thead>
            <tr>
              <th>${language === 'ar' ? 'طريقة الدفع' : 'Payment Method'}</th>
              <th>${language === 'ar' ? 'الإيرادات' : 'Revenue'}</th>
              <th>${language === 'ar' ? 'المصروفات' : 'Expenses'}</th>
              <th>${language === 'ar' ? 'الصافي المتبقي' : 'Net Balance'}</th>
            </tr>
          </thead>
          <tbody>
            ${(Object.keys(paymentMethodsStats) as Array<keyof typeof paymentMethodsStats>).map(m => {
              const stats = paymentMethodsStats[m];
              const name = m === 'cash' ? '💵 كاش (نقدي)' : m === 'visa' ? '💳 فيزا' : m === 'wallet' ? '📱 محفظة' : '⚡ إنستا باي';
              return `
                <tr>
                  <td><strong>${name}</strong></td>
                  <td class="success font-en">+${stats.revenue.toLocaleString()} EGP</td>
                  <td class="danger font-en">-${stats.expenses.toLocaleString()} EGP</td>
                  <td class="${stats.net >= 0 ? 'success' : 'danger'} font-en" style="font-weight: bold;">
                    ${stats.net >= 0 ? '+' : ''}${stats.net.toLocaleString()} EGP
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div class="section-title">${language === 'ar' ? 'المنتجات الأقل طلباً (الأضعف مبيعاً)' : 'Least Sold Products'}</div>
        <table class="print-table">
          <thead>
            <tr>
              <th>${language === 'ar' ? 'اسم المنتج' : 'Product Name'}</th>
              <th>${language === 'ar' ? 'الكمية المباعة' : 'Units Sold'}</th>
              <th>${language === 'ar' ? 'إجمالي المبيعات' : 'Revenue Generated'}</th>
            </tr>
          </thead>
          <tbody>
            ${leastSoldProductsReport.map(prod => `
              <tr>
                <td><strong>${prod.name_ar}</strong></td>
                <td class="font-en">${prod.quantity}</td>
                <td class="font-en">${prod.revenue.toLocaleString()} EGP</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else if (module === 'orders') {
      reportTitle = language === 'ar' ? 'تقرير فواتير المبيعات والطلبات' : 'Sales Orders Report';
      contentHtml = `
        <div class="print-header">
          <h1>${settings.restaurant_name_ar || 'مريديان'}</h1>
          <h2>${reportTitle}</h2>
          <p class="date">${new Date().toLocaleString('ar-EG')}</p>
        </div>
        
        <table class="print-table">
          <thead>
            <tr>
              <th>${language === 'ar' ? 'رقم الطلب' : 'Ref'}</th>
              <th>${language === 'ar' ? 'العميل' : 'Customer'}</th>
              <th>${language === 'ar' ? 'الطاولة' : 'Table'}</th>
              <th>${language === 'ar' ? 'الحالة' : 'Status'}</th>
              <th>${language === 'ar' ? 'التاريخ والوقت' : 'Date'}</th>
              <th>${language === 'ar' ? 'القيمة الإجمالية' : 'Total'}</th>
            </tr>
          </thead>
          <tbody>
            ${filteredOrders.map(o => `
              <tr>
                <td class="font-en" style="font-size: 0.8rem;">#${o.id.slice(0, 8)}</td>
                <td><strong>${o.customer_name}</strong><br/><span style="font-size: 0.75rem; color: #666;">${o.customer_phone}</span></td>
                <td><strong>${o.table_number}</strong></td>
                <td>
                  <span style="padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.75rem; font-weight: bold; background: ${o.status.startsWith('completed') ? '#d1fae5; color: #065f46;' : o.status === 'cancelled' ? '#fee2e2; color: #991b1b;' : '#fef3c7; color: #92400e;'}">
                    ${o.status.toUpperCase()}
                  </span>
                </td>
                <td class="font-en" style="font-size: 0.8rem;">${new Date(o.created_at).toLocaleString('ar-EG')}</td>
                <td class="font-en" style="font-weight: bold; color: #d4af37;">${o.total_price.toFixed(2)} EGP</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else if (module === 'expenses') {
      reportTitle = language === 'ar' ? 'تقرير التكاليف والمصروفات التشغيلية' : 'Operational Expenses Report';
      contentHtml = `
        <div class="print-header">
          <h1>${settings.restaurant_name_ar || 'مريديان'}</h1>
          <h2>${reportTitle}</h2>
          <p class="date">${new Date().toLocaleString('ar-EG')}</p>
        </div>

        <div style="background: #fdfaf2; padding: 1rem; border-radius: 8px; border: 1px solid #e9d9b6; margin-bottom: 1.5rem; text-align: center;">
          <span style="font-size: 0.9rem; color: #666;">${language === 'ar' ? 'إجمالي مصروفات الفترة المحددة' : 'Total Expenses for Period'}</span>
          <h2 style="margin: 0.3rem 0 0 0; color: #b91c1c; font-family: 'Cairo', sans-serif;">-${filteredTotalExpenses.toLocaleString()} EGP</h2>
        </div>
        
        <table class="print-table">
          <thead>
            <tr>
              <th>${language === 'ar' ? 'اسم المصروف (التكلفة)' : 'Expense'}</th>
              <th>${language === 'ar' ? 'التصنيف' : 'Category'}</th>
              <th>${language === 'ar' ? 'طريقة الدفع' : 'Payment'}</th>
              <th>${language === 'ar' ? 'التاريخ' : 'Date'}</th>
              <th>${language === 'ar' ? 'القيمة' : 'Amount'}</th>
            </tr>
          </thead>
          <tbody>
            ${filteredExpenses.map(e => {
              const p = e.payment_method === 'cash' ? '💵 كاش' : e.payment_method === 'visa' ? '💳 فيزا' : e.payment_method === 'wallet' ? '📱 محفظة' : '⚡ إنستا باي';
              return `
                <tr>
                  <td><strong>${e.name}</strong></td>
                  <td><span style="background: #eee; padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.75rem;">${e.type}</span></td>
                  <td><strong>${p}</strong></td>
                  <td class="font-en">${new Date(e.expense_date).toLocaleDateString('ar-EG')}</td>
                  <td class="danger font-en" style="font-weight: bold;">-${e.amount.toLocaleString()} EGP</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
    } else if (module === 'customers') {
      reportTitle = language === 'ar' ? 'تقرير نشاط وإحصائيات العملاء' : 'Customer Activity CRM Report';
      contentHtml = `
        <div class="print-header">
          <h1>${settings.restaurant_name_ar || 'مريديان'}</h1>
          <h2>${reportTitle}</h2>
          <p class="date">${new Date().toLocaleString('ar-EG')}</p>
        </div>
        
        <table class="print-table">
          <thead>
            <tr>
              <th>${language === 'ar' ? 'العميل' : 'Customer'}</th>
              <th>${language === 'ar' ? 'رقم الهاتف' : 'Phone'}</th>
              <th>${language === 'ar' ? 'عدد الطلبات' : 'Orders'}</th>
              <th>${language === 'ar' ? 'إجمالي الإنفاق' : 'Total Spent'}</th>
              <th>${language === 'ar' ? 'تاريخ آخر طلب' : 'Last Order'}</th>
            </tr>
          </thead>
          <tbody>
            ${customersList.map(c => `
              <tr>
                <td><strong>${c.name}</strong></td>
                <td class="font-en">${c.phone}</td>
                <td class="font-en">${c.orderCount}</td>
                <td class="font-en success" style="font-weight: bold;">${c.totalSpent.toLocaleString()} EGP</td>
                <td class="font-en" style="font-size: 0.8rem; color: #555;">${new Date(c.lastOrderDate).toLocaleString('ar-EG')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>${reportTitle}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;800&display=swap" rel="stylesheet">
        <style>
          @page {
            size: A4;
            margin: 1.5cm;
          }
          body {
            font-family: 'Cairo', sans-serif;
            color: #333;
            background: #fff;
            margin: 0;
            padding: 0;
            line-height: 1.6;
            direction: rtl;
          }
          .print-header {
            text-align: center;
            border-bottom: 2px solid #d4af37;
            padding-bottom: 1rem;
            margin-bottom: 2rem;
          }
          .print-header h1 {
            margin: 0;
            color: #111;
            font-size: 2.2rem;
            font-weight: 800;
          }
          .print-header h2 {
            margin: 0.5rem 0 0 0;
            color: #d4af37;
            font-size: 1.3rem;
            font-weight: 700;
          }
          .print-header .date {
            margin: 0.3rem 0 0 0;
            font-size: 0.85rem;
            color: #666;
            font-family: 'Cairo', sans-serif;
          }
          .section-title {
            font-size: 1.1rem;
            font-weight: 700;
            color: #111;
            border-bottom: 1px solid #eee;
            padding-bottom: 0.4rem;
            margin: 1.5rem 0 0.8rem 0;
          }
          .print-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 1.5rem;
            page-break-inside: auto;
          }
          .print-table tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          .print-table th {
            background: #f7f7f8;
            color: #111;
            font-weight: bold;
            text-align: right;
            padding: 0.8rem;
            border-bottom: 2px solid #eee;
            font-size: 0.9rem;
          }
          .print-table td {
            padding: 0.8rem;
            border-bottom: 1px solid #eee;
            font-size: 0.85rem;
            vertical-align: top;
          }
          .font-en {
            direction: ltr;
            text-align: left;
            unicode-bidi: embed;
          }
          .success {
            color: #047857 !important;
          }
          .danger {
            color: #b91c1c !important;
          }
          @media print {
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .print-table th {
              background-color: #f7f7f8 !important;
            }
          }
        </style>
      </head>
      <body>
        ${contentHtml}
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

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
    if (order.status.startsWith('completed')) {
      customerMap[key].totalSpent += order.total_price;
    }
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
    if (order.status.startsWith('completed')) {
      uniqueCustomersMap[phone].totalSpent += order.total_price;
    }
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

  // Autocomplete suggestions based on manual inputs
  const matchingCustomers = (manualCustName.trim() || manualCustPhone.trim())
    ? customersList.filter(c => 
        (manualCustName && c.name.toLowerCase().includes(manualCustName.toLowerCase())) ||
        (manualCustPhone && c.phone.includes(manualCustPhone))
      )
    : [];

  // Time-based Revenue Chart Data (e.g. daily sales log)
  const dailySalesMap: Record<string, number> = {};
  analyticsFilteredOrders.forEach(order => {
    if (order.status.startsWith('completed')) {
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
                <label>{language === 'ar' ? 'اسم المستخدم' : 'Username'}</label>
                <input 
                  type="text" 
                  className="input-gold" 
                  placeholder={language === 'ar' ? 'اسم الدخول...' : 'Enter username...'}
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  style={{ textAlign: 'center', fontSize: '1.2rem' }}
                  required
                  autoFocus
                />
              </div>
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
                />
                {passcodeError && (
                  <span style={{ color: 'var(--danger)', fontSize: '0.85rem', marginTop: '0.25rem', textAlign: 'center', display: 'block' }}>
                    {passcodeError}
                  </span>
                )}
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '0.5rem' }}>
                  {language === 'ar' ? 'لأول مرة: استخدم admin كاسم مستخدم و 123456 كرمز دخول' : 'First time: Use admin / 123456'}
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
        <div className="admin-logo" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Gear size={22} className="lucide-pulse" style={{ color: 'var(--gold-primary)' }} />
            <span className="text-gradient-gold" style={{ fontSize: '1.25rem' }}>{t.sidebarTitle}</span>
          </div>
          <button
            className="btn-outline-gold"
            onClick={toggleTheme}
            style={{ 
              width: '30px', 
              height: '30px', 
              padding: 0, 
              borderRadius: '50%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              cursor: 'pointer',
              border: '1px solid var(--border-color)'
            }}
            title={theme === 'light' ? (language === 'ar' ? 'الوضع الداكن' : 'Dark Mode') : (language === 'ar' ? 'الوضع المضيء' : 'Light Mode')}
          >
            {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
          </button>
        </div>

          <div style={{ marginTop: '1.5rem', marginBottom: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-gray)' }}>{language === 'ar' ? 'مرحباً بك،' : 'Welcome,'}</div>
            <div style={{ fontSize: '1.1rem', color: 'var(--gold-primary)', fontWeight: 'bold', marginTop: '0.25rem' }}>{loggedInUser?.name}</div>
          </div>

        <nav className="admin-nav">
          {hasPermission('pos') && (
            <button 
              onClick={() => {
                window.history.pushState({}, '', '/pos');
                window.dispatchEvent(new Event('popstate'));
              }}
              style={{
                marginBottom: '1rem',
                background: 'linear-gradient(45deg, var(--gold-dark), var(--gold-primary))',
                color: '#000',
                border: 'none',
                padding: '12px 16px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontWeight: 'bold',
                cursor: 'pointer',
                width: '100%'
              }}
            >
              <MonitorSmartphone size={18} />
              {language === 'ar' ? 'نظام الـ POS' : 'POS System'}
            </button>
          )}


          {hasPermission('analytics') && (
            <button 
              className={`admin-nav-item ${activeTab === 'analytics' ? 'active' : ''}`}
              onClick={() => setActiveTab('analytics')}
            >
              <LayoutDashboard size={18} />
              <span>{t.overviewTab}</span>
            </button>
          )}
          
          {hasPermission('categories') && (
            <button 
              className={`admin-nav-item ${activeTab === 'categories' ? 'active' : ''}`}
              onClick={() => setActiveTab('categories')}
            >
              <FolderOpen size={18} />
              <span>{t.categoriesTab}</span>
            </button>
          )}

          {hasPermission('products') && (
            <button 
              className={`admin-nav-item ${activeTab === 'products' ? 'active' : ''}`}
              onClick={() => setActiveTab('products')}
            >
              <Coffee size={18} />
              <span>{t.productsTab}</span>
            </button>
          )}

          {hasPermission('orders') && (
            <button 
              className={`admin-nav-item ${activeTab === 'orders' ? 'active' : ''}`}
              onClick={() => setActiveTab('orders')}
            >
              <Calendar size={18} />
              <span>{t.ordersTab}</span>
            </button>
          )}

          {hasPermission('customers') && (
            <button 
              className={`admin-nav-item ${activeTab === 'customers' ? 'active' : ''}`}
              onClick={() => setActiveTab('customers')}
            >
              <Users size={18} />
              <span>{t.customersTab}</span>
            </button>
          )}

          {hasPermission('customers') && (
            <button 
              className={`admin-nav-item ${activeTab === 'debts' ? 'active' : ''}`}
              onClick={() => setActiveTab('debts')}
            >
              <span style={{ fontSize: '1.1rem', display: 'inline-flex', alignItems: 'center', lineHeight: 1 }}>💳</span>
              <span>{language === 'ar' ? 'الحسابات الآجلة' : 'Debts'}</span>
            </button>
          )}

          {hasPermission('orders') && (
            <button 
              className={`admin-nav-item ${activeTab === 'invoices' ? 'active' : ''}`}
              onClick={() => setActiveTab('invoices')}
            >
              <span style={{ fontSize: '1.1rem', display: 'inline-flex', alignItems: 'center', lineHeight: 1 }}>🧾</span>
              <span>{language === 'ar' ? 'الفواتير والأرباح' : 'Invoices & Profit'}</span>
            </button>
          )}

          {hasPermission('expenses') && (
            <button 
              className={`admin-nav-item ${activeTab === 'expenses' ? 'active' : ''}`}
              onClick={() => setActiveTab('expenses')}
            >
              <span style={{ fontSize: '1.1rem', display: 'inline-flex', alignItems: 'center', lineHeight: 1 }}>💰</span>
              <span>{language === 'ar' ? 'التكاليف والمصروفات' : 'Costs & Expenses'}</span>
            </button>
          )}

          {hasPermission('recipes') && (
            <button 
              className={`admin-nav-item ${activeTab === 'recipes' ? 'active' : ''}`}
              onClick={() => setActiveTab('recipes')}
            >
              <span style={{ fontSize: '1.1rem', display: 'inline-flex', alignItems: 'center', lineHeight: 1 }}>👨‍🍳</span>
              <span>{language === 'ar' ? 'وصفات الشيف' : 'Chef Recipes'}</span>
            </button>
          )}

          {hasPermission('system_users') && (
            <button 
              className={`admin-nav-item ${activeTab === 'system_users' ? 'active' : ''}`}
              onClick={() => setActiveTab('system_users')}
            >
              <Users size={18} />
              <span>{language === 'ar' ? 'مستخدمين النظام' : 'System Users'}</span>
            </button>
          )}

          {hasPermission('system_users') && (
            <button 
              className={`admin-nav-item ${activeTab === 'waiters' ? 'active' : ''}`}
              onClick={() => setActiveTab('waiters')}
            >
              <Coffee size={18} />
              <span>{language === 'ar' ? 'إدارة الويترز' : 'Waiters Management'}</span>
            </button>
          )}

          {hasPermission('settings') && (
            <button 
              className={`admin-nav-item ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              <Gear size={18} />
              <span>{t.settingsTab}</span>
            </button>
          )}

          {(loggedInUser?.role === 'admin' || loggedInUser?.role === 'inventory_manager' || loggedInUser?.role === 'manager') && (
            <button 
              className={`admin-nav-item ${activeTab === 'inventory' ? 'active' : ''}`}
              onClick={() => setActiveTab('inventory')}
            >
              <Package size={18} />
              <span>{language === 'ar' ? 'إدارة المخازن' : 'Inventory'}</span>
            </button>
          )}

          {(loggedInUser?.role === 'admin' || loggedInUser?.role === 'kitchen_manager') && (
            <button 
              className={`admin-nav-item ${activeTab === 'factory' ? 'active' : ''}`}
              onClick={() => setActiveTab('factory')}
            >
              <Coffee size={18} />
              <span>{language === 'ar' ? 'المصنع والمطبخ' : 'Factory & Kitchen'}</span>
            </button>
          )}
        </nav>

        <button className="btn-outline-gold" onClick={() => {
          localStorage.removeItem('meridien_admin_auth');
          localStorage.removeItem('meridien_logged_in_user');
          setIsAuthenticated(false);
          setLoggedInUser(null);
          onClose();
        }} style={{ marginTop: 'auto', width: '100%' }}>
          <LogOut size={16} />
          {t.exitBtn}
        </button>
      </aside>

      {/* 2. Main content area */}
      <main className="admin-main">
        <div className="admin-top-header" style={{ display: 'flex', justifyContent: 'flex-end', padding: '1rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem', position: 'relative' }}>
          <div className="notifications-wrapper" style={{ position: 'relative', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            {/* Language Toggle Button */}
            <button 
              className="btn-icon" 
              onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
              title={language === 'ar' ? 'Switch to English' : 'التبديل للعربية'}
              style={{ background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.4rem 0.8rem', cursor: 'pointer', color: 'var(--text-color)', fontSize: '0.9rem', fontWeight: 'bold' }}
            >
              {language === 'ar' ? 'EN' : 'عربي'}
            </button>
            
            <button 
              className="btn-icon" 
              onClick={() => setShowNotifications(!showNotifications)}
              style={{ position: 'relative', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-color)' }}
            >
              <Bell size={24} />
              {notifications.filter(n => !n.is_read).length > 0 && (
                <span style={{ position: 'absolute', top: '-5px', right: '-5px', background: 'red', color: 'white', borderRadius: '50%', width: '18px', height: '18px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {notifications.filter(n => !n.is_read).length}
                </span>
              )}
            </button>
            {showNotifications && (
              <div className="notifications-dropdown" style={{
                position: 'absolute',
                top: '100%',
                right: language === 'en' ? 0 : 'auto',
                left: language === 'ar' ? 0 : 'auto',
                width: '300px',
                background: 'var(--surface-color)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                zIndex: 1000,
                maxHeight: '400px',
                overflowY: 'auto'
              }}>
                <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{language === 'ar' ? 'الإشعارات' : 'Notifications'}</h3>
                </div>
                <div style={{ padding: '0.5rem' }}>
                  {notifications.length === 0 ? (
                    <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '1rem' }}>
                      {language === 'ar' ? 'لا توجد إشعارات' : 'No notifications'}
                    </p>
                  ) : (
                    notifications.map(notif => (
                      <div key={notif.id} style={{ 
                        padding: '0.8rem', 
                        borderBottom: '1px solid var(--border-color)', 
                        background: notif.is_read ? 'transparent' : 'rgba(212, 175, 55, 0.1)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.3rem',
                        cursor: notif.is_read ? 'default' : 'pointer'
                      }} onClick={() => !notif.is_read && markNotificationAsRead(notif.id)}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ fontSize: '0.9rem' }}>{notif.title}</strong>
                          {!notif.is_read && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--gold-primary)' }}></span>}
                        </div>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{notif.message}</p>
                        <small style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{new Date(notif.created_at).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}</small>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* TAB 1: OVERVIEW & ANALYTICS */}
        {activeTab === 'analytics' && (
          <div>
            <h1 className="text-gradient-gold" style={{ fontSize: '1.8rem', marginBottom: '1.5rem' }}>{t.overviewTab}</h1>

            {/* Filter Section for Analytics */}
            <div className="filter-bar" style={{ marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <div className="filter-group">
                <button className={`btn-filter ${analyticsFilterType === 'all' ? 'active' : ''}`} onClick={() => setAnalyticsFilterType('all')}>
                  {language === 'ar' ? 'كل الأوقات' : 'All Time'}
                </button>
                <button className={`btn-filter ${analyticsFilterType === 'day' ? 'active' : ''}`} onClick={() => setAnalyticsFilterType('day')}>
                  {language === 'ar' ? 'باليوم' : 'By Day'}
                </button>
                <button className={`btn-filter ${analyticsFilterType === 'month' ? 'active' : ''}`} onClick={() => setAnalyticsFilterType('month')}>
                  {language === 'ar' ? 'بالشهر' : 'By Month'}
                </button>
                <button className={`btn-filter ${analyticsFilterType === 'year' ? 'active' : ''}`} onClick={() => setAnalyticsFilterType('year')}>
                  {language === 'ar' ? 'بالسنة' : 'By Year'}
                </button>
                <select className="input-gold" value={analyticsDepartmentFilter} onChange={(e) => setAnalyticsDepartmentFilter(e.target.value as any)} style={{ padding: '0.4rem 0.8rem', borderRadius: '10px', fontSize: '0.85rem', marginLeft: '1rem' }}>
                  <option value="all">{language === 'ar' ? 'جميع الأقسام' : 'All Departments'}</option>
                  <option value="restaurant">{language === 'ar' ? 'المطعم' : 'Restaurant'}</option>
                  <option value="bar">{language === 'ar' ? 'البار' : 'Bar'}</option>
                </select>
              </div>

              {analyticsFilterType === 'day' && (
                <div className="filter-inputs">
                  <input type="date" value={analyticsFilterDay} onChange={(e) => setAnalyticsFilterDay(e.target.value)} />
                </div>
              )}
              {analyticsFilterType === 'month' && (
                <div className="filter-inputs">
                  <input type="month" value={analyticsFilterMonth} onChange={(e) => setAnalyticsFilterMonth(e.target.value)} />
                </div>
              )}
              {analyticsFilterType === 'year' && (
                <div className="filter-inputs">
                  <input type="number" value={analyticsFilterYear} onChange={(e) => setAnalyticsFilterYear(Number(e.target.value))} min="2020" max="2100" />
                </div>
              )}
            </div>

            {/* Financial Income Statement Grid */}
            <div className="table-panel" style={{ marginBottom: '1.5rem', background: 'linear-gradient(135deg, rgba(20,20,22,0.6) 0%, rgba(10,10,12,0.8) 100%)', border: '1px solid var(--gold-secondary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 style={{ fontSize: '1.25rem', color: 'var(--gold-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  💰 {language === 'ar' ? 'ملخص قائمة الدخل والأرباح التشغيلية' : 'Income Statement & Operational Profits'}
                </h2>
                <button 
                  onClick={() => handlePrintReport('analytics')}
                  className="btn-gold" 
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <PrinterIcon size={16} />
                  {language === 'ar' ? 'تصدير التحليلات A4 PDF' : 'Export Analytics PDF'}
                </button>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.2rem', borderRadius: '14px', border: '1px solid var(--border-color)', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: '-10px', right: '-10px', fontSize: '4rem', opacity: 0.05, pointerEvents: 'none' }}>💵</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-gray)', marginBottom: '0.5rem' }}>{language === 'ar' ? 'إجمالي الإيرادات (الطلبات المدفوعة)' : 'Total Revenue (Paid Orders)'}</div>
                  <div className="font-en" style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--success)' }}>
                    +{totalRevenue.toLocaleString()} <span style={{ fontSize: '0.9rem' }}>EGP</span>
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.2rem', borderRadius: '14px', border: '1px solid var(--border-color)', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: '-10px', right: '-10px', fontSize: '4rem', opacity: 0.05, pointerEvents: 'none' }}>💸</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-gray)', marginBottom: '0.5rem' }}>{language === 'ar' ? 'إجمالي التكاليف والمصروفات' : 'Total Operational Costs'}</div>
                  <div className="font-en" style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--danger)' }}>
                    -{totalExpenses.toLocaleString()} <span style={{ fontSize: '0.9rem' }}>EGP</span>
                  </div>
                </div>

                <div style={{ background: 'rgba(212,175,55,0.03)', padding: '1.2rem', borderRadius: '14px', border: '1px solid rgba(212,175,55,0.2)', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: '-10px', right: '-10px', fontSize: '4rem', opacity: 0.05, pointerEvents: 'none' }}>🏆</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--gold-secondary)', marginBottom: '0.5rem', fontWeight: 'bold' }}>{language === 'ar' ? 'صافي الربح / الخسارة التشغيلية' : 'Net Operational Profit'}</div>
                  <div className="font-en" style={{ fontSize: '1.8rem', fontWeight: '800', color: netProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {netProfit >= 0 ? '+' : ''}{netProfit.toLocaleString()} <span style={{ fontSize: '0.9rem' }}>EGP</span>
                  </div>
                </div>
              </div>
            </div>

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
                        <RechartsTooltip contentStyle={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)', color: 'var(--text-white)', borderRadius: '12px' }} />
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
                        <RechartsTooltip contentStyle={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)', color: 'var(--text-white)', borderRadius: '12px' }} />
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

            {/* Payment Methods Financial Breakdown */}
            <div className="table-panel" style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', color: 'var(--gold-secondary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                💳 {language === 'ar' ? 'توزيع الأرصدة والتدفقات المالية حسب طريقة الدفع' : 'Payment Methods Balance & Flow Breakdown'}
              </h2>
              <div className="table-wrapper">
                <table className="luxury-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>{language === 'ar' ? 'طريقة الدفع' : 'Payment Method'}</th>
                      <th>{language === 'ar' ? 'إجمالي المقبوضات (الإيرادات)' : 'Total Received (Revenue)'}</th>
                      <th>{language === 'ar' ? 'إجمالي المدفوعات (المصروفات)' : 'Total Paid Out (Expenses)'}</th>
                      <th>{language === 'ar' ? 'الرصيد الصافي المتبقي' : 'Net Balance'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(Object.keys(paymentMethodsStats) as Array<keyof typeof paymentMethodsStats>).map((method) => {
                      const stats = paymentMethodsStats[method];
                      const methodNameAr = method === 'cash' ? '💵 كاش (نقدي)' : method === 'visa' ? '💳 فيزا (بطاقة)' : method === 'wallet' ? '📱 محفظة إلكترونية' : '⚡ إنستا باي';
                      const methodNameEn = method === 'cash' ? 'Cash' : method === 'visa' ? 'Visa / Card' : method === 'wallet' ? 'Mobile Wallet' : 'InstaPay';
                      return (
                        <tr key={method}>
                          <td style={{ fontWeight: 'bold', color: 'var(--text-white)' }}>
                            {language === 'ar' ? methodNameAr : methodNameEn}
                          </td>
                          <td className="font-en" style={{ color: 'var(--success)' }}>+{stats.revenue.toLocaleString()} EGP</td>
                          <td className="font-en" style={{ color: 'var(--danger)' }}>-{stats.expenses.toLocaleString()} EGP</td>
                          <td className="font-en" style={{ 
                            fontWeight: '800', 
                            color: stats.net >= 0 ? 'var(--success)' : 'var(--danger)' 
                          }}>
                            {stats.net >= 0 ? '+' : ''}{stats.net.toLocaleString()} EGP
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Least Sold Products Table */}
            <div className="table-panel" style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', color: 'var(--danger)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                ⚠️ {language === 'ar' ? 'المنتجات الخمسة الأقل طلباً (الأضعف مبيعاً)' : 'Bottom 5 Least Sold Products'}
              </h2>
              <div className="table-wrapper">
                <table className="luxury-table">
                  <thead>
                    <tr>
                      <th>{language === 'ar' ? 'المنتج' : 'Product'}</th>
                      <th>{language === 'ar' ? 'الكمية المباعة' : 'Units Sold'}</th>
                      <th>{language === 'ar' ? 'إجمالي قيمة المبيعات' : 'Total Revenue Generated'}</th>
                      <th>{language === 'ar' ? 'حالة المنتج' : 'Status'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leastSoldProductsReport.map((prod, idx) => {
                      const productInfo = products.find(p => p.id === prod.id);
                      const isAvailable = productInfo ? productInfo.is_available : false;
                      return (
                        <tr key={idx}>
                          <td style={{ fontWeight: '700', color: 'var(--text-white)' }}>
                            {language === 'ar' ? prod.name_ar : prod.name_en}
                          </td>
                          <td className="font-en" style={{ fontWeight: 'bold', color: prod.quantity === 0 ? 'var(--text-muted)' : 'var(--gold-secondary)' }}>
                            {prod.quantity}
                          </td>
                          <td className="font-en" style={{ color: 'var(--gold-primary)' }}>{prod.revenue.toLocaleString()} EGP</td>
                          <td>
                            <span style={{ 
                              fontSize: '0.75rem', 
                              padding: '0.15rem 0.5rem', 
                              borderRadius: '6px', 
                              background: isAvailable ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                              color: isAvailable ? 'var(--success)' : 'var(--danger)',
                              fontWeight: 'bold'
                            }}>
                              {isAvailable ? (language === 'ar' ? 'نشط' : 'Active') : (language === 'ar' ? 'غير متوفر' : 'Unavailable')}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Combined Financial Log (Transactions & Expenses) */}
            <div className="table-panel">
              <h2 style={{ fontSize: '1.25rem', color: 'var(--gold-secondary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                📖 {language === 'ar' ? 'دفتر المعاملات والتحصيلات والمصاريف (اللوج المالي)' : 'Financial Log (Collections & Expenses)'}
              </h2>
              <div className="table-wrapper">
                <table className="luxury-table">
                  <thead>
                    <tr>
                      <th>{language === 'ar' ? 'التاريخ' : 'Date'}</th>
                      <th>{language === 'ar' ? 'البيان' : 'Description'}</th>
                      <th>{language === 'ar' ? 'النوع' : 'Type'}</th>
                      <th>{language === 'ar' ? 'القيمة' : 'Amount'}</th>
                      <th>{language === 'ar' ? 'طريقة الدفع' : 'Payment Method'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {combinedFinancialLog.map((log, idx) => (
                      <tr key={idx}>
                        <td className="font-en" style={{ fontSize: '0.85rem' }}>
                          {log.date.toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}
                        </td>
                        <td style={{ fontWeight: 'bold' }}>{log.title}</td>
                        <td>
                          {log.type === 'income' ? (
                            <span style={{ color: 'var(--success)', background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.85rem' }}>
                              {language === 'ar' ? 'تحصيل إيراد ⬆️' : 'Income ⬆️'}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.1)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.85rem' }}>
                              {language === 'ar' ? 'مصروفات ⬇️' : 'Expense ⬇️'}
                            </span>
                          )}
                        </td>
                        <td className="font-en" style={{ color: log.type === 'income' ? 'var(--success)' : 'var(--danger)', fontWeight: 'bold' }}>
                          {log.type === 'income' ? '+' : '-'}{log.amount.toLocaleString()} EGP
                        </td>
                        <td>
                          <span style={{ textTransform: 'uppercase', fontSize: '0.8rem', color: 'var(--text-gray)' }}>
                            {log.method}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {combinedFinancialLog.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                          {language === 'ar' ? 'لا يوجد معاملات مسجلة في هذا النطاق الزمني' : 'No transactions recorded in this period'}
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
              <div className="table-panel-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
                <h1 className="text-gradient-gold" style={{ fontSize: '1.5rem', margin: 0 }}>{t.productsTab}</h1>
                
                <div style={{ display: 'flex', gap: '1rem', flex: 1, minWidth: '300px' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={16} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', right: language === 'ar' ? '10px' : 'auto', left: language === 'en' ? '10px' : 'auto', color: 'var(--text-muted)' }} />
                    <input 
                      type="text" 
                      placeholder={language === 'ar' ? 'بحث باسم المنتج...' : 'Search product name...'}
                      value={adminProdSearch}
                      onChange={(e) => setAdminProdSearch(e.target.value)}
                      className="input-gold"
                      style={{ width: '100%', paddingRight: language === 'ar' ? '30px' : '10px', paddingLeft: language === 'en' ? '30px' : '10px', paddingTop: '0.4rem', paddingBottom: '0.4rem', borderRadius: '10px', fontSize: '0.9rem' }}
                    />
                  </div>
                  <select 
                    value={adminProdCatFilter}
                    onChange={(e) => setAdminProdCatFilter(e.target.value)}
                    className="input-gold"
                    style={{ padding: '0.4rem', borderRadius: '10px', minWidth: '150px', fontSize: '0.9rem' }}
                  >
                    <option value="all">{language === 'ar' ? 'كل التصنيفات' : 'All Categories'}</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{language === 'ar' ? c.name_ar : c.name_en}</option>
                    ))}
                  </select>
                </div>

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
                    {products.filter(p => {
                      const matchCat = adminProdCatFilter === 'all' || p.category_id === adminProdCatFilter;
                      const searchLower = adminProdSearch.toLowerCase();
                      const matchSearch = adminProdSearch.trim() === '' || 
                        p.name_ar.toLowerCase().includes(searchLower) ||
                        p.name_en.toLowerCase().includes(searchLower);
                      return matchCat && matchSearch;
                    }).map((prod) => {
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <select className="input-gold" value={ordersDepartmentFilter} onChange={(e) => setOrdersDepartmentFilter(e.target.value as any)} style={{ padding: '0.4rem 0.8rem', borderRadius: '10px', fontSize: '0.85rem' }}>
                        <option value="all">{language === 'ar' ? 'جميع الأقسام' : 'All Departments'}</option>
                        <option value="restaurant">{language === 'ar' ? 'المطعم' : 'Restaurant'}</option>
                        <option value="bar">{language === 'ar' ? 'البار' : 'Bar'}</option>
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
                        <th>{language === 'ar' ? 'نوع الطلب والويتر' : 'Order Type & Waiter'}</th>
                        <th>{t.orderTable}</th>
                        <th>{t.orderItems}</th>
                        <th>{t.orderTotal}</th>
                        <th>{language === 'ar' ? 'طريقة الدفع' : 'Payment'}</th>
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
                        <td className="font-en">
                          {order.order_type ? (
                            <span style={{ background: 'rgba(212,175,55,0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem', color: 'var(--gold-primary)', fontWeight: 'bold' }}>
                              {order.order_type.toUpperCase()}
                            </span>
                          ) : '-'}
                          {order.waiter_name && (
                            <div style={{ marginTop: '4px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              🧑‍🍳 {order.waiter_name}
                            </div>
                          )}
                        </td>
                        <td className="font-en" style={{ fontWeight: 'bold' }}>{order.table_number || '-'}</td>
                        <td style={{ fontSize: '0.85rem', maxWidth: '220px', whiteSpace: 'normal', lineHeight: '1.4' }}>
                          {order.items.map((item, idx) => (
                            <div key={idx} style={{ color: 'var(--text-gray)' }}>
                              • {item.quantity}x {language === 'ar' ? item.name_ar : item.name_en}
                            </div>
                          ))}
                        </td>
                        <td className="font-en" style={{ color: 'var(--gold-primary)', fontWeight: '800' }}>{order.total_price.toFixed(2)} EGP</td>
                        <td className="font-en" style={{ textAlign: 'center' }}>
                          {order.payment_method ? (
                            <span style={{ 
                              background: order.payment_method === 'split' ? 'rgba(139,92,246,0.1)' : 'rgba(16,185,129,0.1)',
                              color: order.payment_method === 'split' ? '#8b5cf6' : '#10b981',
                              padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold'
                            }}>
                              {order.payment_method.toUpperCase()}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="font-en" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {new Date(order.created_at).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}
                        </td>
                        <td>
                          <select 
                            value={order.status.startsWith('completed') ? 'completed' : order.status}
                            onChange={(e) => {
                              const newStatus = e.target.value;
                              if (newStatus === 'completed') {
                                // Block immediate change to completed; open payment collection modal instead
                                setPaymentCollectOrder(order);
                              } else {
                                handleUpdateOrderStatus(order.id, newStatus as Order['status']);
                              }
                            }}
                            className="input-gold"
                            style={{ 
                              padding: '0.25rem 0.5rem', 
                              borderRadius: '8px', 
                              fontSize: '0.8rem',
                              background: order.status.startsWith('completed') ? 'rgba(16,185,129,0.1)' : order.status === 'cancelled' ? 'rgba(239,68,68,0.1)' : order.status === 'delivered' ? 'rgba(59,130,246,0.1)' : 'rgba(245,158,11,0.1)',
                              color: order.status.startsWith('completed') ? 'var(--success)' : order.status === 'cancelled' ? 'var(--danger)' : order.status === 'delivered' ? '#3b82f6' : 'var(--warning)',
                              borderColor: 'var(--border-color)',
                              cursor: 'pointer',
                              width: '100%'
                            }}
                          >
                            <option value="pending" style={{ background: '#121212', color: 'var(--warning)' }}>🍳 قيد التحضير</option>
                            <option value="preparing" style={{ background: '#121212', color: 'var(--warning)' }}>🍳 قيد التحضير</option>
                            <option value="delivered" style={{ background: '#121212', color: '#3b82f6' }}>🛵 تم التسليم للعميل</option>
                            <option value="completed" style={{ background: '#121212', color: 'var(--success)' }}>💳 تم التحصيل / مكتمل</option>
                            <option value="cancelled" style={{ background: '#121212', color: 'var(--danger)' }}>❌ ملغي</option>
                          </select>

                          <button 
                            type="button" 
                            className="btn-outline-gold" 
                            style={{ 
                              padding: '0.25rem 0.5rem', 
                              borderRadius: '8px', 
                              fontSize: '0.75rem', 
                              marginTop: '0.3rem', 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '0.3rem',
                              width: '100%',
                              justifyContent: 'center',
                              borderColor: '#3b82f6',
                              color: '#3b82f6'
                            }}
                            onClick={() => printOrderTickets(order, categories, products, printers, language)}
                          >
                            <PrinterIcon size={12} />
                            <span>{language === 'ar' ? 'طباعة البونات' : 'Print Tickets'}</span>
                          </button>

                          {/* Collect Payment Button */}
                          {!order.status.startsWith('completed') && order.status !== 'cancelled' && (
                            <button 
                              type="button" 
                              className="btn-gold" 
                              style={{ 
                                padding: '0.25rem 0.5rem', 
                                borderRadius: '8px', 
                                fontSize: '0.75rem', 
                                marginTop: '0.3rem', 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '0.2rem',
                                justifyContent: 'center',
                                width: '100%',
                                boxShadow: '0 0 8px rgba(212,175,55,0.2)',
                                cursor: 'pointer'
                              }}
                              onClick={() => setPaymentCollectOrder(order)}
                            >
                              💰 {language === 'ar' ? 'تحصيل الحساب' : 'Collect Payment'}
                            </button>
                          )}
                          
                          {/* Payment method tag display */}
                          {order.status.startsWith('completed') && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--gold-secondary)', marginTop: '0.3rem', textAlign: 'center', fontWeight: 'bold' }}>
                              {(() => {
                                const method = order.status.split('_')[1] || '';
                                if (method === 'cash') return language === 'ar' ? '💵 كاش' : '💵 Cash';
                                if (method === 'visa') return language === 'ar' ? '💳 فيزا / بطاقة' : '💳 Visa / Card';
                                if (method === 'instapay') return language === 'ar' ? '📱 انستا باي' : '📱 InstaPay';
                                if (method === 'wallet') return language === 'ar' ? '💼 محفظة إلكترونية' : '💼 E-Wallet';
                                return language === 'ar' ? '✅ تم الدفع' : '✅ Paid';
                              })()}
                            </div>
                          )}
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

        {/* TAB: DEBTS / الحسابات الآجلة */}
        {activeTab === 'debts' && (
          <div>
            <div className="table-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <h1 className="text-gradient-gold" style={{ fontSize: '1.5rem', margin: 0 }}>💳 {language === 'ar' ? 'الحسابات الآجلة (المديونيات)' : 'Deferred Accounts (Debts)'}</h1>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-gray)', marginTop: '0.2rem' }}>
                    {language === 'ar' ? 'عرض وإدارة المديونيات على العملاء - يمكنك تسديد جزء أو كل المبلغ' : 'View and manage customer debts - you can settle partial or full amounts'}
                  </p>
                </div>
              </div>

              {/* Debt Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '1rem', borderRadius: '14px', border: '1px solid rgba(239,68,68,0.2)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-gray)' }}>{language === 'ar' ? 'إجمالي المديونيات' : 'Total Debts'}</div>
                  <div className="font-en" style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--danger)' }}>
                    {debtCustomers.reduce((s, c) => s + (c.total_debt || 0), 0).toLocaleString()} <span style={{ fontSize: '0.9rem' }}>EGP</span>
                  </div>
                </div>
                <div style={{ background: 'rgba(212,175,55,0.05)', padding: '1rem', borderRadius: '14px', border: '1px solid rgba(212,175,55,0.2)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-gray)' }}>{language === 'ar' ? 'عدد العملاء المدينين' : 'Customers with Debt'}</div>
                  <div className="font-en" style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--gold-primary)' }}>
                    {debtCustomers.filter(c => (c.total_debt || 0) > 0).length}
                  </div>
                </div>
              </div>

              <div className="table-wrapper">
                <table className="luxury-table">
                  <thead>
                    <tr>
                      <th>{language === 'ar' ? 'العميل' : 'Customer'}</th>
                      <th>{language === 'ar' ? 'رقم الهاتف' : 'Phone'}</th>
                      <th>{language === 'ar' ? 'المديونية الحالية' : 'Current Debt'}</th>
                      <th>{language === 'ar' ? 'تسديد مبلغ' : 'Settle Amount'}</th>
                      <th>{language === 'ar' ? 'إجراء' : 'Action'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {debtCustomers.map(cust => (
                      <tr key={cust.id}>
                        <td style={{ fontWeight: '700' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: (cust.total_debt || 0) > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', border: `1px solid ${(cust.total_debt || 0) > 0 ? 'var(--danger)' : 'var(--success)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: (cust.total_debt || 0) > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 'bold', fontSize: '0.9rem' }}>
                              {cust.name.trim().charAt(0).toUpperCase()}
                            </div>
                            <span>{cust.name}</span>
                          </div>
                        </td>
                        <td className="font-en">
                          <a href={`https://wa.me/${cust.phone.startsWith('+') ? cust.phone : '+2' + cust.phone}`} target="_blank" rel="noopener noreferrer" style={{ color: '#25D366', textDecoration: 'none', fontWeight: 'bold' }}>
                            {cust.phone} 💬
                          </a>
                        </td>
                        <td className="font-en" style={{ fontWeight: '800', color: (cust.total_debt || 0) > 0 ? 'var(--danger)' : 'var(--success)', fontSize: '1.1rem' }}>
                          {(cust.total_debt || 0).toLocaleString()} EGP
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            max={cust.total_debt || 0}
                            className="input-gold"
                            placeholder={language === 'ar' ? 'مبلغ التسديد' : 'Amount'}
                            value={debtSettleAmount[cust.id] || ''}
                            onChange={(e) => setDebtSettleAmount(prev => ({ ...prev, [cust.id]: Number(e.target.value) }))}
                            style={{ width: '120px', padding: '0.4rem 0.6rem', fontSize: '0.9rem' }}
                          />
                        </td>
                        <td>
                          <button
                            className="btn-gold"
                            disabled={(debtSettleAmount[cust.id] || 0) <= 0 || (debtSettleAmount[cust.id] || 0) > (cust.total_debt || 0)}
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', borderRadius: '10px' }}
                            onClick={async () => {
                              const amount = debtSettleAmount[cust.id] || 0;
                              if (amount <= 0 || amount > (cust.total_debt || 0)) return;
                              const newDebt = (cust.total_debt || 0) - amount;
                              await db.updateCustomerDebt(cust.id, newDebt);
                              await fetchDebtCustomers();
                              setDebtSettleAmount(prev => ({ ...prev, [cust.id]: 0 }));
                              alert(language === 'ar' ? `تم تسديد ${amount} جنيه بنجاح! المديونية المتبقية: ${newDebt} جنيه` : `Settled ${amount} EGP! Remaining: ${newDebt} EGP`);
                            }}
                          >
                            <CheckCircle size={14} />
                            <span style={{ marginInlineStart: '4px' }}>{language === 'ar' ? 'تسديد' : 'Settle'}</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                    {debtCustomers.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-gray)', padding: '3rem 1rem' }}>
                          {language === 'ar' ? 'لا يوجد عملاء مسجلين بمديونيات' : 'No customers with debts found'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB: INVOICES & PROFIT / الفواتير والأرباح */}
        {activeTab === 'invoices' && (
          <div>
            <div className="table-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <h1 className="text-gradient-gold" style={{ fontSize: '1.5rem', margin: 0 }}>🧾 {language === 'ar' ? 'الفواتير والأرباح' : 'Invoices & Profit'}</h1>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-gray)', marginTop: '0.2rem' }}>
                    {language === 'ar' ? 'عرض جميع الفواتير المكتملة مع حساب تكلفة المواد والربح الصافي' : 'View all completed invoices with COGS and net profit calculation'}
                  </p>
                </div>
              </div>

              {/* Invoice Summary Cards */}
              {(() => {
                const completedInvoices = orders.filter(o => o.status === 'completed' || o.status?.startsWith('completed'));
                const totalSales = completedInvoices.reduce((s, o) => s + o.total_price, 0);
                const totalCost = completedInvoices.reduce((s, o) => s + (o.total_cost || 0), 0);
                const totalProfit = totalSales - totalCost;
                return (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                      <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '1rem', borderRadius: '14px', border: '1px solid rgba(16,185,129,0.2)', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-gray)' }}>{language === 'ar' ? 'إجمالي المبيعات' : 'Total Sales'}</div>
                        <div className="font-en" style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--success)' }}>
                          +{totalSales.toLocaleString()} <span style={{ fontSize: '0.8rem' }}>EGP</span>
                        </div>
                      </div>
                      <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '1rem', borderRadius: '14px', border: '1px solid rgba(239,68,68,0.2)', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-gray)' }}>{language === 'ar' ? 'إجمالي التكلفة (الخامات)' : 'Total COGS'}</div>
                        <div className="font-en" style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--danger)' }}>
                          -{totalCost.toLocaleString()} <span style={{ fontSize: '0.8rem' }}>EGP</span>
                        </div>
                      </div>
                      <div style={{ background: 'rgba(212,175,55,0.05)', padding: '1rem', borderRadius: '14px', border: '1px solid rgba(212,175,55,0.2)', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-gray)' }}>{language === 'ar' ? 'صافي الربح' : 'Net Profit'}</div>
                        <div className="font-en" style={{ fontSize: '1.5rem', fontWeight: '800', color: totalProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                          {totalProfit >= 0 ? '+' : ''}{totalProfit.toLocaleString()} <span style={{ fontSize: '0.8rem' }}>EGP</span>
                        </div>
                      </div>
                      <div style={{ background: 'rgba(212,175,55,0.03)', padding: '1rem', borderRadius: '14px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-gray)' }}>{language === 'ar' ? 'عدد الفواتير' : 'Invoice Count'}</div>
                        <div className="font-en" style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--gold-primary)' }}>
                          {completedInvoices.length}
                        </div>
                      </div>
                    </div>

                    <div className="table-wrapper">
                      <table className="luxury-table">
                        <thead>
                          <tr>
                            <th>{language === 'ar' ? 'رقم الفاتورة' : 'Invoice #'}</th>
                            <th>{language === 'ar' ? 'العميل' : 'Customer'}</th>
                            <th>{language === 'ar' ? 'التاريخ' : 'Date'}</th>
                            <th>{language === 'ar' ? 'طريقة الدفع' : 'Payment'}</th>
                            <th>{language === 'ar' ? 'سعر البيع' : 'Sale Price'}</th>
                            <th>{language === 'ar' ? 'التكلفة' : 'Cost'}</th>
                            <th>{language === 'ar' ? 'الربح' : 'Profit'}</th>
                            <th>{language === 'ar' ? 'إجراءات' : 'Actions'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {completedInvoices.map(inv => {
                            const cost = inv.total_cost || 0;
                            const profit = inv.total_price - cost;
                            const payLabel = inv.payment_method === 'cash' ? '💵 كاش' : inv.payment_method === 'visa' ? '💳 فيزا' : inv.payment_method === 'deferred' ? '📋 آجل' : inv.payment_method === 'wallet' ? '📱 محفظة' : '💵 كاش';
                            return (
                              <tr key={inv.id}>
                                <td className="font-en" style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--gold-primary)' }}>#{inv.id.slice(0, 8)}</td>
                                <td style={{ fontWeight: '600' }}>
                                  {inv.customer_name}
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{inv.customer_phone}</div>
                                </td>
                                <td className="font-en" style={{ fontSize: '0.8rem' }}>{new Date(inv.created_at).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}</td>
                                <td style={{ fontSize: '0.85rem' }}>{payLabel}</td>
                                <td className="font-en" style={{ fontWeight: 'bold', color: 'var(--success)' }}>+{inv.total_price.toLocaleString()}</td>
                                <td className="font-en" style={{ fontWeight: 'bold', color: 'var(--danger)' }}>-{cost.toLocaleString()}</td>
                                <td className="font-en" style={{ fontWeight: '800', color: profit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                  {profit >= 0 ? '+' : ''}{profit.toLocaleString()} EGP
                                </td>
                                <td>
                                  <div style={{ display: 'flex', gap: '0.3rem' }}>
                                    <button
                                      className="btn-outline-gold"
                                      style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem', borderRadius: '8px' }}
                                      onClick={() => {
                                        const items = inv.items.map((i: any) => `${language === 'ar' ? i.name_ar : i.name_en} x${i.quantity} = ${(i.price * i.quantity).toFixed(2)}`).join('\n');
                                        alert(`${language === 'ar' ? 'تفاصيل الفاتورة' : 'Invoice Details'} #${inv.id.slice(0,8)}\n\n${items}\n\n${language === 'ar' ? 'الإجمالي' : 'Total'}: ${inv.total_price} EGP\n${language === 'ar' ? 'التكلفة' : 'Cost'}: ${cost} EGP\n${language === 'ar' ? 'الربح' : 'Profit'}: ${profit} EGP`);
                                      }}
                                    >
                                      👁 {language === 'ar' ? 'عرض' : 'View'}
                                    </button>
                                    <button
                                      style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--danger)', padding: '0.3rem 0.5rem', fontSize: '0.75rem', borderRadius: '8px', cursor: 'pointer' }}
                                      onClick={async () => {
                                        if (confirm(language === 'ar' ? 'هل أنت متأكد من حذف هذه الفاتورة؟' : 'Are you sure you want to delete this invoice?')) {
                                          await db.deleteOrder(inv.id);
                                          await refreshData();
                                        }
                                      }}
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                          {completedInvoices.length === 0 && (
                            <tr>
                              <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-gray)', padding: '3rem 1rem' }}>
                                {language === 'ar' ? 'لا توجد فواتير مكتملة حالياً' : 'No completed invoices found'}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* TAB 5: SYSTEM SETTINGS CUSTOMIZER */}
        {activeTab === 'settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div className="table-panel">
              <h2 className="text-gradient-gold" style={{ fontSize: '1.4rem', marginBottom: '1.5rem' }}>⚙️ {t.settingsTab}</h2>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                {/* Logo URL & Upload */}
                <div className="form-group">
                  <label>{t.setLogo}</label>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input 
                      type="text" 
                      className="input-gold" 
                      value={setLogoUrl} 
                      onChange={(e) => setSetLogoUrl(e.target.value)} 
                      placeholder="https://..." 
                      style={{ flex: 1 }}
                    />
                    <label className="btn-gold" style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.25rem', 
                      cursor: 'pointer', 
                      padding: '0.6rem 1rem', 
                      fontSize: '0.85rem',
                      borderRadius: '8px',
                      whiteSpace: 'nowrap',
                      margin: 0,
                      height: '42px',
                      boxSizing: 'border-box',
                      justifyContent: 'center'
                    }}>
                      <Upload size={16} />
                      <span>{language === 'ar' ? 'رفع لوجو' : 'Upload'}</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setSetLogoUrl(reader.result as string);
                            };
                            reader.readAsDataURL(file);
                          }
                        }} 
                        style={{ display: 'none' }} 
                      />
                    </label>
                  </div>
                  {setLogoUrl && (
                    <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <img src={setLogoUrl === '/logo.png' ? '/logo.png?v=3' : setLogoUrl} alt="Logo Preview" style={{ width: '45px', height: '45px', objectFit: 'contain', borderRadius: '8px', border: '1px solid var(--gold-primary)', padding: '2px', background: '#111', mixBlendMode: 'screen' }} />
                      <button 
                        type="button" 
                        className="btn-outline-gold" 
                        onClick={() => setSetLogoUrl('')}
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', height: '26px', display: 'flex', alignItems: 'center', borderRadius: '6px' }}
                      >
                        {language === 'ar' ? 'حذف' : 'Remove'}
                      </button>
                    </div>
                  )}
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

                {/* Location URL */}
                <div className="form-group">
                  <label>{language === 'ar' ? 'رابط اللوكيشن (Google Maps)' : 'Location URL (Google Maps)'}</label>
                  <input type="text" className="input-gold" value={setLocationUrl} onChange={(e) => setSetLocationUrl(e.target.value)} placeholder="https://maps.google.com/..." />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {language === 'ar' ? 'سيُرسل مع فاتورة الواتساب للعميل' : 'Will be sent with WhatsApp invoice to customer'}
                  </span>
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

              {/* Tax & Service Settings */}
              <h3 style={{ color: 'var(--gold-secondary)', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>💰</span>
                <span>{language === 'ar' ? 'إعدادات الضرائب والخدمة (الفواتير)' : 'Tax & Service Charge Settings'}</span>
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                <div className="form-group">
                  <label>{language === 'ar' ? 'نسبة الضريبة (%)' : 'Tax Percentage (%)'}</label>
                  <input 
                    type="number" 
                    className="input-gold" 
                    min="0" 
                    max="100" 
                    step="0.01"
                    placeholder="0"
                    value={taxPercent} 
                    onChange={(e) => {
                      const val = e.target.value;
                      setTaxPercent(val === '' ? 0 : Number(val));
                    }} 
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {language === 'ar' ? 'القيمة الافتراضية 0% (تُحسب على المجموع الفرعي الصافي + الخدمة)' : 'Default is 0% (calculated on net subtotal + service charge)'}
                  </span>
                </div>
                <div className="form-group">
                  <label>{language === 'ar' ? 'نسبة الخدمة (خدمة صالة) (%)' : 'Service Charge Percentage (%)'}</label>
                  <input 
                    type="number" 
                    className="input-gold" 
                    min="0" 
                    max="100" 
                    step="0.01"
                    placeholder="0"
                    value={servicePercent} 
                    onChange={(e) => {
                      const val = e.target.value;
                      setServicePercent(val === '' ? 0 : Number(val));
                    }} 
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {language === 'ar' ? 'القيمة الافتراضية 0% (تُحسب على المجموع الفرعي الصافي)' : 'Default is 0% (calculated on net subtotal)'}
                  </span>
                </div>
              </div>

              {/* Promo code custom additions */}
              <h3 style={{ color: 'var(--gold-secondary)', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                {t.setPromos}
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="form-group">
                  <label>الكود (كود كوبون الخصم)</label>
                  <input type="text" className="input-gold" placeholder={t.addPromoPlaceholder} value={newPromoCode} onChange={(e) => setNewPromoCode(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>نسبة الخصم (%)</label>
                  <input type="number" className="input-gold" min="1" max="100" value={newPromoDiscount} onChange={(e) => setNewPromoDiscount(Number(e.target.value))} />
                </div>
                <div className="form-group">
                  <label>تاريخ انتهاء الصلاحية (اختياري)</label>
                  <input type="date" className="input-gold" value={newPromoExpiryDate} onChange={(e) => setNewPromoExpiryDate(e.target.value)} style={{ padding: '0.4rem 0.6rem' }} />
                </div>
                <div className="form-group">
                  <label>حد الاستخدام لكل مستخدم (اختياري)</label>
                  <input type="number" className="input-gold" min="1" placeholder="مثال: 1 (بلا حد إذا ترك فارغاً)" value={newPromoUsageLimit} onChange={(e) => setNewPromoUsageLimit(e.target.value)} />
                </div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
                <button type="button" className="btn-gold" style={{ height: '42px', borderRadius: '12px', padding: '0 2rem' }} onClick={handleAddPromo}>
                  <Plus size={16} />
                  <span>إضافة الكود</span>
                </button>
              </div>

              {/* Promos tags display */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '2.5rem' }}>
                {Object.entries(promos).map(([code, val]) => {
                  const isObj = typeof val === 'object' && val !== null;
                  const percent = isObj ? (val as any).discount : Number(val);
                  const expiry = isObj ? (val as any).expiryDate : null;
                  const limit = isObj ? (val as any).usageLimit : null;
                  return (
                    <div key={code} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', padding: '0.6rem 1rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '0.4rem', minWidth: '180px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: '700', color: 'var(--gold-primary)', fontSize: '1.1rem' }}>{code}</span>
                        <button type="button" style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer' }} onClick={() => handleRemovePromo(code)}>
                          <X size={16} />
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', fontSize: '0.75rem', marginTop: '0.2rem' }}>
                        <span style={{ background: 'rgba(212, 175, 55, 0.1)', color: 'var(--gold-secondary)', padding: '0.15rem 0.4rem', borderRadius: '6px', fontWeight: '600' }}>
                          {percent}% خصم
                        </span>
                        {expiry && (
                          <span style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: '0.15rem 0.4rem', borderRadius: '6px', fontWeight: '600' }}>
                            📅 {expiry}
                          </span>
                        )}
                        {limit && (
                          <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', padding: '0.15rem 0.4rem', borderRadius: '6px', fontWeight: '600' }}>
                            👤 حد: {limit}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
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
                  <div key={idx} style={{ background: 'var(--bg-card)', border: '1px solid var(--glass-border)', padding: '0.6rem 1rem', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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

        {/* TAB 6: OPERATIONAL COSTS & EXPENSES MANAGEMENT */}
        {activeTab === 'expenses' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div className="table-panel">
              <div className="table-panel-header" style={{ flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
                <div>
                  <h1 className="text-gradient-gold" style={{ fontSize: '1.5rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    💰 {language === 'ar' ? 'التكاليف والمصروفات التشغيلية' : 'Operational Costs & Expenses'}
                  </h1>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-gray)' }}>
                    {language === 'ar' ? 'إدارة وتسجيل كافة النفقات التشغيلية والمصروفات اليومية للمطعم' : 'Manage and record all operational costs and daily expenses for the restaurant'}
                  </p>
                </div>
                
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <button 
                    className="btn-outline-gold" 
                    onClick={() => handlePrintReport('expenses')}
                    style={{ padding: '0.5rem 1rem', borderRadius: '12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    <PrinterIcon size={16} />
                    {language === 'ar' ? 'تصدير التكاليف A4 PDF' : 'Export Expenses PDF'}
                  </button>

                  <button 
                    className="btn-gold" 
                    onClick={() => setExpModalOpen(true)}
                    style={{ padding: '0.5rem 1rem', borderRadius: '12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    <PlusCircle size={16} />
                    {language === 'ar' ? 'تسجيل مصروف جديد' : 'Record New Expense'}
                  </button>
                </div>
              </div>

              {/* Periodic Filters Block */}
              <div style={{ 
                background: 'rgba(255,255,255,0.01)', 
                border: '1px solid var(--border-color)', 
                padding: '1rem', 
                borderRadius: '16px', 
                marginBottom: '1.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-gray)' }}>
                      {language === 'ar' ? 'تصفية حسب:' : 'Filter by:'}
                    </label>
                    <select 
                      value={expFilterType} 
                      onChange={(e) => setExpFilterType(e.target.value as any)} 
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
                  {expFilterType === 'day' && (
                    <input 
                      type="date" 
                      className="input-gold" 
                      value={expFilterDay} 
                      onChange={(e) => setExpFilterDay(e.target.value)} 
                      style={{ padding: '0.4rem 0.8rem', borderRadius: '10px', fontSize: '0.85rem' }} 
                    />
                  )}

                  {expFilterType === 'month' && (
                    <input 
                      type="month" 
                      className="input-gold" 
                      value={expFilterMonth} 
                      onChange={(e) => setExpFilterMonth(e.target.value)} 
                      style={{ padding: '0.4rem 0.8rem', borderRadius: '10px', fontSize: '0.85rem' }} 
                    />
                  )}

                  {expFilterType === 'year' && (
                    <select 
                      className="input-gold" 
                      value={expFilterYear} 
                      onChange={(e) => setExpFilterYear(Number(e.target.value))} 
                      style={{ padding: '0.4rem 0.8rem', borderRadius: '10px', fontSize: '0.85rem' }}
                    >
                      {[2024, 2025, 2026, 2027, 2028].map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Period Total Expense KPI Badge */}
                <div style={{ 
                  background: 'rgba(239, 68, 68, 0.08)', 
                  border: '1px solid rgba(239, 68, 68, 0.2)', 
                  padding: '0.5rem 1.2rem', 
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem'
                }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-gray)' }}>
                    {language === 'ar' ? 'إجمالي تكاليف الفترة المحددة:' : 'Total costs for this period:'}
                  </span>
                  <span className="font-en" style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--danger)' }}>
                    -{filteredTotalExpenses.toLocaleString()} EGP
                  </span>
                </div>
              </div>

              {/* Expenses Table */}
              <div className="table-wrapper">
                {filteredExpenses.length === 0 ? (
                  <div style={{ padding: '3rem', textAlign: 'center', background: 'rgba(255,255,255,0.01)', borderRadius: '15px', border: '1px dashed var(--border-color)' }}>
                    <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '1rem' }}>💸</span>
                    <h3 style={{ color: 'var(--text-gray)', margin: '0 0 0.5rem 0' }}>
                      {language === 'ar' ? 'لا توجد مصروفات مسجلة' : 'No Expenses Recorded'}
                    </h3>
                    <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.85rem' }}>
                      {language === 'ar' ? 'لم يتم تسجيل أي تكاليف تشغيلية لهذه الفترة المحددة.' : 'No operational expenses have been recorded for the selected period.'}
                    </p>
                  </div>
                ) : (
                  <table className="luxury-table">
                    <thead>
                      <tr>
                        <th>{language === 'ar' ? 'اسم المصروف' : 'Expense / Cost'}</th>
                        <th>{language === 'ar' ? 'التصنيف' : 'Category'}</th>
                        <th>{language === 'ar' ? 'القيمة' : 'Amount'}</th>
                        <th>{language === 'ar' ? 'طريقة الدفع' : 'Payment Method'}</th>
                        <th>{language === 'ar' ? 'التاريخ' : 'Date'}</th>
                        <th style={{ width: '80px' }}>{language === 'ar' ? 'الإجراءات' : 'Actions'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredExpenses.map((exp) => (
                        <tr key={exp.id}>
                          <td style={{ fontWeight: '700' }}>{exp.name}</td>
                          <td>
                            <span style={{ 
                              padding: '0.2rem 0.6rem', 
                              borderRadius: '8px', 
                              fontSize: '0.75rem',
                              fontWeight: 'bold',
                              background: exp.type === 'رواتب' ? 'rgba(59,130,246,0.1)' : exp.type === 'إيجار وفواتير' ? 'rgba(139,92,246,0.1)' : exp.type === 'تسويق ودعاية' ? 'rgba(236,72,153,0.1)' : exp.type === 'بضائع وخامات' ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.05)',
                              color: exp.type === 'رواتب' ? '#60a5fa' : exp.type === 'إيجار وفواتير' ? '#a78bfa' : exp.type === 'تسويق ودعاية' ? '#f472b6' : exp.type === 'بضائع وخامات' ? '#fbbf24' : 'var(--text-gray)',
                              border: '1px solid currentColor'
                            }}>
                              {exp.type}
                            </span>
                          </td>
                          <td className="font-en" style={{ color: 'var(--danger)', fontWeight: '800' }}>
                            -{exp.amount.toLocaleString()} EGP
                          </td>
                          <td>
                            <span style={{ fontWeight: '600' }}>
                              {exp.payment_method === 'cash' ? '💵 كاش' : exp.payment_method === 'visa' ? '💳 فيزا' : exp.payment_method === 'wallet' ? '📱 محفظة' : '⚡ انستا باي'}
                            </span>
                          </td>
                          <td className="font-en" style={{ fontSize: '0.85rem' }}>{exp.expense_date}</td>
                          <td>
                            <button 
                              className="btn-outline-gold" 
                              style={{ padding: '0.35rem 0.5rem', borderRadius: '8px', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.3)', minWidth: 'auto' }}
                              onClick={() => handleDeleteExpense(exp.id!)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB: CHEF RECIPES */}
        {activeTab === 'recipes' && (
          <div>
            <h1 className="text-gradient-gold" style={{ fontSize: '1.8rem', marginBottom: '1.5rem' }}>{language === 'ar' ? 'وصفات الشيف 👨‍🍳' : 'Chef Recipes 👨‍🍳'}</h1>
            <div className="products-grid">
              {products.filter(p => p.recipe_ar || p.recipe_en).map(product => (
                <div key={product.id} className="premium-card-wrapper">
                  <div className="premium-card">
                    <div className="card-image-box" style={{ height: '200px' }}>
                      <img className="card-image" src={product.image_url || '/placeholder.jpg'} alt={product.name_ar} />
                    </div>
                    <div style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <h3 style={{ fontSize: '1.1rem', color: 'var(--gold-primary)', marginBottom: '0.5rem' }}>
                      {language === 'ar' ? product.name_ar : product.name_en}
                    </h3>
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.8rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid var(--border-color)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                      <strong style={{ color: 'var(--gold-secondary)' }}>{language === 'ar' ? 'طريقة الطهي:' : 'Cooking Instructions:'}</strong><br/>
                      <span style={{ whiteSpace: 'pre-wrap' }}>{language === 'ar' ? (product.recipe_ar || product.recipe_en) : (product.recipe_en || product.recipe_ar)}</span>
                    </div>

                    <button 
                      className="btn-outline-gold" 
                      onClick={() => {
                        setSelectedRecipeProduct(product);
                        if (!allRecipeComments[product.id]) {
                          fetchCommentsForProduct(product.id);
                        }
                      }}
                      style={{ width: '100%', fontSize: '0.85rem' }}
                    >
                      {language === 'ar' ? 'عرض التعليقات والتفاعل' : 'View Comments & Interact'}
                    </button>

                    {selectedRecipeProduct?.id === product.id && (
                      <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                        <h4 style={{ fontSize: '0.9rem', color: 'var(--text-gray)', marginBottom: '0.8rem' }}>{language === 'ar' ? 'التعليقات' : 'Comments'}</h4>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem', maxHeight: '150px', overflowY: 'auto' }}>
                          {(allRecipeComments[product.id] || []).length === 0 ? (
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{language === 'ar' ? 'لا توجد تعليقات بعد. كن أول من يعلق!' : 'No comments yet. Be the first!'}</p>
                          ) : (
                            (allRecipeComments[product.id] || []).map(comment => (
                              <div key={comment.id} style={{ background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '6px' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--gold-secondary)', marginBottom: '0.2rem', fontWeight: 'bold' }}>{comment.user_name}</div>
                                <div style={{ fontSize: '0.85rem' }}>{comment.comment}</div>
                              </div>
                            ))
                          )}
                        </div>

                        <form onSubmit={(e) => handleAddComment(e, product.id)} style={{ display: 'flex', gap: '0.5rem' }}>
                          <input 
                            type="text" 
                            className="input-gold" 
                            placeholder={language === 'ar' ? 'أضف تعليقك...' : 'Add comment...'}
                            value={newCommentText[product.id] || ''}
                            onChange={(e) => setNewCommentText(prev => ({ ...prev, [product.id]: e.target.value }))}
                            style={{ flex: 1, padding: '0.4rem', fontSize: '0.85rem' }}
                            required
                          />
                          <button type="submit" className="btn-gold" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
                            {language === 'ar' ? 'إرسال' : 'Send'}
                          </button>
                        </form>
                      </div>
                    )}
                    </div>
                  </div>
                </div>
              ))}
              {products.filter(p => p.recipe_ar || p.recipe_en).length === 0 && (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', gridColumn: '1 / -1', padding: '2rem' }}>
                  {language === 'ar' ? 'لم يتم إضافة وصفات لأي منتج بعد. قم بإضافة وصفة عند تعديل المنتج.' : 'No recipes added to any product yet. Add a recipe when editing a product.'}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: SYSTEM USERS */}
        {activeTab === 'system_users' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <h1 className="text-gradient-gold" style={{ fontSize: '1.8rem', margin: 0 }}>{language === 'ar' ? 'مستخدمين النظام 👥' : 'System Users 👥'}</h1>
              <button className="btn-gold" onClick={() => setSysUserModalOpen(true)}>
                <Plus size={18} />
                <span>{language === 'ar' ? 'إضافة مستخدم' : 'Add User'}</span>
              </button>
            </div>
            
            <div className="table-panel">
              <div className="table-wrapper">
                <table className="luxury-table">
                  <thead>
                    <tr>
                      <th>{language === 'ar' ? 'الاسم' : 'Name'}</th>
                      <th>{language === 'ar' ? 'الهاتف' : 'Phone'}</th>
                      <th>{language === 'ar' ? 'اسم المستخدم' : 'Username'}</th>
                      <th>{language === 'ar' ? 'الدور' : 'Role'}</th>
                      <th>{language === 'ar' ? 'إجراءات' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {systemUsers.filter(u => u.role !== 'waiter').map(user => (
                      <tr key={user.id}>
                        <td style={{ fontWeight: 'bold' }}>{user.name}</td>
                        <td className="font-en">{user.phone || '-'}</td>
                        <td style={{ color: 'var(--gold-secondary)' }}>@{user.username}</td>
                        <td>
                          <span style={{ 
                            background: user.role === 'admin' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', 
                            color: user.role === 'admin' ? 'var(--danger)' : 'var(--success)',
                            padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold'
                          }}>
                            {user.role === 'admin' ? (language === 'ar' ? 'مدير نظام' : 'ADMIN') : (language === 'ar' ? 'صلاحيات مخصصة' : 'CUSTOM')}
                          </span>
                        </td>
                        <td>
                          {user.username !== 'admin' && (
                            <button 
                              className="action-btn delete" 
                              onClick={() => handleDeleteSystemUser(user.id)}
                              title={language === 'ar' ? 'حذف' : 'Delete'}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB: WAITERS MANAGEMENT */}
        {activeTab === 'waiters' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <h1 className="text-gradient-gold" style={{ fontSize: '1.8rem', margin: 0 }}>{language === 'ar' ? 'إدارة الويترز (الكابتن) 🤵‍♂️' : 'Waiters Management 🤵‍♂️'}</h1>
              <button className="btn-gold" onClick={() => setWaiterModalOpen(true)}>
                <Plus size={18} />
                <span>{language === 'ar' ? 'إضافة ويتر' : 'Add Waiter'}</span>
              </button>
            </div>
            
            <div className="table-panel">
              <div className="table-wrapper">
                <table className="luxury-table">
                  <thead>
                    <tr>
                      <th>{language === 'ar' ? 'الاسم' : 'Name'}</th>
                      <th>{language === 'ar' ? 'الهاتف' : 'Phone'}</th>
                      <th>{language === 'ar' ? 'رمز الدخول (POS)' : 'POS Passcode'}</th>
                      <th>{language === 'ar' ? 'طلبات اليوم' : 'Orders Today'}</th>
                      <th>{language === 'ar' ? 'إجراءات' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {systemUsers.filter(u => u.role === 'waiter').map(user => {
                      const todayStr = new Date().toISOString().split('T')[0];
                      const ordersTodayCount = orders.filter(o => 
                        o.waiter_id === user.id && o.created_at.startsWith(todayStr)
                      ).length;

                      return (
                        <tr key={user.id}>
                          <td style={{ fontWeight: 'bold' }}>{user.name}</td>
                          <td className="font-en">{user.phone || '-'}</td>
                          <td style={{ color: 'var(--gold-secondary)' }}>{user.passcode}</td>
                          <td style={{ fontWeight: 'bold', color: 'var(--success)' }}>{ordersTodayCount}</td>
                          <td>
                            <button 
                              className="action-btn delete" 
                              onClick={() => handleDeleteSystemUser(user.id)}
                              title={language === 'ar' ? 'حذف' : 'Delete'}
                            >
                              <Trash2 size={16} />
                            </button>
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

        {/* TAB: PRINTERS */}
        {activeTab === 'printers' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <h1 className="text-gradient-gold" style={{ fontSize: '1.8rem', margin: 0 }}>{language === 'ar' ? 'إعدادات الطابعات 🖨️' : 'Printers Settings 🖨️'}</h1>
              <button className="btn-gold" onClick={() => setPrinterModalOpen(true)}>
                <Plus size={18} />
                <span>{language === 'ar' ? 'إضافة طابعة' : 'Add Printer'}</span>
              </button>
            </div>
            
            <div className="table-panel">
              <div className="table-wrapper">
                <table className="luxury-table">
                  <thead>
                    <tr>
                      <th>{language === 'ar' ? 'اسم الطابعة (عربي)' : 'Printer Name (AR)'}</th>
                      <th>{language === 'ar' ? 'اسم الطابعة (إنجليزي)' : 'Printer Name (EN)'}</th>
                      <th>{language === 'ar' ? 'إجراءات' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printers.map(printer => (
                      <tr key={printer.id}>
                        <td style={{ fontWeight: 'bold' }}>{printer.name_ar}</td>
                        <td className="font-en">{printer.name_en}</td>
                        <td>
                          <button className="action-btn delete" onClick={() => handleDeletePrinter(printer.id)}>
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {printers.length === 0 && (
                      <tr>
                        <td colSpan={3} style={{ textAlign: 'center', padding: '2rem' }}>
                          {language === 'ar' ? 'لا توجد طابعات مضافة حالياً.' : 'No printers added yet.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* --- INVENTORY TAB --- */}
        {activeTab === 'inventory' && (
          <div className="admin-section">
            <div className="section-header" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{language === 'ar' ? 'إدارة المخازن والموردين' : 'Inventory & Suppliers'}</h1>
                <p style={{ color: 'var(--text-gray)' }}>
                  {language === 'ar' ? 'إدارة الموردين، الخامات، وفواتير الشراء' : 'Manage suppliers, raw materials, and purchase invoices'}
                </p>
              </div>
            </div>

            {/* Inventory Sub Navigation */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid #333', paddingBottom: '1rem' }}>
              <button 
                className={`btn-outline-gold ${inventorySubTab === 'items' ? 'active' : ''}`}
                onClick={() => setInventorySubTab('items')}
                style={{ background: inventorySubTab === 'items' ? 'var(--gold-primary)' : 'transparent', color: inventorySubTab === 'items' ? '#000' : 'var(--gold-primary)' }}
              >
                {language === 'ar' ? 'جرد المخازن' : 'Inventory Stock'}
              </button>
              <button 
                className={`btn-outline-gold ${inventorySubTab === 'invoices' ? 'active' : ''}`}
                onClick={() => setInventorySubTab('invoices')}
                style={{ background: inventorySubTab === 'invoices' ? 'var(--gold-primary)' : 'transparent', color: inventorySubTab === 'invoices' ? '#000' : 'var(--gold-primary)' }}
              >
                {language === 'ar' ? 'فواتير المشتريات' : 'Purchase Invoices'}
              </button>
              <button 
                className={`btn-outline-gold ${inventorySubTab === 'suppliers' ? 'active' : ''}`}
                onClick={() => setInventorySubTab('suppliers')}
                style={{ background: inventorySubTab === 'suppliers' ? 'var(--gold-primary)' : 'transparent', color: inventorySubTab === 'suppliers' ? '#000' : 'var(--gold-primary)' }}
              >
                {language === 'ar' ? 'الموردين' : 'Suppliers'}
              </button>
              <button 
                className={`btn-outline-gold ${inventorySubTab === 'mfg_orders' ? 'active' : ''}`}
                onClick={() => setInventorySubTab('mfg_orders')}
                style={{ background: inventorySubTab === 'mfg_orders' ? 'var(--gold-primary)' : 'transparent', color: inventorySubTab === 'mfg_orders' ? '#000' : 'var(--gold-primary)' }}
              >
                {language === 'ar' ? 'أوامر التصنيع / أذون الصرف' : 'Manufacturing Orders'}
              </button>
            </div>

            {/* ITEMS SUB TAB */}
            {inventorySubTab === 'items' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <h2 style={{ color: 'var(--gold-primary)' }}>{language === 'ar' ? 'الأصناف والخامات' : 'Items & Raw Materials'}</h2>
                  <button className="btn-gold" onClick={() => setInvModalOpen(true)}>
                    <Plus size={18} /> {language === 'ar' ? 'إضافة صنف جديد' : 'Add New Item'}
                  </button>
                </div>
                
                {/* Valuation Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                  <div className="stat-card">
                    <div className="stat-icon"><Package color="#000" size={24} /></div>
                    <div className="stat-info">
                      <h3>{language === 'ar' ? 'قيمة المخزن الأساسي' : 'Main Stock Value'}</h3>
                      <p className="stat-value">{inventoryItems.reduce((sum, item) => sum + (item.stock_main * item.avg_purchase_price), 0).toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon"><Package color="#000" size={24} /></div>
                    <div className="stat-info">
                      <h3>{language === 'ar' ? 'قيمة بضاعة المصنع / المطبخ' : 'Factory Stock Value'}</h3>
                      <p className="stat-value">{inventoryItems.reduce((sum, item) => sum + (item.stock_factory * item.avg_purchase_price), 0).toFixed(2)}</p>
                    </div>
                  </div>
                </div>

                <div className="table-responsive">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>{language === 'ar' ? 'الصنف' : 'Item'}</th>
                        <th>{language === 'ar' ? 'الوحدة' : 'Unit'}</th>
                        <th>{language === 'ar' ? 'المخزن الأساسي' : 'Main Stock'}</th>
                        <th>{language === 'ar' ? 'المصنع' : 'Factory'}</th>
                        <th>{language === 'ar' ? 'التوزيع' : 'Distribution'}</th>
                        <th>{language === 'ar' ? 'متوسط السعر' : 'Avg Price'}</th>
                        <th>{language === 'ar' ? 'آخر سعر شراء' : 'Last Price'}</th>
                        <th>{language === 'ar' ? 'إجراءات' : 'Actions'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventoryItems.map(item => (
                        <tr key={item.id}>
                          <td>{item.name}</td>
                          <td>{item.unit}</td>
                          <td style={{ color: 'var(--gold-primary)', fontWeight: 'bold' }}>{item.stock_main}</td>
                          <td>{item.stock_factory}</td>
                          <td>{item.stock_distribution}</td>
                          <td>{item.avg_purchase_price.toFixed(2)}</td>
                          <td>{item.last_purchase_price.toFixed(2)}</td>
                          <td>
                            <button className="action-btn delete" onClick={() => handleDeleteInventoryItem(item.id)}>
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {inventoryItems.length === 0 && (
                        <tr><td colSpan={8} style={{ textAlign: 'center', padding: '1rem' }}>{language === 'ar' ? 'لا توجد بيانات' : 'No data'}</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SUPPLIERS SUB TAB */}
            {inventorySubTab === 'suppliers' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <h2 style={{ color: 'var(--gold-primary)' }}>{language === 'ar' ? 'قائمة الموردين' : 'Suppliers List'}</h2>
                  <button className="btn-gold" onClick={() => setSupModalOpen(true)}>
                    <Plus size={18} /> {language === 'ar' ? 'إضافة مورد' : 'Add Supplier'}
                  </button>
                </div>
                <div className="table-responsive">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>{language === 'ar' ? 'اسم المورد' : 'Supplier Name'}</th>
                        <th>{language === 'ar' ? 'رقم الهاتف' : 'Phone'}</th>
                        <th>{language === 'ar' ? 'إجراءات' : 'Actions'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {suppliers.map(sup => (
                        <tr key={sup.id}>
                          <td>{sup.name}</td>
                          <td>{sup.phone}</td>
                          <td>
                            <button className="action-btn delete" onClick={() => handleDeleteSupplier(sup.id)}>
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {suppliers.length === 0 && (
                        <tr><td colSpan={3} style={{ textAlign: 'center', padding: '1rem' }}>{language === 'ar' ? 'لا توجد بيانات' : 'No data'}</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* PURCHASE INVOICES SUB TAB */}
            {inventorySubTab === 'invoices' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <h2 style={{ color: 'var(--gold-primary)' }}>{language === 'ar' ? 'فواتير الشراء' : 'Purchase Invoices'}</h2>
                  <button className="btn-gold" onClick={() => setInvoiceModalOpen(true)}>
                    <Plus size={18} /> {language === 'ar' ? 'إضافة فاتورة جديدة' : 'Add Purchase Invoice'}
                  </button>
                </div>
                <div className="table-responsive">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>{language === 'ar' ? 'التاريخ' : 'Date'}</th>
                        <th>{language === 'ar' ? 'المورد' : 'Supplier'}</th>
                        <th>{language === 'ar' ? 'الأصناف' : 'Items'}</th>
                        <th>{language === 'ar' ? 'الإجمالي' : 'Total'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchaseInvoices.sort((a,b) => new Date(b.created_at||'').getTime() - new Date(a.created_at||'').getTime()).map(inv => (
                        <tr key={inv.id}>
                          <td className="font-en">{new Date(inv.invoice_date).toLocaleDateString()}</td>
                          <td>{inv.supplier_name}</td>
                          <td>
                            {inv.items.map((i, idx) => (
                              <div key={idx} style={{ fontSize: '0.85rem' }}>
                                {i.quantity} x {i.item_name} (@{i.unit_price})
                              </div>
                            ))}
                          </td>
                          <td style={{ color: 'var(--gold-primary)', fontWeight: 'bold' }}>{inv.total_amount.toFixed(2)}</td>
                        </tr>
                      ))}
                      {purchaseInvoices.length === 0 && (
                        <tr><td colSpan={4} style={{ textAlign: 'center', padding: '1rem' }}>{language === 'ar' ? 'لا توجد بيانات' : 'No data'}</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* MANUFACTURING ORDERS SUB TAB */}
            {inventorySubTab === 'mfg_orders' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <h2 style={{ color: 'var(--gold-primary)' }}>{language === 'ar' ? 'أوامر التصنيع وأذون الصرف' : 'Manufacturing Orders & Transfers'}</h2>
                </div>
                <div className="table-responsive">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>{language === 'ar' ? 'رقم الطلب' : 'Order ID'}</th>
                        <th>{language === 'ar' ? 'المستخدم (بواسطة)' : 'Requested By'}</th>
                        <th>{language === 'ar' ? 'الأصناف' : 'Items'}</th>
                        <th>{language === 'ar' ? 'تاريخ الطلب' : 'Date'}</th>
                        <th>{language === 'ar' ? 'الحالة' : 'Status'}</th>
                        <th>{language === 'ar' ? 'إجراءات' : 'Actions'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {manufacturingOrders.map(order => (
                        <tr key={order.id}>
                          <td className="font-en">#{order.id.slice(0, 8)}</td>
                          <td>{order.requested_by}</td>
                          <td>
                            {order.items.map((i, idx) => (
                              <div key={idx} style={{ fontSize: '0.85rem' }}>
                                {i.quantity} {language === 'ar' && i.unit === 'kilo' ? 'كجم' : i.unit === 'gram' ? 'جرام' : i.unit === 'carton' ? 'كرتونة' : i.unit === 'box' ? 'علبة' : i.unit} من {i.item_name}
                              </div>
                            ))}
                          </td>
                          <td className="font-en">{new Date(order.created_at || '').toLocaleDateString()}</td>
                          <td>
                            <span style={{ 
                              padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 'bold',
                              background: order.status === 'approved' ? 'rgba(16,185,129,0.2)' : order.status === 'rejected' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)',
                              color: order.status === 'approved' ? 'var(--success)' : order.status === 'rejected' ? 'var(--danger)' : 'orange'
                            }}>
                              {order.status === 'approved' ? (language === 'ar' ? 'مقبول' : 'Approved') : order.status === 'rejected' ? (language === 'ar' ? 'مرفوض' : 'Rejected') : (language === 'ar' ? 'قيد الانتظار' : 'Pending')}
                            </span>
                          </td>
                          <td>
                            {order.status === 'pending' && (loggedInUser?.role === 'inventory_manager' || loggedInUser?.role === 'admin') && (
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button className="action-btn edit" onClick={() => handleApproveManufacturingOrder(order.id, true)} title={language === 'ar' ? 'قبول' : 'Approve'}>
                                  <CheckCircle size={16} color="var(--success)" />
                                </button>
                                <button className="action-btn delete" onClick={() => handleApproveManufacturingOrder(order.id, false)} title={language === 'ar' ? 'رفض' : 'Reject'}>
                                  <X size={16} color="var(--danger)" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                      {manufacturingOrders.length === 0 && (
                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: '1rem' }}>{language === 'ar' ? 'لا توجد بيانات' : 'No data'}</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- FACTORY TAB --- */}
        {activeTab === 'factory' && (
          <div className="admin-section">
            <div className="section-header" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{language === 'ar' ? 'المصنع والمطبخ' : 'Factory & Kitchen'}</h1>
                <p style={{ color: 'var(--text-gray)' }}>
                  {language === 'ar' ? 'إدارة الإنتاج، الصرف الدفتري، وتحويل المنتجات' : 'Manage production, material requests, and product transfers'}
                </p>
              </div>
            </div>

            {/* Factory Sub Navigation */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid #333', paddingBottom: '1rem' }}>
              <button 
                className={`btn-outline-gold ${factorySubTab === 'mfg_requests' ? 'active' : ''}`}
                onClick={() => setFactorySubTab('mfg_requests')}
                style={{ background: factorySubTab === 'mfg_requests' ? 'var(--gold-primary)' : 'transparent', color: factorySubTab === 'mfg_requests' ? '#000' : 'var(--gold-primary)' }}
              >
                {language === 'ar' ? 'أذون الصرف' : 'Material Requests'}
              </button>
              <button 
                className={`btn-outline-gold ${factorySubTab === 'production' ? 'active' : ''}`}
                onClick={() => setFactorySubTab('production')}
                style={{ background: factorySubTab === 'production' ? 'var(--gold-primary)' : 'transparent', color: factorySubTab === 'production' ? '#000' : 'var(--gold-primary)' }}
              >
                {language === 'ar' ? 'الإنتاج والتوزيع' : 'Production & Distribution'}
              </button>
            </div>

            {factorySubTab === 'mfg_requests' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <h2 style={{ color: 'var(--gold-primary)' }}>{language === 'ar' ? 'طلبات صرف الخامات' : 'Raw Material Requests'}</h2>
                  <button className="btn-gold" onClick={() => setMfgModalOpen(true)}>
                    <Plus size={18} /> {language === 'ar' ? 'طلب صرف خامات' : 'Request Materials'}
                  </button>
                </div>
                <div className="table-responsive">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>{language === 'ar' ? 'رقم الطلب' : 'Order ID'}</th>
                        <th>{language === 'ar' ? 'المستخدم (بواسطة)' : 'Requested By'}</th>
                        <th>{language === 'ar' ? 'الأصناف' : 'Items'}</th>
                        <th>{language === 'ar' ? 'تاريخ الطلب' : 'Date'}</th>
                        <th>{language === 'ar' ? 'الحالة' : 'Status'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {manufacturingOrders.map(order => (
                        <tr key={order.id}>
                          <td className="font-en">#{order.id.slice(0, 8)}</td>
                          <td>{order.requested_by}</td>
                          <td>
                            {order.items.map((i, idx) => (
                              <div key={idx} style={{ fontSize: '0.85rem' }}>
                                {i.quantity} {language === 'ar' && i.unit === 'kilo' ? 'كجم' : i.unit === 'gram' ? 'جرام' : i.unit === 'carton' ? 'كرتونة' : i.unit === 'box' ? 'علبة' : i.unit} من {i.item_name}
                              </div>
                            ))}
                          </td>
                          <td className="font-en">{new Date(order.created_at || '').toLocaleDateString()}</td>
                          <td>
                            <span style={{ 
                              padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 'bold',
                              background: order.status === 'approved' ? 'rgba(16,185,129,0.2)' : order.status === 'rejected' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)',
                              color: order.status === 'approved' ? 'var(--success)' : order.status === 'rejected' ? 'var(--danger)' : 'orange'
                            }}>
                              {order.status === 'approved' ? (language === 'ar' ? 'مقبول' : 'Approved') : order.status === 'rejected' ? (language === 'ar' ? 'مرفوض' : 'Rejected') : (language === 'ar' ? 'قيد الانتظار' : 'Pending')}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {manufacturingOrders.length === 0 && (
                        <tr><td colSpan={5} style={{ textAlign: 'center', padding: '1rem' }}>{language === 'ar' ? 'لا توجد بيانات' : 'No data'}</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {factorySubTab === 'production' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <h2 style={{ color: 'var(--gold-primary)' }}>{language === 'ar' ? 'سجل الإنتاج (التسليم للتوزيع)' : 'Production Logs'}</h2>
                  <button className="btn-gold" onClick={() => setProductionModalOpen(true)}>
                    <Plus size={18} /> {language === 'ar' ? 'تسجيل إنتاج جديد' : 'Record New Production'}
                  </button>
                </div>
                <div className="table-responsive">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>{language === 'ar' ? 'التاريخ' : 'Date'}</th>
                        <th>{language === 'ar' ? 'بواسطة' : 'Recorded By'}</th>
                        <th>{language === 'ar' ? 'المنتجات الجاهزة (إلى التوزيع)' : 'Produced (To Dist)'}</th>
                        <th>{language === 'ar' ? 'الخامات المستهلكة (من المصنع)' : 'Consumed (From Factory)'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productionLogs.map(log => (
                        <tr key={log.id}>
                          <td className="font-en">{new Date(log.created_at || '').toLocaleDateString()}</td>
                          <td>{log.recorded_by}</td>
                          <td>
                            {log.produced_items.map((i: any, idx: number) => (
                              <div key={idx} style={{ color: 'var(--success)', fontWeight: 'bold' }}>
                                + {i.quantity} {i.item_name}
                              </div>
                            ))}
                          </td>
                          <td>
                            {log.consumed_items.map((i: any, idx: number) => (
                              <div key={idx} style={{ color: 'var(--danger)' }}>
                                - {i.quantity} {i.item_name}
                              </div>
                            ))}
                          </td>
                        </tr>
                      ))}
                      {productionLogs.length === 0 && (
                        <tr><td colSpan={4} style={{ textAlign: 'center', padding: '1rem' }}>{language === 'ar' ? 'لا توجد عمليات إنتاج مسجلة' : 'No production logs'}</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
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
                <div className="form-group">
                  <label>{language === 'ar' ? 'طابعة القسم (اختياري)' : 'Station Printer (Optional)'}</label>
                  <select className="input-gold" value={catPrinterId} onChange={(e) => setCatPrinterId(e.target.value)}>
                    <option value="">{language === 'ar' ? '-- بدون طابعة متخصصة --' : '-- No specific printer --'}</option>
                    {printers.map(p => (
                      <option key={p.id} value={p.id}>{language === 'ar' ? p.name_ar : p.name_en}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>{language === 'ar' ? 'القسم' : 'Department'} *</label>
                  <select className="input-gold" value={catDepartment} onChange={(e) => setCatDepartment(e.target.value as 'restaurant'|'bar')} required>
                    <option value="restaurant">{language === 'ar' ? 'مطعم' : 'Restaurant'}</option>
                    <option value="bar">{language === 'ar' ? 'بار' : 'Bar'}</option>
                  </select>
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
                <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label>{t.thPrice} *</label>
                    <input type="number" className="input-gold" value={prodPrice} onChange={(e) => setProdPrice(Number(e.target.value))} required />
                  </div>
                  <div>
                    <label>{language === 'ar' ? 'سعر طلبات (اختياري)' : 'Talabat Price'}</label>
                    <input type="number" className="input-gold" value={prodTalabatPrice} onChange={(e) => setProdTalabatPrice(e.target.value ? Number(e.target.value) : '')} placeholder={language === 'ar' ? 'اختياري...' : 'Optional...'} />
                  </div>
                </div>

                {/* Image URL & Upload */}
                <div className="form-group">
                  <label>رابط الصورة أو رفع ملف (Image URL / Upload)</label>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input 
                      type="text" 
                      className="input-gold" 
                      value={prodImageUrl} 
                      onChange={(e) => setProdImageUrl(e.target.value)} 
                      placeholder="رابط الصورة أو اختر ملفاً للرفع..." 
                      style={{ flex: 1 }}
                    />
                    <label className="btn-gold" style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.25rem', 
                      cursor: 'pointer', 
                      padding: '0.6rem 1rem', 
                      fontSize: '0.85rem',
                      borderRadius: '8px',
                      whiteSpace: 'nowrap',
                      margin: 0,
                      height: '42px',
                      boxSizing: 'border-box',
                      justifyContent: 'center'
                    }}>
                      <Upload size={16} />
                      <span>{language === 'ar' ? 'رفع صورة' : 'Upload'}</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setProdImageUrl(reader.result as string);
                            };
                            reader.readAsDataURL(file);
                          }
                        }} 
                        style={{ display: 'none' }} 
                      />
                    </label>
                  </div>
                  {prodImageUrl && (
                    <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <img src={prodImageUrl} alt="Preview" style={{ width: '45px', height: '45px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--gold-primary)' }} />
                      <button 
                        type="button" 
                        className="btn-outline-gold" 
                        onClick={() => setProdImageUrl('')}
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', height: '26px', display: 'flex', alignItems: 'center', borderRadius: '6px' }}
                      >
                        {language === 'ar' ? 'حذف' : 'Remove'}
                      </button>
                    </div>
                  )}
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

                {/* Recipe AR */}
                <div className="form-group">
                  <label>{language === 'ar' ? 'وصفة الشيف (عربي)' : 'Chef Recipe (AR)'}</label>
                  <textarea className="input-gold" rows={4} placeholder={language === 'ar' ? 'تفاصيل الوصفة والطهي...' : 'Cooking details...'} value={prodRecipeAr} onChange={(e) => setProdRecipeAr(e.target.value)} />
                </div>

                {/* Recipe EN */}
                <div className="form-group">
                  <label>{language === 'ar' ? 'وصفة الشيف (إنجليزي)' : 'Chef Recipe (EN)'}</label>
                  <textarea className="input-gold" rows={4} placeholder="Cooking details..." value={prodRecipeEn} onChange={(e) => setProdRecipeEn(e.target.value)} />
                </div>

                {/* Product Recipe Ingredients Section */}
                <div className="form-group" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', marginTop: '1.5rem' }}>
                  <h3 style={{ color: 'var(--gold-primary)', marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 'bold' }}>
                    {language === 'ar' ? 'مكونات الوصفة الدفترية (خصم المخزن التلقائي)' : 'Recipe Ingredients (Automatic Stock Deduction)'}
                  </h3>
                  
                  {/* Select component & quantity */}
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '0.5rem', alignItems: 'end', marginBottom: '1rem' }}>
                    <div>
                      <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem' }}>{language === 'ar' ? 'اختر مادة خام من المخزن' : 'Select Raw Material'}</label>
                      <select 
                        className="input-gold" 
                        value={selectedInvItemId} 
                        onChange={(e) => setSelectedInvItemId(e.target.value)}
                        style={{ height: '42px', width: '100%', background: '#000', border: '1px solid var(--gold-secondary)' }}
                      >
                        <option value="">{language === 'ar' ? '-- اختر مكون --' : '-- Select Ingredient --'}</option>
                        {inventoryItems.map(item => (
                          <option key={item.id} value={item.id} style={{ background: '#121212' }}>
                            {item.name} ({item.unit})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem' }}>{language === 'ar' ? 'الكمية المطلوبة' : 'Required Qty'}</label>
                      <input 
                        type="number" 
                        step="0.001" 
                        className="input-gold" 
                        value={recipeItemQty} 
                        onChange={(e) => setRecipeItemQty(e.target.value === '' ? '' : Number(e.target.value))} 
                        placeholder="0.200"
                        style={{ height: '42px', width: '100%' }}
                      />
                    </div>
                    <button 
                      type="button" 
                      className="btn-gold" 
                      onClick={handleAddRecipeItem}
                      style={{ height: '42px', padding: '0 1rem', display: 'flex', alignItems: 'center', gap: '0.25rem', margin: 0 }}
                    >
                      <Plus size={16} />
                      <span>{language === 'ar' ? 'إضافة' : 'Add'}</span>
                    </button>
                  </div>

                  {/* Components List */}
                  {prodRecipes.length === 0 ? (
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '1rem', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
                      {language === 'ar' ? 'لا توجد مكونات لهذه الوصفة بعد.' : 'No components in this recipe yet.'}
                    </p>
                  ) : (
                    <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                        <thead>
                          <tr style={{ background: 'rgba(212, 175, 55, 0.05)', borderBottom: '1px solid var(--border-color)' }}>
                            <th style={{ textAlign: language === 'ar' ? 'right' : 'left', padding: '0.5rem 1rem', color: 'var(--gold-secondary)' }}>{language === 'ar' ? 'اسم المكون' : 'Ingredient'}</th>
                            <th style={{ textAlign: 'center', padding: '0.5rem 1rem', color: 'var(--gold-secondary)', width: '120px' }}>{language === 'ar' ? 'الكمية' : 'Quantity'}</th>
                            <th style={{ textAlign: 'center', padding: '0.5rem 1rem', color: 'var(--gold-secondary)', width: '100px' }}>{language === 'ar' ? 'الوحدة' : 'Unit'}</th>
                            <th style={{ textAlign: 'center', padding: '0.5rem 1rem', color: 'var(--gold-secondary)', width: '80px' }}>{language === 'ar' ? 'حذف' : 'Remove'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {prodRecipes.map(r => (
                            <tr key={r.inventory_item_id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '0.5rem 1rem', fontWeight: 'bold', textAlign: language === 'ar' ? 'right' : 'left' }}>{r.inventory_item_name}</td>
                              <td style={{ padding: '0.5rem 1rem', textAlign: 'center' }}>{r.quantity}</td>
                              <td style={{ padding: '0.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>{r.inventory_item_unit}</td>
                              <td style={{ padding: '0.5rem 1rem', textAlign: 'center' }}>
                                <button 
                                  type="button" 
                                  onClick={() => handleRemoveRecipeItem(r.inventory_item_id)}
                                  style={{ background: 'none', border: 'none', color: '#ff4d4d', cursor: 'pointer', padding: '0.2rem' }}
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Availability checkbox */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
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
          <div className="admin-modal" style={{ maxWidth: '850px', width: '95%' }} onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.8rem' }}>
              <h2>{language === 'ar' ? 'إضافة طلب يدوي جديد 🍽️' : 'Add New Manual Order 🍽️'}</h2>
              <button className="btn-close" onClick={() => setOrderModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveManualOrder}>
              <div className="admin-modal-body" style={{ maxHeight: '72vh', overflowY: 'auto', padding: '1rem 0.5rem' }}>
                
                {/* 1. Basic client info and Statuses */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem', position: 'relative' }}>
                  
                  <div className="form-group" style={{ position: 'relative' }}>
                    <label>{language === 'ar' ? 'اسم العميل *' : 'Customer Name *'}</label>
                    <input 
                      type="text" 
                      className="input-gold" 
                      value={manualCustName} 
                      onChange={(e) => {
                        setManualCustName(e.target.value);
                        setShowCustDropdown(true);
                      }}
                      onFocus={() => setShowCustDropdown(true)}
                      onBlur={() => setTimeout(() => setShowCustDropdown(false), 200)}
                      required 
                    />
                  </div>

                  <div className="form-group" style={{ position: 'relative' }}>
                    <label>{language === 'ar' ? 'رقم الهاتف *' : 'Phone Number *'}</label>
                    <input 
                      type="text" 
                      className="input-gold" 
                      value={manualCustPhone} 
                      onChange={(e) => {
                        setManualCustPhone(e.target.value);
                        setShowCustDropdown(true);
                      }}
                      onFocus={() => setShowCustDropdown(true)}
                      onBlur={() => setTimeout(() => setShowCustDropdown(false), 200)}
                      required 
                    />
                  </div>

                  <div className="form-group">
                    <label>{language === 'ar' ? 'رقم الطاولة / الطرابيزة *' : 'Table / Seat Number *'}</label>
                    <input type="text" className="input-gold" value={manualTableNum} onChange={(e) => setManualTableNum(e.target.value)} required />
                  </div>

                  <div className="form-group">
                    <label>{language === 'ar' ? 'حالة الطلب الإبتدائية *' : 'Initial Status *'}</label>
                    <select className="input-gold" value={manualStatus} onChange={(e) => setManualStatus(e.target.value as any)}>
                      <option value="pending" style={{ background: '#121212', color: 'var(--warning)' }}>🍳 قيد التحضير</option>
                      <option value="preparing" style={{ background: '#121212', color: 'var(--warning)' }}>🍳 قيد التحضير</option>
                      <option value="delivered" style={{ background: '#121212', color: '#3b82f6' }}>🛵 تم التسليم للعميل</option>
                      <option value="completed" style={{ background: '#121212', color: 'var(--success)' }}>💳 تم التحصيل / مكتمل</option>
                      <option value="cancelled" style={{ background: '#121212', color: 'var(--danger)' }}>❌ ملغي</option>
                    </select>
                  </div>

                  {/* Customer Dropdown Suggestions */}
                  {showCustDropdown && matchingCustomers.length > 0 && (
                    <div style={{ 
                      position: 'absolute', 
                      top: '100%', 
                      left: 0, 
                      right: 0, 
                      background: '#18181b', 
                      border: '1px solid var(--gold-primary)', 
                      borderRadius: '12px', 
                      zIndex: 100, 
                      maxHeight: '180px', 
                      overflowY: 'auto',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.6)',
                      marginTop: '0.2rem',
                      padding: '0.4rem 0'
                    }}>
                      <div style={{ padding: '0.3rem 0.8rem', fontSize: '0.75rem', color: 'var(--text-gray)', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '0.3rem' }}>
                        {language === 'ar' ? '💡 هل تقصد عميلاً سابقاً؟ (انقر للاختيار التلقائي)' : '💡 Did you mean an existing customer? (Click to auto-fill)'}
                      </div>
                      {matchingCustomers.map(cust => (
                        <div 
                          key={cust.phone} 
                          onClick={() => {
                            setManualCustName(cust.name);
                            setManualCustPhone(cust.phone);
                            setManualTableNum(cust.preferredTable);
                            setShowCustDropdown(false);
                          }}
                          style={{ 
                            padding: '0.5rem 0.8rem', 
                            cursor: 'pointer', 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            fontSize: '0.85rem',
                            borderBottom: '1px solid rgba(255,255,255,0.02)',
                            transition: 'background 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(212, 175, 55, 0.08)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <div style={{ fontWeight: 'bold', color: 'var(--text-white)' }}>{cust.name}</div>
                          <div style={{ display: 'flex', gap: '0.8rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            <span className="font-en" style={{ color: 'var(--gold-secondary)' }}>{cust.phone}</span>
                            <span>طاولة: #{cust.preferredTable}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. Grid for Category Product List & Order Summary */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginTop: '1rem' }}>
                  
                  {/* LEFT COLUMN: PRODUCT SELECTION */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ fontSize: '0.95rem', color: 'var(--gold-primary)', fontWeight: 'bold' }}>
                        {language === 'ar' ? 'اختر الأصناف والمنتجات 🍔' : 'Choose Products 🍔'}
                      </label>
                    </div>

                    {/* Category Scroll Filter Bar */}
                    <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.4rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedManualCat('all')}
                        style={{ 
                          padding: '0.3rem 0.8rem', 
                          borderRadius: '20px', 
                          fontSize: '0.75rem', 
                          border: '1px solid', 
                          borderColor: selectedManualCat === 'all' ? 'var(--gold-primary)' : 'rgba(255,255,255,0.1)',
                          background: selectedManualCat === 'all' ? 'rgba(212, 175, 55, 0.1)' : 'transparent',
                          color: selectedManualCat === 'all' ? 'var(--gold-primary)' : 'var(--text-gray)',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {language === 'ar' ? 'الكل 🍽️' : 'All 🍽️'}
                      </button>
                      {categories.map(cat => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setSelectedManualCat(cat.id)}
                          style={{ 
                            padding: '0.3rem 0.8rem', 
                            borderRadius: '20px', 
                            fontSize: '0.75rem', 
                            border: '1px solid', 
                            borderColor: selectedManualCat === cat.id ? 'var(--gold-primary)' : 'rgba(255,255,255,0.1)',
                            background: selectedManualCat === cat.id ? 'rgba(212, 175, 55, 0.1)' : 'transparent',
                            color: selectedManualCat === cat.id ? 'var(--gold-primary)' : 'var(--text-gray)',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {language === 'ar' ? cat.name_ar : cat.name_en}
                        </button>
                      ))}
                    </div>

                    {/* Scrollable Products list container */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '320px', overflowY: 'auto', paddingRight: '0.4rem' }}>
                      {products
                        .filter(prod => {
                          if (!prod.is_available) return false;
                          if (selectedManualCat === 'all') return true;
                          return prod.category_id === selectedManualCat;
                        })
                        .map(prod => {
                          const qty = manualItems[prod.id] || 0;
                          return (
                            <div key={prod.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '0.5rem 0.8rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.03)' }}>
                              <div>
                                <div style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{language === 'ar' ? prod.name_ar : prod.name_en}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--gold-primary)' }}>{prod.price} EGP</div>
                              </div>
                              
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <button 
                                  type="button" 
                                  className="btn-outline-gold" 
                                  style={{ padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}
                                  onClick={() => setManualItems(prev => ({
                                    ...prev,
                                    [prod.id]: Math.max(0, qty - 1)
                                  }))}
                                >
                                  -
                                </button>
                                <span style={{ fontWeight: 'bold', width: '16px', textAlign: 'center', fontSize: '0.85rem' }}>{qty}</span>
                                <button 
                                  type="button" 
                                  className="btn-outline-gold" 
                                  style={{ padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}
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
                      {products.filter(prod => {
                        if (!prod.is_available) return false;
                        if (selectedManualCat === 'all') return true;
                        return prod.category_id === selectedManualCat;
                      }).length === 0 && (
                        <div style={{ textAlign: 'center', color: 'var(--text-gray)', fontSize: '0.8rem', padding: '2rem' }}>
                          {language === 'ar' ? 'لا توجد منتجات متاحة في هذا التصنيف حالياً' : 'No available products in this category'}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* RIGHT COLUMN: DYNAMIC BILL SUMMARY & CHECKOUT */}
                  <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid var(--border-color)', borderRadius: '15px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                      <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--gold-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span>🛒</span>
                        <span>{language === 'ar' ? 'ملخص وتجميع الفاتورة' : 'Bill Summary & Aggregation'}</span>
                      </h3>
                    </div>

                    {/* Scrollable list of added items */}
                    <div style={{ flex: 1, maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {(() => {
                        const selectedList = Object.entries(manualItems).filter(([_, q]) => q > 0);
                        if (selectedList.length === 0) {
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '120px', color: 'var(--text-gray)', fontSize: '0.8rem' }}>
                              <span>📋</span>
                              <span>{language === 'ar' ? 'السلة فارغة. أضف منتجات من اليسار.' : 'Cart is empty. Add products.'}</span>
                            </div>
                          );
                        }

                        return selectedList.map(([prodId, qty]) => {
                          const prod = products.find(p => p.id === prodId);
                          if (!prod) return null;
                          return (
                            <div key={prodId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '0.3rem' }}>
                              <div>
                                <span style={{ color: 'var(--gold-primary)', fontWeight: 'bold' }}>{qty}x </span>
                                <span>{language === 'ar' ? prod.name_ar : prod.name_en}</span>
                              </div>
                              <div className="font-en" style={{ color: 'var(--text-gray)' }}>
                                {(prod.price * qty).toFixed(2)} EGP
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>

                    {/* Totals computation */}
                    {(() => {
                      const orderSubtotal = Object.entries(manualItems).reduce((sum, [prodId, qty]) => {
                        const prod = products.find(p => p.id === prodId);
                        return sum + (prod ? prod.price * qty : 0);
                      }, 0);
                      
                      const orderServicePercent = settings.service_percent || 0;
                      const orderServiceAmount = orderSubtotal * (orderServicePercent / 100);
                      
                      const orderTaxPercent = settings.tax_percent || 0;
                      const orderTaxAmount = (orderSubtotal + orderServiceAmount) * (orderTaxPercent / 100);
                      
                      const orderGrandTotal = orderSubtotal + orderServiceAmount + orderTaxAmount;

                      return (
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                            <span style={{ color: 'var(--text-gray)' }}>{language === 'ar' ? 'المجموع الفرعي:' : 'Subtotal:'}</span>
                            <span className="font-en">{orderSubtotal.toFixed(2)} EGP</span>
                          </div>

                          {orderServiceAmount > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                              <span style={{ color: 'var(--text-gray)' }}>{language === 'ar' ? `الخدمة (${orderServicePercent}%):` : `Service (${orderServicePercent}%):`}</span>
                              <span className="font-en">+{orderServiceAmount.toFixed(2)} EGP</span>
                            </div>
                          )}

                          {orderTaxAmount > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                              <span style={{ color: 'var(--text-gray)' }}>{language === 'ar' ? `الضريبة (${orderTaxPercent}%):` : `Tax (${orderTaxPercent}%):`}</span>
                              <span className="font-en">+{orderTaxAmount.toFixed(2)} EGP</span>
                            </div>
                          )}
                          
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem', borderTop: '1px dotted rgba(255,255,255,0.08)', paddingTop: '0.4rem' }}>
                            <span style={{ color: 'var(--text-white)', fontWeight: 'bold', fontSize: '0.95rem' }}>{language === 'ar' ? 'الحساب الإجمالي:' : 'Grand Total:'}</span>
                            <span className="font-en" style={{ fontSize: '1.25rem', color: 'var(--gold-primary)', fontWeight: '900', textShadow: '0 0 10px rgba(212,175,55,0.3)' }}>
                              {orderGrandTotal.toFixed(2)} EGP
                            </span>
                          </div>
                        </div>
                      );
                    })()}

                  </div>
                </div>

              </div>
              <div className="admin-modal-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <button type="button" className="btn-outline-gold" onClick={() => setOrderModalOpen(false)}>{t.close}</button>
                <button type="submit" className="btn-gold" disabled={loading}>{t.save}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* --- PAYMENT METHOD SELECTOR MODAL --- */}
      {paymentCollectOrder && (
        <div className="admin-modal-overlay" style={{ zIndex: 1100 }} onClick={() => setPaymentCollectOrder(null)}>
          <div className="admin-modal" style={{ maxWidth: '450px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.8rem' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, fontSize: '1.2rem' }}>
                <span>💰</span>
                <span>{language === 'ar' ? 'تحصيل الطلب ودفع الفاتورة' : 'Collect Bill & Close Order'}</span>
              </h2>
              <button className="btn-close" onClick={() => setPaymentCollectOrder(null)}><X size={20} /></button>
            </div>
            <div className="admin-modal-body" style={{ padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Order Info Summary */}
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', padding: '1rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-gray)' }}>
                  <span>{language === 'ar' ? 'العميل:' : 'Customer:'}</span>
                  <span style={{ color: '#fff', fontWeight: 'bold' }}>{paymentCollectOrder.customer_name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-gray)' }}>
                  <span>{language === 'ar' ? 'رقم الهاتف:' : 'Phone Number:'}</span>
                  <span className="font-en" style={{ color: '#fff' }}>{paymentCollectOrder.customer_phone}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-gray)' }}>
                  <span>{language === 'ar' ? 'رقم الطاولة / الطرابيزة:' : 'Table:'}</span>
                  <span className="font-en" style={{ color: 'var(--gold-secondary)', fontWeight: 'bold' }}>#{paymentCollectOrder.table_number}</span>
                </div>
                
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: '0.5rem', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>{language === 'ar' ? 'المبلغ المستحق الدفع:' : 'Amount Due:'}</span>
                  <span className="font-en" style={{ fontSize: '1.3rem', color: 'var(--gold-primary)', fontWeight: '900', textShadow: '0 0 10px rgba(212,175,55,0.4)' }}>
                    {paymentCollectOrder.total_price.toFixed(2)} EGP
                  </span>
                </div>
              </div>

              {/* Payment Methods Grid */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <label style={{ fontSize: '0.9rem', color: 'var(--gold-primary)', fontWeight: 'bold' }}>
                  {language === 'ar' ? 'اختر طريقة تحصيل الدفع للطلب:' : 'Select Payment Method:'}
                </label>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                  
                  {/* Cash Option */}
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentMethod('cash')}
                    style={{
                      background: selectedPaymentMethod === 'cash' ? 'rgba(212, 175, 55, 0.1)' : 'rgba(255,255,255,0.02)',
                      border: selectedPaymentMethod === 'cash' ? '2px solid var(--gold-primary)' : '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '12px',
                      padding: '1rem 0.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.4rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: selectedPaymentMethod === 'cash' ? '0 0 10px rgba(212,175,55,0.2)' : 'none'
                    }}
                  >
                    <span style={{ fontSize: '1.5rem' }}>💵</span>
                    <span style={{ fontWeight: 'bold', fontSize: '0.85rem', color: selectedPaymentMethod === 'cash' ? 'var(--gold-primary)' : 'var(--text-white)' }}>
                      {language === 'ar' ? 'كاش / نقدي' : 'Cash'}
                    </span>
                  </button>

                  {/* Visa Option */}
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentMethod('visa')}
                    style={{
                      background: selectedPaymentMethod === 'visa' ? 'rgba(212, 175, 55, 0.1)' : 'rgba(255,255,255,0.02)',
                      border: selectedPaymentMethod === 'visa' ? '2px solid var(--gold-primary)' : '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '12px',
                      padding: '1rem 0.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.4rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: selectedPaymentMethod === 'visa' ? '0 0 10px rgba(212,175,55,0.2)' : 'none'
                    }}
                  >
                    <span style={{ fontSize: '1.5rem' }}>💳</span>
                    <span style={{ fontWeight: 'bold', fontSize: '0.85rem', color: selectedPaymentMethod === 'visa' ? 'var(--gold-primary)' : 'var(--text-white)' }}>
                      {language === 'ar' ? 'فيزا / بطاقة' : 'Visa / Card'}
                    </span>
                  </button>

                  {/* InstaPay Option */}
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentMethod('instapay')}
                    style={{
                      background: selectedPaymentMethod === 'instapay' ? 'rgba(212, 175, 55, 0.1)' : 'rgba(255,255,255,0.02)',
                      border: selectedPaymentMethod === 'instapay' ? '2px solid var(--gold-primary)' : '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '12px',
                      padding: '1rem 0.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.4rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: selectedPaymentMethod === 'instapay' ? '0 0 10px rgba(212,175,55,0.2)' : 'none'
                    }}
                  >
                    <span style={{ fontSize: '1.5rem' }}>📱</span>
                    <span style={{ fontWeight: 'bold', fontSize: '0.85rem', color: selectedPaymentMethod === 'instapay' ? 'var(--gold-primary)' : 'var(--text-white)' }}>
                      {language === 'ar' ? 'انستا باي' : 'InstaPay'}
                    </span>
                  </button>

                  {/* E-Wallet Option */}
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentMethod('wallet')}
                    style={{
                      background: selectedPaymentMethod === 'wallet' ? 'rgba(212, 175, 55, 0.1)' : 'rgba(255,255,255,0.02)',
                      border: selectedPaymentMethod === 'wallet' ? '2px solid var(--gold-primary)' : '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '12px',
                      padding: '1rem 0.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.4rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: selectedPaymentMethod === 'wallet' ? '0 0 10px rgba(212,175,55,0.2)' : 'none'
                    }}
                  >
                    <span style={{ fontSize: '1.5rem' }}>💼</span>
                    <span style={{ fontWeight: 'bold', fontSize: '0.85rem', color: selectedPaymentMethod === 'wallet' ? 'var(--gold-primary)' : 'var(--text-white)' }}>
                      {language === 'ar' ? 'محفظة إلكترونية' : 'E-Wallet'}
                    </span>
                  </button>

                </div>
              </div>

            </div>
            <div className="admin-modal-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <button type="button" className="btn-outline-gold" onClick={() => setPaymentCollectOrder(null)}>{language === 'ar' ? 'إلغاء' : 'Cancel'}</button>
              <button 
                type="button" 
                className="btn-gold" 
                disabled={loading} 
                onClick={() => handleCollectPayment(paymentCollectOrder.id, selectedPaymentMethod)}
                style={{ padding: '0.5rem 1.5rem', borderRadius: '10px' }}
              >
                {language === 'ar' ? 'تأكيد التحصيل وإتمام الفاتورة 🎉' : 'Confirm Collection & Paid 🎉'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- ADD EXPENSE MODAL OVERLAY --- */}
      {expModalOpen && (
        <div className="admin-modal-overlay" style={{ zIndex: 1100 }} onClick={() => setExpModalOpen(false)}>
          <div className="admin-modal" style={{ maxWidth: '500px', width: '95%' }} onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.8rem' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, fontSize: '1.2rem' }}>
                <span>💰</span>
                <span>{language === 'ar' ? 'إضافة مصروف وتكلفة جديدة' : 'Add New Expense & Cost'}</span>
              </h2>
              <button className="btn-close" onClick={() => setExpModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveExpense}>
              <div className="admin-modal-body" style={{ padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                
                {/* Expense Name */}
                <div className="form-group">
                  <label style={{ fontSize: '0.9rem', color: 'var(--gold-primary)', fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>
                    {language === 'ar' ? 'اسم التكلفة / المصروف *' : 'Expense / Cost Name *'}
                  </label>
                  <input 
                    type="text" 
                    className="input-gold" 
                    placeholder={language === 'ar' ? 'مثال: شراء لحوم، فاتورة كهرباء شهر مايو...' : 'e.g. Meat purchase, electricity bill...'} 
                    value={expName} 
                    onChange={(e) => setExpName(e.target.value)} 
                    required 
                  />
                </div>

                {/* Expense Type (Category) */}
                <div className="form-group">
                  <label style={{ fontSize: '0.9rem', color: 'var(--gold-primary)', fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>
                    {language === 'ar' ? 'تصنيف التكلفة (النوع) *' : 'Expense Category (Type) *'}
                  </label>
                  <select 
                    className="input-gold" 
                    value={expType} 
                    onChange={(e) => setExpType(e.target.value)}
                    required
                    style={{ appearance: 'none', background: 'rgba(0,0,0,0.4)', color: '#fff', border: '1px solid var(--gold-secondary)' }}
                  >
                    <option value="بضائع وخامات" style={{ background: '#1c1c1c', color: '#fff' }}>{language === 'ar' ? 'بضائع وخامات' : 'Goods & Raw Materials'}</option>
                    <option value="مرتبات" style={{ background: '#1c1c1c', color: '#fff' }}>{language === 'ar' ? 'مرتبات العاملين' : 'Salaries'}</option>
                    <option value="إيجار" style={{ background: '#1c1c1c', color: '#fff' }}>{language === 'ar' ? 'إيجار' : 'Rent'}</option>
                    <option value="خدمات (كهرباء ومياه)" style={{ background: '#1c1c1c', color: '#fff' }}>{language === 'ar' ? 'خدمات (كهرباء ومياه)' : 'Utilities (Electricity/Water)'}</option>
                    <option value="صيانة" style={{ background: '#1c1c1c', color: '#fff' }}>{language === 'ar' ? 'صيانة وإصلاحات' : 'Maintenance'}</option>
                    <option value="تسويق" style={{ background: '#1c1c1c', color: '#fff' }}>{language === 'ar' ? 'تسويق وإعلانات' : 'Marketing & Ads'}</option>
                    <option value="أخرى" style={{ background: '#1c1c1c', color: '#fff' }}>{language === 'ar' ? 'أخرى' : 'Others'}</option>
                  </select>
                </div>

                {/* Expense Amount */}
                <div className="form-group">
                  <label style={{ fontSize: '0.9rem', color: 'var(--gold-primary)', fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>
                    {language === 'ar' ? 'قيمة المصروف (المبلغ بالجنيه) *' : 'Amount (EGP) *'}
                  </label>
                  <input 
                    type="number" 
                    step="any"
                    min="0.01"
                    className="input-gold font-en" 
                    placeholder="0.00" 
                    value={expAmount || ''} 
                    onChange={(e) => setExpAmount(Number(e.target.value))} 
                    required 
                  />
                </div>

                {/* Expense Date */}
                <div className="form-group">
                  <label style={{ fontSize: '0.9rem', color: 'var(--gold-primary)', fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>
                    {language === 'ar' ? 'تاريخ المصروف *' : 'Expense Date *'}
                  </label>
                  <input 
                    type="date" 
                    className="input-gold font-en" 
                    value={expDate} 
                    onChange={(e) => setExpDate(e.target.value)} 
                    required 
                  />
                </div>

                {/* Payment Method Toggle Buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <label style={{ fontSize: '0.9rem', color: 'var(--gold-primary)', fontWeight: 'bold' }}>
                    {language === 'ar' ? 'طريقة دفع المصروف:' : 'Payment Method:'}
                  </label>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                    
                    {/* Cash Option */}
                    <button
                      type="button"
                      className={expPaymentMethod === 'cash' ? 'btn-gold' : 'btn-outline-gold'}
                      onClick={() => setExpPaymentMethod('cash')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        padding: '0.6rem',
                        borderRadius: '10px',
                        borderWidth: '1.5px',
                        fontSize: '0.85rem',
                        fontWeight: 'bold',
                        transition: 'all 0.2s ease',
                        cursor: 'pointer'
                      }}
                    >
                      <span>💵</span>
                      <span>{language === 'ar' ? 'نقدي (كاش)' : 'Cash'}</span>
                    </button>

                    {/* Visa Option */}
                    <button
                      type="button"
                      className={expPaymentMethod === 'visa' ? 'btn-gold' : 'btn-outline-gold'}
                      onClick={() => setExpPaymentMethod('visa')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        padding: '0.6rem',
                        borderRadius: '10px',
                        borderWidth: '1.5px',
                        fontSize: '0.85rem',
                        fontWeight: 'bold',
                        transition: 'all 0.2s ease',
                        cursor: 'pointer'
                      }}
                    >
                      <span>💳</span>
                      <span>{language === 'ar' ? 'فيزا / بطاقة' : 'Visa'}</span>
                    </button>

                    {/* Wallet Option */}
                    <button
                      type="button"
                      className={expPaymentMethod === 'wallet' ? 'btn-gold' : 'btn-outline-gold'}
                      onClick={() => setExpPaymentMethod('wallet')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        padding: '0.6rem',
                        borderRadius: '10px',
                        borderWidth: '1.5px',
                        fontSize: '0.85rem',
                        fontWeight: 'bold',
                        transition: 'all 0.2s ease',
                        cursor: 'pointer'
                      }}
                    >
                      <span>📱</span>
                      <span>{language === 'ar' ? 'محفظة إلكترونية' : 'E-Wallet'}</span>
                    </button>

                    {/* Instapay Option */}
                    <button
                      type="button"
                      className={expPaymentMethod === 'instapay' ? 'btn-gold' : 'btn-outline-gold'}
                      onClick={() => setExpPaymentMethod('instapay')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        padding: '0.6rem',
                        borderRadius: '10px',
                        borderWidth: '1.5px',
                        fontSize: '0.85rem',
                        fontWeight: 'bold',
                        transition: 'all 0.2s ease',
                        cursor: 'pointer'
                      }}
                    >
                      <span>⚡</span>
                      <span>{language === 'ar' ? 'إنستا باي' : 'Instapay'}</span>
                    </button>

                  </div>
                </div>

              </div>
              <div className="admin-modal-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <button type="button" className="btn-outline-gold" onClick={() => setExpModalOpen(false)}>
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button 
                  type="submit" 
                  className="btn-gold" 
                  disabled={loading}
                  style={{ padding: '0.5rem 1.5rem', borderRadius: '10px' }}
                >
                  {language === 'ar' ? 'حفظ المصروف 💾' : 'Save Expense 💾'}
                </button>
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

      {/* --- SYSTEM USER MODAL --- */}
      {sysUserModalOpen && (
        <div className="admin-modal-overlay" onClick={() => setSysUserModalOpen(false)}>
          <div className="admin-modal" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>{language === 'ar' ? 'إضافة مستخدم جديد' : 'Add New User'}</h2>
              <button className="close-btn" onClick={() => setSysUserModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveSystemUser}>
              <div className="admin-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label>{language === 'ar' ? 'الاسم بالكامل' : 'Full Name'}</label>
                  <input type="text" className="input-gold" value={sysName} onChange={e => setSysName(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>{language === 'ar' ? 'رقم الهاتف' : 'Phone Number'}</label>
                  <input type="text" className="input-gold" value={sysPhone} onChange={e => setSysPhone(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>{language === 'ar' ? 'اسم المستخدم (للدخول)' : 'Username (Login)'}</label>
                  <input type="text" className="input-gold" value={sysUsername} onChange={e => setSysUsername(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>{language === 'ar' ? 'الرمز السري' : 'Passcode'}</label>
                  <input type="password" className="input-gold" value={sysPasscode} onChange={e => setSysPasscode(e.target.value)} required />
                </div>
                <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={sysIsAdmin} onChange={e => setSysIsAdmin(e.target.checked)} />
                    <span style={{ fontWeight: 'bold', color: 'var(--danger)' }}>{language === 'ar' ? 'مدير نظام (صلاحيات كاملة)' : 'System Admin (Full Access)'}</span>
                  </label>
                </div>
                
                {!sysIsAdmin && (
                  <div className="form-group">
                    <label>{language === 'ar' ? 'تخصيص الصلاحيات (اختر المسموح له)' : 'Custom Permissions (Select Allowed)'}</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', background: 'var(--bg-darker)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                      {AVAILABLE_PERMISSIONS.map(perm => (
                        <label key={perm.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                          <input 
                            type="checkbox" 
                            checked={sysPermissions.includes(perm.id)} 
                            onChange={e => {
                              if (e.target.checked) setSysPermissions(prev => [...prev, perm.id]);
                              else setSysPermissions(prev => prev.filter(p => p !== perm.id));
                            }} 
                          />
                          <span style={{ fontSize: '0.85rem' }}>{language === 'ar' ? perm.ar : perm.en}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="admin-modal-footer">
                <button type="button" className="btn-outline-gold" onClick={() => setSysUserModalOpen(false)}>{t.close}</button>
                <button type="submit" className="btn-gold" disabled={loading}>{t.save}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- CRUD DIALOG MODAL FOR WAITERS --- */}
      {waiterModalOpen && (
        <div className="admin-modal-overlay" onClick={() => setWaiterModalOpen(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>{language === 'ar' ? 'إضافة ويتر جديد' : 'Add New Waiter'}</h2>
              <button className="btn-close" onClick={() => setWaiterModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveWaiter}>
              <div className="admin-modal-body">
                <div className="form-group">
                  <label>{language === 'ar' ? 'الاسم' : 'Name'} *</label>
                  <input type="text" className="input-gold" value={waiterName} onChange={(e) => setWaiterName(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>{language === 'ar' ? 'رقم الهاتف' : 'Phone Number'}</label>
                  <input type="text" className="input-gold" value={waiterPhone} onChange={(e) => setWaiterPhone(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>{language === 'ar' ? 'رمز الدخول للـ POS (أرقام فقط)' : 'POS Passcode (Numbers)'} *</label>
                  <input type="text" className="input-gold" value={waiterPasscode} onChange={(e) => setWaiterPasscode(e.target.value)} required />
                </div>
              </div>
              <div className="admin-modal-footer">
                <button type="button" className="btn-outline-gold" onClick={() => setWaiterModalOpen(false)}>{t.close}</button>
                <button type="submit" className="btn-gold" disabled={loading}>{t.save}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- CRUD DIALOG MODAL FOR PRINTERS --- */}
      {printerModalOpen && (
        <div className="admin-modal-overlay" onClick={() => setPrinterModalOpen(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>{language === 'ar' ? 'إضافة طابعة جديدة' : 'Add New Printer'}</h2>
              <button className="btn-close" onClick={() => setPrinterModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSavePrinter}>
              <div className="admin-modal-body">
                <div className="form-group">
                  <label>{language === 'ar' ? 'اسم الطابعة بالعربي' : 'Printer Name (AR)'} *</label>
                  <input type="text" className="input-gold" value={printerNameAr} onChange={(e) => setPrinterNameAr(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>{language === 'ar' ? 'اسم الطابعة بالإنجليزي' : 'Printer Name (EN)'} *</label>
                  <input type="text" className="input-gold" value={printerNameEn} onChange={(e) => setPrinterNameEn(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>{language === 'ar' ? 'القسم' : 'Department'} *</label>
                  <select className="input-gold" value={printerDepartment} onChange={(e) => setPrinterDepartment(e.target.value as 'restaurant'|'bar')} required>
                    <option value="restaurant">{language === 'ar' ? 'مطعم' : 'Restaurant'}</option>
                    <option value="bar">{language === 'ar' ? 'بار' : 'Bar'}</option>
                  </select>
                </div>
              </div>
              <div className="admin-modal-footer">
                <button type="button" className="btn-outline-gold" onClick={() => setPrinterModalOpen(false)}>{t.close}</button>
                <button type="submit" className="btn-gold" disabled={loading}>{t.save}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* --- INVENTORY MODALS --- */}
      {/* 1. Add Supplier */}
      {supModalOpen && (
        <div className="admin-modal-overlay" onClick={() => setSupModalOpen(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>{language === 'ar' ? 'إضافة مورد' : 'Add Supplier'}</h2>
              <button className="btn-close" onClick={() => setSupModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveSupplier}>
              <div className="admin-modal-body">
                <div className="form-group">
                  <label>{language === 'ar' ? 'الاسم' : 'Name'} *</label>
                  <input type="text" className="input-gold" value={supName} onChange={e => setSupName(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>{language === 'ar' ? 'الهاتف' : 'Phone'}</label>
                  <input type="text" className="input-gold" value={supPhone} onChange={e => setSupPhone(e.target.value)} />
                </div>
              </div>
              <div className="admin-modal-footer">
                <button type="button" className="btn-outline-gold" onClick={() => setSupModalOpen(false)}>{t.close}</button>
                <button type="submit" className="btn-gold" disabled={loading}>{t.save}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Add Inventory Item */}
      {invModalOpen && (
        <div className="admin-modal-overlay" onClick={() => setInvModalOpen(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>{language === 'ar' ? 'إضافة صنف/خامة' : 'Add Item'}</h2>
              <button className="btn-close" onClick={() => setInvModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveInventoryItem}>
              <div className="admin-modal-body">
                <div className="form-group">
                  <label>{language === 'ar' ? 'اسم الصنف' : 'Item Name'} *</label>
                  <input type="text" className="input-gold" value={invName} onChange={e => setInvName(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>{language === 'ar' ? 'الوحدة (كجم، لتر، قطعة..)' : 'Unit'}</label>
                  <input type="text" className="input-gold" value={invUnit} onChange={e => setInvUnit(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>{language === 'ar' ? 'الوحدات في الكرتونة (اختياري)' : 'Units per Carton (Optional)'}</label>
                  <input type="number" className="input-gold" min="1" value={invUnitsPerCarton} onChange={e => setInvUnitsPerCarton(e.target.value ? Number(e.target.value) : '')} />
                </div>
                <div className="form-group">
                  <label>{language === 'ar' ? 'الوحدات في العلبة (اختياري)' : 'Units per Box (Optional)'}</label>
                  <input type="number" className="input-gold" min="1" value={invUnitsPerBox} onChange={e => setInvUnitsPerBox(e.target.value ? Number(e.target.value) : '')} />
                </div>
              </div>
              <div className="admin-modal-footer">
                <button type="button" className="btn-outline-gold" onClick={() => setInvModalOpen(false)}>{t.close}</button>
                <button type="submit" className="btn-gold" disabled={loading}>{t.save}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Add Purchase Invoice */}
      {invoiceModalOpen && (
        <div className="admin-modal-overlay" onClick={() => setInvoiceModalOpen(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <div className="admin-modal-header">
              <h2>{language === 'ar' ? 'إضافة فاتورة مشتريات' : 'Add Purchase Invoice'}</h2>
              <button className="btn-close" onClick={() => setInvoiceModalOpen(false)}><X size={20} /></button>
            </div>
            <div className="admin-modal-body">
              <div className="grid-options" style={{ marginBottom: '1.5rem', gap: '1rem', gridTemplateColumns: '1fr 1fr' }}>
                <div className="form-group">
                  <label>{language === 'ar' ? 'المورد' : 'Supplier'} *</label>
                  <select className="input-gold" value={invoiceSupplierId} onChange={e => setInvoiceSupplierId(e.target.value)} required>
                    <option value="">{language === 'ar' ? 'اختر المورد...' : 'Select supplier...'}</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>{language === 'ar' ? 'التاريخ' : 'Date'} *</label>
                  <input type="date" className="input-gold" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} required />
                </div>
              </div>
              
              <div style={{ background: '#222', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                <h3 style={{ marginBottom: '1rem', color: 'var(--gold-primary)' }}>{language === 'ar' ? 'تفاصيل الأصناف' : 'Invoice Items'}</h3>
                
                {/* Add item row */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '0.5rem', marginBottom: '1rem' }}>
                  <select id="inv-new-item" className="input-gold" style={{ padding: '0.5rem' }}>
                    <option value="">{language === 'ar' ? 'اختر الصنف...' : 'Select item...'}</option>
                    {inventoryItems.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                  <input type="number" id="inv-new-qty" className="input-gold" placeholder={language === 'ar' ? 'الكمية' : 'Qty'} style={{ padding: '0.5rem' }} step="0.01" min="0.01" />
                  <input type="number" id="inv-new-price" className="input-gold" placeholder={language === 'ar' ? 'السعر' : 'Price'} style={{ padding: '0.5rem' }} step="0.01" min="0" />
                  <button type="button" className="btn-gold" style={{ padding: '0.5rem 1rem' }} onClick={() => {
                    const idEl = document.getElementById('inv-new-item') as HTMLSelectElement;
                    const qtyEl = document.getElementById('inv-new-qty') as HTMLInputElement;
                    const priceEl = document.getElementById('inv-new-price') as HTMLInputElement;
                    const itemId = idEl.value;
                    const qty = parseFloat(qtyEl.value);
                    const price = parseFloat(priceEl.value);
                    if (itemId && qty > 0 && price >= 0) {
                      setInvoiceCart([...invoiceCart, { item_id: itemId, quantity: qty, unit_price: price }]);
                      idEl.value = ''; qtyEl.value = ''; priceEl.value = '';
                    }
                  }}>
                    <Plus size={16} />
                  </button>
                </div>

                {/* Cart list */}
                {invoiceCart.length > 0 && (
                  <table className="admin-table" style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
                    <thead>
                      <tr>
                        <th>{language === 'ar' ? 'الصنف' : 'Item'}</th>
                        <th>{language === 'ar' ? 'الكمية' : 'Qty'}</th>
                        <th>{language === 'ar' ? 'السعر' : 'Price'}</th>
                        <th>{language === 'ar' ? 'الإجمالي' : 'Total'}</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceCart.map((c, idx) => {
                        const item = inventoryItems.find(i => i.id === c.item_id);
                        return (
                          <tr key={idx}>
                            <td>{item?.name}</td>
                            <td>{c.quantity}</td>
                            <td>{c.unit_price}</td>
                            <td>{(c.quantity * c.unit_price).toFixed(2)}</td>
                            <td>
                              <button type="button" style={{ background: 'transparent', border: 'none', color: '#ff4d4d', cursor: 'pointer' }} onClick={() => setInvoiceCart(invoiceCart.filter((_, i) => i !== idx))}>
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
              <div style={{ textAlign: 'left', marginTop: '1rem' }}>
                <h3>{language === 'ar' ? 'إجمالي الفاتورة: ' : 'Invoice Total: '} <span style={{ color: 'var(--gold-primary)' }}>{invoiceCart.reduce((sum, c) => sum + (c.quantity * c.unit_price), 0).toFixed(2)}</span></h3>
              </div>
            </div>
            <div className="admin-modal-footer">
              <button type="button" className="btn-outline-gold" onClick={() => setInvoiceModalOpen(false)}>{t.close}</button>
              <button type="button" className="btn-gold" onClick={handleSavePurchaseInvoice} disabled={loading || invoiceCart.length === 0}>{t.save}</button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Add Manufacturing Order */}
      {mfgModalOpen && (
        <div className="admin-modal-overlay" onClick={() => setMfgModalOpen(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <div className="admin-modal-header">
              <h2>{language === 'ar' ? 'طلب صرف خامات (للتصنيع)' : 'Request Materials (Manufacturing)'}</h2>
              <button className="btn-close" onClick={() => setMfgModalOpen(false)}><X size={20} /></button>
            </div>
            <div className="admin-modal-body">
              <div style={{ background: '#222', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                <h3 style={{ marginBottom: '1rem', color: 'var(--gold-primary)' }}>{language === 'ar' ? 'تفاصيل الأصناف' : 'Order Items'}</h3>
                
                {/* Add item row */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '0.5rem', marginBottom: '1rem' }}>
                  <select id="mfg-new-item" className="input-gold" style={{ padding: '0.5rem' }}>
                    <option value="">{language === 'ar' ? 'اختر الصنف/الخامة...' : 'Select item...'}</option>
                    {inventoryItems.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                  <input type="number" id="mfg-new-qty" className="input-gold" placeholder={language === 'ar' ? 'الكمية' : 'Qty'} style={{ padding: '0.5rem' }} step="0.01" min="0.01" />
                  <select id="mfg-new-unit" className="input-gold" style={{ padding: '0.5rem' }}>
                    <option value="kilo">{language === 'ar' ? 'كجم' : 'KG'}</option>
                    <option value="gram">{language === 'ar' ? 'جرام' : 'Gram'}</option>
                    <option value="piece">{language === 'ar' ? 'قطعة' : 'Piece'}</option>
                    <option value="carton">{language === 'ar' ? 'كرتونة' : 'Carton'}</option>
                    <option value="box">{language === 'ar' ? 'علبة' : 'Box'}</option>
                  </select>
                  <button type="button" className="btn-gold" style={{ padding: '0.5rem 1rem' }} onClick={() => {
                    const idEl = document.getElementById('mfg-new-item') as HTMLSelectElement;
                    const qtyEl = document.getElementById('mfg-new-qty') as HTMLInputElement;
                    const unitEl = document.getElementById('mfg-new-unit') as HTMLSelectElement;
                    const itemId = idEl.value;
                    const qty = parseFloat(qtyEl.value);
                    const unit = unitEl.value as 'kilo'|'gram'|'piece'|'carton'|'box';
                    if (itemId && qty > 0) {
                      setMfgCart([...mfgCart, { item_id: itemId, item_name: inventoryItems.find(i=>i.id===itemId)?.name || '', quantity: qty, unit, calculated_main_quantity: 0 }]);
                      idEl.value = ''; qtyEl.value = ''; unitEl.value = 'kilo';
                    }
                  }}>
                    <Plus size={16} />
                  </button>
                </div>

                {/* Cart list */}
                {mfgCart.length > 0 && (
                  <table className="admin-table" style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
                    <thead>
                      <tr>
                        <th>{language === 'ar' ? 'الصنف' : 'Item'}</th>
                        <th>{language === 'ar' ? 'الكمية' : 'Qty'}</th>
                        <th>{language === 'ar' ? 'الوحدة' : 'Unit'}</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {mfgCart.map((c, idx) => (
                        <tr key={idx}>
                          <td>{c.item_name}</td>
                          <td>{c.quantity}</td>
                          <td>{language === 'ar' && c.unit === 'kilo' ? 'كجم' : c.unit === 'gram' ? 'جرام' : c.unit === 'carton' ? 'كرتونة' : c.unit === 'box' ? 'علبة' : c.unit}</td>
                          <td>
                            <button type="button" style={{ background: 'transparent', border: 'none', color: '#ff4d4d', cursor: 'pointer' }} onClick={() => setMfgCart(mfgCart.filter((_, i) => i !== idx))}>
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
            <div className="admin-modal-footer">
              <button type="button" className="btn-outline-gold" onClick={() => setMfgModalOpen(false)}>{t.close}</button>
              <button type="button" className="btn-gold" onClick={handleSaveManufacturingOrder} disabled={loading || mfgCart.length === 0}>{t.save}</button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Production Modal */}
      {productionModalOpen && (
        <div className="admin-modal-overlay" onClick={() => setProductionModalOpen(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <div className="admin-modal-header">
              <h2>{language === 'ar' ? 'تسجيل إنتاج جديد (تحويل لتوزيع)' : 'Record New Production'}</h2>
              <button className="btn-close" onClick={() => setProductionModalOpen(false)}><X size={20} /></button>
            </div>
            <div className="admin-modal-body">
              
              <div style={{ background: '#222', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                <h3 style={{ marginBottom: '1rem', color: 'var(--success)' }}>{language === 'ar' ? 'المنتج الجاهز (سيتم إضافته للتوزيع)' : 'Produced Item (To Distribution)'}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.5rem' }}>
                  <select 
                    className="input-gold" 
                    style={{ padding: '0.5rem' }} 
                    value={producedItemId} 
                    onChange={e => setProducedItemId(e.target.value)}
                  >
                    <option value="">{language === 'ar' ? 'اختر المنتج...' : 'Select produced item...'}</option>
                    {inventoryItems.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                  <input 
                    type="number" 
                    className="input-gold" 
                    placeholder={language === 'ar' ? 'الكمية المنتجة' : 'Produced Qty'} 
                    style={{ padding: '0.5rem' }} 
                    step="0.01" 
                    min="0.01"
                    value={producedQuantity}
                    onChange={e => setProducedQuantity(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div style={{ background: '#222', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                <h3 style={{ marginBottom: '1rem', color: 'var(--danger)' }}>{language === 'ar' ? 'الخامات المستهلكة (سيتم خصمها من المصنع)' : 'Consumed Raw Materials (From Factory)'}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '0.5rem', marginBottom: '1rem' }}>
                  <select id="prod-consumed-item" className="input-gold" style={{ padding: '0.5rem' }}>
                    <option value="">{language === 'ar' ? 'اختر الخامة...' : 'Select raw material...'}</option>
                    {inventoryItems.map(i => <option key={i.id} value={i.id}>{i.name} ({i.stock_factory} {language === 'ar' ? 'بالمصنع' : 'in factory'})</option>)}
                  </select>
                  <input type="number" id="prod-consumed-qty" className="input-gold" placeholder={language === 'ar' ? 'الكمية المستهلكة' : 'Consumed Qty'} style={{ padding: '0.5rem' }} step="0.01" min="0.01" />
                  <button type="button" className="btn-gold" style={{ padding: '0.5rem 1rem' }} onClick={() => {
                    const idEl = document.getElementById('prod-consumed-item') as HTMLSelectElement;
                    const qtyEl = document.getElementById('prod-consumed-qty') as HTMLInputElement;
                    const itemId = idEl.value;
                    const qty = parseFloat(qtyEl.value);
                    if (itemId && qty > 0) {
                      setConsumedItems([...consumedItems, { item_id: itemId, quantity: qty }]);
                      idEl.value = ''; qtyEl.value = '';
                    }
                  }}>
                    <Plus size={16} />
                  </button>
                </div>

                {consumedItems.length > 0 && (
                  <table className="admin-table" style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
                    <thead>
                      <tr>
                        <th>{language === 'ar' ? 'الخامة' : 'Item'}</th>
                        <th>{language === 'ar' ? 'الكمية المخصومة' : 'Deducted Qty'}</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {consumedItems.map((c, idx) => (
                        <tr key={idx}>
                          <td>{inventoryItems.find(i => i.id === c.item_id)?.name}</td>
                          <td>{c.quantity}</td>
                          <td>
                            <button type="button" style={{ background: 'transparent', border: 'none', color: '#ff4d4d', cursor: 'pointer' }} onClick={() => setConsumedItems(consumedItems.filter((_, i) => i !== idx))}>
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

            </div>
            <div className="admin-modal-footer">
              <button type="button" className="btn-outline-gold" onClick={() => setProductionModalOpen(false)}>{t.close}</button>
              <button type="button" className="btn-gold" onClick={handleSaveProductionLog} disabled={loading || !producedItemId || producedQuantity <= 0 || consumedItems.length === 0}>{t.save}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

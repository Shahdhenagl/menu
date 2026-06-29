import { useState, useEffect, useRef } from 'react';
import type { Category, Product, Order, RestaurantSettings, OrderItem, Expense, PromoCodeDetails, SystemUser, RecipeComment, Printer, Supplier, InventoryItem, PurchaseInvoice, ManufacturingOrder, SystemNotification, ProductionLog, ProductRecipe, Customer, Employee, AttendanceLog, EmployeeTransaction, TransferRequest, DistributionProduct, InventoryMovement } from '../types';
import { db, supabase } from '../lib/supabase';
import { warehouseHoldsItem, warehouseValue, warehouseStock } from '../lib/warehouse';
import { printOrderTickets, printCustomerReceipt } from '../utils/printUtils';
import * as XLSX from 'xlsx';

const getLocalDayStr = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getLocalMonthStr = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

import {
  BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, Cell, AreaChart, Area 
} from 'recharts';
import {
  Loader,
  Plus, Edit, Trash2, X, PlusCircle, Save, LogOut, Lock, 
  LayoutDashboard, FolderOpen, Coffee, Users, Settings as Gear, Calendar, Sparkles,
  Upload, Printer as PrinterIcon, Sun, Moon, Search, MonitorSmartphone, Package, Bell, CheckCircle, Eye,
  UserCheck, DollarSign, WalletCards, TrendingDown, Download, ChevronDown
} from 'lucide-react';
import { playClickSound, playNewOrderSound } from '../utils/audioUtils';
import FinancialsView from './FinancialsView';
import PartnersView from './PartnersView';
import InventoryReportView from './InventoryReportView';

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

type TabType = 'analytics' | 'financials' | 'categories' | 'products' | 'orders' | 'customers' | 'debts' | 'invoices' | 'expenses' | 'settings' | 'recipes' | 'system_users' | 'waiters' | 'printers' | 'inventory' | 'inventory_report' | 'factory' | 'employees' | 'attendance' | 'partners';

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
  // OTP States
  const [otpCode, setOtpCode] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [otpAction, setOtpAction] = useState<(() => Promise<void>) | null>(null);
  const [otpActionName, setOtpActionName] = useState('');

  const triggerOtpProtectedAction = async (actionName: string, actionNameEn: string, action: () => Promise<void>, orderIdForLog?: string) => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setOtpCode(code);
    setOtpInput('');
    setOtpActionName(language === 'ar' ? actionName : actionNameEn);
    setOtpAction(() => action);
    setOtpModalOpen(true);

    const token = settings?.telegram_bot_token || '8722542358:AAF_2J1eM-WB2IiwLuRkYU29A8pvWd3DtTw';
    const chatId = settings?.telegram_chat_id || '5507184715,7441837470';

    const text = `🔑 <b>رمز التحقق (OTP) لإجراء حساس (المدير)</b>\n\n` +
      `• <b>الإجراء:</b> ${language === 'ar' ? actionName : actionNameEn}\n` +
      `• <b>المسؤول:</b> مدير النظام\n` +
      `• <b>الطلب:</b> <code>#${orderIdForLog ? orderIdForLog.slice(0, 6) : 'N/A'}</code>\n\n` +
      `• <b>رمز OTP:</b> <code>${code}</code>`;
    
    import('../utils/telegramUtils').then(({ sendTelegramMessage }) => {
      sendTelegramMessage(token, chatId, text);
    });
  };

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
  const [openNavGroups, setOpenNavGroups] = useState<string[]>([]);
  const [financialsDateFilter, setFinancialsDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('today');

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
  const [recipeItemQty, setRecipeItemQty] = useState<string | number>('');
  const [recipeItemUnitMode, setRecipeItemUnitMode] = useState<'base' | 'sub'>('base');

  // Products filtering
  const [adminProdSearch, setAdminProdSearch] = useState('');
  const [adminProdCatFilter, setAdminProdCatFilter] = useState('all');
  const [adminProdDeptFilter, setAdminProdDeptFilter] = useState('all');

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
  const [telegramBotToken, setTelegramBotToken] = useState(settings.telegram_bot_token || '');
  const [telegramChatId, setTelegramChatId] = useState(settings.telegram_chat_id || '');

  const getSubUnitLabel = (baseUnit: string) => {
    if (!baseUnit) return null;
    const u = baseUnit.toLowerCase().trim();
    if (['كجم', 'كغ', 'kg', 'kilo'].includes(u)) return language === 'ar' ? 'جرام' : 'Gram';
    if (['لتر', 'liter', 'l'].includes(u)) return language === 'ar' ? 'ملي' : 'ML';
    if (['جرام', 'gram', 'g'].includes(u)) return language === 'ar' ? 'كجم' : 'Kg';
    if (['ملي', 'ml'].includes(u)) return language === 'ar' ? 'لتر' : 'Liter';
    return null;
  };

  const computeFinalQty = (qty: number, mode: 'base' | 'sub', baseUnit: string) => {
    if (mode === 'base') return qty;
    const u = baseUnit?.toLowerCase().trim() || '';
    if (['كجم', 'كغ', 'kg', 'kilo', 'لتر', 'liter', 'l'].includes(u)) return qty / 1000;
    if (['جرام', 'gram', 'g', 'ملي', 'ml'].includes(u)) return qty * 1000;
    return qty;
  };


  // --- DEBT CUSTOMERS STATE ---
  const [debtCustomers, setDebtCustomers] = useState<Customer[]>([]);
  
  const [showDebtSettleModal, setShowDebtSettleModal] = useState<string | null>(null);
  const [debtSettleMethods, setDebtSettleMethods] = useState({ cash: '', visa: '', wallet: '', instapay: '' });
  const [isSettlingDebt, setIsSettlingDebt] = useState(false);

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
  const [selectedFilterDay, setSelectedFilterDay] = useState<string>(() => getLocalDayStr());
  const [selectedFilterMonth, setSelectedFilterMonth] = useState<string>(() => getLocalMonthStr()); // YYYY-MM
  const [selectedFilterYear, setSelectedFilterYear] = useState<number>(() => new Date().getFullYear());

  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [manualCustName, setManualCustName] = useState('');
  const [manualCustPhone, setManualCustPhone] = useState('');
  const [manualTableNum, setManualTableNum] = useState('');
  const [manualStatus, setManualStatus] = useState<'pending' | 'preparing' | 'delivered' | 'completed' | 'cancelled'>('preparing');
  const [manualItems, setManualItems] = useState<Record<string, number>>({}); // productId -> quantity

  // Invoice filter states
  const [invFilterType, setInvFilterType] = useState<'all' | 'day' | 'month' | 'year'>('all');
  const [invFilterDay, setInvFilterDay] = useState<string>(() => getLocalDayStr());
  const [invFilterMonth, setInvFilterMonth] = useState<string>(() => getLocalMonthStr());
  const [invFilterYear, setInvFilterYear] = useState<number>(() => new Date().getFullYear());
  const [invOrderTypeFilter, setInvOrderTypeFilter] = useState<'all' | 'takeaway' | 'talabat' | 'dine_in' | 'delivery'>('all');
  const [invPaymentFilter, setInvPaymentFilter] = useState<string>('all');
  const [invSearchQuery, setInvSearchQuery] = useState('');

  const previousPendingCount = useRef(0);

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('button') || target.closest('.admin-btn')) {
        playClickSound();
      }
    };
    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, []);

  useEffect(() => {
    const currentPending = orders.filter(o => o.status === 'pending').length;
    if (currentPending > previousPendingCount.current) {
      playNewOrderSound();
    }
    previousPendingCount.current = currentPending;
  }, [orders]);

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
  const [customExpType, setCustomExpType] = useState('');
  const [expAmount, setExpAmount] = useState(0);
  const [expDate, setExpDate] = useState(() => getLocalDayStr());
  const [expPaymentMethod, setExpPaymentMethod] = useState<'cash' | 'visa' | 'wallet' | 'instapay'>('cash');
  
  // Expenses filtering states
  const [expFilterType, setExpFilterType] = useState<'all' | 'day' | 'month' | 'year'>('all');
  const [expFilterDay, setExpFilterDay] = useState<string>(() => getLocalDayStr());
  const [expFilterMonth, setExpFilterMonth] = useState<string>(() => getLocalMonthStr());
  const [expFilterYear, setExpFilterYear] = useState<number>(() => new Date().getFullYear());

  // --- FINANCIAL TRANSACTIONS STATE ---
  const [financialTransactions, setFinancialTransactions] = useState<any[]>([]);
  const fetchFinancialTransactions = async () => {
    try {
      const txs = await db.getFinancialTransactions();
      setFinancialTransactions(txs);
    } catch (err) {
      console.error(err);
    }
  };

  // Analytics filtering states
  const [analyticsFilterType, setAnalyticsFilterType] = useState<'all' | 'day' | 'month' | 'year'>('all');
  const [analyticsFilterDay, setAnalyticsFilterDay] = useState<string>(() => getLocalDayStr());
  const [analyticsFilterMonth, setAnalyticsFilterMonth] = useState<string>(() => getLocalMonthStr());
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

  // --- EMPLOYEE MODULE STATES ---
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([]);
  const [employeeTransactions, setEmployeeTransactions] = useState<EmployeeTransaction[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  
  // Modals & Inputs
  const [empModalOpen, setEmpModalOpen] = useState(false);
  const [empName, setEmpName] = useState('');
  const [empPhone, setEmpPhone] = useState('');
  const [empSalary, setEmpSalary] = useState<number | ''>('');
  const [empAllowedVacations, setEmpAllowedVacations] = useState<number>(4);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [empWorkingHours, setEmpWorkingHours] = useState<number | ''>(9);

  // Transaction Inputs
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txType, setTxType] = useState<'advance' | 'bonus' | 'discount' | 'vacation_paid' | 'vacation_unpaid'>('advance');
  const [txAmount, setTxAmount] = useState<number | ''>('');
  const [txNotes, setTxNotes] = useState('');

  // Filters
  const [empSearchQuery, setEmpSearchQuery] = useState('');
  const [attSearchQuery, setAttSearchQuery] = useState('');
  const [attDateFilter, setAttDateFilter] = useState(() => getLocalDayStr());
  const [selectedProfileMonth, setSelectedProfileMonth] = useState(() => getLocalMonthStr());

  // --- SYSTEM USERS MODULE STATES ---
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
  const [sysUserModalOpen, setSysUserModalOpen] = useState(false);
  const [sysName, setSysName] = useState('');
  const [sysPhone, setSysPhone] = useState('');
  const [sysUsername, setSysUsername] = useState('');
  const [sysPasscode, setSysPasscode] = useState('');
  const [sysJobTitle, setSysJobTitle] = useState('');
  const [sysIsAdmin, setSysIsAdmin] = useState(false);
  const [sysPermissions, setSysPermissions] = useState<string[]>(['orders']);

  const AVAILABLE_PERMISSIONS = [
    { id: 'analytics', ar: 'نظرة عامة والتحليلات', en: 'Overview & Analytics' },
    { id: 'financials', ar: 'المعاملات المالية', en: 'Financial Transactions' },
    { id: 'partners', ar: 'العهد والشركاء', en: 'Partners & Custody' },
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
    { id: 'kitchen_manager', ar: 'مسؤول المطبخ / التصنيع', en: 'Kitchen Manager' },
    { id: 'employees', ar: 'إدارة الموظفين والرواتب', en: 'Employees & Payroll' },
    { id: 'attendance', ar: 'سجل الحضور والانصراف اليومي', en: 'Daily Attendance Logs' }
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

  const fetchEmployees = async () => {
    try {
      const data = await db.getEmployees();
      setEmployees(data);
    } catch (err) {
      console.error("Error loading employees:", err);
    }
  };

  const fetchAttendanceLogs = async () => {
    try {
      const data = await db.getAttendanceLogs();
      setAttendanceLogs(data);
    } catch (err) {
      console.error("Error loading attendance:", err);
    }
  };

  const fetchEmployeeTransactions = async () => {
    try {
      const data = await db.getEmployeeTransactions();
      setEmployeeTransactions(data);
    } catch (err) {
      console.error("Error loading employee transactions:", err);
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
        role: sysIsAdmin ? 'admin' : sysPermissions.join(','),
        job_title: sysJobTitle.trim() || undefined
      });
      await fetchSystemUsers();
      setSysUserModalOpen(false);
      setSysName('');
      setSysPhone('');
      setSysUsername('');
      setSysPasscode('');
      setSysJobTitle('');
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
  const [factorySubTab, setFactorySubTab] = useState<'mfg_requests' | 'production' | 'transfer_requests' | 'distribution' | 'kitchen_stock'>('mfg_requests');
  const [kitchenSearch, setKitchenSearch] = useState('');
  const [productionLogs, setProductionLogs] = useState<ProductionLog[]>([]);
  const [inventoryMovements, setInventoryMovements] = useState<InventoryMovement[]>([]);
  const [producedItemId, setProducedItemId] = useState('');
  const [producedQuantity, setProducedQuantity] = useState(1);
  const [consumedItems, setConsumedItems] = useState<{item_id: string, quantity: number}[]>([]);
  const [productionModalOpen, setProductionModalOpen] = useState(false);
  // "تصنيع الآن" من كتالوج التوزيع
  const [mfgNowOpen, setMfgNowOpen] = useState(false);
  const [mfgNowItem, setMfgNowItem] = useState<InventoryItem | null>(null);
  const [mfgNowQty, setMfgNowQty] = useState<number>(1);
  const [mfgNowRecipe, setMfgNowRecipe] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState<PurchaseInvoice[]>([]);
  
  // Suppliers modal
  const [supModalOpen, setSupModalOpen] = useState(false);
  const [supName, setSupName] = useState('');
  const [supPhone, setSupPhone] = useState('');

  // Inventory Item modal
  const [invModalOpen, setInvModalOpen] = useState(false);
  const [editingInvItem, setEditingInvItem] = useState<InventoryItem | null>(null);
  const [invName, setInvName] = useState('');
  const [invUnit, setInvUnit] = useState('كجم');
  const [invUnitsPerCarton, setInvUnitsPerCarton] = useState<number | ''>('');
  const [invUnitsPerBox, setInvUnitsPerBox] = useState<number | ''>('');
  const [invLowStockThreshold, setInvLowStockThreshold] = useState<number | ''>('');
  const [invTargetType, setInvTargetType] = useState<'raw' | 'manufactured'>('raw');
  const [invRecipes, setInvRecipes] = useState<any[]>([]);
  const [invRecipeSelIngredient, setInvRecipeSelIngredient] = useState('');
  const [invRecipeSelQuantity, setInvRecipeSelQuantity] = useState<string | number>('');
  const [invRecipeSelUnitMode, setInvRecipeSelUnitMode] = useState<'base' | 'sub'>('base');
  
  // Manufacturing Recipe (BOM) modal
  const [mfgRecipeModalOpen, setMfgRecipeModalOpen] = useState(false);
  const [activeMfgItem, setActiveMfgItem] = useState<InventoryItem | null>(null);
  const [activeMfgRecipes, setActiveMfgRecipes] = useState<any[]>([]);
  const [mfgSelIngredient, setMfgSelIngredient] = useState('');
  const [mfgSelQuantity, setMfgSelQuantity] = useState<string | number>('');
  const [mfgSelUnitMode, setMfgSelUnitMode] = useState<'base' | 'sub'>('base');
  
  const [inventoryWarehouseFilter, setInventoryWarehouseFilter] = useState<'main' | 'factory' | 'distribution'>('main');
  const [inventoryLowStockFilter, setInventoryLowStockFilter] = useState(false);
  const [editStockModalOpen, setEditStockModalOpen] = useState(false);
  const [editStockItem, setEditStockItem] = useState<InventoryItem | null>(null);
  const [editStockAdjustment, setEditStockAdjustment] = useState<number>(0);

  // Purchase Invoice modal
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoiceSupplierId, setInvoiceSupplierId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(() => getLocalDayStr());
  const [invoiceCart, setInvoiceCart] = useState<{item_id: string, quantity: number, unit_price: number}[]>([]);
  // صف إضافة صنف (بحث بالاسم)
  const [invItemSearch, setInvItemSearch] = useState('');
  const [invNewItemId, setInvNewItemId] = useState('');
  const [invNewQty, setInvNewQty] = useState('');
  const [invNewPrice, setInvNewPrice] = useState('');
  const [invShowSuggest, setInvShowSuggest] = useState(false);
  const [invoicePaidCash, setInvoicePaidCash] = useState<number | ''>('');
  const [invoicePaidVisa, setInvoicePaidVisa] = useState<number | ''>('');
  const [invoicePaidWallet, setInvoicePaidWallet] = useState<number | ''>('');
  const [invoicePaidInstapay, setInvoicePaidInstapay] = useState<number | ''>('');

  // Supplier Profile and Debt states
  const [selectedSupplierProfile, setSelectedSupplierProfile] = useState<Supplier | null>(null);
  const [payDebtModalOpen, setPayDebtModalOpen] = useState(false);
  const [selectedInvoiceToPay, setSelectedInvoiceToPay] = useState<PurchaseInvoice | null>(null);
  const [payAmount, setPayAmount] = useState<number | ''>('');
  const [payMethod, setPayMethod] = useState<'cash' | 'visa' | 'wallet' | 'instapay'>('cash');


  // Phase 2: Manufacturing Orders & Notifications
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  
  const [manufacturingOrders, setManufacturingOrders] = useState<ManufacturingOrder[]>([]);
  const [mfgModalOpen, setMfgModalOpen] = useState(false);
  const [mfgCart, setMfgCart] = useState<{item_id: string, item_name: string, quantity: number, unit: string, calculated_main_quantity: number}[]>([]);
  const [mfgNewItemId, setMfgNewItemId] = useState('');
  const [mfgItemSearch, setMfgItemSearch] = useState('');
  const [mfgShowSuggest, setMfgShowSuggest] = useState(false);

  // Transfer Requests (Kitchen → Distribution)
  const [transferRequests, setTransferRequests] = useState<TransferRequest[]>([]);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferCart, setTransferCart] = useState<{item_id: string, item_name: string, quantity: number, unit: string}[]>([]);
  const [transferNotes, setTransferNotes] = useState('');

  // Distribution Products Catalog
  const [distributionProducts, setDistributionProducts] = useState<DistributionProduct[]>([]);
  const [distProdModalOpen, setDistProdModalOpen] = useState(false);
  const [distProdEditId, setDistProdEditId] = useState<string | null>(null);
  const [distProdName, setDistProdName] = useState('');
  const [distProdUnit, setDistProdUnit] = useState('كجم');
  const [distProdCategory, setDistProdCategory] = useState('');
  const [distProdStock, setDistProdStock] = useState<number | ''>('');
  const [distProdPrice, setDistProdPrice] = useState<number | ''>('');
  const [distProdNotes, setDistProdNotes] = useState('');

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
      const transferReqs = await db.getTransferRequests();
      const distProds = await db.getDistributionProducts();
      const movements = await db.getInventoryMovements();
      setTransferRequests(transferReqs);
      setDistributionProducts(distProds);
      setInventoryMovements(movements);
      
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
    
    if (supabase) {
      const channel = supabase.channel('realtime_admin_requests')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'manufacturing_orders' }, () => {
          setTimeout(() => {
            alert(language === 'ar' ? '⚠️ إشعار: طلب صرف خامات جديد من المطبخ!' : '⚠️ Alert: New raw material request from Kitchen!');
          }, 500);
          fetchInventoryData();
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transfer_requests' }, () => {
          fetchInventoryData();
        })
        .subscribe();
      return () => {
        supabase?.removeChannel(channel);
      };
    }
  }, [loggedInUser, language]);

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

  const handlePayDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceToPay || !payAmount) return;
    const amountToPay = Number(payAmount) || 0;
    if (amountToPay <= 0) {
      alert(language === 'ar' ? 'يرجى إدخال مبلغ صحيح' : 'Please enter a valid amount');
      return;
    }
    const currentRemaining = selectedInvoiceToPay.remaining_amount ?? selectedInvoiceToPay.total_amount;
    if (amountToPay > currentRemaining) {
      alert(language === 'ar' ? 'المبلغ المدفوع أكبر من المتبقي!' : 'Paid amount cannot exceed remaining amount!');
      return;
    }

    setLoading(true);
    try {
      const updates: Partial<PurchaseInvoice> = {};
      if (payMethod === 'cash') {
        updates.paid_cash = (selectedInvoiceToPay.paid_cash ?? 0) + amountToPay;
      } else if (payMethod === 'visa') {
        updates.paid_visa = (selectedInvoiceToPay.paid_visa ?? 0) + amountToPay;
      } else if (payMethod === 'wallet') {
        updates.paid_wallet = (selectedInvoiceToPay.paid_wallet ?? 0) + amountToPay;
      } else if (payMethod === 'instapay') {
        updates.paid_instapay = (selectedInvoiceToPay.paid_instapay ?? 0) + amountToPay;
      }
      updates.remaining_amount = currentRemaining - amountToPay;

      const updatedInvoice = await db.updatePurchaseInvoice(selectedInvoiceToPay.id!, updates);
      
      await fetchInventoryData();
      setSelectedInvoiceToPay(updatedInvoice);
      setPayDebtModalOpen(false);
      setPayAmount('');
      
      if (selectedSupplierProfile) {
        const latestSups = await db.getSuppliers();
        const latestSup = latestSups.find(s => s.id === selectedSupplierProfile.id);
        if (latestSup) setSelectedSupplierProfile(latestSup);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to save payment");
    } finally {
      setLoading(false);
    }
  };


  const handleSaveInventoryItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invName.trim()) return;
    setLoading(true);
    try {
      let savedItemId = '';
      if (editingInvItem) {
        await db.updateInventoryItem(editingInvItem.id, {
          name: invName,
          unit: invUnit,
          units_per_carton: invUnitsPerCarton ? Number(invUnitsPerCarton) : undefined,
          units_per_box: invUnitsPerBox ? Number(invUnitsPerBox) : undefined,
          low_stock_threshold: invLowStockThreshold ? Number(invLowStockThreshold) : undefined,
          is_manufactured: invTargetType === 'manufactured'
        });
        savedItemId = editingInvItem.id;
      } else {
        const newItem = await db.addInventoryItem({
          name: invName,
          unit: invUnit,
          stock_main: 0,
          stock_factory: 0,
          stock_distribution: 0,
          avg_purchase_price: 0,
          last_purchase_price: 0,
          units_per_carton: invUnitsPerCarton ? Number(invUnitsPerCarton) : undefined,
          units_per_box: invUnitsPerBox ? Number(invUnitsPerBox) : undefined,
          low_stock_threshold: invLowStockThreshold ? Number(invLowStockThreshold) : undefined,
          is_manufactured: invTargetType === 'manufactured'
        });
        savedItemId = newItem?.id || '';
      }
      
      if (savedItemId && invTargetType === 'manufactured') {
        await db.saveManufacturingRecipe(savedItemId, invRecipes);
      } else if (savedItemId && invTargetType === 'raw') {
        await db.saveManufacturingRecipe(savedItemId, []);
      }
      
      await fetchInventoryData();
      setInvModalOpen(false);
      setEditingInvItem(null);
      setInvName('');
      setInvUnit('كجم');
      setInvUnitsPerCarton('');
      setInvUnitsPerBox('');
      setInvLowStockThreshold('');
      setInvTargetType('raw');
      setInvRecipes([]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStockItem || editStockAdjustment === 0) return;
    setLoading(true);
    try {
      // Current stock based on selected warehouse
      let currentStock = 0;
      if (inventoryWarehouseFilter === 'main') currentStock = editStockItem.stock_main || 0;
      if (inventoryWarehouseFilter === 'factory') currentStock = editStockItem.stock_factory || 0;
      if (inventoryWarehouseFilter === 'distribution') currentStock = editStockItem.stock_distribution || 0;

      const newStock = Math.max(0, currentStock + editStockAdjustment);
      const updateData: Partial<InventoryItem> = {};
      if (inventoryWarehouseFilter === 'main') updateData.stock_main = newStock;
      if (inventoryWarehouseFilter === 'factory') updateData.stock_factory = newStock;
      if (inventoryWarehouseFilter === 'distribution') updateData.stock_distribution = newStock;

      if ((window as any).supabase) {
        await (window as any).supabase.from('inventory_items').update(updateData).eq('id', editStockItem.id);
      }
      
      const type = editStockAdjustment > 0 ? 'adjustment' : 'waste';
      await db.addInventoryMovement({
        item_id: editStockItem.id,
        warehouse: inventoryWarehouseFilter,
        type: type as any,
        quantity: Math.abs(editStockAdjustment),
        unit_price: editStockItem.avg_purchase_price || 0,
        total_price: (editStockItem.avg_purchase_price || 0) * Math.abs(editStockAdjustment),
        description: `تسوية جردية (${editStockAdjustment > 0 ? 'إضافة' : 'خصم'})`
      });

      // Update local state
      const updatedItems = inventoryItems.map(item => item.id === editStockItem.id ? { ...item, ...updateData } : item);
      setInventoryItems(updatedItems);
      // We rely on fetchInventoryData to refresh perfectly, but local is good for immediate UI feedback.
      await fetchInventoryData();
      
      setEditStockModalOpen(false);
      setEditStockItem(null);
      setEditStockAdjustment(0);
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

  // الصنف الجاهز في صف الإضافة (لو مكتمل) — يُستخدم للإضافة وللحفظ التلقائي
  const buildPendingInvoiceItem = () => {
    const qty = parseFloat(invNewQty);
    const price = parseFloat(invNewPrice);
    if (invNewItemId && qty > 0 && !isNaN(price) && price >= 0) {
      return { item_id: invNewItemId, quantity: qty, unit_price: price };
    }
    return null;
  };

  const addInvoiceItemToCart = () => {
    const pending = buildPendingInvoiceItem();
    if (!pending) {
      alert(language === 'ar' ? 'اختر صنفاً وأدخل كمية وسعراً صحيحين أولاً' : 'Select an item and enter a valid quantity and price first');
      return;
    }
    setInvoiceCart(prev => [...prev, pending]);
    setInvNewItemId(''); setInvItemSearch(''); setInvNewQty(''); setInvNewPrice(''); setInvShowSuggest(false);
  };

  const handleSavePurchaseInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    // لو فيه صنف مكتمل في صف الإضافة بس المستخدم نسي يضغط +، نضيفه تلقائياً
    const pending = buildPendingInvoiceItem();
    const cart = pending ? [...invoiceCart, pending] : invoiceCart;
    if (!invoiceSupplierId) {
      alert(language === 'ar' ? 'اختر المورد أولاً' : 'Please select a supplier first.');
      return;
    }
    if (cart.length === 0) {
      alert(language === 'ar' ? 'أضف صنفاً واحداً على الأقل للفاتورة' : 'Add at least one item to the invoice.');
      return;
    }
    setLoading(true);
    try {
      const sup = suppliers.find(s => s.id === invoiceSupplierId);
      let total = 0;
      const itemsToSave = cart.map(c => {
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

      const paidCash = Number(invoicePaidCash) || 0;
      const paidVisa = Number(invoicePaidVisa) || 0;
      const paidWallet = Number(invoicePaidWallet) || 0;
      const paidInstapay = Number(invoicePaidInstapay) || 0;
      const remaining = Math.max(0, total - (paidCash + paidVisa + paidWallet + paidInstapay));

      await db.addPurchaseInvoice({
        supplier_id: invoiceSupplierId,
        supplier_name: sup ? sup.name : 'Unknown',
        invoice_date: invoiceDate,
        items: itemsToSave,
        total_amount: total,
        paid_cash: paidCash,
        paid_visa: paidVisa,
        paid_wallet: paidWallet,
        paid_instapay: paidInstapay,
        remaining_amount: remaining
      });
      
      await fetchInventoryData();
      setInvoiceModalOpen(false);
      setInvoiceCart([]);
      setInvoiceSupplierId('');
      setInvNewItemId(''); setInvItemSearch(''); setInvNewQty(''); setInvNewPrice(''); setInvShowSuggest(false);
      setInvoicePaidCash('');
      setInvoicePaidVisa('');
      setInvoicePaidWallet('');
      setInvoicePaidInstapay('');
      alert(language === 'ar' ? '✅ تم حفظ الفاتورة بنجاح' : '✅ Invoice saved successfully');
    } catch (err) {
      console.error(err);
      alert((language === 'ar' ? '❌ تعذّر حفظ الفاتورة: ' : '❌ Failed to save invoice: ') + ((err as any)?.message || err));
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
      setMfgNewItemId(''); setMfgItemSearch(''); setMfgShowSuggest(false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // فتح نافذة "تصنيع الآن" لمنتج مصنّع وتحميل وصفته
  const openManufactureNow = async (item: InventoryItem) => {
    setMfgNowItem(item);
    setMfgNowQty(1);
    setMfgNowOpen(true);
    try {
      const recipe = await db.getManufacturingRecipes(item.id);
      setMfgNowRecipe(recipe);
    } catch (err) {
      console.error(err);
      setMfgNowRecipe([]);
    }
  };

  // حساب المكوّنات المطلوبة مقابل المتاح في المطبخ
  const computeMfgNowReqs = () => mfgNowRecipe.map(r => {
    const ing = inventoryItems.find(i => i.id === r.ingredient_item_id);
    const required = (Number(r.quantity) || 0) * (Number(mfgNowQty) || 0);
    const available = ing?.stock_factory || 0;
    return {
      id: r.ingredient_item_id,
      name: ing?.name || r.ingredient_name || '—',
      unit: ing?.unit || r.ingredient_unit || '',
      required,
      available,
      shortage: Math.max(0, required - available),
    };
  });

  // طلب صرف النواقص من المخزن الرئيسي إلى المطبخ
  const handleRequestMfgShortages = async () => {
    const reqs = computeMfgNowReqs().filter(x => x.shortage > 0);
    if (reqs.length === 0) return;
    setLoading(true);
    try {
      const items = reqs.map(x => ({
        item_id: x.id,
        item_name: x.name,
        quantity: Number(x.shortage.toFixed(3)),
        unit: x.unit,
        calculated_main_quantity: Number(x.shortage.toFixed(3)),
      }));
      await db.addManufacturingOrder({ status: 'pending', items, requested_by: loggedInUser?.name || 'Unknown' });
      await fetchInventoryData();
      alert(language === 'ar'
        ? `تم إنشاء طلب صرف بالنواقص (${items.length} صنف). بعد اعتماده ووصوله للمطبخ، أكمل التصنيع.`
        : `Created a disbursement request for ${items.length} shortage item(s). After it's approved into the kitchen, complete production.`);
    } catch (err) {
      console.error(err);
      alert(language === 'ar' ? 'تعذّر إنشاء طلب الصرف' : 'Failed to create disbursement request');
    } finally {
      setLoading(false);
    }
  };

  // تنفيذ التصنيع: خصم المكوّنات من المطبخ وإضافة المنتج لمخزن التوزيع
  const handleManufactureNow = async () => {
    if (!mfgNowItem || mfgNowQty <= 0) return;
    const reqs = computeMfgNowReqs();
    if (reqs.length === 0) {
      alert(language === 'ar' ? 'لا توجد وصفة محفوظة لهذا المنتج. أضِف وصفته أولاً.' : 'No saved recipe for this product. Add its recipe first.');
      return;
    }
    if (reqs.some(x => x.shortage > 0)) {
      alert(language === 'ar' ? 'بعض المكوّنات غير متوفرة في المطبخ — اطلب صرف النواقص أولاً.' : 'Some components are not available in the kitchen — request the shortages first.');
      return;
    }
    setLoading(true);
    try {
      await db.addProductionLog({
        produced_items: [{ item_id: mfgNowItem.id, item_name: mfgNowItem.name, quantity: mfgNowQty }],
        consumed_items: reqs.map(x => ({ item_id: x.id, item_name: x.name, quantity: x.required })),
        recorded_by: loggedInUser?.name || 'Unknown',
      });
      await fetchInventoryData();
      setMfgNowOpen(false);
      setMfgNowItem(null);
      setMfgNowRecipe([]);
      alert(language === 'ar' ? `✅ تم تصنيع ${mfgNowQty} ${mfgNowItem.unit} من ${mfgNowItem.name} وإضافتها لمخزن التوزيع.` : `✅ Manufactured ${mfgNowQty} ${mfgNowItem.unit} of ${mfgNowItem.name} into distribution.`);
    } catch (err) {
      console.error(err);
      alert((language === 'ar' ? '❌ تعذّر التصنيع: ' : '❌ Production failed: ') + ((err as any)?.message || err));
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

  // --- TRANSFER REQUEST HANDLERS ---
  const handleSaveTransferRequest = async () => {
    if (transferCart.length === 0) return;
    setLoading(true);
    try {
      await db.addTransferRequest({
        status: 'pending',
        items: transferCart,
        requested_by: loggedInUser ? loggedInUser.name : 'Unknown',
        notes: transferNotes
      });
      await fetchInventoryData();
      setTransferModalOpen(false);
      setTransferCart([]);
      setTransferNotes('');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveTransferRequest = async (id: string, isApprove: boolean) => {
    const reason = isApprove ? undefined : (prompt(language === 'ar' ? 'سبب الرفض (اختياري):' : 'Rejection reason (optional):') || undefined);
    setLoading(true);
    try {
      await db.updateTransferRequestStatus(id, isApprove ? 'approved' : 'rejected', loggedInUser ? loggedInUser.name : 'Unknown', reason);
      await fetchInventoryData();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // --- DISTRIBUTION PRODUCTS HANDLERS ---
  const openDistProdModal = (prod?: DistributionProduct) => {
    if (prod) {
      setDistProdEditId(prod.id);
      setDistProdName(prod.name);
      setDistProdUnit(prod.unit);
      setDistProdCategory(prod.category || '');
      setDistProdStock(prod.stock_quantity);
      setDistProdPrice(prod.unit_price);
      setDistProdNotes(prod.notes || '');
    } else {
      setDistProdEditId(null);
      setDistProdName('');
      setDistProdUnit('كجم');
      setDistProdCategory('');
      setDistProdStock('');
      setDistProdPrice('');
      setDistProdNotes('');
    }
    setDistProdModalOpen(true);
  };

  const handleSaveDistributionProduct = async () => {
    if (!distProdName.trim() || distProdStock === '' || distProdPrice === '') return;
    setLoading(true);
    try {
      const prodData = {
        name: distProdName.trim(),
        unit: distProdUnit,
        category: distProdCategory.trim() || undefined,
        stock_quantity: Number(distProdStock),
        unit_price: Number(distProdPrice),
        notes: distProdNotes.trim() || undefined
      };
      if (distProdEditId) {
        await db.updateDistributionProduct(distProdEditId, prodData);
      } else {
        await db.addDistributionProduct(prodData);
      }
      await fetchInventoryData();
      setDistProdModalOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDistributionProduct = async (id: string) => {
    if (!confirm(language === 'ar' ? 'هل أنت متأكد من الحذف؟' : 'Are you sure you want to delete?')) return;
    setLoading(true);
    try {
      await db.deleteDistributionProduct(id);
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
    fetchEmployees();
    fetchAttendanceLogs();
    fetchEmployeeTransactions();
    fetchFinancialTransactions();
  }, []);

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expName.trim() || expAmount <= 0) {
      alert(language === 'ar' ? 'يرجى إدخال اسم المصروف وقيمة صالحة!' : 'Please enter cost name and a valid amount!');
      return;
    }
    setLoading(true);
    try {
      const finalType = expType === 'custom' ? customExpType.trim() : expType;
      await db.addExpense({
        name: expName.trim(),
        type: finalType || 'أخرى',
        amount: Number(expAmount),
        payment_method: expPaymentMethod,
        expense_date: expDate
      });
      await fetchExpenses();
      setExpModalOpen(false);
      setExpName('');
      setExpType('بضائع وخامات');
      setCustomExpType('');
      setExpAmount(0);
      setExpDate(getLocalDayStr());
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
    setTelegramBotToken(settings.telegram_bot_token || '');
    setTelegramChatId(settings.telegram_chat_id || '');
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

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empName.trim() || empSalary === '' || Number(empSalary) <= 0) {
      alert(language === 'ar' ? 'يرجى إدخال اسم الموظف وراتب صحيح!' : 'Please enter employee name and a valid salary!');
      return;
    }
    setLoading(true);
    try {
      const dataToSave = {
        name: empName.trim(),
        phone: empPhone.trim(),
        salary: Number(empSalary),
        allowed_vacations: empAllowedVacations,
        working_hours: empWorkingHours === '' ? 9 : Number(empWorkingHours)
      };

      if (editingEmployee) {
        await db.updateEmployee(editingEmployee.id, dataToSave);
        alert(language === 'ar' ? 'تم تعديل بيانات الموظف بنجاح!' : 'Employee updated successfully!');
      } else {
        await db.addEmployee(dataToSave);
        alert(language === 'ar' ? 'تم إضافة الموظف بنجاح!' : 'Employee added successfully!');
      }

      setEmpModalOpen(false);
      setEditingEmployee(null);
      setEmpName('');
      setEmpPhone('');
      setEmpSalary('');
      setEmpAllowedVacations(4);
      setEmpWorkingHours(9);
      await fetchEmployees();
    } catch (err) {
      console.error(err);
      alert(language === 'ar' ? 'حدث خطأ أثناء حفظ بيانات الموظف.' : 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    if (!window.confirm(language === 'ar' ? 'هل أنت متأكد من حذف هذا الموظف نهائياً؟' : 'Are you sure you want to delete this employee?')) return;
    setLoading(true);
    try {
      await db.deleteEmployee(id);
      if (selectedEmployee?.id === id) {
        setSelectedEmployee(null);
      }
      await fetchEmployees();
      alert(language === 'ar' ? 'تم حذف الموظف بنجاح.' : 'Deleted successfully.');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    const amount = Number(txAmount) || 0;
    if (amount <= 0 && txType !== 'vacation_paid' && txType !== 'vacation_unpaid') {
      alert(language === 'ar' ? 'يرجى إدخال مبلغ صحيح!' : 'Please enter a valid amount!');
      return;
    }
    setLoading(true);
    try {
      await db.addEmployeeTransaction({
        employee_id: selectedEmployee.id,
        type: txType,
        amount: amount,
        date: getLocalDayStr(),
        notes: txNotes.trim()
      });
      setTxModalOpen(false);
      setTxAmount('');
      setTxNotes('');
      setTxType('advance');
      await fetchEmployeeTransactions();
      alert(language === 'ar' ? 'تم إضافة المعاملة بنجاح!' : 'Transaction recorded successfully!');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!window.confirm(language === 'ar' ? 'هل أنت متأكد من حذف هذه المعاملة؟' : 'Are you sure you want to delete this transaction?')) return;
    setLoading(true);
    try {
      await db.deleteEmployeeTransaction(id);
      await fetchEmployeeTransactions();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
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
    } catch (err: any) {
      console.error('Category save error:', err);
      const msg = err?.message || err?.details || JSON.stringify(err);
      alert((language === 'ar' ? 'خطأ في حفظ التصنيف: ' : 'Error saving category: ') + msg);
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
      quantity: computeFinalQty(Number(recipeItemQty), recipeItemUnitMode, item.unit),
      inventory_item_name: item.name,
      inventory_item_unit: item.unit
    };

    setProdRecipes([...prodRecipes, newRecipeItem]);
    setSelectedInvItemId('');
    setRecipeItemQty('');
    setRecipeItemUnitMode('base');
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

  // --- EXPORT / IMPORT PRODUCTS ---
  const exportProductsToExcel = async () => {
    setLoading(true);
    try {
      const allRecipes = await Promise.all(products.map(p => db.getProductRecipes(p.id)));
      
      const exportData = products.map((prod, index) => {
        const cat = categories.find(c => c.id === prod.category_id);
        const recipes = allRecipes[index];
        
        const row: any = {
          'رقم المنتج': prod.id,
          'التصنيف': cat ? cat.name_ar : '',
          'اسم المنتج (عربي)': prod.name_ar,
          'اسم المنتج (إنجليزي)': prod.name_en,
          'السعر': prod.price,
        };
        
        for (let i = 0; i < 10; i++) {
          row[`مكون ${i + 1}`] = recipes[i]?.inventory_item_name || '';
          row[`كمية ${i + 1}`] = recipes[i]?.quantity || '';
        }
        return row;
      });

      const inventoryRefData = inventoryItems.map(item => ({
        'رقم الخامة': item.id,
        'اسم الخامة': item.name,
        'الوحدة': item.unit
      }));

      const wb = XLSX.utils.book_new();
      const wsProducts = XLSX.utils.json_to_sheet(exportData);
      const wsInventory = XLSX.utils.json_to_sheet(inventoryRefData);

      XLSX.utils.book_append_sheet(wb, wsProducts, "المنتجات");
      XLSX.utils.book_append_sheet(wb, wsInventory, "الخامات المتاحة");

      XLSX.writeFile(wb, `Products_Recipes_${getLocalDayStr()}.xlsx`);
    } catch (err) {
      console.error(err);
      alert(language === 'ar' ? 'حدث خطأ أثناء التصدير' : 'Error exporting data');
    } finally {
      setLoading(false);
    }
  };

  // الأصناف بعد تطبيق فلتر المخزن والنواقص — يُستخدم في الجدول والتصدير والاستيراد
  const filteredInventoryItems = inventoryItems.filter(item => {
    if (!warehouseHoldsItem(inventoryWarehouseFilter, item)) return false;
    const stock = inventoryWarehouseFilter === 'factory' ? (item.stock_factory || 0)
      : inventoryWarehouseFilter === 'distribution' ? (item.stock_distribution || 0)
      : (item.stock_main || 0);
    if (inventoryLowStockFilter && stock > (item.low_stock_threshold || 0)) return false;
    return true;
  });

  const warehouseLabel = (wh: 'main' | 'factory' | 'distribution') => (
    wh === 'factory' ? (language === 'ar' ? 'المصنع' : 'Factory')
      : wh === 'distribution' ? (language === 'ar' ? 'التوزيع' : 'Distribution')
      : (language === 'ar' ? 'الرئيسي' : 'Main')
  );

  // رصيد الصنف "نهاية الشهر الماضي" لمخزن معيّن = مجموع الحركات قبل أول يوم في الشهر الحالي.
  // لو مفيش حركات أصلاً، نعتبر الرصيد الحالي هو المُرحّل من قبل بداية الشهر.
  const lastMonthClosing = (item: InventoryItem, wh: 'main' | 'factory' | 'distribution') => {
    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const movs = inventoryMovements.filter(m => m.item_id === item.id && (m.warehouse === wh || (!m.warehouse && wh === 'main')));
    if (movs.length === 0) return warehouseStock(wh, item);
    let q = 0;
    movs.filter(m => new Date(m.created_at || 0) < startOfThisMonth).forEach(m => {
      if (m.type === 'in' || m.type === 'adjustment') q += Number(m.quantity);
      else q -= Number(m.quantity);
    });
    return q;
  };

  // اسم عمود الوصفة في ملف إكسيل المخزون (للمنتجات المصنّعة)
  const RECIPE_COL = 'الوصفة (مكوّن:كمية | ...)';

  const exportInventoryToExcel = async () => {
    try {
      // التصدير يحترم الفلتر النشط (المخزن + النواقص)
      if (filteredInventoryItems.length === 0) {
        alert(language === 'ar' ? 'لا توجد أصناف في الفلتر الحالي للتصدير' : 'No items in the current filter to export');
        return;
      }

      // تحميل وصفات المنتجات المصنّعة الظاهرة في الفلتر
      const recipeMap = new Map<string, string>();
      for (const m of filteredInventoryItems.filter(i => i.is_manufactured)) {
        const recs = await db.getManufacturingRecipes(m.id);
        const txt = recs.map((r: any) => {
          const nm = r.ingredient_name || inventoryItems.find(i => i.id === r.ingredient_item_id)?.name || '';
          return `${nm}:${r.quantity}`;
        }).filter((s: string) => !s.startsWith(':')).join(' | ');
        recipeMap.set(m.id, txt);
      }

      const wh = inventoryWarehouseFilter;
      const exportData = filteredInventoryItems.map(item => ({
        'رقم الصنف': item.id,
        'اسم الصنف': item.name,
        'الوحدة': item.unit,
        'النوع': item.is_manufactured ? 'مصنّع' : 'خام',
        'نهاية الشهر الماضي': lastMonthClosing(item, wh),
        'الكمية الحالية': warehouseStock(wh, item),
        'رصيد المخزن الأساسي': item.stock_main || 0,
        'رصيد المصنع': item.stock_factory || 0,
        'رصيد مخزن التوزيع': item.stock_distribution || 0,
        'الحد الأدنى للقطعة': item.low_stock_threshold || 0,
        'متوسط السعر': item.avg_purchase_price || 0,
        'التكلفة الإجمالية للمخزن الأساسي': (item.stock_main || 0) * (item.avg_purchase_price || 0),
        'التكلفة الإجمالية للمصنع': (item.stock_factory || 0) * (item.avg_purchase_price || 0),
        'التكلفة الإجمالية لمخزن التوزيع': (item.stock_distribution || 0) * (item.avg_purchase_price || 0),
        [RECIPE_COL]: item.is_manufactured ? (recipeMap.get(item.id) || '') : ''
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);
      XLSX.utils.book_append_sheet(wb, ws, "الجرد");

      XLSX.writeFile(wb, `Inventory_${warehouseLabel(inventoryWarehouseFilter)}_${getLocalDayStr()}.xlsx`);
    } catch (err) {
      console.error(err);
      alert(language === 'ar' ? 'حدث خطأ أثناء التصدير' : 'Error exporting data');
    }
  };

  const importInventoryFromExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws);

          // الاستيراد يحترم الفلتر النشط: يحدّث فقط الأصناف الموجودة في الفلتر الحالي
          const allowedIds = new Set(filteredInventoryItems.map(i => i.id));

          let updatedCount = 0;
          let skippedCount = 0;
          let recipeCount = 0;
          for (const row of data as any[]) {
            const id = row['رقم الصنف'];
            if (!id) continue;
            if (!allowedIds.has(id)) { skippedCount++; continue; }

            const updateObj: Partial<InventoryItem> = {};
            if (row['اسم الصنف'] !== undefined) updateObj.name = row['اسم الصنف'];
            if (row['الوحدة'] !== undefined) updateObj.unit = row['الوحدة'];
            if (row['رصيد المخزن الأساسي'] !== undefined) updateObj.stock_main = Number(row['رصيد المخزن الأساسي']) || 0;
            if (row['رصيد المصنع'] !== undefined) updateObj.stock_factory = Number(row['رصيد المصنع']) || 0;
            if (row['رصيد مخزن التوزيع'] !== undefined) updateObj.stock_distribution = Number(row['رصيد مخزن التوزيع']) || 0;
            if (row['الحد الأدنى للقطعة'] !== undefined) updateObj.low_stock_threshold = Number(row['الحد الأدنى للقطعة']) || 0;

            if (Object.keys(updateObj).length > 0) {
              if ((window as any).supabase) {
                await (window as any).supabase.from('inventory_items').update(updateObj).eq('id', id);
              }
              updatedCount++;
            }

            // تحديث وصفة المنتج المصنّع لو عمود الوصفة موجود
            const item = inventoryItems.find(i => i.id === id);
            if (item?.is_manufactured && row[RECIPE_COL] !== undefined) {
              const recipeStr = String(row[RECIPE_COL] || '').trim();
              const recipes: { ingredient_item_id: string; quantity: number }[] = [];
              if (recipeStr) {
                for (const part of recipeStr.split('|')) {
                  const sep = part.lastIndexOf(':');
                  if (sep === -1) continue;
                  const nm = part.slice(0, sep).trim();
                  const qty = Number(part.slice(sep + 1).trim());
                  const ing = inventoryItems.find(i => i.name.trim() === nm);
                  if (ing && !isNaN(qty) && qty > 0) recipes.push({ ingredient_item_id: ing.id, quantity: qty });
                  else if (!ing && nm) console.warn(`Recipe ingredient "${nm}" not found for ${item.name}`);
                }
              }
              await db.saveManufacturingRecipe(id, recipes);
              recipeCount++;
            }
          }
          await fetchInventoryData();
          const skipNote = skippedCount > 0
            ? (language === 'ar' ? ` (تم تجاهل ${skippedCount} صنف خارج الفلتر الحالي)` : ` (skipped ${skippedCount} items outside current filter)`)
            : '';
          const recipeNote = recipeCount > 0
            ? (language === 'ar' ? ` + تحديث ${recipeCount} وصفة` : ` + ${recipeCount} recipes updated`)
            : '';
          alert((language === 'ar' ? `تم تحديث ${updatedCount} صنف بنجاح` : `Updated ${updatedCount} items successfully`) + recipeNote + skipNote);
        } catch (err) {
          console.error(err);
          alert(language === 'ar' ? 'خطأ في معالجة الملف' : 'Error processing file');
        } finally {
          setLoading(false);
          if (e.target) e.target.value = '';
        }
      };
      reader.readAsBinaryString(file);
    } catch (err) {
      console.error(err);
      setLoading(false);
      alert(language === 'ar' ? 'خطأ في قراءة الملف' : 'Error reading file');
    }
  };

  const importProductsFromExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsName = wb.SheetNames[0];
          const ws = wb.Sheets[wsName];
          const data: any[] = XLSX.utils.sheet_to_json(ws);

          for (const row of data) {
            const prodId = row['رقم المنتج'];
            if (!prodId) continue; // Skip if no product ID

            // Update Product Info
            const newPrice = Number(row['السعر']);
            const newNameAr = row['اسم المنتج (عربي)'];
            const newNameEn = row['اسم المنتج (إنجليزي)'];

            if (!isNaN(newPrice) && newNameAr && newNameEn) {
              const existingProd = products.find(p => p.id === prodId);
              const hasChanged = !existingProd || 
                                 existingProd.price !== newPrice || 
                                 existingProd.name_ar !== newNameAr || 
                                 existingProd.name_en !== newNameEn;

              if (hasChanged) {
                await db.updateProduct(prodId, {
                  price: newPrice,
                  name_ar: newNameAr,
                  name_en: newNameEn
                });
              }
            }

            // Update Recipes
            const newRecipes: { inventory_item_id: string; quantity: number }[] = [];
            for (let i = 1; i <= 10; i++) {
              const invName = row[`مكون ${i}`];
              const qtyStr = row[`كمية ${i}`];
              const qty = Number(qtyStr);

              if (invName && invName.toString().trim() !== '' && !isNaN(qty) && qty > 0) {
                const invItem = inventoryItems.find(item => item.name.trim() === invName.toString().trim());
                if (invItem) {
                  newRecipes.push({
                    inventory_item_id: invItem.id,
                    quantity: qty
                  });
                } else {
                  console.warn(`Inventory item "${invName}" not found for product ${prodId}`);
                }
              }
            }
            
            await db.updateProductRecipe(prodId, newRecipes);
          }

          await refreshData();
          alert(language === 'ar' ? 'تم الاستيراد والتحديث بنجاح!' : 'Import and update successful!');
        } catch (err) {
          console.error(err);
          alert(language === 'ar' ? 'حدث خطأ في قراءة الملف' : 'Error reading file');
        } finally {
          setLoading(false);
          if (e.target) e.target.value = ''; // reset file input
        }
      };
      reader.readAsBinaryString(file);
    } catch (err) {
      console.error(err);
      setLoading(false);
      if (e.target) e.target.value = ''; // reset file input
    }
  };

  // --- ORDERS MANAGEMENT ---
  const handleUpdateOrderStatus = async (id: string, status: Order['status']) => {
    if (status === 'cancelled') {
      triggerOtpProtectedAction('إلغاء الطلب', 'Cancel Order', async () => {
        try {
          await db.updateOrderStatus(id, status);
          await refreshData();
        } catch (err) {
          console.error(err);
        }
      }, id);
      return;
    }
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

  const getShiftBoundaries = (dateStr: string) => {
    const logsForDate = attendanceLogs.filter(l => l.date === dateStr);
    if (logsForDate.length === 0) return null;

    const checkInTimes = logsForDate.map(l => new Date(l.check_in_time).getTime());
    const earliestCheckIn = new Date(Math.min(...checkInTimes));

    const hasActiveShift = logsForDate.some(l => !l.check_out_time);
    let latestCheckOut: Date;
    if (hasActiveShift) {
      latestCheckOut = new Date();
    } else {
      const checkOutTimes = logsForDate.map(l => l.check_out_time ? new Date(l.check_out_time).getTime() : 0);
      latestCheckOut = new Date(Math.max(...checkOutTimes));
    }

    return { start: earliestCheckIn, end: latestCheckOut };
  };

  const filteredOrders = orders.filter(order => {
    if (ordersDepartmentFilter !== 'all' && !orderHasDepartment(order, ordersDepartmentFilter)) return false;
    if (!order.created_at) return true;
    const orderDate = new Date(order.created_at);
    if (orderFilterType === 'day') {
      const boundaries = getShiftBoundaries(selectedFilterDay);
      if (boundaries) {
        return orderDate >= boundaries.start && orderDate <= boundaries.end;
      } else {
        const dayStr = getLocalDayStr(orderDate);
        return dayStr === selectedFilterDay;
      }
    }
    if (orderFilterType === 'month') {
      const monthStr = getLocalMonthStr(orderDate);
      return monthStr === selectedFilterMonth;
    }
    if (orderFilterType === 'year') {
      return orderDate.getFullYear() === selectedFilterYear;
    }
    return true;
  });

  // --- INVOICE FILTERING ---
  const filteredInvoices = orders.filter(o => {
    // Only completed orders
    if (o.status !== 'completed') return false;

    // Time filter
    if (invFilterType !== 'all' && o.created_at) {
      const d = new Date(o.created_at);
      if (invFilterType === 'day') {
        const boundaries = getShiftBoundaries(invFilterDay);
        if (boundaries) {
          if (d < boundaries.start || d > boundaries.end) return false;
        } else {
          if (getLocalDayStr(d) !== invFilterDay) return false;
        }
      } else if (invFilterType === 'month') {
        if (getLocalMonthStr(d) !== invFilterMonth) return false;
      } else if (invFilterType === 'year') {
        if (d.getFullYear() !== invFilterYear) return false;
      }
    }

    // Order type filter
    if (invOrderTypeFilter !== 'all' && o.order_type !== invOrderTypeFilter) return false;

    // Payment method filter
    if (invPaymentFilter !== 'all') {
      if (invPaymentFilter === 'deferred') {
        if (o.payment_method !== 'deferred' && !(o.payment_details?.deferred > 0)) return false;
      } else if (invPaymentFilter === 'hospitality') {
        if (o.payment_method !== 'hospitality') return false;
      } else {
        if (o.payment_method !== invPaymentFilter) return false;
      }
    }

    // Search query
    if (invSearchQuery.trim()) {
      const q = invSearchQuery.trim().toLowerCase();
      const matchName = o.customer_name?.toLowerCase().includes(q);
      const matchPhone = o.customer_phone?.includes(q);
      const matchId = o.id.toLowerCase().includes(q);
      if (!matchName && !matchPhone && !matchId) return false;
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
        service_percent: servicePercent,
        telegram_bot_token: telegramBotToken,
        telegram_chat_id: telegramChatId
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
    if (analyticsFilterType === 'day') return getLocalDayStr(dateObj) === analyticsFilterDay;
    if (analyticsFilterType === 'month') return getLocalMonthStr(dateObj) === analyticsFilterMonth;
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

          {(() => {
            const emoji = (e: string) => (
              <span style={{ fontSize: '1.1rem', display: 'inline-flex', alignItems: 'center', lineHeight: 1 }}>{e}</span>
            );
            const navGroups = [
              {
                id: 'sales', titleAr: 'المنتجات والمبيعات', titleEn: 'Products & Sales', groupIcon: emoji('🛒'),
                items: [
                  { id: 'categories', show: hasPermission('categories'), icon: <FolderOpen size={18} />, label: t.categoriesTab },
                  { id: 'products', show: hasPermission('products'), icon: <Coffee size={18} />, label: t.productsTab },
                  { id: 'orders', show: hasPermission('orders'), icon: <Calendar size={18} />, label: t.ordersTab },
                  { id: 'customers', show: hasPermission('customers'), icon: <Users size={18} />, label: t.customersTab },
                  { id: 'recipes', show: hasPermission('recipes'), icon: emoji('👨‍🍳'), label: language === 'ar' ? 'وصفات الشيف' : 'Chef Recipes' },
                ],
              },
              {
                id: 'finance', titleAr: 'المالية', titleEn: 'Finance', groupIcon: emoji('💰'),
                items: [
                  { id: 'financials', show: hasPermission('financials'), icon: <WalletCards size={18} />, label: language === 'ar' ? 'المعاملات المالية' : 'Financials' },
                  { id: 'partners', show: hasPermission('partners'), icon: <Users size={18} />, label: language === 'ar' ? 'العهد والشركاء' : 'Partners' },
                  { id: 'debts', show: hasPermission('customers'), icon: emoji('💳'), label: language === 'ar' ? 'الحسابات الآجلة' : 'Debts' },
                  { id: 'invoices', show: hasPermission('orders'), icon: emoji('🧾'), label: language === 'ar' ? 'الفواتير والأرباح' : 'Invoices & Profit' },
                  { id: 'expenses', show: hasPermission('expenses'), icon: emoji('💸'), label: language === 'ar' ? 'التكاليف والمصروفات' : 'Costs & Expenses' },
                ],
              },
              {
                id: 'warehouse', titleAr: 'المخازن والمصنع', titleEn: 'Warehouses & Factory', groupIcon: emoji('🏭'),
                items: [
                  { id: 'inventory', show: loggedInUser?.role === 'admin' || loggedInUser?.role === 'inventory_manager' || loggedInUser?.role === 'manager', icon: <Package size={18} />, label: language === 'ar' ? 'إدارة المخازن' : 'Inventory' },
                  { id: 'inventory_report', show: loggedInUser?.role === 'admin' || loggedInUser?.role === 'inventory_manager' || loggedInUser?.role === 'manager', icon: <TrendingDown size={18} />, label: language === 'ar' ? 'الجرد الشهري' : 'Monthly Report' },
                  { id: 'factory', show: loggedInUser?.role === 'admin' || loggedInUser?.role === 'kitchen_manager', icon: emoji('🏭'), label: language === 'ar' ? 'المصنع والمطبخ' : 'Factory & Kitchen' },
                ],
              },
              {
                id: 'management', titleAr: 'الإدارة والموظفين', titleEn: 'Management & Staff', groupIcon: <Users size={16} />,
                items: [
                  { id: 'employees', show: hasPermission('employees'), icon: <DollarSign size={18} />, label: language === 'ar' ? 'الموظفين والرواتب' : 'Employees & Payroll' },
                  { id: 'attendance', show: hasPermission('attendance'), icon: <UserCheck size={18} />, label: language === 'ar' ? 'سجل الحضور والانصراف' : 'Daily Attendance' },
                  { id: 'system_users', show: hasPermission('system_users'), icon: <Users size={18} />, label: language === 'ar' ? 'مستخدمين النظام' : 'System Users' },
                  { id: 'waiters', show: hasPermission('system_users'), icon: <Coffee size={18} />, label: language === 'ar' ? 'إدارة الويترز' : 'Waiters Management' },
                  { id: 'settings', show: hasPermission('settings'), icon: <Gear size={18} />, label: t.settingsTab },
                ],
              },
            ];

            return navGroups.map(group => {
              const visibleItems = group.items.filter(it => it.show);
              if (visibleItems.length === 0) return null;
              const containsActive = visibleItems.some(it => it.id === activeTab);
              const isOpen = openNavGroups.includes(group.id) || containsActive;
              return (
                <div key={group.id} style={{ marginBottom: '0.25rem' }}>
                  <button
                    className="admin-nav-item"
                    onClick={() => setOpenNavGroups(prev => prev.includes(group.id) ? prev.filter(g => g !== group.id) : [...prev, group.id])}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
                      opacity: 0.75, fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.5px',
                      textTransform: 'uppercase', color: 'var(--gold-primary)',
                    }}
                  >
                    {group.groupIcon}
                    <span style={{ flex: 1, textAlign: language === 'ar' ? 'right' : 'left' }}>{language === 'ar' ? group.titleAr : group.titleEn}</span>
                    <ChevronDown size={16} style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                  </button>
                  {isOpen && (
                    <div style={{ paddingInlineStart: '0.5rem', borderInlineStart: '2px solid rgba(212,175,55,0.2)', marginInlineStart: '0.5rem' }}>
                      {visibleItems.map(it => (
                        <button
                          key={it.id}
                          className={`admin-nav-item ${activeTab === it.id ? 'active' : ''}`}
                          onClick={() => setActiveTab(it.id as TabType)}
                        >
                          {it.icon}
                          <span>{it.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            });
          })()}

          <button className="btn-outline-gold" onClick={() => {
            localStorage.removeItem('meridien_admin_auth');
            localStorage.removeItem('meridien_logged_in_user');
            setIsAuthenticated(false);
            setLoggedInUser(null);
            onClose();
          }} style={{ width: '100%', marginTop: '1rem' }}>
            <LogOut size={16} />
            {t.exitBtn}
          </button>
        </nav>
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
        {activeTab === 'financials' && (
          <FinancialsView 
            orders={orders}
            expenses={expenses}
            financialTransactions={financialTransactions}
            fetchFinancialTransactions={fetchFinancialTransactions}
            inventoryItems={inventoryItems}
            language={language}
            dateFilter={financialsDateFilter}
            setDateFilter={setFinancialsDateFilter}
          />
        )}

        {activeTab === 'partners' && (
          <PartnersView language={language} />
        )}

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
                      <th>{language === 'ar' ? 'القسم' : 'Dept'}</th>
                      <th>{t.thOrder}</th>
                      <th>{t.thActions}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((cat) => (
                      <tr key={cat.id}>
                        <td style={{ fontWeight: '700' }}>{cat.name_ar}</td>
                        <td className="font-en">{cat.name_en}</td>
                        <td><span style={{ padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.8rem', background: (cat.department || 'restaurant') === 'restaurant' ? 'rgba(76,175,80,0.15)' : 'rgba(156,39,176,0.15)', color: (cat.department || 'restaurant') === 'restaurant' ? '#4caf50' : '#9c27b0' }}>{(cat.department || 'restaurant') === 'restaurant' ? (language === 'ar' ? 'مطعم' : 'Rest') : (language === 'ar' ? 'بار' : 'Bar')}</span></td>
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
                  <select 
                    value={adminProdDeptFilter}
                    onChange={(e) => setAdminProdDeptFilter(e.target.value)}
                    className="input-gold"
                    style={{ padding: '0.4rem', borderRadius: '10px', minWidth: '150px', fontSize: '0.9rem' }}
                  >
                    <option value="all">{language === 'ar' ? 'كل الأقسام' : 'All Departments'}</option>
                    <option value="restaurant">{language === 'ar' ? '🍳 مطعم' : '🍳 Kitchen'}</option>
                    <option value="bar">{language === 'ar' ? '🍸 بار' : '🍸 Bar'}</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button className="btn-gold" onClick={() => handleOpenProdModal(null)}>
                    <PlusCircle size={16} />
                    {t.addProd}
                  </button>
                  <button className="btn-export excel" onClick={exportProductsToExcel}>
                    <Download size={16} /> {language === 'ar' ? 'تصدير' : 'Export'}
                  </button>
                  <label className="btn-export" style={{ cursor: 'pointer' }}>
                    <Upload size={16} /> {language === 'ar' ? 'استيراد' : 'Import'}
                    <input type="file" accept=".xlsx, .xls" style={{ display: 'none' }} onChange={importProductsFromExcel} />
                  </label>
                </div>
              </div>

              <div className="table-wrapper">
                <table className="luxury-table">
                  <thead>
                    <tr>
                      <th>الصورة</th>
                      <th>{t.thNameAr}</th>
                      <th>{t.thNameEn}</th>
                      <th>{t.thCategory}</th>
                      <th>{language === 'ar' ? 'القسم' : 'Dept'}</th>
                      <th>{t.thPrice}</th>
                      <th>{t.thStatus}</th>
                      <th>{t.thActions}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.filter(p => {
                      const category = categories.find(c => c.id === p.category_id);
                      const matchDept = adminProdDeptFilter === 'all' || category?.department === adminProdDeptFilter;
                      const matchCat = adminProdCatFilter === 'all' || p.category_id === adminProdCatFilter;
                      const searchLower = adminProdSearch.toLowerCase();
                      const matchSearch = adminProdSearch.trim() === '' || 
                        p.name_ar.toLowerCase().includes(searchLower) ||
                        p.name_en.toLowerCase().includes(searchLower);
                      return matchCat && matchSearch && matchDept;
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
                          <td>
                            <span style={{ 
                              padding: '2px 8px', 
                              borderRadius: '4px', 
                              fontSize: '0.8rem',
                              background: category?.department === 'bar' ? 'rgba(59,130,246,0.1)' : 'rgba(245,158,11,0.1)',
                              color: category?.department === 'bar' ? '#3b82f6' : '#f59e0b'
                            }}>
                              {category?.department === 'bar' ? (language === 'ar' ? '🍸 بار' : '🍸 Bar') : (language === 'ar' ? '🍳 مطعم' : '🍳 Kitchen')}
                            </span>
                          </td>
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

                          <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.3rem' }}>
                            <button 
                              type="button" 
                              className="btn-outline-gold" 
                              style={{ 
                                padding: '0.25rem 0.5rem', 
                                borderRadius: '8px', 
                                fontSize: '0.75rem', 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '0.3rem',
                                flex: 1,
                                justifyContent: 'center',
                                borderColor: 'var(--gold-primary)',
                                color: 'var(--gold-primary)'
                              }}
                              onClick={() => printCustomerReceipt(order, language, settings)}
                            >
                              <PrinterIcon size={12} />
                              <span>{language === 'ar' ? 'الفاتورة' : 'Receipt'}</span>
                            </button>
                            <button 
                              type="button" 
                              className="btn-outline-gold" 
                              style={{ 
                                padding: '0.25rem 0.5rem', 
                                borderRadius: '8px', 
                                fontSize: '0.75rem', 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '0.3rem',
                                flex: 1,
                                justifyContent: 'center',
                                borderColor: '#3b82f6',
                                color: '#3b82f6'
                              }}
                              onClick={() => printOrderTickets(order, categories, products, printers, language)}
                            >
                              <PrinterIcon size={12} />
                              <span>{language === 'ar' ? 'البونات' : 'Tickets'}</span>
                            </button>
                          </div>

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
                          <button
                            className="btn-gold"
                            disabled={(cust.total_debt || 0) <= 0}
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', borderRadius: '10px' }}
                            onClick={() => {
                              setShowDebtSettleModal(cust.id);
                              setDebtSettleMethods({ cash: '', visa: '', wallet: '', instapay: '' });
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
                        <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-gray)', padding: '3rem 1rem' }}>
                          {language === 'ar' ? 'لا يوجد عملاء مسجلين بمديونيات' : 'No customers with debts found'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Debt Settlement Modal */}
            {showDebtSettleModal && (
              <div className="modal-overlay" onClick={() => !isSettlingDebt && setShowDebtSettleModal(null)}>
                <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                  <div className="modal-header">
                    <h3 className="text-gradient-gold" style={{ margin: 0 }}>
                      {language === 'ar' ? 'تسديد دفعة من المديونية' : 'Settle Debt'}
                    </h3>
                    <button className="close-btn" onClick={() => !isSettlingDebt && setShowDebtSettleModal(null)} disabled={isSettlingDebt}>
                      <X size={24} />
                    </button>
                  </div>
                  
                  {(() => {
                    const cust = debtCustomers.find(c => c.id === showDebtSettleModal);
                    if (!cust) return null;
                    const cashVal = Number(debtSettleMethods.cash) || 0;
                    const visaVal = Number(debtSettleMethods.visa) || 0;
                    const walletVal = Number(debtSettleMethods.wallet) || 0;
                    const instapayVal = Number(debtSettleMethods.instapay) || 0;
                    const totalSettle = cashVal + visaVal + walletVal + instapayVal;
                    const remainingDebt = (cust.total_debt || 0) - totalSettle;
                    const isError = totalSettle <= 0 || remainingDebt < 0;

                    return (
                      <div className="modal-body">
                        <div style={{ background: 'rgba(212,175,55,0.05)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', textAlign: 'center', border: '1px solid rgba(212,175,55,0.2)' }}>
                          <div style={{ fontSize: '0.9rem', color: 'var(--text-gray)' }}>{language === 'ar' ? 'العميل' : 'Customer'}</div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{cust.name}</div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--danger)', marginTop: '0.5rem' }}>{language === 'ar' ? 'المديونية الحالية:' : 'Current Debt:'} <span className="font-en" style={{ fontWeight: 'bold' }}>{(cust.total_debt || 0).toLocaleString()} EGP</span></div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                          <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-gray)' }}>
                              💵 {language === 'ar' ? 'كاش (نقدي)' : 'Cash'}
                            </label>
                            <input
                              type="number"
                              min="0"
                              className="input-gold"
                              value={debtSettleMethods.cash}
                              onChange={e => setDebtSettleMethods(prev => ({ ...prev, cash: e.target.value }))}
                              placeholder="0"
                              style={{ width: '100%' }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-gray)' }}>
                              💳 {language === 'ar' ? 'فيزا' : 'Visa'}
                            </label>
                            <input
                              type="number"
                              min="0"
                              className="input-gold"
                              value={debtSettleMethods.visa}
                              onChange={e => setDebtSettleMethods(prev => ({ ...prev, visa: e.target.value }))}
                              placeholder="0"
                              style={{ width: '100%' }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-gray)' }}>
                              📱 {language === 'ar' ? 'محفظة (Wallet)' : 'Wallet'}
                            </label>
                            <input
                              type="number"
                              min="0"
                              className="input-gold"
                              value={debtSettleMethods.wallet}
                              onChange={e => setDebtSettleMethods(prev => ({ ...prev, wallet: e.target.value }))}
                              placeholder="0"
                              style={{ width: '100%' }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-gray)' }}>
                              ⚡ {language === 'ar' ? 'إنستاباي' : 'Instapay'}
                            </label>
                            <input
                              type="number"
                              min="0"
                              className="input-gold"
                              value={debtSettleMethods.instapay}
                              onChange={e => setDebtSettleMethods(prev => ({ ...prev, instapay: e.target.value }))}
                              placeholder="0"
                              style={{ width: '100%' }}
                            />
                          </div>
                        </div>

                        <div style={{ background: 'var(--bg-darker)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <span>{language === 'ar' ? 'إجمالي الدفعة:' : 'Total Payment:'}</span>
                            <span className="font-en" style={{ color: 'var(--success)', fontWeight: 'bold' }}>{totalSettle.toLocaleString()} EGP</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>{language === 'ar' ? 'المديونية المتبقية:' : 'Remaining Debt:'}</span>
                            <span className="font-en" style={{ color: remainingDebt < 0 ? 'var(--danger)' : 'var(--text-gray)', fontWeight: 'bold' }}>{remainingDebt.toLocaleString()} EGP</span>
                          </div>
                        </div>

                        <button
                          className="btn-gold"
                          style={{ width: '100%', padding: '1rem', fontSize: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
                          disabled={isError || isSettlingDebt}
                          onClick={async () => {
                            try {
                              setIsSettlingDebt(true);
                              
                              if (cashVal > 0) {
                                await db.addFinancialTransaction({ type: 'debt_settlement', amount: cashVal, from_method: 'deferred', to_method: 'cash', customer_id: cust.id, description: language === 'ar' ? 'تسديد دفعة من المديونية (كاش)' : 'Debt settlement (Cash)' });
                              }
                              if (visaVal > 0) {
                                await db.addFinancialTransaction({ type: 'debt_settlement', amount: visaVal, from_method: 'deferred', to_method: 'visa', customer_id: cust.id, description: language === 'ar' ? 'تسديد دفعة من المديونية (فيزا)' : 'Debt settlement (Visa)' });
                              }
                              if (walletVal > 0) {
                                await db.addFinancialTransaction({ type: 'debt_settlement', amount: walletVal, from_method: 'deferred', to_method: 'wallet', customer_id: cust.id, description: language === 'ar' ? 'تسديد دفعة من المديونية (محفظة)' : 'Debt settlement (Wallet)' });
                              }
                              if (instapayVal > 0) {
                                await db.addFinancialTransaction({ type: 'debt_settlement', amount: instapayVal, from_method: 'deferred', to_method: 'instapay', customer_id: cust.id, description: language === 'ar' ? 'تسديد دفعة من المديونية (إنستاباي)' : 'Debt settlement (Instapay)' });
                              }

                              await db.updateCustomerDebt(cust.id, remainingDebt);
                              await fetchDebtCustomers();
                              
                              setShowDebtSettleModal(null);
                              setIsSettlingDebt(false);
                            } catch (e) {
                              setIsSettlingDebt(false);
                              alert(language === 'ar' ? 'حدث خطأ أثناء حفظ العمليات' : 'Error saving transactions');
                            }
                          }}
                        >
                          {isSettlingDebt ? <Loader className="spin" size={20} /> : <CheckCircle size={20} />}
                          <span>{language === 'ar' ? 'تأكيد وحفظ الدفعات' : 'Confirm & Save Payments'}</span>
                        </button>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
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

              {/* Filters Row */}
              <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1.5rem', padding: '1rem', background: 'rgba(212,175,55,0.03)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                {/* Search */}
                <div style={{ flex: '1 1 250px', position: 'relative' }}>
                  <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-gray)' }} />
                  <input
                    type="text"
                    className="input-gold"
                    placeholder={language === 'ar' ? 'بحث بالاسم أو الهاتف أو رقم الفاتورة...' : 'Search name, phone, invoice #...'}
                    value={invSearchQuery}
                    onChange={(e) => setInvSearchQuery(e.target.value)}
                    style={{ width: '100%', paddingLeft: '34px', borderRadius: '10px', fontSize: '0.85rem' }}
                  />
                </div>

                {/* Time filter */}
                <select value={invFilterType} onChange={(e) => setInvFilterType(e.target.value as any)} className="input-gold" style={{ padding: '0.4rem 0.8rem', borderRadius: '10px', fontSize: '0.85rem' }}>
                  <option value="all">{language === 'ar' ? 'كل الأوقات' : 'All Time'}</option>
                  <option value="day">{language === 'ar' ? 'باليوم 📅' : 'By Day 📅'}</option>
                  <option value="month">{language === 'ar' ? 'بالشهر 🗓️' : 'By Month 🗓️'}</option>
                  <option value="year">{language === 'ar' ? 'بالسنة ⏳' : 'By Year ⏳'}</option>
                </select>

                {invFilterType === 'day' && (
                  <input type="date" className="input-gold" value={invFilterDay} onChange={(e) => setInvFilterDay(e.target.value)} style={{ padding: '0.4rem 0.8rem', borderRadius: '10px', fontSize: '0.85rem' }} />
                )}
                {invFilterType === 'month' && (
                  <input type="month" className="input-gold" value={invFilterMonth} onChange={(e) => setInvFilterMonth(e.target.value)} style={{ padding: '0.4rem 0.8rem', borderRadius: '10px', fontSize: '0.85rem' }} />
                )}
                {invFilterType === 'year' && (
                  <select className="input-gold" value={invFilterYear} onChange={(e) => setInvFilterYear(Number(e.target.value))} style={{ padding: '0.4rem 0.8rem', borderRadius: '10px', fontSize: '0.85rem' }}>
                    {[2024, 2025, 2026, 2027, 2028].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                )}

                {/* Order type filter */}
                <select value={invOrderTypeFilter} onChange={(e) => setInvOrderTypeFilter(e.target.value as any)} className="input-gold" style={{ padding: '0.4rem 0.8rem', borderRadius: '10px', fontSize: '0.85rem' }}>
                  <option value="all">{language === 'ar' ? 'كل الأنواع' : 'All Types'}</option>
                  <option value="dine_in">{language === 'ar' ? '🍽️ داين إن' : '🍽️ Dine In'}</option>
                  <option value="takeaway">{language === 'ar' ? '🥡 تيك أواي' : '🥡 Takeaway'}</option>
                  <option value="delivery">{language === 'ar' ? '🚗 توصيل' : '🚗 Delivery'}</option>
                  <option value="talabat">{language === 'ar' ? '📱 طلبات' : '📱 Talabat'}</option>
                </select>

                {/* Payment method filter */}
                <select value={invPaymentFilter} onChange={(e) => setInvPaymentFilter(e.target.value)} className="input-gold" style={{ padding: '0.4rem 0.8rem', borderRadius: '10px', fontSize: '0.85rem' }}>
                  <option value="all">{language === 'ar' ? 'كل طرق الدفع' : 'All Payments'}</option>
                  <option value="cash">{language === 'ar' ? '💵 كاش' : '💵 Cash'}</option>
                  <option value="visa">{language === 'ar' ? '💳 فيزا' : '💳 Visa'}</option>
                  <option value="wallet">{language === 'ar' ? '📱 محفظة' : '📱 Wallet'}</option>
                  <option value="instapay">{language === 'ar' ? '💸 انستاباي' : '💸 Instapay'}</option>
                  <option value="split">{language === 'ar' ? '🔀 مقسم' : '🔀 Split'}</option>
                  <option value="deferred">{language === 'ar' ? '📋 آجل' : '📋 Deferred'}</option>
                  <option value="hospitality">{language === 'ar' ? '🎁 ضيافة' : '🎁 Hospitality'}</option>
                </select>
              </div>

              {/* Invoice Summary Cards */}
              {(() => {
                const totalSales = filteredInvoices.reduce((s, o) => s + o.total_price, 0);
                const totalCost = filteredInvoices.reduce((s, o) => s + (o.total_cost || 0), 0);
                const totalProfit = totalSales - totalCost;
                const deferredTotal = filteredInvoices.filter(o => o.payment_method === 'deferred' || o.payment_details?.deferred > 0).reduce((s, o) => s + (o.payment_details?.deferred || o.total_price), 0);
                const hospitalityTotal = filteredInvoices.filter(o => o.payment_method === 'hospitality').reduce((s, o) => s + (o.payment_details?.original_price || 0), 0);
                return (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.8rem', marginBottom: '1.5rem' }}>
                      <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '1rem', borderRadius: '14px', border: '1px solid rgba(16,185,129,0.2)', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-gray)' }}>{language === 'ar' ? 'إجمالي المبيعات' : 'Total Sales'}</div>
                        <div className="font-en" style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--success)' }}>
                          +{totalSales.toLocaleString()} <span style={{ fontSize: '0.7rem' }}>EGP</span>
                        </div>
                      </div>
                      <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '1rem', borderRadius: '14px', border: '1px solid rgba(239,68,68,0.2)', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-gray)' }}>{language === 'ar' ? 'التكلفة' : 'COGS'}</div>
                        <div className="font-en" style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--danger)' }}>
                          -{totalCost.toLocaleString()} <span style={{ fontSize: '0.7rem' }}>EGP</span>
                        </div>
                      </div>
                      <div style={{ background: 'rgba(212,175,55,0.05)', padding: '1rem', borderRadius: '14px', border: '1px solid rgba(212,175,55,0.2)', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-gray)' }}>{language === 'ar' ? 'صافي الربح' : 'Net Profit'}</div>
                        <div className="font-en" style={{ fontSize: '1.3rem', fontWeight: '800', color: totalProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                          {totalProfit >= 0 ? '+' : ''}{totalProfit.toLocaleString()} <span style={{ fontSize: '0.7rem' }}>EGP</span>
                        </div>
                      </div>
                      <div style={{ background: 'rgba(212,175,55,0.03)', padding: '1rem', borderRadius: '14px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-gray)' }}>{language === 'ar' ? 'عدد الفواتير' : 'Invoices'}</div>
                        <div className="font-en" style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--gold-primary)' }}>
                          {filteredInvoices.length}
                        </div>
                      </div>
                      <div style={{ background: 'rgba(251,191,36,0.05)', padding: '1rem', borderRadius: '14px', border: '1px solid rgba(251,191,36,0.2)', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-gray)' }}>{language === 'ar' ? '📋 آجل' : '📋 Deferred'}</div>
                        <div className="font-en" style={{ fontSize: '1.3rem', fontWeight: '800', color: '#fbbf24' }}>
                          {deferredTotal.toLocaleString()} <span style={{ fontSize: '0.7rem' }}>EGP</span>
                        </div>
                      </div>
                      <div style={{ background: 'rgba(168,85,247,0.05)', padding: '1rem', borderRadius: '14px', border: '1px solid rgba(168,85,247,0.2)', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-gray)' }}>{language === 'ar' ? '🎁 ضيافة' : '🎁 Hospitality'}</div>
                        <div className="font-en" style={{ fontSize: '1.3rem', fontWeight: '800', color: '#a855f7' }}>
                          {hospitalityTotal.toLocaleString()} <span style={{ fontSize: '0.7rem' }}>EGP</span>
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
                            <th>{language === 'ar' ? 'النوع' : 'Type'}</th>
                            <th>{language === 'ar' ? 'طريقة الدفع' : 'Payment'}</th>
                            <th>{language === 'ar' ? 'سعر البيع' : 'Sale Price'}</th>
                            <th>{language === 'ar' ? 'التكلفة' : 'Cost'}</th>
                            <th>{language === 'ar' ? 'الربح' : 'Profit'}</th>
                            <th>{language === 'ar' ? 'إجراءات' : 'Actions'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredInvoices.map(inv => {
                            const cost = inv.total_cost || 0;
                            const profit = inv.total_price - cost;
                            const payLabel = inv.payment_method === 'cash' ? '💵 كاش' : inv.payment_method === 'visa' ? '💳 فيزا' : inv.payment_method === 'deferred' ? '📋 آجل' : inv.payment_method === 'wallet' ? '📱 محفظة' : inv.payment_method === 'instapay' ? '💸 انستاباي' : inv.payment_method === 'split' ? '🔀 مقسم' : inv.payment_method === 'hospitality' ? '🎁 ضيافة' : '💵 كاش';
                            const typeLabel = inv.order_type === 'dine_in' ? '🍽️' : inv.order_type === 'takeaway' ? '🥡' : inv.order_type === 'delivery' ? '🚗' : inv.order_type === 'talabat' ? '📱' : '—';
                            return (
                              <tr key={inv.id}>
                                <td className="font-en" style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--gold-primary)' }}>#{inv.id.slice(0, 8)}</td>
                                <td style={{ fontWeight: '600' }}>
                                  {inv.customer_name}
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{inv.customer_phone}</div>
                                </td>
                                <td className="font-en" style={{ fontSize: '0.8rem' }}>{new Date(inv.created_at).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}</td>
                                <td style={{ fontSize: '0.85rem' }}>{typeLabel} {inv.order_type?.toUpperCase()}</td>
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
                                        const pd = inv.payment_details;
                                        let payInfo = '';
                                        if (pd && typeof pd === 'object' && pd.type !== 'hospitality') {
                                          payInfo = `\n${language === 'ar' ? 'تفاصيل الدفع:' : 'Payment Details:'}\n` +
                                            (pd.cash ? `  كاش: ${pd.cash}\n` : '') +
                                            (pd.visa ? `  فيزا: ${pd.visa}\n` : '') +
                                            (pd.wallet ? `  محفظة: ${pd.wallet}\n` : '') +
                                            (pd.instapay ? `  انستاباي: ${pd.instapay}\n` : '') +
                                            (pd.deferred ? `  آجل: ${pd.deferred}\n` : '');
                                        }
                                        if (pd?.type === 'hospitality') {
                                          payInfo = `\n🎁 ${language === 'ar' ? 'ضيافة - القيمة الأصلية:' : 'Hospitality - Original:'} ${pd.original_price} EGP`;
                                        }
                                        alert(`${language === 'ar' ? 'تفاصيل الفاتورة' : 'Invoice Details'} #${inv.id.slice(0,8)}\n\n${items}\n\n${language === 'ar' ? 'الإجمالي' : 'Total'}: ${inv.total_price} EGP\n${language === 'ar' ? 'التكلفة' : 'Cost'}: ${cost} EGP\n${language === 'ar' ? 'الربح' : 'Profit'}: ${profit} EGP${payInfo}`);
                                      }}
                                    >
                                      👁 {language === 'ar' ? 'عرض' : 'View'}
                                    </button>
                                    <button
                                      style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--danger)', padding: '0.3rem 0.5rem', fontSize: '0.75rem', borderRadius: '8px', cursor: 'pointer' }}
                                      onClick={() => {
                                        triggerOtpProtectedAction('حذف الفاتورة نهائياً', 'Delete Invoice permanently', async () => {
                                          await db.deleteOrder(inv.id);
                                          await refreshData();
                                        }, inv.id);
                                      }}
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                          {filteredInvoices.length === 0 && (
                            <tr>
                              <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-gray)', padding: '3rem 1rem' }}>
                                {language === 'ar' ? 'لا توجد فواتير مطابقة للفلاتر المحددة' : 'No invoices match the selected filters'}
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

              {/* Telegram Bot Settings */}
              <h3 style={{ color: 'var(--gold-secondary)', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>🤖</span>
                <span>{language === 'ar' ? 'إعدادات إشعارات التليجرام (حذف/إلغاء الفواتير)' : 'Telegram Notification Settings'}</span>
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                <div className="form-group">
                  <label>{language === 'ar' ? 'رمز البوت (Telegram Bot Token)' : 'Telegram Bot Token'}</label>
                  <input 
                    type="text" 
                    className="input-gold" 
                    value={telegramBotToken} 
                    onChange={(e) => setTelegramBotToken(e.target.value)} 
                    placeholder="8722542358:AAF_..."
                  />
                </div>
                <div className="form-group">
                  <label>{language === 'ar' ? 'معرف المحادثة (Telegram Chat ID)' : 'Telegram Chat ID'}</label>
                  <input 
                    type="text" 
                    className="input-gold" 
                    value={telegramChatId} 
                    onChange={(e) => setTelegramChatId(e.target.value)} 
                    placeholder="-100..."
                  />
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
                        <td style={{ fontWeight: 'bold' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span>{user.name}</span>
                            {user.job_title && <span style={{ fontSize: '0.8rem', color: 'var(--text-gray)' }}>{user.job_title}</span>}
                          </div>
                        </td>
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
                      const todayStr = getLocalDayStr();
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
        {activeTab === 'inventory_report' && (
          <InventoryReportView language={language} />
        )}

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
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <h2 style={{ color: 'var(--gold-primary)' }}>{language === 'ar' ? 'الأصناف والخامات' : 'Items & Raw Materials'}</h2>
                  
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff', cursor: 'pointer', background: 'rgba(239, 68, 68, 0.2)', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #ef4444' }}>
                      <input 
                        type="checkbox" 
                        checked={inventoryLowStockFilter}
                        onChange={(e) => setInventoryLowStockFilter(e.target.checked)}
                        style={{ accentColor: '#ef4444' }}
                      />
                      {language === 'ar' ? 'النواقص فقط' : 'Low Stock Only'}
                    </label>

                    {/* فلتر المخزن — segmented control */}
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', border: '1px solid rgba(212,175,55,0.25)', flexWrap: 'wrap' }}>
                      {([
                        { key: 'main', ar: 'الرئيسي', en: 'Main', sub: language === 'ar' ? 'خام' : 'Raw' },
                        { key: 'factory', ar: 'المصنع / المطبخ', en: 'Factory', sub: language === 'ar' ? 'خام' : 'Raw' },
                        { key: 'distribution', ar: 'التوزيع', en: 'Distribution', sub: language === 'ar' ? 'مصنّع' : 'Mfg' },
                      ] as const).map(w => {
                        const active = inventoryWarehouseFilter === w.key;
                        return (
                          <button
                            key={w.key}
                            onClick={() => setInventoryWarehouseFilter(w.key)}
                            style={{
                              display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1,
                              padding: '0.4rem 0.9rem', borderRadius: '8px', cursor: 'pointer',
                              border: 'none', transition: 'all 0.15s',
                              background: active ? 'var(--gold-primary)' : 'transparent',
                              color: active ? '#000' : 'var(--text-light)',
                              fontWeight: active ? 700 : 500,
                            }}
                          >
                            <span style={{ fontSize: '0.85rem' }}>{language === 'ar' ? w.ar : w.en}</span>
                            <span style={{ fontSize: '0.62rem', opacity: 0.8 }}>{w.sub}</span>
                          </button>
                        );
                      })}
                      <span style={{ padding: '0 0.6rem', fontSize: '0.8rem', color: 'var(--gold-primary)', fontWeight: 700 }}>
                        {filteredInventoryItems.length} {language === 'ar' ? 'صنف' : 'items'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn-export excel" onClick={exportInventoryToExcel}>
                          <Download size={16} /> {language === 'ar' ? 'تصدير إكسيل' : 'Export Excel'}
                        </button>
                        <label className="btn-export" style={{ cursor: 'pointer' }}>
                          <Upload size={16} /> {language === 'ar' ? 'استيراد جرد' : 'Import Excel'}
                          <input type="file" accept=".xlsx, .xls" style={{ display: 'none' }} onChange={importInventoryFromExcel} />
                        </label>
                      </div>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-gray)', textAlign: 'center' }}>
                        {language === 'ar' ? '⓵ التصدير/الاستيراد يطبّق على الفلتر الحالي فقط' : '⓵ Export/Import applies to current filter only'}
                      </span>
                    </div>

                    <button className="btn-gold" onClick={() => {
                      setEditingInvItem(null);
                      setInvName('');
                      setInvUnit('كجم');
                      setInvUnitsPerCarton('');
                      setInvUnitsPerBox('');
                      setInvLowStockThreshold('');
                      setInvTargetType('raw');
                      setInvRecipes([]);
                      setInvModalOpen(true);
                    }}>
                      <Plus size={18} /> {language === 'ar' ? 'إضافة صنف جديد' : 'Add New Item'}
                    </button>
                  </div>
                </div>
                
                {/* Valuation Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                  <div className="stat-card" style={{ padding: '1.5rem' }}>
                    <div className="stat-icon"><Package color="#000" size={24} /></div>
                    <div className="stat-info">
                      <h3>{language === 'ar' ? 'قيمة المخزن الرئيسي (خام)' : 'Main Stock Value (Raw)'}</h3>
                      <p className="stat-value" style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                        {warehouseValue('main', inventoryItems).toFixed(0)} EGP
                      </p>
                    </div>
                  </div>
                  <div className="stat-card" style={{ padding: '1.5rem' }}>
                    <div className="stat-icon"><Package color="#000" size={24} /></div>
                    <div className="stat-info">
                      <h3>{language === 'ar' ? 'قيمة المصنع / المطبخ (خام)' : 'Factory Stock Value (Raw)'}</h3>
                      <p className="stat-value" style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                        {warehouseValue('factory', inventoryItems).toFixed(0)} EGP
                      </p>
                    </div>
                  </div>
                  <div className="stat-card" style={{ padding: '1.5rem' }}>
                    <div className="stat-icon"><Package color="#000" size={24} /></div>
                    <div className="stat-info">
                      <h3>{language === 'ar' ? 'قيمة التوزيع (مصنّع)' : 'Distribution Value (Mfg)'}</h3>
                      <p className="stat-value" style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981' }}>
                        {warehouseValue('distribution', inventoryItems).toFixed(0)} EGP
                      </p>
                    </div>
                  </div>
                </div>

                <div className="table-responsive">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>{language === 'ar' ? 'الصنف' : 'Item'}</th>
                        <th>{language === 'ar' ? 'الوحدة' : 'Unit'}</th>
                        <th title={language === 'ar' ? 'الرصيد المتبقي عند بداية الشهر الحالي (المُرحّل من الشهر الماضي)' : 'Closing balance carried from last month'}>{language === 'ar' ? 'نهاية الشهر الماضي' : 'Last Month'}</th>
                        <th>{language === 'ar' ? 'الكمية الحالية' : 'Current Qty'}</th>
                        <th>{language === 'ar' ? 'متوسط السعر' : 'Avg Price'}</th>
                        <th>{language === 'ar' ? 'آخر سعر شراء' : 'Last Price'}</th>
                        <th>{language === 'ar' ? 'إجراءات' : 'Actions'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInventoryItems
                        .map(item => {
                        const stock = warehouseStock(inventoryWarehouseFilter, item);
                        const closing = lastMonthClosing(item, inventoryWarehouseFilter);

                        return (
                          <tr key={item.id}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span>{item.name}</span>
                                <span style={{ 
                                  fontSize: '0.7rem', 
                                  padding: '0.1rem 0.4rem', 
                                  borderRadius: '4px', 
                                  background: item.is_manufactured ? 'rgba(59, 130, 246, 0.2)' : 'rgba(234, 179, 8, 0.2)',
                                  color: item.is_manufactured ? '#60a5fa' : '#eab308',
                                  border: `1px solid ${item.is_manufactured ? '#3b82f6' : '#eab308'}`
                                }}>
                                  {item.is_manufactured ? (language === 'ar' ? 'مصنع' : 'Mfg') : (language === 'ar' ? 'خام' : 'Raw')}
                                </span>
                              </div>
                            </td>
                            <td>{item.unit}</td>
                            <td style={{ color: 'var(--text-gray)' }}>{closing.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                            <td style={{ color: 'var(--gold-primary)', fontWeight: 'bold' }}>{stock.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                            <td>{item.avg_purchase_price.toFixed(2)}</td>
                            <td>{item.last_purchase_price.toFixed(2)}</td>
                            <td>
                              <button 
                                className="action-btn edit" 
                                style={{ marginInlineEnd: '0.5rem', background: '#eab308', color: '#000', border: 'none' }}
                                onClick={async () => {
                                  setEditingInvItem(item);
                                  setInvName(item.name);
                                  setInvUnit(item.unit || 'كجم');
                                  setInvUnitsPerCarton(item.units_per_carton || '');
                                  setInvUnitsPerBox(item.units_per_box || '');
                                  setInvLowStockThreshold(item.low_stock_threshold || '');
                                  setInvTargetType(item.is_manufactured ? 'manufactured' : 'raw');
                                  
                                  if (item.is_manufactured) {
                                    const recipes = await db.getManufacturingRecipes(item.id);
                                    setInvRecipes(recipes);
                                  } else {
                                    setInvRecipes([]);
                                  }
                                  
                                  setInvModalOpen(true);
                                }}
                              >
                                <Edit size={16} />
                              </button>

                              <button 
                                className="action-btn edit" 
                                style={{ marginInlineEnd: '0.5rem' }} 
                                onClick={() => {
                                  setEditStockItem(item);
                                  setEditStockAdjustment(0);
                                  setEditStockModalOpen(true);
                                }}
                              >
                                {language === 'ar' ? 'تعديل الرصيد' : 'Edit Stock'}
                              </button>
                              
                              {item.is_manufactured && (
                                <button 
                                  className="action-btn" 
                                  style={{ marginInlineEnd: '0.5rem', background: '#3b82f6', color: 'white', border: 'none' }}
                                  onClick={async () => {
                                    setActiveMfgItem(item);
                                    const recipes = await db.getManufacturingRecipes(item.id);
                                    setActiveMfgRecipes(recipes);
                                    setMfgRecipeModalOpen(true);
                                  }}
                                >
                                  {language === 'ar' ? 'وصفة التصنيع' : 'BOM'}
                                </button>
                              )}
                              
                              <button className="action-btn delete" onClick={() => handleDeleteInventoryItem(item.id)}>
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredInventoryItems.length === 0 && (
                        <tr><td colSpan={7} style={{ textAlign: 'center', padding: '1rem' }}>{language === 'ar' ? 'لا توجد أصناف في هذا المخزن' : 'No items in this warehouse'}</td></tr>
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
                            <button className="action-btn edit" style={{ marginInlineEnd: '0.5rem' }} title={language === 'ar' ? 'عرض الملف' : 'View Profile'} onClick={() => setSelectedSupplierProfile(sup)}>
                              <Eye size={16} />
                            </button>
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
                        <th>{language === 'ar' ? 'طرق الدفع' : 'Payment Methods'}</th>
                        <th>{language === 'ar' ? 'الإجمالي' : 'Total'}</th>
                        <th>{language === 'ar' ? 'الآجل (المتبقي)' : 'Remaining (Credit)'}</th>
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
                          <td style={{ fontSize: '0.85rem', lineHeight: '1.4' }}>
                            {inv.paid_cash ? <div>💵 {language === 'ar' ? 'كاش: ' : 'Cash: '}{inv.paid_cash.toFixed(2)}</div> : null}
                            {inv.paid_visa ? <div>💳 {language === 'ar' ? 'فيزا: ' : 'Visa: '}{inv.paid_visa.toFixed(2)}</div> : null}
                            {inv.paid_wallet ? <div>📱 {language === 'ar' ? 'محفظة: ' : 'Wallet: '}{inv.paid_wallet.toFixed(2)}</div> : null}
                            {inv.paid_instapay ? <div>⚡ {language === 'ar' ? 'إنستاباي: ' : 'Instapay: '}{inv.paid_instapay.toFixed(2)}</div> : null}
                            {!inv.paid_cash && !inv.paid_visa && !inv.paid_wallet && !inv.paid_instapay ? <span style={{ color: 'var(--text-gray)' }}>-</span> : null}
                          </td>
                          <td style={{ color: 'var(--gold-primary)', fontWeight: 'bold' }}>{inv.total_amount.toFixed(2)}</td>
                          <td style={{ color: (inv.remaining_amount ?? 0) > 0 ? '#ff4d4d' : '#2ecc71', fontWeight: 'bold' }}>
                            {(inv.remaining_amount ?? 0).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                      {purchaseInvoices.length === 0 && (
                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: '1rem' }}>{language === 'ar' ? 'لا توجد بيانات' : 'No data'}</td></tr>
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
                <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{language === 'ar' ? '🏭 المصنع والمخازن' : 'Factory & Warehouses'}</h1>
                <p style={{ color: 'var(--text-gray)' }}>
                  {language === 'ar' ? 'مخزن الخامات ← مطبخ/مصنع ← مخزن التوزيع | سير عمل متكامل بالموافقات' : 'Raw Stock → Kitchen/Factory → Distribution | Full workflow with approvals'}
                </p>
              </div>
            </div>

            {/* Warehouse Flow Banner */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem', background: 'rgba(212,175,55,0.1)', borderRadius: '12px', marginBottom: '1.5rem', flexWrap: 'wrap', border: '1px solid rgba(212,175,55,0.2)' }}>
              <div style={{ textAlign: 'center', padding: '0.5rem 1rem', background: 'rgba(212,175,55,0.2)', borderRadius: '8px' }}>
                <div style={{ fontSize: '1.5rem' }}>📦</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-gray)' }}>{language === 'ar' ? 'مخزن الخامات' : 'Main Stock'}</div>
                <div style={{ fontWeight: 'bold', color: 'var(--gold-primary)' }}>{warehouseValue('main', inventoryItems).toFixed(0)} EGP</div>
              </div>
              <div style={{ fontSize: '1.5rem', color: 'var(--gold-primary)' }}>→</div>
              <div style={{ textAlign: 'center', padding: '0.5rem 1rem', background: 'rgba(212,175,55,0.2)', borderRadius: '8px' }}>
                <div style={{ fontSize: '1.5rem' }}>🍳</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-gray)' }}>{language === 'ar' ? 'المطبخ/المصنع' : 'Kitchen/Factory'}</div>
                <div style={{ fontWeight: 'bold', color: 'var(--gold-primary)' }}>{warehouseValue('factory', inventoryItems).toFixed(0)} EGP</div>
              </div>
              <div style={{ fontSize: '1.5rem', color: 'var(--gold-primary)' }}>→</div>
              <div style={{ textAlign: 'center', padding: '0.5rem 1rem', background: 'rgba(16,185,129,0.2)', borderRadius: '8px' }}>
                <div style={{ fontSize: '1.5rem' }}>🚚</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-gray)' }}>{language === 'ar' ? 'مخزن التوزيع' : 'Distribution'}</div>
                <div style={{ fontWeight: 'bold', color: '#10b981' }}>{warehouseValue('distribution', inventoryItems).toFixed(0)} EGP</div>
              </div>
              <div style={{ marginInlineStart: 'auto' }}>
                <span style={{ background: 'rgba(245,158,11,0.2)', color: 'orange', padding: '4px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                  ⏳ {transferRequests.filter(r => r.status === 'pending').length} {language === 'ar' ? 'طلب تحويل معلق' : 'Pending Transfers'}
                </span>
              </div>
            </div>

            {/* Factory Sub Navigation */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', borderBottom: '1px solid #333', paddingBottom: '1rem', flexWrap: 'wrap' }}>
              <button 
                className={`btn-outline-gold ${factorySubTab === 'mfg_requests' ? 'active' : ''}`}
                onClick={() => setFactorySubTab('mfg_requests')}
                style={{ background: factorySubTab === 'mfg_requests' ? 'var(--gold-primary)' : 'transparent', color: factorySubTab === 'mfg_requests' ? '#000' : 'var(--gold-primary)' }}
              >
                📦 {language === 'ar' ? 'أذون صرف الخامات' : 'Material Requests'}
              </button>
              <button
                className={`btn-outline-gold ${factorySubTab === 'kitchen_stock' ? 'active' : ''}`}
                onClick={() => setFactorySubTab('kitchen_stock')}
                style={{ background: factorySubTab === 'kitchen_stock' ? 'var(--gold-primary)' : 'transparent', color: factorySubTab === 'kitchen_stock' ? '#000' : 'var(--gold-primary)' }}
              >
                🍳 {language === 'ar' ? 'المخزون الآن في المطبخ' : 'Kitchen Stock Now'}
              </button>
              <button
                className={`btn-outline-gold ${(factorySubTab as string) === 'transfer_requests' ? 'active' : ''}`}
                onClick={() => setFactorySubTab('transfer_requests' as any)}
                style={{ background: (factorySubTab as string) === 'transfer_requests' ? 'var(--gold-primary)' : 'transparent', color: (factorySubTab as string) === 'transfer_requests' ? '#000' : 'var(--gold-primary)', position: 'relative' }}
              >
                🚚 {language === 'ar' ? 'أذون التحويل للتوزيع' : 'Transfer Requests'}
                {transferRequests.filter(r => r.status === 'pending').length > 0 && (
                  <span style={{ background: 'orange', color: '#000', borderRadius: '50%', padding: '2px 6px', fontSize: '0.75rem', fontWeight: 'bold', marginInlineStart: '6px' }}>
                    {transferRequests.filter(r => r.status === 'pending').length}
                  </span>
                )}
              </button>
              <button 
                className={`btn-outline-gold ${(factorySubTab as string) === 'distribution' ? 'active' : ''}`}
                onClick={() => setFactorySubTab('distribution' as any)}
                style={{ background: (factorySubTab as string) === 'distribution' ? 'var(--gold-primary)' : 'transparent', color: (factorySubTab as string) === 'distribution' ? '#000' : 'var(--gold-primary)' }}
              >
                🎪 {language === 'ar' ? 'كتالوج التوزيع' : 'Distribution Catalog'}
              </button>
              <button 
                className={`btn-outline-gold ${factorySubTab === 'production' ? 'active' : ''}`}
                onClick={() => setFactorySubTab('production')}
                style={{ background: factorySubTab === 'production' ? 'var(--gold-primary)' : 'transparent', color: factorySubTab === 'production' ? '#000' : 'var(--gold-primary)' }}
              >
                📋 {language === 'ar' ? 'سجل الإنتاج' : 'Production Logs'}
              </button>
            </div>

            {/* SUB-TAB: MATERIAL REQUESTS (Main → Kitchen) */}
            {factorySubTab === 'mfg_requests' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
                  <div>
                    <h2 style={{ color: 'var(--gold-primary)', marginBottom: '0.25rem' }}>{language === 'ar' ? '📦 طلبات صرف الخامات' : '📦 Raw Material Requests'}</h2>
                    <p style={{ color: 'var(--text-gray)', fontSize: '0.85rem' }}>{language === 'ar' ? 'نقل خامات من المخزن الأساسي إلى المطبخ' : 'Transfer from main stock to kitchen'}</p>
                  </div>
                  <button className="btn-gold" onClick={() => setMfgModalOpen(true)}>
                    <Plus size={18} /> {language === 'ar' ? 'طلب صرف خامات' : 'Request Materials'}
                  </button>
                </div>
                <div className="table-responsive">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>{language === 'ar' ? 'رقم الطلب' : 'Order ID'}</th>
                        <th>{language === 'ar' ? 'طُلب بواسطة' : 'Requested By'}</th>
                        <th>{language === 'ar' ? 'الأصناف' : 'Items'}</th>
                        <th>{language === 'ar' ? 'التاريخ' : 'Date'}</th>
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
                            {order.status === 'pending' && (
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button className="action-btn edit" title={language === 'ar' ? 'قبول' : 'Approve'} onClick={() => handleApproveManufacturingOrder(order.id, true)}>✓</button>
                                <button className="action-btn delete" title={language === 'ar' ? 'رفض' : 'Reject'} onClick={() => handleApproveManufacturingOrder(order.id, false)}>✗</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                      {manufacturingOrders.length === 0 && (
                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: '1rem' }}>{language === 'ar' ? 'لا توجد طلبات' : 'No requests'}</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SUB-TAB: TRANSFER REQUESTS (Kitchen → Distribution) */}
            {(factorySubTab as string) === 'transfer_requests' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
                  <div>
                    <h2 style={{ color: 'var(--gold-primary)', marginBottom: '0.25rem' }}>{language === 'ar' ? '🚚 أذون التحويل للتوزيع' : '🚚 Transfer to Distribution'}</h2>
                    <p style={{ color: 'var(--text-gray)', fontSize: '0.85rem' }}>{language === 'ar' ? 'المطبخ يرسل إذن تحويل → مدير التوزيع يوافق → يُخصم من المطبخ ويضاف للتوزيع' : 'Kitchen sends request → Distribution manager approves → Stock transferred'}</p>
                  </div>
                  <button className="btn-gold" onClick={() => setTransferModalOpen(true)}>
                    <Plus size={18} /> {language === 'ar' ? 'طلب تحويل للتوزيع' : 'Request Transfer'}
                  </button>
                </div>
                <div className="table-responsive">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>{language === 'ar' ? 'رقم الطلب' : 'ID'}</th>
                        <th>{language === 'ar' ? 'طُلب بواسطة' : 'From'}</th>
                        <th>{language === 'ar' ? 'الأصناف المحولة' : 'Items'}</th>
                        <th>{language === 'ar' ? 'ملاحظات' : 'Notes'}</th>
                        <th>{language === 'ar' ? 'التاريخ' : 'Date'}</th>
                        <th>{language === 'ar' ? 'الحالة' : 'Status'}</th>
                        <th>{language === 'ar' ? 'إجراءات' : 'Actions'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transferRequests.map(req => (
                        <tr key={req.id}>
                          <td className="font-en">#{req.id.slice(0, 8)}</td>
                          <td>{req.requested_by}</td>
                          <td>
                            {req.items.map((i, idx) => (
                              <div key={idx} style={{ fontSize: '0.85rem', color: 'var(--gold-primary)' }}>
                                {i.quantity} {i.unit} {i.item_name}
                              </div>
                            ))}
                          </td>
                          <td style={{ fontSize: '0.85rem', color: 'var(--text-gray)' }}>{req.notes || '-'}</td>
                          <td className="font-en">{new Date(req.created_at || '').toLocaleDateString()}</td>
                          <td>
                            <div>
                              <span style={{ 
                                padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 'bold',
                                background: req.status === 'approved' ? 'rgba(16,185,129,0.2)' : req.status === 'rejected' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)',
                                color: req.status === 'approved' ? 'var(--success)' : req.status === 'rejected' ? 'var(--danger)' : 'orange'
                              }}>
                                {req.status === 'approved' ? (language === 'ar' ? '✓ مقبول' : '✓ Approved') : req.status === 'rejected' ? (language === 'ar' ? '✗ مرفوض' : '✗ Rejected') : (language === 'ar' ? '⏳ قيد الانتظار' : '⏳ Pending')}
                              </span>
                              {req.status === 'approved' && req.approved_by && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-gray)', marginTop: '2px' }}>{language === 'ar' ? 'بواسطة: ' : 'By: '}{req.approved_by}</div>
                              )}
                              {req.status === 'rejected' && req.rejection_reason && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: '2px' }}>{language === 'ar' ? 'سبب: ' : 'Reason: '}{req.rejection_reason}</div>
                              )}
                            </div>
                          </td>
                          <td>
                            {req.status === 'pending' && (
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button className="action-btn edit" title={language === 'ar' ? 'موافقة - نقل للتوزيع' : 'Approve'} onClick={() => handleApproveTransferRequest(req.id, true)}>✓</button>
                                <button className="action-btn delete" title={language === 'ar' ? 'رفض' : 'Reject'} onClick={() => handleApproveTransferRequest(req.id, false)}>✗</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                      {transferRequests.length === 0 && (
                        <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-gray)' }}>
                          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🚚</div>
                          {language === 'ar' ? 'لا توجد أذون تحويل حتى الآن' : 'No transfer requests yet'}
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SUB-TAB: DISTRIBUTION CATALOG */}
            {/* SUB-TAB: KITCHEN STOCK NOW (raw + mfg currently in kitchen) */}
            {factorySubTab === 'kitchen_stock' && (() => {
              const kitchenItems = inventoryItems
                .filter(i => (i.stock_factory || 0) > 0)
                .filter(i => kitchenSearch.trim() === '' || i.name.toLowerCase().includes(kitchenSearch.trim().toLowerCase()));
              const kitchenValue = kitchenItems.reduce((s, i) => s + (i.stock_factory || 0) * (i.avg_purchase_price || 0), 0);
              return (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h2 style={{ color: 'var(--gold-primary)', marginBottom: '0.25rem' }}>{language === 'ar' ? '🍳 المخزون الآن في المطبخ' : '🍳 Current Kitchen Stock'}</h2>
                    <p style={{ color: 'var(--text-gray)', fontSize: '0.85rem' }}>{language === 'ar' ? 'الخامات المصروفة والموجودة حالياً في المطبخ — يُخصم منها عند التصنيع' : 'Materials disbursed and currently in the kitchen — deducted on production'}</p>
                  </div>
                  <button className="btn-gold" onClick={() => setProductionModalOpen(true)}>
                    <Plus size={18} /> {language === 'ar' ? 'تحويل / تصنيع منتج' : 'Convert / Produce'}
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div className="stat-card"><div className="stat-icon"><Package color="#000" size={24} /></div><div className="stat-info"><h3>{language === 'ar' ? 'أصناف في المطبخ' : 'Items in Kitchen'}</h3><p className="stat-value">{kitchenItems.length}</p></div></div>
                  <div className="stat-card"><div className="stat-icon"><Package color="#000" size={24} /></div><div className="stat-info"><h3>{language === 'ar' ? 'قيمة مخزون المطبخ' : 'Kitchen Stock Value'}</h3><p className="stat-value" style={{ color: 'var(--gold-primary)' }}>{kitchenValue.toFixed(0)} EGP</p></div></div>
                </div>
                <div style={{ position: 'relative', maxWidth: '320px', marginBottom: '1rem' }}>
                  <Search size={15} style={{ position: 'absolute', insetInlineStart: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-gray)' }} />
                  <input className="input-gold" value={kitchenSearch} onChange={e => setKitchenSearch(e.target.value)} placeholder={language === 'ar' ? 'ابحث باسم الصنف...' : 'Search item...'} style={{ width: '100%', paddingInlineStart: '2rem' }} />
                </div>
                <div className="table-responsive">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>{language === 'ar' ? 'الصنف' : 'Item'}</th>
                        <th>{language === 'ar' ? 'النوع' : 'Type'}</th>
                        <th>{language === 'ar' ? 'الوحدة' : 'Unit'}</th>
                        <th>{language === 'ar' ? 'الكمية بالمطبخ' : 'Qty in Kitchen'}</th>
                        <th>{language === 'ar' ? 'متوسط السعر' : 'Avg Price'}</th>
                        <th>{language === 'ar' ? 'القيمة' : 'Value'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {kitchenItems.map(i => (
                        <tr key={i.id}>
                          <td style={{ fontWeight: 'bold' }}>{i.name}</td>
                          <td><span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: i.is_manufactured ? 'rgba(59,130,246,0.2)' : 'rgba(234,179,8,0.2)', color: i.is_manufactured ? '#60a5fa' : '#eab308' }}>{i.is_manufactured ? (language === 'ar' ? 'مصنّع' : 'Mfg') : (language === 'ar' ? 'خام' : 'Raw')}</span></td>
                          <td>{i.unit}</td>
                          <td style={{ color: 'var(--gold-primary)', fontWeight: 'bold' }}>{(i.stock_factory || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} {i.unit}</td>
                          <td>{(i.avg_purchase_price || 0).toFixed(2)}</td>
                          <td style={{ color: '#10b981', fontWeight: 'bold' }}>{((i.stock_factory || 0) * (i.avg_purchase_price || 0)).toFixed(2)} EGP</td>
                        </tr>
                      ))}
                      {kitchenItems.length === 0 && (
                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-gray)' }}>
                          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🍳</div>
                          {language === 'ar' ? 'لا توجد خامات في المطبخ حالياً — اصرف خامات من المخزن الرئيسي أولاً.' : 'No materials in the kitchen yet — disburse from main first.'}
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              );
            })()}

            {(factorySubTab as string) === 'distribution' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h2 style={{ color: 'var(--gold-primary)', marginBottom: '0.25rem' }}>{language === 'ar' ? '🎪 كتالوج مخزن التوزيع' : '🎪 Distribution Warehouse Catalog'}</h2>
                    <p style={{ color: 'var(--text-gray)', fontSize: '0.85rem' }}>{language === 'ar' ? 'المنتجات النهائية الجاهزة للتوزيع والبيع' : 'Finished products ready for distribution and sale'}</p>
                  </div>
                  <button className="btn-gold" onClick={() => openDistProdModal()}>
                    <Plus size={18} /> {language === 'ar' ? 'إضافة منتج توزيع' : 'Add Distribution Product'}
                  </button>
                </div>

                {/* المنتجات المصنّعة (من المخزون) — رصيد التوزيع */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ color: 'var(--gold-primary)', marginBottom: '0.5rem', fontSize: '1rem' }}>🏭 {language === 'ar' ? 'المنتجات المصنّعة' : 'Manufactured Products'}</h3>
                  <div className="table-responsive">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>{language === 'ar' ? 'المنتج' : 'Product'}</th>
                          <th>{language === 'ar' ? 'الوحدة' : 'Unit'}</th>
                          <th>{language === 'ar' ? 'رصيد التوزيع' : 'Distribution Stock'}</th>
                          <th>{language === 'ar' ? 'متوسط التكلفة' : 'Avg Cost'}</th>
                          <th>{language === 'ar' ? 'القيمة' : 'Value'}</th>
                          <th>{language === 'ar' ? 'إجراء' : 'Action'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inventoryItems.filter(i => i.is_manufactured).map(i => (
                          <tr key={i.id}>
                            <td style={{ fontWeight: 'bold' }}>{i.name}</td>
                            <td>{i.unit}</td>
                            <td style={{ color: (i.stock_distribution || 0) > 0 ? 'var(--gold-primary)' : 'var(--text-gray)', fontWeight: 'bold' }}>{(i.stock_distribution || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} {i.unit}</td>
                            <td>{(i.avg_purchase_price || 0).toFixed(2)}</td>
                            <td style={{ color: '#10b981', fontWeight: 'bold' }}>{((i.stock_distribution || 0) * (i.avg_purchase_price || 0)).toFixed(2)} EGP</td>
                            <td>
                              <button className="btn-gold" style={{ padding: '0.35rem 0.7rem', fontSize: '0.82rem', whiteSpace: 'nowrap' }} onClick={() => openManufactureNow(i)}>
                                🏭 {language === 'ar' ? 'تصنيع الآن' : 'Produce Now'}
                              </button>
                            </td>
                          </tr>
                        ))}
                        {inventoryItems.filter(i => i.is_manufactured).length === 0 && (
                          <tr><td colSpan={6} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-gray)' }}>{language === 'ar' ? 'لا توجد منتجات مصنّعة. أضِفها من إدارة المخازن (نوع: مصنّع).' : 'No manufactured products. Add them from Inventory (type: manufactured).'}</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <h3 style={{ color: 'var(--gold-primary)', marginBottom: '0.5rem', fontSize: '1rem' }}>🎪 {language === 'ar' ? 'منتجات توزيع إضافية (يدوية)' : 'Extra Distribution Products (manual)'}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div className="stat-card">
                    <div className="stat-icon"><Package color="#000" size={24} /></div>
                    <div className="stat-info">
                      <h3>{language === 'ar' ? 'إجمالي الأصناف' : 'Total Products'}</h3>
                      <p className="stat-value">{distributionProducts.length}</p>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon"><Package color="#000" size={24} /></div>
                    <div className="stat-info">
                      <h3>{language === 'ar' ? 'قيمة الكتالوج' : 'Catalog Value'}</h3>
                      <p className="stat-value">{distributionProducts.reduce((s, p) => s + (p.stock_quantity * p.unit_price), 0).toFixed(0)} EGP</p>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon"><Package color="#000" size={24} /></div>
                    <div className="stat-info">
                      <h3>{language === 'ar' ? 'قيمة مخزون التوزيع المصنّع' : 'Mfg Dist. Value'}</h3>
                      <p className="stat-value">{warehouseValue('distribution', inventoryItems).toFixed(0)} EGP</p>
                    </div>
                  </div>
                </div>
                <div className="table-responsive">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>{language === 'ar' ? 'المنتج' : 'Product'}</th>
                        <th>{language === 'ar' ? 'الفئة' : 'Category'}</th>
                        <th>{language === 'ar' ? 'الوحدة' : 'Unit'}</th>
                        <th>{language === 'ar' ? 'المخزون' : 'Stock'}</th>
                        <th>{language === 'ar' ? 'سعر الوحدة' : 'Unit Price'}</th>
                        <th>{language === 'ar' ? 'القيمة' : 'Value'}</th>
                        <th>{language === 'ar' ? 'ملاحظات' : 'Notes'}</th>
                        <th>{language === 'ar' ? 'إجراءات' : 'Actions'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {distributionProducts.map(prod => (
                        <tr key={prod.id}>
                          <td style={{ fontWeight: 'bold' }}>{prod.name}</td>
                          <td><span style={{ background: 'rgba(212,175,55,0.15)', color: 'var(--gold-primary)', padding: '2px 8px', borderRadius: '10px', fontSize: '0.8rem' }}>{prod.category || '-'}</span></td>
                          <td>{prod.unit}</td>
                          <td style={{ color: prod.stock_quantity < 10 ? 'var(--danger)' : 'var(--gold-primary)', fontWeight: 'bold' }}>
                            {prod.stock_quantity}
                            {prod.stock_quantity < 10 && <span style={{ fontSize: '0.75rem', marginInlineStart: '4px' }}>⚠️</span>}
                          </td>
                          <td>{prod.unit_price.toFixed(2)} EGP</td>
                          <td style={{ color: '#10b981', fontWeight: 'bold' }}>{(prod.stock_quantity * prod.unit_price).toFixed(2)} EGP</td>
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-gray)' }}>{prod.notes || '-'}</td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button className="action-btn edit" onClick={() => openDistProdModal(prod)}><Edit size={14} /></button>
                              <button className="action-btn delete" onClick={() => handleDeleteDistributionProduct(prod.id)}><Trash2 size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {distributionProducts.length === 0 && (
                        <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-gray)' }}>
                          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎪</div>
                          {language === 'ar' ? 'لا توجد منتجات. أضف أول منتج توزيع!' : 'No products yet. Add your first!'}
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SUB-TAB: PRODUCTION LOGS */}
            {factorySubTab === 'production' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <h2 style={{ color: 'var(--gold-primary)' }}>{language === 'ar' ? '📋 سجل الإنتاج (التسليم للتوزيع)' : '📋 Production Logs'}</h2>
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
                        <th>{language === 'ar' ? 'المنتجات الجاهزة (+)' : 'Produced (+)'}</th>
                        <th>{language === 'ar' ? 'الخامات المستهلكة (-)' : 'Consumed (-)'}</th>
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

        {/* TAB: EMPLOYEES & PAYROLL / الموظفين والرواتب */}
        {activeTab === 'employees' && (
              <div>
                {selectedEmployee ? (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                      <button className="btn-outline-gold" onClick={() => setSelectedEmployee(null)}>
                        &larr; {language === 'ar' ? 'العودة لقائمة الموظفين' : 'Back to Employee List'}
                      </button>
                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <label style={{ color: 'var(--gold-primary)', fontWeight: 'bold' }}>
                          {language === 'ar' ? 'شهر الحسابات:' : 'Payroll Month:'}
                        </label>
                        <input 
                          type="month" 
                          className="input-gold" 
                          style={{ width: '150px' }}
                          value={selectedProfileMonth} 
                          onChange={(e) => setSelectedProfileMonth(e.target.value)} 
                        />
                      </div>
                    </div>

                    {/* Employee Profile summary */}
                    {(() => {
                      const txs = employeeTransactions.filter(t => t.employee_id === selectedEmployee.id && t.date.slice(0, 7) === selectedProfileMonth);
                      const advances = txs.filter(t => t.type === 'advance').reduce((s, t) => s + t.amount, 0);
                      const bonuses = txs.filter(t => t.type === 'bonus').reduce((s, t) => s + t.amount, 0);
                      const manualDiscounts = txs.filter(t => t.type === 'discount').reduce((s, t) => s + t.amount, 0);
                      const paidVacations = txs.filter(t => t.type === 'vacation_paid').length;
                      const unpaidVacations = txs.filter(t => t.type === 'vacation_unpaid').length;

                      // Auto attendance penalty calculation
                      const attLogs = attendanceLogs.filter(l => l.employee_id === selectedEmployee.id && l.date.slice(0, 7) === selectedProfileMonth);
                      const autoDiscounts = attLogs.reduce((s, l) => s + (l.penalty_applied || 0), 0);

                      // Vacation deduction
                      const allowedVacations = selectedEmployee.allowed_vacations ?? 4;
                      const extraPaidVacations = Math.max(0, paidVacations - allowedVacations);
                      const vacationDeduction = (extraPaidVacations + unpaidVacations) * (selectedEmployee.salary / 30);

                      const totalDiscounts = manualDiscounts + autoDiscounts + vacationDeduction;
                      const netSalary = selectedEmployee.salary + bonuses - advances - totalDiscounts;

                      return (
                        <div>
                          <div className="table-panel" style={{ padding: '2rem', marginBottom: '2rem', background: 'radial-gradient(circle at top right, rgba(212,175,55,0.05) 0%, transparent 60%)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid #333', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
                              <div>
                                <h1 style={{ color: 'var(--gold-primary)', margin: '0 0 0.5rem 0', fontSize: '2rem' }}>{selectedEmployee.name}</h1>
                                <p style={{ color: 'var(--text-gray)', margin: 0 }}>📞 {selectedEmployee.phone || '-'}</p>
                              </div>
                              <button className="btn-gold" onClick={() => setTxModalOpen(true)}>
                                <Plus size={18} /> {language === 'ar' ? 'إضافة معاملة (سلفة / حافز / إجازة / خصم)' : 'Add Transaction / Leave'}
                              </button>
                            </div>

                            {/* Statistics Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                              <div style={{ background: '#1c1c1e', border: '1px solid #333', borderRadius: '16px', padding: '1.5rem', textAlign: 'center' }}>
                                <div style={{ color: '#8e8e93', fontSize: '0.9rem', marginBottom: '0.5rem' }}>{language === 'ar' ? 'الراتب الأساسي' : 'Base Salary'}</div>
                                <div style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 'bold' }}>{selectedEmployee.salary.toFixed(2)} EGP</div>
                              </div>
                              <div style={{ background: '#1c1c1e', border: '1px solid #333', borderRadius: '16px', padding: '1.5rem', textAlign: 'center' }}>
                                <div style={{ color: '#8e8e93', fontSize: '0.9rem', marginBottom: '0.5rem' }}>{language === 'ar' ? 'إجمالي الحوافز' : 'Total Bonuses'}</div>
                                <div style={{ color: '#2ecc71', fontSize: '1.5rem', fontWeight: 'bold' }}>+ {bonuses.toFixed(2)} EGP</div>
                              </div>
                              <div style={{ background: '#1c1c1e', border: '1px solid #333', borderRadius: '16px', padding: '1.5rem', textAlign: 'center' }}>
                                <div style={{ color: '#8e8e93', fontSize: '0.9rem', marginBottom: '0.5rem' }}>{language === 'ar' ? 'إجمالي السلف' : 'Total Advances'}</div>
                                <div style={{ color: '#eab308', fontSize: '1.5rem', fontWeight: 'bold' }}>- {advances.toFixed(2)} EGP</div>
                              </div>
                              <div style={{ background: '#1c1c1e', border: '1px solid #333', borderRadius: '16px', padding: '1.5rem', textAlign: 'center' }}>
                                <div style={{ color: '#8e8e93', fontSize: '0.9rem', marginBottom: '0.5rem' }}>{language === 'ar' ? 'إجمالي الخصومات والإجازات' : 'Discounts & Short Hours'}</div>
                                <div style={{ color: '#ef4444', fontSize: '1.5rem', fontWeight: 'bold' }}>- {totalDiscounts.toFixed(2)} EGP</div>
                              </div>
                              <div style={{ background: 'rgba(212,175,55,0.05)', border: '1px solid var(--gold-primary)', borderRadius: '16px', padding: '1.5rem', textAlign: 'center' }}>
                                <div style={{ color: 'var(--gold-primary)', fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: 'bold' }}>{language === 'ar' ? 'صافي الراتب المستحق' : 'Net Salary Due'}</div>
                                <div style={{ color: 'var(--gold-primary)', fontSize: '1.7rem', fontWeight: 'bold' }}>{netSalary.toFixed(2)} EGP</div>
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem' }}>
                            {/* Transactions List */}
                            <div className="table-panel" style={{ padding: '1.5rem' }}>
                              <h3 style={{ color: 'var(--gold-primary)', marginBottom: '1rem', borderBottom: '1px solid #333', paddingBottom: '0.5rem' }}>
                                {language === 'ar' ? 'المعاملات المالية والإجازات للشهر' : 'Monthly Financials & Leaves'}
                              </h3>
                              <div className="table-responsive">
                                <table className="admin-table">
                                  <thead>
                                    <tr>
                                      <th>{language === 'ar' ? 'التاريخ' : 'Date'}</th>
                                      <th>{language === 'ar' ? 'النوع' : 'Type'}</th>
                                      <th>{language === 'ar' ? 'المبلغ' : 'Amount'}</th>
                                      <th>{language === 'ar' ? 'ملاحظات' : 'Notes'}</th>
                                      <th>{language === 'ar' ? 'إجراءات' : 'Actions'}</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {txs.map(t => (
                                      <tr key={t.id}>
                                        <td className="font-en">{new Date(t.date).toLocaleDateString()}</td>
                                        <td>
                                          {t.type === 'advance' ? (language === 'ar' ? '💸 سلفة' : 'Advance') :
                                           t.type === 'bonus' ? (language === 'ar' ? '🟢 حافز' : 'Bonus') :
                                           t.type === 'discount' ? (language === 'ar' ? '🔴 خصم يدوي' : 'Manual Discount') :
                                           t.type === 'vacation_paid' ? (language === 'ar' ? '🏖️ إجازة مدفوعة' : 'Paid Vacation') :
                                           t.type === 'vacation_unpaid' ? (language === 'ar' ? '🏚️ إجازة غير مدفوعة' : 'Unpaid Vacation') : t.type}
                                        </td>
                                        <td className="font-en">
                                          {t.type === 'vacation_paid' || t.type === 'vacation_unpaid' ? '-' : `${t.amount.toFixed(2)} EGP`}
                                        </td>
                                        <td>{t.notes || '-'}</td>
                                        <td>
                                          <button className="btn-delete" onClick={() => handleDeleteTransaction(t.id)}>
                                            <Trash2 size={16} />
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                    {txs.length === 0 && (
                                      <tr><td colSpan={5} style={{ textAlign: 'center', padding: '1rem' }}>{language === 'ar' ? 'لا توجد معاملات مسجلة في هذا الشهر' : 'No transactions for this month'}</td></tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            {/* Monthly Attendance Table */}
                            <div className="table-panel" style={{ padding: '1.5rem' }}>
                              <h3 style={{ color: 'var(--gold-primary)', marginBottom: '1rem', borderBottom: '1px solid #333', paddingBottom: '0.5rem' }}>
                                {language === 'ar' ? 'سجل الحضور والانصراف للشهر' : 'Monthly Attendance Logs'}
                              </h3>
                              <div className="table-responsive">
                                <table className="admin-table">
                                  <thead>
                                    <tr>
                                      <th>{language === 'ar' ? 'التاريخ' : 'Date'}</th>
                                      <th>{language === 'ar' ? 'حضور' : 'Check In'}</th>
                                      <th>{language === 'ar' ? 'انصراف' : 'Check Out'}</th>
                                      <th>{language === 'ar' ? 'ساعات العمل' : 'Hours'}</th>
                                      <th>{language === 'ar' ? 'الخصم التلقائي' : 'Auto Deduction'}</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {attLogs.map(l => (
                                      <tr key={l.id}>
                                        <td className="font-en">{l.date}</td>
                                        <td className="font-en">{new Date(l.check_in_time).toLocaleTimeString('ar-EG')}</td>
                                        <td className="font-en">
                                          {l.check_out_time ? new Date(l.check_out_time).toLocaleTimeString('ar-EG') : <span style={{ color: 'var(--gold-primary)', fontWeight: 'bold' }}>{language === 'ar' ? 'نشط' : 'Active'}</span>}
                                        </td>
                                        <td className="font-en">{l.working_hours !== undefined ? `${l.working_hours} ساعة` : '-'}</td>
                                        <td className="font-en" style={{ color: (l.penalty_applied || 0) > 0 ? '#ff4d4d' : 'var(--text-gray)' }}>
                                          {(l.penalty_applied || 0) > 0 ? `${l.penalty_applied?.toFixed(2)} EGP` : '-'}
                                        </td>
                                      </tr>
                                    ))}
                                    {attLogs.length === 0 && (
                                      <tr><td colSpan={5} style={{ textAlign: 'center', padding: '1rem' }}>{language === 'ar' ? 'لا توجد سجلات حضور في هذا الشهر' : 'No attendance logs for this month'}</td></tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div>
                    {/* List of employees view */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                      <h2 style={{ color: 'var(--gold-primary)', margin: 0 }}>{language === 'ar' ? 'إدارة الموظفين والرواتب' : 'Employees & Payroll Management'}</h2>
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <div style={{ position: 'relative' }}>
                          <input 
                            type="text" 
                            className="input-gold" 
                            style={{ paddingLeft: '2.5rem', width: '250px' }}
                            placeholder={language === 'ar' ? 'بحث عن موظف بالاسم...' : 'Search employee by name...'}
                            value={empSearchQuery}
                            onChange={(e) => setEmpSearchQuery(e.target.value)}
                          />
                          <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--gold-primary)' }} />
                        </div>
                        <button className="btn-gold" onClick={() => {
                          setEditingEmployee(null);
                          setEmpName('');
                          setEmpPhone('');
                          setEmpSalary('');
                          setEmpAllowedVacations(4);
                          setEmpWorkingHours(9);
                          setEmpModalOpen(true);
                        }}>
                          <Plus size={18} /> {language === 'ar' ? 'إضافة موظف جديد' : 'Add Employee'}
                        </button>
                      </div>
                    </div>

                    <div className="table-panel">
                      <div className="table-responsive">
                        <table className="admin-table">
                          <thead>
                            <tr>
                              <th>{language === 'ar' ? 'اسم الموظف' : 'Employee Name'}</th>
                              <th>{language === 'ar' ? 'رقم الهاتف' : 'Phone'}</th>
                              <th>{language === 'ar' ? 'الراتب الأساسي' : 'Base Salary'}</th>
                              <th>{language === 'ar' ? 'الإجازات المسموحة شهرياً' : 'Allowed Leaves/Month'}</th>
                              <th>{language === 'ar' ? 'ساعات العمل اليومية' : 'Daily Working Hours'}</th>
                              <th>{language === 'ar' ? 'إجراءات' : 'Actions'}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {employees
                              .filter(e => e.name.toLowerCase().includes(empSearchQuery.toLowerCase()))
                              .map(emp => (
                                <tr key={emp.id}>
                                  <td style={{ fontWeight: 'bold', color: 'var(--gold-primary)' }}>{emp.name}</td>
                                  <td className="font-en">{emp.phone || '-'}</td>
                                  <td className="font-en">{emp.salary.toFixed(2)} EGP</td>
                                  <td className="font-en">{emp.allowed_vacations} {language === 'ar' ? 'أيام' : 'days'}</td>
                                  <td className="font-en">{emp.working_hours || 9} {language === 'ar' ? 'ساعة' : 'hours'}</td>
                                  <td>
                                    <div style={{ display: 'flex', gap: '0.8rem' }}>
                                      <button className="btn-gold" style={{ padding: '0.3rem 0.8rem', fontSize: '0.85rem' }} onClick={() => {
                                        setSelectedProfileMonth(getLocalMonthStr());
                                        setSelectedEmployee(emp);
                                      }}>
                                        👤 {language === 'ar' ? 'كشف الحساب والبروفايل' : 'View Profile'}
                                      </button>
                                      <button className="btn-outline-gold" style={{ padding: '0.3rem 0.8rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }} onClick={() => {
                                        setEditingEmployee(emp);
                                        setEmpName(emp.name);
                                        setEmpPhone(emp.phone || '');
                                        setEmpSalary(emp.salary);
                                        setEmpAllowedVacations(emp.allowed_vacations);
                                        setEmpWorkingHours(emp.working_hours !== undefined ? emp.working_hours : 9);
                                        setEmpModalOpen(true);
                                      }}>
                                        <Edit size={14} /> {language === 'ar' ? 'تعديل' : 'Edit'}
                                      </button>
                                      <button className="btn-delete" onClick={() => handleDeleteEmployee(emp.id)}>
                                        <Trash2 size={16} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            {employees.length === 0 && (
                              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '1.5rem' }}>{language === 'ar' ? 'لا يوجد موظفون مسجلون في النظام حالياً' : 'No employees registered yet'}</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB: DAILY ATTENDANCE LOG / سجل الحضور والانصراف */}
            {activeTab === 'attendance' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <h2 style={{ color: 'var(--gold-primary)', margin: 0 }}>{language === 'ar' ? 'سجل الحضور والانصراف اليومي' : 'Daily Attendance Log'}</h2>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type="text" 
                        className="input-gold" 
                        style={{ paddingLeft: '2.5rem', width: '220px' }}
                        placeholder={language === 'ar' ? 'بحث باسم الموظف...' : 'Search by employee...'}
                        value={attSearchQuery}
                        onChange={(e) => setAttSearchQuery(e.target.value)}
                      />
                      <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--gold-primary)' }} />
                    </div>
                    <input 
                      type="date" 
                      className="input-gold" 
                      style={{ width: '160px' }}
                      value={attDateFilter} 
                      onChange={(e) => setAttDateFilter(e.target.value)} 
                    />
                  </div>
                </div>

                <div className="table-panel">
                  <div className="table-responsive">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>{language === 'ar' ? 'الموظف' : 'Employee'}</th>
                          <th>{language === 'ar' ? 'تاريخ الوردية' : 'Shift Date'}</th>
                          <th>{language === 'ar' ? 'حضور' : 'Check In'}</th>
                          <th>{language === 'ar' ? 'صورة الحضور' : 'Check In Photo'}</th>
                          <th>{language === 'ar' ? 'انصراف' : 'Check Out'}</th>
                          <th>{language === 'ar' ? 'صورة الانصراف' : 'Check Out Photo'}</th>
                          <th>{language === 'ar' ? 'ساعات العمل' : 'Working Hours'}</th>
                          <th>{language === 'ar' ? 'خصم التأخر (< 9ساعات)' : 'Short Hours Penalty'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendanceLogs
                          .filter(l => {
                            const matchName = l.employee_name.toLowerCase().includes(attSearchQuery.toLowerCase());
                            const matchDate = l.date === attDateFilter;
                            return matchName && matchDate;
                          })
                          .map(log => (
                            <tr key={log.id}>
                              <td style={{ fontWeight: 'bold' }}>{log.employee_name}</td>
                              <td className="font-en">{log.date}</td>
                              <td className="font-en">{new Date(log.check_in_time).toLocaleTimeString('ar-EG')}</td>
                              <td>
                                {log.check_in_photo ? (
                                  <img 
                                    src={log.check_in_photo} 
                                    alt="Check In" 
                                    style={{ width: '50px', height: '40px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #333', cursor: 'pointer' }}
                                    onClick={() => {
                                      const w = window.open();
                                      w?.document.write(`<img src="${log.check_in_photo}" style="width:100%; max-width:800px; display:block; margin:auto;" />`);
                                    }}
                                  />
                                ) : '-'}
                              </td>
                              <td className="font-en">
                                {log.check_out_time ? new Date(log.check_out_time).toLocaleTimeString('ar-EG') : <span style={{ color: 'var(--gold-primary)', fontWeight: 'bold' }}>{language === 'ar' ? 'قيد العمل' : 'On Duty'}</span>}
                              </td>
                              <td>
                                {log.check_out_photo ? (
                                  <img 
                                    src={log.check_out_photo} 
                                    alt="Check Out" 
                                    style={{ width: '50px', height: '40px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #333', cursor: 'pointer' }}
                                    onClick={() => {
                                      const w = window.open();
                                      w?.document.write(`<img src="${log.check_out_photo}" style="width:100%; max-width:800px; display:block; margin:auto;" />`);
                                    }}
                                  />
                                ) : '-'}
                              </td>
                              <td className="font-en">{log.working_hours !== undefined ? `${log.working_hours} ساعة` : '-'}</td>
                              <td className="font-en" style={{ color: (log.penalty_applied || 0) > 0 ? '#ff4d4d' : 'var(--text-gray)' }}>
                                {(log.penalty_applied || 0) > 0 ? `${log.penalty_applied?.toFixed(2)} EGP` : '-'}
                              </td>
                            </tr>
                          ))}
                        {attendanceLogs.filter(l => l.date === attDateFilter).length === 0 && (
                          <tr><td colSpan={8} style={{ textAlign: 'center', padding: '1.5rem' }}>{language === 'ar' ? 'لا توجد سجلات حضور مسجلة لهذا اليوم' : 'No attendance logs for this day'}</td></tr>
                        )}
                      </tbody>
                    </table>
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
                  <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr auto', gap: '0.5rem', alignItems: 'end', marginBottom: '1rem' }}>
                    <div>
                      <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem' }}>{language === 'ar' ? 'اختر مادة مصنعة/خام من المخزن' : 'Select Material'}</label>
                      <select 
                        className="input-gold" 
                        value={selectedInvItemId} 
                        onChange={(e) => setSelectedInvItemId(e.target.value)}
                        style={{ height: '42px', width: '100%', background: '#000', border: '1px solid var(--gold-secondary)' }}
                      >
                        <option value="">{language === 'ar' ? '-- اختر مكون --' : '-- Select Ingredient --'}</option>
                        {inventoryItems
                          .slice()
                          .sort((a, b) => (b.is_manufactured ? 1 : 0) - (a.is_manufactured ? 1 : 0))
                          .map(item => (
                          <option key={item.id} value={item.id} style={{ background: '#121212' }}>
                            {item.is_manufactured ? '📦 [مصنع]' : '🌾 [خام]'} {item.name} ({item.unit})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem' }}>
                        {language === 'ar' ? 'الكمية' : 'Qty'}
                      </label>
                      <div style={{ display: 'flex' }}>
                        <input 
                          type="number" 
                          step="0.001" 
                          className="input-gold" 
                          value={recipeItemQty} 
                          onChange={(e) => setRecipeItemQty(e.target.value)} 
                          placeholder="0.200"
                          style={{ height: '42px', width: '100%', borderTopRightRadius: language === 'ar' ? '10px' : '0', borderBottomRightRadius: language === 'ar' ? '10px' : '0', borderTopLeftRadius: language === 'en' ? '10px' : '0', borderBottomLeftRadius: language === 'en' ? '10px' : '0' }}
                        />
                        <select 
                          className="input-gold"
                          value={recipeItemUnitMode}
                          onChange={(e) => setRecipeItemUnitMode(e.target.value as 'base' | 'sub')}
                          style={{ height: '42px', minWidth: '60px', borderTopRightRadius: language === 'en' ? '10px' : '0', borderBottomRightRadius: language === 'en' ? '10px' : '0', borderTopLeftRadius: language === 'ar' ? '10px' : '0', borderBottomLeftRadius: language === 'ar' ? '10px' : '0', borderRight: 'none' }}
                        >
                          <option value="base">{selectedInvItemId ? inventoryItems.find(i => i.id === selectedInvItemId)?.unit : '-'}</option>
                          {selectedInvItemId && getSubUnitLabel(inventoryItems.find(i => i.id === selectedInvItemId)?.unit || '') && (
                            <option value="sub">{getSubUnitLabel(inventoryItems.find(i => i.id === selectedInvItemId)?.unit || '')}</option>
                          )}
                        </select>
                      </div>
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
                    style={{ appearance: 'none', background: 'rgba(0,0,0,0.4)', color: '#fff', border: '1px solid var(--gold-secondary)', marginBottom: expType === 'custom' ? '1rem' : '0' }}
                  >
                    {Array.from(new Set([
                      'بضائع وخامات', 'مرتبات', 'إيجار', 'خدمات (كهرباء ومياه)', 'صيانة', 'تسويق', 'أخرى',
                      ...expenses.map(e => e.type).filter(Boolean)
                    ])).map(t => (
                      <option key={t} value={t} style={{ background: '#1c1c1c', color: '#fff' }}>{t}</option>
                    ))}
                    <option value="custom" style={{ background: 'var(--gold-primary)', color: '#000', fontWeight: 'bold' }}>
                      + {language === 'ar' ? 'إضافة تصنيف جديد...' : 'Add new category...'}
                    </option>
                  </select>
                  {expType === 'custom' && (
                    <input 
                      type="text" 
                      className="input-gold" 
                      placeholder={language === 'ar' ? 'اكتب التصنيف الجديد هنا...' : 'Type new category here...'} 
                      value={customExpType} 
                      onChange={(e) => setCustomExpType(e.target.value)} 
                      required 
                      autoFocus
                    />
                  )}
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
                <div className="form-group">
                  <label>{language === 'ar' ? 'المسمى الوظيفي (اختياري)' : 'Job Title (Optional)'}</label>
                  <input type="text" className="input-gold" placeholder={language === 'ar' ? 'مثال: أمين مخزن، مسؤول توزيع...' : 'e.g. Inventory Manager'} value={sysJobTitle} onChange={e => setSysJobTitle(e.target.value)} />
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
                <div className="form-group">
                  <label>{language === 'ar' ? 'الحد الأدنى للقطعة' : 'Low Stock Threshold'}</label>
                  <input type="number" className="input-gold" min="0" value={invLowStockThreshold} onChange={e => setInvLowStockThreshold(e.target.value ? Number(e.target.value) : '')} placeholder={language === 'ar' ? 'أدخل الحد الأدنى للتنبيه عند النفاذ' : 'Minimum amount for low stock alert'} />
                </div>
                <div className="form-group" style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                    <input 
                      type="radio" 
                      name="invTargetType" 
                      value="raw" 
                      checked={invTargetType === 'raw'} 
                      onChange={() => setInvTargetType('raw')} 
                      style={{ accentColor: 'var(--gold-primary)' }}
                    />
                    {language === 'ar' ? 'خامة / مكون (مخزن رئيسي)' : 'Raw Material (Main)'}
                  </label>
                  <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                    <input 
                      type="radio" 
                      name="invTargetType" 
                      value="manufactured" 
                      checked={invTargetType === 'manufactured'} 
                      onChange={() => setInvTargetType('manufactured')}
                      style={{ accentColor: 'var(--gold-primary)' }}
                    />
                    {language === 'ar' ? 'منتج توزيع جاهز (له مكونات)' : 'Finished Product (Has BOM)'}
                  </label>
                </div>

                {invTargetType === 'manufactured' && (
                  <div style={{ marginTop: '1.5rem', padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'rgba(0,0,0,0.2)' }}>
                    <h3 style={{ marginBottom: '1rem', color: 'var(--gold-secondary)' }}>
                      {language === 'ar' ? 'مكونات المنتج من المخزن الرئيسي' : 'Product Ingredients from Main Warehouse'}
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr auto', gap: '0.5rem', marginBottom: '1rem', alignItems: 'end' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>{language === 'ar' ? 'الخامة' : 'Ingredient'}</label>
                        <select className="input-gold" value={invRecipeSelIngredient} onChange={e => {
                          setInvRecipeSelIngredient(e.target.value);
                          setInvRecipeSelUnitMode('base');
                        }}>
                          <option value="">{language === 'ar' ? '-- اختر الخامة --' : '-- Select Ingredient --'}</option>
                          {inventoryItems.filter(i => !i.is_manufactured).map(i => (
                            <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>{language === 'ar' ? 'الكمية' : 'Quantity'}</label>
                        <div style={{ display: 'flex' }}>
                          <input 
                            type="number" 
                            step="0.01" 
                            className="input-gold" 
                            value={invRecipeSelQuantity} 
                            onChange={e => setInvRecipeSelQuantity(e.target.value)} 
                            style={{ borderTopRightRadius: language === 'ar' ? '10px' : '0', borderBottomRightRadius: language === 'ar' ? '10px' : '0', borderTopLeftRadius: language === 'en' ? '10px' : '0', borderBottomLeftRadius: language === 'en' ? '10px' : '0' }}
                          />
                          <select 
                            className="input-gold"
                            value={invRecipeSelUnitMode}
                            onChange={(e) => setInvRecipeSelUnitMode(e.target.value as 'base' | 'sub')}
                            style={{ minWidth: '80px', borderTopRightRadius: language === 'en' ? '10px' : '0', borderBottomRightRadius: language === 'en' ? '10px' : '0', borderTopLeftRadius: language === 'ar' ? '10px' : '0', borderBottomLeftRadius: language === 'ar' ? '10px' : '0', borderRight: 'none' }}
                          >
                            <option value="base">{invRecipeSelIngredient ? inventoryItems.find(i => i.id === invRecipeSelIngredient)?.unit : '-'}</option>
                            {invRecipeSelIngredient && getSubUnitLabel(inventoryItems.find(i => i.id === invRecipeSelIngredient)?.unit || '') && (
                              <option value="sub">{getSubUnitLabel(inventoryItems.find(i => i.id === invRecipeSelIngredient)?.unit || '')}</option>
                            )}
                          </select>
                        </div>
                      </div>
                      <button 
                        type="button" 
                        className="btn-gold" 
                        style={{ height: '42px', padding: '0 1rem', margin: 0 }}
                        onClick={() => {
                          if (!invRecipeSelIngredient || !invRecipeSelQuantity) return;
                          const ingItem = inventoryItems.find(i => i.id === invRecipeSelIngredient);
                          if (!ingItem) return;
                          
                          if (invRecipes.some(r => r.ingredient_item_id === invRecipeSelIngredient)) {
                            alert(language === 'ar' ? 'هذه الخامة مضافة بالفعل!' : 'Ingredient already added!');
                            return;
                          }
                          
                          setInvRecipes([...invRecipes, {
                            ingredient_item_id: invRecipeSelIngredient,
                            quantity: computeFinalQty(Number(invRecipeSelQuantity), invRecipeSelUnitMode, ingItem.unit),
                            ingredient_name: ingItem.name,
                            ingredient_unit: ingItem.unit
                          }]);
                          setInvRecipeSelIngredient('');
                          setInvRecipeSelQuantity('');
                          setInvRecipeSelUnitMode('base');
                        }}
                      >
                        <Plus size={16} />
                      </button>
                    </div>

                    {invRecipes.length > 0 && (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                        <thead>
                          <tr style={{ background: 'rgba(212, 175, 55, 0.05)', borderBottom: '1px solid var(--border-color)' }}>
                            <th style={{ textAlign: language === 'ar' ? 'right' : 'left', padding: '0.5rem 1rem' }}>{language === 'ar' ? 'الخامة' : 'Ingredient'}</th>
                            <th style={{ textAlign: 'center', padding: '0.5rem 1rem' }}>{language === 'ar' ? 'الكمية' : 'Quantity'}</th>
                            <th style={{ textAlign: 'center', padding: '0.5rem 1rem' }}>{language === 'ar' ? 'حذف' : 'Remove'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invRecipes.map(r => (
                            <tr key={r.ingredient_item_id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '0.5rem 1rem', fontWeight: 'bold' }}>{r.ingredient_name}</td>
                              <td style={{ padding: '0.5rem 1rem', textAlign: 'center' }}>{r.quantity} <span style={{ color: 'var(--text-muted)' }}>{r.ingredient_unit}</span></td>
                              <td style={{ padding: '0.5rem 1rem', textAlign: 'center' }}>
                                <button 
                                  type="button" 
                                  style={{ background: 'none', border: 'none', color: '#ff4d4d', cursor: 'pointer' }}
                                  onClick={() => setInvRecipes(invRecipes.filter(x => x.ingredient_item_id !== r.ingredient_item_id))}
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
              <div className="admin-modal-footer">
                <button type="button" className="btn-outline-gold" onClick={() => {
                  setInvModalOpen(false);
                  setEditingInvItem(null);
                }}>{t.close}</button>
                <button type="submit" className="btn-gold" disabled={loading}>{t.save}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manufacturing Recipe (BOM) Modal */}
      {mfgRecipeModalOpen && activeMfgItem && (
        <div className="admin-modal-overlay" onClick={() => setMfgRecipeModalOpen(false)}>
          <div className="admin-modal" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.8rem' }}>
              <h2>{language === 'ar' ? `وصفة تصنيع: ${activeMfgItem.name}` : `BOM: ${activeMfgItem.name}`}</h2>
              <button className="btn-close" onClick={() => setMfgRecipeModalOpen(false)}><X size={20} /></button>
            </div>
            
            <div className="admin-modal-body" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
              <div style={{ background: 'rgba(212, 175, 55, 0.05)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid rgba(212, 175, 55, 0.2)' }}>
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--gold-secondary)' }}>
                  {language === 'ar' ? `حدد الخامات التي يتم سحبها من المطبخ لإنتاج (1 ${activeMfgItem.unit}) من ${activeMfgItem.name}.` : `Select the ingredients deducted from factory to produce (1 ${activeMfgItem.unit}) of ${activeMfgItem.name}.`}
                </p>
              </div>

              {/* Add Ingredient Form */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr auto', gap: '0.5rem', marginBottom: '1.5rem', alignItems: 'end' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>{language === 'ar' ? 'الخامة' : 'Ingredient'}</label>
                  <select className="input-gold" value={mfgSelIngredient} onChange={e => setMfgSelIngredient(e.target.value)}>
                    <option value="">{language === 'ar' ? '-- اختر الخامة --' : '-- Select Ingredient --'}</option>
                    {inventoryItems.filter(i => i.id !== activeMfgItem.id).map(i => (
                      <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>{language === 'ar' ? 'الكمية' : 'Quantity'}</label>
                  <div style={{ display: 'flex' }}>
                    <input 
                      type="number" 
                      step="0.01" 
                      className="input-gold" 
                      value={mfgSelQuantity} 
                      onChange={e => setMfgSelQuantity(e.target.value)} 
                      style={{ borderTopRightRadius: language === 'ar' ? '10px' : '0', borderBottomRightRadius: language === 'ar' ? '10px' : '0', borderTopLeftRadius: language === 'en' ? '10px' : '0', borderBottomLeftRadius: language === 'en' ? '10px' : '0' }}
                    />
                    <select 
                      className="input-gold"
                      value={mfgSelUnitMode}
                      onChange={(e) => setMfgSelUnitMode(e.target.value as 'base' | 'sub')}
                      style={{ minWidth: '80px', borderTopRightRadius: language === 'en' ? '10px' : '0', borderBottomRightRadius: language === 'en' ? '10px' : '0', borderTopLeftRadius: language === 'ar' ? '10px' : '0', borderBottomLeftRadius: language === 'ar' ? '10px' : '0', borderRight: 'none' }}
                    >
                      <option value="base">{mfgSelIngredient ? inventoryItems.find(i => i.id === mfgSelIngredient)?.unit : '-'}</option>
                      {mfgSelIngredient && getSubUnitLabel(inventoryItems.find(i => i.id === mfgSelIngredient)?.unit || '') && (
                        <option value="sub">{getSubUnitLabel(inventoryItems.find(i => i.id === mfgSelIngredient)?.unit || '')}</option>
                      )}
                    </select>
                  </div>
                </div>
                <button 
                  type="button" 
                  className="btn-gold" 
                  style={{ height: '42px', padding: '0 1rem', margin: 0 }}
                  onClick={() => {
                    if (!mfgSelIngredient || !mfgSelQuantity) return;
                    const ingItem = inventoryItems.find(i => i.id === mfgSelIngredient);
                    if (!ingItem) return;
                    
                    if (activeMfgRecipes.some(r => r.ingredient_item_id === mfgSelIngredient)) {
                      alert(language === 'ar' ? 'هذه الخامة مضافة بالفعل!' : 'Ingredient already added!');
                      return;
                    }
                    
                    setActiveMfgRecipes([...activeMfgRecipes, {
                      ingredient_item_id: mfgSelIngredient,
                      quantity: computeFinalQty(Number(mfgSelQuantity), mfgSelUnitMode, ingItem.unit),
                      ingredient_name: ingItem.name,
                      ingredient_unit: ingItem.unit
                    }]);
                    setMfgSelIngredient('');
                    setMfgSelQuantity('');
                    setMfgSelUnitMode('base');
                  }}
                >
                  <Plus size={16} />
                </button>
              </div>

              {/* Recipe Ingredients List */}
              {activeMfgRecipes.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
                  {language === 'ar' ? 'لا توجد مكونات بعد.' : 'No ingredients yet.'}
                </p>
              ) : (
                <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead>
                      <tr style={{ background: 'rgba(212, 175, 55, 0.05)', borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ textAlign: language === 'ar' ? 'right' : 'left', padding: '0.5rem 1rem', color: 'var(--gold-secondary)' }}>{language === 'ar' ? 'الخامة' : 'Ingredient'}</th>
                        <th style={{ textAlign: 'center', padding: '0.5rem 1rem', color: 'var(--gold-secondary)' }}>{language === 'ar' ? 'الكمية' : 'Quantity'}</th>
                        <th style={{ textAlign: 'center', padding: '0.5rem 1rem', color: 'var(--gold-secondary)' }}>{language === 'ar' ? 'حذف' : 'Remove'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeMfgRecipes.map(r => (
                        <tr key={r.ingredient_item_id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.5rem 1rem', fontWeight: 'bold', textAlign: language === 'ar' ? 'right' : 'left' }}>{r.ingredient_name}</td>
                          <td style={{ padding: '0.5rem 1rem', textAlign: 'center' }}>{r.quantity} <span style={{ color: 'var(--text-muted)' }}>{r.ingredient_unit}</span></td>
                          <td style={{ padding: '0.5rem 1rem', textAlign: 'center' }}>
                            <button 
                              type="button" 
                              style={{ background: 'none', border: 'none', color: '#ff4d4d', cursor: 'pointer' }}
                              onClick={() => {
                                setActiveMfgRecipes(activeMfgRecipes.filter(x => x.ingredient_item_id !== r.ingredient_item_id));
                              }}
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
            
            <div className="admin-modal-footer">
              <button type="button" className="btn-outline-gold" onClick={() => setMfgRecipeModalOpen(false)}>{t.close}</button>
              <button 
                type="button" 
                className="btn-gold" 
                onClick={async () => {
                  setLoading(true);
                  try {
                    await db.saveManufacturingRecipe(activeMfgItem.id, activeMfgRecipes);
                    setMfgRecipeModalOpen(false);
                  } catch (e) {
                    console.error(e);
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                {t.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Stock Modal */}
      {editStockModalOpen && editStockItem && (
        <div className="admin-modal-overlay" onClick={() => setEditStockModalOpen(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>{language === 'ar' ? 'تسوية جردية للرصيد' : 'Stock Adjustment'} - {editStockItem.name}</h2>
              <button className="btn-close" onClick={() => setEditStockModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveStockAdjustment}>
              <div className="admin-modal-body">
                <p style={{ marginBottom: '1rem', color: 'var(--text-gray)' }}>
                  {language === 'ar' ? 'المخزن المحدد: ' : 'Selected Warehouse: '}
                  <strong>
                    {inventoryWarehouseFilter === 'main' ? (language === 'ar' ? 'الرئيسي' : 'Main') :
                     inventoryWarehouseFilter === 'factory' ? (language === 'ar' ? 'المصنع' : 'Factory') :
                     (language === 'ar' ? 'التوزيع' : 'Distribution')}
                  </strong>
                </p>
                <div className="form-group">
                  <label>{language === 'ar' ? 'كمية الإضافة / الخصم (+ او -)' : 'Adjustment Quantity (+ or -)'} *</label>
                  <input 
                    type="number" 
                    className="input-gold" 
                    value={editStockAdjustment} 
                    onChange={e => setEditStockAdjustment(Number(e.target.value))} 
                    required 
                    step="0.01"
                  />
                  <small style={{ color: 'var(--text-gray)', marginTop: '0.5rem', display: 'block' }}>
                    {language === 'ar' ? 'استخدم رقم موجب للإضافة، ورقم سالب للخصم.' : 'Use positive for addition, negative for deduction.'}
                  </small>
                </div>
              </div>
              <div className="admin-modal-footer">
                <button type="button" className="btn-outline-gold" onClick={() => setEditStockModalOpen(false)}>{t.close}</button>
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
              
              <div style={{ background: 'var(--surface-color, #1c1c1c)', padding: '1.25rem', borderRadius: '12px', marginBottom: '1rem', border: '1px solid rgba(212,175,55,0.2)' }}>
                <h3 style={{ marginBottom: '1rem', color: 'var(--gold-primary)' }}>{language === 'ar' ? '➕ إضافة صنف' : '➕ Add Item'}</h3>

                {/* Add item row — بحث بالاسم */}
                <div style={{ display: 'grid', gridTemplateColumns: '2.4fr 1fr 1.2fr auto', gap: '0.6rem', alignItems: 'start' }}>
                  {/* searchable combobox */}
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      className="input-gold"
                      style={{ padding: '0.6rem', width: '100%' }}
                      placeholder={language === 'ar' ? '🔍 ابحث باسم الصنف...' : '🔍 Search item by name...'}
                      value={invItemSearch}
                      onChange={(e) => { setInvItemSearch(e.target.value); setInvNewItemId(''); setInvShowSuggest(true); }}
                      onFocus={() => setInvShowSuggest(true)}
                      onBlur={() => setTimeout(() => setInvShowSuggest(false), 150)}
                    />
                    {invShowSuggest && invItemSearch.trim() !== '' && !invNewItemId && (
                      <div style={{ position: 'absolute', top: '100%', insetInlineStart: 0, insetInlineEnd: 0, zIndex: 20, background: '#15171c', border: '1px solid var(--gold-primary)', borderRadius: '8px', marginTop: '4px', maxHeight: '240px', overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                        {inventoryItems.filter(i => i.name.toLowerCase().includes(invItemSearch.trim().toLowerCase())).slice(0, 12).map(i => (
                          <div
                            key={i.id}
                            onMouseDown={(e) => { e.preventDefault(); setInvNewItemId(i.id); setInvItemSearch(i.name); setInvNewPrice(String(i.last_purchase_price || i.avg_purchase_price || '')); setInvShowSuggest(false); }}
                            style={{ padding: '0.55rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(212,175,55,0.15)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          >
                            <span>{i.name}</span>
                            <span style={{ color: 'var(--text-gray)', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{language === 'ar' ? 'آخر:' : 'Last:'} {i.last_purchase_price.toFixed(2)} · {i.unit}</span>
                          </div>
                        ))}
                        {inventoryItems.filter(i => i.name.toLowerCase().includes(invItemSearch.trim().toLowerCase())).length === 0 && (
                          <div style={{ padding: '0.6rem 0.75rem', color: 'var(--text-gray)' }}>{language === 'ar' ? 'لا يوجد صنف بهذا الاسم' : 'No matching item'}</div>
                        )}
                      </div>
                    )}
                  </div>
                  <input type="number" className="input-gold" placeholder={language === 'ar' ? 'الكمية' : 'Qty'} style={{ padding: '0.6rem' }} step="0.01" min="0.01" value={invNewQty} onChange={(e) => setInvNewQty(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addInvoiceItemToCart(); }} />
                  <input type="number" className="input-gold" placeholder={language === 'ar' ? 'سعر الوحدة' : 'Unit Price'} style={{ padding: '0.6rem' }} step="0.01" min="0" value={invNewPrice} onChange={(e) => setInvNewPrice(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addInvoiceItemToCart(); }} />
                  <button type="button" className="btn-gold" style={{ padding: '0.6rem 1rem', whiteSpace: 'nowrap' }} onClick={addInvoiceItemToCart}>
                    <Plus size={16} /> {language === 'ar' ? 'إضافة' : 'Add'}
                  </button>
                </div>
                {invNewItemId && (() => {
                  const sel = inventoryItems.find(i => i.id === invNewItemId);
                  return (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-gray)', marginTop: '0.5rem' }}>
                      {language === 'ar' ? `الصنف المختار: ${sel?.name} — الوحدة: ${sel?.unit} — المتاح بالرئيسي: ${sel?.stock_main || 0}` : `Selected: ${sel?.name} — unit: ${sel?.unit} — in main: ${sel?.stock_main || 0}`}
                    </p>
                  );
                })()}

                {/* Cart list */}
                {invoiceCart.length > 0 ? (
                  <table className="admin-table" style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
                    <thead>
                      <tr>
                        <th>{language === 'ar' ? 'الصنف' : 'Item'}</th>
                        <th>{language === 'ar' ? 'الكمية' : 'Qty'}</th>
                        <th>{language === 'ar' ? 'سعر الوحدة' : 'Unit Price'}</th>
                        <th>{language === 'ar' ? 'الإجمالي' : 'Total'}</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceCart.map((c, idx) => {
                        const item = inventoryItems.find(i => i.id === c.item_id);
                        return (
                          <tr key={idx}>
                            <td>{item?.name} <span style={{ color: 'var(--text-gray)', fontSize: '0.78rem' }}>({item?.unit})</span></td>
                            <td>{c.quantity}</td>
                            <td>{c.unit_price}</td>
                            <td style={{ color: 'var(--gold-primary)', fontWeight: 'bold' }}>{(c.quantity * c.unit_price).toFixed(2)}</td>
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
                ) : (
                  <p style={{ marginTop: '1rem', color: 'var(--text-gray)', fontSize: '0.85rem', textAlign: 'center' }}>
                    {language === 'ar' ? 'لم تتم إضافة أصناف بعد — ابحث عن الصنف وحدّد الكمية والسعر ثم اضغط «إضافة».' : 'No items yet — search an item, set qty & price, then click "Add".'}
                  </p>
                )}
              </div>
              <div style={{ textAlign: 'left', marginTop: '1rem' }}>
                <h3>{language === 'ar' ? 'إجمالي الفاتورة: ' : 'Invoice Total: '} <span style={{ color: 'var(--gold-primary)' }}>{invoiceCart.reduce((sum, c) => sum + (c.quantity * c.unit_price), 0).toFixed(2)}</span></h3>
              </div>

              {/* Payment Details */}
              <div style={{ background: '#222', padding: '1rem', borderRadius: '8px', marginTop: '1rem' }}>
                <h3 style={{ marginBottom: '1rem', color: 'var(--gold-primary)' }}>{language === 'ar' ? 'تفاصيل السداد (طرق الدفع)' : 'Payment Details'}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label>{language === 'ar' ? 'مدفوع نقدًا (كاش)' : 'Paid Cash'}</label>
                    <input type="number" className="input-gold" value={invoicePaidCash} onChange={e => setInvoicePaidCash(e.target.value === '' ? '' : parseFloat(e.target.value))} placeholder="0.00" min="0" step="0.01" />
                  </div>
                  <div className="form-group">
                    <label>{language === 'ar' ? 'مدفوع فيزا' : 'Paid Visa'}</label>
                    <input type="number" className="input-gold" value={invoicePaidVisa} onChange={e => setInvoicePaidVisa(e.target.value === '' ? '' : parseFloat(e.target.value))} placeholder="0.00" min="0" step="0.01" />
                  </div>
                  <div className="form-group">
                    <label>{language === 'ar' ? 'مدفوع محفظة' : 'Paid Wallet'}</label>
                    <input type="number" className="input-gold" value={invoicePaidWallet} onChange={e => setInvoicePaidWallet(e.target.value === '' ? '' : parseFloat(e.target.value))} placeholder="0.00" min="0" step="0.01" />
                  </div>
                  <div className="form-group">
                    <label>{language === 'ar' ? 'مدفوع إنستاباي' : 'Paid Instapay'}</label>
                    <input type="number" className="input-gold" value={invoicePaidInstapay} onChange={e => setInvoicePaidInstapay(e.target.value === '' ? '' : parseFloat(e.target.value))} placeholder="0.00" min="0" step="0.01" />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', padding: '0.5rem', background: '#333', borderRadius: '4px' }}>
                  <span style={{ fontWeight: 'bold' }}>{language === 'ar' ? 'المبلغ المتبقي (آجل):' : 'Remaining Amount (Credit):'}</span>
                  <span style={{ color: (invoiceCart.reduce((sum, c) => sum + (c.quantity * c.unit_price), 0) - ((Number(invoicePaidCash) || 0) + (Number(invoicePaidVisa) || 0) + (Number(invoicePaidWallet) || 0) + (Number(invoicePaidInstapay) || 0))) > 0 ? '#ff4d4d' : '#2ecc71', fontWeight: 'bold' }}>
                    {Math.max(0, invoiceCart.reduce((sum, c) => sum + (c.quantity * c.unit_price), 0) - ((Number(invoicePaidCash) || 0) + (Number(invoicePaidVisa) || 0) + (Number(invoicePaidWallet) || 0) + (Number(invoicePaidInstapay) || 0))).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
            <div className="admin-modal-footer">
              <button type="button" className="btn-outline-gold" onClick={() => setInvoiceModalOpen(false)}>{t.close}</button>
              <button type="button" className="btn-gold" onClick={handleSavePurchaseInvoice} disabled={loading || (invoiceCart.length === 0 && !buildPendingInvoiceItem())}>{loading ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') : t.save}</button>
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
                
                {/* Add item row — اختر الخامة فيظهر المتاح بالرئيسي، والكمية بوحدة الصنف نفسه */}
                {(() => {
                  const selRaw = inventoryItems.find(i => i.id === mfgNewItemId);
                  const availMain = selRaw?.stock_main || 0;
                  return (
                  <>
                  {/* search input (full width) */}
                  <input
                    type="text"
                    className="input-gold"
                    style={{ padding: '0.55rem', width: '100%', marginBottom: '0.4rem' }}
                    placeholder={language === 'ar' ? '🔍 ابحث باسم الخامة...' : '🔍 Search material by name...'}
                    value={mfgItemSearch}
                    onChange={(e) => { setMfgItemSearch(e.target.value); setMfgNewItemId(''); setMfgShowSuggest(true); }}
                    onFocus={() => setMfgShowSuggest(true)}
                  />
                  {/* inline suggestions (in normal flow so the modal never clips them) */}
                  {mfgShowSuggest && mfgItemSearch.trim() !== '' && !mfgNewItemId && (
                    <div style={{ background: '#15171c', border: '1px solid var(--gold-primary)', borderRadius: '8px', marginBottom: '0.5rem', maxHeight: '220px', overflowY: 'auto' }}>
                      {inventoryItems.filter(i => !i.is_manufactured && i.name.toLowerCase().includes(mfgItemSearch.trim().toLowerCase())).slice(0, 30).map(i => (
                        <div
                          key={i.id}
                          onClick={() => { setMfgNewItemId(i.id); setMfgItemSearch(i.name); setMfgShowSuggest(false); }}
                          style={{ padding: '0.55rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(212,175,55,0.15)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          <span>{i.name}</span>
                          <span style={{ color: 'var(--text-gray)', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{language === 'ar' ? 'المتاح:' : 'Avail:'} {i.stock_main || 0} · {i.unit}</span>
                        </div>
                      ))}
                      {inventoryItems.filter(i => !i.is_manufactured && i.name.toLowerCase().includes(mfgItemSearch.trim().toLowerCase())).length === 0 && (
                        <div style={{ padding: '0.6rem 0.75rem', color: 'var(--text-gray)' }}>{language === 'ar' ? 'لا توجد خامة بهذا الاسم' : 'No matching material'}</div>
                      )}
                    </div>
                  )}
                  {/* qty + unit + add */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                    <input type="number" id="mfg-new-qty" className="input-gold" placeholder={language === 'ar' ? 'الكمية' : 'Qty'} style={{ padding: '0.55rem' }} step="0.01" min="0.01" onKeyDown={(e) => { if (e.key === 'Enter') (document.getElementById('mfg-add-btn') as HTMLButtonElement)?.click(); }} />
                    <span style={{ color: 'var(--gold-primary)', fontWeight: 'bold', minWidth: '3rem', textAlign: 'center' }}>{selRaw?.unit || '—'}</span>
                    <button id="mfg-add-btn" type="button" className="btn-gold" style={{ padding: '0.55rem 1rem', whiteSpace: 'nowrap' }} onClick={() => {
                      const qtyEl = document.getElementById('mfg-new-qty') as HTMLInputElement;
                      const qty = parseFloat(qtyEl.value);
                      if (mfgNewItemId && qty > 0 && selRaw) {
                        setMfgCart([...mfgCart, { item_id: mfgNewItemId, item_name: selRaw.name, quantity: qty, unit: selRaw.unit, calculated_main_quantity: qty }]);
                        setMfgNewItemId(''); setMfgItemSearch(''); qtyEl.value = '';
                      } else {
                        alert(language === 'ar' ? 'ابحث واختر خامة وأدخل كمية صحيحة' : 'Search & pick a material and enter a valid quantity');
                      }
                    }}>
                      <Plus size={16} /> {language === 'ar' ? 'إضافة' : 'Add'}
                    </button>
                  </div>
                  {selRaw && (
                    <p style={{ fontSize: '0.8rem', marginBottom: '1rem', color: availMain > 0 ? '#10b981' : '#ef4444' }}>
                      {language === 'ar' ? `المتاح من «${selRaw.name}» بالمخزن الرئيسي: ${availMain} ${selRaw.unit}` : `Available of "${selRaw.name}" in main: ${availMain} ${selRaw.unit}`}
                    </p>
                  )}
                  </>
                  );
                })()}

                {/* Cart list */}
                {mfgCart.length > 0 && (
                  <table className="admin-table" style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
                    <thead>
                      <tr>
                        <th>{language === 'ar' ? 'الصنف' : 'Item'}</th>
                        <th>{language === 'ar' ? 'الكمية المطلوبة' : 'Requested Qty'}</th>
                        <th>{language === 'ar' ? 'المتاح بالرئيسي' : 'In Main'}</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {mfgCart.map((c, idx) => {
                        const it = inventoryItems.find(i => i.id === c.item_id);
                        const available = it?.stock_main || 0;
                        const short = c.quantity > available;
                        return (
                        <tr key={idx} style={short ? { background: 'rgba(239,68,68,0.12)' } : undefined}>
                          <td>{c.item_name}</td>
                          <td style={{ color: short ? '#ef4444' : undefined, fontWeight: short ? 'bold' : undefined }}>{c.quantity} {c.unit}</td>
                          <td style={{ color: short ? '#ef4444' : '#10b981' }}>{available} {c.unit}{short ? (language === 'ar' ? ' ⚠ غير كافٍ' : ' ⚠ short') : ''}</td>
                          <td>
                            <button type="button" style={{ background: 'transparent', border: 'none', color: '#ff4d4d', cursor: 'pointer' }} onClick={() => setMfgCart(mfgCart.filter((_, i) => i !== idx))}>
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
            </div>
            <div className="admin-modal-footer">
              <button type="button" className="btn-outline-gold" onClick={() => setMfgModalOpen(false)}>{t.close}</button>
              <button type="button" className="btn-gold" onClick={handleSaveManufacturingOrder} disabled={loading || mfgCart.length === 0}>{t.save}</button>
            </div>
          </div>
        </div>
      )}

      {/* Manufacture Now Modal (from distribution catalog) */}
      {mfgNowOpen && mfgNowItem && (() => {
        const reqs = computeMfgNowReqs();
        const hasRecipe = reqs.length > 0;
        const hasShortage = reqs.some(x => x.shortage > 0);
        return (
        <div className="admin-modal-overlay" onClick={() => setMfgNowOpen(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '680px' }}>
            <div className="admin-modal-header">
              <h2>🏭 {language === 'ar' ? `تصنيع: ${mfgNowItem.name}` : `Produce: ${mfgNowItem.name}`}</h2>
              <button className="btn-close" onClick={() => setMfgNowOpen(false)}><X size={20} /></button>
            </div>
            <div className="admin-modal-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <label style={{ fontWeight: 'bold' }}>{language === 'ar' ? 'الكمية المراد تصنيعها:' : 'Quantity to produce:'}</label>
                <input
                  type="number"
                  className="input-gold"
                  style={{ width: '120px', padding: '0.5rem' }}
                  min="0.01"
                  step="0.01"
                  value={mfgNowQty}
                  onChange={(e) => setMfgNowQty(parseFloat(e.target.value) || 0)}
                />
                <span style={{ color: 'var(--gold-primary)', fontWeight: 'bold' }}>{mfgNowItem.unit}</span>
              </div>

              {!hasRecipe ? (
                <p style={{ color: '#ef4444', padding: '1rem', background: 'rgba(239,68,68,0.1)', borderRadius: '8px' }}>
                  {language === 'ar' ? '⚠ لا توجد وصفة تصنيع محفوظة لهذا المنتج. أضِف الوصفة من إدارة المخازن → وصفة التصنيع (BOM).' : '⚠ No saved recipe (BOM) for this product. Add it from Inventory → BOM.'}
                </p>
              ) : (
                <>
                  <h3 style={{ color: 'var(--gold-primary)', fontSize: '0.95rem', marginBottom: '0.5rem' }}>{language === 'ar' ? 'المكوّنات المطلوبة من المطبخ' : 'Required components (from kitchen)'}</h3>
                  <table className="admin-table" style={{ fontSize: '0.88rem' }}>
                    <thead>
                      <tr>
                        <th>{language === 'ar' ? 'المكوّن' : 'Component'}</th>
                        <th>{language === 'ar' ? 'المطلوب' : 'Required'}</th>
                        <th>{language === 'ar' ? 'المتاح بالمطبخ' : 'In Kitchen'}</th>
                        <th>{language === 'ar' ? 'الناقص' : 'Shortage'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reqs.map(x => (
                        <tr key={x.id} style={x.shortage > 0 ? { background: 'rgba(239,68,68,0.12)' } : undefined}>
                          <td>{x.name}</td>
                          <td style={{ fontWeight: 'bold' }}>{x.required.toLocaleString(undefined, { maximumFractionDigits: 3 })} {x.unit}</td>
                          <td style={{ color: x.shortage > 0 ? '#ef4444' : '#10b981' }}>{x.available.toLocaleString(undefined, { maximumFractionDigits: 3 })} {x.unit}</td>
                          <td style={{ color: '#ef4444', fontWeight: 'bold' }}>{x.shortage > 0 ? `${x.shortage.toLocaleString(undefined, { maximumFractionDigits: 3 })} ${x.unit}` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {hasShortage ? (
                    <p style={{ color: '#f59e0b', fontSize: '0.85rem', marginTop: '0.75rem' }}>
                      {language === 'ar' ? '⚠ بعض المكوّنات ناقصة في المطبخ. اطلب صرف النواقص أولاً، وبعد اعتماد الإذن ووصول الخامات للمطبخ أكمل التصنيع.' : '⚠ Some components are short in the kitchen. Request the shortages first, then produce after they arrive.'}
                    </p>
                  ) : (
                    <p style={{ color: '#10b981', fontSize: '0.85rem', marginTop: '0.75rem' }}>
                      {language === 'ar' ? '✅ كل المكوّنات متوفرة في المطبخ — جاهز للتصنيع.' : '✅ All components available — ready to produce.'}
                    </p>
                  )}
                </>
              )}
            </div>
            <div className="admin-modal-footer" style={{ gap: '0.5rem' }}>
              <button type="button" className="btn-outline-gold" onClick={() => setMfgNowOpen(false)}>{t.close}</button>
              {hasShortage && (
                <button type="button" className="btn-gold" style={{ background: '#f59e0b' }} disabled={loading || mfgNowQty <= 0} onClick={handleRequestMfgShortages}>
                  📦 {language === 'ar' ? 'طلب صرف النواقص' : 'Request Shortages'}
                </button>
              )}
              {(() => {
                const canProduce = hasRecipe && !hasShortage && mfgNowQty > 0 && !loading;
                return (
                  <button
                    type="button"
                    className="btn-gold"
                    disabled={!canProduce}
                    onClick={handleManufactureNow}
                    title={!canProduce ? (language === 'ar' ? 'وفّر كل المكوّنات في المطبخ أولاً' : 'Provide all components in the kitchen first') : ''}
                    style={!canProduce ? { opacity: 0.4, cursor: 'not-allowed', filter: 'grayscale(0.6)', pointerEvents: 'none' } : undefined}
                  >
                    🏭 {loading ? (language === 'ar' ? 'جارٍ...' : '...') : (language === 'ar' ? 'تصنيع' : 'Produce')}
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
        );
      })()}

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
                    onChange={async (e) => {
                      const id = e.target.value;
                      setProducedItemId(id);
                      if (id) {
                        const item = inventoryItems.find(i => i.id === id);
                        if (item?.is_manufactured) {
                          const recipes = await db.getManufacturingRecipes(id);
                          setConsumedItems(recipes.map(r => ({
                            item_id: r.ingredient_item_id,
                            quantity: Number((r.quantity * producedQuantity).toFixed(2))
                          })));
                        } else {
                          setConsumedItems([]);
                        }
                      } else {
                        setConsumedItems([]);
                      }
                    }}
                  >
                    <option value="">{language === 'ar' ? 'اختر المنتج المصنّع...' : 'Select produced item...'}</option>
                    {inventoryItems.filter(i => i.is_manufactured).map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                  </select>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <input
                      type="number"
                      className="input-gold"
                      placeholder={language === 'ar' ? 'الكمية المنتجة' : 'Produced Qty'}
                      style={{ padding: '0.5rem', flex: 1 }}
                      step="0.01"
                      min="0.01"
                      value={producedQuantity}
                      onChange={async (e) => {
                        const qty = parseFloat(e.target.value) || 0;
                        setProducedQuantity(qty);
                        if (producedItemId) {
                          const item = inventoryItems.find(i => i.id === producedItemId);
                          if (item?.is_manufactured) {
                            const recipes = await db.getManufacturingRecipes(producedItemId);
                            setConsumedItems(recipes.map(r => ({
                              item_id: r.ingredient_item_id,
                              quantity: Number((r.quantity * qty).toFixed(2))
                            })));
                          }
                        }
                      }}
                    />
                    <span style={{ color: 'var(--gold-primary)', fontWeight: 'bold', minWidth: '2.5rem' }}>
                      {inventoryItems.find(i => i.id === producedItemId)?.unit || '—'}
                    </span>
                  </div>
                </div>
                {inventoryItems.filter(i => i.is_manufactured).length === 0 && (
                  <p style={{ color: 'var(--text-gray)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                    {language === 'ar' ? 'لا توجد منتجات مصنّعة بعد. أضِفها من إدارة المخازن (نوع: مصنّع) مع وصفتها.' : 'No manufactured products yet. Add them from Inventory (type: manufactured) with their recipe.'}
                  </p>
                )}
                {producedItemId && (() => {
                  const sel = inventoryItems.find(i => i.id === producedItemId);
                  const recipeLoaded = consumedItems.length > 0;
                  return (
                    <p style={{ color: 'var(--text-gray)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                      {recipeLoaded
                        ? (language === 'ar' ? `تم تحميل وصفة ${sel?.name} وحساب الخامات المطلوبة تلقائياً حسب الكمية.` : `Recipe loaded; raw materials auto-calculated by quantity.`)
                        : (language === 'ar' ? 'لا توجد وصفة محفوظة لهذا المنتج — أضِف الخامات يدوياً بالأسفل.' : 'No saved recipe — add raw materials manually below.')}
                    </p>
                  );
                })()}
              </div>

              <div style={{ background: '#222', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                <h3 style={{ marginBottom: '1rem', color: 'var(--danger)' }}>{language === 'ar' ? 'الخامات المستهلكة (سيتم خصمها من المصنع)' : 'Consumed Raw Materials (From Factory)'}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr auto', gap: '0.5rem', marginBottom: '1rem' }}>
                  <select id="prod-consumed-item" className="input-gold" style={{ padding: '0.5rem' }}>
                    <option value="">{language === 'ar' ? 'اختر الخامة...' : 'Select raw material...'}</option>
                    {inventoryItems.filter(i => !i.is_manufactured).map(i => <option key={i.id} value={i.id}>{i.name} — {language === 'ar' ? 'المتاح بالمطبخ:' : 'In kitchen:'} {i.stock_factory || 0} {i.unit}</option>)}
                  </select>
                  <input type="number" id="prod-consumed-qty" className="input-gold" placeholder={language === 'ar' ? 'الكمية المستهلكة' : 'Consumed Qty'} style={{ padding: '0.5rem' }} step="0.01" min="0.01" />
                  <button type="button" className="btn-gold" style={{ padding: '0.5rem 1rem' }} onClick={() => {
                    const idEl = document.getElementById('prod-consumed-item') as HTMLSelectElement;
                    const qtyEl = document.getElementById('prod-consumed-qty') as HTMLInputElement;
                    const itemId = idEl.value;
                    const qty = parseFloat(qtyEl.value);
                    if (itemId && qty > 0) {
                      const existingIdx = consumedItems.findIndex(c => c.item_id === itemId);
                      if (existingIdx > -1) {
                        const newItems = [...consumedItems];
                        newItems[existingIdx].quantity += qty;
                        setConsumedItems(newItems);
                      } else {
                        setConsumedItems([...consumedItems, { item_id: itemId, quantity: qty }]);
                      }
                      idEl.value = ''; qtyEl.value = '';
                    }
                  }}>
                    <Plus size={16} />
                  </button>
                </div>

                {consumedItems.length > 0 && (() => {
                  const hasShortage = consumedItems.some(c => {
                    const it = inventoryItems.find(i => i.id === c.item_id);
                    return c.quantity > (it?.stock_factory || 0);
                  });
                  return (
                  <>
                  <table className="admin-table" style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
                    <thead>
                      <tr>
                        <th>{language === 'ar' ? 'الخامة' : 'Item'}</th>
                        <th>{language === 'ar' ? 'الكمية المخصومة' : 'Deducted Qty'}</th>
                        <th>{language === 'ar' ? 'المتاح بالمطبخ' : 'In Kitchen'}</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {consumedItems.map((c, idx) => {
                        const it = inventoryItems.find(i => i.id === c.item_id);
                        const available = it?.stock_factory || 0;
                        const short = c.quantity > available;
                        return (
                        <tr key={idx} style={short ? { background: 'rgba(239,68,68,0.12)' } : undefined}>
                          <td>{it?.name}</td>
                          <td style={{ color: short ? '#ef4444' : undefined, fontWeight: short ? 'bold' : undefined }}>{c.quantity} {it?.unit}</td>
                          <td style={{ color: short ? '#ef4444' : '#10b981' }}>{available} {it?.unit}{short ? (language === 'ar' ? ' ⚠ غير كافٍ' : ' ⚠ short') : ''}</td>
                          <td>
                            <button type="button" style={{ background: 'transparent', border: 'none', color: '#ff4d4d', cursor: 'pointer' }} onClick={() => setConsumedItems(consumedItems.filter((_, i) => i !== idx))}>
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {hasShortage && (
                    <p style={{ color: '#ef4444', fontSize: '0.82rem', marginTop: '0.5rem' }}>
                      {language === 'ar' ? '⚠ بعض الخامات أكبر من المتاح في المطبخ — راجع الكميات أو حوّل خامات إضافية للمطبخ أولاً.' : '⚠ Some materials exceed kitchen stock — review quantities or transfer more to the kitchen first.'}
                    </p>
                  )}
                  </>
                  );
                })()}
              </div>

            </div>
            <div className="admin-modal-footer">
              <button type="button" className="btn-outline-gold" onClick={() => setProductionModalOpen(false)}>{t.close}</button>
              <button type="button" className="btn-gold" onClick={handleSaveProductionLog} disabled={loading || !producedItemId || producedQuantity <= 0 || consumedItems.length === 0}>{t.save}</button>
            </div>
          </div>
        </div>
      )}

      {/* TRANSFER REQUEST MODAL */}
      {transferModalOpen && (
        <div className="admin-modal-overlay" onClick={() => setTransferModalOpen(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="admin-modal-header">
              <h2>🚚 {language === 'ar' ? 'طلب تحويل من المطبخ للتوزيع' : 'Transfer Request: Kitchen → Distribution'}</h2>
              <button className="btn-close" onClick={() => setTransferModalOpen(false)}><X size={20} /></button>
            </div>
            <div className="admin-modal-body">
              <p style={{ color: 'var(--text-gray)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                {language === 'ar' ? 'أضف الأصناف المراد تحويلها من مخزن المطبخ إلى مخزن التوزيع. يتطلب موافقة مدير التوزيع.' : 'Add items to transfer from kitchen stock to distribution. Requires distribution manager approval.'}
              </p>

              {/* Add item form */}
              <div style={{ background: 'var(--bg-darker)', padding: '1.2rem', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="label-gold">{language === 'ar' ? 'صنف المطبخ' : 'Kitchen Item'}</label>
                    <select id="transfer-item-select" className="input-gold" style={{ width: '100%', height: '45px', padding: '0 1rem' }}>
                      <option value="">{language === 'ar' ? 'اختر صنف للتحويل...' : 'Select item to transfer...'}</option>
                      {inventoryItems.filter(i => (i.stock_factory || 0) > 0).map(item => (
                        <option key={item.id} value={item.id}>{item.name} ({language === 'ar' ? 'المتاح بالمطبخ: ' : 'Available in kitchen: '}{item.stock_factory} {item.unit})</option>
                      ))}
                    </select>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="label-gold">{language === 'ar' ? 'الكمية' : 'Quantity'}</label>
                      <input type="number" id="transfer-qty-input" className="input-gold" style={{ height: '45px', padding: '0 1rem' }} min="0.01" step="0.01" defaultValue={1} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="label-gold">{language === 'ar' ? 'الوحدة' : 'Unit'}</label>
                      <input type="text" id="transfer-unit-input" className="input-gold" style={{ height: '45px', padding: '0 1rem' }} defaultValue="وحدة" />
                    </div>
                  </div>

                  <button type="button" className="btn-gold" style={{ width: '100%', height: '45px', marginTop: '0.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }} onClick={() => {
                    const sel = document.getElementById('transfer-item-select') as HTMLSelectElement;
                    const qtyInp = document.getElementById('transfer-qty-input') as HTMLInputElement;
                    const unitInp = document.getElementById('transfer-unit-input') as HTMLInputElement;
                    if (!sel.value) return;
                    const item = inventoryItems.find(i => i.id === sel.value);
                    if (!item) return;
                    const qty = parseFloat(qtyInp.value) || 0;
                    if (qty <= 0) return;
                    setTransferCart(prev => [...prev, { item_id: item.id, item_name: item.name, quantity: qty, unit: unitInp.value || item.unit }]);
                    sel.value = '';
                    qtyInp.value = '1';
                  }}>
                    <Plus size={18} />
                    {language === 'ar' ? 'إضافة للطلب' : 'Add to Request'}
                  </button>
                </div>
              </div>

              {/* Cart */}
              {transferCart.length > 0 && (
                <div style={{ background: 'var(--bg-darker)', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '1.5rem', overflow: 'hidden' }}>
                  {transferCart.map((c, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderBottom: idx < transferCart.length - 1 ? '1px solid var(--border-color)' : 'none', background: 'rgba(255, 255, 255, 0.02)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <span style={{ color: 'var(--gold-primary)', fontWeight: 'bold' }}>{c.item_name}</span>
                        <span style={{ color: 'var(--text-gray)', fontSize: '0.85rem' }}>{language === 'ar' ? 'الكمية:' : 'Qty:'} {c.quantity} {c.unit}</span>
                      </div>
                      <button type="button" className="action-btn delete" onClick={() => setTransferCart(prev => prev.filter((_, i) => i !== idx))} title={language === 'ar' ? 'حذف' : 'Remove'}>
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="label-gold">{language === 'ar' ? 'ملاحظات (اختياري)' : 'Notes (optional)'}</label>
                <textarea className="input-gold" rows={2} value={transferNotes} onChange={e => setTransferNotes(e.target.value)} style={{ resize: 'vertical' }} />
              </div>
            </div>
            <div className="admin-modal-footer">
              <button type="button" className="btn-outline-gold" onClick={() => { setTransferModalOpen(false); setTransferCart([]); setTransferNotes(''); }}>{t.close}</button>
              <button type="button" className="btn-gold" onClick={handleSaveTransferRequest} disabled={loading || transferCart.length === 0}>
                🚚 {language === 'ar' ? 'إرسال طلب التحويل' : 'Send Transfer Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DISTRIBUTION PRODUCT MODAL */}
      {distProdModalOpen && (
        <div className="admin-modal-overlay" onClick={() => setDistProdModalOpen(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="admin-modal-header">
              <h2>🎪 {distProdEditId ? (language === 'ar' ? 'تعديل منتج التوزيع' : 'Edit Distribution Product') : (language === 'ar' ? 'إضافة منتج توزيع جديد' : 'Add New Distribution Product')}</h2>
              <button className="btn-close" onClick={() => setDistProdModalOpen(false)}><X size={20} /></button>
            </div>
            <div className="admin-modal-body">
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div>
                  <label className="label-gold">{language === 'ar' ? 'اسم المنتج *' : 'Product Name *'}</label>
                  <input className="input-gold" value={distProdName} onChange={e => setDistProdName(e.target.value)} placeholder={language === 'ar' ? 'مثال: عسل طبيعي' : 'e.g. Natural Honey'} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label className="label-gold">{language === 'ar' ? 'الوحدة *' : 'Unit *'}</label>
                    <select className="input-gold" value={distProdUnit} onChange={e => setDistProdUnit(e.target.value)}>
                      <option value="كجم">كجم</option>
                      <option value="جرام">جرام</option>
                      <option value="لتر">لتر</option>
                      <option value="وحدة">وحدة</option>
                      <option value="كرتونة">كرتونة</option>
                      <option value="علبة">علبة</option>
                      <option value="زجاجة">زجاجة</option>
                    </select>
                  </div>
                  <div>
                    <label className="label-gold">{language === 'ar' ? 'الفئة' : 'Category'}</label>
                    <input className="input-gold" value={distProdCategory} onChange={e => setDistProdCategory(e.target.value)} placeholder={language === 'ar' ? 'مثال: عسل، زيوت...' : 'e.g. Honey, Oils...'} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label className="label-gold">{language === 'ar' ? 'المخزون الحالي *' : 'Current Stock *'}</label>
                    <input type="number" className="input-gold" value={distProdStock} onChange={e => setDistProdStock(e.target.value === '' ? '' : Number(e.target.value))} min="0" step="0.01" />
                  </div>
                  <div>
                    <label className="label-gold">{language === 'ar' ? 'سعر الوحدة *' : 'Unit Price *'}</label>
                    <input type="number" className="input-gold" value={distProdPrice} onChange={e => setDistProdPrice(e.target.value === '' ? '' : Number(e.target.value))} min="0" step="0.01" />
                  </div>
                </div>
                <div>
                  <label className="label-gold">{language === 'ar' ? 'ملاحظات' : 'Notes'}</label>
                  <textarea className="input-gold" rows={2} value={distProdNotes} onChange={e => setDistProdNotes(e.target.value)} style={{ resize: 'vertical' }} />
                </div>
              </div>
            </div>
            <div className="admin-modal-footer">
              <button type="button" className="btn-outline-gold" onClick={() => setDistProdModalOpen(false)}>{t.close}</button>
              <button type="button" className="btn-gold" onClick={handleSaveDistributionProduct} disabled={loading || !distProdName.trim() || distProdStock === '' || distProdPrice === ''}>
                {loading ? '...' : distProdEditId ? (language === 'ar' ? 'حفظ التعديلات' : 'Save Changes') : (language === 'ar' ? 'إضافة المنتج' : 'Add Product')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Supplier Profile Modal */}
      {selectedSupplierProfile && (
        <div className="admin-modal-overlay" onClick={() => setSelectedSupplierProfile(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px' }}>
            <div className="admin-modal-header">
              <h2>{language === 'ar' ? 'ملف المورد' : 'Supplier Profile'} - {selectedSupplierProfile.name}</h2>
              <button className="btn-close" onClick={() => setSelectedSupplierProfile(null)}><X size={20} /></button>
            </div>
            <div className="admin-modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ background: '#222', padding: '1rem', borderRadius: '8px' }}>
                  <span style={{ display: 'block', color: 'var(--text-gray)', fontSize: '0.85rem' }}>{language === 'ar' ? 'رقم الهاتف:' : 'Phone:'}</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{selectedSupplierProfile.phone || '-'}</span>
                </div>
                <div style={{ background: '#222', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid #ff4d4d' }}>
                  <span style={{ display: 'block', color: 'var(--text-gray)', fontSize: '0.85rem' }}>{language === 'ar' ? 'إجمالي المديونية (الآجل):' : 'Total Debt (Credit):'}</span>
                  <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#ff4d4d' }}>
                    {purchaseInvoices
                      .filter(inv => inv.supplier_id === selectedSupplierProfile.id)
                      .reduce((sum, inv) => sum + (inv.remaining_amount ?? 0), 0)
                      .toFixed(2)}
                  </span>
                </div>
              </div>

              <h3 style={{ color: 'var(--gold-primary)', marginBottom: '1rem' }}>{language === 'ar' ? 'فواتير المشتريات' : 'Purchase Invoices'}</h3>
              <div className="table-responsive" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>{language === 'ar' ? 'التاريخ' : 'Date'}</th>
                      <th>{language === 'ar' ? 'الأصناف' : 'Items'}</th>
                      <th>{language === 'ar' ? 'طرق الدفع' : 'Payment Methods'}</th>
                      <th>{language === 'ar' ? 'الإجمالي' : 'Total'}</th>
                      <th>{language === 'ar' ? 'الآجل' : 'Remaining'}</th>
                      <th>{language === 'ar' ? 'إجراءات' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseInvoices
                      .filter(inv => inv.supplier_id === selectedSupplierProfile.id)
                      .sort((a,b) => new Date(b.created_at||'').getTime() - new Date(a.created_at||'').getTime())
                      .map(inv => (
                        <tr key={inv.id}>
                          <td className="font-en">{new Date(inv.invoice_date).toLocaleDateString()}</td>
                          <td>
                            {inv.items.map((i, idx) => (
                              <div key={idx} style={{ fontSize: '0.85rem' }}>
                                {i.quantity} x {i.item_name} (@{i.unit_price})
                              </div>
                            ))}
                          </td>
                          <td style={{ fontSize: '0.85rem', lineHeight: '1.4' }}>
                            {inv.paid_cash ? <div>💵 {language === 'ar' ? 'كاش: ' : 'Cash: '}{inv.paid_cash.toFixed(2)}</div> : null}
                            {inv.paid_visa ? <div>💳 {language === 'ar' ? 'فيزا: ' : 'Visa: '}{inv.paid_visa.toFixed(2)}</div> : null}
                            {inv.paid_wallet ? <div>📱 {language === 'ar' ? 'محفظة: ' : 'Wallet: '}{inv.paid_wallet.toFixed(2)}</div> : null}
                            {inv.paid_instapay ? <div>⚡ {language === 'ar' ? 'إنستاباي: ' : 'Instapay: '}{inv.paid_instapay.toFixed(2)}</div> : null}
                            {!inv.paid_cash && !inv.paid_visa && !inv.paid_wallet && !inv.paid_instapay ? <span style={{ color: 'var(--text-gray)' }}>-</span> : null}
                          </td>
                          <td style={{ color: 'var(--gold-primary)', fontWeight: 'bold' }}>{inv.total_amount.toFixed(2)}</td>
                          <td style={{ color: (inv.remaining_amount ?? 0) > 0 ? '#ff4d4d' : '#2ecc71', fontWeight: 'bold' }}>
                            {(inv.remaining_amount ?? 0).toFixed(2)}
                          </td>
                          <td>
                            {(inv.remaining_amount ?? 0) > 0 ? (
                              <button 
                                className="btn-gold" 
                                style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                                onClick={() => {
                                  setSelectedInvoiceToPay(inv);
                                  setPayAmount(inv.remaining_amount ?? 0);
                                  setPayDebtModalOpen(true);
                                }}
                              >
                                {language === 'ar' ? 'سداد' : 'Pay'}
                              </button>
                            ) : (
                              <span style={{ color: '#2ecc71', fontSize: '0.85rem' }}>{language === 'ar' ? 'مدفوعة بالكامل' : 'Fully Paid'}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    {purchaseInvoices.filter(inv => inv.supplier_id === selectedSupplierProfile.id).length === 0 && (
                      <tr><td colSpan={6} style={{ textAlign: 'center', padding: '1rem' }}>{language === 'ar' ? 'لا توجد فواتير مضافة لهذا المورد' : 'No invoices for this supplier'}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="admin-modal-footer">
              <button type="button" className="btn-outline-gold" onClick={() => setSelectedSupplierProfile(null)}>{t.close}</button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Pay Debt Modal */}
      {payDebtModalOpen && selectedInvoiceToPay && (
        <div className="admin-modal-overlay" onClick={() => setPayDebtModalOpen(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div className="admin-modal-header">
              <h2>{language === 'ar' ? 'سداد دفعة للمورد' : 'Pay Supplier Debt'}</h2>
              <button className="btn-close" onClick={() => setPayDebtModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handlePayDebt}>
              <div className="admin-modal-body">
                <div style={{ background: '#222', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span>{language === 'ar' ? 'إجمالي الفاتورة:' : 'Invoice Total:'}</span>
                    <span style={{ fontWeight: 'bold' }}>{selectedInvoiceToPay.total_amount.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ff4d4d' }}>
                    <span>{language === 'ar' ? 'المتبقي (الآجل):' : 'Remaining (Credit):'}</span>
                    <span style={{ fontWeight: 'bold' }}>{(selectedInvoiceToPay.remaining_amount ?? selectedInvoiceToPay.total_amount).toFixed(2)}</span>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label>{language === 'ar' ? 'المبلغ المراد سداده' : 'Amount to Pay'} *</label>
                  <input 
                    type="number" 
                    className="input-gold" 
                    value={payAmount} 
                    onChange={e => setPayAmount(e.target.value === '' ? '' : parseFloat(e.target.value))} 
                    required 
                    min="0.01" 
                    max={selectedInvoiceToPay.remaining_amount ?? selectedInvoiceToPay.total_amount} 
                    step="0.01" 
                  />
                </div>

                <div className="form-group">
                  <label>{language === 'ar' ? 'طريقة الدفع' : 'Payment Method'} *</label>
                  <select 
                    className="input-gold" 
                    value={payMethod} 
                    onChange={e => setPayMethod(e.target.value as any)}
                    required
                  >
                    <option value="cash">{language === 'ar' ? 'نقدًا (كاش)' : 'Cash'}</option>
                    <option value="visa">{language === 'ar' ? 'فيزا' : 'Visa'}</option>
                    <option value="wallet">{language === 'ar' ? 'محفظة' : 'Wallet'}</option>
                    <option value="instapay">{language === 'ar' ? 'إنستاباي' : 'Instapay'}</option>
                  </select>
                </div>
              </div>
              <div className="admin-modal-footer">
                <button type="button" className="btn-outline-gold" onClick={() => setPayDebtModalOpen(false)}>{t.close}</button>
                <button type="submit" className="btn-gold" disabled={loading}>{language === 'ar' ? 'سداد الآن' : 'Pay Now'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OTP verification Modal for Admin deletions */}
      {otpModalOpen && (
        <div className="admin-modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '1rem',
          backdropFilter: 'blur(8px)',
          direction: language === 'ar' ? 'rtl' : 'ltr'
        }}>
          <div className="admin-modal-content" style={{
            background: '#18181b',
            border: '2px solid var(--gold-primary)',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '400px',
            padding: '2rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            textAlign: 'center',
            color: '#fff'
          }}>
            <h3 style={{ color: 'var(--gold-primary)', fontSize: '1.4rem', fontWeight: 'bold', marginBottom: '1rem' }}>
              {language === 'ar' ? 'تأكيد رمز الأمان (OTP)' : 'OTP Security Verification'}
            </h3>
            <p style={{ color: 'var(--text-gray)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              {language === 'ar' 
                ? `يرجى إدخال رمز التحقق المرسل إلى تليجرام لإتمام إجراء: ${otpActionName}` 
                : `Please enter the verification code sent to Telegram to complete: ${otpActionName}`}
            </p>

            <input 
              type="text"
              className="input-gold"
              style={{ fontSize: '1.8rem', letterSpacing: '4px', textAlign: 'center', fontWeight: 'bold', color: 'var(--gold-primary)', marginBottom: '1.5rem', background: '#000', border: '1px solid var(--gold-secondary)' }}
              placeholder="------"
              maxLength={6}
              value={otpInput}
              onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
            />

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                type="button"
                className="btn-gold" 
                style={{ flex: 1, padding: '0.8rem', borderRadius: '12px' }}
                onClick={async () => {
                  if (otpInput === otpCode) {
                    setOtpModalOpen(false);
                    if (otpAction) {
                      await otpAction();
                    }
                  } else {
                    alert(language === 'ar' ? 'رمز OTP غير صحيح!' : 'Incorrect OTP Code!');
                  }
                }}
              >
                {language === 'ar' ? 'تأكيد' : 'Verify'}
              </button>
              <button 
                type="button"
                className="btn-outline-gold" 
                style={{ flex: 1, padding: '0.8rem', borderRadius: '12px' }}
                onClick={() => {
                  setOtpModalOpen(false);
                  setOtpAction(null);
                }}
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Employee Modal */}
      {empModalOpen && (
        <div className="admin-modal-overlay" onClick={() => setEmpModalOpen(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="admin-modal-header">
              <h2>{editingEmployee ? (language === 'ar' ? 'تعديل بيانات الموظف' : 'Edit Employee Details') : (language === 'ar' ? 'إضافة موظف جديد' : 'Add New Employee')}</h2>
              <button className="btn-close" onClick={() => setEmpModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveEmployee}>
              <div className="admin-modal-body">
                <div className="form-group">
                  <label>{language === 'ar' ? 'اسم الموظف *' : 'Employee Name *'}</label>
                  <input 
                    type="text" 
                    className="input-gold" 
                    value={empName} 
                    onChange={(e) => setEmpName(e.target.value)} 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>{language === 'ar' ? 'رقم الهاتف' : 'Phone Number'}</label>
                  <input 
                    type="text" 
                    className="input-gold" 
                    value={empPhone} 
                    onChange={(e) => setEmpPhone(e.target.value)} 
                  />
                </div>
                <div className="form-group">
                  <label>{language === 'ar' ? 'الراتب الأساسي (شهرياً) *' : 'Base Salary (Monthly) *'}</label>
                  <input 
                    type="number" 
                    className="input-gold" 
                    value={empSalary === '' ? '' : empSalary} 
                    onChange={(e) => setEmpSalary(e.target.value === '' ? '' : Number(e.target.value))} 
                    required 
                    min="1"
                  />
                </div>
                <div className="form-group">
                  <label>{language === 'ar' ? 'الإجازات المسموحة شهرياً (الافتراضي: 4)' : 'Allowed Monthly Leaves (Default: 4)'}</label>
                  <input 
                    type="number" 
                    className="input-gold" 
                    value={empAllowedVacations} 
                    onChange={(e) => setEmpAllowedVacations(Number(e.target.value))} 
                    required 
                    min="0"
                  />
                </div>
                <div className="form-group">
                  <label>{language === 'ar' ? 'ساعات العمل اليومية المطلوبة (الافتراضي: 9) *' : 'Required Daily Working Hours (Default: 9) *'}</label>
                  <input 
                    type="number" 
                    className="input-gold" 
                    value={empWorkingHours} 
                    onChange={(e) => setEmpWorkingHours(e.target.value === '' ? '' : Number(e.target.value))} 
                    required 
                    min="1"
                    max="24"
                  />
                </div>
              </div>
              <div className="admin-modal-footer">
                <button type="button" className="btn-outline-gold" onClick={() => setEmpModalOpen(false)}>{t.close}</button>
                <button type="submit" className="btn-gold" disabled={loading}>{t.save}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Transaction Modal */}
      {txModalOpen && selectedEmployee && (
        <div className="admin-modal-overlay" onClick={() => setTxModalOpen(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="admin-modal-header">
              <h2>{language === 'ar' ? `إضافة معاملة للموظف: ${selectedEmployee.name}` : `Add Transaction for: ${selectedEmployee.name}`}</h2>
              <button className="btn-close" onClick={() => setTxModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleAddTransaction}>
              <div className="admin-modal-body">
                <div className="form-group">
                  <label>{language === 'ar' ? 'نوع المعاملة *' : 'Transaction Type *'}</label>
                  <select 
                    className="input-gold" 
                    value={txType} 
                    onChange={(e) => setTxType(e.target.value as any)}
                    required
                  >
                    <option value="advance">{language === 'ar' ? '💸 سلفة' : 'Advance'}</option>
                    <option value="bonus">{language === 'ar' ? '🟢 حافز' : 'Bonus'}</option>
                    <option value="discount">{language === 'ar' ? '🔴 خصم يدوي' : 'Manual Discount'}</option>
                    <option value="vacation_paid">{language === 'ar' ? '🏖️ إجازة مدفوعة' : 'Paid Vacation'}</option>
                    <option value="vacation_unpaid">{language === 'ar' ? '🏚️ إجازة غير مدفوعة' : 'Unpaid Vacation'}</option>
                  </select>
                </div>
                
                {(txType !== 'vacation_paid' && txType !== 'vacation_unpaid') && (
                  <div className="form-group">
                    <label>{language === 'ar' ? 'المبلغ *' : 'Amount *'}</label>
                    <input 
                      type="number" 
                      className="input-gold" 
                      value={txAmount === '' ? '' : txAmount} 
                      onChange={(e) => setTxAmount(e.target.value === '' ? '' : Number(e.target.value))} 
                      required 
                      min="0.01"
                      step="0.01"
                    />
                  </div>
                )}

                <div className="form-group">
                  <label>{language === 'ar' ? 'ملاحظات' : 'Notes / Description'}</label>
                  <textarea 
                    className="input-gold" 
                    rows={3}
                    value={txNotes} 
                    onChange={(e) => setTxNotes(e.target.value)} 
                    placeholder={language === 'ar' ? 'اكتب تفاصيل إضافية هنا...' : 'Write extra details here...'}
                  />
                </div>
              </div>
              <div className="admin-modal-footer">
                <button type="button" className="btn-outline-gold" onClick={() => setTxModalOpen(false)}>{t.close}</button>
                <button type="submit" className="btn-gold" disabled={loading}>{t.save}</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

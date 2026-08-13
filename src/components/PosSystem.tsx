import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';


const getLocalDayStr = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

import {
  ShoppingBag, Utensils, CheckCircle, X,
  Plus, Minus, Trash2, ArrowRight, Printer as PrinterIcon,
  Pizza, Coffee, ChefHat, Wine, Cake, MessageCircle, Camera, Search,
  Bell, Sun, Moon, BarChart3, Wallet, Receipt
} from 'lucide-react';
import { db } from '../lib/supabase';
import type { Category, Product, Order, OrderItem, SystemUser, Printer, RestaurantSettings, Customer, Employee, AttendanceLog, InventoryItem, ProductRecipe, PaymentMethodKey, Partner, Expense, CustomerPayment } from '../types';
import { printOrderTickets, printCustomerReceipt } from '../utils/printUtils';
import { taxPercentForOrder } from '../utils/tax';
import { drawerOfHall, drawerName, collectedPaymentParts, collectedFromOrder, deferredFromOrder } from '../utils/shiftClosing';
import { playClickSound, playSuccessSound, playNewOrderSound, playCheckInSound, playCheckOutSound } from '../utils/audioUtils';

// ألوان الصالات وأنواع الطلبات (نفس ألوان شاشة المطبخ للتناسق)
// كلمة سر تسجيل فواتير الاستاف
const STAFF_ORDER_PASSCODE = '2026';

const HALL_COLORS = ['#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#3b82f6', '#14b8a6'];
const TYPE_COLORS: Record<string, string> = {
  dine_in: '#eab308',
  takeaway: '#a855f7',
  delivery: '#0ea5e9',
  talabat: '#f97316',
  website: '#22c55e',
};

interface PosSystemProps {
  onClose: () => void;
  language: 'ar' | 'en';
  setLanguage?: (lang: 'ar' | 'en') => void;
}

type PosView = 'device_hall_select' | 'role_select' | 'waiter_auth' | 'customer_info' | 'order_type' | 'table_status' | 'menu' | 'checkout' | 'success' | 'waiter_dashboard' | 'waiter_order_edit';

export const PosSystem: React.FC<PosSystemProps> = ({ onClose, language, setLanguage }) => {
  // Global Data
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [waiters, setWaiters] = useState<SystemUser[]>([]);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  // فلتر لوحة الطلبات: 'all' | `hall:<اسم>` | `type:<نوع>`
  const [dashFilter, setDashFilter] = useState<string>('all');
  // ثيم لايت/دارك (بيحط .light-theme على الصفحة زي باقي التطبيق)
  const [isLightTheme, setIsLightTheme] = useState(
    typeof document !== 'undefined' && document.documentElement.classList.contains('light-theme')
  );
  const togglePosTheme = () => {
    const next = !isLightTheme;
    setIsLightTheme(next);
    document.documentElement.classList.toggle('light-theme', next);
    try { localStorage.setItem('meridien_theme', next ? 'light' : 'dark'); } catch {}
  };
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [lastPlacedOrder, setLastPlacedOrder] = useState<Order | null>(null);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [productRecipes, setProductRecipes] = useState<ProductRecipe[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const [view, setView] = useState<PosView>(() => {
    try { 
      if (!localStorage.getItem('meridien_pos_device_hall')) return 'device_hall_select';
      if (localStorage.getItem('meridien_active_pos_waiter')) return 'waiter_dashboard';
      return 'role_select';
    } catch { return 'device_hall_select'; }
  });
  const [role, setRole] = useState<'waiter' | 'customer' | null>(() => {
    return localStorage.getItem('meridien_active_pos_waiter') ? 'waiter' : null;
  });
  const [mobileShowCart, setMobileShowCart] = useState(false);
  const [posDepartment, setPosDepartment] = useState<'restaurant'|'bar'>('restaurant');
  
  // Waiter Auth & Dashboard
  const [selectedWaiter, setSelectedWaiter] = useState<SystemUser | null>(() => {
    const saved = localStorage.getItem('meridien_active_pos_waiter');
    return saved ? JSON.parse(saved) : null;
  });
  const [waiterPasscode, setWaiterPasscode] = useState('');
  const [viewAllOrders, setViewAllOrders] = useState(false);

  // Attendance System State
  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);
  const [employeesList, setEmployeesList] = useState<Employee[]>([]);
  const [attendanceLogsList, setAttendanceLogsList] = useState<AttendanceLog[]>([]);
  // يمنع الضغط المتكرر لنفس الموظف أثناء انتظار الكاميرا أو الشبكة
  const [attendanceActionInFlight, setAttendanceActionInFlight] = useState<Record<string, boolean>>({});
  const [searchEmployeeQuery, setSearchEmployeeQuery] = useState('');
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Order Session Details
  const [editOrderId, setEditOrderId] = useState<string | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [orderType, setOrderType] = useState<'takeaway' | 'talabat' | 'dine_in' | 'delivery' | 'website' | null>(null);
  const [tableNumber, setTableNumber] = useState('');
  const [selectedHall, setSelectedHall] = useState('');
  const [deviceHall, setDeviceHall] = useState<string>(() => {
    try { return localStorage.getItem('meridien_pos_device_hall') || ''; } catch { return ''; }
  });
  const [tableStatusFilter, setTableStatusFilter] = useState<'all' | 'empty' | 'occupied' | 'delivered' | 'check'>('all');
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryOrderTypeFilter, setSummaryOrderTypeFilter] = useState<'all' | 'dine_in' | 'takeaway' | 'delivery' | 'talabat' | 'website'>('all');
  const [summaryScopeFilter, setSummaryScopeFilter] = useState<string>(() => {
    try {
      const hall = localStorage.getItem('meridien_pos_device_hall') || '';
      return hall ? `hall:${hall}` : 'all';
    } catch {
      return 'all';
    }
  });
  
  // Payment and Customers
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);

  // Menu & Cart
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [cart, setCart] = useState<OrderItem[]>([]);

  // Waiting/Delivered states, Payment and Transfer states
  const [originalOrderItems, setOriginalOrderItems] = useState<OrderItem[]>([]);
  const [collectPaymentOrder, setCollectPaymentOrder] = useState<Order | null>(null);
  const [payCash, setPayCash] = useState<number | ''>('');
  const [payVisa, setPayVisa] = useState<number | ''>('');
  const [payWalletCashier, setPayWalletCashier] = useState<number | ''>('');
  const [payWalletCafe, setPayWalletCafe] = useState<number | ''>('');
  
  const [payInstapay, setPayInstapay] = useState<number | ''>('');
  const [payIsDeferred, setPayIsDeferred] = useState(false);
  const [payCustomerId, setPayCustomerId] = useState('');
  // الخزنة اللي هيتحصّل فيها الأوردر (1 أو 2)
  const [payDrawer, setPayDrawer] = useState<1 | 2>(1);
  // فاتورة استاف: مودال اختيار الموظف + كلمة السر
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  // 'new' = طلب استاف جديد من شاشة نوع الطلب | 'collect' = تحويل أوردر قائم لفاتورة استاف
  const [staffModalMode, setStaffModalMode] = useState<'new' | 'collect'>('collect');
  const [staffEmployeeId, setStaffEmployeeId] = useState('');
  const [staffPasscode, setStaffPasscode] = useState('');
  const [staffSaving, setStaffSaving] = useState(false);
  // الموظف اللي الطلب الجديد اتسجل باسمه (لو طلب استاف)
  const [staffOrderFor, setStaffOrderFor] = useState<{ id: string; name: string } | null>(null);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');

  // OTP States for Deletions/Cancellations
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

    const text = `🔑 <b>رمز التحقق (OTP) لإجراء حساس</b>\n\n` +
      `• <b>الإجراء:</b> ${language === 'ar' ? actionName : actionNameEn}\n` +
      `• <b>الكابتن:</b> ${selectedWaiter?.name || 'غير معروف'}\n` +
      `• <b>الطلب:</b> <code>#${orderIdForLog ? orderIdForLog.slice(0, 6) : 'N/A'}</code>\n\n` +
      `• <b>رمز OTP:</b> <code>${code}</code>`;
    
    import('../utils/telegramUtils').then(({ sendTelegramMessage }) => {
      sendTelegramMessage(token, chatId, text);
    });
  };

  // ===== فاتورة استاف =====
  // طلب مجاني لموظف: مبيتحسبش مبيعات، بس بيتسجل باسم الموظف وبيخصم من المخزون عادي.
  const handleStaffOrder = async () => {
    if (staffPasscode !== STAFF_ORDER_PASSCODE) {
      alert(language === 'ar' ? 'كلمة السر غير صحيحة' : 'Incorrect password');
      return;
    }
    const employee = employeesList.find(e => e.id === staffEmployeeId);
    if (!employee) {
      alert(language === 'ar' ? 'اختر الموظف المستفيد الأول' : 'Select the employee first');
      return;
    }

    // طلب جديد: بنعلّم إن الطلب ده للاستاف ونكمّل عادي لاختيار الأصناف
    if (staffModalMode === 'new') {
      setStaffOrderFor({ id: employee.id, name: employee.name });
      setOrderType('takeaway');
      setStaffModalOpen(false);
      setStaffPasscode('');
      setView('menu');
      return;
    }

    if (!collectPaymentOrder) return;
    setStaffSaving(true);
    try {
      const originalPrice = totalForOrder(collectPaymentOrder);
      const staffOrder = await db.updateOrder(collectPaymentOrder.id, {
        status: 'completed',
        payment_method: 'staff',
        total_price: 0,
        drawer: payDrawer,
        payment_details: {
          type: 'staff',
          original_price: originalPrice,
          employee_id: employee.id,
          employee_name: employee.name,
        },
      }, selectedWaiter?.name);

      printCustomerReceipt(
        staffOrder || ({
          ...collectPaymentOrder,
          status: 'completed',
          payment_method: 'staff',
          total_price: 0,
          payment_details: { type: 'staff', original_price: originalPrice, employee_id: employee.id, employee_name: employee.name },
        } as any),
        language, settings
      );

      // تنبيه على تليجرام — طلب مجاني لازم يتسجل
      if (settings?.telegram_chat_id) {
        const text = `👨‍🍳 <b>فاتورة استاف (مجانية)</b>\n\n` +
          `• <b>الموظف:</b> ${employee.name}\n` +
          `• <b>رقم الطلب:</b> <code>#${collectPaymentOrder.id.slice(0, 6)}</code>\n` +
          `• <b>قيمة الطلب:</b> ${originalPrice.toFixed(2)} EGP\n` +
          `• <b>الكابتن:</b> ${selectedWaiter?.name || 'غير معروف'}`;
        import('../utils/telegramUtils').then(({ sendTelegramMessage }) => {
          sendTelegramMessage(settings?.telegram_bot_token, settings?.telegram_chat_id, text);
        });
      }

      setStaffModalOpen(false);
      setStaffPasscode('');
      setStaffEmployeeId('');
      setCollectPaymentOrder(null);
      loadData();
    } catch (e) {
      console.error(e);
      alert(language === 'ar' ? 'فشل تسجيل فاتورة الاستاف' : 'Failed to record the staff order');
    } finally {
      setStaffSaving(false);
    }
  };

  const handleAcceptWebsiteOrder = (order: Order) => {
    if (!selectedWaiter) return;
    // تحديث فوري — الطلب يتقبل على طول والباقي في الخلفية
    setActiveOrders(prev => prev.map(o => o.id === order.id ? { ...o, waiter_id: selectedWaiter.id, waiter_name: selectedWaiter.name } : o));
    playSuccessSound();
    db.updateOrder(order.id, {
      waiter_id: selectedWaiter.id,
      waiter_name: selectedWaiter.name
    }).catch((err: any) => console.error('Error accepting website order:', err));
  };

  // Item transfer state
  const [transferItem, setTransferItem] = useState<OrderItem | null>(null);
  const [transferTargetOrderId, setTransferTargetOrderId] = useState<string>('');
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [mergeTargetOrderId, setMergeTargetOrderId] = useState<string>('');
  const [transferQty, setTransferQty] = useState<number>(1);
  const [debtModalOpen, setDebtModalOpen] = useState(false);
  const [debtCustomerId, setDebtCustomerId] = useState<string>('');
  const [debtAmount, setDebtAmount] = useState<string>('');
  const [debtPaymentMethod, setDebtPaymentMethod] = useState<PaymentMethodKey>('cash');
  const [debtDrawer, setDebtDrawer] = useState<1 | 2>(1);
  const [debtNotes, setDebtNotes] = useState<string>('');
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [depositCustomerId, setDepositCustomerId] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositPaymentMethod, setDepositPaymentMethod] = useState<Exclude<PaymentMethodKey, 'deferred' | 'petty_cash'>>('cash');
  const [depositDrawer, setDepositDrawer] = useState<1 | 2>(1);
  const [depositNotes, setDepositNotes] = useState('');
  const [depositSaving, setDepositSaving] = useState(false);
  
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [expenseName, setExpenseName] = useState<string>('');
  const [expenseAmount, setExpenseAmount] = useState<string>('');
  const [expensePaymentMethod, setExpensePaymentMethod] = useState<Exclude<PaymentMethodKey, 'deferred'>>('cash');
  const [expenseDrawer, setExpenseDrawer] = useState<1 | 2>(1);
  const [expenseEmployeeId, setExpenseEmployeeId] = useState<string>('');
  const [expenseNotes, setExpenseNotes] = useState<string>('');
    const [expenseSaving, setExpenseSaving] = useState(false);
  // جهاز POS المرتبط بصالة يملك خزنة واحدة فقط؛ المدير/الجهاز العام فقط يرى الخزنتين.
  const allowedDrawer: 1 | 2 | null = deviceHall ? drawerOfHall(deviceHall, settings) : null;
  const allowedDrawers: readonly (1 | 2)[] = allowedDrawer ? [allowedDrawer] : [1, 2];
  const effectiveDrawer = (selected: 1 | 2): 1 | 2 => allowedDrawer || selected;
  const scopedSummaryFilter = deviceHall ? `hall:${deviceHall}` : summaryScopeFilter;
  const previousPendingCount = useRef(0);
  const previousWebsiteOrdersCount = useRef(0);

  useEffect(() => {
    loadData();
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('button') || target.closest('.pos-btn') || target.closest('.pos-btn-outline') || target.closest('.menu-item-card')) {
        playClickSound();
      }
    };
    document.addEventListener('click', handleGlobalClick);
    
    if (supabase) {
      const channel = supabase.channel('realtime_pos_orders')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
          if (payload.eventType === 'UPDATE' && payload.old.status !== 'prepared' && payload.new.status === 'prepared') {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2870/2870-preview.mp3');
            audio.play().catch(() => {});
            setPreparedNotifications(prev => [...prev, {
              id: payload.new.id,
              waiter_name: payload.new.waiter_name,
              time: new Date().toLocaleTimeString()
            }]);
          }
          loadData();
        })
        .subscribe();
      return () => {
        document.removeEventListener('click', handleGlobalClick);
        supabase?.removeChannel(channel);
      };
    }
    
    return () => document.removeEventListener('click', handleGlobalClick);
  }, []);

  useEffect(() => {
    const currentPending = activeOrders.filter(o => o.status === 'pending').length;
    const currentWebsiteOrders = activeOrders.filter(o => o.order_type === 'website' && !o.waiter_id && o.status === 'pending').length;
    
    if (currentPending > previousPendingCount.current || currentWebsiteOrders > previousWebsiteOrdersCount.current) {
      playNewOrderSound();
    }
    previousPendingCount.current = currentPending;
    previousWebsiteOrdersCount.current = currentWebsiteOrders;
  }, [activeOrders]);

  const [preparedNotifications, setPreparedNotifications] = useState<{id: string, waiter_name?: string, time: string}[]>([]);

  useEffect(() => {
    setMobileShowCart(false);
  }, [view]);

  useEffect(() => {
    const departmentCategories = categories.filter(c => (c.department || 'restaurant') === posDepartment);
    if (departmentCategories.length > 0 && !departmentCategories.some(c => c.id === activeCategory)) {
      setActiveCategory(departmentCategories[0].id);
    }
  }, [posDepartment, categories, activeCategory]);

  const loadData = async () => {
    const [cats, prods, users, ords, prnts, sets, custs, emps, atts, invItems, prodRecipes, pts, exps] = await Promise.all([
      db.getCategories(),
      db.getProducts(),
      db.getSystemUsers(),
      db.getOrders(),
      db.getPrinters(),
      db.getSettings(),
      db.getCustomers(),
      db.getEmployees(),
      db.getAttendanceLogs(),
      db.getInventoryItems(),
      db.getProductRecipes(),
      db.getPartners(),
      db.getExpenses()
    ]);
    setCategories(cats.sort((a, b) => {
      const aBar = a.department === 'bar';
      const bBar = b.department === 'bar';
      if (aBar && !bBar) return 1;
      if (!aBar && bBar) return -1;
      return a.sort_order - b.sort_order;
    }));
    setProducts(prods);
    setWaiters(users.filter(u => u.role === 'waiter'));
    setAllOrders(ords);
    setActiveOrders(ords.filter(o => o.status === 'pending' || o.status === 'preparing' || o.status === 'prepared' || o.status === 'delivered'));
    setPrinters(prnts);
    setSettings(sets);
    setCustomers(custs);
    setPartners((pts || []) as Partner[]);
    setEmployeesList(emps);
    setAttendanceLogsList(atts);
    setInventoryItems(invItems || []);
    setProductRecipes(prodRecipes || []);
    setExpenses(exps || []);
    if (cats.length > 0) setActiveCategory(cats[0].id);
  };

  const startCamera = async () => {
    setCameraError('');
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera API not supported in this browser context");
      }
      
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, facingMode: 'user' }
        });
      } catch (firstErr) {
        console.warn("First camera constraint failed, trying fallback:", firstErr);
        // Fallback: request any video track without strict constraints
        stream = await navigator.mediaDevices.getUserMedia({
          video: true
        });
      }

      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(e => console.warn("Video play error:", e));
      }
    } catch (err: any) {
      console.error("Camera access failed:", err);
      const errMsg = err?.message || err?.name || '';
      const isNotAllowed = errMsg.includes('Permission') || errMsg.includes('NotAllowed') || err?.name === 'NotAllowedError';
      const errorText = isNotAllowed
        ? (language === 'ar' ? 'تم رفض إذن الكاميرا، يرجى السماح بالوصول إليها من إعدادات المتصفح.' : 'Camera permission denied, please allow it in site settings.')
        : (language === 'ar' ? `فشل تشغيل الكاميرا (${errMsg || 'تأكد أنها غير مستخدمة في تطبيق آخر'}).` : `Failed to start camera (${errMsg || 'make sure it is not in use'}).`);
      setCameraError(errorText);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
  };

  useEffect(() => {
    if (attendanceModalOpen) {
      loadData();
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [attendanceModalOpen]);

  const handleAttendanceAction = async (employee: Employee, isCheckIn: boolean) => {
    const actionKey = `${employee.id}:${isCheckIn ? 'check-in' : 'check-out'}`;
    if (attendanceActionInFlight[actionKey]) return;
    setAttendanceActionInFlight(prev => ({ ...prev, [actionKey]: true }));
    if (!canvasRef.current || !videoRef.current) {
      alert(language === 'ar' ? 'الكاميرا غير جاهزة!' : 'Camera not ready!');
      setAttendanceActionInFlight(prev => {
        const next = { ...prev };
        delete next[actionKey];
        return next;
      });
      return;
    }

    try {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth || 320;
      canvas.height = video.videoHeight || 240;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }
      
      const photoBase64 = canvas.toDataURL('image/jpeg', 0.7);

      if (isCheckIn) {
        playCheckInSound();
      } else {
        playCheckOutSound();
      }

      const todayStr = getLocalDayStr();

      if (isCheckIn) {
        await db.addAttendanceLog({
          employee_id: employee.id,
          employee_name: employee.name,
          check_in_time: new Date().toISOString(),
          check_out_time: null,
          check_in_photo: photoBase64,
          check_out_photo: undefined,
          working_hours: undefined,
          penalty_applied: 0,
          date: todayStr
        });

        const botToken = settings?.telegram_bot_token || '8722542358:AAF_2J1eM-WB2IiwLuRkYU29A8pvWd3DtTw';
        const chatId = settings?.telegram_chat_id || '5507184715,7441837470';

        if (chatId) {
          try {
            const res = await fetch(photoBase64);
            const blob = await res.blob();
            
            const caption = `🟢 <b>تسجيل حضور موظف (Check In)</b>\n\n` +
                            `• <b>الموظف:</b> ${employee.name}\n` +
                            `• <b>الهاتف:</b> ${employee.phone || '-'}\n` +
                            `• <b>التاريخ:</b> ${todayStr}\n` +
                            `• <b>الوقت:</b> ${new Date().toLocaleTimeString('ar-EG')}`;
            
            const { sendTelegramPhoto } = await import('../utils/telegramUtils');
            await sendTelegramPhoto(botToken, chatId, blob, caption);
          } catch (err) {
            console.error("Failed to send check-in telegram notification:", err);
          }
        }
      } else {
        const activeLog = attendanceLogsList.find(l => l.employee_id === employee.id && l.date === todayStr && !l.check_out_time);
        if (!activeLog) {
          alert(language === 'ar' ? 'لم يتم العثور على تسجيل حضور مفتوح لليوم!' : 'No open check-in log found for today!');
          return;
        }

        const checkOutTimeStr = new Date().toISOString();
        const checkInTime = new Date(activeLog.check_in_time);
        const checkOutTime = new Date(checkOutTimeStr);
        const diffMs = checkOutTime.getTime() - checkInTime.getTime();
        const workingHours = Number((diffMs / (1000 * 60 * 60)).toFixed(2));

        let penaltyApplied = 0;
        const requiredHours = employee.working_hours || 9;
        if (workingHours < requiredHours) {
          const hourlyRate = employee.salary / 30 / requiredHours;
          penaltyApplied = Number(((requiredHours - workingHours) * hourlyRate).toFixed(2));
          
          await db.addEmployeeTransaction({
            employee_id: employee.id,
            type: 'discount',
            amount: penaltyApplied,
            date: todayStr,
            notes: language === 'ar' 
              ? `خصم تلقائي لتأخير ساعات العمل (ساعات العمل: ${workingHours} من ${requiredHours} ساعات)` 
              : `Auto deduction for short hours (hours: ${workingHours}/${requiredHours})`
          });
        }

        await db.updateAttendanceLog(activeLog.id, {
          check_out_time: checkOutTimeStr,
          check_out_photo: photoBase64,
          working_hours: workingHours,
          penalty_applied: penaltyApplied
        });

        const botToken = settings?.telegram_bot_token || '8722542358:AAF_2J1eM-WB2IiwLuRkYU29A8pvWd3DtTw';
        const chatId = settings?.telegram_chat_id || '5507184715,7441837470';

        if (chatId) {
          try {
            const res = await fetch(photoBase64);
            const blob = await res.blob();
            
            const caption = `🔴 <b>تسجيل انصراف موظف (Check Out)</b>\n\n` +
                            `• <b>الموظف:</b> ${employee.name}\n` +
                            `• <b>ساعات العمل:</b> ${workingHours} ساعة\n` +
                            `• <b>الخصم التلقائي المطبق:</b> ${penaltyApplied.toFixed(2)} EGP\n` +
                            `• <b>التاريخ:</b> ${todayStr}\n` +
                            `• <b>الوقت:</b> ${new Date().toLocaleTimeString('ar-EG')}`;
            
            const { sendTelegramPhoto } = await import('../utils/telegramUtils');
            await sendTelegramPhoto(botToken, chatId, blob, caption);
          } catch (err) {
            console.error("Failed to send check-out telegram notification:", err);
          }
        }
      }

      const updatedLogs = await db.getAttendanceLogs();
      setAttendanceLogsList(updatedLogs);
      alert(language === 'ar' ? 'تم تسجيل العملية بنجاح!' : 'Successfully recorded!');
        } catch (e) {
      console.error(e);
      alert(language === 'ar' ? 'حدث خطأ أثناء حفظ العملية!' : 'An error occurred during operation!');
    } finally {
      setAttendanceActionInFlight(prev => {
        const next = { ...prev };
        delete next[actionKey];
        return next;
      });
    }
  };
  const handleClose = async () => {
    if (view === 'role_select') {
      onClose();
    } else {
      if (selectedWaiter) {
        try {
          await db.updateWaiterActiveStatus(selectedWaiter.id, false);
        } catch (e) {}
      }
      localStorage.removeItem('meridien_active_pos_waiter');
      setRole(null);
      setSelectedWaiter(null);
      setWaiterPasscode('');
      setCustomerPhone('');
      setCustomerName('');
      setOrderType(null);
      setCart([]);
      setEditOrderId(null);
      setEditingOrder(null);
      setView('role_select');
    }
  };

  const handleWaiterLogin = async () => {
    if (selectedWaiter && selectedWaiter.passcode === waiterPasscode) {
      // Save active waiter to localStorage for auto-assignment
      localStorage.setItem('meridien_active_pos_waiter', JSON.stringify({ id: selectedWaiter.id, name: selectedWaiter.name }));
      try {
        await db.updateWaiterActiveStatus(selectedWaiter.id, true);
      } catch (e) {
        console.error("Failed to set waiter active status in DB:", e);
      }
      setView('waiter_dashboard');
    } else {
      alert(language === 'ar' ? 'كلمة المرور غير صحيحة' : 'Incorrect passcode');
    }
  };

  // Translations
  const t = {
    back: language === 'ar' ? 'رجوع' : 'Back',
    close: language === 'ar' ? 'إغلاق' : 'Close',
    iamCustomer: language === 'ar' ? 'أنا زبون (طلب ذاتي)' : 'I am a Customer',
    iamWaiter: language === 'ar' ? 'أنا كابتن (ويتر)' : 'I am a Waiter (Captain)',
    selectWaiter: language === 'ar' ? 'اختر الكابتن' : 'Select Waiter',
    enterPasscode: language === 'ar' ? 'أدخل الرمز السري' : 'Enter Passcode',
    login: language === 'ar' ? 'دخول' : 'Login',
    phonePrompt: language === 'ar' ? 'أدخل رقم الهاتف للبدء' : 'Enter Phone Number to start',
    namePrompt: language === 'ar' ? 'ما هو اسمك؟' : 'What is your name?',
    continue: language === 'ar' ? 'متابعة' : 'Continue',
    howToReceive: language === 'ar' ? 'كيف تود استلام طلبك؟' : 'How would you like to receive your order?',
    takeaway: language === 'ar' ? 'تيك أواي' : 'Takeaway',
    dineIn: language === 'ar' ? 'داخل المطعم (صالة)' : 'Dine-in',
    delivery: language === 'ar' ? 'توصيل' : 'Delivery',
    talabat: language === 'ar' ? 'طلبات (Talabat)' : 'Talabat',
    tableNum: language === 'ar' ? 'رقم الطاولة' : 'Table Number',
    addToCart: language === 'ar' ? 'إضافة للطلب' : 'Add to Order',
    cart: language === 'ar' ? 'سلة الطلبات' : 'Order Cart',
    total: language === 'ar' ? 'الإجمالي' : 'Total',
    checkout: language === 'ar' ? 'إتمام الطلب' : 'Checkout',
    successMsg: language === 'ar' ? 'تم استلام طلبك بنجاح!' : 'Order received successfully!',
    newOrder: language === 'ar' ? 'طلب جديد' : 'New Order',
  };

  const [productSearchQuery, setProductSearchQuery] = useState('');

  const getVisibleProducts = () => {
    const departmentCategories = categories.filter(c => (c.department || 'restaurant') === posDepartment);
    const activeCategoryForDepartment = departmentCategories.some(c => c.id === activeCategory) ? activeCategory : null;
    return products.filter(p => {
      if (!p.is_available) return false;
      if ((p.department || 'restaurant') !== posDepartment) return false;
      if (productSearchQuery.trim()) {
        const query = productSearchQuery.toLowerCase();
        if (!p.name_ar.toLowerCase().includes(query) && !p.name_en.toLowerCase().includes(query)) return false;
      } else if (activeCategoryForDepartment && p.category_id !== activeCategoryForDepartment) {
        return false;
      }
      if (orderType === 'talabat' && (p.talabat_price === undefined || p.talabat_price === null)) return false;
      return true;
    });
  };

  const getProductPrice = (p: Product) => {
    if (orderType === 'talabat' && p.talabat_price) return p.talabat_price;
    return p.price;
  };

  // حالة المخزون للصنف: 'out' نفذ، 'low' قرب يخلص، 'ok' متاح
  const getStockStatus = (p: Product): 'out' | 'low' | 'ok' => {
    const dept = p.department || 'restaurant';
    const stockField = dept === 'bar' ? 'stock_bar' : 'stock_factory';
    const recipeItems = productRecipes.filter(r => r.product_id === p.id);
    if (recipeItems.length > 0) {
      for (const rec of recipeItems) {
        const invItem = inventoryItems.find(i => i.id === rec.inventory_item_id);
        if (!invItem) continue;
        const s = Number(invItem[stockField]) || 0;
        if (s <= 0) return 'out';
        if (s - rec.quantity <= 0) return 'low';
      }
      return 'ok';
    }
    const invItem = inventoryItems.find(i => i.id === p.id);
    if (invItem) {
      const s = Number(invItem[stockField]) || 0;
      if (s <= 0) return 'out';
      if (s - 1 <= 0) return 'low';
    }
    return 'ok';
  };

  const addToCart = (p: Product) => {
    const price = getProductPrice(p);
    setCart(prev => {
      const existing = prev.find(item => item.id === p.id && !item.note);
      if (existing) {
        return prev.map(item => item.id === p.id && !item.note ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { id: p.id, name_ar: p.name_ar, name_en: p.name_en, price, quantity: 1 }];
    });
  };

  const removeFromCart = (index: number) => setCart(prev => prev.filter((_, idx) => idx !== index));
  
  const updateQuantity = (index: number, delta: number) => {
    setCart(prev => prev.map((item, idx) => {
      if (idx === index) {
        const newQ = item.quantity + delta;
        return newQ > 0 ? { ...item, quantity: newQ } : item;
      }
      return item;
    }));
  };

  const updateItemNote = (index: number, note: string) => {
    setCart(prev => prev.map((item, idx) => idx === index ? { ...item, note } : item));
  };

  const cartSubtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const partnerForTable = (table?: string | null): Partner | undefined => {
    const key = String(table || '').trim().toLowerCase();
    if (!key || key === '-') return undefined;
    return partners.find(p => (p.table_names || []).some(name => String(name).trim().toLowerCase() === key));
  };
  const selectedPartner = orderType === 'dine_in' ? partnerForTable(tableNumber) : undefined;
  const partnerForOrder = (order: Partial<Order>): Partner | undefined =>
    order.partner_id ? partners.find(p => p.id === order.partner_id) : partnerForTable(order.table_number);
  const totalForItems = (
    items: OrderItem[],
    type?: Order['order_type'] | null,
    hall?: string | null,
    freeOrder = false,
    partnerOrder = false
  ) => {
    const subtotal = items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0);
    if (freeOrder) return 0;
    if (partnerOrder) return subtotal * 0.70;
    const taxPercent = taxPercentForOrder(settings, type, hall);
    return subtotal + (subtotal * taxPercent / 100);
  };
  const totalForOrder = (order: Order) =>
    totalForItems(order.items, order.order_type, order.hall, order.payment_method === 'staff', !!partnerForOrder(order));
  const hallTaxPercent = staffOrderFor || selectedPartner ? 0 : taxPercentForOrder(settings, orderType, selectedHall);
  const cartTaxAmount = cartSubtotal * (hallTaxPercent / 100);
  const cartTotal = totalForItems(cart, orderType, selectedHall, !!staffOrderFor, !!selectedPartner);

  // ===== ألوان وفلاتر لوحة الطلبات (بالصالة / نوع الطلب) =====
  const hallColor = (hall?: string): string => {
    if (!hall) return 'var(--gold-primary)';
    const halls = settings?.halls || [];
    const idx = halls.findIndex(h => h.name === hall);
    if (idx >= 0) return HALL_COLORS[idx % HALL_COLORS.length];
    let hash = 0;
    for (let i = 0; i < hall.length; i++) hash = (hash * 31 + hall.charCodeAt(i)) >>> 0;
    return HALL_COLORS[hash % HALL_COLORS.length];
  };
  const orderAccent = (o: Order): string =>
    o.hall ? hallColor(o.hall) : (TYPE_COLORS[o.order_type || ''] || 'var(--gold-primary)');
  const drawerForHall = (hall?: string): 1 | 2 => {
    if (!hall) return 1;
    const idx = (settings?.halls || []).findIndex(h => h.name === hall);
    if (idx === 0) return 1;
    if (idx === 1) return 2;
    return drawerOfHall(hall, settings);
  };
  const orderTypeLabel = (o: Order): string => {
    if (o.order_type === 'takeaway') return language === 'ar' ? 'تيك أواي' : 'Takeaway';
    if (o.order_type === 'delivery') return language === 'ar' ? 'دليفري' : 'Delivery';
    if (o.order_type === 'talabat') return language === 'ar' ? 'طلبات' : 'Talabat';
    if (o.order_type === 'website') return language === 'ar' ? 'موقع' : 'Website';
    return language === 'ar' ? 'صالة' : 'Dine-in';
  };
  const matchesDashFilter = (o: Order): boolean => {
    if (dashFilter === 'all') return true;
    if (dashFilter.startsWith('hall:')) return o.hall === dashFilter.slice(5);
    if (dashFilter.startsWith('type:')) return (o.order_type || '') === dashFilter.slice(5);
    return true;
  };
  // الطلبات النشطة قبل فلتر الصالة/النوع (حسب طلباتي/الكل) + بعده
  const dashBaseOrders = activeOrders.filter(o =>
    viewAllOrders || o.waiter_id === selectedWaiter?.id || (o.order_type === 'website' && !o.waiter_id && o.status === 'pending')
  );
  const dashShownOrders = dashBaseOrders.filter(matchesDashFilter);
  const chipCount = (key: string): number =>
    key === 'all' ? dashBaseOrders.length
      : dashBaseOrders.filter(o => key.startsWith('hall:') ? o.hall === key.slice(5) : (o.order_type || '') === key.slice(5)).length;

  type TableStatus = 'empty' | 'occupied' | 'delivered' | 'check';
  const tableStatusLabels: Record<TableStatus | 'all', string> = {
    all: language === 'ar' ? 'الكل' : 'All',
    empty: language === 'ar' ? 'فاضية' : 'Empty',
    occupied: language === 'ar' ? 'مشغولة' : 'Occupied',
    delivered: language === 'ar' ? 'استلمت الكل' : 'All served',
    check: language === 'ar' ? 'استلمت الشيك' : 'Check printed',
  };
  const tableStatusColors: Record<TableStatus, string> = {
    empty: '#10b981',
    occupied: '#f59e0b',
    delivered: '#3b82f6',
    check: '#8b5cf6',
  };
  const dineInOrdersForHall = (hall: string) =>
    activeOrders.filter(o =>
      o.order_type === 'dine_in' &&
      o.hall === hall &&
      o.table_number &&
      o.table_number !== '-' &&
      ['pending', 'preparing', 'prepared', 'delivered'].includes(o.status)
    );
  const partnerTableEntries = partners.flatMap(partner => (Array.isArray(partner.table_names) ? partner.table_names : []).map(name => ({
    name: String(name).trim(),
    partner
  }))).filter(entry => Boolean(entry.name));
  const partnerTableNames = Array.from(new Set(partnerTableEntries.map(entry => entry.name)));
  const getTableOrder = (hall: string, tableNo: string | number) =>
    dineInOrdersForHall(hall).find(o => String(o.table_number).trim().toLowerCase() === String(tableNo).trim().toLowerCase());
  const checkPrintedKey = (orderId: string) => `meridien_check_printed_${orderId}`;
  const isCheckPrinted = (orderId?: string) => {
    if (!orderId) return false;
    try { return localStorage.getItem(checkPrintedKey(orderId)) === '1'; } catch { return false; }
  };
  const markCheckPrinted = (orderId: string) => {
    try { localStorage.setItem(checkPrintedKey(orderId), '1'); } catch {}
  };
  const getTableStatus = (hall: string, tableNo: string | number): TableStatus => {
    const order = getTableOrder(hall, tableNo);
    if (!order) return 'empty';
    if (isCheckPrinted(order.id)) return 'check';
    if (order.status === 'delivered' || order.status === 'prepared') return 'delivered';
    return 'occupied';
  };
  const tableStatusCount = (status: TableStatus | 'all') => {
    if (!selectedHall) return 0;
    return [...Array.from({ length: 40 }, (_, i) => String(i + 1)), ...partnerTableNames]
      .filter(n => status === 'all' || getTableStatus(selectedHall, n) === status)
      .length;
  };
  const money = (value: number) => `${(Number(value) || 0).toFixed(2)} EGP`;
  const isToday = (date?: string) => !!date && getLocalDayStr(new Date(date)) === getLocalDayStr();
  type PayMethod = 'cash' | 'visa' | 'wallet_restaurant' | 'wallet_cafe' | 'instapay' | 'deferred';
  const payMethods: PayMethod[] = ['cash', 'visa', 'wallet_restaurant', 'wallet_cafe', 'instapay', 'deferred'];
  const payMethodLabel = (method: string) => {
    if (method === 'cash') return language === 'ar' ? 'كاش' : 'Cash';
    if (method === 'visa') return language === 'ar' ? 'فيزا' : 'Visa';
    if (method === 'wallet_restaurant') return language === 'ar' ? 'محفظة المطعم' : 'Restaurant Wallet';
    if (method === 'wallet_cafe') return language === 'ar' ? 'محفظة الكافيه' : 'Cafe Wallet';
    if (method === 'instapay') return language === 'ar' ? 'إنستاباي' : 'Instapay';
    if (method === 'deferred') return language === 'ar' ? 'آجل' : 'Deferred';
    if (method === 'split') return language === 'ar' ? 'مقسم' : 'Split';
    return method;
  };
  const paymentParts = (order: Order): Partial<Record<PayMethod, number>> => {
    return collectedPaymentParts(order) as Partial<Record<PayMethod, number>>;
  };
  const todayOrders = allOrders.filter(o => isToday(o.created_at));
  const matchesSummaryScope = (order: Order) => {
    if (scopedSummaryFilter === 'all') return true;
    if (scopedSummaryFilter.startsWith('hall:')) return order.hall === scopedSummaryFilter.slice(5);
    if (scopedSummaryFilter.startsWith('drawer:')) return (order.drawer || (order.hall ? drawerForHall(order.hall) : undefined)) === Number(scopedSummaryFilter.slice(7));
    return true;
  };
  const summaryScopeLabel = () => {
    if (scopedSummaryFilter === 'all') return language === 'ar' ? 'كل الصالات والخزن' : 'All halls and drawers';
    if (scopedSummaryFilter.startsWith('hall:')) return scopedSummaryFilter.slice(5);
    if (scopedSummaryFilter === 'drawer:1') return drawerName(1, settings, language === 'ar');
    if (scopedSummaryFilter === 'drawer:2') return drawerName(2, settings, language === 'ar');
    return scopedSummaryFilter;
  };
  const summaryOrders = todayOrders.filter(o =>
    matchesSummaryScope(o) &&
    (summaryOrderTypeFilter === 'all' || o.order_type === summaryOrderTypeFilter)
  );
  const todayCompletedOrders = summaryOrders.filter(o => o.status === 'completed' && o.payment_method !== 'hospitality' && o.payment_method !== 'staff');
  const summaryExpenses = expenses.filter(e => {
    if (getLocalDayStr(new Date(e.expense_date || e.created_at || '')) !== getLocalDayStr()) return false;
    if (scopedSummaryFilter.startsWith('drawer:')) return Number(e.drawer || 1) === Number(scopedSummaryFilter.slice(7));
    if (scopedSummaryFilter.startsWith('hall:')) return drawerOfHall(scopedSummaryFilter.slice(5), settings) === Number(e.drawer || 1);
    return true;
  });
  const summaryExpensesTotal = summaryExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const paymentTotals = payMethods.reduce((acc, method) => ({ ...acc, [method]: 0 }), {} as Record<PayMethod, number>);
  todayCompletedOrders.forEach(order => {
    Object.entries(paymentParts(order)).forEach(([method, amount]) => {
      paymentTotals[method as PayMethod] += Number(amount) || 0;
    });
    // الآجل لا يدخل في المحصل، لكنه يجب أن يظهر في صف «آجل» حتى تتطابق التقسيمة مع إجمالي الفاتورة.
    const deferred = deferredFromOrder(order);
    if (deferred > 0) paymentTotals.deferred += deferred;
  });
  const unpaidTableOrders = summaryOrders.filter(o =>
    o.order_type === 'dine_in' &&
    ['pending', 'preparing', 'prepared', 'delivered'].includes(o.status)
  );
  const unpaidTablesTotal = unpaidTableOrders.reduce((sum, o) => sum + totalForOrder(o), 0);
  const summaryRevenue = todayCompletedOrders.reduce((sum, o) => sum + collectedFromOrder(o), 0);
  const summaryDeferred = todayCompletedOrders.reduce((sum, o) => sum + deferredFromOrder(o), 0);
  const summarySubtotal = todayCompletedOrders.reduce((sum, o) => {
    return sum + o.items.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.quantity) || 0), 0);
  }, 0);
  const summaryTax = todayCompletedOrders.reduce((sum, o) => {
    const base = o.items.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.quantity) || 0), 0);
    const percent = taxPercentForOrder(settings, o.order_type, o.hall);
    return sum + (base * (percent / 100));
  }, 0);
  const summaryDiscount = Math.max(0, summarySubtotal + summaryTax - summaryRevenue);

  const printShiftSummary = () => {
    const ar = language === 'ar';
    const typeLabel = summaryOrderTypeFilter === 'all' ? (ar ? 'كل أنواع الطلب' : 'All order types') : orderTypeLabel({ order_type: summaryOrderTypeFilter } as Order);
    const scopeLabel = summaryScopeLabel();
    const methodRows = payMethods.map(method => `
      <tr><td>${payMethodLabel(method)}</td><td>${money(paymentTotals[method])}</td></tr>
    `).join('');
    const unpaidRows = unpaidTableOrders.map(o => `
      <tr><td>${o.hall || ''}</td><td>${o.table_number}</td><td>#${o.id.slice(-4)}</td><td>${money(totalForOrder(o))}</td></tr>
    `).join('');
    const visibleHalls = (settings?.halls || []).filter(h => {
      if (scopedSummaryFilter === 'all') return true;
      if (scopedSummaryFilter.startsWith('hall:')) return h.name === scopedSummaryFilter.slice(5);
      if (scopedSummaryFilter.startsWith('drawer:')) return drawerForHall(h.name) === Number(scopedSummaryFilter.slice(7));
      return true;
    });
    const hallRows = visibleHalls.map(h => {
      const counts = (['empty', 'occupied', 'delivered', 'check'] as TableStatus[])
        .map(status => `${tableStatusLabels[status]}: ${Array.from({ length: 40 }, (_, i) => i + 1).filter(n => getTableStatus(h.name, n) === status).length}`)
        .join(' | ');
      return `<tr><td>${h.name}</td><td>${counts}</td></tr>`;
    }).join('');
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <html dir="${ar ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>${ar ? 'تقرير تقفيل شيفت' : 'Shift Closing Report'}</title>
      <style>
        body{font-family:Tahoma,Arial,sans-serif;padding:24px;color:#111}
        h1,h2{margin:0 0 12px}
        table{width:100%;border-collapse:collapse;margin:12px 0 22px}
        th,td{border:1px solid #ddd;padding:8px;text-align:${ar ? 'right' : 'left'}}
        th{background:#111;color:#fff}
        .total{font-size:20px;font-weight:800;margin:10px 0}
        .total.sub{font-size:16px;font-weight:600;margin:6px 0;color:#444}
      </style></head><body>
        <h1>${ar ? 'تقرير تقفيل شيفت' : 'Shift Closing Report'}</h1>
        <div>${new Date().toLocaleString(ar ? 'ar-EG' : 'en-US')}</div>
        <div>${ar ? 'النطاق' : 'Scope'}: ${scopeLabel}</div>
        <div>${ar ? 'نوع الطلب' : 'Order type'}: ${typeLabel}</div>
        <hr style="margin:16px 0; border:1px solid #eee;" />
        <div class="total sub">${ar ? 'إجمالي قبل الضريبة' : 'Total Before Tax'}: ${money(summarySubtotal)}</div>
        <div class="total sub">${ar ? 'إجمالي الضريبة' : 'Total Tax'}: ${money(summaryTax)}</div>
        ${summaryDiscount > 0.001 ? `<div class="total sub" style="color:#d32f2f">${ar ? 'إجمالي الخصم' : 'Total Discount'}: - ${money(summaryDiscount)}</div>` : ''}
        <div class="total">${ar ? 'إجمالي المحصل الفعلي' : 'Actual Collected'}: ${money(summaryRevenue)}</div>
        <div class="total sub">${ar ? 'إجمالي الآجل' : 'Deferred Total'}: ${money(summaryDeferred)}</div>
        <div class="total sub" style="color:#b71c1c">${ar ? 'إجمالي المصروفات' : 'Total Expenses'}: ${money(summaryExpensesTotal)}</div>
        <hr style="margin:16px 0; border:1px solid #eee;" />
        <div class="total sub">${ar ? 'لسه متحصلش من الطاولات' : 'Unpaid table total'}: ${money(unpaidTablesTotal)}</div>
        <h2>${ar ? 'تقسيمة وسائل الدفع' : 'Payment Breakdown'}</h2>
        <table><thead><tr><th>${ar ? 'وسيلة الدفع' : 'Method'}</th><th>${ar ? 'المبلغ' : 'Amount'}</th></tr></thead><tbody>${methodRows}</tbody></table>
        <h2>${ar ? 'حالة الطاولات' : 'Table Status'}</h2>
        <table><thead><tr><th>${ar ? 'الصالة' : 'Hall'}</th><th>${ar ? 'الحالات' : 'Statuses'}</th></tr></thead><tbody>${hallRows}</tbody></table>
        <h2>${ar ? 'مبالغ غير محصلة' : 'Unpaid Tables'}</h2>
        <table><thead><tr><th>${ar ? 'الصالة' : 'Hall'}</th><th>${ar ? 'الطاولة' : 'Table'}</th><th>${ar ? 'الأوردر' : 'Order'}</th><th>${ar ? 'المبلغ' : 'Amount'}</th></tr></thead><tbody>${unpaidRows || `<tr><td colspan="4">${ar ? 'لا يوجد' : 'None'}</td></tr>`}</tbody></table>
      </body></html>
    `);
    w.document.close();
    w.focus();
    w.print();
  };

  const placeOrder = async () => {
    if (cart.length === 0) return;
    
    if (editOrderId && editingOrder) {
      // Detect deletions and cancellation/reduction of quantities
      let deletedItemsText = '';
      originalOrderItems.forEach(orig => {
        const currentItem = cart.find(c => c.id === orig.id && (c.note || '') === (orig.note || ''));
        if (!currentItem) {
          deletedItemsText += `\n- <b>${orig.name_ar} (تم حذفه بالكامل)</b>. الكمية السابقة: ${orig.quantity}`;
        } else if (currentItem.quantity < orig.quantity) {
          deletedItemsText += `\n- <b>${orig.name_ar} (تقليل كمية)</b>. الكمية السابقة: ${orig.quantity} -> الكمية الحالية: ${currentItem.quantity}`;
        }
      });

      if (deletedItemsText && settings?.telegram_chat_id) {
        const text = `🗑️ <b>تنبيه تعديل وحذف أصناف من الفاتورة</b>\n\n` +
          `• <b>رقم الطلب:</b> <code>#${editOrderId.slice(0, 6)}</code>\n` +
          `• <b>الكابتن:</b> ${selectedWaiter?.name || 'غير معروف'}\n` +
          `• <b>العميل:</b> ${customerName || 'غير معروف'}\n` +
          `• <b>الأصناف المعدلة:</b>${deletedItemsText}`;
        
        import('../utils/telegramUtils').then(({ sendTelegramMessage }) => {
          sendTelegramMessage(settings?.telegram_bot_token, settings?.telegram_chat_id, text);
        });
      }

      // We are editing an existing order
      const updatedOrder = await db.updateOrder(editOrderId, {
        items: cart,
        total_price: totalForItems(
          cart,
          orderType || editingOrder.order_type,
          (orderType || editingOrder.order_type) === 'dine_in' ? (selectedHall || editingOrder.hall) : undefined,
          editingOrder.payment_method === 'staff',
          !!partnerForOrder({ ...editingOrder, table_number: tableNumber, order_type: orderType || editingOrder.order_type })
        ),
        partner_id: partnerForOrder({ ...editingOrder, table_number: tableNumber, order_type: orderType || editingOrder.order_type })?.id,
        partner_discount_percent: partnerForOrder({ ...editingOrder, table_number: tableNumber, order_type: orderType || editingOrder.order_type }) ? 30 : undefined,
        partner_subtotal: partnerForOrder({ ...editingOrder, table_number: tableNumber, order_type: orderType || editingOrder.order_type }) ? cartSubtotal : undefined,
        partner_amount_due: partnerForOrder({ ...editingOrder, table_number: tableNumber, order_type: orderType || editingOrder.order_type }) ? totalForItems(cart, orderType || editingOrder.order_type, (orderType || editingOrder.order_type) === 'dine_in' ? (selectedHall || editingOrder.hall) : undefined, false, true) : undefined,
        customer_name: partnerForOrder({ ...editingOrder, table_number: tableNumber, order_type: orderType || editingOrder.order_type })?.name || customerName,
        customer_phone: customerPhone,
        table_number: tableNumber,
        order_type: orderType || editingOrder.order_type
      }, selectedWaiter?.name);

      // احسب الأصناف الجديدة فقط (صنف جديد أو زيادة كمية) واطبعها للمطبخ/البار — من غير إعادة طباعة الأوردر كله
      const addedItems = cart.map(ci => {
        const orig = originalOrderItems.find(o => o.id === ci.id && (o.note || '') === (ci.note || ''));
        const addedQty = orig ? ci.quantity - orig.quantity : ci.quantity;
        return addedQty > 0 ? { ...ci, quantity: addedQty } : null;
      }).filter((i): i is OrderItem => i !== null);

      if (addedItems.length > 0) {
        if (!['pending', 'preparing'].includes(editingOrder.status)) {
          await db.updateOrder(editOrderId, { status: 'pending' }, selectedWaiter?.name);
        }
        const additionOrder = { ...(updatedOrder || editingOrder), id: editOrderId, items: addedItems } as Order;
        printOrderTickets(additionOrder, categories, products, printers, language, settings, { isAddition: true });
      }

      setLastPlacedOrder(updatedOrder);
      setCart([]);
      setEditOrderId(null);
      setEditingOrder(null);
      setSelectedHall('');
      setOriginalOrderItems([]);
      setView('waiter_dashboard');
      loadData();
      return;
    }

    // Auto assign waiter if it's a customer ordering
    let assignedWaiterId = selectedWaiter?.id;
    let assignedWaiterName = selectedWaiter?.name;
    
    if (role === 'customer' && waiters.length > 0) {
      const randomWaiter = waiters[Math.floor(Math.random() * waiters.length)];
      assignedWaiterId = randomWaiter.id;
      assignedWaiterName = randomWaiter.name;
    }

    const newOrder: Omit<Order, 'id'> = {
      customer_name: selectedPartner?.name || customerName || 'Guest',
      customer_phone: customerPhone || 'N/A',
      table_number: tableNumber || '-',
      hall: orderType === 'dine_in' && selectedHall ? selectedHall : undefined,
      // طلبات الصالة بتاخد خزنة الصالة أوتوماتيك — غير كده الكاشير بيختار وقت التحصيل
      drawer: orderType === 'dine_in' && selectedHall ? drawerForHall(selectedHall) : undefined,
      items: cart,
      // طلب الاستاف مجاني: الإجمالي صفر، والقيمة الحقيقية بتتحفظ في payment_details للتقارير
      total_price: staffOrderFor ? 0 : cartTotal,
      status: 'pending',
      order_type: orderType || 'takeaway',
      waiter_id: assignedWaiterId,
      waiter_name: assignedWaiterName,
      ...(selectedPartner ? {
        partner_id: selectedPartner.id,
        partner_discount_percent: 30,
        partner_subtotal: cartSubtotal,
        partner_amount_due: cartTotal,
        payment_method: 'partner' as const,
        payment_details: { type: 'partner', partner_id: selectedPartner.id, partner_name: selectedPartner.name, cash_collected: 0 }
      } : {}),
      ...(staffOrderFor ? {
        payment_method: 'staff' as const,
        payment_details: {
          type: 'staff',
          original_price: cartSubtotal,
          employee_id: staffOrderFor.id,
          employee_name: staffOrderFor.name,
        },
      } : {}),
      created_at: new Date().toISOString()
    };

    const placedOrder = await db.addOrder(newOrder);
    setLastPlacedOrder(placedOrder);
    setCart([]);
    setStaffOrderFor(null); // الطلب اتسجل — نرجّع الوضع الطبيعي للطلب اللي بعده
    setView('success');
    playSuccessSound();
    loadData();
    
    // Send Telegram Notification immediately for any placed order
    if (settings?.telegram_chat_id) {
      const itemsText = placedOrder.items.map(item => `- ${item.quantity}x ${language === 'ar' ? item.name_ar : item.name_en}`).join('\n');
      const text = (staffOrderFor ? `👨‍🍳 <b>طلب استاف (مجاني)</b>\n• <b>الموظف:</b> ${staffOrderFor.name}\n• <b>قيمة الطلب:</b> ${cartSubtotal.toFixed(2)} EGP\n\n` : `📥 <b>طلب جديد!</b>\n\n`) +
        `• <b>رقم الطلب:</b> <code>#${placedOrder.id.slice(0, 6)}</code>\n` +
        `• <b>العميل:</b> ${placedOrder.customer_name || 'غير معروف'}\n` +
        `• <b>النوع:</b> ${placedOrder.order_type || 'takeaway'}\n` +
        `• <b>الطاولة:</b> ${placedOrder.table_number || '-'}\n` +
        `• <b>الكابتن:</b> ${placedOrder.waiter_name || 'غير معروف'}\n` +
        `• <b>الأصناف:</b>\n${itemsText}\n\n` +
        `• <b>الإجمالي:</b> ${placedOrder.total_price.toFixed(2)} EGP`;
      
      import('../utils/telegramUtils').then(({ sendTelegramMessage }) => {
        sendTelegramMessage(settings?.telegram_bot_token, settings?.telegram_chat_id, text);
      });
    }

    // طباعة بونات المطبخ/البار تلقائي عند تأكيد الأوردر (فاتورة العميل تطبع وقت الدفع)
    printOrderTickets(placedOrder, categories, products, printers, language, settings);
  };

  const handleTransferSubmit = async () => {
    if (!transferItem || !transferTargetOrderId || !editingOrder) return;
    if (transferQty < 1 || transferQty > transferItem.quantity) return;

    try {
      const targetOrder = activeOrders.find(o => o.id === transferTargetOrderId);
      if (!targetOrder) return;

      // 1. Deduct from source order
      const sourceItems = editingOrder.items.map(item => {
        if (item.id === transferItem.id && (item.note || '') === (transferItem.note || '')) {
          return { ...item, quantity: item.quantity - transferQty };
        }
        return item;
      }).filter(item => item.quantity > 0);

      const sourceTotal = totalForItems(sourceItems, editingOrder.order_type, editingOrder.hall, editingOrder.payment_method === 'staff');

      // 2. Add to target order
      const targetItems = [...targetOrder.items];
      const existingItemIdx = targetItems.findIndex(item => item.id === transferItem.id && (item.note || '') === (transferItem.note || ''));
      if (existingItemIdx > -1) {
        targetItems[existingItemIdx] = {
          ...targetItems[existingItemIdx],
          quantity: targetItems[existingItemIdx].quantity + transferQty
        };
      } else {
        targetItems.push({
          ...transferItem,
          quantity: transferQty
        });
      }

      const targetTotal = totalForItems(targetItems, targetOrder.order_type, targetOrder.hall, targetOrder.payment_method === 'staff');

      // 3. Save updates
      await db.updateOrder(editingOrder.id, {
        items: sourceItems,
        total_price: sourceTotal
      }, selectedWaiter?.name);

      await db.updateOrder(targetOrder.id, {
        items: targetItems,
        total_price: targetTotal
      }, selectedWaiter?.name);

      // 4. Send Telegram Notification
      if (settings?.telegram_chat_id) {
        const text = `🔄 <b>تنبيه نقل أصناف بين الطلبات</b>\n\n` +
          `• <b>الكابتن:</b> ${selectedWaiter?.name || 'غير معروف'}\n` +
          `• <b>من الطلب:</b> <code>#${editingOrder.id.slice(0, 6)}</code> (${editingOrder.customer_name})\n` +
          `• <b>إلى الطلب:</b> <code>#${targetOrder.id.slice(0, 6)}</code> (${targetOrder.customer_name})\n` +
          `• <b>الصنف المنقول:</b> ${language === 'ar' ? transferItem.name_ar : transferItem.name_en}\n` +
          `• <b>الكمية المنقولة:</b> ${transferQty}`;

        import('../utils/telegramUtils').then(({ sendTelegramMessage }) => {
          sendTelegramMessage(settings?.telegram_bot_token, settings?.telegram_chat_id, text);
        });
      }

      // Reset states
      setTransferItem(null);
      setTransferTargetOrderId('');
      setTransferQty(1);

      // Update local state to trigger render correctly
      setEditingOrder({
        ...editingOrder,
        items: sourceItems,
        total_price: sourceTotal
      });

      loadData();
    } catch (err) {
      alert(language === 'ar' ? 'فشل نقل الصنف، يرجى المحاولة مرة أخرى' : 'Failed to transfer item, please try again.');
    }
  };

  const handleMergeSubmit = async () => {
    if (!mergeTargetOrderId || !editingOrder) return;
    try {
      const targetOrder = activeOrders.find(o => o.id === mergeTargetOrderId);
      if (!targetOrder) return;

      const combinedItems = [...editingOrder.items];
      targetOrder.items.forEach(targetItem => {
        const existing = combinedItems.find(i => i.id === targetItem.id && i.note === targetItem.note);
        if (existing) {
          existing.quantity += targetItem.quantity;
        } else {
          combinedItems.push({ ...targetItem });
        }
      });

      const combinedTotal = totalForItems(combinedItems, editingOrder.order_type, editingOrder.hall, editingOrder.payment_method === 'staff');

      // Update the main order
      await db.updateOrder(editingOrder.id, {
        items: combinedItems,
        total_price: combinedTotal,
      }, selectedWaiter?.name);

      // Delete the target order since it's merged
      await db.deleteOrder(targetOrder.id, selectedWaiter?.name);

      // Send telegram log
      if (settings?.telegram_bot_token && settings?.telegram_chat_id) {
        const text = `🔄 <b>دمج طاولات (Merge Tables)</b>\n\n` +
          `• <b>الكابتن:</b> ${selectedWaiter?.name || 'غير معروف'}\n` +
          `• <b>الطلب الرئيسي:</b> <code>#${editingOrder.id.slice(0, 6)}</code> (${editingOrder.customer_name})\n` +
          `• <b>تم دمج وإلغاء الطلب:</b> <code>#${targetOrder.id.slice(0, 6)}</code> (${targetOrder.customer_name})\n`;

        import('../utils/telegramUtils').then(({ sendTelegramMessage }) => {
          sendTelegramMessage(settings?.telegram_bot_token, settings?.telegram_chat_id, text);
        });
      }

      setMergeModalOpen(false);
      setMergeTargetOrderId('');
      setEditingOrder({
        ...editingOrder,
        items: combinedItems,
        total_price: combinedTotal
      });

      loadData();
    } catch (err) {
      alert(language === 'ar' ? 'فشل دمج الطاولات، يرجى المحاولة مرة أخرى' : 'Failed to merge tables, please try again.');
    }
  };

  const handleDebtSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(debtAmount);
    const customer = customers.find(c => c.id === debtCustomerId);
    if (!customer || !amount || isNaN(amount) || amount <= 0) {
      alert(language === 'ar' ? 'الرجاء إدخال العميل والمبلغ بشكل صحيح' : 'Please enter customer and valid amount');
      return;
    }
    if (amount > Number(customer.total_debt || 0)) {
      alert(language === 'ar' ? 'مبلغ السداد أكبر من مديونية العميل' : 'Settlement cannot exceed the customer debt');
      return;
    }
    try {
      await db.updateCustomerDebt(customer.id, Math.max(0, Number(customer.total_debt || 0) - amount));
      await db.addCustomerPayment({
        customer_id: customer.id,
        amount,
        payment_method: debtPaymentMethod as any,
        notes: debtNotes || 'تسديد مديونية من نقطة البيع',
        employee_id: selectedWaiter?.id,
        employee_name: selectedWaiter?.name,
        payment_date: getLocalDayStr(),
        drawer: effectiveDrawer(debtDrawer),
      });
      await db.addFinancialTransaction({
        type: 'debt_settlement',
        amount,
        to_method: debtPaymentMethod,
        drawer: effectiveDrawer(debtDrawer),
        customer_id: debtCustomerId,
        description: debtNotes || 'تسديد مديونية من نقطة البيع'
      });
      alert(language === 'ar' ? 'تم تسجيل السداد بنجاح!' : 'Debt settlement recorded!');
      setDebtModalOpen(false);
      setDebtCustomerId('');
      setDebtAmount('');
      setDebtNotes('');
      setDebtPaymentMethod('cash');
      setDebtDrawer(1);
      loadData();
    } catch (err) {
      console.error(err);
      alert(language === 'ar' ? 'فشل تسجيل السداد' : 'Failed to record settlement');
    }
  };

  const handleCustomerDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(depositAmount);
    const customer = customers.find(c => c.id === depositCustomerId);
    if (!customer || !amount || amount <= 0) {
      alert(language === 'ar' ? 'اختر العميل وأدخل مبلغًا صحيحًا' : 'Select a customer and enter a valid amount');
      return;
    }
    if (amount > Number(customer.total_debt || 0)) {
      alert(language === 'ar' ? 'مبلغ الإيداع أكبر من مديونية العميل' : 'Deposit cannot exceed the customer debt');
      return;
    }
    setDepositSaving(true);
    try {
      const nextDebt = Math.max(0, Number(customer.total_debt || 0) - amount);
      await db.updateCustomerDebt(customer.id, nextDebt);
      await db.addCustomerPayment({
        customer_id: customer.id,
        amount,
        payment_method: depositPaymentMethod as CustomerPayment['payment_method'],
        notes: depositNotes || 'إيداع/تحصيل من حساب العميل',
        employee_id: selectedWaiter?.id,
        employee_name: selectedWaiter?.name,
        payment_date: getLocalDayStr(),
        drawer: effectiveDrawer(depositDrawer),
      });
      await db.addFinancialTransaction({ type: 'debt_settlement', amount, to_method: depositPaymentMethod, drawer: effectiveDrawer(depositDrawer), customer_id: customer.id, description: depositNotes || `إيداع للعميل ${customer.name}` });
      alert(language === 'ar' ? 'تم تسجيل الإيداع وتحديث حساب العميل' : 'Deposit recorded and customer account updated');
      setDepositModalOpen(false);
      setDepositCustomerId(''); setDepositAmount(''); setDepositNotes(''); setDepositPaymentMethod('cash'); setDepositDrawer(1);
      loadData();
    } catch (err) {
      console.error(err);
      alert(language === 'ar' ? 'فشل تسجيل الإيداع' : 'Failed to record deposit');
    } finally { setDepositSaving(false); }
  };

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(expenseAmount);
    const selectedEmp = employeesList.find(emp => emp.id === expenseEmployeeId);
    if (!expenseName.trim() || !amount || amount <= 0 || !selectedEmp || !expenseEmployeeId) {
      alert(language === 'ar' ? 'أكمل اسم المصروف والمبلغ والخزنة والموظف المستلم' : 'Complete the expense name, amount, drawer and recipient employee');
      return;
    }
    setExpenseSaving(true);
    try {
      await db.addExpense({
        name: expenseName.trim(),
        type: 'مصروف غير مصنف',
        amount,
        payment_method: expensePaymentMethod as Expense['payment_method'],
        expense_date: getLocalDayStr(),
        notes: expenseNotes.trim() || undefined,
        employee_id: selectedEmp.id,
        employee_name: selectedEmp.name,
        source: 'pos',
        classification_status: 'pending',
        drawer: effectiveDrawer(expenseDrawer)
      });
      alert(language === 'ar' ? 'تم تسجيل سحب المصروف وسيظهر في تسوية المصروفات بالإدارة' : 'Expense withdrawal recorded for admin classification');
      setExpenseModalOpen(false);
      setExpenseName(''); setExpenseAmount(''); setExpenseNotes(''); setExpenseEmployeeId(''); setExpensePaymentMethod('cash'); setExpenseDrawer(1);
      loadData();
    } catch (err) { console.error(err); alert(language === 'ar' ? 'فشل تسجيل سحب المصروف' : 'Failed to record expense withdrawal'); }
    finally { setExpenseSaving(false); }
  };

  return (
    <div className="pos-fullscreen">
      <style>{`
        .pos-fullscreen {
          position: fixed; inset: 0; width: 100vw; height: 100vh; height: 100dvh;
          background: var(--bg-dark); color: var(--text-white); z-index: 99999;
          display: flex; flex-direction: column;
          font-family: 'Cairo', 'Inter', sans-serif;
          overflow: hidden;
        }
        .pos-header {
          display: flex; justify-content: space-between; padding: 1rem 2rem;
          background: var(--bg-card); border-bottom: 2px solid var(--gold-primary);
          align-items: center;
        }
        .pos-content {
          flex: 1; min-height: 0; min-width: 0; display: flex; position: relative; overflow: hidden;
          box-sizing: border-box; padding-top: 5rem;
          overscroll-behavior: contain;
        }
        .pos-top-controls {
          position: absolute; top: 0.65rem; left: 0.75rem; right: 0.75rem;
          display: flex; justify-content: space-between; align-items: flex-start;
          gap: 0.5rem; z-index: 100; padding: 0.4rem;
          background: rgba(9, 9, 10, 0.92); border: 1px solid rgba(212, 175, 55, 0.28);
          border-radius: 12px; backdrop-filter: blur(8px);
        }
        .pos-top-actions {
          display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem;
          min-width: 0; flex: 1;
        }
        .pos-top-actions button { white-space: nowrap; min-height: 38px; }
        .pos-top-close { flex: 0 0 40px; }
        .pos-content > .pos-top-controls + * { min-width: 0; }
        .pos-btn {
          background: linear-gradient(45deg, var(--gold-dark), var(--gold-primary));
          color: #000; border: none; padding: 1rem 2rem; border-radius: 12px;
          font-size: 1.2rem; font-weight: bold; cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .pos-btn:hover {
          transform: translateY(-3px); box-shadow: 0 10px 20px rgba(212, 175, 55, 0.3);
        }
        .pos-btn:disabled {
          background: #333; color: #666; cursor: not-allowed; box-shadow: none; transform: none;
        }
        .pos-btn-outline {
          background: transparent; border: 2px solid var(--gold-primary);
          color: var(--gold-primary); padding: 1rem 2rem; border-radius: 12px;
          font-size: 1.2rem; font-weight: bold; cursor: pointer;
        }
        .pos-input {
          background: var(--bg-darker); border: 2px solid var(--border-color); color: var(--text-white);
          padding: 1rem; border-radius: 12px; font-size: 1.2rem; width: 100%;
          text-align: center; outline: none; transition: border-color 0.3s;
        }
        .pos-input:focus { border-color: var(--gold-primary); }
        .grid-options {
          display: grid; grid-template-columns: repeat(2, 1fr);
          gap: 1.5rem; width: 100%; max-width: 600px; margin: 0 auto;
        }
        .option-card {
          background: var(--bg-card); border: 2px solid var(--border-color); border-radius: 16px;
          padding: 2rem; text-align: center; cursor: pointer;
          transition: all 0.3s; display: flex; flex-direction: column; align-items: center; gap: 1rem;
        }
        .option-card:hover, .option-card.active {
          border-color: var(--gold-primary); background: rgba(212, 175, 55, 0.05);
          transform: translateY(-5px);
        }
        .pos-menu-sidebar {
          width: 250px; background: var(--bg-card); overflow-y: auto; border-right: 1px solid var(--border-color);
        }
        .pos-cat-item {
          padding: 1.5rem; cursor: pointer; border-bottom: 1px solid var(--border-color);
          font-size: 1.1rem; font-weight: bold; transition: 0.2s;
        }
        .pos-cat-item.active {
          background: var(--gold-primary); color: #000;
        }
        .pos-products {
          flex: 1; min-width: 0; min-height: 0; padding: 2rem; overflow-y: auto; overflow-x: hidden;
          -webkit-overflow-scrolling: touch; overscroll-behavior: contain;
          display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1.5rem; align-content: start;
        }
        .pos-product-card {
          background: var(--bg-card); border-radius: 16px; overflow: hidden;
          cursor: pointer; border: 2px solid transparent; transition: 0.2s;
          display: flex; flex-direction: column;
        }
        .pos-product-card:active { transform: scale(0.95); }
        .pos-product-img { width: 100%; height: 160px; object-fit: cover; }
        .pos-cart-panel {
          width: 350px; min-width: 0; min-height: 0; background: var(--bg-card); border-left: 1px solid var(--border-color);
          display: flex; flex-direction: column; overflow: hidden;
        }

        /* Responsive Mobile Styles */
        @media (max-width: 768px) {
          .pos-fullscreen {
            position: absolute !important;
            inset: 0 auto auto 0 !important;
            width: 100vw !important;
            min-height: 100dvh !important;
            height: auto !important;
            overflow-x: hidden !important;
            overflow-y: auto !important;
            touch-action: pan-y;
          }
          .pos-header {
            padding: 1rem;
          }
          .pos-top-controls {
            position: relative !important;
            inset: auto !important;
            width: 100%; box-sizing: border-box;
            flex: 0 0 auto;
            padding: 0.35rem;
            border-radius: 0 0 12px 12px;
          }
          .pos-top-actions {
            flex-wrap: nowrap;
            overflow-x: auto;
            overflow-y: hidden;
            scrollbar-width: none;
            -webkit-overflow-scrolling: touch;
          }
          .pos-top-actions::-webkit-scrollbar { display: none; }
          .pos-top-actions button,
          .pos-top-actions > div { flex: 0 0 auto; }
          .pos-top-actions button { padding: 0.45rem 0.65rem !important; font-size: 0.78rem !important; }
          .pos-top-close { flex-basis: 36px !important; width: 36px !important; height: 36px !important; }
          .pos-content { padding-top: 0; }
          .pos-header h1 {
            font-size: 1.5rem !important;
          }
          .grid-options {
            grid-template-columns: 1fr !important;
            gap: 1rem !important;
            max-width: 100% !important;
            padding: 1rem !important;
          }
          .option-card {
            padding: 1.5rem !important;
          }
          .pos-content {
            flex-direction: column;
            min-height: 0 !important;
            overflow: hidden !important;
          }
          .pos-content > .pos-top-controls + * {
            flex: 1 1 auto !important;
            min-height: 0 !important;
            width: 100% !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
            -webkit-overflow-scrolling: touch;
            overscroll-behavior-y: contain;
          }
          
          /* Menu View on Mobile */
          .pos-menu-layout {
            display: flex !important;
            flex-direction: column !important;
            align-items: stretch !important;
            width: 100% !important;
            min-height: 0 !important;
            overflow: visible !important;
          }
          .pos-menu-sidebar {
            width: 100% !important;
            height: auto !important;
            max-height: 60px !important;
            display: flex !important;
            overflow-x: auto !important;
            overflow-y: hidden !important;
            border-right: none !important;
            border-bottom: 1px solid #333 !important;
            white-space: nowrap !important;
            flex-direction: row !important;
            flex-shrink: 0 !important;
            scrollbar-width: none !important;
          }
          .pos-menu-sidebar::-webkit-scrollbar {
            display: none !important;
          }
          .pos-cat-item {
            padding: 0.8rem 1.2rem !important;
            border-bottom: none !important;
            border-right: 1px solid #222 !important;
            flex-shrink: 0 !important;
            font-size: 0.95rem !important;
            display: flex !important;
            align-items: center !important;
          }
          
          .pos-products {
            flex: none !important;
            width: 100% !important;
            height: auto !important;
            min-height: 420px !important;
            padding: 0.75rem !important;
            padding-bottom: 5.5rem !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
            grid-template-columns: none !important;
          }
          .pos-product-grid {
            flex: none !important;
            min-height: 200px !important;
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 0.7rem !important;
            padding: 0 !important;
          }
          .pos-product-card {
            border-radius: 12px !important;
          }
          .pos-product-img {
            height: 100px !important;
          }
          .pos-product-card h4 {
            font-size: 0.95rem !important;
          }
          
          .pos-cart-panel {
            width: 100% !important;
            height: 100% !important;
            min-height: 0 !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            z-index: 100 !important;
            border-left: none !important;
            display: none;
          }
          
          /* Show cart panel when active on mobile */
          .pos-content.show-mobile-cart .pos-cart-panel {
            display: flex !important;
          }
          .pos-content.show-mobile-cart .pos-menu-sidebar,
          .pos-content.show-mobile-cart .pos-products {
            display: none !important;
          }
          
          .mobile-cart-bar {
            display: flex !important;
          }
          
          /* Checkout buttons */
          .pos-btn, .pos-btn-outline {
            width: 90% !important;
            max-width: 320px !important;
            margin: 0.5rem auto !important;
            padding: 0.8rem 1.5rem !important;
            font-size: 1.1rem !important;
          }
          
          .mobile-only-btn {
            display: block !important;
          }

          /* The whole POS page scrolls on mobile, including the top controls. */
          .pos-content {
            flex: none !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
          }
          .pos-content > .pos-top-controls + * {
            flex: none !important;
            min-height: calc(100dvh - 4.5rem) !important;
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
          }
          .pos-dashboard-actions {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 0.55rem !important;
            width: 100% !important;
            justify-content: stretch !important;
          }
          .pos-dashboard-actions > button {
            width: 100% !important;
            min-width: 0 !important;
            max-width: none !important;
            min-height: 48px !important;
            margin: 0 !important;
            padding: 0.65rem 0.4rem !important;
            font-size: 0.82rem !important;
            line-height: 1.35 !important;
          }
        }
        
        /* Floating mobile cart bar styles */
        .mobile-cart-bar {
          display: none;
          position: absolute;
          bottom: 1.5rem;
          left: 5%;
          width: 90%;
          background: linear-gradient(45deg, var(--gold-dark), var(--gold-primary));
          color: #000;
          padding: 1rem 1.5rem;
          border-radius: 50px;
          justify-content: space-between;
          align-items: center;
          font-weight: bold;
          font-size: 1.1rem;
          box-shadow: 0 10px 25px rgba(212,175,55,0.4);
          cursor: pointer;
          z-index: 90;
          animation: bounceIn 0.3s ease-out;
        }
        @keyframes bounceIn {
          0% { transform: scale(0.9); opacity: 0; }
          70% { transform: scale(1.05); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      {/* <div className="pos-header">
        <h1 style={{ color: 'var(--gold-primary)', margin: 0 }}>MERIDIEN POS</h1>
        <button onClick={handleClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-white)', cursor: 'pointer' }}>
          <X size={32} />
        </button>
      </div> */}

      <div className={`pos-content ${mobileShowCart && view === 'menu' ? 'show-mobile-cart' : ''}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
        
        {/* Top Floating Controls */}
        <div className="pos-top-controls">
          <div className="pos-top-actions">
            {view === 'menu' && (
              <button
                onClick={() => { if (selectedWaiter || role === 'waiter') setView('waiter_dashboard'); else setView('customer_info'); }}
                style={{
                  background: 'rgba(0,0,0,0.5)',
                  border: '1px solid var(--gold-primary)',
                  color: 'var(--gold-primary)',
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
              >
                <ArrowRight size={18} />
                {t.back}
              </button>
            )}
            {setLanguage && (
              <button 
                onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
                style={{
                  background: 'rgba(0,0,0,0.5)',
                  border: '1px solid var(--gold-primary)',
                  color: 'var(--gold-primary)',
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontFamily: 'inherit'
                }}
              >
                {language === 'ar' ? 'English' : 'عربي'}
              </button>
            )}

            {selectedWaiter && (
              <button
                onClick={() => setSummaryOpen(true)}
                style={{
                  background: 'rgba(0,0,0,0.5)',
                  border: '1px solid var(--gold-primary)',
                  color: 'var(--gold-primary)',
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
              >
                <BarChart3 size={18} />
                {language === 'ar' ? 'ملخص الحالات' : 'Status Summary'}
              </button>
            )}

            {deviceHall && (
              <button
                onClick={() => setView('device_hall_select')}
                style={{
                  background: 'rgba(0,0,0,0.5)',
                  border: '1px solid var(--gold-primary)',
                  color: 'var(--gold-primary)',
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontFamily: 'inherit'
                }}
              >
                {deviceHall}
              </button>
            )}

            {/* تبديل الوضع الفاتح/الداكن */}
            <button
              onClick={togglePosTheme}
              title={isLightTheme ? (language === 'ar' ? 'الوضع الداكن' : 'Dark Mode') : (language === 'ar' ? 'الوضع الفاتح' : 'Light Mode')}
              style={{
                background: 'rgba(0,0,0,0.5)',
                border: '1px solid var(--gold-primary)',
                color: 'var(--gold-primary)',
                padding: '0.5rem',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isLightTheme ? <Moon size={18} /> : <Sun size={18} />}
            </button>

            {/* Website Orders Notification Bell */}
            {selectedWaiter && (
              <div 
                style={{ position: 'relative', cursor: 'pointer', background: 'rgba(0,0,0,0.5)', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--gold-primary)' }} 
                onClick={() => setView('waiter_dashboard')}
                title={language === 'ar' ? 'طلبات الموقع' : 'Website Orders'}
              >
                <Bell size={24} color="var(--gold-primary)" />
                {activeOrders.filter(o => o.order_type === 'website' && !o.waiter_id && o.status === 'pending').length > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: -5,
                    right: -5,
                    width: '12px',
                    height: '12px',
                    background: '#ef4444',
                    borderRadius: '50%',
                    boxShadow: '0 0 5px #ef4444'
                  }} />
                )}
              </div>
            )}
          </div>
          <button className="pos-top-close" onClick={handleClose} style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', color: 'var(--text-white)', padding: '0.5rem', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px' }}>
            <X size={24} />
          </button>
        </div>

        <AnimatePresence mode="wait">
          
          {view === 'device_hall_select' && (
            <motion.div key="device_hall" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.04 }} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
              <h2 style={{ fontSize: '2.2rem', color: 'var(--gold-primary)', marginBottom: '0.75rem' }}>
                {language === 'ar' ? 'الجهاز ده على أي صالة؟' : 'Which hall is this device for?'}
              </h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', textAlign: 'center' }}>
                {language === 'ar' ? 'اختيار الصالة بيتحفظ على الجهاز، وصالة 1 على خزنة 1 وصالة 2 على خزنة 2.' : 'The hall is saved on this device. Hall 1 uses drawer 1 and Hall 2 uses drawer 2.'}
              </p>
              <div className="grid-options" style={{ maxWidth: '720px' }}>
                {(settings?.halls && settings.halls.length > 0 ? settings.halls.slice(0, 2) : [{ name: 'صالة 1', tax_percent: 0 }, { name: 'صالة 2', tax_percent: 0 }]).map((h, idx) => (
                  <motion.div
                    key={h.name}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    className="option-card"
                    onClick={() => {
                      localStorage.setItem('meridien_pos_device_hall', h.name);
                      setDeviceHall(h.name);
                      setSummaryScopeFilter(`hall:${h.name}`);
                      setSelectedHall('');
                      setTableNumber('');
                      setView('role_select');
                    }}
                    style={{ borderColor: HALL_COLORS[idx], background: `${HALL_COLORS[idx]}18` }}
                  >
                    <Utensils size={54} color={HALL_COLORS[idx]} />
                    <h3 style={{ fontSize: '1.7rem', margin: '1rem 0 0.35rem', color: HALL_COLORS[idx] }}>{h.name}</h3>
                    <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                      {language === 'ar' ? `مرتبطة بـ ${drawerName((idx === 1 ? 2 : 1) as 1 | 2, settings, true)}` : `Linked to ${drawerName((idx === 1 ? 2 : 1) as 1 | 2, settings, false)}`}
                    </p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
          
          {view === 'role_select' && (
            <motion.div key="role_sel" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
              
              {/* Animated Floating Elements for Royal Effect */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0, opacity: 0.25 }}>
                <motion.div animate={{ y: [-20, 20, -20], rotate: [0, 10, -10, 0] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }} style={{ position: 'absolute', top: '15%', left: '10%' }}>
                  <Pizza size={80} color="var(--gold-primary)" />
                </motion.div>
                <motion.div animate={{ y: [20, -20, 20], rotate: [0, -15, 15, 0] }} transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }} style={{ position: 'absolute', bottom: '20%', right: '15%' }}>
                  <Coffee size={100} color="var(--gold-primary)" />
                </motion.div>
                <motion.div animate={{ y: [-30, 30, -30], x: [-10, 10, -10] }} transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }} style={{ position: 'absolute', top: '30%', right: '10%' }}>
                  <ChefHat size={90} color="var(--gold-primary)" />
                </motion.div>
                <motion.div animate={{ y: [30, -30, 30], x: [10, -10, 10] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }} style={{ position: 'absolute', bottom: '15%', left: '20%' }}>
                  <Wine size={70} color="var(--gold-primary)" />
                </motion.div>
                <motion.div animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }} style={{ position: 'absolute', top: '50%', left: '5%' }}>
                  <Cake size={60} color="var(--gold-primary)" />
                </motion.div>
                <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }} style={{ position: 'absolute', top: '25%', right: '35%' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--gold-primary)', boxShadow: '0 0 20px var(--gold-primary)' }} />
                </motion.div>
                <motion.div animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.8, 0.3] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }} style={{ position: 'absolute', bottom: '35%', left: '35%' }}>
                  <div style={{ width: 15, height: 15, borderRadius: '50%', background: 'var(--gold-primary)', boxShadow: '0 0 20px var(--gold-primary)' }} />
                </motion.div>
              </div>

              {/* Main Content */}
              <div style={{ zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'radial-gradient(circle at center, rgba(212,175,55,0.15) 0%, transparent 70%)', padding: '4rem', borderRadius: '50%' }}>
                {settings?.logo_url ? (
                  <motion.div 
                    initial={{ y: -50, opacity: 0 }} 
                    animate={{ y: 0, opacity: 1 }} 
                    transition={{ type: 'spring', stiffness: 100 }}
                    style={{ 
                      width: '200px', height: '200px', borderRadius: '50%', 
                      background: 'rgba(255,255,255,0.05)', 
                      backdropFilter: 'blur(10px)',
                      border: '3px solid var(--gold-primary)', 
                      display: 'flex', alignItems: 'center', justifyContent: 'center', 
                      marginBottom: '2rem', overflow: 'hidden',
                      boxShadow: '0 10px 40px rgba(212,175,55,0.4)' 
                    }}
                  >
                    <img 
                      src={settings.logo_url === '/logo.png' ? '/logo.png?v=' + new Date().getTime() : settings.logo_url} 
                      alt="Restaurant Logo" 
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                    />
                  </motion.div>
                ) : (
                  <motion.div 
                    initial={{ y: -50, opacity: 0 }} 
                    animate={{ y: 0, opacity: 1 }} 
                    style={{ width: '180px', height: '180px', borderRadius: '50%', background: 'linear-gradient(45deg, #111, #222)', border: '3px solid var(--gold-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2rem', boxShadow: '0 10px 40px rgba(212,175,55,0.4)' }}
                  >
                    <ChefHat size={80} color="var(--gold-primary)" />
                  </motion.div>
                )}

                <h2 style={{ fontSize: '2.5rem', marginBottom: '4rem', textShadow: '0 2px 10px rgba(212,175,55,0.3)', textAlign: 'center', fontFamily: 'Cairo, sans-serif' }}>
                  {language === 'ar' ? 'أهلاً بك في نظام الطلبات' : 'Welcome to Order System'}
                </h2>
                
                <div className="grid-options" style={{ maxWidth: '800px', gap: '3rem' }}>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="option-card" onClick={() => { setRole('customer'); setView('customer_info'); }} style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(10px)', border: '1px solid rgba(212,175,55,0.2)', boxShadow: '0 15px 35px rgba(0,0,0,0.5)', padding: '3rem 2rem' }}>
                  <ShoppingBag size={56} color="var(--gold-primary)" />
                  <h3 style={{ fontSize: '1.8rem', margin: '1rem 0' }}>{t.iamCustomer}</h3>
                  <p style={{ color: 'var(--text-gray)', fontSize: '1rem' }}>
                    {language === 'ar' ? 'قم بإنشاء طلبك الخاص من المنيو' : 'Create your own order from the menu'}
                  </p>
                </motion.div>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="option-card" onClick={() => { setRole('waiter'); setView('waiter_auth'); }} style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(10px)', border: '1px solid rgba(212,175,55,0.2)', boxShadow: '0 15px 35px rgba(0,0,0,0.5)', padding: '3rem 2rem' }}>
                  <Utensils size={56} color="var(--gold-primary)" />
                  <h3 style={{ fontSize: '1.8rem', margin: '1rem 0' }}>{t.iamWaiter}</h3>
                  <p style={{ color: 'var(--text-gray)', fontSize: '1rem' }}>
                    {language === 'ar' ? 'تسجيل الدخول للكباتن والويترز' : 'Login for Captains & Waiters'}
                  </p>
                </motion.div>
              </div>
                <div style={{ marginTop: '3.5rem', display: 'flex', justifyContent: 'center' }}>
                  <motion.button 
                    whileHover={{ scale: 1.05 }} 
                    whileTap={{ scale: 0.95 }}
                    className="pos-btn" 
                    style={{ 
                      padding: '1rem 2rem', 
                      fontSize: '1.1rem', 
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.8rem',
                      boxShadow: '0 8px 24px rgba(212,175,55,0.2)'
                    }} 
                    onClick={() => {
                      playClickSound();
                      setAttendanceModalOpen(true);
                    }}
                  >
                    <Camera size={22} />
                    {language === 'ar' ? 'تسجيل الحضور والانصراف اليومي' : 'Register Daily Attendance/Departure'}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'waiter_auth' && (
            <motion.div key="w_auth" initial={{ opacity: 0, x: 100 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -100 }} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: '2rem', overflowY: 'auto', maxHeight: '100%', WebkitOverflowScrolling: 'touch' }}>
              <h2 style={{ fontSize: '2rem', marginBottom: '2rem', color: 'var(--gold-primary)' }}>{t.selectWaiter}</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.5rem', width: '100%', maxWidth: '800px', margin: '0 auto 3rem auto' }}>
                {waiters.map(w => (
                  <div 
                    key={w.id} 
                    onClick={() => setSelectedWaiter(w)}
                    style={{ 
                      background: selectedWaiter?.id === w.id ? 'linear-gradient(45deg, var(--gold-dark), var(--gold-primary))' : 'var(--bg-card)',
                      color: selectedWaiter?.id === w.id ? '#000' : 'var(--text-white)',
                      border: selectedWaiter?.id === w.id ? '2px solid transparent' : '2px solid var(--border-color)',
                      borderRadius: '16px', padding: '1.5rem', cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.8rem',
                      transition: 'all 0.3s',
                      transform: selectedWaiter?.id === w.id ? 'translateY(-5px)' : 'none',
                      boxShadow: selectedWaiter?.id === w.id ? '0 10px 25px rgba(212,175,55,0.4)' : 'none'
                    }}
                    className="waiter-card"
                  >
                    <div style={{ 
                      width: '60px', height: '60px', borderRadius: '50%', 
                      background: selectedWaiter?.id === w.id ? 'rgba(0,0,0,0.1)' : 'rgba(212,175,55,0.1)',
                      color: selectedWaiter?.id === w.id ? '#000' : 'var(--gold-primary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.5rem', fontWeight: 'bold'
                    }}>
                      {w.name.charAt(0).toUpperCase()}
                    </div>
                    <span style={{ fontSize: '1.2rem', fontWeight: 'bold', textAlign: 'center' }}>{w.name}</span>
                  </div>
                ))}
              </div>
              
              <AnimatePresence>
                {selectedWaiter && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', maxWidth: '400px' }}>
                    <div style={{ background: 'var(--border-color)', padding: '2rem', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                      <h3 style={{ textAlign: 'center', marginBottom: '1.5rem', color: 'var(--gold-primary)' }}>
                        {language === 'ar' ? `مرحباً كابتن ${selectedWaiter.name}` : `Welcome Capt. ${selectedWaiter.name}`}
                      </h3>
                      <input type="password" autoFocus placeholder={t.enterPasscode} className="pos-input" style={{ marginBottom: '1.5rem', background: 'var(--bg-darker)', fontSize: '1.5rem', letterSpacing: '0.5rem' }} value={waiterPasscode} onChange={e => setWaiterPasscode(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleWaiterLogin(); } }} />
                      <button className="pos-btn" style={{ width: '100%' }} onClick={handleWaiterLogin}>{t.login}</button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              
              <button className="pos-btn-outline" style={{ marginTop: '2rem', minWidth: '200px' }} onClick={() => {
                if (selectedWaiter) {
                  setSelectedWaiter(null);
                  setWaiterPasscode('');
                } else {
                  setView('role_select');
                }
              }}>
                {selectedWaiter ? t.back : (language === 'ar' ? 'رجوع للرئيسية' : 'Back to Home')}
              </button>
            </motion.div>
          )}

          {view === 'customer_info' && (
            <motion.div key="c_info" initial={{ opacity: 0, x: 100 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -100 }} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <h2>{t.phonePrompt}</h2>
              <input type="tel" className="pos-input" style={{ maxWidth: '400px', margin: '2rem 0' }} value={customerPhone} onChange={e => {
                const val = e.target.value;
                setCustomerPhone(val);
                if (val.length >= 10) {
                  // check if exist
                  const found = activeOrders.find(o => o.customer_phone === val);
                  if (found) setCustomerName(found.customer_name);
                }
              }} placeholder="01X XXXX XXXX" />
              
              {customerPhone.length >= 10 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <h3 style={{ marginTop: '1rem' }}>{t.namePrompt}</h3>
                  <input type="text" className="pos-input" style={{ maxWidth: '400px', marginBottom: '2rem' }} value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder={language === 'ar' ? 'الاسم الكريم' : 'Your Name'} />
                </motion.div>
              )}

              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                <button className="pos-btn-outline" onClick={() => {
                  if (role === 'waiter') setView('waiter_dashboard');
                  else setView('role_select');
                }}>{t.back}</button>
                <button className="pos-btn" disabled={!customerName} onClick={() => setView('order_type')}>{t.continue}</button>
                
                {role === 'waiter' && (
                  <button className="pos-btn-outline" style={{ borderColor: 'var(--text-gray)', color: 'var(--text-gray)' }} onClick={() => {
                    setCustomerPhone('0000000000');
                    setCustomerName(language === 'ar' ? 'عميل طيار' : 'Walk-in Customer');
                    setView('order_type');
                  }}>
                    {language === 'ar' ? 'تخطي' : 'Skip'}
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {view === 'order_type' && (
            <motion.div key="o_type" initial={{ opacity: 0, x: 100 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -100 }} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
              <h2 style={{ fontSize: '2rem', marginBottom: '3rem' }}>{t.howToReceive}</h2>
              <div className="grid-options">
                <div className={`option-card ${orderType === 'takeaway' ? 'active' : ''}`} onClick={() => { setOrderType('takeaway'); setSelectedHall(''); setTableNumber(''); }}>
                  <ShoppingBag size={48} /><h3>{t.takeaway}</h3>
                </div>
                <div className={`option-card ${orderType === 'dine_in' ? 'active' : ''}`} onClick={() => {
                  setOrderType('dine_in');
                  setTableNumber('');
                  if (deviceHall) {
                    setSelectedHall(deviceHall);
                    setTableStatusFilter('all');
                    setView('table_status');
                  }
                }}>
                  <Utensils size={48} /><h3>{t.dineIn}</h3>
                </div>
                <div className={`option-card ${orderType === 'delivery' ? 'active' : ''}`} onClick={() => { setOrderType('delivery'); setSelectedHall(''); setTableNumber(''); }}>
                  <ArrowRight size={48} /><h3>{t.delivery}</h3>
                </div>
                <div className={`option-card ${orderType === 'talabat' ? 'active' : ''}`} onClick={() => { setOrderType('talabat'); setSelectedHall(''); setTableNumber(''); }}>
                  <ShoppingBag size={48} color="#FF5A00" /><h3>{t.talabat}</h3>
                </div>
                {/* طلب استاف — مجاني، بيتسجل باسم الموظف وبيخصم من المخزون */}
                <div
                  className={`option-card ${staffOrderFor ? 'active' : ''}`}
                  style={{ gridColumn: '1 / -1', borderColor: staffOrderFor ? '#38bdf8' : undefined }}
                  onClick={() => {
                    playClickSound();
                    if (staffOrderFor) { setStaffOrderFor(null); return; }
                    setStaffEmployeeId('');
                    setStaffPasscode('');
                    setStaffModalMode('new');
                    setStaffModalOpen(true);
                  }}
                >
                  <ChefHat size={48} color="#38bdf8" />
                  <h3 style={{ color: staffOrderFor ? '#38bdf8' : undefined }}>
                    {staffOrderFor
                      ? `${language === 'ar' ? 'طلب استاف' : 'Staff order'} — ${staffOrderFor.name}`
                      : (language === 'ar' ? 'طلب استاف (مجاني)' : 'Staff Order (Free)')}
                  </h3>
                  <p style={{ color: 'var(--text-gray)', fontSize: '0.85rem', margin: 0 }}>
                    {staffOrderFor
                      ? (language === 'ar' ? 'اضغط للإلغاء' : 'Tap to cancel')
                      : (language === 'ar' ? 'بكلمة سر — بيتخصم من المخزون ومش بيتحسب مبيعات' : 'Password protected — deducts stock, not counted as sales')}
                  </p>
                </div>
              </div>

              {orderType === 'dine_in' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginTop: '2rem', textAlign: 'center', width: '100%', maxWidth: '540px' }}>
                  {(settings?.halls && settings.halls.length > 0 && !deviceHall) && (
                    <div style={{ marginBottom: '1.5rem' }}>
                      <h3 style={{ marginBottom: '1rem' }}>{language === 'ar' ? 'اختر الصالة' : 'Select Hall'}</h3>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center' }}>
                        {settings.halls.map((h, i) => (
                          <button key={i} type="button" onClick={() => {
                            setSelectedHall(h.name);
                            setTableNumber('');
                            setTableStatusFilter('all');
                            setView('table_status');
                          }}
                            style={{
                              padding: '0.8rem 1.4rem', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontFamily: 'inherit', fontSize: '1rem',
                              border: selectedHall === h.name ? '2px solid var(--gold-primary)' : '2px solid var(--border-color)',
                              background: selectedHall === h.name ? 'linear-gradient(45deg, var(--gold-dark), var(--gold-primary))' : 'var(--bg-card)',
                              color: selectedHall === h.name ? '#000' : 'var(--text-white)'
                            }}>
                            {h.name}{h.tax_percent ? <span style={{ display: 'block', fontSize: '0.72rem', opacity: 0.85 }}>{language === 'ar' ? 'ضريبة' : 'Tax'} {h.tax_percent}%</span> : null}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              <div style={{ display: 'flex', gap: '1rem', marginTop: '3rem' }}>
                <button className="pos-btn-outline" onClick={() => setView('customer_info')}>{t.back}</button>
                <button className="pos-btn" disabled={!orderType || orderType === 'dine_in'} onClick={() => setView('menu')}>{t.continue}</button>
              </div>
            </motion.div>
          )}

          {view === 'table_status' && orderType === 'dine_in' && selectedHall && (
            <motion.div key="table_status" initial={{ opacity: 0, x: 100 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -100 }} style={{ width: '100%', padding: '2rem', overflowY: 'auto' }}>
              <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                  <div>
                    <h2 style={{ margin: 0, color: 'var(--gold-primary)' }}>{language === 'ar' ? `طاولات ${selectedHall}` : `${selectedHall} Tables`}</h2>
                    <p style={{ margin: '0.4rem 0 0', color: 'var(--text-muted)' }}>{language === 'ar' ? 'اختار طاولة فاضية لفتح الأوردر' : 'Select an empty table to start the order'}</p>
                  </div>
                  <button className="pos-btn-outline" onClick={() => { setTableNumber(''); setView('order_type'); }}>{t.back}</button>
                </div>

                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                  {(['all', 'empty', 'occupied', 'delivered', 'check'] as const).map(status => {
                    const color = status === 'all' ? 'var(--gold-primary)' : tableStatusColors[status];
                    const active = tableStatusFilter === status;
                    return (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setTableStatusFilter(status)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                          padding: '0.55rem 1rem', borderRadius: '999px', cursor: 'pointer',
                          border: `2px solid ${color}`, background: active ? color : 'transparent',
                          color: active ? '#000' : color, fontWeight: 'bold', fontFamily: 'inherit',
                        }}
                      >
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: active ? '#000' : color }} />
                        {tableStatusLabels[status]}
                        <span style={{ background: active ? '#00000022' : `${color}33`, borderRadius: '999px', padding: '0 0.45rem', fontSize: '0.8rem' }}>{tableStatusCount(status)}</span>
                      </button>
                    );
                  })}
                </div>

                {partnerTableEntries.length > 0 && (
                  <div style={{ marginBottom: '0.9rem', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid rgba(251,191,36,0.35)', background: 'linear-gradient(135deg, rgba(251,191,36,0.12), rgba(0,0,0,0.12))', color: '#fbbf24' }}>
                    <div style={{ fontWeight: 900 }}>{language === 'ar' ? 'طاولات الملاك والشركاء' : 'Owner & Partner Tables'}</div>
                    <div style={{ marginTop: '0.25rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{partnerTableEntries.map(entry => `${entry.name} — ${entry.partner.name}`).join(' • ')}</div>
                  </div>
                )}
                {partnerTableEntries.length === 0 && (
                  <div style={{ marginBottom: '0.9rem', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid rgba(245,158,11,0.35)', background: 'rgba(245,158,11,0.08)', color: '#fbbf24', fontSize: '0.82rem' }}>
                    {language === 'ar' ? 'لا توجد طاولات ملاك ظاهرة. أضف أسماء الطاولات من موديول العهد والشركاء ثم تأكد من تشغيل ترحيل قاعدة البيانات.' : 'No owner tables are visible. Assign table names in Partners & Custody and run the database migration.'}
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '0.9rem' }}>
                  {[...Array.from({ length: 40 }, (_, i) => String(i + 1)), ...partnerTableNames].map(tableNo => {
                    const status = getTableStatus(selectedHall, tableNo);
                    const order = getTableOrder(selectedHall, tableNo);
                    if (tableStatusFilter !== 'all' && tableStatusFilter !== status) return null;
                    const isEmpty = status === 'empty';
                    const color = tableStatusColors[status];
                    return (
                      <button
                        key={tableNo}
                        type="button"
                        disabled={!isEmpty}
                        onClick={() => {
                          if (!isEmpty) return;
                          setTableNumber(String(tableNo));
                          setView('menu');
                        }}
                        title={!isEmpty && order ? `#${order.id.slice(-6)} - ${order.customer_name}` : ''}
                        style={{
                          minHeight: '96px', borderRadius: '12px', border: `2px solid ${partnerForTable(String(tableNo)) ? '#fbbf24' : color}`,
                          background: partnerForTable(String(tableNo))
                            ? (isEmpty ? 'linear-gradient(135deg, rgba(251,191,36,0.2), rgba(0,0,0,0.25))' : 'linear-gradient(135deg, rgba(251,191,36,0.35), rgba(0,0,0,0.28))')
                            : (isEmpty ? `${color}22` : `linear-gradient(135deg, ${color}44, rgba(0,0,0,0.28))`),
                          color: 'var(--text-white)', cursor: isEmpty ? 'pointer' : 'not-allowed',
                          opacity: isEmpty ? 1 : 0.78, fontFamily: 'inherit', textAlign: 'center',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.35rem',
                        }}
                      >
                          <span style={{ fontSize: '1.15rem', fontWeight: 900, color: partnerForTable(String(tableNo)) ? '#fbbf24' : color }}>{tableNo}</span>
                          {partnerForTable(String(tableNo)) ? <span style={{ fontSize: '0.7rem', color: '#fbbf24', fontWeight: 800 }}>{language === 'ar' ? `مالك: ${partnerForTable(String(tableNo))?.name}` : `Owner: ${partnerForTable(String(tableNo))?.name}`}</span> : null}
                        <span style={{ fontSize: '0.85rem', fontWeight: 800 }}>{tableStatusLabels[status]}</span>
                        {order ? <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>#{order.id.slice(-4)}</span> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {view === 'menu' && (
            <motion.div key="menu" className="pos-menu-layout" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ width: '100%', display: 'flex', paddingTop: '3.75rem' }}>
              <div className="pos-menu-sidebar">
                <div style={{ display: 'flex', padding: '10px', gap: '5px', borderBottom: '1px solid var(--border-color)' }}>
                  <button 
                    onClick={() => setPosDepartment('restaurant')} 
                    style={{ flex: 1, padding: '8px', background: posDepartment === 'restaurant' ? 'var(--gold-primary)' : 'var(--border-color)', color: posDepartment === 'restaurant' ? '#000' : 'var(--text-white)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                    {language === 'ar' ? 'المطعم' : 'Restaurant'}
                  </button>
                  <button 
                    onClick={() => setPosDepartment('bar')} 
                    style={{ flex: 1, padding: '8px', background: posDepartment === 'bar' ? '#3b82f6' : 'var(--border-color)', color: posDepartment === 'bar' ? 'var(--text-white)' : 'var(--text-white)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                    {language === 'ar' ? 'البار' : 'Bar'}
                  </button>
                </div>
                {categories.filter(c => (c.department || 'restaurant') === posDepartment).map(cat => (
                  <div key={cat.id} className={`pos-cat-item ${activeCategory === cat.id ? 'active' : ''}`} onClick={() => setActiveCategory(cat.id)}>
                    {language === 'ar' ? cat.name_ar : cat.name_en}
                  </div>
                ))}
              </div>
              <div className="pos-products" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '0 1rem 1rem 1rem' }}>
                  <input
                    type="text"
                    className="pos-input"
                    style={{ width: '100%', maxWidth: '400px', fontSize: '1rem', padding: '0.8rem 1rem' }}
                    placeholder={language === 'ar' ? 'بحث عن منتج...' : 'Search for a product...'}
                    value={productSearchQuery}
                    onChange={(e) => setProductSearchQuery(e.target.value)}
                  />
                </div>
                <div className="pos-product-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', padding: '0 1rem' }}>
                {getVisibleProducts().map(p => {
                  const stockStatus = getStockStatus(p);
                  return (
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} key={p.id} className="pos-product-card" style={{ position: 'relative' }} onClick={() => addToCart(p)}>
                    {stockStatus !== 'ok' && (
                      <div style={{
                        position: 'absolute', top: 8, insetInlineStart: 8, zIndex: 3,
                        padding: '3px 10px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700,
                        color: 'var(--text-white)', boxShadow: '0 2px 6px rgba(0,0,0,.45)',
                        background: stockStatus === 'out' ? '#c0392b' : '#e08e0b'
                      }}>
                        {stockStatus === 'out'
                          ? (language === 'ar' ? 'نفذ' : 'Out')
                          : (language === 'ar' ? 'قرب يخلص' : 'Low')}
                      </div>
                    )}
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name_en} className="pos-product-img" />
                    ) : (
                      <div className="pos-product-img" style={{ background: 'var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Utensils size={40} color="#666" /></div>
                    )}
                    <div style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>{language === 'ar' ? p.name_ar : p.name_en}</h4>
                      <div style={{ color: 'var(--gold-primary)', fontWeight: 'bold', fontSize: '1.2rem' }}>
                        {getProductPrice(p).toFixed(2)} EGP
                      </div>
                    </div>
                  </motion.div>
                  );
                })}
                </div>
              </div>
              <div className="pos-cart-panel">
                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2 style={{ margin: 0, color: 'var(--gold-primary)' }}>{t.cart}</h2>
                    <p style={{ margin: '0.5rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      {orderType?.toUpperCase()} {tableNumber && `- Table ${tableNumber}`}
                    </p>
                  </div>
                  <button 
                    className="mobile-only-btn pos-btn-outline" 
                    style={{ display: 'none', padding: '0.5rem 1rem', fontSize: '0.9rem', borderRadius: '8px' }} 
                    onClick={() => setMobileShowCart(false)}
                  >
                    {language === 'ar' ? 'المنيو' : 'Menu'}
                  </button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
                  {cart.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '2rem' }}>Empty</p>}
                  <AnimatePresence>
                    {cart.map((item, idx) => {
                      const originalItem = originalOrderItems.find(o => o.id === item.id && (o.note || '') === (item.note || ''));
                      const isOriginal = originalItem !== undefined;
                      const minQuantity = originalItem ? originalItem.quantity : 1;
                      const cannotDecrease = isOriginal && item.quantity <= minQuantity;

                      return (
                        <motion.div key={`${item.id}-${idx}`} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.8 }}
                          style={{ background: 'var(--bg-card)', padding: '1rem', borderRadius: '12px', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: 'bold' }}>{language === 'ar' ? item.name_ar : item.name_en}</span>
                            <span style={{ color: 'var(--gold-primary)' }}>{(item.price * item.quantity).toFixed(2)}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#000', padding: '4px', borderRadius: '8px' }}>
                              <button 
                                disabled={cannotDecrease}
                                onClick={(e) => { e.stopPropagation(); updateQuantity(idx, -1); }} 
                                style={{ 
                                  background: cannotDecrease ? 'var(--border-color)' : 'var(--border-color)', 
                                  border: 'none', 
                                  color: cannotDecrease ? '#555' : 'var(--text-white)', 
                                  width: '32px', height: '32px', borderRadius: '6px', 
                                  cursor: cannotDecrease ? 'not-allowed' : 'pointer' 
                                }}
                              >
                                <Minus size={16} />
                              </button>
                              <span style={{ fontWeight: 'bold', minWidth: '20px', textAlign: 'center' }}>{item.quantity}</span>
                              <button onClick={(e) => { e.stopPropagation(); updateQuantity(idx, 1); }} style={{ background: 'var(--gold-primary)', border: 'none', color: '#000', width: '32px', height: '32px', borderRadius: '6px', cursor: 'pointer' }}><Plus size={16} /></button>
                            </div>
                            
                            {!isOriginal ? (
                              <button onClick={(e) => { e.stopPropagation(); removeFromCart(idx); }} style={{ background: 'rgba(239, 68, 68, 0.1)', border: 'none', color: '#ef4444', padding: '6px', borderRadius: '6px', cursor: 'pointer' }}>
                                <Trash2 size={18} />
                              </button>
                            ) : (
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>{language === 'ar' ? 'مؤكد' : 'Confirmed'}</span>
                            )}
                          </div>
                          <textarea
                            className="pos-input"
                            value={item.note || ''}
                            onChange={(e) => updateItemNote(idx, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            placeholder={language === 'ar' ? 'ملاحظة على الصنف (اختياري)' : 'Item note (optional)'}
                            rows={2}
                            disabled={isOriginal}
                            style={{ width: '100%', resize: 'vertical', minHeight: '44px', fontSize: '0.9rem', opacity: isOriginal ? 0.75 : 1 }}
                          />
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
                <div style={{ padding: '1.5rem', background: 'var(--bg-card)', borderTop: '1px solid var(--border-color)' }}>
                  {hallTaxPercent > 0 && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                        <span>{language === 'ar' ? 'المجموع الفرعي' : 'Subtotal'}</span>
                        <span>{cartSubtotal.toFixed(2)} EGP</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
                        <span>{language === 'ar' ? `ضريبة ${selectedHall} (${hallTaxPercent}%)` : `Tax ${selectedHall} (${hallTaxPercent}%)`}</span>
                        <span>{cartTaxAmount.toFixed(2)} EGP</span>
                      </div>
                    </>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>
                    <span>{t.total}</span>
                    <span style={{ color: 'var(--gold-primary)' }}>{cartTotal.toFixed(2)} EGP</span>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="pos-btn-outline" style={{ flex: 1, padding: '1rem' }} onClick={() => {
                      if (window.innerWidth <= 768) {
                        setMobileShowCart(false);
                      } else {
                        setView('order_type');
                      }
                    }}>{t.back}</button>
                    <button className="pos-btn" style={{ flex: 2 }} disabled={cart.length === 0} onClick={() => setView('checkout')}>{t.checkout}</button>
                  </div>
                </div>
              </div>
              {cart.length > 0 && !mobileShowCart && (
                <div className="mobile-cart-bar" onClick={() => setMobileShowCart(true)}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    🛒 {language === 'ar' ? 'عرض السلة' : 'View Cart'} 
                    <span style={{ background: '#000', color: 'var(--gold-primary)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.9rem' }}>
                      {cart.reduce((sum, item) => sum + item.quantity, 0)}
                    </span>
                  </span>
                  <span>{cartTotal.toFixed(2)} EGP</span>
                </div>
              )}
            </motion.div>
          )}

          {view === 'checkout' && (
            <motion.div key="checkout" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <h2 style={{ fontSize: '3rem', color: 'var(--gold-primary)' }}>{cartTotal.toFixed(2)} EGP</h2>
              <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                {orderType?.toUpperCase()} {tableNumber && `- Table ${tableNumber}`}
              </p>
              
              <div style={{ background: 'var(--bg-darker)', padding: '1.5rem', borderRadius: '12px', width: '100%', maxWidth: '400px', marginBottom: '2rem', border: '1px solid var(--border-color)' }}>
                <h4 style={{ margin: '0 0 1rem 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', color: 'var(--gold-primary)' }}>
                  {language === 'ar' ? 'ملخص الطلب' : 'Order Summary'}
                </h4>
                <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                  {cart.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', fontSize: '0.95rem', margin: '0.3rem 0' }}>
                      <span>
                        {item.quantity}x {language === 'ar' ? item.name_ar : item.name_en}
                        {item.note ? <small style={{ display: 'block', color: 'var(--gold-primary)', marginTop: '0.15rem' }}>{item.note}</small> : null}
                      </span>
                      <span>{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <button className="pos-btn" style={{ width: '300px', marginBottom: '1rem', padding: '1.5rem' }} onClick={placeOrder}>
                {language === 'ar' ? 'تأكيد وإرسال الطلب 🚀' : 'Confirm & Send Order 🚀'}
              </button>
              <button className="pos-btn-outline" style={{ width: '300px' }} onClick={() => setView('menu')}>{t.back}</button>
            </motion.div>
          )}

          {view === 'success' && (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
                <CheckCircle size={120} color="var(--gold-primary)" style={{ marginBottom: '2rem' }} />
              </motion.div>
              <h2 style={{ fontSize: '3rem' }}>{t.successMsg}</h2>
              <div style={{ display: 'flex', gap: '1.5rem', marginTop: '3rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                {lastPlacedOrder && (
                  <>
                    <button className="pos-btn" style={{ background: 'var(--gold-primary)', color: '#000' }} onClick={() => printCustomerReceipt(lastPlacedOrder, language, settings)}>
                      <PrinterIcon size={20} style={{ marginRight: '8px' }} />
                      {language === 'ar' ? 'طباعة الفاتورة للعميل' : 'Print Customer Receipt'}
                    </button>
                    <button className="pos-btn" style={{ background: '#3b82f6', color: 'var(--text-white)' }} onClick={() => printOrderTickets(lastPlacedOrder, categories, products, printers, language, settings)}>
                      <PrinterIcon size={20} style={{ marginRight: '8px' }} />
                      {language === 'ar' ? 'طباعة بونات الأقسام' : 'Print Section Tickets'}
                    </button>
                    <button className="pos-btn" style={{ background: '#25D366', color: 'var(--text-white)' }} onClick={() => {
                      const msg = language === 'ar' 
                        ? `مرحباً بك في ${settings?.restaurant_name_ar || 'مطعمنا'}!\nتفاصيل طلبك #${lastPlacedOrder.id.slice(0,6)}\nالإجمالي: ${lastPlacedOrder.total_price} ج.م\nتاريخ: ${new Date().toLocaleDateString()}\nاللوكيشن: ${settings?.location_url || ''}`
                        : `Welcome to ${settings?.restaurant_name_en || 'our restaurant'}!\nOrder #${lastPlacedOrder.id.slice(0,6)}\nTotal: ${lastPlacedOrder.total_price} EGP\nDate: ${new Date().toLocaleDateString()}\nLocation: ${settings?.location_url || ''}`;
                      window.open(`https://wa.me/${lastPlacedOrder.customer_phone || settings?.whatsapp_number}?text=${encodeURIComponent(msg)}`, '_blank');
                    }}>
                      <MessageCircle size={20} style={{ marginRight: '8px' }} />
                      {language === 'ar' ? 'واتساب' : 'WhatsApp'}
                    </button>
                  </>
                )}
                {role === 'waiter' && (
                  <button className="pos-btn-outline" onClick={() => {
                    setCart([]); setCustomerName(''); setCustomerPhone(''); setTableNumber(''); setSelectedHall(''); setOrderType(null); setView('waiter_dashboard');
                  }}>{language === 'ar' ? 'لوحة القيادة' : 'Dashboard'}</button>
                )}
                <button className="pos-btn" onClick={() => {
                  setCart([]); setCustomerName(''); setCustomerPhone(''); setTableNumber(''); setSelectedHall(''); setOrderType(null); setView('customer_info');
                }}>{t.newOrder}</button>
                
                <button className="pos-btn-outline" style={{ borderColor: '#ef4444', color: '#ef4444' }} onClick={() => {
                  setCart([]); setCustomerName(''); setCustomerPhone(''); setTableNumber(''); setSelectedHall(''); setOrderType(null); setRole('waiter'); setSelectedWaiter(null); setView('waiter_auth');
                }}>
                  {language === 'ar' ? 'خروج' : 'Exit'}
                </button>
              </div>
            </motion.div>
          )}

          {view === 'waiter_dashboard' && (
            <motion.div key="w_dash" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ width: '100%', padding: '2rem', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <h2>{language === 'ar' ? `الطلبات النشطة` : `Active Orders`}</h2>
                  <div style={{ display: 'flex', background: 'var(--bg-darker)', borderRadius: '8px', padding: '4px' }}>
                    <button onClick={() => setViewAllOrders(false)} style={{ padding: '0.5rem 1rem', background: !viewAllOrders ? 'var(--gold-primary)' : 'transparent', color: !viewAllOrders ? '#000' : 'var(--text-white)', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                      {language === 'ar' ? 'طلباتي' : 'My Orders'}
                    </button>
                    <button onClick={() => setViewAllOrders(true)} style={{ padding: '0.5rem 1rem', background: viewAllOrders ? 'var(--gold-primary)' : 'transparent', color: viewAllOrders ? '#000' : 'var(--text-white)', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                      {language === 'ar' ? 'الكل' : 'All'}
                    </button>
                  </div>
                </div>
                <div className="pos-dashboard-actions" style={{ display: 'flex', alignItems: 'stretch', gap: '0.65rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button className="pos-btn" style={{ minWidth: '120px' }} onClick={() => { setCustomerPhone(''); setCustomerName(''); setTableNumber(''); setSelectedHall(''); setOrderType(null); setCart([]); setView('customer_info'); }}>
                    <Plus size={16} style={{ verticalAlign: 'middle', marginInlineEnd: '0.3rem' }} />{t.newOrder}
                  </button>
                  <button className="pos-btn-outline" style={{ minWidth: '120px', borderColor: '#22c55e', color: '#4ade80' }} onClick={() => setDepositModalOpen(true)}>
                    <Wallet size={16} style={{ verticalAlign: 'middle', marginInlineEnd: '0.3rem' }} />{language === 'ar' ? 'إيداع عميل' : 'Customer Deposit'}
                  </button>
                  <button className="pos-btn-outline" style={{ minWidth: '120px', borderColor: '#ef4444', color: '#f87171' }} onClick={() => setExpenseModalOpen(true)}>
                    <Receipt size={16} style={{ verticalAlign: 'middle', marginInlineEnd: '0.3rem' }} />{language === 'ar' ? 'سحب مصروف' : 'Expense Withdrawal'}
                  </button>
                  <button className="pos-btn-outline" onClick={async () => {
                    if (selectedWaiter) {
                      try { await db.updateWaiterActiveStatus(selectedWaiter.id, false); } catch (e) {}
                    }
                    localStorage.removeItem('meridien_active_pos_waiter');
                    setSelectedWaiter(null); setWaiterPasscode(''); setRole('waiter'); setView('waiter_auth');
                  }}>
                    {language === 'ar' ? 'تسجيل خروج' : 'Logout'}
                  </button>
                </div>
              </div>
              {/* فلاتر: بالصالة + نوع الطلب — بألوان مختلفة */}
              {(() => {
                const chips: { key: string; label: string; c: string }[] = [
                  { key: 'all', label: language === 'ar' ? 'الكل' : 'All', c: 'var(--gold-primary)' },
                  { key: 'type:dine_in', label: language === 'ar' ? 'صالة' : 'Dine-in', c: TYPE_COLORS.dine_in },
                  ...(settings?.halls || []).map(h => ({ key: `hall:${h.name}`, label: (language === 'ar' ? 'صالة ' : 'Hall ') + h.name, c: hallColor(h.name) })),
                  { key: 'type:takeaway', label: language === 'ar' ? 'تيك أواي' : 'Takeaway', c: TYPE_COLORS.takeaway },
                  { key: 'type:delivery', label: language === 'ar' ? 'دليفري' : 'Delivery', c: TYPE_COLORS.delivery },
                  { key: 'type:talabat', label: language === 'ar' ? 'طلبات' : 'Talabat', c: TYPE_COLORS.talabat },
                  { key: 'type:website', label: language === 'ar' ? 'موقع' : 'Website', c: TYPE_COLORS.website },
                ].filter(ch => ch.key === 'all' || ch.key === 'type:dine_in' || chipCount(ch.key) > 0 || dashFilter === ch.key);
                return (
                  <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                    {chips.map(ch => {
                      const active = dashFilter === ch.key;
                      const count = chipCount(ch.key);
                      return (
                        <button key={ch.key} onClick={() => setDashFilter(ch.key)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                            padding: '0.45rem 1rem', borderRadius: '999px', cursor: 'pointer',
                            fontWeight: 'bold', fontSize: '0.9rem',
                            background: active ? ch.c : 'transparent',
                            color: active ? '#000' : ch.c,
                            border: `2px solid ${ch.c}`,
                            opacity: count === 0 && !active ? 0.45 : 1,
                          }}>
                          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: active ? '#000' : ch.c, display: 'inline-block' }} />
                          {ch.label}
                          <span style={{ background: active ? '#00000022' : `${ch.c}33`, borderRadius: '999px', padding: '0 0.5rem', fontSize: '0.8rem', minWidth: '1.4rem', textAlign: 'center' }}>{count}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))', gap: '1.5rem', overflowY: 'auto', flex: 1, alignContent: 'start' }}>
                {dashShownOrders.map(order => (
                  <div key={order.id} style={{ background: 'var(--bg-card)', border: `1px solid #333`, borderTop: `5px solid ${orderAccent(order)}`, borderRadius: '16px', padding: '1.5rem', position: 'relative' }}>
                    {viewAllOrders && order.waiter_id !== selectedWaiter?.id && (
                      <div style={{ position: 'absolute', top: '-10px', right: '10px', background: 'var(--border-color)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>
                        {order.waiter_name || 'Guest'}
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1rem', alignItems: 'center' }}>
                      <span style={{ color: 'var(--gold-primary)', fontWeight: 'bold' }}>#{order.id.slice(0, 6)}</span>
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ background: orderAccent(order), color: '#000', padding: '2px 10px', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                          {order.hall ? order.hall : orderTypeLabel(order)}
                        </span>
                        <span style={{ 
                          background: order.status === 'delivered' ? 'rgba(46,204,113,0.15)' : order.status === 'prepared' ? 'rgba(155,89,182,0.15)' : 'rgba(243,156,18,0.15)', 
                          color: order.status === 'delivered' ? '#2ecc71' : order.status === 'prepared' ? '#9b59b6' : '#f39c12', 
                          padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' 
                        }}>
                          {order.status === 'delivered' ? (language === 'ar' ? 'تم التسليم' : 'Delivered') : 
                           order.status === 'prepared' ? (language === 'ar' ? 'تم التحضير' : 'Prepared') : 
                           order.status === 'preparing' ? (language === 'ar' ? 'جاري التحضير' : 'Preparing') : 
                           (language === 'ar' ? 'معلق' : 'Pending')}
                        </span>
                      </div>
                    </div>
                    <div style={{ marginBottom: '1rem' }}>
                      {order.payment_method === 'staff' ? (
                        <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#38bdf8' }}>
                          👨‍🍳 {order.payment_details?.employee_name || (language === 'ar' ? 'استاف' : 'Staff')}
                        </div>
                      ) : (
                        <div style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>{partnerForOrder(order)?.name || order.customer_name}</div>
                      )}
                      {order.table_number && order.table_number !== '-' && <div style={{ color: 'var(--text-muted)' }}>Table: {order.table_number}</div>}
                    </div>
                    {order.payment_method === 'staff' ? (
                      <div style={{ marginBottom: '1.5rem' }}>
                        <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#38bdf8' }}>{language === 'ar' ? 'مجاني' : 'Free'}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginInlineStart: '0.5rem' }}>
                          ({Number(order.payment_details?.original_price || 0).toFixed(2)} EGP)
                        </span>
                      </div>
                    ) : (
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>{order.total_price.toFixed(2)} EGP</div>
                    )}
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {order.order_type === 'website' && !order.waiter_id ? (
                        <button className="pos-btn" style={{ padding: '0.5rem', fontSize: '0.9rem', flex: 1, background: '#10b981', color: 'var(--text-white)' }} onClick={() => handleAcceptWebsiteOrder(order)}>
                          {language === 'ar' ? 'قبول الطلب' : 'Accept Order'}
                        </button>
                      ) : (
                        <>
                          <button className="pos-btn" style={{ padding: '0.5rem', fontSize: '0.9rem', flex: 1, background: '#3b82f6', color: 'var(--text-white)' }} onClick={() => {
                            setEditingOrder(order);
                            setEditOrderId(order.id);
                            setOriginalOrderItems(order.items);
                            setView('waiter_order_edit');
                          }}>{language === 'ar' ? 'تعديل' : 'Edit'}</button>
                          
                          {order.status === 'delivered' && order.payment_method === 'partner' ? (
                            /* طلب شريك: لا تحصيل نقدي — يسجل كمديونية في كشف الشريك */
                            <button className="pos-btn" style={{ padding: '0.5rem', fontSize: '0.9rem', flex: 1, background: '#f59e0b', color: '#000' }} onClick={async () => {
                              playClickSound();
                              try {
                                const partnerOrder = await db.updateOrder(order.id, {
                                  status: 'completed',
                                  payment_method: 'partner',
                                  total_price: Number(order.partner_amount_due ?? order.total_price) || 0,
                                  drawer: undefined,
                                  payment_details: { ...(order.payment_details || {}), type: 'partner', cash_collected: 0 }
                                }, selectedWaiter?.name);
                                const completedPartnerOrder = partnerOrder || order;
                                printCustomerReceipt({ ...completedPartnerOrder, customer_name: partnerForOrder(completedPartnerOrder)?.name || completedPartnerOrder.customer_name }, language, settings);
                                loadData();
                              } catch (err) {
                                console.error(err);
                                alert(language === 'ar' ? 'فشل إنهاء طلب الشريك' : 'Failed to close partner order');
                              }
                            }}>
                              {language === 'ar' ? 'إنهاء طلب الشريك (بدون تحصيل)' : 'Close Partner Order (No Cash)'}
                            </button>
                          ) : order.status === 'delivered' && order.payment_method === 'staff' ? (
                            /* طلب استاف: مفيش تحصيل — إنهاء مباشر (بيخصم المخزون) */
                            <button className="pos-btn" style={{ padding: '0.5rem', fontSize: '0.9rem', flex: 1, background: '#38bdf8', color: '#000' }} onClick={async () => {
                              playClickSound();
                              try {
                                await db.updateOrderStatus(order.id, 'completed', selectedWaiter?.name);
                                printCustomerReceipt({ ...order, customer_name: partnerForOrder(order)?.name || order.customer_name }, language, settings);
                                loadData();
                              } catch (err) {
                                console.error(err);
                                alert(language === 'ar' ? 'فشل إنهاء الطلب' : 'Failed to close the order');
                              }
                            }}>
                              {language === 'ar' ? 'إنهاء طلب الاستاف' : 'Close staff order'}
                            </button>
                          ) : order.status === 'delivered' ? (
                            <>
                            {/* فاتورة مبدئية يشوفها العميل قبل ما نحصّل منه */}
                            <button className="pos-btn" style={{ padding: '0.5rem', fontSize: '0.9rem', flex: 1, background: '#a855f7', color: 'var(--text-white)' }} onClick={() => {
                              playClickSound();
                              markCheckPrinted(order.id);
                              printCustomerReceipt({ ...order, customer_name: partnerForOrder(order)?.name || order.customer_name }, language, settings, { preBill: true });
                            }}>{language === 'ar' ? 'طباعة الفاتورة' : 'Print Bill'}</button>
                            <button className="pos-btn" style={{ padding: '0.5rem', fontSize: '0.9rem', flex: 1, background: '#2ecc71', color: '#000' }} onClick={() => {
                              setCollectPaymentOrder(order);
                              setPayCash('');
                              setPayVisa('');
                              setPayWalletCashier('');

                              setPayInstapay('');
                              setPayIsDeferred(false);
                              setPayCustomerId(order.customer_id || '');
                              // الصالة بتحدد خزنتها لوحدها — غير كده بنبدأ بخزنة 1 والكاشير يغيّر
                              setPayDrawer(order.hall ? drawerForHall(order.hall) : (order.drawer || 1));
                            }}>{language === 'ar' ? 'تحصيل الدفع' : 'Collect Payment'}</button>
                            </>
                          ) : order.status === 'prepared' ? (
                            <button className="pos-btn" style={{ padding: '0.5rem', fontSize: '0.9rem', flex: 1, background: '#f39c12', color: '#000' }} onClick={() => {
                              // تحديث فوري — من غير انتظار النت
                              setActiveOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'delivered' } : o));
                              db.updateOrderStatus(order.id, 'delivered', selectedWaiter?.name).catch(err => console.error('فشل تحديث الحالة', err));
                            }}>{language === 'ar' ? 'تم التسليم' : 'Mark Delivered'}</button>
                          ) : (
                            <button className="pos-btn" disabled style={{ padding: '0.5rem', fontSize: '0.9rem', flex: 1, background: '#4b5563', color: 'var(--text-muted)', cursor: 'not-allowed' }} title={language === 'ar' ? 'بانتظار تجهيز المطبخ' : 'Waiting for kitchen'}>
                              {order.status === 'preparing' ? (language === 'ar' ? 'جاري التحضير بالمطبخ' : 'Preparing in kitchen') : (language === 'ar' ? 'بانتظار المطبخ' : 'Waiting for kitchen')}
                            </button>
                          )}
                          
                          <button className="pos-btn-outline" style={{ padding: '0.5rem', fontSize: '0.9rem', flex: 1 }} onClick={() => {
                            triggerOtpProtectedAction('إلغاء الطلب', 'Cancel Order', async () => {
                              // شيل الطلب من الشاشة فورًا
                              setActiveOrders(prev => prev.filter(o => o.id !== order.id));
                              db.updateOrderStatus(order.id, 'cancelled', selectedWaiter?.name).catch(err => console.error('فشل الإلغاء', err));
                              if (settings?.telegram_chat_id) {
                                const text = `⚠️ <b>تنبيه إلغاء طلب نشط</b>\n\n` +
                                  `• <b>رقم الطلب:</b> <code>#${order.id.slice(0, 6)}</code>\n` +
                                  `• <b>الكابتن:</b> ${selectedWaiter?.name || 'غير معروف'}\n` +
                                  `• <b>العميل:</b> ${order.customer_name || 'غير معروف'}\n` +
                                  `• <b>القيمة الإجمالية:</b> ${order.total_price.toFixed(2)} EGP`;

                                import('../utils/telegramUtils').then(({ sendTelegramMessage }) => {
                                  sendTelegramMessage(settings?.telegram_bot_token, settings?.telegram_chat_id, text);
                                });
                              }
                            }, order.id);
                          }}>{language === 'ar' ? 'إلغاء' : 'Cancel'}</button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {dashShownOrders.length === 0 && (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem', color: 'var(--text-muted)', fontSize: '1.2rem' }}>
                    {dashBaseOrders.length > 0 && dashFilter !== 'all'
                      ? (language === 'ar' ? 'لا توجد طلبات في هذا الفلتر — جرّبي «الكل»' : 'No orders in this filter — try "All"')
                      : (language === 'ar' ? 'لا توجد طلبات نشطة حالياً' : 'No active orders currently')}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {view === 'waiter_order_edit' && editingOrder && (
            <motion.div key="w_edit" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} style={{ width: '100%', maxWidth: '600px', margin: '0 auto', padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2 style={{ color: 'var(--gold-primary)' }}>{language === 'ar' ? 'تعديل الطلب' : 'Edit Order'} #{editingOrder.id.slice(0, 6)}</h2>
                <button className="pos-btn-outline" onClick={() => { setEditingOrder(null); setEditOrderId(null); setView('waiter_dashboard'); }}>
                  {t.back}
                </button>
              </div>

              <div style={{ background: 'var(--bg-card)', padding: '2rem', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--gold-primary)' }}>{language === 'ar' ? 'حالة الطلب' : 'Order Status'}</label>
                  <select 
                    className="pos-input" 
                    value={editingOrder.status}
                    onChange={(e) => setEditingOrder({...editingOrder, status: e.target.value as Order['status']})}
                    disabled
                  >
                    <option value="pending">{language === 'ar' ? 'قيد الانتظار' : 'Pending'}</option>
                    <option value="preparing">{language === 'ar' ? 'جاري التجهيز' : 'Preparing'}</option>
                    <option value="delivered">{language === 'ar' ? 'تم التقديم' : 'Delivered'}</option>
                    <option value="completed">{language === 'ar' ? 'مكتمل (تم الدفع)' : 'Completed'}</option>
                    <option value="cancelled">{language === 'ar' ? 'ملغي' : 'Cancelled'}</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--gold-primary)' }}>{language === 'ar' ? 'نوع الطلب' : 'Order Type'}</label>
                    <select 
                      className="pos-input" 
                      value={editingOrder.order_type || 'takeaway'}
                      onChange={(e) => setEditingOrder({...editingOrder, order_type: e.target.value as any})}
                      disabled
                    >
                      <option value="takeaway">{t.takeaway}</option>
                      <option value="dine_in">{t.dineIn}</option>
                      <option value="delivery">{t.delivery}</option>
                      <option value="talabat">{t.talabat}</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--gold-primary)' }}>{t.tableNum}</label>
                    <input 
                      type="text" 
                      className="pos-input" 
                      value={editingOrder.table_number || ''}
                      onChange={(e) => setEditingOrder({...editingOrder, table_number: e.target.value})}
                      disabled
                    />
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', marginBottom: '2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ margin: 0 }}>{language === 'ar' ? 'الأصناف' : 'Items'}</h3>
                    <button className="pos-btn-outline" style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }} onClick={() => {
                      setCart(editingOrder.items);
                      setCustomerName(editingOrder.customer_name);
                      setCustomerPhone(editingOrder.customer_phone);
                      setOrderType(editingOrder.order_type || 'takeaway');
                      setTableNumber(editingOrder.table_number || '');
                      setSelectedHall(editingOrder.hall || '');
                      setView('menu');
                    }}>
                      <Plus size={16} style={{ display: 'inline', marginRight: '4px' }}/> 
                      {language === 'ar' ? 'إضافة/تعديل أصناف' : 'Add/Edit Items'}
                    </button>
                  </div>
                  <div style={{ background: 'var(--bg-darker)', padding: '1rem', borderRadius: '8px' }}>
                    {editingOrder.items.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: idx === editingOrder.items.length - 1 ? 'none' : '1px solid var(--border-color)' }}>
                        <span>
                          {item.quantity}x {language === 'ar' ? item.name_ar : item.name_en}
                          {item.note ? <small style={{ display: 'block', color: 'var(--gold-primary)', marginTop: '0.15rem' }}>{item.note}</small> : null}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <span>{(item.price * item.quantity).toFixed(2)}</span>
                          <button 
                            className="pos-btn-outline" 
                            style={{ padding: '2px 8px', fontSize: '0.8rem', borderColor: 'var(--gold-primary)', color: 'var(--gold-primary)', cursor: 'pointer', minWidth: 'auto' }}
                            onClick={() => {
                              setTransferItem(item);
                              setTransferQty(1);
                              const otherOrders = activeOrders.filter(o => o.id !== editingOrder.id);
                              setTransferTargetOrderId(otherOrders[0]?.id || '');
                            }}
                          >
                            {language === 'ar' ? 'نقل' : 'Transfer'}
                          </button>
                        </div>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dashed var(--border-color)', fontWeight: 'bold', color: 'var(--gold-primary)' }}>
                      <span>{t.total}</span>
                      <span>{editingOrder.total_price.toFixed(2)} EGP</span>
                    </div>
                  </div>
                </div>

                <button className="pos-btn" style={{ width: '100%', padding: '1rem', marginBottom: '1rem' }} onClick={async () => {
                  await db.updateOrder(editingOrder.id, {
                    status: editingOrder.status,
                    order_type: editingOrder.order_type,
                    table_number: editingOrder.table_number
                  }, selectedWaiter?.name);
                  setEditingOrder(null);
                  setEditOrderId(null);
                  setView('waiter_dashboard');
                  loadData();
                }}>
                  {language === 'ar' ? 'حفظ التعديلات' : 'Save Changes'}
                </button>

                <button className="pos-btn-outline" style={{ width: '100%', padding: '1rem', marginBottom: '1rem', borderColor: 'var(--gold-primary)', color: 'var(--gold-primary)' }} onClick={() => {
                  const otherOrders = activeOrders.filter(o => o.id !== editingOrder.id);
                  if (otherOrders.length === 0) {
                    alert(language === 'ar' ? 'لا توجد طلبات أخرى للدمج معها' : 'No other orders to merge with');
                    return;
                  }
                  setMergeTargetOrderId(otherOrders[0]?.id || '');
                  setMergeModalOpen(true);
                }}>
                  {language === 'ar' ? 'دمج مع طلب آخر' : 'Merge with Another Order'}
                </button>

                <button className="pos-btn-outline" style={{ width: '100%', padding: '1rem', borderColor: '#ef4444', color: '#ef4444' }} onClick={() => {
                  triggerOtpProtectedAction('حذف الطلب نهائياً', 'Delete Order permanently', async () => {
                    await db.deleteOrder(editingOrder.id, selectedWaiter?.name);
                    setEditingOrder(null);
                    setEditOrderId(null);
                    setView('waiter_dashboard');
                    loadData();
                  }, editingOrder.id);
                }}>
                  <Trash2 size={16} style={{ display: 'inline', marginRight: '4px' }} />
                  {language === 'ar' ? 'حذف الطلب نهائياً' : 'Delete Order'}
                </button>

              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {summaryOpen && (
            <motion.div
              key="summary_modal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.86)', padding: '1rem', overflowY: 'auto', direction: language === 'ar' ? 'rtl' : 'ltr' }}
              onClick={() => setSummaryOpen(false)}
            >
              <motion.div
                initial={{ scale: 0.96, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.96, y: 20 }}
                onClick={e => e.stopPropagation()}
                style={{ maxWidth: '1180px', margin: '2rem auto', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '1.25rem' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                  <div>
                    <h2 style={{ margin: 0, color: 'var(--gold-primary)' }}>{language === 'ar' ? 'ملخص الحالات وتقفيل الشيفت' : 'Status Summary & Shift Close'}</h2>
                    <p style={{ margin: '0.35rem 0 0', color: 'var(--text-muted)' }}>{new Date().toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US')}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <select className="pos-input" value={scopedSummaryFilter} onChange={e => { if (!deviceHall) setSummaryScopeFilter(e.target.value); }} style={{ width: '220px' }} disabled={!!deviceHall}>
                      {!deviceHall && <option value="all">{language === 'ar' ? 'كل الصالات والخزن' : 'All halls and drawers'}</option>}
                      {deviceHall ? (
                        <option value={`hall:${deviceHall}`}>{deviceHall}</option>
                      ) : (
                        <>
                          {(settings?.halls || []).map(h => (
                            <option key={`hall:${h.name}`} value={`hall:${h.name}`}>{h.name}</option>
                          ))}
                          <option value="drawer:1">{drawerName(1, settings, language === 'ar')}</option>
                          <option value="drawer:2">{drawerName(2, settings, language === 'ar')}</option>
                        </>
                      )}
                    </select>
                    <select className="pos-input" value={summaryOrderTypeFilter} onChange={e => setSummaryOrderTypeFilter(e.target.value as any)} style={{ width: '190px' }}>
                      <option value="all">{language === 'ar' ? 'كل أنواع الطلب' : 'All order types'}</option>
                      <option value="dine_in">{language === 'ar' ? 'صالة' : 'Dine-in'}</option>
                      <option value="takeaway">{language === 'ar' ? 'تيك أواي' : 'Takeaway'}</option>
                      <option value="delivery">{language === 'ar' ? 'دليفري' : 'Delivery'}</option>
                      <option value="talabat">{language === 'ar' ? 'طلبات' : 'Talabat'}</option>
                      <option value="website">{language === 'ar' ? 'موقع' : 'Website'}</option>
                    </select>
                    <button className="pos-btn" style={{ padding: '0.75rem 1rem', fontSize: '1rem' }} onClick={printShiftSummary}>
                      <PrinterIcon size={18} />
                      {language === 'ar' ? 'طباعة تقرير الشيفت' : 'Print Shift Report'}
                    </button>
                    <button className="pos-btn-outline" style={{ padding: '0.75rem 1rem', fontSize: '1rem' }} onClick={() => setSummaryOpen(false)}>
                      <X size={18} />
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                  <div style={{ background: 'var(--bg-darker)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(139,92,246,0.25)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{language === 'ar' ? 'النطاق الحالي' : 'Current scope'}</span>
                    <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#8b5cf6' }}>{summaryScopeLabel()}</div>
                  </div>
                  <div style={{ background: 'var(--bg-darker)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(212,175,55,0.25)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{language === 'ar' ? 'أوردرات اليوم' : "Today's orders"}</span>
                    <div style={{ fontSize: '1.7rem', fontWeight: 900, color: 'var(--gold-primary)' }}>{summaryOrders.length}</div>
                  </div>
                  <div style={{ background: 'var(--bg-darker)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(16,185,129,0.25)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{language === 'ar' ? 'المحصل' : 'Collected'}</span>
                    <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#10b981' }}>{money(summaryRevenue)}</div>
                  </div>
                  <div style={{ background: 'var(--bg-darker)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.25)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{language === 'ar' ? 'إجمالي المصروف' : 'Total Expenses'}</span>
                    <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#ef4444' }}>{money(summaryExpensesTotal)}</div>
                  </div>
                  <div style={{ background: 'var(--bg-darker)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.25)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{language === 'ar' ? 'لسه متحصلش من الطاولات' : 'Unpaid tables'}</span>
                    <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#ef4444' }}>{money(unpaidTablesTotal)}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                  <div style={{ background: 'var(--bg-darker)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <h3 style={{ marginTop: 0, color: 'var(--gold-primary)' }}>{language === 'ar' ? 'تقسيمة وسائل الدفع' : 'Payment Methods'}</h3>
                    {payMethods.map(method => (
                      <div key={method} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.45rem 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <span>{payMethodLabel(method)}</span>
                        <b className="font-en">{money(paymentTotals[method])}</b>
                      </div>
                    ))}
                  </div>
                  <div style={{ background: 'var(--bg-darker)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <h3 style={{ marginTop: 0, color: 'var(--gold-primary)' }}>{language === 'ar' ? 'مبالغ غير محصلة' : 'Unpaid Table Orders'}</h3>
                    <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
                      {unpaidTableOrders.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)' }}>{language === 'ar' ? 'لا يوجد مبالغ غير محصلة' : 'No unpaid table orders'}</p>
                      ) : unpaidTableOrders.map(o => (
                        <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', padding: '0.55rem 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                          <span>{o.hall} - {language === 'ar' ? 'طاولة' : 'Table'} {o.table_number} <small style={{ color: 'var(--text-muted)' }}>#{o.id.slice(-4)}</small></span>
                          <b className="font-en" style={{ color: '#ef4444' }}>{money(totalForOrder(o))}</b>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ background: 'var(--bg-darker)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '1.25rem' }}>
                  <h3 style={{ marginTop: 0, color: 'var(--gold-primary)' }}>{language === 'ar' ? 'حالة طاولات كل صالة' : 'Tables By Hall'}</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
                    {(settings?.halls || []).filter(h => {
                      if (scopedSummaryFilter === 'all') return true;
                      if (scopedSummaryFilter.startsWith('hall:')) return h.name === scopedSummaryFilter.slice(5);
                      if (scopedSummaryFilter.startsWith('drawer:')) return drawerForHall(h.name) === Number(scopedSummaryFilter.slice(7));
                      return true;
                    }).map(h => (
                      <div key={h.name} style={{ border: `1px solid ${hallColor(h.name)}`, borderRadius: '10px', padding: '0.9rem' }}>
                        <h4 style={{ margin: '0 0 0.75rem', color: hallColor(h.name) }}>{h.name}</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                          {(['empty', 'occupied', 'delivered', 'check'] as TableStatus[]).map(status => (
                            <div key={status} style={{ background: `${tableStatusColors[status]}22`, border: `1px solid ${tableStatusColors[status]}`, borderRadius: '8px', padding: '0.6rem' }}>
                              <span style={{ display: 'block', color: tableStatusColors[status], fontWeight: 800 }}>{tableStatusLabels[status]}</span>
                              <b>{[...Array.from({ length: 40 }, (_, i) => String(i + 1)), ...partnerTableNames].filter(n => getTableStatus(h.name, n) === status).length}</b>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ background: 'var(--bg-darker)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <h3 style={{ marginTop: 0, color: 'var(--gold-primary)' }}>{language === 'ar' ? 'أوردرات اليوم' : "Today's Orders"}</h3>
                  <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {summaryOrders.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)' }}>{language === 'ar' ? 'لا توجد أوردرات في هذا الفلتر' : 'No orders in this filter'}</p>
                    ) : summaryOrders.map(o => (
                      <div key={o.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0.75rem', alignItems: 'center', padding: '0.65rem 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <span>
                          <b>#{o.id.slice(-4)}</b> {orderTypeLabel(o)} {o.hall ? `- ${o.hall}` : ''} {o.table_number && o.table_number !== '-' ? `- ${language === 'ar' ? 'طاولة' : 'Table'} ${o.table_number}` : ''}
                          <small style={{ display: 'block', color: 'var(--text-muted)' }}>{o.customer_name} - {new Date(o.created_at).toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US')}</small>
                        </span>
                        <span style={{ color: o.status === 'completed' ? '#10b981' : '#f59e0b', fontWeight: 800 }}>{o.status}</span>
                        <b className="font-en">{money(o.status === 'completed' ? Number(o.total_price) || 0 : totalForOrder(o))}</b>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {/* Collect Payment Modal */}
          {collectPaymentOrder && (
            <motion.div 
              key="collect_payment_modal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.85)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                padding: '1rem',
                backdropFilter: 'blur(8px)',
                direction: language === 'ar' ? 'rtl' : 'ltr'
              }}
            >
              <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                style={{
                  background: 'var(--bg-card)',
                  border: '2px solid var(--gold-primary)',
                  borderRadius: '20px',
                  width: '100%',
                  maxWidth: '500px',
                  padding: '2rem',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                  maxHeight: '90vh',
                  overflowY: 'auto'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                  <h3 style={{ margin: 0, color: 'var(--gold-primary)', fontSize: '1.4rem', fontWeight: 'bold' }}>
                    {language === 'ar' ? 'تحصيل دفع الفاتورة' : 'Collect Bill Payment'} #{collectPaymentOrder.id.slice(0, 6)}
                  </h3>
                  <button 
                    onClick={() => setCollectPaymentOrder(null)} 
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    <X size={24} />
                  </button>
                </div>

                <div style={{ background: 'rgba(212,175,55,0.05)', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', border: '1px dashed rgba(212,175,55,0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{language === 'ar' ? 'اسم العميل:' : 'Customer:'}</span>
                    <span style={{ fontWeight: 'bold', color: 'var(--text-white)' }}>{collectPaymentOrder.customer_name}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{language === 'ar' ? 'إجمالي الفاتورة:' : 'Total Price:'}</span>
                    <span style={{ fontWeight: 'bold', color: 'var(--gold-primary)', fontSize: '1.2rem' }}>
                      {totalForOrder(collectPaymentOrder).toFixed(2)} EGP
                    </span>
                  </div>
                  {/* طباعة الفاتورة للعميل يشوفها قبل ما يدفع */}
                  <button
                    className="pos-btn-outline"
                    style={{ width: '100%', marginTop: '1rem', padding: '0.6rem', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                    onClick={() => {
                      playClickSound();
                      markCheckPrinted(collectPaymentOrder.id);
                      printCustomerReceipt({ ...collectPaymentOrder, total_price: totalForOrder(collectPaymentOrder) }, language, settings, { preBill: true });
                    }}
                  >
                    <PrinterIcon size={18} />
                    {language === 'ar' ? 'طباعة الفاتورة للعميل (قبل الدفع)' : 'Print bill for customer (before payment)'}
                  </button>
                </div>

                {/* ===== الخزنة اللي هيتحصّل فيها ===== */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.6rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    {language === 'ar' ? 'التحصيل في أنهي خزنة؟' : 'Collect into which drawer?'}
                    {collectPaymentOrder.hall && (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginInlineStart: '0.5rem' }}>
                        ({language === 'ar' ? `متحددة تلقائيًا من ${collectPaymentOrder.hall}` : `auto from ${collectPaymentOrder.hall}`})
                      </span>
                    )}
                  </label>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    {allowedDrawers.map(d => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => {
                          if (collectPaymentOrder.hall) return;
                          playClickSound();
                          setPayDrawer(effectiveDrawer(d));
                        }}
                        style={{
                          flex: 1, padding: '0.9rem', borderRadius: '12px', cursor: collectPaymentOrder.hall ? 'not-allowed' : 'pointer',
                          fontWeight: 'bold', fontSize: '1rem', transition: 'all 0.2s',
                          border: payDrawer === d ? '2px solid var(--gold-primary)' : '2px solid #3f3f46',
                          background: payDrawer === d ? 'linear-gradient(45deg, var(--gold-dark), var(--gold-primary))' : 'var(--bg-card)',
                          color: payDrawer === d ? '#000' : 'var(--text-muted)',
                        }}
                      >
                        {drawerName(d, settings, language === 'ar')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Input Breakdown Fields */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      💵 {language === 'ar' ? 'نقدي (كاش):' : 'Cash:'}
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input 
                        type="number"
                        className="pos-input"
                        style={{ flex: 1 }}
                        placeholder="0.00"
                        value={payCash}
                        onChange={(e) => setPayCash(e.target.value === '' ? '' : parseFloat(e.target.value))}
                        min="0"
                      />
                      <button
                        type="button"
                        style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--gold-primary)', background: 'rgba(212,175,55,0.1)', color: 'var(--gold-primary)', fontWeight: 'bold', fontSize: '0.78rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                        onClick={() => { playClickSound(); setPayCash(totalForOrder(collectPaymentOrder)); }}
                      >
                        {language === 'ar' ? 'كامل' : 'Full'}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      💳 {language === 'ar' ? 'فيزا / كارت:' : 'Visa / Card:'}
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input 
                        type="number"
                        className="pos-input"
                        style={{ flex: 1 }}
                        placeholder="0.00"
                        value={payVisa}
                        onChange={(e) => setPayVisa(e.target.value === '' ? '' : parseFloat(e.target.value))}
                        min="0"
                      />
                      <button
                        type="button"
                        style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--gold-primary)', background: 'rgba(212,175,55,0.1)', color: 'var(--gold-primary)', fontWeight: 'bold', fontSize: '0.78rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                        onClick={() => { playClickSound(); setPayVisa(totalForOrder(collectPaymentOrder)); }}
                      >
                        {language === 'ar' ? 'كامل' : 'Full'}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      📱 {language === 'ar' ? 'محفظة الكاشير:' : 'Cashier Wallet:'}
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input 
                        type="number"
                        className="pos-input"
                        style={{ flex: 1 }}
                        placeholder="0.00"
                        value={payWalletCashier}
                        onChange={(e) => setPayWalletCashier(e.target.value === '' ? '' : parseFloat(e.target.value))}
                        min="0"
                        disabled={payIsDeferred && Math.abs(totalForOrder(collectPaymentOrder) - ((Number(payCash) || 0) + (Number(payVisa) || 0) + (Number(payWalletCafe) || 0) + (Number(payInstapay) || 0))) < 0.01}
                      />
                      <button
                        type="button"
                        style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--gold-primary)', background: 'rgba(212,175,55,0.1)', color: 'var(--gold-primary)', fontWeight: 'bold', fontSize: '0.78rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                        onClick={() => { playClickSound(); setPayWalletCashier(totalForOrder(collectPaymentOrder)); }}
                      >
                        {language === 'ar' ? 'كامل' : 'Full'}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      📱 {language === 'ar' ? 'محفظة الكافيه:' : 'Cafe Wallet:'}
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input 
                        type="number"
                        className="pos-input"
                        style={{ flex: 1 }}
                        placeholder="0.00"
                        value={payWalletCafe}
                        onChange={(e) => setPayWalletCafe(e.target.value === '' ? '' : parseFloat(e.target.value))}
                        min="0"
                        disabled={payIsDeferred && Math.abs(totalForOrder(collectPaymentOrder) - ((Number(payCash) || 0) + (Number(payVisa) || 0) + (Number(payWalletCashier) || 0) + (Number(payInstapay) || 0))) < 0.01}
                      />
                      <button
                        type="button"
                        style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--gold-primary)', background: 'rgba(212,175,55,0.1)', color: 'var(--gold-primary)', fontWeight: 'bold', fontSize: '0.78rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                        onClick={() => { playClickSound(); setPayWalletCafe(totalForOrder(collectPaymentOrder)); }}
                      >
                        {language === 'ar' ? 'كامل' : 'Full'}
                      </button>
                    </div>
                  </div>


                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      ⚡ {language === 'ar' ? 'إنستا باي:' : 'InstaPay:'}
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input 
                        type="number"
                        className="pos-input"
                        style={{ flex: 1 }}
                        placeholder="0.00"
                        value={payInstapay}
                        onChange={(e) => setPayInstapay(e.target.value === '' ? '' : parseFloat(e.target.value))}
                        min="0"
                      />
                      <button
                        type="button"
                        style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--gold-primary)', background: 'rgba(212,175,55,0.1)', color: 'var(--gold-primary)', fontWeight: 'bold', fontSize: '0.78rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                        onClick={() => { playClickSound(); setPayInstapay(totalForOrder(collectPaymentOrder)); }}
                      >
                        {language === 'ar' ? 'كامل' : 'Full'}
                      </button>
                    </div>
                  </div>

                  {/* Deferred Toggle */}
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-white)', userSelect: 'none' }}>
                      <input 
                        type="checkbox"
                        checked={payIsDeferred}
                        onChange={(e) => {
                          setPayIsDeferred(e.target.checked);
                          if (e.target.checked && !payCustomerId) {
                            setPayCustomerId(collectPaymentOrder.customer_id || (customers[0]?.id || ''));
                          }
                        }}
                        style={{ width: '18px', height: '18px', accentColor: 'var(--gold-primary)' }}
                      />
                      <span style={{ fontWeight: 'bold' }}>{language === 'ar' ? 'تسجيل جزء آجل (على الحساب)' : 'Record remaining as deferred (Credit)'}</span>
                    </label>

                    {payIsDeferred && (
                      <div style={{ marginTop: '0.8rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                          👤 {language === 'ar' ? 'اختر العميل لتسجيل المديونية:' : 'Select Customer:'}
                        </label>
                        {!isCreatingCustomer ? (
                          <div style={{ position: 'relative' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                              <input
                                type="text"
                                className="pos-input"
                                placeholder={language === 'ar' ? 'بحث بالاسم أو رقم الهاتف...' : 'Search by name or phone...'}
                                value={customerSearchQuery}
                                onChange={(e) => setCustomerSearchQuery(e.target.value)}
                                style={{ flex: 1 }}
                              />
                              <button
                                className="pos-btn"
                                style={{ padding: '0.5rem', fontSize: '0.9rem', flexShrink: 0 }}
                                onClick={() => setIsCreatingCustomer(true)}
                              >
                                {language === 'ar' ? '+ جديد' : '+ New'}
                              </button>
                            </div>
                            <div style={{ maxHeight: '150px', overflowY: 'auto', background: 'var(--bg-darker)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                              {customers.filter(c => 
                                c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) || 
                                c.phone.includes(customerSearchQuery)
                              ).map(c => (
                                <div
                                  key={c.id}
                                  onClick={() => { setPayCustomerId(c.id); setCustomerSearchQuery(''); }}
                                  style={{
                                    padding: '0.8rem',
                                    cursor: 'pointer',
                                    borderBottom: '1px solid var(--border-color)',
                                    background: payCustomerId === c.id ? 'var(--gold-primary)' : 'transparent',
                                    color: payCustomerId === c.id ? '#000' : 'var(--text-white)',
                                    fontWeight: payCustomerId === c.id ? 'bold' : 'normal'
                                  }}
                                >
                                  {c.name} {c.phone ? `(${c.phone})` : ''} - {language === 'ar' ? 'دين: ' : 'Debt: '}{c.total_debt.toFixed(2)} EGP
                                </div>
                              ))}
                              {customers.filter(c => 
                                c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) || 
                                c.phone.includes(customerSearchQuery)
                              ).length === 0 && (
                                <div style={{ padding: '0.8rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                  {language === 'ar' ? 'لا يوجد عملاء مطابقين' : 'No customers found'}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div style={{ background: 'var(--bg-darker)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                            <h4 style={{ margin: '0 0 1rem 0', color: 'var(--gold-primary)' }}>{language === 'ar' ? 'عميل جديد' : 'New Customer'}</h4>
                            <input
                              type="text"
                              className="pos-input"
                              placeholder={language === 'ar' ? 'اسم العميل' : 'Customer Name'}
                              value={newCustomerName}
                              onChange={(e) => setNewCustomerName(e.target.value)}
                              style={{ marginBottom: '0.5rem' }}
                            />
                            <input
                              type="text"
                              className="pos-input"
                              placeholder={language === 'ar' ? 'رقم الهاتف' : 'Phone Number'}
                              value={newCustomerPhone}
                              onChange={(e) => setNewCustomerPhone(e.target.value)}
                              style={{ marginBottom: '1rem' }}
                            />
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button
                                className="pos-btn"
                                style={{ flex: 1, padding: '0.5rem' }}
                                onClick={async () => {
                                  if (!newCustomerName) {
                                    alert(language === 'ar' ? 'يرجى إدخال اسم العميل' : 'Please enter customer name');
                                    return;
                                  }
                                  try {
                                    const newCust = await db.addCustomer({ name: newCustomerName, phone: newCustomerPhone, total_debt: 0 });
                                    await loadData();
                                    setPayCustomerId(newCust.id);
                                    setIsCreatingCustomer(false);
                                    setNewCustomerName('');
                                    setNewCustomerPhone('');
                                  } catch (err) {
                                    console.error(err);
                                    alert('Failed to add customer');
                                  }
                                }}
                              >
                                {language === 'ar' ? 'حفظ واختيار' : 'Save & Select'}
                              </button>
                              <button
                                className="pos-btn-outline"
                                style={{ flex: 1, padding: '0.5rem' }}
                                onClick={() => setIsCreatingCustomer(false)}
                              >
                                {language === 'ar' ? 'إلغاء' : 'Cancel'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Calculations & Validation */}
                {(() => {
                  const cashVal = Number(payCash) || 0;
                  const visaVal = Number(payVisa) || 0;
                  const walletCashierVal = Number(payWalletCashier) || 0;
                  const walletCafeVal = Number(payWalletCafe) || 0;
                  const instapayVal = Number(payInstapay) || 0;
                  const totalPaid = cashVal + visaVal + walletCashierVal + walletCafeVal + instapayVal;

                  const payableTotal = totalForOrder(collectPaymentOrder);
                  const remaining = payableTotal - totalPaid;
                  // أي زيادة عن قيمة الفاتورة هي تبس للعرض فقط، ولا تغيّر total_price.
                  const paidParts = [
                    { method: 'cash', amount: cashVal },
                    { method: 'visa', amount: visaVal },
                    { method: 'wallet_restaurant', amount: walletCashierVal },
                    { method: 'wallet_cafe', amount: walletCafeVal },
                    { method: 'instapay', amount: instapayVal },
                  ];
                  let billRemainingForTips = payableTotal;
                  const tipByMethod: Record<string, number> = {};
                  paidParts.forEach(({ method, amount }) => {
                    const appliedToBill = Math.min(amount, Math.max(0, billRemainingForTips));
                    tipByMethod[method] = Math.max(0, amount - appliedToBill);
                    billRemainingForTips = Math.max(0, billRemainingForTips - appliedToBill);
                  });
                  const tipTotal = Object.values(tipByMethod).reduce((sum, value) => sum + value, 0);

                  let statusText = '';
                  let isError = false;
                  let canSubmit = false;

                  if (remaining < -0.01) {
                    statusText = language === 'ar'
                      ? `✓ تم دفع الفاتورة + تبس ${Math.abs(remaining).toFixed(2)} EGP (للعرض فقط)`
                      : `✓ Invoice paid + ${Math.abs(remaining).toFixed(2)} EGP tip (display only)`;
                    canSubmit = true;
                  } else if (Math.abs(remaining) < 0.01) {
                    statusText = language === 'ar' ? '✓ تم دفع كامل قيمة الفاتورة' : '✓ Full payment entered';
                    canSubmit = true;
                  } else if (remaining > 0) {
                    if (payIsDeferred) {
                      if (!payCustomerId) {
                        statusText = language === 'ar' ? '⚠️ يرجى اختيار العميل لتسجيل المبلغ الآجل' : '⚠️ Please select a customer for deferred amount';
                        isError = true;
                      } else {
                        statusText = language === 'ar' 
                          ? `ℹ️ سيتم تسجيل ${remaining.toFixed(2)} EGP كدين على العميل المختار` 
                          : `ℹ️ ${remaining.toFixed(2)} EGP will be registered as debt for selected customer`;
                        canSubmit = true;
                      }
                    } else {
                      statusText = language === 'ar' 
                        ? `⚠️ يتبقى ${remaining.toFixed(2)} EGP غير مدفوعة (فعل خيار الآجل أو أكمل السداد)` 
                        : `⚠️ ${remaining.toFixed(2)} EGP remaining (check deferred or complete payment)`;
                      isError = true;
                    }
                  } else {
                    statusText = language === 'ar' 
                      ? `⚠️ قيمة المدفوعات تتجاوز الفاتورة بـ ${Math.abs(remaining).toFixed(2)} EGP` 
                      : `⚠️ Payments exceed total by ${Math.abs(remaining).toFixed(2)} EGP`;
                    isError = true;
                  }

                  return (
                    <>
                      <div style={{ 
                        background: isError ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', 
                        color: isError ? '#ef4444' : '#10b989', 
                        padding: '0.8rem', 
                        borderRadius: '8px', 
                        fontSize: '0.9rem', 
                        fontWeight: 'bold',
                        marginBottom: '1.5rem',
                        textAlign: 'center',
                        border: `1px solid ${isError ? '#ef4444' : '#10b989'}`
                      }}>
                        {statusText}
                      </div>

                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <button 
                          className="pos-btn" 
                          style={{ flex: 1, padding: '1rem' }} 
                          disabled={!canSubmit}
                          onClick={async () => {
                            try {
                              if (remaining > 0.01 && payIsDeferred && payCustomerId) {
                                const customer = customers.find(c => c.id === payCustomerId);
                                const currentDebt = customer ? customer.total_debt : 0;
                                await db.updateCustomerDebt(payCustomerId, currentDebt + remaining);
                              }

                              let finalMethod: Order['payment_method'] = 'cash';
                              const activeMethods = [
                                cashVal > 0 && 'cash',
                                visaVal > 0 && 'visa',
                                walletCashierVal > 0 && 'wallet_restaurant',
                                walletCafeVal > 0 && 'wallet_cafe',
                                instapayVal > 0 && 'instapay',
                                remaining > 0.01 && payIsDeferred && 'deferred'
                              ].filter(Boolean) as string[];

                              if (activeMethods.length > 1) {
                                finalMethod = 'split';
                              } else if (activeMethods.length === 1) {
                                finalMethod = activeMethods[0] as Order['payment_method'];
                              }

                              const paymentDetails = {
                                cash: cashVal,
                                visa: visaVal,
                                wallet_cashier: walletCashierVal,
                                wallet_restaurant: walletCashierVal,
                                wallet_cafe: walletCafeVal,
                                instapay: instapayVal,
                                deferred: remaining > 0.01 && payIsDeferred ? remaining : 0,
                                customer_id: remaining > 0.01 && payIsDeferred ? payCustomerId : undefined,
                                tip_total: tipTotal,
                                tip_by_method: tipByMethod
                              };

                              const paidOrder = await db.updateOrder(collectPaymentOrder.id, {
                                status: 'completed',
                                total_price: payableTotal,
                                payment_method: finalMethod,
                                payment_details: paymentDetails,
                                drawer: payDrawer, // الخزنة اللي اتحصّل فيها — عليها بيتم التقفيل
                                customer_id: payCustomerId || collectPaymentOrder.customer_id
                              }, selectedWaiter?.name);

                              // طباعة فاتورة العميل تلقائي عند الدفع
                              printCustomerReceipt(paidOrder || ({ ...collectPaymentOrder, status: 'completed', total_price: payableTotal, payment_method: finalMethod, payment_details: paymentDetails } as any), language, settings);

                              setCollectPaymentOrder(null);
                              loadData();
                            } catch (e) {
                              alert(language === 'ar' ? 'فشل تحصيل الدفع، يرجى المحاولة مرة أخرى' : 'Failed to collect payment, please try again.');
                            }
                          }}
                        >
                          {language === 'ar' ? 'تأكيد الدفع والإنهاء' : 'Confirm Payment & Complete'}
                        </button>

                        <button 
                          className="pos-btn-outline" 
                          style={{ flex: 1, padding: '1rem' }} 
                          onClick={() => setCollectPaymentOrder(null)}
                        >
                          {language === 'ar' ? 'إلغاء' : 'Cancel'}
                        </button>
                      </div>
                      
                      <div style={{ marginTop: '1rem' }}>
                        <button 
                          className="pos-btn-outline" 
                          style={{ width: '100%', padding: '1rem', borderColor: '#eab308', color: '#eab308', background: 'rgba(234, 179, 8, 0.1)' }} 
                          onClick={() => {
                            triggerOtpProtectedAction('تسجيل كضيافة', 'Log as Hospitality', async () => {
                               try {
                                 const hospOrder = await db.updateOrder(collectPaymentOrder.id, {
                                   status: 'completed',
                                   payment_method: 'hospitality',
                                   total_price: 0,
                                   drawer: payDrawer,
                                   payment_details: { type: 'hospitality', original_price: payableTotal }
                                 }, selectedWaiter?.name);
                                 printCustomerReceipt(hospOrder || ({ ...collectPaymentOrder, status: 'completed', payment_method: 'hospitality', total_price: 0 } as any), language, settings);
                                 setCollectPaymentOrder(null);
                                 loadData();
                               } catch (e) {
                                 alert(language === 'ar' ? 'فشل تسجيل الضيافة' : 'Failed to record hospitality');
                               }
                            }, collectPaymentOrder.id);
                          }}
                        >
                          🎁 {language === 'ar' ? 'تسجيل كضيافة (طلب OTP)' : 'Record as Hospitality (OTP)'}
                        </button>
                      </div>

                      {/* فاتورة استاف — مجانية وبتتسجل باسم الموظف */}
                      <div style={{ marginTop: '0.75rem' }}>
                        <button
                          className="pos-btn-outline"
                          style={{ width: '100%', padding: '1rem', borderColor: '#38bdf8', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.1)' }}
                          onClick={() => {
                            playClickSound();
                            setStaffEmployeeId('');
                            setStaffPasscode('');
                            setStaffModalMode('collect');
                            setStaffModalOpen(true);
                          }}
                        >
                          👨‍🍳 {language === 'ar' ? 'فاتورة استاف (مجانية)' : 'Staff Order (Free)'}
                        </button>
                      </div>
                    </>
                  );
                })()}
              </motion.div>
            </motion.div>
          )}

          {/* ===== مودال فاتورة الاستاف ===== */}
          {staffModalOpen && (staffModalMode === 'new' || collectPaymentOrder) && (
            <motion.div
              key="staff_order_modal"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100010, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
              onClick={() => !staffSaving && setStaffModalOpen(false)}
            >
              <motion.div
                initial={{ scale: 0.94, y: 20 }} animate={{ scale: 1, y: 0 }}
                onClick={e => e.stopPropagation()}
                style={{ background: '#18181b', border: '1px solid #38bdf8', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '440px', maxHeight: '90vh', overflowY: 'auto' }}
              >
                <h3 style={{ margin: '0 0 0.5rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  👨‍🍳 {language === 'ar' ? 'فاتورة استاف' : 'Staff Order'}
                </h3>
                <p style={{ color: '#a1a1aa', fontSize: '0.88rem', margin: '0 0 1.5rem', lineHeight: 1.6 }}>
                  {language === 'ar'
                    ? 'الطلب هيتسجّل مجاني باسم الموظف، ومش هيتحسب في المبيعات — بس هيتخصم من المخزون عادي ويظهر في التقارير.'
                    : 'The order is recorded free under the employee name. It is excluded from sales but still deducts inventory and appears in reports.'}
                </p>

                {collectPaymentOrder && staffModalMode === 'collect' && (
                  <div style={{ background: 'rgba(56,189,248,0.06)', border: '1px dashed rgba(56,189,248,0.3)', borderRadius: '10px', padding: '0.9rem', marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a1a1aa', fontSize: '0.9rem' }}>
                      <span>{language === 'ar' ? 'قيمة الطلب:' : 'Order value:'}</span>
                      <b style={{ color: '#fff' }}>{totalForOrder(collectPaymentOrder).toFixed(2)} EGP</b>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a1a1aa', fontSize: '0.9rem', marginTop: '0.4rem' }}>
                      <span>{language === 'ar' ? 'المطلوب تحصيله:' : 'To collect:'}</span>
                      <b style={{ color: '#38bdf8' }}>{language === 'ar' ? 'مجاني' : 'Free'}</b>
                    </div>
                  </div>
                )}

                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a1a1aa', fontSize: '0.9rem' }}>
                  {language === 'ar' ? 'الموظف المستفيد *' : 'Employee *'}
                </label>
                <select
                  className="pos-input"
                  value={staffEmployeeId}
                  onChange={e => setStaffEmployeeId(e.target.value)}
                  style={{ marginBottom: '1.25rem', background: '#111', textAlign: 'start' }}
                >
                  <option value="">{language === 'ar' ? '— اختر الموظف —' : '— Select employee —'}</option>
                  {employeesList.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>

                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a1a1aa', fontSize: '0.9rem' }}>
                  {language === 'ar' ? 'كلمة السر *' : 'Password *'}
                </label>
                <input
                  type="password"
                  className="pos-input"
                  value={staffPasscode}
                  onChange={e => setStaffPasscode(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleStaffOrder(); } }}
                  placeholder={language === 'ar' ? 'كلمة سر فواتير الاستاف' : 'Staff orders password'}
                  style={{ marginBottom: '1.5rem', background: '#111', letterSpacing: '0.3rem' }}
                />

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    className="pos-btn"
                    style={{ flex: 2, background: '#38bdf8', color: '#000' }}
                    disabled={staffSaving || !staffEmployeeId || !staffPasscode}
                    onClick={handleStaffOrder}
                  >
                    {staffSaving
                      ? (language === 'ar' ? 'جاري التسجيل…' : 'Saving…')
                      : staffModalMode === 'new'
                        ? (language === 'ar' ? 'تأكيد ومتابعة' : 'Confirm & continue')
                        : (language === 'ar' ? 'تسجيل الفاتورة' : 'Record order')}
                  </button>
                  <button className="pos-btn-outline" style={{ flex: 1 }} disabled={staffSaving} onClick={() => setStaffModalOpen(false)}>
                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* Transfer Item Modal */}
          {transferItem && editingOrder && (
            <motion.div 
              key="transfer_item_modal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.85)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                padding: '1rem',
                backdropFilter: 'blur(8px)',
                direction: language === 'ar' ? 'rtl' : 'ltr'
              }}
            >
              <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                style={{
                  background: 'var(--bg-card)',
                  border: '2px solid var(--gold-primary)',
                  borderRadius: '20px',
                  width: '100%',
                  maxWidth: '450px',
                  padding: '2rem',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                  <h3 style={{ margin: 0, color: 'var(--gold-primary)', fontSize: '1.3rem', fontWeight: 'bold' }}>
                    {language === 'ar' ? 'نقل الصنف بين الطاولات' : 'Transfer Item Between Tables'}
                  </h3>
                  <button 
                    onClick={() => setTransferItem(null)} 
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    <X size={24} />
                  </button>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', border: '1px solid var(--border-color)' }}>
                  <div style={{ color: 'var(--gold-primary)', fontWeight: 'bold', marginBottom: '0.4rem' }}>
                    {language === 'ar' ? transferItem.name_ar : transferItem.name_en}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    {language === 'ar' ? `الكمية المتوفرة بالطلب الحالي: ${transferItem.quantity}` : `Available quantity in current order: ${transferItem.quantity}`}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', marginBottom: '1.5rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      {language === 'ar' ? 'الكمية المراد نقلها:' : 'Quantity to Transfer:'}
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#000', padding: '6px 12px', borderRadius: '8px', width: 'fit-content' }}>
                      <button 
                        disabled={transferQty <= 1}
                        onClick={() => setTransferQty(prev => Math.max(1, prev - 1))} 
                        style={{ background: 'var(--border-color)', border: 'none', color: 'var(--text-white)', width: '32px', height: '32px', borderRadius: '6px', cursor: 'pointer' }}
                      >
                        <Minus size={16} />
                      </button>
                      <span style={{ fontWeight: 'bold', minWidth: '30px', textAlign: 'center', fontSize: '1.2rem' }}>{transferQty}</span>
                      <button 
                        disabled={transferQty >= transferItem.quantity}
                        onClick={() => setTransferQty(prev => Math.min(transferItem.quantity, prev + 1))} 
                        style={{ background: 'var(--gold-primary)', border: 'none', color: '#000', width: '32px', height: '32px', borderRadius: '6px', cursor: 'pointer' }}
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      {language === 'ar' ? 'الطلب المستهدف (رقم الطاولة / اسم العميل):' : 'Target Order (Table / Customer):'}
                    </label>
                    {activeOrders.filter(o => o.id !== editingOrder.id).length === 0 ? (
                      <div style={{ color: '#ef4444', fontSize: '0.9rem', fontWeight: 'bold' }}>
                        {language === 'ar' ? 'لا توجد طلبات نشطة أخرى لنقل الصنف إليها!' : 'No other active orders to transfer to!'}
                      </div>
                    ) : (
                      <select
                        className="pos-input"
                        value={transferTargetOrderId}
                        onChange={(e) => setTransferTargetOrderId(e.target.value)}
                      >
                        {activeOrders.filter(o => o.id !== editingOrder.id).map(o => (
                          <option key={o.id} value={o.id}>
                            #{o.id.slice(0, 6)} - {o.customer_name} {o.table_number && o.table_number !== '-' ? `(Table ${o.table_number})` : ''} - {o.total_price.toFixed(2)} EGP
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button 
                    className="pos-btn" 
                    style={{ flex: 1, padding: '1rem' }} 
                    disabled={activeOrders.filter(o => o.id !== editingOrder.id).length === 0 || !transferTargetOrderId}
                    onClick={handleTransferSubmit}
                  >
                    {language === 'ar' ? 'تأكيد النقل' : 'Confirm Transfer'}
                  </button>

                  <button 
                    className="pos-btn-outline" 
                    style={{ flex: 1, padding: '1rem' }} 
                    onClick={() => setTransferItem(null)}
                  >
                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* Merge Table Modal */}
          {mergeModalOpen && editingOrder && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.85)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 100000,
                backdropFilter: 'blur(8px)',
                direction: language === 'ar' ? 'rtl' : 'ltr'
              }}
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                style={{
                  background: 'var(--bg-card)',
                  border: '2px solid var(--gold-primary)',
                  borderRadius: '20px',
                  width: '90%',
                  maxWidth: '500px',
                  padding: '2rem',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                }}
              >
                <h3 style={{ color: 'var(--gold-primary)', fontSize: '1.4rem', marginTop: 0, marginBottom: '1.5rem', textAlign: 'center' }}>
                  {language === 'ar' ? 'دمج مع طلب آخر' : 'Merge with Another Order'}
                </h3>
                
                <p style={{ color: 'var(--text-white)', textAlign: 'center', marginBottom: '1.5rem' }}>
                  {language === 'ar' 
                    ? 'سيتم نقل جميع الأصناف من الطلب المختار إلى الطلب الحالي، وسيتم إلغاء الطلب المختار بالكامل.' 
                    : 'All items from the selected order will be moved to the current order, and the selected order will be cancelled.'}
                </p>

                <div style={{ marginBottom: '2rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    {language === 'ar' ? 'اختر الطلب المُراد سحب أصنافه:' : 'Select order to pull items from:'}
                  </label>
                  {activeOrders.filter(o => o.id !== editingOrder.id).length === 0 ? (
                    <div style={{ color: '#ef4444', fontSize: '0.9rem', fontWeight: 'bold' }}>
                      {language === 'ar' ? 'لا توجد طلبات نشطة أخرى للدمج معها!' : 'No other active orders to merge with!'}
                    </div>
                  ) : (
                    <select
                      className="pos-input"
                      value={mergeTargetOrderId}
                      onChange={(e) => setMergeTargetOrderId(e.target.value)}
                    >
                      {activeOrders.filter(o => o.id !== editingOrder.id).map(o => (
                        <option key={o.id} value={o.id}>
                          #{o.id.slice(0, 6)} - {o.customer_name} {o.table_number && o.table_number !== '-' ? `(Table ${o.table_number})` : ''} - {o.total_price.toFixed(2)} EGP
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button 
                    className="pos-btn" 
                    style={{ flex: 1, padding: '1rem' }} 
                    disabled={activeOrders.filter(o => o.id !== editingOrder.id).length === 0 || !mergeTargetOrderId}
                    onClick={() => {
                      const msg = language === 'ar' ? 'هل أنت متأكد من دمج الطلب المختار مع الطلب الحالي؟' : 'Are you sure you want to merge the selected order into the current one?';
                      if (window.confirm(msg)) {
                        handleMergeSubmit();
                      }
                    }}
                  >
                    {language === 'ar' ? 'تأكيد الدمج' : 'Confirm Merge'}
                  </button>

                  <button 
                    className="pos-btn-outline" 
                    style={{ flex: 1, padding: '1rem' }} 
                    onClick={() => setMergeModalOpen(false)}
                  >
                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* Debt Settlement Modal */}
          {debtModalOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '1rem' }}>
              <div style={{ background: 'var(--bg-dark)', padding: '2rem', borderRadius: '16px', border: '1px solid var(--gold-primary)', width: '100%', maxWidth: '400px' }}>
                <h3 style={{ color: 'var(--gold-primary)', marginBottom: '1.5rem', textAlign: 'center' }}>
                  {language === 'ar' ? 'سداد مديونية عميل' : 'Customer Debt Settlement'}
                </h3>
                <form onSubmit={handleDebtSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-gray)' }}>{language === 'ar' ? 'العميل' : 'Customer'}</label>
                    <select required className="pos-input" value={debtCustomerId} onChange={(e) => setDebtCustomerId(e.target.value)} style={{ width: '100%', padding: '0.75rem' }}>
                      <option value="">{language === 'ar' ? 'اختر العميل...' : 'Select Customer...'}</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-gray)' }}>{language === 'ar' ? 'المبلغ' : 'Amount'}</label>
                    <input required type="number" step="0.01" className="pos-input" value={debtAmount} onChange={(e) => setDebtAmount(e.target.value)} style={{ width: '100%', padding: '0.75rem' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-gray)' }}>{language === 'ar' ? 'الخزنة' : 'Drawer'}</label>
                      <select required className="pos-input" value={debtDrawer} onChange={e => setDebtDrawer(Number(e.target.value) as 1 | 2)} style={{ width: '100%', padding: '0.75rem' }}>
                        {allowedDrawers.map(d => <option key={d} value={d}>{drawerName(d, settings, language === 'ar')}</option>)}
                      </select>
                    </div>
                    <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-gray)' }}>{language === 'ar' ? 'طريقة الدفع' : 'Payment Method'}</label>
                    <select required className="pos-input" value={debtPaymentMethod} onChange={(e) => setDebtPaymentMethod(e.target.value as any)} style={{ width: '100%', padding: '0.75rem' }}>
                      <option value="cash">{language === 'ar' ? 'كاش' : 'Cash'}</option>
                      <option value="visa">{language === 'ar' ? 'فيزا' : 'Visa'}</option>
                      <option value="wallet_restaurant">{language === 'ar' ? 'محفظة المطعم' : 'Restaurant Wallet'}</option>
                      <option value="wallet_cafe">{language === 'ar' ? 'محفظة الكافيه' : 'Cafe Wallet'}</option>
                      <option value="instapay">{language === 'ar' ? 'انستاباي' : 'Instapay'}</option>
                    </select>
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-gray)' }}>{language === 'ar' ? 'ملاحظات' : 'Notes'}</label>
                    <textarea className="pos-input" value={debtNotes} onChange={(e) => setDebtNotes(e.target.value)} style={{ width: '100%', padding: '0.75rem', minHeight: '80px' }}></textarea>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                    <button type="submit" className="pos-btn" style={{ flex: 1, padding: '1rem' }}>
                      {language === 'ar' ? 'تأكيد السداد' : 'Confirm Settlement'}
                    </button>
                    <button type="button" className="pos-btn-outline" style={{ flex: 1, padding: '1rem' }} onClick={() => setDebtModalOpen(false)}>
                      {language === 'ar' ? 'إلغاء' : 'Cancel'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          )}

          {depositModalOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '1rem' }}>
              <div style={{ background: 'var(--bg-dark)', padding: '2rem', borderRadius: '16px', border: '1px solid #22c55e', width: '100%', maxWidth: '460px' }}>
                <h3 style={{ color: '#4ade80', marginBottom: '1.5rem', textAlign: 'center' }}>{language === 'ar' ? 'إيداع في حساب العميل' : 'Customer Account Deposit'}</h3>
                <form onSubmit={handleCustomerDepositSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <select required className="pos-input" value={depositCustomerId} onChange={e => setDepositCustomerId(e.target.value)}>
                    <option value="">{language === 'ar' ? 'اختر العميل...' : 'Select customer...'}</option>
                    {customers.filter(c => Number(c.total_debt || 0) > 0).map(c => <option key={c.id} value={c.id}>{c.name} — {Number(c.total_debt || 0).toFixed(2)} EGP</option>)}
                  </select>
                  <input required type="number" min="0.01" step="0.01" className="pos-input" placeholder={language === 'ar' ? 'المبلغ' : 'Amount'} value={depositAmount} onChange={e => setDepositAmount(e.target.value)} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <select required className="pos-input" value={depositDrawer} onChange={e => setDepositDrawer(Number(e.target.value) as 1 | 2)}>
                      {allowedDrawers.map(d => <option key={d} value={d}>{drawerName(d, settings, language === 'ar')}</option>)}
                    </select>
                    <select required className="pos-input" value={depositPaymentMethod} onChange={e => setDepositPaymentMethod(e.target.value as any)}>
                    <option value="cash">{language === 'ar' ? 'كاش' : 'Cash'}</option>
                    <option value="visa">{language === 'ar' ? 'فيزا' : 'Visa'}</option>
                    <option value="wallet_restaurant">{language === 'ar' ? 'محفظة المطعم' : 'Restaurant Wallet'}</option>
                    <option value="wallet_cafe">{language === 'ar' ? 'محفظة الكافيه' : 'Cafe Wallet'}</option>
                    <option value="instapay">Instapay</option>
                    </select>
                  </div>
                  <textarea className="pos-input" placeholder={language === 'ar' ? 'ملاحظة اختيارية' : 'Optional note'} value={depositNotes} onChange={e => setDepositNotes(e.target.value)} />
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button disabled={depositSaving} type="submit" className="pos-btn" style={{ flex: 1 }}>{depositSaving ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (language === 'ar' ? 'تسجيل الإيداع' : 'Record Deposit')}</button>
                    <button type="button" className="pos-btn-outline" style={{ flex: 1 }} onClick={() => setDepositModalOpen(false)}>{language === 'ar' ? 'إلغاء' : 'Cancel'}</button>
                  </div>
                </form>
              </div>
            </motion.div>
          )}
          {/* Expense Withdrawal Modal */}
          {expenseModalOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '1rem' }}>
              <div style={{ background: 'var(--bg-dark)', padding: '2rem', borderRadius: '16px', border: '1px solid #ef4444', width: '100%', maxWidth: '520px' }}>
                <h3 style={{ color: '#f87171', marginBottom: '0.5rem', textAlign: 'center' }}>{language === 'ar' ? 'سحب مصروف من الخزنة' : 'Cashier Expense Withdrawal'}</h3>
                <p style={{ color: 'var(--text-gray)', textAlign: 'center', marginBottom: '1.5rem' }}>{language === 'ar' ? 'سيقوم المدير بتصنيف المصروف لاحقًا من لوحة الإدارة.' : 'The admin will classify this withdrawal later.'}</p>
                <form onSubmit={handleExpenseSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <input required type="text" className="pos-input" placeholder={language === 'ar' ? 'سبب/بيان السحب' : 'Withdrawal description'} value={expenseName} onChange={e => setExpenseName(e.target.value)} />
                    <input required type="number" min="0.01" step="0.01" className="pos-input" placeholder={language === 'ar' ? 'المبلغ المسحوب' : 'Withdrawn amount'} value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <select required className="pos-input" value={expenseDrawer} onChange={e => setExpenseDrawer(Number(e.target.value) as 1 | 2)}>
                      {allowedDrawers.map(d => <option key={d} value={d}>{drawerName(d, settings, language === 'ar')}</option>)}
                    </select>
                    <select required className="pos-input" value={expensePaymentMethod} onChange={e => setExpensePaymentMethod(e.target.value as any)}>
                      <option value="cash">{language === 'ar' ? 'كاش' : 'Cash'}</option>
                      <option value="visa">{language === 'ar' ? 'فيزا' : 'Visa'}</option>
                      <option value="wallet_restaurant">{language === 'ar' ? 'محفظة المطعم' : 'Restaurant Wallet'}</option>
                      <option value="wallet_cafe">{language === 'ar' ? 'محفظة الكافيه' : 'Cafe Wallet'}</option>
                      <option value="instapay">{language === 'ar' ? 'إنستا باي' : 'Instapay'}</option>
                    </select>
                  </div>
                  <select required className="pos-input" value={expenseEmployeeId} onChange={e => setExpenseEmployeeId(e.target.value)}>
                    <option value="">{language === 'ar' ? 'الموظف المستلم للفلوس...' : 'Employee receiving the money...'}</option>
                    {employeesList.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                  </select>
                  <textarea required className="pos-input" placeholder={language === 'ar' ? 'الملاحظة: المصروف اتسحب ليه؟' : 'Note: what was the money withdrawn for?'} value={expenseNotes} onChange={e => setExpenseNotes(e.target.value)} />
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button disabled={expenseSaving} type="submit" className="pos-btn" style={{ flex: 1, background: '#ef4444' }}>{expenseSaving ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (language === 'ar' ? 'تأكيد السحب' : 'Confirm withdrawal')}</button>
                    <button type="button" className="pos-btn-outline" style={{ flex: 1 }} onClick={() => setExpenseModalOpen(false)}>{language === 'ar' ? 'إلغاء' : 'Cancel'}</button>
                  </div>
                </form>
              </div>
            </motion.div>
          )}

          {/* Attendance Modal */}
          {attendanceModalOpen && (
            <motion.div 
              key="attendance_modal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.85)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10000,
                padding: '1rem',
                backdropFilter: 'blur(8px)',
                direction: language === 'ar' ? 'rtl' : 'ltr'
              }}
            >
              <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                style={{
                  background: 'var(--bg-card)',
                  border: '2px solid var(--gold-primary)',
                  borderRadius: '24px',
                  width: '100%',
                  maxWidth: '850px',
                  maxHeight: '90vh',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                  overflow: 'hidden'
                }}
              >
                {/* Modal Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 2rem', borderBottom: '1px solid var(--border-color)' }}>
                  <h3 style={{ color: 'var(--gold-primary)', fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>
                    {language === 'ar' ? 'سجل حضور وانصراف الموظفين' : 'Employee Attendance & Shift End'}
                  </h3>
                  <button 
                    onClick={() => {
                      playClickSound();
                      setAttendanceModalOpen(false);
                    }}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                  >
                    <X size={28} />
                  </button>
                </div>

                {/* Modal Body */}
                <div style={{ display: 'flex', flex: 1, minHeight: 0, overflowY: 'auto', padding: '2rem', gap: '2rem', flexWrap: 'wrap' }}>
                  {/* Left Column: Camera View */}
                  <div style={{ flex: '1 1 320px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
                    <div style={{ position: 'relative', width: '100%', maxWidth: '320px', height: '240px', background: 'var(--bg-dark)', borderRadius: '16px', overflow: 'hidden', border: '2px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {cameraError ? (
                        <div style={{ padding: '1rem', textAlign: 'center', color: '#ef4444' }}>{cameraError}</div>
                      ) : (
                        <>
                          <video 
                            ref={videoRef} 
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                            playsInline 
                            muted 
                          />
                          <div style={{ position: 'absolute', bottom: '10px', left: '10px', background: 'rgba(0,0,0,0.6)', color: 'var(--gold-primary)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ width: 8, height: 8, background: '#22c55e', borderRadius: '50%' }} />
                            {language === 'ar' ? 'البث المباشر نشط' : 'Live Camera Active'}
                          </div>
                        </>
                      )}
                      {/* Hidden Canvas for Frame Capture */}
                      <canvas ref={canvasRef} style={{ display: 'none' }} />
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', margin: 0 }}>
                      {language === 'ar' 
                        ? 'يرجى الوقوف أمام الكاميرا بوضوح قبل تسجيل الحضور أو الانصراف.' 
                        : 'Please stand clearly in front of the camera before checking in or out.'}
                    </p>
                  </div>

                  {/* Right Column: Employees List */}
                  <div style={{ flex: '1.2 1 350px', minHeight: 0, display: 'flex', flexDirection: 'column', gap: '1rem', overflow: 'hidden' }}>
                    {/* Search Bar */}
                    <div style={{ position: 'relative' }}>
                      <input 
                        type="text"
                        className="pos-input"
                        style={{ paddingLeft: '2.5rem', fontSize: '1rem' }}
                        placeholder={language === 'ar' ? 'بحث باسم الموظف أو رقم الهاتف...' : 'Search employee by name or phone...'}
                        value={searchEmployeeQuery}
                        onChange={(e) => setSearchEmployeeQuery(e.target.value)}
                      />
                      <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    </div>

                    {/* Scrollable list */}
                    <div style={{ flex: 1, minHeight: 0, maxHeight: '62vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.8rem', paddingRight: '4px' }}>
                      {employeesList
                        .filter(emp => {
                          const q = searchEmployeeQuery.toLowerCase();
                          return emp.name.toLowerCase().includes(q) || (emp.phone && emp.phone.includes(q));
                        })
                        .map(emp => {
                          const todayStr = getLocalDayStr();
                          
                          // Check if they are currently checked in (active)
                          const activeLog = attendanceLogsList.find(l => l.employee_id === emp.id && l.date === todayStr && !l.check_out_time);
                          
                          // Check if they already completed a shift today
                          const completedLog = attendanceLogsList.find(l => l.employee_id === emp.id && l.date === todayStr && l.check_out_time);

                          return (
                            <div key={emp.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card-hover)', border: '1px solid var(--border-color)', padding: '1rem', borderRadius: '12px', transition: 'all 0.2s' }}>
                              <div>
                                <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-white)', fontWeight: 'bold' }}>{emp.name}</h4>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{emp.phone || '-'}</span>
                              </div>

                              <div>
                                {activeLog ? (
                                  <button 
                                    className="pos-btn"
                                    disabled={Boolean(attendanceActionInFlight[`${emp.id}:check-out`])}
                                    onClick={() => handleAttendanceAction(emp, false)}
                                    style={{ background: '#ef4444', borderColor: '#ef4444', color: 'var(--text-white)', padding: '0.5rem 1rem', fontSize: '0.9rem', borderRadius: '8px', opacity: attendanceActionInFlight[`${emp.id}:check-out`] ? 0.6 : 1, cursor: attendanceActionInFlight[`${emp.id}:check-out`] ? 'wait' : 'pointer' }}
                                  >
                                    {attendanceActionInFlight[`${emp.id}:check-out`] ? (language === 'ar' ? 'جاري التسجيل…' : 'Saving…') : (language === 'ar' ? 'تسجيل انصراف 🔴' : 'Check Out 🔴')}
                                  </button>
                                ) : completedLog ? (
                                  <span style={{ color: '#22c55e', fontWeight: 'bold', fontSize: '0.9rem', background: 'rgba(34,197,94,0.1)', padding: '6px 12px', borderRadius: '8px' }}>
                                    {language === 'ar' ? 'تم إنهاء الوردية ✓' : 'Shift Ended ✓'}
                                  </span>
                                ) : (
                                  <button 
                                    className="pos-btn"
                                    disabled={Boolean(attendanceActionInFlight[`${emp.id}:check-in`])}
                                    onClick={() => handleAttendanceAction(emp, true)}
                                    style={{ padding: '0.5rem 1rem', fontSize: '0.9rem', borderRadius: '8px', opacity: attendanceActionInFlight[`${emp.id}:check-in`] ? 0.6 : 1, cursor: attendanceActionInFlight[`${emp.id}:check-in`] ? 'wait' : 'pointer' }}
                                  >
                                    {attendanceActionInFlight[`${emp.id}:check-in`] ? (language === 'ar' ? 'جاري التسجيل…' : 'Saving…') : (language === 'ar' ? 'تسجيل حضور 🟢' : 'Check In 🟢')}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}

                      {employeesList.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                          {language === 'ar' ? 'لا يوجد موظفون مسجلون في النظام حالياً.' : 'No employees registered in the system yet.'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* OTP verification Modal */}
          {otpModalOpen && (
            <motion.div 
              key="otp_modal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.85)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10000,
                padding: '1rem',
                backdropFilter: 'blur(8px)',
                direction: language === 'ar' ? 'rtl' : 'ltr'
              }}
            >
              <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                style={{
                  background: 'var(--bg-card)',
                  border: '2px solid var(--gold-primary)',
                  borderRadius: '20px',
                  width: '100%',
                  maxWidth: '400px',
                  padding: '2rem',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                  textAlign: 'center'
                }}
              >
                <h3 style={{ color: 'var(--gold-primary)', fontSize: '1.4rem', fontWeight: 'bold', marginBottom: '1rem' }}>
                  {language === 'ar' ? 'تأكيد رمز الأمان (OTP)' : 'OTP Security Verification'}
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                  {language === 'ar' 
                    ? `يرجى إدخال رمز التحقق المرسل إلى تليجرام لإتمام إجراء: ${otpActionName}` 
                    : `Please enter the verification code sent to Telegram to complete: ${otpActionName}`}
                </p>

                <input 
                  type="text"
                  className="pos-input"
                  style={{ fontSize: '1.8rem', letterSpacing: '4px', textAlign: 'center', fontWeight: 'bold', color: 'var(--gold-primary)', marginBottom: '1.5rem' }}
                  placeholder="------"
                  maxLength={6}
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                />

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button 
                    className="pos-btn" 
                    style={{ flex: 1, padding: '0.8rem' }}
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
                    className="pos-btn-outline" 
                    style={{ flex: 1, padding: '0.8rem' }}
                    onClick={() => {
                      setOtpModalOpen(false);
                      setOtpAction(null);
                    }}
                  >
                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Prepared Order Notifications Toast */}
      <div style={{ position: 'fixed', bottom: '20px', left: '20px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <AnimatePresence>
          {preparedNotifications.map((notif, idx) => (
            <motion.div 
              key={`${notif.id}-${idx}`}
              initial={{ opacity: 0, x: -50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -50, scale: 0.9 }}
              style={{
                background: '#9b59b6', color: 'var(--text-white)', padding: '15px 20px', borderRadius: '12px',
                boxShadow: '0 8px 30px rgba(155,89,182,0.4)', display: 'flex', alignItems: 'center', gap: '15px', minWidth: '300px'
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                  {language === 'ar' ? 'تم تحضير الأوردر!' : 'Order Prepared!'}
                </div>
                <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>
                  {language === 'ar' 
                    ? `الأوردر جاهز للتسليم بواسطة الكابتن: ${notif.waiter_name || 'Guest'}` 
                    : `Order ready for delivery by Captain: ${notif.waiter_name || 'Guest'}`}
                </div>
              </div>
              <button 
                onClick={() => setPreparedNotifications(prev => prev.filter((_, i) => i !== idx))}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-white)', cursor: 'pointer', padding: '5px' }}
              >
                X
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

    </div>
  );
};





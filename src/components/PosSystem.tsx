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
  Bell, Sun, Moon
} from 'lucide-react';
import { db } from '../lib/supabase';
import type { Category, Product, Order, OrderItem, SystemUser, Printer, RestaurantSettings, Customer, Employee, AttendanceLog, InventoryItem, ProductRecipe } from '../types';
import { printOrderTickets, printCustomerReceipt } from '../utils/printUtils';
import { taxPercentForOrder } from '../utils/tax';
import { drawerOfHall, drawerName } from '../utils/shiftClosing';
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

type PosView = 'role_select' | 'waiter_auth' | 'customer_info' | 'order_type' | 'menu' | 'checkout' | 'success' | 'waiter_dashboard' | 'waiter_order_edit';

export const PosSystem: React.FC<PosSystemProps> = ({ onClose, language, setLanguage }) => {
  // Global Data
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [waiters, setWaiters] = useState<SystemUser[]>([]);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
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

  const [view, setView] = useState<PosView>('role_select');
  const [role, setRole] = useState<'waiter' | 'customer' | null>(null);
  const [mobileShowCart, setMobileShowCart] = useState(false);
  const [posDepartment, setPosDepartment] = useState<'restaurant'|'bar'>('restaurant');
  
  // Waiter Auth & Dashboard
  const [selectedWaiter, setSelectedWaiter] = useState<SystemUser | null>(null);
  const [waiterPasscode, setWaiterPasscode] = useState('');
  const [viewAllOrders, setViewAllOrders] = useState(false);

  // Attendance System State
  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);
  const [employeesList, setEmployeesList] = useState<Employee[]>([]);
  const [attendanceLogsList, setAttendanceLogsList] = useState<AttendanceLog[]>([]);
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
  
  // Payment and Customers
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Menu & Cart
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [cart, setCart] = useState<OrderItem[]>([]);

  // Waiting/Delivered states, Payment and Transfer states
  const [originalOrderItems, setOriginalOrderItems] = useState<OrderItem[]>([]);
  const [collectPaymentOrder, setCollectPaymentOrder] = useState<Order | null>(null);
  const [payCash, setPayCash] = useState<number | ''>('');
  const [payVisa, setPayVisa] = useState<number | ''>('');
  const [payWalletRestaurant, setPayWalletRestaurant] = useState<number | ''>('');
  const [payWalletBar, setPayWalletBar] = useState<number | ''>('');

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
      const originalPrice = collectPaymentOrder.total_price;
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
  const [transferQty, setTransferQty] = useState<number>(1);
  
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

  const loadData = async () => {
    const [cats, prods, users, ords, prnts, sets, custs, emps, atts, invItems, prodRecipes] = await Promise.all([
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
      db.getProductRecipes()
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
    setActiveOrders(ords.filter(o => o.status === 'pending' || o.status === 'preparing' || o.status === 'prepared' || o.status === 'delivered'));
    setPrinters(prnts);
    setSettings(sets);
    setCustomers(custs);
    setEmployeesList(emps);
    setAttendanceLogsList(atts);
    setInventoryItems(invItems || []);
    setProductRecipes(prodRecipes || []);
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
    if (!canvasRef.current || !videoRef.current) {
      alert(language === 'ar' ? 'الكاميرا غير جاهزة!' : 'Camera not ready!');
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

  const getVisibleProducts = () => {
    return products.filter(p => {
      if (!p.is_available) return false;
      if (p.category_id !== activeCategory) return false;
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
      const existing = prev.find(item => item.id === p.id);
      if (existing) {
        return prev.map(item => item.id === p.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { id: p.id, name_ar: p.name_ar, name_en: p.name_en, price, quantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => setCart(prev => prev.filter(item => item.id !== id));
  
  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQ = item.quantity + delta;
        return newQ > 0 ? { ...item, quantity: newQ } : item;
      }
      return item;
    }));
  };

  const cartSubtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const hallTaxPercent = staffOrderFor ? 0 : taxPercentForOrder(settings, orderType, selectedHall);
  const cartTaxAmount = cartSubtotal * (hallTaxPercent / 100);
  const cartTotal = staffOrderFor ? 0 : (cartSubtotal + cartTaxAmount);

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

  const placeOrder = async () => {
    if (cart.length === 0) return;
    
    if (editOrderId && editingOrder) {
      // Detect deletions and cancellation/reduction of quantities
      let deletedItemsText = '';
      originalOrderItems.forEach(orig => {
        const currentItem = cart.find(c => c.id === orig.id);
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
        total_price: cartTotal,
        customer_name: customerName,
        customer_phone: customerPhone,
        table_number: tableNumber,
        order_type: orderType || editingOrder.order_type
      }, selectedWaiter?.name);

      // احسب الأصناف الجديدة فقط (صنف جديد أو زيادة كمية) واطبعها للمطبخ/البار — من غير إعادة طباعة الأوردر كله
      const addedItems = cart.map(ci => {
        const orig = originalOrderItems.find(o => o.id === ci.id);
        const addedQty = orig ? ci.quantity - orig.quantity : ci.quantity;
        return addedQty > 0 ? { ...ci, quantity: addedQty } : null;
      }).filter((i): i is OrderItem => i !== null);

      if (addedItems.length > 0) {
        const additionOrder = { ...(updatedOrder || editingOrder), id: editOrderId, items: addedItems } as Order;
        printOrderTickets(additionOrder, categories, products, printers, language, settings, { isAddition: true });
      }

      setLastPlacedOrder(updatedOrder);
      setCart([]);
      setEditOrderId(null);
      setEditingOrder(null);
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
      customer_name: customerName || 'Guest',
      customer_phone: customerPhone || 'N/A',
      table_number: tableNumber || '-',
      hall: orderType === 'dine_in' && selectedHall ? selectedHall : undefined,
      // طلبات الصالة بتاخد خزنة الصالة أوتوماتيك — غير كده الكاشير بيختار وقت التحصيل
      drawer: orderType === 'dine_in' && selectedHall ? drawerOfHall(selectedHall, settings) : undefined,
      items: cart,
      // طلب الاستاف مجاني: الإجمالي صفر، والقيمة الحقيقية بتتحفظ في payment_details للتقارير
      total_price: staffOrderFor ? 0 : cartTotal,
      status: 'pending',
      order_type: orderType || 'takeaway',
      waiter_id: assignedWaiterId,
      waiter_name: assignedWaiterName,
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
        if (item.id === transferItem.id) {
          return { ...item, quantity: item.quantity - transferQty };
        }
        return item;
      }).filter(item => item.quantity > 0);

      const sourceTotal = sourceItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      // 2. Add to target order
      const targetItems = [...targetOrder.items];
      const existingItemIdx = targetItems.findIndex(item => item.id === transferItem.id);
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

      const targetTotal = targetItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

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

  return (
    <div className="pos-fullscreen">
      <style>{`
        .pos-fullscreen {
          position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
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
          flex: 1; display: flex; position: relative; overflow: hidden;
        }
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
          flex: 1; padding: 2rem; overflow-y: auto;
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
          width: 350px; background: var(--bg-card); border-left: 1px solid var(--border-color);
          display: flex; flex-direction: column;
        }

        /* Responsive Mobile Styles */
        @media (max-width: 768px) {
          .pos-header {
            padding: 1rem;
          }
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
          }
          
          /* Menu View on Mobile */
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
            padding: 1rem !important;
            grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)) !important;
            gap: 1rem !important;
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
        <div style={{ position: 'absolute', top: '1rem', left: '1rem', right: '1rem', display: 'flex', justifyContent: 'space-between', zIndex: 100 }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
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
          <button onClick={handleClose} style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', color: 'var(--text-white)', padding: '0.5rem', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px' }}>
            <X size={24} />
          </button>
        </div>

        <AnimatePresence mode="wait">
          
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
                <div className={`option-card ${orderType === 'takeaway' ? 'active' : ''}`} onClick={() => setOrderType('takeaway')}>
                  <ShoppingBag size={48} /><h3>{t.takeaway}</h3>
                </div>
                <div className={`option-card ${orderType === 'dine_in' ? 'active' : ''}`} onClick={() => setOrderType('dine_in')}>
                  <Utensils size={48} /><h3>{t.dineIn}</h3>
                </div>
                <div className={`option-card ${orderType === 'delivery' ? 'active' : ''}`} onClick={() => setOrderType('delivery')}>
                  <ArrowRight size={48} /><h3>{t.delivery}</h3>
                </div>
                <div className={`option-card ${orderType === 'talabat' ? 'active' : ''}`} onClick={() => setOrderType('talabat')}>
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
                  {(settings?.halls && settings.halls.length > 0) && (
                    <div style={{ marginBottom: '1.5rem' }}>
                      <h3 style={{ marginBottom: '1rem' }}>{language === 'ar' ? 'اختر الصالة' : 'Select Hall'}</h3>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center' }}>
                        {settings.halls.map((h, i) => (
                          <button key={i} type="button" onClick={() => setSelectedHall(h.name)}
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
                  {(!settings?.halls || settings.halls.length === 0 || selectedHall) && (
                    <div>
                      <h3 style={{ marginBottom: '0.75rem' }}>{t.tableNum}</h3>
                      <input type="text" className="pos-input" style={{ maxWidth: '200px' }} value={tableNumber} onChange={e => setTableNumber(e.target.value)} placeholder="e.g. 5" />
                    </div>
                  )}
                </motion.div>
              )}

              <div style={{ display: 'flex', gap: '1rem', marginTop: '3rem' }}>
                <button className="pos-btn-outline" onClick={() => setView('customer_info')}>{t.back}</button>
                <button className="pos-btn" disabled={!orderType || (orderType === 'dine_in' && (!tableNumber || ((settings?.halls?.length ?? 0) > 0 && !selectedHall)))} onClick={() => setView('menu')}>{t.continue}</button>
              </div>
            </motion.div>
          )}

          {view === 'menu' && (
            <motion.div key="menu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ width: '100%', display: 'flex', paddingTop: '3.75rem' }}>
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
              <div className="pos-products">
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
                    {cart.map(item => {
                      const originalItem = originalOrderItems.find(o => o.id === item.id);
                      const isOriginal = originalItem !== undefined;
                      const minQuantity = originalItem ? originalItem.quantity : 1;
                      const cannotDecrease = isOriginal && item.quantity <= minQuantity;

                      return (
                        <motion.div key={item.id} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.8 }}
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
                                onClick={(e) => { e.stopPropagation(); updateQuantity(item.id, -1); }} 
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
                              <button onClick={(e) => { e.stopPropagation(); updateQuantity(item.id, 1); }} style={{ background: 'var(--gold-primary)', border: 'none', color: '#000', width: '32px', height: '32px', borderRadius: '6px', cursor: 'pointer' }}><Plus size={16} /></button>
                            </div>
                            
                            {!isOriginal ? (
                              <button onClick={(e) => { e.stopPropagation(); removeFromCart(item.id); }} style={{ background: 'rgba(239, 68, 68, 0.1)', border: 'none', color: '#ef4444', padding: '6px', borderRadius: '6px', cursor: 'pointer' }}>
                                <Trash2 size={18} />
                              </button>
                            ) : (
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>{language === 'ar' ? 'مؤكد' : 'Confirmed'}</span>
                            )}
                          </div>
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
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', margin: '0.3rem 0' }}>
                      <span>{item.quantity}x {language === 'ar' ? item.name_ar : item.name_en}</span>
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
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button className="pos-btn" onClick={() => { setCustomerPhone(''); setCustomerName(''); setTableNumber(''); setSelectedHall(''); setOrderType(null); setCart([]); setView('customer_info'); }}>
                    {t.newOrder}
                  </button>
                  <button className="pos-btn-outline" onClick={async () => {
                    if (selectedWaiter) {
                      try {
                        await db.updateWaiterActiveStatus(selectedWaiter.id, false);
                      } catch (e) {}
                    }
                    localStorage.removeItem('meridien_active_pos_waiter');
                    setSelectedWaiter(null);
                    setWaiterPasscode('');
                    setRole('waiter');
                    setView('waiter_auth');
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
                        <div style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>{order.customer_name}</div>
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
                          
                          {order.status === 'delivered' && order.payment_method === 'staff' ? (
                            /* طلب استاف: مفيش تحصيل — إنهاء مباشر (بيخصم المخزون) */
                            <button className="pos-btn" style={{ padding: '0.5rem', fontSize: '0.9rem', flex: 1, background: '#38bdf8', color: '#000' }} onClick={async () => {
                              playClickSound();
                              try {
                                await db.updateOrderStatus(order.id, 'completed', selectedWaiter?.name);
                                printCustomerReceipt(order, language, settings);
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
                              printCustomerReceipt(order, language, settings, { preBill: true });
                            }}>{language === 'ar' ? 'طباعة الفاتورة' : 'Print Bill'}</button>
                            <button className="pos-btn" style={{ padding: '0.5rem', fontSize: '0.9rem', flex: 1, background: '#2ecc71', color: '#000' }} onClick={() => {
                              setCollectPaymentOrder(order);
                              setPayCash('');
                              setPayVisa('');
                              setPayWalletRestaurant('');
                        setPayWalletBar('');

                              setPayInstapay('');
                              setPayIsDeferred(false);
                              setPayCustomerId(order.customer_id || '');
                              // الصالة بتحدد خزنتها لوحدها — غير كده بنبدأ بخزنة 1 والكاشير يغيّر
                              setPayDrawer(order.drawer || (order.hall ? drawerOfHall(order.hall, settings) : 1));
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
                      setView('menu');
                    }}>
                      <Plus size={16} style={{ display: 'inline', marginRight: '4px' }}/> 
                      {language === 'ar' ? 'إضافة/تعديل أصناف' : 'Add/Edit Items'}
                    </button>
                  </div>
                  <div style={{ background: 'var(--bg-darker)', padding: '1rem', borderRadius: '8px' }}>
                    {editingOrder.items.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: idx === editingOrder.items.length - 1 ? 'none' : '1px solid var(--border-color)' }}>
                        <span>{item.quantity}x {language === 'ar' ? item.name_ar : item.name_en}</span>
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
                      {collectPaymentOrder.total_price.toFixed(2)} EGP
                    </span>
                  </div>
                  {/* طباعة الفاتورة للعميل يشوفها قبل ما يدفع */}
                  <button
                    className="pos-btn-outline"
                    style={{ width: '100%', marginTop: '1rem', padding: '0.6rem', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                    onClick={() => {
                      playClickSound();
                      printCustomerReceipt(collectPaymentOrder, language, settings, { preBill: true });
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
                    {([1, 2] as const).map(d => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => { playClickSound(); setPayDrawer(d); }}
                        style={{
                          flex: 1, padding: '0.9rem', borderRadius: '12px', cursor: 'pointer',
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
                    <input 
                      type="number"
                      className="pos-input"
                      placeholder="0.00"
                      value={payCash}
                      onChange={(e) => setPayCash(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      min="0"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      💳 {language === 'ar' ? 'فيزا / كارت:' : 'Visa / Card:'}
                    </label>
                    <input 
                      type="number"
                      className="pos-input"
                      placeholder="0.00"
                      value={payVisa}
                      onChange={(e) => setPayVisa(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      min="0"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      📱 {language === 'ar' ? 'محفظة المطعم:' : 'Restaurant Wallet:'}

                    </label>
                    <input
                      type="number"
                      className="pos-input"
                      placeholder="0.00"
                      value={payWalletRestaurant}
                      onChange={(e) => setPayWalletRestaurant(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      min="0"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      📱 {language === 'ar' ? 'محفظة البار:' : 'Bar Wallet:'}
                    </label>
                    <input 
                      type="number"
                      className="pos-input"
                      placeholder="0.00"
                      value={payWalletBar}
                      onChange={(e) => setPayWalletBar(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      min="0"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      🍸 {language === 'ar' ? 'محفظة البار:' : 'Bar Wallet:'}
                    </label>
                    <input
                      type="number"
                      className="pos-input"
                      placeholder="0.00"
                      value={payWalletBar}
                      onChange={(e) => setPayWalletBar(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      min="0"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      ⚡ {language === 'ar' ? 'إنستا باي:' : 'InstaPay:'}
                    </label>
                    <input 
                      type="number"
                      className="pos-input"
                      placeholder="0.00"
                      value={payInstapay}
                      onChange={(e) => setPayInstapay(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      min="0"
                    />
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
                  const walletRestaurantVal = Number(payWalletRestaurant) || 0;
                  const walletBarVal = Number(payWalletBar) || 0;
                  const instapayVal = Number(payInstapay) || 0;
                  const totalPaid = cashVal + visaVal + walletRestaurantVal + walletBarVal + instapayVal;

                  const remaining = collectPaymentOrder.total_price - totalPaid;

                  let statusText = '';
                  let isError = false;
                  let canSubmit = false;

                  if (Math.abs(remaining) < 0.01) {
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
                                walletRestaurantVal > 0 && 'wallet_restaurant',
                                walletBarVal > 0 && 'wallet_bar',

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
                                wallet_restaurant: walletRestaurantVal,
                                wallet_bar: walletBarVal,

                                instapay: instapayVal,
                                deferred: remaining > 0.01 && payIsDeferred ? remaining : 0,
                                customer_id: remaining > 0.01 && payIsDeferred ? payCustomerId : undefined
                              };

                              const paidOrder = await db.updateOrder(collectPaymentOrder.id, {
                                status: 'completed',
                                payment_method: finalMethod,
                                payment_details: paymentDetails,
                                drawer: payDrawer, // الخزنة اللي اتحصّل فيها — عليها بيتم التقفيل
                                customer_id: payCustomerId || collectPaymentOrder.customer_id
                              }, selectedWaiter?.name);

                              // طباعة فاتورة العميل تلقائي عند الدفع
                              printCustomerReceipt(paidOrder || ({ ...collectPaymentOrder, status: 'completed', payment_method: finalMethod, payment_details: paymentDetails } as any), language, settings);

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
                                   payment_details: { type: 'hospitality', original_price: collectPaymentOrder.total_price }
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
                      <b style={{ color: '#fff' }}>{collectPaymentOrder.total_price.toFixed(2)} EGP</b>
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
                                    style={{ background: '#ef4444', borderColor: '#ef4444', color: 'var(--text-white)', padding: '0.5rem 1rem', fontSize: '0.9rem', borderRadius: '8px' }}
                                    onClick={() => handleAttendanceAction(emp, false)}
                                  >
                                    {language === 'ar' ? 'تسجيل انصراف 🔴' : 'Check Out 🔴'}
                                  </button>
                                ) : completedLog ? (
                                  <span style={{ color: '#22c55e', fontWeight: 'bold', fontSize: '0.9rem', background: 'rgba(34,197,94,0.1)', padding: '6px 12px', borderRadius: '8px' }}>
                                    {language === 'ar' ? 'تم إنهاء الوردية ✓' : 'Shift Ended ✓'}
                                  </span>
                                ) : (
                                  <button 
                                    className="pos-btn"
                                    style={{ padding: '0.5rem 1rem', fontSize: '0.9rem', borderRadius: '8px' }}
                                    onClick={() => handleAttendanceAction(emp, true)}
                                  >
                                    {language === 'ar' ? 'تسجيل حضور 🟢' : 'Check In 🟢'}
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

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShoppingBag, Utensils, CheckCircle, X, 
  Plus, Minus, Trash2, ArrowRight, Printer as PrinterIcon,
  Pizza, Coffee, ChefHat, Wine, Cake
} from 'lucide-react';
import { db } from '../lib/supabase';
import type { Category, Product, Order, OrderItem, SystemUser, Printer, RestaurantSettings } from '../types';
import { printOrderTickets } from '../utils/printUtils';

interface PosSystemProps {
  onClose: () => void;
  language: 'ar' | 'en';
}

type PosView = 'role_select' | 'waiter_auth' | 'customer_info' | 'order_type' | 'menu' | 'checkout' | 'success' | 'waiter_dashboard' | 'waiter_order_edit';

export const PosSystem: React.FC<PosSystemProps> = ({ onClose, language }) => {
  // Global Data
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [waiters, setWaiters] = useState<SystemUser[]>([]);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [lastPlacedOrder, setLastPlacedOrder] = useState<Order | null>(null);

  // POS State
  const [view, setView] = useState<PosView>('role_select');
  const [role, setRole] = useState<'waiter' | 'customer' | null>(null);
  
  // Waiter Auth & Dashboard
  const [selectedWaiter, setSelectedWaiter] = useState<SystemUser | null>(null);
  const [waiterPasscode, setWaiterPasscode] = useState('');
  const [viewAllOrders, setViewAllOrders] = useState(false);
  
  // Order Session Details
  const [editOrderId, setEditOrderId] = useState<string | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [orderType, setOrderType] = useState<'takeaway' | 'talabat' | 'dine_in' | 'delivery' | null>(null);
  const [tableNumber, setTableNumber] = useState('');
  
  // Menu & Cart
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [cart, setCart] = useState<OrderItem[]>([]);
  
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [cats, prods, users, ords, prnts, sets] = await Promise.all([
      db.getCategories(),
      db.getProducts(),
      db.getSystemUsers(),
      db.getOrders(),
      db.getPrinters(),
      db.getSettings()
    ]);
    setCategories(cats.sort((a, b) => a.sort_order - b.sort_order));
    setProducts(prods);
    setWaiters(users.filter(u => u.role === 'waiter'));
    setActiveOrders(ords.filter(o => o.status === 'pending' || o.status === 'preparing'));
    setPrinters(prnts);
    setSettings(sets);
    if (cats.length > 0) setActiveCategory(cats[0].id);
  };

  const handleClose = () => {
    if (view === 'role_select') {
      onClose();
    } else {
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

  const handleWaiterLogin = () => {
    if (selectedWaiter && selectedWaiter.passcode === waiterPasscode) {
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

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const placeOrder = async () => {
    if (cart.length === 0) return;
    
    if (editOrderId && editingOrder) {
      // We are editing an existing order
      const updatedOrder = await db.updateOrder(editOrderId, {
        items: cart,
        total_price: cartTotal,
        customer_name: customerName,
        customer_phone: customerPhone,
        table_number: tableNumber,
        order_type: orderType || editingOrder.order_type
      });
      setLastPlacedOrder(updatedOrder);
      setCart([]);
      setEditOrderId(null);
      setEditingOrder(null);
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
      items: cart,
      total_price: cartTotal,
      status: 'pending',
      order_type: orderType || 'takeaway',
      waiter_id: assignedWaiterId,
      waiter_name: assignedWaiterName,
      created_at: new Date().toISOString()
    };
    
    const placedOrder = await db.addOrder(newOrder);
    setLastPlacedOrder(placedOrder);
    setCart([]);
    setView('success');
    loadData();
    
    // Auto-print tickets for kitchen/bar
    printOrderTickets(placedOrder, categories, products, printers, language);
  };

  return (
    <div className="pos-fullscreen">
      <style>{`
        .pos-fullscreen {
          position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
          background: #000; color: #fff; z-index: 99999;
          display: flex; flex-direction: column;
          font-family: 'Cairo', 'Inter', sans-serif;
          overflow: hidden;
        }
        .pos-header {
          display: flex; justify-content: space-between; padding: 1rem 2rem;
          background: #111; border-bottom: 2px solid var(--gold-primary);
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
          background: #222; border: 2px solid #333; color: #fff;
          padding: 1rem; border-radius: 12px; font-size: 1.2rem; width: 100%;
          text-align: center; outline: none; transition: border-color 0.3s;
        }
        .pos-input:focus { border-color: var(--gold-primary); }
        .grid-options {
          display: grid; grid-template-columns: repeat(2, 1fr);
          gap: 1.5rem; width: 100%; max-width: 600px; margin: 0 auto;
        }
        .option-card {
          background: #1a1a1a; border: 2px solid #333; border-radius: 16px;
          padding: 2rem; text-align: center; cursor: pointer;
          transition: all 0.3s; display: flex; flex-direction: column; align-items: center; gap: 1rem;
        }
        .option-card:hover, .option-card.active {
          border-color: var(--gold-primary); background: rgba(212, 175, 55, 0.05);
          transform: translateY(-5px);
        }
        .pos-menu-sidebar {
          width: 250px; background: #111; overflow-y: auto; border-right: 1px solid #333;
        }
        .pos-cat-item {
          padding: 1.5rem; cursor: pointer; border-bottom: 1px solid #222;
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
          background: #1a1a1a; border-radius: 16px; overflow: hidden;
          cursor: pointer; border: 2px solid transparent; transition: 0.2s;
          display: flex; flex-direction: column;
        }
        .pos-product-card:active { transform: scale(0.95); }
        .pos-product-img { width: 100%; height: 160px; object-fit: cover; }
        .pos-cart-panel {
          width: 350px; background: #111; border-left: 1px solid #333;
          display: flex; flex-direction: column;
        }
      `}</style>

      <div className="pos-header">
        <h1 style={{ color: 'var(--gold-primary)', margin: 0 }}>MERIDIEN POS</h1>
        <button onClick={handleClose} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}>
          <X size={32} />
        </button>
      </div>

      <div className="pos-content" dir={language === 'ar' ? 'rtl' : 'ltr'}>
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
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="option-card" onClick={() => { setRole('customer'); setView('customer_info'); }} style={{ background: 'rgba(26,26,26,0.8)', backdropFilter: 'blur(10px)', border: '1px solid rgba(212,175,55,0.2)', boxShadow: '0 15px 35px rgba(0,0,0,0.5)', padding: '3rem 2rem' }}>
                  <ShoppingBag size={56} color="var(--gold-primary)" />
                  <h3 style={{ fontSize: '1.8rem', margin: '1rem 0' }}>{t.iamCustomer}</h3>
                  <p style={{ color: 'var(--text-gray)', fontSize: '1rem' }}>
                    {language === 'ar' ? 'قم بإنشاء طلبك الخاص من المنيو' : 'Create your own order from the menu'}
                  </p>
                </motion.div>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="option-card" onClick={() => { setRole('waiter'); setView('waiter_auth'); }} style={{ background: 'rgba(26,26,26,0.8)', backdropFilter: 'blur(10px)', border: '1px solid rgba(212,175,55,0.2)', boxShadow: '0 15px 35px rgba(0,0,0,0.5)', padding: '3rem 2rem' }}>
                  <Utensils size={56} color="var(--gold-primary)" />
                  <h3 style={{ fontSize: '1.8rem', margin: '1rem 0' }}>{t.iamWaiter}</h3>
                  <p style={{ color: 'var(--text-gray)', fontSize: '1rem' }}>
                    {language === 'ar' ? 'تسجيل الدخول للكباتن والويترز' : 'Login for Captains & Waiters'}
                  </p>
                </motion.div>
              </div>
              </div>
            </motion.div>
          )}

          {view === 'waiter_auth' && (
            <motion.div key="w_auth" initial={{ opacity: 0, x: 100 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -100 }} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
              <h2 style={{ fontSize: '2rem', marginBottom: '2rem', color: 'var(--gold-primary)' }}>{t.selectWaiter}</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.5rem', width: '100%', maxWidth: '800px', margin: '0 auto 3rem auto' }}>
                {waiters.map(w => (
                  <div 
                    key={w.id} 
                    onClick={() => setSelectedWaiter(w)}
                    style={{ 
                      background: selectedWaiter?.id === w.id ? 'linear-gradient(45deg, var(--gold-dark), var(--gold-primary))' : '#1a1a1a',
                      color: selectedWaiter?.id === w.id ? '#000' : '#fff',
                      border: selectedWaiter?.id === w.id ? '2px solid transparent' : '2px solid #333',
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
                    <div style={{ background: '#222', padding: '2rem', borderRadius: '16px', border: '1px solid #333' }}>
                      <h3 style={{ textAlign: 'center', marginBottom: '1.5rem', color: 'var(--gold-primary)' }}>
                        {language === 'ar' ? `مرحباً كابتن ${selectedWaiter.name}` : `Welcome Capt. ${selectedWaiter.name}`}
                      </h3>
                      <input type="password" placeholder={t.enterPasscode} className="pos-input" style={{ marginBottom: '1.5rem', background: '#111', fontSize: '1.5rem', letterSpacing: '0.5rem' }} value={waiterPasscode} onChange={e => setWaiterPasscode(e.target.value)} />
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
              </div>

              {orderType === 'dine_in' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginTop: '2rem', textAlign: 'center' }}>
                  <h3>{t.tableNum}</h3>
                  <input type="text" className="pos-input" style={{ maxWidth: '200px' }} value={tableNumber} onChange={e => setTableNumber(e.target.value)} placeholder="e.g. 5" />
                </motion.div>
              )}

              <div style={{ display: 'flex', gap: '1rem', marginTop: '3rem' }}>
                <button className="pos-btn-outline" onClick={() => setView('customer_info')}>{t.back}</button>
                <button className="pos-btn" disabled={!orderType || (orderType === 'dine_in' && !tableNumber)} onClick={() => setView('menu')}>{t.continue}</button>
              </div>
            </motion.div>
          )}

          {view === 'menu' && (
            <motion.div key="menu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ width: '100%', display: 'flex' }}>
              <div className="pos-menu-sidebar">
                {categories.map(cat => (
                  <div key={cat.id} className={`pos-cat-item ${activeCategory === cat.id ? 'active' : ''}`} onClick={() => setActiveCategory(cat.id)}>
                    {language === 'ar' ? cat.name_ar : cat.name_en}
                  </div>
                ))}
              </div>
              <div className="pos-products">
                {getVisibleProducts().map(p => (
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} key={p.id} className="pos-product-card" onClick={() => addToCart(p)}>
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name_en} className="pos-product-img" />
                    ) : (
                      <div className="pos-product-img" style={{ background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Utensils size={40} color="#666" /></div>
                    )}
                    <div style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>{language === 'ar' ? p.name_ar : p.name_en}</h4>
                      <div style={{ color: 'var(--gold-primary)', fontWeight: 'bold', fontSize: '1.2rem' }}>
                        {getProductPrice(p).toFixed(2)} EGP
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
              <div className="pos-cart-panel">
                <div style={{ padding: '1.5rem', borderBottom: '1px solid #333' }}>
                  <h2 style={{ margin: 0, color: 'var(--gold-primary)' }}>{t.cart}</h2>
                  <p style={{ margin: '0.5rem 0 0 0', color: '#aaa', fontSize: '0.9rem' }}>
                    {orderType?.toUpperCase()} {tableNumber && `- Table ${tableNumber}`}
                  </p>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
                  {cart.length === 0 && <p style={{ textAlign: 'center', color: '#666', marginTop: '2rem' }}>Empty</p>}
                  <AnimatePresence>
                    {cart.map(item => (
                      <motion.div key={item.id} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.8 }}
                        style={{ background: '#1a1a1a', padding: '1rem', borderRadius: '12px', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 'bold' }}>{language === 'ar' ? item.name_ar : item.name_en}</span>
                          <span style={{ color: 'var(--gold-primary)' }}>{(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#000', padding: '4px', borderRadius: '8px' }}>
                            <button onClick={(e) => { e.stopPropagation(); updateQuantity(item.id, -1); }} style={{ background: '#333', border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '6px', cursor: 'pointer' }}><Minus size={16} /></button>
                            <span style={{ fontWeight: 'bold', minWidth: '20px', textAlign: 'center' }}>{item.quantity}</span>
                            <button onClick={(e) => { e.stopPropagation(); updateQuantity(item.id, 1); }} style={{ background: 'var(--gold-primary)', border: 'none', color: '#000', width: '32px', height: '32px', borderRadius: '6px', cursor: 'pointer' }}><Plus size={16} /></button>
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); removeFromCart(item.id); }} style={{ background: 'rgba(239, 68, 68, 0.1)', border: 'none', color: '#ef4444', padding: '6px', borderRadius: '6px', cursor: 'pointer' }}>
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
                <div style={{ padding: '1.5rem', background: '#1a1a1a', borderTop: '1px solid #333' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>
                    <span>{t.total}</span>
                    <span style={{ color: 'var(--gold-primary)' }}>{cartTotal.toFixed(2)} EGP</span>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="pos-btn-outline" style={{ flex: 1, padding: '1rem' }} onClick={() => setView('order_type')}>{t.back}</button>
                    <button className="pos-btn" style={{ flex: 2 }} disabled={cart.length === 0} onClick={() => setView('checkout')}>{t.checkout}</button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'checkout' && (
            <motion.div key="checkout" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <h2 style={{ fontSize: '3rem', color: 'var(--gold-primary)' }}>{cartTotal.toFixed(2)} EGP</h2>
              <p style={{ fontSize: '1.2rem', color: '#aaa', marginBottom: '3rem' }}>
                {orderType?.toUpperCase()} {tableNumber && `- Table ${tableNumber}`}
              </p>
              
              <button className="pos-btn" style={{ width: '300px', marginBottom: '1rem', padding: '1.5rem' }} onClick={placeOrder}>
                {language === 'ar' ? 'تأكيد الطلب' : 'Confirm Order'}
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
                  <button className="pos-btn" style={{ background: '#3b82f6', color: '#fff' }} onClick={() => printOrderTickets(lastPlacedOrder, categories, products, printers, language)}>
                    <PrinterIcon size={20} style={{ marginRight: '8px' }} />
                    {language === 'ar' ? 'طباعة البونات' : 'Print Tickets'}
                  </button>
                )}
                {role === 'waiter' && (
                  <button className="pos-btn-outline" onClick={() => {
                    setCart([]); setCustomerName(''); setCustomerPhone(''); setTableNumber(''); setOrderType(null); setView('waiter_dashboard');
                  }}>{language === 'ar' ? 'لوحة القيادة' : 'Dashboard'}</button>
                )}
                <button className="pos-btn" onClick={() => {
                  setCart([]); setCustomerName(''); setCustomerPhone(''); setTableNumber(''); setOrderType(null); setView('customer_info');
                }}>{t.newOrder}</button>
                
                <button className="pos-btn-outline" style={{ borderColor: '#ef4444', color: '#ef4444' }} onClick={() => {
                  setCart([]); setCustomerName(''); setCustomerPhone(''); setTableNumber(''); setOrderType(null); setRole('waiter'); setSelectedWaiter(null); setView('waiter_auth');
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
                  <div style={{ display: 'flex', background: '#111', borderRadius: '8px', padding: '4px' }}>
                    <button onClick={() => setViewAllOrders(false)} style={{ padding: '0.5rem 1rem', background: !viewAllOrders ? 'var(--gold-primary)' : 'transparent', color: !viewAllOrders ? '#000' : '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                      {language === 'ar' ? 'طلباتي' : 'My Orders'}
                    </button>
                    <button onClick={() => setViewAllOrders(true)} style={{ padding: '0.5rem 1rem', background: viewAllOrders ? 'var(--gold-primary)' : 'transparent', color: viewAllOrders ? '#000' : '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                      {language === 'ar' ? 'الكل' : 'All'}
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button className="pos-btn" onClick={() => { setCustomerPhone(''); setCustomerName(''); setTableNumber(''); setOrderType(null); setCart([]); setView('customer_info'); }}>
                    {t.newOrder}
                  </button>
                  <button className="pos-btn-outline" onClick={() => { setSelectedWaiter(null); setWaiterPasscode(''); setRole('waiter'); setView('waiter_auth'); }}>
                    {language === 'ar' ? 'تسجيل خروج' : 'Logout'}
                  </button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem', overflowY: 'auto', flex: 1, alignContent: 'start' }}>
                {activeOrders.filter(o => viewAllOrders || o.waiter_id === selectedWaiter?.id).map(order => (
                  <div key={order.id} style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '16px', padding: '1.5rem', position: 'relative' }}>
                    {viewAllOrders && order.waiter_id !== selectedWaiter?.id && (
                      <div style={{ position: 'absolute', top: '-10px', right: '10px', background: '#333', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>
                        {order.waiter_name || 'Guest'}
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #333', paddingBottom: '1rem', marginBottom: '1rem' }}>
                      <span style={{ color: 'var(--gold-primary)', fontWeight: 'bold' }}>#{order.id.slice(0, 6)}</span>
                      <span style={{ background: 'rgba(212,175,55,0.1)', color: 'var(--gold-primary)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>{order.order_type?.toUpperCase()}</span>
                    </div>
                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>{order.customer_name}</div>
                      {order.table_number && order.table_number !== '-' && <div style={{ color: '#aaa' }}>Table: {order.table_number}</div>}
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>{order.total_price.toFixed(2)} EGP</div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button className="pos-btn" style={{ padding: '0.5rem', fontSize: '0.9rem', flex: 1, background: '#3b82f6', color: '#fff' }} onClick={() => {
                        setEditingOrder(order);
                        setEditOrderId(order.id);
                        setView('waiter_order_edit');
                      }}>{language === 'ar' ? 'تعديل' : 'Edit'}</button>
                      <button className="pos-btn" style={{ padding: '0.5rem', fontSize: '0.9rem', flex: 1 }} onClick={async () => {
                        // Quick pay as cash
                        await db.updateOrderStatus(order.id, 'completed');
                        loadData();
                      }}>{language === 'ar' ? 'إتمام' : 'Pay'}</button>
                      <button className="pos-btn-outline" style={{ padding: '0.5rem', fontSize: '0.9rem', flex: 1 }} onClick={async () => {
                        // Cancel
                        if(confirm('Are you sure you want to cancel?')) {
                          await db.updateOrderStatus(order.id, 'cancelled');
                          loadData();
                        }
                      }}>{language === 'ar' ? 'إلغاء' : 'Cancel'}</button>
                    </div>
                  </div>
                ))}
                {activeOrders.filter(o => viewAllOrders || o.waiter_id === selectedWaiter?.id).length === 0 && (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem', color: '#666', fontSize: '1.2rem' }}>
                    {language === 'ar' ? 'لا توجد طلبات نشطة حالياً' : 'No active orders currently'}
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

              <div style={{ background: '#1a1a1a', padding: '2rem', borderRadius: '16px', border: '1px solid #333' }}>
                
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--gold-primary)' }}>{language === 'ar' ? 'حالة الطلب' : 'Order Status'}</label>
                  <select 
                    className="pos-input" 
                    value={editingOrder.status}
                    onChange={(e) => setEditingOrder({...editingOrder, status: e.target.value as Order['status']})}
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
                      disabled={editingOrder.order_type !== 'dine_in'}
                    />
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #333', paddingTop: '1.5rem', marginBottom: '2rem' }}>
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
                  <div style={{ background: '#111', padding: '1rem', borderRadius: '8px' }}>
                    {editingOrder.items.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: idx === editingOrder.items.length - 1 ? 'none' : '1px solid #222' }}>
                        <span>{item.quantity}x {language === 'ar' ? item.name_ar : item.name_en}</span>
                        <span>{(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dashed #444', fontWeight: 'bold', color: 'var(--gold-primary)' }}>
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
                  });
                  setEditingOrder(null);
                  setEditOrderId(null);
                  setView('waiter_dashboard');
                  loadData();
                }}>
                  {language === 'ar' ? 'حفظ التعديلات' : 'Save Changes'}
                </button>

                <button className="pos-btn-outline" style={{ width: '100%', padding: '1rem', borderColor: '#ef4444', color: '#ef4444' }} onClick={async () => {
                  if(confirm(language === 'ar' ? 'هل أنت متأكد من حذف هذا الطلب؟' : 'Are you sure you want to delete this order?')) {
                    await db.deleteOrder(editingOrder.id);
                    setEditingOrder(null);
                    setEditOrderId(null);
                    setView('waiter_dashboard');
                    loadData();
                  }
                }}>
                  <Trash2 size={16} style={{ display: 'inline', marginRight: '4px' }} />
                  {language === 'ar' ? 'حذف الطلب نهائياً' : 'Delete Order'}
                </button>

              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
};

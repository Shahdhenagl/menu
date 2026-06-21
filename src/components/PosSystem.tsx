import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShoppingBag, User, Utensils, CheckCircle, X, 
  Plus, Minus, Trash2, ArrowRight
} from 'lucide-react';
import { db } from '../lib/supabase';
import type { Category, Product, Order, OrderItem, SystemUser } from '../types';

interface PosSystemProps {
  onClose: () => void;
  language: 'ar' | 'en';
}

type PosView = 'role_select' | 'waiter_auth' | 'customer_info' | 'order_type' | 'menu' | 'checkout' | 'success' | 'waiter_dashboard';

export const PosSystem: React.FC<PosSystemProps> = ({ onClose, language }) => {
  // Global Data
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [waiters, setWaiters] = useState<SystemUser[]>([]);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);

  // POS State
  const [view, setView] = useState<PosView>('role_select');
  const [role, setRole] = useState<'waiter' | 'customer' | null>(null);
  
  // Waiter Auth
  const [selectedWaiter, setSelectedWaiter] = useState<SystemUser | null>(null);
  const [waiterPasscode, setWaiterPasscode] = useState('');
  
  // Order Session Details
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
    const [cats, prods, users, ords] = await Promise.all([
      db.getCategories(),
      db.getProducts(),
      db.getSystemUsers(),
      db.getOrders()
    ]);
    setCategories(cats.sort((a, b) => a.sort_order - b.sort_order));
    setProducts(prods);
    setWaiters(users.filter(u => u.role.includes('admin') || u.role.includes('pos')));
    setActiveOrders(ords.filter(o => o.status === 'pending' || o.status === 'preparing'));
    if (cats.length > 0) setActiveCategory(cats[0].id);
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
    
    await db.addOrder(newOrder);
    setCart([]);
    setView('success');
    loadData();
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
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}>
          <X size={32} />
        </button>
      </div>

      <div className="pos-content" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <AnimatePresence mode="wait">
          
          {view === 'role_select' && (
            <motion.div key="role" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.1 }}
              style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
              <h2 style={{ fontSize: '2.5rem', marginBottom: '3rem' }}>{language === 'ar' ? 'مرحباً بك في مريديان' : 'Welcome to Meridien'}</h2>
              <div className="grid-options">
                <div className="option-card" onClick={() => { setRole('waiter'); setView('waiter_auth'); }}>
                  <User size={64} color="var(--gold-primary)" />
                  <h3>{t.iamWaiter}</h3>
                </div>
                <div className="option-card" onClick={() => { setRole('customer'); setView('customer_info'); }}>
                  <Utensils size={64} color="var(--gold-primary)" />
                  <h3>{t.iamCustomer}</h3>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'waiter_auth' && (
            <motion.div key="w_auth" initial={{ opacity: 0, x: 100 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -100 }} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <h2>{t.selectWaiter}</h2>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center', margin: '2rem 0', maxWidth: '600px' }}>
                {waiters.map(w => (
                  <button key={w.id} onClick={() => setSelectedWaiter(w)}
                    style={{ 
                      padding: '1rem 2rem', borderRadius: '8px', 
                      background: selectedWaiter?.id === w.id ? 'var(--gold-primary)' : '#222',
                      color: selectedWaiter?.id === w.id ? '#000' : '#fff',
                      border: 'none', cursor: 'pointer', fontSize: '1.2rem', fontWeight: 'bold'
                    }}>{w.name}</button>
                ))}
              </div>
              {selectedWaiter && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '300px' }}>
                  <input type="password" placeholder={t.enterPasscode} className="pos-input" value={waiterPasscode} onChange={e => setWaiterPasscode(e.target.value)} />
                  <button className="pos-btn" onClick={handleWaiterLogin}>{t.login}</button>
                </div>
              )}
              <button className="pos-btn-outline" style={{ marginTop: '2rem' }} onClick={() => setView('role_select')}>{t.back}</button>
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

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button className="pos-btn-outline" onClick={() => {
                  if (role === 'waiter') setView('waiter_dashboard');
                  else setView('role_select');
                }}>{t.back}</button>
                <button className="pos-btn" disabled={customerPhone.length < 10 || !customerName} onClick={() => setView('order_type')}>{t.continue}</button>
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
              <div style={{ display: 'flex', gap: '1.5rem', marginTop: '3rem' }}>
                {role === 'waiter' && (
                  <button className="pos-btn-outline" onClick={() => {
                    setCart([]); setCustomerName(''); setCustomerPhone(''); setTableNumber(''); setOrderType(null); setView('waiter_dashboard');
                  }}>{language === 'ar' ? 'لوحة القيادة' : 'Dashboard'}</button>
                )}
                <button className="pos-btn" onClick={() => {
                  setCart([]); setCustomerName(''); setCustomerPhone(''); setTableNumber(''); setOrderType(null); setView(role === 'waiter' ? 'customer_info' : 'role_select');
                }}>{t.newOrder}</button>
              </div>
            </motion.div>
          )}

          {view === 'waiter_dashboard' && (
            <motion.div key="w_dash" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ width: '100%', padding: '2rem', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2>{language === 'ar' ? `طلباتي النشطة (${selectedWaiter?.name})` : `My Active Orders (${selectedWaiter?.name})`}</h2>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button className="pos-btn" onClick={() => { setCustomerPhone(''); setCustomerName(''); setTableNumber(''); setOrderType(null); setCart([]); setView('customer_info'); }}>
                    {t.newOrder}
                  </button>
                  <button className="pos-btn-outline" onClick={() => { setSelectedWaiter(null); setWaiterPasscode(''); setRole(null); setView('role_select'); }}>
                    {language === 'ar' ? 'تسجيل خروج' : 'Logout'}
                  </button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem', overflowY: 'auto', flex: 1, alignContent: 'start' }}>
                {activeOrders.filter(o => o.waiter_id === selectedWaiter?.id).map(order => (
                  <div key={order.id} style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '16px', padding: '1.5rem' }}>
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
                      <button className="pos-btn" style={{ padding: '0.5rem 1rem', fontSize: '0.9rem', flex: 1 }} onClick={async () => {
                        // Quick pay as cash
                        await db.updateOrderStatus(order.id, 'completed');
                        loadData();
                      }}>{language === 'ar' ? 'إتمام كاش' : 'Pay Cash'}</button>
                      <button className="pos-btn-outline" style={{ padding: '0.5rem 1rem', fontSize: '0.9rem', flex: 1 }} onClick={async () => {
                        // Cancel
                        if(confirm('Are you sure you want to cancel?')) {
                          await db.updateOrderStatus(order.id, 'cancelled');
                          loadData();
                        }
                      }}>{language === 'ar' ? 'إلغاء' : 'Cancel'}</button>
                    </div>
                  </div>
                ))}
                {activeOrders.filter(o => o.waiter_id === selectedWaiter?.id).length === 0 && (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem', color: '#666', fontSize: '1.2rem' }}>
                    {language === 'ar' ? 'لا توجد طلبات نشطة حالياً' : 'No active orders currently'}
                  </div>
                )}
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
};

import { useState, useEffect } from 'react';
import { supabase, db } from '../lib/supabase';
import type { Order, InventoryItem, ProductRecipe } from '../types';
import { ChefHat, CheckCircle2, AlertTriangle, Clock, X, Package, Search } from 'lucide-react';

interface KitchenDashboardProps {
  onClose?: () => void;
  language: 'ar' | 'en';
}

export default function KitchenDashboard({ onClose, language }: KitchenDashboardProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [recipes, setRecipes] = useState<ProductRecipe[]>([]);
  const [mfgOrders, setMfgOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestedOrders, setRequestedOrders] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'orders' | 'inventory'>('orders');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = async () => {
    try {
      const [ords, inv, recps, mOrds] = await Promise.all([
        db.getOrders(),
        db.getInventoryItems(),
        supabase ? supabase.from('product_recipes').select('*').then(res => res.data || []) : Promise.resolve([]),
        db.getManufacturingOrders()
      ]);
      setOrders(ords.filter(o => o.status === 'pending' || o.status === 'preparing'));
      setInventory(inv);
      setMfgOrders(mOrds.filter(o => o.requested_by.includes('المطبخ') || o.requested_by.includes('Kitchen')));
      
      if (Array.isArray(recps) && recps.length > 0) {
        setRecipes(recps);
      } else {
        const local = localStorage.getItem('meridien_product_recipes');
        if (local) setRecipes(JSON.parse(local));
      }
    } catch (err) {
      console.error('Error fetching kitchen data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase.channel('realtime_kitchen_orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        db.getOrders().then(ords => {
          setOrders(ords.filter(o => o.status === 'pending' || o.status === 'preparing'));
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'manufacturing_orders' }, (payload: any) => {
        if (payload.new && payload.new.status === 'approved' && payload.eventType === 'UPDATE') {
          // Play a sound or show an alert (optional)
          setTimeout(() => {
            alert(language === 'ar' ? '✅ تمت الموافقة على طلب النواقص وتحديث المخزون في المطبخ!' : '✅ Shortage request approved and inventory updated!');
          }, 500);
        }
        db.getManufacturingOrders().then(mOrds => setMfgOrders(mOrds.filter(o => o.requested_by.includes('المطبخ') || o.requested_by.includes('Kitchen'))));
        db.getInventoryItems().then(setInventory);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_items' }, () => {
        db.getInventoryItems().then(setInventory);
      })
      .subscribe();
    return () => {
      supabase?.removeChannel(channel);
    };
  }, [language]);

  const getOrderShortages = (order: Order) => {
    const shortages: { item: InventoryItem, missingQty: number }[] = [];
    const requiredAmounts: Record<string, number> = {};

    order.items.forEach(orderItem => {
      const productRecipes = recipes.filter(r => r.product_id === orderItem.id);
      productRecipes.forEach(recipe => {
        const totalNeeded = recipe.quantity * orderItem.quantity;
        requiredAmounts[recipe.inventory_item_id] = (requiredAmounts[recipe.inventory_item_id] || 0) + totalNeeded;
      });
    });

    Object.entries(requiredAmounts).forEach(([itemId, required]) => {
      const invItem = inventory.find(i => i.id === itemId);
      if (invItem) {
        const requiredFloat = Number(required.toFixed(4));
        const stockFloat = Number((Number(invItem.stock_factory) || 0).toFixed(4));
        if (stockFloat + 0.0001 < requiredFloat) {
          const diff = Number((requiredFloat - stockFloat).toFixed(4));
          shortages.push({ item: invItem, missingQty: diff });
        }
      }
    });

    return shortages;
  };

  const handleCreateRequest = async (order: Order, shortages: { item: InventoryItem, missingQty: number }[]) => {
    try {
      const items = shortages.map(s => ({
        item_id: s.item.id,
        item_name: s.item.name,
        quantity: s.missingQty,
        unit: s.item.unit || 'unit',
        calculated_main_quantity: s.missingQty
      }));

      await db.addManufacturingOrder({
        status: 'pending',
        items,
        requested_by: 'المطبخ (نواقص الطلب ' + order.id.slice(-4) + ')'
      });

      setRequestedOrders(prev => new Set(prev).add(order.id));
      alert(language === 'ar' ? 'تم إنشاء طلب صرف النواقص بنجاح بانتظار موافقة المخزن' : 'Shortage request sent to warehouse');
    } catch (err) {
      console.error(err);
      alert('Error creating request');
    }
  };

  const updateOrderStatus = async (id: string, status: Order['status']) => {
    try {
      if (supabase) {
        await supabase.from('orders').update({ status }).eq('id', id);
      } else {
        await db.updateOrderStatus(id, status);
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#070707', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
        <div style={{ width: '50px', height: '50px', borderTop: '3px solid var(--gold-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f0f', color: 'white', padding: '1.5rem', fontFamily: 'Cairo, sans-serif', direction: language === 'ar' ? 'rtl' : 'ltr' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', background: '#1a1a1a', padding: '1rem 1.5rem', borderRadius: '15px', border: '1px solid rgba(212,175,55,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '0.8rem', background: 'rgba(212,175,55,0.2)', borderRadius: '10px' }}>
            <ChefHat size={32} color="var(--gold-primary)" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.8rem', margin: 0, color: 'var(--gold-primary)', fontWeight: 'bold' }}>
              {language === 'ar' ? 'شاشة المطبخ (Kitchen Display)' : 'Kitchen Dashboard'}
            </h1>
            <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-gray)', fontSize: '0.9rem' }}>
              {language === 'ar' ? 'متابعة الطلبات وتجهيزها وطلب النواقص بشكل فوري' : 'Track orders, preparation, and request shortages instantly'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', background: '#222', padding: '0.5rem', borderRadius: '12px' }}>
            <button 
              onClick={() => setActiveTab('orders')}
              style={{ padding: '0.5rem 1rem', background: activeTab === 'orders' ? 'var(--gold-primary)' : 'transparent', color: activeTab === 'orders' ? '#000' : 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s ease' }}>
              {language === 'ar' ? 'الطلبات' : 'Orders'}
            </button>
            <button 
              onClick={() => setActiveTab('inventory')}
              style={{ padding: '0.5rem 1rem', background: activeTab === 'inventory' ? 'var(--gold-primary)' : 'transparent', color: activeTab === 'inventory' ? '#000' : 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s ease' }}>
              {language === 'ar' ? 'المخزون والنواقص' : 'Inventory & Shortages'}
            </button>
          </div>
          {onClose && (
            <button onClick={onClose} style={{ padding: '0.6rem', background: 'rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: '10px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={24} />
            </button>
          )}
        </div>
      </div>

      {activeTab === 'orders' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
          {orders.map(order => {
            const shortages = getOrderShortages(order);
            const hasShortages = shortages.length > 0;
            const hasRequested = requestedOrders.has(order.id);
            const isPreparing = order.status === 'preparing';

            return (
              <div key={order.id} style={{ 
              background: '#1a1a1a', 
              borderRadius: '15px', 
              display: 'flex', 
              flexDirection: 'column',
              overflow: 'hidden',
              border: isPreparing ? '2px solid rgba(59,130,246,0.6)' : '1px solid rgba(212,175,55,0.3)',
              boxShadow: isPreparing ? '0 0 20px rgba(59,130,246,0.2)' : 'none',
              transition: 'all 0.3s ease'
            }}>
              
              {/* Order Header */}
              <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isPreparing ? 'rgba(59,130,246,0.1)' : 'rgba(212,175,55,0.05)' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-gray)', display: 'block', marginBottom: '0.2rem' }}>#{order.id.slice(-6)}</span>
                  <span style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>
                    {order.order_type === 'takeaway' ? (language === 'ar' ? 'تيك أواي' : 'Takeaway') : order.order_type === 'delivery' ? (language === 'ar' ? 'دليفري' : 'Delivery') : order.order_type === 'website' ? (language === 'ar' ? 'موقع إلكتروني' : 'Website') : `${language === 'ar' ? 'طاولة' : 'Table'} ${order.table_number}`}
                  </span>
                </div>
                <div>
                  <span style={{ 
                    padding: '0.3rem 0.8rem', 
                    borderRadius: '20px', 
                    fontSize: '0.85rem', 
                    fontWeight: 'bold', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.4rem',
                    background: isPreparing ? 'rgba(59,130,246,0.2)' : 'rgba(245,158,11,0.2)',
                    color: isPreparing ? '#60a5fa' : '#fbbf24'
                  }}>
                    {isPreparing ? <ChefHat size={16} /> : <Clock size={16} />}
                    {isPreparing ? (language === 'ar' ? 'جاري التحضير' : 'Preparing') : (language === 'ar' ? 'قيد الانتظار' : 'Pending')}
                  </span>
                </div>
              </div>

              {/* Order Items */}
              <div style={{ padding: '1.2rem', flex: 1 }}>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1rem 0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {order.items.map((item, idx) => (
                    <li key={idx} style={{ display: 'flex', alignItems: 'center', background: '#222', padding: '0.8rem', borderRadius: '8px' }}>
                      <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'white' }}>
                        <span style={{ color: 'var(--gold-primary)', marginInlineEnd: '0.8rem' }}>{item.quantity}x</span>
                        {language === 'ar' ? item.name_ar : item.name_en}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* Shortages Section */}
                {hasShortages && order.status === 'pending' && (
                  <div style={{ marginBottom: '1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', padding: '1rem', borderRadius: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                      <AlertTriangle size={18} />
                      {language === 'ar' ? 'نواقص في خامات مطبخ التصنيع' : 'Kitchen Material Shortages'}
                    </div>
                    <ul style={{ fontSize: '0.85rem', color: '#fca5a5', margin: '0 0 1rem 0', paddingInlineStart: '1rem' }}>
                      {shortages.map((s, idx) => (
                        <li key={idx} style={{ marginBottom: '0.2rem' }}>{s.item.name} (مطلوب: {s.missingQty} {s.item.unit})</li>
                      ))}
                    </ul>
                    
                    {!hasRequested ? (
                      <button 
                        onClick={() => handleCreateRequest(order, shortages)}
                        style={{ width: '100%', background: '#ef4444', color: 'white', border: 'none', padding: '0.8rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.9rem' }}
                      >
                        {language === 'ar' ? 'إرسال إذن صرف نواقص للمخزن' : 'Send Shortage Request'}
                      </button>
                    ) : (
                      <div style={{ textAlign: 'center', color: '#4ade80', fontSize: '0.9rem', fontWeight: 'bold', padding: '0.5rem', background: 'rgba(74,222,128,0.1)', borderRadius: '5px' }}>
                        {language === 'ar' ? 'تم إرسال طلب النواقص للمخزن ✓' : 'Shortages requested ✓'}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div style={{ padding: '1rem', background: '#222', borderTop: '1px solid #333' }}>
                {order.status === 'pending' && (
                  <button
                    onClick={() => updateOrderStatus(order.id, 'preparing')}
                    disabled={hasShortages && !hasRequested}
                    style={{
                      width: '100%',
                      padding: '1rem',
                      borderRadius: '12px',
                      fontWeight: 'bold',
                      fontSize: '1.1rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      border: 'none',
                      cursor: hasShortages && !hasRequested ? 'not-allowed' : 'pointer',
                      background: hasShortages && !hasRequested ? '#4b5563' : '#3b82f6',
                      color: hasShortages && !hasRequested ? '#9ca3af' : 'white',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <ChefHat size={20} />
                    {language === 'ar' ? 'بدء التحضير' : 'Start Preparing'}
                  </button>
                )}
                {order.status === 'preparing' && (
                  <button
                    onClick={() => updateOrderStatus(order.id, 'prepared')}
                    style={{
                      width: '100%',
                      padding: '1rem',
                      background: '#10b981',
                      color: 'white',
                      borderRadius: '12px',
                      fontWeight: 'bold',
                      fontSize: '1.1rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      border: 'none',
                      cursor: 'pointer',
                      boxShadow: '0 0 20px rgba(16,185,129,0.4)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <CheckCircle2 size={24} />
                    {language === 'ar' ? 'تم التحضير (جاهز للتسليم)' : 'Prepared (Ready)'}
                  </button>
                )}
              </div>

            </div>
          );
        })}
        {orders.length === 0 && (
          <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '5rem 2rem', color: 'var(--text-gray)' }}>
            <CheckCircle2 size={64} style={{ marginBottom: '1rem', opacity: 0.2 }} />
            <p style={{ fontSize: '1.2rem' }}>{language === 'ar' ? 'لا يوجد طلبات حالياً في المطبخ' : 'No active orders in kitchen'}</p>
          </div>
        )}
        </div>
      )}

        {/* Inventory Tab */}
        {activeTab === 'inventory' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'start' }}>
            {/* Section 1: Kitchen Inventory */}
            <div style={{ background: '#1a1a1a', padding: '1.5rem', borderRadius: '16px', border: '1px solid #333' }}>
              <h2 style={{ color: 'var(--gold-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Package size={24} /> {language === 'ar' ? 'مخزون المطبخ' : 'Kitchen Stock'}
              </h2>
              <div style={{ marginBottom: '1rem', position: 'relative' }}>
                <Search size={18} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: language === 'ar' ? 'auto' : '10px', right: language === 'ar' ? '10px' : 'auto', color: '#9ca3af' }} />
                <input 
                  type="text" 
                  placeholder={language === 'ar' ? 'ابحث باسم الصنف...' : 'Search by item name...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem 2.5rem', background: '#222', border: '1px solid #333', color: 'white', borderRadius: '8px' }}
                />
              </div>
              <table style={{ width: '100%', color: 'white', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #444' }}>
                    <th style={{ textAlign: language==='ar'?'right':'left', padding: '0.5rem' }}>{language === 'ar' ? 'الصنف' : 'Item'}</th>
                    <th style={{ textAlign: language==='ar'?'right':'left', padding: '0.5rem' }}>{language === 'ar' ? 'الكمية' : 'Quantity'}</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory
                    .filter(i => Number(i.stock_factory) > 0 || mfgOrders.some(m => m.items.some((it:any)=>it.item_id===i.id)))
                    .filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map(item => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #333' }}>
                      <td style={{ padding: '0.5rem' }}>{item.name}</td>
                      <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{Number(item.stock_factory).toFixed(4).replace(/\.?0+$/, '')} {item.unit}</td>
                    </tr>
                  ))}
                  {inventory
                    .filter(i => Number(i.stock_factory) > 0 || mfgOrders.some(m => m.items.some((it:any)=>it.item_id===i.id)))
                    .filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()))
                    .length === 0 && (
                     <tr><td colSpan={2} style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>{language === 'ar' ? 'المخزون فارغ' : 'Stock is empty'}</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Section 2: Mfg Orders (Shortages requested) */}
            <div style={{ background: '#1a1a1a', padding: '1.5rem', borderRadius: '16px', border: '1px solid #333' }}>
              <h2 style={{ color: 'var(--gold-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={24} /> {language === 'ar' ? 'أذون النواقص المرسلة' : 'Shortage Requests'}
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {mfgOrders.map(mo => (
                  <div key={mo.id} style={{ background: '#222', padding: '1rem', borderRadius: '8px', borderLeft: mo.status === 'approved' ? '4px solid #10b981' : mo.status === 'rejected' ? '4px solid #ef4444' : '4px solid #f59e0b' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ color: '#aaa', fontSize: '0.9rem' }}>{new Date(mo.created_at).toLocaleString()}</span>
                      <span style={{ 
                        color: mo.status === 'approved' ? '#10b981' : mo.status === 'rejected' ? '#ef4444' : '#f59e0b',
                        fontWeight: 'bold', fontSize: '0.9rem'
                      }}>
                        {mo.status === 'approved' ? (language === 'ar' ? 'تم القبول' : 'Approved') : mo.status === 'rejected' ? (language === 'ar' ? 'مرفوض' : 'Rejected') : (language === 'ar' ? 'قيد الانتظار' : 'Pending')}
                      </span>
                    </div>
                    <div>
                      {mo.items.map((i:any, idx:number) => (
                        <div key={idx} style={{ color: 'white', fontSize: '0.9rem' }}>
                          • {i.item_name} ({Number(i.quantity).toFixed(4).replace(/\.?0+$/, '')} {i.unit})
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {mfgOrders.length === 0 && (
                  <p style={{ color: '#aaa', textAlign: 'center', padding: '2rem 0' }}>{language === 'ar' ? 'لا يوجد طلبات سابقة' : 'No previous requests'}</p>
                )}
              </div>
            </div>
          </div>
        )}
    </div>
  );
}

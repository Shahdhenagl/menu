import { useState, useEffect } from 'react';
import { supabase, db } from '../lib/supabase';
import type { Order, InventoryItem, ProductRecipe } from '../types';
import { ChefHat, CheckCircle2, AlertTriangle, Clock, X } from 'lucide-react';

interface KitchenDashboardProps {
  onClose?: () => void;
  language: 'ar' | 'en';
}

export default function KitchenDashboard({ onClose, language }: KitchenDashboardProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [recipes, setRecipes] = useState<ProductRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestedOrders, setRequestedOrders] = useState<Set<string>>(new Set());

  const fetchData = async () => {
    try {
      const [ords, inv, recps] = await Promise.all([
        db.getOrders(),
        db.getInventoryItems(),
        supabase ? supabase.from('product_recipes').select('*').then(res => res.data || []) : Promise.resolve([])
      ]);
      setOrders(ords.filter(o => o.status === 'pending' || o.status === 'preparing'));
      setInventory(inv);
      
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
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'manufacturing_orders' }, (payload: any) => {
        if (payload.new && payload.new.status === 'approved') {
          // Play a sound or show an alert (optional)
          // We'll rely on the visual update mainly, but an alert is nice
          setTimeout(() => {
            alert(language === 'ar' ? '✅ تم الموافقة على طلب النواقص وتحديث المخزون في المطبخ!' : '✅ Shortage request approved and inventory updated!');
          }, 500);
          db.getInventoryItems().then(setInventory);
        }
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
        if (invItem.stock_factory < required) {
          shortages.push({ item: invItem, missingQty: required - invItem.stock_factory });
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
    <div style={{ minHeight: '100vh', background: '#0f0f0f', color: 'white', padding: '1.5rem', fontFamily: 'Cairo, sans-serif' }}>
      
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
        {onClose && (
          <button onClick={onClose} style={{ padding: '0.6rem', background: 'rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: '10px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={24} />
          </button>
        )}
      </div>

      {/* Orders Grid */}
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
    </div>
  );
}

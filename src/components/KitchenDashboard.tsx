import { useState, useEffect } from 'react';
import { supabase, db } from '../lib/supabase';
import type { Order, InventoryItem, ProductRecipe } from '../types';
import { ChefHat, CheckCircle2, AlertTriangle, Clock, X } from 'lucide-react';

interface KitchenDashboardProps {
  onClose: () => void;
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
      .subscribe();
    return () => {
      supabase?.removeChannel(channel);
    };
  }, []);

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
        unit: s.item.unit
      }));

      await db.addTransferRequest({
        status: 'pending',
        items,
        requested_by: 'Kitchen (Auto for Order)',
        notes: `عجز لمكونات الطلب رقم ${order.id.slice(-4)}`
      } as any);

      setRequestedOrders(prev => new Set(prev).add(order.id));
      alert(language === 'ar' ? 'تم إنشاء إذن صرف النواقص بنجاح' : 'Shortage request created successfully');
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
      <div className="min-h-screen bg-[#070707] flex items-center justify-center text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#d4af37]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white p-6 font-cairo">
      <div className="flex justify-between items-center mb-8 bg-[#1a1a1a] p-4 rounded-xl border border-[#d4af37]/20">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#d4af37]/20 rounded-lg">
            <ChefHat size={32} className="text-[#d4af37]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#d4af37]">
              {language === 'ar' ? 'شاشة المطبخ' : 'Kitchen Dashboard'}
            </h1>
            <p className="text-gray-400 text-sm">
              {language === 'ar' ? 'متابعة الطلبات والنواقص' : 'Track orders and shortages'}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 bg-red-500/20 text-red-400 hover:bg-red-500/40 rounded-lg transition-colors">
          <X size={24} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {orders.map(order => {
          const shortages = getOrderShortages(order);
          const hasShortages = shortages.length > 0;
          const hasRequested = requestedOrders.has(order.id);
          const isPreparing = order.status === 'preparing';

          return (
            <div key={order.id} className={`bg-[#1a1a1a] rounded-xl border-2 overflow-hidden flex flex-col ${isPreparing ? 'border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 'border-[#d4af37]/30'}`}>
              <div className={`p-4 flex justify-between items-center ${isPreparing ? 'bg-blue-500/10' : 'bg-[#d4af37]/10'}`}>
                <div>
                  <span className="text-xs text-gray-400 block">#{order.id.slice(-6)}</span>
                  <span className="font-bold text-lg">{order.order_type === 'takeaway' ? (language === 'ar' ? 'تيك أواي' : 'Takeaway') : order.order_type === 'delivery' ? (language === 'ar' ? 'دليفري' : 'Delivery') : order.order_type === 'website' ? (language === 'ar' ? 'موقع إلكتروني' : 'Website') : `${language === 'ar' ? 'طاولة' : 'Table'} ${order.table_number}`}</span>
                </div>
                <div className="text-right">
                  <span className={`px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1 ${isPreparing ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'}`}>
                    {isPreparing ? <ChefHat size={14} /> : <Clock size={14} />}
                    {isPreparing ? (language === 'ar' ? 'جاري التحضير' : 'Preparing') : (language === 'ar' ? 'قيد الانتظار' : 'Pending')}
                  </span>
                </div>
              </div>

              <div className="p-4 flex-1">
                <ul className="space-y-3 mb-4">
                  {order.items.map((item, idx) => (
                    <li key={idx} className="flex justify-between items-center bg-[#222] p-2 rounded">
                      <span className="font-semibold text-[1.1rem]">
                        <span className="text-[#d4af37] mx-2">{item.quantity}x</span>
                        {language === 'ar' ? item.name_ar : item.name_en}
                      </span>
                    </li>
                  ))}
                </ul>

                {hasShortages && order.status === 'pending' && (
                  <div className="mb-4 bg-red-900/20 border border-red-500/30 p-3 rounded-lg">
                    <div className="flex items-center gap-2 text-red-400 font-bold mb-2">
                      <AlertTriangle size={18} />
                      {language === 'ar' ? 'نواقص في الخامات' : 'Material Shortages'}
                    </div>
                    <ul className="text-sm text-red-300 space-y-1 mb-3">
                      {shortages.map((s, idx) => (
                        <li key={idx}>- {s.item.name}: {s.missingQty} {s.item.unit}</li>
                      ))}
                    </ul>
                    {!hasRequested ? (
                      <button 
                        onClick={() => handleCreateRequest(order, shortages)}
                        className="w-full bg-red-600 hover:bg-red-500 text-white py-2 rounded-lg text-sm font-bold transition"
                      >
                        {language === 'ar' ? 'إنشاء إذن صرف نواقص' : 'Create Shortage Request'}
                      </button>
                    ) : (
                      <div className="text-center text-green-400 text-sm font-bold p-2 bg-green-500/10 rounded">
                        {language === 'ar' ? 'تم طلب النواقص ✓' : 'Shortages requested ✓'}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="p-4 bg-[#222] border-t border-gray-800 grid grid-cols-2 gap-3">
                {order.status === 'pending' && (
                  <button
                    onClick={() => updateOrderStatus(order.id, 'preparing')}
                    disabled={hasShortages && !hasRequested}
                    className={`col-span-2 py-3 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all ${hasShortages && !hasRequested ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
                  >
                    <ChefHat size={20} />
                    {language === 'ar' ? 'بدء التحضير' : 'Start Preparing'}
                  </button>
                )}
                {order.status === 'preparing' && (
                  <button
                    onClick={() => updateOrderStatus(order.id, 'prepared')}
                    className="col-span-2 py-4 bg-[#2ecc71] hover:bg-[#27ae60] text-white rounded-xl font-bold text-xl flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(46,204,113,0.3)]"
                  >
                    <CheckCircle2 size={24} />
                    {language === 'ar' ? 'تم التحضير (تسليم)' : 'Prepared (Deliver)'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
        
        {orders.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center text-gray-500 py-20">
            <CheckCircle2 size={64} className="mb-4 opacity-20" />
            <p className="text-xl">{language === 'ar' ? 'لا يوجد طلبات حالياً' : 'No active orders'}</p>
          </div>
        )}
      </div>
    </div>
  );
}

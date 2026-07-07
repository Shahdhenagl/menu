import { useState, useEffect, useMemo } from 'react';
import { db } from '../lib/supabase';
import type { InventoryItem } from '../types';
import { warehouseHoldsItem, warehouseStock, type WarehouseKey } from '../lib/warehouse';
import { Search, Save, PackageOpen, AlertTriangle } from 'lucide-react';

interface InventoryCountViewProps {
  language: 'ar' | 'en';
}

export default function InventoryCountView({ language }: InventoryCountViewProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<WarehouseKey>('main');
  const [search, setSearch] = useState('');
  const [counts, setCounts] = useState<Record<string, number>>({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const allItems = await db.getInventoryItems();
      setItems(allItems);
      
      // Initialize counts with current stock
      const initialCounts: Record<string, number> = {};
      allItems.forEach(item => {
        initialCounts[item.id] = warehouseStock(selectedWarehouse, item);
      });
      setCounts(initialCounts);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedWarehouse]); // Refetch and re-initialize when warehouse changes

  const handleCountChange = (itemId: string, value: string) => {
    const numValue = parseFloat(value);
    setCounts(prev => ({
      ...prev,
      [itemId]: isNaN(numValue) ? 0 : numValue
    }));
  };

  const handleSave = async () => {
    if (!confirm(language === 'ar' ? 'هل أنت متأكد من حفظ الجرد واعتماد التسويات؟' : 'Are you sure you want to save the count and apply adjustments?')) return;
    
    setSaving(true);
    try {
      const warehouseItems = items.filter(item => warehouseHoldsItem(selectedWarehouse, item));
      let updatedCount = 0;

      for (const item of warehouseItems) {
        const currentSysStock = warehouseStock(selectedWarehouse, item);
        const countedStock = counts[item.id] ?? currentSysStock;
        const diff = countedStock - currentSysStock;

        if (diff !== 0) {
          // Add movement (adjustment)
          await db.addInventoryMovement({
            item_id: item.id,
            warehouse: selectedWarehouse,
            type: 'adjustment',
            quantity: diff, // positive for surplus, negative for deficit
            unit_price: item.avg_purchase_price || 0,
            total_price: Math.abs(diff) * (item.avg_purchase_price || 0),
            description: language === 'ar' ? 'تسوية جرد' : 'Inventory count adjustment'
          });

          // Update stock based on warehouse
          const updateData: Partial<InventoryItem> = {};
          if (selectedWarehouse === 'main') updateData.stock_main = countedStock;
          if (selectedWarehouse === 'factory') updateData.stock_factory = countedStock;
          if (selectedWarehouse === 'bar') updateData.stock_bar = countedStock;
          
          await db.updateInventoryItem(item.id, updateData);
          updatedCount++;
        }
      }

      alert(language === 'ar' ? `تم اعتماد الجرد بنجاح وتحديث ${updatedCount} أصناف.` : `Inventory count saved successfully. ${updatedCount} items updated.`);
      await fetchData(); // Refresh data
    } catch (err) {
      console.error(err);
      alert(language === 'ar' ? 'حدث خطأ أثناء الحفظ' : 'Error saving count');
    } finally {
      setSaving(false);
    }
  };

  const num = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    const warehouseItems = items.filter(item => warehouseHoldsItem(selectedWarehouse, item));
    return warehouseItems.filter(item => {
      if (q && !item.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, search, selectedWarehouse]);

  const warehouses: { key: WarehouseKey; ar: string; en: string; icon: string }[] = [
    { key: 'main', ar: 'المخزن الرئيسي', en: 'Main Warehouse', icon: '🏢' },
    { key: 'factory', ar: 'المصنع', en: 'Factory', icon: '🏭' },
    { key: 'bar', ar: 'البار (التوزيع)', en: 'Bar', icon: '🎪' }
  ];

  const totalDifferenceValue = useMemo(() => {
    let total = 0;
    for (const item of visibleItems) {
      const sys = warehouseStock(selectedWarehouse, item);
      const act = counts[item.id] ?? sys;
      total += (act - sys) * (item.avg_purchase_price || 0);
    }
    return total;
  }, [visibleItems, counts, selectedWarehouse]);

  if (loading && items.length === 0) {
    return (
      <div className="inventory-report">
        <div style={{ padding: '2rem', textAlign: 'center', color: '#a3a3a3' }}>
          {language === 'ar' ? 'جاري تحميل البيانات...' : 'Loading data...'}
        </div>
      </div>
    );
  }

  return (
    <div className="inventory-report" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, fontSize: '1.5rem', color: '#fff' }}>
          <PackageOpen style={{ color: 'var(--gold-primary)' }} />
          {language === 'ar' ? 'جرد المخزون الفعلي' : 'Physical Inventory Count'}
        </h2>
        
        <button 
          onClick={handleSave} 
          disabled={saving}
          className="admin-btn primary"
          style={{ padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}
        >
          <Save size={20} />
          {saving 
            ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') 
            : (language === 'ar' ? 'اعتماد وحفظ الجرد' : 'Save & Apply Count')}
        </button>
      </div>

      <div className="admin-card" style={{ marginBottom: '1.5rem', background: 'var(--bg-panel)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
          {warehouses.map(w => (
            <button
              key={w.key}
              onClick={() => setSelectedWarehouse(w.key)}
              style={{
                flex: 1,
                minWidth: '150px',
                padding: '1rem',
                borderRadius: '8px',
                border: `1px solid ${selectedWarehouse === w.key ? 'var(--gold-primary)' : 'rgba(255,255,255,0.1)'}`,
                background: selectedWarehouse === w.key ? 'rgba(212, 175, 55, 0.1)' : 'transparent',
                color: selectedWarehouse === w.key ? 'var(--gold-primary)' : '#fff',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                fontSize: '1.1rem'
              }}
            >
              <span>{w.icon}</span>
              <span>{language === 'ar' ? w.ar : w.en}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="admin-card" style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem', background: 'var(--bg-panel)' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', right: language==='ar'?'1rem':'auto', left: language==='en'?'1rem':'auto', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
          <input 
            type="text" 
            placeholder={language === 'ar' ? 'بحث عن صنف...' : 'Search item...'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '0.75rem 1rem',
              paddingRight: language === 'ar' ? '2.5rem' : '1rem',
              paddingLeft: language === 'en' ? '2.5rem' : '1rem',
              background: 'rgba(0,0,0,0.2)', 
              border: '1px solid rgba(255,255,255,0.1)', 
              borderRadius: '8px', 
              color: '#fff' 
            }}
          />
        </div>
        <div style={{
          padding: '0.75rem 1.5rem',
          borderRadius: '8px',
          background: totalDifferenceValue === 0 ? 'rgba(255,255,255,0.05)' : totalDifferenceValue > 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${totalDifferenceValue === 0 ? 'rgba(255,255,255,0.1)' : totalDifferenceValue > 0 ? '#10b981' : '#ef4444'}`,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span style={{ color: '#a3a3a3' }}>{language === 'ar' ? 'قيمة التسوية:' : 'Adjustment Value:'}</span>
          <span style={{ 
            fontWeight: 'bold', 
            color: totalDifferenceValue === 0 ? '#fff' : totalDifferenceValue > 0 ? '#10b981' : '#ef4444' 
          }}>
            {totalDifferenceValue > 0 ? '+' : ''}{num(totalDifferenceValue)} EGP
          </span>
        </div>
      </div>

      <div className="table-container" style={{ maxHeight: 'calc(100vh - 350px)', overflowY: 'auto' }}>
        <table className="admin-table">
          <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#1a1a1a' }}>
            <tr>
              <th>{language === 'ar' ? 'الصنف' : 'Item'}</th>
              <th style={{ textAlign: 'center' }}>{language === 'ar' ? 'متوسط السعر' : 'Avg Price'}</th>
              <th style={{ textAlign: 'center' }}>{language === 'ar' ? 'رصيد النظام' : 'System Stock'}</th>
              <th style={{ width: '150px', textAlign: 'center' }}>{language === 'ar' ? 'الجرد الفعلي' : 'Actual Count'}</th>
              <th style={{ textAlign: 'center' }}>{language === 'ar' ? 'الفرق (كمية)' : 'Diff (Qty)'}</th>
              <th style={{ textAlign: 'center' }}>{language === 'ar' ? 'قيمة الفرق' : 'Diff Value'}</th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#a3a3a3' }}>
                  {language === 'ar' ? 'لا توجد أصناف تطابق البحث في هذا المخزن' : 'No items match your search in this warehouse'}
                </td>
              </tr>
            ) : (
              visibleItems.map(item => {
                const sysQty = warehouseStock(selectedWarehouse, item);
                const actQty = counts[item.id] ?? sysQty;
                const diffQty = actQty - sysQty;
                const diffVal = diffQty * (item.avg_purchase_price || 0);

                return (
                  <tr key={item.id} style={{ background: diffQty !== 0 ? 'rgba(212, 175, 55, 0.05)' : 'transparent' }}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 'bold' }}>{item.name}</span>
                        <span style={{ color: '#a3a3a3', fontSize: '0.9rem' }}>({item.unit})</span>
                        {diffQty !== 0 && <AlertTriangle size={14} style={{ color: 'var(--gold-primary)' }} />}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', color: '#a3a3a3' }}>
                      {num(item.avg_purchase_price || 0)} EGP
                    </td>
                    <td style={{ textAlign: 'center', fontSize: '1.1rem' }}>
                      {num(sysQty)}
                    </td>
                    <td style={{ padding: '0.5rem' }}>
                      <input 
                        type="number"
                        min="0"
                        step="0.01"
                        value={counts[item.id] === undefined ? '' : counts[item.id]}
                        onChange={(e) => handleCountChange(item.id, e.target.value)}
                        onFocus={(e) => e.target.select()}
                        style={{
                          width: '100%',
                          padding: '0.5rem',
                          textAlign: 'center',
                          borderRadius: '4px',
                          border: `2px solid ${diffQty !== 0 ? 'var(--gold-primary)' : 'rgba(255,255,255,0.2)'}`,
                          background: diffQty !== 0 ? 'rgba(212, 175, 55, 0.1)' : 'rgba(0,0,0,0.3)',
                          color: '#fff',
                          fontWeight: 'bold',
                          fontSize: '1.1rem'
                        }}
                      />
                    </td>
                    <td style={{ 
                      textAlign: 'center', 
                      fontWeight: 'bold',
                      color: diffQty === 0 ? '#a3a3a3' : diffQty > 0 ? '#10b981' : '#ef4444'
                    }}>
                      {diffQty > 0 ? '+' : ''}{num(diffQty)}
                    </td>
                    <td style={{ 
                      textAlign: 'center', 
                      fontWeight: 'bold',
                      color: diffVal === 0 ? '#a3a3a3' : diffVal > 0 ? '#10b981' : '#ef4444'
                    }}>
                      {diffVal > 0 ? '+' : ''}{num(diffVal)} EGP
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

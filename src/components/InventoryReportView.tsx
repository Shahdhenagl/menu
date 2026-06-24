import { useState, useEffect, useMemo } from 'react';
import { db } from '../lib/supabase';
import type { InventoryItem, InventoryMovement } from '../types';
import { Calendar, PackageOpen, TrendingDown, ArrowDownRight, ArrowUpRight } from 'lucide-react';

interface InventoryReportViewProps {
  language: 'ar' | 'en';
}

export default function InventoryReportView({ language }: InventoryReportViewProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(false);

  // Month and Year filter (default to current)
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedWarehouse, setSelectedWarehouse] = useState<'main' | 'factory' | 'distribution'>('main');

  const fetchData = async () => {
    setLoading(true);
    try {
      const allItems = await db.getInventoryItems();
      const allMovements = await db.getInventoryMovements();
      setItems(allItems);
      setMovements(allMovements);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const reportData = useMemo(() => {
    // We want to calculate:
    // Opening balance (رصيد افتتاحي): All movements BEFORE the selected month (start of selected month)
    // In (وارد): All 'in' movements DURING the selected month
    // Out/Waste (مستهلك): All 'out' or 'waste' movements DURING the selected month
    // Final balance (رصيد نهائي): Opening + In - Out/Waste
    
    const startDate = new Date(selectedYear, selectedMonth, 1);
    const endDate = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999);

    let totalOpeningValue = 0;
    let totalInValue = 0;
    let totalOutValue = 0;
    let totalFinalValue = 0;

    const itemStats = items.map(item => {
      // Filter movements for this specific item AND the selected warehouse
      const itemMovements = movements.filter(m => m.item_id === item.id && (m.warehouse === selectedWarehouse || (!m.warehouse && selectedWarehouse === 'main')));
      
      // Calculate Opening
      const pastMovements = itemMovements.filter(m => {
        const d = new Date(m.created_at || 0);
        return d < startDate;
      });
      
      let openingQty = 0;
      let openingVal = 0;
      pastMovements.forEach(m => {
        if (m.type === 'in' || m.type === 'adjustment') {
          openingQty += Number(m.quantity);
          openingVal += Number(m.total_price);
        } else {
          openingQty -= Number(m.quantity);
          openingVal -= Number(m.total_price);
        }
      });

      // To handle legacy data where we didn't have movements:
      if (itemMovements.length === 0) {
        let legacyStock = 0;
        if (selectedWarehouse === 'main') legacyStock = item.stock_main || 0;
        if (selectedWarehouse === 'factory') legacyStock = item.stock_factory || 0;
        if (selectedWarehouse === 'distribution') legacyStock = item.stock_distribution || 0;

        if (legacyStock > 0) {
          openingQty = legacyStock;
          openingVal = legacyStock * (item.avg_purchase_price || 0);
        }
      }

      // Current Month
      const monthMovements = itemMovements.filter(m => {
        const d = new Date(m.created_at || 0);
        return d >= startDate && d <= endDate;
      });

      let inQty = 0;
      let inVal = 0;
      let outQty = 0;
      let outVal = 0;

      monthMovements.forEach(m => {
        if (m.type === 'in') {
          inQty += Number(m.quantity);
          inVal += Number(m.total_price);
        } else if (m.type === 'out' || m.type === 'waste') {
          outQty += Number(m.quantity);
          outVal += Number(m.total_price);
        } else if (m.type === 'adjustment') {
          inQty += Number(m.quantity);
          inVal += Number(m.total_price);
        }
      });

      const finalQty = openingQty + inQty - outQty;
      const finalVal = openingVal + inVal - outVal;

      totalOpeningValue += openingVal;
      totalInValue += inVal;
      totalOutValue += outVal;
      totalFinalValue += finalVal;

      return {
        item,
        openingQty, openingVal,
        inQty, inVal,
        outQty, outVal,
        finalQty, finalVal
      };
    });

    return {
      itemStats,
      totalOpeningValue,
      totalInValue,
      totalOutValue,
      totalFinalValue
    };
  }, [items, movements, selectedMonth, selectedYear, selectedWarehouse]);

  return (
    <div className="admin-content-section fade-in">
      <div className="section-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <h2>{language === 'ar' ? 'الجرد الشهري للمخازن' : 'Monthly Inventory Report'}</h2>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <select 
            className="input-gold" 
            value={selectedWarehouse} 
            onChange={(e) => setSelectedWarehouse(e.target.value as 'main' | 'factory' | 'distribution')}
            style={{ width: '200px' }}
          >
            <option value="main">{language === 'ar' ? 'المخزن الرئيسي (الخامات)' : 'Main Warehouse'}</option>
            <option value="factory">{language === 'ar' ? 'مخزن المصنع / المطبخ' : 'Factory / Kitchen'}</option>
            <option value="distribution">{language === 'ar' ? 'مخزن التوزيع' : 'Distribution Warehouse'}</option>
          </select>

          <Calendar size={20} color="var(--gold-primary)" />
          <select 
            className="input-gold" 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            style={{ width: '150px' }}
          >
            {Array.from({ length: 12 }).map((_, i) => (
              <option key={i} value={i}>
                {new Date(0, i).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US', { month: 'long' })}
              </option>
            ))}
          </select>
          <input 
            type="number" 
            className="input-gold" 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            style={{ width: '100px' }}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div className="stat-card" style={{ background: 'var(--bg-darker)' }}>
          <div className="stat-icon" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <PackageOpen size={24} color="var(--text-light)" />
          </div>
          <div className="stat-info">
            <h3>{language === 'ar' ? 'قيمة الافتتاحي' : 'Opening Value'}</h3>
            <div className="stat-value">{reportData.totalOpeningValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
          </div>
        </div>

        <div className="stat-card" style={{ background: 'rgba(16, 185, 129, 0.05)' }}>
          <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.1)' }}>
            <ArrowUpRight size={24} color="#10b981" />
          </div>
          <div className="stat-info">
            <h3>{language === 'ar' ? 'قيمة الوارد' : 'Incoming Value'}</h3>
            <div className="stat-value" style={{ color: '#10b981' }}>{reportData.totalInValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
          </div>
        </div>

        <div className="stat-card" style={{ background: 'rgba(239, 68, 68, 0.05)' }}>
          <div className="stat-icon" style={{ background: 'rgba(239, 68, 68, 0.1)' }}>
            <TrendingDown size={24} color="#ef4444" />
          </div>
          <div className="stat-info">
            <h3>{language === 'ar' ? 'قيمة الاستهلاك' : 'Consumption Value'}</h3>
            <div className="stat-value" style={{ color: '#ef4444' }}>{reportData.totalOutValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
          </div>
        </div>

        <div className="stat-card" style={{ background: 'rgba(245, 158, 11, 0.05)' }}>
          <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.1)' }}>
            <ArrowDownRight size={24} color="#f59e0b" />
          </div>
          <div className="stat-info">
            <h3>{language === 'ar' ? 'الرصيد النهائي' : 'Final Balance Value'}</h3>
            <div className="stat-value" style={{ color: '#f59e0b' }}>{reportData.totalFinalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
          </div>
        </div>
      </div>

      <div className="table-panel">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>Loading...</div>
        ) : (
          <div style={{ overflowX: 'auto' }} className="custom-scrollbar">
            <table className="data-table" style={{ width: '100%', minWidth: '800px' }}>
              <thead>
                <tr>
                  <th style={{ minWidth: '150px' }}>{language === 'ar' ? 'الصنف' : 'Item'}</th>
                  <th style={{ textAlign: 'center' }}>{language === 'ar' ? 'الافتتاحي' : 'Opening'}</th>
                  <th style={{ textAlign: 'center', color: '#10b981' }}>{language === 'ar' ? 'الوارد' : 'In'}</th>
                  <th style={{ textAlign: 'center', color: '#ef4444' }}>{language === 'ar' ? 'المستهلك' : 'Out'}</th>
                  <th style={{ textAlign: 'center', color: '#f59e0b' }}>{language === 'ar' ? 'النهائي' : 'Final'}</th>
                </tr>
              </thead>
              <tbody>
                {reportData.itemStats.map(stat => (
                  <tr key={stat.item.id}>
                    <td>
                      <div style={{ fontWeight: 'bold' }}>{stat.item.name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-gray)' }}>{stat.item.unit}</div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div>{stat.openingQty.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-gray)' }}>{stat.openingVal.toLocaleString(undefined, { maximumFractionDigits: 1 })} EGP</div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ color: '#10b981' }}>{stat.inQty.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                      <div style={{ fontSize: '0.8rem', color: '#10b981', opacity: 0.8 }}>{stat.inVal.toLocaleString(undefined, { maximumFractionDigits: 1 })} EGP</div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ color: '#ef4444' }}>{stat.outQty.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                      <div style={{ fontSize: '0.8rem', color: '#ef4444', opacity: 0.8 }}>{stat.outVal.toLocaleString(undefined, { maximumFractionDigits: 1 })} EGP</div>
                    </td>
                    <td style={{ textAlign: 'center', background: 'rgba(255,255,255,0.02)' }}>
                      <div style={{ color: '#f59e0b', fontWeight: 'bold' }}>{stat.finalQty.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                      <div style={{ fontSize: '0.8rem', color: '#f59e0b', opacity: 0.8 }}>{stat.finalVal.toLocaleString(undefined, { maximumFractionDigits: 1 })} EGP</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

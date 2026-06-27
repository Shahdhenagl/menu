import { useState, useEffect, useMemo } from 'react';
import { db } from '../lib/supabase';
import type { InventoryItem, InventoryMovement } from '../types';
import { warehouseHoldsItem, warehouseStock } from '../lib/warehouse';
import { Calendar, PackageOpen, TrendingDown, ArrowDownRight, ArrowUpRight, Search } from 'lucide-react';

interface InventoryReportViewProps {
  language: 'ar' | 'en';
}

type WarehouseKey = 'main' | 'factory' | 'distribution';

export default function InventoryReportView({ language }: InventoryReportViewProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(false);

  // Month and Year filter (default to current)
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedWarehouse, setSelectedWarehouse] = useState<WarehouseKey>('main');
  const [search, setSearch] = useState('');
  const [hideZero, setHideZero] = useState(true);

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

  const num = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

  const reportData = useMemo(() => {
    // الحساب مُثبّت على الرصيد الفعلي الحالي (الأدق عند نقص سجل الحركات):
    //   النهائي للشهر  = الرصيد الحالي - (الوارد بعد نهاية الشهر) + (المنصرف بعد نهاية الشهر)
    //   الافتتاحي      = النهائي - وارد الشهر + منصرف الشهر
    const startDate = new Date(selectedYear, selectedMonth, 1);
    const endDate = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999);

    let totalOpeningValue = 0;
    let totalInValue = 0;
    let totalOutValue = 0;
    let totalFinalValue = 0;

    const warehouseItems = items.filter(item => warehouseHoldsItem(selectedWarehouse, item));

    const itemStats = warehouseItems.map(item => {
      const itemMovements = movements.filter(m => m.item_id === item.id && (m.warehouse === selectedWarehouse || (!m.warehouse && selectedWarehouse === 'main')));
      const live = warehouseStock(selectedWarehouse, item);

      let inQty = 0, outQty = 0, inAfter = 0, outAfter = 0;
      for (const m of itemMovements) {
        const d = new Date(m.created_at || 0);
        const q = Number(m.quantity) || 0;
        const isIn = m.type === 'in' || m.type === 'adjustment';
        if (d >= startDate && d <= endDate) {
          if (isIn) inQty += q; else outQty += q;
        } else if (d > endDate) {
          if (isIn) inAfter += q; else outAfter += q;
        }
      }

      const finalQty = live - inAfter + outAfter;
      const openingQty = finalQty - inQty + outQty;

      const price = item.avg_purchase_price || 0;
      const openingVal = openingQty * price;
      const inVal = inQty * price;
      const outVal = outQty * price;
      const finalVal = finalQty * price;

      totalOpeningValue += openingVal;
      totalInValue += inVal;
      totalOutValue += outVal;
      totalFinalValue += finalVal;

      return { item, openingQty, openingVal, inQty, inVal, outQty, outVal, finalQty, finalVal };
    });

    return { itemStats, totalOpeningValue, totalInValue, totalOutValue, totalFinalValue };
  }, [items, movements, selectedMonth, selectedYear, selectedWarehouse]);

  const visibleStats = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reportData.itemStats.filter(s => {
      if (q && !s.item.name.toLowerCase().includes(q)) return false;
      if (hideZero && s.openingQty === 0 && s.inQty === 0 && s.outQty === 0 && s.finalQty === 0) return false;
      return true;
    });
  }, [reportData.itemStats, search, hideZero]);

  const warehouses: { key: WarehouseKey; ar: string; en: string; sub: string }[] = [
    { key: 'main', ar: 'الرئيسي', en: 'Main', sub: language === 'ar' ? 'خام' : 'Raw' },
    { key: 'factory', ar: 'المصنع / المطبخ', en: 'Factory', sub: language === 'ar' ? 'خام' : 'Raw' },
    { key: 'distribution', ar: 'التوزيع', en: 'Distribution', sub: language === 'ar' ? 'مصنّع' : 'Mfg' },
  ];

  const cards = [
    { label: language === 'ar' ? 'قيمة الافتتاحي' : 'Opening Value', value: reportData.totalOpeningValue, color: 'var(--text-light)', bg: 'rgba(255,255,255,0.05)', icon: <PackageOpen size={22} color="var(--text-light)" /> },
    { label: language === 'ar' ? 'قيمة الوارد' : 'Incoming', value: reportData.totalInValue, color: '#10b981', bg: 'rgba(16,185,129,0.12)', icon: <ArrowUpRight size={22} color="#10b981" /> },
    { label: language === 'ar' ? 'قيمة الاستهلاك' : 'Consumption', value: reportData.totalOutValue, color: '#ef4444', bg: 'rgba(239,68,68,0.12)', icon: <TrendingDown size={22} color="#ef4444" /> },
    { label: language === 'ar' ? 'الرصيد النهائي' : 'Final Balance', value: reportData.totalFinalValue, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: <ArrowDownRight size={22} color="#f59e0b" /> },
  ];

  const monthName = (i: number) => new Date(0, i).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US', { month: 'long' });

  return (
    <div className="admin-content-section fade-in">
      <div className="section-header" style={{ flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <div>
          <h2 style={{ marginBottom: '0.2rem' }}>{language === 'ar' ? 'الجرد الشهري للمخازن' : 'Monthly Inventory Report'}</h2>
          <p style={{ color: 'var(--text-gray)', fontSize: '0.82rem' }}>
            {language === 'ar' ? `${monthName(selectedMonth)} ${selectedYear} — ${warehouses.find(w => w.key === selectedWarehouse)?.ar}` : `${monthName(selectedMonth)} ${selectedYear} — ${warehouses.find(w => w.key === selectedWarehouse)?.en}`}
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', marginBottom: '1.5rem' }}>
        {/* warehouse segmented control */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', border: '1px solid rgba(212,175,55,0.25)' }}>
          {warehouses.map(w => {
            const active = selectedWarehouse === w.key;
            return (
              <button
                key={w.key}
                onClick={() => setSelectedWarehouse(w.key)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1,
                  padding: '0.4rem 0.9rem', borderRadius: '8px', cursor: 'pointer', border: 'none', transition: 'all 0.15s',
                  background: active ? 'var(--gold-primary)' : 'transparent', color: active ? '#000' : 'var(--text-light)', fontWeight: active ? 700 : 500,
                }}
              >
                <span style={{ fontSize: '0.85rem' }}>{language === 'ar' ? w.ar : w.en}</span>
                <span style={{ fontSize: '0.62rem', opacity: 0.8 }}>{w.sub}</span>
              </button>
            );
          })}
        </div>

        {/* month / year */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Calendar size={18} color="var(--gold-primary)" />
          <select className="input-gold" value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} style={{ width: '140px' }}>
            {Array.from({ length: 12 }).map((_, i) => <option key={i} value={i}>{monthName(i)}</option>)}
          </select>
          <input type="number" className="input-gold" value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} style={{ width: '95px' }} />
        </div>

        {/* search */}
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: '180px' }}>
          <Search size={15} style={{ position: 'absolute', insetInlineStart: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-gray)' }} />
          <input
            className="input-gold"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={language === 'ar' ? 'ابحث باسم الصنف...' : 'Search item...'}
            style={{ width: '100%', paddingInlineStart: '2rem' }}
          />
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-light)', fontSize: '0.85rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <input type="checkbox" checked={hideZero} onChange={(e) => setHideZero(e.target.checked)} style={{ accentColor: 'var(--gold-primary)' }} />
          {language === 'ar' ? 'إخفاء الأصناف بدون حركة' : 'Hide zero-activity'}
        </label>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {cards.map((c, i) => (
          <div key={i} className="stat-card" style={{ background: c.bg }}>
            <div className="stat-icon" style={{ background: 'rgba(255,255,255,0.06)' }}>{c.icon}</div>
            <div className="stat-info">
              <h3>{c.label}</h3>
              <div className="stat-value" style={{ color: c.color }}>{num(c.value)} <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>EGP</span></div>
            </div>
          </div>
        ))}
      </div>

      <div className="table-panel">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>{language === 'ar' ? 'جارٍ التحميل...' : 'Loading...'}</div>
        ) : (
          <div style={{ overflowX: 'auto' }} className="custom-scrollbar">
            <table className="data-table" style={{ width: '100%', minWidth: '760px' }}>
              <thead>
                <tr>
                  <th style={{ minWidth: '160px' }}>{language === 'ar' ? 'الصنف' : 'Item'}</th>
                  <th style={{ textAlign: 'center' }}>{language === 'ar' ? 'الافتتاحي' : 'Opening'}</th>
                  <th style={{ textAlign: 'center', color: '#10b981' }}>{language === 'ar' ? 'الوارد' : 'In'}</th>
                  <th style={{ textAlign: 'center', color: '#ef4444' }}>{language === 'ar' ? 'المستهلك' : 'Out'}</th>
                  <th style={{ textAlign: 'center', color: '#f59e0b' }}>{language === 'ar' ? 'النهائي' : 'Final'}</th>
                </tr>
              </thead>
              <tbody>
                {visibleStats.map(stat => (
                  <tr key={stat.item.id}>
                    <td>
                      <div style={{ fontWeight: 'bold' }}>{stat.item.name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-gray)' }}>{stat.item.unit}</div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div>{num(stat.openingQty)}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-gray)' }}>{num(stat.openingVal)} EGP</div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ color: '#10b981' }}>{num(stat.inQty)}</div>
                      <div style={{ fontSize: '0.78rem', color: '#10b981', opacity: 0.8 }}>{num(stat.inVal)} EGP</div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ color: '#ef4444' }}>{num(stat.outQty)}</div>
                      <div style={{ fontSize: '0.78rem', color: '#ef4444', opacity: 0.8 }}>{num(stat.outVal)} EGP</div>
                    </td>
                    <td style={{ textAlign: 'center', background: 'rgba(255,255,255,0.02)' }}>
                      <div style={{ color: '#f59e0b', fontWeight: 'bold' }}>{num(stat.finalQty)}</div>
                      <div style={{ fontSize: '0.78rem', color: '#f59e0b', opacity: 0.8 }}>{num(stat.finalVal)} EGP</div>
                    </td>
                  </tr>
                ))}
                {visibleStats.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-gray)' }}>{language === 'ar' ? 'لا توجد أصناف مطابقة في هذا المخزن' : 'No matching items in this warehouse'}</td></tr>
                )}
              </tbody>
              {visibleStats.length > 0 && (
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--gold-primary)', fontWeight: 'bold' }}>
                    <td>{language === 'ar' ? `الإجمالي (${visibleStats.length} صنف)` : `Total (${visibleStats.length})`}</td>
                    <td style={{ textAlign: 'center' }}>{num(visibleStats.reduce((s, x) => s + x.openingVal, 0))} EGP</td>
                    <td style={{ textAlign: 'center', color: '#10b981' }}>{num(visibleStats.reduce((s, x) => s + x.inVal, 0))} EGP</td>
                    <td style={{ textAlign: 'center', color: '#ef4444' }}>{num(visibleStats.reduce((s, x) => s + x.outVal, 0))} EGP</td>
                    <td style={{ textAlign: 'center', color: '#f59e0b' }}>{num(visibleStats.reduce((s, x) => s + x.finalVal, 0))} EGP</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

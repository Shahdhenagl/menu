import { useState, useEffect, useMemo } from 'react';
import { db } from '../lib/supabase';
import type { InventoryItem, InventoryMovement } from '../types';
import { warehouseHoldsItem, warehouseStock } from '../lib/warehouse';
import { Calendar, PackageOpen, TrendingDown, ArrowDownRight, ArrowUpRight, Search, FileText, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

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
  const whName = warehouses.find(w => w.key === selectedWarehouse)?.[language === 'ar' ? 'ar' : 'en'] || '';
  const periodLabel = `${monthName(selectedMonth)} ${selectedYear} — ${whName}`;
  const fileBase = `Inventory_${selectedWarehouse}_${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;

  const exportExcel = () => {
    if (visibleStats.length === 0) {
      alert(language === 'ar' ? 'لا توجد بيانات للتصدير' : 'No data to export');
      return;
    }
    const r2 = (n: number) => Number(n.toFixed(2));
    const rows: any[] = visibleStats.map(s => ({
      [language === 'ar' ? 'الصنف' : 'Item']: s.item.name,
      [language === 'ar' ? 'الوحدة' : 'Unit']: s.item.unit,
      [language === 'ar' ? 'الافتتاحي' : 'Opening']: r2(s.openingQty),
      [language === 'ar' ? 'قيمة الافتتاحي' : 'Opening Value']: r2(s.openingVal),
      [language === 'ar' ? 'الوارد' : 'In']: r2(s.inQty),
      [language === 'ar' ? 'قيمة الوارد' : 'In Value']: r2(s.inVal),
      [language === 'ar' ? 'المستهلك' : 'Out']: r2(s.outQty),
      [language === 'ar' ? 'قيمة المستهلك' : 'Out Value']: r2(s.outVal),
      [language === 'ar' ? 'النهائي' : 'Final']: r2(s.finalQty),
      [language === 'ar' ? 'قيمة النهائي' : 'Final Value']: r2(s.finalVal),
    }));
    rows.push({
      [language === 'ar' ? 'الصنف' : 'Item']: language === 'ar' ? 'الإجمالي' : 'Total',
      [language === 'ar' ? 'الوحدة' : 'Unit']: '',
      [language === 'ar' ? 'الافتتاحي' : 'Opening']: '',
      [language === 'ar' ? 'قيمة الافتتاحي' : 'Opening Value']: r2(visibleStats.reduce((s, x) => s + x.openingVal, 0)),
      [language === 'ar' ? 'الوارد' : 'In']: '',
      [language === 'ar' ? 'قيمة الوارد' : 'In Value']: r2(visibleStats.reduce((s, x) => s + x.inVal, 0)),
      [language === 'ar' ? 'المستهلك' : 'Out']: '',
      [language === 'ar' ? 'قيمة المستهلك' : 'Out Value']: r2(visibleStats.reduce((s, x) => s + x.outVal, 0)),
      [language === 'ar' ? 'النهائي' : 'Final']: '',
      [language === 'ar' ? 'قيمة النهائي' : 'Final Value']: r2(visibleStats.reduce((s, x) => s + x.finalVal, 0)),
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'الجرد');
    XLSX.writeFile(wb, `${fileBase}.xlsx`);
  };

  const exportPDF = () => {
    if (visibleStats.length === 0) {
      alert(language === 'ar' ? 'لا توجد بيانات للتصدير' : 'No data to export');
      return;
    }
    const esc = (s: string) => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
    const rtl = language === 'ar';
    const t = {
      title: rtl ? 'الجرد الشهري للمخازن' : 'Monthly Inventory Report',
      item: rtl ? 'الصنف' : 'Item', unit: rtl ? 'الوحدة' : 'Unit',
      opening: rtl ? 'الافتتاحي' : 'Opening', inn: rtl ? 'الوارد' : 'In',
      out: rtl ? 'المستهلك' : 'Out', final: rtl ? 'النهائي' : 'Final',
      total: rtl ? 'الإجمالي' : 'Total', qty: rtl ? 'كمية' : 'Qty', val: rtl ? 'قيمة' : 'Value',
      generated: rtl ? 'تاريخ الطباعة' : 'Generated',
    };
    const tot = {
      o: visibleStats.reduce((s, x) => s + x.openingVal, 0),
      i: visibleStats.reduce((s, x) => s + x.inVal, 0),
      u: visibleStats.reduce((s, x) => s + x.outVal, 0),
      f: visibleStats.reduce((s, x) => s + x.finalVal, 0),
    };
    const cell = (q: number, v: number, color: string) => `<td class="numcell"><div style="color:${color};font-weight:600">${num(q)}</div><div class="sub">${num(v)}</div></td>`;
    const body = visibleStats.map(s => `
      <tr>
        <td><b>${esc(s.item.name)}</b><div class="sub">${esc(s.item.unit)}</div></td>
        ${cell(s.openingQty, s.openingVal, '#111')}
        ${cell(s.inQty, s.inVal, '#0a7d4d')}
        ${cell(s.outQty, s.outVal, '#c0392b')}
        ${cell(s.finalQty, s.finalVal, '#b8860b')}
      </tr>`).join('');

    const html = `<!doctype html><html dir="${rtl ? 'rtl' : 'ltr'}" lang="${rtl ? 'ar' : 'en'}"><head><meta charset="utf-8"><title>${t.title}</title>
      <style>
        @page { size: A4 ${'portrait'}; margin: 12mm; }
        * { box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; color: #1a1a1a; margin: 0; }
        .head { display:flex; justify-content:space-between; align-items:flex-end; border-bottom:3px solid #b8860b; padding-bottom:8px; margin-bottom:14px; }
        .head h1 { font-size: 20px; margin: 0; color:#000; }
        .head .meta { font-size: 12px; color:#555; text-align:${rtl ? 'left' : 'right'}; }
        .head .period { font-size: 13px; color:#b8860b; font-weight:700; margin-top:4px; }
        .cards { display:flex; gap:8px; margin-bottom:12px; }
        .card { flex:1; border:1px solid #e0c97a; border-radius:8px; padding:8px 10px; }
        .card .lbl { font-size:11px; color:#666; }
        .card .v { font-size:15px; font-weight:700; }
        table { width:100%; border-collapse:collapse; font-size:12px; }
        th, td { border:1px solid #ddd; padding:6px 8px; text-align:${rtl ? 'right' : 'left'}; }
        th { background:#f4ecd2; color:#5a4a10; }
        .numcell { text-align:center; }
        .sub { font-size:10px; color:#888; }
        tfoot td { background:#faf6e8; font-weight:700; border-top:2px solid #b8860b; }
        .printbtn { margin:16px 0; }
        @media print { .printbtn { display:none; } }
      </style></head><body>
      <div class="head">
        <div><h1>${t.title}</h1><div class="period">${esc(periodLabel)}</div></div>
        <div class="meta">Meridien<br>${t.generated}: ${new Date().toLocaleDateString(rtl ? 'ar-EG' : 'en-US')}</div>
      </div>
      <div class="cards">
        <div class="card"><div class="lbl">${t.opening}</div><div class="v">${num(tot.o)} EGP</div></div>
        <div class="card"><div class="lbl">${t.inn}</div><div class="v" style="color:#0a7d4d">${num(tot.i)} EGP</div></div>
        <div class="card"><div class="lbl">${t.out}</div><div class="v" style="color:#c0392b">${num(tot.u)} EGP</div></div>
        <div class="card"><div class="lbl">${t.final}</div><div class="v" style="color:#b8860b">${num(tot.f)} EGP</div></div>
      </div>
      <table>
        <thead><tr>
          <th>${t.item}</th>
          <th class="numcell">${t.opening}<div class="sub">${t.qty} / ${t.val}</div></th>
          <th class="numcell">${t.inn}<div class="sub">${t.qty} / ${t.val}</div></th>
          <th class="numcell">${t.out}<div class="sub">${t.qty} / ${t.val}</div></th>
          <th class="numcell">${t.final}<div class="sub">${t.qty} / ${t.val}</div></th>
        </tr></thead>
        <tbody>${body}</tbody>
        <tfoot><tr>
          <td>${t.total} (${visibleStats.length})</td>
          <td class="numcell">${num(tot.o)} EGP</td>
          <td class="numcell">${num(tot.i)} EGP</td>
          <td class="numcell">${num(tot.u)} EGP</td>
          <td class="numcell">${num(tot.f)} EGP</td>
        </tr></tfoot>
      </table>
      <button class="printbtn" onclick="window.print()">🖨 ${rtl ? 'طباعة / حفظ PDF' : 'Print / Save PDF'}</button>
      <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 300); };</script>
      </body></html>`;

    const win = window.open('', '_blank');
    if (!win) {
      alert(language === 'ar' ? 'مُنعت النافذة المنبثقة — اسمح بالنوافذ المنبثقة لطباعة الـ PDF' : 'Popup blocked — allow popups to print the PDF');
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  return (
    <div className="admin-content-section fade-in">
      <div className="section-header" style={{ flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ marginBottom: '0.2rem' }}>{language === 'ar' ? 'الجرد الشهري للمخازن' : 'Monthly Inventory Report'}</h2>
          <p style={{ color: 'var(--text-gray)', fontSize: '0.82rem' }}>{periodLabel}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn-outline-gold" onClick={exportExcel} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <FileSpreadsheet size={16} /> {language === 'ar' ? 'تصدير Excel' : 'Export Excel'}
          </button>
          <button className="btn-outline-gold" onClick={exportPDF} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <FileText size={16} /> {language === 'ar' ? 'تصدير PDF (A4)' : 'Export PDF (A4)'}
          </button>
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

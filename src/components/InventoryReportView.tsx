import { useState, useEffect, useMemo } from 'react';
import { db } from '../lib/supabase';
import type { InventoryItem, InventoryMovement } from '../types';
import { warehouseHoldsItem, warehouseStock, warehouseValue, type WarehouseKey } from '../lib/warehouse';
import { Calendar, PackageOpen, TrendingDown, ArrowDownRight, ArrowUpRight, Search, FileText, FileSpreadsheet, ClipboardCheck, X, AlertTriangle, CheckCircle2, Send } from 'lucide-react';
import * as XLSX from 'xlsx';

const STOCK_FIELD: Record<'main' | 'factory' | 'bar', 'stock_main' | 'stock_factory' | 'stock_bar'> = {
  main: 'stock_main',
  factory: 'stock_factory',
  bar: 'stock_bar',
};

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
  const [selectedWarehouse, setSelectedWarehouse] = useState<WarehouseKey>('main');
  const [search, setSearch] = useState('');
  const [hideZero, setHideZero] = useState(true);

  // --- تقفيل الجرد (Physical stock-taking / close inventory) ---
  const [countOpen, setCountOpen] = useState(false);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [countSearch, setCountSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  // مفتاح الجرد لكل (مخزن + صنف) — مهم لأن الصنف الخام موجود بالرئيسي والمطبخ بنفس الـ id
  const countKey = (wh: WarehouseKey, id: string) => `${wh}:${id}`;

  // كل أصناف المخزن المختار (بغضّ النظر عن الحركة) — دي أساس الجرد الفعلي
  const countItems = useMemo(
    () => items.filter(i => warehouseHoldsItem(selectedWarehouse, i)),
    [items, selectedWarehouse]
  );

  const visibleCountItems = useMemo(() => {
    const q = countSearch.trim().toLowerCase();
    if (!q) return countItems;
    return countItems.filter(i => i.name.toLowerCase().includes(q));
  }, [countItems, countSearch]);

  // ملخّص الجرد: الفروقات، الهدر، الزيادات، قيمة المخزون قبل/بعد
  const countSummary = useMemo(() => {
    let wasteValue = 0, surplusValue = 0, wasteItems = 0, surplusItems = 0, countedCount = 0;
    const changes: { item: InventoryItem; expected: number; actual: number; diff: number; price: number; val: number }[] = [];
    for (const item of countItems) {
      const raw = counts[countKey(selectedWarehouse, item.id)];
      if (raw === undefined || raw === '') continue;
      const actual = Number(raw);
      if (!isFinite(actual) || actual < 0) continue;
      countedCount++;
      const expected = warehouseStock(selectedWarehouse, item);
      const diff = actual - expected;
      if (Math.abs(diff) < 1e-9) continue;
      const price = item.avg_purchase_price || 0;
      const val = Math.abs(diff) * price;
      if (diff < 0) { wasteValue += val; wasteItems++; }
      else { surplusValue += val; surplusItems++; }
      changes.push({ item, expected, actual, diff, price, val });
    }
    const warehouseValueBefore = warehouseValue(selectedWarehouse, items);
    const net = surplusValue - wasteValue;
    return {
      wasteValue, surplusValue, net, wasteItems, surplusItems, countedCount, changes,
      warehouseValueBefore, warehouseValueAfter: warehouseValueBefore + net,
    };
  }, [countItems, counts, selectedWarehouse, items]);

  // ملء قيم النظام للمخزن الحالي فقط (مع الحفاظ على أرقام المخازن الأخرى)
  const prefillCounts = () => {
    setCounts(prev => {
      const next = { ...prev };
      for (const item of countItems) next[countKey(selectedWarehouse, item.id)] = String(warehouseStock(selectedWarehouse, item));
      return next;
    });
  };

  // تفريغ أرقام المخزن الحالي فقط
  const clearCurrentCounts = () => {
    setCounts(prev => {
      const next = { ...prev };
      for (const item of countItems) delete next[countKey(selectedWarehouse, item.id)];
      return next;
    });
  };

  const currentUserName = () => {
    try {
      const adminRaw = localStorage.getItem('meridien_logged_in_user');
      if (adminRaw) return JSON.parse(adminRaw).name || 'مدير النظام';
      const waiterRaw = localStorage.getItem('meridien_waiter');
      if (waiterRaw) return JSON.parse(waiterRaw).name || 'كابتن';
    } catch (e) {}
    return 'غير معروف';
  };

  const confirmCount = async () => {
    const { changes } = countSummary;
    if (changes.length === 0) {
      alert(language === 'ar' ? 'لا توجد فروقات لتسجيلها — أدخل الجرد الفعلي أولاً.' : 'No differences to record — enter the physical count first.');
      return;
    }
    if (!window.confirm(language === 'ar'
      ? `سيتم تعديل رصيد ${changes.length} صنف حسب الجرد الفعلي وإرسال التقرير للبوت. متابعة؟`
      : `Stock of ${changes.length} item(s) will be adjusted and a report sent. Continue?`)) return;

    setSubmitting(true);
    try {
      const field = STOCK_FIELD[selectedWarehouse];
      for (const ch of changes) {
        await db.updateInventoryItem(ch.item.id, { [field]: ch.actual } as Partial<InventoryItem>);
        await db.addInventoryMovement({
          item_id: ch.item.id,
          warehouse: selectedWarehouse,
          type: ch.diff < 0 ? 'waste' : 'adjustment',
          quantity: Math.abs(ch.diff),
          unit_price: ch.price,
          total_price: ch.val,
          description: `${ch.diff < 0 ? 'عجز جرد' : 'زيادة جرد'} — تقفيل ${periodLabel}`,
        });
      }

      // إرسال تقرير الجرد للبوت
      try {
        const settings = await db.getSettings();
        const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const s = countSummary;
        const dateStr = new Date().toLocaleString('ar-EG');
        const details = s.changes.map(ch => {
          const arrow = ch.diff < 0 ? '🔻' : '🔺';
          const sign = ch.diff < 0 ? '−' : '+';
          return `${arrow} ${ch.item.name} — متوقع ${num(ch.expected)} / فعلي ${num(ch.actual)} (${sign}${num(Math.abs(ch.diff))} ${ch.item.unit}) = ${fmt(ch.val)} ج.م`;
        });
        // Telegram message limit safety
        const MAX_LINES = 45;
        const shownDetails = details.slice(0, MAX_LINES).join('\n') + (details.length > MAX_LINES ? `\n… و ${details.length - MAX_LINES} صنف آخر` : '');

        const text =
          `🧾 <b>تقفيل الجرد الشهري</b>\n\n` +
          `📦 <b>المخزن:</b> ${whName}\n` +
          `🗓 <b>الفترة:</b> ${periodLabel}\n` +
          `👤 <b>القائم بالجرد:</b> ${currentUserName()}\n` +
          `🕐 ${dateStr}\n\n` +
          `━━━━━━ النتيجة ━━━━━━\n` +
          `🔴 <b>إجمالي الهدر/العجز:</b> ${fmt(s.wasteValue)} ج.م (${s.wasteItems} صنف)\n` +
          `🟢 <b>إجمالي الزيادات:</b> ${fmt(s.surplusValue)} ج.م (${s.surplusItems} صنف)\n` +
          `⚖️ <b>صافي الفرق:</b> ${s.net >= 0 ? '+' : '−'}${fmt(Math.abs(s.net))} ج.م\n\n` +
          `💰 <b>قيمة المخزون قبل الجرد:</b> ${fmt(s.warehouseValueBefore)} ج.م\n` +
          `💰 <b>قيمة المخزون بعد الجرد:</b> ${fmt(s.warehouseValueAfter)} ج.م\n\n` +
          `━━━━━━ تفاصيل الفروقات ━━━━━━\n${shownDetails}`;

        const { sendTelegramMessage } = await import('../utils/telegramUtils');
        await sendTelegramMessage(settings?.telegram_bot_token, settings?.telegram_chat_id || '5507184715,7441837470', text);
      } catch (tgErr) {
        console.error('Failed to send inventory count report to Telegram', tgErr);
      }

      // نمسح أرقام المخزن اللي اتقفل بس، ونسيب باقي المخازن عشان تكمّل جردها
      clearCurrentCounts();
      await fetchData();
      alert(language === 'ar'
        ? `✅ تم تقفيل جرد «${whName}» بنجاح وإرسال التقرير.\nتقدر تبدّل لمخزن تاني وتكمّل الجرد.`
        : `✅ Inventory for "${whName}" closed and report sent.`);
    } catch (e) {
      console.error(e);
      alert(language === 'ar' ? 'حدث خطأ أثناء تقفيل الجرد.' : 'An error occurred while closing inventory.');
    } finally {
      setSubmitting(false);
    }
  };

  const warehouses: { key: WarehouseKey; ar: string; en: string; sub: string }[] = [
    { key: 'main', ar: 'الرئيسي', en: 'Main', sub: language === 'ar' ? 'خام' : 'Raw' },
    { key: 'factory', ar: 'المصنع / المطبخ', en: 'Factory', sub: language === 'ar' ? 'خام' : 'Raw' },
    { key: 'bar', ar: 'التوزيع', en: 'bar', sub: language === 'ar' ? 'مصنّع' : 'Mfg' },
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
          <button
            onClick={() => { setCountSearch(''); setCountOpen(true); }}
            title={language === 'ar' ? 'ابدأ الجرد الفعلي وتقفيل المخزن' : 'Start physical stock-take'}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.3rem',
              borderRadius: '10px', border: '2px solid #ffe9a8', cursor: 'pointer', fontWeight: 800, fontSize: '0.95rem',
              background: 'linear-gradient(135deg, #f5c94b, #d4af37)', color: '#000',
              boxShadow: '0 4px 16px rgba(212,175,55,0.45)', letterSpacing: '0.2px',
            }}
          >
            <ClipboardCheck size={19} /> {language === 'ar' ? 'تقفيل / جرد المخزن' : 'Stock-Take'}
          </button>
          <button className="btn-export excel" onClick={exportExcel}>
            <FileSpreadsheet size={16} /> {language === 'ar' ? 'تصدير Excel' : 'Export Excel'}
          </button>
          <button className="btn-export pdf" onClick={exportPDF}>
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

      {/* ===== مودال تقفيل الجرد ===== */}
      {countOpen && (
        <div
          onClick={() => !submitting && setCountOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="custom-scrollbar"
            style={{
              width: '100%', maxWidth: '860px', maxHeight: '92vh', overflowY: 'auto',
              background: 'var(--bg-dark, #14110c)', border: '1px solid rgba(212,175,55,0.35)',
              borderRadius: '14px', padding: '1.25rem', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}
          >
            {/* header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <div>
                <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ClipboardCheck size={20} color="var(--gold-primary)" /> {language === 'ar' ? 'تقفيل / جرد المخزن' : 'Stock-Take'}
                </h2>
                <p style={{ color: 'var(--text-gray)', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>{periodLabel}</p>
              </div>
              <button onClick={() => !submitting && setCountOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-gray)', cursor: 'pointer', padding: 4 }}>
                <X size={22} />
              </button>
            </div>

            {/* اختيار المخزن اللي بنجرده — الرئيسي / المطبخ / التوزيع */}
            <div style={{ marginBottom: '0.6rem' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-gray)', marginBottom: '0.35rem' }}>
                {language === 'ar' ? 'اختر المخزن المراد جرده:' : 'Select warehouse to count:'}
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {warehouses.map(w => {
                  const active = selectedWarehouse === w.key;
                  // عدد الأصناف اللي اتدخل ليها جرد فعلي في المخزن ده
                  const filledCount = items.reduce((n, it) => {
                    if (!warehouseHoldsItem(w.key, it)) return n;
                    const v = counts[countKey(w.key, it.id)];
                    return n + (v !== undefined && v !== '' ? 1 : 0);
                  }, 0);
                  return (
                    <button
                      key={w.key}
                      onClick={() => { setCountSearch(''); setSelectedWarehouse(w.key); }}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.15,
                        padding: '0.45rem 1rem', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.15s',
                        border: active ? '2px solid var(--gold-primary)' : '1px solid rgba(255,255,255,0.12)',
                        background: active ? 'rgba(212,175,55,0.16)' : 'rgba(255,255,255,0.03)',
                        color: active ? 'var(--gold-primary)' : 'var(--text-light)', fontWeight: active ? 800 : 500,
                      }}
                    >
                      <span style={{ fontSize: '0.9rem' }}>{language === 'ar' ? w.ar : w.en}</span>
                      <span style={{ fontSize: '0.62rem', opacity: 0.85 }}>
                        {w.sub}{filledCount > 0 ? ` • ${filledCount} ${language === 'ar' ? 'مُدخل' : 'entered'}` : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <p style={{ color: 'var(--text-gray)', fontSize: '0.82rem', marginTop: 0 }}>
              {language === 'ar'
                ? 'أدخل الكمية الفعلية الموجودة في المخزن لكل صنف. تُحسب الفروقات تلقائياً: النقص يُعتبر هدر والزيادة تُضاف للرصيد. الأصناف المتروكة فارغة لن تتغيّر. تقدر تبدّل بين المخازن الثلاثة وكل مخزن بيتقفل لوحده.'
                : 'Enter the actual counted quantity per item. Differences are computed automatically. Blank items stay unchanged. Switch between the three warehouses freely — each is closed separately.'}
            </p>

            {/* toolbar */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', margin: '0.75rem 0' }}>
              <div style={{ position: 'relative', flex: '1 1 220px', minWidth: '180px' }}>
                <Search size={15} style={{ position: 'absolute', insetInlineStart: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-gray)' }} />
                <input
                  className="input-gold"
                  value={countSearch}
                  onChange={(e) => setCountSearch(e.target.value)}
                  placeholder={language === 'ar' ? 'ابحث باسم الصنف...' : 'Search item...'}
                  style={{ width: '100%', paddingInlineStart: '2rem' }}
                />
              </div>
              <button
                onClick={prefillCounts}
                style={{ padding: '0.5rem 0.9rem', borderRadius: '8px', border: '1px solid rgba(212,175,55,0.4)', background: 'transparent', color: 'var(--gold-primary)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, whiteSpace: 'nowrap' }}
              >
                {language === 'ar' ? 'ملء بقيم النظام' : 'Prefill system values'}
              </button>
              <button
                onClick={clearCurrentCounts}
                style={{ padding: '0.5rem 0.9rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'var(--text-gray)', cursor: 'pointer', fontSize: '0.82rem', whiteSpace: 'nowrap' }}
              >
                {language === 'ar' ? 'تفريغ' : 'Clear'}
              </button>
            </div>

            {/* count table */}
            <div style={{ overflowX: 'auto', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px' }} className="custom-scrollbar">
              <table className="data-table" style={{ width: '100%', minWidth: '560px' }}>
                <thead>
                  <tr>
                    <th style={{ minWidth: '150px' }}>{language === 'ar' ? 'الصنف' : 'Item'}</th>
                    <th style={{ textAlign: 'center' }}>{language === 'ar' ? 'رصيد النظام' : 'System'}</th>
                    <th style={{ textAlign: 'center', minWidth: '120px' }}>{language === 'ar' ? 'الفعلي' : 'Actual'}</th>
                    <th style={{ textAlign: 'center' }}>{language === 'ar' ? 'الفرق' : 'Diff'}</th>
                    <th style={{ textAlign: 'center' }}>{language === 'ar' ? 'القيمة' : 'Value'}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleCountItems.map(item => {
                    const expected = warehouseStock(selectedWarehouse, item);
                    const key = countKey(selectedWarehouse, item.id);
                    const raw = counts[key] ?? '';
                    const actual = raw === '' ? null : Number(raw);
                    const valid = actual !== null && isFinite(actual) && actual >= 0;
                    const diff = valid ? (actual as number) - expected : 0;
                    const price = item.avg_purchase_price || 0;
                    const val = Math.abs(diff) * price;
                    const color = diff < 0 ? '#ef4444' : diff > 0 ? '#10b981' : 'var(--text-gray)';
                    return (
                      <tr key={item.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{item.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-gray)' }}>{item.unit}</div>
                        </td>
                        <td style={{ textAlign: 'center', color: 'var(--text-light)' }}>{num(expected)}</td>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="number"
                            className="input-gold"
                            value={raw}
                            min={0}
                            step="any"
                            onChange={(e) => setCounts(prev => ({ ...prev, [key]: e.target.value }))}
                            placeholder="—"
                            style={{ width: '90px', textAlign: 'center', borderColor: valid && diff !== 0 ? color : undefined }}
                          />
                        </td>
                        <td style={{ textAlign: 'center', color, fontWeight: 700 }}>
                          {valid && diff !== 0 ? `${diff > 0 ? '+' : '−'}${num(Math.abs(diff))}` : '—'}
                        </td>
                        <td style={{ textAlign: 'center', color, fontSize: '0.82rem' }}>
                          {valid && diff !== 0 ? `${num(val)} EGP` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                  {visibleCountItems.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-gray)' }}>{language === 'ar' ? 'لا توجد أصناف' : 'No items'}</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.6rem', margin: '1rem 0' }}>
              <div style={{ padding: '0.7rem', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-gray)', display: 'flex', alignItems: 'center', gap: 4 }}><AlertTriangle size={13} color="#ef4444" /> {language === 'ar' ? 'الهدر/العجز' : 'Shortage'}</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ef4444' }}>{num(countSummary.wasteValue)} <span style={{ fontSize: '0.65rem' }}>EGP</span></div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-gray)' }}>{countSummary.wasteItems} {language === 'ar' ? 'صنف' : 'items'}</div>
              </div>
              <div style={{ padding: '0.7rem', borderRadius: '10px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-gray)', display: 'flex', alignItems: 'center', gap: 4 }}><ArrowUpRight size={13} color="#10b981" /> {language === 'ar' ? 'الزيادات' : 'Surplus'}</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#10b981' }}>{num(countSummary.surplusValue)} <span style={{ fontSize: '0.65rem' }}>EGP</span></div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-gray)' }}>{countSummary.surplusItems} {language === 'ar' ? 'صنف' : 'items'}</div>
              </div>
              <div style={{ padding: '0.7rem', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-gray)' }}>{language === 'ar' ? 'قيمة المخزون قبل' : 'Value before'}</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-light)' }}>{num(countSummary.warehouseValueBefore)} <span style={{ fontSize: '0.65rem' }}>EGP</span></div>
              </div>
              <div style={{ padding: '0.7rem', borderRadius: '10px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-gray)' }}>{language === 'ar' ? 'قيمة المخزون بعد' : 'Value after'}</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f59e0b' }}>{num(countSummary.warehouseValueAfter)} <span style={{ fontSize: '0.65rem' }}>EGP</span></div>
              </div>
            </div>

            {/* actions */}
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                onClick={() => !submitting && setCountOpen(false)}
                disabled={submitting}
                style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'var(--text-light)', cursor: submitting ? 'not-allowed' : 'pointer' }}
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={confirmCount}
                disabled={submitting || countSummary.changes.length === 0}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.4rem', borderRadius: '8px', border: 'none',
                  fontWeight: 700, cursor: submitting || countSummary.changes.length === 0 ? 'not-allowed' : 'pointer',
                  background: countSummary.changes.length === 0 ? 'rgba(255,255,255,0.1)' : 'var(--gold-primary)',
                  color: countSummary.changes.length === 0 ? 'var(--text-gray)' : '#000', opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? <>{language === 'ar' ? 'جارٍ التنفيذ...' : 'Processing...'}</> : <><CheckCircle2 size={17} /> {language === 'ar' ? `تأكيد الجرد (${countSummary.changes.length})` : `Confirm (${countSummary.changes.length})`} <Send size={15} /></>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

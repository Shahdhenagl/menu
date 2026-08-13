import { useState, useEffect, useMemo } from 'react';
import { Printer, RefreshCw, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import type { DailyClosing, RestaurantSettings, ShiftClosing } from '../types';
import { db } from '../lib/supabase';
import { printShiftClosing } from '../utils/printUtils';
import { drawerOfHall } from '../utils/shiftClosing';
import { taxPercentForOrder } from '../utils/tax';

interface ShiftRecordsViewProps {
  settings?: RestaurantSettings | null;
  language: 'ar' | 'en';
}

const num = (v: any): number => Number(v) || 0;
const localDay = (value: string | number | Date | undefined) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
};
const orderSubtotal = (o: any) => (o.items || []).reduce((s: number, i: any) => s + num(i.price) * num(i.quantity), 0);
const methodLabel = (method: string, ar: boolean) => ({
  cash: ar ? 'كاش' : 'Cash', visa: ar ? 'فيزا' : 'Visa', wallet_restaurant: ar ? 'محفظة المطعم' : 'Restaurant Wallet',
  wallet_cafe: ar ? 'محفظة الكافيه' : 'Cafe Wallet', instapay: ar ? 'إنستاباي' : 'Instapay', deferred: ar ? 'آجل' : 'Deferred',
  petty_cash: ar ? 'عهدة' : 'Petty Cash', partner: ar ? 'مديونية شريك' : 'Partner Debt'
}[method] || method);

export default function ShiftRecordsView({ settings, language }: ShiftRecordsViewProps) {
  const ar = language === 'ar';
  const [records, setRecords] = useState<ShiftClosing[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [bucketFilter, setBucketFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const fmt = (n: number) =>
    num(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + (ar ? ' ج.م' : ' EGP');
  const stamp = (iso: string) => new Date(iso).toLocaleString(ar ? 'ar-EG' : 'en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const load = async () => {
    setLoading(true);
    try {
      const [shiftRows, dailyRows, allOrders, allExpenses, allPayments, products, categories] = await Promise.all([
        db.getShiftClosings(),
        db.getDailyClosings(),
        db.getOrders(),
        db.getExpenses(),
        db.getCustomerPayments(),
        db.getProducts(),
        db.getCategories(),
      ]);

      // شاشة السجلات كانت تقرأ shift_closings فقط، بينما تقفيل الخزنتين
      // يُحفظ في daily_closings. نعرض النوعين في نفس الشاشة.
      const dailyAsRecords: ShiftClosing[] = (dailyRows || []).map((d: DailyClosing) => {
        const dayOrders = (allOrders || []).filter(o =>
          o.status === 'completed' &&
          o.payment_method !== 'staff' &&
          o.payment_method !== 'hospitality' &&
          (o.operating_day || localDay(o.created_at)) === d.closing_date
        );
        const dayExpenses = (allExpenses || []).filter(e => localDay(e.expense_date || e.created_at) === d.closing_date);
        const dayPayments = (allPayments || []).filter(p => localDay(p.payment_date || p.created_at) === d.closing_date);
        const daySubtotal = dayOrders.reduce((s, o) => s + orderSubtotal(o), 0);
        const dayCollected = dayOrders.reduce((s, o) => s + num(o.total_price), 0);
        const dayPartnerDebt = dayOrders.filter(o => o.payment_method === 'partner' || o.partner_id)
          .reduce((s, o) => s + num(o.partner_amount_due ?? o.total_price), 0);
        const dayTax = dayOrders.reduce((s, o) => {
          if (o.payment_method === 'partner' || o.partner_id) return s;
          return s + orderSubtotal(o) * taxPercentForOrder(settings, o.order_type, o.hall) / 100;
        }, 0);
        const categoryMap = new Map<string, { sort: number; lines: Map<string, { name: string; qty: number; total: number }> }>();
        dayOrders.forEach(o => (o.items || []).forEach((item: any) => {
          const product = (products || []).find((p: any) => p.name_ar === item.name_ar || p.name_en === item.name_en || p.name === item.name);
          const category = product ? (categories || []).find((c: any) => c.id === product.category_id) : undefined;
          const categoryName = category ? (ar ? category.name_ar : category.name_en) : (ar ? 'غير مصنّف' : 'Uncategorised');
          const categorySort = category ? num(category.sort_order) : 9999;
          if (!categoryMap.has(categoryName)) categoryMap.set(categoryName, { sort: categorySort, lines: new Map() });
          const group = categoryMap.get(categoryName)!;
          const itemName = ar ? (item.name_ar || item.name_en || item.name) : (item.name_en || item.name_ar || item.name);
          const line = group.lines.get(itemName) || { name: itemName, qty: 0, total: 0 };
          line.qty += num(item.quantity);
          line.total += num(item.price) * num(item.quantity);
          group.lines.set(itemName, line);
        }));
        const dayCategories = [...categoryMap.entries()].sort((a, b) => a[1].sort - b[1].sort).map(([name, group]) => {
          const lines = [...group.lines.values()].sort((a, b) => b.total - a.total);
          return { name, lines, qty: lines.reduce((s, line) => s + line.qty, 0), total: lines.reduce((s, line) => s + line.total, 0) };
        });
        const dayTaxMap = new Map<number, { percent: number; base: number; tax: number; collected: number; orders: number }>();
        dayOrders.forEach(o => {
          const percent = o.payment_method === 'partner' || o.partner_id ? 0 : taxPercentForOrder(settings, o.order_type, o.hall);
          const base = orderSubtotal(o);
          const row = dayTaxMap.get(percent) || { percent, base: 0, tax: 0, collected: 0, orders: 0 };
          row.base += base;
          row.tax += percent ? base * percent / 100 : 0;
          row.collected += num(o.total_price);
          row.orders += 1;
          dayTaxMap.set(percent, row);
        });
        const drawerMethods = [
          ...(d.drawer_1_methods || []).map(m => ({ ...m, drawer: 1 })),
          ...(d.drawer_2_methods || []).map(m => ({ ...m, drawer: 2 })),
        ];
        const methods = drawerMethods.map(m => ({
          method: m.method,
          label: `${m.drawer ? `خزنة ${m.drawer} - ` : ''}${m.method}`,
          amount: num(m.expected),
        }));
        const closedAt = d.closed_at || d.created_at || `${d.closing_date}T23:59:59`;
        const drawerBreakdown = ([1, 2] as const).map(drawer => {
          const orders = dayOrders.filter(o => (o.drawer || (o.hall ? drawerOfHall(o.hall, settings) : 1)) === drawer);
          const expenses = (allExpenses || []).filter(e => localDay(e.expense_date || e.created_at) === d.closing_date && (e.drawer || 1) === drawer);
          const payments = (allPayments || []).filter(p => localDay(p.payment_date || p.created_at) === d.closing_date && (p.drawer || 1) === drawer);
          const subtotal = orders.reduce((s, o) => s + orderSubtotal(o), 0);
          const collected = orders.reduce((s, o) => s + num(o.total_price), 0);
          const partnerDebt = orders.filter(o => o.payment_method === 'partner').reduce((s, o) => s + num(o.partner_amount_due ?? o.total_price), 0);
          const tax = orders.reduce((s, o) => s + (o.payment_method === 'partner' || o.partner_id ? 0 : orderSubtotal(o) * taxPercentForOrder(settings, o.order_type, o.hall) / 100), 0);
          const deposits = payments.reduce((s, p) => s + num(p.amount), 0);
          const expenseTotal = expenses.reduce((s, e) => s + num(e.amount), 0);
          const methods = [
            ...(d.drawer_1_methods && drawer === 1 ? d.drawer_1_methods : drawer === 2 ? (d.drawer_2_methods || []) : []),
          ].map(m => ({ label: methodLabel(m.method, ar), amount: num(m.incoming ?? m.expected) }));
          const expensesByMethod = Object.entries(expenses.reduce((acc: Record<string, number>, e) => { const key = e.payment_method || 'cash'; acc[key] = (acc[key] || 0) + num(e.amount); return acc; }, {})).map(([method, amount]) => ({ method, label: methodLabel(method, ar), amount }));
          const taxMap: Record<string, { percent: number; base: number; tax: number; collected: number; orders: number }> = {};
          orders.forEach(o => { const percent = o.payment_method === 'partner' || o.partner_id ? 0 : taxPercentForOrder(settings, o.order_type, o.hall); const key = String(percent); const row = taxMap[key] || (taxMap[key] = { percent, base: 0, tax: 0, collected: 0, orders: 0 }); row.base += orderSubtotal(o); row.tax += percent ? orderSubtotal(o) * percent / 100 : 0; row.collected += num(o.total_price); row.orders += 1; });
          return { drawer, label: ar ? `خزنة ${drawer}` : `Drawer ${drawer}`, ordersCount: orders.length, subtotal, tax, discount: Math.max(0, subtotal + tax - collected), collected, deposits, expenses: expenseTotal, expectedBalance: collected - partnerDebt + deposits - expenseTotal, methods, expensesByMethod, taxGroups: Object.values(taxMap) };
        });
        return {
          id: `daily-${d.id || d.closing_date}`,
          bucket: 'daily',
          bucket_label: `تقفيل اليوم — ${d.closing_date}`,
          from_at: `${d.closing_date}T00:00:00`,
          to_at: closedAt,
          orders_count: dayOrders.length,
          items_count: dayCategories.reduce((s, c) => s + c.qty, 0),
          subtotal: daySubtotal,
          tax: dayTax,
          discount: Math.max(0, daySubtotal + dayTax - dayCollected),
          collected: dayCollected,
          methods,
          order_types: [],
          tax_groups: [...dayTaxMap.values()].sort((a, b) => b.percent - a.percent),
          categories: dayCategories,
          order_ids: dayOrders.map(o => o.id),
          closed_by: d.closed_by,
          created_at: d.created_at || closedAt,
          deposits: dayPayments.reduce((s, p) => s + num(p.amount), 0),
          expenses: dayExpenses.reduce((s, e) => s + num(e.amount), 0),
          expectedBalance: dayCollected - dayPartnerDebt + dayPayments.reduce((s, p) => s + num(p.amount), 0) - dayExpenses.reduce((s, e) => s + num(e.amount), 0),
          depositsByMethod: Object.entries(dayPayments.reduce((acc: Record<string, number>, p) => { const key = p.payment_method || 'cash'; acc[key] = (acc[key] || 0) + num(p.amount); return acc; }, {})).map(([method, amount]) => ({ method, label: methodLabel(method, ar), amount })),
          expensesByMethod: Object.entries(dayExpenses.reduce((acc: Record<string, number>, e) => { const key = e.payment_method || 'cash'; acc[key] = (acc[key] || 0) + num(e.amount); return acc; }, {})).map(([method, amount]) => ({ method, label: methodLabel(method, ar), amount })),
          drawerBreakdown,
        };
      });

      const merged = [...shiftRows, ...dailyAsRecords];
      const byId = new Map<string, ShiftClosing>();
      merged.forEach(row => byId.set(row.id, row));
      setRecords([...byId.values()].sort((a, b) => new Date(b.to_at).getTime() - new Date(a.to_at).getTime()));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const buckets = useMemo(() => [...new Set(records.map(r => r.bucket))], [records]);

  const filtered = useMemo(() => records.filter(r => {
    if (bucketFilter !== 'all' && r.bucket !== bucketFilter) return false;
    const day = new Date(r.to_at);
    const localDay = new Date(day.getTime() - day.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    if (fromDate && localDay < fromDate) return false;
    if (toDate && localDay > toDate) return false;
    return true;
  }), [records, bucketFilter, fromDate, toDate]);

  const totals = useMemo(() => ({
    collected: filtered.reduce((s, r) => s + num(r.collected), 0),
    subtotal: filtered.reduce((s, r) => s + num(r.subtotal), 0),
    tax: filtered.reduce((s, r) => s + num(r.tax), 0),
    orders: filtered.reduce((s, r) => s + num(r.orders_count), 0),
  }), [filtered]);

  // إعادة طباعة السجل من نفس البيانات المحفوظة وقت التقفيل
  const reprint = (r: ShiftClosing) => {
    const from = new Date(r.from_at);
    const to = new Date(r.to_at);
    const sameDay = from.toDateString() === to.toDateString();
    printShiftClosing({
      title: r.bucket_label,
      dayLabel: sameDay
        ? to.toLocaleDateString(ar ? 'ar-EG' : 'en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
        : `${from.toLocaleDateString(ar ? 'ar-EG' : 'en-GB')} → ${to.toLocaleDateString(ar ? 'ar-EG' : 'en-GB')}`,
      fromTime: from.toLocaleString(ar ? 'ar-EG' : 'en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
      toTime: to.toLocaleString(ar ? 'ar-EG' : 'en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
      ordersCount: num(r.orders_count),
      itemsCount: num(r.items_count),
      subtotal: num(r.subtotal),
      tax: num(r.tax),
      discount: num(r.discount),
      collected: num(r.collected),
      deposits: num(r.deposits),
      expenses: num(r.expenses),
      expectedBalance: r.expectedBalance !== undefined ? num(r.expectedBalance) : num(r.collected) + num(r.deposits) - num(r.expenses),
      depositsByMethod: (r.depositsByMethod || []).map(m => ({ method: m.method, label: m.label, amount: num(m.amount) })),
      expensesByMethod: (r.expensesByMethod || []).map(m => ({ method: m.method, label: m.label, amount: num(m.amount) })),
      methods: (r.methods || []).map(m => ({ label: m.label, amount: num(m.amount) })),
      orderTypes: r.order_types || [],
      taxGroups: r.tax_groups || [],
      categories: r.categories || [],
    }, language, settings);
  };

  return (
    <div className="admin-content-section fade-in">
      <div className="section-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <h2>{ar ? 'سجلات تقفيل الشفتات' : 'Shift Closing Records'}</h2>
        <button className="btn-gold outline" onClick={load}>
          <RefreshCw size={16} /> {ar ? 'تحديث' : 'Refresh'}
        </button>
      </div>

      {/* فلاتر */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '1.5rem' }}>
        <div className="form-group" style={{ minWidth: '180px' }}>
          <label>{ar ? 'الصالة' : 'Hall'}</label>
          <select className="input-gold" value={bucketFilter} onChange={e => setBucketFilter(e.target.value)}>
            <option value="all">{ar ? 'الكل' : 'All'}</option>
            {buckets.map(b => (
              <option key={b} value={b}>{records.find(r => r.bucket === b)?.bucket_label || b}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>{ar ? 'من تاريخ' : 'From'}</label>
          <input type="date" className="input-gold" value={fromDate} onChange={e => setFromDate(e.target.value)} />
        </div>
        <div className="form-group">
          <label>{ar ? 'إلى تاريخ' : 'To'}</label>
          <input type="date" className="input-gold" value={toDate} onChange={e => setToDate(e.target.value)} />
        </div>
        {(bucketFilter !== 'all' || fromDate || toDate) && (
          <button className="btn-gold outline" onClick={() => { setBucketFilter('all'); setFromDate(''); setToDate(''); }}>
            {ar ? 'مسح الفلاتر' : 'Clear filters'}
          </button>
        )}
      </div>

      {/* ملخص */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
        <Stat title={ar ? 'عدد التقفيلات' : 'Closings'} value={String(filtered.length)} c="var(--gold-primary)" />
        <Stat title={ar ? 'عدد الأوردرات' : 'Orders'} value={String(totals.orders)} c="#3b82f6" />
        <Stat title={ar ? 'قبل الضريبة' : 'Before tax'} value={fmt(totals.subtotal)} c="#9ca3af" />
        <Stat title={ar ? 'الضريبة' : 'Tax'} value={fmt(totals.tax)} c="#f59e0b" />
        <Stat title={ar ? 'إجمالي المحصل' : 'Collected'} value={fmt(totals.collected)} c="#10b981" />
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-gray)' }}>{ar ? 'جاري التحميل…' : 'Loading…'}</p>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-gray)' }}>
          <FileText size={56} style={{ opacity: 0.2, marginBottom: '1rem' }} />
          <p>{records.length === 0
            ? (ar ? 'مفيش سجلات تقفيل لسه' : 'No closing records yet')
            : (ar ? 'مفيش سجلات مطابقة للفلاتر' : 'No records match the filters')}</p>
              {records.length === 0 && (
            <p style={{ fontSize: '0.85rem', maxWidth: '520px', margin: '1rem auto 0', lineHeight: 1.7 }}>
              {ar
                ? 'لم يتم العثور على سجلات في shift_closings أو daily_closings. تأكد من تشغيل ترحيلات التقفيل والصلاحيات ثم اضغط تحديث.'
                : 'No records were found in shift_closings or daily_closings. Check the closing migrations and permissions, then refresh.'}
            </p>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filtered.map(r => {
            const open = expanded === r.id;
            return (
              <div key={r.id} style={{ background: 'var(--bg-darker)', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
                {/* سطر السجل */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 220px' }}>
                    <div style={{ color: 'var(--gold-primary)', fontWeight: 800, fontSize: '1.05rem' }}>{r.bucket_label}</div>
                    <div style={{ color: 'var(--text-gray)', fontSize: '0.82rem', marginTop: '0.2rem' }}>
                      {ar ? 'من' : 'From'} {stamp(r.from_at)} → {stamp(r.to_at)}
                    </div>
                    {r.closed_by && (
                      <div style={{ color: 'var(--text-gray)', fontSize: '0.8rem' }}>
                        {ar ? 'قفلها:' : 'Closed by:'} <b style={{ color: 'var(--text-light)' }}>{r.closed_by}</b>
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'center', minWidth: '80px' }}>
                    <div style={{ color: 'var(--text-gray)', fontSize: '0.75rem' }}>{ar ? 'أوردرات' : 'Orders'}</div>
                    <div style={{ color: 'var(--text-light)', fontWeight: 800 }}>{r.orders_count}</div>
                  </div>
                  <div style={{ textAlign: 'center', minWidth: '110px' }}>
                    <div style={{ color: 'var(--text-gray)', fontSize: '0.75rem' }}>{ar ? 'الضريبة' : 'Tax'}</div>
                    <div style={{ color: '#f59e0b', fontWeight: 800 }}>{fmt(r.tax)}</div>
                  </div>
                  <div style={{ textAlign: 'center', minWidth: '130px' }}>
                    <div style={{ color: 'var(--text-gray)', fontSize: '0.75rem' }}>{ar ? 'المحصل' : 'Collected'}</div>
                    <div style={{ color: '#10b981', fontWeight: 900, fontSize: '1.05rem' }}>{fmt(r.collected)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button className="btn-gold" style={{ padding: '0.45rem 0.8rem', fontSize: '0.85rem' }} onClick={() => reprint(r)}>
                      <Printer size={15} /> {ar ? 'طباعة' : 'Print'}
                    </button>
                    <button className="btn-gold outline" style={{ padding: '0.45rem 0.7rem' }} onClick={() => setExpanded(open ? null : r.id)}>
                      {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {/* التقرير الكامل */}
                {open && (
                  <div style={{ borderTop: '1px solid var(--border-color)', padding: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                    <div>
                      <h4 style={{ color: 'var(--gold-primary)', margin: '0 0 0.75rem' }}>{ar ? 'التقسيم في الخزنة' : 'Drawer split'}</h4>
                      {(r.methods || []).length === 0 ? (
                        <p style={{ color: 'var(--text-gray)' }}>{ar ? 'لا يوجد' : 'None'}</p>
                      ) : (r.methods || []).map((m, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <span style={{ color: 'var(--text-light)' }}>{m.label}</span>
                          <b style={{ color: 'var(--text-light)' }}>{fmt(m.amount)}</b>
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderTop: '2px solid var(--gold-primary)', marginTop: '0.4rem' }}>
                        <b style={{ color: 'var(--text-light)' }}>{ar ? 'الإجمالي' : 'Total'}</b>
                        <b style={{ color: '#10b981' }}>{fmt(r.collected)}</b>
                      </div>

                      {/* حسب نوع الطلب */}
                      <h4 style={{ color: 'var(--gold-primary)', margin: '1.5rem 0 0.75rem' }}>{ar ? 'حسب نوع الطلب' : 'By order type'}</h4>
                      {(r.order_types || []).length === 0 ? (
                        <p style={{ color: 'var(--text-gray)' }}>{ar ? 'لا يوجد' : 'None'}</p>
                      ) : (r.order_types || []).map((t, i) => (
                        <div key={i} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem', marginBottom: '0.5rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-light)', fontWeight: 800 }}>
                            <span>{t.label}</span><span>{t.orders} {ar ? 'أوردر' : 'ord.'}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-gray)', marginTop: '0.3rem' }}>
                            <span>{ar ? 'قبل الضريبة' : 'Before tax'}</span><span>{fmt(t.subtotal)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#f59e0b' }}>
                            <span>{ar ? 'الضريبة' : 'Tax'}</span><span>{fmt(t.tax)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#10b981', fontWeight: 800 }}>
                            <span>{ar ? 'المحصل' : 'Collected'}</span><span>{fmt(t.collected)}</span>
                          </div>
                        </div>
                      ))}

                      {/* تجميع الضرائب */}
                      <h4 style={{ color: 'var(--gold-primary)', margin: '1.5rem 0 0.75rem' }}>{ar ? 'تجميع الضرائب' : 'Tax summary'}</h4>
                      {(r.tax_groups || []).length === 0 ? (
                        <p style={{ color: 'var(--text-gray)' }}>{ar ? 'لا يوجد' : 'None'}</p>
                      ) : (r.tax_groups || []).map((g, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <span style={{ color: 'var(--text-light)' }}>
                            {g.percent > 0 ? (ar ? `ضريبة ${g.percent}%` : `Tax ${g.percent}%`) : (ar ? 'بدون ضريبة' : 'No tax')}
                            <span style={{ color: 'var(--text-gray)', fontSize: '0.8rem', marginInlineStart: '0.5rem' }}>
                              ({ar ? 'وعاء' : 'base'} {fmt(g.base)})
                            </span>
                          </span>
                          <b style={{ color: '#f59e0b' }}>{fmt(g.tax)}</b>
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderTop: '2px solid #f59e0b', marginTop: '0.4rem' }}>
                        <b style={{ color: 'var(--text-light)' }}>{ar ? 'إجمالي الضرائب' : 'Total tax'}</b>
                        <b style={{ color: '#f59e0b' }}>{fmt(r.tax)}</b>
                      </div>
                    </div>

                    <div>
                      <h4 style={{ color: 'var(--gold-primary)', margin: '0 0 0.75rem' }}>
                        {ar ? 'الأصناف المباعة حسب التصنيف' : 'Items by category'} ({r.items_count})
                      </h4>
                      <div style={{ maxHeight: '340px', overflowY: 'auto' }} className="custom-scrollbar">
                        {(r.categories || []).map((c, ci) => (
                          <div key={ci} style={{ marginBottom: '1rem' }}>
                            <div style={{ background: '#111', color: 'var(--gold-primary)', fontWeight: 800, padding: '0.4rem 0.6rem', borderRadius: '6px' }}>
                              {c.name} — {c.qty} — {fmt(c.total)}
                            </div>
                            {c.lines.map((l, li) => (
                              <div key={li} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', padding: '0.4rem 0.6rem', borderBottom: '1px dotted rgba(255,255,255,0.08)' }}>
                                <span style={{ color: 'var(--text-light)' }}>
                                  <b style={{ color: 'var(--gold-primary)', marginInlineEnd: '0.5rem' }}>{l.qty}×</b>{l.name}
                                </span>
                                <span style={{ color: 'var(--text-light)' }}>{fmt(l.total)}</span>
                              </div>
                            ))}
                          </div>
                        ))}
                        {(r.categories || []).length === 0 && (
                          <p style={{ color: 'var(--text-gray)' }}>{ar ? 'لا يوجد' : 'None'}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ title, value, c }: { title: string; value: string; c: string }) {
  return (
    <div className="stat-card" style={{ background: 'var(--bg-darker)', border: '1px solid var(--border-color)', borderTop: `4px solid ${c}` }}>
      <h3 style={{ color: 'var(--text-gray)', fontSize: '0.95rem', margin: '0 0 0.5rem' }}>{title}</h3>
      <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: c, margin: 0 }}>{value}</p>
    </div>
  );
}

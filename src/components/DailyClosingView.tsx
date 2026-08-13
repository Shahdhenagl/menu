import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Lock, Printer, Wallet } from 'lucide-react';
import type { Category, DailyClosing, DailyClosingMethod, Expense, Order, PaymentMethodKey, Product, RestaurantSettings, DrawerId } from '../types';
import { db } from '../lib/supabase';

interface Props {
  orders: Order[];
  expenses: Expense[];
  categories?: Category[];
  products?: Product[];
  financialTransactions?: any[];
  settings?: RestaurantSettings;
  language: 'ar' | 'en';
  userName?: string;
  userRole?: string;
}

const METHODS: PaymentMethodKey[] = ['cash', 'visa', 'wallet_restaurant', 'wallet_cafe', 'instapay', 'deferred', 'petty_cash', 'partner'];
const n = (value: unknown) => Number(value) || 0;
const localDate = (value: string | number | Date) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
};
const today = () => localDate(new Date());

export default function DailyClosingView({ orders, expenses, language, userName }: Props) {
  const ar = language === 'ar';
  // لا تستخدم تاريخ الجهاز كبداية افتراضية؛ يوم التشغيل قد يمتد بعد منتصف الليل.
  // نقرأ اليوم النشط الذي تم إنشاؤه بعد إغلاق الخزنتين حتى لا تعود الشاشة لليوم السابق بعد refresh.
  const [selectedDate, setSelectedDate] = useState('');
  const [activeDrawer, setActiveDrawer] = useState<DrawerId>(1);
  const [closing, setClosing] = useState<DailyClosing | null>(null);
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const dayOrders = useMemo(() => orders.filter(order =>
    order.status === 'completed' && order.payment_method !== 'hospitality' && order.payment_method !== 'staff' && (order.operating_day || localDate(order.created_at)) === selectedDate
  ), [orders, selectedDate]);
  const dayExpenses = useMemo(() => expenses.filter(expense => localDate(expense.expense_date || expense.created_at || '') === selectedDate), [expenses, selectedDate]);
  const openTableOrders = useMemo(() => orders.filter(order =>
    (order.operating_day || localDate(order.created_at)) === selectedDate &&
    !['completed', 'cancelled'].includes(order.status) &&
    order.table_number && order.table_number !== '-'
  ), [orders, selectedDate]);

  const drawerOrders = useMemo(() => dayOrders.filter(order => (order.drawer || 1) === activeDrawer), [dayOrders, activeDrawer]);
  const drawerExpenses = useMemo(() => dayExpenses.filter(expense => (expense.drawer || 1) === activeDrawer), [dayExpenses, activeDrawer]);

  const incoming = useMemo(() => {
    const result = Object.fromEntries(METHODS.map(method => [method, 0])) as Record<PaymentMethodKey, number>;
    drawerOrders.forEach(order => {
      if (order.payment_method === 'split' && order.payment_details) {
        METHODS.forEach(method => {
          const cashierWallet = method === 'wallet_restaurant' ? n(order.payment_details?.wallet_cashier) : 0;
          result[method] += Math.max(0, n(order.payment_details?.[method]) - n(order.payment_details?.tip_by_method?.[method])) + cashierWallet;
        });
      } else {
        const method = order.payment_method as PaymentMethodKey;
        result[method] = (result[method] || 0) + n(method === 'partner' ? (order.partner_amount_due ?? order.total_price) : order.total_price);
      }
    });
    return result;
  }, [drawerOrders]);
  const tipsByMethod = useMemo(() => {
    const result = Object.fromEntries(METHODS.map(method => [method, 0])) as Record<PaymentMethodKey, number>;
    drawerOrders.forEach(order => {
      const details = order.payment_details || {};
      if (details.tip_by_method && typeof details.tip_by_method === 'object') {
        Object.entries(details.tip_by_method).forEach(([method, value]) => {
          if (result[method as PaymentMethodKey] !== undefined) result[method as PaymentMethodKey] += n(value);
        });
      } else if (n(details.tip_total) > 0) {
        const method = (order.payment_method === 'split' ? 'cash' : order.payment_method) as PaymentMethodKey;
        if (result[method] !== undefined) result[method] += n(details.tip_total);
      }
    });
    return result;
  }, [drawerOrders]);
  const totalTips = Object.values(tipsByMethod).reduce((sum, value) => sum + value, 0);
  const outgoing = useMemo(() => {
    const result = Object.fromEntries(METHODS.map(method => [method, 0])) as Record<PaymentMethodKey, number>;
    drawerExpenses.forEach(expense => {
      const method = expense.payment_method;
      result[method] = (result[method] || 0) + n(expense.amount);
    });
    return result;
  }, [drawerExpenses]);
  const expected = useMemo(() => Object.fromEntries(METHODS.map(method => [method, method === 'partner' ? 0 : incoming[method] - outgoing[method]])) as Record<PaymentMethodKey, number>, [incoming, outgoing]);
  const activeMethods = useMemo(() => METHODS.filter(method => incoming[method] !== 0 || outgoing[method] !== 0 || (closing?.[`drawer_${activeDrawer}_methods` as 'drawer_1_methods'] || []).some(row => row.method === method)), [incoming, outgoing, closing, activeDrawer]);
  const totalIncoming = activeMethods.reduce((sum, method) => sum + incoming[method], 0);
  const totalOutgoing = activeMethods.reduce((sum, method) => sum + outgoing[method], 0);
  const totalExpected = activeMethods.reduce((sum, method) => sum + expected[method], 0);
  const totalCounted = activeMethods.reduce((sum, method) => sum + (method === 'partner' ? 0 : n(counted[method])), 0);
  const difference = totalCounted - totalExpected;
  const drawerClosed = activeDrawer === 1 ? Boolean(closing?.drawer_1_closed) : Boolean(closing?.drawer_2_closed);
  const bothClosed = Boolean(closing?.drawer_1_closed && closing?.drawer_2_closed);

  const methodLabel = (method: PaymentMethodKey) => ({
    cash: ar ? 'كاش' : 'Cash', visa: ar ? 'فيزا' : 'Visa', wallet_restaurant: ar ? 'محفظة المطعم' : 'Restaurant Wallet',
    wallet_cafe: ar ? 'محفظة الكافيه' : 'Cafe Wallet', instapay: ar ? 'إنستاباي' : 'Instapay', deferred: ar ? 'آجل' : 'Deferred', petty_cash: ar ? 'عهدة' : 'Petty Cash', partner: ar ? 'مديونية شريك' : 'Partner Debt'
  }[method]);
  const fmt = (value: number) => `${n(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${ar ? 'ج.م' : 'EGP'}`;

  useEffect(() => {
    let cancelled = false;
    db.getCurrentOperatingDay().then(state => {
      if (!cancelled && state?.date) setSelectedDate(state.date);
    }).catch(error => console.warn('Failed to load current operating day', error));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selectedDate) return;
    let cancelled = false;
    setLoading(true);
    db.getDailyClosing(selectedDate).then(found => {
      if (cancelled) return;
      setClosing(found);
      const rows = activeDrawer === 1 ? found?.drawer_1_methods || found?.methods || [] : found?.drawer_2_methods || [];
      setCounted(Object.fromEntries(rows.map(row => [row.method, String(row.counted)])));
      setNotes(found?.notes || '');
    }).catch(() => !cancelled && setClosing(null)).finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [selectedDate, activeDrawer]);

  const closeDrawer = async () => {
    if (openTableOrders.length) {
      alert(ar ? `لا يمكن التقفيل: يوجد ${openTableOrders.length} طاولة عليها طلبات مفتوحة.` : `Cannot close: ${openTableOrders.length} tables still have open orders.`);
      return;
    }
    if (!activeMethods.length) {
      alert(ar ? 'لا توجد حركة مالية لهذه الخزنة في اليوم.' : 'There is no financial movement for this drawer today.');
      return;
    }
    const rows: DailyClosingMethod[] = activeMethods.map(method => ({ method, incoming: incoming[method], outgoing: outgoing[method], expected: expected[method], counted: n(counted[method]), difference: n(counted[method]) - expected[method], note: '' }));
    const previous = closing;
    const drawer1Rows = activeDrawer === 1 ? rows : previous?.drawer_1_methods || previous?.methods || [];
    const drawer2Rows = activeDrawer === 2 ? rows : previous?.drawer_2_methods || [];
    const drawer1Expected = drawer1Rows.reduce((sum, row) => sum + n(row.expected), 0);
    const drawer2Expected = drawer2Rows.reduce((sum, row) => sum + n(row.expected), 0);
    const drawer1Counted = drawer1Rows.reduce((sum, row) => sum + n(row.counted), 0);
    const drawer2Counted = drawer2Rows.reduce((sum, row) => sum + n(row.counted), 0);
    setSaving(true);
    try {
      const saved = await db.saveDailyClosing({
        closing_date: selectedDate,
        status: activeDrawer === 2 && previous?.drawer_1_closed ? 'closed' : 'reopened',
        methods: [...drawer1Rows, ...drawer2Rows],
        total_expected: drawer1Expected + drawer2Expected,
        total_counted: drawer1Counted + drawer2Counted,
        total_difference: drawer1Counted + drawer2Counted - drawer1Expected - drawer2Expected,
        orders_count: dayOrders.length,
        expenses_count: dayExpenses.length,
        notes,
        closed_by: userName || '-',
        drawer_1_closed: activeDrawer === 1 ? true : Boolean(previous?.drawer_1_closed),
        drawer_2_closed: activeDrawer === 2 ? true : Boolean(previous?.drawer_2_closed),
        drawer_1_methods: drawer1Rows,
        drawer_2_methods: drawer2Rows,
        drawer_1_total_expected: drawer1Expected,
        drawer_2_total_expected: drawer2Expected,
        drawer_1_total_counted: drawer1Counted,
        drawer_2_total_counted: drawer2Counted,
      });
      if ((saved as any).__localOnly) {
        const remoteReason = (saved as any).__errorMessage;
        throw new Error(ar
          ? `تم الحفظ على هذا الجهاز فقط ولم يتم تأكيده في Supabase.${remoteReason ? `\n\nخطأ Supabase: ${remoteReason}` : '\n\nشغّل ترحيل daily_closings وتحقق من صلاحيات الجدول.'}`
          : `The closing was saved locally only and was not confirmed in Supabase.${remoteReason ? `\n\nSupabase error: ${remoteReason}` : '\n\nRun the daily_closings migration and check table permissions.'}`);
      }
      const persisted = await db.getDailyClosing(selectedDate);
      if (!persisted || persisted.id !== saved.id || !persisted.drawer_1_closed && activeDrawer === 1 || !persisted.drawer_2_closed && activeDrawer === 2) {
        throw new Error('Daily closing was not confirmed after saving.');
      }
      setClosing(persisted);
      if (persisted.drawer_1_closed && persisted.drawer_2_closed) {
        const nextDay = await db.startNextOperatingDay(selectedDate);
        // إغلاق الخزنتين يعني سحب الرصيد المرحّل؛ افتح شاشة التقرير على يوم التشغيل الجديد.
        setSelectedDate(nextDay.date);
        setClosing(null);
        setCounted({});
        setNotes('');
      }
      alert(persisted.drawer_1_closed && persisted.drawer_2_closed ? (ar ? 'تم إغلاق الخزنتين وانتهى يوم التشغيل. بدأ يوم جديد تلقائيًا، والتقرير بدأ من الصفر.' : 'Both drawers are closed. The operating day is complete, a new day has started, and the report has been reset.') : (ar ? `تم إغلاق الخزنة ${activeDrawer}. أغلق الخزنة الأخرى لطباعة التقرير.` : `Drawer ${activeDrawer} closed. Close the other drawer to print the report.`));
    } catch (error) {
      console.error(error);
      const reason = error instanceof Error ? error.message : String(error || 'Unknown error');
      alert(ar ? `حدث خطأ أثناء حفظ تقفيل الخزنة.\n\nالسبب: ${reason}` : `Failed to close the drawer.\n\nReason: ${reason}`);
    } finally { setSaving(false); }
  };

  const printReport = () => {
    if (!bothClosed) { alert(ar ? 'لا يمكن الطباعة قبل إغلاق الخزنتين.' : 'Close both drawers before printing.'); return; }
    const drawerRows = (drawer: DrawerId) => (drawer === 1 ? closing?.drawer_1_methods : closing?.drawer_2_methods) || [];
    const section = (drawer: DrawerId) => {
      const drawerTipOrders = dayOrders.filter(order => (order.drawer || 1) === drawer);
      const tips = Object.fromEntries(METHODS.map(method => [method, 0])) as Record<PaymentMethodKey, number>;
      drawerTipOrders.forEach(order => {
        const details = order.payment_details || {};
        if (details.tip_by_method && typeof details.tip_by_method === 'object') {
          Object.entries(details.tip_by_method).forEach(([method, value]) => {
            if (tips[method as PaymentMethodKey] !== undefined) tips[method as PaymentMethodKey] += n(value);
          });
        } else if (n(details.tip_total) > 0) {
          const method = (order.payment_method === 'split' ? 'cash' : order.payment_method) as PaymentMethodKey;
          if (tips[method] !== undefined) tips[method] += n(details.tip_total);
        }
      });
      return `<h2>${ar ? `تقفيل خزنة ${drawer}` : `Drawer ${drawer} Closing`}</h2><table><tr><th>${ar ? 'وسيلة الدفع' : 'Method'}</th><th>${ar ? 'المحصل' : 'Collected'}</th><th>${ar ? 'الصادر' : 'Out'}</th><th>${ar ? 'المفروض' : 'Expected'}</th><th>${ar ? 'المعدود' : 'Counted'}</th><th>${ar ? 'الفرق' : 'Difference'}</th></tr>${drawerRows(drawer).map(row => `<tr><td>${methodLabel(row.method)}</td><td>${fmt(row.incoming)}</td><td>${fmt(row.outgoing)}</td><td>${fmt(row.expected)}</td><td>${fmt(row.counted)}</td><td>${fmt(row.difference)}</td></tr>`).join('')}</table><h3>${ar ? 'التبس للعرض فقط' : 'Tips — display only'}</h3><table><tr><th>${ar ? 'وسيلة الدفع' : 'Method'}</th><th>${ar ? 'التبس' : 'Tips'}</th></tr>${METHODS.filter(method => tips[method] > 0).map(method => `<tr><td>${methodLabel(method)}</td><td>${fmt(tips[method])}</td></tr>`).join('') || `<tr><td colspan="2">${ar ? 'لا يوجد تبس' : 'No tips'}</td></tr>`}</table>`;
    };
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html dir="${ar ? 'rtl' : 'ltr'}"><head><title>${ar ? 'تقرير تقفيل اليوم' : 'Daily Closing Report'}</title><style>body{font-family:Arial;padding:28px;color:#111}h1{text-align:center;border-bottom:2px solid #111;padding-bottom:12px}h2{margin-top:28px}table{width:100%;border-collapse:collapse;margin-top:10px}th,td{border:1px solid #bbb;padding:8px;text-align:center}th{background:#eee}.summary{display:flex;gap:20px;margin:20px 0}.card{border:1px solid #bbb;padding:12px;flex:1;text-align:center}</style></head><body><h1>${ar ? 'تقرير تقفيل اليوم' : 'Daily Closing Report'} - ${selectedDate}</h1><div class="summary"><div class="card">${ar ? 'إجمالي المحصل' : 'Total Collected'}<br><b>${fmt(dayOrders.reduce((sum, order) => sum + n(order.total_price), 0))}</b></div><div class="card">${ar ? 'عدد الطلبات' : 'Orders'}<br><b>${dayOrders.length}</b></div></div>${section(1)}${section(2)}<script>window.print()</script></body></html>`);
    win.document.close();
  };

  return <div className="admin-content-section fade-in" dir={ar ? 'rtl' : 'ltr'}>
    <div className="section-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
      <div><h2>{ar ? 'تقفيل اليوم' : 'Daily Closing'}</h2><p style={{ color: 'var(--text-gray)', margin: 0 }}>{ar ? 'إغلاق الخزنتين = نهاية يوم التشغيل وبداية يوم جديد' : 'Closing both drawers ends the operating day and starts a new one.'}</p></div>
      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}><input type="date" className="input-gold" value={selectedDate} max={today()} onChange={e => setSelectedDate(e.target.value)} /><button className="btn-gold" disabled={!bothClosed} onClick={printReport}><Printer size={16} /> {ar ? 'طباعة التقرير' : 'Print Report'}</button></div>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '1rem', margin: '1.2rem 0' }}>
      <Summary title={ar ? 'إجمالي المحصل من أول اليوم' : 'Total collected today'} value={fmt(dayOrders.reduce((sum, order) => sum + n(order.total_price), 0))} /><Summary title={ar ? 'إجمالي التبس — للعرض فقط' : 'Total tips — display only'} value={fmt(totalTips)} />
      <Summary title={ar ? 'الخزنة 1' : 'Drawer 1'} value={closing?.drawer_1_closed ? (ar ? 'مقفولة' : 'Closed') : (ar ? 'مفتوحة' : 'Open')} />
      <Summary title={ar ? 'الخزنة 2' : 'Drawer 2'} value={closing?.drawer_2_closed ? (ar ? 'مقفولة' : 'Closed') : (ar ? 'مفتوحة' : 'Open')} />
      <Summary title={ar ? 'الطلبات' : 'Orders'} value={String(dayOrders.length)} />
    </div>
    {openTableOrders.length > 0 && <div style={{ padding: '1rem', border: '1px solid #ef4444', color: '#fecaca', background: 'rgba(239,68,68,.1)', borderRadius: 10, marginBottom: '1rem' }}><AlertTriangle size={18} /> {ar ? `لا يمكن إغلاق اليوم حاليًا: ${openTableOrders.length} طاولة عليها طلبات مفتوحة (${openTableOrders.map(order => order.table_number).join('، ')}).` : `Cannot close: ${openTableOrders.length} tables have open orders.`}</div>}
    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
      {[1, 2].map(drawer => <button key={drawer} className={activeDrawer === drawer ? 'btn-gold' : 'btn-gold outline'} onClick={() => setActiveDrawer(drawer as DrawerId)}><Wallet size={17} /> {ar ? `تقفيل خزنة ${drawer}` : `Drawer ${drawer}`} {(drawer === 1 ? closing?.drawer_1_closed : closing?.drawer_2_closed) && <CheckCircle2 size={16} />}</button>)}
    </div>
    <div style={{ background: 'var(--bg-darker)', border: '1px solid var(--border-color)', borderRadius: 12, padding: '1.2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}><h3 style={{ margin: 0 }}>{ar ? `ملخص خزنة ${activeDrawer}` : `Drawer ${activeDrawer} Summary`}</h3><span style={{ color: drawerClosed ? '#10b981' : 'var(--gold-primary)', fontWeight: 700 }}>{drawerClosed ? <><Lock size={16} /> {ar ? 'مقفولة' : 'Closed'}</> : (ar ? 'مفتوحة' : 'Open')}</span></div>
      {loading ? <p>{ar ? 'جاري التحميل…' : 'Loading…'}</p> : <><div style={{ overflowX: 'auto', marginTop: '1rem' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}><thead><tr><th>وسيلة الدفع</th><th>المحصل</th><th>الصادر</th><th>المفروض</th><th>المعدود</th><th>الفرق</th></tr></thead><tbody>{activeMethods.map(method => <tr key={method}><td>{methodLabel(method)}</td><td>{fmt(incoming[method])}</td><td>{fmt(outgoing[method])}</td><td>{fmt(expected[method])}</td><td><input className="input-gold" type="number" step="0.01" disabled={drawerClosed || method === 'partner'} value={method === 'partner' ? '' : (counted[method] || '')} onChange={e => setCounted(prev => ({ ...prev, [method]: e.target.value }))} style={{ width: 120 }} /></td><td>{fmt(method === 'partner' ? 0 : n(counted[method]) - expected[method])}</td></tr>)}<tr><td><b>{ar ? 'الإجمالي' : 'Total'}</b></td><td><b>{fmt(totalIncoming)}</b></td><td><b>{fmt(totalOutgoing)}</b></td><td><b>{fmt(totalExpected)}</b></td><td><b>{fmt(totalCounted)}</b></td><td><b>{fmt(difference)}</b></td></tr></tbody></table></div><textarea className="input-gold" disabled={drawerClosed} value={notes} onChange={e => setNotes(e.target.value)} placeholder={ar ? 'ملاحظات التقفيل…' : 'Closing notes…'} style={{ width: '100%', marginTop: '1rem', minHeight: 70 }} /><div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}><button className="btn-gold" disabled={saving || drawerClosed || Boolean(openTableOrders.length)} onClick={closeDrawer}>{drawerClosed ? <><Lock size={16} /> {ar ? 'الخزنة مقفولة' : 'Drawer closed'}</> : <>{ar ? `إغلاق خزنة ${activeDrawer}` : `Close Drawer ${activeDrawer}`}</>}</button></div></>}
    </div>
  </div>;
}

function Summary({ title, value }: { title: string; value: string }) { return <div style={{ background: 'var(--bg-darker)', border: '1px solid var(--border-color)', borderRadius: 12, padding: '1rem' }}><div style={{ color: 'var(--text-gray)', fontSize: '.85rem' }}>{title}</div><strong style={{ display: 'block', color: 'var(--gold-primary)', fontSize: '1.25rem', marginTop: '.4rem' }}>{value}</strong></div>; }

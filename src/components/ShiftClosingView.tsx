import { useState, useEffect, useMemo, useCallback } from 'react';
import { Printer, Lock, RefreshCw } from 'lucide-react';
import type { Order, Category, Product, RestaurantSettings, ShiftClosing, Expense, CustomerPayment } from '../types';
import { db } from '../lib/supabase';
import { printShiftClosing } from '../utils/printUtils';
import { buildShiftReport, drawerOf, drawerName, DRAWERS } from '../utils/shiftClosing';

// مفتاح البوكيت بقى الخزنة: drawer:1 / drawer:2
const bucketOfDrawer = (id: 1 | 2) => `drawer:${id}`;

interface ShiftClosingViewProps {
  /** كل الأوردرات (بنفلتر المكتملة بنفسنا) */
  orders: Order[];
  categories: Category[];
  products: Product[];
  settings?: RestaurantSettings | null;
  language: 'ar' | 'en';
  userName?: string;
}

const num = (v: any): number => Number(v) || 0;

export default function ShiftClosingView({
  orders, categories, products, settings, language, userName,
}: ShiftClosingViewProps) {
  const ar = language === 'ar';
  const [lastByBucket, setLastByBucket] = useState<Record<string, ShiftClosing>>({});
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [customerPayments, setCustomerPayments] = useState<CustomerPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  const fmt = (n: number) =>
    num(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + (ar ? ' ج.م' : ' EGP');
  const timeOf = (iso: string) => new Date(iso).toLocaleString(ar ? 'ar-EG' : 'en-GB', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });

  // آخر تقفيل لكل صالة
  const loadLast = useCallback(async () => {
    setLoading(true);
    try {
      const [all, allExpenses, allPayments] = await Promise.all([
        db.getShiftClosings(),
        db.getExpenses(),
        db.getCustomerPayments(),
      ]);
      const map: Record<string, ShiftClosing> = {};
      all.forEach(c => {
        const prev = map[c.bucket];
        if (!prev || new Date(c.to_at).getTime() > new Date(prev.to_at).getTime()) map[c.bucket] = c;
      });
      setLastByBucket(map);
      setExpenses(allExpenses);
      setCustomerPayments(allPayments);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLast(); }, [loadLast]);

  // الأوردرات المكتملة بس (من غير الضيافة)
  const completed = useMemo(
    // الضيافة وفواتير الاستاف مجانية → مش مبيعات ومش بتدخل التقفيل
    () => orders.filter(o => o.status === 'completed' && o.payment_method !== 'hospitality' && o.payment_method !== 'staff'),
    [orders]
  );

  // خزنتين بس: خزنة 1 وخزنة 2
  const bucketKeys = useMemo(() => DRAWERS.map(bucketOfDrawer), []);
  const labelOf = useCallback(
    (bucket: string) => drawerName(bucket === 'drawer:2' ? 2 : 1, settings, ar),
    [settings, ar]
  );

  /** بداية الفترة الحالية للخزنة: آخر تقفيل، وإلا أول أوردر ليها، وإلا بداية النهاردة */
  const periodStart = useCallback((bucket: string): Date => {
    const last = lastByBucket[bucket];
    if (last) return new Date(last.to_at);
    const first = completed
      .filter(o => bucketOfDrawer(drawerOf(o, settings)) === bucket)
      .map(o => new Date(o.created_at).getTime())
      .sort((a, b) => a - b)[0];
    if (first) return new Date(first);
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, [lastByBucket, completed, settings]);

  const transactionTime = useCallback((value?: string, fallbackDate?: string): number => {
    const raw = value || fallbackDate;
    if (!raw) return 0;
    const parsed = new Date(raw.includes('T') ? raw : `${raw}T00:00:00`);
    return parsed.getTime();
  }, []);

  const openTransactionsOf = useCallback(<T extends { drawer?: 1 | 2; created_at?: string }>(
    bucket: string,
    items: T[],
    fallbackDate: (item: T) => string | undefined,
    endAt?: Date,
  ): T[] => {
    const start = periodStart(bucket).getTime();
    const end = (endAt || now).getTime();
    const last = lastByBucket[bucket];
    return items.filter(item => {
      const itemDrawer = item.drawer === 2 ? 2 : 1;
      if (bucketOfDrawer(itemDrawer) !== bucket) return false;
      const t = transactionTime(item.created_at, fallbackDate(item));
      return last ? t > start && t <= end : t >= start && t <= end;
    });
  }, [lastByBucket, periodStart, now, transactionTime]);

  /** أوردرات الفترة المفتوحة: بعد آخر تقفيل ولحد دلوقتي */
  const openOrdersOf = useCallback((bucket: string): Order[] => {
    const start = periodStart(bucket).getTime();
    const last = lastByBucket[bucket];
    // الأوردرات اللي دخلت آخر تقفيل — حماية إضافية لو أوردر اتقفل واتعدّل وقته
    const closedIds = new Set<string>(last?.order_ids || []);
    return completed.filter(o => {
      if (bucketOfDrawer(drawerOf(o, settings)) !== bucket) return false;
      if (closedIds.has(o.id)) return false;
      const t = new Date(o.created_at).getTime();
      // بعد آخر تقفيل تمامًا (أو من أول أوردر لو مفيش تقفيل سابق)
      return last ? t > start : t >= start;
    });
  }, [completed, lastByBucket, periodStart, settings]);

  const openOrdersOfBucket = useCallback((bucket: string): Order[] => {
    const openStatuses = new Set(['pending', 'preparing', 'prepared', 'delivered']);
    return orders.filter(o => openStatuses.has(o.status) && bucketOfDrawer(drawerOf(o, settings)) === bucket);
  }, [orders, settings]);

  const buildReport = useCallback((bucket: string, bucketOrders: Order[], from: Date, to: Date) =>
    buildShiftReport({
      title: labelOf(bucket),
      orders: bucketOrders,
      expenses: openTransactionsOf(bucket, expenses, e => e.expense_date, to),
      customerPayments: openTransactionsOf(bucket, customerPayments, p => p.payment_date, to),
      categories,
      products,
      settings,
      from,
      to,
      ar,
    }), [categories, products, settings, ar, labelOf, expenses, customerPayments, openTransactionsOf]);

  const handleClose = async (bucket: string) => {
    const blockingOrders = openOrdersOfBucket(bucket);
    if (blockingOrders.length > 0) {
      const details = blockingOrders.map(o => `#${o.id.slice(0, 6)}${o.table_number ? ` — ${ar ? 'طاولة' : 'Table'} ${o.table_number}` : ''}`).join('\n');
      alert(ar
        ? `لا يمكن تقفيل ${labelOf(bucket)} لأن هناك ${blockingOrders.length} أوردر مفتوح/غير مكتمل:\n\n${details}\n\nأكمل الأوردرات أو أغلقها أولًا ثم حاول التقفيل.`
        : `Cannot close ${labelOf(bucket)} because ${blockingOrders.length} order(s) are still open:\n\n${details}\n\nComplete or close them first.`);
      return;
    }
    const bucketOrders = openOrdersOf(bucket);
    const from = periodStart(bucket);
    const to = new Date();
    const bucketExpenses = openTransactionsOf(bucket, expenses, e => e.expense_date, to);
    const bucketPayments = openTransactionsOf(bucket, customerPayments, p => p.payment_date, to);
    if (bucketOrders.length === 0 && bucketExpenses.length === 0 && bucketPayments.length === 0) {
      alert(ar ? 'مفيش حركة جديدة من آخر تقفيل.' : 'No new activity since the last closing.');
      return;
    }
    const label = labelOf(bucket);
    const ok = window.confirm(
      ar
        ? `تقفيل شفت "${label}"\n\nمن: ${timeOf(from.toISOString())}\nإلى: ${timeOf(to.toISOString())}\nعدد الأوردرات: ${bucketOrders.length}\n\nبعد التقفيل الأوردرات دي مش هتتحسب في الشفت الجاي.`
        : `Close shift for "${label}"?\n\nFrom: ${timeOf(from.toISOString())}\nTo: ${timeOf(to.toISOString())}\nOrders: ${bucketOrders.length}`
    );
    if (!ok) return;

    setClosing(bucket);
    try {
      const report = buildReport(bucket, bucketOrders, from, to);
      const saved = await db.addShiftClosing({
        bucket,
        bucket_label: label,
        from_at: from.toISOString(),
        to_at: to.toISOString(),
        orders_count: report.ordersCount,
        items_count: report.itemsCount,
        subtotal: report.subtotal,
        tax: report.tax,
        discount: report.discount,
        collected: report.collected,
        deferred: report.deferred,
        deposits: report.deposits,
        expenses: report.expenses,
        expectedBalance: report.expectedBalance,
        depositsByMethod: report.depositsByMethod,
        expensesByMethod: report.expensesByMethod,
        methods: report.methodsRaw,
        order_types: report.orderTypes,
        tax_groups: report.taxGroups,
        categories: report.categories,
        order_ids: bucketOrders.map(o => o.id),
        closed_by: userName || '-',
      });
      if (saved.__localOnly) {
        throw new Error(ar
          ? 'لم يتم تأكيد حفظ التقفيل على Supabase. شغّل ترحيل shift_closings وتحقق من صلاحيات الجدول.'
          : 'The closing was not confirmed in Supabase. Run the shift_closings migration and check table permissions.');
      }
      const persisted = await db.getShiftClosings();
      const confirmed = persisted.some(c => c.id === saved.id && c.bucket === bucket);
      if (!confirmed) {
        throw new Error('Shift closing was inserted but could not be read back from Supabase.');
      }
      setLastByBucket(prev => ({ ...prev, [bucket]: saved }));
      await printShiftClosing(report, language, settings);
    } catch (err) {
      console.error(err);
      const reason = err instanceof Error ? err.message : String(err || 'Unknown error');
      alert(ar ? `حصل خطأ أثناء التقفيل.\n\nالسبب: ${reason}` : `Failed to close the shift.\n\nReason: ${reason}`);
    } finally {
      setClosing(null);
    }
  };

  const handlePreview = (bucket: string) => {
    const bucketOrders = openOrdersOf(bucket);
    const report = buildReport(bucket, bucketOrders, periodStart(bucket), now);
    printShiftClosing({ ...report, title: report.title + (ar ? ' (معاينة)' : ' (Preview)') }, language, settings);
  };

  const rows = bucketKeys.map(bucket => {
    const bucketOrders = openOrdersOf(bucket);
    const report = buildReport(bucket, bucketOrders, periodStart(bucket), now);
    return { bucket, bucketOrders, report, last: lastByBucket[bucket] };
  });

  const totalOpen = rows.reduce((s, r) => s + r.report.expectedBalance, 0);

  return (
    <div style={{ background: 'var(--bg-darker)', borderRadius: '12px', padding: '1.5rem', border: '1px solid var(--border-color)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.5rem' }}>
        <h3 style={{ margin: 0, color: 'var(--text-light)' }}>{ar ? 'تقفيل شفت الصالات' : 'Hall Shift Closing'}</h3>
        <button className="btn-gold outline" style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}
          onClick={() => { setNow(new Date()); loadLast(); }}>
          <RefreshCw size={15} /> {ar ? 'تحديث' : 'Refresh'}
        </button>
      </div>
      <p style={{ color: 'var(--text-gray)', fontSize: '0.88rem', margin: '0 0 1.25rem' }}>
        {ar
          ? 'التقفيل على مستوى الخزنة. كل خزنة بتتقفل من آخر تقفيل ليها لحد لحظة الضغط على الزر، والأوردرات اللي اتقفلت مش بتتحسب تاني. الصالات بتروح لخزنتها من الإعدادات، والدليفري/التيك أواي/الطلبات بتروح للخزنة اللي الكاشير اختارها وقت التحصيل.'
          : 'Closing happens per drawer. Each drawer closes from its last closing to the moment you press the button, and closed orders never count again.'}
      </p>

      {loading ? (
        <p style={{ color: 'var(--text-gray)', padding: '1rem 0' }}>{ar ? 'جاري التحميل…' : 'Loading…'}</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '760px' }}>
            <thead>
              <tr style={{ color: 'var(--text-gray)', fontSize: '0.85rem' }}>
                <th style={{ textAlign: ar ? 'right' : 'left', padding: '0.6rem 0.5rem' }}>{ar ? 'الخزنة' : 'Drawer'}</th>
                <th style={{ textAlign: ar ? 'right' : 'left', padding: '0.6rem 0.5rem' }}>{ar ? 'الفترة المفتوحة' : 'Open period'}</th>
                <th style={{ textAlign: 'center', padding: '0.6rem 0.5rem' }}>{ar ? 'أوردرات' : 'Orders'}</th>
                <th style={{ textAlign: ar ? 'left' : 'right', padding: '0.6rem 0.5rem' }}>{ar ? 'قبل الضريبة' : 'Before tax'}</th>
                <th style={{ textAlign: ar ? 'left' : 'right', padding: '0.6rem 0.5rem' }}>{ar ? 'الضريبة' : 'Tax'}</th>
                <th style={{ textAlign: ar ? 'left' : 'right', padding: '0.6rem 0.5rem' }}>{ar ? 'المبيعات' : 'Sales'}</th>
                <th style={{ textAlign: ar ? 'left' : 'right', padding: '0.6rem 0.5rem' }}>{ar ? 'الآجل' : 'Deferred'}</th>
                <th style={{ textAlign: ar ? 'left' : 'right', padding: '0.6rem 0.5rem' }}>{ar ? 'المصروفات' : 'Expenses'}</th>
                <th style={{ textAlign: ar ? 'left' : 'right', padding: '0.6rem 0.5rem' }}>{ar ? 'التبس (عرض فقط)' : 'Tips (display only)'}</th>
                <th style={{ textAlign: ar ? 'left' : 'right', padding: '0.6rem 0.5rem' }}>{ar ? 'صافي الخزنة' : 'Net drawer'}</th>
                <th style={{ textAlign: 'center', padding: '0.6rem 0.5rem' }}>{ar ? 'إجراء' : 'Action'}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ bucket, bucketOrders, report, last }) => (
                <tr key={bucket} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <td style={{ padding: '0.7rem 0.5rem', color: 'var(--text-light)', fontWeight: 700 }}>{labelOf(bucket)}</td>
                  <td style={{ padding: '0.7rem 0.5rem', color: 'var(--text-gray)', fontSize: '0.82rem' }}>
                    <div>{ar ? 'من' : 'From'} {timeOf(periodStart(bucket).toISOString())}</div>
                    <div style={{ opacity: 0.7 }}>
                      {last
                        ? `${ar ? 'آخر تقفيل:' : 'Last closing:'} ${last.closed_by || '-'}`
                        : (ar ? 'لسه مفيش تقفيل سابق' : 'No previous closing')}
                    </div>
                  </td>
                  <td style={{ padding: '0.7rem 0.5rem', textAlign: 'center', color: 'var(--text-light)', fontWeight: 700 }}>
                    <div>{bucketOrders.length}</div>
                    {openOrdersOfBucket(bucket).length > 0 && (
                      <div style={{ color: '#ef4444', fontSize: '0.72rem', fontWeight: 700, marginTop: '0.25rem' }}>
                        {ar ? `⚠ ${openOrdersOfBucket(bucket).length} مفتوح` : `⚠ ${openOrdersOfBucket(bucket).length} open`}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '0.7rem 0.5rem', textAlign: ar ? 'left' : 'right', color: 'var(--text-light)' }}>{fmt(report.subtotal)}</td>
                  <td style={{ padding: '0.7rem 0.5rem', textAlign: ar ? 'left' : 'right', color: '#f59e0b' }}>{fmt(report.tax)}</td>
                  <td style={{ padding: '0.7rem 0.5rem', textAlign: ar ? 'left' : 'right', color: '#10b981', fontWeight: 800 }}>{fmt(report.collected)}</td>
                  <td style={{ padding: '0.7rem 0.5rem', textAlign: ar ? 'left' : 'right', color: '#d97706', fontWeight: 800 }}>
                    <div>{fmt(report.deferred)}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-gray)', fontWeight: 500 }}>{ar ? 'غير محصل' : 'Not collected'}</div>
                  </td>
                  <td style={{ padding: '0.7rem 0.5rem', textAlign: ar ? 'left' : 'right', color: '#ef4444', fontWeight: 800 }}>
                    <div>- {fmt(report.expenses)}</div>
                    {report.expensesByMethod?.filter(m => Math.abs(m.amount) > 0.001).map(m => (
                      <div key={m.method} style={{ fontSize: '0.68rem', color: 'var(--text-gray)', fontWeight: 500 }}>{m.label}: {fmt(m.amount)}</div>
                    ))}
                  </td>
                  <td style={{ padding: '0.7rem 0.5rem', textAlign: ar ? 'left' : 'right', color: '#f59e0b', fontWeight: 800 }}>
                    <div>{fmt(report.tipsTotal || 0)}</div>
                    {(report.tipsByMethod || []).filter(m => Math.abs(m.amount) > 0.001).map(m => (
                      <div key={m.method} style={{ fontSize: '0.68rem', color: 'var(--text-gray)', fontWeight: 500 }}>{m.label}: {fmt(m.amount)}</div>
                    ))}
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-gray)', fontWeight: 500 }}>{ar ? 'لا يدخل في الحسابات' : 'Excluded from accounting'}</div>
                  </td>
                  <td style={{ padding: '0.7rem 0.5rem', textAlign: ar ? 'left' : 'right', color: 'var(--gold-primary)', fontWeight: 900 }}>
                    <div>{fmt(report.expectedBalance)}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-gray)', fontWeight: 500 }}>تحصيل + إيداعات - مصروفات</div>
                  </td>
                  <td style={{ padding: '0.7rem 0.5rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button className="btn-gold outline" style={{ padding: '0.4rem 0.7rem', fontSize: '0.8rem' }}
                        disabled={bucketOrders.length === 0 && report.deposits === 0 && report.expenses === 0}
                        onClick={() => handlePreview(bucket)}
                        title={ar ? 'طباعة من غير تقفيل' : 'Print without closing'}>
                        <Printer size={14} /> {ar ? 'معاينة' : 'Preview'}
                      </button>
                      <button className="btn-gold" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                        disabled={(bucketOrders.length === 0 && report.deposits === 0 && report.expenses === 0) || closing === bucket}
                        onClick={() => handleClose(bucket)}>
                        <Lock size={14} /> {closing === bucket ? (ar ? 'جاري…' : 'Closing…') : (ar ? 'تقفيل وطباعة' : 'Close & print')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-gray)' }}>
                  {ar ? 'مفيش صالات أو مبيعات' : 'No halls or sales'}
                </td></tr>
              )}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--gold-primary)' }}>
                <td colSpan={8} style={{ padding: '0.7rem 0.5rem', fontWeight: 800, color: 'var(--text-light)' }}>
                  {ar ? 'إجمالي المتوقع المفتوح (غير مقفول)' : 'Total expected open balance'}
                </td>
                <td style={{ padding: '0.7rem 0.5rem', textAlign: ar ? 'left' : 'right', fontWeight: 900, color: 'var(--gold-primary)' }}>{fmt(totalOpen)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

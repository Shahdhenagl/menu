import { useState, useEffect, useMemo, useCallback } from 'react';
import { Printer, Lock, RefreshCw } from 'lucide-react';
import type { Order, Category, Product, RestaurantSettings, ShiftClosing } from '../types';
import { db } from '../lib/supabase';
import { printShiftClosing } from '../utils/printUtils';
import { buildShiftReport, bucketOf, bucketLabel } from '../utils/shiftClosing';

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
      const all = await db.getShiftClosings();
      const map: Record<string, ShiftClosing> = {};
      all.forEach(c => {
        const prev = map[c.bucket];
        if (!prev || new Date(c.to_at).getTime() > new Date(prev.to_at).getTime()) map[c.bucket] = c;
      });
      setLastByBucket(map);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLast(); }, [loadLast]);

  // الأوردرات المكتملة بس (من غير الضيافة)
  const completed = useMemo(
    () => orders.filter(o => o.status === 'completed' && o.payment_method !== 'hospitality'),
    [orders]
  );

  // الصالات: المعرّفة في الإعدادات + أي بوكيت ظهر في أوردرات مفتوحة + اللي اتقفل قبل كده
  const bucketKeys = useMemo(() => {
    const keys = new Set<string>();
    (settings?.halls || []).forEach(h => keys.add(h.name));
    completed.forEach(o => keys.add(bucketOf(o)));
    Object.keys(lastByBucket).forEach(k => keys.add(k));
    return [...keys];
  }, [settings, completed, lastByBucket]);

  /** بداية الفترة الحالية لصالة: آخر تقفيل، وإلا أول أوردر ليها، وإلا بداية النهاردة */
  const periodStart = useCallback((bucket: string): Date => {
    const last = lastByBucket[bucket];
    if (last) return new Date(last.to_at);
    const first = completed
      .filter(o => bucketOf(o) === bucket)
      .map(o => new Date(o.created_at).getTime())
      .sort((a, b) => a - b)[0];
    if (first) return new Date(first);
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, [lastByBucket, completed]);

  /** أوردرات الفترة المفتوحة: بعد آخر تقفيل ولحد دلوقتي */
  const openOrdersOf = useCallback((bucket: string): Order[] => {
    const start = periodStart(bucket).getTime();
    const last = lastByBucket[bucket];
    // الأوردرات اللي دخلت آخر تقفيل — حماية إضافية لو أوردر اتقفل واتعدّل وقته
    const closedIds = new Set<string>(last?.order_ids || []);
    return completed.filter(o => {
      if (bucketOf(o) !== bucket) return false;
      if (closedIds.has(o.id)) return false;
      const t = new Date(o.created_at).getTime();
      // بعد آخر تقفيل تمامًا (أو من أول أوردر لو مفيش تقفيل سابق)
      return last ? t > start : t >= start;
    });
  }, [completed, lastByBucket, periodStart]);

  const buildReport = useCallback((bucket: string, bucketOrders: Order[], from: Date, to: Date) =>
    buildShiftReport({
      title: bucketLabel(bucket, ar),
      orders: bucketOrders,
      categories,
      products,
      from,
      to,
      ar,
    }), [categories, products, ar]);

  const handleClose = async (bucket: string) => {
    const bucketOrders = openOrdersOf(bucket);
    if (bucketOrders.length === 0) {
      alert(ar ? 'مفيش أوردرات جديدة من آخر تقفيل.' : 'No new orders since the last closing.');
      return;
    }
    const from = periodStart(bucket);
    const to = new Date();
    const label = bucketLabel(bucket, ar);
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
        methods: report.methodsRaw,
        categories: report.categories,
        order_ids: bucketOrders.map(o => o.id),
        closed_by: userName || '-',
      });
      setLastByBucket(prev => ({ ...prev, [bucket]: saved }));
      await printShiftClosing(report, language, settings);
    } catch (err) {
      console.error(err);
      alert(ar ? 'حصل خطأ أثناء التقفيل.' : 'Failed to close the shift.');
    } finally {
      setClosing(null);
    }
  };

  const handlePreview = (bucket: string) => {
    const bucketOrders = openOrdersOf(bucket);
    const report = buildReport(bucket, bucketOrders, periodStart(bucket), new Date());
    printShiftClosing({ ...report, title: report.title + (ar ? ' (معاينة)' : ' (Preview)') }, language, settings);
  };

  const rows = bucketKeys.map(bucket => {
    const bucketOrders = openOrdersOf(bucket);
    const report = buildReport(bucket, bucketOrders, periodStart(bucket), now);
    return { bucket, bucketOrders, report, last: lastByBucket[bucket] };
  });

  const totalOpen = rows.reduce((s, r) => s + r.report.collected, 0);

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
          ? 'كل صالة بتتقفل من آخر تقفيل ليها لحد لحظة الضغط على الزر. الأوردرات اللي اتقفلت مش بتتحسب تاني في الشفت الجاي.'
          : 'Each hall closes from its last closing up to the moment you press the button. Closed orders never count again.'}
      </p>

      {loading ? (
        <p style={{ color: 'var(--text-gray)', padding: '1rem 0' }}>{ar ? 'جاري التحميل…' : 'Loading…'}</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '760px' }}>
            <thead>
              <tr style={{ color: 'var(--text-gray)', fontSize: '0.85rem' }}>
                <th style={{ textAlign: ar ? 'right' : 'left', padding: '0.6rem 0.5rem' }}>{ar ? 'الصالة / النوع' : 'Hall / Type'}</th>
                <th style={{ textAlign: ar ? 'right' : 'left', padding: '0.6rem 0.5rem' }}>{ar ? 'الفترة المفتوحة' : 'Open period'}</th>
                <th style={{ textAlign: 'center', padding: '0.6rem 0.5rem' }}>{ar ? 'أوردرات' : 'Orders'}</th>
                <th style={{ textAlign: ar ? 'left' : 'right', padding: '0.6rem 0.5rem' }}>{ar ? 'قبل الضريبة' : 'Before tax'}</th>
                <th style={{ textAlign: ar ? 'left' : 'right', padding: '0.6rem 0.5rem' }}>{ar ? 'الضريبة' : 'Tax'}</th>
                <th style={{ textAlign: ar ? 'left' : 'right', padding: '0.6rem 0.5rem' }}>{ar ? 'المحصل' : 'Collected'}</th>
                <th style={{ textAlign: 'center', padding: '0.6rem 0.5rem' }}>{ar ? 'إجراء' : 'Action'}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ bucket, bucketOrders, report, last }) => (
                <tr key={bucket} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <td style={{ padding: '0.7rem 0.5rem', color: 'var(--text-light)', fontWeight: 700 }}>{bucketLabel(bucket, ar)}</td>
                  <td style={{ padding: '0.7rem 0.5rem', color: 'var(--text-gray)', fontSize: '0.82rem' }}>
                    <div>{ar ? 'من' : 'From'} {timeOf(periodStart(bucket).toISOString())}</div>
                    <div style={{ opacity: 0.7 }}>
                      {last
                        ? `${ar ? 'آخر تقفيل:' : 'Last closing:'} ${last.closed_by || '-'}`
                        : (ar ? 'لسه مفيش تقفيل سابق' : 'No previous closing')}
                    </div>
                  </td>
                  <td style={{ padding: '0.7rem 0.5rem', textAlign: 'center', color: 'var(--text-light)', fontWeight: 700 }}>{bucketOrders.length}</td>
                  <td style={{ padding: '0.7rem 0.5rem', textAlign: ar ? 'left' : 'right', color: 'var(--text-light)' }}>{fmt(report.subtotal)}</td>
                  <td style={{ padding: '0.7rem 0.5rem', textAlign: ar ? 'left' : 'right', color: '#f59e0b' }}>{fmt(report.tax)}</td>
                  <td style={{ padding: '0.7rem 0.5rem', textAlign: ar ? 'left' : 'right', color: '#10b981', fontWeight: 800 }}>{fmt(report.collected)}</td>
                  <td style={{ padding: '0.7rem 0.5rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button className="btn-gold outline" style={{ padding: '0.4rem 0.7rem', fontSize: '0.8rem' }}
                        disabled={bucketOrders.length === 0}
                        onClick={() => handlePreview(bucket)}
                        title={ar ? 'طباعة من غير تقفيل' : 'Print without closing'}>
                        <Printer size={14} /> {ar ? 'معاينة' : 'Preview'}
                      </button>
                      <button className="btn-gold" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                        disabled={bucketOrders.length === 0 || closing === bucket}
                        onClick={() => handleClose(bucket)}>
                        <Lock size={14} /> {closing === bucket ? (ar ? 'جاري…' : 'Closing…') : (ar ? 'تقفيل وطباعة' : 'Close & print')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-gray)' }}>
                  {ar ? 'مفيش صالات أو مبيعات' : 'No halls or sales'}
                </td></tr>
              )}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--gold-primary)' }}>
                <td colSpan={5} style={{ padding: '0.7rem 0.5rem', fontWeight: 800, color: 'var(--text-light)' }}>
                  {ar ? 'إجمالي المفتوح (غير مقفول)' : 'Total open (not closed)'}
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

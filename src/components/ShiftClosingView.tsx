import { useState, useMemo } from 'react';
import { Printer, Clock } from 'lucide-react';
import type { Order, Category, Product, RestaurantSettings } from '../types';

interface ShiftClosingViewProps {
  /** أوردرات اليوم المختار (مكتملة) */
  dayOrders: Order[];
  categories: Category[];
  products: Product[];
  settings?: RestaurantSettings | null;
  language: 'ar' | 'en';
  dayLabel: string;
}

const METHODS = ['cash', 'visa', 'wallet_restaurant', 'wallet_bar', 'instapay', 'deferred', 'petty_cash'] as const;
const num = (v: any): number => Number(v) || 0;

/** مفتاح تجميع الأوردر: اسم الصالة، وإلا نوع الطلب (تيك أواي/دليفري…) */
const bucketOf = (o: Order): string => o.hall || `__type__${o.order_type || 'other'}`;

export default function ShiftClosingView({
  dayOrders, categories, products, settings, language, dayLabel,
}: ShiftClosingViewProps) {
  const ar = language === 'ar';
  // نطاق الشفت داخل اليوم — افتراضيًا اليوم كله
  const [fromTime, setFromTime] = useState('00:00');
  const [toTime, setToTime] = useState('23:59');

  const fmt = (n: number) => num(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + (ar ? ' ج.م' : ' EGP');

  const methodLabel = (m: string) => {
    switch (m) {
      case 'cash': return ar ? 'كاش' : 'Cash';
      case 'visa': return ar ? 'فيزا' : 'Visa';
      case 'wallet_restaurant': return ar ? 'محفظة المطعم' : 'Restaurant Wallet';
      case 'wallet_bar': return ar ? 'محفظة البار' : 'Bar Wallet';
      case 'instapay': return ar ? 'إنستاباي' : 'Instapay';
      case 'deferred': return ar ? 'آجل (مديونية)' : 'Deferred';
      case 'petty_cash': return ar ? 'عهدة الشريك' : 'Petty Cash';
      default: return m;
    }
  };

  const bucketLabel = (key: string) => {
    if (!key.startsWith('__type__')) return key;
    const t = key.replace('__type__', '');
    if (t === 'takeaway') return ar ? 'تيك أواي' : 'Takeaway';
    if (t === 'delivery') return ar ? 'دليفري' : 'Delivery';
    if (t === 'talabat') return ar ? 'طلبات' : 'Talabat';
    if (t === 'website') return ar ? 'الموقع الإلكتروني' : 'Website';
    if (t === 'dine_in') return ar ? 'صالة (بدون تحديد)' : 'Dine-in (no hall)';
    return ar ? 'أخرى' : 'Other';
  };

  // فلترة على وقت الشفت
  const inShift = (o: Order) => {
    const d = new Date(o.created_at);
    if (isNaN(d.getTime())) return false;
    const hhmm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    return hhmm >= fromTime && hhmm <= toTime;
  };

  const shiftOrders = useMemo(() => dayOrders.filter(inShift), [dayOrders, fromTime, toTime]);

  // تجميع الأوردرات على الصالات / الأنواع
  const buckets = useMemo(() => {
    const map = new Map<string, Order[]>();
    // نبدأ بالصالات المعرّفة في الإعدادات عشان تظهر حتى لو مفيهاش مبيعات
    (settings?.halls || []).forEach(h => map.set(h.name, []));
    shiftOrders.forEach(o => {
      const k = bucketOf(o);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(o);
    });
    return map;
  }, [shiftOrders, settings]);

  // ===== حسابات تقفيل بوكيت واحد =====
  const computeBucket = (orders: Order[]) => {
    const subtotal = orders.reduce(
      (s, o) => s + o.items.reduce((x, i) => x + num(i.price) * num(i.quantity), 0), 0
    );
    const collected = orders.reduce((s, o) => s + num(o.total_price), 0);
    const tax = Math.max(0, collected - subtotal);
    const discount = Math.max(0, subtotal - collected);

    // تقسيم التحصيل على وسائل الدفع (مع دعم الدفع المقسم)
    const byMethod: Record<string, number> = {};
    METHODS.forEach(m => (byMethod[m] = 0));
    orders.forEach(o => {
      if (o.payment_method === 'split' && o.payment_details) {
        byMethod.cash += num(o.payment_details.cash);
        byMethod.visa += num(o.payment_details.visa);
        byMethod.wallet_restaurant += num(o.payment_details.wallet_restaurant) + num(o.payment_details.wallet);
        byMethod.wallet_bar += num(o.payment_details.wallet_bar);
        byMethod.instapay += num(o.payment_details.instapay);
        byMethod.deferred += num(o.payment_details.deferred);
      } else {
        const m = o.payment_method || 'cash';
        if (byMethod[m] !== undefined) byMethod[m] += num(o.total_price);
        else byMethod.cash += num(o.total_price);
      }
    });

    // الأصناف المباعة مرتبة حسب التصنيف
    type Line = { name: string; qty: number; total: number };
    const byCategory = new Map<string, { sort: number; lines: Map<string, Line> }>();
    const otherKey = ar ? 'غير مصنّف' : 'Uncategorised';

    orders.forEach(o => {
      o.items.forEach(item => {
        const product = products.find(p => p.name_ar === item.name_ar || p.name_en === item.name_en);
        const category = product ? categories.find(c => c.id === product.category_id) : undefined;
        const catName = category ? (ar ? category.name_ar : category.name_en) : otherKey;
        const sort = category ? num(category.sort_order) : 9999;
        if (!byCategory.has(catName)) byCategory.set(catName, { sort, lines: new Map() });
        const group = byCategory.get(catName)!;
        const itemName = ar ? item.name_ar : item.name_en;
        const line = group.lines.get(itemName) || { name: itemName, qty: 0, total: 0 };
        line.qty += num(item.quantity);
        line.total += num(item.price) * num(item.quantity);
        group.lines.set(itemName, line);
      });
    });

    const categoriesSorted = [...byCategory.entries()]
      .sort((a, b) => a[1].sort - b[1].sort)
      .map(([name, g]) => ({
        name,
        lines: [...g.lines.values()].sort((a, b) => b.total - a.total),
        qty: [...g.lines.values()].reduce((s, l) => s + l.qty, 0),
        total: [...g.lines.values()].reduce((s, l) => s + l.total, 0),
      }));

    const itemsCount = categoriesSorted.reduce((s, c) => s + c.qty, 0);

    return { orders, subtotal, collected, tax, discount, byMethod, categoriesSorted, itemsCount };
  };

  const restaurantName = settings?.restaurant_name_en || 'MERIDIEN';

  // ===== طباعة تقفيل شفت صالة =====
  const printBucket = (key: string, orders: Order[]) => {
    const b = computeBucket(orders);
    const title = bucketLabel(key);

    const methodRows = METHODS.filter(m => b.byMethod[m] !== 0).map(m => `
      <tr><td>${methodLabel(m)}</td><td class="end">${fmt(b.byMethod[m])}</td></tr>`).join('')
      || `<tr><td colspan="2" class="empty">${ar ? 'لا يوجد تحصيل' : 'Nothing collected'}</td></tr>`;

    const categoryBlocks = b.categoriesSorted.map(c => `
      <tr class="cat"><td colspan="3">${c.name}</td></tr>
      ${c.lines.map(l => `
        <tr>
          <td class="nm">${l.name}</td>
          <td class="qty">${l.qty}</td>
          <td class="end">${fmt(l.total)}</td>
        </tr>`).join('')}
      <tr class="catsum">
        <td>${ar ? 'إجمالي' : 'Subtotal'} — ${c.name}</td>
        <td class="qty">${c.qty}</td>
        <td class="end">${fmt(c.total)}</td>
      </tr>`).join('')
      || `<tr><td colspan="3" class="empty">${ar ? 'مفيش أصناف مباعة' : 'No items sold'}</td></tr>`;

    const html = `<!DOCTYPE html><html dir="${ar ? 'rtl' : 'ltr'}" lang="${ar ? 'ar' : 'en'}"><head><meta charset="utf-8">
    <title>${ar ? 'تقفيل شفت' : 'Shift Closing'} - ${title}</title>
    <style>
      * { margin:0; padding:0; box-sizing:border-box; font-family:'Segoe UI',Tahoma,Arial,sans-serif; }
      body { color:#111; padding:24px; font-size:13px; }
      .head { text-align:center; border-bottom:3px solid #111; padding-bottom:14px; margin-bottom:18px; }
      .head h1 { font-size:22px; letter-spacing:1px; }
      .head .sub { color:#555; margin-top:6px; font-size:15px; font-weight:700; }
      .head .date { margin-top:6px; font-size:13px; color:#444; }
      .cards { display:flex; gap:10px; margin-bottom:20px; flex-wrap:wrap; }
      .card { flex:1; min-width:150px; border:1px solid #ddd; border-radius:10px; padding:12px; text-align:center; }
      .card .t { font-size:12px; color:#666; }
      .card .v { font-size:18px; font-weight:800; margin-top:4px; }
      .c1 { border-top:4px solid #6b7280; } .c2 { border-top:4px solid #f59e0b; }
      .c3 { border-top:4px solid #10b981; } .c4 { border-top:4px solid #111; }
      h2 { font-size:15px; margin:18px 0 8px; padding-bottom:5px; border-bottom:2px solid #ddd; }
      table { width:100%; border-collapse:collapse; margin-bottom:6px; }
      th,td { padding:7px 9px; border-bottom:1px solid #eee; text-align:${ar ? 'right' : 'left'}; }
      th { background:#f5f5f5; font-size:12px; }
      .end { text-align:${ar ? 'left' : 'right'}; font-variant-numeric:tabular-nums; font-weight:700; }
      .qty { text-align:center; width:70px; font-weight:700; }
      .nm { padding-inline-start:22px; }
      tr.cat td { background:#111; color:#fff; font-weight:800; font-size:13px; }
      tr.catsum td { background:#f5f5f5; font-weight:800; }
      tfoot td { font-weight:800; background:#111; color:#fff; }
      .empty { text-align:center; color:#999; padding:14px; }
      .foot { margin-top:22px; text-align:center; color:#888; font-size:11px; border-top:1px solid #ddd; padding-top:10px; }
      .sign { margin-top:26px; display:flex; justify-content:space-between; gap:30px; }
      .sign div { flex:1; border-top:1px solid #999; padding-top:6px; text-align:center; font-size:12px; color:#555; }
      @media print { body { padding:0; } @page { margin:12mm; } }
    </style></head><body>
      <div class="head">
        <h1>${restaurantName}</h1>
        <div class="sub">${ar ? 'تقفيل شفت' : 'Shift Closing'} — ${title}</div>
        <div class="date">${dayLabel} &nbsp;|&nbsp; ${ar ? 'من' : 'From'} ${fromTime} ${ar ? 'إلى' : 'to'} ${toTime}</div>
      </div>

      <div class="cards">
        <div class="card c1"><div class="t">${ar ? 'المبيعات قبل الضريبة' : 'Sales before tax'}</div><div class="v">${fmt(b.subtotal)}</div></div>
        <div class="card c2"><div class="t">${ar ? 'الضريبة' : 'Tax'}</div><div class="v">${fmt(b.tax)}</div></div>
        <div class="card c3"><div class="t">${ar ? 'إجمالي المحصل بالضريبة' : 'Collected incl. tax'}</div><div class="v">${fmt(b.collected)}</div></div>
        <div class="card c4"><div class="t">${ar ? 'عدد الأوردرات' : 'Orders'}</div><div class="v">${b.orders.length}</div></div>
      </div>

      <h2>${ar ? 'التقسيم في الخزنة حسب طريقة الدفع' : 'Drawer split by payment method'}</h2>
      <table>
        <thead><tr><th>${ar ? 'الطريقة' : 'Method'}</th><th class="end">${ar ? 'المبلغ' : 'Amount'}</th></tr></thead>
        <tbody>${methodRows}</tbody>
        <tfoot><tr><td>${ar ? 'إجمالي المحصل' : 'Total collected'}</td><td class="end">${fmt(b.collected)}</td></tr></tfoot>
      </table>

      <h2>${ar ? 'الأصناف المباعة حسب التصنيف' : 'Items sold by category'} (${b.itemsCount})</h2>
      <table>
        <thead><tr>
          <th>${ar ? 'الصنف' : 'Item'}</th>
          <th class="qty">${ar ? 'الكمية' : 'Qty'}</th>
          <th class="end">${ar ? 'الإجمالي' : 'Total'}</th>
        </tr></thead>
        <tbody>${categoryBlocks}</tbody>
        <tfoot><tr>
          <td>${ar ? 'الإجمالي العام' : 'Grand total'}</td>
          <td class="qty">${b.itemsCount}</td>
          <td class="end">${fmt(b.subtotal)}</td>
        </tr></tfoot>
      </table>

      <div class="sign">
        <div>${ar ? 'توقيع الكاشير' : 'Cashier signature'}</div>
        <div>${ar ? 'توقيع المسؤول' : 'Manager signature'}</div>
      </div>

      <div class="foot">${ar ? 'تم إنشاء التقرير في' : 'Generated on'} ${new Date().toLocaleString(ar ? 'ar-EG' : 'en-GB')}</div>
      <script>window.onload=function(){setTimeout(function(){window.print();},300);};</script>
    </body></html>`;

    const w = window.open('', '_blank', 'width=900,height=1000');
    if (!w) { alert(ar ? 'اسمح بالنوافذ المنبثقة للطباعة' : 'Allow pop-ups to print'); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  const entries = [...buckets.entries()];
  const grandTotal = entries.reduce((s, [, o]) => s + o.reduce((x, y) => x + num(y.total_price), 0), 0);

  return (
    <div style={{ background: 'var(--bg-darker)', borderRadius: '12px', padding: '1.5rem', border: '1px solid var(--border-color)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <h3 style={{ margin: 0, color: 'var(--text-light)' }}>{ar ? 'تقفيل شفت الصالات' : 'Hall Shift Closing'}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Clock size={16} color="var(--text-gray)" />
          <span style={{ color: 'var(--text-gray)', fontSize: '0.85rem' }}>{ar ? 'وقت الشفت' : 'Shift time'}</span>
          <input type="time" className="input-gold" value={fromTime} onChange={e => setFromTime(e.target.value)}
            style={{ padding: '0.4rem 0.6rem', borderRadius: '8px' }} />
          <span style={{ color: 'var(--text-gray)' }}>→</span>
          <input type="time" className="input-gold" value={toTime} onChange={e => setToTime(e.target.value)}
            style={{ padding: '0.4rem 0.6rem', borderRadius: '8px' }} />
          {(fromTime !== '00:00' || toTime !== '23:59') && (
            <button className="btn-gold outline" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
              onClick={() => { setFromTime('00:00'); setToTime('23:59'); }}>
              {ar ? 'اليوم كله' : 'Whole day'}
            </button>
          )}
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '620px' }}>
          <thead>
            <tr style={{ color: 'var(--text-gray)', fontSize: '0.85rem' }}>
              <th style={{ textAlign: ar ? 'right' : 'left', padding: '0.6rem 0.5rem' }}>{ar ? 'الصالة / النوع' : 'Hall / Type'}</th>
              <th style={{ textAlign: 'center', padding: '0.6rem 0.5rem' }}>{ar ? 'أوردرات' : 'Orders'}</th>
              <th style={{ textAlign: ar ? 'left' : 'right', padding: '0.6rem 0.5rem' }}>{ar ? 'قبل الضريبة' : 'Before tax'}</th>
              <th style={{ textAlign: ar ? 'left' : 'right', padding: '0.6rem 0.5rem' }}>{ar ? 'الضريبة' : 'Tax'}</th>
              <th style={{ textAlign: ar ? 'left' : 'right', padding: '0.6rem 0.5rem' }}>{ar ? 'المحصل' : 'Collected'}</th>
              <th style={{ textAlign: 'center', padding: '0.6rem 0.5rem' }}>{ar ? 'التقفيل' : 'Close'}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([key, orders]) => {
              const b = computeBucket(orders);
              return (
                <tr key={key} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <td style={{ padding: '0.7rem 0.5rem', color: 'var(--text-light)', fontWeight: 700 }}>{bucketLabel(key)}</td>
                  <td style={{ padding: '0.7rem 0.5rem', textAlign: 'center', color: 'var(--text-light)' }}>{orders.length}</td>
                  <td style={{ padding: '0.7rem 0.5rem', textAlign: ar ? 'left' : 'right', color: 'var(--text-light)' }}>{fmt(b.subtotal)}</td>
                  <td style={{ padding: '0.7rem 0.5rem', textAlign: ar ? 'left' : 'right', color: '#f59e0b' }}>{fmt(b.tax)}</td>
                  <td style={{ padding: '0.7rem 0.5rem', textAlign: ar ? 'left' : 'right', color: '#10b981', fontWeight: 800 }}>{fmt(b.collected)}</td>
                  <td style={{ padding: '0.7rem 0.5rem', textAlign: 'center' }}>
                    <button className="btn-gold" style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}
                      disabled={orders.length === 0}
                      onClick={() => printBucket(key, orders)}
                      title={orders.length === 0 ? (ar ? 'مفيش مبيعات' : 'No sales') : ''}
                    >
                      <Printer size={15} /> {ar ? 'تقفيل وطباعة' : 'Close & print'}
                    </button>
                  </td>
                </tr>
              );
            })}
            {entries.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-gray)' }}>
                {ar ? 'مفيش مبيعات في الفترة دي' : 'No sales in this period'}
              </td></tr>
            )}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid var(--gold-primary)' }}>
              <td style={{ padding: '0.7rem 0.5rem', fontWeight: 800, color: 'var(--text-light)' }}>{ar ? 'الإجمالي' : 'Total'}</td>
              <td style={{ padding: '0.7rem 0.5rem', textAlign: 'center', fontWeight: 800, color: 'var(--text-light)' }}>{shiftOrders.length}</td>
              <td colSpan={2} />
              <td style={{ padding: '0.7rem 0.5rem', textAlign: ar ? 'left' : 'right', fontWeight: 900, color: 'var(--gold-primary)' }}>{fmt(grandTotal)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

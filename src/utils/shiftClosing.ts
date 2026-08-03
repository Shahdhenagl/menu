import type { Order, Category, Product, ShiftClosingCategory, ShiftClosingMethod } from '../types';
import type { ShiftClosingReport } from './printUtils';

// وسائل الدفع اللي بتظهر في تقفيل الشفت
export const METHOD_KEYS = ['cash', 'visa', 'wallet_restaurant', 'wallet_bar', 'instapay', 'deferred', 'petty_cash'] as const;

const num = (v: any): number => Number(v) || 0;

/** مفتاح تجميع الأوردر: اسم الصالة، وإلا نوع الطلب (تيك أواي/دليفري…) */
export const bucketOf = (o: Order): string => o.hall || `__type__${o.order_type || 'other'}`;

export const bucketLabel = (key: string, ar: boolean): string => {
  if (!key.startsWith('__type__')) return key;
  const t = key.replace('__type__', '');
  if (t === 'takeaway') return ar ? 'تيك أواي' : 'Takeaway';
  if (t === 'delivery') return ar ? 'دليفري' : 'Delivery';
  if (t === 'talabat') return ar ? 'طلبات' : 'Talabat';
  if (t === 'website') return ar ? 'الموقع الإلكتروني' : 'Website';
  if (t === 'dine_in') return ar ? 'صالة (بدون تحديد)' : 'Dine-in (no hall)';
  return ar ? 'أخرى' : 'Other';
};

export const methodLabel = (m: string, ar: boolean): string => {
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

const stamp = (d: Date, ar: boolean) =>
  d.toLocaleString(ar ? 'ar-EG' : 'en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export type BuiltShiftReport = ShiftClosingReport & {
  /** نفس الوسائل بصيغة التخزين (بالمفتاح) */
  methodsRaw: ShiftClosingMethod[];
};

/**
 * بيحسب تقرير تقفيل شفت لمجموعة أوردرات:
 * الإجماليات، تقسيم الخزنة على وسائل الدفع، والأصناف المباعة مرتبة حسب التصنيف.
 */
export const buildShiftReport = ({
  title, orders, categories, products, from, to, ar,
}: {
  title: string;
  orders: Order[];
  categories: Category[];
  products: Product[];
  from: Date;
  to: Date;
  ar: boolean;
}): BuiltShiftReport => {
  const subtotal = orders.reduce(
    (s, o) => s + o.items.reduce((x, i) => x + num(i.price) * num(i.quantity), 0), 0
  );
  const collected = orders.reduce((s, o) => s + num(o.total_price), 0);
  const tax = Math.max(0, collected - subtotal);
  const discount = Math.max(0, subtotal - collected);

  // تقسيم التحصيل على وسائل الدفع (مع دعم الدفع المقسم)
  const byMethod: Record<string, number> = {};
  METHOD_KEYS.forEach(m => (byMethod[m] = 0));
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

  const methodsRaw: ShiftClosingMethod[] = METHOD_KEYS
    .filter(m => Math.abs(byMethod[m]) > 0.001)
    .map(m => ({ method: m, label: methodLabel(m, ar), amount: byMethod[m] }));

  // الأصناف المباعة مرتبة حسب التصنيف
  const otherKey = ar ? 'غير مصنّف' : 'Uncategorised';
  const grouped = new Map<string, { sort: number; lines: Map<string, { name: string; qty: number; total: number }> }>();

  orders.forEach(o => {
    o.items.forEach(item => {
      const product = products.find(p => p.name_ar === item.name_ar || p.name_en === item.name_en);
      const category = product ? categories.find(c => c.id === product.category_id) : undefined;
      const catName = category ? (ar ? category.name_ar : category.name_en) : otherKey;
      const sort = category ? num(category.sort_order) : 9999;
      if (!grouped.has(catName)) grouped.set(catName, { sort, lines: new Map() });
      const group = grouped.get(catName)!;
      const itemName = ar ? item.name_ar : item.name_en;
      const line = group.lines.get(itemName) || { name: itemName, qty: 0, total: 0 };
      line.qty += num(item.quantity);
      line.total += num(item.price) * num(item.quantity);
      group.lines.set(itemName, line);
    });
  });

  const categoriesSorted: ShiftClosingCategory[] = [...grouped.entries()]
    .sort((a, b) => a[1].sort - b[1].sort)
    .map(([name, g]) => {
      const lines = [...g.lines.values()].sort((a, b) => b.total - a.total);
      return {
        name,
        lines,
        qty: lines.reduce((s, l) => s + l.qty, 0),
        total: lines.reduce((s, l) => s + l.total, 0),
      };
    });

  const itemsCount = categoriesSorted.reduce((s, c) => s + c.qty, 0);
  const sameDay = from.toDateString() === to.toDateString();

  return {
    title,
    dayLabel: sameDay
      ? to.toLocaleDateString(ar ? 'ar-EG' : 'en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : `${from.toLocaleDateString(ar ? 'ar-EG' : 'en-GB')} → ${to.toLocaleDateString(ar ? 'ar-EG' : 'en-GB')}`,
    fromTime: stamp(from, ar),
    toTime: stamp(to, ar),
    ordersCount: orders.length,
    subtotal,
    tax,
    discount,
    collected,
    itemsCount,
    methods: methodsRaw.map(m => ({ label: m.label, amount: m.amount })),
    categories: categoriesSorted,
    methodsRaw,
  };
};

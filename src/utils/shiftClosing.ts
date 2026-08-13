import type {
  Order, Category, Product, RestaurantSettings, DrawerId, Expense, CustomerPayment,
  ShiftClosingCategory, ShiftClosingMethod, ShiftClosingTypeRow, ShiftClosingTaxRow,
} from '../types';
import type { ShiftClosingReport } from './printUtils';
import { taxPercentForOrder } from './tax';

// وسائل الدفع اللي بتظهر في تقفيل الشفت
export const METHOD_KEYS = ['cash', 'visa', 'wallet_restaurant', 'wallet_cafe', 'instapay', 'deferred', 'petty_cash', 'partner'] as const;

const num = (v: any): number => Number(v) || 0;

// ===== الخزن =====
export const DRAWERS: DrawerId[] = [1, 2];

export const drawerName = (id: DrawerId, settings?: RestaurantSettings | null, ar = true): string => {
  const custom = id === 1 ? settings?.drawer_1_name : settings?.drawer_2_name;
  if (custom && custom.trim()) return custom.trim();
  return ar ? `خزنة ${id}` : `Drawer ${id}`;
};

/**
 * خزنة الأوردر:
 *  1) لو محفوظة على الأوردر نفسه (الكاشير اختارها أو اتحطت من الصالة) → هي
 *  2) لو الأوردر صالة → خزنة الصالة من الإعدادات
 *  3) غير كده → خزنة 1
 */
export const drawerOf = (o: Order, settings?: RestaurantSettings | null): DrawerId => {
  if (o.drawer === 1 || o.drawer === 2) return o.drawer;
  if (o.hall) return drawerOfHall(o.hall, settings);
  return 1;
};

/** خزنة الصالة من الإعدادات (وقت إنشاء الأوردر) */
export const drawerOfHall = (hall: string | null | undefined, settings?: RestaurantSettings | null): DrawerId => {
  const halls = settings?.halls || [];
  const index = halls.findIndex(x => x.name === hall);
  const configured = index >= 0 ? halls[index]?.drawer : undefined;
  if (configured === 1 || configured === 2) return configured;
  // توافق مع الإعدادات القديمة: الصالة الأولى على خزنة 1 والثانية على خزنة 2.
  return index === 1 ? 2 : 1;
};

export const orderTypeLabel = (t: string | undefined, ar: boolean): string => {
  if (t === 'takeaway') return ar ? 'تيك أواي' : 'Takeaway';
  if (t === 'delivery') return ar ? 'دليفري' : 'Delivery';
  if (t === 'talabat') return ar ? 'طلبات' : 'Talabat';
  if (t === 'website') return ar ? 'الموقع الإلكتروني' : 'Website';
  if (t === 'dine_in') return ar ? 'صالة' : 'Dine-in';
  return ar ? 'أخرى' : 'Other';
};

export const methodLabel = (m: string, ar: boolean): string => {
  switch (m) {
    case 'cash': return ar ? 'كاش' : 'Cash';
    case 'visa': return ar ? 'فيزا' : 'Visa';
    case 'wallet_restaurant': return ar ? 'محفظة المطعم' : 'Restaurant Wallet';
    case 'wallet_cafe': return ar ? 'محفظة الكافيه' : 'Cafe Wallet';
    case 'instapay': return ar ? 'إنستاباي' : 'Instapay';
    case 'deferred': return ar ? 'آجل (مديونية)' : 'Deferred';
    case 'petty_cash': return ar ? 'عهدة الشريك' : 'Petty Cash';
    case 'partner': return ar ? 'مديونية شريك' : 'Partner Debt';
    default: return m;
  }
};

const stamp = (d: Date, ar: boolean) =>
  d.toLocaleString(ar ? 'ar-EG' : 'en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/** الإجمالي الفرعي لأصناف أوردر */
const orderSubtotal = (o: Order) => o.items.reduce((x, i) => x + num(i.price) * num(i.quantity), 0);

export type BuiltShiftReport = ShiftClosingReport & {
  /** نفس الوسائل بصيغة التخزين (بالمفتاح) */
  methodsRaw: ShiftClosingMethod[];
  tipsTotal: number;
  tipsByMethod: { method: string; label: string; amount: number }[];
};

/**
 * بيحسب تقرير تقفيل خزنة:
 * الإجماليات، تقسيم الخزنة على وسائل الدفع، التفصيل حسب نوع الطلب،
 * تجميع الضرائب حسب النسبة، والأصناف المباعة مرتبة حسب التصنيف.
 */
export const buildShiftReport = ({
  title, orders, expenses = [], customerPayments = [], categories, products, settings, from, to, ar,
}: {
  title: string;
  orders: Order[];
  expenses?: Expense[];
  customerPayments?: CustomerPayment[];
  categories: Category[];
  products: Product[];
  settings?: RestaurantSettings | null;
  from: Date;
  to: Date;
  ar: boolean;
}): BuiltShiftReport => {
  const subtotal = orders.reduce((s, o) => s + orderSubtotal(o), 0);
  const collected = orders.reduce((s, o) => s + num(o.total_price), 0);
  const partnerDebt = orders.filter(o => o.payment_method === 'partner').reduce((s, o) => s + num(o.partner_amount_due ?? o.total_price), 0);
  const cashCollected = collected - partnerDebt;
  const tax = orders.reduce((s, o) => {
    if (o.payment_method === 'partner' || o.partner_id) return s;
    const base = orderSubtotal(o);
    const percent = taxPercentForOrder(settings, o.order_type, o.hall);
    return s + (base * (percent / 100));
  }, 0);
  const discount = Math.max(0, subtotal + tax - collected);
  const deposits = customerPayments.reduce((s, p) => s + num(p.amount), 0);
  const expensesTotal = expenses.reduce((s, e) => s + num(e.amount), 0);
  const expectedBalance = cashCollected + deposits - expensesTotal;

  // ===== التبس: عرض فقط، لا يدخل في collected أو tax أو expectedBalance =====
  const tipByMethodValues: Record<string, number> = {};
  METHOD_KEYS.forEach(m => (tipByMethodValues[m] = 0));
  orders.forEach(o => {
    const details = o.payment_details || {};
    if (details.tip_by_method && typeof details.tip_by_method === 'object') {
      Object.entries(details.tip_by_method).forEach(([method, value]) => {
        if (tipByMethodValues[method] !== undefined) tipByMethodValues[method] += num(value);
      });
    } else if (num(details.tip_total) > 0) {
      const method = o.payment_method === 'split' ? 'cash' : (o.payment_method || 'cash');
      if (tipByMethodValues[method] !== undefined) tipByMethodValues[method] += num(details.tip_total);
    }
  });
  const tipsTotal = Object.values(tipByMethodValues).reduce((sum, value) => sum + value, 0);
  const tipsByMethod = METHOD_KEYS
    .filter(m => Math.abs(tipByMethodValues[m]) > 0.001)
    .map(m => ({ method: m, label: methodLabel(m, ar), amount: tipByMethodValues[m] }));

  // ===== تقسيم التحصيل على وسائل الدفع (مع دعم الدفع المقسم) =====
  const byMethod: Record<string, number> = {};
  METHOD_KEYS.forEach(m => (byMethod[m] = 0));
  orders.forEach(o => {
    if (o.payment_method === 'split' && o.payment_details) {
      const details = o.payment_details;
      const tips = details.tip_by_method && typeof details.tip_by_method === 'object' ? details.tip_by_method : {};
      byMethod.cash += Math.max(0, num(details.cash) - num(tips.cash));
      byMethod.visa += Math.max(0, num(details.visa) - num(tips.visa));
      byMethod.wallet_restaurant += Math.max(0, num(details.wallet_restaurant) - num(tips.wallet_restaurant));
      byMethod.wallet_cafe += Math.max(0, num(details.wallet_cafe) - num(tips.wallet_cafe));
      byMethod.instapay += Math.max(0, num(details.instapay) - num(tips.instapay));
      byMethod.deferred += Math.max(0, num(details.deferred) - num(tips.deferred));
    } else {
      const m = o.payment_method || 'cash';
      if (byMethod[m] !== undefined) byMethod[m] += num(o.payment_method === 'partner' ? (o.partner_amount_due ?? o.total_price) : o.total_price);
      else byMethod.cash += num(o.total_price);
    }
  });

  const methodsRaw: ShiftClosingMethod[] = METHOD_KEYS
    .filter(m => Math.abs(byMethod[m]) > 0.001)
    .map(m => ({ method: m, label: methodLabel(m, ar), amount: byMethod[m] }));

  const byDepositMethod: Record<string, number> = {};
  const byExpenseMethod: Record<string, number> = {};
  METHOD_KEYS.forEach(m => { byDepositMethod[m] = 0; byExpenseMethod[m] = 0; });
  customerPayments.forEach(p => {
    const m = p.payment_method || 'cash';
    if (byDepositMethod[m] !== undefined) byDepositMethod[m] += num(p.amount);
    else byDepositMethod.cash += num(p.amount);
  });
  expenses.forEach(e => {
    const m = e.payment_method || 'cash';
    if (byExpenseMethod[m] !== undefined) byExpenseMethod[m] += num(e.amount);
    else byExpenseMethod.cash += num(e.amount);
  });
  const depositsByMethod = METHOD_KEYS
    .filter(m => Math.abs(byDepositMethod[m]) > 0.001)
    .map(m => ({ method: m, label: methodLabel(m, ar), amount: byDepositMethod[m] }));
  const expensesByMethod = METHOD_KEYS
    .filter(m => Math.abs(byExpenseMethod[m]) > 0.001)
    .map(m => ({ method: m, label: methodLabel(m, ar), amount: byExpenseMethod[m] }));

  // ===== التفصيل حسب نوع الطلب =====
  const typeMap = new Map<string, ShiftClosingTypeRow>();
  // ===== تجميع الضرائب حسب النسبة =====
  const taxMap = new Map<number, ShiftClosingTaxRow>();

  orders.forEach(o => {
    const base = orderSubtotal(o);
    const total = num(o.total_price);
    const percent = taxPercentForOrder(settings, o.order_type, o.hall);
    const t = base * (percent / 100);
    const type = o.order_type || 'dine_in';

    const row = typeMap.get(type) || {
      type, label: orderTypeLabel(type, ar), orders: 0, subtotal: 0, tax: 0, collected: 0,
    };
    row.orders += 1;
    row.subtotal += base;
    row.tax += t;
    row.collected += total;
    typeMap.set(type, row);

    // النسبة المعرّفة لنوع الطلب/الصالة — بنجمّع عليها
    const key = Number(percent) || 0;
    const trow = taxMap.get(key) || { percent: key, base: 0, tax: 0, collected: 0, orders: 0 };
    trow.orders += 1;
    trow.base += base;
    trow.tax += t;
    trow.collected += total;
    taxMap.set(key, trow);
  });

  const orderTypes = [...typeMap.values()].sort((a, b) => b.collected - a.collected);
  const taxGroups = [...taxMap.values()].sort((a, b) => b.percent - a.percent);

  // ===== الأصناف المباعة مرتبة حسب التصنيف =====
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
    deposits,
    expenses: expensesTotal,
    expectedBalance,
    depositsByMethod,
    expensesByMethod,
    itemsCount,
    methods: methodsRaw.map(m => ({ label: m.label, amount: m.amount })),
    orderTypes,
    taxGroups,
    categories: categoriesSorted,
    methodsRaw,
    tipsTotal,
    tipsByMethod,
  };
};


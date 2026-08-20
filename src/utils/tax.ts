import type { RestaurantSettings } from '../types';

// نسبة الضريبة بتختلف حسب نوع الطلب:
//   صالة    → نسبة الصالة نفسها (كل صالة ليها نسبتها)
//   دليفري  → tax_percent_delivery
//   تيك أواي → tax_percent_takeaway
//   غير كده → النسبة العامة tax_percent
//
// أي نسبة مش متظبطة بترجع لنسبة المطعم العامة، ولو دي كمان فاضية تبقى صفر.
/** أسماء الصالة القديمة والجديدة التي تشير إلى صالة الكافية. */
export const isCafeHall = (hall?: string | null): boolean => {
  const value = String(hall || '').trim().toLowerCase();
  return /(?:hall|صالة)\s*2\b/.test(value)
    || value.includes('cafe')
    || value.includes('كافية')
    || value.includes('كافيه');
};

/** الاسم الموحد الذي يظهر على الفاتورة. */
export const printedHallName = (hall?: string | null, language: 'ar' | 'en' = 'ar'): string => {
  if (isCafeHall(hall)) return language === 'ar' ? 'صالة الكافية' : 'Cafe Hall';
  const value = String(hall || '').trim().toLowerCase();
  if (/(?:hall|صالة)\s*1\b/.test(value) || value.includes('restaurant') || value.includes('مطعم')) {
    return language === 'ar' ? 'صالة المطعم' : 'Restaurant Hall';
  }
  return String(hall || '');
};

export const taxPercentForOrder = (
  settings: RestaurantSettings | null | undefined,
  orderType?: string | null,
  hall?: string | null
): number => {
  if (!settings) return 0;
  const n = (v: any) => Number(v) || 0;
  const general = n(settings.tax_percent);

  // صالة الكافية غير خاضعة للضريبة مهما كانت النسبة القديمة المحفوظة في الإعدادات.
  if ((orderType === 'dine_in' || (!orderType && hall)) && isCafeHall(hall)) return 0;

  // الصالة: نسبتها هي وبس — لو الصالة مش متحددة يبقى مفيش ضريبة (نفس السلوك القديم)
  if (orderType === 'dine_in' || (!orderType && hall)) {
    const h = (settings.halls || []).find(x => x.name === hall);
    return h ? n(h.tax_percent) : 0;
  }
  if (orderType === 'delivery') {
    return settings.tax_percent_delivery === undefined || settings.tax_percent_delivery === null
      ? general
      : n(settings.tax_percent_delivery);
  }
  if (orderType === 'takeaway') {
    return settings.tax_percent_takeaway === undefined || settings.tax_percent_takeaway === null
      ? general
      : n(settings.tax_percent_takeaway);
  }
  return general;
};

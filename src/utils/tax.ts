import type { RestaurantSettings } from '../types';

// نسبة الضريبة بتختلف حسب نوع الطلب:
//   صالة    → نسبة الصالة نفسها (كل صالة ليها نسبتها)
//   دليفري  → tax_percent_delivery
//   تيك أواي → tax_percent_takeaway
//   غير كده → النسبة العامة tax_percent
//
// أي نسبة مش متظبطة بترجع لنسبة المطعم العامة، ولو دي كمان فاضية تبقى صفر.
export const taxPercentForOrder = (
  settings: RestaurantSettings | null | undefined,
  orderType?: string | null,
  hall?: string | null
): number => {
  if (!settings) return 0;
  const n = (v: any) => Number(v) || 0;
  const general = n(settings.tax_percent);

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

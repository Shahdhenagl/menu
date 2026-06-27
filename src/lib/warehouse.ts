import type { InventoryItem } from '../types';

export type WarehouseKey = 'main' | 'factory' | 'distribution';

// قاعدة توزيع الأصناف على المخازن:
// - المخزن الرئيسي (main) والمصنع/المطبخ (factory): يحتويان المواد الخام فقط
//   (الخام يُشترى للرئيسي ثم يتحوّل للمطبخ ليُصنّع).
// - مخزن التوزيع (distribution): يحتوي المنتجات المصنّعة فقط (المنتج النهائي الجاهز للتوزيع).
export function warehouseHoldsItem(
  wh: WarehouseKey,
  item: Pick<InventoryItem, 'is_manufactured'>
): boolean {
  return wh === 'distribution' ? !!item.is_manufactured : !item.is_manufactured;
}

// رصيد الصنف في مخزن معيّن
export function warehouseStock(wh: WarehouseKey, item: InventoryItem): number {
  if (wh === 'factory') return item.stock_factory || 0;
  if (wh === 'distribution') return item.stock_distribution || 0;
  return item.stock_main || 0;
}

// قيمة مخزون مخزن معيّن (تحسب فقط الأصناف التي يحتويها هذا المخزن)
export function warehouseValue(wh: WarehouseKey, items: InventoryItem[]): number {
  return items.reduce((sum, item) => {
    if (!warehouseHoldsItem(wh, item)) return sum;
    return sum + warehouseStock(wh, item) * (item.avg_purchase_price || 0);
  }, 0);
}
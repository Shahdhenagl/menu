require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function syncInventory() {
  console.log('جاري الاتصال بقاعدة البيانات...');
  
  // 1. Fetch current inventory from Supabase
  const { data: inventoryItems, error } = await supabase.from('inventory_items').select('*');
  if (error) {
    console.error('خطأ في جلب البيانات:', error);
    return;
  }
  
  console.log(`تم جلب ${inventoryItems.length} صنف من قاعدة البيانات.`);

  // 2. Read Excel file
  // يرجى تغيير اسم الملف إذا كان مختلفاً
  const EXCEL_FILE_PATH = './inventory.xlsx'; 
  console.log(`جاري قراءة ملف الإكسيل: ${EXCEL_FILE_PATH} ...`);
  let wb;
  try {
    wb = XLSX.readFile(EXCEL_FILE_PATH);
  } catch (err) {
    console.error('لم يتم العثور على ملف الإكسيل أو فشلت قراءته. تأكد من وضع ملف باسم inventory.xlsx في نفس المجلد.');
    return;
  }

  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws);
  console.log(`تم قراءة ${data.length} صف من ملف الإكسيل.`);

  let updatedCount = 0;
  const missingInSystem = []; // موجود في الإكسيل ومش موجود في السيستم (زايد)
  const missingInExcel = []; // موجود في السيستم ومش موجود في الإكسيل (ناقص من الجرد)

  // Track which IDs we saw in Excel
  const seenIds = new Set();

  for (const row of data) {
    const rawId = row['رقم الصنف'];
    const rawName = row['اسم الصنف'] || row['إسم الصنف'];
    
    if (!rawName) continue; // تخطي الصفوف الفارغة

    const item = inventoryItems.find(i => (rawId && i.id === rawId) || (i.name.trim() === rawName.trim()));
    
    if (!item) {
      // الصنف زايد (موجود في الإكسيل ومش موجود في السيستم)
      missingInSystem.push(rawName);
      continue;
    }

    seenIds.add(item.id);

    const updateObj = {};
    if (row['الوحدة'] !== undefined) updateObj.unit = row['الوحدة'];
    
    const mainStock = row['رصيد المخزن الأساسي'] !== undefined ? row['رصيد المخزن الأساسي'] : row['الكمية'];
    if (mainStock !== undefined) updateObj.stock_main = Number(mainStock) || 0;
    
    if (row['متوسط السعر'] !== undefined) updateObj.avg_purchase_price = Number(row['متوسط السعر']) || 0;
    
    if (row['رصيد المصنع'] !== undefined) updateObj.stock_factory = Number(row['رصيد المصنع']) || 0;
    if (row['رصيد مخزن التوزيع'] !== undefined || row['رصيد البار'] !== undefined) {
      updateObj.stock_bar = Number(row['رصيد مخزن التوزيع'] || row['رصيد البار']) || 0;
    }
    if (row['الحد الأدنى للقطعة'] !== undefined) updateObj.low_stock_threshold = Number(row['الحد الأدنى للقطعة']) || 0;

    if (Object.keys(updateObj).length > 0) {
      const { error: updateError } = await supabase.from('inventory_items').update(updateObj).eq('id', item.id);
      if (updateError) {
        console.error(`خطأ في تحديث ${rawName}:`, updateError);
      } else {
        updatedCount++;
      }
    }
  }

  // Check what is in the system but missing in Excel
  for (const item of inventoryItems) {
    if (!seenIds.has(item.id)) {
      missingInExcel.push(item.name);
    }
  }

  console.log('\n=============================================');
  console.log(`✅ تم تحديث ${updatedCount} صنف بنجاح في قاعدة البيانات.`);
  console.log('=============================================\n');

  if (missingInSystem.length > 0) {
    console.log('➕ أصناف زائدة (موجودة في الإكسيل ولم يتم التعرف عليها في السيستم بسبب اختلاف الاسم أو عدم وجودها):');
    missingInSystem.forEach(n => console.log(`  - ${n}`));
    console.log('--> يمكنك إضافتها يدوياً من لوحة التحكم أو تعديل اسمها في الإكسيل ليتطابق مع السيستم.\n');
  } else {
    console.log('✅ جميع الأصناف في الإكسيل متطابقة مع السيستم.\n');
  }

  if (missingInExcel.length > 0) {
    console.log('➖ أصناف ناقصة (موجودة في السيستم ولم تُذكر في ملف الجرد):');
    missingInExcel.forEach(n => console.log(`  - ${n}`));
  } else {
    console.log('✅ جميع أصناف السيستم تم جردها في الإكسيل.\n');
  }
}

syncInventory();

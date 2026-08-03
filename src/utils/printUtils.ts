import type { Order, Category, Product, Printer, RestaurantSettings } from '../types';
import { db } from '../lib/supabase';
import { configureQzSecurity } from './qzSecurity';
import qz from 'qz-tray';
import QRCode from 'qrcode';

// بيجيب أحدث إعدادات من الداتا بيز وقت الطباعة نفسها.
// من غير كده الشاشة بتفضل شغّالة بالإعدادات اللي اتحمّلت أول ما فتحت (لوجو/أسماء قديمة).
const freshSettings = async (fallback?: RestaurantSettings | null): Promise<RestaurantSettings | null> => {
  try {
    const s = await db.getSettings();
    return s || fallback || null;
  } catch {
    return fallback || null;
  }
};

// الطابعة الحرارية (عبر QZ) بترسم الـ HTML بمحرك جافا مش بيفهم WebP.
// فبنعيد ترميز اللوجو PNG على خلفية بيضا عشان يطلع مطبوع فعلاً.
const toPrintableLogo = (src: string): Promise<string> =>
  new Promise(resolve => {
    if (!src) return resolve('');
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onerror = () => resolve(src);
      img.onload = () => {
        try {
          const max = 160;
          const scale = Math.min(max / img.width, max / img.height, 1);
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(src);
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/png'));
        } catch {
          resolve(src); // صورة من دومين تاني (canvas متلوّث) → نسيبها زي ما هي
        }
      };
      img.src = src;
    } catch {
      resolve(src);
    }
  });

// لينك المنيو اللي بيتحوّل QR على الفاتورة — ثابت عشان يفضل صح حتى لو الطباعة
// اتعملت من localhost أو من دومين تاني
const MENU_URL = 'https://menu-five-navy.vercel.app/menu';

// يولّد رمز QR كصورة data-URI مدمجة (يشتغل offline)
const buildQrDataUrl = async (data: string): Promise<string> => {
  try {
    return await QRCode.toDataURL(data, { margin: 1, width: 160, errorCorrectionLevel: 'M' });
  } catch {
    return '';
  }
};

// يرجّع أسماء كل الطابعات المتوصلة بالجهاز زي ما هي في نظام التشغيل (عربي/إنجليزي)
export const listQzPrinters = async (): Promise<string[]> => {
  configureQzSecurity();
  if (!qz.websocket.isActive()) {
    await qz.websocket.connect();
  }
  const found = await qz.printers.find();
  const arr = Array.isArray(found) ? found : [found];
  return arr.filter((p): p is string => typeof p === 'string' && p.trim() !== '');
};

// يطبع HTML على قائمة طابعات محددة بالاسم عبر QZ Tray (كل طابعة على حدة)
const printWithQZ = async (htmlContent: string, targetPrinters: (string | undefined)[]): Promise<boolean> => {
  const printers = targetPrinters.filter((p): p is string => !!p && p.trim() !== '');
  if (printers.length === 0) {
    console.warn('QZ: مفيش طابعة معرّفة للقسم ده.');
    return false;
  }
  try {
    configureQzSecurity();
    if (!qz.websocket.isActive()) {
      await qz.websocket.connect();
    }
    // مهم: نحدّد مقاس الطابعة الحرارية (عرض 80مم وارتفاع تلقائي حسب المحتوى)
    // من غير كده QZ بيطبع بمقاس افتراضي غلط → ورقة صغيرة فاضية
    const data = [{ type: 'pixel', format: 'html', flavor: 'plain', data: htmlContent }];
    for (const printerName of printers) {
      try {
        const config = qz.configs.create(printerName, {
          units: 'mm',
          size: { width: 80, height: null },
          margins: { top: 0, right: 0, bottom: 0, left: 0 },
          colorType: 'grayscale',
          rasterize: true,
          scaleContent: true,
        } as any);
        await qz.print(config, data);
      } catch (printErr) {
        console.error(`فشل الطباعة على: ${printerName}`, printErr);
      }
    }
    return true;
  } catch (err) {
    console.error('QZ connection/print error', err);
    return false;
  }
};

// طباعة احتياطية عبر المتصفح (لما QZ مقفول) — بتطبع على الطابعة الافتراضية
const printViaIframe = (htmlContent: string) => {
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  document.body.appendChild(iframe);
  iframe.contentDocument?.write(htmlContent);
  iframe.contentDocument?.close();
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => { try { document.body.removeChild(iframe); } catch {} }, 800);
  }, 250);
};

// ستايل مشترك للتذاكر الحرارية (80mm)
const THERMAL_BASE = `
  @page { margin: 0; }
  * { box-sizing: border-box; }
  body { font-family: 'Tahoma','Arial',sans-serif; margin:0; padding:10px 12px; width:80mm; color:#000; background:#fff; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .center { text-align:center; }
  .divider { border:0; border-top:1px dashed #000; margin:8px 0; }
  .divider.solid { border-top:2px solid #000; }
`;

// ===== تذكرة المطبخ / البار (KOT) =====
export const printOrderTickets = async (
  order: Order,
  categories: Category[],
  products: Product[],
  _printers: Printer[],
  language: 'ar' | 'en',
  settingsArg?: RestaurantSettings | null,
  opts?: { isAddition?: boolean }
) => {
  const isAr = language === 'ar';
  const isAddition = !!opts?.isAddition;
  const settings = await freshSettings(settingsArg);
  // اسم المطعم بالإنجليزي دايمًا في كل التذاكر
  const restaurantName = settings?.restaurant_name_en || 'MERIDIEN';

  // 1) تقسيم الأصناف حسب القسم (مطبخ/بار) من department بتاع التصنيف
  const kitchen: typeof order.items = [];
  const bar: typeof order.items = [];
  order.items.forEach(item => {
    const product = products.find(p => p.name_ar === item.name_ar || p.name_en === item.name_en);
    let dept = 'restaurant';
    if (product) {
      const category = categories.find(c => c.id === product.category_id);
      if (category) dept = category.department || 'restaurant';
    }
    (dept === 'bar' ? bar : kitchen).push(item);
  });

  const orderTypeStr = isAr
    ? (order.order_type === 'takeaway' ? 'تيك أواي' : order.order_type === 'delivery' ? 'توصيل' : order.order_type === 'talabat' ? 'طلبات' : 'صالة')
    : (order.order_type || 'Dine-in');

  // 2) بناء التذكرة لكل قسم موجود، وتوجيهها لطابعات القسم بس
  const stations: { label: string; items: typeof order.items; printers: (string | undefined)[] }[] = [];
  if (kitchen.length) stations.push({
    label: isAr ? 'المطبخ' : 'KITCHEN',
    items: kitchen,
    printers: [settings?.qz_printer_kitchen, settings?.qz_printer_kitchen_2],
  });
  if (bar.length) stations.push({
    label: isAr ? 'البار' : 'BAR',
    items: bar,
    printers: [settings?.qz_printer_bar, settings?.qz_printer_bar_2],
  });

  for (const st of stations) {
    const rows = st.items.map(i => `
      <div class="item">
        <div class="q">${i.quantity}</div>
        <div class="n">${isAr ? i.name_ar : i.name_en}</div>
      </div>`).join('');

    const html = `
      <html dir="${isAr ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>KOT ${st.label}</title>
      <style>${THERMAL_BASE}
        .rname { text-align:center; font-size:18px; font-weight:900; letter-spacing:2px; margin-bottom:6px; direction:ltr; }
        .station { background:#000; color:#fff; text-align:center; font-size:22px; font-weight:800; letter-spacing:3px; padding:9px 4px; border-radius:5px; }
        .addition { text-align:center; font-size:18px; font-weight:900; letter-spacing:1px; padding:6px 4px; margin-top:6px; border:3px double #000; border-radius:5px; }
        .ordno { text-align:center; font-size:30px; font-weight:900; margin:9px 0 2px; }
        .sub { text-align:center; font-size:13px; margin-bottom:6px; }
        .meta { font-size:12px; padding:6px 0; }
        .meta div { margin:2px 0; }
        .item { display:flex; gap:10px; align-items:center; padding:8px 0; border-bottom:1px dashed #aaa; font-size:16px; }
        .item .q { min-width:36px; height:32px; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:19px; border:2px solid #000; border-radius:6px; }
        .item .n { flex:1; font-weight:700; line-height:1.3; }
        .foot { text-align:center; font-size:10px; margin-top:10px; color:#333; }
      </style></head><body>
        <div class="rname">${restaurantName}</div>
        <div class="station">${st.label}</div>
        ${isAddition ? `<div class="addition">${isAr ? 'أصناف إضافية على الأوردر' : 'ADDED ITEMS'}</div>` : ''}
        <div class="ordno">#${order.id.slice(-4).toUpperCase()}</div>
        <div class="sub">${orderTypeStr}${order.hall ? ` · ${order.hall}` : ''}${order.table_number && order.table_number !== '-' ? ` · ${isAr ? 'طاولة' : 'Table'} ${order.table_number}` : ''}</div>
        <hr class="divider"/>
        <div class="meta">
          <div>${isAr ? 'الوقت' : 'Time'}: ${new Date(order.created_at).toLocaleString(isAr ? 'ar-EG' : 'en-US')}</div>
          ${order.waiter_name ? `<div>${isAr ? 'الكابتن' : 'Waiter'}: <b>${order.waiter_name}</b></div>` : ''}
          ${order.customer_name ? `<div>${isAr ? 'العميل' : 'Customer'}: ${order.customer_name}</div>` : ''}
        </div>
        <hr class="divider solid"/>
        ${rows}
        <hr class="divider solid"/>
        <div class="foot">${restaurantName} ${isAr ? '— نظام الطلبات' : '— Order System'}</div>
      </body></html>`;

    let printed = false;
    if (settings?.enable_qz_printing) {
      printed = await printWithQZ(html, st.printers);
    }
    if (!printed) printViaIframe(html);
  }
};

// ===== فاتورة العميل (الكاشير) =====
export const printCustomerReceipt = async (
  order: Order,
  language: 'ar' | 'en',
  settingsArg?: RestaurantSettings | null,
  opts?: { preBill?: boolean }
) => {
  const isAr = language === 'ar';
  const settings = await freshSettings(settingsArg);
  // فاتورة مبدئية: بيشوفها العميل قبل الدفع — من غير طريقة دفع وعليها ختم "غير مدفوعة"
  const isPreBill = !!opts?.preBill;

  const orderTypeStr = isAr
    ? (order.order_type === 'takeaway' ? 'تيك أواي' : order.order_type === 'delivery' ? 'توصيل' : order.order_type === 'talabat' ? 'طلبات' : 'صالة')
    : (order.order_type || 'Dine-in');

  const paymentMethodStr = order.payment_method === 'cash' ? (isAr ? 'كاش' : 'Cash') :
    order.payment_method === 'visa' ? (isAr ? 'فيزا' : 'Visa') :
    order.payment_method === 'wallet_restaurant' ? (isAr ? 'محفظة المطعم' : 'Restaurant Wallet') :
    order.payment_method === 'wallet_bar' ? (isAr ? 'محفظة البار' : 'Bar Wallet') :
    order.payment_method === 'instapay' ? (isAr ? 'إنستاباي' : 'InstaPay') :
    order.payment_method === 'petty_cash' ? (isAr ? 'عهدة الشريك' : 'Petty Cash') :
    order.payment_method === 'split' ? (isAr ? 'مقسم' : 'Split') :
    order.payment_method === 'deferred' ? (isAr ? 'آجل' : 'Deferred') :
    order.payment_method === 'hospitality' ? (isAr ? 'ضيافة' : 'Hospitality') : '';

  const logoSrc = settings?.logo_url ? await toPrintableLogo(settings.logo_url) : '';
  const logoHtml = logoSrc
    ? `<div class="logo-box"><img src="${logoSrc}" alt="Logo" class="logo" /></div>`
    : '';

  // اسم المطعم بالإنجليزي دايمًا على الفاتورة
  const restaurantName = settings?.restaurant_name_en || 'MERIDIEN';

  const qrDataUrl = await buildQrDataUrl(MENU_URL);
  const qrHtml = qrDataUrl
    ? `<div class="qr-box"><img src="${qrDataUrl}" alt="QR" /><div class="qr-cap">${isAr ? 'امسح لتصفّح المنيو' : 'Scan for our menu'}</div></div>`
    : '';

  const locationHtml = settings?.location_url ? `<div class="info-line">${settings.location_url}</div>` : '';
  const phoneHtml = settings?.whatsapp_number ? `<div class="info-line ltr">${isAr ? 'ت: ' : 'Tel: '}${settings.whatsapp_number}</div>` : '';

  const rows = order.items.map(i => {
    const qty = Number(i.quantity) || 1;
    const lineTotal = (Number(i.price) || 0) * qty;
    return `
    <tr>
      <td class="q"><span class="qbox">${qty}×</span></td>
      <td class="n">${isAr ? i.name_ar : i.name_en}</td>
      <td class="p">${lineTotal.toFixed(2)}</td>
    </tr>`;
  }).join('');

  // حساب الإجمالي الفرعي والضريبة/الخصم بحيث تتطابق دايمًا مع الإجمالي المخزّن
  const n = (v: any) => Number(v) || 0;
  const itemsSubtotal = order.items.reduce((s, i) => s + n(i.price) * n(i.quantity), 0);
  const grandTotal = n(order.total_price);
  // نسبة الضريبة (للعرض في العنوان) — من الصالة إن وُجدت وإلا من إعدادات المطعم
  let taxPercent = 0;
  if (order.hall && settings?.halls) {
    const h = settings.halls.find(hh => hh.name === order.hall);
    if (h) taxPercent = n(h.tax_percent);
  }
  if (!taxPercent) taxPercent = n(settings?.tax_percent);
  const diff = grandTotal - itemsSubtotal;            // موجب = ضريبة/خدمة ، سالب = خصم
  const taxAmount = diff > 0.001 ? diff : 0;
  const discountAmount = diff < -0.001 ? -diff : 0;
  const money = (v: number) => v.toFixed(2) + (isAr ? ' ج.م' : ' EGP');
  const taxLabel = isAr
    ? (taxPercent > 0 ? `ضريبة (${taxPercent}%)` : 'ضريبة / خدمة')
    : (taxPercent > 0 ? `Tax (${taxPercent}%)` : 'Tax / Service');
  // كتلة التفاصيل تظهر فقط لو فيه ضريبة أو خصم
  const breakdownHtml = (taxAmount > 0 || discountAmount > 0) ? `
      <div class="sums">
        <div><span>${isAr ? 'الإجمالي الفرعي' : 'Subtotal'}</span><span>${money(itemsSubtotal)}</span></div>
        ${discountAmount > 0 ? `<div class="disc"><span>${isAr ? 'الخصم' : 'Discount'}</span><span>- ${money(discountAmount)}</span></div>` : ''}
        ${taxAmount > 0 ? `<div><span>${taxLabel}</span><span>${money(taxAmount)}</span></div>` : ''}
      </div>` : '';

  const html = `
    <html dir="${isAr ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>Receipt #${order.id.slice(-4)}</title>
    <style>${THERMAL_BASE}
      .logo-box { text-align:center; margin-bottom:6px; }
      .logo { max-width:64px; max-height:64px; object-fit:contain; }
      .rname { text-align:center; font-size:22px; font-weight:900; letter-spacing:2px; margin:2px 0 4px; direction:ltr; }
      .info-line { text-align:center; font-size:11px; color:#222; margin:1px 0; word-break:break-all; }
      .info-line.ltr { direction:ltr; }
      .doctype { text-align:center; font-size:16px; font-weight:900; letter-spacing:1px; padding:5px 0; margin:7px 0 4px; border-top:2px solid #000; border-bottom:2px solid #000; }
      .ticket-type { text-align:center; margin:8px 0; }
      .ticket-type span { display:inline-block; border:2px solid #000; border-radius:6px; padding:3px 14px; font-weight:800; font-size:14px; letter-spacing:1px; }
      .prebill { text-align:center; font-size:15px; font-weight:900; letter-spacing:1px; padding:6px 4px; margin:6px 0; border:3px double #000; border-radius:6px; }
      .meta { font-size:12px; }
      .meta div { display:flex; justify-content:space-between; margin:3px 0; }
      .meta b { font-weight:700; }
      table { width:100%; border-collapse:collapse; margin:6px 0; table-layout:fixed; }
      thead th { font-size:12px; border-bottom:2px solid #000; padding:5px 0; text-align:${isAr ? 'right' : 'left'}; }
      thead th.q { text-align:center; }
      thead th.p { text-align:${isAr ? 'left' : 'right'}; }
      tbody td { padding:6px 0; border-bottom:1px dashed #ccc; font-size:13px; vertical-align:middle; }
      th.q, td.q { width:46px; }
      th.p, td.p { width:64px; }
      td.q { text-align:center; }
      .qbox { display:inline-block; min-width:34px; padding:2px 4px; border:2px solid #000; border-radius:5px;
              font-size:14px; font-weight:900; text-align:center; direction:ltr; unicode-bidi:isolate; }
      td.n { font-weight:600; line-height:1.35; word-wrap:break-word; overflow-wrap:break-word; }
      td.p { text-align:${isAr ? 'left' : 'right'}; font-weight:700; }
      .sums { font-size:13px; margin-top:6px; padding-top:6px; border-top:1px dashed #000; }
      .sums div { display:flex; justify-content:space-between; margin:4px 0; }
      .sums .disc { font-weight:700; }
      .total { display:flex; justify-content:space-between; align-items:center; background:#000; color:#fff; border-radius:6px; padding:9px 12px; margin-top:8px; }
      .total .lbl { font-size:14px; font-weight:700; }
      .total .val { font-size:19px; font-weight:900; }
      .qr-box { text-align:center; margin:12px 0 4px; }
      .qr-box img { width:92px; height:92px; display:block; margin:0 auto; }
      .qr-cap { font-size:10px; color:#444; margin-top:3px; }
      .foot { text-align:center; margin-top:10px; font-size:12px; }
      .foot .thanks { font-weight:800; font-size:14px; }
      .foot .brand { font-size:9px; color:#666; margin-top:6px; }
    </style></head><body>
      ${logoHtml}
      <div class="rname">${restaurantName}</div>
      ${phoneHtml}
      ${locationHtml}
      <div class="doctype">${isAr ? 'فاتورة ضريبية' : 'TAX INVOICE'}</div>
      <div class="ticket-type"><span>${orderTypeStr}${order.hall ? ` · ${order.hall}` : ''}${order.table_number && order.table_number !== '-' ? ` · ${isAr ? 'طاولة' : 'Table'} ${order.table_number}` : ''}</span></div>
      ${isPreBill ? `<div class="prebill">${isAr ? 'فاتورة مبدئية — غير مدفوعة' : 'PRE-BILL — NOT PAID'}</div>` : ''}
      <hr class="divider"/>
      <div class="meta">
        <div><span>${isAr ? 'فاتورة' : 'Invoice'}</span><b>#${order.id.slice(-6).toUpperCase()}</b></div>
        <div><span>${isAr ? 'التاريخ' : 'Date'}</span><b>${new Date(order.created_at).toLocaleString(isAr ? 'ar-EG' : 'en-US')}</b></div>
        ${order.waiter_name ? `<div><span>${isAr ? 'الكابتن' : 'Waiter'}</span><b>${order.waiter_name}</b></div>` : ''}
        ${order.customer_name ? `<div><span>${isAr ? 'العميل' : 'Customer'}</span><b>${order.customer_name}</b></div>` : ''}
        ${!isPreBill && paymentMethodStr ? `<div><span>${isAr ? 'الدفع' : 'Payment'}</span><b>${paymentMethodStr}</b></div>` : ''}
      </div>
      <table>
        <thead><tr>
          <th class="q">${isAr ? 'كمية' : 'Qty'}</th>
          <th>${isAr ? 'الصنف' : 'Item'}</th>
          <th class="p">${isAr ? 'السعر' : 'Price'}</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${breakdownHtml}
      <div class="total">
        <span class="lbl">${isAr ? 'الإجمالي المطلوب' : 'Grand Total'}</span>
        <span class="val">${order.total_price.toFixed(2)} ${isAr ? 'ج.م' : 'EGP'}</span>
      </div>
      ${qrHtml}
      <hr class="divider"/>
      <div class="foot">
        <div class="thanks">${isAr ? 'شكراً لزيارتكم!' : 'Thank you for your visit!'}</div>
        <div class="brand">Powered by Meridien POS</div>
      </div>
    </body></html>`;

  let printed = false;
  if (settings?.enable_qz_printing) {
    printed = await printWithQZ(html, [settings?.qz_printer_cashier]);
  }
  if (!printed) printViaIframe(html);
};

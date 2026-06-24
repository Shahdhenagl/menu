import type { Order, Category, Product, Printer, RestaurantSettings } from '../types';

export const printOrderTickets = (
  order: Order, 
  categories: Category[], 
  products: Product[], 
  printers: Printer[],
  language: 'ar' | 'en'
) => {
  // 1. Group order items by printer
  const itemsByPrinter: Record<string, typeof order.items> = {};
  
  order.items.forEach(item => {
    const product = products.find(p => p.name_ar === item.name_ar || p.name_en === item.name_en);
    let printerId = 'general';
    let dept = 'restaurant';
    
    if (product) {
      const category = categories.find(c => c.id === product.category_id);
      if (category) {
        dept = category.department || 'restaurant';
        if (category.printer_id) {
          printerId = category.printer_id;
        } else {
          // Fallback to the first printer in the same department
          const deptPrinter = printers.find(p => p.department === dept);
          if (deptPrinter) {
            printerId = deptPrinter.id;
          } else {
            printerId = `general_${dept}`;
          }
        }
      }
    }
    
    if (!itemsByPrinter[printerId]) {
      itemsByPrinter[printerId] = [];
    }
    itemsByPrinter[printerId].push(item);
  });

  // 2. Generate and print tickets sequentially
  const printNext = (printerIds: string[], index: number) => {
    if (index >= printerIds.length) return;
    
    const pId = printerIds[index];
    const items = itemsByPrinter[pId];
    const printerInfo = printers.find(p => p.id === pId);
    const stationName = printerInfo 
      ? (language === 'ar' ? printerInfo.name_ar : printerInfo.name_en) 
      : (language === 'ar' ? 'عام' : 'General');
      
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    
    const orderTypeStr = language === 'ar' 
      ? (order.order_type === 'takeaway' ? 'تيك أواي' : order.order_type === 'delivery' ? 'توصيل' : order.order_type === 'talabat' ? 'طلبات' : 'صالة')
      : (order.order_type || 'Unknown');

    const htmlContent = `
      <html dir="${language === 'ar' ? 'rtl' : 'ltr'}">
        <head>
          <title>Print Ticket - ${stationName}</title>
          <style>
            body { font-family: 'Courier New', Courier, monospace; padding: 20px; font-size: 14px; color: #000; }
            .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
            .station { font-size: 18px; font-weight: bold; text-transform: uppercase; border: 2px solid #000; padding: 5px; display: inline-block; margin-bottom: 5px;}
            .meta { margin-bottom: 10px; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { text-align: ${language === 'ar' ? 'right' : 'left'}; padding: 4px 0; border-bottom: 1px dotted #ccc; }
            th { border-bottom: 1px solid #000; }
            .qty { width: 40px; text-align: center; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="station">${stationName}</div>
            <h2>${language === 'ar' ? 'طلب رقم' : 'Order #'} ${order.id.slice(-4).toUpperCase()}</h2>
            <div>${orderTypeStr} ${order.table_number ? `- Table ${order.table_number}` : ''}</div>
          </div>
          <div class="meta">
            <div>${language === 'ar' ? 'الوقت' : 'Time'}: ${new Date(order.created_at).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}</div>
            ${order.waiter_name ? `<div>${language === 'ar' ? 'الكابتن' : 'Waiter'}: ${order.waiter_name}</div>` : ''}
            ${order.customer_name ? `<div>${language === 'ar' ? 'العميل' : 'Customer'}: ${order.customer_name}</div>` : ''}
          </div>
          <table>
            <thead>
              <tr>
                <th class="qty">${language === 'ar' ? 'الكمية' : 'Qty'}</th>
                <th>${language === 'ar' ? 'الصنف' : 'Item'}</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(i => `
                <tr>
                  <td class="qty">${i.quantity}</td>
                  <td>${language === 'ar' ? i.name_ar : i.name_en}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div style="text-align: center; margin-top: 20px; font-size: 10px;">
            Meridien Restaurant System
          </div>
        </body>
      </html>
    `;

    iframe.contentDocument?.write(htmlContent);
    iframe.contentDocument?.close();
    
    // Allow iframe content to render before printing
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      
      // Cleanup and next
      setTimeout(() => {
        document.body.removeChild(iframe);
        printNext(printerIds, index + 1);
      }, 500);
    }, 250);
  };

  const pIds = Object.keys(itemsByPrinter);
  if (pIds.length > 0) {
    printNext(pIds, 0);
  }
};

export const printCustomerReceipt = (
  order: Order,
  language: 'ar' | 'en',
  settings?: RestaurantSettings | null
) => {
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  document.body.appendChild(iframe);

  const isAr = language === 'ar';
  
  const orderTypeStr = isAr 
    ? (order.order_type === 'takeaway' ? 'تيك أواي' : order.order_type === 'delivery' ? 'توصيل' : order.order_type === 'talabat' ? 'طلبات' : 'صالة')
    : (order.order_type || 'Unknown');

  const paymentMethodStr = order.payment_method === 'cash' ? (isAr ? 'كاش' : 'Cash') :
                           order.payment_method === 'visa' ? (isAr ? 'فيزا' : 'Visa') :
                           order.payment_method === 'wallet' ? (isAr ? 'محفظة إلكترونية' : 'E-Wallet') :
                           order.payment_method === 'instapay' ? (isAr ? 'إنستاباي' : 'InstaPay') :
                           order.payment_method === 'split' ? (isAr ? 'مقسم' : 'Split') :
                           order.payment_method === 'deferred' ? (isAr ? 'آجل' : 'Deferred') :
                           order.payment_method === 'hospitality' ? (isAr ? 'ضيافة' : 'Hospitality') : '';

  const logoHtml = settings?.logo_url 
    ? `<div class="logo-container"><img src="${settings.logo_url}" alt="Logo" class="logo" /></div>` 
    : '';

  const restaurantName = isAr ? (settings?.restaurant_name_ar || 'MERIDIEN POS') : (settings?.restaurant_name_en || 'MERIDIEN POS');
  const locationHtml = settings?.location_url ? `<div class="info-line">${isAr ? 'العنوان:' : 'Address:'} ${settings.location_url}</div>` : '';
  const phoneHtml = settings?.whatsapp_number ? `<div class="info-line">${isAr ? 'تليفون:' : 'Phone:'} ${settings.whatsapp_number}</div>` : '';

  const htmlContent = `
    <html dir="${isAr ? 'rtl' : 'ltr'}">
      <head>
        <title>Receipt - Order ${order.id.slice(-4)}</title>
        <style>
          @page { margin: 0; }
          body { 
            font-family: 'Tahoma', 'Arial', sans-serif; 
            margin: 0; 
            padding: 10px; 
            width: 80mm; 
            font-size: 14px; 
            color: #000; 
            background: #fff;
          }
          .receipt-container {
            width: 100%;
            max-width: 80mm;
            margin: 0 auto;
          }
          .logo-container {
            text-align: center;
            margin-bottom: 10px;
          }
          .logo {
            max-width: 60px;
            max-height: 60px;
            object-fit: contain;
          }
          .header { 
            text-align: center; 
            border-bottom: 2px dashed #000; 
            padding-bottom: 10px; 
            margin-bottom: 10px; 
          }
          .restaurant-name {
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 5px;
          }
          .info-line {
            font-size: 12px;
            margin-bottom: 2px;
          }
          .meta { 
            margin-bottom: 15px; 
            font-size: 13px; 
          }
          .meta div {
            margin-bottom: 4px;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 15px;
          }
          th, td { 
            text-align: ${isAr ? 'right' : 'left'}; 
            padding: 6px 0; 
            border-bottom: 1px dotted #ccc; 
          }
          th { 
            border-bottom: 1px solid #000; 
            font-size: 13px;
          }
          .qty { width: 40px; text-align: center; font-weight: bold; }
          .price { text-align: ${isAr ? 'left' : 'right'}; width: 70px; }
          .totals {
            border-top: 2px dashed #000;
            padding-top: 10px;
            margin-top: 10px;
          }
          .total-line {
            display: flex;
            justify-content: space-between;
            font-size: 14px;
            margin-bottom: 5px;
          }
          .grand-total {
            font-size: 18px;
            font-weight: bold;
            border-top: 1px solid #000;
            padding-top: 5px;
            margin-top: 5px;
          }
          .footer {
            text-align: center;
            margin-top: 20px;
            font-size: 12px;
            border-top: 1px dashed #000;
            padding-top: 10px;
          }
          .qr-placeholder {
            margin: 15px auto;
            width: 80px;
            height: 80px;
            border: 1px solid #ccc;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="receipt-container">
          <div class="header">
            ${logoHtml}
            <div class="restaurant-name">${restaurantName}</div>
            ${phoneHtml}
            ${locationHtml}
          </div>
          
          <div class="meta">
            <div><strong>${isAr ? 'رقم الفاتورة:' : 'Invoice #:'}</strong> ${order.id.slice(-6).toUpperCase()}</div>
            <div><strong>${isAr ? 'التاريخ:' : 'Date:'}</strong> ${new Date(order.created_at).toLocaleString(isAr ? 'ar-EG' : 'en-US')}</div>
            <div><strong>${isAr ? 'نوع الطلب:' : 'Order Type:'}</strong> ${orderTypeStr} ${order.table_number ? `(${order.table_number})` : ''}</div>
            ${order.waiter_name ? `<div><strong>${isAr ? 'الكابتن:' : 'Cashier/Waiter:'}</strong> ${order.waiter_name}</div>` : ''}
            ${order.customer_name ? `<div><strong>${isAr ? 'العميل:' : 'Customer:'}</strong> ${order.customer_name}</div>` : ''}
            ${paymentMethodStr ? `<div><strong>${isAr ? 'طريقة الدفع:' : 'Payment:'}</strong> ${paymentMethodStr}</div>` : ''}
          </div>

          <table>
            <thead>
              <tr>
                <th class="qty">${isAr ? 'الكمية' : 'Qty'}</th>
                <th>${isAr ? 'الصنف' : 'Item'}</th>
                <th class="price">${isAr ? 'السعر' : 'Price'}</th>
              </tr>
            </thead>
            <tbody>
              ${order.items.map(i => `
                <tr>
                  <td class="qty">${i.quantity}</td>
                  <td>${isAr ? i.name_ar : i.name_en}</td>
                  <td class="price">${(i.price * i.quantity).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="totals">
            <div class="total-line grand-total">
              <span>${isAr ? 'الإجمالي المطلوب:' : 'Grand Total:'}</span>
              <span>${order.total_price.toFixed(2)} ${isAr ? 'ج.م' : 'EGP'}</span>
            </div>
          </div>
          
          <div class="qr-placeholder">
            ${isAr ? 'رمز QR' : 'QR Code'}
          </div>

          <div class="footer">
            <div>${isAr ? 'شكراً لزيارتكم!' : 'Thank you for your visit!'}</div>
            <div style="font-size: 10px; margin-top: 10px; color: #555;">Powered by Meridien POS</div>
          </div>
        </div>
      </body>
    </html>
  `;

  iframe.contentDocument?.write(htmlContent);
  iframe.contentDocument?.close();
  
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 500);
  }, 250);
};

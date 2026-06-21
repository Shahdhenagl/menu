import type { Order, Category, Product, Printer } from '../types';

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
    
    if (product) {
      const category = categories.find(c => c.id === product.category_id);
      if (category && category.printer_id) {
        printerId = category.printer_id;
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

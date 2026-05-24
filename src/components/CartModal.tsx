import React, { useState } from 'react';
import type { OrderItem, RestaurantSettings } from '../types';
import { db } from '../lib/supabase';
import { X, Trash2, Tag, Percent, Send, ShoppingBag } from 'lucide-react';
import confetti from 'canvas-confetti';

interface CartModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: OrderItem[];
  updateQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  settings: RestaurantSettings;
  language: 'ar' | 'en';
}

export default function CartModal({
  isOpen,
  onClose,
  cart,
  updateQuantity,
  removeFromCart,
  clearCart,
  settings,
  language
}: CartModalProps) {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; percent: number } | null>(null);
  const [promoError, setPromoError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  // Calculate pricing
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const discountPercent = appliedPromo ? appliedPromo.percent : 0;
  const discountAmount = subtotal * (discountPercent / 100);
  
  const netSubtotal = subtotal - discountAmount;
  const servicePercent = settings.service_percent || 0;
  const serviceAmount = netSubtotal * (servicePercent / 100);
  
  const taxPercent = settings.tax_percent || 0;
  const taxAmount = (netSubtotal + serviceAmount) * (taxPercent / 100);
  
  const finalTotal = netSubtotal + serviceAmount + taxAmount;

  // Translations
  const t = {
    ar: {
      title: "سلة المشتريات 🛒",
      emptyCart: "سلة المشتريات فارغة حالياً!",
      subtotal: "المجموع الفرعي:",
      discount: "الخصم المطبق:",
      total: "إجمالي الحساب:",
      nameLabel: "الاسم بالكامل *",
      namePlaceholder: "اكتب اسمك هنا...",
      phoneLabel: "رقم الهاتف *",
      phonePlaceholder: "اكتب رقم هاتف للتواصل...",
      tableLabel: "رقم الطاولة / الطرابيزة *",
      tablePlaceholder: "مثال: طاولة 5 أو بار 2...",
      promoLabel: "كوبون الخصم (اختياري)",
      promoPlaceholder: "اكتب كود الخصم...",
      promoApply: "تطبيق",
      promoApplied: "تم تطبيق خصم",
      promoInvalid: "كوبون خصم غير صالح أو منتهي!",
      confirmBtn: "تأكيد وإرسال الطلب عبر الواتساب",
      confirming: "جاري تأكيد الطلب...",
      currency: "ج.م",
      validationAlert: "يرجى ملء جميع الحقول المطلوبة (* الاسم، الهاتف، رقم الطاولة) لتأكيد طلبك!",
      orderPlaced: "تم تسجيل طلبك بنجاح! جاري تحويلك للواتساب..."
    },
    en: {
      title: "Shopping Cart 🛒",
      emptyCart: "Your cart is currently empty!",
      subtotal: "Subtotal:",
      discount: "Discount Applied:",
      total: "Total Amount:",
      nameLabel: "Full Name *",
      namePlaceholder: "Type your name...",
      phoneLabel: "Phone Number *",
      phonePlaceholder: "Type your contact number...",
      tableLabel: "Table / Seat Number *",
      tablePlaceholder: "e.g., Table 5, Bar 2...",
      promoLabel: "Promo Code (Optional)",
      promoPlaceholder: "Enter promo code...",
      promoApply: "Apply",
      promoApplied: "Discount applied",
      promoInvalid: "Invalid or expired promo code!",
      confirmBtn: "Confirm & Send via WhatsApp",
      confirming: "Confirming your order...",
      currency: "EGP",
      validationAlert: "Please fill in all required fields (* Name, Phone, Table) to confirm your order!",
      orderPlaced: "Order registered successfully! Redirecting to WhatsApp..."
    }
  }[language];

  // Helper to validate the promo code (expiry and usage limits per user)
  const validatePromoCode = async (codeStr: string, phoneStr: string): Promise<{ valid: boolean; percent: number; error: string }> => {
    const code = codeStr.toUpperCase().trim();
    if (!code) return { valid: false, percent: 0, error: '' };
    
    const value = settings.promo_codes[code];
    if (value === undefined) {
      return { valid: false, percent: 0, error: t.promoInvalid };
    }
    
    // Parse structural values (support legacy numbers and structural details)
    const isObj = typeof value === 'object' && value !== null;
    const discount = isObj ? (value as any).discount : Number(value);
    const expiryDate = isObj ? (value as any).expiryDate : null;
    const usageLimit = isObj ? (value as any).usageLimit : null;
    
    // 1. Check expiration date
    if (expiryDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const expiry = new Date(expiryDate);
      expiry.setHours(23, 59, 59, 999);
      if (today > expiry) {
        return { 
          valid: false, 
          percent: 0, 
          error: language === 'ar' ? 'كوبون الخصم منتهي الصلاحية!' : 'This promo code has expired!' 
        };
      }
    }
    
    // 2. Check usage limit per user
    if (usageLimit && usageLimit > 0) {
      if (!phoneStr.trim()) {
        return { 
          valid: false, 
          percent: 0, 
          error: language === 'ar' 
            ? 'يرجى إدخال رقم الهاتف أولاً للتحقق من صلاحية الكوبون!' 
            : 'Please enter your phone number first to validate the coupon!' 
        };
      }
      
      try {
        const orders = await db.getOrders();
        const cleanPhone = phoneStr.trim().replace(/\D/g, '');
        const usageCount = orders.filter(o => {
          const orderCleanPhone = o.customer_phone.trim().replace(/\D/g, '');
          return orderCleanPhone === cleanPhone && o.promo_code?.toUpperCase() === code;
        }).length;
        
        if (usageCount >= usageLimit) {
          return {
            valid: false,
            percent: 0,
            error: language === 'ar' 
              ? `لقد استخدمت هذا الكوبون ${usageCount} مرة. الحد الأقصى للاستخدام هو ${usageLimit}!` 
              : `You have used this coupon ${usageCount} times. Max limit is ${usageLimit}!`
          };
        }
      } catch (err) {
        console.error("Error checking orders for promo usage count: ", err);
      }
    }
    
    return { valid: true, percent: discount, error: '' };
  };

  // Verify promo codes
  const handleApplyPromo = async () => {
    setPromoError('');
    if (!promoInput.trim()) return;

    const code = promoInput.toUpperCase().trim();
    const res = await validatePromoCode(code, customerPhone);

    if (res.valid) {
      setAppliedPromo({ code, percent: res.percent });
      setPromoError('');
    } else {
      setAppliedPromo(null);
      setPromoError(res.error);
    }
  };

  // Submit checkout
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const name = customerName.trim();
    const phone = customerPhone.trim();
    const table = tableNumber.trim();

    if (!name || !phone || !table) {
      alert(t.validationAlert);
      return;
    }

    // Egyptian phone format validation
    const cleanPhone = phone.replace(/\D/g, '');
    const isEgyptianMobile = cleanPhone.startsWith('01') && cleanPhone.length === 11;
    if (!isEgyptianMobile) {
      alert(language === 'ar'
        ? 'يرجى إدخال رقم هاتف محمول مصري صحيح مكون من 11 رقماً ويبدأ بـ 01!'
        : 'Please enter a valid 11-digit Egyptian mobile number starting with 01!');
      return;
    }

    setIsSubmitting(true);
    
    // Double-check coupon validity during finalized submission
    if (appliedPromo) {
      const res = await validatePromoCode(appliedPromo.code, phone);
      if (!res.valid) {
        alert(res.error);
        setAppliedPromo(null);
        setIsSubmitting(false);
        return;
      }
    }

    try {
      // 1. Save order to Supabase/Mock Database
      const orderData = {
        customer_name: name,
        customer_phone: phone,
        table_number: table,
        promo_code: appliedPromo?.code || null,
        items: cart,
        total_price: finalTotal,
        status: 'pending' as const
      };

      await db.addOrder(orderData);

      // 2. Play celebratory gold/champagne confetti!
      triggerGoldConfetti();

      // 3. Compile WhatsApp Receipt Message
      const receiptMessage = compileReceiptMessage();

      // 4. Clean up states
      alert(t.orderPlaced);
      clearCart();
      onClose();

      // 5. Open WhatsApp redirection url
      const formattedPhone = settings.whatsapp_number.replace(/\D/g, '');
      // If it's an Egyptian number starting with 01, add international code +20
      const intlPhone = formattedPhone.startsWith('01') ? `2${formattedPhone}` : formattedPhone;
      
      const whatsappUrl = `https://wa.me/${intlPhone}?text=${encodeURIComponent(receiptMessage)}`;
      window.open(whatsappUrl, '_blank');

    } catch (err) {
      console.error("Order submission failed: ", err);
      alert("حدث خطأ أثناء إرسال طلبك. يرجى المحاولة مجدداً.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Receipt Compiler (Arabic layout as standard for Egyptian Meridien experience)
  const compileReceiptMessage = (): string => {
    const divider = "----------------------------------";
    let message = `🍽️ *طلب جديد من مطعم مريديان* 🍽️\n`;
    message += `${divider}\n`;
    message += `👤 *الاسم:* ${customerName}\n`;
    message += `📞 *الهاتف:* ${customerPhone}\n`;
    message += `📍 *رقم الطاولة:* ${tableNumber}\n`;
    if (appliedPromo) {
      message += `🎟️ *كوبون الخصم:* ${appliedPromo.code} (${appliedPromo.percent}% خصم)\n`;
    }
    message += `${divider}\n`;
    message += `🍕 *الأصناف المطلوبة:*\n`;
    
    cart.forEach(item => {
      message += `- ${item.quantity}x ${item.name_ar} (_EGP ${item.price}_)\n`;
    });
    
    message += `${divider}\n`;
    message += `💰 *المجموع الفرعي:* EGP ${subtotal.toFixed(2)}\n`;
    if (discountAmount > 0) {
      message += `🎁 *قيمة الخصم:* -EGP ${discountAmount.toFixed(2)} (${discountPercent}%)\n`;
    }
    if (serviceAmount > 0) {
      message += `⚡ *قيمة الخدمة:* +EGP ${serviceAmount.toFixed(2)} (${servicePercent}%)\n`;
    }
    if (taxAmount > 0) {
      message += `📝 *قيمة الضريبة:* +EGP ${taxAmount.toFixed(2)} (${taxPercent}%)\n`;
    }
    message += `✨ *إجمالي الحساب:* *EGP ${finalTotal.toFixed(2)}*\n`;
    message += `${divider}\n`;
    message += `شكراً لاختياركم مريديان! نتمنى لكم وجبة شهية. ✨`;
    
    return message;
  };

  const triggerGoldConfetti = () => {
    const end = Date.now() + (1.5 * 1000);
    const colors = ['#d4af37', '#f3e5ab', '#ffffff', '#aa8410'];

    (function frame() {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: colors
      });
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: colors
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    }());
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="cart-drawer" 
        onClick={(e) => e.stopPropagation()}
        dir={language === 'ar' ? 'rtl' : 'ltr'}
      >
        {/* Drawer Header */}
        <div className="drawer-header">
          <h2 style={{ fontSize: '1.4rem' }} className="text-gradient-gold">
            {t.title}
          </h2>
          <button className="btn-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        {/* Cart items list */}
        {cart.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', color: 'var(--text-gray)' }}>
            <ShoppingBag size={64} style={{ color: 'var(--border-color)', strokeWidth: '1.5' }} />
            <p style={{ fontSize: '1.1rem', fontWeight: '600' }}>{t.emptyCart}</p>
          </div>
        ) : (
          <>
            <div className="cart-items-list">
              {cart.map((item) => (
                <div key={item.id} className="cart-item">
                  <div className="cart-item-info">
                    <div className="cart-item-name">
                      {language === 'ar' ? item.name_ar : item.name_en}
                    </div>
                    <div className="cart-item-price">
                      {item.price} {t.currency}
                    </div>
                  </div>

                  <div className="cart-item-controls">
                    <button className="btn-count" onClick={() => updateQuantity(item.id, item.quantity - 1)}>-</button>
                    <span className="item-quantity">{item.quantity}</span>
                    <button className="btn-count" onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</button>
                    
                    <button className="btn-delete" onClick={() => removeFromCart(item.id)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Checkout Form */}
            <form onSubmit={handleSubmitOrder} className="checkout-form">
              {/* Customer Name */}
              <div className="form-group">
                <label>{t.nameLabel}</label>
                <input 
                  type="text" 
                  className="input-gold" 
                  required 
                  placeholder={t.namePlaceholder}
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>

              {/* Customer Phone & Table number in a grid row */}
              <div className="form-row-two-columns">
                {/* Customer Phone */}
                <div className="form-group">
                  <label>{t.phoneLabel}</label>
                  <input 
                    type="tel" 
                    className="input-gold" 
                    required 
                    placeholder={t.phonePlaceholder}
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                  />
                </div>

                {/* Table number */}
                <div className="form-group">
                  <label>{t.tableLabel}</label>
                  <input 
                    type="text" 
                    className="input-gold" 
                    required 
                    placeholder={t.tablePlaceholder}
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                  />
                </div>
              </div>

              {/* Promo code validation */}
              <div className="form-group" style={{ marginTop: '0.25rem' }}>
                <label>{t.promoLabel}</label>
                <div className="promo-container">
                  <input 
                    type="text" 
                    className="input-gold" 
                    placeholder={t.promoPlaceholder}
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button 
                    type="button" 
                    className="btn-outline-gold" 
                    onClick={handleApplyPromo}
                    style={{ padding: '0 1rem', borderRadius: '12px' }}
                  >
                    <Tag size={14} />
                    {t.promoApply}
                  </button>
                </div>
                {appliedPromo && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--success)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Percent size={12} />
                    {t.promoApplied} {appliedPromo.percent}%! ({appliedPromo.code})
                  </span>
                )}
                {promoError && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--danger)', marginTop: '0.25rem' }}>
                    {promoError}
                  </span>
                )}
              </div>

              {/* Price summary panel */}
              <div className="price-summary">
                <div className="price-row">
                  <span>{t.subtotal}</span>
                  <span>{subtotal.toFixed(2)} {t.currency}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="price-row discount">
                    <span>{t.discount}</span>
                    <span>-{discountAmount.toFixed(2)} {t.currency} ({discountPercent}%)</span>
                  </div>
                )}
                {serviceAmount > 0 && (
                  <div className="price-row service" style={{ color: 'var(--text-gray)', fontSize: '0.85rem' }}>
                    <span>{language === 'ar' ? 'الخدمة:' : 'Service Charge:'}</span>
                    <span className="font-en">+{serviceAmount.toFixed(2)} {t.currency} ({servicePercent}%)</span>
                  </div>
                )}
                {taxAmount > 0 && (
                  <div className="price-row tax" style={{ color: 'var(--text-gray)', fontSize: '0.85rem' }}>
                    <span>{language === 'ar' ? 'الضريبة:' : 'Tax (VAT):'}</span>
                    <span className="font-en">+{taxAmount.toFixed(2)} {t.currency} ({taxPercent}%)</span>
                  </div>
                )}
                <div className="price-row total">
                  <span>{t.total}</span>
                  <span>{finalTotal.toFixed(2)} {t.currency}</span>
                </div>
              </div>

              {/* Submit trigger button */}
              <button 
                type="submit" 
                className="btn-gold" 
                disabled={isSubmitting}
                style={{ width: '100%', padding: '0.8rem', borderRadius: '15px', justifyContent: 'center', marginTop: '0.5rem' }}
              >
                <Send size={16} />
                {isSubmitting ? t.confirming : t.confirmBtn}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import type { Product, Category, RestaurantSettings, OrderItem } from '../types';
import { 
  Search, ShoppingBag, Info, ShieldAlert, Sparkles, 
  Globe
} from 'lucide-react';

interface CustomerMenuProps {
  cart: OrderItem[];
  addToCart: (product: Product) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  onOpenCart: () => void;
  settings: RestaurantSettings;
  categories: Category[];
  products: Product[];
  language: 'ar' | 'en';
  setLanguage: (lang: 'ar' | 'en') => void;
}

export default function CustomerMenu({
  cart,
  addToCart,
  updateQuantity,
  onOpenCart,
  settings,
  categories,
  products,
  language,
  setLanguage
}: CustomerMenuProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Custom tilt values per card for realistic 3D hovering


  // Filter products by category and search query
  const filteredProducts = products.filter(p => {
    const matchCategory = selectedCategory === 'all' || p.category_id === selectedCategory;
    const matchSearch = searchQuery.trim() === '' || 
      p.name_ar.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.name_en.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description_ar && p.description_ar.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.description_en && p.description_en.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchCategory && matchSearch;
  });

  const cartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Translations dictionary
  const t = {
    ar: {
      searchPlaceholder: "ابحث عن طبقك المفضل...",
      allCategories: "الكل 🍽️",
      currency: "ج.م",
      addToCart: "إضافة للسلة",
      inCart: "في السلة",
      outOfStock: "غير متوفر حالياً",
      ingredientsTitle: "المكونات والمواصفات",
      footerCopyright: "جميع الحقوق محفوظة. مطعم مريديان",
      welcomeBanner: "أهلاً بكم في مريديان - منذ 2005",
      subtitle: "استمتع بتجربة طعام فريدة وقائمة طعام تفاعلية 3D فاخرة",
      whatsappNumber: "الواتساب:",
      socialLinks: "تواصل معنا عبر منصاتنا:",
      adminBtn: "الإدارة",
      viewCart: "عرض السلة",
      searchNoResults: "لم نجد نتائج مطابقة لبحثك"
    },
    en: {
      searchPlaceholder: "Search for your favorite dish...",
      allCategories: "All 🍽️",
      currency: "EGP",
      addToCart: "Add to Cart",
      inCart: "In Cart",
      outOfStock: "Out of Stock",
      ingredientsTitle: "Ingredients & Details",
      footerCopyright: "All rights reserved. Meridien Restaurant",
      welcomeBanner: "Welcome to Meridien - Since 2005",
      subtitle: "Enjoy a unique dining experience with a premium 3D interactive menu",
      whatsappNumber: "WhatsApp:",
      socialLinks: "Connect with us on social media:",
      adminBtn: "Admin",
      viewCart: "View Cart",
      searchNoResults: "No items match your search"
    }
  }[language];

  return (
    <div className="app-container">
      {/* 1. Scrolling Offers Banner */}
      {settings.offers && settings.offers.length > 0 && (
        <div className="offers-ticker" dir="rtl">
          <div className="ticker-wrap">
            <div className="ticker-content">
              {settings.offers.map((offer, idx) => (
                <span key={idx} className="ticker-item">
                  <Sparkles size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '5px' }} />
                  {offer}
                </span>
              ))}
              {/* Duplicate for infinite loop effect */}
              {settings.offers.map((offer, idx) => (
                <span key={`dup-${idx}`} className="ticker-item">
                  <Sparkles size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '5px' }} />
                  {offer}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. main Header */}
      <header className="main-header" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <a href="#" className="logo-container">
          <div className="logo-circle">
            {settings.logo_url ? (
              <img src={settings.logo_url} alt="Meridien Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ color: 'var(--gold-primary)', fontWeight: '900', fontSize: '1.2rem', fontFamily: 'var(--font-en)' }}>M</div>
            )}
          </div>
          <div className="logo-text">
            <h1 className="text-gradient-gold">{language === 'ar' ? settings.restaurant_name_ar : settings.restaurant_name_en}</h1>
            <p>SINCE 2005</p>
          </div>
        </a>

        <div className="nav-controls">
          {/* Language Selector */}
          <button 
            className="btn-outline-gold" 
            onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
            style={{ padding: '0.4rem 0.8rem', borderRadius: '15px', fontSize: '0.85rem' }}
          >
            <Globe size={15} />
            {language === 'ar' ? 'English' : 'العربية'}
          </button>
        </div>
      </header>

      {/* 3. Hero Introduction */}
      <section className="hero-intro" style={{ textAlign: 'center', padding: '3rem 1rem 1rem 1rem', position: 'relative' }} dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <span style={{ color: 'var(--gold-primary)', fontSize: '0.9rem', fontWeight: '800', letterSpacing: '3px', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>✨ {t.welcomeBanner} ✨</span>
          <h2 style={{ fontSize: '2.5rem', fontWeight: '900', marginBottom: '0.75rem' }} className="text-gradient-gold">
            {language === 'ar' ? 'تذوق المعنى الحقيقي للفخامة' : 'Taste the True Meaning of Luxury'}
          </h2>
          <p style={{ color: 'var(--text-gray)', fontSize: '1.05rem', lineHeight: '1.6' }}>
            {t.subtitle}
          </p>
        </div>
      </section>

      {/* 4. Menu Filter & Product Display */}
      <main className="menu-layout" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        {/* Search Bar */}
        <div style={{ position: 'relative', width: '100%', maxWidth: '500px', margin: '0 auto 1.5rem auto' }}>
          <input 
            type="text" 
            className="input-gold" 
            placeholder={t.searchPlaceholder} 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', paddingRight: language === 'ar' ? '2.8rem' : '1rem', paddingLeft: language === 'en' ? '2.8rem' : '1rem', borderRadius: '30px' }}
          />
          <Search 
            size={18} 
            style={{ 
              position: 'absolute', 
              top: '50%', 
              transform: 'translateY(-50%)', 
              right: language === 'ar' ? '1.2rem' : 'auto', 
              left: language === 'en' ? '1.2rem' : 'auto',
              color: 'var(--gold-primary)' 
            }} 
          />
        </div>

        {/* Categories Tab Carousel */}
        <div className="categories-container">
          <button 
            className={`category-tab ${selectedCategory === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('all')}
          >
            {t.allCategories}
          </button>
          {categories.map((cat) => (
            <button 
              key={cat.id} 
              className={`category-tab ${selectedCategory === cat.id ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat.id)}
            >
              {language === 'ar' ? cat.name_ar : cat.name_en}
            </button>
          ))}
        </div>

        {/* Premium Products Grid */}
        <div className="products-grid">
          {filteredProducts.map((product) => {
            const inCartItem = cart.find(item => item.id === product.id);
            
            return (
              <div key={product.id} className="premium-card-wrapper">
                <div className={`premium-card ${product.is_available ? 'available' : 'unavailable'}`}>
                  {/* Product Image */}
                  <div className="card-image-box">
                    {product.image_url ? (
                      <img 
                        src={product.image_url} 
                        alt={language === 'ar' ? product.name_ar : product.name_en} 
                        className="card-image"
                        loading="lazy"
                      />
                    ) : (
                      <div style={{ width: '100%', height: '100%', background: 'linear-gradient(45deg, #121212 0%, #242424 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ color: 'var(--gold-primary)', fontSize: '3rem', fontWeight: '900' }}>🍽️</div>
                      </div>
                    )}
                    
                    {/* Out of Stock Ribbon */}
                    {!product.is_available && (
                      <div style={{ position: 'absolute', top: '15px', right: '15px', background: 'var(--danger)', color: '#fff', fontSize: '0.75rem', fontWeight: 'bold', padding: '0.25rem 0.75rem', borderRadius: '10px', boxShadow: '0 0 10px rgba(239, 68, 68, 0.5)' }}>
                        {t.outOfStock}
                      </div>
                    )}

                    {/* Quick quantity in cart badge */}
                    {inCartItem && (
                      <div style={{ position: 'absolute', top: '15px', left: '15px', background: 'var(--gold-primary)', color: 'var(--bg-darker)', fontSize: '0.85rem', fontWeight: '900', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 10px var(--gold-glow)' }}>
                        {inCartItem.quantity}
                      </div>
                    )}
                  </div>

                  {/* Product Details */}
                  <div className="card-content">
                    <h3 className="card-title">
                      {language === 'ar' ? product.name_ar : product.name_en}
                    </h3>
                    
                    <p className="card-desc">
                      {language === 'ar' ? product.description_ar : product.description_en}
                    </p>

                    <div className="card-footer">
                      <div className="card-price">
                        {product.price} <span>{t.currency}</span>
                      </div>

                      {product.is_available ? (
                        inCartItem ? (
                          <div className="card-item-controls">
                            <button className="btn-count" onClick={() => updateQuantity(product.id, inCartItem.quantity - 1)}>-</button>
                            <span className="item-quantity">{inCartItem.quantity}</span>
                            <button className="btn-count" onClick={() => updateQuantity(product.id, inCartItem.quantity + 1)}>+</button>
                          </div>
                        ) : (
                          <button 
                            className="btn-gold" 
                            onClick={() => addToCart(product)}
                            style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', borderRadius: '15px' }}
                          >
                            <ShoppingBag size={14} />
                            {t.addToCart}
                          </button>
                        )
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600' }}>
                          <ShieldAlert size={14} style={{ display: 'inline', verticalAlign: 'middle', marginLeft: '3px' }} />
                          {t.outOfStock}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredProducts.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-gray)' }}>
            <Info size={40} style={{ color: 'var(--gold-primary)', marginBottom: '1rem' }} />
            <p style={{ fontSize: '1.2rem', fontWeight: '600' }}>{t.searchNoResults}</p>
          </div>
        )}
      </main>

      {/* 5. Floating Cart Trigger Button */}
      {cartItemsCount > 0 && (
        <button className="floating-cart-btn" onClick={onOpenCart}>
          <ShoppingBag size={28} />
          <span className="cart-badge">{cartItemsCount}</span>
        </button>
      )}

      {/* 6. Ultimate Social Contact Footer */}
      <footer style={{ background: 'var(--bg-darker)', borderTop: '1px solid var(--border-color)', padding: '3rem 2rem 2rem 2rem', marginTop: 'auto', textAlign: 'center' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div className="logo-circle" style={{ margin: '0 auto 1rem auto', width: '60px', height: '60px' }}>
            {settings.logo_url ? (
              <img src={settings.logo_url} alt="Meridien Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ color: 'var(--gold-primary)', fontWeight: '900', fontSize: '1.5rem', fontFamily: 'var(--font-en)' }}>M</div>
            )}
          </div>
          <h3 style={{ fontSize: '1.6rem', marginBottom: '0.25rem' }} className="text-gradient-gold">
            {language === 'ar' ? settings.restaurant_name_ar : settings.restaurant_name_en}
          </h3>
          <p style={{ color: 'var(--gold-primary)', fontSize: '0.75rem', letterSpacing: '4px', fontFamily: 'var(--font-en)', marginBottom: '1.5rem' }}>SINCE 2005</p>

          <p style={{ color: 'var(--text-gray)', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
            {t.socialLinks}
          </p>

          {/* Social Platforms Links */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
            {settings.facebook_url && (
              <a href={settings.facebook_url} target="_blank" rel="noreferrer" style={{ color: 'var(--gold-primary)', transition: 'var(--transition-fast)' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                </svg>
              </a>
            )}
            {settings.instagram_url && (
              <a href={settings.instagram_url} target="_blank" rel="noreferrer" style={{ color: 'var(--gold-primary)', transition: 'var(--transition-fast)' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
              </a>
            )}
            {settings.tiktok_url && (
              <a href={settings.tiktok_url} target="_blank" rel="noreferrer" style={{ color: 'var(--gold-primary)', transition: 'var(--transition-fast)' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                  <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
                </svg>
              </a>
            )}
            {settings.snapchat_url && (
              <a href={settings.snapchat_url} target="_blank" rel="noreferrer" style={{ color: 'var(--gold-primary)', transition: 'var(--transition-fast)' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                  <path d="M12 2a7 7 0 0 0-7 7c0 2.2 1.3 4.2 3.3 5.1C9 15.6 9 17 8 18c2 0 4-1 4.5-2.5.5 1.5 2.5 2.5 4.5 2.5-1-1-1-2.4-.3-3.9 2-1 3.3-3 3.3-5.1a7 7 0 0 0-7-7Z" />
                </svg>
              </a>
            )}
            {settings.whatsapp_number && (
              <a href={`https://wa.me/${settings.whatsapp_number}`} target="_blank" rel="noreferrer" style={{ color: 'var(--gold-primary)', transition: 'var(--transition-fast)' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </a>
            )}
          </div>

          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1.5rem' }}>
            <p>© {new Date().getFullYear()} {t.footerCopyright}.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

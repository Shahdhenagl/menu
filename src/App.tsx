import { useState, useEffect } from 'react';
import type { Category, Product, Order, RestaurantSettings, OrderItem } from './types';
import { db } from './lib/supabase';
import CustomerMenu from './components/CustomerMenu';
import CartModal from './components/CartModal';
import AdminDashboard from './components/AdminDashboard';
import { Sparkles } from 'lucide-react';

function App() {
  const [currentView, setCurrentView] = useState<'menu' | 'admin'>(() => {
    const path = window.location.pathname;
    return path.endsWith('/admin') || path.endsWith('/admin/') ? 'admin' : 'menu';
  });

  useEffect(() => {
    const handleLocationChange = () => {
      const path = window.location.pathname;
      if (path.endsWith('/admin') || path.endsWith('/admin/')) {
        setCurrentView('admin');
      } else {
        setCurrentView('menu');
      }
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  const [language, setLanguage] = useState<'ar' | 'en'>(() => {
    return (localStorage.getItem('meridien_lang') as 'ar' | 'en') || 'ar';
  });

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('meridien_theme') as 'light' | 'dark') || 'dark';
  });

  useEffect(() => {
    localStorage.setItem('meridien_theme', theme);
    document.documentElement.classList.toggle('light-theme', theme === 'light');
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // State arrays for database entities
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);

  // Cart State (persisted in localStorage)
  const [cart, setCart] = useState<OrderItem[]>(() => {
    const saved = localStorage.getItem('meridien_cart');
    return saved ? JSON.parse(saved) : [];
  });

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Sync language and cart changes to localStorage
  useEffect(() => {
    localStorage.setItem('meridien_lang', language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem('meridien_cart', JSON.stringify(cart));
  }, [cart]);

  // Load database entities
  const fetchAllData = async () => {
    try {
      const [cats, prods, ords, configs] = await Promise.all([
        db.getCategories(),
        db.getProducts(),
        db.getOrders(),
        db.getSettings()
      ]);

      setCategories(cats);
      setProducts(prods);
      setOrders(ords);
      setSettings(configs);
    } catch (err) {
      console.error("Error loading restaurant data: ", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Cart operations
  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.id === product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, {
        id: product.id,
        name_ar: product.name_ar,
        name_en: product.name_en,
        price: product.price,
        quantity: 1
      }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prev => prev.map(item => 
      item.id === productId ? { ...item, quantity } : item
    ));
  };

  const clearCart = () => {
    setCart([]);
  };

  // Loading luxury view
  if (loading || !settings) {
    return (
      <div style={{
        background: '#070707',
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontFamily: 'Cairo, sans-serif'
      }}>
        <div style={{ position: 'relative', width: '80px', height: '80px', marginBottom: '1.5rem' }}>
          {/* Gold Pulse Loading Spinner */}
          <div style={{
            boxSizing: 'border-box',
            display: 'block',
            position: 'absolute',
            width: '64px',
            height: '64px',
            margin: '8px',
            border: '4px solid var(--gold-primary)',
            borderRadius: '50%',
            animation: 'lds-ring 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite',
            borderColor: 'var(--gold-primary) transparent transparent transparent'
          }}></div>
        </div>
        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: '700',
          background: 'linear-gradient(90deg, #f3e5ab, #d4af37, #aa8410)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '0.5rem',
          letterSpacing: '1px'
        }}>
          مريديان منذ 2005
        </h2>
        <p style={{ color: '#a3a3a3', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <Sparkles size={14} style={{ color: '#d4af37' }} />
          جاري تحميل القائمة الفاخرة...
        </p>

        {/* Inline CSS animation styles */}
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes lds-ring {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}} />
      </div>
    );
  }

  return (
    <>
      {/* Background radial gold overlay sparkles */}
      <div className="bg-overlay"></div>

      {currentView === 'menu' ? (
        <>
          <CustomerMenu 
            cart={cart}
            addToCart={addToCart}
            updateQuantity={updateQuantity}
            onOpenCart={() => setIsCartOpen(true)}
            settings={settings}
            categories={categories}
            products={products}
            language={language}
            setLanguage={setLanguage}
            theme={theme}
            toggleTheme={toggleTheme}
          />

          <CartModal 
            isOpen={isCartOpen}
            onClose={() => setIsCartOpen(false)}
            cart={cart}
            updateQuantity={updateQuantity}
            removeFromCart={removeFromCart}
            clearCart={clearCart}
            settings={settings}
            language={language}
          />
        </>
      ) : (
        <AdminDashboard 
          onClose={() => {
            window.history.pushState({}, '', '/');
            setCurrentView('menu');
          }}
          categories={categories}
          products={products}
          orders={orders}
          settings={settings}
          refreshData={fetchAllData}
          language={language}
          theme={theme}
          toggleTheme={toggleTheme}
        />
      )}
    </>
  );
}

export default App;

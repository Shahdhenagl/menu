import { TrendingUp, TrendingDown, Landmark, Banknote, PackageOpen, Receipt } from 'lucide-react';
import type { Order, Expense, InventoryItem } from '../types';

interface FinancialsViewProps {
  orders: Order[];
  expenses: Expense[];
  inventoryItems: InventoryItem[];
  language: 'ar' | 'en';
  dateFilter: 'today' | 'week' | 'month' | 'all';
  setDateFilter: (filter: 'today' | 'week' | 'month' | 'all') => void;
}

export default function FinancialsView({
  orders,
  expenses,
  inventoryItems,
  language,
  dateFilter,
  setDateFilter
}: FinancialsViewProps) {
  
  const filterDate = (dateStr: string | number) => {
    if (dateFilter === 'all') return true;
    const date = new Date(dateStr);
    const now = new Date();
    
    if (dateFilter === 'today') {
      return date.toDateString() === now.toDateString();
    }
    if (dateFilter === 'week') {
      const pastWeek = new Date(now);
      pastWeek.setDate(now.getDate() - 7);
      return date >= pastWeek;
    }
    if (dateFilter === 'month') {
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }
    return true;
  };

  // Only consider completed orders, excluding deferred & hospitality
  const filteredOrders = orders.filter(o => 
    o.status === 'completed' && 
    o.payment_method !== 'deferred' && 
    o.payment_method !== 'hospitality' && 
    (o.id ? filterDate(Number.isInteger(parseInt(o.id)) ? parseInt(o.id) : o.id) : true) // Order IDs are often timestamps
  );
  
  const filteredExpenses = expenses.filter(e => filterDate(e.expense_date || e.created_at || ''));

  const totalRevenue = filteredOrders.reduce((sum, o) => sum + o.total_price, 0);
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const netCashflow = totalRevenue - totalExpenses;

  // Breakdowns
  const revenueByType = filteredOrders.reduce((acc, o) => {
    const method = o.payment_method || 'cash';
    acc[method] = (acc[method] || 0) + o.total_price;
    return acc;
  }, {} as Record<string, number>);

  const stockMainValue = inventoryItems.reduce((sum, i) => sum + ((i.stock_main || 0) * (i.avg_purchase_price || 0)), 0);
  const stockFactoryValue = inventoryItems.reduce((sum, i) => sum + ((i.stock_factory || 0) * (i.avg_purchase_price || 0)), 0);
  const stockDistValue = inventoryItems.reduce((sum, i) => sum + ((i.stock_distribution || 0) * (i.avg_purchase_price || 0)), 0);

  const getMethodLabel = (method: string) => {
    switch(method) {
      case 'cash': return language === 'ar' ? 'كاش' : 'Cash';
      case 'visa': return language === 'ar' ? 'فيزا' : 'Visa';
      case 'wallet': return language === 'ar' ? 'محفظة' : 'Wallet';
      case 'instapay': return language === 'ar' ? 'إنستاباي' : 'Instapay';
      case 'split': return language === 'ar' ? 'دفع مقسم' : 'Split Payment';
      default: return method;
    }
  };

  const getMethodColor = (method: string) => {
    switch(method) {
      case 'cash': return '#10b981'; // Green
      case 'visa': return '#3b82f6'; // Blue
      case 'wallet': return '#8b5cf6'; // Purple
      case 'instapay': return '#f59e0b'; // Orange
      default: return '#6b7280';
    }
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString() + (language === 'ar' ? ' ج.م' : ' EGP');
  };

  return (
    <div className="admin-content-section fade-in">
      <div className="section-header">
        <h2>{language === 'ar' ? 'المعاملات المالية' : 'Financial Transactions'}</h2>
        <div className="action-buttons">
          <select 
            className="input-gold" 
            value={dateFilter} 
            onChange={e => setDateFilter(e.target.value as any)}
            style={{ padding: '0.5rem 1rem', borderRadius: '8px' }}
          >
            <option value="today">{language === 'ar' ? 'اليوم' : 'Today'}</option>
            <option value="week">{language === 'ar' ? 'هذا الأسبوع' : 'This Week'}</option>
            <option value="month">{language === 'ar' ? 'هذا الشهر' : 'This Month'}</option>
            <option value="all">{language === 'ar' ? 'كل الأوقات' : 'All Time'}</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Top Cashflow Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
          <div className="stat-card" style={{ background: 'var(--bg-darker)', border: '1px solid rgba(16, 185, 129, 0.3)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#10b981' }}></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ color: 'var(--text-gray)', fontSize: '1.1rem', margin: 0 }}>{language === 'ar' ? 'إجمالي الإيرادات' : 'Total Revenue'}</h3>
              <TrendingUp size={24} color="#10b981" />
            </div>
            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981', margin: 0 }}>
              {formatCurrency(totalRevenue)}
            </p>
          </div>

          <div className="stat-card" style={{ background: 'var(--bg-darker)', border: '1px solid rgba(239, 68, 68, 0.3)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#ef4444' }}></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ color: 'var(--text-gray)', fontSize: '1.1rem', margin: 0 }}>{language === 'ar' ? 'إجمالي المصروفات' : 'Total Expenses'}</h3>
              <TrendingDown size={24} color="#ef4444" />
            </div>
            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ef4444', margin: 0 }}>
              {formatCurrency(totalExpenses)}
            </p>
          </div>

          <div className="stat-card" style={{ background: 'var(--bg-darker)', border: `1px solid ${netCashflow >= 0 ? 'rgba(59, 130, 246, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: netCashflow >= 0 ? '#3b82f6' : '#ef4444' }}></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ color: 'var(--text-gray)', fontSize: '1.1rem', margin: 0 }}>{language === 'ar' ? 'صافي السيولة النقدية' : 'Net Cashflow'}</h3>
              <Landmark size={24} color={netCashflow >= 0 ? '#3b82f6' : '#ef4444'} />
            </div>
            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: netCashflow >= 0 ? '#3b82f6' : '#ef4444', margin: 0 }}>
              {formatCurrency(netCashflow)}
            </p>
          </div>
        </div>

        {/* Detailed Transactions (2 Columns) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
          
          {/* Revenues Column */}
          <div style={{ background: 'var(--bg-darker)', borderRadius: '12px', padding: '1.5rem', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <Banknote size={24} color="#10b981" />
              <h3 style={{ margin: 0, color: '#10b981' }}>{language === 'ar' ? 'الإيرادات (الطلبات المكتملة)' : 'Revenues (Completed)'}</h3>
            </div>
            
            {/* Payment Methods Breakdown */}
            <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
              {Object.entries(revenueByType).map(([method, amount]) => (
                <div key={method} style={{ background: 'rgba(255,255,255,0.05)', padding: '0.5rem 1rem', borderRadius: '8px', border: `1px solid ${getMethodColor(method)}` }}>
                  <span style={{ color: 'var(--text-gray)', fontSize: '0.8rem', display: 'block' }}>{getMethodLabel(method)}</span>
                  <span style={{ color: getMethodColor(method), fontWeight: 'bold' }}>{formatCurrency(amount)}</span>
                </div>
              ))}
            </div>

            <div style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '0.5rem' }} className="custom-scrollbar">
              {filteredOrders.length === 0 ? (
                <p style={{ color: 'var(--text-gray)', textAlign: 'center', padding: '2rem' }}>{language === 'ar' ? 'لا توجد إيرادات مسجلة في هذه الفترة' : 'No revenues found in this period'}</p>
              ) : (
                filteredOrders.map(order => (
                  <div key={order.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 'bold', color: 'var(--text-light)' }}>#{String(order.id).slice(-4)}</span>
                        <span style={{ fontSize: '0.8rem', padding: '2px 6px', borderRadius: '4px', background: `${getMethodColor(order.payment_method || 'cash')}20`, color: getMethodColor(order.payment_method || 'cash') }}>
                          {getMethodLabel(order.payment_method || 'cash')}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-gray)' }}>
                        {new Date(Number.isInteger(parseInt(order.id)) ? parseInt(order.id) : order.id).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}
                      </span>
                    </div>
                    <span style={{ fontWeight: 'bold', color: '#10b981' }}>+{order.total_price}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Expenses Column */}
          <div style={{ background: 'var(--bg-darker)', borderRadius: '12px', padding: '1.5rem', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <Receipt size={24} color="#ef4444" />
              <h3 style={{ margin: 0, color: '#ef4444' }}>{language === 'ar' ? 'المصروفات المسجلة' : 'Recorded Expenses'}</h3>
            </div>

            <div style={{ maxHeight: '495px', overflowY: 'auto', paddingRight: '0.5rem' }} className="custom-scrollbar">
              {filteredExpenses.length === 0 ? (
                <p style={{ color: 'var(--text-gray)', textAlign: 'center', padding: '2rem' }}>{language === 'ar' ? 'لا توجد مصروفات مسجلة في هذه الفترة' : 'No expenses found in this period'}</p>
              ) : (
                filteredExpenses.map(expense => (
                  <div key={expense.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 'bold', color: 'var(--text-light)' }}>{expense.name}</span>
                        <span style={{ fontSize: '0.8rem', padding: '2px 6px', borderRadius: '4px', background: `${getMethodColor(expense.payment_method || 'cash')}20`, color: getMethodColor(expense.payment_method || 'cash') }}>
                          {getMethodLabel(expense.payment_method || 'cash')}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-gray)' }}>
                        {expense.type} • {new Date(expense.expense_date || expense.created_at || '').toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US')}
                      </span>
                    </div>
                    <span style={{ fontWeight: 'bold', color: '#ef4444' }}>-{expense.amount}</span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Inventory Valuation */}
        <div style={{ marginTop: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.5rem' }}>
            <PackageOpen size={24} color="var(--gold-primary)" />
            <h2 style={{ margin: 0 }}>{language === 'ar' ? 'التقييم المالي للمخازن (حسب متوسط تكلفة الشراء)' : 'Inventory Valuation (by Avg Cost)'}</h2>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
            <div className="stat-card" style={{ background: 'var(--bg-darker)', border: '1px solid var(--border-color)', borderTop: '4px solid #8b5cf6' }}>
              <h3 style={{ color: 'var(--text-gray)', fontSize: '1.1rem', marginBottom: '1rem' }}>{language === 'ar' ? 'قيمة بضاعة المخزن الأساسي' : 'Main Inventory Value'}</h3>
              <p style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#8b5cf6', margin: 0 }}>
                {formatCurrency(stockMainValue)}
              </p>
            </div>
            
            <div className="stat-card" style={{ background: 'var(--bg-darker)', border: '1px solid var(--border-color)', borderTop: '4px solid #f59e0b' }}>
              <h3 style={{ color: 'var(--text-gray)', fontSize: '1.1rem', marginBottom: '1rem' }}>{language === 'ar' ? 'قيمة بضاعة مطبخ التصنيع' : 'Factory/Kitchen Value'}</h3>
              <p style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#f59e0b', margin: 0 }}>
                {formatCurrency(stockFactoryValue)}
              </p>
            </div>

            <div className="stat-card" style={{ background: 'var(--bg-darker)', border: '1px solid var(--border-color)', borderTop: '4px solid #06b6d4' }}>
              <h3 style={{ color: 'var(--text-gray)', fontSize: '1.1rem', marginBottom: '1rem' }}>{language === 'ar' ? 'قيمة بضاعة مخزن التوزيع' : 'Distribution Inventory Value'}</h3>
              <p style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#06b6d4', margin: 0 }}>
                {formatCurrency(stockDistValue)}
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Landmark, Banknote, PackageOpen, Receipt, ArrowRightLeft, X } from 'lucide-react';
import type { Order, Expense, InventoryItem } from '../types';
import { db } from '../lib/supabase';

interface FinancialsViewProps {
  orders: Order[];
  expenses: Expense[];
  financialTransactions?: any[];
  fetchFinancialTransactions?: () => void;
  inventoryItems: InventoryItem[];
  language: 'ar' | 'en';
  dateFilter: 'today' | 'week' | 'month' | 'all';
  setDateFilter: (filter: 'today' | 'week' | 'month' | 'all') => void;
  userRole?: string;
}

export default function FinancialsView({
  orders,
  expenses,
  financialTransactions = [],
  fetchFinancialTransactions,
  inventoryItems,
  language,
  dateFilter,
  setDateFilter,
  userRole
}: FinancialsViewProps) {
  
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferFrom, setTransferFrom] = useState('cash');
  const [transferTo, setTransferTo] = useState('visa');
  const [transferAmount, setTransferAmount] = useState('');
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);
  const [transferPartnerId, setTransferPartnerId] = useState('');
  const [partners, setPartners] = useState<any[]>([]);

  useEffect(() => {
    db.getPartners().then(p => setPartners(p)).catch(console.error);
  }, []);

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

  // تحويل أي قيمة لرقم آمن (أعمدة numeric في Supabase بترجع كنصوص)
  const num = (v: any): number => Number(v) || 0;
  type PaymentMethod = 'cash' | 'visa' | 'wallet' | 'wallet_restaurant' | 'instapay' | 'deferred' | 'petty_cash';
  const paymentMethods: PaymentMethod[] = ['cash', 'visa', 'wallet', 'wallet_restaurant', 'instapay', 'deferred', 'petty_cash'];
  const paymentPartsForOrder = (order: Order): Partial<Record<PaymentMethod, number>> => {
    const parts: Partial<Record<PaymentMethod, number>> = {};
    if (order.payment_method === 'split' && order.payment_details) {
      paymentMethods.forEach(method => {
        const amount = num(order.payment_details?.[method]);
        if (amount > 0) parts[method] = amount;
      });
      return parts;
    }
    const method = (order.payment_method || 'cash') as PaymentMethod;
    parts[paymentMethods.includes(method) ? method : 'cash'] = num(order.total_price);
    return parts;
  };

  // Only consider completed orders, excluding hospitality. Deferred is now INCLUDED in revenue
  const filteredOrders = orders.filter(o =>
    o.status === 'completed' &&
    o.payment_method !== 'hospitality' &&
    filterDate(o.created_at || '')
  );

  const filteredExpenses = expenses.filter(e => filterDate(e.expense_date || e.created_at || ''));

  const totalRevenue = filteredOrders.reduce((sum, o) => sum + num(o.total_price), 0);
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + num(e.amount), 0);
  const netCashflow = totalRevenue - totalExpenses; // Note: Revenue now includes deferred, so true net cashflow requires checking balances

  // Revenue Breakdown
  const revenueByType = { cash: 0, visa: 0, wallet: 0, wallet_restaurant: 0, instapay: 0, deferred: 0, petty_cash: 0 };
  

  filteredOrders.forEach(o => {
    Object.entries(paymentPartsForOrder(o)).forEach(([method, amount]) => {
      revenueByType[method as keyof typeof revenueByType] += num(amount);
    });
  });

  // Actual Vault/Bank balances (All Time)
  const actualBalances = { cash: 0, visa: 0, wallet: 0, wallet_restaurant: 0, instapay: 0, deferred: 0, petty_cash: 0 };
  

  // 1. Add All Revenues
  const allCompletedOrders = orders.filter(o => o.status === 'completed' && o.payment_method !== 'hospitality');
  allCompletedOrders.forEach(o => {
    Object.entries(paymentPartsForOrder(o)).forEach(([method, amount]) => {
      actualBalances[method as keyof typeof actualBalances] += num(amount);
    });
  });

  // 2. Subtract All Expenses
  expenses.forEach(e => {
    const method = e.payment_method || 'cash';
    if (actualBalances[method as keyof typeof actualBalances] !== undefined) {
      actualBalances[method as keyof typeof actualBalances] -= num(e.amount);
    }
  });

  // 3. Apply All Financial Transactions (Transfers & Debt Settlements)
  financialTransactions.forEach(tx => {
    if (tx.from_method && actualBalances[tx.from_method as keyof typeof actualBalances] !== undefined) {
      actualBalances[tx.from_method as keyof typeof actualBalances] -= num(tx.amount);
    }
    if (tx.to_method && actualBalances[tx.to_method as keyof typeof actualBalances] !== undefined) {
      actualBalances[tx.to_method as keyof typeof actualBalances] += num(tx.amount);
    }
  });

  const stockMainValue = inventoryItems.reduce((sum, i) => sum + (num(i.stock_main) * num(i.avg_purchase_price)), 0);
  const stockFactoryValue = inventoryItems.reduce((sum, i) => sum + (num(i.stock_factory) * num(i.avg_purchase_price)), 0);
  const stockDistValue = inventoryItems.reduce((sum, i) => sum + (num(i.stock_bar) * num(i.avg_purchase_price)), 0);

  const getMethodLabel = (method: string) => {
    switch(method) {
      case 'cash': return language === 'ar' ? 'كاش' : 'Cash';
      case 'visa': return language === 'ar' ? 'فيزا' : 'Visa';
      case 'wallet': return language === 'ar' ? 'محفظة (قديم)' : 'Wallet (Old)';
      case 'wallet_restaurant': return language === 'ar' ? 'محفظة المطعم' : 'Restaurant Wallet';
      case 'wallet_cafe': return language === 'ar' ? 'محفظة الكافيه' : 'Cafe Wallet';
      case 'instapay': return language === 'ar' ? 'إنستاباي' : 'Instapay';
      case 'deferred': return language === 'ar' ? 'آجل (مديونية)' : 'Deferred (Debt)';
      case 'split': return language === 'ar' ? 'دفع مقسم' : 'Split Payment';
      case 'petty_cash': return language === 'ar' ? 'عهدة الشريك' : 'Petty Cash';
      default: return method;
    }
  };

  const getMethodColor = (method: string) => {
    switch(method) {
      case 'cash': return '#10b981'; // Green
      case 'visa': return '#3b82f6'; // Blue
      case 'wallet': return '#8b5cf6'; // Purple
      case 'wallet_restaurant': return '#06b6d4'; // Cyan
      case 'instapay': return '#f59e0b'; // Orange
      case 'deferred': return '#ef4444'; // Red
      case 'petty_cash': return '#14b8a6'; // Teal
      default: return '#6b7280';
    }
  };

  const formatCurrency = (amount: number) => {
    return (Number(amount) || 0).toLocaleString() + (language === 'ar' ? ' ج.م' : ' EGP');
  };

  const handleTransferSubmit = async () => {
    const amount = Number(transferAmount);
    if (amount <= 0) return;
    if (transferFrom === transferTo) {
      alert(language === 'ar' ? 'لا يمكن التحويل لنفس الجهة' : 'Cannot transfer to the same method');
      return;
    }

    setIsSubmittingTransfer(true);
    try {
      await db.addFinancialTransaction({
        type: 'fund_transfer',
        amount,
        from_method: transferFrom,
        to_method: transferTo,
        partner_id: transferPartnerId || undefined,
        description: language === 'ar' ? 'تحويل أرصدة داخلي' : 'Internal Fund Transfer'
      });
      if (fetchFinancialTransactions) fetchFinancialTransactions();
      setShowTransferModal(false);
      setTransferAmount('');
    } catch (e) {
      console.error(e);
      alert('Error transferring funds');
    } finally {
      setIsSubmittingTransfer(false);
    }
  };

  return (
    <div className="admin-content-section fade-in">
      <div className="section-header">
        <h2>{language === 'ar' ? 'المعاملات المالية' : 'Financial Transactions'}</h2>
        <div className="action-buttons">
          <button className="btn-gold outline" onClick={() => setShowTransferModal(true)}>
            <ArrowRightLeft size={16} />
            {language === 'ar' ? 'تحويل بين الأرصدة' : 'Transfer Funds'}
          </button>
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
              <h3 style={{ color: 'var(--text-gray)', fontSize: '1.1rem', margin: 0 }}>{language === 'ar' ? 'صافي التدفقات (الفترة)' : 'Period Net Flow'}</h3>
              <Landmark size={24} color={netCashflow >= 0 ? '#3b82f6' : '#ef4444'} />
            </div>
            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: netCashflow >= 0 ? '#3b82f6' : '#ef4444', margin: 0 }}>
              {formatCurrency(netCashflow)}
            </p>
          </div>
        </div>

        {/* Treasurary Balances */}
        <div>
          <h3 style={{ marginBottom: '1rem', color: 'var(--text-light)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            {language === 'ar' ? 'أرصدة الخزينة والحسابات (خلال الفترة)' : 'Treasury Balances (Period)'}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            {['cash', 'visa', 'wallet_restaurant', 'instapay', 'deferred'].map(method => (
              <div key={method} style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px', border: `1px solid ${getMethodColor(method)}` }}>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-gray)' }}>{getMethodLabel(method)}</div>
                <div className="font-en" style={{ fontSize: '1.4rem', fontWeight: '800', color: getMethodColor(method) }}>
                  {formatCurrency(actualBalances[method as keyof typeof actualBalances])}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detailed Transactions (2 Columns) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
          
          {/* Revenues Column */}
          <div style={{ background: 'var(--bg-darker)', borderRadius: '12px', padding: '1.5rem', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <Banknote size={24} color="#10b981" />
              <h3 style={{ margin: 0, color: '#10b981' }}>{language === 'ar' ? 'تحليل الإيرادات (المبيعات)' : 'Revenue Analysis (Sales)'}</h3>
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
                filteredOrders.map(order => {
                  const paymentParts = Object.entries(paymentPartsForOrder(order)).filter(([, amount]) => num(amount) > 0);
                  return (
                  <div key={order.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 'bold', color: 'var(--text-light)' }}>#{String(order.id).slice(-4)}</span>
                        {paymentParts.map(([method, amount]) => (
                          <span key={method} style={{ fontSize: '0.8rem', padding: '2px 6px', borderRadius: '4px', background: `${getMethodColor(method)}20`, color: getMethodColor(method) }}>
                            {getMethodLabel(method)}: {formatCurrency(num(amount))}
                          </span>
                        ))}
                      </div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-gray)' }}>
                        {new Date(order.created_at || '').toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}
                      </span>
                    </div>
                    <span style={{ fontWeight: 'bold', color: '#10b981' }}>+{num(order.total_price)}</span>
                  </div>
                  );
                })
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
                    <span style={{ fontWeight: 'bold', color: '#ef4444' }}>-{num(expense.amount)}</span>
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
              <h3 style={{ color: 'var(--text-gray)', fontSize: '1.1rem', marginBottom: '1rem' }}>{language === 'ar' ? 'قيمة بضاعة مخزن التوزيع' : 'bar Inventory Value'}</h3>
              <p style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#06b6d4', margin: 0 }}>
                {formatCurrency(stockDistValue)}
              </p>
            </div>
          </div>
        </div>
        
      </div>

      {/* Fund Transfer Modal */}
      {showTransferModal && (
        <div className="modal-overlay" onClick={() => !isSubmittingTransfer && setShowTransferModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 className="text-gradient-gold" style={{ margin: 0 }}>
                {language === 'ar' ? 'تحويل أرصدة' : 'Fund Transfer'}
              </h3>
              <button className="close-btn" onClick={() => !isSubmittingTransfer && setShowTransferModal(false)} disabled={isSubmittingTransfer}>
                <X size={24} />
              </button>
            </div>
            
            <div className="modal-body">
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-gray)' }}>
                  {language === 'ar' ? 'من:' : 'From:'}
                </label>
                <select className="input-gold" value={transferFrom} onChange={e => setTransferFrom(e.target.value)} style={{ width: '100%' }}>
                  <option value="cash">{language === 'ar' ? 'كاش' : 'Cash'}</option>
                  <option value="visa">{language === 'ar' ? 'فيزا' : 'Visa'}</option>
                  <option value="wallet_restaurant">{language === 'ar' ? 'محفظة المطعم' : 'Restaurant Wallet'}</option>
                  <option value="wallet_cafe">{language === 'ar' ? 'محفظة الكافيه' : 'Cafe Wallet'}</option>

                  <option value="instapay">{language === 'ar' ? 'إنستاباي' : 'Instapay'}</option>
                  {userRole === 'admin' && (
                    <option value="petty_cash">{language === 'ar' ? 'عهدة الشريك' : 'Petty Cash'}</option>
                  )}
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-gray)' }}>
                  {language === 'ar' ? 'إلى:' : 'To:'}
                </label>
                <select className="input-gold" value={transferTo} onChange={e => setTransferTo(e.target.value)} style={{ width: '100%' }}>
                  <option value="cash">{language === 'ar' ? 'كاش' : 'Cash'}</option>
                  <option value="visa">{language === 'ar' ? 'فيزا' : 'Visa'}</option>
                  <option value="wallet_restaurant">{language === 'ar' ? 'محفظة المطعم' : 'Restaurant Wallet'}</option>
                  <option value="wallet_cafe">{language === 'ar' ? 'محفظة الكافيه' : 'Cafe Wallet'}</option>

                  <option value="instapay">{language === 'ar' ? 'إنستاباي' : 'Instapay'}</option>
                  {userRole === 'admin' && (
                    <option value="petty_cash">{language === 'ar' ? 'عهدة الشريك' : 'Petty Cash'}</option>
                  )}
                </select>
              </div>

              {(transferFrom === 'petty_cash' || transferTo === 'petty_cash') && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-gray)' }}>
                    {language === 'ar' ? 'اختر الشريك (العهدة):' : 'Select Partner (Petty Cash):'}
                  </label>
                  <select className="input-gold" value={transferPartnerId} onChange={e => setTransferPartnerId(e.target.value)} required style={{ width: '100%' }}>
                    <option value="">{language === 'ar' ? 'اختر الشريك...' : 'Select Partner...'}</option>
                    {partners.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-gray)' }}>
                  {language === 'ar' ? 'المبلغ:' : 'Amount:'}
                </label>
                <input 
                  type="number" 
                  className="input-gold" 
                  value={transferAmount} 
                  onChange={e => setTransferAmount(e.target.value)} 
                  placeholder="0.00"
                  style={{ width: '100%', fontSize: '1.2rem' }}
                />
              </div>

              <button 
                className="btn-gold" 
                style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}
                disabled={isSubmittingTransfer || Number(transferAmount) <= 0}
                onClick={handleTransferSubmit}
              >
                <ArrowRightLeft size={20} />
                {language === 'ar' ? 'تأكيد التحويل' : 'Confirm Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}


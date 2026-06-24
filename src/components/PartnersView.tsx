import { useState, useEffect } from 'react';
import { Users, PlusCircle, Edit, Trash2, ArrowUpRight, ArrowDownRight, Eye, X } from 'lucide-react';
import { db } from '../lib/supabase';
import type { Partner, PartnerTransaction } from '../types';

interface PartnersViewProps {
  language: 'ar' | 'en';
}

export default function PartnersView({ language }: PartnersViewProps) {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [transactions, setTransactions] = useState<PartnerTransaction[]>([]);
  

  // Modals state
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [editPartnerId, setEditPartnerId] = useState<string | null>(null);
  
  const [showTxModal, setShowTxModal] = useState(false);
  const [activePartnerId, setActivePartnerId] = useState<string | null>(null);

  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');

  const [txType, setTxType] = useState<'credit' | 'debit'>('credit');
  const [txAmount, setTxAmount] = useState('');
  const [txDesc, setTxDesc] = useState('');

  const fetchData = async () => {
    
    try {
      const pts = await db.getPartners();
      const txs = await db.getPartnerTransactions();
      setPartners(pts);
      setTransactions(txs);
    } catch (e) {
      console.error(e);
    } finally {
      
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSavePartner = async () => {
    if (!name.trim()) return;
    try {
      if (editPartnerId) {
        await db.updatePartner(editPartnerId, { name, phone, opening_balance: Number(openingBalance) || 0 });
      } else {
        await db.addPartner({ name, phone, opening_balance: Number(openingBalance) || 0 });
      }
      setShowPartnerModal(false);
      fetchData();
    } catch (e) {
      console.error(e);
      alert('Error saving partner');
    }
  };

  const handleSaveTransaction = async () => {
    if (!activePartnerId || !txAmount) return;
    try {
      await db.addPartnerTransaction({
        partner_id: activePartnerId,
        type: txType,
        amount: Number(txAmount),
        description: txDesc
      });
      setShowTxModal(false);
      fetchData();
    } catch (e) {
      console.error(e);
      alert('Error saving transaction');
    }
  };

  const handleDeletePartner = async (id: string) => {
    if (!confirm(language === 'ar' ? 'تأكيد الحذف؟' : 'Confirm delete?')) return;
    await db.deletePartner(id);
    fetchData();
  };

  // Calculations
  const calculatePartnerBalance = (pId: string, openBal: number) => {
    const pTxs = transactions.filter(t => t.partner_id === pId);
    const credits = pTxs.filter(t => t.type === 'credit').reduce((sum, t) => sum + Number(t.amount), 0);
    const debits = pTxs.filter(t => t.type === 'debit').reduce((sum, t) => sum + Number(t.amount), 0);
    return Number(openBal) + credits - debits;
  };

  const activePartnerTxs = transactions.filter(t => t.partner_id === activePartnerId);
  const activePartner = partners.find(p => p.id === activePartnerId);

  return (
    <div className="admin-content-section fade-in">
      <div className="section-header">
        <h2>{language === 'ar' ? 'العهد والشركاء' : 'Partners & Custody'}</h2>
        <button className="btn-gold" onClick={() => {
          setEditPartnerId(null);
          setName('');
          setPhone('');
          setOpeningBalance('0');
          setShowPartnerModal(true);
        }}>
          <PlusCircle size={16} />
          {language === 'ar' ? 'إضافة شريك جديد' : 'Add Partner'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginTop: '1rem' }}>
        {partners.map(p => {
          const bal = calculatePartnerBalance(p.id, p.opening_balance);
          return (
            <div key={p.id} className="stat-card" style={{ background: 'var(--bg-darker)', border: '1px solid var(--border-color)', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Users size={20} color="var(--gold-primary)" />
                    {p.name}
                  </h3>
                  <div style={{ color: 'var(--text-gray)', fontSize: '0.9rem', marginBottom: '1rem' }}>{p.phone || '-'}</div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="icon-btn" onClick={() => {
                    setEditPartnerId(p.id);
                    setName(p.name);
                    setPhone(p.phone || '');
                    setOpeningBalance(String(p.opening_balance));
                    setShowPartnerModal(true);
                  }}>
                    <Edit size={16} color="var(--text-light)" />
                  </button>
                  <button className="icon-btn" onClick={() => handleDeletePartner(p.id)}>
                    <Trash2 size={16} color="#ef4444" />
                  </button>
                </div>
              </div>

              <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', marginBottom: '1rem' }}>
                <div style={{ color: 'var(--text-gray)', fontSize: '0.9rem' }}>{language === 'ar' ? 'الرصيد الحالي:' : 'Current Balance:'}</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: bal >= 0 ? '#10b981' : '#ef4444' }}>
                  {bal.toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  className="btn-gold outline" 
                  style={{ flex: 1, padding: '0.5rem', display: 'flex', justifyContent: 'center', gap: '0.3rem', fontSize: '0.9rem' }}
                  onClick={() => {
                    setActivePartnerId(p.id);
                    setTxType('credit');
                    setTxAmount('');
                    setTxDesc('');
                    setShowTxModal(true);
                  }}
                >
                  <ArrowUpRight size={16} color="#10b981" />
                  {language === 'ar' ? 'إضافة دائن' : 'Add Credit'}
                </button>
                <button 
                  className="btn-gold outline" 
                  style={{ flex: 1, padding: '0.5rem', display: 'flex', justifyContent: 'center', gap: '0.3rem', fontSize: '0.9rem' }}
                  onClick={() => {
                    setActivePartnerId(p.id);
                    setTxType('debit');
                    setTxAmount('');
                    setTxDesc('');
                    setShowTxModal(true);
                  }}
                >
                  <ArrowDownRight size={16} color="#ef4444" />
                  {language === 'ar' ? 'إضافة مدين' : 'Add Debit'}
                </button>
                <button 
                  className="btn-gold outline" 
                  style={{ padding: '0.5rem', display: 'flex', justifyContent: 'center', gap: '0.3rem', fontSize: '0.9rem' }}
                  onClick={() => {
                    setActivePartnerId(p.id);
                    setShowDetailsModal(true);
                  }}
                >
                  <Eye size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add/Edit Partner Modal */}
      {showPartnerModal && (
        <div className="modal-overlay" onClick={() => setShowPartnerModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>{editPartnerId ? (language === 'ar' ? 'تعديل الشريك' : 'Edit Partner') : (language === 'ar' ? 'إضافة شريك جديد' : 'Add New Partner')}</h3>
              <button className="close-btn" onClick={() => setShowPartnerModal(false)}><X size={24} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label>{language === 'ar' ? 'اسم الشريك' : 'Partner Name'}</label>
                <input type="text" className="input-gold" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="form-group">
                <label>{language === 'ar' ? 'رقم الهاتف' : 'Phone'}</label>
                <input type="text" className="input-gold" value={phone} onChange={e => setPhone(e.target.value)} />
              </div>
              <div className="form-group">
                <label>{language === 'ar' ? 'الرصيد الافتتاحي' : 'Opening Balance'}</label>
                <input type="number" className="input-gold" value={openingBalance} onChange={e => setOpeningBalance(e.target.value)} />
              </div>
              <button className="btn-gold" onClick={handleSavePartner} style={{ width: '100%', marginTop: '1rem', padding: '1rem', justifyContent: 'center' }}>
                {language === 'ar' ? 'حفظ البيانات' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Modal */}
      {showTxModal && (
        <div className="modal-overlay" onClick={() => setShowTxModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 style={{ color: txType === 'credit' ? '#10b981' : '#ef4444' }}>
                {txType === 'credit' ? (language === 'ar' ? 'إضافة دائن (له)' : 'Add Credit') : (language === 'ar' ? 'إضافة مدين (عليه)' : 'Add Debit')}
              </h3>
              <button className="close-btn" onClick={() => setShowTxModal(false)}><X size={24} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label>{language === 'ar' ? 'المبلغ' : 'Amount'}</label>
                <input type="number" className="input-gold" value={txAmount} onChange={e => setTxAmount(e.target.value)} style={{ fontSize: '1.2rem', padding: '0.75rem' }} autoFocus />
              </div>
              <div className="form-group">
                <label>{language === 'ar' ? 'البيان / التفاصيل' : 'Description'}</label>
                <textarea className="input-gold" value={txDesc} onChange={e => setTxDesc(e.target.value)} style={{ minHeight: '100px', resize: 'vertical' }} />
              </div>
              <button className="btn-gold" onClick={handleSaveTransaction} style={{ width: '100%', marginTop: '1rem', padding: '1rem', justifyContent: 'center' }}>
                {language === 'ar' ? 'حفظ الحركة' : 'Save Transaction'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details Ledger Modal */}
      {showDetailsModal && activePartner && (
        <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%' }}>
            <div className="modal-header">
              <h3>{language === 'ar' ? `كشف حساب: ${activePartner.name}` : `Ledger: ${activePartner.name}`}</h3>
              <button className="close-btn" onClick={() => setShowDetailsModal(false)}><X size={24} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                <span>{language === 'ar' ? 'الرصيد الافتتاحي:' : 'Opening Balance:'}</span>
                <span style={{ fontWeight: 'bold' }}>{activePartner.opening_balance.toLocaleString()}</span>
              </div>
              
              <div style={{ maxHeight: '400px', overflowY: 'auto' }} className="custom-scrollbar">
                {activePartnerTxs.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--text-gray)', padding: '2rem' }}>
                    {language === 'ar' ? 'لا توجد حركات' : 'No transactions'}
                  </p>
                ) : (
                  <table className="data-table" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th>{language === 'ar' ? 'التاريخ' : 'Date'}</th>
                        <th>{language === 'ar' ? 'البيان' : 'Description'}</th>
                        <th>{language === 'ar' ? 'مدين (عليه)' : 'Debit'}</th>
                        <th>{language === 'ar' ? 'دائن (له)' : 'Credit'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activePartnerTxs.map(t => (
                        <tr key={t.id}>
                          <td style={{ fontSize: '0.9rem', color: 'var(--text-gray)' }}>
                            {new Date(t.created_at || '').toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US')}
                          </td>
                          <td>{t.description || '-'}</td>
                          <td style={{ color: '#ef4444', fontWeight: 'bold' }}>
                            {t.type === 'debit' ? Number(t.amount).toLocaleString() : '-'}
                          </td>
                          <td style={{ color: '#10b981', fontWeight: 'bold' }}>
                            {t.type === 'credit' ? Number(t.amount).toLocaleString() : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

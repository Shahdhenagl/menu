import { useState, useEffect, useMemo } from 'react';
import { Printer, RefreshCw, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import type { RestaurantSettings, ShiftClosing } from '../types';
import { db } from '../lib/supabase';
import { printShiftClosing } from '../utils/printUtils';

interface ShiftRecordsViewProps {
  settings?: RestaurantSettings | null;
  language: 'ar' | 'en';
}

const num = (v: any): number => Number(v) || 0;

export default function ShiftRecordsView({ settings, language }: ShiftRecordsViewProps) {
  const ar = language === 'ar';
  const [records, setRecords] = useState<ShiftClosing[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [bucketFilter, setBucketFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const fmt = (n: number) =>
    num(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + (ar ? ' ج.م' : ' EGP');
  const stamp = (iso: string) => new Date(iso).toLocaleString(ar ? 'ar-EG' : 'en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const load = async () => {
    setLoading(true);
    try {
      setRecords(await db.getShiftClosings());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const buckets = useMemo(() => [...new Set(records.map(r => r.bucket))], [records]);

  const filtered = useMemo(() => records.filter(r => {
    if (bucketFilter !== 'all' && r.bucket !== bucketFilter) return false;
    const day = new Date(r.to_at);
    const localDay = new Date(day.getTime() - day.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    if (fromDate && localDay < fromDate) return false;
    if (toDate && localDay > toDate) return false;
    return true;
  }), [records, bucketFilter, fromDate, toDate]);

  const totals = useMemo(() => ({
    collected: filtered.reduce((s, r) => s + num(r.collected), 0),
    subtotal: filtered.reduce((s, r) => s + num(r.subtotal), 0),
    tax: filtered.reduce((s, r) => s + num(r.tax), 0),
    orders: filtered.reduce((s, r) => s + num(r.orders_count), 0),
  }), [filtered]);

  // إعادة طباعة السجل من نفس البيانات المحفوظة وقت التقفيل
  const reprint = (r: ShiftClosing) => {
    const from = new Date(r.from_at);
    const to = new Date(r.to_at);
    const sameDay = from.toDateString() === to.toDateString();
    printShiftClosing({
      title: r.bucket_label,
      dayLabel: sameDay
        ? to.toLocaleDateString(ar ? 'ar-EG' : 'en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
        : `${from.toLocaleDateString(ar ? 'ar-EG' : 'en-GB')} → ${to.toLocaleDateString(ar ? 'ar-EG' : 'en-GB')}`,
      fromTime: from.toLocaleString(ar ? 'ar-EG' : 'en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
      toTime: to.toLocaleString(ar ? 'ar-EG' : 'en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
      ordersCount: num(r.orders_count),
      itemsCount: num(r.items_count),
      subtotal: num(r.subtotal),
      tax: num(r.tax),
      discount: num(r.discount),
      collected: num(r.collected),
      deposits: num(r.deposits),
      expenses: num(r.expenses),
      expectedBalance: r.expectedBalance !== undefined ? num(r.expectedBalance) : num(r.collected) + num(r.deposits) - num(r.expenses),
      depositsByMethod: (r.depositsByMethod || []).map(m => ({ method: m.method, label: m.label, amount: num(m.amount) })),
      expensesByMethod: (r.expensesByMethod || []).map(m => ({ method: m.method, label: m.label, amount: num(m.amount) })),
      methods: (r.methods || []).map(m => ({ label: m.label, amount: num(m.amount) })),
      orderTypes: r.order_types || [],
      taxGroups: r.tax_groups || [],
      categories: r.categories || [],
    }, language, settings);
  };

  return (
    <div className="admin-content-section fade-in">
      <div className="section-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <h2>{ar ? 'سجلات تقفيل الشفتات' : 'Shift Closing Records'}</h2>
        <button className="btn-gold outline" onClick={load}>
          <RefreshCw size={16} /> {ar ? 'تحديث' : 'Refresh'}
        </button>
      </div>

      {/* فلاتر */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '1.5rem' }}>
        <div className="form-group" style={{ minWidth: '180px' }}>
          <label>{ar ? 'الصالة' : 'Hall'}</label>
          <select className="input-gold" value={bucketFilter} onChange={e => setBucketFilter(e.target.value)}>
            <option value="all">{ar ? 'الكل' : 'All'}</option>
            {buckets.map(b => (
              <option key={b} value={b}>{records.find(r => r.bucket === b)?.bucket_label || b}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>{ar ? 'من تاريخ' : 'From'}</label>
          <input type="date" className="input-gold" value={fromDate} onChange={e => setFromDate(e.target.value)} />
        </div>
        <div className="form-group">
          <label>{ar ? 'إلى تاريخ' : 'To'}</label>
          <input type="date" className="input-gold" value={toDate} onChange={e => setToDate(e.target.value)} />
        </div>
        {(bucketFilter !== 'all' || fromDate || toDate) && (
          <button className="btn-gold outline" onClick={() => { setBucketFilter('all'); setFromDate(''); setToDate(''); }}>
            {ar ? 'مسح الفلاتر' : 'Clear filters'}
          </button>
        )}
      </div>

      {/* ملخص */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
        <Stat title={ar ? 'عدد التقفيلات' : 'Closings'} value={String(filtered.length)} c="var(--gold-primary)" />
        <Stat title={ar ? 'عدد الأوردرات' : 'Orders'} value={String(totals.orders)} c="#3b82f6" />
        <Stat title={ar ? 'قبل الضريبة' : 'Before tax'} value={fmt(totals.subtotal)} c="#9ca3af" />
        <Stat title={ar ? 'الضريبة' : 'Tax'} value={fmt(totals.tax)} c="#f59e0b" />
        <Stat title={ar ? 'إجمالي المحصل' : 'Collected'} value={fmt(totals.collected)} c="#10b981" />
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-gray)' }}>{ar ? 'جاري التحميل…' : 'Loading…'}</p>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-gray)' }}>
          <FileText size={56} style={{ opacity: 0.2, marginBottom: '1rem' }} />
          <p>{records.length === 0
            ? (ar ? 'مفيش سجلات تقفيل لسه' : 'No closing records yet')
            : (ar ? 'مفيش سجلات مطابقة للفلاتر' : 'No records match the filters')}</p>
          {records.length === 0 && (
            <p style={{ fontSize: '0.85rem', maxWidth: '520px', margin: '1rem auto 0', lineHeight: 1.7 }}>
              {ar
                ? 'لو عملت تقفيل ومظهرش هنا، غالبًا جدول السجلات مش متظبط في الداتا بيز. شغّل على Supabase: supabase_patch_v26_shift_closings.sql ثم supabase_patch_v28_shift_closing_details.sql'
                : 'If you closed a shift and nothing appears here, the records table is likely missing. Run supabase_patch_v26_shift_closings.sql then supabase_patch_v28_shift_closing_details.sql on Supabase.'}
            </p>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filtered.map(r => {
            const open = expanded === r.id;
            return (
              <div key={r.id} style={{ background: 'var(--bg-darker)', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
                {/* سطر السجل */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 220px' }}>
                    <div style={{ color: 'var(--gold-primary)', fontWeight: 800, fontSize: '1.05rem' }}>{r.bucket_label}</div>
                    <div style={{ color: 'var(--text-gray)', fontSize: '0.82rem', marginTop: '0.2rem' }}>
                      {ar ? 'من' : 'From'} {stamp(r.from_at)} → {stamp(r.to_at)}
                    </div>
                    {r.closed_by && (
                      <div style={{ color: 'var(--text-gray)', fontSize: '0.8rem' }}>
                        {ar ? 'قفلها:' : 'Closed by:'} <b style={{ color: 'var(--text-light)' }}>{r.closed_by}</b>
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'center', minWidth: '80px' }}>
                    <div style={{ color: 'var(--text-gray)', fontSize: '0.75rem' }}>{ar ? 'أوردرات' : 'Orders'}</div>
                    <div style={{ color: 'var(--text-light)', fontWeight: 800 }}>{r.orders_count}</div>
                  </div>
                  <div style={{ textAlign: 'center', minWidth: '110px' }}>
                    <div style={{ color: 'var(--text-gray)', fontSize: '0.75rem' }}>{ar ? 'الضريبة' : 'Tax'}</div>
                    <div style={{ color: '#f59e0b', fontWeight: 800 }}>{fmt(r.tax)}</div>
                  </div>
                  <div style={{ textAlign: 'center', minWidth: '130px' }}>
                    <div style={{ color: 'var(--text-gray)', fontSize: '0.75rem' }}>{ar ? 'المحصل' : 'Collected'}</div>
                    <div style={{ color: '#10b981', fontWeight: 900, fontSize: '1.05rem' }}>{fmt(r.collected)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button className="btn-gold" style={{ padding: '0.45rem 0.8rem', fontSize: '0.85rem' }} onClick={() => reprint(r)}>
                      <Printer size={15} /> {ar ? 'طباعة' : 'Print'}
                    </button>
                    <button className="btn-gold outline" style={{ padding: '0.45rem 0.7rem' }} onClick={() => setExpanded(open ? null : r.id)}>
                      {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {/* التقرير الكامل */}
                {open && (
                  <div style={{ borderTop: '1px solid var(--border-color)', padding: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                    <div>
                      <h4 style={{ color: 'var(--gold-primary)', margin: '0 0 0.75rem' }}>{ar ? 'التقسيم في الخزنة' : 'Drawer split'}</h4>
                      {(r.methods || []).length === 0 ? (
                        <p style={{ color: 'var(--text-gray)' }}>{ar ? 'لا يوجد' : 'None'}</p>
                      ) : (r.methods || []).map((m, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <span style={{ color: 'var(--text-light)' }}>{m.label}</span>
                          <b style={{ color: 'var(--text-light)' }}>{fmt(m.amount)}</b>
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderTop: '2px solid var(--gold-primary)', marginTop: '0.4rem' }}>
                        <b style={{ color: 'var(--text-light)' }}>{ar ? 'الإجمالي' : 'Total'}</b>
                        <b style={{ color: '#10b981' }}>{fmt(r.collected)}</b>
                      </div>

                      {/* حسب نوع الطلب */}
                      <h4 style={{ color: 'var(--gold-primary)', margin: '1.5rem 0 0.75rem' }}>{ar ? 'حسب نوع الطلب' : 'By order type'}</h4>
                      {(r.order_types || []).length === 0 ? (
                        <p style={{ color: 'var(--text-gray)' }}>{ar ? 'لا يوجد' : 'None'}</p>
                      ) : (r.order_types || []).map((t, i) => (
                        <div key={i} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem', marginBottom: '0.5rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-light)', fontWeight: 800 }}>
                            <span>{t.label}</span><span>{t.orders} {ar ? 'أوردر' : 'ord.'}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-gray)', marginTop: '0.3rem' }}>
                            <span>{ar ? 'قبل الضريبة' : 'Before tax'}</span><span>{fmt(t.subtotal)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#f59e0b' }}>
                            <span>{ar ? 'الضريبة' : 'Tax'}</span><span>{fmt(t.tax)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#10b981', fontWeight: 800 }}>
                            <span>{ar ? 'المحصل' : 'Collected'}</span><span>{fmt(t.collected)}</span>
                          </div>
                        </div>
                      ))}

                      {/* تجميع الضرائب */}
                      <h4 style={{ color: 'var(--gold-primary)', margin: '1.5rem 0 0.75rem' }}>{ar ? 'تجميع الضرائب' : 'Tax summary'}</h4>
                      {(r.tax_groups || []).length === 0 ? (
                        <p style={{ color: 'var(--text-gray)' }}>{ar ? 'لا يوجد' : 'None'}</p>
                      ) : (r.tax_groups || []).map((g, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <span style={{ color: 'var(--text-light)' }}>
                            {g.percent > 0 ? (ar ? `ضريبة ${g.percent}%` : `Tax ${g.percent}%`) : (ar ? 'بدون ضريبة' : 'No tax')}
                            <span style={{ color: 'var(--text-gray)', fontSize: '0.8rem', marginInlineStart: '0.5rem' }}>
                              ({ar ? 'وعاء' : 'base'} {fmt(g.base)})
                            </span>
                          </span>
                          <b style={{ color: '#f59e0b' }}>{fmt(g.tax)}</b>
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderTop: '2px solid #f59e0b', marginTop: '0.4rem' }}>
                        <b style={{ color: 'var(--text-light)' }}>{ar ? 'إجمالي الضرائب' : 'Total tax'}</b>
                        <b style={{ color: '#f59e0b' }}>{fmt(r.tax)}</b>
                      </div>
                    </div>

                    <div>
                      <h4 style={{ color: 'var(--gold-primary)', margin: '0 0 0.75rem' }}>
                        {ar ? 'الأصناف المباعة حسب التصنيف' : 'Items by category'} ({r.items_count})
                      </h4>
                      <div style={{ maxHeight: '340px', overflowY: 'auto' }} className="custom-scrollbar">
                        {(r.categories || []).map((c, ci) => (
                          <div key={ci} style={{ marginBottom: '1rem' }}>
                            <div style={{ background: '#111', color: 'var(--gold-primary)', fontWeight: 800, padding: '0.4rem 0.6rem', borderRadius: '6px' }}>
                              {c.name} — {c.qty} — {fmt(c.total)}
                            </div>
                            {c.lines.map((l, li) => (
                              <div key={li} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', padding: '0.4rem 0.6rem', borderBottom: '1px dotted rgba(255,255,255,0.08)' }}>
                                <span style={{ color: 'var(--text-light)' }}>
                                  <b style={{ color: 'var(--gold-primary)', marginInlineEnd: '0.5rem' }}>{l.qty}×</b>{l.name}
                                </span>
                                <span style={{ color: 'var(--text-light)' }}>{fmt(l.total)}</span>
                              </div>
                            ))}
                          </div>
                        ))}
                        {(r.categories || []).length === 0 && (
                          <p style={{ color: 'var(--text-gray)' }}>{ar ? 'لا يوجد' : 'None'}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ title, value, c }: { title: string; value: string; c: string }) {
  return (
    <div className="stat-card" style={{ background: 'var(--bg-darker)', border: '1px solid var(--border-color)', borderTop: `4px solid ${c}` }}>
      <h3 style={{ color: 'var(--text-gray)', fontSize: '0.95rem', margin: '0 0 0.5rem' }}>{title}</h3>
      <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: c, margin: 0 }}>{value}</p>
    </div>
  );
}

import { useState, useMemo } from 'react';
import { Printer, ChevronRight, ChevronLeft, TrendingUp, TrendingDown, Wallet, ArrowRightLeft } from 'lucide-react';
import type { Order, Expense, RestaurantSettings } from '../types';

interface DailyClosingViewProps {
  orders: Order[];
  expenses: Expense[];
  financialTransactions?: any[];
  settings?: RestaurantSettings;
  language: 'ar' | 'en';
}

// وسائل الدفع المعروضة في التقفيل
const METHODS = ['cash', 'visa', 'wallet_restaurant', 'wallet_bar', 'instapay', 'deferred', 'petty_cash'] as const;
type Method = typeof METHODS[number];

const num = (v: any): number => Number(v) || 0;

export default function DailyClosingView({
  orders,
  expenses,
  financialTransactions = [],
  settings,
  language,
}: DailyClosingViewProps) {
  const ar = language === 'ar';

  // اليوم المختار (افتراضيًا النهارده) بصيغة YYYY-MM-DD بالتوقيت المحلي
  const todayStr = (() => {
    const d = new Date();
    const off = d.getTimezoneOffset();
    return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
  })();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  const sameDay = (dateStr: string | number | undefined) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    const off = d.getTimezoneOffset();
    const local = new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
    return local === selectedDate;
  };

  const shiftDay = (delta: number) => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  const label = (m: string) => {
    switch (m) {
      case 'cash': return ar ? 'كاش' : 'Cash';
      case 'visa': return ar ? 'فيزا' : 'Visa';
      case 'wallet_restaurant': return ar ? 'محفظة المطعم' : 'Restaurant Wallet';
      case 'wallet_bar': return ar ? 'محفظة البار' : 'Bar Wallet';
      case 'instapay': return ar ? 'إنستاباي' : 'Instapay';
      case 'deferred': return ar ? 'آجل (مديونية)' : 'Deferred';
      case 'petty_cash': return ar ? 'عهدة الشريك' : 'Petty Cash';
      default: return m;
    }
  };
  const color = (m: string) => {
    switch (m) {
      case 'cash': return '#10b981';
      case 'visa': return '#3b82f6';
      case 'wallet_restaurant': return '#8b5cf6';
      case 'wallet_bar': return '#ec4899';
      case 'instapay': return '#f59e0b';
      case 'deferred': return '#ef4444';
      case 'petty_cash': return '#14b8a6';
      default: return '#6b7280';
    }
  };
  const fmt = (n: number) => (num(n)).toLocaleString('en-US') + (ar ? ' ج.م' : ' EGP');

  // فلترة بيانات اليوم المختار
  const dayOrders = useMemo(
    () => orders.filter(o => o.status === 'completed' && o.payment_method !== 'hospitality' && sameDay(o.created_at)),
    [orders, selectedDate]
  );
  const dayHospitality = useMemo(
    () => orders.filter(o => o.status === 'completed' && o.payment_method === 'hospitality' && sameDay(o.created_at)),
    [orders, selectedDate]
  );
  const dayExpenses = useMemo(
    () => expenses.filter(e => sameDay(e.expense_date || e.created_at)),
    [expenses, selectedDate]
  );
  const dayTransfers = useMemo(
    () => financialTransactions.filter(t => sameDay(t.created_at)),
    [financialTransactions, selectedDate]
  );

  // وارد لكل وسيلة (مع دعم الدفع المقسم)
  const incomingByMethod = useMemo(() => {
    const map: Record<string, number> = {};
    METHODS.forEach(m => (map[m] = 0));
    dayOrders.forEach(o => {
      if (o.payment_method === 'split' && o.payment_details) {
        map.cash += num(o.payment_details.cash);
        map.visa += num(o.payment_details.visa);
        map.wallet_restaurant += num(o.payment_details.wallet_restaurant) + num(o.payment_details.wallet);
        map.wallet_bar += num(o.payment_details.wallet_bar);
        map.instapay += num(o.payment_details.instapay);
        map.deferred += num(o.payment_details.deferred);
      } else {
        const m = (o.payment_method || 'cash') as Method;
        if (map[m] !== undefined) map[m] += num(o.total_price);
        else map.cash += num(o.total_price);
      }
    });
    return map;
  }, [dayOrders]);

  // صادر لكل وسيلة (المصروفات)
  const outgoingByMethod = useMemo(() => {
    const map: Record<string, number> = {};
    METHODS.forEach(m => (map[m] = 0));
    dayExpenses.forEach(e => {
      const m = (e.payment_method || 'cash') as Method;
      if (map[m] !== undefined) map[m] += num(e.amount);
      else map.cash += num(e.amount);
    });
    return map;
  }, [dayExpenses]);

  const totalIncoming = METHODS.reduce((s, m) => s + incomingByMethod[m], 0);
  const totalOutgoing = METHODS.reduce((s, m) => s + outgoingByMethod[m], 0);
  const net = totalIncoming - totalOutgoing;

  const restaurantName = ar
    ? (settings?.restaurant_name_ar || 'مريديان')
    : (settings?.restaurant_name_en || 'Meridien');

  const dayLabel = new Date(selectedDate + 'T12:00:00').toLocaleDateString(ar ? 'ar-EG' : 'en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  // ===== توليد PDF (نافذة طباعة نظيفة A4) =====
  const handlePrint = () => {
    const rows = METHODS
      .filter(m => incomingByMethod[m] !== 0 || outgoingByMethod[m] !== 0)
      .map(m => `
        <tr>
          <td class="lbl"><span class="dot" style="background:${color(m)}"></span>${label(m)}</td>
          <td class="in">${fmt(incomingByMethod[m])}</td>
          <td class="out">${outgoingByMethod[m] ? '- ' + fmt(outgoingByMethod[m]) : '—'}</td>
          <td class="net">${fmt(incomingByMethod[m] - outgoingByMethod[m])}</td>
        </tr>`).join('');

    const orderRows = dayOrders.map(o => `
      <tr>
        <td>#${String(o.id).slice(-5)}</td>
        <td>${new Date(o.created_at).toLocaleTimeString(ar ? 'ar-EG' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}</td>
        <td>${label(o.payment_method || 'cash')}</td>
        <td class="ta-end">${fmt(num(o.total_price))}</td>
      </tr>`).join('') || `<tr><td colspan="4" class="empty">${ar ? 'لا يوجد' : 'None'}</td></tr>`;

    const expenseRows = dayExpenses.map(e => `
      <tr>
        <td>${e.name || '-'}</td>
        <td>${e.type || '-'}</td>
        <td>${label(e.payment_method || 'cash')}</td>
        <td class="ta-end">- ${fmt(num(e.amount))}</td>
      </tr>`).join('') || `<tr><td colspan="4" class="empty">${ar ? 'لا يوجد' : 'None'}</td></tr>`;

    const transferRows = dayTransfers.map(t => `
      <tr>
        <td>${label(t.from_method || '-')}</td>
        <td>${label(t.to_method || '-')}</td>
        <td class="ta-end">${fmt(num(t.amount))}</td>
      </tr>`).join('') || `<tr><td colspan="3" class="empty">${ar ? 'لا يوجد' : 'None'}</td></tr>`;

    const html = `<!DOCTYPE html><html dir="${ar ? 'rtl' : 'ltr'}" lang="${ar ? 'ar' : 'en'}"><head><meta charset="utf-8"><title>${ar ? 'تقفيل يومي' : 'Daily Closing'} - ${dayLabel}</title>
    <style>
      * { margin:0; padding:0; box-sizing:border-box; font-family:'Segoe UI',Tahoma,Arial,sans-serif; }
      body { color:#111; padding:24px; font-size:13px; }
      .head { text-align:center; border-bottom:3px solid #111; padding-bottom:14px; margin-bottom:18px; }
      .head h1 { font-size:22px; letter-spacing:1px; }
      .head .sub { color:#555; margin-top:4px; font-size:14px; }
      .head .date { margin-top:8px; font-weight:700; font-size:15px; }
      .cards { display:flex; gap:12px; margin-bottom:20px; }
      .card { flex:1; border:1px solid #ddd; border-radius:10px; padding:12px; text-align:center; }
      .card .t { font-size:12px; color:#666; }
      .card .v { font-size:19px; font-weight:800; margin-top:4px; }
      .in-c { border-top:4px solid #10b981; } .in-c .v { color:#059669; }
      .out-c { border-top:4px solid #ef4444; } .out-c .v { color:#dc2626; }
      .net-c { border-top:4px solid #111; } .net-c .v { color:#111; }
      h2 { font-size:15px; margin:18px 0 8px; padding-bottom:5px; border-bottom:2px solid #ddd; }
      table { width:100%; border-collapse:collapse; margin-bottom:6px; }
      th,td { padding:7px 9px; border-bottom:1px solid #eee; text-align:${ar ? 'right' : 'left'}; }
      th { background:#f5f5f5; font-size:12px; color:#333; }
      .ta-end { text-align:${ar ? 'left' : 'right'}; font-variant-numeric:tabular-nums; font-weight:700; }
      .pm td { font-size:13px; }
      .pm .in { color:#059669; font-weight:700; }
      .pm .out { color:#dc2626; }
      .pm .net { font-weight:800; }
      .pm .lbl { font-weight:600; }
      .dot { display:inline-block; width:9px; height:9px; border-radius:50%; margin-inline-end:6px; vertical-align:middle; }
      tfoot td { font-weight:800; background:#111; color:#fff; }
      .empty { text-align:center; color:#999; padding:14px; }
      .foot { margin-top:22px; text-align:center; color:#888; font-size:11px; border-top:1px solid #ddd; padding-top:10px; }
      @media print { body { padding:0; } @page { margin:14mm; } }
    </style></head><body>
      <div class="head">
        <h1>${restaurantName}</h1>
        <div class="sub">${ar ? 'تقرير التقفيل اليومي' : 'Daily Closing Report'}</div>
        <div class="date">${dayLabel}</div>
      </div>

      <div class="cards">
        <div class="card in-c"><div class="t">${ar ? 'إجمالي الوارد' : 'Total Incoming'}</div><div class="v">${fmt(totalIncoming)}</div></div>
        <div class="card out-c"><div class="t">${ar ? 'إجمالي الصادر' : 'Total Outgoing'}</div><div class="v">${fmt(totalOutgoing)}</div></div>
        <div class="card net-c"><div class="t">${ar ? 'الصافي' : 'Net'}</div><div class="v">${fmt(net)}</div></div>
        <div class="card"><div class="t">${ar ? 'عدد الأوردرات' : 'Orders'}</div><div class="v">${dayOrders.length}</div></div>
      </div>

      <h2>${ar ? 'الحركة حسب وسيلة الدفع' : 'Movement by Payment Method'}</h2>
      <table class="pm">
        <thead><tr><th>${ar ? 'الوسيلة' : 'Method'}</th><th>${ar ? 'وارد' : 'In'}</th><th>${ar ? 'صادر' : 'Out'}</th><th>${ar ? 'الصافي' : 'Net'}</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="4" class="empty">${ar ? 'لا توجد حركة' : 'No movement'}</td></tr>`}</tbody>
        <tfoot><tr><td>${ar ? 'الإجمالي' : 'Total'}</td><td>${fmt(totalIncoming)}</td><td>- ${fmt(totalOutgoing)}</td><td>${fmt(net)}</td></tr></tfoot>
      </table>

      <h2>${ar ? 'الوارد — الأوردرات' : 'Incoming — Orders'} (${dayOrders.length})</h2>
      <table>
        <thead><tr><th>${ar ? 'رقم' : '#'}</th><th>${ar ? 'الوقت' : 'Time'}</th><th>${ar ? 'الدفع' : 'Payment'}</th><th class="ta-end">${ar ? 'المبلغ' : 'Amount'}</th></tr></thead>
        <tbody>${orderRows}</tbody>
      </table>

      <h2>${ar ? 'الصادر — المصروفات' : 'Outgoing — Expenses'} (${dayExpenses.length})</h2>
      <table>
        <thead><tr><th>${ar ? 'البند' : 'Item'}</th><th>${ar ? 'النوع' : 'Type'}</th><th>${ar ? 'الدفع' : 'Payment'}</th><th class="ta-end">${ar ? 'المبلغ' : 'Amount'}</th></tr></thead>
        <tbody>${expenseRows}</tbody>
      </table>

      <h2>${ar ? 'تحويلات بين الأرصدة' : 'Fund Transfers'} (${dayTransfers.length})</h2>
      <table>
        <thead><tr><th>${ar ? 'من' : 'From'}</th><th>${ar ? 'إلى' : 'To'}</th><th class="ta-end">${ar ? 'المبلغ' : 'Amount'}</th></tr></thead>
        <tbody>${transferRows}</tbody>
      </table>

      ${dayHospitality.length ? `<h2>${ar ? 'ضيافة (بدون تحصيل)' : 'Hospitality (No Charge)'}</h2><p style="color:#666;font-size:12px">${dayHospitality.length} ${ar ? 'أوردر ضيافة' : 'hospitality orders'}</p>` : ''}

      <div class="foot">${ar ? 'تم إنشاء التقرير في' : 'Generated on'} ${new Date().toLocaleString(ar ? 'ar-EG' : 'en-GB')}</div>
      <script>window.onload=function(){setTimeout(function(){window.print();},300);};</script>
    </body></html>`;

    const w = window.open('', '_blank', 'width=900,height=1000');
    if (!w) { alert(ar ? 'اسمح بالنوافذ المنبثقة للطباعة' : 'Allow pop-ups to print'); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  return (
    <div className="admin-content-section fade-in">
      <div className="section-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <h2>{ar ? 'التقفيل اليومي' : 'Daily Closing'}</h2>
        <div className="action-buttons" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* منتقي اليوم */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <button className="btn-gold outline" style={{ padding: '0.5rem' }} onClick={() => shiftDay(-1)} title={ar ? 'اليوم السابق' : 'Previous day'}>
              {ar ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
            <input
              type="date"
              className="input-gold"
              value={selectedDate}
              max={todayStr}
              onChange={e => setSelectedDate(e.target.value)}
              style={{ padding: '0.5rem 0.75rem', borderRadius: '8px' }}
            />
            <button className="btn-gold outline" style={{ padding: '0.5rem' }} onClick={() => shiftDay(1)} disabled={selectedDate >= todayStr} title={ar ? 'اليوم التالي' : 'Next day'}>
              {ar ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
            </button>
            {selectedDate !== todayStr && (
              <button className="btn-gold outline" style={{ padding: '0.5rem 0.75rem' }} onClick={() => setSelectedDate(todayStr)}>
                {ar ? 'النهارده' : 'Today'}
              </button>
            )}
          </div>
          <button className="btn-gold" onClick={handlePrint}>
            <Printer size={16} /> {ar ? 'طباعة / PDF' : 'Print / PDF'}
          </button>
        </div>
      </div>

      <div style={{ color: 'var(--text-gray)', marginBottom: '1.5rem', fontSize: '1rem' }}>{dayLabel}</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* بطاقات ملخص */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
          <SummaryCard title={ar ? 'إجمالي الوارد' : 'Total Incoming'} value={fmt(totalIncoming)} c="#10b981" icon={<TrendingUp size={24} color="#10b981" />} />
          <SummaryCard title={ar ? 'إجمالي الصادر' : 'Total Outgoing'} value={fmt(totalOutgoing)} c="#ef4444" icon={<TrendingDown size={24} color="#ef4444" />} />
          <SummaryCard title={ar ? 'الصافي' : 'Net'} value={fmt(net)} c={net >= 0 ? '#3b82f6' : '#ef4444'} icon={<Wallet size={24} color={net >= 0 ? '#3b82f6' : '#ef4444'} />} />
          <SummaryCard title={ar ? 'عدد الأوردرات' : 'Orders'} value={String(dayOrders.length)} c="var(--gold-primary)" icon={<ArrowRightLeft size={24} color="var(--gold-primary)" />} />
        </div>

        {/* جدول وسائل الدفع */}
        <div style={{ background: 'var(--bg-darker)', borderRadius: '12px', padding: '1.5rem', border: '1px solid var(--border-color)' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--text-light)' }}>{ar ? 'الحركة حسب وسيلة الدفع' : 'Movement by Payment Method'}</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '520px' }}>
              <thead>
                <tr style={{ color: 'var(--text-gray)', fontSize: '0.85rem' }}>
                  <th style={thStyle(ar)}>{ar ? 'الوسيلة' : 'Method'}</th>
                  <th style={thStyle(ar, 'end')}>{ar ? 'وارد' : 'Incoming'}</th>
                  <th style={thStyle(ar, 'end')}>{ar ? 'صادر' : 'Outgoing'}</th>
                  <th style={thStyle(ar, 'end')}>{ar ? 'الصافي' : 'Net'}</th>
                </tr>
              </thead>
              <tbody>
                {METHODS.filter(m => incomingByMethod[m] !== 0 || outgoingByMethod[m] !== 0).map(m => (
                  <tr key={m} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <td style={tdStyle(ar)}>
                      <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: color(m), marginInlineEnd: '8px' }} />
                      {label(m)}
                    </td>
                    <td style={{ ...tdStyle(ar, 'end'), color: '#10b981', fontWeight: 700 }}>{fmt(incomingByMethod[m])}</td>
                    <td style={{ ...tdStyle(ar, 'end'), color: outgoingByMethod[m] ? '#ef4444' : 'var(--text-gray)' }}>{outgoingByMethod[m] ? '- ' + fmt(outgoingByMethod[m]) : '—'}</td>
                    <td style={{ ...tdStyle(ar, 'end'), fontWeight: 800 }}>{fmt(incomingByMethod[m] - outgoingByMethod[m])}</td>
                  </tr>
                ))}
                {METHODS.every(m => incomingByMethod[m] === 0 && outgoingByMethod[m] === 0) && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-gray)' }}>{ar ? 'لا توجد حركة في هذا اليوم' : 'No movement on this day'}</td></tr>
                )}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--gold-primary)' }}>
                  <td style={{ ...tdStyle(ar), fontWeight: 800 }}>{ar ? 'الإجمالي' : 'Total'}</td>
                  <td style={{ ...tdStyle(ar, 'end'), color: '#10b981', fontWeight: 800 }}>{fmt(totalIncoming)}</td>
                  <td style={{ ...tdStyle(ar, 'end'), color: '#ef4444', fontWeight: 800 }}>- {fmt(totalOutgoing)}</td>
                  <td style={{ ...tdStyle(ar, 'end'), fontWeight: 900, color: 'var(--gold-primary)' }}>{fmt(net)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* التفاصيل: أوردرات + مصروفات */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
          <DetailPanel title={`${ar ? 'الوارد — الأوردرات' : 'Incoming — Orders'} (${dayOrders.length})`} c="#10b981">
            {dayOrders.length === 0 ? <Empty ar={ar} /> : dayOrders.map(o => (
              <Row key={o.id}
                left={<><b style={{ color: 'var(--text-light)' }}>#{String(o.id).slice(-5)}</b> <span style={{ fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px', background: `${color(o.payment_method || 'cash')}20`, color: color(o.payment_method || 'cash') }}>{label(o.payment_method || 'cash')}</span></>}
                sub={new Date(o.created_at).toLocaleTimeString(ar ? 'ar-EG' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}
                right={<span style={{ color: '#10b981', fontWeight: 700 }}>+{fmt(num(o.total_price))}</span>}
              />
            ))}
          </DetailPanel>

          <DetailPanel title={`${ar ? 'الصادر — المصروفات' : 'Outgoing — Expenses'} (${dayExpenses.length})`} c="#ef4444">
            {dayExpenses.length === 0 ? <Empty ar={ar} /> : dayExpenses.map(e => (
              <Row key={e.id}
                left={<><b style={{ color: 'var(--text-light)' }}>{e.name}</b> <span style={{ fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px', background: `${color(e.payment_method || 'cash')}20`, color: color(e.payment_method || 'cash') }}>{label(e.payment_method || 'cash')}</span></>}
                sub={e.type || ''}
                right={<span style={{ color: '#ef4444', fontWeight: 700 }}>-{fmt(num(e.amount))}</span>}
              />
            ))}
          </DetailPanel>
        </div>

        {/* تحويلات */}
        {dayTransfers.length > 0 && (
          <DetailPanel title={`${ar ? 'تحويلات بين الأرصدة' : 'Fund Transfers'} (${dayTransfers.length})`} c="#f59e0b">
            {dayTransfers.map(t => (
              <Row key={t.id}
                left={<span>{label(t.from_method || '-')} → {label(t.to_method || '-')}</span>}
                sub={t.description || ''}
                right={<span style={{ color: '#f59e0b', fontWeight: 700 }}>{fmt(num(t.amount))}</span>}
              />
            ))}
          </DetailPanel>
        )}
      </div>
    </div>
  );
}

// ===== عناصر مساعدة =====
function SummaryCard({ title, value, c, icon }: { title: string; value: string; c: string; icon: React.ReactNode }) {
  return (
    <div className="stat-card" style={{ background: 'var(--bg-darker)', border: '1px solid var(--border-color)', borderTop: `4px solid ${c}`, position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h3 style={{ color: 'var(--text-gray)', fontSize: '1rem', margin: 0 }}>{title}</h3>
        {icon}
      </div>
      <p style={{ fontSize: '1.7rem', fontWeight: 'bold', color: c, margin: 0 }}>{value}</p>
    </div>
  );
}

function DetailPanel({ title, c, children }: { title: string; c: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bg-darker)', borderRadius: '12px', padding: '1.25rem', border: '1px solid var(--border-color)' }}>
      <h3 style={{ margin: '0 0 1rem', color: c, borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>{title}</h3>
      <div style={{ maxHeight: '420px', overflowY: 'auto', paddingInlineEnd: '0.5rem' }} className="custom-scrollbar">{children}</div>
    </div>
  );
}

function Row({ left, sub, right }: { left: React.ReactNode; sub?: string; right: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0.25rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>{left}</div>
        {sub ? <span style={{ fontSize: '0.78rem', color: 'var(--text-gray)' }}>{sub}</span> : null}
      </div>
      <div>{right}</div>
    </div>
  );
}

function Empty({ ar }: { ar: boolean }) {
  return <p style={{ color: 'var(--text-gray)', textAlign: 'center', padding: '2rem' }}>{ar ? 'لا يوجد' : 'None'}</p>;
}

const thStyle = (ar: boolean, align: 'start' | 'end' = 'start'): React.CSSProperties => ({
  textAlign: align === 'end' ? (ar ? 'left' : 'right') : (ar ? 'right' : 'left'),
  padding: '0.6rem 0.5rem', fontWeight: 600,
});
const tdStyle = (ar: boolean, align: 'start' | 'end' = 'start'): React.CSSProperties => ({
  textAlign: align === 'end' ? (ar ? 'left' : 'right') : (ar ? 'right' : 'left'),
  padding: '0.7rem 0.5rem', color: 'var(--text-light)', fontVariantNumeric: 'tabular-nums',
});

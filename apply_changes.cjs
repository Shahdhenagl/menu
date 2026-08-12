/**
 * apply_changes.cjs
 * Applies all POS changes cleanly to PosSystem.proper.tsx → src/components/PosSystem.tsx
 *
 * Changes:
 * 1. Remove wallet_bar payment method entirely
 * 2. Rename wallet_restaurant → wallet_cashier (خزنة الكاشير / Cashier Wallet)
 * 3. Add "Pay Full" (سداد كامل) button next to each payment input
 * 4. Drawer auto-selection already exists in proper file
 */
const fs = require('fs');

let content = fs.readFileSync('PosSystem.proper.tsx', 'utf8');

// ── 1. Remove wallet_bar from PayMethod type ──
content = content.replace(
  "type PayMethod = 'cash' | 'visa' | 'wallet_restaurant' | 'wallet_bar' | 'instapay' | 'deferred';",
  "type PayMethod = 'cash' | 'visa' | 'wallet_cashier' | 'instapay' | 'deferred';"
);

// ── 2. Remove wallet_bar from payMethods array ──
content = content.replace(
  "const payMethods: PayMethod[] = ['cash', 'visa', 'wallet_restaurant', 'wallet_bar', 'instapay', 'deferred'];",
  "const payMethods: PayMethod[] = ['cash', 'visa', 'wallet_cashier', 'instapay', 'deferred'];"
);

// ── 3. Update payMethodLabel: rename restaurant → cashier, remove bar ──
content = content.replace(
  "if (method === 'wallet_restaurant') return language === 'ar' ? 'محفظة المطعم' : 'Restaurant Wallet';",
  "if (method === 'wallet_cashier') return language === 'ar' ? 'خزنة الكاشير' : 'Cashier Wallet';"
);
content = content.replace(
  /    if \(method === 'wallet_bar'\) return language === 'ar' \? 'محفظة البار' : 'Bar Wallet';\n/,
  ''
);

// ── 4. Rename state: payWalletRestaurant → payWalletCashier, remove payWalletBar ──
content = content.replace(
  /const \[payWalletBar, setPayWalletBar\] = useState<number \| ''>\(''\);\n/,
  ''
);
content = content.replace(
  "const [payWalletRestaurant, setPayWalletRestaurant] = useState<number | ''>('');",
  "const [payWalletCashier, setPayWalletCashier] = useState<number | ''>('');"
);

// ── 5. Rename all remaining references ──
content = content.replace(/payWalletRestaurant/g, 'payWalletCashier');
content = content.replace(/setPayWalletRestaurant/g, 'setPayWalletCashier');
content = content.replace(/walletRestaurantVal/g, 'walletCashierVal');
content = content.replace(/wallet_restaurant/g, 'wallet_cashier');

// ── 6. Remove payWalletBar state reset ──
content = content.replace(/\s*setPayWalletBar\(''\);\n/g, '\n');

// ── 7. Remove walletBarVal computation and usage ──
content = content.replace(
  /\s*const walletBarVal = Number\(payWalletBar\) \|\| 0;\n/,
  '\n'
);
content = content.replace(
  /const totalPaid = cashVal \+ visaVal \+ walletCashierVal \+ walletBarVal \+ instapayVal;/,
  'const totalPaid = cashVal + visaVal + walletCashierVal + instapayVal;'
);

// ── 8. Remove walletBarVal from activeMethods ──
content = content.replace(
  /\s*walletBarVal > 0 && 'wallet_bar',\n/,
  '\n'
);

// ── 9. Remove wallet_bar from paymentDetails ──
content = content.replace(
  /\s*wallet_bar: walletBarVal,\n/,
  '\n'
);

// ── 10. Fix label text: محفظة المطعم → خزنة الكاشير ──
content = content.replace(
  /محفظة المطعم/g,
  'خزنة الكاشير'
);
content = content.replace(
  /Restaurant Wallet/g,
  'Cashier Wallet'
);

// ── 11. Remove BOTH Bar Wallet input sections (there are 2 duplicates in proper file) ──
// First Bar Wallet block (lines ~2741-2753)
content = content.replace(
  /                  <div>\n                    <label style=\{\{ display: 'block', marginBottom: '0\.5rem', color: 'var\(--text-muted\)', fontSize: '0\.9rem' \}\}>\n                      📱 \{language === 'ar' \? 'محفظة البار' : 'Bar Wallet'\}\n                    <\/label>\n                    <input \n                      type="number"\n                      className="pos-input"\n                      placeholder="0\.00"\n                      value=\{payWalletBar\}\n                      onChange=\{\(e\) => setPayWalletBar\(e\.target\.value === '' \? '' : parseFloat\(e\.target\.value\)\)\}\n                      min="0"\n                    \/>\n                  <\/div>\n/g,
  ''
);
// Second Bar Wallet block (lines ~2755-2767) 
content = content.replace(
  /                  <div>\n                    <label style=\{\{ display: 'block', marginBottom: '0\.5rem', color: 'var\(--text-muted\)', fontSize: '0\.9rem' \}\}>\n                      🍸 \{language === 'ar' \? 'محفظة البار' : 'Bar Wallet'\}\n                    <\/label>\n                    <input\n                      type="number"\n                      className="pos-input"\n                      placeholder="0\.00"\n                      value=\{payWalletBar\}\n                      onChange=\{\(e\) => setPayWalletBar\(e\.target\.value === '' \? '' : parseFloat\(e\.target\.value\)\)\}\n                      min="0"\n                    \/>\n                  <\/div>\n/g,
  ''
);

// ── 12. Add "سداد كامل" (Pay Full) button next to each payment input ──
// We'll wrap each input in a flex row with a "Full" button

const addPayFullButton = (label, stateVar, setterFn, icon) => {
  // Find the input for this payment method and wrap it
  const inputPattern = new RegExp(
    `(                  <div>\\n                    <label[^]*?${icon}[^]*?<\\/label>\\n)                    (<input[^]*?value=\\{${stateVar}\\}[^]*?\\/>\\n                  <\\/div>)`,
    ''
  );
  
  content = content.replace(inputPattern, (match, labelPart, inputPart) => {
    return labelPart +
      `                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>\n` +
      `                      <input \n` +
      `                        type="number"\n` +
      `                        className="pos-input"\n` +
      `                        style={{ flex: 1 }}\n` +
      `                        placeholder="0.00"\n` +
      `                        value={${stateVar}}\n` +
      `                        onChange={(e) => ${setterFn}(e.target.value === '' ? '' : parseFloat(e.target.value))}\n` +
      `                        min="0"\n` +
      `                      />\n` +
      `                      <button\n` +
      `                        type="button"\n` +
      `                        style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--gold-primary)', background: 'rgba(212,175,55,0.1)', color: 'var(--gold-primary)', fontWeight: 'bold', fontSize: '0.78rem', cursor: 'pointer', whiteSpace: 'nowrap' }}\n` +
      `                        onClick={() => { playClickSound(); ${setterFn}(totalForOrder(collectPaymentOrder)); }}\n` +
      `                      >\n` +
      `                        {language === 'ar' ? 'كامل' : 'Full'}\n` +
      `                      </button>\n` +
      `                    </div>\n` +
      `                  </div>`;
  });
};

// For Cash
addPayFullButton('Cash', 'payCash', 'setPayCash', '💵');
// For Visa 
addPayFullButton('Visa', 'payVisa', 'setPayVisa', '💳');
// For Cashier Wallet
addPayFullButton('Cashier Wallet', 'payWalletCashier', 'setPayWalletCashier', '📱');
// For InstaPay
addPayFullButton('InstaPay', 'payInstapay', 'setPayInstapay', '⚡');

// ── Write output ──
fs.writeFileSync('src/components/PosSystem.tsx', content);
console.log('✅ All changes applied successfully!');

// Quick validation: count opening/closing tags
const opens = (content.match(/<div/g) || []).length;
const closes = (content.match(/<\/div>/g) || []).length;
console.log(`div balance: opens=${opens}, closes=${closes}, diff=${opens - closes}`);

const motionOpens = (content.match(/<motion\.div/g) || []).length;
const motionCloses = (content.match(/<\/motion\.div>/g) || []).length;
console.log(`motion.div balance: opens=${motionOpens}, closes=${motionCloses}, diff=${motionOpens - motionCloses}`);

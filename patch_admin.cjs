const fs = require('fs');
let text = fs.readFileSync('src/components/AdminDashboard.tsx', 'utf8');

text = text.replace(/'cash', 'visa', 'wallet_restaurant', 'instapay', 'deferred', 'petty_cash'/g, "'cash', 'visa', 'wallet_restaurant', 'wallet_cafe', 'instapay', 'deferred', 'petty_cash'");

text = text.replace(/method === 'wallet_restaurant' \? 'Restaurant Wallet' : method === 'petty_cash'/g, "method === 'wallet_restaurant' ? 'Restaurant Wallet' : method === 'wallet_cafe' ? 'Cafe Wallet' : method === 'petty_cash'");

text = text.replace(/method === 'wallet_restaurant' \? 'محفظة المطعم' : method === 'petty_cash'/g, "method === 'wallet_restaurant' ? 'محفظة المطعم' : method === 'wallet_cafe' ? 'محفظة الكافيه' : method === 'petty_cash'");

text = text.replace(/e\.payment_method === 'wallet_restaurant' \? '📱 محفظة المطعم' : e\.payment_method === 'petty_cash'/g, "e.payment_method === 'wallet_restaurant' ? '📱 محفظة المطعم' : e.payment_method === 'wallet_cafe' ? '📱 محفظة الكافيه' : e.payment_method === 'petty_cash'");

text = text.replace(/m === 'wallet_restaurant' \? '📱 محفظة المطعم' : m === 'petty_cash'/g, "m === 'wallet_restaurant' ? '📱 محفظة المطعم' : m === 'wallet_cafe' ? '📱 محفظة الكافيه' : m === 'petty_cash'");

fs.writeFileSync('src/components/AdminDashboard.tsx', text);
console.log("Done");

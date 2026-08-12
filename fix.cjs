const fs = require('fs');
let content = fs.readFileSync('src/components/PosSystem.tsx', 'utf8');

const targetLines = [
  "                  <div style={{ background: 'rgba(56,189,248,0.06)', border: '1px dashed rgba(56,189,248,0.3)', borderRadius: '10px', padding: '0.9rem', marginBottom: '1.25rem' }}>",
  "                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a1a1aa', fontSize: '0.9rem' }}>",
  "                      <span>{language === 'ar' ? 'قيمة الطلب:' : 'Order value:'}</span>",
  "                      <b style={{ color: '#fff' }}>{totalForOrder(collectPaymentOrder).toFixed(2)} EGP</b>",
  "              exit={{ opacity: 0 }}"
];

const targetStrMatch = new RegExp(targetLines.join('\\r?\\n'));
const replacementStr = fs.readFileSync('replacement.txt', 'utf8') + '\n              exit={{ opacity: 0 }}';

if (content.match(targetStrMatch)) {
  content = content.replace(targetStrMatch, replacementStr);
  fs.writeFileSync('src/components/PosSystem.tsx', content);
  console.log("SUCCESS");
} else {
  console.log("ERROR");
}

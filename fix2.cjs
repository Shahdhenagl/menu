const fs = require('fs');
let lines = fs.readFileSync('src/components/PosSystem.tsx', 'utf8').split(/\r?\n/);

const replacement = fs.readFileSync('replacement.txt', 'utf8').split(/\r?\n/);

// We replace line 3418 through 3421 (0-indexed 3417-3420)
// wait, line 3422 is exit={{ opacity: 0 }}
// So we insert right before line 3422 (index 3421).
// The original lines were:
// 3420: <span>{language === 'ar' ? 'قيمة الطلب:' : 'Order value:'}</span>
// 3421: <b style={{ color: '#fff' }}>{totalForOrder(collectPaymentOrder).toFixed(2)} EGP</b>
// 3422: exit={{ opacity: 0 }}

// Wait, let's just find the index of "exit={{ opacity: 0 }}" in the end of the file.
let exitIndex = -1;
for (let i = 3400; i < 3450; i++) {
  if (lines[i] && lines[i].includes('exit={{ opacity: 0 }}')) {
    exitIndex = i;
    break;
  }
}

if (exitIndex > 0) {
  // we want to delete from the start of the garbled part.
  // The garbled part starts right after `<b style={{ color: '#fff' }}>{totalForOrder(collectPaymentOrder).toFixed(2)} EGP</b>`
  // Actually, we can just replace lines 3417 to exitIndex-1 with the replacement chunk!
  // Wait, the replacement chunk INCLUDES `<b style={{ color: '#fff' }}>...` at the start?
  // Let's check replacement.txt content!
  let replLines = replacement;
  lines.splice(3421, 0, ...replLines.slice(2)); // Insert the rest of the missing code after 3421
  fs.writeFileSync('src/components/PosSystem.tsx', lines.join('\n'));
  console.log("SUCCESS");
} else {
  console.log("ERROR");
}

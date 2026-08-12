const fs = require('fs');
const newFile = fs.readFileSync('src/components/PosSystem.tsx', 'utf8');
const missingCode = fs.readFileSync('missing_code.txt', 'utf8');

const sStrNew = `                      <b style={{ color: '#fff' }}>{totalForOrder(collectPaymentOrder).toFixed(2)} EGP</b>\n              exit={{ opacity: 0 }}\n              style={{`;

const sStrNew2 = `                      <b style={{ color: '#fff' }}>{totalForOrder(collectPaymentOrder).toFixed(2)} EGP</b>\r\n              exit={{ opacity: 0 }}\r\n              style={{`;

let startIndexNew = newFile.indexOf(sStrNew);
let matchLength = sStrNew.length;
if (startIndexNew === -1) {
  startIndexNew = newFile.indexOf(sStrNew2);
  matchLength = sStrNew2.length;
}

if (startIndexNew !== -1) {
  const replacementString = `                      <b style={{ color: '#fff' }}>{totalForOrder(collectPaymentOrder).toFixed(2)} EGP</b>\n` + missingCode + `\n              exit={{ opacity: 0 }}\n              style={{`;
  
  const result = newFile.substring(0, startIndexNew) + replacementString + newFile.substring(startIndexNew + matchLength);
  fs.writeFileSync('src/components/PosSystem.tsx', result);
  console.log('Restored successfully');
} else {
  console.log('Failed to find markers in new file');
}

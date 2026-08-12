const fs = require('fs');
const oldFile = fs.readFileSync('PosSystem.proper.tsx', 'utf8');
const newFile = fs.readFileSync('src/components/PosSystem.tsx', 'utf8');

const sStrOld = 'totalForOrder(collectPaymentOrder).toFixed(2)} EGP</b>';
const eStrOld = '              exit={{ opacity: 0 }}\n              style={{';
const startIndexOld = oldFile.indexOf(sStrOld);
const endIndexOld = oldFile.indexOf(eStrOld);

const replacement = oldFile.substring(startIndexOld + sStrOld.length, endIndexOld);

const startIndexNew = newFile.indexOf(sStrOld);
const endIndexNew = newFile.indexOf(eStrOld);

if (startIndexNew !== -1 && endIndexNew !== -1) {
  const result = newFile.substring(0, startIndexNew + sStrOld.length) + replacement + newFile.substring(endIndexNew);
  fs.writeFileSync('src/components/PosSystem.tsx', result);
  console.log('Restored successfully');
} else {
  console.log('Failed to find markers in new file');
}

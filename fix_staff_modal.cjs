const fs = require('fs');
let content = fs.readFileSync('src/components/PosSystem.tsx', 'utf8');

const targetChunk = `                      <b style={{ color: '#fff' }}>{totalForOrder(collectPaymentOrder).toFixed(2)} EGP</b>
              exit={{ opacity: 0 }}`;

const replacementChunk = fs.readFileSync('replacement.txt', 'utf8');

if (content.includes(targetChunk)) {
  content = content.replace(targetChunk, replacementChunk);
  fs.writeFileSync('src/components/PosSystem.tsx', content);
  console.log("SUCCESS: Replaced chunk");
} else {
  console.log("ERROR: Could not find target chunk");
}

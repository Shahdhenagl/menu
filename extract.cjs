const fs = require('fs');
const lines = fs.readFileSync('PosSystem.proper.tsx', 'utf8').split(/\r?\n/);
const missingCode = lines.slice(3119, 3310).join('\n'); // 0-indexed, so 3119 is line 3120. slice is exclusive at end, so 3310 is up to line 3310 (index 3309).
fs.writeFileSync('missing_code.txt', missingCode);
console.log('Extracted lines 3120 to 3310');

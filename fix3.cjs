const fs = require('fs');
let lines = fs.readFileSync('src/components/PosSystem.tsx', 'utf8').split(/\r?\n/);
const replLines = fs.readFileSync('replacement.txt', 'utf8').split(/\r?\n/);

let exitIndex = -1;
for (let i = 3415; i < 3425; i++) {
  if (lines[i] && lines[i].includes('exit={{ opacity: 0 }}')) {
    exitIndex = i;
    break;
  }
}

if (exitIndex > 0) {
  // We want to insert replLines[1...] right before exitIndex.
  lines.splice(exitIndex, 0, ...replLines.slice(1));
  fs.writeFileSync('src/components/PosSystem.tsx', lines.join('\n'));
  console.log("SUCCESS");
} else {
  console.log("ERROR: Could not find exit index");
}

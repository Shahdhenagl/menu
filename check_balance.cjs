const fs = require('fs');
const lines = fs.readFileSync('src/components/PosSystem.tsx', 'utf8').split(/\r?\n/);

let tags = {
  div: 0,
  motionDiv: 0,
  AnimatePresence: 0,
  span: 0,
  button: 0,
};

for (let i = 1300; i < lines.length; i++) {
  const line = lines[i];
  if (!line) continue;
  
  if (line.match(/<div[^>]*>/)) tags.div++;
  if (line.match(/<\/div>/)) tags.div--;
  
  if (line.match(/<motion\.div[^>]*>/)) tags.motionDiv++;
  if (line.match(/<\/motion\.div>/)) tags.motionDiv--;

  if (line.match(/<AnimatePresence[^>]*>/)) tags.AnimatePresence++;
  if (line.match(/<\/AnimatePresence>/)) tags.AnimatePresence--;
  
  if (tags.div < 0 || tags.motionDiv < 0 || tags.AnimatePresence < 0) {
    console.log(`Line ${i + 1}: NEGATIVE BALANCE: div=${tags.div}, motion=${tags.motionDiv}, animate=${tags.AnimatePresence} | ${line.trim()}`);
  }
}
console.log(`FINAL BALANCE: div=${tags.div}, motion=${tags.motionDiv}, animate=${tags.AnimatePresence}`);

const fs = require('fs');
const files = ['src/components/PosSystem.tsx', 'src/components/FinancialsView.tsx'];
for(let file of files){
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/<<<<<<< Updated upstream[\s\S]*?=======\r?\n([\s\S]*?)>>>>>>> Stashed changes/g, '\');
  fs.writeFileSync(file, content);
  console.log('Fixed', file);
}

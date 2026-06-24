const fs = require('fs');
let content = fs.readFileSync('src/components/PosSystem.tsx', 'utf8');

const helpers = `
const getLocalDayStr = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return \`\${year}-\${month}-\${day}\`;
};
`;

content = content.replace(/(import .* from '.*';\n)+/, match => match + '\n' + helpers + '\n');
content = content.replace(/new Date\(\)\.toISOString\(\)\.split\('T'\)\[0\]/g, 'getLocalDayStr()');
content = content.replace(/([a-zA-Z0-9_]+)\.toISOString\(\)\.split\('T'\)\[0\]/g, 'getLocalDayStr($1)');

fs.writeFileSync('src/components/PosSystem.tsx', content);

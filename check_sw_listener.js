const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');
const lines = content.split('\n');

console.log('=== Service Worker lines 1410-1445 ===');
console.log(lines.slice(1410, 1445).join('\n'));

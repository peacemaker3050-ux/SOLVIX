const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');
const lines = content.split('\n');

console.log('=== Lines 990 - 1030 (initDB) ===');
console.log(lines.slice(990, 1030).join('\n'));

console.log('\n=== Lines 2190 - 2280 (members view) ===');
console.log(lines.slice(2190, 2280).join('\n'));

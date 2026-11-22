const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');
const lines = content.split('\n');

console.log('=== enterApp function (lines 1470-1560) ===');
console.log(lines.slice(1470, 1560).join('\n'));

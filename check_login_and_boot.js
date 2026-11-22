const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');
const lines = content.split('\n');

console.log('=== Login submission handling (lines 1320-1380) ===');
console.log(lines.slice(1320, 1380).join('\n'));

console.log('\n=== boot() function (lines 3950-4010) ===');
console.log(lines.slice(3950, 4010).join('\n'));

const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');
const lines = content.split('\n');

lines.forEach((l, i) => {
  if (l.includes('CONFIG =') || l.includes('CONFIG=') || l.includes('const CONFIG') || l.includes('let CONFIG') || l.includes('var CONFIG')) {
    console.log((i + 1) + ': ' + l);
  }
});

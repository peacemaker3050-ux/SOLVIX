const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');
const lines = content.split('\n');

lines.forEach((l, i) => {
  if (l.includes('data-mem') || l.includes('data-openchat')) {
    console.log((i + 1) + ': ' + l);
  }
});

const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');
const lines = content.split('\n');

lines.forEach((l, i) => {
  if (l.includes('dline(') || l.includes('function dline') || l.includes('const dline')) {
    console.log((i + 1) + ': ' + l);
  }
});

const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');
const lines = content.split('\n');

lines.forEach((l, i) => {
  if (l.includes('cacheMe') || l.includes('cachedMe') || l.includes('svx.me')) {
    console.log((i + 1) + ': ' + l);
  }
});

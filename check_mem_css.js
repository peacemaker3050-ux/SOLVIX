const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');

function searchCss(pattern) {
  const lines = content.split('\n');
  lines.forEach((l, i) => {
    if (pattern.test(l)) {
      console.log((i+1) + ': ' + l);
    }
  });
}

console.log('=== CSS for mem-card ===');
searchCss(/\.mem-/);

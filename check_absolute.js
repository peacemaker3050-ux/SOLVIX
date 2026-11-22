const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');

const regex = /([^{}]*\{[^}]*position:\s*absolute[^}]*\})/gi;
let m;
while ((m = regex.exec(content)) !== null) {
  console.log('--- absolute rule ---');
  console.log(m[0].replace(/\s+/g, ' ').slice(0, 150));
}

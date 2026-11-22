const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('index.html', 'utf8');
const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
let match, count = 0;
while ((match = scriptRegex.exec(html)) !== null) {
  const code = match[1];
  if (!code.trim() || match[0].includes('src=')) continue;
  count++;
  try {
    new vm.Script(code);
  } catch (e) {
    console.error('Syntax error in script tag ' + count, e);
    process.exit(1);
  }
}
console.log('Checked ' + count + ' scripts in index.html: all valid syntax.');

new vm.Script(fs.readFileSync('sw.js', 'utf8'));
console.log('sw.js: valid syntax.');

new vm.Script(fs.readFileSync('server/server.js', 'utf8'));
new vm.Script(fs.readFileSync('server/whatsapp.js', 'utf8'));
console.log('Server scripts: all valid syntax.');

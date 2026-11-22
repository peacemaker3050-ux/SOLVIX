const fs = require('fs');

console.log('--- 1. Testing index.html parsing ---');
try {
  const content = fs.readFileSync('index.html', 'utf8');
  // Extract scripts
  const scriptRegex = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  let count = 0;
  while ((match = scriptRegex.exec(content)) !== null) {
    count++;
    try {
      new Function(match[1]);
      console.log(`Script ${count} parsed successfully.`);
    } catch (e) {
      console.error(`Script ${count} failed to parse:`, e);
      process.exit(1);
    }
  }
} catch (err) {
  console.error('index.html error:', err);
  process.exit(1);
}

console.log('\n--- 2. Testing sw.js syntax ---');
try {
  const sw = fs.readFileSync('sw.js', 'utf8');
  new Function(sw);
  console.log('sw.js parsed successfully.');
} catch (e) {
  console.error('sw.js error:', e);
  process.exit(1);
}

console.log('\n--- 3. Testing server/server.js syntax ---');
try {
  const srv = fs.readFileSync('server/server.js', 'utf8');
  new Function(srv);
  console.log('server/server.js parsed successfully.');
} catch (e) {
  console.error('server/server.js error:', e);
  process.exit(1);
}

console.log('\nAll JS syntax valid!');

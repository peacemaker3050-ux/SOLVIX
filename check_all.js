const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');
const lines = content.split('\n');

console.log('=== 1. Where is firebaseDB called in boot()? ===');
lines.forEach((l, i) => {
  if (l.includes('firebaseDB(')) {
    console.log((i + 1) + ': ' + l);
  }
});

console.log('\n=== 2. How is member list rendered? ===');
lines.forEach((l, i) => {
  if (l.includes('id="members-list"') || l.includes('class="member-card"') || l.includes('id="member-list"') || l.includes('members-grid')) {
    console.log((i + 1) + ': ' + l.slice(0, 120));
  }
});

console.log('\n=== 3. Search for members view code ===');
lines.forEach((l, i) => {
  if (l.includes('members: {') || l.includes('members:{') || l.includes("V.members =") || l.includes("title: 'Members'")) {
    console.log((i + 1) + ': ' + l.slice(0, 120));
  }
});

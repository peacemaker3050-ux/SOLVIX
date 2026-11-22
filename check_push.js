const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');
const lines = content.split('\n');

lines.forEach((l, i) => {
  if (l.includes('initPushNotifications') || l.includes('firebase-messaging') || l.includes('messagingSenderId')) {
    console.log((i + 1) + ': ' + l);
  }
});

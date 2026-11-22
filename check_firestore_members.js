const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Check service account in server
const saPath = path.join(__dirname, '..', 'server', 'serviceAccountKey.json');
if (fs.existsSync(saPath)) {
  const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(sa)
    });
  }
  const db = admin.firestore();
  db.collection('members').get().then(snap => {
    console.log('Total members in Firestore:', snap.size);
    snap.forEach(doc => {
      const d = doc.data();
      console.log(`Member: ${doc.id} | Name: ${d.name} | Role: ${d.role} | hasPassHash: ${!!d.passHash} | uid: ${d.uid}`);
    });
    process.exit(0);
  }).catch(err => {
    console.error('Error fetching members:', err);
    process.exit(1);
  });
} else {
  console.log('No serviceAccountKey.json found at', saPath);
}

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

// تهيئة Firebase Admin SDK
// الطريقة 1: استخدام JSON كامل كمتغير بيئة FIREBASE_SERVICE_ACCOUNT_JSON
// الطريقة 2: استخدام المتغيرات الفردية: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
try {
  let credential;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    credential = admin.credential.cert(serviceAccount);
  } else if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    credential = admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID || 'solvix-95eb1',
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    });
  } else {
    console.warn('⚠️ لم يتم العثور على مفاتيح Firebase Service Account في متغيرات البيئة.');
    console.warn('يرجى إضافة FIREBASE_SERVICE_ACCOUNT_JSON أو FIREBASE_PRIVATE_KEY في إعدادات Railway.');
  }

  if (credential) {
    admin.initializeApp({
      credential,
      projectId: process.env.FIREBASE_PROJECT_ID || 'solvix-95eb1'
    });
    console.log('✅ تم تهيئة Firebase Admin SDK بنجاح.');
  }
} catch (err) {
  console.error('❌ خطأ في تهيئة Firebase Admin:', err.message);
}

// فحص صحة عمل السيرفر
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Solvix Kod Push Server',
    firebaseInitialized: admin.apps.length > 0,
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// إرسال إشعار لمجموعة من أجهزة المستخدمين
app.post('/send-push', async (req, res) => {
  try {
    const { tokens, title, body, data } = req.body;

    if (!tokens || !tokens.length) {
      return res.status(400).json({ error: 'tokens array is required' });
    }

    if (!admin.apps.length) {
      return res.status(503).json({ error: 'Firebase Admin not initialized on server. Check environment variables.' });
    }

    // تنظيف التوكنات وتكراراتها
    const uniqueTokens = [...new Set(tokens.filter(Boolean))];
    if (!uniqueTokens.length) {
      return res.status(400).json({ error: 'No valid tokens provided' });
    }

    // إعداد الحمولة (Payload)
    const stringData = {};
    if (data && typeof data === 'object') {
      for (const [k, v] of Object.entries(data)) {
        stringData[k] = String(v);
      }
    }
    stringData.title = title || 'SOLVIX KOD';
    stringData.body = body || '';

    const message = {
      notification: {
        title: title || 'SOLVIX KOD',
        body: body || ''
      },
      data: stringData,
      tokens: uniqueTokens,
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'solvix_general',
          priority: 'max'
        }
      },
      webpush: {
        headers: {
          Urgency: 'high'
        },
        notification: {
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          vibrate: [100, 50, 100],
          requireInteraction: true
        }
      }
    };

    // FCM Multicast بحد أقصى 500 توكن لكل دفعة
    const batchSize = 500;
    let totalSuccess = 0;
    let totalFailure = 0;
    const failedTokens = [];

    for (let i = 0; i < uniqueTokens.length; i += batchSize) {
      const slice = uniqueTokens.slice(i, i + batchSize);
      const batchMessage = { ...message, tokens: slice };
      const response = await admin.messaging().sendEachForMulticast(batchMessage);
      totalSuccess += response.successCount;
      totalFailure += response.failureCount;

      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            failedTokens.push({ token: slice[idx], error: resp.error?.message });
          }
        });
      }
    }

    console.log(`[Push Notification] Sent "${title}": ${totalSuccess} success, ${totalFailure} failed.`);

    return res.json({
      success: true,
      totalSuccess,
      totalFailure,
      failedTokens: failedTokens.slice(0, 10)
    });
  } catch (error) {
    console.error('Error sending push notification:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Solvix Push Server running on port ${PORT}`);
});

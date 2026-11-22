const path = require('path');
const fs = require('fs');

let makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers;
try {
  const baileys = require('@whiskeysockets/baileys');
  makeWASocket = baileys.default || baileys.makeWASocket;
  useMultiFileAuthState = baileys.useMultiFileAuthState;
  DisconnectReason = baileys.DisconnectReason;
  fetchLatestBaileysVersion = baileys.fetchLatestBaileysVersion;
  Browsers = baileys.Browsers;
} catch (e) {
  console.warn('⚠️ @whiskeysockets/baileys not yet installed or loaded:', e.message);
}

let qrcode;
try {
  qrcode = require('qrcode');
} catch (_) {}

let pino;
try {
  pino = require('pino');
} catch (_) {}

let sock = null;
let isConnected = false;
let pairingCode = null;
let pairingCodeGeneratedAt = 0;
let qrCodeDataUrl = null;
let botPhoneNumber = process.env.WHATSAPP_BOT_NUMBER || '01554677212';
let adminDb = null;
let isInitializing = false;

// تحويل رقم الهاتف إلى صيغة JID المعتمدة في واتساب
function formatWhatsAppJid(phone) {
  if (!phone) return null;
  let p = String(phone).replace(/\D/g, '');
  if (p.startsWith('01') && p.length === 11) {
    p = '2' + p; // مصر: 01554677212 -> 201554677212
  } else if (p.startsWith('1') && p.length === 10) {
    p = '20' + p;
  } else if (!p.startsWith('20') && p.length === 10) {
    p = '20' + p;
  }
  return p + '@s.whatsapp.net';
}

function cleanPhoneForPairing(phone) {
  let p = String(phone).replace(/\D/g, '');
  if (p.startsWith('01') && p.length === 11) {
    p = '2' + p;
  }
  return p;
}

// استرجاع وحفظ الجلسة في Firestore لضمان استمراريتها في Railway دون انقطاع
const AUTH_DIR = path.join(__dirname, 'auth_info_baileys');

async function restoreSessionFromFirestore(db) {
  try {
    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }
    const snap = await db.collection('system_config').doc('whatsapp_session').get();
    if (snap.exists) {
      const data = snap.data();
      if (data && data.credsJson) {
        let isRegistered = false;
        try {
          const parsed = JSON.parse(data.credsJson);
          if (parsed && (parsed.registered === true || parsed.me)) {
            isRegistered = true;
          }
        } catch (_) {}

        if (!isRegistered) {
          console.warn('🗑️ الجلسة المخزنة في Firestore غير مكتملة (لم يتم ربطها بعد). جاري حذفها فوراً لتجنب خطأ 401...');
          await db.collection('system_config').doc('whatsapp_session').delete().catch(() => {});
          return;
        }

        fs.writeFileSync(path.join(AUTH_DIR, 'creds.json'), data.credsJson, 'utf8');
        console.log('🔄 تم استرجاع جلسة واتساب المعتمدة من Firestore بنجاح.');
      }
    }
  } catch (err) {
    console.warn('تعذر استرجاع جلسة واتساب من Firestore:', err.message);
  }
}

async function backupSessionToFirestore(db) {
  try {
    // شرط قاطع: لا تحفظ إلا إذا كانت الجلسة مسجلة فعلياً بعد اكتمال الربط بنجاح!
    if (!sock?.authState?.creds?.registered && !isConnected) {
      return;
    }
    const credsPath = path.join(AUTH_DIR, 'creds.json');
    if (fs.existsSync(credsPath)) {
      const credsJson = fs.readFileSync(credsPath, 'utf8');
      try {
        const parsed = JSON.parse(credsJson);
        if (!parsed.registered) return;
      } catch (_) {
        return;
      }
      await db.collection('system_config').doc('whatsapp_session').set({
        credsJson,
        updatedAt: Date.now(),
        botNumber: botPhoneNumber
      }, { merge: true });
      console.log('💾 تم عمل نسخة احتياطية للجلسة المسجلة في Firestore.');
    }
  } catch (err) {
    console.warn('تعذر حفظ نسخة جلسة واتساب في Firestore:', err.message);
  }
}

async function initWhatsApp(db) {
  if (!makeWASocket || !useMultiFileAuthState) {
    console.warn('⚠️ Baileys library not available. WhatsApp bot skipped.');
    return;
  }

  if (isInitializing) return;
  isInitializing = true;
  adminDb = db || adminDb;

  try {
    if (adminDb) {
      await restoreSessionFromFirestore(adminDb);
    }

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const logger = pino ? pino({ level: 'silent' }) : undefined;

    let version;
    try {
      const v = await fetchLatestBaileysVersion();
      version = v.version;
    } catch (_) {
      version = [2, 3000, 1015901307];
    }

    const browserConfig = (Browsers && Browsers.ubuntu)
      ? Browsers.ubuntu('Chrome')
      : ['Ubuntu', 'Chrome', '20.0.04'];

    sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger,
      browser: browserConfig,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 30000
    });

    // طلب كود الربط مرة واحدة بهدوء إذا لم يكن الجهاز مسجلاً
    const isRegistered = !!(sock?.authState?.creds?.registered);
    if (!isRegistered && botPhoneNumber && !pairingCode) {
      setTimeout(async () => {
        try {
          if (sock && !sock.authState.creds.registered && !pairingCode) {
            const cleaned = cleanPhoneForPairing(botPhoneNumber);
            const code = await sock.requestPairingCode(cleaned);
            pairingCode = code ? code.match(/.{1,4}/g)?.join('-') || code : code;
            pairingCodeGeneratedAt = Date.now();
            console.log(`\n========================================`);
            console.log(`📲 كود ربط واتساب الجديد لهاتف (${botPhoneNumber}):`);
            console.log(`👉 ${pairingCode} 👈`);
            console.log(`(أدخل هذا الكود في واتساب > الأجهزة المرتبطة > ربط برقم الهاتف)`);
            console.log(`========================================\n`);
          }
        } catch (pairErr) {
          console.warn('Pairing code request error:', pairErr.message);
        }
      }, 5000);
    }

    sock.ev.on('creds.update', async () => {
      try {
        if (!fs.existsSync(AUTH_DIR)) {
          fs.mkdirSync(AUTH_DIR, { recursive: true });
        }
        await saveCreds();
        // فقط احفظ الجلسة في Firestore إذا كان الحساب مسجلاً بنجاح
        if (adminDb && sock?.authState?.creds?.registered) {
          await backupSessionToFirestore(adminDb);
        }
      } catch (saveErr) {
        console.warn('⚠️ تحذير حفظ بيانات الجلسة (غير حرج):', saveErr.message);
      }
    });

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr && qrcode) {
        try {
          qrCodeDataUrl = await qrcode.toDataURL(qr);
        } catch (_) {}
      }

      if (connection === 'close') {
        isConnected = false;
        isInitializing = false;
        qrCodeDataUrl = null;

        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const isAuthError = statusCode === 401 || statusCode === DisconnectReason.loggedOut;

        console.log(`⚠️ اتصال واتساب مغلق (كود: ${statusCode}). خطأ مصادقة: ${isAuthError}`);

        if (isAuthError) {
          console.warn('❌ كود 401: مفاتيح الجلسة غير صالحة أو تم رفضها من واتساب. تنظيف كامل للملفات لبدء اتصال نظيف...');
          pairingCode = null;
          pairingCodeGeneratedAt = 0;
          try {
            if (fs.existsSync(AUTH_DIR)) {
              fs.readdirSync(AUTH_DIR).forEach((file) => {
                try { fs.unlinkSync(path.join(AUTH_DIR, file)); } catch (_) {}
              });
            }
            if (adminDb) {
              await adminDb.collection('system_config').doc('whatsapp_session').delete().catch(() => {});
            }
          } catch (_) {}
          // إعادة تهيئة جلسة نظيفة بعد 3 ثوانٍ
          setTimeout(() => initWhatsApp(adminDb), 3000);
          return;
        }

        // انقطاع شبكة عادي
        console.log('🔄 جاري إعادة محاولة الاتصال بالشبكة خلال 5 ثوانٍ...');
        setTimeout(() => initWhatsApp(adminDb), 5000);
      } else if (connection === 'open') {
        isConnected = true;
        pairingCode = null;
        pairingCodeGeneratedAt = 0;
        qrCodeDataUrl = null;
        isInitializing = false;
        console.log(`✅ [Solvix WhatsApp Bot] متصل الآن بنجاح برقم: ${botPhoneNumber}`);
        if (adminDb) {
          await backupSessionToFirestore(adminDb);
        }

        // تحديث اسم البوت وحالته تلقائياً ليظهر بهوية وشعار المجتمع
        try {
          if (sock?.updateProfileName) {
            await sock.updateProfileName('SOLVIX KOD Community');
            console.log('✨ تم ضبط اسم حساب البوت: SOLVIX KOD Community');
          }
          if (sock?.updateProfileStatus) {
            await sock.updateProfileStatus('SOLVIX KOD | المجتمع الطلابي التقني والهندسي 🚀');
          }
        } catch (profErr) {
          console.log('ملاحظة تحديث بروفايل واتساب:', profErr.message);
        }
      }
    });

  } catch (err) {
    isInitializing = false;
    console.error('خطأ في تهيئة WhatsApp Bot:', err.message);
  }
}

// دالة إرسال رسالة واتساب لأي رقم
async function sendWhatsAppMessage(phone, text) {
  if (!sock || !isConnected) {
    throw new Error('بوت الواتساب غير متصل حالياً. يرجى ربط الهاتف أولاً عبر /whatsapp');
  }
  const jid = formatWhatsAppJid(phone);
  if (!jid) {
    throw new Error('رقم الهاتف غير صالح للإرسال: ' + phone);
  }

  const result = await sock.sendMessage(jid, { text });
  console.log(`[WhatsApp] Sent message to ${jid}`);
  return result;
}

// فحص وإرسال التذكيرات التلقائية (Acceptance Reminders & Task Deadlines)
async function runAutomatedWhatsAppReminders(dbInstance) {
  const db = dbInstance || adminDb;
  if (!db) return { error: 'Database not initialized' };
  if (!sock || !isConnected) {
    console.log('[Auto-Reminders] WhatsApp bot is not connected. Skipping check.');
    return { skipped: 'WhatsApp bot not connected' };
  }

  const results = { acceptanceReminders: 0, taskReminders: 0 };
  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;

  try {
    // 1) فحص الطلاب المقبولين الذين لم يدخلوا التطبيق منذ أكثر من 24 ساعة
    const requestsSnap = await db.collection('requests').where('status', '==', 'approved').get();
    for (const doc of requestsSnap.docs) {
      const req = doc.data();
      if (req.phone && !req.waReminderSent) {
        const decidedTime = req.decidedAt || req.createdAt || 0;
        if (now - decidedTime >= ONE_DAY) {
          // التأكد مما إذا كان الطالب أنشأ كلمة مرور في members
          let hasActivated = false;
          if (req.memberId) {
            const mSnap = await db.collection('members').doc(req.memberId).get();
            if (mSnap.exists && mSnap.data().passHash) {
              hasActivated = true;
            }
          }

          if (!hasActivated) {
            const firstName = (req.name || 'طالبنا العزيز').split(' ')[0];
            const msg = `🌐 SOLVIX KOD | إشعار رسمي
━━━━━━━━━━━━━━━━━━
مرحباً يا ${firstName} 🌟

يسرنا إعلامك وتذكيرك بأنه تم قبول طلب انضمامك إلى مجتمع SOLVIX KOD الهندسي!

📌 كود العضوية الخاص بك: ${req.memberId || 'SVX'}
🔗 رابط الدخول وتفعيل حسابك:
https://solvix-95eb1.web.app

نحن في انتظارك لتشاركنا الرحلة وتطوير مهاراتك الهندسية! 🚀
━━━━━━━━━━━━━━━━━━
🏛️ مجتمع SOLVIX KOD التقني والهندسي`;
            
            try {
              await sendWhatsAppMessage(req.phone, msg);
              await doc.ref.update({ waReminderSent: true, waReminderAt: now });
              results.acceptanceReminders++;
              // انتظار ثانيتين لتفادي الحظر
              await new Promise((r) => setTimeout(r, 2000));
            } catch (sendErr) {
              console.warn(`فشل إرسال تذكير واتساب لـ ${req.phone}:`, sendErr.message);
            }
          } else {
            // الطالب دخل وفعل حسابه بالفعل، نضع علامة حتى لا نعيد الفحص
            await doc.ref.update({ waReminderSent: true });
          }
        }
      }
    }

    // 2) فحص المهام التي اقترب موعد تسليمها (خلال 36 ساعة القادمة)
    const tasksSnap = await db.collection('tasks').get();
    const activeTasks = tasksSnap.docs.filter((d) => {
      const t = d.data();
      return !t.deleted && t.due;
    });

    if (activeTasks.length > 0) {
      // جلب قائمة الطلاب مرة واحدة للأداء العالي وتفادي الاستعلامات المكررة
      const membersSnap = await db.collection('members').where('role', '==', 'member').get();
      const eligibleMembers = membersSnap.docs.map((doc) => ({ doc, data: doc.data() })).filter((m) => !m.data.deleted && m.data.phone);

      for (const tDoc of activeTasks) {
        const task = tDoc.data();
        const timeLeft = task.due - now;
        // إذا كان متبقي على الموعد بين ساعتين و 36 ساعة
        if (timeLeft > 2 * 3600 * 1000 && timeLeft <= 36 * 3600 * 1000) {
          const reminderKey = `waDueReminded_${tDoc.id}`;

          // جلب تسليمات هذه المهمة مرة واحدة للتحقق السريع في الذاكرة
          const subSnap = await db.collection('submissions').where('taskId', '==', tDoc.id).get();
          const submittedIds = new Set(subSnap.docs.filter((d) => !d.data().deleted).map((d) => d.data().memberId));

          for (const { doc: mDoc, data: member } of eligibleMembers) {
            if (!member[reminderKey] && (member.level || 1) >= (task.minLevel || 1)) {
              // هل قام بالتسليم؟
              if (!submittedIds.has(mDoc.id)) {
                const firstName = (member.name || 'مهندسنا').split(' ')[0];
                const hoursLeft = Math.round(timeLeft / (3600 * 1000));
                const msg = `⏳ تذكير بمهمة هندسية | SOLVIX KOD
━━━━━━━━━━━━━━━━━━
عزيزي المهندس ${firstName}،
نود تذكيرك باقتراب الموعد النهائي لتسليم المهمة:
📝 "${task.title}"

⏰ الوقت المتبقي: حوالي ${hoursLeft} ساعة
🔗 يمكنك رفع وتسليم الحل عبر التطبيق:
https://solvix-95eb1.web.app

تمنياتنا لك بالتوفيق والتميز دائماً! 💡
━━━━━━━━━━━━━━━━━━
🏛️ مجتمع SOLVIX KOD التقني والهندسي`;

                try {
                  await sendWhatsAppMessage(member.phone, msg);
                  await mDoc.ref.update({ [reminderKey]: now });
                  results.taskReminders++;
                  await new Promise((r) => setTimeout(r, 2000));
                } catch (taskSendErr) {
                  console.warn(`فشل إرسال تذكير المهمة لـ ${member.phone}:`, taskSendErr.message);
                }
              }
            }
          }
        }
      }
    }

    console.log(`[Auto-Reminders] Completed: ${results.acceptanceReminders} acceptance, ${results.taskReminders} task reminders sent.`);
  } catch (err) {
    console.error('Error in runAutomatedWhatsAppReminders:', err);
  }

  return results;
}

function getWhatsAppStatus() {
  return {
    connected: isConnected,
    botNumber: botPhoneNumber,
    pairingCode: pairingCode,
    hasQr: !!qrCodeDataUrl,
    qrCodeDataUrl
  };
}

async function hardResetWhatsApp(db) {
  console.log('⚡ طلب إعادة ضبط شاملة وتوليد كود جديد لجلسة واتساب...');
  try {
    if (sock) {
      try { sock.end(); } catch (_) {}
      sock = null;
    }
  } catch (_) {}
  isConnected = false;
  pairingCode = null;
  pairingCodeGeneratedAt = 0;
  qrCodeDataUrl = null;
  isInitializing = false;

  // تنظيف مجلد الجلسة المحلي
  try {
    if (fs.existsSync(AUTH_DIR)) {
      fs.readdirSync(AUTH_DIR).forEach((file) => {
        try { fs.unlinkSync(path.join(AUTH_DIR, file)); } catch (_) {}
      });
    }
  } catch (_) {}

  // حذف الجلسة من Firestore
  const targetDb = db || adminDb;
  if (targetDb) {
    try {
      await targetDb.collection('system_config').doc('whatsapp_session').delete();
      console.log('🗑️ تم مسح جلسة واتساب السابقة من Firestore بنجاح.');
    } catch (_) {}
  }

  // إعادة البدء بعد ثانيتين بجلسة نظيفة تماماً
  setTimeout(() => initWhatsApp(targetDb), 2000);
}

module.exports = {
  initWhatsApp,
  restartWhatsApp: hardResetWhatsApp,
  hardResetWhatsApp,
  sendWhatsAppMessage,
  runAutomatedWhatsAppReminders,
  getWhatsAppStatus,
  formatWhatsAppJid
};

const path = require('path');
const fs = require('fs');

let makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion;
try {
  const baileys = require('@whiskeysockets/baileys');
  makeWASocket = baileys.default || baileys.makeWASocket;
  useMultiFileAuthState = baileys.useMultiFileAuthState;
  DisconnectReason = baileys.DisconnectReason;
  fetchLatestBaileysVersion = baileys.fetchLatestBaileysVersion;
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
        fs.writeFileSync(path.join(AUTH_DIR, 'creds.json'), data.credsJson, 'utf8');
        console.log('🔄 تم استرجاع جلسة واتساب من Firestore بنجاح.');
      }
    }
  } catch (err) {
    console.warn('تعذر استرجاع جلسة واتساب من Firestore:', err.message);
  }
}

async function backupSessionToFirestore(db) {
  try {
    const credsPath = path.join(AUTH_DIR, 'creds.json');
    if (fs.existsSync(credsPath)) {
      const credsJson = fs.readFileSync(credsPath, 'utf8');
      await db.collection('system_config').doc('whatsapp_session').set({
        credsJson,
        updatedAt: Date.now(),
        botNumber: botPhoneNumber
      }, { merge: true });
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

    sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger,
      browser: ['Ubuntu', 'Chrome', '20.0.04'],
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 30000
    });

    sock.ev.on('creds.update', async () => {
      try {
        if (!fs.existsSync(AUTH_DIR)) {
          fs.mkdirSync(AUTH_DIR, { recursive: true });
        }
        await saveCreds();
        if (adminDb) {
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

      // توليد Pairing Code إذا لم يكن مسجلاً بعد ورقم البوت متوفر
      const isRegistered = !!(sock?.authState?.creds?.registered);
      const isCodeFresh = pairingCode && (Date.now() - pairingCodeGeneratedAt < 180000);

      if (!isRegistered && botPhoneNumber && !isCodeFresh) {
        setTimeout(async () => {
          try {
            if (sock && !sock.authState.creds.registered) {
              const freshCheck = pairingCode && (Date.now() - pairingCodeGeneratedAt < 180000);
              if (freshCheck) return;

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
        }, 3000);
      }

      if (connection === 'close') {
        isConnected = false;
        isInitializing = false;
        
        // لا نحذف الكود إذا كان تم توليده خلال آخر 3 دقائق حتى يتمكن المستخدم من إدخاله بهدوء
        if (Date.now() - pairingCodeGeneratedAt > 180000) {
          pairingCode = null;
        }
        qrCodeDataUrl = null;

        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const loggedOut = isRegistered && statusCode === DisconnectReason.loggedOut;
        console.log(`⚠️ اتصال واتساب مغلق (كود: ${statusCode}, مسجل: ${isRegistered}). تسجيل خروج نهائي: ${loggedOut}`);

        if (!loggedOut) {
          console.log('🔄 جاري إعادة محاولة الاتصال وتجهيز الجلسة خلال 5 ثوانٍ...');
          setTimeout(() => initWhatsApp(adminDb), 5000);
        } else {
          console.warn('❌ تم تسجيل الخروج من الهاتف. تنظيف الجلسة لإتاحة ربط جديد...');
          pairingCode = null;
          pairingCodeGeneratedAt = 0;
          try {
            if (fs.existsSync(AUTH_DIR)) {
              fs.readdirSync(AUTH_DIR).forEach((file) => {
                try { fs.unlinkSync(path.join(AUTH_DIR, file)); } catch (_) {}
              });
            }
            if (adminDb) {
              adminDb.collection('system_config').doc('whatsapp_session').delete().catch(() => {});
            }
          } catch (_) {}
          setTimeout(() => initWhatsApp(adminDb), 4000);
        }
      } else if (connection === 'open') {
        isConnected = true;
        pairingCode = null;
        pairingCodeGeneratedAt = 0;
        qrCodeDataUrl = null;
        isInitializing = false;
        console.log(`✅ [Solvix WhatsApp Bot] متصل الآن بنجاح برقم: ${botPhoneNumber}`);
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
            const msg = `مرحباً يا ${firstName} 🌟\n\nنود تذكيرك بأنه تم قبول طلب انضمامك إلى مجتمع SOLVIX KOD الهندسي!\n\n📌 كود العضوية الخاص بك: ${req.memberId || 'SVX'}\n🌐 رابط الدخول وتفعيل حسابك:\nhttps://solvix-95eb1.web.app\n\nنحن في انتظارك لتشاركنا الرحلة! 🚀\n— فريق SOLVIX KOD`;
            
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
    for (const tDoc of tasksSnap.docs) {
      const task = tDoc.data();
      if (!task.deleted && task.due) {
        const timeLeft = task.due - now;
        // إذا كان متبقي على الموعد بين ساعتين و 36 ساعة
        if (timeLeft > 2 * 3600 * 1000 && timeLeft <= 36 * 3600 * 1000) {
          const reminderKey = `waDueReminded_${tDoc.id}`;
          
          // جلب الطلاب المؤهلين للمهمة
          const membersSnap = await db.collection('members').where('role', '==', 'member').get();
          for (const mDoc of membersSnap.docs) {
            const member = mDoc.data();
            if (!member.deleted && member.phone && !member[reminderKey]) {
              if ((member.level || 1) >= (task.minLevel || 1)) {
                // هل قام بالتسليم؟
                const subSnap = await db.collection('submissions')
                  .where('taskId', '==', tDoc.id)
                  .where('memberId', '==', mDoc.id)
                  .get();

                if (subSnap.empty) {
                  const firstName = (member.name || 'مهندسنا').split(' ')[0];
                  const hoursLeft = Math.round(timeLeft / (3600 * 1000));
                  const msg = `تذكير بمهمة هندسية ⏳\n\nعزيزي المهندس ${firstName}،\nتذكير باقتراب الموعد النهائي لتسليم مهمة:\n"${task.title}"\n\n⏰ المتبقي على التسليم: حوالي ${hoursLeft} ساعة\n🔗 يمكنك تسليم الحل عبر التطبيق:\nhttps://solvix-95eb1.web.app\n\nبالتوفيق والتميز دائماً! 💡\n— مجتمع SOLVIX KOD`;

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

function restartWhatsApp(db) {
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
  setTimeout(() => initWhatsApp(db || adminDb), 2000);
}

module.exports = {
  initWhatsApp,
  restartWhatsApp,
  sendWhatsAppMessage,
  runAutomatedWhatsAppReminders,
  getWhatsAppStatus,
  formatWhatsAppJid
};

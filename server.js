require('dotenv').config();
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const whatsapp = require('./whatsapp');

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
    // تهيئة بوت الواتساب
    whatsapp.initWhatsApp(admin.firestore());
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

// دالة موحدة فائقة السرعة للتواصل مع Google Gemini API مع نظام Fallback ومهلة زمنية
async function generateWithGemini({ apiKey, preferredModel, prompt, systemInstruction, generationConfig }) {
  // تنظيف اسم النموذج: استبدال أي نموذج غير موجود في API بالنموذج فائق السرعة gemini-1.5-flash
  let primaryModel = preferredModel || process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  if (primaryModel.includes('3.8') || primaryModel.includes('3.5')) {
    primaryModel = 'gemini-1.5-flash';
  }

  // ترتيب النماذج بدءاً من الأسرع والأكثر استقراراً في الاستجابة (أقل من ثانية واحدة)
  const modelsToTry = [
    primaryModel,
    'gemini-1.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-pro'
  ];
  const uniqueModels = [...new Set(modelsToTry.filter(Boolean))];

  let lastError = null;
  for (const model of uniqueModels) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // 8 ثوانٍ كحد أقصى للنموذج الواحد لمنع التعليق

    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const payload = {
        contents: Array.isArray(prompt) ? prompt : [{ parts: [{ text: prompt }] }],
        generationConfig
      };
      if (systemInstruction) {
        payload.systemInstruction = { parts: [{ text: systemInstruction }] };
      }

      const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`[Gemini API] Model ${model} returned status ${response.status}:`, errText.slice(0, 180));
        let errorMsg = response.statusText;
        try {
          const parsed = JSON.parse(errText);
          if (parsed.error && parsed.error.message) errorMsg = parsed.error.message;
        } catch (_) { }
        lastError = new Error(`(${model}) ${errorMsg}`);
        continue;
      }

      const data = await response.json();
      const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!candidateText) {
        lastError = new Error(`Model ${model} returned empty text candidate`);
        continue;
      }
      return { text: candidateText, modelUsed: model };
    } catch (e) {
      clearTimeout(timeout);
      if (e.name === 'AbortError') {
        console.warn(`[Gemini API] Model ${model} timed out after 8s. Trying fallback model...`);
        lastError = new Error(`(${model}) Connection timed out`);
      } else {
        lastError = e;
      }
    }
  }
  throw lastError || new Error('All Gemini model endpoints failed');
}

// توليد كويز ومهمة بالذكاء الاصطناعي من محتوى السيشن أو السلايدات
app.post('/api/ai-generate-task', async (req, res) => {
  try {
    const { sessionText, topic, numQuestions = 5, level = 2, lang = 'en' } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(503).json({
        error: 'GEMINI_API_KEY is not configured on the server. Please add GEMINI_API_KEY in your Railway environment variables.'
      });
    }

    if (!sessionText && !topic) {
      return res.status(400).json({ error: 'Either sessionText or topic is required' });
    }

    const languageName = lang === 'ar' ? 'Arabic' : 'English';
    const prompt = `You are an expert university engineering professor and technical curriculum examiner for the engineering community SOLVIX KOD.
Create a comprehensive, high-quality technical assessment task based on the following session material or topic:

---
${sessionText ? sessionText.slice(0, 15000) : ''}
${topic ? `\nTopic / Instructions: ${topic}` : ''}
---

Requirements:
- Target student level: ${level} (Level 1=Initiate/Freshman, 2=Explorer, 3=Builder, 4=Engineer, 5=Mentor, 6=Core Lead).
- Number of questions: ${numQuestions}.
- Language: ${languageName} (all titles, questions, and options MUST be in ${languageName}).
- Create a balanced mix of Multiple Choice (MCQ) and Short Answer questions testing practical comprehension, analytical thinking, and engineering concepts from the material.
- For MCQ questions: provide exactly 4 clear distinct options in "opts", and indicate the zero-based index (0, 1, 2, or 3) of the correct option in "correct".
- For Short Answer questions: provide expected correct keywords separated by "|" in "ans" (for example: "KCL|Kirchhoff Current Law").

Return ONLY a valid JSON object with this exact structure, with NO surrounding markdown or backticks:
{
  "title": "Concise engineering task title (under 70 chars)",
  "desc": "Brief 2-3 sentence overview of what this task evaluates and instructions for the student",
  "timeLimit": 25,
  "minLevel": ${level},
  "questions": [
    {
      "kind": "mcq",
      "text": "Question text here?",
      "pts": 10,
      "opts": ["Option A", "Option B", "Option C", "Option D"],
      "correct": 0,
      "ans": ""
    },
    {
      "kind": "short",
      "text": "Short answer question here?",
      "pts": 10,
      "opts": ["", "", "", ""],
      "correct": 0,
      "ans": "keyword1|keyword2"
    }
  ]
}`;

    const { text: candidateText, modelUsed } = await generateWithGemini({
      apiKey,
      preferredModel: process.env.GEMINI_MODEL,
      prompt,
      generationConfig: {
        temperature: 0.3,
        responseMimeType: "application/json"
      }
    });

    let parsedResult;
    try {
      const cleaned = candidateText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      parsedResult = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('Failed parsing Gemini JSON:', candidateText);
      return res.status(500).json({ error: 'AI output could not be parsed as JSON' });
    }

    console.log(`[AI Generator] Successfully generated task: "${parsedResult.title}" with ${parsedResult.questions?.length || 0} questions via ${modelUsed}.`);
    return res.json({ success: true, task: parsedResult, modelUsed });
  } catch (error) {
    console.error('Error in /api/ai-generate-task:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// تصحيح إجابات الطلاب المقالية والكتابية بالذكاء الاصطناعي
app.post('/api/ai-grade', async (req, res) => {
  try {
    const { taskTitle, questions, answers, files, maxScore, lang = 'en' } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(503).json({
        error: 'GEMINI_API_KEY is not configured on the server. Please add GEMINI_API_KEY in your Railway environment variables.'
      });
    }

    const languageName = lang === 'ar' ? 'Arabic' : 'English';

    const prompt = `You are an expert university engineering professor grading a student's technical submission for SOLVIX KOD.
Task: "${taskTitle || 'Engineering Assessment'}"
Total Max Points: ${maxScore || 100}

Here are the questions and the student's submitted answers:
${JSON.stringify({ questions, answers, files }, null, 2)}

Instructions:
1. Evaluate each question fairly and objectively based on engineering correctness, problem-solving method, and clarity.
2. For multiple choice or short answer with keys, check correctness.
3. For essay, code, or explanation questions, evaluate depth of understanding, correctness of logic, and assign appropriate partial or full marks.
4. Total score must not exceed ${maxScore || 100}.
5. Write constructive, encouraging, and specific feedback for the student in ${languageName}.

Return ONLY a valid JSON object with this exact structure, with NO surrounding markdown or backticks:
{
  "score": 85,
  "feedback": "Constructive feedback text here in ${languageName}",
  "marks": {
    "q1": 10
  }
}`;

    const { text: candidateText, modelUsed } = await generateWithGemini({
      apiKey,
      preferredModel: process.env.GEMINI_MODEL,
      prompt,
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json"
      }
    });

    const cleaned = candidateText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsedResult = JSON.parse(cleaned);

    console.log(`[AI Auto-Grading] Evaluated submission for "${taskTitle}": Score ${parsedResult.score}/${maxScore} via ${modelUsed}`);
    return res.json({ success: true, modelUsed, ...parsedResult });
  } catch (error) {
    console.error('Error in /api/ai-grade:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// المساعد الذكي للطلاب (Solvix AI Assistant Chatbot)
app.post('/api/ai-chat', async (req, res) => {
  try {
    const { message, history = [], studentInfo = {} } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(503).json({
        error: 'GEMINI_API_KEY is not configured on the server. Please add GEMINI_API_KEY in your Railway environment variables.'
      });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const studentContext = `The student's name is ${studentInfo.name || 'Student'}, department: ${studentInfo.dept || 'Engineering'}, level: ${studentInfo.level || 1}.`;

    const systemInstruction = `You are Solvix AI, the intelligent, friendly, and expert engineering mentor for SOLVIX KOD — an elite engineering and coding community for university students.
${studentContext}
Your responsibilities:
- Answer engineering, programming, mathematics, physics, and technical questions clearly, concisely, and accurately.
- Provide clean code snippets (in C, C++, Python, JavaScript, Verilog, etc.) with brief explanations when asked.
- Help students debug compiler errors, understand circuits, control theory, data structures, and algorithms.
- Always be encouraging, respectful, and pedagogically sound.
- Detect the language of the student's message: if they write in Arabic, respond in clear fluent Arabic; if they write in English, respond in English.
- Keep responses concise and formatted with clean Markdown.`;

    // Map history to Gemini contents format
    const contents = [];
    if (Array.isArray(history)) {
      history.slice(-8).forEach((h) => {
        if (h.sender === 'user' || h.role === 'user') {
          contents.push({ role: 'user', parts: [{ text: h.text || h.content || '' }] });
        } else if (h.sender === 'ai' || h.role === 'model') {
          contents.push({ role: 'model', parts: [{ text: h.text || h.content || '' }] });
        }
      });
    }
    contents.push({ role: 'user', parts: [{ text: message }] });

    const { text: reply, modelUsed } = await generateWithGemini({
      apiKey,
      preferredModel: process.env.GEMINI_MODEL,
      prompt: contents,
      systemInstruction,
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: 1000
      }
    });

    return res.json({ success: true, reply, modelUsed });
  } catch (error) {
    console.error('Error in /api/ai-chat:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// حماية وإغلاق واجهة ربط واتساب بعد اكتمال الربط بنجاح
const WHATSAPP_ACCESS_KEY = process.env.WHATSAPP_ADMIN_KEY || 'svx_admin_278601';

// صفحة ويب لمتابعة حالة وربط واتساب (مغلقة ومحمية)
app.get('/whatsapp', (req, res) => {
  // إغلاق وقفل الرابط - لا يمكن الدخول إلا للأدمن بالمفتاح السري
  if (req.query.key !== WHATSAPP_ACCESS_KEY) {
    return res.status(403).send(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>الوصول محمي ومغلق | SOLVIX KOD</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #060d22; color: #fff; margin: 0; padding: 24px 16px; display: flex; align-items: center; justify-content: center; min-height: 90vh; text-align: center; }
    .card { background: #0d1b3d; border: 1px solid #1f3568; border-radius: 16px; padding: 36px 24px; max-width: 440px; width: 100%; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    h1 { font-size: 20px; color: #4ade80; margin: 0 0 12px; }
    p { color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 16px; }
    .badge { display: inline-block; background: #14532d; color: #86efac; border: 1px solid #22c55e; padding: 6px 16px; border-radius: 20px; font-weight: 700; font-size: 13px; }
    .icon { font-size: 44px; margin-bottom: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🔒</div>
    <h1>تم قفل وتأمين الرابط بنجاح</h1>
    <div style="margin: 16px 0;"><span class="badge">● البوت متصل ومحمي بالسيرفر</span></div>
    <p>تم إغلاق هذه الصفحة وتأمين جلسة واتساب لمنع أي وصول غير مصرح به. بوت مجتمع SOLVIX KOD يعمل الآن تلقائياً في الخلفية.</p>
  </div>
</body>
</html>`);
  }

  const status = whatsapp.getWhatsAppStatus();
  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ربط بوت واتساب | SOLVIX KOD</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #060d22; color: #fff; margin: 0; padding: 24px 16px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 90vh; text-align: center; }
    .card { background: #0d1b3d; border: 1px solid #1f3568; border-radius: 16px; padding: 28px 24px; max-width: 480px; width: 100%; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    h1 { font-size: 20px; margin: 0 0 12px; color: #22d0ff; }
    .badge { display: inline-block; padding: 6px 14px; border-radius: 20px; font-weight: 700; font-size: 13px; margin-bottom: 20px; transition: all 0.3s; }
    .badge.ok { background: #1b4d2e; color: #4ade80; border: 1px solid #22c55e; }
    .badge.wait { background: #4a3b10; color: #fde047; border: 1px solid #eab308; }
    .code-container { margin: 18px 0; }
    .code-box { background: #030712; border: 2px dashed #22d0ff; border-radius: 12px; padding: 16px; font-size: 32px; font-weight: 800; letter-spacing: 4px; color: #38bdf8; font-family: monospace; display: inline-block; min-width: 220px; user-select: all; }
    .instructions { text-align: start; font-size: 13.5px; line-height: 1.8; color: #cfe2ff; background: rgba(0,0,0,0.25); border-radius: 10px; padding: 14px 18px; margin: 18px 0; }
    .instructions ol { margin: 0; padding-inline-start: 20px; }
    .btn { display: inline-block; background: linear-gradient(135deg, #22d0ff, #0a84d6); color: #020611; font-weight: 700; padding: 10px 22px; border-radius: 10px; text-decoration: none; border: none; cursor: pointer; font-size: 14px; margin-top: 10px; transition: all 0.2s; }
    .btn:hover { opacity: 0.9; transform: translateY(-1px); }
    .btn-copy { background: #1e3a8a; color: #60a5fa; border: 1px solid #3b82f6; font-size: 13px; padding: 8px 16px; border-radius: 8px; margin-top: 8px; cursor: pointer; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; }
    .qr-img { margin-top: 14px; border-radius: 12px; border: 4px solid #fff; max-width: 200px; }
    .note { font-size: 12px; color: #94a3b8; margin-top: 10px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>🤖 بوت واتساب التلقائي | SOLVIX KOD</h1>
    <p style="color:#9fb4d6;font-size:13px;margin:0 0 14px">الرقم المستهدف: <b>${status.botNumber}</b></p>
    
    <div>
      <span id="statusBadge" class="badge ${status.connected ? 'ok' : 'wait'}">
        ${status.connected ? '● البوت متصل وجاهز للعمل بنجاح' : '⏳ بانتظار الربط مع الهاتف'}
      </span>
    </div>

    <div id="contentArea">
      ${status.connected ? `
        <div style="background:rgba(34,197,94,0.15);border:1px solid #22c55e;border-radius:12px;padding:20px;margin:20px 0;">
          <h2 style="color:#4ade80;font-size:18px;margin:0 0 8px">✅ تم ربط هاتف البوت بنجاح!</h2>
          <p style="color:#d1fae5;font-size:14px;margin:0">البوت متصل ويعمل في الخلفية، ويتم إرسال تذكيرات القبول والمهام تلقائياً للطلاب.</p>
        </div>
      ` : ''}

      ${!status.connected && status.pairingCode ? `
        <div class="instructions">
          <b>طريقة الربط بالهاتف (الكود ثابت ولا يتغير أثناء الكتابة):</b>
          <ol>
            <li>افتح تطبيق WhatsApp على هاتف <b>${status.botNumber}</b>.</li>
            <li>اضغط على <b>الإعدادات ⬅️ الأجهزة المرتبطة ⬅️ ربط جهاز</b>.</li>
            <li>اختر <b>"ربط باستخدام رقم الهاتف بدلاً من ذلك"</b>.</li>
            <li>أدخل الكود التالي:</li>
          </ol>
        </div>
        <div class="code-container">
          <div class="code-box" id="pairingCodeText">${status.pairingCode}</div>
          <br>
          <button id="copyBtn" class="btn-copy" onclick="copyCode()">📋 نسخ الكود</button>
        </div>
        <p class="note">💡 لا تقلق، الصفحة ثابتة تماماً ولن يتم إعادة تحميلها تلقائياً أثناء كتابة الكود.</p>
      ` : ''}

      ${!status.connected && !status.pairingCode && status.qrCodeDataUrl ? `
        <p style="font-size:13px;color:#cfe2ff">أو امسح رمز الـ QR من داخل تطبيق واتساب:</p>
        <img src="${status.qrCodeDataUrl}" class="qr-img" alt="WhatsApp QR">
      ` : ''}

      ${!status.connected && !status.pairingCode && !status.qrCodeDataUrl ? `
        <p style="font-size:13px;color:#9fb4d6">جاري إعداد جلسة الاتصال وتوليد كود الربط... انتظر ثوانٍ معدودة.</p>
      ` : ''}
    </div>

    <br>
    <a href="/whatsapp?key=${WHATSAPP_ACCESS_KEY}" class="btn">🔄 تحديث يدوي</a>
    <a href="/whatsapp/reset?key=${WHATSAPP_ACCESS_KEY}" class="btn" style="background:#243656;color:#cfe2ff;margin-inline-start:8px">⚡ طلب كود جديد</a>
  </div>

  <script>
    let isConnected = ${status.connected ? 'true' : 'false'};

    async function checkStatus() {
      try {
        const res = await fetch('/api/whatsapp/status?key=' + encodeURIComponent('${WHATSAPP_ACCESS_KEY}'));
        const data = await res.json();
        if (!data || !data.status) return;
        const s = data.status;

        if (s.connected && !isConnected) {
          isConnected = true;
          const badge = document.getElementById('statusBadge');
          if (badge) {
            badge.className = 'badge ok';
            badge.innerText = '● البوت متصل وجاهز للعمل بنجاح! 🎉';
          }
          const content = document.getElementById('contentArea');
          if (content) {
            content.innerHTML = \`
              <div style="background:rgba(34,197,94,0.15);border:1px solid #22c55e;border-radius:12px;padding:20px;margin:20px 0;">
                <h2 style="color:#4ade80;font-size:18px;margin:0 0 8px">✅ تم ربط هاتف البوت بنجاح!</h2>
                <p style="color:#d1fae5;font-size:14px;margin:0">البوت متصل ويعمل في الخلفية، ويتم إرسال تذكيرات القبول والمهام تلقائياً للطلاب.</p>
              </div>
            \`;
          }
          return;
        }

        if (!s.connected && s.pairingCode) {
          const codeEl = document.getElementById('pairingCodeText');
          if (codeEl && codeEl.innerText !== s.pairingCode) {
            codeEl.innerText = s.pairingCode;
          } else if (!codeEl) {
            window.location.reload();
          }
        }
      } catch (_) {}
    }

    setInterval(checkStatus, 3500);

    function copyCode() {
      const el = document.getElementById('pairingCodeText');
      if (!el) return;
      const txt = el.innerText.trim();
      if (!txt) return;
      navigator.clipboard.writeText(txt).then(() => {
        const btn = document.getElementById('copyBtn');
        if (btn) {
          btn.innerText = '✅ تم النسخ!';
          btn.style.background = '#10b981';
          btn.style.color = '#fff';
          setTimeout(() => {
            btn.innerText = '📋 نسخ الكود';
            btn.style.background = '#1e3a8a';
            btn.style.color = '#60a5fa';
          }, 2000);
        }
      }).catch(() => {
        alert('الكود هو: ' + txt);
      });
    }
  </script>
</body>
</html>`;
  res.send(html);
});

// إعادة تهيئة الاتصال وتوليد كود ربط جديد مع مسح أي جلسة سابقة (محمي بالمفتاح السري)
app.get('/whatsapp/reset', async (req, res) => {
  if (req.query.key !== WHATSAPP_ACCESS_KEY) {
    return res.status(403).json({ error: 'Access Denied: Admin key required to reset WhatsApp.' });
  }
  await whatsapp.hardResetWhatsApp(admin.apps.length ? admin.firestore() : null);
  res.redirect(`/whatsapp?key=${WHATSAPP_ACCESS_KEY}`);
});

// استعلام JSON عن حالة واتساب (محمي أو يعيد حالة عامة فقط)
app.get('/api/whatsapp/status', (req, res) => {
  const isAuthorized = req.query.key === WHATSAPP_ACCESS_KEY;
  const status = whatsapp.getWhatsAppStatus();
  res.json({
    success: true,
    status: {
      connected: status.connected,
      botNumber: status.botNumber,
      // لا تعرض كود الربط أو QR إلا للأدمن المصرح له
      pairingCode: isAuthorized ? status.pairingCode : null,
      hasQr: isAuthorized ? status.hasQr : false,
      qrCodeDataUrl: isAuthorized ? status.qrCodeDataUrl : null
    }
  });
});

// إرسال رسالة واتساب لأي رقم من الأدمن
app.post('/api/whatsapp/send', async (req, res) => {
  try {
    const { phone, message } = req.body;
    if (!phone || !message) {
      return res.status(400).json({ error: 'phone and message are required' });
    }
    const result = await whatsapp.sendWhatsAppMessage(phone, message);
    return res.json({ success: true, result });
  } catch (err) {
    console.error('Error sending WhatsApp message:', err);
    return res.status(500).json({ error: err.message || 'Failed to send WhatsApp message' });
  }
});

// تشغيل فحص التذكيرات فورياً يدوياً
app.post('/api/whatsapp/trigger-reminders', async (req, res) => {
  try {
    if (!admin.apps.length) {
      return res.status(503).json({ error: 'Firebase not initialized' });
    }
    const results = await whatsapp.runAutomatedWhatsAppReminders(admin.firestore());
    return res.json({ success: true, results });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// تشغيل الفحص التلقائي للتذكيرات كل 4 ساعات
setInterval(() => {
  try {
    if (admin.apps.length) {
      whatsapp.runAutomatedWhatsAppReminders(admin.firestore()).catch((e) => console.warn('[Auto-Reminders] Cron error:', e.message));
    }
  } catch (_) { }
}, 4 * 60 * 60 * 1000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Solvix Push Server running on port ${PORT}`);
});

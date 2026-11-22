const fs = require('fs');
let c = fs.readFileSync('PROJECT_STATE.md', 'utf8');
const oldMarker = '### ⏳ المهام الحالية والمستقبلية (Backlog & Next Steps):';
const addition = `22. **تثبيت المساعد الذكي مباشرة على النموذج الفائز gemini-3.1-flash-lite-preview (Zero Latency Direct Pinning)**:
   - **الملاحظة الدقيقة للمستخدم**:
     - نجح نموذج \`gemini-3.1-flash-lite-preview\` مرتين متتاليتين في الرد الكامل وبجودة عالية، بينما كانت النماذج السابقة تضيع الوقت بين أخطاء 400 (بسبب عدم توافق thinkingConfig) و 429 (تجاوز كوتا) و 404 (نماذج متوقفة).
   - **القرار والتحسين الفوري**:
     1. تثبيت الاستدعاء الأول مباشرة على النموذج الفائز \`gemini-3.1-flash-lite-preview\` في أول القائمة دون أي نماذج قبله.
     2. قائمة بدائل نقية وموثوقة حصرياً: (\`gemini-3.1-flash-lite-preview\`, \`gemini-3.1-flash-lite\`, \`gemini-3.5-flash-lite\`, \`gemini-3.5-flash\`, \`gemini-3.8-flash\`).
     3. إزالة إرسال \`thinkingConfig\` الذي كان يسبب خطأ 400 مع نماذج Lite.
     4. تقليص مهلة الاستجابة إلى 16 ثانية في السيرفر و 20 ثانية في المتصفح.
     5. ترقية كاش الـ Service Worker إلى \`solvix-v28\`.

---

### ⏳ المهام الحالية والمستقبلية (Backlog & Next Steps):`;

if (c.includes(oldMarker)) {
  c = c.replace(oldMarker, addition);
  fs.writeFileSync('PROJECT_STATE.md', c, 'utf8');
  console.log('Successfully updated PROJECT_STATE.md');
} else {
  console.log('Marker not found');
}

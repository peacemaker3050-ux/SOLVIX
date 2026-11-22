const fs = require('fs');
let c = fs.readFileSync('PROJECT_STATE.md', 'utf8');
const oldMarker = '### ⏳ المهام الحالية والمستقبلية (Backlog & Next Steps):';
const addition = `21. **اعتماد نموذج gemini-flash-lite-latest فائق السرعة وتصفية النماذج الصوتية (Ultra-Fast Flash-Lite Adoption & Text-Only Filtering)**:
   - **النجاح المشهود في السجلات**:
     - نجح نموذج \`gemini-flash-lite-latest\` فوراً في توليد الرد وتوصيله للمستخدم (\`Successfully generated response using gemini-flash-lite-latest (2271 chars)\`) وبسرعة فائقة.
     - كشفت السجلات أن بعض النماذج التلقائية كانت نماذج صوتية (\`AUDIO\` فقط مثل \`gemini-2.5-flash-preview-tts\`) مما كان يسبب خطأ 400.
   - **التحسينات المطبقة**:
     1. استبعاد كافة النماذج غير النصية (الصوت، الصور، الروبوتات مثل \`-tts\`, \`-image\`, \`-clip\`, \`-transcribe\`).
     2. تقديم نماذج \`gemini-flash-lite-latest\` و \`gemini-flash-latest\` في صدارة قائمة الاستدعاء لأنها لا تعاني من طوابير التفكير الطويلة ولا من طفرات 503، مما يضمن الرد في ثوانٍ معدودة.
     3. تقليل مهلة المحاولة الواحدة إلى 18 ثانية لمنع تعليق المستخدم، مع الاحتفاظ بمهلة المتصفح 30 ثانية.
     4. ترقية كاش الـ Service Worker إلى \`solvix-v27\`.

---

### ⏳ المهام الحالية والمستقبلية (Backlog & Next Steps):`;

if (c.includes(oldMarker)) {
  c = c.replace(oldMarker, addition);
  fs.writeFileSync('PROJECT_STATE.md', c, 'utf8');
  console.log('Successfully updated PROJECT_STATE.md');
} else {
  console.log('Marker not found');
}

const fs = require('fs');
let c = fs.readFileSync('PROJECT_STATE.md', 'utf8');
const oldMarker = '### ⏳ المهام الحالية والمستقبلية (Backlog & Next Steps):';
const addition = `20. **حل مشكلة البطء وطفرات الضغط 503 والاكتشاف الديناميكي لنماذج Gemini (Dynamic Model Discovery & 503 Auto-Retry)**:
   - **التحليل الدقيق للسجلات**:
     - محاولة 1: استغرق \`gemini-3.8-flash\` أكثر من 25 ثانية بسبب قيامه بالتفكير الرياضي الافتراضي (\`Reasoning/Thinking\`) قبل الرد.
     - محاولة 2: واجه \`gemini-3.8-flash\` طفرة ضغط لحظية (\`503 UNAVAILABLE - High demand\`). النماذج البديلة المتوقفة أرجعت 404 لأن جوجل توقفها تدريجياً.
   - **الحلول المطبقة**:
     1. **إلغاء بطء التفكير الداخلي**: إدراج \`thinkingConfig: { thinkingBudget: 0 }\` في إعدادات التوليد لتعطيل التفكير الداخلي البطيء والحصول على الردود فورياً في ثانية إلى ثانيتين فقط.
     2. **معالجة ذكية لطفرات 503 و 429 (Auto-Retry)**: عند استلام 503 ("This model is currently experiencing high demand")، ينتظر السيرفر 1.5 ثانية ويعيد المحاولة تلقائياً قبل التحويل، مما يمتص طفرات الضغط المؤقتة بسلاسة.
     3. **الكشف التلقائي والديناميكي عن النماذج (\`getAvailableGeminiModels\`)**: استعلام مباشر لواجهة Google عن قائمة النماذج المفعلة فعلياً للحساب وتحديث مصفوفة الاستدعاء حياً لمنع تجربة أي نماذج متوقفة مستقبلاً.
     4. **إضافة نقطة فحص \`/api/debug-models\`**: تتيح استعراض كافة الموديلات المتاحة لمفتاح الـ API مباشرة من المتصفح.
     5. **تمديد المهلة الزمنية**: رفع مهلة السيرفر إلى 40 ثانية والمتصفح إلى 45 ثانية لتفادي انقطاع الاتصال تحت الضغط العالي.
     6. **تحديث الكاش**: ترقية كاش الـ Service Worker إلى \`solvix-v26\`.

---

### ⏳ المهام الحالية والمستقبلية (Backlog & Next Steps):`;

if (c.includes(oldMarker)) {
  c = c.replace(oldMarker, addition);
  fs.writeFileSync('PROJECT_STATE.md', c, 'utf8');
  console.log('Successfully updated PROJECT_STATE.md');
} else {
  console.log('Marker not found');
}

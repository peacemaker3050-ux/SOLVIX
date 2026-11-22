const fs = require('fs');
let c = fs.readFileSync('PROJECT_STATE.md', 'utf8');
const oldMarker = '### ⏳ المهام الحالية والمستقبلية (Backlog & Next Steps):';
const addition = `18. **ترقية نماذج Gemini API إلى gemini-3.8-flash وحل مشكلة بطء وتوقف المساعد الذكي (Gemini 3.8-flash Upgrade & Latency Fix)**:
   - **السبب الجذري لخطأ 404 وتوقف الذكاء الاصطناعي**:
     - قامت جوجل بإيقاف وإلغاء النماذج القديمة (\`gemini-1.5-flash\`، \`gemini-2.0-flash\`، \`gemini-1.5-pro\`) وإرجاع خطأ 404 صريح مع توجيه بالترقية: *"This model models/gemini-2.0-flash is no longer available. Please update your code to use models/gemini-3.8-flash"*.
     - كان الكود السابق يستبدل أي إشارة لـ 3.8 بـ 1.5 ظناً منه أنها غير موجودة، مما تسبب في إرسال طلبات لنماذج متوقفة بالكامل.
   - **سبب البطء السابق وتوقف الطلبات**:
     - كانت مهلة السيرفر محددة بـ 8 ثوانٍ فقط (\`8000ms\`)، وعندما كان النموذج يستغرق 8.5 ثانية في التفكير وتوليد كود هندسي كان السيرفر يقطع الاتصال (\`AbortError\`).
   - **الحلول المطبقة**:
     1. اعتماد النموذج الرسمي الأحدث لدى جوجل \`gemini-3.8-flash\` كنموذج افتراضي أساسي، مع مصفوفة Fallback حديثة تضم (\`gemini-3.8-flash\`, \`gemini-2.5-flash\`, \`gemini-3.8-flash-lite\`, \`gemini-flash\`).
     2. إلغاء أي تحويل تلقائي للنماذج القديمة واستبدال الموديلات المنتهية تلقائياً بـ \`gemini-3.8-flash\`.
     3. زيادة مهلة السيرفر إلى 25 ثانية ومهلة المتصفح إلى 35 ثانية لضمان اكتمال الردود البرمجية والهندسية المعقدة دون انقطاع.
     4. تحسين تعليمات النظام (\`systemInstruction\`) وتقليل \`maxOutputTokens\` إلى 800 للرد المباشر السريع وتفادي الاستطراد الزائد لتقليل زمن الاستجابة إلى أقصى حد.
     5. ترقية كاش الـ Service Worker إلى \`solvix-v24\`.

---

### ⏳ المهام الحالية والمستقبلية (Backlog & Next Steps):`;

if (c.includes(oldMarker)) {
  c = c.replace(oldMarker, addition);
  fs.writeFileSync('PROJECT_STATE.md', c, 'utf8');
  console.log('Successfully updated PROJECT_STATE.md');
} else {
  console.log('Marker not found');
}

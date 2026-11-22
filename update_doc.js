const fs = require('fs');
let c = fs.readFileSync('PROJECT_STATE.md', 'utf8');
const oldMarker = '### ⏳ المهام الحالية والمستقبلية (Backlog & Next Steps):';
const addition = `19. **حل الخلل الجذري في محادثات Gemini المتعددة (Multiturn Alternating Turns Fix & Diagnostics)**:
   - **السبب الجذري الحاسم**:
     - تفرض Google Gemini API قاعدة صارمة في المحادثات: الأدوار يجب أن تتبادل بالتعاقب الدقيق: \`user\` ثم \`model\` ثم \`user\`، وتبدأ دائماً بـ \`user\`، ويُحظر تماماً إرسال رسالتين متتاليتين من نفس الدور (\`user\` -> \`user\`).
     - في الكود السابق، كان العميل يضيف رسالة المستخدم الجديدة إلى \`history\` ثم يرسل \`message\` و \`history\` معاً إلى السيرفر، فكان السيرفر يضيف \`message\` مرة ثانية في نهاية المصفوفة، مما أدى لوجود رسالتي \`user\` متتاليتين في كل طلب، فتفرضه Google بخطأ 400.
     - وإذا فشل أي طلب، كان السجل في المتصفح يحتفظ برسائل المستخدم دون إجابة، فيتراكم (\`user\` -> \`user\` -> \`user\`)، مما عطل المساعد الذكي نهائياً لدى كل من جرب إرسال رسالة.
   - **الحلول المطبقة**:
     1. خوارزمية تطهير متقدمة (\`contents sanitization\`) في السيرفر لضمان: البداية بـ \`user\`، التبادل الصارم (\`user\` -> \`model\`)، دمج أي رسائل متتالية من نفس الطرف، والنهاية بـ \`user\`.
     2. تعديل \`index.html\` ليرسل السجل السابق فقط دون تكرار الرسالة الحالية.
     3. إضافة سجلات تشخيصية تفصيلية كاملة (\`[AI Chat]\` و \`[Gemini API]\`) لتتبع كل طلب وعدد الأحرف ووقت الاستجابة بالمللي ثانية في سجلات Railway.
     4. ترقية كاش الـ Service Worker إلى \`solvix-v25\`.

---

### ⏳ المهام الحالية والمستقبلية (Backlog & Next Steps):`;

if (c.includes(oldMarker)) {
  c = c.replace(oldMarker, addition);
  fs.writeFileSync('PROJECT_STATE.md', c, 'utf8');
  console.log('Successfully updated PROJECT_STATE.md');
} else {
  console.log('Marker not found');
}

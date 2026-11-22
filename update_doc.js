const fs = require('fs');
let c = fs.readFileSync('PROJECT_STATE.md', 'utf8');
const oldMarker = '### ⏳ المهام الحالية والمستقبلية (Backlog & Next Steps):';
const addition = `17. **إصلاح شريط كتابة الرسائل في المحادثات المباشرة (Chat Composer Sizing Fix)**:
   - **المشكلة**: امتداد زر الإرسال \`Send\` عبر عرض الشاشة بالكامل (95%) وانضغاط خانة كتابة الرسائل إلى مربع أسود صغير في أقصى اليسار.
   - **السبب الجذري**: كلاس \`.btn\` العام يمتلك خاصية \`width: 100%\`، وعند وضع الزر داخل \`.chat-composer\` (وهو Flexbox) بدون \`width: auto\` و \`flex: 0 0 auto\`، احتل الزر العرض الكامل ودفع حقل الإدخال \`input\` للانكماش إلى الصفر.
   - **الحل المطبق**:
     1. تعديل خصائص \`.chat-composer input\` لتشغل كامل المساحة المتبقية بمرونة (\`flex: 1 1 auto; min-width: 0; width: auto\`).
     2. تثبيت حجم زر الإرسال \`.chat-send-btn\` على قياس مدمج وثابت (\`flex: 0 0 auto !important; width: auto !important; min-width: 96px\`).
     3. إضافة تنسيق متجاوب خاص بالهواتف (\`@media (max-width: 480px)\`) لتوفير مساحة كتابة واسعة على جميع الشاشات.
     4. ترقية كاش الـ Service Worker إلى \`solvix-v23\`.

---

### ⏳ المهام الحالية والمستقبلية (Backlog & Next Steps):`;

if (c.includes(oldMarker)) {
  c = c.replace(oldMarker, addition);
  fs.writeFileSync('PROJECT_STATE.md', c, 'utf8');
  console.log('Successfully updated PROJECT_STATE.md');
} else {
  console.log('Marker not found');
}

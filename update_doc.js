const fs = require('fs');
let c = fs.readFileSync('PROJECT_STATE.md', 'utf8');
const oldMarker = '### ⏳ المهام الحالية والمستقبلية (Backlog & Next Steps):';
const addition = `16. **إلغاء تام لأي نصوص عربية في النسخة الإنجليزية الافتراضية وضبط تناسق الكروت (100% Zero-Arabic Default Mode & UI Harmonization)**:
   - **المطلب الحاسم**: ضمان أن النسخة الافتراضية للتطبيق باللغة الإنجليزية لا تحتوي على أي كلمة عربية إطلاقاً (أقسام، فرق، مستويات، توستات، وإشعارات).
   - **التعديلات المنجزة**:
     1. **ترجمة البيانات الأكاديمية المخزنة بالعربية**: تم إدماج دالة \`nm()\` و \`dline()\` في كل من كروت الأعضاء (\`V.members.paint\`)، وقائمة طلبات الانضمام (\`V.requests.paint\`)، وهيدر المحادثات المباشرة (\`V.messages\`)، والملف الشخصي، ليتم تحويل الأقسام والفرق تلقائياً إلى الإنجليزية عند \`LANG === 'en'\`.
     2. **أسماء المستويات**: استبدال نصوص \`LEVELS[l].ar\` بمصفوفة إنجليزية رسمية \`LV_EN\` عند اختيار الإنجليزية (مثل: Core, Explorer, Architect...).
     3. **الإشعارات ورسائل النظام**: ضبط نصوص الإشعارات اللحظية وإشعارات المهام والتسليمات ورسالة شاشة الخطأ القاتل (\`showFatal\`) لتكون بالإنجليزية تلقائياً عند \`LANG === 'en'\`.
     4. **تحديث الكاش**: ترقية كاش الـ Service Worker إلى \`solvix-v22\`.

---

### ⏳ المهام الحالية والمستقبلية (Backlog & Next Steps):`;

if (c.includes(oldMarker)) {
  c = c.replace(oldMarker, addition);
  fs.writeFileSync('PROJECT_STATE.md', c, 'utf8');
  console.log('Successfully updated PROJECT_STATE.md');
} else {
  console.log('Marker not found');
}

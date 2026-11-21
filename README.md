# خادم إشعارات SOLVIX KOD (Railway Push Server)

خادم خفيف وسريع مبني بـ Node.js و Express و Firebase Admin SDK لإرسال إشعارات الهاتف الفعلية (**Push Notifications**) إلى أجهزة الطلاب والمشرفين حتى ولو كان التطبيق مغلقاً.

---

## 🚀 طريقة النشر على Railway في دقيقتين:

### الخطوة 1: استخراج مفتاح الحساب الخدمي (Firebase Service Account Key)
1. افتح [Firebase Console](https://console.firebase.google.com/project/solvix-95eb1/settings/serviceaccounts/adminsdk).
2. اختر مشروعك **solvix-95eb1**.
3. توجه إلى **Project Settings** (أيقونة الترس ⚙️) ثم علامة التبويب **Service accounts**.
4. اضغط على الزر الأزرق: **Generate new private key** ثم **Generate key**.
5. سيتم تحميل ملف JSON إلى جهازك (مثلاً `solvix-95eb1-firebase-adminsdk-xxxx.json`).

---

### الخطوة 2: النشر على Railway
1. ادخل على موقع [Railway.app](https://railway.app) وسجّل الدخول بحسابك (GitHub مثلاً).
2. اضغط على **+ New Project** ثم اختر **Deploy from GitHub repo** (أو رفع مجلد `server/`).
3. بعد إنشاء الخدمة، افتحها وتوجه إلى تبويب **Variables** (متغيرات البيئة).
4. أضف المتغير التالي:
   - **الاسم (Variable Name)**: `FIREBASE_SERVICE_ACCOUNT_JSON`
   - **القيمة (Value)**: افتح ملف الـ JSON الذي حمّلته من Firebase، انسخ محتواه بالكامل وضعه هنا.
5. توجّه إلى تبويب **Settings** في Railway، وانزل إلى قسم **Networking** واضغط على **Generate Domain**.
6. ستحصل على رابط السيرفر العام، مثل:
   ```
   https://solvix-push-production.up.railway.app
   ```

---

### الخطوة 3: تفعيل الرابط في التطبيق (`index.html`)
افتح ملف `index.html` وضع الرابط الذي حصلت عليه في السطر المخصص له داخل `window.SOLVIX_CONFIG`:

```javascript
window.SOLVIX_CONFIG = {
  // ...
  pushServerUrl: "https://solvix-push-production.up.railway.app",
  // ...
};
```

---

## 🔔 حالات الإشعار المبرمجة تلقائياً:

| الحدث | المستلم | نص الإشعار |
| :--- | :--- | :--- |
| **تقديم طلب انضمام جديد** | الأدمن | إشعار فوري على شريط الهاتف ببيانات الطالب ورقمه |
| **قبول طلب الانضمام** | الطالب | إشعار بترحيب وقبول طلبه وظهور كود الـ ID الخاص به |
| **نشر مهمة جديدة (تاسك)** | الطلاب المؤهلين | إشعار لكل الطلاب المؤهلين لمستوى المهمة |
| **تسليم مهمة من طالب** | الأدمن | إشعار بوصول حل المهمة للمراجعة |
| **تصحيح المهمة** | الطالب | إشعار بدرجة المهمة وتصحيحها فوراً |
| **ترقية المستوى أو وسام** | الطالب | إشعار بالترقية إلى المستوى الجديد |
| **إذاعة إعلان عام** | جميع الأعضاء | إشعار بنص الإعلان العام |

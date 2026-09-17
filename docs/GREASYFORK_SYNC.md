# ربط GitHub مع GreasyFork

الهدف: يكون GitHub هو المصدر الرئيسي للكود والوصف التفصيلي، بينما يبقى GreasyFork واجهة التثبيت والتحديث للمستخدمين.

## القاعدة الأساسية

لكل سكربت مصدران متزامنان من فرع `main`:

1. **Code Sync URL** → ملف `.user.js` بصيغة Raw.
2. **Additional Info Sync URL** → ملف `README.md` بصيغة Raw، ويُعرض في GreasyFork كـ **Markdown**.

لا نربط GreasyFork بفرع `dev` ولا بCommit ثابت.

## الصيغ القياسية

### الكود

```text
https://raw.githubusercontent.com/M0HM3D85/teacher-userscripts/main/scripts/<script-id>/<script-id>.user.js
```

### Additional info

```text
https://raw.githubusercontent.com/M0HM3D85/teacher-userscripts/main/scripts/<script-id>/README.md
```

## السكربتات المنشورة حاليًا

| السكربت | GreasyFork | Code Sync | Additional Info |
|---|---:|---|---|
| Fares+ | 593928 | `https://raw.githubusercontent.com/M0HM3D85/teacher-userscripts/main/scripts/fares-plus/fares-plus.user.js` | `https://raw.githubusercontent.com/M0HM3D85/teacher-userscripts/main/scripts/fares-plus/README.md` |
| Forms Smart Results Analyzer | 593393 | `https://raw.githubusercontent.com/M0HM3D85/teacher-userscripts/main/scripts/forms-smart-results-analyzer/forms-smart-results-analyzer.user.js` | `https://raw.githubusercontent.com/M0HM3D85/teacher-userscripts/main/scripts/forms-smart-results-analyzer/README.md` |
| Madrasati Smart Attendance | 595613 | `https://raw.githubusercontent.com/M0HM3D85/teacher-userscripts/main/scripts/madrasati-smart-attendance/madrasati-smart-attendance.user.js` | `https://raw.githubusercontent.com/M0HM3D85/teacher-userscripts/main/scripts/madrasati-smart-attendance/README.md` |
| Microsoft Forms Question Bank | 592704 | `https://raw.githubusercontent.com/M0HM3D85/teacher-userscripts/main/scripts/microsoft-forms-question-bank/microsoft-forms-question-bank.user.js` | `https://raw.githubusercontent.com/M0HM3D85/teacher-userscripts/main/scripts/microsoft-forms-question-bank/README.md` |
| Microsoft Forms Attachment Reviewer | 595568 | `https://raw.githubusercontent.com/M0HM3D85/teacher-userscripts/main/scripts/microsoft-forms-attachment-reviewer/microsoft-forms-attachment-reviewer.user.js` | `https://raw.githubusercontent.com/M0HM3D85/teacher-userscripts/main/scripts/microsoft-forms-attachment-reviewer/README.md` |
| Student Rased | 592894 | `https://raw.githubusercontent.com/M0HM3D85/teacher-userscripts/main/scripts/student-rased-madrasati-noor/student-rased-madrasati-noor.user.js` | `https://raw.githubusercontent.com/M0HM3D85/teacher-userscripts/main/scripts/student-rased-madrasati-noor/README.md` |
| Madrasati Schedule Designer | 592421 | `https://raw.githubusercontent.com/M0HM3D85/teacher-userscripts/main/scripts/madrasati-schedule-designer/madrasati-schedule-designer.user.js` | `https://raw.githubusercontent.com/M0HM3D85/teacher-userscripts/main/scripts/madrasati-schedule-designer/README.md` |
| ZipGrade Smart Student Manager | 593089 | `https://raw.githubusercontent.com/M0HM3D85/teacher-userscripts/main/scripts/zipgrade-smart-student-manager/zipgrade-smart-student-manager.user.js` | `https://raw.githubusercontent.com/M0HM3D85/teacher-userscripts/main/scripts/zipgrade-smart-student-manager/README.md` |

## استيراد السكربتات المتبقية مباشرة من GitHub

GreasyFork يدعم استيراد عدة ملفات Raw دفعة واحدة. ضع الروابط التالية في صفحة **Import**، كل رابط في سطر مستقل، ثم اختر **Automatic** للمزامنة:

```text
https://raw.githubusercontent.com/M0HM3D85/teacher-userscripts/main/scripts/m85-noor-grades-assistant/m85-noor-grades-assistant.user.js
https://raw.githubusercontent.com/M0HM3D85/teacher-userscripts/main/scripts/m85-yahoo-finance-stock-assistant/m85-yahoo-finance-stock-assistant.user.js
https://raw.githubusercontent.com/M0HM3D85/teacher-userscripts/main/scripts/madrasati-assignment-intelligence/madrasati-assignment-intelligence.user.js
https://raw.githubusercontent.com/M0HM3D85/teacher-userscripts/main/scripts/microsoft-forms-smart-enhancer/microsoft-forms-smart-enhancer.user.js
https://raw.githubusercontent.com/M0HM3D85/teacher-userscripts/main/scripts/whatsapp-communication-manager/whatsapp-communication-manager.user.js
```

بعد إنشاء الصفحات، سجّل أرقام GreasyFork الجديدة في `scripts/catalog.json` ثم فعّل Additional Info من الروابط التالية بصيغة **Markdown**:

```text
https://raw.githubusercontent.com/M0HM3D85/teacher-userscripts/main/scripts/m85-noor-grades-assistant/README.md
https://raw.githubusercontent.com/M0HM3D85/teacher-userscripts/main/scripts/m85-yahoo-finance-stock-assistant/README.md
https://raw.githubusercontent.com/M0HM3D85/teacher-userscripts/main/scripts/madrasati-assignment-intelligence/README.md
https://raw.githubusercontent.com/M0HM3D85/teacher-userscripts/main/scripts/microsoft-forms-smart-enhancer/README.md
https://raw.githubusercontent.com/M0HM3D85/teacher-userscripts/main/scripts/whatsapp-communication-manager/README.md
```

## إعداد Additional info للسكربتات الموجودة

من صفحة **Admin** لكل سكربت:

1. فعّل مزامنة Additional info من URL خارجي.
2. الصق رابط Raw لملف `README.md` الخاص بالسكربت.
3. اختر **Markdown** كنوع المحتوى.
4. اختر **Automatic** للمزامنة.
5. احفظ، ثم تحقق من أن الوصف التفصيلي ظهر بصورة صحيحة في صفحة السكربت.

## Webhook

بعد ضبط السكربت للمزامنة من GitHub يمكن إعداد Webhook من إعدادات المستودع لتسريع وصول التحديثات إلى GreasyFork. المزامنة التلقائية الحالية كافية للعمل، والـWebhook تحسين اختياري للسرعة.

## قواعد مهمة

- `main` فقط هو مصدر GreasyFork.
- `dev` هو فرع التطوير ولا يُربط مباشرة بـGreasyFork.
- لا تغيّر الكود أو Additional info يدويًا في GreasyFork بعد اكتمال الربط؛ عدّلهما في GitHub أولًا.
- كل تغيير وظيفي في ملف منشور يجب أن يصاحبه رفع مناسب لـ `@version`.
- تعديل README فقط لا يتطلب رفع إصدار السكربت.
- لا تستخدم Loader يخفي الوظيفة الأساسية خارج GreasyFork؛ الملف المتزامن نفسه هو السكربت الكامل.
- لا تربط GreasyFork بCommit مؤقت.

## مسار النشر المعتمد

```text
dev
↓
Validation + Review
↓
Pull Request
↓
main
├── .user.js  → GreasyFork Code Sync
└── README.md → GreasyFork Additional Info Sync
↓
Tampermonkey
```

## التحقق بعد النشر

1. افتح صفحة GreasyFork وتأكد أن رقم الإصدار الصحيح ظاهر.
2. تأكد أن Additional info يطابق README في `main`.
3. افتح Tampermonkey وافحص التحديثات عند وجود إصدار جديد.
4. تأكد من أن المستخدم ينتقل للإصدار الجديد دون إعادة تثبيت السكربت.
5. اختبر الصفحة المستهدفة مرة أخيرة بعد أي تحديث وظيفي.

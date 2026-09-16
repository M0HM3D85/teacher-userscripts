# تدقيق استيراد السكربتات الرسمية

تاريخ التدقيق: 2026-09-17

تم اعتماد 13 ملفًا سلّمها المطور كمرجع رسمي للترحيل إلى مستودع `teacher-userscripts`.

## قواعد التوحيد

يتم الحفاظ على وظائف السكربت ورقم الإصدار الحالي أثناء الترحيل، وتوحيد بيانات الهوية فقط عند الحاجة:

- `@namespace https://greasyfork.org/users/1636459`
- `@author Mohammed Almalki (M0HM3D85)`
- `@homepageURL https://greasyfork.org/en/users/1636459-m0hm3d85`
- `@supportURL https://github.com/M0HM3D85/teacher-userscripts/issues`
- `@copyright 2026, Mohammed Almalki (M0HM3D85)`
- `@license All Rights Reserved`
- كتلة حقوق موحدة تحتوي GreasyFork وX وSnapchat.

GitHub مخصص للمصدر والدعم وإدارة الإصدارات؛ لا يلزم إبرازه في واجهة المستخدم داخل كل سكربت.

## نتيجة التدقيق

| السكربت | الإصدار المستلم | الحقوق في الملف المستلم | GreasyFork |
|---|---:|---|---|
| Fares+ | 1.1.0 | موجودة | 593928 |
| Forms Smart Results Analyzer | 0.3.0 | موجودة | 593393 |
| M85 Noor Grades Assistant | 2.4 | **غير موجودة — تُضاف عند الترحيل** | غير محدد |
| M85 Yahoo Finance Stock Assistant | 16.1 | **غير موجودة — تُضاف عند الترحيل** | غير محدد |
| Madrasati Assignment Intelligence | 1.1.7 | موجودة في كتلة الحقوق، والهيدر يحتاج استكمال copyright/license | غير محدد |
| Madrasati Smart Attendance | 0.2.1 | موجودة | 595613 |
| Microsoft Forms - بنك الأسئلة والإدخال الجماعي | 0.7.0 | موجودة | 592704 |
| Microsoft Forms - عارض المرفقات والتصحيح السريع | 1.3.3 | موجودة، وتُوحّد روابط كتلة الحقوق | 595568 |
| Microsoft Forms Smart Enhancer | 1.0.5 | موجودة | غير محدد |
| WhatsApp Communication Manager | 0.5.0 | موجودة | غير محدد |
| راصد الطلاب | 1.9.1 | موجودة | 592894 |
| مصمم الجدول الدراسي الاحترافي | 1.4.1 | حقوق جزئية — تُوحّد الهوية والهيدر | 592421 |
| ZipGrade Smart Student Manager | 0.7.0 | موجودة | 593089 |

## الإصدارات القديمة

`M85 Noor Grades Assistant 2.4` و`M85 Yahoo Finance Stock Assistant 16.1` يستخدمان صيغة إصدار من جزأين. يسمح بها الفحص أثناء الترحيل فقط عبر `legacyVersionFormat`. أول إصدار جديد لكل منهما يجب أن يستخدم صيغة كاملة، وفق طبيعة التغيير.

## قاعدة النشر

توحيد الحقوق أثناء الترحيل لا يعتبر ميزة جديدة ولا يبرر وحده إعلان تحديث للمستخدم. أول تحديث وظيفي لاحق يجب أن يحدث معًا:

1. رقم الإصدار.
2. `CHANGELOG.md`.
3. وصف/مزايا GreasyFork إذا تغير نطاق المنتج.
4. قسم «ما الجديد» بلغة مفهومة للمستخدم.
5. الصور أو التعليمات إذا تغيرت الواجهة أو طريقة الاستخدام.

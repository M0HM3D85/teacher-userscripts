# 🎓 سكربتات تفيد المعلم | Teacher Userscripts

مستودع موحّد لتطوير وإدارة ونشر سكربتات Tampermonkey التي يطوّرها **Mohammed Almalki (M0HM3D85)**.

## الهدف

- جعل GitHub المصدر الرئيسي للكود بعد اكتمال ترحيل كل سكربت.
- الاحتفاظ بتاريخ كامل لكل تعديل وإصدار.
- فصل التطوير على `dev` عن النسخ المستقرة على `main`.
- مزامنة الإصدارات المستقرة مع GreasyFork دون كسر روابط التثبيت الحالية.
- توحيد الحقوق والروابط والإصدارات والتوثيق والفحص الآلي.
- تحديث معلومات GreasyFork و«ما الجديد» مع كل إصدار فعلي.

## السكربتات المسجلة

| السكربت | الإصدار | الحالة |
|---|---:|---|
| Fares+ \| فارس+ | `1.1.0` | مستقر |
| Forms Smart Results Analyzer \| محلل نتائج فورمز الذكي | `0.3.0` | مستقر |
| M85 Noor Grades Assistant | `2.4` | مستقر — Legacy version |
| M85 Yahoo Finance Stock Assistant | `16.1` | مستقر — Legacy version |
| Madrasati Assignment Intelligence \| مدير الواجبات الذكي | `1.1.7` | مستقر |
| Madrasati Smart Attendance \| التحضير الذكي لمدرستي | `0.2.1` | مستقر |
| Microsoft Forms - بنك الأسئلة والإدخال الجماعي | `0.7.0` | مستقر |
| Microsoft Forms - عارض المرفقات والتصحيح السريع | `1.3.3` | مستقر |
| Microsoft Forms Smart Enhancer | `1.0.5` | مستقر |
| WhatsApp Communication Manager | `0.5.0` | مستقر |
| راصد الطلاب \| مدرستي + نور | `1.9.1` | مستقر |
| مدرستي - مصمم الجدول الدراسي الاحترافي | `1.4.1` | مستقر |
| ZipGrade Smart Student Manager | `0.7.0` | مستقر |

التفاصيل والمسارات وروابط GreasyFork محفوظة في [`scripts/catalog.json`](./scripts/catalog.json).

## الهوية والحقوق الموحدة

المصدر الرسمي لبيانات المطور هو [`config/author.json`](./config/author.json). أي سكربت يدخل المشروع يجب أن يحمل:

- `@namespace https://greasyfork.org/users/1636459`
- `@author Mohammed Almalki (M0HM3D85)`
- `@homepageURL https://greasyfork.org/en/users/1636459-m0hm3d85`
- `@supportURL https://github.com/M0HM3D85/teacher-userscripts/issues`
- `@copyright 2026, Mohammed Almalki (M0HM3D85)`
- `@license All Rights Reserved`

وتبقى روابط GreasyFork وX وSnapchat ضمن كتلة الحقوق في المصدر. GitHub يستخدم للدعم والمصدر وإدارة الإصدارات، وليس مطلوبًا إبرازه داخل واجهة المستخدم لكل سكربت.

## بنية المستودع

```text
teacher-userscripts/
├── config/                  # هوية المطور والحقوق الموحدة
├── scripts/                 # السكربتات المستقلة
├── shared/                  # وحدات مشتركة مستقبلًا
├── tools/                   # أدوات الفحص والاستيراد
├── docs/                    # التوثيق وسياسات النشر
└── .github/workflows/       # فحوصات GitHub Actions
```

## سياسة الإصدارات

الإصدارات الجديدة تتبع Semantic Versioning:

- `PATCH` — إصلاح خطأ: `1.4.1 → 1.4.2`
- `MINOR` — ميزة متوافقة جديدة: `1.4.2 → 1.5.0`
- `MAJOR` — تغيير كبير أو غير متوافق: `1.5.0 → 2.0.0`

الإصداران `2.4` و`16.1` محفوظان بصيغتهما الأصلية أثناء الترحيل، وأول تحديث جديد لهما ينتقل إلى صيغة إصدار كاملة.

## دورة العمل

```text
تطوير وتجربة
    ↓
فرع dev / feature
    ↓
تحديث VERSION + CHANGELOG + معلومات الإصدار
    ↓
فحص الحقوق والروابط وSyntax
    ↓
Pull Request إلى main
    ↓
نسخة مستقرة
    ↓
تحديث GreasyFork + ما الجديد
    ↓
تحديث Tampermonkey للمستخدمين
```

> **قاعدة:** لا ننشر إصدارًا جديدًا برقم فقط. يجب أن يعرف المستخدم ما الذي أُضيف أو أُصلح أو تغيّر في النسخة الجديدة.

## الحقوق

© 2026 Mohammed Almalki (M0HM3D85) — جميع الحقوق محفوظة.

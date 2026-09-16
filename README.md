# 🎓 سكربتات تفيد المعلم | Teacher Userscripts

مستودع موحّد لتطوير وإدارة ونشر سكربتات Tampermonkey التعليمية التي يطوّرها **Mohammed Almalki (M0HM3D85)**.

## الهدف

- جعل GitHub هو **المصدر الرئيسي الوحيد (Source of Truth)** للكود.
- الاحتفاظ بتاريخ كامل لكل تعديل وإصدار.
- فصل التطوير عن النسخ المستقرة المنشورة للمعلمين.
- تجهيز السكربتات للمزامنة مع GreasyFork دون كسر روابط التثبيت الحالية.
- توحيد أسلوب الإصدارات والتوثيق والفحص الآلي.

## السكربتات

| السكربت | المسار | الحالة |
|---|---|---|
| محلل نتائج فورمز الذكي | `scripts/forms-smart-results-analyzer/` | مستقر |
| مصمم الجدول الدراسي الاحترافي | `scripts/madrasati-schedule-designer/` | مستقر |
| راصد الطلاب — مدرستي + نور | `scripts/student-rased-madrasati-noor/` | قيد الإدخال |

## بنية المستودع

```text
teacher-userscripts/
├── scripts/                 # السكربتات المستقلة
├── shared/                  # وحدات مشتركة مستقبلًا
├── tools/                   # أدوات الفحص والإدارة
├── docs/                    # توثيق وصور المشروع
└── .github/workflows/       # فحوصات GitHub Actions
```

## سياسة الإصدارات

نستخدم [Semantic Versioning](https://semver.org/):

- `PATCH` — إصلاح خطأ: `1.4.0 → 1.4.1`
- `MINOR` — ميزة متوافقة جديدة: `1.4.1 → 1.5.0`
- `MAJOR` — تغيير كبير أو غير متوافق: `1.5.0 → 2.0.0`

## دورة العمل

```text
تطوير وتجربة
    ↓
فرع dev / feature
    ↓
فحص آلي
    ↓
دمج إلى main
    ↓
GreasyFork
    ↓
تحديث Tampermonkey للمستخدمين
```

> **مهم:** فرع `main` مخصص للنسخ المستقرة. لا تُنشر التجارب غير المكتملة عليه.

## الحقوق

© 2026 Mohammed Almalki (M0HM3D85). All Rights Reserved.

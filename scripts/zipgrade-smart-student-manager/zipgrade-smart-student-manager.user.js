// ==UserScript==
// @name         ZipGrade Smart Student Manager
// @name:en      ZipGrade Smart Student Manager
// @name:ar      مدير طلاب ZipGrade الذكي
// @namespace    https://greasyfork.org/users/1636459
// @version      0.7.0
// @description  Bilingual smart Excel/CSV import plus fast in-page student editing for ZipGrade.
// @description:en  Bilingual smart Excel/CSV import plus fast in-page student editing for ZipGrade.
// @description:ar استيراد ذكي ثنائي اللغة وتعديل سريع للطلاب داخل صفحة ZipGrade دون الدخول والخروج من صفحة كل طالب.
// @author       Mohammed Almalki (M0HM3D85)
// @homepageURL  https://greasyfork.org/en/users/1636459-m0hm3d85
// @supportURL   https://github.com/M0HM3D85/teacher-userscripts/issues
// @copyright    2026, Mohammed Almalki (M0HM3D85)
// @license      All Rights Reserved
// @match        https://www.zipgrade.com/students/*
// @match        https://www.zipgrade.com/importStudents*
// @run-at       document-idle
// @require      https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js
// @grant        none
// @downloadURL https://update.greasyfork.org/scripts/593089/ZipGrade%20Smart%20Student%20Manager.user.js
// @updateURL https://update.greasyfork.org/scripts/593089/ZipGrade%20Smart%20Student%20Manager.meta.js
// ==/UserScript==

/*
=========================================================================
 ZipGrade Smart Student Manager

 تصميم وتطوير: Mohammed Almalki (M0HM3D85)
 X / Twitter : https://x.com/M0HM3D85
 Snapchat    : https://www.snapchat.com/add/M0HM3D85
 GreasyFork  : https://greasyfork.org/en/users/1636459-m0hm3d85

 © 2026 Mohammed Almalki (M0HM3D85) — جميع الحقوق محفوظة.
 يمنع حذف أو تغيير بيانات المصمم وحقوقه عند إعادة نشر السكربت.
=========================================================================
*/

(() => {
    'use strict';

    const APP = 'zgssm';
    const VERSION = '0.7.0';

    const STATE_KEY =
        'ZGSSM_IMPORT_V070';

    const LANG_KEY =
        'ZGSSM_LANG';

    const INVISIBLE_LAST_NAME =
        '\u2060';

    const DEVELOPER =
        Object.freeze({
            name:
                'Mohammed Almalki',

            handle:
                'M0HM3D85',

            x:
                'https://x.com/M0HM3D85',

            snapchat:
                'https://www.snapchat.com/add/M0HM3D85',

            greasyFork:
                'https://greasyfork.org/en/users/1636459-m0hm3d85',

            copyright:
                '© 2026 Mohammed Almalki (M0HM3D85) — جميع الحقوق محفوظة'
        });

    const I18N = {

        ar: {

            smartImport:
                '✨ استيراد ذكي',

            studentManager:
                '⚙ إدارة الطلاب',

            title:
                'استيراد الطلاب الذكي',

            subtitle:
                'اختر Excel أو CSV ثم اربط أعمدته بحقول ZipGrade.',

            chooseFile:
                '1) اختر الملف',

            fileHint:
                'لا يشترط ترتيب أو أسماء أعمدة محددة.',

            sheetHeader:
                '2) الورقة وصف العناوين',

            sheet:
                'ورقة Excel',

            headerRow:
                'صف أسماء الأعمدة',

            mapping:
                '3) ربط الأعمدة',

            mappingHint:
                'يمكن أن تكون أسماء الأعمدة وترتيبها بأي شكل؛ راجع الربط قبل المتابعة.',

            review:
                '4) الفحص والمعاينة',

            studentId:
                'Student ID',

            external:
                'External Ref',

            firstName:
                'First Name',

            lastName:
                'Last Name',

            className:
                'Class(es)',

            notUsed:
                '— غير مستخدم —',

            blankLast:
                'استخدام Last Name فارغ بصريًا',

            blankLastHint:
                'عند وضع علامة الصح سيضع السكربت قيمة غير مرئية تلقائيًا. أزل العلامة لاختيار عمود Last Name من ملفك.',

            idPolicy:
                'الأرقام التي تبدأ بصفر',

            policyBlock:
                'إيقاف الاستيراد عند وجود صفر بالبداية — الموصى به',

            policyStrip:
                'إزالة الأصفار الأولى عمدًا',

            policyPrefix:
                'حماية الرقم بإضافة 9 قبله',

            policyHint:
                'ZipGrade قد يتعامل مع Student ID كعدد ويحذف الصفر الأول. وضع الحماية يحول مثل 012345 إلى 9012345 مع إبقاء الرقم قابلًا للتمييز.',

            valid:
                'صالح',

            errors:
                'أخطاء',

            warnings:
                'تنبيهات',

            leading:
                'يبدأ بصفر',

            originalId:
                'Student ID الأصلي',

            finalId:
                'Student ID النهائي',

            visuallyBlank:
                '(فارغ بصريًا)',

            prepare:
                'تجهيز الملف وفتح معالج ZipGrade',

            cancel:
                'إلغاء',

            noRows:
                'لا توجد صفوف جاهزة.',

            previewMore:
                'تظهر أول 12 نتيجة من أصل {n}.',

            requiredField:
                'يجب ربط {field} بعمود من الملف.',

            idEmpty:
                'الصف {row}: Student ID فارغ.',

            idBad:
                'الصف {row}: Student ID غير رقمي ({value}).',

            nameEmpty:
                'الصف {row}: الاسم فارغ.',

            lastEmpty:
                'الصف {row}: Last Name فارغ.',

            zeroBlocked:
                'الصف {row}: Student ID يبدأ بصفر ({id}). اختر معالجة مناسبة.',

            zeroStrip:
                'الصف {row}: تم تحويل {old} إلى {new} بإزالة الأصفار الأولى.',

            zeroPrefix:
                'الصف {row}: تم حماية {old} وتحويله إلى {new}.',

            prefixLong:
                'الصف {row}: الحماية ستنتج رقمًا بطول {len} خانة؛ اختر طريقة أخرى.',

            dupId:
                'Student ID مكرر بعد المعالجة: {id} في الصفين {a} و{b}.',

            dupEmail:
                'External Ref مكرر في الصفين {a} و{b}: {value}',

            emailBad:
                'الصف {row}: صيغة البريد تبدو غير مكتملة: {value}',

            classEmpty:
                'الصف {row}: الفصل فارغ.',

            tooLong:
                'الصف {row}: Student ID النهائي طوله {len} خانة.',

            fix:
                'يوجد {n} خطأ يجب إصلاحه أولًا.',

            noValid:
                'لا توجد بيانات صالحة للاستيراد.',

            readFail:
                'تعذر قراءة الملف:',

            ready:
                '✨ ملف الاستيراد الذكي جاهز',

            readyCount:
                'تم تجهيز {n} طالبًا.',

            uploadInfo:
                'سيتم رفع ملف CSV إلى معالج ZipGrade الرسمي، ثم ربط صفحة Select Fields تلقائيًا.',

            upload:
                'رفع الملف ومتابعة',

            finalTitle:
                '✨ مراجعة الربط قبل الاستيراد',

            allMapped:
                'جميع الحقول المطلوبة مرتبطة بشكل صحيح.',

            mapProblem:
                'يوجد ربط غير صحيح؛ تم تعطيل الاستيراد النهائي.',

            expected:
                'المطلوب',

            recheck:
                '🔄 إعادة الربط والفحص',

            finish:
                '✅ تنفيذ الاستيراد النهائي',

            exit:
                'إلغاء الوضع الذكي',

            importing:
                'جارٍ الاستيراد...',

            firstIds:
                'أول Student IDs التي سيتم إرسالها:',

            confirm:
                'سيتم الآن استيراد {n} طالبًا.\n\nهل تريد المتابعة؟',

            mappingBlocked:
                'تم منع الاستيراد لأن أحد الحقول غير مرتبط بشكل صحيح.',

            returned:
                'عاد ZipGrade إلى صفحة اختيار الملف. راجع رسالة الخطأ الظاهرة في الصفحة.',

            classMode:
                'طريقة الفصل',

            classColumn:
                'عمود الفصل',

            noClass:
                'بدون فصل',

            lang:
                'English',

            about:
                'عن السكربت',

            aboutTitle:
                'مدير طلاب ZipGrade الذكي',

            aboutText:
                'أداة ثنائية اللغة لاستيراد الطلاب وإدارة بياناتهم بسرعة داخل ZipGrade مع معاينة وفحوصات أمان.',

            close:
                'إغلاق',

            rights:
                'تصميم وتطوير: {author} • الإصدار v{v}',

            independent:
                'أداة مستقلة وغير تابعة لـ ZipGrade.',

            rightsNotice:
                'يمنع حذف أو تغيير بيانات المصمم وحقوقه عند إعادة نشر السكربت.',

            managerTitle:
                'إدارة الطلاب',

            managerSubtitle:
                'عدّل بيانات الطلاب من نفس الصفحة بدون الدخول والخروج من صفحة كل طالب.',

            search:
                'بحث بالاسم أو Student ID أو البريد أو الفصل...',

            students:
                'الطلاب',

            shown:
                '{n} طالب',

            noStudents:
                'لم يتم العثور على طلاب في الجدول.',

            chooseStudent:
                'اختر طالبًا من القائمة لعرض بياناته.',

            loadingStudent:
                'جارٍ تحميل بيانات الطالب...',

            loadFailed:
                'تعذر تحميل بيانات الطالب.',

            save:
                '💾 حفظ التعديلات',

            saving:
                'جارٍ الحفظ...',

            saved:
                '✅ تم حفظ بيانات الطالب بنجاح.',

            saveFailed:
                '❌ تعذر حفظ التعديلات أو التحقق منها.',

            previous:
                'السابق',

            next:
                'التالي',

            openOriginal:
                'فتح صفحة الطالب الأصلية',

            classes:
                'الفصول',

            noClasses:
                'لا توجد فصول متاحة.',

            useBlankLast:
                'Last Name فارغ بصريًا',

            idChangeWarning:
                'أنت على وشك تغيير Student ID من {old} إلى {new}. قد يؤثر ذلك على مطابقة أوراق أو سجلات سابقة. هل تريد المتابعة؟',

            idLeadingZeroEdit:
                'لا يمكن الاعتماد على الصفر في بداية Student ID؛ ZipGrade قد يحذفه لأنه يتعامل معه كرقم.',

            requiredName:
                'First Name مطلوب.',

            requiredLast:
                'Last Name مطلوب أو فعّل خيار الفراغ البصري.',

            invalidId:
                'Student ID يجب أن يحتوي أرقامًا فقط.',

            unsaved:
                'لديك تعديلات غير محفوظة. هل تريد تجاهلها؟',

            refreshList:
                'تحديث القائمة',

            reloadData:
                'إعادة تحميل بيانات الطالب',

            currentClass:
                'الفصول الحالية',

            managerTip:
                'يمكنك البحث، فتح أي طالب، الحفظ، ثم الانتقال مباشرة للسابق أو التالي.',

            studentCount:
                'إجمالي الطلاب: {n}',

            editStudent:
                'تعديل الطالب',

            dirty:
                'توجد تعديلات غير محفوظة',

            noChanges:
                'لا توجد تعديلات للحفظ.',

            verifyFailed:
                'تم إرسال الحفظ لكن التحقق من البيانات النهائية لم يطابق القيم المطلوبة.'
        },

        en: {

            smartImport:
                '✨ Smart Import',

            studentManager:
                '⚙ Student Manager',

            title:
                'Smart Student Import',

            subtitle:
                'Choose an Excel or CSV file, then map its columns to ZipGrade fields.',

            chooseFile:
                '1) Choose file',

            fileHint:
                'No fixed column names or order are required.',

            sheetHeader:
                '2) Sheet & header row',

            sheet:
                'Excel sheet',

            headerRow:
                'Header row',

            mapping:
                '3) Map columns',

            mappingHint:
                'Your file can use any column names or order. Review the mapping before continuing.',

            review:
                '4) Validation & preview',

            studentId:
                'Student ID',

            external:
                'External Ref',

            firstName:
                'First Name',

            lastName:
                'Last Name',

            className:
                'Class(es)',

            notUsed:
                '— Not used —',

            blankLast:
                'Use a visually blank Last Name',

            blankLastHint:
                'When checked, the script inserts an invisible value automatically. Uncheck it to map a real Last Name column.',

            idPolicy:
                'IDs starting with zero',

            policyBlock:
                'Block import when a leading zero is found — recommended',

            policyStrip:
                'Intentionally remove leading zeros',

            policyPrefix:
                'Protect the ID by adding 9 in front',

            policyHint:
                'ZipGrade may treat Student ID as an integer and remove a leading zero. Protection converts e.g. 012345 to 9012345 so the value remains distinguishable.',

            valid:
                'Valid',

            errors:
                'Errors',

            warnings:
                'Warnings',

            leading:
                'Leading zero',

            originalId:
                'Original Student ID',

            finalId:
                'Final Student ID',

            visuallyBlank:
                '(visually blank)',

            prepare:
                'Prepare file and open ZipGrade importer',

            cancel:
                'Cancel',

            noRows:
                'No ready rows.',

            previewMore:
                'Showing the first 12 results out of {n}.',

            requiredField:
                'Map {field} to a file column.',

            idEmpty:
                'Row {row}: Student ID is empty.',

            idBad:
                'Row {row}: Student ID is not numeric ({value}).',

            nameEmpty:
                'Row {row}: name is empty.',

            lastEmpty:
                'Row {row}: Last Name is empty.',

            zeroBlocked:
                'Row {row}: Student ID starts with zero ({id}). Choose a handling option.',

            zeroStrip:
                'Row {row}: converted {old} to {new} by removing leading zeros.',

            zeroPrefix:
                'Row {row}: protected {old} and converted it to {new}.',

            prefixLong:
                'Row {row}: protection would create a {len}-digit ID; choose another method.',

            dupId:
                'Duplicate Student ID after processing: {id} in rows {a} and {b}.',

            dupEmail:
                'Duplicate External Ref in rows {a} and {b}: {value}',

            emailBad:
                'Row {row}: email format looks incomplete: {value}',

            classEmpty:
                'Row {row}: class is empty.',

            tooLong:
                'Row {row}: final Student ID is {len} digits long.',

            fix:
                'There are {n} errors to fix first.',

            noValid:
                'No valid rows are ready for import.',

            readFail:
                'Could not read the file:',

            ready:
                '✨ Smart import file is ready',

            readyCount:
                '{n} students prepared.',

            uploadInfo:
                'The CSV will be uploaded to ZipGrade’s official importer, then the Select Fields page will be mapped automatically.',

            upload:
                'Upload and continue',

            finalTitle:
                '✨ Review mapping before import',

            allMapped:
                'All required fields are mapped correctly.',

            mapProblem:
                'Some mapping is incorrect; final import is disabled.',

            expected:
                'Expected',

            recheck:
                '🔄 Re-map and verify',

            finish:
                '✅ Run final import',

            exit:
                'Exit smart mode',

            importing:
                'Importing...',

            firstIds:
                'First Student IDs that will be sent:',

            confirm:
                '{n} students will now be imported.\n\nContinue?',

            mappingBlocked:
                'Import was blocked because one or more fields are mapped incorrectly.',

            returned:
                'ZipGrade returned to the file selection page. Review the error shown on the page.',

            classMode:
                'Class mode',

            classColumn:
                'Class column',

            noClass:
                'No class',

            lang:
                'العربية',

            about:
                'About',

            aboutTitle:
                'ZipGrade Smart Student Manager',

            aboutText:
                'A bilingual tool for importing students and managing student data quickly inside ZipGrade with preview and safety checks.',

            close:
                'Close',

            rights:
                'Designed & Developed by {author} • v{v}',

            independent:
                'Independent tool; not affiliated with ZipGrade.',

            rightsNotice:
                'Do not remove or alter the developer attribution or rights notice when redistributing this script.',

            managerTitle:
                'Student Manager',

            managerSubtitle:
                'Edit student records from the same page without opening and leaving each student page.',

            search:
                'Search name, Student ID, email, or class...',

            students:
                'Students',

            shown:
                '{n} students',

            noStudents:
                'No students were found in the table.',

            chooseStudent:
                'Choose a student from the list to view their data.',

            loadingStudent:
                'Loading student data...',

            loadFailed:
                'Could not load student data.',

            save:
                '💾 Save changes',

            saving:
                'Saving...',

            saved:
                '✅ Student data saved successfully.',

            saveFailed:
                '❌ Could not save or verify the changes.',

            previous:
                'Previous',

            next:
                'Next',

            openOriginal:
                'Open original student page',

            classes:
                'Classes',

            noClasses:
                'No classes are available.',

            useBlankLast:
                'Use visually blank Last Name',

            idChangeWarning:
                'You are about to change Student ID from {old} to {new}. This may affect matching with previous papers or records. Continue?',

            idLeadingZeroEdit:
                'A leading zero in Student ID is not reliable because ZipGrade may remove it when treating the value as an integer.',

            requiredName:
                'First Name is required.',

            requiredLast:
                'Last Name is required unless visually blank mode is enabled.',

            invalidId:
                'Student ID must contain digits only.',

            unsaved:
                'You have unsaved changes. Discard them?',

            refreshList:
                'Refresh list',

            reloadData:
                'Reload student data',

            currentClass:
                'Current classes',

            managerTip:
                'Search, open any student, save, then move directly to the previous or next student.',

            studentCount:
                'Total students: {n}',

            editStudent:
                'Edit student',

            dirty:
                'Unsaved changes',

            noChanges:
                'There are no changes to save.',

            verifyFailed:
                'The save request was sent, but the final data did not match the requested values.'
        }
    };

    const HINTS = {

        studentId: [
            'السجل المدني',
            'السجل',
            'سجل مدني',
            'رقم الهوية',
            'الهوية',
            'هوية الطالب',
            'رقم الطالب',
            'student id',
            'studentid',
            'student number',
            'student no',
            'zipgrade id',
            'id number',
            'identifier'
        ],

        externalId: [
            'البريد الالكتروني',
            'البريد الإلكتروني',
            'البريد',
            'ايميل',
            'إيميل',
            'email',
            'e-mail',
            'email address',
            'mail',
            'external id',
            'external ref',
            'external reference'
        ],

        firstName: [
            'اسم الطالب',
            'الاسم الكامل',
            'الاسم',
            'full name',
            'student name',
            'given name',
            'first name',
            'name'
        ],

        lastName: [
            'اسم العائلة',
            'العائلة',
            'اللقب',
            'last name',
            'surname',
            'family name',
            'family'
        ],

        className: [
            'الفصل',
            'الشعبة',
            'الصف والفصل',
            'الصف',
            'class',
            'section',
            'class name',
            'classroom',
            'group'
        ]
    };

    let lang =
        getInitialLanguage();

    addStyles();

    if (
        /^\/students\/?$/
            .test(
                location.pathname
            )
    ) {
        initStudentsPage();
    }

    if (
        location.pathname
            .startsWith(
                '/importStudents'
            )
    ) {
        initImportPage();
    }

    function t(
        key,
        vars = {}
    ) {

        let text =
            I18N[
                lang
            ]?.[
                key
            ]
            ??
            I18N.en[
                key
            ]
            ??
            key;

        for (
            const [
                k,
                v
            ]
            of
            Object.entries(
                vars
            )
        ) {
            text =
                text.replaceAll(
                    `{${k}}`,
                    String(v)
                );
        }

        return text;
    }

    function getInitialLanguage() {

        try {

            const saved =
                localStorage
                    .getItem(
                        LANG_KEY
                    );

            if (
                saved ===
                'ar'
                ||
                saved ===
                'en'
            ) {
                return saved;
            }
        }
        catch (_) {}

        return (
            /^ar\b/i
                .test(
                    navigator.language
                    ||
                    ''
                )
        )
            ? 'ar'
            : 'en';
    }

    function setLanguage(
        next
    ) {

        lang =
            next ===
            'ar'
                ? 'ar'
                : 'en';

        try {
            localStorage
                .setItem(
                    LANG_KEY,
                    lang
                );
        }
        catch (_) {}
    }

    function addStyles() {

        if (
            document
                .getElementById(
                    `${APP}-style`
                )
        ) {
            return;
        }

        const style =
            document
                .createElement(
                    'style'
                );

        style.id =
            `${APP}-style`;

        style.textContent = `

#${APP}-overlay,
#${APP}-managerOverlay {
    position: fixed;
    inset: 0;
    z-index: 2147483645;
    background: #0f172aa6;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 18px;
    font-family:
        "Segoe UI",
        Tahoma,
        Arial,
        sans-serif;
}

#${APP}-modal,
#${APP}-managerModal {
    width: min(
        1120px,
        96vw
    );
    max-height: 92vh;
    overflow: auto;
    background: #fff;
    color: #0f172a;
    border-radius: 20px;
    box-shadow:
        0 30px 90px
        #0006;
}

#${APP}-managerModal {
    width: min(
        1220px,
        97vw
    );
    overflow: hidden;
    display: flex;
    flex-direction: column;
    height: min(
        850px,
        92vh
    );
}

#${APP}-head,
#${APP}-managerHead {
    display: flex;
    justify-content:
        space-between;
    align-items: center;
    gap: 14px;
    padding: 18px 22px;
    background:
        linear-gradient(
            135deg,
            #087f83,
            #153448
        );
    color: #fff;
}

#${APP}-head {
    border-radius:
        20px 20px 0 0;
}

#${APP}-head h2,
#${APP}-managerHead h2 {
    margin: 0;
    font-size: 22px;
}

#${APP}-head p,
#${APP}-managerHead p {
    margin:
        5px 0 0;
    font-size: 13px;
    opacity: .9;
}

.zg-head-actions {
    display: flex;
    gap: 7px;
    align-items: center;
}

.zg-head-btn {
    border:
        1px solid
        #ffffff2b;
    background:
        #ffffff1c;
    color: #fff;
    border-radius: 9px;
    padding: 8px 10px;
    font-weight: 700;
    cursor: pointer;
}

.zg-x {
    width: 38px;
    height: 38px;
    padding: 0;
    font-size: 20px;
}

#${APP}-body {
    padding: 20px 22px;
}

.zg-grid {
    display: grid;
    grid-template-columns:
        repeat(
            2,
            minmax(
                0,
                1fr
            )
        );
    gap: 14px;
}

.zg-wide {
    grid-column:
        1 / -1;
}

.zg-card {
    border:
        1px solid
        #e1e7ea;
    border-radius: 14px;
    padding: 15px;
    background: #fff;
}

.zg-card h3 {
    margin:
        0 0 10px;
    font-size: 15px;
}

.zg-label {
    display: block;
    margin:
        8px 0 5px;
    font-size: 12px;
    font-weight: 700;
}

.zg-input {
    width: 100%;
    padding: 9px 10px;
    border:
        1px solid
        #cbd5e1;
    border-radius: 9px;
    background: #fff;
    box-sizing:
        border-box;
}

.zg-input:focus {
    outline: none;
    border-color:
        #087f83;
    box-shadow:
        0 0 0 3px
        #087f8318;
}

.zg-muted {
    font-size: 11.5px;
    color: #64748b;
    line-height: 1.6;
}

.zg-map {
    display: grid;
    grid-template-columns:
        210px 1fr;
    gap: 10px;
    align-items: center;
    margin: 10px 0;
}

.zg-checkline {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
}

.zg-notice {
    padding: 11px 13px;
    border-radius: 11px;
    margin: 10px 0;
    font-size: 12.5px;
    line-height: 1.75;
}

.zg-info {
    background: #eff6ff;
    color: #1e3a8a;
}

.zg-warnbox {
    background: #fffbeb;
    color: #92400e;
}

.zg-errorbox {
    background: #fef2f2;
    color: #991b1b;
}

.zg-successbox {
    background: #ecfdf5;
    color: #166534;
}

.zg-actions {
    display: flex;
    gap: 9px;
    flex-wrap: wrap;
    margin-top: 15px;
}

.zg-btn {
    border: 0;
    border-radius: 9px;
    padding: 10px 14px;
    font-weight: 700;
    cursor: pointer;
}

.zg-btn:disabled {
    opacity: .45;
    cursor: not-allowed;
}

.zg-primary {
    background: #087f83;
    color: #fff;
}

.zg-secondary {
    background: #eaf2f4;
    color: #17494e;
}

.zg-danger {
    background: #feecec;
    color: #a52525;
}

.zg-badge {
    display:
        inline-flex;
    padding: 4px 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    background: #eef2f7;
}

.zg-ok {
    background: #dcfce7;
    color: #166534;
}

.zg-warn {
    background: #fef3c7;
    color: #92400e;
}

.zg-err {
    background: #fee2e2;
    color: #991b1b;
}

.zg-stats {
    display: flex;
    gap: 7px;
    flex-wrap: wrap;
    margin-bottom: 9px;
}

.zg-tablewrap {
    overflow: auto;
    border:
        1px solid
        #e2e8f0;
    border-radius: 11px;
}

.zg-table {
    width: 100%;
    min-width: 900px;
    border-collapse:
        collapse;
    font-size: 11.5px;
}

.zg-table th,
.zg-table td {
    padding: 8px 9px;
    border-bottom:
        1px solid
        #edf0f2;
    white-space: nowrap;
    text-align: start;
}

.zg-table th {
    position: sticky;
    top: 0;
    background: #f8fafc;
}

.zg-footer {
    display: flex;
    justify-content:
        space-between;
    gap: 12px;
    flex-wrap: wrap;
    margin-top: 17px;
    padding-top: 13px;
    border-top:
        1px solid
        #e2e8f0;
    font-size: 10.5px;
    color: #64748b;
}

.zg-footer a {
    color: #087f83;
    text-decoration: none;
    font-weight: 700;
}

#${APP}-native {
    border:
        1px solid
        #99f6e4;
    background: #f0fdfa;
    border-radius: 14px;
    padding: 16px;
    margin: 14px 0;
    font-family:
        "Segoe UI",
        Tahoma,
        Arial,
        sans-serif;
}

#${APP}-native[dir="rtl"] {
    direction: rtl;
}

#${APP}-native[dir="ltr"] {
    direction: ltr;
}

.zg-verify {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 7px 0;
    font-size: 12.5px;
}

.zg-pass {
    color: #166534;
    font-weight: 800;
}

.zg-fail {
    color: #991b1b;
    font-weight: 800;
}

.zg-about {
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    background: #0f172ab3;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 18px;
    font-family:
        "Segoe UI",
        Tahoma,
        Arial,
        sans-serif;
}

.zg-about[hidden] {
    display: none;
}

.zg-about-card {
    width: min(
        500px,
        94vw
    );
    background: #fff;
    border-radius: 17px;
    overflow: hidden;
    box-shadow:
        0 30px 90px
        #0006;
}

.zg-about-top {
    padding: 18px 20px;
    background:
        linear-gradient(
            135deg,
            #087f83,
            #153448
        );
    color: #fff;
}

.zg-about-top h3 {
    margin:
        0 0 4px;
}

.zg-about-body {
    padding: 17px 20px;
    line-height: 1.8;
    font-size: 12.5px;
}

.zg-identity {
    margin: 12px 0;
    padding: 11px;
    border:
        1px solid
        #d8e8eb;
    border-radius: 10px;
    background: #f7fbfb;
}

.zg-links {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

.zg-links a {
    padding: 7px 9px;
    border-radius: 8px;
    background: #eaf4f5;
    color: #087f83;
    text-decoration: none;
    font-weight: 700;
}

.zg-about-bottom {
    padding: 11px 20px;
    border-top:
        1px solid
        #e6ebee;
    background: #fafcfd;
    display: flex;
    justify-content:
        flex-end;
}

/* =========================================================
   Student Manager
   ========================================================= */

.zgm-body {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns:
        minmax(
            280px,
            34%
        )
        1fr;
    background: #f8fafc;
}

.zgm-sidebar {
    border-inline-end:
        1px solid
        #e2e8f0;
    background: #fff;
    display: flex;
    flex-direction: column;
    min-height: 0;
}

.zgm-tools {
    padding: 12px;
    border-bottom:
        1px solid
        #e2e8f0;
}

.zgm-tools-row {
    display: flex;
    gap: 7px;
    margin-top: 8px;
    align-items: center;
    flex-wrap: wrap;
}

.zgm-list {
    flex: 1;
    overflow: auto;
    min-height: 0;
}

.zgm-item {
    display: block;
    width: 100%;
    border: 0;
    border-bottom:
        1px solid
        #edf0f2;
    background: #fff;
    text-align: start;
    padding: 11px 12px;
    cursor: pointer;
    color: #0f172a;
}

.zgm-item:hover {
    background: #f0fdfa;
}

.zgm-item.active {
    background: #e6fffb;
    box-shadow:
        inset 4px 0 0
        #087f83;
}

#${APP}-managerModal[dir="rtl"]
.zgm-item.active {
    box-shadow:
        inset -4px 0 0
        #087f83;
}

.zgm-item-name {
    font-size: 13px;
    font-weight: 800;
    margin-bottom: 4px;
}

.zgm-item-meta {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    color: #64748b;
    font-size: 10.5px;
}

.zgm-main {
    min-width: 0;
    min-height: 0;
    overflow: auto;
    padding: 18px;
}

.zgm-empty {
    min-height: 320px;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    color: #64748b;
    padding: 30px;
}

.zgm-editor {
    max-width: 760px;
    margin: 0 auto;
}

.zgm-editor-head {
    display: flex;
    justify-content:
        space-between;
    gap: 12px;
    align-items:
        flex-start;
    margin-bottom: 12px;
}

.zgm-editor-head h3 {
    margin: 0;
    font-size: 18px;
}

.zgm-form-grid {
    display: grid;
    grid-template-columns:
        repeat(
            2,
            minmax(
                0,
                1fr
            )
        );
    gap: 12px;
}

.zgm-field-full {
    grid-column:
        1 / -1;
}

.zgm-class-grid {
    display: grid;
    grid-template-columns:
        repeat(
            2,
            minmax(
                0,
                1fr
            )
        );
    gap: 8px;
    margin-top: 7px;
}

.zgm-class {
    display: flex;
    gap: 7px;
    align-items:
        flex-start;
    padding: 9px 10px;
    border:
        1px solid
        #e2e8f0;
    border-radius: 9px;
    background: #fff;
    font-size: 12px;
}

.zgm-status {
    min-height: 24px;
    margin-top: 10px;
    font-size: 12px;
    line-height: 1.6;
}

.zgm-nav {
    display: flex;
    gap: 7px;
    flex-wrap: wrap;
    margin-top: 14px;
    padding-top: 12px;
    border-top:
        1px solid
        #e2e8f0;
}

.zgm-manager-footer {
    flex:
        0 0 auto;
    padding: 8px 14px;
    border-top:
        1px solid
        #e2e8f0;
    background: #fff;
}

.zgm-manager-footer
.zg-footer {
    margin-top: 0;
    padding-top: 0;
    border-top: 0;
}

.zgm-dirty {
    display:
        inline-flex;
    align-items: center;
    border-radius: 999px;
    background: #fef3c7;
    color: #92400e;
    padding: 4px 8px;
    font-size: 10.5px;
    font-weight: 800;
}

.zgm-loading {
    display:
        inline-block;
    width: 18px;
    height: 18px;
    border:
        2px solid
        #cbd5e1;
    border-top-color:
        #087f83;
    border-radius: 50%;
    animation:
        zgm-spin
        .7s linear
        infinite;
    vertical-align:
        middle;
    margin-inline-end:
        7px;
}

@keyframes zgm-spin {
    to {
        transform:
            rotate(
                360deg
            );
    }
}

@media(
    max-width: 760px
) {

    .zg-grid {
        grid-template-columns:
            1fr;
    }

    .zg-wide {
        grid-column: auto;
    }

    .zg-map {
        grid-template-columns:
            1fr;
    }

    #${APP}-head,
    #${APP}-managerHead {
        align-items:
            flex-start;
        flex-direction:
            column;
    }

    .zg-head-actions {
        align-self:
            stretch;
        justify-content:
            flex-end;
    }

    #${APP}-managerModal {
        height: 94vh;
        width: 97vw;
    }

    .zgm-body {
        grid-template-columns:
            1fr;
        grid-template-rows:
            38%
            1fr;
    }

    .zgm-sidebar {
        border-inline-end: 0;
        border-bottom:
            1px solid
            #e2e8f0;
    }

    .zgm-form-grid {
        grid-template-columns:
            1fr;
    }

    .zgm-field-full {
        grid-column: auto;
    }

    .zgm-class-grid {
        grid-template-columns:
            1fr;
    }
}
`;

        document.head
            .appendChild(
                style
            );
    }

    /* =========================================================
       Students page buttons
       ========================================================= */

    function initStudentsPage() {

        if (
            document
                .getElementById(
                    `${APP}-launch`
                )
        ) {
            return;
        }

        const native =
            [
                ...document
                    .querySelectorAll(
                        'button'
                    )
            ]
                .find(
                    button =>
                        /Import Students from CSV/i
                            .test(
                                clean(
                                    button
                                        .textContent
                                )
                            )
                );

        const importButton =
            document
                .createElement(
                    'button'
                );

        importButton.id =
            `${APP}-launch`;

        importButton.type =
            'button';

        importButton.className =
            native?.className
            ||
            'btn btn-primary';

        importButton.textContent =
            t(
                'smartImport'
            );

        importButton.style
            .marginInlineStart =
                '8px';

        importButton.onclick =
            openImporter;

        const managerButton =
            document
                .createElement(
                    'button'
                );

        managerButton.id =
            `${APP}-managerLaunch`;

        managerButton.type =
            'button';

        managerButton.className =
            native?.className
            ||
            'btn btn-primary';

        managerButton.textContent =
            t(
                'studentManager'
            );

        managerButton.style
            .marginInlineStart =
                '8px';

        managerButton.onclick =
            openStudentManager;

        if (native) {

            native
                .insertAdjacentElement(
                    'afterend',
                    importButton
                );

            importButton
                .insertAdjacentElement(
                    'afterend',
                    managerButton
                );
        }
        else {

            const host =
                document
                    .querySelector(
                        'main'
                    )
                ||
                document.body;

            host.prepend(
                managerButton
            );

            host.prepend(
                importButton
            );
        }
    }

    /* =========================================================
       Student Manager
       ========================================================= */

    function readStudentsFromTable() {

        const table =
            document
                .querySelector(
                    '#studentTable'
                )
            ||
            document
                .querySelector(
                    'table'
                );

        if (!table) {
            return [];
        }

        const headers =
            [
                ...table
                    .querySelectorAll(
                        'thead th'
                    )
            ]
                .map(
                    th =>
                        canonicalHeader(
                            th.textContent
                        )
                );

        const indexes = {

            id:
                findHeaderIndex(
                    headers,
                    [
                        'student id',
                        'zipgrade id'
                    ]
                ),

            external:
                findHeaderIndex(
                    headers,
                    [
                        'external ref',
                        'external id'
                    ]
                ),

            first:
                findHeaderIndex(
                    headers,
                    [
                        'first name'
                    ]
                ),

            last:
                findHeaderIndex(
                    headers,
                    [
                        'last name'
                    ]
                ),

            classes:
                findHeaderIndex(
                    headers,
                    [
                        'class(es)',
                        'classes',
                        'class'
                    ]
                ),

            edit:
                findHeaderIndex(
                    headers,
                    [
                        'edit'
                    ]
                )
        };

        const rows =
            [
                ...table
                    .querySelectorAll(
                        'tbody tr'
                    )
            ];

        const students =
            [];

        rows.forEach(
            (
                row,
                rowIndex
            ) => {

                const cells =
                    [
                        ...row
                            .querySelectorAll(
                                'td'
                            )
                    ];

                if (
                    !cells.length
                ) {
                    return;
                }

                let editLink =
                    null;

                if (
                    indexes.edit >=
                    0
                    &&
                    cells[
                        indexes.edit
                    ]
                ) {
                    editLink =
                        cells[
                            indexes.edit
                        ]
                            .querySelector(
                                'a[href]'
                            );
                }

                if (!editLink) {

                    editLink =
                        [
                            ...row
                                .querySelectorAll(
                                    'a[href]'
                                )
                        ]
                            .find(
                                link => {

                                    try {

                                        const url =
                                            new URL(
                                                link.href,
                                                location.href
                                            );

                                        return (
                                            /^\/students\/[^/]+\/?$/
                                                .test(
                                                    url.pathname
                                                )
                                            &&
                                            !/\/students\/new\/?$/i
                                                .test(
                                                    url.pathname
                                                )
                                        );
                                    }
                                    catch (_) {
                                        return false;
                                    }
                                }
                            )
                        ||
                        null;
                }

                if (!editLink) {
                    return;
                }

                const cellText =
                    index =>
                        (
                            index >=
                            0
                            &&
                            cells[
                                index
                            ]
                        )
                            ? clean(
                                cells[
                                    index
                                ]
                                    .textContent
                            )
                            : '';

                const student = {

                    rowIndex,

                    rowEl:
                        row,

                    cells,

                    href:
                        new URL(
                            editLink
                                .getAttribute(
                                    'href'
                                ),
                            location.origin
                        ).href,

                    zipGradeId:
                        cellText(
                            indexes.id
                        ),

                    externalId:
                        cellText(
                            indexes.external
                        ),

                    firstName:
                        cellText(
                            indexes.first
                        ),

                    lastName:
                        cellText(
                            indexes.last
                        ),

                    classesText:
                        cellText(
                            indexes.classes
                        ),

                    indexes
                };

                student.searchText =
                    canonical(
                        `${
                            student.zipGradeId
                        } ${
                            student.externalId
                        } ${
                            student.firstName
                        } ${
                            student.lastName
                        } ${
                            student.classesText
                        }`
                    );

                students.push(
                    student
                );
            }
        );

        return students;
    }

    function findHeaderIndex(
        headers,
        names
    ) {

        for (
            const name
            of names
        ) {

            const wanted =
                canonicalHeader(
                    name
                );

            const exact =
                headers
                    .findIndex(
                        header =>
                            header ===
                            wanted
                    );

            if (
                exact >=
                0
            ) {
                return exact;
            }
        }

        for (
            const name
            of names
        ) {

            const wanted =
                canonicalHeader(
                    name
                );

            const loose =
                headers
                    .findIndex(
                        header =>
                            header
                                .includes(
                                    wanted
                                )
                            ||
                            wanted
                                .includes(
                                    header
                                )
                    );

            if (
                loose >=
                0
            ) {
                return loose;
            }
        }

        return -1;
    }

    function canonicalHeader(
        value
    ) {

        return clean(
            value
        )
            .toLowerCase()
            .replace(
                /\s+/g,
                ' '
            )
            .replace(
                /[：:]/g,
                ''
            )
            .trim();
    }

    function openStudentManager() {

        document
            .getElementById(
                `${APP}-managerOverlay`
            )
            ?.remove();

        const students =
            readStudentsFromTable();

        const overlay =
            document
                .createElement(
                    'div'
                );

        overlay.id =
            `${APP}-managerOverlay`;

        overlay.innerHTML =
            managerHtml(
                students.length
            );

        document.body
            .appendChild(
                overlay
            );

        wireStudentManager(
            overlay,
            students
        );
    }

    function managerHtml(
        count
    ) {

        const dir =
            lang ===
            'ar'
                ? 'rtl'
                : 'ltr';

        return `
<section
    id="${APP}-managerModal"
    dir="${dir}"
>

<header
    id="${APP}-managerHead"
>

<div>

<h2>
    ${esc(
        t(
            'managerTitle'
        )
    )}
</h2>

<p>
    ${esc(
        t(
            'managerSubtitle'
        )
    )}
</p>

</div>

<div class="zg-head-actions">

<button
    id="${APP}-managerAbout"
    class="zg-head-btn"
    type="button"
>
    ${esc(
        t(
            'about'
        )
    )}
</button>

<button
    id="${APP}-managerLang"
    class="zg-head-btn"
    type="button"
>
    ${esc(
        t(
            'lang'
        )
    )}
</button>

<button
    id="${APP}-managerClose"
    class="zg-head-btn zg-x"
    type="button"
>
    ×
</button>

</div>

</header>

<div class="zgm-body">

<aside class="zgm-sidebar">

<div class="zgm-tools">

<input
    id="${APP}-managerSearch"
    class="zg-input"
    type="search"
    placeholder="${
        esc(
            t(
                'search'
            )
        )
    }"
>

<div class="zgm-tools-row">

<button
    id="${APP}-managerRefresh"
    class="zg-btn zg-secondary"
    type="button"
>
    ${esc(
        t(
            'refreshList'
        )
    )}
</button>

<span
    id="${APP}-managerCount"
    class="zg-badge"
>
    ${esc(
        t(
            'studentCount',
            {
                n:
                    count
            }
        )
    )}
</span>

</div>

<div
    class="zg-muted"
    style="margin-top:7px"
>
    ${esc(
        t(
            'managerTip'
        )
    )}
</div>

</div>

<div
    id="${APP}-managerList"
    class="zgm-list"
></div>

</aside>

<main
    id="${APP}-managerMain"
    class="zgm-main"
>

<div class="zgm-empty">
    ${esc(
        studentsEmptyMessage(
            count
        )
    )}
</div>

</main>

</div>

<div class="zgm-manager-footer">
    ${rightsFooter()}
</div>

</section>

${aboutHtml(dir)}
`;
    }

    function studentsEmptyMessage(
        count
    ) {

        return count
            ? t(
                'chooseStudent'
            )
            : t(
                'noStudents'
            );
    }

    function wireStudentManager(
        overlay,
        initialStudents
    ) {

        const $ =
            id =>
                overlay
                    .querySelector(
                        `#${APP}-${id}`
                    );

        const state = {

            students:
                initialStudents,

            filtered:
                initialStudents
                    .slice(),

            current:
                null,

            detail:
                null,

            dirty:
                false,

            loading:
                false,

            saveInProgress:
                false,

            token:
                0
        };

        const closeManager =
            () => {

                if (
                    state.dirty
                    &&
                    !confirm(
                        t(
                            'unsaved'
                        )
                    )
                ) {
                    return;
                }

                overlay.remove();
            };

        $('managerClose')
            .onclick =
                closeManager;

        overlay
            .addEventListener(
                'click',
                event => {

                    if (
                        event.target ===
                        overlay
                    ) {
                        closeManager();
                    }
                }
            );

        $('managerAbout')
            .onclick =
                () => {

                    $('about')
                        .hidden =
                            false;
                };

        $('aboutClose')
            .onclick =
                () => {

                    $('about')
                        .hidden =
                            true;
                };

        $('about')
            .onclick =
                event => {

                    if (
                        event.target ===
                        $('about')
                    ) {
                        $('about')
                            .hidden =
                                true;
                    }
                };

        $('managerLang')
            .onclick =
                () => {

                    if (
                        state.dirty
                        &&
                        !confirm(
                            t(
                                'unsaved'
                            )
                        )
                    ) {
                        return;
                    }

                    setLanguage(
                        lang ===
                        'ar'
                            ? 'en'
                            : 'ar'
                    );

                    const importButton =
                        document
                            .getElementById(
                                `${APP}-launch`
                            );

                    const managerButton =
                        document
                            .getElementById(
                                `${APP}-managerLaunch`
                            );

                    if (
                        importButton
                    ) {
                        importButton
                            .textContent =
                                t(
                                    'smartImport'
                                );
                    }

                    if (
                        managerButton
                    ) {
                        managerButton
                            .textContent =
                                t(
                                    'studentManager'
                                );
                    }

                    overlay.remove();

                    openStudentManager();
                };

        $('managerSearch')
            .addEventListener(
                'input',
                () => {

                    applyManagerFilter(
                        state,
                        $,
                        $('managerSearch')
                            .value
                    );
                }
            );

        $('managerRefresh')
            .onclick =
                () => {

                    if (
                        state.dirty
                        &&
                        !confirm(
                            t(
                                'unsaved'
                            )
                        )
                    ) {
                        return;
                    }

                    state.students =
                        readStudentsFromTable();

                    state.current =
                        null;

                    state.detail =
                        null;

                    state.dirty =
                        false;

                    $('managerSearch')
                        .value =
                            '';

                    applyManagerFilter(
                        state,
                        $,
                        ''
                    );

                    $('managerMain')
                        .innerHTML =
                            `
<div class="zgm-empty">
    ${
        esc(
            studentsEmptyMessage(
                state.students
                    .length
            )
        )
    }
</div>
`;
                };

        renderManagerList(
            state,
            $
        );
    }

    function applyManagerFilter(
        state,
        $,
        query
    ) {

        const q =
            canonical(
                query
            );

        state.filtered =
            q
                ? state.students
                    .filter(
                        student =>
                            student.searchText
                                .includes(
                                    q
                                )
                    )
                : state.students
                    .slice();

        renderManagerList(
            state,
            $
        );
    }

    function renderManagerList(
        state,
        $
    ) {

        $('managerCount')
            .textContent =
                t(
                    'shown',
                    {
                        n:
                            state.filtered
                                .length
                    }
                );

        if (
            !state.filtered
                .length
        ) {

            $('managerList')
                .innerHTML =
                    `
<div
    class="zgm-empty"
    style="min-height:180px"
>
    ${esc(
        t(
            'noStudents'
        )
    )}
</div>
`;

            return;
        }

        $('managerList')
            .innerHTML =
                state.filtered
                    .map(
                        student => {

                            const active =
                                state.current
                                    ?.href ===
                                student.href
                                    ? 'active'
                                    : '';

                            const displayName =
                                clean(
                                    `${
                                        student.firstName
                                    } ${
                                        visualValue(
                                            student.lastName
                                        )
                                    }`
                                )
                                ||
                                student.zipGradeId
                                ||
                                t(
                                    'editStudent'
                                );

                            return `
<button
    class="zgm-item ${active}"
    type="button"
    data-href="${
        escAttr(
            student.href
        )
    }"
>

<div class="zgm-item-name">
    ${esc(
        displayName
    )}
</div>

<div class="zgm-item-meta">

${
    student.zipGradeId
        ? `
<span>
    ${
        esc(
            student
                .zipGradeId
        )
    }
</span>
`
        : ''
}

${
    student.externalId
        ? `
<span>
    • ${
        esc(
            student
                .externalId
        )
    }
</span>
`
        : ''
}

${
    student.classesText
        ? `
<span>
    • ${
        esc(
            student
                .classesText
        )
    }
</span>
`
        : ''
}

</div>

</button>
`;
                        }
                    )
                    .join('');

        $('managerList')
            .querySelectorAll(
                '.zgm-item'
            )
            .forEach(
                button => {

                    button.onclick =
                        () => {

                            const student =
                                state.students
                                    .find(
                                        item =>
                                            item.href ===
                                            button
                                                .dataset
                                                .href
                                    );

                            if (!student) {
                                return;
                            }

                            navigateToStudent(
                                state,
                                $,
                                student
                            );
                        };
                }
            );
    }

    async function navigateToStudent(
        state,
        $,
        student
    ) {

        if (
            state.saveInProgress
            ||
            state.loading
        ) {
            return;
        }

        if (
            state.dirty
            &&
            state.current
                ?.href !==
            student.href
            &&
            !confirm(
                t(
                    'unsaved'
                )
            )
        ) {
            return;
        }

        state.current =
            student;

        state.detail =
            null;

        state.dirty =
            false;

        state.loading =
            true;

        const token =
            ++state.token;

        renderManagerList(
            state,
            $
        );

        $('managerMain')
            .innerHTML =
                `
<div class="zgm-empty">

<div>

<span class="zgm-loading"></span>

${esc(
    t(
        'loadingStudent'
    )
)}

</div>

</div>
`;

        try {

            const detail =
                await fetchStudentDetail(
                    student.href
                );

            if (
                token !==
                state.token
            ) {
                return;
            }

            state.detail =
                detail;

            state.loading =
                false;

            renderStudentEditor(
                state,
                $,
                detail
            );
        }
        catch (
            error
        ) {

            if (
                token !==
                state.token
            ) {
                return;
            }

            state.loading =
                false;

            $('managerMain')
                .innerHTML =
                    `
<div class="zgm-empty">

<div>

<div class="zg-notice zg-errorbox">

${esc(
    t(
        'loadFailed'
    )
)}

<br>

${esc(
    error?.message
    ||
    error
)}

</div>

<button
    id="${APP}-retryStudent"
    class="zg-btn zg-secondary"
    type="button"
>
    ${esc(
        t(
            'reloadData'
        )
    )}
</button>

</div>

</div>
`;

            $('retryStudent')
                .onclick =
                    () =>
                        navigateToStudent(
                            state,
                            $,
                            student
                        );
        }
    }

    async function fetchStudentDetail(
        url
    ) {

        const response =
            await fetch(
                url,
                {
                    credentials:
                        'same-origin',

                    headers: {
                        'Accept':
                            'text/html,application/xhtml+xml'
                    },

                    cache:
                        'no-store'
                }
            );

        if (
            !response.ok
        ) {
            throw new Error(
                `HTTP ${
                    response.status
                }`
            );
        }

        const htmlText =
            await response
                .text();

        const doc =
            new DOMParser()
                .parseFromString(
                    htmlText,
                    'text/html'
                );

        const detail =
            parseStudentDetailDocument(
                doc,
                response.url
                ||
                url
            );

        if (!detail) {
            throw new Error(
                'Student edit form not found'
            );
        }

        return detail;
    }

    function parseStudentDetailDocument(
        doc,
        sourceUrl
    ) {

        const zipInput =
            doc
                .querySelector(
                    'input[name="zipGradeId"]'
                );

        if (!zipInput) {
            return null;
        }

        const form =
            zipInput
                .closest(
                    'form'
                );

        if (!form) {
            return null;
        }

        const external =
            form
                .querySelector(
                    'input[name="externalId"]'
                );

        const first =
            form
                .querySelector(
                    'input[name="firstName"]'
                );

        const last =
            form
                .querySelector(
                    'input[name="lastName"]'
                );

        const classInputs =
            [
                ...form
                    .querySelectorAll(
                        'input[type="checkbox"][name="classList"]'
                    )
            ];

        const classes =
            classInputs
                .map(
                    (
                        input,
                        index
                    ) => ({
                        value:
                            input.value,

                        checked:
                            input.checked,

                        label:
                            getControlLabel(
                                doc,
                                input
                            )
                            ||
                            `Class ${
                                index +
                                1
                            }`
                    })
                );

        const action =
            new URL(
                form
                    .getAttribute(
                        'action'
                    )
                ||
                sourceUrl,
                sourceUrl
            ).href;

        const method =
            (
                form
                    .getAttribute(
                        'method'
                    )
                ||
                'POST'
            )
                .toUpperCase();

        return {

            sourceUrl,

            action,

            method,

            form,

            zipGradeId:
                clean(
                    zipInput.value
                ),

            externalId:
                clean(
                    external?.value
                    ||
                    ''
                ),

            firstName:
                clean(
                    first?.value
                    ||
                    ''
                ),

            lastNameRaw:
                last?.value
                ??
                '',

            lastName:
                visualValue(
                    last?.value
                    ??
                    ''
                ),

            classes,

            original: {

                zipGradeId:
                    clean(
                        zipInput.value
                    ),

                externalId:
                    clean(
                        external?.value
                        ||
                        ''
                    ),

                firstName:
                    clean(
                        first?.value
                        ||
                        ''
                    ),

                lastNameRaw:
                    last?.value
                    ??
                    '',

                classValues:
                    classes
                        .filter(
                            item =>
                                item.checked
                        )
                        .map(
                            item =>
                                item.value
                        )
                        .sort()
            }
        };
    }

    function getControlLabel(
        doc,
        input
    ) {

        if (
            input.id
        ) {

            const label =
                doc
                    .querySelector(
                        `label[for="${
                            cssEscape(
                                input.id
                            )
                        }"]`
                    );

            if (label) {
                return clean(
                    label
                        .textContent
                );
            }
        }

        const wrapping =
            input
                .closest(
                    'label'
                );

        if (wrapping) {
            return clean(
                wrapping
                    .textContent
            );
        }

        const parentText =
            clean(
                input
                    .parentElement
                    ?.textContent
                ||
                ''
            );

        if (parentText) {
            return parentText;
        }

        return clean(
            input
                .closest(
                    'tr,li,.checkbox,.form-group'
                )
                ?.textContent
            ||
            ''
        );
    }

    function renderStudentEditor(
        state,
        $,
        detail
    ) {

        const student =
            state.current;

        const isVisualBlank =
            isVisuallyBlank(
                detail
                    .lastNameRaw
            );

        const filteredIndex =
            state.filtered
                .findIndex(
                    item =>
                        item.href ===
                        student.href
                );

        $('managerMain')
            .innerHTML =
                `
<div class="zgm-editor">

<div class="zgm-editor-head">

<div>

<h3>
    ${
        esc(
            clean(
                `${
                    detail.firstName
                } ${
                    detail.lastName
                }`
            )
            ||
            detail.zipGradeId
        )
    }
</h3>

<div class="zg-muted">
    ${esc(
        student.href
    )}
</div>

</div>

<div
    id="${APP}-dirtyWrap"
></div>

</div>

<div class="zg-card">

<div class="zgm-form-grid">

<div>

<label class="zg-label">
    ${esc(
        t(
            'studentId'
        )
    )}
</label>

<input
    id="${APP}-editId"
    class="zg-input"
    inputmode="numeric"
    value="${
        escAttr(
            detail.zipGradeId
        )
    }"
>

<div
    id="${APP}-idHint"
    class="zg-muted"
    style="margin-top:5px"
></div>

</div>

<div>

<label class="zg-label">
    ${esc(
        t(
            'external'
        )
    )}
</label>

<input
    id="${APP}-editExternal"
    class="zg-input"
    value="${
        escAttr(
            detail.externalId
        )
    }"
>

</div>

<div>

<label class="zg-label">
    ${esc(
        t(
            'firstName'
        )
    )}
</label>

<input
    id="${APP}-editFirst"
    class="zg-input"
    value="${
        escAttr(
            detail.firstName
        )
    }"
>

</div>

<div>

<label class="zg-label">
    ${esc(
        t(
            'lastName'
        )
    )}
</label>

<input
    id="${APP}-editLast"
    class="zg-input"
    value="${
        escAttr(
            detail.lastName
        )
    }"
    ${
        isVisualBlank
            ? 'disabled'
            : ''
    }
>

<label
    class="zg-checkline"
    style="margin-top:8px"
>

<input
    id="${APP}-editBlankLast"
    type="checkbox"
    ${
        isVisualBlank
            ? 'checked'
            : ''
    }
>

<span>
    ${esc(
        t(
            'useBlankLast'
        )
    )}
</span>

</label>

</div>

<div class="zgm-field-full">

<label class="zg-label">
    ${esc(
        t(
            'classes'
        )
    )}
</label>

<div
    id="${APP}-classGrid"
    class="zgm-class-grid"
>

${
    detail.classes
        .length

        ? detail.classes
            .map(
                item => `
<label class="zgm-class">

<input
    type="checkbox"
    class="${APP}-classCheck"
    value="${
        escAttr(
            item.value
        )
    }"
    ${
        item.checked
            ? 'checked'
            : ''
    }
>

<span>
    ${esc(
        item.label
    )}
</span>

</label>
`
            )
            .join('')

        : `
<div class="zg-muted">
    ${esc(
        t(
            'noClasses'
        )
    )}
</div>
`
}

</div>

</div>

</div>

<div
    id="${APP}-editorStatus"
    class="zgm-status"
></div>

<div class="zg-actions">

<button
    id="${APP}-saveStudent"
    class="zg-btn zg-primary"
    type="button"
>
    ${esc(
        t(
            'save'
        )
    )}
</button>

<button
    id="${APP}-reloadStudent"
    class="zg-btn zg-secondary"
    type="button"
>
    ${esc(
        t(
            'reloadData'
        )
    )}
</button>

<a
    class="zg-btn zg-secondary"
    style="text-decoration:none"
    href="${
        escAttr(
            student.href
        )
    }"
    target="_blank"
    rel="noopener noreferrer"
>
    ${esc(
        t(
            'openOriginal'
        )
    )}
</a>

</div>

<div class="zgm-nav">

<button
    id="${APP}-prevStudent"
    class="zg-btn zg-secondary"
    type="button"
    ${
        filteredIndex <=
        0
            ? 'disabled'
            : ''
    }
>
    ${esc(
        t(
            'previous'
        )
    )}
</button>

<button
    id="${APP}-nextStudent"
    class="zg-btn zg-secondary"
    type="button"
    ${
        filteredIndex <
        0
        ||
        filteredIndex >=
        state.filtered
            .length -
        1
            ? 'disabled'
            : ''
    }
>
    ${esc(
        t(
            'next'
        )
    )}
</button>

</div>

</div>

</div>
`;

        const markDirty =
            () => {

                state.dirty =
                    computeEditorDirty(
                        state,
                        $
                    );

                renderDirtyIndicator(
                    state,
                    $
                );

                renderLeadingZeroHint(
                    $
                );
            };

        [
            'editId',
            'editExternal',
            'editFirst',
            'editLast'
        ]
            .forEach(
                id => {

                    $(id)
                        .addEventListener(
                            'input',
                            markDirty
                        );
                }
            );

        $('editBlankLast')
            .onchange =
                () => {

                    $('editLast')
                        .disabled =
                            $('editBlankLast')
                                .checked;

                    if (
                        $('editBlankLast')
                            .checked
                    ) {
                        $('editLast')
                            .value =
                                '';
                    }

                    markDirty();
                };

        overlayQueryAll(
            $,
            `.${APP}-classCheck`
        )
            .forEach(
                checkbox => {

                    checkbox
                        .addEventListener(
                            'change',
                            markDirty
                        );
                }
            );

        $('saveStudent')
            .onclick =
                () =>
                    saveCurrentStudent(
                        state,
                        $
                    );

        $('reloadStudent')
            .onclick =
                () => {

                    if (
                        state.dirty
                        &&
                        !confirm(
                            t(
                                'unsaved'
                            )
                        )
                    ) {
                        return;
                    }

                    navigateToStudent(
                        state,
                        $,
                        state.current
                    );
                };

        $('prevStudent')
            .onclick =
                () => {

                    const index =
                        state.filtered
                            .findIndex(
                                item =>
                                    item.href ===
                                    state.current
                                        .href
                            );

                    if (
                        index >
                        0
                    ) {
                        navigateToStudent(
                            state,
                            $,
                            state.filtered[
                                index -
                                1
                            ]
                        );
                    }
                };

        $('nextStudent')
            .onclick =
                () => {

                    const index =
                        state.filtered
                            .findIndex(
                                item =>
                                    item.href ===
                                    state.current
                                        .href
                            );

                    if (
                        index >=
                        0
                        &&
                        index <
                        state.filtered
                            .length -
                        1
                    ) {
                        navigateToStudent(
                            state,
                            $,
                            state.filtered[
                                index +
                                1
                            ]
                        );
                    }
                };

        renderDirtyIndicator(
            state,
            $
        );

        renderLeadingZeroHint(
            $
        );
    }

    function overlayQueryAll(
        $,
        selector
    ) {

        const main =
            $('managerMain');

        return main
            ? [
                ...main
                    .querySelectorAll(
                        selector
                    )
            ]
            : [];
    }

    function renderDirtyIndicator(
        state,
        $
    ) {

        const wrap =
            $('dirtyWrap');

        if (!wrap) {
            return;
        }

        wrap.innerHTML =
            state.dirty
                ? `
<span class="zgm-dirty">
    ${esc(
        t(
            'dirty'
        )
    )}
</span>
`
                : '';
    }

    function renderLeadingZeroHint(
        $
    ) {

        const id =
            clean(
                $('editId')
                    ?.value
                ||
                ''
            );

        const hint =
            $('idHint');

        if (!hint) {
            return;
        }

        const hasZero =
            /^0\d+$/
                .test(
                    toEnglishDigits(
                        id
                    )
                );

        hint.textContent =
            hasZero
                ? t(
                    'idLeadingZeroEdit'
                )
                : '';

        hint.style.color =
            hasZero
                ? '#92400e'
                : '';
    }

    function computeEditorDirty(
        state,
        $
    ) {

        if (
            !state.detail
        ) {
            return false;
        }

        const values =
            getEditorValues(
                $
            );

        const original =
            state.detail
                .original;

        return (
            values.zipGradeId !==
                original.zipGradeId

            ||

            values.externalId !==
                original.externalId

            ||

            values.firstName !==
                original.firstName

            ||

            values.lastNameRaw !==
                original.lastNameRaw

            ||

            !arraysEqual(
                values.classValues
                    .slice()
                    .sort(),
                original.classValues
                    .slice()
                    .sort()
            )
        );
    }

    function getEditorValues(
        $
    ) {

        const blankLast =
            Boolean(
                $('editBlankLast')
                    ?.checked
            );

        const classValues =
            overlayQueryAll(
                $,
                `.${APP}-classCheck`
            )
                .filter(
                    checkbox =>
                        checkbox.checked
                )
                .map(
                    checkbox =>
                        checkbox.value
                );

        return {

            zipGradeId:
                normalizeStudentId(
                    $('editId')
                        ?.value
                    ||
                    ''
                ),

            externalId:
                clean(
                    $('editExternal')
                        ?.value
                    ||
                    ''
                ),

            firstName:
                clean(
                    $('editFirst')
                        ?.value
                    ||
                    ''
                ),

            lastNameRaw:
                blankLast
                    ? INVISIBLE_LAST_NAME
                    : String(
                        $('editLast')
                            ?.value
                        ??
                        ''
                    ).trim(),

            blankLast,

            classValues
        };
    }

    async function saveCurrentStudent(
        state,
        $
    ) {

        if (
            !state.detail
            ||
            !state.current
            ||
            state.saveInProgress
        ) {
            return;
        }

        const values =
            getEditorValues(
                $
            );

        const status =
            $('editorStatus');

        if (
            !values.zipGradeId
            ||
            !/^\d+$/
                .test(
                    values.zipGradeId
                )
        ) {

            setEditorStatus(
                status,
                t(
                    'invalidId'
                ),
                'error'
            );

            return;
        }

        if (
            !values.firstName
        ) {

            setEditorStatus(
                status,
                t(
                    'requiredName'
                ),
                'error'
            );

            return;
        }

        if (
            !values.blankLast
            &&
            !clean(
                values
                    .lastNameRaw
            )
        ) {

            setEditorStatus(
                status,
                t(
                    'requiredLast'
                ),
                'error'
            );

            return;
        }

        if (
            !state.dirty
        ) {

            setEditorStatus(
                status,
                t(
                    'noChanges'
                ),
                'info'
            );

            return;
        }

        if (
            values.zipGradeId !==
            state.detail
                .original
                .zipGradeId
        ) {

            const proceed =
                confirm(
                    t(
                        'idChangeWarning',
                        {
                            old:
                                state.detail
                                    .original
                                    .zipGradeId,

                            new:
                                values
                                    .zipGradeId
                        }
                    )
                );

            if (!proceed) {
                return;
            }
        }

        state.saveInProgress =
            true;

        $('saveStudent')
            .disabled =
                true;

        $('saveStudent')
            .textContent =
                t(
                    'saving'
                );

        setEditorStatus(
            status,
            t(
                'saving'
            ),
            'info'
        );

        try {

            const params =
                formToUrlSearchParams(
                    state.detail
                        .form
                );

            params.delete(
                'zipGradeId'
            );

            params.delete(
                'externalId'
            );

            params.delete(
                'firstName'
            );

            params.delete(
                'lastName'
            );

            params.delete(
                'classList'
            );

            params.append(
                'zipGradeId',
                values
                    .zipGradeId
            );

            params.append(
                'externalId',
                values
                    .externalId
            );

            params.append(
                'firstName',
                values
                    .firstName
            );

            params.append(
                'lastName',
                values
                    .lastNameRaw
            );

            values.classValues
                .forEach(
                    value =>
                        params.append(
                            'classList',
                            value
                        )
                );

            const response =
                await fetch(
                    state.detail
                        .action,
                    {
                        method:
                            state.detail
                                .method ===
                            'GET'
                                ? 'POST'
                                : state.detail
                                    .method,

                        credentials:
                            'same-origin',

                        redirect:
                            'follow',

                        headers: {
                            'Content-Type':
                                'application/x-www-form-urlencoded;charset=UTF-8',

                            'Accept':
                                'text/html,application/xhtml+xml'
                        },

                        body:
                            params
                                .toString()
                    }
                );

            if (
                !response.ok
            ) {
                throw new Error(
                    `HTTP ${
                        response.status
                    }`
                );
            }

            let verifiedDetail =
                null;

            const responseText =
                await response
                    .text();

            if (
                responseText
            ) {

                const doc =
                    new DOMParser()
                        .parseFromString(
                            responseText,
                            'text/html'
                        );

                verifiedDetail =
                    parseStudentDetailDocument(
                        doc,
                        response.url
                        ||
                        state.current
                            .href
                    );
            }

            if (
                !verifiedDetail
            ) {

                verifiedDetail =
                    await fetchStudentDetail(
                        state.current
                            .href
                    );
            }

            if (
                !verifySavedValues(
                    verifiedDetail,
                    values
                )
            ) {

                throw new Error(
                    t(
                        'verifyFailed'
                    )
                );
            }

            state.detail =
                verifiedDetail;

            state.dirty =
                false;

            updateStudentListRecord(
                state.current,
                verifiedDetail
            );

            updateOriginalTableRow(
                state.current,
                verifiedDetail
            );

            state.current
                .searchText =
                    canonical(
                        `${
                            state.current
                                .zipGradeId
                        } ${
                            state.current
                                .externalId
                        } ${
                            state.current
                                .firstName
                        } ${
                            state.current
                                .lastName
                        } ${
                            state.current
                                .classesText
                        }`
                    );

            const currentSearch =
                $('managerSearch')
                    ?.value
                ||
                '';

            applyManagerFilter(
                state,
                $,
                currentSearch
            );

            renderStudentEditor(
                state,
                $,
                verifiedDetail
            );

            const freshStatus =
                $('editorStatus');

            if (
                freshStatus
            ) {
                setEditorStatus(
                    freshStatus,
                    t(
                        'saved'
                    ),
                    'success'
                );
            }
        }
        catch (
            error
        ) {

            setEditorStatus(
                status,
                `${
                    t(
                        'saveFailed'
                    )
                } ${
                    error?.message
                    ||
                    error
                }`,
                'error'
            );
        }
        finally {

            state.saveInProgress =
                false;

            if (
                $('saveStudent')
            ) {

                $('saveStudent')
                    .disabled =
                        false;

                $('saveStudent')
                    .textContent =
                        t(
                            'save'
                        );
            }
        }
    }

    function setEditorStatus(
        element,
        text,
        type = 'info'
    ) {

        if (!element) {
            return;
        }

        element.textContent =
            text;

        element.style.color =
            type ===
            'error'
                ? '#991b1b'
                : type ===
                'success'
                    ? '#166534'
                    : '#475569';

        element.style
            .fontWeight =
                (
                    type ===
                    'error'
                    ||
                    type ===
                    'success'
                )
                    ? '700'
                    : '400';
    }

    function formToUrlSearchParams(
        form
    ) {

        const params =
            new URLSearchParams();

        const controls =
            [
                ...form
                    .querySelectorAll(
                        'input,select,textarea'
                    )
            ];

        controls
            .forEach(
                control => {

                    const name =
                        control
                            .getAttribute(
                                'name'
                            );

                    if (
                        !name
                        ||
                        control.disabled
                    ) {
                        return;
                    }

                    const tag =
                        control
                            .tagName
                            .toLowerCase();

                    const type =
                        (
                            control
                                .getAttribute(
                                    'type'
                                )
                            ||
                            ''
                        )
                            .toLowerCase();

                    if (
                        [
                            'submit',
                            'button',
                            'reset',
                            'file',
                            'image'
                        ]
                            .includes(
                                type
                            )
                    ) {
                        return;
                    }

                    if (
                        (
                            type ===
                            'checkbox'
                            ||
                            type ===
                            'radio'
                        )
                        &&
                        !control.checked
                    ) {
                        return;
                    }

                    if (
                        tag ===
                        'select'
                        &&
                        control.multiple
                    ) {

                        [
                            ...control
                                .selectedOptions
                        ]
                            .forEach(
                                option =>
                                    params
                                        .append(
                                            name,
                                            option.value
                                        )
                            );

                        return;
                    }

                    params.append(
                        name,
                        control.value
                        ??
                        ''
                    );
                }
            );

        return params;
    }

    function verifySavedValues(
        detail,
        values
    ) {

        if (!detail) {
            return false;
        }

        const actualClasses =
            detail.classes
                .filter(
                    item =>
                        item.checked
                )
                .map(
                    item =>
                        item.value
                )
                .sort();

        const wantedClasses =
            values.classValues
                .slice()
                .sort();

        const lastOkay =
            values.blankLast

                ? isVisuallyBlank(
                    detail
                        .lastNameRaw
                )

                : clean(
                    detail
                        .lastNameRaw
                ) ===
                clean(
                    values
                        .lastNameRaw
                );

        return (
            normalizeStudentId(
                detail.zipGradeId
            ) ===
            normalizeStudentId(
                values.zipGradeId
            )

            &&

            clean(
                detail.externalId
            ) ===
            clean(
                values.externalId
            )

            &&

            clean(
                detail.firstName
            ) ===
            clean(
                values.firstName
            )

            &&

            lastOkay

            &&

            arraysEqual(
                actualClasses,
                wantedClasses
            )
        );
    }

    function updateStudentListRecord(
        student,
        detail
    ) {

        student.zipGradeId =
            detail.zipGradeId;

        student.externalId =
            detail.externalId;

        student.firstName =
            detail.firstName;

        student.lastName =
            visualValue(
                detail.lastNameRaw
            );

        student.classesText =
            detail.classes
                .filter(
                    item =>
                        item.checked
                )
                .map(
                    item =>
                        item.label
                )
                .join(
                    ', '
                );
    }

    function updateOriginalTableRow(
        student,
        detail
    ) {

        const {
            cells,
            indexes
        } =
            student;

        if (
            !cells
            ||
            !indexes
        ) {
            return;
        }

        if (
            indexes.id >=
            0
            &&
            cells[
                indexes.id
            ]
        ) {
            cells[
                indexes.id
            ]
                .textContent =
                    detail.zipGradeId;
        }

        if (
            indexes.external >=
            0
            &&
            cells[
                indexes.external
            ]
        ) {
            cells[
                indexes.external
            ]
                .textContent =
                    detail.externalId;
        }

        if (
            indexes.first >=
            0
            &&
            cells[
                indexes.first
            ]
        ) {
            cells[
                indexes.first
            ]
                .textContent =
                    detail.firstName;
        }

        if (
            indexes.last >=
            0
            &&
            cells[
                indexes.last
            ]
        ) {
            cells[
                indexes.last
            ]
                .textContent =
                    visualValue(
                        detail.lastNameRaw
                    );
        }

        if (
            indexes.classes >=
            0
            &&
            cells[
                indexes.classes
            ]
        ) {

            cells[
                indexes.classes
            ]
                .textContent =
                    detail.classes
                        .filter(
                            item =>
                                item.checked
                        )
                        .map(
                            item =>
                                item.label
                        )
                        .join(
                            ', '
                        );
        }
    }

    function arraysEqual(
        first,
        second
    ) {

        if (
            first.length !==
            second.length
        ) {
            return false;
        }

        for (
            let i = 0;
            i <
            first.length;
            i++
        ) {

            if (
                String(
                    first[i]
                ) !==
                String(
                    second[i]
                )
            ) {
                return false;
            }
        }

        return true;
    }

    function visualValue(
        value
    ) {

        return isVisuallyBlank(
            value
        )
            ? ''
            : clean(
                value
            );
    }

    function isVisuallyBlank(
        value
    ) {

        return !String(
            value
            ??
            ''
        )
            .replace(
                /[\s\u200B\u200C\u200D\u2060\uFEFF]/g,
                ''
            );
    }

    /* =========================================================
       Smart Import
       ========================================================= */

    function openImporter() {

        document
            .getElementById(
                `${APP}-overlay`
            )
            ?.remove();

        const overlay =
            document
                .createElement(
                    'div'
                );

        overlay.id =
            `${APP}-overlay`;

        overlay.innerHTML =
            importerHtml();

        document.body
            .appendChild(
                overlay
            );

        wireImporter(
            overlay
        );
    }

    function importerHtml() {

        const dir =
            lang ===
            'ar'
                ? 'rtl'
                : 'ltr';

        return `
<section
    id="${APP}-modal"
    dir="${dir}"
>

<header id="${APP}-head">

<div>

<h2>
    ${esc(
        t(
            'title'
        )
    )}
</h2>

<p>
    ${esc(
        t(
            'subtitle'
        )
    )}
</p>

</div>

<div class="zg-head-actions">

<button
    id="${APP}-aboutBtn"
    class="zg-head-btn"
    type="button"
>
    ${esc(
        t(
            'about'
        )
    )}
</button>

<button
    id="${APP}-lang"
    class="zg-head-btn"
    type="button"
>
    ${esc(
        t(
            'lang'
        )
    )}
</button>

<button
    id="${APP}-close"
    class="zg-head-btn zg-x"
    type="button"
>
    ×
</button>

</div>

</header>

<div id="${APP}-body">

<div class="zg-grid">

<div class="zg-card">

<h3>
    ${esc(
        t(
            'chooseFile'
        )
    )}
</h3>

<input
    id="${APP}-file"
    class="zg-input"
    type="file"
    accept=".xlsx,.xls,.csv,.txt"
>

<div
    class="zg-muted"
    style="margin-top:7px"
>
    ${esc(
        t(
            'fileHint'
        )
    )}
</div>

</div>

<div class="zg-card">

<h3>
    ${esc(
        t(
            'sheetHeader'
        )
    )}
</h3>

<label class="zg-label">
    ${esc(
        t(
            'sheet'
        )
    )}
</label>

<select
    id="${APP}-sheet"
    class="zg-input"
    disabled
>
    <option>
        —
    </option>
</select>

<label class="zg-label">
    ${esc(
        t(
            'headerRow'
        )
    )}
</label>

<input
    id="${APP}-header"
    class="zg-input"
    type="number"
    min="1"
    value="1"
    disabled
>

</div>

<div
    id="${APP}-mappingCard"
    class="zg-card zg-wide"
    style="display:none"
>

<h3>
    ${esc(
        t(
            'mapping'
        )
    )}
</h3>

<div class="zg-notice zg-info">
    ${esc(
        t(
            'mappingHint'
        )
    )}
</div>

<div
    id="${APP}-mapping"
></div>

</div>

<div
    id="${APP}-reviewCard"
    class="zg-card zg-wide"
    style="display:none"
>

<h3>
    ${esc(
        t(
            'review'
        )
    )}
</h3>

<div
    id="${APP}-summary"
></div>

<div
    id="${APP}-preview"
></div>

<div class="zg-actions">

<button
    id="${APP}-prepare"
    class="zg-btn zg-primary"
    type="button"
>
    ${esc(
        t(
            'prepare'
        )
    )}
</button>

<button
    id="${APP}-cancel"
    class="zg-btn zg-secondary"
    type="button"
>
    ${esc(
        t(
            'cancel'
        )
    )}
</button>

</div>

</div>

</div>

${rightsFooter()}

</div>

</section>

${aboutHtml(dir)}
`;
    }

    function rightsFooter() {

        const author =
            `${DEVELOPER.name} (${DEVELOPER.handle})`;

        return `
<footer class="zg-footer">

<span>

<strong>
    ${
        esc(
            t(
                'rights',
                {
                    author,
                    v:
                        VERSION
                }
            )
        )
    }
</strong>

<br>

${esc(
    DEVELOPER
        .copyright
)}

·

${esc(
    t(
        'independent'
    )
)}

</span>

<span>

<a
    href="${DEVELOPER.greasyFork}"
    target="_blank"
    rel="noopener noreferrer"
>
    GreasyFork
</a>

·

<a
    href="${DEVELOPER.x}"
    target="_blank"
    rel="noopener noreferrer"
>
    X @${esc(
        DEVELOPER
            .handle
    )}
</a>

·

<a
    href="${DEVELOPER.snapchat}"
    target="_blank"
    rel="noopener noreferrer"
>
    Snapchat
</a>

</span>

</footer>
`;
    }

    function aboutHtml(
        dir
    ) {

        return `
<div
    id="${APP}-about"
    class="zg-about"
    dir="${dir}"
    hidden
>

<div class="zg-about-card">

<div class="zg-about-top">

<h3>
    ${esc(
        t(
            'aboutTitle'
        )
    )}
</h3>

<div>
    v${VERSION}
</div>

</div>

<div class="zg-about-body">

<div>
    ${esc(
        t(
            'aboutText'
        )
    )}
</div>

<div class="zg-identity">

<strong>
    ${esc(
        DEVELOPER
            .name
    )}
    (
    ${esc(
        DEVELOPER
            .handle
    )}
    )
</strong>

<br>

${esc(
    DEVELOPER
        .copyright
)}

</div>

<div class="zg-links">

<a
    href="${DEVELOPER.greasyFork}"
    target="_blank"
    rel="noopener noreferrer"
>
    GreasyFork
</a>

<a
    href="${DEVELOPER.x}"
    target="_blank"
    rel="noopener noreferrer"
>
    X / Twitter
</a>

<a
    href="${DEVELOPER.snapchat}"
    target="_blank"
    rel="noopener noreferrer"
>
    Snapchat
</a>

</div>

<div
    class="zg-muted"
    style="margin-top:13px"
>
    ${esc(
        t(
            'rightsNotice'
        )
    )}
</div>

</div>

<div class="zg-about-bottom">

<button
    id="${APP}-aboutClose"
    class="zg-btn zg-primary"
    type="button"
>
    ${esc(
        t(
            'close'
        )
    )}
</button>

</div>

</div>

</div>
`;
    }

    function wireImporter(
        overlay
    ) {

        const $ =
            name =>
                overlay
                    .querySelector(
                        `#${APP}-${name}`
                    );

        const ui = {

            file:
                $('file'),

            sheet:
                $('sheet'),

            header:
                $('header'),

            mappingCard:
                $('mappingCard'),

            mapping:
                $('mapping'),

            reviewCard:
                $('reviewCard'),

            summary:
                $('summary'),

            preview:
                $('preview'),

            prepare:
                $('prepare')
        };

        let workbook =
            null;

        let rows =
            [];

        $('close')
            .onclick =
                $('cancel')
                    .onclick =
                        () =>
                            overlay
                                .remove();

        $('aboutBtn')
            .onclick =
                () => {

                    $('about')
                        .hidden =
                            false;
                };

        $('aboutClose')
            .onclick =
                () => {

                    $('about')
                        .hidden =
                            true;
                };

        $('about')
            .onclick =
                event => {

                    if (
                        event.target ===
                        $('about')
                    ) {
                        $('about')
                            .hidden =
                                true;
                    }
                };

        $('lang')
            .onclick =
                () => {

                    setLanguage(
                        lang ===
                        'ar'
                            ? 'en'
                            : 'ar'
                    );

                    overlay
                        .remove();

                    const importButton =
                        document
                            .getElementById(
                                `${APP}-launch`
                            );

                    const managerButton =
                        document
                            .getElementById(
                                `${APP}-managerLaunch`
                            );

                    if (
                        importButton
                    ) {
                        importButton
                            .textContent =
                                t(
                                    'smartImport'
                                );
                    }

                    if (
                        managerButton
                    ) {
                        managerButton
                            .textContent =
                                t(
                                    'studentManager'
                                );
                    }

                    openImporter();
                };

        overlay
            .onclick =
                event => {

                    if (
                        event.target ===
                        overlay
                    ) {
                        overlay
                            .remove();
                    }
                };

        ui.file
            .onchange =
                async () => {

                    const file =
                        ui.file
                            .files
                            ?.[0];

                    if (!file) {
                        return;
                    }

                    try {

                        workbook =
                            XLSX.read(
                                await file
                                    .arrayBuffer(),
                                {
                                    type:
                                        'array',

                                    cellDates:
                                        false,

                                    cellNF:
                                        true
                                }
                            );

                        ui.sheet
                            .innerHTML =
                                workbook
                                    .SheetNames
                                    .map(
                                        (
                                            name,
                                            index
                                        ) =>
                                            `
<option
    value="${index}"
>
    ${esc(name)}
</option>
`
                                    )
                                    .join('');

                        ui.sheet
                            .disabled =
                                false;

                        ui.header
                            .disabled =
                                false;

                        loadSheet(
                            true
                        );
                    }
                    catch (
                        error
                    ) {

                        alert(
                            `${
                                t(
                                    'readFail'
                                )
                            }\n${
                                error?.message
                                ||
                                error
                            }`
                        );
                    }
                };

        ui.sheet
            .onchange =
                () =>
                    loadSheet(
                        true
                    );

        ui.header
            .onchange =
                renderMapping;

        ui.header
            .oninput =
                debounce(
                    renderMapping,
                    180
                );

        ui.prepare
            .onclick =
                () => {

                    const result =
                        buildData();

                    if (!result) {
                        return;
                    }

                    if (
                        result.errors
                            .length
                    ) {
                        return alert(
                            t(
                                'fix',
                                {
                                    n:
                                        result.errors
                                            .length
                                }
                            )
                        );
                    }

                    if (
                        !result.rows
                            .length
                    ) {
                        return alert(
                            t(
                                'noValid'
                            )
                        );
                    }

                    writeState({

                        version:
                            7,

                        phase:
                            'prepared',

                        lang,

                        csv:
                            result.csv,

                        count:
                            result.rows
                                .length,

                        sampleIds:
                            result.rows
                                .slice(
                                    0,
                                    5
                                )
                                .map(
                                    row =>
                                        row.finalStudentId
                                ),

                        hasClass:
                            result.hasClass,

                        createdAt:
                            Date.now()
                    });

                    location.href =
                        '/importStudents?zgSmartImport=1';
                };

        function loadSheet(
            auto
        ) {

            if (!workbook) {
                return;
            }

            const name =
                workbook
                    .SheetNames[
                        Number(
                            ui.sheet
                                .value
                        )
                        ||
                        0
                    ];

            rows =
                XLSX.utils
                    .sheet_to_json(
                        workbook
                            .Sheets[
                                name
                            ],
                        {
                            header:
                                1,

                            raw:
                                false,

                            defval:
                                '',

                            blankrows:
                                false
                        }
                    );

            if (auto) {
                ui.header
                    .value =
                        detectHeaderRow(
                            rows
                        )
                        +
                        1;
            }

            renderMapping();
        }

        function renderMapping() {

            if (
                !rows.length
            ) {
                return;
            }

            const headerIndex =
                clamp(
                    (
                        Number(
                            ui.header
                                .value
                        )
                        ||
                        1
                    )
                    -
                    1,
                    0,
                    rows.length -
                    1
                );

            const headers =
                (
                    rows[
                        headerIndex
                    ]
                    ||
                    []
                )
                    .map(
                        (
                            value,
                            index
                        ) => ({
                            index,

                            name:
                                clean(
                                    value
                                )
                                ||
                                `Column ${
                                    columnLetter(
                                        index
                                    )
                                }`
                        })
                    );

            if (
                !headers.length
            ) {
                return;
            }

            ui.mappingCard
                .style
                .display =
                    '';

            ui.reviewCard
                .style
                .display =
                    '';

            const old =
                {};

            ui.mapping
                .querySelectorAll(
                    'select[data-key]'
                )
                .forEach(
                    select => {

                        old[
                            select
                                .dataset
                                .key
                        ] =
                            select
                                .value;
                    }
                );

            const oldBlank =
                ui.mapping
                    .querySelector(
                        `#${APP}-blankLast`
                    )
                    ?.checked;

            const oldPolicy =
                ui.mapping
                    .querySelector(
                        `#${APP}-idPolicy`
                    )
                    ?.value;

            const options =
                key => {

                    const selected =
                        old[
                            key
                        ]
                        ??
                        guessColumn(
                            key,
                            headers
                        );

                    return [
                        `
<option value="">
    ${
        esc(
            t(
                'notUsed'
            )
        )
    }
</option>
`
                    ]
                        .concat(
                            headers
                                .map(
                                    header =>
                                        `
<option
    value="${
        header.index
    }"
    ${
        String(
            header.index
        ) ===
        String(
            selected
        )
            ? 'selected'
            : ''
    }
>
    ${
        columnLetter(
            header.index
        )
    }
    —
    ${
        esc(
            header.name
        )
    }
</option>
`
                                )
                        )
                        .join('');
                };

            const row =
                (
                    key,
                    label,
                    required =
                        false
                ) =>
                    `
<div class="zg-map">

<div>

<b>
    ${esc(label)}
</b>

${
    required
        ? `
<span
    style="color:#b91c1c"
>
    *
</span>
`
        : ''
}

</div>

<select
    class="zg-input"
    data-key="${key}"
>
    ${options(key)}
</select>

</div>
`;

            ui.mapping
                .innerHTML =
                    `
${row(
    'studentId',
    t(
        'studentId'
    ),
    true
)}

${row(
    'externalId',
    t(
        'external'
    )
)}

${row(
    'firstName',
    t(
        'firstName'
    ),
    true
)}

<div class="zg-map">

<div>

<b>
    ${esc(
        t(
            'lastName'
        )
    )}
</b>

</div>

<div>

<label class="zg-checkline">

<input
    id="${APP}-blankLast"
    type="checkbox"
    ${
        oldBlank ===
        false
            ? ''
            : 'checked'
    }
>

<span>
    ${esc(
        t(
            'blankLast'
        )
    )}
</span>

</label>

<div
    class="zg-muted"
    style="margin:5px 0 8px"
>
    ${esc(
        t(
            'blankLastHint'
        )
    )}
</div>

<select
    id="${APP}-lastSelect"
    class="zg-input"
    data-key="lastName"
>
    ${options(
        'lastName'
    )}
</select>

</div>

</div>

${row(
    'className',
    t(
        'className'
    )
)}

<div class="zg-map">

<div>

<b>
    ${esc(
        t(
            'idPolicy'
        )
    )}
</b>

</div>

<div>

<select
    id="${APP}-idPolicy"
    class="zg-input"
>

<option
    value="block"
    ${
        (
            oldPolicy
            ||
            'block'
        ) ===
        'block'
            ? 'selected'
            : ''
    }
>
    ${esc(
        t(
            'policyBlock'
        )
    )}
</option>

<option
    value="strip"
    ${
        oldPolicy ===
        'strip'
            ? 'selected'
            : ''
    }
>
    ${esc(
        t(
            'policyStrip'
        )
    )}
</option>

<option
    value="prefix"
    ${
        oldPolicy ===
        'prefix'
            ? 'selected'
            : ''
    }
>
    ${esc(
        t(
            'policyPrefix'
        )
    )}
</option>

</select>

<div
    class="zg-muted"
    style="margin-top:6px"
>
    ${esc(
        t(
            'policyHint'
        )
    )}
</div>

</div>

</div>
`;

            const blank =
                ui.mapping
                    .querySelector(
                        `#${APP}-blankLast`
                    );

            const last =
                ui.mapping
                    .querySelector(
                        `#${APP}-lastSelect`
                    );

            const sync =
                () => {

                    last.disabled =
                        blank.checked;

                    last.style.opacity =
                        blank.checked
                            ? '.55'
                            : '1';

                    renderReview();
                };

            blank
                .onchange =
                    sync;

            ui.mapping
                .querySelectorAll(
                    'select'
                )
                .forEach(
                    select => {

                        select.onchange =
                            renderReview;
                    }
                );

            sync();
        }

        function buildData() {

            if (
                !rows.length
            ) {
                return null;
            }

            const headerIndex =
                clamp(
                    (
                        Number(
                            ui.header
                                .value
                        )
                        ||
                        1
                    )
                    -
                    1,
                    0,
                    rows.length -
                    1
                );

            const map =
                {};

            ui.mapping
                .querySelectorAll(
                    'select[data-key]'
                )
                .forEach(
                    select => {

                        map[
                            select
                                .dataset
                                .key
                        ] =
                            select.value ===
                            ''
                                ? null
                                : Number(
                                    select.value
                                );
                    }
                );

            const blankLast =
                ui.mapping
                    .querySelector(
                        `#${APP}-blankLast`
                    )
                    ?.checked
                ??
                true;

            const policy =
                ui.mapping
                    .querySelector(
                        `#${APP}-idPolicy`
                    )
                    ?.value
                ||
                'block';

            const errors =
                [];

            const warnings =
                [];

            const output =
                [];

            if (
                map.studentId ==
                null
            ) {

                errors.push(
                    t(
                        'requiredField',
                        {
                            field:
                                t(
                                    'studentId'
                                )
                        }
                    )
                );
            }

            if (
                map.firstName ==
                null
            ) {

                errors.push(
                    t(
                        'requiredField',
                        {
                            field:
                                t(
                                    'firstName'
                                )
                        }
                    )
                );
            }

            if (
                !blankLast
                &&
                map.lastName ==
                null
            ) {

                errors.push(
                    t(
                        'requiredField',
                        {
                            field:
                                t(
                                    'lastName'
                                )
                        }
                    )
                );
            }

            if (
                errors.length
            ) {

                return {

                    errors,

                    warnings,

                    rows:
                        [],

                    csv:
                        '',

                    stats: {
                        leading:
                            0,

                        lengths:
                            {}
                    },

                    hasClass:
                        false
                };
            }

            const seenIds =
                new Map();

            const seenEmails =
                new Map();

            const lengths =
                {};

            let leading =
                0;

            for (
                let i =
                    headerIndex +
                    1;
                i <
                rows.length;
                i++
            ) {

                const source =
                    rows[i]
                    ||
                    [];

                const originalStudentId =
                    normalizeStudentId(
                        source[
                            map.studentId
                        ]
                    );

                const firstName =
                    clean(
                        source[
                            map.firstName
                        ]
                    );

                const lastName =
                    blankLast
                        ? INVISIBLE_LAST_NAME
                        : clean(
                            source[
                                map.lastName
                            ]
                        );

                const externalId =
                    map.externalId ==
                    null
                        ? ''
                        : clean(
                            source[
                                map.externalId
                            ]
                        );

                const className =
                    map.className ==
                    null
                        ? ''
                        : clean(
                            source[
                                map.className
                            ]
                        );

                if (
                    !originalStudentId
                    &&
                    !firstName
                    &&
                    !externalId
                    &&
                    !className
                    &&
                    (
                        blankLast
                        ||
                        !lastName
                    )
                ) {
                    continue;
                }

                const rowNo =
                    i +
                    1;

                let bad =
                    false;

                let finalStudentId =
                    originalStudentId;

                if (
                    !originalStudentId
                ) {

                    errors.push(
                        t(
                            'idEmpty',
                            {
                                row:
                                    rowNo
                            }
                        )
                    );

                    bad =
                        true;
                }
                else if (
                    !/^\d+$/
                        .test(
                            originalStudentId
                        )
                ) {

                    errors.push(
                        t(
                            'idBad',
                            {
                                row:
                                    rowNo,

                                value:
                                    originalStudentId
                            }
                        )
                    );

                    bad =
                        true;
                }

                if (
                    !firstName
                ) {

                    errors.push(
                        t(
                            'nameEmpty',
                            {
                                row:
                                    rowNo
                            }
                        )
                    );

                    bad =
                        true;
                }

                if (
                    !blankLast
                    &&
                    !lastName
                ) {

                    errors.push(
                        t(
                            'lastEmpty',
                            {
                                row:
                                    rowNo
                            }
                        )
                    );

                    bad =
                        true;
                }

                if (
                    /^0\d+$/
                        .test(
                            originalStudentId
                        )
                ) {

                    leading++;

                    if (
                        policy ===
                        'block'
                    ) {

                        errors.push(
                            t(
                                'zeroBlocked',
                                {
                                    row:
                                        rowNo,

                                    id:
                                        originalStudentId
                                }
                            )
                        );

                        bad =
                            true;
                    }
                    else if (
                        policy ===
                        'strip'
                    ) {

                        finalStudentId =
                            originalStudentId
                                .replace(
                                    /^0+/,
                                    ''
                                )
                            ||
                            '0';

                        warnings.push(
                            t(
                                'zeroStrip',
                                {
                                    row:
                                        rowNo,

                                    old:
                                        originalStudentId,

                                    new:
                                        finalStudentId
                                }
                            )
                        );
                    }
                    else {

                        finalStudentId =
                            `9${originalStudentId}`;

                        if (
                            finalStudentId
                                .length >
                            11
                        ) {

                            errors.push(
                                t(
                                    'prefixLong',
                                    {
                                        row:
                                            rowNo,

                                        len:
                                            finalStudentId
                                                .length
                                    }
                                )
                            );

                            bad =
                                true;
                        }
                        else {

                            warnings.push(
                                t(
                                    'zeroPrefix',
                                    {
                                        row:
                                            rowNo,

                                        old:
                                            originalStudentId,

                                        new:
                                            finalStudentId
                                    }
                                )
                            );
                        }
                    }
                }

                if (
                    /^\d+$/
                        .test(
                            finalStudentId
                        )
                ) {

                    const len =
                        finalStudentId
                            .length;

                    lengths[
                        len
                    ] =
                        (
                            lengths[
                                len
                            ]
                            ||
                            0
                        )
                        +
                        1;

                    if (
                        len >
                        11
                    ) {

                        warnings.push(
                            t(
                                'tooLong',
                                {
                                    row:
                                        rowNo,

                                    len
                                }
                            )
                        );
                    }

                    if (
                        seenIds
                            .has(
                                finalStudentId
                            )
                    ) {

                        errors.push(
                            t(
                                'dupId',
                                {
                                    id:
                                        finalStudentId,

                                    a:
                                        seenIds
                                            .get(
                                                finalStudentId
                                            ),

                                    b:
                                        rowNo
                                }
                            )
                        );

                        bad =
                            true;
                    }
                    else {

                        seenIds.set(
                            finalStudentId,
                            rowNo
                        );
                    }
                }

                if (
                    externalId
                ) {

                    const email =
                        externalId
                            .toLowerCase();

                    if (
                        seenEmails
                            .has(
                                email
                            )
                    ) {

                        warnings.push(
                            t(
                                'dupEmail',
                                {
                                    a:
                                        seenEmails
                                            .get(
                                                email
                                            ),

                                    b:
                                        rowNo,

                                    value:
                                        externalId
                                }
                            )
                        );
                    }
                    else {

                        seenEmails.set(
                            email,
                            rowNo
                        );
                    }

                    if (
                        externalId
                            .includes(
                                '@'
                            )
                        &&
                        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/
                            .test(
                                externalId
                            )
                    ) {

                        warnings.push(
                            t(
                                'emailBad',
                                {
                                    row:
                                        rowNo,

                                    value:
                                        externalId
                                }
                            )
                        );
                    }
                }

                if (
                    map.className !=
                    null
                    &&
                    !className
                ) {

                    warnings.push(
                        t(
                            'classEmpty',
                            {
                                row:
                                    rowNo
                            }
                        )
                    );
                }

                if (!bad) {

                    output.push({

                        originalStudentId,

                        finalStudentId,

                        externalId,

                        firstName,

                        lastName,

                        className,

                        blankLast
                    });
                }
            }

            const lines = [
                'ZipGrade ID,External ID,First Name,Last Name,Class'
            ];

            output
                .forEach(
                    row => {

                        lines.push(
                            [
                                row
                                    .finalStudentId,

                                csvCell(
                                    row.externalId
                                ),

                                csvCell(
                                    row.firstName
                                ),

                                csvCell(
                                    row.lastName
                                ),

                                csvCell(
                                    row.className
                                )
                            ]
                                .join(
                                    ','
                                )
                        );
                    }
                );

            return {

                errors,

                warnings,

                rows:
                    output,

                csv:
                    lines
                        .join(
                            '\r\n'
                        ),

                stats: {
                    leading,
                    lengths
                },

                hasClass:
                    map.className !=
                    null
                    &&
                    output.some(
                        row =>
                            row.className
                    )
            };
        }

        function renderReview() {

            const result =
                buildData();

            if (!result) {
                return;
            }

            ui.prepare
                .disabled =
                    Boolean(
                        result.errors
                            .length
                    );

            const lengthBadges =
                Object
                    .entries(
                        result.stats
                            .lengths
                    )
                    .sort(
                        (
                            a,
                            b
                        ) =>
                            Number(
                                a[0]
                            )
                            -
                            Number(
                                b[0]
                            )
                    )
                    .map(
                        (
                            [
                                length,
                                count
                            ]
                        ) =>
                            `
<span class="zg-badge">
    ${length}
    digits:
    ${count}
</span>
`
                    )
                    .join('');

            ui.summary
                .innerHTML =
                    `
<div class="zg-stats">

<span class="zg-badge zg-ok">
    ${esc(
        t(
            'valid'
        )
    )}:
    ${
        result.rows
            .length
    }
</span>

<span
    class="zg-badge ${
        result.errors
            .length
            ? 'zg-err'
            : 'zg-ok'
    }"
>
    ${esc(
        t(
            'errors'
        )
    )}:
    ${
        result.errors
            .length
    }
</span>

<span
    class="zg-badge ${
        result.warnings
            .length
            ? 'zg-warn'
            : ''
    }"
>
    ${esc(
        t(
            'warnings'
        )
    )}:
    ${
        result.warnings
            .length
    }
</span>

<span
    class="zg-badge ${
        result.stats
            .leading
            ? 'zg-warn'
            : ''
    }"
>
    ${esc(
        t(
            'leading'
        )
    )}:
    ${
        result.stats
            .leading
    }
</span>

${lengthBadges}

</div>

${
    result.errors
        .length

        ? `
<div class="zg-notice zg-errorbox">

<b>
    ${esc(
        t(
            'errors'
        )
    )}:
</b>

<br>

${
    result.errors
        .slice(
            0,
            12
        )
        .map(
            esc
        )
        .join(
            '<br>'
        )
}

${
    result.errors
        .length >
    12

        ? `
<br>
… +${
    result.errors
        .length -
    12
}
`
        : ''
}

</div>
`
        : ''
}

${
    result.warnings
        .length

        ? `
<div class="zg-notice zg-warnbox">

<b>
    ${esc(
        t(
            'warnings'
        )
    )}:
</b>

<br>

${
    result.warnings
        .slice(
            0,
            10
        )
        .map(
            esc
        )
        .join(
            '<br>'
        )
}

${
    result.warnings
        .length >
    10

        ? `
<br>
… +${
    result.warnings
        .length -
    10
}
`
        : ''
}

</div>
`
        : ''
}
`;

            const previewRows =
                result.rows
                    .slice(
                        0,
                        12
                    );

            ui.preview
                .innerHTML =
                    `
<div class="zg-tablewrap">

<table class="zg-table">

<thead>

<tr>

<th>#</th>

<th>
    ${esc(
        t(
            'originalId'
        )
    )}
</th>

<th>
    ${esc(
        t(
            'finalId'
        )
    )}
</th>

<th>
    ${esc(
        t(
            'external'
        )
    )}
</th>

<th>
    ${esc(
        t(
            'firstName'
        )
    )}
</th>

<th>
    ${esc(
        t(
            'lastName'
        )
    )}
</th>

<th>
    ${esc(
        t(
            'className'
        )
    )}
</th>

</tr>

</thead>

<tbody>

${
    previewRows
        .length

        ? previewRows
            .map(
                (
                    row,
                    index
                ) =>
                    `
<tr>

<td>
    ${index + 1}
</td>

<td>
    ${
        esc(
            row.originalStudentId
        )
    }
</td>

<td>
    ${
        esc(
            row.finalStudentId
        )
    }
</td>

<td>
    ${
        esc(
            row.externalId
        )
    }
</td>

<td>
    ${
        esc(
            row.firstName
        )
    }
</td>

<td>
    ${
        row.blankLast
            ? esc(
                t(
                    'visuallyBlank'
                )
            )
            : esc(
                row.lastName
            )
    }
</td>

<td>
    ${
        esc(
            row.className
        )
    }
</td>

</tr>
`
            )
            .join('')

        : `
<tr>
<td colspan="7">
    ${esc(
        t(
            'noRows'
        )
    )}
</td>
</tr>
`
}

</tbody>

</table>

</div>

${
    result.rows
        .length >
    12

        ? `
<div
    class="zg-muted"
    style="margin-top:6px"
>
    ${
        esc(
            t(
                'previewMore',
                {
                    n:
                        result.rows
                            .length
                }
            )
        )
    }
</div>
`
        : ''
}
`;
        }
    }

    /* =========================================================
       ZipGrade import pages
       ========================================================= */

    async function initImportPage() {

        const state =
            readState();

        if (!state) {
            return;
        }

        if (
            state.lang ===
            'ar'
            ||
            state.lang ===
            'en'
        ) {
            setLanguage(
                state.lang
            );
        }

        if (
            state.phase ===
            'finishing'
            &&
            /student\(s\) were added|were added/i
                .test(
                    clean(
                        document.body
                            .innerText
                    )
                )
        ) {

            clearStoredState();

            return;
        }

        const upload =
            document
                .querySelector(
                    'input[type="file"][name="file"]'
                );

        const form =
            document
                .querySelector(
                    'form[action="/importStudents/finish"]'
                );

        if (
            upload
            &&
            state.phase ===
            'prepared'
        ) {

            showNative(
                `
<h3>
    ${esc(
        t(
            'ready'
        )
    )}
</h3>

<div>
    ${
        esc(
            t(
                'readyCount',
                {
                    n:
                        state.count
                }
            )
        )
    }
</div>

<div class="zg-notice zg-info">
    ${esc(
        t(
            'uploadInfo'
        )
    )}
</div>

<div class="zg-actions">

<button
    id="${APP}-upload"
    class="zg-btn zg-primary"
    type="button"
>
    ${esc(
        t(
            'upload'
        )
    )}
</button>

<button
    id="${APP}-clear"
    class="zg-btn zg-secondary"
    type="button"
>
    ${esc(
        t(
            'cancel'
        )
    )}
</button>

</div>
`
            );

            document
                .getElementById(
                    `${APP}-upload`
                )
                .onclick =
                    () =>
                        uploadCsv(
                            state,
                            upload
                        );

            document
                .getElementById(
                    `${APP}-clear`
                )
                .onclick =
                    clearState;

            return;
        }

        if (
            form
            &&
            [
                'submitting',
                'mapping'
            ]
                .includes(
                    state.phase
                )
        ) {

            state.phase =
                'mapping';

            writeState(
                state
            );

            await mapFinalFields(
                form,
                state
            );

            renderFinalPanel(
                form,
                state,
                verifyMapping(
                    form,
                    state
                )
            );

            return;
        }

        if (
            upload
            &&
            state.phase ===
            'submitting'
        ) {

            showNative(
                `
<h3>
    ${esc(
        t(
            'readFail'
        )
    )}
</h3>

<div class="zg-notice zg-errorbox">
    ${esc(
        t(
            'returned'
        )
    )}
</div>

<button
    id="${APP}-clear"
    class="zg-btn zg-secondary"
    type="button"
>
    ${esc(
        t(
            'cancel'
        )
    )}
</button>
`
            );

            document
                .getElementById(
                    `${APP}-clear`
                )
                .onclick =
                    clearState;
        }
    }

    function uploadCsv(
        state,
        input
    ) {

        try {

            const file =
                new File(
                    [
                        '\uFEFF'
                        +
                        state.csv
                    ],
                    `zipgrade_students_${Date.now()}.csv`,
                    {
                        type:
                            'text/csv;charset=utf-8'
                    }
                );

            const transfer =
                new DataTransfer();

            transfer.items
                .add(
                    file
                );

            input.files =
                transfer.files;

            input
                .dispatchEvent(
                    new Event(
                        'change',
                        {
                            bubbles:
                                true
                        }
                    )
                );

            const firstRowHeader =
                document
                    .querySelector(
                        'input[name="firstRowHeader"]'
                    );

            if (
                firstRowHeader
            ) {

                firstRowHeader
                    .checked =
                        true;

                firstRowHeader
                    .dispatchEvent(
                        new Event(
                            'change',
                            {
                                bubbles:
                                    true
                            }
                        )
                    );
            }

            state.phase =
                'submitting';

            writeState(
                state
            );

            const form =
                input
                    .closest(
                        'form'
                    );

            if (!form) {
                throw new Error(
                    'Upload form not found'
                );
            }

            if (
                typeof
                form.requestSubmit ===
                'function'
            ) {
                form.requestSubmit();
            }
            else {
                form.submit();
            }
        }
        catch (
            error
        ) {

            alert(
                `${
                    t(
                        'readFail'
                    )
                }\n${
                    error?.message
                    ||
                    error
                }`
            );
        }
    }

    async function mapFinalFields(
        form,
        state
    ) {

        selectCsvColumn(
            form
                .querySelector(
                    '#studentFirstNameField'
                ),
            'First Name',
            3
        );

        selectCsvColumn(
            form
                .querySelector(
                    '#studentLastNameField'
                ),
            'Last Name',
            4
        );

        selectCsvColumn(
            form
                .querySelector(
                    '#zipGradeIDField'
                ),
            'ZipGrade ID',
            1
        );

        selectCsvColumn(
            form
                .querySelector(
                    '#externalIDField'
                ),
            'External ID',
            2
        );

        const updateExisting =
            form
                .querySelector(
                    '#updateStudentNameField'
                );

        if (
            updateExisting
        ) {

            updateExisting
                .checked =
                    false;

            updateExisting
                .dispatchEvent(
                    new Event(
                        'change',
                        {
                            bubbles:
                                true
                        }
                    )
                );
        }

        const addExisting =
            form
                .querySelector(
                    '#addStudentToClassField'
                );

        if (
            addExisting
        ) {

            addExisting
                .checked =
                    false;

            addExisting
                .dispatchEvent(
                    new Event(
                        'change',
                        {
                            bubbles:
                                true
                        }
                    )
                );
        }

        if (
            state.hasClass
        ) {

            await mapClassFromImport(
                form
            );
        }
        else {

            await mapNoClass(
                form
            );
        }
    }

    async function mapClassFromImport(
        form
    ) {

        const mode =
            form
                .querySelector(
                    '#classOptionField'
                );

        if (!mode) {
            return false;
        }

        let option =
            [
                ...mode.options
            ]
                .find(
                    item =>
                        /place students into class by import field/i
                            .test(
                                clean(
                                    item.textContent
                                )
                            )
                );

        if (!option) {

            option =
                [
                    ...mode.options
                ]
                    .find(
                        item =>
                            /import\s*field/i
                                .test(
                                    clean(
                                        item.textContent
                                    )
                                )
                    );
        }

        if (!option) {
            return false;
        }

        setSelect(
            mode,
            option
        );

        await wait(
            180
        );

        let field =
            await waitForElement(
                '#classNameField',
                form,
                1400
            );

        if (!field) {
            return false;
        }

        let classOption =
            findCsvOption(
                field,
                'Class',
                5
            );

        if (!classOption) {
            return false;
        }

        setSelect(
            field,
            classOption
        );

        await wait(
            100
        );

        field =
            form
                .querySelector(
                    '#classNameField'
                );

        if (
            field
            &&
            !selectionIsColumn(
                field,
                'Class',
                5
            )
        ) {

            classOption =
                findCsvOption(
                    field,
                    'Class',
                    5
                );

            if (
                classOption
            ) {
                setSelect(
                    field,
                    classOption
                );
            }

            await wait(
                80
            );
        }

        return selectionIsColumn(
            form
                .querySelector(
                    '#classNameField'
                ),
            'Class',
            5
        );
    }

    async function mapNoClass(
        form
    ) {

        const mode =
            form
                .querySelector(
                    '#classOptionField'
                );

        if (!mode) {
            return false;
        }

        const option =
            [
                ...mode.options
            ]
                .find(
                    item =>
                        /do not|no class|without class|none/i
                            .test(
                                clean(
                                    item.textContent
                                )
                            )
                );

        if (!option) {
            return false;
        }

        setSelect(
            mode,
            option
        );

        await wait(
            80
        );

        return isNoClassMode(
            mode
        );
    }

    function verifyMapping(
        form,
        state
    ) {

        const checks = [

            {
                label:
                    t(
                        'studentId'
                    ),

                expected:
                    'ZipGrade ID',

                actual:
                    selectedText(
                        form
                            .querySelector(
                                '#zipGradeIDField'
                            )
                    ),

                ok:
                    selectionIsColumn(
                        form
                            .querySelector(
                                '#zipGradeIDField'
                            ),
                        'ZipGrade ID',
                        1
                    )
            },

            {
                label:
                    t(
                        'external'
                    ),

                expected:
                    'External ID',

                actual:
                    selectedText(
                        form
                            .querySelector(
                                '#externalIDField'
                            )
                    ),

                ok:
                    selectionIsColumn(
                        form
                            .querySelector(
                                '#externalIDField'
                            ),
                        'External ID',
                        2
                    )
            },

            {
                label:
                    t(
                        'firstName'
                    ),

                expected:
                    'First Name',

                actual:
                    selectedText(
                        form
                            .querySelector(
                                '#studentFirstNameField'
                            )
                    ),

                ok:
                    selectionIsColumn(
                        form
                            .querySelector(
                                '#studentFirstNameField'
                            ),
                        'First Name',
                        3
                    )
            },

            {
                label:
                    t(
                        'lastName'
                    ),

                expected:
                    'Last Name',

                actual:
                    selectedText(
                        form
                            .querySelector(
                                '#studentLastNameField'
                            )
                    ),

                ok:
                    selectionIsColumn(
                        form
                            .querySelector(
                                '#studentLastNameField'
                            ),
                        'Last Name',
                        4
                    )
            }
        ];

        if (
            state.hasClass
        ) {

            checks.push(

                {
                    label:
                        t(
                            'classMode'
                        ),

                    expected:
                        'Place students into class by import field',

                    actual:
                        selectedText(
                            form
                                .querySelector(
                                    '#classOptionField'
                                )
                        ),

                    ok:
                        isImportFieldMode(
                            form
                                .querySelector(
                                    '#classOptionField'
                                )
                        )
                },

                {
                    label:
                        t(
                            'classColumn'
                        ),

                    expected:
                        'Class',

                    actual:
                        selectedText(
                            form
                                .querySelector(
                                    '#classNameField'
                                )
                        ),

                    ok:
                        selectionIsColumn(
                            form
                                .querySelector(
                                    '#classNameField'
                                ),
                            'Class',
                            5
                        )
                }
            );
        }
        else {

            checks.push({

                label:
                    t(
                        'classMode'
                    ),

                expected:
                    t(
                        'noClass'
                    ),

                actual:
                    selectedText(
                        form
                            .querySelector(
                                '#classOptionField'
                            )
                    ),

                ok:
                    isNoClassMode(
                        form
                            .querySelector(
                                '#classOptionField'
                            )
                    )
            });
        }

        return {

            checks,

            ok:
                checks
                    .every(
                        item =>
                            item.ok
                    )
        };
    }

    function renderFinalPanel(
        form,
        state,
        verification
    ) {

        const rows =
            verification
                .checks
                .map(
                    check =>
                        `
<div class="zg-verify">

<span
    class="${
        check.ok
            ? 'zg-pass'
            : 'zg-fail'
    }"
>
    ${
        check.ok
            ? '✓'
            : '✗'
    }
</span>

<span>

<b>
    ${esc(
        check.label
    )}
</b>

←

${esc(
    check.actual
    ||
    '—'
)}

</span>

${
    check.ok
        ? ''
        : `
<span class="zg-muted">
    ${esc(
        t(
            'expected'
        )
    )}:
    ${esc(
        check.expected
    )}
</span>
`
}

</div>
`
                )
                .join('');

        const ids =
            (
                state.sampleIds
                ||
                []
            )
                .map(
                    esc
                )
                .join(
                    '<br>'
                );

        showNative(
            `
<h3>
    ${esc(
        t(
            'finalTitle'
        )
    )}
</h3>

<div
    class="zg-notice ${
        verification.ok
            ? 'zg-info'
            : 'zg-errorbox'
    }"
>
    ${
        esc(
            verification.ok
                ? t(
                    'allMapped'
                )
                : t(
                    'mapProblem'
                )
        )
    }
</div>

${rows}

${
    ids
        ? `
<div class="zg-notice zg-info">

<b>
    ${esc(
        t(
            'firstIds'
        )
    )}
</b>

<br>

${ids}

</div>
`
        : ''
}

<div class="zg-actions">

<button
    id="${APP}-recheck"
    class="zg-btn zg-secondary"
    type="button"
>
    ${esc(
        t(
            'recheck'
        )
    )}
</button>

<button
    id="${APP}-finish"
    class="zg-btn zg-primary"
    type="button"
    ${
        verification.ok
            ? ''
            : 'disabled'
    }
>
    ${esc(
        t(
            'finish'
        )
    )}
</button>

<button
    id="${APP}-clear"
    class="zg-btn zg-secondary"
    type="button"
>
    ${esc(
        t(
            'exit'
        )
    )}
</button>

</div>
`
        );

        document
            .getElementById(
                `${APP}-recheck`
            )
            .onclick =
                async () => {

                    await mapFinalFields(
                        form,
                        state
                    );

                    renderFinalPanel(
                        form,
                        state,
                        verifyMapping(
                            form,
                            state
                        )
                    );
                };

        document
            .getElementById(
                `${APP}-clear`
            )
            .onclick =
                clearState;

        document
            .getElementById(
                `${APP}-finish`
            )
            .onclick =
                async event => {

                    const button =
                        event
                            .currentTarget;

                    await mapFinalFields(
                        form,
                        state
                    );

                    const check =
                        verifyMapping(
                            form,
                            state
                        );

                    if (
                        !check.ok
                    ) {
                        return alert(
                            t(
                                'mappingBlocked'
                            )
                        );
                    }

                    if (
                        !confirm(
                            t(
                                'confirm',
                                {
                                    n:
                                        state.count
                                }
                            )
                        )
                    ) {
                        return;
                    }

                    state.phase =
                        'finishing';

                    writeState(
                        state
                    );

                    button.disabled =
                        true;

                    button.textContent =
                        t(
                            'importing'
                        );

                    if (
                        typeof
                        form.requestSubmit ===
                        'function'
                    ) {
                        form.requestSubmit();
                    }
                    else {
                        form.submit();
                    }
                };
    }

    function isImportFieldMode(
        select
    ) {

        if (!select) {
            return false;
        }

        const text =
            selectedText(
                select
            )
                .toLowerCase();

        return (
            text
                .includes(
                    'place students into class by import field'
                )
            ||
            (
                text
                    .includes(
                        'import field'
                    )
                &&
                text
                    .includes(
                        'class'
                    )
            )
        );
    }

    function isNoClassMode(
        select
    ) {

        if (!select) {
            return false;
        }

        return (
            /do not|no class|without class|none/
                .test(
                    selectedText(
                        select
                    )
                        .toLowerCase()
                )
        );
    }

    function selectCsvColumn(
        select,
        header,
        number
    ) {

        if (!select) {
            return false;
        }

        const option =
            findCsvOption(
                select,
                header,
                number
            );

        if (!option) {
            return false;
        }

        setSelect(
            select,
            option
        );

        return selectionIsColumn(
            select,
            header,
            number
        );
    }

    function findCsvOption(
        select,
        header,
        number
    ) {

        if (!select) {
            return null;
        }

        const options =
            [
                ...select.options
            ];

        const wanted =
            norm(
                header
            );

        return (
            options
                .find(
                    option =>
                        norm(
                            option
                                .textContent
                        ) ===
                        wanted
                )
            ||
            options
                .find(
                    option =>
                        norm(
                            option
                                .textContent
                        )
                            .includes(
                                wanted
                            )
                        &&
                        !isBlankOption(
                            option
                        )
                )
            ||
            options
                .find(
                    option =>
                        new RegExp(
                            `^field\\s*0*${number}(?:\\b|\\s|-)`,
                            'i'
                        )
                            .test(
                                clean(
                                    option
                                        .textContent
                                )
                            )
                )
            ||
            (
                options.length ===
                6
                    ? options[
                        number
                    ]
                    : null
            )
        );
    }

    function selectionIsColumn(
        select,
        header,
        number
    ) {

        const text =
            selectedText(
                select
            );

        if (!text) {
            return false;
        }

        const normalized =
            norm(
                text
            );

        const wanted =
            norm(
                header
            );

        return (
            normalized ===
            wanted
            ||
            normalized
                .includes(
                    wanted
                )
            ||
            new RegExp(
                `^field\\s*0*${number}(?:\\b|\\s|-)`,
                'i'
            )
                .test(
                    text
                )
        );
    }

    function setSelect(
        select,
        option
    ) {

        if (
            !select
            ||
            !option
        ) {
            return;
        }

        select.value =
            option.value;

        select
            .dispatchEvent(
                new Event(
                    'input',
                    {
                        bubbles:
                            true
                    }
                )
            );

        select
            .dispatchEvent(
                new Event(
                    'change',
                    {
                        bubbles:
                            true
                    }
                )
            );
    }

    function showNative(
        html
    ) {

        document
            .getElementById(
                `${APP}-native`
            )
            ?.remove();

        const panel =
            document
                .createElement(
                    'div'
                );

        panel.id =
            `${APP}-native`;

        panel.dir =
            lang ===
            'ar'
                ? 'rtl'
                : 'ltr';

        panel.innerHTML =
            `${
                html
            }${
                rightsFooter()
            }`;

        const anchor =
            document
                .querySelector(
                    'form'
                )
            ||
            document.body
                .firstElementChild;

        if (
            anchor
                ?.parentNode
        ) {

            anchor
                .parentNode
                .insertBefore(
                    panel,
                    anchor
                );
        }
        else {

            document.body
                .prepend(
                    panel
                );
        }
    }

    /* =========================================================
       State
       ========================================================= */

    function readState() {

        try {

            const state =
                JSON.parse(
                    sessionStorage
                        .getItem(
                            STATE_KEY
                        )
                    ||
                    'null'
                );

            if (!state) {
                return null;
            }

            if (
                Date.now()
                -
                Number(
                    state.createdAt
                    ||
                    0
                )
                >
                3600000
            ) {

                clearStoredState();

                return null;
            }

            return state;
        }
        catch (_) {
            return null;
        }
    }

    function writeState(
        state
    ) {

        sessionStorage
            .setItem(
                STATE_KEY,
                JSON.stringify(
                    state
                )
            );
    }

    function clearStoredState() {

        sessionStorage
            .removeItem(
                STATE_KEY
            );
    }

    function clearState() {

        clearStoredState();

        document
            .getElementById(
                `${APP}-native`
            )
            ?.remove();
    }

    /* =========================================================
       Import helpers
       ========================================================= */

    function detectHeaderRow(
        rows
    ) {

        let best = {
            index:
                0,

            score:
                -Infinity
        };

        for (
            let i = 0;
            i <
            Math.min(
                rows.length,
                15
            );
            i++
        ) {

            const values =
                (
                    rows[i]
                    ||
                    []
                )
                    .map(
                        clean
                    )
                    .filter(
                        Boolean
                    );

            if (
                !values.length
            ) {
                continue;
            }

            let score =
                Math.min(
                    values.length,
                    12
                )
                -
                i *
                .15;

            for (
                const value
                of values
            ) {

                const normalized =
                    norm(
                        value
                    );

                for (
                    const list
                    of
                    Object.values(
                        HINTS
                    )
                ) {

                    if (
                        list
                            .some(
                                hint =>
                                    normalized
                                        .includes(
                                            norm(
                                                hint
                                            )
                                        )
                            )
                    ) {
                        score +=
                            3;
                    }
                }
            }

            if (
                score >
                best.score
            ) {

                best = {
                    index:
                        i,

                    score
                };
            }
        }

        return best.index;
    }

    function guessColumn(
        key,
        headers
    ) {

        const hints =
            HINTS[
                key
            ]
            ||
            [];

        let best = {
            index:
                '',

            score:
                0
        };

        for (
            const header
            of headers
        ) {

            const name =
                norm(
                    header.name
                );

            let score =
                0;

            for (
                const hint
                of hints
            ) {

                const wanted =
                    norm(
                        hint
                    );

                if (
                    name ===
                    wanted
                ) {

                    score =
                        Math.max(
                            score,
                            100
                        );
                }
                else if (
                    name
                        .includes(
                            wanted
                        )
                    ||
                    wanted
                        .includes(
                            name
                        )
                ) {

                    score =
                        Math.max(
                            score,
                            Math.min(
                                90,
                                50
                                +
                                wanted.length
                            )
                        );
                }
            }

            if (
                score >
                best.score
            ) {

                best = {
                    index:
                        header.index,

                    score
                };
            }
        }

        return (
            best.score >=
            50
        )
            ? String(
                best.index
            )
            : '';
    }

    /* =========================================================
       Generic helpers
       ========================================================= */

    function normalizeStudentId(
        value
    ) {

        let text =
            toEnglishDigits(
                clean(
                    value
                )
            )
                .replace(
                    /[\s,،']/g,
                    ''
                );

        if (
            /^\d+\.0+$/
                .test(
                    text
                )
        ) {

            text =
                text.replace(
                    /\.0+$/,
                    ''
                );
        }

        if (
            /^[+-]?\d+(?:\.\d+)?[eE][+-]?\d+$/
                .test(
                    text
                )
        ) {

            const number =
                Number(
                    text
                );

            if (
                Number
                    .isSafeInteger(
                        number
                    )
                &&
                number >=
                0
            ) {

                text =
                    String(
                        number
                    );
            }
        }

        return text;
    }

    function toEnglishDigits(
        value
    ) {

        const arabic =
            '٠١٢٣٤٥٦٧٨٩';

        const persian =
            '۰۱۲۳۴۵۶۷۸۹';

        return String(
            value
        )
            .replace(
                /[٠-٩]/g,
                digit =>
                    arabic
                        .indexOf(
                            digit
                        )
            )
            .replace(
                /[۰-۹]/g,
                digit =>
                    persian
                        .indexOf(
                            digit
                        )
            );
    }

    function clean(
        value
    ) {

        return (
            value ==
            null
        )
            ? ''
            : String(
                value
            )
                .replace(
                    /\u00a0/g,
                    ' '
                )
                .replace(
                    /[\r\n\t]+/g,
                    ' '
                )
                .replace(
                    /\s+/g,
                    ' '
                )
                .trim();
    }

    function canonical(
        value
    ) {

        return clean(
            value
        )
            .toLowerCase()
            .replace(
                /[ًٌٍَُِّْـ]/g,
                ''
            )
            .replace(
                /[أإآ]/g,
                'ا'
            )
            .replace(
                /ة/g,
                'ه'
            )
            .replace(
                /ى/g,
                'ي'
            )
            .replace(
                /[؟?!.،,:：;؛()\[\]{}"']/g,
                ''
            )
            .replace(
                /\s+/g,
                ' '
            )
            .trim();
    }

    function norm(
        value
    ) {

        return canonical(
            value
        );
    }

    function selectedText(
        select
    ) {

        return clean(
            select
                ?.selectedOptions
                ?.[0]
                ?.textContent
            ||
            ''
        );
    }

    function isBlankOption(
        option
    ) {

        const text =
            clean(
                option
                    ?.textContent
            )
                .toLowerCase();

        return (
            !text
            ||
            text ===
            '-'
            ||
            text ===
            '--'
            ||
            text.includes(
                'select'
            )
            ||
            text.includes(
                'none'
            )
        );
    }

    function csvCell(
        value
    ) {

        return `"${String(
            value
            ??
            ''
        )
            .replace(
                /"/g,
                '""'
            )}"`;
    }

    function esc(
        value
    ) {

        return String(
            value
            ??
            ''
        )
            .replace(
                /[&<>"']/g,
                character =>
                    ({
                        '&':
                            '&amp;',

                        '<':
                            '&lt;',

                        '>':
                            '&gt;',

                        '"':
                            '&quot;',

                        "'":
                            '&#039;'
                    })[
                        character
                    ]
            );
    }

    function escAttr(
        value
    ) {

        return esc(
            value
        )
            .replace(
                /`/g,
                '&#096;'
            );
    }

    function clamp(
        number,
        min,
        max
    ) {

        return Math.min(
            max,
            Math.max(
                min,
                number
            )
        );
    }

    function wait(
        milliseconds
    ) {

        return new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    milliseconds
                )
        );
    }

    async function waitForElement(
        selector,
        root =
            document,
        timeout =
            1500
    ) {

        const start =
            Date.now();

        while (
            Date.now()
            -
            start
            <
            timeout
        ) {

            const element =
                root
                    .querySelector(
                        selector
                    );

            if (
                element
            ) {
                return element;
            }

            await wait(
                50
            );
        }

        return null;
    }

    function columnLetter(
        index
    ) {

        let number =
            index +
            1;

        let result =
            '';

        while (
            number
        ) {

            number--;

            result =
                String
                    .fromCharCode(
                        65
                        +
                        number %
                        26
                    )
                +
                result;

            number =
                Math.floor(
                    number /
                    26
                );
        }

        return result;
    }

    function debounce(
        func,
        delay
    ) {

        let timer;

        return (
            ...args
        ) => {

            clearTimeout(
                timer
            );

            timer =
                setTimeout(
                    () =>
                        func(
                            ...args
                        ),
                    delay
                );
        };
    }

    function cssEscape(
        value
    ) {

        if (
            window.CSS
                ?.escape
        ) {
            return CSS.escape(
                value
            );
        }

        return String(
            value
        )
            .replace(
                /([ #;?%&,.+*~\\':"!^$\[\]()=>|\/@])/g,
                '\\$1'
            );
    }

    console.log(
        '%cZipGrade Smart Student Manager',
        'font-size:18px;font-weight:800;color:#087f83'
    );

    console.log(
        `Version: ${VERSION}`
    );

    console.log(
        `Designed & Developed by ${DEVELOPER.name} (${DEVELOPER.handle})`
    );

    console.log(
        DEVELOPER
            .copyright
    );

})();

// ==UserScript==
// @name         Microsoft Forms - عارض المرفقات والتصحيح السريع
// @namespace    https://greasyfork.org/users/1636459
// @version      1.3.3
// @description  بيئة تصحيح مرفقات Microsoft Forms مع مرجع قابل لتغيير الحجم، تصحيح تراكمي سريع، اختصارات تعمل مع العربية والإنجليزية، تنقل سريع بين ملفات الطالب، تجاوز المصححين، عداد غير المصححين، التكبير والسحب والتدوير.
// @author       Mohammed Almalki (M0HM3D85)
// @homepageURL  https://greasyfork.org/en/users/1636459-m0hm3d85
// @supportURL   https://github.com/M0HM3D85/teacher-userscripts/issues
// @copyright    2026, Mohammed Almalki (M0HM3D85)
// @license      All Rights Reserved
// @match        https://forms.cloud.microsoft/Pages/DesignPageV2.aspx*
// @match        https://forms.office.com/Pages/DesignPageV2.aspx*
// @match        https://forms.microsoft.com/Pages/DesignPageV2.aspx*
// @run-at       document-idle
// @grant        none
// @downloadURL https://update.greasyfork.org/scripts/595568/Microsoft%20Forms%20-%20%D8%B9%D8%A7%D8%B1%D8%B6%20%D8%A7%D9%84%D9%85%D8%B1%D9%81%D9%82%D8%A7%D8%AA%20%D9%88%D8%A7%D9%84%D8%AA%D8%B5%D8%AD%D9%8A%D8%AD%20%D8%A7%D9%84%D8%B3%D8%B1%D9%8A%D8%B9.user.js
// @updateURL https://update.greasyfork.org/scripts/595568/Microsoft%20Forms%20-%20%D8%B9%D8%A7%D8%B1%D8%B6%20%D8%A7%D9%84%D9%85%D8%B1%D9%81%D9%82%D8%A7%D8%AA%20%D9%88%D8%A7%D9%84%D8%AA%D8%B5%D8%AD%D9%8A%D8%AD%20%D8%A7%D9%84%D8%B3%D8%B1%D9%8A%D8%B9.meta.js
// ==/UserScript==

/*
=========================================================================
 Microsoft Forms - عارض المرفقات والتصحيح السريع

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

    /* =========================================================
       Microsoft Forms - Attachment Reviewer
       Version 1.3.3

       Developer:
       Mohammed Almalki (M0HM3D85)

       © 2026 Mohammed Almalki (M0HM3D85)
       جميع الحقوق محفوظة
       ========================================================= */

    const VERSION = '1.3.3';

    const DEVELOPER = Object.freeze({
        name: 'Mohammed Almalki',
        handle: 'M0HM3D85',
        greasyFork: 'https://greasyfork.org/en/users/1636459-m0hm3d85',
        copyright: '© 2026 Mohammed Almalki (M0HM3D85) — جميع الحقوق محفوظة'
    });

    const APP_ID = 'm0hm3d85-forms-attachment-reviewer';
    const STYLE_ID = APP_ID + '-style';
    const LAUNCHER_ID = APP_ID + '-launcher';
    const LAUNCHER_STYLE_ID = LAUNCHER_ID + '-style';

    const SKIP_STORAGE_KEY = 'M0HM3D85_FORMS_ATTACHMENT_SKIP_GRADED_V1';
    const SPLIT_STORAGE_KEY = 'M0HM3D85_FORMS_ATTACHMENT_REFERENCE_WIDTH_V1';

    const REFERENCE_DB_NAME = 'M0HM3D85_FORMS_ATTACHMENT_REVIEWER_DB';
    const REFERENCE_DB_VERSION = 1;
    const REFERENCE_STORE = 'questionReferences';

    const GRADE_SELECTOR = [
        'input[type="number"][placeholder="النقاط"]',
        'input[type="number"][aria-label*="النقاط"]'
    ].join(',');

    const IMAGE_EXTS = new Set([
        'jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg'
    ]);

    const PDF_EXTS = new Set(['pdf']);

    const state = {
        questions: [],
        questionIndex: 0,
        fileIndex: 0,

        zoom: 1,
        rotation: 0,
        flipX: 1,
        flipY: 1,
        panX: 0,
        panY: 0,

        dragging: false,
        dragPointerId: null,
        dragStartX: 0,
        dragStartY: 0,
        dragStartPanX: 0,
        dragStartPanY: 0,

        imageToken: 0,
        navigatingStudent: false,
        open: false,

        /* التصحيح التراكمي السريع */
        gradeHistoryContext: '',
        gradeHistory: [],

        skipGraded: readSkipPreference(),

        /* عرض مرن بين المرجع وإجابة الطالب */
        referencePanePercent: readSplitPreference(),
        resizingSplit: false,
        splitPointerId: null,

        /* عداد الطلاب غير المصححين */
        countingUnreviewed: false,
        unreviewedCount: null,
        countedStudents: null,
        unreviewedStatusMap: new Map(),
        unreviewedCountFormKey: '',

        referenceVisible: true,
        referenceMode: 'original',
        referenceRecord: null,
        referenceLoadedKey: '',
        referenceObjectURL: '',
        referenceToken: 0,
        referenceNotesTimer: null,

        refZoom: 1,
        refRotation: 0,
        refPanX: 0,
        refPanY: 0,
        refDragging: false,
        refDragPointerId: null,
        refDragStartX: 0,
        refDragStartY: 0,
        refDragStartPanX: 0,
        refDragStartPanY: 0
    };

    let launcherTimer = null;

    /* =========================================================
       أدوات عامة
       ========================================================= */

    const clean = (value = '') =>
        String(value ?? '')
            .replace(/\s+/g, ' ')
            .trim();

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function escapeHTML(value = '') {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function normalizeDigits(value = '') {
        return String(value)
            .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
            .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)));
    }

    function readSkipPreference() {
        try {
            return localStorage.getItem(SKIP_STORAGE_KEY) === '1';
        }
        catch (_) {
            return false;
        }
    }

    function writeSkipPreference(enabled) {
        try {
            localStorage.setItem(SKIP_STORAGE_KEY, enabled ? '1' : '0');
        }
        catch (_) {}
    }

    function readSplitPreference() {
        try {
            const value = Number(localStorage.getItem(SPLIT_STORAGE_KEY));

            if (Number.isFinite(value)) {
                return Math.min(78, Math.max(22, value));
            }
        }
        catch (_) {}

        return 50;
    }

    function writeSplitPreference(value) {
        try {
            localStorage.setItem(
                SPLIT_STORAGE_KEY,
                String(Math.round(value * 10) / 10)
            );
        }
        catch (_) {}
    }

    function hashString(value = '') {
        let hash = 2166136261;

        for (let index = 0; index < value.length; index++) {
            hash ^= value.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }

        return (hash >>> 0).toString(16);
    }

    function getFormStorageKey() {
        try {
            const url = new URL(location.href);

            return (
                url.searchParams.get('id') ||
                url.searchParams.get('formId') ||
                `${url.origin}${url.pathname}`
            );
        }
        catch (_) {
            return location.origin + location.pathname;
        }
    }

    function buildQuestionStorageKey(question, index = 0) {
        const number = question?.questionNumber ?? index + 1;
        const title = clean(question?.title || 'سؤال رفع ملف');

        return [
            getFormStorageKey(),
            `q:${number}`,
            hashString(title)
        ].join('::');
    }

    function openReferenceDB() {
        return new Promise((resolve, reject) => {
            if (!('indexedDB' in window)) {
                reject(new Error('IndexedDB غير مدعوم في هذا المتصفح.'));
                return;
            }

            const request = indexedDB.open(
                REFERENCE_DB_NAME,
                REFERENCE_DB_VERSION
            );

            request.onupgradeneeded = () => {
                const db = request.result;

                if (!db.objectStoreNames.contains(REFERENCE_STORE)) {
                    const store = db.createObjectStore(
                        REFERENCE_STORE,
                        { keyPath: 'key' }
                    );

                    store.createIndex(
                        'formKey',
                        'formKey',
                        { unique: false }
                    );
                }
            };

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(
                request.error || new Error('تعذر فتح قاعدة بيانات مرجع التصحيح.')
            );
        });
    }

    async function readReferenceRecord(key) {
        if (!key) {
            return null;
        }

        const db = await openReferenceDB();

        try {
            return await new Promise((resolve, reject) => {
                const tx = db.transaction(
                    REFERENCE_STORE,
                    'readonly'
                );

                const request = tx
                    .objectStore(REFERENCE_STORE)
                    .get(key);

                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => reject(request.error);
            });
        }
        finally {
            db.close();
        }
    }

    async function writeReferenceRecord(record) {
        const db = await openReferenceDB();

        try {
            await new Promise((resolve, reject) => {
                const tx = db.transaction(
                    REFERENCE_STORE,
                    'readwrite'
                );

                tx.objectStore(REFERENCE_STORE).put(record);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
                tx.onabort = () => reject(tx.error);
            });
        }
        finally {
            db.close();
        }

        return record;
    }

    async function deleteReferenceRecord(key) {
        if (!key) {
            return;
        }

        const db = await openReferenceDB();

        try {
            await new Promise((resolve, reject) => {
                const tx = db.transaction(
                    REFERENCE_STORE,
                    'readwrite'
                );

                tx.objectStore(REFERENCE_STORE).delete(key);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
                tx.onabort = () => reject(tx.error);
            });
        }
        finally {
            db.close();
        }
    }

    function revokeReferenceObjectURL() {
        if (!state.referenceObjectURL) {
            return;
        }

        try {
            URL.revokeObjectURL(state.referenceObjectURL);
        }
        catch (_) {}

        state.referenceObjectURL = '';
    }

    function getExtension(url = '') {
        try {
            const pathname = decodeURIComponent(
                new URL(url, location.href).pathname
            );

            const match = pathname.match(/\.([a-zA-Z0-9]+)$/);

            return match
                ? match[1].toLowerCase()
                : '';
        }
        catch (_) {
            return '';
        }
    }

    function getFileName(link) {
        const visible = clean(
            link?.innerText ||
            link?.textContent
        );

        if (visible) {
            return visible;
        }

        try {
            return decodeURIComponent(
                new URL(link.href)
                    .pathname
                    .split('/')
                    .pop() ||
                'ملف مرفق'
            );
        }
        catch (_) {
            return 'ملف مرفق';
        }
    }

    function hasRecordedGrade(value) {
        /*
        مهم:
        الدرجة 0 تعتبر درجة مرصودة بالفعل.
        الذي يعتبر غير مصحح فقط هو الحقل الفارغ.
        */
        return clean(value) !== '';
    }

    /* =========================================================
       شاشة المراجعة + مكان زر التشغيل
       ========================================================= */

    function isReviewPage() {
        return !!(
            document.querySelector('button[aria-label="الشخص السابق"]') ||
            document.querySelector('button[aria-label="الشخص التالي"]')
        );
    }

    function findReviewToolbarTarget() {
        const buttons = [...document.querySelectorAll('button')];

        const reviewNext = buttons.find(
            button => clean(button.textContent) === 'مراجعة التالي'
        );

        if (reviewNext?.parentElement) {
            return {
                container: reviewNext.parentElement,
                anchor: reviewNext
            };
        }

        const backButton = buttons.find(
            button => button.getAttribute('aria-label') === 'رجوع'
        );

        const nav = backButton?.closest('[role="navigation"]');

        if (nav) {
            return {
                container:
                    nav.querySelector('div > div') ||
                    nav.querySelector('div') ||
                    nav,
                anchor: null
            };
        }

        return null;
    }

    /* =========================================================
       بيانات الطالب
       ========================================================= */

    function getStudentName() {
        const studentButton = [...document.querySelectorAll('button')]
            .find(button => {
                const text = clean(button.innerText);
                const aria = clean(button.getAttribute('aria-label'));

                return (
                    text &&
                    text.length < 150 &&
                    /الوقت للانتهاء/i.test(aria)
                );
            });

        if (studentButton) {
            return clean(studentButton.innerText);
        }

        const grade = [...document.querySelectorAll(GRADE_SELECTOR)]
            .find(input =>
                /إدخال نقاط لإجابة/.test(
                    input.getAttribute('aria-label') || ''
                )
            );

        if (grade) {
            const aria = grade.getAttribute('aria-label') || '';
            const match = aria.match(/إجابة\s+(.+?)\s+على\s+السؤال/);

            if (match) {
                return clean(match[1]);
            }
        }

        return 'المستجيب';
    }

    function getRespondentNumber() {
        return clean(
            document.querySelector('input[aria-label="المستجيب"]')?.value || ''
        );
    }

    /* =========================================================
       بنية أسئلة المرفقات
       ========================================================= */

    function findQuestionBlock(questionContent) {
        let node = questionContent;

        while (node && node !== document.body) {
            const contents = [
                ...node.querySelectorAll(
                    '[data-automation-id="questionContent"]'
                )
            ];

            const grades = [
                ...node.querySelectorAll(GRADE_SELECTOR)
            ];

            if (
                contents.includes(questionContent) &&
                grades.length === 1
            ) {
                return node;
            }

            node = node.parentElement;
        }

        return null;
    }

    function isUploadQuestion(content, block) {
        const wrapper = block?.querySelector(
            'button[data-automation-id="questionWrapper"]'
        );

        const text = [
            content?.innerText,
            content?.textContent,
            wrapper?.getAttribute('aria-label'),
            block?.innerText
        ]
            .filter(Boolean)
            .join(' ');

        return /تحميل ملف|رفع ملف|رفع صورة|إرفاق ملف|إرفاق صورة/i.test(text);
    }

    function getQuestionTitle(content) {
        const element = content?.querySelector(
            '[data-automation-id="questionTitle"]'
        );

        let text = clean(
            element?.innerText ||
            element?.textContent ||
            ''
        );

        text = text
            .replace(/مطلوب الإجابة\.?/g, '')
            .replace(/تحميل ملف\.?/g, '');

        return clean(text);
    }

    function getQuestionNumber(title) {
        const match = normalizeDigits(title).match(/^\s*(\d+)/);

        return match
            ? Number(match[1])
            : null;
    }

    function getMaxPoints(block) {
        const text = normalizeDigits(
            clean(block?.innerText)
        );

        const matches = [
            ...text.matchAll(
                /\/\s*([0-9]+(?:[.,][0-9]+)?)\s*من\s*النقاط/g
            )
        ];

        if (matches.length) {
            return matches[matches.length - 1][1]
                .replace(',', '.');
        }

        const fallback = text.match(
            /([0-9]+(?:[.,][0-9]+)?)\s*من\s*النقاط/
        );

        return fallback
            ? fallback[1].replace(',', '.')
            : '';
    }

    function getFiles(content) {
        const links = [
            ...content.querySelectorAll('a[href]')
        ];

        const files = [];

        for (const link of links) {
            let url = '';

            try {
                url = new URL(link.href, location.href).href;
            }
            catch (_) {
                continue;
            }

            const ext = getExtension(url);

            const looksLikeFile =
                ext ||
                /sharepoint\.com|onedrive/i.test(url);

            if (!looksLikeFile) {
                continue;
            }

            files.push({
                link,
                url,
                fileName: getFileName(link),
                ext
            });
        }

        const seen = new Set();

        return files.filter(file => {
            if (seen.has(file.url)) {
                return false;
            }

            seen.add(file.url);
            return true;
        });
    }

    function getOriginalQuestionText(content) {
        if (!content) {
            return '';
        }

        const clone = content.cloneNode(true);

        clone.querySelectorAll(
            'a,button,input,textarea,select,svg,[data-automation-id="questionTitle"]'
        ).forEach(element => element.remove());

        let text = clean(clone.textContent || '');

        text = text
            .replace(/مطلوب الإجابة\.?/g, '')
            .replace(/تحميل ملف\.?/g, '')
            .replace(/رفع ملف\.?/g, '');

        return clean(text);
    }

    function getOriginalQuestionImages(content) {
        if (!content) {
            return [];
        }

        const images = [];
        const seen = new Set();

        for (const image of content.querySelectorAll('img[src]')) {
            const src = image.currentSrc || image.src || '';

            if (!src || seen.has(src)) {
                continue;
            }

            const rect = image.getBoundingClientRect();
            const width = image.naturalWidth || rect.width || 0;
            const height = image.naturalHeight || rect.height || 0;

            /*
            نتجنب الأيقونات الصغيرة. صور السؤال الفعلية غالباً أكبر بوضوح.
            */
            if (width && height && width < 80 && height < 80) {
                continue;
            }

            seen.add(src);

            images.push({
                src,
                alt: clean(image.alt || 'صورة مرفقة بأصل السؤال')
            });
        }

        return images;
    }

    function scanUploadQuestions() {
        const contents = [
            ...document.querySelectorAll(
                '[data-automation-id="questionContent"]'
            )
        ];

        const result = [];
        const seen = new Set();

        for (const content of contents) {
            const block = findQuestionBlock(content);

            if (
                !block ||
                seen.has(block)
            ) {
                continue;
            }

            if (!isUploadQuestion(content, block)) {
                continue;
            }

            seen.add(block);

            const title = getQuestionTitle(content);
            const gradeInput = block.querySelector(GRADE_SELECTOR);

            result.push({
                block,
                content,
                title,
                questionNumber: getQuestionNumber(title),
                gradeInput,
                grade: gradeInput?.value ?? '',
                maxPoints: getMaxPoints(block),
                files: getFiles(content),
                originalText: getOriginalQuestionText(content),
                originalImages: getOriginalQuestionImages(content)
            });
        }

        result.sort((a, b) => {
            if (
                a.questionNumber !== null &&
                b.questionNumber !== null
            ) {
                return a.questionNumber - b.questionNumber;
            }

            return 0;
        });

        result.forEach((question, index) => {
            question.storageKey = buildQuestionStorageKey(question, index);
        });

        return result;
    }

    /* =========================================================
       من يحتاج التصحيح؟
       ========================================================= */

    function isQuestionReviewed(question) {
        /*
        إذا لم يوجد ملف في السؤال، فلا يوجد مرفق يحتاج تصحيحاً.
        إذا وجد ملف، فالدرجة غير الفارغة تعني أن السؤال تم تصحيحه.
        الصفر محسوب كدرجة مرصودة.
        */
        if (!question?.files?.length) {
            return true;
        }

        const liveValue = question.gradeInput?.value ?? question.grade ?? '';

        return hasRecordedGrade(liveValue);
    }

    function getPendingQuestionIndexes(questions = scanUploadQuestions()) {
        const pending = [];

        questions.forEach((question, index) => {
            if (
                question.files.length > 0 &&
                !isQuestionReviewed(question)
            ) {
                pending.push(index);
            }
        });

        return pending;
    }

    function studentNeedsAttachmentReview(questions = scanUploadQuestions()) {
        return getPendingQuestionIndexes(questions).length > 0;
    }

    function studentHasAnyAttachment(questions = scanUploadQuestions()) {
        return questions.some(question => question.files.length > 0);
    }

    function firstPendingQuestionIndex(questions = scanUploadQuestions()) {
        const pending = getPendingQuestionIndexes(questions);

        return pending.length
            ? pending[0]
            : -1;
    }

    /* =========================================================
       تحديث React input
       ========================================================= */

    function setReactInputValue(input, value) {
        if (!input) {
            return;
        }

        /*
        Microsoft Forms قد يحتاج focus/blur لاعتماد الدرجة.
        نحفظ العنصر الذي كان يملك التركيز ثم نعيده بعد التحديث
        حتى لا تتوقف اختصارات لوحة المفاتيح بعد أول درجة.
        */
        const previousActive = document.activeElement;

        const setter = Object
            .getOwnPropertyDescriptor(
                HTMLInputElement.prototype,
                'value'
            )
            ?.set;

        if (setter) {
            setter.call(input, value);
        }
        else {
            input.value = value;
        }

        input.dispatchEvent(
            new Event('input', {
                bubbles: true
            })
        );

        input.dispatchEvent(
            new Event('change', {
                bubbles: true
            })
        );

        try {
            input.focus({ preventScroll: true });
            input.blur();
        }
        catch (_) {}

        try {
            if (
                previousActive &&
                previousActive !== input &&
                previousActive.isConnected &&
                typeof previousActive.focus === 'function'
            ) {
                previousActive.focus({ preventScroll: true });
            }
            else if (state.open) {
                document
                    .getElementById(APP_ID)
                    ?.focus({ preventScroll: true });
            }
        }
        catch (_) {}
    }

    /* =========================================================
       زر التشغيل المدمج أعلى الصفحة
       ========================================================= */

    function installLauncherStyle() {
        if (document.getElementById(LAUNCHER_STYLE_ID)) {
            return;
        }

        const style = document.createElement('style');
        style.id = LAUNCHER_STYLE_ID;

        style.textContent = `
#${LAUNCHER_ID}{
    position:static !important;
    inset:auto !important;
    margin-inline-start:8px;
    min-height:32px;
    height:32px;
    padding:0 12px;
    border:1px solid #c7c7c7;
    border-radius:6px;
    background:#fff;
    color:#242424;
    font-family:"Segoe UI",Tahoma,Arial,sans-serif;
    font-size:13px;
    font-weight:600;
    line-height:30px;
    white-space:nowrap;
    cursor:pointer;
    box-shadow:none;
    vertical-align:middle;
}

#${LAUNCHER_ID}:hover{
    background:#f5f5f5;
    border-color:#a6a6a6;
}
`;

        document.head.appendChild(style);
    }

    function installLauncher() {
        const current = document.getElementById(LAUNCHER_ID);

        if (!isReviewPage()) {
            current?.remove();
            return;
        }

        const target = findReviewToolbarTarget();

        if (!target?.container) {
            return;
        }

        installLauncherStyle();

        let button = current;

        if (!button) {
            button = document.createElement('button');
            button.id = LAUNCHER_ID;
            button.type = 'button';
            button.textContent = '🖼️ عارض المرفقات';
            button.title = 'فتح عارض مرفقات الطلاب والتصحيح السريع';
            button.addEventListener('click', openViewer);
        }

        if (button.parentElement !== target.container) {
            if (target.anchor?.nextSibling) {
                target.container.insertBefore(
                    button,
                    target.anchor.nextSibling
                );
            }
            else {
                target.container.appendChild(button);
            }
        }
    }

    /* =========================================================
       السؤال والملف الحالي
       ========================================================= */

    function currentQuestion() {
        return state.questions[state.questionIndex] || null;
    }

    function currentFile() {
        const question = currentQuestion();

        return question?.files[state.fileIndex] || null;
    }

    /* =========================================================
       فتح العارض
       ========================================================= */

    function openViewer() {
        if (document.getElementById(APP_ID)) {
            return;
        }

        state.open = true;
        state.questionIndex = 0;
        state.fileIndex = 0;
        state.referenceVisible = true;
        state.referenceMode = 'original';
        state.referenceRecord = null;
        state.referenceLoadedKey = '';
        state.referenceToken++;
        state.gradeHistoryContext = '';
        state.gradeHistory = [];

        revokeReferenceObjectURL();
        resetTransformState();
        resetReferenceTransformState();
        createViewerStyle();
        createViewerUI();
        updateReferenceVisibilityUI();

        render({
            preferPending: state.skipGraded
        });

        updateSkipButton();

        /*
        إذا كان خيار تجاوز المصححين محفوظاً كمفعّل من آخر مرة،
        فلا نبقى على طالب انتهى تصحيح جميع مرفقاته.
        */
        if (
            state.skipGraded &&
            !studentNeedsAttachmentReview(state.questions)
        ) {
            setTimeout(
                () => seekFirstUnreviewedFromCurrent(),
                120
            );
        }
    }

    /* =========================================================
       CSS العارض
       ========================================================= */

    function createViewerStyle() {
        document.getElementById(STYLE_ID)?.remove();

        const style = document.createElement('style');
        style.id = STYLE_ID;

        style.textContent = `
#${APP_ID}{
    position:fixed;
    inset:0;
    z-index:2147483647;
    direction:rtl;
    background:#09111f;
    color:#fff;
    font-family:"Segoe UI",Tahoma,Arial,sans-serif;
}

#${APP_ID},
#${APP_ID} *{
    box-sizing:border-box;
}

#${APP_ID} [hidden]{
    display:none !important;
}

#m0ar-header{
    height:68px;
    display:flex;
    align-items:center;
    gap:10px;
    padding:10px 16px;
    background:#111827;
    border-bottom:1px solid #293548;
}

#m0ar-person{
    flex:1;
    min-width:0;
}

#m0ar-name{
    font-size:18px;
    font-weight:800;
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
}

#m0ar-person-meta{
    margin-top:3px;
    color:#94a3b8;
    font-size:12px;
}

#m0ar-unreviewed-counter{
    min-height:38px;
    padding:7px 11px;
    border:1px solid #334155;
    border-radius:10px;
    background:#172033;
    color:#e2e8f0;
    cursor:pointer;
    white-space:nowrap;
    font-family:inherit;
    font-size:11px;
    font-weight:800;
}

#m0ar-unreviewed-counter:hover{
    border-color:#60a5fa;
    background:#1e293b;
}

#m0ar-unreviewed-counter.counting{
    color:#93c5fd;
    cursor:wait;
}

#m0ar-unreviewed-value{
    color:#fbbf24;
    font-size:15px;
    font-weight:900;
}

#m0ar-unreviewed-counter.ready #m0ar-unreviewed-value{
    color:#f8fafc;
}

#m0ar-count-overlay{
    position:absolute;
    inset:68px 0 0;
    z-index:100;
    display:flex;
    align-items:center;
    justify-content:center;
    background:rgba(2,6,23,.82);
    backdrop-filter:blur(4px);
    direction:rtl;
}

#m0ar-count-overlay-card{
    min-width:310px;
    max-width:520px;
    padding:24px;
    border:1px solid #334155;
    border-radius:16px;
    background:#111827;
    text-align:center;
    box-shadow:0 18px 55px rgba(0,0,0,.45);
}

#m0ar-count-overlay-title{
    margin-bottom:8px;
    font-size:18px;
    font-weight:900;
}

#m0ar-count-overlay-progress{
    color:#93c5fd;
    font-size:12px;
    line-height:1.7;
}

.m0ar-btn{
    min-height:42px;
    padding:8px 12px;
    border:1px solid #334155;
    border-radius:10px;
    background:#1e293b;
    color:#fff;
    cursor:pointer;
    font-weight:700;
}

.m0ar-btn:hover:not(:disabled){
    background:#2c3b50;
}

.m0ar-btn:disabled{
    opacity:.35;
    cursor:not-allowed;
}

.m0ar-btn.primary{
    background:#2563eb;
    border-color:#2563eb;
}

.m0ar-btn.good{
    background:#047857;
    border-color:#059669;
}

.m0ar-btn.zero{
    background:#374151;
}

.m0ar-btn.danger{
    background:#991b1b;
    border-color:#b91c1c;
}

#m0ar-layout{
    height:calc(100% - 68px);
    display:grid;
    grid-template-columns:370px minmax(0,1fr);
    direction:ltr;
}

#m0ar-side{
    direction:rtl;
    overflow:auto;
    padding:14px;
    background:#111827;
    border-right:1px solid #293548;
}

#m0ar-stage{
    min-width:0;
    min-height:0;
    position:relative;
    overflow:hidden;
    background:#09111f;
}

#m0ar-workspace{
    width:100%;
    height:100%;
    display:grid;
    grid-template-columns:
        var(--m0ar-reference-width,50%)
        10px
        minmax(0,1fr);
    direction:ltr;
    gap:0;
    background:#334155;
}

#m0ar-workspace.reference-hidden{
    grid-template-columns:1fr;
}

#m0ar-workspace.reference-hidden #m0ar-reference-pane,
#m0ar-workspace.reference-hidden #m0ar-splitter{
    display:none;
}

#m0ar-splitter{
    position:relative;
    min-width:10px;
    background:#1e293b;
    border-left:1px solid #475569;
    border-right:1px solid #475569;
    cursor:col-resize;
    touch-action:none;
    user-select:none;
    z-index:20;
}

#m0ar-splitter::before{
    content:'';
    position:absolute;
    left:50%;
    top:50%;
    width:3px;
    height:54px;
    transform:translate(-50%,-50%);
    border-radius:999px;
    background:#64748b;
    box-shadow:-3px 0 0 #334155,3px 0 0 #334155;
}

#m0ar-splitter:hover,
#m0ar-splitter.dragging{
    background:#2563eb;
}

#m0ar-splitter:hover::before,
#m0ar-splitter.dragging::before{
    background:#fff;
}

.m0ar-pane{
    min-width:0;
    min-height:0;
    position:relative;
    display:flex;
    flex-direction:column;
    background:#09111f;
    overflow:hidden;
}

.m0ar-pane-header{
    flex:0 0 52px;
    min-width:0;
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:8px;
    padding:8px 12px;
    direction:rtl;
    background:#111827;
    border-bottom:1px solid #293548;
}

.m0ar-pane-title{
    min-width:0;
    font-size:13px;
    font-weight:800;
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
}

/* =========================================================
   شريط التصحيح التراكمي فوق إجابة الطالب
   ========================================================= */

#m0ar-quick-grade{
    flex:0 0 auto;
    direction:rtl;
    padding:10px 12px 9px;
    background:#0f172a;
    border-bottom:1px solid #293548;
    box-shadow:0 5px 18px rgba(0,0,0,.16);
}

#m0ar-quick-grade-top{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:12px;
    margin-bottom:8px;
}

#m0ar-quick-grade-title{
    min-width:0;
    display:flex;
    align-items:center;
    gap:8px;
    color:#e2e8f0;
    font-size:12px;
    font-weight:800;
}

#m0ar-quick-shortcut-hint{
    color:#64748b;
    font-size:10px;
    font-weight:600;
}

#m0ar-quick-score-display{
    direction:ltr;
    display:flex;
    align-items:baseline;
    gap:5px;
    white-space:nowrap;
}

#m0ar-quick-score-value{
    color:#f8fafc;
    font-size:24px;
    font-weight:900;
    line-height:1;
}

#m0ar-quick-score-max{
    color:#94a3b8;
    font-size:13px;
    font-weight:700;
}

#m0ar-quick-grade-actions{
    display:grid;
    grid-template-columns:
        minmax(62px,.65fr)
        minmax(70px,.75fr)
        minmax(70px,.75fr)
        minmax(62px,.65fr)
        minmax(88px,.9fr)
        minmax(190px,1.75fr);
    gap:6px;
}

#m0ar-quick-grade-actions .m0ar-btn{
    min-height:36px;
    padding:5px 9px;
    font-size:12px;
}

.m0ar-score-add{
    background:#047857;
    border-color:#059669;
}

.m0ar-score-add:hover:not(:disabled){
    background:#059669;
}

.m0ar-score-subtract{
    background:#7c2d12;
    border-color:#9a3412;
}

.m0ar-score-subtract:hover:not(:disabled){
    background:#9a3412;
}

#m0ar-quick-undo{
    background:#334155;
}

#m0ar-quick-approve{
    background:#1d4ed8;
    border-color:#2563eb;
}

#m0ar-quick-approve:hover:not(:disabled){
    background:#2563eb;
}

.m0ar-key{
    display:inline-flex;
    align-items:center;
    justify-content:center;
    min-width:18px;
    height:18px;
    margin-inline-start:4px;
    padding:0 4px;
    border:1px solid rgba(255,255,255,.22);
    border-bottom-width:2px;
    border-radius:5px;
    background:rgba(255,255,255,.08);
    color:#cbd5e1;
    font-size:9px;
    font-family:inherit;
    font-weight:800;
    line-height:16px;
}

#m0ar-quick-progress{
    height:5px;
    margin-top:8px;
    overflow:hidden;
    border-radius:999px;
    background:#1e293b;
}

#m0ar-quick-progress-bar{
    width:0%;
    height:100%;
    border-radius:inherit;
    background:#3b82f6;
    transition:width .16s ease,background .16s ease;
}

#m0ar-quick-grade.partial #m0ar-quick-score-value{
    color:#fde68a;
}

#m0ar-quick-grade.partial #m0ar-quick-progress-bar{
    background:#f59e0b;
}

#m0ar-quick-grade.full #m0ar-quick-score-value{
    color:#86efac;
}

#m0ar-quick-grade.full #m0ar-quick-progress-bar{
    background:#10b981;
}

#m0ar-quick-grade.empty #m0ar-quick-score-value{
    color:#94a3b8;
}

#m0ar-reference-tabs{
    display:flex;
    gap:6px;
}

.m0ar-tab{
    min-height:32px;
    padding:5px 9px;
    border:1px solid #334155;
    border-radius:8px;
    background:#172033;
    color:#cbd5e1;
    cursor:pointer;
    font-size:11px;
    font-weight:700;
}

.m0ar-tab.active{
    background:#2563eb;
    border-color:#3b82f6;
    color:#fff;
}

.m0ar-media-surface{
    flex:1;
    min-width:0;
    min-height:0;
    position:relative;
    padding:18px;
    overflow:hidden;
    display:flex;
    align-items:center;
    justify-content:center;
    background:
        linear-gradient(45deg,#0d1728 25%,transparent 25%),
        linear-gradient(-45deg,#0d1728 25%,transparent 25%),
        linear-gradient(45deg,transparent 75%,#0d1728 75%),
        linear-gradient(-45deg,transparent 75%,#0d1728 75%),
        #09111f;
    background-size:28px 28px;
    background-position:0 0,0 14px,14px -14px,-14px 0;
    touch-action:none;
    user-select:none;
}

.m0ar-media-surface.has-image{
    cursor:grab;
}

.m0ar-media-surface.dragging{
    cursor:grabbing;
}

.m0ar-media-surface img.m0ar-view-image{
    display:block;
    max-width:100%;
    max-height:100%;
    object-fit:contain;
    transform-origin:center center;
    will-change:transform;
    pointer-events:none;
    user-select:none;
    -webkit-user-drag:none;
    box-shadow:0 14px 45px rgba(0,0,0,.5);
}

.m0ar-media-surface iframe{
    width:100%;
    height:100%;
    border:0;
    background:#fff;
    border-radius:10px;
}

.m0ar-card{
    padding:14px;
    margin-bottom:12px;
    background:#172033;
    border:1px solid #293548;
    border-radius:13px;
}

.m0ar-label{
    margin-bottom:7px;
    color:#94a3b8;
    font-size:11px;
}

#m0ar-question{
    font-size:14px;
    font-weight:700;
    line-height:1.75;
}

#m0ar-filename,
#m0ar-reference-file-name{
    font-size:13px;
    line-height:1.5;
    word-break:break-word;
}

#m0ar-status,
#m0ar-reference-status{
    min-height:17px;
    margin-top:7px;
    color:#93c5fd;
    font-size:11px;
    line-height:1.55;
}

.m0ar-two{
    display:grid;
    grid-template-columns:1fr 1fr;
    gap:8px;
}

#m0ar-grade-row{
    display:flex;
    align-items:center;
    gap:8px;
    direction:ltr;
}

#m0ar-grade{
    min-width:0;
    width:100%;
    height:50px;
    border:2px solid #475569;
    border-radius:10px;
    background:#0f172a;
    color:#fff;
    outline:none;
    text-align:center;
    font-size:23px;
    font-weight:900;
}

#m0ar-grade:focus{
    border-color:#60a5fa;
}

#m0ar-max{
    white-space:nowrap;
    font-size:17px;
}

#m0ar-score-buttons{
    margin-top:9px;
    display:grid;
    grid-template-columns:1fr 1fr;
    gap:8px;
}

#m0ar-question-counter,
#m0ar-file-counter{
    margin-top:8px;
    text-align:center;
    color:#94a3b8;
    font-size:12px;
}

#m0ar-skip-toggle{
    width:100%;
    display:flex;
    align-items:center;
    justify-content:center;
    gap:8px;
    transition:background .15s ease,border-color .15s ease;
}

#m0ar-skip-toggle.active{
    background:#047857;
    border-color:#10b981;
}

#m0ar-skip-help,
#m0ar-reference-help{
    margin-top:8px;
    color:#94a3b8;
    font-size:11px;
    line-height:1.7;
}

#m0ar-review-state{
    margin-top:10px;
    padding:8px 10px;
    border-radius:9px;
    background:#0f172a;
    color:#cbd5e1;
    font-size:11px;
    line-height:1.6;
}

#m0ar-review-state.pending{
    color:#fde68a;
}

#m0ar-review-state.done{
    color:#86efac;
}

#m0ar-reference-notes{
    width:100%;
    min-height:105px;
    margin-top:10px;
    resize:vertical;
    padding:10px;
    border:1px solid #334155;
    border-radius:10px;
    background:#0f172a;
    color:#fff;
    outline:none;
    font-family:inherit;
    font-size:12px;
    line-height:1.7;
}

#m0ar-reference-notes:focus{
    border-color:#60a5fa;
}

#m0ar-reference-file-input{
    display:none;
}

.m0ar-upload-label{
    display:flex;
    align-items:center;
    justify-content:center;
    text-align:center;
}

.m0ar-toolbar{
    position:absolute;
    left:50%;
    bottom:14px;
    z-index:5;
    transform:translateX(-50%);
    display:flex;
    flex-wrap:wrap;
    justify-content:center;
    gap:6px;
    max-width:calc(100% - 24px);
    padding:6px;
    border:1px solid #334155;
    border-radius:12px;
    background:rgba(15,23,42,.95);
    backdrop-filter:blur(9px);
}

.m0ar-toolbar .m0ar-btn{
    min-height:34px;
    padding:5px 9px;
    font-size:11px;
}

#m0ar-drag-hint,
#m0ar-ref-drag-hint{
    position:absolute;
    top:62px;
    left:50%;
    z-index:4;
    transform:translateX(-50%);
    padding:6px 9px;
    border:1px solid rgba(148,163,184,.25);
    border-radius:8px;
    background:rgba(15,23,42,.84);
    color:#cbd5e1;
    font-size:10px;
    pointer-events:none;
    white-space:nowrap;
}

#m0ar-original-question{
    width:100%;
    height:100%;
    overflow:auto;
    padding:26px;
    direction:rtl;
    text-align:right;
    background:#0f172a;
    color:#e2e8f0;
}

#m0ar-original-question h3{
    margin:0 0 14px;
    color:#fff;
    font-size:18px;
    line-height:1.7;
}

#m0ar-original-question p{
    white-space:pre-wrap;
    line-height:1.9;
}

.m0ar-original-image{
    display:block;
    max-width:100%;
    max-height:65vh;
    margin:14px auto;
    border-radius:10px;
    object-fit:contain;
    box-shadow:0 8px 28px rgba(0,0,0,.35);
}

#m0ar-empty,
.m0ar-reference-empty{
    max-width:560px;
    padding:40px;
    text-align:center;
    color:#cbd5e1;
    line-height:1.9;
    direction:rtl;
}

#m0ar-empty strong,
.m0ar-reference-empty strong{
    display:block;
    margin-bottom:9px;
    color:#fff;
    font-size:20px;
}

#m0ar-footer{
    margin-top:15px;
    padding-top:12px;
    border-top:1px solid #263244;
    color:#64748b;
    text-align:center;
    font-size:10px;
    line-height:1.8;
}

@media(max-width:1500px){
    #m0ar-quick-grade-actions{
        grid-template-columns:repeat(5,minmax(60px,1fr));
    }

    #m0ar-quick-approve{
        grid-column:1 / -1;
    }
}

@media(max-width:1180px){
    #m0ar-workspace:not(.reference-hidden){
        grid-template-columns:1fr;
        grid-template-rows:minmax(0,1fr) minmax(0,1fr);
    }

    #m0ar-splitter{
        display:none;
    }
}

@media(max-width:850px){
    #m0ar-quick-grade-top{
        align-items:flex-start;
    }

    #m0ar-quick-shortcut-hint{
        display:none;
    }

    #m0ar-quick-grade-actions{
        grid-template-columns:repeat(2,minmax(0,1fr));
    }

    #m0ar-quick-approve{
        grid-column:1 / -1;
    }

    #m0ar-layout{
        grid-template-columns:1fr;
        grid-template-rows:minmax(500px,1fr) auto;
    }

    #m0ar-side{
        max-height:440px;
        border-right:0;
        border-top:1px solid #293548;
    }
}
`;

        document.head.appendChild(style);
    }

    /* =========================================================
       HTML العارض
       ========================================================= */

    function createViewerUI() {
        const app = document.createElement('div');
        app.id = APP_ID;
        app.tabIndex = -1;

        app.innerHTML = `
<div id="m0ar-header">
    <button type="button" class="m0ar-btn" id="m0ar-student-prev-top">
        ◀ الطالب السابق
    </button>

    <div id="m0ar-person">
        <div id="m0ar-name">المستجيب</div>
        <div id="m0ar-person-meta"></div>
    </div>

    <button
        type="button"
        id="m0ar-unreviewed-counter"
        title="اضغط لحساب العدد الدقيق للطلاب الذين ما زال لديهم مرفق غير مصحح"
    >
        غير المصححين: <span id="m0ar-unreviewed-value">احسب ↻</span>
    </button>

    <button type="button" class="m0ar-btn" id="m0ar-reference-toggle">
        📘 إخفاء المرجع
    </button>

    <button type="button" class="m0ar-btn primary" id="m0ar-student-next-top">
        الطالب التالي ▶
    </button>

    <button type="button" class="m0ar-btn danger" id="m0ar-close" title="إغلاق العارض">
        ✕
    </button>
</div>

<div id="m0ar-count-overlay" hidden>
    <div id="m0ar-count-overlay-card">
        <div id="m0ar-count-overlay-title">🔎 حساب غير المصححين</div>
        <div id="m0ar-count-overlay-progress">جاري الاستعداد...</div>
    </div>
</div>

<div id="m0ar-layout">
    <aside id="m0ar-side">

        <div class="m0ar-card">
            <div class="m0ar-label">تجاوز الطلاب المصححين</div>

            <button type="button" class="m0ar-btn" id="m0ar-skip-toggle">
                ⏭ تجاوز المصححين: متوقف
            </button>

            <div id="m0ar-skip-help">
                عند التفعيل، أزرار الطالب السابق/التالي تمر فقط على الطلاب الذين لديهم مرفق ودرجة السؤال ما زالت فارغة. الدرجة 0 تعتبر مصححة.
            </div>

            <div id="m0ar-review-state"></div>
        </div>

        <div class="m0ar-card">
            <div class="m0ar-label">سؤال المرفق</div>

            <div id="m0ar-question">—</div>

            <div class="m0ar-two" style="margin-top:12px">
                <button type="button" class="m0ar-btn" id="m0ar-question-prev">السابق</button>
                <button type="button" class="m0ar-btn" id="m0ar-question-next">التالي</button>
            </div>

            <div id="m0ar-question-counter">—</div>
        </div>

        <div class="m0ar-card">
            <div class="m0ar-label">📘 مرجع التصحيح لهذا السؤال</div>

            <div id="m0ar-reference-file-name">
                لم يتم إضافة نموذج إجابة بعد
            </div>

            <div class="m0ar-two" style="margin-top:10px">
                <label class="m0ar-btn m0ar-upload-label" for="m0ar-reference-file-input">
                    📎 اختيار نموذج
                </label>

                <button type="button" class="m0ar-btn danger" id="m0ar-reference-delete">
                    حذف النموذج
                </button>
            </div>

            <input
                id="m0ar-reference-file-input"
                type="file"
                accept="image/*,.pdf,application/pdf"
            >

            <textarea
                id="m0ar-reference-notes"
                placeholder="اكتب هنا نموذج إجابة نصيًا، أو معايير التصحيح والملاحظات الخاصة بهذا السؤال..."
            ></textarea>

            <div id="m0ar-reference-status"></div>

            <div id="m0ar-reference-help">
                يُحفظ نموذج الإجابة والملاحظات محليًا في هذا المتصفح لكل نموذج ولكل سؤال على حدة، ولا تُرسل إلى أي خادم خارجي.
            </div>
        </div>

        <div class="m0ar-card">
            <div class="m0ar-label">ملف الطالب</div>

            <div id="m0ar-filename">—</div>

            <div class="m0ar-two" style="margin-top:12px">
                <button type="button" class="m0ar-btn" id="m0ar-file-prev">السابق</button>
                <button type="button" class="m0ar-btn" id="m0ar-file-next">التالي</button>
            </div>

            <div id="m0ar-file-counter">—</div>
            <div id="m0ar-status"></div>
        </div>

        <div class="m0ar-card">
            <div class="m0ar-label">درجة هذا السؤال</div>

            <div id="m0ar-grade-row">
                <input id="m0ar-grade" type="number" min="0" step="any">
                <span id="m0ar-max">/ —</span>
            </div>

            <div id="m0ar-score-buttons">
                <button type="button" class="m0ar-btn zero" id="m0ar-zero-score">صفر</button>
                <button type="button" class="m0ar-btn good" id="m0ar-full-score">الدرجة كاملة</button>
            </div>
        </div>

        <div class="m0ar-card">
            <div class="m0ar-label">التنقل بين الطلاب</div>

            <div class="m0ar-two">
                <button type="button" class="m0ar-btn" id="m0ar-student-prev">السابق</button>
                <button type="button" class="m0ar-btn primary" id="m0ar-student-next">التالي</button>
            </div>
        </div>

        <div id="m0ar-footer">
            ${escapeHTML(DEVELOPER.name)} (${escapeHTML(DEVELOPER.handle)})
            <br>
            ${escapeHTML(DEVELOPER.copyright)}
            <br>
            V${VERSION}
        </div>
    </aside>

    <main id="m0ar-stage">
        <div id="m0ar-workspace">

            <section class="m0ar-pane" id="m0ar-reference-pane">
                <div class="m0ar-pane-header">
                    <div class="m0ar-pane-title">📘 مرجع التصحيح</div>

                    <div id="m0ar-reference-tabs">
                        <button type="button" class="m0ar-tab" id="m0ar-ref-tab-model">
                            نموذج الإجابة
                        </button>

                        <button type="button" class="m0ar-tab active" id="m0ar-ref-tab-original">
                            أصل السؤال
                        </button>
                    </div>
                </div>

                <div class="m0ar-media-surface" id="m0ar-reference-media"></div>

                <div id="m0ar-ref-drag-hint" hidden>
                    اسحب المرجع للتحريك • عجلة الفأرة للتكبير
                </div>

                <div class="m0ar-toolbar" id="m0ar-reference-toolbar" hidden>
                    <button type="button" class="m0ar-btn" id="m0ar-ref-minus">−</button>
                    <button type="button" class="m0ar-btn" id="m0ar-ref-fit">ملاءمة</button>
                    <button type="button" class="m0ar-btn" id="m0ar-ref-plus">+</button>
                    <button type="button" class="m0ar-btn" id="m0ar-ref-rotate">↻ تدوير</button>
                    <button type="button" class="m0ar-btn" id="m0ar-ref-center">◎ توسيط</button>
                </div>
            </section>

            <div
                id="m0ar-splitter"
                role="separator"
                aria-orientation="vertical"
                aria-label="تغيير حجم مرجع التصحيح وإجابة الطالب"
                title="اسحب يمينًا أو يسارًا لتغيير حجم العارضين • نقرتان لإعادة 50/50"
            ></div>

            <section class="m0ar-pane" id="m0ar-student-pane">
                <div class="m0ar-pane-header">
                    <div class="m0ar-pane-title">🖼️ إجابة الطالب</div>
                    <div class="m0ar-pane-title" id="m0ar-student-pane-file"></div>
                </div>

                <div id="m0ar-quick-grade" class="empty">
                    <div id="m0ar-quick-grade-top">
                        <div id="m0ar-quick-grade-title">
                            ⚡ التصحيح التراكمي السريع
                            <span id="m0ar-quick-shortcut-hint">1 = +1 • 5 = +0.5 • Z = تراجع • Enter = اعتماد • PgDn/PgUp = الملف التالي/السابق • Shift+PgDn/PgUp = السؤال التالي/السابق</span>
                        </div>

                        <div id="m0ar-quick-score-display">
                            <strong id="m0ar-quick-score-value">—</strong>
                            <span id="m0ar-quick-score-max">/ —</span>
                        </div>
                    </div>

                    <div id="m0ar-quick-grade-actions">
                        <button type="button" class="m0ar-btn m0ar-score-add" id="m0ar-score-plus-one" title="إضافة درجة واحدة">
                            +1 <span class="m0ar-key">1</span>
                        </button>

                        <button type="button" class="m0ar-btn m0ar-score-add" id="m0ar-score-plus-half" title="إضافة نصف درجة">
                            +0.5 <span class="m0ar-key">5</span>
                        </button>

                        <button type="button" class="m0ar-btn m0ar-score-subtract" id="m0ar-score-minus-half" title="خصم نصف درجة">
                            −0.5
                        </button>

                        <button type="button" class="m0ar-btn m0ar-score-subtract" id="m0ar-score-minus-one" title="خصم درجة واحدة">
                            −1
                        </button>

                        <button type="button" class="m0ar-btn" id="m0ar-quick-undo" title="التراجع عن آخر تعديل سريع">
                            ↶ تراجع <span class="m0ar-key">Z</span>
                        </button>

                        <button type="button" class="m0ar-btn" id="m0ar-quick-approve" title="اعتماد الدرجة الحالية ثم الانتقال إلى المهمة التالية غير المصححة">
                            ✓ اعتماد ← التالي غير المصحح <span class="m0ar-key">Enter</span>
                        </button>
                    </div>

                    <div id="m0ar-quick-progress" aria-hidden="true">
                        <div id="m0ar-quick-progress-bar"></div>
                    </div>
                </div>

                <div class="m0ar-media-surface" id="m0ar-media"></div>

                <div id="m0ar-drag-hint">
                    اسحب الصورة بالماوس للتحريك • عجلة الفأرة للتكبير والتصغير
                </div>

                <div class="m0ar-toolbar" id="m0ar-toolbar">
                    <button type="button" class="m0ar-btn" id="m0ar-minus" title="تصغير">−</button>
                    <button type="button" class="m0ar-btn" id="m0ar-fit" title="إعادة الصورة للوضع الطبيعي">ملاءمة</button>
                    <button type="button" class="m0ar-btn" id="m0ar-plus" title="تكبير">+</button>
                    <button type="button" class="m0ar-btn" id="m0ar-rotate" title="تدوير الصورة 90 درجة">↻ تدوير 90°</button>
                    <button type="button" class="m0ar-btn" id="m0ar-flip-x" title="عكس الصورة أفقيًا مثل المرآة">↔ عكس أفقي</button>
                    <button type="button" class="m0ar-btn" id="m0ar-flip-y" title="عكس الصورة رأسيًا">↕ عكس رأسي</button>
                    <button type="button" class="m0ar-btn" id="m0ar-center" title="إعادة الصورة إلى المنتصف">◎ توسيط</button>
                    <button type="button" class="m0ar-btn" id="m0ar-original">فتح الأصل ↗</button>
                </div>
            </section>

        </div>
    </main>
</div>
`;

        document.body.appendChild(app);
        bindViewerEvents();

        try {
            app.focus({ preventScroll: true });
        }
        catch (_) {}
    }

    function $(selector) {
        return document
            .getElementById(APP_ID)
            ?.querySelector(selector);
    }

    function setStatus(value = '') {
        const element = $('#m0ar-status');

        if (element) {
            element.textContent = value;
        }
    }

    function setReferenceStatus(value = '') {
        const element = $('#m0ar-reference-status');

        if (element) {
            element.textContent = value;
        }
    }

    function updateReferenceVisibilityUI() {
        const workspace = $('#m0ar-workspace');
        const button = $('#m0ar-reference-toggle');

        workspace?.classList.toggle(
            'reference-hidden',
            !state.referenceVisible
        );

        if (button) {
            button.textContent = state.referenceVisible
                ? '📘 إخفاء المرجع'
                : '📘 إظهار المرجع';
        }

        applyReferencePaneWidth();
    }

    function applyReferencePaneWidth() {
        const workspace = $('#m0ar-workspace');

        if (!workspace) {
            return;
        }

        workspace.style.setProperty(
            '--m0ar-reference-width',
            `${state.referencePanePercent}%`
        );

        const splitter = $('#m0ar-splitter');
        splitter?.setAttribute(
            'aria-valuenow',
            String(Math.round(state.referencePanePercent))
        );
    }

    function startSplitResize(event) {
        if (
            !state.referenceVisible ||
            event.button !== 0 ||
            window.innerWidth <= 1180
        ) {
            return;
        }

        event.preventDefault();

        const splitter = $('#m0ar-splitter');

        state.resizingSplit = true;
        state.splitPointerId = event.pointerId;
        splitter?.classList.add('dragging');

        try {
            splitter?.setPointerCapture(event.pointerId);
        }
        catch (_) {}
    }

    function moveSplitResize(event) {
        if (
            !state.resizingSplit ||
            event.pointerId !== state.splitPointerId
        ) {
            return;
        }

        const workspace = $('#m0ar-workspace');

        if (!workspace) {
            return;
        }

        event.preventDefault();

        const rect = workspace.getBoundingClientRect();
        const raw = ((event.clientX - rect.left) / rect.width) * 100;

        state.referencePanePercent = Math.min(78, Math.max(22, raw));
        applyReferencePaneWidth();
    }

    function endSplitResize(event) {
        if (!state.resizingSplit) {
            return;
        }

        if (
            state.splitPointerId !== null &&
            event.pointerId !== state.splitPointerId
        ) {
            return;
        }

        const splitter = $('#m0ar-splitter');

        state.resizingSplit = false;
        splitter?.classList.remove('dragging');

        try {
            if (state.splitPointerId !== null) {
                splitter?.releasePointerCapture(state.splitPointerId);
            }
        }
        catch (_) {}

        state.splitPointerId = null;
        writeSplitPreference(state.referencePanePercent);
    }

    function resetSplitResize() {
        state.referencePanePercent = 50;
        writeSplitPreference(state.referencePanePercent);
        applyReferencePaneWidth();
        setStatus('↔ تمت إعادة العارضين إلى 50 / 50.');
    }

    function toggleReferenceVisibility() {
        state.referenceVisible = !state.referenceVisible;
        updateReferenceVisibilityUI();
    }

    function updateReferenceTabs() {
        $('#m0ar-ref-tab-model')?.classList.toggle(
            'active',
            state.referenceMode === 'model'
        );

        $('#m0ar-ref-tab-original')?.classList.toggle(
            'active',
            state.referenceMode === 'original'
        );
    }

    function resetReferenceTransformState() {
        state.refZoom = 1;
        state.refRotation = 0;
        state.refPanX = 0;
        state.refPanY = 0;
        state.refDragging = false;
        state.refDragPointerId = null;
    }

    function applyReferenceTransform() {
        const image = $('#m0ar-ref-image');

        if (!image) {
            return;
        }

        image.style.transform = [
            `translate3d(${state.refPanX}px, ${state.refPanY}px, 0)`,
            `rotate(${state.refRotation}deg)`,
            `scale(${state.refZoom})`
        ].join(' ');
    }

    function resetReferenceTransform() {
        resetReferenceTransformState();
        applyReferenceTransform();
        setReferenceStatus('✓ تمت ملاءمة نموذج الإجابة');
    }

    function centerReferenceImage() {
        state.refPanX = 0;
        state.refPanY = 0;
        applyReferenceTransform();
        setReferenceStatus('◎ تم توسيط نموذج الإجابة');
    }

    function changeReferenceZoom(delta) {
        if (!$('#m0ar-ref-image')) {
            return;
        }

        const previous = state.refZoom;

        state.refZoom = Math.min(
            5,
            Math.max(
                0.2,
                state.refZoom + delta
            )
        );

        if (
            state.refZoom <= 1 &&
            previous > 1
        ) {
            state.refPanX = 0;
            state.refPanY = 0;
        }

        applyReferenceTransform();

        setReferenceStatus(
            `تكبير المرجع: ${Math.round(state.refZoom * 100)}%`
        );
    }

    function updateReferenceSidebar(record = state.referenceRecord) {
        const fileName = $('#m0ar-reference-file-name');
        const deleteButton = $('#m0ar-reference-delete');
        const notes = $('#m0ar-reference-notes');

        if (fileName) {
            fileName.textContent = record?.blob
                ? `نموذج الإجابة: ${record.fileName || 'ملف محفوظ'}`
                : 'لم يتم إضافة نموذج إجابة مرئي بعد';
        }

        if (deleteButton) {
            deleteButton.disabled = !record?.blob;
        }

        if (notes) {
            notes.value = record?.notes || '';
        }
    }

    function renderOriginalQuestion(question) {
        const media = $('#m0ar-reference-media');

        if (!media) {
            return;
        }

        revokeReferenceObjectURL();
        resetReferenceTransformState();

        media.classList.remove('has-image', 'dragging');
        $('#m0ar-reference-toolbar')?.setAttribute('hidden', '');
        $('#m0ar-ref-drag-hint')?.setAttribute('hidden', '');

        const title = escapeHTML(
            question?.title || 'سؤال رفع ملف'
        );

        const body = clean(question?.originalText || '');
        const images = question?.originalImages || [];

        const bodyHTML = body
            ? `<p>${escapeHTML(body)}</p>`
            : '<p>لا يوجد نص إضافي ظاهر للسؤال.</p>';

        const imagesHTML = images.length
            ? images
                .map(image => `
                    <img
                        class="m0ar-original-image"
                        src="${escapeHTML(image.src)}"
                        alt="${escapeHTML(image.alt || 'صورة السؤال')}"
                    >
                `)
                .join('')
            : '';

        media.innerHTML = `
<div id="m0ar-original-question">
    <h3>${title}</h3>
    ${bodyHTML}
    ${imagesHTML}
</div>`;

        setReferenceStatus(
            images.length
                ? `أصل السؤال • ${images.length} صورة`
                : 'أصل السؤال'
        );
    }

    function renderReferenceModel(record = state.referenceRecord) {
        const media = $('#m0ar-reference-media');
        const toolbar = $('#m0ar-reference-toolbar');
        const hint = $('#m0ar-ref-drag-hint');

        if (!media) {
            return;
        }

        revokeReferenceObjectURL();
        resetReferenceTransformState();
        media.classList.remove('has-image', 'dragging');
        toolbar?.setAttribute('hidden', '');
        hint?.setAttribute('hidden', '');

        if (!record?.blob) {
            media.innerHTML = `
<div class="m0ar-reference-empty">
    <strong>لا يوجد نموذج إجابة مرئي</strong>
    اختر صورة أو PDF من بطاقة «مرجع التصحيح».
    <br>
    ويمكنك أيضًا كتابة نموذج إجابة نصيًا أو معايير التصحيح في خانة الملاحظات.
</div>`;

            setReferenceStatus('لا يوجد نموذج إجابة مرئي محفوظ لهذا السؤال.');
            return;
        }

        state.referenceObjectURL = URL.createObjectURL(record.blob);

        const ext = getExtension(record.fileName || '');
        const mime = clean(record.mimeType || record.blob.type || '');
        const isImage = mime.startsWith('image/') || IMAGE_EXTS.has(ext);
        const isPDF = mime === 'application/pdf' || PDF_EXTS.has(ext);

        if (isImage) {
            const image = new Image();
            image.id = 'm0ar-ref-image';
            image.className = 'm0ar-view-image';
            image.alt = record.fileName || 'نموذج الإجابة';

            image.onload = () => {
                media.classList.add('has-image');
                toolbar?.removeAttribute('hidden');
                hint?.removeAttribute('hidden');
                resetReferenceTransformState();
                applyReferenceTransform();

                setReferenceStatus(
                    `✓ نموذج الإجابة ${image.naturalWidth} × ${image.naturalHeight}`
                );
            };

            image.onerror = () => {
                setReferenceStatus('تعذر عرض نموذج الإجابة المحفوظ.');
            };

            image.src = state.referenceObjectURL;
            media.replaceChildren(image);
            return;
        }

        if (isPDF) {
            const frame = document.createElement('iframe');
            frame.src = state.referenceObjectURL;
            frame.title = record.fileName || 'نموذج الإجابة PDF';
            media.replaceChildren(frame);
            setReferenceStatus('✓ نموذج الإجابة PDF');
            return;
        }

        media.innerHTML = `
<div class="m0ar-reference-empty">
    <strong>نوع الملف غير مدعوم للعرض</strong>
    احذف النموذج واختر صورة أو PDF.
</div>`;

        setReferenceStatus('نوع نموذج الإجابة غير مدعوم.');
    }

    function renderReferenceByMode(question = currentQuestion()) {
        updateReferenceTabs();

        if (state.referenceMode === 'model') {
            renderReferenceModel(state.referenceRecord);
        }
        else {
            renderOriginalQuestion(question);
        }
    }

    async function loadReferenceForQuestion(question = currentQuestion()) {
        const token = ++state.referenceToken;
        const expectedKey = question?.storageKey || '';

        revokeReferenceObjectURL();
        state.referenceRecord = null;
        state.referenceLoadedKey = expectedKey;

        const media = $('#m0ar-reference-media');

        if (!question || !expectedKey) {
            updateReferenceSidebar(null);

            if (media) {
                media.innerHTML = `
<div class="m0ar-reference-empty">
    <strong>لا يوجد سؤال مرفق</strong>
    سيظهر مرجع التصحيح عند فتح سؤال رفع ملفات.
</div>`;
            }

            return;
        }

        if (media) {
            media.innerHTML = `
<div class="m0ar-reference-empty">
    جاري تحميل مرجع التصحيح...
</div>`;
        }

        try {
            const record = await readReferenceRecord(expectedKey);

            if (
                token !== state.referenceToken ||
                currentQuestion()?.storageKey !== expectedKey
            ) {
                return;
            }

            state.referenceRecord = record;
            state.referenceMode = record?.blob
                ? 'model'
                : 'original';

            updateReferenceSidebar(record);
            renderReferenceByMode(question);
        }
        catch (error) {
            if (token !== state.referenceToken) {
                return;
            }

            state.referenceRecord = null;
            state.referenceMode = 'original';
            updateReferenceSidebar(null);
            renderOriginalQuestion(question);

            setReferenceStatus(
                `تعذر قراءة المرجع المحلي: ${clean(error?.message || error)}`
            );
        }
    }

    function switchReferenceMode(mode) {
        if (!['model', 'original'].includes(mode)) {
            return;
        }

        state.referenceMode = mode;
        renderReferenceByMode(currentQuestion());
    }

    async function saveReferenceNotesForQuestion(question, notesText) {
        if (!question?.storageKey) {
            return;
        }

        try {
            const existing = await readReferenceRecord(question.storageKey);

            const record = {
                ...(existing || {}),
                key: question.storageKey,
                formKey: getFormStorageKey(),
                questionTitle: question.title || '',
                questionNumber: question.questionNumber,
                notes: String(notesText || ''),
                updatedAt: Date.now()
            };

            await writeReferenceRecord(record);

            if (currentQuestion()?.storageKey === question.storageKey) {
                state.referenceRecord = record;

                const notesElement = $('#m0ar-reference-notes');
                const liveNotes = notesElement?.value ?? '';

                updateReferenceSidebar(record);

                if (
                    notesElement &&
                    liveNotes !== String(notesText || '')
                ) {
                    notesElement.value = liveNotes;
                }

                setReferenceStatus('✓ تم حفظ ملاحظات ومعايير التصحيح محليًا');
            }
        }
        catch (error) {
            setReferenceStatus(
                `تعذر حفظ الملاحظات: ${clean(error?.message || error)}`
            );
        }
    }

    function scheduleReferenceNotesSave() {
        clearTimeout(state.referenceNotesTimer);

        const question = currentQuestion();
        const notesText = $('#m0ar-reference-notes')?.value || '';

        if (!question) {
            return;
        }

        state.referenceNotesTimer = setTimeout(
            () => saveReferenceNotesForQuestion(question, notesText),
            550
        );
    }

    function flushCurrentReferenceNotes() {
        clearTimeout(state.referenceNotesTimer);
        state.referenceNotesTimer = null;

        const question = currentQuestion();
        const notes = $('#m0ar-reference-notes');

        if (!question || !notes) {
            return;
        }

        saveReferenceNotesForQuestion(
            question,
            notes.value || ''
        );
    }

    async function handleReferenceFileSelection(file) {
        const question = currentQuestion();

        if (!question?.storageKey || !file) {
            return;
        }

        const ext = getExtension(file.name || '');
        const isImage = file.type.startsWith('image/') || IMAGE_EXTS.has(ext);
        const isPDF = file.type === 'application/pdf' || PDF_EXTS.has(ext);

        if (!isImage && !isPDF) {
            setReferenceStatus('اختر صورة أو ملف PDF فقط لنموذج الإجابة.');
            return;
        }

        if (file.size > 30 * 1024 * 1024) {
            setReferenceStatus('حجم نموذج الإجابة كبير جدًا. الحد الحالي 30MB.');
            return;
        }

        setReferenceStatus('جاري حفظ نموذج الإجابة محليًا...');

        try {
            const existing = await readReferenceRecord(question.storageKey);
            const notes = $('#m0ar-reference-notes')?.value || existing?.notes || '';

            const record = {
                ...(existing || {}),
                key: question.storageKey,
                formKey: getFormStorageKey(),
                questionTitle: question.title || '',
                questionNumber: question.questionNumber,
                notes,
                blob: file,
                fileName: file.name || 'نموذج الإجابة',
                mimeType: file.type || '',
                updatedAt: Date.now()
            };

            await writeReferenceRecord(record);

            if (currentQuestion()?.storageKey !== question.storageKey) {
                return;
            }

            state.referenceRecord = record;
            state.referenceMode = 'model';
            updateReferenceSidebar(record);
            renderReferenceByMode(question);
            setReferenceStatus('✓ تم حفظ نموذج الإجابة لهذا السؤال');
        }
        catch (error) {
            setReferenceStatus(
                `تعذر حفظ نموذج الإجابة: ${clean(error?.message || error)}`
            );
        }
    }

    async function deleteCurrentReferenceFile() {
        const question = currentQuestion();

        if (!question?.storageKey || !state.referenceRecord?.blob) {
            return;
        }

        const accepted = confirm(
            'هل تريد حذف ملف نموذج الإجابة لهذا السؤال؟\nسيتم الاحتفاظ بالملاحظات النصية إن وجدت.'
        );

        if (!accepted) {
            return;
        }

        try {
            const notes = state.referenceRecord?.notes || '';

            if (clean(notes)) {
                const record = {
                    key: question.storageKey,
                    formKey: getFormStorageKey(),
                    questionTitle: question.title || '',
                    questionNumber: question.questionNumber,
                    notes,
                    updatedAt: Date.now()
                };

                await writeReferenceRecord(record);
                state.referenceRecord = record;
            }
            else {
                await deleteReferenceRecord(question.storageKey);
                state.referenceRecord = null;
            }

            state.referenceMode = 'original';
            updateReferenceSidebar(state.referenceRecord);
            renderReferenceByMode(question);
            setReferenceStatus('✓ تم حذف ملف نموذج الإجابة');
        }
        catch (error) {
            setReferenceStatus(
                `تعذر حذف نموذج الإجابة: ${clean(error?.message || error)}`
            );
        }
    }

    function startReferenceDrag(event) {
        const media = $('#m0ar-reference-media');
        const image = $('#m0ar-ref-image');

        if (!media || !image || event.button !== 0) {
            return;
        }

        event.preventDefault();

        state.refDragging = true;
        state.refDragPointerId = event.pointerId;
        state.refDragStartX = event.clientX;
        state.refDragStartY = event.clientY;
        state.refDragStartPanX = state.refPanX;
        state.refDragStartPanY = state.refPanY;

        media.classList.add('dragging');

        try {
            media.setPointerCapture(event.pointerId);
        }
        catch (_) {}
    }

    function moveReferenceDrag(event) {
        if (
            !state.refDragging ||
            event.pointerId !== state.refDragPointerId
        ) {
            return;
        }

        event.preventDefault();

        state.refPanX = state.refDragStartPanX +
            (event.clientX - state.refDragStartX);

        state.refPanY = state.refDragStartPanY +
            (event.clientY - state.refDragStartY);

        applyReferenceTransform();
    }

    function endReferenceDrag(event) {
        if (!state.refDragging) {
            return;
        }

        if (
            state.refDragPointerId !== null &&
            event.pointerId !== state.refDragPointerId
        ) {
            return;
        }

        const media = $('#m0ar-reference-media');
        state.refDragging = false;
        media?.classList.remove('dragging');

        try {
            if (state.refDragPointerId !== null) {
                media?.releasePointerCapture(state.refDragPointerId);
            }
        }
        catch (_) {}

        state.refDragPointerId = null;
    }

    function referenceWheelZoom(event) {
        if (!$('#m0ar-ref-image')) {
            return;
        }

        event.preventDefault();

        changeReferenceZoom(
            event.deltaY < 0
                ? 0.15
                : -0.15
        );
    }

    function setReviewState(questions = state.questions) {
        const element = $('#m0ar-review-state');

        if (!element) {
            return;
        }

        const attachmentQuestions = questions.filter(
            question => question.files.length > 0
        );

        const pending = getPendingQuestionIndexes(questions);

        element.classList.remove('pending', 'done');

        if (!attachmentQuestions.length) {
            element.textContent = 'لا توجد مرفقات لهذا الطالب.';
            return;
        }

        if (pending.length) {
            element.classList.add('pending');
            element.textContent =
                `بانتظار التصحيح: ${pending.length} من ${attachmentQuestions.length} سؤال مرفقات.`;
        }
        else {
            element.classList.add('done');
            element.textContent =
                `✓ تم رصد درجات جميع أسئلة المرفقات لهذا الطالب.`;
        }
    }

    function updateSkipButton() {
        const button = $('#m0ar-skip-toggle');

        if (!button) {
            return;
        }

        button.classList.toggle('active', state.skipGraded);
        button.textContent = state.skipGraded
            ? '⏭ تجاوز المصححين: مفعّل'
            : '⏭ تجاوز المصححين: متوقف';

        button.setAttribute(
            'aria-pressed',
            state.skipGraded ? 'true' : 'false'
        );
    }

    /* =========================================================
       التصحيح التراكمي السريع
       ========================================================= */

    function parseScoreNumber(value) {
        const text = normalizeDigits(
            clean(value)
        )
            .replace('٫', '.')
            .replace(',', '.');

        if (!text) {
            return null;
        }

        const number = Number(text);

        return Number.isFinite(number)
            ? number
            : null;
    }

    function getQuestionMaxNumber(question = currentQuestion()) {
        if (!clean(question?.maxPoints)) {
            return null;
        }

        return parseScoreNumber(question.maxPoints);
    }

    function formatScore(number) {
        if (!Number.isFinite(number)) {
            return '';
        }

        const rounded = Math.round((number + Number.EPSILON) * 100) / 100;

        return Number.isInteger(rounded)
            ? String(rounded)
            : String(rounded)
                .replace(/(\.\d*?[1-9])0+$/, '$1')
                .replace(/\.0+$/, '');
    }

    function getGradeContextKey(question = currentQuestion()) {
        if (!question) {
            return '';
        }

        return [
            getRespondentNumber() || getStudentName(),
            question.storageKey || state.questionIndex
        ].join('::');
    }

    function syncGradeHistoryContext(question = currentQuestion()) {
        const key = getGradeContextKey(question);

        if (state.gradeHistoryContext !== key) {
            state.gradeHistoryContext = key;
            state.gradeHistory = [];
        }

        return key;
    }

    function getCurrentGradeRaw(question = currentQuestion()) {
        const gradeUI = $('#m0ar-grade');

        if (gradeUI && !gradeUI.disabled) {
            return clean(gradeUI.value);
        }

        return clean(
            question?.gradeInput?.value ??
            question?.grade ??
            ''
        );
    }

    function updateQuickGradeUI() {
        const strip = $('#m0ar-quick-grade');

        if (!strip) {
            return;
        }

        const question = currentQuestion();
        const gradeUI = $('#m0ar-grade');
        const valueEl = $('#m0ar-quick-score-value');
        const maxEl = $('#m0ar-quick-score-max');
        const progress = $('#m0ar-quick-progress-bar');
        const plusOne = $('#m0ar-score-plus-one');
        const plusHalf = $('#m0ar-score-plus-half');
        const minusHalf = $('#m0ar-score-minus-half');
        const minusOne = $('#m0ar-score-minus-one');
        const undo = $('#m0ar-quick-undo');
        const approve = $('#m0ar-quick-approve');

        syncGradeHistoryContext(question);

        const unavailable = !question || !question.files?.length || !gradeUI || gradeUI.disabled;
        const raw = unavailable
            ? ''
            : getCurrentGradeRaw(question);
        const recorded = hasRecordedGrade(raw);
        const score = recorded
            ? parseScoreNumber(raw)
            : null;
        const max = getQuestionMaxNumber(question);

        if (valueEl) {
            valueEl.textContent = recorded && score !== null
                ? formatScore(score)
                : '—';
        }

        if (maxEl) {
            maxEl.textContent = max !== null
                ? `/ ${formatScore(max)}`
                : '/ —';
        }

        let percentage = 0;

        if (
            recorded &&
            score !== null &&
            max !== null &&
            max > 0
        ) {
            percentage = Math.max(
                0,
                Math.min(100, (score / max) * 100)
            );
        }

        if (progress) {
            progress.style.width = `${percentage}%`;
        }

        const full = (
            recorded &&
            score !== null &&
            max !== null &&
            score >= max
        );

        strip.classList.toggle('empty', !recorded);
        strip.classList.toggle('partial', recorded && !full);
        strip.classList.toggle('full', full);

        const atMaximum = (
            recorded &&
            score !== null &&
            max !== null &&
            score >= max
        );

        const atMinimum = (
            recorded &&
            score !== null &&
            score <= 0
        );

        if (plusOne) {
            plusOne.disabled = unavailable || atMaximum;
        }

        if (plusHalf) {
            plusHalf.disabled = unavailable || atMaximum;
        }

        if (minusHalf) {
            minusHalf.disabled = unavailable || !recorded || atMinimum;
        }

        if (minusOne) {
            minusOne.disabled = unavailable || !recorded || atMinimum;
        }

        if (undo) {
            undo.disabled = unavailable || state.gradeHistory.length === 0;
        }

        if (approve) {
            approve.disabled = unavailable || !recorded;
            approve.innerHTML = full
                ? '✓ الدرجة كاملة — اعتماد ومتابعة <span class="m0ar-key">Enter</span>'
                : '✓ اعتماد ← التالي غير المصحح <span class="m0ar-key">Enter</span>';
        }
    }

    function applyQuickScoreDelta(delta) {
        const question = currentQuestion();
        const gradeUI = $('#m0ar-grade');

        if (
            !question ||
            !gradeUI ||
            gradeUI.disabled ||
            !Number.isFinite(delta)
        ) {
            return;
        }

        syncGradeHistoryContext(question);

        const previousRaw = clean(gradeUI.value);
        const hadGrade = hasRecordedGrade(previousRaw);

        if (!hadGrade && delta < 0) {
            setStatus('لا توجد درجة حالية ليتم الخصم منها.');
            updateQuickGradeUI();
            return;
        }

        const current = hadGrade
            ? (parseScoreNumber(previousRaw) ?? 0)
            : 0;

        const max = getQuestionMaxNumber(question);
        let next = current + delta;

        next = Math.max(0, next);

        if (max !== null) {
            next = Math.min(max, next);
        }

        const nextValue = formatScore(next);

        if (hadGrade && nextValue === formatScore(current)) {
            setStatus(
                delta > 0
                    ? 'وصلت الدرجة إلى الحد الأعلى لهذا السؤال.'
                    : 'الدرجة عند الحد الأدنى.'
            );
            updateQuickGradeUI();
            return;
        }

        state.gradeHistory.push(previousRaw);

        if (state.gradeHistory.length > 30) {
            state.gradeHistory.shift();
        }

        gradeUI.value = nextValue;
        saveCurrentGrade({
            quiet: true
        });

        const maxLabel = max !== null
            ? ` / ${formatScore(max)}`
            : '';

        setStatus(
            `${delta > 0 ? '+' : ''}${formatScore(delta)} ← الدرجة الآن ${nextValue}${maxLabel}`
        );

        updateQuickGradeUI();
    }

    function undoQuickScore() {
        const question = currentQuestion();
        const gradeUI = $('#m0ar-grade');

        if (!question || !gradeUI || gradeUI.disabled) {
            return;
        }

        syncGradeHistoryContext(question);

        if (!state.gradeHistory.length) {
            setStatus('لا يوجد تعديل سريع سابق للتراجع عنه.');
            updateQuickGradeUI();
            return;
        }

        const previousValue = state.gradeHistory.pop();
        gradeUI.value = previousValue;

        saveCurrentGrade({
            quiet: true
        });

        setStatus(
            previousValue === ''
                ? '↶ تم التراجع وإعادة الدرجة إلى غير مصححة.'
                : `↶ تم التراجع. الدرجة الآن ${previousValue}.`
        );

        updateQuickGradeUI();
    }

    async function approveAndContinue() {
        if (state.navigatingStudent) {
            return;
        }

        const question = currentQuestion();
        const gradeUI = $('#m0ar-grade');

        if (!question || !gradeUI || gradeUI.disabled) {
            return;
        }

        if (!hasRecordedGrade(gradeUI.value)) {
            setStatus('رصد الدرجة أولاً، ثم استخدم «اعتماد ومتابعة».');
            updateQuickGradeUI();
            return;
        }

        saveCurrentGrade({
            quiet: true
        });
        flushCurrentReferenceNotes();
        await sleep(100);

        state.questions = scanUploadQuestions();

        const pending = getPendingQuestionIndexes(state.questions);

        if (pending.length) {
            const nextPending = pending.find(
                index => index > state.questionIndex
            );

            state.questionIndex = nextPending ?? pending[0];
            state.fileIndex = 0;
            state.gradeHistoryContext = '';
            state.gradeHistory = [];

            render({
                preferPending: false,
                statusMessage: '✓ تم اعتماد الدرجة والانتقال إلى سؤال المرفق التالي غير المصحح لهذا الطالب.'
            });

            return;
        }

        state.gradeHistoryContext = '';
        state.gradeHistory = [];

        const moved = await navigateStudent('next', {
            skipMode: true,
            saveBefore: false
        });

        if (!moved && state.open) {
            setStatus('✓ تم اعتماد الدرجة. لا يوجد طالب غير مصحح تالٍ في هذا الاتجاه.');
        }
    }

    /* =========================================================
       حفظ الدرجة
       ========================================================= */

    function saveCurrentGrade(options = {}) {
        const {
            quiet = false
        } = options;

        const question = currentQuestion();
        const gradeUI = $('#m0ar-grade');

        if (
            !question ||
            !question.gradeInput ||
            !gradeUI ||
            gradeUI.disabled
        ) {
            return;
        }

        let value = clean(gradeUI.value);
        const max = getQuestionMaxNumber(question);

        if (value !== '') {
            let number = parseScoreNumber(value);

            if (number !== null) {
                number = Math.max(0, number);

                if (max !== null) {
                    number = Math.min(number, max);
                }

                value = formatScore(number);
                gradeUI.value = value;
            }
        }

        setReactInputValue(
            question.gradeInput,
            value
        );

        question.grade = value;

        if (!quiet) {
            setStatus('✓ تم تحديث الدرجة في Forms');
        }

        /* إعادة قراءة الحالة الحقيقية من الصفحة */
        state.questions = scanUploadQuestions();
        setReviewState(state.questions);
        refreshCurrentStudentCountStatus(state.questions);
        updateQuickGradeUI();
    }

    /* =========================================================
       الصورة: تكبير / تدوير / سحب
       ========================================================= */

    function resetTransformState() {
        state.zoom = 1;
        state.rotation = 0;
        state.flipX = 1;
        state.flipY = 1;
        state.panX = 0;
        state.panY = 0;
        state.dragging = false;
        state.dragPointerId = null;
    }

    function applyTransform() {
        const image = $('#m0ar-image');

        if (!image) {
            return;
        }

        image.style.transform = [
            `translate3d(${state.panX}px, ${state.panY}px, 0)`,
            `rotate(${state.rotation}deg)`,
            `scale(${state.zoom})`,
            `scaleX(${state.flipX})`,
            `scaleY(${state.flipY})`
        ].join(' ');
    }

    function resetTransform() {
        resetTransformState();
        applyTransform();
        setStatus('✓ تمت ملاءمة الصورة وإعادتها للوضع الطبيعي');
    }

    function centerImage() {
        state.panX = 0;
        state.panY = 0;
        applyTransform();
        setStatus('◎ تم توسيط الصورة');
    }

    function changeZoom(delta) {
        const previous = state.zoom;

        state.zoom = Math.min(
            5,
            Math.max(
                0.2,
                state.zoom + delta
            )
        );

        if (
            state.zoom <= 1 &&
            previous > 1
        ) {
            state.panX = 0;
            state.panY = 0;
        }

        applyTransform();

        setStatus(
            `التكبير: ${Math.round(state.zoom * 100)}%`
        );
    }

    function getImageCandidates(url) {
        const result = [url];

        try {
            const download = new URL(url);
            download.searchParams.set('download', '1');
            result.push(download.href);

            const web = new URL(url);
            web.searchParams.set('web', '0');
            result.push(web.href);
        }
        catch (_) {}

        return [...new Set(result)];
    }

    async function showImage(file) {
        const media = $('#m0ar-media');

        if (!media) {
            return;
        }

        const token = ++state.imageToken;

        media.classList.remove('has-image', 'dragging');
        media.innerHTML = '<div id="m0ar-empty">جاري تحميل الصورة...</div>';

        setStatus('جاري تحميل الصورة...');

        const candidates = getImageCandidates(file.url);

        for (const url of candidates) {
            if (token !== state.imageToken) {
                return;
            }

            const result = await new Promise(resolve => {
                const image = new Image();

                const timer = setTimeout(() => {
                    image.src = '';
                    resolve({
                        ok: false
                    });
                }, 12000);

                image.onload = () => {
                    clearTimeout(timer);
                    resolve({
                        ok: true,
                        image
                    });
                };

                image.onerror = () => {
                    clearTimeout(timer);
                    resolve({
                        ok: false
                    });
                };

                image.src = url;
            });

            if (!result.ok) {
                continue;
            }

            if (token !== state.imageToken) {
                return;
            }

            const image = result.image;
            image.id = 'm0ar-image';
            image.alt = file.fileName;

            media.replaceChildren(image);
            media.classList.add('has-image');

            resetTransformState();
            applyTransform();

            setStatus(
                `✓ الصورة ${image.naturalWidth} × ${image.naturalHeight}`
            );

            preloadNextImage();
            return;
        }

        media.classList.remove('has-image', 'dragging');

        media.innerHTML = `
<div id="m0ar-empty">
    <strong>تعذر عرض الصورة</strong>
    استخدم زر «فتح الأصل».
</div>`;

        setStatus('تعذر العرض المباشر.');
    }

    function showPDF(file) {
        const media = $('#m0ar-media');

        if (!media) {
            return;
        }

        media.classList.remove('has-image', 'dragging');

        const frame = document.createElement('iframe');
        frame.src = file.url;
        frame.title = file.fileName;

        media.replaceChildren(frame);
        setStatus('PDF');
    }

    function showUnsupported(file) {
        const media = $('#m0ar-media');

        if (!media) {
            return;
        }

        media.classList.remove('has-image', 'dragging');

        media.innerHTML = `
<div id="m0ar-empty">
    <strong>${escapeHTML(file.ext ? file.ext.toUpperCase() : 'ملف')}</strong>
    لا يمكن عرض هذا النوع مباشرة.
    <br>
    استخدم «فتح الأصل».
</div>`;

        setStatus('الملف متاح للفتح.');
    }

    function showNoFile() {
        const media = $('#m0ar-media');

        if (!media) {
            return;
        }

        media.classList.remove('has-image', 'dragging');

        media.innerHTML = `
<div id="m0ar-empty">
    <strong>لا يوجد ملف مرفق</strong>
    لم يرفق هذا الطالب ملفًا لهذا السؤال.
</div>`;

        setStatus('');
    }

    function preloadImage(url) {
        if (!url) {
            return;
        }

        const image = new Image();
        image.src = url;
    }

    function preloadNextImage() {
        const question = currentQuestion();

        if (!question) {
            return;
        }

        const nextFile = question.files[state.fileIndex + 1];

        if (
            nextFile &&
            IMAGE_EXTS.has(nextFile.ext)
        ) {
            preloadImage(nextFile.url);
            return;
        }

        const nextQuestion = state.questions[state.questionIndex + 1];
        const first = nextQuestion?.files?.[0];

        if (
            first &&
            IMAGE_EXTS.has(first.ext)
        ) {
            preloadImage(first.url);
        }
    }

    /* =========================================================
       رسم الطالب الحالي
       ========================================================= */

    function render(options = {}) {
        const {
            preferPending = false,
            statusMessage = ''
        } = options;

        if (!state.open) {
            return;
        }

        state.questions = scanUploadQuestions();

        if (preferPending) {
            const pendingIndex = firstPendingQuestionIndex(state.questions);

            if (pendingIndex >= 0) {
                state.questionIndex = pendingIndex;
                state.fileIndex = 0;
            }
        }

        if (
            state.questionIndex >= state.questions.length
        ) {
            state.questionIndex = Math.max(
                0,
                state.questions.length - 1
            );
        }

        const name = $('#m0ar-name');
        const meta = $('#m0ar-person-meta');

        if (name) {
            name.textContent = getStudentName();
        }

        if (meta) {
            const respondent = getRespondentNumber();
            meta.textContent = respondent
                ? `المستجيب رقم ${respondent}`
                : '';
        }

        updateSkipButton();
        setReviewState(state.questions);

        if (
            state.unreviewedCountFormKey &&
            state.unreviewedCountFormKey !== getFormStorageKey()
        ) {
            state.unreviewedCount = null;
            state.countedStudents = null;
            state.unreviewedStatusMap = new Map();
            state.unreviewedCountFormKey = '';
        }

        updateUnreviewedCounterUI();

        const question = currentQuestion();

        updateReferenceVisibilityUI();

        const questionTitle = $('#m0ar-question');
        const questionCounter = $('#m0ar-question-counter');
        const fileName = $('#m0ar-filename');
        const fileCounter = $('#m0ar-file-counter');
        const grade = $('#m0ar-grade');
        const max = $('#m0ar-max');
        const qPrev = $('#m0ar-question-prev');
        const qNext = $('#m0ar-question-next');
        const fPrev = $('#m0ar-file-prev');
        const fNext = $('#m0ar-file-next');

        if (!question) {
            questionTitle.textContent = 'لا توجد أسئلة رفع ملفات';
            questionCounter.textContent = '0 من 0';
            fileName.textContent = '—';
            fileCounter.textContent = '0 من 0';
            grade.value = '';
            grade.disabled = true;
            max.textContent = '/ —';
            qPrev.disabled = true;
            qNext.disabled = true;
            fPrev.disabled = true;
            fNext.disabled = true;

            const media = $('#m0ar-media');
            const studentPaneFile = $('#m0ar-student-pane-file');
            media?.classList.remove('has-image', 'dragging');

            if (studentPaneFile) {
                studentPaneFile.textContent = '';
            }

            if (state.referenceLoadedKey) {
                state.referenceLoadedKey = '';
                loadReferenceForQuestion(null);
            }

            if (media) {
                media.innerHTML = `
<div id="m0ar-empty">
    <strong>لا توجد مرفقات</strong>
    لم يتم العثور على سؤال رفع ملفات لهذا المستجيب.
</div>`;
            }

            state.gradeHistoryContext = '';
            state.gradeHistory = [];
            updateQuickGradeUI();

            if (statusMessage) {
                setStatus(statusMessage);
            }

            return;
        }

        questionTitle.textContent = question.title || 'سؤال رفع ملف';
        questionCounter.textContent =
            `السؤال ${state.questionIndex + 1} من ${state.questions.length}`;

        if (state.referenceLoadedKey !== question.storageKey) {
            loadReferenceForQuestion(question);
        }

        qPrev.disabled = state.questionIndex <= 0;
        qNext.disabled = state.questionIndex >= state.questions.length - 1;

        grade.disabled = !question.gradeInput;
        grade.value = question.grade ?? '';
        max.textContent = question.maxPoints
            ? `/ ${question.maxPoints}`
            : '/ —';

        syncGradeHistoryContext(question);
        updateQuickGradeUI();

        if (
            state.fileIndex >= question.files.length
        ) {
            state.fileIndex = Math.max(
                0,
                question.files.length - 1
            );
        }

        const file = currentFile();

        if (!file) {
            const studentPaneFile = $('#m0ar-student-pane-file');
            if (studentPaneFile) {
                studentPaneFile.textContent = 'لا يوجد ملف';
            }

            fileName.textContent = 'لا يوجد ملف';
            fileCounter.textContent = '0 من 0';
            fPrev.disabled = true;
            fNext.disabled = true;
            showNoFile();

            if (statusMessage) {
                setStatus(statusMessage);
            }

            return;
        }

        fileName.textContent = file.fileName;

        const studentPaneFile = $('#m0ar-student-pane-file');
        if (studentPaneFile) {
            studentPaneFile.textContent = file.fileName;
        }

        fileCounter.textContent =
            `الملف ${state.fileIndex + 1} من ${question.files.length}`;

        fPrev.disabled = state.fileIndex <= 0;
        fNext.disabled = state.fileIndex >= question.files.length - 1;

        resetTransformState();

        if (IMAGE_EXTS.has(file.ext)) {
            showImage(file).then(() => {
                if (statusMessage) {
                    setStatus(statusMessage);
                }
            });
            return;
        }

        if (PDF_EXTS.has(file.ext)) {
            showPDF(file);

            if (statusMessage) {
                setStatus(statusMessage);
            }

            return;
        }

        showUnsupported(file);

        if (statusMessage) {
            setStatus(statusMessage);
        }
    }

    /* =========================================================
       التنقل داخل السؤال والملفات
       ========================================================= */

    function previousFile() {
        if (state.fileIndex <= 0) {
            return;
        }

        state.fileIndex--;
        render();
    }

    function nextFile() {
        const question = currentQuestion();

        if (
            !question ||
            state.fileIndex >= question.files.length - 1
        ) {
            return;
        }

        state.fileIndex++;
        render();
    }

    function previousQuestion() {
        if (state.questionIndex <= 0) {
            return;
        }

        saveCurrentGrade();
        flushCurrentReferenceNotes();
        state.questionIndex--;
        state.fileIndex = 0;
        state.gradeHistoryContext = '';
        state.gradeHistory = [];
        render();
    }

    function nextQuestion() {
        if (
            state.questionIndex >= state.questions.length - 1
        ) {
            return;
        }

        saveCurrentGrade();
        flushCurrentReferenceNotes();
        state.questionIndex++;
        state.fileIndex = 0;
        state.gradeHistoryContext = '';
        state.gradeHistory = [];
        render();
    }

    /* =========================================================
       بصمة الطالب وانتظار تحديث React
       ========================================================= */

    function studentFingerprint() {
        const questions = scanUploadQuestions();

        return [
            getRespondentNumber(),
            getStudentName(),
            questions
                .map(question => [
                    question.title,
                    question.gradeInput?.value ?? '',
                    question.files
                        .map(file => file.fileName)
                        .join(',')
                ].join('|'))
                .join('||')
        ].join('###');
    }

    async function waitForStudentChange(before, timeout = 9000) {
        const started = Date.now();

        while (
            Date.now() - started < timeout
        ) {
            await sleep(160);

            const after = studentFingerprint();

            if (
                after &&
                after !== before
            ) {
                await sleep(250);
                return after;
            }
        }

        return '';
    }

    function getStudentNavigationButton(direction) {
        return document.querySelector(
            direction === 'next'
                ? 'button[aria-label="الشخص التالي"]'
                : 'button[aria-label="الشخص السابق"]'
        );
    }

    function getCurrentStudentStableKey() {
        return [
            getRespondentNumber(),
            getStudentName()
        ].join('::');
    }

    function updateUnreviewedCounterUI() {
        const button = $('#m0ar-unreviewed-counter');
        const value = $('#m0ar-unreviewed-value');

        if (!button || !value) {
            return;
        }

        button.classList.toggle('counting', state.countingUnreviewed);
        button.classList.toggle(
            'ready',
            Number.isInteger(state.unreviewedCount)
        );

        if (state.countingUnreviewed) {
            value.textContent = 'جاري الحساب…';
            return;
        }

        if (Number.isInteger(state.unreviewedCount)) {
            value.textContent = String(state.unreviewedCount);

            button.title = Number.isInteger(state.countedStudents)
                ? `غير المصححين: ${state.unreviewedCount} من أصل ${state.countedStudents} مستجيبًا تم فحصهم. اضغط لإعادة الحساب.`
                : 'اضغط لإعادة حساب غير المصححين.';

            return;
        }

        value.textContent = 'احسب ↻';
        button.title = 'اضغط لحساب العدد الدقيق للطلاب الذين ما زال لديهم مرفق غير مصحح.';
    }

    function updateCountOverlay(show, message = '') {
        const overlay = $('#m0ar-count-overlay');
        const progress = $('#m0ar-count-overlay-progress');

        if (!overlay) {
            return;
        }

        overlay.hidden = !show;

        if (progress && message) {
            progress.textContent = message;
        }
    }

    function refreshCurrentStudentCountStatus(questions = state.questions) {
        if (!Number.isInteger(state.unreviewedCount)) {
            return;
        }

        const key = getCurrentStudentStableKey();

        if (!key || !state.unreviewedStatusMap.has(key)) {
            return;
        }

        const before = state.unreviewedStatusMap.get(key);
        const now = studentNeedsAttachmentReview(questions);

        if (before === now) {
            return;
        }

        state.unreviewedStatusMap.set(key, now);
        state.unreviewedCount += now ? 1 : -1;
        state.unreviewedCount = Math.max(0, state.unreviewedCount);
        updateUnreviewedCounterUI();
    }

    async function stepStudentForCount(direction, timeout = 6500) {
        const button = getStudentNavigationButton(direction);

        if (
            !button ||
            button.disabled ||
            button.getAttribute('aria-disabled') === 'true'
        ) {
            return false;
        }

        const before = studentFingerprint();
        button.click();

        return !!(await waitForStudentChange(before, timeout));
    }

    async function countUnreviewedStudents() {
        if (
            !state.open ||
            state.countingUnreviewed ||
            state.navigatingStudent
        ) {
            return;
        }

        saveCurrentGrade({ quiet: true });
        flushCurrentReferenceNotes();
        await sleep(120);

        state.countingUnreviewed = true;
        updateUnreviewedCounterUI();
        updateCountOverlay(true, 'جاري فحص المستجيب الحالي...');

        const originalKey = getCurrentStudentStableKey();
        const originalQuestionIndex = state.questionIndex;
        const originalFileIndex = state.fileIndex;
        const visited = new Set();
        const statusMap = new Map();

        let unreviewed = 0;
        let checked = 0;
        let forwardSteps = 0;
        let backwardSteps = 0;

        const inspectCurrent = () => {
            const key = getCurrentStudentStableKey();

            if (!key || visited.has(key)) {
                return;
            }

            visited.add(key);

            const questions = scanUploadQuestions();
            const pending = studentNeedsAttachmentReview(questions);

            statusMap.set(key, pending);
            checked++;

            if (pending) {
                unreviewed++;
            }

            updateCountOverlay(
                true,
                `تم فحص ${checked} مستجيبًا • غير المصححين حتى الآن: ${unreviewed}`
            );
        };

        try {
            inspectCurrent();

            for (let safety = 0; safety < 500; safety++) {
                const moved = await stepStudentForCount('next');

                if (!moved) {
                    break;
                }

                forwardSteps++;
                inspectCurrent();
            }

            updateCountOverlay(
                true,
                `اكتمل الاتجاه التالي. جاري الرجوع لنقطة البداية...`
            );

            for (let index = 0; index < forwardSteps; index++) {
                if (!(await stepStudentForCount('prev'))) {
                    break;
                }
            }

            for (let safety = 0; safety < 500; safety++) {
                const moved = await stepStudentForCount('prev');

                if (!moved) {
                    break;
                }

                backwardSteps++;
                inspectCurrent();
            }

            updateCountOverlay(
                true,
                `اكتمل الفحص. جاري العودة إلى الطالب الذي كنت عليه...`
            );

            for (let index = 0; index < backwardSteps; index++) {
                if (!(await stepStudentForCount('next'))) {
                    break;
                }
            }

            /* احتياط: إذا لم نعد لنفس الطالب بسبب تحديث بطيء، نحاول تحديد الاتجاه من رقم المستجيب. */
            for (let safety = 0; safety < 40; safety++) {
                const currentKey = getCurrentStudentStableKey();

                if (currentKey === originalKey) {
                    break;
                }

                const currentNumber = Number(normalizeDigits(getRespondentNumber()));
                const originalNumber = Number(
                    normalizeDigits(originalKey.split('::')[0] || '')
                );

                if (!Number.isFinite(currentNumber) || !Number.isFinite(originalNumber)) {
                    break;
                }

                const direction = currentNumber < originalNumber
                    ? 'next'
                    : 'prev';

                if (!(await stepStudentForCount(direction))) {
                    break;
                }
            }

            state.unreviewedCount = unreviewed;
            state.countedStudents = checked;
            state.unreviewedStatusMap = statusMap;
            state.unreviewedCountFormKey = getFormStorageKey();
            state.questionIndex = originalQuestionIndex;
            state.fileIndex = originalFileIndex;
        }
        catch (error) {
            console.error('تعذر حساب غير المصححين:', error);
            setStatus('تعذر إكمال عداد غير المصححين. يمكنك إعادة المحاولة من العداد العلوي.');
        }
        finally {
            state.countingUnreviewed = false;
            updateCountOverlay(false);
            updateUnreviewedCounterUI();

            render({
                preferPending: state.skipGraded,
                statusMessage: Number.isInteger(state.unreviewedCount)
                    ? `✓ غير المصححين حاليًا: ${state.unreviewedCount} من ${state.countedStudents}.`
                    : ''
            });
        }
    }

    /* =========================================================
       التنقل بين الطلاب + تجاوز المصححين
       ========================================================= */

    async function navigateStudent(direction, options = {}) {
        const {
            skipMode = state.skipGraded,
            saveBefore = true
        } = options;

        if (state.navigatingStudent || state.countingUnreviewed) {
            return false;
        }

        state.navigatingStudent = true;

        try {
            if (saveBefore) {
                saveCurrentGrade();
                flushCurrentReferenceNotes();
                await sleep(100);
            }

            let skipped = 0;
            let before = studentFingerprint();
            const visited = new Set([before]);

            const media = $('#m0ar-media');
            media?.classList.remove('has-image', 'dragging');

            for (let safety = 0; safety < 500; safety++) {
                const button = getStudentNavigationButton(direction);

                if (
                    !button ||
                    button.disabled ||
                    button.getAttribute('aria-disabled') === 'true'
                ) {
                    render({
                        preferPending: skipMode,
                        statusMessage:
                            skipMode && skipped
                                ? `انتهى الاتجاه بعد تجاوز ${skipped} طالب/طلاب مصححين. لا يوجد طالب غير مصحح بعد ذلك.`
                                : direction === 'next'
                                    ? 'لا يوجد طالب تالٍ.'
                                    : 'لا يوجد طالب سابق.'
                    });

                    return false;
                }

                if (media) {
                    media.innerHTML = `
<div id="m0ar-empty">
    <strong>${
        skipMode
            ? 'جاري البحث عن طالب غير مصحح...'
            : 'جاري تحميل الطالب...'
    }</strong>
    ${
        skipMode && skipped
            ? `تم تجاوز ${skipped} حتى الآن.`
            : ''
    }
</div>`;
                }

                setStatus(
                    skipMode
                        ? `جاري البحث... تم تجاوز ${skipped}`
                        : 'جاري الانتقال...'
                );

                button.click();

                const after = await waitForStudentChange(before);

                if (!after) {
                    render({
                        preferPending: skipMode,
                        statusMessage: 'انتهت مهلة الانتقال.'
                    });

                    return false;
                }

                if (visited.has(after)) {
                    render({
                        preferPending: skipMode,
                        statusMessage: 'تم إيقاف البحث لتجنب تكرار نفس الطلاب.'
                    });

                    return false;
                }

                visited.add(after);
                before = after;

                const questions = scanUploadQuestions();

                if (!skipMode) {
                    state.questionIndex = 0;
                    state.fileIndex = 0;
                    state.questions = questions;
                    state.gradeHistoryContext = '';
                    state.gradeHistory = [];

                    render();
                    return true;
                }

                if (studentNeedsAttachmentReview(questions)) {
                    const pendingIndex = firstPendingQuestionIndex(questions);

                    state.questions = questions;
                    state.questionIndex = pendingIndex >= 0
                        ? pendingIndex
                        : 0;
                    state.fileIndex = 0;
                    state.gradeHistoryContext = '';
                    state.gradeHistory = [];

                    render({
                        preferPending: true,
                        statusMessage:
                            skipped > 0
                                ? `✓ تم تجاوز ${skipped} طالب/طلاب مصححين والوصول إلى أول مرفق غير مصحح.`
                                : '✓ هذا الطالب لديه مرفق غير مصحح.'
                    });

                    return true;
                }

                /*
                لا يوجد شيء يحتاج تصحيحاً لهذا الطالب:
                - إما أن درجات كل مرفقاته مرصودة
                - أو أنه لا يملك مرفقات أصلاً
                */
                skipped++;
            }

            render({
                preferPending: true,
                statusMessage: 'تم إيقاف البحث بعد الوصول إلى الحد الآمن.'
            });

            return false;
        }
        finally {
            state.navigatingStudent = false;
        }
    }

    async function seekFirstUnreviewedFromCurrent() {
        if (
            !state.open ||
            !state.skipGraded ||
            state.navigatingStudent
        ) {
            return;
        }

        state.questions = scanUploadQuestions();

        if (studentNeedsAttachmentReview(state.questions)) {
            const pending = firstPendingQuestionIndex(state.questions);

            state.questionIndex = pending >= 0
                ? pending
                : 0;
            state.fileIndex = 0;

            render({
                preferPending: true,
                statusMessage: '✓ تم فتح أول مرفق غير مصحح لهذا الطالب.'
            });

            return;
        }

        /*
        نبحث أولاً إلى الأمام. وإذا لم نجد طالباً غير مصحح،
        نرجع بالبحث إلى الخلف أيضاً حتى لا يعتمد الأمر على موضع
        الطالب الذي كانت صفحة Forms واقفة عنده وقت فتح العارض.
        */
        const foundForward = await navigateStudent('next', {
            skipMode: true,
            saveBefore: false
        });

        if (
            !foundForward &&
            state.open &&
            state.skipGraded
        ) {
            await navigateStudent('prev', {
                skipMode: true,
                saveBefore: false
            });
        }
    }

    async function toggleSkipGraded() {
        if (state.navigatingStudent) {
            return;
        }

        saveCurrentGrade();

        state.skipGraded = !state.skipGraded;
        writeSkipPreference(state.skipGraded);
        updateSkipButton();

        if (!state.skipGraded) {
            setStatus('تجاوز الطلاب المصححين متوقف. التنقل أصبح عاديًا.');
            return;
        }

        state.questions = scanUploadQuestions();
        setReviewState(state.questions);

        if (studentNeedsAttachmentReview(state.questions)) {
            const pending = firstPendingQuestionIndex(state.questions);

            state.questionIndex = pending >= 0
                ? pending
                : 0;
            state.fileIndex = 0;

            render({
                preferPending: true,
                statusMessage: '⏭ تم تفعيل تجاوز المصححين. أزرار الطلاب ستنتقل فقط لغير المصححين.'
            });

            return;
        }

        setStatus('⏭ تم التفعيل. جاري البحث عن أول طالب غير مصحح...');

        await navigateStudent('next', {
            skipMode: true,
            saveBefore: false
        });
    }

    /* =========================================================
       الدرجات السريعة
       ========================================================= */

    function setQuickScore(value) {
        const question = currentQuestion();
        const grade = $('#m0ar-grade');

        if (
            !question ||
            !grade ||
            grade.disabled
        ) {
            return;
        }

        syncGradeHistoryContext(question);
        state.gradeHistory.push(clean(grade.value));

        if (state.gradeHistory.length > 30) {
            state.gradeHistory.shift();
        }

        grade.value = value;
        saveCurrentGrade();
        updateQuickGradeUI();
    }

    /* =========================================================
       السحب بالماوس
       ========================================================= */

    function startDrag(event) {
        const media = $('#m0ar-media');
        const image = $('#m0ar-image');

        if (
            !media ||
            !image ||
            event.button !== 0
        ) {
            return;
        }

        event.preventDefault();

        state.dragging = true;
        state.dragPointerId = event.pointerId;
        state.dragStartX = event.clientX;
        state.dragStartY = event.clientY;
        state.dragStartPanX = state.panX;
        state.dragStartPanY = state.panY;

        media.classList.add('dragging');

        try {
            media.setPointerCapture(event.pointerId);
        }
        catch (_) {}
    }

    function moveDrag(event) {
        if (
            !state.dragging ||
            event.pointerId !== state.dragPointerId
        ) {
            return;
        }

        event.preventDefault();

        state.panX =
            state.dragStartPanX +
            (event.clientX - state.dragStartX);

        state.panY =
            state.dragStartPanY +
            (event.clientY - state.dragStartY);

        applyTransform();
    }

    function endDrag(event) {
        if (!state.dragging) {
            return;
        }

        if (
            state.dragPointerId !== null &&
            event.pointerId !== state.dragPointerId
        ) {
            return;
        }

        const media = $('#m0ar-media');

        state.dragging = false;

        if (media) {
            media.classList.remove('dragging');

            try {
                if (state.dragPointerId !== null) {
                    media.releasePointerCapture(state.dragPointerId);
                }
            }
            catch (_) {}
        }

        state.dragPointerId = null;
    }

    function wheelZoom(event) {
        if (!$('#m0ar-image')) {
            return;
        }

        event.preventDefault();

        changeZoom(
            event.deltaY < 0
                ? 0.15
                : -0.15
        );
    }

    /* =========================================================
       أحداث الواجهة
       ========================================================= */

    function bindViewerEvents() {
        $('#m0ar-close').addEventListener('click', closeViewer);

        $('#m0ar-reference-toggle').addEventListener(
            'click',
            toggleReferenceVisibility
        );

        $('#m0ar-unreviewed-counter').addEventListener(
            'click',
            countUnreviewedStudents
        );

        const splitter = $('#m0ar-splitter');

        splitter.addEventListener('pointerdown', startSplitResize);
        splitter.addEventListener('pointermove', moveSplitResize);
        splitter.addEventListener('pointerup', endSplitResize);
        splitter.addEventListener('pointercancel', endSplitResize);
        splitter.addEventListener('dblclick', resetSplitResize);
        splitter.addEventListener(
            'lostpointercapture',
            () => {
                if (state.resizingSplit) {
                    state.resizingSplit = false;
                    state.splitPointerId = null;
                    splitter.classList.remove('dragging');
                    writeSplitPreference(state.referencePanePercent);
                }
            }
        );

        $('#m0ar-ref-tab-model').addEventListener(
            'click',
            () => switchReferenceMode('model')
        );

        $('#m0ar-ref-tab-original').addEventListener(
            'click',
            () => switchReferenceMode('original')
        );

        $('#m0ar-reference-file-input').addEventListener(
            'change',
            async event => {
                const input = event.currentTarget;
                const file = input.files?.[0] || null;

                if (file) {
                    await handleReferenceFileSelection(file);
                }

                input.value = '';
            }
        );

        $('#m0ar-reference-delete').addEventListener(
            'click',
            deleteCurrentReferenceFile
        );

        $('#m0ar-reference-notes').addEventListener(
            'input',
            scheduleReferenceNotesSave
        );

        $('#m0ar-reference-notes').addEventListener(
            'blur',
            flushCurrentReferenceNotes
        );

        $('#m0ar-ref-plus').addEventListener(
            'click',
            () => changeReferenceZoom(0.2)
        );

        $('#m0ar-ref-minus').addEventListener(
            'click',
            () => changeReferenceZoom(-0.2)
        );

        $('#m0ar-ref-fit').addEventListener(
            'click',
            resetReferenceTransform
        );

        $('#m0ar-ref-center').addEventListener(
            'click',
            centerReferenceImage
        );

        $('#m0ar-ref-rotate').addEventListener(
            'click',
            () => {
                state.refRotation = (state.refRotation + 90) % 360;
                applyReferenceTransform();
            }
        );

        $('#m0ar-skip-toggle').addEventListener(
            'click',
            toggleSkipGraded
        );

        $('#m0ar-question-prev').addEventListener(
            'click',
            previousQuestion
        );

        $('#m0ar-question-next').addEventListener(
            'click',
            nextQuestion
        );

        $('#m0ar-file-prev').addEventListener(
            'click',
            previousFile
        );

        $('#m0ar-file-next').addEventListener(
            'click',
            nextFile
        );

        const previousStudent = () => navigateStudent('prev');
        const nextStudent = () => navigateStudent('next');

        $('#m0ar-student-prev').addEventListener(
            'click',
            previousStudent
        );

        $('#m0ar-student-prev-top').addEventListener(
            'click',
            previousStudent
        );

        $('#m0ar-student-next').addEventListener(
            'click',
            nextStudent
        );

        $('#m0ar-student-next-top').addEventListener(
            'click',
            nextStudent
        );

        $('#m0ar-grade').addEventListener(
            'change',
            () => {
                saveCurrentGrade();
                updateQuickGradeUI();
            }
        );

        $('#m0ar-grade').addEventListener(
            'keydown',
            event => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    saveCurrentGrade();
                    event.currentTarget.blur();
                }
            }
        );

        $('#m0ar-zero-score').addEventListener(
            'click',
            () => setQuickScore('0')
        );

        $('#m0ar-full-score').addEventListener(
            'click',
            () => {
                const question = currentQuestion();

                if (!question?.maxPoints) {
                    return;
                }

                setQuickScore(question.maxPoints);
            }
        );

        $('#m0ar-score-plus-one').addEventListener(
            'click',
            () => applyQuickScoreDelta(1)
        );

        $('#m0ar-score-plus-half').addEventListener(
            'click',
            () => applyQuickScoreDelta(0.5)
        );

        $('#m0ar-score-minus-half').addEventListener(
            'click',
            () => applyQuickScoreDelta(-0.5)
        );

        $('#m0ar-score-minus-one').addEventListener(
            'click',
            () => applyQuickScoreDelta(-1)
        );

        $('#m0ar-quick-undo').addEventListener(
            'click',
            undoQuickScore
        );

        $('#m0ar-quick-approve').addEventListener(
            'click',
            approveAndContinue
        );

        $('#m0ar-plus').addEventListener(
            'click',
            () => changeZoom(0.2)
        );

        $('#m0ar-minus').addEventListener(
            'click',
            () => changeZoom(-0.2)
        );

        $('#m0ar-fit').addEventListener(
            'click',
            resetTransform
        );

        $('#m0ar-center').addEventListener(
            'click',
            centerImage
        );

        $('#m0ar-rotate').addEventListener(
            'click',
            () => {
                state.rotation = (state.rotation + 90) % 360;
                applyTransform();
            }
        );

        $('#m0ar-flip-x').addEventListener(
            'click',
            () => {
                state.flipX *= -1;
                applyTransform();

                setStatus(
                    state.flipX === -1
                        ? '↔ تم عكس الصورة أفقيًا'
                        : '↔ تم إلغاء العكس الأفقي'
                );
            }
        );

        $('#m0ar-flip-y').addEventListener(
            'click',
            () => {
                state.flipY *= -1;
                applyTransform();

                setStatus(
                    state.flipY === -1
                        ? '↕ تم عكس الصورة رأسيًا'
                        : '↕ تم إلغاء العكس الرأسي'
                );
            }
        );

        $('#m0ar-original').addEventListener(
            'click',
            () => {
                const file = currentFile();

                if (!file) {
                    return;
                }

                window.open(
                    file.url,
                    '_blank',
                    'noopener,noreferrer'
                );
            }
        );

        const media = $('#m0ar-media');

        media.addEventListener('pointerdown', startDrag);
        media.addEventListener('pointermove', moveDrag);
        media.addEventListener('pointerup', endDrag);
        media.addEventListener('pointercancel', endDrag);

        media.addEventListener(
            'lostpointercapture',
            () => {
                state.dragging = false;
                state.dragPointerId = null;
                media.classList.remove('dragging');
            }
        );

        media.addEventListener(
            'wheel',
            wheelZoom,
            {
                passive: false
            }
        );

        const referenceMedia = $('#m0ar-reference-media');

        referenceMedia.addEventListener('pointerdown', startReferenceDrag);
        referenceMedia.addEventListener('pointermove', moveReferenceDrag);
        referenceMedia.addEventListener('pointerup', endReferenceDrag);
        referenceMedia.addEventListener('pointercancel', endReferenceDrag);

        referenceMedia.addEventListener(
            'lostpointercapture',
            () => {
                state.refDragging = false;
                state.refDragPointerId = null;
                referenceMedia.classList.remove('dragging');
            }
        );

        referenceMedia.addEventListener(
            'wheel',
            referenceWheelZoom,
            {
                passive: false
            }
        );
    }

    /* =========================================================
       لوحة المفاتيح
       ========================================================= */

    function keyboardHandler(event) {
        if (!state.open || state.countingUnreviewed) {
            return;
        }

        const app = document.getElementById(APP_ID);
        const target = event.target;
        const targetId = target?.id || '';

        const isEditableTarget = !!(
            target &&
            (
                /INPUT|TEXTAREA|SELECT/.test(target.tagName || '') ||
                target.isContentEditable
            )
        );

        const isReferenceNotes = targetId === 'm0ar-reference-notes';
        const plainKey = !event.ctrlKey && !event.altKey && !event.metaKey;
        const pageDown = event.code === 'PageDown' || event.key === 'PageDown';
        const pageUp = event.code === 'PageUp' || event.key === 'PageUp';

        /*
        PgDn / PgUp = التنقل بين ملفات/مرفقات الطالب داخل السؤال الحالي.
        Shift + PgDn / PgUp = التنقل بين أسئلة المرفقات.

        نستخدم event.code قدر الإمكان لأن code يمثل المفتاح الفعلي في
        لوحة المفاتيح ولا يتغير عند التحويل بين العربية والإنجليزية.
        */
        if (
            plainKey &&
            !event.repeat &&
            !isReferenceNotes &&
            pageDown
        ) {
            event.preventDefault();
            event.stopPropagation();

            if (event.shiftKey) {
                nextQuestion();
            }
            else {
                nextFile();
            }

            focusViewerShell();
            return;
        }

        if (
            plainKey &&
            !event.repeat &&
            !isReferenceNotes &&
            pageUp
        ) {
            event.preventDefault();
            event.stopPropagation();

            if (event.shiftKey) {
                previousQuestion();
            }
            else {
                previousFile();
            }

            focusViewerShell();
            return;
        }

        /*
        عندما يكتب المستخدم بنفسه داخل حقول العارض لا نحول الكتابة
        إلى أوامر. تم التعامل مع PgUp/PgDn أعلاه بشكل مستقل.
        */
        if (
            isEditableTarget &&
            app?.contains(target)
        ) {
            return;
        }

        /*
        اختصارات التصحيح السريع.
        الاعتماد هنا على event.code يجعلها تعمل مع تخطيط الكيبورد
        العربي أو الإنجليزي بنفس المفتاح الفعلي.
        */
        if (
            !event.repeat &&
            plainKey &&
            (event.code === 'Digit1' || event.code === 'Numpad1')
        ) {
            event.preventDefault();
            event.stopPropagation();
            applyQuickScoreDelta(1);
            focusViewerShell();
            return;
        }

        if (
            !event.repeat &&
            plainKey &&
            (event.code === 'Digit5' || event.code === 'Numpad5')
        ) {
            event.preventDefault();
            event.stopPropagation();
            applyQuickScoreDelta(0.5);
            focusViewerShell();
            return;
        }

        if (
            !event.repeat &&
            plainKey &&
            event.code === 'KeyZ'
        ) {
            event.preventDefault();
            event.stopPropagation();
            undoQuickScore();
            focusViewerShell();
            return;
        }

        if (
            plainKey &&
            !event.repeat &&
            (event.code === 'Enter' || event.code === 'NumpadEnter' || event.key === 'Enter')
        ) {
            event.preventDefault();
            event.stopPropagation();
            approveAndContinue();
            return;
        }

        /* التنقل بين الطلاب */
        if (plainKey && !event.repeat && event.code === 'ArrowRight') {
            event.preventDefault();
            event.stopPropagation();
            navigateStudent('next');
            return;
        }

        if (plainKey && !event.repeat && event.code === 'ArrowLeft') {
            event.preventDefault();
            event.stopPropagation();
            navigateStudent('prev');
            return;
        }

        /* تكبير وتصغير مستقل عن لغة لوحة المفاتيح */
        if (
            plainKey &&
            !event.repeat &&
            (
                event.code === 'NumpadAdd' ||
                (event.code === 'Equal' && event.shiftKey) ||
                event.key === '+'
            )
        ) {
            event.preventDefault();
            event.stopPropagation();
            changeZoom(0.2);
            return;
        }

        if (
            plainKey &&
            !event.repeat &&
            (
                event.code === 'Minus' ||
                event.code === 'NumpadSubtract' ||
                event.key === '-'
            )
        ) {
            event.preventDefault();
            event.stopPropagation();
            changeZoom(-0.2);
            return;
        }

        if (plainKey && !event.repeat && event.code === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            closeViewer();
            return;
        }

        /*
        R / H / V / C تعمل بالمفتاح الفيزيائي نفسه حتى لو كانت
        لغة الكيبورد عربية وقت التصحيح.
        */
        if (plainKey && !event.repeat && event.code === 'KeyR') {
            event.preventDefault();
            event.stopPropagation();
            $('#m0ar-rotate')?.click();
            focusViewerShell();
            return;
        }

        if (plainKey && !event.repeat && event.code === 'KeyH') {
            event.preventDefault();
            event.stopPropagation();
            $('#m0ar-flip-x')?.click();
            focusViewerShell();
            return;
        }

        if (plainKey && !event.repeat && event.code === 'KeyV') {
            event.preventDefault();
            event.stopPropagation();
            $('#m0ar-flip-y')?.click();
            focusViewerShell();
            return;
        }

        if (plainKey && !event.repeat && event.code === 'KeyC') {
            event.preventDefault();
            event.stopPropagation();
            centerImage();
            focusViewerShell();
        }
    }

    function focusViewerShell() {
        setTimeout(() => {
            try {
                const active = document.activeElement;

                if (
                    active?.id === 'm0ar-reference-notes' ||
                    active?.id === 'm0ar-grade'
                ) {
                    return;
                }

                document
                    .getElementById(APP_ID)
                    ?.focus({ preventScroll: true });
            }
            catch (_) {}
        }, 0);
    }

    window.addEventListener(
        'keydown',
        keyboardHandler,
        true
    );

    /* =========================================================
       إغلاق العارض
       ========================================================= */

    function closeViewer() {
        if (!state.open) {
            return;
        }

        try {
            saveCurrentGrade();
            flushCurrentReferenceNotes();
        }
        catch (_) {}

        clearTimeout(state.referenceNotesTimer);
        state.referenceNotesTimer = null;
        state.open = false;
        state.imageToken++;
        state.referenceToken++;
        state.referenceLoadedKey = '';
        revokeReferenceObjectURL();

        document.getElementById(APP_ID)?.remove();
        document.getElementById(STYLE_ID)?.remove();

        installLauncher();
    }

    /* =========================================================
       مراقبة React لإعادة زر التشغيل إذا تغير الشريط
       ========================================================= */

    const observer = new MutationObserver(() => {
        clearTimeout(launcherTimer);

        launcherTimer = setTimeout(
            installLauncher,
            300
        );
    });

    observer.observe(
        document.documentElement,
        {
            childList: true,
            subtree: true
        }
    );

    /* =========================================================
       API
       ========================================================= */

    window.FORMS_ATTACHMENT_REVIEWER = Object.freeze({
        version: VERSION,
        open: openViewer,
        close: closeViewer,
        scan: scanUploadQuestions,

        getCurrentReferenceKey: () =>
            currentQuestion()?.storageKey || '',

        showReference: () => {
            state.referenceVisible = true;
            updateReferenceVisibilityUI();
        },

        hideReference: () => {
            state.referenceVisible = false;
            updateReferenceVisibilityUI();
        },

        addOnePoint: () =>
            applyQuickScoreDelta(1),

        addHalfPoint: () =>
            applyQuickScoreDelta(0.5),

        subtractOnePoint: () =>
            applyQuickScoreDelta(-1),

        subtractHalfPoint: () =>
            applyQuickScoreDelta(-0.5),

        undoQuickScore,

        approveAndContinue,

        needsReview: () =>
            studentNeedsAttachmentReview(
                scanUploadQuestions()
            ),

        isSkipGradedEnabled: () =>
            state.skipGraded,

        setSkipGraded: async enabled => {
            const wanted = !!enabled;

            if (state.skipGraded === wanted) {
                return state.skipGraded;
            }

            state.skipGraded = wanted;
            writeSkipPreference(wanted);
            updateSkipButton();

            if (
                wanted &&
                state.open &&
                !studentNeedsAttachmentReview(
                    scanUploadQuestions()
                )
            ) {
                await seekFirstUnreviewedFromCurrent();
            }

            return state.skipGraded;
        },

        nextStudent: () =>
            navigateStudent('next'),

        previousStudent: () =>
            navigateStudent('prev')
    });

    /* =========================================================
       التشغيل
       ========================================================= */

    installLauncher();

    console.log(
        '%cMicrosoft Forms Attachment Reviewer',
        'font-size:16px;font-weight:bold;color:#2563eb'
    );

    console.log('الإصدار:', VERSION);
    console.log('المطور:', `${DEVELOPER.name} (${DEVELOPER.handle})`);
    console.log('تجاوز المصححين:', state.skipGraded ? 'مفعّل' : 'متوقف');
    console.log('اختصارات التصحيح: 1 = +1 | 5 = +0.5 | Z = تراجع | Enter = اعتماد ومتابعة');
    console.log('PgDn/PgUp: الملف التالي/السابق | Shift+PgDn/PgUp: سؤال المرفق التالي/السابق');
    console.log('V1.3.3: اختصارات R/H/V/Z وغيرها تعمل مع تخطيط الكيبورد العربي والإنجليزي باستخدام المفاتيح الفيزيائية.');
    console.log(DEVELOPER.copyright);

})();

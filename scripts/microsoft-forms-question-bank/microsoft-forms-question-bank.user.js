// ==UserScript==
// @name         Microsoft Forms - بنك الأسئلة والإدخال الجماعي
// @namespace    https://greasyfork.org/users/1636459
// @version      0.7.0
// @description  بنك أسئلة احترافي لـ Microsoft Forms: إدخال جماعي، مهارات كعنوان فرعي، تصنيف مهارات الأسئلة القديمة، بيانات الطالب، Excel/CSV/TXT، ومساعد AI.
// @author       Mohammed Almalki (M0HM3D85)
// @homepageURL  https://greasyfork.org/en/users/1636459-m0hm3d85
// @supportURL   https://github.com/M0HM3D85/teacher-userscripts/issues
// @copyright    2026, Mohammed Almalki (M0HM3D85)
// @license      All Rights Reserved
// @match        https://forms.cloud.microsoft/Pages/DesignPageV2.aspx*
// @match        https://forms.office.com/Pages/DesignPageV2.aspx*
// @run-at       document-idle
// @grant        none
// @require      https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js
// @downloadURL https://update.greasyfork.org/scripts/592704/Microsoft%20Forms%20-%20%D8%A8%D9%86%D9%83%20%D8%A7%D9%84%D8%A3%D8%B3%D8%A6%D9%84%D8%A9%20%D9%88%D8%A7%D9%84%D8%A5%D8%AF%D8%AE%D8%A7%D9%84%20%D8%A7%D9%84%D8%AC%D9%85%D8%A7%D8%B9%D9%8A.user.js
// @updateURL https://update.greasyfork.org/scripts/592704/Microsoft%20Forms%20-%20%D8%A8%D9%86%D9%83%20%D8%A7%D9%84%D8%A3%D8%B3%D8%A6%D9%84%D8%A9%20%D9%88%D8%A7%D9%84%D8%A5%D8%AF%D8%AE%D8%A7%D9%84%20%D8%A7%D9%84%D8%AC%D9%85%D8%A7%D8%B9%D9%8A.meta.js
// ==/UserScript==

/*
=========================================================================
 Microsoft Forms - بنك الأسئلة والإدخال الجماعي

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

    const VERSION = '0.7.0';
    const HOST_ID = 'mfbi-v070-host';

    const DEVELOPER = Object.freeze({
        name: 'Mohammed Almalki',
        handle: 'M0HM3D85',
        x: 'https://x.com/M0HM3D85',
        snapchat: 'https://www.snapchat.com/add/M0HM3D85',
        greasyFork: 'https://greasyfork.org/en/users/1636459-m0hm3d85',
        copyright: '© 2026 Mohammed Almalki (M0HM3D85) — جميع الحقوق محفوظة'
    });

    if (document.getElementById(HOST_ID)) return;

    const state = {
        questions: [],
        results: [],
        running: false,
        cancelRequested: false,
        nextIndex: 0,
        log: [],
        selected: new Set(),
        currentTab: 'input',

        // حقول تعريفية اختيارية تسبق أسئلة الاختبار، ولا تدخل في الدرجة.
        studentDataEnabled: false,
        studentAutoBefore: true,
        studentPinToTop: true,
        studentFields: [
            {
                id: 'sf_name',
                enabled: true,
                title: 'قم بكتابة اسمك كاملًا',
                kind: 'text',
                required: true,
                options: []
            },
            {
                id: 'sf_class',
                enabled: true,
                title: 'قم باختيار فصلك / شعبتك',
                kind: 'dropdown',
                required: true,
                options: []
            }
        ],

        // مركز تصنيف مهارات الأسئلة الموجودة مسبقًا في النموذج.
        legacySkillItems: [],
        legacySkillSkippedUploads: 0,
        legacySkillSkippedMetadata: 0,
        legacySkillBusy: false,
        legacySkillIgnoreMetadata: true,
        legacySkillReplaceExisting: false
    };

    const sleep = ms =>
        new Promise(r =>
            setTimeout(r, ms)
        );

    function clean(v = '') {
        return String(v ?? '')
            .replace(/\u00a0/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function westernDigits(v = '') {
        const ar = '٠١٢٣٤٥٦٧٨٩';
        const fa = '۰۱۲۳۴۵۶۷۸۹';

        return String(v)
            .replace(
                /[٠-٩]/g,
                c => String(
                    ar.indexOf(c)
                )
            )
            .replace(
                /[۰-۹]/g,
                c => String(
                    fa.indexOf(c)
                )
            );
    }

    function canonical(v = '') {
        return clean(v)
            .toLowerCase()
            .replace(/[ًٌٍَُِّْـ]/g, '')
            .replace(/[أإآ]/g, 'ا')
            .replace(/ة/g, 'ه')
            .replace(
                /[؟?!.،,:：;؛()\[\]{}"']/g,
                ''
            )
            .replace(/\s+/g, ' ')
            .trim();
    }

    function html(v = '') {
        return String(v)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function visible(el) {
        if (
            !el ||
            !el.isConnected
        ) {
            return false;
        }

        const r =
            el.getBoundingClientRect();

        return !!(
            r.width ||
            r.height ||
            el.getClientRects().length
        );
    }

    function labelOf(el) {
        return clean(
            el?.getAttribute?.(
                'aria-label'
            ) ||
            el?.getAttribute?.(
                'title'
            ) ||
            el?.textContent ||
            ''
        );
    }

    function parsePoints(
        value,
        fallback = 1
    ) {
        const n =
            Number(
                westernDigits(value)
                    .replace(',', '.')
            );

        return (
            Number.isFinite(n) &&
            n >= 0
        )
            ? n
            : fallback;
    }

    function parseBool(
        value,
        fallback = true
    ) {
        const v =
            canonical(value);

        if (
            [
                'نعم',
                'صح',
                'true',
                'yes',
                '1',
                'مطلوب'
            ].includes(v)
        ) {
            return true;
        }

        if (
            [
                'لا',
                'خطا',
                'false',
                'no',
                '0',
                'غير مطلوب'
            ].includes(v)
        ) {
            return false;
        }

        return fallback;
    }

    function normalizeLetter(value) {
        const v =
            clean(value)
                .replace(/ـ/g, '');

        if (
            [
                'ا',
                'إ',
                'آ'
            ].includes(v)
        ) {
            return 'أ';
        }

        if (v === 'ه') {
            return 'هـ';
        }

        return v;
    }

    function normalizeType(value = '') {
        const v =
            canonical(value);

        if (!v) {
            return '';
        }

        if (
            /^(نص|نصي|text|اجابه نصيه|اجابة نصية)$/
                .test(v)
        ) {
            return 'text';
        }

        if (
            /^(متعدد|اختيار متعدد|اجابات متعدده|اجابات متعددة|multiple|multi|multiple answers)$/
                .test(v)
        ) {
            return 'multiple';
        }

        if (
            /^(صح خطا|صح وخطا|صح او خطا|true false|truefalse)$/
                .test(v)
        ) {
            return 'truefalse';
        }

        if (
            /^(اختيار|اختيار واحد|choice|single|single choice)$/
                .test(v)
        ) {
            return 'choice';
        }

        return '';
    }

    function splitCorrect(raw = '') {
        return clean(raw)
            .replace(
                /^(?:الخيار|اختيار)\s*/i,
                ''
            )
            .split(
                /\s*(?:،|,|;|؛|\+|\/|&|\sو\s)\s*/
            )
            .map(
                x =>
                    clean(x)
                        .replace(
                            /[\)\].:：\-–—]+$/g,
                            ''
                        )
            )
            .filter(Boolean);
    }

    function isTrueFalseOptions(
        options
    ) {
        if (
            options.length !==
            2
        ) {
            return false;
        }

        const set =
            new Set(
                options.map(
                    o =>
                        canonical(
                            o.text
                        )
                )
            );

        return (
            (
                set.has('صح') &&
                set.has('خطا')
            ) ||
            (
                set.has('true') &&
                set.has('false')
            ) ||
            (
                set.has('صحيح') &&
                set.has('خطا')
            )
        );
    }

    function parseQuestions(
        source,
        defaults
    ) {
        const lines =
            String(source ?? '')
                .replace(
                    /^\uFEFF/,
                    ''
                )
                .replace(
                    /\r\n?/g,
                    '\n'
                )
                .split('\n');

        const items = [];

        let q = null;

        const make =
            title => ({
                title:
                    clean(title),

                skill:
                    '',

                typeRaw:
                    '',

                type:
                    '',

                options:
                    [],

                answerRaw:
                    '',

                correctIndexes:
                    [],

                textAnswer:
                    '',

                points:
                    defaults.points,

                required:
                    defaults.required,

                errors:
                    [],

                warnings:
                    []
            });

        const finish =
            () => {

                if (!q) {
                    return;
                }

                q.title =
                    clean(q.title);

                q.skill =
                    clean(q.skill);

                q.options =
                    q.options
                        .map(
                            o => ({
                                label:
                                    normalizeLetter(
                                        o.label
                                    ),

                                text:
                                    clean(
                                        o.text
                                    )
                            })
                        )
                        .filter(
                            o => o.text
                        );

                if (!q.title) {
                    q.errors.push(
                        'عنوان السؤال فارغ.'
                    );
                }

                const explicitType =
                    normalizeType(
                        q.typeRaw
                    );

                const answerParts =
                    splitCorrect(
                        q.answerRaw
                    );

                if (explicitType) {
                    q.type =
                        explicitType;
                }
                else if (
                    q.options.length
                ) {
                    if (
                        answerParts.length >
                        1
                    ) {
                        q.type =
                            'multiple';
                    }
                    else if (
                        isTrueFalseOptions(
                            q.options
                        )
                    ) {
                        q.type =
                            'truefalse';
                    }
                    else {
                        q.type =
                            'choice';
                    }
                }
                else {
                    q.type =
                        'text';
                }

                if (
                    q.type ===
                    'text'
                ) {
                    q.textAnswer =
                        clean(
                            q.answerRaw
                        );

                    if (
                        q.options.length
                    ) {
                        q.warnings.push(
                            'تم تجاهل الخيارات لأن النوع نصي.'
                        );
                    }
                }
                else {

                    if (
                        q.options.length <
                        2
                    ) {
                        q.errors.push(
                            'يجب أن يحتوي السؤال على خيارين على الأقل.'
                        );
                    }

                    const seen =
                        new Set();

                    q.options
                        .forEach(
                            (
                                o,
                                i
                            ) => {

                                const key =
                                    canonical(
                                        o.text
                                    );

                                if (
                                    seen.has(
                                        key
                                    )
                                ) {
                                    q.errors.push(
                                        `الخيار ${
                                            i + 1
                                        } مكرر.`
                                    );
                                }

                                seen.add(
                                    key
                                );
                            }
                        );

                    const indexes =
                        [];

                    for (
                        const part
                        of answerParts
                    ) {
                        let idx =
                            -1;

                        const letter =
                            normalizeLetter(
                                part
                            );

                        idx =
                            q.options
                                .findIndex(
                                    o =>
                                        o.label ===
                                        letter
                                );

                        if (
                            idx < 0
                        ) {
                            const n =
                                Number(
                                    westernDigits(
                                        part
                                    )
                                );

                            if (
                                Number.isInteger(
                                    n
                                ) &&
                                n >= 1 &&
                                n <=
                                q.options.length
                            ) {
                                idx =
                                    n - 1;
                            }
                        }

                        if (
                            idx < 0
                        ) {
                            const wanted =
                                canonical(
                                    part
                                );

                            idx =
                                q.options
                                    .findIndex(
                                        o =>
                                            canonical(
                                                o.text
                                            ) ===
                                            wanted
                                    );
                        }

                        if (
                            idx >= 0 &&
                            !indexes.includes(
                                idx
                            )
                        ) {
                            indexes.push(
                                idx
                            );
                        }
                    }

                    q.correctIndexes =
                        indexes;

                    if (
                        !indexes.length
                    ) {
                        q.errors.push(
                            'لم أتمكن من تحديد الإجابة الصحيحة.'
                        );
                    }

                    if (
                        q.type ===
                        'multiple' &&
                        indexes.length <
                        2
                    ) {
                        q.warnings.push(
                            'السؤال متعدد لكن تم تحديد إجابة صحيحة واحدة فقط.'
                        );
                    }

                    if (
                        (
                            q.type ===
                            'choice' ||
                            q.type ===
                            'truefalse'
                        ) &&
                        indexes.length >
                        1
                    ) {
                        q.type =
                            'multiple';

                        q.warnings.push(
                            'تم تحويل النوع تلقائيًا إلى متعدد لوجود أكثر من إجابة صحيحة.'
                        );
                    }
                }

                q.points =
                    parsePoints(
                        q.points,
                        defaults.points
                    );

                q.required =
                    Boolean(
                        q.required
                    );

                q.valid =
                    q.errors.length ===
                    0;

                items.push(
                    q
                );

                q =
                    null;
            };

        for (
            const rawLine
            of lines
        ) {
            const line =
                clean(rawLine);

            if (!line) {
                continue;
            }

            let m;

            m =
                line.match(
                    /^(?:المهارة|المهاره|الدرس|العنوان\s*الفرعي|skill|subtitle)\s*[:：\-–—]\s*(.+)$/i
                );

            if (m) {
                if (q) {
                    q.skill =
                        clean(
                            m[1]
                        );
                }

                continue;
            }

            m =
                line.match(
                    /^(?:النوع|نوع السؤال|type)\s*[:：\-–—]\s*(.+)$/i
                );

            if (m) {
                if (q) {
                    q.typeRaw =
                        clean(
                            m[1]
                        );
                }

                continue;
            }

            m =
                line.match(
                    /^(?:الصحيح|الإجابة\s*الصحيحة|الاجابة\s*الصحيحة|الإجابة|الاجابة|الجواب|answer)\s*[:：\-–—]\s*(.+)$/i
                );

            if (m) {
                if (q) {
                    q.answerRaw =
                        clean(
                            m[1]
                        );
                }

                continue;
            }

            m =
                line.match(
                    /^(?:الدرجة|الدرجه|النقاط|النقطة|النقطه|points?)\s*[:：\-–—]\s*(.+)$/i
                );

            if (m) {
                if (q) {
                    q.points =
                        parsePoints(
                            m[1],
                            defaults.points
                        );
                }

                continue;
            }

            m =
                line.match(
                    /^مطلوب\s*[:：\-–—]\s*(.+)$/i
                );

            if (m) {
                if (q) {
                    q.required =
                        parseBool(
                            m[1],
                            defaults.required
                        );
                }

                continue;
            }

            m =
                line.match(
                    /^(?:س|سؤال|q)\s*[:：\-–—]\s*(.+)$/i
                );

            if (m) {
                finish();

                q =
                    make(
                        m[1]
                    );

                continue;
            }

            m =
                line.match(
                    /^([0-9٠-٩۰-۹]+)\s*[\)\].\-–—]\s+(.+)$/
                );

            if (m) {
                finish();

                q =
                    make(
                        m[2]
                    );

                continue;
            }

            m =
                line.match(
                    /^(أ|إ|آ|ا|ب|ج|د|هـ|ه|و|ز|ح)\s*[\)\].\-–—:：]\s*(.+)$/
                );

            if (m) {
                if (!q) {
                    q =
                        make('');
                }

                q.options.push({
                    label:
                        m[1],

                    text:
                        m[2]
                });

                continue;
            }

            if (!q) {
                q =
                    make(line);
            }
            else if (
                !q.options.length &&
                !q.answerRaw
            ) {
                q.title =
                    clean(
                        `${
                            q.title
                        } ${line}`
                    );
            }
            else if (
                q.options.length &&
                !q.answerRaw
            ) {
                q.options[
                    q.options.length -
                    1
                ].text =
                    clean(
                        `${
                            q.options[
                                q.options.length -
                                1
                            ].text
                        } ${line}`
                    );
            }
        }

        finish();

        const titleMap =
            new Map();

        items.forEach(
            (
                item,
                index
            ) => {

                item.index =
                    index;

                const key =
                    canonical(
                        item.title
                    );

                if (key) {
                    if (
                        titleMap.has(
                            key
                        )
                    ) {
                        item.errors.push(
                            `عنوان مكرر داخل الدفعة مع السؤال ${
                                titleMap.get(
                                    key
                                ) + 1
                            }.`
                        );

                        item.valid =
                            false;
                    }
                    else {
                        titleMap.set(
                            key,
                            index
                        );
                    }
                }
            }
        );

        return items;
    }

    function checkCancel() {
        if (
            state.cancelRequested
        ) {
            const e =
                new Error(
                    '__CANCELLED__'
                );

            e.cancelled =
                true;

            throw e;
        }
    }

    async function waitFor(
        finder,
        timeout = 12000,
        interval = 100,
        description = 'عنصر'
    ) {
        const start =
            Date.now();

        while (
            Date.now() -
            start <
            timeout
        ) {
            checkCancel();

            try {
                const v =
                    finder();

                if (v) {
                    return v;
                }
            }
            catch (_) {}

            await sleep(
                interval
            );
        }

        throw new Error(
            `انتهت مهلة انتظار: ${
                description
            }`
        );
    }

    async function clickElement(el) {
        checkCancel();

        if (!el) {
            throw new Error(
                'العنصر المطلوب للنقر غير موجود.'
            );
        }

        el.scrollIntoView({
            block:
                'center',

            inline:
                'center',

            behavior:
                'auto'
        });

        await sleep(
            90
        );

        try {
            el.focus({
                preventScroll:
                    true
            });
        }
        catch (_) {}

        if (
            window.PointerEvent
        ) {
            el.dispatchEvent(
                new PointerEvent(
                    'pointerdown',
                    {
                        bubbles:
                            true,

                        cancelable:
                            true,

                        pointerType:
                            'mouse'
                    }
                )
            );
        }

        el.dispatchEvent(
            new MouseEvent(
                'mousedown',
                {
                    bubbles:
                        true,

                    cancelable:
                        true,

                    view:
                        window
                }
            )
        );

        if (
            window.PointerEvent
        ) {
            el.dispatchEvent(
                new PointerEvent(
                    'pointerup',
                    {
                        bubbles:
                            true,

                        cancelable:
                            true,

                        pointerType:
                            'mouse'
                    }
                )
            );
        }

        el.dispatchEvent(
            new MouseEvent(
                'mouseup',
                {
                    bubbles:
                        true,

                    cancelable:
                        true,

                    view:
                        window
                }
            )
        );

        el.click();

        await sleep(
            260
        );
    }

    function getCards() {
        return [
            ...document
                .querySelectorAll(
                    '[data-automation-id="questionDesignerCard"]'
                )
        ].filter(
            visible
        );
    }

    function cardNumber(card) {
        const t =
            westernDigits(
                card
                    ?.getAttribute(
                        'aria-label'
                    ) ||
                ''
            );

        const m =
            t.match(
                /(?:السؤال|question)\s*(\d+)/i
            );

        return m
            ? Number(
                m[1]
            )
            : 0;
    }

    function getLiveCard(
        number
    ) {
        const cards =
            getCards();

        return (
            cards.find(
                c =>
                    cardNumber(
                        c
                    ) ===
                    number
            ) ||
            cards[
                cards.length -
                1
            ] ||
            null
        );
    }

    function findInCard(
        number,
        selector,
        regex
    ) {
        const card =
            getLiveCard(
                number
            );

        if (!card) {
            return null;
        }

        return [
            ...card
                .querySelectorAll(
                    selector
                )
        ].find(
            el =>
                visible(el) &&
                regex.test(
                    labelOf(el)
                )
        ) || null;
    }

    function getTitleEditor(
        number
    ) {
        return findInCard(
            number,
            '[role="textbox"]',
            /عنوان السؤال|question title/i
        );
    }

    function getOptionEditors(
        number
    ) {
        const card =
            getLiveCard(
                number
            );

        if (!card) {
            return [];
        }

        return [
            ...card.querySelectorAll(
                '[role="listitem"] [role="textbox"]'
            )
        ].filter(
            el =>
                visible(el) &&
                /نص خيار الاختيار|choice option|option text/i
                    .test(
                        labelOf(el)
                    )
        );
    }

    function getAddOption(
        number
    ) {
        return findInCard(
            number,
            'button,[role="button"]',
            /^(إضافة خيار|Add option)$/i
        );
    }

    function getPoints(
        number
    ) {
        return findInCard(
            number,
            'input',
            /^(النقاط|Points)$/i
        );
    }

    function getRequired(
        number
    ) {
        return findInCard(
            number,
            '[role="switch"],[aria-label]',
            /^(مطلوب|Required)$/i
        );
    }

    function getMultipleSwitch(
        number
    ) {
        const card =
            getLiveCard(
                number
            );

        if (!card) {
            return null;
        }

        return [
            ...card.querySelectorAll(
                '[role="switch"]'
            )
        ].find(
            el =>
                visible(el) &&
                /إجابات متعددة|multiple answers/i
                    .test(
                        labelOf(el)
                    )
        ) || null;
    }

    function getMoreSettings(
        number
    ) {
        return findInCard(
            number,
            'button,[role="button"]',
            /مزيد من إعدادات السؤال|More settings for question|More settings/i
        );
    }

    function getSubtitleEditor(
        number
    ) {
        return findInCard(
            number,
            '[role="textbox"]',
            /إدخال عنوان فرعي|Enter subtitle|Subtitle/i
        );
    }

    function getSubtitleMenuItem(
        number
    ) {
        const card =
            getLiveCard(
                number
            );

        if (!card) {
            return null;
        }

        return [
            ...card.querySelectorAll(
                '[role="menuitemcheckbox"],[role="menuitem"]'
            )
        ].find(
            el =>
                visible(el) &&
                /^(عنوان فرعي|Subtitle)$/i
                    .test(
                        labelOf(el)
                    )
        ) || null;
    }

    function getDropdownMenuItem(
        number
    ) {
        const card =
            getLiveCard(
                number
            );

        if (!card) {
            return null;
        }

        return [
            ...card.querySelectorAll(
                '[role="menuitemcheckbox"],[role="menuitem"]'
            )
        ].find(
            el =>
                visible(el) &&
                /^(القائمة المنسدلة|قائمة منسدلة|Drop-down|Dropdown)$/i
                    .test(
                        labelOf(el)
                    )
        ) || null;
    }

    async function ensureChoiceDropdown(
        number,
        wanted,
        progress
    ) {
        if (!wanted) {
            return;
        }

        progress(
            'تحويل الحقل إلى قائمة منسدلة...'
        );

        const more =
            await waitFor(
                () =>
                    getMoreSettings(
                        number
                    ),
                8000,
                100,
                'مزيد من إعدادات السؤال'
            );

        await clickElement(
            more
        );

        const item =
            await waitFor(
                () =>
                    getDropdownMenuItem(
                        number
                    ),
                7000,
                100,
                'خيار القائمة المنسدلة'
            );

        if (
            item.getAttribute(
                'aria-checked'
            ) !== 'true'
        ) {
            await clickElement(
                item
            );
        }

        await sleep(
            350
        );
    }

    function getMoveUpButton(
        number
    ) {
        return findInCard(
            number,
            'button,[role="button"]',
            /نقل السؤال للأعلى|Move question up/i
        );
    }

    async function moveQuestionToPosition(
        number,
        targetPosition,
        progress
    ) {
        let current =
            Number(number) || 0;

        const target =
            Math.max(
                1,
                Number(targetPosition) || 1
            );

        let safety = 0;

        while (
            current > target &&
            safety++ < 120
        ) {
            const up =
                await waitFor(
                    () =>
                        getMoveUpButton(
                            current
                        ),
                    5000,
                    100,
                    'زر نقل السؤال للأعلى'
                );

            progress(
                `نقل الحقل التعريفي إلى الموضع ${target}...`
            );

            await clickElement(
                up
            );

            current--;

            await sleep(
                300
            );
        }

        return current;
    }

    async function ensureQuestionSubtitle(
        number,
        skill,
        progress
    ) {
        const value =
            clean(skill);

        if (!value) {
            return;
        }

        let editor =
            getSubtitleEditor(
                number
            );

        if (!editor) {
            progress(
                'تفعيل العنوان الفرعي للمهارة...'
            );

            const more =
                await waitFor(
                    () =>
                        getMoreSettings(
                            number
                        ),
                    8000,
                    100,
                    'مزيد من إعدادات السؤال'
                );

            await clickElement(
                more
            );

            const toggle =
                await waitFor(
                    () =>
                        getSubtitleMenuItem(
                            number
                        ),
                    7000,
                    100,
                    'خيار عنوان فرعي'
                );

            if (
                toggle.getAttribute(
                    'aria-checked'
                ) !== 'true'
            ) {
                await clickElement(
                    toggle
                );
            }

            editor =
                await waitFor(
                    () =>
                        getSubtitleEditor(
                            number
                        ),
                    8000,
                    100,
                    'حقل العنوان الفرعي'
                );
        }

        progress(
            'كتابة المهارة في العنوان الفرعي...'
        );

        await replaceRichText(
            () =>
                getSubtitleEditor(
                    number
                ),
            value,
            'المهارة / العنوان الفرعي'
        );
    }

    async function activateEditor(
        getter,
        description
    ) {
        let el =
            await waitFor(
                getter,
                10000,
                100,
                description
            );

        await clickElement(
            el
        );

        el =
            await waitFor(
                () => {

                    const live =
                        getter();

                    return (
                        live &&
                        visible(live) &&
                        live.getAttribute(
                            'contenteditable'
                        ) ===
                        'true'
                    )
                        ? live
                        : null;
                },

                8000,
                100,
                `${description} - وضع التحرير`
            );

        return el;
    }

    async function replaceRichText(
        getter,
        text,
        description
    ) {
        let el =
            await activateEditor(
                getter,
                description
            );

        el.focus();

        await sleep(
            60
        );

        const sel =
            window.getSelection();

        const range =
            document.createRange();

        range.selectNodeContents(
            el
        );

        sel.removeAllRanges();

        sel.addRange(
            range
        );

        let deleted =
            false;

        try {
            deleted =
                document.execCommand(
                    'delete',
                    false
                );
        }
        catch (_) {}

        if (!deleted) {
            el.innerHTML =
                '';
        }

        await sleep(
            50
        );

        let inserted =
            false;

        try {
            inserted =
                document.execCommand(
                    'insertText',
                    false,
                    text
                );
        }
        catch (_) {}

        if (!inserted) {
            el.textContent =
                text;
        }

        try {
            el.dispatchEvent(
                new InputEvent(
                    'input',
                    {
                        bubbles:
                            true,

                        composed:
                            true,

                        inputType:
                            'insertText',

                        data:
                            text
                    }
                )
            );
        }
        catch (_) {
            el.dispatchEvent(
                new Event(
                    'input',
                    {
                        bubbles:
                            true,

                        composed:
                            true
                    }
                )
            );
        }

        el.dispatchEvent(
            new Event(
                'change',
                {
                    bubbles:
                        true,

                    composed:
                        true
                }
            )
        );

        el.blur();

        await sleep(
            360
        );

        const actual =
            clean(
                getter()
                    ?.innerText ||
                getter()
                    ?.textContent ||
                ''
            );

        if (
            canonical(actual) !==
            canonical(text)
        ) {
            throw new Error(
                `فشل إدخال ${description}: «${text}».`
            );
        }
    }

    function setNativeInput(
        input,
        value
    ) {
        const proto =
            input instanceof
            HTMLTextAreaElement
                ? HTMLTextAreaElement
                    .prototype
                : HTMLInputElement
                    .prototype;

        const setter =
            Object
                .getOwnPropertyDescriptor(
                    proto,
                    'value'
                )
                ?.set;

        if (setter) {
            setter.call(
                input,
                String(value)
            );
        }
        else {
            input.value =
                String(value);
        }

        input.dispatchEvent(
            new Event(
                'input',
                {
                    bubbles:
                        true
                }
            )
        );

        input.dispatchEvent(
            new Event(
                'change',
                {
                    bubbles:
                        true
                }
            )
        );

        input.blur();
    }

    async function setSwitch(
        switchEl,
        wanted,
        description
    ) {
        if (!switchEl) {
            throw new Error(
                `لم أجد مفتاح ${
                    description
                }.`
            );
        }

        const current =
            switchEl.getAttribute(
                'aria-checked'
            ) === 'true';

        if (
            current !==
            wanted
        ) {
            await clickElement(
                switchEl
            );

            await sleep(
                350
            );
        }

        const after =
            switchEl.isConnected
                ? switchEl
                : null;

        if (
            after &&
            (
                after.getAttribute(
                    'aria-checked'
                ) === 'true'
            ) !==
            wanted
        ) {
            throw new Error(
                `تعذر ضبط ${
                    description
                }.`
            );
        }
    }

    async function createCard(
        type,
        progress
    ) {
        const before =
            getCards();

        const beforeMax =
            Math.max(
                0,
                ...before.map(
                    cardNumber
                )
            );

        progress(
            'فتح إضافة سؤال...'
        );

        const add =
            await waitFor(
                () =>
                    document.querySelector(
                        '[data-automation-id="questionAdd"]'
                    ) ||
                    document.querySelector(
                        '#add-question-button'
                    ),

                12000,
                100,
                'زر إضافة سؤال'
            );

        await clickElement(
            add
        );

        const wanted =
            type === 'text'
                ? /^(نص|Text)$/i
                : /^(اختيار|Choice)$/i;

        progress(
            type === 'text'
                ? 'اختيار سؤال نصي...'
                : 'اختيار سؤال اختيار...'
        );

        const typeButton =
            await waitFor(
                () => {
                    const area =
                        document.querySelector(
                            '[data-automation-id="questionAddButtons"]'
                        );

                    if (!area) {
                        return null;
                    }

                    return [
                        ...area.querySelectorAll(
                            'button,[role="button"]'
                        )
                    ].find(
                        el =>
                            visible(el) &&
                            wanted.test(
                                labelOf(el)
                            )
                    ) || null;
                },

                10000,
                100,
                type === 'text'
                    ? 'زر نص'
                    : 'زر اختيار'
            );

        await clickElement(
            typeButton
        );

        const card =
            await waitFor(
                () => {

                    const cards =
                        getCards();

                    return (
                        cards.find(
                            c =>
                                cardNumber(c) >
                                beforeMax
                        ) ||
                        (
                            cards.length >
                            before.length
                                ? cards[
                                    cards.length -
                                    1
                                ]
                                : null
                        )
                    );
                },

                15000,
                100,
                'بطاقة السؤال الجديدة'
            );

        return (
            cardNumber(card) ||
            beforeMax + 1
        );
    }

    async function setCommonFields(
        number,
        q,
        progress
    ) {
        progress(
            'ضبط النقاط...'
        );

        const p =
            await waitFor(
                () =>
                    getPoints(
                        number
                    ),

                8000,
                100,
                'حقل النقاط'
            );

        p.focus();

        setNativeInput(
            p,
            q.points
        );

        await sleep(
            300
        );

        progress(
            q.required
                ? 'تفعيل مطلوب...'
                : 'إلغاء مطلوب...'
        );

        let req =
            await waitFor(
                () =>
                    getRequired(
                        number
                    ),

                8000,
                100,
                'مفتاح مطلوب'
            );

        const current =
            req.getAttribute(
                'aria-checked'
            ) === 'true';

        if (
            current !==
            q.required
        ) {
            await clickElement(
                req
            );

            await sleep(
                300
            );

            req =
                await waitFor(
                    () =>
                        getRequired(
                            number
                        ),

                    5000,
                    100,
                    'مفتاح مطلوب بعد التغيير'
                );
        }

        if (
            (
                req.getAttribute(
                    'aria-checked'
                ) === 'true'
            ) !==
            q.required
        ) {
            throw new Error(
                'فشل ضبط «مطلوب».'
            );
        }
    }

    async function addChoiceQuestion(
        q,
        progress
    ) {
        const number =
            await createCard(
                'choice',
                progress
            );

        progress(
            'كتابة عنوان السؤال...'
        );

        await replaceRichText(
            () =>
                getTitleEditor(
                    number
                ),

            q.title,

            'عنوان السؤال'
        );

        await ensureQuestionSubtitle(
            number,
            q.skill,
            progress
        );

        progress(
            'تجهيز عدد الخيارات...'
        );

        while (
            getOptionEditors(
                number
            ).length <
            q.options.length
        ) {
            const before =
                getOptionEditors(
                    number
                ).length;

            const addOption =
                await waitFor(
                    () =>
                        getAddOption(
                            number
                        ),

                    7000,
                    100,
                    'زر إضافة خيار'
                );

            await clickElement(
                addOption
            );

            await waitFor(
                () =>
                    getOptionEditors(
                        number
                    ).length >
                    before,

                7000,
                100,
                'الخيار الجديد'
            );
        }

        for (
            let i = 0;
            i <
            q.options.length;
            i++
        ) {
            progress(
                `كتابة الخيار ${
                    i + 1
                }/${
                    q.options.length
                }...`
            );

            await replaceRichText(
                () =>
                    getOptionEditors(
                        number
                    )[i] ||
                    null,

                q.options[i]
                    .text,

                `الخيار ${
                    i + 1
                }`
            );
        }

        if (
            q.type ===
            'multiple'
        ) {
            progress(
                'تفعيل الإجابات المتعددة...'
            );

            let sw =
                await waitFor(
                    () =>
                        getMultipleSwitch(
                            number
                        ),

                    7000,
                    100,
                    'مفتاح إجابات متعددة'
                );

            if (
                sw.getAttribute(
                    'aria-checked'
                ) !== 'true'
            ) {
                await clickElement(
                    sw
                );

                await sleep(
                    450
                );

                sw =
                    await waitFor(
                        () =>
                            getMultipleSwitch(
                                number
                            ),

                        5000,
                        100,
                        'مفتاح إجابات متعددة بعد التغيير'
                    );
            }

            if (
                sw.getAttribute(
                    'aria-checked'
                ) !== 'true'
            ) {
                throw new Error(
                    'تعذر تفعيل «إجابات متعددة».'
                );
            }
        }

        await ensureChoiceDropdown(
            number,
            q.displayMode === 'dropdown',
            progress
        );

        progress(
            q.metadataField
                ? 'ترك الحقل التعريفي بلا إجابة صحيحة...'
                : 'تحديد الإجابة الصحيحة...'
        );

        for (
            const idx
            of q.correctIndexes
        ) {
            const editor =
                getOptionEditors(
                    number
                )[idx];

            if (!editor) {
                throw new Error(
                    `تعذر العثور على الخيار الصحيح رقم ${
                        idx + 1
                    }.`
                );
            }

            const item =
                editor.closest(
                    '[role="listitem"]'
                );

            if (!item) {
                throw new Error(
                    `تعذر العثور على حاوية الخيار ${
                        idx + 1
                    }.`
                );
            }

            const btn =
                [
                    ...item.querySelectorAll(
                        'button,[role="button"]'
                    )
                ].find(
                    el =>
                        /إجابة صحيحة|Correct answer/i
                            .test(
                                labelOf(el)
                            )
                );

            if (!btn) {
                throw new Error(
                    `لم أجد زر الإجابة الصحيحة للخيار ${
                        idx + 1
                    }.`
                );
            }

            await clickElement(
                btn
            );

            await sleep(
                220
            );
        }

        await setCommonFields(
            number,
            q,
            progress
        );

        progress(
            'انتظار الحفظ...'
        );

        try {
            getLiveCard(
                number
            )?.click();
        }
        catch (_) {}

        await sleep(
            1500
        );

        const finalTitle =
            clean(
                getTitleEditor(
                    number
                )
                    ?.innerText ||
                getTitleEditor(
                    number
                )
                    ?.textContent ||
                ''
            );

        if (
            canonical(
                finalTitle
            ) !==
            canonical(
                q.title
            )
        ) {
            throw new Error(
                'التحقق النهائي: عنوان السؤال غير مطابق.'
            );
        }

        const finalPoints =
            Number(
                westernDigits(
                    getPoints(
                        number
                    )
                        ?.value ||
                    ''
                )
            );

        if (
            finalPoints !==
            Number(
                q.points
            )
        ) {
            throw new Error(
                `التحقق النهائي: النقاط ${
                    finalPoints
                } بدل ${
                    q.points
                }.`
            );
        }

        return number;
    }

    function textAnswerCandidates(
        number
    ) {
        const card =
            getLiveCard(
                number
            );

        if (!card) {
            return [];
        }

        const title =
            getTitleEditor(
                number
            );

        const controls =
            [
                ...card.querySelectorAll(
                    'input,textarea,[role="textbox"]'
                )
            ].filter(
                el =>
                    visible(el) &&
                    el !== title &&
                    el !==
                    getPoints(
                        number
                    )
            );

        const labeled =
            controls.filter(
                el =>
                    /إجاب|answer/i
                        .test(
                            labelOf(el)
                        ) &&
                    !/عنوان السؤال|question title/i
                        .test(
                            labelOf(el)
                        )
            );

        return labeled.length
            ? labeled
            : controls.filter(
                el =>
                    !/عنوان السؤال|question title/i
                        .test(
                            labelOf(el)
                        )
            );
    }

    async function setTextAnswer(
        number,
        answer,
        progress
    ) {
        if (!answer) {
            return;
        }

        progress(
            'إضافة الإجابة النصية الصحيحة...'
        );

        let candidate =
            textAnswerCandidates(
                number
            )[0] ||
            null;

        if (!candidate) {
            const card =
                getLiveCard(
                    number
                );

            const addAnswer =
                card
                    ? [
                        ...card.querySelectorAll(
                            'button,[role="button"]'
                        )
                    ].find(
                        el =>
                            visible(el) &&
                            /إضافة\s+إجابة|add\s+answer/i
                                .test(
                                    labelOf(el)
                                )
                    )
                    : null;

            if (addAnswer) {
                const beforeCount =
                    textAnswerCandidates(
                        number
                    ).length;

                await clickElement(
                    addAnswer
                );

                candidate =
                    await waitFor(
                        () => {

                            const arr =
                                textAnswerCandidates(
                                    number
                                );

                            return (
                                arr.length >
                                beforeCount
                                    ? arr[
                                        arr.length -
                                        1
                                    ]
                                    : arr[0] ||
                                    null
                            );
                        },

                        7000,
                        100,
                        'حقل الإجابة النصية'
                    );
            }
        }

        if (!candidate) {
            throw new Error(
                'لم أجد حقل «الإجابة الصحيحة» للسؤال النصي. هذه الجزئية تحتاج مراقبة إضافية لواجهة Forms.'
            );
        }

        if (
            candidate.matches(
                'input,textarea'
            )
        ) {
            candidate.focus();

            setNativeInput(
                candidate,
                answer
            );
        }
        else {
            await replaceRichText(
                () => {
                    const list =
                        textAnswerCandidates(
                            number
                        );

                    return (
                        list.find(
                            el =>
                                el ===
                                candidate ||
                                canonical(
                                    labelOf(el)
                                ) ===
                                canonical(
                                    labelOf(
                                        candidate
                                    )
                                )
                        ) ||
                        list[0] ||
                        null
                    );
                },

                answer,

                'الإجابة النصية'
            );
        }

        await sleep(
            400
        );
    }

    async function addTextQuestion(
        q,
        progress
    ) {
        const number =
            await createCard(
                'text',
                progress
            );

        progress(
            'كتابة عنوان السؤال...'
        );

        await replaceRichText(
            () =>
                getTitleEditor(
                    number
                ),

            q.title,

            'عنوان السؤال'
        );

        await ensureQuestionSubtitle(
            number,
            q.skill,
            progress
        );

        await setTextAnswer(
            number,
            q.textAnswer,
            progress
        );

        await setCommonFields(
            number,
            q,
            progress
        );

        progress(
            'انتظار الحفظ...'
        );

        try {
            getLiveCard(
                number
            )?.click();
        }
        catch (_) {}

        await sleep(
            1500
        );

        return number;
    }

    function existingTitleSet() {
        const set =
            new Set();

        for (
            const card
            of getCards()
        ) {
            const number =
                cardNumber(
                    card
                );

            const t =
                clean(
                    getTitleEditor(
                        number
                    )
                        ?.innerText ||
                    getTitleEditor(
                        number
                    )
                        ?.textContent ||
                    ''
                );

            if (t) {
                set.add(
                    canonical(t)
                );
            }
        }

        return set;
    }

    function normalizeStudentField(
        field = {}
    ) {
        const allowed =
            new Set([
                'text',
                'choice',
                'dropdown',
                'multiple'
            ]);

        const kind =
            allowed.has(
                field.kind
            )
                ? field.kind
                : 'text';

        const options =
            Array.isArray(
                field.options
            )
                ? field.options
                : String(
                    field.options || ''
                )
                    .split(/\r?\n/);

        return {
            id:
                clean(field.id) ||
                `sf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,

            enabled:
                field.enabled !== false,

            title:
                clean(field.title),

            kind,

            required:
                field.required !== false,

            options:
                options
                    .map(clean)
                    .filter(Boolean)
        };
    }

    function enabledStudentFields() {
        if (!state.studentDataEnabled) {
            return [];
        }

        return state.studentFields
            .map(
                normalizeStudentField
            )
            .filter(
                f =>
                    f.enabled &&
                    f.title
            );
    }

    function validateStudentFields(
        fields = enabledStudentFields()
    ) {
        const errors = [];

        fields.forEach(
            (
                field,
                index
            ) => {
                if (!field.title) {
                    errors.push(
                        `الحقل التعريفي ${index + 1}: العنوان فارغ.`
                    );
                }

                if (
                    field.kind !== 'text' &&
                    field.options.length < 2
                ) {
                    errors.push(
                        `الحقل «${field.title || index + 1}» يحتاج خيارين على الأقل.`
                    );
                }
            }
        );

        return errors;
    }

    function studentFieldToQuestion(
        field
    ) {
        const letters =
            [
                'أ',
                'ب',
                'ج',
                'د',
                'هـ',
                'و',
                'ز',
                'ح',
                'ط',
                'ي',
                'ك',
                'ل'
            ];

        const type =
            field.kind === 'text'
                ? 'text'
                : field.kind === 'multiple'
                    ? 'multiple'
                    : 'choice';

        return {
            title:
                field.title,

            skill:
                '',

            typeRaw:
                type,

            type,

            options:
                field.options.map(
                    (
                        text,
                        index
                    ) => ({
                        label:
                            letters[index] ||
                            String(index + 1),

                        text
                    })
                ),

            answerRaw:
                '',

            correctIndexes:
                [],

            textAnswer:
                '',

            points:
                0,

            required:
                !!field.required,

            displayMode:
                field.kind === 'dropdown'
                    ? 'dropdown'
                    : 'standard',

            metadataField:
                true,

            valid:
                true,

            errors:
                [],

            warnings:
                []
        };
    }

    function questionTitleExists(
        title
    ) {
        const wanted =
            canonical(
                title
            );

        if (!wanted) {
            return false;
        }

        const nodes = [
            ...document.querySelectorAll(
                '[data-automation-id="questionTitle"],button[data-automation-id="questionWrapper"],[data-automation-id="questionDesignerCard"]'
            )
        ];

        return nodes.some(
            node => {
                const value =
                    canonical(
                        node.getAttribute?.(
                            'aria-label'
                        ) ||
                        node.innerText ||
                        node.textContent ||
                        ''
                    );

                return (
                    value === wanted ||
                    value.includes(
                        wanted
                    )
                );
            }
        );
    }

    async function insertStudentFieldsCore(
        fields,
        { pinToTop = state.studentPinToTop } = {}
    ) {
        const stats = {
            done: 0,
            skipped: 0,
            failed: 0
        };

        for (
            let i = 0;
            i < fields.length;
            i++
        ) {
            checkCancel();

            const field =
                normalizeStudentField(
                    fields[i]
                );

            if (
                questionTitleExists(
                    field.title
                )
            ) {
                stats.skipped++;

                log(
                    `حقل تعريفي «${field.title}»: موجود مسبقًا وتم تخطيه.`,
                    'warn'
                );

                continue;
            }

            const q =
                studentFieldToQuestion(
                    field
                );

            const progress =
                msg => {
                    setStatus(
                        `بيانات الطالب ${i + 1}/${fields.length} — ${field.title}: ${msg}`
                    );

                    log(
                        `بيانات الطالب «${field.title}»: ${msg}`
                    );
                };

            try {
                let number;

                if (
                    q.type === 'text'
                ) {
                    number =
                        await addTextQuestion(
                            q,
                            progress
                        );
                }
                else {
                    number =
                        await addChoiceQuestion(
                            q,
                            progress
                        );
                }

                if (
                    pinToTop &&
                    Number(number) > i + 1
                ) {
                    await moveQuestionToPosition(
                        number,
                        i + 1,
                        progress
                    );
                }

                stats.done++;

                log(
                    `حقل تعريفي «${field.title}»: تم بنجاح.`
                );
            }
            catch (err) {
                stats.failed++;

                log(
                    `حقل تعريفي «${field.title}»: ${err.message || err}`,
                    'error'
                );

                if (
                    !$('.continueErr')
                        ?.checked
                ) {
                    throw err;
                }
            }
        }

        return stats;
    }

    async function runStudentFieldsOnly() {
        if (
            state.running
        ) {
            return;
        }

        const fields =
            enabledStudentFields();

        if (!fields.length) {
            setStatus(
                'فعّل «بيانات الطالب» وحدد حقلًا واحدًا على الأقل.'
            );

            switchTab(
                'student'
            );

            return;
        }

        const validation =
            validateStudentFields(
                fields
            );

        if (validation.length) {
            setStatus(
                `⚠️ ${validation[0]}`
            );

            switchTab(
                'student'
            );

            return;
        }

        if (
            !confirm(
                `سيتم إدخال ${fields.length} حقل/حقول تعريفية بلا درجات في النموذج. متابعة؟`
            )
        ) {
            return;
        }

        state.cancelRequested =
            false;

        setRunning(
            true
        );

        try {
            const stats =
                await insertStudentFieldsCore(
                    fields
                );

            setStatus(
                `✅ بيانات الطالب: تم ${stats.done}، تخطي ${stats.skipped}، أخطاء ${stats.failed}.`
            );
        }
        catch (err) {
            if (
                err.cancelled ||
                err.message === '__CANCELLED__'
            ) {
                setStatus(
                    '⛔ تم إيقاف إدخال بيانات الطالب.'
                );
            }
            else {
                setStatus(
                    `❌ ${err.message || err}`
                );
            }
        }
        finally {
            state.cancelRequested =
                false;

            setRunning(
                false
            );
        }
    }

    function log(
        message,
        level = 'info'
    ) {
        const entry = {
            time:
                new Date()
                    .toLocaleTimeString(
                        'ar-SA'
                    ),

            message,
            level
        };

        state.log.push(
            entry
        );

        if (
            state.log.length >
            300
        ) {
            state.log.shift();
        }

        renderLog();

        if (
            level === 'error'
        ) {
            console.error(
                '[Forms Importer]',
                message
            );
        }
        else {
            console.log(
                '[Forms Importer]',
                message
            );
        }
    }

    /* =========================================================
       V0.4 Workspace / Import / Editor UI
       ========================================================= */

    const STORAGE_KEY =
        'mfbi_v040_workspace';

    function derivedCorrect(q) {
        if (
            q.type ===
            'text'
        ) {
            return clean(
                q.textAnswer ||
                q.answerRaw ||
                ''
            );
        }

        return (
            q.correctIndexes ||
            []
        )
            .map(
                i =>
                    q.options?.[i]
                        ?.label ||
                    String(
                        i + 1
                    )
            )
            .filter(Boolean)
            .join('، ');
    }

    function questionToText(q) {
        const lines = [];

        lines.push(
            `س: ${
                clean(q.title)
            }`
        );

        if (clean(q.skill)) {
            lines.push(
                `المهارة: ${
                    clean(q.skill)
                }`
            );
        }

        if (q.type) {
            lines.push(
                `النوع: ${
                    typeLabel(
                        q.type
                    )
                }`
            );
        }

        if (
            q.type !==
            'text'
        ) {
            (
                q.options ||
                []
            ).forEach(
                (
                    o,
                    i
                ) => {

                    const letters =
                        [
                            'أ',
                            'ب',
                            'ج',
                            'د',
                            'هـ',
                            'و',
                            'ز',
                            'ح',
                            'ط',
                            'ي',
                            'ك',
                            'ل'
                        ];

                    lines.push(
                        `${
                            o.label ||
                            letters[i] ||
                            (
                                i + 1
                            )
                        }: ${
                            clean(
                                o.text
                            )
                        }`
                    );
                }
            );

            lines.push(
                `الصحيح: ${
                    clean(
                        q.answerRaw
                    ) ||
                    derivedCorrect(
                        q
                    )
                }`
            );
        }
        else {
            lines.push(
                `الإجابة: ${
                    clean(
                        q.textAnswer ||
                        q.answerRaw
                    )
                }`
            );
        }

        lines.push(
            `الدرجة: ${
                q.points
            }`
        );

        lines.push(
            `مطلوب: ${
                q.required
                    ? 'نعم'
                    : 'لا'
            }`
        );

        return lines.join(
            '\n'
        );
    }

    function reparseQuestion(q) {
        const defaults = {
            points:
                parsePoints(
                    q.points,
                    1
                ),

            required:
                !!q.required
        };

        const parsed =
            parseQuestions(
                questionToText(q),
                defaults
            )[0];

        if (!parsed) {
            return q;
        }

        return parsed;
    }

    function rowsToText(rows) {
        const blocks =
            [];

        const letters =
            [
                'أ',
                'ب',
                'ج',
                'د',
                'هـ',
                'و',
                'ز',
                'ح',
                'ط',
                'ي',
                'ك',
                'ل'
            ];

        for (
            const row
            of rows
        ) {
            const title =
                clean(
                    row['السؤال'] ??
                    row['سؤال'] ??
                    row['Question'] ??
                    row['question'] ??
                    ''
                );

            if (!title) {
                continue;
            }

            const skill =
                clean(
                    row['المهارة'] ??
                    row['المهاره'] ??
                    row['الدرس'] ??
                    row['العنوان الفرعي'] ??
                    row['Skill'] ??
                    row['skill'] ??
                    row['Subtitle'] ??
                    row['subtitle'] ??
                    ''
                );

            const type =
                clean(
                    row['النوع'] ??
                    row['نوع السؤال'] ??
                    row['Type'] ??
                    row['type'] ??
                    ''
                );

            const correct =
                clean(
                    row['الصحيح'] ??
                    row['الإجابة الصحيحة'] ??
                    row['الإجابة'] ??
                    row['Answer'] ??
                    row['answer'] ??
                    ''
                );

            const points =
                clean(
                    row['الدرجة'] ??
                    row['النقاط'] ??
                    row['Points'] ??
                    ''
                );

            const required =
                clean(
                    row['مطلوب'] ??
                    row['Required'] ??
                    ''
                );

            const lines =
                [
                    `س: ${title}`
                ];

            if (skill) {
                lines.push(
                    `المهارة: ${skill}`
                );
            }

            if (type) {
                lines.push(
                    `النوع: ${type}`
                );
            }

            const optionEntries =
                [];

            for (
                let i = 0;
                i <
                letters.length;
                i++
            ) {
                const l =
                    letters[i];

                const candidates =
                    [
                        `خيار ${l}`,
                        `الخيار ${l}`,
                        l,
                        `Option ${i + 1}`,
                        `option ${i + 1}`
                    ];

                let value =
                    '';

                for (
                    const k
                    of candidates
                ) {
                    if (
                        Object
                            .prototype
                            .hasOwnProperty
                            .call(
                                row,
                                k
                            )
                    ) {
                        value =
                            clean(
                                row[k]
                            );

                        if (value) {
                            break;
                        }
                    }
                }

                if (value) {
                    optionEntries.push(
                        [
                            l,
                            value
                        ]
                    );
                }
            }

            optionEntries
                .forEach(
                    (
                        [
                            l,
                            value
                        ]
                    ) =>
                        lines.push(
                            `${l}: ${value}`
                        )
                );

            if (correct) {
                lines.push(
                    `الإجابة: ${correct}`
                );
            }

            if (points) {
                lines.push(
                    `الدرجة: ${points}`
                );
            }

            if (required) {
                lines.push(
                    `مطلوب: ${required}`
                );
            }

            blocks.push(
                lines.join('\n')
            );
        }

        return blocks.join(
            '\n\n'
        );
    }

    function saveWorkspace() {
        try {
            const payload = {
                source:
                    $('.source')
                        ?.value ||
                    '',

                questions:
                    state.questions,

                results:
                    state.results,

                selected:
                    [
                        ...state.selected
                    ],

                points:
                    $('.points')
                        ?.value ??
                    1,

                required:
                    $('.required')
                        ?.checked ??
                    true,

                skipDup:
                    $('.skipDup')
                        ?.checked ??
                    true,

                continueErr:
                    $('.continueErr')
                        ?.checked ??
                    true,

                studentDataEnabled:
                    !!state.studentDataEnabled,

                studentAutoBefore:
                    !!state.studentAutoBefore,

                studentPinToTop:
                    !!state.studentPinToTop,

                studentFields:
                    state.studentFields
                        .map(
                            normalizeStudentField
                        ),

                ai: {
                    target: $('.aiTarget')?.value || '',
                    contentScope: $('.aiContentScope')?.value || '',
                    scopeMode: $('.aiScopeMode')?.value || 'strict',
                    testType: $('.aiTestType')?.value || 'تشخيصي',
                    total: $('.aiTotal')?.value || 40,
                    choice: $('.aiChoice')?.value || 32,
                    trueFalse: $('.aiTrueFalse')?.value || 8,
                    options: $('.aiOptions')?.value || 4,
                    points: $('.aiPoints')?.value || 1,
                    filename: $('.aiFilename')?.value || 'اختبار-Microsoft-Forms.xlsx'
                }
            };

            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(
                    payload
                )
            );
        }
        catch (_) {}
    }

    function loadWorkspace() {
        try {
            const raw =
                localStorage.getItem(
                    STORAGE_KEY
                );

            if (!raw) {
                return;
            }

            const data =
                JSON.parse(
                    raw
                );

            if ($('.source')) {
                $('.source').value =
                    data.source ||
                    '';
            }

            if ($('.points')) {
                $('.points').value =
                    data.points ??
                    1;
            }

            if ($('.required')) {
                $('.required').checked =
                    data.required ??
                    true;
            }

            if ($('.skipDup')) {
                $('.skipDup').checked =
                    data.skipDup ??
                    true;
            }

            if ($('.continueErr')) {
                $('.continueErr').checked =
                    data.continueErr ??
                    true;
            }

            state.studentDataEnabled =
                data.studentDataEnabled ??
                false;

            state.studentAutoBefore =
                data.studentAutoBefore ??
                true;

            state.studentPinToTop =
                data.studentPinToTop ??
                true;

            if (
                Array.isArray(
                    data.studentFields
                ) &&
                data.studentFields.length
            ) {
                state.studentFields =
                    data.studentFields
                        .map(
                            normalizeStudentField
                        );
            }

            const ai = data.ai || {};
            if ($('.aiTarget')) $('.aiTarget').value = ai.target || '';
            if ($('.aiContentScope')) $('.aiContentScope').value = ai.contentScope || '';
            if ($('.aiScopeMode')) $('.aiScopeMode').value = ai.scopeMode || 'strict';
            if ($('.aiTestType')) $('.aiTestType').value = ai.testType || 'تشخيصي';
            if ($('.aiTotal')) $('.aiTotal').value = ai.total ?? 40;
            if ($('.aiChoice')) $('.aiChoice').value = ai.choice ?? 32;
            if ($('.aiTrueFalse')) $('.aiTrueFalse').value = ai.trueFalse ?? 8;
            if ($('.aiOptions')) $('.aiOptions').value = ai.options ?? 4;
            if ($('.aiPoints')) $('.aiPoints').value = ai.points ?? 1;
            if ($('.aiFilename')) $('.aiFilename').value = ai.filename || 'اختبار-Microsoft-Forms.xlsx';

            if (
                Array.isArray(
                    data.questions
                )
            ) {
                state.questions =
                    data.questions;

                state.results =
                    Array.isArray(
                        data.results
                    ) &&
                    data.results.length ===
                    data.questions.length
                        ? data.results
                        : data.questions.map(
                            () => ({
                                status:
                                    'pending',

                                error:
                                    ''
                            })
                        );

                state.selected =
                    new Set(
                        Array.isArray(
                            data.selected
                        )
                            ? data.selected
                                .filter(
                                    i =>
                                        i >= 0 &&
                                        i <
                                        data.questions
                                            .length
                                )
                            : data.questions
                                .map(
                                    (
                                        _,
                                        i
                                    ) =>
                                        i
                                )
                    );
            }
        }
        catch (_) {}
    }

    function exportWorkbook(
        questions,
        filename
    ) {
        if (
            typeof XLSX ===
            'undefined'
        ) {
            setStatus(
                '❌ مكتبة Excel لم تُحمّل. حدّث الصفحة وحاول مرة أخرى.'
            );

            return;
        }

        const exportLetters =
            [
                'أ',
                'ب',
                'ج',
                'د',
                'هـ',
                'و',
                'ز',
                'ح',
                'ط',
                'ي',
                'ك',
                'ل'
            ];

        const maxOptionCount =
            Math.max(
                4,
                ...questions.map(
                    q =>
                        Math.min(
                            exportLetters.length,
                            q.options?.length || 0
                        )
                )
            );

        const exportHeaders =
            [
                'السؤال',
                'المهارة',
                'النوع',
                ...exportLetters
                    .slice(0, maxOptionCount)
                    .map(
                        letter =>
                            `خيار ${letter}`
                    ),
                'الصحيح',
                'الدرجة',
                'مطلوب'
            ];

        const rows =
            questions.length
                ? questions.map(
                    q => {

                        const row = {
                            'السؤال':
                                q.title,

                            'المهارة':
                                clean(q.skill),

                            'النوع':
                                typeLabel(
                                    q.type
                                ),

                            'الصحيح':
                                q.type ===
                                'text'
                                    ? (
                                        q.textAnswer ||
                                        q.answerRaw ||
                                        ''
                                    )
                                    : derivedCorrect(
                                        q
                                    ),

                            'الدرجة':
                                q.points,

                            'مطلوب':
                                q.required
                                    ? 'نعم'
                                    : 'لا'
                        };

                        (
                            q.options ||
                            []
                        ).forEach(
                            (
                                o,
                                i
                            ) => {

                                const letters =
                                    [
                                        'أ',
                                        'ب',
                                        'ج',
                                        'د',
                                        'هـ',
                                        'و',
                                        'ز',
                                        'ح',
                                        'ط',
                                        'ي',
                                        'ك',
                                        'ل'
                                    ];

                                row[
                                    `خيار ${
                                        letters[i] ||
                                        (
                                            i + 1
                                        )
                                    }`
                                ] =
                                    o.text;
                            }
                        );

                        return row;
                    }
                )
                : [
                    {
                        'السؤال':
                            '',

                        'المهارة':
                            '',

                        'النوع':
                            'اختيار',

                        'خيار أ':
                            '',

                        'خيار ب':
                            '',

                        'خيار ج':
                            '',

                        'خيار د':
                            '',

                        'الصحيح':
                            'أ',

                        'الدرجة':
                            1,

                        'مطلوب':
                            'نعم'
                    }
                ];

        const ws =
            XLSX.utils
                .json_to_sheet(
                    rows,
                    {
                        header:
                            exportHeaders
                    }
                );

        ws['!cols'] =
            [
                {
                    wch:
                        48
                },
                {
                    wch:
                        30
                },
                {
                    wch:
                        14
                },
                {
                    wch:
                        24
                },
                {
                    wch:
                        24
                },
                {
                    wch:
                        24
                },
                {
                    wch:
                        24
                },
                {
                    wch:
                        18
                },
                {
                    wch:
                        10
                },
                {
                    wch:
                        10
                }
            ];

        const wb =
            XLSX.utils
                .book_new();

        XLSX.utils
            .book_append_sheet(
                wb,
                ws,
                'الأسئلة'
            );

        XLSX.writeFile(
            wb,
            filename
        );
    }

    function downloadTemplate() {
        if (
            typeof XLSX ===
            'undefined'
        ) {
            setStatus(
                '❌ مكتبة Excel لم تُحمّل.'
            );

            return;
        }

        const rows = [
            {
                'السؤال':
                    'ما عاصمة المملكة العربية السعودية؟',

                'المهارة':
                    'تمييز الحقائق والمعلومات',

                'النوع':
                    'اختيار',

                'خيار أ':
                    'جدة',

                'خيار ب':
                    'الرياض',

                'خيار ج':
                    'الدمام',

                'خيار د':
                    'مكة المكرمة',

                'الصحيح':
                    'ب',

                'الدرجة':
                    1,

                'مطلوب':
                    'نعم'
            },

            {
                'السؤال':
                    'أي الأعداد التالية زوجية؟',

                'المهارة':
                    'تصنيف الأعداد',

                'النوع':
                    'متعدد',

                'خيار أ':
                    '2',

                'خيار ب':
                    '3',

                'خيار ج':
                    '4',

                'خيار د':
                    '5',

                'الصحيح':
                    'أ، ج',

                'الدرجة':
                    2,

                'مطلوب':
                    'نعم'
            },

            {
                'السؤال':
                    'اكتب عاصمة المملكة العربية السعودية.',

                'المهارة':
                    'استدعاء المعلومات الأساسية',

                'النوع':
                    'نصي',

                'خيار أ':
                    '',

                'خيار ب':
                    '',

                'خيار ج':
                    '',

                'خيار د':
                    '',

                'الصحيح':
                    'الرياض',

                'الدرجة':
                    1,

                'مطلوب':
                    'نعم'
            }
        ];

        const ws =
            XLSX.utils
                .json_to_sheet(
                    rows
                );

        ws['!cols'] =
            [
                {
                    wch:
                        48
                },
                {
                    wch:
                        30
                },
                {
                    wch:
                        14
                },
                {
                    wch:
                        24
                },
                {
                    wch:
                        24
                },
                {
                    wch:
                        24
                },
                {
                    wch:
                        24
                },
                {
                    wch:
                        18
                },
                {
                    wch:
                        10
                },
                {
                    wch:
                        10
                }
            ];

        const wb =
            XLSX.utils
                .book_new();

        XLSX.utils
            .book_append_sheet(
                wb,
                ws,
                'الأسئلة'
            );

        XLSX.writeFile(
            wb,
            'قالب-أسئلة-Microsoft-Forms.xlsx'
        );
    }

    async function importFile(
        file
    ) {
        if (!file) {
            return;
        }

        const defaults = {
            points:
                parsePoints(
                    $('.points')
                        .value,
                    1
                ),

            required:
                $('.required')
                    .checked
        };

        try {
            const ext =
                (
                    file.name
                        .split('.')
                        .pop() ||
                    ''
                )
                    .toLowerCase();

            let text =
                '';

            if (
                ext ===
                'txt'
            ) {
                text =
                    await file.text();
            }
            else {
                if (
                    typeof XLSX ===
                    'undefined'
                ) {
                    throw new Error(
                        'مكتبة Excel لم تُحمّل.'
                    );
                }

                let wb;

                if (
                    ext ===
                    'csv'
                ) {
                    const csvText =
                        await file.text();

                    wb =
                        XLSX.read(
                            csvText,
                            {
                                type:
                                    'string'
                            }
                        );
                }
                else {
                    const buf =
                        await file
                            .arrayBuffer();

                    wb =
                        XLSX.read(
                            buf,
                            {
                                type:
                                    'array'
                            }
                        );
                }

                const sheet =
                    wb.Sheets[
                        wb.SheetNames[0]
                    ];

                const rows =
                    XLSX.utils
                        .sheet_to_json(
                            sheet,
                            {
                                defval:
                                    ''
                            }
                        );

                text =
                    rowsToText(
                        rows
                    );
            }

            $('.source').value =
                text;

            state.questions =
                parseQuestions(
                    text,
                    defaults
                );

            state.results =
                state.questions
                    .map(
                        () => ({
                            status:
                                'pending',

                            error:
                                ''
                        })
                    );

            state.selected =
                new Set(
                    state.questions
                        .map(
                            (
                                _,
                                i
                            ) =>
                                i
                        )
                );

            state.nextIndex =
                0;

            setStatus(
                `تم استيراد ${
                    state.questions.length
                } سؤالًا من «${
                    file.name
                }».`
            );

            log(
                `استيراد ملف ${
                    file.name
                }: ${
                    state.questions.length
                } سؤال.`
            );

            render();

            switchTab(
                'preview'
            );

            saveWorkspace();
        }
        catch (err) {
            setStatus(
                `❌ فشل الاستيراد: ${
                    err.message ||
                    err
                }`
            );

            log(
                `فشل الاستيراد: ${
                    err.message ||
                    err
                }`,
                'error'
            );
        }
    }

    /* =========================================================
       الواجهة
       ========================================================= */


    /* =========================================================
       تصنيف مهارات الأسئلة الموجودة مسبقًا
       ========================================================= */

    function getExistingQuestionWrappers() {
        return [
            ...document.querySelectorAll(
                'button[data-automation-id="questionWrapper"],[role="button"][data-automation-id="questionWrapper"]'
            )
        ].filter(visible);
    }

    function getElementText(el) {
        if (!el) return '';

        if (
            el.matches?.('input,textarea')
        ) {
            return clean(el.value || '');
        }

        return clean(
            el.innerText ||
            el.textContent ||
            ''
        );
    }

    function cardAccessibleText(card) {
        if (!card) return '';

        const parts = [
            card.innerText || '',
            card.textContent || '',
            card.getAttribute?.('aria-label') || ''
        ];

        card.querySelectorAll(
            '[aria-label],[title],[data-automation-id]'
        ).forEach(el => {
            parts.push(
                el.getAttribute('aria-label') || '',
                el.getAttribute('title') || '',
                el.getAttribute('data-automation-id') || ''
            );
        });

        return clean(
            parts.join(' ')
        );
    }

    function isFileUploadCard(card) {
        const text =
            cardAccessibleText(card);

        return /(?:رفع|تحميل)\s*(?:ملف|الملف)|(?:ملف|الملف)\s*(?:مرفق|للرفع)|file\s*upload|upload\s*(?:a\s*)?file|attachment\s*upload|questionfileupload|fileupload/i
            .test(text);
    }

    function isLikelyStudentMetadata(
        title,
        points
    ) {
        if (Number(points) !== 0) {
            return false;
        }

        const t = canonical(title);

        return /(?:^|\s)(?:اسم|الاسم|اسمك|فصل|الفصل|شعبه|الشعبه|صف|الصف|مرحله|المرحله|مسار|المسار|مجموعه|المجموعه|name|class|section|grade|stage|group)(?:\s|$)/i
            .test(t);
    }

    function optionCorrectState(editor) {
        const item =
            editor?.closest?.(
                '[role="listitem"]'
            );

        if (!item) return false;

        const buttons = [
            ...item.querySelectorAll(
                'button,[role="button"],[role="checkbox"],[role="radio"]'
            )
        ].filter(
            el =>
                /إجابة صحيحة|اجابة صحيحة|Correct answer|mark.*correct|correct.*answer/i
                    .test(
                        labelOf(el)
                    )
        );

        for (const btn of buttons) {
            const label =
                labelOf(btn);

            const attrs = [
                btn.getAttribute('aria-pressed'),
                btn.getAttribute('aria-checked'),
                btn.getAttribute('data-state'),
                btn.getAttribute('data-selected'),
                btn.getAttribute('data-is-selected'),
                btn.getAttribute('data-checked')
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();

            if (
                /^(true|checked|on|selected)(\s|$)/i
                    .test(attrs) ||
                /إلغاء.*(?:إجابة|اجابة).*صحيحة|إزالة.*(?:إجابة|اجابة).*صحيحة|remove.*correct|unmark.*correct|correct.*selected|selected.*correct/i
                    .test(label)
            ) {
                return true;
            }
        }

        const itemLabel = clean(
            item.getAttribute('aria-label') ||
            ''
        );

        return /(?:الإجابة|الاجابة)\s*الصحيحة\s*(?:محددة|مختارة)|selected\s*correct\s*answer/i
            .test(itemLabel);
    }

    function detectExistingQuestionType(
        number,
        card,
        options
    ) {
        if (isFileUploadCard(card)) {
            return 'رفع ملف';
        }

        const multiple =
            getMultipleSwitch(number);

        if (
            multiple?.getAttribute(
                'aria-checked'
            ) === 'true'
        ) {
            return 'اختيارات متعددة';
        }

        if (options.length) {
            return 'اختيار';
        }

        const text =
            cardAccessibleText(card);

        if (/تاريخ|date question|questiondate/i.test(text)) {
            return 'تاريخ';
        }

        if (/تقييم|rating|questionrating/i.test(text)) {
            return 'تقييم';
        }

        if (/ترتيب|ranking|questionranking/i.test(text)) {
            return 'ترتيب';
        }

        if (/ليكرت|likert|questionlikert/i.test(text)) {
            return 'ليكرت';
        }

        return 'نصي';
    }

    function wrapperMatchesTitle(
        wrapper,
        title
    ) {
        const wanted = canonical(title);

        if (!wanted) return false;

        const hay = canonical(
            wrapper?.getAttribute?.(
                'aria-label'
            ) ||
            wrapper?.innerText ||
            wrapper?.textContent ||
            ''
        );

        return hay.includes(wanted);
    }

    async function openExistingQuestion(
        sourceIndex,
        expectedTitle = ''
    ) {
        let wrappers =
            getExistingQuestionWrappers();

        if (!wrappers.length) {
            throw new Error(
                'لم أجد أسئلة النموذج في الصفحة.'
            );
        }

        let wrapper =
            wrappers[sourceIndex] ||
            null;

        if (
            expectedTitle &&
            !wrapperMatchesTitle(
                wrapper,
                expectedTitle
            )
        ) {
            wrapper =
                wrappers.find(
                    w =>
                        wrapperMatchesTitle(
                            w,
                            expectedTitle
                        )
                ) ||
                wrapper;
        }

        if (!wrapper) {
            throw new Error(
                `تعذر العثور على السؤال رقم ${sourceIndex + 1}.`
            );
        }

        await clickElement(
            wrapper
        );

        const card =
            await waitFor(
                () => {
                    const cards =
                        getCards();

                    return cards.find(
                        c =>
                            c.querySelector(
                                '[role="textbox"]'
                            )
                    ) ||
                    cards[cards.length - 1] ||
                    null;
                },
                12000,
                120,
                `فتح السؤال ${sourceIndex + 1}`
            );

        const number =
            cardNumber(card) ||
            sourceIndex + 1;

        const titleEditor =
            await waitFor(
                () =>
                    getTitleEditor(
                        number
                    ) ||
                    [
                        ...card.querySelectorAll(
                            '[role="textbox"]'
                        )
                    ].find(
                        el =>
                            /عنوان السؤال|question title/i
                                .test(
                                    labelOf(el)
                                )
                    ) ||
                    null,
                8000,
                100,
                `عنوان السؤال ${sourceIndex + 1}`
            );

        return {
            wrapper,
            card,
            number,
            titleEditor
        };
    }

    function extractExistingQuestion(
        sourceIndex,
        opened
    ) {
        const {
            card,
            number,
            titleEditor
        } = opened;

        const title =
            getElementText(
                titleEditor
            );

        const pointsEl =
            getPoints(number);

        const points =
            Number(
                westernDigits(
                    pointsEl?.value ||
                    pointsEl?.getAttribute?.(
                        'value'
                    ) ||
                    0
                )
            ) || 0;

        if (isFileUploadCard(card)) {
            return {
                sourceIndex,
                title,
                points,
                fileUpload: true
            };
        }

        const optionEditors =
            getOptionEditors(number);

        const options =
            optionEditors.map(
                (
                    editor,
                    index
                ) => ({
                    index,
                    text:
                        getElementText(
                            editor
                        ),
                    correct:
                        optionCorrectState(
                            editor
                        )
                })
            );

        const subtitle =
            getSubtitleEditor(number);

        const currentSkill =
            getElementText(
                subtitle
            );

        let textAnswer = '';

        if (!options.length) {
            const candidate =
                textAnswerCandidates(
                    number
                )[0];

            if (candidate) {
                textAnswer =
                    getElementText(
                        candidate
                    );
            }
        }

        return {
            sourceIndex,
            formNumber:
                number,
            title,
            points,
            type:
                detectExistingQuestionType(
                    number,
                    card,
                    options
                ),
            options,
            textAnswer,
            currentSkill,
            skill:
                currentSkill,
            selected:
                !currentSkill,
            fileUpload:
                false,
            metadata:
                isLikelyStudentMetadata(
                    title,
                    points
                ),
            error: ''
        };
    }

    function setLegacySkillBusy(
        busy
    ) {
        state.legacySkillBusy =
            !!busy;

        state.running =
            !!busy;

        const selectors = [
            '.legacyScan',
            '.legacyCopyPrompt',
            '.legacyParse',
            '.legacyApply',
            '.legacySelectAll',
            '.legacySelectNone',
            '.legacyAssignSelected'
        ];

        selectors.forEach(
            sel => {
                const el = $(sel);
                if (el) el.disabled = !!busy;
            }
        );

        const stop =
            $('.legacyStop');

        if (stop) {
            stop.disabled = !busy;
        }
    }

    async function scanExistingQuestionsForSkills() {
        if (
            state.legacySkillBusy ||
            state.running
        ) {
            return;
        }

        const wrappers =
            getExistingQuestionWrappers();

        if (!wrappers.length) {
            setStatus(
                '❌ لم أجد أسئلة قابلة للفحص في النموذج الحالي.'
            );
            return;
        }

        const ignoreMetadata =
            $('.legacyIgnoreMetadata')
                ?.checked ??
            true;

        state.legacySkillIgnoreMetadata =
            ignoreMetadata;

        state.cancelRequested =
            false;

        state.legacySkillItems = [];
        state.legacySkillSkippedUploads = 0;
        state.legacySkillSkippedMetadata = 0;

        setLegacySkillBusy(true);
        renderLegacySkillCenter();

        let qCounter = 0;

        try {
            for (
                let i = 0;
                i < wrappers.length;
                i++
            ) {
                checkCancel();

                setStatus(
                    `فحص أسئلة النموذج ${i + 1}/${wrappers.length}...`
                );

                const opened =
                    await openExistingQuestion(
                        i
                    );

                const item =
                    extractExistingQuestion(
                        i,
                        opened
                    );

                if (item.fileUpload) {
                    state.legacySkillSkippedUploads++;
                    log(
                        `تم تجاهل سؤال رفع ملف: ${item.title || `السؤال ${i + 1}`}.`,
                        'warn'
                    );
                    continue;
                }

                if (
                    ignoreMetadata &&
                    item.metadata
                ) {
                    state.legacySkillSkippedMetadata++;
                    log(
                        `تم تجاهل سؤال بيانات طالب بدرجة 0: ${item.title || `السؤال ${i + 1}`}.`,
                        'warn'
                    );
                    continue;
                }

                qCounter++;

                item.qid =
                    `Q${String(qCounter).padStart(3, '0')}`;

                state.legacySkillItems.push(
                    item
                );

                renderLegacySkillCenter();

                await sleep(180);
            }

            const withSkill =
                state.legacySkillItems.filter(
                    x => x.currentSkill
                ).length;

            setStatus(
                `✅ تم فحص ${wrappers.length} سؤالًا: ${state.legacySkillItems.length} قابلة للتصنيف، ${state.legacySkillSkippedUploads} رفع ملف تم تجاهله، ${state.legacySkillSkippedMetadata} بيانات طالب تم تجاهلها، ${withSkill} لديها مهارة مسبقًا.`
            );
        }
        catch (e) {
            if (e?.cancelled) {
                setStatus(
                    '⛔ تم إيقاف فحص الأسئلة.'
                );
            }
            else {
                log(
                    `فحص الأسئلة القديمة: ${e?.message || e}`,
                    'error'
                );
                setStatus(
                    `❌ تعذر إكمال الفحص: ${e?.message || e}`
                );
            }
        }
        finally {
            setLegacySkillBusy(false);
            state.cancelRequested = false;
            renderLegacySkillCenter();
        }
    }

    const LEGACY_OPTION_LABELS = [
        'أ', 'ب', 'ج', 'د', 'هـ', 'و',
        'ز', 'ح', 'ط', 'ي', 'ك', 'ل'
    ];

    function selectedLegacySkillItems() {
        return state.legacySkillItems
            .filter(
                item =>
                    item.selected
            );
    }

    function formatLegacyQuestionForPrompt(
        item
    ) {
        const lines = [
            item.qid,
            `السؤال: ${item.title}`,
            `نوع السؤال: ${item.type || 'غير محدد'}`
        ];

        if (item.options?.length) {
            item.options.forEach(
                (
                    option,
                    index
                ) => {
                    lines.push(
                        `${LEGACY_OPTION_LABELS[index] || index + 1}: ${option.text}`
                    );
                }
            );

            const correct =
                item.options
                    .map(
                        (
                            option,
                            index
                        ) =>
                            option.correct
                                ? LEGACY_OPTION_LABELS[index] || String(index + 1)
                                : ''
                    )
                    .filter(Boolean);

            if (correct.length) {
                lines.push(
                    `الإجابة الصحيحة: ${correct.join('، ')}`
                );
            }
        }
        else if (item.textAnswer) {
            lines.push(
                `الإجابة الصحيحة النصية: ${item.textAnswer}`
            );
        }

        return lines.join('\n');
    }

    function buildLegacySkillPrompt() {
        const items =
            selectedLegacySkillItems();

        if (!items.length) {
            return '';
        }

        const questionsText =
            items
                .map(
                    formatLegacyQuestionForPrompt
                )
                .join('\n\n');

        return `أنت تعمل كمحلل محتوى تعليمي ومصمم قياس وتقويم. لدي أسئلة قديمة من اختبار Microsoft Forms، وأريد تصنيف كل سؤال تحت مهارة تعليمية واضحة وموحدة بالاعتماد على المصدر المرفق في NotebookLM أو الأداة التي أستخدمها.\n\nالمطلوب:\n1) اقرأ المصدر أولًا وحدد مجموعة محدودة وموحدة من المهارات الرئيسة التي تقيسها هذه الأسئلة.\n2) صنف كل سؤال تحت مهارة واحدة هي الأقرب لما يقيسه السؤال فعليًا.\n3) استخدم الاسم نفسه حرفيًا لكل الأسئلة التي تقيس المهارة نفسها. لا تنشئ اسمًا مختلفًا لكل سؤال ولا تستخدم أسماء متقاربة لنفس المفهوم.\n4) اجعل اسم المهارة قصيرًا وواضحًا ومناسبًا للتقارير، مثل: «مفاهيم الأمن السيبراني» أو «استخدام أدوات تحرير الفيديو».\n5) اعتمد على نص السؤال والخيارات والإجابة الصحيحة - عندما تكون ظاهرة - وعلى المصدر المرفق.\n6) لا تعد كتابة الأسئلة، ولا تغير أرقام Q، ولا تضف شرحًا أو ملاحظات.\n7) إذا وجدت سؤالًا لا يمكن ربطه بالمصدر بثقة، اكتب أمامه: غير مصنف.\n8) أسئلة رفع الملفات غير موجودة في القائمة لأنها مستبعدة تلقائيًا؛ لا تنشئ لها أسطرًا.\n\nأخرج النتيجة فقط، سطرًا واحدًا لكل سؤال، بهذه الصيغة الحرفية:\nQ001 | اسم المهارة\nQ002 | اسم المهارة\nQ003 | اسم المهارة\n\nيجب أن يحتوي الناتج على ${items.length} سطرًا مطابقًا للأسئلة المرسلة فقط، دون مقدمة ودون جدول Markdown ودون ترقيم إضافي.\n\nالأسئلة:\n\n${questionsText}`;
    }

    function parseLegacySkillResult(
        raw
    ) {
        const known =
            new Map(
                state.legacySkillItems.map(
                    item => [
                        item.qid.toUpperCase(),
                        item
                    ]
                )
            );

        const seen =
            new Set();

        let applied = 0;
        let unknown = 0;
        let invalid = 0;
        let duplicates = 0;

        String(raw || '')
            .split(/\r?\n/)
            .forEach(lineRaw => {
                let line =
                    clean(lineRaw)
                        .replace(/^[-*•]+\s*/, '')
                        .replace(/^\|\s*/, '')
                        .replace(/\s*\|$/, '');

                if (!line) return;

                const idMatch =
                    line.match(
                        /\bQ\s*0*(\d{1,5})\b/i
                    );

                if (!idMatch) {
                    if (!/المهارة|skill|qid/i.test(line)) {
                        invalid++;
                    }
                    return;
                }

                const qid =
                    `Q${String(Number(idMatch[1])).padStart(3, '0')}`;

                const item =
                    known.get(
                        qid.toUpperCase()
                    );

                if (!item) {
                    unknown++;
                    return;
                }

                if (seen.has(qid)) {
                    duplicates++;
                }
                seen.add(qid);

                let skill = '';

                const pipeParts =
                    line
                        .split('|')
                        .map(clean)
                        .filter(Boolean);

                if (pipeParts.length >= 2) {
                    const idIndex =
                        pipeParts.findIndex(
                            part =>
                                /\bQ\s*0*\d+\b/i
                                    .test(part)
                        );

                    if (
                        idIndex >= 0 &&
                        pipeParts[idIndex + 1]
                    ) {
                        skill =
                            pipeParts[idIndex + 1];
                    }
                }

                if (!skill) {
                    skill = clean(
                        line
                            .replace(
                                /.*?\bQ\s*0*\d+\b/i,
                                ''
                            )
                            .replace(
                                /^[\s:：\-–—>|]+/,
                                ''
                            )
                    );
                }

                skill = clean(
                    skill
                        .replace(/^\*+|\*+$/g, '')
                        .replace(/^`+|`+$/g, '')
                );

                if (!skill) {
                    invalid++;
                    return;
                }

                item.skill =
                    skill;

                item.selected =
                    true;

                applied++;
            });

        const missing =
            selectedLegacySkillItems()
                .filter(
                    item =>
                        !clean(item.skill)
                ).length;

        return {
            applied,
            unknown,
            invalid,
            duplicates,
            missing
        };
    }

    function legacySkillBackupText() {
        if (!state.legacySkillItems.length) {
            return '';
        }

        return [
            `نسخة احتياطية لمهارات Microsoft Forms — ${new Date().toLocaleString('ar-SA')}`,
            '',
            ...state.legacySkillItems.map(
                item =>
                    `${item.qid} | ${item.title} | ${item.currentSkill || '(بدون مهارة)'}`
            )
        ].join('\n');
    }

    async function applyLegacySkillsToForms() {
        if (
            state.legacySkillBusy ||
            state.running
        ) {
            return;
        }

        const replaceExisting =
            $('.legacyReplaceExisting')
                ?.checked ??
            false;

        state.legacySkillReplaceExisting =
            replaceExisting;

        const targets =
            state.legacySkillItems
                .filter(
                    item =>
                        item.selected &&
                        clean(item.skill) &&
                        canonical(item.skill) !==
                            canonical('غير مصنف')
                );

        if (!targets.length) {
            setStatus(
                'اختر سؤالًا واحدًا على الأقل وأدخل له مهارة قبل التطبيق.'
            );
            return;
        }

        const blocked =
            targets.filter(
                item =>
                    item.currentSkill &&
                    !replaceExisting
            ).length;

        const executable =
            targets.length -
            blocked;

        if (!executable) {
            setStatus(
                'كل الأسئلة المحددة لديها مهارات مسبقًا. فعّل «استبدال المهارات الموجودة» إذا أردت تحديثها.'
            );
            return;
        }

        if (
            !confirm(
                `سيتم كتابة المهارات في Subtitle لـ ${executable} سؤالًا.\n` +
                `${blocked ? `وسيتم تخطي ${blocked} سؤالًا لديه مهارة مسبقًا.\n` : ''}` +
                `أسئلة رفع الملفات ستُتجاهل حتى لو ظهرت أثناء التطبيق. هل تريد المتابعة؟`
            )
        ) {
            return;
        }

        state.cancelRequested =
            false;

        setLegacySkillBusy(true);

        let done = 0;
        let skipped = blocked;
        let failed = 0;
        let uploads = 0;

        try {
            for (
                let i = 0;
                i < targets.length;
                i++
            ) {
                checkCancel();

                const item =
                    targets[i];

                if (
                    item.currentSkill &&
                    !replaceExisting
                ) {
                    continue;
                }

                const progress =
                    msg =>
                        setStatus(
                            `المهارات ${i + 1}/${targets.length} — ${item.qid}: ${msg}`
                        );

                try {
                    const opened =
                        await openExistingQuestion(
                            item.sourceIndex,
                            item.title
                        );

                    if (
                        isFileUploadCard(
                            opened.card
                        )
                    ) {
                        uploads++;
                        skipped++;
                        log(
                            `${item.qid}: تم تجاهل السؤال لأنه رفع ملف.`,
                            'warn'
                        );
                        continue;
                    }

                    const current =
                        getElementText(
                            getSubtitleEditor(
                                opened.number
                            )
                        );

                    if (
                        current &&
                        !replaceExisting
                    ) {
                        item.currentSkill =
                            current;
                        skipped++;
                        continue;
                    }

                    await ensureQuestionSubtitle(
                        opened.number,
                        item.skill,
                        progress
                    );

                    item.currentSkill =
                        item.skill;

                    done++;

                    log(
                        `${item.qid}: تمت كتابة المهارة «${item.skill}».`
                    );

                    await sleep(450);
                }
                catch (e) {
                    if (e?.cancelled) {
                        throw e;
                    }

                    failed++;
                    item.error =
                        e?.message ||
                        String(e);

                    log(
                        `${item.qid}: ${item.error}`,
                        'error'
                    );
                }

                renderLegacySkillCenter();
            }

            setStatus(
                `✅ انتهى تطبيق المهارات: تم ${done}، تخطي ${skipped}، أخطاء ${failed}${uploads ? `، رفع ملفات ${uploads}` : ''}.`
            );
        }
        catch (e) {
            if (e?.cancelled) {
                setStatus(
                    `⛔ تم إيقاف العملية. نُفذت ${done} مهارة قبل الإيقاف.`
                );
            }
            else {
                setStatus(
                    `❌ خطأ أثناء تطبيق المهارات: ${e?.message || e}`
                );
            }
        }
        finally {
            setLegacySkillBusy(false);
            state.cancelRequested = false;
            renderLegacySkillCenter();
        }
    }

    function renderLegacySkillCenter() {
        const box =
            $('.legacySkillList');

        const stats =
            $('.legacySkillStats');

        if (!box || !stats) {
            return;
        }

        const items =
            state.legacySkillItems;

        const selected =
            items.filter(
                x => x.selected
            ).length;

        const withSkill =
            items.filter(
                x => x.currentSkill
            ).length;

        const assigned =
            items.filter(
                x =>
                    clean(x.skill) &&
                    canonical(x.skill) !==
                        canonical(x.currentSkill)
            ).length;

        stats.innerHTML = `
<div class="stat"><b>${items.length}</b><span>قابلة للتصنيف</span></div>
<div class="stat"><b>${selected}</b><span>محددة</span></div>
<div class="stat"><b>${withSkill}</b><span>بمهارة سابقة</span></div>
<div class="stat"><b>${assigned}</b><span>مهارات جديدة</span></div>
<div class="stat"><b>${state.legacySkillSkippedUploads}</b><span>رفع ملف متجاهل</span></div>
<div class="stat"><b>${state.legacySkillSkippedMetadata}</b><span>بيانات طالب متجاهلة</span></div>`;

        if (!items.length) {
            box.innerHTML = `
<div class="legacyEmpty">
    اضغط «فحص أسئلة النموذج» لاستخراج الأسئلة القديمة. أسئلة رفع الملفات تُستبعد تلقائيًا ولا تحصل على QID.
</div>`;
            return;
        }

        box.innerHTML = `
<table>
<thead>
<tr>
    <th>تحديد</th>
    <th>QID</th>
    <th style="min-width:240px">السؤال</th>
    <th>النوع</th>
    <th style="min-width:150px">المهارة الحالية</th>
    <th style="min-width:190px">المهارة الجديدة</th>
    <th>الحالة</th>
</tr>
</thead>
<tbody>
${items.map((item, index) => `
<tr class="${item.error ? 'error' : ''}">
    <td><input type="checkbox" class="legacyItemSelect" data-i="${index}" ${item.selected ? 'checked' : ''}></td>
    <td><b>${html(item.qid)}</b></td>
    <td>
        <div>${html(item.title || '(بدون عنوان)')}</div>
        ${item.options?.length ? `<div class="small">${item.options.length} خيارات${item.options.some(x => x.correct) ? ' · تم اكتشاف الإجابة الصحيحة' : ''}</div>` : ''}
    </td>
    <td>${html(item.type || '')}</td>
    <td>${item.currentSkill ? `<span class="pill">${html(item.currentSkill)}</span>` : '<span class="small">—</span>'}</td>
    <td>
        <input class="editInput legacySkillInput" data-i="${index}" value="${html(item.skill || '')}" placeholder="اسم المهارة">
    </td>
    <td>${item.error ? `<span style="color:#a52525">${html(item.error)}</span>` : (item.currentSkill && canonical(item.currentSkill) === canonical(item.skill) ? 'محفوظة' : 'جاهز')}</td>
</tr>`).join('')}
</tbody>
</table>`;

        box.querySelectorAll(
            '.legacyItemSelect'
        ).forEach(el => {
            el.onchange =
                () => {
                    const i =
                        Number(
                            el.dataset.i
                        );
                    if (state.legacySkillItems[i]) {
                        state.legacySkillItems[i].selected =
                            !!el.checked;
                        renderLegacySkillCenter();
                    }
                };
        });

        box.querySelectorAll(
            '.legacySkillInput'
        ).forEach(el => {
            el.onchange =
                () => {
                    const i =
                        Number(
                            el.dataset.i
                        );
                    if (state.legacySkillItems[i]) {
                        state.legacySkillItems[i].skill =
                            clean(el.value);
                        state.legacySkillItems[i].selected =
                            true;
                        renderLegacySkillCenter();
                    }
                };
        });
    }

    const host =
        document.createElement(
            'div'
        );

    host.id =
        HOST_ID;

    document.body
        .appendChild(
            host
        );

    const root =
        host.attachShadow({
            mode:
                'open'
        });

    root.innerHTML = `
<style>
* {
    box-sizing: border-box;
}

.panel {
    display: none;
    position: fixed;
    left: 14px;
    top: 20px;
    bottom: 52px;
    width: min(
        790px,
        calc(100vw - 28px)
    );
    z-index: 2147483646;
    direction: rtl;
    background: #fff;
    color: #1f2937;
    border: 1px solid #d8e2e7;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 18px 55px #0004;
    font-family: "Segoe UI", Tahoma, Arial;
}

.panel.open {
    display: flex;
    flex-direction: column;
}

.head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 13px 15px;
    background: #087f83;
    color: #fff;
}

.head b {
    font-size: 17px;
}

.sub {
    font-size: 11px;
    margin-top: 3px;
    opacity: .9;
}

.close {
    width: 34px;
    height: 34px;
    border: 0;
    border-radius: 9px;
    background: #ffffff24;
    color: #fff;
    font-size: 20px;
    cursor: pointer;
}

.tabs {
    display: flex;
    gap: 4px;
    padding: 8px 10px;
    border-bottom: 1px solid #e3e8eb;
    background: #f7fafb;
}

.tabBtn {
    border: 0;
    padding: 8px 12px;
    border-radius: 8px;
    background: transparent;
    font: 700 11px "Segoe UI";
    cursor: pointer;
    color: #345;
}

.tabBtn.active {
    background: #087f83;
    color: #fff;
}

.body {
    padding: 12px;
    overflow: auto;
    flex: 1;
}

.tab {
    display: none;
}

.tab.active {
    display: block;
}

.note {
    padding: 9px 10px;
    border-radius: 10px;
    background: #eef8f9;
    color: #315d61;
    font-size: 12px;
    line-height: 1.7;
    margin-bottom: 9px;
}

.source {
    width: 100%;
    height: 225px;
    resize: vertical;
    border: 1px solid #cdd8de;
    border-radius: 10px;
    padding: 10px;
    outline: none;
    direction: rtl;
    font: 13px/1.75 "Segoe UI", Tahoma, Arial;
}

.source:focus {
    border-color: #087f83;
    box-shadow: 0 0 0 3px #087f8318;
}

.settings {
    display: grid;
    grid-template-columns: repeat(
        4,
        1fr
    );
    gap: 8px;
    margin-top: 9px;
}

.box {
    padding: 8px 9px;
    border: 1px solid #e1e7ea;
    border-radius: 9px;
    background: #fafcfd;
    font-size: 11px;
}

.box input[type=number] {
    width: 65px;
    padding: 5px;
    border: 1px solid #ccd8dd;
    border-radius: 6px;
}

.actions {
    display: flex;
    gap: 7px;
    flex-wrap: wrap;
    margin-top: 9px;
}

.btn,
.iconBtn {
    border: 0;
    border-radius: 8px;
    padding: 8px 11px;
    font: 700 11px "Segoe UI", Tahoma, Arial;
    cursor: pointer;
}

.primary {
    background: #087f83;
    color: white;
}

.secondary {
    background: #eaf2f4;
    color: #17494e;
}

.danger {
    background: #feecec;
    color: #a52525;
}

.btn:disabled,
.iconBtn:disabled {
    opacity: .45;
    cursor: not-allowed;
}

.status {
    margin-top: 9px;
    padding: 8px 9px;
    border-radius: 8px;
    background: #f4f7f8;
    font-size: 11px;
    line-height: 1.6;
    border: 1px solid #e4eaed;
    border-right: 4px solid #087f83;
}

.progress {
    height: 7px;
    margin-top: 7px;
    background: #e5eaed;
    border-radius: 999px;
    overflow: hidden;
}

.progress span {
    display: block;
    height: 100%;
    width: 0;
    background: #087f83;
    transition: width .2s;
}

.preview {
    margin-top: 9px;
    max-height: 430px;
    overflow: auto;
    border: 1px solid #e1e6e9;
    border-radius: 9px;
}

table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10.5px;
}

th,
td {
    padding: 6px;
    border-bottom: 1px solid #edf0f2;
    text-align: right;
    vertical-align: top;
}

th {
    position: sticky;
    top: 0;
    background: #f6f9fa;
    z-index: 1;
}

tr.done td {
    background: #f0fbf5;
}

tr.running td {
    background: #fffbea;
}

tr.error td {
    background: #fff0f0;
}

tr.skipped td {
    background: #f5f5f5;
    color: #666;
}

tr.unselected td {
    opacity: .5;
}

.errors {
    margin-top: 7px;
    color: #a52525;
    font-size: 11px;
    line-height: 1.6;
}

.warnings {
    color: #8a6200;
}

.logWrap {
    margin-top: 9px;
    border: 1px dashed #d3dde1;
    border-radius: 9px;
    padding: 7px;
}

.log {
    max-height: 210px;
    overflow: auto;
    font: 10.5px/1.55 Consolas, "Segoe UI";
    direction: rtl;
}

.log .error {
    color: #a52525;
}

.log .warn {
    color: #8a6200;
}

.pill {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 999px;
    background: #eaf2f4;
    font-size: 10px;
}

.stats {
    display: grid;
    grid-template-columns: repeat(
        6,
        1fr
    );
    gap: 7px;
    margin: 8px 0;
}

.stat {
    padding: 8px;
    border: 1px solid #e1e7ea;
    border-radius: 9px;
    background: #fafcfd;
    text-align: center;
}

.stat b {
    display: block;
    font-size: 16px;
    color: #087f83;
}

.stat span {
    font-size: 10px;
    color: #667;
}

.importBox {
    border: 1px dashed #b9cbd2;
    border-radius: 12px;
    padding: 18px;
    text-align: center;
    background: #fbfdfd;
}

.fileInput {
    display: none;
}

.editorTools {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin: 8px 0;
}

.iconBtn {
    border: 1px solid #d6e0e4;
    background: #fff;
    padding: 5px 7px;
}

.editInput,
.editSelect {
    width: 100%;
    border: 1px solid #ccd8dd;
    border-radius: 6px;
    padding: 5px;
    font: 11px "Segoe UI";
    direction: rtl;
}

.small {
    font-size: 10px;
    color: #667;
}

.btn,
.iconBtn,
.tabBtn,
.close,
.aboutBtn {
    transition:
        transform .15s ease,
        filter .15s ease,
        box-shadow .15s ease;
}

.btn:not(:disabled):hover,
.iconBtn:not(:disabled):hover,
.tabBtn:hover,
.aboutBtn:hover {
    filter: brightness(.97);
    transform: translateY(-1px);
}

.brandRow {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
}

.versionBadge {
    display: inline-flex;
    align-items: center;
    padding: 3px 8px;
    border-radius: 999px;
    background: #ffffff26;
    border: 1px solid #ffffff2d;
    font-size: 10px;
    font-weight: 800;
}

.headActions {
    display: flex;
    align-items: center;
    gap: 7px;
}

.aboutBtn {
    border: 1px solid #ffffff32;
    background: #ffffff18;
    color: #fff;
    border-radius: 9px;
    padding: 7px 10px;
    font: 700 11px "Segoe UI", Tahoma, Arial;
    cursor: pointer;
}

.rightsFooter {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    padding: 9px 13px;
    background: #f7fafb;
    border-top: 1px solid #e3e8eb;
    font-size: 10.5px;
    color: #56666d;
}

.rightsFooter strong {
    color: #087f83;
}

.rightsLinks {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

.rightsLinks a,
.aboutCard a {
    color: #087f83;
    text-decoration: none;
    font-weight: 700;
}

.rightsLinks a:hover,
.aboutCard a:hover {
    text-decoration: underline;
}

.aboutOverlay {
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 18px;
    background: #0006;
    direction: rtl;
    font-family: "Segoe UI", Tahoma, Arial;
}

.aboutOverlay[hidden] {
    display: none;
}

.aboutCard {
    width: min(
        470px,
        calc(100vw - 36px)
    );
    background: #fff;
    color: #1f2937;
    border-radius: 16px;
    box-shadow: 0 24px 70px #0005;
    overflow: hidden;
    border: 1px solid #dbe4e8;
}

.aboutTop {
    padding: 18px;
    background:
        linear-gradient(
            135deg,
            #087f83,
            #116a7b
        );
    color: #fff;
}

.aboutTop h3 {
    margin: 0 0 4px;
    font-size: 18px;
}

.aboutBody {
    padding: 16px;
    line-height: 1.9;
    font-size: 12px;
}

.aboutIdentity {
    padding: 10px 12px;
    background: #f4fafb;
    border: 1px solid #dcebed;
    border-radius: 10px;
    margin: 10px 0;
}

.aboutSocial {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 11px;
}

.aboutSocial a {
    display: inline-flex;
    padding: 7px 10px;
    border-radius: 8px;
    background: #eaf4f5;
}

.aboutBottom {
    display: flex;
    justify-content: flex-end;
    padding: 10px 14px;
    border-top: 1px solid #e6ebee;
    background: #fafcfd;
}

.aboutClose {
    border: 0;
    border-radius: 8px;
    background: #087f83;
    color: #fff;
    padding: 8px 14px;
    font: 700 11px "Segoe UI";
    cursor: pointer;
}

.studentMaster {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    margin-bottom: 8px;
    border: 1px solid #d9e5e7;
    border-radius: 10px;
    background: #f7fbfb;
    font-size: 12px;
    font-weight: 800;
    color: #244f53;
}

.studentMaster input,
.studentFieldCard input[type=checkbox] {
    accent-color: #087f83;
}

.studentFields {
    display: grid;
    gap: 8px;
    margin-top: 10px;
}

.studentFieldCard {
    border: 1px solid #dde6e9;
    border-radius: 11px;
    padding: 10px;
    background: #fcfefe;
}

.studentFieldTop {
    display: grid;
    grid-template-columns: auto minmax(180px, 1.7fr) minmax(145px, .8fr) auto;
    gap: 7px;
    align-items: center;
}

.studentFieldTitle,
.studentFieldKind,
.studentFieldOptions {
    width: 100%;
    border: 1px solid #ccd8dd;
    border-radius: 7px;
    padding: 7px 8px;
    background: #fff;
    font: 11px/1.5 "Segoe UI", Tahoma, Arial;
    direction: rtl;
    outline: none;
}

.studentFieldOptions {
    min-height: 72px;
    resize: vertical;
    margin-top: 8px;
}

.studentFieldMeta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-top: 7px;
    font-size: 10.5px;
    color: #667;
    flex-wrap: wrap;
}

.studentFieldActions {
    display: flex;
    gap: 4px;
}

.studentFieldActions button {
    border: 1px solid #d6e0e4;
    background: #fff;
    border-radius: 7px;
    padding: 4px 7px;
    cursor: pointer;
}

.studentHint {
    margin-top: 9px;
    padding: 10px 11px;
    border: 1px solid #d8e8ea;
    border-radius: 10px;
    background: #f2fafb;
    font-size: 11px;
    line-height: 1.75;
    color: #315d61;
}

@media(max-width:760px) {
    .studentFieldTop {
        grid-template-columns: auto 1fr;
    }
}

.aiGrid {
    display: grid;
    grid-template-columns: repeat(4, minmax(130px, 1fr));
    gap: 8px;
    margin: 10px 0;
}

.aiField {
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 9px;
    border: 1px solid #e1e7ea;
    border-radius: 9px;
    background: #fafcfd;
    font-size: 11px;
    font-weight: 700;
}

.aiField.wide {
    grid-column: span 2;
}

.aiField input,
.aiField select {
    width: 100%;
    border: 1px solid #ccd8dd;
    border-radius: 7px;
    padding: 7px 8px;
    background: #fff;
    font: 12px "Segoe UI", Tahoma, Arial;
    direction: rtl;
    outline: none;
}

.aiField input:focus,
.aiField select:focus {
    border-color: #087f83;
    box-shadow: 0 0 0 3px #087f8318;
}

.aiHint {
    margin-top: 9px;
    padding: 10px 11px;
    border: 1px solid #d8e8ea;
    border-radius: 10px;
    background: #f2fafb;
    font-size: 11px;
    line-height: 1.75;
    color: #315d61;
}

@media (max-width: 760px) {
    .aiGrid {
        grid-template-columns: 1fr 1fr;
    }
    .aiField.wide {
        grid-column: span 2;
    }
}

.legacySkillStats {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 7px;
    margin: 9px 0;
}

.legacySkillList {
    margin-top: 9px;
    max-height: 390px;
    overflow: auto;
    border: 1px solid #e1e6e9;
    border-radius: 9px;
}

.legacySkillList input[type=checkbox],
.legacyOptions input[type=checkbox] {
    accent-color: #087f83;
}

.legacyPromptResult {
    width: 100%;
    min-height: 118px;
    resize: vertical;
    border: 1px solid #ccd8dd;
    border-radius: 9px;
    padding: 9px 10px;
    margin-top: 9px;
    direction: rtl;
    font: 11px/1.65 Consolas, "Segoe UI", Tahoma, Arial;
    outline: none;
}

.legacyPromptResult:focus,
.legacyManualSkill:focus {
    border-color: #087f83;
    box-shadow: 0 0 0 3px #087f8318;
}

.legacyOptions {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    padding: 9px 10px;
    border: 1px solid #dde6e9;
    border-radius: 9px;
    background: #fafcfd;
    font-size: 11px;
    margin-top: 8px;
}

.legacyOptions label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
}

.legacyManualRow {
    display: grid;
    grid-template-columns: minmax(200px, 1fr) auto;
    gap: 7px;
    margin-top: 9px;
}

.legacyManualSkill {
    width: 100%;
    border: 1px solid #ccd8dd;
    border-radius: 8px;
    padding: 8px 9px;
    background: #fff;
    font: 11px "Segoe UI", Tahoma, Arial;
    direction: rtl;
    outline: none;
}

.legacyEmpty {
    padding: 22px 14px;
    text-align: center;
    color: #667;
    font-size: 11px;
    line-height: 1.8;
}

@media (max-width: 760px) {
    .legacySkillStats {
        grid-template-columns: repeat(2, 1fr);
    }
    .legacyManualRow {
        grid-template-columns: 1fr;
    }
}

</style>

<section class="panel">

<header class="head">

<div>

<div class="brandRow">

<b>
    بنك الأسئلة والإدخال الجماعي
</b>

<span class="versionBadge">
    v${VERSION}
</span>

</div>

<div class="sub">
    Microsoft Forms · تصميم وتطوير
    ${DEVELOPER.name}
    (${DEVELOPER.handle})
</div>

</div>

<div class="headActions">

<button
    class="aboutBtn"
    type="button"
>
    عن السكربت
</button>

<button
    class="close"
    type="button"
    title="إغلاق"
>
    ×
</button>

</div>

</header>

<nav class="tabs">

<button
    class="tabBtn active"
    data-tab="input"
>
    الإدخال
</button>

<button
    class="tabBtn"
    data-tab="student"
>
    👤 بيانات الطالب
</button>

<button
    class="tabBtn"
    data-tab="ai"
>
    ✨ مساعد AI
</button>

<button
    class="tabBtn"
    data-tab="legacySkills"
>
    🏷️ مهارات القديم
</button>

<button
    class="tabBtn"
    data-tab="import"
>
    استيراد ملف
</button>

<button
    class="tabBtn"
    data-tab="preview"
>
    المعاينة والتحرير
</button>

<button
    class="tabBtn"
    data-tab="log"
>
    سجل التنفيذ
</button>

</nav>

<div class="body">

<section
    class="tab active"
    data-pane="input"
>

<div class="note">
    ألصق الأسئلة مباشرة. يدعم الحقل الجديد «المهارة»، وسيُكتب تلقائيًا كعنوان فرعي للسؤال في Microsoft Forms.
    يمكن بعد التحليل تعديل الأسئلة والمهارات واختيار بعضها فقط للإدخال.
</div>

<textarea
    class="source"
    placeholder="س: ما عاصمة المملكة العربية السعودية؟
المهارة: تمييز الحقائق والمعلومات
أ: جدة
ب: الرياض
ج: الدمام
د: مكة
الصحيح: ب
الدرجة: 1"
></textarea>

<div class="settings">

<div class="box">

الدرجة الافتراضية:

<input
    class="points"
    type="number"
    min="0"
    step="0.5"
    value="1"
>

</div>

<label class="box">

<input
    class="required"
    type="checkbox"
    checked
>

مطلوب افتراضيًا

</label>

<label class="box">

<input
    class="skipDup"
    type="checkbox"
    checked
>

تخطي الموجود

</label>

<label class="box">

<input
    class="continueErr"
    type="checkbox"
    checked
>

متابعة عند الخطأ

</label>

</div>

<div class="actions">

<button class="btn secondary analyze">
    تحليل ومعاينة
</button>

<button
    class="btn primary run"
    disabled
>
    إدخال المحدد
</button>

<button
    class="btn primary retry"
    disabled
>
    إعادة الفاشل
</button>

<button
    class="btn primary resume"
    disabled
>
    استئناف
</button>

<button
    class="btn danger stop"
    disabled
>
    إيقاف
</button>

<button class="btn secondary clear">
    مسح
</button>

</div>

</section>

<section
    class="tab"
    data-pane="student"
>

<div class="note">
    أضف حقولًا تعريفية اختيارية قبل أسئلة الاختبار مثل الاسم، الفصل/الشعبة، الصف، المرحلة أو أي بيانات أخرى. هذه الحقول تُنشأ دائمًا بدرجة 0 ولا تدخل في مجموع الاختبار، وتبقى متوافقة مع محلل النتائج كبيانات وصفية.
</div>

<label class="studentMaster">
    <input class="studentDataEnabled" type="checkbox">
    تفعيل بيانات الطالب لهذا النموذج
</label>

<label class="studentMaster">
    <input class="studentAutoBefore" type="checkbox" checked>
    إدخال الحقول التعريفية تلقائيًا قبل أسئلة بنك الأسئلة
</label>

<label class="studentMaster">
    <input class="studentPinToTop" type="checkbox" checked>
    نقل الحقول الجديدة إلى بداية النموذج قدر الإمكان
</label>

<div class="actions">
    <button class="btn secondary studentPreset" data-preset="name">+ الاسم الكامل</button>
    <button class="btn secondary studentPreset" data-preset="class">+ الفصل / الشعبة</button>
    <button class="btn secondary studentPreset" data-preset="grade">+ الصف</button>
    <button class="btn secondary studentPreset" data-preset="stage">+ المرحلة</button>
    <button class="btn secondary studentPreset" data-preset="custom">+ حقل مخصص</button>
</div>

<div class="studentFields"></div>

<div class="actions">
    <button class="btn primary insertStudentData">👤 إدخال بيانات الطالب الآن</button>
</div>

<div class="studentHint">
    💡 الأنواع المتاحة: نصي، اختيار واحد، قائمة منسدلة، أو اختيارات متعددة (Checkbox). للحقل الاختياري اكتب كل خيار في سطر مستقل. لا تحتاج إلى تحديد إجابة صحيحة لهذه الحقول لأنها غير مقيمة ودرجتها 0.
</div>

</section>

<section
    class="tab"
    data-pane="ai"
>

<div class="note">
    جهّز برومبتين عامّين لاستخدامهما مع NotebookLM أو ChatGPT أو Gemini: الأول لإنشاء أسئلة موثقة من المصدر مع مهارات موحّدة، والثاني لتحويل الناتج إلى Excel مطابق لبنك الأسئلة.
</div>

<div class="aiGrid">

<label class="aiField wide">
    المادة / الصف / الفئة المستهدفة (اختياري)
    <input class="aiTarget" type="text" placeholder="مثال: المهارات الرقمية - الصف الثالث المتوسط">
</label>

<label class="aiField wide">
    نطاق المحتوى المستهدف (اختياري)
    <input class="aiContentScope" type="text" placeholder="مثال: الوحدة الأولى، الدرس الأول، أو من درس كذا إلى درس كذا">
</label>

<label class="aiField wide">
    طريقة تغطية النطاق
    <select class="aiScopeMode">
        <option value="strict">النطاق المحدد فقط</option>
        <option value="prereq">النطاق المحدد مع المتطلبات السابقة المرتبطة</option>
    </select>
</label>

<label class="aiField">
    نوع الاختبار
    <select class="aiTestType">
        <option value="تشخيصي">تشخيصي</option>
        <option value="تكويني">تكويني</option>
        <option value="ختامي">ختامي</option>
        <option value="مراجعة">مراجعة</option>
    </select>
</label>

<label class="aiField">
    إجمالي الأسئلة
    <input class="aiTotal" type="number" min="1" step="1" value="40">
</label>

<label class="aiField">
    أسئلة اختيار
    <input class="aiChoice" type="number" min="0" step="1" value="32">
</label>

<label class="aiField">
    صح / خطأ
    <input class="aiTrueFalse" type="number" min="0" step="1" value="8">
</label>

<label class="aiField">
    خيارات سؤال الاختيار
    <input class="aiOptions" type="number" min="2" max="8" step="1" value="4">
</label>

<label class="aiField">
    الدرجة لكل سؤال
    <input class="aiPoints" type="number" min="0" step="0.5" value="1">
</label>

<label class="aiField wide">
    اسم ملف Excel
    <input class="aiFilename" type="text" value="اختبار-Microsoft-Forms.xlsx">
</label>

</div>

<div class="actions">
    <button class="btn primary copyGeneratePrompt">📋 نسخ برومبت إنشاء الأسئلة</button>
    <button class="btn secondary copyExcelPrompt">📊 نسخ برومبت التحويل إلى Excel</button>
    <button class="btn secondary copyExcelSpecs">📐 نسخ مواصفات Excel فقط</button>
</div>

<div class="aiHint">
    💡 يمكنك تقييد الاختبار على «الوحدة الأولى» أو «الدرس الأول» أو أي نطاق تكتبه. عند ترك «نطاق المحتوى المستهدف» فارغًا، يغطي البرومبت كامل المصدر. ويُحفظ اسم المهارة كعنوان فرعي للسؤال لتسهيل توافقه مستقبلًا مع «محلل نتائج فورمز الذكي».
</div>

</section>

<section
    class="tab"
    data-pane="legacySkills"
>

<div class="note">
    🏷️ <b>تصنيف مهارات الأسئلة القديمة:</b> يفحص الأسئلة الموجودة حاليًا في النموذج، يستخرج نص السؤال والخيارات والإجابة الصحيحة عندما يمكن اكتشافها، ثم ينشئ برومبت جاهزًا لـ NotebookLM / ChatGPT / Gemini. بعد إعادة النتيجة بصيغة <b>Q001 | اسم المهارة</b> يمكنك مراجعتها وكتابتها جماعيًا في Subtitle لكل سؤال.
</div>

<div class="legacyOptions">
    <label>
        <input class="legacyIgnoreMetadata" type="checkbox" checked>
        تجاهل أسئلة بيانات الطالب ذات 0 درجة
    </label>
    <label>
        <input class="legacyReplaceExisting" type="checkbox">
        استبدال المهارات الموجودة مسبقًا
    </label>
    <span>أسئلة رفع الملفات تُتجاهل دائمًا تلقائيًا.</span>
</div>

<div class="actions">
    <button class="btn primary legacyScan">🔎 فحص أسئلة النموذج</button>
    <button class="btn secondary legacyCopyPrompt">📋 نسخ برومبت التصنيف</button>
    <button class="btn secondary legacyBackup">🛡️ نسخ احتياطية للمهارات</button>
    <button class="btn danger legacyStop" disabled>إيقاف</button>
</div>

<div class="legacySkillStats stats"></div>

<textarea class="legacyPromptResult" placeholder="ألصق هنا نتيجة NotebookLM أو ChatGPT مثل:
Q001 | مفاهيم الأمن السيبراني
Q002 | استخدام أدوات تحرير الفيديو
Q003 | مراحل إنتاج الفيديو"></textarea>

<div class="actions">
    <button class="btn primary legacyParse">⬇️ استيراد المهارات من النص</button>
    <button class="btn secondary legacySelectAll">تحديد الكل</button>
    <button class="btn secondary legacySelectNone">إلغاء التحديد</button>
</div>

<div class="legacyManualRow">
    <input class="legacyManualSkill" type="text" placeholder="أو اكتب مهارة واحدة لتعيينها للأسئلة المحددة يدويًا">
    <button class="btn secondary legacyAssignSelected">تعيين للمحدد</button>
</div>

<div class="legacySkillList"></div>

<div class="actions">
    <button class="btn primary legacyApply">🏷️ تطبيق المهارات على Forms</button>
</div>

<div class="studentHint">
    💡 ترقيم Q001 وQ002 مؤقت داخل أداة التصنيف فقط ولا يُضاف إلى نص السؤال ولا يظهر للطلاب. إذا كان السؤال يحتوي على Subtitle مسبقًا فلن يتم استبداله إلا عند تفعيل خيار «استبدال المهارات الموجودة مسبقًا».
</div>

</section>

<section
    class="tab"
    data-pane="import"
>

<div class="note">
    يدعم XLSX / XLS / CSV / TXT.
    في Excel يكون الصف الأول عناوين الأعمدة.
</div>

<div class="importBox">

<input
    class="fileInput"
    type="file"
    accept=".xlsx,.xls,.csv,.txt"
>

<div
    style="
        font-size:15px;
        font-weight:700;
        margin-bottom:5px
    "
>
    استيراد ملف أسئلة
</div>

<div class="small">
    Excel / CSV / TXT
</div>

<div
    class="actions"
    style="justify-content:center"
>

<button class="btn primary chooseFile">
    اختيار ملف
</button>

<button class="btn secondary template">
    تحميل قالب Excel
</button>

<button class="btn secondary exportCurrent">
    تصدير الأسئلة الحالية
</button>

</div>

</div>

<div
    class="note"
    style="margin-top:10px"
>

الأعمدة:

<b>
    السؤال، المهارة، النوع، خيار أ، خيار ب،
    خيار ج، خيار د، الصحيح، الدرجة، مطلوب
</b>.

</div>

</section>

<section
    class="tab"
    data-pane="preview"
>

<div class="stats"></div>

<div class="editorTools">

<button class="iconBtn selectAll">
    تحديد الكل
</button>

<button class="iconBtn selectNone">
    إلغاء التحديد
</button>

<button class="iconBtn addQ">
    إضافة سؤال
</button>

<button class="iconBtn deleteSelected">
    حذف المحدد
</button>

</div>

<div class="errors"></div>

<div
    class="preview"
    hidden
></div>

</section>

<section
    class="tab"
    data-pane="log"
>

<div class="actions">

<button class="btn secondary copyErrors">
    نسخ تقرير الأخطاء
</button>

<button class="btn secondary clearLog">
    مسح السجل
</button>

</div>

<div class="logWrap">
    <div class="log"></div>
</div>

</section>

<div class="status">
    جاهز — ألصق الأسئلة أو استورد ملفًا،
    ثم راجع المعاينة قبل الإدخال.
</div>

<div class="progress">
    <span></span>
</div>

</div>

<footer class="rightsFooter">

<div>

<strong>
    تصميم وتطوير:
    ${DEVELOPER.name}
    (${DEVELOPER.handle})
</strong>

<br>

${DEVELOPER.copyright}

</div>

<div class="rightsLinks">

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
    X @${DEVELOPER.handle}
</a>

<a
    href="${DEVELOPER.snapchat}"
    target="_blank"
    rel="noopener noreferrer"
>
    Snapchat
</a>

</div>

</footer>

</section>

<div
    class="aboutOverlay"
    hidden
>

<div
    class="aboutCard"
    role="dialog"
    aria-modal="true"
    aria-label="عن السكربت"
>

<div class="aboutTop">

<h3>
    Microsoft Forms — بنك الأسئلة
</h3>

<div>
    الإصدار ${VERSION}
</div>

</div>

<div class="aboutBody">

<div>
    أداة لإعداد ومعاينة واستيراد وإدخال الأسئلة جماعيًا إلى Microsoft Forms،
    مع دعم المهارات كعناوين فرعية، وتصنيف مهارات الأسئلة القديمة جماعيًا، وحقول بيانات الطالب الاختيارية بلا درجات، ومساعد برومبتات لإنشاء الأسئلة وتحويلها إلى Excel.
</div>

<div class="aboutIdentity">

<strong>
    تصميم وتطوير:
    ${DEVELOPER.name}
</strong>

<br>

المعرّف:
<strong>
    ${DEVELOPER.handle}
</strong>

<br>

${DEVELOPER.copyright}

</div>

<div class="aboutSocial">

<a
    href="${DEVELOPER.greasyFork}"
    target="_blank"
    rel="noopener noreferrer"
>
    حساب GreasyFork
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
    style="
        margin-top:12px;
        color:#667
    "
>
    يمنع حذف أو تغيير بيانات المصمم وحقوقه
    عند إعادة نشر السكربت.
</div>

</div>

<div class="aboutBottom">

<button
    class="aboutClose"
    type="button"
>
    إغلاق
</button>

</div>

</div>

</div>
`;

    const $ =
        s =>
            root.querySelector(s);

    const panel =
        $('.panel');

    const source =
        $('.source');

    const status =
        $('.status');

    const preview =
        $('.preview');

    const errors =
        $('.errors');

    const progressBar =
        $('.progress span');

    const analyzeBtn =
        $('.analyze');

    const runBtn =
        $('.run');

    const retryBtn =
        $('.retry');

    const resumeBtn =
        $('.resume');

    const stopBtn =
        $('.stop');

    const clearBtn =
        $('.clear');

    function newStudentField(
        preset = 'custom'
    ) {
        const base = {
            id:
                `sf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            enabled: true,
            title: '',
            kind: 'dropdown',
            required: true,
            options: []
        };

        if (preset === 'name') {
            return {
                ...base,
                title: 'قم بكتابة اسمك كاملًا',
                kind: 'text'
            };
        }

        if (preset === 'class') {
            return {
                ...base,
                title: 'قم باختيار فصلك / شعبتك',
                kind: 'dropdown'
            };
        }

        if (preset === 'grade') {
            return {
                ...base,
                title: 'قم باختيار صفك',
                kind: 'dropdown'
            };
        }

        if (preset === 'stage') {
            return {
                ...base,
                title: 'قم باختيار المرحلة',
                kind: 'dropdown',
                options: [
                    'ابتدائي',
                    'متوسط',
                    'ثانوي'
                ]
            };
        }

        return base;
    }

    function renderStudentFields() {
        const box =
            $('.studentFields');

        if (!box) {
            return;
        }

        const enabledInput =
            $('.studentDataEnabled');

        const autoInput =
            $('.studentAutoBefore');

        const pinInput =
            $('.studentPinToTop');

        if (enabledInput) {
            enabledInput.checked =
                !!state.studentDataEnabled;
        }

        if (autoInput) {
            autoInput.checked =
                !!state.studentAutoBefore;
        }

        if (pinInput) {
            pinInput.checked =
                !!state.studentPinToTop;
        }

        box.innerHTML =
            state.studentFields.length
                ? state.studentFields
                    .map(
                        (
                            raw,
                            index
                        ) => {
                            const field =
                                normalizeStudentField(
                                    raw
                                );

                            const needOptions =
                                field.kind !== 'text';

                            return `
<div class="studentFieldCard" data-student-index="${index}">
    <div class="studentFieldTop">
        <label title="تفعيل الحقل">
            <input class="studentFieldEnabled" type="checkbox" data-i="${index}" ${field.enabled ? 'checked' : ''}>
        </label>

        <input
            class="studentFieldTitle"
            data-i="${index}"
            value="${html(field.title)}"
            placeholder="عنوان الحقل، مثال: قم باختيار فصلك"
        >

        <select class="studentFieldKind" data-i="${index}">
            <option value="text" ${field.kind === 'text' ? 'selected' : ''}>نصي</option>
            <option value="choice" ${field.kind === 'choice' ? 'selected' : ''}>اختيار واحد</option>
            <option value="dropdown" ${field.kind === 'dropdown' ? 'selected' : ''}>قائمة منسدلة</option>
            <option value="multiple" ${field.kind === 'multiple' ? 'selected' : ''}>اختيارات متعددة ✓</option>
        </select>

        <label class="small" style="white-space:nowrap">
            <input class="studentFieldRequired" type="checkbox" data-i="${index}" ${field.required ? 'checked' : ''}>
            مطلوب
        </label>
    </div>

    ${needOptions ? `
    <textarea
        class="studentFieldOptions"
        data-i="${index}"
        placeholder="كل خيار في سطر مستقل"
    >${html(field.options.join('\n'))}</textarea>` : ''}

    <div class="studentFieldMeta">
        <span>الدرجة: <b>0</b> دائمًا · لا توجد إجابة صحيحة</span>
        <div class="studentFieldActions">
            <button type="button" class="studentFieldUp" data-i="${index}" ${index === 0 ? 'disabled' : ''}>↑</button>
            <button type="button" class="studentFieldDown" data-i="${index}" ${index === state.studentFields.length - 1 ? 'disabled' : ''}>↓</button>
            <button type="button" class="studentFieldDelete" data-i="${index}">حذف</button>
        </div>
    </div>
</div>`;
                        }
                    )
                    .join('')
                : '<div class="note">لا توجد حقول تعريفية. استخدم أحد الأزرار أعلاه لإضافة حقل.</div>';

        const insertButton =
            $('.insertStudentData');

        if (insertButton) {
            insertButton.disabled =
                state.running ||
                !state.studentDataEnabled ||
                !state.studentFields.some(
                    f =>
                        normalizeStudentField(f).enabled
                );
        }

        box.querySelectorAll(
            '.studentFieldEnabled'
        ).forEach(
            el => {
                el.onchange =
                    () => {
                        const i =
                            Number(el.dataset.i);
                        state.studentFields[i].enabled =
                            el.checked;
                        saveWorkspace();
                        renderStudentFields();
                    };
            }
        );

        box.querySelectorAll(
            '.studentFieldTitle'
        ).forEach(
            el => {
                el.oninput =
                    () => {
                        const i =
                            Number(el.dataset.i);
                        state.studentFields[i].title =
                            el.value;
                        saveWorkspace();
                    };
            }
        );

        box.querySelectorAll(
            '.studentFieldKind'
        ).forEach(
            el => {
                el.onchange =
                    () => {
                        const i =
                            Number(el.dataset.i);
                        state.studentFields[i].kind =
                            el.value;
                        if (
                            el.value === 'text'
                        ) {
                            state.studentFields[i].options =
                                [];
                        }
                        saveWorkspace();
                        renderStudentFields();
                    };
            }
        );

        box.querySelectorAll(
            '.studentFieldRequired'
        ).forEach(
            el => {
                el.onchange =
                    () => {
                        const i =
                            Number(el.dataset.i);
                        state.studentFields[i].required =
                            el.checked;
                        saveWorkspace();
                    };
            }
        );

        box.querySelectorAll(
            '.studentFieldOptions'
        ).forEach(
            el => {
                el.oninput =
                    () => {
                        const i =
                            Number(el.dataset.i);
                        state.studentFields[i].options =
                            el.value
                                .split(/\r?\n/)
                                .map(clean)
                                .filter(Boolean);
                        saveWorkspace();
                    };
            }
        );

        box.querySelectorAll(
            '.studentFieldUp'
        ).forEach(
            el => {
                el.onclick =
                    () => {
                        const i =
                            Number(el.dataset.i);
                        if (i <= 0) return;
                        [
                            state.studentFields[i - 1],
                            state.studentFields[i]
                        ] = [
                            state.studentFields[i],
                            state.studentFields[i - 1]
                        ];
                        saveWorkspace();
                        renderStudentFields();
                    };
            }
        );

        box.querySelectorAll(
            '.studentFieldDown'
        ).forEach(
            el => {
                el.onclick =
                    () => {
                        const i =
                            Number(el.dataset.i);
                        if (
                            i < 0 ||
                            i >= state.studentFields.length - 1
                        ) return;
                        [
                            state.studentFields[i + 1],
                            state.studentFields[i]
                        ] = [
                            state.studentFields[i],
                            state.studentFields[i + 1]
                        ];
                        saveWorkspace();
                        renderStudentFields();
                    };
            }
        );

        box.querySelectorAll(
            '.studentFieldDelete'
        ).forEach(
            el => {
                el.onclick =
                    () => {
                        const i =
                            Number(el.dataset.i);
                        state.studentFields.splice(
                            i,
                            1
                        );
                        saveWorkspace();
                        renderStudentFields();
                    };
            }
        );
    }

    function setStatus(s) {
        status.textContent =
            s;
    }

    function setProgress(
        done,
        total
    ) {
        progressBar.style.width =
            total
                ? `${
                    Math.round(
                        done /
                        total *
                        100
                    )
                }%`
                : '0%';
    }

    function aiNumber(selector, fallback) {
        const n = Number(
            westernDigits(
                $(selector)?.value ?? fallback
            )
        );

        return Number.isFinite(n)
            ? n
            : fallback;
    }

    function validateAiDistribution() {
        const total =
            Math.max(
                1,
                Math.round(
                    aiNumber(
                        '.aiTotal',
                        40
                    )
                )
            );

        const choice =
            Math.max(
                0,
                Math.round(
                    aiNumber(
                        '.aiChoice',
                        32
                    )
                )
            );

        const tf =
            Math.max(
                0,
                Math.round(
                    aiNumber(
                        '.aiTrueFalse',
                        8
                    )
                )
            );

        if (
            choice + tf !==
            total
        ) {
            setStatus(
                `⚠️ توزيع الأسئلة غير متطابق: اختيار ${choice} + صح/خطأ ${tf} = ${choice + tf}، بينما الإجمالي ${total}.`
            );

            switchTab(
                'ai'
            );

            return false;
        }

        return true;
    }

    function buildQuestionGenerationPrompt() {
        const total = Math.max(1, Math.round(aiNumber('.aiTotal', 40)));
        const choice = Math.max(0, Math.round(aiNumber('.aiChoice', 32)));
        const tf = Math.max(0, Math.round(aiNumber('.aiTrueFalse', 8)));
        const options = Math.max(2, Math.round(aiNumber('.aiOptions', 4)));
        const points = Math.max(0, aiNumber('.aiPoints', 1));
        const testType = clean($('.aiTestType')?.value || 'تشخيصي');
        const target = clean($('.aiTarget')?.value || '');
        const contentScope = clean($('.aiContentScope')?.value || '');
        const scopeMode = clean($('.aiScopeMode')?.value || 'strict');

        const scopeHeader = contentScope
            ? `\nنطاق المحتوى المستهدف: ${contentScope}.`
            : '\nنطاق المحتوى المستهدف: كامل المصدر المرفق.';

        const scopeRule = !contentScope
            ? 'غطِّ كامل المصدر المرفق، ووزع الأسئلة على جميع وحداته ودروسه الرئيسة بصورة متوازنة قدر الإمكان، مع مراعاة حجم كل جزء وأهميته.'
            : scopeMode === 'prereq'
                ? `ركز الأسئلة أساسًا على «${contentScope}». يسمح بالرجوع إلى المتطلبات أو المفاهيم السابقة المرتبطة فقط عندما تكون ضرورية مباشرة لفهم النطاق أو قياسه، ولا تنشئ أسئلة مستقلة عن محتوى خارج النطاق.`
                : `التزم حصريًا بـ «${contentScope}» من المصدر المرفق. لا تنشئ أي سؤال من وحدة أو درس أو جزء خارج هذا النطاق، حتى لو كان موجودًا في المصدر.`;

        const distributionRule = contentScope
            ? 'وزع الأسئلة على الدروس والمفاهيم والمهارات الموجودة داخل النطاق المحدد بما يتناسب مع حجمها وأهميتها، ولا تهمل أي جزء رئيس داخل النطاق.'
            : 'وزع الأسئلة على جميع أجزاء المصدر بشكل متوازن قدر الإمكان، مع إعطاء الأجزاء الأكبر أو الأهم عددًا مناسبًا من الأسئلة، ولا تهمل أي جزء رئيس.';

        return `اعتمد حصريًا على المصدر أو المصادر المرفقة، وأنشئ اختبارًا ${testType} من ${total} سؤالًا بالضبط.${target ? `\nالفئة المستهدفة: ${target}.` : ''}${scopeHeader}

${scopeRule}

التوزيع المطلوب: ${choice} سؤال «اختيار» بإجابة صحيحة واحدة فقط، و${tf} سؤال «صح/خطأ». يجب أن يساوي مجموع النوعين ${total} سؤالًا.

قبل إنشاء الأسئلة:
1) حلل المحتوى الواقع ضمن النطاق المطلوب وحدد الوحدات والدروس والمفاهيم والمهارات الرئيسة القابلة للقياس.
2) أنشئ داخليًا قائمة محدودة وموحدة من أسماء المهارات. استخدم اسم المهارة نفسه حرفيًا لكل الأسئلة التي تقيس المهارة نفسها، ولا تنشئ أسماء متقاربة لنفس المفهوم.
3) ${distributionRule}

ركز على المفاهيم الأساسية والمصطلحات والوظائف والاستخدامات والفروق والعلاقات والنتائج المتوقعة. تجنب المهام التي تتطلب تنفيذًا عمليًا فعليًا، لكن يمكن السؤال عن الجانب العملي بصورة نظرية مثل وظيفة أداة، سبب استخدامها، ترتيب الخطوات، أو النتيجة المتوقعة.

اجعل الاختبار ${testType}ًا يقيس الفهم والتمييز بين المفاهيم، وليس الحفظ فقط.

شروط أسئلة الاختيار:
- النوع يكتب «اختيار» فقط، ولا تستخدم كلمة «متعدد».
- لكل سؤال ${options} خيارات بالضبط.
- إجابة صحيحة واحدة فقط.
- المشتتات منطقية وقريبة من الموضوع.
- لا تستخدم «جميع ما سبق» أو «لا شيء مما سبق».
- وزع الإجابات الصحيحة بين الحروف بشكل متوازن وعشوائي قدر الإمكان.

شروط صح/خطأ:
- النوع = «صح/خطأ».
- خيار أ = صح.
- خيار ب = خطأ.
- خيار ج ود فارغان.
- إذا كانت العبارة صحيحة فالصحيح = أ، وإذا كانت خاطئة فالصحيح = ب.

شروط عامة:
- لا تكرر أي سؤال، ولا تكرر الفكرة نفسها بصياغة مختلفة.
- استخدم فقط معلومات يمكن إثباتها من المصدر وضمن النطاق المطلوب.
- اجعل اللغة واضحة ومناسبة للفئة المستهدفة.
- الدرجة لكل سؤال = ${points}.
- مطلوب = نعم.
- اكتب «المهارة» لكل سؤال باسم قصير وواضح وموحد، ولا تضع رقم الوحدة أو السؤال داخل اسم المهارة إلا إذا كان جزءًا ضروريًا من الاسم.

اكتب كل سؤال بهذا البناء ليسهل مراجعته وتحويله لاحقًا إلى Excel:
س: نص السؤال
المهارة: اسم المهارة الموحد
النوع: اختيار أو صح/خطأ
أ: الخيار الأول
ب: الخيار الثاني
ج: الخيار الثالث أو فارغ في صح/خطأ
د: الخيار الرابع أو فارغ في صح/خطأ
الصحيح: حرف الإجابة فقط
الدرجة: ${points}
مطلوب: نعم

أنشئ الأسئلة كلها أولًا، ثم راجعها قبل الإخراج النهائي للتأكد من: الالتزام بنطاق المحتوى، العدد، التوزيع، عدم التكرار، صحة الإجابات، جودة المشتتات، وتوحيد أسماء المهارات.`;
    }

    function buildExcelConversionPrompt() {
        const total = Math.max(1, Math.round(aiNumber('.aiTotal', 40)));
        const choice = Math.max(0, Math.round(aiNumber('.aiChoice', 32)));
        const tf = Math.max(0, Math.round(aiNumber('.aiTrueFalse', 8)));
        const options = Math.max(2, Math.round(aiNumber('.aiOptions', 4)));
        const points = Math.max(0, aiNumber('.aiPoints', 1));
        const filename = clean($('.aiFilename')?.value || 'اختبار-Microsoft-Forms.xlsx');

        return `حوّل الأسئلة السابقة إلى ملف Excel بصيغة XLSX جاهز للاستيراد في «Microsoft Forms - بنك الأسئلة والإدخال الجماعي».

يجب أن يكون الملف في ورقة واحدة فقط، والصف الأول يحتوي حرفيًا وبنفس الترتيب على الأعمدة التالية فقط:

السؤال | المهارة | النوع | خيار أ | خيار ب | خيار ج | خيار د | الصحيح | الدرجة | مطلوب

قواعد التحويل:
- انقل نص السؤال دون ترقيم إضافي.
- انقل اسم «المهارة» كما ورد في الأسئلة حرفيًا، ولا تعِد صياغته ولا تنشئ مهارات جديدة أثناء التحويل.
- لأسئلة الاختيار: النوع = اختيار، وعدد الخيارات = ${options}، والصحيح = حرف الإجابة فقط.
- لأسئلة صح/خطأ: النوع = صح/خطأ، خيار أ = صح، خيار ب = خطأ، خيار ج = فارغ، خيار د = فارغ، والصحيح = أ للصحيحة أو ب للخاطئة.
- الدرجة = ${points} لكل سؤال.
- مطلوب = نعم لكل سؤال.
- لا تضف أعمدة أخرى، ولا عنوانًا أعلى الجدول، ولا أرقامًا للأسئلة، ولا صفوفًا فارغة.

يجب أن يحتوي الملف على ${total + 1} صفًا إجمالًا: صف العناوين + ${total} سؤالًا.

راجع قبل التصدير:
- ${choice} سؤال اختيار.
- ${tf} سؤال صح/خطأ.
- المجموع ${total} سؤالًا.
- عدم وجود تكرار.
- كل سؤال اختيار له ${options} خيارات وإجابة صحيحة واحدة.
- كل سؤال لديه مهارة غير فارغة واسمها مطابق لما ورد في الأسئلة.

اسم الملف: ${filename}`;
    }

    function buildExcelSpecsText() {
        return `مواصفات ملف Excel لبنك أسئلة Microsoft Forms:\n\nالسؤال | المهارة | النوع | خيار أ | خيار ب | خيار ج | خيار د | الصحيح | الدرجة | مطلوب\n\n- «المهارة» تُكتب تلقائيًا كعنوان فرعي للسؤال في Microsoft Forms.\n- النوع المدعوم: اختيار / متعدد / صح/خطأ / نصي.\n- الصحيح يمكن أن يكون حرف الخيار أو رقمه أو نصه.\n- في صح/خطأ: أ = صح، ب = خطأ، ج ود فارغان.\n- مطلوب: نعم أو لا.\n- لا تضف صفوفًا أو عناوين أعلى صف الأعمدة.`;
    }

    async function copyText(text, successMessage) {
        try {
            await navigator.clipboard.writeText(text);
            setStatus(successMessage);
        }
        catch (_) {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            try {
                document.execCommand('copy');
                setStatus(successMessage);
            }
            catch (err) {
                console.log(text);
                setStatus('تعذر النسخ التلقائي؛ تم طباعة النص في Console.');
            }
            ta.remove();
        }
    }

    const LAUNCHER_ID = 'mfbi-top-launcher';
    const LAUNCHER_STYLE_ID = 'mfbi-top-launcher-style';

    function launcherMount() {
        const title =
            document.querySelector(
                '[data-automation-id="formTitleContainer"]'
            );

        return title?.parentElement || null;
    }

    function ensureLauncherStyle() {
        if (
            document.getElementById(
                LAUNCHER_STYLE_ID
            )
        ) {
            return;
        }

        const style =
            document.createElement(
                'style'
            );

        style.id =
            LAUNCHER_STYLE_ID;

        style.textContent = `
#${LAUNCHER_ID}{
    appearance:none!important;
    border:0!important;
    border-radius:9px!important;
    padding:8px 12px!important;
    margin-inline-start:10px!important;
    background:#087f83!important;
    color:#fff!important;
    font:700 12px "Segoe UI",Tahoma,Arial,sans-serif!important;
    cursor:pointer!important;
    box-shadow:0 2px 8px #0002!important;
    white-space:nowrap!important;
    align-self:center!important;
    flex:0 0 auto!important;
}
#${LAUNCHER_ID}:hover{
    filter:brightness(1.06)!important;
    transform:translateY(-1px)!important;
}
`;

        document.head.appendChild(
            style
        );
    }

    function ensureTopLauncher() {
        ensureLauncherStyle();

        if (
            document.getElementById(
                LAUNCHER_ID
            )
        ) {
            return;
        }

        const mount =
            launcherMount();

        if (!mount) {
            return;
        }

        const btn =
            document.createElement(
                'button'
            );

        btn.id =
            LAUNCHER_ID;

        btn.type =
            'button';

        btn.textContent =
            '📚 بنك الأسئلة';

        btn.title =
            `فتح بنك الأسئلة والإدخال الجماعي v${VERSION}`;

        btn.addEventListener(
            'click',
            () =>
                panel.classList.toggle(
                    'open'
                )
        );

        mount.appendChild(
            btn
        );
    }

    function switchTab(name) {
        state.currentTab =
            name;

        root.querySelectorAll(
            '.tabBtn'
        ).forEach(
            b =>
                b.classList.toggle(
                    'active',
                    b.dataset.tab ===
                    name
                )
        );

        root.querySelectorAll(
            '.tab'
        ).forEach(
            p =>
                p.classList.toggle(
                    'active',
                    p.dataset.pane ===
                    name
                )
        );
    }

    function renderLog() {
        const el =
            $('.log');

        if (!el) {
            return;
        }

        el.innerHTML =
            state.log
                .slice(-150)
                .map(
                    x =>
                        `<div class="${
                            x.level
                        }">[${
                            html(
                                x.time
                            )
                        }] ${
                            html(
                                x.message
                            )
                        }</div>`
                )
                .join('');

        el.scrollTop =
            el.scrollHeight;
    }

    function typeLabel(type) {
        return ({
            choice:
                'اختيار',

            multiple:
                'متعدد',

            truefalse:
                'صح/خطأ',

            text:
                'نصي'
        })[type] ||
        type ||
        '';
    }

    function updateStats() {
        const box =
            $('.stats');

        if (!box) {
            return;
        }

        const selected =
            state.questions
                .filter(
                    (
                        _,
                        i
                    ) =>
                        state.selected
                            .has(i)
                );

        const points =
            selected.reduce(
                (
                    s,
                    q
                ) =>
                    s +
                    Number(
                        q.points ||
                        0
                    ),
                0
            );

        const counts =
            selected.reduce(
                (
                    a,
                    q
                ) => {

                    a[
                        q.type
                    ] =
                        (
                            a[
                                q.type
                            ] ||
                            0
                        ) + 1;

                    return a;
                },
                {}
            );

        box.innerHTML = `

<div class="stat">

<b>
    ${selected.length}
</b>

<span>
    محدد
</span>

</div>

<div class="stat">

<b>
    ${points}
</b>

<span>
    مجموع الدرجات
</span>

</div>

<div class="stat">

<b>
    ${counts.choice || 0}
</b>

<span>
    اختيار
</span>

</div>

<div class="stat">

<b>
    ${counts.multiple || 0}
</b>

<span>
    متعدد
</span>

</div>

<div class="stat">

<b>
    ${counts.truefalse || 0}
</b>

<span>
    صح/خطأ
</span>

</div>

<div class="stat">

<b>
    ${counts.text || 0}
</b>

<span>
    نصي
</span>

</div>
`;
    }

    function render() {
        renderStudentFields();
        renderLegacySkillCenter();

        const allErrors =
            [];

        const allWarnings =
            [];

        state.questions
            .forEach(
                (
                    q,
                    i
                ) => {

                    (
                        q.errors ||
                        []
                    ).forEach(
                        e =>
                            allErrors.push(
                                `سؤال ${
                                    i + 1
                                }: ${e}`
                            )
                    );

                    (
                        q.warnings ||
                        []
                    ).forEach(
                        w =>
                            allWarnings.push(
                                `سؤال ${
                                    i + 1
                                }: ${w}`
                            )
                    );
                }
            );

        errors.innerHTML =
            [
                ...allErrors.map(
                    e =>
                        `• ${
                            html(e)
                        }`
                ),

                ...allWarnings.map(
                    w =>
                        `<span class="warnings">• ${
                            html(w)
                        }</span>`
                )
            ].join(
                '<br>'
            );

        if (
            !state.questions.length
        ) {
            preview.hidden =
                true;

            runBtn.disabled =
                true;

            retryBtn.disabled =
                true;

            updateStats();

            saveWorkspace();

            return;
        }

        preview.hidden =
            false;

        preview.innerHTML = `
<table>

<thead>

<tr>
<th>✓</th>
<th>#</th>
<th>النوع</th>
<th style="min-width:190px">
    السؤال
</th>
<th style="min-width:150px">المهارة</th>
<th>الصحيح</th>
<th>الدرجة</th>
<th>مطلوب</th>
<th>الحالة</th>
<th>إدارة</th>
</tr>

</thead>

<tbody>

${
    state.questions
        .map(
            (
                q,
                i
            ) => {

                const r =
                    state.results[
                        i
                    ] ||
                    {
                        status:
                            'pending'
                    };

                const st =
                    ({
                        pending:
                            'بانتظار',

                        running:
                            'جارٍ',

                        done:
                            'تم',

                        error:
                            'خطأ',

                        skipped:
                            'تخطي'
                    })[
                        r.status
                    ] ||
                    r.status;

                const correct =
                    q.type ===
                    'text'
                        ? (
                            q.textAnswer ||
                            q.answerRaw ||
                            ''
                        )
                        : derivedCorrect(
                            q
                        );

                return `

<tr class="${
    r.status ||
    ''
} ${
    state.selected.has(i)
        ? ''
        : 'unselected'
}">

<td>

<input
    type="checkbox"
    class="rowSelect"
    data-i="${i}"
    ${
        state.selected.has(i)
            ? 'checked'
            : ''
    }
>

</td>

<td>
    ${i + 1}
</td>

<td>

<select
    class="editSelect typeEdit"
    data-i="${i}"
>

<option
    value="choice"
    ${
        q.type ===
        'choice'
            ? 'selected'
            : ''
    }
>
    اختيار
</option>

<option
    value="multiple"
    ${
        q.type ===
        'multiple'
            ? 'selected'
            : ''
    }
>
    متعدد
</option>

<option
    value="truefalse"
    ${
        q.type ===
        'truefalse'
            ? 'selected'
            : ''
    }
>
    صح/خطأ
</option>

<option
    value="text"
    ${
        q.type ===
        'text'
            ? 'selected'
            : ''
    }
>
    نصي
</option>

</select>

</td>

<td>

<textarea
    class="editInput titleEdit"
    data-i="${i}"
    rows="2"
>${html(q.title)}</textarea>

</td>

<td>

<input
    class="editInput skillEdit"
    data-i="${i}"
    value="${html(q.skill || '')}"
    placeholder="غير مصنف"
>

</td>

<td>

<input
    class="editInput correctEdit"
    data-i="${i}"
    value="${html(correct)}"
>

</td>

<td>

<input
    class="editInput pointsEdit"
    data-i="${i}"
    type="number"
    min="0"
    step="0.5"
    value="${html(q.points)}"
>

</td>

<td>

<input
    class="requiredEdit"
    data-i="${i}"
    type="checkbox"
    ${
        q.required
            ? 'checked'
            : ''
    }
>

</td>

<td>
    ${html(st)}
</td>

<td>

<button
    class="iconBtn optionsEdit"
    data-i="${i}"
    ${
        q.type ===
        'text'
            ? 'disabled'
            : ''
    }
>
    خيارات
</button>

<button
    class="iconBtn up"
    data-i="${i}"
    ${
        i === 0
            ? 'disabled'
            : ''
    }
>
    ↑
</button>

<button
    class="iconBtn down"
    data-i="${i}"
    ${
        i ===
        state.questions.length -
        1
            ? 'disabled'
            : ''
    }
>
    ↓
</button>

<button
    class="iconBtn del"
    data-i="${i}"
>
    حذف
</button>

</td>

</tr>
`;
            }
        )
        .join('')
}

</tbody>

</table>
`;

        runBtn.disabled =
            state.running ||
            !state.selected.size ||
            [
                ...state.selected
            ].some(
                i =>
                    !state.questions[
                        i
                    ]?.valid
            );

        retryBtn.disabled =
            state.running ||
            !state.results
                .some(
                    r =>
                        r?.status ===
                        'error'
                );

        resumeBtn.disabled =
            state.running ||
            !state.results
                .some(
                    r =>
                        ![
                            'done',
                            'skipped'
                        ].includes(
                            r?.status
                        )
                );

        updateStats();

        bindPreviewEvents();

        saveWorkspace();
    }

    function bindPreviewEvents() {

        root.querySelectorAll(
            '.rowSelect'
        ).forEach(
            el => {

                el.onchange =
                    () => {

                        const i =
                            Number(
                                el.dataset.i
                            );

                        if (
                            el.checked
                        ) {
                            state.selected
                                .add(i);
                        }
                        else {
                            state.selected
                                .delete(i);
                        }

                        render();
                    };
            }
        );

        root.querySelectorAll(
            '.titleEdit'
        ).forEach(
            el => {

                el.onchange =
                    () => {

                        const i =
                            Number(
                                el.dataset.i
                            );

                        state.questions[
                            i
                        ].title =
                            clean(
                                el.value
                            );

                        state.questions[
                            i
                        ] =
                            reparseQuestion(
                                state.questions[
                                    i
                                ]
                            );

                        render();
                    };
            }
        );

        root.querySelectorAll(
            '.skillEdit'
        ).forEach(
            el => {

                el.onchange =
                    () => {

                        const i =
                            Number(
                                el.dataset.i
                            );

                        state.questions[
                            i
                        ].skill =
                            clean(
                                el.value
                            );

                        render();
                    };
            }
        );

        root.querySelectorAll(
            '.typeEdit'
        ).forEach(
            el => {

                el.onchange =
                    () => {

                        const i =
                            Number(
                                el.dataset.i
                            );

                        state.questions[
                            i
                        ].type =
                            el.value;

                        state.questions[
                            i
                        ].typeRaw =
                            el.value;

                        if (
                            el.value ===
                            'text'
                        ) {
                            state.questions[
                                i
                            ].textAnswer =
                                state.questions[
                                    i
                                ].textAnswer ||
                                state.questions[
                                    i
                                ].answerRaw ||
                                '';
                        }

                        state.questions[
                            i
                        ] =
                            reparseQuestion(
                                state.questions[
                                    i
                                ]
                            );

                        render();
                    };
            }
        );

        root.querySelectorAll(
            '.correctEdit'
        ).forEach(
            el => {

                el.onchange =
                    () => {

                        const i =
                            Number(
                                el.dataset.i
                            );

                        if (
                            state.questions[
                                i
                            ].type ===
                            'text'
                        ) {
                            state.questions[
                                i
                            ].textAnswer =
                                clean(
                                    el.value
                                );

                            state.questions[
                                i
                            ].answerRaw =
                                clean(
                                    el.value
                                );
                        }
                        else {
                            state.questions[
                                i
                            ].answerRaw =
                                clean(
                                    el.value
                                );

                            state.questions[
                                i
                            ].correctIndexes =
                                [];
                        }

                        state.questions[
                            i
                        ] =
                            reparseQuestion(
                                state.questions[
                                    i
                                ]
                            );

                        render();
                    };
            }
        );

        root.querySelectorAll(
            '.pointsEdit'
        ).forEach(
            el => {

                el.onchange =
                    () => {

                        const i =
                            Number(
                                el.dataset.i
                            );

                        state.questions[
                            i
                        ].points =
                            parsePoints(
                                el.value,
                                1
                            );

                        render();
                    };
            }
        );

        root.querySelectorAll(
            '.requiredEdit'
        ).forEach(
            el => {

                el.onchange =
                    () => {

                        const i =
                            Number(
                                el.dataset.i
                            );

                        state.questions[
                            i
                        ].required =
                            el.checked;

                        render();
                    };
            }
        );

        root.querySelectorAll(
            '.optionsEdit'
        ).forEach(
            el => {

                el.onclick =
                    () => {

                        const i =
                            Number(
                                el.dataset.i
                            );

                        const q =
                            state.questions[
                                i
                            ];

                        const current =
                            (
                                q.options ||
                                []
                            )
                                .map(
                                    o =>
                                        o.text
                                )
                                .join(
                                    '\n'
                                );

                        const value =
                            prompt(
                                'اكتب كل خيار في سطر مستقل:',
                                current
                            );

                        if (
                            value ===
                            null
                        ) {
                            return;
                        }

                        const letters =
                            [
                                'أ',
                                'ب',
                                'ج',
                                'د',
                                'هـ',
                                'و',
                                'ز',
                                'ح',
                                'ط',
                                'ي',
                                'ك',
                                'ل'
                            ];

                        q.options =
                            value
                                .split(
                                    /\r?\n/
                                )
                                .map(
                                    clean
                                )
                                .filter(
                                    Boolean
                                )
                                .map(
                                    (
                                        text,
                                        oi
                                    ) => ({
                                        label:
                                            letters[
                                                oi
                                            ] ||
                                            String(
                                                oi +
                                                1
                                            ),

                                        text
                                    })
                                );

                        q.correctIndexes =
                            [];

                        q.answerRaw =
                            '';

                        q.errors =
                            [
                                'بعد تعديل الخيارات حدد الإجابة الصحيحة من عمود «الصحيح».'
                            ];

                        q.valid =
                            false;

                        render();
                    };
            }
        );

        root.querySelectorAll(
            '.up'
        ).forEach(
            el => {

                el.onclick =
                    () =>
                        moveQuestion(
                            Number(
                                el.dataset.i
                            ),
                            -1
                        );
            }
        );

        root.querySelectorAll(
            '.down'
        ).forEach(
            el => {

                el.onclick =
                    () =>
                        moveQuestion(
                            Number(
                                el.dataset.i
                            ),
                            1
                        );
            }
        );

        root.querySelectorAll(
            '.del'
        ).forEach(
            el => {

                el.onclick =
                    () =>
                        deleteQuestion(
                            Number(
                                el.dataset.i
                            )
                        );
            }
        );
    }

    function moveQuestion(
        i,
        delta
    ) {
        const j =
            i + delta;

        if (
            j < 0 ||
            j >=
            state.questions.length
        ) {
            return;
        }

        [
            state.questions[i],
            state.questions[j]
        ] =
        [
            state.questions[j],
            state.questions[i]
        ];

        [
            state.results[i],
            state.results[j]
        ] =
        [
            state.results[j],
            state.results[i]
        ];

        const next =
            new Set();

        for (
            const x
            of state.selected
        ) {
            if (
                x === i
            ) {
                next.add(
                    j
                );
            }
            else if (
                x === j
            ) {
                next.add(
                    i
                );
            }
            else {
                next.add(
                    x
                );
            }
        }

        state.selected =
            next;

        render();
    }

    function deleteQuestion(i) {
        state.questions
            .splice(
                i,
                1
            );

        state.results
            .splice(
                i,
                1
            );

        const next =
            new Set();

        for (
            const x
            of state.selected
        ) {
            if (
                x < i
            ) {
                next.add(
                    x
                );
            }
            else if (
                x > i
            ) {
                next.add(
                    x - 1
                );
            }
        }

        state.selected =
            next;

        render();
    }

    function addQuestionManually() {
        const title =
            prompt(
                'عنوان السؤال:'
            );

        if (!title) {
            return;
        }

        const skill =
            prompt(
                'المهارة / العنوان الفرعي (اختياري):',
                ''
            ) ||
            '';

        const type =
            prompt(
                'النوع: اختيار / متعدد / صح/خطأ / نصي',
                'اختيار'
            ) ||
            'اختيار';

        const defaults = {
            points:
                parsePoints(
                    $('.points')
                        .value,
                    1
                ),

            required:
                $('.required')
                    .checked
        };

        let text =
            `س: ${title}\n${skill ? `المهارة: ${skill}\n` : ''}النوع: ${type}\n`;

        if (
            normalizeType(
                type
            ) ===
            'text'
        ) {
            const answer =
                prompt(
                    'الإجابة النصية الصحيحة:',
                    ''
                ) ||
                '';

            text +=
                `الإجابة: ${answer}\n`;
        }
        else {
            const opts =
                prompt(
                    'الخيارات - كل خيار في سطر:',
                    'الخيار الأول\nالخيار الثاني'
                ) ||
                '';

            const letters =
                [
                    'أ',
                    'ب',
                    'ج',
                    'د',
                    'هـ',
                    'و'
                ];

            opts
                .split(
                    /\r?\n/
                )
                .map(
                    clean
                )
                .filter(
                    Boolean
                )
                .forEach(
                    (
                        o,
                        i
                    ) =>
                        text +=
                            `${
                                letters[i] ||
                                (
                                    i +
                                    1
                                )
                            }: ${o}\n`
                );

            const correct =
                prompt(
                    'الإجابة الصحيحة (مثال: أ أو أ، ج):',
                    'أ'
                ) ||
                '';

            text +=
                `الصحيح: ${correct}\n`;
        }

        text +=
            `الدرجة: ${
                defaults.points
            }\nمطلوب: ${
                defaults.required
                    ? 'نعم'
                    : 'لا'
            }`;

        const q =
            parseQuestions(
                text,
                defaults
            )[0];

        if (!q) {
            return;
        }

        state.questions
            .push(
                q
            );

        state.results
            .push({
                status:
                    'pending',

                error:
                    ''
            });

        state.selected
            .add(
                state.questions
                    .length -
                1
            );

        render();
    }

    function analyze() {
        const defaults = {
            points:
                parsePoints(
                    $('.points')
                        .value,
                    1
                ),

            required:
                $('.required')
                    .checked
        };

        state.questions =
            parseQuestions(
                source.value,
                defaults
            );

        state.results =
            state.questions
                .map(
                    () => ({
                        status:
                            'pending',

                        error:
                            ''
                    })
                );

        state.selected =
            new Set(
                state.questions
                    .map(
                        (
                            _,
                            i
                        ) =>
                            i
                    )
            );

        state.nextIndex =
            0;

        state.log =
            [];

        const valid =
            state.questions
                .filter(
                    q =>
                        q.valid
                )
                .length;

        setStatus(
            state.questions.length
                ? `تم تحليل ${
                    state.questions.length
                } سؤالًا؛ الصالح ${
                    valid
                }. راجع «المعاينة والتحرير».`
                : 'لم أجد أسئلة قابلة للتحليل.'
        );

        setProgress(
            0,
            state.questions.length
        );

        render();

        switchTab(
            'preview'
        );

        return state.questions;
    }

    function setRunning(v) {
        state.running =
            v;

        source.disabled =
            v;

        analyzeBtn.disabled =
            v;

        clearBtn.disabled =
            v;

        stopBtn.disabled =
            !v;

        $('.close').disabled =
            v;

        render();
    }

    async function runIndices(
        indices
    ) {
        if (
            state.running
        ) {
            return;
        }

        const target =
            [
                ...new Set(
                    indices
                )
            ]
                .filter(
                    i =>
                        i >= 0 &&
                        i <
                        state.questions.length
                )
                .sort(
                    (
                        a,
                        b
                    ) =>
                        a -
                        b
                );

        const autoStudentFields =
            state.studentDataEnabled &&
            state.studentAutoBefore
                ? enabledStudentFields()
                : [];

        const studentValidation =
            validateStudentFields(
                autoStudentFields
            );

        if (studentValidation.length) {
            setStatus(
                `⚠️ ${studentValidation[0]}`
            );

            switchTab(
                'student'
            );

            return;
        }

        if (
            !target.length
        ) {
            setStatus(
                'لا توجد أسئلة محددة للإدخال.'
            );

            return;
        }

        const invalid =
            target.filter(
                i =>
                    !state.questions[
                        i
                    ]?.valid
            );

        if (
            invalid.length
        ) {
            setStatus(
                `يوجد ${
                    invalid.length
                } سؤال غير صالح ضمن المحدد.`
            );

            switchTab(
                'preview'
            );

            render();

            return;
        }

        if (
            !confirm(
                `سيتم إدخال ${
                    autoStudentFields.length
                        ? `${autoStudentFields.length} حقل/حقول تعريفية بلا درجات، ثم `
                        : ''
                }${target.length} سؤالًا في الاختبار الحالي. متابعة؟`
            )
        ) {
            return;
        }

        state.cancelRequested =
            false;

        setRunning(
            true
        );

        const existing =
            existingTitleSet();

        let processed =
            0;

        try {

            if (autoStudentFields.length) {
                const studentStats =
                    await insertStudentFieldsCore(
                        autoStudentFields
                    );

                log(
                    `بيانات الطالب قبل الاختبار: تم ${studentStats.done}، تخطي ${studentStats.skipped}، أخطاء ${studentStats.failed}.`
                );
            }

            for (
                const i
                of target
            ) {
                checkCancel();

                state.nextIndex =
                    i;

                const q =
                    state.questions[
                        i
                    ];

                if (
                    $('.skipDup')
                        .checked &&
                    existing.has(
                        canonical(
                            q.title
                        )
                    )
                ) {
                    state.results[
                        i
                    ] = {
                        status:
                            'skipped',

                        error:
                            ''
                    };

                    processed++;

                    log(
                        `سؤال ${
                            i + 1
                        }: تم تخطيه لأن العنوان موجود بالفعل.`,
                        'warn'
                    );

                    setProgress(
                        processed,
                        target.length
                    );

                    render();

                    continue;
                }

                state.results[
                    i
                ] = {
                    status:
                        'running',

                    error:
                        ''
                };

                render();

                try {

                    const progress =
                        msg => {

                            setStatus(
                                `السؤال ${
                                    i + 1
                                }: ${msg}`
                            );

                            log(
                                `س${
                                    i + 1
                                }: ${msg}`
                            );
                        };

                    if (
                        q.type ===
                        'text'
                    ) {
                        await addTextQuestion(
                            q,
                            progress
                        );
                    }
                    else {
                        await addChoiceQuestion(
                            q,
                            progress
                        );
                    }

                    state.results[
                        i
                    ] = {
                        status:
                            'done',

                        error:
                            ''
                    };

                    existing.add(
                        canonical(
                            q.title
                        )
                    );

                    processed++;

                    setProgress(
                        processed,
                        target.length
                    );

                    log(
                        `سؤال ${
                            i + 1
                        }: تم بنجاح.`
                    );

                    render();

                    await sleep(
                        450
                    );
                }
                catch (err) {

                    if (
                        err.cancelled ||
                        err.message ===
                        '__CANCELLED__'
                    ) {
                        throw err;
                    }

                    state.results[
                        i
                    ] = {
                        status:
                            'error',

                        error:
                            String(
                                err.message ||
                                err
                            )
                    };

                    processed++;

                    setProgress(
                        processed,
                        target.length
                    );

                    log(
                        `سؤال ${
                            i + 1
                        }: ${
                            err.message ||
                            err
                        }`,
                        'error'
                    );

                    render();

                    if (
                        !$('.continueErr')
                            .checked
                    ) {
                        setStatus(
                            `❌ توقف عند السؤال ${
                                i + 1
                            }: ${
                                err.message ||
                                err
                            }`
                        );

                        break;
                    }
                }
            }

            const done =
                state.results
                    .filter(
                        r =>
                            r?.status ===
                            'done'
                    )
                    .length;

            const skipped =
                state.results
                    .filter(
                        r =>
                            r?.status ===
                            'skipped'
                    )
                    .length;

            const failed =
                state.results
                    .filter(
                        r =>
                            r?.status ===
                            'error'
                    )
                    .length;

            setStatus(
                `✅ انتهت العملية: تم ${
                    done
                }، تخطي ${
                    skipped
                }، أخطاء ${
                    failed
                }.`
            );
        }
        catch (err) {

            if (
                err.cancelled ||
                err.message ===
                '__CANCELLED__'
            ) {
                setStatus(
                    '⛔ تم الإيقاف. يمكنك استخدام «استئناف».'
                );

                log(
                    'تم إيقاف العملية بواسطة المستخدم.',
                    'warn'
                );
            }
            else {
                setStatus(
                    `❌ ${
                        err.message ||
                        err
                    }`
                );

                log(
                    String(
                        err.message ||
                        err
                    ),
                    'error'
                );
            }
        }
        finally {
            state.cancelRequested =
                false;

            setRunning(
                false
            );
        }
    }

    async function copyErrorReport() {
        const lines = [
            `Microsoft Forms Bulk Importer v${VERSION}`,

            `تصميم وتطوير: ${
                DEVELOPER.name
            } (${
                DEVELOPER.handle
            })`,

            `GreasyFork: ${
                DEVELOPER.greasyFork
            }`,

            `عدد الأسئلة: ${
                state.questions.length
            }`,

            ''
        ];

        state.results
            .forEach(
                (
                    r,
                    i
                ) => {

                    if (
                        r?.status ===
                        'error'
                    ) {
                        lines.push(
                            `سؤال ${
                                i + 1
                            }: ${
                                state.questions[
                                    i
                                ]?.title ||
                                ''
                            }`,

                            `الخطأ: ${
                                r.error ||
                                ''
                            }`,

                            ''
                        );
                    }
                }
            );

        lines.push(
            'آخر سجل:',

            ...state.log
                .slice(
                    -30
                )
                .map(
                    x =>
                        `[${
                            x.time
                        }] ${
                            x.message
                        }`
                )
        );

        const report =
            lines.join(
                '\n'
            );

        try {
            await navigator
                .clipboard
                .writeText(
                    report
                );

            setStatus(
                'تم نسخ تقرير الأخطاء.'
            );
        }
        catch (_) {
            console.log(
                report
            );

            setStatus(
                'تعذر النسخ؛ تم طباعة التقرير في Console.'
            );
        }
    }

    /* =========================================================
       أحداث الواجهة
       ========================================================= */

    $('.close').onclick =
        () => {

            if (
                !state.running
            ) {
                panel.classList
                    .remove(
                        'open'
                    );
            }
        };

    const aboutOverlay =
        $('.aboutOverlay');

    $('.aboutBtn').onclick =
        () => {
            aboutOverlay.hidden =
                false;
        };

    $('.aboutClose').onclick =
        () => {
            aboutOverlay.hidden =
                true;
        };

    aboutOverlay
        .addEventListener(
            'click',
            event => {

                if (
                    event.target ===
                    aboutOverlay
                ) {
                    aboutOverlay.hidden =
                        true;
                }
            }
        );

    root.querySelectorAll(
        '.tabBtn'
    ).forEach(
        b => {

            b.onclick =
                () =>
                    switchTab(
                        b.dataset.tab
                    );
        }
    );

    analyzeBtn.onclick =
        analyze;

    runBtn.onclick =
        () =>
            runIndices(
                [
                    ...state.selected
                ]
            );

    retryBtn.onclick =
        () => {

            const failed =
                state.results
                    .map(
                        (
                            r,
                            i
                        ) =>
                            r?.status ===
                            'error'
                                ? i
                                : -1
                    )
                    .filter(
                        i =>
                            i >= 0
                    );

            runIndices(
                failed
            );
        };

    resumeBtn.onclick =
        () => {

            const pending =
                [
                    ...state.selected
                ]
                    .filter(
                        i =>
                            ![
                                'done',
                                'skipped'
                            ].includes(
                                state.results[
                                    i
                                ]?.status
                            )
                    );

            runIndices(
                pending
            );
        };

    stopBtn.onclick =
        () => {

            if (
                !state.running
            ) {
                return;
            }

            state.cancelRequested =
                true;

            setStatus(
                'سيتم الإيقاف بعد الخطوة الحالية...'
            );

            stopBtn.disabled =
                true;
        };

    clearBtn.onclick =
        () => {

            if (
                state.running
            ) {
                return;
            }

            source.value =
                '';

            state.questions =
                [];

            state.results =
                [];

            state.selected =
                new Set();

            state.nextIndex =
                0;

            state.log =
                [];

            try {
                localStorage
                    .removeItem(
                        STORAGE_KEY
                    );
            }
            catch (_) {}

            setProgress(
                0,
                0
            );

            setStatus(
                'تم المسح.'
            );

            renderLog();

            render();
        };

    source.addEventListener(
        'input',
        () => {

            if (
                !state.running
            ) {
                runBtn.disabled =
                    true;

                setStatus(
                    'تم تعديل النص. اضغط «تحليل ومعاينة» من جديد.'
                );

                saveWorkspace();
            }
        }
    );

    $('.studentDataEnabled').onchange =
        e => {
            state.studentDataEnabled =
                !!e.target.checked;
            saveWorkspace();
            renderStudentFields();
        };

    $('.studentAutoBefore').onchange =
        e => {
            state.studentAutoBefore =
                !!e.target.checked;
            saveWorkspace();
        };

    $('.studentPinToTop').onchange =
        e => {
            state.studentPinToTop =
                !!e.target.checked;
            saveWorkspace();
        };

    root.querySelectorAll(
        '.studentPreset'
    ).forEach(
        btn => {
            btn.onclick =
                () => {
                    state.studentFields.push(
                        newStudentField(
                            btn.dataset.preset
                        )
                    );
                    state.studentDataEnabled =
                        true;
                    saveWorkspace();
                    renderStudentFields();
                };
        }
    );

    $('.insertStudentData').onclick =
        runStudentFieldsOnly;

    $('.legacyScan').onclick =
        scanExistingQuestionsForSkills;

    $('.legacyCopyPrompt').onclick =
        () => {
            const prompt =
                buildLegacySkillPrompt();

            if (!prompt) {
                setStatus(
                    'افحص النموذج وحدد سؤالًا واحدًا على الأقل قبل نسخ البرومبت.'
                );
                return;
            }

            copyText(
                prompt,
                `✅ تم نسخ برومبت تصنيف ${selectedLegacySkillItems().length} سؤالًا.`
            );
        };

    $('.legacyBackup').onclick =
        () => {
            const text =
                legacySkillBackupText();

            if (!text) {
                setStatus(
                    'افحص أسئلة النموذج أولًا لإنشاء النسخة الاحتياطية.'
                );
                return;
            }

            copyText(
                text,
                '✅ تم نسخ النسخة الاحتياطية للمهارات الحالية.'
            );
        };

    $('.legacyParse').onclick =
        () => {
            const raw =
                $('.legacyPromptResult')
                    ?.value ||
                '';

            if (!clean(raw)) {
                setStatus(
                    'ألصق نتيجة NotebookLM أو ChatGPT أولًا.'
                );
                return;
            }

            const stats =
                parseLegacySkillResult(
                    raw
                );

            renderLegacySkillCenter();

            setStatus(
                `✅ تم استيراد ${stats.applied} مهارة` +
                `${stats.unknown ? `، معرفات غير معروفة ${stats.unknown}` : ''}` +
                `${stats.duplicates ? `، مكررة ${stats.duplicates}` : ''}` +
                `${stats.invalid ? `، أسطر غير مفهومة ${stats.invalid}` : ''}.`
            );
        };

    $('.legacySelectAll').onclick =
        () => {
            state.legacySkillItems
                .forEach(
                    item => {
                        item.selected = true;
                    }
                );
            renderLegacySkillCenter();
        };

    $('.legacySelectNone').onclick =
        () => {
            state.legacySkillItems
                .forEach(
                    item => {
                        item.selected = false;
                    }
                );
            renderLegacySkillCenter();
        };

    $('.legacyAssignSelected').onclick =
        () => {
            const skill =
                clean(
                    $('.legacyManualSkill')
                        ?.value ||
                    ''
                );

            if (!skill) {
                setStatus(
                    'اكتب اسم المهارة أولًا.'
                );
                return;
            }

            const selected =
                selectedLegacySkillItems();

            if (!selected.length) {
                setStatus(
                    'حدد سؤالًا واحدًا على الأقل.'
                );
                return;
            }

            selected.forEach(
                item => {
                    item.skill = skill;
                }
            );

            renderLegacySkillCenter();

            setStatus(
                `✅ تم تعيين «${skill}» إلى ${selected.length} سؤالًا في المعاينة.`
            );
        };

    $('.legacyApply').onclick =
        applyLegacySkillsToForms;

    $('.legacyStop').onclick =
        () => {
            if (!state.legacySkillBusy) {
                return;
            }

            state.cancelRequested = true;
            setStatus(
                'سيتم إيقاف عملية المهارات بعد الخطوة الحالية...'
            );
            $('.legacyStop').disabled = true;
        };

    $('.legacyIgnoreMetadata').onchange =
        e => {
            state.legacySkillIgnoreMetadata =
                !!e.target.checked;
        };

    $('.legacyReplaceExisting').onchange =
        e => {
            state.legacySkillReplaceExisting =
                !!e.target.checked;
        };

    $('.copyGeneratePrompt').onclick =
        () => {
            saveWorkspace();
            if (!validateAiDistribution()) return;
            copyText(
                buildQuestionGenerationPrompt(),
                '✅ تم نسخ برومبت إنشاء الأسئلة والمهارات.'
            );
        };

    $('.copyExcelPrompt').onclick =
        () => {
            saveWorkspace();
            if (!validateAiDistribution()) return;
            copyText(
                buildExcelConversionPrompt(),
                '✅ تم نسخ برومبت التحويل إلى Excel.'
            );
        };

    $('.copyExcelSpecs').onclick =
        () =>
            copyText(
                buildExcelSpecsText(),
                '✅ تم نسخ مواصفات ملف Excel.'
            );

    $('.chooseFile').onclick =
        () =>
            $('.fileInput')
                .click();

    $('.fileInput').onchange =
        e => {

            const file =
                e.target
                    .files?.[0];

            importFile(
                file
            );

            e.target.value =
                '';
        };

    $('.template').onclick =
        downloadTemplate;

    $('.exportCurrent').onclick =
        () =>
            exportWorkbook(
                state.questions,
                'أسئلة-Microsoft-Forms.xlsx'
            );

    $('.selectAll').onclick =
        () => {

            state.selected =
                new Set(
                    state.questions
                        .map(
                            (
                                _,
                                i
                            ) =>
                                i
                        )
                );

            render();
        };

    $('.selectNone').onclick =
        () => {

            state.selected =
                new Set();

            render();
        };

    $('.addQ').onclick =
        addQuestionManually;

    $('.deleteSelected').onclick =
        () => {

            if (
                !state.selected.size
            ) {
                return;
            }

            if (
                !confirm(
                    `حذف ${
                        state.selected.size
                    } سؤالًا من المعاينة؟`
                )
            ) {
                return;
            }

            const keepQ =
                [];

            const keepR =
                [];

            state.questions
                .forEach(
                    (
                        q,
                        i
                    ) => {

                        if (
                            !state.selected
                                .has(i)
                        ) {
                            keepQ.push(
                                q
                            );

                            keepR.push(
                                state.results[
                                    i
                                ] ||
                                {
                                    status:
                                        'pending',

                                    error:
                                        ''
                                }
                            );
                        }
                    }
                );

            state.questions =
                keepQ;

            state.results =
                keepR;

            state.selected =
                new Set(
                    state.questions
                        .map(
                            (
                                _,
                                i
                            ) =>
                                i
                        )
                );

            render();
        };

    $('.copyErrors').onclick =
        copyErrorReport;

    $('.clearLog').onclick =
        () => {

            state.log =
                [];

            renderLog();
        };

    [
        '.points',
        '.required',
        '.skipDup',
        '.continueErr',
        '.aiTarget',
        '.aiContentScope',
        '.aiScopeMode',
        '.aiTestType',
        '.aiTotal',
        '.aiChoice',
        '.aiTrueFalse',
        '.aiOptions',
        '.aiPoints',
        '.aiFilename'
    ].forEach(
        sel => {

            $(sel)
                .addEventListener(
                    'change',
                    saveWorkspace
                );
        }
    );

    /* =========================================================
       بدء التشغيل
       ========================================================= */

    const launcherObserver =
        new MutationObserver(
            () =>
                ensureTopLauncher()
        );

    launcherObserver.observe(
        document.documentElement,
        {
            childList: true,
            subtree: true
        }
    );

    ensureTopLauncher();

    setInterval(
        ensureTopLauncher,
        2500
    );

    loadWorkspace();

    if ($('.legacyIgnoreMetadata')) {
        $('.legacyIgnoreMetadata').checked =
            state.legacySkillIgnoreMetadata;
    }

    if ($('.legacyReplaceExisting')) {
        $('.legacyReplaceExisting').checked =
            state.legacySkillReplaceExisting;
    }

    renderLog();

    render();

    window.FormsBulkImporter = {
        version:
            VERSION,

        state,

        parse:
            parseQuestions,

        analyze,

        insertStudentData:
            runStudentFieldsOnly,

        scanExistingSkills:
            scanExistingQuestionsForSkills,

        promptExistingSkills:
            buildLegacySkillPrompt,

        applyExistingSkills:
            applyLegacySkillsToForms,

        stop:
            () => {
                state.cancelRequested =
                    true;
            },

        open:
            () =>
                panel.classList
                    .add(
                        'open'
                    ),

        exportExcel:
            () =>
                exportWorkbook(
                    state.questions,
                    'أسئلة-Microsoft-Forms.xlsx'
                ),

        promptQuestions:
            buildQuestionGenerationPrompt,

        promptExcel:
            buildExcelConversionPrompt
    };

    console.log(
        '%cMicrosoft Forms Question Bank',
        'font-size:18px;font-weight:800;color:#087f83'
    );

    console.log(
        `الإصدار: ${VERSION}`
    );

    console.log(
        `تصميم وتطوير: ${
            DEVELOPER.name
        } (${
            DEVELOPER.handle
        })`
    );

    console.log(
        `GreasyFork: ${
            DEVELOPER.greasyFork
        }`
    );

    console.log(
        DEVELOPER.copyright
    );

    console.log(
        '✅ السكربت جاهز للعمل.'
    );

})();
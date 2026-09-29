// ==UserScript==
// @name         Forms Smart Results Analyzer | محلل نتائج فورمز الذكي
// @namespace    https://greasyfork.org/users/1636459
// @version      0.4.0
// @description  Smart Microsoft Forms results analyzer with optional advanced ZipGrade Full Format CSV integration, safety validation, mastery, skills, interventions, test quality, comparisons, and reports.
// @description:ar محلل ذكي لنتائج Microsoft Forms مع تكامل اختياري متقدم لملفات ZipGrade Full Format CSV، وبوابة سلامة، وإتقان، ومهارات، وتدخلات، وجودة اختبار، ومقارنات وتقارير.
// @author       Mohammed Almalki (M0HM3D85)
// @homepageURL  https://greasyfork.org/en/users/1636459-m0hm3d85
// @supportURL   https://github.com/M0HM3D85/teacher-userscripts/issues
// @copyright    2026, Mohammed Almalki (M0HM3D85)
// @license      All Rights Reserved
// @match        https://forms.cloud.microsoft/Pages/DesignPageV2.aspx*
// @match        https://forms.office.com/Pages/DesignPageV2.aspx*
// @match        https://forms.microsoft.com/Pages/DesignPageV2.aspx*
// @run-at       document-idle
// @require      https://cdn.jsdelivr.net/gh/M0HM3D85/teacher-userscripts@dc36723dbe9b1b46fd78aec254d628465fbf41c4/scripts/forms-smart-results-analyzer/forms-smart-results-analyzer.user.js
// @grant        none
// @downloadURL  https://update.greasyfork.org/scripts/593393/Forms%20Smart%20Results%20Analyzer%20%7C%20%D9%85%D8%AD%D9%84%D9%84%20%D9%86%D8%AA%D8%A7%D8%A6%D8%AC%20%D9%81%D9%88%D8%B1%D9%85%D8%B2%20%D8%A7%D9%84%D8%B0%D9%83%D9%8A.user.js
// @updateURL    https://update.greasyfork.org/scripts/593393/Forms%20Smart%20Results%20Analyzer%20%7C%20%D9%85%D8%AD%D9%84%D9%84%20%D9%86%D8%AA%D8%A7%D8%A6%D8%AC%20%D9%81%D9%88%D8%B1%D9%85%D8%B2%20%D8%A7%D9%84%D8%B0%D9%83%D9%8A.meta.js
// ==/UserScript==

/*
=========================================================================
 Forms Smart Results Analyzer + ZipGrade — v0.4.0

 الإصدار المستقر الحالي لمسار Forms وZipGrade فقط.
 وضع Forms + ZipGrade مضمّن مع حسم تعارض المحاولات، ويستمر التحقق الميداني
 عند توفر اختبار يحتوي استجابات إلكترونية فعلية.

 تكامل ZipGrade ميزة متقدمة اختيارية داخل محلل النتائج.

 الفكرة:
 - يستخدم هذا الإصدار قاعدة المحلل المستقرة مع طبقة ZipGrade المدمجة.
 - تكامل ZipGrade هنا اختياري ومطوي داخل تبويب الإعدادات.
 - عند عدم تفعيل التكامل، لا يتم تغيير بيانات Forms إطلاقًا.
 - عند التفعيل، Full Format CSV يمر أولًا عبر بوابة سلامة صارمة.
 - بعد اعتماد البيانات، يتم تحويل محاولات ZipGrade إلى صيغة استجابات داخلية
   يفهمها نفس محرك المحلل الحالي؛ لذلك تعمل عليها المهارات، مصفوفة الإتقان،
   التدخلات، جودة الاختبار، المجموعات والتقارير نفسها.
 - PointsN هو مصدر الحقيقة الحسابية لنتائج ZipGrade.
 - StuN هو مصدر وصف الإجابة فقط.
 - الأسئلة اليدوية لا تُحقن لها القيم 0 / ½ / 1 كإجابة نصية؛ تُحقن الدرجة
   فقط عبر سجل تصحيح يدوي، حتى لا تدخل تلك الرموز في تحليل المشتتات.
 - التظليل المتعدد يُمثل كاستجابة واحدة مستقلة ولا يُقسم على الخيارات.
=========================================================================
*/

(() => {
    'use strict';

    const ZG = {
        id: 'fsrazg2',
        version: '0.4.0',
        primary: '#61958F',
        sourceQuestionIdPrefix: '__FSRA_ZIP_SOURCE__'
    };

    const STORAGE = {
        settingsPrefix: 'FSRAZG2:settings:',
        sessionPrefix: 'FSRAZG2:session:'
    };

    const DEFAULTS = {
        enabled: false,
        mode: 'forms', // forms | zipgrade | combined
        applied: false
    };

    const state = {
        settings: { ...DEFAULTS },
        formKey: '',
        rawCsv: '',
        csvFileName: '',
        csvHeaders: [],
        csvRows: [],
        zipQuestionNumbers: [],
        formPayload: null,
        parsedForm: null,
        originalFormsResponses: [],
        zipAttempts: [],
        formAttempts: [],
        conflicts: [],
        resolutions: new Map(),
        gate: null,
        lastError: '',
        busy: false,
        cacheKey: '',
        responseCache: null,
        lastBaseUrl: '',
        lastFormUrl: '',
        modalOpen: false
    };

    const nativeFetch = window.fetch.bind(window);

    // ============================================================
    // Utilities
    // ============================================================

    function clean(value) {
        return String(value ?? '')
            .replace(/[\u200B-\u200F\u2060\uFEFF\u00AD]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function westernDigits(value) {
        return String(value ?? '')
            .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
            .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
    }

    function num(value, fallback = 0) {
        const n = Number(westernDigits(clean(value)));
        return Number.isFinite(n) ? n : fallback;
    }

    function round(value, digits = 2) {
        const n = Number(value);
        if (!Number.isFinite(n)) return null;
        const p = 10 ** digits;
        return Math.round((n + Number.EPSILON) * p) / p;
    }

    function canon(value) {
        return westernDigits(clean(value))
            .normalize('NFKC')
            .replace(/[ًٌٍَُِّْـ]/g, '')
            .replace(/[“”"'`]/g, '')
            .replace(/\s+/g, ' ')
            .toLowerCase()
            .trim();
    }

    function normalizeIdentity(value) {
        return clean(value).toLowerCase();
    }

    function esc(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function parseJSON(value) {
        if (value == null) return null;
        if (typeof value === 'object') return value;
        try { return JSON.parse(value); } catch (_) { return null; }
    }

    function sum(values) {
        return values.reduce((a, b) => a + (Number(b) || 0), 0);
    }

    function fmt(value, digits = 1) {
        const n = Number(value);
        if (!Number.isFinite(n)) return '—';
        return n.toLocaleString('en-US', {
            maximumFractionDigits: digits,
            minimumFractionDigits: 0,
            numberingSystem: 'latn'
        });
    }

    function pct(value, digits = 1) {
        const n = Number(value);
        return Number.isFinite(n) ? `${n.toFixed(digits)}%` : '—';
    }

    function looksEmail(value) {
        return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean(value));
    }

    function sameSet(a, b) {
        const aa = [...new Set((a || []).map(canon).filter(Boolean))].sort();
        const bb = [...new Set((b || []).map(canon).filter(Boolean))].sort();
        return aa.length === bb.length && aa.every((x, i) => x === bb[i]);
    }

    function clone(value) {
        return value == null ? value : JSON.parse(JSON.stringify(value));
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function toast(message, type = 'info') {
        document.getElementById(`${ZG.id}-toast`)?.remove();
        const el = document.createElement('div');
        el.id = `${ZG.id}-toast`;
        el.className = `${ZG.id}-toast ${type}`;
        el.textContent = westernDigits(message);
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 3800);
    }

    function currentFormKey() {
        const qs = new URLSearchParams(location.search);
        return clean(qs.get('id') || state.formPayload?.id || 'current-form');
    }

    function settingKey() {
        return STORAGE.settingsPrefix + currentFormKey();
    }

    function sessionKey(name) {
        return `${STORAGE.sessionPrefix}${currentFormKey()}:${name}`;
    }

    function invalidateCache() {
        state.cacheKey = '';
        state.responseCache = null;
    }

    function markUnapplied() {
        state.settings.applied = false;
        sessionStorage.setItem(sessionKey('applied'), '0');
        invalidateCache();
    }

    function loadPersistence() {
        state.formKey = currentFormKey();

        try {
            const saved = JSON.parse(localStorage.getItem(settingKey()) || '{}');
            state.settings = { ...DEFAULTS, ...saved };
        } catch (_) {
            state.settings = { ...DEFAULTS };
        }

        state.rawCsv = sessionStorage.getItem(sessionKey('csv')) || '';
        state.csvFileName = sessionStorage.getItem(sessionKey('csvName')) || '';
        state.settings.applied = sessionStorage.getItem(sessionKey('applied')) === '1';

        try {
            const entries = JSON.parse(sessionStorage.getItem(sessionKey('resolutions')) || '[]');
            state.resolutions = new Map(Array.isArray(entries) ? entries : []);
        } catch (_) {
            state.resolutions = new Map();
        }

        if (!state.settings.enabled) {
            state.settings.applied = false;
        }

        if (state.rawCsv) {
            try {
                const parsed = parseCSV(state.rawCsv);
                state.csvHeaders = parsed.headers;
                state.csvRows = parsed.rows;
                state.zipQuestionNumbers = detectZipQuestionNumbers(parsed.headers);
            } catch (_) {
                state.rawCsv = '';
                state.csvRows = [];
                state.csvHeaders = [];
                state.zipQuestionNumbers = [];
                state.settings.applied = false;
            }
        }
    }

    function saveSettings() {
        const persistent = {
            enabled: Boolean(state.settings.enabled),
            mode: state.settings.mode
        };
        localStorage.setItem(settingKey(), JSON.stringify(persistent));
        sessionStorage.setItem(sessionKey('applied'), state.settings.applied ? '1' : '0');
        sessionStorage.setItem(sessionKey('resolutions'), JSON.stringify([...state.resolutions.entries()]));
    }

    function persistCsv() {
        if (state.rawCsv) {
            sessionStorage.setItem(sessionKey('csv'), state.rawCsv);
            sessionStorage.setItem(sessionKey('csvName'), state.csvFileName || 'ZipGrade Full Format CSV');
        } else {
            sessionStorage.removeItem(sessionKey('csv'));
            sessionStorage.removeItem(sessionKey('csvName'));
        }
    }

    // ============================================================
    // CSV parser
    // ============================================================

    function parseCSV(text) {
        text = String(text ?? '').replace(/^\uFEFF/, '');

        const rawRows = [];
        let row = [];
        let cell = '';
        let quoted = false;

        for (let i = 0; i < text.length; i++) {
            const ch = text[i];

            if (quoted) {
                if (ch === '"') {
                    if (text[i + 1] === '"') {
                        cell += '"';
                        i++;
                    } else {
                        quoted = false;
                    }
                } else {
                    cell += ch;
                }
                continue;
            }

            if (ch === '"') quoted = true;
            else if (ch === ',') {
                row.push(cell);
                cell = '';
            } else if (ch === '\n') {
                row.push(cell);
                rawRows.push(row);
                row = [];
                cell = '';
            } else if (ch !== '\r') {
                cell += ch;
            }
        }

        row.push(cell);
        if (row.some(x => clean(x))) rawRows.push(row);

        if (!rawRows.length) throw new Error('ملف CSV فارغ.');

        const headers = rawRows[0].map(clean);
        const rows = rawRows
            .slice(1)
            .filter(r => r.some(x => clean(x)))
            .map((r, index) => {
                const obj = { __row: index + 2, __index: index };
                headers.forEach((h, i) => obj[h] = r[i] ?? '');
                return obj;
            });

        return { headers, rows };
    }

    function detectZipQuestionNumbers(headers) {
        return headers
            .map(h => {
                const m = /^Stu(\d+)$/i.exec(clean(h));
                return m ? Number(m[1]) : null;
            })
            .filter(Number.isFinite)
            .sort((a, b) => a - b)
            .filter((n, i, arr) => i === 0 || n !== arr[i - 1]);
    }

    function splitZipTokens(raw, isManual = false) {
        const s = clean(raw);
        if (!s) return [];

        if (isManual && /^(?:0|1|½|0\.5)$/u.test(s)) return [s];

        const explicit = s
            .split(/[|,،;/+\s]+/)
            .map(clean)
            .filter(Boolean);

        if (explicit.length > 1) return explicit;

        const compact = s.replace(/\s+/g, '');
        const symbols = compact.match(/[أإآاابجدهوصخ]/gu);

        if (symbols && symbols.join('') === compact) {
            return symbols.map(x => ['ا','إ','آ'].includes(x) ? 'أ' : x);
        }

        return [s];
    }

    // ============================================================
    // Forms parsing
    // ============================================================

    function flattenValues(value, depth = 0, seen = new WeakSet()) {
        if (value == null || depth > 16) return [];

        if (Array.isArray(value)) {
            return value.flatMap(v => flattenValues(v, depth + 1, seen));
        }

        if (typeof value === 'object') {
            if (seen.has(value)) return [];
            seen.add(value);

            const likely =
                value.Description ?? value.description ??
                value.Value ?? value.value ??
                value.Text ?? value.text ??
                value.Name ?? value.name;

            return likely != null ? flattenValues(likely, depth + 1, seen) : [];
        }

        const s = clean(value);
        if (!s) return [];

        const parsed = parseJSON(s);
        if (parsed != null && parsed !== s && (Array.isArray(parsed) || typeof parsed === 'object')) {
            return flattenValues(parsed, depth + 1, seen);
        }

        return [s];
    }

    function questionInfo(q) {
        for (const candidate of [q?.deserializedQuestionInfo, q?.questionInfo]) {
            const parsed = parseJSON(candidate);
            if (parsed && typeof parsed === 'object') return parsed;
        }
        return {};
    }

    function choiceText(c) {
        return clean(
            c?.Description ?? c?.description ??
            c?.FormsProDisplayRTText ?? c?.formsProDisplayRTText ??
            c?.Title ?? c?.title ??
            c?.Value ?? c?.value ??
            c?.text ?? ''
        );
    }

    function extractChoices(q, info) {
        const arr = [
            info?.Choices, info?.choices,
            q?.choices, q?.Choices
        ].find(Array.isArray) || [];

        return arr
            .map((c, index) => ({
                index,
                text: choiceText(c),
                correct: Boolean(
                    c?.IsAnswerKey ?? c?.isAnswerKey ??
                    c?.IsCorrect ?? c?.isCorrect ??
                    c?.correct ?? false
                )
            }))
            .filter(x => x.text);
    }

    function extractAnswerKey(q, info, choices) {
        const fromChoices = choices.filter(x => x.correct).map(x => x.text);
        if (fromChoices.length) return fromChoices;

        const fields = [
            'Answer','Answers','CorrectAnswer','CorrectAnswers','AnswerKey',
            'TextAnswer','AcceptableAnswers','CorrectResponse',
            'answer','answers','correctAnswer','correctAnswers','answerKey',
            'textAnswer','acceptableAnswers'
        ];

        const out = [];
        for (const field of fields) {
            if (field in (info || {})) out.push(...flattenValues(info[field]));
            if (field in (q || {})) out.push(...flattenValues(q[field]));
        }

        return [...new Set(out.map(clean).filter(Boolean))];
    }

    function extractSubtitle(q, info) {
        return clean(
            q?.subtitle ??
            info?.Subtitle ?? info?.subtitle ??
            q?.formsProRTSubtitle ?? ''
        );
    }

    function parseFormPayload(form) {
        const raw = Array.isArray(form?.questions) ? form.questions : [];

        const all = raw.map((q, sourceIndex) => {
            const info = questionInfo(q);
            const choices = extractChoices(q, info);
            const points = num(
                info?.Point ?? info?.point ?? info?.Points ?? info?.points ??
                q?.Point ?? q?.point ?? q?.Points ?? q?.points,
                0
            );
            const rawOrder = Number.isFinite(Number(q?.order)) ? Number(q.order) : sourceIndex;
            const answerKey = extractAnswerKey(q, info, choices);

            return {
                id: clean(q?.id ?? q?.Id ?? q?.questionId ?? ''),
                sourceIndex,
                rawOrder,
                number: null,
                title: clean(q?.title ?? q?.Title ?? `سؤال ${sourceIndex + 1}`),
                subtitle: extractSubtitle(q, info),
                type: clean(q?.type ?? info?.QuestionType ?? info?.ChoiceType ?? ''),
                points,
                choices,
                answerKey,
                allowMultiple: Boolean(
                    q?.allowMultipleValues ?? info?.AllowMultipleValues ??
                    info?.allowMultipleValues ?? answerKey.length > 1
                ),
                required: Boolean(q?.required),
                isManualQuestion: points > 0 && answerKey.length === 0,
                raw: q
            };
        });

        all.sort((a, b) => a.rawOrder - b.rawOrder || a.sourceIndex - b.sourceIndex);

        const assessment = all.filter(q => q.points > 0);
        assessment.forEach((q, i) => q.number = i + 1);

        const metadata = all.filter(q => q.points <= 0);
        const nameQuestion = metadata.find(q => /اسم|name/i.test(q.title)) || null;
        const classQuestion = metadata.find(q => /فصل|شعبة|صفك|class|section/i.test(q.title)) || null;

        return { all, assessment, metadata, nameQuestion, classQuestion };
    }

    function zipTokenToChoiceIndex(token, q) {
        const t = canon(token);
        const map = new Map([
            ['أ',0],['ا',0],['a',0],
            ['ب',1],['b',1],
            ['ج',2],['c',2],
            ['د',3],['d',3],
            ['ه',4],['هـ',4],['e',4]
        ]);

        if (map.has(t)) return map.get(t);

        if (['ص','صح','صحيح','true','t'].includes(t)) {
            const idx = q?.choices?.findIndex(c => ['صح','صحيح','true'].includes(canon(c.text)));
            return idx >= 0 ? idx : 0;
        }

        if (['خ','خطأ','خطا','false','f'].includes(t)) {
            const idx = q?.choices?.findIndex(c => ['خطأ','خطا','false'].includes(canon(c.text)));
            return idx >= 0 ? idx : 1;
        }

        return -1;
    }

    function mapZipTokenToText(token, q) {
        const idx = zipTokenToChoiceIndex(token, q);
        if (idx >= 0 && idx < (q?.choices?.length || 0)) return q.choices[idx].text;
        return clean(token);
    }

    function zipKeyToFormValues(key, q) {
        if (!key) return [];
        if (q?.isManualQuestion && canon(key) === '1') return ['__manual__'];
        return splitZipTokens(key, false).map(t => mapZipTokenToText(t, q));
    }

    // ============================================================
    // API discovery / native reads
    // ============================================================

    function isFormApiUrl(url) {
        return /\/formapi\/api\/[^/]+\/users\/[^/]+\/light\/forms\('[^']+'\)/i.test(url);
    }

    function isResponsesUrl(url) {
        return isFormApiUrl(url) && /\/responses\?/i.test(url);
    }

    function isFormDefinitionUrl(url) {
        return isFormApiUrl(url) && !/\/responses\?/i.test(url);
    }

    function responseBaseFromUrl(url) {
        return String(url || '').replace(/\/responses\?.*$/i, '');
    }

    async function discoverFormUrl() {
        if (state.lastFormUrl) return state.lastFormUrl;

        const deadline = Date.now() + 12000;
        while (Date.now() < deadline) {
            const resources = performance
                .getEntriesByType('resource')
                .map(x => x.name)
                .reverse();

            const url = resources.find(x => isFormDefinitionUrl(x));
            if (url) {
                state.lastFormUrl = url;
                state.lastBaseUrl = url.replace(/\?.*$/, '');
                return url;
            }
            await sleep(350);
        }

        throw new Error('لم أجد طلب بيانات Forms. حدّث الصفحة وانتظر ظهور الأسئلة ثم حاول مرة أخرى.');
    }

    async function nativeJson(url) {
        const res = await nativeFetch(url, {
            method: 'GET',
            credentials: 'include',
            headers: { Accept: 'application/json, text/plain, */*' }
        });
        if (!res.ok) throw new Error(`فشل جلب بيانات Forms (${res.status}).`);
        return res.json();
    }

    async function fetchAllOriginalResponses(base) {
        const all = [];
        const top = 500;
        let skip = 0;

        for (let safety = 0; safety < 50; safety++) {
            const payload = await nativeJson(
                `${base}/responses?$expand=comments&$top=${top}&$skip=${skip}`
            );
            const batch = Array.isArray(payload?.value) ? payload.value : [];
            all.push(...batch);
            if (batch.length < top) break;
            skip += batch.length;
        }

        return all;
    }

    // ============================================================
    // Attempts / identities
    // ============================================================

    function formAttemptToken(response, index) {
        return `forms:${clean(response?.id ?? response?.responseId ?? response?.submissionId ?? index)}`;
    }

    function zipAttemptToken(row) {
        return `zip:${clean(row?.StudentID || 'noid')}:${row.__row}`;
    }

    function buildFormAttempts(responses) {
        return responses.map((response, index) => {
            const identity = normalizeIdentity(
                response?.responder ?? response?.responderEmail ?? response?.respondentEmail ?? ''
            );
            return {
                source: 'forms',
                token: formAttemptToken(response, index),
                identity,
                identityValid: looksEmail(identity),
                studentId: '',
                name: clean(response?.responderName || identity || `استجابة Forms ${index + 1}`),
                submitDate: clean(response?.submitDate || ''),
                raw: response,
                index
            };
        });
    }

    function buildZipAttempts(rows) {
        return rows.map(row => {
            const identity = normalizeIdentity(row.CustomID);
            const studentId = clean(row.StudentID);
            const name = clean([clean(row.FirstName), clean(row.LastName)].filter(Boolean).join(' '));
            const earned = num(row['Earned Points'], 0);
            const possible = num(row['Possible Points'], 0);

            return {
                source: 'zipgrade',
                token: zipAttemptToken(row),
                identity,
                identityValid: looksEmail(identity),
                studentId,
                name: name || studentId || `طالب ZipGrade ${row.__row}`,
                earned,
                possible,
                percentage: possible ? earned / possible * 100 : null,
                raw: row,
                index: row.__index
            };
        });
    }

    function conflictKey(attempt) {
        if (attempt.identityValid) return `email:${attempt.identity}`;
        if (attempt.source === 'zipgrade' && attempt.studentId) return `student:${attempt.studentId}`;
        return `unique:${attempt.token}`;
    }

    function relevantAttempts() {
        if (state.settings.mode === 'zipgrade') return [...state.zipAttempts];
        if (state.settings.mode === 'combined') return [...state.formAttempts, ...state.zipAttempts];
        return [...state.formAttempts];
    }

    function rebuildConflicts() {
        const groups = new Map();

        for (const attempt of relevantAttempts()) {
            const key = conflictKey(attempt);
            if (key.startsWith('unique:')) continue;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(attempt);
        }

        state.conflicts = [...groups.entries()]
            .filter(([, attempts]) => attempts.length > 1)
            .map(([key, attempts]) => ({
                key,
                label: key.startsWith('email:') ? key.slice(6) : `StudentID: ${key.slice(8)}`,
                attempts,
                selected: state.resolutions.get(key) || ''
            }));

        return state.conflicts;
    }

    function unresolvedConflicts() {
        rebuildConflicts();
        return state.conflicts.filter(c => !c.attempts.some(a => a.token === state.resolutions.get(c.key)));
    }

    function selectedAttemptTokens() {
        const attempts = relevantAttempts();
        const groups = new Map();
        const selected = new Set();
        const unresolved = [];

        for (const a of attempts) {
            const key = conflictKey(a);
            if (key.startsWith('unique:')) {
                selected.add(a.token);
                continue;
            }
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(a);
        }

        for (const [key, arr] of groups) {
            if (arr.length === 1) {
                selected.add(arr[0].token);
                continue;
            }

            const chosen = state.resolutions.get(key);
            if (chosen && arr.some(a => a.token === chosen)) selected.add(chosen);
            else unresolved.push({ key, attempts: arr });
        }

        return { selected, unresolved };
    }

    // ============================================================
    // Safety gate
    // ============================================================

    function issue(severity, code, title, detail = '') {
        return { severity, code, title, detail };
    }

    function contiguous(nums) {
        return nums.length > 0 && nums.every((n, i) => n === i + 1);
    }

    function autoCorrectForZip(q, rawAnswer) {
        if (!q || q.isManualQuestion) return null;
        const tokens = splitZipTokens(rawAnswer, false);
        if (!tokens.length) return false;
        if (tokens.length > 1) return false;
        const mapped = tokens.map(t => mapZipTokenToText(t, q));
        return q.choices.length
            ? sameSet(mapped, q.answerKey)
            : mapped.some(v => q.answerKey.some(k => canon(v) === canon(k)));
    }

    function scanZipRows(parsedForm) {
        const issues = [];
        const rows = state.csvRows;
        const headers = state.csvHeaders;
        const nums = state.zipQuestionNumbers;
        const fqs = parsedForm.assessment;

        if (!rows.length) {
            issues.push(issue('blocker', 'no-csv', 'لم يتم استيراد Full Format CSV'));
            return issues;
        }

        const required = [
            'QuizName','FirstName','StudentID','CustomID',
            'Earned Points','Possible Points','PercentCorrect','Key Version'
        ];
        const missing = required.filter(h => !headers.includes(h));
        if (missing.length) {
            issues.push(issue('blocker','missing-columns','أعمدة أساسية مفقودة',missing.join('، ')));
        }

        if (!contiguous(nums)) {
            issues.push(issue('blocker','question-sequence','ترقيم أسئلة ZipGrade غير متصل',nums.join(', ')));
        }

        if (fqs.length !== nums.length) {
            issues.push(issue(
                'blocker','question-count','عدد الأسئلة المحتسبة لا يتطابق',
                `Forms: ${fqs.length} — ZipGrade: ${nums.length}`
            ));
        } else {
            issues.push(issue('pass','question-count','عدد الأسئلة متطابق',`${nums.length} سؤالًا محتسبًا`));
        }

        const formTotal = sum(fqs.map(q => q.points));
        const possibleValues = [...new Set(
            rows.map(r => num(r['Possible Points'], NaN)).filter(Number.isFinite)
        )];

        if (possibleValues.length === 1 && Math.abs(possibleValues[0] - formTotal) <= 1e-8) {
            issues.push(issue('pass','total-points','الدرجة الكلية متطابقة',`${formTotal} نقطة`));
        } else {
            issues.push(issue(
                'blocker','total-points','الدرجة الكلية لا تتطابق',
                `Forms: ${formTotal} — ZipGrade: ${possibleValues.join(' / ') || 'غير معروف'}`
            ));
        }

        const versions = [...new Set(rows.map(r => clean(r['Key Version'])).filter(Boolean))];
        if (versions.length > 1) {
            issues.push(issue(
                'blocker','key-versions','يوجد أكثر من Key Version',
                versions.join('، ')
            ));
        } else if (versions.length === 1) {
            issues.push(issue('pass','key-version','Key Version موحد',versions[0]));
        }

        if (fqs.length === nums.length) {
            for (const q of fqs) {
                const n = q.number;
                const keys = [...new Set(rows.map(r => clean(r[`PriKey${n}`])).filter(Boolean))];

                if (keys.length !== 1) {
                    issues.push(issue(
                        'blocker',`q${n}-key-variant`,
                        `س${n}: مفتاح ZipGrade غير ثابت`,
                        keys.join(' / ') || 'لا يوجد مفتاح'
                    ));
                    continue;
                }

                const zkey = keys[0];

                if (q.isManualQuestion) {
                    if (canon(zkey) !== '1') {
                        issues.push(issue(
                            'warning',`q${n}-manual-key`,
                            `س${n}: سؤال يدوي بمفتاح غير متوقع`,`ZipGrade=${zkey}`
                        ));
                    }
                    continue;
                }

                const mapped = zipKeyToFormValues(zkey, q);
                if (!mapped.length || mapped.some(x => !x)) {
                    issues.push(issue('blocker',`q${n}-unmapped-key`,`س${n}: تعذر تحويل مفتاح ZipGrade`,zkey));
                } else if (!sameSet(mapped, q.answerKey)) {
                    issues.push(issue(
                        'blocker',`q${n}-key-mismatch`,`س${n}: مفتاح الإجابة مختلف`,
                        `ZipGrade: ${mapped.join(' + ')} — Forms: ${q.answerKey.join(' + ')}`
                    ));
                }

                const fullScores = rows
                    .filter(r => canon(r[`Mark${n}`]) === 'c')
                    .map(r => num(r[`Points${n}`], NaN))
                    .filter(Number.isFinite);
                if (fullScores.length && Math.abs(Math.max(...fullScores) - q.points) > 1e-8) {
                    issues.push(issue(
                        'blocker',`q${n}-points-mismatch`,`س${n}: نقاط السؤال مختلفة`,
                        `Forms=${q.points} — ZipGrade=${Math.max(...fullScores)}`
                    ));
                }
            }
        }

        let sumMismatch = 0;
        let percentMismatch = 0;
        let missingIdentity = 0;
        let multiCount = 0;
        let multiScored = 0;
        let blankCount = 0;
        let manualBlank = 0;
        let partialCount = 0;
        let unknownMark = 0;
        let unmapped = 0;
        let scoreOverrides = 0;

        for (const row of rows) {
            const earned = num(row['Earned Points'], 0);
            const possible = num(row['Possible Points'], 0);
            let detailSum = 0;

            if (!looksEmail(normalizeIdentity(row.CustomID))) missingIdentity++;

            for (const n of nums) {
                const q = fqs[n - 1];
                const raw = clean(row[`Stu${n}`]);
                const mark = clean(row[`Mark${n}`]).toUpperCase();
                const points = num(row[`Points${n}`], 0);
                detailSum += points;

                if (mark && !['C','X','P'].includes(mark)) unknownMark++;
                if (!raw) {
                    blankCount++;
                    if (q?.isManualQuestion) manualBlank++;
                }
                if (mark === 'P' || (q && points > 0 && points < q.points)) partialCount++;

                if (q && !q.isManualQuestion && raw) {
                    const tokens = splitZipTokens(raw, false);
                    if (tokens.length > 1) {
                        multiCount++;
                        if (points > 0) multiScored++;
                    }
                    if (tokens.some(t => zipTokenToChoiceIndex(t, q) < 0)) unmapped++;

                    const autoCorrect = autoCorrectForZip(q, raw);
                    const officialCorrect = points >= q.points;
                    const officialWrong = points <= 0;
                    if (
                        (autoCorrect === true && officialWrong) ||
                        (autoCorrect === false && officialCorrect) ||
                        (points > 0 && points < q.points)
                    ) scoreOverrides++;
                }
            }

            if (Math.abs(detailSum - earned) > 1e-8) sumMismatch++;

            const rawPct = num(row.PercentCorrect, NaN);
            const calcPct = possible ? earned / possible * 100 : 0;
            if (Number.isFinite(rawPct) && Math.abs(rawPct - calcPct) > 0.05) percentMismatch++;
        }

        if (sumMismatch) issues.push(issue('blocker','earned-sum','مجموع PointsN لا يساوي Earned Points',`${sumMismatch} سجل/سجلات`));
        else issues.push(issue('pass','earned-sum','مجموع PointsN مطابق لـ Earned Points',`${rows.length} طالبًا`));

        if (percentMismatch) issues.push(issue('blocker','percent-mismatch','PercentCorrect لا يطابق الدرجة',`${percentMismatch} سجل/سجلات`));
        if (unknownMark) issues.push(issue('blocker','unknown-mark','ظهرت قيم Mark غير معروفة',`${unknownMark} إجابة`));
        if (unmapped) issues.push(issue('blocker','unmapped-response','تعذر ربط بعض رموز الإجابة بخيارات Forms',`${unmapped} إجابة`));
        if (multiScored) issues.push(issue('blocker','multi-scored','تظليل متعدد حصل على نقاط ويحتاج مراجعة',`${multiScored} إجابة`));

        // The baseline v0.3.0 cannot distinguish a manually graded blank from a
        // manually graded wrong answer. Blocking this edge case is safer than
        // silently misclassifying it in published reports.
        if (manualBlank) {
            issues.push(issue(
                'blocker','manual-blank',
                'يوجد سؤال يدوي فارغ لا يمكن تمثيله بأمان في المحرك الحالي',
                `${manualBlank} إجابة. يلزم دعم مباشر في المحرك قبل اعتمادها.`
            ));
        }

        if (multiCount) issues.push(issue('warning','multi','تظليل متعدد',`${multiCount} إجابة — تبقى PointsN هي الدرجة الرسمية`));
        if (blankCount) issues.push(issue('info','blank','إجابات فارغة',`${blankCount} إجابة`));
        if (partialCount) issues.push(issue('info','partial','درجات جزئية',`${partialCount} إجابة`));
        if (scoreOverrides) issues.push(issue('warning','score-overrides','تصحيحات رسمية تختلف عن التصحيح الآلي',`${scoreOverrides} إجابة — سيتم احترام PointsN`));

        if (missingIdentity) {
            issues.push(issue(
                state.settings.mode === 'combined' ? 'blocker' : 'warning',
                'missing-zip-identity',
                'CustomID مفقود أو ليس بريدًا صالحًا',
                `${missingIdentity} طالبًا`
            ));
        }

        return issues;
    }

    async function runSafetyScan({ fetchFormsResponses = true } = {}) {
        state.lastError = '';
        state.busy = true;
        refreshCard();

        try {
            const formUrl = await discoverFormUrl();
            const form = await nativeJson(formUrl);
            state.formPayload = form;
            state.parsedForm = parseFormPayload(form);
            state.formKey = clean(form?.id || currentFormKey());
            state.lastBaseUrl = formUrl.replace(/\?.*$/, '');

            if (state.rawCsv && !state.csvRows.length) {
                const parsed = parseCSV(state.rawCsv);
                state.csvHeaders = parsed.headers;
                state.csvRows = parsed.rows;
                state.zipQuestionNumbers = detectZipQuestionNumbers(parsed.headers);
            }

            state.zipAttempts = buildZipAttempts(state.csvRows);

            const needForms = state.settings.mode === 'combined' && fetchFormsResponses;
            if (needForms) {
                state.originalFormsResponses = await fetchAllOriginalResponses(state.lastBaseUrl);
                state.formAttempts = buildFormAttempts(state.originalFormsResponses);
            } else {
                state.originalFormsResponses = [];
                state.formAttempts = [];
            }

            let issues = scanZipRows(state.parsedForm);

            if (state.settings.mode === 'combined') {
                const invalidForms = state.formAttempts.filter(a => !a.identityValid).length;
                if (invalidForms) {
                    issues.push(issue(
                        'blocker','missing-form-identity',
                        'توجد استجابات Forms بلا بريد صالح للدمج',
                        `${invalidForms} استجابة`
                    ));
                }
            }

            rebuildConflicts();
            const unresolved = unresolvedConflicts();
            if (unresolved.length) {
                issues.push(issue(
                    'blocker','attempt-conflicts',
                    'توجد محاولات مكررة لم يُحدد المعتمد منها',
                    `${unresolved.length} هوية/طالب`
                ));
            } else if (state.conflicts.length) {
                issues.push(issue(
                    'pass','attempt-conflicts-resolved',
                    'تم حسم المحاولات المكررة يدويًا',
                    `${state.conflicts.length} تعارض`
                ));
            }

            if (state.parsedForm.assessment.length === state.zipQuestionNumbers.length) {
                issues.push(issue(
                    'pass','assessment-order',
                    'مطابقة الأسئلة تستخدم ترتيب Forms الحقيقي',
                    'أسئلة الدرجة 0 مستبعدة من Q1..QN، ويعاد ترتيبها بعد الأسئلة عند تطبيق الدمج.'
                ));
            }

            const blockers = issues.filter(x => x.severity === 'blocker').length;
            const warnings = issues.filter(x => x.severity === 'warning').length;

            state.gate = {
                status: blockers ? 'red' : warnings ? 'yellow' : 'green',
                blockers,
                warnings,
                issues,
                generatedAt: new Date().toISOString()
            };

            invalidateCache();
            refreshCard();
            return state.gate;
        } catch (error) {
            state.lastError = clean(error?.message || error);
            refreshCard();
            throw error;
        } finally {
            state.busy = false;
        }
    }

    // ============================================================
    // Synthetic responses for the original analyzer
    // ============================================================

    function sourceQuestionId(form) {
        return `${ZG.sourceQuestionIdPrefix}${clean(form?.id || currentFormKey())}`;
    }

    function prepareFormForAnalyzer(original) {
        const form = clone(original);
        const parsed = parseFormPayload(form);
        const sourceId = sourceQuestionId(form);

        let order = 1000000;
        const orderedRaw = [];

        for (const q of parsed.assessment) {
            const raw = form.questions.find(x => clean(x?.id ?? x?.Id ?? x?.questionId ?? '') === q.id);
            if (!raw) continue;
            raw.order = order;
            order += 1000000;
            orderedRaw.push(raw);
        }

        for (const q of parsed.metadata) {
            const raw = form.questions.find(x => clean(x?.id ?? x?.Id ?? x?.questionId ?? '') === q.id);
            if (!raw) continue;
            raw.order = order;
            order += 1000000;
            orderedRaw.push(raw);
        }

        if (state.settings.mode === 'combined') {
            orderedRaw.push({
                id: sourceId,
                title: 'مصدر المحاولة',
                type: 'Question.TextField',
                order,
                required: false,
                questionInfo: JSON.stringify({ Point: 0 })
            });
        }

        form.questions = orderedRaw;

        if (state.settings.mode === 'zipgrade') {
            form.rowCount = state.csvRows.length;
        } else if (state.settings.mode === 'combined') {
            form.rowCount = num(form.rowCount, 0) + state.csvRows.length;
        }

        return form;
    }

    function parseAnswersArray(response) {
        const parsed = parseJSON(response?.answers);
        return Array.isArray(parsed) ? parsed : [];
    }

    function addOrReplaceAnswer(response, questionId, values) {
        const copy = clone(response);
        const answers = parseAnswersArray(copy).filter(x =>
            clean(x?.questionId ?? x?.QuestionId ?? x?.id ?? '') !== questionId
        );

        const vals = (values || []).map(clean).filter(Boolean);
        if (vals.length) {
            const item = { questionId };
            vals.forEach((v, i) => item[`answer${i + 1}`] = v);
            answers.push(item);
        }

        copy.answers = JSON.stringify(answers);
        return copy;
    }

    function patchFormsResponseSource(response, sourceId) {
        return addOrReplaceAnswer(response, sourceId, ['Forms']);
    }

    function zipMultiLabel(tokens, q) {
        const parts = tokens.map(t => {
            const mapped = mapZipTokenToText(t, q);
            return mapped && canon(mapped) !== canon(t) ? `${t} — ${mapped}` : t;
        });
        return `${parts.join(' + ')} — تظليل متعدد`;
    }

    function zipNeedsManualOverride(q, rawAnswer, earned) {
        if (q.isManualQuestion) return true;
        if (!rawAnswer) return false;
        if (earned > 0 && earned < q.points) return true;

        const auto = autoCorrectForZip(q, rawAnswer);
        if (auto === true && earned < q.points) return true;
        if (auto === false && earned >= q.points) return true;
        return false;
    }

    function syntheticZipResponse(attempt, parsedForm, sourceId) {
        const row = attempt.raw;
        const answers = [];
        const comments = [];

        const pushAnswer = (qid, values) => {
            const vals = (values || []).map(clean).filter(Boolean);
            if (!qid || !vals.length) return;
            const item = { questionId: qid };
            vals.forEach((v, i) => item[`answer${i + 1}`] = v);
            answers.push(item);
        };

        if (parsedForm.nameQuestion?.id) {
            pushAnswer(parsedForm.nameQuestion.id, [attempt.name]);
        }

        if (parsedForm.classQuestion?.id && clean(row.QuizClass)) {
            pushAnswer(parsedForm.classQuestion.id, [clean(row.QuizClass)]);
        }

        if (state.settings.mode === 'combined') {
            pushAnswer(sourceId, ['ZipGrade']);
        }

        for (const q of parsedForm.assessment) {
            const n = q.number;
            const rawAnswer = clean(row[`Stu${n}`]);
            const earned = num(row[`Points${n}`], 0);
            const mark = clean(row[`Mark${n}`]).toUpperCase();

            if (!q.isManualQuestion && rawAnswer) {
                const tokens = splitZipTokens(rawAnswer, false);

                if (tokens.length > 1) {
                    // One synthetic response label. This prevents a double shade from
                    // being counted under two independent distractors.
                    pushAnswer(q.id, [zipMultiLabel(tokens, q)]);
                } else {
                    pushAnswer(q.id, tokens.map(t => mapZipTokenToText(t, q)));
                }
            }

            // Manual questions deliberately receive no answer text from StuN.
            // StuN=0/½/1 is a grading code, not the student's textual answer.
            // We send only the official score as a manual grade.
            if (zipNeedsManualOverride(q, rawAnswer, earned)) {
                comments.push({
                    questionId: q.id,
                    score: earned,
                    feedback: q.isManualQuestion
                        ? 'ZipGrade — الدرجة الرسمية من PointsN'
                        : 'ZipGrade — تم احترام الدرجة الرسمية PointsN',
                    createDateTime: '2099-01-01T00:00:00.000Z',
                    __zipMark: mark
                });
            }
        }

        return {
            id: attempt.token,
            responder: attempt.identity || '',
            responderName: attempt.name,
            startDate: '',
            submitDate: '',
            answers: JSON.stringify(answers),
            comments,
            __fsraSource: 'zipgrade',
            __zipStudentId: attempt.studentId,
            __zipRow: row.__row
        };
    }

    async function buildInjectedResponseCache(base) {
        const form = state.formPayload || await nativeJson(await discoverFormUrl());
        state.formPayload = form;
        state.parsedForm = parseFormPayload(form);

        const parsedForm = state.parsedForm;
        const sourceId = sourceQuestionId(form);

        if (!state.zipAttempts.length && state.csvRows.length) {
            state.zipAttempts = buildZipAttempts(state.csvRows);
        }

        let formsRaw = [];
        if (state.settings.mode === 'combined') {
            formsRaw = await fetchAllOriginalResponses(base);
            state.originalFormsResponses = formsRaw;
            state.formAttempts = buildFormAttempts(formsRaw);
        } else {
            state.formAttempts = [];
        }

        rebuildConflicts();
        const selection = selectedAttemptTokens();
        if (selection.unresolved.length) {
            throw new Error('لا يمكن تطبيق الدمج قبل حسم جميع المحاولات المكررة.');
        }

        const out = [];

        if (state.settings.mode === 'combined') {
            state.formAttempts.forEach(a => {
                if (!selection.selected.has(a.token)) return;
                out.push(patchFormsResponseSource(a.raw, sourceId));
            });
        }

        if (state.settings.mode === 'zipgrade' || state.settings.mode === 'combined') {
            state.zipAttempts.forEach(a => {
                if (!selection.selected.has(a.token)) return;
                out.push(syntheticZipResponse(a, parsedForm, sourceId));
            });
        }

        return out;
    }

    function runtimeConfigKey() {
        return JSON.stringify({
            mode: state.settings.mode,
            applied: state.settings.applied,
            rows: state.csvRows.length,
            file: state.csvFileName,
            resolutions: [...state.resolutions.entries()].sort()
        });
    }

    async function getResponseCache(base) {
        const key = runtimeConfigKey();
        if (state.responseCache && state.cacheKey === key) return state.responseCache;

        const data = await buildInjectedResponseCache(base);
        state.responseCache = data;
        state.cacheKey = key;
        return data;
    }

    function jsonResponseLike(originalResponse, payload) {
        const headers = new Headers(originalResponse?.headers || {});
        headers.set('content-type', 'application/json; charset=utf-8');
        return new Response(JSON.stringify(payload), {
            status: 200,
            statusText: 'OK',
            headers
        });
    }

    // ============================================================
    // Fetch interception — this is the bridge into the original analyzer
    // ============================================================

    window.fetch = async function(...args) {
        const input = args[0];
        const init = args[1] || {};
        const url = typeof input === 'string' ? input : input?.url || '';

        if (isFormDefinitionUrl(url)) {
            state.lastFormUrl = url;
            state.lastBaseUrl = url.replace(/\?.*$/, '');

            const response = await nativeFetch(...args);

            try {
                const json = await response.clone().json();
                state.formPayload = json;
                state.parsedForm = parseFormPayload(json);
                state.formKey = clean(json?.id || currentFormKey());

                if (
                    state.settings.enabled &&
                    state.settings.applied &&
                    ['zipgrade','combined'].includes(state.settings.mode) &&
                    state.csvRows.length
                ) {
                    const patched = prepareFormForAnalyzer(json);
                    return jsonResponseLike(response, patched);
                }
            } catch (_) {}

            return response;
        }

        if (
            isResponsesUrl(url) &&
            state.settings.enabled &&
            state.settings.applied &&
            ['zipgrade','combined'].includes(state.settings.mode) &&
            state.csvRows.length
        ) {
            const original = await nativeFetch(...args);

            try {
                const base = responseBaseFromUrl(url);
                state.lastBaseUrl = base;
                const all = await getResponseCache(base);
                const u = new URL(url, location.href);
                const top = Math.max(1, num(u.searchParams.get('$top'), 500));
                const skip = Math.max(0, num(u.searchParams.get('$skip'), 0));
                const value = all.slice(skip, skip + top);

                return jsonResponseLike(original, {
                    value,
                    '@odata.count': all.length
                });
            } catch (error) {
                console.error('[FSRA ZipGrade] injection failed', error);
                state.lastError = clean(error?.message || error);
                toast(`تعذر تطبيق ZipGrade: ${state.lastError}`, 'error');
                return original;
            }
        }

        return nativeFetch(...args);
    };

    // ============================================================
    // Apply / restore base analyzer
    // ============================================================

    async function refreshBaseAnalyzer() {
        invalidateCache();
        if (window.FormsSmartResultsAnalyzer?.refresh) {
            await window.FormsSmartResultsAnalyzer.refresh();
        }
    }

    async function applyIntegration() {
        if (!state.settings.enabled || state.settings.mode === 'forms') {
            state.settings.applied = false;
            saveSettings();
            await refreshBaseAnalyzer();
            toast('المحلل يعمل الآن بوضع Forms الطبيعي.', 'success');
            refreshCard();
            return;
        }

        if (!state.csvRows.length) {
            toast('استورد Full Format CSV أولًا.', 'error');
            return;
        }

        state.busy = true;
        refreshCard();

        try {
            const gate = await runSafetyScan({ fetchFormsResponses: true });
            if (gate.blockers) {
                toast('لا يمكن التطبيق قبل معالجة موانع بوابة السلامة.', 'error');
                openDetailsModal('safety');
                return;
            }

            state.settings.applied = true;
            saveSettings();
            invalidateCache();
            await refreshBaseAnalyzer();

            toast(
                state.settings.mode === 'zipgrade'
                    ? 'تم تطبيق ZipGrade على نفس محرك المحلل.'
                    : 'تم تطبيق الدمج Forms + ZipGrade على نفس محرك المحلل.',
                'success'
            );
            refreshCard();
        } catch (error) {
            state.settings.applied = false;
            saveSettings();
            state.lastError = clean(error?.message || error);
            toast(state.lastError, 'error');
            refreshCard();
        } finally {
            state.busy = false;
        }
    }

    async function restoreFormsOnly() {
        state.settings.applied = false;
        saveSettings();
        invalidateCache();
        await refreshBaseAnalyzer();
        toast('تمت استعادة بيانات Forms الأصلية.', 'success');
        refreshCard();
    }

    // ============================================================
    // UI — Advanced card inside original Settings tab
    // ============================================================

    function gateBadge() {
        if (!state.gate) return `<span class="${ZG.id}-badge neutral">لم يُفحص</span>`;
        if (state.gate.status === 'red') return `<span class="${ZG.id}-badge red">🔴 يحتاج معالجة</span>`;
        if (state.gate.status === 'yellow') return `<span class="${ZG.id}-badge yellow">🟡 جاهز مع ملاحظات</span>`;
        return `<span class="${ZG.id}-badge green">🟢 جاهز</span>`;
    }

    function modeLabel() {
        if (state.settings.mode === 'zipgrade') return 'ZipGrade فقط';
        if (state.settings.mode === 'combined') return 'Forms + ZipGrade';
        return 'Forms فقط';
    }

    function appliedLabel() {
        if (!state.settings.enabled || state.settings.mode === 'forms') return 'غير مستخدم';
        return state.settings.applied ? 'مطبق على المحلل' : 'بانتظار التطبيق';
    }

    function miniStatus() {
        if (state.lastError) {
            return `<div class="${ZG.id}-alert red">${esc(state.lastError)}</div>`;
        }

        const conflictCount = unresolvedConflicts().length;
        const file = state.csvRows.length
            ? `${esc(state.csvFileName || 'CSV')} — ${state.csvRows.length} طالبًا — ${state.zipQuestionNumbers.length} سؤالًا`
            : 'لم يتم استيراد CSV في هذه الجلسة.';

        let gate = '';
        if (state.gate) {
            gate = `<div class="${ZG.id}-mini ${state.gate.status}">
                <b>${state.gate.status === 'red' ? 'توجد موانع' : state.gate.status === 'yellow' ? 'صالحة مع ملاحظات' : 'جاهزة'}</b>
                <span>مانع: ${state.gate.blockers} — تحذير: ${state.gate.warnings}</span>
            </div>`;
        }

        return `
            <div class="${ZG.id}-summary">
                <span><b>الوضع:</b> ${esc(modeLabel())}</span>
                <span><b>الحالة:</b> ${esc(appliedLabel())}</span>
                <span><b>CSV:</b> ${file}</span>
                ${conflictCount ? `<span class="${ZG.id}-danger-text"><b>تعارضات غير محسومة:</b> ${conflictCount}</span>` : ''}
            </div>
            ${gate}
        `;
    }

    function cardHTML() {
        const disabled = state.settings.enabled ? '' : 'disabled';
        return `
        <details id="${ZG.id}-advanced" class="fsra-card ${ZG.id}-card">
            <summary>
                <span>خيارات متقدمة — ZipGrade</span>
                <span class="${ZG.id}-optional">اختياري</span>
                ${gateBadge()}
            </summary>

            <div class="${ZG.id}-inside">
                <div class="fsra-note">
                    لا يتغير المحلل العام إذا لم تُفعّل هذه الميزة. بعد التطبيق تستخدم
                    بيانات ZipGrade نفس محرك المهارات، الإتقان، التدخلات، الجودة، المجموعات والتقارير.
                </div>

                <label class="${ZG.id}-switch">
                    <input type="checkbox" id="${ZG.id}-enabled" ${state.settings.enabled ? 'checked' : ''}>
                    <b>تفعيل تكامل ZipGrade لهذا النموذج</b>
                </label>

                <div class="${ZG.id}-modes">
                    <label>
                        <input type="radio" name="${ZG.id}-mode" value="forms" ${state.settings.mode === 'forms' ? 'checked' : ''} ${disabled}>
                        <b>Forms فقط</b>
                        <small>السلوك الأصلي دون أي حقن بيانات.</small>
                    </label>
                    <label>
                        <input type="radio" name="${ZG.id}-mode" value="zipgrade" ${state.settings.mode === 'zipgrade' ? 'checked' : ''} ${disabled}>
                        <b>ZipGrade فقط</b>
                        <small>طلاب CSV مع بنية أسئلة ومهارات النموذج.</small>
                    </label>
                    <label>
                        <input type="radio" name="${ZG.id}-mode" value="combined" ${state.settings.mode === 'combined' ? 'checked' : ''} ${disabled}>
                        <b>Forms + ZipGrade</b>
                        <small>دمج عبر CustomID = Email مع منع العد المزدوج.</small>
                    </label>
                </div>

                <div class="${ZG.id}-actions">
                    <label class="fsra-btn ${state.settings.enabled ? '' : 'disabled'}">
                        استيراد Full Format CSV
                        <input type="file" id="${ZG.id}-file" accept=".csv,text/csv" ${disabled} hidden>
                    </label>
                    <button class="fsra-btn" id="${ZG.id}-scan" ${disabled}>فحص المطابقة والسلامة</button>
                    <button class="fsra-btn" id="${ZG.id}-conflicts" ${disabled}>تعارضات المحاولات</button>
                    <button class="fsra-btn primary" id="${ZG.id}-apply" ${disabled}>تطبيق على المحلل</button>
                    <button class="fsra-btn" id="${ZG.id}-restore">استعادة Forms فقط</button>
                    <button class="fsra-btn" id="${ZG.id}-clear" ${disabled}>مسح CSV</button>
                </div>

                <div id="${ZG.id}-status">${miniStatus()}</div>
            </div>
        </details>`;
    }

    function injectCard() {
        const save = document.querySelector('[data-action="save-settings"]');
        if (!save || document.getElementById(`${ZG.id}-advanced`)) return;

        const actions = save.closest('.fsra-actions');
        if (!actions?.parentElement) return;

        const wrap = document.createElement('div');
        wrap.innerHTML = cardHTML();
        actions.parentElement.insertBefore(wrap.firstElementChild, actions);
    }

    function refreshCard() {
        const old = document.getElementById(`${ZG.id}-advanced`);
        if (!old) {
            injectCard();
            return;
        }

        const open = old.open;
        const wrap = document.createElement('div');
        wrap.innerHTML = cardHTML();
        const fresh = wrap.firstElementChild;
        fresh.open = open;
        old.replaceWith(fresh);
    }

    // ============================================================
    // Details modal
    // ============================================================

    function renderSafety() {
        if (!state.gate) return `<div class="${ZG.id}-empty">شغّل فحص المطابقة والسلامة أولًا.</div>`;

        const order = { blocker: 0, warning: 1, info: 2, pass: 3 };
        return `<div class="${ZG.id}-issue-list">
            ${[...state.gate.issues].sort((a,b) => order[a.severity]-order[b.severity]).map(x => `
                <div class="${ZG.id}-issue ${x.severity}">
                    <span>${x.severity === 'blocker' ? '⛔' : x.severity === 'warning' ? '⚠️' : x.severity === 'pass' ? '✓' : 'ℹ️'}</span>
                    <div><b>${esc(x.title)}</b>${x.detail ? `<div>${esc(x.detail)}</div>` : ''}</div>
                </div>
            `).join('')}
        </div>`;
    }

    function renderMapping() {
        if (!state.parsedForm || !state.csvRows.length) {
            return `<div class="${ZG.id}-empty">استورد CSV وشغّل الفحص أولًا.</div>`;
        }

        return `<div class="${ZG.id}-table-wrap"><table class="${ZG.id}-table">
            <thead><tr>
                <th>#</th><th>سؤال Forms / المهارة</th><th>النوع</th><th>نقاط</th>
                <th>مفتاح ZipGrade</th><th>تحويله</th><th>مفتاح Forms</th><th>الحالة</th>
            </tr></thead>
            <tbody>${state.parsedForm.assessment.map(q => {
                const keys = [...new Set(state.csvRows.map(r => clean(r[`PriKey${q.number}`])).filter(Boolean))];
                const mapped = q.isManualQuestion ? ['تصحيح يدوي / PointsN'] : keys.flatMap(k => zipKeyToFormValues(k,q));
                const ok = q.isManualQuestion
                    ? keys.length === 1 && canon(keys[0]) === '1'
                    : keys.length === 1 && sameSet(mapped, q.answerKey);
                return `<tr class="${ok ? '' : `${ZG.id}-warn-row`}">
                    <td>${q.number}</td>
                    <td><b>${esc(q.title)}</b><div class="${ZG.id}-muted">${esc(q.subtitle || '—')}</div></td>
                    <td>${esc(q.type)}</td><td>${fmt(q.points)}</td>
                    <td>${esc(keys.join(' / ') || '—')}</td>
                    <td>${esc(mapped.join(' + ') || '—')}</td>
                    <td>${esc(q.answerKey.join(' + ') || 'يدوي')}</td>
                    <td>${ok ? '✓' : '⚠️'}</td>
                </tr>`;
            }).join('')}</tbody>
        </table></div>`;
    }

    function renderConflicts() {
        rebuildConflicts();
        if (!state.conflicts.length) {
            return `<div class="${ZG.id}-good">✓ لا توجد محاولات مكررة في الوضع الحالي.</div>`;
        }

        return `
            <div class="${ZG.id}-notice">
                لا يتم حذف أو اختيار أي محاولة تلقائيًا. اختر المحاولة المعتمدة لكل طالب ثم أعد فحص السلامة.
            </div>
            <div class="${ZG.id}-conflict-list">
                ${state.conflicts.map(c => `
                    <div class="${ZG.id}-conflict">
                        <b>${esc(c.label)}</b>
                        <div>${c.attempts.map(a => `
                            <label>
                                <input type="radio" name="${ZG.id}-resolve-${esc(c.key)}"
                                    data-${ZG.id}-resolve="${esc(c.key)}" value="${esc(a.token)}"
                                    ${state.resolutions.get(c.key) === a.token ? 'checked' : ''}>
                                <span>
                                    <strong>${a.source === 'zipgrade' ? 'ZipGrade' : 'Forms'}</strong>
                                    — ${esc(a.name)}
                                    ${a.source === 'zipgrade' ? `— ${fmt(a.earned)}/${fmt(a.possible)} (${pct(a.percentage)})` : ''}
                                    ${a.submitDate ? `— ${esc(a.submitDate)}` : ''}
                                </span>
                            </label>
                        `).join('')}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    function modalBody(tab) {
        if (tab === 'mapping') return renderMapping();
        if (tab === 'conflicts') return renderConflicts();
        return renderSafety();
    }

    function openDetailsModal(tab = 'safety') {
        document.getElementById(`${ZG.id}-modal`)?.remove();
        state.modalOpen = true;

        const modal = document.createElement('div');
        modal.id = `${ZG.id}-modal`;
        modal.className = `${ZG.id}-modal`;
        modal.innerHTML = `
            <div class="${ZG.id}-dialog">
                <div class="${ZG.id}-head">
                    <div>
                        <h2>ZipGrade — فحص الدمج</h2>
                        <div>${esc(modeLabel())} — ${gateBadge()}</div>
                    </div>
                    <button id="${ZG.id}-close">×</button>
                </div>
                <div class="${ZG.id}-tabs">
                    <button data-${ZG.id}-tab="safety" class="${tab==='safety'?'active':''}">بوابة السلامة</button>
                    <button data-${ZG.id}-tab="mapping" class="${tab==='mapping'?'active':''}">مطابقة الأسئلة</button>
                    <button data-${ZG.id}-tab="conflicts" class="${tab==='conflicts'?'active':''}">تعارضات المحاولات</button>
                </div>
                <div id="${ZG.id}-modal-body" class="${ZG.id}-body">${modalBody(tab)}</div>
            </div>`;
        document.body.appendChild(modal);
    }

    function rerenderModal(tab) {
        if (!document.getElementById(`${ZG.id}-modal`)) return;
        openDetailsModal(tab);
    }

    // ============================================================
    // Import / actions
    // ============================================================

    async function importCsvFile(file) {
        if (!file) return;
        try {
            const raw = await file.text();
            const parsed = parseCSV(raw);
            state.rawCsv = raw;
            state.csvFileName = file.name;
            state.csvHeaders = parsed.headers;
            state.csvRows = parsed.rows;
            state.zipQuestionNumbers = detectZipQuestionNumbers(parsed.headers);
            state.zipAttempts = buildZipAttempts(state.csvRows);
            state.gate = null;
            state.resolutions.clear();
            markUnapplied();
            persistCsv();
            saveSettings();
            refreshCard();
            toast(`تم استيراد ${state.csvRows.length} طالبًا من ZipGrade.`, 'success');
        } catch (error) {
            state.lastError = clean(error?.message || error);
            toast(state.lastError, 'error');
            refreshCard();
        }
    }

    function clearCsv() {
        state.rawCsv = '';
        state.csvFileName = '';
        state.csvHeaders = [];
        state.csvRows = [];
        state.zipQuestionNumbers = [];
        state.zipAttempts = [];
        state.gate = null;
        state.resolutions.clear();
        markUnapplied();
        persistCsv();
        saveSettings();
        refreshCard();
        toast('تم مسح بيانات ZipGrade من الجلسة.', 'success');
    }

    // ============================================================
    // Events
    // ============================================================

    document.addEventListener('change', async e => {
        const t = e.target;

        if (t?.id === `${ZG.id}-enabled`) {
            state.settings.enabled = t.checked;
            if (!t.checked) {
                state.settings.mode = 'forms';
                state.settings.applied = false;
            }
            state.gate = null;
            markUnapplied();
            saveSettings();
            refreshCard();
            if (!t.checked) await restoreFormsOnly();
            return;
        }

        if (t?.name === `${ZG.id}-mode`) {
            state.settings.mode = t.value;
            state.gate = null;
            state.resolutions.clear();
            markUnapplied();
            saveSettings();
            refreshCard();
            return;
        }

        if (t?.id === `${ZG.id}-file`) {
            await importCsvFile(t.files?.[0]);
            return;
        }

        const key = t?.getAttribute?.(`data-${ZG.id}-resolve`);
        if (key) {
            state.resolutions.set(key, t.value);
            state.gate = null;
            markUnapplied();
            saveSettings();
            rerenderModal('conflicts');
        }
    });

    document.addEventListener('click', async e => {
        const btn = e.target.closest('button');
        if (!btn) return;

        if (btn.id === `${ZG.id}-scan`) {
            try {
                const gate = await runSafetyScan({ fetchFormsResponses: true });
                toast(
                    gate.blockers ? 'اكتمل الفحص وتوجد موانع تحتاج معالجة.' :
                    gate.warnings ? 'البيانات صالحة مع ملاحظات.' : 'البيانات جاهزة للتحليل.',
                    gate.blockers ? 'error' : gate.warnings ? 'warn' : 'success'
                );
                openDetailsModal('safety');
            } catch (error) {
                toast(clean(error?.message || error), 'error');
            }
            return;
        }

        if (btn.id === `${ZG.id}-conflicts`) {
            if (state.settings.mode === 'combined' && !state.formAttempts.length) {
                try { await runSafetyScan({ fetchFormsResponses: true }); } catch (_) {}
            } else if (state.settings.mode === 'zipgrade' && !state.zipAttempts.length) {
                state.zipAttempts = buildZipAttempts(state.csvRows);
            }
            openDetailsModal('conflicts');
            return;
        }

        if (btn.id === `${ZG.id}-apply`) {
            await applyIntegration();
            return;
        }

        if (btn.id === `${ZG.id}-restore`) {
            await restoreFormsOnly();
            return;
        }

        if (btn.id === `${ZG.id}-clear`) {
            clearCsv();
            return;
        }

        if (btn.id === `${ZG.id}-close`) {
            document.getElementById(`${ZG.id}-modal`)?.remove();
            state.modalOpen = false;
            return;
        }

        const tab = btn.getAttribute(`data-${ZG.id}-tab`);
        if (tab) {
            rerenderModal(tab);
        }
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && state.modalOpen) {
            document.getElementById(`${ZG.id}-modal`)?.remove();
            state.modalOpen = false;
        }
    });

    // ============================================================
    // Styles
    // ============================================================

    function addStyles() {
        if (document.getElementById(`${ZG.id}-styles`)) return;
        const style = document.createElement('style');
        style.id = `${ZG.id}-styles`;
        style.textContent = `
            .${ZG.id}-card{margin-top:12px;border:1px solid #b9d4d0!important;overflow:hidden}
            .${ZG.id}-card>summary{display:flex;align-items:center;gap:8px;cursor:pointer;padding:12px 14px;font-weight:800;list-style:none}
            .${ZG.id}-card>summary::-webkit-details-marker{display:none}
            .${ZG.id}-card>summary:before{content:'▸';transition:.15s}.${ZG.id}-card[open]>summary:before{transform:rotate(90deg)}
            .${ZG.id}-card[open]>summary:before{transform:rotate(90deg)}
            .${ZG.id}-optional{font-size:11px;padding:3px 7px;border-radius:999px;background:#eef6f5;color:#426e69;margin-inline-end:auto}
            .${ZG.id}-inside{padding:0 14px 14px}
            .${ZG.id}-switch{display:flex;gap:8px;align-items:center;margin:12px 0}.${ZG.id}-switch input{width:18px;height:18px}
            .${ZG.id}-switch input{width:18px;height:18px}
            .${ZG.id}-modes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:10px 0}
            .${ZG.id}-modes label{display:block;border:1px solid #d8e2e1;border-radius:10px;padding:10px;background:#fff;cursor:pointer}
            .${ZG.id}-modes label:has(input:checked){border-color:${ZG.primary};background:#f1f8f7;box-shadow:0 0 0 1px ${ZG.primary} inset}
            .${ZG.id}-modes b,.${ZG.id}-modes small{display:block;margin-top:4px}.${ZG.id}-modes small{color:#64748b;line-height:1.5}
            .${ZG.id}-modes small{color:#64748b;line-height:1.5}
            .${ZG.id}-actions{display:flex;gap:7px;flex-wrap:wrap;margin:12px 0}.${ZG.id}-actions .disabled{opacity:.5;pointer-events:none}
            .${ZG.id}-actions .disabled{opacity:.5;pointer-events:none}
            .${ZG.id}-summary{display:flex;flex-wrap:wrap;gap:8px;background:#f8fafc;border-radius:8px;padding:9px 10px;color:#475569;font-size:12px}
            .${ZG.id}-badge{display:inline-flex;padding:3px 8px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap}
            .${ZG.id}-badge.neutral{background:#f1f5f9;color:#64748b}.${ZG.id}-badge.green{background:#dcfce7;color:#166534}
            .${ZG.id}-badge.green{background:#dcfce7;color:#166534}.${ZG.id}-badge.yellow{background:#fef3c7;color:#92400e}
            .${ZG.id}-badge.yellow{background:#fef3c7;color:#92400e}.${ZG.id}-badge.red{background:#fee2e2;color:#991b1b}
            .${ZG.id}-badge.red{background:#fee2e2;color:#991b1b}
            .${ZG.id}-mini{display:flex;justify-content:space-between;gap:8px;margin-top:8px;padding:9px 10px;border-radius:8px}.${ZG.id}-mini.green{background:#f0fdf4;color:#166534}
            .${ZG.id}-mini.green{background:#f0fdf4;color:#166534}.${ZG.id}-mini.yellow{background:#fffbeb;color:#92400e}
            .${ZG.id}-mini.yellow{background:#fffbeb;color:#92400e}.${ZG.id}-mini.red{background:#fef2f2;color:#991b1b}
            .${ZG.id}-mini.red{background:#fef2f2;color:#991b1b}
            .${ZG.id}-danger-text{color:#991b1b}.${ZG.id}-muted{color:#64748b;font-size:11px}
            .${ZG.id}-muted{color:#64748b;font-size:11px}
            .${ZG.id}-alert{padding:10px 12px;border-radius:8px;margin-top:8px}.${ZG.id}-alert.red{background:#fef2f2;color:#991b1b;border:1px solid #fecaca}
            .${ZG.id}-alert.red{background:#fef2f2;color:#991b1b;border:1px solid #fecaca}
            .${ZG.id}-modal{position:fixed;inset:0;z-index:2147483600;background:rgba(15,23,42,.48);display:flex;align-items:center;justify-content:center;padding:20px;direction:rtl;font-family:Tahoma,Arial,sans-serif}
            .${ZG.id}-dialog{width:min(1450px,96vw);height:min(880px,94vh);background:#fff;border-radius:16px;box-shadow:0 24px 80px rgba(0,0,0,.3);display:flex;flex-direction:column;overflow:hidden;color:#172033}
            .${ZG.id}-head{display:flex;justify-content:space-between;align-items:center;gap:12px;background:${ZG.primary};color:#fff;padding:14px 18px}.${ZG.id}-head h2{margin:0 0 5px;font-size:19px}
            .${ZG.id}-head h2{margin:0 0 5px;font-size:19px}.${ZG.id}-head>button{width:36px;height:36px;border:0;border-radius:9px;background:rgba(255,255,255,.18);color:#fff;font-size:26px;cursor:pointer}
            .${ZG.id}-head>button{width:36px;height:36px;border:0;border-radius:9px;background:rgba(255,255,255,.18);color:#fff;font-size:26px;cursor:pointer}
            .${ZG.id}-tabs{display:flex;gap:4px;padding:8px 12px 0;border-bottom:1px solid #e5e7eb}.${ZG.id}-tabs button{border:0;background:transparent;padding:9px 12px;cursor:pointer;font-weight:700;border-radius:8px 8px 0 0}
            .${ZG.id}-tabs button{border:0;background:transparent;padding:9px 12px;cursor:pointer;font-weight:700;border-radius:8px 8px 0 0}.${ZG.id}-tabs button.active{background:#eef6f5;color:#355f5b;box-shadow:inset 0 -2px ${ZG.primary}}
            .${ZG.id}-tabs button.active{background:#eef6f5;color:#355f5b;box-shadow:inset 0 -2px ${ZG.primary}}
            .${ZG.id}-body{flex:1;overflow:auto;padding:14px}.${ZG.id}-issue-list{display:grid;gap:8px}
            .${ZG.id}-issue-list{display:grid;gap:8px}.${ZG.id}-issue{display:flex;gap:10px;padding:10px 12px;border:1px solid #e2e8f0;border-radius:9px}
            .${ZG.id}-issue{display:flex;gap:10px;padding:10px 12px;border:1px solid #e2e8f0;border-radius:9px}.${ZG.id}-issue.blocker{background:#fef2f2;border-color:#fecaca}
            .${ZG.id}-issue.blocker{background:#fef2f2;border-color:#fecaca}.${ZG.id}-issue.warning{background:#fffbeb;border-color:#fde68a}
            .${ZG.id}-issue.warning{background:#fffbeb;border-color:#fde68a}.${ZG.id}-issue.pass{background:#f0fdf4;border-color:#bbf7d0}
            .${ZG.id}-issue.pass{background:#f0fdf4;border-color:#bbf7d0}.${ZG.id}-issue.info{background:#f8fafc}
            .${ZG.id}-issue.info{background:#f8fafc}
            .${ZG.id}-table-wrap{overflow:auto;border:1px solid #e2e8f0;border-radius:10px}.${ZG.id}-table{width:100%;min-width:1000px;border-collapse:collapse;font-size:12px}
            .${ZG.id}-table{width:100%;min-width:1000px;border-collapse:collapse;font-size:12px}.${ZG.id}-table th,.${ZG.id}-table td{padding:9px 10px;border-bottom:1px solid #edf2f7;text-align:right;vertical-align:top}
            .${ZG.id}-table th,.${ZG.id}-table td{padding:9px 10px;border-bottom:1px solid #edf2f7;text-align:right;vertical-align:top}.${ZG.id}-table th{background:#f8fafc;position:sticky;top:0}
            .${ZG.id}-table th{background:#f8fafc;position:sticky;top:0}.${ZG.id}-warn-row{background:#fff8e7}
            .${ZG.id}-warn-row{background:#fff8e7}
            .${ZG.id}-good{padding:12px;border-radius:9px;background:#f0fdf4;color:#166534;border:1px solid #bbf7d0}.${ZG.id}-notice{padding:10px;border-radius:9px;background:#fffbeb;color:#92400e;border:1px solid #fde68a;margin-bottom:10px}
            .${ZG.id}-notice{padding:10px;border-radius:9px;background:#fffbeb;color:#92400e;border:1px solid #fde68a;margin-bottom:10px}
            .${ZG.id}-conflict-list{display:grid;gap:10px}.${ZG.id}-conflict{border:1px solid #e2e8f0;border-radius:10px;padding:11px}
            .${ZG.id}-conflict{border:1px solid #e2e8f0;border-radius:10px;padding:11px}.${ZG.id}-conflict label{display:flex;gap:7px;align-items:center;padding:7px;background:#f8fafc;border-radius:7px;margin-top:6px;cursor:pointer}
            .${ZG.id}-conflict label{display:flex;gap:7px;align-items:center;padding:7px;background:#f8fafc;border-radius:7px;margin-top:6px;cursor:pointer}
            .${ZG.id}-empty{padding:22px;text-align:center;color:#64748b}
            .${ZG.id}-toast{position:fixed;left:20px;bottom:20px;z-index:2147483647;max-width:520px;padding:11px 14px;border-radius:10px;background:#334155;color:#fff;box-shadow:0 12px 30px rgba(0,0,0,.25);direction:rtl;font-family:Tahoma,Arial,sans-serif}
            .${ZG.id}-toast.success{background:#166534}.${ZG.id}-toast.warn{background:#92400e}.${ZG.id}-toast.error{background:#991b1b}
            .${ZG.id}-toast.warn{background:#92400e}.${ZG.id}-toast.error{background:#991b1b}
            @media(max-width:900px){.${ZG.id}-modes{grid-template-columns:1fr}}
        `;
        document.head.appendChild(style);
    }

    // ============================================================
    // Init
    // ============================================================

    function installFinalVersionBridge() {
        // The stable Forms core is loaded through @require. Keep the public API and
        // About dialog aligned with the integrated userscript version.
        try {
            if (window.FormsSmartResultsAnalyzer) {
                window.FormsSmartResultsAnalyzer.version = ZG.version;
            }
        } catch (_) {}

        document.addEventListener('click', event => {
            const about = event.target?.closest?.('#fsra-overlay [data-action="about"]');
            if (!about) return;

            event.preventDefault();
            event.stopImmediatePropagation();

            alert(
                `محلل نتائج فورمز الذكي v${ZG.version}\n` +
                `تصميم وتطوير: Mohammed Almalki (M0HM3D85)\n` +
                `تكامل ZipGrade: اختياري من الإعدادات المتقدمة\n` +
                `© 2026 Mohammed Almalki — جميع الحقوق محفوظة.`
            );
        }, true);
    }

    function init() {
        loadPersistence();
        addStyles();
        installFinalVersionBridge();

        if (state.csvRows.length) {
            state.zipAttempts = buildZipAttempts(state.csvRows);
        }

        const observer = new MutationObserver(() => injectCard());
        observer.observe(document.documentElement, { childList: true, subtree: true });
        injectCard();

        window.FormsSmartResultsAnalyzerZipGrade = {
            version: ZG.version,
            scan: () => runSafetyScan({ fetchFormsResponses: true }),
            apply: applyIntegration,
            restore: restoreFormsOnly,
            state: () => ({
                enabled: state.settings.enabled,
                mode: state.settings.mode,
                applied: state.settings.applied,
                rows: state.csvRows.length,
                questions: state.zipQuestionNumbers.length,
                gate: state.gate
            })
        };

        console.info(`FSRA ZipGrade Unified v${ZG.version} active`);
    }

    init();
})();

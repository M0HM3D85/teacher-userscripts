// ==UserScript==
// @name         Forms Smart Results Analyzer | محلل نتائج فورمز الذكي
// @namespace    https://greasyfork.org/users/1636459
// @version      0.3.0
// @description  منصة تحليل تربوي لنتائج Microsoft Forms: تقديرات، مهارات تلقائية من Subtitle، مصفوفة إتقان، تدخلات، فصول وشعب، جودة اختبار، مشتتات، مقارنات وتقارير متعددة.
// @author       Mohammed Almalki (M0HM3D85)
// @homepageURL  https://greasyfork.org/en/users/1636459-m0hm3d85
// @supportURL   https://github.com/M0HM3D85/teacher-userscripts/issues
// @copyright    2026, Mohammed Almalki (M0HM3D85)
// @license      All Rights Reserved
// @match        https://forms.cloud.microsoft/Pages/DesignPageV2.aspx*
// @match        https://forms.office.com/Pages/DesignPageV2.aspx*
// @match        https://forms.microsoft.com/Pages/DesignPageV2.aspx*
// @grant        none
// @run-at       document-idle
// @downloadURL https://update.greasyfork.org/scripts/593393/Forms%20Smart%20Results%20Analyzer%20%7C%20%D9%85%D8%AD%D9%84%D9%84%20%D9%86%D8%AA%D8%A7%D8%A6%D8%AC%20%D9%81%D9%88%D8%B1%D9%85%D8%B2%20%D8%A7%D9%84%D8%B0%D9%83%D9%8A.user.js
// @updateURL https://update.greasyfork.org/scripts/593393/Forms%20Smart%20Results%20Analyzer%20%7C%20%D9%85%D8%AD%D9%84%D9%84%20%D9%86%D8%AA%D8%A7%D8%A6%D8%AC%20%D9%81%D9%88%D8%B1%D9%85%D8%B2%20%D8%A7%D9%84%D8%B0%D9%83%D9%8A.meta.js
// ==/UserScript==

/*
=========================================================================
 Forms Smart Results Analyzer | محلل نتائج فورمز الذكي

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

    const APP = {
        id: 'fsra',
        name: 'Forms Smart Results Analyzer',
        arName: 'محلل نتائج فورمز الذكي',
        version: '0.3.0'
    };

    const DEV = {
        name: 'Mohammed Almalki',
        handle: 'M0HM3D85',
        greasy: 'https://greasyfork.org/en/users/1636459-m0hm3d85',
        x: 'https://x.com/M0HM3D85',
        snap: 'https://www.snapchat.com/add/M0HM3D85'
    };

    const FORMS_PRIMARY_COLOR = '#61958F';

    const STORAGE = {
        settings: 'FSRA:settings:v1',
        snapshots: 'FSRA:snapshots:v1',
        skillMapPrefix: 'FSRA:skills:'
    };

    const DEFAULT_SETTINGS = {
        thresholds: {
            excellent: 90,
            veryGood: 80,
            good: 70,
            acceptable: 50
        },
        weakQuestion: 50,
        highPriorityQuestion: 30,
        report: {
            school: '',
            teacher: '',
            subject: '',
            grade: ''
        },
        privacy: false
    };

    const state = {
        loaded: false,
        loading: false,
        error: '',
        api: null,
        form: null,
        responses: [],
        questions: [],
        students: [],
        metadataQuestions: [],
        nameQuestion: null,
        skillMap: {},
        settings: loadSettings(),
        filters: {},
        search: '',
        activeTab: 'overview',
        studentSort: { key: 'percentage', dir: 'desc' },
        questionSort: { key: 'mastery', dir: 'asc' },
        expandedQuestionId: '',
        selectedSkillQuestions: new Set(),
        compareSnapshotId: '',
        overlay: null,
        toastTimer: null
    };

    // ============================================================
    // Utilities
    // ============================================================

    function clean(value) {
        return String(value ?? '').replace(/\s+/g, ' ').trim();
    }

    function westernDigits(value) {
        return String(value ?? '')
            .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
            .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
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

    function esc(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function xmlEsc(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    function parseJSON(value) {
        if (value == null) return null;
        if (typeof value === 'object') return value;
        try { return JSON.parse(value); } catch (_) { return null; }
    }

    function num(value, fallback = 0) {
        const n = Number(westernDigits(value));
        return Number.isFinite(n) ? n : fallback;
    }

    function round(value, digits = 2) {
        if (!Number.isFinite(value)) return null;
        const p = 10 ** digits;
        return Math.round((value + Number.EPSILON) * p) / p;
    }

    function sum(arr) {
        let total = 0;
        for (const value of arr) total += Number(value) || 0;
        return total;
    }

    function mean(arr) {
        return arr.length ? sum(arr) / arr.length : 0;
    }

    function median(values) {
        if (!values.length) return 0;
        const arr = Array.from(values).sort((a, b) => a - b);
        const m = Math.floor(arr.length / 2);
        return arr.length % 2 ? arr[m] : (arr[m - 1] + arr[m]) / 2;
    }

    function variance(values) {
        if (!values.length) return 0;
        const m = mean(values);
        return mean(values.map(v => (v - m) ** 2));
    }

    function stdDev(values) {
        return Math.sqrt(variance(values));
    }

    function minValue(values, fallback = 0) {
        if (!values.length) return fallback;
        let out = Infinity;
        for (const value of values) {
            const n = Number(value);
            if (Number.isFinite(n) && n < out) out = n;
        }
        return out === Infinity ? fallback : out;
    }

    function maxValue(values, fallback = 0) {
        if (!values.length) return fallback;
        let out = -Infinity;
        for (const value of values) {
            const n = Number(value);
            if (Number.isFinite(n) && n > out) out = n;
        }
        return out === -Infinity ? fallback : out;
    }

    function pearson(xs, ys) {
        if (xs.length !== ys.length || xs.length < 3) return null;
        const mx = mean(xs);
        const my = mean(ys);
        let top = 0, dx = 0, dy = 0;
        for (let i = 0; i < xs.length; i++) {
            const a = xs[i] - mx;
            const b = ys[i] - my;
            top += a * b;
            dx += a * a;
            dy += b * b;
        }
        const den = Math.sqrt(dx * dy);
        return den ? top / den : null;
    }

    // كل الأرقام الظاهرة في الواجهة والتقارير تستخدم 0-9 الإنجليزية.
    const numberFormatterCache = new Map();

    function numberFormatter(digits = 2) {
        const key = String(digits);
        if (!numberFormatterCache.has(key)) {
            numberFormatterCache.set(key, new Intl.NumberFormat('en-US', {
                useGrouping: true,
                minimumFractionDigits: 0,
                maximumFractionDigits: digits,
                numberingSystem: 'latn'
            }));
        }
        return numberFormatterCache.get(key);
    }

    function fmtPct(value, digits = 1) {
        return Number.isFinite(value)
            ? `${Number(value).toFixed(digits)}%`
            : '—';
    }

    function fmtNum(value, digits = 2) {
        if (!Number.isFinite(Number(value))) return '—';
        return numberFormatter(digits).format(Number(value));
    }

    function fmtInt(value) {
        return fmtNum(Number(value), 0);
    }

    function fmtDuration(seconds) {
        if (!Number.isFinite(seconds)) return '—';
        const s = Math.max(0, Math.round(seconds));
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const r = s % 60;
        return h
            ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
            : `${m}:${String(r).padStart(2, '0')}`;
    }

    const dateTimeFormatter = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        calendar: 'gregory',
        numberingSystem: 'latn'
    });

    function fmtDateTime(value = new Date()) {
        const d = value instanceof Date ? value : new Date(value);
        if (!Number.isFinite(d.getTime())) return '—';
        return westernDigits(dateTimeFormatter.format(d));
    }

    function slug(value) {
        return clean(value)
            .replace(/[\\/:*?"<>|]+/g, '-')
            .replace(/\s+/g, ' ')
            .slice(0, 100) || 'forms-results';
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function downloadBlob(filename, blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1500);
    }

    function loadSettings() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE.settings) || '{}');
            return {
                ...DEFAULT_SETTINGS,
                ...saved,
                thresholds: {
                    ...DEFAULT_SETTINGS.thresholds,
                    ...(saved.thresholds || {})
                },
                report: {
                    ...DEFAULT_SETTINGS.report,
                    ...(saved.report || {})
                }
            };
        } catch (_) {
            return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
        }
    }

    function saveSettings() {
        localStorage.setItem(STORAGE.settings, JSON.stringify(state.settings));
    }

    function getFormId() {
        return clean(state.form?.id || 'unknown-form');
    }

    function loadSkillMap() {
        try {
            state.skillMap = JSON.parse(localStorage.getItem(STORAGE.skillMapPrefix + getFormId()) || '{}');
        } catch (_) {
            state.skillMap = {};
        }
    }

    function saveSkillMap() {
        localStorage.setItem(STORAGE.skillMapPrefix + getFormId(), JSON.stringify(state.skillMap));
    }

    function getSnapshots() {
        try {
            const arr = JSON.parse(localStorage.getItem(STORAGE.snapshots) || '[]');
            return Array.isArray(arr) ? arr : [];
        } catch (_) {
            return [];
        }
    }

    function setSnapshots(arr) {
        localStorage.setItem(STORAGE.snapshots, JSON.stringify(arr.slice(-12)));
    }

    function toast(message, type = 'info') {
        document.getElementById('fsra-toast')?.remove();
        const el = document.createElement('div');
        el.id = 'fsra-toast';
        el.className = `fsra-toast fsra-toast-${type}`;
        el.textContent = westernDigits(message);
        document.body.appendChild(el);
        clearTimeout(state.toastTimer);
        state.toastTimer = setTimeout(() => el.remove(), 3200);
    }

    // ============================================================
    // Fixed theme #61958F
    // ============================================================

    function clamp(v, min = 0, max = 255) {
        return Math.max(min, Math.min(max, v));
    }

    function rgbParts(value) {
        const s = String(value || '').trim();
        if (/^#[0-9a-f]{6}$/i.test(s)) {
            return {
                r: parseInt(s.slice(1, 3), 16),
                g: parseInt(s.slice(3, 5), 16),
                b: parseInt(s.slice(5, 7), 16)
            };
        }
        return null;
    }

    function rgbHex(rgb) {
        return '#' + [rgb.r, rgb.g, rgb.b]
            .map(v => clamp(Math.round(v)).toString(16).padStart(2, '0'))
            .join('').toUpperCase();
    }

    function mixHex(a, b, amount = .5) {
        const x = rgbParts(a) || rgbParts(FORMS_PRIMARY_COLOR);
        const y = rgbParts(b) || { r: 255, g: 255, b: 255 };
        const t = Math.max(0, Math.min(1, amount));
        return rgbHex({
            r: x.r + (y.r - x.r) * t,
            g: x.g + (y.g - x.g) * t,
            b: x.b + (y.b - x.b) * t
        });
    }

    function theme() {
        return {
            primary: FORMS_PRIMARY_COLOR,
            dark: mixHex(FORMS_PRIMARY_COLOR, '#000000', .26),
            darker: mixHex(FORMS_PRIMARY_COLOR, '#000000', .42),
            light: mixHex(FORMS_PRIMARY_COLOR, '#FFFFFF', .72),
            soft: mixHex(FORMS_PRIMARY_COLOR, '#FFFFFF', .91),
            softer: mixHex(FORMS_PRIMARY_COLOR, '#FFFFFF', .96),
            border: mixHex(FORMS_PRIMARY_COLOR, '#FFFFFF', .80)
        };
    }

    // ============================================================
    // API discovery and fetching
    // ============================================================

    async function discoverApi() {
        const deadline = Date.now() + 15000;
        while (Date.now() < deadline) {
            const resources = performance.getEntriesByType('resource').map(x => x.name).reverse();
            const formUrl = resources.find(url =>
                /\/formapi\/api\/[^/]+\/users\/[^/]+\/light\/forms\('[^']+'\)\?/i.test(url) &&
                !/\/responses\?/i.test(url)
            );
            if (formUrl) {
                return {
                    formUrl,
                    base: formUrl.replace(/\?.*$/, '')
                };
            }
            await sleep(500);
        }
        throw new Error('لم أجد طلب بيانات Forms. افتح تبويب «الاستجابات» ثم «نظرة عامة على الاستجابات» وأعد المحاولة.');
    }

    async function fetchJSON(url) {
        const res = await fetch(url, {
            method: 'GET',
            credentials: 'include',
            headers: { Accept: 'application/json, text/plain, */*' }
        });
        if (!res.ok) throw new Error(`فشل جلب بيانات Forms (${res.status}).`);
        return res.json();
    }

    async function fetchResponses(base, expectedCount = 0) {
        const pageSize = 500;
        const all = [];
        let skip = 0;
        let safety = 0;
        while (safety++ < 50) {
            const url = `${base}/responses?$expand=comments&$top=${pageSize}&$skip=${skip}`;
            const payload = await fetchJSON(url);
            const batch = Array.isArray(payload?.value) ? payload.value : [];
            for (const item of batch) all.push(item);
            if (batch.length < pageSize) break;
            skip += batch.length;
            if (expectedCount && all.length >= expectedCount) break;
        }
        return all;
    }

    // ============================================================
    // Data parsing
    // ============================================================

    function questionInfo(q) {
        for (const candidate of [q?.deserializedQuestionInfo, q?.questionInfo]) {
            const parsed = parseJSON(candidate);
            if (parsed && typeof parsed === 'object') return parsed;
        }
        return {};
    }

    function choiceText(c) {
        return clean(
            c?.Description ?? c?.description ?? c?.FormsProDisplayRTText ??
            c?.formsProDisplayRTText ?? c?.Title ?? c?.title ?? c?.Value ?? c?.value ?? c?.text ?? ''
        );
    }

    function flattenValues(value, depth = 0, seen = new WeakSet()) {
        if (value == null || depth > 16) return [];

        if (Array.isArray(value)) {
            const out = [];
            for (const item of value) {
                for (const v of flattenValues(item, depth + 1, seen)) out.push(v);
            }
            return out;
        }

        if (typeof value === 'object') {
            if (seen.has(value)) return [];
            seen.add(value);
            const likely =
                value.Description ?? value.description ?? value.Value ?? value.value ??
                value.Text ?? value.text ?? value.Name ?? value.name ?? value.fileName ?? value.filename;
            if (likely != null) return flattenValues(likely, depth + 1, seen);
            return [];
        }

        const s = clean(value);
        if (!s) return [];

        const first = s[0];
        const last = s[s.length - 1];
        const looksStructured =
            (first === '[' && last === ']') ||
            (first === '{' && last === '}') ||
            (first === '"' && last === '"');

        if (looksStructured) {
            const parsed = parseJSON(s);
            if (Array.isArray(parsed) || (parsed && typeof parsed === 'object')) {
                return flattenValues(parsed, depth + 1, seen);
            }
            if (typeof parsed === 'string') {
                const inner = clean(parsed);
                return inner ? [inner] : [];
            }
        }

        return [s];
    }

    function extractChoices(q, info) {
        const arr = [info?.Choices, info?.choices, q?.choices, q?.Choices].find(Array.isArray) || [];
        return arr.map((c, index) => ({
            index,
            text: choiceText(c),
            correct: Boolean(c?.IsAnswerKey ?? c?.isAnswerKey ?? c?.IsCorrect ?? c?.isCorrect ?? c?.correct ?? false),
            raw: c
        })).filter(x => x.text);
    }

    function extractAnswerKey(q, info, choices) {
        const fromChoices = choices.filter(x => x.correct).map(x => x.text);
        if (fromChoices.length) return fromChoices;

        const fields = [
            'Answer','Answers','CorrectAnswer','CorrectAnswers','AnswerKey','TextAnswer','AcceptableAnswers','CorrectResponse',
            'answer','answers','correctAnswer','correctAnswers','answerKey','textAnswer','acceptableAnswers'
        ];
        const out = [];
        for (const field of fields) {
            if (info && field in info) out.push(...flattenValues(info[field]));
            if (q && field in q) out.push(...flattenValues(q[field]));
        }
        return Array.from(new Set(out.map(clean).filter(Boolean)));
    }

    function richTextToPlain(value) {
        if (value == null) return '';
        if (typeof value === 'string') {
            const raw = clean(value);
            if (!raw) return '';
            const parsed = parseJSON(raw);
            if (parsed && parsed !== value) {
                const fromParsed = richTextToPlain(parsed);
                if (fromParsed) return fromParsed;
            }
            if (/<[a-z][\s\S]*>/i.test(raw)) {
                try {
                    const doc = new DOMParser().parseFromString(raw, 'text/html');
                    const txt = clean(doc.body?.textContent || '');
                    if (txt) return txt;
                } catch (_) {}
            }
            return raw;
        }
        if (Array.isArray(value)) {
            return clean(value.map(richTextToPlain).filter(Boolean).join(' '));
        }
        if (typeof value === 'object') {
            const preferred = [
                'Text','text','Value','value','Description','description','Title','title',
                'PlainText','plainText','Content','content','Html','html'
            ];
            for (const key of preferred) {
                if (key in value) {
                    const v = richTextToPlain(value[key]);
                    if (v) return v;
                }
            }
            const chunks = [];
            for (const [key, val] of Object.entries(value)) {
                if (/^(id|type|style|format|order|point|points|required)$/i.test(key)) continue;
                const v = richTextToPlain(val);
                if (v) chunks.push(v);
                if (chunks.length >= 6) break;
            }
            return clean(chunks.join(' '));
        }
        return clean(value);
    }

    function extractQuestionSubtitle(q, info, title = '') {
        const exactKeys = [
            'Subtitle','subtitle','SubTitle','subTitle','QuestionSubtitle','questionSubtitle',
            'QuestionSubTitle','questionSubTitle','SubTitleText','subTitleText',
            'Description','description','QuestionDescription','questionDescription'
        ];
        const sources = [info, q].filter(Boolean);
        const titleKey = canon(title);

        for (const source of sources) {
            for (const key of exactKeys) {
                if (!(key in source)) continue;
                const candidate = clean(richTextToPlain(source[key]));
                if (candidate && canon(candidate) !== titleKey && candidate.length <= 500) return candidate;
            }
        }

        const seen = new WeakSet();
        const visit = (obj, depth = 0) => {
            if (!obj || typeof obj !== 'object' || depth > 5) return '';
            if (seen.has(obj)) return '';
            seen.add(obj);
            for (const [key, val] of Object.entries(obj)) {
                if (/sub.?title|subtitle/i.test(key)) {
                    const candidate = clean(richTextToPlain(val));
                    if (candidate && canon(candidate) !== titleKey && candidate.length <= 500) return candidate;
                }
            }
            for (const val of Object.values(obj)) {
                if (val && typeof val === 'object') {
                    const found = visit(val, depth + 1);
                    if (found) return found;
                }
            }
            return '';
        };

        for (const source of sources) {
            const found = visit(source);
            if (found) return found;
        }
        return '';
    }

    function parseQuestions(form) {
        const raw = Array.isArray(form?.questions) ? form.questions : [];
        const parsed = raw.map((q, index) => {
            const info = questionInfo(q);
            const choices = extractChoices(q, info);
            const points = num(
                info?.Point ?? info?.point ?? info?.Points ?? info?.points ??
                q?.Point ?? q?.point ?? q?.Points ?? q?.points,
                0
            );
            const rawOrder = Number.isFinite(Number(q?.order)) ? Number(q.order) : index;
            const answerKey = extractAnswerKey(q, info, choices);
            const type = clean(q?.type ?? info?.QuestionType ?? info?.ChoiceType ?? '');
            const title = clean(q?.title ?? q?.Title ?? q?.questionTitle ?? `سؤال ${index + 1}`);
            const subtitle = extractQuestionSubtitle(q, info, title);
            return {
                id: clean(q?.id ?? q?.Id ?? q?.questionId ?? ''),
                title,
                subtitle,
                rawOrder,
                number: 0,
                points,
                choices,
                answerKey,
                type,
                allowMultiple: Boolean(q?.allowMultipleValues ?? info?.AllowMultipleValues ?? answerKey.length > 1),
                required: Boolean(q?.required),
                isFileUpload: /FileUpload/i.test(type) || Boolean(q?.fileUploadSPOInfo),
                isManualQuestion: points > 0 && answerKey.length === 0,
                raw: q,
                info
            };
        });
        parsed.sort((a, b) => a.rawOrder - b.rawOrder);
        parsed.forEach((q, i) => q.number = i + 1);
        return parsed;
    }

    function parseResponseAnswers(response) {
        const arr = parseJSON(response?.answers);
        if (!Array.isArray(arr)) return [];
        return arr.map(item => {
            const qid = clean(item?.questionId ?? item?.QuestionId ?? item?.id ?? '');
            const values = Object.entries(item || {})
                .filter(([key]) => /^answer\d*$/i.test(key) || /^answers?$/i.test(key) || /^value$/i.test(key))
                .flatMap(([, value]) => flattenValues(value))
                .map(clean)
                .filter(Boolean);
            return { questionId: qid, values, raw: item };
        }).filter(x => x.questionId);
    }

    function parseManualGrades(response) {
        let comments = response?.comments;
        comments = parseJSON(comments) ?? comments;
        if (!Array.isArray(comments)) return new Map();

        const latest = new Map();
        for (const c of comments) {
            const qid = clean(c?.questionId ?? c?.QuestionId ?? '');
            if (!qid) continue;
            const hasScore = c?.score !== undefined && c?.score !== null && c?.score !== '';
            if (!hasScore) continue;
            const score = Number(westernDigits(c.score));
            if (!Number.isFinite(score)) continue;
            const time = new Date(c?.createDateTime || 0).getTime() || 0;
            const prev = latest.get(qid);
            if (!prev || time >= prev.time) {
                latest.set(qid, {
                    score,
                    feedback: clean(c?.feedback || ''),
                    time,
                    raw: c
                });
            }
        }
        return latest;
    }

    function sameSet(a, b) {
        const aa = Array.from(new Set(a.map(canon).filter(Boolean))).sort();
        const bb = Array.from(new Set(b.map(canon).filter(Boolean))).sort();
        return aa.length === bb.length && aa.every((v, i) => v === bb[i]);
    }

    function gradeQuestion(q, values, manualGrade = null) {
        if (q.points <= 0) {
            return { status: 'unscored', earned: 0, possible: 0, gradingSource: 'none', feedback: '' };
        }

        if (manualGrade && Number.isFinite(manualGrade.score)) {
            const earned = Math.max(0, Math.min(q.points, Number(manualGrade.score)));
            let status = 'partial';
            if (earned >= q.points) status = 'correct';
            else if (earned <= 0) status = 'wrong';
            return {
                status,
                earned,
                possible: q.points,
                gradingSource: 'manual',
                feedback: manualGrade.feedback || ''
            };
        }

        if (!q.answerKey.length) {
            return {
                status: 'pending',
                earned: null,
                possible: 0,
                gradingSource: 'pending-manual',
                feedback: ''
            };
        }

        if (!values.length) {
            return { status: 'blank', earned: 0, possible: q.points, gradingSource: 'auto', feedback: '' };
        }

        const isTextLike = !q.choices.length;
        let correct = false;
        if (isTextLike) {
            const answers = values.map(canon).filter(Boolean);
            const keys = q.answerKey.map(canon).filter(Boolean);
            correct = answers.some(a => keys.includes(a));
        } else {
            correct = sameSet(values, q.answerKey);
        }

        return {
            status: correct ? 'correct' : 'wrong',
            earned: correct ? q.points : 0,
            possible: q.points,
            gradingSource: 'auto',
            feedback: ''
        };
    }

    function detectNameQuestion(questions) {
        return questions.find(q => q.points <= 0 && /اسم|name/i.test(q.title)) || null;
    }

    function buildStudents(responses, questions) {
        state.nameQuestion = detectNameQuestion(questions);

        return responses.map((response, index) => {
            const answers = parseResponseAnswers(response);
            const answerMap = new Map(answers.map(a => [a.questionId, a]));
            const manualGrades = parseManualGrades(response);

            const details = questions.map(q => {
                const values = answerMap.get(q.id)?.values || [];
                const manual = manualGrades.get(q.id) || null;
                const grade = gradeQuestion(q, values, manual);
                return {
                    questionId: q.id,
                    number: q.number,
                    title: q.title,
                    type: q.type,
                    isManualQuestion: q.isManualQuestion,
                    isFileUpload: q.isFileUpload,
                    values,
                    points: q.points,
                    answerKey: q.answerKey,
                    ...grade
                };
            });

            const graded = details.filter(d => d.possible > 0);
            const earned = sum(graded.map(d => d.earned));
            const possible = sum(graded.map(d => d.possible));
            const fullPossible = sum(questions.filter(q => q.points > 0).map(q => q.points));
            const pendingManualCount = details.filter(d => d.status === 'pending').length;

            const explicitName = state.nameQuestion
                ? clean(answerMap.get(state.nameQuestion.id)?.values?.[0] || '')
                : '';
            const responderName = clean(response?.responderName || '');
            const responder = clean(response?.responder || '');
            const accountLocal = responder.includes('@') ? responder.split('@')[0] : responder;

            let name = '';
            let identitySource = '';
            if (explicitName) {
                name = explicitName;
                identitySource = 'سؤال الاسم';
            } else if (responderName) {
                name = responderName;
                identitySource = 'حساب المؤسسة';
            } else if (accountLocal) {
                name = accountLocal;
                identitySource = 'حساب المؤسسة';
            } else {
                name = `مستجيب مجهول ${String(index + 1).padStart(2, '0')}`;
                identitySource = 'مجهول';
            }

            const start = new Date(response?.startDate || '');
            const submit = new Date(response?.submitDate || '');
            const durationSeconds = Number.isFinite(start.getTime()) && Number.isFinite(submit.getTime())
                ? Math.max(0, (submit - start) / 1000)
                : null;

            const metadata = {};
            for (const q of questions) {
                const values = answerMap.get(q.id)?.values || [];
                if (values.length) metadata[q.id] = values;
            }

            const identityKey = responder
                ? `account:${canon(responder)}`
                : explicitName
                    ? `name:${canon(explicitName)}`
                    : responderName
                        ? `name:${canon(responderName)}`
                        : `anon:${response?.id ?? index}`;

            return {
                index,
                responseId: response?.id,
                name,
                explicitName,
                responderName,
                responder,
                identitySource,
                identityKey,
                earned,
                possible,
                fullPossible,
                percentage: possible ? earned / possible * 100 : 0,
                pendingManualCount,
                durationSeconds,
                startDate: response?.startDate || '',
                submitDate: response?.submitDate || '',
                metadata,
                details,
                detailMap: new Map(details.map(d => [d.questionId, d])),
                raw: response
            };
        });
    }

    function detectMetadataQuestions(questions, students) {
        return questions.filter(q => {
            if (q.points > 0 || state.nameQuestion?.id === q.id) return false;
            const unique = new Set();
            for (const s of students) {
                for (const v of (s.metadata[q.id] || [])) unique.add(clean(v));
            }
            return unique.size >= 2 && unique.size <= 30 && (q.choices.length > 0 || unique.size <= 12);
        }).map(q => {
            const values = new Set();
            for (const s of students) {
                for (const v of (s.metadata[q.id] || [])) values.add(clean(v));
            }
            return {
                ...q,
                filterValues: Array.from(values).filter(Boolean).sort((a, b) => a.localeCompare(b, 'ar'))
            };
        });
    }

    // ============================================================
    // Analytics
    // ============================================================

    function evaluation(percent) {
        const t = state.settings.thresholds;
        if (percent >= t.excellent) return { label: 'ممتاز', key: 'excellent' };
        if (percent >= t.veryGood) return { label: 'جيد جدًا', key: 'verygood' };
        if (percent >= t.good) return { label: 'جيد', key: 'good' };
        if (percent >= t.acceptable) return { label: 'مقبول', key: 'acceptable' };
        return { label: 'ضعيف', key: 'weak' };
    }

    function selectedStudents() {
        let arr = Array.from(state.students);
        for (const [qid, value] of Object.entries(state.filters)) {
            if (!value) continue;
            const wanted = canon(value);
            arr = arr.filter(s => (s.metadata[qid] || []).some(v => canon(v) === wanted));
        }
        const q = canon(state.search);
        if (q) {
            arr = arr.filter(s =>
                canon(s.name).includes(q) || canon(s.responder).includes(q) || canon(s.responderName).includes(q)
            );
        }
        return arr;
    }

    function cronbachAlpha(students) {
        if (students.some(s => s.pendingManualCount > 0)) return null;
        const qs = state.questions.filter(q => q.points > 0);
        if (students.length < 3 || qs.length < 2) return null;

        const totals = students.map(s => s.earned);
        const itemVars = [];
        for (const q of qs) {
            itemVars.push(variance(students.map(s => Number(s.detailMap.get(q.id)?.earned ?? 0))));
        }
        const totalVar = variance(totals);
        if (!totalVar) return null;
        const k = qs.length;
        return (k / (k - 1)) * (1 - sum(itemVars) / totalVar);
    }

    function difficultyLabel(p) {
        if (!Number.isFinite(p)) return '—';
        if (p < 30) return 'صعب جدًا';
        if (p < 50) return 'صعب';
        if (p < 70) return 'متوسط';
        if (p < 85) return 'سهل';
        return 'سهل جدًا';
    }

    function discriminationLabel(d) {
        if (!Number.isFinite(d)) return '—';
        if (d < 0) return 'سالب — راجع السؤال';
        if (d < 0.20) return 'ضعيف';
        if (d < 0.30) return 'مقبول';
        if (d < 0.40) return 'جيد';
        return 'مرتفع';
    }

    function questionAnalytics(students) {
        const sorted = Array.from(students).sort((a, b) => a.percentage - b.percentage);
        const groupSize = students.length ? Math.max(1, Math.round(students.length * 0.27)) : 0;
        const lower = sorted.slice(0, groupSize);
        const upper = sorted.slice(-groupSize);

        return state.questions.filter(q => q.points > 0).map(q => {
            let correct = 0, partial = 0, wrong = 0, blank = 0, pending = 0;
            let earnedTotal = 0, possibleTotal = 0;
            let manualSeen = false;
            const counts = new Map();

            for (const s of students) {
                const d = s.detailMap.get(q.id);
                if (!d) continue;
                if (d.gradingSource === 'manual') manualSeen = true;
                if (d.status === 'pending') { pending++; continue; }
                if (d.status === 'blank') blank++;
                else if (d.status === 'correct') correct++;
                else if (d.status === 'partial') partial++;
                else if (d.status === 'wrong') wrong++;

                if (d.possible > 0 && Number.isFinite(Number(d.earned))) {
                    earnedTotal += Number(d.earned);
                    possibleTotal += Number(d.possible);
                }

                if (d.values.length) {
                    const label = d.values.join(' | ');
                    counts.set(label, (counts.get(label) || 0) + 1);
                }
            }

            const gradedCount = correct + partial + wrong + blank;
            const mastery = possibleTotal ? earnedTotal / possibleTotal * 100 : null;

            const groupScore = group => {
                let e = 0, p = 0;
                for (const s of group) {
                    const d = s.detailMap.get(q.id);
                    if (d?.possible > 0 && Number.isFinite(Number(d.earned))) {
                        e += Number(d.earned);
                        p += Number(d.possible);
                    }
                }
                return p ? e / p : null;
            };

            const up = groupScore(upper);
            const low = groupScore(lower);
            const discrimination = Number.isFinite(up) && Number.isFinite(low) ? up - low : null;

            const valid = students.filter(s => {
                const d = s.detailMap.get(q.id);
                return d?.possible > 0 && Number.isFinite(Number(d.earned));
            });
            const itemScores = valid.map(s => Number(s.detailMap.get(q.id)?.earned ?? 0));
            const correctedTotals = valid.map(s => s.earned - Number(s.detailMap.get(q.id)?.earned ?? 0));
            const itemTotalCorrelation = pearson(itemScores, correctedTotals);

            const rows = Array.from(counts.entries()).map(([answer, count]) => ({
                answer,
                count,
                percent: students.length ? count / students.length * 100 : 0,
                correct: q.answerKey.length
                    ? q.answerKey.some(k => canon(k) === canon(answer)) || sameSet(answer.split(' | '), q.answerKey)
                    : false
            })).sort((a, b) => b.count - a.count);

            const topWrong = q.answerKey.length ? (rows.find(r => !r.correct) || null) : null;
            let gradingMode = q.isManualQuestion ? 'يدوي من Forms' : 'آلي';
            if (!q.isManualQuestion && manualSeen) gradingMode = 'آلي مع تعديل يدوي';

            return {
                question: q,
                correct,
                partial,
                wrong,
                blank,
                pending,
                gradedCount,
                mastery,
                difficulty: difficultyLabel(mastery),
                discrimination,
                discriminationLabel: discriminationLabel(discrimination),
                itemTotalCorrelation,
                distribution: rows,
                topWrong,
                gradingMode,
                manualSeen
            };
        });
    }

    function effectiveSkill(q) {
        return clean(state.skillMap[q?.id] || q?.subtitle || '');
    }

    function skillSource(q) {
        if (clean(state.skillMap[q?.id] || '')) return 'يدوي';
        if (clean(q?.subtitle || '')) return 'Subtitle';
        return '';
    }

    function skillQuestionMap() {
        const groups = new Map();
        for (const q of state.questions) {
            const skill = effectiveSkill(q);
            if (!skill || q.points <= 0) continue;
            if (!groups.has(skill)) groups.set(skill, []);
            groups.get(skill).push(q);
        }
        return groups;
    }

    function studentSkillMastery(student, questions) {
        let earned = 0, possible = 0;
        for (const q of questions) {
            const d = student.detailMap.get(q.id);
            if (d?.possible > 0 && Number.isFinite(Number(d.earned))) {
                earned += Number(d.earned);
                possible += Number(d.possible);
            }
        }
        return possible ? earned / possible * 100 : null;
    }

    function skillAnalytics(students) {
        const groups = skillQuestionMap();
        return Array.from(groups.entries()).map(([skill, qs]) => {
            let earned = 0, possible = 0;
            for (const s of students) {
                for (const q of qs) {
                    const d = s.detailMap.get(q.id);
                    if (d?.possible > 0 && Number.isFinite(Number(d.earned))) {
                        earned += Number(d.earned);
                        possible += Number(d.possible);
                    }
                }
            }
            return {
                skill,
                questions: qs.length,
                questionIds: qs.map(q => q.id),
                earned,
                possible,
                mastery: possible ? earned / possible * 100 : 0
            };
        }).sort((a, b) => a.mastery - b.mastery);
    }

    function evaluationGroups(students) {
        const order = ['ممتاز','جيد جدًا','جيد','مقبول','ضعيف'];
        const map = new Map(order.map(label => [label, []]));
        for (const s of students) {
            const label = evaluation(s.percentage).label;
            if (!map.has(label)) map.set(label, []);
            map.get(label).push(s);
        }
        return order.map(label => {
            const members = (map.get(label) || []).sort((a,b)=>b.percentage-a.percentage);
            return {
                label,
                count: members.length,
                percent: students.length ? members.length / students.length * 100 : 0,
                students: members
            };
        });
    }

    function masteryMatrix(students) {
        const map = skillQuestionMap();
        const skills = Array.from(map.keys()).sort((a,b)=>a.localeCompare(b,'ar'));
        const rows = students.map(student => {
            const values = {};
            for (const skill of skills) values[skill] = studentSkillMastery(student, map.get(skill));
            return { student, values };
        });
        return { skills, rows };
    }

    function studentWeakSkills(student, limit = 4) {
        const groups = skillQuestionMap();
        const out = [];
        for (const [skill, qs] of groups) {
            const mastery = studentSkillMastery(student, qs);
            if (Number.isFinite(mastery)) out.push({skill, mastery});
        }
        return out.sort((a,b)=>a.mastery-b.mastery).slice(0, limit);
    }

    function interventionAnalytics(students) {
        const acceptable = state.settings.thresholds.acceptable;
        const good = state.settings.thresholds.good;
        const veryGood = state.settings.thresholds.veryGood;
        const urgentCut = Math.max(0, acceptable - 20);
        const rows = students.map(s => {
            const weakSkills = studentWeakSkills(s, 4).filter(x => x.mastery < acceptable);
            const wrong = s.details.filter(d => d.points > 0 && d.status === 'wrong').length;
            const blank = s.details.filter(d => d.points > 0 && d.status === 'blank').length;
            let band = 'متقن';
            let key = 'mastered';
            if (s.percentage < urgentCut) { band = 'دعم عاجل'; key = 'urgent'; }
            else if (s.percentage < acceptable) { band = 'يحتاج دعم'; key = 'support'; }
            else if (s.percentage < good) { band = 'متابعة'; key = 'monitor'; }
            else if (s.percentage < veryGood) { band = 'جيد'; key = 'good'; }
            return { student:s, band, key, weakSkills, wrong, blank };
        }).sort((a,b)=>a.student.percentage-b.student.percentage);
        const order = ['urgent','support','monitor','good','mastered'];
        const labels = {urgent:'دعم عاجل',support:'يحتاج دعم',monitor:'متابعة',good:'جيد',mastered:'متقن'};
        const groups = order.map(key => ({key,label:labels[key],rows:rows.filter(r=>r.key===key)}));
        return { rows, groups, urgentCut };
    }

    function distractorInsights(questionRows) {
        const out = [];
        for (const qa of questionRows) {
            if (!qa.question.choices.length || !qa.question.answerKey.length) continue;
            for (const row of qa.distribution) {
                if (row.correct) continue;
                out.push({
                    question: qa.question,
                    skill: effectiveSkill(qa.question),
                    answer: row.answer,
                    count: row.count,
                    percent: row.percent,
                    correctAnswer: qa.question.answerKey.join(' | '),
                    common: row.percent >= 35
                });
            }
        }
        return out.sort((a,b)=>b.percent-a.percent || b.count-a.count);
    }

    function alphaLabel(value) {
        if (!Number.isFinite(value)) return 'غير متاح';
        if (value >= .90) return 'مرتفع جدًا';
        if (value >= .80) return 'مرتفع';
        if (value >= .70) return 'مقبول';
        if (value >= .60) return 'يحتاج مراجعة';
        return 'منخفض';
    }

    function testQualityAnalytics(students, questionRows, skills) {
        const valid = questionRows.filter(q => Number.isFinite(q.mastery));
        const avgMastery = valid.length ? mean(valid.map(q=>q.mastery)) : null;
        const difficultyCounts = {};
        for (const q of valid) difficultyCounts[q.difficulty] = (difficultyCounts[q.difficulty] || 0) + 1;
        const discValid = valid.filter(q=>Number.isFinite(q.discrimination));
        const negativeDisc = discValid.filter(q=>q.discrimination < 0);
        const weakDisc = discValid.filter(q=>q.discrimination >= 0 && q.discrimination < .20);
        const goodDisc = discValid.filter(q=>q.discrimination >= .30);
        const blankAnswers = sum(valid.map(q=>q.blank));
        const totalAnswerSlots = students.length * valid.length;
        const blankRate = totalAnswerSlots ? blankAnswers / totalAnswerSlots * 100 : 0;
        const oneQuestionSkills = skills.filter(s=>s.questions===1);
        const uncovered = state.questions.filter(q=>q.points>0 && !effectiveSkill(q));
        const alpha = cronbachAlpha(students);
        const signals = [];
        if (negativeDisc.length) signals.push(`${negativeDisc.length} سؤال/أسئلة بمعامل تمييز سالب.`);
        if (weakDisc.length) signals.push(`${weakDisc.length} سؤال/أسئلة بمعامل تمييز بين 0 و0.20.`);
        if (oneQuestionSkills.length) signals.push(`${oneQuestionSkills.length} مهارة ممثلة بسؤال واحد فقط.`);
        if (uncovered.length) signals.push(`${uncovered.length} سؤالًا بدرجات بلا مهارة/عنوان فرعي.`);
        if (blankRate >= 15) signals.push(`معدل ترك الإجابات فارغة ${fmtPct(blankRate)}.`);
        if (!signals.length) signals.push('لا توجد إشارات بارزة ضمن المؤشرات الحالية.');
        return {
            questionCount: valid.length,
            avgMastery,
            difficultyCounts,
            discriminationCount: discValid.length,
            negativeDisc,
            weakDisc,
            goodDisc,
            blankRate,
            alpha,
            alphaLabel: alphaLabel(alpha),
            oneQuestionSkills,
            uncovered,
            signals
        };
    }

    function summaryAnalytics(students) {
        const scores = students.map(s => s.earned);
        const percentages = students.map(s => s.percentage);
        const durations = students.map(s => s.durationSeconds).filter(Number.isFinite);
        const possible = sum(state.questions.filter(q => q.points > 0).map(q => q.points));
        const manualQuestions = state.questions.filter(q => q.isManualQuestion);
        const pendingManualCount = sum(students.map(s => s.pendingManualCount));
        const studentsPendingManual = students.filter(s => s.pendingManualCount > 0).length;

        const evalCounts = { ممتاز: 0, 'جيد جدًا': 0, جيد: 0, مقبول: 0, ضعيف: 0 };
        for (const s of students) evalCounts[evaluation(s.percentage).label]++;
        const acceptable = state.settings.thresholds.acceptable;

        return {
            count: students.length,
            possible,
            averageScore: mean(scores),
            averagePercent: mean(percentages),
            medianScore: median(scores),
            medianPercent: median(percentages),
            minScore: minValue(scores, 0),
            maxScore: maxValue(scores, 0),
            stdDevScore: stdDev(scores),
            stdDevPercent: stdDev(percentages),
            passRate: students.length ? students.filter(s => s.percentage >= acceptable).length / students.length * 100 : 0,
            weakCount: students.filter(s => s.percentage < acceptable).length,
            avgDuration: durations.length ? mean(durations) : null,
            alpha: cronbachAlpha(students),
            evalCounts,
            manualQuestionCount: manualQuestions.length,
            pendingManualCount,
            studentsPendingManual,
            manualComplete: manualQuestions.length > 0 && pendingManualCount === 0
        };
    }

    function groupComparisons(students) {
        return state.metadataQuestions.map(q => {
            const groups = q.filterValues.map(value => {
                const members = students.filter(s => (s.metadata[q.id] || []).some(v => canon(v) === canon(value)));
                const sm = summaryAnalytics(members);
                const skills = skillAnalytics(members);
                return {
                    value,
                    count: members.length,
                    averagePercent: sm.averagePercent,
                    passRate: sm.passRate,
                    weakCount: sm.weakCount,
                    evaluations: evaluationGroups(members).reduce((o,x)=>(o[x.label]=x.count,o),{}),
                    skills
                };
            }).filter(g => g.count);
            return { question: q, groups };
        }).filter(x => x.groups.length >= 2);
    }

    function histogram(students) {
        const bins = [
            ['0–9',0,10],['10–19',10,20],['20–29',20,30],['30–39',30,40],['40–49',40,50],
            ['50–59',50,60],['60–69',60,70],['70–79',70,80],['80–89',80,90],['90–100',90,101]
        ].map(([label,min,max]) => ({ label, min, max, count: 0 }));
        for (const b of bins) b.count = students.filter(s => s.percentage >= b.min && s.percentage < b.max).length;
        return bins;
    }

    function recommendations(students, qAnalytics, skills) {
        const out = [];
        const summary = summaryAnalytics(students);
        if (summary.pendingManualCount > 0) {
            out.push(`لا يزال ${fmtInt(summary.pendingManualCount)} تصحيحًا يدويًا معلّقًا لدى ${fmtInt(summary.studentsPendingManual)} مستجيب/مستجيبين؛ لا تعتمد التحليل النهائي قبل إكمال التصحيح في Forms.`);
        }
        const weak = qAnalytics.filter(q => Number.isFinite(q.mastery) && q.mastery < state.settings.weakQuestion);
        const critical = qAnalytics.filter(q => Number.isFinite(q.mastery) && q.mastery < state.settings.highPriorityQuestion);
        const suspicious = qAnalytics.filter(q => Number.isFinite(q.discrimination) && q.discrimination < 0.10);
        const misconceptions = qAnalytics.filter(q => q.topWrong && q.topWrong.percent >= 35);

        if (summary.weakCount) out.push(`يوجد ${fmtInt(summary.weakCount)} من أصل ${fmtInt(summary.count)} مستجيبًا أقل من ${fmtInt(state.settings.thresholds.acceptable)}% ويحتاجون متابعة.`);
        if (critical.length) out.push(`هناك ${fmtInt(critical.length)} سؤالًا بإتقان أقل من ${fmtInt(state.settings.highPriorityQuestion)}%؛ يوصى بإعطائها أولوية معالجة عالية.`);
        if (weak.length) out.push(`هناك ${fmtInt(weak.length)} سؤالًا بإتقان أقل من ${fmtInt(state.settings.weakQuestion)}%؛ وهي مواطن ضعف جماعية محتملة.`);
        if (misconceptions.length) out.push(`في ${fmtInt(misconceptions.length)} سؤالًا انجذب 35% أو أكثر من المستجيبين إلى مشتت خاطئ واحد؛ راجع المفهوم المرتبط بالمشتت.`);
        if (suspicious.length) out.push(`هناك ${fmtInt(suspicious.length)} سؤالًا بمعامل تمييز أقل من 0.10؛ يفضّل مراجعة صياغتها أو مفتاحها.`);
        if (skills.length) out.push(`أضعف مهارة معرفة حاليًا هي «${skills[0].skill}» بإتقان ${fmtPct(skills[0].mastery)}.`);
        if (!out.length) out.push('لا توجد إشارات حرجة وفق الحدود الحالية. راجع تحليل الأسئلة والمهارات للتفاصيل.');
        return out;
    }

    function currentAnalysis() {
        const students = selectedStudents();
        const summary = summaryAnalytics(students);
        const questions = questionAnalytics(students);
        const skills = skillAnalytics(students);
        const evaluations = evaluationGroups(students);
        const matrix = masteryMatrix(students);
        const interventions = interventionAnalytics(students);
        const distractors = distractorInsights(questions);
        const quality = testQualityAnalytics(students, questions, skills);
        return {
            students,
            summary,
            questions,
            skills,
            evaluations,
            matrix,
            interventions,
            distractors,
            quality,
            groups: groupComparisons(students),
            histogram: histogram(students),
            recommendations: recommendations(students, questions, skills)
        };
    }

    // ============================================================
    // Loading
    // ============================================================

    async function loadData(force = false) {
        if (state.loading || (state.loaded && !force)) return;
        state.loading = true;
        state.error = '';
        renderLoading();
        try {
            state.api = await discoverApi();
            const form = await fetchJSON(state.api.formUrl);
            const expectedRaw = Array.isArray(form?.responses) ? form.responses.length : (form?.responses ?? form?.rowCount ?? 0);
            const expected = num(expectedRaw, 0);
            const responses = await fetchResponses(state.api.base, expected);
            state.form = form;
            state.responses = responses;
            state.questions = parseQuestions(form);
            state.students = buildStudents(responses, state.questions);
            state.metadataQuestions = detectMetadataQuestions(state.questions, state.students);
            loadSkillMap();
            state.loaded = true;
            state.filters = {};
            state.search = '';
            toast(`تم تحليل ${fmtInt(state.students.length)} استجابة.`, 'success');
        } catch (err) {
            console.error(`[${APP.name}]`, err);
            state.error = String(err?.message || err);
            toast(state.error, 'error');
        } finally {
            state.loading = false;
            renderApp();
        }
    }

    // ============================================================
    // UI
    // ============================================================

    function ensureStyles() {
        if (document.getElementById('fsra-styles')) return;
        const t = theme();
        const style = document.createElement('style');
        style.id = 'fsra-styles';
        style.textContent = `
:root{--fsra-primary:${t.primary};--fsra-primary-dark:${t.dark};--fsra-primary-darker:${t.darker};--fsra-primary-light:${t.light};--fsra-primary-soft:${t.soft};--fsra-primary-softer:${t.softer};--fsra-primary-border:${t.border}}
#fsra-launcher{font-family:Segoe UI,Tahoma,Arial,sans-serif!important;direction:rtl;border:0;border-radius:10px;padding:9px 14px;margin-inline-start:10px;background:var(--fsra-primary);color:#fff;font-weight:700;cursor:pointer;box-shadow:0 2px 8px #0002;white-space:nowrap}
#fsra-launcher:hover{filter:brightness(1.06)}
#fsra-overlay{position:fixed;inset:0;z-index:2147483000;background:rgba(20,16,35,.48);font-family:Segoe UI,Tahoma,Arial,sans-serif;direction:rtl;color:#201a2b}
#fsra-overlay *{box-sizing:border-box}
.fsra-shell{position:absolute;inset:2.2vh 2vw;background:#f7f7f9;border-radius:18px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 24px 80px #0006}
.fsra-header{background:#fff;border-bottom:1px solid #e7e5ea;padding:14px 18px;display:flex;gap:12px;align-items:center;justify-content:space-between;box-shadow:inset 0 -3px 0 var(--fsra-primary)}
.fsra-title-wrap{min-width:0}.fsra-title{font-size:20px;font-weight:800;color:var(--fsra-primary-dark)}.fsra-subtitle{font-size:12px;color:#6d6577;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:68vw;margin-top:3px}
.fsra-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.fsra-btn{border:1px solid var(--fsra-primary-border);background:#fff;border-radius:9px;padding:8px 11px;cursor:pointer;font:inherit;font-weight:650;color:var(--fsra-primary-dark)}.fsra-btn:hover{background:var(--fsra-primary-softer)}.fsra-btn.primary{background:var(--fsra-primary);color:#fff;border-color:var(--fsra-primary)}.fsra-btn.primary:hover{filter:brightness(1.04)}.fsra-btn.danger{color:#a22323;border-color:#e6c7c7}.fsra-btn.small{padding:5px 8px;font-size:12px}.fsra-close{font-size:20px;line-height:1}
.fsra-credit{flex:0 0 auto;background:#fff;border-top:1px solid #e7e5ea;padding:7px 18px;text-align:center;font-size:10px;color:#81798a}.fsra-credit a{color:var(--fsra-primary);text-decoration:none;font-weight:800}.fsra-credit b{color:var(--fsra-primary-dark)}
.fsra-filterbar{background:#fff;border-bottom:1px solid #e7e5ea;padding:10px 18px;display:flex;gap:10px;align-items:end;flex-wrap:wrap}.fsra-field{display:flex;flex-direction:column;gap:4px;min-width:150px}.fsra-field label{font-size:11px;color:#6f6878;font-weight:700}.fsra-field input,.fsra-field select{border:1px solid #d8d5dc;border-radius:8px;padding:7px 9px;background:#fff;font:inherit;min-height:35px;outline:none}.fsra-field input:focus,.fsra-field select:focus{border-color:var(--fsra-primary);box-shadow:0 0 0 2px var(--fsra-primary-soft)}
.fsra-privacy{margin-inline-start:auto;display:flex;gap:7px;align-items:center;font-size:12px;font-weight:700;color:#5a5262}.fsra-privacy input{accent-color:var(--fsra-primary)}
.fsra-warning{margin:10px 18px 0;background:#fff4e5;border:1px solid #efc17e;border-right:5px solid #d47a00;color:#6b4200;border-radius:11px;padding:10px 13px;font-size:12px;line-height:1.65;font-weight:700}.fsra-warning strong{color:#8a4f00}
.fsra-tabs{display:flex;gap:3px;background:var(--fsra-primary-softer);padding:7px 12px;overflow:auto;border-bottom:1px solid var(--fsra-primary-light)}.fsra-tab{border:0;background:transparent;border-radius:8px;padding:8px 12px;cursor:pointer;font:inherit;font-weight:700;color:#655c70;white-space:nowrap}.fsra-tab:hover{background:#fff}.fsra-tab.active{background:#fff;color:var(--fsra-primary-dark);box-shadow:0 1px 4px #0001,inset 0 -3px 0 var(--fsra-primary)}
.fsra-content{padding:16px 18px;overflow:auto;flex:1}.fsra-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px}.fsra-card{background:#fff;border:1px solid #e8e6eb;border-radius:13px;padding:14px;box-shadow:0 1px 4px #0000000a}.fsra-kpi .label{font-size:12px;color:#746b7e;font-weight:700}.fsra-kpi .value{font-size:25px;font-weight:850;margin-top:5px;color:var(--fsra-primary-dark);font-variant-numeric:tabular-nums}.fsra-kpi .note{font-size:11px;color:#8a8292;margin-top:4px}.fsra-two{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}.fsra-section-title{font-size:15px;font-weight:850;color:var(--fsra-primary-dark);margin:0 0 10px}.fsra-muted{color:#81798a;font-size:12px}
.fsra-bar-row{display:grid;grid-template-columns:minmax(80px,140px) 1fr 55px;gap:8px;align-items:center;margin:7px 0;font-size:12px}.fsra-bar{height:10px;background:#eceaec;border-radius:999px;overflow:hidden}.fsra-fill{height:100%;background:linear-gradient(90deg,var(--fsra-primary),var(--fsra-primary-dark));border-radius:inherit}.fsra-fill.weak{background:linear-gradient(90deg,#cc4b4b,#9f2424)}.fsra-fill.ok{background:linear-gradient(90deg,var(--fsra-primary),var(--fsra-primary-dark))}
.fsra-hist{display:flex;align-items:flex-end;gap:6px;height:160px;padding-top:10px}.fsra-hcol{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;min-width:24px}.fsra-hbar{width:70%;background:var(--fsra-primary);border-radius:5px 5px 0 0;min-height:2px}.fsra-hnum{font-size:10px;color:#5e5666;margin-bottom:4px}.fsra-hlabel{font-size:9px;color:#726a7a;margin-top:4px;white-space:nowrap}
.fsra-table-wrap{background:#fff;border:1px solid #e8e6eb;border-radius:13px;overflow:auto}.fsra-table{width:100%;border-collapse:collapse;min-width:850px}.fsra-table th,.fsra-table td{border-bottom:1px solid #eeecef;padding:9px 10px;text-align:right;font-size:12px;vertical-align:top}.fsra-table th{background:var(--fsra-primary-softer);color:#554b60;font-weight:800;position:sticky;top:0;z-index:1;cursor:default}.fsra-table th[data-sort],.fsra-table th[data-sortq]{cursor:pointer}.fsra-table tr:hover td{background:var(--fsra-primary-softer)}.fsra-row-weak td{background:#fff8f8}
.fsra-pill{display:inline-flex;border-radius:999px;padding:3px 8px;font-size:11px;font-weight:800;background:var(--fsra-primary-soft);color:var(--fsra-primary-dark)}.fsra-pill.weak{background:#fde8e8;color:#9b2929}.fsra-pill.good{background:var(--fsra-primary-soft);color:var(--fsra-primary-dark)}.fsra-pill.warn{background:#fff0d7;color:#895c10}.fsra-score{font-weight:850;font-variant-numeric:tabular-nums}.fsra-qtitle{max-width:480px;line-height:1.55}.fsra-details{margin-top:8px;padding:12px;background:var(--fsra-primary-softer);border:1px solid var(--fsra-primary-light);border-radius:10px}.fsra-reco{display:flex;gap:8px;align-items:flex-start;padding:9px 10px;border-radius:9px;background:var(--fsra-primary-softer);border-right:3px solid var(--fsra-primary);margin:7px 0;font-size:12px;line-height:1.6}
.fsra-review-card{background:linear-gradient(135deg,var(--fsra-primary-dark),var(--fsra-primary));color:#fff;border-radius:14px;padding:16px;margin-bottom:12px}.fsra-review-card .big{font-size:18px;font-weight:850;margin-top:6px}.fsra-review-card .small{font-size:12px;opacity:.9}.fsra-empty{padding:34px;text-align:center;color:#756c7d}.fsra-error{background:#fff0f0;color:#912e2e;border:1px solid #f1caca;border-radius:10px;padding:14px}.fsra-loading{padding:50px;text-align:center;font-weight:800;color:var(--fsra-primary)}.fsra-spin{display:inline-block;width:24px;height:24px;border:3px solid var(--fsra-primary-light);border-top-color:var(--fsra-primary);border-radius:50%;animation:fsra-spin 1s linear infinite;vertical-align:middle;margin-left:8px}@keyframes fsra-spin{to{transform:rotate(360deg)}}
.fsra-form-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}.fsra-form-grid .fsra-field{min-width:0}.fsra-note{background:#fffbea;border:1px solid #efe2a7;color:#655219;border-radius:10px;padding:10px;font-size:12px;line-height:1.65}.fsra-skill-tools{display:flex;gap:8px;align-items:end;flex-wrap:wrap;margin-bottom:10px}.fsra-check{width:16px;height:16px;accent-color:var(--fsra-primary)}.fsra-delta-pos{color:#27763b;font-weight:800}.fsra-delta-neg{color:#a52b2b;font-weight:800}
.fsra-toast{position:fixed;z-index:2147483646;bottom:24px;left:24px;max-width:420px;padding:11px 14px;border-radius:10px;background:#30283a;color:#fff;box-shadow:0 10px 30px #0004;font-family:Segoe UI,Tahoma,Arial,sans-serif;direction:rtl}.fsra-toast-success{background:#276a3d}.fsra-toast-error{background:#9b2f2f}
.fsra-skill-input{width:100%;border:1px solid #d8d5dc;border-radius:8px;padding:7px 9px;background:#fff;font:inherit;outline:none}.fsra-skill-input:focus{border-color:var(--fsra-primary);box-shadow:0 0 0 2px var(--fsra-primary-soft)}
@media(max-width:900px){.fsra-shell{inset:0;border-radius:0}.fsra-two{grid-template-columns:1fr}.fsra-header{align-items:flex-start}.fsra-subtitle{max-width:55vw}.fsra-privacy{margin-inline-start:0}.fsra-filterbar{align-items:stretch}.fsra-field{flex:1 1 160px}}
        `;
        document.head.appendChild(style);
    }

    function launcherMount() {
        return document.querySelector('#AnalyzeSummaryTitleId_title')?.parentElement
            || Array.from(document.querySelectorAll('h1,h2,h3,[role="heading"]')).find(el => /نظرة عامة على الاستجابات|responses overview/i.test(clean(el.textContent)))?.parentElement
            || null;
    }

    function ensureLauncher() {
        ensureStyles();
        if (document.getElementById('fsra-launcher')) return;
        const parent = launcherMount();
        if (!parent) return;
        const btn = document.createElement('button');
        btn.id = 'fsra-launcher';
        btn.type = 'button';
        btn.textContent = '📊 التحليل الذكي';
        btn.title = 'فتح محلل نتائج Forms الذكي';
        btn.addEventListener('click', openApp);
        parent.appendChild(btn);
    }

    function openApp() {
        ensureStyles();
        if (state.overlay?.isConnected) {
            state.overlay.style.display = 'block';
            if (state.loaded) renderApp();
            return;
        }
        const overlay = document.createElement('div');
        overlay.id = 'fsra-overlay';
        overlay.innerHTML = `<div class="fsra-shell"><div class="fsra-loading"><span class="fsra-spin"></span> جاري تجهيز المحلل...</div></div>`;
        document.body.appendChild(overlay);
        state.overlay = overlay;
        bindEvents();
        loadData(false);
    }

    function closeApp() {
        if (state.overlay) state.overlay.style.display = 'none';
    }

    function renderLoading() {
        if (!state.overlay) return;
        state.overlay.innerHTML = `<div class="fsra-shell"><div class="fsra-loading"><span class="fsra-spin"></span> جاري قراءة بيانات النموذج والاستجابات...</div></div>`;
    }

    function filterBarHtml() {
        const selects = state.metadataQuestions.map(q => `
            <div class="fsra-field"><label>${esc(q.title)}</label><select data-filter-qid="${esc(q.id)}">
                <option value="">الكل</option>
                ${q.filterValues.map(v => `<option value="${esc(v)}" ${state.filters[q.id] === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}
            </select></div>`).join('');
        return `<div class="fsra-filterbar">${selects}
            <div class="fsra-field" style="min-width:220px"><label>بحث عن مستجيب</label><input data-role="student-search" value="${esc(state.search)}" placeholder="الاسم أو الحساب..."></div>
            <label class="fsra-privacy"><input type="checkbox" data-role="privacy-toggle" ${state.settings.privacy ? 'checked' : ''}> 👁️ وضع الخصوصية</label>
        </div>`;
    }

    function manualWarningHtml(summary) {
        if (!summary.manualQuestionCount || !summary.pendingManualCount) return '';
        return `<div class="fsra-warning">⚠️ <strong>تنبيه مهم:</strong> يحتوي هذا النموذج على ${fmtInt(summary.manualQuestionCount)} سؤال/أسئلة تحتاج تصحيحًا يدويًا. <strong>لا تستخدم التحليل النهائي إلا بعد الانتهاء من التصحيح اليدوي لجميع الاستجابات في Microsoft Forms.</strong> لا يزال ${fmtInt(summary.pendingManualCount)} تصحيحًا يدويًا معلّقًا لدى ${fmtInt(summary.studentsPendingManual)} مستجيب/مستجيبين.</div>`;
    }

    function tabsHtml() {
        const tabs = [
            ['overview','نظرة عامة'],['students','الطلاب'],['evaluations','التقديرات'],['questions','تحليل الأسئلة'],
            ['skills','المهارات'],['matrix','مصفوفة الإتقان'],['groups','الفصول والمجموعات'],
            ['interventions','التدخلات'],['quality','جودة الاختبار'],['compare','المقارنات'],
            ['reports','مركز التقارير'],['settings','الإعدادات']
        ];
        return `<div class="fsra-tabs">${tabs.map(([id,label]) => `<button class="fsra-tab ${state.activeTab === id ? 'active' : ''}" data-tab="${id}">${label}</button>`).join('')}</div>`;
    }

    function renderApp() {
        if (!state.overlay) return;
        if (state.error && !state.loaded) {
            state.overlay.innerHTML = `<div class="fsra-shell"><div class="fsra-header"><div class="fsra-title-wrap"><div class="fsra-title">${APP.arName}</div><div class="fsra-subtitle">الإصدار ${APP.version}</div></div><div class="fsra-actions"><button class="fsra-btn" data-action="about">عن السكربت</button><button class="fsra-btn" data-action="retry">إعادة المحاولة</button><button class="fsra-btn fsra-close" data-action="close">×</button></div></div><div class="fsra-content"><div class="fsra-error">${esc(state.error)}</div></div></div>`;
            return;
        }
        if (!state.loaded) return renderLoading();

        let a;
        try {
            a = currentAnalysis();
        } catch (err) {
            console.error(`[${APP.name}] render`, err);
            state.overlay.innerHTML = `<div class="fsra-shell"><div class="fsra-header"><div class="fsra-title">${APP.arName}</div><div class="fsra-actions"><button class="fsra-btn" data-action="refresh">↻ تحديث البيانات</button><button class="fsra-btn fsra-close" data-action="close">×</button></div></div><div class="fsra-content"><div class="fsra-error">تعذر إنشاء التحليل: ${esc(err?.message || err)}</div></div></div>`;
            return;
        }

        state.overlay.innerHTML = `<div class="fsra-shell">
            <div class="fsra-header"><div class="fsra-title-wrap"><div class="fsra-title">${APP.arName}</div><div class="fsra-subtitle">${esc(state.form?.title || document.title)} — ${fmtInt(a.students.length)} من ${fmtInt(state.students.length)} استجابة</div></div>
            <div class="fsra-actions"><button class="fsra-btn" data-action="about">عن السكربت</button><button class="fsra-btn" data-action="refresh">↻ تحديث البيانات</button><button class="fsra-btn primary" data-action="print-full">🖨️ التقرير الشامل</button><button class="fsra-btn fsra-close" data-action="close">×</button></div></div>
            ${filterBarHtml()}${manualWarningHtml(a.summary)}${tabsHtml()}
            <div class="fsra-content" id="fsra-content">${renderTab(a)}</div>
            <div class="fsra-credit">تصميم وتطوير: <b>${esc(DEV.name)} (${esc(DEV.handle)})</b> &nbsp;·&nbsp; <a href="${DEV.greasy}" target="_blank" rel="noopener">GreasyFork</a> &nbsp;·&nbsp; <a href="${DEV.x}" target="_blank" rel="noopener">X</a> &nbsp;·&nbsp; <a href="${DEV.snap}" target="_blank" rel="noopener">Snapchat</a> &nbsp;·&nbsp; © 2026 جميع الحقوق محفوظة.</div>
        </div>`;
    }

    function renderTab(a) {
        switch (state.activeTab) {
            case 'students': return renderStudents(a);
            case 'evaluations': return renderEvaluations(a);
            case 'questions': return renderQuestions(a);
            case 'skills': return renderSkills(a);
            case 'matrix': return renderMasteryMatrix(a);
            case 'groups': return renderGroups(a);
            case 'interventions': return renderInterventions(a);
            case 'quality': return renderQuality(a);
            case 'compare': return renderCompare(a);
            case 'reports': return renderReports(a);
            case 'settings': return renderSettings(a);
            default: return renderOverview(a);
        }
    }

    function kpi(label, value, note = '') {
        return `<div class="fsra-card fsra-kpi"><div class="label">${esc(label)}</div><div class="value">${esc(value)}</div><div class="note">${esc(note)}</div></div>`;
    }

    function reviewPriority(a) {
        if (a.skills.length) return { title: a.skills[0].skill, percent: a.skills[0].mastery, note: `${fmtInt(a.skills[0].questions)} سؤال/أسئلة مرتبطة بهذه المهارة.` };
        const q = Array.from(a.questions).filter(x => Number.isFinite(x.mastery)).sort((x, y) => x.mastery - y.mastery)[0];
        if (q) return {
            title: `السؤال ${fmtInt(q.question.number)}: ${q.question.title}`,
            percent: q.mastery,
            note: q.topWrong ? `أكثر مشتت خاطئ: ${q.topWrong.answer} (${fmtPct(q.topWrong.percent)})` : 'راجع مفهوم هذا السؤال.'
        };
        return { title: 'لا توجد بيانات كافية', percent: 0, note: '' };
    }

    function renderOverview(a) {
        const s = a.summary;
        const priority = reviewPriority(a);
        const maxEval = Math.max(1, maxValue(Object.values(s.evalCounts), 1));
        const maxHist = Math.max(1, maxValue(a.histogram.map(x => x.count), 1));
        const weakQs = Array.from(a.questions).filter(q => Number.isFinite(q.mastery) && q.mastery < state.settings.weakQuestion).sort((x,y)=>x.mastery-y.mastery).slice(0,8);
        const alphaText = Number.isFinite(s.alpha) ? fmtNum(s.alpha, 3) : '—';

        return `<div class="fsra-review-card"><div class="small">ماذا أراجع أولًا؟</div><div class="big">${esc(priority.title)}</div><div class="small">الإتقان: ${fmtPct(priority.percent)} — ${esc(priority.note)}</div></div>
        <div class="fsra-grid">
            ${kpi('المستجيبون', fmtInt(s.count), 'بعد تطبيق الفلاتر')}
            ${kpi('متوسط الدرجة', `${fmtNum(s.averageScore)}/${fmtNum(s.possible,0)}`, fmtPct(s.averagePercent))}
            ${kpi('الوسيط', fmtNum(s.medianScore), fmtPct(s.medianPercent))}
            ${kpi('أعلى / أدنى', `${fmtNum(s.maxScore,0)} / ${fmtNum(s.minScore,0)}`, 'بالدرجة')}
            ${kpi('نسبة الاجتياز', fmtPct(s.passRate), `الحد ${fmtInt(state.settings.thresholds.acceptable)}%`)}
            ${kpi('ضعيف', fmtInt(s.weakCount), `أقل من ${fmtInt(state.settings.thresholds.acceptable)}%`)}
            ${kpi('متوسط الزمن', fmtDuration(s.avgDuration), 'زمن الحل')}
            ${kpi('ثبات الاختبار α', alphaText, 'Cronbach’s Alpha')}
        </div>
        <div class="fsra-two"><div class="fsra-card"><h3 class="fsra-section-title">توزيع التقييمات</h3>${Object.entries(s.evalCounts).map(([label,count]) => `<div class="fsra-bar-row"><span>${esc(label)}</span><div class="fsra-bar"><div class="fsra-fill ${label==='ضعيف'?'weak':''}" style="width:${count/maxEval*100}%"></div></div><b>${fmtInt(count)}</b></div>`).join('')}</div>
        <div class="fsra-card"><h3 class="fsra-section-title">توزيع النسب</h3><div class="fsra-hist">${a.histogram.map(b => `<div class="fsra-hcol"><div class="fsra-hnum">${fmtInt(b.count)}</div><div class="fsra-hbar" style="height:${b.count/maxHist*120}px"></div><div class="fsra-hlabel">${b.label}</div></div>`).join('')}</div><div class="fsra-muted">الحد الفاصل للضعيف في الإعدادات الحالية: أقل من ${fmtInt(state.settings.thresholds.acceptable)}%.</div></div></div>
        <div class="fsra-two"><div class="fsra-card"><h3 class="fsra-section-title">أكثر الأسئلة حاجة للمعالجة</h3>${weakQs.length ? weakQs.map(q=>`<div class="fsra-bar-row"><span title="${esc(q.question.title)}">س${fmtInt(q.question.number)}</span><div class="fsra-bar"><div class="fsra-fill weak" style="width:${Math.max(2,q.mastery)}%"></div></div><b>${fmtPct(q.mastery,0)}</b></div>`).join('') : '<div class="fsra-muted">لا توجد أسئلة تحت الحد الحالي.</div>'}</div>
        <div class="fsra-card"><h3 class="fsra-section-title">قراءة سريعة وتوصيات</h3>${a.recommendations.map(x=>`<div class="fsra-reco">💡 <span>${esc(x)}</span></div>`).join('')}</div></div>
        ${renderGroupSummary(a.groups)}`;
    }

    function renderGroupSummary(groups) {
        if (!groups.length) return '';
        const first = groups[0];
        return `<div class="fsra-card" style="margin-top:12px"><h3 class="fsra-section-title">مقارنة حسب: ${esc(first.question.title)}</h3><div class="fsra-grid">${first.groups.map(g=>`<div><b>${esc(g.value)}</b><div class="fsra-muted">${fmtInt(g.count)} مستجيب — متوسط ${fmtPct(g.averagePercent)} — اجتياز ${fmtPct(g.passRate)}</div></div>`).join('')}</div></div>`;
    }

    function privateName(s, index) {
        return state.settings.privacy ? `مستجيب ${String(index + 1).padStart(2, '0')}` : s.name;
    }

    function sortStudents(arr) {
        const {key, dir} = state.studentSort;
        const m = dir === 'asc' ? 1 : -1;
        return Array.from(arr).sort((a,b)=>{
            const av=a[key], bv=b[key];
            if (typeof av === 'string') return av.localeCompare(String(bv),'ar')*m;
            return ((Number(av)||0)-(Number(bv)||0))*m;
        });
    }

    function metadataSummaryForStudent(s) {
        return state.metadataQuestions.map(q => (s.metadata[q.id] || []).join('، ')).filter(Boolean).join(' | ');
    }

    function renderStudents(a) {
        const rows = sortStudents(a.students);
        if (!rows.length) return '<div class="fsra-empty">لا توجد نتائج تطابق الفلاتر الحالية.</div>';
        return `<div class="fsra-table-wrap"><table class="fsra-table"><thead><tr><th>#</th><th data-sort="name">الاسم / الهوية</th><th>مصدر الهوية</th><th>بيانات وصفية</th><th data-sort="earned">الدرجة</th><th data-sort="percentage">النسبة</th><th>التقييم</th><th>التصحيح اليدوي</th><th data-sort="durationSeconds">الزمن</th><th>تقرير</th></tr></thead><tbody>
        ${rows.map((s,i)=>{const e=evaluation(s.percentage);return `<tr class="${e.key==='weak'?'fsra-row-weak':''}"><td>${fmtInt(i+1)}</td><td><b>${esc(privateName(s,i))}</b>${!state.settings.privacy&&s.responder?`<div class="fsra-muted">${esc(s.responder)}</div>`:''}</td><td>${esc(s.identitySource)}</td><td>${esc(metadataSummaryForStudent(s)||'—')}</td><td class="fsra-score">${fmtNum(s.earned,1)} / ${fmtNum(s.possible,1)}</td><td class="fsra-score">${fmtPct(s.percentage)}</td><td><span class="fsra-pill ${e.key==='weak'?'weak':e.key==='excellent'?'good':''}">${esc(e.label)}</span></td><td>${s.pendingManualCount?`<span class="fsra-pill warn">معلّق: ${fmtInt(s.pendingManualCount)}</span>`:'مكتمل'}</td><td>${fmtDuration(s.durationSeconds)}</td><td><button class="fsra-btn small" data-action="student-report" data-student-key="${esc(s.identityKey)}">📄</button></td></tr>`}).join('')}
        </tbody></table></div>`;
    }

    function sortedQuestions(a) {
        const {key,dir}=state.questionSort;
        const m=dir==='asc'?1:-1;
        return Array.from(a.questions).sort((x,y)=>{
            let av,bv;
            if(key==='number'){av=x.question.number;bv=y.question.number;}
            else if(key==='discrimination'){av=x.discrimination??-9;bv=y.discrimination??-9;}
            else if(key==='correlation'){av=x.itemTotalCorrelation??-9;bv=y.itemTotalCorrelation??-9;}
            else {av=Number.isFinite(x.mastery)?x.mastery:-1;bv=Number.isFinite(y.mastery)?y.mastery:-1;}
            return (av-bv)*m;
        });
    }

    function renderEvaluations(a) {
        const total = Math.max(1, a.students.length);
        return `<div class="fsra-grid">${a.evaluations.map(g=>kpi(g.label,fmtInt(g.count),`${fmtPct(g.percent)} من المستجيبين`)).join('')}</div>
        <div class="fsra-two">${a.evaluations.map(g=>`<div class="fsra-card"><h3 class="fsra-section-title">${esc(g.label)} — ${fmtInt(g.count)}</h3>${g.students.length?`<div class="fsra-table-wrap"><table class="fsra-table" style="min-width:560px"><thead><tr><th>#</th><th>الطالب</th><th>الدرجة</th><th>النسبة</th><th>الزمن</th></tr></thead><tbody>${g.students.map((s,i)=>`<tr><td>${fmtInt(i+1)}</td><td>${esc(privateName(s,i))}</td><td>${fmtNum(s.earned,1)} / ${fmtNum(s.possible,1)}</td><td><b>${fmtPct(s.percentage)}</b></td><td>${fmtDuration(s.durationSeconds)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="fsra-muted">لا يوجد مستجيبون في هذه الفئة.</div>'}</div>`).join('')}</div>`;
    }

    function masteryCellStyle(value) {
        if (!Number.isFinite(value)) return 'background:#f4f2f5;color:#877f8d';
        const a = state.settings.thresholds.acceptable;
        const g = state.settings.thresholds.good;
        const v = state.settings.thresholds.veryGood;
        if (value < a) return 'background:#fdeaea;color:#8e2525;font-weight:800';
        if (value < g) return 'background:#fff4d8;color:#7c5a12;font-weight:800';
        if (value < v) return 'background:#eef5e8;color:#45642f;font-weight:800';
        return 'background:var(--fsra-primary-soft);color:var(--fsra-primary-dark);font-weight:850';
    }

    function renderMasteryMatrix(a) {
        if (!a.matrix.skills.length) return '<div class="fsra-empty">لا توجد مهارات قابلة لبناء مصفوفة الإتقان. أضف المهارة في Subtitle للأسئلة أو اربطها يدويًا.</div>';
        const rows = Array.from(a.matrix.rows).sort((x,y)=>x.student.percentage-y.student.percentage);
        return `<div class="fsra-note" style="margin-bottom:10px">كل خلية تمثل إتقان الطالب لأسئلة المهارة. المهارة تؤخذ تلقائيًا من Subtitle، ويأخذ التعديل اليدوي الأولوية.</div><div class="fsra-table-wrap"><table class="fsra-table" style="min-width:${Math.max(900,360+a.matrix.skills.length*125)}px"><thead><tr><th>#</th><th style="min-width:180px">الطالب</th><th>النسبة العامة</th>${a.matrix.skills.map(s=>`<th style="min-width:120px">${esc(s)}</th>`).join('')}</tr></thead><tbody>${rows.map((r,i)=>`<tr><td>${fmtInt(i+1)}</td><td><b>${esc(privateName(r.student,i))}</b></td><td>${fmtPct(r.student.percentage)}</td>${a.matrix.skills.map(skill=>{const v=r.values[skill];return `<td style="${masteryCellStyle(v)}">${Number.isFinite(v)?fmtPct(v,0):'—'}</td>`}).join('')}</tr>`).join('')}</tbody></table></div>`;
    }

    function renderGroups(a) {
        if (!a.groups.length) return '<div class="fsra-empty">لم أجد سؤالًا وصفيًا بدرجة 0 يصلح لتقسيم المستجيبين إلى فصول/شعب/مجموعات. أضف مثلًا «الفصل» أو «الشعبة» كسؤال بدون درجات.</div>';
        return a.groups.map(group=>{
            const skills=Array.from(new Set(group.groups.flatMap(g=>g.skills.map(s=>s.skill)))).sort((x,y)=>x.localeCompare(y,'ar'));
            return `<div class="fsra-card" style="margin-bottom:12px"><h3 class="fsra-section-title">مقارنة حسب: ${esc(group.question.title)}</h3><div class="fsra-table-wrap"><table class="fsra-table"><thead><tr><th>المجموعة</th><th>العدد</th><th>المتوسط</th><th>الاجتياز</th><th>ضعيف</th><th>أضعف مهارة</th></tr></thead><tbody>${group.groups.map(g=>`<tr><td><b>${esc(g.value)}</b></td><td>${fmtInt(g.count)}</td><td>${fmtPct(g.averagePercent)}</td><td>${fmtPct(g.passRate)}</td><td>${fmtInt(g.weakCount)}</td><td>${g.skills.length?`${esc(g.skills[0].skill)} (${fmtPct(g.skills[0].mastery,0)})`:'—'}</td></tr>`).join('')}</tbody></table></div>${skills.length?`<h3 class="fsra-section-title" style="margin-top:14px">المهارات حسب المجموعة</h3><div class="fsra-table-wrap"><table class="fsra-table" style="min-width:${Math.max(850,220+skills.length*120)}px"><thead><tr><th>المجموعة</th>${skills.map(s=>`<th>${esc(s)}</th>`).join('')}</tr></thead><tbody>${group.groups.map(g=>`<tr><td><b>${esc(g.value)}</b></td>${skills.map(skill=>{const v=g.skills.find(s=>canon(s.skill)===canon(skill))?.mastery;return `<td style="${masteryCellStyle(v)}">${Number.isFinite(v)?fmtPct(v,0):'—'}</td>`}).join('')}</tr>`).join('')}</tbody></table></div>`:''}</div>`;
        }).join('');
    }

    function renderInterventions(a) {
        const counts = Object.fromEntries(a.interventions.groups.map(g=>[g.key,g.rows.length]));
        return `<div class="fsra-grid">${kpi('دعم عاجل',fmtInt(counts.urgent||0),`أقل من ${fmtInt(a.interventions.urgentCut)}%`)}${kpi('يحتاج دعم',fmtInt(counts.support||0),`حتى أقل من ${fmtInt(state.settings.thresholds.acceptable)}%`)}${kpi('متابعة',fmtInt(counts.monitor||0),`من ${fmtInt(state.settings.thresholds.acceptable)}% إلى أقل من ${fmtInt(state.settings.thresholds.good)}%`)}${kpi('متقن',fmtInt(counts.mastered||0),`من ${fmtInt(state.settings.thresholds.veryGood)}% فأعلى`)}</div>
        <div class="fsra-card" style="margin-top:12px"><h3 class="fsra-section-title">خطة المتابعة حسب المستجيب</h3><div class="fsra-table-wrap"><table class="fsra-table"><thead><tr><th>#</th><th>الطالب</th><th>الفئة</th><th>النسبة</th><th>أضعف المهارات</th><th>إجابات خاطئة</th><th>فارغ</th><th>تقرير</th></tr></thead><tbody>${a.interventions.rows.map((r,i)=>`<tr class="${r.key==='urgent'||r.key==='support'?'fsra-row-weak':''}"><td>${fmtInt(i+1)}</td><td><b>${esc(privateName(r.student,i))}</b></td><td><span class="fsra-pill ${r.key==='urgent'||r.key==='support'?'weak':r.key==='monitor'?'warn':'good'}">${esc(r.band)}</span></td><td><b>${fmtPct(r.student.percentage)}</b></td><td>${r.weakSkills.length?r.weakSkills.map(x=>`${esc(x.skill)} (${fmtPct(x.mastery,0)})`).join('، '):'—'}</td><td>${fmtInt(r.wrong)}</td><td>${fmtInt(r.blank)}</td><td><button class="fsra-btn small" data-action="student-report" data-student-key="${esc(r.student.identityKey)}">📄</button></td></tr>`).join('')}</tbody></table></div></div>`;
    }

    function renderQuality(a) {
        const q=a.quality;
        const top=a.distractors.slice(0,20);
        return `<div class="fsra-grid">${kpi('أسئلة محللة',fmtInt(q.questionCount),'ذات درجات')}${kpi('متوسط الإتقان',Number.isFinite(q.avgMastery)?fmtPct(q.avgMastery):'—','على مستوى الأسئلة')}${kpi('ثبات الاختبار α',Number.isFinite(q.alpha)?fmtNum(q.alpha,3):'—',q.alphaLabel)}${kpi('تمييز سالب',fmtInt(q.negativeDisc.length),'تحتاج مراجعة')}${kpi('تمييز ضعيف',fmtInt(q.weakDisc.length),'أقل من 0.20')}${kpi('إجابات فارغة',fmtPct(q.blankRate),'من فرص الإجابة')}${kpi('مهارات بسؤال واحد',fmtInt(q.oneQuestionSkills.length),'تغطية محدودة')}${kpi('أسئلة بلا مهارة',fmtInt(q.uncovered.length),'Subtitle/ربط يدوي')}</div>
        <div class="fsra-two"><div class="fsra-card"><h3 class="fsra-section-title">توزيع صعوبة الأسئلة</h3>${Object.entries(q.difficultyCounts).map(([label,count])=>`<div class="fsra-bar-row"><span>${esc(label)}</span><div class="fsra-bar"><div class="fsra-fill" style="width:${q.questionCount?count/q.questionCount*100:0}%"></div></div><b>${fmtInt(count)}</b></div>`).join('')||'<div class="fsra-muted">لا توجد بيانات.</div>'}</div><div class="fsra-card"><h3 class="fsra-section-title">إشارات تستحق المراجعة</h3>${q.signals.map(x=>`<div class="fsra-reco">🔎 <span>${esc(x)}</span></div>`).join('')}</div></div>
        <div class="fsra-card" style="margin-top:12px"><h3 class="fsra-section-title">أقوى المشتتات الخاطئة</h3>${top.length?`<div class="fsra-table-wrap"><table class="fsra-table"><thead><tr><th>#</th><th>السؤال</th><th>المهارة</th><th>المشتت</th><th>اختاره</th><th>النسبة</th><th>الصحيح</th></tr></thead><tbody>${top.map((d,i)=>`<tr class="${d.common?'fsra-row-weak':''}"><td>${fmtInt(i+1)}</td><td class="fsra-qtitle">س${fmtInt(d.question.number)}: ${esc(d.question.title)}</td><td>${esc(d.skill||'—')}</td><td><b>${esc(d.answer)}</b></td><td>${fmtInt(d.count)}</td><td>${fmtPct(d.percent)}</td><td>${esc(d.correctAnswer)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="fsra-muted">لا توجد مشتتات قابلة للتحليل.</div>'}</div>`;
    }

    function renderQuestions(a) {
        const rows=sortedQuestions(a);
        return `<div class="fsra-note" style="margin-bottom:10px">معامل التمييز يحسب فرق أداء أعلى 27% وأدنى 27% من المستجيبين. الأسئلة اليدوية تعتمد الدرجة التي منحها المعلم في Microsoft Forms.</div>
        <div class="fsra-table-wrap"><table class="fsra-table"><thead><tr><th data-sortq="number">#</th><th>السؤال</th><th>المهارة</th><th>التصحيح</th><th data-sortq="mastery">الإتقان</th><th>كامل</th><th>جزئي</th><th>صفر</th><th>فارغ</th><th>معلّق</th><th data-sortq="discrimination">التمييز D</th><th data-sortq="correlation">ارتباط السؤال</th><th>أقوى مشتت</th><th>تفاصيل</th></tr></thead><tbody>
        ${rows.map(q=>{const weak=Number.isFinite(q.mastery)&&q.mastery<state.settings.weakQuestion;return `<tr class="${weak?'fsra-row-weak':''}"><td>${fmtInt(q.question.number)}</td><td class="fsra-qtitle"><b>${esc(q.question.title)}</b><div class="fsra-muted">${q.question.answerKey.length?`الإجابة: ${esc(q.question.answerKey.join(' | '))}`:q.question.isManualQuestion?'يحتاج تصحيحًا يدويًا':'—'}</div></td><td>${esc(effectiveSkill(q.question)||'—')}<div class="fsra-muted">${esc(skillSource(q.question))}</div></td><td>${esc(q.gradingMode)}</td><td class="fsra-score">${Number.isFinite(q.mastery)?fmtPct(q.mastery):'—'}</td><td>${fmtInt(q.correct)}</td><td>${fmtInt(q.partial)}</td><td>${fmtInt(q.wrong)}</td><td>${fmtInt(q.blank)}</td><td>${q.pending?`<span class="fsra-pill warn">${fmtInt(q.pending)}</span>`:fmtInt(0)}</td><td><span class="fsra-pill ${Number.isFinite(q.discrimination)&&q.discrimination<.2?'warn':''}">${Number.isFinite(q.discrimination)?fmtNum(q.discrimination,2):'—'}</span><div class="fsra-muted">${esc(q.discriminationLabel)}</div></td><td>${Number.isFinite(q.itemTotalCorrelation)?fmtNum(q.itemTotalCorrelation,2):'—'}</td><td>${q.topWrong?`${esc(q.topWrong.answer)} <span class="fsra-muted">(${fmtPct(q.topWrong.percent)})</span>`:'—'}</td><td><button class="fsra-btn small" data-action="toggle-question" data-qid="${esc(q.question.id)}">${state.expandedQuestionId===q.question.id?'إخفاء':'عرض'}</button></td></tr>${state.expandedQuestionId===q.question.id?`<tr><td colspan="14">${renderQuestionDetails(q)}</td></tr>`:''}`}).join('')}
        </tbody></table></div>`;
    }

    function renderQuestionDetails(q) {
        if (!q.distribution.length) return `<div class="fsra-details"><b>تفاصيل السؤال</b><div class="fsra-muted">${q.question.isManualQuestion?'سؤال مصحح يدويًا؛ يعتمد التحليل على درجات Forms.':'لا توجد إجابات قابلة للتوزيع.'}</div></div>`;
        const max=Math.max(1,maxValue(q.distribution.map(x=>x.count),1));
        return `<div class="fsra-details"><b>توزيع الإجابات</b>${q.distribution.map(r=>`<div class="fsra-bar-row"><span>${r.correct?'✅ ':''}${esc(r.answer)}</span><div class="fsra-bar"><div class="fsra-fill ${r.correct?'ok':'weak'}" style="width:${r.count/max*100}%"></div></div><b>${fmtInt(r.count)}</b></div>`).join('')}</div>`;
    }

    function existingSkills() {
        return Array.from(new Set([
            ...Object.values(state.skillMap).map(clean),
            ...state.questions.map(q=>clean(q.subtitle))
        ].filter(Boolean))).sort((a,b)=>a.localeCompare(b,'ar'));
    }

    function renderSkills(a) {
        const autoCount=state.questions.filter(q=>q.points>0&&q.subtitle&&!state.skillMap[q.id]).length;
        const manualCount=state.questions.filter(q=>q.points>0&&state.skillMap[q.id]).length;
        return `<div class="fsra-note" style="margin-bottom:12px"><b>ربط تلقائي:</b> يقرأ المحلل المهارة من Subtitle للسؤال عند توفرها. يمكن تعديل أي مهارة يدويًا، والتعديل اليدوي يأخذ الأولوية. تلقائي: ${fmtInt(autoCount)} — تعديل يدوي: ${fmtInt(manualCount)}.</div>${a.skills.length?`<div class="fsra-card" style="margin-bottom:12px"><h3 class="fsra-section-title">إتقان المهارات</h3>${a.skills.map(x=>`<div class="fsra-bar-row"><span>${esc(x.skill)} <span class="fsra-muted">(${fmtInt(x.questions)} سؤال)</span></span><div class="fsra-bar"><div class="fsra-fill ${x.mastery<state.settings.weakQuestion?'weak':'ok'}" style="width:${x.mastery}%"></div></div><b>${fmtPct(x.mastery,0)}</b></div>`).join('')}</div>`:`<div class="fsra-note" style="margin-bottom:12px">لم أجد مهارات في Subtitle ولم تُربط الأسئلة يدويًا بعد.</div>`}
        <div class="fsra-card"><h3 class="fsra-section-title">مراجعة وربط الأسئلة بالمهارات</h3><div class="fsra-skill-tools"><div class="fsra-field"><label>اسم المهارة للتعيين الجماعي</label><input data-role="bulk-skill" list="fsra-skill-list" placeholder="مثال: الحلقات"></div><button class="fsra-btn" data-action="assign-skill">تعيين للمحدد</button><button class="fsra-btn" data-action="clear-skill-selection">إلغاء التحديد</button></div><datalist id="fsra-skill-list">${existingSkills().map(s=>`<option value="${esc(s)}"></option>`).join('')}</datalist>
        <div class="fsra-table-wrap"><table class="fsra-table"><thead><tr><th>تحديد</th><th>#</th><th>السؤال</th><th>المهارة الفعالة</th><th>المصدر</th></tr></thead><tbody>${state.questions.filter(q=>q.points>0).map(q=>`<tr><td><input class="fsra-check" type="checkbox" data-skill-select="${esc(q.id)}" ${state.selectedSkillQuestions.has(q.id)?'checked':''}></td><td>${fmtInt(q.number)}</td><td class="fsra-qtitle">${esc(q.title)}${q.subtitle?`<div class="fsra-muted">Subtitle: ${esc(q.subtitle)}</div>`:''}</td><td><input class="fsra-skill-input" data-skill-qid="${esc(q.id)}" list="fsra-skill-list" value="${esc(effectiveSkill(q))}" placeholder="غير مصنف"></td><td><span class="fsra-pill">${esc(skillSource(q)||'غير مصنف')}</span></td></tr>`).join('')}</tbody></table></div></div>`;
    }

    function createSnapshot(a) {
        const filterText = state.metadataQuestions.map(q => state.filters[q.id] ? `${q.title}: ${state.filters[q.id]}` : '').filter(Boolean).join(' | ');
        return {
            id:`snap_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
            version:APP.version,
            savedAt:new Date().toISOString(),formId:getFormId(),title:clean(state.form?.title||document.title),filterText,
            summary:{count:a.summary.count,possible:a.summary.possible,averagePercent:round(a.summary.averagePercent,3),passRate:round(a.summary.passRate,3),weakCount:a.summary.weakCount,evalCounts:a.summary.evalCounts},
            students:a.students.slice(0,5000).map(s=>({identityKey:s.identityKey,name:s.name,percentage:round(s.percentage,3),evaluation:evaluation(s.percentage).label})),
            questions:a.questions.map(q=>({key:canon(q.question.title),title:q.question.title,mastery:round(q.mastery??0,3),skill:effectiveSkill(q.question)})),
            skills:a.skills.map(s=>({skill:s.skill,mastery:round(s.mastery,3),questions:s.questions})),
            groups:a.groups.map(g=>({question:g.question.title,groups:g.groups.map(x=>({value:x.value,count:x.count,averagePercent:round(x.averagePercent,3),passRate:round(x.passRate,3)}))}))
        };
    }

    function compareWithSnapshot(a,snap) {
        if(!snap)return null;
        const studentMap=new Map((snap.students||[]).map(s=>[s.identityKey,s]));
        const studentDeltas=a.students.filter(s=>studentMap.has(s.identityKey)&&!s.identityKey.startsWith('anon:')).map(s=>({name:s.name,before:studentMap.get(s.identityKey).percentage,now:s.percentage,delta:s.percentage-studentMap.get(s.identityKey).percentage})).sort((x,y)=>y.delta-x.delta);
        const qMap=new Map((snap.questions||[]).map(q=>[q.key,q]));
        const questionDeltas=a.questions.filter(q=>qMap.has(canon(q.question.title))&&Number.isFinite(q.mastery)).map(q=>{const old=qMap.get(canon(q.question.title));return{title:q.question.title,before:old.mastery,now:q.mastery,delta:q.mastery-old.mastery}}).sort((x,y)=>y.delta-x.delta);
        const skillMap=new Map((snap.skills||[]).map(s=>[canon(s.skill),s]));
        const skillDeltas=a.skills.filter(s=>skillMap.has(canon(s.skill))).map(s=>{const old=skillMap.get(canon(s.skill));return{skill:s.skill,before:old.mastery,now:s.mastery,delta:s.mastery-old.mastery}}).sort((x,y)=>y.delta-x.delta);
        const oldEval=snap.summary?.evalCounts||{};
        const evaluationDeltas=a.evaluations.map(g=>({label:g.label,before:Number(oldEval[g.label]||0),now:g.count,delta:g.count-Number(oldEval[g.label]||0)}));
        return {averageDelta:a.summary.averagePercent-(snap.summary?.averagePercent||0),passDelta:a.summary.passRate-(snap.summary?.passRate||0),countDelta:a.summary.count-(snap.summary?.count||0),studentDeltas,questionDeltas,skillDeltas,evaluationDeltas};
    }

    function deltaHtml(value) {
        const cls=value>0?'fsra-delta-pos':value<0?'fsra-delta-neg':'';
        return `<span class="${cls}">${value>0?'+':''}${fmtPct(value)}</span>`;
    }

    function renderCompare(a) {
        const snaps=getSnapshots();
        const selected=snaps.find(s=>s.id===state.compareSnapshotId)||null;
        const cmp=compareWithSnapshot(a,selected);
        return `<div class="fsra-card" style="margin-bottom:12px"><h3 class="fsra-section-title">لقطات الاختبارات والمقارنة القبلية/البعدية</h3><div class="fsra-actions" style="justify-content:flex-start"><button class="fsra-btn primary" data-action="save-snapshot">💾 حفظ لقطة للنتيجة الحالية</button><select data-role="snapshot-select" style="min-width:280px;padding:8px;border-radius:8px;border:1px solid #d8d1e1"><option value="">اختر لقطة للمقارنة...</option>${snaps.slice().reverse().map(s=>`<option value="${esc(s.id)}" ${selected?.id===s.id?'selected':''}>${esc(s.title)} — ${fmtDateTime(s.savedAt)}${s.filterText?` — ${esc(s.filterText)}`:''}</option>`).join('')}</select>${selected?'<button class="fsra-btn danger" data-action="delete-snapshot">حذف اللقطة</button>':''}</div><div class="fsra-muted" style="margin-top:8px">يمكن استخدام اللقطات لمقارنة اختبار قبلي وبعدي أو نفس الاختبار في أوقات/فلاتر مختلفة. تُحفظ محليًا فقط.</div></div>
        ${!selected?'<div class="fsra-empty">احفظ لقطة أو اختر لقطة سابقة لعرض المقارنة.</div>':`<div class="fsra-grid">${kpi('تغير المتوسط',`${cmp.averageDelta>0?'+':''}${fmtPct(cmp.averageDelta)}`,`${fmtPct(selected.summary.averagePercent)} ← ${fmtPct(a.summary.averagePercent)}`)}${kpi('تغير الاجتياز',`${cmp.passDelta>0?'+':''}${fmtPct(cmp.passDelta)}`,`${fmtPct(selected.summary.passRate)} ← ${fmtPct(a.summary.passRate)}`)}${kpi('تغير العدد',`${cmp.countDelta>0?'+':''}${fmtInt(cmp.countDelta)}`,`${fmtInt(selected.summary.count)} ← ${fmtInt(a.summary.count)}`)}${kpi('مطابقة أفراد',fmtInt(cmp.studentDeltas.length),'حسابات/أسماء مشتركة')}</div>
        <div class="fsra-two"><div class="fsra-card"><h3 class="fsra-section-title">تغير أداء المستجيبين</h3>${cmp.studentDeltas.length?`<div class="fsra-table-wrap"><table class="fsra-table"><thead><tr><th>الاسم</th><th>السابق</th><th>الحالي</th><th>التغير</th></tr></thead><tbody>${cmp.studentDeltas.slice(0,100).map(x=>`<tr><td>${esc(state.settings.privacy?'مستجيب':x.name)}</td><td>${fmtPct(x.before)}</td><td>${fmtPct(x.now)}</td><td>${deltaHtml(x.delta)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="fsra-muted">لا توجد هويات مشتركة قابلة للمطابقة.</div>'}</div>
        <div class="fsra-card"><h3 class="fsra-section-title">تغير التقديرات بالعدد</h3>${cmp.evaluationDeltas.map(x=>`<div class="fsra-bar-row"><span>${esc(x.label)}</span><div class="fsra-muted">${fmtInt(x.before)} ← ${fmtInt(x.now)}</div><b>${x.delta>0?'+':''}${fmtInt(x.delta)}</b></div>`).join('')}</div></div>
        <div class="fsra-two"><div class="fsra-card"><h3 class="fsra-section-title">تغير إتقان الأسئلة المشتركة</h3>${cmp.questionDeltas.length?`<div class="fsra-table-wrap"><table class="fsra-table"><thead><tr><th>السؤال</th><th>السابق</th><th>الحالي</th><th>التغير</th></tr></thead><tbody>${cmp.questionDeltas.slice(0,100).map(x=>`<tr><td class="fsra-qtitle">${esc(x.title)}</td><td>${fmtPct(x.before)}</td><td>${fmtPct(x.now)}</td><td>${deltaHtml(x.delta)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="fsra-muted">لا توجد أسئلة متطابقة بالعناوين.</div>'}</div>
        <div class="fsra-card"><h3 class="fsra-section-title">تغير المهارات</h3>${cmp.skillDeltas.length?`<div class="fsra-table-wrap"><table class="fsra-table"><thead><tr><th>المهارة</th><th>السابق</th><th>الحالي</th><th>التغير</th></tr></thead><tbody>${cmp.skillDeltas.map(x=>`<tr><td>${esc(x.skill)}</td><td>${fmtPct(x.before)}</td><td>${fmtPct(x.now)}</td><td>${deltaHtml(x.delta)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="fsra-muted">لا توجد مهارات مشتركة قابلة للمقارنة.</div>'}</div></div>`}`;
    }

    function renderReports(a) {
        return `<div class="fsra-note" style="margin-bottom:12px">كل التقارير تُبنى من نفس بيانات Microsoft Forms والفلاتر الحالية. افتح التقرير ثم استخدم الطباعة للحفظ PDF عند الحاجة.</div><div class="fsra-grid">
        <div class="fsra-card"><h3 class="fsra-section-title">🏫 التقرير التنفيذي</h3><p class="fsra-muted">صفحة مركزة للإدارة: المتوسط، الاجتياز، التقديرات، أضعف المهارات والأسئلة والتوصيات.</p><button class="fsra-btn primary" data-action="report-executive">فتح التقرير</button></div>
        <div class="fsra-card"><h3 class="fsra-section-title">🏅 تقرير التقديرات</h3><p class="fsra-muted">ممتاز / جيد جدًا / جيد / مقبول / ضعيف مع أسماء أفراد كل فئة.</p><button class="fsra-btn" data-action="report-evaluations">فتح التقرير</button></div>
        <div class="fsra-card"><h3 class="fsra-section-title">🛟 تقرير التدخلات</h3><p class="fsra-muted">الطلاب بحسب أولوية الدعم مع أضعف المهارات والأسئلة الخاطئة والفارغة.</p><button class="fsra-btn" data-action="report-interventions">فتح التقرير</button></div>
        <div class="fsra-card"><h3 class="fsra-section-title">🎯 مصفوفة الإتقان</h3><p class="fsra-muted">الطالب × المهارة لعرض مواطن القوة والاحتياج في جدول واحد.</p><button class="fsra-btn" data-action="report-mastery">فتح التقرير</button></div>
        <div class="fsra-card"><h3 class="fsra-section-title">🧪 جودة الاختبار</h3><p class="fsra-muted">الصعوبة، التمييز، الثبات، التغطية المهارية، الإجابات الفارغة والمشتتات.</p><button class="fsra-btn" data-action="report-quality">فتح التقرير</button></div>
        <div class="fsra-card"><h3 class="fsra-section-title">👥 تقرير الفصول والمجموعات</h3><p class="fsra-muted">مقارنة الصفوف/الشعب/المجموعات ومتوسطاتها وإتقان المهارات.</p><button class="fsra-btn" data-action="report-groups">فتح التقرير</button></div>
        <div class="fsra-card"><h3 class="fsra-section-title">🖨️ التقرير الشامل</h3><p class="fsra-muted">ملخص تنفيذي + تقديرات + مجموعات + مهارات + تدخلات + جودة + أسئلة.</p><button class="fsra-btn primary" data-action="print-full">فتح المعاينة</button> <button class="fsra-btn" data-action="print-full-direct">طباعة مباشرة</button></div>
        <div class="fsra-card"><h3 class="fsra-section-title">🔒 تقرير شامل بدون أسماء</h3><p class="fsra-muted">نسخة مناسبة للمشاركة تخفي أسماء وحسابات المستجيبين.</p><button class="fsra-btn" data-action="print-private">فتح التقرير</button> <button class="fsra-btn" data-action="print-private-direct">طباعة مباشرة</button></div>
        <div class="fsra-card"><h3 class="fsra-section-title">📊 Excel متعدد الأوراق</h3><p class="fsra-muted">ملخص، مستجيبون، تقديرات، أسئلة، مهارات، مصفوفة، تدخلات، جودة، مشتتات، مجموعات.</p><button class="fsra-btn" data-action="export-excel">تصدير Excel XML</button></div>
        <div class="fsra-card"><h3 class="fsra-section-title">📄 CSV</h3><p class="fsra-muted">جدول المستجيبين الحالي مع النسب والتقييم والبيانات الوصفية.</p><button class="fsra-btn" data-action="export-csv">تصدير CSV</button></div>
        </div>`;
    }

    function settingInput(label,role,value,type='text') {
        return `<div class="fsra-field"><label>${esc(label)}</label><input type="${type}" data-setting="${role}" value="${esc(value)}" ${type==='number'?'min="0" max="100" step="1"':''}></div>`;
    }

    function renderSettings() {
        const t=state.settings.thresholds,r=state.settings.report;
        return `<div class="fsra-card"><h3 class="fsra-section-title">حدود التقييم</h3><div class="fsra-note" style="margin-bottom:10px">الإعداد الافتراضي يجعل «ضعيف» أقل من 50%.</div><div class="fsra-form-grid">${settingInput('حد ممتاز','threshold-excellent',t.excellent,'number')}${settingInput('حد جيد جدًا','threshold-verygood',t.veryGood,'number')}${settingInput('حد جيد','threshold-good',t.good,'number')}${settingInput('حد مقبول (وما دونه ضعيف)','threshold-acceptable',t.acceptable,'number')}${settingInput('سؤال ضعيف إذا كان الإتقان أقل من','weak-question',state.settings.weakQuestion,'number')}${settingInput('أولوية عالية إذا كان الإتقان أقل من','critical-question',state.settings.highPriorityQuestion,'number')}</div></div>
        <div class="fsra-card" style="margin-top:12px"><h3 class="fsra-section-title">رأس التقرير</h3><div class="fsra-form-grid">${settingInput('اسم المدرسة','report-school',r.school)}${settingInput('اسم المعلم/ة','report-teacher',r.teacher)}${settingInput('المادة','report-subject',r.subject)}${settingInput('الصف/المرحلة','report-grade',r.grade)}</div></div>
        <div class="fsra-actions" style="justify-content:flex-start;margin-top:12px"><button class="fsra-btn primary" data-action="save-settings">حفظ الإعدادات</button><button class="fsra-btn" data-action="reset-settings">استعادة الافتراضي</button></div>`;
    }

    // ============================================================
    // Reports
    // ============================================================

    function aboutScript() {
        alert(`${APP.arName} v${APP.version}\nتصميم وتطوير: ${DEV.name} (${DEV.handle})\nX / Twitter: @${DEV.handle}\nSnapchat: ${DEV.handle}\nGreasyFork: ${DEV.greasy}\n© 2026 Mohammed Almalki (M0HM3D85) — جميع الحقوق محفوظة.`);
    }

    function developerFooterHtml() {
        return `<div class="footer">تصميم وتطوير: <b>${esc(DEV.name)} (${esc(DEV.handle)})</b> — © 2026 جميع الحقوق محفوظة.<br>GreasyFork: ${esc(DEV.greasy)} — X: @${esc(DEV.handle)} — Snapchat: ${esc(DEV.handle)}</div>`;
    }

    function openHtmlReport(html,title='تقرير تحليل النتائج') {
        try {
            const blob=new Blob([html],{type:'text/html;charset=utf-8'});
            const url=URL.createObjectURL(blob);
            const w=window.open(url,'_blank');
            if(!w){URL.revokeObjectURL(url);toast('المتصفح منع فتح التقرير. اسمح بالنوافذ المنبثقة لهذه الصفحة.','error');return null;}
            setTimeout(()=>URL.revokeObjectURL(url),60000);
            try{w.document.title=title;}catch(_){}
            return w;
        }catch(err){console.error(`[${APP.name}] report`,err);toast('تعذر فتح التقرير.','error');return null;}
    }

    async function printHtmlReport(html) {
        const frame=document.createElement('iframe');
        Object.assign(frame.style,{position:'fixed',left:'-10000px',top:'0',width:'1px',height:'1px',opacity:'0',border:'0'});
        document.body.appendChild(frame);
        try{
            const doc=frame.contentDocument;doc.open();doc.write(html);doc.close();await sleep(350);frame.contentWindow.focus();frame.contentWindow.print();
        }catch(err){console.error(`[${APP.name}] print`,err);toast('تعذر تشغيل الطباعة.','error');}
        finally{setTimeout(()=>frame.remove(),60000);}
    }

    function currentFilterDescription() {
        const parts=state.metadataQuestions.map(q=>state.filters[q.id]?`${q.title}: ${state.filters[q.id]}`:'').filter(Boolean);
        if(state.search)parts.push(`بحث: ${state.search}`);
        return parts.join(' — ')||'جميع الاستجابات';
    }

    function reportCss() {
        const t=theme();
        return `@page{size:A4;margin:12mm}*{box-sizing:border-box}body{font-family:Tahoma,Arial,sans-serif;direction:rtl;color:#222;margin:0;font-size:11px;line-height:1.55;background:#fff;font-variant-numeric:tabular-nums}.toolbar{position:sticky;top:0;background:${t.dark};color:white;padding:10px 14px;display:flex;gap:8px;z-index:5}.report{max-width:190mm;margin:0 auto;padding:4mm 0}.header{border-bottom:3px solid ${t.primary};padding:8px 0 12px;margin-bottom:14px}.header h1{margin:0;color:${t.dark};font-size:22px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:3px 16px;margin-top:8px}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin:12px 0}.kpi{border:1px solid ${t.border};border-radius:8px;padding:8px;background:${t.softer}}.kpi b{display:block;font-size:17px;color:${t.dark}}.section{margin:16px 0;break-inside:avoid}.section h2{font-size:15px;color:${t.dark};border-bottom:1px solid ${t.border};padding-bottom:5px}.barrow{display:grid;grid-template-columns:130px 1fr 45px;gap:6px;align-items:center;margin:5px 0}.bar{height:8px;background:#eee;border-radius:9px;overflow:hidden}.fill{height:100%;background:${t.primary}}.fill.weak{background:#b93636}table{width:100%;border-collapse:collapse;margin-top:7px}th,td{border:1px solid #ddd;padding:5px 6px;text-align:right;vertical-align:top}th{background:${t.soft};color:${t.dark}}.weakrow td{background:#fff4f4}.page{break-before:page}.note{background:${t.softer};border-right:3px solid ${t.primary};padding:7px;border-radius:6px;margin:5px 0}.warnnote{background:#fff4e5;border-right:4px solid #d47a00;color:#6b4200;font-weight:700}.footer{margin-top:20px;border-top:1px solid ${t.border};padding-top:7px;color:#777;font-size:9px}.footer b{color:${t.dark}}@media print{.toolbar{display:none}.report{max-width:none;padding:0}}`;
    }

    function reportHeaderHtml(a,anonymize,title='تقرير تحليل نتائج الاختبار') {
        const r=state.settings.report;
        return `<div class="header"><h1>${esc(title)}</h1><div><b>${esc(state.form?.title||document.title)}</b></div><div class="meta">${r.school?`<div><b>المدرسة:</b> ${esc(r.school)}</div>`:''}${r.teacher?`<div><b>المعلم/ة:</b> ${esc(r.teacher)}</div>`:''}${r.subject?`<div><b>المادة:</b> ${esc(r.subject)}</div>`:''}${r.grade?`<div><b>الصف/المرحلة:</b> ${esc(r.grade)}</div>`:''}<div><b>النطاق:</b> ${esc(currentFilterDescription())}</div><div><b>تاريخ التقرير:</b> ${fmtDateTime(new Date())}</div><div><b>الهوية:</b> ${anonymize?'مخفية':'ظاهرة عند توفرها'}</div></div></div>`;
    }

    function reportDoc(a,title,body,anonymize=false) {
        return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${reportCss()}</style></head><body><div class="toolbar">تقرير جاهز — استخدم Ctrl+P أو أمر الطباعة في المتصفح للحفظ PDF.</div><div class="report">${reportHeaderHtml(a,anonymize,title)}${body}${developerFooterHtml()}</div></body></html>`;
    }

    function evaluationsReportBody(a,anonymize=false) {
        return `<div class="section"><h2>توزيع التقديرات</h2><table><thead><tr><th>التقدير</th><th>العدد</th><th>النسبة</th></tr></thead><tbody>${a.evaluations.map(g=>`<tr><td><b>${esc(g.label)}</b></td><td>${fmtInt(g.count)}</td><td>${fmtPct(g.percent)}</td></tr>`).join('')}</tbody></table></div>${a.evaluations.map(g=>`<div class="section"><h2>${esc(g.label)} — ${fmtInt(g.count)}</h2>${g.students.length?`<table><thead><tr><th>#</th><th>الطالب</th><th>الدرجة</th><th>النسبة</th><th>الزمن</th></tr></thead><tbody>${g.students.map((s,i)=>`<tr><td>${fmtInt(i+1)}</td><td>${esc(anonymize?`مستجيب ${i+1}`:s.name)}</td><td>${fmtNum(s.earned,1)}/${fmtNum(s.possible,1)}</td><td>${fmtPct(s.percentage)}</td><td>${fmtDuration(s.durationSeconds)}</td></tr>`).join('')}</tbody></table>`:'<div>لا يوجد مستجيبون.</div>'}</div>`).join('')}`;
    }

    function interventionsReportBody(a,anonymize=false) {
        return `<div class="section"><h2>تصنيف التدخلات</h2><table><thead><tr><th>الفئة</th><th>العدد</th></tr></thead><tbody>${a.interventions.groups.map(g=>`<tr><td>${esc(g.label)}</td><td>${fmtInt(g.rows.length)}</td></tr>`).join('')}</tbody></table></div><div class="section"><h2>تفاصيل المستجيبين</h2><table><thead><tr><th>#</th><th>الطالب</th><th>الفئة</th><th>النسبة</th><th>أضعف المهارات</th><th>خاطئ</th><th>فارغ</th></tr></thead><tbody>${a.interventions.rows.map((r,i)=>`<tr class="${r.key==='urgent'||r.key==='support'?'weakrow':''}"><td>${fmtInt(i+1)}</td><td>${esc(anonymize?`مستجيب ${i+1}`:r.student.name)}</td><td>${esc(r.band)}</td><td>${fmtPct(r.student.percentage)}</td><td>${r.weakSkills.length?r.weakSkills.map(x=>`${esc(x.skill)} (${fmtPct(x.mastery,0)})`).join('، '):'—'}</td><td>${fmtInt(r.wrong)}</td><td>${fmtInt(r.blank)}</td></tr>`).join('')}</tbody></table></div>`;
    }

    function masteryReportBody(a,anonymize=false) {
        if(!a.matrix.skills.length)return '<div class="section"><h2>مصفوفة الإتقان</h2><div>لا توجد مهارات مصنفة.</div></div>';
        return `<div class="section"><h2>مصفوفة الطالب × المهارة</h2><table><thead><tr><th>#</th><th>الطالب</th><th>النسبة العامة</th>${a.matrix.skills.map(s=>`<th>${esc(s)}</th>`).join('')}</tr></thead><tbody>${a.matrix.rows.map((r,i)=>`<tr><td>${fmtInt(i+1)}</td><td>${esc(anonymize?`مستجيب ${i+1}`:r.student.name)}</td><td>${fmtPct(r.student.percentage)}</td>${a.matrix.skills.map(skill=>`<td>${Number.isFinite(r.values[skill])?fmtPct(r.values[skill],0):'—'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    }

    function qualityReportBody(a) {
        const q=a.quality;
        return `<div class="kpis"><div class="kpi"><span>أسئلة محللة</span><b>${fmtInt(q.questionCount)}</b></div><div class="kpi"><span>متوسط الإتقان</span><b>${Number.isFinite(q.avgMastery)?fmtPct(q.avgMastery):'—'}</b></div><div class="kpi"><span>ثبات α</span><b>${Number.isFinite(q.alpha)?fmtNum(q.alpha,3):'—'}</b><small>${esc(q.alphaLabel)}</small></div><div class="kpi"><span>تمييز سالب</span><b>${fmtInt(q.negativeDisc.length)}</b></div><div class="kpi"><span>تمييز ضعيف</span><b>${fmtInt(q.weakDisc.length)}</b></div><div class="kpi"><span>الإجابات الفارغة</span><b>${fmtPct(q.blankRate)}</b></div><div class="kpi"><span>مهارة بسؤال واحد</span><b>${fmtInt(q.oneQuestionSkills.length)}</b></div><div class="kpi"><span>أسئلة بلا مهارة</span><b>${fmtInt(q.uncovered.length)}</b></div></div><div class="section"><h2>إشارات تستحق المراجعة</h2>${q.signals.map(x=>`<div class="note">${esc(x)}</div>`).join('')}</div><div class="section"><h2>أقوى المشتتات الخاطئة</h2>${a.distractors.length?`<table><thead><tr><th>#</th><th>السؤال</th><th>المهارة</th><th>المشتت</th><th>العدد</th><th>النسبة</th><th>الصحيح</th></tr></thead><tbody>${a.distractors.slice(0,50).map((d,i)=>`<tr class="${d.common?'weakrow':''}"><td>${fmtInt(i+1)}</td><td>س${fmtInt(d.question.number)}: ${esc(d.question.title)}</td><td>${esc(d.skill||'—')}</td><td>${esc(d.answer)}</td><td>${fmtInt(d.count)}</td><td>${fmtPct(d.percent)}</td><td>${esc(d.correctAnswer)}</td></tr>`).join('')}</tbody></table>`:'<div>لا توجد مشتتات قابلة للتحليل.</div>'}</div>`;
    }

    function groupsReportBody(a) {
        if(!a.groups.length)return '<div class="section"><h2>المجموعات</h2><div>لا توجد بيانات وصفية قابلة للمقارنة.</div></div>';
        return a.groups.map(g=>`<div class="section"><h2>مقارنة حسب: ${esc(g.question.title)}</h2><table><thead><tr><th>المجموعة</th><th>العدد</th><th>المتوسط</th><th>الاجتياز</th><th>ضعيف</th><th>أضعف مهارة</th></tr></thead><tbody>${g.groups.map(x=>`<tr><td>${esc(x.value)}</td><td>${fmtInt(x.count)}</td><td>${fmtPct(x.averagePercent)}</td><td>${fmtPct(x.passRate)}</td><td>${fmtInt(x.weakCount)}</td><td>${x.skills.length?`${esc(x.skills[0].skill)} (${fmtPct(x.skills[0].mastery,0)})`:'—'}</td></tr>`).join('')}</tbody></table></div>`).join('');
    }

    function buildExecutiveReport(a,anonymize=false) {
        const s=a.summary;
        const weakSkills=a.skills.slice(0,5);
        const weakQs=Array.from(a.questions).filter(q=>Number.isFinite(q.mastery)).sort((x,y)=>x.mastery-y.mastery).slice(0,5);
        const body=`<div class="kpis"><div class="kpi"><span>المستجيبون</span><b>${fmtInt(s.count)}</b></div><div class="kpi"><span>المتوسط</span><b>${fmtPct(s.averagePercent)}</b></div><div class="kpi"><span>الاجتياز</span><b>${fmtPct(s.passRate)}</b></div><div class="kpi"><span>ضعيف</span><b>${fmtInt(s.weakCount)}</b></div></div><div class="section"><h2>التقديرات</h2><table><thead><tr><th>التقدير</th><th>العدد</th><th>النسبة</th></tr></thead><tbody>${a.evaluations.map(g=>`<tr><td>${esc(g.label)}</td><td>${fmtInt(g.count)}</td><td>${fmtPct(g.percent)}</td></tr>`).join('')}</tbody></table></div>${weakSkills.length?`<div class="section"><h2>أضعف المهارات</h2><table><thead><tr><th>المهارة</th><th>الأسئلة</th><th>الإتقان</th></tr></thead><tbody>${weakSkills.map(x=>`<tr class="${x.mastery<state.settings.weakQuestion?'weakrow':''}"><td>${esc(x.skill)}</td><td>${fmtInt(x.questions)}</td><td>${fmtPct(x.mastery)}</td></tr>`).join('')}</tbody></table></div>`:''}<div class="section"><h2>أسئلة ذات أولوية للمراجعة</h2><table><thead><tr><th>#</th><th>السؤال</th><th>الإتقان</th><th>التمييز</th></tr></thead><tbody>${weakQs.map(x=>`<tr><td>${fmtInt(x.question.number)}</td><td>${esc(x.question.title)}</td><td>${fmtPct(x.mastery)}</td><td>${Number.isFinite(x.discrimination)?fmtNum(x.discrimination,2):'—'}</td></tr>`).join('')}</tbody></table></div><div class="section"><h2>التوصيات</h2>${a.recommendations.map(x=>`<div class="note">${esc(x)}</div>`).join('')}</div>`;
        return reportDoc(a,'التقرير التنفيذي لنتائج الاختبار',body,anonymize);
    }

    function buildFullReport(a,anonymize=false) {
        const s=a.summary;
        const qRows=Array.from(a.questions).sort((x,y)=>(x.mastery??999)-(y.mastery??999));
        const body=`${s.manualQuestionCount&&s.pendingManualCount?`<div class="note warnnote">⚠️ يحتوي النموذج على ${fmtInt(s.pendingManualCount)} تصحيحًا يدويًا معلقًا؛ لا تعتمد القراءة النهائية قبل إكمالها.</div>`:''}<div class="kpis"><div class="kpi"><span>المستجيبون</span><b>${fmtInt(s.count)}</b></div><div class="kpi"><span>متوسط الدرجة</span><b>${fmtNum(s.averageScore)}/${fmtNum(s.possible,0)}</b><small>${fmtPct(s.averagePercent)}</small></div><div class="kpi"><span>نسبة الاجتياز</span><b>${fmtPct(s.passRate)}</b></div><div class="kpi"><span>ثبات α</span><b>${Number.isFinite(s.alpha)?fmtNum(s.alpha,3):'—'}</b></div></div><div class="section"><h2>الملخص التنفيذي والتوصيات</h2>${a.recommendations.map(x=>`<div class="note">${esc(x)}</div>`).join('')}</div>${evaluationsReportBody(a,anonymize)}${a.skills.length?`<div class="section"><h2>تحليل المهارات</h2><table><thead><tr><th>المهارة</th><th>عدد الأسئلة</th><th>الإتقان</th></tr></thead><tbody>${a.skills.map(x=>`<tr class="${x.mastery<state.settings.weakQuestion?'weakrow':''}"><td>${esc(x.skill)}</td><td>${fmtInt(x.questions)}</td><td>${fmtPct(x.mastery)}</td></tr>`).join('')}</tbody></table></div>`:''}${groupsReportBody(a)}${interventionsReportBody(a,anonymize)}${qualityReportBody(a)}<div class="section page"><h2>تحليل الأسئلة</h2><table><thead><tr><th>#</th><th>السؤال</th><th>المهارة</th><th>التصحيح</th><th>الإتقان</th><th>كامل</th><th>جزئي</th><th>صفر</th><th>فارغ</th><th>التمييز D</th><th>أقوى مشتت</th></tr></thead><tbody>${qRows.map(q=>`<tr class="${Number.isFinite(q.mastery)&&q.mastery<state.settings.weakQuestion?'weakrow':''}"><td>${fmtInt(q.question.number)}</td><td>${esc(q.question.title)}</td><td>${esc(effectiveSkill(q.question)||'—')}</td><td>${esc(q.gradingMode)}</td><td>${Number.isFinite(q.mastery)?fmtPct(q.mastery):'—'}</td><td>${fmtInt(q.correct)}</td><td>${fmtInt(q.partial)}</td><td>${fmtInt(q.wrong)}</td><td>${fmtInt(q.blank)}</td><td>${Number.isFinite(q.discrimination)?fmtNum(q.discrimination,2):'—'}</td><td>${q.topWrong?`${esc(q.topWrong.answer)} (${fmtPct(q.topWrong.percent)})`:'—'}</td></tr>`).join('')}</tbody></table></div>`;
        return reportDoc(a,anonymize?'تقرير تحليل النتائج — بدون أسماء':'تقرير تحليل النتائج الشامل',body,anonymize);
    }

    function openNamedReport(kind) {
        const a=currentAnalysis();
        const anonymize=state.settings.privacy;
        let html='',title='تقرير';
        if(kind==='executive'){title='التقرير التنفيذي';html=buildExecutiveReport(a,anonymize);}
        else if(kind==='evaluations'){title='تقرير التقديرات';html=reportDoc(a,title,evaluationsReportBody(a,anonymize),anonymize);}
        else if(kind==='interventions'){title='تقرير التدخلات';html=reportDoc(a,title,interventionsReportBody(a,anonymize),anonymize);}
        else if(kind==='mastery'){title='مصفوفة الإتقان';html=reportDoc(a,title,masteryReportBody(a,anonymize),anonymize);}
        else if(kind==='quality'){title='تقرير جودة الاختبار';html=reportDoc(a,title,qualityReportBody(a),true);}
        else if(kind==='groups'){title='تقرير الفصول والمجموعات';html=reportDoc(a,title,groupsReportBody(a),true);}
        if(html) openHtmlReport(html,title);
    }

    function openPrintReport(anonymize=false) {
        const a=currentAnalysis();
        openHtmlReport(buildFullReport(a,anonymize),anonymize?'تقرير تحليل النتائج — بدون أسماء':'تقرير تحليل النتائج');
    }

    function openStudentReport(student) {
        const questions=student.details.filter(d=>d.points>0);
        const needsReview=questions.filter(d=>d.status==='wrong'||d.status==='blank'||d.status==='pending'||d.status==='partial');
        const skillRows=studentWeakSkills(student,999);
        const weakSkills=skillRows.filter(x=>x.mastery<state.settings.thresholds.acceptable);
        const name=state.settings.privacy?'مستجيب':student.name;
        const body=`${student.pendingManualCount?`<div class="note warnnote">⚠️ هذا التقرير غير نهائي: لدى هذا المستجيب ${fmtInt(student.pendingManualCount)} سؤال/أسئلة بانتظار التصحيح اليدوي في Microsoft Forms.</div>`:''}<div class="kpis"><div class="kpi"><span>الدرجة</span><b>${fmtNum(student.earned,1)}/${fmtNum(student.possible,1)}</b></div><div class="kpi"><span>النسبة</span><b>${fmtPct(student.percentage)}</b></div><div class="kpi"><span>التقدير</span><b>${esc(evaluation(student.percentage).label)}</b></div><div class="kpi"><span>زمن الحل</span><b>${fmtDuration(student.durationSeconds)}</b></div></div>${skillRows.length?`<div class="section"><h2>إتقان المهارات</h2><table><thead><tr><th>المهارة</th><th>الإتقان</th><th>الحالة</th></tr></thead><tbody>${skillRows.map(x=>`<tr class="${x.mastery<state.settings.thresholds.acceptable?'weakrow':''}"><td>${esc(x.skill)}</td><td>${fmtPct(x.mastery)}</td><td>${x.mastery<state.settings.thresholds.acceptable?'يحتاج مراجعة':'مناسب'}</td></tr>`).join('')}</tbody></table></div>`:''}${weakSkills.length?`<div class="section"><h2>أولويات المراجعة</h2>${weakSkills.slice(0,5).map(x=>`<div class="note">${esc(x.skill)} — إتقان ${fmtPct(x.mastery)}</div>`).join('')}</div>`:''}<div class="section"><h2>الأسئلة التي تحتاج مراجعة</h2>${needsReview.length?`<table><thead><tr><th>#</th><th>السؤال</th><th>المهارة</th><th>إجابة المستجيب</th><th>الحالة / الدرجة</th></tr></thead><tbody>${needsReview.map(d=>{const q=state.questions.find(x=>x.id===d.questionId);return `<tr><td>${fmtInt(d.number)}</td><td>${esc(d.title)}</td><td>${esc(effectiveSkill(q)||'—')}</td><td>${esc(d.values.join(' | ')||'بدون إجابة')}</td><td>${d.gradingSource==='manual'?`درجة Forms: ${fmtNum(Number(d.earned),1)} / ${fmtNum(Number(d.possible),1)}`:d.status==='pending'?'بانتظار التصحيح في Forms':d.answerKey.length?esc(d.answerKey.join(' | ')):'—'}</td></tr>`}).join('')}</tbody></table>`:'<div>لم تُسجل أسئلة تحتاج مراجعة.</div>'}</div>`;
        const html=reportDoc(currentAnalysis(),`تقرير أداء فردي — ${name}`,body,state.settings.privacy);
        openHtmlReport(html,`تقرير أداء فردي — ${name}`);
    }

    // ============================================================
    // Exports
    // ============================================================

    function exportCsv(a) {
        const metaHeaders=state.metadataQuestions.map(q=>q.title);
        const headers=['الاسم','الحساب','مصدر الهوية','الدرجة','من','النسبة','التقييم','زمن الحل','تصحيح يدوي معلّق',...metaHeaders];
        const rows=a.students.map((s,i)=>[
            state.settings.privacy?`مستجيب ${String(i+1).padStart(2,'0')}`:s.name,
            state.settings.privacy?'':s.responder,s.identitySource,
            Number(round(s.earned,2)),Number(round(s.possible,2)),Number(round(s.percentage,2)),evaluation(s.percentage).label,fmtDuration(s.durationSeconds),s.pendingManualCount,
            ...state.metadataQuestions.map(q=>(s.metadata[q.id]||[]).join(' | '))
        ]);
        const csvCell=v=>`"${westernDigits(String(v??'')).replace(/"/g,'""')}"`;
        const csv='\uFEFF'+[headers,...rows].map(r=>r.map(csvCell).join(',')).join('\r\n');
        downloadBlob(`${slug(state.form?.title)} - الطلاب.csv`,new Blob([csv],{type:'text/csv;charset=utf-8'}));
    }

    function spreadsheetCell(value) {
        const n=Number(value);
        const isNumber=value!==''&&value!=null&&Number.isFinite(n)&&typeof value!=='boolean';
        return `<Cell><Data ss:Type="${isNumber?'Number':'String'}">${xmlEsc(isNumber?n:westernDigits(String(value??'')))}</Data></Cell>`;
    }

    function worksheet(name,rows) {
        return `<Worksheet ss:Name="${xmlEsc(name.slice(0,31))}"><Table>${rows.map(r=>`<Row>${r.map(spreadsheetCell).join('')}</Row>`).join('')}</Table></Worksheet>`;
    }

    function exportExcel(a) {
        const summaryRows=[['المؤشر','القيمة'],['اسم الاختبار',state.form?.title||''],['النطاق',currentFilterDescription()],['عدد المستجيبين',a.summary.count],['الدرجة الكلية',a.summary.possible],['متوسط الدرجة',round(a.summary.averageScore,2)],['متوسط النسبة',round(a.summary.averagePercent,2)],['الوسيط',round(a.summary.medianScore,2)],['أعلى درجة',a.summary.maxScore],['أدنى درجة',a.summary.minScore],['الانحراف المعياري',round(a.summary.stdDevScore,3)],['نسبة الاجتياز',round(a.summary.passRate,2)],['عدد الضعيف',a.summary.weakCount],['أسئلة يدوية',a.summary.manualQuestionCount],['تصحيحات يدوية معلقة',a.summary.pendingManualCount],['Cronbach Alpha',Number.isFinite(a.summary.alpha)?round(a.summary.alpha,4):''],['وصف Alpha',a.quality.alphaLabel],['معدل الإجابات الفارغة',round(a.quality.blankRate,2)]];
        const metaHeaders=state.metadataQuestions.map(q=>q.title);
        const studentRows=[['الاسم','الحساب','مصدر الهوية','الدرجة','من','النسبة','التقييم','الزمن','تصحيح يدوي معلّق',...metaHeaders],...a.students.map((s,i)=>[state.settings.privacy?`مستجيب ${i+1}`:s.name,state.settings.privacy?'':s.responder,s.identitySource,s.earned,s.possible,round(s.percentage,2),evaluation(s.percentage).label,fmtDuration(s.durationSeconds),s.pendingManualCount,...state.metadataQuestions.map(q=>(s.metadata[q.id]||[]).join(' | '))])];
        const evalRows=[['التقدير','العدد','النسبة'],...a.evaluations.map(g=>[g.label,g.count,round(g.percent,2)])];
        const questionRows=[['#','السؤال','المهارة','مصدر المهارة','طريقة التصحيح','الإجابة الصحيحة','الإتقان','كامل','جزئي','صفر','فارغ','معلّق','الصعوبة','التمييز D','ارتباط السؤال','أقوى مشتت خاطئ','نسبة المشتت'],...a.questions.map(q=>[q.question.number,q.question.title,effectiveSkill(q.question),skillSource(q.question),q.gradingMode,q.question.answerKey.join(' | '),Number.isFinite(q.mastery)?round(q.mastery,2):'',q.correct,q.partial,q.wrong,q.blank,q.pending,q.difficulty,Number.isFinite(q.discrimination)?round(q.discrimination,4):'',Number.isFinite(q.itemTotalCorrelation)?round(q.itemTotalCorrelation,4):'',q.topWrong?.answer||'',q.topWrong?round(q.topWrong.percent,2):''])];
        const skillRows=[['المهارة','عدد الأسئلة','الإتقان'],...a.skills.map(s=>[s.skill,s.questions,round(s.mastery,2)])];
        const matrixRows=[['الاسم','النسبة العامة',...a.matrix.skills],...a.matrix.rows.map((r,i)=>[state.settings.privacy?`مستجيب ${i+1}`:r.student.name,round(r.student.percentage,2),...a.matrix.skills.map(skill=>Number.isFinite(r.values[skill])?round(r.values[skill],2):'')])];
        const interventionRows=[['الاسم','الفئة','النسبة','أضعف المهارات','خاطئ','فارغ'],...a.interventions.rows.map((r,i)=>[state.settings.privacy?`مستجيب ${i+1}`:r.student.name,r.band,round(r.student.percentage,2),r.weakSkills.map(x=>`${x.skill} (${round(x.mastery,1)}%)`).join(' | '),r.wrong,r.blank])];
        const qualityRows=[['المؤشر','القيمة'],['عدد الأسئلة المحللة',a.quality.questionCount],['متوسط الإتقان',Number.isFinite(a.quality.avgMastery)?round(a.quality.avgMastery,2):''],['Cronbach Alpha',Number.isFinite(a.quality.alpha)?round(a.quality.alpha,4):''],['وصف Alpha',a.quality.alphaLabel],['تمييز سالب',a.quality.negativeDisc.length],['تمييز ضعيف',a.quality.weakDisc.length],['معدل الإجابات الفارغة',round(a.quality.blankRate,2)],['مهارات بسؤال واحد',a.quality.oneQuestionSkills.length],['أسئلة بلا مهارة',a.quality.uncovered.length],['إشارات',a.quality.signals.join(' | ')]];
        const distractorRows=[['# السؤال','السؤال','المهارة','المشتت الخاطئ','العدد','النسبة','الإجابة الصحيحة'],...a.distractors.map(d=>[d.question.number,d.question.title,d.skill,d.answer,d.count,round(d.percent,2),d.correctAnswer])];
        const groupRows=[['متغير التجميع','المجموعة','العدد','المتوسط','الاجتياز','ضعيف','أضعف مهارة'],...a.groups.flatMap(g=>g.groups.map(x=>[g.question.title,x.value,x.count,round(x.averagePercent,2),round(x.passRate,2),x.weakCount,x.skills.length?`${x.skills[0].skill} (${round(x.skills[0].mastery,1)}%)`:'']))];
        const xml=`<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">${worksheet('ملخص',summaryRows)}${worksheet('المستجيبون',studentRows)}${worksheet('التقديرات',evalRows)}${worksheet('الأسئلة',questionRows)}${worksheet('المهارات',skillRows)}${worksheet('مصفوفة المهارات',matrixRows)}${worksheet('التدخلات',interventionRows)}${worksheet('جودة الاختبار',qualityRows)}${worksheet('المشتتات',distractorRows)}${worksheet('المجموعات',groupRows)}</Workbook>`;
        downloadBlob(`${slug(state.form?.title)} - تحليل النتائج.xml`,new Blob(['\uFEFF'+xml],{type:'application/vnd.ms-excel;charset=utf-8'}));
    }

    // ============================================================
    // Events
    // ============================================================

    function bindEvents() {
        state.overlay.addEventListener('click', async e => {
            const tab=e.target.closest('[data-tab]');
            if(tab){state.activeTab=tab.dataset.tab;state.expandedQuestionId='';renderApp();return;}
            const actionEl=e.target.closest('[data-action]');
            if(!actionEl)return;
            const action=actionEl.dataset.action;
            if(action==='about')return aboutScript();
            if(action==='print-full-direct')return printHtmlReport(buildFullReport(currentAnalysis(),false));
            if(action==='print-private-direct')return printHtmlReport(buildFullReport(currentAnalysis(),true));
            if(action==='report-executive')return openNamedReport('executive');
            if(action==='report-evaluations')return openNamedReport('evaluations');
            if(action==='report-interventions')return openNamedReport('interventions');
            if(action==='report-mastery')return openNamedReport('mastery');
            if(action==='report-quality')return openNamedReport('quality');
            if(action==='report-groups')return openNamedReport('groups');
            if(action==='close')return closeApp();
            if(action==='retry'||action==='refresh')return loadData(true);
            if(action==='print-full')return openPrintReport(false);
            if(action==='print-private')return openPrintReport(true);
            if(action==='export-csv')return exportCsv(currentAnalysis());
            if(action==='export-excel')return exportExcel(currentAnalysis());
            if(action==='toggle-question'){state.expandedQuestionId=state.expandedQuestionId===actionEl.dataset.qid?'':actionEl.dataset.qid;renderApp();return;}
            if(action==='student-report'){const s=state.students.find(x=>x.identityKey===actionEl.dataset.studentKey);if(s)openStudentReport(s);return;}
            if(action==='assign-skill'){
                const input=state.overlay.querySelector('[data-role="bulk-skill"]');const skill=clean(input?.value||'');
                if(!skill)return toast('اكتب اسم المهارة أولًا.','error');
                if(!state.selectedSkillQuestions.size)return toast('حدد سؤالًا واحدًا على الأقل.','error');
                for(const qid of state.selectedSkillQuestions)state.skillMap[qid]=skill;
                saveSkillMap();state.selectedSkillQuestions.clear();toast('تم تعيين المهارة.','success');renderApp();return;
            }
            if(action==='clear-skill-selection'){state.selectedSkillQuestions.clear();renderApp();return;}
            if(action==='save-snapshot'){
                try{const snaps=getSnapshots();const snap=createSnapshot(currentAnalysis());snaps.push(snap);setSnapshots(snaps);state.compareSnapshotId=snap.id;toast('تم حفظ اللقطة محليًا.','success');renderApp();}
                catch(err){toast('تعذر حفظ اللقطة؛ قد تكون مساحة التخزين المحلية ممتلئة.','error');}
                return;
            }
            if(action==='delete-snapshot'){
                if(!state.compareSnapshotId)return;
                setSnapshots(getSnapshots().filter(s=>s.id!==state.compareSnapshotId));state.compareSnapshotId='';renderApp();toast('تم حذف اللقطة.','success');return;
            }
            if(action==='save-settings')return saveSettingsFromUi();
            if(action==='reset-settings'){state.settings=JSON.parse(JSON.stringify(DEFAULT_SETTINGS));saveSettings();renderApp();toast('تمت استعادة الإعدادات الافتراضية.','success');return;}
        });

        state.overlay.addEventListener('change', e => {
            const filter=e.target.closest('[data-filter-qid]');
            if(filter){state.filters[filter.dataset.filterQid]=filter.value;renderApp();return;}
            if(e.target.matches('[data-role="privacy-toggle"]')){state.settings.privacy=e.target.checked;saveSettings();renderApp();return;}
            if(e.target.matches('[data-skill-qid]')){const qid=e.target.dataset.skillQid;const skill=clean(e.target.value);const q=state.questions.find(x=>x.id===qid);if(skill&&canon(skill)!==canon(q?.subtitle||''))state.skillMap[qid]=skill;else delete state.skillMap[qid];saveSkillMap();renderApp();return;}
            if(e.target.matches('[data-skill-select]')){const qid=e.target.dataset.skillSelect;if(e.target.checked)state.selectedSkillQuestions.add(qid);else state.selectedSkillQuestions.delete(qid);return;}
            if(e.target.matches('[data-role="snapshot-select"]')){state.compareSnapshotId=e.target.value;renderApp();return;}
        });

        let searchTimer=null;
        state.overlay.addEventListener('input',e=>{
            if(e.target.matches('[data-role="student-search"]')){clearTimeout(searchTimer);searchTimer=setTimeout(()=>{state.search=e.target.value;renderApp();},250);}
        });

        state.overlay.addEventListener('click',e=>{
            const th=e.target.closest('th[data-sort]');
            if(th){const key=th.dataset.sort;state.studentSort={key,dir:state.studentSort.key===key&&state.studentSort.dir==='desc'?'asc':'desc'};renderApp();}
            const qth=e.target.closest('th[data-sortq]');
            if(qth){const key=qth.dataset.sortq;state.questionSort={key,dir:state.questionSort.key===key&&state.questionSort.dir==='asc'?'desc':'asc'};renderApp();}
        });
    }

    function saveSettingsFromUi() {
        const get=role=>state.overlay.querySelector(`[data-setting="${role}"]`)?.value??'';
        const excellent=num(get('threshold-excellent'),90),veryGood=num(get('threshold-verygood'),80),good=num(get('threshold-good'),70),acceptable=num(get('threshold-acceptable'),50);
        if(!(excellent>veryGood&&veryGood>good&&good>acceptable&&acceptable>=0&&excellent<=100))return toast('يجب أن تكون الحدود مرتبة: ممتاز > جيد جدًا > جيد > مقبول، وكلها بين 0 و100.','error');
        state.settings.thresholds={excellent,veryGood,good,acceptable};
        state.settings.weakQuestion=num(get('weak-question'),50);state.settings.highPriorityQuestion=num(get('critical-question'),30);
        state.settings.report={school:clean(get('report-school')),teacher:clean(get('report-teacher')),subject:clean(get('report-subject')),grade:clean(get('report-grade'))};
        saveSettings();renderApp();toast('تم حفظ الإعدادات.','success');
    }

    // ============================================================
    // Boot
    // ============================================================

    const observer=new MutationObserver(()=>ensureLauncher());
    observer.observe(document.documentElement,{childList:true,subtree:true});
    ensureLauncher();
    setInterval(ensureLauncher,2500);

    window.FormsSmartResultsAnalyzer={
        open:openApp,
        refresh:()=>loadData(true),
        version:APP.version,
        developer:DEV.handle
    };

    console.log(`${APP.arName} v${APP.version} | ${DEV.name} (${DEV.handle})`);
})();

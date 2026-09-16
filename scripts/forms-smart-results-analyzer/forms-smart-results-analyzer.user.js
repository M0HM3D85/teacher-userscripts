// ==UserScript==
// @name         Forms Smart Results Analyzer | محلل نتائج فورمز الذكي
// @namespace    https://greasyfork.org/users/1636459
// @version      0.1.9
// @description  تحليل شامل لنتائج اختبارات Microsoft Forms: درجات، تقييمات، أسئلة، مشتتات، تمييز، ثبات، مهارات، فلاتر، تقارير، طباعة، مقارنة وتصدير.
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
// ==/UserScript==

/*
 Forms Smart Results Analyzer | محلل نتائج فورمز الذكي
 تصميم وتطوير: Mohammed Almalki (M0HM3D85)
 GreasyFork  : https://greasyfork.org/en/users/1636459-m0hm3d85
 GitHub      : https://github.com/M0HM3D85/teacher-userscripts
 X / Twitter : https://x.com/M0HM3D85
 Snapchat    : https://www.snapchat.com/add/M0HM3D85
 © 2026 Mohammed Almalki (M0HM3D85) — جميع الحقوق محفوظة.
*/

(() => {
    'use strict';

    const APP = {
        id: 'fsra',
        name: 'Forms Smart Results Analyzer',
        arName: 'محلل نتائج فورمز الذكي',
        version: '0.1.9'
    };

    const DEV = Object.freeze({
        name: 'Mohammed Almalki',
        handle: 'M0HM3D85',
        website: 'https://greasyfork.org/en/users/1636459-m0hm3d85',
        greasy: 'https://greasyfork.org/en/users/1636459-m0hm3d85',
        github: 'https://github.com/M0HM3D85/teacher-userscripts',
        support: 'https://github.com/M0HM3D85/teacher-userscripts/issues',
        x: 'https://x.com/M0HM3D85',
        snapchat: 'https://www.snapchat.com/add/M0HM3D85',
        snap: 'https://www.snapchat.com/add/M0HM3D85',
        copyright: '© 2026 Mohammed Almalki (M0HM3D85) — جميع الحقوق محفوظة.'
    });

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
        return String(value ?? '')
            .replace(/\s+/g, ' ')
            .trim();
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
        try { return JSON.parse(value); }
        catch (_) { return null; }
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
        return arr.reduce((a, b) => a + (Number(b) || 0), 0);
    }

    // آمن مع عشرات/مئات آلاف القيم؛ لا يستخدم spread مع Math.min/Math.max.
    function minValue(values, fallback = 0) {
        let found = false;
        let min = Infinity;
        for (const value of values || []) {
            const n = Number(value);
            if (!Number.isFinite(n)) continue;
            if (n < min) min = n;
            found = true;
        }
        return found ? min : fallback;
    }

    function maxValue(values, fallback = 0) {
        let found = false;
        let max = -Infinity;
        for (const value of values || []) {
            const n = Number(value);
            if (!Number.isFinite(n)) continue;
            if (n > max) max = n;
            found = true;
        }
        return found ? max : fallback;
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

    function pearson(xs, ys) {
        if (xs.length !== ys.length || xs.length < 3) return null;
        const mx = mean(xs), my = mean(ys);
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

    function fmtPct(value, digits = 1) {
        return Number.isFinite(value) ? `${value.toFixed(digits)}%` : '—';
    }

    function fmtNum(value, digits = 2) {
        if (!Number.isFinite(value)) return '—';
        return Number(value.toFixed(digits)).toLocaleString('ar-SA');
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
            return structuredClone(DEFAULT_SETTINGS);
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
            state.skillMap = JSON.parse(
                localStorage.getItem(STORAGE.skillMapPrefix + getFormId()) || '{}'
            );
        } catch (_) {
            state.skillMap = {};
        }
    }

    function saveSkillMap() {
        localStorage.setItem(
            STORAGE.skillMapPrefix + getFormId(),
            JSON.stringify(state.skillMap)
        );
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
        const old = document.getElementById('fsra-toast');
        if (old) old.remove();
        const el = document.createElement('div');
        el.id = 'fsra-toast';
        el.className = `fsra-toast fsra-toast-${type}`;
        el.textContent = message;
        document.body.appendChild(el);
        clearTimeout(state.toastTimer);
        state.toastTimer = setTimeout(() => el.remove(), 3200);
    }

    // ============================================================
    // Forms theme — يلتقط اللون السائد من صفحة Microsoft Forms
    // ============================================================

    const FORMS_PRIMARY_COLOR = '#61958F';
    let cachedTheme = null;

    function clamp(v, min = 0, max = 255) {
        return Math.max(min, Math.min(max, v));
    }

    function rgbParts(value) {
        const s = String(value || '').trim();
        if (!s || s === 'transparent' || s === 'rgba(0, 0, 0, 0)') return null;

        if (/^#[0-9a-f]{6}$/i.test(s)) {
            return {
                r: parseInt(s.slice(1, 3), 16),
                g: parseInt(s.slice(3, 5), 16),
                b: parseInt(s.slice(5, 7), 16)
            };
        }

        if (/^#[0-9a-f]{3}$/i.test(s)) {
            return {
                r: parseInt(s[1] + s[1], 16),
                g: parseInt(s[2] + s[2], 16),
                b: parseInt(s[3] + s[3], 16)
            };
        }

        const m = s.match(/rgba?\(\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)/i);
        if (!m) return null;

        return {
            r: clamp(Math.round(Number(m[1]))),
            g: clamp(Math.round(Number(m[2]))),
            b: clamp(Math.round(Number(m[3])))
        };
    }

    function rgbHex(rgb) {
        if (!rgb) return '';
        return '#' + [rgb.r, rgb.g, rgb.b]
            .map(v => clamp(Math.round(v)).toString(16).padStart(2, '0'))
            .join('')
            .toUpperCase();
    }

    function rgbToHsl({ r, g, b }) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h = 0;
        let s = 0;
        const l = (max + min) / 2;
        const d = max - min;

        if (d) {
            s = l > .5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
                case g: h = ((b - r) / d + 2); break;
                default: h = ((r - g) / d + 4);
            }
            h *= 60;
        }

        return { h, s: s * 100, l: l * 100 };
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

    function validFormsBrandColor(value) {
        const rgb = rgbParts(value);
        if (!rgb) return false;
        const hsl = rgbToHsl(rgb);

        // Forms يستخدم عادة لونًا بنفسجيًا/أرجوانيًا. هذا يمنع التقاط الأسود أو الرمادي من الصفحة.
        return hsl.h >= 245 && hsl.h <= 335 && hsl.s >= 28 && hsl.l >= 20 && hsl.l <= 72;
    }

    function detectFormsTheme(force = false) {
        if (cachedTheme && !force) return cachedTheme;

        // اللون الأساسي المعتمد للأداة
        const primary = FORMS_PRIMARY_COLOR;

        cachedTheme = {
            primary,
            dark: mixHex(primary, '#000000', .26),
            darker: mixHex(primary, '#000000', .42),
            light: mixHex(primary, '#FFFFFF', .72),
            soft: mixHex(primary, '#FFFFFF', .91),
            softer: mixHex(primary, '#FFFFFF', .96),
            border: mixHex(primary, '#FFFFFF', .80)
        };

        return cachedTheme;
    }

    // ============================================================
    // API discovery and fetching
    // ============================================================

    async function discoverApi() {
        const deadline = Date.now() + 15000;
        while (Date.now() < deadline) {
            const resources = performance
                .getEntriesByType('resource')
                .map(x => x.name)
                .reverse();

            const formUrl = resources.find(url =>
                /\/formapi\/api\/[^/]+\/users\/[^/]+\/light\/forms\('[^']+'\)\?/i.test(url) &&
                !/\/responses\?/i.test(url)
            );

            if (formUrl) {
                const base = formUrl.replace(/\?.*$/, '');
                return { formUrl, base };
            }
            await sleep(500);
        }
        throw new Error('لم أجد طلب بيانات Forms. افتح تبويب «الاستجابات» ثم «نظرة عامة على الاستجابات» وأعد المحاولة.');
    }

    async function fetchJSON(url) {
        const res = await fetch(url, {
            method: 'GET',
            credentials: 'include',
            headers: { 'Accept': 'application/json, text/plain, */*' }
        });
        if (!res.ok) {
            throw new Error(`فشل جلب بيانات Forms (${res.status}).`);
        }
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
        const candidates = [
            q?.deserializedQuestionInfo,
            q?.questionInfo
        ];
        for (const candidate of candidates) {
            const parsed = parseJSON(candidate);
            if (parsed && typeof parsed === 'object') return parsed;
        }
        return {};
    }

    function choiceText(c) {
        return clean(
            c?.Description ??
            c?.description ??
            c?.FormsProDisplayRTText ??
            c?.formsProDisplayRTText ??
            c?.Title ??
            c?.title ??
            c?.Value ??
            c?.value ??
            c?.text ??
            ''
        );
    }

    function flattenValues(value, depth = 0, seen = new WeakSet()) {
        // Forms may return answers as plain strings, JSON arrays/objects, or JSON-looking primitives.
        // Never recurse into numeric/boolean primitives such as "25" -> 25 -> "25",
        // which caused "Maximum call stack size exceeded" in some forms.
        if (value == null || depth > 16) return [];

        if (Array.isArray(value)) {
            const out = [];
            for (const item of value) {
                out.push(...flattenValues(item, depth + 1, seen));
            }
            return out;
        }

        if (typeof value === 'object') {
            if (seen.has(value)) return [];
            seen.add(value);

            const likely =
                value.Description ?? value.description ??
                value.Value ?? value.value ??
                value.Text ?? value.text ??
                value.name ?? value.fileName ?? value.filename;

            if (likely != null) {
                return flattenValues(likely, depth + 1, seen);
            }

            return [];
        }

        const s = clean(value);
        if (!s) return [];

        // Parse only genuinely structured JSON. Numbers/booleans stay as text.
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
            correct: Boolean(
                c?.IsAnswerKey ?? c?.isAnswerKey ?? c?.IsCorrect ?? c?.isCorrect ?? c?.correct ?? false
            ),
            raw: c
        })).filter(x => x.text);
    }

    function extractAnswerKey(q, info, choices) {
        const fromChoices = choices.filter(x => x.correct).map(x => x.text);
        if (fromChoices.length) return fromChoices;

        const fields = [
            'Answer', 'Answers', 'CorrectAnswer', 'CorrectAnswers', 'AnswerKey',
            'TextAnswer', 'AcceptableAnswers', 'CorrectResponse', 'answer', 'answers',
            'correctAnswer', 'correctAnswers', 'answerKey', 'textAnswer', 'acceptableAnswers'
        ];
        const out = [];
        for (const field of fields) {
            if (info && field in info) out.push(...flattenValues(info[field]));
            if (q && field in q) out.push(...flattenValues(q[field]));
        }
        return [...new Set(out.map(clean).filter(Boolean))];
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
            return {
                id: clean(q?.id ?? q?.Id ?? q?.questionId ?? ''),
                title: clean(q?.title ?? q?.Title ?? q?.questionTitle ?? `سؤال ${index + 1}`),
                rawOrder,
                number: 0,
                points,
                choices,
                answerKey,
                type: clean(q?.type ?? info?.QuestionType ?? info?.ChoiceType ?? ''),
                allowMultiple: Boolean(q?.allowMultipleValues ?? info?.AllowMultipleValues ?? answerKey.length > 1),
                required: Boolean(q?.required),
                groupId: clean(q?.groupId),
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

    function sameSet(a, b) {
        const aa = [...new Set(a.map(canon).filter(Boolean))].sort();
        const bb = [...new Set(b.map(canon).filter(Boolean))].sort();
        return aa.length === bb.length && aa.every((v, i) => v === bb[i]);
    }

    function parseResponseComments(response) {
        const raw = parseJSON(response?.comments) ?? response?.comments;
        const arr = Array.isArray(raw) ? raw : [];
        const map = new Map();

        for (const comment of arr) {
            const questionId = clean(comment?.questionId ?? comment?.QuestionId ?? '');
            const score = Number(comment?.score ?? comment?.Score);
            if (!questionId || !Number.isFinite(score)) continue;

            const timeValue = new Date(comment?.createDateTime ?? comment?.createdDateTime ?? '').getTime();
            const timestamp = Number.isFinite(timeValue) ? timeValue : 0;
            const idValue = Number(comment?.id ?? 0);
            const id = Number.isFinite(idValue) ? idValue : 0;
            const current = map.get(questionId);

            // إذا أُعيد تصحيح السؤال نأخذ أحدث درجة مسجلة في Forms.
            if (!current || timestamp > current.timestamp || (timestamp === current.timestamp && id >= current.id)) {
                map.set(questionId, {
                    questionId,
                    score,
                    feedback: clean(comment?.feedback ?? ''),
                    timestamp,
                    id,
                    raw: comment
                });
            }
        }

        return map;
    }

    function gradeQuestion(q, values, manualGrade = null) {
        if (q.points <= 0) {
            return {
                status: 'unscored',
                earned: 0,
                possible: 0,
                gradingSource: 'none',
                feedback: ''
            };
        }

        // comments في Forms هي المصدر الفعلي للدرجات اليدوية،
        // كما أنها تمثل أي تعديل يدوي يجريه المعلم على درجة سؤال آلي.
        if (manualGrade && Number.isFinite(Number(manualGrade.score))) {
            const earned = Number(manualGrade.score);
            return {
                status: 'manual',
                earned,
                possible: q.points,
                gradingSource: 'manual',
                feedback: manualGrade.feedback || '',
                fullCredit: earned >= q.points,
                partialCredit: earned > 0 && earned < q.points
            };
        }

        if (!q.answerKey.length) {
            return {
                status: 'pending',
                earned: null,
                possible: 0,
                nominalPossible: q.points,
                gradingSource: 'manual-pending',
                feedback: ''
            };
        }

        if (!values.length) {
            return {
                status: 'blank',
                earned: 0,
                possible: q.points,
                gradingSource: 'auto',
                feedback: ''
            };
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
        const candidates = questions.filter(q => q.points <= 0 && /اسم|name/i.test(q.title));
        return candidates[0] || null;
    }

    function buildStudents(responses, questions) {
        const nameQuestion = detectNameQuestion(questions);
        state.nameQuestion = nameQuestion;

        const students = responses.map((response, index) => {
            const answers = parseResponseAnswers(response);
            const answerMap = new Map(answers.map(a => [a.questionId, a]));
            const commentMap = parseResponseComments(response);
            const details = questions.map(q => {
                const values = answerMap.get(q.id)?.values || [];
                const grade = gradeQuestion(q, values, commentMap.get(q.id) || null);
                return {
                    questionId: q.id,
                    number: q.number,
                    title: q.title,
                    values,
                    points: q.points,
                    answerKey: q.answerKey,
                    questionType: q.type,
                    isFileUpload: /FileUpload/i.test(q.type),
                    ...grade
                };
            });

            const gradable = details.filter(d => d.possible > 0 && Number.isFinite(Number(d.earned)));
            const earned = sum(gradable.map(d => d.earned));
            const possible = sum(gradable.map(d => d.possible));
            const nominalPossible = sum(questions.filter(q => q.points > 0).map(q => q.points));
            const pendingManualCount = details.filter(d => d.status === 'pending').length;

            const explicitName = nameQuestion
                ? clean(answerMap.get(nameQuestion.id)?.values?.[0] || '')
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
                nominalPossible,
                pendingManualCount,
                percentage: possible ? earned / possible * 100 : 0,
                durationSeconds,
                startDate: response?.startDate || '',
                submitDate: response?.submitDate || '',
                metadata,
                details,
                detailMap: new Map(details.map(d => [d.questionId, d])),
                raw: response
            };
        });

        return students;
    }

    function detectMetadataQuestions(questions, students) {
        return questions.filter(q => {
            if (q.points > 0) return false;
            if (state.nameQuestion?.id === q.id) return false;
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
            return { ...q, filterValues: [...values].filter(Boolean).sort((a, b) => a.localeCompare(b, 'ar')) };
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
        let arr = [...state.students];
        for (const [qid, value] of Object.entries(state.filters)) {
            if (!value) continue;
            const wanted = canon(value);
            arr = arr.filter(s => (s.metadata[qid] || []).some(v => canon(v) === wanted));
        }
        const q = canon(state.search);
        if (q) {
            arr = arr.filter(s =>
                canon(s.name).includes(q) ||
                canon(s.responder).includes(q) ||
                canon(s.responderName).includes(q)
            );
        }
        return arr;
    }

    function cronbachAlpha(students) {
        // لا يدخل في الثبات إلا السؤال الذي توجد له درجة فعلية لكل أفراد العينة الحالية.
        // بذلك ندعم الأسئلة اليدوية بعد تصحيحها دون اعتبار السؤال المعلّق صفرًا.
        const qs = state.questions.filter(q =>
            q.points > 0 &&
            students.every(s => {
                const d = s.detailMap.get(q.id);
                return d && d.possible > 0 && Number.isFinite(Number(d.earned));
            })
        );

        if (students.length < 3 || qs.length < 2) return null;

        const itemVars = [];
        const totals = students.map(s => {
            let total = 0;
            for (const q of qs) total += Number(s.detailMap.get(q.id)?.earned || 0);
            return total;
        });

        for (const q of qs) {
            itemVars.push(variance(students.map(s => Number(s.detailMap.get(q.id)?.earned || 0))));
        }

        const totalVar = variance(totals);
        if (!totalVar) return null;
        const k = qs.length;
        return (k / (k - 1)) * (1 - sum(itemVars) / totalVar);
    }

    function difficultyLabel(p) {
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

        return state.questions
            .filter(q => q.points > 0)
            .map(q => {
                let correct = 0;
                let partial = 0;
                let wrong = 0;
                let blank = 0;
                let pending = 0;
                let manualGraded = 0;
                let autoGraded = 0;
                let earnedTotal = 0;
                let possibleTotal = 0;
                const counts = new Map();

                for (const s of students) {
                    const d = s.detailMap.get(q.id);
                    if (!d) continue;

                    if (d.status === 'pending') {
                        pending++;
                        continue;
                    }

                    if (d.possible > 0 && Number.isFinite(Number(d.earned))) {
                        const earned = Number(d.earned);
                        earnedTotal += earned;
                        possibleTotal += Number(d.possible);

                        if (d.gradingSource === 'manual') manualGraded++;
                        else if (d.gradingSource === 'auto') autoGraded++;

                        if (!d.values.length && d.status === 'blank') {
                            blank++;
                        } else if (earned >= d.possible) {
                            correct++;
                        } else if (earned > 0) {
                            partial++;
                        } else {
                            wrong++;
                        }
                    }

                    // توزيع المشتتات مفيد فقط عندما يكون لدينا مفتاح إجابة آلي.
                    if (q.answerKey.length && d.values.length) {
                        const label = d.values.join(' | ');
                        counts.set(label, (counts.get(label) || 0) + 1);
                    }
                }

                const gradedCount = correct + partial + wrong + blank;
                const mastery = possibleTotal ? earnedTotal / possibleTotal * 100 : 0;

                const pGroup = group => {
                    const ratios = [];
                    for (const s of group) {
                        const d = s.detailMap.get(q.id);
                        if (!d || d.possible <= 0 || !Number.isFinite(Number(d.earned))) continue;
                        ratios.push(Number(d.earned) / Number(d.possible));
                    }
                    return ratios.length ? mean(ratios) : null;
                };

                const upperP = pGroup(upper);
                const lowerP = pGroup(lower);
                const discrimination = Number.isFinite(upperP) && Number.isFinite(lowerP)
                    ? upperP - lowerP
                    : null;

                const pairs = [];
                for (const s of students) {
                    const d = s.detailMap.get(q.id);
                    if (!d || d.possible <= 0 || !Number.isFinite(Number(d.earned))) continue;
                    pairs.push({
                        item: Number(d.earned),
                        rest: s.earned - Number(d.earned)
                    });
                }
                const itemTotalCorrelation = pairs.length >= 3
                    ? pearson(pairs.map(x => x.item), pairs.map(x => x.rest))
                    : null;

                const rows = Array.from(counts.entries())
                    .map(([answer, count]) => ({
                        answer,
                        count,
                        percent: students.length ? count / students.length * 100 : 0,
                        correct: q.answerKey.some(k => canon(k) === canon(answer)) || sameSet(answer.split(' | '), q.answerKey)
                    }))
                    .sort((a, b) => b.count - a.count);

                const topWrong = rows.find(r => !r.correct) || null;
                const gradingMode = q.answerKey.length
                    ? (manualGraded ? 'آلي مع تعديل يدوي' : 'آلي')
                    : (manualGraded ? 'يدوي من Forms' : 'بانتظار التصحيح');

                return {
                    question: q,
                    correct,
                    partial,
                    wrong,
                    blank,
                    pending,
                    gradedCount,
                    manualGraded,
                    autoGraded,
                    earnedTotal,
                    possibleTotal,
                    mastery,
                    gradingMode,
                    difficulty: gradedCount ? difficultyLabel(mastery) : 'غير مصحح',
                    discrimination,
                    discriminationLabel: discriminationLabel(discrimination),
                    itemTotalCorrelation,
                    distribution: rows,
                    topWrong
                };
            });
    }

    function skillAnalytics(students) {
        const groups = new Map();
        for (const q of state.questions) {
            const skill = clean(state.skillMap[q.id] || '');
            if (!skill || q.points <= 0) continue;
            if (!groups.has(skill)) groups.set(skill, []);
            groups.get(skill).push(q);
        }

        return Array.from(groups.entries()).map(([skill, qs]) => {
            let possible = 0;
            let earned = 0;
            let pending = 0;

            for (const s of students) {
                for (const q of qs) {
                    const d = s.detailMap.get(q.id);
                    if (!d) continue;
                    if (d.status === 'pending') {
                        pending++;
                        continue;
                    }
                    if (d.possible > 0 && Number.isFinite(Number(d.earned))) {
                        possible += Number(d.possible);
                        earned += Number(d.earned);
                    }
                }
            }

            return {
                skill,
                questions: qs.length,
                earned,
                possible,
                pending,
                mastery: possible ? earned / possible * 100 : 0
            };
        }).sort((a, b) => a.mastery - b.mastery);
    }

    function summaryAnalytics(students) {
        const scores = students.map(s => s.earned);
        const percentages = students.map(s => s.percentage);
        const durations = students.map(s => s.durationSeconds).filter(Number.isFinite);
        const possible = state.questions
            .filter(q => q.points > 0)
            .reduce((a, q) => a + q.points, 0);
        const pendingManualCount = students.reduce((total, s) => total + (s.pendingManualCount || 0), 0);
        const studentsPendingManual = students.filter(s => (s.pendingManualCount || 0) > 0).length;
        const manualQuestions = state.questions.filter(q => q.points > 0 && !q.answerKey.length);
        const manualQuestionCount = manualQuestions.length;
        const manualQuestionTitles = manualQuestions.map(q => q.title);
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
            pendingManualCount,
            studentsPendingManual,
            manualQuestionCount,
            manualQuestionTitles,
            evalCounts
        };
    }

    function groupComparisons(students) {
        return state.metadataQuestions.map(q => {
            const groups = q.filterValues.map(value => {
                const members = students.filter(s => (s.metadata[q.id] || []).some(v => canon(v) === canon(value)));
                const sm = summaryAnalytics(members);
                return {
                    value,
                    count: members.length,
                    averagePercent: sm.averagePercent,
                    passRate: sm.passRate,
                    weakCount: sm.weakCount
                };
            }).filter(g => g.count);
            return { question: q, groups };
        }).filter(x => x.groups.length >= 2);
    }

    function histogram(students) {
        const bins = [
            { label: '0–9', min: 0, max: 10 },
            { label: '10–19', min: 10, max: 20 },
            { label: '20–29', min: 20, max: 30 },
            { label: '30–39', min: 30, max: 40 },
            { label: '40–49', min: 40, max: 50 },
            { label: '50–59', min: 50, max: 60 },
            { label: '60–69', min: 60, max: 70 },
            { label: '70–79', min: 70, max: 80 },
            { label: '80–89', min: 80, max: 90 },
            { label: '90–100', min: 90, max: 101 }
        ];
        for (const b of bins) b.count = students.filter(s => s.percentage >= b.min && s.percentage < b.max).length;
        return bins;
    }

    function recommendations(students, qAnalytics, skills) {
        const out = [];
        const summary = summaryAnalytics(students);
        const weak = qAnalytics.filter(q => q.gradedCount > 0 && q.mastery < state.settings.weakQuestion);
        const critical = qAnalytics.filter(q => q.gradedCount > 0 && q.mastery < state.settings.highPriorityQuestion);
        const suspicious = qAnalytics.filter(q => Number.isFinite(q.discrimination) && q.discrimination < 0.10);
        const misconceptions = qAnalytics.filter(q => q.topWrong && q.topWrong.percent >= 35);

        if (summary.weakCount) {
            out.push(`يوجد ${summary.weakCount} من أصل ${summary.count} مستجيبًا أقل من ${state.settings.thresholds.acceptable}% ويحتاجون متابعة.`);
        }
        if (critical.length) {
            out.push(`هناك ${critical.length} سؤالًا بإتقان أقل من ${state.settings.highPriorityQuestion}%؛ يوصى بإعطائها أولوية معالجة عالية.`);
        }
        if (weak.length) {
            out.push(`هناك ${weak.length} سؤالًا بإتقان أقل من ${state.settings.weakQuestion}%؛ وهي مواطن ضعف جماعية محتملة.`);
        }
        if (misconceptions.length) {
            out.push(`في ${misconceptions.length} سؤالًا انجذب 35% أو أكثر من المستجيبين إلى مشتت خاطئ واحد؛ راجع المفهوم المرتبط بالمشتت.`);
        }
        if (suspicious.length) {
            out.push(`هناك ${suspicious.length} سؤالًا بمعامل تمييز أقل من 0.10؛ يفضّل مراجعة صياغتها أو مفتاحها قبل اتخاذ قرار تربوي منها.`);
        }
        if (skills.length) {
            const weakest = skills[0];
            out.push(`أضعف مهارة معرفة حاليًا هي «${weakest.skill}» بإتقان ${fmtPct(weakest.mastery)}.`);
        }
        if (!out.length) out.push('لا توجد إشارات حرجة وفق الحدود الحالية. راجع تحليل الأسئلة والمهارات للتفاصيل.');
        return out;
    }

    function currentAnalysis() {
        const students = selectedStudents();
        const summary = summaryAnalytics(students);
        const questions = questionAnalytics(students);
        const skills = skillAnalytics(students);
        return {
            students,
            summary,
            questions,
            skills,
            groups: groupComparisons(students),
            histogram: histogram(students),
            recommendations: recommendations(students, questions, skills)
        };
    }

    // ============================================================
    // Loading
    // ============================================================

    async function loadData(force = false) {
        if (state.loading) return;
        if (state.loaded && !force) return;
        state.loading = true;
        state.error = '';
        renderLoading();

        try {
            state.api = await discoverApi();
            const form = await fetchJSON(state.api.formUrl);
            const expected = num(form?.responses ?? form?.rowCount, 0);
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
            toast(`تم تحليل ${state.students.length} استجابة.`, 'success');
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

        const t = detectFormsTheme();
        const style = document.createElement('style');
        style.id = 'fsra-styles';
        style.textContent = `
:root{
 --fsra-primary:${t.primary};
 --fsra-primary-dark:${t.dark};
 --fsra-primary-darker:${t.darker};
 --fsra-primary-light:${t.light};
 --fsra-primary-soft:${t.soft};
 --fsra-primary-softer:${t.softer};
 --fsra-primary-border:${t.border};
}
#fsra-launcher{font-family:Segoe UI,Tahoma,Arial,sans-serif!important;direction:rtl;border:0;border-radius:10px;padding:9px 14px;margin-inline-start:10px;background:var(--fsra-primary);color:#fff;font-weight:700;cursor:pointer;box-shadow:0 2px 8px #0002;white-space:nowrap}
#fsra-launcher:hover{filter:brightness(1.06)}
#fsra-overlay{position:fixed;inset:0;z-index:2147483000;background:rgba(20,16,35,.48);font-family:Segoe UI,Tahoma,Arial,sans-serif;direction:rtl;color:#201a2b}
#fsra-overlay *{box-sizing:border-box}
.fsra-shell{position:absolute;inset:2.2vh 2vw;background:#f7f7f9;border-radius:18px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 24px 80px #0006}
.fsra-header{background:#fff;border-bottom:1px solid #e7e5ea;padding:14px 18px;display:flex;gap:12px;align-items:center;justify-content:space-between;box-shadow:inset 0 -3px 0 var(--fsra-primary)}
.fsra-title-wrap{min-width:0}.fsra-title{font-size:20px;font-weight:800;color:var(--fsra-primary-dark)}.fsra-subtitle{font-size:12px;color:#6d6577;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:68vw;margin-top:3px}
.fsra-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.fsra-btn{border:1px solid var(--fsra-primary-border);background:#fff;border-radius:9px;padding:8px 11px;cursor:pointer;font:inherit;font-weight:650;color:var(--fsra-primary-dark)}.fsra-btn:hover{background:var(--fsra-primary-softer)}.fsra-btn.primary{background:var(--fsra-primary);color:#fff;border-color:var(--fsra-primary)}.fsra-btn.primary:hover{filter:brightness(1.04)}.fsra-btn.danger{color:#a22323;border-color:#e6c7c7}.fsra-btn.small{padding:5px 8px;font-size:12px}.fsra-close{font-size:20px;line-height:1}
.fsra-credit{flex:0 0 auto;background:#fff;border-top:1px solid #e7e5ea;padding:7px 18px;text-align:center;font-size:10px;color:#81798a}.fsra-credit a{color:var(--fsra-primary);text-decoration:none;font-weight:800}.fsra-credit b{color:var(--fsra-primary-dark)}
.fsra-filterbar{background:#fff;border-bottom:1px solid #e7e5ea;padding:10px 18px;display:flex;gap:10px;align-items:end;flex-wrap:wrap}.fsra-field{display:flex;flex-direction:column;gap:4px;min-width:150px}.fsra-field label{font-size:11px;color:#6f6878;font-weight:700}.fsra-field input,.fsra-field select{border:1px solid #d8d5dc;border-radius:8px;padding:7px 9px;background:#fff;font:inherit;min-height:35px;outline:none}.fsra-field input:focus,.fsra-field select:focus{border-color:var(--fsra-primary);box-shadow:0 0 0 2px var(--fsra-primary-soft)}.fsra-privacy{margin-inline-start:auto;display:flex;gap:7px;align-items:center;font-size:12px;font-weight:700;color:#5a5262}.fsra-privacy input{accent-color:var(--fsra-primary)}
.fsra-tabs{display:flex;gap:3px;background:var(--fsra-primary-softer);padding:7px 12px;overflow:auto;border-bottom:1px solid var(--fsra-primary-light)}.fsra-tab{border:0;background:transparent;border-radius:8px;padding:8px 12px;cursor:pointer;font:inherit;font-weight:700;color:#655c70;white-space:nowrap}.fsra-tab:hover{background:#fff}.fsra-tab.active{background:#fff;color:var(--fsra-primary-dark);box-shadow:0 1px 4px #0001,inset 0 -3px 0 var(--fsra-primary)}
.fsra-content{padding:16px 18px;overflow:auto;flex:1}.fsra-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px}.fsra-card{background:#fff;border:1px solid #e8e6eb;border-radius:13px;padding:14px;box-shadow:0 1px 4px #0000000a}.fsra-kpi .label{font-size:12px;color:#746b7e;font-weight:700}.fsra-kpi .value{font-size:25px;font-weight:850;margin-top:5px;color:var(--fsra-primary-dark)}.fsra-kpi .note{font-size:11px;color:#8a8292;margin-top:4px}
.fsra-two{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}.fsra-section-title{font-size:15px;font-weight:850;color:var(--fsra-primary-dark);margin:0 0 10px}.fsra-muted{color:#81798a;font-size:12px}.fsra-bar-row{display:grid;grid-template-columns:minmax(80px,140px) 1fr 55px;gap:8px;align-items:center;margin:7px 0;font-size:12px}.fsra-bar{height:10px;background:#eceaec;border-radius:999px;overflow:hidden}.fsra-fill{height:100%;background:linear-gradient(90deg,var(--fsra-primary),var(--fsra-primary-dark));border-radius:inherit}.fsra-fill.weak{background:linear-gradient(90deg,#cc4b4b,#9f2424)}.fsra-fill.ok{background:linear-gradient(90deg,var(--fsra-primary),var(--fsra-primary-dark))}
.fsra-hist{display:flex;align-items:flex-end;gap:6px;height:160px;padding-top:10px}.fsra-hcol{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;min-width:24px}.fsra-hbar{width:70%;background:var(--fsra-primary);border-radius:5px 5px 0 0;min-height:2px}.fsra-hnum{font-size:10px;color:#5e5666;margin-bottom:4px}.fsra-hlabel{font-size:9px;color:#726a7a;margin-top:4px;white-space:nowrap}
.fsra-table-wrap{background:#fff;border:1px solid #e8e6eb;border-radius:13px;overflow:auto}.fsra-table{width:100%;border-collapse:collapse;min-width:850px}.fsra-table th,.fsra-table td{border-bottom:1px solid #eeecef;padding:9px 10px;text-align:right;font-size:12px;vertical-align:top}.fsra-table th{background:var(--fsra-primary-softer);color:#554b60;font-weight:800;position:sticky;top:0;z-index:1;cursor:default}.fsra-table th[data-sort]{cursor:pointer}.fsra-table tr:hover td{background:var(--fsra-primary-softer)}.fsra-row-weak td{background:#fff8f8}.fsra-pill{display:inline-flex;border-radius:999px;padding:3px 8px;font-size:11px;font-weight:800;background:var(--fsra-primary-soft);color:var(--fsra-primary-dark)}.fsra-pill.weak{background:#fde8e8;color:#9b2929}.fsra-pill.good{background:var(--fsra-primary-soft);color:var(--fsra-primary-dark)}.fsra-pill.warn{background:#fff0d7;color:#895c10}.fsra-score{font-weight:850;font-variant-numeric:tabular-nums}.fsra-qtitle{max-width:480px;line-height:1.55}.fsra-details{margin-top:8px;padding:12px;background:var(--fsra-primary-softer);border:1px solid var(--fsra-primary-light);border-radius:10px}
.fsra-reco{display:flex;gap:8px;align-items:flex-start;padding:9px 10px;border-radius:9px;background:var(--fsra-primary-softer);border-right:3px solid var(--fsra-primary);margin:7px 0;font-size:12px;line-height:1.6}.fsra-review-card{background:linear-gradient(135deg,var(--fsra-primary-dark),var(--fsra-primary));color:#fff;border-radius:14px;padding:16px;margin-bottom:12px}.fsra-review-card .big{font-size:18px;font-weight:850;margin-top:6px}.fsra-review-card .small{font-size:12px;opacity:.9}
.fsra-empty{padding:34px;text-align:center;color:#756c7d}.fsra-error{background:#fff0f0;color:#912e2e;border:1px solid #f1caca;border-radius:10px;padding:14px}.fsra-loading{padding:50px;text-align:center;font-weight:800;color:var(--fsra-primary)}.fsra-spin{display:inline-block;width:24px;height:24px;border:3px solid var(--fsra-primary-light);border-top-color:var(--fsra-primary);border-radius:50%;animation:fsra-spin 1s linear infinite;vertical-align:middle;margin-left:8px}@keyframes fsra-spin{to{transform:rotate(360deg)}}
.fsra-form-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}.fsra-form-grid .fsra-field{min-width:0}.fsra-note{background:#fffbea;border:1px solid #efe2a7;color:#655219;border-radius:10px;padding:10px;font-size:12px;line-height:1.65}.fsra-manual-warning{background:#fff4e5;border-top:1px solid #f1c77a;border-bottom:1px solid #f1c77a;color:#6b4200;padding:11px 18px;font-size:12px;line-height:1.75;font-weight:700}.fsra-manual-warning strong{color:#9b4a00}.fsra-skill-tools{display:flex;gap:8px;align-items:end;flex-wrap:wrap;margin-bottom:10px}.fsra-check{width:16px;height:16px;accent-color:var(--fsra-primary)}.fsra-delta-pos{color:#27763b;font-weight:800}.fsra-delta-neg{color:#a52b2b;font-weight:800}
.fsra-toast{position:fixed;z-index:2147483646;bottom:24px;left:24px;max-width:420px;padding:11px 14px;border-radius:10px;background:#30283a;color:#fff;box-shadow:0 10px 30px #0004;font-family:Segoe UI,Tahoma,Arial,sans-serif;direction:rtl}.fsra-toast-success{background:#276a3d}.fsra-toast-error{background:#9b2f2f}
@media(max-width:900px){.fsra-shell{inset:0;border-radius:0}.fsra-two{grid-template-columns:1fr}.fsra-header{align-items:flex-start}.fsra-subtitle{max-width:55vw}.fsra-privacy{margin-inline-start:0}.fsra-filterbar{align-items:stretch}.fsra-field{flex:1 1 160px}}
        `;
        document.head.appendChild(style);
    }

    function ensureLauncher() {
        ensureStyles();
        if (document.getElementById('fsra-launcher')) return;
        const title = document.querySelector('#AnalyzeSummaryTitleId_title');
        if (!title) return;
        const btn = document.createElement('button');
        btn.id = 'fsra-launcher';
        btn.type = 'button';
        btn.textContent = '📊 التحليل الذكي';
        btn.title = 'فتح محلل نتائج Forms الذكي';
        btn.addEventListener('click', openApp);
        const parent = title.parentElement || title;
        parent.appendChild(btn);
    }

    function openApp() {
        ensureStyles();
        if (state.overlay?.isConnected) {
            state.overlay.style.display = 'block';
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
            <div class="fsra-field">
                <label>${esc(q.title)}</label>
                <select data-filter-qid="${esc(q.id)}">
                    <option value="">الكل</option>
                    ${q.filterValues.map(v => `<option value="${esc(v)}" ${state.filters[q.id] === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}
                </select>
            </div>
        `).join('');
        return `
            <div class="fsra-filterbar">
                ${selects}
                <div class="fsra-field" style="min-width:220px">
                    <label>بحث عن مستجيب</label>
                    <input data-role="student-search" value="${esc(state.search)}" placeholder="الاسم أو الحساب...">
                </div>
                <label class="fsra-privacy"><input type="checkbox" data-role="privacy-toggle" ${state.settings.privacy ? 'checked' : ''}> 👁️ وضع الخصوصية</label>
            </div>
        `;
    }

    function tabsHtml() {
        const tabs = [
            ['overview', 'نظرة عامة'],
            ['students', 'الطلاب / المستجيبون'],
            ['questions', 'تحليل الأسئلة'],
            ['skills', 'المهارات'],
            ['compare', 'المقارنات'],
            ['reports', 'التقارير والتصدير'],
            ['settings', 'الإعدادات']
        ];
        return `<div class="fsra-tabs">${tabs.map(([id, label]) => `<button class="fsra-tab ${state.activeTab === id ? 'active' : ''}" data-tab="${id}">${label}</button>`).join('')}</div>`;
    }

    function renderApp() {
        try {
            return renderAppUnsafe();
        } catch (err) {
            console.error(`[${APP.name}] render`, err);
            state.error = String(err?.message || err || 'خطأ غير معروف');
            if (state.overlay) {
                state.overlay.innerHTML = `
                    <div class="fsra-shell">
                        <div class="fsra-header">
                            <div class="fsra-title-wrap">
                                <div class="fsra-title">${APP.arName}</div>
                                <div class="fsra-subtitle">تعذر إكمال التحليل لهذا النموذج</div>
                            </div>
                            <div class="fsra-actions">
                                <button class="fsra-btn" data-action="refresh">↻ إعادة المحاولة</button>
                                <button class="fsra-btn fsra-close" data-action="close">×</button>
                            </div>
                        </div>
                        <div class="fsra-content">
                            <div class="fsra-error"><b>حدث خطأ أثناء بناء التحليل:</b><br>${esc(state.error)}</div>
                            <div class="fsra-note" style="margin-top:10px">تم احتواء الخطأ بدل إيقاف الصفحة. افتح Console إذا أردت تفاصيل تقنية إضافية.</div>
                        </div>
                    </div>`;
            }
        }
    }

    function renderManualGradingWarning(summary) {
        if (!summary?.manualQuestionCount || !summary?.pendingManualCount) return '';

        const qLabel = summary.manualQuestionCount === 1 ? 'سؤالًا واحدًا يحتاج' : `${summary.manualQuestionCount} أسئلة تحتاج`;
        const pendingLabel = summary.pendingManualCount === 1 ? 'درجة يدوية واحدة ما زالت معلّقة' : `${summary.pendingManualCount} درجات يدوية ما زالت معلّقة`;
        const studentsLabel = summary.studentsPendingManual === 1 ? 'لدى مستجيب واحد' : `لدى ${summary.studentsPendingManual} مستجيبين`;

        return `
            <div class="fsra-manual-warning">
                ⚠️ <strong>تنبيه مهم:</strong> يحتوي هذا النموذج على ${qLabel} تصحيحًا يدويًا.
                <strong>لا تستخدم التحليل النهائي إلا بعد الانتهاء من التصحيح اليدوي لجميع الاستجابات في Microsoft Forms.</strong>
                حاليًا: ${pendingLabel} ${studentsLabel}.
            </div>
        `;
    }

    function renderAppUnsafe() {
        if (!state.overlay) return;
        if (state.error && !state.loaded) {
            state.overlay.innerHTML = `
                <div class="fsra-shell">
                    <div class="fsra-header">
                        <div class="fsra-title-wrap"><div class="fsra-title">${APP.arName}</div><div class="fsra-subtitle">الإصدار ${APP.version}</div></div>
                        <div class="fsra-actions"><button class="fsra-btn" data-action="about">عن السكربت</button><button class="fsra-btn" data-action="retry">إعادة المحاولة</button><button class="fsra-btn fsra-close" data-action="close">×</button></div>
                    </div>
                    <div class="fsra-content"><div class="fsra-error">${esc(state.error)}</div></div>
                </div>`;
            return;
        }
        if (!state.loaded) return renderLoading();
        const a = currentAnalysis();
        state.overlay.innerHTML = `
            <div class="fsra-shell">
                <div class="fsra-header">
                    <div class="fsra-title-wrap">
                        <div class="fsra-title">${APP.arName}</div>
                        <div class="fsra-subtitle">${esc(state.form?.title || document.title)} — ${a.students.length} من ${state.students.length} استجابة</div>
                    </div>
                    <div class="fsra-actions">
                        <button class="fsra-btn" data-action="about">عن السكربت</button>
                        <button class="fsra-btn" data-action="refresh">↻ تحديث البيانات</button>
                        <button class="fsra-btn primary" data-action="print-full">🖨️ التقرير الشامل</button>
                        <button class="fsra-btn fsra-close" data-action="close">×</button>
                    </div>
                </div>
                ${filterBarHtml()}
                ${renderManualGradingWarning(a.summary)}
                ${tabsHtml()}
                <div class="fsra-content" id="fsra-content">${renderTab(a)}</div>
                <div class="fsra-credit">
                    تصميم وتطوير: <b>${esc(DEV.name)} (${esc(DEV.handle)})</b>
                    &nbsp;·&nbsp; <a href="${DEV.greasy}" target="_blank" rel="noopener">GreasyFork</a>
                    &nbsp;·&nbsp; <a href="${DEV.x}" target="_blank" rel="noopener">X</a>
                    &nbsp;·&nbsp; <a href="${DEV.snap}" target="_blank" rel="noopener">Snapchat</a>
                    &nbsp;·&nbsp; © 2026 جميع الحقوق محفوظة.
                </div>
            </div>`;
    }

    function renderTab(a) {
        switch (state.activeTab) {
            case 'students': return renderStudents(a);
            case 'questions': return renderQuestions(a);
            case 'skills': return renderSkills(a);
            case 'compare': return renderCompare(a);
            case 'reports': return renderReports(a);
            case 'settings': return renderSettings(a);
            default: return renderOverview(a);
        }
    }

    function reviewPriority(a) {
        if (a.skills.length) {
            const x = a.skills[0];
            return { title: x.skill, percent: x.mastery, note: `${x.questions} سؤال/أسئلة مرتبطة بهذه المهارة.` };
        }
        const q = Array.from(a.questions).filter(x => x.gradedCount > 0).sort((x, y) => x.mastery - y.mastery)[0];
        if (q) return { title: `السؤال ${q.question.number}: ${q.question.title}`, percent: q.mastery, note: q.topWrong ? `أكثر مشتت خاطئ: ${q.topWrong.answer} (${fmtPct(q.topWrong.percent)})` : 'راجع مفهوم هذا السؤال.' };
        return { title: 'لا توجد بيانات كافية', percent: 0, note: '' };
    }

    function renderOverview(a) {
        const s = a.summary;
        const priority = reviewPriority(a);
        const maxEval = Math.max(1, maxValue(Object.values(s.evalCounts), 1));
        const maxHist = Math.max(1, maxValue(a.histogram.map(x => x.count), 1));
        const weakQs = Array.from(a.questions).filter(q => q.gradedCount > 0 && q.mastery < state.settings.weakQuestion).sort((x, y) => x.mastery - y.mastery).slice(0, 8);
        const alphaText = Number.isFinite(s.alpha) ? fmtNum(s.alpha, 3) : '—';
        return `
            <div class="fsra-review-card">
                <div class="small">ماذا أراجع أولًا؟</div>
                <div class="big">${esc(priority.title)}</div>
                <div class="small">الإتقان: ${fmtPct(priority.percent)} — ${esc(priority.note)}</div>
            </div>
            <div class="fsra-grid">
                ${kpi('المستجيبون', s.count, 'بعد تطبيق الفلاتر')}
                ${kpi('متوسط الدرجة', `${fmtNum(s.averageScore)}/${fmtNum(s.possible, 0)}`, fmtPct(s.averagePercent))}
                ${kpi('الوسيط', fmtNum(s.medianScore), fmtPct(s.medianPercent))}
                ${kpi('أعلى / أدنى', `${fmtNum(s.maxScore, 0)} / ${fmtNum(s.minScore, 0)}`, 'بالدرجة')}
                ${kpi('نسبة الاجتياز', fmtPct(s.passRate), `الحد ${state.settings.thresholds.acceptable}%`)}
                ${kpi('ضعيف', s.weakCount, `أقل من ${state.settings.thresholds.acceptable}%`)}
                ${kpi('متوسط الزمن', fmtDuration(s.avgDuration), 'زمن الحل')}
                ${kpi('ثبات الاختبار α', alphaText, 'Cronbach’s Alpha')}
                ${kpi('بانتظار التصحيح', s.pendingManualCount, s.studentsPendingManual ? `${s.studentsPendingManual} مستجيبًا لديهم درجات معلّقة` : 'لا توجد درجات معلّقة')}
            </div>
            <div class="fsra-two">
                <div class="fsra-card">
                    <h3 class="fsra-section-title">توزيع التقييمات</h3>
                    ${Object.entries(s.evalCounts).map(([label, count]) => `
                        <div class="fsra-bar-row"><span>${esc(label)}</span><div class="fsra-bar"><div class="fsra-fill ${label === 'ضعيف' ? 'weak' : ''}" style="width:${count / maxEval * 100}%"></div></div><b>${count}</b></div>
                    `).join('')}
                </div>
                <div class="fsra-card">
                    <h3 class="fsra-section-title">توزيع النسب</h3>
                    <div class="fsra-hist">${a.histogram.map(b => `<div class="fsra-hcol"><div class="fsra-hnum">${b.count}</div><div class="fsra-hbar" style="height:${b.count / maxHist * 120}px"></div><div class="fsra-hlabel">${b.label}</div></div>`).join('')}</div>
                    <div class="fsra-muted">الحد الفاصل للضعيف في الإعدادات الحالية: أقل من ${state.settings.thresholds.acceptable}%.</div>
                </div>
            </div>
            <div class="fsra-two">
                <div class="fsra-card">
                    <h3 class="fsra-section-title">أكثر الأسئلة حاجة للمعالجة</h3>
                    ${weakQs.length ? weakQs.map(q => `<div class="fsra-bar-row"><span title="${esc(q.question.title)}">س${q.question.number}</span><div class="fsra-bar"><div class="fsra-fill weak" style="width:${Math.max(2, q.mastery)}%"></div></div><b>${fmtPct(q.mastery, 0)}</b></div>`).join('') : '<div class="fsra-muted">لا توجد أسئلة تحت الحد الحالي.</div>'}
                </div>
                <div class="fsra-card">
                    <h3 class="fsra-section-title">قراءة سريعة وتوصيات</h3>
                    ${a.recommendations.map(x => `<div class="fsra-reco">💡 <span>${esc(x)}</span></div>`).join('')}
                </div>
            </div>
            ${renderGroupSummary(a.groups)}
        `;
    }

    function kpi(label, value, note = '') {
        return `<div class="fsra-card fsra-kpi"><div class="label">${esc(label)}</div><div class="value">${esc(value)}</div><div class="note">${esc(note)}</div></div>`;
    }

    function renderGroupSummary(groups) {
        if (!groups.length) return '';
        const first = groups[0];
        return `<div class="fsra-card" style="margin-top:12px"><h3 class="fsra-section-title">مقارنة حسب: ${esc(first.question.title)}</h3><div class="fsra-grid">${first.groups.map(g => `<div><b>${esc(g.value)}</b><div class="fsra-muted">${g.count} مستجيب — متوسط ${fmtPct(g.averagePercent)} — اجتياز ${fmtPct(g.passRate)}</div></div>`).join('')}</div></div>`;
    }

    function privateName(s, index) {
        return state.settings.privacy ? `مستجيب ${String(index + 1).padStart(2, '0')}` : s.name;
    }

    function sortStudents(arr) {
        const { key, dir } = state.studentSort;
        const m = dir === 'asc' ? 1 : -1;
        return Array.from(arr).sort((a, b) => {
            let av = a[key], bv = b[key];
            if (typeof av === 'string') return av.localeCompare(String(bv), 'ar') * m;
            return ((Number(av) || 0) - (Number(bv) || 0)) * m;
        });
    }

    function metadataSummaryForStudent(s) {
        return state.metadataQuestions.map(q => (s.metadata[q.id] || []).join('، ')).filter(Boolean).join(' | ');
    }

    function renderStudents(a) {
        const rows = sortStudents(a.students);
        if (!rows.length) return '<div class="fsra-empty">لا توجد نتائج تطابق الفلاتر الحالية.</div>';
        return `
            <div class="fsra-table-wrap">
                <table class="fsra-table">
                    <thead><tr>
                        <th>#</th><th data-sort="name">الاسم / الهوية</th><th>مصدر الهوية</th><th>بيانات وصفية</th>
                        <th data-sort="earned">الدرجة</th><th data-sort="percentage">النسبة</th><th>التقييم</th><th data-sort="durationSeconds">الزمن</th><th>تقرير</th>
                    </tr></thead>
                    <tbody>${rows.map((s, i) => {
                        const e = evaluation(s.percentage);
                        return `<tr class="${e.key === 'weak' ? 'fsra-row-weak' : ''}">
                            <td>${i + 1}</td>
                            <td><b>${esc(privateName(s, i))}</b>${!state.settings.privacy && s.responder ? `<div class="fsra-muted">${esc(s.responder)}</div>` : ''}</td>
                            <td>${esc(s.identitySource)}</td>
                            <td>${esc(metadataSummaryForStudent(s) || '—')}</td>
                            <td class="fsra-score">${fmtNum(s.earned, 1)} / ${fmtNum(s.possible, 1)}${s.pendingManualCount ? `<div class="fsra-muted">⚠️ ${s.pendingManualCount} بانتظار التصحيح</div>` : ''}</td>
                            <td class="fsra-score">${fmtPct(s.percentage)}</td>
                            <td><span class="fsra-pill ${e.key === 'weak' ? 'weak' : e.key === 'excellent' ? 'good' : ''}">${esc(e.label)}</span></td>
                            <td>${fmtDuration(s.durationSeconds)}</td>
                            <td><button class="fsra-btn small" data-action="student-report" data-student-key="${esc(s.identityKey)}">📄</button></td>
                        </tr>`;
                    }).join('')}</tbody>
                </table>
            </div>`;
    }

    function sortedQuestions(a) {
        const { key, dir } = state.questionSort;
        const m = dir === 'asc' ? 1 : -1;
        return Array.from(a.questions).sort((x, y) => {
            let av, bv;
            if (key === 'number') { av = x.question.number; bv = y.question.number; }
            else if (key === 'discrimination') { av = x.discrimination ?? -9; bv = y.discrimination ?? -9; }
            else if (key === 'correlation') { av = x.itemTotalCorrelation ?? -9; bv = y.itemTotalCorrelation ?? -9; }
            else { av = x.mastery; bv = y.mastery; }
            return (av - bv) * m;
        });
    }

    function renderQuestions(a) {
        const rows = sortedQuestions(a);
        return `
            <div class="fsra-note" style="margin-bottom:10px">
                يدعم المحلل الآن التصحيح الآلي واليدوي. في الأسئلة اليدوية (مثل الكتابة ورفع الملفات) تُقرأ الدرجة التي سجّلها المعلم في Microsoft Forms مباشرة. وإذا عُدلت درجة سؤال آلي يدويًا فدرجة المعلم هي المعتمدة.
            </div>
            <div class="fsra-table-wrap"><table class="fsra-table"><thead><tr>
                <th data-sortq="number">#</th><th>السؤال</th><th>التصحيح</th><th data-sortq="mastery">الإتقان</th><th>كامل</th><th>جزئي</th><th>صفر</th><th>معلّق</th><th>الصعوبة</th><th data-sortq="discrimination">التمييز D</th><th data-sortq="correlation">ارتباط السؤال</th><th>أقوى مشتت</th><th>تفاصيل</th>
            </tr></thead><tbody>
            ${rows.map(q => {
                const weak = q.gradedCount > 0 && q.mastery < state.settings.weakQuestion;
                const answerNote = q.question.answerKey.length
                    ? `الإجابة: ${esc(q.question.answerKey.join(' | '))}`
                    : `الدرجة القصوى: ${fmtNum(q.question.points, 1)} — لا يوجد مفتاح آلي`;
                return `<tr class="${weak ? 'fsra-row-weak' : ''}">
                    <td>${q.question.number}</td><td class="fsra-qtitle"><b>${esc(q.question.title)}</b><div class="fsra-muted">${answerNote}</div></td>
                    <td><span class="fsra-pill">${esc(q.gradingMode)}</span></td>
                    <td class="fsra-score">${q.gradedCount ? fmtPct(q.mastery) : '—'}</td><td>${q.correct}</td><td>${q.partial}</td><td>${q.wrong}</td><td>${q.pending}</td><td>${esc(q.difficulty)}</td>
                    <td><span class="fsra-pill ${Number.isFinite(q.discrimination) && q.discrimination < .2 ? 'warn' : ''}">${Number.isFinite(q.discrimination) ? fmtNum(q.discrimination, 2) : '—'}</span><div class="fsra-muted">${esc(q.discriminationLabel)}</div></td>
                    <td>${Number.isFinite(q.itemTotalCorrelation) ? fmtNum(q.itemTotalCorrelation, 2) : '—'}</td>
                    <td>${q.topWrong ? `${esc(q.topWrong.answer)} <span class="fsra-muted">(${fmtPct(q.topWrong.percent)})</span>` : '—'}</td>
                    <td><button class="fsra-btn small" data-action="toggle-question" data-qid="${esc(q.question.id)}">${state.expandedQuestionId === q.question.id ? 'إخفاء' : 'عرض'}</button></td>
                </tr>${state.expandedQuestionId === q.question.id ? `<tr><td colspan="13">${renderQuestionDetails(q)}</td></tr>` : ''}`;
            }).join('')}
            </tbody></table></div>`;
    }

    function renderQuestionDetails(q) {
        if (!q.question.answerKey.length) {
            return `<div class="fsra-details">
                <b>تفاصيل التصحيح اليدوي</b>
                <div class="fsra-reco">✍️ طريقة التصحيح: <b>${esc(q.gradingMode)}</b></div>
                <div class="fsra-reco">📊 تم تصحيح <b>${q.gradedCount}</b> استجابة، منها ${q.correct} بالدرجة الكاملة و${q.partial} بدرجة جزئية و${q.wrong} بصفر.</div>
                ${q.pending ? `<div class="fsra-reco">⏳ لا تزال <b>${q.pending}</b> استجابة بانتظار التصحيح في Forms، ولم تُحسب كصفر.</div>` : ''}
                <div class="fsra-reco">🎯 الإتقان محسوب من مجموع الدرجات الفعلية: <b>${fmtNum(q.earnedTotal,1)} / ${fmtNum(q.possibleTotal,1)}</b> = <b>${q.gradedCount ? fmtPct(q.mastery) : '—'}</b>.</div>
            </div>`;
        }

        const max = Math.max(1, maxValue(q.distribution.map(x => x.count), 1));
        return `<div class="fsra-details"><b>توزيع الإجابات</b>${q.distribution.length ? q.distribution.map(r => `<div class="fsra-bar-row"><span>${r.correct ? '✅ ' : ''}${esc(r.answer)}</span><div class="fsra-bar"><div class="fsra-fill ${r.correct ? 'ok' : 'weak'}" style="width:${r.count / max * 100}%"></div></div><b>${r.count}</b></div>`).join('') : '<div class="fsra-muted">لا توجد إجابات.</div>'}${q.manualGraded ? `<div class="fsra-reco">✍️ توجد ${q.manualGraded} درجة عُدلت يدويًا في Forms وتم اعتمادها بدل التصحيح الآلي.</div>` : ''}</div>`;
    }

    function existingSkills() {
        return [...new Set(Object.values(state.skillMap).map(clean).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ar'));
    }

    function renderSkills(a) {
        const skills = a.skills;
        return `
            ${skills.length ? `<div class="fsra-card" style="margin-bottom:12px"><h3 class="fsra-section-title">إتقان المهارات</h3>${skills.map(x => `<div class="fsra-bar-row"><span>${esc(x.skill)}</span><div class="fsra-bar"><div class="fsra-fill ${x.mastery < state.settings.weakQuestion ? 'weak' : 'ok'}" style="width:${x.mastery}%"></div></div><b>${fmtPct(x.mastery, 0)}</b></div>`).join('')}</div>` : '<div class="fsra-note" style="margin-bottom:12px">لم تُربط الأسئلة بمهارات بعد. اكتب اسم المهارة أمام كل سؤال، أو حدد عدة أسئلة وعيّن لها مهارة دفعة واحدة. الربط يُحفظ محليًا لهذا النموذج فقط.</div>'}
            <div class="fsra-card">
                <h3 class="fsra-section-title">ربط الأسئلة بالمهارات</h3>
                <div class="fsra-skill-tools">
                    <div class="fsra-field"><label>اسم المهارة للتعيين الجماعي</label><input data-role="bulk-skill" list="fsra-skill-list" placeholder="مثال: الحلقات"></div>
                    <button class="fsra-btn" data-action="assign-skill">تعيين للمحدد</button>
                    <button class="fsra-btn" data-action="clear-skill-selection">إلغاء التحديد</button>
                </div>
                <datalist id="fsra-skill-list">${existingSkills().map(s => `<option value="${esc(s)}"></option>`).join('')}</datalist>
                <div class="fsra-table-wrap"><table class="fsra-table"><thead><tr><th>تحديد</th><th>#</th><th>السؤال</th><th>المهارة</th></tr></thead><tbody>
                    ${state.questions.filter(q => q.points > 0).map(q => `<tr><td><input class="fsra-check" type="checkbox" data-skill-select="${esc(q.id)}" ${state.selectedSkillQuestions.has(q.id) ? 'checked' : ''}></td><td>${q.number}</td><td class="fsra-qtitle">${esc(q.title)}</td><td><input class="fsra-skill-input" data-skill-qid="${esc(q.id)}" list="fsra-skill-list" value="${esc(state.skillMap[q.id] || '')}" placeholder="غير مصنف"></td></tr>`).join('')}
                </tbody></table></div>
            </div>`;
    }

    function createSnapshot(a) {
        const filterText = state.metadataQuestions
            .map(q => state.filters[q.id] ? `${q.title}: ${state.filters[q.id]}` : '')
            .filter(Boolean)
            .join(' | ');
        return {
            id: `snap_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            savedAt: new Date().toISOString(),
            formId: getFormId(),
            title: clean(state.form?.title || document.title),
            filterText,
            summary: {
                count: a.summary.count,
                possible: a.summary.possible,
                averagePercent: round(a.summary.averagePercent, 3),
                passRate: round(a.summary.passRate, 3),
                weakCount: a.summary.weakCount
            },
            students: a.students.slice(0, 5000).map(s => ({
                identityKey: s.identityKey,
                name: s.name,
                percentage: round(s.percentage, 3)
            })),
            questions: a.questions.map(q => ({
                key: canon(q.question.title),
                title: q.question.title,
                mastery: round(q.mastery, 3)
            })),
            skills: a.skills.map(s => ({ skill: s.skill, mastery: round(s.mastery, 3) }))
        };
    }

    function compareWithSnapshot(a, snap) {
        if (!snap) return null;
        const studentMap = new Map(snap.students.map(s => [s.identityKey, s]));
        const studentDeltas = a.students
            .filter(s => studentMap.has(s.identityKey) && !s.identityKey.startsWith('anon:'))
            .map(s => ({
                name: s.name,
                before: studentMap.get(s.identityKey).percentage,
                now: s.percentage,
                delta: s.percentage - studentMap.get(s.identityKey).percentage
            })).sort((x, y) => y.delta - x.delta);

        const qMap = new Map(snap.questions.map(q => [q.key, q]));
        const questionDeltas = a.questions
            .filter(q => qMap.has(canon(q.question.title)))
            .map(q => {
                const old = qMap.get(canon(q.question.title));
                return { title: q.question.title, before: old.mastery, now: q.mastery, delta: q.mastery - old.mastery };
            }).sort((x, y) => y.delta - x.delta);

        const skillMap = new Map((snap.skills || []).map(s => [canon(s.skill), s]));
        const skillDeltas = a.skills.filter(s => skillMap.has(canon(s.skill))).map(s => {
            const old = skillMap.get(canon(s.skill));
            return { skill: s.skill, before: old.mastery, now: s.mastery, delta: s.mastery - old.mastery };
        }).sort((x, y) => y.delta - x.delta);

        return {
            averageDelta: a.summary.averagePercent - snap.summary.averagePercent,
            passDelta: a.summary.passRate - snap.summary.passRate,
            countDelta: a.summary.count - snap.summary.count,
            studentDeltas,
            questionDeltas,
            skillDeltas
        };
    }

    function deltaHtml(value) {
        const cls = value > 0 ? 'fsra-delta-pos' : value < 0 ? 'fsra-delta-neg' : '';
        return `<span class="${cls}">${value > 0 ? '+' : ''}${fmtPct(value)}</span>`;
    }

    function renderCompare(a) {
        const snaps = getSnapshots();
        const selected = snaps.find(s => s.id === state.compareSnapshotId) || null;
        const cmp = compareWithSnapshot(a, selected);
        return `
            <div class="fsra-card" style="margin-bottom:12px">
                <h3 class="fsra-section-title">لقطات الاختبارات والمقارنة</h3>
                <div class="fsra-actions" style="justify-content:flex-start">
                    <button class="fsra-btn primary" data-action="save-snapshot">💾 حفظ لقطة للنتيجة الحالية</button>
                    <select data-role="snapshot-select" style="min-width:280px;padding:8px;border-radius:8px;border:1px solid #d8d1e1"><option value="">اختر لقطة للمقارنة...</option>${snaps.slice().reverse().map(s => `<option value="${esc(s.id)}" ${selected?.id === s.id ? 'selected' : ''}>${esc(s.title)} — ${new Date(s.savedAt).toLocaleString('ar-SA')}${s.filterText ? ` — ${esc(s.filterText)}` : ''}</option>`).join('')}</select>
                    ${selected ? '<button class="fsra-btn danger" data-action="delete-snapshot">حذف اللقطة</button>' : ''}
                </div>
                <div class="fsra-muted" style="margin-top:8px">تُحفظ اللقطات داخل LocalStorage في هذا المتصفح فقط. المقارنة الفردية تعتمد على الحساب المؤسسي أو الاسم، ولا يمكن مطابقة المستجيبين المجهولين بين نموذجين.</div>
            </div>
            ${!selected ? '<div class="fsra-empty">احفظ لقطة أو اختر لقطة سابقة لعرض المقارنة.</div>' : `
                <div class="fsra-grid">
                    ${kpi('تغير المتوسط', `${cmp.averageDelta > 0 ? '+' : ''}${fmtPct(cmp.averageDelta)}`, `${fmtPct(selected.summary.averagePercent)} ← ${fmtPct(a.summary.averagePercent)}`)}
                    ${kpi('تغير الاجتياز', `${cmp.passDelta > 0 ? '+' : ''}${fmtPct(cmp.passDelta)}`, `${fmtPct(selected.summary.passRate)} ← ${fmtPct(a.summary.passRate)}`)}
                    ${kpi('تغير العدد', `${cmp.countDelta > 0 ? '+' : ''}${cmp.countDelta}`, `${selected.summary.count} ← ${a.summary.count}`)}
                    ${kpi('مطابقة أفراد', cmp.studentDeltas.length, 'حسابات/أسماء مشتركة')}
                </div>
                <div class="fsra-two">
                    <div class="fsra-card"><h3 class="fsra-section-title">تغير أداء المستجيبين</h3>${cmp.studentDeltas.length ? `<div class="fsra-table-wrap"><table class="fsra-table"><thead><tr><th>الاسم</th><th>السابق</th><th>الحالي</th><th>التغير</th></tr></thead><tbody>${cmp.studentDeltas.slice(0, 100).map(x => `<tr><td>${esc(state.settings.privacy ? 'مستجيب' : x.name)}</td><td>${fmtPct(x.before)}</td><td>${fmtPct(x.now)}</td><td>${deltaHtml(x.delta)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="fsra-muted">لا توجد هويات مشتركة قابلة للمطابقة.</div>'}</div>
                    <div class="fsra-card"><h3 class="fsra-section-title">تغير إتقان الأسئلة المشتركة</h3>${cmp.questionDeltas.length ? `<div class="fsra-table-wrap"><table class="fsra-table"><thead><tr><th>السؤال</th><th>السابق</th><th>الحالي</th><th>التغير</th></tr></thead><tbody>${cmp.questionDeltas.slice(0, 100).map(x => `<tr><td class="fsra-qtitle">${esc(x.title)}</td><td>${fmtPct(x.before)}</td><td>${fmtPct(x.now)}</td><td>${deltaHtml(x.delta)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="fsra-muted">لا توجد أسئلة متطابقة بالعناوين.</div>'}</div>
                </div>
                ${cmp.skillDeltas.length ? `<div class="fsra-card" style="margin-top:12px"><h3 class="fsra-section-title">تغير المهارات</h3>${cmp.skillDeltas.map(x => `<div class="fsra-reco"><b>${esc(x.skill)}</b> ${fmtPct(x.before)} ← ${fmtPct(x.now)} &nbsp; ${deltaHtml(x.delta)}</div>`).join('')}</div>` : ''}
            `}
        `;
    }

    function renderReports(a) {
        return `
            <div class="fsra-grid">
                <div class="fsra-card"><h3 class="fsra-section-title">🖨️ التقرير الشامل</h3><p class="fsra-muted">ملخص تنفيذي، توزيع التقييمات، مقارنة المجموعات، الأسئلة، المهارات، الطلاب الضعفاء والتوصيات.</p><button class="fsra-btn primary" data-action="print-full">فتح معاينة التقرير</button> <button class="fsra-btn" data-action="print-full-direct">طباعة مباشرة</button></div>
                <div class="fsra-card"><h3 class="fsra-section-title">🔒 تقرير بدون أسماء</h3><p class="fsra-muted">مناسب للمشاركة الإدارية أو العرض؛ يخفي أسماء وحسابات المستجيبين.</p><button class="fsra-btn" data-action="print-private">فتح التقرير المجهول</button> <button class="fsra-btn" data-action="print-private-direct">طباعة مباشرة</button></div>
                <div class="fsra-card"><h3 class="fsra-section-title">📊 Excel</h3><p class="fsra-muted">تصدير ملف SpreadsheetML متعدد الأوراق: ملخص، مستجيبون، أسئلة، مهارات، تدخلات.</p><button class="fsra-btn" data-action="export-excel">تصدير Excel XML</button></div>
                <div class="fsra-card"><h3 class="fsra-section-title">📄 CSV</h3><p class="fsra-muted">تصدير جدول المستجيبين الحالي مع النسب والتقييم والبيانات الوصفية.</p><button class="fsra-btn" data-action="export-csv">تصدير CSV</button></div>
            </div>
            <div class="fsra-card" style="margin-top:12px"><h3 class="fsra-section-title">محتوى التقرير الشامل</h3><div class="fsra-muted">العنوان وبيانات المدرسة/المعلم (إن أُدخلت في الإعدادات) → ملخص الأداء → توزيع التقييمات → مقارنة الفصول/المجموعات → تحليل الأسئلة والمشتتات → المهارات → المستجيبون دون حد ${state.settings.thresholds.acceptable}% → التوصيات. يمكنك حفظه PDF من نافذة الطباعة.</div></div>
        `;
    }

    function renderSettings() {
        const t = state.settings.thresholds;
        const r = state.settings.report;
        return `
            <div class="fsra-card">
                <h3 class="fsra-section-title">حدود التقييم</h3>
                <div class="fsra-note" style="margin-bottom:10px">الإعداد الافتراضي يجعل «ضعيف» أقل من 50%. بقية الحدود قابلة للتعديل لتناسب سياسة الجهة.</div>
                <div class="fsra-form-grid">
                    ${settingInput('حد ممتاز', 'threshold-excellent', t.excellent, 'number')}
                    ${settingInput('حد جيد جدًا', 'threshold-verygood', t.veryGood, 'number')}
                    ${settingInput('حد جيد', 'threshold-good', t.good, 'number')}
                    ${settingInput('حد مقبول (وما دونه ضعيف)', 'threshold-acceptable', t.acceptable, 'number')}
                    ${settingInput('سؤال ضعيف إذا كان الإتقان أقل من', 'weak-question', state.settings.weakQuestion, 'number')}
                    ${settingInput('أولوية عالية إذا كان الإتقان أقل من', 'critical-question', state.settings.highPriorityQuestion, 'number')}
                </div>
            </div>
            <div class="fsra-card" style="margin-top:12px">
                <h3 class="fsra-section-title">رأس التقرير</h3>
                <div class="fsra-form-grid">
                    ${settingInput('اسم المدرسة', 'report-school', r.school)}
                    ${settingInput('اسم المعلم/ة', 'report-teacher', r.teacher)}
                    ${settingInput('المادة', 'report-subject', r.subject)}
                    ${settingInput('الصف/المرحلة', 'report-grade', r.grade)}
                </div>
            </div>
            <div class="fsra-actions" style="justify-content:flex-start;margin-top:12px"><button class="fsra-btn primary" data-action="save-settings">حفظ الإعدادات</button><button class="fsra-btn" data-action="reset-settings">استعادة الافتراضي</button></div>
        `;
    }

    function settingInput(label, role, value, type = 'text') {
        return `<div class="fsra-field"><label>${esc(label)}</label><input type="${type}" data-setting="${role}" value="${esc(value)}" ${type === 'number' ? 'min="0" max="100" step="1"' : ''}></div>`;
    }

    // ============================================================
    // حقوق المطور والتقارير
    // ============================================================

    function aboutScript() {
        alert(
            `${APP.arName} v${APP.version}\n` +
            `تصميم وتطوير: ${DEV.name} (${DEV.handle})\n` +
            `X / Twitter: @${DEV.handle}\n` +
            `Snapchat: ${DEV.handle}\n` +
            `GreasyFork: ${DEV.greasy}\n` +
            '© 2026 Mohammed Almalki (M0HM3D85) — جميع الحقوق محفوظة.'
        );
    }

    function developerFooterHtml() {
        return `
            <div class="footer">
                تصميم وتطوير: <b>${esc(DEV.name)} (${esc(DEV.handle)})</b>
                — © 2026 جميع الحقوق محفوظة.<br>
                GreasyFork: ${esc(DEV.greasy)}
                — X: @${esc(DEV.handle)}
                — Snapchat: ${esc(DEV.handle)}
            </div>
        `;
    }

    function openHtmlReport(html, title = 'تقرير تحليل النتائج') {
        try {
            const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const w = window.open(url, '_blank');

            if (!w) {
                URL.revokeObjectURL(url);
                toast('المتصفح منع فتح التقرير. اسمح بالنوافذ المنبثقة لهذه الصفحة.', 'error');
                return null;
            }

            setTimeout(() => URL.revokeObjectURL(url), 60000);

            try {
                w.document.title = title;
            } catch (_) {}

            return w;
        } catch (err) {
            console.error(`[${APP.name}] report`, err);
            toast('تعذر فتح التقرير.', 'error');
            return null;
        }
    }

    async function printHtmlReport(html) {
        const frame = document.createElement('iframe');

        Object.assign(frame.style, {
            position: 'fixed',
            left: '-10000px',
            top: '0',
            width: '1px',
            height: '1px',
            opacity: '0',
            border: '0'
        });

        document.body.appendChild(frame);

        try {
            const doc = frame.contentDocument;
            doc.open();
            doc.write(html);
            doc.close();
            await sleep(350);
            frame.contentWindow.focus();
            frame.contentWindow.print();
        } catch (err) {
            console.error(`[${APP.name}] print`, err);
            toast('تعذر تشغيل الطباعة.', 'error');
        } finally {
            setTimeout(() => frame.remove(), 60000);
        }
    }

    // ============================================================
    // Reports and exports
    // ============================================================

    function currentFilterDescription() {
        const parts = state.metadataQuestions.map(q => state.filters[q.id] ? `${q.title}: ${state.filters[q.id]}` : '').filter(Boolean);
        if (state.search) parts.push(`بحث: ${state.search}`);
        return parts.join(' — ') || 'جميع الاستجابات';
    }

    function reportCss() {
        const t = detectFormsTheme();
        return `
@page{size:A4;margin:12mm}
*{box-sizing:border-box}
body{font-family:Tahoma,Arial,sans-serif;direction:rtl;color:#222;margin:0;font-size:11px;line-height:1.55;background:#fff}
.toolbar{position:sticky;top:0;background:${t.dark};color:white;padding:10px 14px;display:flex;gap:8px;z-index:5}
.toolbar button{padding:8px 14px;border:0;border-radius:6px;cursor:pointer;background:#fff;color:${t.dark};font-weight:700}
.report{max-width:190mm;margin:0 auto;padding:4mm 0}
.header{border-bottom:3px solid ${t.primary};padding:8px 0 12px;margin-bottom:14px}
.header h1{margin:0;color:${t.dark};font-size:22px}
.meta{display:grid;grid-template-columns:1fr 1fr;gap:3px 16px;margin-top:8px}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin:12px 0}
.kpi{border:1px solid ${t.border};border-radius:8px;padding:8px;background:${t.softer}}
.kpi b{display:block;font-size:17px;color:${t.dark}}
.section{margin:16px 0;break-inside:avoid}
.section h2{font-size:15px;color:${t.dark};border-bottom:1px solid ${t.border};padding-bottom:5px}
.barrow{display:grid;grid-template-columns:130px 1fr 45px;gap:6px;align-items:center;margin:5px 0}
.bar{height:8px;background:#eee;border-radius:9px;overflow:hidden}
.fill{height:100%;background:${t.primary}}
.fill.weak{background:#b93636}
table{width:100%;border-collapse:collapse;margin-top:7px}
th,td{border:1px solid #ddd;padding:5px 6px;text-align:right;vertical-align:top}
th{background:${t.soft};color:${t.dark}}
.weakrow td{background:#fff4f4}
.page{break-before:page}
.note{background:${t.softer};border-right:3px solid ${t.primary};padding:7px;border-radius:6px;margin:5px 0}
.footer{margin-top:20px;border-top:1px solid ${t.border};padding-top:7px;color:#777;font-size:9px}
.footer b{color:${t.dark}}
@media print{.toolbar{display:none}.report{max-width:none;padding:0}}
        `;
    }

    function reportHeaderHtml(a, anonymize) {
        const r = state.settings.report;
        return `<div class="header"><h1>تقرير تحليل نتائج الاختبار</h1><div><b>${esc(state.form?.title || document.title)}</b></div><div class="meta">
            ${r.school ? `<div><b>المدرسة:</b> ${esc(r.school)}</div>` : ''}
            ${r.teacher ? `<div><b>المعلم/ة:</b> ${esc(r.teacher)}</div>` : ''}
            ${r.subject ? `<div><b>المادة:</b> ${esc(r.subject)}</div>` : ''}
            ${r.grade ? `<div><b>الصف/المرحلة:</b> ${esc(r.grade)}</div>` : ''}
            <div><b>النطاق:</b> ${esc(currentFilterDescription())}</div><div><b>تاريخ التقرير:</b> ${new Date().toLocaleString('ar-SA')}</div>
            <div><b>الهوية:</b> ${anonymize ? 'مخفية' : 'ظاهرة عند توفرها'}</div>
        </div></div>`;
    }

    function buildFullReport(a, anonymize = false) {
        const s = a.summary;
        const maxEval = Math.max(1, maxValue(Object.values(s.evalCounts), 1));
        const weakStudents = a.students.filter(x => x.percentage < state.settings.thresholds.acceptable).sort((x, y) => x.percentage - y.percentage);
        const qRows = Array.from(a.questions).sort((x, y) => x.mastery - y.mastery);
        const body = `
            <div class="toolbar">تقرير جاهز — استخدم Ctrl+P أو أمر الطباعة في المتصفح للحفظ PDF.</div>
            <div class="report">
                ${reportHeaderHtml(a, anonymize)}
                ${s.manualQuestionCount && s.pendingManualCount ? `<div class="note" style="background:#fff4e5;border-right-color:#d47a00;color:#6b4200;font-weight:700">⚠️ تنبيه مهم: يحتوي هذا النموذج على ${s.manualQuestionCount} سؤال/أسئلة تحتاج تصحيحًا يدويًا. لا تستخدم التحليل النهائي إلا بعد الانتهاء من التصحيح اليدوي لجميع الاستجابات في Microsoft Forms. لا يزال ${s.pendingManualCount} تصحيحًا يدويًا معلّقًا لدى ${s.studentsPendingManual} مستجيب/مستجيبين.</div>` : ''}
                <div class="kpis">
                    <div class="kpi"><span>المستجيبون</span><b>${s.count}</b></div>
                    <div class="kpi"><span>متوسط الدرجة</span><b>${fmtNum(s.averageScore)}/${fmtNum(s.possible,0)}</b><small>${fmtPct(s.averagePercent)}</small></div>
                    <div class="kpi"><span>نسبة الاجتياز</span><b>${fmtPct(s.passRate)}</b><small>الحد ${state.settings.thresholds.acceptable}%</small></div>
                    <div class="kpi"><span>ضعيف</span><b>${s.weakCount}</b><small>أقل من ${state.settings.thresholds.acceptable}%</small></div>
                    <div class="kpi"><span>الوسيط</span><b>${fmtNum(s.medianScore)}</b></div>
                    <div class="kpi"><span>أعلى / أدنى</span><b>${fmtNum(s.maxScore,0)} / ${fmtNum(s.minScore,0)}</b></div>
                    <div class="kpi"><span>متوسط الزمن</span><b>${fmtDuration(s.avgDuration)}</b></div>
                    <div class="kpi"><span>ثبات α</span><b>${Number.isFinite(s.alpha) ? fmtNum(s.alpha,3) : '—'}</b></div>
                </div>
                <div class="section"><h2>الملخص التنفيذي والتوصيات</h2>${a.recommendations.map(x => `<div class="note">${esc(x)}</div>`).join('')}</div>
                <div class="section"><h2>توزيع التقييمات</h2>${Object.entries(s.evalCounts).map(([label,count]) => `<div class="barrow"><span>${esc(label)}</span><div class="bar"><div class="fill ${label==='ضعيف'?'weak':''}" style="width:${count/maxEval*100}%"></div></div><b>${count}</b></div>`).join('')}</div>
                ${a.groups.map(g => `<div class="section"><h2>مقارنة حسب: ${esc(g.question.title)}</h2><table><thead><tr><th>المجموعة</th><th>العدد</th><th>المتوسط</th><th>الاجتياز</th><th>ضعيف</th></tr></thead><tbody>${g.groups.map(x => `<tr><td>${esc(x.value)}</td><td>${x.count}</td><td>${fmtPct(x.averagePercent)}</td><td>${fmtPct(x.passRate)}</td><td>${x.weakCount}</td></tr>`).join('')}</tbody></table></div>`).join('')}
                ${a.skills.length ? `<div class="section"><h2>تحليل المهارات</h2><table><thead><tr><th>المهارة</th><th>عدد الأسئلة</th><th>الإتقان</th></tr></thead><tbody>${a.skills.map(x=>`<tr class="${x.mastery<state.settings.weakQuestion?'weakrow':''}"><td>${esc(x.skill)}</td><td>${x.questions}</td><td>${fmtPct(x.mastery)}</td></tr>`).join('')}</tbody></table></div>` : ''}
                <div class="section page"><h2>تحليل الأسئلة</h2><table><thead><tr><th>#</th><th>السؤال</th><th>التصحيح</th><th>الإتقان</th><th>كامل</th><th>جزئي</th><th>صفر</th><th>معلّق</th><th>التمييز D</th><th>أقوى مشتت خاطئ</th></tr></thead><tbody>${qRows.map(q=>`<tr class="${q.gradedCount>0&&q.mastery<state.settings.weakQuestion?'weakrow':''}"><td>${q.question.number}</td><td>${esc(q.question.title)}</td><td>${esc(q.gradingMode)}</td><td>${q.gradedCount?fmtPct(q.mastery):'—'}</td><td>${q.correct}</td><td>${q.partial}</td><td>${q.wrong}</td><td>${q.pending}</td><td>${Number.isFinite(q.discrimination)?fmtNum(q.discrimination,2):'—'}</td><td>${q.topWrong?`${esc(q.topWrong.answer)} (${fmtPct(q.topWrong.percent)})`:'—'}</td></tr>`).join('')}</tbody></table></div>
                <div class="section page"><h2>المستجيبون دون حد ${state.settings.thresholds.acceptable}%</h2>${weakStudents.length ? `<table><thead><tr><th>#</th><th>الاسم/الهوية</th><th>الدرجة</th><th>النسبة</th><th>التقييم</th><th>البيانات الوصفية</th></tr></thead><tbody>${weakStudents.map((x,i)=>`<tr class="weakrow"><td>${i+1}</td><td>${esc(anonymize?`مستجيب ${String(i+1).padStart(2,'0')}`:x.name)}</td><td>${fmtNum(x.earned,1)}/${fmtNum(x.possible,1)}</td><td>${fmtPct(x.percentage)}</td><td>${esc(evaluation(x.percentage).label)}</td><td>${esc(metadataSummaryForStudent(x)||'—')}</td></tr>`).join('')}</tbody></table>` : '<div>لا يوجد مستجيبون تحت الحد.</div>'}</div>
                ${developerFooterHtml()}
            </div>`;
        return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير تحليل النتائج</title><style>${reportCss()}</style></head><body>${body}</body></html>`;
    }

    function openPrintReport(anonymize = false) {
        const a = currentAnalysis();
        const html = buildFullReport(a, anonymize);
        openHtmlReport(
            html,
            anonymize ? 'تقرير تحليل النتائج — بدون أسماء' : 'تقرير تحليل النتائج'
        );
    }

    function openStudentReport(student) {
        const questions = student.details.filter(d => d.possible > 0);
        const wrong = questions.filter(d => d.status === 'wrong' || d.status === 'blank' || d.status === 'pending' || (d.status === 'manual' && Number(d.earned) < Number(d.possible)));
        const name = state.settings.privacy ? 'مستجيب' : student.name;
        const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير ${esc(name)}</title><style>${reportCss()}</style></head><body>
            <div class="toolbar">تقرير جاهز — استخدم Ctrl+P أو أمر الطباعة في المتصفح للحفظ PDF.</div><div class="report">
            <div class="header"><h1>تقرير أداء فردي</h1><div><b>${esc(name)}</b></div><div class="meta"><div><b>الاختبار:</b> ${esc(state.form?.title||'')}</div><div><b>التقييم:</b> ${esc(evaluation(student.percentage).label)}</div><div><b>الدرجة:</b> ${fmtNum(student.earned,1)} / ${fmtNum(student.possible,1)}</div><div><b>النسبة:</b> ${fmtPct(student.percentage)}</div><div><b>زمن الحل:</b> ${fmtDuration(student.durationSeconds)}</div><div><b>البيانات:</b> ${esc(metadataSummaryForStudent(student)||'—')}</div></div></div>
            ${student.pendingManualCount ? `<div class="note" style="background:#fff4e5;border-right-color:#d47a00;color:#6b4200;font-weight:700">⚠️ هذا التقرير غير نهائي: لدى هذا المستجيب ${student.pendingManualCount} سؤال/أسئلة بانتظار التصحيح اليدوي في Microsoft Forms. لا تعتمد النتيجة حتى اكتمال التصحيح.</div>` : ''}
            <div class="section"><h2>ملخص</h2><div class="kpis"><div class="kpi"><span>صحيح</span><b>${questions.filter(d=>d.status==='correct').length}</b></div><div class="kpi"><span>خطأ/فارغ</span><b>${wrong.length}</b></div><div class="kpi"><span>النسبة</span><b>${fmtPct(student.percentage)}</b></div><div class="kpi"><span>التقييم</span><b>${esc(evaluation(student.percentage).label)}</b></div></div></div>
            <div class="section"><h2>الأسئلة التي تحتاج مراجعة</h2>${wrong.length?`<table><thead><tr><th>#</th><th>السؤال</th><th>إجابة المستجيب</th><th>الإجابة الصحيحة</th></tr></thead><tbody>${wrong.map(d=>`<tr><td>${d.number}</td><td>${esc(d.title)}</td><td>${esc(d.values.join(' | ')||'بدون إجابة')}</td><td>${d.gradingSource==='manual'?`درجة Forms: ${fmtNum(Number(d.earned),1)} / ${fmtNum(Number(d.possible),1)}`:d.status==='pending'?'بانتظار التصحيح في Forms':esc(d.answerKey.join(' | '))}</td></tr>`).join('')}</tbody></table>`:'<div>لم تُسجل أخطاء في الأسئلة التي أمكن تصحيحها آليًا.</div>'}</div>
            ${developerFooterHtml()}</div></body></html>`;
        openHtmlReport(html, `تقرير أداء فردي — ${name}`);
    }

    function exportCsv(a) {
        const metaHeaders = state.metadataQuestions.map(q => q.title);
        const headers = ['الاسم','الحساب','مصدر الهوية','الدرجة','من','النسبة','التقييم','زمن الحل',...metaHeaders];
        const rows = a.students.map((s,i) => [
            state.settings.privacy ? `مستجيب ${String(i+1).padStart(2,'0')}` : s.name,
            state.settings.privacy ? '' : s.responder,
            s.identitySource,
            s.earned,
            s.possible,
            round(s.percentage,2),
            evaluation(s.percentage).label,
            fmtDuration(s.durationSeconds),
            ...state.metadataQuestions.map(q => (s.metadata[q.id]||[]).join(' | '))
        ]);
        const csvCell = v => `"${String(v??'').replace(/"/g,'""')}"`;
        const csv = '\uFEFF' + [headers,...rows].map(r => r.map(csvCell).join(',')).join('\r\n');
        downloadBlob(`${slug(state.form?.title)} - الطلاب.csv`, new Blob([csv], {type:'text/csv;charset=utf-8'}));
    }

    function spreadsheetCell(value) {
        const n = Number(value);
        const isNumber = value !== '' && value != null && Number.isFinite(n) && typeof value !== 'boolean';
        return `<Cell><Data ss:Type="${isNumber?'Number':'String'}">${xmlEsc(isNumber?n:String(value??''))}</Data></Cell>`;
    }

    function worksheet(name, rows) {
        return `<Worksheet ss:Name="${xmlEsc(name.slice(0,31))}"><Table>${rows.map(r=>`<Row>${r.map(spreadsheetCell).join('')}</Row>`).join('')}</Table></Worksheet>`;
    }

    function exportExcel(a) {
        const summaryRows = [
            ['المؤشر','القيمة'],
            ['اسم الاختبار',state.form?.title||''],['النطاق',currentFilterDescription()],['عدد المستجيبين',a.summary.count],['الدرجة الكلية',a.summary.possible],
            ['متوسط الدرجة',round(a.summary.averageScore,2)],['متوسط النسبة',round(a.summary.averagePercent,2)],['الوسيط',round(a.summary.medianScore,2)],
            ['أعلى درجة',a.summary.maxScore],['أدنى درجة',a.summary.minScore],['الانحراف المعياري',round(a.summary.stdDevScore,3)],['نسبة الاجتياز',round(a.summary.passRate,2)],
            ['عدد الضعيف',a.summary.weakCount],['Cronbach Alpha',Number.isFinite(a.summary.alpha)?round(a.summary.alpha,4):'']
        ];
        const metaHeaders = state.metadataQuestions.map(q=>q.title);
        const studentRows = [['الاسم','الحساب','مصدر الهوية','الدرجة','من','النسبة','التقييم','الزمن',...metaHeaders], ...a.students.map((s,i)=>[
            state.settings.privacy?`مستجيب ${i+1}`:s.name,state.settings.privacy?'':s.responder,s.identitySource,s.earned,s.possible,round(s.percentage,2),evaluation(s.percentage).label,fmtDuration(s.durationSeconds),...state.metadataQuestions.map(q=>(s.metadata[q.id]||[]).join(' | '))
        ])];
        const questionRows = [['#','السؤال','طريقة التصحيح','الإجابة الصحيحة','الإتقان','كامل','جزئي','صفر','فارغ','معلّق','الصعوبة','التمييز D','ارتباط السؤال','أقوى مشتت خاطئ','نسبة المشتت'], ...a.questions.map(q=>[
            q.question.number,q.question.title,q.gradingMode,q.question.answerKey.join(' | '),q.gradedCount?round(q.mastery,2):'',q.correct,q.partial,q.wrong,q.blank,q.pending,q.difficulty,Number.isFinite(q.discrimination)?round(q.discrimination,4):'',Number.isFinite(q.itemTotalCorrelation)?round(q.itemTotalCorrelation,4):'',q.topWrong?.answer||'',q.topWrong?round(q.topWrong.percent,2):''
        ])];
        const skillRows = [['المهارة','عدد الأسئلة','الإتقان'],...a.skills.map(s=>[s.skill,s.questions,round(s.mastery,2)])];
        const weakRows = [['الاسم','الدرجة','من','النسبة','التقييم'],...a.students.filter(s=>s.percentage<state.settings.thresholds.acceptable).sort((x,y)=>x.percentage-y.percentage).map((s,i)=>[state.settings.privacy?`مستجيب ${i+1}`:s.name,s.earned,s.possible,round(s.percentage,2),evaluation(s.percentage).label])];
        const xml = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">${worksheet('ملخص',summaryRows)}${worksheet('المستجيبون',studentRows)}${worksheet('الأسئلة',questionRows)}${worksheet('المهارات',skillRows)}${worksheet('يحتاجون دعم',weakRows)}</Workbook>`;
        downloadBlob(`${slug(state.form?.title)} - تحليل النتائج.xml`, new Blob(['\uFEFF'+xml], {type:'application/vnd.ms-excel;charset=utf-8'}));
    }

    // ============================================================
    // Events
    // ============================================================

    function bindEvents() {
        state.overlay.addEventListener('click', async e => {
            const tab = e.target.closest('[data-tab]');
            if (tab) {
                state.activeTab = tab.dataset.tab;
                state.expandedQuestionId = '';
                renderApp();
                return;
            }
            const actionEl = e.target.closest('[data-action]');
            if (!actionEl) return;
            const action = actionEl.dataset.action;
            if (action === 'about') return aboutScript();
            if (action === 'print-full-direct') return printHtmlReport(buildFullReport(currentAnalysis(), false));
            if (action === 'print-private-direct') return printHtmlReport(buildFullReport(currentAnalysis(), true));
            if (action === 'close') return closeApp();
            if (action === 'retry' || action === 'refresh') return loadData(true);
            if (action === 'print-full') return openPrintReport(false);
            if (action === 'print-private') return openPrintReport(true);
            if (action === 'export-csv') return exportCsv(currentAnalysis());
            if (action === 'export-excel') return exportExcel(currentAnalysis());
            if (action === 'toggle-question') {
                state.expandedQuestionId = state.expandedQuestionId === actionEl.dataset.qid ? '' : actionEl.dataset.qid;
                renderApp(); return;
            }
            if (action === 'student-report') {
                const s = state.students.find(x => x.identityKey === actionEl.dataset.studentKey);
                if (s) openStudentReport(s);
                return;
            }
            if (action === 'assign-skill') {
                const input = state.overlay.querySelector('[data-role="bulk-skill"]');
                const skill = clean(input?.value || '');
                if (!skill) return toast('اكتب اسم المهارة أولًا.', 'error');
                if (!state.selectedSkillQuestions.size) return toast('حدد سؤالًا واحدًا على الأقل.', 'error');
                for (const qid of state.selectedSkillQuestions) state.skillMap[qid] = skill;
                saveSkillMap(); state.selectedSkillQuestions.clear(); toast('تم تعيين المهارة.', 'success'); renderApp(); return;
            }
            if (action === 'clear-skill-selection') {
                state.selectedSkillQuestions.clear(); renderApp(); return;
            }
            if (action === 'save-snapshot') {
                try {
                    const snaps = getSnapshots();
                    const snap = createSnapshot(currentAnalysis());
                    snaps.push(snap); setSnapshots(snaps); state.compareSnapshotId = snap.id;
                    toast('تم حفظ اللقطة محليًا.', 'success'); renderApp();
                } catch (err) { toast('تعذر حفظ اللقطة؛ قد تكون مساحة التخزين المحلية ممتلئة.', 'error'); }
                return;
            }
            if (action === 'delete-snapshot') {
                if (!state.compareSnapshotId) return;
                const snaps = getSnapshots().filter(s => s.id !== state.compareSnapshotId);
                setSnapshots(snaps); state.compareSnapshotId = ''; renderApp(); toast('تم حذف اللقطة.', 'success'); return;
            }
            if (action === 'save-settings') return saveSettingsFromUi();
            if (action === 'reset-settings') {
                state.settings = structuredClone(DEFAULT_SETTINGS); saveSettings(); renderApp(); toast('تمت استعادة الإعدادات الافتراضية.', 'success'); return;
            }
        });

        state.overlay.addEventListener('change', e => {
            const filter = e.target.closest('[data-filter-qid]');
            if (filter) {
                state.filters[filter.dataset.filterQid] = filter.value;
                renderApp(); return;
            }
            if (e.target.matches('[data-role="privacy-toggle"]')) {
                state.settings.privacy = e.target.checked; saveSettings(); renderApp(); return;
            }
            if (e.target.matches('[data-skill-qid]')) {
                const qid = e.target.dataset.skillQid;
                const skill = clean(e.target.value);
                if (skill) state.skillMap[qid] = skill; else delete state.skillMap[qid];
                saveSkillMap(); renderApp(); return;
            }
            if (e.target.matches('[data-skill-select]')) {
                const qid = e.target.dataset.skillSelect;
                if (e.target.checked) state.selectedSkillQuestions.add(qid); else state.selectedSkillQuestions.delete(qid);
                return;
            }
            if (e.target.matches('[data-role="snapshot-select"]')) {
                state.compareSnapshotId = e.target.value; renderApp(); return;
            }
        });

        let searchTimer = null;
        state.overlay.addEventListener('input', e => {
            if (e.target.matches('[data-role="student-search"]')) {
                clearTimeout(searchTimer);
                searchTimer = setTimeout(() => { state.search = e.target.value; renderApp(); }, 250);
            }
        });

        state.overlay.addEventListener('click', e => {
            const th = e.target.closest('th[data-sort]');
            if (th) {
                const key = th.dataset.sort;
                state.studentSort = { key, dir: state.studentSort.key === key && state.studentSort.dir === 'desc' ? 'asc' : 'desc' };
                renderApp();
            }
            const qth = e.target.closest('th[data-sortq]');
            if (qth) {
                const key = qth.dataset.sortq;
                state.questionSort = { key, dir: state.questionSort.key === key && state.questionSort.dir === 'asc' ? 'desc' : 'asc' };
                renderApp();
            }
        });
    }

    function saveSettingsFromUi() {
        const get = role => state.overlay.querySelector(`[data-setting="${role}"]`)?.value ?? '';
        const excellent = num(get('threshold-excellent'), 90);
        const veryGood = num(get('threshold-verygood'), 80);
        const good = num(get('threshold-good'), 70);
        const acceptable = num(get('threshold-acceptable'), 50);
        if (!(excellent > veryGood && veryGood > good && good > acceptable && acceptable >= 0 && excellent <= 100)) {
            return toast('يجب أن تكون الحدود مرتبة: ممتاز > جيد جدًا > جيد > مقبول، وكلها بين 0 و100.', 'error');
        }
        state.settings.thresholds = { excellent, veryGood, good, acceptable };
        state.settings.weakQuestion = num(get('weak-question'), 50);
        state.settings.highPriorityQuestion = num(get('critical-question'), 30);
        state.settings.report = {
            school: clean(get('report-school')),
            teacher: clean(get('report-teacher')),
            subject: clean(get('report-subject')),
            grade: clean(get('report-grade'))
        };
        saveSettings(); renderApp(); toast('تم حفظ الإعدادات.', 'success');
    }

    // ============================================================
    // Boot
    // ============================================================

    const observer = new MutationObserver(() => ensureLauncher());
    observer.observe(document.documentElement, { childList: true, subtree: true });
    ensureLauncher();
    setInterval(ensureLauncher, 2500);

    window.FormsSmartResultsAnalyzer = {
        open: openApp,
        refresh: () => loadData(true),
        version: APP.version,
        developer: DEV.handle
    };

    console.log(`${APP.arName} v${APP.version} | ${DEV.name} (${DEV.handle})`);
})();

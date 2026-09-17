// ==UserScript==
// @name         Fares+ | فارس+
// @namespace    https://greasyfork.org/users/1636459
// @version      1.1.0
// @description  تحسين شامل لتجربة نظام فارس: مدير أنشطة التطوير المهني، استيراد Excel والشهادات PDF/صور، تحليل Gemini اختياري، مسودات وتقارير.
// @author       Mohammed Almalki (M0HM3D85)
// @homepageURL  https://greasyfork.org/en/users/1636459-m0hm3d85
// @supportURL   https://github.com/M0HM3D85/teacher-userscripts/issues
// @copyright    2026, Mohammed Almalki (M0HM3D85)
// @license      All Rights Reserved
// @match        https://sshr.moe.gov.sa/OA_HTML/*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      generativelanguage.googleapis.com
// @require      https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js
// @require      https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js
// @noframes
// @downloadURL https://update.greasyfork.org/scripts/593928/Fares%2B%20%7C%20%D9%81%D8%A7%D8%B1%D8%B3%2B.user.js
// @updateURL https://update.greasyfork.org/scripts/593928/Fares%2B%20%7C%20%D9%81%D8%A7%D8%B1%D8%B3%2B.meta.js
// ==/UserScript==

/*
=========================================================================
 Fares+ | فارس+

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

    // With GM_* grants Tampermonkey runs فارس+ in an isolated userscript
    // sandbox. Keep the small diagnostic APIs visible from DevTools without
    // exposing the private Gemini key.
    const pageWindow = (typeof unsafeWindow !== 'undefined' && unsafeWindow) ? unsafeWindow : window;

    const META = Object.freeze({
        id: 'm0hm3d85-fares-plus',
        name: 'فارس+',
        version: '1.1.0',
        author: 'Mohammed Almalki (M0HM3D85)'
    });

    const DEV = Object.freeze({
        name: 'Mohammed Almalki',
        handle: 'M0HM3D85',
        greasy: 'https://greasyfork.org/en/users/1636459-m0hm3d85',
        x: 'https://x.com/M0HM3D85',
        snap: 'https://www.snapchat.com/add/M0HM3D85'
    });

    function aboutScript() {
        alert(
            `فارس+ v${META.version}\n` +
            `تصميم وتطوير: ${DEV.name} (${DEV.handle})\n` +
            `X / Twitter: @${DEV.handle}\n` +
            `Snapchat: ${DEV.handle}\n` +
            `GreasyFork: ${DEV.greasy}\n` +
            '© 2026 Mohammed Almalki (M0HM3D85) — جميع الحقوق محفوظة.'
        );
    }

    function developerCreditHtml() {
        return `
            <span class="${META.id}-dev-credit">
                تصميم وتطوير: <b>${DEV.name} (${DEV.handle})</b>
                — © 2026 جميع الحقوق محفوظة.
                <a href="${DEV.greasy}" target="_blank" rel="noopener">GreasyFork</a>
                <a href="${DEV.x}" target="_blank" rel="noopener">X: @${DEV.handle}</a>
                <a href="${DEV.snap}" target="_blank" rel="noopener">Snapchat</a>
            </span>
        `;
    }

    const IDS = Object.freeze({
        style: `${META.id}-style`,
        launcher: `${META.id}-launcher`,
        privacy: `${META.id}-privacy-toggle`,
        overlay: `${META.id}-overlay`,
        toast: `${META.id}-toast`
    });

    const STORAGE = Object.freeze({
        settings: `${META.id}-settings-v2`,
        navIndex: `${META.id}-nav-index-v2`,
        history: `${META.id}-history-v2`
    });

    const DEFAULT_SETTINGS = Object.freeze({
        enabled: true,
        launcher: true,
        navigation: true,
        privacyMode: false
    });

    const state = {
        settings: loadJSON(STORAGE.settings, DEFAULT_SETTINGS),
        modules: new Map(),
        mountedModules: new Set(),
        observer: null,
        refreshQueued: false,
        privacyTimer: null,
        privacyIdleHandle: null,
        privacyPendingRoots: new Set(),
        privacyTextMasks: new Map(),
        nav: {
            opening: false,
            openToken: 0,
            ready: false,
            depth: 1,
            path: [],
            currentItems: [],
            results: [],
            activeIndex: 0,
            cache: loadNavCache(),
            actionToken: 0
        }
    };

    // =========================================================
    // Utilities
    // =========================================================

    function loadJSON(key, fallback) {
        try {
            const parsed = JSON.parse(localStorage.getItem(key) || 'null');
            return parsed && typeof parsed === 'object'
                ? (Array.isArray(fallback) ? parsed : { ...fallback, ...parsed })
                : (Array.isArray(fallback) ? [...fallback] : { ...fallback });
        } catch (_) {
            return Array.isArray(fallback) ? [...fallback] : { ...fallback };
        }
    }

    function saveJSON(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (_) {}
    }

    function wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function clean(value = '') {
        return String(value).replace(/\s+/g, ' ').trim();
    }

    function normalizeArabic(value = '') {
        return clean(value)
            .toLowerCase()
            .replace(/[أإآٱ]/g, 'ا')
            .replace(/ى/g, 'ي')
            .replace(/ة/g, 'ه')
            .replace(/ؤ/g, 'و')
            .replace(/ئ/g, 'ي')
            .replace(/ـ/g, '')
            .replace(/[\u064B-\u065F\u0670]/g, '')
            .replace(/[^\u0600-\u06FFa-zA-Z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function textOf(element) {
        return clean(element?.innerText || element?.textContent || '');
    }

    function esc(value = '') {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function isVisible(element) {
        if (!element) return false;
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return (
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            Number(style.opacity || 1) !== 0 &&
            rect.width > 0 &&
            rect.height > 0
        );
    }

    function sameText(a, b) {
        return normalizeArabic(a) === normalizeArabic(b);
    }

    function pathKey(path = [], label = '') {
        return [...path, label].map(normalizeArabic).join(' > ');
    }

    function pageFingerprint() {
        const url = new URL(location.href);
        return {
            host: location.host,
            path: location.pathname,
            title: clean(document.title),
            oaFunc: url.searchParams.get('OAFunc') || '',
            page: url.searchParams.get('page') || '',
            headings: [...document.querySelectorAll('h1,h2,h3')]
                .map(textOf)
                .filter(Boolean)
                .slice(0, 8)
        };
    }

    function toast(message) {
        let element = document.getElementById(IDS.toast);
        if (!element) {
            element = document.createElement('div');
            element.id = IDS.toast;
            document.body.appendChild(element);
        }
        element.textContent = message;
        element.classList.add('show');
        clearTimeout(element._m0Timer);
        element._m0Timer = setTimeout(() => element.classList.remove('show'), 2600);
    }

    function addHistory(label, path) {
        const history = loadJSON(STORAGE.history, []);
        const key = pathKey(path, label);
        const next = [
            { label, path: [...path], at: Date.now() },
            ...history.filter(item => pathKey(item.path || [], item.label) !== key)
        ].slice(0, 25);
        saveJSON(STORAGE.history, next);
    }

    function loadNavCache() {
        const raw = loadJSON(STORAGE.navIndex, []);
        return Array.isArray(raw) ? raw : [];
    }

    function saveNavCache() {
        const compact = state.nav.cache
            .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0))
            .slice(0, 1500);
        state.nav.cache = compact;
        saveJSON(STORAGE.navIndex, compact);
    }

    // =========================================================
    // Module registry
    // =========================================================

    function registerModule(module) {
        if (!module?.id || typeof module.match !== 'function' || typeof module.mount !== 'function') {
            console.warn('[فارس+] Module غير صالح:', module);
            return;
        }
        state.modules.set(module.id, module);
    }

    async function mountMatchingModules() {
        const context = {
            meta: META,
            page: pageFingerprint(),
            utils: { clean, normalizeArabic, textOf, esc, wait, toast }
        };

        for (const [id, module] of state.modules) {
            let matched = false;
            try {
                matched = !!module.match(context);
            } catch (error) {
                console.error(`[فارس+] match failed: ${id}`, error);
            }

            if (!matched) {
                if (state.mountedModules.has(id) && typeof module.unmount === 'function') {
                    try { await module.unmount(context); } catch (error) {
                        console.error(`[فارس+] unmount failed: ${id}`, error);
                    }
                    state.mountedModules.delete(id);
                }
                continue;
            }

            if (state.mountedModules.has(id)) continue;

            try {
                await module.mount(context);
                state.mountedModules.add(id);
            } catch (error) {
                console.error(`[فارس+] mount failed: ${id}`, error);
            }
        }
    }

    function queueModuleRefresh() {
        if (state.refreshQueued) return;
        state.refreshQueued = true;
        setTimeout(async () => {
            state.refreshQueued = false;
            await mountMatchingModules();
            ensureLauncher();
        }, 120);
    }

    // =========================================================
    // Shared UI
    // =========================================================


    // =========================================================
    // Global Privacy / Presentation Mode
    // =========================================================
    const LOGIN_PHRASE_RE = /تم\s+تسجيل\s+الدخول\s+باسم/i;
    const LOGIN_ID_RE = /(?:\d{6,20}|[A-Za-z0-9._-]{6,})/;

    function isFaresPlusNode(node) {
        const el = node instanceof Element
            ? node
            : node?.parentElement;

        return !!(
            el?.closest?.(
                `#${IDS.launcher},#${IDS.privacy},#${IDS.overlay},#${IDS.toast},` +
                `[id^="${META.id}-"]`
            )
        );
    }

    function loginTail(text='') {
        const value = clean(text);
        const match = value.match(LOGIN_PHRASE_RE);

        if (!match) return '';

        return clean(
            value.slice(
                (match.index || 0) + match[0].length
            )
        );
    }

    function hasLoginIdentityAfterPhrase(el) {
        if (!el) return false;

        const text = clean(el.textContent || '');

        if (!LOGIN_PHRASE_RE.test(text)) {
            return false;
        }

        const tail = loginTail(text);

        if (LOGIN_ID_RE.test(tail)) {
            return true;
        }

        // قد تكون العبارة والهوية في عنصرين شقيقين.
        return [
            ...el.querySelectorAll(
                'b,strong,span,font,a'
            )
        ].some(child => {
            const value = clean(child.textContent || '');

            return (
                value.length > 0 &&
                value.length <= 40 &&
                LOGIN_ID_RE.test(value) &&
                !LOGIN_PHRASE_RE.test(value)
            );
        });
    }

    function findLoginContainerFast(root = document.body) {
        if (!root) return null;

        const scope =
            root.nodeType === Node.TEXT_NODE
                ? root.parentElement
                : root;

        if (
            !(scope instanceof Element) &&
            scope !== document.body
        ) {
            return null;
        }

        const walker = document.createTreeWalker(
            scope,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode(node) {
                    if (isFaresPlusNode(node)) {
                        return NodeFilter.FILTER_REJECT;
                    }

                    return LOGIN_PHRASE_RE.test(
                        clean(node.nodeValue || '')
                    )
                        ? NodeFilter.FILTER_ACCEPT
                        : NodeFilter.FILTER_SKIP;
                }
            }
        );

        const phraseNode = walker.nextNode();

        if (phraseNode?.parentElement) {
            let el = phraseNode.parentElement;

            // لا نأخذ العنصر الذي يحتوي العبارة وحدها.
            // نصعد حتى نجد العبارة والهوية معًا.
            for (
                let depth = 0;
                depth < 9 && el;
                depth++, el = el.parentElement
            ) {
                if (isFaresPlusNode(el)) break;

                const txt = clean(el.textContent || '');

                if (
                    txt.length <= 260 &&
                    hasLoginIdentityAfterPhrase(el)
                ) {
                    return el;
                }
            }
        }

        return null;
    }

    function findLoginContainerRobust(root = document.body) {
        if (!root) return null;

        const scope =
            root instanceof Element
                ? root
                : root.parentElement;

        if (!scope) return null;

        const candidates = [
            ...scope.querySelectorAll(
                'td,span,div,font,b,strong,a,p'
            )
        ].filter(el => {
            if (isFaresPlusNode(el)) return false;

            const txt = clean(el.textContent || '');

            return (
                txt.length > 0 &&
                txt.length <= 260 &&
                LOGIN_PHRASE_RE.test(txt) &&
                hasLoginIdentityAfterPhrase(el)
            );
        });

        // نختار أصغر حاوية ممكنة حتى لا نخفي أي جزء آخر من الرأس.
        candidates.sort(
            (a,b) =>
                a.querySelectorAll('*').length -
                b.querySelectorAll('*').length
        );

        return candidates[0] || null;
    }

    function wrapLoginIdentityInContainer(container) {
        if (!container) return 0;

        if (
            container.querySelector(
                '[data-fares-plus-private-login="1"]'
            )
        ) {
            return 0;
        }

        // نجعل الـObserver يتجاهل التغيير الداخلي الذي نصنعه نحن.
        container.setAttribute(
            'data-fares-plus-privacy-host',
            '1'
        );

        // 1) الحالة المعتادة في فارس: الرقم داخل b/strong/span مستقل.
        const descendants = [
            ...container.querySelectorAll(
                'b,strong,span,font,a'
            )
        ];

        // نفضّل العنصر الذي نصه كله هو الهوية.
        const child = descendants.find(el => {
            const value = clean(el.textContent || '');

            return (
                value.length > 0 &&
                value.length <= 40 &&
                LOGIN_ID_RE.test(value) &&
                !LOGIN_PHRASE_RE.test(value) &&
                !/\s{2,}/.test(value)
            );
        });

        if (child) {
            child.setAttribute(
                'data-fares-plus-private-login',
                '1'
            );
            return 1;
        }

        // 2) العبارة والهوية قد تكونان موزعتين بين TextNodes.
        const walker = document.createTreeWalker(
            container,
            NodeFilter.SHOW_TEXT
        );

        let phraseSeen = false;
        let node;

        while ((node = walker.nextNode())) {
            if (isFaresPlusNode(node)) continue;

            const raw = node.nodeValue || '';
            const phraseMatch = raw.match(LOGIN_PHRASE_RE);

            let searchFrom = 0;

            if (phraseMatch) {
                phraseSeen = true;
                searchFrom =
                    (phraseMatch.index || 0) +
                    phraseMatch[0].length;
            } else if (!phraseSeen) {
                continue;
            }

            const tail = raw.slice(searchFrom);
            const idMatch = tail.match(LOGIN_ID_RE);

            if (!idMatch) continue;

            const absoluteIndex =
                searchFrom + (idMatch.index || 0);

            const before = raw.slice(0, absoluteIndex);
            const value = idMatch[0];
            const after = raw.slice(
                absoluteIndex + value.length
            );

            const frag =
                document.createDocumentFragment();

            if (before) {
                frag.appendChild(
                    document.createTextNode(before)
                );
            }

            const span = document.createElement('span');
            span.setAttribute(
                'data-fares-plus-private-login',
                '1'
            );
            span.textContent = value;
            frag.appendChild(span);

            if (after) {
                frag.appendChild(
                    document.createTextNode(after)
                );
            }

            node.parentNode?.replaceChild(
                frag,
                node
            );

            return 1;
        }

        return 0;
    }

    function markLoginIdentity(root = document.body) {
        if (!root) return 0;

        const scope =
            root instanceof Element
                ? root
                : root.parentElement;

        if (!scope) return 0;

        // إذا كان هذا الجزء يحتوي علامة سابقة فلا نكرر.
        if (
            scope.matches?.(
                '[data-fares-plus-private-login="1"]'
            ) ||
            scope.querySelector?.(
                '[data-fares-plus-private-login="1"]'
            )
        ) {
            return 0;
        }

        // سريع أولًا.
        let container =
            findLoginContainerFast(scope);

        // ثم fallback موثوق يماثل منطق v0.6.7،
        // لكنه لا يعمل إلا إذا فشل المسار السريع.
        if (!container) {
            container =
                findLoginContainerRobust(scope);
        }

        if (!container) return 0;

        return wrapLoginIdentityInContainer(
            container
        );
    }

    function visibleLoginContainers(root = document.body) {
        if (!root) return [];

        const scope =
            root instanceof Element
                ? root
                : root.parentElement;

        if (!scope) return [];

        const out = [];
        const seen = new Set();

        const add = el => {
            if (!el || seen.has(el) || isFaresPlusNode(el)) return;

            const txt = clean(el.textContent || '');

            if (
                !LOGIN_PHRASE_RE.test(txt) ||
                !LOGIN_ID_RE.test(loginTail(txt))
            ) {
                return;
            }

            const rect = el.getBoundingClientRect?.();

            // سطر تسجيل الدخول يوجد في أعلى الرأس.
            // نستخدم حدًا واسعًا لتغطية اختلاف تخطيط فارس دون فحص الصفحة كلها.
            if (
                rect &&
                rect.width > 0 &&
                rect.height > 0 &&
                rect.bottom >= 0 &&
                rect.top <= 260
            ) {
                seen.add(el);
                out.push(el);
            }
        };

        // المسار السريع.
        const fast = findLoginContainerFast(scope);
        if (fast) add(fast);

        // fallback: جميع الحاويات القصيرة في أعلى الصفحة فقط.
        const candidates = scope.querySelectorAll?.(
            'td,span,div,font,b,strong,a,p'
        ) || [];

        for (const el of candidates) {
            const rect = el.getBoundingClientRect?.();

            if (
                rect &&
                rect.top > 280
            ) {
                continue;
            }

            add(el);
        }

        // نختار أصغر الحاويات فقط حتى لا نكرر نفس النص عبر الأبناء والآباء.
        return out.filter(el =>
            !out.some(other =>
                other !== el &&
                el.contains(other) &&
                clean(other.textContent || '').length <
                clean(el.textContent || '').length
            )
        );
    }

    function maskLoginTextNode(node) {
        if (!(node instanceof Text)) return 0;

        const raw = node.nodeValue || '';

        if (!/\d{6,20}/.test(raw)) return 0;

        if (!state.privacyTextMasks.has(node)) {
            state.privacyTextMasks.set(node, raw);
        }

        node.nodeValue = raw.replace(
            /\d{6,20}/g,
            match => '•'.repeat(Math.min(10, Math.max(8, match.length)))
        );

        return 1;
    }

    function maskElementOwnText(el) {
        if (!(el instanceof Element)) return 0;

        let changed = 0;

        const walker = document.createTreeWalker(
            el,
            NodeFilter.SHOW_TEXT
        );

        let node;

        while ((node = walker.nextNode())) {
            if (isFaresPlusNode(node)) continue;

            const value = node.nodeValue || '';

            if (!/\d{6,20}/.test(value)) continue;

            changed += maskLoginTextNode(node);
        }

        return changed;
    }

    function maskLoginIdentityText(root = document.body) {
        let changed = 0;

        for (const container of visibleLoginContainers(root)) {
            // لا نغيّر العبارة نفسها؛ فقط أي رقم طويل داخل الحاوية المرئية.
            changed += maskElementOwnText(container);

            container.setAttribute(
                'data-fares-plus-privacy-host',
                '1'
            );
        }

        return changed;
    }

    function restoreLoginIdentityText() {
        let restored = 0;

        for (const [node, original] of state.privacyTextMasks) {
            try {
                if (node?.isConnected) {
                    node.nodeValue = original;
                    restored++;
                }
            } catch (_) {}
        }

        state.privacyTextMasks.clear();

        document.querySelectorAll(
            '[data-fares-plus-privacy-host="1"]'
        ).forEach(el => {
            el.removeAttribute(
                'data-fares-plus-privacy-host'
            );
        });

        return restored;
    }

    function applyPrivacyVisualState({ silent = true } = {}) {
        if (!document.documentElement) return;

        if (state.settings.privacyMode) {
            document.documentElement.setAttribute(
                'data-fares-plus-privacy',
                '1'
            );

            // إخفاء النص المرئي نفسه، لا الاعتماد على CSS فقط.
            maskLoginIdentityText(document.body);
        } else {
            document.documentElement.removeAttribute(
                'data-fares-plus-privacy'
            );

            restoreLoginIdentityText();
        }

        syncPrivacyControls();

        if (!silent) {
            toast(
                state.settings.privacyMode
                    ? 'تم تفعيل وضع الشرح وإخفاء اسم الدخول.'
                    : 'تم إيقاف وضع الشرح وإظهار اسم الدخول.',
                'success'
            );
        }
    }

    function applyPrivacyMode({ silent = true, rescan = false } = {}) {
        if (
            rescan &&
            state.settings.privacyMode
        ) {
            maskLoginIdentityText(document.body);
        }

        applyPrivacyVisualState({ silent });
    }

    function flushPrivacyRoots() {
        state.privacyIdleHandle = null;

        const roots = [
            ...state.privacyPendingRoots
        ];

        state.privacyPendingRoots.clear();

        if (!roots.length) return;

        if (!state.settings.privacyMode) {
            return;
        }

        for (const root of roots) {
            if (!root?.isConnected) continue;
            if (isFaresPlusNode(root)) continue;

            // إذا PPR أعاد بناء الرأس، نخفي فقط ما أضيف حديثًا.
            maskLoginIdentityText(root);
        }
    }

    function schedulePrivacyRefresh(roots = []) {
        for (const root of roots) {
            if (!(root instanceof Element)) continue;
            if (isFaresPlusNode(root)) continue;

            state.privacyPendingRoots.add(root);
        }

        if (!state.privacyPendingRoots.size) return;
        if (state.privacyIdleHandle) return;

        const run = () => flushPrivacyRoots();

        if (typeof requestIdleCallback === 'function') {
            state.privacyIdleHandle = requestIdleCallback(
                run,
                { timeout: 500 }
            );
        } else {
            state.privacyIdleHandle = setTimeout(
                run,
                80
            );
        }
    }

    function setPrivacyMode(enabled, { silent = false } = {}) {
        state.settings.privacyMode = !!enabled;
        saveJSON(STORAGE.settings, state.settings);

        // فوري: لا نعيد البحث في الصفحة عند كل ضغطة.
        applyPrivacyVisualState({ silent });

        return state.settings.privacyMode;
    }

    function togglePrivacyMode() {
        const result = setPrivacyMode(
            !state.settings.privacyMode,
            { silent: false }
        );
        // وضع الخصوصية لا يجب أن يؤثر على زر فارس+ إطلاقًا.
        ensureLauncher();
        return result;
    }

    function syncPrivacyControls() {
        const active = !!state.settings.privacyMode;

        const floating = document.getElementById(IDS.privacy);

        if (floating) {
            floating.classList.toggle('active', active);
            floating.textContent = active ? '🛡️' : '👁️';
            floating.title = active
                ? 'وضع الشرح مفعّل — اضغط لإظهار اسم الدخول'
                : 'تفعيل وضع الشرح — إخفاء اسم الدخول';
            floating.setAttribute(
                'aria-pressed',
                String(active)
            );
        }

        const inside = document.getElementById(
            `${META.id}-privacy-inside`
        );

        if (inside) {
            inside.classList.toggle('active', active);
            inside.textContent = active
                ? '🛡️ وضع الشرح: مفعّل'
                : '👁️ وضع الشرح';
            inside.setAttribute(
                'aria-pressed',
                String(active)
            );
        }
    }

    function ensurePrivacyToggle() {
        if (!state.settings.launcher || !document.body) return null;

        let button = document.getElementById(IDS.privacy);

        if (!button) {
            button = document.createElement('button');
            button.id = IDS.privacy;
            button.type = 'button';
            button.setAttribute(
                'aria-label',
                'وضع الشرح وإخفاء اسم الدخول'
            );

            button.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                togglePrivacyMode();
            });

            document.body.appendChild(button);
        }

        syncPrivacyControls();
        return button;
    }

    function injectBaseStyle() {
        if (document.getElementById(IDS.style)) return;

        const style = document.createElement('style');
        style.id = IDS.style;
        style.textContent = `
            #${IDS.launcher}, #${IDS.privacy}, #${IDS.overlay}, #${IDS.toast}, #${IDS.overlay} * {
                box-sizing:border-box;
                font-family:Tahoma,Arial,sans-serif;
            }

            /* وضع الشرح: تمويه الهوية المرئية فقط دون تغيير بيانات Oracle. */

            #${IDS.launcher} {
                display:flex !important;
                visibility:visible !important;
                opacity:1 !important;
                align-items:center !important;
                justify-content:center !important;
                position:fixed !important;
                left:20px !important;
                bottom:20px !important;
                z-index:2147483000 !important;
                min-width:100px !important;
                min-height:42px !important;
                border:0 !important;
                border-radius:14px !important;
                background:linear-gradient(135deg,#172033,#29485D) !important;
                color:#fff !important;
                padding:12px 16px !important;
                cursor:pointer !important;
                box-shadow:0 10px 28px rgba(15,23,42,.24) !important;
                font-size:13px !important;
                font-weight:800 !important;
                direction:rtl !important;
                pointer-events:auto !important;
                transition:transform .16s ease,box-shadow .16s ease !important;
            }
            #${IDS.launcher}:hover {
                transform:translateY(-1px) !important;
                box-shadow:0 14px 34px rgba(15,23,42,.30) !important;
            }

            #${IDS.privacy} {
                position:fixed !important;
                left:20px !important;
                bottom:72px !important;
                z-index:2147483001 !important;
                width:42px !important;
                height:42px !important;
                display:grid !important;
                place-items:center !important;
                border:1px solid rgba(23,32,51,.12) !important;
                border-radius:13px !important;
                background:#fff !important;
                color:#344256 !important;
                cursor:pointer !important;
                box-shadow:0 8px 24px rgba(15,23,42,.18) !important;
                font-size:17px !important;
                transition:.16s ease !important;
            }

            #${IDS.privacy}:hover {
                transform:translateY(-1px);
                box-shadow:0 12px 28px rgba(15,23,42,.24) !important;
            }

            #${IDS.privacy}.active {
                background:#EAF7F2 !important;
                color:#167A5B !important;
                border-color:#BFE5D7 !important;
                box-shadow:0 8px 24px rgba(22,122,91,.18) !important;
            }

            #${META.id}-privacy-inside {
                border:1px solid #DCE4EA !important;
                border-radius:9px !important;
                background:#F7F9FA !important;
                color:#556476 !important;
                padding:6px 9px !important;
                cursor:pointer !important;
                font-size:9px !important;
                font-weight:800 !important;
            }

            #${META.id}-privacy-inside.active {
                background:#EAF7F2 !important;
                color:#167A5B !important;
                border-color:#BFE5D7 !important;
            }

            #${IDS.overlay} {
                position:fixed !important;
                inset:0 !important;
                z-index:2147483646 !important;
                display:none;
                align-items:flex-start;
                justify-content:center;
                padding-top:7vh;
                background:rgba(15,23,42,.50);
                backdrop-filter:blur(7px);
                direction:rtl;
            }

            #${IDS.overlay}.open { display:flex; }

            #${META.id}-panel {
                width:min(800px,94vw);
                max-height:85vh;
                background:#fff;
                border-radius:22px;
                overflow:hidden;
                box-shadow:0 30px 100px rgba(0,0,0,.32),0 0 0 1px rgba(0,0,0,.05);
            }

            #${META.id}-header {
                padding:18px 20px 15px;
                border-bottom:1px solid #EDF0F3;
            }

            #${META.id}-brand-row {
                display:flex;
                align-items:center;
                justify-content:space-between;
                gap:14px;
                margin-bottom:14px;
            }

            #${META.id}-brand { display:flex;align-items:center;gap:10px; }

            #${META.id}-logo {
                width:42px;height:42px;border-radius:12px;display:grid;place-items:center;
                background:#172033;color:#fff;font-size:15px;font-weight:900;
            }

            #${META.id}-title { font-size:19px;font-weight:900;color:#172033; }
            #${META.id}-subtitle { margin-top:3px;font-size:10px;color:#8B95A5; }

            #${META.id}-shortcut {
                direction:ltr;padding:6px 9px;border-radius:8px;background:#F3F5F7;
                color:#6D7685;font-size:10px;
            }

            #${META.id}-crumb-row {
                min-height:28px;display:flex;align-items:center;gap:8px;margin-bottom:10px;
            }

            #${META.id}-back {
                display:none;border:0;border-radius:8px;background:#F1F4F6;color:#2D394B;
                padding:6px 9px;cursor:pointer;font-size:11px;
            }

            #${META.id}-crumb {
                min-width:0;flex:1;color:#667180;font-size:11px;overflow:hidden;
                text-overflow:ellipsis;white-space:nowrap;
            }

            #${META.id}-mode {
                flex:0 0 auto;font-size:9px;color:#718096;background:#F5F7F9;
                border-radius:999px;padding:5px 8px;
            }

            #${META.id}-input-wrap { position:relative; }
            #${META.id}-search-icon {
                position:absolute;right:16px;top:50%;transform:translateY(-50%);
                pointer-events:none;font-size:17px;
            }

            #${META.id}-search {
                width:100%;height:54px;border:1px solid #DCE2E8;border-radius:13px;outline:none;
                padding:0 48px 0 14px;background:#fff;color:#1F2A3A;direction:rtl;font-size:16px;
            }

            #${META.id}-search:focus {
                border-color:#5C7180;box-shadow:0 0 0 4px rgba(92,113,128,.10);
            }

            #${META.id}-status { padding:9px 20px 0;font-size:10px;color:#8D97A6; }
            #${META.id}-results { max-height:54vh;overflow-y:auto;padding:9px; }

            .${META.id}-row {
                display:flex;align-items:center;gap:12px;min-height:59px;margin:2px 0;
                padding:8px 12px;border-radius:12px;cursor:pointer;color:#263244;font-size:14px;
            }

            .${META.id}-row:hover, .${META.id}-row.active { background:#F1F4F6; }
            .${META.id}-row.active { box-shadow:inset -3px 0 0 #172033; }

            .${META.id}-row-icon {
                width:38px;height:38px;flex:0 0 38px;display:grid;place-items:center;
                border-radius:10px;background:#EDF1F3;font-size:16px;
            }

            .${META.id}-row-info { flex:1;min-width:0; }
            .${META.id}-row-label { font-weight:800;line-height:1.4; }
            .${META.id}-row-path {
                margin-top:3px;color:#929AA8;font-size:10px;overflow:hidden;
                text-overflow:ellipsis;white-space:nowrap;
            }

            .${META.id}-row-tag {
                flex:0 0 auto;font-size:9px;padding:4px 7px;border-radius:999px;
                background:#EEF2F5;color:#778190;
            }

            .${META.id}-row-arrow { color:#99A2AF;font-size:16px; }

            #${META.id}-empty {
                padding:44px 20px;text-align:center;color:#8C96A5;font-size:13px;
            }

            #${META.id}-footer {
                border-top:1px solid #EDF0F3;padding:10px 16px;display:flex;
                align-items:center;justify-content:space-between;gap:12px;color:#939CAA;font-size:9px;
            }

            #${META.id}-footer strong { color:#596678;letter-spacing:.35px; }

            #${META.id}-footer button {
                border:0;background:transparent;color:#5B7180;cursor:pointer;
                font:inherit;font-weight:800;padding:3px 6px;border-radius:6px;
            }
            #${META.id}-footer button:hover { background:#F0F4F6; }
            .${META.id}-dev-credit { display:flex;align-items:center;gap:5px;flex-wrap:wrap;justify-content:flex-end; }
            .${META.id}-dev-credit a { color:#315F73;text-decoration:none;font-weight:800; }
            .${META.id}-dev-credit a:hover { text-decoration:underline; }

            #${IDS.toast} {
                position:fixed;left:50%;bottom:26px;z-index:2147483647;
                transform:translate(-50%,18px);opacity:0;pointer-events:none;background:#172033;
                color:#fff;padding:10px 14px;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.24);
                font-size:11px;transition:.18s ease;direction:rtl;
            }

            #${IDS.toast}.show { transform:translate(-50%,0);opacity:1; }

            @media(max-width:680px) {
                #${IDS.launcher} { left:12px !important;bottom:12px !important; }
                #${IDS.overlay} { padding-top:3vh; }
                #${META.id}-panel { width:96vw;max-height:92vh; }
            }
        `;
        document.head.appendChild(style);
    }

    function ensureLauncher() {
        if (!state.settings.launcher || !document.body) return;

        let button = document.getElementById(IDS.launcher);

        if (!button) {
            button = document.createElement('button');
            button.id = IDS.launcher;
            button.type = 'button';
            button.title = `فارس+ ${META.version} — تصميم وتطوير ${META.author}`;
            button.textContent = 'فارس+  🔎';
            button.addEventListener(
                'click',
                () => NavigationModule.open()
            );
            document.body.appendChild(button);
        }

        ensurePrivacyToggle();
    }

    function ensureOverlay() {
        let overlay = document.getElementById(IDS.overlay);
        if (overlay) return overlay;

        overlay = document.createElement('div');
        overlay.id = IDS.overlay;
        overlay.innerHTML = `
            <section id="${META.id}-panel" role="dialog" aria-modal="true" aria-label="فارس+">
                <header id="${META.id}-header">
                    <div id="${META.id}-brand-row">
                        <div id="${META.id}-brand">
                            <div id="${META.id}-logo">ف+</div>
                            <div>
                                <div id="${META.id}-title">فارس+</div>
                                <div id="${META.id}-subtitle">بحث ذكي في قوائم فارس وتحسينات مخصصة لكل صفحة</div>
                            </div>
                        </div>
                        <div style="display:flex;align-items:center;gap:7px">
                            <button
                                type="button"
                                id="${META.id}-privacy-inside"
                                aria-pressed="false"
                            >👁️ وضع الشرح</button>
                            <div id="${META.id}-shortcut">ALT + K</div>
                        </div>
                    </div>

                    <div id="${META.id}-crumb-row">
                        <button type="button" id="${META.id}-back">← رجوع</button>
                        <div id="${META.id}-crumb">الخدمة الذاتية للموظف</div>
                        <div id="${META.id}-mode">بحث عالمي عند الكتابة</div>
                    </div>

                    <div id="${META.id}-input-wrap">
                        <span id="${META.id}-search-icon">🔎</span>
                        <input id="${META.id}-search" type="text" autocomplete="off"
                               placeholder="اكتب اسم أي قائمة أو خدمة...">
                    </div>
                </header>

                <div id="${META.id}-status"></div>
                <div id="${META.id}-results"></div>

                <footer id="${META.id}-footer">
                    <span>↑ ↓ للتنقل • Enter للاختيار • Esc للإغلاق</span>
                    <button type="button" id="${META.id}-about">عن السكربت</button>
                    ${developerCreditHtml()}
                </footer>
            </section>
        `;

        overlay.addEventListener('mousedown', event => {
            if (event.target === overlay) NavigationModule.close();
        });
        document.body.appendChild(overlay);

        const search = overlay.querySelector(`#${META.id}-search`);
        const back = overlay.querySelector(`#${META.id}-back`);

        search.addEventListener('input', () => {
            state.nav.activeIndex = 0;
            NavigationModule.render();
        });

        search.addEventListener('keydown', event => {
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                if (!state.nav.results.length) return;
                state.nav.activeIndex = (state.nav.activeIndex + 1) % state.nav.results.length;
                NavigationModule.updateActive();
            }

            if (event.key === 'ArrowUp') {
                event.preventDefault();
                if (!state.nav.results.length) return;
                state.nav.activeIndex = (
                    state.nav.activeIndex - 1 + state.nav.results.length
                ) % state.nav.results.length;
                NavigationModule.updateActive();
            }

            if (event.key === 'Enter') {
                event.preventDefault();
                NavigationModule.choose();
            }

            if (event.key === 'Escape') {
                event.preventDefault();
                NavigationModule.close();
            }
        });

        back.addEventListener('click', () => NavigationModule.goBack());

        overlay.querySelector(
            `#${META.id}-privacy-inside`
        )?.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            togglePrivacyMode();
        });

        overlay.querySelector(
            `#${META.id}-about`
        )?.addEventListener('click', aboutScript);

        syncPrivacyControls();
        return overlay;
    }

    function focusSearch(retries = 5) {
        const overlay = ensureOverlay();
        const search = overlay.querySelector(`#${META.id}-search`);
        if (!search) return;

        const attempt = count => {
            if (!overlay.classList.contains('open')) return;
            search.focus({ preventScroll: true });
            if (count > 0) setTimeout(() => attempt(count - 1), 75);
        };

        attempt(retries);
    }

    // =========================================================
    // Navigation aliases
    // =========================================================

    const NAV_ALIASES = Object.freeze({
        'الرواتب والبدلات': ['راتب','رواتب','راتبي','بدلات','مسير'],
        'تعريف الراتب': ['تعريف','تعريف راتب','تعريف بالراتب'],
        'كشف الراتب': ['كشف','كشف راتب','مسير راتب','تفاصيل الراتب'],
        'تعديل الحساب البنكي': ['حساب بنكي','البنك','ايبان','iban'],
        'الاجازات': ['اجازه','اجازة','إجازة','اجازات','إجازات'],
        'الاداء الوظيفي': ['اداء','تقييم','تقييم الاداء'],
        'نقل المعلمين': ['نقل','حركة النقل','نقل معلمين'],
        'التطوير المهني للمعلمين': [
            'تطوير','تطوير مهني','دورات','انشطة التطوير المهني',
            'احتساب انشطة التطوير المهني','احتساب أنشطة التطوير المهني'
        ],
        'الخدمة الذاتية للترقيات - المعلمين': ['ترقية','ترقيات','ترقية معلم'],
        'الاستعلام عن الطلبات المعلقة': ['طلبات','طلبات معلقة','معلقة'],
        'قائمة الاستعلامات': ['استعلام','استعلامات']
    });

    // =========================================================
    // Navigation Module
    // =========================================================

    const NavigationModule = {
        id: 'core-navigation',

        match() {
            return state.settings.enabled && state.settings.navigation;
        },

        async mount() {
            injectBaseStyle();
            ensureLauncher();
            ensureOverlay();
        },

        get searchInput() {
            return ensureOverlay().querySelector(`#${META.id}-search`);
        },

        get statusBox() {
            return ensureOverlay().querySelector(`#${META.id}-status`);
        },

        get resultsBox() {
            return ensureOverlay().querySelector(`#${META.id}-results`);
        },

        open() {
            injectBaseStyle();
            ensureLauncher();
            const overlay = ensureOverlay();

            // إظهار الواجهة فورًا وعدم انتظار Oracle.
            overlay.classList.add('open');
            focusSearch(6);

            const token = ++state.nav.openToken;
            state.nav.opening = true;
            state.nav.ready = false;
            state.nav.depth = 1;
            state.nav.path = [];
            state.nav.currentItems = [];
            state.nav.activeIndex = 0;

            this.statusBox.textContent = 'جاري تجهيز شجرة فارس... يمكنك الكتابة الآن.';
            this.syncBreadcrumb();
            this.render();

            this.prepareRoot(token).then(ok => {
                if (token !== state.nav.openToken) return;

                state.nav.opening = false;
                state.nav.ready = ok;

                if (!ok) {
                    this.statusBox.textContent =
                        'تعذر تجهيز قائمة فارس الآن. اكتب اسم خدمة محفوظة أو اضغط فارس+ مرة أخرى.';
                    this.render();
                    focusSearch(3);
                    return;
                }

                state.nav.currentItems = this.getLevelItems(1);
                this.rememberItems(state.nav.currentItems, []);
                this.statusBox.textContent =
                    `جاهز — ${state.nav.currentItems.length} قسمًا رئيسيًا، والفهرس المحفوظ ${state.nav.cache.length} عنصرًا.`;
                this.render();
                focusSearch(4);
            }).catch(error => {
                console.error('[فارس+] prepareRoot failed', error);
                if (token !== state.nav.openToken) return;
                state.nav.opening = false;
                this.statusBox.textContent = 'تعذر تجهيز شجرة فارس.';
                this.render();
                focusSearch(3);
            });
        },

        close() {
            document.getElementById(IDS.overlay)?.classList.remove('open');
            state.nav.openToken++;
            state.nav.opening = false;
        },

        async waitForElement(getter, timeout = 2600, interval = 80) {
            const started = Date.now();
            while (Date.now() - started < timeout) {
                const value = getter();
                if (value) return value;
                await wait(interval);
            }
            return null;
        },

        async prepareRoot(token) {
            const snav = await this.waitForElement(
                () => document.getElementById('SNAV'),
                2800
            );

            if (!snav || token !== state.nav.openToken) return false;

            // نجرب حتى 3 مرات لأن Oracle قد يتجاهل النقرة أثناء PPR.
            for (let attempt = 0; attempt < 3; attempt++) {
                if (token !== state.nav.openToken) return false;

                const rootItemsBefore = this.getLevelItems(0);
                if (!rootItemsBefore.length || !isVisible(document.getElementById('navContainer0'))) {
                    snav.click();
                    await wait(140 + attempt * 70);
                    focusSearch(2);
                }

                const rootItems = this.getLevelItems(0);
                const selfService = rootItems.find(item =>
                    sameText(item.label.replace(/^\./, ''), 'صلاحية الخدمة الذاتية للموظف')
                );

                if (!selfService) {
                    await wait(120);
                    continue;
                }

                // نضغط المسؤولية نفسها في كل فتح لضمان أن المستوى 1 تابع لها.
                selfService.element.click();
                await wait(170 + attempt * 70);
                focusSearch(3);

                const levelOne = await this.waitForStableLevel(1, 1100);
                if (levelOne.length) {
                    this.rememberItems(levelOne, []);
                    return true;
                }
            }

            return false;
        },

        getLevelItems(depth) {
            const listContainer = document.getElementById(`navListContainer${depth}`);
            const navContainer = document.getElementById(`navContainer${depth}`);
            const scope = listContainer || navContainer;
            if (!scope) return [];

            let entries = [];

            // أفضلية للعناصر الأقرب لتجنب تكرار descendants.
            const list = listContainer?.querySelector(':scope > .listContainer');
            if (list) {
                entries = [...list.children].filter(element =>
                    element.classList?.contains('listEntry') ||
                    element.classList?.contains('listEntrySelect')
                );
            }

            if (!entries.length) {
                entries = [
                    ...scope.querySelectorAll('.listEntry, .listEntrySelect')
                ];
            }

            return entries
                .map(element => ({
                    label: textOf(element),
                    element,
                    depth,
                    live: true
                }))
                .filter(item => item.label)
                .filter((item, index, array) =>
                    array.findIndex(other => sameText(other.label, item.label)) === index
                );
        },

        levelSignature(depth) {
            return this.getLevelItems(depth)
                .map(item => normalizeArabic(item.label))
                .join('|');
        },

        async waitForStableLevel(depth, timeout = 1200, previousSignature = null) {
            const started = Date.now();
            let lastSignature = '';
            let stableHits = 0;

            while (Date.now() - started < timeout) {
                const items = this.getLevelItems(depth);
                const signature = items.map(item => normalizeArabic(item.label)).join('|');
                const changed = previousSignature === null || signature !== previousSignature;

                if (items.length && changed) {
                    if (signature === lastSignature) stableHits++;
                    else stableHits = 0;

                    lastSignature = signature;
                    if (stableHits >= 1) return items;
                }

                await wait(80);
            }

            return this.getLevelItems(depth);
        },

        rememberItems(items, parentPath) {
            let changed = false;
            const now = Date.now();

            for (const item of items) {
                const key = pathKey(parentPath, item.label);
                const existing = state.nav.cache.find(entry => entry.key === key);

                if (existing) {
                    existing.lastSeen = now;
                    existing.depth = item.depth;
                    changed = true;
                } else {
                    state.nav.cache.push({
                        key,
                        label: item.label,
                        path: [...parentPath],
                        depth: item.depth,
                        lastSeen: now
                    });
                    changed = true;
                }
            }

            if (changed) saveNavCache();
        },

        score(item, query) {
            const q = normalizeArabic(query);
            const label = normalizeArabic(item.label);
            if (!q) return 10;
            if (label === q) return 1200;
            if (label.startsWith(q)) return 1000;
            if (label.includes(q)) return 850;

            const aliases = NAV_ALIASES[item.label] || [];
            for (const alias of aliases) {
                const a = normalizeArabic(alias);
                if (a === q) return 1100;
                if (a.startsWith(q)) return 930;
                if (a.includes(q)) return 820;
                if (q.includes(a)) return 760;
            }

            const qWords = q.split(' ').filter(Boolean);
            const labelWords = label.split(' ').filter(Boolean);
            let matches = 0;

            for (const word of qWords) {
                if (labelWords.some(part => part.includes(word) || word.includes(part))) matches++;
            }

            if (matches === qWords.length && matches > 0) return 650 + matches * 35;
            return matches * 135;
        },

        buildGlobalCandidates(query) {
            const byKey = new Map();

            // العناصر الحالية Live لها أولوية.
            for (const item of state.nav.currentItems) {
                const path = state.nav.path.map(part => part.label);
                const key = pathKey(path, item.label);
                byKey.set(key, {
                    ...item,
                    key,
                    path,
                    source: 'live-current'
                });
            }

            // أي مستويات ظاهرة حاليًا في DOM نضيفها أيضًا.
            for (let depth = 1; depth <= 8; depth++) {
                const liveItems = this.getLevelItems(depth);
                if (!liveItems.length) continue;

                let knownPath = [];
                if (depth === state.nav.depth) {
                    knownPath = state.nav.path.map(part => part.label);
                } else if (depth < state.nav.depth) {
                    knownPath = state.nav.path.slice(0, Math.max(0, depth - 1)).map(part => part.label);
                }

                for (const item of liveItems) {
                    const key = pathKey(knownPath, item.label);
                    if (!byKey.has(key)) {
                        byKey.set(key, {
                            ...item,
                            key,
                            path: knownPath,
                            source: 'live'
                        });
                    }
                }
            }

            // الفهرس المتعلم عبر الاستخدام السابق.
            for (const entry of state.nav.cache) {
                if (!byKey.has(entry.key)) {
                    byKey.set(entry.key, {
                        ...entry,
                        live: false,
                        source: 'cache'
                    });
                }
            }

            const candidates = [...byKey.values()]
                .map(item => ({ ...item, score: this.score(item, query) }))
                .filter(item => item.score > 0)
                .sort((a, b) => {
                    if (b.score !== a.score) return b.score - a.score;
                    if ((a.path?.length || 0) !== (b.path?.length || 0)) {
                        return (a.path?.length || 0) - (b.path?.length || 0);
                    }
                    return a.label.localeCompare(b.label, 'ar');
                });

            return candidates.slice(0, 60);
        },

        render() {
            const query = this.searchInput?.value || '';

            if (query.trim()) {
                state.nav.results = this.buildGlobalCandidates(query);
            } else {
                state.nav.results = state.nav.currentItems.map(item => ({
                    ...item,
                    path: state.nav.path.map(part => part.label),
                    source: 'live-current',
                    score: 10
                }));
            }

            if (state.nav.activeIndex >= state.nav.results.length) {
                state.nav.activeIndex = 0;
            }

            if (!state.nav.results.length) {
                this.resultsBox.innerHTML = `
                    <div id="${META.id}-empty">
                        ${state.nav.opening
                            ? 'جاري تجهيز القوائم... اكتب الآن وسنحدّث النتائج تلقائيًا.'
                            : 'لا توجد نتيجة مطابقة في الفهرس الحالي.'}
                    </div>
                `;
                return;
            }

            this.resultsBox.innerHTML = state.nav.results.map((item, index) => {
                const path = ['الخدمة الذاتية للموظف', ...(item.path || []), item.label];
                const sourceTag = item.source === 'cache' ? 'محفوظ' : 'مباشر';

                return `
                    <div class="${META.id}-row ${index === state.nav.activeIndex ? 'active' : ''}"
                         data-index="${index}">
                        <div class="${META.id}-row-icon">◈</div>
                        <div class="${META.id}-row-info">
                            <div class="${META.id}-row-label">${esc(item.label)}</div>
                            <div class="${META.id}-row-path">${esc(path.join(' ← '))}</div>
                        </div>
                        <div class="${META.id}-row-tag">${sourceTag}</div>
                        <div class="${META.id}-row-arrow">‹</div>
                    </div>
                `;
            }).join('');

            this.resultsBox.querySelectorAll(`.${META.id}-row`).forEach(row => {
                row.addEventListener('mouseenter', () => {
                    state.nav.activeIndex = Number(row.dataset.index);
                    this.updateActive();
                });
                row.addEventListener('click', event => {
                    event.preventDefault();
                    event.stopPropagation();
                    this.choose(Number(row.dataset.index));
                });
            });
        },

        updateActive() {
            [...this.resultsBox.querySelectorAll(`.${META.id}-row`)].forEach((row, index) => {
                row.classList.toggle('active', index === state.nav.activeIndex);
            });
            this.resultsBox.querySelector(`.${META.id}-row.active`)
                ?.scrollIntoView({ block: 'nearest' });
        },

        async choose(index = state.nav.activeIndex) {
            const item = state.nav.results[index];
            if (!item) return;

            const token = ++state.nav.actionToken;
            const query = this.searchInput.value;

            // إن كانت النتيجة خارج المستوى الحالي نعيد تشغيل المسار المحفوظ.
            const currentPath = state.nav.path.map(part => part.label);
            const samePath = JSON.stringify(item.path || []) === JSON.stringify(currentPath);
            const liveHere = item.source === 'live-current' && samePath;

            if (!liveHere) {
                await this.replayPath(item, query, token);
                return;
            }

            await this.activateCurrentItem(item, query, token);
        },

        async activateCurrentItem(item, originalQuery, token) {
            if (token !== state.nav.actionToken) return;

            const depth = state.nav.depth;
            const nextDepth = depth + 1;
            const nextBefore = this.levelSignature(nextDepth);

            const live = this.getLevelItems(depth).find(candidate => sameText(candidate.label, item.label));
            if (!live) {
                toast('تعذر العثور على العنصر الأصلي. أعد فتح فارس+.');
                return;
            }

            this.statusBox.textContent = `جاري فتح ${item.label}...`;
            live.element.click();
            focusSearch(3);

            const nextItems = await this.waitForStableLevel(nextDepth, 950, nextBefore);
            if (token !== state.nav.actionToken) return;

            const nextContainer = document.getElementById(`navContainer${nextDepth}`);
            const nextAfter = this.levelSignature(nextDepth);
            const hasNext = nextItems.length > 0 && (
                (nextAfter && nextAfter !== nextBefore) ||
                (!nextBefore && isVisible(nextContainer))
            );

            if (!hasNext) {
                addHistory(item.label, state.nav.path.map(part => part.label));
                this.close();
                return;
            }

            state.nav.path.push({ label: item.label, depth });
            state.nav.depth = nextDepth;
            state.nav.currentItems = nextItems;
            this.rememberItems(nextItems, state.nav.path.map(part => part.label));
            this.syncBreadcrumb();

            const selectedExactly = sameText(originalQuery, item.label);
            if (selectedExactly) {
                this.searchInput.value = '';
            } else {
                // إبقاء استعلام الخدمة العميقة حتى لا يضطر المستخدم لكتابته من جديد.
                this.searchInput.value = originalQuery;
            }

            state.nav.activeIndex = 0;
            this.statusBox.textContent =
                `تم فتح ${item.label} — ${nextItems.length} عنصرًا داخله.`;
            this.render();
            focusSearch(4);

            // إذا كان نفس الاستعلام أصبح مطابقًا تمامًا لابن واحد، نكمل تلقائيًا.
            if (this.searchInput.value.trim()) {
                const exact = state.nav.results.filter(result =>
                    sameText(result.label, this.searchInput.value)
                );

                if (exact.length === 1 && exact[0].source === 'live-current') {
                    const exactIndex = state.nav.results.indexOf(exact[0]);
                    await wait(90);
                    if (token === state.nav.actionToken) {
                        state.nav.activeIndex = exactIndex;
                        await this.activateCurrentItem(exact[0], originalQuery, token);
                    }
                }
            }
        },

        async replayPath(entry, originalQuery, token) {
            this.statusBox.textContent = `جاري استدعاء المسار المحفوظ: ${entry.label}...`;

            const rootToken = ++state.nav.openToken;
            const ok = await this.prepareRoot(rootToken);
            if (!ok || token !== state.nav.actionToken) {
                toast('تعذر إعادة بناء مسار الخدمة الآن.');
                focusSearch(3);
                return;
            }

            state.nav.depth = 1;
            state.nav.path = [];
            state.nav.currentItems = this.getLevelItems(1);
            this.rememberItems(state.nav.currentItems, []);

            for (const parentLabel of (entry.path || [])) {
                if (token !== state.nav.actionToken) return;

                const depth = state.nav.depth;
                const parent = this.getLevelItems(depth)
                    .find(item => sameText(item.label, parentLabel));

                if (!parent) {
                    toast(`لم أجد المسار: ${parentLabel}`);
                    this.syncBreadcrumb();
                    this.render();
                    focusSearch(3);
                    return;
                }

                const nextDepth = depth + 1;
                const before = this.levelSignature(nextDepth);
                parent.element.click();
                focusSearch(2);

                const children = await this.waitForStableLevel(nextDepth, 1000, before);
                if (!children.length) {
                    toast(`تعذر فتح: ${parentLabel}`);
                    return;
                }

                state.nav.path.push({ label: parentLabel, depth });
                state.nav.depth = nextDepth;
                state.nav.currentItems = children;
                this.rememberItems(children, state.nav.path.map(part => part.label));
            }

            this.syncBreadcrumb();

            const target = this.getLevelItems(state.nav.depth)
                .find(item => sameText(item.label, entry.label));

            if (!target) {
                // قد تكون بيانات الفهرس قديمة؛ نعرض المستوى الحالي بدل الفشل الصامت.
                this.statusBox.textContent =
                    'المسار تغيّر في فارس. تم فتح أقرب مستوى متاح؛ اختر الخدمة من القائمة.';
                this.searchInput.value = originalQuery;
                this.render();
                focusSearch(4);
                return;
            }

            const liveEntry = {
                ...target,
                path: state.nav.path.map(part => part.label),
                source: 'live-current'
            };

            state.nav.currentItems = this.getLevelItems(state.nav.depth);
            await this.activateCurrentItem(liveEntry, originalQuery, token);
        },

        goBack() {
            if (!state.nav.path.length) return;
            state.nav.path.pop();
            state.nav.depth = Math.max(1, state.nav.depth - 1);
            state.nav.currentItems = this.getLevelItems(state.nav.depth);
            state.nav.activeIndex = 0;
            this.searchInput.value = '';
            this.statusBox.textContent =
                `تم العثور على ${state.nav.currentItems.length} عنصرًا في هذا المستوى.`;
            this.syncBreadcrumb();
            this.render();
            focusSearch(3);
        },

        syncBreadcrumb() {
            const overlay = ensureOverlay();
            const crumb = overlay.querySelector(`#${META.id}-crumb`);
            const back = overlay.querySelector(`#${META.id}-back`);
            const path = ['الخدمة الذاتية للموظف', ...state.nav.path.map(part => part.label)];
            crumb.textContent = path.join(' ← ');
            back.style.display = state.nav.path.length ? 'inline-block' : 'none';
        }
    };

    // =========================================================
    // Future page modules
    // =========================================================

    /*
     * كل صفحة جديدة ستكون Module مستقلًا داخل فارس+:
     *
     * registerModule({
     *     id: 'salary-definition',
     *     match({ page }) {
     *         return page.title.includes('تعريف الراتب') ||
     *                page.headings.some(text => text.includes('تعريف الراتب'));
     *     },
     *     mount({ utils }) {
     *         // تحسين صفحة تعريف الراتب فقط.
     *     },
     *     unmount() {}
     * });
     */

    // =========================================================
    // Professional Development Activities Module — v1.0
    // =========================================================
    const ProfessionalDevelopmentModule = (() => {
        const ID = `${META.id}-pd`;
        const IMPORT_TEMPLATE = Object.freeze({
            fileName:'FaresPlus-Professional-Development-Import-Template.xlsx',
            mime:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            sha256:'e89bea911aebc6bc551fbc672e80437ac367098636f1f6fb0aff5871051c3496',
            base64:'UEsDBBQAAAAIAAKEIV0+Kow/EwEAAFICAAAPAAAAeGwvd29ya2Jvb2sueG1stdK9bsIwEAfwV7FuL84nSiICS5eufQMnOROL2I5s0+YBYOFFItGhqjr1TZy3qaAVIHXpwna6k/766e4Wq0F25AWNFVqVEM4CIKhq3Qi1LmHr+EMGq+ViKF612VRab8ggO2WLoYTWub6g1NYtSmZnukc1yI5rI5mzM23W1PYGWWNbRCc7GgXBnEomFJzyzl17qYhiEkvw47Tzo//0x+ngP/zo34Gc509NCSEQU4imhOeIYxVmeRCmDSZZXMGvyvxHpTkXNT7qeitRuR+WwY45oZVtRW+B0D+uo/+adtNh2vvRH29M0cUU5nGcxlHKU4wSnkd3N017/3ba140mvmpYNmchr7Imq5Kc30NDr0ek1/9YfgNQSwMEFAAAAAgAAoQhXToCwLINAwAAzi0AAA0AAAB4bC9zdHlsZXMueG1s5Vpdc6IwFP0rTPq8QtCg7ZR2qysz+9KX9mFfUYMyExImRBf763dIAKlbp9ryJfhCEnNPziUnNwTu/WMcEG2HeeQzagM4MICG6ZKtfLq2wVZ4Pybg8eE+vovEnuCXDcZCiwNCo7vYBhshwjtdj5YbHLjRgIWYxgHxGA9cEQ0YX+tRyLG7ihKzgOimYVh64PoUJIh0GziBiLQl21JhA7PQqKnL75UNTMMAmoKcsRW2wU+g6Sd6wvc9jcHNjeys54Mlhh6jh1HHIGuSTr5pO5fYAMJsEDfAqmnmcuILluFlFtl1ofr/B7BkhHGNrxc2cNLfpdA5pvER5nA4ggh9l65VHt1j6I9ZI/QLTcq9E9YUPZnTSujeTofzkXUedFpQUvMJOZaaT0hyDV0hMKeOT4iWll/3IbYBZRTniGnnT43W3N1DE11sFzHirxSv9azoMRwPHaTmXn9nXxK++TSZTmB1+PO5YzmoOnzHcSbzcaX40Pnk/qQFqbQF4yvMj4KpalSqPZT1vLfUOSbkJYntf7zcGkrr2CsEVxmEaV70CUmLCiqtKPQiZDZEAR3dfhU+9g7jXA4ACwBuGJL98zZYYO7IHUP+LVsdRos1n5BDbSrBZP1cCuYpHyqmAPtCQdafiL+mAT6I180atL/cDV9xrKCUQGOv/bQ3jPtvjIpkn1liKjAHXXJlh7nwl99y7tQiq3Gdw75QqG2Rwe4sMtiFRWaesRtXrPB6KJSu8HbQrlACNQa5eijUJgF4FRJI37x0Qc1nuXItswK7MyuwK7NSkNew+YNXPRS+8kTSnhtYzvPUd/ypcf+sh0LdgoBXKojCwXXY/KuZblOoSpOn5rCZk3+3KVQ1h217ehIsbO3xrGovCutp1FBAGvWFQunn3HbQLveV8qihkDrqC4XaVHh1J8j2frW57tfhF0YA1NAmgPpCofQI0A7a5e5DqKFNAPWFQm0qhFesQquhQGT1hULpKmwH7VI+sLfXld25iyzNiiskxMkEuaOMu7xdS3JMbfCceELe570V8+siWT1kZj/8A1BLAwQUAAAACAAChCFd+lwBWQMDAADaDQAAEwAAAHhsL3RoZW1lL3RoZW1lMS54bWy9V9tymzAU/BVG7w03c/OEZBLHbh/SaafJD8ggQI0QHkmOnb/vIG4CjOM0duwHS2LP2UXnsMLXt/ucaK+IcVzQEJhXBtAQjYoY0zQEW5F888HtzTWciwzlSKMwRyFYZFB8//0MtH1OKJ/DEGRCbOa6zqMM5ZBfFRtE9zlJCpZDwa8KluoxgztM05zolmG4eg4xBW3eJUE5ooKXCxFhT9EBsvJa/GKWP/yNLwjTXiEJwQ7TuNg9o70AGoFcLAgLgSE/QNNvrvU2ioiJYCVwJT9NYB0Rv1gykKXrNtJYWv7M7BgkgogxcOmX3y6jRMAoQrSWo4JNxzV8qwErqGp4IHvgmfYgQGGwxwyBe2/N+gESVQ1n4xtdBcsHpx8gUdXQGQXcGdZ9YPcDJKoauqOA2fLOs5b9AInKCKYvY7jr+b7bwFtMUpAfB/GB6xreQ4PvYLrSalUCKnqN9ytJcIRk3+Xwb8FWBRWyylBgqom3DUpgVDYoJHjNsPaI00xIHjhH8B1AxI8C9AFnjum7Ao5QHyFt6ToGXd0MuTW5mHwkE0zIk3gj6JFLcbwgOF5hQuRERrWl2GQLwhrCHjBlsBvzOlXKtU3BQ2CAyVzSQTAV1ZrrNU89nJNt/rOI66Y3WzuAcw5Fd8FwFJ9oGeQs5aqGEneyDs+e0NHRDXXYJ+qQd3KyEN/8sJDgqBBdKQ/BVIPlKeHMarvlESQoLgtWJ+iV9SwlDmZTd2R9dmtPKDHPYIyavMaUkqlm67rwDEVWpHj+YSVBMCGk3KpLFFkf2wGh/Zm2K/m95u7+yyw2jIsHyLMKJy+15ytVaALD+QIaq9yZy9Howz1ESYIiMbHSTR+5qLMcvPxZdDkptgKxpyzeaWuyZX9gHALHMx0DaDHmoimAFmPWtc/4/aJbh2STwdrJew9thZfjllMRK+UMpffnteJ1ujrLcfV+1MC1puzWm34SL3A+Bsq5pPhH4H/UUyurPPexqepQ5U0arT0hz76Q0XZd+XWGOmzZ0mOb1zE5G/yBalZu/gFQSwMEFAAAAAgAAoQhXQ0euehlAAAAcwAAABQAAAB4bC9zaGFyZWRTdHJpbmdzLnhtbAXBUQrDIAwA0KtI/mfcPsaQ2p5F2rQKJhaTDY+/95ZtcnM/Glq7JHj6AI5k70eVK8HXzscHtnWZUdXc5CYaZ4JidkdE3QtxVt9vksnt7IOzqe/jQr0H5UMLkXHDVwhv5FwFHK5/UEsDBBQAAAAIAAKEIV3BVpFJ2woAAO12AAAYAAAAeGwvd29ya3NoZWV0cy9zaGVldDEueG1snd3bblvHFcbxVyH2dWudDxZCBy3XzKybAkFQpNc70pZElAeV3LLVywCxU/g1euEmKOoWKVD0Tci3KRa1LLm1+Z+lXtn0bw1Jfdk2PjCbM198eTedDF52i+V4Phs2e892m0E3O59fjGdXw+a2v/zlafPliy/uzl7NF79fXnddP7ibTmbLs7thc933N2c7O8vz627aLp/Nb7rZ3XRyOV9M2375bL642lneLLr2YrNsOtnZ39093pm241ljT7j507wZ/moxuOgu29tJ//X8lXbjq+t+2OwdNYMdGzyfT5b+62A6tjfZDKbt3ebXV+OL/nrYHOw3g+vxxUU3Gza7zeD8dtnPp7+7t73Hp7lfvu/L9x+W758+YfmBLz94WL53/ITlh7788P9bfuTLjx6XP+XNH/vy48ef/fAJy098+cnj8t0nLD/15adP+Nl3Hi+AzRUjbd/ag8X81WCxGbKLxS6A+8UPl8/mIju3mV/tNYPl5mfuh82yX2zk5YvVu9XP69eD1bv19+s3q3+u3q3+Za/28v41H1b/etvq9ferv65/WP34uUWjLYt+Wr1b/WP9dvW3zcuu/rJ6v3q3fvv555DQc6zfrH/Y/hzp88+xfr1+s/5u9ffB6s/r14P169XPq5/W363frt5/7knylid5s/7T6t/V/Ep99evV+8+/fd329m3B9lfe2VweH10l9s9DP2z28SrZ37yW/XXyF/Ord3MREI4IhTARZsJCqPdofzc/wk9SOYikckCpEI4IhTARZsJCqAehVA4jqRxSKoQjQiFMhJmwEOphKJWjSCpHlArhiFAIE2EmLIR6FErlOJLKMaVCOCIUwkSYCQuhHodSOYmkckKpEI4IhTARZsJCqCehVE4jqZxSKoQjQiFMhJmwEOppKJXnkVSeUyqEI0IhTISZsBDq81Aqe7uRWGxqey6oI1RBTagZtaCqazWevVA8exgP6QhVUBNqRi2o6lqNJ1R3bQriwcKLKqgJNaMWVHWtxhPqvTYF8WDzRRXUhJpRC6q6VuMJFWCbgniwAqMKakLNqAVVXavxhJqwTUE82IVRBTWhZtSCqq7VeEKV2KYgHizFqIKaUDNqQVXXajyhbmxTEA+2Y1RBTagZtaCqazWeUEm2KYgHazKqoCbUjFpQ1bUaT6gt2xTEg30ZVVATakYtqOpai2fzWXT9Yz5szagjVEFNqBm1oKprNZ5Qa7YpiAdbM6qgJtSMWlDVtRpP7ENi/pSYPybmz4n5g2L+pJg/KubPimOteT/Umm0K4sHWjCqoCTWjFlR1rcYTas02BfFga0YV1ISaUQuqulbjCbVmm4J4sDWjCmpCzagFVV2r8YRas01BPNiaUQU1oWbUgqqu1XhCrdmmIB5szaiCmlAzakFV12o8odZsUxAPtmZUQU2oGbWgqms1nlBrtimIB1szqqAm1IxaUNW1+n+BQ63ZprbHgzpCFdSEmlELqrpW4wm1ZpuCeLA1owpqQs2oBVVdq/GEWrNNQTzYmlEFNaFm1IKqrtV4YvdY8E0WfJcF32bB91nwjRZ8pwXfahFrzQeh1mxTEA+2ZlRBTagZtaCqazWeUGu2KYgHWzOqoCbUjFpQ1bUaT6g12xTEg60ZVVATakYtqOpajSfUmm0K4sHWjCqoCTWjFlR1rcYTas02BfFga0YV1ISaUQuqulbjCbVmm4J4sDWjCmpCzagFVV2rdwmGWrNNbY8HdYQqqAk1oxZUda3GE2rNNgXxYGtGFdSEmlELqrpW4wm1ZpuCeLA1owpqQs2oBVVdq/GEWrNNQTzYmlEFNaFm1IKqrtV4Yrco8z3KfJMy36XMtynzfcp8ozLfqRxrzYeh1mxTEA+2ZlRBTagZtaCqazWeUGu2KYgHWzOqoCbUjFpQ1bUaT6g12xTEg60ZVVATakYtqOpajSfUmm0K4sHWjCqoCTWjFlR1rcYTas02BfFga0YV1ISaUQuqula/RRJqzTa1PR7UEaqgJtSMWlDVtRpPqDXbFMSDrRlVUBNqRi2o6lqNJ9SabQriwdaMKqgJNaMWVHWtxhNqzTYF8WBrRhXUhJpRC6q6VuMJtWabgniwNaMKakLNqAVVXavxxL7hx1/x4+/48Zf8+Ft+/DU//p4ff9Ev1pqPQq3ZpiAebM2ogppQM2pBVddqPKHWbFMQD7ZmVEFNqBm1oKprNZ5Qa7YpiAdbM6qgJtSMWlDVtRpPqDXbFMSDrRlVUBNqRi2o6lr9lnGoNdvU9nhQR6iCmlAzakFV12o8odZsUxAPtmZUQU2oGbWgqms1nlBrtimIB1szqqAm1IxaUNW1Gk+oNdsUxIOtGVVQE2pGLajqWo0n1JptCuLB1owqqAk1oxZUda3GE2rNNgXxYGtGFdSEmlELqrpW44ltkME7ZPAWGbxHBm+Swbtk8DYZvE9GrDUfh1qzTUE82JpRBTWhZtSCqq7VeEKt2aYgHmzNqIKaUDNqQVXXajyh1mxTEA+2ZlRBTagZtaCqa3UXmlBrtqnt8aCOUAU1oWbUgqqu1XhCrdmmIB5szaiCmlAzakFV12o8odZsUxAPtmZUQU2oGbWgqms1nlBrtimIB1szqqAm1IxaUNW1Gk+oNdsUxIOtGVVQE2pGLajqWo0n1JptCuLB1owqqAk1oxZUda3GE2rNNgXxYGtGFdSEmlELqrpW44ntL8cbzPEOc7zFHO8xx5vM8S5zvM1crDWfhFqzTUE82JpRBTWhZtSCqq7VeEKt2aYgHmzNqIKaUDNqQVXX6i6FodZsU9vjQR2hCmpCzagFVV2r8YRas01BPNiaUQU1oWbUgqqu1XhCrdmmIB5szaiCmlAzakFV12o8odZsUxAPtmZUQU2oGbWgqms1nlBrtimIB1szqqAm1IxaUNW1Gk+oNdsUxIOtGVVQE2pGLajqWo0n1JptCuLB1owqqAk1oxZUda3GE2rNNgXxYGtGFdSEmlELqrpW44ltz8z7M/MGzbxDM2/RzHs08ybNvEtzrDWfhlqzTUE82JpRBTWhZtSCqq7VXaxDrdmmtseDOkIV1ISaUQuqulbjCbVmm4J4sDWjCmpCzagFVV2r8YRas01BPNiaUQU1oWbUgqqu1XhCrdmmIB5szaiCmlAzakFV12o8odZsUxAPtmZUQU2oGbWgqms1nlBrtimIB1szqqAm1IxaUNW1Gk+oNdsUxIOtGVVQE2pGLajqWo0n1JptCuLB1owqqAk1oxZUda3GE2rNNgXxYGtGFdSEmlELqrpW44mdbsLHm/D5JnzACZ9wwkec8BknfMhJ9JST4DEnlXNOKgedVE46qRx1UjnrpHLYSeW0k+BxJ7ux805sjHLiE0+QhTkxZ+bCrB94S047/3My5EXbt9+0k/FF24/ns+XgfH47s/CaT3HQ//GmGzaT8bJvBss/LLpL25HxbPPj2LSdZXo7afdeNB9OTPzFx4clNvbaDzP24L+ffusLXnTn42k7aQbzm27R9vPFsLladG3fLX573c4e3orun+knb2W3+qKf/NHm9Myb9qr7Tbu4Gs+Wg0l32Q+b3WcnzWBxfyFtft/Pbza/O2oG3877fj798Oi6ay+6hT06aAaX83n/8GDzn6lvv510X7WL/iHs+/f88OeDxdn4Yth8fbi3e3h4vN8ddLsHh0dt2/hhsovIYbLzy8vxeSfz89tpN+vvT5NddJP7n/B6fLP8cFU8vp3Nw4eTa1/8B1BLAwQUAAAACAADhCFdBVouQIYBAABSAwAAFAAAAHhsL3RhYmxlcy90YWJsZTEueG1sjZLfTtswFIdfxfL9mqRAqSoCQkgVlbYJwV7ANC6J5D+R7azhEokU1NfYRTY00U1MmniTc94GJYV0HaTi9vPv8znHPnsHuRTkKzc20SqkQcenhKuxjhJ1EdLMTT706cH+Xj5w7FxwkkQhDShRTPKQDpnh9kRkdiRTbdyXKkFJlNhUsMvPGyKGT0J6GAyOAz+gJOYs4uZUT490plx9v9OOCbtC/j/oLNZTVaNcCmUHeUhj59KB59lxzCWzHZ1ylUsx0UYyZzvaXHg2NZxFNubcSeF1fb/nSZYo2kx2pEUmlSXjZcH+/yfrk0MJD1gQKPEaZ/AHSvhLifeW0l0peA0/8QZ+tCS3muQdlPAb53BfF4DvsIAS563idouIM7zZKO68iFjgDK/gF4FvWBAs4AHu8ArnsGgxe405w1t4fM9D7L6lFLBo7a6/6q5Kva7hrX9dc8eZuxR8pCb62a+XroafeJRkskuJjfV0mBjrlm69TRX7yF6hauOcSVJu6/+v0DLRUH+tm/0nUEsDBBQAAAAIAAOEIV3WKqrT9gQAAAYPAAAYAAAAeGwvd29ya3NoZWV0cy9zaGVldDIueG1sjVdLc+JGEP4rU7qmgngaTC3eSnaz2YurUnvJmRjxqAByCdnGt4ARZpW9bFVuOaVYr0A2JhRrO2xu/hXd1/ySVPdIPOzhcZJm1D3T39dPvXjZrFXFqWE1KmY9p8UiUU0Y9SOzUKmXctqJXfw2o708eNHMnpnWr42yYdiiWavWG9lmTivb9nFW1xtHZaOWb0TMY6PerFWLplXL242IaZX0xrFl5AusVqvq8Wh0T6/lK3WNDuTdNyz8kyUKRjF/UrXfmWdvjUqpbOe0WEoTOgkemdVG8BS1ChmpiVq+yc+zSsEu57RYVBPlSqFg1HNaVBNHJw3brP0cfFscI9XjgXp8rp7ObFPXF2aw3a/zdp4WlnkmLBYikxN7ofIcBEM9IpnvYppo5LR4UhN2TmvYFn86PcA2eNiBgQAPpuCjCxPwYCygj134Ag8wFCzgwwP26Csv0cFL7KIr/vvtD4Et8GAC02/IzlNp7fze7xf36vPNV6rN16rNH1Sbb1SbP6o2365s6szYEnGJJX4SLJmIPuGHwd8SeBgq8W3S82GGHXTRAQ/8Fe1npiQDHyY3+TAp73rqw5jSsDXC0s9wC2N0BPZggm0YisdrNnglBh7/FdjCNjxEBF5gR8AdtgSjucaO4PDw4AF/B4/O8WAEY1pENgNN7QI0pbY9rgS6RpjgCPDhK7r4keK2D1P2xF8CJvAJezCVod2HGTowhmGE0eEFdgV25lEdxv8MJtgS7NH3TxQFjMDH96TVW7nShwnzOcBL8OADCdDpUhtbcE+0XsGAshA+kRBR7dDjEt0tTO7twuSempyEksk1wuDhBfhUI3ziBF24lRAGMAYPXRhyAGAHuwRBblzCDYlyeMAA7tCFrzAUhYJ+eKifn5+fEx0OcNxlRSylRxN6LJlMbwGd3gV0Wo0jqQS9Rhhb6IrHa3Swiy34mwqiQwZTgrTQ5fQAD27Jx4KkZGEkR35GB4ZZsazaW1HdgjGzC8aM2uyUEmNmM8Yu9mAm7Q+ymnK/t/qFI12CXioghFDmEQFEJ8yNf8DDS2KGrsA2F4jPpBCk1RYK9nehYF+Nak9Jwf4WN8s8XqVgEfgEaYJtBkAlEf6Usj2qeqTo88tY4qW6gD0YCyWDW6DzNLEVO0mp8KTVTTi6uUaO0YEbAbe0RpcLevjpnqzv4wVch3EeEhRg5a4Q1P9t0GI7QYupjc2ooa2RhgHMaI551tao7sxrO7pU1+Ge0nNG2LHL1QxdbMEI7qT+iAKYeh5XOfAZrqyD860LPn0isA0Dquo+jPiYjjxiCjdsiC/gijsIp0uPCij422iL70RbXE3Evpq2NdLP+RIcCejCPZES9q5wOEQHBuDBF5hQFgTQAnopSXzsgo9toqFPHMp+IOXk0LFMBJWdDm/R1Tcwg+E2bhI7cZNYMzlF1eSsEV8al8LWFVjMBIyC4rCUPWPKKQH38waxyu02cOGwlNkILhiA9p9aS0O6owa4TmUpMbANE+iH436HstyBEc+z7ENyGIOTPvSpEMAIPgi4pjLpcvx/DOP/DlvYC8NnGkzFi4hxFjEwz6A+VZcropCUKKp4mg5aysY+oj/5UaoZVsl4ZVTlP9R8JSyjSARm6T9B/iCsSh7nS8Zh3ipV6g1RNYp2TotG0pqwpBP43TaP+S2liV9M2zZr4aps5AuGRauEJoqmac8X8qb5L+3B/1BLAwQUAAAACAADhCFdc6mmKMsCAAA0CQAAGAAAAHhsL3dvcmtzaGVldHMvc2hlZXQzLnhtbJ2Wy27aQBSGX2U0+2Iu5lIUE7W5salUddO1CwNYtT3IngBbWiCI1+iChKYhEW2jqrs8xTlvU83YGIjGTcjKc47n+8/M8e+xDw4Hnkt6LAgd7ls0l8lSwvwGbzp+26LnovWqQg9rB4Nqnwefww5jggw81w+rA4t2hOhWDSNsdJhnhxneZf7Ac1s88GwRZnjQNsJuwOymwjzXyGezJcOzHZ9KQZU9VZPfB6TJWva5Kz7wfp057Y6waK5IiSEnNrgbxlfiOXKRlHj2QF37TlN0LFrIU9Jxmk3mWzRLSeM8FNz7GN3LbWQiPB/j+QTPV/bACzFeSPBcaQ/cjHHzZXgxxosbfJ/Fl2K8tNm7uQdejvHyBs/ugVdivLLH3o2NAZRjjm1hyyDgfRLISaqCHL7JURJa1DQpERYNRaBu9WowhxWOCcxxhBP4CXO4l6q9SDvB36biOIJrvIArHXWURi1gDnc4gxtVGC5hCXOc6UWOnyeCE7xIFzlJEcExTnAItwS+4ZjgGFawwCHOYKlTOU1TmeAU/jzZxLNn4GNY6ndQT92BJNJrG8oNW6bIb5kiH2m+1ptirUdgAUvV6kucyeB6HWitkiaqbLKjFYWJWoqJUvRyRSNbMHKmWda65kXUSQr1pDFSG4lfYQGXRLlsRTRGiR87TuEap7AksgjBofQ2rLQuekGtLY/sUam+Uyn6MPVqlf/bS56YwqIFc31gJZ+sLd+ZSrhYedzmC7iFeXQm/MKhfB+/y4DAAqfwG2fwQy0Zv8B9huAIR9KpsMAZ3MEcliQK4QaW0r5TuMMvcEUelMju1Ie/Ga15NyszNg7UJY91yRNd8lSXPNMl6zvJdWuNR4e7x4I2O2JudO4nEQlYS7a2KlUifHdm126zd3bQdvyQuKwlLJrNlCkJosejxoJ31ahIyScuBPfWUYfZTRbIqEBJi3ORBFGl5Aeo9g9QSwMEFAAAAAAAA4QhXUGYZUMoAQAAKAEAAAsAAABfcmVscy8ucmVsc++7vzw/eG1sIHZlcnNpb249IjEuMCIgZW5jb2Rpbmc9InV0Zi04Ij8+PFJlbGF0aW9uc2hpcHMgeG1sbnM9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9wYWNrYWdlLzIwMDYvcmVsYXRpb25zaGlwcyI+PFJlbGF0aW9uc2hpcCBUeXBlPSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvb2ZmaWNlRG9jdW1lbnQvMjAwNi9yZWxhdGlvbnNoaXBzL29mZmljZURvY3VtZW50IiBUYXJnZXQ9Ii94bC93b3JrYm9vay54bWwiIElkPSJSYjQ1OGEyZTk2NWU4NDIxMiIgLz48L1JlbGF0aW9uc2hpcHM+UEsDBBQAAAAIAAOEIV05zioUMwEAADAEAAAaAAAAeGwvX3JlbHMvd29ya2Jvb2sueG1sLnJlbHPN0zFuwyAUBuCrWOw1BkxsV3GydOma5gIYHrYVAxaQ1jlbhx6pV6jaVJVddchiqQvDj/Tr4+nx/vq23U9mSJ7Bh97ZGpE0QwlY6VRv2xqdo74r0X63PcAgYu9s6PoxJJMZbKhRF+N4j3GQHRgRUjeCncygnTcihtT5Fo9CnkQLmGbZBvt5B1p2JsfLCLc0Oq17CQ9Ong3Y+EcxDvEyQEDJUfgWYo3wNHxn6WQGlDyqGh04I6piRSEkF3lGKErwaqDYgYGl5yu6nmSm0pIzXjBWFIXKoWFrqkInPKin6Hvb/p7W/GrGY4oyojImKRV5UTZr8l6cP4UOIC5pP/HnAwDifHpUQ0PKKiNcQV6y/8CjMx6pGOOMcs2B5rpadeVu5LE5T5QbQXRTqrLJK33l4cW/330AUEsDBBQAAAAIAAOEIV02qNWougAAACQBAAAjAAAAeGwvd29ya3NoZWV0cy9fcmVscy9zaGVldDEueG1sLnJlbHONzz1uAjEQhuGrWNNnxwsLQtF6adKkRVxgMLO7Fv6TbZA5W4ociStQQBGkFLTfKz3Sd/v57bfVWXHhlE3wCtpGgmCvw9H4ScG5jB8b2A79ji0VE3yeTcyiOuuzgrmU+ImY9cyOchMi++rsGJKjkpuQJoykTzQxLqRcY/prwKsp9tfI74hhHI3mr6DPjn35B8ZCB8sg9pQmLgqw2sf0LG1TnQXxfVSw61rZdesFL1kuuxURCBx6fPk63AFQSwMEFAAAAAgAA4QhXYSOTTQtAQAA5gQAABMAAABbQ29udGVudF9UeXBlc10ueG1sxZTdSgMxEIVfZcmtNGkriEi3vVBvVdAXGLOzu6H5IzOt22fzwkfyFaRZKVKEpbjFm5ybyXfOmUA+3z8Wq87ZYouJTPClmMmpKNDrUBnflGLD9eRarJaLl11EKjpnPZWiZY43SpFu0QHJENF3ztYhOWCSITUqgl5Dg2o+nV4pHTyj5wnvGWK5uMMaNpaL+47R97ads6K47ef2VqWAGK3RwCZ4tfXVkckk1LXRWAW9cehZUkwIFbWI7KzMKh0Yf5HB6lfPhJZOM/1uJRPaPEOtiXSweNxiSqbC4gkSP4DDUqjOKuKdRZIjN8zQIWtu0WF/zv4cIGMGy7aQsHrmZHwzeuef7KEgbyGt80VSWWYjhznwB98AXi1SL2OHyNBTNzH/r00cB7k8exCVf63lF1BLAQIUAxQAAAAIAAKEIV0+Kow/EwEAAFICAAAPAAAAAAAAAAAAAACkgQAAAAB4bC93b3JrYm9vay54bWxQSwECFAMUAAAACAAChCFdOgLAsg0DAADOLQAADQAAAAAAAAAAAAAApIFAAQAAeGwvc3R5bGVzLnhtbFBLAQIUAxQAAAAIAAKEIV36XAFZAwMAANoNAAATAAAAAAAAAAAAAACkgXgEAAB4bC90aGVtZS90aGVtZTEueG1sUEsBAhQDFAAAAAgAAoQhXQ0euehlAAAAcwAAABQAAAAAAAAAAAAAAKSBrAcAAHhsL3NoYXJlZFN0cmluZ3MueG1sUEsBAhQDFAAAAAgAAoQhXcFWkUnbCgAA7XYAABgAAAAAAAAAAAAAAKSBQwgAAHhsL3dvcmtzaGVldHMvc2hlZXQxLnhtbFBLAQIUAxQAAAAIAAOEIV0FWi5AhgEAAFIDAAAUAAAAAAAAAAAAAACkgVQTAAB4bC90YWJsZXMvdGFibGUxLnhtbFBLAQIUAxQAAAAIAAOEIV3WKqrT9gQAAAYPAAAYAAAAAAAAAAAAAACkgQwVAAB4bC93b3Jrc2hlZXRzL3NoZWV0Mi54bWxQSwECFAMUAAAACAADhCFdc6mmKMsCAAA0CQAAGAAAAAAAAAAAAAAApIE4GgAAeGwvd29ya3NoZWV0cy9zaGVldDMueG1sUEsBAhQDFAAAAAAAA4QhXUGYZUMoAQAAKAEAAAsAAAAAAAAAAAAAAKSBOR0AAF9yZWxzLy5yZWxzUEsBAhQDFAAAAAgAA4QhXTnOKhQzAQAAMAQAABoAAAAAAAAAAAAAAKSBih4AAHhsL19yZWxzL3dvcmtib29rLnhtbC5yZWxzUEsBAhQDFAAAAAgAA4QhXTao1ai6AAAAJAEAACMAAAAAAAAAAAAAAKSB9R8AAHhsL3dvcmtzaGVldHMvX3JlbHMvc2hlZXQxLnhtbC5yZWxzUEsBAhQDFAAAAAgAA4QhXYSOTTQtAQAA5gQAABMAAAAAAAAAAAAAAKSB8CAAAFtDb250ZW50X1R5cGVzXS54bWxQSwUGAAAAAAwADAAiAwAATiIAAAAA'
        });

        const STORE = {
            cache: `${META.id}-pd-cache-v3`,
            drafts: `${META.id}-pd-drafts-v1`,
            templates: `${META.id}-pd-templates-v1`,
            preferences: `${META.id}-pd-preferences-v1`,
            reportProfile: `${META.id}-pd-report-profile-v1`
        };
        const FIELDS = {
            name:'TrainingName', location:'Location', startDate:'TrainingStartDate',
            endDate:'TrainingEndDate', role:'TrainerType', type:'TrainingType',
            durationType:'DurationType', duration:'Duration'
        };
        const pd = {
            mounted:false, scanning:false, activities:[], analysis:null,
            filter:{q:'',role:'',type:'',durationType:'',year:''},
            view:'table', sort:'newest',
            reportScope:'filtered',
            tab:'activities', managerOpen:false, observer:null, timer:null,
            importRows:[], importErrors:[], importFileName:'',
            certificateResults:[], certificateBusy:false,
            certificateProgress:'', pendingCertificateId:null,
            certificateAiBusy:new Set(), certificateAiStatus:'',
            searchTimer:null,
            editorIndex:null, editorMode:null, editorActivity:null,
            editorBusy:false, expanding:false, guardHandler:null,
            commitResuming:false
        };

        const byId = id => document.getElementById(id);

        // جميع أزرار فارس+ يجب أن تكون أزرار UI فقط، لا Submit.
        // صفحة فارس كلها تقريبًا داخل DefaultFormName، لذلك أي button بلا type
        // قد يرسل نموذج Oracle ويعيد PPR قبل ظهور واجهة فارس+.
        function neutralizeUiButtons(root) {
            if (!root) return;

            const buttons = root.matches?.('button')
                ? [root, ...root.querySelectorAll('button')]
                : [...root.querySelectorAll('button')];

            for (const button of buttons) {
                button.type = 'button';
                button.setAttribute('type', 'button');
            }
        }

        // مهم: TrainingTableRN لا يوجد أصلًا عندما يكون القسم مطويًا.
        // لذلك نتعرف على الصفحة من Region + زر الطي/الفتح، ثم نفتحها نحن.
        const matchPage = () => !!(
            byId('TrainingDetailsRN') &&
            (
                byId('TrainingDetailsRN__xc_') ||
                byId('TrainingTableRN')
            )
        );

        const trainingRoot = () =>
            byId('TrainingTableRN') ||
            byId('TrainingDetailsRN') ||
            document;

        function detectRowPrefix() {
            const root = trainingRoot();

            const field = [
                ...root.querySelectorAll('input[id],select[id],textarea[id]')
            ].find(el => {
                const id = String(el.id || '');
                return (
                    /:TrainingName:\d+$/.test(id) &&
                    !id.startsWith('_hdfp')
                );
            });

            return field
                ? field.id.replace(/:TrainingName:\d+$/, '')
                : '';
        }

        function fieldByOracleName(fieldName, rowIndex) {
            const suffix = `:${fieldName}:${rowIndex}`;
            const prefix = detectRowPrefix();

            if (prefix) {
                const exact = byId(`${prefix}${suffix}`);
                if (exact && !String(exact.id).startsWith('_hdfp')) {
                    return exact;
                }
            }

            const root = trainingRoot();

            return [
                ...root.querySelectorAll('[id]')
            ].find(el => {
                const id = String(el.id || '');
                return (
                    id.endsWith(suffix) &&
                    !id.startsWith('_hdfp')
                );
            }) || null;
        }

        const valueText = el => !el ? '' : el.tagName === 'SELECT'
            ? clean(el.selectedOptions?.[0]?.textContent || el.options?.[el.selectedIndex]?.text || el.value || '')
            : clean(el.value || '');

        const control = (key, i) =>
            fieldByOracleName(FIELDS[key], i);

        const recordId = i => clean(
            fieldByOracleName('TrainingNID', i)?.value ||
            fieldByOracleName('_pkRowID', i)?.value ||
            ''
        );


        // =========================================================
        // بيانات الموظف الشخصية: تبقى مطوية دائمًا
        // =========================================================
        function personalSectionState() {
            const toggle = byId('PersonalDetailsRN__xc_');
            const content = byId('PersonalDetailsRN__xc_hideshow');
            const aria = clean(toggle?.getAttribute('aria-expanded') || '');
            const onclick = String(toggle?.getAttribute('onclick') || '');

            if (
                aria === 'true' ||
                /_submitHideShow\([^)]*['"]hide['"]/.test(onclick)
            ) {
                return 'expanded';
            }

            if (
                aria === 'false' ||
                /_submitHideShow\([^)]*['"]show['"]/.test(onclick)
            ) {
                return 'collapsed';
            }

            if (toggle && !content) return 'collapsed';
            if (content && isVisible(content)) return 'expanded';

            return 'unknown';
        }

        async function ensurePersonalCollapsed() {
            const toggle = byId('PersonalDetailsRN__xc_');

            // بعض نسخ الصفحة قد لا تحتوي المنطقة؛ لا نعتبر ذلك خطأ.
            if (!toggle) return true;

            if (personalSectionState() === 'collapsed') {
                return true;
            }

            toggle.click();

            const started = Date.now();

            while (Date.now() - started < 3500) {
                if (personalSectionState() === 'collapsed') {
                    return true;
                }
                await wait(100);
            }

            return personalSectionState() === 'collapsed';
        }

        function trainingSectionState() {
            const toggle = byId('TrainingDetailsRN__xc_');
            const content = byId('TrainingDetailsRN__xc_hideshow');
            const tableSpan = byId('TrainingTableRN');
            const table = byId('TrainingTableRN:Content');

            const aria = clean(toggle?.getAttribute('aria-expanded') || '');
            const onclick = String(toggle?.getAttribute('onclick') || '');

            // Oracle يصرّح بالحالة بوضوح:
            // false + 'show' = مطوي
            // true  + 'hide' = مفتوح
            if (
                aria === 'false' ||
                /_submitHideShow\([^)]*['"]show['"]/.test(onclick)
            ) {
                return 'collapsed';
            }

            if (
                aria === 'true' ||
                /_submitHideShow\([^)]*['"]hide['"]/.test(onclick)
            ) {
                // قد يغير Oracle الزر قبل أن يكتمل بناء الجدول،
                // لذلك نعتبرها "opening" حتى تظهر البيانات فعليًا.
                if (tableSpan && table && isVisible(table)) {
                    return 'expanded';
                }
                return 'opening';
            }

            if (content && table && isVisible(content) && isVisible(table)) {
                return 'expanded';
            }

            // في هذه الصفحة غياب content أثناء وجود زر المنطقة يعني غالبًا أنها مطوية.
            if (toggle && !content && !tableSpan) {
                return 'collapsed';
            }

            return 'unknown';
        }

        function trainingSectionExpanded() {
            return trainingSectionState() === 'expanded';
        }

        function actualTrainingRowsReady() {
            const table = byId('TrainingTableRN:Content');
            if (!table || !isVisible(table)) return false;

            const prefix = detectRowPrefix();
            if (!prefix) return false;

            const firstName = fieldByOracleName('TrainingName', 0);
            return !!firstName;
        }

        async function waitForTrainingRows(timeout = 5000) {
            const started = Date.now();
            let stable = 0;
            let previous = '';

            while (Date.now() - started < timeout) {
                if (actualTrainingRowsReady()) {
                    const current = [
                        detectRowPrefix(),
                        byId('TrainingTableRN:Content')?.rows?.length || 0,
                        clean(fieldByOracleName('TrainingName', 0)?.value || ''),
                        clean(fieldByOracleName('TrainingStartDate', 0)?.value || '')
                    ].join('|');

                    if (current && current === previous) {
                        stable++;
                    } else {
                        stable = 0;
                        previous = current;
                    }

                    // ننتظر قراءتين متتاليتين متطابقتين كي لا نقرأ أثناء PPR.
                    if (stable >= 1) {
                        return true;
                    }
                }

                await wait(100);
            }

            return actualTrainingRowsReady();
        }

        async function ensureTrainingExpanded() {
            if (pd.expanding) {
                const started = Date.now();

                while (
                    pd.expanding &&
                    Date.now() - started < 5500
                ) {
                    await wait(100);
                }

                return trainingSectionExpanded() && actualTrainingRowsReady();
            }

            const stateNow = trainingSectionState();

            if (stateNow === 'expanded') {
                return await waitForTrainingRows(2500);
            }

            pd.expanding = true;

            try {
                let toggle = byId('TrainingDetailsRN__xc_');

                if (!toggle) {
                    return false;
                }

                // لا نضغط إذا كان Oracle قد بدأ الفتح بالفعل.
                if (stateNow !== 'opening') {
                    // استدعاء النقر الأصلي لـ Oracle فقط.
                    toggle.click();
                }

                const started = Date.now();

                while (Date.now() - started < 5500) {
                    const state = trainingSectionState();

                    if (state === 'expanded') {
                        const rowsReady = await waitForTrainingRows(2200);
                        if (rowsReady) return true;
                    }

                    // بعد PPR قد يستبدل Oracle زر الطي نفسه.
                    toggle = byId('TrainingDetailsRN__xc_') || toggle;

                    await wait(100);
                }

                return (
                    trainingSectionExpanded() &&
                    await waitForTrainingRows(1200)
                );
            } finally {
                pd.expanding = false;
            }
        }

        const pager = () => {
            const root=byId('TrainingTableRN'); if(!root) return null;
            const list=[...root.querySelectorAll('select[title="اختيار مجموعة السجلات"]')];
            return list.find(isVisible) || list[0] || null;
        };
        const pageRange = () => clean(pager()?.selectedOptions?.[0]?.textContent || pager()?.options?.[pager()?.selectedIndex]?.text || '');
        const rangeStart = text => Number(clean(text).match(/(\d+)\s*-\s*(\d+)/)?.[1] || 1);
        const sig = () => [pager()?.selectedIndex ?? -1,pageRange(),...Array.from({length:10},(_,i)=>recordId(i)||control('name',i)?.value||'')].join('|');
        const editing = () => Array.from({length:20},(_,i)=>control('name',i)).some(el=>el && !el.disabled);

        function editableRowIndex(){
            for(let i=0;i<30;i++){
                const el=control('name',i);
                if(el && !el.disabled) return i;
            }
            return null;
        }

        function rowIdentity(i){
            return {
                nid: clean(fieldByOracleName('TrainingNID',i)?.value||''),
                pk: clean(fieldByOracleName('_pkRowID',i)?.value||''),
                flag: clean(fieldByOracleName('trainingRecordFlag',i)?.value||'')
            };
        }

        function incompleteEditableRow(){
            const i=editableRowIndex();
            if(i===null) return null;

            const required=['name','location','startDate','endDate','role','type','durationType','duration'];
            const missing=required.filter(k=>!clean(valueText(control(k,i))));

            return missing.length
                ? {index:i,missing,identity:rowIdentity(i)}
                : null;
        }

        function likelyTransientNewRow(i){
            if(i===null || i===undefined) return false;

            const id=rowIdentity(i);

            if(!id.nid && !id.pk) return true;

            const p=pager();
            const expected=p ? expectedRowsForPagerIndex(p.selectedIndex) : 0;

            if(expected && rowCount()>expected && i>=expected) {
                return true;
            }

            return /new|insert|create|^i$/i.test(id.flag);
        }

        function templateControl(key){
            for(let i=0;i<30;i++){
                const el=control(key,i);
                if(el) return el;
            }
            return null;
        }

        function nativeOptionText(option){
            if(!option) return '';

            return clean(
                option.text ||
                option.label ||
                option.textContent ||
                option.innerText ||
                ''
            );
        }

        function legacyOptionText(key,raw){
            const wanted=String(raw??'');
            const wantedNorm=nativeComparable(wanted);

            if(!wantedNorm) return '';

            /*
             * Oracle OAF قد يغيّر option.value في صف الإضافة بعد reload،
             * بينما الصفوف المعروضة/المعطلة تبقي القيم القديمة التي خزنتها
             * المسودة. لذلك نبحث عن القيمة القديمة في أي SELECT لنفس الحقل
             * ثم نأخذ النص الظاهر، وبعدها نستخدم النص لاختيار option الجديدة.
             */
            for(let i=0;i<30;i++){
                const el=control(key,i);

                if(!el || el.tagName!=='SELECT'){
                    continue;
                }

                const selected=
                    el.options?.[el.selectedIndex]||null;

                if(
                    selected &&
                    (
                        String(selected.value)===wanted ||
                        nativeComparable(selected.value)===wantedNorm
                    )
                ){
                    const text=
                        nativeOptionText(
                            selected
                        );

                    if(text) return text;
                }

                const option=
                    [...el.options].find(
                        o=>
                            String(o.value)===wanted ||
                            nativeComparable(o.value)===wantedNorm
                    );

                if(option){
                    const text=
                        nativeOptionText(
                            option
                        );

                    if(text) return text;
                }
            }

            return '';
        }

        function canonicalDraftOptionValue(key,raw){
            const value=clean(raw);

            if(!value) return '';

            const mapped=
                legacyOptionText(
                    key,
                    value
                );

            return mapped||value;
        }

        function canonicalizeDraftOptions(draft){
            if(!draft || typeof draft!=='object'){
                return draft;
            }

            const copy={
                ...draft
            };

            for(const key of [
                'location',
                'role',
                'type',
                'durationType',
                'duration'
            ]){
                copy[key]=
                    canonicalDraftOptionValue(
                        key,
                        copy[key]
                    );
            }

            return copy;
        }

        function guardIncompleteNativeAction(actionLabel='هذا الإجراء'){
            const stuck=incompleteEditableRow();

            if(!stuck) return true;

            openStuckRecovery(stuck);

            toast(
                `يوجد سطر غير مكتمل في فارس؛ عالجه قبل ${actionLabel}.`,
                'error'
            );

            return false;
        }
        const waitChange = (before,timeout=3200) => new Promise(resolve=>{
            const start=Date.now();
            const tick=()=>{
                if(sig()!==before) return setTimeout(()=>resolve(true),120);
                if(Date.now()-start>=timeout) return resolve(false);
                setTimeout(tick,80);
            };
            setTimeout(tick,80);
        });

        function currentRowsKey() {
            const prefix = detectRowPrefix();
            if (!prefix) return '';

            return Array.from({length:10}, (_, i) => {
                const name = fieldByOracleName('TrainingName', i);
                const start = fieldByOracleName('TrainingStartDate', i);

                return [
                    clean(name?.value || ''),
                    clean(start?.value || '')
                ].join('~');
            }).join('|');
        }

        function expectedRowsForPagerIndex(index) {
            const p = pager();
            const value = clean(p?.options?.[index]?.value || '');
            const match = value.match(/^\s*\d+\s*,\s*(\d+)\s*$/);
            return match ? Number(match[1]) : 0;
        }

        async function waitForStablePagerPage(targetIndex, beforeRowsKey = '', timeout = 5200) {
            const started = Date.now();
            let last = '';
            let stableCount = 0;

            while (Date.now() - started < timeout) {
                const p = pager();
                const key = currentRowsKey();
                const expected = expectedRowsForPagerIndex(targetIndex);
                const count = rowCount();

                const ready =
                    !!p &&
                    p.selectedIndex === targetIndex &&
                    !!detectRowPrefix() &&
                    count > 0 &&
                    (!expected || count >= expected) &&
                    (
                        !beforeRowsKey ||
                        targetIndex === 0 ||
                        key !== beforeRowsKey
                    );

                if (ready) {
                    const state = [
                        p.selectedIndex,
                        pageRange(),
                        count,
                        key
                    ].join('::');

                    if (state === last) {
                        stableCount++;
                    } else {
                        last = state;
                        stableCount = 0;
                    }

                    if (stableCount >= 1) {
                        return true;
                    }
                }

                await wait(120);
            }

            return false;
        }
        const change = el => { try{el?.dispatchEvent(new Event('change',{bubbles:true,cancelable:true}));}catch(_){} };
        const pagerLink = dir => {
            const title=dir==='next'?'التالي 10':'السابق 10', root=byId('TrainingTableRN');
            if(!root) return null;
            const list=[...root.querySelectorAll('a')].filter(a=>clean(a.getAttribute('title'))===title);
            return list.find(isVisible)||list[0]||null;
        };
        async function gotoPage(index){
            let p = pager();
            if (!p || index < 0 || index >= p.options.length) return false;

            await waitForTrainingRows(2600);

            if (p.selectedIndex === index) {
                return await waitForStablePagerPage(
                    index,
                    '',
                    2600
                );
            }

            const beforeRows = currentRowsKey();
            let before = sig();

            p.selectedIndex = index;
            change(p);

            await waitChange(before, 3000);

            if (
                await waitForStablePagerPage(
                    index,
                    beforeRows,
                    4200
                )
            ) {
                return true;
            }

            // احتياط: استخدم روابط السابق/التالي الأصلية إن لم يستجب select.
            for(let n=0;n<12;n++){
                p = pager();
                if(!p) return false;

                if(p.selectedIndex === index) {
                    return await waitForStablePagerPage(
                        index,
                        '',
                        2600
                    );
                }

                const dir =
                    p.selectedIndex < index
                        ? 'next'
                        : 'prev';

                const link = pagerLink(dir);
                if(!link) return false;

                const rowsBeforeStep = currentRowsKey();
                before = sig();

                link.click();

                await waitChange(before, 3300);

                if (
                    await waitForStablePagerPage(
                        p.selectedIndex < index
                            ? Math.min(index, p.selectedIndex + 1)
                            : Math.max(index, p.selectedIndex - 1),
                        rowsBeforeStep,
                        4200
                    )
                ) {
                    // نعيد التقييم في الدورة التالية.
                    continue;
                }
            }

            p = pager();

            return !!(
                p &&
                p.selectedIndex === index &&
                await waitForStablePagerPage(index, '', 2200)
            );
        }

        function rowCount(){ let n=0; for(let i=0;i<30;i++){ if(control('name',i)) n++; else if(i>=10) break; } return n; }
        function nativeActionUsable(el){
            if(!el||el.disabled)return false;
            return String(el.getAttribute?.('aria-disabled')||'').toLowerCase()!=='true';
        }
        function readPage(){
            const start=rangeStart(pageRange()), p=pager(), out=[];
            for(let i=0;i<rowCount();i++){
                const name=control('name',i); if(!name) continue;
                const a={
                    globalIndex:start+i,pageIndex:p?.selectedIndex??0,pageRange:pageRange(),rowIndex:i,recordId:recordId(i),
                    canEdit:nativeActionUsable(action(i,'update')),
                    canDelete:nativeActionUsable(action(i,'delete')),
                    name:clean(name.value||''),location:valueText(control('location',i)),startDate:clean(control('startDate',i)?.value||''),
                    endDate:clean(control('endDate',i)?.value||''),role:valueText(control('role',i)),type:valueText(control('type',i)),
                    durationType:valueText(control('durationType',i)),duration:valueText(control('duration',i))
                };
                if(a.name||a.startDate||a.endDate||a.recordId) out.push(a);
            }
            return out;
        }
        function loadCache(){
            const c=loadJSON(STORE.cache,{savedAt:0,activities:[]});
            if(Array.isArray(c.activities)&&c.activities.length){ pd.activities=c.activities; pd.analysis=analyze(pd.activities); return true; }
            return false;
        }
        const saveCache = () => saveJSON(STORE.cache,{savedAt:Date.now(),activities:pd.activities});
        function invalidate(){ saveJSON(STORE.cache,{savedAt:0,activities:[]}); }
        async function scan(force=false){
            if(pd.scanning) return pd.activities;

            const expanded = await ensureTrainingExpanded();

            if(!expanded){
                toast('تعذر فتح قسم بيانات الأنشطة تلقائيًا أو لم يكتمل تحميله.','error');
                return pd.activities;
            }

            if(!(await waitForTrainingRows(3200))){
                toast('تم فتح القسم لكن صفوف الأنشطة لم تكتمل بعد.','error');
                return pd.activities;
            }

            if(editing()){ toast('يوجد نشاط مفتوح للتعديل. احفظه قبل فهرسة جميع الصفحات.','error'); return pd.activities; }

            const p=pager(); if(!p){ toast('لم أجد صفحات الأنشطة.','error'); return pd.activities; }
            const cached=loadJSON(STORE.cache,{savedAt:0,activities:[]});
            if(!force && cached.savedAt && Date.now()-cached.savedAt<600000 && cached.activities?.length){
                pd.activities=cached.activities; pd.analysis=analyze(pd.activities); refresh(); updateBar(); return pd.activities;
            }
            pd.scanning=true; const original=p.selectedIndex, all=[];
            status(`جاري فهرسة ${p.options.length} مجموعات...`);
            try{
                for(let i=0;i<p.options.length;i++){
                    if(!(await gotoPage(i))) throw new Error(`pager ${i}`);

                    if(!(await waitForTrainingRows(2600))){
                        throw new Error(`rows ${i}`);
                    }

                    const pageRows = readPage();
                    const expected = expectedRowsForPagerIndex(i);

                    if(!pageRows.length){
                        throw new Error(`empty ${i}`);
                    }

                    if(expected && pageRows.length < expected){
                        // نعطي PPR فرصة أخيرة قبل اعتبار الصفحة ناقصة.
                        await wait(450);
                    }

                    const finalRows = readPage();

                    if(!finalRows.length){
                        throw new Error(`empty-final ${i}`);
                    }

                    all.push(...finalRows);

                    status(
                        `تمت قراءة ${all.length} نشاطًا — المجموعة ${i+1} من ${p.options.length}` +
                        ` — Oracle: ${detectRowPrefix() || 'غير معروف'}`
                    );

                    await wait(120);
                }
                pd.activities=all.sort((a,b)=>a.globalIndex-b.globalIndex); pd.analysis=analyze(pd.activities); saveCache();
                toast(`تمت فهرسة ${pd.activities.length} نشاطًا.`);
            }catch(err){ console.error('[فارس+] PD scan',err); if(all.length){pd.activities=all;pd.analysis=analyze(all);} toast('توقفت الفهرسة قبل اكتمال جميع الصفحات.','error'); }
            finally{ try{await gotoPage(original);}catch(_){} pd.scanning=false; status(`جاهز — ${pd.activities.length} نشاطًا`); refresh(); updateBar(); }
            return pd.activities;
        }

        const norm = v => normalizeArabic(v||'').replace(/\s+/g,' ').trim();
        function dateKey(v){
            const n=clean(v).match(/\d+/g); if(!n||n.length<3) return null;
            let a=+n[0],b=+n[1],c=+n[2],y,m,d;
            if(a>1000){y=a;m=b;d=c}else if(c>1000){d=a;m=b;y=c}else return null;
            if(m<1||m>12||d<1||d>31) return null;
            return {year:y,key:y*10000+m*100+d};
        }

        // فارس يعرض تاريخ النشاط هجريًا، بينما الاحتساب السنوي للأنشطة
        // يكون بالسنة الميلادية. لذلك نحافظ على التاريخ الهجري كما هو
        // ونشتق منه سنة احتساب ميلادية منفصلة (من تاريخ بداية النشاط).
        const activityYearCache=new Map();

        function activityYearInfo(value=''){
            const raw=clean(value);

            if(!raw){
                return {hijriYear:null,gregorianYear:null,gregorianDate:null};
            }

            if(activityYearCache.has(raw)){
                return activityYearCache.get(raw);
            }

            const parts=parseNumericDate(raw);
            let hijriYear=null;
            let gregorianYear=null;
            let gregorianDate=null;

            if(parts){
                if(parts.year<1700){
                    hijriYear=parts.year;
                    gregorianDate=hijriToGregorian(parts);

                    if(
                        gregorianDate instanceof Date &&
                        Number.isFinite(gregorianDate.getTime())
                    ){
                        gregorianYear=gregorianDate.getUTCFullYear();
                    }
                }else{
                    gregorianYear=parts.year;
                    gregorianDate=new Date(
                        Date.UTC(
                            parts.year,
                            parts.month-1,
                            parts.day,
                            12,0,0,0
                        )
                    );

                    const hp=gregorianDateToHijri(gregorianDate);
                    hijriYear=hp?.year||null;
                }
            }

            const info={hijriYear,gregorianYear,gregorianDate};
            activityYearCache.set(raw,info);
            return info;
        }

        const activityGregorianYear = activity =>
            activityYearInfo(activity?.startDate).gregorianYear;

        const activityHijriYear = activity =>
            activityYearInfo(activity?.startDate).hijriYear;
        const durNum = a => +(String(a.duration||'').match(/\d+/)?.[0]||0);
        function analyze(list){
            const r={total:list.length,beneficiary:0,executor:0,totalHours:0,totalDays:0,missing:[],invalidDates:[],exactDuplicates:[],possibleDuplicates:[],overlaps:[],yearConversionMissing:[],crossGregorianYears:[],byType:{},byLocation:{},byRole:{},byYear:{},byHijriYear:{}};
            const exact=new Map(), names=new Map();
            for(const a of list){
                const role=clean(a.role)||'غير محدد', type=clean(a.type)||'غير محدد', loc=clean(a.location)||'غير محدد';
                r.byRole[role]=(r.byRole[role]||0)+1; r.byType[type]=(r.byType[type]||0)+1; r.byLocation[loc]=(r.byLocation[loc]||0)+1;
                if(/مستفيد/.test(role)) r.beneficiary++; if(/منفذ/.test(role)) r.executor++;
                if(/ساع/.test(a.durationType)) r.totalHours+=durNum(a); if(/يوم|ايام|أيام/.test(a.durationType)) r.totalDays+=durNum(a);
                const s=dateKey(a.startDate),e=dateKey(a.endDate);
                const gy=activityGregorianYear(a);
                const hy=activityHijriYear(a);
                const endGy=activityYearInfo(a.endDate).gregorianYear;
                if(gy) r.byYear[gy]=(r.byYear[gy]||0)+1;
                if(hy) r.byHijriYear[hy]=(r.byHijriYear[hy]||0)+1;
                if(a.startDate && !gy) r.yearConversionMissing.push(a);
                if(gy && endGy && gy!==endGy){
                    r.crossGregorianYears.push({activity:a,startYear:gy,endYear:endGy});
                }
                const miss=[]; if(!a.name)miss.push('اسم النشاط'); if(!a.location)miss.push('الجهة'); if(!a.startDate)miss.push('تاريخ البداية'); if(!a.endDate)miss.push('تاريخ النهاية'); if(!a.type)miss.push('نوع النشاط');
                if(miss.length) r.missing.push({activity:a,fields:miss}); if(s&&e&&e.key<s.key) r.invalidDates.push(a);
                const ek=[norm(a.name),norm(a.startDate),norm(a.endDate),norm(a.location)].join('|'); if(!exact.has(ek))exact.set(ek,[]); exact.get(ek).push(a);
                const nk=norm(a.name); if(nk){if(!names.has(nk))names.set(nk,[]);names.get(nk).push(a);}
            }
            r.exactDuplicates=[...exact.values()].filter(g=>g.length>1&&norm(g[0].name));
            r.possibleDuplicates=[...names.values()].filter(g=>g.length>1);
            for(let i=0;i<list.length;i++){
                const a=list[i],as=dateKey(a.startDate),ae=dateKey(a.endDate); if(!as||!ae)continue;
                for(let j=i+1;j<list.length;j++){
                    const b=list[j],bs=dateKey(b.startDate),be=dateKey(b.endDate); if(!bs||!be)continue;
                    if((as.year<1500)!==(bs.year<1500))continue;
                    if(as.key<=be.key&&bs.key<=ae.key) r.overlaps.push([a,b]);
                }
            }
            return r;
        }
        function issues(){ const a=pd.analysis||analyze(pd.activities); return {errors:a.missing.length+a.invalidDates.length+a.exactDuplicates.length,warnings:a.possibleDuplicates.length+a.overlaps.length}; }
        function smartCheck(show=true){ pd.analysis=analyze(pd.activities); const x=issues(); if(show){pd.tab='analysis';refresh();toast(x.errors?`وجد الفحص ${x.errors} ملاحظات تحتاج مراجعة.`:x.warnings?`لا أخطاء أساسية، ويوجد ${x.warnings} تنبيهًا.`:'لا توجد ملاحظات ظاهرة.');} return {...x,analysis:pd.analysis}; }
        const unique = key => [...new Set(pd.activities.map(a=>clean(a[key])).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
        const years = () => [...new Set(
            pd.activities.map(activityGregorianYear).filter(Boolean)
        )].sort((a,b)=>b-a);

        const hijriYears = () => [...new Set(
            pd.activities.map(activityHijriYear).filter(Boolean)
        )].sort((a,b)=>b-a);

        function fuzzyScore(query,text){
            const q=norm(query),t=norm(text);
            if(!q) return 1;
            if(t.includes(q)) return 1;

            const qw=q.split(' ').filter(Boolean);
            const tw=t.split(' ').filter(Boolean);
            if(!qw.length||!tw.length) return 0;

            let hit=0;
            for(const word of qw){
                if(tw.some(w=>w.includes(word)||word.includes(w))) hit++;
                else{
                    // subsequence tolerant for small typos
                    let p=0;
                    for(const ch of word){
                        p=t.indexOf(ch,p);
                        if(p<0) break;
                        p++;
                    }
                    if(p>0) hit+=0.55;
                }
            }
            return hit/qw.length;
        }

        function parseSearch(raw=''){
            const result={terms:[],cmd:{}};
            const tokens=String(raw).match(/"[^"]+"|\S+/g)||[];
            const commandPairs=[
                ['جهة','location'],['الجهة','location'],
                ['نوع','type'],['الدور','role'],['دور','role'],
                ['سنة','year'],['عام','year'],
                ['ميلادي','year'],['سنةميلادية','year'],
                ['هجري','hijriYear'],['سنةهجرية','hijriYear'],
                ['مدة','duration'],['ساعات','hours'],
                ['اسم','name']
            ];
            const map=new Map(commandPairs.map(([k,v])=>[norm(k),v]));
            for(const token of tokens){
                const m=token.match(/^([^:]+):(.+)$/);
                const key=m?map.get(norm(m[1])):null;
                if(m&&key){
                    result.cmd[key]=m[2].replace(/^"|"$/g,'');
                }else{
                    result.terms.push(token.replace(/^"|"$/g,''));
                }
            }
            return result;
        }

        function compareDuration(expr,a){
            const n=durNum(a);
            const m=String(expr||'').match(/^(>=|<=|>|<|=)?\s*(\d+(?:\.\d+)?)$/);
            if(!m) return fuzzyScore(expr,String(a.duration||''))>=.72;
            const op=m[1]||'=',v=+m[2];
            return op==='>'?n>v:op==='<'?n<v:op==='>='?n>=v:op==='<='?n<=v:n===v;
        }

        function sortActivities(rows){
            const copy=[...rows];
            const date=a=>dateKey(a.startDate)?.key||0;
            if(pd.sort==='oldest') copy.sort((a,b)=>date(a)-date(b));
            else if(pd.sort==='name') copy.sort((a,b)=>a.name.localeCompare(b.name,'ar'));
            else if(pd.sort==='duration') copy.sort((a,b)=>durNum(b)-durNum(a));
            else if(pd.sort==='location') copy.sort((a,b)=>a.location.localeCompare(b.location,'ar'));
            else copy.sort((a,b)=>date(b)-date(a));
            return copy;
        }

        function filtered(){
            const parsed=parseSearch(pd.filter.q);
            const free=parsed.terms.join(' ');
            let rows=pd.activities.filter(a=>{
                const hay=[a.name,a.location,a.startDate,a.endDate,a.role,a.type,a.durationType,a.duration].join(' ');
                if(free&&fuzzyScore(free,hay)<.68)return false;

                const c=parsed.cmd;
                if(c.location&&fuzzyScore(c.location,a.location)<.72)return false;
                if(c.type&&fuzzyScore(c.type,a.type)<.72)return false;
                if(c.role&&fuzzyScore(c.role,a.role)<.72)return false;
                if(c.name&&fuzzyScore(c.name,a.name)<.72)return false;
                if(c.year&&String(activityGregorianYear(a)||'')!==String(c.year))return false;
                if(c.hijriYear&&String(activityHijriYear(a)||'')!==String(c.hijriYear))return false;
                if(c.duration&&!compareDuration(c.duration,a))return false;
                if(c.hours){
                    if(!/ساع/.test(a.durationType)||!compareDuration(c.hours,a))return false;
                }

                if(pd.filter.role&&a.role!==pd.filter.role)return false;
                if(pd.filter.type&&a.type!==pd.filter.type)return false;
                if(pd.filter.durationType&&a.durationType!==pd.filter.durationType)return false;
                if(pd.filter.year&&String(activityGregorianYear(a)||'')!==String(pd.filter.year))return false;
                return true;
            });
            return sortActivities(rows);
        }

        const opts = (arr,sel,allLabel='الكل') => [`<option value="">${esc(allLabel)}</option>`,...arr.map(v=>`<option value="${esc(v)}" ${String(v)===String(sel)?'selected':''}>${esc(v)}</option>`)].join('');
        const top = (obj,n=8) => Object.entries(obj||{}).sort((a,b)=>b[1]-a[1]).slice(0,n);
        const bars = (entries,total) => entries.length ? entries.map(([l,c])=>`<div class="${ID}-bar"><div><span>${esc(l)}</span><b>${c}</b></div><i><em style="width:${Math.max(4,Math.round(c/(total||1)*100))}%"></em></i></div>`).join('') : `<div class="${ID}-empty small">لا توجد بيانات.</div>`;


        const saveDrafts = rows =>
            saveJSON(
                STORE.drafts,
                Array.isArray(rows)
                    ? rows
                    : []
            );

        function loadDrafts(){
            const rows=
                loadJSON(
                    STORE.drafts,
                    []
                );

            if(!Array.isArray(rows)){
                return [];
            }

            let changed=false;

            const migrated=
                rows.map(row=>{
                    const next=
                        canonicalizeDraftOptions(
                            row
                        );

                    for(const key of [
                        'location',
                        'role',
                        'type',
                        'durationType',
                        'duration'
                    ]){
                        if(
                            clean(next?.[key])!==
                            clean(row?.[key])
                        ){
                            changed=true;
                            break;
                        }
                    }

                    return next;
                });

            if(changed){
                saveDrafts(migrated);

            }

            return migrated;
        }
        const loadTemplates = () => loadJSON(STORE.templates,[]);
        const saveTemplates = rows => saveJSON(STORE.templates,Array.isArray(rows)?rows:[]);

        function draftId(){return `d-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;}
        function templateId(){return `t-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;}

        function addDraft(values,source='manual'){
            const rows=loadDrafts();
            rows.unshift({id:draftId(),savedAt:Date.now(),source,...values});
            saveDrafts(rows.slice(0,500));
            toast('تم حفظ النشاط كمسودة محلية.');
            refresh();
        }

        function removeDraft(id){
            saveDrafts(loadDrafts().filter(d=>d.id!==id));
            refresh();
        }

        function saveTemplate(values,name=''){
            const rows=loadTemplates();
            rows.unshift({
                id:templateId(),
                name:clean(name)||clean(values.name)||'قالب جديد',
                savedAt:Date.now(),
                location:values.location||'',
                role:values.role||'',
                type:values.type||'',
                durationType:values.durationType||'',
                duration:values.duration||''
            });
            saveTemplates(rows.slice(0,100));
            toast('تم حفظ القالب.');
            refresh();
        }

        function removeTemplate(id){
            saveTemplates(loadTemplates().filter(t=>t.id!==id));
            refresh();
        }

        function applyTemplateToNew(id){
            const t=loadTemplates().find(x=>x.id===id);
            if(!t)return;
            openDraftEditor('draft-add',{
                __template:true,
                name:'',
                startDate:'',
                endDate:'',
                ...t
            });
        }

        function activityTable(rows){
            return `<div class="${ID}-tablewrap"><table class="${ID}-datatable">
                <thead><tr>
                    <th>#</th><th>اسم النشاط</th><th>الجهة</th><th>البداية</th><th>النهاية</th><th>سنة الاحتساب</th>
                    <th>الدور</th><th>النوع</th><th>المدة</th><th>إجراءات</th>
                </tr></thead>
                <tbody>${rows.map(a=>`<tr>
                    <td><b>${a.globalIndex}</b></td>
                    <td>${esc(a.name||'—')}</td>
                    <td>${esc(a.location||'—')}</td>
                    <td>${esc(a.startDate||'—')}</td>
                    <td>${esc(a.endDate||'—')}</td>
                    <td>${activityGregorianYear(a)?`${activityGregorianYear(a)} م`:'—'}</td>
                    <td>${esc(a.role||'—')}</td>
                    <td>${esc(a.type||'—')}</td>
                    <td>${esc(a.duration||'—')} ${esc(a.durationType||'')}</td>
                    <td><div class="${ID}-rowacts">
                        <button data-act="goto" data-i="${a.globalIndex}">فتح</button>
                        ${a.canEdit?`<button data-act="edit" data-i="${a.globalIndex}">تعديل</button>`:`<span class="${ID}-locked" title="فارس لا يتيح تعديل هذا السجل">🔒</span>`}
                        ${a.canDelete?`<button class="danger" data-act="delete" data-i="${a.globalIndex}">حذف</button>`:''}
                    </div></td>
                </tr>`).join('')}</tbody>
            </table></div>`;
        }

        function activitiesCards(rows){
            return `<div class="${ID}-list">${rows.length?rows.map(a=>`<article class="${ID}-card">
                <div class="${ID}-num">${a.globalIndex}</div>
                <div><h3>${esc(a.name||'نشاط بدون اسم')}</h3><p>
                    <span>🏢 ${esc(a.location||'—')}</span>
                    <span>📅 ${esc(a.startDate||'—')} ← ${esc(a.endDate||'—')}</span>
                    <span>📆 سنة الاحتساب: ${activityGregorianYear(a)?`${activityGregorianYear(a)} م`:'—'}</span>
                    <span>👤 ${esc(a.role||'—')}</span>
                    <span>🏷 ${esc(a.type||'—')}</span>
                    <span>⏱ ${esc(a.duration||'—')} ${esc(a.durationType||'')}</span>
                </p><small>${esc(a.pageRange)}</small></div>
                <div class="${ID}-actions">
                    <button data-act="goto" data-i="${a.globalIndex}">انتقال</button>
                    ${a.canEdit?`<button data-act="edit" data-i="${a.globalIndex}">تعديل</button>`:''}
                    ${a.canDelete?`<button class="danger" data-act="delete" data-i="${a.globalIndex}">حذف</button>`:''}
                </div>
            </article>`).join(''):`<div class="${ID}-empty">لا توجد نتائج.</div>`}</div>`;
        }

        function qualityAdvanced(){
            const out={critical:[],review:[],info:[]};
            const base=pd.analysis||analyze(pd.activities);

            for(const v of base.missing)out.critical.push({type:'بيانات ناقصة',a:v.activity,detail:v.fields.join('، ')});
            for(const a of base.invalidDates)out.critical.push({type:'تاريخ غير منطقي',a,detail:'تاريخ النهاية يسبق البداية'});
            for(const group of base.exactDuplicates)out.critical.push({type:'تكرار مطابق',a:group[0],group,detail:`${group.length} سجلات متطابقة`});
            for(const a of base.yearConversionMissing||[]){
                out.review.push({
                    type:'تعذر تحديد سنة الاحتساب',
                    a,
                    detail:`راجع تاريخ البداية: ${a.startDate||'—'}`
                });
            }
            for(const v of base.crossGregorianYears||[]){
                out.info.push({
                    type:'نشاط يعبر سنتين ميلاديتين',
                    a:v.activity,
                    detail:`${v.startYear} → ${v.endYear} — الاحتساب الحالي حسب سنة البداية`
                });
            }

            for(const a of pd.activities){
                const n=durNum(a),s=dateKey(a.startDate),e=dateKey(a.endDate);
                if(/ساع/.test(a.durationType)&&n>100)
                    out.review.push({type:'مدة مرتفعة',a,detail:`${n} ساعة`});
                if(/يوم|أيام|ايام/.test(a.durationType)&&n>90)
                    out.review.push({type:'مدة مرتفعة',a,detail:`${n} يومًا`});
                if(s&&e&&s.key===e.key&&/ساع/.test(a.durationType)&&n>24)
                    out.review.push({type:'مدة مقابل التاريخ',a,detail:`${n} ساعة في يوم واحد`});
            }

            for(const [a,b] of base.overlaps){
                const bothBeneficiary=/مستفيد/.test(a.role)&&/مستفيد/.test(b.role);
                const sameDates=norm(a.startDate)===norm(b.startDate)&&norm(a.endDate)===norm(b.endDate);
                (bothBeneficiary&&sameDates?out.review:out.info).push({
                    type:bothBeneficiary?'تداخل حضور محتمل':'تداخل زمني',
                    a,b,detail:`#${a.globalIndex} مع #${b.globalIndex}`
                });
            }
            return out;
        }

        function analyticsExtended(){
            const a=pd.analysis||analyze(pd.activities);
            const nums=pd.activities.map(durNum).filter(n=>n>0);
            const avg=nums.length?Math.round((nums.reduce((x,y)=>x+y,0)/nums.length)*10)/10:0;
            const yearlyHours={};
            for(const r of pd.activities){
                const y=activityGregorianYear(r);
                if(y&&/ساع/.test(r.durationType))yearlyHours[y]=(yearlyHours[y]||0)+durNum(r);
            }
            return {avg,yearlyHours,a};
        }

        function draftsHtml(){
            const rows=loadDrafts();
            return `<div class="${ID}-grid">
                <section class="${ID}-panel full">
                    <div class="${ID}-panelhead"><div><h3>صندوق المسودات</h3>
                    <p>المسودات محلية ولا تُنشئ أي سجل في فارس حتى تضغط الاعتماد.</p></div>
                    <div class="${ID}-reportbtns"><button data-act="add">+ مسودة جديدة</button>
                    ${rows.length?`<button class="primary" data-act="commit-drafts">اعتماد الكل (${rows.length}) إلى فارس</button>`:''}</div></div>
                </section>
                <section class="${ID}-panel full">
                    ${rows.length?`<div class="${ID}-draftlist">${rows.map((d,i)=>`<article>
                        <div><b>${esc(d.name||'بدون اسم')}</b><span>${esc(d.location||'—')} · ${esc(d.startDate||'—')} ← ${esc(d.endDate||'—')} · ${esc(d.duration||'—')} ${esc(d.durationType||'')}</span></div>
                        <div>
                            <button class="primary" data-act="commit-one-draft" data-id="${d.id}">اعتماد هذه المسودة</button>
                            <button data-act="edit-draft" data-id="${d.id}">تعديل</button>
                            <button class="danger" data-act="delete-draft" data-id="${d.id}">حذف</button>
                        </div>
                    </article>`).join('')}</div>`:`<div class="${ID}-empty">لا توجد مسودات حتى الآن.</div>`}
                </section>
            </div>`;
        }

        function templatesHtml(){
            const rows=loadTemplates();
            return `<div class="${ID}-grid"><section class="${ID}-panel full"><h3>قوالب الإدخال السريع</h3>
                <p>القالب يحفظ الجهة والدور والنوع ونوع المدة والمدة فقط، ثم تبدأ نشاطًا جديدًا منها.</p>
                ${rows.length?`<div class="${ID}-draftlist">${rows.map(t=>`<article>
                    <div><b>${esc(t.name)}</b><span>${esc(t.location||'—')} · ${esc(t.role||'—')} · ${esc(t.type||'—')} · ${esc(t.duration||'—')} ${esc(t.durationType||'')}</span></div>
                    <div><button class="primary" data-act="use-template" data-id="${t.id}">استخدام</button><button class="danger" data-act="delete-template" data-id="${t.id}">حذف</button></div>
                </article>`).join('')}</div>`:`<div class="${ID}-empty">أنشئ قالبًا من نافذة إضافة نشاط.</div>`}
            </section></div>`;
        }

        function normalizeHeader(v=''){
            return norm(v).replace(/[^ء-يa-z0-9]/g,'');
        }

        function mapImportedObject(obj){
            const entries=Object.entries(obj).map(([k,v])=>({raw:k,key:normalizeHeader(k),value:v}));
            const pick=(aliases,{contains=true}={})=>{
                const keys=aliases.map(normalizeHeader);
                let found=entries.find(e=>keys.includes(e.key));
                if(!found&&contains){
                    found=entries.find(e=>keys.some(k=>e.key.includes(k)));
                }
                return clean(found?.value||'');
            };
            return {
                name:pick(['اسم النشاط','النشاط','الدورة','name']),
                location:pick(['الجهة','جهة','location']),
                startDate:pick(['تاريخ البداية','البداية','start']),
                endDate:pick(['تاريخ النهاية','النهاية','end']),
                role:pick(['منفذ أم مستفيد','الدور','role']),
                type:pick(['نوع النشاط','النوع','type']),
                durationType:pick(['نوع المدة','وحدة المدة','duration type']),
                duration:pick(['مدة النشاط','المدة','duration'],{contains:false})
            };
        }

        function parseDelimited(textValue,delimiter=','){
            const rows=[];let row=[],cell='',quoted=false;
            const s=String(textValue||'').replace(/^\uFEFF/,'');
            for(let i=0;i<s.length;i++){
                const ch=s[i],next=s[i+1];
                if(ch==='"'){
                    if(quoted&&next==='"'){cell+='"';i++;}
                    else quoted=!quoted;
                }else if(ch===delimiter&&!quoted){row.push(cell);cell='';}
                else if((ch==='\n'||ch==='\r')&&!quoted){
                    if(ch==='\r'&&next==='\n')i++;
                    row.push(cell);cell='';
                    if(row.some(v=>clean(v)))rows.push(row);
                    row=[];
                }else cell+=ch;
            }
            row.push(cell);if(row.some(v=>clean(v)))rows.push(row);
            if(rows.length<2)return [];
            const headers=rows[0].map(clean);
            return rows.slice(1).map(r=>mapImportedObject(Object.fromEntries(headers.map((h,i)=>[h,r[i]??'']))));
        }

        async function unzipEntry(arrayBuffer,entry){
            const bytes=new Uint8Array(arrayBuffer);
            const dv=new DataView(arrayBuffer);
            const off=entry.localOffset;
            const nameLen=dv.getUint16(off+26,true),extraLen=dv.getUint16(off+28,true);
            const dataStart=off+30+nameLen+extraLen;
            const data=bytes.slice(dataStart,dataStart+entry.compSize);
            if(entry.method===0)return data;
            if(entry.method===8){
                const ds=new DecompressionStream('deflate-raw');
                return new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(ds)).arrayBuffer());
            }
            throw new Error(`طريقة ضغط XLSX غير مدعومة: ${entry.method}`);
        }

        function zipEntries(arrayBuffer){
            const dv=new DataView(arrayBuffer),bytes=new Uint8Array(arrayBuffer);
            let eocd=-1;
            for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--){
                if(dv.getUint32(i,true)===0x06054b50){eocd=i;break;}
            }
            if(eocd<0)throw new Error('ملف XLSX غير صالح.');
            const total=dv.getUint16(eocd+10,true),cdOffset=dv.getUint32(eocd+16,true);
            let p=cdOffset;const out=[];
            const dec=new TextDecoder('utf-8');
            for(let n=0;n<total;n++){
                if(dv.getUint32(p,true)!==0x02014b50)break;
                const method=dv.getUint16(p+10,true),compSize=dv.getUint32(p+20,true);
                const nameLen=dv.getUint16(p+28,true),extraLen=dv.getUint16(p+30,true),commentLen=dv.getUint16(p+32,true);
                const localOffset=dv.getUint32(p+42,true);
                const name=dec.decode(bytes.slice(p+46,p+46+nameLen));
                out.push({name,method,compSize,localOffset});
                p+=46+nameLen+extraLen+commentLen;
            }
            return out;
        }

        async function parseXlsx(file){
            if(typeof DecompressionStream==='undefined')throw new Error('المتصفح لا يدعم قراءة XLSX محليًا؛ احفظ الملف CSV.');
            const buf=await file.arrayBuffer(),entries=zipEntries(buf);
            const find=name=>entries.find(e=>e.name===name);
            const decoder=new TextDecoder('utf-8');
            const read=async name=>{
                const e=find(name);if(!e)throw new Error(`جزء XLSX مفقود: ${name}`);
                return decoder.decode(await unzipEntry(buf,e));
            };
            let shared=[];
            const sh=find('xl/sharedStrings.xml');
            if(sh){
                const doc=new DOMParser().parseFromString(await read('xl/sharedStrings.xml'),'application/xml');
                shared=[...doc.querySelectorAll('si')].map(si=>[...si.querySelectorAll('t')].map(t=>t.textContent||'').join(''));
            }
            const sheet=find('xl/worksheets/sheet1.xml')||entries.find(e=>/^xl\/worksheets\/sheet\d+\.xml$/.test(e.name));
            if(!sheet)throw new Error('لم أجد ورقة عمل داخل XLSX.');
            const doc=new DOMParser().parseFromString(decoder.decode(await unzipEntry(buf,sheet)),'application/xml');
            const matrix=[...doc.querySelectorAll('sheetData > row')].map(row=>{
                const vals=[];
                [...row.querySelectorAll('c')].forEach(c=>{
                    const ref=c.getAttribute('r')||'A1';
                    let col=0;
                    for(const ch of ref.match(/[A-Z]+/)?.[0]||'A')col=col*26+(ch.charCodeAt(0)-64);
                    col--;
                    const t=c.getAttribute('t');
                    const v=c.querySelector('v')?.textContent||'';
                    if(t==='s'){
                        vals[col]=shared[+v]??'';
                    }else if(t==='inlineStr'){
                        vals[col]=[...c.querySelectorAll('t')].map(n=>n.textContent||'').join('');
                    }else{
                        vals[col]=v;
                    }
                });
                return vals;
            });
            if(matrix.length<2)return [];
            const headers=matrix[0].map(clean);
            return matrix.slice(1).filter(r=>r.some(v=>clean(v))).map(r=>mapImportedObject(Object.fromEntries(headers.map((h,i)=>[h,r[i]??'']))));
        }

        function validateImportRows(rows){
            const errors=[];
            rows.forEach((r,i)=>{
                const miss=['name','location','startDate','endDate','role','type','durationType','duration'].filter(k=>!clean(r[k]));
                if(miss.length)errors.push({row:i+2,message:`حقول ناقصة: ${miss.join(', ')}`});
                const s=dateKey(r.startDate),e=dateKey(r.endDate);
                if(s&&e&&e.key<s.key)errors.push({row:i+2,message:'تاريخ النهاية يسبق البداية'});
            });
            return errors;
        }

        function downloadImportTemplate(){
            try{
                const binary=
                    atob(
                        IMPORT_TEMPLATE.base64
                    );

                const bytes=
                    new Uint8Array(
                        binary.length
                    );

                for(
                    let i=0;
                    i<binary.length;
                    i++
                ){
                    bytes[i]=
                        binary.charCodeAt(i);
                }

                download(
                    new Blob(
                        [bytes],
                        {
                            type:
                                IMPORT_TEMPLATE.mime
                        }
                    ),
                    IMPORT_TEMPLATE.fileName
                );

                toast(
                    'تم تجهيز قالب Excel الجاهز للاستيراد.',
                    'success'
                );
            }catch(err){
                console.error(
                    '[فارس+] import template',
                    err
                );

                toast(
                    'تعذر إنشاء قالب Excel.',
                    'error'
                );
            }
        }

        async function handleImportFile(file){
            try{
                let rows=[];
                const name=file.name.toLowerCase();
                if(name.endsWith('.xlsx'))rows=await parseXlsx(file);
                else{
                    const raw=await file.text();
                    rows=parseDelimited(raw,raw.includes('\t')?'\t':',');
                }
                pd.importRows=rows;
                pd.importErrors=validateImportRows(rows);
                pd.importFileName=file.name;
                refresh();
                toast(`تمت قراءة ${rows.length} صفًا من الملف.`);
            }catch(err){
                console.error('[فارس+] import',err);
                toast(`تعذر قراءة الملف: ${err.message||err}`,'error');
            }
        }

        function importHtml(){
            const rows=pd.importRows,errors=pd.importErrors;
            const existing=new Set(pd.activities.map(a=>[norm(a.name),norm(a.location),norm(a.startDate),norm(a.endDate)].join('|')));
            const duplicates=rows.filter(r=>existing.has([norm(r.name),norm(r.location),norm(r.startDate),norm(r.endDate)].join('|'))).length;
            return `<div class="${ID}-grid">
                <section class="${ID}-panel full">
                    <div class="${ID}-panelhead">
                        <div>
                            <h3>استيراد دفعي من Excel / CSV</h3>
                            <p>
                                حمّل القالب الجاهز، عبّئ الأنشطة،
                                ثم أعد رفع الملف هنا.
                            </p>
                        </div>

                        <div class="${ID}-reportbtns">
                            <button
                                type="button"
                                class="primary"
                                data-act="download-import-template"
                            >
                                ⬇ تحميل قالب Excel الجاهز
                            </button>
                        </div>
                    </div>

                    <div class="${ID}-import-flow">
                        <div><span>1</span><b>تحميل القالب</b></div>
                        <i>←</i>
                        <div><span>2</span><b>تعبئة الأنشطة</b></div>
                        <i>←</i>
                        <div><span>3</span><b>رفع الملف</b></div>
                        <i>←</i>
                        <div><span>4</span><b>مراجعة المسودات</b></div>
                    </div>

                    <div class="${ID}-drop" id="${ID}-drop">
                        <b>اسحب ملف XLSX أو CSV هنا</b><span>أو</span>
                        <label class="${ID}-filebtn">اختيار ملف<input id="${ID}-import-file" type="file" accept=".xlsx,.csv,.tsv,text/csv" hidden></label>
                    </div>
                    ${pd.importFileName?`<p>الملف: <b>${esc(pd.importFileName)}</b> — ${rows.length} صف — ${errors.length} خطأ — ${duplicates} مطابق لما هو موجود.</p>`:''}
                </section>
                ${rows.length?`<section class="${ID}-panel full"><div class="${ID}-panelhead"><h3>المعاينة قبل الإدخال</h3>
                    <button class="primary" data-act="import-to-drafts" ${errors.length?'disabled':''}>إضافة ${rows.length} إلى المسودات</button></div>
                    ${errors.length?`<div class="${ID}-issues">${errors.slice(0,20).map(e=>`<div class="err"><b>صف ${e.row}</b><span>${esc(e.message)}</span></div>`).join('')}</div>`:''}
                    ${activityTable(rows.slice(0,50).map((r,i)=>({...r,globalIndex:i+1,canEdit:false,canDelete:false})))}
                    ${rows.length>50?`<p>تم عرض أول 50 صفًا فقط.</p>`:''}
                </section>`:''}
            </div>`;
        }

        // =========================================================
        // Certificate Smart Import — v1.1.0
        // PDF text first, OCR fallback for scans/images.
        // The certificate file itself is never uploaded to Fares or stored.
        // OCR language/runtime assets are loaded by Tesseract.js in-browser.
        // =========================================================
        const CERT_MAX_FILES=20;
        const CERT_MAX_BYTES=20*1024*1024;
        const CERT_MAX_PDF_PAGES=5;
        let certificateOcrWorker=null;

        const CERT_MONTHS=Object.freeze({
            'يناير':1,'فبراير':2,'مارس':3,'ابريل':4,'أبريل':4,
            'مايو':5,'يونيو':6,'يوليو':7,'اغسطس':8,'أغسطس':8,
            'سبتمبر':9,'اكتوبر':10,'أكتوبر':10,'نوفمبر':11,'ديسمبر':12,
            'january':1,'february':2,'march':3,'april':4,'may':5,'june':6,
            'july':7,'august':8,'september':9,'october':10,'november':11,'december':12
        });

        const CERT_HIJRI_MONTHS=Object.freeze({
            'محرم':1,'صفر':2,
            'ربيع الاول':3,'ربيع الأول':3,'ربيع اول':3,
            'ربيع الآخر':4,'ربيع الاخر':4,'ربيع الثاني':4,
            'جمادى الاولى':5,'جمادى الأولى':5,'جمادى الاولي':5,
            'جمادى الآخرة':6,'جمادى الاخرة':6,'جمادى الثانية':6,
            'رجب':7,'شعبان':8,'رمضان':9,'شوال':10,
            'ذو القعدة':11,'ذي القعدة':11,'ذوالقعدة':11,
            'ذو الحجة':12,'ذي الحجة':12,'ذوالحجة':12
        });

        const CERT_AR_NUMBER_WORDS=Object.freeze({
            'صفر':0,'واحد':1,'واحدة':1,'احد':1,'أحد':1,
            'اثنان':2,'اثنين':2,'اثنتان':2,'اثنتين':2,'اثنا':2,'اثني':2,
            'ثلاث':3,'ثلاثة':3,'اربع':4,'أربع':4,'اربعة':4,'أربعة':4,
            'خمس':5,'خمسة':5,'ست':6,'ستة':6,'سبع':7,'سبعة':7,
            'ثمان':8,'ثماني':8,'ثمانية':8,'تسع':9,'تسعة':9,
            'عشر':10,'عشرة':10,'احدى عشر':11,'إحدى عشر':11,'احد عشر':11,'أحد عشر':11,
            'اثنا عشر':12,'اثني عشر':12,'اثنتا عشرة':12,'اثنتي عشرة':12,
            'ثلاثة عشر':13,'ثلاث عشر':13,'اربعة عشر':14,'أربعة عشر':14,'اربع عشر':14,'أربع عشر':14,
            'خمسة عشر':15,'خمس عشر':15,'ستة عشر':16,'ست عشر':16,
            'سبعة عشر':17,'سبع عشر':17,'ثمانية عشر':18,'ثماني عشر':18,
            'تسعة عشر':19,'تسع عشر':19,'عشرون':20,'ثلاثون':30,'اربعون':40,'أربعون':40,
            'خمسون':50,'ستون':60,'سبعون':70,'ثمانون':80,'تسعون':90,'مئة':100,'مائة':100
        });

        const CERT_KNOWN_ORGS=Object.freeze([
            'المركز التربوي للتطوير والتنمية المهنية',
            'المركز الوطني لتنمية القطاع غير الربحي',
            'أكاديمية الصحة العامة',
            'المعهد الوطني للتطوير المهني التعليمي',
            'الأكاديمية السعودية الرقمية',
            'Saudi Digital Academy',
            'جامعة الملك سعود',
            'شركة مايكروسوفت العربية',
            'Microsoft Arabia',
            'وزارة التعليم',
            'Coursera'
        ]);

        // ---------------------------------------------------------
        // Optional Gemini document understanding
        // ---------------------------------------------------------
        const GEMINI_MODEL='gemini-3.6-flash';
        const GEMINI_API='Interactions API v1/v1beta';
        const GEMINI_ENDPOINTS=[
            'https://generativelanguage.googleapis.com/v1/interactions',
            'https://generativelanguage.googleapis.com/v1beta/interactions'
        ];
        const GEMINI_MAX_BYTES=15*1024*1024;
        const GEMINI_KEY_STORE=`${META.id}-gemini-api-key-v1`;
        const GEMINI_CONSENT_STORE=`${META.id}-gemini-consent-v1`;

        function gmRead(key,fallback=''){
            try{
                return typeof GM_getValue==='function' ? GM_getValue(key,fallback) : fallback;
            }catch(_){
                return fallback;
            }
        }

        function gmWrite(key,value){
            try{
                if(typeof GM_setValue==='function') GM_setValue(key,value);
                return true;
            }catch(_){
                return false;
            }
        }

        function gmRemove(key){
            try{
                if(typeof GM_deleteValue==='function') GM_deleteValue(key);
                return true;
            }catch(_){
                return false;
            }
        }

        function geminiKey(){
            return clean(String(gmRead(GEMINI_KEY_STORE,'')||''));
        }

        function hasGeminiKey(){
            return geminiKey().length>=20;
        }

        function saveGeminiKeyFromUi(){
            const input=byId(`${ID}-gemini-key`);
            const key=clean(input?.value||'');
            if(key.length<20) return toast('أدخل مفتاح Gemini API صالحًا أولًا.','error');
            if(!gmWrite(GEMINI_KEY_STORE,key)) return toast('تعذر حفظ المفتاح في تخزين Tampermonkey.','error');
            if(input) input.value='';
            refresh();
            toast('تم حفظ مفتاح Gemini داخل تخزين Tampermonkey الخاص بفارس+.');
        }

        function deleteGeminiKey(){
            gmRemove(GEMINI_KEY_STORE);
            gmRemove(GEMINI_CONSENT_STORE);
            refresh();
            toast('تم حذف مفتاح Gemini وموافقة الإرسال من فارس+.');
        }

        function ensureGeminiConsent(){
            if(gmRead(GEMINI_CONSENT_STORE,false)===true) return true;
            const ok=confirm(
                'تحليل Gemini اختياري.\n\n' +
                'عند المتابعة سيتم إرسال ملف الشهادة كاملًا إلى خدمة Gemini التابعة لـ Google لتحليله، ' +
                'وقد يحتوي الملف على بيانات شخصية مثل الاسم أو رقم الهوية أو رمز QR.\n\n' +
                'وفق معلومات الفئة المجانية من Gemini API قد تُستخدم البيانات لتحسين منتجات Google.\n\n' +
                'لن يرسل فارس+ الشهادة إلى فارس، ولن يحفظ الملف بعد انتهاء الجلسة.\n\n' +
                'هل توافق على إرسال هذه الشهادة إلى Gemini؟'
            );
            if(ok) gmWrite(GEMINI_CONSENT_STORE,true);
            return ok;
        }

        function certificateId(){
            return `c-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
        }

        function normalizeCertificateText(value=''){
            return latinDigits(String(value||''))
                .replace(/\u00a0/g,' ')
                .replace(/[ـ]+/g,'')
                .replace(/[\u200e\u200f\u202a-\u202e]/g,' ')
                .replace(/[ \t]+/g,' ')
                .replace(/\r/g,'\n')
                .replace(/\n{3,}/g,'\n\n')
                .trim();
        }

        function certificateLines(text=''){
            return normalizeCertificateText(text)
                .split(/\n+/)
                .map(clean)
                .filter(Boolean);
        }

        function certificateTextQuality(text=''){
            const t=normalizeCertificateText(text);
            if(!t) return {score:0,gibberish:true,readableWords:0,strangeRatio:1};

            const chars=[...t].filter(ch=>!/[\s\d.,،:;؛!?()\[\]{}\-_/\\+%#@'"“”«»]/.test(ch));
            const readable=chars.filter(ch=>/[A-Za-z\u0600-\u06FF]/.test(ch)).length;
            const strange=Math.max(0,chars.length-readable);
            const strangeRatio=chars.length?strange/chars.length:0;
            const words=t.match(/[A-Za-z]{3,}|[\u0600-\u06FF]{3,}/g)||[];
            const semantic=(t.match(/شهادة|برنامج|دورة|تدريب|حضور|اكمال|إتمام|اجتياز|certificate|training|course|completion|academy|university|وزارة|جامعة|معهد|مركز/gi)||[]).length;

            let score=Math.min(55,words.length*2.2)+Math.min(30,semantic*6)+Math.max(0,15-Math.round(strangeRatio*40));
            if(strangeRatio>0.28) score-=35;
            if(words.length<3) score-=25;
            score=Math.max(0,Math.min(100,Math.round(score)));

            return {
                score,
                gibberish:strangeRatio>0.34 || (words.length<3 && semantic===0),
                readableWords:words.length,
                strangeRatio
            };
        }

        function nativeOptionTexts(key){
            const el=templateControl(key);
            if(!el || el.tagName!=='SELECT') return [];
            return [...el.options]
                .map(o=>clean(o.textContent||o.value||''))
                .filter(Boolean);
        }

        function matchNativeOption(key,wanted='',regexes=[]){
            const options=nativeOptionTexts(key);
            if(!options.length) return '';
            const w=norm(wanted);

            if(w){
                const exact=options.find(v=>norm(v)===w);
                if(exact) return exact;

                let best='',score=0;
                for(const option of options){
                    const s=fuzzyScore(wanted,option);
                    if(s>score){score=s;best=option;}
                }
                if(score>=0.72) return best;
            }

            for(const rx of regexes){
                const found=options.find(v=>rx.test(normalizeArabic(v)));
                if(found) return found;
            }
            return '';
        }

        function certificateEvidenceSnippet(value='',max=110){
            const v=clean(value).replace(/\s+/g,' ');
            return v.length>max?`${v.slice(0,max-1)}…`:v;
        }

        function parseArabicNumberPhrase(value=''){
            let v=normalizeArabic(latinDigits(value))
                .replace(/\b(?:ساعة|ساعات|ساعه|يوم|ايام|أيام|تدريبية|تدريبيه)\b/g,' ')
                .replace(/\s+/g,' ')
                .trim();
            if(!v) return null;
            const numeric=v.match(/\d{1,4}/);
            if(numeric) return Number(numeric[0]);
            if(/ساعتان|ساعتين/.test(v)) return 2;
            if(/يومان|يومين/.test(v)) return 2;

            const exact=CERT_AR_NUMBER_WORDS[v];
            if(Number.isFinite(exact)) return exact;

            const parts=v.split(/\s+و\s+|\s+/).filter(Boolean);
            let sum=0,matched=0;
            for(let i=0;i<parts.length;i++){
                const two=i+1<parts.length?`${parts[i]} ${parts[i+1]}`:'';
                if(two && Number.isFinite(CERT_AR_NUMBER_WORDS[two])){
                    sum+=CERT_AR_NUMBER_WORDS[two];matched++;i++;continue;
                }
                const n=CERT_AR_NUMBER_WORDS[parts[i]];
                if(Number.isFinite(n)){sum+=n;matched++;}
            }
            return matched?sum:null;
        }

        function extractCertificateDurationInfo(text=''){
            const t=normalizeCertificateText(text);
            const out={hours:null,days:null,hoursSource:'',daysSource:'',confidence:0};

            const hourPatterns=[
                /(?:بواقع|بإجمالي|باجمالي|إجمالي|اجمالي|عدد|لمدة)?\s*\(?\s*(\d{1,4})\s*\)?\s*(?:ساعة(?:\s*\/\s*ساعات)?|ساعات|ساعه)(?:\s+(?:تدريبية|تطوير\s+مهني))?/i,
                /(?:hours?|training\s+hours?)\s*[:：]?\s*(\d{1,4})/i,
                /(\d{1,4})\s*(?:training\s*)?hours?/i
            ];
            for(const rx of hourPatterns){
                const m=t.match(rx);
                if(m){out.hours=Number(m[1]);out.hoursSource=m[0];break;}
            }
            if(!Number.isFinite(out.hours)){
                const special=t.match(/(?:بواقع|لمدة|اجمالي|إجمالي)?\s*(ساعتان|ساعتين)/i);
                if(special){out.hours=2;out.hoursSource=special[0];}
            }
            if(!Number.isFinite(out.hours)){
                const words=[...t.matchAll(/([اأإآء-ي\s]{2,40})\s+(?:ساعة|ساعات)/g)];
                for(const m of words){
                    const phrase=clean(m[1]).split(/\s+/).slice(-4).join(' ');
                    const n=parseArabicNumberPhrase(phrase);
                    if(Number.isFinite(n)&&n>0&&n<=1000){out.hours=n;out.hoursSource=m[0];break;}
                }
            }

            const dayPatterns=[
                /(?:لمدة|المدة\s*[:：]?|خلال)?\s*\(?\s*(\d{1,3})\s*\)?\s*(?:يوم(?:\s*\/\s*(?:أيام|ايام))?|أيام|ايام)/i,
                /(\d{1,3})\s*days?\b/i
            ];
            for(const rx of dayPatterns){
                const m=t.match(rx);
                if(m){out.days=Number(m[1]);out.daysSource=m[0];break;}
            }
            if(!Number.isFinite(out.days)){
                const special=t.match(/(?:لمدة|المدة\s*[:：]?)?\s*(يومان|يومين|يوم\s+واحد|يومًا\s+واحدًا|يوما\s+واحدا)/i);
                if(special){out.days=/يومان|يومين/.test(special[0])?2:1;out.daysSource=special[0];}
            }
            if(!Number.isFinite(out.days)){
                const words=[...t.matchAll(/([اأإآء-ي\s]{2,35})\s+(?:يوم|أيام|ايام)/g)];
                for(const m of words){
                    const phrase=clean(m[1]).split(/\s+/).slice(-4).join(' ');
                    const n=parseArabicNumberPhrase(phrase);
                    if(Number.isFinite(n)&&n>0&&n<=365){out.days=n;out.daysSource=m[0];break;}
                }
            }

            if(Number.isFinite(out.hours)) out.confidence+=0.72;
            if(Number.isFinite(out.days)) out.confidence+=0.22;
            out.confidence=Math.min(1,out.confidence);
            out.preferredUnit=Number.isFinite(out.hours)?'hours':(Number.isFinite(out.days)?'days':'');
            out.preferredValue=out.preferredUnit==='hours'?out.hours:(out.preferredUnit==='days'?out.days:null);
            return out;
        }

        function makeGregorianDate(y,m,d){
            const date=new Date(Date.UTC(Number(y),Number(m)-1,Number(d),12,0,0,0));
            if(!Number.isFinite(date.getTime())) return null;
            if(date.getUTCFullYear()!==Number(y)||date.getUTCMonth()+1!==Number(m)||date.getUTCDate()!==Number(d)) return null;
            return date;
        }

        function certificateNamedMonth(value=''){
            const key=clean(value).toLowerCase();
            if(CERT_MONTHS[key]) return {calendar:'gregorian',month:CERT_MONTHS[key]};
            const ar=normalizeArabic(key);
            for(const [name,month] of Object.entries(CERT_HIJRI_MONTHS)){
                if(normalizeArabic(name)===ar) return {calendar:'hijri',month};
            }
            return null;
        }

        function parseCertificateDateToken(raw=''){
            const value=normalizeCertificateText(raw).replace(/[،,]/g,' ').replace(/\s+/g,' ').trim();
            if(!value) return null;
            let d,m,y,calendar='';

            let hit=value.match(/\b(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})\b/);
            if(hit){y=Number(hit[1]);m=Number(hit[2]);d=Number(hit[3]);}
            if(!hit){
                hit=value.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\b/);
                if(hit){d=Number(hit[1]);m=Number(hit[2]);y=Number(hit[3]);}
            }

            if(!hit){
                const names=[...Object.keys(CERT_MONTHS),...Object.keys(CERT_HIJRI_MONTHS)]
                    .sort((a,b)=>b.length-a.length)
                    .map(v=>v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))
                    .join('|');
                const rx1=new RegExp(`(\\d{1,2})\\s+(${names})\\s+(\\d{4})`,'i');
                const rx2=new RegExp(`(${names})\\s+(\\d{1,2})\\s+(\\d{4})`,'i');
                const m1=value.match(rx1),m2=!m1?value.match(rx2):null;
                if(m1||m2){
                    const monthFirst=!!m2;
                    const mm=certificateNamedMonth(monthFirst?m2[1]:m1[2]);
                    if(!mm) return null;
                    d=Number(monthFirst?m2[2]:m1[1]);
                    m=mm.month;y=Number(monthFirst?m2[3]:m1[3]);calendar=mm.calendar;
                    hit=m1||m2;
                }
            }

            if(!hit || d<1 || d>31 || m<1 || m>12) return null;
            if(!calendar) calendar=(y>=1300&&y<1700)?'hijri':((y>=1700&&y<=2200)?'gregorian':'');
            if(!calendar) return null;

            if(calendar==='gregorian'){
                const gregorian=makeGregorianDate(y,m,d);
                if(!gregorian) return null;
                return {calendar,gregorian,hijri:gregorianDateToHijri(gregorian),raw:clean(raw)};
            }

            const hijri={day:d,month:m,year:y};
            return {calendar,hijri,gregorian:hijriToGregorian(hijri),raw:clean(raw)};
        }

        function certificateDateMentions(text=''){
            const t=normalizeCertificateText(text);
            const found=[];
            const used=[];
            const add=(m,raw)=>{
                const start=m.index??0,end=start+raw.length;
                if(used.some(r=>Math.max(r[0],start)<Math.min(r[1],end))) return;
                const parsed=parseCertificateDateToken(raw);
                if(!parsed) return;
                found.push({...parsed,index:start,end,source:clean(raw)});
                used.push([start,end]);
            };

            for(const m of t.matchAll(/(?:\b\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2}\b|\b\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4}\b)/g)) add(m,m[0]);

            const names=[...Object.keys(CERT_MONTHS),...Object.keys(CERT_HIJRI_MONTHS)]
                .sort((a,b)=>b.length-a.length)
                .map(v=>v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))
                .join('|');
            const namedRx=new RegExp(`(?:\\d{1,2}\\s*[,،-]?\\s*(?:${names})\\s*[,،-]?\\s*\\d{4}|(?:${names})\\s*[,،-]?\\s*\\d{1,2}\\s*[,،-]?\\s*\\d{4})`,'gi');
            for(const m of t.matchAll(namedRx)) add(m,m[0]);

            return found.sort((a,b)=>a.index-b.index);
        }

        function certificateDateSameDay(a,b){
            const aa=a?.gregorian?isoFromGregorianDate(a.gregorian):'';
            const bb=b?.gregorian?isoFromGregorianDate(b.gregorian):'';
            if(!aa||!bb) return false;
            const da=new Date(`${aa}T12:00:00Z`),db=new Date(`${bb}T12:00:00Z`);
            return Math.abs(da-db)<=86400000;
        }

        function extractCertificateDates(text=''){
            const t=normalizeCertificateText(text);
            const mentions=certificateDateMentions(t);
            const empty={start:null,end:null,issue:null,kind:'',confidence:0,startSource:'',endSource:'',explicitDual:false};
            if(!mentions.length) return empty;

            const isIssue=m=>{
                const before=normalizeArabic(t.slice(Math.max(0,m.index-45),m.index)).toLowerCase();
                const after=normalizeArabic(t.slice(m.end,Math.min(t.length,m.end+12))).toLowerCase();
                return /تاريخ\s*(?:اصدار|الشهاده)|اصدار\s*الشهاده|issuance\s*date|issue\s*date|issued\s*(?:on|date)?\s*[:\s]*$/.test(before) || /^\s*(?:issuance|issued)/.test(after);
            };

            const issue=mentions.find(isIssue)||null;

            // Explicit period/range: من ... إلى ... / from ... to ... / خلال الفترة ...
            for(let i=0;i<mentions.length-1;i++){
                const a=mentions[i],b=mentions[i+1];
                if(b.index-a.end>120) continue;
                const between=normalizeArabic(t.slice(a.end,b.index)).toLowerCase();
                const before=normalizeArabic(t.slice(Math.max(0,a.index-90),a.index)).toLowerCase();
                const after=normalizeArabic(t.slice(b.end,Math.min(t.length,b.end+65))).toLowerCase();
                const connector=/الي|الى|حتى|\bto\b/.test(between);
                const rangeContext=/الفتره|خلال|\bfrom\b|\bperiod\b|\bduring\b|من(?:\s+تاريخ)?/.test(`${before} ${after}`);
                if(!connector || !rangeContext) continue;
                if(isIssue(a)&&isIssue(b)) continue;

                let start=a,end=b;
                if(a.gregorian&&b.gregorian&&a.gregorian>b.gregorian){start=b;end=a;}
                return {
                    start,end,issue,kind:'range',confidence:0.98,
                    startSource:start.source,endSource:end.source,explicitDual:false
                };
            }

            // Hijri + Gregorian pair for the same event, e.g. "19 رجب 1441 الموافق 14 مارس 2020".
            for(let i=0;i<mentions.length-1;i++){
                const a=mentions[i],b=mentions[i+1];
                if(a.calendar===b.calendar || b.index-a.end>100) continue;
                const between=normalizeArabic(t.slice(a.end,b.index)).toLowerCase();
                if(!/الموافق|يوافق|correspond|هـ|ه\b|م\b/.test(between) && !certificateDateSameDay(a,b)) continue;
                if(!certificateDateSameDay(a,b)) continue;
                const h=a.calendar==='hijri'?a:b;
                const g=a.calendar==='gregorian'?a:b;
                const merged={calendar:'dual',hijri:h.hijri,gregorian:g.gregorian,source:`${h.source} / ${g.source}`};
                return {
                    start:merged,end:merged,issue,kind:'single-dual',confidence:1,
                    startSource:merged.source,endSource:merged.source,explicitDual:true
                };
            }

            const activityCandidates=mentions.filter(m=>!isIssue(m));
            const pool=activityCandidates.length?activityCandidates:mentions;
            let best=pool[0],bestScore=-999;
            for(const m of pool){
                const before=normalizeArabic(t.slice(Math.max(0,m.index-75),m.index)).toLowerCase();
                const after=normalizeArabic(t.slice(m.end,Math.min(t.length,m.end+55))).toLowerCase();
                let score=0;
                if(/بتاريخ|من\s+تاريخ|تاريخ\s*$|الموافق|\bon\b|\bdated\b|completion/.test(`${before} ${after}`)) score+=4;
                if(/الدورة|البرنامج|التدريب|activity|course|training/.test(`${before} ${after}`)) score+=2;
                if(isIssue(m)) score-=7;
                if(score>bestScore){bestScore=score;best=m;}
            }

            const onlyIssue=!activityCandidates.length && !!issue;
            return {
                start:best,end:best,issue,kind:onlyIssue?'certificate-date':'single',
                confidence:onlyIssue?0.58:0.82,
                startSource:best.source,endSource:best.source,explicitDual:false
            };
        }

        function certificateNameScore(value=''){
            const v=clean(value).replace(/^[()（）\[\]«»]+|[()（）\[\]«»]+$/g,'').trim();
            if(v.length<4 || v.length>210) return -100;
            const n=normalizeArabic(v).toLowerCase();
            let score=0;
            if(/[اأإآء-ي]/.test(v)) score+=3;
            if(/[A-Za-z]{3,}/.test(v)) score+=3;
            if(v.split(/\s+/).length>=2) score+=2;
            if(/التطوير|المهني|القيم|الهوية|تعزيز|اخلاق|أخلاق|مسؤول|تعليم|تدريب|ادارة|إدارة|اختبار|حوسبة|تقويم|ذكاء|artificial|intelligence|educator|learning|cloud|performance/i.test(n)) score+=3;
            if(/شهادة|حضور|اتمام|إتمام|هوية وطنية|معرف الشهادة|عدد ساعات|بتاريخ|يسر|المكرم|certificate|completion|www\.|https?:|tcpdf|powered by|email|البريد|اسم المدرب|مدير|الرئيس/.test(n)) score-=10;
            if(/المعهد|وزارة|جامعه|جامعة|اكاديميه|أكاديمية|بمركز|مركز التطوير المهني|اداره تعليم|إدارة تعليم|كليه|كلية|company|academy|university|ministry/.test(n)) score-=9;
            if(/وكانت هذه ضمن مبادره|وكانت هذه ضمن مبادرة|ضمن مبادره وزارة|ضمن مبادرة وزارة/.test(n)) score-=8;
            if(/^(?:عن بعد|اونلاين|أونلاين|online|مباشر|حضوري|تدريب|دورة|برنامج|10|1|0:?1)$/i.test(n)) score-=18;
            if(/^\d+(?:\s*[:\/.\-]\s*\d+)*$/.test(n)) score-=18;
            if(/\d{6,}/.test(v)) score-=7;
            return score;
        }

        function extractCertificateActivityNameInfo(text=''){
            const t=normalizeCertificateText(text);
            const candidates=[];
            const add=(value,source,confidence=0.75)=>{
                const v=clean(value).replace(/^[()（）\[\]«»]+|[()（）\[\]«»]+$/g,'').trim();
                if(!v) return;
                candidates.push({value:v,source:certificateEvidenceSnippet(source||v),confidence,score:certificateNameScore(v)+(confidence*12)});
            };

            const patterns=[
                {rx:/(?:بعنوان|عنوان\s+البرنامج|اسم\s+البرنامج|اسم\s+الدورة|اسم\s+النشاط)\s*[:：\-/]?\s*([^\n]{4,190})/i,c:0.94},
                {rx:/(?:الدورة\s+التدريبية\s+بعنوان|لإتمامه?\s+الدورة\s+التدريبية\s+بعنوان)\s*[:：-]?\s*\n?\s*([^\n]{4,190})/i,c:0.97},
                {rx:/(?:الدورة\s+التأهيلية\s+لرخصة)\s*[:：-]?\s*\n?\s*([^\n]{4,190})/i,c:0.97},
                {rx:/(?:قد\s+حضر(?:ت|\/ت)?\s+(?:عن\s+بعد\s+)?برنامج(?:ا|اً)?\s+تدريبيا?\s+بعنوان)\s*[:：-]?\s*\n?\s*([^\n]{4,190})/i,c:0.98},
                {rx:/(?:قد\s+حضر\s+برنامج)\s*[:：-]?\s*([^\n]{4,190})/i,c:0.95},
                {rx:/(?:لبرنامج|برنامج)\s*[\/:：-]\s*\n?\s*([^\n]{4,190})/i,c:0.93},
                {rx:/(?:learning\s+pathway|pathway\s+learning)[^\n]{0,60}?\b(?:Artificial\s+Intelligence[^\n]{0,100}|[^\n]{4,180})/i,c:0.82}
            ];
            for(const p of patterns){
                const m=t.match(p.rx);
                if(m){
                    const value=m[1]||m[0].replace(/^(?:learning\s+pathway|pathway\s+learning)\s*/i,'');
                    add(value,m[0],p.c);
                }
            }

            // Text between modality statement and the executing-organization phrase.
            const between=t.match(/(?:البرنامج\s+الإلكتروني\s+غير\s+المتزامن|البرنامج\s+الالكتروني\s+غير\s+المتزامن)[\s\S]{0,80}?\n\s*([^\n]{4,180})\s*\n[\s\S]{0,50}?(?:والذي\s+نفذته|نفذته)/i);
            if(between) add(between[1],between[0],0.95);

            for(const m of t.matchAll(/[\(（«]\s*([^\)）»\n]{4,180})\s*[\)）》]/g)) add(m[1],m[0],0.72);

            const lines=certificateLines(t);
            const mieeLine=lines.find(v=>/Microsoft\s+Innovative\s+Educator\s+Expert/i.test(v));
            if(mieeLine){
                let value=mieeLine.replace(/^.*?(?:ضمن\s+فعاليات\s+مبادرة|مبادرة)\s*/i,'').trim();
                value=value.replace(/^\(([^)]+)\)\s*/,'$1 — ');
                add(value||mieeLine,mieeLine,0.98);
            }
            const aiLine=lines.find(v=>/Artificial\s+Intelligence\s*\(AI\)\s*-?\s*Level\s*1/i.test(v));
            if(aiLine) add(aiLine,aiLine,0.98);
            const markerRx=/(?:البرنامج\s+التدريبي|الدورة\s+التدريبية\s+بعنوان|لرخصة|لبرنامج\/|قد\s+حضر\s+برنامج|learning\s+pathway)/i;
            for(let i=0;i<lines.length;i++){
                if(markerRx.test(lines[i]) && lines[i+1]) add(lines[i+1],`${lines[i]} ${lines[i+1]}`,0.83);
            }

            // General semantic fallback. This helps unfamiliar layouts without trusting file names.
            for(const line of lines){
                const s=certificateNameScore(line);
                if(s>=5) add(line,line,0.58);
            }

            const best=candidates.sort((a,b)=>b.score-a.score)[0];
            return best?{value:best.value,source:best.source,confidence:Math.min(0.99,best.confidence)}:{value:'',source:'',confidence:0};
        }

        function extractCertificateOrganizationInfo(text=''){
            const t=normalizeCertificateText(text);
            const lines=certificateLines(t);
            const candidates=[];
            const add=(value,source,confidence=0.78,priority=0)=>{
                const v=clean(value).replace(/^يسر\s+/,'').replace(/\s+(?:بأن|بان)$/,'').trim();
                if(v.length<3||v.length>180) return;
                if(/اسم\s+المدرب|مدير|رئيس|المشرف|المكرم|المتدرب|الاستاذ|الأستاذ|CEO/i.test(v)) return;
                candidates.push({value:v,source:certificateEvidenceSnippet(source||v),confidence,priority,score:confidence*20+priority});
            };

            const semantic=[
                {rx:/والذي\s+نفذته\s+([^\n]{3,150}?)(?:\s+بتاريخ|\n|$)/i,c:0.98,p:8},
                {rx:/يشهد\s+([^\n]{3,160}?)\s+(?:بأن|بان)/i,c:0.96,p:7},
                {rx:/يسر\s+([^\n]{3,160}?)\s+(?:أن|ان)\s+(?:يمنح|تمنح)/i,c:0.96,p:7},
                {rx:/(?:من\s+قبل|provided\s+by|offered\s+by)\s+([^\n]{3,150})/i,c:0.9,p:6},
                {rx:/تشكر\s+([^\n]{3,150})/i,c:0.96,p:8}
            ];
            for(const p of semantic){const m=t.match(p.rx);if(m)add(m[1],m[0],p.c,p.p);}

            // Prefer known provider-level entities over broad/accrediting entities.
            for(let i=0;i<CERT_KNOWN_ORGS.length;i++){
                const k=CERT_KNOWN_ORGS[i];
                if(norm(t).includes(norm(k))) add(k,k,0.9,Math.max(0,10-i*0.4));
            }

            const orgLine=/وزارة|جامعة|كلية|اكاديمية|أكاديمية|معهد|مركز|هيئة|شركة|academy|university|institute|ministry|coursera|microsoft/i;
            for(const line of lines){
                if(!orgLine.test(line)) continue;
                if(certificateNameScore(line)>=7 && !/وزارة|جامعة|اكاديمية|أكاديمية|معهد|مركز|هيئة|شركة|academy|university|institute|ministry/i.test(line)) continue;
                add(line,line,0.62,1);
            }

            const dedup=[];
            for(const c of candidates.sort((a,b)=>b.score-a.score)){
                if(!dedup.some(d=>fuzzyScore(c.value,d.value)>=0.94)) dedup.push(c);
            }
            const best=dedup[0];
            return {
                value:best?.value||'',source:best?.source||'',confidence:best?.confidence||0,
                candidates:dedup.map(v=>v.value)
            };
        }

        function extractCertificateReference(text=''){
            const t=normalizeCertificateText(text);
            const patterns=[
                /معرف\s+الشهادة\s*[:：]?\s*([a-f0-9-]{12,80})/i,
                /(?:Certificate\s*ID|ID\s*Certificate)\s*[:：]?\s*([A-Z0-9-]{6,80})/i,
                /رمز\s+الشهادة\s*[:：]?\s*([A-Z0-9-]{5,80})/i
            ];
            for(const rx of patterns){const m=t.match(rx);if(m)return clean(m[1]);}
            return '';
        }

        function certificateRoleInfo(text=''){
            const t=normalizeArabic(normalizeCertificateText(text)).toLowerCase();
            const beneficiary=[
                /شهادة\s+حضور/,/شهادة\s+اتمام|شهادة\s+إتمام/,/اجتاز|اجتياز/,/أتم|اتم|إتمام|اتمام/,
                /قد\s+حضر|حضر\/ت|حضر\s+الدورة|حضر\s+برنامج|لحضور\s+الدورات|(?:ان|أن)\s+يمنح/,/completed|completion|passing\s+after|acknowledges/
            ];
            for(const rx of beneficiary){
                const m=t.match(rx);
                if(m) return {value:matchNativeOption('role','مستفيد',[/مستفيد/]),source:m[0],confidence:0.94};
            }

            // Only infer "منفذ" from explicit statements tying the certificate holder to delivery.
            const trainer=t.match(/(?:قام\s+بتقديم|قدم\s+المتدرب|نفذ\s+المتدرب|بصفته\s+مدرب|trainer|instructor)\s+[^\n]{0,80}/i);
            if(trainer) return {value:matchNativeOption('role','منفذ',[/منفذ/]),source:trainer[0],confidence:0.9};
            return {value:'',source:'',confidence:0};
        }

        function certificateTypeInfo(text=''){
            const t=normalizeArabic(normalizeCertificateText(text)).toLowerCase();
            const electronic=t.match(/التدريب\s+الالكتروني|برنامج\s+الكتروني|البرنامج\s+الالكتروني|غير\s*المتزامن|غير\s*متزامن|عن\s*بعد|اونلاين|أونلاين|online|e-?learning|virtual/i);
            if(electronic){
                return {value:matchNativeOption('type','التدريب - التدريب الإلكتروني',[/الكترون|إلكترون|عن بعد/,/تدريب/]),source:electronic[0],confidence:0.94};
            }

            const direct=t.match(/تدريب\s+مباشر|حضوري|وجاهي|في\s+مقر|بمركز\s+التطوير\s+المهني|خلال\s+الفترة\s*[:：]?\s*(?:صباحي|مسائي)/i);
            if(direct){
                return {value:matchNativeOption('type','التدريب - التدريب المباشر',[/مباشر|حضوري/,/تدريب/]),source:direct[0],confidence:0.82};
            }

            // Generic "training/course" is not enough to decide direct vs electronic.
            return {value:'',source:'',confidence:0};
        }

        function certificateDuplicate(activity){
            if(!clean(activity?.name)) return null;
            let best=null;
            for(const a of pd.activities){
                const ns=fuzzyScore(activity.name,a.name||'');
                const nameExact=norm(activity.name)===norm(a.name||'');
                const sameDate=!!activity.startDate && norm(activity.startDate)===norm(a.startDate);
                const sameDur=!!activity.duration && !!a.duration && String(durNum(activity))===String(durNum(a));
                const sameLoc=!!activity.location && !!a.location && fuzzyScore(activity.location,a.location||'')>=0.8;
                let score=ns*0.62 + (sameDate?0.22:0) + (sameDur?0.1:0) + (sameLoc?0.06:0);
                const exact=nameExact && sameDate && (!activity.duration || !a.duration || sameDur);
                if(exact) score=Math.max(score,0.98);
                if(!best || score>best.score) best={activity:a,score,exact,nameScore:ns,sameDate,sameDur};
            }
            if(best && (best.exact || best.score>=0.8 || (best.nameScore>=0.96&&(best.sameDate||best.sameDur)))) return best;
            if(best && best.nameScore>=0.985) return {...best,exact:false};
            return null;
        }

        function certificateRequiredMissing(activity){
            const labels={
                name:'اسم النشاط',location:'الجهة',startDate:'تاريخ البداية',endDate:'تاريخ النهاية',
                role:'الدور',type:'نوع النشاط',durationType:'نوع المدة',duration:'المدة'
            };
            return Object.keys(labels).filter(k=>!clean(activity?.[k])).map(k=>labels[k]);
        }

        function certificateFieldConfidenceLabel(value){
            const n=Number(value)||0;
            if(n>=0.88) return 'ثقة عالية';
            if(n>=0.65) return 'ثقة متوسطة';
            if(n>0) return 'يحتاج مراجعة';
            return '';
        }

        function parseCertificateText(rawText,fileName=''){
            const text=normalizeCertificateText(rawText);
            const quality=certificateTextQuality(text);
            const nameInfo=extractCertificateActivityNameInfo(text);
            const orgInfo=extractCertificateOrganizationInfo(text);
            const dateInfo=extractCertificateDates(text);
            const durationInfo=extractCertificateDurationInfo(text);
            const roleInfo=certificateRoleInfo(text);
            const typeInfo=certificateTypeInfo(text);

            const startDate=dateInfo.start?.hijri?hijriString(dateInfo.start.hijri):'';
            const endDate=dateInfo.end?.hijri?hijriString(dateInfo.end.hijri):startDate;
            const gregorianStart=dateInfo.start?.gregorian?isoFromGregorianDate(dateInfo.start.gregorian):'';
            const gregorianEnd=dateInfo.end?.gregorian?isoFromGregorianDate(dateInfo.end.gregorian):gregorianStart;

            let location='';
            for(const org of [orgInfo.value,...(orgInfo.candidates||[])]){
                if(!org) continue;
                location=matchNativeOption('location',org,[]);
                if(location) break;
            }

            const preferred=durationInfo.preferredValue;
            const unitWanted=durationInfo.preferredUnit==='hours'?'ساعات':(durationInfo.preferredUnit==='days'?'أيام':'');
            const durationType=unitWanted?matchNativeOption('durationType',unitWanted,[durationInfo.preferredUnit==='hours'?/ساع/:/يوم|ايام|أيام/]):'';
            const duration=Number.isFinite(preferred)?matchNativeOption('duration',String(preferred),[new RegExp(`^${preferred}$`)]):'';

            const activity={
                name:nameInfo.value,
                location,
                startDate,
                endDate,
                role:roleInfo.value,
                type:typeInfo.value,
                durationType,
                duration
            };

            const warnings=[];
            const missing=certificateRequiredMissing(activity);
            if(orgInfo.value && !location) warnings.push(`تم التعرف على الجهة «${orgInfo.value}» لكن يلزم اختيار مسماها المطابق في فارس.`);
            if(dateInfo.kind==='range') warnings.push('تم التعرف على فترة النشاط كبداية ونهاية مستقلتين. راجعهما قبل الاعتماد.');
            else if(dateInfo.kind==='single'||dateInfo.kind==='single-dual') warnings.push('الشهادة تحتوي تاريخ نشاط واحدًا؛ تم اقتراحه كبداية ونهاية.');
            else if(dateInfo.kind==='certificate-date') warnings.push('لم تظهر فترة تدريب صريحة؛ تم اقتراح تاريخ الشهادة/الإتمام كتاريخ للنشاط ويحتاج مراجعة.');
            if(dateInfo.start?.calendar==='gregorian' && !dateInfo.explicitDual && startDate) warnings.push(`تم تحويل تاريخ البداية ${gregorianStart} م إلى ${startDate} هـ.`);
            if(dateInfo.end?.calendar==='gregorian' && dateInfo.kind==='range' && !dateInfo.explicitDual && endDate) warnings.push(`تم تحويل تاريخ النهاية ${gregorianEnd} م إلى ${endDate} هـ.`);
            if(Number.isFinite(durationInfo.hours)&&Number.isFinite(durationInfo.days)) warnings.push(`الشهادة تذكر ${durationInfo.days} يوم و${durationInfo.hours} ساعة؛ تم تفضيل الساعات عند تجهيز حقل المدة في فارس.`);
            if(!typeInfo.value && /تدريب|دورة|برنامج|training|course/i.test(text)) warnings.push('لم يحدد فارس+ ما إذا كان التدريب مباشرًا أو إلكترونيًا بثقة كافية؛ اختر نوع النشاط أثناء المراجعة.');
            if(missing.length) warnings.push(`تحتاج مراجعة: ${[...new Set(missing)].join('، ')}.`);

            const duplicate=certificateDuplicate(activity);
            if(duplicate) warnings.push(`يوجد نشاط ${duplicate.exact?'مطابق':'مشابه'} في فارس: «${duplicate.activity.name}».`);

            const fieldConfidence={
                name:nameInfo.confidence,
                organization:orgInfo.confidence,
                location:location?Math.max(0.82,orgInfo.confidence):0,
                startDate:dateInfo.start?dateInfo.confidence:0,
                endDate:dateInfo.end?dateInfo.confidence:0,
                role:roleInfo.confidence,
                type:typeInfo.confidence,
                duration:Number.isFinite(preferred)?durationInfo.confidence:0
            };
            const weighted=[
                ['name',24],['organization',9],['location',7],['startDate',16],['endDate',10],
                ['role',6],['type',9],['duration',13]
            ];
            let confidence=0;
            for(const [key,weight] of weighted) confidence+=Math.min(1,fieldConfidence[key]||0)*weight;
            confidence=Math.round(Math.min(100,confidence));

            const evidence={
                name:{source:nameInfo.source,confidence:nameInfo.confidence},
                organization:{source:orgInfo.source,confidence:orgInfo.confidence},
                startDate:{source:dateInfo.startSource||'',confidence:dateInfo.start?dateInfo.confidence:0},
                endDate:{source:dateInfo.endSource||'',confidence:dateInfo.end?dateInfo.confidence:0},
                role:{source:roleInfo.source,confidence:roleInfo.confidence},
                type:{source:typeInfo.source,confidence:typeInfo.confidence},
                duration:{
                    source:certificateEvidenceSnippet([durationInfo.hoursSource,durationInfo.daysSource].filter(Boolean).join(' / ')),
                    confidence:Number.isFinite(preferred)?durationInfo.confidence:0
                }
            };

            return {
                id:certificateId(),fileName,activity,
                organizationDetected:orgInfo.value,
                organizationCandidates:orgInfo.candidates||[],
                gregorianDate:gregorianStart,
                gregorianStartDate:gregorianStart,
                gregorianEndDate:gregorianEnd,
                certificateIssueDate:dateInfo.issue?.gregorian?isoFromGregorianDate(dateInfo.issue.gregorian):'',
                dateKind:dateInfo.kind,
                documentedHours:Number.isFinite(durationInfo.hours)?durationInfo.hours:null,
                documentedDays:Number.isFinite(durationInfo.days)?durationInfo.days:null,
                certificateReference:extractCertificateReference(text),
                textQuality:quality,
                fieldConfidence,evidence,
                confidence:Math.min(100,confidence),warnings,duplicate,error:'',
                ready:missing.length===0 && !duplicate
            };
        }

        function pdfTextVariants(content){
            const items=(content?.items||[])
                .map((item,index)=>{
                    const value=clean(item?.str||'');
                    const tr=item?.transform||[];
                    return {
                        value,
                        index,
                        x:Number(tr[4])||0,
                        y:Number(tr[5])||0
                    };
                })
                .filter(item=>item.value);

            if(!items.length) return [];

            // PDF.js may return Arabic text fragments in drawing order rather than
            // human reading order. Keep the original stream AND reconstruct visual
            // lines from the item coordinates, so certificate parsers can use either.
            const original=items
                .map(item=>item.value)
                .join('\n');

            const rows=[];
            const tolerance=3.5;

            for(const item of [...items].sort((a,b)=>b.y-a.y || b.x-a.x)){
                let row=rows.find(r=>Math.abs(r.y-item.y)<=tolerance);
                if(!row){
                    row={y:item.y,items:[]};
                    rows.push(row);
                }
                row.items.push(item);
            }

            rows.sort((a,b)=>b.y-a.y);

            const rtlLines=rows
                .map(row=>row.items
                    .sort((a,b)=>b.x-a.x || a.index-b.index)
                    .map(item=>item.value)
                    .join(' ')
                    .replace(/\s+/g,' ')
                    .trim())
                .filter(Boolean)
                .join('\n');

            const ltrLines=rows
                .map(row=>row.items
                    .sort((a,b)=>a.x-b.x || a.index-b.index)
                    .map(item=>item.value)
                    .join(' ')
                    .replace(/\s+/g,' ')
                    .trim())
                .filter(Boolean)
                .join('\n');

            return [...new Set([original,rtlLines,ltrLines].map(normalizeCertificateText).filter(Boolean))];
        }

        function certificateTextLooksUseful(text=''){
            const t=normalizeCertificateText(text);
            const quality=certificateTextQuality(t);
            if(!t || quality.gibberish || quality.score<28) return false;

            const name=extractCertificateActivityNameInfo(t);
            const org=extractCertificateOrganizationInfo(t);
            const dates=extractCertificateDates(t);
            const duration=extractCertificateDurationInfo(t);
            const role=certificateRoleInfo(t);

            let signals=0;
            if(name.value) signals+=2.2;
            if(org.value) signals+=1;
            if(dates.start) signals+=2;
            if(Number.isFinite(duration.hours)||Number.isFinite(duration.days)) signals+=2;
            if(role.value) signals+=1;

            return Boolean(name.value) && signals>=4.2 && quality.score>=35;
        }

        function certificateTextCandidateScore(text=''){
            const t=normalizeCertificateText(text);
            const q=certificateTextQuality(t);
            if(q.gibberish) return -100;
            const parsed={
                name:extractCertificateActivityNameInfo(t),
                org:extractCertificateOrganizationInfo(t),
                dates:extractCertificateDates(t),
                duration:extractCertificateDurationInfo(t),
                role:certificateRoleInfo(t),
                type:certificateTypeInfo(t)
            };
            let score=q.score*0.32;
            if(parsed.name.value) score+=18*parsed.name.confidence;
            if(parsed.org.value) score+=8*parsed.org.confidence;
            if(parsed.dates.start) score+=15*parsed.dates.confidence;
            if(Number.isFinite(parsed.duration.hours)||Number.isFinite(parsed.duration.days)) score+=14*parsed.duration.confidence;
            if(parsed.role.value) score+=5*parsed.role.confidence;
            if(parsed.type.value) score+=5*parsed.type.confidence;
            return score;
        }

        function pdfLib(){
            try{
                if(typeof pdfjsLib!=='undefined') return pdfjsLib;
            }catch(_){/* noop */}
            return globalThis.pdfjsLib || window.pdfjsLib || null;
        }

        async function readPdfCertificate(file){
            const lib=pdfLib();
            if(!lib) throw new Error('مكتبة قراءة PDF غير متاحة. أعد تحميل الصفحة ثم حاول مجددًا.');

            try{
                if(lib.GlobalWorkerOptions){
                    lib.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
                }
            }catch(_){/* noop */}

            const bytes=new Uint8Array(await file.arrayBuffer());
            const doc=await lib.getDocument({data:bytes}).promise;
            const pages=Math.min(doc.numPages,CERT_MAX_PDF_PAGES);
            const textCandidates=[];
            const renderedPages=[];

            for(let pageNo=1;pageNo<=pages;pageNo++){
                pd.certificateProgress=`قراءة PDF: ${file.name} — صفحة ${pageNo} من ${pages}`;
                renderCertificateProgressOnly();

                const page=await doc.getPage(pageNo);
                const content=await page.getTextContent();

                for(const variant of pdfTextVariants(content)){
                    if(variant) textCandidates.push(variant);
                }

                // Keep the PDF page object only; render to canvas later if OCR
                // becomes necessary. This avoids OCR for normal text PDFs.
                renderedPages.push(page);
            }

            // Try every representation created from PDF.js because Arabic PDF
            // certificates can expose spans in different orders.
            const uniqueCandidates=[...new Set(
                textCandidates
                    .map(normalizeCertificateText)
                    .filter(Boolean)
            )];

            const rankedDirect=uniqueCandidates
                .map(value=>({value,score:certificateTextCandidateScore(value)}))
                .sort((a,b)=>b.score-a.score);
            const direct=rankedDirect.find(item=>certificateTextLooksUseful(item.value));
            if(direct){
                return {
                    text:direct.value,
                    method:'pdf-text'
                };
            }

            // Important v0.9.1 fix:
            // A PDF may contain plenty of extractable text yet still be unusable
            // because Arabic fragments are returned in a non-semantic order.
            // Do not trust text length alone; fall back to OCR when the expected
            // certificate fields cannot actually be recognized.
            const canvases=[];

            for(let i=0;i<renderedPages.length;i++){
                pd.certificateProgress=`تجهيز OCR: ${file.name} — صفحة ${i+1} من ${renderedPages.length}`;
                renderCertificateProgressOnly();

                const page=renderedPages[i];
                const viewport=page.getViewport({scale:2.35});
                const canvas=document.createElement('canvas');

                canvas.width=Math.ceil(viewport.width);
                canvas.height=Math.ceil(viewport.height);

                const ctx=canvas.getContext('2d',{willReadFrequently:true});
                await page.render({
                    canvasContext:ctx,
                    viewport
                }).promise;

                canvases.push(canvas);
            }

            const ocr=[];

            for(let i=0;i<canvases.length;i++){
                pd.certificateProgress=`OCR للشهادة: ${file.name} — صفحة ${i+1} من ${canvases.length}`;
                renderCertificateProgressOnly();

                const value=normalizeCertificateText(
                    await ocrCertificateSource(canvases[i])
                );

                if(value) ocr.push(value);
            }

            const ocrText=ocr.join('\n');
            const combined=[
                ocrText,
                ...uniqueCandidates
            ].filter(Boolean).join('\n');

            const bestDirect=rankedDirect[0]?.value||'';
            const choices=[
                {text:ocrText,method:'pdf-ocr'},
                {text:combined,method:'pdf-text+ocr'},
                {text:bestDirect,method:'pdf-text'}
            ].filter(x=>clean(x.text));

            choices.forEach(x=>x.score=certificateTextCandidateScore(x.text));
            choices.sort((a,b)=>b.score-a.score);
            const best=choices[0];

            return best||{text:'',method:'pdf-text'};
        }

        async function ensureCertificateOcrWorker(){
            if(certificateOcrWorker) return certificateOcrWorker;
            const engine=globalThis.Tesseract || window.Tesseract;
            if(!engine?.createWorker) throw new Error('محرك OCR غير متاح. أعد تحميل الصفحة وتأكد من اتصال الإنترنت في أول استخدام.');

            certificateOcrWorker=await engine.createWorker(['ara','eng'],1,{
                workerPath:'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',
                corePath:'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1',
                logger:m=>{
                    if(!pd.certificateBusy) return;
                    const pct=Number.isFinite(m?.progress)?` ${Math.round(m.progress*100)}%`:'';
                    const stage=clean(m?.status||'OCR');
                    pd.certificateProgress=`${stage}${pct}`;
                    renderCertificateProgressOnly();
                }
            });
            return certificateOcrWorker;
        }

        async function ocrCertificateSource(source){
            const worker=await ensureCertificateOcrWorker();
            const result=await worker.recognize(source,{rotateAuto:true});
            return result?.data?.text||'';
        }

        async function terminateCertificateOcrWorker(){
            const worker=certificateOcrWorker;
            certificateOcrWorker=null;
            if(worker){
                try{await worker.terminate();}catch(_){/* noop */}
            }
        }

        async function readCertificateFile(file){
            const lower=file.name.toLowerCase();
            if(lower.endsWith('.pdf') || file.type==='application/pdf') return readPdfCertificate(file);
            if(file.type.startsWith('image/') || /\.(png|jpe?g|webp|bmp)$/i.test(lower)){
                pd.certificateProgress=`تشغيل OCR على ${file.name}...`;
                renderCertificateLive();
                return {text:await ocrCertificateSource(file),method:'image-ocr'};
            }
            throw new Error('الملف غير مدعوم. استخدم PDF أو PNG أو JPG أو WEBP.');
        }

        async function handleCertificateFiles(fileList){
            if(pd.certificateBusy) return toast('انتظر اكتمال قراءة الشهادات الحالية.','error');
            const files=[...(fileList||[])].slice(0,CERT_MAX_FILES);
            if(!files.length) return;

            pd.certificateBusy=true;
            pd.certificateProgress=`تجهيز ${files.length} شهادة...`;
            refresh();

            try{
                for(let i=0;i<files.length;i++){
                    const file=files[i];
                    if(file.size>CERT_MAX_BYTES){
                        pd.certificateResults.push({
                            id:certificateId(),fileName:file.name,activity:{},confidence:0,warnings:[],duplicate:null,
                            error:'حجم الملف يتجاوز 20 MB.',ready:false
                        });
                        continue;
                    }

                    pd.certificateProgress=`قراءة ${i+1} من ${files.length}: ${file.name}`;
                    renderCertificateLive();
                    try{
                        const extracted=await readCertificateFile(file);
                        const parsed=parseCertificateText(extracted.text,file.name);
                        parsed.method=extracted.method;
                        // Kept in memory only so the user can optionally run Gemini.
                        // It is never persisted to localStorage or sent automatically.
                        parsed.sourceFile=file;
                        parsed.sourceMime=file.type||'';
                        if(!clean(extracted.text)){
                            parsed.error='لم يتم العثور على نص قابل للقراءة في الشهادة.';
                            parsed.ready=false;
                        }else if(parsed.confidence===0){
                            parsed.warnings=[
                                ...(parsed.warnings||[]),
                                'تمت قراءة محتوى من الملف، لكن لم يمكن ربطه بحقول الشهادة. جرّب نسخة أوضح من الشهادة أو صورة عالية الدقة.'
                            ];
                        }
                        pd.certificateResults.push(parsed);
                    }catch(err){
                        console.error('[فارس+] certificate import',file.name,err);
                        pd.certificateResults.push({
                            id:certificateId(),fileName:file.name,activity:{},confidence:0,warnings:[],duplicate:null,
                            error:clean(err?.message||String(err)),ready:false,
                            sourceFile:file,sourceMime:file.type||''
                        });
                    }
                    renderCertificateLive();
                }
            }finally{
                await terminateCertificateOcrWorker();
                pd.certificateBusy=false;
                pd.certificateProgress='';
                refresh();
            }

            const ready=pd.certificateResults.filter(r=>r.ready).length;
            toast(`تم تحليل ${files.length} شهادة — ${ready} جاهزة للمسودات.`);
        }

        function geminiMimeForFile(file){
            if(!file) return '';
            const lower=String(file.name||'').toLowerCase();
            if(file.type==='application/pdf'||lower.endsWith('.pdf')) return 'application/pdf';
            if(file.type==='image/png'||lower.endsWith('.png')) return 'image/png';
            if(file.type==='image/jpeg'||/\.(jpe?g)$/i.test(lower)) return 'image/jpeg';
            if(file.type==='image/webp'||lower.endsWith('.webp')) return 'image/webp';
            return '';
        }

        async function fileBase64(file){
            const buffer=await file.arrayBuffer();
            const bytes=new Uint8Array(buffer);
            const chunk=0x8000;
            let binary='';
            for(let i=0;i<bytes.length;i+=chunk){
                binary+=String.fromCharCode(...bytes.subarray(i,Math.min(i+chunk,bytes.length)));
            }
            return btoa(binary);
        }

        function geminiSchema(){
            return {
                type:'OBJECT',
                properties:{
                    activityName:{type:'STRING',description:'Exact professional-development activity/course/program title only.'},
                    provider:{type:'STRING',description:'Organization that actually provided or executed the training; not merely an accreditor or logo.'},
                    startHijri:{type:'STRING',description:'Explicit Hijri activity start date as DD/MM/YYYY, or empty string.'},
                    endHijri:{type:'STRING',description:'Explicit Hijri activity end date as DD/MM/YYYY, or empty string.'},
                    startGregorian:{type:'STRING',description:'Explicit Gregorian activity start date as YYYY-MM-DD, or empty string.'},
                    endGregorian:{type:'STRING',description:'Explicit Gregorian activity end date as YYYY-MM-DD, or empty string.'},
                    certificateIssueDate:{type:'STRING',description:'Certificate/issuance date as YYYY-MM-DD only when distinct from activity dates, else empty.'},
                    role:{type:'STRING',description:'Only مستفيد or منفذ when supported by certificate; otherwise empty.'},
                    activityType:{type:'STRING',description:'Best exact Fares activity type from the provided allowed options, otherwise empty.'},
                    durationType:{type:'STRING',description:'Best exact Fares duration type from the provided allowed options, otherwise empty.'},
                    duration:{type:'NUMBER',description:'Numeric duration to place in Fares; prefer documented hours when both days and hours exist; 0 if absent.'},
                    documentedHours:{type:'NUMBER',description:'Explicit total training hours, or 0.'},
                    documentedDays:{type:'NUMBER',description:'Explicit total training days, or 0.'},
                    deliveryMode:{type:'STRING',description:'One of: حضوري, مباشر, إلكتروني متزامن, إلكتروني غير متزامن, عن بعد, غير محدد.'},
                    confidence:{type:'INTEGER',description:'Overall confidence from 0 to 100.'},
                    nameConfidence:{type:'INTEGER',description:'Activity name confidence 0-100.'},
                    providerConfidence:{type:'INTEGER',description:'Provider confidence 0-100.'},
                    dateConfidence:{type:'INTEGER',description:'Training date/period confidence 0-100.'},
                    roleConfidence:{type:'INTEGER',description:'Role confidence 0-100.'},
                    typeConfidence:{type:'INTEGER',description:'Fares type confidence 0-100.'},
                    durationConfidence:{type:'INTEGER',description:'Duration confidence 0-100.'},
                    evidenceName:{type:'STRING',description:'Short exact phrase from certificate supporting title.'},
                    evidenceProvider:{type:'STRING',description:'Short exact phrase supporting provider.'},
                    evidenceDates:{type:'STRING',description:'Short exact phrase supporting dates.'},
                    evidenceDuration:{type:'STRING',description:'Short exact phrase supporting duration.'},
                    evidenceRole:{type:'STRING',description:'Short exact phrase supporting role.'},
                    evidenceType:{type:'STRING',description:'Short exact phrase supporting delivery/type.'},
                    notes:{type:'ARRAY',items:{type:'STRING'},description:'Short review notes only.'}
                },
                required:[
                    'activityName','provider','startHijri','endHijri','startGregorian','endGregorian',
                    'certificateIssueDate','role','activityType','durationType','duration',
                    'documentedHours','documentedDays','deliveryMode','confidence',
                    'nameConfidence','providerConfidence','dateConfidence','roleConfidence',
                    'typeConfidence','durationConfidence','evidenceName','evidenceProvider',
                    'evidenceDates','evidenceDuration','evidenceRole','evidenceType','notes'
                ]
            };
        }

        function geminiPrompt(){
            const roles=nativeOptionTexts('role').slice(0,30);
            const types=nativeOptionTexts('type').slice(0,80);
            const durationTypes=nativeOptionTexts('durationType').slice(0,30);

            return [
                'أنت محلل شهادات تطوير مهني مخصص لنظام فارس السعودي.',
                'حلل الشهادة بصريًا ونصيًا وأخرج الحقول المطلوبة فقط.',
                '',
                'قواعد إلزامية:',
                '1) لا تستخرج اسم المتدرب أو رقم الهوية أو رقم الجوال أو QR أو البريد ضمن بيانات النشاط.',
                '2) لا تستخدم اسم الملف كمصدر لأي حقل.',
                '3) لا تخمن. إذا لم يظهر الحقل بوضوح فأعد قيمة فارغة أو 0.',
                '4) فرّق بين فترة التدريب وبين تاريخ إصدار/طباعة الشهادة. فترة التدريب لها الأولوية.',
                '5) إذا ظهر التاريخ الهجري والميلادي معًا، انقلهما كما وردا. لا تحوّل بين التقويمين بنفسك.',
                '6) إذا ظهر تاريخ نشاط واحد فقط، استخدمه كبداية ونهاية فقط إذا كان واضحًا أنه تاريخ التدريب/الإتمام، وليس تاريخ إصدار منفصل.',
                '7) إذا ذكرت الشهادة أيامًا وساعات معًا، احتفظ بالاثنين واجعل duration بالساعات.',
                '8) الجهة المطلوبة هي الجهة التي قدمت/نفذت النشاط، لا جهة اعتماد ثانوية ولا مجرد شعار.',
                '9) role=مستفيد عندما الشهادة تثبت حضور/إتمام/اجتياز المتدرب. role=منفذ فقط عند وجود دليل صريح أنه قدم أو نفذ التدريب.',
                '10) اختر activityType وdurationType من خيارات فارس التالية حرفيًا إذا كان المعنى واضحًا؛ وإلا اتركها فارغة.',
                '',
                `خيارات الدور في فارس: ${roles.join(' | ')||'مستفيد | منفذ'}`,
                `خيارات نوع النشاط في فارس: ${types.join(' | ')||'غير متاحة للمحلل'}`,
                `خيارات نوع المدة في فارس: ${durationTypes.join(' | ')||'ساعات | أيام'}`,
                '',
                'أعد JSON فقط وفق المخطط. ضع evidence كسطر قصير من الشهادة يبرر الاختيار.',
                'تعامل مع العربية والإنجليزية والنص المختلط، ومع الأرقام العربية والهندية واللاتينية.'
            ].join('\n');
        }

        function geminiHttpOnce(url,body,key){
            return new Promise((resolve,reject)=>{
                if(typeof GM_xmlhttpRequest!=='function'){
                    reject(new Error('GM_xmlhttpRequest غير متاح. أعد تثبيت/تحديث فارس+ ووافق على صلاحية الاتصال بـ Gemini.'));
                    return;
                }

                GM_xmlhttpRequest({
                    method:'POST',
                    url,
                    headers:{
                        'Content-Type':'application/json',
                        'x-goog-api-key':key
                    },
                    data:JSON.stringify(body),
                    timeout:90000,
                    onload:res=>{
                        let parsed=null;
                        try{parsed=JSON.parse(res.responseText||'{}');}catch(_){/* noop */}

                        const apiMessage=clean(
                            parsed?.error?.message ||
                            parsed?.error?.status ||
                            res.statusText ||
                            `HTTP ${res.status}`
                        );

                        if(res.status>=200&&res.status<300){
                            resolve({ok:true,status:res.status,data:parsed||{},url});
                            return;
                        }

                        resolve({
                            ok:false,
                            status:res.status,
                            data:parsed||{},
                            url,
                            message:apiMessage||`HTTP ${res.status}`
                        });
                    },
                    onerror:()=>reject(new Error('تعذر الاتصال بخدمة Gemini. تحقق من الإنترنت والمفتاح.')),
                    ontimeout:()=>reject(new Error('انتهت مهلة انتظار Gemini. حاول مرة أخرى.'))
                });
            });
        }

        async function geminiHttp(body,key){
            let last=null;

            for(const url of GEMINI_ENDPOINTS){
                const result=await geminiHttpOnce(url,body,key);
                last=result;

                if(result.ok) return result.data;

                // Google currently documents /v1/interactions and /v1beta/interactions.
                // Try the second official endpoint not only for 404, but also when a
                // 400 clearly points to an input-shape/schema mismatch between API
                // revisions. Do not retry authentication/quota/safety failures.
                const shapeMismatch=result.status===400 && /input|supported values|type|schema|invalid argument/i.test(result.message||'');
                if(result.status!==404&&!shapeMismatch) break;
            }

            const apiMessage=clean(last?.message||'فشل اتصال Gemini.');
            const endpointPath=(()=>{
                try{return new URL(last?.url||GEMINI_ENDPOINTS[0]).pathname;}
                catch(_){return "/interactions";}
            })();
            const migrationHint=/model|no longer available|not found|unsupported/i.test(apiMessage)
                ?` [${GEMINI_MODEL} · ${GEMINI_API}]`
                :'';
            const httpHint=last?.status?` (HTTP ${last.status} · ${endpointPath})`:'';

            throw new Error((apiMessage||'فشل اتصال Gemini.')+httpHint+migrationHint);
        }

        function geminiResponseText(response){
            // Gemini Interactions API: read the latest model_output step.
            const steps=Array.isArray(response?.steps)?response.steps:[];
            const modelSteps=steps.filter(step=>step?.type==='model_output');
            const latest=modelSteps.length?modelSteps[modelSteps.length-1]:null;
            const interactionText=(latest?.content||[])
                .map(item=>item?.type==='text'&&typeof item?.text==='string'?item.text:'')
                .join('')
                .trim();
            if(interactionText) return interactionText;

            // Compatibility fallback in case Google returns a legacy-shaped payload.
            return (response?.candidates?.[0]?.content?.parts||[])
                .map(part=>typeof part?.text==='string'?part.text:'')
                .join('')
                .trim();
        }

        function parseGeminiJsonText(value=''){
            const raw=String(value||'').trim()
                .replace(/^```(?:json)?\s*/i,'')
                .replace(/\s*```$/,'');
            if(!raw) throw new Error('لم يرجع Gemini بيانات قابلة للقراءة.');
            try{return JSON.parse(raw);}
            catch(_){
                const start=raw.indexOf('{'),end=raw.lastIndexOf('}');
                if(start>=0&&end>start) return JSON.parse(raw.slice(start,end+1));
                throw new Error('تعذر تفسير استجابة Gemini كـ JSON.');
            }
        }

        function normalizeAiIso(value=''){
            const v=latinDigits(clean(value));
            let m=v.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
            if(m){
                const y=Number(m[1]),mo=Number(m[2]),d=Number(m[3]);
                if(y>=1700&&mo>=1&&mo<=12&&d>=1&&d<=31) return `${y}-${pad2(mo)}-${pad2(d)}`;
            }
            m=v.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
            if(m){
                const d=Number(m[1]),mo=Number(m[2]),y=Number(m[3]);
                if(y>=1700&&mo>=1&&mo<=12&&d>=1&&d<=31) return `${y}-${pad2(mo)}-${pad2(d)}`;
            }
            return '';
        }

        function normalizeAiHijri(value=''){
            const p=parseNumericDate(value);
            if(!p||p.year<1200||p.year>1700) return '';
            return hijriString(p);
        }

        function aiConfidence(raw,fallback=0){
            const n=Number(raw);
            if(!Number.isFinite(n)) return Math.max(0,Math.min(1,Number(fallback)||0));
            return Math.max(0,Math.min(1,n/100));
        }

        function buildGeminiCandidate(row,raw){
            const overall=Math.max(0,Math.min(100,Number(raw?.confidence)||0));
            const name=clean(raw?.activityName||'');
            const provider=clean(raw?.provider||'');

            let hStart=normalizeAiHijri(raw?.startHijri||'');
            let hEnd=normalizeAiHijri(raw?.endHijri||'');
            let gStart=normalizeAiIso(raw?.startGregorian||'');
            let gEnd=normalizeAiIso(raw?.endGregorian||'');

            if(!hStart&&gStart){
                const hp=gregorianIsoToHijri(gStart);
                if(hp) hStart=hijriString(hp);
            }
            if(!hEnd&&gEnd){
                const hp=gregorianIsoToHijri(gEnd);
                if(hp) hEnd=hijriString(hp);
            }
            if(!gStart&&hStart){
                const gd=hijriToGregorian(parseNumericDate(hStart));
                if(gd) gStart=isoFromGregorianDate(gd);
            }
            if(!gEnd&&hEnd){
                const gd=hijriToGregorian(parseNumericDate(hEnd));
                if(gd) gEnd=isoFromGregorianDate(gd);
            }

            if(hStart&&!hEnd) hEnd=hStart;
            if(gStart&&!gEnd) gEnd=gStart;
            if(!hStart&&hEnd) hStart=hEnd;
            if(!gStart&&gEnd) gStart=gEnd;

            let location='';
            if(provider) location=matchNativeOption('location',provider,[]);

            const roleRaw=clean(raw?.role||'');
            const role=roleRaw?matchNativeOption(
                'role',
                roleRaw,
                roleRaw.includes('منفذ')?[/منفذ/]:[/مستفيد/]
            ):'';

            const typeRaw=clean(raw?.activityType||'');
            let type=typeRaw?matchNativeOption('type',typeRaw,[]):'';
            if(!type){
                const mode=normalizeArabic(clean(raw?.deliveryMode||''));
                if(/الكتروني|عن بعد|غير متزامن|متزامن/.test(mode)){
                    type=matchNativeOption('type','التدريب - التدريب الإلكتروني',[/الكترون|إلكترون|عن بعد/,/تدريب/]);
                }else if(/حضوري|مباشر/.test(mode)){
                    type=matchNativeOption('type','التدريب - التدريب المباشر',[/مباشر|حضوري/,/تدريب/]);
                }
            }

            const documentedHours=Number(raw?.documentedHours)||0;
            const documentedDays=Number(raw?.documentedDays)||0;
            const rawDuration=Number(raw?.duration)||0;
            const preferred=rawDuration>0?rawDuration:(documentedHours>0?documentedHours:(documentedDays>0?documentedDays:0));

            let durationTypeRaw=clean(raw?.durationType||'');
            if(!durationTypeRaw){
                if(documentedHours>0) durationTypeRaw='ساعات';
                else if(documentedDays>0) durationTypeRaw='أيام';
            }
            const durationType=durationTypeRaw?matchNativeOption(
                'durationType',
                durationTypeRaw,
                /ساع/.test(durationTypeRaw)?[/ساع/]:[/يوم|ايام|أيام/]
            ):'';
            const duration=preferred>0?matchNativeOption('duration',String(preferred),[new RegExp(`^${preferred}$`)]):'';

            const activity={
                name,
                location,
                startDate:hStart,
                endDate:hEnd,
                role,
                type,
                durationType,
                duration
            };

            const warnings=[...(Array.isArray(raw?.notes)?raw.notes.map(clean).filter(Boolean):[])];
            if(provider&&!location) warnings.push(`Gemini تعرّف على الجهة «${provider}» لكن يلزم اختيار مسماها المطابق في فارس.`);
            const missing=certificateRequiredMissing(activity);
            if(missing.length) warnings.push(`نتيجة Gemini تحتاج مراجعة: ${[...new Set(missing)].join('، ')}.`);

            const duplicate=certificateDuplicate(activity);
            if(duplicate) warnings.push(`نتيجة Gemini تشير إلى نشاط ${duplicate.exact?'مطابق':'مشابه'} موجود في فارس.`);

            const fallback=overall/100;
            const fieldConfidence={
                name:aiConfidence(raw?.nameConfidence,fallback),
                organization:aiConfidence(raw?.providerConfidence,fallback),
                location:location?aiConfidence(raw?.providerConfidence,fallback):0,
                startDate:(hStart||gStart)?aiConfidence(raw?.dateConfidence,fallback):0,
                endDate:(hEnd||gEnd)?aiConfidence(raw?.dateConfidence,fallback):0,
                role:role?aiConfidence(raw?.roleConfidence,fallback):0,
                type:type?aiConfidence(raw?.typeConfidence,fallback):0,
                duration:duration?aiConfidence(raw?.durationConfidence,fallback):0
            };

            const evidence={
                name:{source:clean(raw?.evidenceName||'تحليل Gemini'),confidence:fieldConfidence.name},
                organization:{source:clean(raw?.evidenceProvider||'تحليل Gemini'),confidence:fieldConfidence.organization},
                startDate:{source:clean(raw?.evidenceDates||'تحليل Gemini'),confidence:fieldConfidence.startDate},
                endDate:{source:clean(raw?.evidenceDates||'تحليل Gemini'),confidence:fieldConfidence.endDate},
                role:{source:clean(raw?.evidenceRole||'تحليل Gemini'),confidence:fieldConfidence.role},
                type:{source:clean(raw?.evidenceType||'تحليل Gemini'),confidence:fieldConfidence.type},
                duration:{source:clean(raw?.evidenceDuration||'تحليل Gemini'),confidence:fieldConfidence.duration}
            };

            return {
                activity,
                organizationDetected:provider,
                gregorianDate:gStart,
                gregorianStartDate:gStart,
                gregorianEndDate:gEnd,
                certificateIssueDate:normalizeAiIso(raw?.certificateIssueDate||''),
                documentedHours:documentedHours>0?documentedHours:null,
                documentedDays:documentedDays>0?documentedDays:null,
                fieldConfidence,evidence,
                confidence:overall,
                warnings,
                duplicate,
                ready:missing.length===0&&!duplicate,
                deliveryMode:clean(raw?.deliveryMode||''),
                aiModel:GEMINI_MODEL
            };
        }

        async function analyzeCertificateWithGemini(id){
            const row=certificateResultById(id);
            if(!row) return;
            if(pd.certificateAiBusy.has(id)) return;
            if(!hasGeminiKey()){
                toast('أدخل مفتاح Gemini API المجاني من إعدادات الذكاء الاصطناعي أعلى تبويب الشهادات.','error');
                return;
            }
            if(!row.sourceFile){
                toast('ملف الشهادة الأصلي لم يعد موجودًا في الذاكرة. أعد رفع الشهادة ثم جرّب Gemini.','error');
                return;
            }
            if(row.sourceFile.size>GEMINI_MAX_BYTES){
                toast('حجم هذه الشهادة أكبر من حد التحليل المباشر بالذكاء الاصطناعي (15 MB).','error');
                return;
            }

            const mime=geminiMimeForFile(row.sourceFile);
            if(!mime){
                toast('تحليل Gemini المباشر يدعم PDF وPNG وJPG وWEBP. استخدم OCR المحلي لهذا النوع من الملفات.','error');
                return;
            }
            if(!ensureGeminiConsent()) return;

            pd.certificateAiBusy.add(id);
            row.aiError='';
            renderCertificateLive();

            try{
                const data=await fileBase64(row.sourceFile);
                const mediaType=mime==='application/pdf'?'document':'image';
                // Interactions API v1 treats an input array as a Step array.
                // Wrap multimodal content in one explicit user_input step so text,
                // image/document blocks are unambiguous to the REST schema.
                const body={
                    model:GEMINI_MODEL,
                    store:false,
                    input:[
                        {
                            type:'user_input',
                            content:[
                                {
                                    type:'text',
                                    text:geminiPrompt()
                                },
                                {
                                    type:mediaType,
                                    mime_type:mime,
                                    data
                                }
                            ]
                        }
                    ],
                    response_format:{
                        type:'text',
                        mime_type:'application/json',
                        schema:geminiSchema()
                    }
                };

                const response=await geminiHttp(body,geminiKey());
                const parsed=parseGeminiJsonText(geminiResponseText(response));
                row.aiCandidate=buildGeminiCandidate(row,parsed);
                row.aiError='';
                toast(`اكتمل تحليل Gemini للشهادة: ${row.fileName}`);
            }catch(err){
                console.error('[فارس+] Gemini certificate analysis',err);
                row.aiError=clean(err?.message||String(err));
                toast(`تعذر تحليل Gemini: ${row.aiError}`,'error');
            }finally{
                pd.certificateAiBusy.delete(id);
                renderCertificateLive();
            }
        }

        function applyGeminiCertificateCandidate(id){
            const row=certificateResultById(id);
            const ai=row?.aiCandidate;
            if(!row||!ai) return;

            row.activity={...ai.activity};
            row.organizationDetected=ai.organizationDetected||'';
            row.gregorianDate=ai.gregorianDate||'';
            row.gregorianStartDate=ai.gregorianStartDate||'';
            row.gregorianEndDate=ai.gregorianEndDate||'';
            row.certificateIssueDate=ai.certificateIssueDate||row.certificateIssueDate||'';
            row.documentedHours=ai.documentedHours;
            row.documentedDays=ai.documentedDays;
            row.fieldConfidence=ai.fieldConfidence||{};
            row.evidence=ai.evidence||{};
            row.confidence=ai.confidence||0;
            row.warnings=[
                'تم اعتماد نتيجة Gemini بعد طلب صريح من المستخدم.',
                ...(ai.warnings||[])
            ];
            row.duplicate=ai.duplicate||null;
            row.ready=!!ai.ready;
            row.error='';
            row.aiApplied=true;
            row.aiModel=ai.aiModel||GEMINI_MODEL;
            row.aiCandidate=null;
            refresh();
        }

        function discardGeminiCertificateCandidate(id){
            const row=certificateResultById(id);
            if(!row) return;
            row.aiCandidate=null;
            row.aiError='';
            refresh();
        }

        function certificateMethodLabel(method=''){
            const labels={
                'pdf-text':'PDF مباشر',
                'pdf-ocr':'PDF عبر OCR',
                'pdf-text+ocr':'PDF مباشر + OCR',
                'image-ocr':'صورة عبر OCR'
            };
            return labels[method]||'';
        }

        function certificateStatus(row){
            if(row.error) return {cls:'bad',text:'تعذر الاستخراج'};
            if(row.duplicate) return {cls:'warn',text:'موجود/مشابه في فارس'};
            if(row.ready) return {cls:'good',text:'جاهز للمسودات'};
            return {cls:'warn',text:'يحتاج مراجعة'};
        }

        function certificateFieldHtml(label,value,evidence=null){
            const confidence=Number(evidence?.confidence)||0;
            const cLabel=certificateFieldConfidenceLabel(confidence);
            const cls=confidence>=0.88?'high':(confidence>=0.65?'medium':(confidence>0?'low':''));
            return `<div><span>${esc(label)}</span><b>${esc(value||'تحتاج مراجعة')}</b>${evidence?.source?`<small class="${ID}-cert-evidence ${cls}">${esc(cLabel)} · المصدر: «${esc(certificateEvidenceSnippet(evidence.source,72))}»</small>`:''}</div>`;
        }

        function geminiCandidateHtml(row){
            const ai=row.aiCandidate;
            if(!ai) return '';
            const a=ai.activity||{};
            const durationText=a.duration?`${a.duration} ${a.durationType||''}`:'—';
            return `<div class="${ID}-cert-ai-result">
                <div class="${ID}-cert-ai-title">
                    <div><b>✨ نتيجة Gemini</b><span>${esc(ai.aiModel||GEMINI_MODEL)} · ثقة ${esc(String(ai.confidence||0))}%</span></div>
                    <span class="${ai.ready?'ok':'review'}">${ai.ready?'جاهزة بعد الاعتماد':'تحتاج مراجعة'}</span>
                </div>
                <div class="${ID}-cert-ai-grid">
                    <div><span>اسم النشاط</span><b>${esc(a.name||'—')}</b></div>
                    <div><span>الجهة</span><b>${esc(a.location||ai.organizationDetected||'—')}</b></div>
                    <div><span>الفترة الهجرية</span><b>${esc(a.startDate||'—')} ← ${esc(a.endDate||'—')}</b></div>
                    <div><span>الفترة الميلادية</span><b>${esc(ai.gregorianStartDate||'—')} ← ${esc(ai.gregorianEndDate||'—')}</b></div>
                    <div><span>الدور / النوع</span><b>${esc(a.role||'—')} · ${esc(a.type||'—')}</b></div>
                    <div><span>المدة</span><b>${esc(durationText)}</b></div>
                </div>
                ${ai.warnings?.length?`<div class="${ID}-cert-ai-notes">${ai.warnings.slice(0,4).map(w=>`<span>• ${esc(w)}</span>`).join('')}</div>`:''}
                <div class="${ID}-cert-actions">
                    <button type="button" data-act="certificate-ai-discard" data-id="${esc(row.id)}">تجاهل نتيجة AI</button>
                    <button type="button" class="primary" data-act="certificate-ai-apply" data-id="${esc(row.id)}">✓ استخدام نتيجة Gemini</button>
                </div>
            </div>`;
        }

        function certificateResultHtml(row){
            const a=row.activity||{};
            const st=certificateStatus(row);
            const dup=row.duplicate?.activity;
            const ev=row.evidence||{};
            const hStart=a.startDate||'';
            const hEnd=a.endDate||'';
            const gStart=row.gregorianStartDate||row.gregorianDate||'';
            const gEnd=row.gregorianEndDate||gStart;
            const durationText=a.duration?`${a.duration} ${a.durationType||''}`:'';
            const documented=(Number.isFinite(row.documentedDays)&&Number.isFinite(row.documentedHours))
                ?`موثق أيضًا: ${row.documentedDays} يوم / ${row.documentedHours} ساعة`
                :'';
            const aiBusy=pd.certificateAiBusy.has(row.id);
            const canAi=!!row.sourceFile && row.sourceFile.size<=GEMINI_MAX_BYTES && !!geminiMimeForFile(row.sourceFile);

            return `<article class="${ID}-cert-card ${st.cls}">
                <div class="${ID}-cert-head">
                    <div>
                        <b>${esc(row.fileName||'شهادة')}</b>
                        <span class="${ID}-cert-status ${st.cls}">${esc(st.text)}</span>
                        ${row.aiApplied?`<span class="${ID}-cert-ai-badge">✨ محسّنة بـ Gemini</span>`:''}
                    </div>
                    <button type="button" class="icon" data-act="certificate-remove" data-id="${esc(row.id)}">×</button>
                </div>

                ${row.error?`<div class="${ID}-cert-error">${esc(row.error)}</div>`:`
                ${row.method?`<div class="${ID}-cert-method">طريقة القراءة المحلية: <b>${esc(certificateMethodLabel(row.method))}</b>${row.textQuality?.score?` · جودة النص ${esc(String(row.textQuality.score))}%`:''}</div>`:''}
                <div class="${ID}-cert-fields">
                    ${certificateFieldHtml('اسم النشاط',a.name||'لم يتم التعرف',ev.name)}
                    ${certificateFieldHtml('الجهة',a.location||row.organizationDetected||'تحتاج مراجعة',ev.organization)}
                    ${certificateFieldHtml('بداية النشاط — هجري',hStart||'تحتاج مراجعة',ev.startDate)}
                    ${certificateFieldHtml('نهاية النشاط — هجري',hEnd||'تحتاج مراجعة',ev.endDate)}
                    ${certificateFieldHtml('بداية النشاط — ميلادي',gStart||'—',ev.startDate)}
                    ${certificateFieldHtml('نهاية النشاط — ميلادي',gEnd||'—',ev.endDate)}
                    ${certificateFieldHtml('الدور',a.role||'تحتاج مراجعة',ev.role)}
                    ${certificateFieldHtml('نوع النشاط',a.type||'تحتاج مراجعة',ev.type)}
                    ${certificateFieldHtml('المدة',durationText||'—',ev.duration)}
                    <div><span>دقة الاستخراج المحلية/المعتمدة</span><b>${row.confidence||0}%</b>${documented?`<small class="${ID}-cert-evidence high">${esc(documented)}</small>`:''}</div>
                </div>
                ${row.certificateIssueDate?`<div class="${ID}-cert-ref">تاريخ إصدار/الشهادة المكتشف: <b>${esc(row.certificateIssueDate)}</b> <small>يُحفظ كمرجع ولا يتقدم على فترة النشاط.</small></div>`:''}
                ${row.certificateReference?`<div class="${ID}-cert-ref">معرف الشهادة: <code>${esc(row.certificateReference)}</code> <small>للمرجع فقط — لا يرسل إلى فارس.</small></div>`:''}
                ${dup?`<div class="${ID}-cert-duplicate"><b>⚠️ نشاط ${row.duplicate.exact?'مطابق':'مشابه'} موجود مسبقًا</b><span>${esc(dup.name)} · ${esc(dup.startDate||'')} · ${esc(dup.duration||'')} ${esc(dup.durationType||'')}</span><button type="button" data-act="goto" data-i="${dup.globalIndex}">عرض النشاط الموجود</button></div>`:''}
                ${row.warnings?.length?`<div class="${ID}-cert-warnings">${row.warnings.map(w=>`<span>• ${esc(w)}</span>`).join('')}</div>`:''}
                `}

                ${row.aiError?`<div class="${ID}-cert-ai-error">تعذر Gemini: ${esc(row.aiError)}</div>`:''}
                ${geminiCandidateHtml(row)}

                <div class="${ID}-cert-actions">
                    ${!row.error?`<button type="button" data-act="certificate-review" data-id="${esc(row.id)}">مراجعة البيانات</button>`:''}
                    ${canAi&&!row.aiCandidate?`<button type="button" class="${ID}-ai-btn" data-act="certificate-ai-analyze" data-id="${esc(row.id)}" ${aiBusy?'disabled':''}>${aiBusy?'✨ جاري تحليل Gemini...':'✨ تحليل بالذكاء الاصطناعي'}</button>`:''}
                    ${row.ready&&!row.error?`<button type="button" class="primary" data-act="certificate-one-draft" data-id="${esc(row.id)}">حفظ كمسودة</button>`:''}
                </div>
            </article>`;
        }

        function certificatesHtml(){
            const rows=pd.certificateResults;
            const ready=rows.filter(r=>r.ready).length;
            const duplicates=rows.filter(r=>r.duplicate).length;
            const review=rows.filter(r=>!r.error&&!r.ready).length;
            const keyReady=hasGeminiKey();

            return `<div class="${ID}-grid">
                <section class="${ID}-panel full">
                    <div class="${ID}-panelhead">
                        <div>
                            <h3>📜 الاستيراد الذكي من الشهادات</h3>
                            <p>التحليل المحلي أولًا. وإذا كانت الشهادة صعبة يمكنك تشغيل Gemini اختياريًا ثم مقارنة النتيجة قبل اعتمادها.</p>
                        </div>
                        ${rows.length?`<button type="button" data-act="certificate-clear" ${pd.certificateBusy?'disabled':''}>مسح النتائج</button>`:''}
                    </div>

                    <div class="${ID}-cert-privacy">
                        🔐 القراءة المحلية (PDF/OCR) لا ترسل الشهادة إلى خادم خارجي. <b>Gemini لا يعمل تلقائيًا</b>؛ يتم إرسال الملف إلى Google فقط عندما تضغط بنفسك «تحليل بالذكاء الاصطناعي» وبعد موافقة الخصوصية.
                    </div>

                    <div class="${ID}-cert-ai-settings">
                        <div>
                            <b>✨ Gemini — تحليل متقدم اختياري</b>
                            <small>المحرك الحالي: Gemini 3.6 Flash عبر Interactions API v1/v1beta.</small>
                            <span>النموذج: ${esc(GEMINI_MODEL)} · استخدم مفتاحك الشخصي من Google AI Studio. المفتاح يُحفظ في تخزين Tampermonkey الخاص بالسكربت ولا يُكتب داخل كود فارس+.</span>
                            <small>ملاحظة: الفئة المجانية من Gemini قد تستخدم البيانات لتحسين منتجات Google؛ لذلك لا يتم إرسال أي شهادة دون موافقتك.</small>
                        </div>
                        <div class="${ID}-cert-ai-key">
                            <input id="${ID}-gemini-key" type="password" autocomplete="off" placeholder="${keyReady?'مفتاح Gemini محفوظ — أدخل مفتاحًا جديدًا لاستبداله':'الصق Gemini API Key هنا'}">
                            <button type="button" class="primary" data-act="certificate-ai-save-key">${keyReady?'استبدال المفتاح':'حفظ المفتاح'}</button>
                            ${keyReady?`<button type="button" data-act="certificate-ai-delete-key">حذف المفتاح</button>`:''}
                            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">إنشاء مفتاح من Google AI Studio ↗</a>
                        </div>
                    </div>

                    <div class="${ID}-drop ${pd.certificateBusy?'busy':''}" id="${ID}-cert-drop">
                        <b>${pd.certificateBusy?'جاري تحليل الشهادات...':'اسحب شهادات PDF أو الصور هنا'}</b>
                        <span>${esc(pd.certificateProgress||'يدعم عدة ملفات دفعة واحدة — PDF / PNG / JPG / WEBP')}</span>
                        <label class="${ID}-filebtn">اختيار الشهادات<input id="${ID}-cert-file" type="file" accept="application/pdf,image/png,image/jpeg,image/webp,image/bmp,.pdf,.png,.jpg,.jpeg,.webp,.bmp" multiple hidden ${pd.certificateBusy?'disabled':''}></label>
                    </div>

                    ${rows.length?`<div class="${ID}-metrics ${ID}-cert-metrics">
                        <div><b>${rows.length}</b><span>تم تحليلها</span></div>
                        <div><b>${ready}</b><span>جاهزة</span></div>
                        <div><b>${review}</b><span>تحتاج مراجعة</span></div>
                        <div><b>${duplicates}</b><span>موجودة/مشابهة</span></div>
                    </div>`:''}

                    ${ready?`<div class="${ID}-cert-bulk"><button type="button" class="primary" data-act="certificate-to-drafts">📝 تحويل ${ready} شهادة جاهزة إلى المسودات</button><span>لن يتم إدخال أي شيء إلى فارس في هذه الخطوة.</span></div>`:''}
                </section>

                ${rows.length?`<section class="${ID}-panel full"><div class="${ID}-cert-list">${rows.map(certificateResultHtml).join('')}</div></section>`:''}
            </div>`;
        }

        function renderCertificateProgressOnly(){
            const drop=byId(`${ID}-cert-drop`);
            if(!drop) return;
            const spans=drop.querySelectorAll('span');
            if(spans[0]) spans[0].textContent=pd.certificateProgress||'جاري المعالجة...';
        }

        function renderCertificateLive(){
            if(pd.tab!=='certificates') return;
            const body=byId(`${ID}-body`);
            if(!body) return;
            body.innerHTML=certificatesHtml();
            neutralizeUiButtons(body);
            bindCertificateInputs();
        }

        function bindCertificateInputs(){
            const input=byId(`${ID}-cert-file`);
            if(input&&!input.dataset.bound){
                input.dataset.bound='1';
                input.addEventListener('change',ev=>{
                    const files=ev.target.files;
                    if(files?.length) handleCertificateFiles(files);
                });
            }
            const drop=byId(`${ID}-cert-drop`);
            if(drop&&!drop.dataset.bound){
                drop.dataset.bound='1';
                ['dragenter','dragover'].forEach(type=>drop.addEventListener(type,ev=>{
                    ev.preventDefault();
                    if(!pd.certificateBusy) drop.classList.add('over');
                }));
                ['dragleave','drop'].forEach(type=>drop.addEventListener(type,ev=>{
                    ev.preventDefault();drop.classList.remove('over');
                }));
                drop.addEventListener('drop',ev=>{
                    if(pd.certificateBusy) return;
                    const files=ev.dataTransfer?.files;
                    if(files?.length) handleCertificateFiles(files);
                });
            }
        }

        function certificateResultById(id){
            return pd.certificateResults.find(r=>r.id===id)||null;
        }

        function removeCertificateResult(id){
            pd.certificateResults=pd.certificateResults.filter(r=>r.id!==id);
            refresh();
        }

        function addCertificateResultToDraft(id){
            const row=certificateResultById(id);
            if(!row) return;
            if(!row.ready) return toast('راجع الحقول أو النشاط المشابه قبل حفظ هذه الشهادة كمسودة.','error');
            addDraft(row.activity,'certificate');
            pd.certificateResults=pd.certificateResults.filter(r=>r.id!==id);
            refresh();
        }

        function addReadyCertificatesToDrafts(){
            const ready=pd.certificateResults.filter(r=>r.ready);
            if(!ready.length) return toast('لا توجد شهادات جاهزة للتحويل إلى مسودات.','error');
            const drafts=loadDrafts();
            const added=ready.map(r=>({id:draftId(),savedAt:Date.now(),source:'certificate',...r.activity}));
            saveDrafts([...added,...drafts].slice(0,500));
            const ids=new Set(ready.map(r=>r.id));
            pd.certificateResults=pd.certificateResults.filter(r=>!ids.has(r.id));
            pd.tab='drafts';
            refresh();
            toast(`تم تحويل ${added.length} شهادة إلى مسودات. راجعها قبل اعتمادها إلى فارس.`);
        }

        function reviewCertificateResult(id){
            const row=certificateResultById(id);
            if(!row || row.error) return;
            pd.pendingCertificateId=id;
            openDraftEditor('draft-add',row.activity||{});
            const e=byId(`${ID}-editor`);
            if(!e) return;
            const small=e.querySelector('header small');
            const title=e.querySelector('header h3');
            if(small) small.textContent='مراجعة شهادة — لا إدخال مباشر إلى فارس';
            if(title) title.textContent='مراجعة بيانات النشاط المستخرجة';
            e.querySelector('[data-ed="save"]')?.remove();
            e.querySelector('[data-ed="save-page"]')?.remove();
            e.querySelector('[data-ed="save-template"]')?.remove();
            const draft=e.querySelector('[data-ed="save-draft"]');
            if(draft) draft.textContent='✓ حفظ الشهادة كمسودة';
        }

        function finalReviewHtml(){
            const q=qualityAdvanced(),x=issues(),agree=byId('AgreeCHK');
            return `<div class="${ID}-grid">
                <section class="${ID}-panel full">
                    <h3>المراجعة النهائية قبل الإرسال للموافقة</h3>
                    <div class="${ID}-metrics">
                        <div><b>${pd.activities.length}</b><span>نشاط</span></div>
                        <div><b>${q.critical.length}</b><span>حرج</span></div>
                        <div><b>${q.review.length}</b><span>يحتاج مراجعة</span></div>
                        <div><b>${q.info.length}</b><span>معلوماتي</span></div>
                        <div><b>${loadDrafts().length}</b><span>مسودات لم تُعتمد</span></div>
                        <div><b>${agree?.checked?'✓':'—'}</b><span>إقرار صحة البيانات</span></div>
                    </div>
                    <div class="${ID}-reviewbox ${q.critical.length?'bad':'good'}">
                        <b>${q.critical.length?'لا أنصح بالإرسال قبل معالجة الملاحظات الحرجة.':'لا توجد ملاحظات حرجة ظاهرة.'}</b>
                        <span>هذه الشاشة لا ترسل تلقائيًا؛ الإرسال النهائي يبقى بقرارك ويستدعي زر فارس الأصلي.</span>
                    </div>
                    <div class="${ID}-reportbtns">
                        <button data-act="smart">فتح الفحص الذكي</button>
                        <button data-act="validate">فحص فارس الرسمي</button>
                        <button class="primary" data-act="approve-final" ${(q.critical.length||loadDrafts().length)?'disabled':''}>إرسال للموافقة في فارس</button>
                    </div>
                </section>
            </div>`;
        }

        function activityResultsHtml(rows){
            return `<div class="${ID}-summary">عرض <b>${rows.length}</b> من <b>${pd.activities.length}</b> نشاطًا</div>${rows.length?(pd.view==='table'?activityTable(rows):activitiesCards(rows)):`<div class="${ID}-empty">لا توجد نتائج مطابقة.</div>`}`;
        }
        function activitiesHtml(){
            const rows=filtered();
            return `<div class="${ID}-filters">
                <div class="${ID}-search"><span>🔎</span><input id="${ID}-q" value="${esc(pd.filter.q)}" autocomplete="off" spellcheck="false" placeholder='بحث ذكي… مثال: سنة:2025 هجري:1447 ساعات:>20'></div>
                <select data-filter="role">${opts(unique('role'),pd.filter.role)}</select>
                <select data-filter="type">${opts(unique('type'),pd.filter.type)}</select>
                <select data-filter="durationType">${opts(unique('durationType'),pd.filter.durationType)}</select>
                <select data-filter="year" title="سنة الاحتساب الميلادية">${opts(years().map(String),pd.filter.year,'كل السنوات الميلادية')}</select>
            </div>
            <div class="${ID}-calendar-note">
                📆 تواريخ فارس تبقى هجرية، لكن «السنة» في التصفية والتحليل والتقارير هي <b>سنة الاحتساب الميلادية</b> المستخرجة من تاريخ بداية النشاط. وللبحث بالتاريخ الهجري استخدم <code>هجري:1447</code>.
            </div>
            <div class="${ID}-activitytools"><div class="${ID}-hint">يدعم البحث: جهة:، سنة:2025 (ميلادي)، هجري:1447، دور:، نوع:، ساعات:&gt;20</div><div>
                <select id="${ID}-sort"><option value="newest" ${pd.sort==='newest'?'selected':''}>الأحدث أولًا</option><option value="oldest" ${pd.sort==='oldest'?'selected':''}>الأقدم أولًا</option><option value="name" ${pd.sort==='name'?'selected':''}>الاسم</option><option value="duration" ${pd.sort==='duration'?'selected':''}>المدة</option><option value="location" ${pd.sort==='location'?'selected':''}>الجهة</option></select>
                <button type="button" data-act="view-table" class="${pd.view==='table'?'active':''}">▦ جدول</button>
                <button type="button" data-act="view-cards" class="${pd.view==='cards'?'active':''}">▤ بطاقات</button>
            </div></div>
            <div id="${ID}-activity-results">${activityResultsHtml(rows)}</div>`;
        }
        function renderActivityResults(){
            if(pd.tab!=='activities')return;
            const target=byId(`${ID}-activity-results`);if(!target)return;
            target.innerHTML=activityResultsHtml(filtered());
            neutralizeUiButtons(target);
            const root=byId(`${ID}-manager`);
            root?.querySelector('[data-act="view-table"]')?.classList.toggle('active',pd.view==='table');
            root?.querySelector('[data-act="view-cards"]')?.classList.toggle('active',pd.view==='cards');
        }

        function issueActivityRow(a,label=''){
            return `
                <div class="${ID}-issue-row">
                    <div class="${ID}-issue-no">#${a.globalIndex}</div>
                    <div class="${ID}-issue-main">
                        <b>${esc(a.name||'نشاط بدون اسم')}</b>
                        <span>
                            ${label ? `${esc(label)} · ` : ''}
                            ${esc(a.startDate||'—')} ← ${esc(a.endDate||'—')}
                            · ${esc(a.location||'—')}
                            · ${esc(a.role||'—')}
                        </span>
                    </div>
                    <button type="button" data-act="goto" data-i="${a.globalIndex}">
                        انتقال
                    </button>
                </div>
            `;
        }

        function exactDuplicateDetails(groups){
            return groups.map((group,idx)=>`
                <details class="${ID}-issue-detail" ${idx===0?'open':''}>
                    <summary>
                        مجموعة ${idx+1}: ${esc(group[0]?.name||'نشاط بدون اسم')}
                        <small>${group.length} سجلات متطابقة تقريبًا</small>
                    </summary>
                    <div class="${ID}-issue-help">
                        اعتبرها فارس+ «تكرارًا مطابقًا» لأن اسم النشاط والجهة وتاريخ البداية والنهاية متطابقة.
                        قد يكون الإدخال صحيحًا في حالات استثنائية، لذلك لا يتم الحذف تلقائيًا.
                    </div>
                    ${group.map(a=>issueActivityRow(a)).join('')}
                </details>
            `).join('');
        }

        function nameDuplicateDetails(groups){
            // لا نكرر مجموعة متطابقة تمامًا هنا؛ هذه البطاقة مخصصة للتكرار بالاسم فقط.
            const filtered = groups.filter(group=>{
                const sigs=new Set(group.map(a=>[
                    norm(a.startDate),norm(a.endDate),norm(a.location)
                ].join('|')));
                return sigs.size>1;
            });

            if(!filtered.length) return '';

            return filtered.map((group,idx)=>`
                <details class="${ID}-issue-detail">
                    <summary>
                        ${esc(group[0]?.name||'نشاط بدون اسم')}
                        <small>${group.length} مرات باسم واحد لكن ببيانات مختلفة</small>
                    </summary>
                    <div class="${ID}-issue-help">
                        الاسم متكرر، لكن التاريخ أو الجهة مختلفان؛ لذلك هذا <b>تنبيه للمراجعة فقط</b> وليس خطأ.
                        قد تكون دورات متعددة تحمل الاسم نفسه في تواريخ مختلفة.
                    </div>
                    ${group.map(a=>issueActivityRow(a)).join('')}
                </details>
            `).join('');
        }

        function overlapDetails(pairs){
            return pairs.slice(0,60).map(([a,b],idx)=>{
                const sameRange =
                    norm(a.startDate)===norm(b.startDate) &&
                    norm(a.endDate)===norm(b.endDate);

                const severity = sameRange ? 'تطابق زمني كامل' : 'تداخل زمني جزئي';

                return `
                    <details class="${ID}-issue-detail">
                        <summary>
                            ${idx+1}. ${esc(severity)}
                            <small>#${a.globalIndex} مع #${b.globalIndex}</small>
                        </summary>
                        <div class="${ID}-issue-help">
                            هذا لا يعني وجود خطأ. المقصود فقط أن الفترتين الزمنيتين تتقاطعان.
                            راجعها خصوصًا إذا كنت «مستفيدًا» في النشاطين وكان الحضور متزامنًا فعليًا.
                        </div>
                        ${issueActivityRow(a,'النشاط الأول')}
                        ${issueActivityRow(b,'النشاط الثاني')}
                    </details>
                `;
            }).join('');
        }

        function analysisHtml(){
            const a=pd.analysis||analyze(pd.activities),x=issues();

            const nameOnlyGroups = a.possibleDuplicates.filter(group=>{
                const sigs=new Set(group.map(v=>[
                    norm(v.startDate),norm(v.endDate),norm(v.location)
                ].join('|')));
                return sigs.size>1;
            });

            const quality=qualityAdvanced();

            return `
                <div class="${ID}-grid">
                    <section class="${ID}-panel full">
                        <div class="${ID}-quality-summary">
                            <div class="critical"><b>${quality.critical.length}</b><span>حرج</span></div>
                            <div class="review"><b>${quality.review.length}</b><span>يحتاج مراجعة</span></div>
                            <div class="info"><b>${quality.info.length}</b><span>معلوماتي</span></div>
                        </div>
                        ${quality.review.length?`<details class="${ID}-quality-extra" open><summary>ملاحظات تحتاج مراجعة (${quality.review.length})</summary><div class="${ID}-issue-stack">${quality.review.slice(0,40).map(item=>`<div class="${ID}-quality-row"><div><b>${esc(item.type)}</b><span>${esc(item.detail||'')}</span></div>${item.a?`<button type="button" data-act="goto" data-i="${item.a.globalIndex}">انتقال</button>`:''}</div>`).join('')}</div></details>`:''}
                        ${quality.info.length?`<details class="${ID}-quality-extra"><summary>تنبيهات معلوماتية إضافية (${quality.info.length})</summary><div class="${ID}-issue-stack">${quality.info.slice(0,40).map(item=>`<div class="${ID}-quality-row"><div><b>${esc(item.type)}</b><span>${esc(item.detail||'')}</span></div>${item.a?`<button type="button" data-act="goto" data-i="${item.a.globalIndex}">انتقال</button>`:''}</div>`).join('')}</div></details>`:''}
                    </section>

                    <section class="${ID}-panel full">
                        <h3>ملخص السجلات</h3>
                        <div class="${ID}-metrics">
                            <div><b>${a.total}</b><span>الأنشطة</span></div>
                            <div><b>${a.beneficiary}</b><span>مستفيد</span></div>
                            <div><b>${a.executor}</b><span>منفذ</span></div>
                            <div><b>${a.totalHours}</b><span>الساعات</span></div>
                            <div><b>${a.totalDays}</b><span>الأيام</span></div>
                            <div class="${x.errors?'metric-error':''}">
                                <b>${x.errors}</b>
                                <span>ملاحظات أساسية تحتاج مراجعة</span>
                            </div>
                        </div>

                        <div class="${ID}-check-legend">
                            <span class="critical"><b>ملاحظة أساسية</b> = احتمال خطأ في البيانات ويُفضّل مراجعتها قبل الإرسال.</span>
                            <span class="info"><b>تنبيه معلوماتي</b> = ليس خطأ بالضرورة؛ فارس+ يلفت نظرك فقط.</span>
                        </div>
                    </section>

                    <section class="${ID}-panel">
                        <h3>حسب نوع النشاط</h3>
                        ${bars(top(a.byType),a.total)}
                    </section>

                    <section class="${ID}-panel">
                        <h3>حسب سنة الاحتساب الميلادية</h3>
                        ${bars(top(a.byYear,12),a.total)}
                    </section>

                    <section class="${ID}-panel">
                        <h3>أكثر الجهات</h3>
                        ${bars(top(a.byLocation),a.total)}
                    </section>

                    <section class="${ID}-panel">
                        <h3>حسب الدور</h3>
                        ${bars(top(a.byRole),a.total)}
                    </section>

                    <section class="${ID}-panel">
                        <h3>مؤشرات إضافية</h3>
                        ${(()=>{const ex=analyticsExtended();return `<div class="${ID}-miniStats"><span>متوسط المدة الرقمية <b>${ex.avg}</b></span><span>أكثر سنة نشاطًا (ميلادي) <b>${top(a.byYear,1)[0]?.[0]||'—'}</b></span><span>أكثر جهة <b>${esc(top(a.byLocation,1)[0]?.[0]||'—')}</b></span></div>`})()}
                    </section>

                    <section class="${ID}-panel full">
                        <div class="${ID}-panelhead">
                            <div>
                                <h3>الفحص الذكي</h3>
                                <p class="${ID}-check-sub">
                                    اضغط أي مجموعة أدناه لرؤية الأنشطة المعنية بالتحديد، ثم استخدم «انتقال» للوصول إلى السجل في فارس.
                                </p>
                            </div>
                            <button type="button" data-act="smart">إعادة الفحص</button>
                        </div>

                        <div class="${ID}-issues">
                            ${
                                a.missing.length
                                ? `
                                    <div class="err">
                                        <b>بيانات ناقصة (${a.missing.length})</b>
                                        <span>هذه ملاحظة أساسية لأن أحد الحقول المهمة غير مكتمل.</span>
                                        <div class="${ID}-issue-stack">
                                            ${a.missing.map(v=>`
                                                <details class="${ID}-issue-detail">
                                                    <summary>
                                                        #${v.activity.globalIndex} ${esc(v.activity.name||'بدون اسم')}
                                                        <small>الناقص: ${esc(v.fields.join('، '))}</small>
                                                    </summary>
                                                    ${issueActivityRow(v.activity)}
                                                </details>
                                            `).join('')}
                                        </div>
                                    </div>
                                `
                                : ''
                            }

                            ${
                                a.invalidDates.length
                                ? `
                                    <div class="err">
                                        <b>تاريخ نهاية يسبق البداية (${a.invalidDates.length})</b>
                                        <span>هذه ملاحظة أساسية؛ التاريخ يحتاج مراجعة.</span>
                                        <div class="${ID}-issue-stack">
                                            ${a.invalidDates.map(v=>issueActivityRow(v,'نهاية قبل البداية')).join('')}
                                        </div>
                                    </div>
                                `
                                : ''
                            }

                            ${
                                a.exactDuplicates.length
                                ? `
                                    <div class="err">
                                        <b>تكرار مطابق محتمل (${a.exactDuplicates.length} مجموعات)</b>
                                        <span>
                                            يعني وجود سجلين أو أكثر بالاسم نفسه والجهة نفسها وتاريخ البداية والنهاية نفسها.
                                            افتح المجموعة لمعرفة السجلات المقصودة.
                                        </span>
                                        <div class="${ID}-issue-stack">
                                            ${exactDuplicateDetails(a.exactDuplicates)}
                                        </div>
                                    </div>
                                `
                                : ''
                            }

                            ${
                                nameOnlyGroups.length
                                ? `
                                    <div class="warn">
                                        <b>أسماء أنشطة مكررة (${nameOnlyGroups.length} مجموعات)</b>
                                        <span>
                                            الاسم نفسه موجود أكثر من مرة، لكن توجد فروق في التاريخ أو الجهة.
                                            غالبًا هذا طبيعي، لذلك هو تنبيه فقط.
                                        </span>
                                        <div class="${ID}-issue-stack">
                                            ${nameDuplicateDetails(nameOnlyGroups)}
                                        </div>
                                    </div>
                                `
                                : ''
                            }

                            ${
                                a.overlaps.length
                                ? `
                                    <div class="warn">
                                        <b>تداخلات زمنية محتملة (${a.overlaps.length} زوجًا)</b>
                                        <span>
                                            المقصود أن فترة نشاط تتقاطع مع فترة نشاط آخر، وليس أن هناك خطأ مؤكدًا.
                                            راجع الحالات التي يستحيل حضور النشاطين فيها في الوقت نفسه.
                                        </span>
                                        <div class="${ID}-issue-stack">
                                            ${overlapDetails(a.overlaps)}
                                        </div>
                                    </div>
                                `
                                : ''
                            }

                            ${
                                !x.errors&&!x.warnings
                                ? `
                                    <div class="ok">
                                        <b>لا توجد ملاحظات ظاهرة</b>
                                        <span>الفحص الذكي مساعد فقط ولا يغني عن «فحص الأنشطة» الرسمي في فارس.</span>
                                    </div>
                                `
                                : ''
                            }
                        </div>
                    </section>
                </div>
            `;
        }
        const EMPTY_REPORT_PROFILE = Object.freeze({
            teacherName:'',
            jobTitle:'',
            schoolName:'',
            principalName:'',
            educationOffice:'',
            academicYear:''
        });

        function loadReportProfile(){
            const saved=
                loadJSON(
                    STORE.reportProfile,
                    {}
                ) || {};

            return {
                ...EMPTY_REPORT_PROFILE,
                ...saved
            };
        }

        function saveReportProfile(profile){
            const cleanProfile={};

            for(const key of Object.keys(EMPTY_REPORT_PROFILE)){
                cleanProfile[key]=
                    clean(profile?.[key]||'');
            }

            saveJSON(
                STORE.reportProfile,
                cleanProfile
            );

            return cleanProfile;
        }

        function readReportProfileInputs(){
            const out={};

            for(const key of Object.keys(EMPTY_REPORT_PROFILE)){
                out[key]=clean(
                    byId(
                        `${ID}-report-profile-${key}`
                    )?.value || ''
                );
            }

            return out;
        }

        function clearReportProfile(){
            saveReportProfile(
                EMPTY_REPORT_PROFILE
            );
        }

        function reportProfileHasData(profile=loadReportProfile()){
            return Object.values(profile)
                .some(value=>clean(value));
        }

        function reportProfileFields(profile=loadReportProfile()){
            return [
                ['اسم المعلم', profile.teacherName],
                ['المسمى الوظيفي', profile.jobTitle],
                ['المدرسة', profile.schoolName],
                ['مدير المدرسة', profile.principalName],
                ['الإدارة / مكتب التعليم', profile.educationOffice],
                ['العام الدراسي', profile.academicYear]
            ].filter(([,value])=>clean(value));
        }

        function pad2(value){
            return String(value).padStart(2,'0');
        }

        function reportPrintContext(){
            const now=new Date();
            const hijri=
                gregorianDateToHijri(now);

            const hijriDate=
                hijri
                    ? hijriString(hijri)
                    : new Intl.DateTimeFormat(
                        'ar-SA-u-ca-islamic-umalqura',
                        {
                            day:'2-digit',
                            month:'2-digit',
                            year:'numeric'
                        }
                      ).format(now);

            const gregorianDate=
                new Intl.DateTimeFormat(
                    'ar-SA-u-ca-gregory',
                    {
                        day:'2-digit',
                        month:'2-digit',
                        year:'numeric'
                    }
                ).format(now);

            const time=
                new Intl.DateTimeFormat(
                    'ar-SA',
                    {
                        hour:'2-digit',
                        minute:'2-digit',
                        second:'2-digit'
                    }
                ).format(now);

            const ref=
                'FP-' +
                now.getFullYear() +
                pad2(now.getMonth()+1) +
                pad2(now.getDate()) +
                '-' +
                pad2(now.getHours()) +
                pad2(now.getMinutes()) +
                pad2(now.getSeconds());

            return {
                now,
                hijriDate,
                gregorianDate,
                time,
                ref
            };
        }

        function reportIdentityHtml(
            profile=loadReportProfile(),
            context=reportPrintContext()
        ){
            const fields=
                reportProfileFields(profile);

            return `
                <div class="identity">
                    <div class="identity-title">
                        <b>بيانات صاحب التقرير</b>
                        <span>
                            المرجع:
                            ${esc(context.ref)}
                        </span>
                    </div>

                    <div class="identity-grid">
                        ${
                            fields.length
                                ? fields.map(
                                    ([label,value])=>`
                                        <div>
                                            <span>${esc(label)}</span>
                                            <b>${esc(value)}</b>
                                        </div>
                                    `
                                  ).join('')
                                : `<div class="identity-empty">
                                    لم تتم إضافة بيانات تعريف صاحب التقرير.
                                   </div>`
                        }
                    </div>

                    <div class="print-meta">
                        <div>
                            <span>تاريخ الطباعة هجري</span>
                            <b>${esc(context.hijriDate)}</b>
                        </div>

                        <div>
                            <span>تاريخ الطباعة ميلادي</span>
                            <b>${esc(context.gregorianDate)}</b>
                        </div>

                        <div>
                            <span>وقت الطباعة</span>
                            <b>${esc(context.time)}</b>
                        </div>
                    </div>
                </div>
            `;
        }

        function reportSignaturesHtml(
            profile=loadReportProfile()
        ){
            return `
                <div class="signatures">
                    <div>
                        <b>المعلم</b>
                        <span>
                            ${
                                esc(
                                    profile.teacherName ||
                                    '____________________________'
                                )
                            }
                        </span>
                        <em>التوقيع: ____________________</em>
                    </div>

                    <div>
                        <b>مدير المدرسة</b>
                        <span>
                            ${
                                esc(
                                    profile.principalName ||
                                    '____________________________'
                                )
                            }
                        </span>
                        <em>الاعتماد / التوقيع: ____________________</em>
                    </div>
                </div>
            `;
        }

        function reportProfileEditorHtml(){
            const p=loadReportProfile();

            const field=(
                key,
                label,
                placeholder=''
            )=>`
                <label>
                    <span>${esc(label)}</span>
                    <input
                        id="${ID}-report-profile-${key}"
                        value="${esc(p[key]||'')}"
                        autocomplete="off"
                        placeholder="${esc(placeholder)}"
                    >
                </label>
            `;

            return `
                <details class="${ID}-report-profile">
                    <summary>
                        بيانات صاحب التقرير والطباعة
                        ${
                            reportProfileHasData(p)
                                ? '<small>✓ محفوظة محليًا</small>'
                                : '<small>اختياري</small>'
                        }
                    </summary>

                    <div class="${ID}-report-profile-body">
                        <div class="${ID}-report-profile-note">
                            هذه البيانات تُحفظ محليًا في هذا المتصفح فقط.
                            فارس+ لا يسحب اسم الموظف أو المدرسة تلقائيًا من
                            بيانات فارس ولا يرسل هذه المعلومات إلى أي جهة.
                        </div>

                        <div class="${ID}-report-profile-grid">
                            ${field(
                                'teacherName',
                                'اسم المعلم',
                                'مثال: محمد ...'
                            )}

                            ${field(
                                'jobTitle',
                                'المسمى الوظيفي',
                                'مثال: معلم متقدم'
                            )}

                            ${field(
                                'schoolName',
                                'المدرسة',
                                'اسم المدرسة'
                            )}

                            ${field(
                                'principalName',
                                'مدير المدرسة',
                                'اسم مدير المدرسة'
                            )}

                            ${field(
                                'educationOffice',
                                'الإدارة / مكتب التعليم',
                                'مثال: تعليم عسير'
                            )}

                            ${field(
                                'academicYear',
                                'العام الدراسي',
                                'مثال: 1447هـ'
                            )}
                        </div>

                        <div class="${ID}-report-profile-actions">
                            <button
                                type="button"
                                class="primary"
                                data-act="save-report-profile"
                            >
                                حفظ بيانات التقرير
                            </button>

                            <button
                                type="button"
                                data-act="clear-report-profile"
                            >
                                مسح البيانات
                            </button>
                        </div>
                    </div>
                </details>
            `;
        }

        function reportActivities(){
            return pd.reportScope==='filtered'
                ? filtered()
                : [...pd.activities];
        }

        function reportFilterParts(){
            const parts=[];

            if(clean(pd.filter.q)){
                parts.push(`بحث: ${clean(pd.filter.q)}`);
            }
            if(clean(pd.filter.year)){
                parts.push(`السنة الميلادية: ${clean(pd.filter.year)}`);
            }
            if(clean(pd.filter.role)){
                parts.push(`الدور: ${clean(pd.filter.role)}`);
            }
            if(clean(pd.filter.type)){
                parts.push(`نوع النشاط: ${clean(pd.filter.type)}`);
            }
            if(clean(pd.filter.durationType)){
                parts.push(`نوع المدة: ${clean(pd.filter.durationType)}`);
            }

            return parts;
        }

        function reportFilterLabel(){
            if(pd.reportScope==='all'){
                return 'كل الأنشطة';
            }

            const parts=reportFilterParts();

            return parts.length
                ? parts.join(' · ')
                : 'لا توجد شروط تصفية — كل الأنشطة ظاهرة';
        }

        function safeFilePart(value=''){
            return norm(value)
                .replace(/\s+/g,'-')
                .replace(/[^ء-يa-z0-9_-]/gi,'')
                .slice(0,70);
        }

        function reportFileSuffix(){
            if(pd.reportScope==='all'){
                return 'كامل';
            }

            const parts=[];

            if(pd.filter.year){
                parts.push(`ميلادي-${safeFilePart(pd.filter.year)}`);
            }
            if(pd.filter.role){
                parts.push(safeFilePart(pd.filter.role));
            }
            if(pd.filter.type){
                parts.push(safeFilePart(pd.filter.type));
            }
            if(pd.filter.durationType){
                parts.push(safeFilePart(pd.filter.durationType));
            }
            if(pd.filter.q){
                parts.push('بحث');
            }

            return parts.length
                ? parts.join('-')
                : 'حسب-التصفية';
        }

        function reportAnalysis(rows=reportActivities()){
            return analyze(rows);
        }

        function reportExtended(rows=reportActivities()){
            const a=analyze(rows);
            const nums=rows.map(durNum).filter(n=>n>0);

            const avg=nums.length
                ? Math.round(
                    (
                        nums.reduce((x,y)=>x+y,0) /
                        nums.length
                    ) * 10
                ) / 10
                : 0;

            const yearlyHours={};

            for(const r of rows){
                const y=activityGregorianYear(r);

                if(y && /ساع/.test(r.durationType)){
                    yearlyHours[y]=
                        (yearlyHours[y]||0) +
                        durNum(r);
                }
            }

            return {a,avg,yearlyHours};
        }

        function reportScopeSummaryHtml(){
            const rows=reportActivities();
            const parts=reportFilterParts();

            return `
                <div class="${ID}-report-scope-summary">
                    <div>
                        <span>نطاق التقرير</span>
                        <b>${
                            pd.reportScope==='filtered'
                                ? 'حسب التصفية الحالية'
                                : 'كل الأنشطة'
                        }</b>
                    </div>

                    <div>
                        <span>عدد الأنشطة في التقرير</span>
                        <b>${rows.length}</b>
                    </div>

                    <div class="wide">
                        <span>أساس الاحتساب السنوي</span>
                        <b>ميلادي — حسب تاريخ بداية النشاط (التاريخ الأصلي في فارس يبقى هجريًا)</b>
                    </div>

                    ${
                        pd.reportScope==='filtered'
                            ? `<div class="wide">
                                <span>شروط التصفية</span>
                                <b>${
                                    parts.length
                                        ? esc(parts.join(' · '))
                                        : 'لا توجد شروط — كل الأنشطة ظاهرة'
                                }</b>
                               </div>`
                            : ''
                    }
                </div>
            `;
        }

        function reportLiveHtml(){
            const rows=reportActivities();

            return `
                ${reportScopeSummaryHtml()}

                <div class="${ID}-reportbtns">
                    <button
                        data-act="print"
                        ${rows.length?'':'disabled'}
                    >
                        🖨 التقرير / PDF
                    </button>

                    <button
                        data-act="print-summary"
                        ${rows.length?'':'disabled'}
                    >
                        📄 ملخص السجل
                    </button>

                    <button
                        data-act="csv"
                        ${rows.length?'':'disabled'}
                    >
                        CSV
                    </button>

                    <button
                        data-act="xls"
                        ${rows.length?'':'disabled'}
                    >
                        Excel
                    </button>

                    <button
                        data-act="json"
                        ${rows.length?'':'disabled'}
                    >
                        JSON
                    </button>
                </div>
            `;
        }

        function renderReportLive(){
            if(pd.tab!=='report') return;

            const live=byId(`${ID}-report-live`);

            if(live){
                live.innerHTML=reportLiveHtml();
                neutralizeUiButtons(live);
            }

            const root=byId(`${ID}-manager`);

            root
                ?.querySelector(
                    '[data-act="report-scope-filtered"]'
                )
                ?.classList.toggle(
                    'active',
                    pd.reportScope==='filtered'
                );

            root
                ?.querySelector(
                    '[data-act="report-scope-all"]'
                )
                ?.classList.toggle(
                    'active',
                    pd.reportScope==='all'
                );

            const filteredButton=
                root?.querySelector(
                    '[data-act="report-scope-filtered"] small'
                );

            if(filteredButton){
                filteredButton.textContent=
                    `${filtered().length} نشاطًا`;
            }
        }

        function reportRows(rows=reportActivities()){
            return rows.map(a=>`
                <tr>
                    <td>${a.globalIndex}</td>
                    <td>${esc(a.name)}</td>
                    <td>${esc(a.location)}</td>
                    <td>${esc(a.startDate)}</td>
                    <td>${esc(a.endDate)}</td>
                    <td>${activityGregorianYear(a)?`${activityGregorianYear(a)} م`:'—'}</td>
                    <td>${esc(a.role)}</td>
                    <td>${esc(a.type)}</td>
                    <td>${esc(a.durationType)}</td>
                    <td>${esc(a.duration)}</td>
                </tr>
            `).join('');
        }
        function reportHtml(){
            const rows=reportActivities();
            const a=reportAnalysis(rows);
            const profile=loadReportProfile();
            const context=reportPrintContext();

            const title=
                pd.reportScope==='filtered'
                    ? 'تقرير أنشطة التطوير المهني — حسب التصفية'
                    : 'تقرير أنشطة التطوير المهني — كامل';

            return `<!doctype html>
            <html lang="ar" dir="rtl">
            <head>
                <meta charset="utf-8">
                <title>${esc(title)}</title>
                <style>
                    *{box-sizing:border-box}
                    body{font-family:Tahoma,Arial,sans-serif;margin:0;background:#f5f7fa;color:#172033}
                    .sheet{max-width:1250px;margin:24px auto;background:#fff;padding:28px;border-radius:18px}
                    .top{border-top:7px solid #173f5f;padding-top:20px;display:flex;justify-content:space-between;gap:18px}
                    .top h1{margin:0;color:#173f5f}
                    .sub{font-size:11px;color:#7b8794;margin-top:7px;line-height:1.8}
                    .identity{margin:16px 0;border:1px solid #dde6ec;border-radius:12px;overflow:hidden}
                    .identity-title{display:flex;justify-content:space-between;gap:16px;align-items:center;background:#f4f8fa;padding:10px 12px;color:#173f5f}
                    .identity-title span{font-size:9px;color:#718092}
                    .identity-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:0}
                    .identity-grid>div{padding:9px 11px;border-bottom:1px solid #edf1f4;border-inline-start:1px solid #edf1f4}
                    .identity-grid span,.print-meta span{display:block;font-size:8px;color:#82909f;margin-bottom:3px}
                    .identity-grid b,.print-meta b{font-size:10px;color:#33485f}
                    .identity-empty{grid-column:1/-1;color:#8a96a4;font-size:9px}
                    .print-meta{display:grid;grid-template-columns:repeat(3,1fr);background:#fbfcfd}
                    .print-meta>div{padding:9px 11px;border-inline-start:1px solid #edf1f4}
                    .scope{margin:15px 0;padding:12px 14px;background:#eef5f8;border-right:4px solid #2a8b81;border-radius:10px}
                    .scope b{color:#173f5f}
                    .scope span{display:block;font-size:10px;color:#687789;margin-top:5px}
                    .metrics{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin:22px 0}
                    .metrics div{background:#f6f9fb;border:1px solid #e3e9ef;border-radius:12px;padding:12px;text-align:center}
                    .metrics b{display:block;font-size:20px;color:#173f5f}
                    .metrics span{font-size:9px;color:#788697}
                    table{width:100%;border-collapse:collapse;font-size:9px}
                    th{background:#173f5f;color:#fff;padding:8px}
                    td{border-bottom:1px solid #e7ecf1;padding:7px;vertical-align:top}
                    tr:nth-child(even) td{background:#fafbfd}
                    .signatures{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin:28px 0 18px;padding-top:18px;border-top:1px solid #dfe6ec}
                    .signatures>div{min-height:82px;padding:10px 14px;background:#fafbfd;border-radius:10px}
                    .signatures b{display:block;color:#173f5f;font-size:10px;margin-bottom:7px}
                    .signatures span{display:block;color:#35495f;font-size:10px;margin-bottom:15px}
                    .signatures em{font-style:normal;color:#7d8997;font-size:9px}
                    .foot{display:flex;justify-content:space-between;gap:20px;margin-top:16px;color:#8a94a2;font-size:8px}
                    @media print{
                        body{background:#fff}
                        .sheet{margin:0;max-width:none;padding:7mm}
                        @page{size:A4 landscape;margin:7mm}
                    }
                </style>
            </head>
            <body>
                <section class="sheet">
                    <div class="top">
                        <div>
                            <h1>${esc(title)}</h1>
                            <div class="sub">
                                مستخرج محليًا من البيانات المعروضة في فارس
                                — عدد الأنشطة: ${rows.length}
                            </div>
                        </div>

                        <div>
                            فارس+<br>
                            <b>M0HM3D85</b>
                        </div>
                    </div>

                    ${reportIdentityHtml(
                        profile,
                        context
                    )}

                    <div class="scope">
                        <b>${
                            pd.reportScope==='filtered'
                                ? 'التقرير مبني على التصفية الحالية'
                                : 'التقرير يشمل كامل الأنشطة المفهرسة'
                        }</b>

                        <span>${esc(reportFilterLabel())}</span>
                        <span>الاحتساب السنوي: ميلادي حسب تاريخ بداية النشاط، مع إبقاء تواريخ فارس الأصلية بالهجري.</span>
                    </div>

                    <div class="metrics">
                        <div><b>${a.total}</b><span>الأنشطة</span></div>
                        <div><b>${a.beneficiary}</b><span>مستفيد</span></div>
                        <div><b>${a.executor}</b><span>منفذ</span></div>
                        <div><b>${a.totalHours}</b><span>الساعات</span></div>
                        <div><b>${a.totalDays}</b><span>الأيام</span></div>
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>اسم النشاط</th>
                                <th>الجهة</th>
                                <th>البداية</th>
                                <th>النهاية</th>
                                <th>سنة الاحتساب الميلادية</th>
                                <th>الدور</th>
                                <th>نوع النشاط</th>
                                <th>نوع المدة</th>
                                <th>المدة</th>
                            </tr>
                        </thead>

                        <tbody>${reportRows(rows)}</tbody>
                    </table>

                    ${reportSignaturesHtml(profile)}

                    <div class="foot">
                        <span>
                            هذا التقرير لا يغيّر بيانات فارس
                            ولا يمثل اعتمادًا رسميًا.<br>
                            مرجع التقرير:
                            <b>${esc(context.ref)}</b>
                        </span>

                        <span>
                            تصميم وتطوير:
                            <b>${esc(DEV.name)} (${esc(DEV.handle)})</b>
                            — © 2026 جميع الحقوق محفوظة.<br>
                            GreasyFork: ${esc(DEV.greasy)}
                            — X: @${esc(DEV.handle)}
                            — Snapchat: ${esc(DEV.handle)}
                        </span>
                    </div>
                </section>
            </body>
            </html>`;
        }

        function reportTab(){
            return `
                <div class="${ID}-grid">
                    <section class="${ID}-panel full">
                        <div class="${ID}-panelhead">
                            <div>
                                <h3>التقرير والتصدير</h3>
                                <p>
                                    أنشئ تقريرًا لكل الأنشطة
                                    أو حسب التصفية الحالية فقط.
                                </p>
                            </div>
                        </div>

                        ${reportProfileEditorHtml()}

                        <div class="${ID}-report-scope-switch">
                            <button
                                type="button"
                                data-act="report-scope-filtered"
                                class="${
                                    pd.reportScope==='filtered'
                                        ? 'active'
                                        : ''
                                }"
                            >
                                ◉ حسب التصفية الحالية
                                <small>${filtered().length} نشاطًا</small>
                            </button>

                            <button
                                type="button"
                                data-act="report-scope-all"
                                class="${
                                    pd.reportScope==='all'
                                        ? 'active'
                                        : ''
                                }"
                            >
                                ○ كل الأنشطة
                                <small>${pd.activities.length} نشاطًا</small>
                            </button>
                        </div>

                        <div class="${ID}-report-filterbox">
                            <div class="${ID}-search">
                                <span>🔎</span>

                                <input
                                    id="${ID}-report-q"
                                    value="${esc(pd.filter.q)}"
                                    autocomplete="off"
                                    spellcheck="false"
                                    placeholder="بحث داخل التقرير..."
                                >
                            </div>

                            <select data-report-filter="year">
                                ${opts(
                                    years().map(String),
                                    pd.filter.year,
                                    'كل السنوات الميلادية'
                                )}
                            </select>

                            <select data-report-filter="role">
                                ${opts(
                                    unique('role'),
                                    pd.filter.role
                                )}
                            </select>

                            <select data-report-filter="type">
                                ${opts(
                                    unique('type'),
                                    pd.filter.type
                                )}
                            </select>

                            <select data-report-filter="durationType">
                                ${opts(
                                    unique('durationType'),
                                    pd.filter.durationType
                                )}
                            </select>

                            <button
                                type="button"
                                data-act="clear-report-filters"
                            >
                                مسح التصفية
                            </button>
                        </div>

                        <div id="${ID}-report-live">
                            ${reportLiveHtml()}
                        </div>
                    </section>

                    <section class="${ID}-panel">
                        <h3>مثال: تقرير سنة 2025 م</h3>
                        <p>
                            اختر 2025 من السنة الميلادية،
                            ثم صدّر PDF أو Excel.
                        </p>
                    </section>

                    <section class="${ID}-panel">
                        <h3>مثال: أنشطة منفذ فقط</h3>
                        <p>
                            اختر «منفذ» من الدور،
                            ويمكن دمجه مع السنة والنوع.
                        </p>
                    </section>
                </div>
            `;
        }

        const bodyHtml = () =>
            pd.tab==='analysis'?analysisHtml():
            pd.tab==='report'?reportTab():
            pd.tab==='drafts'?draftsHtml():
            pd.tab==='certificates'?certificatesHtml():
            pd.tab==='import'?importHtml():
            pd.tab==='templates'?templatesHtml():
            pd.tab==='review'?finalReviewHtml():
            activitiesHtml();


        function manager(){
            let r=byId(`${ID}-manager`); if(r) return r;
            r=document.createElement('div');r.id=`${ID}-manager`;
            r.innerHTML=`<div class="${ID}-back"></div><section class="${ID}-app"><header><div><small>فارس+ / التطوير المهني</small><h2>إدارة أنشطة التطوير المهني</h2><p id="${ID}-status">جاهز</p></div><div><button type="button" data-act="about">عن السكربت</button><button type="button" data-act="rescan">↻ تحديث الفهرس</button><button type="button" class="primary" data-act="add">+ إضافة نشاط</button><button type="button" class="icon" data-act="close">×</button></div></header><nav>
<button type="button" data-tab="activities" class="active">الأنشطة</button>
<button type="button" data-tab="analysis">التحليل والفحص</button>
<button type="button" data-tab="drafts">المسودات</button>
<button type="button" data-tab="certificates">📜 الشهادات</button>
<button type="button" data-tab="import">استيراد Excel</button>
<button type="button" data-tab="templates">القوالب</button>
<button type="button" data-tab="report">التقرير والتصدير</button>
<button type="button" data-tab="review">المراجعة النهائية</button>
</nav><main id="${ID}-body"></main><footer><span>فارس هو مصدر البيانات الرسمي؛ فارس+ يعيد تنظيم العرض ويستدعي أوامر فارس الأصلية.</span>${developerCreditHtml()}</footer></section>`;
            neutralizeUiButtons(r);
            r.addEventListener('click',onClick);
            r.addEventListener('input',onInput);
            r.addEventListener('change',onChange);
            r.querySelector(`.${ID}-back`).onclick=closeManager;
            document.body.appendChild(r);
            return r;
        }
        function status(msg){const el=byId(`${ID}-status`);if(el)el.textContent=msg;}
        function refresh(){
            const r=byId(`${ID}-manager`);
            if(!r) return;

            r.querySelectorAll('[data-tab]')
                .forEach(b=>b.classList.toggle('active',b.dataset.tab===pd.tab));

            const b=byId(`${ID}-body`);

            if(b){
                b.innerHTML=bodyHtml();
                neutralizeUiButtons(b);
            }

            neutralizeUiButtons(r);

            if(pd.tab==='import'){
                const input=byId(`${ID}-import-file`);
                if(input&&!input.dataset.bound){
                    input.dataset.bound='1';
                    input.addEventListener('change',ev=>{
                        const file=ev.target.files?.[0];
                        if(file)handleImportFile(file);
                    });
                }
                const drop=byId(`${ID}-drop`);
                if(drop&&!drop.dataset.bound){
                    drop.dataset.bound='1';
                    ['dragenter','dragover'].forEach(type=>drop.addEventListener(type,ev=>{ev.preventDefault();drop.classList.add('over')}));
                    ['dragleave','drop'].forEach(type=>drop.addEventListener(type,ev=>{ev.preventDefault();drop.classList.remove('over')}));
                    drop.addEventListener('drop',ev=>{const file=ev.dataTransfer?.files?.[0];if(file)handleImportFile(file)});
                }
            }

            if(pd.tab==='certificates'){
                bindCertificateInputs();
            }
        }
        async function openManager(){
            await ensureTrainingExpanded();

            const r=manager();
            r.classList.add('open');
            pd.managerOpen=true;

            if(!pd.activities.length){
                const ok=loadCache();

                if(ok){
                    refresh();
                    status(`تم تحميل ${pd.activities.length} نشاطًا من الفهرس المحلي.`);
                }

                await scan(!ok);
            } else {
                refresh();
            }

            // سجل واضح يفيدنا إذا أعاد Oracle أي سلوك غير متوقع.
            console.log(
                '%c فارس+ | تم فتح إدارة الأنشطة ',
                'background:#2A8B81;color:#fff;padding:5px 9px;border-radius:5px',
                {
                    openClass: r.classList.contains('open'),
                    display: getComputedStyle(r).display,
                    activities: pd.activities.length,
                    cards: r.querySelectorAll(`.${ID}-card`).length,
                    bodyExists: !!byId(`${ID}-body`)
                }
            );

            return r;
        }
        function closeManager(){byId(`${ID}-manager`)?.classList.remove('open');pd.managerOpen=false;closeEditor();}
        function onInput(e){
            if(e.target?.id===`${ID}-q`){
                pd.filter.q=e.target.value;
                clearTimeout(pd.searchTimer);
                pd.searchTimer=setTimeout(
                    renderActivityResults,
                    45
                );
                return;
            }

            if(e.target?.id===`${ID}-report-q`){
                pd.filter.q=e.target.value;
                clearTimeout(pd.searchTimer);
                pd.searchTimer=setTimeout(
                    renderReportLive,
                    45
                );
            }
        }
        function onChange(e){
            if(e.target?.dataset?.filter){
                pd.filter[
                    e.target.dataset.filter
                ]=e.target.value;
                renderActivityResults();
                return;
            }

            if(e.target?.dataset?.reportFilter){
                pd.filter[
                    e.target.dataset.reportFilter
                ]=e.target.value;
                renderReportLive();
                return;
            }

            if(e.target?.id===`${ID}-sort`){
                pd.sort=e.target.value;
                renderActivityResults();
                return;
            }
        }
        const activity = i => pd.activities.find(a=>+a.globalIndex===+i);
        async function onClick(e){
            const t=e.target.closest('[data-tab]');
            if(t){
                e.preventDefault();e.stopPropagation();
                pd.tab=t.dataset.tab;refresh();return;
            }
            const b=e.target.closest('[data-act]');
            if(!b)return;
            e.preventDefault();e.stopPropagation();
            const a=b.dataset.act,i=b.dataset.i,id=b.dataset.id;

            if(a==='about')return aboutScript();
            if(a==='close')return closeManager();
            if(a==='rescan')return scan(true);
            if(a==='smart')return smartCheck(true);
            if(a==='add')return addActivity();
            if(a==='goto')return gotoActivity(activity(i),true);
            if(a==='edit')return editActivity(activity(i));
            if(a==='delete')return deleteActivity(activity(i));
            if(a==='view-table'){pd.view='table';return renderActivityResults();}
            if(a==='view-cards'){pd.view='cards';return renderActivityResults();}
            if(a==='save-report-profile'){
                const saved=
                    saveReportProfile(
                        readReportProfileInputs()
                    );

                toast(
                    reportProfileHasData(saved)
                        ? 'تم حفظ بيانات صاحب التقرير محليًا.'
                        : 'تم حفظ بيانات التقرير بدون معلومات تعريفية.',
                    'success'
                );

                return refresh();
            }

            if(a==='clear-report-profile'){
                if(
                    !confirm(
                        'هل تريد مسح بيانات صاحب التقرير المحفوظة محليًا؟'
                    )
                ){
                    return;
                }

                clearReportProfile();

                toast(
                    'تم مسح بيانات صاحب التقرير.',
                    'success'
                );

                return refresh();
            }

            if(a==='report-scope-filtered'){
                pd.reportScope='filtered';
                return renderReportLive();
            }

            if(a==='report-scope-all'){
                pd.reportScope='all';
                return renderReportLive();
            }

            if(a==='clear-report-filters'){
                pd.filter={
                    q:'',
                    role:'',
                    type:'',
                    durationType:'',
                    year:''
                };
                pd.reportScope='filtered';

                const root=byId(`${ID}-manager`);

                const q=
                    byId(`${ID}-report-q`);

                if(q)q.value='';

                root
                    ?.querySelectorAll(
                        '[data-report-filter]'
                    )
                    .forEach(select=>{
                        select.value='';
                    });

                return renderReportLive();
            }

            if(a==='print')return printReport();
            if(a==='print-summary')return printSummaryReport();
            if(a==='csv')return exportCsv();
            if(a==='xls')return exportXls();
            if(a==='json')return exportJson();
            if(a==='delete-draft')return removeDraft(id);
            if(a==='edit-draft'){
                const d=loadDrafts().find(x=>x.id===id);
                if(d){pd.editorActivity=d;openDraftEditor('local-draft',d);}
                return;
            }
            if(a==='commit-one-draft')return commitDraftById(id);
            if(a==='commit-drafts')return commitAllDrafts();
            if(a==='use-template')return applyTemplateToNew(id);
            if(a==='delete-template')return removeTemplate(id);
            if(a==='download-import-template'){
                return downloadImportTemplate();
            }

            if(a==='import-to-drafts'){
                if(pd.importErrors.length)return toast('عالج أخطاء الاستيراد أولًا.','error');
                const drafts=loadDrafts();
                const added=pd.importRows.map(v=>({id:draftId(),savedAt:Date.now(),source:'import',...v}));
                saveDrafts([...added,...drafts].slice(0,500));
                pd.importRows=[];pd.importErrors=[];pd.tab='drafts';refresh();
                return toast(`تمت إضافة ${added.length} مسودة.`);
            }
            if(a==='certificate-remove')return removeCertificateResult(id);
            if(a==='certificate-clear'){
                if(pd.certificateBusy)return;
                pd.certificateResults=[];refresh();return;
            }
            if(a==='certificate-ai-save-key')return saveGeminiKeyFromUi();
            if(a==='certificate-ai-delete-key')return deleteGeminiKey();
            if(a==='certificate-ai-analyze')return analyzeCertificateWithGemini(id);
            if(a==='certificate-ai-apply')return applyGeminiCertificateCandidate(id);
            if(a==='certificate-ai-discard')return discardGeminiCertificateCandidate(id);
            if(a==='certificate-review')return reviewCertificateResult(id);
            if(a==='certificate-one-draft')return addCertificateResultToDraft(id);
            if(a==='certificate-to-drafts')return addReadyCertificatesToDrafts();
            if(a==='validate')return validateAll();
            if(a==='approve-final')return approve();
        }
        async function gotoActivity(a,close=false){if(!a)return false;if(editing()){toast('احفظ النشاط المفتوح قبل الانتقال.','error');return false;}status(`الانتقال إلى #${a.globalIndex}...`);if(!(await gotoPage(a.pageIndex))){toast('تعذر فتح صفحة النشاط.','error');return false;}highlight(a.rowIndex);if(close)closeManager();return true;}
        const tableRow = i => byId('TrainingTableRN:Content')?.rows?.[i+1]||null;
        function action(i,type){const row=tableRow(i),cell=row?.cells?.[type==='update'?8:9];return cell?.querySelector('button,a,input[type="submit"],input[type="image"],[onclick]')||cell?.querySelector('img')?.closest('a,[onclick]')||null;}
        function highlight(i){const row=tableRow(i);if(!row)return;row.classList.add(`${ID}-hilite`);row.scrollIntoView({behavior:'smooth',block:'center'});setTimeout(()=>row.classList.remove(`${ID}-hilite`),4200);}
        async function editable(preferred=null){const start=Date.now();while(Date.now()-start<3000){if(preferred!==null&&control('name',preferred)&&!control('name',preferred).disabled)return preferred;for(let i=0;i<20;i++){if(control('name',i)&&!control('name',i).disabled)return i;}await wait(100);}return null;}
        async function editActivity(a){
            if(!a) return;

            const stuck=incompleteEditableRow();

            if(stuck){
                openStuckRecovery(stuck);
                return;
            }

            if(editing()){
                toast('يوجد صف مفتوح للتحرير داخل فارس. أنهِه أولًا.','error');
                return;
            }

            // لا نفتح صف Oracle الآن؛ نحرر نسخة Draft أولًا.
            openDraftEditor('draft-edit',a);
        }

        async function addActivity(){
            const stuck=incompleteEditableRow();

            if(stuck){
                openStuckRecovery(stuck);
                return;
            }

            if(editing()){
                toast('يوجد صف مفتوح للتحرير داخل فارس. أنهِه أولًا.','error');
                return;
            }

            // الأهم: لا نضغط زر "إضافة" الأصلي هنا.
            // السطر لا يُنشأ إلا بعد اكتمال النموذج واعتماد المستخدم.
            openDraftEditor('draft-add',null);
        }

        async function deleteActivity(a){if(!confirm(`سيتم حذف النشاط عبر أمر فارس الأصلي:\n\n${a.name}\n\nمتابعة؟`))return;if(!(await gotoActivity(a)))return;const act=action(a.rowIndex,'delete');if(!act){toast('لم أجد أمر الحذف الأصلي.','error');return;}if(!confirm('تأكيد أخير: هل أنت متأكد من الحذف؟'))return;const before=sig();act.click();await waitChange(before,2800);invalidate();pd.activities=[];pd.analysis=null;toast('تم استدعاء الحذف في فارس.');await scan(true);}

        function selectOptions(
            el,
            {
                value='',
                text='',
                placeholder='— اختر —',
                dropBlank=true
            }={}
        ){
            if(!el){
                return placeholder
                    ? `<option value="" selected>${esc(placeholder)}</option>`
                    : '';
            }

            const wantedText=clean(text);
            let matched=false;

            const items=[...el.options]
                .filter(o=>{
                    if(!dropBlank) return true;
                    return !!(
                        clean(o.textContent) ||
                        clean(o.value)
                    );
                })
                .map(o=>{
                    const optionText=clean(o.textContent);
                    const selected =
                        (value && o.value===value) ||
                        (!value && wantedText && optionText===wantedText);

                    if(selected) matched=true;

                    return `<option value="${esc(o.value)}" ${selected?'selected':''}>${esc(optionText||o.value)}</option>`;
                });

            if(placeholder){
                items.unshift(
                    `<option value="" ${matched?'':'selected'}>${esc(placeholder)}</option>`
                );
            }

            return items.join('');
        }

        // =========================================================
        // Date picker — فارس يعرض حقول التاريخ بصيغة هجرية.
        // الوضع الافتراضي هجري، مع خيار ميلادي يحوّل محليًا
        // إلى أم القرى قبل نقل القيمة إلى حقل فارس.
        // =========================================================
        const HIJRI_MONTHS=[
            'محرم','صفر','ربيع الأول','ربيع الآخر',
            'جمادى الأولى','جمادى الآخرة','رجب','شعبان',
            'رمضان','شوال','ذو القعدة','ذو الحجة'
        ];

        function latinDigits(value=''){
            return String(value)
                .replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d))
                .replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
        }

        function parseNumericDate(value=''){
            const nums=latinDigits(clean(value)).match(/\d+/g);
            if(!nums || nums.length<3) return null;

            let d,m,y;

            if(Number(nums[0])>1000){
                y=Number(nums[0]);
                m=Number(nums[1]);
                d=Number(nums[2]);
            }else{
                d=Number(nums[0]);
                m=Number(nums[1]);
                y=Number(nums[2]);
            }

            if(
                !Number.isFinite(d) ||
                !Number.isFinite(m) ||
                !Number.isFinite(y) ||
                d<1 || d>31 ||
                m<1 || m>12
            ) return null;

            return {day:d,month:m,year:y};
        }

        function pad2(n){
            return String(Number(n)||0).padStart(2,'0');
        }

        function hijriString(parts){
            if(!parts) return '';
            return `${pad2(parts.day)}/${pad2(parts.month)}/${parts.year}`;
        }

        let ummAlQuraFormatter=null;

        function getUmmAlQuraFormatter(){
            if(ummAlQuraFormatter) return ummAlQuraFormatter;

            try{
                ummAlQuraFormatter=new Intl.DateTimeFormat(
                    'en-GB-u-ca-islamic-umalqura-nu-latn',
                    {
                        day:'2-digit',
                        month:'2-digit',
                        year:'numeric',
                        timeZone:'Asia/Riyadh'
                    }
                );

                return ummAlQuraFormatter;
            }catch(_){
                try{
                    ummAlQuraFormatter=new Intl.DateTimeFormat(
                        'en-GB-u-ca-islamic-nu-latn',
                        {
                            day:'2-digit',
                            month:'2-digit',
                            year:'numeric',
                            timeZone:'Asia/Riyadh'
                        }
                    );

                    return ummAlQuraFormatter;
                }catch(__){
                    return null;
                }
            }
        }

        function gregorianDateToHijri(date){
            const formatter=getUmmAlQuraFormatter();

            if(
                !formatter ||
                !(date instanceof Date) ||
                !Number.isFinite(date.getTime())
            ){
                return null;
            }

            try{
                const parts=formatter.formatToParts(date);
                const get=type=>Number(
                    parts.find(p=>p.type===type)?.value || 0
                );

                const result={
                    day:get('day'),
                    month:get('month'),
                    year:get('year')
                };

                return (
                    result.day &&
                    result.month &&
                    result.year
                ) ? result : null;

            }catch(_){
                return null;
            }
        }

        function gregorianIsoToHijri(iso=''){
            const m=String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if(!m) return null;

            const date=new Date(
                Number(m[1]),
                Number(m[2])-1,
                Number(m[3]),
                12,0,0,0
            );

            return gregorianDateToHijri(date);
        }

        function hijriOrdinal(parts){
            if(!parts) return NaN;
            return parts.year*400 + parts.month*31 + parts.day;
        }

        function dateAtUtcNoon(ms){
            const d=new Date(ms);
            return new Date(
                Date.UTC(
                    d.getUTCFullYear(),
                    d.getUTCMonth(),
                    d.getUTCDate(),
                    12,0,0,0
                )
            );
        }

        function hijriToGregorian(parts){
            if(!parts) return null;

            const wanted=hijriOrdinal(parts);
            if(!Number.isFinite(wanted)) return null;

            const approxYear=Math.round(
                parts.year*0.970224 + 621.5774
            );

            let low=Date.UTC(approxYear-2,0,1,12);
            let high=Date.UTC(approxYear+2,11,31,12);
            const DAY=86400000;

            while(low<=high){
                const midRaw=Math.floor((low+high)/(2*DAY))*DAY;
                const mid=dateAtUtcNoon(midRaw);
                const hp=gregorianDateToHijri(mid);

                if(!hp) return null;

                const key=hijriOrdinal(hp);

                if(key===wanted){
                    return mid;
                }

                if(key<wanted){
                    low=mid.getTime()+DAY;
                }else{
                    high=mid.getTime()-DAY;
                }
            }

            return null;
        }

        function isoFromGregorianDate(date){
            if(
                !(date instanceof Date) ||
                !Number.isFinite(date.getTime())
            ) return '';

            return [
                date.getUTCFullYear(),
                pad2(date.getUTCMonth()+1),
                pad2(date.getUTCDate())
            ].join('-');
        }

        function gregorianDisplay(date){
            if(
                !(date instanceof Date) ||
                !Number.isFinite(date.getTime())
            ) return '—';

            try{
                return new Intl.DateTimeFormat(
                    'ar-SA-u-ca-gregory',
                    {
                        day:'2-digit',
                        month:'2-digit',
                        year:'numeric',
                        timeZone:'Asia/Riyadh'
                    }
                ).format(date);
            }catch(_){
                return isoFromGregorianDate(date);
            }
        }

        function hijriDayOptions(selected=''){
            return [
                '<option value="">اليوم</option>',
                ...Array.from({length:30},(_,i)=>i+1)
                    .map(d=>`<option value="${d}" ${Number(selected)===d?'selected':''}>${d}</option>`)
            ].join('');
        }

        function hijriMonthOptions(selected=''){
            return [
                '<option value="">الشهر</option>',
                ...HIJRI_MONTHS.map((name,i)=>{
                    const m=i+1;
                    return `<option value="${m}" ${Number(selected)===m?'selected':''}>${m} — ${name}</option>`;
                })
            ].join('');
        }

        function dateWidgetHtml(key,label,value=''){
            const parsed=parseNumericDate(value);
            const hijri=parsed && parsed.year<1700 ? parsed : null;

            return `
                <div class="${ID}-datebox" data-datebox="${key}">
                    <div class="${ID}-datehead">
                        <span>${esc(label)} *</span>

                        <div class="${ID}-date-modes">
                            <button
                                type="button"
                                class="active"
                                data-cal-mode="hijri"
                                data-date-key="${key}"
                            >
                                هجري <small>فارس</small>
                            </button>

                            <button
                                type="button"
                                data-cal-mode="gregorian"
                                data-date-key="${key}"
                            >
                                ميلادي
                            </button>
                        </div>
                    </div>

                    <input
                        type="hidden"
                        data-f="${key}"
                        value="${esc(value)}"
                    >

                    <div class="${ID}-datepanel" data-cal-panel="hijri">
                        <div class="${ID}-hijri-parts">
                            <select
                                data-hijri-part="day"
                                data-date-key="${key}"
                            >
                                ${hijriDayOptions(hijri?.day||'')}
                            </select>

                            <select
                                data-hijri-part="month"
                                data-date-key="${key}"
                            >
                                ${hijriMonthOptions(hijri?.month||'')}
                            </select>

                            <input
                                type="number"
                                min="1300"
                                max="1500"
                                step="1"
                                inputmode="numeric"
                                placeholder="السنة"
                                value="${hijri?.year||''}"
                                data-hijri-part="year"
                                data-date-key="${key}"
                            >
                        </div>

                        <div
                            class="${ID}-date-preview"
                            data-date-preview="${key}"
                        >
                            ${hijri
                                ? `الهجري في فارس: <b>${esc(hijriString(hijri))} هـ</b>`
                                : 'اختر اليوم والشهر والسنة الهجرية.'}
                        </div>
                    </div>

                    <div
                        class="${ID}-datepanel"
                        data-cal-panel="gregorian"
                        hidden
                    >
                        <input
                            type="date"
                            data-gregorian-date="${key}"
                        >

                        <div
                            class="${ID}-date-preview"
                            data-greg-preview="${key}"
                        >
                            اختر التاريخ الميلادي؛ سيحوّله فارس+ إلى الهجري قبل الإرسال.
                        </div>
                    </div>
                </div>
            `;
        }

        function dateBox(key){
            return byId(`${ID}-editor`)
                ?.querySelector(`[data-datebox="${key}"]`) || null;
        }

        function hiddenDateInput(key){
            return dateBox(key)
                ?.querySelector(`[data-f="${key}"]`) || null;
        }

        function hijriPartsFromBox(key){
            const box=dateBox(key);
            if(!box) return null;

            const get=part=>Number(
                latinDigits(
                    box.querySelector(
                        `[data-hijri-part="${part}"]`
                    )?.value || ''
                )
            );

            const result={
                day:get('day'),
                month:get('month'),
                year:get('year')
            };

            return (
                result.day &&
                result.month &&
                result.year
            ) ? result : null;
        }

        function setHijriPartsInBox(key,parts){
            const box=dateBox(key);
            if(!box || !parts) return;

            const day=box.querySelector('[data-hijri-part="day"]');
            const month=box.querySelector('[data-hijri-part="month"]');
            const year=box.querySelector('[data-hijri-part="year"]');

            if(day) day.value=String(parts.day);
            if(month) month.value=String(parts.month);
            if(year) year.value=String(parts.year);
        }

        function setDateMode(key,mode){
            const box=dateBox(key);
            if(!box) return;

            box.querySelectorAll('[data-cal-mode]').forEach(btn=>{
                btn.classList.toggle(
                    'active',
                    btn.dataset.calMode===mode
                );
            });

            box.querySelectorAll('[data-cal-panel]').forEach(panel=>{
                panel.hidden=panel.dataset.calPanel!==mode;
            });

            if(mode==='gregorian'){
                const hidden=parseNumericDate(
                    hiddenDateInput(key)?.value||''
                );

                const greg=
                    hidden && hidden.year<1700
                        ? hijriToGregorian(hidden)
                        : null;

                const input=box.querySelector(
                    `[data-gregorian-date="${key}"]`
                );

                if(input && greg){
                    input.value=isoFromGregorianDate(greg);
                }

                refreshGregorianDatePreview(key);
            }else{
                const current=parseNumericDate(
                    hiddenDateInput(key)?.value||''
                );

                if(current && current.year<1700){
                    setHijriPartsInBox(key,current);
                }

                refreshHijriDate(key);
            }
        }

        function refreshHijriDate(key){
            const box=dateBox(key);
            if(!box) return;

            const hidden=hiddenDateInput(key);
            const preview=box.querySelector(
                `[data-date-preview="${key}"]`
            );

            const parts=hijriPartsFromBox(key);

            if(!parts){
                if(hidden) hidden.value='';

                if(preview){
                    preview.textContent=
                        'اختر اليوم والشهر والسنة الهجرية.';
                }

                return;
            }

            const greg=hijriToGregorian(parts);

            if(!greg){
                if(hidden) hidden.value='';

                if(preview){
                    preview.innerHTML=
                        '<span class="bad">هذا اليوم غير صالح في تقويم أم القرى أو تعذر تحويله.</span>';
                }

                return;
            }

            const value=hijriString(parts);

            if(hidden) hidden.value=value;

            if(preview){
                preview.innerHTML=
                    `سيُرسل إلى فارس: <b>${esc(value)} هـ</b>` +
                    ` <span>· الموافق ${esc(gregorianDisplay(greg))} م</span>`;
            }
        }

        function refreshGregorianDatePreview(key){
            const box=dateBox(key);
            if(!box) return;

            const input=box.querySelector(
                `[data-gregorian-date="${key}"]`
            );

            const preview=box.querySelector(
                `[data-greg-preview="${key}"]`
            );

            const hidden=hiddenDateInput(key);

            if(!input?.value){
                if(preview){
                    preview.textContent=
                        'اختر التاريخ الميلادي؛ سيحوّله فارس+ إلى الهجري قبل الإرسال.';
                }

                return;
            }

            const hijri=gregorianIsoToHijri(input.value);

            if(!hijri){
                if(hidden) hidden.value='';

                if(preview){
                    preview.innerHTML=
                        '<span class="bad">تعذر تحويل التاريخ إلى الهجري في هذا المتصفح.</span>';
                }

                return;
            }

            const value=hijriString(hijri);

            if(hidden) hidden.value=value;

            setHijriPartsInBox(key,hijri);

            if(preview){
                preview.innerHTML=
                    `الميلادي: <b>${esc(input.value)} م</b>` +
                    ` · سيُرسل إلى فارس: <b>${esc(value)} هـ</b>`;
            }
        }

        function initDateWidgets(root){
            root?.querySelectorAll('[data-datebox]').forEach(box=>{
                refreshHijriDate(box.dataset.datebox);
            });
        }

        function editor(){
            let e=byId(`${ID}-editor`);

            if(e) return e;

            e=document.createElement('div');
            e.id=`${ID}-editor`;

            e.addEventListener('click',async ev=>{
                const btn=ev.target.closest('[data-ed]');
                const a=btn?.dataset.ed;

                if(!a) return;

                ev.preventDefault();
                ev.stopPropagation();

                if(a==='close') return closeEditor();
                if(a==='save') return saveEditor(false);
                if(a==='save-page') return saveEditor(true);
                if(a==='save-draft') return saveEditorAsDraft();
                if(a==='save-template') return saveEditorAsTemplate();
                if(a==='discard-stuck') return discardStuckRow();
                if(a==='reload-stuck') return emergencyReloadDiscard();
            });

            e.addEventListener('click',ev=>{
                const modeButton=ev.target.closest('[data-cal-mode]');
                if(!modeButton) return;

                ev.preventDefault();
                ev.stopPropagation();

                setDateMode(
                    modeButton.dataset.dateKey,
                    modeButton.dataset.calMode
                );
            });

            e.addEventListener('change',ev=>{
                const hijriPart=ev.target.closest?.('[data-hijri-part]');

                if(hijriPart){
                    refreshHijriDate(hijriPart.dataset.dateKey);
                    return;
                }

                const greg=ev.target.closest?.('[data-gregorian-date]');

                if(greg){
                    refreshGregorianDatePreview(
                        greg.dataset.gregorianDate
                    );
                }
            });

            e.addEventListener('input',ev=>{
                const year=ev.target.closest?.(
                    '[data-hijri-part="year"]'
                );

                if(year){
                    refreshHijriDate(year.dataset.dateKey);
                }
            });

            document.body.appendChild(e);
            return e;
        }

        function editorTemplates(){
            return {
                location:templateControl('location'),
                role:templateControl('role'),
                type:templateControl('type'),
                durationType:templateControl('durationType'),
                duration:templateControl('duration')
            };
        }

        function openDraftEditor(mode,a){
            pd.editorIndex=null;
            pd.editorMode=mode;
            pd.editorActivity=a||null;
            pd.editorBusy=false;

            const e=editor();
            const t=editorTemplates();

            if(!t.location || !t.role || !t.type || !t.durationType || !t.duration){
                toast('لم أستطع قراءة قوائم فارس اللازمة لبناء نموذج الإضافة.','error');
                return;
            }

            const isLocalDraft=mode==='local-draft';
            const isAdd=mode==='draft-add'||isLocalDraft;

            const values=isAdd
                ? {
                    name:a?.name||'',
                    location:a?.location||'',
                    startDate:a?.startDate||'',
                    endDate:a?.endDate||'',
                    role:a?.role||'',
                    type:a?.type||'',
                    durationType:a?.durationType||'',
                    duration:a?.duration||''
                }
                : {
                    name:a?.name||'',
                    location:a?.location||'',
                    startDate:a?.startDate||'',
                    endDate:a?.endDate||'',
                    role:a?.role||'',
                    type:a?.type||'',
                    durationType:a?.durationType||'',
                    duration:a?.duration||''
                };

            e.innerHTML=`
                <div class="${ID}-edback"></div>
                <section>
                    <header>
                        <div>
                            <small>${isLocalDraft?'مسودة محلية — لا تغيير في فارس':isAdd?'إضافة آمنة — بدون إنشاء سطر مسبقًا':`تعديل آمن للنشاط #${a?.globalIndex||''}`}</small>
                            <h3>${isLocalDraft?'تعديل المسودة':isAdd?'إضافة نشاط تطوير مهني':'تعديل نشاط التطوير المهني'}</h3>
                        </div>
                        <button type="button" class="icon" data-ed="close">×</button>
                    </header>

                    <div class="${ID}-draft-safe">
                        <b>${isLocalDraft?'هذه مسودة محلية؛ لن يُلمس فارس.':'لن ينشئ فارس+ أي سطر داخل فارس الآن.'}</b>
                        <span>
                            أكمل البيانات هنا أولًا. إذا أغلقت هذه النافذة فلن يتغير شيء في فارس.
                            السطر الأصلي لا يُنشأ أو يُفتح للتحرير إلا بعد اعتمادك.
                            التاريخ الهجري هو الافتراضي لأنه يطابق القيم الظاهرة في فارس، ويمكن اختيار ميلادي ليحوّله فارس+ إلى هجري قبل الإرسال.
                        </span>
                    </div>

                    <div class="${ID}-edgrid">
                        <label class="wide">
                            <span>اسم النشاط *</span>
                            <input data-f="name" value="${esc(values.name)}" autocomplete="off">
                        </label>

                        <label class="wide">
                            <span>الجهة *</span>
                            <select data-f="location">
                                ${selectOptions(t.location,{text:values.location,placeholder:'اختر الجهة'})}
                            </select>
                        </label>

                        ${dateWidgetHtml('startDate','تاريخ البداية',values.startDate)}
                        ${dateWidgetHtml('endDate','تاريخ النهاية',values.endDate)}

                        <label>
                            <span>منفذ أم مستفيد *</span>
                            <select data-f="role">
                                ${selectOptions(t.role,{text:values.role,placeholder:'اختر الدور'})}
                            </select>
                        </label>

                        <label>
                            <span>نوع النشاط *</span>
                            <select data-f="type">
                                ${selectOptions(t.type,{text:values.type,placeholder:'اختر نوع النشاط'})}
                            </select>
                        </label>

                        <label>
                            <span>نوع المدة *</span>
                            <select data-f="durationType">
                                ${selectOptions(t.durationType,{text:values.durationType,placeholder:'اختر نوع المدة',dropBlank:true})}
                            </select>
                        </label>

                        <label>
                            <span>مدة النشاط *</span>
                            <select data-f="duration">
                                ${selectOptions(t.duration,{text:values.duration,placeholder:'اختر مدة النشاط',dropBlank:true})}
                            </select>
                        </label>
                    </div>

                    <div id="${ID}-edmessage" class="${ID}-edmessage"></div>

                    <div class="${ID}-ednote">
                        ${isAdd
                            ? 'بعد اعتمادك فقط: فارس+ يستدعي «إضافة» الأصلي، يملأ السطر، ثم يعتمد السجل عبر «حفظ» فارس.'
                            : 'بعد اعتمادك فقط: فارس+ ينتقل إلى السجل، يفتح «تحديث» الأصلي، يطبق القيم ثم يعتمد التحديث.'}
                    </div>

                    <footer>
                        <button type="button" data-ed="close">إلغاء بدون أي تغيير</button>
                        <button type="button" data-ed="save-draft">💾 حفظ كمسودة</button>
                        <button type="button" data-ed="save-template">☆ حفظ كقالب</button>
                        <button type="button" class="primary" data-ed="save">
                            ${isLocalDraft?'حفظ تعديلات المسودة':isAdd?'إضافة النشاط إلى فارس':'تحديث النشاط في فارس'}
                        </button>
                        ${isLocalDraft?'':`<button type="button" class="${ID}-savepage" data-ed="save-page">${isAdd?'إضافة وحفظ':'تحديث ثم حفظ الصفحة'}</button>`}
                    </footer>
                </section>
            `;

            neutralizeUiButtons(e);

            e.querySelector(`.${ID}-edback`).onclick=ev=>{
                ev.preventDefault();
                ev.stopPropagation();
                closeEditor();
            };

            e.classList.add('open');
            initDateWidgets(e);

            setTimeout(()=>{
                e.querySelector('[data-f="name"]')?.focus();
            },80);
        }

        function openStuckRecovery(info){
            const e=editor();

            pd.editorMode='stuck';
            pd.editorIndex=info.index;
            pd.editorActivity=null;
            pd.editorBusy=false;

            const canDelete=likelyTransientNewRow(info.index);

            const labels={
                name:'اسم النشاط',
                location:'الجهة',
                startDate:'تاريخ البداية',
                endDate:'تاريخ النهاية',
                role:'منفذ أم مستفيد',
                type:'نوع النشاط',
                durationType:'نوع المدة',
                duration:'مدة النشاط'
            };

            e.innerHTML=`
                <div class="${ID}-edback"></div>
                <section>
                    <header>
                        <div>
                            <small>استعادة آمنة</small>
                            <h3>يوجد سطر غير مكتمل داخل فارس</h3>
                        </div>
                        <button type="button" class="icon" data-ed="close">×</button>
                    </header>

                    <div class="${ID}-stuck">
                        <b>لن أطلب منك إدخال بيانات وهمية حتى يسمح فارس بالخروج.</b>

                        <p>
                            الصف الحالي ناقص في:
                            <strong>${esc(info.missing.map(k=>labels[k]||k).join('، '))}</strong>.
                            لذلك قد يعرض فارس رسالة «فشل تدقيق النموذج» عند الحفظ أو الرجوع.
                        </p>

                        ${canDelete
                            ? `<div class="${ID}-recovery-ok">
                                تم اعتماد طريقة الاستعادة الصحيحة لفارس:
                                <b>تفريغ جميع الحقول الظاهرة في السطر ← حذف السطر الأصلي ← حفظ الصفحة.</b>
                                لن يلمس فارس+ أي حقل مخفي أو سجل آخر.
                               </div>`
                            : `<div class="${ID}-recovery-warn">
                                لا أستطيع الجزم أن هذا الصف جديد؛ لذلك لن أحذفه تلقائيًا حمايةً لبياناتك.
                               </div>`}
                    </div>

                    <footer>
                        <button type="button" data-ed="close">إغلاق</button>

                        ${canDelete
                            ? `<button type="button" class="danger" data-ed="discard-stuck">
                                تنظيف السطر ثم حذفه وحفظ الصفحة
                               </button>`
                            : ''}

                        <button type="button" class="${ID}-reload" data-ed="reload-stuck">
                            إعادة تحميل الصفحة والتراجع عن غير المحفوظ
                        </button>
                    </footer>
                </section>
            `;

            neutralizeUiButtons(e);

            e.querySelector(`.${ID}-edback`).onclick=ev=>{
                ev.preventDefault();
                ev.stopPropagation();
                closeEditor();
            };

            e.classList.add('open');
        }

        function closeEditor(force=false){
            if(pd.editorBusy && !force){
                toast('جاري تنفيذ العملية في فارس؛ انتظر اكتمالها.','error');
                return;
            }

            byId(`${ID}-editor`)?.classList.remove('open');

            pd.editorIndex=null;
            pd.editorMode=null;
            pd.editorActivity=null;
            pd.editorBusy=false;
            pd.pendingCertificateId=null;
        }

        function editorMessage(message,type='info'){
            const el=byId(`${ID}-edmessage`);
            if(!el) return;

            el.className=`${ID}-edmessage ${type}`;
            el.textContent=message||'';
        }

        function setEditorBusy(busy,message=''){
            pd.editorBusy=!!busy;

            const e=byId(`${ID}-editor`);
            if(!e) return;

            e.querySelectorAll('button,[data-f]').forEach(el=>{
                el.disabled=!!busy;
            });

            if(message) editorMessage(message,'busy');
        }

        function readEditorValues(){
            const e=byId(`${ID}-editor`);
            const v={};

            e?.querySelectorAll('[data-f]').forEach(x=>{
                const key=x.dataset.f;

                if(
                    x.tagName==='SELECT' &&
                    [
                        'location',
                        'role',
                        'type',
                        'durationType',
                        'duration'
                    ].includes(key)
                ){
                    const selected=
                        x.options?.[x.selectedIndex]||null;

                    v[key]=clean(
                        selected?.textContent||
                        x.value||
                        ''
                    );
                }else{
                    v[key]=x.value;
                }
            });

            return v;
        }

        function validateEditorValues(v){
            const required=[
                ['name','اسم النشاط'],
                ['location','الجهة'],
                ['startDate','تاريخ البداية'],
                ['endDate','تاريخ النهاية'],
                ['role','منفذ أم مستفيد'],
                ['type','نوع النشاط'],
                ['durationType','نوع المدة'],
                ['duration','مدة النشاط']
            ];

            const missing=required
                .filter(([key])=>!clean(v[key]))
                .map(([,label])=>label);

            if(missing.length){
                return `أكمل الحقول التالية أولًا: ${missing.join('، ')}.`;
            }

            const start=dateKey(v.startDate);
            const end=dateKey(v.endDate);

            if(!start){
                return 'تاريخ البداية غير مكتمل. اختره من مكوّن التاريخ الهجري أو الميلادي.';
            }

            if(!end){
                return 'تاريخ النهاية غير مكتمل. اختره من مكوّن التاريخ الهجري أو الميلادي.';
            }

            if((start.year<1500)!==(end.year<1500)){
                return 'فارس+ يرسل التاريخين إلى فارس بصيغة هجرية في هذه الصفحة؛ راجع التاريخين.';
            }

            if(start.year>=1700 || end.year>=1700){
                return 'قيمة التاريخ المرسلة إلى فارس يجب أن تكون هجرية في هذه الصفحة.';
            }

            if(end.key<start.key){
                return 'تاريخ النهاية يسبق تاريخ البداية.';
            }

            return '';
        }

        function nativeComparable(value){
            return clean(String(value??''))
                .normalize('NFKC')
                .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g,'')
                .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g,'')
                .replace(/[‐‑‒–—―−]/g,'-')
                .replace(/[أإآٱ]/g,'ا')
                .replace(/ى/g,'ي')
                .replace(/ة/g,'ه')
                .replace(/[٠-٩]/g,d=>'0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)])
                .replace(/[۰-۹]/g,d=>'0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(d)])
                .replace(/\s*-\s*/g,' - ')
                .replace(/\s+/g,' ')
                .trim()
                .toLowerCase();
        }

        function resolveNativeOption(
            select,
            raw,
            key=''
        ){
            if(
                !select ||
                select.tagName!=='SELECT'
            ){
                return null;
            }

            const wanted=
                String(raw??'');

            const wantedNorm=
                nativeComparable(wanted);

            const options=[
                ...select.options
            ];

            // 1) القيمة الحالية نفسها.
            let option=
                options.find(
                    o=>
                        String(o.value)===
                        wanted
                );

            if(option) return option;

            // 2) النص الظاهر نفسه.
            option=
                options.find(
                    o=>
                        nativeComparable(
                            nativeOptionText(o)
                        )===
                        wantedNorm
                );

            if(option) return option;

            // 3) القيمة بعد التطبيع.
            option=
                options.find(
                    o=>
                        nativeComparable(
                            o.value
                        )===
                        wantedNorm
                );

            if(option) return option;

            /*
             * 4) قيمة قديمة من جلسة Oracle سابقة:
             * نترجمها إلى النص الظاهر باستخدام SELECT آخر لنفس الحقل.
             */
            if(key){
                const legacyText=
                    legacyOptionText(
                        key,
                        wanted
                    );

                if(legacyText){
                    const legacyNorm=
                        nativeComparable(
                            legacyText
                        );

                    option=
                        options.find(
                            o=>
                                nativeComparable(
                                    nativeOptionText(o)
                                )===
                                legacyNorm
                        );

                    if(option){
                        return option;
                    }
                }
            }

            // 5) مطابقة جزئية محافظة.
            if(wantedNorm.length>=3){
                const partial=
                    options.filter(o=>{
                        const t=
                            nativeComparable(
                                nativeOptionText(o)
                            );

                        return (
                            t &&
                            (
                                t.includes(
                                    wantedNorm
                                ) ||
                                wantedNorm.includes(
                                    t
                                )
                            )
                        );
                    });

                if(partial.length===1){
                    return partial[0];
                }
            }

            return null;
        }

        function setNativeElementValue(el,value){
            if(!el) return false;

            try{
                const proto=
                    el.tagName==='SELECT'
                        ? HTMLSelectElement.prototype
                        : el.tagName==='TEXTAREA'
                            ? HTMLTextAreaElement.prototype
                            : HTMLInputElement.prototype;

                const setter=
                    Object.getOwnPropertyDescriptor(proto,'value')?.set;

                if(setter) setter.call(el,value);
                else el.value=value;
            }catch(_){
                try{el.value=value;}catch(__){return false;}
            }

            try{
                el.dispatchEvent(new Event('input',{bubbles:true}));
                el.dispatchEvent(new Event('change',{bubbles:true}));
                el.dispatchEvent(new Event('blur',{bubbles:true}));
            }catch(_){}

            return true;
        }

        function nativeValue(el,raw,key=''){
            if(!el) return {ok:false,reason:'missing'};

            if(el.tagName==='SELECT'){
                const option=resolveNativeOption(el,raw,key);

                if(!option){
                    return {
                        ok:false,
                        reason:'option',
                        expected:String(raw??'')
                    };
                }

                setNativeElementValue(el,option.value);

                const selected=
                    el.options?.[el.selectedIndex]||null;

                return {
                    ok:
                        String(el.value)===String(option.value) &&
                        !!selected,
                    expected:String(raw??''),
                    appliedValue:String(option.value),
                    appliedText:nativeOptionText(option)
                };
            }

            setNativeElementValue(el,String(raw??''));

            return {
                ok:nativeComparable(el.value)===nativeComparable(raw),
                expected:String(raw??''),
                appliedValue:String(el.value??'')
            };
        }

        function nativeFieldMatches(
            key,
            el,
            raw
        ){
            if(!el) return false;

            if(el.tagName==='SELECT'){
                const selected=
                    el.options?.[
                        el.selectedIndex
                    ]||null;

                if(!selected){
                    return false;
                }

                const expected=
                    resolveNativeOption(
                        el,
                        raw,
                        key
                    );

                if(expected){
                    return (
                        String(el.value)===
                            String(expected.value) ||
                        nativeComparable(
                            nativeOptionText(selected)
                        )===
                        nativeComparable(
                            nativeOptionText(expected)
                        )
                    );
                }

                const wanted=
                    nativeComparable(raw);

                return (
                    nativeComparable(
                        el.value
                    )===wanted ||
                    nativeComparable(
                        nativeOptionText(selected)
                    )===wanted ||
                    nativeComparable(
                        selected.value
                    )===wanted
                );
            }

            return (
                nativeComparable(
                    el.value
                )===
                nativeComparable(raw)
            );
        }

        function nativeRowSnapshot(i){
            const result={};

            for(const key of Object.keys(FIELDS)){
                const el=control(key,i);

                result[key]={
                    value:clean(el?.value||''),
                    text:valueText(el),
                    disabled:!!el?.disabled
                };
            }

            return result;
        }

        function nativeSelectOptionsSnapshot(i,key){
            const el=control(key,i);

            if(!el || el.tagName!=='SELECT'){
                return [];
            }

            return [...el.options]
                .map((o,index)=>({
                    index,
                    text:nativeOptionText(o),
                    value:String(o.value??''),
                    selected:!!o.selected
                }))
                .slice(0,80);
        }

        async function waitRowLeavesEditMode(i,timeout=3600){
            const started=Date.now();

            while(Date.now()-started<timeout){
                const name=control('name',i);

                if(!name || name.disabled) return true;

                await wait(120);
            }

            const name=control('name',i);
            return !name || name.disabled;
        }

        async function waitOracleSelectPpr(fieldId,oldNode,timeout=4300){
            const started=Date.now();
            let replaced=false;
            let stable=0;
            let last='';

            while(Date.now()-started<timeout){
                const current=byId(fieldId);

                if(current && current!==oldNode){
                    replaced=true;
                }

                const iframe=byId('_pprIFrame');
                let ready=true;

                try{
                    ready=
                        !iframe ||
                        !iframe.contentDocument ||
                        iframe.contentDocument.readyState==='complete';
                }catch(_){
                    ready=true;
                }

                const state=[
                    current===oldNode?'same':'new',
                    current?.value||'',
                    current?.disabled?'1':'0'
                ].join('|');

                if(state===last){
                    stable++;
                }else{
                    stable=0;
                    last=state;
                }

                // التجربة الحية أثبتت أن SELECT في OAF يعيد بناء العقدة بعد
                // change/PPR. ننتظر الاستبدال + استقرار قراءتين قبل المتابعة.
                if(replaced && ready && stable>=1){
                    await wait(120);
                    return true;
                }

                await wait(90);
            }

            // بعض القوائم قد لا تعيد بناء العقدة في جميع جلسات Oracle.
            // إذا بقيت العقدة متصلة وقيمتها موجودة نسمح بالتحقق النهائي.
            const current=byId(fieldId);

            return !!(
                current &&
                current.isConnected &&
                clean(current.value)
            );
        }

        function setNativeSelectWithoutInput(el,raw,key=''){
            if(!el || el.tagName!=='SELECT'){
                return {ok:false,reason:'not-select'};
            }

            const option=resolveNativeOption(el,raw,key);

            if(!option){
                return {
                    ok:false,
                    reason:'option',
                    expected:String(raw??'')
                };
            }

            try{
                const setter=
                    Object.getOwnPropertyDescriptor(
                        HTMLSelectElement.prototype,
                        'value'
                    )?.set;

                if(setter) setter.call(el,option.value);
                else el.value=option.value;
            }catch(_){
                el.value=option.value;
            }

            /*
             * مهم في Oracle OAF:
             * لا نطلق change/input/blur هنا.
             *
             * فحصنا الحي أثبت أن change على قوائم صف الإضافة يمكن أن
             * يؤدي إلى postback/reload قبل اكتمال تعبئة بقية الحقول.
             * القيمة المحددة ستدخل ضمن نموذج DefaultFormName عند الضغط
             * على زر "تحديث" الأصلي، لذلك نكتفي بضبط value في DOM.
             */
            return {
                ok:String(el.value)===String(option.value),
                appliedValue:String(option.value),
                appliedText:nativeOptionText(option)
            };
        }

        function setNativeTextOnly(el,raw){
            if(!el || el.tagName==='SELECT'){
                return {ok:false,reason:'not-text'};
            }

            const value=String(raw??'');

            try{
                const proto=
                    el.tagName==='TEXTAREA'
                        ? HTMLTextAreaElement.prototype
                        : HTMLInputElement.prototype;

                const setter=
                    Object.getOwnPropertyDescriptor(
                        proto,
                        'value'
                    )?.set;

                if(setter) setter.call(el,value);
                else el.value=value;
            }catch(_){
                el.value=value;
            }

            // لا نطلق أي حدث اصطناعي؛ زر تحديث فارس الأصلي سيرسل النموذج.
            return {
                ok:nativeComparable(el.value)===nativeComparable(value),
                appliedValue:String(el.value??'')
            };
        }

        function nativeSelectHasRealOptions(i,key,minOptions=2){
            const el=control(key,i);

            return !!(
                el &&
                el.tagName==='SELECT' &&
                el.options &&
                el.options.length>=minOptions
            );
        }

        async function waitForNativeSelectOptions(
            i,
            key,
            timeout=3600,
            minOptions=2
        ){
            const started=Date.now();

            while(Date.now()-started<timeout){
                if(
                    nativeSelectHasRealOptions(
                        i,
                        key,
                        minOptions
                    )
                ){
                    return true;
                }

                await wait(120);
            }

            return nativeSelectHasRealOptions(
                i,
                key,
                minOptions
            );
        }

        function setSelectAndDispatchChange(
            i,
            key,
            raw
        ){
            const el=control(key,i);

            if(!el || el.tagName!=='SELECT'){
                return {
                    ok:false,
                    reason:'not-select'
                };
            }

            const option=
                resolveNativeOption(
                    el,
                    raw,
                    key
                );

            if(!option){
                return {
                    ok:false,
                    reason:'option'
                };
            }

            try{
                const setter=
                    Object.getOwnPropertyDescriptor(
                        HTMLSelectElement.prototype,
                        'value'
                    )?.set;

                if(setter){
                    setter.call(
                        el,
                        option.value
                    );
                }else{
                    el.value=
                        option.value;
                }
            }catch(_){
                el.value=
                    option.value;
            }

            try{
                el.dispatchEvent(
                    new Event(
                        'change',
                        {
                            bubbles:true
                        }
                    )
                );
            }catch(_){}

            return {
                ok:true,
                value:
                    String(
                        option.value
                    ),
                text:
                    nativeOptionText(
                        option
                    )
            };
        }

        async function ensureTrainingTypeOptions(
            tx,
            i,
            draft
        ){
            if(
                await waitForNativeSelectOptions(
                    i,
                    'type',
                    900,
                    2
                )
            ){

                return true;
            }

            /*
             * في صف الإضافة الجديد يعرض Oracle قائمة "نوع النشاط"
             * بخيار فارغ واحد فقط. التقرير الحي أثبت ذلك.
             *
             * اختيار "منفذ/مستفيد" يدويًا في فارس يشغّل OAF/PPR الذي
             * يبني قائمة نوع النشاط. لذلك ننفذ هذه الخطوة كمرحلة مستقلة
             * محفوظة قبل إطلاق change، حتى لو أعاد Oracle تحميل الصفحة.
             */
            tx.stage='await-type-options';
            tx.typeOptionTrigger='role';
            tx.rowIndex=i;

            saveCommitTransaction(
                tx
            );

            const result=
                setSelectAndDispatchChange(
                    i,
                    'role',
                    draft.role
                );


            if(!result.ok){
                pauseCommitTransaction(
                    tx,
                    'تعذر اختيار «منفذ/مستفيد» لتجهيز قائمة نوع النشاط. المسودة بقيت محفوظة.',
                    {
                        rowIndex:i,
                        role:
                            draft.role,
                        roleOptions:
                            nativeSelectOptionsSnapshot(
                                i,
                                'role'
                            )
                    }
                );

                return false;
            }

            setTimeout(
                ()=>{
                    resumeDraftCommitTransaction()
                        .catch(()=>{});
                },
                1200
            );

            return false;
        }

        async function populateNativeRow(i,v){
            const failures=[];

            /*
             * v1.0.7 — تعبئة ذرية للصف:
             * نضبط جميع القيم الظاهرة مباشرة بدون إطلاق change/input/blur.
             * بعدها نتحقق من الثمانية حقول ثم نضغط زر "تحديث" الأصلي.
             *
             * السبب: Oracle OAF قد ينفذ postback/reload عند synthetic change
             * على SELECT، وهذا كان يقطع دالة الاعتماد ويترك صفًا فارغًا.
             */
            for(const key of Object.keys(FIELDS)){
                const el=control(key,i);

                if(!el){
                    failures.push(`${key}: الحقل غير موجود`);
                    continue;
                }

                if(el.disabled){
                    failures.push(`${key}: الحقل غير قابل للتحرير`);
                    continue;
                }

                const result=
                    el.tagName==='SELECT'
                        ? setNativeSelectWithoutInput(
                            el,
                            v[key]??'',
                            key
                        )
                        : setNativeTextOnly(
                            el,
                            v[key]??''
                        );

                if(!result.ok){
                    failures.push(
                        result.reason==='option'
                            ? `${key}: لم أجد في قائمة فارس قيمة مطابقة لـ «${String(v[key]??'')}»`
                            : `${key}: لم تثبت القيمة داخل الحقل`
                    );

                    if(result.reason==='option'){
                    }
                }
            }

            // نعطي المتصفح دورة رسم فقط؛ لا ننتظر PPR لأننا لم نطلقه.
            await wait(80);

            for(const key of Object.keys(FIELDS)){
                const el=control(key,i);

                if(!nativeFieldMatches(key,el,v[key]??'')){
                    const msg=
                        `${key}: القيمة النهائية لا تطابق المسودة`;

                    if(!failures.some(x=>x.startsWith(`${key}:`))){
                        failures.push(msg);
                    }
                }
            }

            if(failures.length){
                const err=new Error(
                    'لم أتمكن من تعبئة صف فارس بأمان: ' +
                    failures.join(' | ')
                );
                err.code='FARES_ROW_POPULATE_FAILED';
                err.rowIndex=i;
                err.snapshot=nativeRowSnapshot(i);
                throw err;
            }

            return nativeRowSnapshot(i);
        }

        function committedRowMatchesDraft(i,v){
            const name=control('name',i);
            const start=control('startDate',i);
            const end=control('endDate',i);

            return !!(
                name &&
                nativeComparable(name.value)===nativeComparable(v.name) &&
                nativeComparable(start?.value)===nativeComparable(v.startDate) &&
                nativeComparable(end?.value)===nativeComparable(v.endDate)
            );
        }

        async function verifyCommittedDraft(v,preferredIndex=null,timeout=3800){
            const started=Date.now();

            while(Date.now()-started<timeout){
                if(
                    preferredIndex!==null &&
                    committedRowMatchesDraft(preferredIndex,v)
                ){
                    return preferredIndex;
                }

                for(let i=0;i<30;i++){
                    if(committedRowMatchesDraft(i,v)){
                        return i;
                    }
                }

                await wait(140);
            }

            return null;
        }

        async function commitDraftAdd(v,savePage=false){
            if(editing()){
                const stuck=incompleteEditableRow();

                if(stuck) openStuckRecovery(stuck);
                else editorMessage('يوجد صف مفتوح للتحرير في فارس. أنهِه أولًا.','error');

                return false;
            }

            const button=byId('addTrainingBTN')||byId('addTrainingBTN_uixr');

            if(!button){
                editorMessage('لم أجد زر «إضافة» الأصلي في فارس.','error');
                return false;
            }

            setEditorBusy(true,'جاري إنشاء السطر بعد اكتمال البيانات...');

            try{
                const before=sig();

                button.click();

                await Promise.race([
                    waitChange(before,2600),
                    wait(700)
                ]);

                const i=await editable();

                if(i===null){
                    throw new Error('لم يظهر صف الإضافة القابل للتحرير.');
                }

                pd.editorIndex=i;

                await populateNativeRow(i,v);

                for(const key of Object.keys(FIELDS)){
                    if(
                        !nativeFieldMatches(
                            key,
                            control(key,i),
                            v[key]??''
                        )
                    ){
                        throw new Error(
                            `الحقل «${key}» لم يحتفظ بقيمته قبل الحفظ.`
                        );
                    }
                }

                editorMessage(
                    'تم نقل البيانات. جاري اعتماد السجل عبر «حفظ» فارس...',
                    'busy'
                );

                const save=
                    nativeSaveButton();

                if(!save){
                    throw new Error(
                        'لم أجد زر «حفظ» الأصلي في فارس.'
                    );
                }

                save.click();

                // قد يعيد Oracle تحميل الصفحة بالكامل بعد الحفظ.
                await wait(1100);

                closeEditor(true);
                invalidate();

                pd.activities=[];
                pd.analysis=null;

                toast(
                    'تمت تعبئة النشاط واستدعاء حفظ فارس.',
                    'success'
                );

                await scan(true);

                return true;

            }catch(err){
                console.error('[فارس+] إضافة النشاط',err);

                setEditorBusy(false);

                editorMessage(
                    `تعذر إكمال الإضافة: ${String(err?.message||err)}.`,
                    'error'
                );

                const stuck=incompleteEditableRow();

                if(stuck){
                    setTimeout(()=>openStuckRecovery(stuck),250);
                }

                return false;
            }
        }

        async function commitDraftEdit(a,v,savePage=false){
            if(!a) return false;

            if(editing()){
                const stuck=incompleteEditableRow();

                if(stuck) openStuckRecovery(stuck);
                else editorMessage('يوجد صف مفتوح للتحرير في فارس. أنهِه أولًا.','error');

                return false;
            }

            setEditorBusy(true,`جاري الانتقال إلى النشاط #${a.globalIndex}...`);

            try{
                if(!(await gotoPage(a.pageIndex))){
                    throw new Error('تعذر فتح صفحة النشاط.');
                }

                const act=action(a.rowIndex,'update');

                if(!act){
                    throw new Error('لم أجد أمر «تحديث» الأصلي للنشاط.');
                }

                const before=sig();
                act.click();

                await Promise.race([
                    waitChange(before,2200),
                    wait(600)
                ]);

                const i=await editable(a.rowIndex);

                if(i===null){
                    throw new Error('لم يدخل الصف الأصلي وضع التعديل.');
                }

                pd.editorIndex=i;

                await populateNativeRow(i,v);

                const update=action(i,'update');

                if(!update){
                    throw new Error('لم أجد زر اعتماد التحديث الأصلي.');
                }

                editorMessage('جاري اعتماد التعديل في فارس...','busy');

                const updateBefore=sig();
                update.click();

                await Promise.race([
                    waitChange(updateBefore,3200),
                    wait(900)
                ]);

                const accepted=await waitRowLeavesEditMode(i,3200);

                if(!accepted){
                    throw new Error('أبقى فارس السجل في وضع التحرير ولم يعتمد التحديث.');
                }

                if(savePage){
                    editorMessage('تم تحديث السجل. جاري حفظ الصفحة...','busy');
                    await wait(250);
                    await saveAll(true);
                    await wait(900);
                }

                closeEditor(true);
                invalidate();

                pd.activities=[];
                pd.analysis=null;

                toast(
                    savePage
                        ? 'تم تحديث النشاط واستدعاء حفظ فارس.'
                        : 'تم تحديث النشاط في فارس.',
                    'success'
                );

                await scan(true);

                return true;

            }catch(err){
                console.error('[فارس+] تعديل النشاط',err);

                setEditorBusy(false);

                editorMessage(
                    `تعذر إكمال التعديل: ${String(err?.message||err)}.`,
                    'error'
                );

                return false;
            }
        }

        async function saveEditor(savePage=false){
            if(pd.editorBusy) return;

            const v=readEditorValues();
            const problem=validateEditorValues(v);

            if(problem){
                editorMessage(problem,'error');
                return;
            }

            if(pd.editorMode==='draft-add'){
                return commitDraftAdd(v,savePage);
            }

            if(pd.editorMode==='draft-edit'){
                return commitDraftEdit(pd.editorActivity,v,savePage);
            }
            if(pd.editorMode==='local-draft'){
                const rows=loadDrafts();
                const idx=rows.findIndex(d=>d.id===pd.editorActivity?.id);
                if(idx>=0){rows[idx]={...rows[idx],...v,savedAt:Date.now()};saveDrafts(rows);}
                closeEditor(true);refresh();toast('تم تحديث المسودة.');
                return true;
            }
        }

        function saveEditorAsDraft(){
            const v=readEditorValues(),problem=validateEditorValues(v);
            if(problem){editorMessage(problem,'error');return;}
            if(pd.editorMode==='local-draft'){
                const rows=loadDrafts(),idx=rows.findIndex(d=>d.id===pd.editorActivity?.id);
                if(idx>=0){rows[idx]={...rows[idx],...v,savedAt:Date.now()};saveDrafts(rows);}
                closeEditor(true);refresh();toast('تم حفظ المسودة.');
                return;
            }
            const source=pd.pendingCertificateId?'certificate-review':(pd.editorMode==='draft-edit'?'copy-of-existing':'manual');
            addDraft(v,source);
            if(pd.pendingCertificateId){
                const reviewedId=pd.pendingCertificateId;
                pd.pendingCertificateId=null;
                pd.certificateResults=pd.certificateResults.filter(r=>r.id!==reviewedId);
            }
            closeEditor(true);
        }

        function saveEditorAsTemplate(){
            const v=readEditorValues();
            saveTemplate(v,v.name||'قالب نشاط');
        }

        function clearNativeEditableRow(i){
            const cleared=[];
            const failed=[];

            for(const key of Object.keys(FIELDS)){
                const el=control(key,i);

                if(!el || el.disabled){
                    continue;
                }

                // لا نتعامل إلا مع عناصر الإدخال الظاهرة الخاصة بالسطر.
                // لا نقرأ ولا نعدّل أي hidden field من Oracle.
                if(el.type==='hidden'){
                    continue;
                }

                let ok=false;

                try{
                    if(el.tagName==='SELECT'){
                        const blank=[...el.options].find(o=>
                            !clean(o.value) ||
                            !clean(o.textContent)
                        );

                        if(blank){
                            el.value=blank.value;
                        }else{
                            el.selectedIndex=-1;
                        }

                        el.dispatchEvent(
                            new Event('change',{bubbles:true})
                        );

                        ok=
                            el.selectedIndex===-1 ||
                            !clean(el.value) ||
                            !clean(
                                el.selectedOptions?.[0]
                                    ?.textContent||''
                            );
                    }else{
                        el.value='';

                        el.dispatchEvent(
                            new Event('input',{bubbles:true})
                        );
                        el.dispatchEvent(
                            new Event('change',{bubbles:true})
                        );

                        ok=!clean(el.value);
                    }
                }catch(_){
                    ok=false;
                }

                (ok?cleared:failed).push(key);
            }

            return {cleared,failed};
        }

        async function discardStuckRow(){
            const i=pd.editorIndex;

            if(i===null) return;

            if(!likelyTransientNewRow(i)){
                editorMessage(
                    'لم أستطع التحقق أن هذا صف إضافة جديد؛ لن أنفذ مسار التنظيف والحذف على سجل قائم.',
                    'error'
                );
                return;
            }

            if(!confirm(
                'سيطبق فارس+ طريقة الاستعادة المعتمدة لهذا الصف الجديد فقط:\n\n' +
                '1) تفريغ جميع الحقول الظاهرة في السطر.\n' +
                '2) الضغط على حذف الأصلي للسطر.\n' +
                '3) الضغط على حفظ الصفحة في فارس.\n\n' +
                'لن يتم تعديل أي حقل مخفي.\n\nمتابعة؟'
            )){
                return;
            }

            setEditorBusy(
                true,
                'جاري تفريغ الحقول الظاهرة في السطر...'
            );

            const result=clearNativeEditableRow(i);

            if(result.failed.length){
                setEditorBusy(false);

                editorMessage(
                    `تعذر تفريغ بعض الحقول الظاهرة (${result.failed.join('، ')}). لن أحذف السطر حتى لا نترك الصفحة في حالة غير متوقعة.`,
                    'error'
                );
                return;
            }

            await wait(180);

            const act=action(i,'delete');

            if(!act){
                setEditorBusy(false);

                editorMessage(
                    'تم تفريغ السطر، لكن لم أجد أمر الحذف الأصلي. لا تضف بيانات وهمية؛ يمكنك استخدام إعادة تحميل الصفحة للتراجع عن غير المحفوظ.',
                    'error'
                );
                return;
            }

            editorMessage(
                'تم تفريغ السطر. جاري استدعاء الحذف الأصلي...',
                'busy'
            );

            const before=sig();

            act.click();

            await Promise.race([
                waitChange(before,3200),
                wait(950)
            ]);

            // بعد PPR قد يتغير رقم الصف/البادئة، لذلك نتحقق من
            // عدم بقاء صف ناقص قابل للتحرير بدل الاعتماد على العنصر القديم.
            await wait(180);

            const still=incompleteEditableRow();

            if(still && likelyTransientNewRow(still.index)){
                setEditorBusy(false);

                editorMessage(
                    'فارس أبقى صف الإضافة في وضع التحرير بعد محاولة الحذف. لم أضع أي بيانات وهمية ولم أضغط حفظ.',
                    'error'
                );
                return;
            }

            editorMessage(
                'تم حذف السطر. جاري حفظ الصفحة في فارس...',
                'busy'
            );

            const saved=await saveAll(true);

            if(!saved){
                setEditorBusy(false);

                editorMessage(
                    'تم حذف السطر، لكن تعذر استدعاء زر حفظ فارس. اضغط «حفظ» الأصلي يدويًا.',
                    'error'
                );
                return;
            }

            await wait(650);

            closeEditor(true);
            invalidate();

            toast(
                'تم تنظيف السطر الناقص وحذفه وحفظ الصفحة.',
                'success'
            );

            // لا نجبر فهرسة كاملة إذا كان Oracle ما يزال في PPR.
            setTimeout(()=>{
                scan(true).catch(()=>{});
            },600);
        }

        function emergencyReloadDiscard(){
            const ok=confirm(
                'سيتم إعادة تحميل صفحة فارس والتراجع عن جميع التغييرات غير المحفوظة في هذه الصفحة، وليس السطر الحالي فقط.\n\nهل تريد المتابعة؟'
            );

            if(!ok) return;

            location.reload();
        }

        // حالة تشغيلية ضرورية لاستكمال الاعتماد بعد PPR/reload في Oracle.
        // لا تحفظ سجلات اختبار أو تقارير تشخيصية.
        const COMMIT_TX_KEY=
            `${META.id}-pd-commit-transaction-v1`;





        function loadCommitTransaction(){
            try{
                const tx=
                    JSON.parse(
                        sessionStorage.getItem(
                            COMMIT_TX_KEY
                        )||'null'
                    );

                return tx &&
                    typeof tx==='object'
                        ? tx
                        : null;
            }catch(_){
                return null;
            }
        }

        function saveCommitTransaction(tx){
            if(!tx){
                try{
                    sessionStorage.removeItem(
                        COMMIT_TX_KEY
                    );
                }catch(_){}

                return;
            }

            tx.updatedAt=Date.now();

            try{
                sessionStorage.setItem(
                    COMMIT_TX_KEY,
                    JSON.stringify(tx)
                );
            }catch(_){}
        }

        function clearCommitTransaction(){
            saveCommitTransaction(null);
        }

        function editableRowIndexes(){
            const indexes=[];

            for(let i=0;i<30;i++){
                const el=control('name',i);

                if(el && !el.disabled){
                    indexes.push(i);
                }
            }

            return indexes;
        }

        function visibleRowMissingFields(i){
            return Object.keys(FIELDS)
                .filter(
                    key=>
                        !clean(
                            valueText(
                                control(key,i)
                            )
                        )
                );
        }

        function isCompletelyEmptyEditableRow(i){
            const name=control('name',i);

            if(!name || name.disabled){
                return false;
            }

            return (
                visibleRowMissingFields(i).length===
                Object.keys(FIELDS).length
            );
        }

        async function waitForSingleEditableRow(
            preferred=null,
            timeout=4200
        ){
            const started=Date.now();

            while(
                Date.now()-started<
                timeout
            ){
                const indexes=
                    editableRowIndexes();

                if(
                    preferred!==null &&
                    indexes.includes(
                        preferred
                    )
                ){
                    return {
                        index:preferred,
                        all:indexes
                    };
                }

                if(indexes.length===1){
                    return {
                        index:indexes[0],
                        all:indexes
                    };
                }

                if(indexes.length>1){
                    return {
                        index:null,
                        all:indexes
                    };
                }

                await wait(100);
            }

            return {
                index:null,
                all:editableRowIndexes()
            };
        }

        function currentTransactionItem(tx){
            return tx?.items?.[tx.index]||null;
        }

        function transactionDraft(tx){
            return currentTransactionItem(tx)?.draft||null;
        }

        function rowCompatibleWithDraft(
            i,
            draft
        ){
            if(
                i===null ||
                i===undefined ||
                !draft
            ){
                return false;
            }

            for(
                const key of
                Object.keys(FIELDS)
            ){
                const el=
                    control(key,i);

                if(!el || el.disabled){
                    return false;
                }

                const current=
                    clean(
                        valueText(el)
                    );

                // الحقل الفارغ مسموح؛ سنكمله الآن.
                if(!current){
                    continue;
                }

                if(
                    !nativeFieldMatches(
                        key,
                        el,
                        draft[key]??''
                    )
                ){
                    return false;
                }
            }

            return true;
        }

        function pauseCommitTransaction(
            tx,
            message,
            data={}
        ){
            if(!tx) return;

            tx.pausedFromStage=
                tx.stage;

            tx.stage='paused';
            tx.pauseMessage=String(message||'');
            saveCommitTransaction(tx);


            toast(
                message,
                'error'
            );
        }

        function removeCommittedDraftOnly(id){
            const drafts=loadDrafts();
            const next=drafts.filter(
                d=>d.id!==id
            );

            saveDrafts(next);

            return drafts.length-next.length;
        }




        function nativeAddButton(){
            return (
                byId('addTrainingBTN') ||
                byId('addTrainingBTN_uixr')
            );
        }

        function nativeSaveButton(){
            return (
                byId('saveBTN') ||
                byId('saveBTN_uixr')
            );
        }

        function clickNativeAddForTransaction(tx){
            const button=nativeAddButton();

            if(!button){
                pauseCommitTransaction(
                    tx,
                    'لم أجد زر «إضافة» الأصلي في فارس.',
                    {stage:tx.stage}
                );

                return false;
            }

            tx.stage='await-add-row';
            tx.addRequestedAt=Date.now();
            tx.preAddEditableIndexes=
                editableRowIndexes();

            const pBeforeAdd=
                pager();

            tx.preAddPagerIndex=
                pBeforeAdd?.selectedIndex??null;

            tx.preAddPagerPages=
                pBeforeAdd?.options?.length||0;

            tx.preAddPageRange=
                pageRange();

            tx.preAddRowCount=
                rowCount();

            tx.targetAddPage=null;

            saveCommitTransaction(tx);


            button.click();

            /*
             * زر إضافة Oracle قد يعيد تحميل الصفحة كاملة.
             * لذلك لا نعتمد على استمرار هذه الدالة بعد click.
             * إذا بقيت الصفحة، نحاول الاستكمال بعد قليل.
             */
            setTimeout(
                ()=>{
                    resumeDraftCommitTransaction()
                        .catch(()=>{});
                },
                900
            );

            return true;
        }

        async function startDraftCommitTransaction(
            ids,
            mode='single'
        ){
            let existing=
                loadCommitTransaction();

            if(existing){
                if(existing.stage==='paused'){
                    const requested=
                        [...ids]
                            .map(String)
                            .sort()
                            .join('|');

                    const pending=
                        (existing.items||[])
                            .map(x=>String(x.id))
                            .sort()
                            .join('|');

                    const sameRequest=
                        requested===pending;

                    const draft=
                        transactionDraft(
                            existing
                        );

                    const canResumeOwnedRow=
                        sameRequest &&
                        existing.rowIndex!==null &&
                        existing.rowIndex!==undefined &&
                        !!control(
                            'name',
                            existing.rowIndex
                        ) &&
                        !control(
                            'name',
                            existing.rowIndex
                        ).disabled &&
                        rowCompatibleWithDraft(
                            existing.rowIndex,
                            draft
                        );

                    if(canResumeOwnedRow){
                        const resume=confirm(
                            'توجد محاولة سابقة متوقفة لهذه المسودة نفسها، والصف الحالي ما زال مرتبطًا بها.\n\n' +
                            'تم إصلاح مشكلة تحويل قيم القوائم القديمة إلى خيارات فارس الحالية.\n\n' +
                            'هل تريد استكمال الاعتماد من نفس الصف بدون حذف المسودة أو إعادة إدخالها؟'
                        );

                        if(!resume){
                            toast(
                                'أبقيت المحاولة السابقة متوقفة، ولم أحذف أي مسودة.',
                                'error'
                            );

                            return false;
                        }

                        existing.stage=
                            nativeSelectHasRealOptions(
                                existing.rowIndex,
                                'type',
                                2
                            )
                                ? 'await-add-row'
                                : 'await-type-options';

                        existing.pauseMessage='';
                        existing.pausedFromStage='';

                        if(
                            existing.stage===
                            'await-type-options' &&
                            !existing.typeOptionTrigger
                        ){
                            existing.typeOptionTrigger=
                                'role';
                        }

                        saveCommitTransaction(
                            existing
                        );


                        closeManager();

                        setTimeout(
                            ()=>{
                                resumeDraftCommitTransaction()
                                    .catch(()=>{});
                            },
                            80
                        );

                        return true;
                    }

                    const restart=confirm(
                        'توجد محاولة اعتماد سابقة متوقفة، لكن مسوداتك ما زالت محفوظة.\n\n' +
                        'هل تريد إلغاء حالة المحاولة السابقة فقط وبدء اعتماد جديد؟\n\n' +
                        'لن يتم حذف أي مسودة.'
                    );

                    if(!restart){
                        toast(
                            'أبقيت المحاولة السابقة معلقة. اضغط الاعتماد مرة أخرى عندما تريد استكمالها أو بدء محاولة جديدة.',
                            'error'
                        );

                        return false;
                    }


                    clearCommitTransaction();
                    existing=null;
                }else{
                    toast(
                        'توجد عملية اعتماد جارية بالفعل. انتظر اكتمالها قبل بدء اعتماد جديد.',
                        'error'
                    );

                    return false;
                }
            }

            const drafts=loadDrafts();
            const map=new Map(
                drafts.map(d=>[d.id,d])
            );

            const items=[];

            for(const id of ids){
                const draft=map.get(id);

                if(!draft) continue;

                items.push({
                    id,
                    draft:
                        canonicalizeDraftOptions(
                            draft
                        )
                });
            }

            if(!items.length){
                toast(
                    'لم أجد المسودات المطلوبة.',
                    'error'
                );

                return false;
            }

            const errors=
                validateImportRows(
                    items.map(x=>x.draft)
                );

            if(errors.length){
                toast(
                    `يوجد ${errors.length} خطأ في المسودات المطلوبة. راجعها أولًا.`,
                    'error'
                );

                return false;
            }

            const editableIndexes=
                editableRowIndexes();

            if(editableIndexes.length>1){
                toast(
                    'يوجد أكثر من صف مفتوح للتحرير في فارس. نظّف الصفوف الفارغة أولًا حتى لا نخاطر بتعبئة الصف الخطأ.',
                    'error'
                );

                return false;
            }

            let reuseExistingBlank=false;

            if(editableIndexes.length===1){
                const i=editableIndexes[0];
                const stuck=incompleteEditableRow();

                const completelyEmpty=
                    !!stuck &&
                    stuck.index===i &&
                    likelyTransientNewRow(i) &&
                    stuck.missing.length===
                        Object.keys(FIELDS).length;

                if(!completelyEmpty){
                    if(stuck){
                        openStuckRecovery(stuck);
                    }

                    toast(
                        'يوجد صف مفتوح في فارس يحتوي على بيانات أو حالة غير مؤكدة. لن أستخدمه تلقائيًا.',
                        'error'
                    );

                    return false;
                }

                reuseExistingBlank=true;
            }

            clearCommitDebug();

            const tx={
                version:1,
                mode,
                items,
                index:0,
                stage:'starting',
                startedAt:Date.now(),
                updatedAt:Date.now(),
                reuseExistingBlank,
                rowIndex:
                    reuseExistingBlank
                        ? editableIndexes[0]
                        : null
            };

            saveCommitTransaction(tx);


            closeManager();

            toast(
                reuseExistingBlank
                    ? 'سأستخدم صف الإضافة الفارغ الموجود وأكمل الاعتماد عبر مراحل فارس.'
                    : 'بدأ اعتماد المسودة عبر مراحل فارس. قد تعيد الصفحة التحميل أكثر من مرة.',
                'success'
            );

            if(reuseExistingBlank){
                tx.stage='await-add-row';
                tx.rowOwnership='existing-empty-row';
                tx.addRequestedAt=Date.now();
                tx.preAddEditableIndexes=[
                    tx.rowIndex
                ];

                saveCommitTransaction(tx);

                setTimeout(
                    ()=>{
                        resumeDraftCommitTransaction()
                            .catch(()=>{});
                    },
                    80
                );

                return true;
            }

            return clickNativeAddForTransaction(tx);
        }







        async function moveToNewRowPageAfterAdd(
            tx
        ){
            if(!tx) return false;

            const p=
                pager();

            if(
                !p ||
                !p.options?.length
            ){
                return false;
            }

            /*
             * فارس يعرض 10 أنشطة في الصفحة.
             * عند امتلاء الصفحة الحالية، "إضافة" قد ينشئ الصف الجديد
             * في الصفحة الأخيرة/الجديدة بدل الصفحة المعروضة.
             *
             * لذلك إذا لم نجد صفًا قابلًا للتحرير بعد Add، ننتقل
             * للصفحة الأخيرة فقط داخل transaction إضافة حديثة.
             */
            const target=
                Math.max(
                    0,
                    p.options.length-1
                );

            tx.targetAddPage=
                target;

            tx.stage=
                'await-add-row-page';

            saveCommitTransaction(
                tx
            );


            if(
                p.selectedIndex===
                target
            ){
                tx.stage=
                    'await-add-row';

                saveCommitTransaction(
                    tx
                );

                return false;
            }

            /*
             * نحفظ المرحلة قبل التنقل لأن Oracle قد ينفذ PPR أو reload.
             */
            const moved=
                await gotoPage(
                    target
                );


            setTimeout(
                ()=>{
                    resumeDraftCommitTransaction()
                        .catch(()=>{});
                },
                500
            );

            return true;
        }

        async function resumeDraftCommitTransaction(){
            if(pd.commitResuming){

                return false;
            }

            const tx=
                loadCommitTransaction();

            if(!tx){
                return false;
            }

            if(
                Date.now()-
                    Number(tx.startedAt||0)
                >
                30*60*1000
            ){
                pauseCommitTransaction(
                    tx,
                    'عملية اعتماد قديمة ما زالت معلقة. المسودات محفوظة؛ ألغِ العملية المعلقة ثم أعد المحاولة.',
                    {ageMs:Date.now()-Number(tx.startedAt||0)}
                );

                return false;
            }

            if(tx.stage==='paused'){
                toast(
                    tx.pauseMessage||
                    'عملية اعتماد المسودة متوقفة وتحتاج مراجعة.',
                    'error'
                );

                return false;
            }

            const item=
                currentTransactionItem(tx);

            if(item?.draft){
                item.draft=
                    canonicalizeDraftOptions(
                        item.draft
                    );

                saveCommitTransaction(
                    tx
                );
            }

            const draft=
                item?.draft;

            if(!item || !draft){
                pauseCommitTransaction(
                    tx,
                    'بيانات عملية الاعتماد المعلقة غير مكتملة. المسودات الأصلية لم تُحذف.'
                );

                return false;
            }

            pd.commitResuming=true;

            try{

                if(
                    tx.stage===
                    'await-add-row-page'
                ){
                    const p=
                        pager();

                    if(
                        !p ||
                        !p.options?.length
                    ){
                        pauseCommitTransaction(
                            tx,
                            'بعد «إضافة» لم أجد صفحات الأنشطة للبحث عن صف الإضافة الجديد. المسودة بقيت محفوظة.',
                            {}
                        );

                        return false;
                    }

                    const target=
                        Math.min(
                            Number(
                                tx.targetAddPage??
                                (
                                    p.options.length-1
                                )
                            ),
                            p.options.length-1
                        );

                    if(
                        p.selectedIndex!==
                        target
                    ){

                        await gotoPage(
                            target
                        );

                        setTimeout(
                            ()=>{
                                resumeDraftCommitTransaction()
                                    .catch(()=>{});
                            },
                            500
                        );

                        return true;
                    }


                    tx.stage=
                        'await-add-row';

                    saveCommitTransaction(
                        tx
                    );

                    setTimeout(
                        ()=>{
                            resumeDraftCommitTransaction()
                                .catch(()=>{});
                        },
                        120
                    );

                    return true;
                }

                if(tx.stage==='await-type-options'){
                    const found=
                        await waitForSingleEditableRow(
                            tx.rowIndex??null,
                            4200
                        );

                    const i=found.index;

                    if(i===null){
                        pauseCommitTransaction(
                            tx,
                            'بعد تجهيز «نوع النشاط» لم أجد صف الإضافة الوحيد القابل للتحرير. المسودة لم تُحذف.',
                            {
                                editableIndexes:
                                    [...found.all]
                            }
                        );

                        return false;
                    }

                    tx.rowIndex=i;

                    let ready=
                        await waitForNativeSelectOptions(
                            i,
                            'type',
                            3200,
                            2
                        );

                    if(!ready){
                        /*
                         * مسار احتياطي: بعض جلسات OAF تبني القوائم التابعة
                         * بعد تغيير الجهة بدل الدور.
                         */
                        if(
                            tx.typeOptionTrigger!==
                            'location'
                        ){
                            tx.typeOptionTrigger=
                                'location';

                            saveCommitTransaction(
                                tx
                            );

                            const locationResult=
                                setSelectAndDispatchChange(
                                    i,
                                    'location',
                                    draft.location
                                );


                            if(
                                !locationResult.ok
                            ){
                                pauseCommitTransaction(
                                    tx,
                                    'تعذر تجهيز قائمة «نوع النشاط» عبر الجهة أو الدور. المسودة بقيت محفوظة.',
                                    {
                                        rowIndex:i,
                                        typeOptions:
                                            nativeSelectOptionsSnapshot(
                                                i,
                                                'type'
                                            )
                                    }
                                );

                                return false;
                            }

                            setTimeout(
                                ()=>{
                                    resumeDraftCommitTransaction()
                                        .catch(()=>{});
                                },
                                1200
                            );

                            return true;
                        }

                        pauseCommitTransaction(
                            tx,
                            'فارس أبقى قائمة «نوع النشاط» فارغة حتى بعد تشغيل التحديثات التابعة. المسودة بقيت محفوظة.',
                            {
                                rowIndex:i,
                                typeOptions:
                                    nativeSelectOptionsSnapshot(
                                        i,
                                        'type'
                                    ),
                                roleOptions:
                                    nativeSelectOptionsSnapshot(
                                        i,
                                        'role'
                                    ),
                                locationOptions:
                                    nativeSelectOptionsSnapshot(
                                        i,
                                        'location'
                                    )
                            }
                        );

                        return false;
                    }


                    tx.stage='await-add-row';

                    saveCommitTransaction(
                        tx
                    );


                    setTimeout(
                        ()=>{
                            resumeDraftCommitTransaction()
                                .catch(err=>{
                                    console.error(
                                        '[فارس+] resume after type options',
                                        err
                                    );
                                });
                        },
                        90
                    );

                    return true;
                }

                if(tx.stage==='await-add-row'){
                    const found=
                        await waitForSingleEditableRow(
                            tx.rowIndex??null,
                            4200
                        );

                    const i=found.index;

                    if(i===null){
                        if(found.all.length>1){
                            pauseCommitTransaction(
                                tx,
                                'ظهر أكثر من صف قابل للتحرير بعد «إضافة». أوقفت العملية حتى لا أعبئ الصف الخطأ.',
                                {
                                    stage:tx.stage,
                                    editableIndexes:
                                        [...found.all]
                                }
                            );

                            return false;
                        }

                        const pNow=
                            pager();

                        const recentAdd=
                            Number(
                                tx.addRequestedAt||0
                            )>0 &&
                            Date.now()-
                                Number(
                                    tx.addRequestedAt
                                )<
                                45000;

                        const canSearchLastPage=
                            recentAdd &&
                            pNow &&
                            pNow.options?.length>1 &&
                            (
                                pNow.selectedIndex!==
                                pNow.options.length-1 ||
                                Number(
                                    tx.preAddRowCount||0
                                )>=10 ||
                                Number(
                                    tx.preAddPagerPages||0
                                )<
                                pNow.options.length
                            );

                        if(canSearchLastPage){
                            const moved=
                                await moveToNewRowPageAfterAdd(
                                    tx
                                );

                            if(moved){
                                return true;
                            }

                            /*
                             * إذا كنا بالفعل في الصفحة الأخيرة، نعيد
                             * فحصها مرة قصيرة لأن Oracle قد يكون ما زال
                             * يبني الصف بعد التنقل/الإضافة.
                             */
                            const retry=
                                await waitForSingleEditableRow(
                                    tx.rowIndex??null,
                                    1800
                                );

                            if(
                                retry.index!==null
                            ){
                                tx.stage=
                                    'await-add-row';

                                saveCommitTransaction(
                                    tx
                                );

                                setTimeout(
                                    ()=>{
                                        resumeDraftCommitTransaction()
                                            .catch(()=>{});
                                    },
                                    80
                                );

                                return true;
                            }
                        }

                        pauseCommitTransaction(
                            tx,
                            'فارس أنشأ مرحلة الإضافة لكن لم أجد صفًا قابلًا للتحرير في الصفحة الحالية أو الصفحة الأخيرة. أوقفت العملية ولم أحذف المسودة.',
                            {
                                stage:tx.stage,
                                editableIndexes:
                                    [...found.all],
                                pagerIndex:
                                    pager()?.selectedIndex??null,
                                pagerPages:
                                    pager()?.options?.length||0,
                                pageRange:
                                    pageRange(),
                                preAddPagerIndex:
                                    tx.preAddPagerIndex,
                                preAddPagerPages:
                                    tx.preAddPagerPages,
                                preAddPageRange:
                                    tx.preAddPageRange,
                                preAddRowCount:
                                    tx.preAddRowCount
                            }
                        );

                        return false;
                    }

                    const completelyEmpty=
                        isCompletelyEmptyEditableRow(
                            i
                        );

                    const compatibleOwnedPartial=
                        tx.rowIndex===i &&
                        !!tx.rowOwnership &&
                        rowCompatibleWithDraft(
                            i,
                            draft
                        );

                    /*
                     * v1.0.10:
                     * بعد الضغط على «إضافة» يقوم Oracle بإعادة تحميل OA.jsp.
                     * عند العودة قد تكون الحقول المخفية للصف الجديد ممتلئة أصلًا،
                     * ولذلك likelyTransientNewRow() وحدها لا تصلح لإثبات أنه صف جديد.
                     *
                     * الإثبات الأقوى هنا:
                     *  - نحن داخل transaction محفوظة في stage=await-add-row.
                     *  - ضغطنا زر «إضافة» الأصلي قبل إعادة التحميل.
                     *  - لم يكن هناك صف قابل للتحرير قبل الضغط.
                     *  - بعد العودة يوجد صف قابل للتحرير واحد فقط.
                     *  - جميع الحقول المرئية الثمانية فيه فارغة.
                     *
                     * عند تحقق هذه الشروط نعتبر الصف ملكًا لهذه العملية حتى لو
                     * أعطاه Oracle TrainingNID/_pkRowID أثناء إعادة التحميل.
                     */
                    const ownedByThisAdd=
                        completelyEmpty &&
                        (
                            tx.reuseExistingBlank===true ||
                            (
                                Array.isArray(
                                    tx.preAddEditableIndexes
                                ) &&
                                tx.preAddEditableIndexes.length===0 &&
                                Number(tx.addRequestedAt||0)>0 &&
                                Date.now()-
                                    Number(tx.addRequestedAt)
                                    <
                                    30000
                            )
                        );

                    const legacyTransient=
                        completelyEmpty &&
                        likelyTransientNewRow(i);

                    if(
                        !ownedByThisAdd &&
                        !legacyTransient &&
                        !compatibleOwnedPartial
                    ){
                        pauseCommitTransaction(
                            tx,
                            'ظهر صف قابل للتحرير بعد «إضافة»، لكن لم أستطع ربطه بهذه العملية بأمان. المسودة بقيت محفوظة.',
                            {
                                rowIndex:i,
                                completelyEmpty,
                                preAddEditableIndexes:
                                    tx.preAddEditableIndexes||[],
                                addRequestedAt:
                                    tx.addRequestedAt||null,
                                identity:
                                    rowIdentity(i),
                                snapshot:
                                    nativeRowSnapshot(i)
                            }
                        );

                        return false;
                    }

                    if(
                        !completelyEmpty &&
                        !compatibleOwnedPartial
                    ){
                        pauseCommitTransaction(
                            tx,
                            'صف الإضافة يحتوي على بيانات لا تطابق المسودة الحالية. لن أستبدلها تلقائيًا.',
                            {
                                rowIndex:i,
                                missing:
                                    visibleRowMissingFields(i),
                                snapshot:
                                    nativeRowSnapshot(i)
                            }
                        );

                        return false;
                    }

                    tx.rowIndex=i;

                    if(!tx.rowOwnership){
                        tx.rowOwnership=
                            ownedByThisAdd
                                ? 'transaction-add'
                                : 'legacy-transient';
                    }

                    saveCommitTransaction(tx);



                    const typeReady=
                        await ensureTrainingTypeOptions(
                            tx,
                            i,
                            draft
                        );

                    if(!typeReady){
                        // ensureTrainingTypeOptions حفظ المرحلة وأطلق PPR/Reload.
                        return true;
                    }

                    await populateNativeRow(
                        i,
                        draft
                    );


                    for(
                        const key of
                        Object.keys(FIELDS)
                    ){
                        if(
                            !nativeFieldMatches(
                                key,
                                control(key,i),
                                draft[key]??''
                            )
                        ){
                            pauseCommitTransaction(
                                tx,
                                `توقفت قبل حفظ فارس لأن الحقل «${key}» لم يحتفظ بقيمته.`,
                                {
                                    rowIndex:i,
                                    snapshot:
                                        nativeRowSnapshot(i)
                                }
                            );

                            return false;
                        }
                    }

                    /*
                     * v1.0.17:
                     * صف "إضافة" الجديد في فارس لا يحتوي زر "تحديث".
                     * بعد اكتمال الحقول الثمانية، الاعتماد الحقيقي للسجل
                     * يتم من زر "حفظ" على الصفحة.
                     */
                    const save=
                        nativeSaveButton();

                    if(!save){
                        pauseCommitTransaction(
                            tx,
                            'تمت تعبئة صف الإضافة، لكن لم أجد زر «حفظ» الأصلي في فارس. المسودة لم تُحذف.',
                            {
                                rowIndex:i,
                                snapshot:
                                    nativeRowSnapshot(i)
                            }
                        );

                        return false;
                    }

                    tx.stage=
                        'await-save-result';

                    saveCommitTransaction(tx);


                    save.click();

                    setTimeout(
                        ()=>{
                            resumeDraftCommitTransaction()
                                .catch(()=>{});
                        },
                        1300
                    );

                    return true;
                }

                if(
                    tx.stage===
                    'await-save-result'
                ){
                    const editableIndexes=
                        editableRowIndexes();

                    if(editableIndexes.length){
                        pauseCommitTransaction(
                            tx,
                            'بعد حفظ فارس ظهر صف قابل للتحرير بشكل غير متوقع. لم أحذف المسودة.',
                            {
                                editableIndexes
                            }
                        );

                        return false;
                    }

                    const committedIndex=
                        await verifyCommittedDraft(
                            draft,
                            tx.rowIndex??null,
                            1800
                        );

                    if(committedIndex===null){
                        pauseCommitTransaction(
                            tx,
                            'بعد حفظ فارس لم أتمكن من التحقق من بقاء النشاط. المسودة لم تُحذف.',
                            {}
                        );

                        return false;
                    }

                    /*
                     * نحذف فقط المسودة التي تأكد حفظها.
                     * إذا فشلت المسودة التالية، تبقى بقية المسودات كما هي.
                     */
                    const removed=
                        removeCommittedDraftOnly(
                            item.id
                        );


                    if(tx.mode==='single'){
                        clearCommitTransaction();

                        invalidate();
                        pd.activities=[];
                        pd.analysis=null;

                        toast(
                            'تم اعتماد المسودة وحفظها في فارس.',
                            'success'
                        );


                        setTimeout(
                            ()=>{
                                scan(true)
                                    .catch(()=>{});
                            },
                            650
                        );

                        return true;
                    }

                    /*
                     * اعتماد الكل = تكرار الاعتماد الفردي الناجح تلقائيًا:
                     * بعد حفظ الحالية ننتقل للمسودة التالية ونضغط "إضافة".
                     */
                    tx.index++;

                    if(
                        tx.index>=
                        tx.items.length
                    ){
                        const total=
                            tx.items.length;

                        clearCommitTransaction();

                        invalidate();
                        pd.activities=[];
                        pd.analysis=null;


                        toast(
                            `تم اعتماد ${total} مسودة واحدةً واحدة وحفظ كل مسودة تلقائيًا في فارس.`,
                            'success'
                        );

                        setTimeout(
                            ()=>{
                                scan(true)
                                    .catch(()=>{});
                            },
                            650
                        );

                        return true;
                    }

                    tx.rowIndex=null;
                    tx.reuseExistingBlank=false;
                    tx.rowOwnership='';
                    tx.typeOptionTrigger='';
                    tx.addRequestedAt=0;
                    tx.preAddEditableIndexes=[];
                    tx.preAddPagerIndex=null;
                    tx.preAddPagerPages=0;
                    tx.preAddPageRange='';
                    tx.preAddRowCount=0;
                    tx.targetAddPage=null;
                    tx.stage='starting';

                    saveCommitTransaction(
                        tx
                    );


                    toast(
                        `تم حفظ المسودة ${tx.index} من ${tx.items.length}. جاري إضافة المسودة التالية تلقائيًا...`,
                        'success'
                    );

                    /*
                     * نؤخر الضغط قليلًا بعد عودة فارس من الحفظ حتى
                     * تستقر أزرار OAF بالكامل.
                     */
                    setTimeout(
                        ()=>{
                            const currentTx=
                                loadCommitTransaction();

                            if(
                                !currentTx ||
                                currentTx.stage!=='starting'
                            ){
                                return;
                            }

                            clickNativeAddForTransaction(
                                currentTx
                            );
                        },
                        500
                    );

                    return true;
                }

                if(tx.stage==='starting'){
                    return clickNativeAddForTransaction(
                        tx
                    );
                }

                pauseCommitTransaction(
                    tx,
                    `مرحلة اعتماد غير معروفة: ${tx.stage}`,
                    {}
                );

                return false;

            }catch(err){

                pauseCommitTransaction(
                    tx,
                    `توقفت عملية الاعتماد: ${String(err?.message||err)}. المسودة ما زالت محفوظة.`,
                    {}
                );

                return false;
            }finally{
                pd.commitResuming=false;
            }
        }




        async function commitDraftById(id){
            const drafts=loadDrafts();
            const draft=
                drafts.find(
                    d=>d.id===id
                );

            if(!draft){
                return toast(
                    'لم أجد هذه المسودة. حدّث قائمة المسودات وحاول مرة أخرى.',
                    'error'
                );
            }

            const errs=
                validateImportRows(
                    [draft]
                );

            if(errs.length){
                return toast(
                    'هذه المسودة تحتوي على بيانات تحتاج مراجعة قبل الاعتماد.',
                    'error'
                );
            }

            if(!confirm(
                `سيتم اعتماد هذه المسودة فقط إلى فارس:\n\n` +
                `${clean(draft.name||'بدون اسم')}\n\n` +
                'قد يعيد فارس تحميل الصفحة أثناء الإضافة والحفظ؛ فارس+ سيكمل نفس العملية تلقائيًا بعد كل تحميل.\n\n' +
                'لن تُحذف المسودة إلا بعد التحقق من نجاح الحفظ.\n\nمتابعة؟'
            )){
                return;
            }

            return startDraftCommitTransaction(
                [id],
                'single'
            );
        }

        async function commitAllDrafts(){
            const drafts=
                loadDrafts();

            if(!drafts.length){
                return toast(
                    'لا توجد مسودات.'
                );
            }

            const errs=
                validateImportRows(
                    drafts
                );

            if(errs.length){
                return toast(
                    `يوجد ${errs.length} خطأ في المسودات. راجعها أولًا.`,
                    'error'
                );
            }

            if(!confirm(
                `سيتم اعتماد ${drafts.length} مسودة إلى فارس واحدةً واحدة بشكل تلقائي.\n\n` +
                'المسار: إضافة ← تعبئة ← حفظ ← إضافة المسودة التالية.\n\n' +
                'أي أن فارس+ سيكرر نفس الاعتماد الفردي الذي يعمل عندك، لكن بدون أن تضغط أنت «حفظ» أو «إضافة» بين المسودات.\n\n' +
                'قد يعيد فارس تحميل الصفحة بين المراحل، وسيكمل فارس+ تلقائيًا من المرحلة المحفوظة.\n\n' +
                'بعد نجاح كل مسودة وحفظها تُحذف هي فقط من صندوق المسودات، وإذا توقف لاحقًا تبقى المسودات الباقية محفوظة.\n\nمتابعة؟'
            )){
                return;
            }

            return startDraftCommitTransaction(
                drafts.map(d=>d.id),
                'batch'
            );
        }

        function summaryReportHtml(){
            const rows=reportActivities();
            const a=reportAnalysis(rows);
            const ex=reportExtended(rows);
            const profile=loadReportProfile();
            const context=reportPrintContext();

            return `<!doctype html>
            <html dir="rtl">
            <head>
                <meta charset="utf-8">
                <title>ملخص السجل المهني</title>

                <style>
                    body{font-family:Tahoma,Arial;padding:30px;color:#26364a}
                    h1{color:#173f5f}
                    .identity{margin:14px 0;border:1px solid #dde6ec;border-radius:12px;overflow:hidden}
                    .identity-title{display:flex;justify-content:space-between;gap:12px;background:#f4f8fa;padding:10px 12px;color:#173f5f}
                    .identity-title span{font-size:9px;color:#718092}
                    .identity-grid{display:grid;grid-template-columns:repeat(2,1fr)}
                    .identity-grid>div{padding:9px 11px;border-bottom:1px solid #edf1f4}
                    .identity-grid span,.print-meta span{display:block;font-size:8px;color:#82909f;margin-bottom:3px}
                    .identity-grid b,.print-meta b{font-size:10px;color:#33485f}
                    .identity-empty{grid-column:1/-1;color:#8a96a4;font-size:9px}
                    .print-meta{display:grid;grid-template-columns:repeat(3,1fr);background:#fbfcfd}
                    .print-meta>div{padding:9px 11px}
                    .scope{padding:12px 14px;background:#eef5f8;border-right:4px solid #2a8b81;border-radius:10px;margin:14px 0}
                    .scope span{display:block;font-size:10px;color:#667789;margin-top:5px}
                    .m{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}
                    .m div{padding:16px;background:#f4f7f9;border-radius:12px;text-align:center}
                    .m b{display:block;font-size:24px;color:#173f5f}
                    .sec{margin-top:22px;padding-top:15px;border-top:1px solid #ddd}
                    .signatures{display:grid;grid-template-columns:1fr 1fr;gap:35px;margin:28px 0 18px;padding-top:18px;border-top:1px solid #dfe6ec}
                    .signatures>div{min-height:80px;padding:10px 14px;background:#fafbfd;border-radius:10px}
                    .signatures b{display:block;color:#173f5f;margin-bottom:7px}
                    .signatures span{display:block;margin-bottom:15px}
                    .signatures em{font-style:normal;color:#7d8997;font-size:9px}
                    table{width:100%;border-collapse:collapse}
                    td,th{padding:8px;border:1px solid #ddd;text-align:right}
                    @media print{@page{size:A4 portrait;margin:10mm}}
                </style>
            </head>
            <body>
                <h1>${
                    pd.reportScope==='filtered'
                        ? 'ملخص السجل المهني — حسب التصفية'
                        : 'ملخص السجل المهني — كامل'
                }</h1>

                ${reportIdentityHtml(
                    profile,
                    context
                )}

                <div class="scope">
                    <b>${esc(reportFilterLabel())}</b>
                    <span>
                        عدد الأنشطة الداخلة في الملخص:
                        ${rows.length}
                    </span>
                    <span>
                        أساس التجميع السنوي: السنة الميلادية المستخرجة من تاريخ بداية النشاط الهجري.
                    </span>
                </div>

                <div class="m">
                    <div><b>${a.total}</b>نشاط</div>
                    <div><b>${a.totalHours}</b>ساعة</div>
                    <div><b>${a.totalDays}</b>يوم</div>
                    <div><b>${a.executor}</b>منفذ</div>
                    <div><b>${a.beneficiary}</b>مستفيد</div>
                </div>

                <div class="sec">
                    <h2>التوزيع حسب سنة الاحتساب الميلادية</h2>
                    <table>
                        ${top(a.byYear,30).map(
                            ([k,v])=>`
                                <tr>
                                    <th>${k}</th>
                                    <td>${v} نشاط</td>
                                    <td>${ex.yearlyHours[k]||0} ساعة</td>
                                </tr>
                            `
                        ).join('')}
                    </table>
                </div>

                <div class="sec">
                    <h2>حسب الدور</h2>
                    <table>
                        ${top(a.byRole,10).map(
                            ([k,v])=>`
                                <tr>
                                    <th>${esc(k)}</th>
                                    <td>${v}</td>
                                </tr>
                            `
                        ).join('')}
                    </table>
                </div>

                <div class="sec">
                    <h2>حسب نوع النشاط</h2>
                    <table>
                        ${top(a.byType,15).map(
                            ([k,v])=>`
                                <tr>
                                    <th>${esc(k)}</th>
                                    <td>${v}</td>
                                </tr>
                            `
                        ).join('')}
                    </table>
                </div>

                <div class="sec">
                    <h2>أكثر الجهات</h2>
                    <table>
                        ${top(a.byLocation,10).map(
                            ([k,v])=>`
                                <tr>
                                    <th>${esc(k)}</th>
                                    <td>${v}</td>
                                </tr>
                            `
                        ).join('')}
                    </table>
                </div>

                ${reportSignaturesHtml(profile)}

                ${developerFooterHtml()}
            </body>
            </html>`;
        }

        function printSummaryReport(){
            const activities=reportActivities();

            if(!activities.length){
                return toast(
                    'لا توجد أنشطة ضمن التصفية الحالية.',
                    'error'
                );
            }

            const w=window.open('','_blank');

            if(!w){
                return toast(
                    'اسمح بالنوافذ المنبثقة ثم حاول مرة أخرى.',
                    'error'
                );
            }

            w.document.open();
            w.document.write(summaryReportHtml());
            w.document.close();
            w.focus();

            setTimeout(()=>{
                try{w.print()}catch(_){}
            },450);
        }

        function download(blob,name){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;a.style.display='none';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1800);}
        const csvVal = v => /[",\n\r]/.test(String(v??''))?`"${String(v??'').replace(/"/g,'""')}"`:String(v??'');
        function exportCsv(){
            const activities=reportActivities();

            const rows=[
                [
                    '#','اسم النشاط','الجهة',
                    'تاريخ البداية','تاريخ النهاية',
                    'سنة الاحتساب الميلادية',
                    'الدور','نوع النشاط',
                    'نوع المدة','المدة'
                ],
                ...activities.map(a=>[
                    a.globalIndex,
                    a.name,
                    a.location,
                    a.startDate,
                    a.endDate,
                    activityGregorianYear(a)||'',
                    a.role,
                    a.type,
                    a.durationType,
                    a.duration
                ])
            ];

            download(
                new Blob(
                    [
                        '\ufeff',
                        rows.map(
                            r=>r.map(csvVal).join(',')
                        ).join('\r\n')
                    ],
                    {type:'text/csv;charset=utf-8'}
                ),
                `تقرير-أنشطة-التطوير-المهني-${reportFileSuffix()}.csv`
            );

            toast(
                `تم إنشاء CSV لـ ${activities.length} نشاطًا.`,
                'success'
            );
        }

        function exportJson(){
            const activities=reportActivities();

            const context=reportPrintContext();

            const p={
                product:'فارس+',
                author:META.author,
                exportedAt:new Date().toISOString(),
                reportReference:context.ref,
                printedHijriDate:context.hijriDate,
                printedGregorianDate:context.gregorianDate,
                reportOwner:loadReportProfile(),
                scope:pd.reportScope,
                filters:{...pd.filter},
                yearBasis:'gregorian-start-date',
                filterDescription:reportFilterLabel(),
                count:activities.length,
                activities:activities.map(
                    ({
                        globalIndex,name,location,
                        startDate,endDate,role,type,
                        durationType,duration
                    })=>({
                        globalIndex,name,location,
                        startDate,endDate,
                        gregorianYear:activityGregorianYear({startDate}),
                        hijriYear:activityYearInfo(startDate).hijriYear,
                        role,type,durationType,duration
                    })
                )
            };

            download(
                new Blob(
                    [JSON.stringify(p,null,2)],
                    {type:'application/json;charset=utf-8'}
                ),
                `أنشطة-التطوير-المهني-${reportFileSuffix()}.json`
            );

            toast(
                `تم إنشاء JSON لـ ${activities.length} نشاطًا.`,
                'success'
            );
        }

        function exportXls(){
            const activities=reportActivities();

            if(!activities.length){
                return toast(
                    'لا توجد أنشطة ضمن التصفية الحالية.',
                    'error'
                );
            }

            download(
                new Blob(
                    ['\ufeff',reportHtml()],
                    {type:'application/vnd.ms-excel;charset=utf-8'}
                ),
                `تقرير-أنشطة-التطوير-المهني-${reportFileSuffix()}.xls`
            );

            toast(
                `تم إنشاء Excel لـ ${activities.length} نشاطًا.`,
                'success'
            );
        }

        function printReport(){
            const activities=reportActivities();

            if(!activities.length){
                toast(
                    'لا توجد أنشطة ضمن التصفية الحالية.',
                    'error'
                );
                return;
            }

            const w=window.open('','_blank');

            if(!w){
                toast(
                    'اسمح بالنوافذ المنبثقة ثم حاول مرة أخرى.',
                    'error'
                );
                return;
            }

            w.document.open();
            w.document.write(reportHtml());
            w.document.close();
            w.focus();

            setTimeout(()=>{
                try{w.print()}catch(_){}
            },450);
        }

        const nativeButton = (id,text) => byId(id)||byId(`${id}_uixr`)||[...document.querySelectorAll('button')].find(b=>clean(b.textContent)===text)||null;
        async function saveAll(skipGuard=false){
            if(!skipGuard && !guardIncompleteNativeAction('الحفظ')) return false;
            const b=nativeButton('saveBTN','حفظ');
            if(!b){toast('لم أجد زر الحفظ الأصلي.','error');return false;}
            b.click();
            invalidate();
            toast('تم استدعاء حفظ فارس.');
            return true;
        }
        async function validateAll(){
            if(!guardIncompleteNativeAction('فحص الأنشطة')) return false;
            const b=nativeButton('ValidateBtn','فحص الأنشطة');
            if(!b){toast('لم أجد زر فحص الأنشطة الأصلي.','error');return false;}
            b.click();
            toast('تم استدعاء فحص فارس الرسمي.');
            setTimeout(async()=>{invalidate();await scan(true);smartCheck(pd.managerOpen);},950);
            return true;
        }
        async function approve(){
            if(!guardIncompleteNativeAction('الإرسال للموافقة')) return;
            if(!pd.activities.length) await scan(true);

            const x=smartCheck(false);

            if(x.errors){
                pd.tab='analysis';
                await openManager();
                refresh();
                alert(`يوجد ${x.errors} ملاحظات أساسية. راجعها قبل الإرسال.`);
                return;
            }

            const agree=byId('AgreeCHK');

            if(agree&&!agree.checked){
                alert('حدد أولًا إقرار «أقر بصحة البيانات المدرجة» ثم أعد المحاولة.');
                agree.scrollIntoView({behavior:'smooth',block:'center'});
                return;
            }

            if(!confirm(
                `سيتم استدعاء «إرسال للموافقة» الأصلي.${x.warnings?`\nيوجد ${x.warnings} تنبيهًا معلوماتيًا.`:''}\n\nمتابعة؟`
            )) return;

            const b=nativeButton('approvalBTN','ارسال للموافقة');

            if(!b){
                toast('لم أجد زر الإرسال الأصلي.','error');
                return;
            }

            b.click();
        }

        const back = () => {
            if(!guardIncompleteNativeAction('الرجوع')) return;

            const b=nativeButton('BackBTN','رجوع');

            if(b) b.click();
            else toast('لم أجد زر الرجوع الأصلي.','error');
        };

        function pageBar(){
            let b=byId(`${ID}-bar`);

            if(!b){
                b=document.createElement('section');
                b.id=`${ID}-bar`;

                b.addEventListener('click',async e=>{
                    const control=e.target.closest('[data-page]');
                    const a=control?.dataset.page;

                    if(!a) return;

                    // حاسم في Oracle: لا نسمح للزر أن يصبح Submit
                    // ولا نمرر الحدث إلى نموذج فارس أو معالجاته.
                    e.preventDefault();
                    e.stopPropagation();

                    if(a==='manager') await openManager();
                    else if(a==='add') await addActivity();
                    else if(a==='save') await saveAll();
                    else if(a==='validate') await validateAll();
                    else if(a==='approve') await approve();
                    else if(a==='back') back();
                });

                const anchor=byId('TrainingDetailsRN');
                anchor?.parentElement?.insertBefore(b,anchor);
            }

            updateBar();
            neutralizeUiButtons(b);
            return b;
        }
        function updateBar(){
            const b=byId(`${ID}-bar`);
            if(!b) return;

            const n=
                pd.activities.length ||
                loadJSON(STORE.cache,{activities:[]}).activities?.length ||
                0;

            const x=pd.activities.length
                ? issues()
                : {errors:0};

            b.innerHTML=`<div class="${ID}-brand"><i>ف+</i><div><b>إدارة أنشطة التطوير المهني</b><small>${n?`${n} نشاطًا مفهرسًا`:'افتح «إدارة الأنشطة» لبناء الفهرس'}</small></div></div><div class="${ID}-barstats">${n?`<span>${n} نشاط</span>`:''}${x.errors?`<span class="bad">${x.errors} ملاحظة</span>`:''}</div><div class="${ID}-baracts"><button type="button" class="primary" data-page="manager">🔎 إدارة الأنشطة</button><button type="button" data-page="add">+ إضافة</button><button type="button" data-page="save">حفظ</button><button type="button" data-page="validate">فحص الأنشطة</button><button type="button" class="approve" data-page="approve">إرسال للموافقة</button><button type="button" data-page="back">رجوع</button></div>`;

            neutralizeUiButtons(b);
        }

        function styles(){if(byId(`${ID}-style`))return;const s=document.createElement('style');s.id=`${ID}-style`;s.textContent=`
#${ID}-bar,#${ID}-bar *,#${ID}-manager,#${ID}-manager *,#${ID}-editor,#${ID}-editor *{box-sizing:border-box;font-family:Tahoma,Arial,sans-serif}
#${ID}-bar{direction:rtl;width:min(1180px,calc(100% - 30px));margin:16px auto 14px;padding:13px 15px;display:flex;align-items:center;gap:14px;background:#fff;border:1px solid #e2e8ef;border-radius:16px;box-shadow:0 9px 30px rgba(23,63,95,.08);position:sticky;top:8px;z-index:99990}.`+ID+`-brand{display:flex;align-items:center;gap:9px;min-width:220px}.`+ID+`-brand i{width:37px;height:37px;display:grid;place-items:center;border-radius:11px;background:#173f5f;color:#fff;font-style:normal;font-weight:900}.`+ID+`-brand b{display:block;color:#173047;font-size:12px}.`+ID+`-brand small{display:block;color:#8793a3;margin-top:3px;font-size:9px}.`+ID+`-barstats{display:flex;gap:6px;margin-inline-start:auto}.`+ID+`-barstats span{padding:5px 8px;border-radius:99px;background:#f1f5f8;color:#566679;font-size:9px}.`+ID+`-barstats .bad{background:#fef0f0;color:#b33c3c}.`+ID+`-baracts{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
#${ID}-bar button,#${ID}-manager button,#${ID}-editor button{border:1px solid #dce3ea;background:#fff;color:#354154;border-radius:9px;padding:8px 10px;cursor:pointer;font-size:10px;font-weight:800}#${ID}-bar button.primary,#${ID}-manager button.primary,#${ID}-editor button.primary{background:#173f5f;border-color:#173f5f;color:#fff}#${ID}-bar button.approve{background:#edf7f3;color:#21745d;border-color:#cfe9df}
#${ID}-manager{display:none;position:fixed;inset:0;z-index:2147483644;direction:rtl}#${ID}-manager.open{display:block}.`+ID+`-back{position:absolute;inset:0;background:rgba(15,23,42,.64);backdrop-filter:blur(7px)}.`+ID+`-app{position:absolute;inset:2.5vh 1.5vw;display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;background:#f4f7fa;border-radius:22px;overflow:hidden;box-shadow:0 30px 90px rgba(0,0,0,.3)}#${ID}-manager header{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:18px 22px 14px;background:#fff;border-bottom:1px solid #e7ebf0}#${ID}-manager header h2{margin:3px 0 4px;color:#173047;font-size:20px}#${ID}-manager header small{color:#2a8b81;font-weight:900}#${ID}-manager header p{margin:0;color:#8a95a5;font-size:10px}#${ID}-manager header>div:last-child{display:flex;gap:7px}.icon{width:36px!important;height:36px!important;padding:0!important;font-size:20px!important}#${ID}-manager nav{display:flex;gap:6px;padding:9px 20px;background:#fff;border-bottom:1px solid #e7ebf0}#${ID}-manager nav button{border:0;background:transparent;color:#687588}#${ID}-manager nav button.active{background:#edf3f6;color:#173f5f}#${ID}-body{overflow:auto;padding:18px 20px 28px}#${ID}-manager footer{background:#fff;border-top:1px solid #e7ebf0;padding:9px 18px;display:flex;justify-content:space-between;color:#8893a2;font-size:9px}
.`+ID+`-filters{display:grid;grid-template-columns:minmax(300px,1.6fr) repeat(4,minmax(120px,.6fr));gap:8px;margin-bottom:10px}.`+ID+`-filters input,.`+ID+`-filters select,#${ID}-editor input,#${ID}-editor select{width:100%;min-height:40px;border:1px solid #dce3ea;border-radius:9px;background:#fff;outline:none;padding:8px 9px;font-size:10px;color:#26364a}.`+ID+`-search{position:relative}.`+ID+`-search span{position:absolute;right:12px;top:50%;transform:translateY(-50%)}.`+ID+`-search input{padding-right:38px}.`+ID+`-summary{margin:6px 2px 10px;color:#7b8796;font-size:9px}.`+ID+`-list{display:grid;gap:8px}.`+ID+`-card{display:grid;grid-template-columns:42px minmax(0,1fr) auto;gap:11px;align-items:center;padding:12px;background:#fff;border:1px solid #e2e8ef;border-radius:13px}.`+ID+`-num{width:36px;height:36px;display:grid;place-items:center;border-radius:10px;background:#eef4f6;color:#173f5f;font-weight:900}.`+ID+`-card h3{margin:0 0 7px;color:#213149;font-size:12px}.`+ID+`-card p{display:flex;flex-wrap:wrap;gap:5px 12px;margin:0;color:#667386;font-size:9px}.`+ID+`-card small{display:block;margin-top:6px;color:#9aa3b0}.`+ID+`-actions{display:flex;gap:5px}.`+ID+`-actions .danger{background:#fff3f3;color:#b84545;border-color:#f2d2d2}
.`+ID+`-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.`+ID+`-panel{background:#fff;border:1px solid #e2e8ef;border-radius:14px;padding:15px}.`+ID+`-panel.full{grid-column:1/-1}.`+ID+`-panel h3{margin:0 0 12px;color:#25364d;font-size:12px}.`+ID+`-panel p{color:#667487;font-size:10px;line-height:1.8}.`+ID+`-metrics{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}.`+ID+`-metrics div{background:#f5f8fa;border-radius:10px;padding:12px;text-align:center}.`+ID+`-metrics b{display:block;color:#173f5f;font-size:20px}.`+ID+`-metrics span{color:#7f8b9b;font-size:8px}.`+ID+`-bar{margin:10px 0}.`+ID+`-bar>div{display:flex;justify-content:space-between;color:#57667a;font-size:9px}.`+ID+`-bar>i{display:block;height:6px;background:#eef2f5;border-radius:99px;margin-top:5px;overflow:hidden}.`+ID+`-bar em{display:block;height:100%;background:#2a9d8f;border-radius:99px}.`+ID+`-panelhead{display:flex;justify-content:space-between;align-items:center}.`+ID+`-issues{display:grid;gap:8px}.`+ID+`-issues>div{padding:11px 12px;border-radius:10px;border-right:4px solid}.`+ID+`-issues b{display:block;font-size:10px}.`+ID+`-issues span{display:block;color:#697588;font-size:9px;margin-top:4px}.`+ID+`-issues .err{background:#fff4f4;border-color:#d75a5a}.`+ID+`-issues .warn{background:#fff8ea;border-color:#d9a238}.`+ID+`-issues .ok{background:#eff9f5;border-color:#2a9d8f}
.`+ID+`-metrics .metric-error{background:#fff1f1}.`+ID+`-metrics .metric-error b{color:#b43e3e}
.`+ID+`-check-legend{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
.`+ID+`-check-legend span{padding:9px 10px;border-radius:9px;font-size:9px;line-height:1.7}
.`+ID+`-check-legend .critical{background:#fff4f4;color:#7e3333;border:1px solid #f0d2d2}
.`+ID+`-check-legend .info{background:#fff9ed;color:#725414;border:1px solid #f0dfb5}
.`+ID+`-check-sub{margin:3px 0 0!important;font-size:9px!important;color:#7d8999!important}
.`+ID+`-issue-stack{display:grid;gap:7px;margin-top:9px}
.`+ID+`-issue-detail{background:#fff;border:1px solid rgba(70,85,105,.15);border-radius:9px;overflow:hidden}
.`+ID+`-issue-detail>summary{cursor:pointer;list-style:none;padding:9px 10px;font-size:9px;font-weight:800;color:#344357;display:flex;justify-content:space-between;gap:10px}
.`+ID+`-issue-detail>summary::-webkit-details-marker{display:none}
.`+ID+`-issue-detail>summary:before{content:'▸';margin-left:5px;color:#7c8998}
.`+ID+`-issue-detail[open]>summary:before{content:'▾'}
.`+ID+`-issue-detail>summary small{font-size:8px;font-weight:600;color:#8a95a4}
.`+ID+`-issue-help{padding:8px 10px;background:#f7f9fb;border-top:1px solid #edf0f3;color:#697588;font-size:8.5px;line-height:1.8}
.`+ID+`-issue-row{display:grid;grid-template-columns:42px minmax(0,1fr) auto;gap:8px;align-items:center;padding:9px 10px;border-top:1px solid #eef1f4;background:#fff}
.`+ID+`-issue-no{font-size:9px;font-weight:900;color:#173f5f}
.`+ID+`-issue-main b{display:block!important;color:#2d3b4d!important;font-size:9px!important;margin:0!important}
.`+ID+`-issue-main span{display:block!important;margin-top:3px!important;font-size:8px!important;color:#7c8796!important}
.`+ID+`-issue-row button{padding:5px 8px!important;font-size:8px!important}
.`+ID+`-reportbtns{display:flex;gap:7px;flex-wrap:wrap}.`+ID+`-snap{display:flex;gap:12px;align-items:center;margin-top:12px;padding:10px;background:#f5f8fa;border-radius:10px;color:#647286;font-size:9px}.`+ID+`-empty{padding:48px;text-align:center;color:#8d98a7}.`+ID+`-empty.small{padding:14px}
#${ID}-editor{display:none;position:fixed;inset:0;z-index:2147483646;direction:rtl}#${ID}-editor.open{display:block}.`+ID+`-edback{position:absolute;inset:0;background:rgba(15,23,42,.58);backdrop-filter:blur(6px)}#${ID}-editor>section{position:absolute;top:50%;left:50%;width:min(820px,94vw);max-height:88vh;overflow:auto;transform:translate(-50%,-50%);background:#fff;border-radius:18px;box-shadow:0 30px 90px rgba(0,0,0,.32)}#${ID}-editor header{display:flex;justify-content:space-between;padding:17px 18px;border-bottom:1px solid #e7ebf0}#${ID}-editor header h3{margin:4px 0 0;color:#173047}.`+ID+`-edgrid{padding:18px;display:grid;grid-template-columns:1fr 1fr;gap:12px}#${ID}-editor label.wide{grid-column:1/-1}#${ID}-editor label span{display:block;color:#59687a;font-size:9px;font-weight:800;margin-bottom:6px}
.`+ID+`-datebox{border:1px solid #dfe6ec;border-radius:12px;background:#fbfcfd;padding:11px}
.`+ID+`-datehead{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:9px}
.`+ID+`-datehead>span{font-size:9px;font-weight:800;color:#59687a}
.`+ID+`-date-modes{display:flex;gap:4px;background:#eef2f5;padding:3px;border-radius:8px}
#${ID}-editor .`+ID+`-date-modes button{border:0!important;background:transparent!important;padding:5px 8px!important;font-size:8px!important;color:#667486!important;border-radius:6px!important}
#${ID}-editor .`+ID+`-date-modes button.active{background:#fff!important;color:#173f5f!important;box-shadow:0 1px 4px rgba(0,0,0,.08)!important}
#${ID}-editor .`+ID+`-date-modes button small{font-size:7px;opacity:.7}
.`+ID+`-datepanel[hidden]{display:none!important}
.`+ID+`-hijri-parts{display:grid;grid-template-columns:.7fr 1.4fr .9fr;gap:6px}
.`+ID+`-date-preview{margin-top:7px;padding:7px 8px;border-radius:7px;background:#f2f6f8;color:#697789;font-size:8px;line-height:1.7}
.`+ID+`-date-preview b{color:#173f5f}
.`+ID+`-date-preview .bad{color:#a23d3d;font-weight:800}
#${ID}-editor [data-gregorian-date]{width:100%;min-height:40px;border:1px solid #dce3ea;border-radius:9px;background:#fff;padding:8px 9px;font:inherit;color:#26364a}
.`+ID+`-ednote{margin:0 18px 14px;padding:9px 11px;background:#f5f8fa;border-radius:9px;color:#778496;font-size:9px;line-height:1.75}
.`+ID+`-draft-safe{margin:14px 18px 0;padding:11px 12px;background:#eef8f5;border:1px solid #cde9df;border-right:4px solid #2a9d8f;border-radius:10px}
.`+ID+`-draft-safe b{display:block;color:#246b5e;font-size:10px;margin-bottom:4px}
.`+ID+`-draft-safe span{display:block;color:#61766f;font-size:9px;line-height:1.75}
.`+ID+`-edmessage{display:none;margin:0 18px 12px;padding:9px 11px;border-radius:9px;font-size:9px;line-height:1.7}
.`+ID+`-edmessage.error{display:block;background:#fff1f1;color:#993939;border:1px solid #efd0d0}
.`+ID+`-edmessage.busy{display:block;background:#eef4f8;color:#375b73;border:1px solid #d3e0e8}
.`+ID+`-edmessage.info{display:block;background:#f5f8fa;color:#687587;border:1px solid #e3e9ef}
.`+ID+`-stuck{margin:16px 18px;padding:14px;background:#fff8ea;border:1px solid #efdfb9;border-right:4px solid #d9a238;border-radius:11px}
.`+ID+`-stuck>b{display:block;color:#704d0d;font-size:11px}
.`+ID+`-stuck p{color:#695d47;font-size:9px;line-height:1.85}
.`+ID+`-recovery-ok,.`+ID+`-recovery-warn{padding:9px 10px;border-radius:8px;font-size:9px;line-height:1.7}
.`+ID+`-recovery-ok{background:#eef8f5;color:#326e61}
.`+ID+`-recovery-warn{background:#fff1f1;color:#8a4141}
#${ID}-editor .danger{background:#fff1f1!important;color:#a33b3b!important;border-color:#efcdcd!important}
#${ID}-editor .`+ID+`-savepage{background:#eef4f8!important;color:#315b75!important;border-color:#d5e2ea!important}
#${ID}-editor .`+ID+`-reload{background:#fff!important;color:#7a5660!important;border-color:#dfd2d6!important}
#${ID}-editor footer{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;padding:13px 18px;border-top:1px solid #e7ebf0}.`+ID+`-hilite>td{animation:${ID}-pulse 1.1s ease 3}@keyframes ${ID}-pulse{50%{box-shadow:inset 0 0 0 3px rgba(42,157,143,.65);background:#ecf8f4!important}}

.`+ID+`-calendar-note{margin:8px 0 4px;padding:9px 11px;border-radius:10px;background:#eef7f6;border:1px solid #d6ebe8;color:#456a67;font-size:8.5px;line-height:1.8}
.`+ID+`-calendar-note b{color:#1d5f58}
.`+ID+`-calendar-note code{direction:ltr;display:inline-block;background:#fff;border:1px solid #d8e7e5;border-radius:6px;padding:1px 5px;color:#174a45}
.`+ID+`-activitytools{display:flex;justify-content:space-between;align-items:center;margin:8px 0 12px;color:#6f7d8e;font-size:9px}
.`+ID+`-activitytools>div:last-child{display:flex;gap:6px;align-items:center}
.`+ID+`-activitytools select{min-height:34px;border:1px solid #dce3ea;border-radius:8px;background:#fff;padding:4px 8px}
.`+ID+`-activitytools button.active{background:#173f5f!important;color:#fff!important}
.`+ID+`-tablewrap{overflow:auto;background:#fff;border:1px solid #e2e8ef;border-radius:13px}
.`+ID+`-datatable{width:100%;border-collapse:collapse;min-width:1050px;font-size:9px}
.`+ID+`-datatable th{position:sticky;top:0;background:#f2f6f8;color:#425269;padding:9px;border-bottom:1px solid #dfe6ec;text-align:right}
.`+ID+`-datatable td{padding:8px;border-bottom:1px solid #edf1f4;vertical-align:middle;color:#526174}
.`+ID+`-datatable tr:hover td{background:#fbfcfd}
.`+ID+`-rowacts{display:flex;gap:4px;align-items:center}
.`+ID+`-rowacts button{padding:5px 6px!important;font-size:8px!important}
.`+ID+`-locked{opacity:.55}
.`+ID+`-draftlist{display:grid;gap:8px}
.`+ID+`-draftlist article{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:11px;background:#f8fafb;border:1px solid #e4e9ee;border-radius:10px}
.`+ID+`-draftlist article b{display:block;color:#28394f;font-size:10px}
.`+ID+`-draftlist article span{display:block;color:#7b8796;font-size:8.5px;margin-top:4px}
.`+ID+`-draftlist article>div:last-child{display:flex;gap:5px}
.`+ID+`-cert-privacy{margin:10px 0;padding:10px 12px;border-radius:10px;background:#eef8f6;border:1px solid #d5ebe6;color:#35655f;font-size:9px;line-height:1.8}
.`+ID+`-cert-ai-settings{display:grid;grid-template-columns:minmax(260px,1fr) minmax(360px,1.35fr);gap:12px;align-items:center;margin:10px 0 14px;padding:12px;border:1px solid #dfe3fa;border-radius:12px;background:linear-gradient(135deg,#f8f7ff,#f5fbff)}
.`+ID+`-cert-ai-settings>div:first-child{display:grid;gap:4px}.`+ID+`-cert-ai-settings b{color:#463d8f}.`+ID+`-cert-ai-settings span{font-size:8.7px;line-height:1.7;color:#607086}.`+ID+`-cert-ai-settings small{font-size:7.6px;line-height:1.6;color:#8b6a55}
.`+ID+`-cert-ai-key{display:grid;grid-template-columns:minmax(180px,1fr) auto auto;gap:7px;align-items:center}.`+ID+`-cert-ai-key input{min-width:0;border:1px solid #d4dce7;border-radius:9px;padding:9px 10px;font:inherit;background:#fff}.`+ID+`-cert-ai-key a{grid-column:1/-1;justify-self:start;font-size:8px;color:#4963ae;text-decoration:none}
.`+ID+`-ai-btn{border-color:#c9c1f4!important;background:#f6f3ff!important;color:#5742a5!important;font-weight:800}
.`+ID+`-cert-ai-badge{display:inline-flex;margin-inline-start:6px;padding:3px 7px;border-radius:999px;background:#f0ecff;color:#5c48a8;font-size:7.5px;font-weight:800}
.`+ID+`-cert-ai-result{margin-top:10px;padding:11px;border:1px solid #d9d3fa;border-radius:11px;background:linear-gradient(135deg,#fbfaff,#f7fbff)}
.`+ID+`-cert-ai-title{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px}.`+ID+`-cert-ai-title>div{display:grid;gap:2px}.`+ID+`-cert-ai-title b{color:#4d4199}.`+ID+`-cert-ai-title span{font-size:7.8px;color:#758198}.`+ID+`-cert-ai-title>span{padding:3px 7px;border-radius:999px}.`+ID+`-cert-ai-title>span.ok{background:#eaf7f3;color:#28796e}.`+ID+`-cert-ai-title>span.review{background:#fff4dc;color:#946a1b}
.`+ID+`-cert-ai-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.`+ID+`-cert-ai-grid>div{padding:8px;border:1px solid #e8e7f4;border-radius:8px;background:#fff;display:grid;gap:3px}.`+ID+`-cert-ai-grid span{font-size:7px;color:#8995a7}.`+ID+`-cert-ai-grid b{font-size:8.5px;color:#21394d;line-height:1.55}
.`+ID+`-cert-ai-notes{display:grid;gap:3px;margin-top:8px;padding:8px;border-radius:8px;background:#fff;color:#6e7180;font-size:8px}.`+ID+`-cert-ai-error{margin-top:8px;padding:8px 9px;border-radius:8px;background:#fff0f0;color:#a34444;font-size:8.5px}
@media(max-width:900px){.`+ID+`-cert-ai-settings{grid-template-columns:1fr}.`+ID+`-cert-ai-key{grid-template-columns:1fr}.`+ID+`-cert-ai-key a{grid-column:auto}.`+ID+`-cert-ai-grid{grid-template-columns:1fr 1fr}}
.`+ID+`-cert-metrics{grid-template-columns:repeat(4,1fr);margin-top:12px}
.`+ID+`-cert-bulk{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:12px;padding:10px;border-radius:10px;background:#f5f8fa}.`+ID+`-cert-bulk span{color:#718096;font-size:9px}
.`+ID+`-cert-list{display:grid;gap:10px}.`+ID+`-cert-card{border:1px solid #e1e8ee;border-right:4px solid #9ba9b8;border-radius:13px;padding:12px;background:#fff}.`+ID+`-cert-card.good{border-right-color:#2a9d8f}.`+ID+`-cert-card.warn{border-right-color:#d9a238}.`+ID+`-cert-card.bad{border-right-color:#d75a5a}
.`+ID+`-cert-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}.`+ID+`-cert-head>div{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.`+ID+`-cert-head b{font-size:10.5px;color:#26384e}.`+ID+`-cert-status{font-size:8px;padding:4px 7px;border-radius:99px;background:#edf1f5;color:#64758a}.`+ID+`-cert-status.good{background:#eaf8f3;color:#257664}.`+ID+`-cert-status.warn{background:#fff6e5;color:#946b16}.`+ID+`-cert-status.bad{background:#fff0f0;color:#a43f3f}
.`+ID+`-cert-method{margin:0 0 8px;color:#65758a;font-size:8.5px}.`+ID+`-cert-method b{color:#173f5f}
.`+ID+`-cert-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px}.`+ID+`-cert-fields>div{padding:8px 9px;border-radius:9px;background:#f7f9fb;min-width:0}.`+ID+`-cert-fields span{display:block;color:#8793a3;font-size:7.5px;margin-bottom:3px}.`+ID+`-cert-fields b{display:block;color:#33465d;font-size:9px;white-space:normal;overflow-wrap:anywhere}
.`+ID+`-cert-evidence{display:block;margin-top:5px;font-size:7.2px;line-height:1.5;color:#8793a3}.`+ID+`-cert-evidence.high{color:#2a7f73}.`+ID+`-cert-evidence.medium{color:#9b772d}.`+ID+`-cert-evidence.low{color:#a85f4d}
.`+ID+`-cert-ref{margin-top:8px;padding:7px 9px;border-radius:8px;background:#f5f7fa;color:#5f6e80;font-size:8px}.`+ID+`-cert-ref code{direction:ltr;display:inline-block}.`+ID+`-cert-ref small{margin-inline-start:5px;color:#8d98a5}
.`+ID+`-cert-duplicate{margin-top:8px;padding:9px;border-radius:9px;background:#fff7e9;border:1px solid #f0ddb7;display:flex;align-items:center;gap:8px;flex-wrap:wrap}.`+ID+`-cert-duplicate b{color:#8a6418;font-size:9px}.`+ID+`-cert-duplicate span{color:#695d45;font-size:8.5px;flex:1}.`+ID+`-cert-duplicate button{font-size:8px}
.`+ID+`-cert-warnings{display:grid;gap:3px;margin-top:8px;padding:8px 9px;border-radius:9px;background:#fbfaf5;color:#786d50;font-size:8.5px}.`+ID+`-cert-actions{display:flex;justify-content:flex-end;gap:7px;margin-top:10px}.`+ID+`-cert-error{padding:10px;border-radius:9px;background:#fff1f1;color:#a53e3e;font-size:9px}
.`+ID+`-import-flow{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;margin:12px 0 14px;padding:10px;background:#f4f8fa;border:1px solid #e2e9ee;border-radius:10px;color:#637489;font-size:8.5px}
.`+ID+`-import-flow>div{display:flex;align-items:center;gap:5px}
.`+ID+`-import-flow span{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:#173f5f;color:#fff;font-weight:800}
.`+ID+`-import-flow b{color:#40546a}
.`+ID+`-import-flow i{font-style:normal;color:#91a0ad}
.`+ID+`-drop{min-height:150px;border:2px dashed #cad6df;border-radius:14px;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:8px;background:#f8fbfc;color:#718093}
.`+ID+`-drop.over{border-color:#2a9d8f;background:#eff9f5}
.`+ID+`-filebtn{background:#173f5f;color:#fff;border-radius:9px;padding:8px 12px;cursor:pointer;font-weight:800}
.`+ID+`-reviewbox{margin:14px 0;padding:13px;border-radius:10px;border-right:4px solid}
.`+ID+`-reviewbox b,.`+ID+`-reviewbox span{display:block}
.`+ID+`-reviewbox span{font-size:9px;margin-top:5px;color:#68778a}
.`+ID+`-reviewbox.bad{background:#fff1f1;border-color:#c84a4a}
.`+ID+`-reviewbox.good{background:#eff9f5;border-color:#2a9d8f}
.`+ID+`-miniStats{display:grid;gap:8px}
.`+ID+`-miniStats span{padding:9px;background:#f5f8fa;border-radius:8px;color:#687789;font-size:9px}
.`+ID+`-miniStats b{float:left;color:#173f5f}
.`+ID+`-hint{color:#7b8796;font-size:8.5px;line-height:1.7}
.`+ID+`-quality-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px}
.`+ID+`-quality-summary>div{padding:12px;border-radius:10px;text-align:center}.`+ID+`-quality-summary b{display:block;font-size:22px}.`+ID+`-quality-summary span{font-size:9px}.`+ID+`-quality-summary .critical{background:#fff1f1;color:#9b3e46}.`+ID+`-quality-summary .review{background:#fff8e8;color:#8b6419}.`+ID+`-quality-summary .info{background:#eef5f9;color:#35647e}
.`+ID+`-quality-extra{margin-top:8px;border:1px solid #e3e9ef;border-radius:10px;overflow:hidden}.`+ID+`-quality-extra>summary{cursor:pointer;padding:10px;background:#f8fafb;color:#536276;font-size:9px;font-weight:800}.`+ID+`-quality-extra .`+ID+`-issue-stack{padding:9px}.`+ID+`-quality-row{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px;background:#fff;border:1px solid #edf1f4;border-radius:8px}.`+ID+`-quality-row b{display:block;color:#394a60;font-size:9px}.`+ID+`-quality-row span{display:block;color:#7d8998;font-size:8px;margin-top:3px}
.`+ID+`-report-profile{margin:12px 0;border:1px solid #dfe7ed;border-radius:11px;background:#fbfcfd;overflow:hidden}
.`+ID+`-report-profile>summary{cursor:pointer;padding:11px 13px;color:#40546a;font-size:9.5px;font-weight:800;list-style:none}
.`+ID+`-report-profile>summary::-webkit-details-marker{display:none}
.`+ID+`-report-profile>summary small{float:left;color:#688197;font-size:8px;font-weight:700}
.`+ID+`-report-profile[open]>summary{background:#f2f7f9;border-bottom:1px solid #e2e9ee}
.`+ID+`-report-profile-body{padding:12px}
.`+ID+`-report-profile-note{padding:9px 10px;background:#eef6f5;border-right:3px solid #2a8b81;border-radius:8px;color:#5f7482;font-size:8.5px;line-height:1.8;margin-bottom:10px}
.`+ID+`-report-profile-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.`+ID+`-report-profile-grid label{display:block}
.`+ID+`-report-profile-grid label>span{display:block;color:#66778a;font-size:8px;font-weight:800;margin-bottom:4px}
.`+ID+`-report-profile-grid input{width:100%;min-height:38px;border:1px solid #dbe4ea;border-radius:8px;background:#fff;padding:7px 9px;color:#35495f}
.`+ID+`-report-profile-actions{display:flex;gap:7px;justify-content:flex-end;margin-top:11px}
.`+ID+`-report-scope-switch{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:14px 0}
.`+ID+`-report-scope-switch button{padding:12px!important;border:1px solid #dce4ea!important;background:#f8fafb!important;color:#536276!important;border-radius:11px!important;text-align:right!important}
.`+ID+`-report-scope-switch button.active{background:#173f5f!important;color:#fff!important;border-color:#173f5f!important}
.`+ID+`-report-scope-switch small{display:block;font-size:8px;margin-top:4px;opacity:.75}
.`+ID+`-report-filterbox{display:grid;grid-template-columns:minmax(240px,2fr) repeat(4,minmax(110px,1fr)) auto;gap:7px;align-items:center;margin:10px 0}
.`+ID+`-report-filterbox select,.`+ID+`-report-filterbox input{min-height:38px}
.`+ID+`-report-scope-summary{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0}
.`+ID+`-report-scope-summary>div{padding:10px 11px;background:#f4f7f9;border:1px solid #e2e8ed;border-radius:9px}
.`+ID+`-report-scope-summary>div.wide{grid-column:1/-1}
.`+ID+`-report-scope-summary span{display:block;color:#7b8796;font-size:8px;margin-bottom:4px}
.`+ID+`-report-scope-summary b{display:block;color:#30445b;font-size:9px;line-height:1.7}
#${ID}-manager select:focus,#${ID}-manager input:focus{border-color:#6e9eb5!important;box-shadow:0 0 0 3px rgba(49,95,115,.10)!important}
@media(max-width:980px){
.`+ID+`-report-profile-grid{grid-template-columns:1fr 1fr}
.`+ID+`-report-filterbox{grid-template-columns:1fr 1fr}
#${ID}-bar{position:relative;top:auto;align-items:flex-start;flex-direction:column}.`+ID+`-barstats{margin-inline-start:0}.`+ID+`-filters{grid-template-columns:1fr 1fr}.`+ID+`-search{grid-column:1/-1}.`+ID+`-card{grid-template-columns:40px 1fr}.`+ID+`-actions{grid-column:1/-1;justify-content:flex-end}.`+ID+`-metrics{grid-template-columns:repeat(3,1fr)}}`;
            document.head.appendChild(s);
        }

        function installNativeValidationGuard(){
            if(pd.guardHandler) return;

            const protectedIds=new Set([
                'saveBTN',
                'ValidateBtn',
                'approvalBTN',
                'BackBTN'
            ]);

            pd.guardHandler=ev=>{
                const target=ev.target.closest?.('button,a,input');
                if(!target) return;

                const baseId=String(target.id||'').replace(/_uixr$/,'');

                if(!protectedIds.has(baseId)) return;

                const stuck=incompleteEditableRow();

                if(!stuck) return;

                ev.preventDefault();
                ev.stopPropagation();
                ev.stopImmediatePropagation();

                openStuckRecovery(stuck);
            };

            document.addEventListener('click',pd.guardHandler,true);
        }

        function removeNativeValidationGuard(){
            if(!pd.guardHandler) return;
            document.removeEventListener('click',pd.guardHandler,true);
            pd.guardHandler=null;
        }

        function mutationTouchesPdOracle(m){
            const t=m.target instanceof Element?m.target:m.target?.parentElement;
            if(t?.closest?.(`#${ID}-manager,#${ID}-editor,#${ID}-bar`))return false;
            if(t?.closest?.('#TrainingDetailsRN,#PersonalDetailsRN'))return true;
            if(m.type==='childList')for(const node of m.addedNodes||[]){
                if(!(node instanceof Element))continue;
                if(node.matches?.('#TrainingDetailsRN,#TrainingTableRN,#PersonalDetailsRN')||node.querySelector?.('#TrainingDetailsRN,#TrainingTableRN,#PersonalDetailsRN'))return true;
            }
            return false;
        }
        function observe(){
            if(pd.observer)return;
            pd.observer=new MutationObserver(ms=>{
                if(!ms.some(mutationTouchesPdOracle))return;
                clearTimeout(pd.timer);
                pd.timer=setTimeout(async()=>{
                    if(!matchPage())return;
                    await ensurePersonalCollapsed();
                    await ensureTrainingExpanded();
                    pageBar();
                    // لا refresh للمدير هنا حتى لا تتكسر حقول البحث والقوائم.
                },140);
            });
            pd.observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-expanded','style','class']});
        }
        async function mount(){
            if(pd.mounted) return;

            pd.mounted = true;
            styles();
            loadCache();

            const personalCollapsed = await ensurePersonalCollapsed();
            const opened = await ensureTrainingExpanded();

            pageBar();
            installNativeValidationGuard();
            observe();

            // Oracle OAF قد يعيد تحميل الصفحة بالكامل عند «إضافة/تحديث/حفظ».
            // إذا كان المستخدم قد بدأ اعتماد مسودة، نكمل من المرحلة المحفوظة.
            const pendingCommit=
                loadCommitTransaction();

            if(pendingCommit){

                setTimeout(
                    ()=>{
                        resumeDraftCommitTransaction()
                            .catch(err=>{
                                console.error(
                                    '[فارس+] resume commit transaction',
                                    err
                                );
                            });
                    },
                    250
                );
            }

            console.log(
                `%c فارس+ | مدير أنشطة التطوير المهني v${META.version} `,
                'background:#173F5F;color:#fff;padding:6px 10px;border-radius:6px',
                {
                    opened,
                    personalCollapsed,
                    personalState: personalSectionState(),
                    state: trainingSectionState(),
                    prefix: detectRowPrefix() || null,
                    rows: rowCount(),
                    pagerPages: pager()?.options?.length || 0
                }
            );
        }
        async function unmount(){
            pd.mounted=false;
            pd.observer?.disconnect();
            pd.observer=null;
            removeNativeValidationGuard();
            byId(`${ID}-bar`)?.remove();
            byId(`${ID}-manager`)?.remove();
            byId(`${ID}-editor`)?.remove();
            byId(`${ID}-style`)?.remove();
            pd.certificateAiBusy.clear();
            // File objects are memory-only and intentionally released when the
            // professional-development module is unmounted.
            pd.certificateResults.forEach(row=>{
                if(row){row.sourceFile=null;row.aiCandidate=null;}
            });
        }
        // واجهة تشخيص صغيرة تبقى متاحة من Console عند الحاجة.
        // لا تنفذ حذفًا أو إرسالًا للموافقة.
        pageWindow.FaresPlusPD = {
            version: META.version,

            diagnose() {
                const p = pager();

                const info = {
                    moduleMatched: matchPage(),
                    personalSectionState: personalSectionState(),
                    personalAriaExpanded:
                        byId('PersonalDetailsRN__xc_')
                            ?.getAttribute('aria-expanded') || null,
                    sectionState: trainingSectionState(),
                    ariaExpanded:
                        byId('TrainingDetailsRN__xc_')
                            ?.getAttribute('aria-expanded') || null,
                    hasTrainingTable: !!byId('TrainingTableRN'),
                    hasContentTable: !!byId('TrainingTableRN:Content'),
                    tableVisible: isVisible(byId('TrainingTableRN:Content')),
                    oraclePrefix: detectRowPrefix() || null,
                    visibleRows: rowCount(),
                    pagerPages: p?.options?.length || 0,
                    pagerIndex: p?.selectedIndex ?? null,
                    pagerText:
                        clean(
                            p?.selectedOptions?.[0]?.textContent || ''
                        ),
                    cachedActivities: pd.activities.length,
                    scanning: pd.scanning,
                    expanding: pd.expanding
                };

                console.table(info);
                return info;
            },

            async expand() {
                const result = await ensureTrainingExpanded();
                this.diagnose();
                return result;
            },

            async rescan() {
                const result = await scan(true);
                this.diagnose();
                return result;
            },

            async openManager() {
                const root = await openManager();

                const info = {
                    exists: !!root,
                    openClass: !!root?.classList.contains('open'),
                    display: root ? getComputedStyle(root).display : null,
                    visibility: root ? getComputedStyle(root).visibility : null,
                    zIndex: root ? getComputedStyle(root).zIndex : null,
                    activities: pd.activities.length,
                    cards:
                        root?.querySelectorAll(`.${ID}-card`).length || 0,
                    bodyText:
                        clean(byId(`${ID}-body`)?.innerText || '')
                            .slice(0,300)
                };

                console.table(info);
                return info;
            },

            recoverIncompleteRow() {
                const stuck=incompleteEditableRow();
                if(!stuck){
                    toast('لا يوجد سطر ناقص قابل للتحرير حاليًا.');
                    return false;
                }
                openStuckRecovery(stuck);
                return true;
            },

            uiState() {
                const root=byId(`${ID}-manager`),q=byId(`${ID}-q`),launcher=document.getElementById(IDS.launcher);
                const info={managerOpen:!!root?.classList.contains('open'),tab:pd.tab,activities:pd.activities.length,searchValue:q?.value??pd.filter.q,searchFocused:document.activeElement===q,resultCount:filtered().length,launcherExists:!!launcher,launcherDisplay:launcher?getComputedStyle(launcher).display:null,launcherVisibility:launcher?getComputedStyle(launcher).visibility:null};
                console.table(info);return info;
            },

            managerState() {
                const root=byId(`${ID}-manager`);

                const info = {
                    exists: !!root,
                    openClass: !!root?.classList.contains('open'),
                    display: root ? getComputedStyle(root).display : null,
                    visibility: root ? getComputedStyle(root).visibility : null,
                    zIndex: root ? getComputedStyle(root).zIndex : null,
                    activities: pd.activities.length,
                    cards:
                        root?.querySelectorAll(`.${ID}-card`).length || 0,
                    bodyExists: !!byId(`${ID}-body`)
                };

                console.table(info);
                return info;
            }
        };

        return {id:'professional-development-activities',match:matchPage,mount,unmount,open:openManager,scan,smartCheck};
    })();


    registerModule(NavigationModule);
    registerModule(ProfessionalDevelopmentModule);

    // =========================================================
    // Core lifecycle
    // =========================================================

    function bindGlobalShortcut() {
        if (pageWindow.__M0HM3D85_FARES_PLUS_SHORTCUT_V061__) return;
        pageWindow.__M0HM3D85_FARES_PLUS_SHORTCUT_V061__ = true;

        const handler = event => {
            const keyK = event.code === 'KeyK' || String(event.key).toLowerCase() === 'k';
            if (!event.altKey || !keyK) return;

            event.preventDefault();
            event.stopPropagation();
            if (typeof event.stopImmediatePropagation === 'function') {
                event.stopImmediatePropagation();
            }

            const overlay = ensureOverlay();
            if (overlay.classList.contains('open')) {
                // إذا كانت النافذة مفتوحة، Alt+K يعيد التركيز بدل إغلاقها.
                focusSearch(6);
            } else {
                NavigationModule.open();
            }
        };

        // الاستماع على window في capture أكثر ثباتًا مع Oracle.
        window.addEventListener('keydown', handler, true);
        document.addEventListener('keydown', handler, true);
    }

    function observeOracleChanges() {
        if (state.observer) return;

        state.observer = new MutationObserver(mutations => {
            const meaningfulMutations = mutations.filter(mutation => {
                const target = mutation.target;

                return !(
                    target instanceof Element &&
                    (
                        target.closest?.(`#${IDS.overlay}`) ||
                        target.closest?.(`#${IDS.launcher}`) ||
                        target.closest?.(`#${IDS.privacy}`) ||
                        target.closest?.(`#${IDS.toast}`) ||
                        target.closest?.(
                            '[data-fares-plus-private-login="1"]'
                        ) ||
                        target.closest?.(
                            '[data-fares-plus-privacy-host="1"]'
                        )
                    )
                );
            });

            if (!meaningfulMutations.length) return;

            const addedRoots = [];

            for (const mutation of meaningfulMutations) {
                for (const node of mutation.addedNodes || []) {
                    if (node instanceof Element) {
                        addedRoots.push(node);
                    }
                }
            }

            ensureLauncher();

            if (addedRoots.length) {
                schedulePrivacyRefresh(addedRoots);
            }

            queueModuleRefresh();

            // إذا فارس+ مفتوح وOracle حدّث القائمة، نقرأ المستوى الحالي مجددًا.
            const overlay = document.getElementById(IDS.overlay);
            if (overlay?.classList.contains('open') && state.nav.ready) {
                clearTimeout(state.nav._refreshTimer);
                state.nav._refreshTimer = setTimeout(() => {
                    const items = NavigationModule.getLevelItems(state.nav.depth);
                    if (items.length) {
                        state.nav.currentItems = items;
                        NavigationModule.rememberItems(
                            items,
                            state.nav.path.map(part => part.label)
                        );
                        NavigationModule.render();
                        focusSearch(2);
                    }
                }, 140);
            }
        });

        state.observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
    }

    pageWindow.FaresPlusPrivacy = {
        version: META.version,

        enable() {
            return setPrivacyMode(true);
        },

        disable() {
            return setPrivacyMode(false);
        },

        toggle() {
            return togglePrivacyMode();
        },

        state() {
            const marked =
                document.querySelectorAll(
                    '[data-fares-plus-private-login="1"]'
                );

            const info = {
                enabled:
                    !!state.settings.privacyMode,
                markedLoginElements:
                    marked.length,
                maskedTextNodes:
                    state.privacyTextMasks.size,
                visibleLoginContainers:
                    visibleLoginContainers(document.body).length,
                loginLineFound:
                    !!(
                        findLoginContainerFast(
                            document.body
                        ) ||
                        findLoginContainerRobust(
                            document.body
                        )
                    ),
                htmlPrivacyAttribute:
                    document.documentElement
                        ?.hasAttribute(
                            'data-fares-plus-privacy'
                        ) || false
            };

            console.table(info);
            return info;
        },

        inspect() {
            const el=document.querySelector(
                '[data-fares-plus-private-login="1"]'
            );

            const style=el
                ? getComputedStyle(el)
                : null;

            const pseudo=el
                ? getComputedStyle(el,'::after')
                : null;

            const info={
                exists:!!el,
                tag:el?.tagName||null,
                visibility:style?.visibility||null,
                color:style?.color||null,
                display:style?.display||null,
                pseudoContent:pseudo?.content||null,
                pseudoVisibility:pseudo?.visibility||null,
                htmlPrivacyAttribute:
                    document.documentElement
                        ?.hasAttribute(
                            'data-fares-plus-privacy'
                        ) || false
            };

            console.table(info);
            return info;
        },

        rescan() {
            const newlyMasked =
                state.settings.privacyMode
                    ? maskLoginIdentityText(document.body)
                    : 0;

            applyPrivacyVisualState({ silent: true });

            const info = {
                newlyMasked,
                maskedTextNodes:
                    state.privacyTextMasks.size,
                visibleLoginContainers:
                    visibleLoginContainers(document.body).length,
                enabled:
                    !!state.settings.privacyMode
            };

            console.table(info);
            return info;
        }
    };

    async function bootstrap() {
        if (!state.settings.enabled) return;
        if (!document.body) {
            await new Promise(resolve => {
                document.addEventListener('DOMContentLoaded', resolve, { once: true });
            });
        }

        injectBaseStyle();
        ensureLauncher();
        ensureOverlay();

        // وضع الخصوصية يستخدم تمويه النص المرئي نفسه.
        applyPrivacyVisualState({ silent: true });

        bindGlobalShortcut();
        await mountMatchingModules();
        observeOracleChanges();

        console.log(
            `%c ${META.name} ${META.version} `,
            'background:#172033;color:#fff;padding:7px 12px;border-radius:7px;font-weight:bold'
        );
        console.log(`Design & Development: ${META.author}`);
    }

    bootstrap();
})();

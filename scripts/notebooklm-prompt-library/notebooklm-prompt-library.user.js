// ==UserScript==
// @name         مكتبة البرومبتات الذكية | NotebookLM
// @name:en      Smart Prompt Library for NotebookLM
// @namespace    https://tampermonkey.net/
// @version      1.1.4
// @description  مكتبة قوالب NotebookLM بمدخل مدمج قرب عنوان الدفتر وتعبئة المتغيرات والنسخ والحفظ.
// @match        https://notebooklm.google.com/*
// @match        https://notebook.google.com/*
// @match        https://notebooklm.google/*
// @run-at       document-idle
// @noframes
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_setClipboard
// @grant        GM_registerMenuCommand
// ==/UserScript==

/*
 * Smart Prompt Library v1.1.4
 * - Does not read notebook content, send requests, or submit prompts automatically.
 * - Prompts are stored only in this userscript's Tampermonkey storage.
 * - Use {{اسم_المتغير}} anywhere in a template to create a fillable field.
 */
(() => {
  'use strict';
  if (window.top !== window.self) return;
  // A page-visible non-sensitive marker helps distinguish an inactive userscript
  // from a DOM anchoring problem. In Console: document.documentElement.dataset.nlplStatus
  const markStatus = (status) => {
    document.documentElement.dataset.nlplVersion = '1.1.4';
    document.documentElement.dataset.nlplStatus = status;
  };
  if (document.getElementById('splt-root')) {
    markStatus('duplicate-script-instance');
    console.warn('[NotebookLM Prompt Library] Another instance is present. Disable previous installed versions.');
    return;
  }
  markStatus('started');
  console.info('[NotebookLM Prompt Library] v1.1.4 executing on', location.host);

  // Trusted Types-safe UI rendering: NotebookLM applies
  // require-trusted-types-for 'script', blocking ShadowRoot.innerHTML and
  // Element.innerHTML (even for Tampermonkey scripts). Build elements via
  // createElement/text nodes and replaceChildren instead; no TT policy,
  // unsafe bypass, eval, or HTML-injection sink is needed.
  function htmlEntities(value) {
    return String(value).replace(/&(?:#(x[\da-f]+|\d+)|amp|lt|gt|quot|apos|nbsp|#39);/gi, (entity, num) => {
      if (num) {
        const n = num[0].toLowerCase() === 'x' ? parseInt(num.slice(1), 16) : parseInt(num, 10);
        return n > 0 && n <= 0x10FFFF && (n < 0xD800 || n > 0xDFFF)
          ? String.fromCodePoint(n) : '\uFFFD';
      }
      return ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&nbsp;': '\u00A0', '&#39;': "'" })[entity.toLowerCase()] || entity;
    });
  }
  function setMarkup(target, markup) {
    const src = String(markup ?? '');
    const frag = document.createDocumentFragment();
    const stack = [frag];
    const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img',
      'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
    let pos = 0;
    while (pos < src.length) {
      const parent = stack[stack.length - 1];
      // CSS is literal text, not markup. Handle style blocks directly.
      if (parent.nodeType === 1 && parent.localName === 'style') {
        const end = src.toLowerCase().indexOf('</style', pos);
        const stop = end < 0 ? src.length : end;
        if (stop > pos) parent.appendChild(document.createTextNode(src.slice(pos, stop)));
        pos = stop;
        if (end < 0) break;
      }
      if (src.startsWith('<!--', pos)) {
        const end = src.indexOf('-->', pos + 4);
        pos = end < 0 ? src.length : end + 3;
        continue;
      }
      if (src.startsWith('</', pos)) {
        const close = /^<\/\s*([a-z][\w:-]*)\s*>/i.exec(src.slice(pos));
        if (close) {
          const name = close[1].toLowerCase();
          for (let j = stack.length - 1; j > 0; j--) {
            if (stack[j].localName === name) { stack.length = j; break; }
          }
          pos += close[0].length;
          continue;
        }
      }
      if (src[pos] === '<') {
        const open = /^<([a-z][\w:-]*)\b/i.exec(src.slice(pos));
        if (open) {
          // Find the closing '>' without mistaking one inside an attribute.
          let end = pos + open[0].length, quote = '';
          while (end < src.length) {
            const ch = src[end];
            if (quote) { if (ch === quote) quote = ''; }
            else if (ch === '"' || ch === "'") quote = ch;
            else if (ch === '>') break;
            end++;
          }
          if (end === src.length) break;
          const name = open[1].toLowerCase();
          const attrs = src.slice(pos + open[0].length, end).replace(/\s*\/\s*$/, '');
          pos = end + 1;
          if (['script', 'iframe', 'object', 'embed', 'base', 'link', 'meta'].includes(name)) continue;
          const el = document.createElement(name);
          const attrPattern = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s\"'=<>\x60]+)))?/g;
          let match;
          while ((match = attrPattern.exec(attrs))) {
            const key = match[1];
            if (/^on/i.test(key) || key.toLowerCase() === 'srcdoc') continue;
            el.setAttribute(key, htmlEntities(match[2] ?? match[3] ?? match[4] ?? ''));
          }
          parent.appendChild(el);
          if (!voidTags.has(name)) stack.push(el);
          continue;
        }
      }
      const next = src.indexOf('<', pos + 1);
      const end = next < 0 ? src.length : next;
      parent.appendChild(document.createTextNode(htmlEntities(src.slice(pos, end))));
      pos = end;
    }
    target.replaceChildren(frag);
  }

  // This bootstrap is independent of library storage and Chat DOM.
  // The entry stays an inline sibling of NotebookLM's title field (never fixed).
  let bootStage = 'header-entry';
  document.documentElement.dataset.nlplStage = 'header-entry';
  const headerHost = document.createElement('span');
  headerHost.id = 'splt-header-entry';
  headerHost.setAttribute('role', 'group');
  headerHost.style.cssText = 'display:inline-flex;flex:0 0 auto;align-items:center;max-width:190px;min-width:0;vertical-align:middle;margin-inline:8px;position:relative;z-index:1;';
  const headerShadow = headerHost.attachShadow({ mode: 'open' });
  setMarkup(headerShadow, `<style>
    :host { display:inline-flex; flex:0 0 auto; vertical-align:middle; max-width:190px; }
    button { display:inline-flex;align-items:center;justify-content:center;gap:5px;min-width:0;white-space:nowrap;padding:7px 10px;border-radius:9px;border:1px solid #c7d9df;background:#eef6f8;color:#174c5b;font:700 12px/1.35 Tahoma,Arial,sans-serif;direction:rtl;cursor:pointer; }
    button:hover { background:#e2f0f3; }
    button[aria-expanded="true"] { background:#d8edef;border-color:#87bec9; }
  </style><button type="button" id="open-library" aria-expanded="false" aria-label="فتح مكتبة البرومبتات">📋 البرومبتات</button>`);
  const headerButton = headerShadow.querySelector('#open-library');
  let headerClick = () => console.warn('[NotebookLM Prompt Library] Library is not ready yet:', bootStage);
  headerButton.addEventListener('click', () => headerClick());

  function attachHeaderEntry() {
    const input = document.querySelector('input.title-input');
    let anchor = input;
    if (anchor) {
      // Group the title input with its adjacent wrapper, but do not climb to
      // the full toolbar. Keeps our control beside the notebook title.
      const initial = anchor.getBoundingClientRect();
      for (let i = 0; i < 3 && anchor.parentElement; i++) {
        const p = anchor.parentElement;
        const r = p.getBoundingClientRect();
        if (r.width > Math.max(790, initial.width * 2.2) || r.height > 86) break;
        if (p.matches('header, mat-toolbar, nav')) break;
        anchor = p;
      }
    } else {
      // A true inline fallback, not a floating launcher.
      anchor = document.querySelector('.panel-header-content, section.chat-panel, .panel-container');
    }
    if (!anchor?.parentElement) return false;
    if (headerHost.parentNode !== anchor.parentNode || headerHost.previousSibling !== anchor) {
      anchor.parentNode.insertBefore(headerHost, anchor.nextSibling);
    }
    return true;
  }
  attachHeaderEntry();
  markStatus('header-ready');
  document.documentElement.dataset.nlplStage = 'header-ready';

  try {
    bootStage = 'library-storage';
  const DB_KEY = 'smartPromptLibrary:database:v1';
  const PLACEHOLDER = /\{\{\s*([^{}]+?)\s*\}\}/g;
  const FIELD_NAME = /^[\p{L}\p{N}_-]{1,50}$/u;
  const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID() : `p-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const now = () => new Date().toISOString();
  const escapeHTML = (v) => String(v ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
  const cleanText = (v, max = 50000) => String(v ?? '').slice(0, max);
  const extractKeys = (body) => {
    const found = new Set();
    for (const m of String(body || '').matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)) {
      const key = m[1].trim();
      if (FIELD_NAME.test(key)) found.add(key);
    }
    return [...found];
  };
  const titleFor = (key) => key.replace(/_/g, ' ');

  const STARTER_TEXT = `احتاج اعتمد حصريًا على **المصدر المرفق**، وأنشئ أسئلة لقياس فهم الطلاب للدرس المحدد:
**الدرس: {{عنوان_الدرس}}**
**الوحدة: {{اسم_الوحدة}}**
**عدد الأسئلة المطلوب: {{عدد_الأسئلة}}**

يجب أن تكون جميع الأسئلة مرتبطة **بهذا الدرس فقط**، ولا تستخدم أي معلومات من دروس أخرى أو من خارج المصدر.

## **الهدف**

الأسئلة ليست اختبارًا تشخيصيًا ولا أسئلة حفظ مباشر، وإنما **أسئلة لقياس فهم الطالب للدرس بعد شرحه**.

ركز على قدرة الطالب على:

- فهم المفاهيم الأساسية في الدرس.
- التمييز بين المفاهيم أو المصطلحات المتشابهة.
- فهم وظيفة الأدوات أو العناصر الواردة في الدرس.
- تفسير سبب استخدام شيء معين.
- تحديد العلاقة بين المفاهيم.
- توقع النتيجة الصحيحة في موقف مرتبط بالدرس.
- تطبيق ما تعلمه على موقف بسيط أو مثال جديد.
- فهم ترتيب الخطوات أو الغرض منها عندما يكون ذلك مناسبًا.

تجنب الأسئلة التي تعتمد فقط على الحفظ الحرفي أو استرجاع جملة مباشرة من الكتاب متى أمكن بناء سؤال يقيس الفهم.

## **عدد ونوع الأسئلة**

أنشئ **{{عدد_الأسئلة}}** أسئلة بالضبط.

جميع الأسئلة من نوع **الاختيار**.

في خانة النوع يكتب:

**اختيار**

ولا تستخدم كلمة **متعدد**.

## **شروط كل سؤال**

- يحتوي على **4 خيارات بالضبط**: أ، ب، ج، د.
- توجد **إجابة صحيحة واحدة فقط**.
- اجعل المشتتات منطقية وقريبة من موضوع السؤال بحيث تكشف مدى فهم الطالب.
- تجنب الخيارات الواضحة جدًا أو غير المنطقية.
- لا تستخدم:
  - جميع ما سبق.
  - لا شيء مما سبق.
- وزع الإجابات الصحيحة بين **أ، ب، ج، د** بصورة متنوعة وغير متوقعة بقدر ما يسمح به عدد الأسئلة.
- لا تجعل نمط الإجابات الصحيحة متكررًا أو سهل التخمين.
- اجعل كل سؤال **بدرجة {{درجة_السؤال}}**.
- مطلوب = **نعم**.

## **ضوابط المحتوى**

- استخدم فقط معلومات يمكن إثباتها من **الدرس المحدد في الوحدة المحددة داخل المصدر المرفق**.
- لا تدخل معلومات من معرفتك العامة حتى لو كانت صحيحة.
- لا تخرج إلى دروس أخرى في الوحدة نفسها.
- لا تكرر أي سؤال.
- لا تكرر الفكرة نفسها بصياغة مختلفة.
- اجعل الأسئلة متنوعة في الأفكار التي تقيسها.
- استخدم لغة واضحة ومناسبة لطلاب **{{الصف_الدراسي}}**.
- تجنب الغموض أو وجود أكثر من إجابة يمكن الدفاع عنها.
- إذا كان الدرس يتضمن جانبًا عمليًا، فلا تطلب من الطالب تنفيذ المهمة فعليًا، وإنما يمكن السؤال نظريًا عن:
  - وظيفة أداة.
  - سبب استخدام أمر.
  - الخطوة المناسبة.
  - ترتيب الخطوات.
  - النتيجة المتوقعة.
  - الاختيار الصحيح في موقف تطبيقي.

## **المراجعة قبل الإخراج**

أنشئ الأسئلة أولًا، ثم راجعها قبل إخراجها للتأكد من:

1. أن جميعها تخص **{{عنوان_الدرس}}** في **{{اسم_الوحدة}}** فقط.
2. أن عددها **{{عدد_الأسئلة}}** بالضبط.
3. أن جميعها من نوع **اختيار**.
4. أن لكل سؤال 4 خيارات بالضبط.
5. أن لكل سؤال إجابة صحيحة واحدة فقط.
6. عدم وجود تكرار في السؤال أو الفكرة.
7. أن الأسئلة تقيس **الفهم** أكثر من الحفظ.
8. أن جميع المعلومات مستندة حصريًا إلى المصدر المرفق.
9. أن المشتتات منطقية ومناسبة.
10. أن الإجابات الصحيحة موزعة بشكل متنوع بين أ، ب، ج، د.`;

  const starter = () => ({
    id: 'starter-forms-questions-v1',
    title: 'برومبت أسئلة الفورمز',
    category: 'أسئلة وتقييم',
    description: 'أسئلة لقياس الفهم بعد الشرح، مقيدة بالدرس والوحدة والمصدر المرفق.',
    favorite: true,
    body: STARTER_TEXT,
    vars: {
      'عنوان_الدرس': { label: 'اسم الدرس', type: 'text', defaultValue: 'الدرس الأول: مقدمة في الأمن السيبراني', required: true },
      'اسم_الوحدة': { label: 'اسم الوحدة', type: 'text', defaultValue: '', required: true },
      'عدد_الأسئلة': { label: 'عدد الأسئلة', type: 'number', defaultValue: '5', required: true },
      'درجة_السؤال': { label: 'درجة كل سؤال', type: 'number', defaultValue: '1', required: true },
      'الصف_الدراسي': { label: 'الصف الدراسي', type: 'text', defaultValue: 'الصف الثالث المتوسط', required: true }
    },
    createdAt: now(), updatedAt: now()
  });

  const normalizeVars = (raw) => {
    const out = {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    for (const [key, v] of Object.entries(raw).slice(0, 100)) {
      if (!FIELD_NAME.test(key)) continue;
      const x = v && typeof v === 'object' && !Array.isArray(v) ? v : {};
      const type = ['text', 'textarea', 'number', 'select'].includes(x.type) ? x.type : 'text';
      out[key] = {
        label: cleanText(x.label || titleFor(key), 90),
        type,
        defaultValue: cleanText(x.defaultValue, 30000),
        required: x.required !== false,
        options: Array.isArray(x.options)
          ? x.options.map(y => cleanText(y, 200)).filter(Boolean).slice(0, 40)
          : []
      };
    }
    return out;
  };
  const normalizePrompt = (p) => {
    if (!p || typeof p !== 'object' || Array.isArray(p)) return null;
    const title = cleanText(p.title, 140).trim();
    const body = cleanText(p.body, 100000).trim();
    if (!title || !body) return null;
    return {
      id: typeof p.id === 'string' && p.id.length < 180 && p.id ? p.id : uid(),
      title, body,
      description: cleanText(p.description, 400),
      category: cleanText(p.category || 'عام', 90),
      favorite: Boolean(p.favorite),
      vars: normalizeVars(p.vars),
      createdAt: typeof p.createdAt === 'string' ? p.createdAt : now(),
      updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : now()
    };
  };
  function loadDB() {
    let raw;
    try { raw = GM_getValue(DB_KEY, null); } catch (e) { console.warn('Prompt library load failed:', e); }
    if (raw && Array.isArray(raw.prompts)) {
      const prompts = raw.prompts.map(normalizePrompt).filter(Boolean);
      const ids = new Set();
      for (const p of prompts) {
        if (ids.has(p.id)) p.id = uid();
        ids.add(p.id);
      }
      return {
        schema: 1, prompts,
        values: raw.values && typeof raw.values === 'object' && !Array.isArray(raw.values) ? raw.values : {},
        lastSelectedId: raw.lastSelectedId || (prompts[0] && prompts[0].id) || null
      };
    }
    return { schema: 1, prompts: [starter()], values: {}, lastSelectedId: 'starter-forms-questions-v1' };
  }
  let db = loadDB();
  const persist = () => {
    try { GM_setValue(DB_KEY, db); } catch (e) { console.error('Prompt library save failed:', e); toast('تعذر حفظ التغييرات في Tampermonkey', true); }
  };
  // Persist initial seed after UI is available for error reporting.

  let opened = false;
  let editing = null;
  let editingBaseline = null;
  let filterText = '';
  let filterCategory = 'الكل';
  let favoriteOnly = false;
  let importMode = 'merge';
  let toastTimer = null;
  bootStage = 'library-element';
  const root = document.createElement('div');
  root.id = 'splt-root';
  root.classList.add('splt-header-mode');
  // The host stays detached until a real notebook chat composer is found.
  // No fixed launcher, modal, overlay, or page-wide floating element is created.
  const shadow = root.attachShadow({ mode: 'open' });
  setMarkup(shadow, `
    <style>
      :host { all: initial; box-sizing: border-box; display: block; flex: 0 0 auto; align-self: stretch; width: auto; min-width: 0; min-height: 40px; margin: 8px 12px; position: relative; z-index: 4; isolation: isolate; }
      :host(.splt-header-mode) { display:none; min-height:0; margin:0 12px; }
      :host(.splt-header-mode.splt-expanded) { display:block; }
      :host(.splt-header-mode) .launch { display:none !important; }

      *, *::before, *::after { box-sizing: border-box; }
      [hidden] { display: none !important; }
      /* Inline accordion INSIDE the notebook chat, not a floating tool. */
      .launch { position: static; display: flex; align-items: center; justify-content: space-between; width: 100%; min-height: 40px; background: #fff; color: #1a5863; border: 1px solid #d5e0e4; border-radius: 12px; font: 700 13px/1.5 Tahoma,Arial,sans-serif; padding: 9px 12px; cursor: pointer; box-shadow: none; direction: rtl; text-align: right; }
      .launch::after { content: '▾'; color: #58777f; margin-right: auto; margin-left: 0; }
      .launch[aria-expanded="true"] { border-radius: 12px 12px 0 0; background: #edf5f6; }
      .launch[aria-expanded="true"]::after { content: '▴'; }
      .launch:hover { background: #eff6f8; }
      .panel { position: static; width: 100%; max-width: 100%; height: min(570px, 62dvh); min-height: 260px; background: #f7f9fa; border: 1px solid #d5e0e4; border-top: none; border-radius: 0 0 12px 12px; box-shadow: none; display: flex; flex-direction: column; overflow: hidden; direction: rtl; text-align: right; color: #19313a; font: 13px/1.75 Tahoma,Arial,sans-serif; }
      button,input,select,textarea { font: inherit; }
      button { cursor: pointer; }
      button:focus-visible, input:focus-visible,select:focus-visible,textarea:focus-visible { outline: 2px solid #1c7890; outline-offset: 2px; }
      .head { display: flex; align-items: center; gap: 10px; padding: 12px 16px; background: #fff; border-bottom: 1px solid #dce7eb; }
      .brand { flex: 1; min-width: 0; }
      .brand strong { display: block; font-size: 16px; line-height: 1.3; color: #134b5b; }
      .brand small { color: #647b86; }
      .head-actions { display: flex; flex-wrap: wrap; gap: 5px; }
      .btn { border: 1px solid #cbd9dc; background: white; color: #1a4a57; border-radius: 9px; padding: 7px 10px; line-height: 1.5; font-weight: 700; }
      .btn:hover { background: #eaf4f6; }
      .btn.primary { background: #14616e; color: white; border-color: #14616e; }
      .btn.primary:hover { background: #0b4c58; }
      .btn.danger { color: #b23b3b; border-color: #ecc3c3; }
      .btn.small { padding: 3px 8px; font-size: 12px; }
      .close { width: 32px; height: 32px; border: 0; border-radius: 10px; background: #edf2f4; color: #374f59; font-size: 19px; }
      .workspace { min-height: 0; flex: 1; display: flex; flex-direction: column; }
      .side { width: 100%; flex: 0 0 auto; display: flex; flex-direction: column; background: #fff; border-bottom: 1px solid #dce7eb; max-height: 166px; min-height: 0; }
      .filters { padding: 7px 10px; border-bottom: 1px solid #e1eaed; display: flex; gap: 6px; align-items: center; }
      .filters > .input { flex: 1; }
      .filters > .filterline { flex: 1; min-width: 0; }
      .input, .textarea,.select { display: block; width: 100%; border: 1px solid #ccd9de; border-radius: 9px; background: #fff; color: #19313a; padding: 8px 10px; line-height: 1.65; min-width: 0; }
      .textarea { resize: vertical; min-height: 92px; }
      .filterline { display: flex; align-items: center; gap: 7px; }
      .checklabel { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; color: #51636e; }
      .items { display: flex; gap: 5px; overflow: auto; padding: 7px 10px; min-height: 49px; flex: 1; }
      .item { display: flex; align-items: stretch; gap: 3px; border: 1px solid transparent; border-radius: 10px; margin: 0; background: #f8fafb; min-width: 180px; max-width: 240px; }
      .item.selected { border-color: #91c5cd; background: #eaf6f7; }
      .item-open { padding: 8px 10px; background: none; border: 0; color: inherit; text-align: right; flex: 1; min-width: 0; }
      .item-open strong { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .item-open small { display: block; color: #64808a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .star { border: 0; background: transparent; color: #7b93a0; padding: 0 10px; font-size: 20px; }
      .star.isfav { color: #ba7b10; }
      .main { flex: 1; overflow: auto; min-width: 0; min-height: 0; padding: 12px; }
      .mainhead { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
      .mainhead .titleblock { flex: 1; min-width: 0; }
      h2 { font: 700 20px/1.4 Tahoma,Arial,sans-serif; margin: 0 0 5px; color: #183e4a; }
      h3 { font-size: 14px; margin: 18px 0 8px; color: #214c59; }
      .muted { color: #637e89; margin: 0; }
      .tag { display: inline-block; background: #e7f0f1; color: #2e6771; font-size: 11px; padding: 1px 8px; border-radius: 20px; margin-top: 3px; }
      .actions { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
      .fields { display: grid; grid-template-columns: repeat(auto-fit,minmax(min(100%,185px),1fr)); gap: 9px; }
      .field { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
      .field .label { font-weight: 700; color: #2a5965; }
      .field .hint { color: #7b9198; font: 11px Tahoma,Arial,sans-serif; }
      .output { border: 1px solid #d2e0e5; border-radius: 12px; background: #fff; margin-top: 8px; overflow: hidden; }
      .outputhead { display: flex; justify-content: space-between; align-items: center; gap: 8px; background: #eff5f6; padding: 8px 12px; color: #47626f; font-size: 12px; }
      pre { margin: 0; padding: 14px; white-space: pre-wrap; overflow-wrap: anywhere; unicode-bidi: plaintext; direction: rtl; text-align: right; font: 12px/1.95 Tahoma,Arial,sans-serif; max-height: 255px; overflow: auto; }
      .warning { color: #a24b00; font-size: 12px; margin: 6px 0; }
      .good { color: #187054; }
      .editfields { display: grid; grid-template-columns: repeat(auto-fit,minmax(min(100%,185px),1fr)); gap: 9px; }
      .var-config { background: #fff; border: 1px solid #d8e4e7; border-radius: 10px; padding: 11px; margin: 8px 0; }
      .var-config code { direction: ltr; unicode-bidi: isolate; color: #57727b; }
      .var-grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(min(100%,185px),1fr)); gap: 8px; margin: 6px 0; }
      .insert-line { display: flex; gap: 7px; align-items: center; margin-top: 8px; }
      .footerhint { border-top: 1px solid #dce7eb; padding: 7px 15px; background: #fff; color: #718993; font-size: 11px; }
      .toast { position: absolute; z-index: 5; bottom: 45px; left: 50%; transform: translateX(-50%); background: #184d58; color: #fff; padding: 8px 16px; border-radius: 10px; max-width: 90%; box-shadow: 0 8px 25px #0c283855; text-align: center; }
      .toast.error { background: #993b36; }
      .empty { color: #64808a; padding: 20px 6px; text-align: center; }
      @media (max-width: 760px) {
        .panel { height: min(560px, 65dvh); }
        .filters { flex-wrap: wrap; padding: 6px; }
        .filters > .input, .filters > .filterline { flex: 1 1 170px; }
        .head { padding: 8px; flex-wrap: wrap; }
        .brand { flex: 1 1 100%; }
        .head-actions { flex: 1; }
        .btn { padding: 5px 8px; }
        .mainhead { flex-wrap: wrap; }
        .items { padding: 4px 6px; }
      }
      @media (prefers-reduced-motion: no-preference) { .launch, .btn { transition: background-color .15s ease; } }
    </style>
    <button id="splt-launch" class="launch" aria-expanded="false" aria-controls="splt-panel">📋 مكتبة البرومبتات</button>
    <section id="splt-panel" class="panel" aria-label="مكتبة البرومبتات الذكية" hidden>
      <header class="head">
        <div class="brand"><strong>مكتبة البرومبتات الذكية</strong><small>قوالب جاهزة • تعبئة • نسخ مباشر</small></div>
        <div class="head-actions">
          <button class="btn small" data-action="export">⬇ تصدير</button>
          <button class="btn small" data-action="import-merge" title="دمج قوالب النسخة الاحتياطية مع القوالب الحالية">⬆ استيراد</button>
          <button class="btn small" data-action="import-replace" title="استبدال المكتبة الحالية بالكامل من ملف احتياطي">استبدال</button>
          <button class="btn primary small" data-action="new">+ قالب جديد</button>
        </div>
        <button class="close" data-action="close" aria-label="إغلاق">×</button>
      </header>
      <div class="workspace">
        <aside class="side">
          <div class="filters">
            <input id="splt-search" class="input" placeholder="ابحث باسم البرومبت أو محتواه..." aria-label="بحث في القوالب">
            <div class="filterline">
              <select id="splt-category" class="select" aria-label="تصفية حسب التصنيف"></select>
              <label class="checklabel"><input id="splt-favonly" type="checkbox"> المفضلة</label>
            </div>
          </div>
          <div id="splt-items" class="items" aria-label="القوالب المحفوظة"></div>
        </aside>
        <main id="splt-main" class="main"></main>
      </div>
      <div class="footerhint">محفوظة تلقائيًا • نسخ فقط دون إرسال • Alt + Shift + L</div>
      <div id="splt-toast" class="toast" role="status" aria-live="polite" hidden></div>
      <input id="splt-file" type="file" accept=".json,application/json" hidden>
    </section>`);
  const $ = (sel) => shadow.querySelector(sel);
  const launch = $('#splt-launch');
  const panel = $('#splt-panel');
  const main = $('#splt-main');

  function toast(message, error = false) {
    const node = $('#splt-toast');
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('error', Boolean(error));
    node.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { node.hidden = true; }, 3800);
  }
  const selected = () => db.prompts.find(p => p.id === db.lastSelectedId) || db.prompts[0] || null;
  const currentValues = (p) => {
    if (!db.values[p.id] || typeof db.values[p.id] !== 'object' || Array.isArray(db.values[p.id])) db.values[p.id] = {};
    return db.values[p.id];
  };
  const fieldMeta = (p, key) => ({
    label: titleFor(key), type: 'text', defaultValue: '', required: true, options: [],
    ...(p.vars[key] || {})
  });
  const getFieldValue = (p, key) => {
    const v = currentValues(p);
    return Object.prototype.hasOwnProperty.call(v, key) ? String(v[key] ?? '') : String(fieldMeta(p, key).defaultValue ?? '');
  };
  function compiled(p) {
    if (!p) return { text: '', missing: [] };
    const missing = [];
    const valid = new Set(extractKeys(p.body));
    const text = p.body.replace(PLACEHOLDER, (full, raw) => {
      const key = raw.trim();
      if (!valid.has(key)) return full;
      const value = getFieldValue(p, key).trim();
      const meta = fieldMeta(p, key);
      if (!value && meta.required && !missing.includes(meta.label)) missing.push(meta.label);
      return value;
    });
    return { text, missing };
  }
  function toggleOpen(force) {
    opened = typeof force === 'boolean' ? force : !opened;
    panel.hidden = !opened;
    root.classList.toggle('splt-expanded', opened);
    headerButton.setAttribute('aria-expanded', String(opened));
    if (opened) ensureMounted();
    launch.setAttribute('aria-expanded', String(opened));
    launch.textContent = opened ? '📋 إخفاء مكتبة البرومبتات' : '📋 مكتبة البرومبتات';
    if (opened) { renderList(); renderMain(); }
  }
  function renderList() {
    const cats = [...new Set(db.prompts.map(p => p.category))].sort((a,b) => a.localeCompare(b,'ar'));
    if (filterCategory !== 'الكل' && !cats.includes(filterCategory)) filterCategory = 'الكل';
    setMarkup($('#splt-category'), `<option value="الكل">جميع التصنيفات</option>` +
      cats.map(c => `<option value="${escapeHTML(c)}" ${filterCategory === c ? 'selected' : ''}>${escapeHTML(c)}</option>`).join(''));
    $('#splt-favonly').checked = favoriteOnly;
    const term = filterText.trim().toLocaleLowerCase('ar');
    const filtered = [...db.prompts].filter(p =>
      (filterCategory === 'الكل' || p.category === filterCategory) &&
      (!favoriteOnly || p.favorite) &&
      (!term || `${p.title} ${p.category} ${p.description} ${p.body}`.toLocaleLowerCase('ar').includes(term))
    ).sort((a,b) => Number(b.favorite) - Number(a.favorite) ||
      (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    setMarkup($('#splt-items'), filtered.length ? filtered.map(p => `
      <div class="item ${selected()?.id === p.id ? 'selected' : ''}">
        <button class="item-open" data-action="select" data-id="${escapeHTML(p.id)}" title="${escapeHTML(p.title)}">
          <strong>${escapeHTML(p.title)}</strong><small>${escapeHTML(p.category)} · ${extractKeys(p.body).length} حقول</small>
        </button>
        <button class="star ${p.favorite ? 'isfav' : ''}" data-action="favorite" data-id="${escapeHTML(p.id)}" aria-label="${p.favorite ? 'إزالة من' : 'إضافة إلى'} المفضلة" title="المفضلة">${p.favorite ? '★' : '☆'}</button>
      </div>`).join('') : '<div class="empty">لا توجد قوالب مطابقة.<div><button class="btn small" data-action="new">إنشاء قالب</button></div></div>');
  }
  function fieldInput(p, key) {
    const meta = fieldMeta(p, key);
    const value = getFieldValue(p, key);
    const action = `data-action="value" data-key="${escapeHTML(key)}"`;
    let control;
    if (meta.type === 'textarea') {
      control = `<textarea rows="2" class="textarea" ${action}>${escapeHTML(value)}</textarea>`;
    } else if (meta.type === 'select' && meta.options.length) {
      const opts = [...new Set([value, ...meta.options])];
      control = `<select class="select" ${action}>${opts.map(v => `<option value="${escapeHTML(v)}" ${v === value ? 'selected' : ''}>${escapeHTML(v || '— اختر —')}</option>`).join('')}</select>`;
    } else {
      control = `<input class="input" type="${meta.type === 'number' ? 'number' : 'text'}" ${meta.type === 'number' ? 'min="0" step="any"' : ''} value="${escapeHTML(value)}" ${action} placeholder="${escapeHTML(meta.label)}">`;
    }
    return `<label class="field"><span class="label">${escapeHTML(meta.label)} ${meta.required ? '<span aria-label="مطلوب">*</span>' : ''}</span>${control}</label>`;
  }
  function renderDetails() {
    const p = selected();
    if (!p) {
      setMarkup(main, '<div class="empty"><h2>مكتبتك جاهزة</h2><p>أنشئ قالبًا جديدًا أو استورد نسخة احتياطية.</p><button class="btn primary" data-action="restore-starter">إضافة قالب أسئلة الفورمز</button></div>');
      return;
    }
    const keys = extractKeys(p.body);
    setMarkup(main, `
      <div class="mainhead">
        <div class="titleblock"><h2>${escapeHTML(p.title)}</h2><p class="muted">${escapeHTML(p.description)}</p><span class="tag">${escapeHTML(p.category)}</span></div>
        <div class="actions">
          <button class="btn small" data-action="edit">تعديل</button>
          <button class="btn small" data-action="duplicate">نسخ قالب</button>
          <button class="btn danger small" data-action="delete">حذف</button>
        </div>
      </div>
      <h3>المتغيرات القابلة للتعبئة <small class="muted">(${keys.length})</small></h3>
      <div class="fields">${keys.length ? keys.map(k => fieldInput(p,k)).join('') : '<span class="muted">هذا القالب ثابت، ويمكن نسخه مباشرة.</span>'}</div>
      <div class="actions" style="margin-top:15px">
        <button class="btn primary" data-action="copy" id="splt-copy">📋 نسخ البرومبت النهائي</button>
        <button class="btn" data-action="reset-values">إعادة القيم الافتراضية</button>
        <span id="splt-validation" class="warning" aria-live="polite"></span>
      </div>
      <section class="output" aria-label="معاينة البرومبت">
        <div class="outputhead"><strong>معاينة مباشرة للنص النهائي</strong><span id="splt-count"></span></div>
        <pre id="splt-preview"></pre>
      </section>`);
    refreshPreview();
  }
  function refreshPreview() {
    const pre = $('#splt-preview');
    if (!pre) return;
    const p = selected();
    const result = compiled(p);
    pre.textContent = result.text;
    $('#splt-count').textContent = `${result.text.length.toLocaleString('ar-SA')} حرف`;
    const warn = $('#splt-validation');
    if (result.missing.length) {
      warn.className = 'warning';
      warn.textContent = `أكمل: ${result.missing.join('، ')}`;
    } else {
      warn.className = 'warning good';
      warn.textContent = '✓ جاهز للنسخ';
    }
  }
  function clonePrompt(p) { return JSON.parse(JSON.stringify(p)); }
  function startEditing(isNew = false) {
    if (editing && !discardEditing()) return;
    const p = selected();
    editing = isNew ? {
      id: uid(), title: '', category: 'عام', description: '', favorite: false,
      body: '', vars: {}, createdAt: now(), updatedAt: now()
    } : clonePrompt(p);
    editingBaseline = JSON.stringify(editing);
    renderMain();
  }
  function discardEditing() {
    if (!editing) return true;
    if (JSON.stringify(editing) !== editingBaseline && !window.confirm('لديك تغييرات غير محفوظة. هل تريد تجاهلها؟')) return false;
    editing = null;
    editingBaseline = null;
    return true;
  }
  function renderEditor() {
    const d = editing;
    setMarkup(main, `
      <div class="mainhead"><div class="titleblock"><h2>${db.prompts.some(p => p.id === d.id) ? 'تعديل البرومبت' : 'قالب جديد'}</h2><p class="muted">أي نص على الشكل <code>{{اسم_الحقل}}</code> يتحول إلى خانة تعبئة تلقائيًا.</p></div>
        <div class="actions"><button class="btn primary" data-action="save-draft">حفظ القالب</button><button class="btn" data-action="cancel-draft">إلغاء</button></div>
      </div>
      <div class="editfields">
        <label class="field"><span class="label">اسم البرومبت *</span><input class="input" data-action="draft-title" value="${escapeHTML(d.title)}" placeholder="مثال: أسئلة نهاية الدرس"></label>
        <label class="field"><span class="label">التصنيف</span><input class="input" data-action="draft-category" value="${escapeHTML(d.category)}" placeholder="أسئلة وتقييم"></label>
      </div>
      <label class="field" style="margin-top:10px"><span class="label">وصف قصير</span><input class="input" data-action="draft-description" value="${escapeHTML(d.description)}"></label>
      <label class="field" style="margin-top:10px"><span class="label">نص البرومبت *</span><textarea id="splt-template-body" class="textarea" data-action="draft-body" rows="13" dir="auto" spellcheck="false">${escapeHTML(d.body)}</textarea></label>
      <div class="insert-line"><input id="splt-new-field" class="input" placeholder="اسم_المتغير (مثال: اسم_الدرس)"><button class="btn" data-action="insert-var">+ إدراج خانة</button></div>
      <h3>إعدادات الخانات <small class="muted">(تُستخرج من النص تلقائيًا)</small></h3>
      <div id="splt-field-editor"></div>
      <div class="actions" style="padding-bottom:16px"><button class="btn primary" data-action="save-draft">حفظ القالب</button><button class="btn" data-action="cancel-draft">إلغاء</button></div>`);
    renderFieldEditor();
  }
  function renderFieldEditor() {
    if (!editing) return;
    const keys = extractKeys(editing.body);
    setMarkup($('#splt-field-editor'), keys.length ? keys.map(key => {
      const m = fieldMeta(editing, key);
      return `<div class="var-config" data-field="${escapeHTML(key)}">
        <div>المتغير: <code>{{${escapeHTML(key)}}}</code></div>
        <div class="var-grid">
          <label class="field"><span class="label">اسم الخانة الظاهر</span><input class="input" data-action="var-label" data-key="${escapeHTML(key)}" value="${escapeHTML(m.label)}"></label>
          <label class="field"><span class="label">نوع الخانة</span><select class="select" data-action="var-type" data-key="${escapeHTML(key)}">
            ${[['text','نص قصير'],['textarea','نص طويل'],['number','رقم'],['select','قائمة خيارات']].map(([v,t]) => `<option value="${v}" ${m.type === v ? 'selected' : ''}>${t}</option>`).join('')}
          </select></label>
          <label class="field"><span class="label">قيمة افتراضية</span><input class="input" data-action="var-default" data-key="${escapeHTML(key)}" value="${escapeHTML(m.defaultValue)}"></label>
          <label class="field"><span class="label">خيارات القائمة (افصل بفاصلة)</span><input class="input" data-action="var-options" data-key="${escapeHTML(key)}" value="${escapeHTML(m.options.join('، '))}" placeholder="خيار 1، خيار 2"></label>
        </div>
        <label class="checklabel"><input type="checkbox" data-action="var-required" data-key="${escapeHTML(key)}" ${m.required ? 'checked' : ''}> خانة مطلوبة قبل النسخ</label>
      </div>`;
    }).join('') : '<p class="muted">اكتب {{اسم_المتغير}} في نص البرومبت، وستظهر إعدادات الحقل هنا.</p>');
  }
  function renderMain() { editing ? renderEditor() : renderDetails(); }
  async function copyPrompt() {
    const p = selected();
    if (!p) return;
    const result = compiled(p);
    if (result.missing.length) {
      toast(`أكمل الحقول المطلوبة: ${result.missing.join('، ')}`, true);
      const first = [...shadow.querySelectorAll('[data-action="value"]')].find(el =>
        !getFieldValue(p, el.dataset.key).trim() && fieldMeta(p, el.dataset.key).required);
      if (first) first.focus();
      return;
    }
    for (const key of extractKeys(p.body)) {
      const meta = fieldMeta(p, key);
      if (meta.type !== 'number') continue;
      const value = getFieldValue(p, key).trim();
      if (!value && !meta.required) continue;
      const n = Number(value);
      if (!Number.isFinite(n) || n <= 0 || (key === 'عدد_الأسئلة' && !Number.isInteger(n))) {
        toast(`أدخل رقمًا موجبًا صحيحًا في «${meta.label}»${key === 'عدد_الأسئلة' ? ' (عدد صحيح)' : ''}.`, true);
        const field = [...shadow.querySelectorAll('[data-action="value"]')].find(el => el.dataset.key === key);
        if (field) field.focus();
        return;
      }
    }
    if (result.text.includes('{{') && result.text.includes('}}')) {
      if (!window.confirm('لا تزال هناك صيغة تشبه {{متغير}} داخل النص. هل تريد نسخ النص على أي حال؟')) return;
    }
    try {
      try { await navigator.clipboard.writeText(result.text); }
      catch (_) { GM_setClipboard(result.text, 'text'); }
      toast('✓ تم نسخ البرومبت النهائي، الصقه في NotebookLM.');
    } catch (error) {
      console.error(error);
      toast('تعذر النسخ التلقائي؛ حدد النص من المعاينة وانسخه يدويًا.', true);
    }
  }
  function saveDraft() {
    if (!editing) return;
    const raw = clonePrompt(editing);
    raw.title = raw.title.trim();
    raw.body = raw.body.trim();
    raw.category = raw.category.trim() || 'عام';
    if (!raw.title) { toast('أدخل اسمًا للبرومبت.', true); main.querySelector('[data-action="draft-title"]').focus(); return; }
    if (!raw.body) { toast('نص البرومبت لا يمكن أن يكون فارغًا.', true); $('#splt-template-body').focus(); return; }
    const keys = new Set(extractKeys(raw.body));
    raw.vars = Object.fromEntries(Object.entries(raw.vars).filter(([k]) => keys.has(k)));
    raw.updatedAt = now();
    const p = normalizePrompt(raw);
    const index = db.prompts.findIndex(item => item.id === p.id);
    if (index >= 0) db.prompts[index] = p;
    else db.prompts.unshift(p);
    db.lastSelectedId = p.id;
    editing = null;
    editingBaseline = null;
    persist();
    renderList(); renderMain();
    toast('✓ تم حفظ القالب.');
  }
  function exportData() {
    const blob = new Blob([JSON.stringify({ format: 'SmartPromptLibrary', schema: 1, exportedAt: now(), ...db }, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `notebooklm-prompts-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    toast(`تم تصدير ${db.prompts.length} قالب كنسخة احتياطية.`);
  }
  async function importFile(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast('ملف الاستيراد أكبر من 5 ميجابايت.', true); return; }
    try {
      const raw = JSON.parse(await file.text());
      if (!raw || !Array.isArray(raw.prompts) || raw.prompts.length > 1000) throw new Error('تنسيق النسخة الاحتياطية غير صالح');
      const incoming = raw.prompts.map(normalizePrompt).filter(Boolean);
      if (!incoming.length) throw new Error('لا توجد قوالب صالحة داخل الملف');
      const importedValues = raw.values && typeof raw.values === 'object' ? raw.values : {};
      if (importMode === 'replace') {
        if (!window.confirm(`سيُحذف ${db.prompts.length} قالب حالي ويُستبدل بـ ${incoming.length} قالب. هل تريد المتابعة؟`)) return;
        const ids = new Set();
        const values = {};
        for (const p of incoming) {
          const old = p.id;
          if (ids.has(p.id)) p.id = uid();
          ids.add(p.id);
          if (importedValues[old] && typeof importedValues[old] === 'object' && !Array.isArray(importedValues[old])) values[p.id] = importedValues[old];
        }
        db = { schema: 1, prompts: incoming, values, lastSelectedId: incoming[0].id };
      } else {
        const oldIds = new Set(db.prompts.map(p => p.id));
        let added = 0;
        for (const p of incoming) {
          const old = p.id;
          if (oldIds.has(old)) {
            const existing = db.prompts.find(x => x.id === old);
            if (existing && existing.body === p.body && existing.title === p.title) continue;
            p.id = uid();
          }
          oldIds.add(p.id);
          db.prompts.push(p);
          if (importedValues[old] && typeof importedValues[old] === 'object' && !Array.isArray(importedValues[old])) db.values[p.id] = importedValues[old];
          added++;
        }
        if (!added) { toast('جميع القوالب موجودة بالفعل؛ لم يتم تغيير المكتبة.'); return; }
        db.lastSelectedId = incoming[incoming.length-1].id;
      }
      editing = null; editingBaseline = null;
      persist(); renderList(); renderMain();
      toast(`✓ اكتمل الاستيراد. القوالب الحالية: ${db.prompts.length}`);
    } catch (e) {
      console.error('Prompt import:', e);
      toast('فشل الاستيراد: ' + e.message, true);
    }
  }
  function makeVarMeta(key) {
    if (!editing.vars[key]) editing.vars[key] = {
      label: titleFor(key), type: 'text', defaultValue: '', required: true, options: []
    };
    return editing.vars[key];
  }

  shadow.addEventListener('input', (event) => {
    const el = event.target;
    if (el.id === 'splt-search') { filterText = el.value; renderList(); return; }
    const action = el.dataset?.action;
    if (!action) return;
    if (action === 'value') {
      const p = selected();
      if (!p) return;
      currentValues(p)[el.dataset.key] = el.value;
      persist(); refreshPreview(); return;
    }
    if (!editing) return;
    const k = el.dataset.key;
    if (action === 'draft-title') editing.title = el.value;
    if (action === 'draft-category') editing.category = el.value;
    if (action === 'draft-description') editing.description = el.value;
    if (action === 'draft-body') { editing.body = el.value; renderFieldEditor(); }
    if (action === 'var-label') makeVarMeta(k).label = el.value;
    if (action === 'var-default') makeVarMeta(k).defaultValue = el.value;
    if (action === 'var-options') makeVarMeta(k).options = el.value.split(/[،,\n]/).map(s => s.trim()).filter(Boolean);
  });
  shadow.addEventListener('change', (event) => {
    const el = event.target;
    if (el.id === 'splt-category') { filterCategory = el.value; renderList(); return; }
    if (el.id === 'splt-favonly') { favoriteOnly = el.checked; renderList(); return; }
    if (el.id === 'splt-file') { importFile(el.files?.[0]); el.value = ''; return; }
    const action = el.dataset?.action;
    if (action === 'value') {
      const p = selected(); if (!p) return;
      currentValues(p)[el.dataset.key] = el.value;
      persist(); refreshPreview();
    }
    if (editing && action === 'var-type') makeVarMeta(el.dataset.key).type = el.value;
    if (editing && action === 'var-required') makeVarMeta(el.dataset.key).required = el.checked;
  });
  shadow.addEventListener('click', (event) => {
    const btn = event.target.closest('button');
    if (!btn) return;
    if (btn.id === 'splt-launch') { toggleOpen(); return; }
    const action = btn.dataset.action;
    if (!action) return;
    switch (action) {
      case 'close': toggleOpen(false); break;
      case 'new': startEditing(true); break;
      case 'edit': startEditing(false); break;
      case 'save-draft': saveDraft(); break;
      case 'cancel-draft': if (discardEditing()) renderMain(); break;
      case 'select':
        if (!discardEditing()) return;
        db.lastSelectedId = btn.dataset.id;
        persist(); renderList(); renderMain(); break;
      case 'favorite': {
        const p = db.prompts.find(x => x.id === btn.dataset.id);
        if (p) { p.favorite = !p.favorite; p.updatedAt = now(); persist(); renderList(); }
        break;
      }
      case 'duplicate': {
        const p = selected(); if (!p) break;
        const cp = clonePrompt(p);
        cp.id = uid(); cp.title += ' (نسخة)'; cp.createdAt = cp.updatedAt = now(); cp.favorite = false;
        db.prompts.unshift(cp);
        db.values[cp.id] = { ...currentValues(p) };
        db.lastSelectedId = cp.id;
        persist(); renderList(); renderMain(); toast('تم نسخ القالب ويمكن تعديله مستقلًا.'); break;
      }
      case 'delete': {
        const p = selected(); if (!p) break;
        if (!window.confirm(`هل تريد حذف «${p.title}» نهائيًا؟ يُفضّل تصدير نسخة احتياطية أولًا.`)) return;
        db.prompts = db.prompts.filter(x => x.id !== p.id);
        delete db.values[p.id];
        db.lastSelectedId = db.prompts[0]?.id || null;
        persist(); renderList(); renderMain(); toast('حُذف القالب.'); break;
      }
      case 'copy': copyPrompt(); break;
      case 'reset-values': {
        const p = selected(); if (!p) break;
        if (!window.confirm('هل تريد إعادة مدخلات هذا القالب إلى قيمها الافتراضية؟')) return;
        delete db.values[p.id]; persist(); renderDetails(); toast('أُعيدت القيم الافتراضية.'); break;
      }
      case 'export': exportData(); break;
      case 'import-merge': importMode = 'merge'; $('#splt-file').click(); break;
      case 'import-replace': importMode = 'replace'; $('#splt-file').click(); break;
      case 'restore-starter': {
        const p = starter();
        if (db.prompts.some(x => x.id === p.id)) p.id = uid();
        db.prompts.unshift(p); db.lastSelectedId = p.id;
        persist(); renderList(); renderMain(); break;
      }
      case 'insert-var': {
        if (!editing) break;
        const name = $('#splt-new-field').value.trim().replace(/^\{\{|\}\}$/g,'');
        if (!FIELD_NAME.test(name)) { toast('اسم الخانة يجب أن يكون حروفًا أو أرقامًا أو _ أو - (حتى 50 حرفًا).', true); return; }
        const area = $('#splt-template-body');
        const a = area.selectionStart, b = area.selectionEnd;
        const token = `{{${name}}}`;
        area.value = area.value.slice(0,a) + token + area.value.slice(b);
        editing.body = area.value;
        area.focus(); area.setSelectionRange(a + token.length, a + token.length);
        $('#splt-new-field').value = '';
        renderFieldEditor(); break;
      }
    }
  });

  /*
   * DOM diagnostic, 2026-10-25:
   *   section.chat-panel: x=432, width=761, height=847
   *   div.chat-panel-content: height=742, scrollable
   *   textarea.query-box-input: accessible label "مربّع طلب البحث"
   * The earlier versions relied on locating that textarea and mounting INSIDE
   * the query-box hierarchy. The actual NotebookLM composer has a constrained
   * height and may clip or reject siblings inserted there. Mount as a DIRECT
   * FLEX CHILD of section.chat-panel immediately after the chat scroll region.
   * This anchor does not depend on textarea name, language, or state.
   */
  let lastPanel = null;
  let mountTimer = null;
  root.dataset.version = '1.1.4';

  function isUsablePanel(el) {
    if (!el?.isConnected) return false;
    const r = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return r.width >= 180 && r.height >= 150 &&
      style.display !== 'none' && style.visibility !== 'hidden';
  }

  function findChatPanel() {
    const panels = [...document.querySelectorAll('section.chat-panel, .chat-panel')];
    // The real NotebookLM page uses one section.chat-panel. For newer versions,
    // prefer the section that includes chat scroll content or a prompt input.
    return panels.filter(isUsablePanel).sort((a,b) => {
      const score = p => (p.matches('section.chat-panel') ? 40 : 0) +
        (p.querySelector('.chat-panel-content') ? 25 : 0) +
        (p.querySelector('textarea.query-box-input') ? 20 : 0);
      return score(b) - score(a);
    })[0] || null;
  }

  function getInsertionAnchor(panel) {
    const chatContent = panel.querySelector('.chat-panel-content');
    if (chatContent) {
      let direct = chatContent;
      while (direct.parentElement && direct.parentElement !== panel) direct = direct.parentElement;
      if (direct.parentElement === panel) return direct.nextSibling === root ? root.nextSibling : direct.nextSibling;
    }
    // If NotebookLM renames chat-panel-content, still mount the toolbar inside
    // chat-panel, before the composer, instead of failing or moving outside it.
    const composer = panel.querySelector('textarea.query-box-input, textarea, [contenteditable="true"]');
    if (composer) {
      let direct = composer;
      while (direct.parentElement && direct.parentElement !== panel) direct = direct.parentElement;
      if (direct.parentElement === panel) return direct;
    }
    return panel.firstChild === root ? root.nextSibling : panel.firstChild;
  }

  function ensureMounted() {
    attachHeaderEntry();
    const chat = findChatPanel();
    if (!chat) {
      if (root.isConnected) root.remove();
      lastPanel = null;
      markStatus('waiting-for-chat-panel');
      return false;
    }
    const anchor = getInsertionAnchor(chat);
    if (root.parentElement !== chat || root.nextSibling !== anchor) {
      chat.insertBefore(root, anchor);
      console.info('[NotebookLM Prompt Library] v1.1.4 UI attached to chat panel; entry at notebook title.');
    }
    lastPanel = chat;
    root.dataset.mount = 'chat-panel';
    markStatus('mounted');
    return true;
  }

  function queueMount() {
    if (mountTimer !== null) return;
    mountTimer = setTimeout(() => {
      mountTimer = null;
      try { ensureMounted(); }
      catch (err) { markStatus('mount-error'); console.error('[NotebookLM Prompt Library] Mount error', err); }
    }, 180);
  }

  const mountObserver = new MutationObserver(() => {
    // Never observe shadow UI changes; only re-anchor if NotebookLM rebuilds
    // the chat. Avoid mutation loops caused by our own insertBefore.
    if (!root.isConnected || !lastPanel?.isConnected || root.parentElement !== lastPanel ||
      root.nextSibling !== getInsertionAnchor(lastPanel) || !headerHost.isConnected) queueMount();
  });
  mountObserver.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('pageshow', queueMount);
  window.addEventListener('popstate', queueMount);
  setInterval(() => {
    // NotebookLM may load the title field after the chat. Keep the inline
    // entry beside the title once it becomes available.
    attachHeaderEntry();
    if (!root.isConnected || !lastPanel?.isConnected || root.parentElement !== lastPanel ||
      root.nextSibling !== getInsertionAnchor(lastPanel) || !headerHost.isConnected)
      queueMount();
  }, 3000);

  document.addEventListener('keydown', (event) => {
    if (event.altKey && event.shiftKey && event.code === 'KeyL') {
      event.preventDefault(); toggleOpen();
    } else if (event.key === 'Escape' && opened) {
      if (editing) { if (discardEditing()) renderMain(); }
      else toggleOpen(false);
    }
  });
  try { GM_registerMenuCommand('📋 فتح مكتبة البرومبتات', () => { ensureMounted(); if (root.isConnected) toggleOpen(true); else window.alert('افتح دفترًا في NotebookLM لتظهر مكتبة البرومبتات.'); }); } catch (_) { /* optional */ }
  // A malformed saved library must not prevent the launcher and panel mounting.
  bootStage = 'mount';
  try { ensureMounted(); }
  catch (err) { markStatus('mount-error'); console.error('[NotebookLM Prompt Library] Initial mount failed', err); }
  bootStage = 'render';
  try {
    renderList();
    markStatus(root.isConnected ? 'ready' : 'waiting-for-chat-panel');
  } catch (err) {
    markStatus('render-error');
    console.error('[NotebookLM Prompt Library] Render failed', err);
  }
  bootStage = 'persist';
  persist();
  headerClick = () => {
    try {
      ensureMounted();
      if (!root.isConnected) {
        headerButton.title = 'صفحة الدفتر لم تكتمل بعد';
        return;
      }
      toggleOpen();
    } catch (err) {
      markStatus('open-error');
      headerButton.title = err.message || 'حدث خطأ';
      console.error('[NotebookLM Prompt Library] Open failed', err);
    }
  };
  bootStage = 'ready';
  } catch (err) {
    markStatus('init-error');
    document.documentElement.dataset.nlplStage = bootStage;
    // Persist no prompt data in the error marker; only the code path.
    headerButton.textContent = '⚠️ المكتبة';
    headerButton.title = 'فشل تجهيز المكتبة. افتح Console للاطلاع على الخطأ.';
    console.error('[NotebookLM Prompt Library] Startup failed at ' + bootStage, err);
  }
})();

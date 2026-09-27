// ==UserScript==
// @name         Microsoft Forms Smart Enhancer - محسن Microsoft Forms الذكي
// @namespace    https://greasyfork.org/users/1636459
// @version      1.2.0
// @description  محسن شامل لـ Microsoft Forms: فهرسة تلقائية مخفية وصارمة، بحث مباشر، إخفاء القوالب، قوالب إعدادات، تدقيق وإدارة جماعية وإعادة ترتيب الأسئلة.
// @author       Mohammed Almalki (M0HM3D85)
// @homepageURL  https://greasyfork.org/en/users/1636459-m0hm3d85
// @supportURL   https://github.com/M0HM3D85/teacher-userscripts/issues
// @copyright    2026, Mohammed Almalki (M0HM3D85)
// @license      All Rights Reserved
// @match        https://forms.cloud.microsoft/Pages/DesignPageV2.aspx*
// @match        https://forms.office.com/Pages/DesignPageV2.aspx*
// @run-at       document-start
// @sandbox      raw
// @grant        none
// ==/UserScript==

/*
=========================================================================
 Microsoft Forms Smart Enhancer - محسن Microsoft Forms الذكي

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

  const FINAL_VERSION = '1.2.0';
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  /*
   * Forms API session bridge — v1.2.0
   *
   * Microsoft Forms يضيف لرابط PATCH الصحيح رؤوس جلسة لا يضيفها الطلب
   * الذي ننشئه نحن تلقائيًا، وأهمها RequestVerificationToken و UserSessionId.
   *
   * نلتقط هذه القيم من طلبات Forms الأصلية داخل نفس الصفحة فقط، ونحتفظ بها
   * في الذاكرة المؤقتة لهذه الصفحة. لا نحفظها في localStorage/sessionStorage
   * ولا نطبع قيمها في Console.
   *
   * التشغيل document-start مهم حتى نلتقط أول طلبات FormAPI قبل اكتمال الواجهة.
   */
  const FORM_API_SESSION = (() => {
    const existing =
      window.__M0HM3D85_FORM_API_SESSION_V120__;

    if (existing) {
      return existing;
    }

    const state = {
      headers: new Map(),
      updatedAt: 0
    };

    const wanted = new Set([
      'authorization',
      '__requestverificationtoken',
      'x-usersessionid',
      'x-ms-form-muid',
      'x-ms-form-request-source',
      'x-ms-form-request-ring',
      'odata-maxverion',
      'odata-maxversion',
      'odata-version',
      'accept',
      'content-type'
    ]);

    const isFormsOriginUrl = raw => {
      try {
        const url = new URL(
          String(raw || ''),
          location.href
        );

        return (
          url.origin === location.origin &&
          /(?:forms\.cloud\.microsoft|forms\.office\.com)$/i.test(
            url.hostname
          )
        );
      } catch {
        return false;
      }
    };

    const isFormApiUrl = raw => {
      try {
        const url = new URL(
          String(raw || ''),
          location.href
        );

        return (
          isFormsOriginUrl(url.href) &&
          /\/formapi\/api\//i.test(
            url.pathname
          )
        );
      } catch {
        return false;
      }
    };

    const remember = (name, value) => {
      const key =
        String(name || '')
          .trim()
          .toLowerCase();

      if (
        !wanted.has(key) ||
        value == null ||
        value === ''
      ) {
        return;
      }

      state.headers.set(
        key,
        String(value)
      );

      state.updatedAt =
        Date.now();
    };

    const rememberHeaders = headers => {
      if (!headers) return;

      try {
        if (
          typeof Headers !== 'undefined' &&
          headers instanceof Headers
        ) {
          headers.forEach(
            (value, name) =>
              remember(
                name,
                value
              )
          );

          return;
        }
      } catch {}

      if (
        Array.isArray(headers)
      ) {
        headers.forEach(
          pair => {
            if (
              Array.isArray(pair) &&
              pair.length >= 2
            ) {
              remember(
                pair[0],
                pair[1]
              );
            }
          }
        );

        return;
      }

      if (
        typeof headers === 'object'
      ) {
        Object.entries(headers)
          .forEach(
            ([name, value]) =>
              remember(
                name,
                value
              )
          );
      }
    };

    const required =
      [
        '__requestverificationtoken',
        'x-usersessionid'
      ];

    const missing = () =>
      required.filter(
        name =>
          !state.headers.get(name)
      );

    const ready = () =>
      missing().length === 0;

    const waitReady = async (
      timeout = 6000
    ) => {
      const started =
        Date.now();

      while (
        Date.now() - started <
          timeout
      ) {
        if (ready()) {
          return true;
        }

        await sleep(100);
      }

      return ready();
    };

    const makeCorrelationId = () => {
      try {
        if (
          crypto?.randomUUID
        ) {
          return crypto.randomUUID();
        }
      } catch {}

      return (
        'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
          .replace(
            /[xy]/g,
            ch => {
              const r =
                Math.random() * 16 | 0;

              const v =
                ch === 'x'
                  ? r
                  : (r & 0x3) | 0x8;

              return v.toString(16);
            }
          )
      );
    };

    const writeHeaders = () => {
      const result = {
        'content-type':
          state.headers.get(
            'content-type'
          ) ||
          'application/json',

        'accept':
          state.headers.get(
            'accept'
          ) ||
          'application/json',

        'x-correlationid':
          makeCorrelationId(),

        'x-ms-form-request-source':
          state.headers.get(
            'x-ms-form-request-source'
          ) ||
          'ms-formweb',

        'x-ms-form-request-ring':
          state.headers.get(
            'x-ms-form-request-ring'
          ) ||
          'business',

        'odata-version':
          state.headers.get(
            'odata-version'
          ) ||
          '4.0'
      };

      const maxVersion =
        state.headers.get(
          'odata-maxverion'
        ) ||
        state.headers.get(
          'odata-maxversion'
        ) ||
        '4.0';

      /*
       * الالتقاط الحقيقي من Forms أظهر الاسم odata-maxverion بهذه الكتابة،
       * لذلك نحافظ عليه كما يرسله Forms.
       */
      result['odata-maxverion'] =
        maxVersion;

      /*
       * الفحص اليدوي الناجح أظهر أن Forms يستدعي setRequestHeader
       * لاسم authorization لكن بقيمة فارغة، ومع ذلك يعود PATCH بحالة 204.
       * لذلك لا نعتبر Authorization شرطًا للتوثيق، ونحافظ على نفس شكل
       * الطلب بإرساله فارغًا إذا لم توجد قيمة غير فارغة.
       */
      result['authorization'] =
        state.headers.get(
          'authorization'
        ) || '';

      [
        '__requestverificationtoken',
        'x-usersessionid',
        'x-ms-form-muid'
      ].forEach(
        name => {
          const value =
            state.headers.get(name);

          if (value) {
            result[name] =
              value;
          }
        }
      );

      return result;
    };

    const NativeXHR =
      window.XMLHttpRequest;

    if (
      NativeXHR?.prototype &&
      !NativeXHR.prototype
        .__m0hm3d85FormsApiCaptureV120
    ) {
      const originalOpen =
        NativeXHR.prototype.open;

      const originalSetRequestHeader =
        NativeXHR.prototype.setRequestHeader;

      const originalSend =
        NativeXHR.prototype.send;

      NativeXHR.prototype.open =
        function(method, url) {
          this.__m0hm3d85FormApiMeta = {
            method:
              String(
                method || 'GET'
              ).toUpperCase(),
            url:
              String(
                url || ''
              ),
            headers:
              []
          };

          return originalOpen.apply(
            this,
            arguments
          );
        };

      NativeXHR.prototype.setRequestHeader =
        function(name, value) {
          try {
            const meta =
              this.__m0hm3d85FormApiMeta;

            if (
              meta &&
              isFormsOriginUrl(
                meta.url
              )
            ) {
              /*
               * Authorization قد يُجهّز على طلب Forms آخر قبل PATCH السؤال.
               * نلتقط فقط أسماء الرؤوس المعروفة في wanted، لذلك توسيع المسار
               * لا يخزن أي رؤوس عشوائية.
               */
              remember(
                name,
                value
              );

              if (
                isFormApiUrl(
                  meta.url
                )
              ) {
                meta.headers.push([
                  String(name),
                  String(value)
                ]);
              }
            }
          } catch {}

          return originalSetRequestHeader.apply(
            this,
            arguments
          );
        };

      NativeXHR.prototype.send =
        function() {
          return originalSend.apply(
            this,
            arguments
          );
        };

      Object.defineProperty(
        NativeXHR.prototype,
        '__m0hm3d85FormsApiCaptureV120',
        {
          value: true,
          configurable: false,
          enumerable: false
        }
      );
    }

    const nativeFetch =
      typeof window.fetch ===
        'function'
        ? window.fetch.bind(window)
        : null;

    if (
      nativeFetch &&
      !window
        .__M0HM3D85_FETCH_CAPTURE_V120__
    ) {
      window.fetch =
        async function(input, init = {}) {
          try {
            const rawUrl =
              typeof input === 'string'
                ? input
                : input?.url;

            if (
              isFormsOriginUrl(
                rawUrl
              )
            ) {
              rememberHeaders(
                input?.headers
              );

              rememberHeaders(
                init?.headers
              );
            }
          } catch {}

          return nativeFetch(
            input,
            init
          );
        };

      window.__M0HM3D85_FETCH_CAPTURE_V120__ =
        true;
    }

    const api = {
      ready,
      missing,
      waitReady,
      writeHeaders,

      // تشخيص آمن: يعيد أسماء الرؤوس فقط، وليس قيمها.
      status: () => ({
        ready:
          ready(),
        missing:
          missing(),
        captured:
          [...state.headers.keys()],
        updatedAt:
          state.updatedAt
      })
    };

    window.__M0HM3D85_FORM_API_SESSION_V120__ =
      api;

    return api;
  })();

  function clean(value = '') {
    return String(value ?? '')
      .replace(/[\u200e\u200f\u202a-\u202e]/g, '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function westernDigits(value = '') {
    const ar = '٠١٢٣٤٥٦٧٨٩';
    const fa = '۰۱۲۳۴۵۶۷۸۹';
    return String(value)
      .replace(/[٠-٩]/g, c => String(ar.indexOf(c)))
      .replace(/[۰-۹]/g, c => String(fa.indexOf(c)));
  }

  function canonical(value = '') {
    return clean(value)
      .toLowerCase()
      .replace(/[ًٌٍَُِّْـ]/g, '')
      .replace(/[أإآ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/[؟?!.،,:：;؛()[\]{}"'`~_\-–—]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function escapeHtml(value = '') {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function visible(el) {
    if (!(el instanceof Element) || !el.isConnected) return false;
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      rect.width > 0 &&
      rect.height > 0;
  }

  function debounce(fn, wait = 500) {
    let timer = 0;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  }

  /* ============================== PORTAL ============================== */

  const PORTAL = (() => {
    const HOST_ID = 'm0hm3d85-forms-productivity';
    const STYLE_ID = `${HOST_ID}-style`;
    const WORKER_NAME = 'MAD_FORMS_PRODUCTIVITY_WORKER_STRICT_V110';
    const NS = 'M0HM3D85_FORMS_STRICT_INDEX_V110';
    const LEGACY_KEYS = [
      'MAD_FORMS_PRODUCTIVITY_INDEX_V040',
      'MAD_FORMS_PRODUCTIVITY_INDEX',
      'M0HM3D85_FORMS_PRODUCTIVITY_INDEX',
      'M0HM3D85_FORMS_INDEX'
    ];

    const state = {
      mounted: false,
      collapsed: true,
      indexing: false,
      forms: [],
      collections: [],
      query: '',
      filter: 'all',
      sort: 'responses-desc',
      indexedAt: null,
      skippedDuplicates: 0,
      warnings: [],
      autoIndexStarted: false,
      status: ''
    };

    const canon = value =>
      canonical(value).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

    function isPortal() {
      const u = new URL(location.href);
      if (u.searchParams.has('collectionid') || u.searchParams.has('id')) {
        return false;
      }
      return !!document.querySelector(
        '#scroll-dnd,#portal-tab-0,[data-automation-id="newFormButton"]'
      );
    }

    function purgeIndex() {
      for (const key of LEGACY_KEYS) {
        try { localStorage.removeItem(key); } catch {}
        try { sessionStorage.removeItem(key); } catch {}
      }
      state.forms = [];
      state.collections = [];
      state.indexedAt = null;
      state.skippedDuplicates = 0;
      state.warnings = [];
    }

    function isFormsContentContainer(el) {
      if (!el) return false;
      return Boolean(
        el.matches?.('#scroll-dnd,[role="tablist"]') ||
        el.querySelector?.(
          '[id^="form-item-"],[id^="collection-item-"],' +
          '[data-automation-id="itemContainer"],' +
          '[data-automation-id="newFormButton"],[role="tablist"]'
        )
      );
    }

    function templateCardLabel(value) {
      const text = clean(value);
      return [
        /^(?:اختبار|Quiz)$/i,
        /^(?:التسجيل|Registration)$/i,
        /^(?:ملاحظات|Feedback)$/i,
        /^(?:الأبحاث|Research)$/i,
        /^(?:معرض القوالب|Template gallery|Template Gallery)$/i
      ].some(re => re.test(text));
    }

    function templateLabelCount(value) {
      const text = clean(value);
      return [
        /اختبار|Quiz/i,
        /التسجيل|Registration/i,
        /ملاحظات|Feedback/i,
        /الأبحاث|Research/i,
        /معرض القوالب|Template gallery/i
      ].reduce((n, re) => n + (re.test(text) ? 1 : 0), 0);
    }

    function restoreTemplateHides() {
      document
        .querySelectorAll('[data-m0hm3d85-template-discovery-hidden]')
        .forEach(el => {
          el.removeAttribute('data-m0hm3d85-template-discovery-hidden');
          el.style.removeProperty('display');
        });
    }

    function templateCardRoot(labelEl) {
      if (!labelEl) return null;
      let node = labelEl;
      let best = labelEl;

      for (
        let depth = 0;
        node &&
        node !== document.body &&
        node !== document.documentElement &&
        depth < 6;
        depth++, node = node.parentElement
      ) {
        if (isFormsContentContainer(node)) break;

        const rect = node.getBoundingClientRect?.();
        const text = clean(node.innerText || node.textContent || '');

        if (templateLabelCount(text) > 1) break;

        if (
          rect &&
          rect.width >= 120 &&
          rect.width <= 520 &&
          rect.height >= 45 &&
          rect.height <= 320
        ) {
          best = node;
        }
      }

      return best;
    }

    function hideTemplateDiscovery() {
      restoreTemplateHides();

      const headings = [
        ...document.querySelectorAll(
          'h1,h2,h3,h4,h5,h6,[role="heading"],div,span'
        )
      ].filter(el =>
        /^(?:استكشاف القوالب|Explore templates)$/i.test(
          clean(el.textContent || el.innerText || '')
        )
      );

      for (const heading of headings) {
        heading.setAttribute(
          'data-m0hm3d85-template-discovery-hidden',
          'true'
        );
        heading.style.setProperty('display', 'none', 'important');
      }

      const labels = [
        ...document.querySelectorAll(
          'a,button,[role="button"],[role="link"],span,div'
        )
      ].filter(el => {
        if (el.closest?.(`#${HOST_ID}`)) return false;
        if (isFormsContentContainer(el)) return false;

        const ownText = clean(
          el.childElementCount
            ? [...el.childNodes]
                .filter(node => node.nodeType === Node.TEXT_NODE)
                .map(node => node.textContent)
                .join(' ')
            : el.innerText || el.textContent || ''
        );

        const fallback = clean(el.innerText || el.textContent || '');

        return templateCardLabel(ownText) ||
          (el.childElementCount <= 2 && templateCardLabel(fallback));
      });

      const cards = new Set();

      for (const label of labels) {
        const card = templateCardRoot(label);
        if (
          !card ||
          card === document.body ||
          card === document.documentElement ||
          isFormsContentContainer(card)
        ) {
          continue;
        }
        cards.add(card);
      }

      for (const card of cards) {
        card.setAttribute(
          'data-m0hm3d85-template-discovery-hidden',
          'true'
        );
        card.style.setProperty('display', 'none', 'important');
      }

      return headings.length + cards.size;
    }

    function responseCount(text) {
      const s = westernDigits(clean(text));
      const patterns = [
        /يحتوي على\s*(\d+)\s*استجابة/i,
        /له\s*(\d+)\s*من\s*(?:الاستجابات|الردود)/i,
        /(\d+)\s*من\s*الردود/i,
        /(\d+)\s*(?:استجابة|استجابات|ردود)/i
      ];
      for (const p of patterns) {
        const m = s.match(p);
        if (m) return Number(m[1]) || 0;
      }
      return 0;
    }

    function declaredCollectionCount(text) {
      const s = westernDigits(clean(text));
      const m =
        s.match(/(?:لديها|لديه)\s*(\d+)\s*من\s*النماذج/i) ||
        s.match(/(\d+)\s*من\s*العناصر/i);
      return m ? Number(m[1]) : null;
    }

    function directFormUrl(formKey) {
      const u = new URL('/Pages/DesignPageV2.aspx', location.origin);
      u.searchParams.set('origin', 'shell');
      u.searchParams.set('subpage', 'design');
      u.searchParams.set('id', formKey);
      return u.href;
    }

    function collectionUrl(collectionId) {
      const u = new URL('/Pages/DesignPageV2.aspx', location.origin);
      u.searchParams.set('origin', 'shell');
      u.searchParams.set('collectionid', collectionId);
      return u.href;
    }

    function formTitle(card) {
      const explicit = card.querySelector('[data-automation-id="detailTitle"]');
      if (explicit) {
        return clean(
          explicit.textContent ||
          explicit.getAttribute('title')
        );
      }

      const labelled = [...card.querySelectorAll('[aria-label],[title]')]
        .map(el => clean(
          el.getAttribute('aria-label') ||
          el.getAttribute('title')
        ))
        .find(text =>
          text &&
          !/استجابة|ردود|المزيد|خيارات/i.test(text)
        );

      if (labelled) return labelled;

      return clean(card.innerText)
        .split('\n')
        .map(clean)
        .find(Boolean) || 'نموذج بدون عنوان';
    }

    function parseFormCard(card, folder = null) {
      const id = clean(card.id);
      if (!id.startsWith('form-item-')) return null;

      const formKey = id.slice('form-item-'.length);
      if (!formKey) return null;

      const title = formTitle(card);
      const responses = responseCount(
        `${card.innerText || ''} ${card.getAttribute('aria-label') || ''}`
      );

      let nativeHref = '';
      const a = [...card.querySelectorAll('a[href]')].find(x =>
        /DesignPageV2\.aspx/i.test(x.href) &&
        /[?&]id=/i.test(x.href)
      );
      if (a) nativeHref = a.href;

      return {
        formKey,
        title,
        titleKey: canon(title),
        responses,
        collectionId: folder?.id || '',
        collectionName: folder?.name || '',
        directUrl: nativeHref || directFormUrl(formKey)
      };
    }

    function parseCollections() {
      return [...document.querySelectorAll('[id^="collection-item-"]')]
        .map(card => {
          const id = card.id.slice('collection-item-'.length);
          if (!id) return null;

          const titleEl = card.querySelector('[data-automation-id="detailTitle"]');

          let name = clean(
            titleEl?.textContent ||
            titleEl?.getAttribute('title') ||
            ''
          );

          if (!name) {
            name = clean(card.innerText)
              .split('\n')
              .map(clean)
              .find(text =>
                text &&
                !/\d+\s*من\s*(?:النماذج|العناصر)/i.test(
                  westernDigits(text)
                )
              ) || `مجموعة ${id}`;
          }

          return {
            id,
            name,
            declaredCount: declaredCollectionCount(card.innerText || ''),
            url: collectionUrl(id)
          };
        })
        .filter(Boolean);
    }

    function parseForms(folder = null) {
      return [...document.querySelectorAll('[id^="form-item-"]')]
        .map(card => parseFormCard(card, folder))
        .filter(Boolean);
    }

    async function expandAndSettle() {
      let lastCount = -1;
      let stable = 0;

      for (let round = 0; round < 18; round++) {
        const buttons = [...document.querySelectorAll('button,[role="button"]')]
          .filter(visible)
          .filter(el =>
            /عرض المزيد|إظهار المزيد|تحميل المزيد|Show more|Load more/i.test(
              clean(el.innerText || el.getAttribute('aria-label'))
            )
          );

        if (buttons.length) {
          try { buttons[0].click(); } catch {}
          await sleep(450);
        }

        try {
          window.scrollTo(0, document.documentElement.scrollHeight);
        } catch {}

        await sleep(300);

        const count =
          document.querySelectorAll('[id^="form-item-"]').length;

        if (count === lastCount && !buttons.length) {
          stable++;
        } else {
          stable = 0;
        }

        lastCount = count;
        if (stable >= 2) break;
      }

      try { window.scrollTo(0, 0); } catch {}
      await sleep(220);
    }

    async function waitForPortal(timeout = 15000) {
      const started = Date.now();
      while (Date.now() - started < timeout) {
        if (
          isPortal() ||
          document.querySelector('[id^="form-item-"]')
        ) {
          return true;
        }
        await sleep(120);
      }
      return false;
    }

    async function scanHomeWorker() {
      await waitForPortal();

      const collectionMap = new Map();

      parseCollections().forEach(c =>
        collectionMap.set(c.id, c)
      );

      const tab = document.querySelector('#portal-tab-1');

      if (tab && visible(tab)) {
        try { tab.click(); } catch {}
        await sleep(700);
      }

      await expandAndSettle();

      parseCollections().forEach(c =>
        collectionMap.set(c.id, c)
      );

      return {
        collections: [...collectionMap.values()],
        forms: parseForms(null)
      };
    }

    async function scanCollectionWorker(folder) {
      await waitForPortal();
      await expandAndSettle();

      const heading = clean(
        document.querySelector('h1,h2,[role="heading"]')?.textContent || ''
      );

      const resolved = {
        id: folder.id,
        name: folder.name || heading || `مجموعة ${folder.id}`
      };

      const forms = parseForms(resolved);

      return {
        folder: resolved,
        forms,
        actualCount: forms.length
      };
    }

    function workerBoot() {
      if (window.name !== WORKER_NAME) return false;

      window.addEventListener('message', async event => {
        if (
          event.origin !== location.origin ||
          event.data?.ns !== NS
        ) {
          return;
        }

        const { op, requestId, payload } = event.data;

        try {
          let result;
          if (op === 'SCAN_HOME') {
            result = await scanHomeWorker();
          } else if (op === 'SCAN_COLLECTION') {
            result = await scanCollectionWorker(payload.folder);
          } else {
            return;
          }

          event.source?.postMessage(
            { ns: NS, type: 'RESULT', requestId, result },
            event.origin
          );
        } catch (error) {
          event.source?.postMessage(
            {
              ns: NS,
              type: 'ERROR',
              requestId,
              error: String(error?.message || error)
            },
            event.origin
          );
        }
      });

      setTimeout(() => {
        const controller =
          window.opener ||
          (
            window.parent &&
            window.parent !== window
              ? window.parent
              : null
          );

        controller?.postMessage(
          { ns: NS, type: 'READY', href: location.href },
          location.origin
        );
      }, 50);

      return true;
    }

    function createHiddenWorker(url) {
      const frame = document.createElement('iframe');
      frame.name = WORKER_NAME;
      frame.setAttribute('aria-hidden', 'true');
      frame.tabIndex = -1;

      Object.assign(frame.style, {
        position: 'fixed',
        width: '1280px',
        height: '900px',
        left: '-20000px',
        top: '0',
        border: '0',
        opacity: '0',
        pointerEvents: 'none',
        zIndex: '-2147483648',
        background: 'transparent'
      });

      frame.src = url;

      (document.body || document.documentElement).appendChild(frame);

      return {
        frame,
        get window() {
          return frame.contentWindow;
        },
        destroy() {
          try { frame.src = 'about:blank'; } catch {}
          try { frame.remove(); } catch {}
        }
      };
    }

    function waitMessage(worker, predicate, timeout = 20000) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          cleanup();
          reject(new Error('انتهت مهلة عامل الفهرسة.'));
        }, timeout);

        const onMessage = event => {
          if (
            event.origin !== location.origin ||
            event.source !== worker ||
            event.data?.ns !== NS
          ) {
            return;
          }

          if (!predicate(event.data)) return;

          cleanup();
          resolve(event.data);
        };

        const cleanup = () => {
          clearTimeout(timer);
          window.removeEventListener('message', onMessage);
        };

        window.addEventListener('message', onMessage);
      });
    }

    async function command(worker, op, payload = {}) {
      const requestId =
        `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const promise = waitMessage(
        worker,
        d =>
          d.requestId === requestId &&
          (d.type === 'RESULT' || d.type === 'ERROR'),
        30000
      );

      worker.postMessage(
        { ns: NS, op, requestId, payload },
        location.origin
      );

      const msg = await promise;

      if (msg.type === 'ERROR') {
        throw new Error(msg.error);
      }

      return msg.result;
    }

    async function navigateWorker(worker, url) {
      const ready = waitMessage(
        worker,
        d => d.type === 'READY',
        25000
      );

      worker.location.href = url;

      await ready;
      await sleep(250);
    }

    function strictDedupe(forms) {
      const map = new Map();
      let skipped = 0;

      for (const form of forms) {
        const key =
          form.formKey ||
          `${form.titleKey}|${form.collectionId || 'outside'}`;

        if (!map.has(key)) {
          map.set(key, form);
          continue;
        }

        skipped++;

        const old = map.get(key);

        if (!old.collectionId && form.collectionId) {
          map.set(key, form);
        }
      }

      state.skippedDuplicates = skipped;

      return [...map.values()];
    }

    function setStatus(text, kind = '') {
      state.status = text;

      const el =
        document.querySelector(`#${HOST_ID} .mfs-status`);

      if (el) {
        el.textContent = text;
        el.dataset.kind = kind;
      }
    }

    async function rebuildIndexStrict() {
      if (state.indexing) return;

      purgeIndex();
      state.indexing = true;

      setStatus(
        'جارٍ مسح الفهرس السابق وبدء فهرسة جديدة صارمة...',
        'running'
      );

      render();

      const base = new URL(
        '/Pages/DesignPageV2.aspx?origin=shell',
        location.origin
      ).href;

      const hiddenWorker = createHiddenWorker(base);
      const worker = hiddenWorker.window;

      if (!worker) {
        state.indexing = false;
        hiddenWorker.destroy();
        setStatus(
          'تعذر إنشاء عامل الفهرسة المخفي داخل الصفحة.',
          'error'
        );
        render();
        return;
      }

      try {
        await waitMessage(
          worker,
          d => d.type === 'READY',
          25000
        );

        const home =
          await command(worker, 'SCAN_HOME');

        const all = [...home.forms];

        state.collections = home.collections;

        let done = 0;

        for (const folder of state.collections) {
          if (!hiddenWorker.frame.isConnected) {
            throw new Error(
              'توقف عامل الفهرسة المخفي قبل اكتمال العملية.'
            );
          }

          setStatus(
            `فهرسة المجموعة ${done + 1}/${state.collections.length}: ${folder.name}`,
            'running'
          );

          renderHeaderOnly();

          await navigateWorker(worker, folder.url);

          const scanned =
            await command(
              worker,
              'SCAN_COLLECTION',
              { folder }
            );

          all.push(...scanned.forms);

          if (
            folder.declaredCount != null &&
            scanned.actualCount !== folder.declaredCount
          ) {
            state.warnings.push(
              `${folder.name}: المتوقع ${folder.declaredCount} والمقروء ${scanned.actualCount}`
            );
          }

          done++;
        }

        state.forms = strictDedupe(all);
        state.indexedAt = new Date();

        const warn =
          state.warnings.length
            ? ` • ${state.warnings.length} تنبيه عددي`
            : '';

        const dup =
          state.skippedDuplicates
            ? ` • مُنع ${state.skippedDuplicates} تكرار`
            : '';

        setStatus(
          `اكتملت الفهرسة المخفية: ${state.forms.length} نموذجًا${dup}${warn}.`,
          'ok'
        );
      } catch (error) {
        purgeIndex();

        setStatus(
          `فشلت الفهرسة المخفية وتم إبقاء الفهرس فارغًا: ${String(error?.message || error)}`,
          'error'
        );
      } finally {
        state.indexing = false;
        hiddenWorker.destroy();
        render();
      }
    }

    function filtered() {
      const q = canon(state.query);

      const out = state.forms.filter(form => {
        if (state.filter === 'folders' && !form.collectionId) return false;
        if (state.filter === 'outside' && form.collectionId) return false;
        if (state.filter === 'responses' && form.responses <= 0) return false;
        if (state.filter === 'zero' && form.responses !== 0) return false;

        if (
          q &&
          !canon(
            `${form.title} ${form.collectionName} ${form.responses}`
          ).includes(q)
        ) {
          return false;
        }

        return true;
      });

      out.sort((a, b) => {
        if (state.sort === 'responses-asc') {
          return a.responses - b.responses;
        }

        if (state.sort === 'title') {
          return a.title.localeCompare(b.title, 'ar');
        }

        if (state.sort === 'folder') {
          return (
            (a.collectionName || '').localeCompare(
              b.collectionName || '',
              'ar'
            ) ||
            a.title.localeCompare(b.title, 'ar')
          );
        }

        return b.responses - a.responses;
      });

      return out;
    }

    function injectStyles() {
      if (document.getElementById(STYLE_ID)) return;

      const style = document.createElement('style');
      style.id = STYLE_ID;

      style.textContent = `
#${HOST_ID}{--p:#007874;--s:#00A39E;--b:#E5E7EB;--t:#1F2937;--m:#6B7280;width:min(1180px,calc(100% - 32px));margin:14px auto;border:1px solid var(--b);border-radius:12px;background:#fff;color:var(--t);font-family:"Segoe UI",Tahoma,Arial,sans-serif;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,.04);direction:rtl}
#${HOST_ID} *{box-sizing:border-box}
#${HOST_ID} .mfs-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;min-height:58px}
#${HOST_ID} .mfs-brand{display:flex;align-items:center;gap:10px}
#${HOST_ID} .mfs-logo{width:34px;height:34px;border-radius:9px;display:grid;place-items:center;background:linear-gradient(135deg,var(--p),var(--s));color:#fff;font-weight:800}
#${HOST_ID} .mfs-brand strong{display:block;font-size:14px}
#${HOST_ID} .mfs-brand small{color:var(--m);font-size:10px}
#${HOST_ID} .mfs-head-actions{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
#${HOST_ID} button,#${HOST_ID} input,#${HOST_ID} select{font:inherit}
#${HOST_ID} button{cursor:pointer}
#${HOST_ID} .mfs-primary{border:0;border-radius:8px;background:var(--p);color:#fff;padding:7px 11px;font-weight:600}
#${HOST_ID} .mfs-primary:disabled{opacity:.5;cursor:not-allowed}
#${HOST_ID} .mfs-collapse{width:34px;height:34px;border:1px solid var(--p);border-radius:8px;background:#fff;color:var(--p)}
#${HOST_ID}.mfs-collapsed .mfs-body{display:none}
#${HOST_ID} .mfs-count{font-size:10px;color:var(--p);background:#F2FBFA;padding:4px 8px;border-radius:999px;font-weight:700}
#${HOST_ID} .mfs-body{border-top:1px solid var(--b);padding:12px 14px}
#${HOST_ID} .mfs-status{font-size:11px;color:var(--m);margin-bottom:9px;padding:7px 9px;background:#FAFBFB;border-radius:8px}
#${HOST_ID} .mfs-controls{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:9px}
#${HOST_ID} .mfs-search{flex:1 1 300px;min-width:220px;height:38px;border:1px solid #D1D5DB;border-radius:8px;padding:0 10px}
#${HOST_ID} select{height:38px;border:1px solid #D1D5DB;border-radius:8px;background:#fff;padding:0 8px;color:var(--t)}
#${HOST_ID} .mfs-results-head{display:flex;justify-content:space-between;color:var(--m);font-size:11px;margin:7px 2px}
#${HOST_ID} .mfs-results{border:1px solid var(--b);border-radius:9px;max-height:430px;overflow:auto}
#${HOST_ID} .mfs-result{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:10px;align-items:center;border:0;border-bottom:1px solid #F0F1F2;background:#fff;padding:10px;text-align:right;color:var(--t)}
#${HOST_ID} .mfs-result:hover{background:#F2FBFA}
#${HOST_ID} .mfs-result:last-child{border-bottom:0}
#${HOST_ID} .mfs-title{min-width:0}
#${HOST_ID} .mfs-title strong{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px}
#${HOST_ID} .mfs-title small{display:block;color:var(--m);font-size:10px;margin-top:3px}
#${HOST_ID} .mfs-responses{font-size:10px;color:var(--m);white-space:nowrap}
#${HOST_ID} .mfs-open{font-size:10px;color:var(--p);font-weight:700;white-space:nowrap}
#${HOST_ID} .mfs-empty{padding:28px 16px;text-align:center;color:var(--m);font-size:11px}
@media(max-width:700px){#${HOST_ID}{width:calc(100% - 16px);margin-inline:8px}#${HOST_ID} .mfs-result{grid-template-columns:minmax(0,1fr) auto}#${HOST_ID} .mfs-open{display:none!important}}
      `;

      document.head.appendChild(style);
    }

    function renderHeaderOnly() {
      const host = document.getElementById(HOST_ID);
      if (!host) return;

      host.querySelector('.mfs-count').textContent =
        `${state.forms.length} مفهرس`;

      const btn = host.querySelector('[data-action="index"]');
      btn.disabled = state.indexing;
      btn.textContent =
        state.indexing
          ? 'جارٍ الفهرسة...'
          : 'إعادة الفهرسة';

      const status = host.querySelector('.mfs-status');
      if (status && state.status) {
        status.textContent = state.status;
      }
    }

    function render() {
      const host = document.getElementById(HOST_ID);
      if (!host) return;

      const results = filtered();

      host.classList.toggle('mfs-collapsed', state.collapsed);

      host.querySelector('[data-action="collapse"]').textContent =
        state.collapsed ? '⌄' : '⌃';

      host.querySelector('.mfs-count').textContent =
        `${state.forms.length} مفهرس`;

      const indexButton = host.querySelector('[data-action="index"]');
      indexButton.disabled = state.indexing;
      indexButton.textContent =
        state.indexing
          ? 'جارٍ الفهرسة...'
          : 'إعادة الفهرسة';

      host.querySelector('.mfs-result-count').textContent =
        `${results.length} نتيجة`;

      const box = host.querySelector('.mfs-results');

      if (!state.forms.length) {
        box.innerHTML =
          '<div class="mfs-empty">جارٍ تجهيز فهرس جديد. يُمسح الفهرس السابق تلقائيًا ثم تبدأ فهرسة مخفية جديدة.</div>';
      } else if (!results.length) {
        box.innerHTML =
          '<div class="mfs-empty">لا توجد نتائج مطابقة.</div>';
      } else {
        box.innerHTML = results.map(form => `
          <button
            class="mfs-result"
            type="button"
            data-url="${escapeHtml(form.directUrl)}"
          >
            <span class="mfs-title">
              <strong>${escapeHtml(form.title)}</strong>
              <small>${escapeHtml(form.collectionName || 'خارج المجموعات')}</small>
            </span>
            <span class="mfs-responses">${form.responses} رد</span>
            <span class="mfs-open">فتح النموذج ↗</span>
          </button>
        `).join('');

        box.querySelectorAll('.mfs-result').forEach(btn => {
          btn.addEventListener('click', event => {
            const url = btn.dataset.url;
            if (!url) return;

            if (
              event.ctrlKey ||
              event.metaKey ||
              event.shiftKey
            ) {
              window.open(url, '_blank', 'noopener');
            } else {
              location.href = url;
            }
          });
        });
      }

      host.querySelector('.mfs-status').textContent =
        state.status ||
        'الفهرسة تلقائية ومخفية وصارمة؛ يُمسح الفهرس السابق أولًا عند كل دخول.';
    }

    function mount(options = {}) {
      if (!isPortal()) return;

      hideTemplateDiscovery();

      const freshEntry = options.freshEntry === true;
      const autoIndex = options.autoIndex !== false;

      if (freshEntry) {
        document.getElementById(HOST_ID)?.remove();
        state.mounted = false;
        state.collapsed = true;
        state.autoIndexStarted = false;
        purgeIndex();
      }

      if (document.getElementById(HOST_ID)) {
        state.mounted = true;
        return;
      }

      if (!freshEntry) purgeIndex();

      injectStyles();

      const host = document.createElement('section');
      host.id = HOST_ID;
      host.className = 'mfs-collapsed';

      host.innerHTML = `
        <div class="mfs-head">
          <div class="mfs-brand">
            <span class="mfs-logo">F</span>
            <div>
              <strong>محسن Microsoft Forms</strong>
              <small>فهرسة تلقائية مخفية · بحث مباشر في النماذج</small>
            </div>
          </div>
          <div class="mfs-head-actions">
            <span class="mfs-count">0 مفهرس</span>
            <button class="mfs-primary" data-action="index" type="button">إعادة الفهرسة</button>
            <button class="mfs-collapse" data-action="collapse" type="button">⌄</button>
          </div>
        </div>

        <div class="mfs-body">
          <div class="mfs-status">
            تم مسح الفهرس السابق. ستبدأ الفهرسة في الخلفية بدون نافذة منبثقة.
          </div>

          <div class="mfs-controls">
            <input class="mfs-search" type="search" placeholder="ابحث باسم النموذج أو المجموعة...">
            <select class="mfs-filter">
              <option value="all">كل النماذج</option>
              <option value="folders">داخل المجموعات</option>
              <option value="outside">خارج المجموعات</option>
              <option value="responses">لها ردود</option>
              <option value="zero">بدون ردود</option>
            </select>
            <select class="mfs-sort">
              <option value="responses-desc">الأكثر ردودًا</option>
              <option value="responses-asc">الأقل ردودًا</option>
              <option value="title">العنوان</option>
              <option value="folder">المجموعة</option>
            </select>
          </div>

          <div class="mfs-results-head">
            <strong class="mfs-result-count">0 نتيجة</strong>
            <span>الضغط على النتيجة يفتح النموذج نفسه مباشرة</span>
          </div>

          <div class="mfs-results"></div>

          <div style="display:flex;justify-content:space-between;margin-top:8px;color:#8A8F98;font-size:9px">
            <span>© 2026 Mohammed Almalki (M0HM3D85) — جميع الحقوق محفوظة</span>
            <span>v${FINAL_VERSION}</span>
          </div>
        </div>
      `;

      const anchor =
        document.querySelector('[role="tablist"]') ||
        document.querySelector(
          '[data-automation-id="newFormButton"]'
        )?.parentElement ||
        document.querySelector('#scroll-dnd');

      if (anchor?.parentElement) {
        anchor.parentElement.insertBefore(host, anchor);
      } else {
        document.body.prepend(host);
      }

      host.querySelector('[data-action="index"]')
        .addEventListener('click', rebuildIndexStrict);

      host.querySelector('[data-action="collapse"]')
        .addEventListener('click', () => {
          state.collapsed = !state.collapsed;
          render();
        });

      host.querySelector('.mfs-search')
        .addEventListener('input', event => {
          state.query = event.target.value;
          render();
        });

      host.querySelector('.mfs-filter')
        .addEventListener('change', event => {
          state.filter = event.target.value;
          render();
        });

      host.querySelector('.mfs-sort')
        .addEventListener('change', event => {
          state.sort = event.target.value;
          render();
        });

      state.mounted = true;
      render();

      hideTemplateDiscovery();

      [250, 900, 2200].forEach(delay => {
        setTimeout(() => {
          if (isPortal()) hideTemplateDiscovery();
        }, delay);
      });

      window.MAD_FORMS_PRODUCTIVITY = {
        version: FINAL_VERSION,
        index: rebuildIndexStrict,
        forms: () => [...state.forms],
        collections: () => [...state.collections],
        clear: () => {
          purgeIndex();
          render();
        },
        hideTemplates: hideTemplateDiscovery
      };

      if (autoIndex && !state.autoIndexStarted) {
        state.autoIndexStarted = true;

        setStatus(
          'تم مسح الفهرس السابق. جارٍ بدء الفهرسة المخفية في الخلفية...',
          'running'
        );

        renderHeaderOnly();

        setTimeout(() => {
          if (isPortal() && !state.indexing) {
            rebuildIndexStrict();
          }
        }, 700);
      }
    }

    function enterPortalFresh() {
      mount({
        freshEntry: true,
        autoIndex: true
      });
    }

    return {
      workerBoot,
      mount,
      enterPortalFresh,
      isPortal,
      purgeIndex,
      hideTemplateDiscovery
    };
  })();


  /* ============================== SETTINGS ============================== */

  const SETTINGS = (() => {
    const HOST_ID = 'm0hm3d85-forms-settings-presets';
    const STORAGE_KEY = 'M0HM3D85_FORMS_SETTINGS_PRESETS';

    const definitions = [
      ['practice', 'وضع التدريب', 'switch'],
      ['autoResults', 'إظهار النتائج تلقائياً', 'switch'],
      ['accept', 'قبول الاستجابات', 'checkbox'],
      ['start', 'تاريخ البدء', 'switch'],
      ['end', 'تاريخ الانتهاء', 'switch'],
      ['duration', 'تعيين المدة الزمنية', 'switch'],
      ['shuffle', 'تبديل ترتيب الأسئلة عشوائياً', 'switch'],
      ['disableNumber', 'تعطيل رقم السؤال للمستجيبين', 'switch'],
      ['progress', 'إظهار شريط التقدم', 'switch'],
      ['hideAnother', 'إخفاء إرسال رد آخر', 'switch'],
      ['thank', 'تخصيص رسالة الشكر', 'switch'],
      ['save', '#allow-save-response-setting', 'selector'],
      ['edit', '#allow-edit-response-setting', 'selector'],
      ['receipt', 'السماح بإرسال إيصال بالاستجابات بعد الإرسال', 'switch'],
      ['notify', 'الحصول على إعلام بالبريد الإلكتروني لكل استجابة', 'switch']
    ];

    function findByLabel(label, kind) {
      if (label.startsWith('#')) {
        return document.querySelector(label);
      }

      const candidates = [
        ...document.querySelectorAll(
          kind === 'switch'
            ? '[role="switch"]'
            : 'input[type="checkbox"],[role="checkbox"]'
        )
      ];

      const direct = candidates.find(
        el => clean(el.getAttribute('aria-label')) === label
      );

      if (direct) return direct;

      const textNode = [
        ...document.querySelectorAll('label,span,div')
      ].find(
        el => clean(el.textContent) === label
      );

      return (
        textNode?.closest('label')?.querySelector(
          'input,[role="checkbox"],[role="switch"]'
        ) ||
        textNode?.parentElement?.querySelector(
          'input,[role="checkbox"],[role="switch"]'
        ) ||
        null
      );
    }

    function read() {
      const values = {};

      for (const [key, label, kind] of definitions) {
        const el = findByLabel(label, kind);
        if (!el) continue;

        values[key] =
          el.getAttribute('aria-checked') === 'true' ||
          el.checked === true;
      }

      const audience = [
        'anyoneCanRespond',
        'orgCanRespond',
        'specificPeopleCanRespond'
      ].find(id => {
        const el = document.getElementById(id);
        return (
          el?.checked === true ||
          el?.getAttribute('aria-checked') === 'true'
        );
      });

      values.audience = audience || '';

      return values;
    }

    function load() {
      try {
        return JSON.parse(
          localStorage.getItem(STORAGE_KEY) || '[]'
        );
      } catch {
        return [];
      }
    }

    function saveAll(value) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(value)
      );
    }

    async function apply(preset) {
      const before = read();

      if (
        preset.values.audience &&
        preset.values.audience !== before.audience
      ) {
        const radio =
          document.getElementById(
            preset.values.audience
          );

        if (
          radio &&
          !radio.disabled &&
          radio.getAttribute('aria-disabled') !== 'true'
        ) {
          radio.click();
          await sleep(120);
        }
      }

      for (const [key, label, kind] of definitions) {
        if (!(key in preset.values)) continue;

        const el = findByLabel(label, kind);

        if (
          !el ||
          el.disabled ||
          el.getAttribute('aria-disabled') === 'true'
        ) {
          continue;
        }

        const current =
          el.getAttribute('aria-checked') === 'true' ||
          el.checked === true;

        if (current !== Boolean(preset.values[key])) {
          el.click();
          await sleep(120);
        }
      }
    }

    function mount() {
      const pane =
        document.querySelector(
          '#side-pane-container'
        );

      if (
        !pane ||
        document.getElementById(HOST_ID)
      ) {
        return;
      }

      const box =
        document.createElement('div');

      box.id = HOST_ID;
      box.dir = 'rtl';
      box.style.cssText = [
        'margin:10px',
        'padding:10px',
        'border:1px solid #CFE8E6',
        'border-radius:10px',
        'background:#F8FCFC',
        'font-family:Segoe UI,Tahoma,Arial,sans-serif',
        'color:#1F2937'
      ].join(';');

      box.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
          <strong style="font-size:12px">قوالب الإعدادات</strong>
          <span style="font-size:9px;color:#6B7280">M0HM3D85</span>
        </div>

        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
          <select
            class="msp-list"
            style="flex:1;min-width:150px;height:34px;border:1px solid #D1D5DB;border-radius:8px;background:#fff"
          ></select>
          <button data-a="apply">تطبيق</button>
          <button data-a="save">حفظ الحالي</button>
          <button data-a="delete">حذف</button>
        </div>

        <div
          class="msp-status"
          style="font-size:10px;color:#6B7280;margin-top:7px"
        >
          يتم تطبيق الفروقات فقط وتجاهل الخيارات المعطلة.
        </div>
      `;

      box.querySelectorAll('button').forEach(button => {
        button.style.cssText = [
          'border:1px solid #007874',
          'border-radius:8px',
          'padding:6px 9px',
          'background:#fff',
          'color:#007874',
          'cursor:pointer'
        ].join(';');
      });

      pane.prepend(box);

      const list =
        box.querySelector('.msp-list');

      const status =
        box.querySelector('.msp-status');

      const render = () => {
        const presets = load();

        list.innerHTML =
          '<option value="">اختر قالبًا...</option>' +
          presets.map(
            (preset, index) =>
              `<option value="${index}">${escapeHtml(preset.name)}</option>`
          ).join('');
      };

      render();

      box.querySelector('[data-a="save"]').onclick = () => {
        const name = prompt('اسم القالب:');
        if (!name) return;

        const presets = load();

        presets.push({
          name: clean(name),
          values: read(),
          createdAt: Date.now()
        });

        saveAll(presets);
        render();

        status.textContent =
          'تم حفظ الإعدادات الحالية.';
      };

      box.querySelector('[data-a="apply"]').onclick = async () => {
        const index = Number(list.value);
        const presets = load();

        if (
          !Number.isInteger(index) ||
          !presets[index]
        ) {
          return;
        }

        await apply(presets[index]);

        status.textContent =
          `تم تطبيق «${presets[index].name}» على الفروقات المتاحة.`;
      };

      box.querySelector('[data-a="delete"]').onclick = () => {
        const index = Number(list.value);
        const presets = load();

        if (
          !Number.isInteger(index) ||
          !presets[index]
        ) {
          return;
        }

        if (
          !confirm(
            `حذف القالب «${presets[index].name}»؟`
          )
        ) {
          return;
        }

        presets.splice(index, 1);
        saveAll(presets);
        render();

        status.textContent =
          'تم حذف القالب.';
      };
    }

    return {
      mount,
      read,
      load,
      apply
    };
  })();

  /* ============================== EDITOR ============================== */

  function startEditorEnhancer() {
    const VERSION = FINAL_VERSION;
    const HOST_ID =
      'm0hm3d85-forms-editor-enhancer';

    const STYLE_ID =
      `${HOST_ID}-style`;

    const LEGACY_HOST_PREFIX =
      'm0hm3d85-forms-editor-enhancer-v';

    try {
      window.MAD_FORMS_EDITOR_ENHANCER?.destroy?.();
    } catch {}

    [
      ...document.querySelectorAll(
        `[id^="${LEGACY_HOST_PREFIX}"],#${HOST_ID}`
      )
    ].forEach(el => {
      try { el.remove(); } catch {}
    });

    [
      ...document.querySelectorAll(
        `style[id^="${LEGACY_HOST_PREFIX}"],#${STYLE_ID}`
      )
    ].forEach(el => {
      try { el.remove(); } catch {}
    });

    function labelOf(el) {
      return clean(
        el?.getAttribute?.('aria-label') ||
        el?.getAttribute?.('title') ||
        el?.innerText ||
        el?.textContent ||
        ''
      );
    }

    function parseNumber(value, fallback = 0) {
      const n = Number(
        westernDigits(value)
          .replace(',', '.')
          .replace(/[^\d.-]/g, '')
      );

      return Number.isFinite(n)
        ? n
        : fallback;
    }

    function stripHtml(value = '') {
      const div =
        document.createElement('div');

      div.innerHTML =
        String(value ?? '');

      return clean(
        div.textContent ||
        div.innerText ||
        ''
      );
    }

    function getFormRoot() {
      return (
        document.querySelector(
          '[data-automation-id="formRoot"]'
        ) ||
        document.querySelector('main') ||
        document.body
      );
    }

    function getAllWrappers() {
      return [
        ...document.querySelectorAll(
          '[data-automation-id="questionWrapper"]'
        )
      ];
    }

    function getDesignerCards() {
      return [
        ...document.querySelectorAll(
          '[data-automation-id="questionDesignerCard"]'
        )
      ].filter(visible);
    }

    function questionNumberFrom(el, fallback = 0) {
      const raw = westernDigits(
        el?.getAttribute?.('aria-label') ||
        el?.querySelector?.(
          '[data-automation-id="questionTitle"]'
        )?.innerText ||
        el?.innerText ||
        ''
      );

      const match =
        raw.match(/^\s*(\d+)\s*[.)\-–—]/) ||
        raw.match(/(?:السؤال|question)\s*(\d+)/i);

      return match
        ? Number(match[1])
        : fallback;
    }

    function wrapperByNumber(number) {
      return (
        getAllWrappers().find(
          (wrapper, index) =>
            questionNumberFrom(
              wrapper,
              index + 1
            ) === number
        ) ||
        null
      );
    }

    function getDesignerCardByNumber(number) {
      return (
        getDesignerCards().find(card =>
          questionNumberFrom(card, 0) === number
        ) ||
        null
      );
    }

    function getOptionElements(root) {
      if (!root) return [];

      const explicit = [
        ...root.querySelectorAll(
          '[data-automation-id="questionChoiceOptionContainer"]'
        )
      ].filter(visible);

      if (explicit.length) {
        return explicit;
      }

      return [
        ...root.querySelectorAll(
          '[role="listitem"],[role="radio"]'
        )
      ].filter(el =>
        visible(el) &&
        clean(el.innerText)
      );
    }

    function extractOptionText(el) {
      return clean(
        el?.querySelector?.('[role="textbox"]')?.innerText ||
        el?.innerText ||
        el?.textContent ||
        ''
      );
    }

    function cleanQuestionTitle(raw, number) {
      let text =
        westernDigits(
          clean(raw)
        );

      if (number) {
        text = text.replace(
          new RegExp(
            `^\\s*${number}\\s*[.)\\-–—]?\\s*`
          ),
          ''
        );
      }

      return text
        .replace(/\s+مطلوب الإجابة\.?/g, ' ')
        .replace(/\s+غير مطلوب\.?/g, ' ')
        .replace(
          /\s+(?:خيار واحد|إجابات متعددة|نص من سطر واحد|نص متعدد الأسطر)\.?/g,
          ' '
        )
        .replace(
          /\s+\(\s*\d+(?:\.\d+)?\s*(?:نقطة|نقاط)\s*\)\s*$/g,
          ' '
        )
        .replace(/\s+/g, ' ')
        .trim();
    }

    function detectType(summaryText, options) {
      const text =
        clean(summaryText);

      if (
        /نص من سطر واحد|short answer|text/i.test(text)
      ) {
        return 'text';
      }

      if (
        /نص متعدد الأسطر|long answer/i.test(text)
      ) {
        return 'longtext';
      }

      if (
        /إجابات متعددة|multiple answers/i.test(text)
      ) {
        return 'multiple';
      }

      if (options.length === 2) {
        const set =
          new Set(
            options.map(canonical)
          );

        if (
          (
            set.has('صح') &&
            set.has('خطا')
          ) ||
          (
            set.has('true') &&
            set.has('false')
          )
        ) {
          return 'truefalse';
        }
      }

      if (
        /خيار واحد|choice/i.test(text) ||
        options.length
      ) {
        return 'choice';
      }

      return 'unknown';
    }

    function detectPoints(summaryText) {
      const text =
        westernDigits(
          clean(summaryText)
        );

      const match =
        text.match(
          /\(\s*(\d+(?:[.,]\d+)?)\s*(?:نقطة|نقاط)\s*\)/
        ) ||
        text.match(
          /(\d+(?:[.,]\d+)?)\s*(?:نقطة|نقاط)/
        );

      return match
        ? parseNumber(match[1], 0)
        : 0;
    }

    function detectRequired(summaryText) {
      const text =
        clean(summaryText);

      if (
        /مطلوب الإجابة|Required/i.test(text)
      ) {
        return true;
      }

      if (
        /غير مطلوب|Optional/i.test(text)
      ) {
        return false;
      }

      return null;
    }

    function similarity(a, b) {
      const x = canonical(a);
      const y = canonical(b);

      if (!x || !y) return 0;
      if (x === y) return 1;

      const bigrams = string => {
        const chars =
          string.replace(/\s+/g, ' ');

        const result = [];

        for (
          let index = 0;
          index < chars.length - 1;
          index++
        ) {
          result.push(
            chars.slice(index, index + 2)
          );
        }

        return result;
      };

      const A = bigrams(x);
      const B = bigrams(y);

      if (!A.length || !B.length) {
        return 0;
      }

      const counts =
        new Map();

      for (const bg of A) {
        counts.set(
          bg,
          (counts.get(bg) || 0) + 1
        );
      }

      let intersection = 0;

      for (const bg of B) {
        const count =
          counts.get(bg) || 0;

        if (count > 0) {
          intersection++;
          counts.set(
            bg,
            count - 1
          );
        }
      }

      return (
        2 * intersection /
        (A.length + B.length)
      );
    }

    function findDefinitionEndpoint() {
      const entries =
        performance.getEntriesByType(
          'resource'
        ) || [];

      const candidates =
        entries
          .map(entry => entry.name)
          .filter(Boolean)
          .filter(url =>
            /\/formapi\/api\//i.test(url) &&
            /questions/i.test(url) &&
            /choices/i.test(url)
          );

      const decoded = url => {
        try {
          return decodeURIComponent(url);
        } catch {
          return url;
        }
      };

      return (
        candidates.find(url =>
          /questions\s*\(\s*(?:\$|%24)expand\s*=\s*choices\s*\)/i.test(
            decoded(url)
          )
        ) ||
        candidates[0] ||
        ''
      );
    }

    function safeJsonParse(value) {
      if (
        typeof value !== 'string'
      ) {
        return null;
      }

      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    }

    function collectQuestionModels(root) {
      const found = [];
      const seen = new WeakSet();
      const stack = [root];

      while (stack.length) {
        const value =
          stack.pop();

        if (
          !value ||
          typeof value !== 'object' ||
          seen.has(value)
        ) {
          continue;
        }

        seen.add(value);

        if (
          typeof value.questionInfo === 'string' ||
          value.formsProRTQuestionTitle != null
        ) {
          const info =
            safeJsonParse(value.questionInfo) ||
            {};

          const title =
            stripHtml(
              value.formsProRTQuestionTitle ||
              value.title ||
              value.questionTitle ||
              value.displayText ||
              ''
            );

          const choices =
            Array.isArray(info.Choices)
              ? info.Choices
              : [];

          const id =
            clean(
              value.id ??
              value.questionId ??
              value.QuestionId ??
              value.formsProRTQuestionId ??
              value.FormsProRTQuestionId ??
              value.uniqueId ??
              ''
            );

          const rawOrder =
            value.order ??
            value.Order ??
            value.questionOrder ??
            value.QuestionOrder ??
            null;

          const parsedOrder =
            Number(rawOrder);

          found.push({
            id,
            order:
              Number.isFinite(parsedOrder)
                ? parsedOrder
                : null,
            title,
            titleKey:
              canonical(title),
            questionInfo:
              info,
            choices:
              choices.map(choice => ({
                text: stripHtml(
                  choice?.Description ??
                  choice?.description ??
                  choice?.Text ??
                  choice?.text ??
                  ''
                ),
                isAnswerKey:
                  choice?.IsAnswerKey === true ||
                  choice?.isAnswerKey === true ||
                  choice?.IsCorrect === true ||
                  choice?.isCorrect === true
              })),
            correctAnswers:
              choices
                .filter(choice =>
                  choice?.IsAnswerKey === true ||
                  choice?.isAnswerKey === true ||
                  choice?.IsCorrect === true ||
                  choice?.isCorrect === true
                )
                .map(choice =>
                  stripHtml(
                    choice?.Description ??
                    choice?.description ??
                    choice?.Text ??
                    choice?.text ??
                    ''
                  )
                )
                .filter(Boolean),
            points:
              Number.isFinite(Number(info.Point))
                ? Number(info.Point)
                : null,
            required:
              value.required === true
                ? true
                : value.required === false
                  ? false
                  : null,
            raw: value
          });
        }

        if (Array.isArray(value)) {
          for (
            let index = value.length - 1;
            index >= 0;
            index--
          ) {
            const child =
              value[index];

            if (
              child &&
              typeof child === 'object'
            ) {
              stack.push(child);
            }
          }
        } else {
          const keys =
            Object.keys(value);

          for (
            let index = keys.length - 1;
            index >= 0;
            index--
          ) {
            const key =
              keys[index];

            if (
              /token|authorization|cookie|session|telemetry/i.test(
                key
              )
            ) {
              continue;
            }

            let child;

            try {
              child = value[key];
            } catch {
              continue;
            }

            if (
              child &&
              typeof child === 'object'
            ) {
              stack.push(child);
            }
          }
        }
      }

      const unique = [];
      const strongIds =
        new Set();

      for (const item of found) {
        if (item.id) {
          if (
            strongIds.has(item.id)
          ) {
            continue;
          }

          strongIds.add(item.id);
        }

        unique.push(item);
      }

      if (
        unique.length > 1 &&
        unique.every(item =>
          Number.isFinite(item.order)
        )
      ) {
        const distinctOrders =
          new Set(
            unique.map(item =>
              item.order
            )
          );

        if (
          distinctOrders.size === unique.length
        ) {
          unique.sort(
            (a, b) =>
              a.order - b.order
          );
        }
      }

      return unique;
    }

    const DIRECT_UNDO_STORAGE_KEY =
      'M0HM3D85_FORMS_DIRECT_BULK_UNDO_V120';

    const state = {
      questions: [],
      selectedType: 'all',
      requiredFilter: 'all',
      auditFilter: 'all',
      pointsOperator: 'any',
      pointsValue: 0,
      query: '',
      panelCollapsed: true,
      observer: null,
      answerModels: [],
      answerModelsLoaded: false,
      answerModelLoading: null,
      answerModelUrl: '',
      answerApiStatus: 'idle',
      answerApiError: '',
      selectedQuestions: new Set(),
      bulkRunning: false,
      bulkCancelRequested: false,
      bulkStatus:
        'حدد الأسئلة التي تريد تعديلها، ثم اختر العملية.',
      lastBulkUndo: [],
      lastBulkLabel: ''
    };

    try {
      const savedUndo =
        JSON.parse(
          sessionStorage.getItem(
            DIRECT_UNDO_STORAGE_KEY
          ) || 'null'
        );

      if (
        savedUndo &&
        savedUndo.href === location.href &&
        Array.isArray(
          savedUndo.items
        ) &&
        savedUndo.items.length
      ) {
        state.lastBulkUndo =
          savedUndo.items;

        state.lastBulkLabel =
          savedUndo.label || '';
      }
    } catch {}

    async function fetchFreshQuestionModels() {
      const endpoint =
        state.answerModelUrl ||
        findDefinitionEndpoint();

      if (!endpoint) {
        throw new Error(
          'لم أجد رابط تعريف أسئلة Microsoft Forms.'
        );
      }

      state.answerModelUrl =
        endpoint;

      const response =
        await fetch(
          endpoint,
          {
            credentials: 'include',
            cache: 'no-store'
          }
        );

      if (!response.ok) {
        throw new Error(
          `تعذر قراءة تعريف Forms: HTTP ${response.status}`
        );
      }

      const json =
        await response.json();

      return collectQuestionModels(json);
    }

    function bestModelForQuestion(
      question,
      models,
      usedIndexes
    ) {
      const qKey =
        canonical(question.title);

      let best = null;

      models.forEach((model, index) => {
        if (
          usedIndexes.has(index)
        ) {
          return;
        }

        let score = 0;

        if (
          qKey &&
          model.titleKey
        ) {
          if (
            qKey === model.titleKey
          ) {
            score = 1;
          } else if (
            qKey.includes(model.titleKey) ||
            model.titleKey.includes(qKey)
          ) {
            const shorter =
              Math.min(
                qKey.length,
                model.titleKey.length
              );

            const longer =
              Math.max(
                qKey.length,
                model.titleKey.length
              );

            score =
              0.82 +
              shorter /
              Math.max(longer, 1) *
              0.12;
          } else {
            score =
              similarity(
                question.title,
                model.title
              );
          }
        }

        const orderBonus =
          Math.max(
            0,
            0.06 -
            Math.abs(
              question.index - index
            ) *
            0.004
          );

        const total =
          score + orderBonus;

        if (
          !best ||
          total > best.total
        ) {
          best = {
            index,
            model,
            score,
            total
          };
        }
      });

      if (!best) return null;

      if (
        best.score >= 0.54 ||
        best.total >= 0.60
      ) {
        return best;
      }

      if (
        models[question.index] &&
        !usedIndexes.has(
          question.index
        )
      ) {
        return {
          index: question.index,
          model:
            models[question.index],
          score: 0,
          total: 0
        };
      }

      return null;
    }

    function detectLiveCorrectIndexes(card) {
      if (!card) {
        return {
          known: false,
          indexes: []
        };
      }

      const rows =
        getOptionElements(card);

      const indexes = [];
      let stateful = 0;

      rows.forEach((row, index) => {
        const button = [
          ...row.querySelectorAll(
            'button,[role="button"],[role="checkbox"]'
          )
        ].find(el =>
          /إجابة صحيحة|Correct answer/i.test(
            labelOf(el)
          )
        );

        if (!button) return;

        if (
          button.hasAttribute('aria-pressed') ||
          button.hasAttribute('aria-checked')
        ) {
          stateful++;
        }

        if (
          button.getAttribute('aria-pressed') === 'true' ||
          button.getAttribute('aria-checked') === 'true'
        ) {
          indexes.push(index);
        }
      });

      return {
        known:
          stateful > 0,
        indexes
      };
    }

    function scanQuestions() {
      const wrappers =
        getAllWrappers()
          .filter(el =>
            el.isConnected
          );

      const cards =
        getDesignerCards();

      const roots =
        wrappers.length
          ? wrappers
          : cards;

      return roots.map(
        (wrapper, index) => {
          const number =
            questionNumberFrom(
              wrapper,
              index + 1
            );

          const designerCard =
            getDesignerCardByNumber(
              number
            ) ||
            (
              cards.length === roots.length &&
              roots.length > 1
                ? cards[index]
                : null
            );

          const summaryText =
            clean(
              wrapper.querySelector(
                '[data-automation-id="questionTitle"]'
              )?.innerText ||
              wrapper.getAttribute(
                'aria-label'
              ) ||
              wrapper.innerText ||
              ''
            );

          const optionRoot =
            designerCard ||
            wrapper;

          const optionElements =
            getOptionElements(
              optionRoot
            );

          const options =
            optionElements
              .map(
                extractOptionText
              )
              .map(clean)
              .filter(Boolean);

          const correct =
            detectLiveCorrectIndexes(
              designerCard ||
              wrapper
            );

          return {
            index,
            number,
            title:
              cleanQuestionTitle(
                summaryText,
                number
              ),
            summaryText,
            type:
              detectType(
                summaryText,
                options
              ),
            points:
              detectPoints(
                summaryText
              ),
            required:
              detectRequired(
                summaryText
              ),
            options,
            correctKnown:
              correct.known,
            correctIndexes:
              correct.indexes,
            correctAnswers: [],
            answerSource:
              correct.known
                ? 'dom'
                : null,
            apiModel: null,
            wrapper,
            designerCard,
            optionElements,
            issues: []
          };
        }
      );
    }

    function questionFromApiModel(
      model,
      index
    ) {
      const options =
        model.choices
          .map(choice =>
            choice.text
          )
          .filter(Boolean);

      return {
        index,
        number:
          index + 1,
        title:
          model.title ||
          `السؤال ${index + 1}`,
        summaryText:
          model.title || '',
        type:
          detectType(
            model.title || '',
            options
          ),
        points:
          Number.isFinite(
            model.points
          )
            ? model.points
            : 0,
        required: null,
        options,
        correctKnown:
          !!model.choices.length,
        correctIndexes:
          model.choices
            .map(
              (choice, choiceIndex) =>
                choice.isAnswerKey
                  ? choiceIndex
                  : -1
            )
            .filter(
              choiceIndex =>
                choiceIndex >= 0
            ),
        correctAnswers:
          [...model.correctAnswers],
        answerSource:
          model.choices.length
            ? 'forms-api'
            : null,
        apiModel:
          model,
        wrapper:
          wrapperByNumber(
            index + 1
          ),
        designerCard: null,
        optionElements: [],
        issues: []
      };
    }

    function mergeApiModels() {
      const models =
        state.answerModels;

      if (!models.length) {
        return;
      }

      const used =
        new Set();

      for (
        const question
        of state.questions
      ) {
        const match =
          bestModelForQuestion(
            question,
            models,
            used
          );

        if (!match) continue;

        used.add(
          match.index
        );

        const model =
          match.model;

        question.apiModel =
          model;

        if (
          model.choices.length
        ) {
          question.options =
            model.choices
              .map(choice =>
                choice.text
              )
              .filter(Boolean);

          question.correctKnown =
            true;

          question.correctIndexes =
            model.choices
              .map(
                (choice, index) =>
                  choice.isAnswerKey
                    ? index
                    : -1
              )
              .filter(index =>
                index >= 0
              );

          question.correctAnswers =
            [...model.correctAnswers];

          question.answerSource =
            'forms-api';
        }

        if (
          model.points != null &&
          Number.isFinite(
            model.points
          )
        ) {
          question.points =
            model.points;
        }
      }
    }

    function buildAudit(questions) {
      const titleMap =
        new Map();

      for (
        const question
        of questions
      ) {
        question.issues = [];

        if (!question.title) {
          question.issues.push({
            level: 'error',
            code: 'missing-title',
            text: 'عنوان السؤال فارغ.'
          });
        }

        if (
          question.points === 0
        ) {
          question.issues.push({
            level: 'warn',
            code: 'zero-points',
            text: 'درجة السؤال تساوي 0.'
          });
        }

        if (
          question.required === false
        ) {
          question.issues.push({
            level: 'info',
            code: 'optional',
            text: 'السؤال غير مطلوب.'
          });
        }

        if (
          question.options.length
        ) {
          const seen =
            new Map();

          question.options.forEach(
            (option, optionIndex) => {
              const key =
                canonical(option);

              if (!key) return;

              if (
                seen.has(key)
              ) {
                question.issues.push({
                  level: 'error',
                  code: 'duplicate-option',
                  text:
                    `الخيار ${optionIndex + 1} مكرر مع الخيار ${seen.get(key) + 1}.`
                });
              } else {
                seen.set(
                  key,
                  optionIndex
                );
              }
            }
          );
        }

        if (
          [
            'choice',
            'multiple',
            'truefalse'
          ].includes(
            question.type
          ) &&
          question.correctKnown &&
          question.correctIndexes.length === 0
        ) {
          question.issues.push({
            level: 'error',
            code: 'missing-correct',
            text: 'لم يتم تحديد إجابة صحيحة.'
          });
        }

        const titleKey =
          canonical(
            question.title
          );

        if (titleKey) {
          if (
            titleMap.has(
              titleKey
            )
          ) {
            question.issues.push({
              level: 'error',
              code: 'duplicate-title',
              text:
                `عنوان مكرر مع السؤال ${titleMap.get(titleKey)}.`
            });
          } else {
            titleMap.set(
              titleKey,
              question.number
            );
          }
        }
      }

      return questions;
    }

    function refresh() {
      const previous =
        new Map(
          state.questions.map(
            question => [
              question.number,
              question
            ]
          )
        );

      const scanned =
        scanQuestions();

      if (
        state.answerModels.length &&
        scanned.length <
          state.answerModels.length
      ) {
        const present =
          new Set(
            scanned.map(
              question =>
                question.number
            )
          );

        state.answerModels.forEach(
          (model, index) => {
            const number =
              index + 1;

            if (
              present.has(number)
            ) {
              return;
            }

            const old =
              previous.get(number);

            scanned.push(
              old
                ? {
                    ...old,
                    wrapper:
                      wrapperByNumber(
                        number
                      ),
                    issues: []
                  }
                : questionFromApiModel(
                    model,
                    index
                  )
            );
          }
        );

        scanned.sort(
          (a, b) =>
            a.number - b.number
        );

        scanned.forEach(
          (question, index) => {
            question.index = index;
          }
        );
      }

      state.questions =
        buildAudit(
          scanned
        );

      for (
        const question
        of state.questions
      ) {
        const old =
          previous.get(
            question.number
          );

        if (
          question.required == null &&
          old?.required != null
        ) {
          question.required =
            old.required;
        }
      }

      mergeApiModels();
      buildAudit(
        state.questions
      );

      render();

      return state.questions;
    }

    async function loadAnswerModels(
      force = false
    ) {
      if (
        state.answerModelLoading
      ) {
        return state.answerModelLoading;
      }

      if (
        state.answerModelsLoaded &&
        !force
      ) {
        return state.answerModels;
      }

      state.answerApiStatus =
        'loading';

      renderApiStatus();

      state.answerModelLoading =
        (async () => {
          try {
            const models =
              await fetchFreshQuestionModels();

            state.answerModels =
              models;

            state.answerModelsLoaded =
              true;

            state.answerApiStatus =
              models.length
                ? 'ready'
                : 'empty';

            refresh();

            return models;
          } catch (error) {
            state.answerApiStatus =
              'error';

            state.answerApiError =
              String(
                error?.message ||
                error
              );

            console.warn(
              'تعذر تحميل تعريف Forms:',
              error
            );

            return [];
          } finally {
            state.answerModelLoading =
              null;

            renderApiStatus();
          }
        })();

      return state.answerModelLoading;
    }

    function typeLabel(type) {
      return ({
        choice: 'اختيار',
        multiple: 'متعدد',
        truefalse: 'صح/خطأ',
        text: 'نصي',
        longtext: 'نصي طويل',
        unknown: 'غير معروف'
      })[type] || type;
    }

    function issueCount(question) {
      return question.issues.filter(
        issue =>
          issue.level !== 'info'
      ).length;
    }

    function duplicateTitleNumbers() {
      const groups =
        new Map();

      for (
        const question
        of state.questions
      ) {
        const key =
          canonical(
            question.title
          );

        if (!key) continue;

        if (!groups.has(key)) {
          groups.set(
            key,
            []
          );
        }

        groups.get(key).push(
          question.number
        );
      }

      const result =
        new Set();

      groups.forEach(numbers => {
        if (
          numbers.length > 1
        ) {
          numbers.forEach(number =>
            result.add(number)
          );
        }
      });

      return result;
    }

    function filteredQuestions() {
      const query =
        canonical(
          state.query
        );

      const duplicates =
        duplicateTitleNumbers();

      return state.questions.filter(
        question => {
          if (
            state.selectedType !== 'all' &&
            question.type !==
              state.selectedType &&
            !(
              state.selectedType === 'text' &&
              [
                'text',
                'longtext'
              ].includes(
                question.type
              )
            )
          ) {
            return false;
          }

          if (
            state.requiredFilter === 'required' &&
            question.required !== true
          ) {
            return false;
          }

          if (
            state.requiredFilter === 'optional' &&
            question.required !== false
          ) {
            return false;
          }

          if (
            state.requiredFilter === 'unknown' &&
            question.required != null
          ) {
            return false;
          }

          if (
            state.auditFilter === 'issues' &&
            issueCount(question) === 0
          ) {
            return false;
          }

          if (
            state.auditFilter === 'clean' &&
            issueCount(question) > 0
          ) {
            return false;
          }

          if (
            state.auditFilter === 'zero-points' &&
            Number(
              question.points || 0
            ) !== 0
          ) {
            return false;
          }

          if (
            state.auditFilter === 'missing-correct' &&
            !(
              [
                'choice',
                'multiple',
                'truefalse'
              ].includes(
                question.type
              ) &&
              question.correctKnown &&
              question.correctIndexes.length === 0
            )
          ) {
            return false;
          }

          if (
            state.auditFilter === 'correct-known' &&
            !(
              question.correctKnown &&
              question.correctIndexes.length > 0
            )
          ) {
            return false;
          }

          if (
            state.auditFilter === 'duplicate-title' &&
            !duplicates.has(
              question.number
            )
          ) {
            return false;
          }

          if (
            state.auditFilter === 'duplicate-option' &&
            !question.issues.some(
              issue =>
                issue.code ===
                  'duplicate-option'
            )
          ) {
            return false;
          }

          if (
            state.pointsOperator !== 'any'
          ) {
            const actual =
              Number(
                question.points || 0
              );

            const expected =
              Number(
                state.pointsValue || 0
              );

            const matches = ({
              '=':
                actual === expected,
              '!=':
                actual !== expected,
              '>':
                actual > expected,
              '>=':
                actual >= expected,
              '<':
                actual < expected,
              '<=':
                actual <= expected
            })[
              state.pointsOperator
            ];

            if (!matches) {
              return false;
            }
          }

          if (query) {
            const haystack =
              canonical(
                `${question.number} ${question.title} ${question.options.join(' ')} ${question.correctAnswers.join(' ')}`
              );

            if (
              !haystack.includes(
                query
              )
            ) {
              return false;
            }
          }

          return true;
        }
      );
    }

    function selectedQuestionObjects() {
      return [
        ...state.selectedQuestions
      ]
        .sort(
          (a, b) =>
            a - b
        )
        .map(number =>
          state.questions.find(
            question =>
              question.number === number
          )
        )
        .filter(Boolean);
    }


    function waitForValue(
      finder,
      timeout = 8000,
      interval = 100
    ) {
      return new Promise(
        async (resolve, reject) => {
          const started =
            Date.now();

          while (
            Date.now() - started <
              timeout
          ) {
            try {
              const value =
                finder();

              if (value) {
                resolve(value);
                return;
              }
            } catch {}

            await sleep(interval);
          }

          reject(
            new Error(
              'انتهت مهلة انتظار عنصر Microsoft Forms.'
            )
          );
        }
      );
    }

    async function safeClick(el) {
      if (!el) {
        throw new Error(
          'العنصر المطلوب غير موجود.'
        );
      }

      try {
        el.scrollIntoView({
          block: 'center',
          inline: 'center',
          behavior: 'auto'
        });
      } catch {}

      await sleep(80);

      try {
        el.focus({
          preventScroll: true
        });
      } catch {}

      if (window.PointerEvent) {
        el.dispatchEvent(
          new PointerEvent(
            'pointerdown',
            {
              bubbles: true,
              cancelable: true,
              pointerType: 'mouse'
            }
          )
        );
      }

      el.dispatchEvent(
        new MouseEvent(
          'mousedown',
          {
            bubbles: true,
            cancelable: true,
            view: window
          }
        )
      );

      if (window.PointerEvent) {
        el.dispatchEvent(
          new PointerEvent(
            'pointerup',
            {
              bubbles: true,
              cancelable: true,
              pointerType: 'mouse'
            }
          )
        );
      }

      el.dispatchEvent(
        new MouseEvent(
          'mouseup',
          {
            bubbles: true,
            cancelable: true,
            view: window
          }
        )
      );

      el.click();

      await sleep(260);
    }

    function liveTitleEditors() {
      return [
        ...document.querySelectorAll(
          '[role="textbox"],[contenteditable="true"],textarea,input'
        )
      ].filter(el => {
        if (!visible(el)) {
          return false;
        }

        if (
          el.closest?.(
            `#${HOST_ID}`
          )
        ) {
          return false;
        }

        return /عنوان السؤال|question title/i.test(
          labelOf(el)
        );
      });
    }

    function editorText(el) {
      return clean(
        el?.innerText ||
        el?.textContent ||
        el?.value ||
        ''
      );
    }

    function matchingTitleEditor(
      number
    ) {
      const question =
        state.questions.find(
          item =>
            item.number === number
        );

      if (!question) {
        return null;
      }

      const candidates =
        liveTitleEditors()
          .map(el => ({
            el,
            score:
              similarity(
                question.title,
                editorText(el)
              )
          }))
          .sort(
            (a, b) =>
              b.score - a.score
          );

      return (
        candidates.find(
          item =>
            item.score >= 0.56
        )?.el ||
        candidates[0]?.el ||
        null
      );
    }

    function editorEvidence(
      number
    ) {
      const titleEditor =
        matchingTitleEditor(
          number
        );

      if (!titleEditor) {
        return null;
      }

      return {
        number,
        titleEditor
      };
    }

    async function activateQuestionEditor(
      number
    ) {
      let evidence =
        editorEvidence(
          number
        );

      if (evidence) {
        return evidence;
      }

      const wrapper =
        wrapperByNumber(
          number
        );

      if (!wrapper) {
        throw new Error(
          `لم أجد السؤال ${number} في الصفحة.`
        );
      }

      try {
        wrapper.scrollIntoView({
          block: 'center',
          behavior: 'auto'
        });
      } catch {}

      try {
        wrapper.focus({
          preventScroll: true
        });
      } catch {}

      wrapper.click();

      evidence =
        await waitForValue(
          () =>
            editorEvidence(
              number
            ),
          9000,
          100
        );

      await sleep(180);

      return evidence;
    }

    function livePointsInput() {
      return (
        [
          ...document.querySelectorAll(
            'input'
          )
        ].find(el =>
          visible(el) &&
          !el.closest?.(
            `#${HOST_ID}`
          ) &&
          /^(النقاط|Points)$/i.test(
            labelOf(el)
          )
        ) ||
        null
      );
    }

    function liveRequiredSwitch() {
      return (
        [
          ...document.querySelectorAll(
            '[role="switch"],[aria-label]'
          )
        ].find(el =>
          visible(el) &&
          !el.closest?.(
            `#${HOST_ID}`
          ) &&
          /^(مطلوب|Required)$/i.test(
            labelOf(el)
          )
        ) ||
        null
      );
    }

    function setNativeInputValue(
      input,
      value
    ) {
      const proto =
        input instanceof
          HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;

      const setter =
        Object.getOwnPropertyDescriptor(
          proto,
          'value'
        )?.set;

      if (setter) {
        setter.call(
          input,
          String(value)
        );
      } else {
        input.value =
          String(value);
      }

      input.dispatchEvent(
        new Event(
          'input',
          { bubbles: true }
        )
      );

      input.dispatchEvent(
        new Event(
          'change',
          { bubbles: true }
        )
      );

      input.blur();
    }

    async function readLiveQuestionFields(
      number,
      patch
    ) {
      await activateQuestionEditor(
        number
      );

      const result = {
        points: null,
        required: null
      };

      if (
        Object.prototype.hasOwnProperty.call(
          patch,
          'points'
        )
      ) {
        const input =
          await waitForValue(
            livePointsInput,
            7000,
            100
          );

        result.points =
          parseNumber(
            input.value,
            0
          );
      }

      if (
        Object.prototype.hasOwnProperty.call(
          patch,
          'required'
        )
      ) {
        const requiredSwitch =
          await waitForValue(
            liveRequiredSwitch,
            7000,
            100
          );

        result.required =
          requiredSwitch.getAttribute(
            'aria-checked'
          ) === 'true';
      }

      return result;
    }

    async function setQuestionFields(
      number,
      patch
    ) {
      await activateQuestionEditor(
        number
      );

      if (
        Object.prototype.hasOwnProperty.call(
          patch,
          'points'
        )
      ) {
        const input =
          await waitForValue(
            livePointsInput,
            7000,
            100
          );

        input.focus();

        setNativeInputValue(
          input,
          patch.points
        );

        await sleep(650);

        const after =
          parseNumber(
            livePointsInput()?.value,
            NaN
          );

        if (
          !Number.isFinite(after) ||
          Math.abs(
            after -
            Number(
              patch.points
            )
          ) >
            0.0001
        ) {
          throw new Error(
            `تعذر ضبط درجة السؤال ${number}.`
          );
        }
      }

      if (
        Object.prototype.hasOwnProperty.call(
          patch,
          'required'
        )
      ) {
        let requiredSwitch =
          await waitForValue(
            liveRequiredSwitch,
            7000,
            100
          );

        const current =
          requiredSwitch.getAttribute(
            'aria-checked'
          ) === 'true';

        if (
          current !==
          Boolean(
            patch.required
          )
        ) {
          requiredSwitch.click();
          await sleep(600);

          requiredSwitch =
            liveRequiredSwitch() ||
            requiredSwitch;
        }

        const after =
          requiredSwitch.getAttribute(
            'aria-checked'
          ) === 'true';

        if (
          after !==
          Boolean(
            patch.required
          )
        ) {
          throw new Error(
            `تعذر ضبط حالة «مطلوب» للسؤال ${number}.`
          );
        }
      }

      await sleep(400);
    }

    function questionClipboardText(
      question
    ) {
      const lines = [
        `${question.number}. ${
          question.title ||
          `السؤال ${question.number}`
        }`
      ];

      if (
        question.options.length
      ) {
        question.options.forEach(
          (option, index) => {
            lines.push(
              `${
                question.correctIndexes.includes(
                  index
                )
                  ? '✓'
                  : '○'
              } ${index + 1}) ${option}`
            );
          }
        );
      }

      if (
        question.correctAnswers.length
      ) {
        lines.push(
          `الإجابة الصحيحة: ${question.correctAnswers.join(' + ')}`
        );
      }

      lines.push(
        `النوع: ${typeLabel(question.type)}`
      );

      lines.push(
        `الدرجة: ${question.points}`
      );

      if (
        question.required != null
      ) {
        lines.push(
          `الحالة: ${
            question.required
              ? 'مطلوب'
              : 'غير مطلوب'
          }`
        );
      }

      return lines.join('\n');
    }

    async function copySelectedQuestions() {
      const targets =
        selectedQuestionObjects();

      if (!targets.length) {
        state.bulkStatus =
          'حدد سؤالًا واحدًا على الأقل للنسخ.';
        renderBulkState();
        return false;
      }

      const text =
        targets
          .map(
            questionClipboardText
          )
          .join(
            '\n\n──────────\n\n'
          );

      try {
        await navigator.clipboard.writeText(
          text
        );
      } catch {
        const textarea =
          document.createElement(
            'textarea'
          );

        textarea.value =
          text;

        textarea.style.position =
          'fixed';

        textarea.style.opacity =
          '0';

        document.body.appendChild(
          textarea
        );

        textarea.select();

        document.execCommand(
          'copy'
        );

        textarea.remove();
      }

      state.bulkStatus =
        `تم نسخ ${targets.length} سؤالًا إلى الحافظة.`;

      renderBulkState();

      return true;
    }

    function nativeActionMeta(el) {
      return clean(
        [
          el?.getAttribute?.(
            'aria-label'
          ),
          el?.getAttribute?.(
            'title'
          ),
          el?.getAttribute?.(
            'data-automation-id'
          ),
          el?.getAttribute?.(
            'data-testid'
          ),
          el?.innerText,
          el?.textContent
        ]
          .filter(Boolean)
          .join(' ')
      );
    }

    function closestEditorDistance(
      button,
      titleEditor
    ) {
      if (
        !button ||
        !titleEditor
      ) {
        return Number.POSITIVE_INFINITY;
      }

      const a =
        button.getBoundingClientRect();

      const b =
        titleEditor.getBoundingClientRect();

      return Math.hypot(
        (a.left + a.right) / 2 -
          (b.left + b.right) / 2,
        (a.top + a.bottom) / 2 -
          (b.top + b.bottom) / 2
      );
    }

    function nativeActionMatcher(
      kind
    ) {
      if (
        kind === 'delete'
      ) {
        return text =>
          /^(?:حذف السؤال|Delete question|Remove question)$/i.test(
            clean(text)
          ) ||
          /(?:questionDelete|deleteQuestion|removeQuestion)/i.test(
            text
          );
      }

      return text =>
        /^(?:تكرار|تكرار السؤال|نسخ السؤال|Duplicate|Duplicate question|Copy question)$/i.test(
          clean(text)
        ) ||
        /(?:questionDuplicate|duplicateQuestion|copyQuestion|questionCopy)/i.test(
          text
        );
    }

    async function prepareNativeAction(
      number,
      kind
    ) {
      const evidence =
        await activateQuestionEditor(
          number
        );

      const matcher =
        nativeActionMatcher(
          kind
        );

      const candidates = [
        ...document.querySelectorAll(
          'button,[role="button"],[role="menuitem"]'
        )
      ]
        .filter(el =>
          visible(el) &&
          !el.closest?.(
            `#${HOST_ID}`
          )
        )
        .map(el => ({
          el,
          meta:
            nativeActionMeta(el),
          distance:
            closestEditorDistance(
              el,
              evidence.titleEditor
            )
        }))
        .filter(item =>
          matcher(
            item.meta
          )
        )
        .sort(
          (a, b) =>
            a.distance -
            b.distance
        );

      if (
        candidates[0]
      ) {
        return candidates[0].el;
      }

      const menu = [
        ...document.querySelectorAll(
          'button,[role="button"]'
        )
      ]
        .filter(el =>
          visible(el) &&
          !el.closest?.(
            `#${HOST_ID}`
          )
        )
        .map(el => ({
          el,
          text:
            nativeActionMeta(el),
          distance:
            closestEditorDistance(
              el,
              evidence.titleEditor
            )
        }))
        .filter(item =>
          /^(?:المزيد|مزيد من الخيارات|خيارات إضافية|More|More options|Other options)$/i.test(
            item.text
          ) ||
          /questionMore|moreQuestion|questionMenu|moreOptions/i.test(
            item.text
          )
        )
        .sort(
          (a, b) =>
            a.distance -
            b.distance
        )[0]?.el;

      if (menu) {
        menu.click();
        await sleep(220);

        const afterMenu = [
          ...document.querySelectorAll(
            'button,[role="button"],[role="menuitem"]'
          )
        ].find(el =>
          visible(el) &&
          !el.closest?.(
            `#${HOST_ID}`
          ) &&
          matcher(
            nativeActionMeta(el)
          )
        );

        if (
          afterMenu
        ) {
          return afterMenu;
        }
      }

      throw new Error(
        `لم أجد زر ${
          kind === 'delete'
            ? 'الحذف'
            : 'التكرار'
        } الأصلي بأمان للسؤال ${number}.`
      );
    }

    async function waitForApiCount(
      expected,
      timeout = 16000
    ) {
      const started =
        Date.now();

      let lastCount =
        null;

      while (
        Date.now() - started <
          timeout
      ) {
        const models =
          await fetchFreshQuestionModels();

        lastCount =
          models.length;

        if (
          lastCount === expected
        ) {
          state.answerModels =
            models;

          state.answerModelsLoaded =
            true;

          return models;
        }

        await sleep(450);
      }

      throw new Error(
        `لم يصل Forms API إلى العدد المتوقع ${expected}. آخر عدد=${lastCount}.`
      );
    }

    function getDeleteConfirmButtons() {
      return [
        ...document.querySelectorAll(
          'button,[role="button"],[role="menuitem"]'
        )
      ].filter(el => {
        if (!visible(el)) {
          return false;
        }

        if (
          el.closest?.(
            `#${HOST_ID}`
          )
        ) {
          return false;
        }

        const text =
          clean(
            el.getAttribute(
              'aria-label'
            ) ||
            el.getAttribute(
              'title'
            ) ||
            el.innerText ||
            el.textContent ||
            ''
          );

        return /^(?:نعم|Yes|موافق|OK|حذف|Delete|تأكيد|Confirm)$/i.test(
          text
        );
      });
    }

    async function confirmNativeDeletePrompt(
      before,
      originalAction
    ) {
      const started =
        Date.now();

      while (
        Date.now() - started <
          3200
      ) {
        const candidates =
          getDeleteConfirmButtons()
            .filter(el =>
              el !== originalAction &&
              !before.has(el)
            );

        const yes =
          candidates.find(el =>
            /^(?:نعم|Yes)$/i.test(
              clean(
                el.getAttribute(
                  'aria-label'
                ) ||
                el.getAttribute(
                  'title'
                ) ||
                el.innerText ||
                el.textContent ||
                ''
              )
            )
          );

        const button =
          yes ||
          candidates[0];

        if (button) {
          await safeClick(
            button
          );

          return true;
        }

        await sleep(90);
      }

      return false;
    }

    function showBulkPreview(
      title,
      rows,
      confirmLabel = 'تنفيذ التغيير'
    ) {
      const host =
        document.getElementById(
          HOST_ID
        );

      if (!host) {
        return Promise.resolve(
          false
        );
      }

      const modal =
        host.querySelector(
          '.mfe-modal'
        );

      modal.querySelector(
        '.mfe-modal-title'
      ).textContent =
        title;

      modal.querySelector(
        '.mfe-modal-summary'
      ).textContent =
        /^⚠\s*حذف/.test(
          title
        )
          ? `سيتم حذف ${rows.length} سؤالًا. هذه هي رسالة التأكيد الوحيدة؛ سيعالج المحسن تأكيدات Forms الفردية تلقائيًا.`
          : `سيتم تطبيق العملية على ${rows.length} سؤالًا محددًا فقط.`;

      const list =
        modal.querySelector(
          '.mfe-modal-list'
        );

      const visibleRows =
        rows.slice(
          0,
          14
        );

      list.innerHTML =
        visibleRows
          .map(row => `
            <div class="mfe-modal-row">
              <b>${row.number}</b>
              <span>${escapeHtml(row.title)}</span>
              <small>${escapeHtml(row.change)}</small>
            </div>
          `)
          .join('') +
        (
          rows.length >
            visibleRows.length
            ? `<div class="mfe-modal-more">+ ${rows.length - visibleRows.length} سؤال إضافي</div>`
            : ''
        );

      const confirmButton =
        modal.querySelector(
          '[data-modal="confirm"]'
        );

      const cancelButton =
        modal.querySelector(
          '[data-modal="cancel"]'
        );

      confirmButton.textContent =
        confirmLabel;

      modal.hidden =
        false;

      return new Promise(
        resolve => {
          const finish =
            value => {
              modal.hidden =
                true;

              confirmButton.onclick =
                null;

              cancelButton.onclick =
                null;

              resolve(value);
            };

          confirmButton.onclick =
            () =>
              finish(true);

          cancelButton.onclick =
            () =>
              finish(false);
        }
      );
    }


    /* ---------------- DIRECT BULK FORMS API — v1.2.0 ----------------
       تم تثبيت هذه العقود من الفحص الجذري الفعلي لـ Forms:
       - Duplicate: POST /questions -> 201
       - Points:    PATCH /questions('<id>') مع questionInfo كسلسلة JSON -> 204
       - Required:  PATCH /questions('<id>') مع required -> 204
       - Delete:    DELETE /questions('<id>') مع {} -> 204
       - Reorder:   PATCH /questions('<id>') مع order + questionInfo -> 204
       --------------------------------------------------------------- */

    function rawQuestionInfoString(
      model
    ) {
      if (
        typeof model?.raw?.questionInfo ===
        'string'
      ) {
        return model.raw.questionInfo;
      }

      if (
        typeof model?.questionInfo ===
        'string'
      ) {
        return model.questionInfo;
      }

      return JSON.stringify(
        model?.questionInfo ||
        {}
      );
    }

    function cloneJsonValue(
      value
    ) {
      if (
        value == null ||
        typeof value !== 'object'
      ) {
        return value;
      }

      try {
        return JSON.parse(
          JSON.stringify(
            value
          )
        );
      } catch {
        return value;
      }
    }

    function modelRequiredValue(
      model
    ) {
      if (
        model?.required === true ||
        model?.raw?.required === true
      ) {
        return true;
      }

      if (
        model?.required === false ||
        model?.raw?.required === false
      ) {
        return false;
      }

      return null;
    }

    function questionsCollectionUrl() {
      const marker =
        '__M0HM3D85_COLLECTION__';

      const probe =
        questionPatchUrl({
          id: marker
        });

      const suffix =
        `/questions('${marker}')`;

      if (
        !probe.endsWith(
          suffix
        )
      ) {
        throw new Error(
          'تعذر اشتقاق مسار مجموعة questions من Forms API.'
        );
      }

      return (
        probe.slice(
          0,
          -suffix.length
        ) +
        '/questions'
      );
    }

    async function ensureFormsWriteSession() {
      if (
        FORM_API_SESSION.ready()
      ) {
        return true;
      }

      const ready =
        await FORM_API_SESSION.waitReady(
          4500
        );

      if (!ready) {
        const missing =
          FORM_API_SESSION
            .missing()
            .join(', ');

        throw new Error(
          `لم تكتمل رؤوس جلسة Forms المطلوبة (${missing}). حدّث الصفحة ثم أعد المحاولة.`
        );
      }

      return true;
    }

    async function directFormsXhr(
      method,
      url,
      body,
      label = 'تحديث Forms'
    ) {
      await ensureFormsWriteSession();

      const headers =
        FORM_API_SESSION
          .writeHeaders();

      const payload =
        body === undefined
          ? null
          : JSON.stringify(
              body
            );

      return new Promise(
        (resolve, reject) => {
          const xhr =
            new XMLHttpRequest();

          xhr.open(
            method,
            url,
            true
          );

          xhr.withCredentials =
            true;

          Object.entries(
            headers
          ).forEach(
            ([name, value]) => {
              try {
                xhr.setRequestHeader(
                  name,
                  String(value)
                );
              } catch (error) {
                console.warn(
                  `[Forms Direct API] تعذر تعيين الرأس ${name}:`,
                  error
                );
              }
            }
          );

          xhr.timeout =
            15000;

          xhr.onload =
            () => {
              if (
                xhr.status >= 200 &&
                xhr.status < 300
              ) {
                let data = null;

                if (
                  xhr.responseText
                ) {
                  try {
                    data =
                      JSON.parse(
                        xhr.responseText
                      );
                  } catch {
                    data =
                      xhr.responseText;
                  }
                }

                resolve({
                  status:
                    xhr.status,
                  data
                });

                return;
              }

              const detail =
                clean(
                  xhr.responseText ||
                  ''
                );

              reject(
                new Error(
                  `${label}: HTTP ${xhr.status}${
                    detail
                      ? ` — ${detail.slice(0, 180)}`
                      : ''
                  }`
                )
              );
            };

          xhr.onerror =
            () =>
              reject(
                new Error(
                  `${label}: تعذر الاتصال بـ Forms.`
                )
              );

          xhr.ontimeout =
            () =>
              reject(
                new Error(
                  `${label}: انتهت مهلة الطلب.`
                )
              );

          xhr.send(
            payload
          );
        }
      );
    }

    function newQuestionId() {
      try {
        if (
          crypto?.randomUUID
        ) {
          return (
            'r' +
            crypto
              .randomUUID()
              .replace(
                /-/g,
                ''
              )
          );
        }
      } catch {}

      const bytes =
        new Uint8Array(
          16
        );

      try {
        crypto.getRandomValues(
          bytes
        );
      } catch {
        for (
          let index = 0;
          index < bytes.length;
          index++
        ) {
          bytes[index] =
            Math.floor(
              Math.random() *
              256
            );
        }
      }

      return (
        'r' +
        [...bytes]
          .map(value =>
            value
              .toString(16)
              .padStart(
                2,
                '0'
              )
          )
          .join('')
      );
    }

    function computeDuplicateOrder(
      models,
      index
    ) {
      const sourceOrder =
        finiteOrder(
          models[index]
        );

      if (
        sourceOrder == null
      ) {
        throw new Error(
          'السؤال المحدد لا يحتوي قيمة order صالحة.'
        );
      }

      const nextOrder =
        index + 1 < models.length
          ? finiteOrder(
              models[
                index + 1
              ]
            )
          : null;

      if (
        nextOrder != null
      ) {
        const order =
          sourceOrder +
          (
            nextOrder -
            sourceOrder
          ) /
          2;

        if (
          !Number.isFinite(order) ||
          !(order > sourceOrder) ||
          !(order < nextOrder)
        ) {
          throw new Error(
            'المسافة الرقمية بعد السؤال ضيقة جدًا لإنشاء نسخة مباشرة آمنة.'
          );
        }

        return order;
      }

      const gap =
        Math.max(
          1,
          medianPositiveGap(
            models
          )
        );

      return (
        sourceOrder +
        gap
      );
    }

    function buildDuplicatePayload(
      model,
      order
    ) {
      const raw =
        model?.raw ||
        {};

      const payload =
        {};

      const copyKeys = [
        'imageDictionary',
        'groupId',
        'defaultValue',
        'image',
        'modifiedDate',
        'subtitle',
        'allowMultipleValues',
        'fileUploadSPOInfo',
        'formsProRTQuestionTitle',
        'formsProRTSubtitle',
        'questionTagForIntelligence',
        'insightsInfo',
        'isFromSuggestion',
        'isQuiz',
        'required',
        'title',
        'type',
        'trackingId'
      ];

      copyKeys.forEach(
        key => {
          if (
            Object.prototype.hasOwnProperty.call(
              raw,
              key
            )
          ) {
            payload[key] =
              cloneJsonValue(
                raw[key]
              );
          }
        }
      );

      payload.questionInfo =
        rawQuestionInfoString(
          model
        );

      payload.id =
        newQuestionId();

      payload.order =
        Number(order);

      if (
        !Object.prototype.hasOwnProperty.call(
          payload,
          'required'
        )
      ) {
        const required =
          modelRequiredValue(
            model
          );

        if (
          required != null
        ) {
          payload.required =
            required;
        }
      }

      if (
        !Object.prototype.hasOwnProperty.call(
          payload,
          'fileUploadSPOInfo'
        ) ||
        payload.fileUploadSPOInfo == null
      ) {
        payload.fileUploadSPOInfo =
          {};
      }

      return payload;
    }

    function buildQuestionPatchPayload(
      model,
      patch
    ) {
      const payload =
        {};

      if (
        Object.prototype.hasOwnProperty.call(
          patch,
          'points'
        )
      ) {
        const info =
          cloneJsonValue(
            model?.questionInfo ||
            safeJsonParse(
              rawQuestionInfoString(
                model
              )
            ) ||
            {}
          ) ||
          {};

        if (
          patch.points == null
        ) {
          delete info.Point;
        } else {
          info.Point =
            Number(
              patch.points
            );
        }

        payload.questionInfo =
          JSON.stringify(
            info
          );
      }

      if (
        Object.prototype.hasOwnProperty.call(
          patch,
          'required'
        )
      ) {
        payload.required =
          Boolean(
            patch.required
          );
      }

      return payload;
    }

    function directPatchMatches(
      model,
      patch
    ) {
      if (!model) {
        return false;
      }

      if (
        Object.prototype.hasOwnProperty.call(
          patch,
          'points'
        )
      ) {
        const actual =
          Number.isFinite(
            Number(
              model
                .questionInfo
                ?.Point
            )
          )
            ? Number(
                model
                  .questionInfo
                  ?.Point
              )
            : null;

        const expected =
          patch.points == null
            ? null
            : Number(
                patch.points
              );

        if (
          actual !== expected
        ) {
          return false;
        }
      }

      if (
        Object.prototype.hasOwnProperty.call(
          patch,
          'required'
        )
      ) {
        if (
          modelRequiredValue(
            model
          ) !==
          Boolean(
            patch.required
          )
        ) {
          return false;
        }
      }

      return true;
    }

    async function waitForQuestionPatches(
      expectedById,
      timeout = 8000
    ) {
      const started =
        Date.now();

      let lastModels =
        [];

      while (
        Date.now() - started <
        timeout
      ) {
        lastModels =
          await fetchFreshQuestionModels();

        const byId =
          new Map(
            lastModels.map(
              model => [
                model.id,
                model
              ]
            )
          );

        const allMatch =
          [...expectedById.entries()]
            .every(
              ([id, patch]) =>
                directPatchMatches(
                  byId.get(id),
                  patch
                )
            );

        if (
          allMatch
        ) {
          state.answerModels =
            lastModels;

          state.answerModelsLoaded =
            true;

          return lastModels;
        }

        await sleep(
          180
        );
      }

      return lastModels;
    }

    function saveDirectBulkUndo(
      items,
      label
    ) {
      state.lastBulkUndo =
        items;

      state.lastBulkLabel =
        label || '';

      try {
        sessionStorage.setItem(
          DIRECT_UNDO_STORAGE_KEY,
          JSON.stringify({
            href:
              location.href,
            label:
              state.lastBulkLabel,
            items:
              state.lastBulkUndo
          })
        );
      } catch {}
    }

    function clearDirectBulkUndo() {
      state.lastBulkUndo =
        [];

      state.lastBulkLabel =
        '';

      try {
        sessionStorage.removeItem(
          DIRECT_UNDO_STORAGE_KEY
        );
      } catch {}
    }

    function makeUndoItem(
      model,
      title,
      patch
    ) {
      const fields =
        [];

      const item = {
        id:
          model.id,
        title:
          title ||
          model.title ||
          '',
        fields
      };

      if (
        Object.prototype.hasOwnProperty.call(
          patch,
          'points'
        )
      ) {
        fields.push(
          'points'
        );

        item.points =
          Number.isFinite(
            Number(
              model
                .questionInfo
                ?.Point
            )
          )
            ? Number(
                model
                  .questionInfo
                  ?.Point
              )
            : null;
      }

      if (
        Object.prototype.hasOwnProperty.call(
          patch,
          'required'
        )
      ) {
        fields.push(
          'required'
        );

        item.required =
          modelRequiredValue(
            model
          );
      }

      return item;
    }

    function undoPatchFromItem(
      model,
      item
    ) {
      const patch =
        {};

      if (
        item.fields?.includes(
          'points'
        )
      ) {
        patch.points =
          item.points == null
            ? null
            : Number(
                item.points
              );
      }

      if (
        item.fields?.includes(
          'required'
        ) &&
        item.required != null
      ) {
        patch.required =
          Boolean(
            item.required
          );
      }

      return patch;
    }

    async function runBulkDuplicate() {
      if (
        state.bulkRunning
      ) {
        return;
      }

      const targets =
        selectedQuestionObjects();

      if (!targets.length) {
        state.bulkStatus =
          'حدد سؤالًا واحدًا على الأقل للتكرار.';

        renderBulkState();
        return;
      }

      let models;
      let jobs;

      try {
        models =
          await fetchFreshQuestionModels();

        if (
          state.questions.length &&
          models.length !==
            state.questions.length
        ) {
          throw new Error(
            `عدد الأسئلة غير متزامن: المحسن=${state.questions.length} / Forms API=${models.length}. اضغط «تحديث الفحص» ثم أعد المحاولة.`
          );
        }

        jobs =
          targets.map(
            question => {
              const model =
                models[
                  question.number - 1
                ];

              if (
                !model?.id
              ) {
                throw new Error(
                  `تعذر تحديد معرف السؤال ${question.number}.`
                );
              }

              const order =
                computeDuplicateOrder(
                  models,
                  question.number - 1
                );

              return {
                number:
                  question.number,
                title:
                  question.title,
                model,
                order,
                payload:
                  buildDuplicatePayload(
                    model,
                    order
                  )
              };
            }
          );
      } catch (error) {
        state.bulkStatus =
          `لم يبدأ التكرار: ${String(error?.message || error)}`;

        renderBulkState();
        return;
      }

      const approved =
        await showBulkPreview(
          'تكرار الأسئلة المحددة — API مباشر سريع',
          jobs.map(job => ({
            number:
              job.number,
            title:
              job.title,
            change:
              'إنشاء نسخة جديدة بعد السؤال مباشرة'
          })),
          `تكرار ${jobs.length} سؤالًا`
        );

      if (!approved) {
        return;
      }

      state.bulkRunning =
        true;

      state.bulkCancelRequested =
        false;

      clearDirectBulkUndo();

      state.bulkStatus =
        `إرسال ${jobs.length} عملية تكرار مباشرة إلى Forms...`;

      renderBulkState();

      const collectionUrl =
        questionsCollectionUrl();

      const results =
        [];

      await runWithConcurrency(
        jobs,
        4,
        async job => {
          if (
            state.bulkCancelRequested
          ) {
            results.push({
              job,
              skipped: true
            });

            return;
          }

          try {
            const response =
              await directFormsXhr(
                'POST',
                collectionUrl,
                job.payload,
                `فشل تكرار السؤال ${job.number}`
              );

            results.push({
              job,
              ok: true,
              response
            });
          } catch (error) {
            results.push({
              job,
              ok: false,
              error
            });
          }
        }
      );

      const success =
        results.filter(
          result =>
            result.ok
        );

      const failed =
        results.filter(
          result =>
            result.ok === false
        );

      const expectedCount =
        models.length +
        success.length;

      try {
        if (
          success.length
        ) {
          await waitForApiCount(
            expectedCount,
            9000
          );
        }
      } catch (error) {
        failed.push({
          ok: false,
          error
        });
      }

      state.bulkRunning =
        false;

      state.bulkCancelRequested =
        false;

      state.selectedQuestions.clear();

      if (
        failed.length ||
        success.length !== jobs.length
      ) {
        const firstError =
          failed[0]?.error;

        state.bulkStatus =
          `اكتمل التكرار جزئيًا: ${success.length} من ${jobs.length}${
            firstError
              ? ` — ${String(firstError.message || firstError)}`
              : ''
          }.`;

        renderBulkState();
        refresh();
        return;
      }

      state.bulkStatus =
        `اكتمل التكرار السريع: ${success.length} سؤالًا. جارٍ تحديث واجهة Forms...`;

      renderBulkState();

      await sleep(
        650
      );

      location.reload();
    }

    async function runBulkDelete() {
      if (
        state.bulkRunning
      ) {
        return;
      }

      const targets =
        selectedQuestionObjects();

      if (!targets.length) {
        state.bulkStatus =
          'حدد سؤالًا واحدًا على الأقل للحذف.';

        renderBulkState();
        return;
      }

      let models;
      let jobs;

      try {
        models =
          await fetchFreshQuestionModels();

        if (
          targets.length >=
          models.length
        ) {
          throw new Error(
            'للحماية: اترك سؤالًا واحدًا على الأقل.'
          );
        }

        jobs =
          targets.map(
            question => {
              const model =
                models[
                  question.number - 1
                ];

              if (
                !model?.id
              ) {
                throw new Error(
                  `تعذر تحديد معرف السؤال ${question.number}.`
                );
              }

              return {
                number:
                  question.number,
                title:
                  question.title,
                model
              };
            }
          );
      } catch (error) {
        state.bulkStatus =
          `لم يبدأ الحذف: ${String(error?.message || error)}`;

        renderBulkState();
        return;
      }

      const approved =
        await showBulkPreview(
          '⚠ حذف الأسئلة المحددة — API مباشر سريع',
          jobs.map(job => ({
            number:
              job.number,
            title:
              job.title,
            change:
              'حذف نهائي مباشر من النموذج'
          })),
          `نعم، حذف ${jobs.length} سؤالًا`
        );

      if (!approved) {
        return;
      }

      state.bulkRunning =
        true;

      state.bulkCancelRequested =
        false;

      clearDirectBulkUndo();

      state.bulkStatus =
        `إرسال ${jobs.length} عملية حذف مباشرة إلى Forms...`;

      renderBulkState();

      const results =
        [];

      await runWithConcurrency(
        jobs,
        4,
        async job => {
          if (
            state.bulkCancelRequested
          ) {
            results.push({
              job,
              skipped: true
            });

            return;
          }

          try {
            await directFormsXhr(
              'DELETE',
              questionPatchUrl(
                job.model
              ),
              {},
              `فشل حذف السؤال ${job.number}`
            );

            results.push({
              job,
              ok: true
            });
          } catch (error) {
            results.push({
              job,
              ok: false,
              error
            });
          }
        }
      );

      const success =
        results.filter(
          result =>
            result.ok
        );

      const failed =
        results.filter(
          result =>
            result.ok === false
        );

      const expectedCount =
        models.length -
        success.length;

      try {
        if (
          success.length
        ) {
          await waitForApiCount(
            expectedCount,
            9000
          );
        }
      } catch (error) {
        failed.push({
          ok: false,
          error
        });
      }

      state.bulkRunning =
        false;

      state.bulkCancelRequested =
        false;

      state.selectedQuestions.clear();

      if (
        failed.length ||
        success.length !== jobs.length
      ) {
        const firstError =
          failed[0]?.error;

        state.bulkStatus =
          `اكتمل الحذف جزئيًا: ${success.length} من ${jobs.length}${
            firstError
              ? ` — ${String(firstError.message || firstError)}`
              : ''
          }.`;

        renderBulkState();
        refresh();
        return;
      }

      state.bulkStatus =
        `اكتمل الحذف السريع: ${success.length} سؤالًا. جارٍ تحديث واجهة Forms...`;

      renderBulkState();

      await sleep(
        650
      );

      location.reload();
    }

    async function runBulkPatch(
      patch,
      label
    ) {
      if (
        state.bulkRunning
      ) {
        return;
      }

      const targets =
        selectedQuestionObjects();

      if (!targets.length) {
        state.bulkStatus =
          'حدد سؤالًا واحدًا على الأقل أولًا.';

        renderBulkState();
        return;
      }

      let models;
      let jobs;

      try {
        models =
          await fetchFreshQuestionModels();

        if (
          state.questions.length &&
          models.length !==
            state.questions.length
        ) {
          throw new Error(
            `عدد الأسئلة غير متزامن: المحسن=${state.questions.length} / Forms API=${models.length}. اضغط «تحديث الفحص» ثم أعد المحاولة.`
          );
        }

        jobs =
          targets.map(
            question => {
              const model =
                models[
                  question.number - 1
                ];

              if (
                !model?.id
              ) {
                throw new Error(
                  `تعذر تحديد معرف السؤال ${question.number}.`
                );
              }

              return {
                number:
                  question.number,
                title:
                  question.title,
                model,
                payload:
                  buildQuestionPatchPayload(
                    model,
                    patch
                  ),
                undo:
                  makeUndoItem(
                    model,
                    question.title,
                    patch
                  )
              };
            }
          );
      } catch (error) {
        state.bulkStatus =
          `لم تبدأ العملية: ${String(error?.message || error)}`;

        renderBulkState();
        return;
      }

      const rows =
        jobs.map(
          job => {
            const changes =
              [];

            if (
              Object.prototype.hasOwnProperty.call(
                patch,
                'points'
              )
            ) {
              const before =
                Number.isFinite(
                  Number(
                    job.model
                      .questionInfo
                      ?.Point
                  )
                )
                  ? Number(
                      job.model
                        .questionInfo
                        ?.Point
                    )
                  : 0;

              changes.push(
                `الدرجة: ${before} ← ${patch.points}`
              );
            }

            if (
              Object.prototype.hasOwnProperty.call(
                patch,
                'required'
              )
            ) {
              const before =
                modelRequiredValue(
                  job.model
                );

              changes.push(
                `الحالة: ${
                  before === true
                    ? 'مطلوب'
                    : before === false
                      ? 'غير مطلوب'
                      : 'غير معروف'
                } ← ${
                  patch.required
                    ? 'مطلوب'
                    : 'غير مطلوب'
                }`
              );
            }

            return {
              number:
                job.number,
              title:
                job.title,
              change:
                changes.join(
                  ' • '
                )
            };
          }
        );

      const approved =
        await showBulkPreview(
          `${label} — API مباشر سريع`,
          rows,
          `تطبيق على ${jobs.length} سؤالًا`
        );

      if (!approved) {
        return;
      }

      state.bulkRunning =
        true;

      state.bulkCancelRequested =
        false;

      state.bulkStatus =
        `إرسال ${jobs.length} تحديث مباشر إلى Forms...`;

      renderBulkState();

      const results =
        [];

      await runWithConcurrency(
        jobs,
        4,
        async job => {
          if (
            state.bulkCancelRequested
          ) {
            results.push({
              job,
              skipped: true
            });

            return;
          }

          try {
            await directFormsXhr(
              'PATCH',
              questionPatchUrl(
                job.model
              ),
              job.payload,
              `فشل تعديل السؤال ${job.number}`
            );

            results.push({
              job,
              ok: true
            });
          } catch (error) {
            results.push({
              job,
              ok: false,
              error
            });
          }
        }
      );

      const success =
        results.filter(
          result =>
            result.ok
        );

      const failed =
        results.filter(
          result =>
            result.ok === false
        );

      const expected =
        new Map();

      success.forEach(
        result =>
          expected.set(
            result.job.model.id,
            patch
          )
      );

      let verified =
        true;

      if (
        expected.size
      ) {
        const finalModels =
          await waitForQuestionPatches(
            expected,
            8500
          );

        const byId =
          new Map(
            finalModels.map(
              model => [
                model.id,
                model
              ]
            )
          );

        verified =
          [...expected.entries()]
            .every(
              ([id, expectedPatch]) =>
                directPatchMatches(
                  byId.get(id),
                  expectedPatch
                )
            );
      }

      const successfulUndo =
        success.map(
          result =>
            result.job.undo
        );

      if (
        successfulUndo.length
      ) {
        saveDirectBulkUndo(
          successfulUndo,
          label
        );
      } else {
        clearDirectBulkUndo();
      }

      state.bulkRunning =
        false;

      state.bulkCancelRequested =
        false;

      state.selectedQuestions.clear();

      if (
        failed.length ||
        success.length !== jobs.length ||
        !verified
      ) {
        const firstError =
          failed[0]?.error;

        state.bulkStatus =
          `اكتملت العملية جزئيًا: ${success.length} من ${jobs.length}${
            !verified
              ? '، وتعذر التحقق النهائي من بعض القيم'
              : ''
          }${
            firstError
              ? ` — ${String(firstError.message || firstError)}`
              : ''
          }.`;

        renderBulkState();
        refresh();
        return;
      }

      state.bulkStatus =
        `اكتملت العملية السريعة: ${success.length} سؤالًا. جارٍ تحديث واجهة Forms...`;

      renderBulkState();

      await sleep(
        650
      );

      location.reload();
    }

    async function runBulkUndo() {
      if (
        state.bulkRunning ||
        !state.lastBulkUndo.length
      ) {
        return;
      }

      const items =
        [...state.lastBulkUndo];

      let models;
      let jobs;

      try {
        models =
          await fetchFreshQuestionModels();

        const byId =
          new Map(
            models.map(
              model => [
                model.id,
                model
              ]
            )
          );

        jobs =
          items
            .map(
              item => {
                const model =
                  byId.get(
                    item.id
                  );

                if (!model) {
                  return null;
                }

                const patch =
                  undoPatchFromItem(
                    model,
                    item
                  );

                return {
                  item,
                  model,
                  patch,
                  payload:
                    buildQuestionPatchPayload(
                      model,
                      patch
                    ),
                  number:
                    modelPosition(
                      models,
                      model.id
                    )
                };
              }
            )
            .filter(Boolean);

        if (!jobs.length) {
          throw new Error(
            'لم أجد الأسئلة الخاصة بآخر عملية داخل النموذج الحالي.'
          );
        }
      } catch (error) {
        state.bulkStatus =
          `تعذر بدء التراجع: ${String(error?.message || error)}`;

        renderBulkState();
        return;
      }

      const approved =
        await showBulkPreview(
          'التراجع السريع عن آخر عملية جماعية',
          jobs.map(job => ({
            number:
              job.number,
            title:
              job.item.title ||
              job.model.title ||
              '',
            change:
              'استرجاع القيم السابقة مباشرة عبر Forms API'
          })),
          `استرجاع ${jobs.length} سؤالًا`
        );

      if (!approved) {
        return;
      }

      state.bulkRunning =
        true;

      state.bulkCancelRequested =
        false;

      state.bulkStatus =
        `استرجاع ${jobs.length} سؤالًا مباشرة...`;

      renderBulkState();

      const results =
        [];

      await runWithConcurrency(
        jobs,
        4,
        async job => {
          if (
            state.bulkCancelRequested
          ) {
            results.push({
              job,
              skipped: true
            });

            return;
          }

          try {
            await directFormsXhr(
              'PATCH',
              questionPatchUrl(
                job.model
              ),
              job.payload,
              `فشل استرجاع السؤال ${job.number}`
            );

            results.push({
              job,
              ok: true
            });
          } catch (error) {
            results.push({
              job,
              ok: false,
              error
            });
          }
        }
      );

      const success =
        results.filter(
          result =>
            result.ok
        );

      const failed =
        results.filter(
          result =>
            result.ok === false
        );

      const expected =
        new Map();

      success.forEach(
        result =>
          expected.set(
            result.job.model.id,
            result.job.patch
          )
      );

      let verified =
        true;

      if (
        expected.size
      ) {
        const finalModels =
          await waitForQuestionPatches(
            expected,
            8500
          );

        const byId =
          new Map(
            finalModels.map(
              model => [
                model.id,
                model
              ]
            )
          );

        verified =
          [...expected.entries()]
            .every(
              ([id, expectedPatch]) =>
                directPatchMatches(
                  byId.get(id),
                  expectedPatch
                )
            );
      }

      state.bulkRunning =
        false;

      state.bulkCancelRequested =
        false;

      if (
        failed.length ||
        success.length !== jobs.length ||
        !verified
      ) {
        const failedIds =
          new Set(
            failed
              .map(
                result =>
                  result.job?.item?.id
              )
              .filter(Boolean)
          );

        const remaining =
          items.filter(
            item =>
              failedIds.has(
                item.id
              )
          );

        saveDirectBulkUndo(
          remaining,
          state.lastBulkLabel
        );

        state.bulkStatus =
          `اكتمل التراجع جزئيًا: ${success.length} من ${jobs.length}${
            !verified
              ? '، وتعذر التحقق النهائي'
              : ''
          }.`;

        renderBulkState();
        return;
      }

      clearDirectBulkUndo();

      state.bulkStatus =
        `اكتمل التراجع السريع: ${success.length} سؤالًا. جارٍ تحديث واجهة Forms...`;

      renderBulkState();

      await sleep(
        650
      );

      location.reload();
    }

    function modelPosition(
      models,
      id
    ) {
      const index =
        models.findIndex(
          model =>
            model.id === id
        );

      return index >= 0
        ? index + 1
        : -1;
    }

    function selectedReorderIdentities(
      models,
      selectedNumbers
    ) {
      return selectedNumbers.map(
        number => {
          const model =
            models[number - 1];

          if (!model) {
            throw new Error(
              `لا يوجد سؤال في الموضع ${number} داخل Forms API.`
            );
          }

          if (!model.id) {
            throw new Error(
              `السؤال ${number} لا يحتوي معرفًا ثابتًا؛ أوقفت إعادة الترتيب للحماية.`
            );
          }

          return {
            id:
              model.id,
            title:
              model.title ||
              `السؤال ${number}`,
            originalPosition:
              number
          };
        }
      );
    }

    function buildReorderPlan(
      models,
      identities,
      targetStart
    ) {
      const selectedIds =
        new Set(
          identities.map(
            item =>
              item.id
          )
        );

      if (
        models.some(
          model =>
            !model.id
        )
      ) {
        throw new Error(
          'بعض الأسئلة لا تملك معرفًا ثابتًا في Forms API؛ أوقفت إعادة الترتيب.'
        );
      }

      const remaining =
        models
          .map(
            model =>
              model.id
          )
          .filter(id =>
            !selectedIds.has(
              id
            )
          );

      const start =
        Math.max(
          1,
          Math.min(
            Number(
              targetStart
            ),
            remaining.length + 1
          )
        );

      const desired = [
        ...remaining.slice(
          0,
          start - 1
        ),
        ...identities.map(
          item =>
            item.id
        ),
        ...remaining.slice(
          start - 1
        )
      ];

      const desiredPosition =
        new Map();

      desired.forEach(
        (id, index) =>
          desiredPosition.set(
            id,
            index + 1
          )
      );

      const moves =
        identities.map(
          item => ({
            ...item,
            targetPosition:
              desiredPosition.get(
                item.id
              )
          })
        );

      return {
        start,
        desired,
        moves
      };
    }

    function questionPatchUrl(
      model
    ) {
      const endpoint =
        state.answerModelUrl ||
        findDefinitionEndpoint();

      if (!endpoint) {
        throw new Error(
          'لم أجد رابط تعريف أسئلة Microsoft Forms.'
        );
      }

      if (!model?.id) {
        throw new Error(
          'لا يوجد معرف ثابت للسؤال المطلوب نقله.'
        );
      }

      /*
       * التصحيح في v1.1.3:
       *
       * رابط القراءة الذي نلتقطه من Resource Timing قد يكون مثل:
       *   .../forms('FORM_ID')?$expand=questions($expand=choices)
       *
       * أي أن كلمة questions موجودة في query وليست في pathname.
       * بينما رابط PATCH الحقيقي الذي يستخدمه Forms هو:
       *   .../forms('FORM_ID')/questions('QUESTION_ID')
       *
       * لذلك نستخرج كيان forms('...') نفسه ثم نضيف مسار السؤال.
       */
      let parsed;

      try {
        parsed =
          new URL(
            endpoint,
            location.href
          );
      } catch {
        throw new Error(
          'رابط تعريف Forms غير صالح.'
        );
      }

      let decodedPath;

      try {
        decodedPath =
          decodeURIComponent(
            parsed.pathname
          );
      } catch {
        decodedPath =
          parsed.pathname;
      }

      const formsStart =
        decodedPath
          .toLowerCase()
          .lastIndexOf(
            '/forms('
          );

      if (formsStart < 0) {
        throw new Error(
          'تعذر تحديد كيان forms داخل Forms API.'
        );
      }

      const formsEnd =
        decodedPath.indexOf(
          ')',
          formsStart
        );

      if (formsEnd < 0) {
        throw new Error(
          'تعذر إكمال قراءة معرف النموذج من Forms API.'
        );
      }

      let formEntityPath =
        decodedPath.slice(
          0,
          formsEnd + 1
        );

      /*
       * مهم جدًا:
       * رابط القراءة الذي يلتقطه المحسن يأتي أحيانًا من مسار /light/.
       * هذا المسار يقبل القراءة، لكنه لا يقبل PATCH لإعادة الترتيب
       * ويعيد HTTP 405.
       *
       * طلب Forms الأصلي عند إعادة الترتيب يدويًا يستخدم نفس المسار
       * بدون /light/:
       *   .../users/{userId}/forms('...')/questions('...')
       */
      formEntityPath =
        formEntityPath.replace(
          /\/light(?=\/forms\()/i,
          ''
        );

      const safeQuestionId =
        String(model.id)
          .replace(
            /'/g,
            "''"
          );

      const url =
        `${parsed.origin}${formEntityPath}` +
        `/questions('${safeQuestionId}')`;

      return url;
    }

    function finiteOrder(
      model
    ) {
      const value =
        Number(
          model?.order
        );

      return Number.isFinite(
        value
      )
        ? value
        : null;
    }

    function medianPositiveGap(
      models
    ) {
      const orders =
        models
          .map(
            finiteOrder
          )
          .filter(
            Number.isFinite
          )
          .sort(
            (a, b) =>
              a - b
          );

      const gaps = [];

      for (
        let index = 1;
        index < orders.length;
        index++
      ) {
        const gap =
          orders[index] -
          orders[index - 1];

        if (
          Number.isFinite(gap) &&
          gap > 0
        ) {
          gaps.push(gap);
        }
      }

      if (!gaps.length) {
        return 1024;
      }

      gaps.sort(
        (a, b) =>
          a - b
      );

      return gaps[
        Math.floor(
          gaps.length / 2
        )
      ];
    }

    function computeDirectOrders(
      models,
      plan
    ) {
      const byId =
        new Map(
          models.map(
            model => [
              model.id,
              model
            ]
          )
        );

      const movedIds =
        new Set(
          plan.moves.map(
            item =>
              item.id
          )
        );

      const count =
        plan.moves.length;

      const startIndex =
        plan.start - 1;

      const leftId =
        startIndex > 0
          ? plan.desired[
              startIndex - 1
            ]
          : null;

      const rightId =
        startIndex + count <
          plan.desired.length
          ? plan.desired[
              startIndex + count
            ]
          : null;

      const leftOrder =
        leftId
          ? finiteOrder(
              byId.get(
                leftId
              )
            )
          : null;

      const rightOrder =
        rightId
          ? finiteOrder(
              byId.get(
                rightId
              )
            )
          : null;

      const normalGap =
        Math.max(
          1,
          medianPositiveGap(
            models
          )
        );

      const assignments =
        new Map();

      if (
        leftOrder != null &&
        rightOrder != null
      ) {
        const gap =
          rightOrder -
          leftOrder;

        if (
          !Number.isFinite(gap) ||
          gap <= 0
        ) {
          throw new Error(
            'ترتيب Forms الحالي غير صالح للحساب المباشر.'
          );
        }

        const step =
          gap /
          (count + 1);

        if (
          !Number.isFinite(step) ||
          step <=
            Number.EPSILON *
              Math.max(
                Math.abs(leftOrder),
                Math.abs(rightOrder),
                1
              ) *
              32
        ) {
          throw new Error(
            'المسافة الرقمية بين الأسئلة ضيقة جدًا لإعادة ترتيب مباشرة آمنة.'
          );
        }

        plan.moves.forEach(
          (item, index) => {
            assignments.set(
              item.id,
              leftOrder +
                step *
                (index + 1)
            );
          }
        );
      } else if (
        rightOrder != null
      ) {
        const step =
          Math.max(
            1,
            Math.min(
              normalGap,
              Math.max(
                Math.abs(
                  rightOrder
                ) /
                  Math.max(
                    count + 2,
                    2
                  ),
                1
              )
            )
          );

        plan.moves.forEach(
          (item, index) => {
            assignments.set(
              item.id,
              rightOrder -
                step *
                (count - index)
            );
          }
        );
      } else if (
        leftOrder != null
      ) {
        const step =
          Math.max(
            1,
            normalGap
          );

        plan.moves.forEach(
          (item, index) => {
            assignments.set(
              item.id,
              leftOrder +
                step *
                (index + 1)
            );
          }
        );
      } else {
        const step =
          Math.max(
            1,
            normalGap
          );

        plan.moves.forEach(
          (item, index) => {
            assignments.set(
              item.id,
              step *
                (index + 1)
            );
          }
        );
      }

      /*
       * حماية إضافية:
       * لا نسمح بقيمة غير رقمية أو بتصادم مباشر بين سؤالين منقولين.
       */
      const values =
        [...assignments.values()];

      if (
        values.some(
          value =>
            !Number.isFinite(
              value
            )
        ) ||
        new Set(
          values.map(
            value =>
              value.toPrecision(15)
          )
        ).size !==
          values.length
      ) {
        throw new Error(
          'تعذر توليد قيم ترتيب فريدة وآمنة.'
        );
      }

      return assignments;
    }

    async function patchQuestionOrderDirect(
      model,
      order
    ) {
      const url =
        questionPatchUrl(
          model
        );

      if (
        !FORM_API_SESSION.ready()
      ) {
        const ready =
          await FORM_API_SESSION.waitReady(
            4000
          );

        if (!ready) {
          const missing =
            FORM_API_SESSION
              .missing()
              .join(', ');

          throw new Error(
            `لم تكتمل رؤوس جلسة Forms المطلوبة (${missing}). حدّث الصفحة ثم أعد المحاولة.`
          );
        }
      }

      /*
       * Forms نفسه يستخدم XMLHttpRequest لعملية إعادة الترتيب الناجحة.
       * لذلك نستخدم XHR هنا بدل fetch، ونرسل نفس مجموعة الرؤوس التي
       * التقطناها من الطلب الأصلي.
       */
      let rawQuestionInfo = '';

      if (
        typeof model.raw?.questionInfo ===
        'string'
      ) {
        rawQuestionInfo =
          model.raw.questionInfo;
      } else if (
        typeof model.questionInfo ===
        'string'
      ) {
        rawQuestionInfo =
          model.questionInfo;
      } else {
        rawQuestionInfo =
          JSON.stringify(
            model.questionInfo ||
            {}
          );
      }

      const headers =
        FORM_API_SESSION
          .writeHeaders();

      const payload =
        JSON.stringify({
          order:
            Number(order),
          questionInfo:
            rawQuestionInfo
        });

      console.debug(
        '[Forms Reorder] direct XHR PATCH',
        {
          questionId:
            model.id,
          order:
            Number(order),
          capturedHeaderNames:
            FORM_API_SESSION
              .status()
              .captured
        }
      );

      return new Promise(
        (resolve, reject) => {
          const xhr =
            new XMLHttpRequest();

          xhr.open(
            'PATCH',
            url,
            true
          );

          xhr.withCredentials =
            true;

          Object.entries(
            headers
          ).forEach(
            ([name, value]) => {
              try {
                xhr.setRequestHeader(
                  name,
                  String(value)
                );
              } catch (error) {
                console.warn(
                  `[Forms Reorder] تعذر تعيين الرأس ${name}:`,
                  error
                );
              }
            }
          );

          xhr.timeout =
            12000;

          xhr.onload =
            () => {
              if (
                xhr.status === 204 ||
                (
                  xhr.status >= 200 &&
                  xhr.status < 300
                )
              ) {
                resolve(true);
                return;
              }

              const detail =
                clean(
                  xhr.responseText ||
                  ''
                );

              reject(
                new Error(
                  `رفض Forms تحديث ترتيب السؤال «${model.title || model.id}»: HTTP ${xhr.status}${
                    detail
                      ? ` — ${detail.slice(0, 180)}`
                      : ''
                  }`
                )
              );
            };

          xhr.onerror =
            () => {
              reject(
                new Error(
                  `تعذر الاتصال بـ Forms أثناء تحديث ترتيب السؤال «${model.title || model.id}».`
                )
              );
            };

          xhr.ontimeout =
            () => {
              reject(
                new Error(
                  `انتهت مهلة تحديث ترتيب السؤال «${model.title || model.id}».`
                )
              );
            };

          xhr.send(
            payload
          );
        }
      );
    }

    async function runWithConcurrency(
      items,
      limit,
      worker
    ) {
      const queue =
        [...items];

      const runners =
        Array.from(
          {
            length:
              Math.min(
                Math.max(
                  1,
                  limit
                ),
                queue.length
              )
          },
          async () => {
            while (
              queue.length
            ) {
              const item =
                queue.shift();

              await worker(
                item
              );
            }
          }
        );

      await Promise.all(
        runners
      );
    }

    function sameIdOrder(
      models,
      desired
    ) {
      if (
        models.length !==
        desired.length
      ) {
        return false;
      }

      for (
        let index = 0;
        index < desired.length;
        index++
      ) {
        if (
          models[index]?.id !==
          desired[index]
        ) {
          return false;
        }
      }

      return true;
    }

    async function waitForDirectReorder(
      desired,
      timeout = 6000
    ) {
      const started =
        Date.now();

      let lastModels =
        [];

      while (
        Date.now() - started <
          timeout
      ) {
        lastModels =
          await fetchFreshQuestionModels();

        if (
          sameIdOrder(
            lastModels,
            desired
          )
        ) {
          state.answerModels =
            lastModels;

          state.answerModelsLoaded =
            true;

          return lastModels;
        }

        await sleep(
          160
        );
      }

      return lastModels;
    }

    async function runBulkReorder(
      targetStart
    ) {
      if (
        state.bulkRunning
      ) {
        return;
      }

      const selected =
        selectedQuestionObjects();

      if (!selected.length) {
        state.bulkStatus =
          'حدد سؤالًا واحدًا على الأقل لإعادة الترتيب.';

        renderBulkState();
        return;
      }

      let models;
      let identities;
      let plan;
      let assignments;

      try {
        models =
          await fetchFreshQuestionModels();

        if (
          state.questions.length &&
          models.length !==
            state.questions.length
        ) {
          throw new Error(
            `عدد الأسئلة غير متزامن: المحسن=${state.questions.length} / Forms API=${models.length}. اضغط «تحديث الفحص» ثم أعد المحاولة.`
          );
        }

        if (
          models.some(
            model =>
              finiteOrder(
                model
              ) == null
          )
        ) {
          throw new Error(
            'Forms API لم يعرض قيمة order لجميع الأسئلة؛ لم أنفذ النقل للحماية.'
          );
        }

        identities =
          selectedReorderIdentities(
            models,
            selected.map(
              question =>
                question.number
            )
          );

        plan =
          buildReorderPlan(
            models,
            identities,
            targetStart
          );

        assignments =
          computeDirectOrders(
            models,
            plan
          );
      } catch (error) {
        state.bulkStatus =
          `لم يبدأ النقل: ${String(error?.message || error)}`;

        renderBulkState();
        return;
      }

      const rows =
        plan.moves.map(
          item => ({
            number:
              item.originalPosition,
            title:
              item.title,
            change:
              `من الموضع ${item.originalPosition} إلى ${item.targetPosition}`
          })
        );

      const approved =
        await showBulkPreview(
          'إعادة ترتيب الأسئلة المحددة — نقل مباشر سريع',
          rows,
          `نقل ${rows.length} سؤالًا`
        );

      if (!approved) {
        return;
      }

      state.bulkRunning =
        true;

      state.bulkCancelRequested =
        false;

      clearDirectBulkUndo();

      state.bulkStatus =
        `إرسال ${plan.moves.length} تحديث ترتيب مباشر إلى Forms...`;

      renderBulkState();

      let reorderSucceeded =
        false;

      try {
        /*
         * لا نغير أي إعداد في السؤال لتهيئة الجلسة.
         * رؤوس RequestVerificationToken و UserSessionId يتم التقاطها من
         * حركة Forms العادية، وهما الشرطان الفعليان اللذان نحتاجهما.
         */
        if (
          !FORM_API_SESSION.ready()
        ) {
          const ready =
            await FORM_API_SESSION.waitReady(
              4000
            );

          if (!ready) {
            const missing =
              FORM_API_SESSION
                .missing()
                .join(', ');

            throw new Error(
              `لم تكتمل رؤوس جلسة Forms المطلوبة (${missing}).`
            );
          }
        }

        const byId =
          new Map(
            models.map(
              model => [
                model.id,
                model
              ]
            )
          );

        /*
         * لا نضغط أزرار التحريك مطلقًا.
         * كل سؤال محدد يحتاج PATCH واحد فقط، بغض النظر عن المسافة.
         * حد التوازي 4 للحفاظ على السرعة بدون إغراق Forms.
         */
        await runWithConcurrency(
          plan.moves,
          4,
          async item => {
            if (
              state.bulkCancelRequested
            ) {
              throw new Error(
                'تم إيقاف إعادة الترتيب بطلب المستخدم.'
              );
            }

            const model =
              byId.get(
                item.id
              );

            const order =
              assignments.get(
                item.id
              );

            await patchQuestionOrderDirect(
              model,
              order
            );
          }
        );

        state.bulkStatus =
          'تم إرسال الترتيب الجديد؛ جارٍ تحقق واحد نهائي من Forms...';

        renderBulkState();

        const finalModels =
          await waitForDirectReorder(
            plan.desired,
            6000
          );

        if (
          !sameIdOrder(
            finalModels,
            plan.desired
          )
        ) {
          throw new Error(
            'استقبل Forms طلبات PATCH ولكن لم يظهر الترتيب النهائي المتوقع خلال مهلة التحقق.'
          );
        }

        state.answerModels =
          finalModels;

        state.answerModelsLoaded =
          true;

        reorderSucceeded =
          true;

        state.bulkStatus =
          `اكتملت إعادة الترتيب السريعة: ${plan.moves.length} سؤالًا. موضع البداية الجديد ${plan.start}. جارٍ تحديث واجهة Forms لإظهار الترتيب الجديد...`;
      } catch (error) {
        console.error(
          'Forms direct reorder:',
          error
        );

        state.bulkStatus =
          `أوقفت إعادة الترتيب للحماية: ${String(error?.message || error)}`;
      } finally {
        state.bulkRunning =
          false;

        state.bulkCancelRequested =
          false;

        state.selectedQuestions.clear();

        if (
          reorderSucceeded
        ) {
          /*
           * Forms يحفظ ترتيب API فورًا لكنه لا يعيد ترتيب بطاقات المحرر
           * الحالية في DOM. لذلك لا نعتمد على refresh() الداخلي لأنه
           * سيقرأ نفس DOM القديم. بعد تحقق API الناجح نعمل Reload واحدًا
           * للصفحة نفسها حتى تعرض واجهة Forms الترتيب الجديد الحقيقي.
           */
          renderBulkState();

          await sleep(
            650
          );

          location.reload();
          return;
        }

        try {
          await loadAnswerModels(
            true
          );
        } catch {}

        refresh();
        renderBulkState();
      }
    }

    async function runBulkReorderBottom() {
      const selected =
        selectedQuestionObjects();

      if (!selected.length) {
        state.bulkStatus =
          'حدد سؤالًا واحدًا على الأقل لإعادة الترتيب.';

        renderBulkState();
        return;
      }

      try {
        const models =
          await fetchFreshQuestionModels();

        const target =
          models.length -
          selected.length +
          1;

        await runBulkReorder(
          target
        );
      } catch (error) {
        state.bulkStatus =
          `تعذر تحديد نهاية النموذج: ${String(error?.message || error)}`;

        renderBulkState();
      }
    }

    function stats() {
      return {
        total:
          state.questions.length,
        points:
          state.questions.reduce(
            (sum, question) =>
              sum +
              Number(
                question.points || 0
              ),
            0
          ),
        required:
          state.questions.filter(
            question =>
              question.required === true
          ).length,
        issues:
          state.questions.filter(
            question =>
              issueCount(question) > 0
          ).length
      };
    }

    function renderApiStatus() {
      const host =
        document.getElementById(
          HOST_ID
        );

      if (!host) return;

      const el =
        host.querySelector(
          '.mfe-api-status'
        );

      if (!el) return;

      el.className =
        'mfe-api-status';

      if (
        state.answerApiStatus ===
        'loading'
      ) {
        el.classList.add(
          'loading'
        );

        el.textContent =
          'جارٍ قراءة تعريف Forms ومفاتيح الإجابات...';
      } else if (
        state.answerApiStatus ===
        'ready'
      ) {
        el.classList.add(
          'ready'
        );

        const answerCount =
          state.questions.filter(
            question =>
              question.answerSource ===
                'forms-api' &&
              question.correctIndexes.length
          ).length;

        el.textContent =
          `✓ تم ربط تعريف Forms — ${state.answerModels.length} سؤالًا في API، ومفتاح الإجابة متاح لـ ${answerCount} سؤالًا.`;
      } else if (
        state.answerApiStatus ===
        'error'
      ) {
        el.classList.add(
          'error'
        );

        el.textContent =
          `تعذر قراءة تعريف Forms: ${state.answerApiError}`;
      } else if (
        state.answerApiStatus ===
        'empty'
      ) {
        el.classList.add(
          'warn'
        );

        el.textContent =
          'تمت قراءة Forms لكن لم تُكتشف أسئلة قابلة للربط.';
      } else {
        el.textContent =
          'سيحاول المحسن قراءة الإجابات والترتيب من تعريف Forms تلقائيًا.';
      }
    }

    function renderBulkState() {
      const host =
        document.getElementById(
          HOST_ID
        );

      if (!host) return;

      const selected =
        selectedQuestionObjects();

      host.querySelector(
        '.mfe-selected-count'
      ).textContent =
        `${selected.length} محدد`;

      const status =
        host.querySelector(
          '.mfe-bulk-status'
        );

      status.textContent =
        state.bulkStatus;

      status.classList.toggle(
        'running',
        state.bulkRunning
      );

      const undo =
        host.querySelector(
          '[data-action="bulk-undo"]'
        );

      if (undo) {
        undo.disabled =
          state.bulkRunning ||
          !state.lastBulkUndo.length;
      }

      const stop =
        host.querySelector(
          '[data-action="bulk-stop"]'
        );

      if (stop) {
        stop.hidden =
          !state.bulkRunning;
      }

      host
        .querySelectorAll(
          '.mfe-bulk-actions button:not([data-action="bulk-stop"]),.mfe-bulk-actions input'
        )
        .forEach(el => {
          if (
            el.dataset?.action ===
            'bulk-undo'
          ) {
            return;
          }

          el.disabled =
            state.bulkRunning;
        });
    }

    function renderStats() {
      const host =
        document.getElementById(
          HOST_ID
        );

      if (!host) return;

      const summary =
        stats();

      host.querySelector(
        '.mfe-stats'
      ).innerHTML = `
        <span><b>${summary.total}</b> سؤال</span>
        <span><b>${summary.points}</b> درجة</span>
        <span><b>${summary.required}</b> مطلوب</span>
        <span class="issue"><b>${summary.issues}</b> يحتاج مراجعة</span>
      `;
    }

    function renderResults() {
      const host =
        document.getElementById(
          HOST_ID
        );

      if (!host) return;

      const results =
        filteredQuestions();

      host.querySelector(
        '.mfe-result-count'
      ).textContent =
        `${results.length} نتيجة`;

      const box =
        host.querySelector(
          '.mfe-results'
        );

      if (!results.length) {
        box.innerHTML =
          '<div class="mfe-empty">لا توجد أسئلة مطابقة.</div>';

        renderBulkState();
        return;
      }

      box.innerHTML =
        results.map(question => {
          const selected =
            state.selectedQuestions.has(
              question.number
            );

          const issueSummary =
            question.issues.length
              ? question.issues
                  .slice(0, 2)
                  .map(
                    issue =>
                      issue.text
                  )
                  .join(' • ')
              : 'لا توجد ملاحظات';

          const correct =
            question.correctAnswers.length
              ? `<small class="mfe-correct">✓ الصحيح: ${escapeHtml(question.correctAnswers.join(' + '))}</small>`
              : '';

          return `
            <div
              class="mfe-result${selected ? ' selected' : ''}"
              data-question="${question.number}"
            >
              <label class="mfe-select-cell">
                <input
                  type="checkbox"
                  class="mfe-select-question"
                  data-question="${question.number}"
                  ${selected ? 'checked' : ''}
                >
              </label>

              <span class="mfe-number">${question.number}</span>

              <span class="mfe-result-title">
                <strong>${escapeHtml(question.title || `السؤال ${question.number}`)}</strong>
                ${correct}
                <small>${escapeHtml(issueSummary)}</small>
              </span>

              <span class="mfe-badges">
                <span class="mfe-badge">${escapeHtml(typeLabel(question.type))}</span>
                <span class="mfe-badge">${question.points} درجة</span>
                ${
                  issueCount(question)
                    ? `<span class="mfe-badge error">${issueCount(question)} مشكلة</span>`
                    : ''
                }
              </span>
            </div>
          `;
        }).join('');

      box
        .querySelectorAll(
          '.mfe-select-question'
        )
        .forEach(input => {
          input.addEventListener(
            'change',
            event => {
              event.stopPropagation();

              const number =
                Number(
                  input.dataset.question
                );

              if (
                input.checked
              ) {
                state.selectedQuestions.add(
                  number
                );
              } else {
                state.selectedQuestions.delete(
                  number
                );
              }

              renderResults();
              renderBulkState();
            }
          );
        });

      box
        .querySelectorAll(
          '.mfe-result'
        )
        .forEach(row => {
          row.addEventListener(
            'click',
            event => {
              if (
                event.target.closest(
                  '.mfe-select-cell'
                )
              ) {
                return;
              }

              const number =
                Number(
                  row.dataset.question
                );

              const wrapper =
                wrapperByNumber(
                  number
                );

              wrapper?.scrollIntoView({
                block: 'center',
                behavior: 'smooth'
              });
            }
          );
        });

      renderBulkState();
    }

    function render() {
      renderStats();
      renderApiStatus();
      renderResults();
      renderBulkState();
    }

    function selectByRule(rule) {
      let questions = [];

      switch (rule) {
        case 'visible':
          questions =
            filteredQuestions();
          break;

        case 'all':
          questions =
            state.questions;
          break;

        case 'issues':
          questions =
            state.questions.filter(
              question =>
                issueCount(question) > 0
            );
          break;

        case 'zero-points':
          questions =
            state.questions.filter(
              question =>
                Number(
                  question.points || 0
                ) === 0
            );
          break;

        case 'missing-correct':
          questions =
            state.questions.filter(
              question =>
                question.correctKnown &&
                [
                  'choice',
                  'multiple',
                  'truefalse'
                ].includes(
                  question.type
                ) &&
                question.correctIndexes.length === 0
            );
          break;

        case 'optional':
          questions =
            state.questions.filter(
              question =>
                question.required === false
            );
          break;

        case 'duplicate-title': {
          const duplicates =
            duplicateTitleNumbers();

          questions =
            state.questions.filter(
              question =>
                duplicates.has(
                  question.number
                )
            );
          break;
        }

        case 'duplicate-option':
          questions =
            state.questions.filter(
              question =>
                question.issues.some(
                  issue =>
                    issue.code ===
                    'duplicate-option'
                )
            );
          break;

        default:
          questions = [];
          break;
      }

      questions.forEach(
        question =>
          state.selectedQuestions.add(
            question.number
          )
      );

      state.bulkStatus =
        questions.length
          ? `تم تحديد ${questions.length} سؤالًا.`
          : 'لا توجد أسئلة مطابقة.';

      renderResults();

      return questions.map(
        question =>
          question.number
      );
    }

    function makeHost() {
      const host =
        document.createElement(
          'section'
        );

      host.id = HOST_ID;
      host.dir = 'rtl';
      host.className =
        'mfe-collapsed';

      host.innerHTML = `
        <div class="mfe-head">
          <div class="mfe-brand">
            <span class="mfe-logo">F</span>
            <div>
              <strong>أدوات محرر Microsoft Forms</strong>
              <span>بحث · تدقيق · نقاط · مطلوب · تكرار · حذف · إعادة ترتيب — API مباشر سريع</span>
            </div>
          </div>

          <div class="mfe-head-actions">
            <button class="mfe-outline" data-action="question-bank">بنك الأسئلة</button>
            <button data-action="refresh">تحديث الفحص</button>
            <button class="mfe-collapse" data-action="collapse">⌄</button>
          </div>
        </div>

        <div class="mfe-body">
          <div class="mfe-stats"></div>

          <div class="mfe-controls">
            <input
              class="mfe-search"
              type="search"
              placeholder="ابحث في العنوان أو الخيارات أو الإجابة الصحيحة..."
            >

            <select class="mfe-type">
              <option value="all">جميع الأنواع</option>
              <option value="choice">اختيار</option>
              <option value="multiple">متعدد</option>
              <option value="truefalse">صح/خطأ</option>
              <option value="text">نصي</option>
            </select>

            <select class="mfe-required-filter">
              <option value="all">كل الحالات</option>
              <option value="required">مطلوب</option>
              <option value="optional">غير مطلوب</option>
              <option value="unknown">غير معروف</option>
            </select>

            <select class="mfe-audit-filter">
              <option value="all">كل نتائج التدقيق</option>
              <option value="issues">يحتاج مراجعة</option>
              <option value="clean">بدون مشاكل</option>
              <option value="zero-points">الدرجة صفر</option>
              <option value="missing-correct">بدون إجابة صحيحة</option>
              <option value="correct-known">له إجابة صحيحة</option>
              <option value="duplicate-title">عنوان مكرر</option>
              <option value="duplicate-option">خيار مكرر</option>
            </select>

            <div class="mfe-points-filter">
              <select class="mfe-points-op">
                <option value="any">أي درجة</option>
                <option value="=">=</option>
                <option value="!=">≠</option>
                <option value=">">&gt;</option>
                <option value=">=">≥</option>
                <option value="<">&lt;</option>
                <option value="<=">≤</option>
              </select>

              <input
                class="mfe-points-filter-value"
                type="number"
                value="0"
                step="0.5"
              >
            </div>
          </div>

          <div class="mfe-api-status"></div>

          <div class="mfe-bulk">
            <div class="mfe-bulk-head">
              <div>
                <strong>التعديل الجماعي الآمن</strong>
                <span class="mfe-selected-count">0 محدد</span>
              </div>

              <div class="mfe-bulk-select-actions">
                <select class="mfe-smart-select">
                  <option value="">تحديد ذكي...</option>
                  <option value="visible">النتائج الظاهرة</option>
                  <option value="all">جميع الأسئلة</option>
                  <option value="issues">تحتاج مراجعة</option>
                  <option value="zero-points">الدرجة صفر</option>
                  <option value="missing-correct">بدون إجابة صحيحة</option>
                  <option value="optional">غير مطلوب</option>
                  <option value="duplicate-title">عنوان مكرر</option>
                  <option value="duplicate-option">خيار مكرر</option>
                </select>

                <button class="mfe-outline" data-action="select-visible">تحديد الظاهر</button>
                <button class="mfe-outline" data-action="invert-selection">عكس التحديد</button>
                <button class="mfe-outline" data-action="clear-selection">إلغاء التحديد</button>
              </div>
            </div>

            <div class="mfe-bulk-actions">
              <label class="mfe-field">
                <span>الدرجة</span>
                <input
                  class="mfe-bulk-points"
                  type="number"
                  min="0"
                  step="0.5"
                  value="1"
                >
              </label>

              <button data-action="bulk-points">تعيين الدرجة</button>
              <button data-action="bulk-required-on">جعلها مطلوبة</button>
              <button class="mfe-outline" data-action="bulk-required-off">جعلها غير مطلوبة</button>

              <span class="mfe-separator"></span>

              <button class="mfe-outline" data-action="bulk-copy">نسخ المحدد</button>
              <button class="mfe-outline" data-action="bulk-duplicate">تكرار المحدد</button>
              <button class="mfe-danger" data-action="bulk-delete">حذف المحدد</button>

              <span class="mfe-separator"></span>

              <label
                class="mfe-field"
                title="موضع أول سؤال من المجموعة المحددة"
              >
                <span>الموضع</span>
                <input
                  class="mfe-reorder-position"
                  type="number"
                  min="1"
                  step="1"
                  value="1"
                >
              </label>

              <button class="mfe-outline" data-action="reorder-top">↑ إلى البداية</button>
              <button class="mfe-outline" data-action="reorder-position">نقل إلى الموضع</button>
              <button class="mfe-outline" data-action="reorder-bottom">↓ إلى النهاية</button>

              <span class="mfe-separator"></span>

              <button class="mfe-outline" data-action="bulk-undo" disabled>↶ تراجع آخر عملية</button>
              <button class="mfe-stop" data-action="bulk-stop" hidden>إيقاف</button>
            </div>

            <div class="mfe-bulk-status">
              حدد الأسئلة التي تريد تعديلها، ثم اختر العملية.
            </div>
          </div>

          <div class="mfe-results-head">
            <strong class="mfe-result-count">0 نتيجة</strong>
            <span>يمكن تحديد سؤال واحد أو عدة أسئلة</span>
          </div>

          <div class="mfe-results"></div>

          <div class="mfe-footer">
            <span>© 2026 Mohammed Almalki (M0HM3D85) — جميع الحقوق محفوظة</span>
            <span>v${VERSION}</span>
          </div>
        </div>

        <div class="mfe-modal" hidden>
          <div class="mfe-modal-card" role="dialog" aria-modal="true">
            <strong class="mfe-modal-title">مراجعة التغييرات</strong>
            <p class="mfe-modal-summary"></p>
            <div class="mfe-modal-list"></div>

            <div class="mfe-modal-actions">
              <button data-modal="confirm">تنفيذ</button>
              <button class="mfe-outline" data-modal="cancel">إلغاء</button>
            </div>
          </div>
        </div>
      `;

      return host;
    }

    function injectStyles() {
      if (
        document.getElementById(
          STYLE_ID
        )
      ) {
        return;
      }

      const style =
        document.createElement(
          'style'
        );

      style.id =
        STYLE_ID;

      style.textContent = `
#${HOST_ID}{--p:#007874;--s:#00A39E;--b:#E5E7EB;--t:#1F2937;--m:#6B7280;width:min(1180px,calc(100% - 32px));margin:14px auto 18px;border:1px solid var(--b);border-radius:12px;background:#fff;color:var(--t);font-family:"Segoe UI",Tahoma,Arial,sans-serif;box-shadow:0 1px 2px rgba(0,0,0,.04);overflow:hidden;direction:rtl;position:relative;z-index:2}
#${HOST_ID},#${HOST_ID} *{box-sizing:border-box}
#${HOST_ID} button,#${HOST_ID} input,#${HOST_ID} select{font:inherit}
#${HOST_ID} button{border:1px solid transparent;border-radius:8px;padding:7px 10px;background:var(--p);color:#fff;cursor:pointer}
#${HOST_ID} button:disabled{opacity:.45;cursor:not-allowed}
#${HOST_ID} .mfe-outline,#${HOST_ID} .mfe-collapse{background:#fff;border-color:var(--p);color:var(--p)}
#${HOST_ID} .mfe-danger,#${HOST_ID} .mfe-stop{background:#B42318;color:#fff}
#${HOST_ID} .mfe-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;min-height:58px;border-bottom:1px solid var(--b)}
#${HOST_ID}.mfe-collapsed .mfe-body{display:none}
#${HOST_ID}.mfe-collapsed .mfe-head{border-bottom:0}
#${HOST_ID} .mfe-brand{display:flex;align-items:center;gap:10px}
#${HOST_ID} .mfe-logo{width:34px;height:34px;display:grid;place-items:center;border-radius:9px;background:linear-gradient(135deg,var(--p),var(--s));color:#fff;font-weight:800}
#${HOST_ID} .mfe-brand strong{display:block;font-size:14px}
#${HOST_ID} .mfe-brand span:not(.mfe-logo){display:block;color:var(--m);font-size:10px;margin-top:2px}
#${HOST_ID} .mfe-head-actions{display:flex;gap:7px;align-items:center;flex-wrap:wrap}
#${HOST_ID} .mfe-collapse{width:34px;height:34px;padding:0}
#${HOST_ID} .mfe-body{padding:12px 14px 9px}
#${HOST_ID} .mfe-stats{display:flex;gap:14px;flex-wrap:wrap;color:var(--m);font-size:11px;margin-bottom:9px}
#${HOST_ID} .mfe-stats b{font-size:14px;color:var(--t)}
#${HOST_ID} .mfe-stats .issue b{color:#B42318}
#${HOST_ID} .mfe-controls{display:flex;flex-wrap:wrap;gap:7px;align-items:center;width:100%;min-width:0}
#${HOST_ID} .mfe-controls>input{flex:1 1 280px;min-width:220px}
#${HOST_ID} input,#${HOST_ID} select{height:36px;border:1px solid #D1D5DB;border-radius:8px;background:#fff;color:var(--t);padding:0 8px;min-width:0}
#${HOST_ID} .mfe-points-filter{display:flex;gap:5px;flex:0 1 155px}
#${HOST_ID} .mfe-points-filter input{width:70px}
#${HOST_ID} .mfe-api-status{margin-top:8px;padding:7px 9px;border:1px solid var(--b);border-radius:8px;background:#FAFBFB;color:var(--m);font-size:10.5px}
#${HOST_ID} .mfe-api-status.ready{background:#ECFDF3;border-color:#ABEFC6;color:#067647}
#${HOST_ID} .mfe-api-status.error{background:#FEF3F2;border-color:#FECDCA;color:#B42318}
#${HOST_ID} .mfe-bulk{margin-top:9px;padding:10px;border:1px solid #CFE8E6;border-radius:10px;background:#F8FCFC}
#${HOST_ID} .mfe-bulk-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;flex-wrap:wrap}
#${HOST_ID} .mfe-bulk-head>div{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
#${HOST_ID} .mfe-selected-count{padding:2px 8px;border-radius:999px;background:#E8F7F5;color:var(--p);font-size:10px;font-weight:700}
#${HOST_ID} .mfe-bulk-select-actions,#${HOST_ID} .mfe-bulk-actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap;max-width:100%;min-width:0}
#${HOST_ID} .mfe-bulk-actions button,#${HOST_ID} .mfe-bulk-select-actions button{font-size:10.5px;padding:6px 9px}
#${HOST_ID} .mfe-field{height:34px;display:inline-flex;align-items:center;gap:5px;padding:0 7px;border:1px solid #D1D5DB;border-radius:8px;background:#fff;font-size:10px}
#${HOST_ID} .mfe-field input{width:58px;height:30px;border:0;padding:0;background:transparent}
#${HOST_ID} .mfe-separator{width:1px;height:25px;background:#D7E4E3;margin:0 2px}
#${HOST_ID} .mfe-bulk-status{margin-top:8px;color:var(--m);font-size:10.5px}
#${HOST_ID} .mfe-bulk-status.running{color:var(--p);font-weight:700}
#${HOST_ID} .mfe-results-head{display:flex;justify-content:space-between;color:var(--m);font-size:10.5px;padding:10px 2px 6px}
#${HOST_ID} .mfe-results{max-height:330px;overflow:auto;border:1px solid var(--b);border-radius:9px}
#${HOST_ID} .mfe-result{display:grid;grid-template-columns:26px 40px minmax(0,1fr) auto;gap:8px;align-items:center;padding:8px 10px;border-bottom:1px solid #F0F1F2;background:#fff;cursor:pointer}
#${HOST_ID} .mfe-result.selected{background:#F2FBFA;box-shadow:inset -3px 0 0 var(--p)}
#${HOST_ID} .mfe-number{width:32px;height:32px;display:grid;place-items:center;border-radius:8px;background:#F2FBFA;color:var(--p);font-weight:800}
#${HOST_ID} .mfe-result-title{min-width:0}
#${HOST_ID} .mfe-result-title strong{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:11.5px}
#${HOST_ID} .mfe-result-title small{display:block;margin-top:3px;color:var(--m);font-size:9.5px}
#${HOST_ID} .mfe-result-title .mfe-correct{color:#067647;font-weight:700}
#${HOST_ID} .mfe-badges{display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end}
#${HOST_ID} .mfe-badge{padding:3px 6px;border-radius:999px;background:#F3F4F6;color:#4B5563;font-size:9px}
#${HOST_ID} .mfe-badge.error{background:#FEF3F2;color:#B42318}
#${HOST_ID} .mfe-empty{padding:28px;text-align:center;color:var(--m);font-size:11px}
#${HOST_ID} .mfe-footer{display:flex;justify-content:space-between;color:#8A8F98;font-size:9px;padding-top:8px}
#${HOST_ID} .mfe-modal[hidden]{display:none!important}
#${HOST_ID} .mfe-modal{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;background:rgba(17,24,39,.38);padding:18px}
#${HOST_ID} .mfe-modal-card{width:min(620px,calc(100vw - 32px));max-height:calc(100vh - 40px);overflow:auto;background:#fff;border-radius:12px;padding:16px;box-shadow:0 18px 48px rgba(0,0,0,.22)}
#${HOST_ID} .mfe-modal-summary{color:var(--m);font-size:11px}
#${HOST_ID} .mfe-modal-list{border:1px solid var(--b);border-radius:9px;overflow:hidden}
#${HOST_ID} .mfe-modal-row{display:grid;grid-template-columns:34px minmax(0,1fr);gap:2px 8px;padding:8px 10px;border-bottom:1px solid #F0F1F2}
#${HOST_ID} .mfe-modal-row b{grid-row:1/span 2;color:var(--p)}
#${HOST_ID} .mfe-modal-row span{font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#${HOST_ID} .mfe-modal-row small{font-size:10px;color:var(--p)}
#${HOST_ID} .mfe-modal-more{padding:8px;text-align:center;color:var(--m);font-size:10px}
#${HOST_ID} .mfe-modal-actions{display:flex;justify-content:flex-end;gap:7px;margin-top:12px}
@media(max-width:700px){
  #${HOST_ID}{width:calc(100% - 16px);margin-inline:8px}
  #${HOST_ID} .mfe-result{grid-template-columns:26px 36px minmax(0,1fr)}
  #${HOST_ID} .mfe-badges{grid-column:3;justify-content:flex-start}
  #${HOST_ID} .mfe-controls>input{flex-basis:100%;min-width:100%}
  #${HOST_ID} .mfe-bulk-actions>*{max-width:100%}
}
      `;

      document.head.appendChild(
        style
      );
    }

    function bindEvents(host) {
      const search =
        host.querySelector(
          '.mfe-search'
        );

      const type =
        host.querySelector(
          '.mfe-type'
        );

      const requiredFilter =
        host.querySelector(
          '.mfe-required-filter'
        );

      const auditFilter =
        host.querySelector(
          '.mfe-audit-filter'
        );

      const pointsOp =
        host.querySelector(
          '.mfe-points-op'
        );

      const pointsValue =
        host.querySelector(
          '.mfe-points-filter-value'
        );

      const bulkPoints =
        host.querySelector(
          '.mfe-bulk-points'
        );

      const reorderPosition =
        host.querySelector(
          '.mfe-reorder-position'
        );

      const smartSelect =
        host.querySelector(
          '.mfe-smart-select'
        );

      host.querySelector(
        '[data-action="refresh"]'
      ).onclick =
        async () => {
          refresh();

          try {
            await loadAnswerModels(
              true
            );
          } catch {}

          refresh();
        };

      host.querySelector(
        '[data-action="collapse"]'
      ).onclick =
        event => {
          state.panelCollapsed =
            !state.panelCollapsed;

          host.classList.toggle(
            'mfe-collapsed',
            state.panelCollapsed
          );

          event.currentTarget.textContent =
            state.panelCollapsed
              ? '⌄'
              : '⌃';
        };

      host.querySelector(
        '[data-action="question-bank"]'
      ).onclick =
        () => {
          if (
            window.FormsBulkImporter?.open
          ) {
            window.FormsBulkImporter.open();
          } else {
            alert(
              'ثبّت سكربت «بنك الأسئلة والإدخال الجماعي» لفتح البنك من هنا.'
            );
          }
        };

      search.addEventListener(
        'input',
        debounce(
          () => {
            state.query =
              search.value;

            renderResults();
          },
          120
        )
      );

      type.onchange =
        () => {
          state.selectedType =
            type.value;

          renderResults();
        };

      requiredFilter.onchange =
        () => {
          state.requiredFilter =
            requiredFilter.value;

          renderResults();
        };

      auditFilter.onchange =
        () => {
          state.auditFilter =
            auditFilter.value;

          renderResults();
        };

      pointsOp.onchange =
        () => {
          state.pointsOperator =
            pointsOp.value;

          state.pointsValue =
            Number(
              pointsValue.value ||
              0
            );

          renderResults();
        };

      pointsValue.addEventListener(
        'input',
        debounce(
          () => {
            state.pointsValue =
              Number(
                pointsValue.value ||
                0
              );

            renderResults();
          },
          120
        )
      );

      smartSelect.onchange =
        () => {
          if (
            smartSelect.value
          ) {
            selectByRule(
              smartSelect.value
            );
          }

          smartSelect.value =
            '';
        };

      host.querySelector(
        '[data-action="select-visible"]'
      ).onclick =
        () =>
          selectByRule(
            'visible'
          );

      host.querySelector(
        '[data-action="invert-selection"]'
      ).onclick =
        () => {
          filteredQuestions().forEach(
            question => {
              if (
                state.selectedQuestions.has(
                  question.number
                )
              ) {
                state.selectedQuestions.delete(
                  question.number
                );
              } else {
                state.selectedQuestions.add(
                  question.number
                );
              }
            }
          );

          renderResults();
        };

      host.querySelector(
        '[data-action="clear-selection"]'
      ).onclick =
        () => {
          state.selectedQuestions.clear();
          renderResults();
        };

      host.querySelector(
        '[data-action="bulk-points"]'
      ).onclick =
        () => {
          const value =
            Number(
              bulkPoints.value
            );

          if (
            !Number.isFinite(value) ||
            value < 0
          ) {
            state.bulkStatus =
              'أدخل درجة صحيحة.';

            renderBulkState();
            return;
          }

          runBulkPatch(
            { points: value },
            `تعيين الدرجة إلى ${value}`
          );
        };

      host.querySelector(
        '[data-action="bulk-required-on"]'
      ).onclick =
        () =>
          runBulkPatch(
            { required: true },
            'جعل الأسئلة المحددة مطلوبة'
          );

      host.querySelector(
        '[data-action="bulk-required-off"]'
      ).onclick =
        () =>
          runBulkPatch(
            { required: false },
            'جعل الأسئلة المحددة غير مطلوبة'
          );

      host.querySelector(
        '[data-action="bulk-copy"]'
      ).onclick =
        copySelectedQuestions;

      host.querySelector(
        '[data-action="bulk-duplicate"]'
      ).onclick =
        runBulkDuplicate;

      host.querySelector(
        '[data-action="bulk-delete"]'
      ).onclick =
        runBulkDelete;

      host.querySelector(
        '[data-action="bulk-undo"]'
      ).onclick =
        runBulkUndo;

      host.querySelector(
        '[data-action="reorder-top"]'
      ).onclick =
        () =>
          runBulkReorder(
            1
          );

      host.querySelector(
        '[data-action="reorder-position"]'
      ).onclick =
        () => {
          const value =
            Number(
              reorderPosition.value
            );

          if (
            !Number.isInteger(value) ||
            value < 1
          ) {
            state.bulkStatus =
              'أدخل رقم موضع صحيح يبدأ من 1.';

            renderBulkState();
            return;
          }

          runBulkReorder(
            value
          );
        };

      host.querySelector(
        '[data-action="reorder-bottom"]'
      ).onclick =
        runBulkReorderBottom;

      host.querySelector(
        '[data-action="bulk-stop"]'
      ).onclick =
        () => {
          state.bulkCancelRequested =
            true;

          state.bulkStatus =
            'سيتم الإيقاف بعد انتهاء الخطوة الحالية...';

          renderBulkState();
        };
    }

    function mount() {
      injectStyles();

      const host =
        makeHost();

      const titleContainer =
        document.querySelector(
          '[data-automation-id="formTitleContainer"]'
        ) ||
        document.querySelector(
          '#form-title-container'
        );

      if (
        titleContainer?.parentElement
      ) {
        titleContainer.parentElement.insertBefore(
          host,
          titleContainer
        );
      } else {
        const root =
          getFormRoot();

        root.insertBefore(
          host,
          root.firstChild
        );
      }

      bindEvents(
        host
      );

      return host;
    }

    function startObserver() {
      const target =
        getFormRoot();

      const run =
        debounce(
          () => {
            if (
              !document.getElementById(
                HOST_ID
              ) ||
              state.bulkRunning
            ) {
              return;
            }

            refresh();
          },
          1200
        );

      state.observer =
        new MutationObserver(
          mutations => {
            const meaningful =
              mutations.some(
                mutation => {
                  const element =
                    mutation.target instanceof Element
                      ? mutation.target
                      : mutation.target.parentElement;

                  return !element?.closest?.(
                    `#${HOST_ID}`
                  );
                }
              );

            if (meaningful) {
              run();
            }
          }
        );

      state.observer.observe(
        target,
        {
          childList: true,
          subtree: true
        }
      );
    }

    function destroy() {
      state.bulkCancelRequested =
        true;

      state.observer?.disconnect?.();
      state.observer =
        null;

      document.getElementById(
        HOST_ID
      )?.remove();

      document.getElementById(
        STYLE_ID
      )?.remove();

      delete window
        .MAD_FORMS_EDITOR_ENHANCER;
    }

    mount();
    refresh();
    startObserver();

    setTimeout(
      () =>
        loadAnswerModels(
          false
        ),
      700
    );

    window.MAD_FORMS_EDITOR_ENHANCER = {
      version:
        VERSION,
      state,
      refresh,
      questions:
        () =>
          state.questions,
      selected:
        () =>
          selectedQuestionObjects()
            .map(
              question =>
                question.number
            ),
      selectVisible:
        () =>
          selectByRule(
            'visible'
          ),
      selectByRule,
      filtered:
        () =>
          filteredQuestions()
            .map(
              question =>
                question.number
            ),
      clearSelection:
        () => {
          state.selectedQuestions.clear();
          renderResults();
        },
      bulkPoints:
        value =>
          runBulkPatch(
            {
              points:
                Number(value)
            },
            `تعيين الدرجة إلى ${value}`
          ),
      bulkRequired:
        value =>
          runBulkPatch(
            {
              required:
                Boolean(value)
            },
            value
              ? 'جعل الأسئلة المحددة مطلوبة'
              : 'جعل الأسئلة المحددة غير مطلوبة'
          ),
      copySelected:
        copySelectedQuestions,
      duplicateSelected:
        runBulkDuplicate,
      deleteSelected:
        runBulkDelete,
      moveSelectedTo:
        target =>
          runBulkReorder(
            Number(target)
          ),
      moveSelectedTop:
        () =>
          runBulkReorder(
            1
          ),
      moveSelectedBottom:
        runBulkReorderBottom,
      stop:
        () => {
          state.bulkCancelRequested =
            true;
        },
      undoBulk:
        runBulkUndo,
      reloadAnswers:
        () =>
          loadAnswerModels(
            true
          ),
      answerModels:
        () =>
          state.answerModels,
      apiCount:
        async () =>
          (
            await fetchFreshQuestionModels()
          ).length,
      writeSessionStatus:
        () =>
          FORM_API_SESSION.status(),
      destroy
    };

    console.log(
      `%cMicrosoft Forms Smart Enhancer v${VERSION}`,
      'font-size:18px;font-weight:800;color:#007874'
    );

    console.log(
      '✅ المحسن جاهز: النقاط ومطلوب والتكرار والحذف وإعادة الترتيب تعمل مباشرة عبر Forms API + تحديث واحد للواجهة.'
    );
  }

  /* ============================== BOOT ============================== */

  if (
    PORTAL.workerBoot()
  ) {
    return;
  }

  let editorStarted =
    false;

  let portalWasActive =
    false;

  const routeBoot =
    () => {
      const portalActive =
        PORTAL.isPortal();

      if (
        portalActive &&
        !portalWasActive
      ) {
        PORTAL.enterPortalFresh();
      } else if (
        portalActive
      ) {
        PORTAL.mount({
          freshEntry: false,
          autoIndex: false
        });
      }

      portalWasActive =
        portalActive;

      if (
        !editorStarted &&
        document.querySelector(
          '[data-automation-id="questionWrapper"],[data-automation-id="questionDesignerCard"]'
        )
      ) {
        editorStarted =
          true;

        try {
          startEditorEnhancer();
        } catch (error) {
          editorStarted =
            false;

          console.error(
            'Forms editor enhancer:',
            error
          );
        }
      }

      SETTINGS.mount();
    };

  routeBoot();

  const bootObserver =
    new MutationObserver(
      routeBoot
    );

  bootObserver.observe(
    document.documentElement,
    {
      childList: true,
      subtree: true
    }
  );

  setTimeout(
    () => {
      try {
        bootObserver.disconnect();
      } catch {}
    },
    30000
  );
})();

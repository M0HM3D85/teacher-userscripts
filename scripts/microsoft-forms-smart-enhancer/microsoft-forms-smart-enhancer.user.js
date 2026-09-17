// ==UserScript==
// @name         Microsoft Forms Smart Enhancer - محسن Microsoft Forms الذكي
// @namespace    https://greasyfork.org/users/1636459
// @version      1.0.5
// @description  محسن شامل لـ Microsoft Forms: فهرسة تلقائية مخفية وصارمة، بحث مباشر للنموذج، قوالب إعدادات، تدقيق وإدارة جماعية للأسئلة.
// @author       Mohammed Almalki (M0HM3D85)
// @homepageURL  https://greasyfork.org/en/users/1636459-m0hm3d85
// @supportURL   https://github.com/M0HM3D85/teacher-userscripts/issues
// @copyright    2026, Mohammed Almalki (M0HM3D85)
// @license      All Rights Reserved
// @match        https://forms.cloud.microsoft/Pages/DesignPageV2.aspx*
// @match        https://forms.office.com/Pages/DesignPageV2.aspx*
// @run-at       document-idle
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
  const FINAL_VERSION='1.0.5';

  const PORTAL = (() => {
    const HOST_ID = 'm0hm3d85-forms-productivity';
    const STYLE_ID = `${HOST_ID}-style`;
    const WORKER_NAME = 'MAD_FORMS_PRODUCTIVITY_WORKER_STRICT_V105';
    const NS = 'M0HM3D85_FORMS_STRICT_INDEX_V105';
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
      autoIndexStarted: false
    };

    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const clean = value => String(value ?? '').replace(/[\u200e\u200f\u202a-\u202e]/g,'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
    const western = value => String(value ?? '').replace(/[٠-٩]/g,c=>'٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/[۰-۹]/g,c=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(c));
    const canon = value => clean(value).toLowerCase().replace(/[ًٌٍَُِّْـ]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
    const html = value => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
    const visible = el => !!(el instanceof Element && el.isConnected && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden' && el.getBoundingClientRect().width && el.getBoundingClientRect().height);

    function isPortal() {
      const u = new URL(location.href);
      if (u.searchParams.has('collectionid') || u.searchParams.has('id')) return false;
      return !!document.querySelector('#scroll-dnd, #portal-tab-0, [data-automation-id="newFormButton"]');
    }

    function isTemplateDiscoveryHeading(el) {
      const text =
        clean(
          el?.textContent ||
          el?.innerText ||
          ''
        );

      return /^(?:استكشاف القوالب|Explore templates)$/i.test(text);
    }

    function restoreLegacyTemplateHides() {
      /*
       * v1.0.4 كان قد يخفي حاوية أكبر من اللازم.
       * إذا جرى تحديث السكربت داخل نفس جلسة Forms بدون إعادة تحميل،
       * نعيد أولًا أي عنصر أخفته النسخة السابقة ثم نطبق الإخفاء الآمن.
       */
      document
        .querySelectorAll(
          '[data-m0hm3d85-template-discovery-hidden]'
        )
        .forEach(el => {
          el.removeAttribute(
            'data-m0hm3d85-template-discovery-hidden'
          );

          el.style.removeProperty(
            'display'
          );
        });
    }

    function isFormsContentContainer(el) {
      if (!el) return false;

      return Boolean(
        el.matches?.(
          '#scroll-dnd,[role="tablist"]'
        ) ||
        el.querySelector?.(
          '[id^="form-item-"],[id^="collection-item-"],[data-automation-id="itemContainer"],[data-automation-id="newFormButton"],[role="tablist"]'
        )
      );
    }

    function templateCardLabel(textValue = '') {
      const text =
        clean(textValue);

      const labels = [
        /^(?:اختبار|Quiz)$/i,
        /^(?:التسجيل|Registration)$/i,
        /^(?:ملاحظات|Feedback)$/i,
        /^(?:الأبحاث|Research)$/i,
        /^(?:معرض القوالب|Template gallery|Template Gallery)$/i
      ];

      return labels.some(re =>
        re.test(text)
      );
    }

    function templateLabelCount(textValue = '') {
      const text =
        clean(textValue);

      const tokens = [
        /اختبار|Quiz/i,
        /التسجيل|Registration/i,
        /ملاحظات|Feedback/i,
        /الأبحاث|Research/i,
        /معرض القوالب|Template gallery/i
      ];

      return tokens.reduce(
        (count, re) =>
          count + (re.test(text) ? 1 : 0),
        0
      );
    }

    function templateCardRoot(labelEl) {
      if (!labelEl) return null;

      let node =
        labelEl;

      let best =
        labelEl;

      for (
        let depth = 0;
        node &&
        node !== document.body &&
        node !== document.documentElement &&
        depth < 6;
        depth++, node = node.parentElement
      ) {
        if (
          isFormsContentContainer(node)
        ) {
          break;
        }

        const rect =
          node.getBoundingClientRect?.();

        const text =
          clean(
            node.innerText ||
            node.textContent ||
            ''
          );

        const labels =
          templateLabelCount(text);

        /*
         * نريد بطاقة واحدة فقط، لا صف القوالب ولا حاوية الصفحة.
         * إذا بدأ العنصر يحتوي أكثر من اسم قالب نتوقف عند الابن السابق.
         */
        if (labels > 1) {
          break;
        }

        if (
          rect &&
          rect.width >= 120 &&
          rect.width <= 520 &&
          rect.height >= 45 &&
          rect.height <= 320
        ) {
          best =
            node;
        }
      }

      return best;
    }

    function hideTemplateDiscovery() {
      restoreLegacyTemplateHides();

      const headings = [
        ...document.querySelectorAll(
          'h1,h2,h3,h4,h5,h6,[role="heading"],div,span'
        )
      ].filter(isTemplateDiscoveryHeading);

      let hidden = 0;

      /*
       * الإخفاء الآمن:
       * لا نخفي أي ancestor للقسم، ولا section/region عامة.
       * نخفي العنوان نفسه ثم كل بطاقة قالب على حدة فقط.
       */
      for (const heading of headings) {
        heading.setAttribute(
          'data-m0hm3d85-template-discovery-hidden',
          'true'
        );

        heading.style.setProperty(
          'display',
          'none',
          'important'
        );

        hidden++;
      }

      const labelElements = [
        ...document.querySelectorAll(
          'a,button,[role="button"],[role="link"],span,div'
        )
      ].filter(el => {
        if (
          el.closest?.(`#${HOST_ID}`)
        ) {
          return false;
        }

        if (
          isFormsContentContainer(el)
        ) {
          return false;
        }

        const ownText =
          clean(
            el.childElementCount
              ? (
                  [...el.childNodes]
                    .filter(node =>
                      node.nodeType === Node.TEXT_NODE
                    )
                    .map(node =>
                      node.textContent
                    )
                    .join(' ')
                )
              : (
                  el.innerText ||
                  el.textContent ||
                  ''
                )
          );

        const fallbackText =
          clean(
            el.innerText ||
            el.textContent ||
            ''
          );

        return (
          templateCardLabel(ownText) ||
          (
            el.childElementCount <= 2 &&
            templateCardLabel(fallbackText)
          )
        );
      });

      const cardRoots =
        new Set();

      for (const labelEl of labelElements) {
        const card =
          templateCardRoot(labelEl);

        if (
          !card ||
          card === document.body ||
          card === document.documentElement ||
          isFormsContentContainer(card)
        ) {
          continue;
        }

        cardRoots.add(card);
      }

      for (const card of cardRoots) {
        card.setAttribute(
          'data-m0hm3d85-template-discovery-hidden',
          'true'
        );

        card.style.setProperty(
          'display',
          'none',
          'important'
        );

        hidden++;
      }

      /*
       * نحاول إزالة فراغ صف القوالب فقط إذا أصبح فارغًا بالكامل،
       * بشرط صارم ألا يحتوي أي بطاقة نموذج أو مجموعة Forms.
       */
      const parents =
        new Set(
          [...cardRoots]
            .map(card =>
              card.parentElement
            )
            .filter(Boolean)
        );

      for (const parent of parents) {
        if (
          isFormsContentContainer(parent)
        ) {
          continue;
        }

        const visibleChildren = [
          ...parent.children
        ].filter(child =>
          getComputedStyle(child).display !== 'none'
        );

        const hiddenTemplateChildren = [
          ...parent.children
        ].filter(child =>
          child.hasAttribute(
            'data-m0hm3d85-template-discovery-hidden'
          )
        );

        if (
          hiddenTemplateChildren.length >= 3 &&
          visibleChildren.length === 0
        ) {
          parent.setAttribute(
            'data-m0hm3d85-template-discovery-hidden',
            'true'
          );

          parent.style.setProperty(
            'display',
            'none',
            'important'
          );
        }
      }

      return hidden;
    }

    function purgeLegacyIndex() {
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

    function responseCount(text) {
      const s = western(clean(text));
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
      const s = western(clean(text));
      const m = s.match(/(?:لديها|لديه)\s*(\d+)\s*من\s*النماذج/i) || s.match(/(\d+)\s*من\s*العناصر/i);
      return m ? Number(m[1]) : null;
    }

    function directFormUrl(formKey) {
      const u = new URL('/Pages/DesignPageV2.aspx', location.origin);
      u.searchParams.set('origin','shell');
      u.searchParams.set('subpage','design');
      u.searchParams.set('id', formKey);
      return u.href;
    }

    function collectionUrl(collectionId) {
      const u = new URL('/Pages/DesignPageV2.aspx', location.origin);
      u.searchParams.set('origin','shell');
      u.searchParams.set('collectionid',collectionId);
      return u.href;
    }

    function formTitle(card) {
      const explicit = card.querySelector('[data-automation-id="detailTitle"]');
      if (explicit) return clean(explicit.textContent || explicit.getAttribute('title'));
      const labelled = [...card.querySelectorAll('[aria-label],[title]')].map(el=>clean(el.getAttribute('aria-label')||el.getAttribute('title'))).find(t=>t && !/استجابة|ردود|المزيد|خيارات/i.test(t));
      if (labelled) return labelled;
      return clean(card.innerText).split('\n').map(clean).find(Boolean) || 'نموذج بدون عنوان';
    }

    function parseFormCard(card, folder = null) {
      const id = clean(card.id);
      if (!id.startsWith('form-item-')) return null;
      const formKey = id.slice('form-item-'.length);
      if (!formKey) return null;
      const title = formTitle(card);
      const responses = responseCount(`${card.innerText || ''} ${card.getAttribute('aria-label') || ''}`);
      let nativeHref = '';
      const a = [...card.querySelectorAll('a[href]')].find(x => /DesignPageV2\.aspx/i.test(x.href) && /[?&]id=/i.test(x.href));
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
      return [...document.querySelectorAll('[id^="collection-item-"]')].map(card => {
        const id = card.id.slice('collection-item-'.length);
        if (!id) return null;
        const titleEl = card.querySelector('[data-automation-id="detailTitle"]');
        let name = clean(titleEl?.textContent || titleEl?.getAttribute('title') || '');
        if (!name) {
          name = clean(card.innerText).split('\n').map(clean).find(x => x && !/\d+\s*من\s*(?:النماذج|العناصر)/i.test(western(x))) || `مجموعة ${id}`;
        }
        return { id, name, declaredCount: declaredCollectionCount(card.innerText || ''), url: collectionUrl(id) };
      }).filter(Boolean);
    }

    function parseForms(folder = null) {
      return [...document.querySelectorAll('[id^="form-item-"]')].map(card => parseFormCard(card,folder)).filter(Boolean);
    }

    async function expandAndSettle() {
      let lastCount = -1;
      let stable = 0;
      for (let round=0; round<18; round++) {
        const buttons = [...document.querySelectorAll('button,[role="button"]')].filter(visible).filter(el => /عرض المزيد|إظهار المزيد|تحميل المزيد|Show more|Load more/i.test(clean(el.innerText || el.getAttribute('aria-label'))));
        if (buttons.length) {
          try { buttons[0].click(); } catch {}
          await sleep(450);
        }
        try { window.scrollTo(0, document.documentElement.scrollHeight); } catch {}
        await sleep(300);
        const count = document.querySelectorAll('[id^="form-item-"]').length;
        if (count === lastCount && !buttons.length) stable++; else stable = 0;
        lastCount = count;
        if (stable >= 2) break;
      }
      try { window.scrollTo(0,0); } catch {}
      await sleep(220);
    }

    async function waitForPortal(timeout=15000) {
      const started = Date.now();
      while (Date.now()-started < timeout) {
        if (isPortal() || document.querySelector('[id^="form-item-"]')) return true;
        await sleep(120);
      }
      return false;
    }

    async function scanHomeWorker() {
      await waitForPortal();

      // التقط المجموعات قبل تغيير التبويب وبعده، ثم وحّدها بالـ collectionId.
      const collectionMap = new Map();
      parseCollections().forEach(c => collectionMap.set(c.id, c));

      const tab = document.querySelector('#portal-tab-1');
      if (tab && visible(tab)) {
        try { tab.click(); } catch {}
        await sleep(700);
      }

      await expandAndSettle();
      parseCollections().forEach(c => collectionMap.set(c.id, c));

      return { collections: [...collectionMap.values()], forms: parseForms(null) };
    }

    async function scanCollectionWorker(folder) {
      await waitForPortal();
      await expandAndSettle();
      const heading = clean(document.querySelector('h1,h2,[role="heading"]')?.textContent || '');
      const resolved = { id: folder.id, name: folder.name || heading || `مجموعة ${folder.id}` };
      const forms = parseForms(resolved);
      return { folder: resolved, forms, actualCount: forms.length };
    }

    function workerBoot() {
      if (window.name !== WORKER_NAME) return false;
      window.addEventListener('message', async event => {
        if (event.origin !== location.origin || event.data?.ns !== NS) return;
        const { op, requestId, payload } = event.data;
        try {
          let result;
          if (op === 'SCAN_HOME') result = await scanHomeWorker();
          else if (op === 'SCAN_COLLECTION') result = await scanCollectionWorker(payload.folder);
          else return;
          event.source?.postMessage({ns:NS,type:'RESULT',requestId,result},event.origin);
        } catch (error) {
          event.source?.postMessage({ns:NS,type:'ERROR',requestId,error:String(error?.message || error)},event.origin);
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
          {
            ns: NS,
            type: 'READY',
            href: location.href
          },
          location.origin
        );
      }, 50);

      return true;
    }

    function createHiddenWorker(url) {
      /*
       * لا نستخدم display:none ولا أبعاد 0×0.
       * Forms يعتمد على القياسات والـ layout عند بناء بطاقات النماذج،
       * لذلك ننشئ iframe حقيقيًا بأبعاد كاملة لكنه خارج مساحة العرض.
       * المستخدم لا يراه ولا يحصل أي popup.
       */
      const frame =
        document.createElement('iframe');

      frame.name =
        WORKER_NAME;

      frame.setAttribute(
        'aria-hidden',
        'true'
      );

      frame.tabIndex = -1;

      Object.assign(
        frame.style,
        {
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
        }
      );

      frame.src =
        url;

      (
        document.body ||
        document.documentElement
      ).appendChild(frame);

      return {
        frame,
        get window() {
          return frame.contentWindow;
        },
        destroy() {
          try {
            frame.src = 'about:blank';
          } catch {}

          try {
            frame.remove();
          } catch {}
        }
      };
    }

    function waitMessage(worker, predicate, timeout=20000) {
      return new Promise((resolve,reject) => {
        const timer = setTimeout(() => { cleanup(); reject(new Error('انتهت مهلة عامل الفهرسة.')); },timeout);
        const onMessage = event => {
          if (event.origin !== location.origin || event.source !== worker || event.data?.ns !== NS) return;
          if (!predicate(event.data)) return;
          cleanup(); resolve(event.data);
        };
        const cleanup=()=>{ clearTimeout(timer); window.removeEventListener('message',onMessage); };
        window.addEventListener('message',onMessage);
      });
    }

    async function command(worker, op, payload={}) {
      const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const promise = waitMessage(worker, d => d.requestId === requestId && (d.type === 'RESULT' || d.type === 'ERROR'), 30000);
      worker.postMessage({ns:NS,op,requestId,payload},location.origin);
      const msg = await promise;
      if (msg.type === 'ERROR') throw new Error(msg.error);
      return msg.result;
    }

    async function navigateWorker(worker, url) {
      const ready = waitMessage(worker, d => d.type === 'READY', 25000);
      worker.location.href = url;
      await ready;
      await sleep(250);
    }

    function strictDedupe(forms) {
      const map = new Map();
      let skipped = 0;
      for (const f of forms) {
        const key = f.formKey || `${f.titleKey}|${f.collectionId || 'outside'}`;
        if (!map.has(key)) { map.set(key,f); continue; }
        skipped++;
        const old = map.get(key);
        if (!old.collectionId && f.collectionId) map.set(key,f);
      }
      state.skippedDuplicates = skipped;
      return [...map.values()];
    }

    async function rebuildIndexStrict() {
      if (state.indexing) return;
      purgeLegacyIndex();
      state.indexing = true;
      setStatus('جارٍ مسح الفهرس السابق وبدء فهرسة جديدة صارمة...','running');
      render();
      const base =
        new URL(
          '/Pages/DesignPageV2.aspx?origin=shell',
          location.origin
        ).href;

      const hiddenWorker =
        createHiddenWorker(base);

      const worker =
        hiddenWorker.window;

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
          await command(
            worker,
            'SCAN_HOME'
          );

        const all =
          [...home.forms];

        state.collections =
          home.collections;

        let done = 0;

        for (
          const folder of state.collections
        ) {
          if (
            !hiddenWorker.frame.isConnected
          ) {
            throw new Error(
              'توقف عامل الفهرسة المخفي قبل اكتمال العملية.'
            );
          }

          setStatus(
            `فهرسة المجموعة ${done + 1}/${state.collections.length}: ${folder.name}`,
            'running'
          );

          renderHeaderOnly();

          await navigateWorker(
            worker,
            folder.url
          );

          const scanned =
            await command(
              worker,
              'SCAN_COLLECTION',
              { folder }
            );

          all.push(
            ...scanned.forms
          );

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

        state.forms =
          strictDedupe(all);

        state.indexedAt =
          new Date();

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
        purgeLegacyIndex();

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
      let out = state.forms.filter(f => {
        if (state.filter === 'folders' && !f.collectionId) return false;
        if (state.filter === 'outside' && f.collectionId) return false;
        if (state.filter === 'responses' && f.responses <= 0) return false;
        if (state.filter === 'zero' && f.responses !== 0) return false;
        if (q && !canon(`${f.title} ${f.collectionName} ${f.responses}`).includes(q)) return false;
        return true;
      });
      out.sort((a,b)=>{
        if (state.sort === 'responses-asc') return a.responses-b.responses;
        if (state.sort === 'title') return a.title.localeCompare(b.title,'ar');
        if (state.sort === 'folder') return (a.collectionName||'').localeCompare(b.collectionName||'','ar') || a.title.localeCompare(b.title,'ar');
        return b.responses-a.responses;
      });
      return out;
    }

    function setStatus(text, kind='') {
      const el = document.querySelector(`#${HOST_ID} .mfs-status`);
      if (el) { el.textContent=text; el.dataset.kind=kind; }
      state.status = text;
    }

    function renderHeaderOnly() {
      const host=document.getElementById(HOST_ID); if (!host) return;
      const count=host.querySelector('.mfs-count'); if(count) count.textContent=`${state.forms.length} مفهرس`;
      const btn=host.querySelector('[data-action="index"]'); if(btn) { btn.disabled=state.indexing; btn.textContent=state.indexing?'جارٍ الفهرسة...':'إعادة الفهرسة'; }
      const status=host.querySelector('.mfs-status'); if(status && state.status) status.textContent=state.status;
    }

    function render() {
      const host=document.getElementById(HOST_ID); if (!host) return;
      const results=filtered();
      host.classList.toggle('mfs-collapsed',state.collapsed);
      host.querySelector('[data-action="collapse"]').textContent=state.collapsed?'⌄':'⌃';
      host.querySelector('.mfs-count').textContent=`${state.forms.length} مفهرس`;
      host.querySelector('[data-action="index"]').disabled=state.indexing;
      host.querySelector('[data-action="index"]').textContent=state.indexing?'جارٍ الفهرسة...':'إعادة الفهرسة';
      const rc=host.querySelector('.mfs-result-count'); if(rc) rc.textContent=`${results.length} نتيجة`;
      const box=host.querySelector('.mfs-results'); if(!box) return;
      if (!state.forms.length) {
        box.innerHTML='<div class="mfs-empty">جارٍ تجهيز فهرس جديد. يتم مسح الفهرس السابق تلقائيًا عند كل دخول إلى Forms ثم تبدأ فهرسة جديدة.</div>';
      } else if (!results.length) {
        box.innerHTML='<div class="mfs-empty">لا توجد نتائج مطابقة.</div>';
      } else {
        box.innerHTML=results.map(f=>`<button class="mfs-result" type="button" data-form-key="${html(f.formKey)}" data-url="${html(f.directUrl)}"><span class="mfs-title"><strong>${html(f.title)}</strong><small>${html(f.collectionName || 'خارج المجموعات')}</small></span><span class="mfs-responses">${f.responses} رد</span><span class="mfs-open">فتح النموذج ↗</span></button>`).join('');
        box.querySelectorAll('.mfs-result').forEach(btn=>btn.addEventListener('click',e=>{
          const url=btn.dataset.url;
          if (!url) return;
          if (e.ctrlKey || e.metaKey || e.shiftKey) window.open(url,'_blank','noopener');
          else location.href=url;
        }));
      }
      const status=host.querySelector('.mfs-status'); if(status) status.textContent=state.status || 'الفهرسة تلقائية وصارمة؛ يُمسح الفهرس السابق أولًا عند كل دخول إلى Forms.';
    }

    function injectStyles() {
      if (document.getElementById(STYLE_ID)) return;
      const style=document.createElement('style'); style.id=STYLE_ID;
      style.textContent=`
#${HOST_ID}{--p:#007874;--s:#00A39E;--b:#E5E7EB;--t:#1F2937;--m:#6B7280;width:min(1180px,calc(100% - 32px));margin:14px auto;border:1px solid var(--b);border-radius:12px;background:#fff;color:var(--t);font-family:"Segoe UI",Tahoma,Arial,sans-serif;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,.04);direction:rtl}
#${HOST_ID} *{box-sizing:border-box} #${HOST_ID} .mfs-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;min-height:58px} #${HOST_ID} .mfs-brand{display:flex;align-items:center;gap:10px} #${HOST_ID} .mfs-logo{width:34px;height:34px;border-radius:9px;display:grid;place-items:center;background:linear-gradient(135deg,var(--p),var(--s));color:#fff;font-weight:800} #${HOST_ID} .mfs-brand strong{display:block;font-size:14px} #${HOST_ID} .mfs-brand small{color:var(--m);font-size:10px} #${HOST_ID} .mfs-head-actions{display:flex;align-items:center;gap:7px;flex-wrap:wrap} #${HOST_ID} button,#${HOST_ID} input,#${HOST_ID} select{font:inherit} #${HOST_ID} button{cursor:pointer} #${HOST_ID} .mfs-primary{border:0;border-radius:8px;background:var(--p);color:#fff;padding:7px 11px;font-weight:600} #${HOST_ID} .mfs-primary:disabled{opacity:.5;cursor:not-allowed} #${HOST_ID} .mfs-collapse{width:34px;height:34px;border:1px solid var(--p);border-radius:8px;background:#fff;color:var(--p)} #${HOST_ID}.mfs-collapsed .mfs-body{display:none} #${HOST_ID} .mfs-count{font-size:10px;color:var(--p);background:#F2FBFA;padding:4px 8px;border-radius:999px;font-weight:700} #${HOST_ID} .mfs-body{border-top:1px solid var(--b);padding:12px 14px} #${HOST_ID} .mfs-status{font-size:11px;color:var(--m);margin-bottom:9px;padding:7px 9px;background:#FAFBFB;border-radius:8px} #${HOST_ID} .mfs-controls{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:9px} #${HOST_ID} .mfs-search{flex:1 1 300px;min-width:220px;height:38px;border:1px solid #D1D5DB;border-radius:8px;padding:0 10px} #${HOST_ID} select{height:38px;border:1px solid #D1D5DB;border-radius:8px;background:#fff;padding:0 8px;color:var(--t)} #${HOST_ID} .mfs-results-head{display:flex;justify-content:space-between;color:var(--m);font-size:11px;margin:7px 2px} #${HOST_ID} .mfs-results{border:1px solid var(--b);border-radius:9px;max-height:430px;overflow:auto} #${HOST_ID} .mfs-result{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:10px;align-items:center;border:0;border-bottom:1px solid #F0F1F2;background:#fff;padding:10px;text-align:right;color:var(--t)} #${HOST_ID} .mfs-result:hover{background:#F2FBFA} #${HOST_ID} .mfs-result:last-child{border-bottom:0} #${HOST_ID} .mfs-title{min-width:0} #${HOST_ID} .mfs-title strong{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px} #${HOST_ID} .mfs-title small{display:block;color:var(--m);font-size:10px;margin-top:3px} #${HOST_ID} .mfs-responses{font-size:10px;color:var(--m);white-space:nowrap} #${HOST_ID} .mfs-open{font-size:10px;color:var(--p);font-weight:700;white-space:nowrap} #${HOST_ID} .mfs-empty{padding:28px 16px;text-align:center;color:var(--m);font-size:11px}
@media(max-width:700px){#${HOST_ID}{width:calc(100% - 16px);margin-inline:8px}#${HOST_ID} .mfs-result{grid-template-columns:minmax(0,1fr) auto}.mfs-open{display:none!important}}
`;
      document.head.appendChild(style);
    }

    function mount(options = {}) {
      if (!isPortal()) return;

      /*
       * يخفي عنوان وبطاقات «استكشاف القوالب» فقط، بدون لمس حاويات النماذج.
       * routeBoot يستدعي mount أثناء تغييرات React، لذلك إذا أعاد Forms
       * إنشاء القسم لاحقًا سيتم إخفاؤه مجددًا تلقائيًا.
       */
      hideTemplateDiscovery();

      const freshEntry =
        options.freshEntry === true;

      const autoIndex =
        options.autoIndex !== false;

      /*
       * عند الرجوع إلى بوابة Forms عبر SPA قد تبقى واجهة المحسن القديمة
       * في DOM. في "دخول جديد" نحذفها ثم نبدأ من حالة نظيفة بالكامل.
       */
      if (freshEntry) {
        try {
          document.getElementById(HOST_ID)?.remove();
        } catch {}

        state.mounted = false;
        state.collapsed = true;
        state.autoIndexStarted = false;

        // الشرط الأساسي: مسح الفهرس السابق قبل أي فهرسة تلقائية.
        purgeLegacyIndex();
      }

      const existing =
        document.getElementById(HOST_ID);

      if (existing) {
        state.mounted = true;
        return;
      }

      /*
       * حتى أول تحميل مباشر للبوابة يبدأ من فهرس فارغ.
       */
      if (!freshEntry) {
        purgeLegacyIndex();
      }

      injectStyles();

      const host =
        document.createElement('section');

      host.id = HOST_ID;
      host.className = 'mfs-collapsed';

      host.innerHTML =
        `<div class="mfs-head">
          <div class="mfs-brand">
            <span class="mfs-logo">F</span>
            <div>
              <strong>محسن Microsoft Forms</strong>
              <small>فهرسة تلقائية مخفية عند كل دخول · بحث مباشر في النماذج</small>
            </div>
          </div>

          <div class="mfs-head-actions">
            <span class="mfs-count">0 مفهرس</span>
            <button class="mfs-primary" data-action="index" type="button">إعادة الفهرسة</button>
            <button class="mfs-collapse" data-action="collapse" type="button" title="فتح/طي">⌄</button>
          </div>
        </div>

        <div class="mfs-body">
          <div class="mfs-status">تم مسح الفهرس السابق. ستبدأ الفهرسة التلقائية في الخلفية بدون أي نافذة منبثقة.</div>

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
            <span>v1.0.5</span>
          </div>
        </div>`;

      const anchor =
        document.querySelector('[role="tablist"]') ||
        document.querySelector('[data-automation-id="newFormButton"]')?.parentElement ||
        document.querySelector('#scroll-dnd');

      if (anchor?.parentElement) {
        anchor.parentElement.insertBefore(
          host,
          anchor
        );
      } else {
        document.body.prepend(host);
      }

      host
        .querySelector('[data-action="index"]')
        .addEventListener(
          'click',
          rebuildIndexStrict
        );

      host
        .querySelector('[data-action="collapse"]')
        .addEventListener('click', () => {
          state.collapsed =
            !state.collapsed;

          render();
        });

      host
        .querySelector('.mfs-search')
        .addEventListener('input', e => {
          state.query =
            e.target.value;

          render();
        });

      host
        .querySelector('.mfs-filter')
        .addEventListener('change', e => {
          state.filter =
            e.target.value;

          render();
        });

      host
        .querySelector('.mfs-sort')
        .addEventListener('change', e => {
          state.sort =
            e.target.value;

          render();
        });

      state.mounted = true;
      render();

      hideTemplateDiscovery();

      [250, 900, 2200].forEach(delay => {
        setTimeout(() => {
          if (isPortal()) {
            hideTemplateDiscovery();
          }
        }, delay);
      });

      window.MAD_FORMS_PRODUCTIVITY = {
        version: '1.0.2',
        index: rebuildIndexStrict,
        forms: () => [...state.forms],
        collections: () => [...state.collections],
        clear: () => {
          purgeLegacyIndex();
          render();
        },
        hideTemplates: () =>
          hideTemplateDiscovery()
      };

      /*
       * الفهرسة تلقائية، ولكن بعد أن تستقر البوابة قليلًا.
       * rebuildIndexStrict() يمسح الفهرس مرة أخرى كحماية إضافية،
       * لذا لا يمكن تراكم فهرس سابق أو تكراره بين الزيارات.
       */
      if (
        autoIndex &&
        !state.autoIndexStarted
      ) {
        state.autoIndexStarted = true;

        setStatus(
          'تم مسح الفهرس السابق. جارٍ بدء الفهرسة المخفية في الخلفية...',
          'running'
        );

        renderHeaderOnly();

        setTimeout(() => {
          if (
            isPortal() &&
            !state.indexing
          ) {
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

    return { workerBoot, mount, enterPortalFresh, isPortal, purgeLegacyIndex, hideTemplateDiscovery };
  })();

  const SETTINGS = (() => {
    const HOST='m0hm3d85-forms-settings-presets';
    const KEY='M0HM3D85_FORMS_SETTINGS_PRESETS';
    const defs=[
      ['practice','وضع التدريب','switch'],['autoResults','إظهار النتائج تلقائياً','switch'],['accept','قبول الاستجابات','checkbox'],['start','تاريخ البدء','switch'],['end','تاريخ الانتهاء','switch'],['duration','تعيين المدة الزمنية','switch'],['shuffle','تبديل ترتيب الأسئلة عشوائياً','switch'],['disableNumber','تعطيل رقم السؤال للمستجيبين','switch'],['progress','إظهار شريط التقدم','switch'],['hideAnother','إخفاء إرسال رد آخر','switch'],['thank','تخصيص رسالة الشكر','switch'],['save','#allow-save-response-setting','selector'],['edit','#allow-edit-response-setting','selector'],['receipt','السماح بإرسال إيصال بالاستجابات بعد الإرسال','switch'],['notify','الحصول على إعلام بالبريد الإلكتروني لكل استجابة','switch']
    ];
    const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
    function findByLabel(label,kind){
      if(label.startsWith('#')) return document.querySelector(label);
      const candidates=[...document.querySelectorAll(kind==='switch'?'[role="switch"]':'input[type="checkbox"],[role="checkbox"]')];
      let el=candidates.find(x=>clean(x.getAttribute('aria-label'))===label);
      if(el) return el;
      const textNode=[...document.querySelectorAll('label,span,div')].find(x=>clean(x.textContent)===label);
      return textNode?.closest('label')?.querySelector('input,[role="checkbox"],[role="switch"]') || textNode?.parentElement?.querySelector('input,[role="checkbox"],[role="switch"]') || null;
    }
    function read(){
      const values={};
      for(const [key,label,kind] of defs){ const el=findByLabel(label,kind); if(!el) continue; values[key]=el.getAttribute('aria-checked')==='true' || el.checked===true; }
      const aud=['anyoneCanRespond','orgCanRespond','specificPeopleCanRespond'].find(id=>document.getElementById(id)?.checked || document.getElementById(id)?.getAttribute('aria-checked')==='true');
      values.audience=aud||''; return values;
    }
    function load(){try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return []}}
    function saveAll(v){localStorage.setItem(KEY,JSON.stringify(v))}
    async function apply(preset){
      const before=read();
      if(preset.values.audience && preset.values.audience!==before.audience){ const r=document.getElementById(preset.values.audience); if(r && !r.disabled) r.click(); }
      for(const [key,label,kind] of defs){ if(!(key in preset.values)) continue; const el=findByLabel(label,kind); if(!el||el.disabled||el.getAttribute('aria-disabled')==='true') continue; const cur=el.getAttribute('aria-checked')==='true'||el.checked===true; if(cur!==!!preset.values[key]){ el.click(); await new Promise(r=>setTimeout(r,120)); } }
    }
    function mount(){
      const pane=document.querySelector('#side-pane-container'); if(!pane||document.getElementById(HOST)) return;
      const box=document.createElement('div'); box.id=HOST; box.dir='rtl'; box.style.cssText='margin:10px;padding:10px;border:1px solid #CFE8E6;border-radius:10px;background:#F8FCFC;font-family:Segoe UI,Tahoma,Arial,sans-serif;color:#1F2937';
      box.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><strong style="font-size:12px">قوالب الإعدادات</strong><span style="font-size:9px;color:#6B7280">M0HM3D85</span></div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px"><select class="msp-list" style="flex:1;min-width:150px;height:34px;border:1px solid #D1D5DB;border-radius:8px;background:#fff"></select><button data-a="apply">تطبيق</button><button data-a="save">حفظ الحالي</button><button data-a="delete">حذف</button></div><div class="msp-status" style="font-size:10px;color:#6B7280;margin-top:7px">يتم تطبيق الفروقات فقط وتجاهل الخيارات المعطلة.</div>';
      box.querySelectorAll('button').forEach(b=>b.style.cssText='border:1px solid #007874;border-radius:8px;padding:6px 9px;background:#fff;color:#007874;cursor:pointer');
      pane.prepend(box);
      const list=box.querySelector('.msp-list'),status=box.querySelector('.msp-status');
      const render=()=>{const ps=load();list.innerHTML='<option value="">اختر قالبًا...</option>'+ps.map((p,i)=>`<option value="${i}">${p.name}</option>`).join('')}; render();
      box.querySelector('[data-a="save"]').onclick=()=>{const name=prompt('اسم القالب:'); if(!name)return; const ps=load();ps.push({name:clean(name),values:read(),createdAt:Date.now()});saveAll(ps);render();status.textContent='تم حفظ الإعدادات الحالية.'};
      box.querySelector('[data-a="apply"]').onclick=async()=>{const i=Number(list.value);const ps=load();if(!Number.isInteger(i)||!ps[i])return;await apply(ps[i]);status.textContent=`تم تطبيق «${ps[i].name}» على الفروقات المتاحة.`};
      box.querySelector('[data-a="delete"]').onclick=()=>{const i=Number(list.value);const ps=load();if(!Number.isInteger(i)||!ps[i])return;if(!confirm(`حذف القالب «${ps[i].name}»؟`))return;ps.splice(i,1);saveAll(ps);render();status.textContent='تم حذف القالب.'};
    }
    return {mount,read,load,apply};
  })();

function startEditorEnhancer() {
  'use strict';

  /*
  =========================================================================
   Microsoft Forms Smart Enhancer — Editor Module v1.0.5

   تصميم وتطوير: Mohammed Almalki (M0HM3D85)
   GreasyFork: https://greasyfork.org/en/users/1636459-m0hm3d85
   X / Twitter: @M0HM3D85
   Snapchat: M0HM3D85

   © 2026 Mohammed Almalki (M0HM3D85) — جميع الحقوق محفوظة.
  =========================================================================
  */

  const VERSION = FINAL_VERSION;
  /*
   * v0.5.2:
   * استخدم معرفًا ثابتًا بين الإصدارات.
   * السبب: المعرفات التي تحتوي رقم الإصدار كانت تسمح بتشغيل
   * v0.5.0 و v0.5.1 معًا في الصفحة، فتتداخل الـObservers والأزرار.
   */
  const HOST_ID = 'm0hm3d85-forms-editor-enhancer';
  const STYLE_ID = `${HOST_ID}-style`;
  const LEGACY_HOST_PREFIX = 'm0hm3d85-forms-editor-enhancer-v';

  /*
   * أولًا: حاول إيقاف آخر نسخة معروفة عبر الـAPI العام.
   */
  try {
    window.MAD_FORMS_EDITOR_ENHANCER?.destroy?.();
  } catch (error) {
    console.warn('تعذر إيقاف نسخة سابقة من المحسن:', error);
  }

  /*
   * ثانيًا: احذف أي واجهات قديمة بقيت من v0.3/v0.4/v0.5.
   * هذا يجعل الـMutationObserver القديم يصبح خاملاً لأنه يتحقق
   * من وجود HOST_ID الخاص به قبل أي refresh.
   */
  [
    ...document.querySelectorAll(
      `[id^="${LEGACY_HOST_PREFIX}"], #${HOST_ID}`
    )
  ].forEach(el => {
    try {
      el.remove();
    } catch {}
  });

  [
    ...document.querySelectorAll(
      `style[id^="${LEGACY_HOST_PREFIX}"], #${STYLE_ID}`
    )
  ].forEach(el => {
    try {
      el.remove();
    } catch {}
  });

  console.log(
    '🧹 تم تنظيف أي واجهة قديمة من Microsoft Forms Editor Enhancer قبل تشغيل v1.0.5.'
  );

  const sleep = ms => new Promise(r => setTimeout(r, ms));

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

  function html(value = '') {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function visible(el) {
    if (!(el instanceof Element) || !el.isConnected) return false;
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return (
      s.display !== 'none' &&
      s.visibility !== 'hidden' &&
      r.width > 0 &&
      r.height > 0
    );
  }

  function labelOf(el) {
    return clean(
      el?.getAttribute?.('aria-label') ||
      el?.getAttribute?.('title') ||
      el?.innerText ||
      el?.textContent ||
      ''
    );
  }

  function debounce(fn, wait = 600) {
    let timer = 0;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  }

  function uniq(arr) {
    return [...new Set(arr)];
  }

  function parseNumber(value, fallback = 0) {
    const n = Number(
      westernDigits(value)
        .replace(',', '.')
        .replace(/[^\d.-]/g, '')
    );
    return Number.isFinite(n) ? n : fallback;
  }

  function getFormRoot() {
    return (
      document.querySelector('[data-automation-id="formRoot"]') ||
      document.querySelector('main') ||
      document.body
    );
  }

  function getAllWrappers() {
    return [
      ...document.querySelectorAll('[data-automation-id="questionWrapper"]')
    ];
  }

  function getWrappers() {
    return getAllWrappers().filter(visible);
  }

  function getDesignerCards() {
    return [
      ...document.querySelectorAll('[data-automation-id="questionDesignerCard"]')
    ].filter(visible);
  }

  function questionNumberFrom(el, fallback = 0) {
    const raw = westernDigits(
      el?.getAttribute?.('aria-label') ||
      el?.querySelector?.('[data-automation-id="questionTitle"]')?.innerText ||
      el?.innerText ||
      ''
    );

    const m = raw.match(/^\s*(\d+)\s*[.)\-–—]/) ||
              raw.match(/(?:السؤال|question)\s*(\d+)/i);

    return m ? Number(m[1]) : fallback;
  }

  function getDesignerCardByNumber(number) {
    const cards = getDesignerCards();

    /*
     * لا نستخدم cards[number - 1] كـ fallback.
     * Forms غالبًا يعرض بطاقة تحرير واحدة فقط للسؤال النشط،
     * واستخدامها موضعيًا كان يلوث بيانات سؤال آخر بعد العمليات الجماعية.
     */
    return (
      cards.find(card =>
        questionNumberFrom(card, 0) === number
      ) ||
      null
    );
  }

  function getOptionElements(root) {
    if (!root) return [];

    const automationOptions = [
      ...root.querySelectorAll(
        '[data-automation-id="questionChoiceOptionContainer"]'
      )
    ].filter(visible);

    if (automationOptions.length) return automationOptions;

    return [
      ...root.querySelectorAll('[role="listitem"],[role="radio"]')
    ].filter(el => {
      if (!visible(el)) return false;
      const text = clean(el.innerText);
      return !!text;
    });
  }

  function extractOptionText(el) {
    return clean(
      el?.querySelector?.('[role="textbox"]')?.innerText ||
      el?.innerText ||
      el?.textContent ||
      ''
    );
  }

  function detectCorrectState(card) {
    if (!card) {
      return {
        known: false,
        indexes: [],
        optionRows: []
      };
    }

    const optionRows = getOptionElements(card);
    const indexes = [];
    let statefulButtons = 0;

    optionRows.forEach((row, index) => {
      const candidates = [
        ...row.querySelectorAll('button,[role="button"],[role="checkbox"]')
      ].filter(el =>
        /إجابة صحيحة|Correct answer/i.test(labelOf(el))
      );

      const btn = candidates[0];

      if (!btn) return;

      const hasState =
        btn.hasAttribute('aria-pressed') ||
        btn.hasAttribute('aria-checked') ||
        btn.hasAttribute('data-checked') ||
        btn.hasAttribute('data-selected');

      if (hasState) statefulButtons++;

      const selected =
        btn.getAttribute('aria-pressed') === 'true' ||
        btn.getAttribute('aria-checked') === 'true' ||
        btn.getAttribute('data-checked') === 'true' ||
        btn.getAttribute('data-selected') === 'true';

      if (selected) indexes.push(index);
    });

    return {
      known: statefulButtons > 0,
      indexes,
      optionRows
    };
  }

  function cleanQuestionTitle(raw, number) {
    let text = westernDigits(clean(raw));

    if (number) {
      text = text.replace(
        new RegExp(`^\\s*${number}\\s*[.)\\-–—]?\\s*`),
        ''
      );
    }

    // Remove common accessibility suffixes added by Forms.
    text = text
      .replace(/\s+مطلوب الإجابة\.?/g, ' ')
      .replace(/\s+غير مطلوب\.?/g, ' ')
      .replace(/\s+(?:خيار واحد|إجابات متعددة|نص من سطر واحد|نص متعدد الأسطر)\.?/g, ' ')
      .replace(/\s+\(\s*\d+(?:\.\d+)?\s*(?:نقطة|نقاط)\s*\)\s*$/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return text;
  }

  function detectType(summaryText, options) {
    const text = clean(summaryText);

    if (/نص من سطر واحد|short answer|text/i.test(text)) {
      return 'text';
    }

    if (/نص متعدد الأسطر|long answer/i.test(text)) {
      return 'longtext';
    }

    if (/إجابات متعددة|multiple answers/i.test(text)) {
      return 'multiple';
    }

    if (options.length === 2) {
      const set = new Set(options.map(canonical));
      if (
        (set.has('صح') && set.has('خطا')) ||
        (set.has('true') && set.has('false'))
      ) {
        return 'truefalse';
      }
    }

    if (/خيار واحد|choice/i.test(text) || options.length) {
      return 'choice';
    }

    return 'unknown';
  }

  function detectPoints(summaryText) {
    const text = westernDigits(clean(summaryText));

    const m = text.match(
      /\(\s*(\d+(?:[.,]\d+)?)\s*(?:نقطة|نقاط)\s*\)/
    ) || text.match(
      /(\d+(?:[.,]\d+)?)\s*(?:نقطة|نقاط)/
    );

    return m ? parseNumber(m[1], 0) : 0;
  }

  function detectRequired(summaryText) {
    const text = clean(summaryText);
    if (/مطلوب الإجابة|Required/i.test(text)) return true;
    if (/غير مطلوب|Optional/i.test(text)) return false;
    return null;
  }

  function similarity(a, b) {
    const x = canonical(a);
    const y = canonical(b);

    if (!x || !y) return 0;
    if (x === y) return 1;

    function bigrams(s) {
      const chars = s.replace(/\s+/g, ' ');
      const result = [];
      for (let i = 0; i < chars.length - 1; i++) {
        result.push(chars.slice(i, i + 2));
      }
      return result;
    }

    const A = bigrams(x);
    const B = bigrams(y);

    if (!A.length || !B.length) return 0;

    const counts = new Map();

    for (const bg of A) {
      counts.set(bg, (counts.get(bg) || 0) + 1);
    }

    let intersection = 0;

    for (const bg of B) {
      const count = counts.get(bg) || 0;
      if (count > 0) {
        intersection++;
        counts.set(bg, count - 1);
      }
    }

    return (2 * intersection) / (A.length + B.length);
  }


  function stripHtml(value = '') {
    const div = document.createElement('div');
    div.innerHTML = String(value ?? '');
    return clean(div.textContent || div.innerText || '');
  }

  function findDefinitionEndpoint() {
    const entries = performance.getEntriesByType('resource') || [];

    const candidates = entries
      .map(entry => entry.name)
      .filter(Boolean)
      .filter(url =>
        /\/formapi\/api\//i.test(url) &&
        /questions/i.test(url) &&
        /choices/i.test(url)
      );

    // Prefer the form-definition request that explicitly expands choices.
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
      candidates.find(url =>
        /questions/i.test(url) &&
        /choices/i.test(url)
      ) ||
      ''
    );
  }

  function safeJsonParse(value) {
    if (typeof value !== 'string') return null;

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
      const value = stack.pop();

      if (!value || typeof value !== 'object') continue;
      if (seen.has(value)) continue;
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

        const correctChoices =
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
            .filter(Boolean);

        found.push({
          title,
          titleKey: canonical(title),
          questionInfo: info,
          choices: choices.map(choice => ({
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
          correctAnswers: correctChoices,
          points:
            Number.isFinite(Number(info.Point))
              ? Number(info.Point)
              : null,
          raw: value
        });
      }

      if (Array.isArray(value)) {
        // Reverse push preserves the original array order during stack traversal.
        for (let i = value.length - 1; i >= 0; i--) {
          const child = value[i];
          if (child && typeof child === 'object') {
            stack.push(child);
          }
        }
      } else {
        const keys = Object.keys(value);
        for (let i = keys.length - 1; i >= 0; i--) {
          const key = keys[i];

          // Avoid walking obvious non-content / metadata branches forever.
          if (/token|authorization|cookie|session|telemetry/i.test(key)) {
            continue;
          }

          let child;
          try {
            child = value[key];
          } catch {
            continue;
          }

          if (child && typeof child === 'object') {
            stack.push(child);
          }
        }
      }
    }

    /*
     * لا نحذف الأسئلة المتطابقة بالمحتوى.
     *
     * v0.5.2 كان يستخدم:
     * title + choices + points
     * كتوقيع فريد، ولذلك إذا كرر المستخدم سؤالًا فعليًا كان API
     * ينهار مثلًا من 6 أسئلة إلى نموذجين فقط.
     *
     * WeakSet أعلاه يمنع تكرار نفس object reference أصلًا.
     * هنا لا نحذف إلا نسخة ثانية لها "معرف سؤال" صريح ومتطابق.
     */
    const unique = [];
    const strongIds = new Set();

    for (const item of found) {
      const raw =
        item.raw || {};

      const strongId =
        clean(
          raw.id ??
          raw.questionId ??
          raw.QuestionId ??
          raw.formsProRTQuestionId ??
          raw.FormsProRTQuestionId ??
          raw.uniqueId ??
          ''
        );

      if (strongId) {
        if (strongIds.has(strongId)) {
          continue;
        }

        strongIds.add(strongId);
      }

      unique.push(item);
    }

    return unique;
  }

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
      await fetch(endpoint, {
        credentials: 'include',
        cache: 'no-store'
      });

    if (!response.ok) {
      throw new Error(
        `تعذر قراءة تعريف Forms: HTTP ${response.status}`
      );
    }

    const json =
      await response.json();

    return collectQuestionModels(json);
  }

  async function waitForApiQuestionCount(
    expected,
    timeout = 15000,
    interval = 500
  ) {
    const started =
      Date.now();

    let lastCount =
      null;

    let lastModels =
      [];

    while (
      Date.now() - started < timeout
    ) {
      try {
        lastModels =
          await fetchFreshQuestionModels();

        lastCount =
          lastModels.length;

        if (
          lastCount === expected
        ) {
          state.answerModels =
            lastModels;

          state.answerModelsLoaded =
            true;

          state.answerApiStatus =
            lastModels.length
              ? 'ready'
              : 'empty';

          return {
            count: lastCount,
            models: lastModels
          };
        }
      } catch (error) {
        console.warn(
          'انتظار مزامنة تعريف Forms:',
          error
        );
      }

      await sleep(interval);
    }

    throw new Error(
      `لم يصل تعريف Forms إلى العدد المتوقع ${expected}. آخر عدد من API: ${lastCount ?? 'غير متاح'}.`
    );
  }

  async function getFreshApiCount() {
    const models =
      await fetchFreshQuestionModels();

    return {
      count: models.length,
      models
    };
  }

  function bestModelForQuestion(q, models, usedIndexes = new Set()) {
    const qKey = canonical(q.title);
    let best = null;

    models.forEach((model, index) => {
      if (usedIndexes.has(index)) return;

      let score = 0;

      if (qKey && model.titleKey) {
        if (qKey === model.titleKey) {
          score = 1;
        } else if (
          qKey.includes(model.titleKey) ||
          model.titleKey.includes(qKey)
        ) {
          const shorter = Math.min(
            qKey.length,
            model.titleKey.length
          );
          const longer = Math.max(
            qKey.length,
            model.titleKey.length
          );

          score =
            0.82 +
            (shorter / Math.max(longer, 1)) * 0.12;
        } else {
          score = similarity(q.title, model.title);
        }
      }

      // Preserve order as a weak tie-breaker.
      const orderBonus =
        Math.max(
          0,
          0.06 -
          Math.abs(q.index - index) * 0.004
        );

      const total =
        score + orderBonus;

      if (!best || total > best.total) {
        best = {
          index,
          model,
          score,
          total
        };
      }
    });

    if (!best) return null;

    // Exact/near text match is preferred. For forms whose API rich-text
    // differs from the aria text, allow same-position fallback.
    const samePosition =
      models[q.index] &&
      !usedIndexes.has(q.index)
        ? {
            index: q.index,
            model: models[q.index],
            score: similarity(
              q.title,
              models[q.index].title
            ),
            total: 0
          }
        : null;

    if (
      best.score >= 0.54 ||
      best.total >= 0.60
    ) {
      return best;
    }

    return samePosition;
  }

  function mergeAnswerModelsIntoQuestions() {
    const models =
      state.answerModels || [];

    if (!models.length) return;

    const usedIndexes =
      new Set();

    for (const q of state.questions) {
      const match =
        bestModelForQuestion(
          q,
          models,
          usedIndexes
        );

      if (!match) continue;

      usedIndexes.add(match.index);

      const model =
        match.model;

      q.apiModel =
        model;

      if (model.choices.length) {
        q.options =
          model.choices
            .map(x => x.text)
            .filter(Boolean);

        q.correctKnown = true;
        q.correctIndexes =
          model.choices
            .map((choice, index) =>
              choice.isAnswerKey
                ? index
                : -1
            )
            .filter(index =>
              index >= 0
            );

        q.correctAnswers =
          model.correctAnswers;

        q.answerSource =
          'forms-api';
      }

      if (
        model.points != null &&
        Number.isFinite(model.points)
      ) {
        q.points =
          model.points;
      }
    }
  }

  async function loadAnswerModels(force = false) {
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
          const endpoint =
            state.answerModelUrl ||
            findDefinitionEndpoint();

          if (!endpoint) {
            state.answerApiStatus =
              'endpoint-missing';
            return [];
          }

          state.answerModelUrl =
            endpoint;

          const models =
            await fetchFreshQuestionModels();

          state.answerModels =
            models;

          /*
           * قد يكون السؤال الجاري تحريره قد اختفى من questionWrapper.
           * بعد وصول تعريف Forms نضمن أن عدد الأسئلة في المحسن لا ينقص.
           */
          const apiCanReconcileStructure =
            Date.now() >= state.structuralGuardUntil &&
            (
              !Number.isFinite(state.expectedStructureCount) ||
              models.length === state.expectedStructureCount
            );

          if (apiCanReconcileStructure) {
            state.questions =
              reconcileQuestionList(
                [...state.questions],
                new Map(
                  state.questions.map(q => [
                    q.number,
                    q
                  ])
                )
              );
          } else {
            console.log(
              `⏳ تم تحميل API للإجابات فقط بدون تغيير عدد الأسئلة: API=${models.length} / المتوقع=${state.expectedStructureCount ?? 'غير محدد'}`
            );
          }

          state.answerModelsLoaded =
            true;

          state.answerApiStatus =
            models.length
              ? 'ready'
              : 'empty';

          mergeAnswerModelsIntoQuestions();

          // Rebuild the audit because API data may add points/options/answer keys.
          buildAudit(state.questions);

          render();

          console.log(
            `✅ تم تحميل ${models.length} سؤالًا من تعريف Forms واستخراج مفاتيح الإجابات بدون فتح الأسئلة.`
          );

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
            'تعذر تحميل مفاتيح الإجابات من تعريف Forms:',
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

  function inferTypeFromModel(model) {
    const options =
      model?.choices?.map(x => x.text).filter(Boolean) || [];

    if (options.length === 2) {
      const set =
        new Set(options.map(canonical));

      if (
        (set.has('صح') && set.has('خطا')) ||
        (set.has('true') && set.has('false'))
      ) {
        return 'truefalse';
      }
    }

    if (options.length) {
      return 'choice';
    }

    return 'unknown';
  }

  function questionFromApiModel(model, index) {
    const number =
      index + 1;

    const options =
      model?.choices
        ?.map(x => x.text)
        .filter(Boolean) || [];

    return {
      index,
      number,
      title:
        model?.title ||
        `السؤال ${number}`,
      summaryText:
        model?.title ||
        '',
      type:
        inferTypeFromModel(model),
      points:
        Number.isFinite(Number(model?.points))
          ? Number(model.points)
          : 0,
      required:
        null,
      options,
      correctKnown:
        !!model?.choices?.length,
      correctIndexes:
        (model?.choices || [])
          .map((choice, choiceIndex) =>
            choice?.isAnswerKey
              ? choiceIndex
              : -1
          )
          .filter(choiceIndex =>
            choiceIndex >= 0
          ),
      correctAnswers:
        [...(model?.correctAnswers || [])],
      answerSource:
        model?.choices?.length
          ? 'forms-api'
          : null,
      apiModel:
        model || null,
      wrapper:
        wrapperByNumber(number),
      designerCard:
        null,
      optionElements:
        [],
      issues:
        []
    };
  }

  function normalizeQuestionOrder(questions) {
    return questions
      .filter(Boolean)
      .sort((a, b) =>
        Number(a.number) - Number(b.number)
      )
      .map((q, index) => {
        q.index = index;
        return q;
      });
  }

  function restoreMissingFromPrevious(scanned, previousQuestions) {
    const present =
      new Set(
        scanned.map(q => q.number)
      );

    let restored = 0;

    for (const old of previousQuestions.values()) {
      if (
        !old?.number ||
        present.has(old.number)
      ) {
        continue;
      }

      /*
       * عند فتح السؤال الأخير، Forms قد يزيل questionWrapper الخاص به
       * من DOM ويستبدله بمحرر حي. لا نحذف السؤال من واجهة المحسن بسبب ذلك؛
       * نعيد آخر Snapshot موثوق حتى يعود wrapper في refresh لاحق.
       */
      scanned.push({
        ...old,
        wrapper:
          wrapperByNumber(old.number),
        designerCard:
          getDesignerCardByNumber(old.number),
        optionElements:
          [],
        issues:
          []
      });

      present.add(old.number);
      restored++;

      console.log(
        `🧩 تم الحفاظ على السؤال ${old.number} رغم أن Forms أزال questionWrapper الخاص به مؤقتًا.`
      );
    }

    return restored;
  }

  function restoreMissingFromApi(scanned) {
    const models =
      state.answerModels || [];

    if (!models.length) {
      return 0;
    }

    /*
     * بعد التكرار/الحذف قد يتأخر Forms API عدة ثوانٍ عن DOM.
     * لا نستخدم API القديم لإعادة أسئلة حُذفت أو لإخفاء نسخ أُنشئت للتو.
     */
    if (
      Date.now() < state.structuralGuardUntil
    ) {
      return 0;
    }

    if (
      Number.isFinite(state.expectedStructureCount) &&
      models.length !== state.expectedStructureCount
    ) {
      console.log(
        `⏳ تجاهلت استعادة بنيوية من API مؤقتًا: API=${models.length} / المتوقع=${state.expectedStructureCount}`
      );
      return 0;
    }

    const present =
      new Set(
        scanned.map(q => q.number)
      );

    let restored = 0;

    models.forEach((model, index) => {
      const number =
        index + 1;

      if (present.has(number)) {
        return;
      }

      scanned.push(
        questionFromApiModel(
          model,
          index
        )
      );

      present.add(number);
      restored++;

      console.log(
        `🧩 تم استعادة السؤال ${number} من تعريف Forms لأن questionWrapper غير موجود حاليًا.`
      );
    });

    return restored;
  }

  function reconcileQuestionList(scanned, previousQuestions = new Map()) {
    restoreMissingFromPrevious(
      scanned,
      previousQuestions
    );

    restoreMissingFromApi(
      scanned
    );

    return normalizeQuestionOrder(
      scanned
    );
  }

  function scanQuestions() {
    /*
     * بعد فتح سؤال في المحرر قد يخفي Forms بعض wrappers مؤقتًا،
     * لذلك يجب بناء القائمة من جميع questionWrapper المتصلة بالـDOM
     * وليس العناصر المرئية فقط.
     */
    const wrappers =
      getAllWrappers().filter(el => el.isConnected);

    const cards = getDesignerCards();

    const roots = wrappers.length ? wrappers : cards;

    return roots.map((wrapper, i) => {
      const number = questionNumberFrom(wrapper, i + 1);

      const titleNode =
        wrapper.querySelector('[data-automation-id="questionTitle"]') ||
        wrapper.querySelector('[aria-label*="عنوان السؤال"]') ||
        wrapper;

      const summaryText = clean(
        titleNode?.innerText ||
        wrapper?.getAttribute('aria-label') ||
        wrapper?.innerText ||
        ''
      );

      const designerCard =
        getDesignerCardByNumber(number) ||
        (
          cards.length === roots.length &&
          roots.length > 1
            ? cards[i]
            : null
        );

      const optionRoot = designerCard || wrapper;
      const optionElements = getOptionElements(optionRoot);
      const options = optionElements
        .map(extractOptionText)
        .map(clean)
        .filter(Boolean);

      const correct = detectCorrectState(designerCard || wrapper);

      const title = cleanQuestionTitle(summaryText, number);
      const type = detectType(summaryText, options);
      const points = detectPoints(summaryText);
      const required = detectRequired(summaryText);

      return {
        index: i,
        number,
        title,
        summaryText,
        type,
        points,
        required,
        options,
        correctKnown: correct.known,
        correctIndexes: correct.indexes,
        correctAnswers: [],
        answerSource: correct.known ? 'dom' : null,
        apiModel: null,
        wrapper,
        designerCard,
        optionElements: correct.optionRows.length
          ? correct.optionRows
          : optionElements,
        issues: []
      };
    });
  }

  function buildAudit(questions) {
    const byTitle = new Map();

    for (const q of questions) {
      q.issues = [];

      if (!q.title) {
        q.issues.push({
          level: 'error',
          code: 'missing-title',
          text: 'عنوان السؤال فارغ.'
        });
      }

      if (q.points === 0 && q.number > 2) {
        q.issues.push({
          level: 'warn',
          code: 'zero-points',
          text: 'درجة السؤال تساوي 0.'
        });
      }

      if (q.required === false) {
        q.issues.push({
          level: 'info',
          code: 'optional',
          text: 'السؤال غير مطلوب.'
        });
      }

      if (q.options.length) {
        const seen = new Map();

        q.options.forEach((option, oi) => {
          const key = canonical(option);
          if (!key) return;

          if (seen.has(key)) {
            q.issues.push({
              level: 'error',
              code: 'duplicate-option',
              text: `الخيار ${oi + 1} مكرر مع الخيار ${seen.get(key) + 1}.`
            });
          } else {
            seen.set(key, oi);
          }
        });
      }

      if (
        ['choice', 'multiple', 'truefalse'].includes(q.type) &&
        q.correctKnown &&
        q.correctIndexes.length === 0
      ) {
        q.issues.push({
          level: 'error',
          code: 'missing-correct',
          text: 'لم يتم تحديد إجابة صحيحة.'
        });
      }

      const key = canonical(q.title);

      if (key) {
        if (byTitle.has(key)) {
          q.issues.push({
            level: 'error',
            code: 'duplicate-title',
            text: `عنوان مكرر مع السؤال ${byTitle.get(key)}.`
          });
        } else {
          byTitle.set(key, q.number);
        }
      }
    }

    // Similar-title warning. Keep threshold high to reduce false positives.
    for (let i = 0; i < questions.length; i++) {
      const a = questions[i];

      if (canonical(a.title).length < 18) continue;

      for (let j = i + 1; j < questions.length; j++) {
        const b = questions[j];

        if (canonical(b.title).length < 18) continue;
        if (canonical(a.title) === canonical(b.title)) continue;

        const score = similarity(a.title, b.title);

        if (score >= 0.92) {
          a.issues.push({
            level: 'warn',
            code: 'similar-title',
            text: `العنوان مشابه جدًا للسؤال ${b.number} (${Math.round(score * 100)}%).`
          });

          b.issues.push({
            level: 'warn',
            code: 'similar-title',
            text: `العنوان مشابه جدًا للسؤال ${a.number} (${Math.round(score * 100)}%).`
          });
        }
      }
    }

    return questions;
  }

  const state = {
    questions: [],
    selectedType: 'all',
    issueOnly: false,
    requiredFilter: 'all',
    auditFilter: 'all',
    pointsOperator: 'any',
    pointsValue: 0,
    query: '',
    highlightCorrect: false,
    panelCollapsed: true,
    observer: null,
    activeQuestionNumber: null,
    correctCache: new Map(),
    globalClickHandler: null,
    answerModels: [],
    answerModelsLoaded: false,
    answerModelLoading: null,
    answerModelUrl: '',
    answerApiStatus: 'idle',
    answerApiError: '',
    selectedQuestions: new Set(),
    bulkRunning: false,
    bulkCancelRequested: false,
    bulkStatus: 'حدد الأسئلة التي تريد تعديلها، ثم اختر العملية.',
    lastBulkUndo: [],
    lastBulkLabel: '',
    expectedStructureCount: null,
    structuralGuardUntil: 0
  };

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

  function issueCount(q) {
    return q.issues.filter(x => x.level !== 'info').length;
  }

  function formatPoints(n) {
    return Number.isInteger(n) ? String(n) : String(n);
  }

  function stats() {
    const q = state.questions;

    return {
      total: q.length,
      points: q.reduce((s, x) => s + Number(x.points || 0), 0),
      required: q.filter(x => x.required === true).length,
      issues: q.filter(x => issueCount(x) > 0).length,
      choice: q.filter(x => x.type === 'choice').length,
      multiple: q.filter(x => x.type === 'multiple').length,
      truefalse: q.filter(x => x.type === 'truefalse').length,
      text: q.filter(x => ['text', 'longtext'].includes(x.type)).length
    };
  }

  function hasIssueCode(q, code) {
    return q.issues?.some(issue => issue.code === code);
  }

  function duplicateTitleQuestionNumbers() {
    const groups = new Map();
    for (const q of state.questions) {
      const key = canonical(q.title);
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(q.number);
    }
    const result = new Set();
    for (const numbers of groups.values()) {
      if (numbers.length < 2) continue;
      numbers.forEach(number => result.add(number));
    }
    return result;
  }

  function pointsMatch(q) {
    const op = state.pointsOperator;
    if (!op || op === 'any') return true;
    const expected = Number(state.pointsValue);
    const actual = Number(q.points || 0);
    if (!Number.isFinite(expected)) return true;
    switch (op) {
      case '=': return actual === expected;
      case '!=': return actual !== expected;
      case '>': return actual > expected;
      case '>=': return actual >= expected;
      case '<': return actual < expected;
      case '<=': return actual <= expected;
      default: return true;
    }
  }

  function requiredMatch(q) {
    switch (state.requiredFilter) {
      case 'required': return q.required === true;
      case 'optional': return q.required === false;
      case 'unknown': return q.required == null;
      default: return true;
    }
  }

  function auditMatch(q, duplicateTitles) {
    switch (state.auditFilter) {
      case 'issues': return issueCount(q) > 0;
      case 'clean': return issueCount(q) === 0;
      case 'zero-points': return Number(q.points || 0) === 0;
      case 'missing-correct': return ['choice','multiple','truefalse'].includes(q.type) && q.correctKnown && q.correctIndexes.length === 0;
      case 'correct-known': return q.correctKnown && q.correctIndexes.length > 0;
      case 'duplicate-title': return duplicateTitles.has(q.number);
      case 'duplicate-option': return hasIssueCode(q, 'duplicate-option');
      case 'similar-title': return hasIssueCode(q, 'similar-title');
      case 'missing-title': return hasIssueCode(q, 'missing-title');
      default: return true;
    }
  }

  function filteredQuestions() {
    const query = canonical(state.query);
    const duplicateTitles = duplicateTitleQuestionNumbers();
    return state.questions.filter(q => {
      if (state.selectedType !== 'all' && q.type !== state.selectedType) {
        if (!(state.selectedType === 'text' && ['text','longtext'].includes(q.type))) return false;
      }
      if (state.issueOnly && issueCount(q) === 0) return false;
      if (!requiredMatch(q)) return false;
      if (!auditMatch(q, duplicateTitles)) return false;
      if (!pointsMatch(q)) return false;
      if (query) {
        const haystack = canonical(`${q.number} ${q.title} ${q.options.join(' ')} ${(q.correctAnswers || []).join(' ')}`);
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }

  function clearQuestionMarkers() {
    document
      .querySelectorAll('[data-m0hm3d85-question-focus]')
      .forEach(el => {
        el.removeAttribute('data-m0hm3d85-question-focus');
      });
  }

  function goToQuestion(number) {
    const q = state.questions.find(x => x.number === number);

    if (!q) return;

    clearQuestionMarkers();

    const target =
      q.designerCard ||
      q.wrapper;

    if (!target) return;

    target.setAttribute(
      'data-m0hm3d85-question-focus',
      'true'
    );

    target.scrollIntoView({
      block: 'center',
      behavior: 'smooth'
    });

    try {
      target.focus({ preventScroll: true });
    } catch {}

    setTimeout(() => {
      target.removeAttribute('data-m0hm3d85-question-focus');
    }, 2600);
  }

  function nextIssue(afterNumber = 0) {
    const withIssues = state.questions.filter(q => issueCount(q) > 0);

    if (!withIssues.length) return null;

    const next =
      withIssues.find(q => q.number > afterNumber) ||
      withIssues[0];

    goToQuestion(next.number);
    return next;
  }

  function getLiveCorrectButtons() {
    return [
      ...document.querySelectorAll(
        'button,[role="button"],[role="checkbox"]'
      )
    ].filter(el => {
      if (!visible(el)) return false;

      const label = clean(
        el.getAttribute('aria-label') ||
        el.getAttribute('title') ||
        ''
      );

      if (!/^(إجابة صحيحة|الإجابة الصحيحة|Correct answer)$/i.test(label)) {
        return false;
      }

      return el.hasAttribute('aria-pressed');
    });
  }

  function findLiveOptionRow(button) {
    if (!button) return null;

    let node = button.parentElement;
    const candidates = [];

    for (
      let depth = 0;
      node && depth < 9;
      depth++, node = node.parentElement
    ) {
      if (
        node.matches?.('[data-automation-id="formRoot"]') ||
        node.id === HOST_ID ||
        node.id === 'side-pane-container'
      ) {
        break;
      }

      if (!visible(node)) continue;

      const rect = node.getBoundingClientRect();
      const text = clean(node.innerText, 1200);

      const correctButtons = [
        ...node.querySelectorAll(
          'button,[role="button"],[role="checkbox"]'
        )
      ].filter(el => {
        const label = clean(
          el.getAttribute('aria-label') ||
          el.getAttribute('title') ||
          ''
        );
        return /^(إجابة صحيحة|الإجابة الصحيحة|Correct answer)$/i.test(label);
      });

      if (
        correctButtons.length === 1 &&
        rect.width >= 160 &&
        rect.height >= 28 &&
        rect.height <= 220
      ) {
        let score = 0;

        if (text && !/^(إجابة صحيحة|الإجابة الصحيحة|Correct answer)$/i.test(text)) {
          score += 6;
        }

        if (
          node.matches?.('[role="listitem"]') ||
          node.getAttribute?.('data-automation-id') ===
            'questionChoiceOptionContainer'
        ) {
          score += 12;
        }

        if (
          node.querySelector?.(
            '[role="textbox"],input[type="text"],textarea,[contenteditable="true"]'
          )
        ) {
          score += 8;
        }

        // Prefer smaller, closer containers once they contain the option text.
        score += Math.max(0, 8 - depth);
        score -= Math.min(rect.height / 100, 2);

        candidates.push({
          node,
          score,
          depth,
          text
        });
      }
    }

    candidates.sort((a, b) =>
      b.score - a.score ||
      a.depth - b.depth
    );

    return candidates[0]?.node || button.parentElement;
  }

  function resolveActiveQuestionNumber() {
    if (state.activeQuestionNumber) {
      return state.activeQuestionNumber;
    }

    const focusedWrapper =
      document.activeElement?.closest?.(
        '[data-automation-id="questionWrapper"]'
      );

    if (focusedWrapper) {
      return questionNumberFrom(focusedWrapper);
    }

    const wrappers = getWrappers();

    if (!wrappers.length) {
      return null;
    }

    const center = innerHeight / 2;

    return wrappers
      .map(el => {
        const r = el.getBoundingClientRect();

        return {
          number: questionNumberFrom(el),
          distance: Math.abs(
            (r.top + r.bottom) / 2 - center
          )
        };
      })
      .filter(x => x.number)
      .sort((a, b) => a.distance - b.distance)[0]
      ?.number || null;
  }

  function captureLiveCorrectState() {
    const buttons = getLiveCorrectButtons();

    if (buttons.length < 2) {
      return null;
    }

    const indexes = buttons
      .map((button, index) => ({
        index,
        selected:
          button.getAttribute('aria-pressed') === 'true'
      }))
      .filter(x => x.selected)
      .map(x => x.index);

    const number = resolveActiveQuestionNumber();

    if (number) {
      state.correctCache.set(number, {
        known: true,
        indexes: [...indexes],
        capturedAt: Date.now()
      });

      const q =
        state.questions.find(x =>
          x.number === number
        );

      if (q) {
        q.correctKnown = true;
        q.correctIndexes = [...indexes];
      }
    }

    return {
      number,
      buttons,
      indexes
    };
  }

  function clearCorrectHighlights() {
    document
      .querySelectorAll('[data-m0hm3d85-correct-option]')
      .forEach(el => {
        el.removeAttribute('data-m0hm3d85-correct-option');
      });

    document
      .querySelectorAll('[data-m0hm3d85-live-correct]')
      .forEach(el => {
        el.removeAttribute('data-m0hm3d85-live-correct');
      });
  }

  function applyCorrectHighlights() {
    clearCorrectHighlights();

    if (!state.highlightCorrect) return;

    /*
     * مصدر الحقيقة الذي أثبته فحص الصفحة:
     * aria-label="إجابة صحيحة" + aria-pressed="true"
     *
     * Forms يرسم أزرار الإجابة الصحيحة للسؤال الجاري تحريره،
     * لذلك نقرأ الحالة الحية ثم نخزنها للسؤال الذي تمت زيارته.
     */
    const live = captureLiveCorrectState();

    if (live?.buttons?.length) {
      live.buttons.forEach((button, index) => {
        if (
          button.getAttribute('aria-pressed') !== 'true'
        ) {
          return;
        }

        const row = findLiveOptionRow(button);

        if (row) {
          row.setAttribute(
            'data-m0hm3d85-correct-option',
            'true'
          );

          row.setAttribute(
            'data-m0hm3d85-live-correct',
            'true'
          );
        }
      });
    }

    /*
     * الأسئلة التي سبق فتحها يمكن إبراز الخيار الصحيح فيها
     * من الذاكرة حتى بعد انتقال المستخدم إلى سؤال آخر.
     */
    for (const q of state.questions) {
      const cached =
        state.correctCache.get(q.number);

      const indexes =
        cached?.known
          ? cached.indexes
          : (
              q.correctKnown
                ? q.correctIndexes
                : []
            );

      if (!indexes?.length) continue;

      indexes.forEach(index => {
        const row = q.optionElements[index];

        if (row) {
          row.setAttribute(
            'data-m0hm3d85-correct-option',
            'true'
          );
        }
      });
    }
  }


  function waitForValue(finder, timeout = 8000, interval = 100) {
    return new Promise(async (resolve, reject) => {
      const started = Date.now();

      while (Date.now() - started < timeout) {
        try {
          const value = finder();
          if (value) {
            resolve(value);
            return;
          }
        } catch {}

        await sleep(interval);
      }

      reject(new Error('انتهت مهلة انتظار عنصر Microsoft Forms.'));
    });
  }

  async function safeClick(el) {
    if (!el) {
      throw new Error('العنصر المطلوب غير موجود.');
    }

    el.scrollIntoView({
      block: 'center',
      inline: 'center',
      behavior: 'auto'
    });

    await sleep(80);

    try {
      el.focus({ preventScroll: true });
    } catch {}

    if (window.PointerEvent) {
      el.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerType: 'mouse'
      }));
    }

    el.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      view: window
    }));

    if (window.PointerEvent) {
      el.dispatchEvent(new PointerEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        pointerType: 'mouse'
      }));
    }

    el.dispatchEvent(new MouseEvent('mouseup', {
      bubbles: true,
      cancelable: true,
      view: window
    }));

    el.click();
    await sleep(300);
  }

  function wrapperByNumber(number) {
    /*
     * لا نستخدم visible() هنا.
     * Forms قد يخفي wrappers غير النشطة مؤقتًا أثناء تحرير سؤال،
     * لكنها تبقى في DOM ويمكن تفعيلها برمجيًا.
     */
    const wrappers = getAllWrappers();

    return (
      wrappers.find((wrapper, index) =>
        questionNumberFrom(wrapper, index + 1) === number
      ) ||
      null
    );
  }

  function liveQuestionTitleEditors() {
    return [
      ...document.querySelectorAll(
        '[role="textbox"],[contenteditable="true"],textarea,input'
      )
    ].filter(el => {
      if (!visible(el)) return false;
      if (el.closest?.(`#${HOST_ID}`)) return false;

      const label = labelOf(el);
      const text = clean(
        el.innerText ||
        el.textContent ||
        el.value ||
        ''
      );

      return (
        /عنوان السؤال|question title/i.test(label) ||
        text.length >= 3
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

  function titleMatchScore(question, el) {
    if (!question || !el) return 0;

    const a = canonical(question.title);
    const b = canonical(editorText(el));

    if (!a || !b) return 0;
    if (a === b) return 1;

    if (a.includes(b) || b.includes(a)) {
      const shorter = Math.min(a.length, b.length);
      const longer = Math.max(a.length, b.length);
      return 0.84 + (shorter / Math.max(longer, 1)) * 0.14;
    }

    return similarity(question.title, editorText(el));
  }

  function matchingTitleEditor(number) {
    const q =
      state.questions.find(x => x.number === number);

    if (!q) return null;

    const candidates =
      liveQuestionTitleEditors()
        .map(el => ({
          el,
          score: titleMatchScore(q, el),
          titleLabel:
            /عنوان السؤال|question title/i.test(labelOf(el))
        }))
        .sort((a, b) =>
          (Number(b.titleLabel) - Number(a.titleLabel)) ||
          (b.score - a.score)
        );

    const exact =
      candidates.find(x =>
        x.score >= 0.88
      );

    if (exact) return exact.el;

    const labeled =
      candidates.find(x =>
        x.titleLabel &&
        x.score >= 0.56
      );

    return labeled?.el || null;
  }

  function livePointsInputGlobal() {
    const candidates = [
      ...document.querySelectorAll('input')
    ].filter(el =>
      visible(el) &&
      !el.closest?.(`#${HOST_ID}`) &&
      /^(النقاط|Points)$/i.test(labelOf(el))
    );

    return candidates[0] || null;
  }

  function liveRequiredSwitchGlobal() {
    const candidates = [
      ...document.querySelectorAll(
        '[role="switch"],[aria-label]'
      )
    ].filter(el =>
      visible(el) &&
      !el.closest?.(`#${HOST_ID}`) &&
      /^(مطلوب|Required)$/i.test(labelOf(el))
    );

    return candidates[0] || null;
  }

  function editorEvidence(number) {
    const titleEditor =
      matchingTitleEditor(number);

    if (!titleEditor) {
      return null;
    }

    return {
      number,
      titleEditor,
      pointsInput:
        livePointsInputGlobal(),
      requiredSwitch:
        liveRequiredSwitchGlobal()
    };
  }

  async function clickQuestionWrapper(number) {
    const wrapper =
      wrapperByNumber(number);

    if (!wrapper) {
      throw new Error(
        `لم أجد questionWrapper للسؤال ${number}.`
      );
    }

    try {
      wrapper.scrollIntoView({
        block: 'center',
        inline: 'nearest',
        behavior: 'auto'
      });
    } catch {}

    await sleep(120);

    /*
     * استخدام click() واحد فقط.
     * safeClick() مناسب لعناصر كثيرة، لكن questionWrapper في Forms
     * زر React، وإرسال عدة mouse/pointer events قد يسبب تبديلًا مزدوجًا.
     */
    try {
      wrapper.focus({
        preventScroll: true
      });
    } catch {}

    wrapper.click();

    return wrapper;
  }

  async function activateQuestionEditor(number) {
    state.activeQuestionNumber =
      number;

    /*
     * إذا كان السؤال نفسه مفتوحًا أصلًا فلا نضغط عليه مجددًا.
     */
    let evidence =
      editorEvidence(number);

    if (evidence) {
      return evidence;
    }

    await clickQuestionWrapper(number);

    evidence = await waitForValue(
      () => editorEvidence(number),
      9000,
      100
    );

    console.log(
      `🟢 تم فتح السؤال ${number} والتحقق من عنوانه قبل التعديل.`
    );

    await sleep(220);

    return evidence;
  }

  function assertActiveEditor(number) {
    const evidence =
      editorEvidence(number);

    if (!evidence) {
      throw new Error(
        `لم أتمكن من التحقق أن السؤال ${number} هو السؤال المفتوح حاليًا. أوقفت الكتابة لحماية النموذج.`
      );
    }

    return evidence;
  }

  function livePointsInput(cardIgnored = null) {
    return livePointsInputGlobal();
  }

  function liveRequiredSwitch(cardIgnored = null) {
    return liveRequiredSwitchGlobal();
  }

  function setNativeInputValue(input, value) {
    const proto =
      input instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;

    const setter = Object.getOwnPropertyDescriptor(
      proto,
      'value'
    )?.set;

    if (setter) {
      setter.call(input, String(value));
    } else {
      input.value = String(value);
    }

    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.blur();
  }

  async function readLiveQuestionFields(number, patch = {}) {
    await activateQuestionEditor(number);

    const evidence =
      assertActiveEditor(number);

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
      const pointsInput =
        await waitForValue(
          () => {
            assertActiveEditor(number);
            return livePointsInputGlobal();
          },
          7000,
          100
        );

      result.points =
        parseNumber(
          pointsInput.value,
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
          () => {
            assertActiveEditor(number);
            return liveRequiredSwitchGlobal();
          },
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

  async function setQuestionFields(number, patch) {
    await activateQuestionEditor(number);

    assertActiveEditor(number);

    if (
      Object.prototype.hasOwnProperty.call(
        patch,
        'points'
      )
    ) {
      let input =
        await waitForValue(
          () => {
            assertActiveEditor(number);
            return livePointsInputGlobal();
          },
          7000,
          100
        );

      input.focus();
      setNativeInputValue(
        input,
        patch.points
      );

      await sleep(700);

      assertActiveEditor(number);

      input =
        livePointsInputGlobal() ||
        input;

      const after =
        parseNumber(
          input.value,
          NaN
        );

      if (
        !Number.isFinite(after) ||
        Math.abs(
          after -
          Number(patch.points)
        ) > 0.0001
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
      assertActiveEditor(number);

      let req =
        await waitForValue(
          () => {
            assertActiveEditor(number);
            return liveRequiredSwitchGlobal();
          },
          7000,
          100
        );

      const current =
        req.getAttribute(
          'aria-checked'
        ) === 'true';

      if (
        current !==
        Boolean(patch.required)
      ) {
        /*
         * السويتش نفسه يمكن النقر عليه مرة واحدة بأمان.
         */
        req.click();
        await sleep(650);

        assertActiveEditor(number);

        req =
          liveRequiredSwitchGlobal() ||
          req;
      }

      const after =
        req.getAttribute(
          'aria-checked'
        ) === 'true';

      if (
        after !==
        Boolean(patch.required)
      ) {
        throw new Error(
          `تعذر ضبط حالة «مطلوب» للسؤال ${number}.`
        );
      }
    }

    /*
     * مهلة حفظ قبل فتح السؤال التالي.
     */
    await sleep(420);
  }

  function questionClipboardText(q) {
    const lines = [];

    lines.push(`${q.number}. ${q.title || `السؤال ${q.number}`}`);

    if (q.options?.length) {
      q.options.forEach((option, index) => {
        const isCorrect =
          q.correctIndexes?.includes(index);

        lines.push(
          `${isCorrect ? '✓' : '○'} ${index + 1}) ${option}`
        );
      });
    }

    if (
      q.correctAnswers?.length
    ) {
      lines.push(
        `الإجابة الصحيحة: ${q.correctAnswers.join(' + ')}`
      );
    }

    lines.push(
      `النوع: ${typeLabel(q.type)}`
    );

    lines.push(
      `الدرجة: ${formatPoints(q.points)}`
    );

    if (q.required != null) {
      lines.push(
        `الحالة: ${q.required ? 'مطلوب' : 'غير مطلوب'}`
      );
    }

    return lines.join('\n');
  }

  async function writeClipboard(textValue) {
    const value =
      String(textValue ?? '');

    if (
      navigator.clipboard?.writeText
    ) {
      try {
        await navigator.clipboard.writeText(value);
        return true;
      } catch {}
    }

    const ta =
      document.createElement('textarea');

    ta.value =
      value;

    ta.setAttribute(
      'readonly',
      ''
    );

    ta.style.position =
      'fixed';

    ta.style.opacity =
      '0';

    ta.style.pointerEvents =
      'none';

    document.body.appendChild(ta);
    ta.select();

    let ok = false;

    try {
      ok =
        document.execCommand('copy');
    } catch {}

    ta.remove();

    return ok;
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

    const textValue =
      targets
        .map(questionClipboardText)
        .join('\n\n──────────\n\n');

    const ok =
      await writeClipboard(textValue);

    state.bulkStatus =
      ok
        ? `تم نسخ ${targets.length} سؤالًا إلى الحافظة مع الخيارات والإجابات والدرجات.`
        : 'تعذر النسخ إلى الحافظة في هذا المتصفح.';

    renderBulkState();

    return ok;
  }

  function nativeActionMeta(el) {
    return clean(
      [
        el?.getAttribute?.('aria-label'),
        el?.getAttribute?.('title'),
        el?.getAttribute?.('data-automation-id'),
        el?.getAttribute?.('data-testid'),
        el?.innerText,
        el?.textContent
      ]
        .filter(Boolean)
        .join(' ')
    );
  }

  function isDuplicateActionText(textValue) {
    const s =
      clean(textValue);

    return (
      /^(?:تكرار|تكرار السؤال|نسخ السؤال|Duplicate|Duplicate question|Copy question)$/i.test(s) ||
      /(?:questionDuplicate|duplicateQuestion|copyQuestion|questionCopy)/i.test(s)
    );
  }

  function isDeleteActionText(textValue) {
    const s =
      clean(textValue);

    return (
      /^(?:حذف السؤال|Delete question|Remove question)$/i.test(s) ||
      /(?:questionDelete|deleteQuestion|removeQuestion)/i.test(s)
    );
  }

  function closestEditorDistance(button, titleEditor) {
    if (!button || !titleEditor) {
      return Number.POSITIVE_INFINITY;
    }

    const a =
      button.getBoundingClientRect();

    const b =
      titleEditor.getBoundingClientRect();

    const ax =
      (a.left + a.right) / 2;

    const ay =
      (a.top + a.bottom) / 2;

    const bx =
      (b.left + b.right) / 2;

    const by =
      (b.top + b.bottom) / 2;

    return Math.hypot(
      ax - bx,
      ay - by
    );
  }

  function findNativeQuestionAction(number, kind, evidence = null) {
    const liveEvidence =
      evidence ||
      editorEvidence(number);

    if (
      !liveEvidence?.titleEditor ||
      !liveEvidence.titleEditor.isConnected
    ) {
      return null;
    }

    const matcher =
      kind === 'delete'
        ? isDeleteActionText
        : isDuplicateActionText;

    const candidates = [
      ...document.querySelectorAll(
        'button,[role="button"],[role="menuitem"]'
      )
    ]
      .filter(el =>
        visible(el) &&
        !el.closest?.(`#${HOST_ID}`)
      )
      .map(el => ({
        el,
        meta:
          nativeActionMeta(el),
        distance:
          closestEditorDistance(
            el,
            liveEvidence.titleEditor
          )
      }))
      .filter(item =>
        matcher(item.meta)
      )
      .sort((a, b) =>
        a.distance - b.distance
      );

    return (
      candidates[0]?.el ||
      null
    );
  }

  async function findNativeQuestionActionAfterMenu(
    number,
    kind,
    evidence = null
  ) {
    let liveEvidence =
      evidence ||
      editorEvidence(number);

    if (!liveEvidence) {
      return null;
    }

    let action =
      findNativeQuestionAction(
        number,
        kind,
        liveEvidence
      );

    if (action) {
      return action;
    }

    const menuCandidates = [
      ...document.querySelectorAll(
        'button,[role="button"]'
      )
    ]
      .filter(el =>
        visible(el) &&
        !el.closest?.(`#${HOST_ID}`)
      )
      .map(el => ({
        el,
        meta:
          nativeActionMeta(el),
        distance:
          closestEditorDistance(
            el,
            liveEvidence.titleEditor
          )
      }))
      .filter(item =>
        /^(?:المزيد|مزيد من الخيارات|خيارات إضافية|More|More options|Other options)$/i.test(item.meta) ||
        /(?:questionMore|moreQuestion|questionMenu|moreOptions)/i.test(item.meta)
      )
      .sort((a, b) =>
        a.distance - b.distance
      );

    const menuButton =
      menuCandidates[0]?.el;

    if (!menuButton) {
      return null;
    }

    menuButton.click();
    await sleep(180);

    /*
     * القائمة قد تعيد بناء محرر السؤال؛ نحاول استخدام المحرر
     * الحالي إن كان موجودًا بدل فرض assert جديد فوري.
     */
    liveEvidence =
      editorEvidence(number) ||
      liveEvidence;

    action =
      findNativeQuestionAction(
        number,
        kind,
        liveEvidence
      );

    return action;
  }

  function nativeActionMatcher(kind) {
    return kind === 'delete'
      ? isDeleteActionText
      : isDuplicateActionText;
  }

  function visibleNativeActionCandidates(kind) {
    const matcher =
      nativeActionMatcher(kind);

    return [
      ...document.querySelectorAll(
        'button,[role="button"],[role="menuitem"]'
      )
    ]
      .filter(el =>
        visible(el) &&
        !el.closest?.(`#${HOST_ID}`) &&
        matcher(nativeActionMeta(el))
      );
  }

  function missingWrapperQuestionNumbers() {
    return state.questions
      .filter(q =>
        !wrapperByNumber(q.number)
      )
      .map(q => q.number);
  }

  function canUseUniqueActiveActionFallback(number) {
    const missing =
      missingWrapperQuestionNumbers();

    return (
      missing.length === 1 &&
      missing[0] === number
    );
  }

  async function tryRecoverMissingWrapper(number) {
    if (wrapperByNumber(number)) {
      return wrapperByNumber(number);
    }

    /*
     * Forms أحيانًا لا يرسم آخر questionWrapper بعد سلسلة
     * من النسخ/الحذف إلا بعد الوصول لأسفل النموذج.
     */
    try {
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: 'auto'
      });
    } catch {}

    try {
      getFormRoot()?.scrollTo?.({
        top: getFormRoot().scrollHeight,
        behavior: 'auto'
      });
    } catch {}

    await sleep(500);

    return wrapperByNumber(number);
  }

  async function prepareNativeQuestionAction(
    number,
    kind,
    attempts = 3
  ) {
    let lastError =
      null;

    for (
      let attempt = 1;
      attempt <= attempts;
      attempt++
    ) {
      try {
        let evidence =
          editorEvidence(number);

        /*
         * الحالة الطبيعية: لدينا wrapper أو محرر مطابق.
         */
        if (!evidence) {
          let wrapper =
            wrapperByNumber(number);

          if (!wrapper) {
            wrapper =
              await tryRecoverMissingWrapper(number);
          }

          if (wrapper) {
            evidence =
              await activateQuestionEditor(number);
          }
        }

        if (evidence) {
          const action =
            await findNativeQuestionActionAfterMenu(
              number,
              kind,
              evidence
            );

          if (
            action &&
            action.isConnected &&
            visible(action)
          ) {
            console.log(
              `🧭 [v${VERSION}] ${kind === 'delete' ? 'حذف' : 'تكرار'} السؤال ${number}:`,
              {
                ariaLabel:
                  action.getAttribute('aria-label') || '',
                title:
                  action.getAttribute('title') || '',
                automationId:
                  action.getAttribute('data-automation-id') || '',
                text:
                  clean(action.innerText || action.textContent || '')
              }
            );

            return {
              evidence,
              action,
              fallback: false
            };
          }
        }

        /*
         * حالة Forms الخاصة:
         * السؤال النشط قد يكون هو السؤال الوحيد الذي لا يملك
         * questionWrapper. إذا كان كذلك، وكان في الصفحة زر أصلي واحد
         * فقط من نوع العملية، فمن الآمن اعتباره زر السؤال النشط.
         *
         * هذا يعالج تحديدًا حالة آخر سؤال بعد التكرار:
         * DOM=15 / API=16، والسؤال 16 هو الوحيد بلا wrapper.
         */
        if (
          canUseUniqueActiveActionFallback(number)
        ) {
          const candidates =
            visibleNativeActionCandidates(kind);

          if (candidates.length === 1) {
            const action =
              candidates[0];

            console.log(
              `🧭 [v${VERSION}] استخدمت زر ${kind === 'delete' ? 'الحذف' : 'التكرار'} الوحيد للسؤال النشط ${number} رغم غياب questionWrapper.`,
              {
                ariaLabel:
                  action.getAttribute('aria-label') || '',
                title:
                  action.getAttribute('title') || '',
                automationId:
                  action.getAttribute('data-automation-id') || '',
                text:
                  clean(action.innerText || action.textContent || '')
              }
            );

            return {
              evidence: null,
              action,
              fallback: true
            };
          }
        }

        throw new Error(
          `لم أجد زر ${kind === 'delete' ? 'الحذف' : 'التكرار'} الأصلي بأمان للسؤال ${number}.`
        );
      } catch (error) {
        lastError =
          error;

        console.warn(
          `محاولة ${attempt}/${attempts} لتهيئة السؤال ${number} لم تنجح:`,
          error
        );

        await sleep(
          350 + attempt * 180
        );
      }
    }

    throw (
      lastError ||
      new Error(
        `تعذر تهيئة السؤال ${number}.`
      )
    );
  }

  function isDeleteConfirmText(value = '') {
    const s =
      clean(value);

    return /^(?:نعم|Yes|موافق|OK|حذف|Delete|تأكيد|Confirm)$/i.test(s);
  }

  function isDeletePromptContainer(el) {
    if (!el) return false;

    const textValue =
      clean(
        el.innerText ||
        el.textContent ||
        ''
      );

    return (
      /حذف|Delete|إزالة|Remove/i.test(textValue) &&
      /سؤال|question|هذا|this|متأكد|sure|تأكيد|confirm/i.test(textValue)
    );
  }

  function getNativeDeleteConfirmButtons() {
    return [
      ...document.querySelectorAll(
        'button,[role="button"],[role="menuitem"]'
      )
    ].filter(el => {
      if (!visible(el)) return false;
      if (el.closest?.(`#${HOST_ID}`)) return false;

      const aria =
        clean(
          el.getAttribute('aria-label') ||
          ''
        );

      const title =
        clean(
          el.getAttribute('title') ||
          ''
        );

      const textValue =
        clean(
          el.innerText ||
          el.textContent ||
          ''
        );

      return (
        isDeleteConfirmText(aria) ||
        isDeleteConfirmText(title) ||
        isDeleteConfirmText(textValue)
      );
    });
  }

  function deletePromptAncestors(el) {
    const result = [];

    let node =
      el?.parentElement || null;

    for (
      let depth = 0;
      node && depth < 9;
      depth++, node = node.parentElement
    ) {
      if (
        node.matches?.(
          '[role="dialog"],[role="alertdialog"],[role="menu"],[role="presentation"]'
        ) ||
        isDeletePromptContainer(node)
      ) {
        result.push(node);
      }
    }

    return result;
  }

  async function confirmNativeDeletePrompt(
    beforeButtons = new Set(),
    originalAction = null,
    timeout = 3200
  ) {
    const started =
      Date.now();

    while (
      Date.now() - started < timeout
    ) {
      const allCandidates =
        getNativeDeleteConfirmButtons()
          .filter(el =>
            el !== originalAction
          );

      /*
       * أعلى أولوية:
       * زر جديد ظهر بعد ضغط "حذف السؤال".
       */
      const newCandidates =
        allCandidates.filter(el =>
          !beforeButtons.has(el)
        );

      /*
       * ثاني أولوية:
       * أي زر "نعم/حذف/تأكيد" موجود داخل نافذة حذف حقيقية.
       * هذا يغطي الحالات التي يعيد فيها React استخدام نفس node.
       */
      const promptCandidates =
        allCandidates.filter(el =>
          deletePromptAncestors(el).length > 0
        );

      const candidates =
        newCandidates.length
          ? newCandidates
          : promptCandidates;

      if (candidates.length) {
        const scored =
          candidates
            .map(el => {
              const aria =
                clean(
                  el.getAttribute('aria-label') ||
                  ''
                );

              const title =
                clean(
                  el.getAttribute('title') ||
                  ''
                );

              const textValue =
                clean(
                  el.innerText ||
                  el.textContent ||
                  ''
                );

              let score = 0;

              /*
               * في واجهة المستخدم التي ظهرت عند الاختبار،
               * الزر المتكرر للمستخدم كان "نعم".
               * نعطي "نعم/Yes" الأولوية القصوى.
               */
              if (
                /^(?:نعم|Yes)$/i.test(
                  aria || title || textValue
                )
              ) {
                score += 40;
              }

              if (
                /^(?:حذف|Delete)$/i.test(
                  aria || title || textValue
                )
              ) {
                score += 30;
              }

              if (
                /^(?:تأكيد|Confirm|موافق|OK)$/i.test(
                  aria || title || textValue
                )
              ) {
                score += 20;
              }

              if (
                el.closest?.(
                  '[role="alertdialog"]'
                )
              ) {
                score += 18;
              } else if (
                el.closest?.(
                  '[role="dialog"]'
                )
              ) {
                score += 15;
              }

              if (
                deletePromptAncestors(el).length
              ) {
                score += 12;
              }

              if (
                !beforeButtons.has(el)
              ) {
                score += 8;
              }

              return {
                el,
                score,
                aria,
                title,
                textValue
              };
            })
            .sort((a, b) =>
              b.score - a.score
            );

        const best =
          scored[0];

        if (best) {
          console.log(
            `🧾 [v${VERSION}] تأكيد Forms التلقائي:`,
            {
              ariaLabel: best.aria,
              title: best.title,
              text: best.textValue,
              score: best.score
            }
          );

          await safeClick(
            best.el
          );

          return true;
        }
      }

      await sleep(90);
    }

    return false;
  }

  async function confirmNativeDeleteDialog() {
    const candidates =
      getNativeDeleteConfirmButtons()
        .filter(el =>
          deletePromptAncestors(el).length > 0
        );

    if (!candidates.length) {
      return false;
    }

    const button =
      candidates.find(el =>
        /^(?:نعم|Yes)$/i.test(
          clean(
            el.getAttribute('aria-label') ||
            el.getAttribute('title') ||
            el.innerText ||
            el.textContent ||
            ''
          )
        )
      ) ||
      candidates[0];

    await safeClick(
      button
    );

    return true;
  }

  function liveStructuralQuestionCount() {
    const wrappers =
      getAllWrappers().filter(el =>
        el.isConnected
      );

    /*
     * أثناء تحرير سؤال، Forms في هذه الواجهة يزيل questionWrapper
     * الخاص بالسؤال النشط ويعرض محرر العنوان بدلًا منه.
     * لذلك نحسب المحرر الحي كسؤال إضافي إذا كان موجودًا.
     */
    const hasLiveEditor =
      liveQuestionTitleEditors().length > 0;

    return (
      wrappers.length +
      (hasLiveEditor ? 1 : 0)
    );
  }

  async function waitForStructuralDelta(
    beforeCount,
    delta,
    timeout = 7000
  ) {
    const expected =
      beforeCount + delta;

    const started =
      Date.now();

    let last =
      liveStructuralQuestionCount();

    while (
      Date.now() - started < timeout
    ) {
      last =
        liveStructuralQuestionCount();

      if (
        delta > 0 &&
        last >= expected
      ) {
        return {
          before: beforeCount,
          after: last,
          expected
        };
      }

      if (
        delta < 0 &&
        last <= expected
      ) {
        return {
          before: beforeCount,
          after: last,
          expected
        };
      }

      await sleep(120);
    }

    throw new Error(
      `لم يتغير عدد الأسئلة كما هو متوقع: قبل=${beforeCount}، الآن=${last}، المتوقع=${expected}.`
    );
  }

  function beginStructuralGuard(expectedCount) {
    state.expectedStructureCount =
      expectedCount;

    state.structuralGuardUntil =
      Date.now() + 12000;
  }

  async function duplicateQuestion(
    number,
    expectedBefore
  ) {
    /*
     * قبل الضغط نتأكد أن الخادم نفسه وصل إلى الحالة المتوقعة.
     * هذا يمنع بدء العملية التالية بينما حفظ العملية السابقة لم يكتمل.
     */
    await waitForApiQuestionCount(
      expectedBefore,
      15000,
      450
    );

    const prepared =
      await prepareNativeQuestionAction(
        number,
        'duplicate'
      );

    prepared.action.click();

    const verified =
      await waitForApiQuestionCount(
        expectedBefore + 1,
        15000,
        450
      );

    console.log(
      `📄 [v${VERSION}] تم تكرار السؤال ${number} والتحقق من API: ${expectedBefore} ← ${verified.count}.`
    );

    await sleep(250);

    return {
      before: expectedBefore,
      after: verified.count,
      source: 'forms-api'
    };
  }

  async function deleteQuestion(
    number,
    expectedBefore
  ) {
    await waitForApiQuestionCount(
      expectedBefore,
      15000,
      450
    );

    const prepared =
      await prepareNativeQuestionAction(
        number,
        'delete'
      );

    const beforeConfirmButtons =
      new Set(
        getNativeDeleteConfirmButtons()
      );

    /*
     * الحذف في Forms يحتاج محاكاة تفاعل كاملة أكثر من النسخ
     * في بعض الحالات؛ لذلك نستخدم safeClick بدل element.click().
     */
    await safeClick(
      prepared.action
    );

    /*
     * إذا فتح Forms نافذة/Popover تأكيد، ابحث عن زر "حذف" الجديد
     * تحديدًا واضغطه. v0.5.3 كان يبحث داخل role=dialog فقط،
     * ولذلك كان يفوّت تأكيدًا يُعرض بهيكل مختلف.
     */
    const confirmed =
      await confirmNativeDeletePrompt(
        beforeConfirmButtons,
        prepared.action,
        2600
      );

    if (confirmed) {
      console.log(
        `🧾 [v${VERSION}] تم تأكيد الحذف الأصلي للسؤال ${number}.`
      );
    } else {
      console.log(
        `ℹ️ [v${VERSION}] لم يظهر تأكيد إضافي من Forms لهذا السؤال؛ المتابعة مباشرة إلى تحقق API.`
      );
    }

    const verified =
      await waitForApiQuestionCount(
        expectedBefore - 1,
        18000,
        450
      );

    console.log(
      `🗑️ [v${VERSION}] تم حذف السؤال ${number} والتحقق من API: ${expectedBefore} ← ${verified.count}.`
    );

    await sleep(250);

    return {
      before: expectedBefore,
      after: verified.count,
      source: 'forms-api'
    };
  }

  async function runBulkDuplicate() {
    if (state.bulkRunning) return;

    const targets =
      selectedQuestionObjects()
        .sort((a, b) =>
          b.number - a.number
        );

    if (!targets.length) {
      state.bulkStatus =
        'حدد سؤالًا واحدًا على الأقل للتكرار.';
      renderBulkState();
      return;
    }

    const rows =
      targets.map(q => ({
        number: q.number,
        title: q.title,
        change: 'إنشاء نسخة جديدة بعد السؤال'
      }));

    const approved =
      await showBulkPreview(
        'تكرار الأسئلة المحددة',
        rows,
        `تكرار ${targets.length} سؤالًا`
      );

    if (!approved) {
      return;
    }

    state.bulkRunning = true;
    state.bulkCancelRequested = false;
    state.bulkStatus =
      'جارٍ مزامنة عدد الأسئلة مع Forms قبل التكرار...';
    renderBulkState();

    let baseline;

    try {
      const fresh =
        await getFreshApiCount();

      baseline =
        fresh.count;

      state.answerModels =
        fresh.models;

      /*
       * إذا كان UI يرى عددًا مختلفًا عن الخادم، لا نبدأ عملية بنيوية.
       * بعد إصلاح de-dup يجب أن يتساويا في الحالة المستقرة.
       */
      if (
        baseline !== state.questions.length
      ) {
        throw new Error(
          `عدد الأسئلة غير متزامن قبل التكرار: الواجهة=${state.questions.length} / Forms API=${baseline}. اضغط «تحديث الفحص» وانتظر اكتمال الحفظ ثم أعد المحاولة.`
        );
      }
    } catch (error) {
      state.bulkRunning =
        false;

      state.bulkStatus =
        `لم يبدأ التكرار: ${String(error?.message || error)}`;

      renderBulkState();

      console.warn(
        'أُلغي التكرار قبل أي تعديل:',
        error
      );

      return;
    }

    beginStructuralGuard(
      baseline + targets.length
    );

    let completed = 0;
    let failed = 0;

    for (
      let i = 0;
      i < targets.length;
      i++
    ) {
      if (state.bulkCancelRequested) {
        break;
      }

      const q =
        targets[i];

      const expectedBefore =
        baseline + completed;

      state.bulkStatus =
        `جاري تكرار السؤال ${q.number} (${i + 1}/${targets.length}) — العدد الحالي ${expectedBefore}...`;

      renderBulkState();

      try {
        await duplicateQuestion(
          q.number,
          expectedBefore
        );

        completed++;

        state.expectedStructureCount =
          baseline + completed;

        console.log(
          `✅ [v${VERSION}] تم تكرار السؤال ${q.number} فعليًا (${completed}/${targets.length})`
        );
      } catch (error) {
        failed++;

        console.warn(
          `تعذر التحقق من تكرار السؤال ${q.number}:`,
          error
        );

        state.bulkStatus =
          `توقف التكرار عند السؤال ${q.number}: ${String(error?.message || error)}`;

        renderBulkState();
        break;
      }
    }

    state.bulkRunning = false;
    state.bulkCancelRequested = false;
    state.selectedQuestions.clear();

    state.expectedStructureCount =
      baseline + completed;

    state.structuralGuardUntil =
      Date.now() + 2500;

    state.bulkStatus =
      `انتهى التكرار الموثق من Forms API: ${completed} من ${targets.length}${failed ? '، وتوقف عند أول عملية غير مؤكدة' : ''}. العدد الآن: ${state.expectedStructureCount}.`;

    await sleep(500);

    /*
     * بعد التكرار نجلب الـAPI الجديد أولًا، ثم نفحص DOM.
     * هذا مهم للأسئلة المتطابقة فعليًا.
     */
    try {
      await loadAnswerModels(true);
    } catch {}

    refresh();
    renderBulkState();
  }

  async function runBulkDelete() {
    if (state.bulkRunning) return;

    const targets =
      selectedQuestionObjects()
        .sort((a, b) =>
          b.number - a.number
        );

    if (!targets.length) {
      state.bulkStatus =
        'حدد سؤالًا واحدًا على الأقل للحذف.';
      renderBulkState();
      return;
    }

    const rows =
      targets.map(q => ({
        number: q.number,
        title: q.title,
        change: 'حذف نهائي من النموذج'
      }));

    const approved =
      await showBulkPreview(
        '⚠ حذف الأسئلة المحددة',
        rows,
        `نعم، حذف ${targets.length} سؤالًا`
      );

    /*
     * هذه هي الموافقة الوحيدة المطلوبة من المستخدم.
     * بعد الضغط عليها، أي رسائل تأكيد فردية يفرضها Microsoft Forms
     * أثناء المرور على الأسئلة يتم التعامل معها تلقائيًا.
     */

    if (!approved) {
      return;
    }

    state.bulkRunning = true;
    state.bulkCancelRequested = false;
    state.bulkStatus =
      'جارٍ مزامنة عدد الأسئلة مع Forms قبل الحذف الجماعي...';

    renderBulkState();

    let baseline;

    try {
      const fresh =
        await getFreshApiCount();

      baseline =
        fresh.count;

      state.answerModels =
        fresh.models;

      if (
        baseline !== state.questions.length
      ) {
        throw new Error(
          `عدد الأسئلة غير متزامن قبل الحذف: الواجهة=${state.questions.length} / Forms API=${baseline}. لم يتم حذف أي سؤال.`
        );
      }

      if (
        targets.length >= baseline
      ) {
        /*
         * لا نفترض أن Forms يسمح بنموذج بلا سؤال.
         * نتطلب أن يبقى سؤال واحد على الأقل في هذه النسخة التجريبية.
         */
        throw new Error(
          'للحماية: لا يمكن حذف جميع أسئلة النموذج دفعة واحدة. اترك سؤالًا واحدًا على الأقل.'
        );
      }
    } catch (error) {
      state.bulkRunning =
        false;

      state.bulkStatus =
        `لم يبدأ الحذف: ${String(error?.message || error)}`;

      renderBulkState();

      console.warn(
        'أُلغي الحذف قبل أي تعديل:',
        error
      );

      return;
    }

    beginStructuralGuard(
      Math.max(
        0,
        baseline - targets.length
      )
    );

    let completed = 0;
    let failed = 0;

    /*
     * الحذف تنازليًا يبقي أرقام الأسئلة الأقل ثابتة.
     */
    for (
      let i = 0;
      i < targets.length;
      i++
    ) {
      if (state.bulkCancelRequested) {
        break;
      }

      const q =
        targets[i];

      const expectedBefore =
        baseline - completed;

      state.bulkStatus =
        `جاري حذف السؤال ${q.number} (${i + 1}/${targets.length}) — العدد الحالي ${expectedBefore}...`;

      renderBulkState();

      try {
        await deleteQuestion(
          q.number,
          expectedBefore
        );

        completed++;

        state.expectedStructureCount =
          Math.max(
            0,
            baseline - completed
          );

        console.log(
          `✅ [v${VERSION}] تم حذف السؤال ${q.number} فعليًا (${completed}/${targets.length})`
        );
      } catch (error) {
        failed++;

        console.warn(
          `تعذر التحقق من حذف السؤال ${q.number}:`,
          error
        );

        state.bulkStatus =
          `أوقفت الحذف عند السؤال ${q.number} للحماية: ${String(error?.message || error)}`;

        renderBulkState();
        break;
      }
    }

    state.bulkRunning = false;
    state.bulkCancelRequested = false;
    state.selectedQuestions.clear();

    state.expectedStructureCount =
      Math.max(
        0,
        baseline - completed
      );

    state.structuralGuardUntil =
      Date.now() + 2500;

    state.bulkStatus =
      `انتهى الحذف الموثق من Forms API: ${completed} من ${targets.length}${failed ? '، وتوقف عند أول عملية غير مؤكدة' : ''}. العدد الآن: ${state.expectedStructureCount}.`;

    await sleep(500);

    try {
      await loadAnswerModels(true);
    } catch {}

    /*
     * لا نعيد Snapshot قديمًا بعد الحذف.
     * نبدأ من DOM الحالي ثم يربطه API المحدث.
     */
    state.questions =
      buildAudit(
        scanQuestions()
      );

    mergeAnswerModelsIntoQuestions();
    buildAudit(state.questions);

    refresh();
    renderBulkState();
  }


  function selectedQuestionObjects() {
    return [...state.selectedQuestions]
      .sort((a, b) => a - b)
      .map(number => state.questions.find(q => q.number === number))
      .filter(Boolean);
  }

  function smartRuleLabel(rule) {
    return ({
      visible: 'النتائج الظاهرة', all: 'جميع الأسئلة', issues: 'تحتاج مراجعة',
      'zero-points': 'الدرجة صفر', 'missing-correct': 'بدون إجابة صحيحة', optional: 'غير مطلوب',
      'duplicate-title': 'عنوان مكرر', 'duplicate-option': 'خيار مكرر', choice: 'اختيار',
      multiple: 'متعدد', truefalse: 'صح/خطأ', text: 'نصي'
    })[rule] || rule;
  }

  function selectQuestionsByRule(rule) {
    const duplicates = duplicateTitleQuestionNumbers();
    let matches = [];
    switch (rule) {
      case 'visible': matches = filteredQuestions(); break;
      case 'all': matches = state.questions; break;
      case 'issues': matches = state.questions.filter(q => issueCount(q) > 0); break;
      case 'zero-points': matches = state.questions.filter(q => Number(q.points || 0) === 0); break;
      case 'missing-correct': matches = state.questions.filter(q => ['choice','multiple','truefalse'].includes(q.type) && q.correctKnown && q.correctIndexes.length === 0); break;
      case 'optional': matches = state.questions.filter(q => q.required === false); break;
      case 'duplicate-title': matches = state.questions.filter(q => duplicates.has(q.number)); break;
      case 'duplicate-option': matches = state.questions.filter(q => hasIssueCode(q, 'duplicate-option')); break;
      case 'choice': matches = state.questions.filter(q => q.type === 'choice'); break;
      case 'multiple': matches = state.questions.filter(q => q.type === 'multiple'); break;
      case 'truefalse': matches = state.questions.filter(q => q.type === 'truefalse'); break;
      case 'text': matches = state.questions.filter(q => ['text','longtext'].includes(q.type)); break;
    }
    matches.forEach(q => state.selectedQuestions.add(q.number));
    state.bulkStatus = matches.length ? `تم تحديد ${matches.length} سؤالًا وفق «${smartRuleLabel(rule)}».` : `لا توجد أسئلة تطابق «${smartRuleLabel(rule)}».`;
    renderResults();
    return matches.map(q => q.number);
  }

  function renderBulkState() {
    const host = document.getElementById(HOST_ID);
    if (!host) return;

    const selected = selectedQuestionObjects();
    const countEl = host.querySelector('.mfe-selected-count');
    const statusEl = host.querySelector('.mfe-bulk-status');
    const undoBtn = host.querySelector('[data-action="bulk-undo"]');
    const stopBtn = host.querySelector('[data-action="bulk-stop"]');

    if (countEl) {
      countEl.textContent = `${selected.length} محدد`;
    }

    if (statusEl) {
      statusEl.textContent = state.bulkStatus;
      statusEl.classList.toggle('running', state.bulkRunning);
    }

    if (undoBtn) {
      undoBtn.disabled = state.bulkRunning || !state.lastBulkUndo.length;
      undoBtn.title = state.lastBulkLabel
        ? `التراجع عن: ${state.lastBulkLabel}`
        : '';
    }

    if (stopBtn) {
      stopBtn.hidden = !state.bulkRunning;
    }

    host.querySelectorAll('.mfe-bulk-actions button:not([data-action="bulk-stop"])')
      .forEach(btn => {
        if (btn.dataset.action === 'bulk-undo') {
          return;
        }
        btn.disabled = state.bulkRunning;
      });

    host.querySelectorAll('.mfe-select-question')
      .forEach(input => {
        input.checked = state.selectedQuestions.has(
          Number(input.dataset.question)
        );
        input.disabled = state.bulkRunning;
      });
  }

  function operationPreviewRows(targets, patch) {
    return targets.map(q => {
      const parts = [];

      if (Object.prototype.hasOwnProperty.call(patch, 'points')) {
        parts.push(`الدرجة: ${formatPoints(q.points)} ← ${formatPoints(patch.points)}`);
      }

      if (Object.prototype.hasOwnProperty.call(patch, 'required')) {
        const from = q.required === true
          ? 'مطلوب'
          : q.required === false
            ? 'غير مطلوب'
            : 'غير معروف';
        const to = patch.required ? 'مطلوب' : 'غير مطلوب';
        parts.push(`الحالة: ${from} ← ${to}`);
      }

      return {
        number: q.number,
        title: q.title,
        change: parts.join(' • ')
      };
    });
  }

  function showBulkPreview(title, rows, confirmLabel = 'تنفيذ التغيير') {
    const host = document.getElementById(HOST_ID);
    if (!host) return Promise.resolve(false);

    const modal = host.querySelector('.mfe-modal');
    const titleEl = modal.querySelector('.mfe-modal-title');
    const summaryEl = modal.querySelector('.mfe-modal-summary');
    const listEl = modal.querySelector('.mfe-modal-list');
    const confirmBtn = modal.querySelector('[data-modal="confirm"]');
    const cancelBtn = modal.querySelector('[data-modal="cancel"]');

    titleEl.textContent = title;
    summaryEl.textContent =
      /^⚠\s*حذف/.test(title)
        ? `سيتم حذف ${rows.length} سؤالًا محددًا. هذه هي رسالة التأكيد الوحيدة؛ بعد الموافقة سيكمل المحسن الحذف تلقائيًا دون طلب تأكيد منك لكل سؤال.`
        : `سيتم تعديل ${rows.length} سؤالًا. لن يتم لمس أي سؤال غير محدد.`;
    confirmBtn.textContent = confirmLabel;

    const visibleRows = rows.slice(0, 14);
    listEl.innerHTML = visibleRows.map(row => `
      <div class="mfe-modal-row">
        <b>${row.number}</b>
        <span>${html(row.title)}</span>
        <small>${html(row.change)}</small>
      </div>
    `).join('') + (
      rows.length > visibleRows.length
        ? `<div class="mfe-modal-more">+ ${rows.length - visibleRows.length} سؤال إضافي</div>`
        : ''
    );

    modal.hidden = false;

    return new Promise(resolve => {
      const finish = value => {
        modal.hidden = true;
        confirmBtn.onclick = null;
        cancelBtn.onclick = null;
        resolve(value);
      };

      confirmBtn.onclick = () => finish(true);
      cancelBtn.onclick = () => finish(false);
    });
  }

  async function runBulkPatch(patch, label) {
    if (state.bulkRunning) return;

    const targets = selectedQuestionObjects();

    if (!targets.length) {
      state.bulkStatus = 'حدد سؤالًا واحدًا على الأقل أولًا.';
      renderBulkState();
      return;
    }

    const preview = operationPreviewRows(targets, patch);
    const approved = await showBulkPreview(
      label,
      preview,
      `تطبيق على ${targets.length} سؤالًا`
    );

    if (!approved) return;

    state.bulkRunning = true;
    state.bulkCancelRequested = false;
    state.lastBulkUndo = [];
    state.lastBulkLabel = label;
    renderBulkState();

    const undo = [];
    let completed = 0;
    let failed = 0;

    for (let i = 0; i < targets.length; i++) {
      if (state.bulkCancelRequested) break;

      const q = targets[i];
      state.bulkStatus = `جاري تعديل السؤال ${q.number} (${i + 1}/${targets.length})...`;
      renderBulkState();

      try {
        const before = await readLiveQuestionFields(q.number, patch);
        const undoPatch = {};

        if (Object.prototype.hasOwnProperty.call(patch, 'points')) {
          undoPatch.points = before.points;
        }

        if (Object.prototype.hasOwnProperty.call(patch, 'required')) {
          if (before.required == null) {
            throw new Error('لم أتمكن من قراءة حالة «مطلوب» الحالية.');
          }
          undoPatch.required = before.required;
        }

        await setQuestionFields(q.number, patch);

        undo.push({
          number: q.number,
          patch: undoPatch,
          title: q.title
        });

        if (Object.prototype.hasOwnProperty.call(patch, 'points')) {
          q.points = Number(patch.points);

          /*
           * answerModels ما زالت نسخة الذاكرة السابقة حتى إعادة جلب API.
           * نحدّث المرجع المرتبط حتى لا يعيد refresh الدرجة القديمة مؤقتًا.
           */
          if (q.apiModel) {
            q.apiModel.points =
              Number(patch.points);
          }
        }

        if (Object.prototype.hasOwnProperty.call(patch, 'required')) {
          q.required = Boolean(patch.required);
        }

        completed++;

        console.log(
          `✅ تم تعديل السؤال ${q.number} (${completed}/${targets.length})`
        );
      } catch (error) {
        failed++;
        console.warn(`تعذر تعديل السؤال ${q.number}:`, error);

        state.bulkStatus =
          `تعذر السؤال ${q.number}: ${String(error?.message || error)}`;
        renderBulkState();
      }
    }

    state.lastBulkUndo = undo;
    state.bulkRunning = false;

    const stopped = state.bulkCancelRequested;
    state.bulkCancelRequested = false;

    state.bulkStatus = stopped
      ? `تم إيقاف العملية. نُفذ التغيير على ${completed} سؤالًا${failed ? `، وتعذر ${failed}` : ''}. يمكنك التراجع عن المنفذ.`
      : `اكتملت العملية فعليًا: ${completed} من ${targets.length} سؤالًا${failed ? `، وتعذر تعديل ${failed}` : ''}.`;

    refresh();
    renderBulkState();

    // Refresh model data after Forms finishes saving the edits.
    setTimeout(() => {
      loadAnswerModels(true);
    }, 900);
  }

  async function runBulkUndo() {
    if (state.bulkRunning || !state.lastBulkUndo.length) return;

    const items = [...state.lastBulkUndo];
    const rows = items.map(item => ({
      number: item.number,
      title: item.title,
      change: [
        Object.prototype.hasOwnProperty.call(item.patch, 'points')
          ? `إرجاع الدرجة إلى ${formatPoints(item.patch.points)}`
          : '',
        Object.prototype.hasOwnProperty.call(item.patch, 'required')
          ? `إرجاع الحالة إلى ${item.patch.required ? 'مطلوب' : 'غير مطلوب'}`
          : ''
      ].filter(Boolean).join(' • ')
    }));

    const approved = await showBulkPreview(
      'التراجع عن آخر عملية جماعية',
      rows,
      `استرجاع ${items.length} سؤالًا`
    );

    if (!approved) return;

    state.bulkRunning = true;
    state.bulkCancelRequested = false;
    renderBulkState();

    let completed = 0;
    let failed = 0;

    for (let i = 0; i < items.length; i++) {
      if (state.bulkCancelRequested) break;

      const item = items[i];
      state.bulkStatus = `جاري الاسترجاع للسؤال ${item.number} (${i + 1}/${items.length})...`;
      renderBulkState();

      try {
        await setQuestionFields(item.number, item.patch);

        const q =
          state.questions.find(x =>
            x.number === item.number
          );

        if (q) {
          if (
            Object.prototype.hasOwnProperty.call(
              item.patch,
              'points'
            )
          ) {
            q.points =
              Number(item.patch.points);

            if (q.apiModel) {
              q.apiModel.points =
                Number(item.patch.points);
            }
          }

          if (
            Object.prototype.hasOwnProperty.call(
              item.patch,
              'required'
            )
          ) {
            q.required =
              Boolean(item.patch.required);
          }
        }

        completed++;
      } catch (error) {
        failed++;
        console.warn(`تعذر استرجاع السؤال ${item.number}:`, error);
      }
    }

    state.bulkRunning = false;
    state.bulkCancelRequested = false;
    state.lastBulkUndo = [];
    state.lastBulkLabel = '';
    state.bulkStatus = `انتهى التراجع: ${completed} سؤالًا${failed ? `، وتعذر ${failed}` : ''}.`;

    refresh();
    renderBulkState();

    setTimeout(() => {
      loadAnswerModels(true);
    }, 900);
  }

  function makeHost() {
    const host = document.createElement('section');
    host.id = HOST_ID;
    host.dir = 'rtl';
    host.classList.add('mfe-collapsed');

    host.innerHTML = `
      <div class="mfe-head">
        <div>
          <div class="mfe-brand">
            <span class="mfe-logo">F</span>
            <div>
              <strong>أدوات محرر Microsoft Forms</strong>
              <span>بحث · فلاتر ذكية · تدقيق · تعديل · نسخ · تكرار · حذف</span>
            </div>
          </div>
        </div>

        <div class="mfe-head-actions">
          <button type="button" class="mfe-outline" data-action="question-bank">بنك الأسئلة</button>
          <button type="button" data-action="refresh">تحديث الفحص</button>
          <button type="button" class="mfe-collapse" data-action="collapse" title="فتح/طي">⌄</button>
        </div>
      </div>

      <div class="mfe-body">
        <div class="mfe-stats"></div>

        <div class="mfe-controls">
          <div class="mfe-search-wrap">
            <span>⌕</span>
            <input type="search" class="mfe-search" placeholder="ابحث في العنوان أو الخيارات أو الإجابة الصحيحة..." autocomplete="off">
          </div>
          <select class="mfe-type" aria-label="نوع السؤال">
            <option value="all">جميع الأنواع</option><option value="choice">اختيار</option><option value="multiple">متعدد</option><option value="truefalse">صح/خطأ</option><option value="text">نصي</option>
          </select>
          <select class="mfe-required-filter" aria-label="حالة مطلوب">
            <option value="all">كل الحالات</option><option value="required">مطلوب</option><option value="optional">غير مطلوب</option><option value="unknown">غير معروف</option>
          </select>
          <select class="mfe-audit-filter" aria-label="فلتر التدقيق">
            <option value="all">كل نتائج التدقيق</option><option value="issues">يحتاج مراجعة</option><option value="clean">بدون مشاكل</option><option value="zero-points">الدرجة صفر</option><option value="missing-correct">بدون إجابة صحيحة</option><option value="correct-known">له إجابة صحيحة</option><option value="duplicate-title">عنوان مكرر</option><option value="duplicate-option">خيار مكرر</option><option value="similar-title">عنوان متشابه</option><option value="missing-title">عنوان فارغ</option>
          </select>
          <div class="mfe-points-filter">
            <select class="mfe-points-op" aria-label="مقارنة الدرجة"><option value="any">أي درجة</option><option value="=">=</option><option value="!=">≠</option><option value=">">&gt;</option><option value=">=">≥</option><option value="<">&lt;</option><option value="<=">≤</option></select>
            <input type="number" class="mfe-points-filter-value" value="0" step="0.5" min="0" aria-label="قيمة الدرجة">
          </div>
          <label class="mfe-check"><input type="checkbox" class="mfe-highlight-correct"> إظهار الإجابة الصحيحة</label>
          <button type="button" data-action="next-issue" class="mfe-outline">المشكلة التالية</button>
        </div>

        <div class="mfe-api-status">
          سيحاول المحسن قراءة مفاتيح الإجابات من تعريف Forms تلقائيًا.
        </div>

        <div class="mfe-bulk">
          <div class="mfe-bulk-head">
            <div>
              <strong>التعديل الجماعي الآمن</strong>
              <span class="mfe-selected-count">0 محدد</span>
            </div>

            <div class="mfe-bulk-select-actions">
              <select class="mfe-smart-select" aria-label="تحديد ذكي">
                <option value="">تحديد ذكي...</option><option value="visible">النتائج الظاهرة</option><option value="all">جميع الأسئلة</option><option value="issues">تحتاج مراجعة</option><option value="zero-points">الدرجة صفر</option><option value="missing-correct">بدون إجابة صحيحة</option><option value="optional">غير مطلوب</option><option value="duplicate-title">عنوان مكرر</option><option value="duplicate-option">خيار مكرر</option><option value="choice">اختيار</option><option value="multiple">متعدد</option><option value="truefalse">صح/خطأ</option><option value="text">نصي</option>
              </select>
              <button type="button" class="mfe-outline" data-action="select-visible">تحديد الظاهر</button>
              <button type="button" class="mfe-outline" data-action="invert-selection">عكس التحديد</button>
              <button type="button" class="mfe-outline" data-action="clear-selection">إلغاء التحديد</button>
            </div>
          </div>

          <div class="mfe-bulk-actions">
            <label class="mfe-points-field">
              <span>الدرجة</span>
              <input type="number" class="mfe-bulk-points" min="0" step="0.5" value="1">
            </label>

            <button type="button" data-action="bulk-points">تعيين الدرجة</button>
            <button type="button" data-action="bulk-required-on">جعلها مطلوبة</button>
            <button type="button" class="mfe-outline" data-action="bulk-required-off">جعلها غير مطلوبة</button>

            <span class="mfe-action-separator" aria-hidden="true"></span>

            <button type="button" class="mfe-outline" data-action="bulk-copy">نسخ المحدد</button>
            <button type="button" class="mfe-outline" data-action="bulk-duplicate">تكرار المحدد</button>
            <button type="button" class="mfe-danger" data-action="bulk-delete">حذف المحدد</button>

            <button type="button" class="mfe-outline" data-action="bulk-undo" disabled>↶ تراجع آخر عملية</button>
            <button type="button" class="mfe-stop" data-action="bulk-stop" hidden>إيقاف</button>
          </div>

          <div class="mfe-bulk-status">حدد الأسئلة التي تريد تعديلها، ثم اختر العملية.</div>
        </div>

        <div class="mfe-audit-note"></div>

        <div class="mfe-results-head">
          <strong class="mfe-result-count">0 نتيجة</strong>
          <span>اضغط على أي سؤال للانتقال إليه</span>
        </div>

        <div class="mfe-results"></div>

        <div class="mfe-footer">
          <span>
            تصميم وتطوير:
            <strong>Mohammed Almalki (M0HM3D85)</strong>
          </span>
          <span>v${VERSION}</span>
        </div>
      </div>

      <div class="mfe-modal" hidden>
        <div class="mfe-modal-card" role="dialog" aria-modal="true">
          <strong class="mfe-modal-title">مراجعة التغييرات</strong>
          <p class="mfe-modal-summary"></p>
          <div class="mfe-modal-list"></div>
          <div class="mfe-modal-actions">
            <button type="button" data-modal="confirm">تنفيذ التغيير</button>
            <button type="button" class="mfe-outline" data-modal="cancel">إلغاء</button>
          </div>
        </div>
      </div>
    `;

    return host;
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;

    style.textContent = `
      #${HOST_ID} {
        --mfe-primary: #007874;
        --mfe-secondary: #00A39E;
        --mfe-bg: #FFFFFF;
        --mfe-soft: #F2FBFA;
        --mfe-soft-2: #FAFBFB;
        --mfe-border: #E5E7EB;
        --mfe-text: #1F2937;
        --mfe-muted: #6B7280;
        --mfe-error: #B42318;
        --mfe-warning: #B54708;

        box-sizing: border-box;
        width: min(1180px, calc(100% - 32px));
        margin: 14px auto 18px;
        border: 1px solid var(--mfe-border);
        border-radius: 12px;
        background: var(--mfe-bg);
        color: var(--mfe-text);
        font-family: "Segoe UI", Tahoma, Arial, sans-serif;
        box-shadow: 0 1px 2px rgba(0,0,0,.04);
        overflow: hidden;
        position: relative;
        z-index: 2;
      }

      #${HOST_ID},
      #${HOST_ID} * {
        box-sizing: border-box;
      }

      #${HOST_ID} button,
      #${HOST_ID} input,
      #${HOST_ID} select {
        font: inherit;
      }

      #${HOST_ID} .mfe-head {
        min-height: 58px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        padding: 10px 14px;
        border-bottom: 1px solid var(--mfe-border);
        background: #fff;
      }

      #${HOST_ID} .mfe-brand {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      #${HOST_ID} .mfe-logo {
        width: 34px;
        height: 34px;
        border-radius: 9px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, var(--mfe-primary), var(--mfe-secondary));
        color: #fff;
        font-weight: 800;
        font-size: 18px;
        flex: 0 0 auto;
      }

      #${HOST_ID} .mfe-brand strong {
        display: block;
        font-size: 14px;
        line-height: 1.4;
      }

      #${HOST_ID} .mfe-brand span:not(.mfe-logo) {
        display: block;
        margin-top: 2px;
        color: var(--mfe-muted);
        font-size: 11px;
      }

      #${HOST_ID} .mfe-head-actions {
        display: flex;
        align-items: center;
        gap: 7px;
      }

      #${HOST_ID} button {
        border: 1px solid transparent;
        border-radius: 8px;
        padding: 7px 11px;
        background: var(--mfe-primary);
        color: #fff;
        cursor: pointer;
        transition: background .15s ease, border-color .15s ease, transform .15s ease;
      }

      #${HOST_ID} button:hover {
        background: #006b68;
      }

      #${HOST_ID} button:active {
        transform: translateY(1px);
      }

      #${HOST_ID} .mfe-outline,
      #${HOST_ID} .mfe-collapse {
        background: #fff;
        border-color: var(--mfe-primary);
        color: var(--mfe-primary);
      }

      #${HOST_ID} .mfe-outline:hover,
      #${HOST_ID} .mfe-collapse:hover {
        background: var(--mfe-soft);
      }

      #${HOST_ID} .mfe-collapse {
        width: 34px;
        height: 34px;
        padding: 0;
        font-size: 18px;
      }

      #${HOST_ID} .mfe-body {
        padding: 12px 14px 9px;
      }

      #${HOST_ID}.mfe-collapsed .mfe-body {
        display: none;
      }

      #${HOST_ID}.mfe-collapsed .mfe-head {
        border-bottom: 0;
      }

      #${HOST_ID} .mfe-stats {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px 14px;
        padding: 2px 0 10px;
        color: var(--mfe-muted);
        font-size: 12px;
      }

      #${HOST_ID} .mfe-stat {
        display: inline-flex;
        align-items: baseline;
        gap: 5px;
      }

      #${HOST_ID} .mfe-stat b {
        color: var(--mfe-text);
        font-size: 15px;
      }

      #${HOST_ID} .mfe-stat.issue b {
        color: var(--mfe-error);
      }

      #${HOST_ID} .mfe-controls {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
        width: 100%;
        min-width: 0;
      }

      #${HOST_ID} .mfe-controls > * { min-width: 0; }

      #${HOST_ID} .mfe-search-wrap {
        flex: 1 1 300px;
        min-width: 220px;
        height: 38px;
        border: 1px solid #D1D5DB;
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 7px;
        padding: 0 10px;
        background: #fff;
      }

      #${HOST_ID} .mfe-search-wrap:focus-within {
        border-color: var(--mfe-primary);
        box-shadow: 0 0 0 2px rgba(0,120,116,.12);
      }

      #${HOST_ID} .mfe-search-wrap > span {
        color: var(--mfe-muted);
        font-size: 18px;
      }

      #${HOST_ID} .mfe-search {
        width: 100%;
        min-width: 0;
        border: 0;
        outline: 0;
        background: transparent;
        color: var(--mfe-text);
      }

      #${HOST_ID} .mfe-type {
        height: 38px;
        border: 1px solid #D1D5DB;
        border-radius: 8px;
        padding: 0 8px;
        background: #fff;
        color: var(--mfe-text);
        outline: none;
      }

      #${HOST_ID} .mfe-type:focus {
        border-color: var(--mfe-primary);
        box-shadow: 0 0 0 2px rgba(0,120,116,.12);
      }

      #${HOST_ID} .mfe-required-filter,
      #${HOST_ID} .mfe-audit-filter,
      #${HOST_ID} .mfe-smart-select,
      #${HOST_ID} .mfe-points-op {
        height: 38px;
        border: 1px solid #D1D5DB;
        border-radius: 8px;
        padding: 0 8px;
        background: #fff;
        color: var(--mfe-text);
        outline: none;
      }
      #${HOST_ID} .mfe-type { flex: 0 1 125px; width:125px; }
      #${HOST_ID} .mfe-required-filter { flex:0 1 125px; width:125px; }
      #${HOST_ID} .mfe-audit-filter { flex:0 1 160px; width:160px; }
      #${HOST_ID} .mfe-points-filter { flex:0 1 155px; min-width:145px; max-width:180px; height:38px; display:grid; grid-template-columns:minmax(78px,1fr) minmax(54px,.72fr); gap:5px; }
      #${HOST_ID} .mfe-points-filter-value { min-width:0; width:100%; border:1px solid #D1D5DB; border-radius:8px; padding:0 7px; background:#fff; color:var(--mfe-text); }
      #${HOST_ID} .mfe-smart-select { height:32px; min-width:145px; font-size:10.5px; }
      #${HOST_ID} .mfe-required-filter:focus,
      #${HOST_ID} .mfe-audit-filter:focus,
      #${HOST_ID} .mfe-smart-select:focus,
      #${HOST_ID} .mfe-points-op:focus,
      #${HOST_ID} .mfe-points-filter-value:focus { border-color:var(--mfe-primary); box-shadow:0 0 0 2px rgba(0,120,116,.12); outline:none; }

      #${HOST_ID} .mfe-check {
        min-height: 38px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 0 5px;
        color: var(--mfe-text);
        font-size: 12px;
        white-space: nowrap;
        cursor: pointer;
      }

      #${HOST_ID} .mfe-check input {
        accent-color: var(--mfe-primary);
      }

      #${HOST_ID} .mfe-api-status {
        margin-top: 9px;
        padding: 8px 10px;
        border-radius: 8px;
        border: 1px solid var(--mfe-border);
        background: #FAFBFB;
        color: var(--mfe-muted);
        font-size: 11px;
        line-height: 1.55;
      }

      #${HOST_ID} .mfe-api-status.loading {
        background: #F8FAFC;
        color: #475569;
      }

      #${HOST_ID} .mfe-api-status.ready {
        background: #ECFDF3;
        border-color: #ABEFC6;
        color: #067647;
        font-weight: 600;
      }

      #${HOST_ID} .mfe-api-status.warn {
        background: #FFF7ED;
        border-color: #FED7AA;
        color: #B54708;
      }

      #${HOST_ID} .mfe-api-status.error {
        background: #FEF3F2;
        border-color: #FECDCA;
        color: #B42318;
      }

      #${HOST_ID} .mfe-audit-note {
        margin-top: 9px;
        padding: 8px 10px;
        border-radius: 8px;
        background: var(--mfe-soft-2);
        border: 1px solid var(--mfe-border);
        color: var(--mfe-muted);
        font-size: 11px;
        line-height: 1.6;
      }

      #${HOST_ID} .mfe-audit-note.ok {
        background: var(--mfe-soft);
        color: #0F5C59;
      }

      #${HOST_ID} .mfe-results-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 11px 2px 7px;
        color: var(--mfe-muted);
        font-size: 11px;
      }

      #${HOST_ID} .mfe-results-head strong {
        color: var(--mfe-text);
        font-size: 12px;
      }

      #${HOST_ID} .mfe-results {
        max-height: 310px;
        overflow: auto;
        border: 1px solid var(--mfe-border);
        border-radius: 9px;
        background: #fff;
      }

      #${HOST_ID} .mfe-result {
        width: 100%;
        display: grid;
        grid-template-columns: 26px 44px minmax(0, 1fr) auto;
        align-items: center;
        gap: 9px;
        padding: 9px 10px;
        border: 0;
        border-bottom: 1px solid #F0F1F2;
        border-radius: 0;
        background: #fff;
        color: var(--mfe-text);
        text-align: right;
      }

      #${HOST_ID} .mfe-result:last-child {
        border-bottom: 0;
      }

      #${HOST_ID} .mfe-result:hover {
        background: var(--mfe-soft-2);
      }

      #${HOST_ID} .mfe-number {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: var(--mfe-soft);
        color: var(--mfe-primary);
        font-weight: 800;
      }

      #${HOST_ID} .mfe-result-title {
        min-width: 0;
      }

      #${HOST_ID} .mfe-result-title strong {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 12px;
      }

      #${HOST_ID} .mfe-result-title small {
        display: block;
        margin-top: 3px;
        color: var(--mfe-muted);
        font-size: 10px;
      }

      #${HOST_ID} .mfe-correct-answer {
        display: block;
        margin-top: 5px;
        color: #067647;
        font-size: 10.5px;
        font-weight: 700;
        white-space: normal;
        line-height: 1.5;
      }

      #${HOST_ID} .mfe-correct-answer::before {
        content: "✓";
        display: inline-block;
        margin-left: 5px;
        color: #067647;
        font-weight: 900;
      }

      #${HOST_ID} .mfe-badges {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 5px;
        flex-wrap: wrap;
      }

      #${HOST_ID} .mfe-badge {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 3px 7px;
        background: #F3F4F6;
        color: #4B5563;
        font-size: 9.5px;
        white-space: nowrap;
      }

      #${HOST_ID} .mfe-badge.warn {
        background: #FFF7ED;
        color: var(--mfe-warning);
      }

      #${HOST_ID} .mfe-badge.error {
        background: #FEF3F2;
        color: var(--mfe-error);
      }

      #${HOST_ID} .mfe-empty {
        padding: 30px 16px;
        text-align: center;
        color: var(--mfe-muted);
        font-size: 12px;
      }

      #${HOST_ID} .mfe-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding-top: 8px;
        color: #8A8F98;
        font-size: 9.5px;
      }

      #${HOST_ID} .mfe-footer strong {
        color: #667078;
      }

      [data-m0hm3d85-question-focus="true"] {
        outline: 3px solid rgba(0,163,158,.42) !important;
        outline-offset: 4px !important;
        border-radius: 10px !important;
      }

      [data-m0hm3d85-correct-option="true"] {
        position: relative !important;
        border-radius: 10px !important;
        background: rgba(0,163,158,.13) !important;
        box-shadow:
          inset 0 0 0 2px #007874,
          0 0 0 3px rgba(0,163,158,.10) !important;
        outline: none !important;
        overflow: visible !important;
      }

      [data-m0hm3d85-correct-option="true"]::after {
        content: "✓ الإجابة الصحيحة";
        position: absolute !important;
        top: -13px !important;
        right: 12px !important;
        z-index: 2147483000 !important;
        display: inline-flex !important;
        align-items: center !important;
        min-height: 24px !important;
        padding: 3px 9px !important;
        border-radius: 999px !important;
        background: #007874 !important;
        color: #fff !important;
        font-family: "Segoe UI", Tahoma, Arial, sans-serif !important;
        font-size: 11px !important;
        font-weight: 700 !important;
        line-height: 1.2 !important;
        white-space: nowrap !important;
        box-shadow: 0 2px 6px rgba(0,0,0,.16) !important;
        pointer-events: none !important;
      }

      [data-m0hm3d85-live-correct="true"] {
        animation: m0hm3d85CorrectPulse .45s ease-out 1;
      }

      @keyframes m0hm3d85CorrectPulse {
        from {
          box-shadow:
            inset 0 0 0 2px #007874,
            0 0 0 8px rgba(0,163,158,.22);
        }
        to {
          box-shadow:
            inset 0 0 0 2px #007874,
            0 0 0 3px rgba(0,163,158,.10);
        }
      }


      #${HOST_ID} .mfe-bulk {
        margin-top: 9px;
        padding: 10px;
        border: 1px solid #CFE8E6;
        border-radius: 10px;
        background: #F8FCFC;
      }

      #${HOST_ID} .mfe-bulk-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 8px;
      }

      #${HOST_ID} .mfe-bulk-head > div:first-child {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      #${HOST_ID} .mfe-bulk-head strong {
        font-size: 12px;
      }

      #${HOST_ID} .mfe-selected-count {
        display: inline-flex;
        align-items: center;
        min-height: 23px;
        padding: 2px 8px;
        border-radius: 999px;
        background: #E8F7F5;
        color: var(--mfe-primary);
        font-size: 10px;
        font-weight: 700;
      }

      #${HOST_ID} .mfe-bulk-select-actions,
      #${HOST_ID} .mfe-bulk-actions {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
        max-width: 100%;
        min-width: 0;
      }

      #${HOST_ID} .mfe-bulk-select-actions button,
      #${HOST_ID} .mfe-bulk-actions button {
        padding: 6px 9px;
        font-size: 10.5px;
      }

      #${HOST_ID} .mfe-points-field {
        min-height: 34px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 0 8px;
        border: 1px solid #D1D5DB;
        border-radius: 8px;
        background: #fff;
        font-size: 10.5px;
      }

      #${HOST_ID} .mfe-points-field input {
        width: 62px;
        border: 0;
        outline: 0;
        background: transparent;
        color: var(--mfe-text);
      }

      #${HOST_ID} .mfe-bulk-status {
        margin-top: 8px;
        color: var(--mfe-muted);
        font-size: 10.5px;
        line-height: 1.6;
      }

      #${HOST_ID} .mfe-bulk-status.running {
        color: var(--mfe-primary);
        font-weight: 700;
      }

      #${HOST_ID} .mfe-stop {
        background: #B42318;
      }

      #${HOST_ID} .mfe-danger {
        background: #B42318;
        border-color: #B42318;
        color: #fff;
      }

      #${HOST_ID} .mfe-danger:hover {
        background: #912018;
      }

      #${HOST_ID} .mfe-action-separator {
        width: 1px;
        height: 25px;
        margin: 0 2px;
        background: #D7E4E3;
        flex: 0 0 auto;
      }

      #${HOST_ID} button:disabled {
        opacity: .45;
        cursor: not-allowed;
        transform: none !important;
      }

      #${HOST_ID} .mfe-select-cell {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 32px;
      }

      #${HOST_ID} .mfe-select-question {
        width: 16px;
        height: 16px;
        accent-color: var(--mfe-primary);
        cursor: pointer;
      }

      #${HOST_ID} .mfe-result {
        cursor: pointer;
      }

      #${HOST_ID} .mfe-result.selected {
        background: #F2FBFA;
        box-shadow: inset -3px 0 0 var(--mfe-primary);
      }

      #${HOST_ID} .mfe-modal[hidden] {
        display: none !important;
      }

      #${HOST_ID} .mfe-modal {
        position: fixed;
        inset: 0;
        z-index: 2147483000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 18px;
        background: rgba(17,24,39,.38);
      }

      #${HOST_ID} .mfe-modal-card {
        width: min(620px, calc(100vw - 32px));
        max-height: min(720px, calc(100vh - 40px));
        overflow: auto;
        padding: 16px;
        border-radius: 12px;
        background: #fff;
        box-shadow: 0 18px 48px rgba(0,0,0,.22);
      }

      #${HOST_ID} .mfe-modal-title {
        display: block;
        font-size: 15px;
        color: var(--mfe-text);
      }

      #${HOST_ID} .mfe-modal-summary {
        margin: 6px 0 12px;
        color: var(--mfe-muted);
        font-size: 11px;
      }

      #${HOST_ID} .mfe-modal-list {
        border: 1px solid var(--mfe-border);
        border-radius: 9px;
        overflow: hidden;
      }

      #${HOST_ID} .mfe-modal-row {
        display: grid;
        grid-template-columns: 34px minmax(0, 1fr);
        gap: 2px 8px;
        padding: 8px 10px;
        border-bottom: 1px solid #F0F1F2;
      }

      #${HOST_ID} .mfe-modal-row:last-child {
        border-bottom: 0;
      }

      #${HOST_ID} .mfe-modal-row b {
        grid-row: 1 / span 2;
        color: var(--mfe-primary);
      }

      #${HOST_ID} .mfe-modal-row span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 11px;
      }

      #${HOST_ID} .mfe-modal-row small {
        color: var(--mfe-primary);
        font-size: 10px;
      }

      #${HOST_ID} .mfe-modal-more {
        padding: 8px 10px;
        background: var(--mfe-soft-2);
        color: var(--mfe-muted);
        font-size: 10px;
        text-align: center;
      }

      #${HOST_ID} .mfe-modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 7px;
        margin-top: 12px;
      }

      @media (max-width: 900px) {
        #${HOST_ID} .mfe-controls {
          grid-template-columns: 1fr 140px;
        }

        #${HOST_ID} .mfe-result {
          grid-template-columns: 26px 38px minmax(0, 1fr);
        }

        #${HOST_ID} .mfe-badges {
          grid-column: 3;
          justify-content: flex-start;
        }
      }

      @media (max-width: 900px) {
        #${HOST_ID} .mfe-search-wrap { flex-basis:100%; min-width:100%; }
        #${HOST_ID} .mfe-type, #${HOST_ID} .mfe-required-filter, #${HOST_ID} .mfe-audit-filter { flex:1 1 135px; width:auto; }
        #${HOST_ID} .mfe-points-filter { flex:1 1 155px; max-width:none; grid-template-columns:1fr 1fr; }
      }
      @media (max-width: 620px) {
        #${HOST_ID} { width:calc(100% - 16px); margin-inline:8px; }
        #${HOST_ID} .mfe-type, #${HOST_ID} .mfe-required-filter, #${HOST_ID} .mfe-audit-filter, #${HOST_ID} .mfe-points-filter, #${HOST_ID} .mfe-check, #${HOST_ID} .mfe-controls > button { flex:1 1 100%; width:100%; max-width:none; }
        #${HOST_ID} .mfe-bulk-head { align-items:flex-start; flex-direction:column; }
        #${HOST_ID} .mfe-bulk-select-actions, #${HOST_ID} .mfe-bulk-actions { width:100%; }
      }
    `;

    document.head.appendChild(style);
  }

  function mount() {
    injectStyles();

    const host = makeHost();

    const titleContainer =
      document.querySelector('[data-automation-id="formTitleContainer"]') ||
      document.querySelector('#form-title-container');

    if (titleContainer?.parentElement) {
      titleContainer.parentElement.insertBefore(
        host,
        titleContainer
      );
    } else {
      const formRoot = getFormRoot();
      formRoot.insertBefore(
        host,
        formRoot.firstChild
      );
    }

    bindEvents(host);

    return host;
  }


  function renderApiStatus() {
    const host =
      document.getElementById(HOST_ID);

    if (!host) return;

    const el =
      host.querySelector(
        '.mfe-api-status'
      );

    if (!el) return;

    const status =
      state.answerApiStatus;

    if (status === 'loading') {
      el.className =
        'mfe-api-status loading';
      el.textContent =
        'جارٍ قراءة مفاتيح الإجابات من تعريف Forms...';
      return;
    }

    if (status === 'ready') {
      const answered =
        state.questions.filter(q =>
          q.answerSource === 'forms-api' &&
          q.correctKnown
        ).length;

      el.className =
        'mfe-api-status ready';
      el.textContent =
        `✓ تم ربط تعريف Forms — الإجابة الصحيحة متاحة من الخارج لـ ${answered} سؤالًا.`;
      return;
    }

    if (status === 'endpoint-missing') {
      el.className =
        'mfe-api-status warn';
      el.textContent =
        'لم يظهر طلب تعريف الأسئلة في Resource Timing بعد. جرّب زر «تحديث الفحص» بعد اكتمال تحميل الصفحة.';
      return;
    }

    if (status === 'empty') {
      el.className =
        'mfe-api-status warn';
      el.textContent =
        'تم قراءة تعريف Forms لكن لم تُكتشف كائنات أسئلة قابلة للربط.';
      return;
    }

    if (status === 'error') {
      el.className =
        'mfe-api-status error';
      el.textContent =
        `تعذر قراءة تعريف Forms: ${state.answerApiError || 'خطأ غير معروف'}`;
      return;
    }

    el.className =
      'mfe-api-status';
    el.textContent =
      'سيحاول المحسن قراءة مفاتيح الإجابات من تعريف Forms تلقائيًا.';
  }

  function renderStats() {
    const host = document.getElementById(HOST_ID);
    if (!host) return;

    const s = stats();

    host.querySelector('.mfe-stats').innerHTML = `
      <span class="mfe-stat"><b>${s.total}</b> سؤال</span>
      <span class="mfe-stat"><b>${formatPoints(s.points)}</b> درجة</span>
      <span class="mfe-stat"><b>${s.required}</b> مطلوب</span>
      <span class="mfe-stat"><b>${s.choice}</b> اختيار</span>
      <span class="mfe-stat"><b>${s.multiple}</b> متعدد</span>
      <span class="mfe-stat"><b>${s.truefalse}</b> صح/خطأ</span>
      <span class="mfe-stat"><b>${s.text}</b> نصي</span>
      <span class="mfe-stat issue"><b>${s.issues}</b> سؤال يحتاج مراجعة</span>
    `;

    const note = host.querySelector('.mfe-audit-note');

    const correctKnownCount =
      state.questions.filter(q =>
        ['choice', 'multiple', 'truefalse'].includes(q.type) &&
        q.correctKnown
      ).length;

    const choiceCount =
      state.questions.filter(q =>
        ['choice', 'multiple', 'truefalse'].includes(q.type)
      ).length;

    const issueQuestions =
      state.questions.filter(q => issueCount(q) > 0).length;

    if (issueQuestions === 0) {
      note.classList.add('ok');
      note.textContent =
        `✓ لم يكتشف التدقيق الحالي مشكلات واضحة. تم تحليل ${state.questions.length} سؤالًا.`;
    } else {
      note.classList.remove('ok');
      note.textContent =
        `تم رصد ${issueQuestions} سؤالًا يحتاج مراجعة. يحاول المحسن قراءة الإجابات الصحيحة مباشرة من تعريف Forms عبر IsAnswerKey، لذلك لا يلزم فتح السؤال للتحرير.`;
    }
  }

  function renderResults() {
    const host = document.getElementById(HOST_ID);
    if (!host) return;

    const result = filteredQuestions();
    const box = host.querySelector('.mfe-results');
    const count = host.querySelector('.mfe-result-count');

    count.textContent = `${result.length} نتيجة`;

    if (!result.length) {
      box.innerHTML = `
        <div class="mfe-empty">
          لا توجد أسئلة مطابقة للبحث أو الفلتر الحالي.
        </div>
      `;
      return;
    }

    box.innerHTML = result.map(q => {
      const serious = issueCount(q);
      const hasError = q.issues.some(x => x.level === 'error');
      const hasWarn = q.issues.some(x => x.level === 'warn');

      const issueBadge = serious
        ? `<span class="mfe-badge ${hasError ? 'error' : 'warn'}">${serious} مشكلة</span>`
        : '';

      const requiredBadge =
        q.required === true
          ? `<span class="mfe-badge">مطلوب</span>`
          : q.required === false
            ? `<span class="mfe-badge warn">غير مطلوب</span>`
            : '';

      const correctBadge =
        ['choice', 'multiple', 'truefalse'].includes(q.type)
          ? (
              q.correctKnown
                ? (
                    q.correctIndexes.length
                      ? `<span class="mfe-badge">${q.answerSource === 'forms-api' ? 'مفتاح Forms' : 'الصحيح'}: ${q.correctIndexes.map(i => i + 1).join('، ')}</span>`
                      : `<span class="mfe-badge error">بدون إجابة صحيحة</span>`
                  )
                : `<span class="mfe-badge">الصحيح: غير متاح للفحص</span>`
            )
          : '';

      const correctAnswerLine =
        q.correctKnown &&
        q.correctAnswers?.length
          ? `<span class="mfe-correct-answer">الصحيح: ${html(q.correctAnswers.join(' + '))}</span>`
          : '';

      const issueSummary =
        q.issues.length
          ? q.issues
              .slice(0, 2)
              .map(x => x.text)
              .join(' • ')
          : 'لا توجد ملاحظات';

      const selected = state.selectedQuestions.has(q.number);

      return `
        <div
          class="mfe-result${selected ? ' selected' : ''}"
          data-question="${q.number}"
          title="${html(issueSummary)}"
          role="button"
          tabindex="0"
        >
          <label class="mfe-select-cell" title="تحديد السؤال للتعديل الجماعي">
            <input
              type="checkbox"
              class="mfe-select-question"
              data-question="${q.number}"
              ${selected ? 'checked' : ''}
            >
          </label>

          <span class="mfe-number">${q.number}</span>

          <span class="mfe-result-title">
            <strong>${html(q.title || `السؤال ${q.number}`)}</strong>
            ${correctAnswerLine}
            <small>${html(issueSummary)}</small>
          </span>

          <span class="mfe-badges">
            <span class="mfe-badge">${html(typeLabel(q.type))}</span>
            <span class="mfe-badge">${formatPoints(q.points)} درجة</span>
            ${requiredBadge}
            ${correctBadge}
            ${issueBadge}
          </span>
        </div>
      `;
    }).join('');

    box
      .querySelectorAll('.mfe-result[data-question]')
      .forEach(row => {
        const number = Number(row.dataset.question);

        row.addEventListener('click', event => {
          if (event.target.closest('.mfe-select-cell')) return;
          goToQuestion(number);
        });

        row.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') {
            if (event.target.closest('.mfe-select-cell')) return;
            event.preventDefault();
            goToQuestion(number);
          }
        });
      });

    box
      .querySelectorAll('.mfe-select-question')
      .forEach(input => {
        input.addEventListener('click', event => {
          event.stopPropagation();
        });

        input.addEventListener('change', () => {
          const number = Number(input.dataset.question);

          if (input.checked) {
            state.selectedQuestions.add(number);
          } else {
            state.selectedQuestions.delete(number);
          }

          input.closest('.mfe-result')?.classList.toggle(
            'selected',
            input.checked
          );

          renderBulkState();
        });
      });

    renderBulkState();
  }

  function render() {
    renderStats();
    renderApiStatus();
    renderResults();
    renderBulkState();
    applyCorrectHighlights();
  }

  function refresh() {
    const previous =
      new Map(
        state.questions.map(q => [
          q.number,
          q
        ])
      );

    let scanned =
      scanQuestions();

    /*
     * مصدر القائمة أصبح ثلاثيًا:
     * 1) questionWrapper الحالية
     * 2) آخر Snapshot موثوق
     * 3) تعريف Forms API
     *
     * بهذا لا يختفي السؤال النشط من المحسن عندما يستبدله Forms بالمحرر.
     */
    scanned =
      reconcileQuestionList(
        scanned,
        previous
      );

    state.questions =
      buildAudit(scanned);

    /*
     * Forms قد يحذف بعض تفاصيل aria من الأسئلة غير النشطة لحظيًا.
     * إذا أصبحت required غير معروفة بعد refresh نحافظ على آخر قيمة
     * مؤكدة بدل تحويلها إلى null.
     */
    for (const q of state.questions) {
      const old =
        previous.get(q.number);

      if (!old) continue;

      if (
        q.required == null &&
        old.required != null
      ) {
        q.required =
          old.required;
      }
    }

    mergeAnswerModelsIntoQuestions();

    // API data may change options/points/answer keys used by the audit.
    buildAudit(state.questions);

    for (const q of state.questions) {
      const cached =
        state.correctCache.get(q.number);

      if (cached?.known) {
        q.correctKnown = true;
        q.correctIndexes = [...cached.indexes];
      }
    }

    captureLiveCorrectState();
    render();

    console.table(
      state.questions.map(q => ({
        number: q.number,
        type: typeLabel(q.type),
        points: q.points,
        required: q.required,
        options: q.options.length,
        correctKnown: q.correctKnown,
        correct: q.correctIndexes.map(i => i + 1).join(', '),
        issues: q.issues.map(x => x.text).join(' | '),
        title: q.title
      }))
    );

    const domWrapperCount =
      getAllWrappers().length;

    const expectedCount =
      Number.isFinite(state.expectedStructureCount)
        ? state.expectedStructureCount
        : (
            state.answerModels?.length ||
            Math.max(
              domWrapperCount,
              previous.size
            )
          );

    if (
      expectedCount &&
      state.questions.length !== expectedCount
    ) {
      console.warn(
        `⚠️ اختلاف في عدد الأسئلة: DOM=${domWrapperCount} / API=${state.answerModels?.length || 0} / enhancer=${state.questions.length}`
      );
    } else if (
      expectedCount &&
      domWrapperCount !== expectedCount
    ) {
      console.log(
        `ℹ️ Forms يعرض ${domWrapperCount} questionWrapper فقط، والمحسن حافظ على ${state.questions.length} سؤالًا من المصادر الموثوقة.`
      );
    }

    return state.questions;
  }

  function bindEvents(host) {
    const search = host.querySelector('.mfe-search');
    const type = host.querySelector('.mfe-type');
    const requiredFilter = host.querySelector('.mfe-required-filter');
    const auditFilter = host.querySelector('.mfe-audit-filter');
    const pointsOp = host.querySelector('.mfe-points-op');
    const pointsFilterValue = host.querySelector('.mfe-points-filter-value');
    const smartSelect = host.querySelector('.mfe-smart-select');
    const highlightCorrect = host.querySelector('.mfe-highlight-correct');
    const bulkPointsInput = host.querySelector('.mfe-bulk-points');

    host
      .querySelector('[data-action="select-visible"]')
      .addEventListener('click', () => selectQuestionsByRule('visible'));

    host
      .querySelector('[data-action="invert-selection"]')
      .addEventListener('click', () => {
        const visibleQuestions = filteredQuestions();
        visibleQuestions.forEach(q => state.selectedQuestions.has(q.number) ? state.selectedQuestions.delete(q.number) : state.selectedQuestions.add(q.number));
        state.bulkStatus = `تم عكس التحديد داخل ${visibleQuestions.length} نتيجة ظاهرة.`;
        renderResults();
      });

    host
      .querySelector('[data-action="clear-selection"]')
      .addEventListener('click', () => {
        state.selectedQuestions.clear();
        renderResults();
      });

    host
      .querySelector('[data-action="bulk-points"]')
      .addEventListener('click', () => {
        const value = Number(bulkPointsInput.value);

        if (!Number.isFinite(value) || value < 0) {
          state.bulkStatus = 'أدخل درجة صحيحة أكبر من أو تساوي 0.';
          renderBulkState();
          return;
        }

        runBulkPatch(
          { points: value },
          `تعيين الدرجة إلى ${formatPoints(value)}`
        );
      });

    host
      .querySelector('[data-action="bulk-required-on"]')
      .addEventListener('click', () => {
        runBulkPatch(
          { required: true },
          'جعل الأسئلة المحددة مطلوبة'
        );
      });

    host
      .querySelector('[data-action="bulk-required-off"]')
      .addEventListener('click', () => {
        runBulkPatch(
          { required: false },
          'جعل الأسئلة المحددة غير مطلوبة'
        );
      });

    host
      .querySelector('[data-action="bulk-copy"]')
      .addEventListener('click', () => {
        copySelectedQuestions();
      });

    host
      .querySelector('[data-action="bulk-duplicate"]')
      .addEventListener('click', () => {
        runBulkDuplicate();
      });

    host
      .querySelector('[data-action="bulk-delete"]')
      .addEventListener('click', () => {
        runBulkDelete();
      });

    host
      .querySelector('[data-action="bulk-undo"]')
      .addEventListener('click', () => {
        runBulkUndo();
      });

    host
      .querySelector('[data-action="bulk-stop"]')
      .addEventListener('click', () => {
        state.bulkCancelRequested = true;
        state.bulkStatus = 'سيتم الإيقاف بعد انتهاء السؤال الجاري...';
        renderBulkState();
      });

    search.addEventListener(
      'input',
      debounce(() => {
        state.query = search.value;
        renderResults();
      }, 120)
    );

    type.addEventListener('change', () => { state.selectedType = type.value; renderResults(); });
    requiredFilter.addEventListener('change', () => { state.requiredFilter = requiredFilter.value; renderResults(); });
    auditFilter.addEventListener('change', () => { state.auditFilter = auditFilter.value; renderResults(); });
    pointsOp.addEventListener('change', () => { state.pointsOperator = pointsOp.value; state.pointsValue = Number(pointsFilterValue.value || 0); renderResults(); });
    pointsFilterValue.addEventListener('input', debounce(() => { state.pointsValue = Number(pointsFilterValue.value || 0); renderResults(); }, 120));
    smartSelect.addEventListener('change', () => { const rule = smartSelect.value; if (rule) selectQuestionsByRule(rule); smartSelect.value = ''; });

    highlightCorrect.addEventListener('change', () => {
      state.highlightCorrect = highlightCorrect.checked;
      applyCorrectHighlights();
    });

    host
      .querySelector('[data-action="question-bank"]')
      .addEventListener('click', () => {
        if (window.FormsBulkImporter?.open) { window.FormsBulkImporter.open(); return; }
        alert('ثبّت سكربت «بنك الأسئلة والإدخال الجماعي» لفتح البنك من هنا.');
      });

    host
      .querySelector('[data-action="refresh"]')
      .addEventListener('click', () => {
        refresh();
      });

    host
      .querySelector('[data-action="next-issue"]')
      .addEventListener('click', () => {
        const current =
          state.questions.find(q =>
            q.designerCard?.matches?.(':focus-within') ||
            q.wrapper?.matches?.(':focus-within')
          );

        const next = nextIssue(
          current?.number || 0
        );

        if (!next) {
          alert('لم يكتشف التدقيق الحالي أسئلة تحتاج مراجعة.');
        }
      });

    host
      .querySelector('[data-action="collapse"]')
      .addEventListener('click', event => {
        state.panelCollapsed = !state.panelCollapsed;

        host.classList.toggle(
          'mfe-collapsed',
          state.panelCollapsed
        );

        event.currentTarget.textContent =
          state.panelCollapsed
            ? '⌄'
            : '⌃';
      });

    state.globalClickHandler = event => {
      if (event.target?.closest?.(`#${HOST_ID}`)) {
        return;
      }

      const wrapper =
        event.target?.closest?.(
          '[data-automation-id="questionWrapper"]'
        );

      if (!wrapper) {
        return;
      }

      const number =
        questionNumberFrom(wrapper);

      if (!number) {
        return;
      }

      state.activeQuestionNumber =
        number;

      setTimeout(() => {
        const captured =
          captureLiveCorrectState();

        if (
          captured &&
          state.highlightCorrect
        ) {
          applyCorrectHighlights();
          renderResults();
        }
      }, 350);

      setTimeout(() => {
        const captured =
          captureLiveCorrectState();

        if (
          captured &&
          state.highlightCorrect
        ) {
          applyCorrectHighlights();
          renderResults();
        }
      }, 900);
    };

    document.addEventListener(
      'click',
      state.globalClickHandler,
      true
    );
  }

  function startObserver() {
    const target =
      getFormRoot();

    const run =
      debounce(() => {
        if (!document.getElementById(HOST_ID)) return;
        if (state.bulkRunning) return;

        // Ignore mutations generated by our own panel.
        refresh();
      }, 1200);

    state.observer =
      new MutationObserver(mutations => {
        const meaningful =
          mutations.some(m => {
            const targetEl =
              m.target instanceof Element
                ? m.target
                : m.target.parentElement;

            return !targetEl?.closest?.(`#${HOST_ID}`);
          });

        if (meaningful) {
          if (state.highlightCorrect) {
            setTimeout(() => {
              captureLiveCorrectState();
              applyCorrectHighlights();
            }, 180);
          }

          run();
        }
      });

    state.observer.observe(target, {
      childList: true,
      subtree: true
    });
  }

  function destroy() {
    /*
     * أي نسخة جديدة/إزالة للمحسن يجب أن توقف حلقة جماعية قديمة
     * بعد انتهاء السؤال الجاري بدل تركها تكمل في الخلفية.
     */
    state.bulkCancelRequested = true;

    state.observer?.disconnect?.();
    state.observer = null;

    document
      .querySelectorAll('[data-m0hm3d85-question-focus]')
      .forEach(el => {
        el.removeAttribute('data-m0hm3d85-question-focus');
      });

    clearCorrectHighlights();

    if (state.globalClickHandler) {
      document.removeEventListener(
        'click',
        state.globalClickHandler,
        true
      );
      state.globalClickHandler = null;
    }

    document.getElementById(HOST_ID)?.remove();
    document.getElementById(STYLE_ID)?.remove();

    delete window.MAD_FORMS_EDITOR_ENHANCER;
  }

  const host = mount();
  refresh();
  startObserver();

  // Read the same form-definition request already made by Microsoft Forms.
  // This exposes Choices[].IsAnswerKey without opening questions for editing.
  setTimeout(() => {
    loadAnswerModels(false);
  }, 700);

  window.MAD_FORMS_EDITOR_ENHANCER = {
    version: VERSION,
    hostId: HOST_ID,
    state,
    refresh,
    questions: () => state.questions,
    audit: () =>
      state.questions
        .filter(q => q.issues.length)
        .map(q => ({
          number: q.number,
          title: q.title,
          issues: q.issues
        })),
    go: goToQuestion,
    nextIssue,
    captureCorrect: () => {
      const result = captureLiveCorrectState();
      applyCorrectHighlights();
      renderResults();
      return result;
    },
    correctCache: () =>
      Object.fromEntries(
        [...state.correctCache.entries()]
      ),
    selected: () => selectedQuestionObjects().map(q => q.number),
    selectVisible: () => selectQuestionsByRule('visible'),
    selectByRule: rule => selectQuestionsByRule(String(rule || '')),
    filtered: () => filteredQuestions().map(q => q.number),
    clearSelection: () => {
      state.selectedQuestions.clear();
      renderResults();
    },
    bulkPoints: value => runBulkPatch({ points: Number(value) }, `تعيين الدرجة إلى ${value}`),
    bulkRequired: value => runBulkPatch({ required: Boolean(value) }, value ? 'جعل الأسئلة المحددة مطلوبة' : 'جعل الأسئلة المحددة غير مطلوبة'),
    copySelected: copySelectedQuestions,
    duplicateSelected: runBulkDuplicate,
    deleteSelected: runBulkDelete,
    undoBulk: runBulkUndo,
    answers: () =>
      state.questions.map(q => ({
        number: q.number,
        title: q.title,
        answers: [...(q.correctAnswers || [])],
        indexes: [...(q.correctIndexes || [])],
        source: q.answerSource
      })),
    reloadAnswers: () =>
      loadAnswerModels(true),
    answerModels: () =>
      state.answerModels,
    apiCount: async () =>
      (await getFreshApiCount()).count,
    syncCount: async expected =>
      waitForApiQuestionCount(Number(expected)),
    destroy
  };

  console.log(
    '%cMicrosoft Forms Editor Enhancer v1.0.5',
    'font-size:18px;font-weight:800;color:#007874'
  );
  console.log('✅ المحسن جاهز: مطوي افتراضيًا + فلاتر ذكية + عمليات جماعية موثقة.');
  console.log('API: MAD_FORMS_EDITOR_ENHANCER');
}


  if (PORTAL.workerBoot()) return;

  let editorStarted = false;
  let portalWasActive = false;

  const routeBoot = () => {
    const portalActive =
      PORTAL.isPortal();

    /*
     * الانتقال من أي صفحة داخل Forms إلى البوابة = دخول جديد.
     * هنا فقط نمسح الفهرس ثم تبدأ الفهرسة التلقائية من الصفر.
     * MutationObserver قد يستدعي routeBoot مرات كثيرة، لكن
     * portalWasActive يمنع تشغيل أكثر من فهرسة لنفس الدخول.
     */
    if (
      portalActive &&
      !portalWasActive
    ) {
      PORTAL.enterPortalFresh();
    } else if (portalActive) {
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
      editorStarted = true;

      try {
        startEditorEnhancer();
      } catch (error) {
        editorStarted = false;
        console.error(
          'Forms editor enhancer:',
          error
        );
      }
    }

    SETTINGS.mount();
  };

  routeBoot();
  const bootObserver = new MutationObserver(() => routeBoot());
  bootObserver.observe(document.documentElement, {childList:true,subtree:true});
  setTimeout(() => { try { bootObserver.disconnect(); } catch {} }, 30000);
})();

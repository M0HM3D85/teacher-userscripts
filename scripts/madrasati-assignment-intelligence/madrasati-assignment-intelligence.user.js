// ==UserScript==
// @name         Madrasati Assignment Intelligence | مدير الواجبات الذكي
// @namespace    https://greasyfork.org/users/1636459
// @version      1.4.2
// @description  مدير واجبات مدرستي: تقارير نهائية لا تُحتسب إلا بعد انتهاء وقت النشر وفق وقت خادم مدرستي، تحليل دقيق للطلاب والأسئلة، لوحة شاملة لكل الصفحات والمنشورات، PDF/Excel/CSV، واستيراد درجات ذكي.
// @copyright    2026, Mohammed Almalki (M0HM3D85)
// @license      All Rights Reserved
// @match        https://schools.madrasati.sa/Teacher/Assignments/*
// @match        https://schools.madrasati.sa/SchoolManagment/Actions/MyStudents*
// @author       Mohammed Almalki (M0HM3D85)
// @homepageURL  https://greasyfork.org/en/users/1636459-m0hm3d85
// @supportURL   https://github.com/M0HM3D85/teacher-userscripts/issues
// @require      https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js
// @require      https://cdn.jsdelivr.net/gh/M0HM3D85/teacher-userscripts@2c779aed06435d7e99ba94a3212ac40bf20317f1/scripts/madrasati-assignment-intelligence/madrasati-assignment-intelligence.user.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

/*
=========================================================================
 Madrasati Assignment Intelligence | مدير الواجبات الذكي — v1.4.2

 تصميم وتطوير: Mohammed Almalki (M0HM3D85)
 X / Twitter : https://x.com/M0HM3D85
 Snapchat    : https://www.snapchat.com/add/M0HM3D85
 GreasyFork  : https://greasyfork.org/en/users/1636459-m0hm3d85

 هذا الإصدار يبني طبقة التحليل المتقدمة فوق النواة المستقرة v1.1.7
 المثبتة على commit محدد لضمان عدم تغير السلوك الأساسي دون قصد.

 © 2026 Mohammed Almalki (M0HM3D85) — جميع الحقوق محفوظة.
=========================================================================
*/

(() => {
  'use strict';

  const APP = 'MAI';
  const VERSION = '1.4.2';
  const BASE_REQUIRED_VERSION = '1.1.7';
  const ENHANCED_CACHE_KEY = 'MAI_ENHANCED_ANALYSIS_V3';
  const PANEL_COLLAPSE_KEY = 'MAI_PANEL_COLLAPSED_V1';
  const INDEX_COLLAPSE_KEY = 'MAI_INDEX_PANEL_COLLAPSED_V1';
  const INDEX_PUBLICATIONS_CACHE_KEY = 'MAI_INDEX_PUBLICATIONS_V5';
  const INDEX_DEEP_CACHE_KEY = 'MAI_INDEX_DEEP_ANALYSIS_V5';
  const isGradeAssignment = /\/Teacher\/Assignments\/GradeAssignment\//i.test(location.pathname);
  const isAssignmentsIndex = /\/Teacher\/Assignments\/Index\//i.test(location.pathname);
  const isMyStudents = /\/SchoolManagment\/Actions\/MyStudents/i.test(location.pathname);

  const base = globalThis.MadrasatiAssignmentIntelligence || null;

  // صفحة GradeAssignment تعتمد على النواة المستقرة v1.1.7.
  // أما صفحة Index فلها لوحة مستقلة، لذلك لا نمنع تشغيلها إذا تعذر تحميل النواة لأي سبب.
  if (!base && isGradeAssignment) {
    console.error('[MAI v1.4.2] Base v1.1.7 was not loaded on GradeAssignment.');
    return;
  }

  // الصفحات الأخرى تكتفي بالنواة إن كانت متاحة.
  if (!isGradeAssignment && !isAssignmentsIndex) {
    try { if (base) base.version = VERSION; } catch {}
    return;
  }

  const state = base?.state || {};
  const clean = (v) => String(v ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  const norm = (v) => clean(v)
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/ـ/g, '')
    .replace(/[إأآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .toLowerCase();
  const esc = (s) => clean(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  const num = (v) => {
    const raw = String(v ?? '')
      .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
      .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
      .replace(/[^\d.-]/g, '');
    if (!raw || raw === '-' || raw === '.' || raw === '-.') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };
  const pct = (a, b) => b ? Number(((a / b) * 100).toFixed(2)) : 0;
  const fmt = (v, digits = 2) => {
    if (!Number.isFinite(v)) return '—';
    return Number(v.toFixed(digits)).toString();
  };
  const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // -----------------------------
  // حالة نشر الواجب من نفس صفحة GradeAssignment
  // -----------------------------
  // مدرستي يضع وقت الخادم ووقت نهاية نشر الواجب في حقول مخفية:
  // #ServerDateTime و #PublishedEndTime.
  // نعتمد وقت الخادم بدل ساعة جهاز المعلم حتى لا تتأثر النتيجة بإعدادات الجهاز.
  const parseMadrasatiDateTime = (value) => {
    const raw = clean(value);
    if (!raw) return null;

    // الصيغة المرصودة في مدرستي: MM/DD/YYYY HH:mm:ss مع احتمال AM/PM.
    const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
    if (m) {
      const month = Number(m[1]);
      const day = Number(m[2]);
      const year = Number(m[3]);
      let hour = Number(m[4]);
      const minute = Number(m[5]);
      const second = Number(m[6] || 0);
      const ampm = String(m[7] || '').toUpperCase();

      if (ampm === 'AM' && hour === 12) hour = 0;
      if (ampm === 'PM' && hour < 12) hour += 12;

      const d = new Date(year, month - 1, day, hour, minute, second, 0);
      if (
        d.getFullYear() === year &&
        d.getMonth() === month - 1 &&
        d.getDate() === day &&
        d.getHours() === hour &&
        d.getMinutes() === minute
      ) return d;
    }

    const fallback = new Date(raw);
    return Number.isFinite(fallback.getTime()) ? fallback : null;
  };

  const getDocumentInputValue = (doc, selector) => {
    const el = doc?.querySelector?.(selector);
    return clean(el?.value ?? el?.getAttribute?.('value') ?? '');
  };

  const getGradePublicationTiming = (doc = document) => {
    const serverRaw = getDocumentInputValue(doc, '#ServerDateTime');
    const endRaw = getDocumentInputValue(doc, '#PublishedEndTime');
    const serverDate = parseMadrasatiDateTime(serverRaw);
    const endDate = parseMadrasatiDateTime(endRaw);

    if (!serverDate || !endDate) {
      return {
        status: 'unknown',
        serverRaw,
        endRaw,
        serverDate,
        endDate,
        isEnded: null,
        remainingMs: null
      };
    }

    const isEnded = serverDate.getTime() >= endDate.getTime();
    return {
      status: isEnded ? 'ended' : 'receiving',
      serverRaw,
      endRaw,
      serverDate,
      endDate,
      isEnded,
      remainingMs: endDate.getTime() - serverDate.getTime()
    };
  };

  const formatGradeTimingDate = (date) => {
    if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return '—';
    try {
      return date.toLocaleString('ar-SA-u-nu-latn', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return date.toLocaleString();
    }
  };

  const gradeReportGate = (doc = document) => {
    const timing = getGradePublicationTiming(doc);
    if (timing.status === 'ended') {
      return {
        ready: true,
        status: 'ended',
        timing,
        label: 'منتهي',
        message: 'انتهى وقت استقبال الحلول، والتقرير النهائي متاح.'
      };
    }

    if (timing.status === 'receiving') {
      return {
        ready: false,
        status: 'receiving',
        timing,
        label: 'قيد الاستقبال',
        message: `الواجب ما زال قيد استقبال الحلول حتى ${formatGradeTimingDate(timing.endDate)}. التقرير النهائي مؤجل حتى انتهاء الوقت.`
      };
    }

    return {
      ready: false,
      status: 'unknown',
      timing,
      label: 'غير متحقق',
      message: 'تعذر التحقق من وقت نهاية نشر الواجب من صفحة مدرستي؛ لن يتم إنشاء تقرير نهائي لتجنب بيانات غير مكتملة.'
    };
  };

  const assertFinalReportReady = () => {
    const gate = gradeReportGate(document);
    if (!gate.ready) throw new Error(gate.message);
    return gate;
  };

  const toast = (message, type = 'info') => {
    let box = document.getElementById(`${APP}-toast`);
    if (!box) {
      box = document.createElement('div');
      box.id = `${APP}-toast`;
      document.body.appendChild(box);
    }
    box.className = `${APP}-toast ${type}`;
    box.textContent = message;
    box.classList.add('show');
    clearTimeout(box._maiTimer);
    box._maiTimer = setTimeout(() => box.classList.remove('show'), 3500);
  };

  const setStatus = (text, busy = false) => {
    const el = document.getElementById(`${APP}-status`);
    if (!el) return;
    el.textContent = text || 'جاهز';
    el.dataset.busy = busy ? '1' : '0';
  };

  const safeJSONParse = (text, fallback = null) => {
    try { return JSON.parse(text); } catch { return fallback; }
  };

  const loadEnhancedCache = () => {
    const cached = safeJSONParse(localStorage.getItem(ENHANCED_CACHE_KEY), null);
    if (!cached || cached.pageUrl !== location.href) return null;
    return cached;
  };

  const saveEnhancedCache = (analytics) => {
    try {
      const compact = {
        pageUrl: location.href,
        savedAt: new Date().toISOString(),
        analytics
      };
      localStorage.setItem(ENHANCED_CACHE_KEY, JSON.stringify(compact));
    } catch {}
  };

  const getMode = () => state.gradeData?.assignmentMode || { key: 'unknown', label: 'غير محدد', rawSolvingTypes: [] };
  const isOutsideSystem = () => getMode()?.key === 'outside_system' || (getMode()?.rawSolvingTypes || []).map(String).includes('3');
  const isOnlineQuestions = () => getMode()?.key === 'online_questions' || (getMode()?.rawSolvingTypes || []).map(String).includes('4') || (state.gradeData?.students || []).some(s => !!s.resultUrl || String(s.solvingType) === '4');

  const EPS = 1e-9;
  const nearlyEqual = (a, b, eps = EPS) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= eps;

  const resolvedAchievedGrade = (student) => {
    const resultGrade = num(student?.resultGrade);
    if (Number.isFinite(resultGrade)) return resultGrade;
    return num(student?.achievedGrade);
  };

  const resolvedMaxGrade = (student) => {
    const resultMax = num(student?.resultMaxGrade);
    if (Number.isFinite(resultMax) && resultMax > 0) return resultMax;
    return num(student?.maxGrade);
  };

  const studentPercent = (student) => {
    const achieved = resolvedAchievedGrade(student);
    const total = resolvedMaxGrade(student);
    if (!Number.isFinite(achieved) || !Number.isFinite(total) || total <= 0) return null;
    return Number(((achieved / total) * 100).toFixed(2));
  };

  const computeEnhancedSummary = () => {
    const students = state.gradeData?.students || [];
    const outside = isOutsideSystem();
    const total = students.length;
    const submitted = outside ? [] : students.filter(s => s.submissionState === 'submitted' || s.hasAnswer === true);
    const scored = students
      .map(s => ({ s, achieved: resolvedAchievedGrade(s), max: resolvedMaxGrade(s) }))
      .filter(x => Number.isFinite(x.achieved) && Number.isFinite(x.max) && x.max > 0);
    const percents = scored.map(x => (x.achieved / x.max) * 100).filter(Number.isFinite);
    const averagePercent = percents.length ? percents.reduce((a,b) => a+b, 0) / percents.length : null;
    const discrepancies = students.filter(s => s.gradeDiscrepancy === true);
    return {
      total,
      submittedCount: outside ? null : submitted.length,
      notSubmittedCount: outside ? null : Math.max(0, total - submitted.length),
      submissionRate: outside ? null : pct(submitted.length, total),
      graded: scored.length,
      gradingRate: pct(scored.length, total),
      averagePercent: Number.isFinite(averagePercent) ? Number(averagePercent.toFixed(2)) : null,
      highestPercent: percents.length ? Math.max(...percents) : null,
      lowestPercent: percents.length ? Math.min(...percents) : null,
      discrepancyCount: discrepancies.length
    };
  };

  const studentLevel = (student, mode = getMode()) => {
    const outside = mode?.key === 'outside_system';

    if (!outside && student?.submissionState === 'not_submitted') {
      return { key: 'not-solved', label: 'لم يحل', rank: 7 };
    }

    const percent = studentPercent(student);
    if (!Number.isFinite(percent)) {
      if (outside) return { key: 'unverified', label: 'غير مرصود', rank: 8 };
      return { key: 'pending', label: 'بانتظار الرصد', rank: 8 };
    }

    if (percent >= 90) return { key: 'excellent', label: 'ممتاز', rank: 1 };
    if (percent >= 80) return { key: 'very-good', label: 'جيد جدًا', rank: 2 };
    if (percent >= 70) return { key: 'good', label: 'جيد', rank: 3 };
    if (percent > 50) return { key: 'acceptable', label: 'مقبول', rank: 4 };
    return { key: 'weak', label: 'ضعيف', rank: 5 };
  };

  const levelOrder = [
    ['excellent', 'ممتاز'],
    ['very-good', 'جيد جدًا'],
    ['good', 'جيد'],
    ['acceptable', 'مقبول'],
    ['weak', 'ضعيف'],
    ['not-solved', 'لم يحل'],
    ['pending', 'بانتظار الرصد'],
    ['unverified', 'غير مرصود']
  ];

  const computeStudentLevels = () => {
    const students = state.gradeData?.students || [];
    const mode = getMode();
    const counts = Object.fromEntries(levelOrder.map(([k]) => [k, 0]));
    const rows = students.map(s => {
      const level = studentLevel(s, mode);
      counts[level.key] = (counts[level.key] || 0) + 1;
      return { student: s, percent: studentPercent(s), level };
    });
    return { counts, rows, total: students.length };
  };

  const cleanOptionText = (text) => clean(text)
    .replace(/(?:الإجابة|الاجابة)\s+الصحيحة/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // -----------------------------
  // Parser v1.2.1: السؤال = أصغر حاوية محلية تحتوي qid واحدًا
  // ويعتمد StudentAssignmentResult على checked + success/fail + شارة الإجابة الصحيحة.
  // -----------------------------
  const findQuestionRootEnhanced = (qid) => {
    let node = qid?.parentElement || null;
    while (node) {
      const qidCount = node.querySelectorAll?.('input.qid')?.length || 0;
      const answerCount = node.querySelectorAll?.('input[id="qaid"],input.qaid')?.length || 0;
      if (qidCount === 1 && answerCount > 0) return node;
      node = node.parentElement;
    }
    return null;
  };

  const findOptionRootEnhanced = (aid, questionRoot) => {
    let node = aid?.parentElement || null;
    let best = node;
    while (node && node !== questionRoot) {
      const aidCount = node.querySelectorAll?.('input[id="qaid"],input.qaid')?.length || 0;
      const hasChoice = !!node.querySelector?.('input[type="radio"],input[type="checkbox"]');
      if (aidCount !== 1) break;
      if (hasChoice) best = node;
      node = node.parentElement;
    }
    return best;
  };

  const parseQuestionCardsEnhanced = (doc) => {
    const qids = [...doc.querySelectorAll('input.qid')];

    return qids.map((qid, index) => {
      const root = findQuestionRootEnhanced(qid);
      if (!root) return null;

      const qtype = root.querySelector('input.qidtype');
      const questionText = clean(
        root.querySelector('#divQuestion .eldetail')?.innerText ||
        root.querySelector('.qQuestion')?.innerText ||
        root.querySelector('#divQuestion')?.innerText ||
        ''
      );

      const rootText = clean(root.innerText || '');
      const maxScore =
        num(rootText.match(/درجة\s+السؤال\s*[:：]?\s*([\d٠-٩۰-۹.,]+)/i)?.[1]) ??
        num(rootText.match(/(?:الدرجة|درجة|نقطة|نقاط)\s*[:：]?\s*([\d٠-٩۰-۹.,]+)/i)?.[1]);

      const aids = [...root.querySelectorAll('input[id="qaid"],input.qaid')];
      const options = aids.map((aid, oi) => {
        const opt = findOptionRootEnhanced(aid, root) || aid.parentElement;
        const choiceInput = opt?.querySelector?.('input[type="radio"],input[type="checkbox"]') || null;
        const cs = opt?.querySelector?.('.cs-input') || opt;
        const classes = `${opt?.className || ''} ${cs?.className || ''}`.toLowerCase();
        const rawText = clean(opt?.innerText || cs?.innerText || '');
        const correctAnswerMarker =
          /(?:الإجابة|الاجابة)\s+الصحيحة/i.test(rawText) ||
          !!opt?.querySelector?.('.badge.status-4') ||
          [...(opt?.querySelectorAll?.('.badge,[class*="status-"]') || [])]
            .some(el => /(?:الإجابة|الاجابة)\s+الصحيحة/i.test(clean(el.innerText)));
        const selected = !!choiceInput?.checked;
        const selectedCorrect = selected && /\bsuccess\b/.test(classes);
        const selectedWrong = selected && /\bfail\b/.test(classes);

        return {
          index: oi + 1,
          answerId: clean(aid?.value || aid?.getAttribute?.('name') || ''),
          text: cleanOptionText(rawText),
          selected,
          selectedCorrect,
          selectedWrong,
          correctAnswerMarker,
          markedCorrect: correctAnswerMarker || selectedCorrect,
          markedWrong: selectedWrong,
          choiceType: choiceInput?.type || ''
        };
      });

      const selected = options.filter(o => o.selected);
      const correct = options.filter(o => o.markedCorrect);
      const answered = selected.length > 0;
      const typeValue = clean(qtype?.value || qtype?.getAttribute?.('name') || '');
      const reliableSingleChoice = ['0', '2', 'multiplechoice', 'truefalse'].includes(norm(typeValue));

      let isCorrect = null;
      if (!answered) {
        isCorrect = null;
      } else if (selected.some(o => o.selectedWrong)) {
        isCorrect = false;
      } else if (selected.length && selected.every(o => o.selectedCorrect)) {
        isCorrect = true;
      } else if (reliableSingleChoice && correct.length) {
        const identity = o => o.answerId || norm(o.text);
        const selectedIds = selected.map(identity).filter(Boolean).sort();
        const correctIds = correct.map(identity).filter(Boolean).sort();
        isCorrect = selectedIds.length === correctIds.length && JSON.stringify(selectedIds) === JSON.stringify(correctIds);
      }

      return {
        number: index + 1,
        questionId: clean(qid?.value || qid?.getAttribute?.('name') || ''),
        type: typeValue,
        text: questionText,
        maxScore,
        options,
        answered,
        selectedOptions: selected,
        correctOptions: correct,
        selectedText: selected.map(o => o.text).filter(Boolean).join('، '),
        correctText: correct.map(o => o.text).filter(Boolean).join('، '),
        isCorrect
      };
    }).filter(Boolean);
  };

  const parseResultSummaryEnhanced = (doc) => {
    const text = clean(doc?.body?.innerText || '');
    const scoreMatch = text.match(/درجة\s+الطالب\s*[:：]?\s*([\d٠-٩۰-۹.,]+)\s*من\s*([\d٠-٩۰-۹.,]+)/i);
    return {
      resultScore: num(scoreMatch?.[1]),
      resultMaxScore: num(scoreMatch?.[2]),
      resultCorrectCount: num(text.match(/عدد\s+الإجابات\s+الصحيحة\s*[:：]?\s*([\d٠-٩۰-۹]+)/i)?.[1]),
      resultWrongCount: num(text.match(/عدد\s+الإجابات\s+الخاطئة\s*[:：]?\s*([\d٠-٩۰-۹]+)/i)?.[1]),
      resultQuestionCount: num(text.match(/إجمالي\s+عدد\s+الأسئلة\s*[:：]?\s*([\d٠-٩۰-۹]+)/i)?.[1])
    };
  };

  const parseResultDocumentEnhanced = (doc, meta = {}) => ({
    ...meta,
    ...parseResultSummaryEnhanced(doc),
    questions: parseQuestionCardsEnhanced(doc)
  });

  const fetchTextDocument = async (url) => {
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    return new DOMParser().parseFromString(html, 'text/html');
  };

  const extractLoadStudentsParamsEnhanced = () => {
    const fn = globalThis.loadStudents;
    if (typeof fn !== 'function') return null;
    const src = String(fn);
    const get = (key) => {
      const k = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return src.match(new RegExp(`${k}\\s*:\\s*['"]([^'"]*)['"]`))?.[1] ??
        src.match(new RegExp(`${k}\\s*:\\s*([\\d.]+)`))?.[1] ?? '';
    };
    return {
      schoolId: get('schoolId'), subjectId: get('subjectId'), teacherId: get('teacherId'), semesterId: get('semesterId'),
      assignmentId: get('assignmentId'), publishedAssignmentId: get('publishedAssignmentId'), lectureClassId: get('lectureClassId'),
      isGradebook: get('isGradebook'), isPublished: get('isPublished'), isCurrentTeacher: get('isCurrentTeacher'), isQuran: get('isQuran'),
      assigmentStarts: get('assigmentStarts'), grade: get('grade'), solvingType: get('solvingType')
    };
  };

  const postFormEnhanced = (url, data) => new Promise((resolve, reject) => {
    if (globalThis.jQuery?.post) {
      globalThis.jQuery.post(url, data).done(resolve).fail((xhr, status, err) => reject(new Error(err || status || `HTTP ${xhr?.status || ''}`)));
      return;
    }
    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(data || {})) {
      if (Array.isArray(value)) value.forEach(v => body.append(key, v));
      else body.append(key, value ?? '');
    }
    fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body })
      .then(async r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); const text = await r.text(); try { resolve(JSON.parse(text)); } catch { resolve(text); } })
      .catch(reject);
  });

  const responseHtmlEnhanced = (response) => typeof response === 'string' ? response : (response?.html || '');

  const resolveSingleStudentResultLink = async (student, params) => {
    const studentId = clean(student?.assignmentStudentId || student?.studentId || '');
    if (!studentId) return '';
    const response = await postFormEnhanced('/Teacher/Assignments/GetGradeStudentsList', {
      ...params, pageNumber: 1, pageSize: 10, studentIds: [studentId], status: '', sortBy: ''
    });
    const doc = new DOMParser().parseFromString(responseHtmlEnhanced(response), 'text/html');
    const link = doc.querySelector('a[href*="StudentAssignmentResult"]');
    return link ? new URL(link.getAttribute('href'), location.origin).href : '';
  };

  const resolveAccurateResultLinks = async (students) => {
    const params = extractLoadStudentsParamsEnhanced();
    if (!params) return students.filter(s => !!s.resultUrl);
    const submitted = students.filter(s => s.submissionState === 'submitted' || s.hasAnswer === true);
    const concurrency = 4;
    for (let i = 0; i < submitted.length; i += concurrency) {
      const batch = submitted.slice(i, i + concurrency);
      const links = await Promise.all(batch.map(async s => {
        try { return await resolveSingleStudentResultLink(s, params); }
        catch (e) { console.warn('[MAI v1.4.2] Could not resolve student result link:', e); return ''; }
      }));
      batch.forEach((s, j) => {
        if (links[j]) {
          s.resultUrl = links[j];
          s.resultUrlVerified = true;
        } else {
          s.resultUrlVerified = false;
          s.resultUrl = '';
        }
      });
    }
    return submitted.filter(s => !!s.resultUrl);
  };

  const fetchResultBatch = async (students, offset, total) => {
    const tasks = students.map(async (s, localIndex) => {
      const current = offset + localIndex + 1;
      setStatus(`تحليل إجابات الطلاب ${current}/${total}…`, true);
      try {
        const doc = await fetchTextDocument(s.resultUrl);
        return parseResultDocumentEnhanced(doc, {
          assignmentStudentId: String(s.assignmentStudentId || s.studentId || ''),
          name: s.name || '',
          className: s.className || '',
          achievedGrade: s.achievedGrade,
          maxGrade: s.maxGrade,
          resultUrl: s.resultUrl
        });
      } catch (e) {
        return {
          assignmentStudentId: String(s.assignmentStudentId || s.studentId || ''),
          name: s.name || '',
          className: s.className || '',
          error: String(e?.message || e),
          questions: []
        };
      }
    });
    return Promise.all(tasks);
  };

  const applyResultGradesToStudents = (results) => {
    const students = state.gradeData?.students || [];
    const byId = new Map(students.map(s => [String(s.assignmentStudentId || s.studentId || ''), s]));

    for (const result of results || []) {
      if (result?.error) continue;
      const student = byId.get(String(result.assignmentStudentId || ''));
      if (!student) continue;

      const resultGrade = num(result.resultScore);
      const resultMax = num(result.resultMaxScore);
      const pageGrade = num(student.currentGrade ?? student.achievedGrade);

      if (Number.isFinite(resultGrade)) {
        student.resultGrade = resultGrade;
        student.resultGradeSource = 'StudentAssignmentResult';
        student.achievedGrade = resultGrade;
        student.gradeState = 'recorded';
        if (student.submissionState === 'submitted') student.status = 'graded';
      }
      if (Number.isFinite(resultMax) && resultMax > 0) {
        student.resultMaxGrade = resultMax;
        student.maxGrade = resultMax;
      }

      student.resultCorrectCount = num(result.resultCorrectCount);
      student.resultWrongCount = num(result.resultWrongCount);
      student.resultQuestionCount = num(result.resultQuestionCount) ?? (result.questions || []).length;
      student.gradeFieldValue = pageGrade;
      student.gradeDiscrepancy = Number.isFinite(resultGrade) && Number.isFinite(pageGrade) && !nearlyEqual(resultGrade, pageGrade);
    }
  };

  const aggregateDeepAnalysis = (results) => {
    const questionMap = new Map();
    const studentMap = new Map();

    for (const result of results) {
      let detailCorrect = 0;
      let detailIncorrect = 0;
      let detailUnanswered = 0;
      let detailUnknown = 0;

      for (const q of result.questions || []) {
        const key = q.questionId || `n:${q.number}:${norm(q.text)}`;
        if (!questionMap.has(key)) {
          questionMap.set(key, {
            questionId: q.questionId,
            number: q.number,
            text: q.text,
            type: q.type,
            maxScore: q.maxScore,
            correctText: q.correctText,
            correctAnswerIds: new Set((q.correctOptions || []).map(o => o.answerId).filter(Boolean)),
            participants: 0,
            answered: 0,
            unanswered: 0,
            correct: 0,
            incorrect: 0,
            unknown: 0,
            wrongChoices: new Map()
          });
        }

        const agg = questionMap.get(key);
        if (!agg.text && q.text) agg.text = q.text;
        if (!agg.type && q.type) agg.type = q.type;
        if (!Number.isFinite(agg.maxScore) && Number.isFinite(q.maxScore)) agg.maxScore = q.maxScore;
        for (const option of q.correctOptions || []) if (option.answerId) agg.correctAnswerIds.add(option.answerId);
        if (!agg.correctText && q.correctText) agg.correctText = q.correctText;

        agg.participants++;
        if (q.answered) agg.answered++; else agg.unanswered++;

        if (q.isCorrect === true) {
          agg.correct++;
          detailCorrect++;
        } else if (q.isCorrect === false) {
          agg.incorrect++;
          detailIncorrect++;
          for (const option of q.selectedOptions || []) {
            if (option.selectedCorrect || option.correctAnswerMarker) continue;
            const optionKey = option.answerId || norm(option.text) || `unknown-${option.index}`;
            const current = agg.wrongChoices.get(optionKey) || { text: option.text || 'إجابة غير محددة', count: 0 };
            current.count++;
            agg.wrongChoices.set(optionKey, current);
          }
        } else if (!q.answered) {
          detailUnanswered++;
        } else {
          agg.unknown++;
          detailUnknown++;
        }
      }

      const summaryCorrect = num(result.resultCorrectCount);
      const summaryWrong = num(result.resultWrongCount);
      const summaryTotal = num(result.resultQuestionCount) ?? (result.questions || []).length;
      const useSummary = Number.isFinite(summaryCorrect) && Number.isFinite(summaryWrong);
      const correctCount = useSummary ? summaryCorrect : detailCorrect;
      const incorrectCount = useSummary ? summaryWrong : detailIncorrect;
      const unansweredCount = useSummary && Number.isFinite(summaryTotal)
        ? Math.max(0, summaryTotal - correctCount - incorrectCount)
        : detailUnanswered;

      studentMap.set(String(result.assignmentStudentId || ''), {
        correct: correctCount,
        incorrect: incorrectCount,
        unanswered: unansweredCount,
        unknown: detailUnknown,
        totalQuestions: Number.isFinite(summaryTotal) ? summaryTotal : (result.questions || []).length,
        resultScore: num(result.resultScore),
        resultMaxScore: num(result.resultMaxScore),
        error: result.error || ''
      });
    }

    const questions = [...questionMap.values()].map(q => {
      const wrongList = [...q.wrongChoices.values()].sort((a, b) => b.count - a.count);
      const knownAnswered = q.correct + q.incorrect;
      const correctRate = pct(q.correct, knownAnswered);
      const masteryRate = pct(q.correct, q.participants);
      const correctAnswerIds = [...q.correctAnswerIds];
      return {
        questionId: q.questionId,
        number: q.number,
        text: q.text,
        type: q.type,
        maxScore: q.maxScore,
        correctText: q.correctText,
        correctAnswerIds,
        participants: q.participants,
        answered: q.answered,
        knownAnswered,
        unanswered: q.unanswered,
        correct: q.correct,
        incorrect: q.incorrect,
        unknown: q.unknown,
        correctRate,
        masteryRate,
        difficulty:
          knownAnswered === 0 ? 'غير محدد' :
          correctRate < 50 ? 'صعب' :
          correctRate < 75 ? 'متوسط' : 'سهل',
        mostCommonWrong: wrongList[0] || null,
        wrongChoices: wrongList
      };
    }).sort((a, b) => a.number - b.number);

    const answeredResponses = questions.reduce((sum, q) => sum + q.knownAnswered, 0);
    const correctResponses = questions.reduce((sum, q) => sum + q.correct, 0);
    const incorrectResponses = questions.reduce((sum, q) => sum + q.incorrect, 0);
    const unansweredResponses = questions.reduce((sum, q) => sum + q.unanswered, 0);
    const unknownResponses = questions.reduce((sum, q) => sum + q.unknown, 0);
    const known = questions.filter(q => q.knownAnswered > 0);
    const easiest = known.slice().sort((a, b) => b.correctRate - a.correctRate)[0] || null;
    const hardest = known.slice().sort((a, b) => a.correctRate - b.correctRate)[0] || null;

    return {
      generatedAt: new Date().toISOString(),
      results,
      questions,
      studentMap: Object.fromEntries(studentMap),
      summary: {
        resultStudents: results.filter(r => !r.error).length,
        failedResults: results.filter(r => !!r.error).length,
        questionCount: questions.length,
        answeredResponses,
        correctResponses,
        incorrectResponses,
        unansweredResponses,
        unknownResponses,
        correctRate: pct(correctResponses, answeredResponses),
        incorrectRate: pct(incorrectResponses, answeredResponses),
        responseRate: pct(answeredResponses, answeredResponses + unansweredResponses + unknownResponses),
        easiest,
        hardest
      }
    };
  };

  async function runDeepQuestionAnalysisEnhanced({ silent = false } = {}) {
    if (!state.gradeData) await base.refreshAll(false);
    const allStudents = state.gradeData?.students || [];
    const submitted = allStudents.filter(s => s.submissionState === 'submitted' || s.hasAnswer === true);
    if (!submitted.length) throw new Error('لا توجد نتائج طلاب قابلة لتحليل الأسئلة في هذا الواجب حتى الآن.');

    if (!silent) setStatus(`جاري تثبيت روابط نتائج ${submitted.length} طالب…`, true);
    const students = await resolveAccurateResultLinks(allStudents);
    if (!students.length) throw new Error('لم أتمكن من العثور على روابط نتائج الطلاب المحلين لهذا الواجب.');

    if (!silent) setStatus(`جاري تحليل ${students.length} نتيجة طالب…`, true);
    const results = [];
    const concurrency = 4;

    try {
      for (let i = 0; i < students.length; i += concurrency) {
        const batch = students.slice(i, i + concurrency);
        const part = await fetchResultBatch(batch, i, students.length);
        results.push(...part);
      }

      applyResultGradesToStudents(results);
      const analytics = aggregateDeepAnalysis(results);
      state.enhancedQuestionAnalytics = analytics;
      state.questionAnalytics = analytics;
      const first = results.find(r => !r.error && r.questions?.length);
      if (first) state.questions = first.questions;
      saveEnhancedCache(analytics);
      if (!silent) toast(`تم تحليل ${analytics.summary.resultStudents} نتيجة و${analytics.summary.questionCount} سؤال.`, 'success');
      return analytics;
    } finally {
      setStatus('جاهز', false);
    }
  }

  const getQuestionAnalytics = () => state.enhancedQuestionAnalytics || null;

  const findDetailsUrlEnhanced = () => {
    const a = [...document.querySelectorAll('a[href]')]
      .find(x => /تفاصيل\s+الواجب/i.test(clean(x.innerText || '')));
    return a ? new URL(a.getAttribute('href'), location.origin).href : '';
  };

  // -----------------------------
  // Assignment identity / title
  // -----------------------------
  // v1.1.7 used the first generic h1/h2/h3 on the page. Madrasati can keep
  // unrelated hidden/modal headings before the actual assignment title, which
  // is why text such as "نعم، أنا ولي أمر..." could leak into printed output.
  // Here we resolve the assignment name semantically and reject generic UI text.
  let assignmentNameCache = '';

  const cleanAssignmentNameCandidate = (value) => clean(value)
    .replace(/^(?:اسم|عنوان)\s+الواجب\s*[:：-]?\s*/i, '')
    .replace(/^[\s:：\-–—]+|[\s:：\-–—]+$/g, '')
    .trim();

  const isUsableAssignmentName = (value) => {
    const t = cleanAssignmentNameCandidate(value);
    if (!t || t.length < 2 || t.length > 140) return false;
    if (/نعم\s*[،,]?\s*أنا\s+ولي\s+أمر|الطالب\/الطالبة\s+الموضح|مدير\s+الواجبات|تفاصيل\s+النتيجة|إجمالي\s+عدد\s+الأسئلة|درجة\s+الطالب|ملاحظات\s+المعلم/i.test(t)) return false;
    if (/^(?:الواجب|الواجبات|تفاصيل\s+الواجب|رصد\s+درجات(?:\s+الواجب)?|أسئلة\s+الواجب|نموذج\s+إجابة\s+الواجب|تقرير\s+تحليل\s+الواجب|أسئلة\s+داخل\s+مدرستي)$/i.test(t)) return false;
    return true;
  };

  const extractAssignmentNameFromDocument = (doc) => {
    if (!doc) return '';

    const take = (value) => {
      const t = cleanAssignmentNameCandidate(value);
      return isUsableAssignmentName(t) ? t : '';
    };

    // 0) المصدر المؤكد في GradeAssignment: عنوان بطاقة الواجب نفسها.
    // لا نستخدم h1/h2/h3 العامة لأن صفحة مدرستي تحتوي عناوين نوافذ وسياسات كثيرة.
    const confirmedTitleNodes = [...doc.querySelectorAll(
      '.homeworks-management-section > .card-header h5.mb-0'
    )];

    const nodeVisible = (el) => {
      if (!el) return false;
      if (el.closest?.('[hidden],.d-none,[aria-hidden="true"]')) return false;
      if (doc !== document) return true;
      try {
        const cs = getComputedStyle(el);
        return cs.display !== 'none' && cs.visibility !== 'hidden' && el.offsetParent !== null;
      } catch {
        return true;
      }
    };

    for (const el of confirmedTitleNodes) {
      const candidate = take(el.textContent || el.innerText || '');
      if (candidate && nodeVisible(el)) return candidate;
    }
    for (const el of confirmedTitleNodes) {
      const candidate = take(el.textContent || el.innerText || '');
      if (candidate) return candidate;
    }

    // احتياط مؤكد آخر ظهر في الجزء المختصر المخفي أعلى بطاقة الرصد.
    for (const el of doc.querySelectorAll('#mainDiv > .bg-light h5.mb-0')) {
      const candidate = take(el.textContent || el.innerText || '');
      if (candidate) return candidate;
    }

    // 1) حقول مخفية/مقروءة ذات اسم دلالي واضح.
    for (const el of doc.querySelectorAll('input,textarea,select')) {
      const key = `${el.id || ''} ${el.name || ''}`;
      if (!/(?:assignment|assigment).*(?:name|title)|(?:name|title).*(?:assignment|assigment)/i.test(key)) continue;
      const candidate = take(el.value || el.getAttribute('value') || '');
      if (candidate) return candidate;
    }

    // 2) ابحث عن تسمية "اسم الواجب" / "عنوان الواجب" وخذ القيمة المجاورة.
    const labels = [...doc.querySelectorAll('label,dt,th,strong,b,span,p,div')]
      .filter(el => {
        const t = clean(el.textContent || '');
        return t.length <= 45 && /^(?:اسم|عنوان)\s+الواجب\s*[:：]?$/i.test(t);
      });

    for (const label of labels) {
      const nearby = [
        label.nextElementSibling?.innerText,
        label.nextElementSibling?.textContent,
        label.parentElement?.querySelector?.('input,textarea,select')?.value,
        label.parentElement?.innerText
      ];
      for (const value of nearby) {
        if (!value) continue;
        let candidate = String(value);
        const match = candidate.match(/(?:اسم|عنوان)\s+الواجب\s*[:：]?\s*(.+?)(?=\s+(?:المادة|الفصل|الصف|نوع\s+الواجب|طريقة\s+الحل|الدرجة|درجة\s+الواجب|تاريخ|وقت|الوصف|الحالة)\s*[:：]?|$)/i);
        if (match) candidate = match[1];
        candidate = take(candidate);
        if (candidate) return candidate;
      }
    }

    // 3) النص الخام مع الحفاظ على الأسطر؛ مفيد عندما تكون القيمة نصًا بجوار label.
    const rawText = String(doc.body?.innerText || '').replace(/\u00a0/g, ' ');
    const lineMatch = rawText.match(/(?:اسم|عنوان)\s+الواجب\s*[:：]?\s*([^\r\n]{2,140})/i);
    if (lineMatch) {
      const candidate = take(lineMatch[1].split(/\s{2,}/)[0]);
      if (candidate) return candidate;
    }

    // 4) عناوين مرئية محددة، مع رفض العناوين العامة والنوافذ المخفية.
    const headingSelectors = [
      '[id*="assignment" i][id*="name" i]',
      '[id*="assignment" i][id*="title" i]',
      '[class*="assignment" i][class*="name" i]',
      '[class*="assignment" i][class*="title" i]',
      '.page-title', '.card-title', 'h1', 'h2', 'h3'
    ].join(',');

    const headingCandidates = [...doc.querySelectorAll(headingSelectors)]
      .map(el => ({
        text: take(el.innerText || el.textContent || ''),
        hidden: el.hidden || el.closest?.('[hidden],[aria-hidden="true"],.modal')?.hidden === true,
        len: clean(el.innerText || el.textContent || '').length
      }))
      .filter(x => x.text && !x.hidden)
      .sort((a, b) => a.text.length - b.text.length);

    if (headingCandidates.length) return headingCandidates[0].text;

    return '';
  };

  async function resolveAssignmentNameEnhanced({ allowFetch = true } = {}) {
    if (isUsableAssignmentName(assignmentNameCache)) return assignmentNameCache;

    let name = extractAssignmentNameFromDocument(document);

    // إذا تعذر من صفحة الرصد، استخدم صفحة تفاصيل الواجب فقط كاحتياط.
    if (!name && allowFetch) {
      const detailsUrl = findDetailsUrlEnhanced();
      if (detailsUrl) {
        try {
          const doc = await fetchTextDocument(detailsUrl);
          name = extractAssignmentNameFromDocument(doc);
        } catch (e) {
          console.warn('[MAI v1.4.2] Could not resolve assignment name from details page:', e);
        }
      }
    }

    if (!name && isUsableAssignmentName(state.gradeData?.title)) {
      name = cleanAssignmentNameCandidate(state.gradeData.title);
    }

    assignmentNameCache = name || 'واجب مدرستي';
    if (state.gradeData) {
      state.gradeData.assignmentName = assignmentNameCache;
      state.gradeData.title = assignmentNameCache;
    }
    const panelSub = document.querySelector(`#${APP}-panel .${APP}-sub`);
    if (panelSub && assignmentNameCache !== 'واجب مدرستي') {
      panelSub.textContent = `${assignmentNameCache} · تحليل الطلاب والأسئلة + تقارير PDF + استيراد ذكي — v${VERSION}`;
    }
    return assignmentNameCache;
  }

  const mergeAnswerKeyIntoQuestions = (questions, analytics) => {
    if (!analytics?.questions?.length) return questions;
    const keyMap = new Map(analytics.questions.map(q => [String(q.questionId || q.number), q]));
    return (questions || []).map(q => {
      const aq = keyMap.get(String(q.questionId || q.number));
      if (!aq) return q;
      const ids = new Set(aq.correctAnswerIds || []);
      const options = (q.options || []).map(o => ({
        ...o,
        markedCorrect: o.markedCorrect || (o.answerId && ids.has(o.answerId))
      }));
      const correctText = options.filter(o => o.markedCorrect).map(o => o.text).filter(Boolean).join('، ') || aq.correctText || q.correctText || '';
      return { ...q, options, correctOptions: options.filter(o => o.markedCorrect), correctText };
    });
  };

  async function getQuestionTemplateEnhanced({ requireAnswerKey = false } = {}) {
    let analytics = getQuestionAnalytics();
    if (requireAnswerKey && !analytics && isOnlineQuestions()) {
      try { analytics = await runDeepQuestionAnalysisEnhanced({ silent: true }); } catch {}
    }

    const firstResult = analytics?.results?.find(r => !r.error && r.questions?.length);
    if (firstResult) {
      const merged = mergeAnswerKeyIntoQuestions(firstResult.questions, analytics);
      if (!requireAnswerKey || merged.every(q => (q.options || []).some(o => o.markedCorrect) || q.correctText)) return merged;
    }

    const solved = (state.gradeData?.students || []).find(s => s.resultUrlVerified && s.resultUrl) ||
      (state.gradeData?.students || []).find(s => s.resultUrl);
    if (solved) {
      const doc = await fetchTextDocument(solved.resultUrl);
      const questions = mergeAnswerKeyIntoQuestions(parseQuestionCardsEnhanced(doc), analytics);
      if (questions.length && (!requireAnswerKey || questions.every(q => (q.options || []).some(o => o.markedCorrect) || q.correctText))) return questions;
    }

    const detailsUrl = findDetailsUrlEnhanced();
    if (detailsUrl) {
      const doc = await fetchTextDocument(detailsUrl);
      const questions = mergeAnswerKeyIntoQuestions(parseQuestionCardsEnhanced(doc), analytics);
      if (questions.length) {
        if (requireAnswerKey && !questions.every(q => (q.options || []).some(o => o.markedCorrect) || q.correctText)) {
          throw new Error('تعذر استنتاج مفتاح الإجابة لجميع الأسئلة من النتائج الحالية.');
        }
        return questions;
      }
    }

    const current = mergeAnswerKeyIntoQuestions(parseQuestionCardsEnhanced(document), analytics);
    if (current.length) {
      if (requireAnswerKey && !current.every(q => (q.options || []).some(o => o.markedCorrect) || q.correctText)) {
        throw new Error('تعذر استنتاج مفتاح الإجابة لجميع الأسئلة من النتائج الحالية.');
      }
      return current;
    }

    if (requireAnswerKey) throw new Error('لا يمكن إنشاء نموذج الإجابة قبل توفر نتيجة طالب تكشف مفتاح الإجابة.');
    throw new Error('لم أتمكن من العثور على بنية الأسئلة في الصفحات المتاحة.');
  };


  // -----------------------------
  // بناء التحليلات المرئية
  // -----------------------------
  const studentQuestionStats = (student) => {
    const analytics = getQuestionAnalytics();
    if (!analytics) return null;
    const key = String(student.assignmentStudentId || student.studentId || '');
    return analytics.studentMap?.[key] || null;
  };

  const getStatusLabel = (student) => {
    const mode = getMode();
    if (mode.key === 'outside_system') {
      return student.gradeState === 'recorded' ? 'درجة مرصودة' : 'التسليم غير قابل للتحقق';
    }
    if (student.submissionState === 'not_submitted') return 'لم يحل';
    if (student.gradeState === 'recorded') return 'تم الحل / مصحح';
    if (student.submissionState === 'submitted') return 'تم الحل / بانتظار الرصد';
    return 'غير محدد';
  };

  const performanceRows = () => {
    const { rows } = computeStudentLevels();
    return rows.sort((a, b) => {
      if (a.level.rank !== b.level.rank) return a.level.rank - b.level.rank;
      if (Number.isFinite(a.percent) && Number.isFinite(b.percent)) return b.percent - a.percent;
      return clean(a.student.name).localeCompare(clean(b.student.name), 'ar');
    });
  };

  const metricHtml = (value, label, hint = '') => `
    <div class="${APP}-metric ${APP}-metric-v12">
      <b>${value}</b><span>${esc(label)}</span>${hint ? `<small>${esc(hint)}</small>` : ''}
    </div>`;

  const levelCardsHtml = () => {
    const { counts, total } = computeStudentLevels();
    const visible = levelOrder.filter(([key]) => (counts[key] || 0) > 0 || ['excellent','very-good','good','acceptable','weak','not-solved'].includes(key));
    return visible.map(([key, label]) => `
      <div class="${APP}-level-card ${APP}-level-${key}">
        <strong>${counts[key] || 0}</strong>
        <span>${esc(label)}</span>
        <small>${total ? pct(counts[key] || 0, total) : 0}% من الطلاب</small>
      </div>`).join('');
  };

  const questionSummaryCardsHtml = () => {
    const a = getQuestionAnalytics();
    if (!a) {
      return `<div class="${APP}-analysis-note">تحليل الأسئلة سيظهر بعد جمع نتائج الطلاب. استخدم «تحديث التحليل».</div>`;
    }
    const s = a.summary;
    return `
      <div class="${APP}-question-metrics">
        ${metricHtml(s.questionCount, 'عدد الأسئلة')}
        ${metricHtml(`${fmt(s.correctRate)}%`, 'الإجابات الصحيحة')}
        ${metricHtml(`${fmt(s.incorrectRate)}%`, 'الإجابات الخاطئة')}
        ${metricHtml(s.unansweredResponses, 'إجابات متروكة')}
        ${metricHtml(s.hardest ? `س${s.hardest.number}` : '—', 'أصعب سؤال', s.hardest ? `${fmt(s.hardest.correctRate)}% صحة` : '')}
        ${metricHtml(s.easiest ? `س${s.easiest.number}` : '—', 'أسهل سؤال', s.easiest ? `${fmt(s.easiest.correctRate)}% صحة` : '')}
      </div>`;
  };

  const buildStudentTableRows = () => performanceRows().map((row, index) => {
    const s = row.student;
    const qs = studentQuestionStats(s);
    const achieved = resolvedAchievedGrade(s);
    const maxGrade = resolvedMaxGrade(s);
    const discrepancyHint = s.gradeDiscrepancy
      ? `<div class="${APP}-tiny ${APP}-grade-warning">⚠ درجة صفحة الرصد: ${fmt(num(s.gradeFieldValue), 4)}</div>`
      : '';
    return `<tr>
      <td>${index + 1}</td>
      <td><b>${esc(s.name || '—')}</b></td>
      <td>${esc(s.className || '—')}</td>
      <td>${esc(getStatusLabel(s))}</td>
      <td>${Number.isFinite(achieved) ? `${fmt(achieved, 4)} / ${fmt(maxGrade, 4)}${discrepancyHint}` : '—'}</td>
      <td>${Number.isFinite(row.percent) ? `${fmt(row.percent)}%` : '—'}</td>
      <td><span class="${APP}-level-pill ${APP}-level-${row.level.key}">${esc(row.level.label)}</span></td>
      ${isOnlineQuestions() ? `<td>${qs?.correct ?? '—'}</td><td>${qs?.incorrect ?? '—'}</td><td>${qs?.unanswered ?? '—'}</td>` : ''}
    </tr>`;
  }).join('');

  const buildQuestionTableRows = () => {
    const a = getQuestionAnalytics();
    if (!a) return '';
    return a.questions.map(q => `<tr>
      <td>${q.number}</td>
      <td><b>${esc(q.text || '—')}</b><div class="${APP}-tiny">${esc(q.correctText ? `الإجابة الصحيحة: ${q.correctText}` : '')}</div></td>
      <td>${esc(q.type || '—')}</td>
      <td>${Number.isFinite(q.maxScore) ? fmt(q.maxScore, 4) : '—'}</td>
      <td>${q.participants}</td>
      <td>${q.correct}</td>
      <td>${q.incorrect}</td>
      <td>${q.unanswered}</td>
      <td>${fmt(q.correctRate)}%</td>
      <td><span class="${APP}-difficulty ${q.difficulty === 'صعب' ? 'hard' : q.difficulty === 'متوسط' ? 'medium' : 'easy'}">${esc(q.difficulty)}</span></td>
      <td>${q.mostCommonWrong ? `${esc(q.mostCommonWrong.text)} <small>(${q.mostCommonWrong.count})</small>` : '—'}</td>
    </tr>`).join('');
  };

  const buildInlineAnalysisHtml = () => {
    const data = state.gradeData;
    if (!data) return `<div class="${APP}-analysis-note">جاري تجهيز بيانات الواجب…</div>`;

    const gate = gradeReportGate(document);
    if (!gate.ready) {
      const endText = gate.timing?.endDate ? formatGradeTimingDate(gate.timing.endDate) : 'غير متاح';
      const serverText = gate.timing?.serverDate ? formatGradeTimingDate(gate.timing.serverDate) : 'غير متاح';
      return `
        <section class="${APP}-analysis-section ${APP}-analysis-overview">
          <div class="${APP}-analysis-heading">
            <div>
              <h3>${gate.status === 'receiving' ? 'الواجب قيد الاستقبال' : 'تعذر التحقق من اكتمال الواجب'}</h3>
              <p>${esc(gate.message)}</p>
            </div>
            <span class="${APP}-pill">v${VERSION}</span>
          </div>
          <div class="${APP}-overview-metrics">
            ${metricHtml(gate.status === 'receiving' ? 'قيد الاستقبال' : 'غير متحقق', 'حالة التقرير', 'لا تُحتسب بيانات الأداء الآن')}
            ${metricHtml(endText, 'نهاية استقبال الحلول')}
            ${metricHtml(serverText, 'وقت خادم مدرستي')}
          </div>
          <div class="${APP}-analysis-note ${APP}-analysis-warning">
            لا يتم عرض نسبة الإنجاز أو المتوسط أو «لم يحل» قبل انتهاء وقت النشر، لأن هذه القيم ما زالت قابلة للتغير. تبقى أدوات الرصد والاستيراد وطباعة نموذج الأسئلة متاحة.
          </div>
        </section>`;
    }

    const s = computeEnhancedSummary();
    const outside = isOutsideSystem();
    const qa = getQuestionAnalytics();

    const topMetrics = outside
      ? [
          metricHtml(s.total ?? 0, 'عدد الطلاب'),
          metricHtml(s.graded ?? 0, 'درجات مرصودة'),
          metricHtml(`${fmt(s.gradingRate ?? 0)}%`, 'نسبة الرصد'),
          metricHtml(Number.isFinite(s.averagePercent) ? `${fmt(s.averagePercent)}%` : '—', 'متوسط الأداء'),
          metricHtml(Number.isFinite(s.highestPercent) ? `${fmt(s.highestPercent)}%` : '—', 'أعلى نتيجة'),
          metricHtml(Number.isFinite(s.lowestPercent) ? `${fmt(s.lowestPercent)}%` : '—', 'أدنى نتيجة مرصودة')
        ].join('')
      : [
          metricHtml(s.total ?? 0, 'عدد الطلاب'),
          metricHtml(s.submittedCount ?? 0, 'حلوا الواجب'),
          metricHtml(s.notSubmittedCount ?? 0, 'لم يحلوا'),
          metricHtml(`${fmt(s.submissionRate ?? 0)}%`, 'نسبة الإنجاز'),
          metricHtml(Number.isFinite(s.averagePercent) ? `${fmt(s.averagePercent)}%` : '—', 'متوسط الأداء'),
          metricHtml(Number.isFinite(s.highestPercent) ? `${fmt(s.highestPercent)}%` : '—', 'أعلى نتيجة'),
          metricHtml(Number.isFinite(s.lowestPercent) ? `${fmt(s.lowestPercent)}%` : '—', 'أدنى نتيجة')
        ].join('');

    const questionSection = outside
      ? `<div class="${APP}-analysis-note ${APP}-analysis-note-muted">هذا الواجب «خارج النظام»؛ لذلك لا تعرض مدرستي بنية أسئلة أو إجابات يمكن تحليلها. تحليل الدرجات والطلاب أدناه يظل متاحًا.</div>`
      : `
        <section class="${APP}-analysis-section">
          <div class="${APP}-analysis-heading"><div><h3>تحليل الأسئلة والإجابات</h3><p>نسب الصحة والخطأ والأسئلة الأصعب والأخطاء الأكثر شيوعًا.</p></div></div>
          ${questionSummaryCardsHtml()}
          ${qa ? `<details class="${APP}-details" open><summary>تفاصيل الأسئلة (${qa.questions.length})</summary>
            <div class="${APP}-table-wrap"><table class="${APP}-table ${APP}-analysis-table">
              <thead><tr><th>#</th><th>السؤال</th><th>النوع</th><th>درجة السؤال</th><th>الطلاب</th><th>صحيح</th><th>خطأ</th><th>لم يجب</th><th>نسبة الصحة</th><th>الصعوبة</th><th>أكثر خطأ شيوعًا</th></tr></thead>
              <tbody>${buildQuestionTableRows()}</tbody>
            </table></div>
          </details>` : ''}
        </section>`;

    return `
      <section class="${APP}-analysis-section ${APP}-analysis-overview">
        <div class="${APP}-analysis-heading">
          <div><h3>تحليل الواجب</h3><p>${esc(data.assignmentMode?.label || 'الواجب')} · تحديث: ${new Date().toLocaleString('ar-SA')}</p></div>
          <span class="${APP}-pill">v${VERSION}</span>
        </div>
        <div class="${APP}-overview-metrics">${topMetrics}</div>
        ${s.discrepancyCount ? `<div class="${APP}-analysis-note ${APP}-analysis-warning">⚠ تم اكتشاف ${s.discrepancyCount} حالة تعارض بين درجة صفحة الرصد ودرجة صفحة نتيجة الطالب. اعتمد التحليل درجة صفحة النتيجة.</div>` : ''}
      </section>

      <section class="${APP}-analysis-section">
        <div class="${APP}-analysis-heading"><div><h3>مستويات الطلاب</h3><p>«ضعيف» يشمل 50% فأقل لمن لديه درجة، و«لم يحل» فئة مستقلة.</p></div></div>
        <div class="${APP}-level-grid">${levelCardsHtml()}</div>
      </section>

      ${questionSection}

      <section class="${APP}-analysis-section">
        <div class="${APP}-analysis-heading"><div><h3>تقييم الطلاب</h3><p>الحالة والدرجة والنسبة والمستوى${outside ? '.' : ' مع ملخص إجابات كل طالب.'}</p></div></div>
        <div class="${APP}-table-wrap"><table class="${APP}-table ${APP}-analysis-table">
          <thead><tr><th>#</th><th>الطالب</th><th>الفصل</th><th>الحالة</th><th>الدرجة</th><th>النسبة</th><th>المستوى</th>${isOnlineQuestions() ? '<th>صحيح</th><th>خطأ</th><th>لم يجب</th>' : ''}</tr></thead>
          <tbody>${buildStudentTableRows()}</tbody>
        </table></div>
      </section>`;
  };

  const renderInlineAnalysis = () => {
    const summary = document.getElementById(`${APP}-summary`);
    if (summary) summary.style.display = 'none';

    let host = document.getElementById(`${APP}-analysis-inline`);
    if (!host) {
      host = document.createElement('div');
      host.id = `${APP}-analysis-inline`;
      const panel = document.getElementById(`${APP}-panel`);
      const rights = panel?.querySelector(`.${APP}-rights`);
      if (panel && rights) panel.insertBefore(host, rights);
      else panel?.appendChild(host);
    }
    if (host) host.innerHTML = buildInlineAnalysisHtml();
    syncActionAvailability();
  };

  // -----------------------------
  // نافذة التحليل الموسعة
  // -----------------------------
  const showModal = (title, html) => {
    const modal = document.getElementById(`${APP}-modal`);
    const titleEl = document.getElementById(`${APP}-modal-title`);
    const body = document.getElementById(`${APP}-modal-body`);
    if (!modal || !body) throw new Error('تعذر فتح نافذة مدير الواجبات.');
    if (titleEl) titleEl.textContent = title;
    body.innerHTML = html;
    modal.hidden = false;
  };

  const openDashboardEnhanced = () => {
    assertFinalReportReady();
    if (!state.gradeData) throw new Error('حدّث التحليل أولًا.');
    showModal('لوحة تحليل الواجب', buildInlineAnalysisHtml());
  };

  const openQuestionAnalyticsEnhanced = async () => {
    assertFinalReportReady();
    if (isOutsideSystem()) throw new Error('تحليل الأسئلة غير متاح لواجبات «خارج النظام».');
    let a = getQuestionAnalytics();
    if (!a) a = await runDeepQuestionAnalysisEnhanced();
    showModal('تحليل الأسئلة', `
      ${questionSummaryCardsHtml()}
      <div class="${APP}-table-wrap"><table class="${APP}-table ${APP}-analysis-table">
        <thead><tr><th>#</th><th>السؤال</th><th>النوع</th><th>درجة السؤال</th><th>الطلاب</th><th>صحيح</th><th>خطأ</th><th>لم يجب</th><th>نسبة الصحة</th><th>الصعوبة</th><th>أكثر خطأ شيوعًا</th></tr></thead>
        <tbody>${buildQuestionTableRows()}</tbody>
      </table></div>`);
  };

  // -----------------------------
  // Print / PDF — فتح النافذة قبل أي await لمنع popup blocker
  // -----------------------------
  const openPrintShell = (title) => {
    const w = window.open('', '_blank');
    if (!w) {
      throw new Error('تعذر فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة لموقع مدرستي ثم أعد المحاولة.');
    }
    try { w.opener = null; } catch {}
    w.document.open();
    w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${esc(title)}</title></head>
      <body style="font-family:Tahoma,Arial,sans-serif;direction:rtl;padding:32px;text-align:center"><h3>جارٍ تجهيز ${esc(title)}…</h3></body></html>`);
    w.document.close();
    return w;
  };

  const renderPrintDocument = (w, title, bodyHtml, { autoPrint = true } = {}) => {
    const css = `
      @page{size:A4;margin:12mm}
      *{box-sizing:border-box}
      body{font-family:Tahoma,Arial,sans-serif;direction:rtl;color:#111827;margin:0;font-size:12px;line-height:1.65}
      h1{font-size:22px;margin:0} h2{font-size:16px;margin:0 0 10px} h3{font-size:13px;margin:0}
      .header{border-bottom:3px solid #111827;padding-bottom:12px;margin-bottom:16px;display:flex;justify-content:space-between;gap:20px;align-items:flex-end}
      .muted{color:#6b7280}.small{font-size:10px}.nowrap{white-space:nowrap}
      .cards{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0 16px}
      .card{border:1px solid #d1d5db;border-radius:10px;padding:10px;break-inside:avoid}.card b{display:block;font-size:18px}.card span{color:#6b7280}
      .levels{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin:10px 0 16px}.level{border:1px solid #d1d5db;border-radius:9px;padding:8px;text-align:center}.level b{font-size:16px;display:block}
      .section{margin:18px 0;break-inside:auto}.section-title{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #9ca3af;padding-bottom:6px;margin-bottom:8px}
      table{width:100%;border-collapse:collapse;font-size:10px}th,td{border:1px solid #d1d5db;padding:6px;text-align:right;vertical-align:top}th{background:#f3f4f6;font-weight:700}
      tr{break-inside:avoid}.page-break{break-before:page}.q{border:1px solid #d1d5db;border-radius:9px;padding:10px;margin:8px 0;break-inside:avoid}.qhead{display:flex;justify-content:space-between;gap:10px;font-weight:700}.opts{list-style:none;padding:0;margin:8px 0}.opts li{padding:3px 0}.correct{font-weight:700}.badge{display:inline-block;border:1px solid #9ca3af;border-radius:999px;padding:2px 6px;font-size:9px}
      .footer{margin-top:20px;border-top:1px solid #d1d5db;padding-top:8px;color:#6b7280;font-size:9px;display:flex;justify-content:space-between}
      .print-actions{position:fixed;left:15px;bottom:15px;z-index:10}.print-actions button{padding:10px 16px;border:0;border-radius:8px;background:#111827;color:#fff;font-weight:700;cursor:pointer}
      @media print{.print-actions{display:none}.page-break{break-before:page}}
    `;

    w.document.open();
    w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${css}</style></head><body>
      <div class="print-actions"><button onclick="window.print()">طباعة / حفظ PDF</button></div>
      ${bodyHtml}
      </body></html>`);
    w.document.close();
    if (autoPrint) {
      w.setTimeout(() => { try { w.focus(); w.print(); } catch {} }, 450);
    }
  };

  const printHeaderHtml = (documentLabel, { compact = false, assignmentName = '' } = {}) => {
    const data = state.gradeData;
    const name = assignmentName || data?.assignmentName || (isUsableAssignmentName(data?.title) ? cleanAssignmentNameCandidate(data.title) : '') || 'واجب مدرستي';
    if (compact) {
      return `<div class="header compact-header">
        <div><h1>${esc(name)}</h1><div class="muted">${esc(documentLabel)}</div></div>
      </div>`;
    }

    const classes = [...new Set((data?.students || []).map(s => clean(s.className)).filter(Boolean))].join('، ');
    return `<div class="header">
      <div><h1>${esc(name)}</h1><div class="muted">${esc(documentLabel)}</div></div>
      <div class="small">${esc(data?.assignmentMode?.label || '')}<br>${classes ? `الفصل/الفصول: ${esc(classes)}` : ''}<br>${new Date().toLocaleString('ar-SA')}</div>
    </div>`;
  };

  const questionPaperCss = `
    @page{size:A4;margin:12mm}
    *{box-sizing:border-box}
    body{font-family:Tahoma,Arial,sans-serif;direction:rtl;color:#111827;margin:0;font-size:13px;line-height:1.7}
    .paper-head{border-bottom:3px solid #111827;padding-bottom:12px;margin-bottom:14px}
    .paper-head h1{font-size:24px;margin:0 0 3px}.paper-head .sub{font-size:12px;color:#4b5563}.paper-meta{font-size:10px;color:#6b7280;margin-top:5px}
    .student-fields{display:none;border:1px solid #9ca3af;border-radius:8px;padding:9px 12px;margin:10px 0 14px;grid-template-columns:1fr 1fr;gap:18px}
    body.student-copy .student-fields{display:grid}
    .q{border:1px solid #d1d5db;border-radius:9px;padding:11px 12px;margin:9px 0;break-inside:avoid}
    .qhead{display:flex;justify-content:space-between;gap:12px;font-weight:700}.qgrade{white-space:nowrap;font-size:11px;color:#4b5563}
    .opts{list-style:none;padding:0;margin:8px 0 0}.opts li{padding:4px 7px;border-radius:6px;margin:2px 0}.choice-marker{display:inline-block;min-width:20px;font-weight:800}
    .correct-choice{font-weight:700;background:#f3f4f6}.correct-label{font-size:9px;border:1px solid #9ca3af;border-radius:999px;padding:1px 6px;margin-right:8px;white-space:nowrap}
    body.student-copy .correct-choice{font-weight:400;background:transparent}body.student-copy .correct-label{display:none}
    body.teacher-copy .student-marker{display:none}body.student-copy .teacher-marker{display:none}
    .print-actions{position:fixed;left:14px;bottom:14px;z-index:20;display:flex;gap:6px;flex-wrap:wrap;max-width:calc(100vw - 28px)}
    .print-actions button{padding:9px 12px;border:1px solid #d1d5db;border-radius:8px;background:#fff;color:#111827;font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.08)}
    .print-actions button.primary{background:#111827;color:#fff;border-color:#111827}
    .print-actions button.active{outline:2px solid #111827;outline-offset:1px}
    @media print{.print-actions{display:none}.q{border-color:#9ca3af}.correct-choice{background:#f3f4f6!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}body.student-copy .correct-choice{background:transparent!important}}
  `;

  const renderQuestionPaperDocument = (w, assignmentName, questions) => {
    const total = questions.map(q => num(q.maxScore)).filter(Number.isFinite).reduce((a, b) => a + b, 0);
    const meta = `${questions.length} ${questions.length === 1 ? 'سؤال' : 'أسئلة'}${Number.isFinite(total) && total > 0 ? ` · الدرجة الكلية: ${fmt(total, 4)}` : ''}`;
    const body = `
      <div class="print-actions">
        <button id="teacherMode" class="active" onclick="setCopyMode('teacher')">نسخة المعلم · مع الإجابات</button>
        <button id="studentMode" onclick="setCopyMode('student')">نسخة الطالب · بدون إجابات</button>
        <button class="primary" onclick="window.print()">طباعة / حفظ PDF</button>
      </div>
      <header class="paper-head">
        <h1>${esc(assignmentName)}</h1>
        <div class="sub" id="paperModeLabel">نموذج أسئلة الواجب والإجابة</div>
        <div class="paper-meta">${esc(meta)}</div>
      </header>
      <div class="student-fields"><div>اسم الطالب: ....................................................................</div><div>الفصل: ....................................................</div></div>
      ${questions.map(q => `
        <section class="q">
          <div class="qhead"><span>السؤال ${q.number}: ${esc(q.text)}</span><span class="qgrade">${Number.isFinite(q.maxScore) ? `${fmt(q.maxScore, 4)} درجة` : ''}</span></div>
          ${(q.options || []).length ? `<ul class="opts">${q.options.map(o => {
            const correct = !!o.markedCorrect;
            return `<li class="${correct ? 'correct-choice' : ''}">
              <span class="choice-marker"><span class="teacher-marker">${correct ? '✓' : '○'}</span><span class="student-marker">○</span></span>${esc(o.text)}${correct ? '<span class="correct-label">الإجابة الصحيحة</span>' : ''}
            </li>`;
          }).join('')}</ul>` : (q.correctText ? `<div class="correct-label">الإجابة الصحيحة: ${esc(q.correctText)}</div>` : '')}
        </section>`).join('')}`;

    const script = `
      function setCopyMode(mode){
        document.body.classList.toggle('teacher-copy', mode === 'teacher');
        document.body.classList.toggle('student-copy', mode === 'student');
        document.getElementById('teacherMode')?.classList.toggle('active', mode === 'teacher');
        document.getElementById('studentMode')?.classList.toggle('active', mode === 'student');
        const label = document.getElementById('paperModeLabel');
        if (label) label.textContent = mode === 'teacher' ? 'نموذج أسئلة الواجب والإجابة' : 'أسئلة الواجب';
        document.title = ${JSON.stringify(assignmentName)} + (mode === 'teacher' ? ' — نموذج الإجابة' : ' — أسئلة الواجب');
      }
      setCopyMode('teacher');`;

    w.document.open();
    w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${esc(assignmentName)} — نموذج الإجابة</title><style>${questionPaperCss}</style></head><body class="teacher-copy">${body}<script>${script}<\/script></body></html>`);
    w.document.close();
  };

  async function printQuestionsEnhanced() {
    if (isOutsideSystem()) throw new Error('الأسئلة ونموذج الإجابة غير متاحين لواجب «خارج النظام».');
    const w = openPrintShell('طباعة أسئلة الواجب');
    try {
      const [assignmentName, questions] = await Promise.all([
        resolveAssignmentNameEnhanced({ allowFetch: true }),
        getQuestionTemplateEnhanced({ requireAnswerKey: true })
      ]);
      renderQuestionPaperDocument(w, assignmentName, questions);
    } catch (e) {
      renderPrintDocument(w, 'طباعة أسئلة الواجب', `<div class="header"><h1>تعذر تجهيز أسئلة الواجب</h1></div><div class="card"><div>${esc(String(e?.message || e))}</div></div>`, { autoPrint: false });
      throw e;
    }
  }

  const printLevelGrid = () => {
    const { counts, total } = computeStudentLevels();
    return levelOrder
      .filter(([key]) => (counts[key] || 0) > 0 || ['excellent','very-good','good','acceptable','weak','not-solved'].includes(key))
      .map(([key, label]) => `<div class="level"><b>${counts[key] || 0}</b><span>${esc(label)}</span><div class="small muted">${total ? pct(counts[key] || 0, total) : 0}%</div></div>`).join('');
  };

  const buildAssignmentPrintReport = () => {
    const data = state.gradeData;
    const s = computeEnhancedSummary();
    const outside = isOutsideSystem();
    const qa = getQuestionAnalytics();

    const cards = outside
      ? [
          [s.total ?? 0, 'عدد الطلاب'], [s.graded ?? 0, 'درجات مرصودة'], [`${fmt(s.gradingRate ?? 0)}%`, 'نسبة الرصد'],
          [Number.isFinite(s.averagePercent) ? `${fmt(s.averagePercent)}%` : '—', 'متوسط الأداء'], [Number.isFinite(s.highestPercent) ? `${fmt(s.highestPercent)}%` : '—', 'أعلى نتيجة'], [Number.isFinite(s.lowestPercent) ? `${fmt(s.lowestPercent)}%` : '—', 'أدنى نتيجة']
        ]
      : [
          [s.total ?? 0, 'عدد الطلاب'], [s.submittedCount ?? 0, 'حلوا الواجب'], [s.notSubmittedCount ?? 0, 'لم يحلوا'],
          [`${fmt(s.submissionRate ?? 0)}%`, 'نسبة الإنجاز'], [Number.isFinite(s.averagePercent) ? `${fmt(s.averagePercent)}%` : '—', 'متوسط الأداء'],
          [Number.isFinite(s.highestPercent) ? `${fmt(s.highestPercent)}%` : '—', 'أعلى نتيجة'], [Number.isFinite(s.lowestPercent) ? `${fmt(s.lowestPercent)}%` : '—', 'أدنى نتيجة']
        ];

    const studentRows = performanceRows().map((row, i) => {
      const st = row.student;
      const qs = studentQuestionStats(st);
      const achieved = resolvedAchievedGrade(st);
      const maxGrade = resolvedMaxGrade(st);
      const discrepancy = st.gradeDiscrepancy
        ? `<div class="small muted">تعارض: صفحة الرصد ${fmt(num(st.gradeFieldValue),4)}</div>`
        : '';
      return `<tr><td>${i + 1}</td><td>${esc(st.name || '—')}</td><td>${esc(st.className || '—')}</td><td>${esc(getStatusLabel(st))}</td><td>${Number.isFinite(achieved) ? `${fmt(achieved,4)} / ${fmt(maxGrade,4)}${discrepancy}` : '—'}</td><td>${Number.isFinite(row.percent) ? `${fmt(row.percent)}%` : '—'}</td><td>${esc(row.level.label)}</td>${!outside ? `<td>${qs?.correct ?? '—'}</td><td>${qs?.incorrect ?? '—'}</td><td>${qs?.unanswered ?? '—'}</td>` : ''}</tr>`;
    }).join('');

    const questionReport = !outside && qa ? `<div class="section page-break">
      <div class="section-title"><h2>تحليل الأسئلة</h2><span class="muted">${qa.questions.length} سؤال</span></div>
      <div class="cards">
        <div class="card"><b>${fmt(qa.summary.correctRate)}%</b><span>نسبة الإجابات الصحيحة</span></div>
        <div class="card"><b>${qa.summary.hardest ? `س${qa.summary.hardest.number}` : '—'}</b><span>أصعب سؤال${qa.summary.hardest ? ` · ${fmt(qa.summary.hardest.correctRate)}%` : ''}</span></div>
        <div class="card"><b>${qa.summary.easiest ? `س${qa.summary.easiest.number}` : '—'}</b><span>أسهل سؤال${qa.summary.easiest ? ` · ${fmt(qa.summary.easiest.correctRate)}%` : ''}</span></div>
      </div>
      <table><thead><tr><th>#</th><th>السؤال</th><th>الدرجة</th><th>صحيح</th><th>خطأ</th><th>لم يجب</th><th>نسبة الصحة</th><th>التصنيف</th><th>أكثر خطأ شيوعًا</th></tr></thead><tbody>
        ${qa.questions.map(q => `<tr><td>${q.number}</td><td>${esc(q.text)}${q.correctText ? `<div class="small muted">الصحيح: ${esc(q.correctText)}</div>` : ''}</td><td>${Number.isFinite(q.maxScore) ? fmt(q.maxScore,4) : '—'}</td><td>${q.correct}</td><td>${q.incorrect}</td><td>${q.unanswered}</td><td>${fmt(q.correctRate)}%</td><td>${esc(q.difficulty)}</td><td>${q.mostCommonWrong ? `${esc(q.mostCommonWrong.text)} (${q.mostCommonWrong.count})` : '—'}</td></tr>`).join('')}
      </tbody></table>
    </div>` : outside ? `<div class="section"><div class="card"><b>ملاحظة</b><span>هذا الواجب خارج النظام، لذلك لا تتوفر بيانات موثوقة لتحليل الأسئلة أو حالة التسليم داخل مدرستي.</span></div></div>` : '';

    const discrepancyNote = s.discrepancyCount
      ? `<div class="section"><div class="card"><b>تنبيه تعارض بيانات</b><span>اكتشف النظام ${s.discrepancyCount} حالة اختلفت فيها درجة صفحة الرصد عن صفحة نتيجة الطالب؛ تم اعتماد صفحة النتيجة في هذا التقرير.</span></div></div>`
      : '';

    return `${printHeaderHtml('تقرير الواجب')}
      <div class="section"><div class="section-title"><h2>الملخص التنفيذي</h2></div><div class="cards">${cards.map(([v,l]) => `<div class="card"><b>${v}</b><span>${esc(l)}</span></div>`).join('')}</div></div>
      ${discrepancyNote}
      <div class="section"><div class="section-title"><h2>توزيع مستويات الطلاب</h2><span class="muted">ضعيف = 50% فأقل لمن لديه درجة</span></div><div class="levels">${printLevelGrid()}</div></div>
      <div class="section"><div class="section-title"><h2>تقرير الطلاب</h2></div><table><thead><tr><th>#</th><th>الطالب</th><th>الفصل</th><th>الحالة</th><th>الدرجة</th><th>النسبة</th><th>المستوى</th>${!outside ? '<th>صحيح</th><th>خطأ</th><th>لم يجب</th>' : ''}</tr></thead><tbody>${studentRows}</tbody></table></div>
      ${questionReport}
      <div class="footer"><span>تم إنشاء التقرير بواسطة Madrasati Assignment Intelligence v${VERSION}</span><span>Mohammed Almalki (M0HM3D85)</span></div>`;
  };


  async function printAssignmentReportEnhanced() {
    assertFinalReportReady();
    const w = openPrintShell('تقرير الواجب');
    try {
      if (!state.gradeData) await refreshEnhanced(false);
      if (isOnlineQuestions() && !getQuestionAnalytics() && (state.gradeData?.students || []).some(s => s.submissionState === 'submitted' || s.hasAnswer === true)) {
        await runDeepQuestionAnalysisEnhanced({ silent: true });
      }
      renderPrintDocument(w, `${state.gradeData?.assignmentName || state.gradeData?.title || 'الواجب'} — تقرير الواجب`, buildAssignmentPrintReport());
    } catch (e) {
      renderPrintDocument(w, 'تقرير الواجب', `<div class="header"><h1>تقرير الواجب</h1></div><div class="card"><b>تعذر تجهيز التقرير</b><div>${esc(String(e?.message || e))}</div></div>`, { autoPrint: false });
      throw e;
    }
  }

  // -----------------------------
  // Export
  // -----------------------------
  const exportRowsEnhanced = () => performanceRows().map(row => {
    const s = row.student;
    const qs = studentQuestionStats(s);
    return {
      'الطالب': s.name || '',
      'الفصل': s.className || '',
      'حساب الطالب': s.account || '',
      'StudentId': s.studentId || s.assignmentStudentId || '',
      'الحالة': getStatusLabel(s),
      'الدرجة': Number.isFinite(resolvedAchievedGrade(s)) ? resolvedAchievedGrade(s) : '',
      'الدرجة الكلية': Number.isFinite(resolvedMaxGrade(s)) ? resolvedMaxGrade(s) : '',
      'درجة صفحة الرصد': Number.isFinite(num(s.gradeFieldValue ?? s.currentGrade)) ? num(s.gradeFieldValue ?? s.currentGrade) : '',
      'مصدر الدرجة': Number.isFinite(num(s.resultGrade)) ? 'صفحة نتيجة الطالب' : 'صفحة الرصد',
      'تعارض الدرجة': s.gradeDiscrepancy ? 'نعم' : 'لا',
      'النسبة': Number.isFinite(row.percent) ? row.percent : '',
      'المستوى': row.level.label,
      'صحيح': qs?.correct ?? '',
      'خطأ': qs?.incorrect ?? '',
      'لم يجب': qs?.unanswered ?? '',
      'الملاحظة': s.feedback || ''
    };
  });

  const downloadText = (name, text, mime) => {
    const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
  };

  const dateStamp = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };

  function exportCSVEnhanced() {
    assertFinalReportReady();
    const data = exportRowsEnhanced();
    if (!data.length) throw new Error('لا توجد بيانات طلاب قابلة للتصدير.');
    const headers = Object.keys(data[0] || {});
    const lines = [headers.map(csvCell).join(',')];
    for (const row of data) lines.push(headers.map(h => csvCell(row[h])).join(','));
    downloadText(`madrasati-assignment-analysis-${dateStamp()}.csv`, '\uFEFF' + lines.join('\n'), 'text/csv;charset=utf-8');
  }

  function exportExcelEnhanced() {
    assertFinalReportReady();
    const data = exportRowsEnhanced();
    if (!data.length) throw new Error('لا توجد بيانات طلاب قابلة للتصدير.');
    if (!globalThis.XLSX) return exportCSVEnhanced();
    const wb = XLSX.utils.book_new();
    const studentsWs = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, studentsWs, 'Students');
    const qa = getQuestionAnalytics();
    if (qa?.questions?.length) {
      const questionData = qa.questions.map(q => ({
        '#': q.number,
        'السؤال': q.text,
        'النوع': q.type,
        'درجة السؤال': Number.isFinite(q.maxScore) ? q.maxScore : '',
        'المشاركون': q.participants,
        'صحيح': q.correct,
        'خطأ': q.incorrect,
        'لم يجب': q.unanswered,
        'غير محسوم': q.unknown || 0,
        'نسبة الصحة': q.correctRate,
        'الصعوبة': q.difficulty,
        'الإجابة الصحيحة': q.correctText,
        'أكثر خطأ شيوعًا': q.mostCommonWrong?.text || '',
        'تكرار الخطأ': q.mostCommonWrong?.count || 0
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(questionData), 'Questions');
    }
    XLSX.writeFile(wb, `madrasati-assignment-analysis-${dateStamp()}.xlsx`);
  }

  // -----------------------------
  // Refresh + cache
  // -----------------------------
  let enhancedRefreshRunning = false;
  let summaryObserver = null;
  let summaryObserverTimer = null;

  async function refreshEnhanced(forceRegistry = false) {
    if (enhancedRefreshRunning) return state.gradeData;
    enhancedRefreshRunning = true;
    setStatus('جاري جمع بيانات الواجب…', true);
    try {
      await base.refreshAll(forceRegistry);
      await resolveAssignmentNameEnhanced({ allowFetch: true });
      state.enhancedQuestionAnalytics = null;
      state.questionAnalytics = null;

      const gate = gradeReportGate(document);
      if (!gate.ready) {
        renderInlineAnalysis();
        const panelSub = document.querySelector(`#${APP}-panel .${APP}-sub`);
        if (panelSub) {
          panelSub.textContent = `${gate.label} · التقرير النهائي مؤجل — v${VERSION}`;
          panelSub.title = gate.message;
        }
        syncActionAvailability();
        toast(gate.message, gate.status === 'receiving' ? 'info' : 'error');
        return state.gradeData;
      }

      if (isOnlineQuestions() && (state.gradeData?.students || []).some(s => s.submissionState === 'submitted' || s.hasAnswer === true)) {
        try {
          await runDeepQuestionAnalysisEnhanced({ silent: true });
        } catch (e) {
          console.warn('[MAI v1.4.2] Question analysis skipped:', e);
        }
      }

      renderInlineAnalysis();
      const panelSub = document.querySelector(`#${APP}-panel .${APP}-sub`);
      if (panelSub) {
        const currentGate = gradeReportGate(document);
        panelSub.textContent = currentGate.ready
          ? `الواجب منتهي · التحليل والتقرير النهائي متاحان — v${VERSION}`
          : `${currentGate.label} · التقرير النهائي مؤجل — v${VERSION}`;
        panelSub.title = currentGate.message;
      }
      toast('تم تحديث تحليل الواجب والبطاقات.', 'success');
      return state.gradeData;
    } finally {
      enhancedRefreshRunning = false;
      setStatus('جاهز', false);
    }
  }

  const setupBaseSummaryObserver = () => {
    const summary = document.getElementById(`${APP}-summary`);
    if (!summary || summaryObserver) return;
    summaryObserver = new MutationObserver(() => {
      if (enhancedRefreshRunning) return;
      clearTimeout(summaryObserverTimer);
      summaryObserverTimer = setTimeout(async () => {
        if (enhancedRefreshRunning || !state.gradeData) return;
        try {
          state.enhancedQuestionAnalytics = null;
          state.questionAnalytics = null;
          const gate = gradeReportGate(document);
          if (!gate.ready) {
            renderInlineAnalysis();
            syncActionAvailability();
            return;
          }
          if (isOnlineQuestions() && (state.gradeData?.students || []).some(s => s.submissionState === 'submitted' || s.hasAnswer === true)) {
            try { await runDeepQuestionAnalysisEnhanced({ silent: true }); } catch (e) { console.warn('[MAI v1.4.2] Post-base refresh analysis skipped:', e); }
          }
          renderInlineAnalysis();
        } catch (e) {
          console.warn('[MAI v1.4.2] UI sync after base update failed:', e);
        }
      }, 650);
    });
    summaryObserver.observe(summary, { childList: true, subtree: true });
  };


  // -----------------------------
  // UI replacement
  // -----------------------------
  const addEnhancedStyles = () => {
    if (document.getElementById(`${APP}-v12-style`)) return;
    const style = document.createElement('style');
    style.id = `${APP}-v12-style`;
    style.textContent = `
      #${APP}-analysis-inline{margin-top:14px;display:flex;flex-direction:column;gap:12px}
      .${APP}-analysis-section{border:1px solid #e5e7eb;border-radius:15px;padding:14px;background:#fff}
      .${APP}-analysis-overview{background:linear-gradient(180deg,#fff,#f8fafc)}
      .${APP}-analysis-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}
      .${APP}-analysis-heading h3{font-size:16px;margin:0;color:#111827}.${APP}-analysis-heading p{margin:3px 0 0;color:#6b7280;font-size:11px}
      .${APP}-overview-metrics,.${APP}-question-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px}
      .${APP}-metric-v12{background:#fff;border:1px solid #e5e7eb;border-radius:13px;padding:13px 11px;min-height:86px;display:flex;flex-direction:column;justify-content:center}.${APP}-metric-v12 b{font-size:23px;line-height:1.15}.${APP}-metric-v12 span{font-size:11px;font-weight:800;margin-top:5px}.${APP}-metric-v12 small{display:block;margin-top:3px;color:#6b7280;font-size:9px}
      .${APP}-level-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}
      .${APP}-level-card{border:1px solid #e5e7eb;border-radius:12px;padding:10px;text-align:center;background:#fafafa}.${APP}-level-card strong{display:block;font-size:21px}.${APP}-level-card span{display:block;font-weight:800;font-size:11px}.${APP}-level-card small{font-size:9px;color:#6b7280}
      .${APP}-level-pill{display:inline-block;padding:4px 8px;border-radius:999px;font-size:10px;font-weight:800;white-space:nowrap}
      .${APP}-level-excellent{background:#dcfce7!important;color:#166534}.${APP}-level-very-good{background:#dbeafe!important;color:#1d4ed8}.${APP}-level-good{background:#e0e7ff!important;color:#4338ca}.${APP}-level-acceptable{background:#fef3c7!important;color:#92400e}.${APP}-level-weak{background:#fee2e2!important;color:#991b1b}.${APP}-level-not-solved{background:#f3f4f6!important;color:#374151}.${APP}-level-pending,.${APP}-level-unverified{background:#f3e8ff!important;color:#6b21a8}
      .${APP}-analysis-note{padding:12px;border-radius:11px;background:#eff6ff;color:#1e40af;font-size:11px;margin-top:10px}.${APP}-analysis-note-muted{background:#f3f4f6;color:#4b5563}.${APP}-analysis-warning{background:#fff7ed;color:#9a3412;border:1px solid #fed7aa}.${APP}-grade-warning{color:#b45309;margin-top:3px}
      .${APP}-details{margin-top:10px}.${APP}-details summary{cursor:pointer;font-weight:800;font-size:12px;margin-bottom:8px}
      .${APP}-analysis-table td{line-height:1.6}.${APP}-difficulty{display:inline-block;padding:3px 7px;border-radius:999px;font-size:9px;font-weight:800}.${APP}-difficulty.hard{background:#fee2e2;color:#991b1b}.${APP}-difficulty.medium{background:#fef3c7;color:#92400e}.${APP}-difficulty.easy{background:#dcfce7;color:#166534}
      .${APP}-btn[data-mode-disabled="1"]{opacity:.45;cursor:not-allowed!important;background:#f3f4f6!important;color:#6b7280!important}.${APP}-btn[data-running="1"]{opacity:.65;cursor:wait!important;pointer-events:none}
      .${APP}-collapse-btn{border:1px solid #d1d5db;background:#fff;border-radius:9px;padding:6px 10px;font-size:10px;font-weight:800;cursor:pointer;white-space:nowrap}.${APP}-head-tools{display:flex;align-items:center;gap:8px}
      #${APP}-panel.${APP}-collapsed>.${APP}-toolbar,#${APP}-panel.${APP}-collapsed>#${APP}-summary,#${APP}-panel.${APP}-collapsed>#${APP}-analysis-inline,#${APP}-panel.${APP}-collapsed>.${APP}-rights{display:none!important}
      @media(max-width:1100px){.${APP}-level-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
      @media(max-width:650px){.${APP}-level-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.${APP}-overview-metrics,.${APP}-question-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}
    `;
    document.head.appendChild(style);
  };

  const syncActionAvailability = () => {
    const outside = isOutsideSystem();
    const gate = gradeReportGate(document);
    const questionActions = new Set(['questions','printQuestions']);
    const finalReportActions = new Set(['dashboard','questions','printStudents','csv','excel']);
    const buttons = document.querySelectorAll(`#${APP}-panel [data-${APP.toLowerCase()}-action]`);

    for (const btn of buttons) {
      const action = btn.dataset[`${APP.toLowerCase()}Action`] || '';
      let disabled = false;
      let title = '';

      if (questionActions.has(action) && outside) {
        disabled = true;
        title = 'هذه الميزة غير متاحة لواجبات خارج النظام.';
      }

      if (finalReportActions.has(action) && !gate.ready) {
        disabled = true;
        title = gate.message;
      }

      btn.dataset.modeDisabled = disabled ? '1' : '0';
      btn.disabled = disabled;
      btn.title = title;
    }
  };

  const setPanelCollapsed = (panel, collapsed) => {
    if (!panel) return;
    panel.classList.toggle(`${APP}-collapsed`, !!collapsed);
    const btn = panel.querySelector(`[data-${APP.toLowerCase()}-collapse]`);
    if (btn) {
      btn.textContent = collapsed ? 'فتح اللوحة' : 'طي اللوحة';
      btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    }
    try { localStorage.setItem(PANEL_COLLAPSE_KEY, collapsed ? '1' : '0'); } catch {}
  };

  const installPanelCollapse = (panel) => {
    const head = panel?.querySelector?.(`.${APP}-head`);
    const status = panel?.querySelector?.(`#${APP}-status`);
    if (!head || !status) return;

    let tools = head.querySelector(`.${APP}-head-tools`);
    if (!tools) {
      tools = document.createElement('div');
      tools.className = `${APP}-head-tools`;
      status.parentElement?.insertBefore(tools, status);
      tools.appendChild(status);
    }

    let btn = tools.querySelector(`[data-${APP.toLowerCase()}-collapse]`);
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `${APP}-collapse-btn`;
      btn.dataset[`${APP.toLowerCase()}Collapse`] = '1';
      tools.appendChild(btn);
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        setPanelCollapsed(panel, !panel.classList.contains(`${APP}-collapsed`));
      });
    }

    let collapsed = false;
    try { collapsed = localStorage.getItem(PANEL_COLLAPSE_KEY) === '1'; } catch {}
    setPanelCollapsed(panel, collapsed);
  };

  const replacePanelToolbar = () => {
    const oldPanel = document.getElementById(`${APP}-panel`);
    if (!oldPanel) return null;

    // clone يزيل مستمع النواة القديم عن اللوحة فقط، بينما نبقي الـ modal الأصلي
    // لأن استيراد الدرجات في v1.1.7 يعتمد على مستمعه الداخلي.
    const panel = oldPanel.cloneNode(true);
    oldPanel.replaceWith(panel);

    const title = panel.querySelector(`.${APP}-title`);
    if (title) title.textContent = 'مدير الواجبات الذكي — تحليل متقدم';
    const sub = panel.querySelector(`.${APP}-sub`);
    if (sub) {
      const gate = gradeReportGate(document);
      sub.textContent = gate.ready
        ? `الواجب منتهي · التحليل والتقرير النهائي متاحان — v${VERSION}`
        : `${gate.label} · التقرير النهائي مؤجل — v${VERSION}`;
      sub.title = gate.message;
    }

    installPanelCollapse(panel);

    const toolbar = panel.querySelector(`.${APP}-toolbar`);
    if (toolbar) {
      toolbar.innerHTML = `
        <button class="${APP}-btn ${APP}-primary" data-${APP.toLowerCase()}-action="refresh">تحديث التحليل</button>
        <button class="${APP}-btn" data-${APP.toLowerCase()}-action="identity">مزامنة الهوية</button>
        <button class="${APP}-btn ${APP}-primary" data-${APP.toLowerCase()}-action="importGrades">استيراد درجات Excel / CSV</button>
        <button class="${APP}-btn" data-${APP.toLowerCase()}-action="dashboard">عرض لوحة موسعة</button>
        <button class="${APP}-btn" data-${APP.toLowerCase()}-action="questions">تحليل الأسئلة</button>
        <button class="${APP}-btn" data-${APP.toLowerCase()}-action="printQuestions">طباعة الأسئلة / النموذج</button>
        <button class="${APP}-btn ${APP}-primary" data-${APP.toLowerCase()}-action="printStudents">تقرير الواجب / PDF</button>
        <button class="${APP}-btn" data-${APP.toLowerCase()}-action="csv">CSV</button>
        <button class="${APP}-btn" data-${APP.toLowerCase()}-action="excel">Excel</button>`;
    }

    panel.addEventListener('click', async (event) => {
      const btn = event.target.closest?.(`[data-${APP.toLowerCase()}-action]`);
      if (!btn || btn.disabled || btn.dataset.modeDisabled === '1' || btn.dataset.running === '1') return;
      const action = btn.dataset[`${APP.toLowerCase()}Action`];
      if (!action) return;

      const originalText = btn.textContent;
      btn.dataset.running = '1';
      btn.setAttribute('aria-busy', 'true');
      if (!['dashboard','csv','excel'].includes(action)) btn.textContent = `${originalText}…`;

      try {
        if (action === 'refresh') await refreshEnhanced(false);
        else if (action === 'identity') {
          setStatus('جاري مزامنة الهوية…', true);
          await base.buildIdentityBridge(true, state.gradeData?.students || []);
          await refreshEnhanced(false);
        }
        else if (action === 'importGrades') await base.openImportWizard();
        else if (action === 'dashboard') openDashboardEnhanced();
        else if (action === 'questions') await openQuestionAnalyticsEnhanced();
        else if (action === 'printQuestions') await printQuestionsEnhanced();
        else if (action === 'printStudents') await printAssignmentReportEnhanced();
        else if (action === 'csv') exportCSVEnhanced();
        else if (action === 'excel') exportExcelEnhanced();
        else throw new Error(`إجراء غير معروف: ${action}`);
      } catch (e) {
        console.error('[MAI v1.4.2] Action failed:', action, e);
        toast(String(e?.message || e), 'error');
      } finally {
        btn.dataset.running = '0';
        btn.removeAttribute('aria-busy');
        btn.textContent = originalText;
        setStatus('جاهز', false);
        syncActionAvailability();
      }
    });

    return panel;
  };

  const restoreCache = () => {
    if (!gradeReportGate(document).ready) return false;
    const cached = loadEnhancedCache();
    if (!cached?.analytics) return false;
    state.enhancedQuestionAnalytics = cached.analytics;
    state.questionAnalytics = cached.analytics;
    if (state.gradeData && cached.analytics?.results) applyResultGradesToStudents(cached.analytics.results);
    return true;
  };

  async function bootstrapGrade() {
    addEnhancedStyles();

    // انتظر حتى تنتهي النواة من حقن واجهتها.
    for (let i = 0; i < 40 && !document.getElementById(`${APP}-panel`); i++) await sleep(100);
    const panel = replacePanelToolbar();
    if (!panel) return;

    try { base.version = VERSION; } catch {}
    const hadCache = restoreCache();
    if (state.gradeData) renderInlineAnalysis();
    setupBaseSummaryObserver();

    // نعرض الكاش فورًا إن وجد، ثم نجري تحديثًا حقيقيًا واحدًا لضمان أن البطاقات والأزرار تعتمد أحدث بيانات.
    try {
      await refreshEnhanced(false);
    } catch (e) {
      if (!hadCache) renderInlineAnalysis();
      toast(`تعذر التحديث التلقائي: ${String(e?.message || e)}`, 'error');
    }
  }

  // =====================================================================
  // Assignments Index — لوحة الواجبات الشاملة
  // =====================================================================
  const indexState = {
    assignments: [],
    publications: null,
    deep: null,
    busy: false,
    collectedAt: null,
    indexPagesScanned: 0,
    indexStopReason: '',
    indexCollectionMode: 'current'
  };

  const indexPanelId = `${APP}-index-panel`;
  const INDEX_MAX_PAGES = 100;

  const indexCardSelector = '.list-group .dga-defualt-card';

  const safeAbsoluteUrl = (href) => {
    if (!href) return '';
    try { return new URL(href, location.origin).href; }
    catch { return ''; }
  };

  const parseIndexPathSegments = (pathText) => clean(pathText)
    .split(/\s*-\s*/)
    .map(clean)
    .filter(Boolean);

  const parseIndexAssignmentCard = (card, index = 0) => {
    const title = clean(card.querySelector('h4.mb-1')?.textContent || '');
    const infoNode = card.querySelector('.flex-fill.mb-2.mb-sm-0') || card;
    const infoText = clean(infoNode.innerText || infoNode.textContent || '');

    const source = clean(infoText.match(/مصدر\s+الواجب\s*:\s*(.+?)(?=\s+طريقة\s+عرض\s+الواجب\s*:|\s+درجة\s+الواجب\s*:|$)/i)?.[1] || '');
    const displayMode = clean(infoText.match(/طريقة\s+عرض\s+الواجب\s*:\s*(.+?)(?=\s+درجة\s+الواجب\s*:|$)/i)?.[1] || '');
    const grade = num(infoText.match(/درجة\s+الواجب\s*:\s*([\d٠-٩۰-۹.,]+)/i)?.[1]);

    let curriculumPath = infoText;
    if (title && curriculumPath.startsWith(title)) curriculumPath = clean(curriculumPath.slice(title.length));
    const sourcePos = curriculumPath.search(/مصدر\s+الواجب\s*:/i);
    if (sourcePos >= 0) curriculumPath = clean(curriculumPath.slice(0, sourcePos));
    curriculumPath = curriculumPath.replace(/^[-–—\s]+|[-–—\s]+$/g, '').trim();

    const pathSegments = parseIndexPathSegments(curriculumPath);
    const course = pathSegments.length >= 3 ? pathSegments[pathSegments.length - 3] : '';
    const unit = pathSegments.length >= 2 ? pathSegments[pathSegments.length - 2] : '';
    const topic = pathSegments.length >= 1 ? pathSegments[pathSegments.length - 1] : '';

    const viewAnchor = card.querySelector('a[href*="/Teacher/Assignments/ViewAssignment/"]');
    const publishAnchor = card.querySelector('a[href*="/Teacher/Assignments/PublishAssignment"]');
    const publishedAnchor = card.querySelector('a[href*="/Teacher/Assignments/PublishedAssignments"]');

    const viewUrl = safeAbsoluteUrl(viewAnchor?.getAttribute('href'));
    const publishUrl = safeAbsoluteUrl(publishAnchor?.getAttribute('href'));
    const publishedUrl = safeAbsoluteUrl(publishedAnchor?.getAttribute('href'));
    const assignmentGuid = viewUrl.match(/\/ViewAssignment\/([A-F0-9]{32})/i)?.[1] ||
      publishedUrl.match(/[?&]assignmentId=([A-F0-9]{32})/i)?.[1] || '';

    const activationEl = [...card.querySelectorAll('[onclick]')]
      .find(el => /showActivateConfirmation\s*\(/i.test(el.getAttribute('onclick') || ''));
    const activationCode = activationEl?.getAttribute('onclick') || '';
    const internalId = activationCode.match(/showActivateConfirmation\s*\(\s*['"]?(\d+)['"]?/i)?.[1] || '';
    const action = activationCode.match(/showActivateConfirmation\s*\([^,]+,\s*['"](activate|deactivate)['"]/i)?.[1] || '';
    const active = action === 'deactivate' ? true : action === 'activate' ? false : null;

    return {
      index: index + 1,
      title,
      curriculumPath,
      pathSegments,
      course,
      unit,
      topic,
      source,
      displayMode,
      grade,
      active,
      internalId,
      assignmentGuid,
      viewUrl,
      publishUrl,
      publishedUrl
    };
  };

  const parseIndexAssignmentsFromDocument = (doc = document) => {
    const cards = [...doc.querySelectorAll(indexCardSelector)]
      .filter(card => card.querySelectorAll('a[href*="/Teacher/Assignments/ViewAssignment/"]').length === 1);

    const assignments = cards
      .map(parseIndexAssignmentCard)
      .filter(a => a.title && a.assignmentGuid);

    const unique = new Map();
    for (const a of assignments) if (!unique.has(a.assignmentGuid)) unique.set(a.assignmentGuid, a);
    return [...unique.values()];
  };

  const indexScopeUrl = () => {
    try { return new URL(location.pathname, location.origin).href; }
    catch { return location.origin + location.pathname; }
  };

  const indexPageUrl = (pageNumber = 1) => {
    const url = new URL(indexScopeUrl());
    url.searchParams.set('pageNumber', String(pageNumber));
    return url.href;
  };

  const collectIndexAssignments = () => {
    const assignments = parseIndexAssignmentsFromDocument(document);
    indexState.assignments = assignments.map((a, i) => ({ ...a, index: i + 1 }));
    indexState.collectedAt = new Date().toISOString();
    indexState.indexPagesScanned = assignments.length ? 1 : 0;
    indexState.indexStopReason = 'current_dom';
    indexState.indexCollectionMode = 'current';
    return indexState.assignments;
  };

  async function collectAllIndexAssignments({ silent = false } = {}) {
    const unique = new Map();
    let pagesScanned = 0;
    let stopReason = '';
    let firstPageFailed = false;

    for (let pageNumber = 1; pageNumber <= INDEX_MAX_PAGES; pageNumber++) {
      if (!silent) setIndexBusy(true, `جاري قراءة صفحة الواجبات ${pageNumber}…`);

      let doc = null;
      try {
        doc = await fetchTextDocument(indexPageUrl(pageNumber));
      } catch (e) {
        if (pageNumber === 1) firstPageFailed = true;
        stopReason = `fetch_error:${pageNumber}`;
        console.warn(`[MAI v${VERSION}] Could not fetch Index page ${pageNumber}:`, e);
        break;
      }

      const rows = parseIndexAssignmentsFromDocument(doc);

      // أول صفحة فارغة قد تعني أن GET تغيّر مستقبلاً؛ عندها نحتفظ بالـDOM الحالي بدل فقد البيانات.
      if (!rows.length) {
        stopReason = pageNumber === 1 ? 'empty_first_page' : 'empty_page';
        break;
      }

      pagesScanned++;
      let newCount = 0;
      for (const row of rows) {
        if (!unique.has(row.assignmentGuid)) {
          unique.set(row.assignmentGuid, row);
          newCount++;
        }
      }

      // حماية من أي خادم يعيد الصفحة نفسها مهما تغير pageNumber.
      if (pageNumber > 1 && newCount === 0) {
        stopReason = 'duplicate_page';
        break;
      }

      if (pageNumber === INDEX_MAX_PAGES) stopReason = 'max_pages';
    }

    // احتياط: لو تعذر جلب الصفحة الأولى نستخدم بطاقات الصفحة المفتوحة.
    if (!unique.size) {
      const fallback = parseIndexAssignmentsFromDocument(document);
      for (const row of fallback) if (!unique.has(row.assignmentGuid)) unique.set(row.assignmentGuid, row);
      if (fallback.length && !pagesScanned) pagesScanned = 1;
      if (firstPageFailed) stopReason = 'fallback_current_dom';
    }

    indexState.assignments = [...unique.values()].map((a, i) => ({ ...a, index: i + 1 }));
    indexState.collectedAt = new Date().toISOString();
    indexState.indexPagesScanned = pagesScanned;
    indexState.indexStopReason = stopReason || 'done';
    indexState.indexCollectionMode = 'all_pages';
    return indexState.assignments;
  }

  const loadIndexPublicationsCache = () => {
    const cached = safeJSONParse(localStorage.getItem(INDEX_PUBLICATIONS_CACHE_KEY), null);
    if (!cached || cached.pageUrl !== indexScopeUrl() || !cached.byGuid) return null;
    const current = new Set(indexState.assignments.map(a => a.assignmentGuid));
    const cachedKeys = Object.keys(cached.byGuid || {});
    if (!cachedKeys.some(k => current.has(k))) return null;
    indexState.publications = cached;
    return cached;
  };

  const saveIndexPublicationsCache = (cache) => {
    try { localStorage.setItem(INDEX_PUBLICATIONS_CACHE_KEY, JSON.stringify(cache)); } catch {}
  };

  const loadIndexDeepCache = () => {
    const cached = safeJSONParse(localStorage.getItem(INDEX_DEEP_CACHE_KEY), null);
    if (!cached || cached.pageUrl !== indexScopeUrl() || !cached.byGuid) return null;
    const current = new Set(indexState.assignments.map(a => a.assignmentGuid));
    if (!Object.keys(cached.byGuid || {}).some(k => current.has(k))) return null;
    indexState.deep = cached;
    return cached;
  };

  const saveIndexDeepCache = (cache) => {
    try { localStorage.setItem(INDEX_DEEP_CACHE_KEY, JSON.stringify(cache)); } catch {}
  };

  const publicationInfoFor = (assignment) => indexState.publications?.byGuid?.[assignment.assignmentGuid] || null;
  const deepInfoFor = (assignment) => indexState.deep?.byGuid?.[assignment.assignmentGuid] || null;

  // التقرير النهائي لا يُحتسب إلا بعد انتهاء جميع مرات نشر الواجب.
  // وجود أي نشر حالي يعني أن البيانات ما زالت قيد الاكتمال، لذلك نؤجل التقرير بالكامل.
  const reportEligibilityFor = (assignment) => {
    const pub = publicationInfoFor(assignment);
    if (!pub) return { eligible: false, status: 'unscanned', label: 'لم يتم فحص المنشورات', current: 0, ended: 0 };

    const deep = deepInfoFor(assignment);
    if (deep?.reportStatus === 'receiving_server_verified') {
      return { eligible: false, status: 'receiving', label: 'قيد الاستقبال (وقت الخادم)', current: Number(pub.currentGradeLinks || 0), ended: Number(pub.endedGradeLinks || 0) };
    }
    if (deep?.reportStatus === 'timing_unverified') {
      return { eligible: false, status: 'scan_incomplete', label: 'تعذر التحقق من وقت النهاية', current: Number(pub.currentGradeLinks || 0), ended: Number(pub.endedGradeLinks || 0) };
    }

    const current = Number(pub.currentGradeLinks || pub.current?.gradeLinks?.length || 0);
    const ended = Number(pub.endedGradeLinks || pub.ended?.gradeLinks?.length || 0);
    const currentOk = Array.isArray(pub.current?.errors) ? pub.current.errors.length === 0 : false;
    const endedOk = Array.isArray(pub.ended?.errors) ? pub.ended.errors.length === 0 : false;

    if (current > 0) return { eligible: false, status: 'receiving', label: 'قيد الاستقبال', current, ended };
    if (!currentOk || !endedOk) return { eligible: false, status: 'scan_incomplete', label: 'فحص المنشورات غير مكتمل', current, ended };
    if (ended > 0) return { eligible: true, status: 'ready', label: 'مكتمل', current, ended };
    return { eligible: false, status: 'no_publications', label: 'لا توجد منشورات منتهية', current, ended };
  };

  const summarizeIndexAssignments = () => {
    const rows = indexState.assignments || [];
    const grades = rows.map(r => r.grade).filter(Number.isFinite);
    const totalGrade = grades.reduce((a, b) => a + b, 0);
    const averageGrade = grades.length ? totalGrade / grades.length : null;
    const activeCount = rows.filter(r => r.active === true).length;
    const disabledCount = rows.filter(r => r.active === false).length;
    const sourceCounts = {};
    for (const row of rows) {
      const k = row.source || 'غير محدد';
      sourceCounts[k] = (sourceCounts[k] || 0) + 1;
    }
    const publicationLinks = rows.reduce((sum, row) => sum + (publicationInfoFor(row)?.gradeLinks?.length || 0), 0);
    const publishedAssignments = rows.filter(row => (publicationInfoFor(row)?.gradeLinks?.length || 0) > 0).length;
    const reportReadyCount = rows.filter(row => reportEligibilityFor(row).eligible).length;
    const reportReceivingCount = rows.filter(row => reportEligibilityFor(row).status === 'receiving').length;
    const reportDeferredCount = rows.filter(row => ['receiving','scan_incomplete'].includes(reportEligibilityFor(row).status)).length;
    const deepItems = rows.map(deepInfoFor).filter(x => x && x.analysisAvailable !== false && x.reportStatus !== 'receiving' && x.publicationsAnalyzed > 0);
    const deepStudentRecords = deepItems.reduce((sum, x) => sum + (x.studentRecords || 0), 0);
    const deepSubmitted = deepItems.reduce((sum, x) => sum + (x.submitted || 0), 0);
    const deepNotSubmitted = deepItems.reduce((sum, x) => sum + (x.notSubmitted || 0), 0);
    const deepScoreCount = deepItems.reduce((sum, x) => sum + (x.scoreCount || 0), 0);
    const deepScoreSum = deepItems.reduce((sum, x) => sum + (x.scorePercentSum || 0), 0);

    return {
      total: rows.length,
      activeCount,
      disabledCount,
      unknownStatusCount: rows.length - activeCount - disabledCount,
      totalGrade,
      averageGrade,
      highestGrade: grades.length ? Math.max(...grades) : null,
      lowestGrade: grades.length ? Math.min(...grades) : null,
      sourceCounts,
      uniqueSources: Object.keys(sourceCounts).length,
      publicationLinks,
      publishedAssignments,
      reportReadyCount,
      reportReceivingCount,
      reportDeferredCount,
      publicationsScanned: !!indexState.publications,
      deepScanned: !!indexState.deep,
      deepStudentRecords,
      deepSubmitted,
      deepNotSubmitted,
      deepAveragePercent: deepScoreCount ? deepScoreSum / deepScoreCount : null
    };
  };

  const indexStatusLabel = (row) => row.active === true ? 'مفعّل' : row.active === false ? 'معطل' : 'غير محدد';

  const indexMetric = (value, label, hint = '') => `
    <div class="${APP}-idx-metric">
      <strong>${esc(value)}</strong>
      <span>${esc(label)}</span>
      ${hint ? `<small>${esc(hint)}</small>` : ''}
    </div>`;

  const renderIndexPanel = () => {
    const panel = document.getElementById(indexPanelId);
    if (!panel) return;

    const summary = summarizeIndexAssignments();
    const sourceHtml = Object.entries(summary.sourceCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => `<span class="${APP}-idx-chip">${esc(name)} <b>${count}</b></span>`)
      .join('');

    const body = panel.querySelector(`.${APP}-idx-body`);
    if (!body) return;

    body.innerHTML = `
      <div class="${APP}-idx-metrics">
        ${indexMetric(summary.total, 'إجمالي الواجبات', indexState.indexPagesScanned ? `من ${indexState.indexPagesScanned} صفحة` : '')}
        ${indexMetric(summary.activeCount, 'مفعّلة', summary.disabledCount ? `${summary.disabledCount} معطل` : '')}
        ${indexMetric(fmt(summary.totalGrade, 4), 'مجموع الدرجات')}
        ${indexMetric(Number.isFinite(summary.averageGrade) ? fmt(summary.averageGrade, 4) : '—', 'متوسط درجة الواجب')}
        ${indexMetric(Number.isFinite(summary.highestGrade) ? fmt(summary.highestGrade, 4) : '—', 'أعلى درجة')}
        ${indexMetric(Number.isFinite(summary.lowestGrade) ? fmt(summary.lowestGrade, 4) : '—', 'أقل درجة')}
        ${indexMetric(summary.publicationsScanned ? summary.publicationLinks : '—', 'روابط رصد مكتشفة', summary.publicationsScanned ? `${summary.publishedAssignments} واجب له رصد` : 'اضغط فحص المنشورات')}
        ${indexMetric(summary.deepScanned && Number.isFinite(summary.deepAveragePercent) ? `${fmt(summary.deepAveragePercent)}%` : '—', 'متوسط الأداء العام', summary.deepScanned ? `${summary.deepStudentRecords} سجل طالب · ${summary.reportReceivingCount} قيد الاستقبال` : 'للواجبات المنتهية فقط')}
      </div>

      ${sourceHtml ? `<div class="${APP}-idx-sources"><b>مصادر الواجبات:</b>${sourceHtml}</div>` : ''}

      <div class="${APP}-idx-note">
        يجمع «تحديث السجل» جميع صفحات إدارة الواجبات تلقائيًا ويزيل التكرار بالـ Assignment GUID. «فحص المنشورات» يكتشف الحالية والمنتهية، أما تقرير الأداء فلا يُحتسب إلا للواجب الذي انتهت جميع مرات نشره؛ أي واجب ما زال قيد الاستقبال يُؤجل تقريره حتى ينتهي.
      </div>

      <div class="${APP}-idx-table-wrap">
        <table class="${APP}-idx-table">
          <thead><tr>
            <th>#</th><th>الواجب</th><th>المقرر</th><th>الوحدة / الموضوع</th><th>المصدر</th><th>الدرجة</th><th>الحالة</th><th>الرصد</th><th>نسبة الحل</th><th>المتوسط</th><th>لم يحل</th><th>روابط</th>
          </tr></thead>
          <tbody>
            ${(indexState.assignments || []).map(row => {
              const pub = publicationInfoFor(row);
              const deep = deepInfoFor(row);
              const reportState = reportEligibilityFor(row);
              const pubCount = pub ? (pub.gradeLinks?.length || 0) : null;
              const pubCell = !pub
                ? '—'
                : pub.error && !pub.scanComplete
                  ? `تعذر<div class="${APP}-idx-tiny error">فشل فحص المنشورات</div>`
                  : pubCount > 0
                    ? `${pubCount}<div class="${APP}-idx-tiny">${pub.currentGradeLinks || 0} حالي · ${pub.endedGradeLinks || 0} منتهي</div>${reportState.status === 'receiving' ? `<div class="${APP}-idx-tiny">التقرير مؤجل حتى انتهاء الاستقبال</div>` : ''}`
                    : `لا يوجد<div class="${APP}-idx-tiny">0 رابط رصد مكتشف</div>`;
              const deepAvailable = !!(reportState.eligible && deep && deep.analysisAvailable !== false && deep.publicationsAnalyzed > 0);
              return `<tr>
                <td>${row.index}</td>
                <td><b>${esc(row.title)}</b>${row.internalId ? `<div class="${APP}-idx-tiny">ID: ${esc(row.internalId)}</div>` : ''}</td>
                <td>${esc(row.course || '—')}</td>
                <td>${esc([row.unit, row.topic].filter(Boolean).join(' ← ') || '—')}</td>
                <td>${esc(row.source || '—')}<div class="${APP}-idx-tiny">${esc(row.displayMode || '')}</div></td>
                <td>${Number.isFinite(row.grade) ? fmt(row.grade, 4) : '—'}</td>
                <td><span class="${APP}-idx-status ${row.active === true ? 'on' : row.active === false ? 'off' : ''}">${esc(indexStatusLabel(row))}</span></td>
                <td>${pubCell}</td>
                <td>${reportState.status === 'receiving' ? '<b>قيد الاستقبال</b>' : deepAvailable ? (deep.submissionVerifiable ? `${fmt(deep.submissionRate)}%` : 'غير متاح') : '—'}</td>
                <td>${deepAvailable && Number.isFinite(deep.averagePercent) ? `${fmt(deep.averagePercent)}%` : '—'}${deepAvailable && deep?.gradeDiscrepancies ? `<div class="${APP}-idx-tiny error">${deep.gradeDiscrepancies} تعارض درجة</div>` : ''}</td>
                <td>${deepAvailable ? (deep.submissionVerifiable ? deep.notSubmitted : '—') : '—'}</td>
                <td class="${APP}-idx-links">
                  ${row.viewUrl ? `<a href="${esc(row.viewUrl)}" target="_blank" rel="noopener">استعراض</a>` : ''}
                  ${row.publishedUrl ? `<a href="${esc(row.publishedUrl)}" target="_blank" rel="noopener">المرسلة</a>` : ''}
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  };

  const setIndexBusy = (busy, text = '') => {
    indexState.busy = !!busy;
    const panel = document.getElementById(indexPanelId);
    if (!panel) return;
    const status = panel.querySelector(`.${APP}-idx-status-text`);
    if (status) {
      const pages = indexState.indexPagesScanned ? ` · ${indexState.indexPagesScanned} صفحة` : '';
      status.textContent = busy ? (text || 'جارٍ المعالجة…') : `جاهز · ${indexState.assignments.length} واجب${pages}`;
    }
    panel.querySelectorAll(`[data-${APP.toLowerCase()}-index-action]`).forEach(btn => { btn.disabled = !!busy; });
  };

  const setIndexCollapsed = (panel, collapsed) => {
    if (!panel) return;
    panel.classList.toggle(`${APP}-idx-collapsed`, !!collapsed);
    const btn = panel.querySelector(`[data-${APP.toLowerCase()}-index-collapse]`);
    if (btn) {
      btn.textContent = collapsed ? 'فتح اللوحة' : 'طي اللوحة';
      btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    }
    try { localStorage.setItem(INDEX_COLLAPSE_KEY, collapsed ? '1' : '0'); } catch {}
  };

  const addIndexStyles = () => {
    if (document.getElementById(`${APP}-index-style`)) return;
    const style = document.createElement('style');
    style.id = `${APP}-index-style`;
    style.textContent = `
      #${indexPanelId}{direction:rtl;font-family:Tahoma,Arial,sans-serif;border:1px solid #dbe3ee;border-radius:14px;background:#fff;margin:14px 0 18px;overflow:hidden;box-shadow:0 4px 18px rgba(15,23,42,.06)}
      #${indexPanelId} .${APP}-idx-head{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:14px 16px;background:linear-gradient(135deg,#f8fafc,#eef6ff);border-bottom:1px solid #e5e7eb}
      #${indexPanelId} .${APP}-idx-title{font-size:18px;font-weight:900;color:#111827;margin:0}#${indexPanelId} .${APP}-idx-sub{font-size:11px;color:#64748b;margin-top:4px}
      #${indexPanelId} .${APP}-idx-head-tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}#${indexPanelId} .${APP}-idx-status-text{font-size:10px;color:#64748b;font-weight:700}
      #${indexPanelId} button{font-family:inherit}#${indexPanelId} .${APP}-idx-collapse,#${indexPanelId} .${APP}-idx-btn{border:1px solid #cbd5e1;background:#fff;color:#0f172a;border-radius:9px;padding:7px 10px;font-size:10px;font-weight:800;cursor:pointer}
      #${indexPanelId} .${APP}-idx-btn.primary{background:#0f172a;color:#fff;border-color:#0f172a}#${indexPanelId} .${APP}-idx-btn:disabled{opacity:.55;cursor:wait}
      #${indexPanelId} .${APP}-idx-toolbar{display:flex;gap:7px;flex-wrap:wrap;padding:11px 14px;border-bottom:1px solid #eef2f7;background:#fff}
      #${indexPanelId} .${APP}-idx-body{padding:14px}#${indexPanelId}.${APP}-idx-collapsed .${APP}-idx-toolbar,#${indexPanelId}.${APP}-idx-collapsed .${APP}-idx-body{display:none!important}
      #${indexPanelId} .${APP}-idx-metrics{display:grid;grid-template-columns:repeat(8,minmax(105px,1fr));gap:8px;margin-bottom:12px}
      #${indexPanelId} .${APP}-idx-metric{border:1px solid #e5e7eb;border-radius:11px;padding:10px;text-align:center;background:#fafafa;min-height:76px;display:flex;flex-direction:column;justify-content:center}
      #${indexPanelId} .${APP}-idx-metric strong{font-size:21px;color:#111827;line-height:1.2}#${indexPanelId} .${APP}-idx-metric span{font-size:10px;font-weight:800;color:#475569;margin-top:4px}#${indexPanelId} .${APP}-idx-metric small{font-size:9px;color:#94a3b8;margin-top:2px}
      #${indexPanelId} .${APP}-idx-sources{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:10px;margin:8px 0 10px;color:#475569}#${indexPanelId} .${APP}-idx-chip{background:#f1f5f9;border:1px solid #e2e8f0;padding:4px 7px;border-radius:999px}
      #${indexPanelId} .${APP}-idx-note{font-size:10px;line-height:1.7;color:#475569;background:#f8fafc;border:1px solid #e2e8f0;border-radius:9px;padding:8px 10px;margin-bottom:10px}
      #${indexPanelId} .${APP}-idx-table-wrap{overflow:auto;border:1px solid #e5e7eb;border-radius:10px}#${indexPanelId} .${APP}-idx-table{width:100%;border-collapse:collapse;min-width:1220px;font-size:10px}
      #${indexPanelId} .${APP}-idx-table th,#${indexPanelId} .${APP}-idx-table td{border-bottom:1px solid #edf2f7;padding:8px 7px;text-align:right;vertical-align:top}#${indexPanelId} .${APP}-idx-table th{background:#f8fafc;position:sticky;top:0;z-index:1;font-weight:900;color:#334155}
      #${indexPanelId} .${APP}-idx-table tr:last-child td{border-bottom:0}#${indexPanelId} .${APP}-idx-tiny{font-size:8px;color:#94a3b8;margin-top:2px}#${indexPanelId} .${APP}-idx-tiny.error{color:#b91c1c}
      #${indexPanelId} .${APP}-idx-status{display:inline-block;padding:3px 7px;border-radius:999px;background:#f1f5f9;color:#475569;font-weight:800}#${indexPanelId} .${APP}-idx-status.on{background:#dcfce7;color:#166534}#${indexPanelId} .${APP}-idx-status.off{background:#fee2e2;color:#991b1b}
      #${indexPanelId} .${APP}-idx-links{white-space:nowrap}#${indexPanelId} .${APP}-idx-links a{display:inline-block;margin-left:5px;text-decoration:none;font-weight:800;color:#1d4ed8}
      @media(max-width:1200px){#${indexPanelId} .${APP}-idx-metrics{grid-template-columns:repeat(4,minmax(100px,1fr))}}@media(max-width:700px){#${indexPanelId} .${APP}-idx-head{align-items:flex-start;flex-direction:column}#${indexPanelId} .${APP}-idx-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}
    `;
    document.head.appendChild(style);
  };

  const createIndexPanel = () => {
    let panel = document.getElementById(indexPanelId);
    if (panel) return panel;

    panel = document.createElement('section');
    panel.id = indexPanelId;
    panel.innerHTML = `
      <div class="${APP}-idx-head">
        <div><div class="${APP}-idx-title">لوحة الواجبات الشاملة</div><div class="${APP}-idx-sub">سجل وتقارير صفحة إدارة الواجبات — v${VERSION}</div></div>
        <div class="${APP}-idx-head-tools"><span class="${APP}-idx-status-text">جاهز</span><button type="button" class="${APP}-idx-collapse" data-${APP.toLowerCase()}-index-collapse>طي اللوحة</button></div>
      </div>
      <div class="${APP}-idx-toolbar">
        <button type="button" class="${APP}-idx-btn primary" data-${APP.toLowerCase()}-index-action="refresh">تحديث السجل</button>
        <button type="button" class="${APP}-idx-btn" data-${APP.toLowerCase()}-index-action="publications">فحص المنشورات</button>
        <button type="button" class="${APP}-idx-btn primary" data-${APP.toLowerCase()}-index-action="deep">تحليل أداء الواجبات المنتهية</button>
        <button type="button" class="${APP}-idx-btn primary" data-${APP.toLowerCase()}-index-action="print">تقرير / PDF</button>
        <button type="button" class="${APP}-idx-btn" data-${APP.toLowerCase()}-index-action="csv">CSV</button>
        <button type="button" class="${APP}-idx-btn" data-${APP.toLowerCase()}-index-action="excel">Excel</button>
      </div>
      <div class="${APP}-idx-body"></div>`;

    // لا نستخدم أول .list-group في الصفحة؛ مدرستي تحتوي قوائم مخفية كثيرة في المودالات والقوائم العامة.
    // نربط اللوحة بقائمة الواجبات نفسها عبر أول بطاقة واجب مؤكدة.
    const firstAssignmentCard = document.querySelector(indexCardSelector);
    const assignmentList = firstAssignmentCard?.closest('.list-group') || null;
    const assignmentSection = firstAssignmentCard?.closest('.card') || null;

    if (assignmentList?.parentElement) {
      assignmentList.parentElement.insertBefore(panel, assignmentList);
    } else if (assignmentSection) {
      assignmentSection.prepend(panel);
    } else {
      (document.querySelector('#mainDiv .card-body') || document.querySelector('#mainDiv') || document.body).prepend(panel);
    }

    panel.querySelector(`[data-${APP.toLowerCase()}-index-collapse]`)?.addEventListener('click', () => {
      setIndexCollapsed(panel, !panel.classList.contains(`${APP}-idx-collapsed`));
    });

    panel.addEventListener('click', async (event) => {
      const btn = event.target.closest?.(`[data-${APP.toLowerCase()}-index-action]`);
      if (!btn || btn.disabled || indexState.busy) return;
      const action = btn.dataset[`${APP.toLowerCase()}IndexAction`];
      if (!action) return;

      try {
        if (action === 'refresh') {
          setIndexBusy(true, 'جاري تحديث سجل الواجبات من جميع الصفحات…');
          await collectAllIndexAssignments();
          loadIndexPublicationsCache();
          loadIndexDeepCache();
          renderIndexPanel();
          toast(`تمت قراءة ${indexState.assignments.length} واجبًا من ${indexState.indexPagesScanned || 1} صفحة.`, 'success');
        } else if (action === 'publications') {
          await auditIndexPublications();
        } else if (action === 'deep') {
          await runIndexDeepAnalysis();
        } else if (action === 'print') {
          printIndexReport();
        } else if (action === 'csv') {
          exportIndexCSV();
        } else if (action === 'excel') {
          exportIndexExcel();
        }
      } catch (e) {
        console.error('[MAI v1.4.2] Index action failed:', action, e);
        toast(String(e?.message || e), 'error');
      } finally {
        setIndexBusy(false);
      }
    });

    let collapsed = false;
    try { collapsed = localStorage.getItem(INDEX_COLLAPSE_KEY) === '1'; } catch {}
    setIndexCollapsed(panel, collapsed);
    return panel;
  };

  const extractGradeLinksFromPublishedDocument = (doc, meta = {}) => {
    const found = [];
    const push = (href, context = '') => {
      const abs = safeAbsoluteUrl(href);
      if (!/\/Teacher\/Assignments\/GradeAssignment\/[A-F0-9]{32}/i.test(abs)) return;
      if (!found.some(x => x.href === abs)) {
        found.push({
          href: abs,
          context: clean(context).slice(0, 520),
          publicationState: meta.publicationState || '',
          isDue: meta.isDue ?? null,
          pageNumber: meta.pageNumber || 1
        });
      }
    };

    for (const a of doc.querySelectorAll('a[href*="/Teacher/Assignments/GradeAssignment/"]')) {
      push(a.getAttribute('href'), a.closest('.dga-defualt-card,.card,tr,.list-group-item')?.innerText || a.parentElement?.innerText || a.innerText);
    }

    for (const el of doc.querySelectorAll('[onclick]')) {
      const onclick = el.getAttribute('onclick') || '';
      const m = onclick.match(/(\/Teacher\/Assignments\/GradeAssignment\/[A-F0-9]{32}[^'"\s)]*)/i);
      if (m) push(m[1], el.closest('.dga-defualt-card,.card,tr,.list-group-item')?.innerText || el.innerText);
    }

    return found;
  };

  const publishedPageCount = (doc) => {
    const text = clean(doc?.body?.innerText || '');
    const fromText = num(text.match(/صفحة\s+[\d٠-٩۰-۹]+\s+من\s+([\d٠-٩۰-۹]+)/i)?.[1]);
    if (Number.isFinite(fromText) && fromText > 0) return Math.min(50, Math.max(1, Math.trunc(fromText)));

    const nums = [...(doc?.querySelectorAll?.('a[href]') || [])]
      .map(a => {
        try { return Number(new URL(a.getAttribute('href'), location.origin).searchParams.get('pageNumber')); }
        catch { return 0; }
      })
      .filter(n => Number.isFinite(n) && n > 0);
    return nums.length ? Math.min(50, Math.max(...nums)) : 1;
  };

  const publicationStatusUrl = (row, isDue, pageNumber = 1) => {
    const url = new URL(row.publishedUrl, location.origin);
    // نوحد أسماء مفاتيح الاستعلام لأن مدرستي تستخدم AssignmentId/assignmentId بالتبادل.
    for (const key of [...url.searchParams.keys()]) {
      if (key.toLowerCase() === 'assignmentid') url.searchParams.delete(key);
      if (key.toLowerCase() === 'isdue') url.searchParams.delete(key);
      if (key.toLowerCase() === 'pagenumber') url.searchParams.delete(key);
    }
    url.searchParams.set('AssignmentId', row.assignmentGuid);
    url.searchParams.set('pageNumber', String(pageNumber));
    url.searchParams.set('IsDue', isDue ? 'True' : 'False');
    if (![...url.searchParams.keys()].some(k => k.toLowerCase() === 'searchclassroom')) url.searchParams.set('searchClassRoom', '0');
    if (![...url.searchParams.keys()].some(k => k.toLowerCase() === 'type')) url.searchParams.set('type', '0');
    return url.href;
  };

  async function scanPublicationBucket(row, isDue) {
    const publicationState = isDue ? 'منتهي' : 'حالي';
    const gradeLinks = [];
    const errors = [];
    let totalPages = 1;
    let emptyMessage = '';

    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
      const url = publicationStatusUrl(row, isDue, pageNumber);
      try {
        const doc = await fetchTextDocument(url);
        if (pageNumber === 1) totalPages = publishedPageCount(doc);
        const bodyText = clean(doc.body?.innerText || '');
        if (/لا\s+توجد\s+واجبات\s+(?:حالية|منتهية)/i.test(bodyText)) {
          emptyMessage = bodyText.match(/لا\s+توجد\s+واجبات\s+(?:حالية|منتهية)/i)?.[0] || '';
        }
        const links = extractGradeLinksFromPublishedDocument(doc, { publicationState, isDue, pageNumber });
        for (const link of links) if (!gradeLinks.some(x => x.href === link.href)) gradeLinks.push(link);
      } catch (e) {
        errors.push(`صفحة ${pageNumber}: ${String(e?.message || e)}`);
        if (pageNumber === 1) break;
      }
    }

    return {
      publicationState,
      isDue,
      totalPages,
      gradeLinks,
      count: gradeLinks.length,
      emptyMessage,
      errors
    };
  }

  async function auditIndexPublications() {
    if (!indexState.assignments.length) await collectAllIndexAssignments();
    if (!indexState.assignments.length) throw new Error('لم أجد واجبات في صفحة إدارة الواجبات.');

    setIndexBusy(true, 'جاري فحص الواجبات الحالية والمنتهية…');
    const byGuid = {};
    const concurrency = 2;

    for (let i = 0; i < indexState.assignments.length; i += concurrency) {
      const batch = indexState.assignments.slice(i, i + concurrency);
      const part = await Promise.all(batch.map(async (row) => {
        if (!row.publishedUrl) {
          return [row.assignmentGuid, {
            title: row.title,
            fetchedAt: new Date().toISOString(),
            gradeLinks: [],
            scanComplete: false,
            error: 'لا يوجد رابط للواجبات المرسلة'
          }];
        }

        const [current, ended] = await Promise.all([
          scanPublicationBucket(row, false),
          scanPublicationBucket(row, true)
        ]);

        const gradeLinks = [];
        for (const link of [...current.gradeLinks, ...ended.gradeLinks]) {
          if (!gradeLinks.some(x => x.href === link.href)) gradeLinks.push(link);
        }

        const errors = [...current.errors.map(x => `الحالية: ${x}`), ...ended.errors.map(x => `المنتهية: ${x}`)];
        return [row.assignmentGuid, {
          title: row.title,
          fetchedAt: new Date().toISOString(),
          gradeLinks,
          current,
          ended,
          currentGradeLinks: current.gradeLinks.length,
          endedGradeLinks: ended.gradeLinks.length,
          scanComplete: current.errors.length === 0 && ended.errors.length === 0,
          error: errors.length && !gradeLinks.length ? errors.join(' | ') : '',
          warnings: errors
        }];
      }));
      for (const [guid, value] of part) byGuid[guid] = value;
      setIndexBusy(true, `فحص الحالية والمنتهية ${Math.min(i + concurrency, indexState.assignments.length)} / ${indexState.assignments.length}`);
    }

    const cache = { pageUrl: indexScopeUrl(), savedAt: new Date().toISOString(), schemaVersion: 5, byGuid };
    indexState.publications = cache;
    saveIndexPublicationsCache(cache);
    indexState.deep = null;
    try { localStorage.removeItem(INDEX_DEEP_CACHE_KEY); } catch {}
    renderIndexPanel();

    const summary = summarizeIndexAssignments();
    toast(`اكتمل الفحص: ${summary.publicationLinks} رابط رصد عبر ${summary.publishedAssignments} واجب.`, 'success');
    return cache;
  }


  const extractGradePageParamsFromDocument = (doc) => {
    const scripts = [...(doc?.scripts || [])]
      .map(s => s.textContent || '')
      .filter(text => /GetGradeStudentsList|loadStudents/i.test(text));
    const src = scripts.join('\n');
    if (!src) return null;

    const get = (key) => {
      const k = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return src.match(new RegExp(`${k}\\s*:\\s*['"]([^'"]*)['"]`))?.[1] ??
        src.match(new RegExp(`${k}\\s*:\\s*(true|false|[\\d.]+)`, 'i'))?.[1] ?? '';
    };

    const out = {
      schoolId: get('schoolId'), subjectId: get('subjectId'), teacherId: get('teacherId'), semesterId: get('semesterId'),
      assignmentId: get('assignmentId'), publishedAssignmentId: get('publishedAssignmentId'), lectureClassId: get('lectureClassId'),
      isGradebook: get('isGradebook'), isPublished: get('isPublished'), isCurrentTeacher: get('isCurrentTeacher'), isQuran: get('isQuran'),
      assigmentStarts: get('assigmentStarts'), grade: get('grade'), solvingType: get('solvingType')
    };
    return out.assignmentId || out.publishedAssignmentId ? out : null;
  };

  const findIndexStudentBlock = (input) => {
    let node = input;
    let fallback = input?.parentElement || null;
    for (let i = 0; i < 12 && node; i++, node = node.parentElement) {
      const text = clean(node.innerText || '');
      if (/الفصل\s+المدرسي\s*:/i.test(text) && text.length < 3500) return node;
      if (node.matches?.('.card,tr,.row,.list-group-item')) fallback = node;
    }
    return fallback;
  };

  const parseIndexGradeStudentsHtml = (html) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const groups = new Map();
    [...doc.querySelectorAll('[name^="List["]')].forEach(el => {
      const m = el.name?.match(/^List\[(\d+)\]\.(.+)$/);
      if (!m) return;
      const index = Number(m[1]);
      if (!groups.has(index)) groups.set(index, {});
      groups.get(index)[m[2]] = el.value;
    });

    const rows = [];
    for (const [index, fields] of [...groups.entries()].sort((a, b) => a[0] - b[0])) {
      const studentId = clean(fields.StudentId);
      if (!studentId) continue;
      const input = doc.querySelector(`[name="List[${index}].StudentId"]`);
      const block = input ? findIndexStudentBlock(input) : null;
      const blockText = clean(block?.innerText || '');
      const className = blockText.match(/الفصل\s+المدرسي\s*:\s*(.+?)(?=\s+الدرجة|\s+الإجابة|\s+ملاحظات|$)/i)?.[1]?.trim() || '';
      const resultLink = block
        ? [...block.querySelectorAll('a[href]')].find(a => /StudentAssignmentResult/i.test(a.getAttribute('href') || ''))
        : null;
      rows.push({
        studentId,
        recordId: clean(fields.Id),
        className,
        hasAnswer: String(fields.hasAnswer).toLowerCase() === 'true',
        isApproved: String(fields.IsApproved).toLowerCase() === 'true',
        solvingType: clean(fields.SolvingType),
        maxGrade: num(fields.TotalGrade),
        currentGrade: num(fields.Grade),
        autoGrade: num(fields.AutoGrade),
        resultUrl: resultLink ? safeAbsoluteUrl(resultLink.getAttribute('href')) : '',
        resolvedGrade: num(fields.Grade),
        resolvedMaxGrade: num(fields.TotalGrade),
        gradeDiscrepancy: false
      });
    }
    return rows;
  };

  async function fetchIndexGradeRows(gradeUrl) {
    const doc = await fetchTextDocument(gradeUrl);
    const timing = getGradePublicationTiming(doc);
    const params = extractGradePageParamsFromDocument(doc);
    if (!params) throw new Error('تعذر قراءة إعدادات صفحة رصد الدرجات.');

    const merged = new Map();
    let stagnant = 0;
    for (let pageNumber = 1; pageNumber <= 30; pageNumber++) {
      const response = await postFormEnhanced('/Teacher/Assignments/GetGradeStudentsList', {
        ...params, pageNumber, pageSize: 200, studentIds: '', status: '', sortBy: ''
      });
      const rows = parseIndexGradeStudentsHtml(responseHtmlEnhanced(response));
      let added = 0;
      for (const row of rows) {
        const key = String(row.studentId);
        if (!merged.has(key)) added++;
        merged.set(key, row);
      }
      if (!rows.length) break;
      if (!added) stagnant++; else stagnant = 0;
      if (stagnant >= 2) break;
      const totalPages = Number(response?.totalPages);
      if (Number.isFinite(totalPages) && totalPages > 0 && pageNumber >= totalPages) break;
    }
    return { doc, params, timing, rows: [...merged.values()] };
  };

  const resolveIndexSingleResultLink = async (row, params) => {
    if (!row?.studentId) return '';
    const response = await postFormEnhanced('/Teacher/Assignments/GetGradeStudentsList', {
      ...params, pageNumber: 1, pageSize: 10, studentIds: [String(row.studentId)], status: '', sortBy: ''
    });
    const doc = new DOMParser().parseFromString(responseHtmlEnhanced(response), 'text/html');
    const link = doc.querySelector('a[href*="StudentAssignmentResult"]');
    return link ? safeAbsoluteUrl(link.getAttribute('href')) : '';
  };

  async function verifyFractionalIndexResults(rows, params) {
    const candidates = rows.filter(row =>
      row.solvingType === '4' && row.hasAnswer && Number.isFinite(row.maxGrade) &&
      (!Number.isInteger(row.maxGrade) || row.maxGrade < 1)
    );
    if (!candidates.length) return;

    const concurrency = 4;
    for (let i = 0; i < candidates.length; i += concurrency) {
      const batch = candidates.slice(i, i + concurrency);
      await Promise.all(batch.map(async row => {
        try {
          const resultUrl = await resolveIndexSingleResultLink(row, params);
          if (!resultUrl) return;
          const resultDoc = await fetchTextDocument(resultUrl);
          const summary = parseResultSummaryEnhanced(resultDoc);
          if (Number.isFinite(summary.resultScore)) {
            const pageGrade = row.currentGrade;
            row.resolvedGrade = summary.resultScore;
            if (Number.isFinite(summary.resultMaxScore) && summary.resultMaxScore > 0) row.resolvedMaxGrade = summary.resultMaxScore;
            row.gradeDiscrepancy = Number.isFinite(pageGrade) && !nearlyEqual(pageGrade, summary.resultScore);
          }
        } catch (e) {
          console.warn('[MAI v1.4.2] Fractional result verification skipped:', e);
        }
      }));
    }
  };

  async function analyzeIndexGradePage(gradeUrl) {
    const { params, rows, timing } = await fetchIndexGradeRows(gradeUrl);

    if (timing.status !== 'ended') {
      return {
        gradeUrl,
        excluded: true,
        publicationStatus: timing.status,
        exclusionReason: timing.status === 'receiving'
          ? `قيد الاستقبال حتى ${formatGradeTimingDate(timing.endDate)}`
          : 'تعذر التحقق من وقت نهاية النشر من صفحة الرصد',
        serverDateTime: timing.serverRaw,
        publishedEndTime: timing.endRaw
      };
    }

    if (!rows.length) throw new Error('لم يتم العثور على سجلات طلاب في صفحة الرصد.');
    await verifyFractionalIndexResults(rows, params);

    const outside = rows.length ? rows.every(row => row.solvingType === '3') : String(params.solvingType) === '3';
    const submitted = outside ? [] : rows.filter(row => row.hasAnswer);
    const scoredPercents = rows.map(row => {
      const achieved = Number.isFinite(row.resolvedGrade) ? row.resolvedGrade : row.currentGrade;
      const max = Number.isFinite(row.resolvedMaxGrade) ? row.resolvedMaxGrade : row.maxGrade;
      return Number.isFinite(achieved) && Number.isFinite(max) && max > 0 ? (achieved / max) * 100 : null;
    }).filter(Number.isFinite);
    const classes = [...new Set(rows.map(row => clean(row.className)).filter(Boolean))];

    return {
      gradeUrl,
      studentRecords: rows.length,
      submissionVerifiable: !outside,
      submitted: outside ? 0 : submitted.length,
      notSubmitted: outside ? 0 : Math.max(0, rows.length - submitted.length),
      submissionRate: outside ? null : pct(submitted.length, rows.length),
      scoreCount: scoredPercents.length,
      scorePercentSum: scoredPercents.reduce((a, b) => a + b, 0),
      averagePercent: scoredPercents.length ? scoredPercents.reduce((a, b) => a + b, 0) / scoredPercents.length : null,
      highestPercent: scoredPercents.length ? Math.max(...scoredPercents) : null,
      lowestPercent: scoredPercents.length ? Math.min(...scoredPercents) : null,
      gradeDiscrepancies: rows.filter(row => row.gradeDiscrepancy).length,
      classes,
      solvingType: rows.find(row => row.solvingType)?.solvingType || params.solvingType || ''
    };
  };

  const aggregateIndexDeepAssignment = (assignment, pages) => {
    const receiving = pages.filter(p => p?.excluded && p.publicationStatus === 'receiving');
    const unverified = pages.filter(p => p?.excluded && p.publicationStatus !== 'receiving');

    // إذا كانت أي مرة نشر ما زالت جارية، نؤجل تقرير الواجب كله حتى تنتهي.
    if (receiving.length || unverified.length) {
      return {
        title: assignment.title,
        analysisAvailable: false,
        reportStatus: receiving.length ? 'receiving_server_verified' : 'timing_unverified',
        exclusionReason: receiving.length
          ? 'قيد الاستقبال حسب ServerDateTime و PublishedEndTime في صفحة الرصد'
          : 'تعذر التحقق من وقت نهاية إحدى مرات النشر',
        publicationsAnalyzed: 0,
        publicationErrors: pages.filter(p => p.error).length,
        studentRecords: null,
        submissionVerifiable: null,
        submitted: null,
        notSubmitted: null,
        submissionRate: null,
        scoreCount: 0,
        scorePercentSum: 0,
        averagePercent: null,
        highestPercent: null,
        lowestPercent: null,
        gradeDiscrepancies: 0,
        classes: [],
        pages
      };
    }

    const good = pages.filter(p => !p.error && !p.excluded);
    if (!good.length) {
      return {
        title: assignment.title,
        analysisAvailable: false,
        publicationsAnalyzed: 0,
        publicationErrors: pages.filter(p => p.error).length,
        studentRecords: null,
        submissionVerifiable: null,
        submitted: null,
        notSubmitted: null,
        submissionRate: null,
        scoreCount: 0,
        scorePercentSum: 0,
        averagePercent: null,
        highestPercent: null,
        lowestPercent: null,
        gradeDiscrepancies: 0,
        classes: [],
        pages
      };
    }
    const submissionVerifiable = good.every(p => p.submissionVerifiable);
    const studentRecords = good.reduce((sum, p) => sum + (p.studentRecords || 0), 0);
    const submitted = good.reduce((sum, p) => sum + (p.submitted || 0), 0);
    const notSubmitted = good.reduce((sum, p) => sum + (p.notSubmitted || 0), 0);
    const scoreCount = good.reduce((sum, p) => sum + (p.scoreCount || 0), 0);
    const scorePercentSum = good.reduce((sum, p) => sum + (p.scorePercentSum || 0), 0);
    const highs = good.map(p => p.highestPercent).filter(Number.isFinite);
    const lows = good.map(p => p.lowestPercent).filter(Number.isFinite);
    const classes = [...new Set(good.flatMap(p => p.classes || []).filter(Boolean))];
    return {
      title: assignment.title,
      analysisAvailable: true,
      publicationsAnalyzed: good.length,
      publicationErrors: pages.filter(p => p.error).length,
      studentRecords,
      submissionVerifiable,
      submitted,
      notSubmitted,
      submissionRate: submissionVerifiable ? pct(submitted, studentRecords) : null,
      scoreCount,
      scorePercentSum,
      averagePercent: scoreCount ? scorePercentSum / scoreCount : null,
      highestPercent: highs.length ? Math.max(...highs) : null,
      lowestPercent: lows.length ? Math.min(...lows) : null,
      gradeDiscrepancies: good.reduce((sum, p) => sum + (p.gradeDiscrepancies || 0), 0),
      classes,
      pages
    };
  };

  async function runIndexDeepAnalysis() {
    if (!indexState.assignments.length) await collectAllIndexAssignments();
    if (!indexState.publications) await auditIndexPublications();

    const eligibleAssignments = indexState.assignments.filter(row => reportEligibilityFor(row).eligible);
    const receivingAssignments = indexState.assignments.filter(row => reportEligibilityFor(row).status === 'receiving');
    const totalGradeLinks = eligibleAssignments.reduce((sum, row) => {
      const pub = publicationInfoFor(row);
      return sum + (pub?.ended?.gradeLinks?.length || 0);
    }, 0);

    if (!totalGradeLinks) {
      if (receivingAssignments.length) {
        throw new Error(`لا توجد واجبات منتهية جاهزة للتقرير حاليًا. يوجد ${receivingAssignments.length} واجب قيد استقبال الحلول، وسيظهر تقريره بعد انتهاء جميع مرات النشر.`);
      }
      throw new Error('لم يتم العثور على واجبات منتهية تحتوي على روابط رصد جاهزة للتقرير.');
    }

    setIndexBusy(true, `بدء تحليل الواجبات المنتهية فقط: ${totalGradeLinks} صفحة رصد…`);
    const byGuid = {};
    let completed = 0;

    for (const assignment of indexState.assignments) {
      const eligibility = reportEligibilityFor(assignment);
      if (!eligibility.eligible) {
        byGuid[assignment.assignmentGuid] = {
          title: assignment.title,
          analysisAvailable: false,
          reportStatus: eligibility.status,
          exclusionReason: eligibility.label,
          publicationsAnalyzed: 0,
          publicationErrors: 0,
          studentRecords: null,
          submissionVerifiable: null,
          submitted: null,
          notSubmitted: null,
          submissionRate: null,
          scoreCount: 0,
          scorePercentSum: 0,
          averagePercent: null,
          highestPercent: null,
          lowestPercent: null,
          gradeDiscrepancies: 0,
          classes: [],
          pages: []
        };
        continue;
      }

      // نحلل روابط «المنتهية» فقط. الروابط الحالية لا تدخل التقرير النهائي إطلاقًا.
      const links = publicationInfoFor(assignment)?.ended?.gradeLinks || [];
      if (!links.length) continue;
      const pages = [];
      for (let i = 0; i < links.length; i += 2) {
        const batch = links.slice(i, i + 2);
        const part = await Promise.all(batch.map(async link => {
          try { return await analyzeIndexGradePage(link.href); }
          catch (e) { return { gradeUrl: link.href, error: String(e?.message || e) }; }
        }));
        pages.push(...part);
        completed += batch.length;
        setIndexBusy(true, `تحليل الواجبات المنتهية ${completed} / ${totalGradeLinks}`);
      }
      const aggregate = aggregateIndexDeepAssignment(assignment, pages);
      if (aggregate.analysisAvailable !== false) {
        aggregate.reportStatus = 'complete';
        aggregate.exclusionReason = '';
      }
      byGuid[assignment.assignmentGuid] = aggregate;
    }

    const cache = { pageUrl: indexScopeUrl(), savedAt: new Date().toISOString(), schemaVersion: 5, byGuid };
    indexState.deep = cache;
    saveIndexDeepCache(cache);
    renderIndexPanel();
    const summary = summarizeIndexAssignments();
    toast(`اكتمل تحليل ${summary.reportReadyCount} واجب منتهي: ${summary.deepStudentRecords} سجل طالب${summary.reportReceivingCount ? ` · تم تأجيل ${summary.reportReceivingCount} واجب قيد الاستقبال` : ''}${Number.isFinite(summary.deepAveragePercent) ? ` · متوسط ${fmt(summary.deepAveragePercent)}%` : ''}.`, 'success');
    return cache;
  }

  const indexExportRows = () => (indexState.assignments || []).map(row => {
    const pub = publicationInfoFor(row);
    const deep = deepInfoFor(row);
    const reportState = reportEligibilityFor(row);
    return {
      '#': row.index,
      'اسم الواجب': row.title,
      'المقرر': row.course,
      'الوحدة': row.unit,
      'الموضوع': row.topic,
      'المسار الدراسي': row.curriculumPath,
      'مصدر الواجب': row.source,
      'طريقة العرض': row.displayMode,
      'درجة الواجب': Number.isFinite(row.grade) ? row.grade : '',
      'الحالة': indexStatusLabel(row),
      'Assignment GUID': row.assignmentGuid,
      'Assignment ID': row.internalId,
      'روابط الرصد المكتشفة': pub ? ((pub.gradeLinks?.length || 0) || 'لا يوجد') : '',
      'حالة التقرير': reportState.label,
      'سجلات الطلاب': !reportState.eligible || deep?.analysisAvailable === false ? '' : (deep?.studentRecords ?? ''),
      'نسبة الحل': !reportState.eligible || deep?.analysisAvailable === false ? '' : (deep ? (deep.submissionVerifiable ? deep.submissionRate : 'غير متاح') : ''),
      'متوسط الأداء': !reportState.eligible || deep?.analysisAvailable === false ? '' : (deep && Number.isFinite(deep.averagePercent) ? deep.averagePercent : ''),
      'لم يحل': !reportState.eligible || deep?.analysisAvailable === false ? '' : (deep ? (deep.submissionVerifiable ? deep.notSubmitted : '') : ''),
      'تعارضات الدرجة': deep?.gradeDiscrepancies ?? '',
      'الفصول المنشورة': deep?.classes?.join('، ') || '',
      'رابط الاستعراض': row.viewUrl,
      'رابط الواجبات المرسلة': row.publishedUrl
    };
  });

  function exportIndexCSV() {
    const data = indexExportRows();
    if (!data.length) throw new Error('لا توجد واجبات قابلة للتصدير.');
    const headers = Object.keys(data[0]);
    const lines = [headers.map(csvCell).join(',')];
    for (const row of data) lines.push(headers.map(h => csvCell(row[h])).join(','));
    downloadText(`madrasati-assignments-register-${dateStamp()}.csv`, '\uFEFF' + lines.join('\n'), 'text/csv;charset=utf-8');
  }

  function exportIndexExcel() {
    const data = indexExportRows();
    if (!data.length) throw new Error('لا توجد واجبات قابلة للتصدير.');
    if (!globalThis.XLSX) return exportIndexCSV();
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [
      { wch: 5 }, { wch: 28 }, { wch: 20 }, { wch: 24 }, { wch: 24 }, { wch: 60 }, { wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 34 }, { wch: 16 }, { wch: 20 }, { wch: 60 }, { wch: 60 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Assignments');

    if (indexState.publications) {
      const pubRows = [];
      for (const row of indexState.assignments) {
        const pub = publicationInfoFor(row);
        for (const link of pub?.current?.gradeLinks || []) pubRows.push({ 'الواجب': row.title, 'Assignment GUID': row.assignmentGuid, 'حالة النشر': 'حالي - مستبعد من التقرير النهائي', 'رابط الرصد': link.href, 'سياق': link.context || '' });
        for (const link of pub?.ended?.gradeLinks || []) pubRows.push({ 'الواجب': row.title, 'Assignment GUID': row.assignmentGuid, 'حالة النشر': 'منتهي', 'رابط الرصد': link.href, 'سياق': link.context || '' });
      }
      if (pubRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pubRows), 'Publications');
    }

    XLSX.writeFile(wb, `madrasati-assignments-register-${dateStamp()}.xlsx`);
  }

  const indexPrintCss = `
    @page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{font-family:Tahoma,Arial,sans-serif;direction:rtl;color:#111827;margin:0;font-size:10px;line-height:1.55}
    .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #111827;padding-bottom:10px;margin-bottom:12px}.head h1{font-size:22px;margin:0}.muted{color:#64748b}.small{font-size:9px}
    .cards{display:grid;grid-template-columns:repeat(8,1fr);gap:6px;margin:10px 0 12px}.card{border:1px solid #d1d5db;border-radius:8px;padding:8px;text-align:center}.card b{display:block;font-size:18px}.card span{font-size:9px;color:#475569}
    table{width:100%;border-collapse:collapse}th,td{border:1px solid #d1d5db;padding:5px;text-align:right;vertical-align:top}th{background:#f3f4f6;font-weight:800}.src{margin:8px 0 10px}.src span{display:inline-block;border:1px solid #d1d5db;border-radius:999px;padding:2px 6px;margin-left:4px}
    .footer{margin-top:10px;border-top:1px solid #d1d5db;padding-top:6px;display:flex;justify-content:space-between;color:#64748b;font-size:8px}.actions{position:fixed;left:12px;bottom:12px}.actions button{border:0;border-radius:8px;background:#111827;color:#fff;padding:9px 14px;font-weight:800;cursor:pointer}@media print{.actions{display:none}}
  `;

  function printIndexReport() {
    if (!indexState.assignments.length) collectIndexAssignments();
    if (!indexState.assignments.length) throw new Error('لا توجد واجبات للطباعة.');
    const w = window.open('', '_blank');
    if (!w) throw new Error('تعذر فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة لهذا الموقع.');

    const s = summarizeIndexAssignments();
    const sourceHtml = Object.entries(s.sourceCounts).map(([name, count]) => `<span>${esc(name)}: <b>${count}</b></span>`).join('');
    const rows = indexState.assignments.map(row => {
      const pub = publicationInfoFor(row);
      const deep = deepInfoFor(row);
      const reportState = reportEligibilityFor(row);
      const deepAvailable = reportState.eligible && deep && deep.analysisAvailable !== false;
      return `<tr><td>${row.index}</td><td><b>${esc(row.title)}</b></td><td>${esc(row.course || '—')}</td><td>${esc(row.unit || '—')}</td><td>${esc(row.topic || '—')}</td><td>${esc(row.source || '—')}</td><td>${Number.isFinite(row.grade) ? fmt(row.grade,4) : '—'}</td><td>${esc(indexStatusLabel(row))}</td><td>${pub ? (pub.gradeLinks?.length || 0) : '—'}</td><td>${esc(reportState.label)}</td><td>${deepAvailable ? (deep.submissionVerifiable ? `${fmt(deep.submissionRate)}%` : 'غير متاح') : '—'}</td><td>${deepAvailable && Number.isFinite(deep.averagePercent) ? `${fmt(deep.averagePercent)}%` : '—'}</td><td>${deepAvailable ? (deep.submissionVerifiable ? deep.notSubmitted : '—') : '—'}</td></tr>`;
    }).join('');

    const body = `
      <div class="actions"><button onclick="window.print()">طباعة / حفظ PDF</button></div>
      <div class="head"><div><h1>سجل الواجبات</h1><div class="muted">لوحة الواجبات الشاملة — تقارير الأداء للواجبات المنتهية فقط</div></div><div class="small">${esc(document.querySelector('#mainTitle')?.textContent || 'إدارة الواجبات')}<br>${new Date().toLocaleString('ar-SA')}</div></div>
      <div class="cards">
        <div class="card"><b>${s.total}</b><span>إجمالي الواجبات</span></div>
        <div class="card"><b>${s.activeCount}</b><span>مفعّلة</span></div>
        <div class="card"><b>${fmt(s.totalGrade,4)}</b><span>مجموع الدرجات</span></div>
        <div class="card"><b>${Number.isFinite(s.averageGrade) ? fmt(s.averageGrade,4) : '—'}</b><span>متوسط الدرجة</span></div>
        <div class="card"><b>${Number.isFinite(s.highestGrade) ? fmt(s.highestGrade,4) : '—'}</b><span>أعلى درجة</span></div>
        <div class="card"><b>${Number.isFinite(s.lowestGrade) ? fmt(s.lowestGrade,4) : '—'}</b><span>أقل درجة</span></div>
        <div class="card"><b>${s.deepScanned ? s.deepStudentRecords : '—'}</b><span>سجلات الطلاب</span></div>
        <div class="card"><b>${s.deepScanned && Number.isFinite(s.deepAveragePercent) ? `${fmt(s.deepAveragePercent)}%` : '—'}</b><span>متوسط الأداء</span></div>
      </div>
      <div class="src"><b>المصادر:</b> ${sourceHtml}</div>
      <table><thead><tr><th>#</th><th>الواجب</th><th>المقرر</th><th>الوحدة</th><th>الموضوع</th><th>المصدر</th><th>الدرجة</th><th>الحالة</th><th>روابط الرصد</th><th>حالة التقرير</th><th>نسبة الحل</th><th>المتوسط</th><th>لم يحل</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="footer"><span>Madrasati Assignment Intelligence v${VERSION}</span><span>Mohammed Almalki (M0HM3D85)</span></div>`;

    w.document.open();
    w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>سجل الواجبات</title><style>${indexPrintCss}</style></head><body>${body}</body></html>`);
    w.document.close();
    w.setTimeout(() => { try { w.focus(); w.print(); } catch {} }, 350);
  }

  async function bootstrapIndex() {
    try { if (base) base.version = VERSION; } catch {}
    addIndexStyles();

    // انتظر بطاقات Index لأنها قد تتأخر قليلًا بعد تحميل الصفحة.
    for (let i = 0; i < 80 && !document.querySelector(indexCardSelector); i++) await sleep(100);

    // اعرض الصفحة الحالية سريعًا أولًا، ثم اجمع جميع الصفحات قبل تمكين الأزرار.
    collectIndexAssignments();
    const panel = createIndexPanel();
    renderIndexPanel();

    if (panel) {
      panel.style.display = 'block';
      panel.hidden = false;
      setIndexBusy(true, 'جاري جمع جميع صفحات إدارة الواجبات…');
    }

    try {
      await collectAllIndexAssignments();
      loadIndexPublicationsCache();
      loadIndexDeepCache();
      renderIndexPanel();
      console.info(`[MAI v${VERSION}] Index panel mounted`, {
        assignments: indexState.assignments.length,
        pages: indexState.indexPagesScanned,
        stopReason: indexState.indexStopReason,
        panel
      });
    } catch (e) {
      console.error(`[MAI v${VERSION}] Index bootstrap failed:`, e);
      toast(`تعذر جمع جميع صفحات الواجبات: ${String(e?.message || e)}`, 'error');
      loadIndexPublicationsCache();
      loadIndexDeepCache();
      renderIndexPanel();
    } finally {
      setIndexBusy(false);
    }
  }


  // أدوات فحص آمنة للإصدارات القادمة.
  globalThis.MadrasatiAssignmentIntelligenceEnhanced = {
    version: VERSION,
    baseVersion: BASE_REQUIRED_VERSION,
    state,
    refresh: refreshEnhanced,
    parseQuestionCards: parseQuestionCardsEnhanced,
    runDeepQuestionAnalysis: runDeepQuestionAnalysisEnhanced,
    getQuestionAnalytics,
    studentLevel,
    printAssignmentReport: printAssignmentReportEnhanced,
    printQuestions: printQuestionsEnhanced,
    resolveAssignmentName: resolveAssignmentNameEnhanced,
    getGradePublicationTiming,
    gradeReportGate,
    render: renderInlineAnalysis,
    indexState,
    collectIndexAssignments,
    collectAllIndexAssignments,
    auditIndexPublications,
    runIndexDeepAnalysis,
    renderIndexPanel
  };

  if (isAssignmentsIndex) bootstrapIndex();
  else if (isGradeAssignment) bootstrapGrade();
})();

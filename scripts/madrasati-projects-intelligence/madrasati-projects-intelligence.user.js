// ==UserScript==
// @name         Madrasati Projects Intelligence | مدير الأنشطة والمشاريع الذكي
// @namespace    https://greasyfork.org/users/1636459
// @version      1.5.4
// @description  مدير المشاريع: إصلاح مطابقة درجات Excel وCSV، توضيح أسباب الرفض، حماية الملاحظات وحفظ متحقق تدريجيًا، مع لوحة تحليل وتقارير.
// @copyright    2026, Mohammed Almalki (M0HM3D85)
// @license      All Rights Reserved
// @match        https://schools.madrasati.sa/Projects/Projects/*
// @author       Mohammed Almalki (M0HM3D85)
// @homepageURL  https://greasyfork.org/en/users/1636459-m0hm3d85
// @supportURL   https://github.com/M0HM3D85/teacher-userscripts/issues
// @require      https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

/*
=========================================================================
 Madrasati Projects Intelligence | مدير الأنشطة والمشاريع الذكي — v1.5.4

 إصدار مستقر لوحدة الأنشطة والمشاريع يعمل إلى جانب:
 Madrasati Assignment Intelligence | مدير الواجبات الذكي

 تصميم وتطوير: Mohammed Almalki (M0HM3D85)
=========================================================================
*/

// ============================================================================
// Madrasati Projects & Activities Intelligence — v1.5.4
// وحدة الأنشطة والمشاريع لمدير الواجبات الذكي
// ============================================================================
(() => {
  'use strict';

  const APP = 'MAIP';
  const VERSION = '1.5.4';
  const path = location.pathname;
  const isIndex = /\/Projects\/Projects\/Index\//i.test(path);
  const isPublished = /\/Projects\/Projects\/PublishedProjects\/?$/i.test(path);
  const isGrade = /\/Projects\/Projects\/GradeProject\//i.test(path);
  if (!isIndex && !isPublished && !isGrade) return;

  const clean = v => String(v ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200e\u200f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const norm = v => clean(v)
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/ـ/g, '')
    .replace(/[إأآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLowerCase();

  const esc = v => clean(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const num = v => {
    const raw = String(v ?? '')
      .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
      .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
      .replace(',', '.')
      .replace(/[^\d.-]/g, '');
    if (!raw || raw === '-' || raw === '.' || raw === '-.') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };

  const truthy = v => /^(?:true|1|yes)$/i.test(clean(v));
  const pct = (a, b) => b ? Number(((a / b) * 100).toFixed(2)) : 0;
  const fmt = (v, digits = 2) => Number.isFinite(v) ? Number(v.toFixed(digits)).toString() : '—';
  const arabicCollator = new Intl.Collator('ar-SA', { sensitivity: 'base', numeric: true, ignorePunctuation: true });
  const compareNames = (a, b) => arabicCollator.compare(clean(a), clean(b));

  const state = {
    students: [],
    loading: false,
    filter: { className: 'all', submission: 'all', level: 'all', grading: 'all', sort: 'name_asc', query: '' },
    view: 'students',
    importExpanded: false,
    indexItems: [], indexQuery: '', indexPages: 1, indexScanned: false, indexBusy: false,
    publishedItems: [], publishedQuery: '', publishedScanned: false, publishedDeepScanned: false,
    deepByProject: new Map(), deepByUrl: new Map(), deepScanned: false, deepBusy: false,
    importPreview: null,
    importFeedback: false,
    activityTitle: '',
    totalExpected: 0,
    lastRefresh: null
  };

  const css = `
    #${APP}-panel{direction:rtl;font-family:Tahoma,Arial,sans-serif;margin:16px 0;border:1px solid #dfe5ec;border-radius:14px;background:#fff;box-shadow:0 2px 10px rgba(15,23,42,.05);overflow:hidden}
    #${APP}-panel *{box-sizing:border-box}
    .${APP}-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:14px 16px;background:#f8fafc;border-bottom:1px solid #e5e7eb}
    .${APP}-title{font-size:16px;font-weight:800;color:#1f2937}. ${APP}-sub{font-size:11px;color:#64748b;margin-top:3px}
    .${APP}-toolbar{display:flex;gap:7px;flex-wrap:wrap;align-items:center}
    .${APP}-btn{border:1px solid #0d6efd;background:#0d6efd;color:#fff;border-radius:8px;padding:7px 11px;font-size:12px;font-weight:700;cursor:pointer}
    .${APP}-btn.alt{background:#fff;color:#0d6efd}. ${APP}-btn.gray{background:#fff;color:#334155;border-color:#cbd5e1}. ${APP}-btn.danger{background:#fff;color:#b91c1c;border-color:#fecaca}
    .${APP}-btn:disabled{opacity:.55;cursor:not-allowed}. ${APP}-body{padding:14px 16px}
    .${APP}-metrics{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:8px;margin-bottom:12px}
    .${APP}-metric{border:1px solid #e5e7eb;border-radius:11px;padding:10px;background:#fff;min-width:0}. ${APP}-metric b{display:block;font-size:20px;color:#111827}. ${APP}-metric span{font-size:10px;color:#64748b}
    .${APP}-filters{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin:10px 0}. ${APP}-field{display:flex;flex-direction:column;gap:4px;font-size:10px;font-weight:700;color:#475569}. ${APP}-field select,.${APP}-field input{width:100%;border:1px solid #d1d5db;border-radius:8px;padding:7px 8px;background:#fff;font:12px Tahoma,Arial}
    .${APP}-tablewrap{overflow:auto;max-height:520px;border:1px solid #e5e7eb;border-radius:10px}. ${APP}-table{width:100%;border-collapse:collapse;font-size:11px;min-width:850px}. ${APP}-table th,.${APP}-table td{padding:8px;border-bottom:1px solid #eef2f7;text-align:right;vertical-align:middle}. ${APP}-table th{position:sticky;top:0;background:#f8fafc;z-index:2;font-weight:800}. ${APP}-table tr:hover td{background:#fafcff}
    .${APP}-pill{display:inline-block;padding:3px 7px;border-radius:999px;font-size:10px;background:#f1f5f9}. ${APP}-ok{background:#dcfce7;color:#166534}. ${APP}-bad{background:#fee2e2;color:#991b1b}. ${APP}-warn{background:#fef3c7;color:#92400e}. ${APP}-info{background:#dbeafe;color:#1e40af}
    .${APP}-note{border:1px dashed #cbd5e1;border-radius:10px;padding:9px 11px;background:#f8fafc;font-size:11px;color:#475569;margin:8px 0}
    .${APP}-import{display:none;margin-top:12px;border-top:1px solid #e5e7eb;padding-top:12px}. ${APP}-import.show{display:block}. ${APP}-drop{border:2px dashed #cbd5e1;border-radius:12px;padding:18px;text-align:center;position:relative;background:#f8fafc}. ${APP}-drop input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer}. ${APP}-drop b,.${APP}-drop span{display:block}. ${APP}-drop span{font-size:11px;color:#64748b;margin-top:4px}
    .${APP}-status{font-size:11px;color:#475569;font-weight:700}. ${APP}-status.busy{color:#0d6efd}
    #${APP}-toast{position:fixed;left:18px;bottom:18px;z-index:2147483647;opacity:0;transform:translateY(8px);transition:.2s;background:#111827;color:#fff;border-radius:9px;padding:10px 13px;font:12px Tahoma,Arial}. #${APP}-toast.show{opacity:1;transform:none}. #${APP}-toast.success{background:#065f46}. #${APP}-toast.error{background:#991b1b}
    @media(max-width:1100px){.${APP}-metrics{grid-template-columns:repeat(4,minmax(0,1fr))}. ${APP}-filters{grid-template-columns:repeat(3,minmax(0,1fr))}}
    @media(max-width:650px){.${APP}-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}. ${APP}-filters{grid-template-columns:1fr}. ${APP}-head{align-items:flex-start}}
  `.replace(/\. MAIP/g, '.MAIP');



  const importModalCss = `
    #${APP}-import-modal.${APP}-modal{position:fixed;inset:0;z-index:2147483645;background:rgba(15,23,42,.57);display:flex;align-items:center;justify-content:center;padding:16px;direction:rtl;font-family:Tahoma,Arial,sans-serif}
    #${APP}-import-modal[hidden]{display:none!important}
    #${APP}-import-modal .${APP}-dialog{box-sizing:border-box;width:min(1320px,97vw);max-height:94vh;overflow:auto;background:#fff;color:#172033;border-radius:16px;box-shadow:0 18px 75px rgba(0,0,0,.28);padding:18px}
    #${APP}-import-modal .${APP}-dialog *{box-sizing:border-box}
    #${APP}-import-modal .${APP}-dialog-head{display:flex;justify-content:space-between;align-items:center;gap:10px;border-bottom:1px solid #e2e8f0;padding-bottom:12px}
    #${APP}-import-modal .${APP}-drop{border:2px dashed #b9c9de;padding:22px;border-radius:12px;background:#f8fbff;position:relative;text-align:center}
    #${APP}-import-modal .${APP}-drop input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}
    #${APP}-import-modal .${APP}-drop b,#${APP}-import-modal .${APP}-drop span{display:block}
    #${APP}-import-modal .${APP}-drop span{font-size:12px;color:#64748b;margin-top:5px}
    #${APP}-import-modal .${APP}-note{font-size:12px;background:#f8fafc;border:1px solid #e2e8f0;padding:10px;border-radius:10px;margin:10px 0}
    #${APP}-import-modal .${APP}-toolbar{display:flex;gap:9px;align-items:center;flex-wrap:wrap;margin:10px 0}
    #${APP}-import-modal .${APP}-btn{padding:9px 12px;border:1px solid #0d6efd;background:#0d6efd;color:white;border-radius:8px;cursor:pointer;font:700 12px Tahoma,Arial}
    #${APP}-import-modal .${APP}-btn.gray,#${APP}-import-modal .${APP}-btn.alt{color:#0d6efd;background:#fff}
    #${APP}-import-modal .${APP}-btn:disabled{opacity:.45;cursor:not-allowed}
    #${APP}-import-modal .${APP}-tablewrap{overflow:auto;border:1px solid #e2e8f0;border-radius:10px}
    #${APP}-import-modal .${APP}-table{width:100%;border-collapse:collapse;font-size:11px;min-width:980px}
    #${APP}-import-modal .${APP}-table th,#${APP}-import-modal .${APP}-table td{padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;vertical-align:middle}
    #${APP}-import-modal .${APP}-table th{background:#f1f5f9;position:sticky;top:0;z-index:2}
    #${APP}-import-modal .${APP}-pill{border-radius:25px;padding:4px 8px;font-size:10px}
    #${APP}-import-modal .${APP}-ok{background:#dcfce7;color:#166534}
    #${APP}-import-modal .${APP}-bad{background:#fee2e2;color:#991b1b}
    #${APP}-import-modal .${APP}-sub,#${APP}-import-modal .${APP}-count{font-size:11px;color:#64748b}
    @media(max-width:700px){#${APP}-import-modal{padding:5px}#${APP}-import-modal .${APP}-dialog{max-height:97vh;width:100%;padding:10px}}
  `;

  const parityCss = `
    #${APP}-panel{box-shadow:0 4px 18px rgba(15,23,42,.06);border-color:#dbe3ee}
    #${APP}-panel .${APP}-head{background:linear-gradient(135deg,#f8fafc,#eef6ff)}
    #${APP}-panel .${APP}-btn{font-size:11px;border-radius:9px;padding:8px 11px}
    #${APP}-panel .${APP}-btn:not(.alt):not(.gray):not(.danger){background:#0f172a;border-color:#0f172a}
    #${APP}-panel .${APP}-btn.alt{border-color:#cbd5e1;color:#0f172a}
    #${APP}-panel .${APP}-metric{background:#fafafa;min-height:77px;text-align:center;display:flex;flex-direction:column;justify-content:center}
    #${APP}-panel .${APP}-metric b{font-size:21px}
    #${APP}-panel .${APP}-metric span{font-size:11px;font-weight:700;color:#475569}
    #${APP}-panel .${APP}-filters{grid-template-columns:repeat(6,minmax(120px,1fr));align-items:end}
    #${APP}-panel .${APP}-searchline{display:flex;gap:9px;align-items:center;flex-wrap:wrap;margin:10px 0 14px}
    #${APP}-panel .${APP}-searchline input{flex:1 1 250px;border:1px solid #cbd5e1;border-radius:9px;padding:9px 11px;font:12px Tahoma,Arial;min-width:180px}
    #${APP}-panel .${APP}-count{font-size:11px;color:#475569;font-weight:800}
    #${APP}-panel .${APP}-tabs{display:flex;flex-wrap:wrap;gap:6px;margin:9px 0 14px;border-bottom:1px solid #e2e8f0;padding-bottom:8px}
    #${APP}-panel .${APP}-tab{padding:8px 12px;border:1px solid #dbe3ee;border-radius:8px;background:#fff;color:#334155;font-weight:800;cursor:pointer;font-size:11px}
    #${APP}-panel .${APP}-tab.active{background:#0f172a;color:#fff;border-color:#0f172a}
    #${APP}-panel .${APP}-chart-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin-bottom:15px}
    #${APP}-panel .${APP}-chart{border:1px solid #e2e8f0;border-radius:11px;padding:14px;background:#fff;min-width:0}
    #${APP}-panel .${APP}-chart h4{font-size:13px;margin:0 0 13px;color:#0f172a;font-weight:900}
    #${APP}-panel .${APP}-bar-row{display:grid;grid-template-columns:94px minmax(20px,1fr) 67px;align-items:center;gap:8px;margin-bottom:9px;font-size:11px;color:#334155}
    #${APP}-panel .${APP}-track{background:#e8edf4;height:12px;overflow:hidden;border-radius:20px}
    #${APP}-panel .${APP}-fill{display:block;background:#64748b;height:100%;border-radius:20px;max-width:100%}
    #${APP}-panel .${APP}-fill.excellent{background:#16a34a}#${APP}-panel .${APP}-fill.verygood{background:#0ea5e9}
    #${APP}-panel .${APP}-fill.good{background:#6366f1}#${APP}-panel .${APP}-fill.pass{background:#eab308}
    #${APP}-panel .${APP}-fill.weak{background:#ef4444}#${APP}-panel .${APP}-fill.none{background:#94a3b8}
    #${APP}-panel .${APP}-report-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:9px;margin-bottom:12px}
    #${APP}-panel .${APP}-report-stat{border:1px solid #e2e8f0;background:#f8fafc;border-radius:10px;padding:12px;font-size:11px}
    #${APP}-panel .${APP}-report-stat b{display:block;color:#0f172a;font-size:19px}
    #${APP}-panel .${APP}-gradeview[hidden]{display:none!important}
    #${APP}-panel .${APP}-subhead{font-weight:900;margin:14px 0 9px;color:#0f172a;font-size:13px}
    #${APP}-panel .${APP}-rowempty{padding:18px;text-align:center;color:#64748b}
    #${APP}-panel .${APP}-badge{display:inline-block;background:#e2e8f0;border-radius:99px;padding:3px 8px;font-size:10px;font-weight:800;color:#334155}
    #${APP}-panel .${APP}-badge.warn{background:#fef3c7;color:#92400e}
    #${APP}-panel .${APP}-badge.ok{background:#dcfce7;color:#166534}
    #${APP}-panel .${APP}-idxwrap{overflow-x:auto}
    #${APP}-panel .${APP}-table{min-width:800px}
    #${APP}-panel .${APP}-table td{word-break:normal}
    @media(max-width:1260px){#${APP}-panel .${APP}-filters{grid-template-columns:repeat(3,minmax(140px,1fr))}}
    @media(max-width:700px){#${APP}-panel .${APP}-filters{grid-template-columns:repeat(2,minmax(0,1fr))}}
  `;

  const injectStyle = () => {
    if (document.getElementById(`${APP}-style`)) return;
    const style = document.createElement('style');
    style.id = `${APP}-style`;
    style.textContent = css + parityCss;
    document.head.appendChild(style);
  };

  const toast = (message, type = 'info') => {
    let box = document.getElementById(`${APP}-toast`);
    if (!box) {
      box = document.createElement('div');
      box.id = `${APP}-toast`;
      document.body.appendChild(box);
    }
    box.className = type;
    box.textContent = message;
    box.classList.add('show');
    clearTimeout(box._t);
    box._t = setTimeout(() => box.classList.remove('show'), 3500);
  };

  const setBusy = (busy, label = '') => {
    state.loading = busy;
    const status = document.getElementById(`${APP}-status`);
    if (status) {
      status.textContent = busy ? (label || 'جارٍ المعالجة…') : 'جاهز';
      status.classList.toggle('busy', busy);
    }
    document.querySelectorAll(`#${APP}-panel button, #${APP}-import-modal button`).forEach(btn => btn.disabled = !!busy && !btn.dataset.allowbusy);
  };

  const findMount = () => {
    const mainTitle = document.getElementById('mainTitle');
    if (mainTitle) {
      let node = mainTitle;
      for (let i = 0; i < 5 && node?.parentElement; i++, node = node.parentElement) {
        if (node.parentElement && node.parentElement.children.length > 1) return node.parentElement;
      }
    }
    return document.querySelector('main .container-fluid,main .container,main,.container-fluid,.container') || document.body;
  };

  const insertPanel = (title, sub, actions = '') => {
    let panel = document.getElementById(`${APP}-panel`);
    if (panel) return panel;
    panel = document.createElement('section');
    panel.id = `${APP}-panel`;
    panel.innerHTML = `<div class="${APP}-head"><div><div class="${APP}-title">${esc(title)}</div><div class="${APP}-sub">${esc(sub)}</div></div><div class="${APP}-toolbar">${actions}<span id="${APP}-status" class="${APP}-status">جاهز</span></div></div><div id="${APP}-body" class="${APP}-body"></div>`;
    const mount = findMount();
    const ref = document.querySelector('#divSearchContainerId,#divSearchResultId,.homeworks-management-section');
    if (ref?.parentElement) ref.parentElement.insertBefore(panel, ref);
    else mount.prepend(panel);
    return panel;
  };

  const getActivityTitle = (doc = document) => {
    const candidates = [...doc.querySelectorAll('h4,h5,h6')]
      .map(el => clean(el.innerText || el.textContent || ''))
      .filter(Boolean)
      .filter(t => !/^(?:إدارة الأنشطة المدرسية|استعراض اجابات الطلبة|نسبة حل الطلاب|نسبة درجات الطلاب|الفصل المدرسي\s*:|البحث فى الأنشطة المرسلة|معلومات النشاط|تفاصيل النشاط)$/i.test(t));
    const preferred = candidates.find(t => /(?:مشروع|نشاط|مهمة|بحث|تفاعلي)/i.test(t) && t.length < 220);
    return preferred || clean(document.getElementById('mainTitle')?.textContent || '') || 'النشاط';
  };

  const getParamFromLoadStudents = key => {
    const fn = typeof globalThis.loadStudents === 'function' ? String(globalThis.loadStudents) : '';
    if (!fn) return '';
    const k = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return fn.match(new RegExp(`${k}\\s*:\\s*['\"]([^'\"]*)['\"]`))?.[1]
      ?? fn.match(new RegExp(`${k}\\s*:\\s*(true|false|[\\d.]+)`, 'i'))?.[1]
      ?? '';
  };

  const projectParams = () => ({
    IsPublished: getParamFromLoadStudents('IsPublished') || clean(document.getElementById('Published')?.value) || 'true',
    ProjectId: getParamFromLoadStudents('ProjectId'),
    LectureClassId: getParamFromLoadStudents('LectureClassId'),
    PublishedProjectId: getParamFromLoadStudents('PublishedProjectId'),
    IsGradebook: getParamFromLoadStudents('IsGradebook'),
    SchoolId: getParamFromLoadStudents('SchoolId') || clean(document.getElementById('SchoolId')?.value),
    SubjectId: getParamFromLoadStudents('SubjectId'),
    TeacherId: getParamFromLoadStudents('TeacherId'),
    SemesterId: getParamFromLoadStudents('SemesterId'),
    IsCreatedByTeacher: getParamFromLoadStudents('IsCreatedByTeacher'),
    IsCurrentTeacher: getParamFromLoadStudents('IsCurrentTeacher'),
    PublishLectureId: getParamFromLoadStudents('PublishLectureId'),
    SolvingType: getParamFromLoadStudents('SolvingType'),
    ProjectStarts: getParamFromLoadStudents('ProjectStarts'),
    IsRelatedToSubject: getParamFromLoadStudents('IsRelatedToSubject') || 'true'
  });

  const postForm = async (url, data) => {
    const body = new URLSearchParams();
    Object.entries(data || {}).forEach(([k, v]) => {
      if (Array.isArray(v)) v.forEach(x => body.append(k, x));
      else if (v !== undefined && v !== null) body.append(k, String(v));
    });
    const response = await fetch(url, {
      method: 'POST', credentials: 'include', cache: 'no-store',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' },
      body: body.toString()
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    try {
      const json = JSON.parse(text);
      return typeof json === 'string' ? json : (json?.html || json?.data || text);
    } catch { return text; }
  };

  const groupsFromDoc = doc => {
    const map = new Map();
    doc.querySelectorAll('[name^="List["]').forEach(el => {
      const m = String(el.name || '').match(/^List\[(\d+)\]\.(.+)$/);
      if (!m) return;
      const index = Number(m[1]);
      if (!map.has(index)) map.set(index, {});
      map.get(index)[m[2]] = el.value ?? el.getAttribute('value') ?? '';
    });
    return map;
  };

  const studentNameKey = function(value){
 return norm(value).replace(/[\u200b-\u200d\u2060\ufeff]/g,'').replace(/[\u060c\u061b\u061f.,:()ـ\-\/_]+/g,' ').replace(/^(?:اسم\s*الطالب|الطالب|الطالبه)\s*/,'').replace(/\s+/g,' ').trim();
};

    const studentIdKey = function(value){
 const v=clean(value).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/\s+/g,'');
 return /^\d+$/.test(v)?v.replace(/^0+(?=\d)/,''):v.toLowerCase();
};

    const studentNameFromSelect = function(studentId){
 const key=studentIdKey(studentId);
 if(!key)return '';
 const select=document.getElementById('studentsFilter');
 const opt=[...(select?.options||[])].find(o=>studentIdKey(o.value)===key);
 const text=clean(opt?.textContent||'').replace(/^(?:اسم\s*الطالب|الطالب)\s*[:：-]?\s*/,'');
 return studentNameKey(text).split(' ').length>=3?text:'';
};

    const findVisualBlock = function(doc,studentId) {
 const sid=String(studentId||'');
 if(!sid)return null;
 const checkbox=doc.getElementById(`checkStudent-${sid}`)||[...doc.querySelectorAll('input[id^="checkStudent-"]')].find(el=>String(el.value||'')===sid);
 if(!checkbox)return null;
 let fallback=null,node=checkbox;
 for(let depth=0;depth<15&&node;depth++,node=node.parentElement){
   const checks=node.querySelectorAll?.('input[id^="checkStudent-"]').length||0;
   const txt=clean(node.textContent||'');
   if(checks===1&&txt.length>=8&&txt.length<1300)fallback=node;
   if(checks===1&&/الفصل\s+المدرسي\s*:/i.test(txt))return node;
 }
 return fallback;
};

  // إعادة الدالة الأساسية لاستخراج الفصل من بطاقة الطالب.
  const classFromBlock = block => {
    const text = clean(block?.innerText || block?.textContent || '');
    return text.match(/الفصل\s+المدرسي\s*:\s*(.+?)(?=\s+(?:الدرجة|الإجابة|ملاحظ|الحل|استعراض|$))/i)?.[1]?.trim()
      || text.match(/الفصل\s+المدرسي\s*:\s*([^|\n]+)/i)?.[1]?.trim()
      || '';
  };

    const nameFromBlock = function(block,fields,studentId) {
 const optionName=studentNameFromSelect(studentId);
 const vals=[
  fields.fullName,fields.FullName,fields.Name,fields.StudentName,fields.studentName,fields.StudentFullName,
  optionName
 ].map(clean).filter(Boolean);
 for(const v of vals)if(studentNameKey(v).split(' ').length>=3&&v.length<180)return v;
 const text=String(block?.textContent||block?.innerText||'').replace(/\u00a0/g,' ');
 const before=clean(text.split(/الفصل\s+المدرسي\s*:/i)[0]).replace(/^(?:اسم\s*الطالب|الطالب|الطالبه)\s*[:：-]?\s*/,'').replace(/^(?:اختيار|تحديد)\s*(?:الطالب)?\s*/,'');
 const picked=before.slice(0,180);
 return studentNameKey(picked).split(' ').length>=3?picked:`طالب ${clean(studentId||fields.StudentId)}`;
};

    const parseStudentsHtml = html => {
    const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
    const groups = groupsFromDoc(doc);
    const rows = [];
    for (const [index, fields] of [...groups.entries()].sort((a, b) => a[0] - b[0])) {
      const studentId = clean(fields.StudentId);
      if (!studentId) continue;
      const block = findVisualBlock(doc, studentId);
      const grade = num(fields.Grade);
      const totalGrade = num(fields.TotalGrade);
      rows.push({
        index,
        studentId,
        name: nameFromBlock(block, fields, studentId),
        className: classFromBlock(block),
        grade,
        totalGrade,
        feedback: clean(fields.feedBack),
        hasAnswer: truthy(fields.hasAnswer),
        isApproved: truthy(fields.isApproved),
        rawFields: { ...fields }
      });
    }
    return rows;
  };

  const expectedStudentCount = () => {
    const optionIds = [...document.querySelectorAll('#studentsFilter option')]
      .map(o => clean(o.value)).filter(Boolean);
    if (optionIds.length) return new Set(optionIds).size;
    const ids = [...document.querySelectorAll('.multiselect-container input[type="checkbox"]')]
      .map(x => clean(x.value)).filter(v => /^\d+$/.test(v));
    return new Set(ids).size;
  };

  const fetchAllStudents = async () => {
    const base = projectParams();
    if (!base.ProjectId || !base.PublishedProjectId) throw new Error('تعذر قراءة معرف النشاط المنشور من الصفحة.');
    const expected = expectedStudentCount();
    const byId = new Map();
    for (let page = 1; page <= 100; page++) {
      const html = await postForm('/Projects/Projects/GetGradeStudentsList', {
        ...base, StudentIds: '', Status: 'All', SortBy: 'name_asc', PageNumber: page
      });
      const rows = parseStudentsHtml(html);
      if (!rows.length) break;
      let newCount = 0;
      rows.forEach(row => {
        if (!byId.has(row.studentId)) newCount++;
        byId.set(row.studentId, row);
      });
      if ((expected && byId.size >= expected) || newCount === 0) break;
    }
    const rows = [...byId.values()].sort((a, b) => compareNames(a.name, b.name));
    state.totalExpected = expected || rows.length;
    return rows;
  };

  const band = row => {
    if (!Number.isFinite(row.grade) || !Number.isFinite(row.totalGrade) || row.totalGrade <= 0) return 'none';
    const p = (row.grade / row.totalGrade) * 100;
    if (p >= 90) return 'excellent';
    if (p >= 80) return 'verygood';
    if (p >= 70) return 'good';
    if (p > 50) return 'pass';
    return 'weak';
  };

  const bandLabel = key => ({ excellent: 'ممتاز', verygood: 'جيد جدًا', good: 'جيد', pass: 'مقبول', weak: 'ضعيف', none: 'بدون تقدير' }[key] || '—');

  const filteredRows = () => {
    let rows = state.students.slice();
    const f = state.filter;
    if (f.className !== 'all') rows = rows.filter(r => clean(r.className) === f.className);
    if (f.query) { const q = norm(f.query); rows = rows.filter(r => [r.name, r.studentId, r.className, r.feedback].some(v => norm(v).includes(q))); }
    if (f.submission === 'submitted') rows = rows.filter(r => r.hasAnswer);
    if (f.submission === 'not_submitted') rows = rows.filter(r => !r.hasAnswer);
    if (f.grading === 'graded') rows = rows.filter(r => Number.isFinite(r.grade));
    if (f.grading === 'ungraded') rows = rows.filter(r => !Number.isFinite(r.grade));
    if (f.level !== 'all') rows = rows.filter(r => band(r) === f.level);
    if (f.sort === 'grade_desc') rows.sort((a, b) => (Number.isFinite(b.grade) ? b.grade : -Infinity) - (Number.isFinite(a.grade) ? a.grade : -Infinity) || compareNames(a.name, b.name));
    else if (f.sort === 'grade_asc') rows.sort((a, b) => (Number.isFinite(a.grade) ? a.grade : Infinity) - (Number.isFinite(b.grade) ? b.grade : Infinity) || compareNames(a.name, b.name));
    else if (f.sort === 'name_desc') rows.sort((a, b) => compareNames(b.name, a.name));
    else if (f.sort === 'submission_submitted') rows.sort((a, b) => Number(b.hasAnswer) - Number(a.hasAnswer) || compareNames(a.name, b.name));
    else if (f.sort === 'submission_not_submitted') rows.sort((a, b) => Number(a.hasAnswer) - Number(b.hasAnswer) || compareNames(a.name, b.name));
    else if (f.sort === 'level_high') rows.sort((a,b) => ((Number.isFinite(b.grade)&&b.totalGrade>0)?b.grade/b.totalGrade:-1)-((Number.isFinite(a.grade)&&a.totalGrade>0)?a.grade/a.totalGrade:-1) || compareNames(a.name,b.name));
    else if (f.sort === 'level_low') rows.sort((a,b) => ((Number.isFinite(a.grade)&&a.totalGrade>0)?a.grade/a.totalGrade:Infinity)-((Number.isFinite(b.grade)&&b.totalGrade>0)?b.grade/b.totalGrade:Infinity) || compareNames(a.name,b.name));
    else rows.sort((a, b) => compareNames(a.name, b.name));
    return rows;
  };

  const summary = rows => {
    const total = rows.length;
    const submitted = rows.filter(r => r.hasAnswer).length;
    const gradedRows = rows.filter(r => Number.isFinite(r.grade) && Number.isFinite(r.totalGrade) && r.totalGrade > 0);
    const percents = gradedRows.map(r => (r.grade / r.totalGrade) * 100);
    return {
      total,
      submitted,
      notSubmitted: total - submitted,
      submissionRate: pct(submitted, total),
      graded: gradedRows.length,
      ungraded: total - gradedRows.length,
      gradingRate: pct(gradedRows.length, total),
      avg: percents.length ? percents.reduce((a, b) => a + b, 0) / percents.length : null,
      high: percents.length ? Math.max(...percents) : null,
      low: percents.length ? Math.min(...percents) : null
    };
  };

  const classOptions = () => [...new Set(state.students.map(r => clean(r.className)).filter(Boolean))].sort(compareNames);

  const filterContext = () => {
    const f = state.filter;
    const parts = [];
    if (f.className !== 'all') parts.push(`الفصل: ${f.className}`);
    if (f.submission !== 'all') parts.push(`التسليم: ${f.submission === 'submitted' ? 'سلّم' : 'لم يسلّم'}`);
    if (f.grading !== 'all') parts.push(`الرصد: ${f.grading === 'graded' ? 'مرصود' : 'غير مرصود'}`);
    if (f.level !== 'all') parts.push(`التقدير: ${bandLabel(f.level)}`);
    if (f.query) parts.push(`البحث: ${f.query}`);
    return parts.join(' · ') || 'كل الطلاب';
  };

  const rowHtml = (r, i) => {
    const p = Number.isFinite(r.grade) && Number.isFinite(r.totalGrade) && r.totalGrade > 0 ? pct(r.grade, r.totalGrade) : null;
    const sub = r.hasAnswer ? `<span class="${APP}-pill ${APP}-ok">سلّم</span>` : `<span class="${APP}-pill ${APP}-bad">لم يسلّم</span>`;
    const grd = Number.isFinite(r.grade) ? `<span class="${APP}-pill ${APP}-info">مرصود</span>` : `<span class="${APP}-pill ${APP}-warn">غير مرصود</span>`;
    return `<tr><td>${i + 1}</td><td>${esc(r.name)}</td><td>${esc(r.className || '—')}</td><td>${sub}</td><td>${grd}</td><td>${Number.isFinite(r.grade) ? fmt(r.grade) : '—'} / ${Number.isFinite(r.totalGrade) ? fmt(r.totalGrade) : '—'}</td><td>${p == null ? '—' : `${fmt(p)}%`}</td><td>${esc(bandLabel(band(r)))}</td><td>${esc(r.feedback || '')}</td></tr>`;
  };


  const levelKeys = ['excellent','verygood','good','pass','weak','none'];
  const gradePercent = r => Number.isFinite(r.grade) && Number.isFinite(r.totalGrade) && r.totalGrade > 0 ? pct(r.grade,r.totalGrade) : null;
  const detailedStats = rows => {
    const s = summary(rows);
    const percents = rows.map(gradePercent).filter(Number.isFinite).sort((a,b) => a-b);
    s.median = percents.length ? (percents[Math.floor((percents.length-1)/2)] + percents[Math.ceil((percents.length-1)/2)])/2 : null;
    s.low = percents.length ? percents[0] : null;
    s.levels = Object.fromEntries(levelKeys.map(k => [k,rows.filter(r => band(r) === k).length]));
    s.byClass = [...new Set(rows.map(r=>r.className || 'غير محدد'))].sort(compareNames).map(name => {
      const rs = rows.filter(r=>(r.className||'غير محدد')===name);
      const scored = rs.map(gradePercent).filter(Number.isFinite);
      return { name, total:rs.length,submitted:rs.filter(r=>r.hasAnswer).length,graded:scored.length,avg:scored.length?scored.reduce((a,b)=>a+b,0)/scored.length:null };
    });
    s.buckets = [
      { label:'90–100%', count:percents.filter(v=>v>=90).length, kind:'excellent' },
      { label:'80–<90%',count:percents.filter(v=>v>=80&&v<90).length,kind:'verygood' },
      { label:'70–<80%',count:percents.filter(v=>v>=70&&v<80).length,kind:'good' },
      { label:'51–<70%',count:percents.filter(v=>v>50&&v<70).length,kind:'pass' },
      { label:'0–50%',count:percents.filter(v=>v<=50).length,kind:'weak' }
    ];
    return s;
  };

  const metric = (value,label) => `<div class="${APP}-metric"><b>${esc(value)}</b><span>${esc(label)}</span></div>`;
  const bars = (items,max) => items.map(x=>`<div class="${APP}-bar-row"><span title="${esc(x.label)}">${esc(x.label)}</span><div class="${APP}-track"><span class="${APP}-fill ${esc(x.kind||'')}" style="width:${max ? Math.max(0,Math.min(100,100*x.count/max)) : 0}%"></span></div><b>${x.count}${x.suffix||''}</b></div>`).join('');
  const gradeAnalyticsHtml = (rows,s) => {
    const maxLevel = Math.max(1,...levelKeys.map(k=>s.levels[k]));
    const classes = s.byClass;
    return `<div class="${APP}-chart-grid">
      <div class="${APP}-chart"><h4>توزيع التقديرات</h4>${bars(levelKeys.map(k=>({label:bandLabel(k),count:s.levels[k],kind:k})),maxLevel)}</div>
      <div class="${APP}-chart"><h4>توزيع الدرجات المئوية</h4>${bars(s.buckets,Math.max(1,...s.buckets.map(b=>b.count)))}</div>
      <div class="${APP}-chart"><h4>نسبة التسليم والرصد</h4>${bars([{label:'سلّم',count:s.submitted,kind:'excellent'},{label:'لم يسلّم',count:s.notSubmitted,kind:'weak'},{label:'درجة مرصودة',count:s.graded,kind:'verygood'},{label:'غير مرصود',count:s.ungraded,kind:'none'}],Math.max(1,s.total))}</div>
      <div class="${APP}-chart"><h4>متوسط الأداء حسب الفصل</h4>${classes.length?bars(classes.map(c=>({label:c.name,count:c.avg||0,suffix:'%',kind:'good'})),100):'لا توجد فصول'}</div>
    </div><div class="${APP}-subhead">مقارنة الفصول</div><div class="${APP}-tablewrap"><table class="${APP}-table"><thead><tr><th>الفصل</th><th>الطلاب</th><th>سلّم</th><th>لم يسلّم</th><th>مرصود</th><th>نسبة التسليم</th><th>متوسط الأداء</th></tr></thead><tbody>${classes.map(c=>`<tr><td>${esc(c.name)}</td><td>${c.total}</td><td>${c.submitted}</td><td>${c.total-c.submitted}</td><td>${c.graded}</td><td>${fmt(pct(c.submitted,c.total))}%</td><td>${c.avg===null?'—':fmt(c.avg)+'%'}</td></tr>`).join('')}</tbody></table></div>`;
  };

  // لوحة واحدة تتشارك فلاترها جميع الإحصائيات والتقارير والمخرجات.
  const updateGradeViews = () => {
    const rows = filteredRows();
    const s = detailedStats(rows);
    const m = document.getElementById(`${APP}-dynamic-metrics`);
    if (m) m.innerHTML = [metric(s.total,'الطلاب المعروضون'),metric(s.submitted,'سلّم'),metric(s.notSubmitted,'لم يسلّم'),metric(`${fmt(s.submissionRate)}%`,'نسبة التسليم'),metric(s.graded,'درجات مرصودة'),metric(s.avg===null?'—':`${fmt(s.avg)}%`,'متوسط الأداء'),metric(s.high===null?'—':`${fmt(s.high)}%`,'أعلى أداء'),metric(s.low===null?'—':`${fmt(s.low)}%`,'أقل أداء')].join('');
    const count=document.getElementById(`${APP}-shown-count`);
    if (count) count.textContent=`عرض ${rows.length} من ${state.students.length} طالبًا`;
    const tbody=document.getElementById(`${APP}-students-tbody`);
    if(tbody) tbody.innerHTML=rows.length?rows.map(rowHtml).join(''):`<tr><td colspan="9" class="${APP}-rowempty">لا توجد نتائج مطابقة للبحث والتصفية.</td></tr>`;
    const analytics=document.getElementById(`${APP}-analytics-host`);
    if(analytics) analytics.innerHTML=gradeAnalyticsHtml(rows,s);
    const context=document.getElementById(`${APP}-filter-context`);
    if(context) context.textContent=`${filterContext()} · تم جلب ${state.students.length}${state.totalExpected ? ` من ${state.totalExpected}`:''} طالبًا`;
    const report=document.getElementById(`${APP}-report-host`);
    if(report) report.innerHTML=`<div class="${APP}-report-grid">${[
      ['متوسط الأداء',s.avg===null?'—':fmt(s.avg)+'%'],['الوسيط',s.median===null?'—':fmt(s.median)+'%'],['أعلى درجة',s.high===null?'—':fmt(s.high)+'%'],['أقل درجة',s.low===null?'—':fmt(s.low)+'%'],['نسبة الرصد',fmt(s.gradingRate)+'%'],['عدد الفصول',s.byClass.length],['تقدير ممتاز',s.levels.excellent],['تقدير ضعيف',s.levels.weak]
    ].map(([k,v])=>`<div class="${APP}-report-stat"><b>${esc(v)}</b>${esc(k)}</div>`).join('')}</div><div class="${APP}-note">التقرير يتبع البحث والفصل والتسليم والتقدير تمامًا، ويمكن تصديره من شريط الأدوات. المتوسط يحسب من الدرجات المتاحة فقط، ولا يستبدل الدرجات الناقصة بأصفار.</div>`;
  };

  const setGradeView = view => {
    state.view=view;
    document.querySelectorAll(`#${APP}-panel .${APP}-gradeview`).forEach(el=>{el.hidden=el.dataset.view!==view;});
    document.querySelectorAll(`#${APP}-panel .${APP}-tab`).forEach(el=>{const selected=el.dataset.view===view;el.classList.toggle('active',selected);el.setAttribute('aria-selected',String(selected));});
  };

  const renderGradeBody = () => {
    const body=document.getElementById(`${APP}-body`);
    if(!body)return;
    const classes=classOptions();
    if(state.filter.className!=='all'&&!classes.includes(state.filter.className))state.filter.className='all';
    body.innerHTML=`
      <div id="${APP}-dynamic-metrics" class="${APP}-metrics"></div>
      <div class="${APP}-note"><b>${esc(state.activityTitle)}</b><span id="${APP}-filter-context"></span></div>
      <div class="${APP}-searchline"><input id="${APP}-search" type="search" autocomplete="off" placeholder="بحث فوري باسم الطالب أو الرقم أو الفصل أو الملاحظة…" aria-label="بحث في طلاب النشاط" value="${esc(state.filter.query)}"><span id="${APP}-shown-count" class="${APP}-count"></span><button id="${APP}-clear-search" class="${APP}-btn gray" type="button">مسح البحث</button></div>
      <div class="${APP}-filters">
      <label class="${APP}-field">الفصل<select id="${APP}-class"><option value="all">كل الفصول</option>${classes.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('')}</select></label>
      <label class="${APP}-field">التسليم<select id="${APP}-submission"><option value="all">الكل</option><option value="submitted">سلّم</option><option value="not_submitted">لم يسلّم</option></select></label>
      <label class="${APP}-field">الرصد<select id="${APP}-grading"><option value="all">الكل</option><option value="graded">مرصود</option><option value="ungraded">غير مرصود</option></select></label>
      <label class="${APP}-field">التقدير<select id="${APP}-level"><option value="all">كل التقديرات</option>${levelKeys.map(k=>`<option value="${k}">${esc(bandLabel(k))}</option>`).join('')}</select></label>
      <label class="${APP}-field">الفرز<select id="${APP}-sort"><option value="name_asc">الاسم أ ← ي</option><option value="name_desc">الاسم ي ← أ</option><option value="submission_submitted">المسلّم أولًا</option><option value="submission_not_submitted">غير المسلّم أولًا</option><option value="level_high">التقدير الأعلى</option><option value="level_low">التقدير الأقل</option><option value="grade_desc">الدرجة الأعلى</option><option value="grade_asc">الدرجة الأقل</option></select></label>
      <div class="${APP}-field"><span>تصفية</span><button id="${APP}-quick-reset" class="${APP}-btn gray" type="button">إعادة الضبط</button></div>
      </div>
      <div class="${APP}-tabs" role="tablist"><button class="${APP}-tab" role="tab" data-view="students" type="button">سجل الطلاب</button><button class="${APP}-tab" role="tab" data-view="analytics" type="button">الرسوم والتحليل</button><button class="${APP}-tab" role="tab" data-view="report" type="button">ملخص التقرير</button></div>
      <div class="${APP}-gradeview" data-view="students"><div class="${APP}-tablewrap"><table class="${APP}-table"><thead><tr><th>#</th><th>الطالب</th><th>الفصل</th><th>التسليم</th><th>الرصد</th><th>الدرجة</th><th>النسبة</th><th>التقدير</th><th>الملاحظة</th></tr></thead><tbody id="${APP}-students-tbody"></tbody></table></div></div>
      <div class="${APP}-gradeview" data-view="analytics" id="${APP}-analytics-host"></div>
      <div class="${APP}-gradeview" data-view="report" id="${APP}-report-host"></div>
      <div class="${APP}-note" id="${APP}-import-hint">لا تُغيَّر الدرجات من عرض التحليل. اضغط «استيراد درجات» لفتح نافذة الاستيراد والمراجعة قبل الحفظ.</div>`;
    [['class','className'],['submission','submission'],['grading','grading'],['level','level'],['sort','sort']].forEach(([id,key])=>{
      const el=document.getElementById(`${APP}-${id}`);if(!el)return;
      el.value=state.filter[key];
      el.addEventListener('change',()=>{state.filter[key]=el.value;updateGradeViews();});
    });
    document.getElementById(`${APP}-search`)?.addEventListener('input',e=>{state.filter.query=e.target.value;updateGradeViews();});
    document.getElementById(`${APP}-clear-search`)?.addEventListener('click',()=>{state.filter.query='';const i=document.getElementById(`${APP}-search`);if(i){i.value='';i.focus();}updateGradeViews();});
    document.getElementById(`${APP}-quick-reset`)?.addEventListener('click',resetFilters);
    document.querySelectorAll(`#${APP}-panel .${APP}-tab`).forEach(b=>b.addEventListener('click',()=>setGradeView(b.dataset.view)));

    updateGradeViews();setGradeView(state.view);
    if(state.importPreview&&state.importExpanded)renderImportPreview();
  };

  const refreshGrade = async () => {
    setBusy(true, 'جاري جلب جميع الطلاب…');
    try {
      state.activityTitle = getActivityTitle(document);
      state.students = await fetchAllStudents();
      state.lastRefresh = new Date().toISOString();
      renderGradeBody();
      toast(`تم جلب ${state.students.length} طالبًا من النشاط.`, 'success');
    } catch (e) {
      toast(String(e?.message || e), 'error');
      const body = document.getElementById(`${APP}-body`);
      if (body) body.innerHTML = `<div class="${APP}-note">تعذر تحليل النشاط: ${esc(e?.message || e)}</div>`;
    } finally { setBusy(false); }
  };

  const resetFilters = () => {
    state.filter = { className: 'all', submission: 'all', level: 'all', grading: 'all', sort: 'name_asc', query: '' };
    renderGradeBody();
  };

  const ensureImportModal = function ensureImportModal(){
 let modal=document.getElementById(`${APP}-import-modal`);
 if(modal)return modal;
 modal=document.createElement('section');
 modal.id=`${APP}-import-modal`;
 modal.className=`${APP}-modal`;
 modal.hidden=true;
 modal.setAttribute('role','dialog');
 modal.setAttribute('aria-modal','true');
 modal.setAttribute('aria-label','استيراد درجات الأنشطة والمشاريع');
 modal.innerHTML=`<div class="${APP}-dialog" dir="rtl">
   <div class="${APP}-dialog-head">
    <div><div class="${APP}-title">استيراد درجات Excel / CSV</div><div class="${APP}-sub">مطابقة آمنة · معاينة مفصلة · نسخة احتياطية · تحقق من الحفظ</div></div>
    <button id="${APP}-modal-close" class="${APP}-btn gray" type="button" aria-label="إغلاق نافذة الاستيراد">إغلاق ×</button>
   </div>
   <div class="${APP}-note"><b>قبل الحفظ:</b> الأولوية لرقم الطالب المؤكد، ثم الاسم والفصل عند عدم وجود رقم مطابق. يُرفض الاسم المكرر والتعارض المؤكد بين الهويات. جميع درجات الصفر تُعرض صراحة في المعاينة.</div>
   <div class="${APP}-drop" style="margin:14px 0"><input id="${APP}-file" type="file" accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"><b>اختر ملف الدرجات أو اسحبه هنا</b><span>Excel أو CSV — لن يُحفظ شيء قبل المعاينة والتأكيد</span></div>
   <div id="${APP}-import-preview" aria-live="polite"></div>
 </div>`;
 document.body.appendChild(modal);
 const close=()=>{if(state.loading)return;modal.hidden=true;state.importExpanded=false;};
 document.getElementById(`${APP}-modal-close`)?.addEventListener('click',close);
 modal.addEventListener('click',e=>{if(e.target===modal)close();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.hidden)close();});
 document.getElementById(`${APP}-file`)?.addEventListener('change',async e=>{
   await readImportFile(e.target.files?.[0]);
   e.target.value='';
 });
 return modal;
};

  const openImport = function newOpenImport() {
 if(state.loading)return;
 const modal=ensureImportModal();
 modal.hidden=false;state.importExpanded=true;
 if(state.importPreview)renderImportPreview();
 document.getElementById(`${APP}-file`)?.focus();
};

  const parseCsv = text => {
    const rows = [];
    let row = [], cell = '', quoted = false;
    const src = String(text || '').replace(/^\uFEFF/, '');
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (quoted) {
        if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') quoted = false;
        else cell += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    row.push(cell.replace(/\r$/, ''));
    if (row.some(x => clean(x))) rows.push(row);
    return rows;
  };

  const detectColumns = function(headers) {
 const nh=headers.map(norm);
 const find=patterns=>nh.findIndex(h=>patterns.some(p=>p.test(h)));
 return {
  studentId:find([/student\s*id/,/studentid/,/رقم\s*الطالب/,/معرف\s*الطالب/,/^id$/]),
  name:find([/اسم\s*الطالب/,/^الطالب$/,/(?:student|full)\s*name/,/^name$/]),
  grade:find([/^الدرجه$/,/^درجه$/,/الدرجه\s*المحصله/,/score/,/grade/,/mark/]),
  feedback:find([/ملاحظ/,/تعليق/,/feedback/,/comment/]),
  submissionStatus:find([/^الحاله$/, /حاله\s*التسليم/, /submission\s*status/, /^status$/]),
  className:find([/^الفصل$/, /الفصل\s*المدرسي/, /class\s*name/, /^class$/])
 };
};

    const readImportFile = async function(file) {
 if(!file)return;
 setBusy(true,'جارٍ فحص الملف ومطابقة الطلاب…');
 try {
  if(!state.students.length)throw new Error('قائمة طلاب المشروع فارغة. اضغط «تحديث التحليل» أولًا.');
  let aoa=[],sheetName='';
  const ext=file.name.split('.').pop().toLowerCase();
  if(ext==='csv') {aoa=parseCsv(await file.text());sheetName='CSV';}
  else {
   if(!globalThis.XLSX)throw new Error('مكتبة Excel غير متاحة.');
   const book=XLSX.read(await file.arrayBuffer(),{type:'array',raw:false});
   for(const shName of book.SheetNames) {
    const rows=XLSX.utils.sheet_to_json(book.Sheets[shName],{header:1,defval:'',raw:false});
    const headerIndex=rows.slice(0,15).findIndex(row=>{
     const c=detectColumns((row||[]).map(clean));
     return c.grade>=0&&(c.name>=0||c.studentId>=0);
    });
    if(headerIndex>=0){aoa=rows.slice(headerIndex);sheetName=shName;break;}
   }
  }
  if(aoa.length<2)throw new Error('لم أجد ورقة تحتوي على أعمدة «اسم الطالب» و«الدرجة». راجع ترتيب الأعمدة.');
  const headers=aoa[0].map(clean),cols=detectColumns(headers);
  if(cols.grade<0)throw new Error('تعذر العثور على عمود الدرجة.');
  if(cols.name<0&&cols.studentId<0)throw new Error('يلزم عمود اسم الطالب أو رقم الطالب.');

  const idMap=new Map(),nameMap=new Map();
  const add=(map,key,student)=>{
   if(!key)return;
   if(!map.has(key))map.set(key,[]);
   if(!map.get(key).some(s=>s.studentId===student.studentId))map.get(key).push(student);
  };
  state.students.forEach(student=>{
   const f=student.rawFields||{};
   const identifiers=[student.studentId,f.StudentNationalId,f.NationalId,f.NationalID,f.IdentityNumber,f.StudentNumber,f.CivilId,f.StudentIdentityNumber];
   identifiers.forEach(v=>add(idMap,studentIdKey(v),student));
   [student.name,studentNameFromSelect(student.studentId),f.FullName,f.fullName,f.StudentName,f.Name].forEach(v=>add(nameMap,studentNameKey(v),student));
  });

  const preview=[],matchedIds=new Map();
  for(let i=1;i<aoa.length;i++){
   const row=aoa[i]||[];
   if(!row.some(x=>clean(x)))continue;
   const sid=cols.studentId>=0?clean(row[cols.studentId]):'';
   const name=cols.name>=0?clean(row[cols.name]):'';
   const className=cols.className>=0?clean(row[cols.className]):'';
   const grade=num(row[cols.grade]);
   const feedback=cols.feedback>=0?clean(row[cols.feedback]):'';
   const submissionStatus=cols.submissionStatus>=0?clean(row[cols.submissionStatus]):'';
   const idMatches=idMap.get(studentIdKey(sid))||[];
   const nameKey=studentNameKey(name);
   let nameMatches=nameMap.get(nameKey)||[];
   if(nameMatches.length>1&&className){
    const cls=nameMatches.filter(x=>norm(x.className)===norm(className));
    if(cls.length===1)nameMatches=cls;
   }
   // لا نستخدم تطابقًا جزئيًا إلا إذا كان الاسم طويلًا ومميزًا بين جميع طلاب المشروع.
   if(!nameMatches.length&&nameKey.split(' ').length>=4&&nameKey.length>=17){
    nameMatches=state.students.filter(x=>{
     const k=studentNameKey(x.name);
     return k.includes(nameKey)&&(k.length-nameKey.length)<=65;
    });
   }
   let student=null,method='',reason='',status='ready';
   if(idMatches.length===1) {
    student=idMatches[0];method='رقم الطالب';
    // مثل استيراد الواجبات: هوية الطالب ذات الرقم الفريد موثوقة.
    // لا نرفضها لمجرد اختلاف الاسم المستخرج من بطاقة HTML.
    // نوقفها فقط عندما يثبت الاسم الفريد أنه يعود لطالب آخر داخل نفس المشروع.
    if(nameMatches.length===1 && nameMatches[0].studentId!==student.studentId){
     status='identity_conflict';reason='رقم الطالب والاسم يشيران إلى طالبين مختلفين مسجلين في المشروع';
    }else if(name&&studentNameKey(student.name)!==nameKey){
     method='رقم الطالب مؤكد · اختلاف عرض الاسم';
    }
   } else if(idMatches.length>1) {
    status='ambiguous';reason='معرف الطالب غير فريد في بيانات مدرستي';
   } else if(nameMatches.length===1) {
    student=nameMatches[0];method=sid?'اسم فريد (رقم مختلف النظام)':'الاسم الفريد';
   } else if(nameMatches.length>1) {
    status='ambiguous';reason='الاسم متكرر؛ لا يمكن اختيار الطالب تلقائيًا';
   } else {
    status='unmatched';reason='لم يتطابق الاسم أو رقم الطالب مع سجلات المشروع';
   }
   if(status==='ready'&&!Number.isFinite(grade)){
    status='invalid';reason='الدرجة ليست رقمًا صالحًا';
   }else if(status==='ready'&&grade<0){
    status='invalid';reason='درجة سالبة';
   }else if(status==='ready'&&Number.isFinite(student?.totalGrade)&&student.totalGrade>=0&&grade>student.totalGrade){
    status='invalid';reason=`درجة الملف ${fmt(grade)} أعلى من الدرجة القصوى في مدرستي ${fmt(student.totalGrade)}`;
   }else if(status==='ready'&&(!Number.isFinite(student?.totalGrade)||student.totalGrade<=0)){
    status='invalid';reason='الدرجة الكلية في مدرستي غير معروفة؛ لن يتم الحفظ دون تحقق';
   }
   if(status==='ready'&&student&&className&&clean(student.className)&&norm(className)!==norm(student.className)){
    status='identity_conflict';reason='الفصل في الملف يختلف عن الفصل المسجل للطالب في هذا المشروع';
   }
   if(student&&status==='ready'){
    const prior=matchedIds.get(String(student.studentId));
    if(prior){
     status='duplicate';reason=`هذا الطالب مكرر في صفوف الملف (الصف ${prior.sourceRow})`;
     const prev=preview[prior.mark];
     if(prev){prev.status='duplicate';prev.reason=`هذا الطالب مكرر في صفوف الملف (الصف ${i+1})`;}
    }else matchedIds.set(String(student.studentId),{sourceRow:i+1,mark:preview.length});
   }
   // نفس الواجبات: افصل «لا تغيير» عن «جاهز للحفظ».
   if(status==='ready'&&Number.isFinite(student?.grade)&&Math.abs(student.grade-grade)<1e-6
      &&(!state.importFeedback||!feedback||clean(student.feedback)===feedback)){
    status='unchanged';reason='الدرجة مطابقة للموجودة في مدرستي';
   }
   preview.push({sourceRow:i+1,sid,name,className,grade,feedback,submissionStatus,student,method,status,reason});
  }
  const numberNotes=preview.filter(x=>/^\d+(?:[.,]\d+)?$/.test(x.feedback)).length;
  state.importFeedback=false;
  state.importPreview={fileName:file.name,sheetName,rows:preview,numericFeedbackCount:numberNotes};
  state.importExpanded=true;
  ensureImportModal().hidden=false;
  renderImportPreview();
  if(!preview.some(x=>x.status==='ready')&&preview.some(x=>x.status!=='unchanged'))toast('بعض الصفوف تحتاج مراجعة. افتح المعاينة لتفاصيلها.','info');
 }catch(e){toast(String(e?.message||e),'error');}
 finally{setBusy(false);}
};

    const renderImportPreview = function(){
 const host=document.getElementById(`${APP}-import-preview`);
 if(!host||!state.importPreview)return;
 const rows=state.importPreview.rows;
 const ready=rows.filter(r=>r.status==='ready');
 const unchanged=rows.filter(r=>r.status==='unchanged').length;
 const bad=rows.length-ready.length-unchanged;
 const unmatched=rows.filter(r=>r.status==='unmatched').length;
 const invalid=rows.filter(r=>r.status==='invalid').length;
 const ambiguous=rows.filter(r=>['ambiguous','duplicate','identity_conflict'].includes(r.status)).length;
 const fileGrades=rows.map(r=>r.grade).filter(Number.isFinite);
 const maxFile=fileGrades.length?Math.max(...fileGrades):null;
 const platformLimits=[...new Set(state.students.map(s=>s.totalGrade).filter(x=>Number.isFinite(x)&&x>0))];
 const cap=platformLimits.length===1?fmt(platformLimits[0]):platformLimits.length?platformLimits.map(x=>fmt(x)).slice(0,5).join(' / '):'غير متاح';
 const notesWarning=state.importPreview.numericFeedbackCount?`<div class="${APP}-note">تنبيه: يوجد ${state.importPreview.numericFeedbackCount} صفًا يحتوي رقمًا في عمود الملاحظات (مثل 14). <b>لن تُنقل الملاحظات تلقائيًا</b> إلا إذا فعّلت الخيار أدناه.</div>`:'';
 host.innerHTML=`
 <div class="${APP}-note"><b>${esc(state.importPreview.fileName)}</b> · الورقة: ${esc(state.importPreview.sheetName)} · الصفوف: ${rows.length} · <b>جاهز للتغيير: ${ready.length}</b> · مطابق بالفعل: ${unchanged} · يحتاج مراجعة: ${bad} · غير مطابق: ${unmatched} · درجة غير صالحة: ${invalid} · ملتبس: ${ambiguous}</div>
 <div class="${APP}-note">أعلى درجة في الملف: <b>${maxFile===null?'—':fmt(maxFile)}</b> · الدرجة الكلية في مدرستي: <b>${esc(cap)}</b> · الطلاب المحملون: ${state.students.length}.</div>
 ${notesWarning}
 <label class="${APP}-note" style="display:block;cursor:pointer"><input id="${APP}-import-feedback" type="checkbox" ${state.importFeedback?'checked':''}> استيراد الملاحظات أيضًا (اختياري، غير مفعّل افتراضيًا). إن لم تُفعّل هذا الخيار ستبقى ملاحظات مدرستي كما هي.</label>
 <div class="${APP}-toolbar" style="margin-bottom:8px"><button id="${APP}-patch" class="${APP}-btn alt" ${ready.length?'':'disabled'}>تطبيق في الخانات الظاهرة</button><button id="${APP}-save" class="${APP}-btn" ${ready.length?'':'disabled'}>حفظ ${ready.length} درجة على مدرستي</button><button type="button" id="${APP}-preview-xlsx" class="${APP}-btn alt">تصدير المعاينة Excel</button></div>
 <div class="${APP}-tablewrap" style="max-height:380px"><table class="${APP}-table"><thead><tr><th>الصف</th><th>الطالب في الملف</th><th>اسم مدرستي</th><th>رقم الطالب</th><th>الفصل</th><th>حالة التسليم</th><th>طريقة المطابقة</th><th>الدرجة الحالية</th><th>الدرجة الجديدة</th><th>الدرجة القصوى</th><th>الحالة / السبب</th></tr></thead><tbody>
 ${rows.slice(0,300).map(r=>`<tr><td>${r.sourceRow}</td><td>${esc(r.name||'—')}</td><td>${esc(r.student?.name||'—')}</td><td>${esc(r.sid||r.student?.studentId||'—')}</td><td>${esc(r.className||r.student?.className||'—')}</td><td>${esc(r.submissionStatus||'غير محدد')}</td><td>${esc(r.method||'—')}</td><td>${Number.isFinite(r.student?.grade)?fmt(r.student.grade):'—'}</td><td><b>${Number.isFinite(r.grade)?fmt(r.grade):'—'}</b></td><td>${Number.isFinite(r.student?.totalGrade)?fmt(r.student.totalGrade):'—'}</td><td>${r.status==='ready'?`<span class="${APP}-pill ${APP}-ok">جاهز للتطبيق</span>`:`<span class="${APP}-pill ${r.status==='unchanged'?`${APP}-ok`:`${APP}-bad`}">${esc(r.reason||'يحتاج مراجعة')}</span>`}</td></tr>`).join('')}
 </tbody></table></div>`;
 document.getElementById(`${APP}-import-feedback`)?.addEventListener('change',e=>{state.importFeedback=!!e.target.checked;});
 document.getElementById(`${APP}-patch`)?.addEventListener('click',patchVisibleImport);
 document.getElementById(`${APP}-save`)?.addEventListener('click',saveImport);
 document.getElementById(`${APP}-preview-xlsx`)?.addEventListener('click',exportImportPreview);
};

  const exportImportPreview = function exportImportPreview(){
 if(!globalThis.XLSX)return toast('مكتبة Excel غير متاحة.','error');
 const rows=state.importPreview?.rows||[];
 if(!rows.length)return toast('لا توجد معاينة لتصديرها.','error');
 const values=rows.map(r=>({
  'صف الملف':r.sourceRow,
  'الاسم في Excel':r.name,
  'الاسم في مدرستي':r.student?.name||'',
  'رقم الملف':r.sid,
  'رقم مدرستي':r.student?.studentId||'',
  'الفصل':r.className||r.student?.className||'',
  'حالة التسليم':r.submissionStatus||'',
  'طريقة المطابقة':r.method||'',
  'الدرجة الحالية':r.student?.grade??'',
  'الدرجة الجديدة':r.grade??'',
  'الدرجة القصوى':r.student?.totalGrade??'',
  'الحالة':r.status,
  'سبب المراجعة':r.reason
 }));
 const wb=XLSX.utils.book_new();
 XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(values),'معاينة الاستيراد');
 XLSX.writeFile(wb,`معاينة-درجات-المشاريع-${new Date().toISOString().slice(0,10)}.xlsx`);
};

    const patchVisibleImport = () => {
    const ready = state.importPreview?.rows?.filter(r => r.status === 'ready') || [];
    let count = 0;
    ready.forEach(r => {
      const sid = r.student.studentId;
      const checkbox = document.getElementById(`checkStudent-${sid}`);
      const index = checkbox?.dataset?.index ?? checkbox?.getAttribute('data-index');
      let gradeInput = index !== undefined && index !== null && index !== '' ? document.querySelector(`[name="List[${index}].Grade"]`) : null;
      let feedback = index !== undefined && index !== null && index !== '' ? document.querySelector(`[name="List[${index}].feedBack"]`) : null;
      if (!gradeInput) {
        const hidden = [...document.querySelectorAll('input[name$=".StudentId"]')].find(x => String(x.value) === String(sid));
        const m = hidden?.name?.match(/^List\[(\d+)\]/);
        if (m) {
          gradeInput = document.querySelector(`[name="List[${m[1]}].Grade"]`);
          feedback = document.querySelector(`[name="List[${m[1]}].feedBack"]`);
        }
      }
      if (gradeInput) {
        gradeInput.value = r.grade;
        gradeInput.dispatchEvent(new Event('input', { bubbles: true }));
        gradeInput.dispatchEvent(new Event('change', { bubbles: true }));
        if (feedback && state.importFeedback && r.feedback) feedback.value = r.feedback;
        count++;
      }
    });
    toast(`تم تطبيق ${count} درجة في الخانات الظاهرة.`, 'success');
  };

  const downloadJson = (name, data) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const globalProjectFormFields = () => {
    const form = [...document.forms].find(f => /\/Projects\/Projects\/GradeProject\//i.test(f.action || ''));
    const out = [];
    if (!form) return out;
    [...form.elements].forEach(el => {
      if (!el.name || /^List\[/i.test(el.name)) return;
      if (el.disabled || ['button','submit','reset','file'].includes(el.type)) return;
      if ((el.type === 'checkbox' || el.type === 'radio') && !el.checked) return;
      out.push([el.name, el.value ?? '']);
    });
    return out;
  };

  const buildProjectPost = rows => {
    const params = new URLSearchParams();
    globalProjectFormFields().forEach(([k, v]) => params.append(k, v));
    rows.forEach((row, index) => {
      const fields = { ...(row.rawFields || {}) };
      fields.StudentId = row.studentId;
      fields.TotalGrade = Number.isFinite(row.totalGrade) ? row.totalGrade : (fields.TotalGrade ?? '');
      fields.Grade = Number.isFinite(row.grade) ? row.grade : '';
      fields.feedBack = row.feedback ?? fields.feedBack ?? '';
      Object.keys(fields).forEach(key => {
        const value = fields[key];
        if (value === undefined || value === null) return;
        params.append(`List[${index}].${key}`, String(value));
      });
    });
    return params;
  };

  const postProjectRows = async rows => {
    const form = [...document.forms].find(f => /\/Projects\/Projects\/GradeProject\//i.test(f.action || ''));
    if (!form) throw new Error('لم يتم العثور على نموذج حفظ درجات النشاط.');
    const response = await fetch(form.action, {
      method: 'POST', credentials: 'include', cache: 'no-store',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: buildProjectPost(rows).toString(), redirect: 'follow'
    });
    if (!response.ok) throw new Error(`فشل الحفظ: HTTP ${response.status}`);
    return response.text();
  };

  const saveImport = async function(){
 const ready=state.importPreview?.rows?.filter(r=>r.status==='ready')||[];
 if(!ready.length)return toast('لا توجد درجات جاهزة للحفظ. راجع أسباب الرفض في المعاينة.','error');
 if(new Set(ready.map(r=>String(r.student.studentId))).size!==ready.length)return toast('هناك طلاب مكررون في المطابقة، تم إيقاف الحفظ.','error');
 const noteLabel=state.importFeedback?'مع الملاحظات':'مع الحفاظ على ملاحظات مدرستي';
 if(!confirm(`سيتم حفظ ${ready.length} درجة في المشروع «${state.activityTitle}» (${noteLabel}).\nسيتم تنزيل نسخة احتياطية قبل الحفظ، ثم التحقق من الدرجات من مدرستي.\n\nمتابعة؟`))return;
 const backup=ready.map(r=>({studentId:r.student.studentId,name:r.student.name,oldGrade:r.student.grade,oldFeedback:r.student.feedback,newGrade:r.grade,newFeedback:state.importFeedback?r.feedback:r.student.feedback}));
 downloadJson(`project-grade-backup-${new Date().toISOString().replace(/[:.]/g,'-')}.json`,{activity:state.activityTitle,at:new Date().toISOString(),notesImported:state.importFeedback,rows:backup});
 setBusy(true,'جاري الحفظ والتحقق من أول دفعة…');
 let posted=0;
 try{
  const changes=ready.map(r=>({...r.student,grade:r.grade,feedback:state.importFeedback?(r.feedback||r.student.feedback||''):(r.student.feedback||''),rawFields:{...r.student.rawFields,Grade:String(r.grade),feedBack:state.importFeedback?(r.feedback||r.student.feedback||''):(r.student.feedback||'')}}));
  for(let i=0;i<changes.length;i+=10){
   const batch=changes.slice(i,i+10);
   await postProjectRows(batch);
   posted+=batch.length;
   // تحقّق من أول دفعة قبل إرسال بقية الملف لتقليل أثر اختلاف نموذج الحفظ بين الواجبات والمشاريع.
   if(i===0){
    const firstFetch=await fetchAllStudents();
    const firstMap=new Map(firstFetch.map(r=>[String(r.studentId),r]));
    const miss=batch.filter(r=>!Number.isFinite(firstMap.get(String(r.studentId))?.grade)||Math.abs(firstMap.get(String(r.studentId)).grade-r.grade)>1e-4);
    state.students=firstFetch;
    if(miss.length)throw new Error(`أرسلت أول ${batch.length} سجلات، لكن مدرستي لم يؤكد ${miss.length} درجة. أوقفت بقية الدفعات تلقائيًا. راجع نتائج المشروع ولا تكرر الحفظ قبل التأكد.`);
   }
   const status=document.getElementById(`${APP}-status`);
   if(status)status.textContent=`أُرسل ${posted} من ${changes.length} درجة…`;
  }
  const after=await fetchAllStudents(),map=new Map(after.map(r=>[String(r.studentId),r]));
  const mismatch=ready.filter(r=>!Number.isFinite(map.get(String(r.student.studentId))?.grade)||Math.abs(map.get(String(r.student.studentId)).grade-r.grade)>1e-4);
  state.students=after;
  if(mismatch.length){
   renderGradeBody();
   toast(`أُرسلت ${posted} درجة، لكن ${mismatch.length} لم تتأكد بعد قراءة مدرستي. لم يُعلن نجاح الحفظ.`, 'error');
  }else{
   state.importPreview=null;
   renderGradeBody();
   toast(`تم حفظ والتحقق من ${ready.length} درجة في مدرستي بنجاح.`, 'success');
  }
 }catch(e){
  renderGradeBody();
  toast(`توقف الحفظ بعد إرسال ${posted} درجة: ${String(e?.message||e)}`,'error');
 }finally{setBusy(false);}
};

    const cleanFile = name => clean(name).replace(/[\\/:*?"<>|]/g,'-').slice(0,90) || 'تقرير';
  const printHtml = (title,inner) => {
    const w=window.open('','_blank','width=1100,height=800');
    if(!w)return toast('يرجى السماح بنوافذ الطباعة المنبثقة.','error');
    w.document.open();
    w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
      body{font-family:Tahoma,Arial,sans-serif;color:#172033;padding:24px}h1{font-size:20px;margin:0 0 5px}.sub{color:#64748b;font-size:12px;margin-bottom:18px}h2{font-size:15px;margin:22px 0 9px}
      .metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.metric{border:1px solid #ddd;border-radius:8px;padding:9px}.metric b{display:block;font-size:18px}.metric small{color:#64748b}
      table{border-collapse:collapse;width:100%;font-size:10px;table-layout:auto}th,td{border:1px solid #d8e0e7;padding:6px;text-align:right}th{background:#f1f5f9}tr{break-inside:avoid}thead{display:table-header-group}p{font-size:11px;line-height:1.8}
      @page{size:A4 landscape;margin:12mm}@media print{body{padding:0}}
      </style></head><body>${inner}<script>setTimeout(()=>window.print(),350)<\/script></body></html>`);
    w.document.close();
  };
  const gradeMetricsPrint = s => `<div class="metrics">${[['الطلاب',s.total],['سلّم',s.submitted],['لم يسلّم',s.notSubmitted],['نسبة التسليم',fmt(s.submissionRate)+'%'],['مرصود',s.graded],['متوسط الأداء',s.avg===null?'—':fmt(s.avg)+'%'],['أعلى أداء',s.high===null?'—':fmt(s.high)+'%'],['أقل أداء',s.low===null?'—':fmt(s.low)+'%']].map(([k,v])=>`<div class="metric"><b>${esc(v)}</b><small>${esc(k)}</small></div>`).join('')}</div>`;
  const gradeTablePrint = rows => `<table><thead><tr><th>#</th><th>الطالب</th><th>الفصل</th><th>التسليم</th><th>الرصد</th><th>الدرجة</th><th>النسبة</th><th>التقدير</th><th>الملاحظة</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.name)}</td><td>${esc(r.className||'—')}</td><td>${r.hasAnswer?'سلّم':'لم يسلّم'}</td><td>${Number.isFinite(r.grade)?'مرصود':'غير مرصود'}</td><td>${Number.isFinite(r.grade)?fmt(r.grade):'—'} / ${Number.isFinite(r.totalGrade)?fmt(r.totalGrade):'—'}</td><td>${gradePercent(r)===null?'—':fmt(gradePercent(r))+'%'}</td><td>${esc(bandLabel(band(r)))}</td><td>${esc(r.feedback||'')}</td></tr>`).join('')}</tbody></table>`;
  const printReport = () => {
    const rows=filteredRows(),s=detailedStats(rows);
    const title=state.activityTitle||'تقرير نشاط / مشروع';
    const timing=verifiedProjectEnd(document);
    const stage=timing==='ended'?'تقرير نهائي بعد انتهاء استقبال الحلول':timing==='receiving'?'تقرير متابعة أولي — استقبال الحلول لم ينتهِ بعد':'تقرير متابعة غير نهائي — تعذر التحقق من وقت انتهاء النشاط';
    const classes=s.byClass.map(c=>`<tr><td>${esc(c.name)}</td><td>${c.total}</td><td>${c.submitted}</td><td>${c.graded}</td><td>${c.avg===null?'—':fmt(c.avg)+'%'}</td></tr>`).join('');
    const levels=levelKeys.map(k=>`<tr><td>${esc(bandLabel(k))}</td><td>${s.levels[k]}</td><td>${fmt(pct(s.levels[k],s.total))}%</td></tr>`).join('');
    printHtml(`تقرير ${title}`,`<h1>تقرير النشاط / المشروع</h1><p><b>${esc(stage)}</b></p><div class="sub">${esc(title)} · ${esc(filterContext())} · ${new Date().toLocaleString('ar-SA-u-nu-latn')}</div>${gradeMetricsPrint(s)}<h2>توزيع التقديرات</h2><table><thead><tr><th>التقدير</th><th>العدد</th><th>النسبة</th></tr></thead><tbody>${levels}</tbody></table><h2>ملخص الفصول</h2><table><thead><tr><th>الفصل</th><th>الطلاب</th><th>سلّم</th><th>مرصود</th><th>المتوسط</th></tr></thead><tbody>${classes}</tbody></table><h2>تفاصيل الطلاب</h2>${gradeTablePrint(rows)}<p>تستند النتائج إلى بيانات الطلاب المتاحة في صفحة رصد مدرستي. لا تُحسب الدرجة الناقصة صفرًا. التقرير يعكس البحث والتصفية عند الطباعة.</p>`);
  };

  const exportExcel = () => {
    if (!globalThis.XLSX) return toast('مكتبة Excel غير متاحة.', 'error');
    const rows = filteredRows();
    const s = detailedStats(rows);
    const wb = XLSX.utils.book_new();
    const summaryRows = [['النشاط', state.activityTitle], ['السياق', filterContext()], ['الطلاب', s.total], ['سلّم', s.submitted], ['لم يسلّم', s.notSubmitted], ['نسبة التسليم', `${s.submissionRate}%`], ['مرصود', s.graded], ['نسبة الرصد', `${s.gradingRate}%`], ['متوسط الأداء', s.avg == null ? '' : s.avg]];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), 'Summary');
    const studentRows = rows.map((r, i) => ({ '#': i + 1, 'الطالب': r.name, 'رقم الطالب': r.studentId, 'الفصل': r.className, 'التسليم': r.hasAnswer ? 'سلّم' : 'لم يسلّم', 'الدرجة': r.grade ?? '', 'من': r.totalGrade ?? '', 'النسبة': Number.isFinite(r.grade) && Number.isFinite(r.totalGrade) && r.totalGrade > 0 ? pct(r.grade, r.totalGrade) : '', 'التقدير': bandLabel(band(r)), 'الملاحظة': r.feedback || '' }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(studentRows), 'Students');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['التقدير','العدد','النسبة'], ...levelKeys.map(k=>[bandLabel(k),s.levels[k],pct(s.levels[k],s.total)])]),'Levels');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(s.byClass.map(c=>({'الفصل':c.name,'الطلاب':c.total,'سلّم':c.submitted,'مرصود':c.graded,'المتوسط':c.avg??''}))), 'Classes');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['سياق البحث والفلاتر',filterContext()],['الطلاب المعروضون',rows.length],['وقت التصدير',new Date().toISOString()],['صلاحية التقرير النهائي',verifiedProjectEnd(document)==='ended'?'مكتمل':'غير نهائي / غير متحقق']]),'Filters');
    XLSX.writeFile(wb, `تقرير-${state.activityTitle.replace(/[\\/:*?"<>|]/g, '-')}.xlsx`);
  };

  const exportCsv = () => {
    const rows = filteredRows();
    const cells = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [['#','الطالب','رقم الطالب','الفصل','التسليم','الدرجة','من','النسبة','التقدير','الملاحظة'].map(cells).join(',')];
    rows.forEach((r, i) => lines.push([i + 1, r.name, r.studentId, r.className, r.hasAnswer ? 'سلّم' : 'لم يسلّم', r.grade ?? '', r.totalGrade ?? '', Number.isFinite(r.grade) && Number.isFinite(r.totalGrade) && r.totalGrade > 0 ? pct(r.grade, r.totalGrade) : '', bandLabel(band(r)), r.feedback || ''].map(cells).join(',')));
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `تقرير-${state.activityTitle.replace(/[\\/:*?"<>|]/g, '-')}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const renderGrade = () => {
    insertPanel('مدير الأنشطة والمشاريع الذكي', `تحليل الطلاب والتقارير والرسوم البيانية — ${VERSION}`,
      `<button id="${APP}-refresh" class="${APP}-btn">تحديث التحليل</button><button id="${APP}-import-btn" class="${APP}-btn alt">استيراد درجات</button><button id="${APP}-print" class="${APP}-btn gray">طباعة التقرير</button><button id="${APP}-xlsx" class="${APP}-btn gray">Excel</button><button id="${APP}-csv" class="${APP}-btn gray">CSV</button><button id="${APP}-reset" class="${APP}-btn gray">إعادة التصفية</button>`);
    document.getElementById(`${APP}-refresh`)?.addEventListener('click', refreshGrade);
    document.getElementById(`${APP}-import-btn`)?.addEventListener('click', openImport);
    document.getElementById(`${APP}-print`)?.addEventListener('click', printReport);
    document.getElementById(`${APP}-xlsx`)?.addEventListener('click', exportExcel);
    document.getElementById(`${APP}-csv`)?.addEventListener('click', exportCsv);
    document.getElementById(`${APP}-reset`)?.addEventListener('click', resetFilters);
    refreshGrade();
  };


  const samePageUrl = raw => {
    if (!raw) return '';
    try { const u=new URL(raw,location.href); return u.origin===location.origin && /^https?:$/.test(u.protocol) ? u.href : ''; }
    catch{return '';}
  };
  const safeLink = (url,label) => url && samePageUrl(url) ? `<a class="${APP}-btn alt" style="display:inline-block;text-decoration:none" href="${esc(samePageUrl(url))}">${esc(label)}</a>` : '—';
  const projectCardsFromDoc = (doc=document) => {
    const results=[],seen=new Set();
    [...doc.querySelectorAll('a[href*="/Projects/Projects/ViewProject/"]')].forEach(link=>{
      const href=samePageUrl(link.href);if(!href)return;
      const m=new URL(href).pathname.match(/\/ViewProject\/([A-F0-9]{32})/i);
      if(!m||seen.has(m[1]))return;
      seen.add(m[1]);let root=link;
      for(let i=0;i<11 && root;i++,root=root.parentElement){if(root.querySelectorAll?.('a[href*="/ViewProject/"]').length===1 && root.querySelector?.('h4'))break;}
      const title=clean(root?.querySelector?.('h4')?.textContent||link.closest('div')?.parentElement?.querySelector('h4')?.textContent||`نشاط ${results.length+1}`);
      const pub=root?.querySelector?.('a.analytic-activity-grading,a[href*="/Projects/Projects/PublishedProjects"]');
      const pubHref=samePageUrl(pub?.href)||samePageUrl(`/Projects/Projects/PublishedProjects?ProjectId=${m[1]}`);
      const text=clean(root?.innerText||'');
      const allLinks=[...root?.querySelectorAll?.('a[href]')||[]];
      results.push({projectId:m[1],title,viewUrl:href,publishedUrl:pubHref,description:text.slice(0,320),source:clean(root?.querySelector?.('h5,h6')?.textContent||''),status:/منتهي/.test(text)?'منتهي':/جار|حالي|نشط/.test(text)?'حالي':'غير محدد',grade:null});
    });
    return results;
  };
  const pageLinks = (doc,routePart) => [...doc.querySelectorAll('.pagination a[href],a.page-link[href], [class*="pagination"] a[href]')].map(a=>samePageUrl(a.href)).filter(url=>{if(!url)return false;try{return new URL(url).pathname.toLowerCase().includes(routePart.toLowerCase());}catch{return false;}});
  const getDocument = async url => {
    const safe=samePageUrl(url);if(!safe)throw new Error('رابط غير آمن أو خارج منصة مدرستي');
    const ctrl=new AbortController(), timer=setTimeout(()=>ctrl.abort(),18000);
    try {const r=await fetch(safe,{credentials:'include',cache:'no-store',signal:ctrl.signal});if(!r.ok)throw new Error(`HTTP ${r.status}`);const text=await r.text();return new DOMParser().parseFromString(text,'text/html');}
    finally{clearTimeout(timer);}
  };
  const indexFiltered = () => state.indexItems.filter(x=>![x.title,x.description,x.projectId,x.status,x.source].every(s=>!norm(s).includes(norm(state.indexQuery))));
  const indexSummary = rows => ({total:rows.length,current:rows.filter(x=>x.status==='حالي').length,ended:rows.filter(x=>x.status==='منتهي').length,unspecified:rows.filter(x=>x.status==='غير محدد').length,published:rows.filter(x=>!!x.publishedUrl).length});

  const indexView = () => {
    const rows=indexFiltered(),s=indexSummary(rows),deep=deepSummaryOf(rows),ds=deep.stats;
    const host=document.getElementById(`${APP}-index-results`);if(!host)return;
    host.innerHTML=`<div class="${APP}-metrics">${[
      [s.total,'الأنشطة والمشاريع'],[s.current,'الحالية في العرض'],[s.ended,'المنتهية في العرض'],[state.indexPages,'صفحات مفهرسة'],[state.deepScanned?deep.published:'—','منشورات محللة'],[state.deepScanned?deep.scanned:'—','أنشطة مكتملة الفحص'],[state.deepScanned&&ds.avg!==null?`${fmt(ds.avg)}%`:'—','متوسط الأداء العام'],[state.deepScanned&&ds.total?`${fmt(ds.submissionRate)}%`:'—','نسبة التسليم المحققة']
    ].map(([v,k])=>metric(v,k)).join('')}</div>
    <div class="${APP}-note">${state.indexScanned?'جُمعت صفحات الفهرس المتاحة.':'هذه نتائج الصفحة الحالية فقط؛ اضغط «تحديث جميع الصفحات». '} ${state.deepScanned?`النتائج التفصيلية من ${deep.scanned} نشاطًا مكتملًا، مع ${deep.receiving} نشر قيد الاستقبال و${deep.unknown} حالة لا يمكن التحقق منها.`:'اضغط «تحليل أداء الأنشطة المنتهية» لجلب إحصائيات التسليم والدرجات من الرصد الفعلي. '} التقارير النهائية تستبعد المنشورات الجاري استقبالها وغير المتحققة؛ العدد الظاهر لا يعني بالضرورة شمول كل المشاريع.</div>
    <div class="${APP}-tablewrap"><table class="${APP}-table"><thead><tr><th>#</th><th>النشاط / المشروع</th><th>المصدر</th><th>الحالة</th><th>الرصد</th><th>نسبة التسليم</th><th>المتوسط</th><th>لم يسلّم</th><th>الروابط</th></tr></thead><tbody>${rows.length?rows.map((x,i)=>{
      const d=state.deepByProject.get(x.projectId),r=d?.rows||[],sum=d&&d.status==='ready'&&r.length?summary(r):null;
      const label=!d?'لم يفحص':d.status==='ready'?'مكتمل':d.status==='partial'?'جزئي':d.status==='error'?'تعذر':'غير متحقق';
      return `<tr><td>${i+1}</td><td><b>${esc(x.title)}</b></td><td>${esc(x.source||'—')}</td><td>${esc(x.status)}</td><td>${d?`${d.links} · ${esc(label)}`:'—'}</td><td>${sum?fmt(sum.submissionRate)+'%':'—'}</td><td>${sum&&sum.avg!==null?fmt(sum.avg)+'%':'—'}</td><td>${sum?sum.notSubmitted:'—'}</td><td>${safeLink(x.viewUrl,'استعراض')} ${safeLink(x.publishedUrl,'المرسلة / الرصد')}</td></tr>`;
    }).join(''):`<tr><td colspan="9" class="${APP}-rowempty">لا توجد نتائج مطابقة.</td></tr>`}</tbody></table></div>
    ${state.deepScanned&&ds.total?`<div class="${APP}-subhead">التحليل البياني للأنشطة المكتملة التي شملها الفلتر</div>${gradeAnalyticsHtml(deep.rows,ds)}`:''}`;
    const count=document.getElementById(`${APP}-index-count`);if(count)count.textContent=`عرض ${rows.length} من ${state.indexItems.length}`;
  };
  const scanAllIndexPages = async () => {
    if(state.indexBusy)return;
    state.indexBusy=true;setBusy(true,'جاري فهرسة صفحات الأنشطة…');
    try {
      const queue=[location.href],visited=new Set(),items=new Map();let problems=0;
      for(let j=0;j<queue.length&&j<30;j++){
        const url=samePageUrl(queue[j]);if(!url||visited.has(url))continue;
        visited.add(url);
        let doc;
        try{doc=j===0?document:await getDocument(url);}catch{problems++;continue;}
        projectCardsFromDoc(doc).forEach(p=>items.set(p.projectId,p));
        pageLinks(doc,'/Projects/Projects/Index').forEach(link=>{if(!visited.has(link)&&!queue.includes(link)&&queue.length<30)queue.push(link);});
      }
      state.indexItems=[...items.values()].sort((a,b)=>compareNames(a.title,b.title));
      state.indexPages=visited.size;state.indexScanned=true;indexView();
      toast(`تم فهرسة ${state.indexItems.length} نشاطًا من ${visited.size} صفحة${problems?`، تعذر فتح ${problems} صفحة`:''}.`,problems?'info':'success');
    }catch(e){toast(String(e.message||e),'error');}
    finally{state.indexBusy=false;setBusy(false);}
  };
  const publishedCardsFromDoc = (doc=document,label='العرض الحالي') => {
    const result=[];
    [...doc.querySelectorAll('a[href*="/Projects/Projects/GradeProject/"]')].forEach(a=>{
      const href=samePageUrl(a.href);if(!href)return;
      let root=a;
      for(let i=0;i<10&&root;i++,root=root.parentElement){if(root.querySelectorAll?.('a[href*="/GradeProject/"]').length===1&&root.querySelector?.('h4,h5'))break;}
      result.push({href,title:clean(root?.querySelector?.('h4,h5')?.textContent||'')||clean(a.textContent)||'رصد نشاط',detail:clean(root?.innerText||'').slice(0,300),status:label});
    });return result;
  };
  const publishedFiltered = () => state.publishedItems.filter(x=>[x.title,x.detail,x.status].some(v=>norm(v).includes(norm(state.publishedQuery))));

  const publishedStats = items => {
    const rows=[];let checked=0,receiving=0,unknown=0;
    items.forEach(x=>{
      const r=state.deepByUrl.get(x.href);
      if(!r)return;
      if(r.status==='ready'){checked++;rows.push(...r.rows);}
      else if(r.status==='receiving')receiving++;
      else unknown++;
    });
    return {rows,checked,receiving,unknown,stats:detailedStats(rows)};
  };
  const publishedView = () => {
    const rows=publishedFiltered(),host=document.getElementById(`${APP}-published-results`);if(!host)return;
    const statuses=[...new Set(rows.map(x=>x.status))],a=publishedStats(rows),stat=a.stats;
    host.innerHTML=`<div class="${APP}-metrics">${[
      [rows.length,'روابط الرصد'],[rows.filter(x=>/الحالية/.test(x.status)).length,'الحالية'],[rows.filter(x=>/المنتهية/.test(x.status)).length,'المنتهية'],[state.publishedDeepScanned?a.checked:'—','منشورات حُللت'],[state.publishedDeepScanned?stat.total:'—','سجلات الطلاب'],[state.publishedDeepScanned&&stat.total?`${fmt(stat.submissionRate)}%`:'—','نسبة التسليم'],[state.publishedDeepScanned&&stat.avg!==null?`${fmt(stat.avg)}%`:'—','متوسط الأداء'],[state.publishedDeepScanned?stat.graded:'—','درجات مرصودة']
    ].map(([v,k])=>metric(v,k)).join('')}</div><div class="${APP}-note">${state.publishedDeepScanned?`تحليل ${a.checked} نشر منتهٍ، ${a.receiving} نشر قيد الاستقبال، ${a.unknown} تعذر التحقق منه.`:'اضغط «فحص الحالية والمنتهية» لاكتشاف روابط الرصد، ثم «تحليل أداء المنتهية» لاستخراج بيانات الطلاب الموثقة.'} النتائج النهائية لا تشمل النشر الجاري أو غير المتحقق، ولا تعد القيم الناقصة أصفارًا.</div>
    <div class="${APP}-tablewrap"><table class="${APP}-table"><thead><tr><th>#</th><th>النشاط / المنشور</th><th>حالة المنشور</th><th>الرصد</th><th>التسليم</th><th>المتوسط</th><th>الطلاب</th></tr></thead><tbody>${rows.length?rows.map((x,i)=>{
      const d=state.deepByUrl.get(x.href),ss=d?.status==='ready'&&d.rows?.length?summary(d.rows):null;
      return `<tr><td>${i+1}</td><td><b>${esc(x.title)}</b><div style="font-size:10px;color:#64748b">${esc(x.detail.slice(0,120))}</div></td><td>${esc(x.status)}</td><td>${safeLink(x.href,'فتح التحليل والرصد')}</td><td>${ss?fmt(ss.submissionRate)+'%':'—'}</td><td>${ss&&ss.avg!==null?fmt(ss.avg)+'%':'—'}</td><td>${ss?ss.total:'—'}</td></tr>`;
    }).join(''):`<tr><td colspan="7" class="${APP}-rowempty">لا توجد نتائج مطابقة.</td></tr>`}</tbody></table></div>${state.publishedDeepScanned&&stat.total?`<div class="${APP}-subhead">توزيع المستويات بحسب المنشورات المكتملة المفلترة</div>${gradeAnalyticsHtml(a.rows,stat)}`:''}`;
    const count=document.getElementById(`${APP}-published-count`);if(count)count.textContent=`عرض ${rows.length} من ${state.publishedItems.length}`;
  };
  const scanPublished = async () => {
    setBusy(true,'جاري فحص المنشورات الحالية والمنتهية…');
    try{
      const cur=samePageUrl(document.getElementById('currntProjectLink')?.href);
      const ended=samePageUrl(document.getElementById('endedProjectLink')?.href);
      const queue=[{url:location.href,label:'العرض الحالي'},...(cur?[{url:cur,label:'الحالية'}]:[]),...(ended?[{url:ended,label:'المنتهية'}]:[])];
      const seen=new Set(),mapped=new Map();let failures=0;
      for(let i=0;i<queue.length&&i<32;i++){
        const {url,label}=queue[i];const safe=samePageUrl(url);if(!safe||seen.has(safe))continue;seen.add(safe);
        let doc;try{doc=i===0?document:await getDocument(safe);}catch{failures++;continue;}
        publishedCardsFromDoc(doc,label).forEach(x=>{if(!mapped.has(x.href))mapped.set(x.href,x);else if(label!=='العرض الحالي')mapped.get(x.href).status=label;});
        pageLinks(doc,'/Projects/Projects/PublishedProjects').forEach(link=>{if(!seen.has(link)&&!queue.some(x=>x.url===link)&&queue.length<32)queue.push({url:link,label});});
      }
      state.publishedItems=[...mapped.values()];state.publishedScanned=true;publishedView();
      toast(`تم اكتشاف ${state.publishedItems.length} رابط رصد${failures?`، تعذر فتح ${failures} صفحة`:''}.`,'success');
    }catch(e){toast(String(e.message||e),'error');}
    finally{setBusy(false);}
  };

  // الفحص التحليلي الكامل اختياري، وبطلب المعلم، ويعتمد بيانات الرصد الفعلية.
  const fieldValue = (doc,id) => clean(doc.getElementById(id)?.value || doc.querySelector(`[name="${id}"]`)?.value || '');
  const paramsFromGradeDoc = doc => {
    const inline=[...doc.scripts].filter(x=>!x.src).map(x=>x.textContent||'').join('\n');
    const at=inline.indexOf('loadStudents');
    const source=at>=0?inline.slice(at,at+18000):inline;
    const names=['IsPublished','ProjectId','LectureClassId','PublishedProjectId','IsGradebook','SchoolId','SubjectId','TeacherId','SemesterId','IsCreatedByTeacher','IsCurrentTeacher','PublishLectureId','SolvingType','ProjectStarts','IsRelatedToSubject'];
    const o={};
    for(const key of names){
      const m=source.match(new RegExp(`\\b${key}\\s*:\\s*(?:'([^']*)'|"([^"]*)"|(true|false|[\\d.]+))`,'i'));
      o[key]=m ? (m[1]??m[2]??m[3]??'') : '';
    }
    o.IsPublished=o.IsPublished||fieldValue(doc,'Published')||'true';
    o.ProjectId=o.ProjectId||fieldValue(doc,'ProjectId');
    o.PublishedProjectId=o.PublishedProjectId||fieldValue(doc,'publishedProjectIdEnc')||fieldValue(doc,'PublishedProjectId');
    o.SchoolId=o.SchoolId||fieldValue(doc,'SchoolId');
    o.IsRelatedToSubject=o.IsRelatedToSubject||'true';
    return o;
  };
  const verifiedProjectEnd = doc => {
    const server=fieldValue(doc,'ServerDateTime'),end=fieldValue(doc,'PublishedEndTime');
    const parse=s=>{
      if(!s)return null;
      const st=String(s).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
      const n=Date.parse(st);
      if(Number.isFinite(n))return n;
      const m=st.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
      return m?new Date(+m[3],+m[2]-1,+m[1],+m[4],+m[5],+(m[6]||0)).getTime():null;
    };
    const a=parse(server),b=parse(end);
    if(!Number.isFinite(a)||!Number.isFinite(b))return 'unverified';
    return a>=b?'ended':'receiving';
  };
  const findGradeLinks = doc => [...new Set([...doc.querySelectorAll('a[href*="/Projects/Projects/GradeProject/"]')].map(a=>samePageUrl(a.href)).filter(Boolean))];
  const fetchGradeAnalysis = async (url, budget) => {
    if(state.deepByUrl.has(url))return state.deepByUrl.get(url);
    if(budget.remaining<=0)return {status:'limit',rows:[]};
    budget.remaining--;
    const doc=await getDocument(url);
    const timing=verifiedProjectEnd(doc);
    if(timing!=='ended'){
      const result={status:timing,rows:[]};state.deepByUrl.set(url,result);return result;
    }
    const base=paramsFromGradeDoc(doc);
    if(!base.ProjectId||!base.PublishedProjectId){
      const result={status:'unavailable',rows:[]};state.deepByUrl.set(url,result);return result;
    }
    const byId=new Map();let incomplete=false;
    for(let page=1;page<=50;page++){
      if(budget.remaining<=0){incomplete=true;break;}
      budget.remaining--;
      const html=await postForm('/Projects/Projects/GetGradeStudentsList',{...base,StudentIds:'',Status:'All',SortBy:'name_asc',PageNumber:page});
      const rows=parseStudentsHtml(html);
      if(!rows.length)break;
      let added=0;
      rows.forEach(x=>{if(!byId.has(x.studentId))added++;byId.set(x.studentId,x);});
      if(!added)break;
      if(rows.length<20)break;
    }
    const result={status:incomplete?'partial':'ready',rows:[...byId.values()],paramsAvailable:true};
    state.deepByUrl.set(url,result);
    return result;
  };
  const deepSummaryOf = items => {
    const rows=[],published=new Set();let receiving=0,unknown=0,scanned=0;
    for(const item of items){
      const detail=state.deepByProject.get(item.projectId);
      if(!detail)continue;
      if(detail.links>0)published.add(item.projectId);
      receiving+=detail.receiving||0;unknown+=detail.unknown||0;
      if(detail.status==='ready')scanned++;
      (detail.rows||[]).forEach(x=>rows.push(x));
    }
    return {rows,stats:detailedStats(rows),published:published.size,receiving,unknown,scanned};
  };
  const deepAnalyzeIndex = async () => {
    if(state.deepBusy)return;
    if(!state.indexItems.length)return toast('لا توجد مشاريع مفهرسة للتحليل.','error');
    state.deepBusy=true;setBusy(true,'جاري تحليل رصد الأنشطة المنتهية…');
    const budget={remaining:170},items=state.indexItems.slice(0,50);
    let errors=0;
    try{
      for(let i=0;i<items.length;i++){
        const item=items[i],existing=state.deepByProject.get(item.projectId);
        if(existing?.status==='ready')continue;
        if(budget.remaining<=0){errors+=items.length-i;break;}
        const status=document.getElementById(`${APP}-status`);
        if(status)status.textContent=`تحليل النشاط ${i+1} من ${items.length} · ${item.title.slice(0,45)}`;
        try{
          budget.remaining--;
          const doc=await getDocument(item.publishedUrl);
          const links=findGradeLinks(doc).slice(0,15);
          const rows=[],keyed=new Set();let receiving=0,unknown=0;
          for(const link of links){
            if(budget.remaining<=0){unknown++;break;}
            const result=await fetchGradeAnalysis(link,budget);
            if(result.status==='receiving')receiving++;
            else if(result.status!=='ready')unknown++;
            else result.rows.forEach(r=>{const key=link+'|'+r.studentId;if(!keyed.has(key)){keyed.add(key);rows.push(r);}});
          }
          state.deepByProject.set(item.projectId,{status:unknown?'partial':'ready',rows,receiving,unknown,links:links.length});
        }catch(e){errors++;state.deepByProject.set(item.projectId,{status:'error',rows:[],receiving:0,unknown:1,links:0});}
        if((i+1)%3===0)indexView();
      }
      state.deepScanned=true;indexView();
      toast(`اكتمل فحص ${items.length} نشاطًا. ${errors?`تعذر تحليل ${errors}؛ ستبقى نتائجها غير متاحة.`:'تظهر نتائج الطلاب للمنشورات المنتهية والمتحقق منها فقط.'}`,errors?'info':'success');
    }catch(e){toast(String(e?.message||e),'error');}
    finally{state.deepBusy=false;setBusy(false);indexView();}
  };


  const deepAnalyzePublished = async () => {
    if(state.deepBusy)return;
    if(!state.publishedItems.length)return toast('افحص روابط المنشورات أولًا.','error');
    state.deepBusy=true;setBusy(true,'جاري جلب درجات المنشورات المنتهية…');
    const items=state.publishedItems.slice(0,55),budget={remaining:150};let failures=0;
    try {
      for(let i=0;i<items.length;i++){
        if(budget.remaining<=0){failures+=items.length-i;break;}
        const item=items[i],status=document.getElementById(`${APP}-status`);
        if(status)status.textContent=`فحص نشر ${i+1} من ${items.length}`;
        try { await fetchGradeAnalysis(item.href,budget); }
        catch {failures++;state.deepByUrl.set(item.href,{status:'error',rows:[]});}
        if((i+1)%3===0)publishedView();
      }
      state.publishedDeepScanned=true;publishedView();
      toast(`فُحص ${items.length} رابطًا؛ ستظهر بيانات الأداء فقط للمنشورات المنتهية والمتاحة${failures?`، مع ${failures} حالة تعذر فحصها`:''}.`,failures?'info':'success');
    }catch(e){toast(String(e?.message||e),'error');}
    finally{state.deepBusy=false;setBusy(false);publishedView();}
  };

  const genericExport = (kind,rows,columns,name,summaryPairs=[]) => {
    if(kind==='print'){
      const header=`<h1>${esc(name)}</h1><div class="sub">${new Date().toLocaleString('ar-SA-u-nu-latn')} · ${rows.length} سجل</div><div class="metrics">${summaryPairs.map(([k,v])=>`<div class="metric"><b>${esc(v)}</b><small>${esc(k)}</small></div>`).join('')}</div>`;
      const table=`<h2>تفاصيل السجل</h2><table><thead><tr>${columns.map(c=>`<th>${esc(c[0])}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${columns.map(c=>`<td>${esc(r[c[1]]??'—')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
      return printHtml(name,header+table);
    }
    if(kind==='excel'){
      if(!globalThis.XLSX)return toast('مكتبة Excel غير متاحة.','error');
      const wb=XLSX.utils.book_new(),data=rows.map(r=>Object.fromEntries(columns.map(([title,key])=>[title,r[key]??''])));
      XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(data),'Items');
      XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(summaryPairs),'Summary');
      XLSX.writeFile(wb,`${cleanFile(name)}.xlsx`);return;
    }
    const csv=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
    const lines=[columns.map(([header])=>csv(header)).join(','),...rows.map(r=>columns.map(([,key])=>csv(r[key])).join(','))];
    const blob=new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=`${cleanFile(name)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1800);
  };
  const renderIndex = () => {
    insertPanel('لوحة الأنشطة والمشاريع الشاملة',`سجل وتقارير إدارة الأنشطة — v${VERSION}`,
      `<button id="${APP}-index-refresh" class="${APP}-btn">تحديث جميع الصفحات</button><button id="${APP}-index-deep" class="${APP}-btn">تحليل أداء الأنشطة المنتهية</button><button id="${APP}-index-print" class="${APP}-btn gray">تقرير / PDF</button><button id="${APP}-index-xlsx" class="${APP}-btn gray">Excel</button><button id="${APP}-index-csv" class="${APP}-btn gray">CSV</button><button id="${APP}-collapse" class="${APP}-btn gray">طي اللوحة</button>`);
    const body=document.getElementById(`${APP}-body`);
    body.innerHTML=`<div class="${APP}-searchline"><input type="search" id="${APP}-index-search" placeholder="البحث في الأنشطة والمشاريع بالاسم أو الوصف أو الرقم…"><span class="${APP}-count" id="${APP}-index-count"></span><button id="${APP}-index-reset" class="${APP}-btn gray">مسح البحث</button></div><div id="${APP}-index-results"></div>`;
    state.indexItems=projectCardsFromDoc();indexView();
    document.getElementById(`${APP}-index-refresh`)?.addEventListener('click',scanAllIndexPages);
    document.getElementById(`${APP}-index-deep`)?.addEventListener('click',deepAnalyzeIndex);
    document.getElementById(`${APP}-index-search`)?.addEventListener('input',e=>{state.indexQuery=e.target.value;indexView();});
    document.getElementById(`${APP}-index-reset`)?.addEventListener('click',()=>{state.indexQuery='';document.getElementById(`${APP}-index-search`).value='';indexView();});
    const columns=[['النشاط / المشروع','title'],['المصدر','source'],['الحالة','status'],['نسبة التسليم','submissionRate'],['متوسط الأداء','averagePercent'],['لم يسلّم','notSubmitted'],['حالة التحليل','analysisStatus'],['رابط الاستعراض','viewUrl'],['رابط المنشورات','publishedUrl']];
    ['print','xlsx','csv'].forEach(k=>document.getElementById(`${APP}-index-${k}`)?.addEventListener('click',()=>{const items=indexFiltered(),sum=indexSummary(items),deep=deepSummaryOf(items);const rows=items.map(x=>{const d=state.deepByProject.get(x.projectId),ss=d?.status==='ready'&&d.rows?.length?summary(d.rows):null;return {...x,submissionRate:ss?fmt(ss.submissionRate)+'%':'غير متاح',averagePercent:ss&&ss.avg!==null?fmt(ss.avg)+'%':'غير متاح',notSubmitted:ss?.notSubmitted??'غير متاح',analysisStatus:d?.status||'لم يفحص'};});genericExport(k==='xlsx'?'excel':k,rows,columns,'تقرير الأنشطة والمشاريع',[['إجمالي الأنشطة',sum.total],['حالية',sum.current],['منتهية',sum.ended],['حالة غير محددة',sum.unspecified],['أنشطة مكتملة الفحص',deep.scanned],['منشورات قيد الاستقبال',deep.receiving],['حالات غير متحققة',deep.unknown]]);}));
    const collapsed=localStorage.getItem('maip-collapse')==='1';
    const collapse=hide=>{body.hidden=hide;document.getElementById(`${APP}-collapse`).textContent=hide?'فتح اللوحة':'طي اللوحة';localStorage.setItem('maip-collapse',hide?'1':'0');};
    document.getElementById(`${APP}-collapse`)?.addEventListener('click',()=>collapse(!body.hidden));collapse(collapsed);
  };
  const renderPublished = () => {
    insertPanel('لوحة الأنشطة والمشاريع الشاملة',`متابعة المنشورات والرصد — v${VERSION}`,
      `<button id="${APP}-pub-refresh" class="${APP}-btn">فحص الحالية والمنتهية</button><button id="${APP}-pub-deep" class="${APP}-btn">تحليل أداء المنتهية</button><button id="${APP}-pub-print" class="${APP}-btn gray">تقرير / PDF</button><button id="${APP}-pub-xlsx" class="${APP}-btn gray">Excel</button><button id="${APP}-pub-csv" class="${APP}-btn gray">CSV</button>`);
    const body=document.getElementById(`${APP}-body`);
    body.innerHTML=`<div class="${APP}-searchline"><input id="${APP}-pub-search" type="search" placeholder="البحث في الأنشطة المنشورة والرصد…"><span class="${APP}-count" id="${APP}-published-count"></span><button class="${APP}-btn gray" id="${APP}-pub-reset">مسح البحث</button></div><div id="${APP}-published-results"></div>`;
    state.publishedItems=publishedCardsFromDoc();publishedView();
    document.getElementById(`${APP}-pub-refresh`)?.addEventListener('click',scanPublished);
    document.getElementById(`${APP}-pub-deep`)?.addEventListener('click',deepAnalyzePublished);
    document.getElementById(`${APP}-pub-search`)?.addEventListener('input',e=>{state.publishedQuery=e.target.value;publishedView();});
    document.getElementById(`${APP}-pub-reset`)?.addEventListener('click',()=>{state.publishedQuery='';document.getElementById(`${APP}-pub-search`).value='';publishedView();});
    const columns=[['النشاط / المنشور','title'],['حالة المنشور','status'],['تفاصيل','detail'],['الطلاب','students'],['نسبة التسليم','submissionRate'],['متوسط الأداء','averagePercent'],['حالة التحليل','analysisStatus'],['الرابط','href']];
    ['print','xlsx','csv'].forEach(k=>document.getElementById(`${APP}-pub-${k}`)?.addEventListener('click',()=>{const items=publishedFiltered(),stat=publishedStats(items);const rows=items.map(x=>{const d=state.deepByUrl.get(x.href),ss=d?.status==='ready'&&d.rows?.length?summary(d.rows):null;return {...x,students:ss?.total??'غير متاح',submissionRate:ss?fmt(ss.submissionRate)+'%':'غير متاح',averagePercent:ss&&ss.avg!==null?fmt(ss.avg)+'%':'غير متاح',analysisStatus:d?.status||'لم يفحص'};});genericExport(k==='xlsx'?'excel':k,rows,columns,'تقرير الأنشطة المنشورة',[['المنشورات المكتشفة',rows.length],['المكتملة الفحص',stat.checked],['قيد الاستقبال',stat.receiving],['غير متحققة',stat.unknown]]);}));
  };

  injectStyle();
  {const st=document.createElement('style');st.id=`${APP}-import-modal-styles`;st.textContent=importModalCss;document.head.appendChild(st);}
  if (isGrade) renderGrade();
  else if (isPublished) renderPublished();
  else if (isIndex) renderIndex();

  globalThis.MadrasatiProjectsIntelligence = {
    version: VERSION,
    state,
    refresh: isGrade ? refreshGrade : null,
    getStudents: () => state.students.slice(),
    getFilteredStudents: filteredRows,
    projectParams,
    parseStudentsHtml
  };
})();
/*
 * المطور: Mohammed Almalki (M0HM3D85)
 * GitHub: https://github.com/M0HM3D85/teacher-userscripts
 * X / Twitter: https://x.com/M0HM3D85
 * Snapchat: https://www.snapchat.com/add/M0HM3D85
 * © 2026 Mohammed Almalki (M0HM3D85) — جميع الحقوق محفوظة.
 */

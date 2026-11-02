// ==UserScript==
// @name         Fares+ | فاحص توافق صفحات فارس (قراءة فقط)
// @namespace    https://github.com/M0HM3D85/teacher-userscripts
// @version      0.1.0
// @description  فحص غير تعديلي لتوافق نظام فارس مع فارس+، دون قراءة أسماء أو قيم الموظفين والمسودات.
// @author       Mohammed Almalki (M0HM3D85)
// @match        https://sshr.moe.gov.sa/OA_HTML/*
// @run-at       document-idle
// @grant        none
// @noframes
// @downloadURL  https://raw.githubusercontent.com/M0HM3D85/teacher-userscripts/main/scripts/fares-plus/fares-plus-audit.user.js
// @updateURL    https://raw.githubusercontent.com/M0HM3D85/teacher-userscripts/main/scripts/fares-plus/fares-plus-audit.user.js
// ==/UserScript==

(() => {
    'use strict';
    if (window.__FARES_PLUS_READONLY_AUDIT_V1__) return;
    window.__FARES_PLUS_READONLY_AUDIT_V1__ = true;

    const PREFIX = 'm0hm3d85-fares-plus';
    const DRAFT_KEY = PREFIX + '-pd-drafts-v1';
    const TX_KEY = PREFIX + '-pd-commit-transaction-v1';
    const rootId = 'fares-plus-audit-widget';
    const fieldNames = [
        'TrainingName', 'Location', 'TrainingStartDate', 'TrainingEndDate',
        'TrainerType', 'TrainingType', 'DurationType', 'Duration'
    ];
    const requiredIds = [
        'SNAV', 'navContainer0', 'navListContainer1',
        'TrainingDetailsRN', 'TrainingDetailsRN__xc_',
        'TrainingTableRN', 'TrainingTableRN:Content',
        'addTrainingBTN', 'addTrainingBTN_uixr',
        'saveBTN', 'saveBTN_uixr',
        PREFIX + '-launcher', PREFIX + '-pd-bar', PREFIX + '-pd-manager'
    ];

    function safeStorage(kind, key) {
        try {
            return { readable: true, value: window[kind].getItem(key) };
        } catch (_) {
            return { readable: false, value: null };
        }
    }
    function jsonArrayLength(raw) {
        if (raw === null) return null;
        try {
            const value = JSON.parse(raw);
            return Array.isArray(value) ? value.length : null;
        } catch (_) {
            return null;
        }
    }
    function txSummary(raw) {
        if (!raw) return { exists: false };
        try {
            const tx = JSON.parse(raw);
            if (!tx || typeof tx !== 'object') return { exists: true, readable: false };
            const stages = [
                'starting', 'await-add-row', 'await-add-row-page',
                'await-type-options', 'await-save-result', 'paused'
            ];
            return {
                exists: true,
                readable: true,
                stage: stages.includes(tx.stage) ? tx.stage : 'other',
                mode: ['single', 'batch'].includes(tx.mode) ? tx.mode : 'other',
                itemCount: Array.isArray(tx.items) ? tx.items.length : null,
                index: Number.isInteger(tx.index) ? tx.index : null,
                rowIndex: Number.isInteger(tx.rowIndex) ? tx.rowIndex : null,
                pausedFromStage: stages.includes(tx.pausedFromStage) ? tx.pausedFromStage : null
            };
        } catch (_) {
            return { exists: true, readable: false };
        }
    }
    function visible(el) {
        if (!el) return false;
        const css = getComputedStyle(el);
        return css.display !== 'none' && css.visibility !== 'hidden' && el.getClientRects().length > 0;
    }
    function elementSummary(id) {
        const el = document.getElementById(id);
        return {
            id, exists: !!el, visible: visible(el),
            tag: el ? el.tagName.toLowerCase() : null,
            disabled: el && 'disabled' in el ? !!el.disabled : null
        };
    }
    function collect() {
        const ids = Array.from(document.querySelectorAll('[id]'), el => el.id);
        const byField = {};
        const observedIndexes = new Set();
        for (const name of fieldNames) {
            const pattern = new RegExp(':' + name + ':(\\d+)$');
            const matches = ids.map(id => id.match(pattern)).filter(Boolean);
            byField[name] = matches.length;
            if (name === 'TrainingName') {
                matches.forEach(m => observedIndexes.add(Number(m[1])));
            }
        }
        const editableIndexes = [...observedIndexes]
            .filter(index => {
                const suffix = ':TrainingName:' + index;
                const match = ids.find(id => id.endsWith(suffix) && !id.startsWith('_hdfp'));
                const el = match ? document.getElementById(match) : null;
                return !!el && !el.disabled;
            })
            .sort((a, b) => a - b);

        const d = safeStorage('localStorage', DRAFT_KEY);
        const t = safeStorage('sessionStorage', TX_KEY);
        const checks = requiredIds.map(elementSummary);
        const element = id => checks.find(x => x.id === id);
        const professional = element('TrainingDetailsRN').exists ||
            element('TrainingTableRN').exists || byField.TrainingName > 0;
        const pageType = professional ? 'professional-development'
            : element('SNAV').exists ? 'oracle-navigation' : 'other-or-login';
        const missing = [];
        if (professional) {
            if (!element('TrainingDetailsRN').exists) missing.push('training-section');
            if (!element('TrainingDetailsRN__xc_').exists &&
                !element('TrainingTableRN').exists) missing.push('training-toggle-and-table');
            if (!element('addTrainingBTN').exists &&
                !element('addTrainingBTN_uixr').exists) missing.push('native-add-button');
            if (!element('saveBTN').exists &&
                !element('saveBTN_uixr').exists) missing.push('native-save-button');
            if (element('TrainingTableRN').exists && !byField.TrainingName)
                missing.push('training-name-fields');
        }
        return {
            schema: 'fares-plus-page-audit/1',
            capturedAt: new Date().toISOString(),
            page: {
                host: location.host,
                pathname: location.pathname,
                queryKeys: [...new URLSearchParams(location.search).keys()],
                type: pageType,
                readyState: document.readyState,
                frameCount: document.querySelectorAll('iframe,frame').length
            },
            userscript: {
                launcherPresent: element(PREFIX + '-launcher').exists,
                managerPresent: element(PREFIX + '-pd-manager').exists,
                pdApiPresent: !!window.FaresPlusPD,
                installedVersion: (typeof window.FaresPlusPD?.version === 'string' &&
                    /^\d+\.\d+\.\d+$/.test(window.FaresPlusPD.version))
                    ? window.FaresPlusPD.version : null
            },
            storage: {
                draftsReadable: d.readable,
                draftsCount: jsonArrayLength(d.value),
                transactionReadable: t.readable,
                transaction: txSummary(t.value)
            },
            checks,
            activityFields: {
                countsByField: byField,
                detectedNameRowCount: observedIndexes.size,
                editableRowCount: editableIndexes.length,
                editableRowIndexes: editableIndexes
            },
            navigation: {
                listEntryCount: document.querySelectorAll('.listEntry,.listEntrySelect').length,
                navContainerCount: document.querySelectorAll('[id^="navContainer"]').length
            },
            warnings: missing,
            privacy: 'No names, form values, draft content, credentials, request payloads, or full URL are collected.'
        };
    }
    function exportReport() {
        const report = JSON.stringify(collect(), null, 2);
        const blob = new Blob([report], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'fares-plus-page-audit-' + new Date().toISOString().slice(0, 10) + '.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
    }
    function show() {
        if (!document.body) return;
        let widget = document.getElementById(rootId);
        if (!widget) {
            widget = document.createElement('aside');
            widget.id = rootId;
            widget.setAttribute('dir', 'rtl');
            widget.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:2147483647;font:13px Tahoma,Arial,sans-serif;color:#172033;background:#fff;border:1px solid #d4dce5;box-shadow:0 7px 24px #0003;border-radius:12px;padding:12px;width:min(330px,calc(100vw - 40px));';
            widget.innerHTML =
                '<strong style="display:block;margin-bottom:6px">فحص توافق فارس+ (قراءة فقط)</strong>' +
                '<div data-summary style="line-height:1.8;white-space:pre-wrap;margin-bottom:8px"></div>' +
                '<button type="button" data-export>تنزيل تقرير JSON</button> ' +
                '<button type="button" data-refresh>إعادة الفحص</button> ' +
                '<button type="button" data-close>إغلاق</button>';
            document.body.appendChild(widget);
            const buttons = widget.querySelectorAll('button');
            buttons.forEach(b => b.style.cssText =
                'padding:6px 8px;margin-top:4px;border-radius:7px;border:1px solid #bac8d5;background:#f6f8fa;color:#173f5f;cursor:pointer;font:inherit;');
            widget.querySelector('[data-export]').addEventListener('click', exportReport);
            widget.querySelector('[data-refresh]').addEventListener('click', show);
            widget.querySelector('[data-close]').addEventListener('click', () => widget.remove());
        }
        const report = collect();
        const summary = [
            'الصفحة: ' + report.page.type,
            'نسخة فارس+: ' + (report.userscript.installedVersion || 'غير ظاهرة'),
            'المسودات: ' + (report.storage.draftsCount ?? 'غير معروفة'),
            'العملية المعلقة: ' + (report.storage.transaction.stage || 'لا توجد'),
            'صفوف الإدخال القابلة للتحرير: ' + report.activityFields.editableRowCount,
            'ملاحظات التوافق: ' + (report.warnings.join(', ') || 'لا يوجد نقص ظاهر')
        ];
        widget.querySelector('[data-summary]').textContent = summary.join('\n');
        return report;
    }
    window.FaresPlusAudit = Object.freeze({ collect, show, export: exportReport });
    const start = () => {
        const trigger = document.createElement('button');
        trigger.id = 'fares-plus-audit-trigger';
        trigger.type = 'button';
        trigger.textContent = 'فحص فارس+';
        trigger.title = 'يفحص العناصر دون تعديل بيانات فارس';
        trigger.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:2147483646;background:#173f5f;color:white;border:0;border-radius:20px;padding:9px 12px;box-shadow:0 5px 16px #0003;cursor:pointer;font:12px Tahoma,Arial,sans-serif;';
        trigger.addEventListener('click', () => {
            const panel = document.getElementById(rootId);
            if (panel) panel.remove();
            else show();
        });
        if (!document.getElementById(trigger.id)) document.body.appendChild(trigger);
    };
    if (document.body) start();
    else document.addEventListener('DOMContentLoaded', start, { once: true });
})();

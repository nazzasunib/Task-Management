"use client";
/* Task Management — the original app, moved to Next.js + Supabase.
   Every screen, rule and calculation is the original code. What changed:
   - accounts are real Supabase Auth users (no passwords in the browser)
   - tasks & notes are saved to Postgres (see lib/store.js) instead of localStorage
   - attachments go to private Supabase Storage
   - PDF libraries load only when a PDF is downloaded */
import React, { useState, useEffect, useMemo, useRef, useCallback, Fragment } from "react";
import { getSupabase, isConfigured, siteOrigin } from "@/lib/supabase";
import { friendlyError } from "@/lib/errors";
import { createStore } from "@/lib/store";

const LOGO_WHITE_ICON = "/logo-icon-white.png";
const LOGO_MAIN = "/logo-main.png";
const LOGO_WHITE_HORIZ = "/logo-white.png";
const safeGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const safeSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

/* ======================= ICONS ======================= */
const ICON_PATHS = {
  home: <><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/></>,
  checkSquare: <><rect x="3" y="3" width="18" height="18" rx="4"/><path d="m8 12 3 3 5-6"/></>,
  list: <><path d="M9 6h12"/><path d="M9 12h12"/><path d="M9 18h12"/><path d="M4 6h.01"/><path d="M4 12h.01"/><path d="M4 18h.01"/></>,
  calendar: <><rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M16 2.5v4"/><path d="M8 2.5v4"/><path d="M3 10h18"/></>,
  checkCircle: <><circle cx="12" cy="12" r="9"/><path d="m8.5 12.3 2.4 2.4 4.6-5.4"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5l3.2 2.2"/></>,
  settings: <><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.8 1.8 0 0 0 .35 2l.05.05a2 2 0 1 1-2.85 2.8l-.1-.1a1.8 1.8 0 0 0-2-.35 1.8 1.8 0 0 0-1.1 1.65V21a2 2 0 1 1-4 0v-.1a1.8 1.8 0 0 0-1.15-1.6 1.8 1.8 0 0 0-2 .35l-.05.05a2 2 0 1 1-2.85-2.8l.05-.05a1.8 1.8 0 0 0 .35-2 1.8 1.8 0 0 0-1.65-1.1H3a2 2 0 1 1 0-4h.1A1.8 1.8 0 0 0 4.75 9.6a1.8 1.8 0 0 0-.35-2l-.05-.1a2 2 0 1 1 2.85-2.8l.1.1a1.8 1.8 0 0 0 2 .35H9.6A1.8 1.8 0 0 0 10.7 3.6V3.5a2 2 0 1 1 4 0v.1c.02.7.42 1.34 1.05 1.65.65.32 1.42.24 2-.2l.1-.1a2 2 0 1 1 2.85 2.85l-.1.1c-.44.55-.52 1.32-.2 2v.1c.32.63.96 1.03 1.65 1.05H21a2 2 0 1 1 0 4h-.1c-.7.02-1.34.42-1.65 1.05Z"/></>,
  plus: <><path d="M12 5v14"/><path d="M5 12h14"/></>,
  search: <><circle cx="11" cy="11" r="7.5"/><path d="m21 21-4.4-4.4"/></>,
  bell: <><path d="M6 8.5a6 6 0 0 1 12 0c0 5 2.2 6.5 2.2 6.5H3.8S6 13.5 6 8.5Z"/><path d="M9.5 19a2.5 2.5 0 0 0 5 0"/></>,
  chevronLeft: <path d="m15 18-6-6 6-6"/>,
  chevronRight: <path d="m9 18 6-6-6-6"/>,
  chevronDown: <path d="m6 9 6 6 6-6"/>,
  x: <><path d="M18 6 6 18"/><path d="m6 6 12 12"/></>,
  trash: <><path d="M4 7h16"/><path d="M9 7V4.8a1.8 1.8 0 0 1 1.8-1.8h2.4A1.8 1.8 0 0 1 15 4.8V7"/><path d="m18.5 7-.8 12.2a2 2 0 0 1-2 1.8H8.3a2 2 0 0 1-2-1.8L5.5 7"/><path d="M10 11.2v5.6"/><path d="M14 11.2v5.6"/></>,
  edit: <><path d="M12.5 19.5H21"/><path d="M16.7 3.3a2.1 2.1 0 0 1 3 3L8.5 17.5l-4.2 1 1-4.2Z"/></>,
  rotate: <><path d="M21 12a9 9 0 1 1-3.2-6.9"/><path d="M21 3v6h-6"/></>,
  menu: <><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></>,
  trend: <><path d="M3 16.5 9.5 10l4 4L21 6.5"/><path d="M15 6.5h6v6"/></>,
  layers: <><path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="m3 13 9 5 9-5"/></>,
  user: <><circle cx="12" cy="8.5" r="3.5"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/></>,
  arrowRight: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><path d="M12 7.5h.01"/></>,
  sparkle: <path d="m12 2 1.8 5.6L19.5 9l-5.7 1.6L12 16l-1.8-5.4L4.5 9l5.7-1.4L12 2Z"/>,
  target: <><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="0.9" fill="currentColor"/></>,
  download: <><path d="M12 3v12.5"/><path d="m7 11 5 5 5-5"/><path d="M4.5 21h15"/></>,
  fileText: <><path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M14 3v5h5"/><path d="M9 13h6"/><path d="M9 17h6"/></>,
  paperclip: <path d="M8 12.5 15.3 5.2a3.2 3.2 0 0 1 4.5 4.5L11 18.5a5 5 0 0 1-7-7L12.8 3"/>,
  image: <><rect x="3" y="3.5" width="18" height="17" rx="2.5"/><circle cx="8.5" cy="9" r="1.6"/><path d="m5 17 4.5-4.5a2 2 0 0 1 2.8 0L16 16"/><path d="m14.5 14.5 1-1a2 2 0 0 1 2.8 0L21 16.5"/></>,
  rangeArrow: <path d="M5 12h13m0 0-4.5-4.5M18 12l-4.5 4.5"/>,
  folder: <path d="M3.5 6.5a1.5 1.5 0 0 1 1.5-1.5h4l2 2.2h8a1.5 1.5 0 0 1 1.5 1.5v9.3a1.5 1.5 0 0 1-1.5 1.5h-14a1.5 1.5 0 0 1-1.5-1.5V6.5Z"/>,
  copy: <><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></>,
  undo: <><path d="M3 8h11a5.5 5.5 0 0 1 0 11h-5"/><path d="m7 4-4 4 4 4"/></>,
  mail: <><rect x="2.5" y="4.5" width="19" height="15" rx="2.5"/><path d="m3 7 9 6 9-6"/></>,
  lock: <><rect x="4" y="10.5" width="16" height="10.5" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></>,
  redo: <><path d="M21 8H10a5.5 5.5 0 0 0 0 11h5"/><path d="m17 4 4 4-4 4"/></>,
};
function Icon({ name, size = 18, className = '', strokeWidth = 2 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {ICON_PATHS[name] || null}
    </svg>
  );
}

/* ======================= DATE UTILS ======================= */
const pad = n => String(n).padStart(2, '0');
const toKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const todayKey = () => toKey(new Date());
const addDays = (key, n) => { const d = parseKey(key); d.setDate(d.getDate() + n); return toKey(d); };
const daysDiff = (a, b) => Math.round((parseKey(b) - parseKey(a)) / 86400000);
const fmtLong = key => parseKey(key).toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtShort = key => parseKey(key).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtMed = key => parseKey(key).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
const monthLabel = (y, m) => new Date(y, m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
const firstOfMonthKey = key => { const d = parseKey(key); return toKey(new Date(d.getFullYear(), d.getMonth(), 1)); };
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2));

/* ---- Multi-day ("long") tasks ----
   A long task carries an endDate alongside currentDate, and shows up on every
   day between the two instead of just the one. taskStart/taskEnd normalise the
   pair so the rest of the app never has to care whether a task is a range. */
const taskStart = t => t.currentDate;
const taskEnd = t => (t.isRange && t.endDate && t.endDate > t.currentDate) ? t.endDate : t.currentDate;
const isLongTask = t => taskEnd(t) > taskStart(t);
const taskSpan = t => daysDiff(taskStart(t), taskEnd(t)) + 1;
// The day a long task was finished on, if it was finished early. Finishing a range task
// stops its run there: the remaining days of the range no longer show it.
const completedOn = t => (t.status === 'completed' && t.completedAt) ? toKey(new Date(t.completedAt)) : null;
// The last day the task actually occupies — the end of the range, or the day it was completed.
const effectiveEnd = t => {
  const done = completedOn(t);
  const end = taskEnd(t);
  if (!done) return end;
  if (done < taskStart(t)) return taskStart(t);
  return done < end ? done : end;
};
// Does this task belong on the given day? Single-day tasks match one key; range tasks
// match every day from the start through their effective end.
const occursOn = (t, key) => key >= taskStart(t) && key <= effectiveEnd(t);
// Which day of the run is `key` — 1-based, for the "Day 2 of 5" badge.
const dayIndex = (t, key) => daysDiff(taskStart(t), key) + 1;
// Overlap test used by range views (dashboard, summary, filters).
const overlapsRange = (t, lo, hi) => taskStart(t) <= hi && effectiveEnd(t) >= lo;
const fmtTime = t => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const d = new Date(); d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

/* ======================= CONSTANTS ======================= */
const CATEGORIES = ['Work', 'Personal', 'Meeting', 'Design', 'Marketing', 'Development', 'Other'];
const PRIORITIES = ['Low', 'Medium', 'High'];
const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: 'home' },
  { key: 'today', label: "Today's Tasks", icon: 'checkSquare' },
  { key: 'all', label: 'All Tasks', icon: 'list' },
  { key: 'calendar', label: 'Calendar', icon: 'calendar' },
  { key: 'notes', label: 'Notes', icon: 'folder' },
  { key: 'summary', label: 'Summary', icon: 'fileText' },
  { key: 'settings', label: 'Settings', icon: 'settings' },
];

/* ======================= STORAGE + ROLLOVER ======================= */
const tasksKey = userId => `momentum.tasks.${userId}.v1`;
const checkKey = userId => `momentum.lastcheck.${userId}.v1`;
const notifiedKey = userId => `momentum.notified.${userId}.v1`;

function makeTask(overrides) {
  const date = overrides.date || todayKey();
  return {
    id: uid(),
    title: '',
    description: '',
    category: 'Work',
    priority: 'Medium',
    estimatedTime: '',
    dueTime: '',
    originalDate: date,
    currentDate: date,
    isRange: false,
    endDate: null,
    status: 'pending',
    isRolledOver: false,
    rolloverCount: 0,
    createdAt: new Date().toISOString(),
    completedAt: null,
    attachment: null, // optional { name, type, dataUrl } — added from the Add/Edit Task form
    ...overrides,
  };
}

function seedTasks() {
  const today = todayKey();
  const yesterday = addDays(today, -1);
  const future = addDays(today, 5);
  return [
    makeTask({ title: 'Prepare Green University seminar certificate', category: 'Work', priority: 'High', date: today, status: 'completed', completedAt: new Date().toISOString() }),
    makeTask({ title: 'Send HR onboarding email', category: 'Work', priority: 'Medium', date: today, status: 'completed', completedAt: new Date().toISOString() }),
    makeTask({ title: 'Update quarterly presentation', category: 'Work', priority: 'Medium', date: today, status: 'completed', completedAt: new Date().toISOString() }),
    makeTask({ title: 'Prepare seminar documents', description: 'Print handouts and attendance sheets for the seminar.', category: 'Work', priority: 'High', date: today }),
    makeTask({ title: 'Design social media post', category: 'Marketing', priority: 'Low', date: today, estimatedTime: '45 min' }),
    makeTask({ title: 'Review pull requests', category: 'Development', priority: 'Medium', date: yesterday, originalDate: yesterday, currentDate: today, isRolledOver: true, rolloverCount: 1 }),
    makeTask({ title: 'Prepare final presentation', description: 'Client-facing deck for the board meeting.', category: 'Design', priority: 'High', date: future }),
    makeTask({ title: 'Team retro notes', category: 'Meeting', priority: 'Low', date: future }),
  ];
}

// Rolls forward any unfinished task whose last scheduled day is already behind us.
// A long task is only late once its whole range has passed, so it keeps its span
// (start and end both shift by the same number of days) when it does roll.
// Guarded by a per-user check-key so re-opening the app the same day never double-rolls.
function runRollover(tasks, userId, force = false) {
  const today = todayKey();
  const lastCheck = safeGet(checkKey(userId));
  if (lastCheck === today && !force) return { tasks, changed: false };
  let changed = false;
  const updated = tasks.map(t => {
    if (t.status !== 'completed' && taskEnd(t) < today) {
      changed = true;
      const span = taskSpan(t) - 1;
      const diff = daysDiff(taskEnd(t), today);
      return {
        ...t,
        currentDate: today,
        endDate: span > 0 ? addDays(today, span) : t.endDate,
        isRolledOver: true,
        rolloverCount: t.rolloverCount + diff,
      };
    }
    return t;
  });
  safeSet(checkKey(userId), today);
  return { tasks: updated, changed };
}
function loadNotified(userId) {
  try {
    const raw = JSON.parse(safeGet(notifiedKey(userId)));
    if (raw && raw.date === todayKey()) return new Set(raw.ids);
    return new Set();
  } catch (e) { return new Set(); }
}
function saveNotified(userId, set) {
  safeSet(notifiedKey(userId), JSON.stringify({ date: todayKey(), ids: [...set] }));
}

/* ======================= SUMMARY PDF ======================= */
function buildSummaryRange(tasks, from, to) {
  const lo = from <= to ? from : to, hi = from <= to ? to : from;
  const inRange = tasks.filter(t => overlapsRange(t, lo, hi));
  const byDate = {};
  inRange.forEach(t => {
    const from = taskStart(t) > lo ? taskStart(t) : lo;
    const end = effectiveEnd(t);
    const to = end < hi ? end : hi;
    for (let k = from; k <= to; k = addDays(k, 1)) (byDate[k] = byDate[k] || []).push(t);
  });
  const dates = Object.keys(byDate).sort();
  const completedTasks = inRange.filter(t => t.status === 'completed');
  // "On-time" = finished without ever being carried over from an earlier day;
  // "Late" = finished but only after rolling over at least once. Best proxy the data model supports.
  const onTime = completedTasks.filter(t => t.rolloverCount === 0).length;
  const late = completedTasks.length - onTime;
  return { byDate, dates, total: inRange.length, completed: completedTasks.length, onTime, late };
}
function statusLabel(t) {
  if (t.status === 'completed') return 'Completed';
  if (t.isRolledOver) return 'Rolled Over';
  return 'Pending';
}
async function ensurePdfLibs() {
  if (typeof window !== 'undefined' && window.jspdf && window.jspdf.jsPDF && window.jspdf.__autotable) return;
  const { jsPDF } = await import('jspdf');
  const at = await import('jspdf-autotable');
  if (at.applyPlugin) at.applyPlugin(jsPDF);
  window.jspdf = { jsPDF, __autotable: true };
}
async function downloadSummaryPdf({ user, from, to, byDate, dates, total, completed, onTime, late }) {
  await ensurePdfLibs();
  const jsPDFCtor = window.jspdf && window.jspdf.jsPDF;
  if (!jsPDFCtor) throw new Error('jsPDF not loaded');
  const doc = new jsPDFCtor({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 40;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor(11, 31, 58);
  doc.text('Task Summary', marginX, 46);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(100, 116, 139);
  doc.text(`${fmtShort(from <= to ? from : to)} \u2013 ${fmtShort(from <= to ? to : from)}`, marginX, 65);
  doc.text(`${user.name} \u00b7 generated ${new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}`, marginX, 80);
  doc.setDrawColor(226, 232, 240); doc.line(marginX, 92, pageWidth - marginX, 92);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(124, 58, 237);
  doc.text(`${total} task${total !== 1 ? 's' : ''} \u00b7 ${completed} completed \u00b7 ${total - completed} pending`, marginX, 108);

  // On-Time vs Late performance bar, drawn directly with jsPDF's vector primitives (no extra
  // library needed) so it travels with the rest of the downloadable summary.
  let y;
  const barW = pageWidth - marginX * 2, barH = 11, barY = 122;
  if (completed > 0) {
    const onTimePct = Math.round((onTime / completed) * 100);
    const latePct = 100 - onTimePct;
    const onTimeW = barW * (onTime / completed);
    doc.setFillColor(226, 232, 240); doc.rect(marginX, barY, barW, barH, 'F');
    if (onTime > 0) { doc.setFillColor(16, 185, 129); doc.rect(marginX, barY, onTimeW, barH, 'F'); }
    if (late > 0) { doc.setFillColor(244, 63, 94); doc.rect(marginX + onTimeW, barY, barW - onTimeW, barH, 'F'); }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(100, 116, 139);
    doc.text(`On-Time ${onTimePct}% (${onTime})`, marginX, barY + 24);
    doc.text(`Late ${latePct}% (${late})`, pageWidth - marginX, barY + 24, { align: 'right' });
    y = barY + 44;
  } else {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(148, 163, 184);
    doc.text('No completed tasks in this range yet \u2014 on-time/late performance will appear here once tasks are done.', marginX, barY + 8);
    y = barY + 30;
  }
  const hasAutoTable = typeof doc.autoTable === 'function';

  if (!dates.length) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(17, 24, 39);
    doc.text('No tasks were scheduled in this date range.', marginX, y);
  } else {
    dates.forEach((dateKey, idx) => {
      if (idx > 0) y = hasAutoTable ? doc.lastAutoTable.finalY + 26 : y + 14;
      if (y > pageHeight - 120) { doc.addPage(); y = 50; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5); doc.setTextColor(11, 31, 58);
      doc.text(fmtLong(dateKey), marginX, y);
      const rows = byDate[dateKey].map(t => [t.title, t.category, t.priority, statusLabel(t)]);

      if (hasAutoTable) {
        doc.autoTable({
          startY: y + 10,
          head: [['Task', 'Category', 'Priority', 'Status']],
          body: rows,
          margin: { left: marginX, right: marginX },
          styles: { fontSize: 9.5, textColor: [17, 24, 39], cellPadding: 6, lineColor: [226, 232, 240] },
          headStyles: { fillColor: [11, 31, 58], textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          theme: 'grid',
        });
      } else {
        // fallback if the autoTable plugin failed to load: simple plain-text rows
        let ry = y + 20;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(17, 24, 39);
        rows.forEach(r => {
          if (ry > pageHeight - 50) { doc.addPage(); ry = 50; }
          doc.text(`\u2022 ${r[0]}  \u2014  ${r[1]} / ${r[2]} / ${r[3]}`, marginX + 10, ry);
          ry += 16;
        });
        doc.lastAutoTable = { finalY: ry };
        y = ry;
      }
    });
  }
  doc.save(`task-summary_${from}_to_${to}.pdf`);
}

/* ======================= SMALL UI ATOMS ======================= */
function PriorityBadge({ priority }) {
  const styles = {
    High: 'bg-purple text-white',
    Medium: 'bg-purpleLight/20 text-purple border border-purpleLight/40',
    Low: 'bg-slate-100 text-slateText',
  };
  return <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${styles[priority] || styles.Low}`}>{priority}</span>;
}
function CategoryBadge({ category }) {
  return <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-navy/5 text-navy whitespace-nowrap">{category}</span>;
}
function ProgressBar({ value, className = '' }) {
  return (
    <div className={`w-full h-2.5 rounded-full bg-slate-100 overflow-hidden ${className}`}>
      <div className="h-full rounded-full bg-gradient-to-r from-purple to-purpleLight transition-all duration-500 ease-out" style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}
function RingProgress({ value, size = 60, stroke = 6, textClass = 'text-ink', track = '#E2E8F0' }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, value) / 100) * c;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#7C3AED" strokeWidth={stroke} fill="none"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset .6s ease' }} />
      </svg>
      <div className={`absolute inset-0 flex items-center justify-center font-display font-bold ${textClass}`} style={{ fontSize: size * 0.24 }}>
        {Math.round(value)}%
      </div>
    </div>
  );
}
function IconButton({ icon, onClick, label, className = '', size = 17 }) {
  return (
    <button onClick={onClick} aria-label={label} title={label}
      className={`p-2 rounded-lg text-slateText hover:text-navy hover:bg-slate-100 transition-colors ${className}`}>
      <Icon name={icon} size={size} />
    </button>
  );
}
// Premium gradient icon container used for badges throughout the app (stat cards, empty
// states, notification rows, logo mark) so icons read as a polished, cohesive brand system.
function IconBadge({ icon, size = 34, iconSize = 16, tone = 'purple', className = '' }) {
  const tones = {
    purple: 'bg-gradient-to-br from-purple to-purpleLight text-white shadow-[0_4px_14px_rgba(124,58,237,0.35)]',
    navy: 'bg-gradient-to-br from-navy to-navyDeep text-white shadow-[0_4px_14px_rgba(11,31,58,0.3)]',
    soft: 'bg-gradient-to-br from-purple/10 to-purpleLight/20 text-purple ring-1 ring-purple/10',
    emerald: 'bg-gradient-to-br from-emerald-500 to-emerald-400 text-white shadow-[0_4px_14px_rgba(16,185,129,0.32)]',
    glass: 'bg-white/15 text-white ring-1 ring-white/25 backdrop-blur-sm',
  };
  return (
    <div style={{ width: size, height: size }}
      className={`rounded-xl flex items-center justify-center shrink-0 ${tones[tone] || tones.purple} ${className}`}>
      <Icon name={icon} size={iconSize} strokeWidth={2.2} />
    </div>
  );
}
function Avatar({ user, size = 36, ring = false }) {
  const cls = `rounded-full object-cover shrink-0 ${ring ? 'ring-2 ring-purpleLight/40' : ''}`;
  if (user && user.avatar) {
    return <img src={user.avatar} alt={user.name || 'Profile photo'} style={{ width: size, height: size }} className={cls} />;
  }
  const initial = (user && user.name || '?').trim().charAt(0).toUpperCase();
  return (
    <div style={{ width: size, height: size }} className={`rounded-full bg-purpleLight/25 text-purple font-display font-bold flex items-center justify-center shrink-0 ${ring ? 'ring-2 ring-purpleLight/40' : ''}`}>
      <span style={{ fontSize: size * 0.4 }}>{initial}</span>
    </div>
  );
}
// Shrinks an uploaded photo client-side before it goes into localStorage.
function resizeImageFile(file, maxSize = 240) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height) { if (width > maxSize) { height = Math.round(height * (maxSize / width)); width = maxSize; } }
        else { if (height > maxSize) { width = Math.round(width * (maxSize / height)); height = maxSize; } }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => reject(new Error('Could not read that image.'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}
// Reads a task attachment for local storage: images are downsized like a profile photo,
// anything else (PDF, doc, etc.) is capped to a small size and kept as-is.
const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024; // 3MB safety cap for localStorage
function readTaskAttachment(file) {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      reject(new Error('That file is too large to attach (max 3MB).'));
      return;
    }
    if (file.type.startsWith('image/')) {
      resizeImageFile(file, 900).then(dataUrl => resolve({ name: file.name, type: 'image', dataUrl })).catch(reject);
      return;
    }
    const reader = new FileReader();
    reader.onload = e => resolve({ name: file.name, type: file.type || 'file', dataUrl: e.target.result });
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}
function EmptyState({ icon = 'sparkle', title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <IconBadge icon={icon} size={56} iconSize={24} tone="soft" className="rounded-2xl mb-4" />
      <p className="font-display font-semibold text-ink mb-1">{title}</p>
      {subtitle && <p className="text-sm text-slateText max-w-xs">{subtitle}</p>}
    </div>
  );
}

/* ======================= MONTH / YEAR QUICK JUMP ======================= */
// Reused by every calendar in the app (MiniCalendar popovers + the big CalendarPage grid)
// so jumping to any month/year — years ahead or years back — is always one click away.
const MONTH_NAMES = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString('en-US', { month: 'long' }));
function MonthYearJump({ vy, vm, setVy, setVm, size = 'sm' }) {
  const selCls = size === 'lg'
    ? "font-display font-bold text-base md:text-lg text-ink bg-transparent border border-line rounded-lg px-2 py-1 outline-none focus:border-purple hover:bg-slate-50 cursor-pointer"
    : "font-display font-semibold text-sm text-ink bg-transparent border border-line rounded-lg px-1.5 py-1 outline-none focus:border-purple hover:bg-slate-50 cursor-pointer";
  return (
    <div className="flex items-center gap-1.5">
      <select aria-label="Jump to month" value={vm} onChange={e => setVm(Number(e.target.value))} className={selCls}>
        {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
      </select>
      <input aria-label="Jump to year" type="number" value={vy}
        onChange={e => { const y = parseInt(e.target.value, 10); if (!Number.isNaN(y)) setVy(y); }}
        className={`${selCls} ${size === 'lg' ? 'w-[84px]' : 'w-[68px]'} text-center`} />
    </div>
  );
}

/* ======================= MINI CALENDAR (date picker) ======================= */
function MiniCalendar({ selected, onSelect, taskCounts = {} }) {
  const base = parseKey(selected || todayKey());
  const [vy, setVy] = useState(base.getFullYear());
  const [vm, setVm] = useState(base.getMonth());
  const today = todayKey();
  const first = new Date(vy, vm, 1);
  const startWd = first.getDay();
  const daysInMonth = new Date(vy, vm + 1, 0).getDate();
  const cells = [...Array(startWd).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const goPrev = () => vm === 0 ? (setVm(11), setVy(y => y - 1)) : setVm(m => m - 1);
  const goNext = () => vm === 11 ? (setVm(0), setVy(y => y + 1)) : setVm(m => m + 1);

  return (
    <div className="w-[280px] p-3.5">
      <div className="flex items-center justify-between mb-3 gap-1">
        <button onClick={goPrev} className="p-1.5 rounded-lg hover:bg-slate-100 text-slateText shrink-0"><Icon name="chevronLeft" size={16} /></button>
        <MonthYearJump vy={vy} vm={vm} setVy={setVy} setVm={setVm} />
        <button onClick={goNext} className="p-1.5 rounded-lg hover:bg-slate-100 text-slateText shrink-0"><Icon name="chevronRight" size={16} /></button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={i} className="text-center text-[10.5px] font-semibold text-slate-400 h-6 flex items-center justify-center">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const key = `${vy}-${pad(vm + 1)}-${pad(d)}`;
          const isToday = key === today, isSel = key === selected;
          const count = taskCounts[key] || 0;
          return (
            <button key={i} onClick={() => onSelect(key)}
              className={`relative h-9 rounded-lg text-[13px] flex items-center justify-center transition-colors
                ${isSel ? 'bg-purple text-white font-semibold' : isToday ? 'bg-purpleLight/15 text-purple font-semibold' : 'text-ink hover:bg-slate-100'}`}>
              {d}
              {count > 0 && !isSel && <span className="absolute bottom-1 w-1 h-1 rounded-full bg-purple" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
function DateSelector({ value, onChange, taskCounts, placeholder }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-line bg-white hover:border-purpleLight text-sm font-medium text-ink shadow-card transition-colors">
        <Icon name="calendar" size={16} className="text-purple" />
        {value ? fmtShort(value) : (placeholder || fmtShort(todayKey()))}
        <Icon name="chevronDown" size={14} className="text-slateText" />
      </button>
      {open && (
        <div className="absolute z-30 mt-2 bg-white rounded-2xl shadow-pop border border-line animate-pop">
          <MiniCalendar selected={value} taskCounts={taskCounts} onSelect={k => { onChange(k); setOpen(false); }} />
        </div>
      )}
    </div>
  );
}
// From/To range control used on the Dashboard — pick any two dates and everything on the
// page (stats, progress, task list) scopes to that window. Defaults to 1st-of-month → today.
function DateRangeSelector({ from, to, onFromChange, onToChange, taskCounts, onResetToMonth }) {
  return (
    <div className="flex flex-wrap items-end gap-2.5">
      <div>
        <label className="block text-[11px] font-semibold text-slateText uppercase tracking-wide mb-1">From</label>
        <DateSelector value={from} onChange={onFromChange} taskCounts={taskCounts} />
      </div>
      <Icon name="rangeArrow" size={16} className="text-slate-300 mb-2.5 hidden sm:block shrink-0" />
      <div>
        <label className="block text-[11px] font-semibold text-slateText uppercase tracking-wide mb-1">To</label>
        <DateSelector value={to} onChange={onToChange} taskCounts={taskCounts} />
      </div>
      {onResetToMonth && (
        <button onClick={onResetToMonth} title="Reset to this month" className="mb-0.5 px-3 py-2.5 rounded-xl border border-line text-xs font-medium text-slateText hover:text-purple hover:border-purpleLight transition-colors">
          This Month
        </button>
      )}
    </div>
  );
}

/* ======================= TASK CARD ======================= */
function TaskCard({ task, onToggle, onEdit, onDelete, onOpen, dayKey }) {
  const done = task.status === 'completed';
  // For a long task, show which day of the run this card is standing on.
  const long = isLongTask(task);
  const span = taskSpan(task);
  const onDay = long && dayKey && occursOn(task, dayKey) ? dayIndex(task, dayKey) : 0;
  // Finished before the range was up: the run stopped early, so say so instead of "Day N of M".
  const finishedDay = long && done ? completedOn(task) : null;
  const finishedEarly = finishedDay && finishedDay < taskEnd(task);
  return (
    <div className={`group flex items-start gap-3 p-4 rounded-2xl border transition-all
      ${done ? 'bg-slate-50/70 border-line' : 'bg-white border-line hover:border-purpleLight hover:shadow-card'}`}>
      <button onClick={() => onToggle(task.id)} aria-label="Toggle complete"
        className={`shrink-0 mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors
          ${done ? 'bg-emerald-500 border-emerald-500 text-white animate-check' : 'border-slate-300 hover:border-purple'}`}>
        {done && <Icon name="checkCircle" size={13} strokeWidth={3} className="opacity-0" />}
        {done && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 13 5 5L20 7" /></svg>}
      </button>
      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onOpen(task)}>
        <p className={`font-medium text-[15px] leading-snug truncate ${done ? 'line-through text-slate-400' : 'text-ink'}`}>{task.title}</p>
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <CategoryBadge category={task.category} />
          <PriorityBadge priority={task.priority} />
          {long && (
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${finishedEarly ? 'bg-emerald-100 text-emerald-700' : 'bg-purple/10 text-purple'}`}>
              <Icon name="calendar" size={10} />
              {finishedEarly
                ? `Finished day ${dayIndex(task, finishedDay)} of ${span}`
                : onDay ? `Day ${onDay} of ${span}` : `${span}-day task`}
            </span>
          )}
          {task.isRolledOver && !done && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-navy/5 text-navy flex items-center gap-1">
              <Icon name="rotate" size={10} /> Rolled over {task.rolloverCount}×
            </span>
          )}
          {task.dueTime && !done && <span className="text-[11px] font-medium text-navy flex items-center gap-1"><Icon name="target" size={11} />Due {fmtTime(task.dueTime)}</span>}
          {task.estimatedTime && <span className="text-[11px] text-slateText flex items-center gap-1"><Icon name="clock" size={11} />{task.estimatedTime}</span>}
          {task.attachment && <span className="text-[11px] text-slateText flex items-center gap-1"><Icon name="paperclip" size={11} />Attachment</span>}
          {long && (
            <span className="text-[11px] text-slate-400">
              {fmtShort(taskStart(task))} – {fmtShort(effectiveEnd(task))}
              {finishedEarly && <span className="text-emerald-600"> (ended early)</span>}
            </span>
          )}
          {task.originalDate !== task.currentDate && (
            <span className="text-[11px] text-slate-400">Originally {fmtShort(task.originalDate)}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
        <IconButton icon="edit" label="Edit task" onClick={() => onEdit(task)} size={15} />
        <IconButton icon="trash" label="Delete task" onClick={() => onDelete(task)} size={15} />
      </div>
    </div>
  );
}
function TaskListSection({ title, tasks, dayKey, ...handlers }) {
  if (!tasks.length) return null;
  return (
    <div className="mb-6">
      {title && <p className="text-xs font-semibold uppercase tracking-wide text-slateText mb-2.5 px-1">{title}</p>}
      <div className="space-y-2.5">
        {tasks.map(t => <TaskCard key={t.id} task={t} dayKey={dayKey} {...handlers} />)}
      </div>
    </div>
  );
}

/* ======================= MODALS ======================= */
function ModalShell({ open, onClose, children, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/40 backdrop-blur-sm animate-fade" onMouseDown={onClose}>
      <div onMouseDown={e => e.stopPropagation()}
        className={`app-scroll w-full ${wide ? 'max-w-lg' : 'max-w-md'} max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-pop animate-pop`}>
        {children}
      </div>
    </div>
  );
}
function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slateText mb-1.5">{label}</label>
      {children}
    </div>
  );
}
const inputCls = "w-full px-3.5 py-2.5 rounded-xl border border-line bg-bg focus:bg-white focus:border-purple outline-none text-sm text-ink transition-colors";

function TaskFormModal({ open, onClose, onSubmit, initial, defaultDate, taskCounts }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(defaultDate || todayKey());
  const [isRange, setIsRange] = useState(false);
  const [endDate, setEndDate] = useState(defaultDate || todayKey());
  const [priority, setPriority] = useState('Medium');
  const [category, setCategory] = useState('Work');
  const [estimatedTime, setEstimatedTime] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [showCal, setShowCal] = useState(false);
  const [showEndCal, setShowEndCal] = useState(false);
  const [error, setError] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [attaching, setAttaching] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setTitle(initial.title); setDescription(initial.description || '');
      setDate(initial.currentDate); setPriority(initial.priority);
      setCategory(initial.category); setEstimatedTime(initial.estimatedTime || '');
      setDueTime(initial.dueTime || ''); setAttachment(initial.attachment || null);
      setIsRange(isLongTask(initial)); setEndDate(taskEnd(initial));
    } else {
      setTitle(''); setDescription(''); setDate(defaultDate || todayKey());
      setPriority('Medium'); setCategory('Work'); setEstimatedTime(''); setDueTime(''); setAttachment(null);
      setIsRange(false); setEndDate(defaultDate || todayKey());
    }
    setError(''); setShowCal(false); setShowEndCal(false);
  }, [open, initial, defaultDate]);

  // Keep the end date from drifting behind the start date when the start moves.
  const pickStart = (k) => {
    setDate(k); setShowCal(false);
    if (endDate < k) setEndDate(k);
  };
  const spanDays = isRange && endDate > date ? daysDiff(date, endDate) + 1 : 1;

  const pickFile = () => fileRef.current && fileRef.current.click();
  const onPickFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setAttaching(true); setError('');
    try {
      const att = await readTaskAttachment(file);
      setAttachment(att);
    } catch (err) { setError(err.message || 'Could not attach that file.'); }
    setAttaching(false);
  };

  const submit = () => {
    if (!title.trim()) { setError('Give the task a title.'); return; }
    if (isRange && endDate < date) { setError('End date cannot be before the start date.'); return; }
    onSubmit({
      title: title.trim(), description: description.trim(), date, priority, category,
      estimatedTime: estimatedTime.trim(), dueTime, attachment,
      isRange: isRange && endDate > date,
      endDate: isRange && endDate > date ? endDate : null,
    });
  };

  return (
    <ModalShell open={open} onClose={onClose}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-bold text-lg text-ink">{initial ? 'Edit Task' : 'Add New Task'}</h2>
          <IconButton icon="x" label="Close" onClick={onClose} />
        </div>
        <div className="space-y-4">
          <Field label="Task Title">
            <input autoFocus className={inputCls} placeholder="e.g. Finish quarterly report"
              value={title} onChange={e => setTitle(e.target.value)} />
          </Field>
          <Field label="Description (optional)">
            <textarea className={inputCls} rows={3} placeholder="Add extra detail…"
              value={description} onChange={e => setDescription(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={isRange ? 'Start Date' : 'Date'}>
              <div className="relative">
                <button type="button" onClick={() => { setShowCal(s => !s); setShowEndCal(false); }} className={`${inputCls} text-left flex items-center justify-between`}>
                  {fmtShort(date)} <Icon name="calendar" size={15} className="text-purple" />
                </button>
                {showCal && (
                  <div className="absolute z-20 mt-2 bg-white rounded-2xl shadow-pop border border-line">
                    <MiniCalendar selected={date} taskCounts={taskCounts} onSelect={pickStart} />
                  </div>
                )}
              </div>
            </Field>
            <Field label="Due Time (optional)">
              <div className="relative">
                <input type="time" className={`${inputCls} pr-9`} value={dueTime} onChange={e => setDueTime(e.target.value)} />
                <Icon name="clock" size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-purple pointer-events-none" />
              </div>
            </Field>
          </div>

          {/* Long task: spreads one task across a date range so it shows up in
              Today's Tasks every day until the end date passes. */}
          <div className="rounded-xl border border-line bg-bg px-3.5 py-3">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input type="checkbox" className="w-4 h-4 accent-purple shrink-0" checked={isRange}
                onChange={e => { setIsRange(e.target.checked); setShowEndCal(false); if (e.target.checked && endDate <= date) setEndDate(addDays(date, 1)); }} />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink">Long Task (date range)</span>
                <span className="block text-xs text-slateText">Shows in Today's Tasks every day until the end date.</span>
              </span>
            </label>
            {isRange && (
              <div className="mt-3">
                <Field label="End Date">
                  <div className="relative">
                    <button type="button" onClick={() => { setShowEndCal(s => !s); setShowCal(false); }} className={`${inputCls} text-left flex items-center justify-between`}>
                      {fmtShort(endDate)} <Icon name="calendar" size={15} className="text-purple" />
                    </button>
                    {showEndCal && (
                      <div className="absolute z-20 mt-2 bg-white rounded-2xl shadow-pop border border-line">
                        <MiniCalendar selected={endDate} taskCounts={taskCounts} onSelect={k => { setEndDate(k); setShowEndCal(false); }} />
                      </div>
                    )}
                  </div>
                </Field>
                <p className={`mt-2 text-xs font-medium ${endDate < date ? 'text-red-500' : 'text-purple'}`}>
                  {endDate < date
                    ? 'End date is before the start date.'
                    : `${fmtShort(date)} → ${fmtShort(endDate)} · ${spanDays} day${spanDays !== 1 ? 's' : ''}`}
                </p>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Priority">
              <select className={inputCls} value={priority} onChange={e => setPriority(e.target.value)}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Category">
              <select className={inputCls} value={category} onChange={e => setCategory(e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Estimated Time (optional)">
            <input className={inputCls} placeholder="e.g. 45 min" value={estimatedTime} onChange={e => setEstimatedTime(e.target.value)} />
          </Field>
          <Field label="Attach a Photo or File (optional)">
            {attachment ? (
              <div className="flex items-center gap-3 p-2.5 rounded-xl border border-line bg-bg">
                {attachment.type === 'image' ? (
                  <img src={attachment.dataUrl} alt={attachment.name} className="w-11 h-11 rounded-lg object-cover shrink-0" />
                ) : (
                  <IconBadge icon="fileText" tone="soft" size={40} iconSize={17} />
                )}
                <span className="flex-1 min-w-0 text-sm text-ink truncate">{attachment.name}</span>
                <IconButton icon="x" label="Remove attachment" onClick={() => setAttachment(null)} />
              </div>
            ) : (
              <button type="button" onClick={pickFile} disabled={attaching}
                className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border border-dashed border-line text-sm font-medium text-slateText hover:border-purpleLight hover:text-purple transition-colors disabled:opacity-60">
                <Icon name="paperclip" size={15} /> {attaching ? 'Attaching…' : 'Upload Photo or File'}
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*,.pdf,.doc,.docx,.txt" className="hidden" onChange={onPickFile} />
          </Field>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-line text-ink font-medium text-sm hover:bg-slate-50 transition-colors">Cancel</button>
          <button onClick={submit} className="flex-1 py-2.5 rounded-xl bg-purple text-white font-medium text-sm hover:bg-purple/90 transition-colors shadow-card">
            {initial ? 'Save Changes' : 'Add Task'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function ChangeDateModal({ open, onClose, task, onConfirm, taskCounts }) {
  const [date, setDate] = useState(todayKey());
  useEffect(() => { if (task) setDate(task.currentDate); }, [task]);
  if (!task) return null;
  // Moving a long task shifts the whole run; the end date follows the start by the same offset.
  const span = taskSpan(task);
  const movedEnd = span > 1 ? addDays(date, span - 1) : null;
  return (
    <ModalShell open={open} onClose={onClose}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-lg text-ink">Change Task Date</h2>
          <IconButton icon="x" label="Close" onClick={onClose} />
        </div>
        <p className="text-sm text-slateText mb-4 truncate">{task.title}</p>
        {movedEnd && (
          <p className="text-xs font-medium text-purple mb-3">
            {span}-day task — moving it runs {fmtShort(date)} – {fmtShort(movedEnd)}.
          </p>
        )}
        <div className="flex justify-center">
          <MiniCalendar selected={date} taskCounts={taskCounts} onSelect={setDate} />
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-line text-ink font-medium text-sm hover:bg-slate-50">Cancel</button>
          <button onClick={() => onConfirm(task.id, date)} className="flex-1 py-2.5 rounded-xl bg-purple text-white font-medium text-sm hover:bg-purple/90 shadow-card">Move Task</button>
        </div>
      </div>
    </ModalShell>
  );
}

function TaskDetailsModal({ open, onClose, task, onToggle, onEdit, onDelete, onChangeDate }) {
  if (!task) return null;
  const Row = ({ label, value }) => (
    <div className="flex items-start justify-between py-2.5 border-b border-line last:border-0">
      <span className="text-xs font-semibold text-slateText uppercase tracking-wide">{label}</span>
      <span className="text-sm text-ink text-right max-w-[65%]">{value}</span>
    </div>
  );
  return (
    <ModalShell open={open} onClose={onClose}>
      <div className="p-6">
        <div className="flex items-start justify-between mb-4 gap-3">
          <h2 className={`font-display font-bold text-lg text-ink ${task.status === 'completed' ? 'line-through text-slate-400' : ''}`}>{task.title}</h2>
          <IconButton icon="x" label="Close" onClick={onClose} />
        </div>
        <div className="flex gap-1.5 flex-wrap mb-4">
          <CategoryBadge category={task.category} />
          <PriorityBadge priority={task.priority} />
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${task.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-purpleLight/20 text-purple'}`}>
            {task.status === 'completed' ? 'Completed' : task.isRolledOver ? 'Rolled Over' : 'Pending'}
          </span>
          {isLongTask(task) && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-purple/10 text-purple flex items-center gap-1">
              <Icon name="calendar" size={10} /> {taskSpan(task)}-day task
            </span>
          )}
        </div>
        {task.description && <p className="text-sm text-slateText mb-4 leading-relaxed">{task.description}</p>}
        {task.attachment && (
          <a href={task.attachment.dataUrl} download={task.attachment.name} target="_blank" rel="noreferrer"
            className="flex items-center gap-3 p-2.5 rounded-xl border border-line bg-bg mb-4 hover:border-purpleLight transition-colors">
            {task.attachment.type === 'image' ? (
              <img src={task.attachment.dataUrl} alt={task.attachment.name} className="w-12 h-12 rounded-lg object-cover shrink-0" />
            ) : (
              <IconBadge icon="fileText" tone="soft" size={42} iconSize={18} />
            )}
            <span className="flex-1 min-w-0 text-sm font-medium text-ink truncate">{task.attachment.name}</span>
            <Icon name="download" size={15} className="text-slateText shrink-0" />
          </a>
        )}
        <div className="border-t border-line pt-1">
          <Row label="Created" value={new Date(task.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })} />
          <Row label="Original Date" value={fmtShort(task.originalDate)} />
          {isLongTask(task) ? (
            <React.Fragment>
              <Row label="Start Date" value={fmtShort(taskStart(task))} />
              <Row label="End Date" value={fmtShort(taskEnd(task))} />
              <Row label="Duration" value={`${taskSpan(task)} days`} />
              {completedOn(task) && completedOn(task) < taskEnd(task) && (
                <Row label="Finished Early On" value={`${fmtShort(completedOn(task))} · day ${dayIndex(task, completedOn(task))} of ${taskSpan(task)}`} />
              )}
            </React.Fragment>
          ) : (
            <Row label="Current Due Date" value={fmtShort(task.currentDate)} />
          )}
          {task.dueTime && <Row label="Due Time" value={fmtTime(task.dueTime)} />}
          <Row label="Rollover Count" value={task.rolloverCount} />
          {task.estimatedTime && <Row label="Estimated Time" value={task.estimatedTime} />}
          {task.completedAt && <Row label="Completion Date" value={new Date(task.completedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })} />}
        </div>
        <div className="flex flex-wrap gap-2 mt-5">
          <button onClick={() => onToggle(task.id)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple text-white text-sm font-medium hover:bg-purple/90">
            <Icon name="checkCircle" size={15} /> {task.status === 'completed' ? 'Mark as Pending' : 'Mark as Done'}
          </button>
          <button onClick={() => onEdit(task)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-line text-ink text-sm font-medium hover:bg-slate-50">
            <Icon name="edit" size={15} /> Edit
          </button>
          <button onClick={() => onChangeDate(task)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-line text-ink text-sm font-medium hover:bg-slate-50">
            <Icon name="calendar" size={15} /> Change Date
          </button>
          <button onClick={() => onDelete(task)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50">
            <Icon name="trash" size={15} /> Delete
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', danger, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <ModalShell open={open} onClose={onCancel}>
      <div className="p-6">
        <h3 className="font-display font-bold text-lg text-ink mb-2">{title}</h3>
        <p className="text-sm text-slateText mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-line text-ink font-medium text-sm hover:bg-slate-50">Cancel</button>
          <button onClick={onConfirm} className={`flex-1 py-2.5 rounded-xl text-white font-medium text-sm shadow-card ${danger ? 'bg-red-500 hover:bg-red-600' : 'bg-purple hover:bg-purple/90'}`}>{confirmLabel}</button>
        </div>
      </div>
    </ModalShell>
  );
}

/* ======================= AUTH PAGE ======================= */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function pwScore(pw) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(4, s);
}
function AuthVisual() {
  // Decorative live "day plan" that ticks itself off — shows the product in motion.
  const rows = [
    { t: 'Prepare seminar documents', c: 'Work', p: 'High' },
    { t: 'Design social media post', c: 'Marketing', p: 'Low' },
    { t: 'Review pull requests', c: 'Development', p: 'Medium', r: true },
    { t: 'Send HR onboarding email', c: 'Work', p: 'Medium' },
  ];
  const [done, setDone] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setDone(d => (d >= rows.length ? 0 : d + 1)), 1600);
    return () => clearInterval(iv);
  }, []);
  const pct = Math.round((Math.min(done, rows.length) / rows.length) * 100);
  return (
    <div className="relative w-full max-w-sm">
      <div className="tm-float absolute -top-6 -right-4 tm-glass rounded-2xl px-3.5 py-2.5 flex items-center gap-2.5 z-10" style={{ animationDelay: '.4s' }}>
        <span className="w-7 h-7 rounded-lg bg-emerald-400/25 text-emerald-200 flex items-center justify-center"><Icon name="rotate" size={14} /></span>
        <div><p className="text-[11px] text-white/60 leading-none mb-1">Auto roll-over</p><p className="text-xs font-semibold text-white leading-none">Nothing gets lost</p></div>
      </div>
      <div className="tm-glass rounded-3xl p-5 tm-rise">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-white/50 font-semibold">Today</p>
            <p className="font-display font-bold text-white text-lg">{fmtMed(todayKey())}</p>
          </div>
          <RingProgress value={pct} size={48} stroke={5} textClass="text-white" track="rgba(255,255,255,0.15)" />
        </div>
        <div className="space-y-2">
          {rows.map((r, i) => {
            const isDone = i < done;
            return (
              <div key={r.t} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-500 ${isDone ? 'bg-white/5' : 'bg-white/10'}`}>
                <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all duration-300 ${isDone ? 'bg-purple border-purple' : 'border-white/30'}`}>
                  {isDone && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" className="animate-check"><path d="M20 6 9 17l-5-5" /></svg>}
                </span>
                <span className={`flex-1 text-sm truncate transition-colors duration-500 ${isDone ? 'text-white/40 line-through' : 'text-white'}`}>{r.t}</span>
                {r.r && !isDone && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-purpleLight/25 text-purpleLight font-semibold">Rolled</span>}
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${r.p === 'High' ? 'bg-purple text-white' : 'bg-white/10 text-white/70'}`}>{r.p}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="tm-float absolute -bottom-7 -left-6 tm-glass rounded-2xl px-3.5 py-2.5 flex items-center gap-2.5" style={{ animationDelay: '1.3s' }}>
        <span className="w-7 h-7 rounded-lg bg-purple/40 text-white flex items-center justify-center"><Icon name="bell" size={14} /></span>
        <div><p className="text-[11px] text-white/60 leading-none mb-1">Due in 15 min</p><p className="text-xs font-semibold text-white leading-none">Team retro notes</p></div>
      </div>
    </div>
  );
}

function AuthInput({ icon, trailing, className = '', ...rest }) {
  return (
    <div className="relative group">
      {icon && <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-purple transition-colors pointer-events-none"><Icon name={icon} size={16} /></span>}
      <input {...rest} className={`w-full h-12 rounded-xl border border-line bg-bg/70 focus:bg-white focus:border-purple focus:ring-4 focus:ring-purple/10 outline-none text-sm text-ink placeholder:text-slate-400 transition-all ${icon ? 'pl-10' : 'pl-3.5'} ${trailing ? 'pr-16' : 'pr-3.5'} ${className}`} />
      {trailing && <span className="absolute right-2 top-1/2 -translate-y-1/2">{trailing}</span>}
    </div>
  );
}

function AuthPage({ recovery = false, onRecovered }) {
  const sb = getSupabase();
  const [mode, setMode] = useState(recovery ? 'reset' : 'login'); // login | signup | forgot | reset | sent
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [sentKind, setSentKind] = useState('signup');

  const switchMode = (m) => { setMode(m); setError(''); setInfo(''); setPassword(''); setConfirm(''); };
  const score = pwScore(password);

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setInfo('');
    const cleanEmail = email.trim().toLowerCase();
    if (mode === 'reset') {
      if (password.length < 8) { setError('Use at least 8 characters for your password.'); return; }
      if (password !== confirm) { setError('Passwords do not match.'); return; }
      setBusy(true);
      const { error } = await sb.auth.updateUser({ password });
      setBusy(false);
      if (error) { setError(friendlyError(error)); return; }
      onRecovered && onRecovered();
      return;
    }
    if (!EMAIL_RE.test(cleanEmail)) { setError('Enter a valid email address.'); return; }
    if (mode === 'forgot') {
      setBusy(true);
      const { error } = await sb.auth.resetPasswordForEmail(cleanEmail, { redirectTo: siteOrigin() + '/' });
      setBusy(false);
      if (error && (error.status === 429 || /fetch|network/i.test(error.message))) { setError(friendlyError(error)); return; }
      setSentKind('reset'); setMode('sent');
      return;
    }
    if (mode === 'signup') {
      if (!name.trim() || !password) { setError('Fill in every field to continue.'); return; }
      if (password.length < 8) { setError('Use at least 8 characters for your password.'); return; }
      if (password !== confirm) { setError('Passwords do not match.'); return; }
      setBusy(true);
      const { data, error } = await sb.auth.signUp({ email: cleanEmail, password, options: { data: { full_name: name.trim() }, emailRedirectTo: siteOrigin() + '/' } });
      setBusy(false);
      if (error) { setError(friendlyError(error)); return; }
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) { setError('An account with that email already exists.'); return; }
      if (!data.session) { setSentKind('signup'); setMode('sent'); }
      return; // signed in → App takes over via onAuthStateChange
    }
    if (!password) { setError('Enter your password.'); return; }
    setBusy(true);
    const { error } = await sb.auth.signInWithPassword({ email: cleanEmail, password });
    setBusy(false);
    if (error) setError(/invalid login/i.test(error.message) ? 'Incorrect email or password.' : friendlyError(error));
  };

  const titles = {
    login: ['Welcome back', 'Log in to keep your tasks moving.'],
    signup: ['Create your account', 'Sign up to start tracking your day.'],
    forgot: ['Reset your password', "We'll email you a secure link."],
    reset: ['Choose a new password', 'Make it something you haven\'t used before.'],
    sent: ['Check your email', sentKind === 'reset' ? `If an account exists for ${email.trim()}, a reset link is on its way.` : `We sent a confirmation link to ${email.trim()}. Open it to activate your account.`],
  };

  return (
    <div className="min-h-screen w-full flex bg-white font-body overflow-y-auto" style={{ height: '100dvh' }}>
      <div className="hidden md:flex md:w-[46%] lg:w-[44%] tm-auth-panel text-white flex-col justify-between p-10 lg:p-12 relative overflow-hidden shrink-0">
        <div className="tm-blob absolute -top-24 -right-24 w-80 h-80 rounded-full bg-purple/30 blur-3xl" />
        <div className="tm-blob absolute bottom-[-6rem] left-[-4rem] w-80 h-80 rounded-full bg-purpleLight/15 blur-3xl" style={{ animationDelay: '-4s' }} />
        <div className="tm-grid absolute inset-0 opacity-[0.08]" />
        <div className="relative tm-rise">
          <img src={LOGO_WHITE_HORIZ} alt="Task Management logo" className="h-9 w-auto select-none pointer-events-none" draggable="false" />
        </div>
        <div className="relative flex justify-center py-10"><AuthVisual /></div>
        <div className="relative tm-rise" style={{ animationDelay: '.15s' }}>
          <p className="font-display font-bold text-3xl lg:text-[2.1rem] leading-tight mb-3">Nothing you plan for<br />today gets <span className="tm-gradient-text">lost tomorrow.</span></p>
          <p className="text-white/60 text-sm leading-relaxed max-w-sm">Unfinished tasks roll forward automatically, due-time reminders keep you honest, and everything stays put once it's done — synced on every device.</p>
          <p className="text-white/40 text-xs mt-6">Royal Navy &amp; Purple · your workspace, your pace</p>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-6 md:p-10 relative">
        <div className="tm-grid-light absolute inset-0 pointer-events-none" />
        <div className="w-full max-w-sm relative tm-rise" key={mode}>
          <img src={LOGO_MAIN} alt="Task Management logo" className="w-40 md:w-44 mb-6 select-none pointer-events-none" draggable="false" />
          <h1 className="font-display font-bold text-2xl text-ink mb-1">{titles[mode][0]}</h1>
          <p className="text-sm text-slateText mb-6">{titles[mode][1]}</p>

          {mode === 'sent' ? (
            <div className="space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple to-purpleLight text-white flex items-center justify-center shadow-[0_12px_30px_rgba(124,58,237,0.35)] animate-check">
                <Icon name="checkCircle" size={28} />
              </div>
              <button onClick={() => switchMode('login')} className="w-full h-12 rounded-xl border border-line text-ink font-semibold text-sm hover:bg-slate-50 transition-colors">Back to log in</button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4" noValidate>
              {mode === 'signup' && (
                <Field label="Full Name"><AuthInput icon="user" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" autoComplete="name" maxLength={80} autoFocus /></Field>
              )}
              {mode !== 'reset' && (
                <Field label="Email"><AuthInput icon="mail" type="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" autoFocus={mode !== 'signup'} /></Field>
              )}
              {mode !== 'forgot' && (
                <Field label={mode === 'reset' ? 'New Password' : 'Password'}>
                  <AuthInput icon="lock" type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    trailing={<button type="button" onClick={() => setShowPw(s => !s)} className="px-2.5 py-1.5 rounded-lg text-purple text-xs font-semibold hover:bg-purple/5">{showPw ? 'Hide' : 'Show'}</button>} />
                  {(mode === 'signup' || mode === 'reset') && password && (
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 grid grid-cols-4 gap-1">
                        {[0, 1, 2, 3].map(i => <span key={i} className={`h-1 rounded-full transition-all duration-300 ${i < score ? (score <= 1 ? 'bg-rose-500' : score === 2 ? 'bg-amber-500' : score === 3 ? 'bg-purple' : 'bg-emerald-500') : 'bg-slate-100'}`} />)}
                      </div>
                      <span className="text-[11px] font-semibold text-slateText w-14 text-right">{['Too weak', 'Weak', 'Okay', 'Good', 'Strong'][score]}</span>
                    </div>
                  )}
                </Field>
              )}
              {(mode === 'signup' || mode === 'reset') && (
                <Field label="Confirm Password"><AuthInput icon="lock" type={showPw ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••" autoComplete="new-password" /></Field>
              )}
              {mode === 'login' && (
                <div className="flex justify-end -mt-1"><button type="button" onClick={() => switchMode('forgot')} className="text-xs font-semibold text-purple hover:underline">Forgot password?</button></div>
              )}
              {error && <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5 animate-pop">{error}</p>}
              {info && <p className="text-sm text-emerald-700 bg-emerald-50 rounded-xl px-3.5 py-2.5 animate-pop">{info}</p>}
              <button type="submit" disabled={busy} className="tm-btn-primary w-full h-12 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-70">
                {busy && <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
                {mode === 'login' ? (busy ? 'Logging in…' : 'Log In') : mode === 'signup' ? (busy ? 'Creating account…' : 'Sign Up') : mode === 'forgot' ? (busy ? 'Sending…' : 'Send reset link') : (busy ? 'Saving…' : 'Save new password')}
              </button>
            </form>
          )}
          {mode !== 'reset' && mode !== 'sent' && (
            <p className="text-sm text-slateText text-center mt-6">
              {mode === 'login' ? "Don't have an account? " : mode === 'signup' ? 'Already have an account? ' : 'Remembered it? '}
              <button onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')} className="text-purple font-semibold hover:underline">
                {mode === 'login' ? 'Sign up' : 'Log in'}
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ======================= SIDEBAR ======================= */
function Sidebar({ view, setView, collapsed, setCollapsed, mobileOpen, setMobileOpen, user, onLogout }) {
  const go = k => { setView(k); setMobileOpen(false); };
  return (
    <>
      {mobileOpen && <div className="fixed inset-0 bg-navy/50 z-40 md:hidden animate-fade" onClick={() => setMobileOpen(false)} />}
      <aside className={`fixed md:static z-50 md:z-auto top-0 left-0 h-full bg-navy text-white flex flex-col shrink-0 transition-all duration-200
        ${collapsed ? 'md:w-[76px]' : 'md:w-[248px]'} w-[248px]
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="flex items-center px-5 py-5 border-b border-white/10 h-[68px]">
          {collapsed
            ? <img src={LOGO_WHITE_ICON} alt="Task Management" className="w-8 h-8 select-none pointer-events-none" draggable="false" />
            : <img src={LOGO_WHITE_HORIZ} alt="Task Management logo" className="h-7 w-auto select-none pointer-events-none" draggable="false" />}
        </div>
        <nav className="app-scroll flex-1 py-4 px-3 space-y-1 overflow-y-auto scrollbar-none">
          {NAV_ITEMS.map(item => {
            const active = view === item.key;
            return (
              <button key={item.key} onClick={() => go(item.key)} title={item.label}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors
                  ${active ? 'bg-purple text-white shadow-card' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>
                <Icon name={item.icon} size={18} className="shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>
        <button onClick={() => setCollapsed(c => !c)} className="hidden md:flex items-center justify-center gap-2 mx-3 mb-3 py-2 rounded-xl text-white/60 hover:bg-white/10 hover:text-white text-xs font-medium">
          <Icon name={collapsed ? 'chevronRight' : 'chevronLeft'} size={14} />
          {!collapsed && 'Collapse'}
        </button>
        <div className="border-t border-white/10 p-4 flex items-center gap-3">
          <Avatar user={user} size={36} />
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{user.name}</p>
              <p className="text-[11px] text-white/50 truncate">{user.email}</p>
            </div>
          )}
          <button onClick={onLogout} title="Log out" className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 shrink-0">
            <Icon name="arrowRight" size={15} />
          </button>
        </div>
      </aside>
    </>
  );
}

/* ======================= HEADER ======================= */
function greetingWord() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}
function NotificationDropdown({ tasks, reminders = [] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const today = todayKey();
  const todays = tasks.filter(t => occursOn(t, today));
  const rolled = todays.filter(t => t.isRolledOver && t.status !== 'completed').length;
  const done = todays.filter(t => t.status === 'completed').length;
  const pct = todays.length ? Math.round((done / todays.length) * 100) : 0;
  const items = reminders.map(r => ({ icon: 'target', text: r.text }));
  if (rolled > 0) items.push({ icon: 'rotate', text: `${rolled} task${rolled > 1 ? 's were' : ' was'} rolled over from a previous day.` });
  if (todays.length > 0) items.push({ icon: 'checkSquare', text: `You have ${todays.length} task${todays.length > 1 ? 's' : ''} scheduled for today.` });
  if (todays.length > 0) items.push({ icon: 'trend', text: `You've completed ${pct}% of today's tasks.` });
  if (!items.length) items.push({ icon: 'sparkle', text: 'No new notifications. You\'re all caught up.' });

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)} className="relative p-2.5 rounded-xl text-slateText hover:text-navy hover:bg-slate-100 transition-colors">
        <Icon name="bell" size={19} />
        {(rolled > 0 || reminders.length > 0) && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-purple ring-2 ring-white" />}
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 bg-white rounded-2xl shadow-pop border border-line animate-pop overflow-hidden">
          <div className="px-4 py-3 border-b border-line font-display font-semibold text-sm text-ink">Notifications</div>
          <div className="app-scroll max-h-72 overflow-y-auto">
            {items.map((n, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3 border-b border-line last:border-0 hover:bg-slate-50">
                <IconBadge icon={n.icon} size={32} iconSize={15} tone="soft" />
                <p className="text-sm text-ink leading-snug">{n.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
function SyncPill({ state }) {
  const map = {
    idle: { t: 'Synced', c: 'bg-emerald-50 text-emerald-700', d: 'bg-emerald-500' },
    saving: { t: 'Saving', c: 'bg-purple/10 text-purple', d: 'bg-purple animate-pulse' },
    offline: { t: 'Offline', c: 'bg-amber-50 text-amber-700', d: 'bg-amber-500' },
    error: { t: 'Not saved', c: 'bg-rose-50 text-rose-600', d: 'bg-rose-500' },
  };
  const m = map[state] || map.idle;
  return (
    <span title={m.t} className={`hidden sm:inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full text-[11px] font-semibold transition-colors ${m.c}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.d}`} />{m.t}
    </span>
  );
}
function Header({ view, onOpenMobile, searchQuery, setSearchQuery, tasks, reminders, user, onGoSettings, onUndo, onRedo, canUndo, canRedo, undoLabel, redoLabel, syncState }) {
  const titleMap = { dashboard: 'Dashboard', today: "Today's Tasks", all: 'All Tasks', calendar: 'Calendar', completed: 'Completed Tasks', pending: 'Pending Tasks', notes: 'Notes', summary: 'Summary', settings: 'Settings' };
  const [mobileSearch, setMobileSearch] = useState(false);
  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-line px-4 md:px-8 py-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <button onClick={onOpenMobile} className="md:hidden p-2 rounded-lg text-navy hover:bg-slate-100 shrink-0"><Icon name="menu" size={20} /></button>
        <div className="min-w-0">
          <p className="font-display font-bold text-lg md:text-xl text-ink truncate">
            {view === 'dashboard' ? `${greetingWord()} 👋` : titleMap[view]}
          </p>
          <p className="text-xs md:text-sm text-slateText truncate">
            {view === 'dashboard' ? fmtLong(todayKey()) : `${titleMap[view]} · ${fmtMed(todayKey())}`}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
        <div className={`items-center gap-2 bg-bg border border-line rounded-xl px-3 py-2 ${mobileSearch ? 'flex absolute left-4 right-4 top-[68px] z-20 bg-white shadow-pop' : 'hidden md:flex md:w-56'}`}>
          <Icon name="search" size={15} className="text-slateText shrink-0" />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search tasks…"
            className="bg-transparent outline-none text-sm w-full placeholder:text-slate-400" />
          {searchQuery && <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slateText"><Icon name="x" size={14} /></button>}
        </div>
        <button onClick={() => setMobileSearch(s => !s)} className="md:hidden p-2.5 rounded-xl text-slateText hover:bg-slate-100"><Icon name="search" size={18} /></button>
        <SyncPill state={syncState} />
        {/* Undo / redo for task changes — also on Ctrl+Z and Ctrl+Y. */}
        <div className="flex items-center gap-0.5">
          <button onClick={onUndo} disabled={!canUndo} title={canUndo && undoLabel ? `Undo: ${undoLabel} (Ctrl+Z)` : 'Undo (Ctrl+Z)'} aria-label="Undo"
            className="p-2.5 rounded-xl text-slateText hover:text-navy hover:bg-slate-100 transition-colors disabled:opacity-35 disabled:hover:bg-transparent disabled:cursor-not-allowed">
            <Icon name="undo" size={18} />
          </button>
          <button onClick={onRedo} disabled={!canRedo} title={canRedo && redoLabel ? `Redo: ${redoLabel} (Ctrl+Y)` : 'Redo (Ctrl+Y)'} aria-label="Redo"
            className="p-2.5 rounded-xl text-slateText hover:text-navy hover:bg-slate-100 transition-colors disabled:opacity-35 disabled:hover:bg-transparent disabled:cursor-not-allowed">
            <Icon name="redo" size={18} />
          </button>
        </div>
        <NotificationDropdown tasks={tasks} reminders={reminders} />
        <button onClick={onGoSettings} title="My Profile" className="rounded-full hover:ring-2 hover:ring-purpleLight/40 transition-all">
          <Avatar user={user} size={36} />
        </button>
      </div>
    </header>
  );
}

/* ======================= STATS ======================= */
// Small history modal shared by every stat card below — clicking a card opens the
// underlying task list so "Completed", "Pending", etc. are more than just a number.
function StatHistoryModal({ open, onClose, title, tone, tasks }) {
  const sorted = useMemo(() => [...tasks].sort((a, b) => b.currentDate.localeCompare(a.currentDate)), [tasks]);
  return (
    <ModalShell open={open} onClose={onClose} wide>
      <div className="p-6">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <IconBadge icon={tone?.icon || 'layers'} tone={tone?.tone || 'purple'} size={38} iconSize={17} />
            <div>
              <h2 className="font-display font-bold text-lg text-ink leading-tight">{title}</h2>
              <p className="text-xs text-slateText">{sorted.length} task{sorted.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <IconButton icon="x" label="Close" onClick={onClose} />
        </div>
        <div className="app-scroll mt-4 max-h-[60vh] overflow-y-auto -mx-2 px-2">
          {sorted.length === 0 ? (
            <EmptyState icon="fileText" title="Nothing here yet" subtitle="Tasks that match this stat will show up here." />
          ) : (
            <div className="space-y-2">
              {sorted.map(t => (
                <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl border border-line bg-white">
                  <div className="w-16 shrink-0 text-[11px] font-semibold text-slateText">{fmtShort(t.currentDate)}</div>
                  <p className={`flex-1 min-w-0 text-sm font-medium truncate ${t.status === 'completed' ? 'line-through text-slate-400' : 'text-ink'}`}>{t.title}</p>
                  <CategoryBadge category={t.category} />
                  <PriorityBadge priority={t.priority} />
                  <span className={`text-[11px] font-semibold shrink-0 ${t.status === 'completed' ? 'text-emerald-600' : t.isRolledOver ? 'text-navy' : 'text-slateText'}`}>{statusLabel(t)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
function StatsRow({ tasks }) {
  const [modal, setModal] = useState(null);
  const total = tasks.length;
  const completedList = tasks.filter(t => t.status === 'completed');
  const pendingList = tasks.filter(t => t.status !== 'completed');
  const completed = completedList.length;
  const pending = pendingList.length;
  const rate = total ? Math.round((completed / total) * 100) : 0;
  const cards = [
    { label: 'Total Tasks', value: total, icon: 'layers', tone: 'navy', list: tasks },
    { label: 'Completed', value: completed, icon: 'checkCircle', tone: 'emerald', list: completedList },
    { label: 'Pending', value: pending, icon: 'clock', tone: 'purple', list: pendingList },
  ];
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        {cards.map(c => (
          <button key={c.label} onClick={() => setModal(c)}
            className="tm-stat-card group text-left rounded-2xl p-4 md:p-5 cursor-pointer">
            <div className="flex items-center justify-between mb-3 relative">
              <span className="text-xs font-semibold text-white/70 uppercase tracking-wide">{c.label}</span>
              <IconBadge icon={c.icon} tone={c.tone === 'navy' ? 'glass' : c.tone} size={32} iconSize={15} className="transition-transform duration-500 group-hover:scale-110 group-hover:-translate-y-0.5" />
            </div>
            <p className="font-display font-extrabold text-2xl md:text-3xl text-white relative tabular-nums">{c.value}</p>
          </button>
        ))}
        <button onClick={() => setModal({ label: 'Completion Rate', icon: 'trend', tone: 'purple', list: tasks })}
          className="tm-stat-card tm-stat-card--accent text-left rounded-2xl p-4 md:p-5 flex items-center justify-between cursor-pointer">
          <div>
            <span className="text-xs font-semibold text-white/60 uppercase tracking-wide">Completion Rate</span>
            <p className="font-display font-extrabold text-2xl md:text-3xl text-white mt-2">{rate}%</p>
          </div>
          <RingProgress value={rate} size={52} stroke={5} textClass="text-white" track="rgba(255,255,255,0.18)" />
        </button>
      </div>
      <StatHistoryModal open={!!modal} onClose={() => setModal(null)} title={modal?.label} tone={modal} tasks={modal?.list || []} />
    </>
  );
}

/* ======================= FILTER BAR ======================= */
function FilterBar({ status, setStatus, priority, setPriority, date, setDate, taskCounts, sortBy, setSortBy, sortDir, setSortDir }) {
  const selCls = "text-sm rounded-xl border border-line bg-white px-3 py-2 text-ink outline-none focus:border-purple";
  return (
    <div className="flex flex-wrap items-center gap-2 mb-5">
      <div className="flex items-center gap-1.5 text-slateText mr-1"><Icon name="layers" size={14} /><span className="text-xs font-semibold uppercase tracking-wide">Filter</span></div>
      <select className={selCls} value={status} onChange={e => setStatus(e.target.value)}>
        <option value="all">All Status</option>
        <option value="pending">Pending</option>
        <option value="completed">Completed</option>
        <option value="rolled">Rolled Over</option>
      </select>
      <select className={selCls} value={priority} onChange={e => setPriority(e.target.value)}>
        <option value="all">All Priority</option>
        <option value="High">High Priority</option>
        <option value="Medium">Medium Priority</option>
        <option value="Low">Low Priority</option>
      </select>
      <div className="flex items-center gap-1">
        <DateSelector value={date} onChange={setDate} taskCounts={taskCounts} placeholder="All Dates" />
        {date && (
          <button onClick={() => setDate(null)} title="Clear date filter" className="p-2 rounded-xl border border-line bg-white text-slateText hover:text-purple hover:border-purpleLight transition-colors">
            <Icon name="x" size={14} />
          </button>
        )}
      </div>
      <div className="flex items-center gap-1.5 text-slateText ml-2 mr-1"><span className="text-xs font-semibold uppercase tracking-wide">Sort</span></div>
      <select className={selCls} value={sortBy} onChange={e => setSortBy(e.target.value)}>
        <option value="date">Due Date</option>
        <option value="priority">Priority</option>
        <option value="created">Created Date</option>
        <option value="status">Status</option>
      </select>
      <button onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')} className="text-sm rounded-xl border border-line bg-white px-3 py-2 text-ink hover:bg-slate-50 flex items-center gap-1">
        <Icon name={sortDir === 'asc' ? 'trend' : 'trend'} size={14} className={sortDir === 'desc' ? 'rotate-180' : ''} />
        {sortDir === 'asc' ? 'Asc' : 'Desc'}
      </button>
    </div>
  );
}
function applyFilterSort(tasks, { status, priority, date, sortBy, sortDir, query }) {
  let out = tasks;
  if (query && query.trim()) {
    const q = query.trim().toLowerCase();
    out = out.filter(t => t.title.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q) || t.category.toLowerCase().includes(q));
  }
  if (status === 'pending') out = out.filter(t => t.status === 'pending');
  else if (status === 'completed') out = out.filter(t => t.status === 'completed');
  else if (status === 'rolled') out = out.filter(t => t.isRolledOver && t.status !== 'completed');
  if (priority !== 'all') out = out.filter(t => t.priority === priority);
  if (date) out = out.filter(t => occursOn(t, date));
  const pWeight = { High: 3, Medium: 2, Low: 1 };
  const sWeight = { pending: 1, 'rolled-over': 1.5, completed: 2 };
  out = [...out].sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'date') cmp = a.currentDate.localeCompare(b.currentDate);
    else if (sortBy === 'priority') cmp = pWeight[a.priority] - pWeight[b.priority];
    else if (sortBy === 'created') cmp = a.createdAt.localeCompare(b.createdAt);
    else if (sortBy === 'status') cmp = (a.status === 'completed' ? 2 : 1) - (b.status === 'completed' ? 2 : 1);
    return sortDir === 'asc' ? cmp : -cmp;
  });
  return out;
}

/* ======================= PAGES ======================= */
// Today's Tasks: intentionally pinned to the real current date (todayKey()) with no way to
// pass in another date — this page must never show any day other than today, by construction
// rather than by convention, so it can't regress even if other pages change their own date logic.
function TodayTasksPage({ tasks, searchQuery, onOpenAdd, ...handlers }) {
  const today = todayKey();
  let dayTasks = tasks.filter(t => occursOn(t, today));
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    dayTasks = dayTasks.filter(t => t.title.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q) || t.category.toLowerCase().includes(q));
  }
  const completed = dayTasks.filter(t => t.status === 'completed');
  const pending = dayTasks.filter(t => t.status !== 'completed');
  const rolled = pending.filter(t => t.isRolledOver);
  const fresh = pending.filter(t => !t.isRolledOver);
  const rate = dayTasks.length ? Math.round((completed.length / dayTasks.length) * 100) : 0;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <p className="text-sm text-slateText">Everything due <span className="font-semibold text-ink">{fmtLong(today)}</span></p>
        <button onClick={() => onOpenAdd(today)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple text-white text-sm font-semibold shadow-card hover:bg-purple/90 transition-colors">
          <Icon name="plus" size={16} /> Add New Task
        </button>
      </div>

      <StatsRow tasks={dayTasks} />

      <div className="bg-white border border-line rounded-2xl p-5 mb-6 shadow-card">
        <div className="flex items-center justify-between mb-2">
          <p className="font-display font-semibold text-ink text-sm">Today's Progress</p>
          <p className="text-sm text-slateText font-medium">{completed.length} of {dayTasks.length} tasks completed</p>
        </div>
        <ProgressBar value={rate} />
      </div>

      {rolled.length > 0 && (
        <div className="flex items-center gap-2 mb-3 text-navy bg-navy/5 border border-navy/10 rounded-xl px-4 py-2.5 text-sm">
          <Icon name="rotate" size={15} /> {rolled.length} rolled-over task{rolled.length > 1 ? 's' : ''} carried into this day, plus {fresh.length} new.
        </div>
      )}

      {dayTasks.length === 0 ? (
        <EmptyState icon="checkSquare" title="Nothing scheduled" subtitle="Add a task for this day to get started." />
      ) : (
        <>
          <TaskListSection title="Rolled Over" tasks={rolled} dayKey={today} {...handlers} />
          <TaskListSection title={rolled.length ? 'New Today' : 'Pending'} tasks={fresh} dayKey={today} {...handlers} />
          <TaskListSection title="Completed" tasks={completed} dayKey={today} {...handlers} />
        </>
      )}
    </div>
  );
}

// Dashboard: unlike Today's Tasks (always the current date), this page scopes to a
// From/To date range the person picks — defaulting to the 1st of the current month
// through today — and shows every task whose current due date falls inside it.
function DashboardPage({ tasks, rangeFrom, rangeTo, setRangeFrom, setRangeTo, taskCounts, searchQuery, onOpenAdd, ...handlers }) {
  const today = todayKey();
  const lo = rangeFrom <= rangeTo ? rangeFrom : rangeTo;
  const hi = rangeFrom <= rangeTo ? rangeTo : rangeFrom;
  let rangeTasks = tasks.filter(t => overlapsRange(t, lo, hi));
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    rangeTasks = rangeTasks.filter(t => t.title.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q) || t.category.toLowerCase().includes(q));
  }
  const completed = rangeTasks.filter(t => t.status === 'completed');
  const pending = rangeTasks.filter(t => t.status !== 'completed');
  const rolled = pending.filter(t => t.isRolledOver);
  const fresh = pending.filter(t => !t.isRolledOver);
  const rate = rangeTasks.length ? Math.round((completed.length / rangeTasks.length) * 100) : 0;
  const isSingleDay = lo === hi;

  const grouped = useMemo(() => {
    const byDate = {};
    // A long task is listed under every day of its run that falls inside the picked range.
    rangeTasks.forEach(t => {
      const from = taskStart(t) > lo ? taskStart(t) : lo;
      const end = effectiveEnd(t);
      const to = end < hi ? end : hi;
      for (let k = from; k <= to; k = addDays(k, 1)) (byDate[k] = byDate[k] || []).push(t);
    });
    return Object.keys(byDate).sort().reverse().map(k => ({ key: k, list: byDate[k] }));
  }, [rangeTasks, lo, hi]);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <DateRangeSelector from={rangeFrom} to={rangeTo} onFromChange={setRangeFrom} onToChange={setRangeTo} taskCounts={taskCounts}
          onResetToMonth={() => { setRangeFrom(firstOfMonthKey(today)); setRangeTo(today); }} />
        <button onClick={() => onOpenAdd(today)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple text-white text-sm font-semibold shadow-card hover:bg-purple/90 transition-colors shrink-0">
          <Icon name="plus" size={16} /> Add New Task
        </button>
      </div>

      <StatsRow tasks={rangeTasks} />

      <div className="bg-white border border-line rounded-2xl p-5 mb-6 shadow-card">
        <div className="flex items-center justify-between mb-2">
          <p className="font-display font-semibold text-ink text-sm">
            {isSingleDay ? (lo === today ? "Today's Progress" : `Progress · ${fmtShort(lo)}`) : `Progress · ${fmtShort(lo)} – ${fmtShort(hi)}`}
          </p>
          <p className="text-sm text-slateText font-medium">{completed.length} of {rangeTasks.length} tasks completed</p>
        </div>
        <ProgressBar value={rate} />
      </div>

      {rolled.length > 0 && (
        <div className="flex items-center gap-2 mb-3 text-navy bg-navy/5 border border-navy/10 rounded-xl px-4 py-2.5 text-sm">
          <Icon name="rotate" size={15} /> {rolled.length} rolled-over task{rolled.length > 1 ? 's' : ''} in range, plus {fresh.length} new.
        </div>
      )}

      {rangeTasks.length === 0 ? (
        <EmptyState icon="checkSquare" title="Nothing in this range" subtitle="Pick a different date range, or add a task to get started." />
      ) : isSingleDay ? (
        <>
          <TaskListSection title="Rolled Over" tasks={rolled} dayKey={today} {...handlers} />
          <TaskListSection title={rolled.length ? 'New Today' : 'Pending'} tasks={fresh} dayKey={today} {...handlers} />
          <TaskListSection title="Completed" tasks={completed} dayKey={today} {...handlers} />
        </>
      ) : (
        grouped.map(g => {
          const gDone = g.list.filter(t => t.status === 'completed').length;
          const gPending = g.list.length - gDone;
          return (
            <div key={g.key} className="mb-6">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-2.5 px-1">
                <p className="font-display font-semibold text-ink">{fmtLong(g.key)}</p>
                <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                  <span className="px-2 py-0.5 rounded-full bg-navy/5 text-navy">{g.list.length} total</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{gDone} completed</span>
                  <span className="px-2 py-0.5 rounded-full bg-purple/10 text-purple">{gPending} pending</span>
                </div>
              </div>
              <div className="space-y-2.5">
                {g.list.map(t => <TaskCard key={t.id} task={t} dayKey={g.key} {...handlers} />)}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function AllTasksPage({ tasks, searchQuery, taskCounts, onOpenAdd, ...handlers }) {
  const [status, setStatus] = useState('all');
  const [priority, setPriority] = useState('all');
  const [date, setDate] = useState(null);
  const [sortBy, setSortBy] = useState('date');
  const [sortDir, setSortDir] = useState('asc');
  const filtered = applyFilterSort(tasks, { status, priority, date, sortBy, sortDir, query: searchQuery });

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-slateText">
          {filtered.length} of {tasks.length} tasks
          {date && <span> · <span className="font-semibold text-ink">{fmtLong(date)}</span></span>}
        </p>
        <button onClick={() => onOpenAdd(date || todayKey())} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple text-white text-sm font-semibold shadow-card hover:bg-purple/90">
          <Icon name="plus" size={16} /> Add New Task
        </button>
      </div>
      <FilterBar {...{ status, setStatus, priority, setPriority, date, setDate, taskCounts, sortBy, setSortBy, sortDir, setSortDir }} />
      {filtered.length === 0 ? (
        <EmptyState icon="search" title="No tasks match" subtitle={date ? `Nothing scheduled for ${fmtLong(date)}. Try another date or add a task.` : "Try adjusting your filters or search."} />
      ) : (
        <div className="space-y-2.5">{filtered.map(t => <TaskCard key={t.id} task={t} {...handlers} />)}</div>
      )}
    </div>
  );
}

function CalendarPage({ tasks, taskCounts, onOpenAdd, ...handlers }) {
  const base = new Date();
  const [vy, setVy] = useState(base.getFullYear());
  const [vm, setVm] = useState(base.getMonth());
  const [selected, setSelected] = useState(todayKey());
  const today = todayKey();
  const first = new Date(vy, vm, 1);
  const startWd = first.getDay();
  const daysInMonth = new Date(vy, vm + 1, 0).getDate();
  const cells = [...Array(startWd).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const goPrev = () => vm === 0 ? (setVm(11), setVy(y => y - 1)) : setVm(m => m - 1);
  const goNext = () => vm === 11 ? (setVm(0), setVy(y => y + 1)) : setVm(m => m + 1);

  const dayStats = key => {
    const list = tasks.filter(t => occursOn(t, key));
    const done = list.filter(t => t.status === 'completed').length;
    return { total: list.length, done, pending: list.length - done };
  };
  const selectedTasks = tasks.filter(t => occursOn(t, selected));

  return (
    <div>
      <div className="bg-white border border-line rounded-2xl p-4 md:p-6 shadow-card mb-6">
        <div className="flex items-center justify-between mb-5 gap-2">
          <button onClick={goPrev} className="p-2 rounded-lg hover:bg-slate-100 text-slateText shrink-0"><Icon name="chevronLeft" size={18} /></button>
          <MonthYearJump vy={vy} vm={vm} setVy={setVy} setVm={setVm} size="lg" />
          <button onClick={goNext} className="p-2 rounded-lg hover:bg-slate-100 text-slateText shrink-0"><Icon name="chevronRight" size={18} /></button>
        </div>
        <div className="grid grid-cols-7 mb-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
            <div key={i} className="text-center text-[11px] font-semibold text-slate-400 py-2">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 md:gap-1.5">
          {cells.map((d, i) => {
            if (d === null) return <div key={i} />;
            const key = `${vy}-${pad(vm + 1)}-${pad(d)}`;
            const isToday = key === today, isSel = key === selected;
            const { total, done, pending } = dayStats(key);
            return (
              <button key={i} onClick={() => setSelected(key)}
                className={`relative rounded-xl p-1.5 md:p-2 h-16 md:h-20 flex flex-col items-start text-left transition-colors border
                ${isSel ? 'bg-purple border-purple text-white' : isToday ? 'bg-purpleLight/10 border-purpleLight/40' : 'bg-white border-line hover:border-purpleLight'}`}>
                <span className={`text-xs md:text-sm font-semibold ${isSel ? 'text-white' : isToday ? 'text-purple' : 'text-ink'}`}>{d}</span>
                {total > 0 && (
                  <div className="mt-auto w-full">
                    <span className={`block text-[10px] md:text-[11px] font-medium ${isSel ? 'text-white/90' : 'text-slateText'}`}>{total} task{total > 1 ? 's' : ''}</span>
                    <div className="flex gap-1 mt-0.5">
                      {done > 0 && <span className={`text-[9px] md:text-[10px] px-1 rounded ${isSel ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'}`}>{done} done</span>}
                      {pending > 0 && <span className={`text-[9px] md:text-[10px] px-1 rounded ${isSel ? 'bg-white/20 text-white' : 'bg-purple/10 text-purple'}`}>{pending} left</span>}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-bold text-ink">{fmtLong(selected)}</h3>
        <button onClick={() => onOpenAdd(selected)} className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-purple text-white text-sm font-semibold shadow-card hover:bg-purple/90">
          <Icon name="plus" size={15} /> Add Task
        </button>
      </div>
      {selectedTasks.length === 0 ? (
        <EmptyState icon="calendar" title="No tasks this day" subtitle="Add one, or pick another date on the calendar." />
      ) : (
        <div className="space-y-2.5">{selectedTasks.map(t => <TaskCard key={t.id} task={t} dayKey={selected} {...handlers} />)}</div>
      )}
    </div>
  );
}

function CompletedPage({ tasks, searchQuery, ...handlers }) {
  const [priority, setPriority] = useState('all');
  const [category, setCategory] = useState('all');
  let completed = tasks.filter(t => t.status === 'completed');
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    completed = completed.filter(t => t.title.toLowerCase().includes(q) || t.category.toLowerCase().includes(q));
  }
  if (priority !== 'all') completed = completed.filter(t => t.priority === priority);
  if (category !== 'all') completed = completed.filter(t => t.category === category);
  completed = [...completed].sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''));

  const selCls = "text-sm rounded-xl border border-line bg-white px-3 py-2 text-ink outline-none focus:border-purple";
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <p className="text-sm text-slateText mr-auto">{completed.length} completed task{completed.length !== 1 ? 's' : ''}</p>
        <select className={selCls} value={priority} onChange={e => setPriority(e.target.value)}>
          <option value="all">All Priority</option>
          {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className={selCls} value={category} onChange={e => setCategory(e.target.value)}>
          <option value="all">All Category</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      {completed.length === 0 ? (
        <EmptyState icon="checkCircle" title="No completed tasks yet" subtitle="Finished tasks will show up here with their completion date." />
      ) : (
        <div className="bg-white border border-line rounded-2xl overflow-hidden shadow-card">
          <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_0.7fr] gap-2 px-5 py-3 bg-bg text-[11px] font-semibold uppercase tracking-wide text-slateText border-b border-line">
            <span>Task</span><span>Original Date</span><span>Completed</span><span>Category</span><span>Priority</span><span>Rollovers</span>
          </div>
          {completed.map(t => (
            <div key={t.id} onClick={() => handlers.onOpen(t)} className="grid grid-cols-2 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_0.7fr] gap-2 px-5 py-3.5 border-b border-line last:border-0 hover:bg-slate-50 cursor-pointer text-sm">
              <span className="col-span-2 md:col-span-1 font-medium text-ink truncate">{t.title}</span>
              <span className="text-slateText hidden md:block">{fmtShort(t.originalDate)}</span>
              <span className="text-slateText hidden md:block">{t.completedAt ? fmtShort(toKey(new Date(t.completedAt))) : '—'}</span>
              <span className="hidden md:block"><CategoryBadge category={t.category} /></span>
              <span className="hidden md:block"><PriorityBadge priority={t.priority} /></span>
              <span className="text-slateText hidden md:block">{t.rolloverCount}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PendingPage({ tasks, searchQuery, ...handlers }) {
  const today = todayKey();
  let pending = tasks.filter(t => t.status !== 'completed');
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    pending = pending.filter(t => t.title.toLowerCase().includes(q) || t.category.toLowerCase().includes(q));
  }
  const overdue = pending.filter(t => t.isRolledOver && occursOn(t, today));
  const todays = pending.filter(t => !t.isRolledOver && occursOn(t, today));
  const future = pending.filter(t => taskStart(t) > today);

  return (
    <div>
      <p className="text-sm text-slateText mb-5">{pending.length} pending task{pending.length !== 1 ? 's' : ''} across {new Set(pending.map(t => t.currentDate)).size} day(s)</p>
      {pending.length === 0 ? (
        <EmptyState icon="checkCircle" title="Inbox zero" subtitle="No pending tasks — nice work." />
      ) : (
        <>
          <TaskListSection title="Overdue / Rolled Over" tasks={overdue} dayKey={today} {...handlers} />
          <TaskListSection title="Today" tasks={todays} dayKey={today} {...handlers} />
          <TaskListSection title="Scheduled for the Future" tasks={future} {...handlers} />
        </>
      )}
    </div>
  );
}

function ProfileCard({ user, onUpdateUser }) {
  const fileRef = useRef(null);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [about, setAbout] = useState(user.about || '');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);

  const pickPhoto = () => fileRef.current && fileRef.current.click();
  const onPhoto = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Choose an image file for your photo.'); return; }
    setUploading(true); setError('');
    try {
      const dataUrl = await resizeImageFile(file, 240);
      await onUpdateUser({ avatar: dataUrl });
    } catch (err) { setError(err && err.message && !/image|file/i.test(err.message) ? friendlyError(err) : 'Could not process that photo — try a different file.'); }
    setUploading(false);
  };
  const removePhoto = () => { onUpdateUser({ avatar: null }).catch(err => setError(friendlyError(err))); };
  const [savedMsg, setSavedMsg] = useState('Profile saved.');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setError(''); setSaved(false);
    if (!name.trim() || !email.trim()) { setError('Name and email can\'t be empty.'); return; }
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) { setError('Enter a valid email address.'); return; }
    setSaving(true);
    try {
      const res = await onUpdateUser({ name: name.trim(), email: cleanEmail, about: about.trim() });
      setSavedMsg((res && res.message) || 'Profile saved.');
      setSaved(true);
    } catch (err) { setError(friendlyError(err)); }
    setSaving(false);
  };

  return (
    <div className="bg-white border border-line rounded-2xl p-5 shadow-card">
      <h3 className="font-display font-semibold text-ink mb-4">My Profile</h3>
      <div className="flex items-center gap-4 mb-5">
        <Avatar user={user} size={64} ring />
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button onClick={pickPhoto} disabled={uploading} className="text-sm font-medium px-3.5 py-2 rounded-xl bg-purple text-white hover:bg-purple/90 disabled:opacity-60">
              {uploading ? 'Uploading…' : 'Upload Photo'}
            </button>
            {user.avatar && (
              <button onClick={removePhoto} className="text-sm font-medium px-3.5 py-2 rounded-xl border border-line text-ink hover:bg-slate-50">Remove</button>
            )}
          </div>
          <p className="text-[11px] text-slateText">JPG or PNG, resized automatically to keep things fast.</p>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhoto} />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        <Field label="Full Name"><input className={inputCls} value={name} onChange={e => setName(e.target.value)} /></Field>
        <Field label="Email"><input type="email" className={inputCls} value={email} onChange={e => setEmail(e.target.value)} /></Field>
      </div>
      <Field label="About (optional)">
        <textarea className={inputCls} rows={2} placeholder="Role, team, or a short note about you…" value={about} onChange={e => setAbout(e.target.value)} />
      </Field>
      {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
      {saved && !error && <p className="text-sm text-emerald-600 mt-3">{savedMsg}</p>}
      <button onClick={save} disabled={saving} className="mt-4 px-4 py-2.5 rounded-xl bg-purple text-white text-sm font-semibold hover:bg-purple/90 shadow-card disabled:opacity-60">{saving ? 'Saving…' : 'Save Profile'}</button>
    </div>
  );
}

function ChangePasswordCard({ user, onChangePassword }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const [busy, setBusy] = useState(false);
  const save = async () => {
    setError(''); setSaved(false);
    if (!current) { setError('Enter your current password.'); return; }
    if (next.length < 8) { setError('New password should be at least 8 characters.'); return; }
    if (next !== confirm) { setError('New passwords do not match.'); return; }
    if (next === current) { setError('New password must be different from the current one.'); return; }
    setBusy(true);
    try {
      await onChangePassword(current, next);
      setCurrent(''); setNext(''); setConfirm(''); setSaved(true);
    } catch (err) { setError(friendlyError(err)); }
    setBusy(false);
  };

  return (
    <div className="bg-white border border-line rounded-2xl p-5 shadow-card">
      <h3 className="font-display font-semibold text-ink mb-1">Change Password</h3>
      <p className="text-sm text-slateText mb-4">Choose a new password for your account.</p>
      <div className="space-y-3 max-w-sm">
        <Field label="Current Password"><input type="password" className={inputCls} value={current} onChange={e => setCurrent(e.target.value)} placeholder="••••••••" /></Field>
        <Field label="New Password"><input type="password" className={inputCls} value={next} onChange={e => setNext(e.target.value)} placeholder="••••••••" /></Field>
        <Field label="Confirm New Password"><input type="password" className={inputCls} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••" /></Field>
      </div>
      {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
      {saved && !error && <p className="text-sm text-emerald-600 mt-3">Password updated.</p>}
      <button onClick={save} disabled={busy} className="mt-4 px-4 py-2.5 rounded-xl bg-purple text-white text-sm font-semibold hover:bg-purple/90 shadow-card disabled:opacity-60">{busy ? 'Updating…' : 'Update Password'}</button>
    </div>
  );
}

// On-Time vs Late performance bar for the Summary page. "On-time" = completed without ever
// being rolled over; "Late" = completed but only after carrying over from an earlier day.
// It's part of the same card that downloads with the PDF, so the breakdown travels with it.
function OnTimeLateBar({ completed, onTime, late }) {
  const onTimePct = completed ? Math.round((onTime / completed) * 100) : 0;
  const latePct = completed ? 100 - onTimePct : 0;
  return (
    <div className="bg-white border border-line rounded-2xl p-5 shadow-card mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display font-semibold text-ink">On-Time vs Late Completion</h3>
        {completed > 0 && <p className="text-xs text-slateText">{completed} completed task{completed !== 1 ? 's' : ''} in range</p>}
      </div>
      {completed === 0 ? (
        <p className="text-sm text-slateText">No completed tasks in this range yet — this chart fills in once tasks are done.</p>
      ) : (
        <>
          <div className="w-full h-4 rounded-full bg-slate-100 overflow-hidden flex">
            {onTime > 0 && <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${onTimePct}%` }} />}
            {late > 0 && <div className="h-full bg-rose-500 transition-all duration-500" style={{ width: `${latePct}%` }} />}
          </div>
          <div className="flex items-center gap-5 mt-3 text-sm">
            <span className="flex items-center gap-1.5 text-ink"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />On-Time <span className="font-semibold">{onTimePct}%</span> <span className="text-slateText">({onTime})</span></span>
            <span className="flex items-center gap-1.5 text-ink"><span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />Late <span className="font-semibold">{latePct}%</span> <span className="text-slateText">({late})</span></span>
          </div>
        </>
      )}
    </div>
  );
}
function SummaryPage({ tasks, user }) {
  const [from, setFrom] = useState(firstOfMonthKey(todayKey()));
  const [to, setTo] = useState(todayKey());
  const [includePersonal, setIncludePersonal] = useState(false);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);
  const summary = useMemo(() => buildSummaryRange(tasks, from, to), [tasks, from, to]);
  const pdfSummary = useMemo(() => {
    const pdfTasks = includePersonal ? tasks : tasks.filter(t => t.category !== 'Personal');
    return buildSummaryRange(pdfTasks, from, to);
  }, [tasks, from, to, includePersonal]);

  const generate = async () => {
    setError('');
    setGenerating(true);
    try {
      await downloadSummaryPdf({ user, from, to, ...pdfSummary });
    } catch (e) {
      setError('Could not generate the PDF — check your internet connection and try again.');
    }
    setGenerating(false);
  };

  return (
    <div>
      <div className="bg-white border border-line rounded-2xl p-5 shadow-card mb-6">
        <h3 className="font-display font-semibold text-ink mb-1">Task Summary</h3>
        <p className="text-sm text-slateText mb-4">Pick a date range to see everything you worked on, then download it as a PDF.</p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-semibold text-slateText mb-1.5">From</label>
            <DateSelector value={from} onChange={setFrom} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slateText mb-1.5">To</label>
            <DateSelector value={to} onChange={setTo} />
          </div>
          <button onClick={generate} disabled={generating} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple text-white text-sm font-semibold hover:bg-purple/90 shadow-card disabled:opacity-60 transition-colors">
            <Icon name="download" size={15} /> {generating ? 'Preparing…' : 'Download PDF'}
          </button>
        </div>
        <label className="flex items-center gap-2 mt-4 text-sm text-slateText cursor-pointer select-none">
          <input type="checkbox" checked={includePersonal} onChange={e => setIncludePersonal(e.target.checked)}
            className="w-4 h-4 rounded border-line text-purple focus:ring-purple" />
          Include Personal tasks in the downloaded PDF
        </label>
        {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
      </div>

      <StatsRow tasks={Object.values(summary.byDate).flat()} />

      <OnTimeLateBar completed={summary.completed} onTime={summary.onTime} late={summary.late} />

      {summary.dates.length === 0 ? (
        <EmptyState icon="fileText" title="Nothing in this range" subtitle="Pick a different date range to see a summary of your tasks." />
      ) : (
        [...summary.dates].reverse().map(dateKey => (
          <div key={dateKey} className="mb-6">
            <p className="font-display font-semibold text-ink mb-2.5 px-1">{fmtLong(dateKey)}</p>
            <div className="bg-white border border-line rounded-2xl overflow-hidden shadow-card">
              <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr] gap-2 px-5 py-3 bg-bg text-[11px] font-semibold uppercase tracking-wide text-slateText border-b border-line">
                <span>Task</span><span>Category</span><span>Priority</span><span>Status</span>
              </div>
              {summary.byDate[dateKey].map(t => (
                <div key={t.id} className="grid grid-cols-2 md:grid-cols-[2fr_1fr_1fr_1fr] gap-2 px-5 py-3 border-b border-line last:border-0 text-sm items-center">
                  <span className="col-span-2 md:col-span-1 font-medium text-ink truncate">{t.title}</span>
                  <span className="hidden md:block"><CategoryBadge category={t.category} /></span>
                  <span className="hidden md:block"><PriorityBadge priority={t.priority} /></span>
                  <span className={`text-xs font-semibold ${t.status === 'completed' ? 'text-emerald-600' : t.isRolledOver ? 'text-navy' : 'text-slateText'}`}>{statusLabel(t)}</span>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function SettingsPage({ tasks, onClearAll, user, onLogout, onUpdateUser, onChangePassword }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const total = tasks.length;
  const completed = tasks.filter(t => t.status === 'completed').length;
  return (
    <div className="max-w-2xl space-y-5">
      <ProfileCard user={user} onUpdateUser={onUpdateUser} />
      <ChangePasswordCard user={user} onChangePassword={onChangePassword} />
      <div className="bg-white border border-line rounded-2xl p-5 shadow-card">
        <h3 className="font-display font-semibold text-ink mb-1">Appearance</h3>
        <p className="text-sm text-slateText mb-4">Task Management uses a fixed Royal Navy &amp; Purple identity for a consistent, professional look.</p>
        <div className="flex gap-3">
          {[{ c: '#0B1F3A', l: 'Navy' }, { c: '#7C3AED', l: 'Purple' }, { c: '#A78BFA', l: 'Light Purple' }, { c: '#F8FAFC', l: 'Background' }].map(s => (
            <div key={s.l} className="flex flex-col items-center gap-1.5">
              <div className="w-10 h-10 rounded-xl border border-line" style={{ background: s.c }} />
              <span className="text-[11px] text-slateText">{s.l}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-white border border-line rounded-2xl p-5 shadow-card">
        <h3 className="font-display font-semibold text-ink mb-1">Your Data</h3>
        <p className="text-sm text-slateText mb-4">{total} tasks saved to your account · {completed} completed. Everything syncs securely across all your devices.</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setConfirmOpen(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50">
            <Icon name="trash" size={15} /> Clear All Data
          </button>
          <button onClick={onLogout} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-line text-ink text-sm font-medium hover:bg-slate-50">
            <Icon name="arrowRight" size={15} /> Log Out
          </button>
        </div>
      </div>
      <div className="bg-white border border-line rounded-2xl p-5 shadow-card">
        <img src={LOGO_MAIN} alt="Task Management logo" className="w-40 mb-4 select-none pointer-events-none" draggable="false" />
        <h3 className="font-display font-semibold text-ink mb-1">About</h3>
        <p className="text-sm text-slateText leading-relaxed">Task Management automatically carries unfinished tasks forward to the next day, so nothing quietly falls through the cracks. Tasks you schedule for a future date stay put until that day arrives.</p>
      </div>
      <ConfirmDialog open={confirmOpen} title="Clear all data?" message="This permanently deletes every task in your account, on every device. This can't be undone."
        confirmLabel="Delete Everything" danger onCancel={() => setConfirmOpen(false)} onConfirm={() => { onClearAll(); setConfirmOpen(false); }} />
    </div>
  );
}

/* ======================= UNDO / REDO =======================
   Wraps the task list in an undo stack so a mis-click (ticking the wrong task
   done, deleting one, moving a date) can be taken back with Ctrl+Z / Ctrl+Y.
   Every deliberate edit pushes the previous list onto `past`; the automatic
   midnight rollover uses setTasksSilently so it never lands in the history. */
const UNDO_LIMIT = 50;
function useUndoableTasks(initial) {
  // One reducer holds present/past/future together, so a history entry can never
  // drift out of step with the list it describes.
  const [state, dispatch] = React.useReducer((st, action) => {
    switch (action.type) {
      case 'set': {
        const next = typeof action.updater === 'function' ? action.updater(st.present) : action.updater;
        if (next === st.present) return st;
        // Each past entry carries the label of the action that moved us off it,
        // so undoing three steps back still names the right change.
        return {
          present: next,
          past: [...st.past, { tasks: st.present, label: action.label || 'Change' }].slice(-UNDO_LIMIT),
          future: [],
        };
      }
      case 'setSilent': {
        const next = typeof action.updater === 'function' ? action.updater(st.present) : action.updater;
        return next === st.present ? st : { ...st, present: next };
      }
      case 'undo': {
        if (!st.past.length) return st;
        const step = st.past[st.past.length - 1];
        return {
          present: step.tasks,
          past: st.past.slice(0, -1),
          future: [{ tasks: st.present, label: step.label }, ...st.future].slice(0, UNDO_LIMIT),
        };
      }
      case 'redo': {
        if (!st.future.length) return st;
        const step = st.future[0];
        return {
          present: step.tasks,
          past: [...st.past, { tasks: st.present, label: step.label }].slice(-UNDO_LIMIT),
          future: st.future.slice(1),
        };
      }
      case 'reset':
        return { present: st.present, past: [], future: [] };
      default:
        return st;
    }
  }, undefined, () => ({
    present: typeof initial === 'function' ? initial() : initial,
    past: [], future: [],
  }));

  const setTasks = useCallback((updater, label) => dispatch({ type: 'set', updater, label }), []);
  // For changes the person didn't make themselves (rollover) — no history entry.
  const setTasksSilently = useCallback(updater => dispatch({ type: 'setSilent', updater }), []);
  const resetHistory = useCallback(() => dispatch({ type: 'reset' }), []);
  const undo = useCallback(() => dispatch({ type: 'undo' }), []);
  const redo = useCallback(() => dispatch({ type: 'redo' }), []);

  return { tasks: state.present, setTasks, setTasksSilently, undo, redo, resetHistory,
    canUndo: state.past.length > 0, canRedo: state.future.length > 0,
    // What the next undo / redo would take back, for the toast wording.
    undoLabel: state.past.length ? state.past[state.past.length - 1].label : null,
    redoLabel: state.future.length ? state.future[0].label : null };
}

// Small toast that confirms an undo/redo happened, so the change isn't silent.
function UndoToast({ message, onDismiss }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDismiss, 2600);
    return () => clearTimeout(t);
  }, [message, onDismiss]);
  if (!message) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] animate-pop">
      <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-navy text-white shadow-pop">
        <Icon name="rotate" size={16} className="shrink-0" />
        <span className="text-sm font-medium">{message}</span>
      </div>
    </div>
  );
}

/* ======================= APP ======================= */
function Workspace({ user, onLogout, onUpdateUser, onChangePassword, store, remote, initialTasks, initialNotes, syncState }) {
  const { tasks, setTasks, setTasksSilently, undo, redo, resetHistory, canUndo, canRedo, undoLabel, redoLabel } = useUndoableTasks(() => {
    const { tasks: rolled } = runRollover(initialTasks, user.id);
    return rolled;
  });
  // Another of this person's devices changed something: take it in without an undo entry.
  useEffect(() => {
    remote.tasks = (fresh) => setTasksSilently(prev => {
      const { tasks: rolled } = runRollover(fresh, user.id, true);
      return rolled;
    });
    return () => { remote.tasks = null; };
  }, [remote, setTasksSilently, user.id]);
  const [toast, setToast] = useState(null);
  const [view, setView] = useState('dashboard');
  const [dashRangeFrom, setDashRangeFrom] = useState(() => firstOfMonthKey(todayKey()));
  const [dashRangeTo, setDashRangeTo] = useState(() => todayKey());
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [reminders, setReminders] = useState([]);

  const [addOpen, setAddOpen] = useState(false);
  const [addDefaultDate, setAddDefaultDate] = useState(todayKey());
  const [editingTask, setEditingTask] = useState(null);
  const [viewingTask, setViewingTask] = useState(null);
  const [dateChangeTask, setDateChangeTask] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // periodic re-check in case app is left open across midnight
  useEffect(() => {
    const iv = setInterval(() => {
      setTasksSilently(prev => {
        const { tasks: rolled, changed } = runRollover(prev, user.id);
        return changed ? rolled : prev;
      });
    }, 60000);
    return () => clearInterval(iv);
  }, [user.id]);

  useEffect(() => { store.persist('tasks', tasks); }, [tasks, store]);

  // ask permission once, then poll for tasks whose due time is coming up in the next 15 minutes
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);
  useEffect(() => {
    const check = () => {
      const notified = loadNotified(user.id);
      const today = todayKey();
      const now = new Date();
      let changed = false;
      const fresh = [];
      tasks.forEach(t => {
        if (t.status === 'completed' || !t.dueTime || !occursOn(t, today) || notified.has(t.id)) return;
        const [h, m] = t.dueTime.split(':').map(Number);
        const due = new Date(); due.setHours(h, m, 0, 0);
        const minutesUntil = (due - now) / 60000;
        if (minutesUntil <= 15 && minutesUntil > -1) {
          notified.add(t.id); changed = true;
          const text = `"${t.title}" is due at ${fmtTime(t.dueTime)}.`;
          fresh.push({ id: t.id, text });
          if ('Notification' in window && Notification.permission === 'granted') {
            try { new Notification('Task due soon', { body: text }); } catch (e) {}
          }
        }
      });
      if (changed) saveNotified(user.id, notified);
      if (fresh.length) setReminders(prev => [...fresh, ...prev].slice(0, 20));
    };
    check();
    const iv = setInterval(check, 30000);
    return () => clearInterval(iv);
  }, [tasks, user.id]);

  const taskCounts = useMemo(() => {
    const map = {};
    // Long tasks put a dot on every day of their run, not only the start day.
    tasks.forEach(t => {
      const end = effectiveEnd(t);
      for (let k = taskStart(t); k <= end; k = addDays(k, 1)) map[k] = (map[k] || 0) + 1;
    });
    return map;
  }, [tasks]);

  const openAdd = (date) => { setAddDefaultDate(date || todayKey()); setEditingTask(null); setAddOpen(true); };
  const openEdit = (task) => { setEditingTask(task); setViewingTask(null); setAddOpen(true); };
  const openDetails = (task) => setViewingTask(task);

  const submitTaskForm = (data) => {
    if (editingTask) {
      setTasks(prev => prev.map(t => t.id === editingTask.id ? {
        ...t, title: data.title, description: data.description, category: data.category,
        priority: data.priority, estimatedTime: data.estimatedTime, dueTime: data.dueTime, currentDate: data.date,
        isRange: !!data.isRange, endDate: data.endDate || null,
        originalDate: data.date < t.originalDate ? data.date : t.originalDate, attachment: data.attachment || null,
      } : t), 'Edit task');
    } else {
      setTasks(prev => [...prev, makeTask({ title: data.title, description: data.description, category: data.category, priority: data.priority, estimatedTime: data.estimatedTime, dueTime: data.dueTime, date: data.date, isRange: !!data.isRange, endDate: data.endDate || null, attachment: data.attachment || null })], 'Add task');
    }
    setAddOpen(false); setEditingTask(null);
  };

  const toggleComplete = (id) => {
    const target = tasks.find(t => t.id === id);
    const label = target && target.status === 'completed' ? 'Mark as pending' : 'Mark as done';
    setTasks(prev => prev.map(t => t.id === id ? (
      t.status === 'completed'
        ? { ...t, status: 'pending', completedAt: null }
        : { ...t, status: 'completed', completedAt: new Date().toISOString() }
    ) : t), label);
    setViewingTask(v => v && v.id === id ? { ...v, status: v.status === 'completed' ? 'pending' : 'completed' } : v);
  };
  const requestDelete = (task) => setDeleteTarget(task);
  const confirmDelete = () => {
    setTasks(prev => prev.filter(t => t.id !== deleteTarget.id), 'Delete task');
    setDeleteTarget(null); setViewingTask(null);
  };
  const changeDate = (id, newDate) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== id) return t;
      const span = taskSpan(t) - 1;
      return { ...t, currentDate: newDate, endDate: span > 0 ? addDays(newDate, span) : t.endDate, isRolledOver: false };
    }), 'Change date');
    setDateChangeTask(null); setViewingTask(null);
  };
  const clearAll = () => {
    safeSet(notifiedKey(user.id), '');
    const seeded = seedTasks(); setTasksSilently(seeded); resetHistory(); setReminders([]);
  };

  // Undo/redo: the toast reports what was taken back, and any open modal closes so the
  // person sees the restored list rather than a stale dialog.
  const doUndo = useCallback(() => {
    if (!canUndo) { setToast('Nothing to undo'); return; }
    undo();
    setViewingTask(null); setDateChangeTask(null); setDeleteTarget(null);
    setToast(undoLabel ? `Undid: ${undoLabel}` : 'Undid last change');
  }, [undo, canUndo, undoLabel]);

  const doRedo = useCallback(() => {
    if (!canRedo) { setToast('Nothing to redo'); return; }
    redo();
    setViewingTask(null); setDateChangeTask(null); setDeleteTarget(null);
    setToast(redoLabel ? `Redid: ${redoLabel}` : 'Redid last change');
  }, [redo, canRedo, redoLabel]);

  // Ctrl+Z / Cmd+Z to undo, Ctrl+Y or Ctrl+Shift+Z to redo — ignored while typing in a field.
  useEffect(() => {
    const onKey = (e) => {
      const el = e.target;
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
      if (typing) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); doUndo(); }
      else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); doRedo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doUndo, doRedo]);

  const handlers = { onToggle: toggleComplete, onEdit: openEdit, onDelete: requestDelete, onOpen: openDetails };

  return (
    <div className="flex h-screen overflow-hidden bg-bg font-body">
      <Sidebar view={view} setView={setView} collapsed={collapsed} setCollapsed={setCollapsed} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} user={user} onLogout={onLogout} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header view={view} onOpenMobile={() => setMobileOpen(true)} searchQuery={searchQuery} setSearchQuery={setSearchQuery} tasks={tasks} reminders={reminders} user={user} onGoSettings={() => setView('settings')}
          onUndo={doUndo} onRedo={doRedo} canUndo={canUndo} canRedo={canRedo} undoLabel={undoLabel} redoLabel={redoLabel} syncState={syncState} />
        <main key={view} className="app-scroll tm-page flex-1 overflow-y-auto px-4 md:px-8 py-6">
          {view === 'dashboard' && (
            <DashboardPage tasks={tasks} rangeFrom={dashRangeFrom} rangeTo={dashRangeTo}
              setRangeFrom={setDashRangeFrom} setRangeTo={setDashRangeTo}
              taskCounts={taskCounts} searchQuery={searchQuery} onOpenAdd={openAdd} {...handlers} />
          )}
          {view === 'today' && (
            <TodayTasksPage tasks={tasks} searchQuery={searchQuery} onOpenAdd={openAdd} {...handlers} />
          )}
          {view === 'all' && <AllTasksPage tasks={tasks} searchQuery={searchQuery} taskCounts={taskCounts} onOpenAdd={openAdd} {...handlers} />}
          {view === 'calendar' && <CalendarPage tasks={tasks} taskCounts={taskCounts} onOpenAdd={openAdd} {...handlers} />}
          {view === 'completed' && <CompletedPage tasks={tasks} searchQuery={searchQuery} {...handlers} />}
          {view === 'pending' && <PendingPage tasks={tasks} searchQuery={searchQuery} {...handlers} />}
          {view === 'notes' && <NotesPage user={user} store={store} remote={remote} initial={initialNotes} />}
          {view === 'summary' && <SummaryPage tasks={tasks} user={user} />}
          {view === 'settings' && <SettingsPage tasks={tasks} onClearAll={clearAll} user={user} onLogout={onLogout} onUpdateUser={onUpdateUser} onChangePassword={onChangePassword} />}
        </main>
      </div>

      <TaskFormModal open={addOpen} onClose={() => { setAddOpen(false); setEditingTask(null); }} onSubmit={submitTaskForm}
        initial={editingTask} defaultDate={addDefaultDate} taskCounts={taskCounts} />
      <TaskDetailsModal open={!!viewingTask} onClose={() => setViewingTask(null)} task={viewingTask}
        onToggle={toggleComplete} onEdit={openEdit} onDelete={requestDelete} onChangeDate={(t) => setDateChangeTask(t)} />
      <ChangeDateModal open={!!dateChangeTask} onClose={() => setDateChangeTask(null)} task={dateChangeTask} onConfirm={changeDate} taskCounts={taskCounts} />
      <ConfirmDialog open={!!deleteTarget} title="Delete this task?" message={deleteTarget ? `"${deleteTarget.title}" will be permanently removed.` : ''}
        confirmLabel="Delete" danger onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete} />
      <UndoToast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

/* ======================= NOTES (reusable checklists) =======================
   Storage key is versioned as v2: an earlier, unrelated "Notes" feature (flat
   notes with tags/templates) used the v1 key, and its data shape is
   incompatible with the Category -> Task -> ChecklistItem structure here. */

function makeChecklistItem(text) {
  return { id: uid(), text, completed: false };
}
function makeNoteTask(categoryId, title, items = []) {
  const now = new Date().toISOString();
  return { id: uid(), categoryId, title, kind: 'checklist', description: '', createdAt: now, updatedAt: now, items };
}
function makeNoteText(categoryId, title, description = '') {
  const now = new Date().toISOString();
  return { id: uid(), categoryId, title, kind: 'text', description, createdAt: now, updatedAt: now, items: [] };
}
function makeNoteCategory(name) {
  return { id: uid(), name, createdAt: new Date().toISOString(), tasks: [] };
}
function sanitizeNoteCategories(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter(c => c && typeof c === 'object' && typeof c.id === 'string' && typeof c.name === 'string').map(c => ({
    ...c,
    tasks: Array.isArray(c.tasks) ? c.tasks.filter(t => t && typeof t === 'object' && typeof t.id === 'string').map(t => ({
      ...t,
      kind: t.kind === 'text' ? 'text' : 'checklist',
      description: typeof t.description === 'string' ? t.description : '',
      items: Array.isArray(t.items) ? t.items.filter(i => i && typeof i === 'object' && typeof i.id === 'string') : [],
    })) : [],
  }));
}
function ChecklistRow({ item, onToggle, onEdit, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.text);
  const commit = () => {
    const v = draft.trim();
    if (v) onEdit(v);
    setEditing(false);
  };
  return (
    <div className="group flex items-center gap-2.5 py-1.5 animate-fade">
      <button onClick={onToggle}
        className={`shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-150
          ${item.completed ? 'bg-purple border-purple text-white animate-check' : 'border-line text-transparent hover:border-purple hover:scale-110'}`}>
        <Icon name="checkSquare" size={11} />
      </button>
      {editing ? (
        <input autoFocus value={draft} onChange={e => setDraft(e.target.value)}
          onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(item.text); setEditing(false); } }}
          className="flex-1 text-sm px-2 py-1 rounded-lg border border-purple outline-none animate-pop" />
      ) : (
        <span onClick={() => setEditing(true)}
          className={`flex-1 text-sm cursor-text transition-colors ${item.completed ? 'line-through text-slate-400' : 'text-ink'}`}>{item.text}</span>
      )}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button onClick={() => setEditing(true)} aria-label="Edit" title="Edit"
          className="p-1 rounded-md text-slate-300 hover:text-purple hover:bg-purple/10 transition-colors">
          <Icon name="edit" size={13} />
        </button>
        <button onClick={onDelete} aria-label="Delete" title="Delete"
          className="p-1 rounded-md text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors">
          <Icon name="x" size={14} />
        </button>
      </div>
    </div>
  );
}

function NoteTaskCard({ task, onRename, onDelete, onDuplicate, onAddItem, onToggleItem, onEditItem, onDeleteItem, autoFocusItems }) {
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [newItem, setNewItem] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const itemInputRef = useRef(null);
  const hasTitle = !!(task.title && task.title.trim());

  useEffect(() => {
    if (autoFocusItems && itemInputRef.current) itemInputRef.current.focus();
  }, []);

  const commitTitle = () => {
    const v = titleDraft.trim();
    if (v) onRename(v);
    else setTitleDraft(task.title);
    setTitleEditing(false);
  };
  const addItem = () => {
    const v = newItem.trim();
    if (!v) return;
    onAddItem(v);
    setNewItem('');
  };
  const done = task.items.filter(i => i.completed).length;

  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-card animate-pop transition-all duration-200 hover:shadow-pop hover:-translate-y-0.5">
      <div className="flex items-center justify-between gap-2 mb-3">
        {titleEditing ? (
          <input autoFocus value={titleDraft} onChange={e => setTitleDraft(e.target.value)}
            onBlur={commitTitle} onKeyDown={e => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') { setTitleDraft(task.title); setTitleEditing(false); } }}
            placeholder="Checklist" className="flex-1 font-display font-semibold text-[15px] px-2 py-1 rounded-lg border border-purple outline-none animate-pop" />
        ) : (
          <h3 onClick={() => setTitleEditing(true)}
            className={`font-display font-semibold text-[15px] cursor-text ${hasTitle ? 'text-ink' : 'text-slateText italic font-medium'}`}>
            {hasTitle ? task.title : 'Checklist'}
          </h3>
        )}
        <div className="flex items-center gap-0.5 shrink-0">
          {task.items.length > 0 && <span className="text-[11px] text-slateText mr-1.5">{done}/{task.items.length}</span>}
          <IconButton icon="edit" label="Rename" onClick={() => setTitleEditing(true)} size={14} />
          <IconButton icon="copy" label="Duplicate" onClick={onDuplicate} size={14} />
          <IconButton icon="trash" label="Delete task" onClick={() => setConfirmDelete(true)} size={14} />
        </div>
      </div>

      <div className="space-y-0.5 mb-2">
        {task.items.map(item => (
          <ChecklistRow key={item.id} item={item}
            onToggle={() => onToggleItem(item.id)}
            onEdit={text => onEditItem(item.id, text)}
            onDelete={() => onDeleteItem(item.id)} />
        ))}
      </div>

      <div className="flex gap-2 mt-2">
        <input ref={itemInputRef} value={newItem} onChange={e => setNewItem(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
          placeholder="Add checklist item..." className={inputCls + ' text-sm py-2 transition-shadow'} />
        <button onClick={addItem} className="px-3 rounded-xl border border-line text-sm font-medium text-slateText hover:bg-slate-100 active:scale-95 transition-all shrink-0">Add</button>
      </div>

      <ConfirmDialog open={confirmDelete} title="Delete this?" message={`"${hasTitle ? task.title : 'Checklist'}" and its items will be permanently removed.`}
        confirmLabel="Delete" danger onCancel={() => setConfirmDelete(false)} onConfirm={() => { onDelete(); setConfirmDelete(false); }} />
    </div>
  );
}

function NoteTextCard({ note, onRename, onEditDescription, onDelete, onDuplicate }) {
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(note.title);
  const [descEditing, setDescEditing] = useState(false);
  const [descDraft, setDescDraft] = useState(note.description);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const commitTitle = () => {
    const v = titleDraft.trim();
    if (v) onRename(v);
    else setTitleDraft(note.title);
    setTitleEditing(false);
  };
  const commitDesc = () => {
    onEditDescription(descDraft.trim());
    setDescEditing(false);
  };

  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-card animate-pop transition-all duration-200 hover:shadow-pop hover:-translate-y-0.5">
      <div className="flex items-center justify-between gap-2 mb-3">
        {titleEditing ? (
          <input autoFocus value={titleDraft} onChange={e => setTitleDraft(e.target.value)}
            onBlur={commitTitle} onKeyDown={e => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') { setTitleDraft(note.title); setTitleEditing(false); } }}
            placeholder="Text name" className="flex-1 font-display font-semibold text-[15px] px-2 py-1 rounded-lg border border-purple outline-none animate-pop" />
        ) : (
          <h3 onClick={() => setTitleEditing(true)} className="font-display font-semibold text-[15px] text-ink cursor-text">{note.title}</h3>
        )}
        <div className="flex items-center gap-0.5 shrink-0">
          <IconButton icon="edit" label="Rename" onClick={() => setTitleEditing(true)} size={14} />
          <IconButton icon="copy" label="Duplicate" onClick={onDuplicate} size={14} />
          <IconButton icon="trash" label="Delete" onClick={() => setConfirmDelete(true)} size={14} />
        </div>
      </div>

      {descEditing ? (
        <textarea autoFocus value={descDraft} onChange={e => setDescDraft(e.target.value)}
          onBlur={commitDesc} onKeyDown={e => { if (e.key === 'Escape') { setDescDraft(note.description); setDescEditing(false); } }}
          placeholder="Description..." rows={4}
          className={inputCls + ' text-sm resize-none animate-pop'} />
      ) : note.description ? (
        <p onClick={() => setDescEditing(true)} className="text-sm text-ink whitespace-pre-wrap cursor-text leading-relaxed">{note.description}</p>
      ) : (
        <p onClick={() => setDescEditing(true)} className="text-sm text-slateText italic cursor-text">Add a description...</p>
      )}

      <ConfirmDialog open={confirmDelete} title="Delete this?" message={`"${note.title}" will be permanently removed.`}
        confirmLabel="Delete" danger onCancel={() => setConfirmDelete(false)} onConfirm={() => { onDelete(); setConfirmDelete(false); }} />
    </div>
  );
}

function NoteCategoryCard({ category, onOpen, onRename, onDelete }) {
  const [nameEditing, setNameEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(category.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const taskCount = category.tasks.length;

  const commitName = () => {
    const v = nameDraft.trim();
    if (v) onRename(v);
    else setNameDraft(category.name);
    setNameEditing(false);
  };

  return (
    <div onClick={() => !nameEditing && onOpen()}
      className="rounded-2xl border border-line bg-white shadow-card p-5 flex items-center gap-3 cursor-pointer transition-all duration-200 hover:shadow-pop hover:-translate-y-0.5 animate-pop">
      <IconBadge icon="folder" tone="soft" size={40} iconSize={18} />
      <div className="min-w-0 flex-1">
        {nameEditing ? (
          <input autoFocus value={nameDraft} onClick={e => e.stopPropagation()}
            onChange={e => setNameDraft(e.target.value)}
            onBlur={commitName} onKeyDown={e => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') { setNameDraft(category.name); setNameEditing(false); } }}
            className="font-display font-bold text-base px-2 py-1 rounded-lg border border-purple outline-none w-full animate-pop" />
        ) : (
          <h2 className="font-display font-bold text-base text-ink truncate">{category.name}</h2>
        )}
        <p className="text-xs text-slateText mt-0.5">{taskCount} {taskCount === 1 ? 'item' : 'items'}</p>
      </div>
      <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
        <IconButton icon="edit" label="Rename" onClick={() => setNameEditing(true)} />
        <IconButton icon="trash" label="Delete category" onClick={() => setConfirmDelete(true)} />
        <Icon name="chevronRight" size={16} className="text-slate-300 ml-1" />
      </div>

      <ConfirmDialog open={confirmDelete} title="Delete this category?" message={`"${category.name}" and all its tasks will be permanently removed.`}
        confirmLabel="Delete" danger onCancel={() => setConfirmDelete(false)} onConfirm={() => { onDelete(); setConfirmDelete(false); }} />
    </div>
  );
}

function NoteCategoryPage({ category, onBack, onUpdateTask, onDeleteTask, onDuplicateTask, onAddTask, onAddText }) {
  // addStage: 'idle' -> Task/Checklist/Text buttons | 'task' -> title input | 'text-name' -> name input | 'text-desc' -> description input
  const [addStage, setAddStage] = useState('idle');
  const [newTask, setNewTask] = useState('');
  const [newTextName, setNewTextName] = useState('');
  const [newTextDesc, setNewTextDesc] = useState('');
  const [autoFocusTaskId, setAutoFocusTaskId] = useState(null);

  const addTask = () => {
    const v = newTask.trim();
    if (!v) return;
    onAddTask(v);
    setNewTask('');
    setAddStage('idle');
  };
  const addChecklistDirect = () => {
    const id = onAddTask('');
    setAutoFocusTaskId(id);
    setAddStage('idle');
  };
  const goToTextDesc = () => {
    if (!newTextName.trim()) return;
    setAddStage('text-desc');
  };
  const addText = () => {
    const v = newTextName.trim();
    if (!v) return;
    onAddText(v, newTextDesc.trim());
    setNewTextName(''); setNewTextDesc(''); setAddStage('idle');
  };
  const cancelAdd = () => { setNewTask(''); setNewTextName(''); setNewTextDesc(''); setAddStage('idle'); };

  return (
    <div className="animate-fade max-w-5xl mx-auto">
      <button onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slateText hover:text-purple mb-4 transition-colors">
        <Icon name="chevronLeft" size={16} />Back to Notes
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <IconBadge icon="folder" tone="soft" size={40} iconSize={18} />
          <h1 className="font-display font-bold text-2xl text-ink truncate">{category.name}</h1>
        </div>

        {addStage === 'idle' && (
          <div className="flex gap-2 shrink-0">
            <button onClick={() => setAddStage('task')}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-line text-sm font-semibold text-ink transition-all hover:border-purpleLight hover:bg-purple/5 active:scale-95">
              <Icon name="fileText" size={14} className="text-purple" />Task
            </button>
            <button onClick={addChecklistDirect}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-line text-sm font-semibold text-ink transition-all hover:border-purpleLight hover:bg-purple/5 active:scale-95">
              <Icon name="checkSquare" size={14} className="text-purple" />Checklist
            </button>
            <button onClick={() => setAddStage('text-name')}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-line text-sm font-semibold text-ink transition-all hover:border-purpleLight hover:bg-purple/5 active:scale-95">
              <Icon name="edit" size={14} className="text-purple" />Text Note
            </button>
          </div>
        )}
        {addStage === 'task' && (
          <div className="flex gap-2 w-full sm:w-auto animate-pop">
            <input autoFocus value={newTask} onChange={e => setNewTask(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addTask(); if (e.key === 'Escape') cancelAdd(); }}
              placeholder="Task name..." className={inputCls + ' text-sm'} />
            <button onClick={addTask} className="px-4 rounded-xl bg-purple hover:bg-purple/90 text-white text-sm font-semibold shrink-0 transition-all active:scale-95">Add</button>
            <button onClick={cancelAdd} aria-label="Cancel"
              className="px-3 rounded-xl border border-line text-slateText hover:bg-slate-100 shrink-0 transition-colors"><Icon name="x" size={14} /></button>
          </div>
        )}
        {addStage === 'text-name' && (
          <div className="flex gap-2 w-full sm:w-auto animate-pop">
            <input autoFocus value={newTextName} onChange={e => setNewTextName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') goToTextDesc(); if (e.key === 'Escape') cancelAdd(); }}
              placeholder="Text name..." className={inputCls + ' text-sm'} />
            <button onClick={goToTextDesc} className="px-4 rounded-xl bg-purple hover:bg-purple/90 text-white text-sm font-semibold shrink-0 transition-all active:scale-95">Next</button>
            <button onClick={cancelAdd} aria-label="Cancel"
              className="px-3 rounded-xl border border-line text-slateText hover:bg-slate-100 shrink-0 transition-colors"><Icon name="x" size={14} /></button>
          </div>
        )}
        {addStage === 'text-desc' && (
          <div className="flex flex-col gap-2 w-full animate-pop">
            <p className="text-sm font-semibold text-ink">{newTextName}</p>
            <textarea autoFocus value={newTextDesc} onChange={e => setNewTextDesc(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') cancelAdd(); }}
              placeholder="Description..." rows={3} className={inputCls + ' text-sm resize-none'} />
            <div className="flex gap-2 justify-end">
              <button onClick={cancelAdd} className="px-3 rounded-xl border border-line text-slateText hover:bg-slate-100 text-sm transition-colors">Cancel</button>
              <button onClick={addText} className="px-4 rounded-xl bg-purple hover:bg-purple/90 text-white text-sm font-semibold transition-all active:scale-95">Add Text Note</button>
            </div>
          </div>
        )}
      </div>

      {category.tasks.length === 0 ? (
        <EmptyState icon="checkSquare" title="Nothing here yet" subtitle="Add a Task, Checklist, or Text Note to start building this category's reusable steps." />
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {category.tasks.map(task => task.kind === 'text' ? (
            <NoteTextCard key={task.id} note={task}
              onRename={title => onUpdateTask(task.id, t => ({ ...t, title, updatedAt: new Date().toISOString() }))}
              onEditDescription={description => onUpdateTask(task.id, t => ({ ...t, description, updatedAt: new Date().toISOString() }))}
              onDelete={() => onDeleteTask(task.id)}
              onDuplicate={() => onDuplicateTask(task)} />
          ) : (
            <NoteTaskCard key={task.id} task={task}
              autoFocusItems={task.id === autoFocusTaskId}
              onRename={title => onUpdateTask(task.id, t => ({ ...t, title, updatedAt: new Date().toISOString() }))}
              onDelete={() => onDeleteTask(task.id)}
              onDuplicate={() => onDuplicateTask(task)}
              onAddItem={text => onUpdateTask(task.id, t => ({ ...t, items: [...t.items, makeChecklistItem(text)], updatedAt: new Date().toISOString() }))}
              onToggleItem={itemId => onUpdateTask(task.id, t => ({ ...t, items: t.items.map(i => i.id === itemId ? { ...i, completed: !i.completed } : i), updatedAt: new Date().toISOString() }))}
              onEditItem={(itemId, text) => onUpdateTask(task.id, t => ({ ...t, items: t.items.map(i => i.id === itemId ? { ...i, text } : i), updatedAt: new Date().toISOString() }))}
              onDeleteItem={itemId => onUpdateTask(task.id, t => ({ ...t, items: t.items.filter(i => i.id !== itemId), updatedAt: new Date().toISOString() }))} />
          ))}
        </div>
      )}
    </div>
  );
}

function NotesPage({ user, store, remote, initial }) {
  const [categories, setCategories] = useState(() => sanitizeNoteCategories(store.latestNotes ? store.latestNotes() : initial));
  useEffect(() => {
    remote.notes = (fresh) => setCategories(sanitizeNoteCategories(fresh));
    return () => { remote.notes = null; };
  }, [remote]);
  const [newCategory, setNewCategory] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [openCategoryId, setOpenCategoryId] = useState(null);

  useEffect(() => { store.persist('notes', categories); }, [categories, store]);

  const addCategory = () => {
    const v = newCategory.trim();
    if (!v) return;
    setCategories(prev => [...prev, makeNoteCategory(v)]);
    setNewCategory('');
    setAddingCategory(false);
  };
  const renameCategory = (id, name) => setCategories(prev => prev.map(c => c.id === id ? { ...c, name } : c));
  const deleteCategory = id => { setCategories(prev => prev.filter(c => c.id !== id)); setOpenCategoryId(prev => prev === id ? null : prev); };

  const addTask = (categoryId, title) => {
    const task = makeNoteTask(categoryId, title);
    setCategories(prev => prev.map(c => c.id === categoryId ? { ...c, tasks: [...c.tasks, task] } : c));
    return task.id;
  };
  const addText = (categoryId, title, description) => {
    const note = makeNoteText(categoryId, title, description);
    setCategories(prev => prev.map(c => c.id === categoryId ? { ...c, tasks: [...c.tasks, note] } : c));
    return note.id;
  };
  const updateTask = (categoryId, taskId, updater) => setCategories(prev => prev.map(c => c.id === categoryId
    ? { ...c, tasks: c.tasks.map(t => t.id === taskId ? updater(t) : t) } : c));
  const deleteTask = (categoryId, taskId) => setCategories(prev => prev.map(c => c.id === categoryId ? { ...c, tasks: c.tasks.filter(t => t.id !== taskId) } : c));
  const duplicateTask = (categoryId, task) => {
    const baseTitle = task.title && task.title.trim() ? task.title : 'Checklist';
    const copy = task.kind === 'text'
      ? makeNoteText(categoryId, `${baseTitle} (Copy)`, task.description)
      : makeNoteTask(categoryId, `${baseTitle} (Copy)`, task.items.map(i => ({ ...i, id: uid(), completed: false })));
    setCategories(prev => prev.map(c => c.id === categoryId ? { ...c, tasks: [...c.tasks, copy] } : c));
  };

  const openCategory = categories.find(c => c.id === openCategoryId) || null;

  if (openCategory) {
    return (
      <NoteCategoryPage category={openCategory} onBack={() => setOpenCategoryId(null)}
        onAddTask={title => addTask(openCategory.id, title)}
        onAddText={(title, description) => addText(openCategory.id, title, description)}
        onUpdateTask={(taskId, updater) => updateTask(openCategory.id, taskId, updater)}
        onDeleteTask={taskId => deleteTask(openCategory.id, taskId)}
        onDuplicateTask={task => duplicateTask(openCategory.id, task)} />
    );
  }

  return (
    <div className="animate-fade max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-ink">Notes</h1>
          <p className="text-sm text-slateText mt-1">Reusable checklists for tasks you repeat often.</p>
        </div>
        {!addingCategory ? (
          <button onClick={() => setAddingCategory(true)}
            className="inline-flex items-center gap-2 bg-purple hover:bg-purple/90 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-card transition-all hover:-translate-y-0.5 active:scale-95 shrink-0">
            <Icon name="plus" size={16} />Add Category
          </button>
        ) : (
          <div className="flex gap-2 w-full sm:w-auto animate-pop">
            <input autoFocus value={newCategory} onChange={e => setNewCategory(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addCategory(); if (e.key === 'Escape') { setAddingCategory(false); setNewCategory(''); } }}
              placeholder="Category name..." className={inputCls + ' text-sm'} />
            <button onClick={addCategory} className="px-4 rounded-xl bg-purple hover:bg-purple/90 text-white text-sm font-semibold shrink-0 transition-colors active:scale-95">Add</button>
            <button onClick={() => { setAddingCategory(false); setNewCategory(''); }} className="px-3 rounded-xl border border-line text-slateText hover:bg-slate-100 shrink-0 transition-colors"><Icon name="x" size={14} /></button>
          </div>
        )}
      </div>

      {categories.length === 0 ? (
        <EmptyState icon="folder" title="No categories yet" subtitle="Create a category, then open it to add reusable Tasks or Checklists — like 'Seminar'." />
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {categories.map(cat => (
            <NoteCategoryCard key={cat.id} category={cat}
              onOpen={() => setOpenCategoryId(cat.id)}
              onRename={name => renameCategory(cat.id, name)}
              onDelete={() => deleteCategory(cat.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('Unhandled UI error:', error, info); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg p-6">
        <div className="max-w-sm w-full text-center bg-white rounded-2xl border border-line shadow-card p-8">
          <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
            <Icon name="x" size={20} />
          </div>
          <h1 className="font-display font-bold text-lg text-ink mb-1.5">Something went wrong</h1>
          <p className="text-sm text-slateText mb-5">This section hit an unexpected error. Reloading usually fixes it.</p>
          <button onClick={() => window.location.reload()}
            className="w-full bg-purple hover:bg-purple/90 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
            Reload App
          </button>
        </div>
      </div>
    );
  }
}

/* ======================= APP ======================= */
function Splash({ label = 'Loading your workspace…' }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-bg">
      <div className="flex flex-col items-center gap-5 tm-rise">
        <div className="relative w-20 h-20 flex items-center justify-center">
          <span className="tm-orbit absolute inset-0 rounded-[26px]" />
          <div className="w-16 h-16 rounded-2xl tm-auth-panel flex items-center justify-center shadow-pop">
            <img src={LOGO_WHITE_ICON} alt="" className="w-9 h-9" />
          </div>
        </div>
        <p className="text-sm font-medium text-slateText">{label}</p>
        <div className="w-36 h-1 rounded-full bg-slate-200 overflow-hidden"><span className="tm-bar block h-full w-2/5 rounded-full bg-gradient-to-r from-purple to-purpleLight" /></div>
      </div>
    </div>
  );
}

function ConfigMissing() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-6">
      <div className="max-w-md w-full bg-white border border-line rounded-2xl shadow-card p-8 text-center">
        <img src={LOGO_MAIN} alt="" className="w-36 mx-auto mb-5" />
        <h1 className="font-display font-bold text-lg text-ink mb-2">Almost there</h1>
        <p className="text-sm text-slateText">Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to your environment (Vercel → Settings → Environment Variables) and redeploy.</p>
      </div>
    </div>
  );
}

function App() {
  const [phase, setPhase] = useState('boot'); // boot | auth | recovery | ready | error
  const [bootError, setBootError] = useState('');
  const [user, setUser] = useState(null);
  const [data, setData] = useState(null);
  const [syncState, setSyncState] = useState('idle');
  const storeRef = useRef(null);
  const remote = useMemo(() => ({ tasks: null, notes: null }), []);
  const bootedFor = useRef(null);

  const boot = useCallback(async (authUser) => {
    if (bootedFor.current === authUser.id) return;
    bootedFor.current = authUser.id;
    setPhase('boot');
    const sb = getSupabase();
    try {
      if (storeRef.current) storeRef.current.destroy();
      const store = createStore({
        supabase: sb, userId: authUser.id,
        onRemote: (kind, fresh) => { const fn = remote[kind]; if (fn) fn(fresh); },
        onState: setSyncState,
        onError: () => {},
      });
      const [profileRes, loaded] = await Promise.all([
        sb.from('tm_profiles').select('full_name,email,about,avatar_url,seeded,created_at').eq('id', authUser.id).maybeSingle(),
        store.load(),
      ]);
      if (profileRes.error) throw profileRes.error;
      const p = profileRes.data || {};
      let tasks = loaded.tasks;
      if (!p.seeded) {
        if (!tasks.length) tasks = seedTasks(); // same welcome tasks the original app started with
        await sb.from('tm_profiles').upsert({ id: authUser.id, seeded: true, full_name: p.full_name || authUser.user_metadata?.full_name || (authUser.email || '').split('@')[0], email: authUser.email || '' });
      }
      storeRef.current = store;
      setUser({
        id: authUser.id,
        name: p.full_name || authUser.user_metadata?.full_name || (authUser.email || '').split('@')[0],
        email: authUser.email || p.email || '',
        about: p.about || '',
        avatar: p.avatar_url || null,
        createdAt: p.created_at,
      });
      setData({ tasks, notes: loaded.notes });
      setPhase('ready');
      store.subscribe();
    } catch (err) {
      bootedFor.current = null;
      setBootError(friendlyError(err));
      setPhase('error');
    }
  }, [remote]);

  useEffect(() => {
    if (!isConfigured) return;
    const sb = getSupabase();
    let recovering = typeof window !== 'undefined' && /type=recovery/.test(window.location.hash);
    sb.auth.getSession().then(({ data: { session } }) => {
      if (recovering) return;
      if (session) boot(session.user); else setPhase('auth');
    });
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') { recovering = true; setPhase('recovery'); return; }
      if (event === 'SIGNED_OUT') {
        bootedFor.current = null;
        if (storeRef.current) { storeRef.current.destroy(); storeRef.current = null; }
        setUser(null); setData(null); setPhase('auth');
        return;
      }
      if (event === 'SIGNED_IN' && session && !recovering) setTimeout(() => boot(session.user), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [boot]);

  // catch up when the tab / phone comes back
  useEffect(() => {
    if (phase !== 'ready') return;
    let last = Date.now();
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < 5000) return;
      last = Date.now();
      storeRef.current && storeRef.current.refreshAll();
    };
    const poll = setInterval(() => { if (document.visibilityState === 'visible') { last = Date.now(); storeRef.current && storeRef.current.refreshAll(); } }, 60000);
    const beforeUnload = (e) => { if (storeRef.current && storeRef.current.hasChanges()) { storeRef.current.flushNow(); e.preventDefault(); e.returnValue = ''; } };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    window.addEventListener('online', onVisible);
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('online', onVisible);
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }, [phase]);

  const handleLogout = useCallback(async () => {
    try { if (storeRef.current) await storeRef.current.flushNow(); } catch (e) {}
    await getSupabase().auth.signOut();
  }, []);

  const handleUpdateUser = useCallback(async (patch) => {
    const sb = getSupabase();
    const row = {};
    if ('name' in patch) row.full_name = patch.name;
    if ('about' in patch) row.about = patch.about;
    if ('avatar' in patch) row.avatar_url = patch.avatar;
    let message = null;
    if (Object.keys(row).length) {
      const { error } = await sb.from('tm_profiles').update(row).eq('id', user.id);
      if (error) throw error;
    }
    let emailChanged = false;
    if (patch.email && patch.email !== user.email) {
      const { error } = await sb.auth.updateUser({ email: patch.email }, { emailRedirectTo: siteOrigin() + '/' });
      if (error) throw error;
      emailChanged = true;
      message = `Profile saved. Check ${patch.email} to confirm your new email — until then you keep logging in with ${user.email}.`;
    }
    setUser(prev => {
      const next = { ...prev, ...patch };
      if (emailChanged) next.email = prev.email;
      return next;
    });
    return { message };
  }, [user]);

  const handleChangePassword = useCallback(async (current, next) => {
    const sb = getSupabase();
    const check = await sb.auth.signInWithPassword({ email: user.email, password: current });
    if (check.error) throw new Error('WRONG_CURRENT_PASSWORD');
    const { error } = await sb.auth.updateUser({ password: next });
    if (error) throw error;
  }, [user]);

  if (!isConfigured) return <ConfigMissing />;
  if (phase === 'boot') return <Splash />;
  if (phase === 'recovery') return <ErrorBoundary><AuthPage recovery onRecovered={() => { window.history.replaceState(null, '', '/'); bootedFor.current = null; getSupabase().auth.getSession().then(({ data: { session } }) => session ? boot(session.user) : setPhase('auth')); }} /></ErrorBoundary>;
  if (phase === 'auth' || !user) {
    if (phase === 'error') {
      return (
        <div className="min-h-screen flex items-center justify-center bg-bg p-6">
          <div className="max-w-sm w-full text-center bg-white rounded-2xl border border-line shadow-card p-8">
            <h1 className="font-display font-bold text-lg text-ink mb-1.5">Couldn't load your workspace</h1>
            <p className="text-sm text-slateText mb-5">{bootError}</p>
            <button onClick={() => window.location.reload()} className="w-full bg-purple hover:bg-purple/90 text-white text-sm font-semibold px-4 py-2.5 rounded-xl mb-2">Try again</button>
            <button onClick={() => getSupabase().auth.signOut()} className="w-full border border-line text-ink text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-slate-50">Log out</button>
          </div>
        </div>
      );
    }
    return <ErrorBoundary><AuthPage /></ErrorBoundary>;
  }
  return (
    <ErrorBoundary>
      <Workspace key={user.id} user={user} onLogout={handleLogout} onUpdateUser={handleUpdateUser} onChangePassword={handleChangePassword}
        store={storeRef.current} remote={remote} initialTasks={data.tasks} initialNotes={data.notes} syncState={syncState} />
    </ErrorBoundary>
  );
}

export default App;



/* Task reminders — one set of rules, used in two places:
   - Android app: the phone schedules every reminder itself, so it shows when the app
     is closed, the phone is locked, or there is no internet.
   - Website / iPhone home-screen app: reminders show while the page is open
     (showing them with the browser closed needs a server, not included here).
   The times come from each person's reminder settings, saved to their profile, so
   the website and the app use the same ones. */
// Use the bridge the Android app injects (same as the Downloader plugin). A second
// copy of @capacitor/core from npm never receives the phone's replies.
const Capacitor = {
  isNativePlatform: () => {
    try { return !!(typeof window !== "undefined" && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); } catch (e) { return false; }
  },
};

export const DEFAULT_SETTINGS = {
  enabled: true,
  taskLeadMinutes: 15,                          // timed task: minutes before its due time
  meetingLeadMinutes: [20, 2],                  // timed "Meeting" category: these alerts
  summaryTimes: ["09:00", "14:30", "17:00"],    // daily list of the day's untimed tasks
  skipTimedInSummary: true,                     // tasks with a set time stay out of the list
  endOfDayLeadMinutes: 20,                      // last day of a task: minutes before midnight
  overdueTime: "08:30",                         // unfinished tasks from earlier days
  longTaskTime: "09:00",                        // multi-day task: once a day
};

const CHANNEL = "task-reminders";
const MAX_NATIVE = 200;     // reminders kept scheduled on the phone
const HORIZON_DAYS = 14;    // how far ahead we plan

const pad = n => String(n).padStart(2, "0");
const toKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = k => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (key, n) => { const d = parseKey(key); d.setDate(d.getDate() + n); return toKey(d); };
const isHHMM = v => typeof v === "string" && /^\d{2}:\d{2}$/.test(v) && Number(v.slice(0, 2)) < 24 && Number(v.slice(3)) < 60;
const atTime = (key, hhmm) => { const d = parseKey(key); d.setHours(Number(hhmm.slice(0, 2)), Number(hhmm.slice(3)), 0, 0); return d; };
const endOfDay = (key, leadMin) => new Date(parseKey(addDays(key, 1)).getTime() - leadMin * 60000);

export function normalizeSettings(raw) {
  const s = raw && typeof raw === "object" ? raw : {};
  const num = (v, d, max) => { const n = Number(v); return Number.isFinite(n) && v !== "" && v !== null ? Math.min(max, Math.max(0, Math.round(n))) : d; };
  const uniq = arr => arr.filter((n, i, a) => a.indexOf(n) === i);
  return {
    enabled: s.enabled !== false,
    taskLeadMinutes: num(s.taskLeadMinutes, DEFAULT_SETTINGS.taskLeadMinutes, 1440),
    meetingLeadMinutes: Array.isArray(s.meetingLeadMinutes)
      ? uniq(s.meetingLeadMinutes.map(n => num(n, 0, 1440))).slice(0, 5)
      : DEFAULT_SETTINGS.meetingLeadMinutes,
    summaryTimes: Array.isArray(s.summaryTimes)
      ? uniq(s.summaryTimes.filter(isHHMM)).slice(0, 6)
      : DEFAULT_SETTINGS.summaryTimes,
    skipTimedInSummary: s.skipTimedInSummary !== false,
    endOfDayLeadMinutes: num(s.endOfDayLeadMinutes, DEFAULT_SETTINGS.endOfDayLeadMinutes, 1440),
    overdueTime: isHHMM(s.overdueTime) ? s.overdueTime : DEFAULT_SETTINGS.overdueTime,
    longTaskTime: isHHMM(s.longTaskTime) ? s.longTaskTime : DEFAULT_SETTINGS.longTaskTime,
  };
}

// the days a task is on
function taskDays(t) {
  const last = isLong(t) ? t.endDate : t.currentDate;
  const out = [];
  for (let k = t.currentDate; k <= last && out.length < 400; k = addDays(k, 1)) out.push(k);
  return out;
}
const isLong = t => !!(t.isRange && t.endDate && t.endDate > t.currentDate);
const isTimed = t => isHHMM(t.dueTime);
const names = list => list.slice(0, 5).join(", ") + (list.length > 5 ? ` +${list.length - 5} more` : "");
const dayLabel = key => parseKey(key).toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });

/* Every reminder that should fire from `now` up to HORIZON_DAYS ahead.
   Returns [{ key, at: Date, title, body }] sorted by time. */
export function buildReminders(tasks, rawSettings, now = new Date()) {
  const s = normalizeSettings(rawSettings);
  if (!s.enabled) return [];
  const today = toKey(now);
  const end = addDays(today, HORIZON_DAYS);
  const nowMs = now.getTime();
  const pending = (tasks || []).filter(t => t && t.id && t.currentDate && t.status !== "completed");
  const out = [];
  const push = (key, at, title, body) => { if (at.getTime() > nowMs + 5000) out.push({ key, at, title, body }); };

  // 1. timed tasks: before the due time (meetings get their own alerts)
  for (const t of pending) {
    if (!isTimed(t)) continue;
    const meeting = t.category === "Meeting";
    const leads = meeting ? s.meetingLeadMinutes : [s.taskLeadMinutes];
    for (const day of taskDays(t)) {
      if (day < today || day > end) continue;
      const due = atTime(day, t.dueTime);
      for (const lead of leads) {
        const title = lead === 0 ? (meeting ? "Meeting now" : "Due now")
          : meeting ? `Meeting in ${lead} min` : `Due in ${lead} min`;
        push(`due|${t.id}|${day}|${lead}`, new Date(due.getTime() - lead * 60000), title, `${t.title || "Task"} · ${t.dueTime}`);
      }
    }
  }

  // 2. untimed tasks: the day's list at each summary time
  const byDay = new Map();
  for (const t of pending) {
    if (isLong(t) || (isTimed(t) && s.skipTimedInSummary)) continue;
    if (t.currentDate < today || t.currentDate > end) continue;
    if (!byDay.has(t.currentDate)) byDay.set(t.currentDate, []);
    byDay.get(t.currentDate).push(isTimed(t) ? `${t.title} (${t.dueTime})` : (t.title || "Task"));
  }
  byDay.forEach((list, day) => {
    const title = day === today ? "Today's tasks" : `Tasks for ${dayLabel(day)}`;
    for (const hm of s.summaryTimes) push(`sum|${day}|${hm}`, atTime(day, hm), title, names(list));
  });

  // 3. multi-day tasks: once a day; on the last day also the summary times and the end reminder
  for (const t of pending) {
    if (!isLong(t)) continue;
    const days = taskDays(t);
    days.forEach((day, i) => {
      if (day < today || day > end) return;
      push(`long|${t.id}|${day}`, atTime(day, s.longTaskTime), "Long task", `${t.title || "Task"} · day ${i + 1} of ${days.length}`);
      if (i === days.length - 1) {
        for (const hm of s.summaryTimes) {
          if (hm !== s.longTaskTime) push(`longlast|${t.id}|${hm}`, atTime(day, hm), "Last day", `${t.title || "Task"} · ends today`);
        }
      }
    });
  }

  // 4. last day, shortly before midnight: one alert listing what is still pending (timed tasks have their own alert)
  const lastBy = new Map();
  for (const t of pending) {
    if (isTimed(t)) continue;
    const last = isLong(t) ? t.endDate : t.currentDate;
    if (last < today || last > end) continue;
    if (!lastBy.has(last)) lastBy.set(last, []);
    lastBy.get(last).push(t.title || "Task");
  }
  for (const [day, list] of lastBy) {
    push(`eod|${day}`, endOfDay(day, s.endOfDayLeadMinutes), `Ends in ${s.endOfDayLeadMinutes} min`, `${list.length} unfinished: ${names(list)}`);
  }

  // 5. unfinished tasks from earlier days: once a day at the overdue time
  for (let d = today; d <= end; d = addDays(d, 1)) {
    const late = pending.filter(t => (isLong(t) ? t.endDate : t.currentDate) < d);
    if (late.length) push(`over|${d}`, atTime(d, s.overdueTime), "Overdue tasks", `${late.length} unfinished: ${names(late.map(t => t.title || "Task"))}`);
  }

  out.sort((a, b) => a.at - b.at);
  return out;
}

/* ---------- Android: the phone keeps the reminders ---------- */
export function isNativeApp() { return Capacitor.isNativePlatform(); }

// what happened the last time the phone was updated (shown in Settings → Reminders)
const STATUS_KEY = "tm-reminder-status";
export function getReminderStatus() {
  try { return JSON.parse(localStorage.getItem(STATUS_KEY) || "null"); } catch (e) { return null; }
}
function setReminderStatus(s) {
  try { localStorage.setItem(STATUS_KEY, JSON.stringify({ ...s, at: new Date().toISOString() })); } catch (e) { /* ignore */ }
}
// short human-readable trail of what the phone sync did (shown in Settings)
function logStep(status, text) {
  status.steps = [...(status.steps || []), `${new Date().toLocaleTimeString()} ${text}`].slice(-12);
  setReminderStatus(status);
}

let plugin = null;
async function getPlugin() {
  if (!Capacitor.isNativePlatform()) return null;
  const C = window.Capacitor;
  if (!plugin) {
    plugin = (C.Plugins && C.Plugins.LocalNotifications) || (C.registerPlugin ? C.registerPlugin("LocalNotifications") : null);
  }
  return plugin;
}

// stable 31-bit id per reminder, so it is never duplicated and can be cancelled
function idFor(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 1) || 1;
}

async function exactState(LN) {
  try { const r = await LN.checkExactNotificationSetting(); return r.exact_alarm || "unknown"; } catch (e) { return "unknown"; }
}

/* Replace everything the phone has scheduled with the current list. Safe to call often. */
export async function syncReminders(tasks, rawSettings) {
  const LN = await getPlugin();
  if (!LN) return;
  const status = { native: true, permission: "unknown", exact: "unknown", scheduled: 0, error: "", steps: [] };
  logStep(status, "sync started");
  try {
    const old = await LN.getPending();
    logStep(status, `pending before: ${old.notifications.length}`);
    if (old.notifications.length) await LN.cancel({ notifications: old.notifications.map(n => ({ id: n.id })) });
    const s = normalizeSettings(rawSettings);
    const list = s.enabled ? buildReminders(tasks, s).slice(0, MAX_NATIVE) : [];
    logStep(status, `rules built: ${list.length}`);
    let perm = await LN.checkPermissions();
    if (perm.display !== "granted") perm = await LN.requestPermissions();
    status.permission = perm.display;
    status.exact = await exactState(LN);
    logStep(status, `permission ${perm.display}, exact ${status.exact}`);
    if (perm.display === "granted" && list.length) {
      await LN.createChannel({
        id: CHANNEL,
        name: "Task reminders",
        description: "Reminders for due times, daily task lists and overdue tasks",
        importance: 4,
        visibility: 1,
      });
      // if exact alarms are not allowed, the plugin falls back to inexact alarms (a few minutes late)
      await LN.schedule({
        notifications: list.map(r => ({
          id: idFor(r.key),
          title: r.title,
          body: r.body,
          channelId: CHANNEL,
          schedule: { at: r.at, allowWhileIdle: true },
        })),
      });
      status.scheduled = list.length;
      logStep(status, `scheduled ${list.length}`);
    } else {
      logStep(status, "nothing scheduled (permission or no reminders)");
    }
  } catch (err) {
    status.error = String((err && err.message) || err).slice(0, 200);
    logStep(status, `error: ${status.error}`);
    console.warn("reminders", err);
  }
  setReminderStatus(status);
}

/* A notification 10 seconds from now: proves the whole phone path works. */
export async function sendTestReminder() {
  const status = { ...(getReminderStatus() || {}), steps: [] };
  logStep(status, "test pressed");
  const LN = await getPlugin();
  if (!LN) { logStep(status, "test: plugin not available"); throw new Error("Phone notifications work only in the Android app."); }
  let perm = await LN.checkPermissions();
  logStep(status, `test: permission ${perm.display}`);
  if (perm.display !== "granted") perm = await LN.requestPermissions();
  if (perm.display !== "granted") throw new Error("Notifications are blocked. Allow them in phone Settings → Apps → Task Management.");
  await LN.createChannel({ id: CHANNEL, name: "Task reminders", description: "Reminders", importance: 4, visibility: 1 });
  await LN.schedule({
    notifications: [{
      id: 2147000001,
      title: "Test reminder",
      body: "If you see this, phone reminders work.",
      channelId: CHANNEL,
      schedule: { at: new Date(Date.now() + 10000), allowWhileIdle: true },
    }],
  });
  logStep(status, "test scheduled for 10 seconds later");
  return "Test notification in about 10 seconds. You can close the app now.";
}

/* Opens the phone's "Alarms & reminders" page for this app. */
export async function openExactAlarmSettings() {
  const LN = await getPlugin();
  if (LN) await LN.changeExactNotificationSetting();
}

/* ---------- Website: show reminders while the page is open ---------- */
export function startWebReminders(getState) {
  if (Capacitor.isNativePlatform() || typeof window === "undefined") return () => {};
  const shown = new Set();
  const tick = () => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const { tasks, settings } = getState();
    const now = Date.now();
    buildReminders(tasks, settings).forEach(r => {
      const t = r.at.getTime();
      // only the ones that just came due, so reopening the page does not repeat old alerts
      if (t <= now && t > now - 120000 && !shown.has(r.key)) {
        shown.add(r.key);
        try { new Notification(r.title, { body: r.body, tag: r.key }); } catch (e) { /* ignore */ }
      }
    });
  };
  tick();
  const iv = setInterval(tick, 20000);
  return () => clearInterval(iv);
}

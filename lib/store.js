/* Task Management data layer.
   The UI keeps exactly the same in-memory shapes the original app kept in
   localStorage (a tasks array and a note-categories array). This store loads
   them from Supabase, and every time the UI hands back a new array it
   diff-syncs only the rows that actually changed (upsert / delete).
   Other devices signed in to the same account are told "tasks changed" over
   a tiny Realtime broadcast and re-fetch; no data travels on the broadcast. */

import { idbGet, idbSet, isOfflineError } from "./offline";

/* Offline: a copy of tasks + notes (and the changes that have not reached the
   server yet) is kept in this device's IndexedDB. With no internet the app opens
   from that copy and keeps working; every edit is saved locally and pushed to
   Supabase automatically as soon as the connection (and login) is back. Pending
   offline edits are laid on top of the fresh server copy, so they are never lost. */

const PAGE = 1000;
const BUCKET = "tm-attachments";

const nz = (v) => (v === undefined || v === null ? "" : String(v));

/* ---------------- tasks ---------------- */
function taskToDb(t) {
  const att = t.attachment && t.attachment.path
    ? { name: nz(t.attachment.name).slice(0, 200), type: nz(t.attachment.type).slice(0, 100), path: t.attachment.path }
    : null;
  return {
    id: String(t.id),
    title: nz(t.title).slice(0, 300),
    description: nz(t.description).slice(0, 5000),
    category: nz(t.category || "Work").slice(0, 40),
    priority: ["Low", "Medium", "High"].includes(t.priority) ? t.priority : "Medium",
    estimated_time: nz(t.estimatedTime).slice(0, 40),
    due_time: /^\d{2}:\d{2}$/.test(nz(t.dueTime)) ? t.dueTime : "",
    original_date: t.originalDate || t.currentDate,
    current_day: t.currentDate,
    is_range: !!t.isRange,
    end_date: t.isRange && t.endDate ? t.endDate : t.endDate || null,
    status: t.status === "completed" ? "completed" : "pending",
    is_rolled_over: !!t.isRolledOver,
    rollover_count: Math.max(0, Number(t.rolloverCount) || 0),
    created_at: t.createdAt || new Date().toISOString(),
    completed_at: t.status === "completed" ? t.completedAt || new Date().toISOString() : null,
    attachment: att,
  };
}
function taskFromDb(d) {
  return {
    id: d.id,
    title: d.title,
    description: d.description,
    category: d.category,
    priority: d.priority,
    estimatedTime: d.estimated_time,
    dueTime: d.due_time,
    originalDate: d.original_date,
    currentDate: d.current_day,
    isRange: !!d.is_range,
    endDate: d.end_date || null,
    status: d.status,
    isRolledOver: !!d.is_rolled_over,
    rolloverCount: d.rollover_count || 0,
    createdAt: d.created_at,
    completedAt: d.completed_at,
    attachment: d.attachment ? { ...d.attachment, dataUrl: null } : null,
  };
}

/* ---------------- notes ---------------- */
function noteToDb(c, index) {
  return {
    id: String(c.id),
    name: nz(c.name).slice(0, 120),
    position: index,
    created_at: c.createdAt || new Date().toISOString(),
    tasks: Array.isArray(c.tasks) ? c.tasks : [],
  };
}
function noteFromDb(d) {
  return { id: d.id, name: d.name, createdAt: d.created_at, tasks: Array.isArray(d.tasks) ? d.tasks : [] };
}

const KINDS = {
  tasks: { table: "tm_tasks", order: ["created_at", "id"], toDb: taskToDb, fromDb: taskFromDb },
  notes: { table: "tm_note_categories", order: ["position", "created_at"], toDb: noteToDb, fromDb: noteFromDb },
};

function serialize(kind, list) {
  const m = new Map();
  (list || []).forEach((row, i) => {
    if (!row || !row.id) return;
    const db = KINDS[kind].toDb(row, i);
    m.set(db.id, { row: db, json: JSON.stringify(db) });
  });
  return m;
}

function dataUrlToBlob(dataUrl) {
  const [head, body] = dataUrl.split(",");
  const mime = (head.match(/data:([^;]+)/) || [])[1] || "application/octet-stream";
  const bin = atob(body || "");
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
const safeName = (n) => nz(n).replace(/[^A-Za-z0-9._-]+/g, "_").slice(-80) || "file";

export function createStore({ supabase, userId, onRemote, onState, onError }) {
  const snapshot = { tasks: new Map(), notes: new Map() };
  const latest = { tasks: null, notes: null };
  let state = "idle";
  let timer = null;
  let flushing = null;
  let again = false;
  let channel = null;
  let refreshTimer = null;
  const pendingKinds = new Set();
  let destroyed = false;
  let disk = null; // copy read from this device once: {tasks:{list,snap}, notes:{list,snap}}
  let cacheTimer = null;
  let retryTimer = null;
  let retryDelay = 15000;
  let lastLoadOffline = false;
  const CACHE_KEY = "data:" + userId;

  const setState = (s) => { if (state !== s) { state = s; onState && onState(s); } };

  /* ---- on-device copy ---- */
  async function readDisk() {
    if (disk === null) disk = (await idbGet(CACHE_KEY)) || {};
    return disk;
  }
  const stripList = (kind, list) => (kind === "tasks"
    ? list.map((t) => (t && t.attachment ? { ...t, attachment: { ...t.attachment, dataUrl: t.attachment.path ? null : t.attachment.dataUrl } } : t))
    : list);
  function writeCache() {
    clearTimeout(cacheTimer); cacheTimer = null;
    if (destroyed) return;
    const payload = { ...(disk || {}), savedAt: Date.now() };
    ["tasks", "notes"].forEach((kind) => {
      if (latest[kind] && snapshot[kind]) payload[kind] = { list: stripList(kind, latest[kind]), snap: [...snapshot[kind]] };
    });
    disk = payload;
    idbSet(CACHE_KEY, payload);
  }
  function scheduleCache() { clearTimeout(cacheTimer); cacheTimer = setTimeout(writeCache, 250); }

  function pendingOf(kind, list, snap) {
    const local = serialize(kind, list);
    const ups = [];
    const dels = new Set();
    const byId = new Map((list || []).filter((r) => r && r.id).map((r) => [String(r.id), r]));
    local.forEach((v, id) => { if (snap.get(id) !== v.json) ups.push(byId.get(id)); });
    snap.forEach((_, id) => { if (!local.has(id)) dels.add(id); });
    return { ups, dels };
  }
  function mergePending(fresh, pend) {
    const map = new Map();
    fresh.forEach((r) => map.set(String(r.id), r));
    pend.dels.forEach((id) => map.delete(id));
    pend.ups.forEach((r) => map.set(String(r.id), r));
    return [...map.values()];
  }
  const timeoutAfter = (ms) => new Promise((_, rej) => setTimeout(() => { const e = new Error("timeout"); e.offline = true; rej(e); }, ms));

  async function fetchKind(kind) {
    const k = KINDS[kind];
    const out = [];
    for (let from = 0; ; from += PAGE) {
      let q = supabase.from(k.table).select("*").eq("user_id", userId);
      k.order.forEach((c) => (q = q.order(c, { ascending: true })));
      const { data, error } = await q.range(from, from + PAGE - 1);
      if (error) throw error;
      out.push(...data);
      if (data.length < PAGE) break;
    }
    return out.map(k.fromDb);
  }

  async function signAttachments(tasks) {
    const withPath = tasks.filter((t) => t.attachment && t.attachment.path);
    if (!withPath.length) return tasks;
    const { data } = await supabase.storage.from(BUCKET).createSignedUrls(withPath.map((t) => t.attachment.path), 60 * 60 * 24 * 7);
    const byPath = new Map((data || []).map((d) => [d.path, d.signedUrl]));
    withPath.forEach((t) => { t.attachment.dataUrl = byPath.get(t.attachment.path) || null; });
    return tasks;
  }

  function remember(kind, list, base) {
    latest[kind] = list;
    const snap = new Map();
    serialize(kind, base || list).forEach((v, id) => snap.set(id, v.json));
    snapshot[kind] = snap;
  }

  async function load(kinds = ["tasks", "notes"], opts = {}) {
    const saved = opts.discardLocal ? {} : await readDisk();
    const result = {};
    lastLoadOffline = false;
    await Promise.all(kinds.map(async (kind) => {
      let pend = null;
      if (!opts.discardLocal) {
        if (latest[kind] && snapshot[kind]) pend = pendingOf(kind, latest[kind], snapshot[kind]);
        else if (saved[kind]) pend = pendingOf(kind, saved[kind].list, new Map(saved[kind].snap));
      }
      let fresh;
      try {
        const firstWithCopy = !latest[kind] && saved[kind];
        if (firstWithCopy && typeof navigator !== "undefined" && navigator.onLine === false) { const e = new Error("Offline"); e.offline = true; throw e; }
        fresh = await (firstWithCopy ? Promise.race([fetchKind(kind), timeoutAfter(8000)]) : fetchKind(kind));
      } catch (err) {
        if (!isOfflineError(err)) throw err;
        // No connection: open from the copy kept on this device.
        const src = latest[kind] && snapshot[kind]
          ? { list: latest[kind], snap: snapshot[kind] }
          : saved[kind] ? { list: saved[kind].list, snap: new Map(saved[kind].snap) } : null;
        if (!src) throw err;
        latest[kind] = src.list;
        snapshot[kind] = src.snap;
        lastLoadOffline = true;
        result[kind] = src.list;
        return;
      }
      let merged = pend && (pend.ups.length || pend.dels.size) ? mergePending(fresh, pend) : fresh;
      if (kind === "tasks") merged = await signAttachments(merged);
      remember(kind, merged, fresh);
      result[kind] = merged;
    }));
    scheduleCache();
    if (lastLoadOffline) { setState("offline"); scheduleRetry(); }
    else if (!destroyed && hasChanges()) { setState("saving"); clearTimeout(timer); timer = setTimeout(flush, 400); }
    return result;
  }

  async function uploadPendingAttachments(list) {
    for (const t of list || []) {
      const a = t && t.attachment;
      if (a && !a.path && typeof a.dataUrl === "string" && a.dataUrl.startsWith("data:")) {
        const path = `${userId}/${t.id}/${Date.now()}-${safeName(a.name)}`;
        const blob = dataUrlToBlob(a.dataUrl);
        const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, upsert: false });
        if (error) throw error;
        a.path = path; // same object the UI holds, so the next diff sees it
      }
    }
  }

  async function ensureSession() {
    if (typeof navigator !== "undefined" && navigator.onLine === false) { const e = new Error("Offline"); e.offline = true; throw e; }
    // with a bad connection a stale login can take very long to refresh — don't wait for it
    const { data } = await Promise.race([supabase.auth.getSession(), timeoutAfter(8000)]);
    if (!data || !data.session) { const e = new Error("Not signed in right now"); e.offline = true; throw e; }
  }

  async function writeKind(kind) {
    const list = latest[kind];
    if (!list) return false;
    if (kindChanged(kind)) await ensureSession();
    if (kind === "tasks") await uploadPendingAttachments(list);
    const local = serialize(kind, list);
    const snap = snapshot[kind];
    const upserts = [];
    const deletes = [];
    local.forEach((v, id) => { if (snap.get(id) !== v.json) upserts.push(v); });
    snap.forEach((_, id) => { if (!local.has(id)) deletes.push(id); });
    if (!upserts.length && !deletes.length) return false;
    const table = KINDS[kind].table;
    for (let i = 0; i < upserts.length; i += 500) {
      const rows = upserts.slice(i, i + 500).map((u) => ({ user_id: userId, ...u.row }));
      const { error } = await supabase.from(table).upsert(rows, { onConflict: "user_id,id" });
      if (error) throw error;
    }
    upserts.forEach((u) => snap.set(u.row.id, u.json));
    for (let i = 0; i < deletes.length; i += 200) {
      const ids = deletes.slice(i, i + 200);
      const { error } = await supabase.from(table).delete().eq("user_id", userId).in("id", ids);
      if (error) throw error;
      ids.forEach((id) => snap.delete(id));
    }
    return true;
  }

  function kindChanged(kind) {
    if (!latest[kind] || !snapshot[kind]) return false;
    const local = serialize(kind, latest[kind]);
    const snap = snapshot[kind];
    if (local.size !== snap.size) return true;
    for (const [id, v] of local) if (snap.get(id) !== v.json) return true;
    return false;
  }
  function hasChanges() { return kindChanged("tasks") || kindChanged("notes"); }

  function scheduleRetry() {
    if (destroyed || retryTimer) return;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      if (destroyed) return;
      if (hasChanges()) flush(); else scheduleRefresh(["tasks", "notes"]);
    }, retryDelay);
    retryDelay = Math.min(retryDelay * 2, 120000);
  }
  function resetRetry() { clearTimeout(retryTimer); retryTimer = null; retryDelay = 15000; }

  function flush() {
    if (flushing) { again = true; return flushing; }
    flushing = (async () => {
      const touched = new Set();
      let failed = false;
      do {
        again = false;
        for (const kind of ["tasks", "notes"]) {
          try {
            if (await writeKind(kind)) touched.add(kind);
          } catch (err) {
            failed = true;
            onError && onError(err);
            if (isOfflineError(err)) {
              // keep the local changes (they are also saved on this device) and retry later
              setState("offline");
              scheduleRetry();
            } else {
              setState("error");
              try {
                const fresh = await load([kind], { discardLocal: true });
                onRemote && onRemote(kind, fresh[kind]);
              } catch (e) { /* retry on next focus */ }
            }
          }
        }
      } while (again && !failed);
      flushing = null;
      scheduleCache();
      if (!failed) { setState("idle"); resetRetry(); }
      if (touched.size && channel) channel.send({ type: "broadcast", event: "changed", payload: { kinds: [...touched] } }).catch(() => {});
      if (pendingKinds.size) scheduleRefresh();
    })();
    return flushing;
  }

  function persist(kind, list) {
    latest[kind] = list;
    scheduleCache();
    if (!hasChanges()) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setState("offline"); // saved on this device; sent when the connection returns
      scheduleRetry();
      return;
    }
    setState("saving");
    clearTimeout(timer);
    timer = setTimeout(flush, 400);
  }

  async function flushNow() { clearTimeout(timer); await flush(); }

  function scheduleRefresh(kinds) {
    (kinds || []).forEach((k) => pendingKinds.add(k));
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(async () => {
      if (destroyed) return;
      if (flushing || hasChanges()) { clearTimeout(timer); flush(); return; }
      const list = [...pendingKinds].filter((k) => KINDS[k]);
      pendingKinds.clear();
      if (!list.length) return;
      try {
        const before = { tasks: new Map(snapshot.tasks), notes: new Map(snapshot.notes) };
        const fresh = await load(list);
        list.forEach((kind) => {
          const now = snapshot[kind];
          let same = now.size === before[kind].size;
          if (same) for (const [id, j] of now) if (before[kind].get(id) !== j) { same = false; break; }
          if (!same) onRemote && onRemote(kind, fresh[kind]);
        });
        if (lastLoadOffline) { setState("offline"); scheduleRetry(); }
        else { resetRetry(); if (state === "offline" || state === "error") setState("idle"); }
      } catch (e) {
        list.forEach((k) => pendingKinds.add(k));
      }
    }, 250);
  }

  function subscribe() {
    channel = supabase.channel("tm:" + userId, { config: { broadcast: { self: false } } });
    channel.on("broadcast", { event: "changed" }, (msg) => scheduleRefresh((msg.payload && msg.payload.kinds) || ["tasks", "notes"]));
    channel.subscribe();
  }

  function refreshAll() { scheduleRefresh(["tasks", "notes"]); }

  const onOnline = () => { if (destroyed) return; resetRetry(); if (hasChanges()) { clearTimeout(timer); flush(); } else scheduleRefresh(["tasks", "notes"]); };
  const onOffline = () => { if (!destroyed) setState("offline"); };
  const onHide = () => { if (document.visibilityState === "hidden") writeCache(); };
  if (typeof window !== "undefined") {
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("pagehide", writeCache);
    document.addEventListener("visibilitychange", onHide);
  }

  function destroy() {
    destroyed = true;
    if (typeof window !== "undefined") {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("pagehide", writeCache);
      document.removeEventListener("visibilitychange", onHide);
    }
    clearTimeout(cacheTimer);
    clearTimeout(retryTimer);
    clearTimeout(timer);
    clearTimeout(refreshTimer);
    if (channel) supabase.removeChannel(channel);
    channel = null;
  }

  /* ---- Notes files & photos ----
     Uploaded straight to the private tm-attachments bucket under
     <user id>/notes/<card id>/…; the note card only keeps {id,name,type,size,path}. */
  async function uploadNoteFile(blob, name, cardId) {
    const path = `${userId}/notes/${safeName(cardId)}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${safeName(name)}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type || "application/octet-stream", upsert: false });
    if (error) throw error;
    return path;
  }
  async function signPaths(paths) {
    if (!paths.length) return new Map();
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 60 * 60 * 24 * 7);
    if (error) throw error;
    return new Map((data || []).filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]));
  }
  async function removeFiles(paths) {
    if (!paths.length) return;
    await supabase.storage.from(BUCKET).remove(paths);
  }

  return { load, persist, latestNotes: () => latest.notes || [], uploadNoteFile, signPaths, removeFiles, flushNow, hasChanges: () => !!flushing || hasChanges(), state: () => state, subscribe, refreshAll, destroy };
}

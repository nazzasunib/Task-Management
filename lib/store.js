/* Task Management data layer.
   The UI keeps exactly the same in-memory shapes the original app kept in
   localStorage (a tasks array and a note-categories array). This store loads
   them from Supabase, and every time the UI hands back a new array it
   diff-syncs only the rows that actually changed (upsert / delete).
   Other devices signed in to the same account are told "tasks changed" over
   a tiny Realtime broadcast and re-fetch; no data travels on the broadcast. */

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

  const setState = (s) => { if (state !== s) { state = s; onState && onState(s); } };

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

  function remember(kind, list) {
    latest[kind] = list;
    const snap = new Map();
    serialize(kind, list).forEach((v, id) => snap.set(id, v.json));
    snapshot[kind] = snap;
  }

  async function load(kinds = ["tasks", "notes"]) {
    const result = {};
    await Promise.all(kinds.map(async (kind) => {
      let list = await fetchKind(kind);
      if (kind === "tasks") list = await signAttachments(list);
      remember(kind, list);
      result[kind] = list;
    }));
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

  async function writeKind(kind) {
    const list = latest[kind];
    if (!list) return false;
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

  function hasChanges() {
    return ["tasks", "notes"].some((kind) => {
      if (!latest[kind]) return false;
      const local = serialize(kind, latest[kind]);
      const snap = snapshot[kind];
      if (local.size !== snap.size) return true;
      for (const [id, v] of local) if (snap.get(id) !== v.json) return true;
      return false;
    });
  }

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
            const offline = typeof navigator !== "undefined" && navigator.onLine === false;
            setState(offline ? "offline" : "error");
            onError && onError(err);
            if (!offline) {
              try {
                const fresh = await load([kind]);
                onRemote && onRemote(kind, fresh[kind]);
              } catch (e) { /* retry on next focus */ }
            }
          }
        }
      } while (again && !failed);
      flushing = null;
      if (!failed) setState("idle");
      if (touched.size && channel) channel.send({ type: "broadcast", event: "changed", payload: { kinds: [...touched] } }).catch(() => {});
      if (pendingKinds.size) scheduleRefresh();
    })();
    return flushing;
  }

  function persist(kind, list) {
    latest[kind] = list;
    if (!hasChanges()) return;
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
        if (state === "offline" || state === "error") setState("idle");
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

  function destroy() {
    destroyed = true;
    clearTimeout(timer);
    clearTimeout(refreshTimer);
    if (channel) supabase.removeChannel(channel);
    channel = null;
  }

  return { load, persist, latestNotes: () => latest.notes || [], flushNow, hasChanges: () => !!flushing || hasChanges(), state: () => state, subscribe, refreshAll, destroy };
}

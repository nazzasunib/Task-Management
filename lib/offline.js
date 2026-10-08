/* Offline support helpers.
   - A tiny IndexedDB key/value wrapper that keeps a copy of the user's tasks and
     notes on the device (plus the changes that have not reached the server yet).
   - A remembered copy of the signed-in user + profile so the app can open with
     no internet. Everything here fails soft: if the browser blocks storage the
     app simply behaves like before (online only). */

const DB_NAME = "tm-offline";
const STORE = "kv";
const USER_KEY = "tm-offline-user";

let dbPromise = null;
function openDb() {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("no indexedDB"));
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }).catch((e) => { dbPromise = null; throw e; });
  }
  return dbPromise;
}

function run(mode, fn) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const res = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(res && res.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }));
}

export async function idbGet(key) { try { return (await run("readonly", (s) => s.get(key))) || null; } catch (e) { return null; } }
export async function idbSet(key, value) { try { await run("readwrite", (s) => s.put(value, key)); return true; } catch (e) { return false; } }
export async function idbClear() { try { await run("readwrite", (s) => s.clear()); } catch (e) { /* ignore */ } }

/* ---- remembered user (small, so plain localStorage is fine) ---- */
export function saveOfflineUser(authUser, profile) {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify({
      id: authUser.id,
      email: authUser.email || "",
      user_metadata: authUser.user_metadata || {},
      profile: profile || {},
    }));
  } catch (e) { /* ignore */ }
}
export function readOfflineUser() {
  try { const v = JSON.parse(localStorage.getItem(USER_KEY) || "null"); return v && v.id ? v : null; } catch (e) { return null; }
}
export async function clearOfflineData() {
  try { localStorage.removeItem(USER_KEY); } catch (e) { /* ignore */ }
  await idbClear();
}

/* True when an error just means "can't reach the server / not signed in right now",
   i.e. the local copy must be kept and the save retried later. */
export function isOfflineError(err) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  if (!err) return false;
  if (err.offline) return true;
  const msg = String(err.message || err).toLowerCase();
  if (/failed to fetch|networkerror|network request failed|load failed|fetch failed|network error|timed out|timeout|err_internet|offline/.test(msg)) return true;
  if (err.status === 0 || err.status === 401 || err.status === 502 || err.status === 503 || err.status === 504) return true;
  if (/jwt|not authenticated|auth session missing|refresh token/.test(msg)) return true;
  return false;
}

export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  if (process.env.NODE_ENV !== "production") return;
  const go = () => navigator.serviceWorker.register("/sw.js", { scope: "/" })
    .then(() => navigator.serviceWorker.ready)
    .then((reg) => {
      // hand the worker everything this page already loaded so it can be reopened offline
      setTimeout(() => {
        try {
          const urls = performance.getEntriesByType("resource").map((e) => e.name)
            .filter((u) => /\/_next\/static\/|\.(png|ico|webmanifest)(\?|$)|fonts\.(googleapis|gstatic)\.com/.test(u));
          if (reg.active) reg.active.postMessage({ type: "cache-urls", urls: [...new Set(urls)] });
        } catch (e) { /* ignore */ }
      }, 1500);
    })
    .catch(() => {});
  if (document.readyState === "complete") go(); else window.addEventListener("load", go, { once: true });
}

/* Task Management service worker — lets the website and the Android app open
   with no internet. It only caches the app itself (pages, scripts, styles,
   icons, fonts). Your tasks/notes are kept in the app's own on-device storage,
   and Supabase requests are never touched here. */
const VERSION = "tm-v1";
const SHELL = VERSION + "-shell";
const ASSETS = VERSION + "-assets";
const FONTS = VERSION + "-fonts";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL).then((c) => c.addAll(["/", "/manifest.webmanifest", "/icon-192.png", "/logo-icon.png"]).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function timeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)); }

async function navigate(request) {
  const cache = await caches.open(SHELL);
  const url = new URL(request.url);
  const key = url.pathname === "/" || url.pathname === "" ? "/" : url.pathname;
  try {
    const res = await Promise.race([fetch(request), timeout(4000)]);
    if (res && res.ok && res.type === "basic") cache.put(key, res.clone());
    return res;
  } catch (e) {
    return (await cache.match(key)) || (await cache.match("/")) || Response.error();
  }
}

async function cacheFirst(request, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res && (res.ok || res.type === "opaque")) cache.put(request, res.clone());
  return res;
}

async function staleWhileRevalidate(request, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(request);
  const net = fetch(request).then((res) => { if (res && (res.ok || res.type === "opaque")) cache.put(request, res.clone()); return res; }).catch(() => null);
  return hit || (await net) || Response.error();
}

/* The page tells us which files it already loaded (the first visit happens before
   this worker controls the page), so they are stored too and the app can reopen offline. */
self.addEventListener("message", (event) => {
  const d = event.data;
  if (!d || d.type !== "cache-urls" || !Array.isArray(d.urls)) return;
  event.waitUntil((async () => {
    for (const u of d.urls.slice(0, 200)) {
      try {
        const url = new URL(u);
        const fonts = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
        if (!fonts && url.origin !== self.location.origin) continue;
        const cache = await caches.open(fonts ? FONTS : ASSETS);
        if (!(await cache.match(u))) await cache.add(u);
      } catch (e) { /* skip */ }
    }
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(staleWhileRevalidate(req, FONTS));
    return;
  }
  if (url.origin !== self.location.origin) return; // Supabase etc. — never intercepted

  if (req.mode === "navigate") { event.respondWith(navigate(req)); return; }
  if (url.pathname === "/sw.js") return;
  if (url.pathname.startsWith("/_next/static/")) { event.respondWith(cacheFirst(req, ASSETS)); return; }
  if (/\.(png|jpg|jpeg|svg|webp|ico|webmanifest|woff2?)$/.test(url.pathname) || url.pathname === "/manifest.webmanifest") {
    event.respondWith(staleWhileRevalidate(req, ASSETS));
  }
});

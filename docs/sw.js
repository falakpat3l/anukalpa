// Offline use for the website. The Android app does not use this file: it already has every file inside.
// The page itself comes from the network first, so an update reaches people on their next visit.
// Fonts, icons and the medicine lists are kept after their first use (the lists are big, so only the ones opened).
// After updating the lists in data/, raise VERSION so returning visitors download the new ones.
var VERSION = "v1";
var CACHE = "anukalpa-" + VERSION;
var SHELL = ["./", "manifest.webmanifest", "icon.svg", "icon-192.png",
  "fonts/exo2_regular.woff2", "fonts/exo2_semibold.woff2", "fonts/exo2_bold.woff2"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf("anukalpa-") === 0 && k !== CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function keep(e, key, res) {
  if (!res || !res.ok || res.type !== "basic") return;
  var copy = res.clone();
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.put(key, copy); }).catch(function () { /* storage full */ }));
}

self.addEventListener("fetch", function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;

  // The page (any ?q=... link): network first, the saved copy when offline.
  if (req.mode === "navigate") {
    var home = new URL("./", self.registration.scope).href;
    // "no-cache" asks the server whether the page changed, so a new version is never held back.
    e.respondWith(fetch(req.url, {cache: "no-cache", credentials: "same-origin"}).then(function (res) {
      keep(e, home, res);
      return res;
    }).catch(function () {
      return caches.open(CACHE).then(function (c) { return c.match(home); }).then(function (hit) { return hit || Response.error(); });
    }));
    return;
  }

  // Everything else (fonts, icons, data): the saved copy first, otherwise download and keep it.
  e.respondWith(caches.open(CACHE).then(function (c) { return c.match(req); }).then(function (hit) {
    return hit || fetch(req).then(function (res) { keep(e, req, res); return res; });
  }));
});

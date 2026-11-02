// Offline use for the website. The Android app does not use this file: it already has every file inside.
// The page, app.js, style.css, data/index.json and data/manifest.json come from the network first,
// so an update reaches people on their next visit (the saved copy is used when offline).
// Fonts, icons and the medicine lists are kept after their first use (the lists are big, so only the ones opened).
// After updating the lists in data/, raise VERSION so returning visitors download the new ones.
//
// Security: only complete, plain answers from this site are saved (GET, status 200, not redirected).
// A data file is saved only if it is valid JSON and matches its SHA-256 in data/manifest.json,
// so a cut-off or damaged download can never get stuck in the saved copy.
var VERSION = "v2";
var CACHE = "anukalpa-" + VERSION;
var SHELL = ["./", "app.js", "style.css", "manifest.webmanifest", "icon.svg", "icon-192.png",
  "fonts/exo2_regular.woff2", "fonts/exo2_semibold.woff2", "fonts/exo2_bold.woff2"];
var FRESH = ["app.js", "style.css", "data/index.json", "data/manifest.json"];

function here(path) { return new URL(path, self.registration.scope).href; }

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf("anukalpa-") === 0 && k !== CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function hex(buf) {
  return Array.prototype.map.call(new Uint8Array(buf), function (b) { return (b < 16 ? "0" : "") + b.toString(16); }).join("");
}

// The newest data/manifest.json this worker has downloaded (a promise of its JSON, or null).
var manifest = null;
function currentManifest() {
  if (manifest) return manifest;
  return caches.open(CACHE).then(function (c) { return c.match(here("data/manifest.json")); })
    .then(function (r) { return r ? r.json() : null; }).catch(function () { return null; });
}

// Is this data file (name like "IN.json") whole? It must be valid JSON and match the manifest.
function dataOk(name, res) {
  var body = res.arrayBuffer().then(function (buf) {
    return {buf: buf, json: JSON.parse(new TextDecoder().decode(buf))};  // a cut-off file fails here
  });
  if (name === "manifest.json") {
    manifest = body.then(function (d) { return d.json && typeof d.json.files === "object" ? d.json : null; }, function () { return null; });
    return manifest.then(function (m) { return !!m; });
  }
  return body.then(function (d) {
    return currentManifest().then(function (m) {
      var want = m && m.files && m.files[name];
      if (!want) return false;
      return crypto.subtle.digest("SHA-256", d.buf).then(function (h) { return hex(h) === want; });
    });
  }).catch(function () { return false; });
}

// Save a copy, but never an error, a redirect, an answer from another site, or a damaged data file.
function keep(e, key, res) {
  if (!res || res.status !== 200 || res.type !== "basic" || res.redirected) return;
  var copy = res.clone(), path = new URL(typeof key === "string" ? key : key.url).pathname;
  var data = new URL(here("data/")).pathname, name = path.indexOf(data) === 0 ? path.slice(data.length) : "";
  var ok = /^[\w-]+\.json$/.test(name) ? dataOk(name, res.clone()) : Promise.resolve(true);
  e.waitUntil(ok.then(function (yes) {
    if (yes) return caches.open(CACHE).then(function (c) { return c.put(key, copy); });
  }).catch(function () { /* storage full */ }));
}

// From the network (skipping the browser's short-term cache), the saved copy when offline.
function networkFirst(e, req, key) {
  return fetch(req.url, {cache: req.cache === "reload" ? "reload" : "no-cache", credentials: "same-origin"}).then(function (res) {
    keep(e, key, res);
    return res;
  }).catch(function () {
    return caches.open(CACHE).then(function (c) { return c.match(key); }).then(function (hit) { return hit || Response.error(); });
  });
}

self.addEventListener("fetch", function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;

  // The page (any ?q=... link) is saved once, as the home page.
  if (req.mode === "navigate") { e.respondWith(networkFirst(e, req, here("./"))); return; }

  // Small files that must match the page. "reload" is the page asking again after a damaged download.
  var plain = url.origin + url.pathname;
  if (req.cache === "reload" || FRESH.some(function (f) { return here(f) === plain; })) {
    e.respondWith(networkFirst(e, req, req));
    return;
  }

  // Everything else (fonts, icons, the country lists): the saved copy first, otherwise download and keep it.
  e.respondWith(caches.open(CACHE).then(function (c) { return c.match(req); }).then(function (hit) {
    return hit || fetch(req).then(function (res) { keep(e, req, res); return res; });
  }));
});

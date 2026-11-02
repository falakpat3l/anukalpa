// Data: data/index.json lists the countries; data/<code>.json holds that country's products.
// Each product: {b: brand, s: [[salt, strength]], f: form, m: maker}. Built by backend/build_data.py.
var countries = [], loaded = {}, loading = {}, pick = "IN";
var indexState = "loading";  // "loading", "error", "damaged" or "ok"
var failed = null;           // the choice (country code or ALL) whose list failed to load
var failedBad = false;       // that list downloaded but did not pass the check (cut off or damaged)
var want = 0;                // counts country choices, so a slow old download does not overwrite a newer choice
var byKey = {};              // salt combination -> every product with it, for fast "same salts" lookups
var allRows = [];            // every loaded product, rebuilt when a country loads
var shownRows = [];          // products on screen now, for the Share buttons
var pushNext = false;        // the next search gets its own history entry (a tap, not typing)
var commit = false;          // the next search with results goes into Recent
var last = null;             // the last search that found something: {q, c}
var q = document.getElementById("q"), out = document.getElementById("out"), chips = document.getElementById("countries");
var stat = document.getElementById("status"), field = document.getElementById("field"), recentBox = document.getElementById("recent");
var IN_APP = location.host === "appassets.androidplatform.net";
var SITE = "https://falakpat3l.github.io/anukalpa/";

// Short labels for the country buttons and badges (full names stay in index.json).
var SHORT = {IN: "India", US: "US", CA: "Canada", EU: "EU"};
// A few searches to try, per choice. Each one exists in that list.
var EXAMPLES = {IN: ["Dolo 650", "Crocin", "Pan 40", "metformin"], US: ["Tylenol", "metformin", "atorvastatin"],
  CA: ["Tylenol", "metformin", "amoxicillin"], EU: ["Abilify", "insulin glargine"], ALL: ["Dolo 650", "paracetamol", "metformin"]};

// The same medicine can have a different generic name by country (US name -> international name).
var ALIAS = {"acetylsalicylic acid": "aspirin", "clavulanate potassium": "clavulanic acid", "potassium clavulanate": "clavulanic acid"};
// Single words: other names and spellings of the same salt.
var WORD = {acetaminophen: "paracetamol", albuterol: "salbutamol", epinephrine: "adrenaline", norepinephrine: "noradrenaline",
  glyburide: "glibenclamide", meperidine: "pethidine", rifampin: "rifampicin", cyclosporine: "ciclosporin",
  levalbuterol: "levosalbutamol", acetylsalicylic: "aspirin", lidocaine: "lignocaine", amoxycillin: "amoxicillin",
  cephalexin: "cefalexin", besilate: "besylate", mesilate: "mesylate", sulphate: "sulfate", clavulanate: "clavulanic"};
// Salt forms. "Pantoprazole 40 mg" is the same medicine as "Pantoprazole sodium 40 mg",
// but "Diclofenac sodium" and "Diclofenac potassium" are not the same salt.
var FORMS = {};
("sodium potassium calcium magnesium hydrochloride hcl dihydrochloride hydrobromide besylate mesylate maleate fumarate " +
 "succinate tartrate bitartrate citrate sulfate bisulfate phosphate oxalate acetate hyclate axetil anhydrous hydrate " +
 "monohydrate dihydrate trihydrate hemihydrate sesquihydrate").split(" ").forEach(function (w) { FORMS[w] = 1; });
// Minerals stay whole: "Calcium citrate" is not just "Calcium".
var MINERALS = {sodium: 1, potassium: 1, calcium: 1, magnesium: 1, zinc: 1, ferrous: 1, ferric: 1, iron: 1, lithium: 1, copper: 1};

function esc(t) {
  return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function norm(t) { return String(t).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
// One spelling for each name, so "acetaminophen" finds paracetamol and "amoxycillin" finds amoxicillin.
function canon(t) {
  var n = norm(t);
  if (ALIAS[n]) return ALIAS[n];
  n = n.split(" ").map(function (w) { return WORD[w] || w; }).join(" ");
  return ALIAS[n] || n;
}
// Salt name for matching. Canada writes "Amlodipine (Amlodipine Besylate)": the part in brackets is dropped.
function inn(name) {
  var base = String(name).replace(/\s*\([^()]*\)\s*$/, "");
  return canon(norm(base) ? base : name);
}
// The salt without its form: "pantoprazole sodium" -> "pantoprazole".
function bare(n) {
  var w = n.split(" ");
  while (w.length > 1 && FORMS[w[w.length - 1]]) w.pop();
  return w.length === 1 && MINERALS[w[0]] ? n : w.join(" ");
}
function fmt(n) { return Number(n).toLocaleString("en"); }
// Same salts AND same strength count as a match (e.g. paracetamol 500 mg), whatever the country.
// Plain weights are compared in mg, so "1 g" matches "1000 mg".
function strength(t) {
  var s = (t || "").toLowerCase().replace(/\s+/g, "").replace(/micrograms?|µg|μg/g, "mcg").replace(/milligrams?/g, "mg");
  var m = /^(\d*\.?\d+)(mcg|mg|g)$/.exec(s);
  return m ? +(parseFloat(m[1]) * {mcg: 0.001, mg: 1, g: 1000}[m[2]]).toFixed(6) + "mg" : s;
}
// p.key groups products by salts without their form, p.full keeps the exact salts (same order).
function addKeys(p) {
  var parts = p.s.map(function (s) {
    var full = inn(s[0]), st = strength(s[1]);
    return {k: bare(full) + "@" + st, f: full, plain: bare(full) === full};
  }).sort(function (a, b) { return a.k < b.k ? -1 : a.k > b.k ? 1 : a.f < b.f ? -1 : a.f > b.f ? 1 : 0; });
  p.key = parts.map(function (x) { return x.k; }).join("|");
  p.fk = parts.map(function (x) { return x.f + "@" + x.k; }).join("|");
  p.full = parts.map(function (x) { return x.f; });
  p.plain = parts.map(function (x) { return x.plain; });
}
// Same salts: equal names, or one side gives only the plain salt ("Pantoprazole" vs "Pantoprazole sodium").
function sameSalts(a, b) {
  for (var i = 0; i < a.full.length; i++) {
    if (a.full[i] !== b.full[i] && !a.plain[i] && !b.plain[i]) return false;
  }
  return true;
}
function country(code) { return countries.filter(function (c) { return c.code === code; })[0] || {code: code, name: code}; }
function longName(code) { return code === "ALL" ? "all countries" : country(code).name; }
function shortName(code) { return code === "ALL" ? "All" : SHORT[code] || country(code).name; }
function codesFor(choice) { return choice === "ALL" ? countries.map(function (c) { return c.code; }) : [choice]; }
function isReady(choice) { return codesFor(choice).every(function (c) { return loaded[c]; }); }
function known(choice) { return choice === "ALL" || countries.some(function (c) { return c.code === choice; }); }
function cut(t, n) { return t.length > n ? t.slice(0, n - 1) + "…" : t; }

// The data files store each form, maker, salt and strength once (see backend/build_data.py).
// Turn each compact row back into {b: brand, s: [[salt, strength]], f: form, m: maker}.
function expand(d) {
  return d.rows.map(function (r) {
    var s = [];
    for (var i = 3; i < r.length; i += 2) s.push([d.salts[r[i]], d.strengths[r[i + 1]]]);
    return {b: r[0], f: d.forms[r[1]], m: d.makers[r[2]], s: s};
  });
}

// Data integrity: data/manifest.json (written by backend/build_data.py) has the SHA-256 of every data file.
// A file is used only if it matches, so a cut-off or damaged download is never shown as real data.
var hashes = null;  // {"IN.json": "<sha-256 hex>", ...} once manifest.json is loaded

function damaged() { var e = new Error("damaged"); e.damaged = true; return e; }
function hex(buf) {
  return Array.prototype.map.call(new Uint8Array(buf), function (b) { return (b < 16 ? "0" : "") + b.toString(16); }).join("");
}
// The SHA-256 of buf, or null where the browser cannot work it out
// (crypto.subtle only exists on https and localhost; the Android app is https).
function sha256(buf) {
  var subtle = window.crypto && window.crypto.subtle;
  if (!subtle) return Promise.resolve(null);
  return subtle.digest("SHA-256", buf).then(hex, function () { return null; });
}
// Download data/<name>, check it against the manifest, then read the JSON.
// A file that does not match is downloaded once more straight from the site (skipping any saved copy).
function getJson(name, again) {
  return fetch("data/" + name, again ? {cache: "reload"} : undefined).then(function (r) {
    if (!r.ok) throw new Error(r.status);
    return r.arrayBuffer();
  }).then(function (buf) {
    return sha256(buf).then(function (got) {
      if (hashes && (!hashes[name] || (got && got !== hashes[name]))) throw damaged();
      try { return JSON.parse(new TextDecoder().decode(buf)); } catch (e) { throw damaged(); }
    });
  }).catch(function (err) {
    if (err.damaged && !again) return getJson(name, true);
    throw err;
  });
}

function load(code) {
  if (loaded[code]) return Promise.resolve(loaded[code]);
  // Share one download per list: two quick taps must not add every product twice.
  if (loading[code]) return loading[code];
  loading[code] = getJson(code + ".json").then(function (d) {
    if (!d || !["rows", "forms", "makers", "salts", "strengths"].every(function (k) { return Array.isArray(d[k]); })) throw damaged();
    var rows = expand(d);
    rows.forEach(function (p) {
      p.c = code; p.nb = norm(p.b); addKeys(p);
      p.ns = p.s.map(function (s) { return norm(s[0]) + " " + inn(s[0]); }).join(" ");
    });
    // Only now that the whole list is read, add it to the search.
    rows.forEach(function (p) { (byKey[p.key] = byKey[p.key] || []).push(p); });
    loaded[code] = rows; delete loading[code];
    allRows = [].concat.apply([], countries.map(function (c) { return loaded[c.code] || []; }));
    return rows;
  }).catch(function (err) {
    delete loading[code];  // not kept, so Retry downloads it again
    throw err;
  });
  return loading[code];
}

// Pick a country (or ALL): load what it needs, then search again.
function choose(choice) {
  pick = choice; failed = null; drawChips();
  var mine = ++want, ready = isReady(choice);
  search();
  if (ready) return;
  Promise.all(codesFor(choice).map(load)).then(function () {
    if (mine === want) search();
  }, function (err) {
    if (mine === want) { failed = choice; failedBad = !!(err && err.damaged); search(); }
  });
}

function query(text, c) {
  var parts = [];
  if (text) parts.push("q=" + encodeURIComponent(text));
  if (c !== "IN") parts.push("c=" + c);
  return parts.length ? "?" + parts.join("&") : "";
}

function setUrl(text) {
  // Keep the search in the link, so it can be shared or reopened. A tap gets its own entry, so Back returns to it.
  var s = query(text, pick), push = pushNext && s !== location.search;
  pushNext = false;
  try { history[push ? "pushState" : "replaceState"](null, "", s || location.pathname); } catch (e) { /* not allowed here */ }
}

// Read ?q=...&c=... from the address (on start and on Back / Forward).
function readUrl() {
  var u = new URLSearchParams(location.search), c = (u.get("c") || "IN").toUpperCase();
  q.value = u.get("q") || "";
  return c === "ALL" || /^[A-Z]{2}$/.test(c) ? c : "IN";
}

// Recent searches, kept on this device only.
var RECENT_KEY = "anukalpa.recent";
var recent = (function () {
  try {
    var v = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(v) ? v.filter(function (r) { return r && typeof r.q === "string" && typeof r.c === "string" && r.q; }).slice(0, 5) : [];
  } catch (e) { return []; }
})();
function saveRecent() {
  try { if (recent.length) localStorage.setItem(RECENT_KEY, JSON.stringify(recent)); else localStorage.removeItem(RECENT_KEY); } catch (e) { /* storage off */ }
}
function remember(text, c) {
  var n = norm(text);
  // Drop the same search, and shorter versions of it typed on the way ("dol" before "dolo 650").
  recent = [{q: text, c: c}].concat(recent.filter(function (r) {
    var m = norm(r.q);
    return m !== n && !(r.c === c && n.indexOf(m) === 0);
  })).slice(0, 5);
  saveRecent();
}
// Save the current search if it found something, or the next one that does (a list may still be loading).
function commitNow() {
  if (last && last.q === q.value.trim() && last.c === pick) { remember(last.q, last.c); commit = false; }
  else commit = true;
}
function drawRecent() {
  var show = !q.value.trim() && recent.length > 0;
  recentBox.hidden = !show;
  if (!show) { recentBox.innerHTML = ""; return; }
  recentBox.innerHTML = '<p class="label">Recent</p><div class="chips">' + recent.map(function (r, i) {
    return '<button type="button" data-r="' + i + '">' + esc(cut(r.q, 40)) + (r.c !== pick ? "<span>" + esc(shortName(r.c)) + "</span>" : "") + "</button>";
  }).join("") + '</div><button type="button" class="link" data-clear-recent>Clear</button>';
}

function exampleChips(choice) {
  return '<div class="chips">' + (EXAMPLES[choice] || EXAMPLES.ALL).map(function (e) {
    return '<button type="button" data-q="' + esc(e) + '">' + esc(e) + "</button>";
  }).join("") + "</div>";
}

var SHARE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>';

function card(p, twin, i) {
  // The same salts and strength elsewhere: other brands, grouped by country (only lists already loaded).
  var byC = {}, seenC = {};
  (byKey[p.key] || []).forEach(function (o) {
    // Skip this product itself, and names that differ only in case or spacing.
    if (o === p || (o.c === p.c && o.nb === p.nb) || !sameSalts(p, o)) return;
    var l = byC[o.c] = byC[o.c] || [], seen = seenC[o.c] = seenC[o.c] || {};
    if (!seen[o.nb]) { seen[o.nb] = 1; l.push(o.b); }
  });
  var meta = [p.f, p.m].filter(Boolean).map(esc).join(" &middot; ");
  var generic = p.s.map(function (s) { return esc((s[0] + " " + s[1]).trim()); }).join(' <span class="plus">+</span> ');
  var top = '<article class="card"><div class="head"><h2 class="brand">' + esc(p.b) + '</h2><span class="badge">' + esc(shortName(p.c)) + "</span>" +
    '<button type="button" class="share" data-share="' + i + '" aria-label="Share ' + esc(p.b) + '">' + SHARE_ICON + "Share</button></div>" +
    (meta ? '<p class="meta">' + meta + "</p>" : "") +
    '<div class="ask"><p class="label">Generic name to ask for</p><p class="generic">' + generic + "</p></div>";
  // A card higher up already lists the brands with these salts: point to it instead of repeating them.
  if (twin) return top + '<p class="none">Same salts and strength as ' + esc(twin.b) + " above.</p></article>";
  var order = [p.c].concat(countries.map(function (c) { return c.code; }).filter(function (c) { return c !== p.c; }));
  var groups = order.filter(function (c) { return byC[c]; }).map(function (c) {
    var names = byC[c], shown = names.slice(0, 12);
    return '<div class="group"><p class="gname">' + esc(country(c).name) + " <span>&middot; " + fmt(names.length) + "</span></p>" +
      '<div class="chips">' + shown.map(function (n) {
        return '<button type="button" data-q="' + esc(n) + '" data-c="' + esc(c) + '" title="' + esc(n) + '">' + esc(n) + "</button>";
      }).join("") + (names.length > shown.length ? '<span class="more">+' + fmt(names.length - shown.length) + " more</span>" : "") + "</div></div>";
  }).join("");
  return top + '<div class="same"><p class="label">Same salts and strength</p>' +
    (groups || '<p class="none">No other brand found in the loaded ' + (Object.keys(loaded).length > 1 ? "lists" : "list") + ".</p>") +
    "</div></article>";
}

// Lower is better: exact brand, brand start, word in brand, salt, then anywhere.
function rank(p, t, ti) {
  if (p.nb === t) return 0;
  if (p.nb.indexOf(t) === 0) return 1;
  if (p.nb.indexOf(" " + t) >= 0) return 2;
  if (p.ns.indexOf(ti) >= 0) return 3;
  if (p.nb.indexOf(t) >= 0) return 4;
  return 5;
}

// Shown when a data file did not match its SHA-256 in data/manifest.json.
var BAD = "The download was cut off or damaged, so it was not used. Try again.";

function message(title, text, extra) {
  return '<div class="card empty"><h2>' + title + "</h2>" + (text ? "<p>" + text + "</p>" : "") + (extra || "") + "</div>";
}

function search() {
  var raw = q.value.trim(), t = norm(raw);
  field.classList.toggle("has", q.value.length > 0);
  setUrl(raw);
  drawRecent();
  shownRows = [];
  if (indexState !== "ok") {
    stat.textContent = "";
    out.innerHTML = indexState === "error" || indexState === "damaged"
      ? message("Could not load the medicine lists", indexState === "damaged" ? BAD : "Check your connection and try again.",
        '<button type="button" class="pill" data-retry>Try again</button>')
      : message("Loading&hellip;", "", '<div class="load"><i></i></div>');
    return;
  }
  if (failed === pick && !isReady(pick)) {
    stat.textContent = "";
    out.innerHTML = message("Could not load the " + esc(pick === "ALL" ? "lists" : country(pick).name + " list"),
      failedBad ? BAD : "Check your connection and try again.", '<button type="button" class="pill" data-retry>Try again</button>');
    return;
  }
  if (!isReady(pick)) {
    var total = codesFor(pick).reduce(function (n, c) { return n + (country(c).count || 0); }, 0);
    stat.textContent = "";
    out.innerHTML = message("Loading " + esc(pick === "ALL" ? "all lists" : "the " + country(pick).name + " list") + "&hellip;",
      total ? fmt(total) + " products. Your search runs as soon as it is ready." : "", '<div class="load"><i></i></div>');
    return;
  }
  last = null;
  if (t.length < 2) {
    commit = false;
    stat.textContent = "";
    // Text with no English letters or digits, like "डोलो" or "%": the lists only have English names.
    out.innerHTML = raw && !t
      ? message("Type in English letters", "Names are listed in English, for example Dolo 650 or paracetamol.", exampleChips(pick))
      : message(t ? "Keep typing" : "What are you looking for?", "Type at least 2 letters of a brand or a salt. Try one of these:", exampleChips(pick));
    return;
  }

  var ti = canon(t);
  var words = t.split(" ").map(function (w) { return WORD[w] || w; });
  var list = pick === "ALL" ? allRows : loaded[pick];
  var hits = [], seen = {};
  list.forEach(function (p) {
    var ok = p.nb.indexOf(t) >= 0 || p.ns.indexOf(ti) >= 0;
    // Several words, like "paracetamol 650": every word must appear in the brand, salts or strengths.
    if (!ok && words.length > 1) {
      var hay = p.nb + " " + p.ns + " " + p.s.map(function (s) { return norm(s[1]); }).join(" ");
      ok = words.every(function (w) { return hay.indexOf(w) >= 0; });
    }
    if (!ok) return;
    var r = rank(p, t, ti), k = r + "/" + p.s.length + "/" + p.c;
    // Position among similar hits from the same country: in All mode this mixes the countries instead of listing India first.
    seen[k] = (seen[k] || 0) + 1;
    hits.push({p: p, r: r, i: seen[k]});
  });
  // Best match first, plain products before combinations, then the list's own order.
  hits.sort(function (a, b) { return a.r - b.r || a.p.s.length - b.p.s.length || a.i - b.i; });

  var where = longName(pick);
  if (!hits.length) {
    commit = false;
    stat.textContent = "No match in " + where + ".";
    out.innerHTML = message("No match for &ldquo;" + esc(cut(raw, 60)) + "&rdquo;",
      "Check the spelling, or try the salt name instead of the brand.",
      pick !== "ALL" ? '<button type="button" class="pill" data-all>Search all countries</button>' : "");
    return;
  }
  last = {q: raw, c: pick};
  if (commit) { commit = false; remember(raw, pick); }
  var shown = hits.slice(0, 15);
  stat.textContent = hits.length > shown.length
    ? "Showing " + shown.length + " of " + fmt(hits.length) + " matches in " + where + ". Type more to narrow it down."
    : fmt(hits.length) + (hits.length === 1 ? " match" : " matches") + " in " + where + ".";
  var tip = "";
  if (pick !== "ALL" && countries.some(function (c) { return !loaded[c.code]; })) {
    tip = '<p class="foot">Want brands from other countries too? <button type="button" class="link" data-all>Search all countries</button></p>';
  }
  var firstWith = {};
  shownRows = shown.map(function (h) { return h.p; });
  out.innerHTML = shown.map(function (h, i) {
    var twin = firstWith[h.p.fk];
    if (!twin) firstWith[h.p.fk] = h.p;
    return card(h.p, twin, i);
  }).join("") + tip;
}

function drawChips() {
  chips.innerHTML = [{code: "ALL"}].concat(countries).map(function (c) {
    return '<button type="button" data-c="' + esc(c.code) + '" aria-pressed="' + (c.code === pick) + '"' +
      (c.name ? ' title="' + esc(c.name) + '"' : "") + ">" + esc(shortName(c.code)) + "</button>";
  }).join("");
}

// A short message at the bottom of the screen.
var toastBox = document.getElementById("toast"), toastTimer;
function toast(text) {
  toastBox.textContent = text; toastBox.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { toastBox.classList.remove("show"); }, 2200);
}

function copyText(text) {
  function old() {
    var t = document.createElement("textarea"), ok = false;
    t.value = text; t.setAttribute("readonly", ""); t.style.position = "fixed"; t.style.opacity = "0";
    document.body.appendChild(t); t.select();
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    document.body.removeChild(t);
    return ok ? Promise.resolve() : Promise.reject(new Error("copy"));
  }
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).catch(old);
  } catch (e) { /* fall back below */ }
  return old();
}

// Share one card: the phone's share sheet when there is one, otherwise copy the link.
function share(p) {
  if (!p) return;
  // Inside the Android app the page has no public address, so share the website link.
  var url = (IN_APP ? SITE : location.origin + location.pathname) + query(p.b, p.c);
  var text = p.b + " (" + country(p.c).name + "): ask for " + p.s.map(function (s) { return (s[0] + " " + s[1]).trim(); }).join(" + ");
  function copy() {
    copyText(url).then(function () { toast("Link copied"); }, function () { toast("Could not copy the link"); });
  }
  if (navigator.share) {
    navigator.share({title: p.b, text: text, url: url}).catch(function (e) {
      if (!e || e.name !== "AbortError") copy();  // AbortError: the person closed the share sheet
    });
  } else copy();
}

chips.addEventListener("click", function (e) {
  var b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.c !== pick) pushNext = true;
  choose(b.dataset.c);  // the same country again retries a list that failed
});

function backToTop() {
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({top: 0, behavior: reduce ? "auto" : "smooth"});
  // The tapped button is gone now: keep keyboard focus on the results line.
  stat.focus({preventScroll: true});
}

// Search for text in country c (a tap on a brand, an example or a recent search).
function go(text, c) {
  clearTimeout(timer); clearTimeout(idle);
  q.value = text; pushNext = true; commit = true;
  if (c && c !== pick) choose(c); else search();
  backToTop();
}

out.addEventListener("click", function (e) {
  var b = e.target.closest("button");
  if (!b) return;
  if (b.hasAttribute("data-retry")) { if (indexState !== "ok") start(); else choose(pick); return; }
  if (b.hasAttribute("data-all")) { pushNext = true; commit = true; choose("ALL"); return; }
  if (b.hasAttribute("data-share")) { share(shownRows[+b.dataset.share]); return; }
  // A brand from another country: switch to that country, unless All is on.
  if (b.dataset.q) go(b.dataset.q, pick !== "ALL" ? b.dataset.c : null);
});

recentBox.addEventListener("click", function (e) {
  var b = e.target.closest("button");
  if (!b) return;
  if (b.hasAttribute("data-clear-recent")) { recent = []; saveRecent(); drawRecent(); q.focus(); return; }
  var r = recent[+b.dataset.r];
  if (r) go(r.q, known(r.c) ? r.c : null);
});

var timer, idle;
q.addEventListener("input", function () {
  clearTimeout(timer); timer = setTimeout(search, 120);
  field.classList.toggle("has", q.value.length > 0);
  // Typing stopped for a moment: count it as a search for Recent.
  commit = false; clearTimeout(idle); idle = setTimeout(commitNow, 2000);
});
q.addEventListener("keydown", function (e) {
  if (e.key === "Enter") { clearTimeout(timer); clearTimeout(idle); search(); commitNow(); }
  if (e.key === "Escape" && q.value) { e.preventDefault(); q.value = ""; clearTimeout(timer); clearTimeout(idle); search(); }
});
document.getElementById("clear").addEventListener("click", function () { q.value = ""; clearTimeout(timer); clearTimeout(idle); search(); q.focus(); });
// Press "/" anywhere to jump to the search box.
document.addEventListener("keydown", function (e) {
  if (e.key === "/" && document.activeElement !== q && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); q.focus(); q.select(); }
});
// Back and Forward: show the search from that point.
window.addEventListener("popstate", function () {
  clearTimeout(timer); clearTimeout(idle); commit = false;
  var c = readUrl();
  if (indexState !== "ok") { pick = c; search(); return; }
  choose(known(c) ? c : "IN");
});

function start() {
  indexState = "loading"; search();
  // The manifest first: index.json and every country list are checked against it.
  hashes = null;
  getJson("manifest.json").then(function (m) {
    if (!m || !m.files || typeof m.files !== "object") throw damaged();
    hashes = m.files;
    return getJson("index.json");
  }).then(function (idx) {
    if (!Array.isArray(idx) || !idx.every(function (c) { return c && /^[A-Z]{2}$/.test(c.code) && typeof c.name === "string"; })) throw damaged();
    countries = idx; indexState = "ok";
    if (!known(pick)) pick = "IN";
    choose(pick);
  }).catch(function (err) { indexState = err && err.damaged ? "damaged" : "error"; search(); });
}

// Open a shared link (?q=...&c=...) where it left off.
pick = readUrl();
if (!q.value) q.focus();
start();

// Offline use on the website: keep the page and the lists already opened.
// Not inside the Android app, which has every file already.
try {
  if ("serviceWorker" in navigator && !IN_APP && (location.protocol === "https:" || location.hostname === "localhost")) {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () { /* offline use is optional */ }); });
  }
} catch (e) { /* offline use is optional */ }

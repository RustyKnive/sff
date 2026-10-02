/* ------------------------------------------------------------------
   DATEN (aus Supabase, siehe loadCats)
------------------------------------------------------------------- */
const CFG = window.SFF_CONFIG;
let CATS = [];

/* Kategorien mit Einträgen und Bildern in einer Anfrage laden (REST, ohne Bibliothek)
   und in die Form bringen, mit der der Rest der Seite arbeitet:
   Eintrag: n Name, s Untertitel, t Beschreibung, f Steckbrief [{k,v}], q Suchbegriffe,
   wp Wikipedia-Titel, lb eigene Bildbeschriftungen, img[0..3] eigene Bilder (oder null)
   Bild: src, page, file, fx/fy/z Ausschnitt für die 4:3-Kacheln (null = Mitte, nicht vergrössert),
   edited zugeschnitten (Hinweis im Bildnachweis); cf Verwechslungsgefahr [{name, diff}], snd Tierstimme {src, page, file} */
async function loadCats(){
  const select = "id,name,description,goal,latin,labels,cover_entry_id,"
    + "entries!entries_category_id_fkey(id,name,subtitle,description,facts,search_terms,wp,labels,confusions,sound_path,sound_page,sound_file,"
    + "images(position,storage_path,source_page,source_file,thumb_x,thumb_y,thumb_zoom,edited))";
  const url = CFG.url + "/rest/v1/categories?select=" + encodeURIComponent(select)
    + "&order=sort.asc,name.asc&entries.order=sort.asc,name.asc";
  const r = await fetch(url, { headers:{ apikey:CFG.key } });
  if(!r.ok) throw new Error("HTTP " + r.status);
  const rows = await r.json();
  const publicUrl = path => CFG.url + "/storage/v1/object/public/" + CFG.bucket + "/"
    + path.split("/").map(encodeURIComponent).join("/");
  return rows.map(c => ({
    id:c.id, name:c.name, desc:c.description, goal:c.goal || "", latin:c.latin, labels:c.labels,
    cover:Math.max(0, c.entries.findIndex(e => e.id === c.cover_entry_id)),
    items:c.entries.map(e => ({
      id:e.id, n:e.name, s:e.subtitle, t:e.description, f:e.facts || [],
      q:e.search_terms || [], wp:e.wp, lb:e.labels, cf:e.confusions || [],
      snd:e.sound_path ? { src:publicUrl(e.sound_path), page:e.sound_page, file:e.sound_file } : null,
      img:[1,2,3,4].map(p => {
        const i = e.images.find(x => x.position === p);
        return i ? { src:publicUrl(i.storage_path), page:i.source_page, file:i.source_file,
          fx:i.thumb_x, fy:i.thumb_y, z:i.thumb_zoom, edited:i.edited } : null;
      })
    }))
  }));
}

/* ------------------------------------------------------------------
   VERSIONEN: Website-Version und benötigte Datenbank-Version stehen in js/version.js,
   die Datenbank meldet ihre Version in der Tabelle app_meta (015).
------------------------------------------------------------------- */
const VERSION = window.SFF_VERSION || { app:"?", datum:"", schema:0 };
let dbSchema = null;   // Version der Datenbank; null = unbekannt (z. B. ohne Internet)
async function loadSchemaVersion(){
  const r = await fetch(CFG.url + "/rest/v1/app_meta?select=schema_version", { headers:{ apikey:CFG.key } });
  if(r.status === 404) return 0;   // Tabelle fehlt: Datenbank älter als 015
  if(!r.ok) throw new Error("HTTP " + r.status);
  return (await r.json())[0]?.schema_version || 0;
}
const schemaCheck = loadSchemaVersion().then(v => { dbSchema = v; showVersion(); }).catch(() => {});
const schemaMissing = () => dbSchema !== null && dbSchema < VERSION.schema;
const schemaHint = () => `Die Datenbank ist auf Version ${dbSchema || "14 oder älter"}, diese Website braucht Version ${VERSION.schema}. `
  + `Im Supabase-Dashboard (SQL Editor) die fehlenden Dateien bis supabase/${String(VERSION.schema).padStart(3, "0")}_… ausführen.`;
// Anzeige unter Einstellungen → Version
function showVersion(){
  const el = document.getElementById("versionInfo");
  if(!el) return;
  const datum = VERSION.datum ? new Date(VERSION.datum + "T00:00").toLocaleDateString("de-CH", { day:"numeric", month:"long", year:"numeric" }) : "";
  el.textContent = `Website ${VERSION.app}${datum ? " vom " + datum : ""} · Datenbank ${dbSchema === 0 ? "14 oder älter" : dbSchema ?? "nicht erreichbar"}`
    + (schemaMissing() ? ` (benötigt ${VERSION.schema}, Update fehlt)` : "");
}

/* ------------------------------------------------------------------
   BILDER (eigene aus Supabase, sonst live von Wikimedia; Suche in js/wikimedia.js)
------------------------------------------------------------------- */
const ARROW_L = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';
const ARROW_R = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>';
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
// Nur http(s)-Adressen als Link verwenden (kein «javascript:» o. Ä.)
const safeUrl = s => /^https?:\/\//i.test(s || "") ? s : null;

// Direktlink auf einen Eintrag: #/<kategorie>/<name als Slug>, z. B. #/baeume/buche
const slugify = s => s.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue")
  .replace(new RegExp(String.fromCharCode(223), "g"), "ss").normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const entryLink = (cat, item) => "#/" + cat.id + "/" + slugify(item.n);
const entryUrl = (cat, item) => location.href.split("#")[0] + entryLink(cat, item);
function findByName(name){
  for(const cat of CATS){ const item = cat.items.find(it => it.n === name); if(item) return { cat, item }; }
  return null;
}

const imgQueue = limiter(4);   // gleichzeitige Bild-Downloads

// Hauptbild eines Eintrags (zwischengespeichert, auch für die Übersicht verwendet)
const baseName = (cat, item) => item.wp || (cat.latin ? item.s : item.n);
const mainCache = new Map();
function mainImage(cat, item){
  const key = baseName(cat, item);
  if(!mainCache.has(key)){
    mainCache.set(key, wikiImage(key).catch(() => commonsImage(key, new Set())));
  }
  return mainCache.get(key);
}

// Welche Bildplätze (0–3) gezeigt werden: nur die eigenen Bilder.
// Hat ein Eintrag gar keine, sucht die Seite alle 4 online (Notlösung, siehe CLAUDE.md).
function shownSlots(item){
  const own = [0, 1, 2, 3].filter(k => item.img[k]);
  return own.length ? own : [0, 1, 2, 3];
}

// Eigenes Bild aus Supabase Storage (falls hinterlegt)
function localImage(cat, item, k){
  return item.img[k] || null;
}

// Die 4 Online-Bilder eines Eintrags ermitteln (zwischengespeichert)
const itemCache = new Map();
function resolveItem(cat, item){
  const key = item.id;
  if(itemCache.has(key)) return itemCache.get(key);
  const used = new Set();
  const base = baseName(cat, item);
  const main = mainImage(cat, item).then(img => { used.add(img.file); return img; });
  const res = [main];
  let chain = main.catch(() => null);
  item.q.forEach(q => {
    const p = chain.then(() => commonsImage(q, used, base));
    res.push(p);
    chain = p.catch(() => null);
  });
  itemCache.set(key, res);
  return res;
}

// Ein Bild laden (mit Warteschlange und Wiederholung)
function preload(src){
  return imgQueue(() => retry(() => new Promise((res, rej) => {
    const t = new Image();
    t.onload = () => res();
    t.onerror = () => rej(new Error("Bildfehler"));
    t.src = src;
  }), 4));
}
// Ausschnitt aus der Verwaltung als CSS-Variablen (css/index.css); die Lightbox zeigt trotzdem das ganze Bild
function setFocus(img, data){
  img.style.setProperty("--fx", (data.fx ?? 50) + "%");
  img.style.setProperty("--fy", (data.fy ?? 50) + "%");
  img.style.setProperty("--z", data.z ?? 1);
}
function showImg(img, data){
  return preload(data.src).then(() => {
    setFocus(img, data);
    img.src = data.src;
    img.classList.add("loaded");
  });
}

// Bild für einen Platz: zuerst lokal, sonst (oder wenn die lokale Datei fehlt) online
function fillSlide(slide, cat, item, k){
  const status = slide.querySelector(".status");
  const el = slide.querySelector("img");
  const a = slide.querySelector(".credit");
  el.alt = slide.dataset.alt;
  const show = data => showImg(el, data).then(() => {
    status.remove();
    if(safeUrl(data.page)){ a.href = data.page; a.hidden = false; }
  });
  const online = () => (resolveItem(cat, item)[k] || Promise.reject(new Error("kein Suchbegriff"))).then(show);
  const loc = localImage(cat, item, k);
  (loc ? show(loc).catch(online) : online())
    .catch(() => { status.textContent = "Bild nicht verfügbar"; });
}

/* ------------------------------------------------------------------
   KARTE EINES EINTRAGS (bis 4 Bilder + Text) und LIGHTBOX (dieselben Seiten gross)
------------------------------------------------------------------- */
// Die Seiten eines Eintrags (vorhandene Bilder, dann Text); data-k = Bildplatz 0–3.
// In der Lightbox steht der Name zusätzlich in der Beschriftung.
function slidesHtml(cat, item, labels, big){
  const facts = item.f.map(({k, v}) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("");
  return shownSlots(item).map(k => `
    <div class="slide" data-k="${k}" data-alt="${esc(item.n + " – " + labels[k])}">
      <img alt="">
      <div class="status"><div class="spinner"></div></div>
      <span class="tag">${esc(big ? item.n + " · " + labels[k] : labels[k])}</span>
      <a class="credit" target="_blank" rel="noopener" hidden>Quelle</a>
      ${big ? `<button class="report" data-report="${k}" title="Passt das Bild nicht? Hier melden.">${reported.has(item.id + "-" + k) ? "✓ Gemeldet" : "⚑ Melden"}</button>` : ""}
    </div>`).join("") + `
    <div class="slide text"><div class="text-inner">
      <h2>${esc(item.n)}</h2>
      <p class="sub${cat.latin ? " latin" : ""}">${esc(item.s)}</p>
      <p>${esc(item.t)}</p>
      <dl>${facts}</dl>
      ${item.snd ? `<p class="sound"><button class="sound-btn" data-sound="${esc(item.snd.src)}">▶ Stimme anhören</button>
        ${safeUrl(item.snd.page) ? `<a href="${esc(item.snd.page)}" target="_blank" rel="noopener">Quelle</a>` : ""}</p>` : ""}
      ${item.cf.length ? `<div class="confuse"><b>Nicht verwechseln mit:</b>${item.cf.map(c => {
        const hit = findByName(c.name);
        return `<p>${hit ? `<a href="${entryLink(hit.cat, hit.item)}">${esc(c.name)}</a>` : `<b>${esc(c.name)}</b>`}: ${esc(c.diff)}</p>`;
      }).join("")}</div>` : ""}
      ${big ? `<p class="text-report"><button class="report-text" data-report-text title="Stimmt etwas im Text nicht? Hier melden.">${
        reported.has(item.id + "-t") ? "✓ Fehler gemeldet" : "⚑ Fehler im Text melden"}</button></p>` : ""}
    </div></div>`;
}
function controlsHtml(item, labels){
  const slots = shownSlots(item);
  return `
    <button class="nav prev" aria-label="Zurück">${ARROW_L}</button>
    <button class="nav next" aria-label="Weiter">${ARROW_R}</button>
    <div class="dots">
      ${slots.map((k, i) => `<button class="dot" aria-label="${esc(labels[k])}" data-i="${i}"></button>`).join("")}
      <button class="dot txt" aria-label="Beschreibung" data-i="${slots.length}"></button>
    </div>`;
}

// Blättern mit Pfeilen und Punkten; onChange bekommt die aktuelle Seite und ob es die Textseite (die letzte) ist
function carousel(root, onChange){
  const track = root.querySelector(".track");
  const dots = [...root.querySelectorAll(".dot")];
  const N = dots.length;
  let cur = 0;
  const go = n => {
    cur = (n + N) % N;
    root.scrollLeft = 0;
    track.style.transform = `translateX(-${cur * 100}%)`;
    dots.forEach((d, k) => d.classList.toggle("active", k === cur));
    if(onChange) onChange(cur, cur === N - 1);
  };
  root.querySelector(".prev").addEventListener("click", e => { e.stopPropagation(); go(cur - 1); });
  root.querySelector(".next").addEventListener("click", e => { e.stopPropagation(); go(cur + 1); });
  dots.forEach(d => d.addEventListener("click", e => { e.stopPropagation(); go(+d.dataset.i); }));
  // Bekommt ein Knopf oder Link auf einer anderen Seite den Fokus (Tabulator), schiebt der Browser den Inhalt
  // selbst dorthin. Stattdessen zu dieser Seite blättern und die Verschiebung des Browsers aufheben.
  const slides = [...track.children];
  track.addEventListener("focusin", e => {
    const i = slides.indexOf(e.target.closest(".slide"));
    if(i >= 0 && i !== cur) go(i);
    requestAnimationFrame(() => { root.scrollLeft = 0; });
  });
  root.addEventListener("scroll", () => { if(root.scrollLeft || root.scrollTop) root.scrollLeft = root.scrollTop = 0; });
  return { go, get cur(){ return cur; } };
}

function buildCard(cat, item){
  const labels = item.lb || cat.labels;
  const card = document.createElement("article");
  card.className = "card";
  card.tabIndex = 0;
  card.setAttribute("aria-label", item.n + " (Enter oder Klick vergrössert)");
  card.innerHTML = `
    <div class="track">${slidesHtml(cat, item, labels, false)}</div>
    <div class="name">${esc(item.n)}</div>
    ${controlsHtml(item, labels)}`;

  const c = carousel(card, (cur, isText) => card.classList.toggle("on-text", isText));
  c.go(0);

  // Erstes Bild sofort laden, die weiteren erst beim ersten Darüberfahren
  const slides = [...card.querySelectorAll(".slide:not(.text)")];
  const fill = s => fillSlide(s, cat, item, +s.dataset.k);
  fill(slides[0]);
  let rest = false;
  const loadRest = () => { if(rest) return; rest = true; slides.slice(1).forEach(fill); };
  card.addEventListener("mouseenter", loadRest);
  card.addEventListener("focusin", loadRest);
  card.addEventListener("touchstart", loadRest, { passive:true });

  // Klick auf ein Bild oder den Text öffnet die Lightbox auf derselben Seite
  card.addEventListener("click", e => {
    if(e.target.closest("button, a")) return;
    loadRest();
    openLightbox(cat, item, c.cur);
  });
  card.addEventListener("keydown", e => {
    if(e.target !== card) return;
    if(e.key === "ArrowRight"){ c.go(c.cur + 1); e.preventDefault(); }
    if(e.key === "ArrowLeft"){ c.go(c.cur - 1); e.preventDefault(); }
    if(e.key === "Enter"){ loadRest(); openLightbox(cat, item, c.cur); e.preventDefault(); }
  });
  return card;
}

// Tierstimme abspielen bzw. anhalten (Knopf auf der Textseite von Karte und Lightbox)
let soundPlayer = null, soundBtn = null;
const soundReset = () => { if(soundBtn) soundBtn.textContent = "▶ Stimme anhören"; soundBtn = null; };
document.addEventListener("click", e => {
  const b = e.target.closest("[data-sound]");
  if(!b) return;
  e.stopPropagation();
  const again = soundBtn === b;
  if(soundPlayer){ soundPlayer.pause(); soundPlayer = null; }
  soundReset();
  if(again) return;   // zweiter Klick: anhalten
  soundPlayer = new Audio(b.dataset.sound);
  soundBtn = b;
  b.textContent = "■ Anhalten";
  soundPlayer.addEventListener("ended", soundReset);
  soundPlayer.play().catch(() => { soundReset(); toast("Ton konnte nicht abgespielt werden."); });
});

// Kurze Meldung unten am Bildschirm
function toast(text){
  let t = document.getElementById("toast");
  if(!t){ t = document.createElement("div"); t.id = "toast"; }
  // Ins oberste offene Fenster (Lightbox, Meldung), sonst liegt es darunter und ist nicht zu sehen
  const host = [...document.querySelectorAll("dialog[open]")].pop() || document.body;
  if(t.parentNode !== host) host.append(t);
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 2500);
}

// Lightbox: ein <dialog> für die ganze Seite. Schliessen mit ×, Esc oder «Zurück» (bleibt in der Kategorie).
const lightbox = document.createElement("dialog");
lightbox.className = "lightbox";
document.body.append(lightbox);
let lbCarousel = null;

function openLightbox(cat, item, start){
  const labels = item.lb || cat.labels;
  lightbox.setAttribute("aria-label", item.n);
  lightbox.innerHTML = `
    <div class="lb">
      <div class="track">${slidesHtml(cat, item, labels, true)}</div>
      ${controlsHtml(item, labels)}
      <button class="lb-close" aria-label="Schliessen" autofocus>×</button>
      <button class="lb-share" aria-label="Link zu diesem Eintrag teilen" title="Link teilen"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg></button>
    </div>`;
  const root = lightbox.querySelector(".lb");
  lbCarousel = carousel(root, () => lbZoom.reset());
  // Die Bilder sind meist schon geladen (Browser- und Offline-Speicher), sonst werden sie jetzt geholt
  root.querySelectorAll(".slide:not(.text)").forEach(s => fillSlide(s, cat, item, +s.dataset.k));
  lbCarousel.go(start);
  root.querySelector(".lb-close").addEventListener("click", closeLightboxByUser);
  // Direktlink teilen (Handy: Teilen-Menü) oder in die Zwischenablage kopieren
  root.querySelector(".lb-share").addEventListener("click", async () => {
    const url = entryUrl(cat, item);
    try{
      if(navigator.share){ await navigator.share({ title:item.n, url }); return; }
      await navigator.clipboard.writeText(url);
      toast("Link kopiert: " + url);
    }catch(e){ if(e.name !== "AbortError") toast(url); }
  });
  root.querySelectorAll("[data-report]").forEach(b => b.addEventListener("click", ev => {
    ev.stopPropagation();
    openReport(item, +b.dataset.report, labels, b);
  }));
  root.querySelector("[data-report-text]").addEventListener("click", ev => {
    ev.stopPropagation();
    openTextReport(item, ev.currentTarget);
  });
  document.body.classList.add("lb-open");
  lightbox.showModal();
  // Eigener Verlaufseintrag (gleiche Adresse): «Zurück» schliesst nur die Lightbox
  history.pushState({ lb:true }, "");
}
lightbox.addEventListener("close", () => {
  if(lightbox.open) return;   // kommt verzögert: ist schon die nächste Lightbox offen, nichts wegräumen
  document.body.classList.remove("lb-open");
  lbZoom.reset();
  lightbox.replaceChildren();
  lbCarousel = null;
});
// Schliessen mit × oder Esc: einen Schritt im Verlauf zurück, das schliesst die Lightbox (popstate).
// Nicht im «close»-Ereignis: das kommt verzögert und würde sonst eine inzwischen neu geöffnete Lightbox
// (z. B. nach einem Link «Nicht verwechseln mit …») gleich wieder schliessen.
function closeLightboxByUser(){
  if(history.state && history.state.lb) history.back(); else lightbox.close();
}
lightbox.addEventListener("cancel", e => { e.preventDefault(); closeLightboxByUser(); });
window.addEventListener("popstate", () => { if(lightbox.open) lightbox.close(); });
lightbox.addEventListener("keydown", e => {
  if(!lbCarousel) return;
  if(e.key === "ArrowRight"){ lbCarousel.go(lbCarousel.cur + 1); e.preventDefault(); }
  if(e.key === "ArrowLeft"){ lbCarousel.go(lbCarousel.cur - 1); e.preventDefault(); }
  // Zoomen mit + und -, 0 setzt zurück (auf die Fenstermitte)
  const zoomKey = { "+":1.5, "=":1.5, "-":1 / 1.5 }[e.key];
  if(zoomKey){ lbZoom.zoomTo(lbZoom.scale * zoomKey, innerWidth / 2, innerHeight / 2); e.preventDefault(); }
  if(e.key === "0"){ lbZoom.reset(); e.preventDefault(); }
});

/* Unpassendes Bild melden (Knopf «Melden» auf jeder Bildseite der Lightbox): kleines Fenster mit dem Bild und
   freiwilliger Begründung, gespeichert über die Datenbankfunktion report_image (016). Die Verwaltung zeigt die
   Meldungen unter «Gemeldete Bilder». reported merkt sich bis zum Neuladen, was schon gemeldet ist. */
const reported = new Set();
const reportDlg = document.createElement("dialog");
reportDlg.className = "report-dlg";
reportDlg.setAttribute("aria-labelledby", "reportTitle");
document.body.append(reportDlg);
function openReport(item, k, labels, btn){
  const key = item.id + "-" + k;
  if(reported.has(key)){ toast("Dieses Bild ist schon gemeldet. Danke!"); return; }
  const src = btn.closest(".slide").querySelector("img.loaded")?.src;
  reportDlg.innerHTML = `
    <h2 id="reportTitle">Bild melden</h2>
    ${src ? `<img src="${esc(src)}" alt="">` : ""}
    <p>Passt Bild ${k + 1} («${esc(labels[k])}») nicht zu <b>${esc(item.n)}</b>? Die Meldung geht ohne Namen an die Verwaltung.</p>
    <label>Was stimmt nicht? (freiwillig)
      <input type="text" maxlength="200" placeholder="z. B. zeigt eine andere Art"></label>
    <div class="report-btns">
      <button type="button" class="ghost" data-act="cancel">Abbrechen</button>
      <button type="button" data-act="send">Melden</button>
    </div>`;
  const input = reportDlg.querySelector("input");
  const send = async () => {
    const b = reportDlg.querySelector("[data-act=send]");
    b.disabled = true;
    try{
      const r = await fetch(CFG.url + "/rest/v1/rpc/report_image", {
        method:"POST",
        headers:{ apikey:CFG.key, "Content-Type":"application/json" },
        body:JSON.stringify({ p_entry:item.id, p_position:k + 1, p_reason:input.value.trim() })
      });
      if(!r.ok) throw new Error("HTTP " + r.status);
      reported.add(key);
      btn.textContent = "✓ Gemeldet";
      reportDlg.close();
      toast("Danke! Das Bild wurde gemeldet.");
    }catch(e){
      b.disabled = false;
      toast(navigator.onLine ? "Melden hat nicht geklappt. Bitte später nochmals versuchen." : "Melden geht nur mit Internet.");
    }
  };
  reportDlg.querySelector("[data-act=cancel]").addEventListener("click", () => reportDlg.close());
  reportDlg.querySelector("[data-act=send]").addEventListener("click", send);
  input.addEventListener("keydown", e => { if(e.key === "Enter"){ e.preventDefault(); send(); } });
  reportDlg.showModal();
  input.focus();
}
// Klick neben das Fenster schliesst es
reportDlg.addEventListener("click", e => { if(e.target === reportDlg) reportDlg.close(); });

/* Fehler im Text melden (Knopf unten auf der Textseite der Lightbox): Beschreibung ist Pflicht, gespeichert über
   report_text (018) in derselben Tabelle wie die Bildmeldungen (Platz 0). Die Datenbank gibt eine Nummer zurück;
   sie bleibt im Fenster stehen, damit Lernende einen gefundenen Fehler bei der Lehrperson vorweisen können. */
function openTextReport(item, btn){
  const key = item.id + "-t";
  if(reported.has(key)){ toast("Für diesen Eintrag hast du schon einen Fehler gemeldet. Danke!"); return; }
  reportDlg.innerHTML = `
    <h2 id="reportTitle">Fehler im Text melden</h2>
    <p>Stimmt etwas in der Beschreibung, im Steckbrief oder bei der Verwechslungsgefahr von <b>${esc(item.n)}</b> nicht?
      Die Meldung geht ohne Namen an die Verwaltung.</p>
    <label>Was ist falsch, und wie wäre es richtig?
      <textarea maxlength="300" rows="4" placeholder="z. B. Die Blütezeit ist April bis Juni, nicht März."></textarea></label>
    <div class="report-btns">
      <button type="button" class="ghost" data-act="cancel">Abbrechen</button>
      <button type="button" data-act="send">Melden</button>
    </div>`;
  const input = reportDlg.querySelector("textarea");
  const send = async () => {
    const reason = input.value.trim();
    if(reason.length < 3){ toast("Bitte kurz beschreiben, was nicht stimmt."); input.focus(); return; }
    const b = reportDlg.querySelector("[data-act=send]");
    b.disabled = true;
    try{
      const r = await fetch(CFG.url + "/rest/v1/rpc/report_text", {
        method:"POST",
        headers:{ apikey:CFG.key, "Content-Type":"application/json" },
        body:JSON.stringify({ p_entry:item.id, p_reason:reason })
      });
      if(!r.ok) throw new Error("HTTP " + r.status);
      const nr = await r.json();
      reported.add(key);
      btn.textContent = "✓ Fehler gemeldet";
      reportDlg.innerHTML = `
        <h2 id="reportTitle">Danke!</h2>
        <p>Deine Meldung zu <b>${esc(item.n)}</b> ist angekommen.</p>
        <p class="report-nr">Meldung Nr. ${esc(nr)}</p>
        <p>Merke dir die Nummer, falls deine Lehrperson danach fragt.</p>
        <div class="report-btns"><button type="button" data-act="cancel">Schliessen</button></div>`;
      reportDlg.querySelector("[data-act=cancel]").addEventListener("click", () => reportDlg.close());
      reportDlg.querySelector("[data-act=cancel]").focus();
    }catch(e){
      b.disabled = false;
      toast(navigator.onLine ? "Melden hat nicht geklappt. Bitte später nochmals versuchen." : "Melden geht nur mit Internet.");
    }
  };
  reportDlg.querySelector("[data-act=cancel]").addEventListener("click", () => reportDlg.close());
  reportDlg.querySelector("[data-act=send]").addEventListener("click", send);
  reportDlg.showModal();
  input.focus();
}

/* Zoomen (Lightbox und LernApp): Mausrad, Doppelklick bzw. doppelt tippen, zwei Finger.
   Vergrössert lässt sich das Bild ziehen; Wischen blättert nur ungezoomt (onSwipe).
   Das Bild wird mit translate/scale (Ursprung oben links, css/index.css) über seiner Seite verschoben.
   image(): das aktuell gezeigte, geladene <img> oder null (Textseite, noch nicht geladen). */
const MAX_ZOOM = 5;
const gap = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
function zoomable(root, { image, onSwipe }){
  const z = { s:1, x:0, y:0, img:null };
  const apply = () => {
    z.img.style.transform = `translate(${z.x}px, ${z.y}px) scale(${z.s})`;
    root.classList.add("zoomed");
  };
  const reset = () => {
    if(z.img) z.img.style.transform = "";
    Object.assign(z, { s:1, x:0, y:0, img:null });
    root.classList.remove("zoomed");
  };
  // Verschieben, ohne dass neben dem Bild leere Fläche entsteht
  const panBy = (dx, dy) => {
    if(!z.img) return;
    const r = z.img.parentElement.getBoundingClientRect();
    z.x = Math.min(0, Math.max(r.width * (1 - z.s), z.x + dx));
    z.y = Math.min(0, Math.max(r.height * (1 - z.s), z.y + dy));
    apply();
  };
  // Auf den Faktor s zoomen; der Bildpunkt unter (cx, cy) bleibt dabei an seiner Stelle
  const zoomTo = (s, cx, cy) => {
    const img = z.img || image();
    if(!img) return;
    s = Math.min(MAX_ZOOM, Math.max(1, s));
    if(s === 1){ reset(); return; }
    const r = img.parentElement.getBoundingClientRect();   // die Seite = ungezoomte Fläche
    const px = cx - r.left, py = cy - r.top;
    z.x = px - (px - z.x) * s / z.s;
    z.y = py - (py - z.y) * s / z.s;
    z.s = s;
    z.img = img;
    panBy(0, 0);
  };

  root.addEventListener("wheel", e => {
    if(!e.target.closest(".slide:not(.text)")) return;
    e.preventDefault();
    zoomTo(z.s * Math.exp(-e.deltaY * 0.002), e.clientX, e.clientY);
  }, { passive:false });

  // Finger und Maus: ziehen (vergrössert), zwei Finger zoomen, doppelt tippen, wischen (ungezoomt)
  const pointers = new Map();
  let gesture = null, lastTap = null;
  root.addEventListener("pointerdown", e => {
    if(e.target.closest("button, a, input")) return;
    pointers.set(e.pointerId, e);
    if(pointers.size === 1) gesture = { x0:e.clientX, y0:e.clientY, last:e, pinch:null, moved:false };
    if(pointers.size === 2 && gesture){
      const [a, b] = pointers.values();
      gesture.pinch = { d:gap(a, b), s:z.s };
      gesture.moved = true;
    }
  });
  root.addEventListener("pointermove", e => {
    if(!pointers.has(e.pointerId) || !gesture) return;
    pointers.set(e.pointerId, e);
    if(gesture.pinch && pointers.size >= 2){
      const [a, b] = pointers.values();
      zoomTo(gesture.pinch.s * gap(a, b) / gesture.pinch.d, (a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2);
    }else if(z.s > 1){
      panBy(e.clientX - gesture.last.clientX, e.clientY - gesture.last.clientY);
    }
    if(gap(e, { clientX:gesture.x0, clientY:gesture.y0 }) > 8) gesture.moved = true;
    gesture.last = e;
  });
  const pointerEnd = e => {
    if(!pointers.delete(e.pointerId) || !gesture || pointers.size) return;
    const g = gesture;
    gesture = null;
    if(e.type !== "pointerup" || g.pinch) return;
    const dx = e.clientX - g.x0;
    // Wischen blättert, aber nur ungezoomt
    if(z.s === 1 && Math.abs(dx) > 50){ onSwipe(dx < 0 ? 1 : -1); return; }
    if(g.moved) return;
    // Doppelt tippen oder klicken: vergrössern bzw. zurück
    const now = Date.now();
    if(lastTap && now - lastTap.t < 350 && gap(e, lastTap.e) < 30){
      zoomTo(z.s > 1 ? 1 : 2.5, e.clientX, e.clientY);
      lastTap = null;
    }else lastTap = { t:now, e };
  };
  root.addEventListener("pointerup", pointerEnd);
  root.addEventListener("pointercancel", pointerEnd);
  // Sonst zieht die Maus eine Kopie des Bildes, statt es zu verschieben
  root.addEventListener("dragstart", e => e.preventDefault());

  return { zoomTo, reset, get scale(){ return z.s; } };
}
const lbZoom = zoomable(lightbox, {
  image:() => lbCarousel && lightbox.querySelectorAll(".lb .slide")[lbCarousel.cur]?.querySelector("img.loaded"),
  onSwipe:dir => lbCarousel?.go(lbCarousel.cur + dir)
});

/* ------------------------------------------------------------------
   ANSICHTEN: Übersicht und Kategorie
------------------------------------------------------------------- */
const grid = document.getElementById("grid");
const titleEl = document.getElementById("title");
const introEl = document.getElementById("intro");
const catCards = new Map();   // bereits gebaute Karten pro Kategorie (Bilder werden nur einmal geladen)
let overviewCards = null;

function buildOverview(){
  return CATS.map(cat => {
    const b = document.createElement("button");
    b.className = "cat";
    b.innerHTML = `<img alt=""><div class="status"><div class="spinner"></div></div>
      <span class="count">${cat.items.length} ${cat.items.length === 1 ? "Eintrag" : "Einträge"}</span>
      <span class="cat-prog" hidden></span>
      <div class="cap"><em class="cat-day" hidden>Kategorie des Tages</em><strong>${esc(cat.name)}</strong><span>${esc(cat.desc)}</span></div>`;
    b.addEventListener("click", () => { location.hash = "#/" + cat.id; });
    const img = b.querySelector("img");
    const status = b.querySelector(".status");
    img.alt = cat.name;
    const item = cat.items[cat.cover];
    if(!item){ status.remove(); return b; }
    const online = () => resolveItem(cat, item)[0].then(d => showImg(img, d));
    const loc = localImage(cat, item, shownSlots(item)[0]);   // Hauptbild, sonst das erste vorhandene
    (loc ? showImg(img, loc).catch(online) : online()).finally(() => status.remove());
    return b;
  });
}

// Seiten aus dem Menü (stehen in index.html); gehen vor gleichnamigen Kategorien
const PAGES = {
  lernapp:{ title:"LernApp", intro:"Namen zu Bildern lernen, mit dem Leitner-System." },
  spiele:{ title:"Spiele", intro:"Memory, Verwechslungs-Duell und Steckbrief-Detektiv: dasselbe Wissen spielerisch üben." },
  quiz:{ title:"Quiz für die Klasse", intro:"Bilder gross zeigen, die Klasse rät, dann die Lösung einblenden." },
  pdf:{ title:"PDF drucken", intro:"Eine Kategorie als PDF speichern oder drucken." },
  hilfe:{ title:"Hilfe", intro:"Was die Seite kann, womit man beginnt, und eine Anleitung zu allen Möglichkeiten." },
  einstellungen:{ title:"Einstellungen", intro:"Als App installieren, Bilder für offline herunterladen und Version." },
  admin:{ title:"Admin", intro:"Zugang zur Verwaltung." },
  copyright:{ title:"Copyright", intro:"Urheberrecht und Bildnachweis." }
};

// Bildnachweis: alle eigenen Bilder mit Link zur Quellseite (Urheber und Lizenz).
// Ohne Quelle gilt ein Bild als eigenes Foto, ausser «Dateiname» nennt die Herkunft (z. B. «KI-generiert mit ChatGPT (OpenAI)», 017);
// zugeschnittene Bilder bekommen einen Hinweis (CC-Lizenzen verlangen ihn).
const ownSource = i => (i.file || "").trim() || "eigenes Foto";
function buildCredits(){
  document.getElementById("credits").innerHTML = CATS.map(cat => `
    <h3>${esc(cat.name)}</h3>
    <ul class="credits">${cat.items.map(it => {
      const parts = it.img.map((i, k) => {
        if(!i) return "";
        if(!safeUrl(i.page)) return `<span>Bild ${k + 1}: ${esc(ownSource(i))}</span>`;
        return `<span><a href="${esc(i.page)}" target="_blank" rel="noopener" title="${esc(i.file || "")}">Bild ${k + 1}</a>`
          + `${i.edited ? " <small>(zugeschnitten)</small>" : ""}</span>`;
      }).join("");
      const sound = !it.snd ? "" : safeUrl(it.snd.page)
        ? `<span><a href="${esc(it.snd.page)}" target="_blank" rel="noopener" title="${esc(it.snd.file || "")}">Stimme</a></span>` : "<span>Stimme: eigene Aufnahme</span>";
      return `<li>${esc(it.n)}${parts || " <small>(Bilder werden live von Wikimedia geladen)</small>"}${sound}</li>`;
    }).join("")}</ul>`).join("");
}

/* ------------------------------------------------------------------
   PDF DRUCKEN: eine Kategorie, 8 Einträge pro A4-Seite (2 × 4), Hauptbild mit dem Text darüber,
   darunter klein die Bildquelle (CC-Lizenzen verlangen sie auch gedruckt). Das PDF erstellt der
   Browser über den Druckdialog («Als PDF speichern»); das Layout steht in css/index.css (@media print).
------------------------------------------------------------------- */
const PER_PAGE = 8;
const printBox = document.getElementById("print");
const pdfMsg = document.getElementById("pdfMsg");

// Kommt man aus einer Kategorie (lastCat, gesetzt in render), ist sie vorgewählt; sonst bleibt die letzte Wahl
let lastCat = null;
function fillPdfSelect(){
  const sel = document.getElementById("pdfCat");
  const keep = lastCat || sel.value;
  sel.innerHTML = CATS.map(c => `<option value="${esc(c.id)}">${esc(c.name)} (${c.items.length})</option>`).join("");
  if(CATS.some(c => c.id === keep)) sel.value = keep;
  fillPdfItems();
}

// Einträge der gewählten Kategorie zum Abwählen; standardmässig sind alle angewählt.
// Abgewählte merkt sich pdfOff, solange die Kategorie gleich bleibt (auch beim Neuladen der Daten).
let pdfOff = new Set(), pdfOffCat = null;
const pdfCatNow = () => CATS.find(c => c.id === document.getElementById("pdfCat").value);
function fillPdfItems(){
  const cat = pdfCatNow();
  if(!cat) return;
  if(cat.id !== pdfOffCat){ pdfOff = new Set(); pdfOffCat = cat.id; }
  document.getElementById("pdfItems").innerHTML = cat.items.map(it => `<label>
    <input type="checkbox" value="${esc(it.id)}" ${pdfOff.has(it.id) ? "" : "checked"}> ${esc(it.n)}</label>`).join("");
  pdfCount();
}
function pdfCount(){
  const cat = pdfCatNow();
  const n = cat ? cat.items.filter(it => !pdfOff.has(it.id)).length : 0;
  document.getElementById("pdfCount").textContent = `${n} von ${cat ? cat.items.length : 0} gewählt.`;
}
document.getElementById("pdfCat").addEventListener("change", fillPdfItems);
document.getElementById("pdfItems").addEventListener("change", e => {
  const box = e.target;
  if(box.checked) pdfOff.delete(box.value); else pdfOff.add(box.value);
  pdfCount();
});
const pdfSetAll = on => {
  const cat = pdfCatNow();
  pdfOff = new Set(on || !cat ? [] : cat.items.map(it => it.id));
  fillPdfItems();
};
document.getElementById("pdfAll").addEventListener("click", () => pdfSetAll(true));
document.getElementById("pdfNone").addEventListener("click", () => pdfSetAll(false));

// Hauptbild eines Eintrags ins <img> laden (eigenes Bild, sonst online); gibt die Bilddaten zurück
function loadPrintImage(el, cat, item){
  const load = d => new Promise((res, rej) => {
    setFocus(el, d);
    el.onload = () => res(d);
    el.onerror = () => rej(new Error("Bildfehler"));
    el.src = d.src;
  });
  const online = () => resolveItem(cat, item)[0].then(load);
  const loc = localImage(cat, item, shownSlots(item)[0]);
  return loc ? load(loc).catch(online) : online();
}

// Bildquelle für den Druck: Commons-Seite (mit Urheber und Lizenz), sonst Herkunft oder «eigenes Foto» (ownSource)
const printSrc = d => safeUrl(d.page)
  ? "Bild: " + decodeURI(d.page).replace(/^https?:\/\//, "") + (d.edited ? " (zugeschnitten)" : "") : "Bild: " + ownSource(d);
const chunk = (list, n) => { const out = []; for(let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n)); return out; };
const shuffled = list => { const a = list.slice(); for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const MEMORY_PER_PAGE = 20;   // 4 × 5 Karten

/* Drei Arten:
   text   Übersicht: Hauptbild, darüber Name, Beschreibung, Steckbrief (8 pro Seite)
   blatt  Arbeitsblatt: nur Bilder mit Nummer und Linie (zufällige Reihenfolge), am Schluss das Lösungsblatt
   memory Memory: Bildkarten und Namenskarten zum Ausschneiden (je 20 pro Seite) */
async function printCategory(cat, mode = "text", chosen = cat.items){
  const btn = document.getElementById("pdfBtn");
  btn.disabled = true;
  pdfMsg.textContent = "Bilder werden geladen …";
  const sub = it => it.s ? ` <span class="${cat.latin ? "latin" : ""}">${esc(it.s)}</span>` : "";
  let items = chosen, title = cat.name;
  if(mode === "blatt"){
    items = shuffled(chosen);
    title += " – Arbeitsblatt";
    printBox.innerHTML = chunk(items, PER_PAGE).map((p, pi) => `<div class="print-page">${p.map((it, i) => `
      <figure class="print-cell">
        <img alt="">
        <figcaption class="ws"><span class="nr">${pi * PER_PAGE + i + 1}</span><span class="line"></span><small class="print-src"></small></figcaption>
      </figure>`).join("")}</div>`).join("")
      + `<div class="print-solution"><h2>Lösungen · ${esc(cat.name)}</h2>
        <ol>${items.map(it => `<li><b>${esc(it.n)}</b>${sub(it)}</li>`).join("")}</ol></div>`;
  }else if(mode === "memory"){
    title += " – Memory";
    const imgCards = items.map(() => `<figure class="mem-card"><img alt=""><small class="print-src"></small></figure>`);
    const nameCards = items.map(it => `<div class="mem-card mem-name"><b>${esc(it.n)}</b>${sub(it)}</div>`);
    printBox.innerHTML = [imgCards, nameCards].map(cards =>
      chunk(cards, MEMORY_PER_PAGE).map(p => `<div class="print-page mem">${p.join("")}</div>`).join("")).join("");
  }else{
    printBox.innerHTML = chunk(items, PER_PAGE).map(p => `<div class="print-page">${p.map(it => `
      <figure class="print-cell">
        <img alt="">
        <figcaption>
          <strong>${esc(it.n)}</strong>${sub(it)}
          <p>${esc(it.t)}</p>
          ${it.f.length ? `<p>${it.f.map(f => `<b>${esc(f.k)}:</b> ${esc(f.v)}`).join(" · ")}</p>` : ""}
          <small class="print-src"></small>
        </figcaption>
      </figure>`).join("")}</div>`).join("");
  }

  // Alle Hauptbilder laden (Reihenfolge der <img> = Reihenfolge von items); fehlt eines, bleibt die Fläche leer.
  // Die Quelle steht klein im Bild (CC-Lizenzen verlangen sie auch gedruckt).
  const imgs = printBox.querySelectorAll("figure img");
  await Promise.all(items.map((it, i) => loadPrintImage(imgs[i], cat, it).then(d => {
    imgs[i].closest("figure").querySelector(".print-src").textContent = printSrc(d);
  }).catch(() => {})));

  pdfMsg.textContent = "";
  btn.disabled = false;
  // Der Titel wird im Druckdialog zum Dateinamen des PDFs
  const oldTitle = document.title;
  document.title = "Natur und Schweiz – " + title;
  window.addEventListener("afterprint", () => { document.title = oldTitle; printBox.replaceChildren(); }, { once:true });
  window.print();
}

document.getElementById("pdfBtn").addEventListener("click", () => {
  const cat = pdfCatNow();
  if(!cat) return;
  const chosen = cat.items.filter(it => !pdfOff.has(it.id));
  if(!chosen.length){ pdfMsg.textContent = "Mindestens einen Eintrag anwählen."; return; }
  printCategory(cat, document.getElementById("pdfMode").value, chosen).catch(e => {
    pdfMsg.textContent = "PDF konnte nicht erstellt werden (" + e.message + ").";
    document.getElementById("pdfBtn").disabled = false;
  });
});

/* ------------------------------------------------------------------
   LERNAPP: Bild zeigen, Namen eintippen, nach dem Leitner-System wiederholen.
   Fach 1–5; richtig = ein Fach weiter, falsch = zurück in Fach 1. Ein Fach wird erst nach
   LEITNER_TAGE wieder abgefragt, so kommen gut gekonnte Begriffe immer seltener dran.
   Auswahl und Fortschritt liegen im Browser (localStorage, pro Gerät).
   Mehrere Lernsessions: jede mit eigenen Kategorien, eigener Farbe und eigenem Fortschritt; die Lernserie gilt fürs Gerät.
   Neue Begriffe warten in «Fach 0» und kommen dosiert dazu (NEU_PRO_TAG); abgefragt wird in Runden (RUNDE).
------------------------------------------------------------------- */
const LERN_KEY = "sff-lernen";
const LEITNER_TAGE = [0, 1, 3, 7, 30];   // Fach 1 sofort, Fach 2 nach 1 Tag … Fach 5 nach 30 Tagen
const NEU_PRO_TAG = 10;   // so viele neue Begriffe kommen pro Tag ins Fach 1
const RUNDE = 15;         // Fragen pro Runde
const DAY = 86400000;
// Farben der Lernsessions (Klassen .sc0 … .sc7, Werte als Variablen in css/index.css)
const LERN_FARBEN = ["Grün", "Blau", "Orange", "Violett", "Rot", "Türkis", "Gelb", "Rosa"];
const lernEl = document.getElementById("lern");
const lernValid = s => s && Array.isArray(s.cats) && s.cats.length && s.cards && typeof s.cards === "object";
// Speicher: { sessions:[{ id, color, cats:[ids], cards:{ entryId:{ box, due } }, newDay, newCount }], active:id, streak }
const lernStore = lernLoad();
let lern = lernStore.sessions.find(s => s.id === lernStore.active) || lernStore.sessions[0] || null;   // aktive Session; box 0 = neu
let lernCur = null;      // aktuelle Frage { cat, item }
let lernPractice = false;   // freies Üben, wenn für heute alles wiederholt ist (zählt nicht)
let lernRound = null;    // laufende Runde { size, n, right, helped } (nur für diese Sitzung)

function lernLoad(){
  try{
    const s = JSON.parse(localStorage.getItem(LERN_KEY));
    if(s && Array.isArray(s.sessions)) return { sessions:s.sessions.filter(lernValid), active:s.active, streak:s.streak };
    // Bisheriges Format (eine einzige Auswahl) wird zur ersten Session
    if(lernValid(s)){
      const { streak, ...session } = s;
      return { sessions:[{ ...session, id:"s1", color:0 }], active:"s1", streak };
    }
  }catch(e){}
  return { sessions:[], active:null, streak:null };
}
function lernSave(){
  lernStore.active = lern ? lern.id : null;
  try{ localStorage.setItem(LERN_KEY, JSON.stringify(lernStore)); }catch(e){}
}
// Name einer Session aus ihren Kategorien, z. B. «Bäume, Pilze» oder «Bäume, Pilze, Vögel +2»
function lernName(s){
  const names = s.cats.map(id => CATS.find(c => c.id === id)?.name).filter(Boolean);
  return names.length > 3 ? names.slice(0, 3).join(", ") + " +" + (names.length - 3) : names.join(", ") || "(Kategorien entfernt)";
}
// Was eine Session heute anbietet, ohne etwas zu verändern: fällige und neue Begriffe (neue höchstens so viele, wie heute noch dazukommen)
function lernToday(s){
  const now = Date.now(), today = startOfToday();
  let due = 0, neu = 0, total = 0, richtig = 0;
  for(const id of s.cats){
    for(const it of CATS.find(c => c.id === id)?.items || []){
      const c = s.cards[it.id];
      total++;
      if(!c || c.box === 0) neu++;
      else{ if(c.due <= now) due++; if(c.box >= 2) richtig++; }
    }
  }
  neu = Math.min(neu, s.newDay === today ? Math.max(0, NEU_PRO_TAG - (s.newCount || 0)) : NEU_PRO_TAG);
  return { due, neu, open:due + neu, total, richtig };
}
function lernSwitch(s){
  lern = s;
  lernPractice = false;
  lernCur = null;
  lernRound = null;
  lernSave();
}
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };

// Karten mit den aktuellen Einträgen abgleichen: neue warten als «neu» (Fach 0), verschwundene fallen weg
function lernSync(){
  const items = lern.cats.map(id => CATS.find(c => c.id === id)).filter(Boolean)
    .flatMap(cat => cat.items.map(item => ({ cat, item })));
  const cards = {};
  for(const { item } of items) cards[item.id] = lern.cards[item.id] || { box:0, due:0 };
  lern.cards = cards;
  return items;
}

// Neue Begriffe dosieren: pro Tag höchstens NEU_PRO_TAG ins Fach 1 (zufällig gewählt); «extra» holt freiwillig mehr
function lernIntroduce(items, extra = 0){
  const today = startOfToday();
  if(lern.newDay !== today){ lern.newDay = today; lern.newCount = 0; }
  const waiting = items.filter(({ item }) => lern.cards[item.id].box === 0);
  let n = Math.max(0, NEU_PRO_TAG - lern.newCount) + extra;
  while(n-- > 0 && waiting.length){
    const [{ item }] = waiting.splice(Math.floor(Math.random() * waiting.length), 1);
    lern.cards[item.id] = { box:1, due:0 };
    lern.newCount++;
  }
}

// Lernserie: Tage in Folge mit mindestens einer gewerteten Antwort ({ last:Tag, count })
function lernStreak(){
  const s = lernStore.streak;
  if(!s) return 0;
  return Math.round((startOfToday() - s.last) / DAY) <= 1 ? s.count : 0;   // gestern oder heute gelernt: Serie läuft
}
function lernMarkDay(){
  const today = startOfToday(), s = lernStore.streak;
  if(s && s.last === today) return;
  lernStore.streak = { last:today, count:s && Math.round((today - s.last) / DAY) === 1 ? s.count + 1 : 1 };
}

// Hinweis auf der Übersicht: was heute ansteht (alle Sessions), ohne etwas zu verändern
function showLernBanner(){
  const el = document.getElementById("lernBanner");
  if(!el) return;
  el.hidden = true;
  quickLearn.hidden = false;   // «Lernen» neben der Suche nur, wenn kein Lernhinweis da ist (der führt selbst zur LernApp)
  if(!lernStore.sessions.length) return;
  const per = lernStore.sessions.map(s => ({ s, t:lernToday(s) }));
  const due = per.reduce((n, p) => n + p.t.due, 0), neu = per.reduce((n, p) => n + p.t.neu, 0);
  const streak = lernStreak(), total = due + neu;
  const serie = streak >= 2 ? `Deine Serie: ${streak} Tage in Folge.` : "";
  if(total){
    const parts = [due && `${due} fällig`, neu && `${neu} ${neu === 1 ? "neuer" : "neue"}`].filter(Boolean).join(", ");
    const chips = per.length > 1 ? `<span class="lern-banner-chips">${per.filter(p => p.t.open).map(p =>
      `<span class="lern-dot sc${p.s.color % LERN_FARBEN.length}"></span>${esc(lernName(p.s))}: ${p.t.open}`).join(" &nbsp; ")}</span>` : "";
    el.innerHTML = `<b>Heute ${total === 1 ? "wartet 1 Begriff" : `warten ${total} Begriffe`} auf dich</b> (${parts}).
      ${serie} <span class="lern-banner-go">Jetzt lernen →</span>${chips}`;
  }else if(streak){
    el.innerHTML = `<b>Für heute ist alles wiederholt.</b> ${serie || "Gut gemacht!"} <span class="lern-banner-go">Zur LernApp →</span>`;
  }else return;
  el.hidden = false;
  quickLearn.hidden = true;
}

// Fortschritt einer Kategorie über alle Lernsessions: ein Eintrag gilt als gelernt, wenn er in einer Session,
// die diese Kategorie enthält, richtig beantwortet ist (Fach 2–5). null = Kategorie in keiner Session.
function catProgress(cat){
  const sessions = lernStore.sessions.filter(s => s.cats.includes(cat.id));
  if(!sessions.length) return null;
  const done = cat.items.filter(it => sessions.some(s => (s.cards[it.id]?.box || 0) >= 2)).length;
  return { done, total:cat.items.length };
}
// Ring auf den Kacheln der Übersicht (bei jedem Anzeigen neu, die Kacheln selbst bleiben zwischengespeichert)
function showCatProgress(){
  if(!overviewCards) return;
  CATS.forEach((cat, i) => {
    const el = overviewCards[i]?.querySelector(".cat-prog");
    if(!el) return;
    const p = catProgress(cat);
    el.hidden = !p;
    if(!p) return;
    const full = p.total > 0 && p.done === p.total;
    const pct = p.total ? Math.round(100 * p.done / p.total) : 0;
    el.classList.toggle("full", full);
    el.title = full ? "Alle Einträge gelernt" : `${p.done} von ${p.total} Einträgen gelernt`;
    el.innerHTML = `<svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15.9" pathLength="100" class="ring-bg"/>
      <circle cx="18" cy="18" r="15.9" pathLength="100" class="ring" stroke-dasharray="${pct} 100"/></svg>`
      + (full ? "✓ gelernt" : `${p.done}/${p.total}`)
      + `<span class="sr"> ${esc(el.title)}</span>`;
  });
}

// Fortschritt pro Kategorie (richtig = Fach 2–5)
function lernCatStats(items){
  const map = new Map();
  for(const { cat, item } of items){
    const c = lern.cards[item.id];
    const m = map.get(cat.id) || { cat, total:0, richtig:0, fach5:0 };
    m.total++;
    if(c.box >= 2) m.richtig++;
    if(c.box === 5) m.fach5++;
    map.set(cat.id, m);
  }
  return [...map.values()];
}

function lernStats(items){
  const s = { total:items.length, neu:0, richtig:0, fach5:0, due:0, next:Infinity, boxes:[0, 0, 0, 0, 0] };
  const now = Date.now();
  for(const { item } of items){
    const c = lern.cards[item.id];
    if(c.box === 0){ s.neu++; continue; }
    s.boxes[c.box - 1]++;
    if(c.box >= 2) s.richtig++;
    if(c.box === 5) s.fach5++;
    if(c.due <= now) s.due++; else s.next = Math.min(s.next, c.due);
  }
  return s;
}

// Antwort vergleichen: ohne Gross-/Kleinschreibung, ä = ae, ohne Leer- und Satzzeichen.
// Bei «Fichte (Rottanne)» gilt jeder Teil. Kleine Tippfehler zählen als richtig («typo»).
const lernNorm = s => s.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue")
  .replace(new RegExp(String.fromCharCode(223), "g"), "ss")
  .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
function lernDistance(a, b){
  const d = Array.from({ length:a.length + 1 }, (_, i) => [i]);
  for(let j = 1; j <= b.length; j++) d[0][j] = j;
  for(let i = 1; i <= a.length; i++) for(let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
function lernMatch(answer, name){
  const a = lernNorm(answer);
  if(!a) return false;
  const inBrackets = (name.match(/\(([^)]+)\)/) || [])[1];
  const variants = [name, name.replace(/\s*\([^)]*\)/g, ""), inBrackets].filter(Boolean).map(lernNorm);
  if(variants.includes(a)) return "exact";
  return variants.some(v => lernDistance(a, v) <= (v.length >= 10 ? 2 : v.length >= 5 ? 1 : 0)) ? "typo" : false;
}

function lernWhen(due){
  const days = Math.round((due - startOfToday()) / DAY);
  if(days <= 0) return "gleich nochmals";
  if(days === 1) return "morgen";
  return `in ${days} Tagen (${new Date(due).toLocaleDateString("de-CH")})`;
}

// Tipp: erster Buchstabe und Länge des Namens («B _ _ _ _»), Wörter mit Abstand, ohne Klammerteil
function lernHint(name){
  const main = name.replace(/\s*\([^)]*\)/g, "").trim();
  const letters = main.replace(/[^\p{L}]/gu, "").length;
  const pattern = [...main].map((ch, i) => i === 0 ? ch : /\p{L}/u.test(ch) ? "_" : ch === " " ? " " : ch).join(" ");
  return `${pattern} (${letters} Buchstaben)`;
}
// Auswahl in Fach 1: der richtige Name und 3 andere, möglichst aus derselben Kategorie, gemischt
function lernChoices({ cat, item }, items){
  const shuffle = a => { for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const same = shuffle(cat.items.filter(it => it.id !== item.id).map(it => it.n));
  const other = shuffle(items.filter(p => p.cat.id !== cat.id).map(p => p.item.n));
  const wrong = [...new Set([...same, ...other])].filter(n => n !== item.n).slice(0, 3);
  return shuffle([item.n, ...wrong]);
}
// Merksatz nach der Antwort: der erste Satz der Beschreibung
function lernMerksatz(item){
  // Kein Satzende nach Zahlen («im 19. Jahrhundert») und Abkürzungen («St. Gallen», «z. B.»)
  const m = (item.t || "").match(/^.+?(?<!\d|\b(?:ca|bzw|St|Nr|evtl|resp|etc|inkl|z|d|u|v|B|h|a))[.!?](?=\s+\p{Lu}|$)/u);
  return m ? m[0] : "";
}

// Bildfläche einer Frage: nur die vorhandenen Bilder, ohne Textseite. Beschriftung und Alternativtext
// verraten den Namen nicht («Bild 1», «Blätter» …).
function lernCardHtml({ cat, item }){
  const labels = item.lb || cat.labels;
  const slots = shownSlots(item);
  return `<figure class="lern-card${slots.length === 1 ? " single" : ""}">
    <div class="track">${slots.map((k, i) => `
      <div class="slide" data-k="${k}" data-alt="Bild ${i + 1}">
        <img alt="">
        <div class="status"><div class="spinner"></div></div>
        <span class="tag">${esc(labels[k])}</span>
        <a class="credit" target="_blank" rel="noopener" hidden>Quelle</a>
      </div>`).join("")}</div>
    <button class="nav prev" aria-label="Voriges Bild">${ARROW_L}</button>
    <button class="nav next" aria-label="Nächstes Bild">${ARROW_R}</button>
    <div class="dots">${slots.map((k, i) => `<button class="dot" aria-label="Bild ${i + 1}" data-i="${i}"></button>`).join("")}</div>
  </figure>`;
}

function renderLern(){
  if(lern && lernSync().length) renderLernQuiz();
  else if(lernStore.sessions.length) renderLernSessions();
  else renderLernSetup();
}

// Leiste über der Abfrage: alle Sessions als farbige Knöpfe (mit offenen Begriffen), dazu «+ Neue Lernsession»
function lernBarHtml(){
  return `<div class="lern-sessions" role="tablist" aria-label="Lernsessions">${lernStore.sessions.map(s => {
    const t = lernToday(s);
    return `<button type="button" role="tab" class="lern-session sc${s.color % LERN_FARBEN.length}${s === lern ? " active" : ""}"
      aria-selected="${s === lern}" data-id="${esc(s.id)}" title="${esc(lernName(s))} · ${t.richtig}/${t.total} richtig">
      <span class="lern-dot"></span>${esc(lernName(s))}${t.open ? ` <small>${t.open}</small>` : ""}</button>`;
  }).join("")}
    <span class="lern-tools">
      <button type="button" class="lern-session add" id="lernNew" title="Neue Lernsession"><span>+ Neue<span class="wide"> Lernsession</span></span></button>
      <button type="button" class="lern-session add" id="lernManage" title="Lernsessions verwalten"><span><span class="wide">Lernsessions v</span><span class="narrow">V</span>erwalten</span></button>
    </span></div>`;
}
function lernBarEvents(){
  lernEl.querySelector(".lern-sessions").addEventListener("click", e => {
    const b = e.target.closest("button");
    if(!b) return;
    if(b.id === "lernNew"){ renderLernSetup(); return; }
    if(b.id === "lernManage"){ renderLernSessions(); return; }
    const s = lernStore.sessions.find(x => x.id === b.dataset.id);
    if(s && s !== lern){ lernSwitch(s); renderLernQuiz(); }
  });
}

// Alle Lernsessions: öffnen oder löschen
function renderLernSessions(){
  lernEl.innerHTML = `
    <h2>Deine Lernsessions</h2>
    <p>Jede Lernsession hat eigene Kategorien, eine eigene Farbe und einen eigenen Fortschritt.
      Gespeichert wird auf diesem Gerät.</p>
    <div class="lern-list">${lernStore.sessions.map(s => {
      const t = lernToday(s);
      return `<div class="lern-item sc${s.color % LERN_FARBEN.length}">
        <span class="lern-dot"></span>
        <div><b>${esc(lernName(s))}</b><br><small>${t.total} Einträge · ${t.richtig} richtig beantwortet ·
          ${t.open ? `heute ${t.open} offen` : "heute erledigt"}</small></div>
        <button type="button" data-open="${esc(s.id)}">Lernen</button>
        <button type="button" class="ghost" data-del="${esc(s.id)}">Löschen</button>
      </div>`;
    }).join("") || `<p class="lern-hint">Noch keine Lernsession.</p>`}</div>
    <div class="offline">
      <button id="lernNew">+ Neue Lernsession</button>
      ${lern ? `<button class="ghost" id="lernBack">Zurück zum Lernen</button>` : ""}
    </div>`;
  document.getElementById("lernNew").addEventListener("click", renderLernSetup);
  document.getElementById("lernBack")?.addEventListener("click", renderLernQuiz);
  lernEl.querySelector(".lern-list").addEventListener("click", e => {
    const open = e.target.closest("[data-open]"), del = e.target.closest("[data-del]");
    if(open){ lernSwitch(lernStore.sessions.find(s => s.id === open.dataset.open)); renderLernQuiz(); }
    if(del){
      const s = lernStore.sessions.find(x => x.id === del.dataset.del);
      if(!s || !confirm(`Lernsession «${lernName(s)}» mit ihrem ganzen Fortschritt löschen?`)) return;
      lernStore.sessions.splice(lernStore.sessions.indexOf(s), 1);
      if(s === lern) lernSwitch(lernStore.sessions[0] || null); else lernSave();
      renderLernSessions();
    }
  });
}

// Neue Lernsession: Kategorien und Farbe wählen
function renderLernSetup(){
  const used = new Set(lernStore.sessions.map(s => s.color % LERN_FARBEN.length));
  const free = LERN_FARBEN.findIndex((f, i) => !used.has(i));
  const color = free >= 0 ? free : lernStore.sessions.length % LERN_FARBEN.length;
  lernEl.innerHTML = `
    <h2>Neue Lernsession</h2>
    <p>Wähle eine oder mehrere Kategorien. Die LernApp zeigt ein Bild, und du tippst den Namen ein.
      Nach dem Leitner-System kommen Begriffe, die du gut kannst, immer seltener dran, schwierige öfter.
      So bleiben sie dauerhaft im Gedächtnis. Du kannst mehrere Lernsessions nebeneinander haben, jede mit eigenem
      Fortschritt. Gespeichert wird auf diesem Gerät.</p>
    <div class="lern-cats">${CATS.map(c => `<label><input type="checkbox" value="${esc(c.id)}">
      ${esc(c.name)} <small>(${c.items.length})</small></label>`).join("")}</div>
    <p id="lernSum" class="lern-sum"></p>
    <fieldset class="lern-colors"><legend>Farbe</legend>${LERN_FARBEN.map((f, i) => `
      <label class="sc${i}" title="${f}"><input type="radio" name="lernColor" value="${i}" ${i === color ? "checked" : ""}>
        <span class="lern-dot"></span><span class="sr">${f}</span></label>`).join("")}</fieldset>
    <div class="offline">
      <button id="lernStart">Lernsession starten</button>
      ${lernStore.sessions.length ? `<button class="ghost" id="lernBack">Abbrechen</button>` : ""}
    </div>`;
  const boxes = [...lernEl.querySelectorAll(".lern-cats input")];
  const chosen = () => boxes.filter(b => b.checked).map(b => b.value);
  const sameAs = ids => lernStore.sessions.find(s => s.cats.length === ids.length && ids.every(id => s.cats.includes(id)));
  const sum = () => {
    const ids = chosen();
    const n = CATS.filter(c => ids.includes(c.id)).reduce((s, c) => s + c.items.length, 0);
    const twin = ids.length && sameAs(ids);
    document.getElementById("lernSum").textContent = !ids.length ? "Noch keine Kategorie gewählt."
      : `${ids.length} ${ids.length === 1 ? "Kategorie" : "Kategorien"} mit ${n} Einträgen gewählt.`
        + (twin ? " Diese Auswahl gibt es schon als Lernsession; sie wird geöffnet." : "");
    document.getElementById("lernStart").disabled = !ids.length;
  };
  lernEl.querySelector(".lern-cats").addEventListener("change", sum);
  sum();
  document.getElementById("lernBack")?.addEventListener("click", () => lern ? renderLernQuiz() : renderLernSessions());
  document.getElementById("lernStart").addEventListener("click", () => {
    const ids = chosen();
    let s = sameAs(ids);
    if(!s){
      const nr = Math.max(0, ...lernStore.sessions.map(x => parseInt(String(x.id).slice(1), 10) || 0)) + 1;
      s = { id:"s" + nr, color:+lernEl.querySelector("[name=lernColor]:checked").value, cats:ids, cards:{} };
      lernStore.sessions.push(s);
    }
    lernSwitch(s);
    lernSync();
    lernSave();
    renderLernQuiz();
  });
}

function renderLernQuiz(){
  const items = lernSync();
  lernIntroduce(items);
  lernSave();
  const s = lernStats(items);
  const catStats = lernCatStats(items);
  const now = Date.now();
  const active = items.filter(({ item }) => lern.cards[item.id].box > 0);
  // Runden zu höchstens RUNDE Fragen; nach der letzten Frage kommt die Auswertung
  if(!lernPractice && !lernRound && s.due) lernRound = { size:Math.min(RUNDE, s.due), n:0, right:0, helped:0 };
  const roundDone = !!lernRound && lernRound.n >= lernRound.size;
  let pool = roundDone ? [] : active.filter(({ item }) => lern.cards[item.id].due <= now);
  if(!pool.length && lernPractice) pool = active;
  if(pool.length > 1 && lernCur) pool = pool.filter(p => p.item.id !== lernCur.item.id);   // nicht zweimal hintereinander
  lernCur = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
  const counting = lernCur && lern.cards[lernCur.item.id].due <= now;
  const round = lernRound;
  const roundText = round && round.n ? `Runde: ${round.right} von ${round.n} richtig${round.helped ? `, ${round.helped} mit Tipp` : ""}.` : "";
  // Fach 1: aus 4 Namen wählen; ab Fach 2 und beim freien Üben selbst eintippen
  const choice = counting && lern.cards[lernCur.item.id].box === 1;
  if(!lernCur && !(roundDone && s.due)) lernRound = null;   // Tagesende: nächstes Mal beginnt eine neue Runde

  lernEl.innerHTML = `
    ${lernBarHtml()}
    <div class="lern-stats">
      <div><b>${s.total}</b> Einträge zu lernen</div>
      <div><b>${s.richtig}</b> richtig beantwortet</div>
      <div><b>${s.fach5}</b> im Langzeitgedächtnis</div>
      <div><b>${lernStreak()}</b> ${lernStreak() === 1 ? "Tag" : "Tage"} in Folge</div>
    </div>
    <div class="lern-bar" title="${s.richtig} von ${s.total} richtig beantwortet"><i></i></div>
    <p class="lern-hint lern-kasten">Karteikasten mit 5 Fächern
      <button type="button" class="help-tip" data-help="leitner" aria-label="Hilfe: Der Karteikasten">?</button></p>
    <div class="lern-boxes">${s.boxes.map((n, i) => `<div class="lern-box"><span><i></i></span><small>Fach ${i + 1}<br>${n}</small></div>`).join("")}</div>
    ${catStats.length > 1 ? `<div class="lern-catprog">${catStats.map(r => `
      <span>${esc(r.cat.name)}</span><span class="lern-mini"><i></i></span><small>${r.richtig}/${r.total}</small>`).join("")}</div>` : ""}
    ${s.neu ? `<p class="lern-hint">${s.neu === 1 ? "1 neuer Begriff wartet" : s.neu + " neue Begriffe warten"} noch, pro Tag kommen bis zu ${NEU_PRO_TAG} dazu.</p>` : ""}
    ${lernCur ? `
      ${lernCardHtml(lernCur)}
      <p class="lern-hint">${counting && round ? `Frage ${round.n + 1} von ${round.size} · ` : ""}${esc(lernCur.cat.name)}
        · ${counting ? `Fach ${lern.cards[lernCur.item.id].box}` : "freies Üben (zählt nicht)"}</p>
      ${choice ? `
      <div class="lern-choices" id="lernChoices">${lernChoices(lernCur, items).map(n =>
        `<button type="button" class="ghost" data-name="${esc(n)}">${esc(n)}</button>`).join("")}</div>
      <p class="lern-hint">Neue Begriffe wählst du aus. Ab Fach 2 tippst du den Namen selbst ein.</p>
      <p><button type="button" class="ghost" id="lernSkip">Weiss nicht</button></p>`
      : `
      <form id="lernForm" class="lern-form" autocomplete="off">
        <input id="lernInput" type="text" placeholder="Name eintippen" autocapitalize="off" spellcheck="false" enterkeyhint="done" aria-label="Name">
        <button>Prüfen</button>
        <button type="button" class="ghost" id="lernTip">Tipp</button>
        <button type="button" class="ghost" id="lernSkip">Weiss nicht</button>
      </form>
      <p class="lern-tip" id="lernTipText" hidden></p>`}
      <div id="lernFeedback" class="lern-feedback" aria-live="polite"></div>`
    : roundDone && s.due ? `
      <div class="lern-done">
        <h3>Runde geschafft!</h3>
        <p>${round.right} von ${round.size} richtig${round.helped ? `, ${round.helped} mit Tipp` : ""}.
          Heute ${s.due === 1 ? "ist noch 1 Begriff" : `sind noch ${s.due} Begriffe`} fällig.</p>
        <div class="offline">
          <button id="lernNextRound">Nächste Runde</button>
          <button class="ghost" id="lernStop">Fertig für heute</button>
        </div>
      </div>`
    : `
      <div class="lern-done">
        <h3>Für heute ist alles wiederholt.</h3>
        <p>${roundText} ${s.next < Infinity ? `Die nächste Abfrage ist ${esc(lernWhen(s.next))}.` : "Morgen kommen neue Begriffe dazu."}
          Komm dann wieder: Mit jeder Wiederholung wandern die Begriffe weiter ins Langzeitgedächtnis.</p>
        <div class="offline">
          ${s.neu ? `<button id="lernMoreNew">${Math.min(NEU_PRO_TAG, s.neu) === 1 ? "1 weiterer neuer Begriff" : Math.min(NEU_PRO_TAG, s.neu) + " weitere neue Begriffe"}</button>` : ""}
          <button class="${s.neu ? "ghost" : ""}" id="lernPracticeBtn">Trotzdem weiterüben</button>
        </div>
        <p class="lern-hint">Freies Üben zählt nicht fürs Lernsystem.</p>
      </div>`}`;
  lernBarEvents();

  // Balken über CSSOM (die Content-Security-Policy verbietet style-Attribute)
  lernEl.querySelector(".lern-bar i").style.width = (s.total ? 100 * s.richtig / s.total : 0) + "%";
  const max = Math.max(1, ...s.boxes);
  lernEl.querySelectorAll(".lern-box i").forEach((el, i) => { el.style.height = (100 * s.boxes[i] / max) + "%"; });
  lernEl.querySelectorAll(".lern-mini i").forEach((el, i) => { el.style.width = (100 * catStats[i].richtig / catStats[i].total) + "%"; });
  document.getElementById("lernPracticeBtn")?.addEventListener("click", () => { lernPractice = true; renderLernQuiz(); });
  document.getElementById("lernNextRound")?.addEventListener("click", () => { lernRound = null; renderLernQuiz(); });
  document.getElementById("lernStop")?.addEventListener("click", () => { lernRound = null; location.hash = "#/"; });
  document.getElementById("lernMoreNew")?.addEventListener("click", () => {
    lernIntroduce(items, NEU_PRO_TAG);
    lernSave();
    lernPractice = false;
    lernRound = null;
    renderLernQuiz();
  });
  if(!lernCur) return;

  // Bilder zum Umschalten und Vergrössern (ohne Textseite); die Quelle erst nach der Antwort zeigen
  const { cat, item } = lernCur;
  const card = lernEl.querySelector(".lern-card");
  let cardZoom = null;
  const cardCarousel = carousel(card, () => cardZoom?.reset());
  cardZoom = zoomable(card, {
    image:() => card.querySelectorAll(".slide")[cardCarousel.cur]?.querySelector("img.loaded"),
    onSwipe:dir => cardCarousel.go(cardCarousel.cur + dir)
  });
  cardCarousel.go(0);
  card.querySelectorAll(".slide").forEach(s => fillSlide(s, cat, item, +s.dataset.k));

  const form = document.getElementById("lernForm"), input = document.getElementById("lernInput");
  const choices = document.getElementById("lernChoices");
  let helped = false;   // Tipp benutzt: richtig zählt nur halb (bleibt im selben Fach)

  const answer = given => {
    const result = given === null ? false : choice ? (given === item.n ? "exact" : false) : lernMatch(given, item.n);
    const progress = lern.cards[item.id];
    if(counting){
      if(result && helped){
        progress.due = startOfToday() + LEITNER_TAGE[progress.box - 1] * DAY;
      }else{
        progress.box = result ? Math.min(5, progress.box + 1) : 1;
        progress.due = result ? startOfToday() + LEITNER_TAGE[progress.box - 1] * DAY : 0;
      }
      lernMarkDay();
      lernSave();
      if(lernRound){ lernRound.n++; if(result && helped) lernRound.helped++; else if(result) lernRound.right++; }
    }
    const name = `<b>${esc(item.n)}</b>${item.s ? `, <span class="${cat.latin ? "latin" : ""}">${esc(item.s)}</span>` : ""}`;
    const where = !counting ? "" : !result ? " Zurück in Fach 1, kommt bald nochmals."
      : helped ? ` Mit Tipp bleibt der Begriff in Fach ${progress.box}, nächste Abfrage ${esc(lernWhen(progress.due))}.`
      : ` Kommt in Fach ${progress.box}, nächste Abfrage ${esc(lernWhen(progress.due))}.`;
    const lead = result === "exact" ? (helped ? "Richtig, mit Tipp:" : "Richtig!") : result === "typo" ? "Fast richtig, es heisst"
      : given === null ? "Das ist" : "Leider falsch. Richtig ist";
    const merksatz = lernMerksatz(item);
    document.getElementById("lernFeedback").innerHTML = `
      <p class="${result ? "ok" : "bad"}">${lead} ${name}.${where}</p>
      ${merksatz ? `<p class="lern-fact"><b>Merksatz:</b> ${esc(merksatz)}</p>` : ""}
      <button id="lernNext">Weiter</button>`;
    // Bedienelemente sperren; bei der Auswahl die richtige und die gewählte Antwort markieren
    lernEl.querySelectorAll("#lernForm button, #lernChoices button, #lernSkip").forEach(b => { b.disabled = true; });
    if(input) input.disabled = true;
    choices?.querySelectorAll("button").forEach(b => {
      if(b.dataset.name === item.n) b.classList.add("right");
      else if(b.dataset.name === given) b.classList.add("wrong");
    });
    card.classList.add("revealed");   // jetzt darf «Quelle» (mit dem Dateinamen) sichtbar sein
    const next = document.getElementById("lernNext");
    next.addEventListener("click", renderLernQuiz);
    next.focus();
  };

  document.getElementById("lernSkip").addEventListener("click", () => answer(null));
  if(choice){
    choices.addEventListener("click", e => { const b = e.target.closest("button[data-name]"); if(b && !b.disabled) answer(b.dataset.name); });
    return;
  }
  form.addEventListener("submit", e => { e.preventDefault(); if(input.value.trim()) answer(input.value); else input.focus(); });
  document.getElementById("lernTip").addEventListener("click", ev => {
    helped = true;
    const tip = document.getElementById("lernTipText");
    tip.textContent = "Tipp: " + lernHint(item.n);
    tip.hidden = false;
    ev.target.disabled = true;
    input.focus();
  });
  input.focus();
}

/* ------------------------------------------------------------------
   MEMORY am Ende der LernApp: 4 × 4 Karten, Bild und Name desselben Eintrags bilden ein Paar
------------------------------------------------------------------- */
const MEMO_PAARE = 8;      // höchstens 8 Paare = 16 Karten
const MEMO_ZEIT = 1200;    // so lange bleiben zwei falsche Karten offen (Millisekunden)
const memoSel = document.getElementById("memoCat");
const memoGrid = document.getElementById("memoGrid");
const memoStatus = document.getElementById("memoStatus");
const memoEnd = document.getElementById("memoEnd");
let memo = null;           // { pairs:[{cat,item}], cards:[{pair, kind}], open:[i], found, moves, lock }
let lastMemoCat = null;

// Auswahl der Kategorie für ein Spiel (Memory, Duell, Detektiv): kommt man aus einer Kategorie,
// ist sie vorgewählt, sonst die zuletzt gespielte; «*» = alle gemischt
function fillGameSelect(sel, cats, last){
  const keep = lastCat || last || sel.value;
  sel.innerHTML = `<option value="*">Alle Kategorien gemischt</option>`
    + cats.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("");
  if([...sel.options].some(o => o.value === keep)) sel.value = keep;
}
function fillGameSelects(){
  fillGameSelect(memoSel, CATS.filter(c => c.items.length > 1), lastMemoCat);
  const duelIds = new Set(duelPairs().flatMap(p => [p.a.cat.id, p.b.cat.id]));
  fillGameSelect(duelSel, CATS.filter(c => duelIds.has(c.id)), lastDuelCat);
  fillGameSelect(detSel, CATS.filter(c => c.items.length > 1), lastDetCat);
}

/* Spielende (alle drei Spiele): Spruch nach Resultat, persönlicher Rekord mit Durchschnitt, Konfetti bei echtem Erfolg.
   Rekorde in localStorage «sff-rekorde»: { "<spiel>|<kategorie>": { best, last:[letzte Resultate] } }, nur auf diesem Gerät */
const REKORD_KEY = "sff-rekorde";
const REKORD_LETZTE = 10;   // Durchschnitt über die letzten 10 Spiele
const SPIEL_NAME = { memo:"Memory", duel:"Duell", det:"Detektiv" };
function gameRecord(game, catId, value, lowerWins){
  let all = {};
  try{ all = JSON.parse(localStorage.getItem(REKORD_KEY)) || {}; }catch{}
  const key = game + "|" + catId, r = all[key] || { best:null, last:[] };
  const isNew = r.best !== null && (lowerWins ? value < r.best : value > r.best);
  if(r.best === null || isNew) r.best = value;
  r.last = [...r.last, value].slice(-REKORD_LETZTE);
  all[key] = r;
  try{ localStorage.setItem(REKORD_KEY, JSON.stringify(all)); }catch{}
  return { best:r.best, avg:r.last.reduce((s, v) => s + v, 0) / r.last.length, count:r.last.length, isNew };
}
const zahl = x => String(Math.round(x * 10) / 10).replace(".", ",");
// Rekordzeile; unit(x) = «11 Züge», newText = «in 11 Zügen» bzw. «mit 9 von 10»
function recordHtml(game, catId, rec, unit, newText){
  const where = catId === "*" ? "alle Kategorien" : CATS.find(c => c.id === catId)?.name || "";
  return (rec.isNew ? `<p class="game-record new">Neuer Rekord: ${SPIEL_NAME[game]} ${esc(where)} ${newText}!</p>` : "")
    + `<p class="game-record">Rekord: ${unit(rec.best)}`
    + (rec.count > 1 ? ` · Durchschnitt: ${zahl(rec.avg)} (letzte ${rec.count} Spiele)` : " · erstes Spiel mit dieser Auswahl")
    + `</p>`;
}
// Liste zum Nachschauen: Einträge mit Link zur Karte
const gameLink = ({ cat, item }) => `<a href="${esc(entryLink(cat, item))}">${esc(item.n)}</a>`;

// Konfetti in Sonnengelb, etwa 1,5 Sekunden, ohne Ton; nicht bei «Bewegung reduzieren»
function confetti(){
  if(matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const box = document.createElement("div");
  box.className = "confetti";
  box.setAttribute("aria-hidden", "true");
  for(let i = 0; i < 60; i++){
    const s = document.createElement("span");
    s.className = "c" + (i % 3);
    s.style.setProperty("--x", (Math.random() * 100).toFixed(1) + "vw");
    s.style.setProperty("--dx", ((Math.random() - .5) * 30).toFixed(1) + "vw");
    s.style.setProperty("--r", Math.round((Math.random() - .5) * 1440) + "deg");
    s.style.setProperty("--d", Math.round(Math.random() * 350) + "ms");
    box.append(s);
  }
  document.body.append(box);
  setTimeout(() => box.remove(), 2000);
}

function memoStart(){
  const id = memoSel.value;
  lastMemoCat = id;
  memoEnd.hidden = true;
  // Zufällige Einträge, jeder Name nur einmal (sonst gäbe es zwei gleiche Namenskarten)
  const names = new Set();
  const pairs = shuffled(CATS.filter(c => id === "*" || c.id === id).flatMap(cat => cat.items.map(item => ({ cat, item }))))
    .filter(p => !names.has(p.item.n) && names.add(p.item.n)).slice(0, MEMO_PAARE);
  if(pairs.length < 2) return;
  memo = { pairs, cards:shuffled(pairs.flatMap((p, i) => [{ pair:i, kind:"bild" }, { pair:i, kind:"name" }])),
    open:[], found:0, moves:0, lock:false };
  memoGrid.innerHTML = memo.cards.map((c, i) => `
    <button type="button" class="memo-card" data-i="${i}" aria-label="Karte ${i + 1}, verdeckt">
      <span class="memo-back" aria-hidden="true"></span>
      <span class="memo-face">${c.kind === "bild" ? `<img alt="">` : `<span class="memo-name">${esc(pairs[c.pair].item.n)}</span>`}</span>
    </button>`).join("");
  // Lange Namen kleiner setzen statt mitten im Wort umzubrechen («Alpenschneehuhn»): --len = längstes Wort
  memoGrid.querySelectorAll(".memo-name").forEach(el => {
    el.style.setProperty("--len", Math.max(...el.textContent.split(/[\s-]+/).map(w => w.length)));
  });
  // Hauptbilder gleich laden, damit sie beim Aufdecken schon da sind
  memoGrid.querySelectorAll(".memo-card").forEach((b, i) => {
    const c = memo.cards[i];
    if(c.kind !== "bild") return;
    const { cat, item } = pairs[c.pair];
    loadPrintImage(b.querySelector("img"), cat, item)
      .catch(() => { b.querySelector(".memo-face").innerHTML = `<span class="memo-name">Bild nicht verfügbar</span>`; });
  });
  memoGrid.hidden = false;
  memoShowStatus();
  document.getElementById("memoStart").textContent = "Neues Memory";
}

function memoShowStatus(){
  const n = memo.pairs.length;
  memoStatus.hidden = false;
  memoStatus.textContent = memo.found === n
    ? `Geschafft! Alle ${n} Paare in ${memo.moves} Zügen gefunden.`
    : `${memo.found} von ${n} Paaren gefunden · ${memo.moves} ${memo.moves === 1 ? "Zug" : "Züge"}`;
}

// Auswertung: Spruch nach Zügen pro Paar (bestenfalls 1), Rekord pro Kategorie (weniger Züge = besser), die Paare zum Nachschauen
function memoFinish(){
  const n = memo.pairs.length, moves = memo.moves, cat = lastMemoCat;
  const top = moves <= n * 1.5;
  const say = top ? "Hervorragend! Kaum ein Zug zu viel."
    : moves <= n * 2.25 ? "Stark! Du merkst dir Bilder und Namen schon gut."
    : "Gut geübt – mit jedem Spiel prägen sich die Bilder besser ein.";
  const rec = gameRecord("memo", cat, moves, true);
  const zuege = x => `${x} ${x === 1 ? "Zug" : "Züge"}`;
  memoEnd.innerHTML = `<div class="lern-done"><h3>${say}</h3>
    ${recordHtml("memo", cat, rec, zuege, `in ${zuege(moves).replace("Züge", "Zügen")}`)}
    <p class="game-review"><b>Die Paare zum Nachschauen:</b> ${memo.pairs.map(gameLink).join(" · ")}</p></div>`;
  memoEnd.hidden = false;
  if(top || rec.isNew) confetti();
}

// Beschriftung für Screenreader: offen zeigt sie den Inhalt, verdeckt nur die Nummer
function memoLabel(b, open){
  const i = +b.dataset.i, c = memo.cards[i];
  b.setAttribute("aria-label", !open ? `Karte ${i + 1}, verdeckt`
    : c.kind === "name" ? `Karte ${i + 1}: ${memo.pairs[c.pair].item.n}`
    : `Karte ${i + 1}: Bild${b.classList.contains("found") ? " " + memo.pairs[c.pair].item.n : ""}`);
}

memoGrid.addEventListener("click", e => {
  const b = e.target.closest(".memo-card");
  if(!b || !memo || memo.lock || b.classList.contains("open")) return;
  b.classList.add("open");
  memoLabel(b, true);
  memo.open.push(b);
  if(memo.open.length < 2) return;
  memo.moves++;
  const [x, y] = memo.open;
  memo.open = [];
  if(memo.cards[+x.dataset.i].pair === memo.cards[+y.dataset.i].pair){
    memo.found++;
    for(const el of [x, y]){ el.classList.add("found"); memoLabel(el, true); }
    memoShowStatus();
    if(memo.found === memo.pairs.length) memoFinish();
    return;
  }
  memo.lock = true;
  memoShowStatus();
  setTimeout(() => {
    for(const el of [x, y]){ el.classList.remove("open"); memoLabel(el, false); }
    memo.lock = false;
  }, MEMO_ZEIT);
});
document.getElementById("memoStart").addEventListener("click", memoStart);

// Hauptbild in ein <img> laden; fehlt es, steht dort ein Hinweis
function gameImage(img, { cat, item }){
  loadPrintImage(img, cat, item).catch(() => { img.replaceWith(Object.assign(document.createElement("span"),
    { className:"game-miss", textContent:"Bild nicht verfügbar" })); });
}

/* ------------------------------------------------------------------
   VERWECHSLUNGS-DUELL: zwei ähnliche Arten nebeneinander, welches Bild zeigt die gesuchte?
   Danach erscheint der Unterschied aus der Verwechslungsgefahr (entries.confusions).
------------------------------------------------------------------- */
const DUELL_RUNDE = 10;    // Paare pro Duell
const duelSel = document.getElementById("duelCat");
const duelBoard = document.getElementById("duelBoard");
let duel = null;           // { list:[{a, b, diff}], i, right, missed:[Paare mit falscher Antwort] }
let lastDuelCat = null;

// Alle Paare, bei denen beide Einträge sichtbar sind; jedes Paar nur einmal (gleicher Unterschied in beide Richtungen)
function duelPairs(){
  const seen = new Set(), out = [];
  for(const cat of CATS) for(const item of cat.items) for(const c of item.cf){
    const other = findByName(c.name);
    if(!other || other.item === item || !c.diff) continue;
    const key = [item.id, other.item.id].sort().join("|");
    if(seen.has(key)) continue;
    seen.add(key);
    out.push({ a:{ cat, item }, b:other, diff:c.diff });
  }
  return out;
}

function duelStart(){
  const id = duelSel.value;
  lastDuelCat = id;
  const list = shuffled(duelPairs().filter(p => id === "*" || p.a.cat.id === id || p.b.cat.id === id)).slice(0, DUELL_RUNDE);
  if(!list.length) return;
  duel = { list, i:0, right:0, missed:[] };
  document.getElementById("duelStart").textContent = "Neues Duell";
  duelShow();
}

function duelShow(){
  const { list, i } = duel;
  if(i >= list.length){
    // Auswertung: Spruch, Rekord (mehr richtig = besser), verwechselte Paare mit Unterschied und Links
    const n = list.length, right = duel.right, cat = lastDuelCat;
    const say = right === n ? "Perfekt! Dich legt keine Verwechslung herein."
      : right >= n * .7 ? "Stark! Nur noch wenige Stolpersteine."
      : "Gut geübt – genau dafür ist das Duell da.";
    const rec = gameRecord("duel", cat, right, false);
    duelBoard.innerHTML = `<div class="lern-done"><h3>${say}</h3>
      <p>${right} von ${n} richtig erkannt.</p>
      ${recordHtml("duel", cat, rec, x => `${x} von ${n} richtig`, `mit ${right} von ${n}`)}
      ${duel.missed.length ? `<p class="game-review"><b>Diese Paare nochmals anschauen:</b></p><ul class="game-review">${duel.missed.map(p =>
        `<li>${gameLink(p.a)} oder ${gameLink(p.b)}: ${esc(p.diff)}</li>`).join("")}</ul>` : ""}</div>`;
    if(right === n || rec.isNew) confetti();
    return;
  }
  const pair = list[i];
  const sides = shuffled([pair.a, pair.b]);             // welches Bild links steht, ist Zufall
  const asked = sides[Math.floor(Math.random() * 2)];   // nach welchem gefragt wird, auch
  duelBoard.innerHTML = `
    <p class="game-head">Paar ${i + 1} von ${list.length} · ${duel.right} richtig</p>
    <p class="duel-q">Welches Bild zeigt: <b>${esc(asked.item.n)}</b>?</p>
    <div class="duel-pics">${sides.map((s, k) => `
      <button type="button" class="duel-pic" data-k="${k}" aria-label="Bild ${k ? "rechts" : "links"}">
        <img alt=""><span class="duel-name" hidden>${esc(s.item.n)}</span>
      </button>`).join("")}</div>
    <div class="lern-feedback" id="duelFeedback" aria-live="polite"></div>`;
  const pics = [...duelBoard.querySelectorAll(".duel-pic")];
  pics.forEach((b, k) => gameImage(b.querySelector("img"), sides[k]));
  duelBoard.querySelector(".duel-pics").addEventListener("click", e => {
    const b = e.target.closest(".duel-pic");
    if(!b || duel.list[duel.i] !== pair || b.disabled) return;
    const ok = sides[+b.dataset.k] === asked;
    if(ok) duel.right++; else duel.missed.push(pair);
    pics.forEach((p, k) => {
      p.disabled = true;
      p.querySelector(".duel-name").hidden = false;
      p.classList.add(sides[k] === asked ? "right" : p === b ? "wrong" : "other");
    });
    document.getElementById("duelFeedback").innerHTML = `
      <p class="${ok ? "ok" : "bad"}">${ok ? `Richtig, das ist <b>${esc(asked.item.n)}</b>.`
        : `Leider falsch: Das ist <b>${esc(sides[+b.dataset.k].item.n)}</b>.`}</p>
      <p class="lern-fact"><b>Unterschied:</b> ${esc(pair.diff)}</p>
      <button id="duelNext">${duel.i + 1 < duel.list.length ? "Nächstes Paar" : "Auswertung"}</button>`;
    const next = document.getElementById("duelNext");
    next.addEventListener("click", () => { duel.i++; duelShow(); });
    next.focus();
  });
}
document.getElementById("duelStart").addEventListener("click", duelStart);

/* ------------------------------------------------------------------
   STECKBRIEF-DETEKTIV: Hinweise kommen nacheinander (Steckbrief-Zeilen, Beschreibung ohne Namen, zuletzt das Bild).
   Wer früh richtig rät, bekommt mehr Punkte; jede falsche Antwort deckt den nächsten Hinweis auf.
------------------------------------------------------------------- */
const DETEKTIV_FAELLE = 5;   // Fälle pro Spiel
const detSel = document.getElementById("detCat");
const detBoard = document.getElementById("detBoard");
let det = null;              // { list:[{cat,item}], pool, i, points, shown, penalty, done, wrong, hard:[schwierige Fälle] }
let lastDetCat = null;

// Namen im Text abdecken: jedes Wort, das einen Teil des Namens (oder des Untertitels) enthält, wird zu «…»;
// Teile ab 3 Buchstaben (Reh, Aal, Inn), ohne Artikel und Bindewörter
const DET_FUELL = new Set(["der", "die", "das", "des", "dem", "den", "und", "von", "vom", "zum", "zur", "mit"]);
function detMask(text, item){
  const parts = `${item.n} ${item.s || ""}`.toLowerCase().split(/[^\p{L}]+/u).filter(w => w.length >= 3 && !DET_FUELL.has(w));
  return text.replace(/[\p{L}-]+/gu, w => parts.some(p => w.toLowerCase().includes(p)) ? "…" : w)
    .replace(/…\s*\([^)]*\)/g, "…");   // Zweitname in Klammern nach dem Namen («Die Waldföhre (Waldkiefer)»)
}
function detHints({ item }){
  return [
    ...item.f.map(f => ({ label:f.k, text:detMask(f.v, item) })),
    ...(item.t ? [{ label:"Beschreibung", text:detMask(item.t, item) }] : []),
    { label:"Bild", image:true }
  ];
}

function detStart(){
  const id = detSel.value;
  lastDetCat = id;
  const pool = CATS.filter(c => id === "*" || c.id === id).flatMap(cat => cat.items.map(item => ({ cat, item })));
  if(pool.length < 2) return;
  det = { list:shuffled(pool).slice(0, DETEKTIV_FAELLE), pool, i:0, points:0, hard:[] };
  document.getElementById("detStart").textContent = "Neues Spiel";
  detCase();
}

function detCase(){
  const { list, i } = det;
  if(i >= list.length){
    const max = list.reduce((s, p) => s + detHints(p).length, 0);
    // Auswertung: Spruch nach Anteil der Punkte, Rekord (mehr Punkte = besser), schwierige Fälle mit Link
    const pts = det.points, cat = lastDetCat;
    const say = pts >= max * .8 ? "Meisterhaft ermittelt! Dir reichen wenige Hinweise."
      : pts >= max * .5 ? "Stark ermittelt! Mit etwas Übung reichen bald noch weniger Hinweise."
      : "Gut ermittelt – jeder gelöste Fall schärft den Blick fürs Wesentliche.";
    const rec = gameRecord("det", cat, pts, false);
    const punkte = x => `${x} ${x === 1 ? "Punkt" : "Punkte"}`;
    detBoard.innerHTML = `<div class="lern-done"><h3>${say}</h3>
      <p>Alle Fälle gelöst: ${pts} von ${max} möglichen Punkten.</p>
      ${recordHtml("det", cat, rec, punkte, `mit ${pts === 1 ? "1 Punkt" : pts + " Punkten"}`)}
      ${det.hard.length ? `<p class="game-review"><b>Diese Arten waren schwierig, schau sie dir nochmals an:</b>
        ${det.hard.map(gameLink).join(" · ")}</p>` : ""}</div>`;
    if(pts >= max * .8 || rec.isNew) confetti();
    return;
  }
  const cur = list[i], hints = detHints(cur);
  Object.assign(det, { shown:1, penalty:0, done:false, wrong:false });
  detBoard.innerHTML = `
    <p class="game-head" id="detHead"></p>
    <ol class="det-hints">${hints.map((h, k) => `<li${k ? " hidden" : ""}>${h.image
      ? `<b>Bild:</b><img alt="Bild des gesuchten Eintrags">` : `<b>${esc(h.label)}:</b> ${esc(h.text)}`}</li>`).join("")}</ol>
    <div class="lern-choices" id="detChoices">${lernChoices(cur, det.pool).map(n =>
      `<button type="button" class="ghost" data-name="${esc(n)}">${esc(n)}</button>`).join("")}</div>
    <p><button type="button" class="ghost" id="detMore">Nächster Hinweis (−1 Punkt)</button></p>
    <div class="lern-feedback" id="detFeedback" aria-live="polite"></div>`;
  const img = detBoard.querySelector(".det-hints img");
  if(img) gameImage(img, cur);   // gleich laden, damit das Bild beim letzten Hinweis schon da ist
  const items = [...detBoard.querySelectorAll(".det-hints li")];
  const more = document.getElementById("detMore");
  const worth = () => Math.max(0, hints.length + 1 - det.shown - det.penalty);
  const head = () => {
    document.getElementById("detHead").textContent = `Fall ${i + 1} von ${list.length} · `
      + (det.done ? "" : `Hinweis ${det.shown} von ${hints.length} · noch ${worth()} ${worth() === 1 ? "Punkt" : "Punkte"} möglich · `)
      + `total ${det.points} ${det.points === 1 ? "Punkt" : "Punkte"}`;
    more.hidden = det.done || det.shown >= hints.length;
  };
  const reveal = () => {
    if(det.shown >= hints.length) return false;
    items[det.shown++].hidden = false;
    return true;
  };
  head();
  more.addEventListener("click", () => { reveal(); head(); });
  document.getElementById("detChoices").addEventListener("click", e => {
    const b = e.target.closest("button[data-name]");
    if(!b || b.disabled || det.done) return;
    if(b.dataset.name !== cur.item.n){
      b.disabled = true;
      b.classList.add("wrong");
      det.wrong = true;
      if(!reveal()) det.penalty++;   // alle Hinweise schon offen: falsche Antwort kostet trotzdem
      head();
      return;
    }
    det.done = true;
    const got = worth();
    det.points += got;
    // Schwierig: falsch geraten oder weniger als die Hälfte der möglichen Punkte
    if(det.wrong || got < hints.length / 2) det.hard.push(cur);
    while(reveal());
    b.classList.add("right");
    detBoard.querySelectorAll("#detChoices button").forEach(x => { x.disabled = true; });
    head();
    document.getElementById("detFeedback").innerHTML = `
      <p class="ok">Richtig, es ist <b>${esc(cur.item.n)}</b>! ${got} ${got === 1 ? "Punkt" : "Punkte"}.</p>
      <button id="detNext">${i + 1 < list.length ? "Nächster Fall" : "Auswertung"}</button>`;
    const next = document.getElementById("detNext");
    next.addEventListener("click", () => { det.i++; detCase(); });
    next.focus();
  });
}
document.getElementById("detStart").addEventListener("click", detStart);

// Karten einer Kategorie (einmal gebaut, danach wiederverwendet: Kategorie, Suche, «Jetzt zu sehen»)
function cardsOf(cat){
  if(!catCards.has(cat.id)) catCards.set(cat.id, cat.items.map(it => buildCard(cat, it)));
  return catCards.get(cat.id);
}
const cardOf = (cat, item) => cardsOf(cat)[cat.items.indexOf(item)];

// Ansicht vorbereiten: Lightbox zu, Hinweise der Übersicht weg, Menüseiten ausblenden
function resetView(pageId){
  if(lightbox.open) lightbox.close();
  for(const el of [document.getElementById("lernBanner"), document.getElementById("daily"), catBar]) if(el) el.hidden = true;
  quickLearn.hidden = false;
  closeHelp();
  grid.replaceChildren();
  window.scrollTo(0, 0);
  for(const p in PAGES) document.getElementById("page-" + p).hidden = p !== pageId;
  grid.hidden = !!pageId;
  searchRow.hidden = !!pageId;   // Suche, «Lernen» und «Drucken» nur auf Übersicht, Kategorien und «Jetzt zu sehen»
  // Farb-Leitsystem: Bereichsfarbe für Seitentitel (css/index.css, body[data-area])
  const area = { lernapp:"learn", spiele:"play" }[pageId];
  if(area) document.body.dataset.area = area; else delete document.body.dataset.area;
}
function setHead(title, intro, sub = true){
  document.body.classList.toggle("in-sub", sub);
  titleEl.textContent = title;
  introEl.textContent = intro;
  introEl.classList.remove("goal");
  introEl.hidden = !intro;   // Startseite ohne Einleitung
  document.title = sub ? title + " – Natur und Schweiz by toj-apps" : "Natur und Schweiz by toj-apps";
}

/* ------------------------------------------------------------------
   ORIENTIERUNG: Leiste in der Kategorie, Einführung beim ersten Besuch, «?»-Erklärungen
------------------------------------------------------------------- */
const catBar = document.getElementById("catBar");
// Wege zu den Spielen mit dieser Kategorie (die Spiele-Seite wählt sie über lastCat vor)
function showCatBar(cat){
  const duel = duelPairs().some(p => p.a.cat === cat || p.b.cat === cat);
  catBar.innerHTML = `<span class="cat-bar-label">Spiele zu ${esc(cat.name)}:</span>
    <a class="chip" href="#/spiele/memo">Memory</a>
    ${duel ? `<a class="chip" href="#/spiele/duel">Verwechslungs-Duell</a>` : ""}
    <a class="chip" href="#/spiele/detektiv">Steckbrief-Detektiv</a>
    <button type="button" class="help-tip" data-help="karte" aria-label="Hilfe: Karten ansehen">?</button>`;
  catBar.hidden = false;
}

// Kurze Erklärungen bei den «?»-Knöpfen: beim Darüberfahren sichtbar, ein Klick hält sie offen (mit Link zur Hilfe)
const HELP = {
  start:{ title:"So funktioniert die Seite", text:"Eine Kachel öffnet eine Kategorie mit Bildern und Steckbriefen. "
    + "Die Suche findet Einträge in allen Kategorien. «Lernen» übt die Namen mit einem Karteikasten, «Spielen» führt zu "
    + "Memory, Verwechslungs-Duell und Steckbrief-Detektiv, «Drucken» erstellt Steckbriefe, Arbeitsblätter und Memory-Karten." },
  karte:{ title:"Karten ansehen", text:"Mit den Pfeilen, den Punkten oder durch Wischen blätterst du durch die Bilder; "
    + "die letzte Seite zeigt Beschreibung und Steckbrief, bei Tieren oft mit Stimme. Ein Tipp aufs Bild zeigt es gross, dort kannst du zoomen. "
    + "Die Knöpfe daneben starten die Spiele mit dieser Kategorie." },
  leitner:{ title:"Der Karteikasten", text:"Jeder Begriff liegt in einem von 5 Fächern. Richtig beantwortet, rutscht er "
    + "ein Fach weiter und kommt erst nach 1, 3, 7 oder 30 Tagen wieder. Falsch beantwortet, geht er zurück in Fach 1 und kommt bald nochmals. "
    + "So übst du genau das, was noch nicht sitzt." }
};
const helpPop = document.createElement("div");
helpPop.className = "help-pop";
helpPop.id = "helpPop";
helpPop.setAttribute("role", "tooltip");
helpPop.hidden = true;
document.body.append(helpPop);
let helpFor = null, helpPinned = false;
function openHelp(btn, pinned){
  const h = HELP[btn.dataset.help];
  if(!h) return;
  if(helpFor && helpFor !== btn) closeHelp();
  helpPop.innerHTML = `<b>${esc(h.title)}</b><p>${esc(h.text)}</p><a href="#/hilfe">Mehr in der Hilfe →</a>`;
  helpPop.hidden = false;
  helpFor = btn;
  helpPinned = pinned;
  btn.setAttribute("aria-expanded", "true");
  btn.setAttribute("aria-describedby", "helpPop");
  // unter dem Knopf, ganz im Fenster (Position über CSSOM, die CSP verbietet style-Attribute)
  const r = btn.getBoundingClientRect(), w = helpPop.offsetWidth;
  helpPop.style.left = Math.max(8, Math.min(document.documentElement.clientWidth - w - 8, r.left + r.width / 2 - w / 2)) + scrollX + "px";
  helpPop.style.top = r.bottom + 8 + scrollY + "px";
}
function closeHelp(){
  if(!helpFor) return;
  helpFor.setAttribute("aria-expanded", "false");
  helpFor.removeAttribute("aria-describedby");
  helpFor = null;
  helpPop.hidden = true;
}
document.addEventListener("click", e => {
  const b = e.target.closest(".help-tip[data-help]");
  if(b){ if(helpFor === b && helpPinned) closeHelp(); else openHelp(b, true); return; }
  if(helpFor && !e.target.closest(".help-pop")) closeHelp();
});
const canHover = matchMedia("(hover: hover)");
document.addEventListener("mouseover", e => {
  const b = canHover.matches && e.target.closest(".help-tip[data-help]");
  if(b && helpFor !== b) openHelp(b, false);
});
document.addEventListener("mouseout", e => {
  if(!helpFor || helpPinned || e.target.closest(".help-tip") !== helpFor) return;
  if(!helpFor.contains(e.relatedTarget)) closeHelp();
});
document.addEventListener("keydown", e => { if(e.key === "Escape" && helpFor){ const b = helpFor; closeHelp(); b.focus(); } });
addEventListener("resize", closeHelp);

// Einführung in 4 Schritten: automatisch beim ersten Besuch der Startseite, sonst über Hilfe → «Einführung nochmals zeigen»
const introDlg = document.getElementById("introDlg");
const INTRO_KEY = "sff-einfuehrung";
const introSteps = [...introDlg.querySelectorAll(".intro-step")];
let introStep = 0;
function introShow(i){
  introStep = Math.max(0, Math.min(introSteps.length - 1, i));
  introSteps.forEach((s, k) => { s.hidden = k !== introStep; });
  document.getElementById("introBack").hidden = introStep === 0;
  document.getElementById("introSkip").hidden = introStep === introSteps.length - 1;   // am Schluss gibt es nichts mehr zu überspringen
  document.getElementById("introNext").textContent = introStep === introSteps.length - 1 ? "Los geht's" : "Weiter";
}
function openIntro(){
  document.getElementById("introHide").checked = true;
  introShow(0);
  introDlg.showModal();
  document.getElementById("introNext").focus();
}
const introSeen = () => { try{ return !!localStorage.getItem(INTRO_KEY); }catch(e){ return true; } };
introDlg.addEventListener("close", () => {
  try{
    if(document.getElementById("introHide").checked) localStorage.setItem(INTRO_KEY, "1");
    else localStorage.removeItem(INTRO_KEY);
  }catch(e){}
});
document.getElementById("introNext").addEventListener("click", () => {
  if(introStep >= introSteps.length - 1) introDlg.close(); else introShow(introStep + 1);
});
document.getElementById("introBack").addEventListener("click", () => introShow(introStep - 1));
document.getElementById("introSkip").addEventListener("click", () => introDlg.close());
document.getElementById("introAgain").addEventListener("click", openIntro);

function render(){
  const id = location.hash.replace(/^#\/?/, "");
  const [first, second] = id.split("/");
  const pageId = PAGES[id] ? id : first === "spiele" ? "spiele" : null;   // #/spiele/<spiel> springt zum Spiel
  const page = pageId && PAGES[pageId];
  const cat = page ? null : CATS.find(c => c.id === first);
  resetView(pageId);
  if(page){
    setHead(page.title, page.intro);
    if(pageId === "copyright"){ buildCredits(); refresh(); }
    if(pageId === "pdf") fillPdfSelect();
    if(pageId === "lernapp") renderLern();
    if(pageId === "spiele"){
      fillGameSelects();
      const game = second && document.getElementById(second);
      if(game?.classList.contains("game")) game.scrollIntoView();
    }
    if(pageId === "quiz") fillQuizSelect();
    if(pageId === "einstellungen") showVersion();
    lastCat = null;
    return;
  }
  if(id === "jetzt"){ renderSeason(); lastCat = null; return; }
  lastCat = cat ? cat.id : null;
  if(!cat){
    setHead("Natur und Schweiz by toj-apps", "", false);
    if(!overviewCards) overviewCards = buildOverview();
    // Kategorie des Tages (dieselbe wie bei der Entdeckung des Tages) steht zuerst und trägt ein Schild
    const di = CATS.some(c => c.items.length) ? CATS.indexOf(dailyPick(dayNumber()).cat) : -1;
    overviewCards.forEach((b, i) => { b.querySelector(".cat-day").hidden = i !== di; b.classList.toggle("today", i === di); });
    grid.append(...(di < 0 ? overviewCards : [overviewCards[di], ...overviewCards.filter((_, i) => i !== di)]));
    showCatProgress();
    showLernBanner();
    showDaily();
    return;
  }
  // Lernziel der Kategorie (019); ohne Lernziel ein kurzer Bedienhinweis
  setHead(cat.name, cat.goal ? "Lernziel: " + cat.goal
    : "Mit den Pfeilen oder durch Wischen durch Bilder und Steckbrief blättern; ein Tipp aufs Bild vergrössert.");
  if(cat.goal){ introEl.innerHTML = `<b>Lernziel:</b> ${esc(cat.goal)}`; introEl.classList.add("goal"); }
  grid.append(...cardsOf(cat));
  showCatBar(cat);
  // Direktlink auf einen Eintrag (#/kategorie/eintrag): Karte zeigen und gross öffnen
  const item = second && cat.items.find(it => slugify(it.n) === second);
  if(item){
    const card = cardOf(cat, item);
    card.scrollIntoView({ block:"center" });
    card.classList.add("focus");
    setTimeout(() => card.classList.remove("focus"), 3000);
    openLightbox(cat, item, 0);
  }
}

/* ------------------------------------------------------------------
   QUIZ FÜR DEN BEAMER (#/quiz): Bilder bildschirmfüllend in zufälliger Reihenfolge, die Lösung auf Tastendruck.
   Leertaste/Enter: Lösung zeigen bzw. weiter; Pfeil rechts: weiter; Pfeil links: zurück; Esc: beenden.
------------------------------------------------------------------- */
const beamer = document.createElement("dialog");
beamer.className = "beamer";
beamer.tabIndex = -1;   // fokussierbar, damit kein Knopf die Leertaste abfängt
document.body.append(beamer);
let quiz = null;   // { list:[{cat,item}], i, shown }

function fillQuizSelect(){
  const sel = document.getElementById("quizCat");
  const keep = lastQuizCat || sel.value;
  sel.innerHTML = `<option value="*">Alle Kategorien gemischt</option>`
    + CATS.map(c => `<option value="${esc(c.id)}">${esc(c.name)} (${c.items.length})</option>`).join("");
  if([...sel.options].some(o => o.value === keep)) sel.value = keep;
}
let lastQuizCat = null;

document.getElementById("quizStart").addEventListener("click", () => {
  const id = document.getElementById("quizCat").value, count = +document.getElementById("quizCount").value;
  lastQuizCat = id;
  const pool = CATS.filter(c => id === "*" || c.id === id).flatMap(cat => cat.items.map(item => ({ cat, item })));
  for(let i = pool.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  quiz = { list:count ? pool.slice(0, count) : pool, i:0, shown:false };
  if(!quiz.list.length) return;
  beamer.showModal();
  // Nur das Quiz-Fenster in den Vollbildmodus: Die ganze Seite im Vollbild läge im Browser über dem Dialog
  beamer.requestFullscreen?.().catch(() => {});
  showQuizItem();
});

// Bilderwechsel im Quiz (Millisekunden)
const QUIZ_TAKT = 2000;
let quizTimer = null;
function showQuizItem(){
  if(quiz.i >= quiz.list.length){
    clearInterval(quizTimer);
    beamer.innerHTML = `<div class="bm-end"><h2>Geschafft!</h2><p>${quiz.list.length} Bilder.</p>
      <p><button id="bmAgain">Nochmals</button> <button class="ghost" id="bmEnd">Beenden</button></p></div>`;
    beamer.querySelector("#bmAgain").addEventListener("click", () => { quiz.i = 0; showQuizItem(); });
    beamer.querySelector("#bmEnd").addEventListener("click", () => beamer.close());
    return;
  }
  const { cat, item } = quiz.list[quiz.i];
  quiz.shown = false;
  const slots = shownSlots(item);
  beamer.innerHTML = `
    <div class="bm-img">${slots.map(() => `<img alt="Welcher Eintrag ist das?">`).join("")}
      <div class="status"><div class="spinner"></div></div></div>
    <div class="bm-bar">
      <span class="bm-count">${quiz.i + 1} / ${quiz.list.length}</span>
      <div class="bm-solution" hidden><b>${esc(item.n)}</b>${item.s ? ` <span class="${cat.latin ? "latin" : ""}">${esc(item.s)}</span>` : ""}
        <small>${esc(lernMerksatz(item))}</small></div>
      <span class="bm-buttons">
        <button id="bmShow">Lösung</button>
        <button class="ghost" id="bmNext">Weiter →</button>
        <button class="ghost" id="bmClose" aria-label="Quiz beenden">×</button>
      </span>
    </div>`;
  // Alle Bilder des Eintrags laden (ohne Textseite und ohne Beschriftung) und im Takt QUIZ_TAKT wechseln
  const imgs = [...beamer.querySelectorAll(".bm-img img")], status = beamer.querySelector(".status");
  let ticked = false;
  const loads = slots.map((k, i) => {
    const show = d => showImg(imgs[i], d);
    const online = () => (resolveItem(cat, item)[k] || Promise.reject()).then(show);
    const loc = localImage(cat, item, k);
    return (loc ? show(loc).catch(online) : online()).then(() => {
      // Beginnen mit dem ersten Bild, auch wenn ein anderes schneller geladen ist (solange noch nicht gewechselt wurde)
      if(!ticked && (i === 0 || !beamer.querySelector(".bm-img img.active"))){
        imgs.forEach(el => el.classList.remove("active"));
        imgs[i].classList.add("active");
      }
      status.remove();
    });
  });
  Promise.allSettled(loads).then(r => { if(r.every(x => x.status === "rejected")) status.textContent = "Bild nicht verfügbar"; });
  clearInterval(quizTimer);
  quizTimer = setInterval(() => {
    const ready = imgs.filter(el => el.classList.contains("loaded"));
    if(ready.length < 2) return;
    ticked = true;
    const cur = ready.findIndex(el => el.classList.contains("active"));
    ready[cur]?.classList.remove("active");
    ready[(cur + 1) % ready.length].classList.add("active");
  }, QUIZ_TAKT);
  beamer.querySelector("#bmShow").addEventListener("click", quizSolution);
  beamer.querySelector("#bmNext").addEventListener("click", () => quizGo(1));
  beamer.querySelector("#bmClose").addEventListener("click", () => beamer.close());
  beamer.focus();   // kein Knopf vorausgewählt: die Leertaste steuert das Quiz
}
function quizSolution(){
  quiz.shown = true;
  beamer.querySelector(".bm-solution").hidden = false;
  beamer.querySelector("#bmShow").hidden = true;
}
function quizGo(dir){ quiz.i = Math.max(0, quiz.i + dir); showQuizItem(); }
// Tasten auf dem ganzen Dokument, solange das Quiz offen ist (ein ausgeblendeter Knopf gibt den Fokus ab).
// Leertaste/Enter auf einem Knopf löst diesen Knopf aus und wird hier nicht nochmals behandelt.
document.addEventListener("keydown", e => {
  if(!beamer.open || !quiz || quiz.i >= quiz.list.length) return;
  if((e.key === " " || e.key === "Enter") && !e.target.closest?.("button")){
    e.preventDefault();
    if(quiz.shown) quizGo(1); else quizSolution();
  }
  if(e.key === "ArrowRight"){ e.preventDefault(); quizGo(1); }
  if(e.key === "ArrowLeft"){ e.preventDefault(); quizGo(-1); }
});
beamer.addEventListener("close", () => {
  clearInterval(quizTimer);
  beamer.replaceChildren();
  quiz = null;
  if(document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
});

/* ------------------------------------------------------------------
   SUCHE (Kopfzeile): Name, lateinischer Name bzw. Untertitel und Kategorie, wie die LernApp ohne
   Gross-/Kleinschreibung und mit ä = ae. Zeigt die Karten der Treffer; neue Adresse beendet die Suche.
------------------------------------------------------------------- */
const searchEl = document.getElementById("search");
const searchRow = document.getElementById("searchRow");
const quickLearn = document.getElementById("quickLearn");
const SEARCH_MAX = 30;
let searchTimer = null;
function runSearch(){
  const q = searchEl.value.trim();
  if(q.length < 2){ render(); return; }
  const n = lernNorm(q);
  const hits = CATS.flatMap(cat => cat.items.filter(item =>
    [item.n, item.s, cat.name].some(t => lernNorm(t || "").includes(n))).map(item => ({ cat, item })));
  resetView(null);
  setHead("Suche", hits.length ? `${hits.length} ${hits.length === 1 ? "Treffer" : "Treffer"} für «${q}»${hits.length > SEARCH_MAX ? `, die ersten ${SEARCH_MAX}` : ""}.`
    : `Nichts gefunden für «${q}».`);
  grid.append(...hits.slice(0, SEARCH_MAX).map(h => cardOf(h.cat, h.item)));
}
searchEl.addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(runSearch, 200); });
searchEl.addEventListener("keydown", e => { if(e.key === "Escape"){ searchEl.value = ""; render(); } });

/* ------------------------------------------------------------------
   JETZT ZU SEHEN (#/jetzt): Einträge, deren Blüte-, Flug-, Pilz- oder Laichzeit laut Steckbrief
   den aktuellen Monat umfasst («Mai–August», «Juli», «November–März» über den Jahreswechsel).
------------------------------------------------------------------- */
const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const SEASON_KEYS = /^(Blütezeit|Flugzeit|Zeit|Laichzeit|Aktiv)$/;
function seasonMonths(item){
  const f = item.f.find(x => SEASON_KEYS.test(x.k));
  if(!f) return null;
  const found = [...f.v.matchAll(new RegExp(MONATE.join("|"), "g"))].map(m => MONATE.indexOf(m[0]));
  if(!found.length) return null;
  if(found.length >= 2 && /–|-|bis/.test(f.v)){
    const set = new Set();
    for(let m = found[0]; ; m = (m + 1) % 12){ set.add(m); if(m === found[1]) break; }
    return set;
  }
  return new Set(found);
}
function renderSeason(){
  const month = new Date().getMonth();
  const groups = CATS.map(cat => ({ cat, items:cat.items.filter(it => seasonMonths(it)?.has(month)) })).filter(g => g.items.length);
  const n = groups.reduce((s, g) => s + g.items.length, 0);
  setHead("Jetzt zu sehen", `Im ${MONATE[month]} blühen, fliegen, wachsen oder laichen diese ${n} Arten (gemäss Steckbrief).`);
  for(const g of groups){
    const head = document.createElement("h2");
    head.className = "grid-head";
    head.textContent = g.cat.name;
    grid.append(head, ...g.items.map(it => cardOf(g.cat, it)));
  }
}

/* ------------------------------------------------------------------
   ENTDECKUNG DES TAGES (Übersicht): jeden Tag ein anderer Eintrag, für alle gleich
------------------------------------------------------------------- */
// Durchmischen einer Zahl (murmur3 fmix32): aufeinanderfolgende Tage ergeben weit auseinanderliegende Werte
function mix32(h){
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}
// Entdeckung eines Tages (Tag = Tage seit 1970, Ortszeit): Kategorie aus dem Tag, nie dieselbe wie am Vortag,
// dann ein Eintrag daraus. Alle Geräte zeigen am selben Tag dasselbe.
const DAILY_START = 20000;   // 04.10.2024: ab hier springt die Kategorie jeden Tag um 1 bis n−1 Plätze weiter
function dailyPick(day){
  const cats = CATS.filter(c => c.items.length);
  let ci = 0;
  if(cats.length > 1) for(let t = DAILY_START + 1; t <= day; t++) ci = (ci + 1 + mix32(t * 2 + 1) % (cats.length - 1)) % cats.length;
  const cat = cats[ci];
  return { cat, item:cat.items[mix32(day * 2) % cat.items.length] };
}
// Heutiger Tag als Zahl (Tage seit 1970, nach Ortsdatum)
function dayNumber(){
  const d = new Date();
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);
}
let dailyExtra = null;   // «Noch eine»: zufälliger anderer Eintrag, gilt bis zum Neuladen
function showDaily(){
  const el = document.getElementById("daily");
  if(!el || !CATS.some(c => c.items.length)) return;
  const today = dailyPick(dayNumber());
  const { cat, item } = dailyExtra || today;
  const link = document.getElementById("dailyLink");
  link.href = entryLink(cat, item);
  link.innerHTML = `<img alt=""><span><small>${dailyExtra ? "Noch eine Entdeckung" : "Entdeckung des Tages"} · ${esc(cat.name)}</small>
    <b>${esc(item.n)}</b>${item.s ? ` <i class="${cat.latin ? "" : "plain"}">${esc(item.s)}</i>` : ""}<br>${esc(lernMerksatz(item))}</span>`;
  const img = link.querySelector("img");
  const loc = localImage(cat, item, shownSlots(item)[0]);
  (loc ? showImg(img, loc) : resolveItem(cat, item)[0].then(d => showImg(img, d))).catch(() => { img.remove(); });
  el.hidden = false;
}
document.getElementById("dailyNext")?.addEventListener("click", () => {
  const all = CATS.flatMap(cat => cat.items.map(item => ({ cat, item })));
  const cur = document.getElementById("dailyLink").getAttribute("href");
  const others = all.filter(x => entryLink(x.cat, x.item) !== cur);
  if(!others.length) return;
  dailyExtra = others[Math.floor(Math.random() * others.length)];
  showDaily();
});

/* ------------------------------------------------------------------
   OFFLINE (Service Worker in sw.js)
   Die Inhalte speichert der Service Worker bei jedem Laden. Eigene Bilder speichert er,
   sobald sie einmal angezeigt wurden. Der Knopf in den Einstellungen lädt alle auf einmal herunter.
------------------------------------------------------------------- */
const IMAGE_CACHE = "sff-bilder";   // gleicher Name wie in sw.js
const OFFLINE_OK = "serviceWorker" in navigator && "caches" in window;
// updateViaCache "none": auch js/version.js (per importScripts im Service Worker) ohne Browser-Cache prüfen
if(OFFLINE_OK) navigator.serviceWorker.register("sw.js", { updateViaCache:"none" }).catch(() => {});

// Nur die eigenen Bilder; Tierstimmen lädt der Browser immer aus dem Netz (sw.js)
const allImageUrls = () => CATS.flatMap(c => c.items.flatMap(it => it.img.filter(Boolean).map(i => i.src)));

/* App installieren (Einstellungen): Chrome, Edge und Android melden mit «beforeinstallprompt», dass sie die Seite
   installieren können; dann erscheint der Knopf. iPhone/iPad kennen das nicht (Anleitung in index.html). */
let installPrompt = null;
const installBtn = document.getElementById("installBtn");
const installWrap = document.getElementById("installWrap");
const installState = document.getElementById("installState");
const runsAsApp = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
function showInstallState(){
  installWrap.hidden = runsAsApp() || !installPrompt;
  installState.textContent = runsAsApp() ? "Die Seite läuft bereits als App."
    : installPrompt ? "Dein Browser kann die Seite direkt installieren:"
    : "So installierst du die Seite, je nach Gerät:";
}
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); installPrompt = e; showInstallState(); });
installBtn.addEventListener("click", async () => {
  if(!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;   // lässt sich nur einmal verwenden
  showInstallState();
});
window.addEventListener("appinstalled", () => {
  installPrompt = null;
  installWrap.hidden = true;
  installState.textContent = "Installiert. Die App findest du jetzt auf dem Startbildschirm bzw. bei den Programmen.";
});
showInstallState();

async function setupOffline(){
  const btn = document.getElementById("offlineBtn");
  const info = document.getElementById("offlineMsg");
  if(!OFFLINE_OK){ info.textContent = "Dieser Browser kann die Bilder nicht offline speichern."; return; }
  const urls = allImageUrls();
  const cache = await caches.open(IMAGE_CACHE);
  const stored = new Set((await cache.keys()).map(r => r.url));
  const missing = () => urls.filter(u => !stored.has(u));
  info.textContent = missing().length
    ? `Lädt alle ${urls.length} Bilder herunter (rund ${Math.round(urls.length * 0.21)} MB), damit die Seite auch ohne Internet vollständig ist.`
    : `Alle ${urls.length} Bilder sind offline gespeichert.`;
  btn.hidden = false;

  btn.addEventListener("click", async () => {
    btn.disabled = true;
    const todo = missing();
    const queue = limiter(4);
    let done = 0, failed = 0;
    const show = () => { info.textContent = `Bilder werden gespeichert … ${done} / ${todo.length}`; };
    show();
    await Promise.all(todo.map(u => queue(async () => {
      try{
        const r = await fetch(u, { mode:"cors", credentials:"omit" });
        if(!r.ok) throw new Error("HTTP " + r.status);
        await cache.put(u, r);
        stored.add(u);
      }catch(e){ failed++; }
      done++; show();
    })));
    // Bilder entfernen, die es auf der Seite nicht mehr gibt (ersetzt oder gelöscht)
    const keep = new Set(urls);
    for(const r of await cache.keys()) if(!keep.has(r.url)) await cache.delete(r);
    info.textContent = failed
      ? `${urls.length - failed} von ${urls.length} Bildern gespeichert. ${failed} fehlen, bitte später nochmals versuchen.`
      : `Alle ${urls.length} Bilder sind offline gespeichert.`;
    btn.disabled = false;
  });
}

/* ------------------------------------------------------------------
   MENÜ (oben rechts)
------------------------------------------------------------------- */
const menuBtn = document.getElementById("menuBtn");
const menu = document.getElementById("menu");
function setMenu(open){
  menu.hidden = !open;
  menuBtn.setAttribute("aria-expanded", open);
}
menuBtn.addEventListener("click", () => setMenu(menu.hidden));
menu.addEventListener("click", e => { if(e.target.closest("a")) setMenu(false); });
// Schliessen mit Klick daneben oder Esc
document.addEventListener("click", e => { if(!menu.hidden && !e.target.closest(".menu-wrap")) setMenu(false); });
document.addEventListener("keydown", e => { if(e.key === "Escape" && !menu.hidden){ setMenu(false); menuBtn.focus(); } });

/* Neuer Stand aus der Verwaltung, ohne die Seite neu zu laden (offener Tab, installierte App):
   beim Zurückkehren auf die Seite und beim Öffnen des Bildnachweises. Hat sich etwas geändert,
   werden die gebauten Karten verworfen und bei der nächsten Ansicht neu gebaut. Die offene Ansicht
   wird nur beim Bildnachweis neu gezeichnet, damit nichts unter dem Finger springt. */
let lastData = "";
async function refresh(){
  let cats;
  try{ cats = await loadCats(); }catch(e){ return; }
  const json = JSON.stringify(cats);
  if(json === lastData) return;
  lastData = json;
  CATS = cats;
  catCards.clear();
  overviewCards = null;
  const id = location.hash.replace(/^#\/?/, "");
  if(id === "copyright") buildCredits();
  if(id === "pdf") fillPdfSelect();
}
document.addEventListener("visibilitychange", () => { if(document.visibilityState === "visible" && lastData) refresh(); });

// «Übersicht»: auch eine laufende Suche beenden (die Adresse ändert sich dann nicht)
document.getElementById("back").addEventListener("click", () => { searchEl.value = ""; if(location.hash.replace(/^#\/?/, "")) location.hash = ""; else render(); });
introEl.textContent = "Inhalte werden geladen …";
loadCats().then(cats => {
  CATS = cats;
  lastData = JSON.stringify(cats);
  window.addEventListener("hashchange", () => { searchEl.value = ""; render(); });
  render();
  // Einführung nur auf der Startseite, nicht bei Direktlinks (z. B. über einen QR-Code)
  if(!location.hash.replace(/^#\/?/, "") && !introSeen()) openIntro();
  setupOffline().catch(() => {
    document.getElementById("offlineMsg").textContent = "Der Offline-Speicher ist in diesem Browser nicht verfügbar (z. B. im privaten Fenster).";
  });
}).catch(async e => {
  await schemaCheck;   // fehlt ein Datenbank-Update, das klar sagen statt nur «nicht geladen»
  introEl.textContent = schemaMissing() ? "Die Inhalte konnten nicht geladen werden. " + schemaHint()
    : "Die Inhalte konnten nicht geladen werden (" + e.message + "). Bitte Internetverbindung prüfen und die Seite neu laden.";
});

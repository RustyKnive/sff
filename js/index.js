/* ------------------------------------------------------------------
   DATEN (aus Supabase, siehe loadCats)
------------------------------------------------------------------- */
const CFG = window.SFF_CONFIG;
let CATS = [];

/* Kategorien mit Einträgen und Bildern in einer Anfrage laden (REST, ohne Bibliothek)
   und in die Form bringen, mit der der Rest der Seite arbeitet:
   Eintrag: n Name, s Untertitel, t Beschreibung, f Steckbrief [{k,v}], q Suchbegriffe,
   wp Wikipedia-Titel, lb eigene Bildbeschriftungen, img[0..3] eigene Bilder (oder null) */
async function loadCats(){
  const select = "id,name,description,latin,labels,cover_entry_id,"
    + "entries!entries_category_id_fkey(id,name,subtitle,description,facts,search_terms,wp,labels,"
    + "images(position,storage_path,source_page,source_file))";
  const url = CFG.url + "/rest/v1/categories?select=" + encodeURIComponent(select)
    + "&order=sort.asc,name.asc&entries.order=sort.asc,name.asc";
  const r = await fetch(url, { headers:{ apikey:CFG.key } });
  if(!r.ok) throw new Error("HTTP " + r.status);
  const rows = await r.json();
  const publicUrl = path => CFG.url + "/storage/v1/object/public/" + CFG.bucket + "/"
    + path.split("/").map(encodeURIComponent).join("/");
  return rows.map(c => ({
    id:c.id, name:c.name, desc:c.description, latin:c.latin, labels:c.labels,
    cover:Math.max(0, c.entries.findIndex(e => e.id === c.cover_entry_id)),
    items:c.entries.map(e => ({
      id:e.id, n:e.name, s:e.subtitle, t:e.description, f:e.facts || [],
      q:e.search_terms || [], wp:e.wp, lb:e.labels,
      img:[1,2,3,4].map(p => {
        const i = e.images.find(x => x.position === p);
        return i ? { src:publicUrl(i.storage_path), page:i.source_page, file:i.source_file } : null;
      })
    }))
  }));
}

/* ------------------------------------------------------------------
   BILDER (eigene aus Supabase, sonst live von Wikimedia; Suche in js/wikimedia.js)
------------------------------------------------------------------- */
const ARROW_L = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';
const ARROW_R = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>';
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
// Nur http(s)-Adressen als Link verwenden (kein «javascript:» o. Ä.)
const safeUrl = s => /^https?:\/\//i.test(s || "") ? s : null;

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
function showImg(img, data){
  return preload(data.src).then(() => {
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
   KARTE EINES EINTRAGS (4 Bilder + Text) und LIGHTBOX (dieselben Seiten gross)
------------------------------------------------------------------- */
// Die 5 Seiten eines Eintrags; in der Lightbox steht der Name zusätzlich in der Beschriftung
function slidesHtml(cat, item, labels, big){
  const facts = item.f.map(({k, v}) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("");
  return labels.map(l => `
    <div class="slide" data-alt="${esc(item.n + " – " + l)}">
      <img alt="">
      <div class="status"><div class="spinner"></div></div>
      <span class="tag">${esc(big ? item.n + " · " + l : l)}</span>
      <a class="credit" target="_blank" rel="noopener" hidden>Quelle</a>
    </div>`).join("") + `
    <div class="slide text"><div class="text-inner">
      <h2>${esc(item.n)}</h2>
      <p class="sub${cat.latin ? " latin" : ""}">${esc(item.s)}</p>
      <p>${esc(item.t)}</p>
      <dl>${facts}</dl>
    </div></div>`;
}
function controlsHtml(labels){
  return `
    <button class="nav prev" aria-label="Zurück">${ARROW_L}</button>
    <button class="nav next" aria-label="Weiter">${ARROW_R}</button>
    <div class="dots">
      ${labels.map((l, k) => `<button class="dot" aria-label="${esc(l)}" data-i="${k}"></button>`).join("")}
      <button class="dot txt" aria-label="Beschreibung" data-i="4"></button>
    </div>`;
}

// Blättern mit Pfeilen und Punkten; onChange bekommt die aktuelle Seite (4 = Text)
function carousel(root, onChange){
  const track = root.querySelector(".track");
  const dots = [...root.querySelectorAll(".dot")];
  const N = dots.length;
  let cur = 0;
  const go = n => {
    cur = (n + N) % N;
    track.style.transform = `translateX(-${cur * 100}%)`;
    dots.forEach((d, k) => d.classList.toggle("active", k === cur));
    if(onChange) onChange(cur);
  };
  root.querySelector(".prev").addEventListener("click", e => { e.stopPropagation(); go(cur - 1); });
  root.querySelector(".next").addEventListener("click", e => { e.stopPropagation(); go(cur + 1); });
  dots.forEach(d => d.addEventListener("click", e => { e.stopPropagation(); go(+d.dataset.i); }));
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
    ${controlsHtml(labels)}`;

  const c = carousel(card, cur => card.classList.toggle("on-text", cur === 4));
  c.go(0);

  // Hauptbild sofort laden, die weiteren Bilder erst beim ersten Darüberfahren
  const slides = card.querySelectorAll(".slide:not(.text)");
  fillSlide(slides[0], cat, item, 0);
  let rest = false;
  const loadRest = () => { if(rest) return; rest = true; for(let k = 1; k < slides.length; k++) fillSlide(slides[k], cat, item, k); };
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

// Lightbox: ein <dialog> für die ganze Seite. Schliessen mit ×, Esc oder «Zurück» im Browser.
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
      ${controlsHtml(labels)}
      <button class="lb-close" aria-label="Schliessen">×</button>
    </div>`;
  const root = lightbox.querySelector(".lb");
  lbCarousel = carousel(root);
  // Die Bilder sind meist schon geladen (Browser- und Offline-Speicher), sonst werden sie jetzt geholt
  root.querySelectorAll(".slide:not(.text)").forEach((s, k) => fillSlide(s, cat, item, k));
  lbCarousel.go(start);
  root.querySelector(".lb-close").addEventListener("click", () => lightbox.close());
  document.body.classList.add("lb-open");
  lightbox.showModal();
}
lightbox.addEventListener("close", () => {
  document.body.classList.remove("lb-open");
  lightbox.replaceChildren();
  lbCarousel = null;
});
lightbox.addEventListener("keydown", e => {
  if(!lbCarousel) return;
  if(e.key === "ArrowRight"){ lbCarousel.go(lbCarousel.cur + 1); e.preventDefault(); }
  if(e.key === "ArrowLeft"){ lbCarousel.go(lbCarousel.cur - 1); e.preventDefault(); }
});
// Wischen auf dem Handy
let swipeX = null;
lightbox.addEventListener("pointerdown", e => { swipeX = e.clientX; });
lightbox.addEventListener("pointerup", e => {
  if(swipeX === null || !lbCarousel) return;
  const dx = e.clientX - swipeX;
  swipeX = null;
  if(Math.abs(dx) > 50) lbCarousel.go(lbCarousel.cur + (dx < 0 ? 1 : -1));
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
      <div class="cap"><strong>${esc(cat.name)}</strong><span>${esc(cat.desc)}</span></div>`;
    b.addEventListener("click", () => { location.hash = "#/" + cat.id; });
    const img = b.querySelector("img");
    const status = b.querySelector(".status");
    img.alt = cat.name;
    const item = cat.items[cat.cover];
    if(!item){ status.remove(); return b; }
    const online = () => resolveItem(cat, item)[0].then(d => showImg(img, d));
    const loc = localImage(cat, item, 0);
    (loc ? showImg(img, loc).catch(online) : online()).finally(() => status.remove());
    return b;
  });
}

function render(){
  const id = location.hash.replace(/^#\/?/, "");
  const cat = CATS.find(c => c.id === id);
  if(lightbox.open) lightbox.close();
  grid.replaceChildren();
  window.scrollTo(0, 0);
  if(!cat){
    document.body.classList.remove("in-cat");
    titleEl.textContent = "Natur und Schweiz by toj";
    introEl.textContent = "Wähle eine Kategorie.";
    document.title = "Natur und Schweiz by toj";
    if(!overviewCards) overviewCards = buildOverview();
    grid.append(...overviewCards);
    return;
  }
  document.body.classList.add("in-cat");
  titleEl.textContent = cat.name;
  introEl.textContent = "Mit der Maus auf ein Bild fahren und mit den Pfeilen durch die Bilder und den Steckbrief blättern.";
  document.title = cat.name + " – Natur und Schweiz by toj";
  if(!catCards.has(cat.id)) catCards.set(cat.id, cat.items.map(it => buildCard(cat, it)));
  grid.append(...catCards.get(cat.id));
}

/* ------------------------------------------------------------------
   OFFLINE (Service Worker in sw.js)
   Die Inhalte speichert der Service Worker bei jedem Laden. Eigene Bilder speichert er,
   sobald sie einmal angezeigt wurden. Der Knopf lädt alle auf einmal herunter.
------------------------------------------------------------------- */
const IMAGE_CACHE = "sff-bilder";   // gleicher Name wie in sw.js
const OFFLINE_OK = "serviceWorker" in navigator && "caches" in window;
if(OFFLINE_OK) navigator.serviceWorker.register("sw.js").catch(() => {});

const allImageUrls = () => CATS.flatMap(c => c.items.flatMap(it => it.img.filter(Boolean).map(i => i.src)));

async function setupOffline(){
  if(!OFFLINE_OK) return;
  const box = document.getElementById("offline");
  const btn = document.getElementById("offlineBtn");
  const info = document.getElementById("offlineMsg");
  const urls = allImageUrls();
  const cache = await caches.open(IMAGE_CACHE);
  const stored = new Set((await cache.keys()).map(r => r.url));
  const missing = () => urls.filter(u => !stored.has(u));
  info.textContent = missing().length
    ? `Lädt alle ${urls.length} Bilder herunter (rund ${Math.round(urls.length * 0.21)} MB), damit die Seite auch ohne Internet vollständig ist.`
    : `Alle ${urls.length} Bilder sind offline gespeichert.`;
  box.hidden = false;

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

document.getElementById("back").addEventListener("click", () => { location.hash = ""; });
introEl.textContent = "Inhalte werden geladen …";
loadCats().then(cats => {
  CATS = cats;
  window.addEventListener("hashchange", render);
  render();
  setupOffline().catch(() => {});
}).catch(e => {
  introEl.textContent = "Die Inhalte konnten nicht geladen werden (" + e.message + "). Bitte Internetverbindung prüfen und die Seite neu laden.";
});

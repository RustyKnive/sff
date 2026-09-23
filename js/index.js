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
   BILDER (Wikipedia / Wikimedia Commons, live geladen)
------------------------------------------------------------------- */
const API_WP = "https://en.wikipedia.org/w/api.php";
const API_C  = "https://commons.wikimedia.org/w/api.php";
const ARROW_L = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';
const ARROW_R = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>';
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
// Nur http(s)-Adressen als Link verwenden (kein «javascript:» o. Ä.)
const safeUrl = s => /^https?:\/\//i.test(s || "") ? s : null;

/* Wikimedia bremst zu viele gleichzeitige Anfragen (Fehler 429).
   Darum: wenige Anfragen gleichzeitig, bei Fehlern warten und erneut versuchen. */
const sleep = ms => new Promise(r => setTimeout(r, ms));
function limiter(n){
  let active = 0; const queue = [];
  const next = () => {
    if(active >= n || !queue.length) return;
    active++;
    const { fn, res, rej } = queue.shift();
    fn().then(res, rej).finally(() => { active--; next(); });
  };
  return fn => new Promise((res, rej) => { queue.push({ fn, res, rej }); next(); });
}
const apiQueue = limiter(3);   // gleichzeitige Suchanfragen
const imgQueue = limiter(4);   // gleichzeitige Bild-Downloads

async function retry(fn, tries = 5){
  let wait = 1500;
  for(let i = 0; ; i++){
    try{ return await fn(i); }
    catch(e){
      if(e.fatal || i >= tries - 1) throw e;
      await sleep(e.retryAfter || wait);
      wait *= 2;
    }
  }
}
function httpError(r){
  const e = new Error("HTTP " + r.status);
  e.fatal = !(r.status === 429 || r.status >= 500);
  const ra = parseInt(r.headers.get("Retry-After"), 10);
  if(ra) e.retryAfter = Math.min(ra, 60) * 1000;
  return e;
}

function getJSON(url){
  return apiQueue(() => retry(async () => {
    const r = await fetch(url);
    if(!r.ok) throw httpError(r);
    return r.json();
  }));
}

// Titelbild des Wikipedia-Artikels
async function wikiImage(title){
  const u = API_WP + "?action=query&format=json&origin=*&redirects=1&prop=pageimages&piprop=thumbnail|name&pithumbsize=960&titles=" + encodeURIComponent(title);
  const d = await getJSON(u);
  const p = Object.values(d.query.pages)[0];
  if(!p.thumbnail) throw new Error("kein Titelbild");
  return { src:p.thumbnail.source, page:"https://commons.wikimedia.org/wiki/File:" + encodeURIComponent(p.pageimage), file:p.pageimage };
}

// Suche auf Wikimedia Commons – mit immer allgemeineren Ersatz-Suchbegriffen
const OK_MIME = ["image/jpeg", "image/png"];
async function commonsSearch(query, used){
  const u = API_C + "?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=20&gsrsearch="
    + encodeURIComponent(query + " filetype:bitmap") + "&prop=imageinfo&iiprop=url|mime&iiurlwidth=960";
  const d = await getJSON(u);
  const pages = Object.values((d.query && d.query.pages) || {}).sort((a,b) => a.index - b.index);
  for(const p of pages){
    const ii = p.imageinfo && p.imageinfo[0];
    if(!ii || !OK_MIME.includes(ii.mime)) continue;
    const file = p.title.replace(/^File:/, "");
    if(used.has(file)) continue;
    used.add(file);
    return { src:ii.thumburl || ii.url, page:ii.descriptionurl, file };
  }
  return null;
}
async function commonsImage(query, used, base){
  const words = query.split(" ");
  const tries = [query];
  for(let n = words.length - 1; n >= 2; n--) tries.push(words.slice(0, n).join(" "));
  if(base && !tries.includes(base)) tries.push(base);
  for(const q of tries){
    const img = await commonsSearch(q, used);
    if(img) return img;
  }
  throw new Error("nichts gefunden");
}

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
   KARTE EINES EINTRAGS (4 Bilder + Text)
------------------------------------------------------------------- */
function buildCard(cat, item){
  const labels = item.lb || cat.labels;
  const card = document.createElement("article");
  card.className = "card";
  card.tabIndex = 0;
  card.setAttribute("aria-label", item.n);

  const imgSlides = labels.map(l => `
    <div class="slide" data-alt="${esc(item.n + " – " + l)}">
      <img alt="">
      <div class="status"><div class="spinner"></div></div>
      <span class="tag">${esc(l)}</span>
      <a class="credit" target="_blank" rel="noopener" hidden>Quelle</a>
    </div>`).join("");
  const facts = item.f.map(({k, v}) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("");

  card.innerHTML = `
    <div class="track">
      ${imgSlides}
      <div class="slide text">
        <h2>${esc(item.n)}</h2>
        <p class="sub${cat.latin ? " latin" : ""}">${esc(item.s)}</p>
        <p>${esc(item.t)}</p>
        <dl>${facts}</dl>
      </div>
    </div>
    <div class="name">${esc(item.n)}</div>
    <button class="nav prev" aria-label="Zurück">${ARROW_L}</button>
    <button class="nav next" aria-label="Weiter">${ARROW_R}</button>
    <div class="dots">
      ${labels.map((l,k)=>`<button class="dot" aria-label="${esc(l)}" data-i="${k}"></button>`).join("")}
      <button class="dot txt" aria-label="Beschreibung" data-i="4"></button>
    </div>`;

  const track = card.querySelector(".track");
  const dots = [...card.querySelectorAll(".dot")];
  const N = 5;
  let cur = 0;
  const go = n => {
    cur = (n + N) % N;
    track.style.transform = `translateX(-${cur * 100}%)`;
    dots.forEach((d, k) => d.classList.toggle("active", k === cur));
    card.classList.toggle("on-text", cur === 4);
  };
  card.querySelector(".prev").addEventListener("click", e => { e.stopPropagation(); go(cur - 1); });
  card.querySelector(".next").addEventListener("click", e => { e.stopPropagation(); go(cur + 1); });
  dots.forEach(d => d.addEventListener("click", () => go(+d.dataset.i)));
  card.addEventListener("keydown", e => {
    if(e.key === "ArrowRight"){ go(cur + 1); e.preventDefault(); }
    if(e.key === "ArrowLeft"){ go(cur - 1); e.preventDefault(); }
  });
  go(0);

  // Hauptbild sofort laden, die weiteren Bilder erst beim ersten Darüberfahren
  const slides = card.querySelectorAll(".slide:not(.text)");
  fillSlide(slides[0], cat, item, 0);
  let rest = false;
  const loadRest = () => { if(rest) return; rest = true; for(let k = 1; k < slides.length; k++) fillSlide(slides[k], cat, item, k); };
  card.addEventListener("mouseenter", loadRest);
  card.addEventListener("focusin", loadRest);
  card.addEventListener("touchstart", loadRest, { passive:true });
  return card;
}

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

document.getElementById("back").addEventListener("click", () => { location.hash = ""; });
introEl.textContent = "Inhalte werden geladen …";
loadCats().then(cats => {
  CATS = cats;
  window.addEventListener("hashchange", render);
  render();
}).catch(e => {
  introEl.textContent = "Die Inhalte konnten nicht geladen werden (" + e.message + "). Bitte Internetverbindung prüfen und die Seite neu laden.";
});

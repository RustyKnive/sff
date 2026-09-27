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
   edited zugeschnitten (Hinweis im Bildnachweis) */
async function loadCats(){
  const select = "id,name,description,latin,labels,cover_entry_id,"
    + "entries!entries_category_id_fkey(id,name,subtitle,description,facts,search_terms,wp,labels,"
    + "images(position,storage_path,source_page,source_file,thumb_x,thumb_y,thumb_zoom,edited))";
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
        return i ? { src:publicUrl(i.storage_path), page:i.source_page, file:i.source_file,
          fx:i.thumb_x, fy:i.thumb_y, z:i.thumb_zoom, edited:i.edited } : null;
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
    </div>`).join("") + `
    <div class="slide text"><div class="text-inner">
      <h2>${esc(item.n)}</h2>
      <p class="sub${cat.latin ? " latin" : ""}">${esc(item.s)}</p>
      <p>${esc(item.t)}</p>
      <dl>${facts}</dl>
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
    track.style.transform = `translateX(-${cur * 100}%)`;
    dots.forEach((d, k) => d.classList.toggle("active", k === cur));
    if(onChange) onChange(cur, cur === N - 1);
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
      <button class="lb-close" aria-label="Schliessen">×</button>
    </div>`;
  const root = lightbox.querySelector(".lb");
  lbCarousel = carousel(root, resetZoom);
  // Die Bilder sind meist schon geladen (Browser- und Offline-Speicher), sonst werden sie jetzt geholt
  root.querySelectorAll(".slide:not(.text)").forEach(s => fillSlide(s, cat, item, +s.dataset.k));
  lbCarousel.go(start);
  root.querySelector(".lb-close").addEventListener("click", () => lightbox.close());
  document.body.classList.add("lb-open");
  lightbox.showModal();
  // Eigener Verlaufseintrag (gleiche Adresse): «Zurück» schliesst nur die Lightbox
  history.pushState({ lb:true }, "");
}
lightbox.addEventListener("close", () => {
  document.body.classList.remove("lb-open");
  resetZoom();
  lightbox.replaceChildren();
  lbCarousel = null;
  // Mit × oder Esc geschlossen: den Verlaufseintrag der Lightbox wieder entfernen
  if(history.state && history.state.lb) history.back();
});
window.addEventListener("popstate", () => { if(lightbox.open) lightbox.close(); });
lightbox.addEventListener("keydown", e => {
  if(!lbCarousel) return;
  if(e.key === "ArrowRight"){ lbCarousel.go(lbCarousel.cur + 1); e.preventDefault(); }
  if(e.key === "ArrowLeft"){ lbCarousel.go(lbCarousel.cur - 1); e.preventDefault(); }
  // Zoomen mit + und -, 0 setzt zurück (auf die Fenstermitte)
  const zoomKey = { "+":1.5, "=":1.5, "-":1 / 1.5 }[e.key];
  if(zoomKey){ zoomTo(zoom.s * zoomKey, innerWidth / 2, innerHeight / 2); e.preventDefault(); }
  if(e.key === "0"){ resetZoom(); e.preventDefault(); }
});

/* Zoomen in der Lightbox: Mausrad, Doppelklick bzw. doppelt tippen, zwei Finger.
   Vergrössert lässt sich das Bild ziehen; Wischen blättert nur ungezoomt.
   Das Bild wird mit translate/scale (Ursprung oben links, css/index.css) über seiner Seite verschoben. */
const MAX_ZOOM = 5;
const zoom = { s:1, x:0, y:0, img:null };

function applyZoom(){
  zoom.img.style.transform = `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.s})`;
  lightbox.classList.add("zoomed");
}
function resetZoom(){
  if(zoom.img) zoom.img.style.transform = "";
  Object.assign(zoom, { s:1, x:0, y:0, img:null });
  lightbox.classList.remove("zoomed");
}
// Auf den Faktor s zoomen; der Bildpunkt unter (cx, cy) bleibt dabei an seiner Stelle
function zoomTo(s, cx, cy){
  const img = zoom.img || lightbox.querySelectorAll(".lb .slide")[lbCarousel?.cur]?.querySelector("img.loaded");
  if(!img) return;   // Textseite oder Bild noch nicht geladen
  s = Math.min(MAX_ZOOM, Math.max(1, s));
  if(s === 1){ resetZoom(); return; }
  const r = img.parentElement.getBoundingClientRect();   // die Seite = ungezoomte Fläche
  const px = cx - r.left, py = cy - r.top;
  zoom.x = px - (px - zoom.x) * s / zoom.s;
  zoom.y = py - (py - zoom.y) * s / zoom.s;
  zoom.s = s;
  zoom.img = img;
  panBy(0, 0);
}
// Verschieben, ohne dass neben dem Bild leere Fläche entsteht
function panBy(dx, dy){
  if(!zoom.img) return;
  const r = zoom.img.parentElement.getBoundingClientRect();
  zoom.x = Math.min(0, Math.max(r.width * (1 - zoom.s), zoom.x + dx));
  zoom.y = Math.min(0, Math.max(r.height * (1 - zoom.s), zoom.y + dy));
  applyZoom();
}

lightbox.addEventListener("wheel", e => {
  if(!lbCarousel || !e.target.closest(".slide:not(.text)")) return;
  e.preventDefault();
  zoomTo(zoom.s * Math.exp(-e.deltaY * 0.002), e.clientX, e.clientY);
}, { passive:false });

// Finger und Maus: ziehen (vergrössert), zwei Finger zoomen, doppelt tippen, wischen (ungezoomt)
const pointers = new Map();
let gesture = null, lastTap = null;
const gap = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
lightbox.addEventListener("pointerdown", e => {
  if(!lbCarousel || e.target.closest("button, a")) return;
  pointers.set(e.pointerId, e);
  if(pointers.size === 1) gesture = { x0:e.clientX, y0:e.clientY, last:e, pinch:null, moved:false };
  if(pointers.size === 2 && gesture){
    const [a, b] = pointers.values();
    gesture.pinch = { d:gap(a, b), s:zoom.s };
    gesture.moved = true;
  }
});
lightbox.addEventListener("pointermove", e => {
  if(!pointers.has(e.pointerId) || !gesture) return;
  pointers.set(e.pointerId, e);
  if(gesture.pinch && pointers.size >= 2){
    const [a, b] = pointers.values();
    zoomTo(gesture.pinch.s * gap(a, b) / gesture.pinch.d, (a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2);
  }else if(zoom.s > 1){
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
  if(zoom.s === 1 && Math.abs(dx) > 50){ lbCarousel.go(lbCarousel.cur + (dx < 0 ? 1 : -1)); return; }
  if(g.moved) return;
  // Doppelt tippen oder klicken: vergrössern bzw. zurück
  const now = Date.now();
  if(lastTap && now - lastTap.t < 350 && gap(e, lastTap.e) < 30){
    zoomTo(zoom.s > 1 ? 1 : 2.5, e.clientX, e.clientY);
    lastTap = null;
  }else lastTap = { t:now, e };
};
lightbox.addEventListener("pointerup", pointerEnd);
lightbox.addEventListener("pointercancel", pointerEnd);
// Sonst zieht die Maus eine Kopie des Bildes, statt es zu verschieben
lightbox.addEventListener("dragstart", e => e.preventDefault());

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
    const loc = localImage(cat, item, shownSlots(item)[0]);   // Hauptbild, sonst das erste vorhandene
    (loc ? showImg(img, loc).catch(online) : online()).finally(() => status.remove());
    return b;
  });
}

// Seiten aus dem Menü (stehen in index.html); gehen vor gleichnamigen Kategorien
const PAGES = {
  pdf:{ title:"PDF drucken", intro:"Eine Kategorie als PDF speichern oder drucken." },
  einstellungen:{ title:"Einstellungen", intro:"Einstellungen für dieses Gerät." },
  admin:{ title:"Admin", intro:"Zugang zur Verwaltung." },
  copyright:{ title:"Copyright", intro:"Urheberrecht und Bildnachweis." }
};

// Bildnachweis: alle eigenen Bilder mit Link zur Quellseite (Urheber und Lizenz).
// Ohne Quelle gilt ein Bild als eigenes Foto; zugeschnittene Bilder bekommen einen Hinweis (CC-Lizenzen verlangen ihn).
function buildCredits(){
  document.getElementById("credits").innerHTML = CATS.map(cat => `
    <h3>${esc(cat.name)}</h3>
    <ul class="credits">${cat.items.map(it => {
      const parts = it.img.map((i, k) => {
        if(!i) return "";
        if(!safeUrl(i.page)) return `<span>Bild ${k + 1}: eigenes Foto</span>`;
        return `<span><a href="${esc(i.page)}" target="_blank" rel="noopener" title="${esc(i.file || "")}">Bild ${k + 1}</a>`
          + `${i.edited ? " <small>(zugeschnitten)</small>" : ""}</span>`;
      }).join("");
      return `<li>${esc(it.n)}${parts || " <small>(Bilder werden live von Wikimedia geladen)</small>"}</li>`;
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

function fillPdfSelect(){
  const sel = document.getElementById("pdfCat");
  const keep = sel.value;
  sel.innerHTML = CATS.map(c => `<option value="${esc(c.id)}">${esc(c.name)} (${c.items.length})</option>`).join("");
  if(CATS.some(c => c.id === keep)) sel.value = keep;
}

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

async function printCategory(cat){
  const btn = document.getElementById("pdfBtn");
  btn.disabled = true;
  pdfMsg.textContent = "Bilder werden geladen …";
  const pages = [];
  for(let i = 0; i < cat.items.length; i += PER_PAGE) pages.push(cat.items.slice(i, i + PER_PAGE));
  printBox.innerHTML = pages.map(p => `<div class="print-page">${p.map(it => `
    <figure class="print-cell">
      <img alt="">
      <figcaption>
        <strong>${esc(it.n)}</strong>${it.s ? ` <span class="${cat.latin ? "latin" : ""}">${esc(it.s)}</span>` : ""}
        <p>${esc(it.t)}</p>
        ${it.f.length ? `<p>${it.f.map(f => `<b>${esc(f.k)}:</b> ${esc(f.v)}`).join(" · ")}</p>` : ""}
        <small class="print-src"></small>
      </figcaption>
    </figure>`).join("")}</div>`).join("");

  // Alle Hauptbilder laden; fehlt eines, bleibt die Fläche leer.
  // Unter dem Text steht klein die Quelle (CC-Lizenzen verlangen sie auch gedruckt): Commons-Seite mit Urheber und Lizenz.
  const cells = printBox.querySelectorAll(".print-cell");
  await Promise.all(cat.items.map((it, i) => loadPrintImage(cells[i].querySelector("img"), cat, it).then(d => {
    cells[i].querySelector(".print-src").textContent = safeUrl(d.page)
      ? "Bild: " + decodeURI(d.page).replace(/^https?:\/\//, "") + (d.edited ? " (zugeschnitten)" : "")
      : "Bild: eigenes Foto";
  }).catch(() => {})));

  pdfMsg.textContent = "";
  btn.disabled = false;
  // Der Titel wird im Druckdialog zum Dateinamen des PDFs
  const title = document.title;
  document.title = "Natur und Schweiz – " + cat.name;
  window.addEventListener("afterprint", () => { document.title = title; printBox.replaceChildren(); }, { once:true });
  window.print();
}

document.getElementById("pdfBtn").addEventListener("click", () => {
  const cat = CATS.find(c => c.id === document.getElementById("pdfCat").value);
  if(cat) printCategory(cat).catch(e => {
    pdfMsg.textContent = "PDF konnte nicht erstellt werden (" + e.message + ").";
    document.getElementById("pdfBtn").disabled = false;
  });
});

function render(){
  const id = location.hash.replace(/^#\/?/, "");
  const page = PAGES[id];
  const cat = page ? null : CATS.find(c => c.id === id);
  if(lightbox.open) lightbox.close();
  grid.replaceChildren();
  window.scrollTo(0, 0);
  for(const p in PAGES) document.getElementById("page-" + p).hidden = p !== id;
  grid.hidden = !!page;
  if(page){
    document.body.classList.add("in-sub");
    titleEl.textContent = page.title;
    introEl.textContent = page.intro;
    document.title = page.title + " – Natur und Schweiz by toj";
    if(id === "copyright"){ buildCredits(); refresh(); }
    if(id === "pdf") fillPdfSelect();
    return;
  }
  if(!cat){
    document.body.classList.remove("in-sub");
    titleEl.textContent = "Natur und Schweiz by toj";
    introEl.textContent = "Wähle eine Kategorie.";
    document.title = "Natur und Schweiz by toj";
    if(!overviewCards) overviewCards = buildOverview();
    grid.append(...overviewCards);
    return;
  }
  document.body.classList.add("in-sub");
  titleEl.textContent = cat.name;
  introEl.textContent = "Mit der Maus auf ein Bild fahren und mit den Pfeilen durch die Bilder und den Steckbrief blättern. "
    + "Ein Klick vergrössert; dort lässt sich mit Mausrad, Doppelklick oder zwei Fingern zoomen.";
  document.title = cat.name + " – Natur und Schweiz by toj";
  if(!catCards.has(cat.id)) catCards.set(cat.id, cat.items.map(it => buildCard(cat, it)));
  grid.append(...catCards.get(cat.id));
}

/* ------------------------------------------------------------------
   OFFLINE (Service Worker in sw.js)
   Die Inhalte speichert der Service Worker bei jedem Laden. Eigene Bilder speichert er,
   sobald sie einmal angezeigt wurden. Der Knopf in den Einstellungen lädt alle auf einmal herunter.
------------------------------------------------------------------- */
const IMAGE_CACHE = "sff-bilder";   // gleicher Name wie in sw.js
const OFFLINE_OK = "serviceWorker" in navigator && "caches" in window;
if(OFFLINE_OK) navigator.serviceWorker.register("sw.js").catch(() => {});

const allImageUrls = () => CATS.flatMap(c => c.items.flatMap(it => it.img.filter(Boolean).map(i => i.src)));

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

document.getElementById("back").addEventListener("click", () => { location.hash = ""; });
introEl.textContent = "Inhalte werden geladen …";
loadCats().then(cats => {
  CATS = cats;
  lastData = JSON.stringify(cats);
  window.addEventListener("hashchange", render);
  render();
  setupOffline().catch(() => {
    document.getElementById("offlineMsg").textContent = "Der Offline-Speicher ist in diesem Browser nicht verfügbar (z. B. im privaten Fenster).";
  });
}).catch(e => {
  introEl.textContent = "Die Inhalte konnten nicht geladen werden (" + e.message + "). Bitte Internetverbindung prüfen und die Seite neu laden.";
});

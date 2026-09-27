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
  lbCarousel = carousel(root, () => lbZoom.reset());
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
  lbZoom.reset();
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
  if(zoomKey){ lbZoom.zoomTo(lbZoom.scale * zoomKey, innerWidth / 2, innerHeight / 2); e.preventDefault(); }
  if(e.key === "0"){ lbZoom.reset(); e.preventDefault(); }
});

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
  lernapp:{ title:"LernApp", intro:"Namen zu Bildern lernen, mit dem Leitner-System." },
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

// Kommt man aus einer Kategorie (lastCat, gesetzt in render), ist sie vorgewählt; sonst bleibt die letzte Wahl
let lastCat = null;
function fillPdfSelect(){
  const sel = document.getElementById("pdfCat");
  const keep = lastCat || sel.value;
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

/* ------------------------------------------------------------------
   LERNAPP: Bild zeigen, Namen eintippen, nach dem Leitner-System wiederholen.
   Fach 1–5; richtig = ein Fach weiter, falsch = zurück in Fach 1. Ein Fach wird erst nach
   LEITNER_TAGE wieder abgefragt, so kommen gut gekonnte Begriffe immer seltener dran.
   Auswahl und Fortschritt liegen im Browser (localStorage, pro Gerät). Neue Auswahl = neuer Anfang.
   Neue Begriffe warten in «Fach 0» und kommen dosiert dazu (NEU_PRO_TAG); abgefragt wird in Runden (RUNDE).
------------------------------------------------------------------- */
const LERN_KEY = "sff-lernen";
const LEITNER_TAGE = [0, 1, 3, 7, 30];   // Fach 1 sofort, Fach 2 nach 1 Tag … Fach 5 nach 30 Tagen
const NEU_PRO_TAG = 10;   // so viele neue Begriffe kommen pro Tag ins Fach 1
const RUNDE = 15;         // Fragen pro Runde
const DAY = 86400000;
const lernEl = document.getElementById("lern");
let lern = lernLoad();   // { cats:[ids], cards:{ entryId:{ box, due } }, newDay, newCount } oder null; box 0 = neu
let lernCur = null;      // aktuelle Frage { cat, item }
let lernPractice = false;   // freies Üben, wenn für heute alles wiederholt ist (zählt nicht)
let lernRound = null;    // laufende Runde { size, n, right } (nur für diese Sitzung)

function lernLoad(){
  try{
    const s = JSON.parse(localStorage.getItem(LERN_KEY));
    if(s && Array.isArray(s.cats) && s.cats.length && s.cards && typeof s.cards === "object") return s;
  }catch(e){}
  return null;
}
function lernSave(){ try{ localStorage.setItem(LERN_KEY, JSON.stringify(lern)); }catch(e){} }
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
  if(lern && lernSync().length) renderLernQuiz(); else renderLernSetup();
}

function renderLernSetup(){
  const sel = new Set(lern ? lern.cats : []);
  lernEl.innerHTML = `
    <h2>Kategorien wählen</h2>
    <p>Wähle eine oder mehrere Kategorien. Die LernApp zeigt ein Bild, und du tippst den Namen ein.
      Nach dem Leitner-System kommen Begriffe, die du gut kannst, immer seltener dran, schwierige öfter.
      So bleiben sie dauerhaft im Gedächtnis. Dein Fortschritt wird auf diesem Gerät gespeichert.</p>
    <div class="lern-cats">${CATS.map(c => `<label><input type="checkbox" value="${esc(c.id)}" ${sel.has(c.id) ? "checked" : ""}>
      ${esc(c.name)} <small>(${c.items.length})</small></label>`).join("")}</div>
    <p id="lernSum" class="lern-sum"></p>
    <div class="offline">
      <button id="lernStart">Lernen starten</button>
      ${lern ? `<button class="ghost" id="lernBack">Zurück, nichts ändern</button>` : ""}
    </div>
    ${lern ? `<p class="lern-hint">Änderst du die Auswahl, beginnt das Lernen von vorn.</p>` : ""}`;
  const boxes = [...lernEl.querySelectorAll(".lern-cats input")];
  const chosen = () => boxes.filter(b => b.checked).map(b => b.value);
  const sum = () => {
    const ids = chosen();
    const n = CATS.filter(c => ids.includes(c.id)).reduce((s, c) => s + c.items.length, 0);
    document.getElementById("lernSum").textContent = ids.length
      ? `${ids.length} ${ids.length === 1 ? "Kategorie" : "Kategorien"} mit ${n} Einträgen gewählt.` : "Noch keine Kategorie gewählt.";
    document.getElementById("lernStart").disabled = !ids.length;
  };
  lernEl.querySelector(".lern-cats").addEventListener("change", sum);
  sum();
  document.getElementById("lernBack")?.addEventListener("click", renderLernQuiz);
  document.getElementById("lernStart").addEventListener("click", () => {
    const ids = chosen();
    const same = lern && ids.length === lern.cats.length && ids.every(id => lern.cats.includes(id));
    if(!same){
      if(lern && !confirm("Die Auswahl hat sich geändert. Das Lernen beginnt dann von vorn, der bisherige Fortschritt wird gelöscht. Weiter?")) return;
      lern = { cats:ids, cards:{} };
    }
    lernPractice = false;
    lernCur = null;
    lernRound = null;
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
  const now = Date.now();
  const active = items.filter(({ item }) => lern.cards[item.id].box > 0);
  // Runden zu höchstens RUNDE Fragen; nach der letzten Frage kommt die Auswertung
  if(!lernPractice && !lernRound && s.due) lernRound = { size:Math.min(RUNDE, s.due), n:0, right:0 };
  const roundDone = !!lernRound && lernRound.n >= lernRound.size;
  let pool = roundDone ? [] : active.filter(({ item }) => lern.cards[item.id].due <= now);
  if(!pool.length && lernPractice) pool = active;
  if(pool.length > 1 && lernCur) pool = pool.filter(p => p.item.id !== lernCur.item.id);   // nicht zweimal hintereinander
  lernCur = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
  const counting = lernCur && lern.cards[lernCur.item.id].due <= now;
  const round = lernRound;
  const roundText = round && round.n ? `Runde: ${round.right} von ${round.n} richtig.` : "";
  if(!lernCur && !(roundDone && s.due)) lernRound = null;   // Tagesende: nächstes Mal beginnt eine neue Runde

  lernEl.innerHTML = `
    <div class="lern-stats">
      <div><b>${s.total}</b> Einträge zu lernen</div>
      <div><b>${s.richtig}</b> richtig beantwortet</div>
      <div><b>${s.fach5}</b> im Langzeitgedächtnis</div>
    </div>
    <div class="lern-bar" title="${s.richtig} von ${s.total} richtig beantwortet"><i></i></div>
    <div class="lern-boxes">${s.boxes.map((n, i) => `<div class="lern-box"><span><i></i></span><small>Fach ${i + 1}<br>${n}</small></div>`).join("")}</div>
    ${s.neu ? `<p class="lern-hint">${s.neu} neue Begriffe warten noch, pro Tag kommen bis zu ${NEU_PRO_TAG} dazu.</p>` : ""}
    ${lernCur ? `
      ${lernCardHtml(lernCur)}
      <p class="lern-hint">${counting && round ? `Frage ${round.n + 1} von ${round.size} · ` : ""}${esc(lernCur.cat.name)}
        · ${counting ? `Fach ${lern.cards[lernCur.item.id].box}` : "freies Üben (zählt nicht)"}</p>
      <form id="lernForm" class="lern-form" autocomplete="off">
        <input id="lernInput" type="text" placeholder="Name eintippen" autocapitalize="off" spellcheck="false" enterkeyhint="done" aria-label="Name">
        <button>Prüfen</button>
        <button type="button" class="ghost" id="lernSkip">Weiss nicht</button>
      </form>
      <div id="lernFeedback" class="lern-feedback" aria-live="polite"></div>`
    : roundDone && s.due ? `
      <div class="lern-done">
        <h3>Runde geschafft!</h3>
        <p>${round.right} von ${round.size} richtig. Heute ${s.due === 1 ? "ist noch 1 Begriff" : `sind noch ${s.due} Begriffe`} fällig.</p>
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
          ${s.neu ? `<button id="lernMoreNew">${Math.min(NEU_PRO_TAG, s.neu)} weitere neue Begriffe</button>` : ""}
          <button class="${s.neu ? "ghost" : ""}" id="lernPracticeBtn">Trotzdem weiterüben</button>
        </div>
        <p class="lern-hint">Freies Üben zählt nicht fürs Lernsystem.</p>
      </div>`}
    <p><button class="ghost" id="lernCats">Kategorien ändern</button></p>`;

  // Balken über CSSOM (die Content-Security-Policy verbietet style-Attribute)
  lernEl.querySelector(".lern-bar i").style.width = (s.total ? 100 * s.richtig / s.total : 0) + "%";
  const max = Math.max(1, ...s.boxes);
  lernEl.querySelectorAll(".lern-box i").forEach((el, i) => { el.style.height = (100 * s.boxes[i] / max) + "%"; });
  document.getElementById("lernCats").addEventListener("click", renderLernSetup);
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
  const answer = given => {
    const result = given === null ? false : lernMatch(given, item.n);
    const progress = lern.cards[item.id];
    if(counting){
      progress.box = result ? Math.min(5, progress.box + 1) : 1;
      progress.due = result ? startOfToday() + LEITNER_TAGE[progress.box - 1] * DAY : 0;
      lernSave();
      if(lernRound){ lernRound.n++; if(result) lernRound.right++; }
    }
    const name = `<b>${esc(item.n)}</b>${item.s ? `, <span class="${cat.latin ? "latin" : ""}">${esc(item.s)}</span>` : ""}`;
    const where = counting ? (result ? ` Kommt in Fach ${progress.box}, nächste Abfrage ${esc(lernWhen(progress.due))}.`
      : " Zurück in Fach 1, kommt bald nochmals.") : "";
    document.getElementById("lernFeedback").innerHTML = `
      <p class="${result ? "ok" : "bad"}">${result === "exact" ? "Richtig!" : result === "typo" ? "Fast richtig, es heisst" : given === null ? "Das ist" : "Leider falsch. Richtig ist"} ${name}.${where}</p>
      <button id="lernNext">Weiter</button>`;
    input.disabled = true;
    form.querySelectorAll("button").forEach(b => { b.disabled = true; });
    card.classList.add("revealed");   // jetzt darf «Quelle» (mit dem Dateinamen) sichtbar sein
    const next = document.getElementById("lernNext");
    next.addEventListener("click", renderLernQuiz);
    next.focus();
  };
  form.addEventListener("submit", e => { e.preventDefault(); if(input.value.trim()) answer(input.value); else input.focus(); });
  document.getElementById("lernSkip").addEventListener("click", () => answer(null));
  input.focus();
}

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
    if(id === "lernapp") renderLern();
    lastCat = null;
    return;
  }
  lastCat = cat ? cat.id : null;
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

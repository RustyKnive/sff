/* ------------------------------------------------------------------
   BILDSUCHE bei Wikipedia / Wikimedia Commons
   Gemeinsam für die Anzeige (js/index.js) und die Verwaltung (js/admin.js).
------------------------------------------------------------------- */
const API_WP = "https://en.wikipedia.org/w/api.php";
const API_C  = "https://commons.wikimedia.org/w/api.php";

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

async function retry(fn, tries = 5){
  let wait = 1500;
  for(let i = 0; ; i++){
    try{ return await fn(i); }
    catch(e){
      // Ohne Internet nicht mehrmals versuchen (Offline-App: nur gespeicherte Bilder)
      if(e.fatal || i >= tries - 1 || !navigator.onLine) throw e;
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
  return { src:p.thumbnail.source, page:"https://commons.wikimedia.org/wiki/File:" + encodeURIComponent(p.pageimage),
    file:p.pageimage.replace(/_/g, " ") };   // Leerzeichen wie bei commonsSearch, damit «used» Doppelte erkennt
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

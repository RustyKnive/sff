/* Service Worker: macht die Anzeige (index.html) offline nutzbar.
   - Seite und Inhalte: zuerst aus dem Netz (immer aktuell), ohne Netz aus dem Zwischenspeicher
   - Eigene Bilder (Supabase Storage): einmal geladen, danach aus dem Zwischenspeicher.
     Jeder Upload bekommt einen neuen Pfad, darum kann ein gespeichertes Bild nie veralten.
   - Die Verwaltung und alle Anfragen mit Anmeldung (Authorization) laufen nie über den Speicher:
     So landen keine Admin-Daten (z. B. ausgeblendete Einträge) im Zwischenspeicher.
   - Wikipedia/Wikimedia (Bild-Fallback) wird nicht gespeichert. */

const APP = "sff-app-v1";      // Version erhöhen, wenn sich die Liste FILES ändert
const DATA = "sff-daten";
const IMAGES = "sff-bilder";   // wird auch von js/index.js gefüllt (Knopf «Für offline speichern»)
const FILES = [
  "./", "index.html", "config.js", "manifest.webmanifest",
  "css/basis.css", "css/index.css", "js/index.js",
  "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png"
];
const WAIT = 4000;             // so lange auf das Netz warten, bevor der gespeicherte Stand kommt

self.addEventListener("install", e => {
  e.waitUntil(caches.open(APP)
    .then(c => c.addAll(FILES.map(f => new Request(f, { cache:"reload" }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith("sff-app-") && k !== APP).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if(req.method !== "GET") return;
  const url = new URL(req.url);

  if(url.origin === location.origin){
    const path = url.pathname.slice(new URL(self.registration.scope).pathname.length);
    if(req.mode === "navigate" ? (path === "" || path === "index.html") : FILES.includes(path)){
      e.respondWith(networkFirst(e, APP, req, "index.html"));
    }
    return;
  }

  if(url.hostname.endsWith(".supabase.co") && !req.headers.has("authorization")){
    if(url.pathname.startsWith("/rest/v1/")) e.respondWith(networkFirst(e, DATA, req));
    else if(url.pathname.startsWith("/storage/v1/object/public/")) e.respondWith(cacheFirst(IMAGES, req.url));
  }
});

// Netz zuerst. Antwortet das Netz nicht rechtzeitig oder gar nicht, kommt der gespeicherte Stand.
async function networkFirst(e, name, req, fallback){
  const cache = await caches.open(name);
  const net = fetch(req).then(r => {
    if(r.ok) e.waitUntil(cache.put(req, r.clone()));
    return r;
  });
  e.waitUntil(net.catch(() => {}));   // im Hintergrund fertig laden und speichern
  const cached = await cache.match(req, { ignoreVary:true })
    || (fallback && await cache.match(fallback));
  if(!cached) return net.catch(() => Response.error());
  const late = new Promise(res => setTimeout(() => res(cached), WAIT));
  return Promise.race([net.then(r => r.ok ? r : cached), late]).catch(() => cached);
}

// Speicher zuerst, sonst aus dem Netz laden und speichern (mit CORS, damit die Antwort lesbar bleibt)
async function cacheFirst(name, url){
  const cache = await caches.open(name);
  const hit = await cache.match(url, { ignoreVary:true });
  if(hit) return hit;
  try{
    const r = await fetch(url, { mode:"cors", credentials:"omit" });
    if(r.ok) await cache.put(url, r.clone());
    return r;
  }catch(err){ return Response.error(); }
}

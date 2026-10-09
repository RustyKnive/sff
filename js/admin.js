// Schutz vor Clickjacking: Die Verwaltung nie in einem fremden Rahmen (iframe) anzeigen
if(window.top !== window.self){ document.body.replaceChildren(); throw new Error("In einem Rahmen gesperrt"); }
const CFG = window.SFF_CONFIG;
const sb = supabase.createClient(CFG.url, CFG.key);
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const slug = s => s.toLowerCase().replace(/ä/g,"ae").replace(/ö/g,"oe").replace(/ü/g,"ue")
  .replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const publicUrl = path => sb.storage.from(CFG.bucket).getPublicUrl(path).data.publicUrl;
const DEFAULT_LABELS = ["Bild 1","Bild 2","Bild 3","Bild 4"];

let cats = [];   // alle Kategorien mit Einträgen und Bildern
let tasks = [];  // Forscheraufträge (021), leer, wenn die Tabelle fehlt
let regions = [];   // Kantone (022), leer, wenn die Tabelle fehlt

/* ------------------------------------------------------------------
   HILFSFUNKTIONEN
------------------------------------------------------------------- */
let msgTimer;
function msg(text, isErr){
  const m = $("msg");
  m.textContent = text;
  m.className = isErr ? "err" : "";
  m.hidden = false;
  clearTimeout(msgTimer);
  msgTimer = setTimeout(() => { m.hidden = true; }, isErr ? 7000 : 2500);
}
// Koordinaten aus dem Feld «Ort auf der Entdeckungskarte»: «47.0410, 9.0670», auch mit Leerzeichen, ° oder N/E und in
// vertauschter Reihenfolge. Leer = null, ungültig = "bad". Bereich wie die Datenbank (028): etwa die Schweiz mit Rand.
const GEO_HINT = "Koordinaten bitte als Breite, Länge in Grad, z. B. «47.0410, 9.0670» (Bereich Schweiz).";
function parseGeo(text){
  const n = (String(text).match(/-?\d+(?:[.,]\d+)?/g) || []).map(s => +s.replace(",", "."));
  if(!String(text).trim()) return null;
  if(n.length !== 2) return "bad";
  const [lat, lon] = n[0] < n[1] ? [n[1], n[0]] : n;
  const ok = lat >= 45 && lat <= 48.5 && lon >= 5 && lon <= 11.5;
  return ok ? [Math.round(lat * 1e5) / 1e5, Math.round(lon * 1e5) / 1e5] : "bad";
}
async function must(p){
  const { data, error } = await p;
  if(error) throw new Error(error.message);
  return data;
}
// Führt eine Änderung aus, lädt danach alles neu und zeigt eine Meldung
async function act(fn, okText){
  try{
    const r = await fn();
    await reload();
    if(okText) msg(okText);
    return r;
  }catch(e){
    msg("Fehler: " + e.message, true);
    throw e;
  }
}

// Versionen: Website aus js/version.js, Datenbank aus app_meta (015); 0 = Tabelle fehlt (älter als 015)
const VERSION = window.SFF_VERSION || { app:"?", datum:"", schema:0 };
let dbSchema = null;
async function loadSchemaVersion(){
  const { data, error } = await sb.from("app_meta").select("schema_version").maybeSingle();
  dbSchema = error ? 0 : (data?.schema_version ?? 0);
  $("version").textContent = `Website ${VERSION.app} · Datenbank ${dbSchema || "14 oder älter"}`;
}
const schemaMissing = () => dbSchema !== null && dbSchema < VERSION.schema;

async function reload(){
  // Mit der Zuordnung zu den Kantonen (022); fehlt die Tabelle noch, ohne sie
  const query = withRegions => sb.from("categories")
    .select(`*, entries!entries_category_id_fkey(*, images(*)${withRegions ? ", entry_regions(*)" : ""})`)
    .order("sort").order("name")
    .order("sort", { referencedTable:"entries" }).order("name", { referencedTable:"entries" });
  let r = await query(true);
  if(r.error) r = await query(false);
  if(r.error) throw new Error(r.error.message);
  cats = r.data;
  cats.forEach(c => c.entries.forEach(e => { e.entry_regions = e.entry_regions || []; }));
  await Promise.all([loadReports(), loadTasks(), loadRegions(), loadLinks()]);
  renderSidebar();
}
async function loadTasks(){
  const { data, error } = await sb.from("tasks").select("*").order("sort").order("id");
  tasks = error ? [] : data;
}
async function loadRegions(){
  const { data, error } = await sb.from("regions").select("*").order("sort").order("name");
  regions = error ? [] : data;
}
// Verknüpfte Einträge (030), a < b; fehlt die Tabelle, leer
let links = [];
async function loadLinks(){
  const { data, error } = await sb.from("entry_links").select("*");
  links = error ? [] : data;
}
// Verknüpfungen eines Eintrags: [{other:{cat, entry}, note, confirmed}] (andere Seite ausgeblendet oder gelöscht: weggelassen)
const linksOfEntry = id => links.filter(l => l.a === id || l.b === id)
  .map(l => ({ other:findEntry(l.a === id ? l.b : l.a), note:l.note, confirmed:l.confirmed })).filter(l => l.other);
const linkKey = (x, y) => x < y ? { a:x, b:y } : { a:y, b:x };   // gleiche Ordnung wie uuid in Postgres (kleingeschrieben)
const linkProposals = () => links.filter(l => !l.confirmed && findEntry(l.a) && findEntry(l.b));
// Von Hand geprüft (030): Datum für die Anzeige
const checkedDate = iso => iso ? new Date(iso).toLocaleDateString("de-CH") : "";

/* Gemeldete Bilder (016) und Textfehler (018): Meldungen aus der Anzeige («Melden» bzw. «Fehler im Text melden» in der Grossansicht).
   Fehlt die Tabelle (Datenbank älter als 016), bleibt die Liste einfach leer. */
let reports = [];
async function loadReports(){
  const { data, error } = await sb.from("image_reports").select("*").order("last_at", { ascending:false });
  reports = error ? [] : data;
}
// Platz 1–4 = Bild, Platz 0 = Fehler im Text (018)
const slotReports = (e, p) => reports.filter(r => r.entry_id === e.id && r.position === p);
// Meldung ist veraltet, wenn am Platz inzwischen ein anderes Bild steht
const reportStale = (e, r) => (e.images.find(i => i.position === r.position)?.storage_path ?? null) !== r.storage_path;
async function clearReports(entry, pos){
  if(!reports.some(r => r.entry_id === entry.id && r.position === pos)) return;
  await must(sb.from("image_reports").delete().eq("entry_id", entry.id).eq("position", pos));
  reports = reports.filter(r => !(r.entry_id === entry.id && r.position === pos));
}
const reportText = r => `${r.times > 1 ? `${r.times}× gemeldet, zuletzt` : "Gemeldet"} am `
  + new Date(r.last_at).toLocaleString("de-CH", { day:"numeric", month:"numeric", year:"numeric", hour:"2-digit", minute:"2-digit" })
  + (r.reason ? ` · «${r.reason}»` : "");
const findCat = id => cats.find(c => c.id === id);
function findEntry(id){
  for(const c of cats){ const e = c.entries.find(x => x.id === id); if(e) return { cat:c, entry:e }; }
  return null;
}

// Reihenfolge ändern: Element um dir (−1/+1) verschieben, danach sort = Position
async function move(table, list, index, dir){
  const j = index + dir;
  if(j < 0 || j >= list.length) return;
  const order = list.slice();
  [order[index], order[j]] = [order[j], order[index]];
  await act(() => Promise.all(order.map((x, i) => x.sort === i ? null
    : must(sb.from(table).update({ sort:i }).eq("id", x.id)))));
  render();
}

// Bild verkleinern (längste Seite max. 1600 px) und als JPEG zurückgeben (PNG für die Zwischenablage)
function resizeImage(file, max = 1600, type = "image/jpeg"){
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const f = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * f); c.height = Math.round(img.height * f);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(b => b ? res(b) : rej(new Error("Bild konnte nicht umgewandelt werden")), type, .85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("Datei ist kein lesbares Bild")); };
    img.src = url;
  });
}

// Quelle prüfen: leer oder eine http(s)-Adresse (die Seite macht daraus einen Link)
function sourceUrl(s){
  if(s && !/^https?:\/\//i.test(s)) throw new Error("Die Quelle muss mit https:// beginnen.");
  return s || null;
}

// Aus einer Commons-Dateiseite den Dateinamen ableiten
function commonsFile(page){
  const m = String(page).match(/\/wiki\/(?:File|Datei):([^?#]+)/);
  return m ? decodeURIComponent(m[1]).replace(/_/g, " ") : "";
}

/* ------------------------------------------------------------------
   SEITENLEISTE
------------------------------------------------------------------- */
function route(){
  const [, type, id, extra, more] = location.hash.split("/");
  return { type, id, extra, more };
}

function renderSidebar(){
  const r = route();
  const activeCat = r.type === "k" ? r.id : r.type === "e" ? (r.id === "neu" ? r.extra : findEntry(r.id)?.cat.id)
    : r.type === "a" ? (r.id === "neu" ? r.extra : tasks.find(x => x.id === r.id)?.category_id) : null;
  const hidden = cats.filter(c => !c.visible).length;
  $("catCount").textContent = `(${cats.length}${hidden ? `, davon ${hidden} ausgeblendet` : ""})`;
  $("catList").innerHTML = cats.map((c, i) => {
    const n = catIssues(c).reports;
    return `
    <li class="${c.id === activeCat ? "active" : ""} ${c.visible ? "" : "off"}">
      <input type="checkbox" data-vis="${esc(c.id)}" ${c.visible ? "checked" : ""} title="Auf der Seite sichtbar">
      <a href="#/k/${esc(c.id)}">${esc(c.name)} <small>(${c.entries.length})</small>${catAllChecked(c) ? ` <span class="badge ok" title="Kategorie und alle Einträge von Hand geprüft">✓</span>` : ""}${n ? ` <span class="badge warn" title="Offene Meldungen">⚑ ${n}</span>` : ""}</a>
      <button class="icon" data-move="${i}" data-dir="-1" title="Nach oben" ${i ? "" : "disabled"}>↑</button>
      <button class="icon" data-move="${i}" data-dir="1" title="Nach unten" ${i < cats.length - 1 ? "" : "disabled"}>↓</button>
    </li>`;
  }).join("");
  // Hauptbereiche oben: aktiven markieren, Zahl der offenen Punkte bei «Zu erledigen»
  const nav = !r.type ? "home" : r.type === "erledigen" ? "todo" : r.type === "ideen" ? "ideas" : r.type === "werkzeuge" ? "tools"
    : r.type === "kantone" || r.type === "r" ? "regions" : "";
  document.querySelectorAll("[data-nav]").forEach(a => a.classList.toggle("active", a.dataset.nav === nav));
  const open = todoCount();
  $("todoCount").textContent = open;
  $("todoCount").hidden = !open;
  const prop = proposalCount();
  $("regionCount").textContent = prop;
  $("regionCount").hidden = !prop;
}
// Von Hand geprüft (030): Kategorie selbst und alle ihre Einträge
const catAllChecked = c => !!c.checked_at && c.entries.length > 0 && c.entries.every(e => e.checked_at);
// Hinweise pro Kategorie: offene Meldungen (Bild und Text), fehlende Bilder, Bilder ohne Quelle
function catIssues(c){
  const ids = new Set(c.entries.map(e => e.id));
  return {
    reports:reports.filter(r => ids.has(r.entry_id)).length,
    missing:c.entries.reduce((s, e) => s + openSlots(e).length, 0),
    noSource:c.entries.reduce((s, e) => s + e.images.filter(i => !i.source_page && !i.source_file).length, 0)
  };
}
const todoCount = () => reports.length + (cats.some(c => c.entries.some(e => openSlots(e).length)) ? 1 : 0) + (schemaMissing() ? 1 : 0)
  + (proposalCount() ? 1 : 0);
$("catList").addEventListener("click", e => {
  const b = e.target.closest("[data-move]");
  if(b) move("categories", cats, +b.dataset.move, +b.dataset.dir);
});
$("catList").addEventListener("change", e => {
  const box = e.target.closest("[data-vis]");
  if(box) setVisible("categories", box.dataset.vis, box.checked);
});

// Kategorie oder Eintrag auf der Seite ein- oder ausblenden
async function setVisible(table, id, visible){
  await act(() => must(sb.from(table).update({ visible }).eq("id", id)),
    visible ? "Eingeblendet." : "Ausgeblendet.");
  render();
}
$("newCat").addEventListener("click", () => { location.hash = "#/k/neu"; });


/* ------------------------------------------------------------------
   KATEGORIE BEARBEITEN
------------------------------------------------------------------- */
// Neue Kategorie (#/k/neu) bzw. Register «Einstellungen» einer Kategorie (host = Inhalt des Registers)
function renderCategory(cat, host = $("main")){
  const isNew = !cat;
  const c = cat || { id:"", name:"", description:"", goal:"", latin:false, visible:true, labels:DEFAULT_LABELS, cover_entry_id:null, entries:[] };
  const main = host;
  const n = c.entries.length;
  if(aiReport && aiReport.id !== c.id) aiReport = null;
  main.innerHTML = `
    ${isNew ? "<h2>Neue Kategorie</h2>" : ""}
    ${aiReport ? `<p class="ai-verdict ${aiReport.isErr ? "warn" : ""}">${esc(aiReport.text)}</p>` : ""}
    <form id="catForm">
      <div class="row">
        <label>Name <input type="text" name="name" required value="${esc(c.name)}"></label>
        <label>ID (für die Adresse #/…) <input type="text" name="id" required pattern="[a-z0-9]+(-[a-z0-9]+)*" value="${esc(c.id)}"></label>
      </div>
      ${isNew ? `<div class="ai">
        <h3>Einträge mit Claude erstellen</h3>
        ${regions.length ? `<label>Für einen Kanton (freiwillig: die Einträge kommen dann auch in seinen Bereich)
          <select name="region"><option value="">ganze Schweiz</option>${regions.map(g =>
            `<option value="${esc(g.id)}">${esc(regionTitle(g))}</option>`).join("")}</select></label>` : ""}
        <div class="ai-row">
          <label>Anzahl Einträge <input type="number" name="aiCount" min="1" value="16"></label>
          <button type="button" class="ghost" id="aiCopy">1. Auftrag für Claude kopieren</button>
          <a href="https://claude.ai/new" target="_blank" rel="noopener">2. claude.ai öffnen ↗</a>
        </div>
        <p class="hint">Den kopierten Auftrag in einem neuen Chat auf claude.ai einfügen und senden.
          Claude prüft die Kategorie und schreibt alle Einträge. Die Antwort komplett kopieren und hier einfügen:</p>
        <textarea name="aiAnswer" placeholder="3. Antwort von Claude hier einfügen"></textarea>
        <button type="button" class="ghost" id="aiRead">4. Antwort übernehmen</button>
        <div id="aiResult"></div>
      </div>` : ""}
      <label>Beschreibung (Untertitel der Kachel) <input type="text" name="description" value="${esc(c.description)}"></label>
      <label>Lernziel (steht oben in der Kategorie, ein Satz ohne Anzahl) <textarea name="goal" maxlength="300" rows="2">${esc(c.goal || "")}</textarea></label>
      <label class="inline"><input type="checkbox" name="visible" ${c.visible ? "checked" : ""}> Kategorie auf der Seite sichtbar</label>
      <label class="inline"><input type="checkbox" name="latin" ${c.latin ? "checked" : ""}> Untertitel der Einträge ist ein lateinischer Name (kursiv)</label>
      ${isNew ? "" : `<label class="inline checked-box"><input type="checkbox" name="checked" ${c.checked_at ? "checked" : ""}> Kategorie von Hand geprüft
        (Name, Beschreibung, Lernziel, Bildbeschriftungen)${c.checked_at ? ` <small class="hint">am ${checkedDate(c.checked_at)}</small>` : ""}</label>`}
      <h3>Bildbeschriftungen (Standard für alle Einträge)</h3>
      <div class="row">${c.labels.map((l, i) => `<label>Bild ${i + 1} <input type="text" name="label${i}" required value="${esc(l)}"></label>`).join("")}</div>
      ${isNew ? "" : `<label>Titelbild der Kachel (Hauptbild von …)
        <select name="cover"><option value="">– erster Eintrag –</option>
        ${c.entries.map(e => `<option value="${e.id}" ${e.id === c.cover_entry_id ? "selected" : ""}>${esc(e.name)}</option>`).join("")}
        </select></label>`}
      <div class="actions">
        <button>${isNew ? "Anlegen" : "Speichern"}</button>
        ${isNew ? `<button type="button" class="ghost" id="cancelNew">Abbrechen</button>`
          : `<button type="button" class="danger" id="delCat">Kategorie löschen</button>`}
      </div>
    </form>`;

  const form = $("catForm");
  const F = form.elements;
  // ID beim Anlegen aus dem Namen vorschlagen
  if(isNew) F.name.addEventListener("input", () => { F.id.value = slug(F.name.value); });
  if(isNew) setupAi(form);

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const row = {
      id:F.id.value.trim(), name:F.name.value.trim(), description:F.description.value.trim(), goal:F.goal.value.trim(),
      latin:F.latin.checked, visible:F.visible.checked, labels:[0,1,2,3].map(i => F["label" + i].value.trim())
    };
    const taken = row.id !== c.id && slugTaken(row.id);
    if(taken){ msg(taken, true); F.id.focus(); return; }
    const chosen = isNew ? aiChosen() : [];
    if(chosen.length){
      await createWithAi(form, row, chosen);
      return;
    }
    if(isNew){
      row.sort = cats.length;
      await act(() => must(sb.from("categories").insert(row)), "Kategorie angelegt.");
    }else{
      row.cover_entry_id = F.cover.value || null;
      // Von Hand geprüft (030): wie beim Eintrag, Textänderung bei angehaktem Kästchen = jetzt neu geprüft
      const textOf = x => JSON.stringify([x.name, x.description, x.goal || "", x.labels]);
      row.checked_at = !F.checked.checked ? null : c.checked_at && textOf(row) === textOf(c) ? c.checked_at : new Date().toISOString();
      await act(() => must(sb.from("categories").update(row).eq("id", c.id)), "Gespeichert.");
    }
    const back = "#/k/" + row.id + (isNew ? "" : "/einstellungen");
    if(location.hash !== back) location.hash = back; else render();
  });

  if(isNew){
    // Eingaben und Vorschlag verwerfen, gespeichert ist noch nichts
    $("cancelNew").addEventListener("click", () => {
      if((F.name.value.trim() || aiEntries.length) && !confirm("Eingaben und Vorschlag verwerfen? Es wird nichts gespeichert.")) return;
      location.hash = "#/";
    });
    return;
  }
  $("delCat").addEventListener("click", async () => {
    if(!confirm(`Kategorie «${c.name}» mit allen ${n} Einträgen und Bildern endgültig löschen?`)) return;
    await act(() => deleteCategory(c), "Kategorie gelöscht.");
    location.hash = "#/";
  });
}

/* ------------------------------------------------------------------
   KATEGORIE MIT REGISTERN (#/k/<id>[/<register>]): Prüfen (Tabelle mit Text und Bildern aller Einträge),
   Einträge (Reihenfolge, sichtbar, neu, QR-Codes), Aufträge (Forscheraufträge, 021) und Einstellungen
------------------------------------------------------------------- */
const CAT_TABS = [["pruefen", "Prüfen"], ["eintraege", "Einträge"], ["auftraege", "Aufträge"], ["einstellungen", "Einstellungen"]];
function renderCatPage(cat, tab){
  if(!CAT_TABS.some(([id]) => id === tab)) tab = "pruefen";
  const is = catIssues(cat), n = cat.entries.length;
  const imgs = cat.entries.reduce((s, e) => s + e.images.length, 0);
  const nTasks = tasks.filter(x => x.category_id === cat.id).length;
  $("main").innerHTML = `<h2>${esc(cat.name)}</h2>
    <p class="hint">${cat.visible ? "" : `<span class="badge">ausgeblendet</span> `}${n} Einträge · ${imgs} Bilder${
      is.missing ? ` · <span class="warn">${is.missing} Bilder fehlen</span>` : ""}${is.reports ? ` · <span class="warn">⚑ ${is.reports} offene Meldungen</span>` : ""}
      · <span id="chkCount">${cat.entries.filter(e => e.checked_at).length}/${n} geprüft</span>${cat.checked_at ? ` · Kategorie geprüft am ${checkedDate(cat.checked_at)}` : ""}
      · <a href="index.html#/${esc(cat.id)}" target="_blank" rel="noopener">auf der Seite ansehen ↗</a></p>
    <nav class="tabs">${CAT_TABS.map(([id, label]) => `<a href="#/k/${esc(cat.id)}${id === "pruefen" ? "" : "/" + id}"
      class="${id === tab ? "active" : ""}">${label}${id === "eintraege" ? ` <small>${n}</small>` : id === "auftraege" && nTasks ? ` <small>${nTasks}</small>` : ""}</a>`).join("")}</nav>
    <div id="tabBody"></div>`;
  const body = $("tabBody");
  if(tab === "einstellungen") return renderCategory(cat, body);
  if(tab === "eintraege") return renderEntriesTab(cat, body);
  if(tab === "auftraege") return renderTasksTab(cat, body);
  renderCheck(cat, body);
}

// Register «Einträge»: Liste mit sichtbar, Reihenfolge und Anzahl Bilder
function renderEntriesTab(cat, body){
  const n = cat.entries.length;
  body.innerHTML = `<ul class="list" id="entryList">
      ${cat.entries.map((e, i) => `
      <li class="${e.visible ? "" : "off"}">
        <input type="checkbox" data-vis="${e.id}" ${e.visible ? "checked" : ""} title="Auf der Seite sichtbar">
        <a href="#/e/${e.id}">${esc(e.name)} <small>${esc(e.subtitle)} · ${e.images.length}/4 Bilder</small></a>
        <button class="icon" data-move="${i}" data-dir="-1" title="Nach oben" ${i ? "" : "disabled"}>↑</button>
        <button class="icon" data-move="${i}" data-dir="1" title="Nach unten" ${i < n - 1 ? "" : "disabled"}>↓</button>
      </li>`).join("")}
    </ul>
    <p class="actions"><button class="ghost" id="newEntry">+ Neuer Eintrag</button>
      <button class="ghost" id="qrAll" title="QR-Codes mit Direktlink zu jedem sichtbaren Eintrag, 12 pro A4-Seite">QR-Codes drucken</button></p>`;
  $("entryList").addEventListener("click", ev => {
    const b = ev.target.closest("[data-move]");
    if(b) move("entries", cat.entries, +b.dataset.move, +b.dataset.dir);
  });
  $("entryList").addEventListener("change", ev => {
    const box = ev.target.closest("[data-vis]");
    if(box) setVisible("entries", box.dataset.vis, box.checked);
  });
  $("newEntry").addEventListener("click", () => { location.hash = "#/e/neu/" + cat.id; });
  $("qrAll").addEventListener("click", () => printQr(cat, cat.entries.filter(e => e.visible)));
}

/* Register «Prüfen»: eine Zeile pro Eintrag mit Name, Beschreibung und Steckbrief, daneben die 4 Bilder mit
   Werkzeugen (imgTools). Vorschläge von Commons öffnen sich als eigene Zeile direkt unter dem Eintrag. */
let checkFilter = "alle";   // «alle», «hinweise» (Meldungen, fehlende Bilder, ohne Quelle, ausgeblendet) oder «offen» (nicht von Hand geprüft)
const entryHasIssues = e => !e.visible || reports.some(r => r.entry_id === e.id) || openSlots(e).length > 0
  || e.images.some(i => !i.source_page && !i.source_file);
function renderCheck(cat, body){
  const withIssues = cat.entries.filter(entryHasIssues);
  const unchecked = cat.entries.filter(e => !e.checked_at);
  const rows = checkFilter === "hinweise" ? withIssues : checkFilter === "offen" ? unchecked : cat.entries;
  const todo = cat.entries.filter(e => openSlots(e).length).map(e => ({ cat, e }));
  const missing = todo.reduce((s, x) => s + openSlots(x.e).length, 0);
  body.innerHTML = `<div class="check-bar">
      <label class="inline"><input type="radio" name="checkFilter" value="alle" ${checkFilter === "alle" ? "checked" : ""}> alle Einträge (${cat.entries.length})</label>
      <label class="inline"><input type="radio" name="checkFilter" value="hinweise" ${checkFilter === "hinweise" ? "checked" : ""}> nur mit Hinweisen (${withIssues.length})</label>
      <label class="inline"><input type="radio" name="checkFilter" value="offen" ${checkFilter === "offen" ? "checked" : ""}> noch nicht geprüft (${unchecked.length})</label>
      ${missing && !bulk ? `<button type="button" class="ghost small" id="checkImport">Fehlende Bilder übernehmen (${missing})</button>` : ""}
    </div>
    <p class="hint legend">↻ Vorschläge von Commons · ⬆ eigenes Bild hochladen · ✂ zuschneiden · ◎ Ausschnitt der Vorschau ·
      ✕ entfernen · Klick aufs Bild: gross ansehen · Name: Eintrag bearbeiten</p>
    <p class="hint" id="importMsg" ${bulk ? "" : "hidden"}></p>
    <div class="check-wrap"><table class="check">
      <thead><tr><th>Eintrag und Text</th>${cat.labels.map((l, i) => `<th>${i + 1} · ${esc(l)}</th>`).join("")}</tr></thead>
      <tbody>${rows.map(e => checkRow(cat, e)).join("")
        || `<tr><td colspan="5" class="hint">${checkFilter === "offen" ? "Alle Einträge sind von Hand geprüft." : "Keine Einträge mit Hinweisen. Alles in Ordnung."}</td></tr>`}</tbody>
    </table></div>`;
  showBulk();
  body.querySelectorAll("[name=checkFilter]").forEach(r => r.addEventListener("change", () => { checkFilter = r.value; render(); }));
  // Häkchen «geprüft» direkt in der Tabelle: speichern ohne alles neu zu zeichnen (Bilder bleiben, Bildlauf bleibt)
  body.querySelectorAll("[data-chk]").forEach(box => box.addEventListener("change", async () => {
    const e = cat.entries.find(x => x.id === box.dataset.chk);
    const at = box.checked ? new Date().toISOString() : null;
    try{
      await must(sb.from("entries").update({ checked_at:at }).eq("id", e.id));
      e.checked_at = at;
      box.closest("label").title = at ? "Von Hand geprüft am " + checkedDate(at) : "Noch nicht von Hand geprüft";
      $("chkCount").textContent = `${cat.entries.filter(x => x.checked_at).length}/${cat.entries.length} geprüft`;
      renderSidebar();
      msg(at ? `«${e.name}» als geprüft markiert.` : `Häkchen bei «${e.name}» entfernt.`);
    }catch(err){ box.checked = !box.checked; msg("Fehler: " + err.message, true); }
  }));
  $("checkImport")?.addEventListener("click", ev => { ev.target.disabled = true; $("importMsg").hidden = false; importAll(todo); });
  body.querySelectorAll("tr[data-entry]").forEach(tr => {
    const e = cat.entries.find(x => x.id === tr.dataset.entry);
    const labels = e.labels || cat.labels;
    tr.querySelectorAll("td[data-pos]").forEach(td => {
      const p = +td.dataset.pos;
      const img = e.images.find(i => i.position === p);
      wireImgTools(td, cat, e, p, img, labels[p - 1], {
        upload:f => uploadImage(cat, e, p, f, img, "", ""),   // eigenes Foto, Quelle bei Bedarf im Eintrag nachtragen
        pickerBox:() => {
          tr.insertAdjacentHTML("afterend", `<tr class="pick-row"><td colspan="5"><div class="picker" id="picker"></div></td></tr>`);
          return $("picker");
        }
      });
    });
  });
}
function checkRow(cat, e){
  const labels = e.labels || cat.labels;
  const textRep = slotReports(e, 0);
  return `<tr data-entry="${esc(e.id)}" class="${e.visible ? "" : "off"}">
    <td class="check-text">
      <div class="check-name"><a href="#/e/${esc(e.id)}" title="Eintrag bearbeiten"><b>${esc(e.name)}</b></a>
        ${e.subtitle ? `<i>${esc(e.subtitle)}</i>` : ""}
        ${e.visible ? "" : `<span class="badge">ausgeblendet</span>`}
        <label class="chk" title="${e.checked_at ? "Von Hand geprüft am " + checkedDate(e.checked_at) : "Noch nicht von Hand geprüft"}"><input type="checkbox" data-chk="${esc(e.id)}" ${e.checked_at ? "checked" : ""}> geprüft</label>
        <a class="ext" href="${esc(entryUrl(cat, e))}" target="_blank" rel="noopener" title="Auf der Seite ansehen">↗</a></div>
      ${textRep.map(r => `<p class="report-note">⚑ Textfehler gemeldet (Nr. ${r.id}): ${esc(reportText(r))}</p>`).join("")}
      <p class="check-desc">${esc(e.description)}</p>
      ${(e.facts || []).length ? `<p class="check-facts">${e.facts.map(f => `<b>${esc(f.k)}:</b> ${esc(f.v)}`).join(" · ")}</p>` : ""}
      ${(e.confusions || []).length ? `<p class="check-facts">Nicht verwechseln mit: ${e.confusions.map(c => esc(c.name)).join(", ")}</p>` : ""}
    </td>
    ${[1, 2, 3, 4].map(p => `<td class="check-img" data-pos="${p}">${imgCell(e, p, labels[p - 1], labels[p - 1] !== cat.labels[p - 1])}</td>`).join("")}
  </tr>`;
}
// Bild in der Tabelle: Vorschau, Werkzeuge, Meldungen und Hinweise
function imgCell(e, p, label, ownLabel){
  const img = e.images.find(i => i.position === p);
  return `${ownLabel ? `<small class="hint">${esc(label)}</small>` : ""}
    <div class="thumb">${img ? `<img src="${esc(publicUrl(img.storage_path))}" alt="Bild ${p}" loading="lazy" title="Gross ansehen">`
      : `<span>${isEmptySlot(e, p) ? "bewusst leer" : "fehlt"}</span>`}</div>
    ${imgTools(e, p, img)}
    ${slotReports(e, p).map(r => `<p class="report-note">⚑ ${esc(reportText(r))}${reportStale(e, r) ? " (früheres Bild)" : ""}
      <button type="button" class="ghost small" data-reportdone>erledigt</button></p>`).join("")}
    ${img && !img.source_page ? `<p class="flag">${img.source_file ? esc(img.source_file) : "ohne Quelle"}</p>` : ""}
    ${img?.edited ? `<p class="flag plain">zugeschnitten</p>` : ""}`;
}
// Werkzeugleiste eines Bildplatzes (Tabelle und Eintrag): kleine Symbol-Knöpfe mit Erklärung beim Darüberfahren
function imgTools(e, p, img){
  const b = (attr, sym, title, cls = "") => `<button type="button" class="tool ${cls}" ${attr} title="${title}" aria-label="${title}">${sym}</button>`;
  return `<div class="tools">
    ${b("data-otherimg", "↻", img ? "Anderes Bild: Vorschläge von Wikimedia Commons" : "Vorschläge von Wikimedia Commons")}
    <label class="tool" tabindex="0" title="${img ? "Durch eigenes Bild ersetzen (hochladen)" : "Eigenes Bild hochladen"}">⬆<input type="file" accept="image/*" hidden></label>
    ${img ? b("data-crop", "✂", "Zuschneiden") + b("data-focus", "◎", "Ausschnitt der Vorschau (Karte, Übersicht)") + b("data-delimg", "✕", "Bild entfernen", "danger")
      : isEmptySlot(e, p) ? b("data-slotfill", "⟲", "Wieder füllen lassen: «Fehlende Bilder übernehmen» darf diesen Platz füllen")
      : b("data-slotempty", "∅", "Leer lassen: «Fehlende Bilder übernehmen» lässt diesen Platz aus")}
  </div>`;
}
// Werkzeuge verbinden; upload(file) speichert eine gewählte Datei, pickerBox() liefert den Platz für die Vorschläge
function wireImgTools(root, cat, e, p, img, label, { upload, pickerBox }){
  root.querySelector("[data-otherimg]")?.addEventListener("click", () => openPicker(cat, e, p, label, root, pickerBox));
  const file = root.querySelector(".tools input[type=file]");
  file.addEventListener("change", ev => { const f = ev.target.files[0]; if(f) upload(f); });
  root.querySelector("label.tool")?.addEventListener("keydown", ev => {
    if(ev.key === "Enter" || ev.key === " "){ ev.preventDefault(); file.click(); }
  });
  root.querySelector("[data-crop]")?.addEventListener("click", () => editCrop(cat, e, img));
  root.querySelector("[data-focus]")?.addEventListener("click", () => editFocus(e, img));
  root.querySelector("[data-delimg]")?.addEventListener("click", async () => {
    if(!confirm(`Bild ${p} von «${e.name}» entfernen?`)) return;
    await act(() => removeImage(e, img), "Bild entfernt.").catch(() => {});
    render();
  });
  root.querySelectorAll("[data-reportdone]").forEach(b => b.addEventListener("click", async () => {
    await act(() => clearReports(e, p), "Meldung erledigt.").catch(() => {});
    render();
  }));
  root.querySelector("[data-slotempty]")?.addEventListener("click", async () => {
    await act(() => setEmptySlot(e, p, true), `Bildplatz ${p} bleibt leer.`).catch(() => {});
    render();
  });
  root.querySelector("[data-slotfill]")?.addEventListener("click", async () => {
    await act(() => setEmptySlot(e, p, false), `Bildplatz ${p} darf wieder gefüllt werden.`).catch(() => {});
    render();
  });
  const thumb = root.querySelector(".thumb img");
  if(thumb){ applyFocus(thumb, img); thumb.addEventListener("click", () => showBig(e, img, label)); }
}
// Bild gross ansehen (Dialog #editor), mit Quelle
function showBig(e, img, label){
  editorDone?.();
  editorDone = null;
  editor.innerHTML = `<h2>${esc(e.name)} · Bild ${img.position} · ${esc(label)}</h2>
    <img class="big" src="${esc(publicUrl(img.storage_path))}" alt="">
    <p class="hint">${img.source_page ? `Quelle: <a href="${esc(img.source_page)}" target="_blank" rel="noopener">${esc(img.source_file || img.source_page)}</a>`
      : esc(img.source_file || "Ohne Quelle (gilt im Bildnachweis als eigenes Foto)")}${img.edited ? " · zugeschnitten" : ""}</p>
    <div class="actions"><button type="button" id="edCancel">Schliessen</button></div>`;
  $("edCancel").addEventListener("click", () => editor.close());
  editor.showModal();
  $("edCancel").focus();
}

/* Register «Aufträge» und Auftrag bearbeiten (#/a/<id>, #/a/neu/<kategorie>): Forscheraufträge (021).
   Die Anzeige zeigt sie einmal pro Tag in der Reihenfolge von sort über alle Kategorien. */
const TASK_ARTEN = { situation:"Alltagssituation", raetsel:"Rätsel", rechnen:"Rechenaufgabe", frage:"Forscherfrage" };
const TASK_FORMEN = { choice:"Auswahl", text:"Kurze Antwort", free:"Freie Antwort mit Musterlösung" };
function renderTasksTab(cat, body){
  const list = tasks.filter(x => x.category_id === cat.id);
  body.innerHTML = `<p class="hint">Forscheraufträge erscheinen einmal pro Tag beim Öffnen der Seite und unter «Forscheraufträge»
      im Menü. Die Antwort soll in einem Eintrag dieser Kategorie stehen.</p>
    ${list.length ? `<ul class="list tasks">${list.map(x => `<li class="${x.visible ? "" : "off"}">
        <input type="checkbox" data-tvis="${esc(x.id)}" ${x.visible ? "checked" : ""} title="Auf der Seite sichtbar">
        <a href="#/a/${esc(x.id)}"><small>${TASK_ARTEN[x.kind] || x.kind} · ${TASK_FORMEN[x.answer_type] || x.answer_type}</small><br>${esc(x.question)}</a>
      </li>`).join("")}</ul>` : `<p>Noch keine Forscheraufträge in dieser Kategorie.</p>`}
    <p class="actions"><button class="ghost" id="newTask">+ Neuer Auftrag</button></p>`;
  body.querySelectorAll("[data-tvis]").forEach(box => box.addEventListener("change", async () => {
    await act(() => must(sb.from("tasks").update({ visible:box.checked }).eq("id", box.dataset.tvis)),
      box.checked ? "Eingeblendet." : "Ausgeblendet.").catch(() => {});
    render();
  }));
  $("newTask").addEventListener("click", () => { location.hash = "#/a/neu/" + cat.id; });
}
function renderTask(cat, task){
  const isNew = !task;
  const x = task || { id:"", entry_id:null, kind:"situation", question:"", guess:false, answer_type:"text", choices:[],
    answer:"", hint:"", explanation:"", visible:true };
  const lines = x.answer_type === "choice" ? [x.answer, ...(x.choices || []).filter(c => c !== x.answer)] : [];
  const sel = (name, map, cur) => `<select name="${name}">${Object.entries(map).map(([k, v]) =>
    `<option value="${k}" ${k === cur ? "selected" : ""}>${v}</option>`).join("")}</select>`;
  $("main").innerHTML = `<p class="hint"><a href="#/k/${esc(cat.id)}/auftraege">← ${esc(cat.name)} · Aufträge</a></p>
    <h2>${isNew ? "Neuer Forscherauftrag" : "Forscherauftrag bearbeiten"}</h2>
    <form id="taskForm">
      <div class="row">
        <label>Art ${sel("kind", TASK_ARTEN, x.kind)}</label>
        <label>Antwortform ${sel("answer_type", TASK_FORMEN, x.answer_type)}</label>
        <label>Eintrag mit der Antwort <select name="entry_id"><option value="">– keiner –</option>
          ${cat.entries.map(e => `<option value="${e.id}" ${e.id === x.entry_id ? "selected" : ""}>${esc(e.name)}</option>`).join("")}</select></label>
      </div>
      <label>Frage <textarea name="question" rows="3" maxlength="600" required>${esc(x.question)}</textarea></label>
      <label class="inline"><input type="checkbox" name="guess" ${x.guess ? "checked" : ""}> Zuerst eine Vermutung notieren lassen</label>
      <div data-for="choice"><label>Antwortmöglichkeiten: eine pro Zeile, die richtige zuerst (angezeigt werden sie gemischt)
        <textarea name="choices" rows="4">${esc(lines.join("\n"))}</textarea></label></div>
      <div data-for="text"><label>Richtige Antwort: mehrere mit «|» trennen (z. B. «Wels|Waller»), nur Zahlen = Zahlenvergleich
        <input type="text" name="answer" maxlength="300" value="${esc(x.answer_type === "text" ? x.answer : "")}"></label></div>
      <label>Tipp nach einer falschen Antwort <textarea name="hint" rows="2" maxlength="400">${esc(x.hint)}</textarea></label>
      <label><span id="explLabel">Erklärung nach der Lösung</span> <textarea name="explanation" rows="4" maxlength="1000">${esc(x.explanation)}</textarea></label>
      ${isNew ? `<label>Kennung (Kleinbuchstaben und «-», bleibt fest, weil die Lernenden ihren Stand darunter speichern)
        <input type="text" name="id" required pattern="[a-z0-9\\-]{2,60}"></label>`
        : `<p class="hint">Kennung: <code>${esc(x.id)}</code></p>`}
      <label class="inline"><input type="checkbox" name="visible" ${x.visible ? "checked" : ""}> Auf der Seite sichtbar</label>
      <div class="actions sticky">
        <button>${isNew ? "Anlegen" : "Speichern"}</button>
        ${isNew ? `<button type="button" class="ghost" id="cancelTask">Abbrechen</button>`
          : `<button type="button" class="danger" id="delTask">Auftrag löschen</button>`}
      </div>
    </form>`;
  const form = $("taskForm"), F = form.elements;
  const showFor = () => {
    form.querySelectorAll("[data-for]").forEach(d => { d.hidden = d.dataset.for !== F.answer_type.value; });
    $("explLabel").textContent = F.answer_type.value === "free" ? "Musterlösung (wird nach der eigenen Antwort gezeigt)" : "Erklärung nach der Lösung";
  };
  F.answer_type.addEventListener("change", showFor);
  showFor();
  // Kennung beim Anlegen aus dem gewählten Eintrag vorschlagen
  if(isNew) F.entry_id.addEventListener("change", () => {
    const e = cat.entries.find(y => y.id === F.entry_id.value);
    if(e && !F.id.value) F.id.value = linkSlug(e.name);
  });
  form.addEventListener("submit", async ev => {
    ev.preventDefault();
    const type = F.answer_type.value;
    const choices = F.choices.value.split("\n").map(s => s.trim()).filter(Boolean);
    if(type === "choice" && choices.length < 2) return msg("Für eine Auswahl braucht es mindestens 2 Antwortmöglichkeiten.", true);
    if(type === "text" && !F.answer.value.trim()) return msg("Bitte die richtige Antwort eintragen.", true);
    if(type === "free" && !F.explanation.value.trim()) return msg("Bei einer freien Antwort bitte die Musterlösung eintragen.", true);
    const row = {
      category_id:cat.id, entry_id:F.entry_id.value || null, kind:F.kind.value, question:F.question.value.trim(),
      guess:F.guess.checked, answer_type:type, choices:type === "choice" ? choices : [],
      answer:type === "choice" ? choices[0] : type === "text" ? F.answer.value.trim() : "",
      hint:F.hint.value.trim(), explanation:F.explanation.value.trim(), visible:F.visible.checked
    };
    if(isNew){
      row.id = F.id.value.trim();
      if(tasks.some(y => y.id === row.id)) return msg("Diese Kennung gibt es schon. Bitte eine andere wählen.", true);
      row.sort = Math.max(0, ...tasks.map(y => y.sort || 0)) + 10;
      await act(() => must(sb.from("tasks").insert(row)), "Auftrag angelegt.").catch(() => null);
      if(tasks.some(y => y.id === row.id)) location.hash = "#/a/" + row.id;
      return;
    }
    await act(() => must(sb.from("tasks").update(row).eq("id", x.id)), "Gespeichert.").catch(() => {});
    render();
  });
  $("cancelTask")?.addEventListener("click", () => { location.hash = "#/k/" + cat.id + "/auftraege"; });
  $("delTask")?.addEventListener("click", async () => {
    if(!confirm("Diesen Forscherauftrag endgültig löschen?")) return;
    await act(() => must(sb.from("tasks").delete().eq("id", x.id)), "Auftrag gelöscht.").catch(() => {});
    location.hash = "#/k/" + cat.id + "/auftraege";
  });
}
/* ------------------------------------------------------------------
   NEUE KATEGORIE MIT CLAUDE (kopieren und einfügen über claude.ai, ohne API-Kosten)
   1. aiPrompt() erstellt den Auftrag mit Name, Anzahl und allen bestehenden Namen (gegen Doppelte).
   2. Claude antwortet auf claude.ai mit JSON: Prüfung, Kategorie-Angaben und alle Einträge.
   3. aiParse() liest die eingefügte Antwort, das Formular zeigt den Vorschlag zum Durchsehen.
   4. createWithAi(): Kategorie ausgeblendet speichern, Einträge speichern, Bilder von Wikimedia.
------------------------------------------------------------------- */
let aiEntries = [];   // Einträge aus der eingefügten Antwort
let aiReport = null;  // Ergebnis für die Kategorieseite: { id, text, isErr }

// Gemeinsame Teile aller Aufträge an Claude (neue Kategorie, neuer Eintrag)
const AI_INTRO = `Du arbeitest an «Natur und Schweiz», einer Lern- und Nachschlageseite für die Sekundarstufe I (12–15 Jahre).
Sie zeigt Kategorien (z. B. Bäume, Amphibien, Berge) mit Einträgen. Jeder Eintrag hat 4 Bilder, eine Beschreibung und einen Steckbrief.
Welche Kategorien es gibt, entscheidet die Lehrperson. Wo es zur Kategorie passt, stehen Vertreter aus der Schweiz im Vordergrund,
und es sollen die bekanntesten und für Schülerinnen und Schüler wichtigsten sein.`;
const AI_RULES = `Sprache: Deutsch mit Schweizer Rechtschreibung (nie Eszett, immer «ss»; Anführungszeichen «…»).
Texte sachlich, anschaulich und für Sek I verständlich. Die Fakten müssen stimmen: Lieber eine Angabe weglassen als raten.`;
const AI_ENTRY_TASK = `Beschreibung in 3–4 Sätzen, dazu «simple»: dieselbe Information in 2–3 kurzen, einfachen Sätzen für die Mittelstufe
(wenig Fachwörter, keine Angaben, die nicht auch in der Beschreibung stehen), Steckbrief mit 3–4 kurzen Zeilen,
genau 3 englische Suchbegriffe für Wikimedia Commons passend zu den Bildbeschriftungen 2, 3 und 4,
und wp = Titel des englischen Wikipedia-Artikels fürs Hauptbild (leer, wenn der lateinische Name genügt).`;
// Beispiel-Eintrag aus der Kategorie Bäume (Bildbeschriftungen Baum, Blätter, Früchte, Rinde)
const AI_EXAMPLE = `{
      "name": "Buche",
      "subtitle": "Fagus sylvatica",
      "description": "Die Rotbuche ist der häufigste Laubbaum der Schweiz und würde ohne menschlichen Einfluss grosse Teile des Mittellandes und des Juras bedecken. Typisch sind die glatte, silbergraue Rinde und die eiförmigen Blätter mit leicht gewelltem, bewimpertem Rand. Ihre dreikantigen Früchte heissen Bucheckern.",
      "simple": "Die Buche ist der häufigste Laubbaum der Schweiz. Ihre Rinde ist glatt und silbergrau. Ihre Früchte heissen Bucheckern.",
      "facts": [{"k": "Höhe", "v": "bis 40 m"}, {"k": "Alter", "v": "bis 300 Jahre"}, {"k": "Vorkommen", "v": "Mittelland, Jura, bis ca. 1500 m"}, {"k": "Merkmal", "v": "glatte, silbergraue Rinde"}],
      "search_terms": ["Fagus sylvatica leaves", "Fagus sylvatica beechnuts", "Fagus sylvatica bark"],
      "wp": ""
    }`;
const allEntryNames = () => cats.flatMap(c => c.entries.map(e => e.name)).join(", ");
// Auftrag für einen Kanton (022): Bezug zum Kanton und pro Eintrag ein Hinweis «kanton» für die Textseite
const aiRegionText = (g, lead) => !g ? "" : `
${lead} «${regionTitle(g)}»: Wähle bzw. beschreibe, was im ${regionTitle(g)} vorkommt oder für ihn wichtig ist.
Schreibe in «kanton» einen kurzen Satz (höchstens 200 Zeichen), was den Eintrag im ${regionTitle(g)} besonders macht
(Ort, Vorkommen, Geschichte). Nur sichere Angaben, sonst «kanton» leer lassen.`;
const aiExample = g => !g ? AI_EXAMPLE
  : AI_EXAMPLE.replace(`"wp": ""`, `"wp": "",\n      "kanton": "Kurzer Satz, was den Eintrag im Kanton besonders macht, z. B. wo er dort häufig ist."`);

function aiPrompt(name, count, region){
  return `${AI_INTRO}

Neue Kategorie: «${name}», mit ${count} Einträgen (die bekanntesten zuerst).${aiRegionText(region, "Die Kategorie ist für den Bereich")}

1. Prüfe, ob sich die Kategorie mit bestehenden Kategorien oder Einträgen überschneidet.
   Keine Einträge, die es schon gibt. (Ob die Kategorie zur Seite passt, entscheidet die Lehrperson; nicht prüfen.)
2. Schlage Name der Kategorie (Mehrzahl wie die bestehenden), einen kurzen Untertitel der Kachel und genau 4 kurze
   Bildbeschriftungen vor (Bild 1 zeigt das Ganze, z. B. Baum, Blätter, Früchte, Rinde).
   goal ist das Lernziel der Kategorie: ein Satz für Sek I, was man danach erkennen oder wissen soll, ohne Anzahl.
   latin = true bei Lebewesen: Der Untertitel jedes Eintrags ist dann der lateinische Name. Sonst nennt er Ort, Kanton oder Art.
3. Schreibe jeden Eintrag: ${AI_ENTRY_TASK}

${AI_RULES}

Bestehende Kategorien: ${cats.map(c => c.name).join(", ")}
Bestehende Einträge: ${allEntryNames()}

Antworte nur mit einem JSON-Codeblock in genau dieser Form (Beispiel-Eintrag aus der Kategorie Bäume):
\`\`\`json
{
  "passt": true,
  "pruefung": "1–3 Sätze: Überschneidungen? Hinweise",
  "name": "Bäume",
  "description": "Die wichtigsten Waldbäume",
  "goal": "Die wichtigsten Waldbäume der Schweiz an Wuchs, Blättern oder Nadeln, Früchten und Rinde erkennen und benennen.",
  "latin": true,
  "labels": ["Baum", "Blätter", "Früchte", "Rinde"],
  "entries": [
    ${aiExample(region)}
  ]
}
\`\`\``;
}

// Eingefügte Antwort lesen: das JSON zwischen der ersten «{» und der letzten «}»
function aiJson(text){
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if(a < 0 || b < a) throw new Error("In der Antwort steht kein JSON. Bitte die ganze Antwort von Claude einfügen.");
  try{ return JSON.parse(text.slice(a, b + 1)); }
  catch(e){ throw new Error("Die Antwort ist unvollständig oder beschädigt (" + e.message + "). Nochmals ganz kopieren."); }
}
const eszett = new RegExp(String.fromCharCode(223), "g");   // Schweizer Rechtschreibung: immer «ss»
const aiStr = (v, max = 2000) => String(v ?? "").replace(eszett, "ss").trim().slice(0, max);
// Einen Eintrag aus der Antwort bereinigen (Längen begrenzen, leere Zeilen weglassen)
function aiEntry(e){
  return {
    name:aiStr(e?.name, 100), subtitle:aiStr(e?.subtitle, 100), description:aiStr(e?.description),
    simple:aiStr(e?.simple, 400),
    facts:(Array.isArray(e?.facts) ? e.facts : []).map(f => ({ k:aiStr(f?.k, 60), v:aiStr(f?.v, 200) })).filter(f => f.k && f.v).slice(0, 6),
    search_terms:(Array.isArray(e?.search_terms) ? e.search_terms : []).map(t => aiStr(t, 120)).filter(Boolean).slice(0, 3),
    wp:aiStr(e?.wp, 200) || null,
    kanton:aiStr(e?.kanton, 200)   // Hinweis «Im Kanton …» (022), nur wenn der Auftrag einen Kanton nennt
  };
}

function aiParse(text){
  const r = aiJson(text);
  const entries = (Array.isArray(r.entries) ? r.entries : []).map(aiEntry).filter(e => e.name);
  if(!entries.length) throw new Error("Die Antwort enthält keine Einträge.");
  return {
    passt:r.passt !== false, pruefung:aiStr(r.pruefung), name:aiStr(r.name, 100), description:aiStr(r.description, 200), goal:aiStr(r.goal, 300),
    latin:!!r.latin, labels:[0,1,2,3].map(i => aiStr(r.labels?.[i], 40)), entries
  };
}

// Angewählte Einträge aus dem Vorschlag (Name und Untertitel lassen sich vorher korrigieren)
function aiChosen(){
  return [...document.querySelectorAll("#aiResult .ai-entry")]
    .filter(d => d.querySelector("input[type=checkbox]").checked)
    .map(d => ({ ...aiEntries[+d.dataset.i],
      name:d.querySelector("[data-n]").value.trim(), subtitle:d.querySelector("[data-s]").value.trim() }))
    .filter(e => e.name);
}

function setupAi(form){
  const F = form.elements;
  const out = $("aiResult");
  const submit = form.querySelector(".actions button:not([type=button])");
  const updateSubmit = () => {
    const n = aiChosen().length;
    submit.textContent = n ? `Anlegen mit ${n} ${n === 1 ? "Eintrag" : "Einträgen"}` : "Anlegen";
  };
  aiEntries = [];
  out.addEventListener("change", updateSubmit);

  $("aiCopy").addEventListener("click", async () => {
    const name = F.name.value.trim();
    if(!name){ F.name.focus(); msg("Zuerst den Namen der Kategorie eingeben.", true); return; }
    const count = Math.max(1, Math.round(+F.aiCount.value) || 16);
    try{
      await navigator.clipboard.writeText(aiPrompt(name, count, findRegion(F.region?.value)));
      msg("Auftrag kopiert. Jetzt auf claude.ai einfügen und senden.");
    }catch(e){
      // Ohne Zugriff auf die Zwischenablage: Auftrag ins Feld schreiben und markieren
      F.aiAnswer.value = aiPrompt(name, count, findRegion(F.region?.value));
      F.aiAnswer.select();
      msg("Kopieren nicht erlaubt: Auftrag steht im Feld und ist markiert (Strg+C).", true);
    }
  });

  $("aiRead").addEventListener("click", () => {
    let r;
    try{ r = aiParse(F.aiAnswer.value); }
    catch(err){ out.innerHTML = `<p class="ai-verdict warn">${esc(err.message)}</p>`; updateSubmit(); return; }
    aiEntries = r.entries;
    // Vorschlag ins Formular übernehmen
    if(r.name){ F.name.value = r.name; F.id.value = slug(r.name); }
    if(r.description) F.description.value = r.description;
    if(r.goal) F.goal.value = r.goal;
    F.latin.checked = r.latin;
    F.visible.checked = false;   // wird ausgeblendet angelegt, siehe createWithAi
    r.labels.forEach((l, i) => { if(l) F["label" + i].value = l; });
    out.innerHTML = `
      <p class="ai-verdict ${r.passt ? "" : "warn"}">${r.passt ? "✓" : "⚠"} ${esc(r.pruefung || "Keine Prüfung in der Antwort.")}</p>
      <p class="hint">Name, Untertitel und Bildbeschriftungen stehen im Formular. Einträge durchsehen, nach Bedarf abwählen oder korrigieren
        (Name, ${r.latin ? "lateinischer Name" : "Untertitel"}). Texte lassen sich nach dem Anlegen im Eintrag bearbeiten.</p>
      <div class="ai-list">${r.entries.map((e, i) => `<div class="ai-entry" data-i="${i}">
        <input type="checkbox" checked title="Eintrag anlegen">
        <input type="text" value="${esc(e.name)}" data-n aria-label="Name">
        <input type="text" value="${esc(e.subtitle)}" data-s aria-label="Untertitel">
        <p class="hint">${esc(e.description)}<br>${e.facts.map(f => `${esc(f.k)}: ${esc(f.v)}`).join(" · ")}${e.kanton ? `<br><b>Im Kanton:</b> ${esc(e.kanton)}` : ""}</p></div>`).join("")}</div>`;
    updateSubmit();
  });
}

async function createWithAi(form, row, chosen){
  if(!confirm(`Kategorie «${row.name}» mit ${chosen.length} Einträgen anlegen?\n\n`
    + `Danach werden die Bilder von Wikimedia übernommen. Das dauert einige Minuten; die Seite dabei offen lassen.`)) return;
  const setDisabled = on => [...form.elements].forEach(el => { el.disabled = on; });
  setDisabled(true);
  // Stand anzeigen, dazu ein Knopf zum Abbrechen (wirkt nach dem Eintrag, der gerade Bilder lädt)
  $("aiResult").innerHTML = `<p class="ai-verdict" id="aiStatus"></p>
    <button type="button" class="danger" id="aiAbort">Abbrechen und alles löschen</button>`;
  const status = t => { $("aiStatus").textContent = t; };
  let aborted = false;
  $("aiAbort").addEventListener("click", ev => {
    if(!confirm("Anlegen abbrechen? Die Kategorie wird mit allen Einträgen und Bildern wieder gelöscht.")) return;
    aborted = true;
    ev.target.disabled = true;
    status("Wird abgebrochen …");
  });
  status("Kategorie und Einträge werden gespeichert …");
  row.visible = false;   // erst nach dem Durchsehen einblenden
  row.sort = cats.length;
  try{
    await must(sb.from("categories").insert(row));
    const saved = await must(sb.from("entries").insert(chosen.map((e, i) => ({
      category_id:row.id, name:e.name, subtitle:e.subtitle, description:e.description, simple:e.simple || "", facts:e.facts,
      search_terms:e.search_terms, wp:e.wp, visible:true, sort:i
    }))).select("id,name"));
    // Für einen Kanton erstellt: alle Einträge dort zuordnen, mit dem Hinweis aus der Antwort (022)
    const region = findRegion(form.elements.region?.value);
    if(region) await must(sb.from("entry_regions").insert(saved.map(s => ({ entry_id:s.id, region_id:region.id,
      note:chosen.find(e => e.name === s.name)?.kanton || "", confirmed:true }))));
  }catch(err){
    // Kategorie gespeichert, Einträge nicht: auf die Kategorieseite wechseln, sonst im Formular bleiben
    await reload().catch(() => {});
    if(findCat(row.id)){
      aiReport = { id:row.id, isErr:true, text:"Die Einträge konnten nicht gespeichert werden: " + err.message };
      location.hash = "#/k/" + row.id;
    }else{ setDisabled(false); msg("Fehler: " + err.message, true); }
    return;
  }

  await reload().catch(() => {});
  const cat = findCat(row.id);
  const noImg = [];
  for(const [n, e] of (cat?.entries || []).entries()){
    if(aborted) break;
    status(`Bilder werden übernommen: ${e.name} (${n + 1} von ${cat.entries.length}) …`);
    const failed = await importMissing(cat, e).catch(() => [1, 2, 3, 4]);
    if(failed.length) noImg.push(`${e.name} (Bild ${failed.join(", ")})`);
  }
  await reload().catch(() => {});

  if(aborted){
    // Alles wieder entfernen, auch die schon übernommenen Bilder
    try{
      await deleteCategory(findCat(row.id));
      await reload().catch(() => {});
      location.hash = "#/";
      msg("Abgebrochen. Die Kategorie wurde wieder gelöscht.");
    }catch(err){
      aiReport = { id:row.id, isErr:true, text:"Abbrechen hat nicht ganz geklappt (" + err.message + "). Bitte unten «Kategorie löschen» wählen." };
      location.hash = "#/k/" + row.id;
    }
    return;
  }

  aiReport = { id:row.id, isErr:false,
    text:`${cat?.entries.length || 0} Einträge angelegt. Die Kategorie ist noch ausgeblendet: Texte und Bilder durchsehen, dann oben «Kategorie auf der Seite sichtbar» anwählen und speichern.`
      + (noImg.length ? ` Bilder nicht gefunden: ${noImg.join("; ")}. Dort Suchbegriffe anpassen und im Eintrag nochmals versuchen.` : "")
      + ` Nicht zufrieden: unten «Kategorie löschen» entfernt alles wieder.` };
  location.hash = "#/k/" + row.id;
}

/* ------------------------------------------------------------------
   NEUER EINTRAG MIT CLAUDE (über den Namen oder ein Foto, kopieren und einfügen über claude.ai)
   Die Antwort füllt das normale Formular: prüfen, ändern, dann «Anlegen» oder «Abbrechen».
   Beim Anlegen wird das Foto Bild 1 (eigenes Foto), die übrigen Bilder kommen von Wikimedia.
------------------------------------------------------------------- */
let aiPhoto = null;     // gewähltes Foto (File)
let aiFilled = false;   // Formular mit einer Antwort von Claude gefüllt

function aiEntryPrompt(cat, name, photo, region){
  const others = cat.entries.map(e => e.name).join(", ") || "noch keine";
  return `${AI_INTRO}

Kategorie «${cat.name}»${cat.description ? ` (${cat.description})` : ""}. Bildbeschriftungen: ${cat.labels.join(", ")}.
${cat.latin ? "Der Untertitel eines Eintrags ist der lateinische Name." : "Der Untertitel eines Eintrags nennt Ort, Kanton oder Art."}

${photo
  ? `Neuer Eintrag über ein Foto: Bestimme so genau wie möglich, was auf dem beigefügten Foto zu sehen ist${name ? ` (Vermutung: «${name}»)` : ""}.
Schreibe in «pruefung», wie sicher die Bestimmung ist, woran du sie erkennst und welche ähnlichen Arten in Frage kommen.`
  : `Neuer Eintrag: «${name}».`}${aiRegionText(region, "Der Eintrag gehört auch in den Bereich")}

1. Prüfe, ob der Eintrag in diese Kategorie passt und ob es ihn auf der Seite schon gibt.
2. Schreibe den Eintrag: ${AI_ENTRY_TASK}

${AI_RULES}

Einträge in dieser Kategorie: ${others}
Alle Einträge der Seite: ${allEntryNames()}

Antworte nur mit einem JSON-Codeblock in genau dieser Form (Beispiel aus der Kategorie Bäume):
\`\`\`json
{
  "passt": true,
  "pruefung": "1–3 Sätze: Passt der Eintrag? Gibt es ihn schon?${photo ? " Wie sicher ist die Bestimmung?" : ""}",
  "entry": ${aiExample(region)}
}
\`\`\``;
}

function aiParseEntry(text){
  const r = aiJson(text);
  const entry = aiEntry(r.entry ?? r);
  if(!entry.name) throw new Error("Die Antwort enthält keinen Eintrag.");
  return { passt:r.passt !== false, pruefung:aiStr(r.pruefung), entry };
}

function setupAiEntry(form, cat){
  const F = form.elements;
  const out = $("aiResult"), preview = $("aiPhotoPreview");
  aiPhoto = null;
  aiFilled = false;
  const isPhoto = () => F.aiMode.value === "foto";
  const showMode = () => {
    $("aiPhotoBox").hidden = !isPhoto();
    $("aiCopyPhoto").hidden = !isPhoto();
    $("aiHowto").textContent = isPhoto()
      ? "Foto wählen. «Auftrag kopieren», auf claude.ai in einem neuen Chat einfügen, dann «Foto kopieren» und im selben Chat einfügen "
        + "(oder das Foto in den Chat ziehen) und senden. Die Antwort ganz kopieren und hier einfügen."
      : "Oben den Namen eintragen. «Auftrag kopieren», auf claude.ai in einem neuen Chat einfügen und senden. Die Antwort ganz kopieren und hier einfügen.";
  };
  form.querySelectorAll("[name=aiMode]").forEach(r => r.addEventListener("change", showMode));
  showMode();

  F.aiPhotoFile.addEventListener("change", () => {
    if(preview.src) URL.revokeObjectURL(preview.src);
    aiPhoto = F.aiPhotoFile.files[0] || null;
    preview.hidden = !aiPhoto;
    if(aiPhoto) preview.src = URL.createObjectURL(aiPhoto);
  });

  $("aiCopy").addEventListener("click", async () => {
    const name = F.name.value.trim();
    if(isPhoto() && !aiPhoto){ msg("Zuerst ein Foto wählen.", true); return; }
    if(!isPhoto() && !name){ F.name.focus(); msg("Zuerst den Namen eintragen.", true); return; }
    const reg = findRegion(form.querySelector("[data-reg]:checked")?.dataset.reg);
    const text = aiEntryPrompt(cat, name, isPhoto(), reg);
    try{
      await navigator.clipboard.writeText(text);
      msg(isPhoto() ? "Auftrag kopiert. Auf claude.ai einfügen, dann «Foto kopieren»." : "Auftrag kopiert. Jetzt auf claude.ai einfügen und senden.");
    }catch(e){
      F.aiAnswer.value = text;
      F.aiAnswer.select();
      msg("Kopieren nicht erlaubt: Auftrag steht im Feld und ist markiert (Strg+C).", true);
    }
  });

  $("aiCopyPhoto").addEventListener("click", async () => {
    if(!aiPhoto){ msg("Zuerst ein Foto wählen.", true); return; }
    try{
      // Die Zwischenablage nimmt nur PNG; das Versprechen direkt übergeben, sonst verfällt die Erlaubnis
      await navigator.clipboard.write([new ClipboardItem({ "image/png":resizeImage(aiPhoto, 1600, "image/png") })]);
      msg("Foto kopiert. Im selben Chat auf claude.ai einfügen und senden.");
    }catch(e){
      msg("Foto kopieren geht in diesem Browser nicht: Das Foto bitte in den Chat ziehen.", true);
    }
  });

  $("aiRead").addEventListener("click", () => {
    let r;
    try{ r = aiParseEntry(F.aiAnswer.value); }
    catch(err){ out.innerHTML = `<p class="ai-verdict warn">${esc(err.message)}</p>`; return; }
    const e = r.entry;
    F.name.value = e.name;
    F.subtitle.value = e.subtitle;
    F.description.value = e.description;
    F.simple.value = e.simple || "";
    $("facts").innerHTML = e.facts.map(f => factRow(f.k, f.v)).join("");
    [0,1,2].forEach(i => { F["q" + i].value = e.search_terms[i] || ""; });
    F.wp.value = e.wp || "";
    // Hinweis für den angehakten Kanton (022), falls dort noch keiner steht
    const reg = form.querySelector("[data-reg]:checked");
    const note = reg && form.querySelector(`[data-regnote="${CSS.escape(reg.dataset.reg)}"]`);
    if(note && e.kanton && !note.value.trim()) note.value = e.kanton;
    aiFilled = true;
    out.innerHTML = `<p class="ai-verdict ${r.passt ? "" : "warn"}">${r.passt ? "✓" : "⚠"} ${esc(r.pruefung || "Keine Prüfung in der Antwort.")}</p>
      <p class="hint">Die Angaben stehen unten im Formular. Prüfen und nach Bedarf ändern, dann «Anlegen» (mit Bildern${aiPhoto ? ", das Foto wird Bild 1" : ""}) oder «Abbrechen».</p>`;
  });
}

async function createEntryWithAi(form, cat, row){
  const setDisabled = on => [...form.elements].forEach(el => { el.disabled = on; });
  const status = t => { $("aiResult").innerHTML = `<p class="ai-verdict">${esc(t)}</p>`; };
  setDisabled(true);
  status("Eintrag wird gespeichert …");
  let saved;
  try{ saved = await act(async () => {
    const s = await must(sb.from("entries").insert(row).select("id").single());
    await saveEntryRegions(s.id, form);
    return s;
  }, null); }
  catch(err){ setDisabled(false); return; }   // act zeigt den Fehler

  let failed = [], err = null;
  try{
    if(aiPhoto){
      status("Foto wird als Bild 1 gespeichert …");
      await storeImage(cat, findEntry(saved.id).entry, 1, await resizeImage(aiPhoto), null, null, null);
      await reload();
    }
    status("Bilder werden von Wikimedia übernommen …");
    failed = await importMissing(cat, findEntry(saved.id).entry);
  }catch(e){ err = e; }
  await reload().catch(() => {});
  aiPhoto = null;
  aiFilled = false;

  aiReport = { id:saved.id, isErr:!!err || failed.length > 0,
    text:"Eintrag angelegt."
      + (err ? ` Bilder: ${err.message}.` : "")
      + (failed.length ? ` Bild ${failed.join(", ")} nicht gefunden: Suchbegriff anpassen, speichern und «Fehlende Bilder von Wikimedia übernehmen».` : "")
      + " Nicht zufrieden: unten «Eintrag löschen» entfernt ihn wieder." };
  location.hash = "#/e/" + saved.id;
}

// Kategorie mit allen Einträgen (die Datenbank löscht sie mit) und den Bilddateien entfernen
async function deleteCategory(cat){
  const paths = cat.entries.flatMap(e => e.images.map(i => i.storage_path));
  await must(sb.from("categories").delete().eq("id", cat.id));
  if(paths.length) await must(sb.storage.from(CFG.bucket).remove(paths));
}

/* ------------------------------------------------------------------
   DIREKTLINKS UND QR-CODES
   Adresse eines Eintrags in der Anzeige: <Seite>#/<kategorie>/<name als Slug>, gleich gebildet wie
   slugify() in js/index.js. QR-Codes mit qrcode-generator (js/lib), gedruckt über #adminPrint.
------------------------------------------------------------------- */
const linkSlug = s => s.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue")
  .replace(new RegExp(String.fromCharCode(223), "g"), "ss").normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const siteUrl = () => new URL("./", location.href).href;
const entryUrl = (cat, e) => siteUrl() + "#/" + cat.id + "/" + linkSlug(e.name);
function qrSvg(text){
  const q = qrcode(0, "M");
  q.addData(text);
  q.make();
  return q.createSvgTag({ cellSize:4, margin:0, scalable:true });
}
// QR-Codes drucken (12 pro A4-Seite): für Schilder im Schulgarten oder auf einer Exkursion
function printQr(cat, entries){
  const box = $("adminPrint");
  box.innerHTML = `<div class="qr-sheet">${entries.map(e => {
    const url = entryUrl(cat, e);
    return `<div class="qr-card">${qrSvg(url)}<b>${esc(e.name)}</b><small>${esc(cat.name)} · Natur und Schweiz</small>
      <small class="qr-url">${esc(url)}</small></div>`;
  }).join("")}</div>`;
  window.addEventListener("afterprint", () => box.replaceChildren(), { once:true });
  window.print();
}

/* ------------------------------------------------------------------
   SICHERUNG: alle Kategorien, Einträge, Bildangaben und Forscheraufträge als JSON-Datei herunterladen.
   Die Bild- und Tondateien selbst liegen im Supabase-Speicher (und ihre Quellen auf Commons).
------------------------------------------------------------------- */
async function selectAll(table){
  const rows = [];
  for(let from = 0; ; from += 1000){   // Supabase liefert höchstens 1000 Zeilen pro Anfrage
    const part = await must(sb.from(table).select("*").range(from, from + 999));
    rows.push(...part);
    if(part.length < 1000) return rows;
  }
}
async function downloadBackup(){
  const [categories, entries, images] = await Promise.all(["categories", "entries", "images"].map(selectAll));
  const taskRows = await selectAll("tasks").catch(() => []);   // Forscheraufträge (021); fehlt die Tabelle, leer
  const regionRows = await selectAll("regions").catch(() => []);         // Kantone (022)
  const entryRegions = await selectAll("entry_regions").catch(() => []);
  const pathRows = await selectAll("paths").catch(() => []);              // Themenpfade (026)
  const linkRows = await selectAll("entry_links").catch(() => []);       // verknüpfte Einträge (030)
  const data = { erstellt:new Date().toISOString(), website:VERSION.app, datenbank:dbSchema, projekt:CFG.url, bucket:CFG.bucket,
    categories, entries, images, tasks:taskRows, regions:regionRows, entry_regions:entryRegions, paths:pathRows, entry_links:linkRows };
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type:"application/json" }));
  a.download = `natur-und-schweiz-sicherung-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return { categories:categories.length, entries:entries.length, images:images.length, tasks:taskRows.length, regions:regionRows.length };
}

/* ------------------------------------------------------------------
   TIERSTIMMEN: MP3 von Commons (commonsAudio in js/wikimedia.js) in den eigenen Speicher übernehmen.
   Pfad <kat>/<entry-id>-ton-<zeit>.mp3, Angaben in entries.sound_path / sound_page / sound_file.
------------------------------------------------------------------- */
const MAX_SOUND = 5 * 1024 * 1024;   // Grenze des Buckets
async function storeSound(cat, entry, info){
  const r = await retry(async () => {
    const r = await fetch(info.src);
    if(!r.ok) throw httpError(r);
    return r;
  }, 2);
  const blob = await r.blob();
  if(blob.size > MAX_SOUND) throw new Error(`Aufnahme zu gross (${(blob.size / 1048576).toFixed(1)} MB, höchstens 5 MB). Eine kürzere wählen.`);
  const path = `${cat.id}/${entry.id}-ton-${Date.now()}.mp3`;
  await must(sb.storage.from(CFG.bucket).upload(path, blob, { contentType:"audio/mpeg" }));
  await must(sb.from("entries").update({ sound_path:path, sound_page:sourceUrl(info.page), sound_file:info.file }).eq("id", entry.id));
  if(entry.sound_path) await sb.storage.from(CFG.bucket).remove([entry.sound_path]);
}
async function removeSound(entry){
  await must(sb.from("entries").update({ sound_path:null, sound_page:null, sound_file:null }).eq("id", entry.id));
  if(entry.sound_path) await must(sb.storage.from(CFG.bucket).remove([entry.sound_path]));
}

/* ------------------------------------------------------------------
   EINTRAG BEARBEITEN
------------------------------------------------------------------- */
function factRow(k = "", v = ""){
  return `<div class="fact">
    <input type="text" placeholder="z. B. Höhe" value="${esc(k)}" data-k>
    <input type="text" placeholder="z. B. bis 50 m" value="${esc(v)}" data-v>
    <button type="button" class="icon" data-delfact title="Zeile entfernen">✕</button></div>`;
}

// Zeile «Nicht verwechseln mit»: Name und Unterschied (gleicher Aufbau wie eine Steckbrief-Zeile)
function confRow(name = "", diff = ""){
  return `<div class="fact">
    <input type="text" placeholder="z. B. Weisstanne" value="${esc(name)}" data-k>
    <input type="text" placeholder="Woran man die beiden unterscheidet" value="${esc(diff)}" data-v>
    <button type="button" class="icon" data-delfact title="Zeile entfernen">✕</button></div>`;
}

function renderEntry(cat, entry){
  const isNew = !entry;
  const e = entry || { name:"", subtitle:"", description:"", visible:true, facts:[], search_terms:["","",""], wp:"", labels:null, images:[] };
  const labels = e.labels || cat.labels;
  const terms = [0,1,2].map(i => e.search_terms[i] || "");
  const main = $("main");
  if(aiReport && aiReport.id !== e.id) aiReport = null;
  main.innerHTML = `
    <p class="hint"><a href="#/k/${esc(cat.id)}">← ${esc(cat.name)}</a>${isNew ? ""
      : ` · <a href="${esc(entryUrl(cat, e))}" target="_blank" rel="noopener">auf der Seite ansehen ↗</a>`}</p>
    <h2>${isNew ? "Neuer Eintrag" : esc(e.name)}</h2>
    ${aiReport ? `<p class="ai-verdict ${aiReport.isErr ? "warn" : ""}">${esc(aiReport.text)}</p>` : ""}
    ${isNew ? "" : slotReports(e, 0).map(r => `<p class="report-note">⚑ Fehler im Text gemeldet (Nr. ${r.id}): ${esc(reportText(r))}
      <button type="button" class="ghost small" id="textReportDone">Meldung erledigt</button></p>`).join("")}
    <form id="entryForm">
      ${isNew ? `<div class="ai">
        <h3>Mit Claude ausfüllen</h3>
        <div class="ai-mode">
          <label class="inline"><input type="radio" name="aiMode" value="name" checked> über den Namen</label>
          <label class="inline"><input type="radio" name="aiMode" value="foto"> über ein Foto</label>
        </div>
        <div id="aiPhotoBox" hidden>
          <input type="file" accept="image/*" name="aiPhotoFile">
          <img id="aiPhotoPreview" class="ai-photo" alt="Gewähltes Foto" hidden>
          <p class="hint">Das Foto wird beim Anlegen Bild 1 (im Bildnachweis «eigenes Foto»).</p>
        </div>
        <p class="hint" id="aiHowto"></p>
        <div class="ai-row">
          <button type="button" class="ghost" id="aiCopy">Auftrag kopieren</button>
          <button type="button" class="ghost" id="aiCopyPhoto" hidden>Foto kopieren</button>
          <a href="https://claude.ai/new" target="_blank" rel="noopener">claude.ai öffnen ↗</a>
        </div>
        <textarea name="aiAnswer" placeholder="Antwort von Claude hier einfügen"></textarea>
        <button type="button" class="ghost" id="aiRead">Antwort übernehmen</button>
        <div id="aiResult"></div>
      </div>` : ""}
      <details class="sec" open><summary>Text und Steckbrief</summary>
      <div class="row">
        <label>Name <input type="text" name="name" required value="${esc(e.name)}"></label>
        <label>${cat.latin ? "Lateinischer Name" : "Untertitel (Ort, Gesteinsart …)"} <input type="text" name="subtitle" value="${esc(e.subtitle)}"></label>
        ${isNew ? "" : `<label>Kategorie (zum Verschieben ändern)
          <select name="category">${cats.map(c => `<option value="${esc(c.id)}" ${c.id === cat.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label>`}
      </div>
      <label class="inline"><input type="checkbox" name="visible" ${e.visible ? "checked" : ""}> Eintrag auf der Seite sichtbar</label>
      <label class="inline checked-box"><input type="checkbox" name="checked" ${e.checked_at ? "checked" : ""}> Von Hand geprüft (Text, Steckbrief und Bilder)${
        e.checked_at ? ` <small class="hint">am ${checkedDate(e.checked_at)}</small>` : ""}</label>
      <label>Beschreibung <textarea name="description">${esc(e.description)}</textarea></label>
      <p class="hint">3–4 Sätze, sachlich und für Sek I verständlich. Schweizer Rechtschreibung: immer «ss», nie Eszett.</p>
      <label>Einfache Fassung (für die Mittelstufe und «Einfach lesen»: 2–3 kurze Sätze, wenig Fachwörter)
        <textarea name="simple" maxlength="400" rows="3">${esc(e.simple || "")}</textarea></label>

      <h3>Steckbrief</h3>
      <div class="facts" id="facts">${e.facts.map(f => factRow(f.k, f.v)).join("")}</div>
      <button type="button" class="ghost" id="addFact">+ Zeile</button>
      </details>

      ${isNew ? "" : `<details class="sec" open><summary>Bilder</summary>
      <label class="inline"><input type="checkbox" name="ownLabels" ${e.labels ? "checked" : ""}> Eigene Bildbeschriftungen statt «${esc(cat.labels.join(", "))}»</label>
      <div class="row" id="labelRow" ${e.labels ? "" : "hidden"}>
        ${labels.map((l, i) => `<label>Bild ${i + 1} <input type="text" name="label${i}" value="${esc(l)}"></label>`).join("")}
      </div>
      <div class="slots">${[1,2,3,4].map(p => slotHtml(e, p, labels[p - 1])).join("")}</div>
      <div class="picker" id="picker" hidden></div>
      ${openSlots(e).length ? `<p><button type="button" class="ghost" id="importWm">Fehlende Bilder von Wikimedia übernehmen</button></p>
        <p class="hint">Sucht wie die Seite (Wikipedia-Titelbild, sonst die Suchbegriffe unter «Online-Ersatz») und speichert
          die Bilder mit Quellenangabe. Geänderte Suchbegriffe vorher speichern.</p>` : ""}
      </details>`}

      <details class="sec" ${(e.confusions || []).length ? "open" : ""}><summary>Verwechslungsgefahr${(e.confusions || []).length ? ` (${e.confusions.length})` : ""}</summary>
      <div class="facts" id="confusions">${(e.confusions || []).map(c => confRow(c.name, c.diff)).join("")}</div>
      <button type="button" class="ghost" id="addConf">+ Verwechslung</button>
      <p class="hint">Name des ähnlichen Eintrags (gibt es ihn, wird er verlinkt) und woran man die beiden unterscheidet.
        Gilt nur für diesen Eintrag; beim anderen bei Bedarf ebenfalls eintragen.</p>
      </details>

      ${entryRegionsHtml(e, isNew ? route().more : null)}
      ${isNew ? "" : entryLinksHtml(e)}

      ${isNew ? "" : `<details class="sec" ${e.sound_path ? "open" : ""}><summary>Tierstimme${e.sound_path ? " ✓" : ""}</summary>
      ${e.sound_path ? `<audio controls preload="none" src="${esc(publicUrl(e.sound_path))}"></audio>
        <p class="hint">Quelle: ${e.sound_page ? `<a href="${esc(e.sound_page)}" target="_blank" rel="noopener">${esc(e.sound_file || e.sound_page)}</a>` : "eigene Aufnahme"}</p>`
        : `<p class="hint">Keine Tierstimme hinterlegt.</p>`}
      <label>Commons-Audiodatei (…/wiki/File:…ogg oder …mp3) <input type="url" name="soundPage" value="${esc(e.sound_page)}"></label>
      <div class="slot-actions">
        <button type="button" class="ghost" id="soundFetch">Ton von dieser Quelle übernehmen</button>
        ${e.sound_path ? `<button type="button" class="danger" id="soundDel">Ton entfernen</button>` : ""}
      </div>
      </details>`}

      ${isNew ? `<details class="sec"><summary>Bilder</summary>
      <label class="inline"><input type="checkbox" name="ownLabels"> Eigene Bildbeschriftungen statt «${esc(cat.labels.join(", "))}»</label>
      <div class="row" id="labelRow" hidden>
        ${labels.map((l, i) => `<label>Bild ${i + 1} <input type="text" name="label${i}" value="${esc(l)}"></label>`).join("")}
      </div>
      <p class="hint">Mit Claude ausgefüllt: Die Bilder werden beim Anlegen übernommen. Sonst nach dem Anlegen hochladen.</p>
      </details>` : ""}

      <details class="sec" ${e.lat != null ? "open" : ""}><summary>Ort auf der Entdeckungskarte</summary>
      <p class="hint">Nur für Einträge mit festem Ort (Berg, See, Bauwerk, Ereignis). Koordinaten in Grad, z. B. «47.0410, 9.0670».
        Auf map.geo.admin.ch mit Rechtsklick (Handy: lange drücken) auf den Ort, dann die Zeile «WGS 84» kopieren. Leer = nicht auf der Karte.</p>
      <div class="row">
        <label>Koordinaten (Breite, Länge) <input type="text" name="geo" inputmode="decimal" placeholder="47.0410, 9.0670"
          value="${e.lat != null ? esc(e.lat + ", " + e.lon) : ""}"></label>
      </div>
      <p><a id="geoCheck" target="_blank" rel="noopener" href="#">Auf der Karte prüfen ↗</a></p>
      </details>

      <details class="sec"><summary>Online-Ersatz und Suchbegriffe</summary>
      <p class="hint">Gilt, solange ein Bildplatz kein eigenes Bild hat, und für «Fehlende Bilder übernehmen» und die Vorschläge (↻).</p>
      <label>Englischer Wikipedia-Artikel für das Hauptbild (leer = ${cat.latin ? "lateinischer Name" : "Name"})
        <input type="text" name="wp" value="${esc(e.wp)}"></label>
      <div class="row">${terms.map((t, i) => `<label>Suchbegriff Bild ${i + 2} <input type="text" name="q${i}" value="${esc(t)}"></label>`).join("")}</div>
      </details>

      ${isNew ? "" : `<details class="sec"><summary>Direktlink und QR-Code</summary>
      <div class="qr-box">${qrSvg(entryUrl(cat, e))}
        <p><a href="${esc(entryUrl(cat, e))}" target="_blank" rel="noopener">${esc(entryUrl(cat, e))}</a><br>
          <button type="button" class="ghost small" id="qrOne">QR-Code drucken</button>
          ${e.visible ? "" : `<br><span class="hint">Der Eintrag ist ausgeblendet: Der Link funktioniert erst, wenn er sichtbar ist.</span>`}</p>
      </div>
      </details>`}

      <div class="actions sticky">
        <button>${isNew ? "Anlegen" : "Speichern"}</button>
        ${isNew ? `<button type="button" class="ghost" id="cancelEntry">Abbrechen</button>`
          : `<button type="button" class="danger" id="delEntry">Eintrag löschen</button>`}
      </div>
    </form>`;

  const form = $("entryForm");
  const F = form.elements;
  const facts = $("facts");
  $("addFact").addEventListener("click", () => facts.insertAdjacentHTML("beforeend", factRow()));
  $("textReportDone")?.addEventListener("click", async () => {
    await act(() => clearReports(e, 0), "Meldung erledigt.").catch(() => {});
    render();
  });
  facts.addEventListener("click", ev => { if(ev.target.closest("[data-delfact]")) ev.target.closest(".fact").remove(); });
  F.ownLabels.addEventListener("change", () => { $("labelRow").hidden = !F.ownLabels.checked; });
  const confusions = $("confusions");
  $("addConf").addEventListener("click", () => confusions.insertAdjacentHTML("beforeend", confRow()));
  confusions.addEventListener("click", ev => { if(ev.target.closest("[data-delfact]")) ev.target.closest(".fact").remove(); });
  if(isNew) setupAiEntry(form, cat);
  $("qrOne")?.addEventListener("click", () => printQr(cat, [e]));
  // Tierstimme von Commons übernehmen bzw. entfernen
  $("soundFetch")?.addEventListener("click", async ev => {
    const name = commonsFile(F.soundPage.value.trim());
    if(!name){ F.soundPage.focus(); msg("Zuerst die Adresse der Commons-Audiodatei einfügen (…/wiki/File:…).", true); return; }
    ev.target.disabled = true;
    msg("Ton wird von Commons übernommen …");
    await act(async () => storeSound(cat, e, await commonsAudio(name)), "Tierstimme gespeichert.").catch(() => {});
    render();
  });
  $("soundDel")?.addEventListener("click", async () => {
    if(!confirm("Tierstimme entfernen?")) return;
    await act(() => removeSound(e), "Tierstimme entfernt.").catch(() => {});
    render();
  });

  if(!isNew) wireEntryLinks(form, e);

  // Ort auf der Entdeckungskarte (028): «Auf der Karte prüfen» zeigt die eingetragenen Koordinaten auf map.geo.admin.ch
  $("geoCheck").addEventListener("click", ev => {
    const g = parseGeo(F.geo.value);
    if(!g || g === "bad"){ ev.preventDefault(); msg(g ? GEO_HINT : "Zuerst Koordinaten eintragen.", true); return; }
    ev.currentTarget.href = "https://map.geo.admin.ch/?lang=de&swisssearch=" + g.join(",");
  });

  form.addEventListener("submit", async ev => {
    ev.preventDefault();
    const geo = parseGeo(F.geo.value);
    if(geo === "bad"){ F.geo.focus(); msg(GEO_HINT, true); return; }
    const row = {
      category_id:cat.id,
      name:F.name.value.trim(), subtitle:F.subtitle.value.trim(), description:F.description.value.trim(),
      simple:F.simple.value.trim(),
      lat:geo ? geo[0] : null, lon:geo ? geo[1] : null,
      visible:F.visible.checked,
      facts:[...facts.querySelectorAll(".fact")]
        .map(f => ({ k:f.querySelector("[data-k]").value.trim(), v:f.querySelector("[data-v]").value.trim() }))
        .filter(f => f.k || f.v),
      confusions:[...confusions.querySelectorAll(".fact")]
        .map(f => ({ name:f.querySelector("[data-k]").value.trim(), diff:f.querySelector("[data-v]").value.trim() }))
        .filter(c => c.name && c.diff),
      search_terms:[0,1,2].map(i => F["q" + i].value.trim()).filter(Boolean),
      wp:F.wp.value.trim() || null,
      labels:F.ownLabels.checked ? [0,1,2,3].map(i => F["label" + i].value.trim()) : null
    };
    // Von Hand geprüft (030): neu angehakt oder Text geändert = jetzt geprüft; unverändert = Datum bleibt; abgehakt = leer
    const textOf = x => JSON.stringify([x.name, x.subtitle, x.description, x.simple || "",
      (x.facts || []).map(f => [f.k, f.v]), (x.confusions || []).map(c => [c.name, c.diff])]);
    row.checked_at = !F.checked.checked ? null
      : !isNew && e.checked_at && textOf(row) === textOf(e) ? e.checked_at : new Date().toISOString();
    if(isNew){
      row.sort = cat.entries.length;
      if(aiFilled || aiPhoto){ await createEntryWithAi(form, cat, row); return; }
      const saved = await act(async () => {
        const s = await must(sb.from("entries").insert(row).select("id").single());
        await saveEntryRegions(s.id, form);
        return s;
      }, "Eintrag angelegt.");
      location.hash = "#/e/" + saved.id;
      return;
    }
    // In eine andere Kategorie verschieben: ans Ende der Zielkategorie, Bildbeschriftungen behalten
    const target = findCat(F.category.value);
    const moving = target && target.id !== cat.id;
    if(moving){
      if(!confirm(`Eintrag «${row.name}» mit allen Bildern nach «${target.name}» verschieben?`)) return;
      row.category_id = target.id;
      row.sort = target.entries.length;
      if(!row.labels && target.labels.join("|") !== cat.labels.join("|")) row.labels = cat.labels;
    }
    // Quellenangaben der vorhandenen Bilder mitspeichern
    await act(async () => {
      const imgRows = e.images.map(img => ({
        entry_id:e.id, position:img.position, storage_path:img.storage_path,
        source_page:sourceUrl(F["page" + img.position].value.trim()),
        source_file:F["file" + img.position].value.trim() || null
      }));
      await must(sb.from("entries").update(row).eq("id", e.id));
      if(imgRows.length) await must(sb.from("images").upsert(imgRows));
      await saveEntryRegions(e.id, form, e.entry_regions);
      await saveEntryLinks(e.id, form);
      // War er das Titelbild der alten Kategorie, nimmt diese wieder ihren ersten Eintrag
      if(moving && cat.cover_entry_id === e.id) await must(sb.from("categories").update({ cover_entry_id:null }).eq("id", cat.id));
    }, moving ? `Nach «${target.name}» verschoben.` : "Gespeichert.");
    render();
  });

  if(isNew){
    // Eingaben, Vorschlag und Foto verwerfen, gespeichert ist noch nichts
    $("cancelEntry").addEventListener("click", () => {
      if((F.name.value.trim() || aiPhoto || aiFilled) && !confirm("Eingaben und Vorschlag verwerfen? Es wird nichts gespeichert.")) return;
      location.hash = "#/k/" + cat.id;
    });
    return;
  }
  $("delEntry").addEventListener("click", async () => {
    if(!confirm(`Eintrag «${e.name}» mit allen Bildern endgültig löschen?`)) return;
    const paths = e.images.map(i => i.storage_path);
    await act(async () => {
      await must(sb.from("entries").delete().eq("id", e.id));
      if(paths.length) await must(sb.storage.from(CFG.bucket).remove(paths));
    }, "Eintrag gelöscht.");
    location.hash = "#/k/" + cat.id;
  });

  main.querySelectorAll(".slot").forEach(slot => {
    const p = +slot.dataset.pos;
    const img = e.images.find(i => i.position === p);
    const page = F["page" + p], file = F["file" + p];
    page.addEventListener("change", () => { if(!file.value) file.value = commonsFile(page.value); });
    // Unveränderte Angaben gehören zum alten Bild: nicht übernehmen (sonst verlinkt der Bildnachweis das falsche Bild)
    const keep = (input, old) => input.value.trim() === (old || "") ? "" : input.value.trim();
    wireImgTools(slot, cat, e, p, img, labels[p - 1], {
      upload:f => uploadImage(cat, e, p, f, img, keep(page, img?.source_page), keep(file, img?.source_file))
    });
    // Commons-Adresse aus «Quelle»: dieses Bild herunterladen, verkleinern und mit Quelle speichern
    slot.querySelector("[data-commons]").addEventListener("click", async ev => {
      const name = commonsFile(page.value.trim());
      if(!name){
        page.focus();
        msg("Zuerst die Adresse der Commons-Dateiseite in «Quelle» einfügen (…/wiki/File:…).", true);
        return;
      }
      if(img && !confirm(`Bild ${p} durch «${name}» ersetzen?`)) return;
      ev.target.disabled = true;
      msg("Bild wird von Commons übernommen …");
      await act(async () => storeWikimedia(cat, e, p, await commonsFileImage(name), img), "Bild übernommen.").catch(() => {});
      render();
    });
  });  // Aus «Gemeldete Bilder» der Übersicht: Auswahl für diesen Platz gleich öffnen
  if(pickFor?.entry === e.id){
    const p = pickFor.pos;
    pickFor = null;
    openPicker(cat, e, p, labels[p - 1]);
  }

  $("importWm")?.addEventListener("click", async ev => {
    ev.target.disabled = true;
    msg("Bilder werden von Wikimedia übernommen …");
    const failed = await act(() => importMissing(cat, e), null).catch(() => null);
    if(failed) msg(failed.length ? `Nicht gefunden: Bild ${failed.join(", ")}. Suchbegriff anpassen und nochmals versuchen.` : "Bilder übernommen.", failed.length > 0);
    render();
  });
}

function slotHtml(e, p, label){
  const img = e.images.find(i => i.position === p);
  return `<div class="slot" data-pos="${p}">
    <strong>${p} · ${esc(label)}${p === 1 ? " (Hauptbild)" : ""}</strong>
    ${slotReports(e, p).map(r => `<p class="report-note">⚑ ${esc(reportText(r))}${reportStale(e, r) ? " (betraf ein früheres Bild)" : ""}
      <button type="button" class="ghost small" data-reportdone>Meldung erledigt</button></p>`).join("")}
    <div class="thumb">${img ? `<img src="${esc(publicUrl(img.storage_path))}" alt="" loading="lazy" title="Gross ansehen">`
      : `<span>${isEmptySlot(e, p) ? "bewusst leer<br>(wird nicht automatisch gefüllt)" : "kein eigenes Bild"}</span>`}</div>
    ${imgTools(e, p, img)}
    ${img && !img.source_page ? `<p class="flag">${img.source_file ? esc(img.source_file) : "ohne Quelle"}</p>` : ""}
    ${img?.edited ? `<p class="flag plain">zugeschnitten (steht so im Bildnachweis)</p>` : ""}
    <details class="src"><summary>Quelle${img?.source_page ? " ✓" : ""}</summary>
      <label>Commons-Dateiseite <input type="url" name="page${p}" value="${esc(img?.source_page)}"></label>
      <label>Dateiname <input type="text" name="file${p}" value="${esc(img?.source_file)}"></label>
      <button type="button" class="ghost small" data-commons title="Commons-Adresse oben einfügen, dann klicken: Bild wird heruntergeladen und gespeichert">Bild von dieser Quelle übernehmen</button>
      <p class="hint">${img && !img.source_page && !img.source_file
        ? `Ohne Quelle gilt das Bild im Bildnachweis als eigenes Foto. Quelle nachtragen oder bei einem KI-Bild unter «Dateiname»
          z. B. «KI-generiert mit ChatGPT (OpenAI)» eintragen, dann «Speichern».`
        : "Geänderte Angaben mit «Speichern» sichern. Ein Bild von Commons: Adresse einfügen und übernehmen."}</p>
    </details>
  </div>`;
}
async function uploadImage(cat, entry, pos, file, old, page, fileName){
  msg("Bild wird hochgeladen …");
  await act(async () => {
    page = sourceUrl(page);
    await storeImage(cat, entry, pos, await resizeImage(file), old, page, fileName);
  }, "Bild gespeichert.");
  render();
}

// Bewusst leere Bildplätze (entries.empty_slots, 013): «Fehlende Bilder übernehmen» füllt sie nicht.
// Entfernen setzt einen Platz auf leer, ein neues Bild an diesem Platz hebt das wieder auf.
const isEmptySlot = (e, p) => (e.empty_slots || []).includes(p);
const openSlots = e => [1, 2, 3, 4].filter(p => !e.images.some(i => i.position === p) && !isEmptySlot(e, p));
async function setEmptySlot(entry, pos, on){
  const cur = entry.empty_slots || [];
  if(cur.includes(pos) === on) return;
  const next = on ? [...cur, pos].sort() : cur.filter(p => p !== pos);
  await must(sb.from("entries").update({ empty_slots:next }).eq("id", entry.id));
  entry.empty_slots = next;
}

// Bild entfernen: Zeile in «images» und Datei im Bucket; der Platz bleibt danach bewusst leer
async function removeImage(entry, img){
  await must(sb.from("images").delete().eq("entry_id", entry.id).eq("position", img.position));
  await must(sb.storage.from(CFG.bucket).remove([img.storage_path]));
  await setEmptySlot(entry, img.position, true);
  await clearReports(entry, img.position);
}

// Bild speichern: Datei in den Bucket, Zeile in «images», altes Bild löschen.
// Der Ausschnitt der Vorschau gehört zum alten Bild und wird zurückgesetzt.
// edited: zugeschnitten (Hinweis im Bildnachweis); ein neues Bild ist unverändert.
async function storeImage(cat, entry, pos, blob, old, page, fileName, edited = false){
  // Immer ein neuer Dateiname: so zeigt kein Zwischenspeicher (CDN, Browser) das alte Bild
  const path = `${cat.id}/${entry.id}-${pos}-${Date.now()}.jpg`;
  await must(sb.storage.from(CFG.bucket).upload(path, blob, { contentType:"image/jpeg" }));
  await must(sb.from("images").upsert({
    entry_id:entry.id, position:pos, storage_path:path, source_page:page || null, source_file:fileName || null,
    thumb_x:null, thumb_y:null, thumb_zoom:null, edited
  }));
  if(old && old.storage_path !== path) await sb.storage.from(CFG.bucket).remove([old.storage_path]);
  await setEmptySlot(entry, pos, false);
  await clearReports(entry, pos);   // neues Bild: Meldungen zu diesem Platz sind erledigt
}

/* ------------------------------------------------------------------
   BILD ZUSCHNEIDEN UND AUSSCHNITT DER VORSCHAU (Dialog #editor)
   Zuschneiden ändert die Datei (neuer Upload wie beim Ersetzen). Der Ausschnitt ändert nur,
   welcher Teil in den 4:3-Kacheln (Karte, Übersicht) zu sehen ist: thumb_x/thumb_y = Punkt im
   Bild in % (wie object-position), thumb_zoom = Vergrösserung 1–4. Die Lightbox zeigt immer alles.
------------------------------------------------------------------- */
const editor = $("editor");
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
let editorDone = null;   // Aufräumen beim Schliessen (Objekt-URL, Beobachter)
editor.addEventListener("close", () => {
  // Das Ereignis kommt verzögert: Ist schon der nächste Dialog offen, nichts tun
  if(editor.open) return;
  editorDone?.();
  editorDone = null;
});

// Ausschnitt als CSS-Variablen setzen (css/admin.css wertet sie gleich aus wie css/index.css)
function applyFocus(el, f){
  el.style.setProperty("--fx", (f.thumb_x ?? 50) + "%");
  el.style.setProperty("--fy", (f.thumb_y ?? 50) + "%");
  el.style.setProperty("--z", f.thumb_zoom ?? 1);
}

// Gespeichertes Bild als Blob laden, damit es sich auf eine Leinwand (canvas) zeichnen lässt
async function loadEditImage(img){
  const r = await fetch(publicUrl(img.storage_path));
  if(!r.ok) throw new Error("Bild konnte nicht geladen werden (HTTP " + r.status + ")");
  const blob = await r.blob();
  const pic = new Image();
  pic.draggable = false;
  await new Promise((res, rej) => {
    pic.onload = res;
    pic.onerror = () => { URL.revokeObjectURL(pic.src); rej(new Error("Datei ist kein lesbares Bild")); };
    pic.src = URL.createObjectURL(blob);
  });
  return pic;
}

async function openEditor(img, html, setup){
  let pic;
  try{ pic = await loadEditImage(img); }catch(err){ return msg("Fehler: " + err.message, true); }
  editorDone?.();
  editorDone = null;
  editor.innerHTML = html + `<div class="actions">
    <button type="button" id="edSave">Speichern</button>
    <button type="button" class="ghost" id="edReset"></button>
    <button type="button" class="ghost" id="edCancel">Abbrechen</button></div>`;
  $("edCancel").addEventListener("click", () => editor.close());
  editor.showModal();
  const done = setup(pic);
  editorDone = () => { done?.(); URL.revokeObjectURL(pic.src); };
}

// Ausschnitt der Vorschau: Bild im 4:3-Rahmen verschieben und vergrössern
function editFocus(entry, img){
  openEditor(img, `<h2>Ausschnitt der Vorschau · Bild ${img.position}</h2>
    <p class="hint">Bild mit der Maus oder dem Finger verschieben, mit dem Regler vergrössern.
      So erscheint es auf der Karte${img.position === 1 ? " und als Titelbild der Kategorie" : ""}. Vergrössert (Lightbox) ist immer das ganze Bild zu sehen.</p>
    <div class="focus-frame" id="fFrame"></div>
    <label>Vergrösserung <input type="range" id="fZoom" min="1" max="4" step="0.05"></label>`, pic => {
    const frame = $("fFrame"), zoom = $("fZoom");
    frame.append(pic);
    const f = { thumb_x:img.thumb_x ?? 50, thumb_y:img.thumb_y ?? 50, thumb_zoom:img.thumb_zoom ?? 1 };
    const show = () => { applyFocus(pic, f); zoom.value = f.thumb_zoom; };
    show();
    zoom.addEventListener("input", () => { f.thumb_zoom = +zoom.value; applyFocus(pic, f); });

    // Verschieben: Das Bild ragt um «slack» Pixel über den Rahmen; x = 0 % zeigt den linken Rand, 100 % den rechten
    let last = null;
    frame.addEventListener("pointerdown", ev => { last = ev; frame.setPointerCapture(ev.pointerId); ev.preventDefault(); });
    frame.addEventListener("pointermove", ev => {
      if(!last) return;
      const fw = frame.clientWidth, fh = frame.clientHeight;
      const s = Math.max(fw / pic.naturalWidth, fh / pic.naturalHeight) * f.thumb_zoom;
      const slackX = pic.naturalWidth * s - fw, slackY = pic.naturalHeight * s - fh;
      if(slackX > 0.5) f.thumb_x = clamp(f.thumb_x - 100 * (ev.clientX - last.clientX) / slackX, 0, 100);
      if(slackY > 0.5) f.thumb_y = clamp(f.thumb_y - 100 * (ev.clientY - last.clientY) / slackY, 0, 100);
      last = ev;
      show();
    });
    const stop = () => { last = null; };
    frame.addEventListener("pointerup", stop);
    frame.addEventListener("pointercancel", stop);

    $("edReset").textContent = "Mitte, nicht vergrössert";
    $("edReset").addEventListener("click", () => { Object.assign(f, { thumb_x:50, thumb_y:50, thumb_zoom:1 }); show(); });
    $("edSave").addEventListener("click", async () => {
      const r = v => Math.round(v * 10) / 10;
      const isDefault = r(f.thumb_x) === 50 && r(f.thumb_y) === 50 && r(f.thumb_zoom) === 1;
      const row = isDefault ? { thumb_x:null, thumb_y:null, thumb_zoom:null }
        : { thumb_x:r(f.thumb_x), thumb_y:r(f.thumb_y), thumb_zoom:r(f.thumb_zoom) };
      await act(() => must(sb.from("images").update(row).eq("entry_id", entry.id).eq("position", img.position)),
        "Ausschnitt gespeichert.").catch(() => {});
      editor.close();
      render();
    });
  });
}

// Zuschneiden: Rahmen aufziehen, verschieben oder an den Ecken ändern (Koordinaten in Bildpixeln)
function editCrop(cat, entry, img){
  const RATIOS = [["frei", 0], ["4:3 wie die Karten", 4 / 3], ["3:4 hoch", 3 / 4], ["1:1", 1], ["16:9", 16 / 9]];
  openEditor(img, `<h2>Bild ${img.position} zuschneiden</h2>
    <p class="hint">Rahmen neu aufziehen, verschieben oder an den Ecken ziehen. Das Bild wird dauerhaft zugeschnitten
      (die Quelle bleibt), der Ausschnitt der Vorschau wird zurückgesetzt.</p>
    <div class="crop-wrap" id="cWrap"><div class="crop-box" id="cBox">
      ${["nw", "ne", "sw", "se"].map(h => `<span data-h="${h}"></span>`).join("")}</div></div>
    <div class="crop-bar">
      <label>Seitenverhältnis <select id="cRatio">${RATIOS.map(([t, v]) => `<option value="${v}">${t}</option>`).join("")}</select></label>
      <span class="hint" id="cSize"></span>
    </div>`, pic => {
    const wrap = $("cWrap"), boxEl = $("cBox");
    wrap.prepend(pic);
    const W = pic.naturalWidth, H = pic.naturalHeight, MIN = 16;
    let ratio = 0;
    let box = { x:0, y:0, w:W, h:H };

    // Grösstes Rechteck mit dem gewählten Seitenverhältnis in b, zentriert
    const fit = b => {
      if(!ratio) return b;
      const w = Math.min(b.w, b.h * ratio), h = w / ratio;
      return { x:b.x + (b.w - w) / 2, y:b.y + (b.h - h) / 2, w, h };
    };
    const draw = () => {
      const s = pic.clientWidth / W;
      boxEl.style.left = box.x * s + "px";
      boxEl.style.top = box.y * s + "px";
      boxEl.style.width = box.w * s + "px";
      boxEl.style.height = box.h * s + "px";
      $("cSize").textContent = `${Math.round(box.w)} × ${Math.round(box.h)} px (ganzes Bild ${W} × ${H})`;
    };
    const resize = new ResizeObserver(draw);
    resize.observe(pic);

    // Rechteck von einem festen Punkt (a) zum Zeiger (p), innerhalb des Bildes
    const rectFrom = (a, p) => {
      const right = p.x >= a.x, down = p.y >= a.y;
      const maxW = right ? W - a.x : a.x, maxH = down ? H - a.y : a.y;
      let w = Math.min(Math.abs(p.x - a.x), maxW), h = Math.min(Math.abs(p.y - a.y), maxH);
      if(ratio){ w = Math.min(Math.max(w, h * ratio), maxW, maxH * ratio); h = w / ratio; }
      return { x:right ? a.x : a.x - w, y:down ? a.y : a.y - h, w, h };
    };
    const point = ev => {
      const r = pic.getBoundingClientRect(), s = pic.clientWidth / W;
      return { x:clamp((ev.clientX - r.left) / s, 0, W), y:clamp((ev.clientY - r.top) / s, 0, H) };
    };

    let drag = null;
    wrap.addEventListener("pointerdown", ev => {
      ev.preventDefault();
      wrap.setPointerCapture(ev.pointerId);
      const p = point(ev), h = ev.target.dataset.h;
      if(h) drag = { anchor:{ x:h[1] === "w" ? box.x + box.w : box.x, y:h[0] === "n" ? box.y + box.h : box.y } };
      else if(ev.target === boxEl) drag = { dx:p.x - box.x, dy:p.y - box.y };
      else drag = { anchor:p };
      drag.prev = box;
    });
    wrap.addEventListener("pointermove", ev => {
      if(!drag) return;
      const p = point(ev);
      box = drag.anchor ? rectFrom(drag.anchor, p)
        : { ...box, x:clamp(p.x - drag.dx, 0, W - box.w), y:clamp(p.y - drag.dy, 0, H - box.h) };
      draw();
    });
    const stop = () => {
      // Nur geklickt statt gezogen: alten Rahmen behalten
      if(drag && (box.w < MIN || box.h < MIN)){ box = drag.prev; draw(); }
      drag = null;
    };
    wrap.addEventListener("pointerup", stop);
    wrap.addEventListener("pointercancel", stop);

    $("cRatio").addEventListener("change", ev => { ratio = +ev.target.value; box = fit(box); draw(); });
    $("edReset").textContent = "Ganzes Bild";
    $("edReset").addEventListener("click", () => { box = fit({ x:0, y:0, w:W, h:H }); draw(); });
    $("edSave").addEventListener("click", async ev => {
      const x = Math.round(box.x), y = Math.round(box.y);
      const w = Math.min(Math.round(box.w), W - x), h = Math.min(Math.round(box.h), H - y);
      if(w === W && h === H){ editor.close(); return; }
      ev.target.disabled = true;
      msg("Bild wird zugeschnitten …");
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d").drawImage(pic, x, y, w, h, 0, 0, w, h);
      await act(async () => {
        const blob = await new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error("Bild konnte nicht umgewandelt werden")), "image/jpeg", .9));
        await storeImage(cat, entry, img.position, blob, img, img.source_page, img.source_file, true);
      }, "Bild zugeschnitten.").catch(() => {});
      editor.close();
      render();
    });
    return () => resize.disconnect();
  });
}

/* ------------------------------------------------------------------
   BILDER VON WIKIMEDIA ÜBERNEHMEN
   Sucht wie die Anzeige (js/wikimedia.js): Bild 1 = Titelbild des Wikipedia-Artikels,
   Bilder 2–4 = Commons-Suche mit den Suchbegriffen. Danach liegen die Bilder im eigenen
   Speicher: schnell, auch für ganze Klassen, und offline verfügbar.
------------------------------------------------------------------- */
const baseTitle = (cat, e) => e.wp || (cat.latin ? e.subtitle : e.name);
const rejected = new Map();   // pro Eintrag: mit «Anderes Bild suchen» verworfene Dateien

function usedFiles(e){
  const used = new Set(e.images.map(i => i.source_file).filter(Boolean));
  for(const f of rejected.get(e.id) || []) used.add(f);
  return used;
}

async function findWikimedia(cat, e, pos, used){
  const base = baseTitle(cat, e);
  if(pos === 1){
    const img = await wikiImage(base).catch(() => null);
    if(img && !used.has(img.file)){ used.add(img.file); return img; }
    return commonsImage(base, used);
  }
  return commonsImage(e.search_terms[pos - 2] || base, used, base);
}

async function importImage(cat, e, pos, used, old){
  await storeWikimedia(cat, e, pos, await findWikimedia(cat, e, pos, used), old);
}

// Gefundenes Wikimedia-Bild herunterladen, verkleinern und mit Quelle speichern
async function storeWikimedia(cat, e, pos, img, old){
  const r = await retry(async () => {
    const r = await fetch(img.src);
    if(!r.ok) throw httpError(r);
    return r;
  }, 2);
  await storeImage(cat, e, pos, await resizeImage(await r.blob()), old, sourceUrl(img.page), img.file);
}

// Leere Plätze eines Eintrags füllen. Gibt die Plätze zurück, für die nichts gefunden wurde.
async function importMissing(cat, e, onImage){
  const used = usedFiles(e);
  const failed = [];
  for(const p of [1, 2, 3, 4]){
    if(e.images.some(i => i.position === p) || isEmptySlot(e, p)) continue;
    try{ await importImage(cat, e, p, used); onImage?.(true); }
    catch(err){ failed.push(p); onImage?.(false); }
    await sleep(300);   // Wikimedia schonen
  }
  return failed;
}

/* «Anderes Bild suchen»: Vorschläge unter den 4 Bildern des Eintrags zeigen, der Admin wählt eines oder behält das alte.
   Die Vorschaubilder werden als Blob geladen (die CSP erlaubt Wikimedia nur für fetch, nicht für <img>);
   gewählt wird derselbe Blob gespeichert. «Weitere Vorschläge» sucht mit derselben Liste «used» weiter. */
const PICK_N = 6;
let pickFor = null;   // { entry, pos }: Auswahl nach dem Wechsel aus der Übersicht öffnen
let pickUrls = [];    // Blob-Adressen der Vorschläge (werden beim Schliessen freigegeben)
let pickToken = null; // gehört zur offenen Auswahl; eine noch laufende Suche einer geschlossenen hört damit auf

async function findCandidates(cat, e, pos, used, n){
  const base = baseTitle(cat, e);
  const out = [];
  if(pos === 1){
    const img = await wikiImage(base).catch(() => null);
    if(img && !used.has(img.file)){ used.add(img.file); out.push(img); }
  }
  const query = pos === 1 ? base : (e.search_terms[pos - 2] || base);
  while(out.length < n){
    try{ out.push(await commonsImage(query, used, base)); }catch(err){ break; }
  }
  return out;
}

function closePicker(){
  pickToken = null;
  const box = $("picker");
  // in der Prüf-Tabelle eigene Zeile unter dem Eintrag: ganz entfernen, im Eintrag nur leeren
  if(box?.closest(".pick-row")) box.closest(".pick-row").remove();
  else if(box){ box.hidden = true; box.replaceChildren(); }
  document.querySelectorAll(".picking").forEach(s => s.classList.remove("picking"));
  pickUrls.forEach(u => URL.revokeObjectURL(u));
  pickUrls = [];
}

// mark: markierter Bildplatz; pickerBox(): Platz für die Vorschläge (Tabelle), sonst #picker unter den 4 Bildern des Eintrags
function openPicker(cat, e, pos, label, mark, pickerBox){
  closePicker();
  const box = pickerBox ? pickerBox() : $("picker");
  const old = e.images.find(i => i.position === pos);
  const used = usedFiles(e);
  (mark || document.querySelector(`.slot[data-pos="${pos}"]`))?.classList.add("picking");
  box.hidden = false;
  box.innerHTML = `<h4>Bild ${pos} · ${esc(label)}: anderes Bild wählen</h4>
    <p class="hint">Bild ${pos} von «${esc(e.name)}» ist markiert. Klick auf einen Vorschlag ersetzt es${
      slotReports(e, pos).length ? " und erledigt die Meldung" : ""}.</p>
    <div class="pick-list"></div>
    <p class="hint" id="pickMsg"></p>
    <div class="slot-actions">
      <button type="button" class="ghost" id="pickMore">Weitere Vorschläge</button>
      <button type="button" class="ghost" id="pickCancel">Abbrechen (Bild behalten)</button>
    </div>`;
  const list = box.querySelector(".pick-list"), note = $("pickMsg"), more = $("pickMore");
  const token = pickToken = {};
  let busy = false;
  const load = async () => {
    if(busy) return;
    busy = true;
    more.disabled = true;
    note.textContent = "Vorschläge werden gesucht …";
    const found = await findCandidates(cat, e, pos, used, PICK_N).catch(() => []);
    for(const c of found){
      if(pickToken !== token) return;
      try{
        const r = await retry(async () => { const r = await fetch(c.src); if(!r.ok) throw httpError(r); return r; }, 2);
        const blob = await r.blob();
        if(pickToken !== token) return;
        const url = URL.createObjectURL(blob);
        pickUrls.push(url);
        const card = document.createElement("div");
        card.className = "pick";
        card.innerHTML = `<button type="button" title="Dieses Bild nehmen"><img src="${url}" alt=""></button>
          <a href="${/^https:\/\//.test(c.page) ? esc(c.page) : "#"}" target="_blank" rel="noopener" title="${esc(c.file)}">${esc(c.file)}</a>`;
        card.querySelector("button").addEventListener("click", async () => {
          list.querySelectorAll("button").forEach(b => { b.disabled = true; });
          note.textContent = "Bild wird gespeichert …";
          await act(async () => storeImage(cat, e, pos, await resizeImage(blob), old, sourceUrl(c.page), c.file),
            `Bild ${pos} ersetzt.`).catch(() => {});
          if(old?.source_file){   // verworfenes Bild nicht wieder vorschlagen
            if(!rejected.has(e.id)) rejected.set(e.id, new Set());
            rejected.get(e.id).add(old.source_file);
          }
          closePicker();
          render();
        });
        list.append(card);
      }catch(err){ /* Vorschau nicht ladbar: auslassen */ }
    }
    if(pickToken !== token) return;
    note.textContent = found.length ? "" : list.children.length ? "Keine weiteren Vorschläge gefunden." : "Keine Vorschläge gefunden. Suchbegriff unten anpassen und speichern, oder eine Commons-Adresse in «Quelle» einfügen.";
    more.disabled = !found.length;
    busy = false;
  };
  more.addEventListener("click", load);
  $("pickCancel").addEventListener("click", closePicker);
  if(pickerBox) box.scrollIntoView({ behavior:"smooth", block:"nearest" });
  else document.querySelector(".slots")?.scrollIntoView({ behavior:"smooth", block:"start" });
  load();
}

// Alle Einträge mit fehlenden Bildern nacheinander bearbeiten (Stand für die Übersicht)
let bulk = null, bulkResult = "";
function showBulk(){
  const el = $("importMsg");
  if(el && bulk) el.textContent = `Eintrag ${bulk.i} von ${bulk.n}: ${bulk.name} … bisher ${bulk.added} Bilder übernommen.`;
}
async function importAll(todo){
  bulk = { i:0, n:todo.length, added:0, fails:[] };
  for(const { cat, e } of todo){
    bulk.i++; bulk.name = e.name; showBulk();
    const failed = await importMissing(cat, e, ok => { if(ok){ bulk.added++; showBulk(); } });
    if(failed.length) bulk.fails.push(`${e.name} (Bild ${failed.join(", ")})`);
    await sleep(500);
  }
  bulkResult = `${bulk.added} Bilder übernommen.`
    + (bulk.fails.length ? ` Nicht gefunden: ${bulk.fails.join("; ")}. Dort Suchbegriffe anpassen und im Eintrag nochmals versuchen.` : "");
  bulk = null;
  try{ await reload(); }catch(err){}
  render();
  msg(bulkResult);
}

/* ------------------------------------------------------------------
   KANTONE (022): eigener Bereich pro Kanton auf der Seite (Adresse …/sff/<id>), mit Farben aus dem Wappen und
   Kantonszeichen. Einträge gehören über entry_regions zu einem oder mehreren Kantonen; confirmed = false ist ein
   Vorschlag (z. B. aus 022_kantone.sql), der hier bestätigt oder entfernt wird.
   #/kantone Liste, #/r/<id>[/eintraege|einstellungen|einstieg] ein Kanton, #/r/neu neuer Kanton
------------------------------------------------------------------- */
const findRegion = id => regions.find(g => g.id === id) || null;
const regionTitle = g => g.title || "Kanton " + g.name;
const emblemUrl = g => !g?.emblem ? null : g.emblem.startsWith("icons/") ? g.emblem : publicUrl(g.emblem);
const proposalCount = () => cats.reduce((s, c) => s + c.entries.reduce((n, e) => n + e.entry_regions.filter(r => !r.confirmed).length, 0), 0);
const regionLinks = id => cats.flatMap(c => c.entries.flatMap(e => e.entry_regions.filter(r => r.region_id === id).map(r => ({ cat:c, e, r }))));
const regionShort = g => siteUrl() + g.id;   // .htaccess leitet /sff/<id> auf /sff/#/<id> weiter
// Adressen der Anzeige: Kantone, Kategorien und Seiten teilen sich #/<id>, darum darf keine doppelt vorkommen
const PAGE_SLUGS = ["lernapp", "auftraege", "spiele", "jetzt", "quiz", "pdf", "hilfe", "einstellungen", "admin", "copyright", "schweiz", "zeitstrahl", "vergleich", "abzeichen", "pfade", "abstimmung"];
function slugTaken(id){
  if(PAGE_SLUGS.includes(id)) return "Diese Adresse braucht schon eine Seite.";
  if(findCat(id)) return "Es gibt schon eine Kategorie mit dieser ID.";
  if(findRegion(id)) return "Es gibt schon einen Kanton mit dieser ID.";
  return "";
}

// Liste aller Kantone: sichtbar, Reihenfolge, Zahl der Einträge und offenen Vorschläge
function renderRegions(){
  $("main").innerHTML = `<h2>Kantone</h2>
    <p class="hint">Jeder Kanton hat auf der Seite einen eigenen Bereich mit seinen Farben und Einträgen, erreichbar über den
      Knopf oben auf der Seite oder direkt über die Adresse <code>${esc(siteUrl())}&lt;id&gt;</code>. Ein Eintrag kann zu mehreren
      Kantonen gehören (z. B. der Steinbock). <b>Vorschläge</b> sind schon sichtbar; im Kanton bestätigen oder entfernen.</p>
    ${regions.length ? `<ul class="list region-list" id="regionList">${regions.map((g, i) => {
      const links = regionLinks(g.id), open = links.filter(l => !l.r.confirmed).length;
      return `<li class="${g.visible ? "" : "off"}">
        <input type="checkbox" data-rvis="${esc(g.id)}" ${g.visible ? "checked" : ""} title="Auf der Seite sichtbar">
        ${emblemUrl(g) ? `<img src="${esc(emblemUrl(g))}" alt="">` : `<span class="region-dot" data-c="${esc(g.color)}"></span>`}
        <a href="#/r/${esc(g.id)}">${esc(regionTitle(g))} <small>${links.length} Einträge</small>${open ? ` <span class="badge warn">${open} Vorschläge offen</span>` : ""}</a>
        <button class="icon" data-rmove="${i}" data-dir="-1" title="Nach oben" ${i ? "" : "disabled"}>↑</button>
        <button class="icon" data-rmove="${i}" data-dir="1" title="Nach unten" ${i < regions.length - 1 ? "" : "disabled"}>↓</button>
      </li>`;
    }).join("")}</ul>` : `<p>Noch kein Kanton angelegt.${schemaMissing() ? " Zuerst das Datenbank-Update ausführen (siehe Zu erledigen)." : ""}</p>`}
    <p><button class="ghost" id="newRegion" ${schemaMissing() ? "disabled" : ""}>+ Neuer Kanton</button></p>`;
  $("main").querySelectorAll(".region-dot").forEach(el => { el.style.background = el.dataset.c; });
  $("regionList")?.addEventListener("click", ev => {
    const b = ev.target.closest("[data-rmove]");
    if(b) move("regions", regions, +b.dataset.rmove, +b.dataset.dir);
  });
  $("regionList")?.addEventListener("change", async ev => {
    const box = ev.target.closest("[data-rvis]");
    if(!box) return;
    await act(() => must(sb.from("regions").update({ visible:box.checked }).eq("id", box.dataset.rvis)),
      box.checked ? "Eingeblendet." : "Ausgeblendet.").catch(() => {});
    render();
  });
  $("newRegion").addEventListener("click", () => { location.hash = "#/r/neu"; });
}

const REGION_TABS = [["eintraege", "Einträge"], ["einstellungen", "Name und Farben"], ["einstieg", "Einstieg und QR-Code"]];
function renderRegion(g, tab){
  if(!g){ $("main").innerHTML = `<p class="hint"><a href="#/kantone">← Kantone</a></p><h2>Neuer Kanton</h2><div id="tabBody"></div>`;
    return renderRegionForm(null, $("tabBody")); }
  if(!REGION_TABS.some(([id]) => id === tab)) tab = "eintraege";
  const links = regionLinks(g.id), open = links.filter(l => !l.r.confirmed).length;
  $("main").innerHTML = `<p class="hint"><a href="#/kantone">← Kantone</a></p>
    <h2 class="region-title">${emblemUrl(g) ? `<img src="${esc(emblemUrl(g))}" alt="">` : ""}${esc(regionTitle(g))}</h2>
    <p class="hint">${g.visible ? "" : `<span class="badge">ausgeblendet</span> `}${links.length} Einträge${open ? ` · <span class="warn">${open} Vorschläge offen</span>` : ""}
      · <a href="index.html#/${esc(g.id)}" target="_blank" rel="noopener">auf der Seite ansehen ↗</a></p>
    <nav class="tabs">${REGION_TABS.map(([id, label]) => `<a href="#/r/${esc(g.id)}${id === "eintraege" ? "" : "/" + id}"
      class="${id === tab ? "active" : ""}">${label}${id === "eintraege" ? ` <small>${links.length}</small>` : ""}</a>`).join("")}</nav>
    <div id="tabBody"></div>`;
  const body = $("tabBody");
  if(tab === "einstellungen") return renderRegionForm(g, body);
  if(tab === "einstieg") return renderRegionEntry(g, body);
  renderRegionEntries(g, body);
}

/* Register «Einträge»: alle Einträge nach Kategorie, angehakt = gehört zum Kanton, daneben der Hinweis für die Textseite.
   Änderungen sammeln sich, bis «Speichern»; «Bestätigen» macht aus einem Vorschlag eine feste Zuordnung. */
let regionFilter = "zugeordnet";   // «zugeordnet», «vorschlaege» oder «alle»
function renderRegionEntries(g, body){
  const map = new Map(regionLinks(g.id).map(l => [l.e.id, l.r]));
  const open = [...map.values()].filter(r => !r.confirmed).length;
  if(regionFilter === "vorschlaege" && !open) regionFilter = "zugeordnet";
  body.innerHTML = `<div class="filter">
      ${[["zugeordnet", `Zugeordnet (${map.size})`], ["vorschlaege", `Nur Vorschläge (${open})`], ["alle", "Alle Einträge zum Auswählen"]]
        .map(([v, l]) => `<label class="inline"><input type="radio" name="rfilter" value="${v}" ${regionFilter === v ? "checked" : ""}> ${l}</label>`).join("")}
    </div>
    <p class="hint">Angehakt = erscheint im Bereich «${esc(regionTitle(g))}». Der Hinweis (freiwillig) steht dort auf der Textseite unter
      «Im ${esc(regionTitle(g))}: …». <b>Vorschlag</b> = von Claude vorgeschlagen, auf der Seite schon sichtbar: bestätigen oder Haken entfernen.</p>
    <div class="ai-row reg-new"><label>Neuer Eintrag für den ${esc(regionTitle(g))} in der Kategorie
      <select id="regNewCat">${cats.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("")}</select></label>
      <button type="button" class="ghost" id="regNewEntry">+ Neuer Eintrag</button></div>
    ${cats.map(c => `<div class="reg-cat" data-cat="${esc(c.id)}"><h3>${esc(c.name)} <small class="hint" data-catcount></small></h3>
      <table class="reg-table">${c.entries.map(e => {
        const r = map.get(e.id);
        return `<tr data-entry="${e.id}" class="${r ? "on" : ""}${r && !r.confirmed ? " proposal" : ""}">
          <td><input type="checkbox" data-on ${r ? "checked" : ""} aria-label="${esc(e.name)} gehört zum Kanton"></td>
          <td><a href="#/e/${e.id}">${esc(e.name)}</a>${e.visible ? "" : ` <span class="badge">ausgeblendet</span>`}<br><small class="hint">${esc(e.subtitle)}</small></td>
          <td><input type="text" data-note maxlength="200" value="${esc(r?.note || "")}" placeholder="Hinweis «Im ${esc(regionTitle(g))}: …» (freiwillig)"></td>
          <td class="reg-state">${r && !r.confirmed ? `<span class="badge warn">Vorschlag</span> <button type="button" class="ghost small" data-confirm>Bestätigen</button>`
            : r ? `<span class="badge ok">✓</span>` : ""}</td></tr>`;
      }).join("")}</table></div>`).join("")}
    <div class="actions sticky">
      <button type="button" id="regSave">Änderungen speichern</button>
      ${open ? `<button type="button" class="ghost" id="regConfirmAll">Alle ${open} Vorschläge bestätigen und speichern</button>` : ""}
      <span class="hint" id="regDirty"></span>
    </div>`;
  const rows = [...body.querySelectorAll("tr[data-entry]")];
  const filterRows = () => {
    rows.forEach(tr => {
      const on = tr.querySelector("[data-on]").checked, was = map.get(tr.dataset.entry);
      tr.hidden = regionFilter === "zugeordnet" ? !(on || was) : regionFilter === "vorschlaege" ? !(was && !was.confirmed) : false;
    });
    body.querySelectorAll(".reg-cat").forEach(box => {
      const vis = box.querySelectorAll("tr[data-entry]:not([hidden])").length;
      box.hidden = !vis;
      box.querySelector("[data-catcount]").textContent = `${box.querySelectorAll("[data-on]:checked").length} von ${box.querySelectorAll("tr[data-entry]").length}`;
    });
  };
  // Was sich gegenüber der Datenbank geändert hat
  const changes = () => {
    const up = [], del = [];
    for(const tr of rows){
      const id = tr.dataset.entry, old = map.get(id);
      const on = tr.querySelector("[data-on]").checked, note = tr.querySelector("[data-note]").value.trim();
      const confirmed = old ? old.confirmed || tr.dataset.confirm === "1" : true;
      if(on && (!old || old.note !== note || old.confirmed !== confirmed)) up.push({ entry_id:id, region_id:g.id, note, confirmed });
      if(!on && old) del.push(id);
    }
    return { up, del };
  };
  const showDirty = () => {
    const { up, del } = changes();
    $("regDirty").textContent = up.length + del.length ? `${up.length + del.length} ungespeicherte Änderungen` : "";
  };
  const save = async () => {
    const { up, del } = changes();
    if(!up.length && !del.length){ msg("Keine Änderungen."); return; }
    await act(async () => {
      if(up.length) await must(sb.from("entry_regions").upsert(up));
      if(del.length) await must(sb.from("entry_regions").delete().eq("region_id", g.id).in("entry_id", del));
    }, `Gespeichert: ${up.length} zugeordnet oder geändert, ${del.length} entfernt.`).catch(() => {});
    render();
  };
  body.querySelector(".filter").addEventListener("change", ev => { regionFilter = ev.target.value; filterRows(); });
  body.addEventListener("input", showDirty);
  body.addEventListener("change", ev => {
    const tr = ev.target.closest("tr[data-entry]");
    if(tr && ev.target.matches("[data-on]")) tr.classList.toggle("on", ev.target.checked);
    showDirty();
  });
  body.addEventListener("click", ev => {
    const b = ev.target.closest("[data-confirm]");
    if(!b) return;
    const tr = b.closest("tr");
    tr.dataset.confirm = "1";
    tr.classList.remove("proposal");
    tr.querySelector("[data-on]").checked = true;
    tr.querySelector(".reg-state").innerHTML = `<span class="badge ok">✓ bestätigt</span>`;
    showDirty();
  });
  $("regSave").addEventListener("click", save);
  // Neuer Eintrag mit diesem Kanton vorgewählt (#/e/neu/<kategorie>/<kanton>), auch mit Claude
  $("regNewEntry").addEventListener("click", () => {
    if(changes().up.length + changes().del.length && !confirm("Ungespeicherte Änderungen verwerfen?")) return;
    location.hash = "#/e/neu/" + $("regNewCat").value + "/" + g.id;
  });
  $("regConfirmAll")?.addEventListener("click", () => {
    rows.forEach(tr => { const old = map.get(tr.dataset.entry); if(old && !old.confirmed && tr.querySelector("[data-on]").checked) tr.dataset.confirm = "1"; });
    save();
  });
  filterRows();
}

// Register «Name und Farben» (auch für einen neuen Kanton): Angaben, Farben aus dem Wappen, Kantonszeichen, Vorschau
function renderRegionForm(g, body){
  const isNew = !g;
  const v = g || { id:"", name:"", title:"", code:"", intro:"", color:"#d7261e", color2:"#1b1b1b", color3:"#f0b323", on_color:"#ffffff", emblem:null, visible:true };
  const colors = [["color", "Hauptfarbe (Grund des Wappens)"], ["color2", "Zweitfarbe"], ["color3", "Akzentfarbe"], ["on_color", "Schrift auf der Hauptfarbe"]];
  body.innerHTML = `<form id="regionForm">
      <div class="row">
        <label>Name <input type="text" name="name" required maxlength="60" value="${esc(v.name)}" placeholder="z. B. Glarus"></label>
        <label>ID = Adresse (…/sff/<b>id</b>) <input type="text" name="id" required pattern="[a-z0-9]+(-[a-z0-9]+)*" value="${esc(v.id)}"
          ${isNew ? "" : "readonly title=\"Fest, weil Geräte die Wahl darunter speichern und Links darauf zeigen\""}></label>
        <label>Kürzel <input type="text" name="code" maxlength="3" pattern="[A-Z]{0,3}" value="${esc(v.code)}" placeholder="GL"></label>
      </div>
      <label>Titel (für «Im …» und den Knopf) <input type="text" name="title" maxlength="80" value="${esc(v.title)}" placeholder="Kanton ${esc(v.name || "…")}"></label>
      <label>Einleitung auf der Startseite <textarea name="intro" maxlength="400" rows="2">${esc(v.intro)}</textarea></label>
      <h3>Farben aus dem Wappen</h3>
      <div class="row colors">${colors.map(([k, l]) => `<label>${l} <input type="color" name="${k}" value="${esc(v[k])}"></label>`).join("")}</div>
      <p class="hint">Schrift und Knöpfe in der Hauptfarbe passt die Seite automatisch an, damit sie hell und dunkel gut lesbar bleiben.</p>
      <div class="region-preview" id="regionPreview"></div>
      ${isNew ? `<p class="hint">Das Kantonszeichen lässt sich nach dem Anlegen hochladen. Ohne Zeichen zeigt die Seite das Kürzel in der Hauptfarbe.</p>` : `
      <h3>Kantonszeichen</h3>
      <div class="emblem-row">
        ${emblemUrl(v) ? `<img class="emblem" src="${esc(emblemUrl(v))}" alt="Kantonszeichen">` : `<span class="hint">Kein Zeichen: Die Seite zeigt das Kürzel.</span>`}
        <div>
          <label>Bild hochladen (PNG mit durchsichtigem Hintergrund, quadratisch) <input type="file" accept="image/png,image/jpeg,image/svg+xml" name="emblemFile"></label>
          ${v.emblem ? `<button type="button" class="ghost small" id="emblemDel">Zeichen entfernen</button>` : ""}
          <p class="hint">Eine eigene, vereinfachte Zeichnung nach Farben und Merkmalen des Wappens, kein offizielles Wappen
            (Kantonswappen sind geschützt). Wird auf 512 px verkleinert.</p>
        </div>
      </div>`}
      <label class="inline"><input type="checkbox" name="visible" ${v.visible ? "checked" : ""}> Auf der Seite sichtbar</label>
      <div class="actions">
        <button>${isNew ? "Anlegen" : "Speichern"}</button>
        ${isNew ? "" : `<button type="button" class="danger" id="delRegion">Kanton löschen</button>`}
      </div>
    </form>`;
  const form = $("regionForm"), F = form.elements;
  if(isNew) F.name.addEventListener("input", () => { F.id.value = slug(F.name.value); });
  const preview = () => {
    const box = $("regionPreview"), t = F.title.value.trim() || "Kanton " + (F.name.value.trim() || "…");
    box.innerHTML = `<div class="rp-band"></div><div class="rp-body"><span class="rp-chip">${emblemUrl(v) ? `<img src="${esc(emblemUrl(v))}" alt="">`
      : `<span class="rp-code">${esc(F.code.value || "?")}</span>`}${esc(t)} ▾</span>
      <span class="rp-button">Lernsession starten</span><small>Vorschau</small></div>`;
    box.style.setProperty("--r1", F.color.value);
    box.style.setProperty("--r2", F.color2.value);
    box.style.setProperty("--r3", F.color3.value);
    box.style.setProperty("--ron", F.on_color.value);
  };
  form.addEventListener("input", preview);
  preview();
  form.addEventListener("submit", async ev => {
    ev.preventDefault();
    const row = { name:F.name.value.trim(), title:F.title.value.trim(), code:F.code.value.trim().toUpperCase(), intro:F.intro.value.trim(),
      color:F.color.value, color2:F.color2.value, color3:F.color3.value, on_color:F.on_color.value, visible:F.visible.checked };
    if(isNew){
      row.id = F.id.value.trim();
      const taken = slugTaken(row.id);
      if(taken){ msg(taken, true); F.id.focus(); return; }
      row.sort = Math.max(0, ...regions.map(x => x.sort + 10));
      await act(() => must(sb.from("regions").insert(row)), "Kanton angelegt.").catch(() => {});
      if(findRegion(row.id)) location.hash = "#/r/" + row.id + "/einstellungen";
      return;
    }
    await act(() => must(sb.from("regions").update(row).eq("id", g.id)), "Gespeichert.").catch(() => {});
    render();
  });
  if(isNew) return;
  F.emblemFile.addEventListener("change", async () => {
    const file = F.emblemFile.files[0];
    if(!file) return;
    await act(async () => {
      const blob = await resizeImage(file, 512, "image/png");
      const path = `kantone/${g.id}-${Date.now()}.png`;
      await must(sb.storage.from(CFG.bucket).upload(path, blob, { contentType:"image/png" }));
      await must(sb.from("regions").update({ emblem:path }).eq("id", g.id));
      if(g.emblem && !g.emblem.startsWith("icons/")) await sb.storage.from(CFG.bucket).remove([g.emblem]);
    }, "Kantonszeichen gespeichert.").catch(() => {});
    render();
  });
  $("emblemDel")?.addEventListener("click", async () => {
    if(!confirm("Kantonszeichen entfernen? Die Seite zeigt dann das Kürzel.")) return;
    await act(async () => {
      await must(sb.from("regions").update({ emblem:null }).eq("id", g.id));
      if(!g.emblem.startsWith("icons/")) await sb.storage.from(CFG.bucket).remove([g.emblem]);
    }, "Zeichen entfernt.").catch(() => {});
    render();
  });
  $("delRegion").addEventListener("click", async () => {
    const n = regionLinks(g.id).length;
    if(!confirm(`Kanton «${regionTitle(g)}» löschen? Die Einträge selbst bleiben, nur ihre Zuordnung zu diesem Kanton (${n}) fällt weg.`)) return;
    await act(async () => {
      await must(sb.from("regions").delete().eq("id", g.id));
      if(g.emblem && !g.emblem.startsWith("icons/")) await sb.storage.from(CFG.bucket).remove([g.emblem]);
    }, "Kanton gelöscht.").catch(() => {});
    location.hash = "#/kantone";
  });
}

// Register «Einstieg und QR-Code»: kurze Adresse, QR-Code und Plakat zum Drucken
function renderRegionEntry(g, body){
  const url = regionShort(g);
  body.innerHTML = `<p>Direkter Einstieg in den Bereich «${esc(regionTitle(g))}»: Wer diese Adresse öffnet, hat den Kanton gewählt;
      die Wahl bleibt auf dem Gerät gespeichert, bis jemand oben auf der Seite etwas anderes wählt.</p>
    <div class="qr-box">${qrSvg(url)}
      <p><a href="${esc(url)}" target="_blank" rel="noopener"><b>${esc(url)}</b></a><br>
        <span class="hint">Gleichwertig: <code>${esc(siteUrl() + "#/" + g.id)}</code> (geht auch ohne die Weiterleitung in .htaccess).</span><br>
        <button type="button" class="ghost small" id="qrRegion">Plakat mit QR-Code drucken</button></p>
    </div>`;
  $("qrRegion").addEventListener("click", () => {
    const box = $("adminPrint");
    box.innerHTML = `<div class="qr-poster">${emblemUrl(g) ? `<img src="${esc(emblemUrl(g))}" alt="">` : ""}
      <h1>${esc(regionTitle(g))}</h1><p>Natur und Schweiz: Pflanzen, Tiere und Landschaften</p>
      ${qrSvg(url)}<b>${esc(url.replace(/^https?:\/\//, ""))}</b></div>`;
    window.addEventListener("afterprint", () => box.replaceChildren(), { once:true });
    window.print();
  });
}

// Abschnitt «Kantone» im Eintrag: angehakt = gehört zum Kanton, mit Hinweis; preset = Kanton für einen neuen Eintrag
function entryRegionsHtml(e, preset){
  if(!regions.length) return "";
  const links = e.entry_regions || [];
  const on = g => links.some(r => r.region_id === g.id) || g.id === preset;
  const n = regions.filter(on).length;
  return `<details class="sec" ${n ? "open" : ""}><summary>Kantone${n ? ` (${regions.filter(on).map(g => esc(g.code || g.name)).join(", ")})` : ""}</summary>
    <p class="hint">Angehakt = der Eintrag erscheint auch im Bereich dieses Kantons. Der Hinweis steht dort auf der Textseite (freiwillig).</p>
    ${regions.map(g => {
      const r = links.find(x => x.region_id === g.id);
      return `<div class="reg-row"><label class="inline"><input type="checkbox" data-reg="${esc(g.id)}" ${on(g) ? "checked" : ""}> ${esc(regionTitle(g))}</label>
        ${r && !r.confirmed ? `<span class="badge warn" title="Wird beim Speichern bestätigt">Vorschlag</span>` : ""}
        <input type="text" data-regnote="${esc(g.id)}" maxlength="200" value="${esc(r?.note || "")}" placeholder="Hinweis «Im ${esc(regionTitle(g))}: …»"></div>`;
    }).join("")}
  </details>`;
}
/* Verknüpfte Einträge (030) im Formular: eine Zeile pro Verknüpfung mit Hinweis; hinzufügen über ein Suchfeld mit Vorschlägen.
   Gespeichert wird mit dem Eintrag (saveEntryLinks); gespeichert = bestätigt, wie bei den Kantonen. */
function entryLinksHtml(e){
  const list = linksOfEntry(e.id);
  const open = list.filter(l => !l.confirmed).length;
  return `<details class="sec" ${list.length ? "open" : ""}><summary>Verknüpfte Einträge${list.length ? ` (${list.length}${open ? `, ${open} Vorschläge` : ""})` : ""}</summary>
    <p class="hint">Erscheinen auf der Textseite unter «Dazu entdecken», bei beiden Einträgen, z. B. ein Berg und die Tiere, die dort
      leben. Der Hinweis gilt für beide Seiten. Vorschläge werden beim Speichern bestätigt.</p>
    <div id="linkRows">${list.map(l => linkRow(l.other, l.note, l.confirmed)).join("")}</div>
    <div class="row link-add">
      <label>Eintrag hinzufügen <input type="text" id="linkPick" list="linkOptions" placeholder="Name eingeben, z. B. Gämse"></label>
      <button type="button" class="ghost small" id="linkAdd">Hinzufügen</button>
    </div>
    <datalist id="linkOptions">${cats.flatMap(c => c.entries.filter(x => x.id !== e.id)
      .map(x => `<option value="${esc(x.name + " · " + c.name)}">`)).join("")}</datalist>
  </details>`;
}
function linkRow(other, note, confirmed){
  return `<div class="link-row" data-link="${esc(other.entry.id)}">
    <span><a href="#/e/${esc(other.entry.id)}">${esc(other.entry.name)}</a> <small class="hint">${esc(other.cat.name)}</small>
      ${confirmed === false ? `<span class="badge warn" title="Wird beim Speichern bestätigt">Vorschlag</span>` : ""}</span>
    <input type="text" data-linknote maxlength="160" value="${esc(note || "")}" placeholder="Hinweis (freiwillig), z. B. «Im Wildschutzgebiet Freiberg Kärpf»">
    <button type="button" class="icon" data-linkdel title="Verknüpfung entfernen" aria-label="Verknüpfung entfernen">✕</button>
  </div>`;
}
function wireEntryLinks(form, e){
  const rows = $("linkRows"), pick = $("linkPick");
  if(!rows) return;
  rows.addEventListener("click", ev => { ev.target.closest("[data-linkdel]")?.closest(".link-row").remove(); });
  const add = () => {
    const v = pick.value.trim();
    const hit = cats.flatMap(c => c.entries.map(x => ({ cat:c, entry:x }))).find(x => x.entry.name + " · " + x.cat.name === v)
      || cats.flatMap(c => c.entries.map(x => ({ cat:c, entry:x }))).find(x => x.entry.name.toLowerCase() === v.toLowerCase());
    if(!hit){ msg("Eintrag nicht gefunden: bitte einen Vorschlag aus der Liste wählen.", true); return; }
    if(hit.entry.id === e.id){ msg("Ein Eintrag kann nicht mit sich selbst verknüpft werden.", true); return; }
    if(rows.querySelector(`[data-link="${CSS.escape(hit.entry.id)}"]`)){ msg("Diese Verknüpfung gibt es schon.", true); return; }
    rows.insertAdjacentHTML("beforeend", linkRow(hit, "", true));
    pick.value = "";
    rows.lastElementChild.querySelector("[data-linknote]").focus();
  };
  $("linkAdd").addEventListener("click", add);
  pick.addEventListener("keydown", ev => { if(ev.key === "Enter"){ ev.preventDefault(); add(); } });
}
async function saveEntryLinks(entryId, form){
  if(!$("linkRows")) return;
  const want = new Map([...form.querySelectorAll(".link-row")].map(r => [r.dataset.link, r.querySelector("[data-linknote]").value.trim()]));
  const old = links.filter(l => l.a === entryId || l.b === entryId);
  const up = [...want].filter(([id, note]) => {
    const k = linkKey(entryId, id), o = old.find(l => l.a === k.a && l.b === k.b);
    return !o || o.note !== note || !o.confirmed;
  }).map(([id, note]) => ({ ...linkKey(entryId, id), note, confirmed:true }));
  if(up.length) await must(sb.from("entry_links").upsert(up));
  for(const l of old.filter(l => !want.has(l.a === entryId ? l.b : l.a))){
    await must(sb.from("entry_links").delete().eq("a", l.a).eq("b", l.b));
  }
}

// Kantone eines Eintrags speichern (Eintrag gespeichert = vom Menschen geprüft, darum confirmed)
async function saveEntryRegions(entryId, form, links = []){
  const up = [], del = [];
  form.querySelectorAll("[data-reg]").forEach(box => {
    const id = box.dataset.reg, old = links.find(r => r.region_id === id);
    const note = form.querySelector(`[data-regnote="${CSS.escape(id)}"]`).value.trim();
    if(box.checked && (!old || old.note !== note || !old.confirmed)) up.push({ entry_id:entryId, region_id:id, note, confirmed:true });
    if(!box.checked && old) del.push(id);
  });
  if(up.length) await must(sb.from("entry_regions").upsert(up));
  if(del.length) await must(sb.from("entry_regions").delete().eq("entry_id", entryId).in("region_id", del));
}

/* ------------------------------------------------------------------
   ANSICHT WÄHLEN
------------------------------------------------------------------- */
function render(){
  closePicker();   // offene Bildauswahl verwerfen (Blob-Adressen freigeben)
  renderSidebar();
  const r = route();
  if(r.type === "k" && r.id === "neu") return renderCategory(null);
  if(r.type === "k" && findCat(r.id)) return renderCatPage(findCat(r.id), r.extra || "pruefen");
  if(r.type === "e" && r.id === "neu" && findCat(r.extra)) return renderEntry(findCat(r.extra), null);
  if(r.type === "e" && findEntry(r.id)){ const { cat, entry } = findEntry(r.id); return renderEntry(cat, entry); }
  if(r.type === "a" && r.id === "neu" && findCat(r.extra)) return renderTask(findCat(r.extra), null);
  const task = r.type === "a" && tasks.find(x => x.id === r.id);
  if(task && findCat(task.category_id)) return renderTask(findCat(task.category_id), task);
  if(r.type === "werkzeuge") return renderTools();
  if(r.type === "erledigen") return renderTodo();
  if(r.type === "ideen") return renderIdeas();
  if(r.type === "kantone") return renderRegions();
  if(r.type === "r" && r.id === "neu") return renderRegion(null, "einstellungen");
  if(r.type === "r" && findRegion(r.id)) return renderRegion(findRegion(r.id), r.extra || "eintraege");
  renderDashboard();
}

/* «Übersicht» (#/, Startseite der Verwaltung, oben in der Navigation und über den Titel von überall erreichbar):
   die wichtigsten Kennzahlen der ganzen Seite und pro Kategorie */
function renderDashboard(){
  const all = cats.flatMap(c => c.entries.map(e => ({ c, e })));
  const imgs = all.flatMap(({ e }) => e.images);
  const shown = all.filter(({ c, e }) => c.visible && e.visible).length;
  const hiddenCats = cats.filter(c => !c.visible).length;
  const missing = all.reduce((s, { e }) => s + openSlots(e).length, 0);
  const empty = all.reduce((s, { e }) => s + (e.empty_slots || []).length, 0);
  const noSource = i => !i.source_page && !i.source_file;
  const ki = imgs.filter(i => /KI-generiert/i.test(i.source_file || "")).length;
  const rImg = reports.filter(r => r.position > 0).length, rTxt = reports.filter(r => r.position === 0).length;
  const goals = cats.filter(c => (c.goal || "").trim()).length;
  const sounds = c => c.entries.filter(e => e.sound_path).length;
  const tile = (n, label, sub = "", href = "", warn = false) => `<${href ? `a href="${href}"` : "div"} class="kpi${warn ? " warn" : ""}">
    <b>${n}</b><span>${label}</span>${sub ? `<small>${sub}</small>` : ""}</${href ? "a" : "div"}>`;
  const row = c => {
    const n = c.entries.length, ids = new Set(c.entries.map(e => e.id));
    const im = c.entries.reduce((s, e) => s + e.images.length, 0);
    const miss = c.entries.reduce((s, e) => s + openSlots(e).length, 0);
    const ns = c.entries.reduce((s, e) => s + e.images.filter(noSource).length, 0);
    const rep = reports.filter(r => ids.has(r.entry_id)).length;
    const cell = (v, warn) => `<td class="num${v && warn ? " warn" : ""}">${v || "–"}</td>`;
    return `<tr class="${c.visible ? "" : "off"}">
      <td><a href="#/k/${esc(c.id)}">${esc(c.name)}</a>${c.visible ? "" : ` <span class="badge">ausgeblendet</span>`}</td>
      <td class="num">${n}</td><td class="num">${im}/${n * 4}</td>${cell(miss, true)}${cell(ns, true)}${cell(rep, true)}
      ${cell(sounds(c))}${cell(tasks.filter(x => x.category_id === c.id).length)}
      <td class="num">${(c.goal || "").trim() ? "✓" : `<span class="warn">fehlt</span>`}</td>
      <td class="num" title="${c.checked_at ? "Kategorie geprüft am " + checkedDate(c.checked_at) : "Kategorie noch nicht geprüft"}">${
        c.entries.filter(e => e.checked_at).length}/${n}${c.checked_at ? " ✓" : ""}</td></tr>`;
  };
  $("main").innerHTML = `<h2>Übersicht</h2>
    ${schemaMissing() ? `<p class="warn box"><b>Datenbank-Update fehlt:</b> Details unter <a href="#/erledigen">Zu erledigen</a>.</p>` : ""}
    <div class="kpis">
      ${tile(cats.length, "Kategorien", hiddenCats ? `${hiddenCats} ausgeblendet` : "alle sichtbar")}
      ${tile(all.length, "Einträge", `${shown} auf der Seite sichtbar`)}
      ${tile(imgs.length, "eigene Bilder", `${ki} KI-Infografiken · ${imgs.filter(i => i.edited).length} zugeschnitten`)}
      ${tile(missing, "fehlende Bilder", empty ? `${empty} Plätze bewusst leer` : "", missing ? "#/erledigen" : "", missing > 0)}
      ${tile(imgs.filter(noSource).length, "Bilder ohne Quelle", "gelten als eigenes Foto")}
      ${tile(rImg + rTxt, "offene Meldungen", `${rImg} Bilder · ${rTxt} Texte`, "#/erledigen", rImg + rTxt > 0)}
      ${tile(all.filter(({ e }) => e.sound_path).length, "Tierstimmen")}
      ${tile(all.reduce((s, { e }) => s + (e.confusions || []).length, 0), "Verwechslungshinweise")}
      ${tile(`${goals}/${cats.length}`, "Lernziele", goals < cats.length ? `${cats.length - goals} fehlen` : "alle gesetzt", "", goals < cats.length)}
      ${tile(tasks.length, "Forscheraufträge", `${tasks.filter(x => x.visible).length} sichtbar`)}
      ${tile(`${all.filter(({ e }) => (e.simple || "").trim()).length}/${all.length}`, "einfache Texte", all.some(({ e }) => !(e.simple || "").trim()) ? `${all.filter(({ e }) => !(e.simple || "").trim()).length} fehlen` : "alle vorhanden", "", all.some(({ e }) => !(e.simple || "").trim()))}
      ${tile(`${all.filter(({ e }) => e.checked_at).length}/${all.length}`, "von Hand geprüft",
        `${cats.filter(c => c.checked_at).length}/${cats.length} Kategorien · ${cats.filter(catAllChecked).length} ganz geprüft`)}
      ${tile(links.length, "Verknüpfungen", linkProposals().length ? `${linkProposals().length} Vorschläge offen` : "alle bestätigt",
        linkProposals().length ? "#/erledigen" : "", linkProposals().length > 0)}
      ${tile(regions.length, regions.length === 1 ? "Kanton" : "Kantone", proposalCount() ? `${proposalCount()} Vorschläge offen`
        : regions.map(g => `${esc(g.code || g.name)}: ${regionLinks(g.id).length}`).join(" · ") || "noch keiner", "#/kantone", proposalCount() > 0)}
      ${tile(esc(VERSION.app), "Website", `Datenbank ${dbSchema ?? "?"}${schemaMissing() ? ` (benötigt ${VERSION.schema})` : ""}`, "#/werkzeuge", schemaMissing())}
    </div>
    <h3>Pro Kategorie</h3>
    <div class="check-wrap"><table class="overview">
      <thead><tr><th>Kategorie</th><th>Einträge</th><th>Bilder</th><th>fehlen</th><th>ohne Quelle</th><th>Meldungen</th>
        <th>Stimmen</th><th>Aufträge</th><th>Lernziel</th><th>geprüft</th></tr></thead>
      <tbody>${cats.map(row).join("")}</tbody>
      <tfoot><tr><td>Total</td><td class="num">${all.length}</td><td class="num">${imgs.length}/${all.length * 4}</td>
        <td class="num">${missing || "–"}</td><td class="num">${imgs.filter(noSource).length || "–"}</td><td class="num">${reports.length || "–"}</td>
        <td class="num">${cats.reduce((s, c) => s + sounds(c), 0)}</td><td class="num">${tasks.length}</td>
        <td class="num">${goals}/${cats.length}</td><td class="num">${all.filter(({ e }) => e.checked_at).length}/${all.length}</td></tr></tfoot>
    </table></div>
    <p class="hint">Ein Klick auf eine Kategorie öffnet sie im Register «Prüfen». Die Übersicht ist über «Übersicht» oben oder
      den Titel von jeder Seite aus erreichbar.</p>`;
}

/* «Zu erledigen» (#/erledigen): nur was Arbeit braucht – Datenbank-Update, Meldungen, fehlende Bilder */
function renderTodo(){
  const main = $("main");
  const total = cats.reduce((s, c) => s + c.entries.length, 0);
  const imgs = cats.reduce((s, c) => s + c.entries.reduce((n, e) => n + e.images.length, 0), 0);
  const todo = cats.flatMap(c => c.entries.filter(e => openSlots(e).length).map(e => ({ cat:c, e })));
  const missing = todo.reduce((s, t) => s + openSlots(t.e).length, 0);
  const reported = reports.filter(r => r.position > 0).map(r => {
    const f = findEntry(r.entry_id);
    return f && { r, cat:f.cat, e:f.entry, img:f.entry.images.find(i => i.position === r.position) };
  }).filter(Boolean);
  const textReported = reports.filter(r => r.position === 0).map(r => {
    const f = findEntry(r.entry_id);
    return f && { r, cat:f.cat, e:f.entry };
  }).filter(Boolean);
  const nothing = !schemaMissing() && !reported.length && !textReported.length && !todo.length && !bulk && !proposalCount() && !linkProposals().length;
  const propRegions = regions.map(g => ({ g, n:regionLinks(g.id).filter(l => !l.r.confirmed).length })).filter(x => x.n);
  main.innerHTML = `<h2>Zu erledigen</h2>
    <p class="hint">${cats.length} Kategorien · ${total} Einträge · ${imgs} Bilder · ${tasks.length} Forscheraufträge.
      Zum Prüfen einer Kategorie links die Kategorie wählen: Das Register «Prüfen» zeigt alle Einträge mit Text und Bildern.</p>
    ${schemaMissing() ? `<p class="warn box"><b>Datenbank-Update fehlt:</b> Die Datenbank ist auf Version ${dbSchema || "14 oder älter"},
      diese Website braucht Version ${VERSION.schema}. Im Supabase-Dashboard unter «SQL Editor» die fehlenden Dateien
      bis <code>supabase/${String(VERSION.schema).padStart(3, "0")}_…</code> der Reihe nach ausführen.</p>` : ""}
    ${nothing ? `<p class="done-box">✓ Alles erledigt: keine Meldungen, keine fehlenden Bilder.</p>` : ""}
    ${linkProposals().length ? `<h3>Vorschläge für verknüpfte Einträge (${linkProposals().length})</h3>
      <p class="hint">Diese Verknüpfungen hat Claude vorgeschlagen; sie stehen schon unter «Dazu entdecken». Bestätigen, entfernen oder
        im Eintrag den Hinweis ändern.</p>
      <ul class="link-proposals">${linkProposals().map(l => {
        const a = findEntry(l.a), b = findEntry(l.b);
        return `<li><a href="#/e/${esc(a.entry.id)}">${esc(a.entry.name)}</a> <small class="hint">${esc(a.cat.name)}</small> ↔
          <a href="#/e/${esc(b.entry.id)}">${esc(b.entry.name)}</a> <small class="hint">${esc(b.cat.name)}</small>${l.note ? `<br><small>${esc(l.note)}</small>` : ""}
          <span class="slot-actions"><button type="button" class="ghost small" data-lok="${l.a}|${l.b}">Bestätigen</button>
          <button type="button" class="ghost small" data-ldel="${l.a}|${l.b}">Entfernen</button></span></li>`;
      }).join("")}</ul>
      <p><button type="button" class="ghost small" id="linksAllOk">Alle ${linkProposals().length} Vorschläge bestätigen</button></p>` : ""}
    ${propRegions.length ? `<h3>Vorschläge für Kantone prüfen</h3>
      <p class="hint">Diese Einträge sind einem Kanton vorgeschlagen und dort schon sichtbar. Bestätigen oder entfernen.</p>
      <ul>${propRegions.map(({ g, n }) => `<li><a href="#/r/${esc(g.id)}">${esc(regionTitle(g))}</a>: ${n} ${n === 1 ? "Vorschlag" : "Vorschläge"}</li>`).join("")}</ul>` : ""}
    ${reported.length ? `<h3>Gemeldete Bilder (${reported.length})</h3>
      <p class="hint">Ein neues Bild an diesem Platz oder «Bild entfernen» erledigt die Meldung automatisch.</p>
      <div class="reports">${reported.map(({ r, cat, e, img }, i) => `<div class="report-row">
        <div class="thumb">${img ? `<img data-ri="${i}" src="${esc(publicUrl(img.storage_path))}" alt="" loading="lazy">` : "kein eigenes Bild"}</div>
        <div>
          <b><a href="#/e/${esc(e.id)}">${esc(e.name)}</a></b> <small>(<a href="#/k/${esc(cat.id)}">${esc(cat.name)}</a>)</small><br>
          Bild ${r.position} · ${esc((e.labels || cat.labels)[r.position - 1])}${img ? "" : " (Online-Ersatz von Wikimedia)"}
          ${reportStale(e, r) ? `<br><span class="hint">Inzwischen steht dort ein anderes Bild.</span>` : ""}
          <p class="hint">${esc(reportText(r))}</p>
          <div class="slot-actions">
            ${img ? `<button type="button" class="ghost small" data-rother="${r.id}" title="Zum Eintrag wechseln und aus Vorschlägen von Wikimedia Commons wählen">Anderes Bild suchen</button>` : ""}
            <button type="button" class="ghost small" data-rdone="${r.id}">Erledigt</button>
          </div>
        </div></div>`).join("")}</div>` : ""}
    ${textReported.length ? `<h3>Gemeldete Textfehler (${textReported.length})</h3>
      <p class="hint">Die Meldenden sehen die Nummer der Meldung und können sie vorweisen. Weitere Meldungen zum selben
        Eintrag zählen hoch und hängen ihren Text an.</p>
      <div class="reports">${textReported.map(({ r, cat, e }) => `<div class="report-row text-row">
        <div>
          <b>Nr. ${r.id}</b> · <b><a href="#/e/${esc(e.id)}">${esc(e.name)}</a></b> <small>(${esc(cat.name)})</small>
          <p class="hint">${esc(reportText(r))}</p>
          <div class="slot-actions"><button type="button" class="ghost small" data-tdone="${r.id}">Erledigt</button></div>
        </div></div>`).join("")}</div>` : ""}
    ${todo.length || bulk ? `<h3>Fehlende Bilder</h3>
      <p>Bei ${todo.length} ${todo.length === 1 ? "Eintrag" : "Einträgen"} ${missing === 1 ? "fehlt 1 Bild" : `fehlen insgesamt ${missing} Bilder`}.</p>
      <button id="importAll" ${bulk ? "disabled" : ""}>Fehlende Bilder von Wikimedia übernehmen</button>
      <p class="hint" id="importMsg">Die Bilder werden nacheinander gesucht, verkleinert und gespeichert. Das dauert einige Minuten; die Seite dabei offen lassen.</p>` : ""}
    ${bulkResult && !bulk ? `<p class="hint">${esc(bulkResult)}</p>` : ""}`;
  showBulk();
  main.querySelectorAll("[data-ri]").forEach(el => applyFocus(el, reported[+el.dataset.ri].img));
  main.querySelectorAll("[data-rdone]").forEach(b => b.addEventListener("click", async () => {
    const { e, r } = reported.find(x => x.r.id === +b.dataset.rdone);
    await act(() => clearReports(e, r.position), "Meldung erledigt.").catch(() => {});
    render();
  }));
  main.querySelectorAll("[data-tdone]").forEach(b => b.addEventListener("click", async () => {
    const { e } = textReported.find(x => x.r.id === +b.dataset.tdone);
    await act(() => clearReports(e, 0), "Meldung erledigt.").catch(() => {});
    render();
  }));
  main.querySelectorAll("[data-rother]").forEach(b => b.addEventListener("click", () => {
    const { e, r } = reported.find(x => x.r.id === +b.dataset.rother);
    pickFor = { entry:e.id, pos:r.position };
    location.hash = "#/e/" + e.id;
  }));
  $("importAll")?.addEventListener("click", ev => { ev.target.disabled = true; importAll(todo); });
  // Vorschläge für verknüpfte Einträge (030) bestätigen oder entfernen
  const linkRef = s => { const [a, b] = s.split("|"); return { a, b }; };
  main.querySelectorAll("[data-lok]").forEach(btn => btn.addEventListener("click", async () => {
    const { a, b } = linkRef(btn.dataset.lok);
    await act(() => must(sb.from("entry_links").update({ confirmed:true }).eq("a", a).eq("b", b)), "Verknüpfung bestätigt.").catch(() => {});
    render();
  }));
  main.querySelectorAll("[data-ldel]").forEach(btn => btn.addEventListener("click", async () => {
    const { a, b } = linkRef(btn.dataset.ldel);
    await act(() => must(sb.from("entry_links").delete().eq("a", a).eq("b", b)), "Verknüpfung entfernt.").catch(() => {});
    render();
  }));
  $("linksAllOk")?.addEventListener("click", async () => {
    if(!confirm(`Alle ${linkProposals().length} vorgeschlagenen Verknüpfungen bestätigen?`)) return;
    await act(() => must(sb.from("entry_links").update({ confirmed:true }).eq("confirmed", false)), "Alle Verknüpfungen bestätigt.").catch(() => {});
    render();
  });
}

/* «Ideen» (#/ideen, seit 2.23.0): alle vorgemerkten Pendenzen und Ideen an einem Ort, damit nichts verloren geht.
   Feste Liste hier im Code; bei neuen Ideen oder Erledigtem nachführen, gleich wie docs/WERDEGANG.md «Offen und geplant». */
const IDEEN = [
  { title:"Pendenzen der Spielwiese", hint:"Vorgemerkt am 8. Oktober 2026, als Nächstes der Reihe nach.", items:[
    ["Steckbriefe vorschlagen", "Lernende schlagen einen neuen Eintrag vor (ohne Namen, wie die Textmeldungen); die Lehrperson prüft und übernimmt ihn hier in der Verwaltung."],
    ["Forscheraufträge draussen", "Aufträge mit eigenen Messungen und Beobachtungen, z. B. Föhn (Temperatur und Wind), Bach (Lebensraum der Bachforelle)."],
    ["Vorlesen in LernApp und Aufträgen", "Frage, Merksatz und Erklärung vorlesen lassen, wie heute schon die Textseite der Karten."],
    ["Themenpfade in der Verwaltung bearbeiten", "Heute nur per SQL (Tabelle «paths»). Dazu weitere Pfade, z. B. Wald, Wasser, Glarnerland."],
    ["Exkursionen und Posten aus der Entdeckungskarte", "Orte auf der Karte auswählen und daraus einen Postenlauf mit QR-Plakaten und Steckbriefen drucken."]
  ]},
  { title:"Weitere Ideen", hint:"Noch nicht entschieden.", items:[
    ["«Welches Tier ruft da?»","Spiel oder LernApp-Variante mit den Tierstimmen (28 Arten): Stimme hören, Tier wählen."],
    ["Entdeckungskarte erweitern", "Flüsse als Linien statt Punkt (Linth, Rhein, Aare …); bei neuen Einträgen mit festem Ort die Koordinaten gleich im Claude-Auftrag mitliefern lassen."],
    ["Weitere Kantone", "Weitere Kantone mit eigenem Bereich, Kantonszeichen und vorgeschlagenen Einträgen (heute Glarus, Graubünden, St. Gallen, Zürich, Tessin)."],
    ["Bildnachweis mit Urheber und Lizenz", "Für Druck und Weitergabe Urheber und Lizenz direkt angeben statt nur den Link zu Commons; 7 Bilder mit GFDL oder Persönlichkeitsrechten ersetzen (Lizenzprüfung vom 30.9.2026). Nur nötig bei Vermarktung."],
    ["Vermarktung", "Möglichkeiten: Schullizenz oder Freemium, Druckprodukte, Verlag oder Organisation, Anpassungen auf Bestellung, Weiterbildungen. Noch nichts entschieden."],
    ["Neue App", "Mit Verknüpfung zu Moodle und weiteren Stufen (Kategorie › Thema › Unterthema › Einträge), eigenes Hosting mit MariaDB. Zuerst Architektur beraten."]
  ]},
  { title:"Ideen für die Mittelstufe", hint:"Vorschläge von Claude vom 8. Oktober 2026, noch nicht entschieden.", items:[
    ["Lebensräume sortieren", "Spiel: Karten in Wald, Wiese, Wasser, Gebirge und Siedlung ziehen; danach zeigt die Seite, was stimmt. Braucht pro Eintrag den Lebensraum (steht oft schon im Steckbrief)."],
    ["Wie gross ist das?", "Tier oder Pflanze im Grössenvergleich mit einem Kind, einer Hand oder einem Schulzimmer, aus den Massen im Steckbrief."],
    ["Mein Steckbrief", "Druckvorlage zum Ausfüllen: Bild aus der App, leere Steckbrief-Zeilen und Platz für eine Zeichnung; danach mit der Karte vergleichen."],
    ["Naturtagebuch", "Beobachtungen mit Datum, Ort und Notiz festhalten (nur auf dem Gerät), passend zum Jahreskalender; am Ende als Seite drucken."],
    ["Glarner Sagen", "Neue Kategorie mit Sagen (Vrenelisgärtli, Martinsloch, Fridolin, Näfelser Fahrt) zum Vorlesen, verknüpft mit den Orten auf der Karte."],
    ["Bestimmen mit Ja/Nein-Fragen", "Einfacher Bestimmungsweg für Bäume: Nadeln oder Blätter? Einzeln oder gebündelt? … bis zur Karte."]
  ]},
  { title:"Ideen für die Oberstufe", hint:"Vorschläge von Claude vom 8. Oktober 2026, noch nicht entschieden.", items:[
    ["Nahrungsnetz bauen", "Wer frisst wen? Aus den Steckbriefen ein Nahrungsnetz für Wald, Bach oder Alp zusammenstellen und überlegen, was fehlt, wenn eine Art verschwindet (NT.9)."],
    ["Bestimmungsschlüssel", "Dichotomer Schlüssel für Amphibien, Nadelbäume oder Pilze, Schritt für Schritt mit Merkmalen; am Schluss Vergleich mit der Verwechslungsgefahr."],
    ["Neophyten und Gefährdung", "Neue Kategorie invasive Pflanzen (Japanischer Knöterich, Drüsiges Springkraut, Goldrute) und pro Art der Status auf der Roten Liste; Diskussion über Schutz und Bekämpfung."],
    ["Berufe in der Natur", "Förster, Wildhüterin, Landwirt, Fischereiaufseher, Geologin: kurze Porträts mit Bezug zu den Karten, passend zur beruflichen Orientierung."],
    ["Zeitstrahl-Puzzle", "Spiel: Ereignisse aus Geschichte und Politik in die richtige Reihenfolge bringen, mit Jahr und Begründung als Auflösung."],
    ["Argumente sortieren", "Zu einer Abstimmungsfrage Pro- und Contra-Argumente ordnen und gewichten, danach Abstimmung spielen (RZG.8)."],
    ["Klimadaten auswerten", "Forscherauftrag mit echten Messreihen (z. B. Temperatur Glarus seit 1900) als Tabelle: Diagramm zeichnen, Trend beschreiben, mit dem Themenpfad Klimawandel verbinden."]
  ]},
  { title:"Prüfen und Qualität", hint:"Was sich nicht automatisch testen liess oder fachlich bestätigt werden muss.", items:[
    ["Verwaltung von Hand testen", "Bild über ↻ ersetzen; eigenes Bild hochladen, zuschneiden, Ausschnitt, entfernen; Text und Quelle speichern; Reihenfolge der Einträge; Aufträge bearbeiten, anlegen, löschen; Sicherung herunterladen; Kantone: Vorschläge bestätigen, Hinweis ändern, Zeichen hochladen, Plakat drucken."],
    ["Seite von Hand testen", "Erster Besuch: Forscherauftrag nach der Einführung; auf dem Handy Kanton wechseln und LernApp-Session im Kanton anlegen; Entdeckungskarte: «Wo bin ich?» und Zoomen mit zwei Fingern."],
    ["Koordinaten prüfen", "Berglistüber und Bundesgericht fand die Ortssuche von swisstopo nicht: im Eintrag mit «Auf der Karte prüfen» kontrollieren."],
    ["Anleitung für Lehrpersonen", "Zuordnung der Lernziele zum Lehrplan 21 fachlich prüfen (heute auf Ebene der Kompetenzbereiche)."],
    ["Vollständige Prüfung der Inhalte", "Alle Einträge von Hand prüfen und mit dem Häkchen «geprüft» markieren (Register «Prüfen», Filter «noch nicht geprüft»); Sicherheit zuerst: Pilze, Giftpflanzen, Giftschlangen. Den Stand zeigt die Übersicht."],
    ["Verknüpfungen bestätigen", "71 Vorschläge von Claude unter «Zu erledigen» durchsehen; weitere Verknüpfungen im Eintrag ergänzen, z. B. Berge und ihre Tiere und Pflanzen."],
    ["Erprobung mit Lernenden", "Testszenario mit Aufgaben, Beobachtungsbogen und Fragebogen liegt bereit (Ordner «erprobung»)."],
    ["Einzelne Bildkorrekturen", "Doppelte oder unpassende Fotos ersetzen; Meldungen kommen unter «Zu erledigen»."]
  ]}
];
function renderIdeas(){
  const n = IDEEN.reduce((s, g) => s + g.items.length, 0);
  $("main").innerHTML = `<h2>Ideen</h2>
    <p class="hint">${n} vorgemerkte Pendenzen und Ideen. Was Arbeit an den Inhalten braucht (Meldungen, fehlende Bilder),
      steht unter <a href="#/erledigen">Zu erledigen</a>. Neue Ideen oder Entscheide einfach Claude sagen, dann wird diese Liste
      nachgeführt; was umgesetzt ist, steht im Werdegang.</p>
    ${IDEEN.map(g => `<h3>${esc(g.title)} <small class="hint">(${g.items.length})</small></h3>
      <p class="hint">${esc(g.hint)}</p>
      <ul class="ideas">${g.items.map(([t, d]) => `<li><b>${esc(t)}</b><br>${esc(d)}</li>`).join("")}</ul>`).join("")}`;
}

/* «Werkzeuge» (#/werkzeuge): selten gebraucht – Bilder aus Liste, Sicherung, Version */
function renderTools(){
  const empty = cats.reduce((s, c) => s + c.entries.reduce((n, e) => n + (e.empty_slots || []).length, 0), 0);
  $("main").innerHTML = `<h2>Werkzeuge</h2>
    <details class="sec" open><summary>Bilder aus Liste übernehmen</summary>
      <p class="hint">Mehrere Bilder oder Tierstimmen auf einmal von Commons übernehmen oder entfernen. Eine Zeile pro Bild:
        <code>Eintrag | Bildnummer | Commons-Adresse</code> oder <code>Eintrag | Bildnummer | entfernen</code>;
        für eine Tierstimme <code>Eintrag | ton | Commons-Adresse</code> bzw. <code>… | ton | entfernen</code>
        (statt «|» geht auch ein Tabulator oder «;»).</p>
      <textarea id="batchList" placeholder="Steinmarder | 2 | https://commons.wikimedia.org/wiki/File:…"></textarea>
      <p><button type="button" class="ghost" id="batchCheck">Liste prüfen</button></p>
      <div id="batchResult"></div>
      ${empty ? `<p class="hint">${empty === 1 ? "1 Bildplatz ist" : `${empty} Bildplätze sind`} bewusst leer und
        ${empty === 1 ? "wird" : "werden"} beim Übernehmen fehlender Bilder nicht gefüllt (im Eintrag änderbar).</p>` : ""}
    </details>
    <details class="sec" open><summary>Sicherung</summary>
      <p class="hint">Lädt alle Kategorien, Einträge, Bildangaben, Forscheraufträge und Kantone als Datei herunter (JSON). Die Bild- und
        Tondateien selbst liegen im Supabase-Speicher, ihre Quellen auf Wikimedia Commons. Am besten regelmässig und vor
        grossen Änderungen sichern.</p>
      <p><button type="button" class="ghost" id="backupBtn">Sicherung herunterladen</button></p>
    </details>
    <details class="sec" open><summary>Version</summary>
      <p class="hint">Website ${esc(VERSION.app)} vom ${new Date(VERSION.datum + "T00:00").toLocaleDateString("de-CH", { day:"numeric", month:"long", year:"numeric" })}
        · Datenbank ${dbSchema === 0 ? "14 oder älter" : dbSchema ?? "?"}
        (benötigt ${VERSION.schema}) · Verlauf der Versionen: GitHub → Tags</p>
    </details>`;
  setupBatch();
  $("backupBtn").addEventListener("click", async ev => {
    ev.target.disabled = true;
    try{
      const n = await downloadBackup();
      msg(`Sicherung erstellt: ${n.categories} Kategorien, ${n.entries} Einträge, ${n.images} Bilder, ${n.tasks} Forscheraufträge, ${n.regions} Kantone.`);
    }catch(err){ msg("Sicherung fehlgeschlagen: " + err.message, true); }
    ev.target.disabled = false;
  });
}
/* ------------------------------------------------------------------
   BILDER AUS LISTE (Übersicht): mehrere Bilder auf einmal von Commons übernehmen oder entfernen.
   Zuerst prüfen (Tabelle mit Stand pro Zeile), dann ausführen. Zeilen laufen nacheinander.
------------------------------------------------------------------- */
function parseBatch(text){
  return text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map((line, i) => {
    const m = line.match(/^(.+?)\s*[|;\t]\s*(\d+|ton)\s*[|;\t]\s*(.+)$/i);
    const sound = !!m && /^ton$/i.test(m[2]);
    const r = { nr:i + 1, name:m ? m[1].trim() : line, pos:m && !sound ? +m[2] : 0, sound, what:m ? m[3].trim() : "" };
    if(!m) return { ...r, err:"Form: Eintrag | Bildnummer oder «ton» | Adresse oder «entfernen»" };
    const hits = cats.flatMap(c => c.entries.filter(e => e.name.toLowerCase() === r.name.toLowerCase()).map(e => ({ cat:c, entry:e })));
    if(!hits.length) return { ...r, err:"Eintrag nicht gefunden" };
    if(hits.length > 1) return { ...r, err:"Name kommt in mehreren Kategorien vor" };
    r.entry = hits[0].entry;
    if(!r.sound && (r.pos < 1 || r.pos > 4)) return { ...r, err:"Bildnummer muss 1–4 sein" };
    if(/^entfernen$/i.test(r.what)){
      r.remove = true;
      if(r.sound && !r.entry.sound_path) r.err = "Keine Tierstimme vorhanden";
      if(!r.sound && !r.entry.images.some(im => im.position === r.pos)) r.err = "An diesem Platz ist kein Bild";
    }else{
      r.file = commonsFile(r.what);
      if(!r.file) r.err = "Keine Commons-Adresse (…/wiki/File:…)";
    }
    return r;
  });
}

function setupBatch(){
  const out = $("batchResult");
  let rows = [];
  const setStatus = (r, text, cls) => {
    const td = $("batch" + r.nr)?.querySelector(".stand");
    if(td){ td.textContent = text; td.className = "stand " + (cls || ""); }
  };
  $("batchCheck").addEventListener("click", () => {
    rows = parseBatch($("batchList").value);
    const good = rows.filter(r => !r.err).length;
    out.innerHTML = rows.length ? `<table class="batch">
      <tr><th>#</th><th>Eintrag</th><th>Bild</th><th>Aktion</th><th>Stand</th></tr>
      ${rows.map(r => `<tr id="batch${r.nr}"><td>${r.nr}</td><td>${esc(r.entry?.name || r.name)}</td><td>${r.sound ? "Ton" : r.pos || ""}</td>
        <td>${r.remove ? "entfernen" : esc(r.file || r.what)}</td>
        <td class="stand ${r.err ? "bad" : ""}">${esc(r.err || "bereit")}</td></tr>`).join("")}</table>
      <p>${good ? `<button type="button" id="batchRun">${good} ${good === 1 ? "Zeile" : "Zeilen"} ausführen</button>` : ""}
        ${rows.length - good ? `<span class="hint">${rows.length - good} fehlerhafte Zeilen werden übersprungen.</span>` : ""}</p>`
      : `<p class="hint">Die Liste ist leer.</p>`;
    $("batchRun")?.addEventListener("click", async ev => {
      ev.target.disabled = true;
      $("batchCheck").disabled = true;
      let ok = 0;
      const todo = rows.filter(r => !r.err);
      for(const r of todo){
        setStatus(r, "läuft …");
        try{
          // Aktuellen Stand holen: frühere Zeilen können denselben Eintrag schon geändert haben
          const found = findEntry(r.entry.id);
          if(!found) throw new Error("Eintrag nicht mehr vorhanden");
          const old = found.entry.images.find(im => im.position === r.pos);
          if(r.sound){
            if(!r.remove) await storeSound(found.cat, found.entry, await commonsAudio(r.file));
            else if(found.entry.sound_path) await removeSound(found.entry);
            else throw new Error("keine Tierstimme vorhanden");
          }else if(r.remove){
            if(!old) throw new Error("kein Bild an diesem Platz");
            await removeImage(found.entry, old);
          }else{
            await storeWikimedia(found.cat, found.entry, r.pos, await commonsFileImage(r.file), old);
          }
          await reload();
          setStatus(r, "✓ erledigt", "ok");
          ok++;
        }catch(err){ setStatus(r, "✗ " + err.message, "bad"); }
        await sleep(300);   // Wikimedia schonen
      }
      $("batchCheck").disabled = false;
      msg(`${ok} von ${todo.length} Zeilen erledigt.`, ok < todo.length);
    });
  });
}

/* ------------------------------------------------------------------
   ANMELDUNG
------------------------------------------------------------------- */
async function start(session){
  $("loginView").hidden = !!session;
  $("mfaView").hidden = true;
  $("appView").hidden = true;
  $("topnav").hidden = true;
  $("logout").hidden = !session;
  $("who").textContent = session ? session.user.email : "";
  if(!session) return;
  // Zweiter Faktor: Ohne Code aus der Authenticator-App (aal2) gibt die Datenbank keine Admin-Rechte
  const aal = await must(sb.auth.mfa.getAuthenticatorAssuranceLevel());
  if(aal.currentLevel !== "aal2") return showMfa();
  const isAdmin = await sb.rpc("is_admin");
  if(isAdmin.data !== true){
    $("loginView").hidden = false;
    $("loginMsg").textContent = "Dieses Konto hat keine Admin-Rechte (Tabelle «admins»).";
    return;
  }
  try{
    await Promise.all([reload(), loadSchemaVersion()]);
    $("appView").hidden = false;
    $("topnav").hidden = false;
    render();
  }catch(e){ msg("Daten konnten nicht geladen werden: " + e.message, true); }
}

$("loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  $("loginMsg").textContent = "";
  const { data, error } = await sb.auth.signInWithPassword({ email:$("email").value, password:$("pw").value });
  if(error){ $("loginMsg").textContent = error.message; return; }
  start(data.session);
});

// Code abfragen. Ist noch keine App eingerichtet, zuerst den QR-Code zum Einrichten zeigen.
let mfaFactorId = null;
async function showMfa(){
  $("mfaView").hidden = false;
  $("mfaMsg").textContent = "";
  $("mfaCode").value = "";
  try{
    const factors = await must(sb.auth.mfa.listFactors());
    if(factors.totp.length){
      mfaFactorId = factors.totp[0].id;
      $("mfaSetup").hidden = true;
    }else{
      // Abgebrochene Einrichtungen entfernen, sonst lehnt Supabase eine neue ab
      for(const f of factors.all.filter(f => f.status !== "verified")){
        await must(sb.auth.mfa.unenroll({ factorId:f.id }));
      }
      const en = await must(sb.auth.mfa.enroll({ factorType:"totp", friendlyName:"Authenticator" }));
      mfaFactorId = en.id;
      $("mfaQr").src = en.totp.qr_code;
      $("mfaSecret").textContent = en.totp.secret;
      $("mfaSetup").hidden = false;
    }
    $("mfaCode").focus();
  }catch(e){ $("mfaMsg").textContent = "Zweiter Faktor nicht verfügbar: " + e.message; }
}
$("mfaForm").addEventListener("submit", async e => {
  e.preventDefault();
  $("mfaMsg").textContent = "";
  const { error } = await sb.auth.mfa.challengeAndVerify({ factorId:mfaFactorId, code:$("mfaCode").value.trim() });
  if(error){ $("mfaMsg").textContent = "Code falsch oder abgelaufen. Bitte den aktuellen Code eingeben."; return; }
  const { data } = await sb.auth.getSession();
  start(data.session);
});

$("logout").addEventListener("click", async () => { await sb.auth.signOut(); start(null); });
window.addEventListener("hashchange", () => { if(!$("appView").hidden) render(); });
sb.auth.getSession().then(({ data }) => start(data.session));

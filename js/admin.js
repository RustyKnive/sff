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
  cats = await must(sb.from("categories")
    .select("*, entries!entries_category_id_fkey(*, images(*))")
    .order("sort").order("name")
    .order("sort", { referencedTable:"entries" }).order("name", { referencedTable:"entries" }));
  await loadReports();
  renderSidebar();
}

/* Gemeldete Bilder (016): Meldungen aus der Anzeige («Melden» in der Grossansicht).
   Fehlt die Tabelle (Datenbank älter als 016), bleibt die Liste einfach leer. */
let reports = [];
async function loadReports(){
  const { data, error } = await sb.from("image_reports").select("*").order("last_at", { ascending:false });
  reports = error ? [] : data;
}
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
  const [, type, id, extra] = location.hash.split("/");
  return { type, id, extra };
}

function renderSidebar(){
  const r = route();
  const activeCat = r.type === "k" ? r.id : r.type === "e" ? (r.id === "neu" ? r.extra : findEntry(r.id)?.cat.id) : null;
  const hidden = cats.filter(c => !c.visible).length;
  $("catCount").textContent = `(${cats.length}${hidden ? `, davon ${hidden} ausgeblendet` : ""})`;
  $("catList").innerHTML = cats.map((c, i) => `
    <li class="${c.id === activeCat ? "active" : ""} ${c.visible ? "" : "off"}">
      <input type="checkbox" data-vis="${esc(c.id)}" ${c.visible ? "checked" : ""} title="Auf der Seite sichtbar">
      <a href="#/k/${esc(c.id)}">${esc(c.name)} <small>(${c.entries.length})</small></a>
      <button class="icon" data-move="${i}" data-dir="-1" title="Nach oben" ${i ? "" : "disabled"}>↑</button>
      <button class="icon" data-move="${i}" data-dir="1" title="Nach unten" ${i < cats.length - 1 ? "" : "disabled"}>↓</button>
    </li>`).join("");
}
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
$("toOverview").addEventListener("click", () => { location.hash = "#/"; });

/* ------------------------------------------------------------------
   KATEGORIE BEARBEITEN
------------------------------------------------------------------- */
function renderCategory(cat){
  const isNew = !cat;
  const c = cat || { id:"", name:"", description:"", latin:false, visible:true, labels:DEFAULT_LABELS, cover_entry_id:null, entries:[] };
  const main = $("main");
  const n = c.entries.length;
  if(aiReport && aiReport.id !== c.id) aiReport = null;
  main.innerHTML = `
    <h2>${isNew ? "Neue Kategorie" : "Kategorie: " + esc(c.name)}</h2>
    ${aiReport ? `<p class="ai-verdict ${aiReport.isErr ? "warn" : ""}">${esc(aiReport.text)}</p>` : ""}
    <form id="catForm">
      <div class="row">
        <label>Name <input type="text" name="name" required value="${esc(c.name)}"></label>
        <label>ID (für die Adresse #/…) <input type="text" name="id" required pattern="[a-z0-9]+(-[a-z0-9]+)*" value="${esc(c.id)}"></label>
      </div>
      ${isNew ? `<div class="ai">
        <h3>Einträge mit Claude erstellen</h3>
        <div class="ai-row">
          <label>Anzahl Einträge <input type="number" name="aiCount" min="1" max="20" value="8"></label>
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
      <label class="inline"><input type="checkbox" name="visible" ${c.visible ? "checked" : ""}> Kategorie auf der Seite sichtbar</label>
      <label class="inline"><input type="checkbox" name="latin" ${c.latin ? "checked" : ""}> Untertitel der Einträge ist ein lateinischer Name (kursiv)</label>
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
    </form>
    ${isNew ? "" : `
    <h3>Einträge (${n})</h3>
    <ul class="list" id="entryList">
      ${c.entries.map((e, i) => `
      <li class="${e.visible ? "" : "off"}">
        <input type="checkbox" data-vis="${e.id}" ${e.visible ? "checked" : ""} title="Auf der Seite sichtbar">
        <a href="#/e/${e.id}">${esc(e.name)} <small>${esc(e.subtitle)} · ${e.images.length}/4 Bilder</small></a>
        <button class="icon" data-move="${i}" data-dir="-1" title="Nach oben" ${i ? "" : "disabled"}>↑</button>
        <button class="icon" data-move="${i}" data-dir="1" title="Nach unten" ${i < n - 1 ? "" : "disabled"}>↓</button>
      </li>`).join("")}
    </ul>
    <p class="actions"><button class="ghost" id="newEntry">+ Neuer Eintrag</button>
      <button class="ghost" id="qrAll" title="QR-Codes mit Direktlink zu jedem sichtbaren Eintrag, 12 pro A4-Seite">QR-Codes drucken</button></p>`}`;

  const form = $("catForm");
  const F = form.elements;
  // ID beim Anlegen aus dem Namen vorschlagen
  if(isNew) F.name.addEventListener("input", () => { F.id.value = slug(F.name.value); });
  if(isNew) setupAi(form);

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const row = {
      id:F.id.value.trim(), name:F.name.value.trim(), description:F.description.value.trim(),
      latin:F.latin.checked, visible:F.visible.checked, labels:[0,1,2,3].map(i => F["label" + i].value.trim())
    };
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
      await act(() => must(sb.from("categories").update(row).eq("id", c.id)), "Gespeichert.");
    }
    if(location.hash !== "#/k/" + row.id) location.hash = "#/k/" + row.id; else render();
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
  $("entryList").addEventListener("click", e => {
    const b = e.target.closest("[data-move]");
    if(b) move("entries", c.entries, +b.dataset.move, +b.dataset.dir);
  });
  $("entryList").addEventListener("change", e => {
    const box = e.target.closest("[data-vis]");
    if(box) setVisible("entries", box.dataset.vis, box.checked);
  });
  $("newEntry").addEventListener("click", () => { location.hash = "#/e/neu/" + c.id; });
  $("qrAll").addEventListener("click", () => printQr(c, c.entries.filter(e => e.visible)));
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
Es geht um Natur, Landschaft und Sehenswürdigkeiten der Schweiz: Einträge müssen in der Schweiz vorkommen bzw. liegen,
und es sollen die bekanntesten und für Schülerinnen und Schüler wichtigsten sein.`;
const AI_RULES = `Sprache: Deutsch mit Schweizer Rechtschreibung (nie Eszett, immer «ss»; Anführungszeichen «…»).
Texte sachlich, anschaulich und für Sek I verständlich. Die Fakten müssen stimmen: Lieber eine Angabe weglassen als raten.`;
const AI_ENTRY_TASK = `Beschreibung in 3–4 Sätzen, Steckbrief mit 3–4 kurzen Zeilen,
genau 3 englische Suchbegriffe für Wikimedia Commons passend zu den Bildbeschriftungen 2, 3 und 4,
und wp = Titel des englischen Wikipedia-Artikels fürs Hauptbild (leer, wenn der lateinische Name genügt).`;
// Beispiel-Eintrag aus der Kategorie Bäume (Bildbeschriftungen Baum, Blätter, Früchte, Rinde)
const AI_EXAMPLE = `{
      "name": "Buche",
      "subtitle": "Fagus sylvatica",
      "description": "Die Rotbuche ist der häufigste Laubbaum der Schweiz und würde ohne menschlichen Einfluss grosse Teile des Mittellandes und des Juras bedecken. Typisch sind die glatte, silbergraue Rinde und die eiförmigen Blätter mit leicht gewelltem, bewimpertem Rand. Ihre dreikantigen Früchte heissen Bucheckern.",
      "facts": [{"k": "Höhe", "v": "bis 40 m"}, {"k": "Alter", "v": "bis 300 Jahre"}, {"k": "Vorkommen", "v": "Mittelland, Jura, bis ca. 1500 m"}, {"k": "Merkmal", "v": "glatte, silbergraue Rinde"}],
      "search_terms": ["Fagus sylvatica leaves", "Fagus sylvatica beechnuts", "Fagus sylvatica bark"],
      "wp": ""
    }`;
const allEntryNames = () => cats.flatMap(c => c.entries.map(e => e.name)).join(", ");

function aiPrompt(name, count){
  return `${AI_INTRO}

Neue Kategorie: «${name}», mit ${count} Einträgen (die bekanntesten zuerst).

1. Prüfe, ob die Kategorie zur Seite passt und ob sie sich mit bestehenden Kategorien oder Einträgen überschneidet.
   Keine Einträge, die es schon gibt.
2. Schlage Name der Kategorie (Mehrzahl wie die bestehenden), einen kurzen Untertitel der Kachel und genau 4 kurze
   Bildbeschriftungen vor (Bild 1 zeigt das Ganze, z. B. Baum, Blätter, Früchte, Rinde).
   latin = true bei Lebewesen: Der Untertitel jedes Eintrags ist dann der lateinische Name. Sonst nennt er Ort, Kanton oder Art.
3. Schreibe jeden Eintrag: ${AI_ENTRY_TASK}

${AI_RULES}

Bestehende Kategorien: ${cats.map(c => c.name).join(", ")}
Bestehende Einträge: ${allEntryNames()}

Antworte nur mit einem JSON-Codeblock in genau dieser Form (Beispiel-Eintrag aus der Kategorie Bäume):
\`\`\`json
{
  "passt": true,
  "pruefung": "2–4 Sätze: Passt die Kategorie? Überschneidungen? Hinweise",
  "name": "Bäume",
  "description": "Die wichtigsten Waldbäume",
  "latin": true,
  "labels": ["Baum", "Blätter", "Früchte", "Rinde"],
  "entries": [
    ${AI_EXAMPLE}
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
    facts:(Array.isArray(e?.facts) ? e.facts : []).map(f => ({ k:aiStr(f?.k, 60), v:aiStr(f?.v, 200) })).filter(f => f.k && f.v).slice(0, 6),
    search_terms:(Array.isArray(e?.search_terms) ? e.search_terms : []).map(t => aiStr(t, 120)).filter(Boolean).slice(0, 3),
    wp:aiStr(e?.wp, 200) || null
  };
}

function aiParse(text){
  const r = aiJson(text);
  const entries = (Array.isArray(r.entries) ? r.entries : []).map(aiEntry).filter(e => e.name);
  if(!entries.length) throw new Error("Die Antwort enthält keine Einträge.");
  return {
    passt:r.passt !== false, pruefung:aiStr(r.pruefung), name:aiStr(r.name, 100), description:aiStr(r.description, 200),
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
    const count = Math.min(20, Math.max(1, +F.aiCount.value || 8));
    try{
      await navigator.clipboard.writeText(aiPrompt(name, count));
      msg("Auftrag kopiert. Jetzt auf claude.ai einfügen und senden.");
    }catch(e){
      // Ohne Zugriff auf die Zwischenablage: Auftrag ins Feld schreiben und markieren
      F.aiAnswer.value = aiPrompt(name, count);
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
        <p class="hint">${esc(e.description)}<br>${e.facts.map(f => `${esc(f.k)}: ${esc(f.v)}`).join(" · ")}</p></div>`).join("")}</div>`;
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
    await must(sb.from("entries").insert(chosen.map((e, i) => ({
      category_id:row.id, name:e.name, subtitle:e.subtitle, description:e.description, facts:e.facts,
      search_terms:e.search_terms, wp:e.wp, visible:true, sort:i
    }))));
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

function aiEntryPrompt(cat, name, photo){
  const others = cat.entries.map(e => e.name).join(", ") || "noch keine";
  return `${AI_INTRO}

Kategorie «${cat.name}»${cat.description ? ` (${cat.description})` : ""}. Bildbeschriftungen: ${cat.labels.join(", ")}.
${cat.latin ? "Der Untertitel eines Eintrags ist der lateinische Name." : "Der Untertitel eines Eintrags nennt Ort, Kanton oder Art."}

${photo
  ? `Neuer Eintrag über ein Foto: Bestimme so genau wie möglich, was auf dem beigefügten Foto zu sehen ist${name ? ` (Vermutung: «${name}»)` : ""}.
Schreibe in «pruefung», wie sicher die Bestimmung ist, woran du sie erkennst und welche ähnlichen Arten in Frage kommen.`
  : `Neuer Eintrag: «${name}».`}

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
  "entry": ${AI_EXAMPLE}
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
    const text = aiEntryPrompt(cat, name, isPhoto());
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
    $("facts").innerHTML = e.facts.map(f => factRow(f.k, f.v)).join("");
    [0,1,2].forEach(i => { F["q" + i].value = e.search_terms[i] || ""; });
    F.wp.value = e.wp || "";
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
  try{ saved = await act(() => must(sb.from("entries").insert(row).select("id").single()), null); }
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
   SICHERUNG: alle Kategorien, Einträge und Bildangaben als JSON-Datei herunterladen.
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
  const data = { erstellt:new Date().toISOString(), website:VERSION.app, datenbank:dbSchema, projekt:CFG.url, bucket:CFG.bucket, categories, entries, images };
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type:"application/json" }));
  a.download = `natur-und-schweiz-sicherung-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return { categories:categories.length, entries:entries.length, images:images.length };
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
    <p class="hint"><a href="#/k/${esc(cat.id)}">← ${esc(cat.name)}</a></p>
    <h2>${isNew ? "Neuer Eintrag" : esc(e.name)}</h2>
    ${aiReport ? `<p class="ai-verdict ${aiReport.isErr ? "warn" : ""}">${esc(aiReport.text)}</p>` : ""}
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
      <div class="row">
        <label>Name <input type="text" name="name" required value="${esc(e.name)}"></label>
        <label>${cat.latin ? "Lateinischer Name" : "Untertitel (Ort, Gesteinsart …)"} <input type="text" name="subtitle" value="${esc(e.subtitle)}"></label>
        ${isNew ? "" : `<label>Kategorie (zum Verschieben ändern)
          <select name="category">${cats.map(c => `<option value="${esc(c.id)}" ${c.id === cat.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label>`}
      </div>
      <label class="inline"><input type="checkbox" name="visible" ${e.visible ? "checked" : ""}> Eintrag auf der Seite sichtbar</label>
      <label>Beschreibung <textarea name="description">${esc(e.description)}</textarea></label>
      <p class="hint">3–4 Sätze, sachlich und für Sek I verständlich. Schweizer Rechtschreibung: immer «ss», nie Eszett.</p>

      <h3>Steckbrief</h3>
      <div class="facts" id="facts">${e.facts.map(f => factRow(f.k, f.v)).join("")}</div>
      <button type="button" class="ghost" id="addFact">+ Zeile</button>

      <h3>Verwechslungsgefahr</h3>
      <div class="facts" id="confusions">${(e.confusions || []).map(c => confRow(c.name, c.diff)).join("")}</div>
      <button type="button" class="ghost" id="addConf">+ Verwechslung</button>
      <p class="hint">Name des ähnlichen Eintrags (gibt es ihn, wird er verlinkt) und woran man die beiden unterscheidet.
        Gilt nur für diesen Eintrag; beim anderen bei Bedarf ebenfalls eintragen.</p>

      ${isNew ? "" : `<h3>Tierstimme</h3>
      ${e.sound_path ? `<audio controls preload="none" src="${esc(publicUrl(e.sound_path))}"></audio>
        <p class="hint">Quelle: ${e.sound_page ? `<a href="${esc(e.sound_page)}" target="_blank" rel="noopener">${esc(e.sound_file || e.sound_page)}</a>` : "eigene Aufnahme"}</p>`
        : `<p class="hint">Keine Tierstimme hinterlegt.</p>`}
      <label>Commons-Audiodatei (…/wiki/File:…ogg oder …mp3) <input type="url" name="soundPage" value="${esc(e.sound_page)}"></label>
      <div class="slot-actions">
        <button type="button" class="ghost" id="soundFetch">Ton von dieser Quelle übernehmen</button>
        ${e.sound_path ? `<button type="button" class="danger" id="soundDel">Ton entfernen</button>` : ""}
      </div>`}

      <h3>Bilder</h3>
      <label class="inline"><input type="checkbox" name="ownLabels" ${e.labels ? "checked" : ""}> Eigene Bildbeschriftungen statt «${esc(cat.labels.join(", "))}»</label>
      <div class="row" id="labelRow" ${e.labels ? "" : "hidden"}>
        ${labels.map((l, i) => `<label>Bild ${i + 1} <input type="text" name="label${i}" value="${esc(l)}"></label>`).join("")}
      </div>
      ${isNew ? `<p class="hint">Mit Claude ausgefüllt: Die Bilder werden beim Anlegen übernommen. Sonst nach dem Anlegen hochladen.</p>` : `<div class="slots">${[1,2,3,4].map(p => slotHtml(e, p, labels[p - 1])).join("")}</div>`}
      ${!isNew && openSlots(e).length ? `<p><button type="button" class="ghost" id="importWm">Fehlende Bilder von Wikimedia übernehmen</button></p>
        <p class="hint">Sucht wie die Seite (Wikipedia-Titelbild, sonst Suchbegriffe unten) und speichert die Bilder mit Quellenangabe.
          Geänderte Suchbegriffe vorher speichern.</p>` : ""}

      <h3>Online-Ersatz (falls kein eigenes Bild hinterlegt ist)</h3>
      <label>Englischer Wikipedia-Artikel für das Hauptbild (leer = ${cat.latin ? "lateinischer Name" : "Name"})
        <input type="text" name="wp" value="${esc(e.wp)}"></label>
      <div class="row">${terms.map((t, i) => `<label>Suchbegriff Bild ${i + 2} <input type="text" name="q${i}" value="${esc(t)}"></label>`).join("")}</div>

      ${isNew ? "" : `<h3>Direktlink und QR-Code</h3>
      <div class="qr-box">${qrSvg(entryUrl(cat, e))}
        <p><a href="${esc(entryUrl(cat, e))}" target="_blank" rel="noopener">${esc(entryUrl(cat, e))}</a><br>
          <button type="button" class="ghost small" id="qrOne">QR-Code drucken</button>
          ${e.visible ? "" : `<br><span class="hint">Der Eintrag ist ausgeblendet: Der Link funktioniert erst, wenn er sichtbar ist.</span>`}</p>
      </div>`}

      <div class="actions">
        <button>${isNew ? "Anlegen" : "Speichern"}</button>
        ${isNew ? `<button type="button" class="ghost" id="cancelEntry">Abbrechen</button>`
          : `<button type="button" class="danger" id="delEntry">Eintrag löschen</button>`}
      </div>
    </form>`;

  const form = $("entryForm");
  const F = form.elements;
  const facts = $("facts");
  $("addFact").addEventListener("click", () => facts.insertAdjacentHTML("beforeend", factRow()));
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

  form.addEventListener("submit", async ev => {
    ev.preventDefault();
    const row = {
      category_id:cat.id,
      name:F.name.value.trim(), subtitle:F.subtitle.value.trim(), description:F.description.value.trim(),
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
    if(isNew){
      row.sort = cat.entries.length;
      if(aiFilled || aiPhoto){ await createEntryWithAi(form, cat, row); return; }
      const saved = await act(() => must(sb.from("entries").insert(row).select("id").single()), "Eintrag angelegt.");
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
    const thumb = slot.querySelector(".thumb img");
    if(thumb) applyFocus(thumb, img);
    slot.querySelector("[data-crop]")?.addEventListener("click", () => editCrop(cat, e, img));
    slot.querySelector("[data-focus]")?.addEventListener("click", () => editFocus(e, img));
    slot.querySelector("input[type=file]").addEventListener("change", ev => {
      const f = ev.target.files[0];
      if(!f) return;
      // Unveränderte Angaben gehören zum alten Bild: nicht übernehmen (sonst verlinkt der Bildnachweis das falsche Bild)
      const keep = (input, old) => input.value.trim() === (old || "") ? "" : input.value.trim();
      uploadImage(cat, e, p, f, img, keep(page, img?.source_page), keep(file, img?.source_file));
    });
    slot.querySelector("[data-delimg]")?.addEventListener("click", async () => {
      if(!confirm(`Bild ${p} entfernen?`)) return;
      await act(() => removeImage(e, img), "Bild entfernt.");
      render();
    });
    slot.querySelectorAll("[data-reportdone]").forEach(b => b.addEventListener("click", async () => {
      await act(() => clearReports(e, p), "Meldung erledigt.").catch(() => {});
      render();
    }));
    slot.querySelector("[data-slotempty]")?.addEventListener("click", async () => {
      await act(() => setEmptySlot(e, p, true), `Bildplatz ${p} bleibt leer.`).catch(() => {});
      render();
    });
    slot.querySelector("[data-slotfill]")?.addEventListener("click", async () => {
      await act(() => setEmptySlot(e, p, false), `Bildplatz ${p} darf wieder gefüllt werden.`).catch(() => {});
      render();
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
    slot.querySelector("[data-otherimg]")?.addEventListener("click", async ev => {
      ev.target.disabled = true;
      msg("Anderes Bild wird gesucht …");
      await act(() => replaceFromWikimedia(cat, e, p, img), "Anderes Bild gespeichert.").catch(() => {});
      render();
    });
  });

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
    <div class="thumb">${img ? `<img src="${esc(publicUrl(img.storage_path))}" alt="" loading="lazy">` : isEmptySlot(e, p) ? "bewusst leer<br>(wird nicht automatisch gefüllt)" : "kein eigenes Bild"}</div>
    <input type="file" accept="image/*" title="${img ? "Bild ersetzen" : "Bild hochladen"}">
    <label>Quelle (Commons-Dateiseite) <input type="url" name="page${p}" value="${esc(img?.source_page)}"></label>
    <label>Dateiname <input type="text" name="file${p}" value="${esc(img?.source_file)}"></label>
    <button type="button" class="ghost small" data-commons title="Commons-Adresse in «Quelle» einfügen, dann klicken: Bild wird heruntergeladen und gespeichert">Bild von dieser Quelle übernehmen</button>
    ${img && !img.source_page ? `<p class="hint">Ohne Quelle gilt das Bild im Bildnachweis als eigenes Foto. Quelle nachtragen und «Speichern».</p>` : ""}
    ${img ? "" : `<p class="hint">Bild von Commons: Adresse in «Quelle» einfügen und übernehmen. Eigenes Foto: Datei wählen.</p>`}
    ${img?.edited ? `<p class="hint">Zugeschnitten (steht so im Bildnachweis).</p>` : ""}
    ${img ? `<div class="slot-actions">
      <button type="button" class="ghost" data-crop title="Bild dauerhaft zuschneiden">Zuschneiden</button>
      <button type="button" class="ghost" data-focus title="Welcher Teil in der kleinen Vorschau (Karte, Übersicht) zu sehen ist">Ausschnitt Vorschau</button>
      <button type="button" class="ghost" data-otherimg title="Nächstes passendes Bild von Wikimedia Commons">Anderes Bild suchen</button>
      <button type="button" class="danger" data-delimg>Bild entfernen</button></div>`
    : isEmptySlot(e, p)
      ? `<button type="button" class="ghost small" data-slotfill title="«Fehlende Bilder übernehmen» darf diesen Platz wieder füllen">Wieder füllen lassen</button>`
      : `<button type="button" class="ghost small" data-slotempty title="«Fehlende Bilder übernehmen» lässt diesen Platz aus">Leer lassen</button>`}
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

// Vorhandenes Bild durch das nächste passende ersetzen
async function replaceFromWikimedia(cat, e, pos, old){
  if(old.source_file){
    if(!rejected.has(e.id)) rejected.set(e.id, new Set());
    rejected.get(e.id).add(old.source_file);
  }
  await importImage(cat, e, pos, usedFiles(e), old);
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
   ANSICHT WÄHLEN
------------------------------------------------------------------- */
function render(){
  renderSidebar();
  const r = route();
  const main = $("main");
  // Knopf «Übersicht» nur zeigen, wenn nicht schon die Übersicht offen ist
  $("toOverview").hidden = !(
    (r.type === "k" && (r.id === "neu" || findCat(r.id))) ||
    (r.type === "e" && ((r.id === "neu" && findCat(r.extra)) || findEntry(r.id))));
  if(r.type === "k" && r.id === "neu") return renderCategory(null);
  if(r.type === "k" && findCat(r.id)) return renderCategory(findCat(r.id));
  if(r.type === "e" && r.id === "neu" && findCat(r.extra)) return renderEntry(findCat(r.extra), null);
  if(r.type === "e" && findEntry(r.id)){ const { cat, entry } = findEntry(r.id); return renderEntry(cat, entry); }
  const total = cats.reduce((s, c) => s + c.entries.length, 0);
  const todo = cats.flatMap(c => c.entries.filter(e => openSlots(e).length).map(e => ({ cat:c, e })));
  const missing = todo.reduce((s, t) => s + openSlots(t.e).length, 0);
  const empty = cats.reduce((s, c) => s + c.entries.reduce((n, e) => n + (e.empty_slots || []).length, 0), 0);
  const reported = reports.map(r => {
    const f = findEntry(r.entry_id);
    return f && { r, cat:f.cat, e:f.entry, img:f.entry.images.find(i => i.position === r.position) };
  }).filter(Boolean);
  main.innerHTML = `<h2>Übersicht</h2>
    ${schemaMissing() ? `<p class="warn"><b>Datenbank-Update fehlt:</b> Die Datenbank ist auf Version ${dbSchema || "14 oder älter"},
      diese Website braucht Version ${VERSION.schema}. Im Supabase-Dashboard unter «SQL Editor» die fehlenden Dateien
      bis <code>supabase/${String(VERSION.schema).padStart(3, "0")}_…</code> der Reihe nach ausführen.</p>` : ""}
    <p>${cats.length} Kategorien, ${total} Einträge.</p>
    <p class="hint">Links eine Kategorie wählen oder eine neue anlegen.</p>
    <h3>Gemeldete Bilder${reported.length ? ` (${reported.length})` : ""}</h3>
    ${reported.length ? `<p class="hint">Besucherinnen und Besucher können in der Grossansicht ein unpassendes Bild melden.
      Ein neues Bild an diesem Platz oder «Bild entfernen» erledigt die Meldung automatisch.</p>
      <div class="reports">${reported.map(({ r, cat, e, img }, i) => `<div class="report-row">
        <div class="thumb">${img ? `<img data-ri="${i}" src="${esc(publicUrl(img.storage_path))}" alt="" loading="lazy">` : "kein eigenes Bild"}</div>
        <div>
          <b><a href="#/e/${esc(e.id)}">${esc(e.name)}</a></b> <small>(${esc(cat.name)})</small><br>
          Bild ${r.position} · ${esc((e.labels || cat.labels)[r.position - 1])}${img ? "" : " (Online-Ersatz von Wikimedia)"}
          ${reportStale(e, r) ? `<br><span class="hint">Inzwischen steht dort ein anderes Bild.</span>` : ""}
          <p class="hint">${esc(reportText(r))}</p>
          <div class="slot-actions">
            ${img ? `<button type="button" class="ghost small" data-rother="${r.id}" title="Nächstes passendes Bild von Wikimedia Commons">Anderes Bild suchen</button>` : ""}
            <button type="button" class="ghost small" data-rdone="${r.id}">Erledigt</button>
          </div>
        </div></div>`).join("")}</div>`
    : `<p class="hint">Keine offenen Meldungen. Besucherinnen und Besucher können in der Grossansicht mit «Melden» auf ein unpassendes Bild hinweisen.</p>`}
    <h3>Eigene Bilder</h3>
    ${todo.length || bulk ? `
      <p>Bei ${todo.length} ${todo.length === 1 ? "Eintrag" : "Einträgen"} ${missing === 1 ? "fehlt 1 Bild" : `fehlen insgesamt ${missing} Bilder`}.</p>
      <button id="importAll" ${bulk ? "disabled" : ""}>Fehlende Bilder von Wikimedia übernehmen</button>
      <p class="hint" id="importMsg">Die Bilder werden nacheinander gesucht, verkleinert und gespeichert. Das dauert einige Minuten; die Seite dabei offen lassen.</p>`
    : `<p class="hint">Es fehlen keine Bilder.</p>`}
    ${empty ? `<p class="hint">${empty === 1 ? "1 Bildplatz ist" : `${empty} Bildplätze sind`} bewusst leer und ${empty === 1 ? "wird" : "werden"} nicht gefüllt
      (im Eintrag mit «Wieder füllen lassen» änderbar).</p>` : ""}
    ${bulkResult && !bulk ? `<p class="hint">${esc(bulkResult)}</p>` : ""}
    <h3>Bilder aus Liste übernehmen</h3>
    <p class="hint">Mehrere Bilder oder Tierstimmen auf einmal von Commons übernehmen oder entfernen. Eine Zeile pro Bild:
      <code>Eintrag | Bildnummer | Commons-Adresse</code> oder <code>Eintrag | Bildnummer | entfernen</code>;
      für eine Tierstimme <code>Eintrag | ton | Commons-Adresse</code> bzw. <code>… | ton | entfernen</code>
      (statt «|» geht auch ein Tabulator oder «;»).</p>
    <textarea id="batchList" placeholder="Steinmarder | 2 | https://commons.wikimedia.org/wiki/File:…"></textarea>
    <p><button type="button" class="ghost" id="batchCheck">Liste prüfen</button></p>
    <div id="batchResult"></div>
    <h3>Sicherung</h3>
    <p class="hint">Lädt alle Kategorien, Einträge und Bildangaben als Datei herunter (JSON). Die Bild- und Tondateien selbst
      liegen im Supabase-Speicher, ihre Quellen auf Wikimedia Commons. Am besten regelmässig und vor grossen Änderungen sichern.</p>
    <p><button type="button" class="ghost" id="backupBtn">Sicherung herunterladen</button></p>
    <h3>Version</h3>
    <p class="hint">Website ${esc(VERSION.app)} vom ${new Date(VERSION.datum + "T00:00").toLocaleDateString("de-CH", { day:"numeric", month:"long", year:"numeric" })}
      · Datenbank ${dbSchema === 0 ? "14 oder älter" : dbSchema ?? "?"}
      (benötigt ${VERSION.schema}) · Verlauf der Versionen: GitHub → Tags</p>`;
  showBulk();
  main.querySelectorAll("[data-ri]").forEach(el => applyFocus(el, reported[+el.dataset.ri].img));
  main.querySelectorAll("[data-rdone]").forEach(b => b.addEventListener("click", async () => {
    const { e, r } = reported.find(x => x.r.id === +b.dataset.rdone);
    await act(() => clearReports(e, r.position), "Meldung erledigt.").catch(() => {});
    render();
  }));
  main.querySelectorAll("[data-rother]").forEach(b => b.addEventListener("click", async () => {
    const { cat, e, img } = reported.find(x => x.r.id === +b.dataset.rother);
    b.disabled = true;
    msg("Anderes Bild wird gesucht …");
    await act(() => replaceFromWikimedia(cat, e, img.position, img), "Anderes Bild gespeichert, Meldung erledigt.").catch(() => {});
    render();
  }));
  $("importAll")?.addEventListener("click", ev => { ev.target.disabled = true; importAll(todo); });
  setupBatch();
  $("backupBtn").addEventListener("click", async ev => {
    ev.target.disabled = true;
    try{
      const n = await downloadBackup();
      msg(`Sicherung erstellt: ${n.categories} Kategorien, ${n.entries} Einträge, ${n.images} Bilder.`);
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

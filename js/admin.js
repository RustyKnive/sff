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

async function reload(){
  cats = await must(sb.from("categories")
    .select("*, entries!entries_category_id_fkey(*, images(*))")
    .order("sort").order("name")
    .order("sort", { referencedTable:"entries" }).order("name", { referencedTable:"entries" }));
  renderSidebar();
}
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

// Bild verkleinern (längste Seite max. 1600 px) und als JPEG zurückgeben
function resizeImage(file, max = 1600){
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const f = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * f); c.height = Math.round(img.height * f);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(b => b ? res(b) : rej(new Error("Bild konnte nicht umgewandelt werden")), "image/jpeg", .85);
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
  const m = String(page).match(/\/wiki\/File:([^?#]+)/);
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

/* ------------------------------------------------------------------
   KATEGORIE BEARBEITEN
------------------------------------------------------------------- */
function renderCategory(cat){
  const isNew = !cat;
  const c = cat || { id:"", name:"", description:"", latin:false, visible:true, labels:DEFAULT_LABELS, cover_entry_id:null, entries:[] };
  const main = $("main");
  const n = c.entries.length;
  main.innerHTML = `
    <h2>${isNew ? "Neue Kategorie" : "Kategorie: " + esc(c.name)}</h2>
    <form id="catForm">
      <div class="row">
        <label>Name <input type="text" name="name" required value="${esc(c.name)}"></label>
        <label>ID (für die Adresse #/…) <input type="text" name="id" required pattern="[a-z0-9]+(-[a-z0-9]+)*" value="${esc(c.id)}"></label>
      </div>
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
        ${isNew ? "" : `<button type="button" class="danger" id="delCat">Kategorie löschen</button>`}
      </div>
    </form>
    ${isNew ? "" : `
    <h3>Einträge (${n})</h3>
    ${n !== 9 ? `<p class="hint warn">Für das 3×3-Raster sind 9 Einträge vorgesehen.</p>` : ""}
    <ul class="list" id="entryList">
      ${c.entries.map((e, i) => `
      <li class="${e.visible ? "" : "off"}">
        <input type="checkbox" data-vis="${e.id}" ${e.visible ? "checked" : ""} title="Auf der Seite sichtbar">
        <a href="#/e/${e.id}">${esc(e.name)} <small>${esc(e.subtitle)} · ${e.images.length}/4 Bilder</small></a>
        <button class="icon" data-move="${i}" data-dir="-1" title="Nach oben" ${i ? "" : "disabled"}>↑</button>
        <button class="icon" data-move="${i}" data-dir="1" title="Nach unten" ${i < n - 1 ? "" : "disabled"}>↓</button>
      </li>`).join("")}
    </ul>
    <button class="ghost" id="newEntry">+ Neuer Eintrag</button>`}`;

  const form = $("catForm");
  const F = form.elements;
  // ID beim Anlegen aus dem Namen vorschlagen
  if(isNew) F.name.addEventListener("input", () => { F.id.value = slug(F.name.value); });

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const row = {
      id:F.id.value.trim(), name:F.name.value.trim(), description:F.description.value.trim(),
      latin:F.latin.checked, visible:F.visible.checked, labels:[0,1,2,3].map(i => F["label" + i].value.trim())
    };
    if(isNew){
      row.sort = cats.length;
      await act(() => must(sb.from("categories").insert(row)), "Kategorie angelegt.");
    }else{
      row.cover_entry_id = F.cover.value || null;
      await act(() => must(sb.from("categories").update(row).eq("id", c.id)), "Gespeichert.");
    }
    if(location.hash !== "#/k/" + row.id) location.hash = "#/k/" + row.id; else render();
  });

  if(isNew) return;
  $("delCat").addEventListener("click", async () => {
    if(!confirm(`Kategorie «${c.name}» mit allen ${n} Einträgen und Bildern endgültig löschen?`)) return;
    const paths = c.entries.flatMap(e => e.images.map(i => i.storage_path));
    await act(async () => {
      await must(sb.from("categories").delete().eq("id", c.id));
      if(paths.length) await must(sb.storage.from(CFG.bucket).remove(paths));
    }, "Kategorie gelöscht.");
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

function renderEntry(cat, entry){
  const isNew = !entry;
  const e = entry || { name:"", subtitle:"", description:"", visible:true, facts:[], search_terms:["","",""], wp:"", labels:null, images:[] };
  const labels = e.labels || cat.labels;
  const terms = [0,1,2].map(i => e.search_terms[i] || "");
  const main = $("main");
  main.innerHTML = `
    <p class="hint"><a href="#/k/${esc(cat.id)}">← ${esc(cat.name)}</a></p>
    <h2>${isNew ? "Neuer Eintrag" : esc(e.name)}</h2>
    <form id="entryForm">
      <div class="row">
        <label>Name <input type="text" name="name" required value="${esc(e.name)}"></label>
        <label>${cat.latin ? "Lateinischer Name" : "Untertitel (Ort, Gesteinsart …)"} <input type="text" name="subtitle" value="${esc(e.subtitle)}"></label>
      </div>
      <label class="inline"><input type="checkbox" name="visible" ${e.visible ? "checked" : ""}> Eintrag auf der Seite sichtbar</label>
      <label>Beschreibung <textarea name="description">${esc(e.description)}</textarea></label>
      <p class="hint">3–4 Sätze, sachlich und für Sek I verständlich. Schweizer Rechtschreibung: immer «ss», nie Eszett.</p>

      <h3>Steckbrief</h3>
      <div class="facts" id="facts">${e.facts.map(f => factRow(f.k, f.v)).join("")}</div>
      <button type="button" class="ghost" id="addFact">+ Zeile</button>

      <h3>Bilder</h3>
      <label class="inline"><input type="checkbox" name="ownLabels" ${e.labels ? "checked" : ""}> Eigene Bildbeschriftungen statt «${esc(cat.labels.join(", "))}»</label>
      <div class="row" id="labelRow" ${e.labels ? "" : "hidden"}>
        ${labels.map((l, i) => `<label>Bild ${i + 1} <input type="text" name="label${i}" value="${esc(l)}"></label>`).join("")}
      </div>
      ${isNew ? `<p class="hint">Bilder können nach dem Anlegen hochgeladen werden.</p>` : `<div class="slots">${[1,2,3,4].map(p => slotHtml(e, p, labels[p - 1])).join("")}</div>`}

      <h3>Online-Ersatz (falls kein eigenes Bild hinterlegt ist)</h3>
      <label>Englischer Wikipedia-Artikel für das Hauptbild (leer = ${cat.latin ? "lateinischer Name" : "Name"})
        <input type="text" name="wp" value="${esc(e.wp)}"></label>
      <div class="row">${terms.map((t, i) => `<label>Suchbegriff Bild ${i + 2} <input type="text" name="q${i}" value="${esc(t)}"></label>`).join("")}</div>

      <div class="actions">
        <button>${isNew ? "Anlegen" : "Speichern"}</button>
        ${isNew ? "" : `<button type="button" class="danger" id="delEntry">Eintrag löschen</button>`}
      </div>
    </form>`;

  const form = $("entryForm");
  const F = form.elements;
  const facts = $("facts");
  $("addFact").addEventListener("click", () => facts.insertAdjacentHTML("beforeend", factRow()));
  facts.addEventListener("click", ev => { if(ev.target.closest("[data-delfact]")) ev.target.closest(".fact").remove(); });
  F.ownLabels.addEventListener("change", () => { $("labelRow").hidden = !F.ownLabels.checked; });

  form.addEventListener("submit", async ev => {
    ev.preventDefault();
    const row = {
      category_id:cat.id,
      name:F.name.value.trim(), subtitle:F.subtitle.value.trim(), description:F.description.value.trim(),
      visible:F.visible.checked,
      facts:[...facts.querySelectorAll(".fact")]
        .map(f => ({ k:f.querySelector("[data-k]").value.trim(), v:f.querySelector("[data-v]").value.trim() }))
        .filter(f => f.k || f.v),
      search_terms:[0,1,2].map(i => F["q" + i].value.trim()).filter(Boolean),
      wp:F.wp.value.trim() || null,
      labels:F.ownLabels.checked ? [0,1,2,3].map(i => F["label" + i].value.trim()) : null
    };
    if(isNew){
      row.sort = cat.entries.length;
      const saved = await act(() => must(sb.from("entries").insert(row).select("id").single()), "Eintrag angelegt.");
      location.hash = "#/e/" + saved.id;
      return;
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
    }, "Gespeichert.");
    render();
  });

  if(isNew) return;
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
    slot.querySelector("input[type=file]").addEventListener("change", ev => {
      const f = ev.target.files[0];
      if(f) uploadImage(cat, e, p, f, img, page.value.trim(), file.value.trim());
    });
    slot.querySelector("[data-delimg]")?.addEventListener("click", async () => {
      if(!confirm(`Bild ${p} entfernen?`)) return;
      await act(async () => {
        await must(sb.from("images").delete().eq("entry_id", e.id).eq("position", p));
        await must(sb.storage.from(CFG.bucket).remove([img.storage_path]));
      }, "Bild entfernt.");
      render();
    });
  });
}

function slotHtml(e, p, label){
  const img = e.images.find(i => i.position === p);
  return `<div class="slot" data-pos="${p}">
    <strong>${p} · ${esc(label)}${p === 1 ? " (Hauptbild)" : ""}</strong>
    <div class="thumb">${img ? `<img src="${esc(publicUrl(img.storage_path))}" alt="" loading="lazy">` : "kein eigenes Bild<br>(wird online gesucht)"}</div>
    <input type="file" accept="image/*" title="${img ? "Bild ersetzen" : "Bild hochladen"}">
    <label>Quelle (Commons-Dateiseite) <input type="url" name="page${p}" value="${esc(img?.source_page)}"></label>
    <label>Dateiname <input type="text" name="file${p}" value="${esc(img?.source_file)}"></label>
    ${img ? `<button type="button" class="danger" data-delimg>Bild entfernen</button>` : ""}
  </div>`;
}

async function uploadImage(cat, entry, pos, file, old, page, fileName){
  msg("Bild wird hochgeladen …");
  // Immer ein neuer Dateiname: so zeigt kein Zwischenspeicher (CDN, Browser) das alte Bild
  const path = `${cat.id}/${entry.id}-${pos}-${Date.now()}.jpg`;
  await act(async () => {
    page = sourceUrl(page);
    const blob = await resizeImage(file);
    await must(sb.storage.from(CFG.bucket).upload(path, blob, { contentType:"image/jpeg" }));
    await must(sb.from("images").upsert({
      entry_id:entry.id, position:pos, storage_path:path, source_page:page || null, source_file:fileName || null
    }));
    if(old && old.storage_path !== path) await sb.storage.from(CFG.bucket).remove([old.storage_path]);
  }, "Bild gespeichert.");
  render();
}

/* ------------------------------------------------------------------
   ANSICHT WÄHLEN
------------------------------------------------------------------- */
function render(){
  renderSidebar();
  const r = route();
  const main = $("main");
  if(r.type === "k" && r.id === "neu") return renderCategory(null);
  if(r.type === "k" && findCat(r.id)) return renderCategory(findCat(r.id));
  if(r.type === "e" && r.id === "neu" && findCat(r.extra)) return renderEntry(findCat(r.extra), null);
  if(r.type === "e" && findEntry(r.id)){ const { cat, entry } = findEntry(r.id); return renderEntry(cat, entry); }
  const total = cats.reduce((s, c) => s + c.entries.length, 0);
  main.innerHTML = `<h2>Übersicht</h2>
    <p>${cats.length} Kategorien, ${total} Einträge.</p>
    <p class="hint">Links eine Kategorie wählen oder eine neue anlegen.</p>`;
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
    await reload();
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

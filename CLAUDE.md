# Natur und Schweiz (sff)

Lern- und Nachschlageseite für die Schule (Sek I). Sie zeigt Kategorien (z. B. Bäume, Amphibien) mit Einträgen.
Jeder Eintrag hat 4 Bilder und einen Steckbrief.
Daten und Bilder liegen in **Supabase** (Postgres und Storage). Es gibt keinen Build: Jede Seite besteht aus einer HTML-Datei mit eigenem Skript in `js/` und Stil in `css/`.

## Ordnerstruktur

- `index.html` Anzeige, `admin.html` Verwaltung, `config.js` Verbindung zu Supabase
- `js/index.js`, `js/admin.js` Skripte der Seiten; `js/wikimedia.js` Bildsuche (von beiden genutzt); `js/lib/` supabase-js (fest eingebundene Version)
- `css/basis.css` gemeinsame Farben und Grundlagen, `css/index.css`, `css/admin.css` pro Seite
- `sw.js`, `manifest.webmanifest`, `icons/` Offline-App (siehe unten)
- `supabase/` Datenbankschema und nummerierte Änderungen

Die alten lokalen Bilder (`bilder/`) und das Migrationswerkzeug (`tools/`) wurden nach der Migration entfernt (in der Git-Geschichte noch vorhanden).

## Datenmodell (supabase/schema.sql)

- `categories`: `id` (Slug, gleichzeitig die Adresse `#/<id>`), `name`, `description`, `latin` (true → Untertitel kursiv als lateinischer Name), `labels` (4 Bildbeschriftungen), `cover_entry_id` (Eintrag für die Übersichtskachel), `sort`.
- `entries`: `category_id`, `name`, `subtitle`, `description`, `facts` (jsonb-Array `[{k, v}]`, damit die Reihenfolge erhalten bleibt), `search_terms` (Suchbegriffe für Bilder 2–4), `wp` (englischer Wikipedia-Titel für das Hauptbild), `labels` (optional eigene 4 Beschriftungen), `sort`.
- `images`: `(entry_id, position 1–4)`, `storage_path` im Bucket `bilder`, `source_page`/`source_file` (für die Lizenzangabe, Knopf «Quelle»), `thumb_x`/`thumb_y`/`thumb_zoom` (Ausschnitt der Vorschau, siehe Verwaltung), `edited` (zugeschnitten). Position 1 ist das Hauptbild.
- `admins`: `user_id`. Nur wer hier eingetragen ist, darf schreiben (`is_admin()`). Alle dürfen lesen.
- `visible` (bei `categories` und `entries`): Ausgeblendete Zeilen filtert die RLS-Regel «lesen» (`visible or is_admin()`) heraus. `index.html` filtert deshalb nicht selbst. Die Kontrollkästchen stehen im Admin in beiden Listen und in den Formularen.
- Änderungen am Schema kommen als nummerierte Datei in `supabase/` (z. B. `002_sichtbar.sql`) und werden zusätzlich in `schema.sql` nachgeführt.
- Neue Uploads aus dem Admin bekommen immer einen neuen Pfad (`<kat>/<entry-id>-<pos>-<zeit>.jpg`), damit kein Cache das alte Bild zeigt. Die alte Datei wird gelöscht.

## Bilder laden

1. Karte und Lightbox zeigen nur die eigenen Bilder eines Eintrags (`shownSlots()` in `js/index.js`): Hat er 3, gibt es 3 Bildseiten und 3 Punkte, dann die Textseite. Die Beschriftung bleibt die des Bildplatzes (`data-k`). Die Übersichtskachel nimmt Bild 1, sonst das erste vorhandene.
2. Hat ein Eintrag gar kein eigenes Bild, oder lässt sich ein eigenes nicht laden, wird online gesucht (Fallback):
   - Hauptbild: Titelbild des englischen Wikipedia-Artikels `wp` bzw. des lateinischen Namens.
   - Bilder 2–4: Suche auf Wikimedia Commons mit `q[i] filetype:bitmap`, bei Bedarf mit gekürzten Suchbegriffen. Innerhalb eines Eintrags erscheint kein Bild doppelt.
3. Wikimedia bremst zu viele Anfragen (HTTP 429), eine ganze Schulklasse hinter einer Adresse erst recht. Darum gibt es `limiter` (3 API-Anfragen, 4 Downloads gleichzeitig) und `retry` (in `js/wikimedia.js`). Bilder 2–4 werden erst beim ersten Darüberfahren geladen.
4. Der Online-Fallback ist nur eine Notlösung: Jeder Eintrag soll 4 eigene Bilder haben (schnell, offline verfügbar). Dafür gibt es in der Verwaltung «Fehlende Bilder von Wikimedia übernehmen».

## Lightbox (index.html)

Klick auf ein Bild oder den Text einer Karte (oder Enter) öffnet ein bildschirmfüllendes `<dialog>` mit denselben 5 Seiten, auf der gerade gezeigten Seite. Karte und Lightbox teilen `slidesHtml()`, `controlsHtml()` und `carousel()`; die Bilder lädt auch hier `fillSlide()`. Schliessen mit ×, Esc oder Browser-Zurück (ein eigener Verlaufseintrag per `history.pushState`, darum bleibt man in der Kategorie), blättern mit Pfeilen, Punkten, Pfeiltasten oder Wischen. Auf schmalen Bildschirmen stehen die Pfeile unten.
Zoomen (`zoomTo()`, `panBy()`): Mausrad, Doppelklick bzw. doppelt tippen (2,5-fach ↔ normal), zwei Finger, Tasten `+`/`-`/`0`; höchstens 5-fach. Vergrössert verschiebt Ziehen das Bild (ohne leeren Rand), Wischen blättert nur ungezoomt. Das Bild bekommt `translate(...) scale(...)` mit `transform-origin:0 0`; Bildseiten haben `touch-action:none`, damit der Browser die Gesten nicht selbst übernimmt. Blättern und Schliessen setzen den Zoom zurück.

## Menü (index.html)

Knopf oben rechts, klappt eine Liste auf (schliesst mit Klick daneben oder Esc):
- «LernApp»: noch ohne Funktion (grau, «bald»).
- «PDF drucken» (`#/pdf`): Kategorie wählen, «PDF erstellen» öffnet den Druckdialog (Ziel «Als PDF speichern»). Kein PDF-Werkzeug, nur Druck-CSS (`@media print` in `css/index.css`): A4, Rand 5 mm, 8 Einträge pro Seite (2 × 4, 2 mm weisser Abstand), Hauptbild (mit Ausschnitt der Vorschau) und Name, Untertitel, Beschreibung, Steckbrief klein darüber; am Schluss der Bildnachweis. `printCategory()` füllt `#print` (am Bildschirm unsichtbar), wartet auf alle Bilder, setzt `document.title` (= Dateiname) und leert alles nach `afterprint`.
- «Einstellungen» (`#/einstellungen`): Bilder für offline herunterladen.
- «Admin»: Link auf `admin.html`.
- «Copyright» (`#/copyright`): Urheberrecht und Bildnachweis (alle eigenen Bilder mit Link auf `source_page`).
Die Seiten stehen als `<section class="page" id="page-…">` in `index.html` und in `PAGES` in `js/index.js`. Ihre Adressen gehen vor Kategorien mit gleicher `id`; solche Slugs (`pdf`, `einstellungen`, `copyright`) darum nicht vergeben.

## Verwaltung (admin.html)

- Anmeldung mit E-Mail, Passwort und Code aus einer Authenticator-App (TOTP). Beim ersten Anmelden zeigt die Verwaltung einen QR-Code zum Einrichten. Das Konto muss in `admins` stehen.
- `is_admin()` gilt nur mit zweitem Faktor (`aal2`, siehe `004_mfa.sql`). Handy verloren: im Dashboard unter Authentication → Users → Konto den MFA-Faktor löschen, dann beim nächsten Anmelden neu einrichten.
- Adressen: `#/k/<id>` Kategorie, `#/k/neu`, `#/e/<entry-id>` Eintrag, `#/e/neu/<kat-id>`.
- Nach jeder Änderung lädt `reload()` alle Daten neu. Die Datenmenge ist klein, das ist gewollt einfach.
- Hochgeladene Bilder werden im Browser auf höchstens 1600 px verkleinert (JPEG, Qualität 0.85).
- Eintrag verschieben: Auswahl «Kategorie» im Eintrag ändern und speichern (mit Rückfrage). Er kommt ans Ende der Zielkategorie; unterscheiden sich die Bildbeschriftungen, behält er die alten als eigene (`labels`). War er Titelbild der alten Kategorie, wird `cover_entry_id` dort geleert. Die Bilddateien bleiben unter ihrem Pfad (`<alte-kat>/…`); das stört nicht.
- «Fehlende Bilder von Wikimedia übernehmen» (Übersicht: alle Einträge; im Eintrag: nur dieser) sucht wie die Anzeige, lädt herunter, verkleinert und speichert mit `source_page`/`source_file`. «Anderes Bild suchen» ersetzt ein Bild durch den nächsten Treffer; verworfene Dateien merkt sich die Seite bis zum Neuladen.
- Pro Bild öffnen zwei Knöpfe den Dialog `#editor`:
  - «Zuschneiden»: Rahmen aufziehen (frei oder festes Seitenverhältnis), das Bild wird per canvas zugeschnitten und wie ein Ersatz gespeichert (neuer Pfad, JPEG 0.9, Quelle bleibt).
  - «Ausschnitt Vorschau»: Bild im 4:3-Rahmen verschieben und vergrössern. Gespeichert in `thumb_x`/`thumb_y` (Punkt in %, wie `object-position`) und `thumb_zoom` (1–4), `null` = Mitte. Die Anzeige setzt daraus die CSS-Variablen `--fx`, `--fy`, `--z` (`setFocus` in `js/index.js`, `applyFocus` in `js/admin.js`); Karten, Übersichtskachel und die Vorschau im Admin werten sie gleich aus, die Lightbox nicht.
  - Jedes neue Bild (`storeImage`) setzt den Ausschnitt zurück.
- Bildnachweis (Menü → Copyright) entsteht automatisch aus `images`: mit `source_page` ein Link, ohne Quelle «eigenes Foto». Zuschneiden setzt `edited = true` (011), der Nachweis zeigt dann «(zugeschnitten)», weil CC BY / BY-SA 4.0 einen Hinweis auf Änderungen verlangen. Ein neues Bild setzt `edited` wieder auf false.
- Hochladen von Hand: Unveränderte Felder «Quelle»/«Dateiname» gehören zum alten Bild und werden nicht übernommen (neues Bild ohne Quelle = eigenes Foto, Quelle lässt sich nachtragen).
- Die Anzeige lädt die Daten neu (`refresh()` in `js/index.js`), wenn man auf die Seite zurückkehrt (`visibilitychange`) und beim Öffnen des Bildnachweises. So zeigen ein offener Tab und die installierte App Änderungen aus der Verwaltung ohne Neuladen.

## Offline-App (PWA)

Die Anzeige lässt sich installieren (Startbildschirm) und funktioniert ohne Internet. Die Datenquelle deshalb nur über `loadCats()` ansprechen.
- `sw.js` (Service Worker): Seite und `loadCats()`-Antwort «Netz zuerst» (nach 4 s oder ohne Netz der gespeicherte Stand), Storage-Bilder «Speicher zuerst» im Cache `sff-bilder`. Wikimedia-Fallback wird nicht gespeichert.
- Anfragen mit `Authorization` (Verwaltung, supabase-js) und `admin.html` laufen nie über den Speicher, damit keine Admin-Daten im Cache landen.
- Neue Datei für die Anzeige (JS, CSS, Symbol): in `FILES` in `sw.js` eintragen und `APP` (z. B. `sff-app-v2`) erhöhen.
- Knopf «Alle Bilder herunterladen» unter Menü → Einstellungen: lädt alle eigenen Bilder in `sff-bilder` und entfernt dort ersetzte oder gelöschte.
- `manifest.webmanifest` und `icons/` (Steinbock, Vorlage `steinbock.svg`; PNG 512 per headless Chrome, 192/180 daraus verkleinert). Neues Symbol immer unter neuem Dateinamen, sonst zeigen Browser das alte weiter.

## Neue Kategorie mit Claude (admin.html → «+ Neue Kategorie»)

Ohne Claude-API und ohne zusätzliche Kosten: Der Auftrag wird über claude.ai (Abo) erledigt, per Kopieren und Einfügen.
1. Name und Anzahl Einträge eingeben, «Auftrag für Claude kopieren» (`aiPrompt()` in `js/admin.js`). Der Auftrag enthält alle bestehenden Kategorie- und Eintragsnamen (gegen Doppelte), die Konventionen und einen Beispiel-Eintrag (Buche) samt JSON-Format.
2. Auf claude.ai einfügen. Claude prüft die Kategorie und antwortet mit einem JSON-Codeblock: `passt`, `pruefung`, `name`, `description`, `latin`, `labels`, `entries` (mit Beschreibung, Steckbrief, Suchbegriffen, `wp`).
3. Antwort einfügen, «Antwort übernehmen» (`aiParse()`: nimmt das JSON zwischen erster «{» und letzter «}», ersetzt Eszett durch «ss», begrenzt Längen). Die Angaben landen im Formular, die Einträge als Liste zum Abwählen und Korrigieren.
4. «Anlegen mit N Einträgen» (`createWithAi()`): Kategorie mit `visible = false`, Einträge, danach Bilder mit `importMissing`. Das Ergebnis steht oben auf der Kategorieseite. Einblenden erst nach dem Durchsehen.
- Abbrechen: vor dem Anlegen «Abbrechen» neben «Anlegen» (nichts gespeichert, zurück zur Übersicht). Während des Anlegens «Abbrechen und alles löschen»: wirkt nach dem Eintrag, der gerade Bilder lädt, und entfernt die Kategorie mit Einträgen und Bilddateien (`deleteCategory()`, gleich wie «Kategorie löschen»).
- Stil und Konventionen des Auftrags in `aiPrompt()` gleich halten wie hier unter «Konventionen».

## Neuer Eintrag mit Claude (Kategorie → «+ Neuer Eintrag»)

Ebenfalls ohne API über claude.ai. Oben im Formular «Mit Claude ausfüllen», wahlweise:
- **über den Namen:** Name eintragen, «Auftrag kopieren» (`aiEntryPrompt()`), auf claude.ai einfügen und senden.
- **über ein Foto:** Foto wählen (Vorschau), «Auftrag kopieren» und auf claude.ai einfügen, dann «Foto kopieren» (PNG über `navigator.clipboard.write`, max. 1600 px) und im selben Chat einfügen oder das Foto in den Chat ziehen. Claude bestimmt die Art und sagt in `pruefung`, wie sicher.
Die Antwort (`{passt, pruefung, entry}`, gelesen mit `aiParseEntry()`) füllt das normale Formular. Dort prüfen und ändern, dann «Anlegen» oder «Abbrechen» (nichts gespeichert, zurück zur Kategorie).
«Anlegen» (`createEntryWithAi()`): Eintrag speichern, das Foto wird Bild 1 (ohne Quelle, also «eigenes Foto»), die übrigen Bilder von Wikimedia. Der Bericht steht oben auf der Eintragsseite.
- Auftrag für Kategorie und Eintrag teilen `AI_INTRO`, `AI_RULES`, `AI_ENTRY_TASK`, `AI_EXAMPLE`, `aiJson()` und `aiEntry()` in `js/admin.js`.

## Konventionen

- Sprache Deutsch, **Schweizer Rechtschreibung: nie «ß», immer «ss»** (auch im Code und in Kommentaren).
- Texte sachlich und für Sek I verständlich: 3–4 Sätze Beschreibung, 3–4 Steckbrief-Zeilen.
- Die Anzahl Einträge pro Kategorie ist frei (auf dem Handy steht ohnehin eine Karte pro Zeile). Richtwert 3 Suchbegriffe pro Eintrag.
- Farben nur über die CSS-Variablen in `:root`. Der Dunkelmodus läuft über `prefers-color-scheme`.
- Die Anzeige (`index.html`) bleibt ohne Bibliotheken. supabase-js nur im Admin.
- In `config.js` nur den öffentlichen Schlüssel eintragen, nie den Service-Key.
- Kein eingebetteter Code: kein `<script>` mit Inhalt, kein `<style>`, keine `style="…"`- oder `on…="…"`-Attribute. Die Content-Security-Policy (`<meta>` in beiden HTML-Dateien) erlaubt nur eigene Dateien und blockiert alles andere. Neue externe Quellen (anderes Supabase-Projekt, weitere Bild-Server) dort eintragen. Wikimedia liefert Bilder von `upload.wikimedia.org` und `thumb.wikimedia.org`; beide stehen in der CSP.
- supabase-js liegt als Datei in `js/lib/` (Version im Dateinamen). Zum Aktualisieren die neue `dist/umd/supabase.min.js` von jsDelivr herunterladen und den Pfad in `admin.html` anpassen.
- Links aus Daten (z. B. «Quelle») nur mit `http(s)://` verwenden; die Datenbank prüft das zusätzlich.

## Prüfen

- Syntax: Es gibt kein Node. Die Dateien in `js/` mit `new Function(...)` in einer Prüfseite parsen oder die Seite über einen lokalen Webserver mit headless Chrome (`--dump-dom`) öffnen; CSP-Verstösse erscheinen im Log.
- Kein «ß»: `grep -rc "ß" *.html js/*.js css` muss überall 0 ergeben.
- Headless Chrome mit `--virtual-time-budget` lässt CSS-Übergänge (z. B. das Blättern) nicht weiterlaufen: Für Screenshots im Testskript `track.style.transition = "none"` setzen. Fenster schmaler als etwa 500 px schneidet headless Chrome ab. Auch das `close`-Event von `<dialog>` feuert unter virtueller Zeit nicht; Abläufe mit Verlauf/Dialog darum in echter Zeit testen (headless mit `--remote-debugging-port`, Ergebnis per DevTools `Runtime.evaluate` auslesen, danach nur diesen Prozess beenden).
- `index.html` im Browser öffnen, eine Kategorie durchklicken. Im Admin einen Eintrag bearbeiten und ein Bild ersetzen.

# Natur und Schweiz (sff)

Lern- und Nachschlageseite für die Schule (Sek I). Sie zeigt Kategorien (z. B. Bäume, Amphibien) mit Einträgen.
Jeder Eintrag hat 4 Bilder und einen Steckbrief.
Daten und Bilder liegen in **Supabase** (Postgres und Storage). Es gibt keinen Build: Jede Seite besteht aus einer HTML-Datei mit eigenem Skript in `js/` und Stil in `css/`.

## Ordnerstruktur

- `index.html` Anzeige, `admin.html` Verwaltung, `config.js` Verbindung zu Supabase
- `js/index.js`, `js/admin.js` Skripte der Seiten; `js/lib/` supabase-js (fest eingebundene Version)
- `css/basis.css` gemeinsame Farben und Grundlagen, `css/index.css`, `css/admin.css` pro Seite
- `sw.js`, `manifest.webmanifest`, `icons/` Offline-App (siehe unten)
- `supabase/` Datenbankschema und nummerierte Änderungen

Die alten lokalen Bilder (`bilder/`) und das Migrationswerkzeug (`tools/`) wurden nach der Migration entfernt (in der Git-Geschichte noch vorhanden).

## Datenmodell (supabase/schema.sql)

- `categories`: `id` (Slug, gleichzeitig die Adresse `#/<id>`), `name`, `description`, `latin` (true → Untertitel kursiv als lateinischer Name), `labels` (4 Bildbeschriftungen), `cover_entry_id` (Eintrag für die Übersichtskachel), `sort`.
- `entries`: `category_id`, `name`, `subtitle`, `description`, `facts` (jsonb-Array `[{k, v}]`, damit die Reihenfolge erhalten bleibt), `search_terms` (Suchbegriffe für Bilder 2–4), `wp` (englischer Wikipedia-Titel für das Hauptbild), `labels` (optional eigene 4 Beschriftungen), `sort`.
- `images`: `(entry_id, position 1–4)`, `storage_path` im Bucket `bilder`, `source_page`/`source_file` (für die Lizenzangabe, Knopf «Quelle»). Position 1 ist das Hauptbild.
- `admins`: `user_id`. Nur wer hier eingetragen ist, darf schreiben (`is_admin()`). Alle dürfen lesen.
- `visible` (bei `categories` und `entries`): Ausgeblendete Zeilen filtert die RLS-Regel «lesen» (`visible or is_admin()`) heraus. `index.html` filtert deshalb nicht selbst. Die Kontrollkästchen stehen im Admin in beiden Listen und in den Formularen.
- Änderungen am Schema kommen als nummerierte Datei in `supabase/` (z. B. `002_sichtbar.sql`) und werden zusätzlich in `schema.sql` nachgeführt.
- Neue Uploads aus dem Admin bekommen immer einen neuen Pfad (`<kat>/<entry-id>-<pos>-<zeit>.jpg`), damit kein Cache das alte Bild zeigt. Die alte Datei wird gelöscht.

## Bilder laden

1. Hat ein Eintrag ein Bild in `images`, wird es aus Supabase Storage geladen.
2. Sonst oder bei einem Fehler wird es online gesucht (Fallback):
   - Hauptbild: Titelbild des englischen Wikipedia-Artikels `wp` bzw. des lateinischen Namens.
   - Bilder 2–4: Suche auf Wikimedia Commons mit `q[i] filetype:bitmap`, bei Bedarf mit gekürzten Suchbegriffen. Innerhalb eines Eintrags erscheint kein Bild doppelt.
3. Wikimedia bremst zu viele Anfragen (HTTP 429). Darum gibt es `limiter` (3 API-Anfragen, 4 Downloads gleichzeitig) und `retry`. Bilder 2–4 werden erst beim ersten Darüberfahren geladen.

## Verwaltung (admin.html)

- Anmeldung mit E-Mail, Passwort und Code aus einer Authenticator-App (TOTP). Beim ersten Anmelden zeigt die Verwaltung einen QR-Code zum Einrichten. Das Konto muss in `admins` stehen.
- `is_admin()` gilt nur mit zweitem Faktor (`aal2`, siehe `004_mfa.sql`). Handy verloren: im Dashboard unter Authentication → Users → Konto den MFA-Faktor löschen, dann beim nächsten Anmelden neu einrichten.
- Adressen: `#/k/<id>` Kategorie, `#/k/neu`, `#/e/<entry-id>` Eintrag, `#/e/neu/<kat-id>`.
- Nach jeder Änderung lädt `reload()` alle Daten neu. Die Datenmenge ist klein, das ist gewollt einfach.
- Hochgeladene Bilder werden im Browser auf höchstens 1600 px verkleinert (JPEG, Qualität 0.85).

## Offline-App (PWA)

Die Anzeige lässt sich installieren (Startbildschirm) und funktioniert ohne Internet. Die Datenquelle deshalb nur über `loadCats()` ansprechen.
- `sw.js` (Service Worker): Seite und `loadCats()`-Antwort «Netz zuerst» (nach 4 s oder ohne Netz der gespeicherte Stand), Storage-Bilder «Speicher zuerst» im Cache `sff-bilder`. Wikimedia-Fallback wird nicht gespeichert.
- Anfragen mit `Authorization` (Verwaltung, supabase-js) und `admin.html` laufen nie über den Speicher, damit keine Admin-Daten im Cache landen.
- Neue Datei für die Anzeige (JS, CSS, Symbol): in `FILES` in `sw.js` eintragen und `APP` (z. B. `sff-app-v2`) erhöhen.
- Knopf «Für offline speichern» in der Fusszeile: lädt alle eigenen Bilder in `sff-bilder` und entfernt dort ersetzte oder gelöschte.
- `manifest.webmanifest` und `icons/` (Steinbock, Vorlage `steinbock.svg`; PNG 512 per headless Chrome, 192/180 daraus verkleinert). Neues Symbol immer unter neuem Dateinamen, sonst zeigen Browser das alte weiter.

## Neuer Eintrag per Handyfoto (geplant)

Mit dem Handy eine Art fotografieren, zum Beispiel einen Baum. Claude erkennt die Art und sucht den Namen (deutsch und lateinisch) und 3 weitere Bilder.
Dazu schreibt Claude die Beschreibung und den Steckbrief (gemäss Konventionen) und legt den Eintrag automatisch in der Datenbank an. Das eigene Foto wird Bild 1.
- Der Claude-API-Schlüssel darf nicht in den Browser. Den Aufruf deshalb serverseitig machen, zum Beispiel mit einer Supabase Edge Function. Nur Admins dürfen sie aufrufen.
- Vor dem Speichern soll man den Vorschlag prüfen und korrigieren können, oder der Eintrag wird zuerst mit `visible = false` gespeichert.

## Konventionen

- Sprache Deutsch, **Schweizer Rechtschreibung: nie «ß», immer «ss»** (auch im Code und in Kommentaren).
- Texte sachlich und für Sek I verständlich: 3–4 Sätze Beschreibung, 3–4 Steckbrief-Zeilen.
- Richtwert 15 Einträge pro Kategorie (5 Reihen à 3) und 3 Suchbegriffe. Der Admin warnt, erzwingt es aber nicht.
- Farben nur über die CSS-Variablen in `:root`. Der Dunkelmodus läuft über `prefers-color-scheme`.
- Die Anzeige (`index.html`) bleibt ohne Bibliotheken. supabase-js nur im Admin.
- In `config.js` nur den öffentlichen Schlüssel eintragen, nie den Service-Key.
- Kein eingebetteter Code: kein `<script>` mit Inhalt, kein `<style>`, keine `style="…"`- oder `on…="…"`-Attribute. Die Content-Security-Policy (`<meta>` in beiden HTML-Dateien) erlaubt nur eigene Dateien und blockiert alles andere. Neue externe Quellen (anderes Supabase-Projekt, weitere Bild-Server) dort eintragen.
- supabase-js liegt als Datei in `js/lib/` (Version im Dateinamen). Zum Aktualisieren die neue `dist/umd/supabase.min.js` von jsDelivr herunterladen und den Pfad in `admin.html` anpassen.
- Links aus Daten (z. B. «Quelle») nur mit `http(s)://` verwenden; die Datenbank prüft das zusätzlich.

## Prüfen

- Syntax: Es gibt kein Node. Die Dateien in `js/` mit `new Function(...)` in einer Prüfseite parsen oder die Seite über einen lokalen Webserver mit headless Chrome (`--dump-dom`) öffnen; CSP-Verstösse erscheinen im Log.
- Kein «ß»: `grep -rc "ß" *.html js/*.js css` muss überall 0 ergeben.
- `index.html` im Browser öffnen, eine Kategorie durchklicken. Im Admin einen Eintrag bearbeiten und ein Bild ersetzen.

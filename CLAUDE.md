# Natur und Schweiz (sff)

Lern- und Nachschlageseite für die Schule (Sek I). Sie zeigt Kategorien (z. B. Bäume, Amphibien) mit Einträgen.
Jeder Eintrag hat 4 Bilder und einen Steckbrief.
Daten und Bilder liegen in **Supabase** (Postgres und Storage). Es gibt keinen Build, jede Seite ist eine eigene HTML-Datei.

## Ordnerstruktur

```
sff/
├── index.html            # Anzeige (öffentlich). Lädt die Daten per REST, ohne Bibliothek
├── admin.html            # Verwaltung (Login). Nutzt supabase-js (UMD über jsdelivr)
├── config.js             # window.SFF_CONFIG = { url, key (anon/publishable), bucket }
├── supabase/schema.sql   # Tabellen, RLS, Storage-Bucket (im SQL Editor ausführen)
├── tools/
│   ├── migration.html    # einmalige Übernahme der alten Daten und Bilder nach Supabase
│   └── cats-alt.js       # alte Daten (früher `CATS` in index.html), nur für die Migration
└── bilder/               # alte lokale Bilder und bilder.js, nur für die Migration
```

`bilder/` und `tools/` braucht es nach der erfolgreichen Migration nicht mehr.

## Datenmodell (supabase/schema.sql)

- `categories`: `id` (Slug, gleichzeitig die Adresse `#/<id>`), `name`, `description`, `latin` (true → Untertitel kursiv als lateinischer Name), `labels` (4 Bildbeschriftungen), `cover_entry_id` (Eintrag für die Übersichtskachel), `sort`.
- `entries`: `category_id`, `name`, `subtitle`, `description`, `facts` (jsonb-Array `[{k, v}]`, damit die Reihenfolge erhalten bleibt), `search_terms` (Suchbegriffe für Bilder 2–4), `wp` (englischer Wikipedia-Titel für das Hauptbild), `labels` (optional eigene 4 Beschriftungen), `sort`.
- `images`: `(entry_id, position 1–4)`, `storage_path` im Bucket `bilder`, `source_page`/`source_file` (für die Lizenzangabe, Knopf «Quelle»). Position 1 ist das Hauptbild.
- `admins`: `user_id`. Nur wer hier eingetragen ist, darf schreiben (`is_admin()`). Alle dürfen lesen.
- Neue Uploads aus dem Admin bekommen immer einen neuen Pfad (`<kat>/<entry-id>-<pos>-<zeit>.jpg`), damit kein Cache das alte Bild zeigt. Die alte Datei wird gelöscht.

## Aufbau von index.html

- `loadCats()` holt alles in einer Anfrage (`categories?select=…entries(…images(…))`) und bringt die Daten in die gewohnte Kurzform: Kategorie `id, name, desc, latin, labels, cover, items`, Eintrag `id, n, s, t, f, q, wp, lb, img[0..3]`.
- Navigation per Hash: `#/` zeigt die Übersicht, `#/<kategorie-id>` eine Kategorie.
- Karten: 5 Folien (4 Bilder + Text). Pfeile und Punkte erscheinen beim Darüberfahren. Die Pfeiltasten funktionieren, wenn die Karte den Fokus hat.

## Bilder laden

1. Hat ein Eintrag ein Bild in `images`, wird es aus Supabase Storage geladen.
2. Sonst oder bei einem Fehler wird es online gesucht (Fallback):
   - Hauptbild: Titelbild des englischen Wikipedia-Artikels `wp` bzw. des lateinischen Namens.
   - Bilder 2–4: Suche auf Wikimedia Commons mit `q[i] filetype:bitmap`, bei Bedarf mit gekürzten Suchbegriffen. Innerhalb eines Eintrags erscheint kein Bild doppelt.
3. Wikimedia bremst zu viele Anfragen (HTTP 429). Darum gibt es `limiter` (3 API-Anfragen, 4 Downloads gleichzeitig) und `retry`. Bilder 2–4 werden erst beim ersten Darüberfahren geladen.

## Verwaltung (admin.html)

- Anmeldung mit E-Mail und Passwort. Das Konto muss in `admins` stehen.
- Adressen: `#/k/<id>` Kategorie, `#/k/neu`, `#/e/<entry-id>` Eintrag, `#/e/neu/<kat-id>`.
- Nach jeder Änderung lädt `reload()` alle Daten neu. Die Datenmenge ist klein, das ist gewollt einfach.
- Hochgeladene Bilder werden im Browser auf höchstens 1600 px verkleinert (JPEG, Qualität 0.85).

## Offline-App (geplant)

Später als PWA: Ein Service Worker speichert die REST-Antwort von `loadCats()` und die Storage-Bilder zwischen.
`updated_at` in allen Tabellen ist dafür schon vorhanden. Die Datenquelle deshalb nur über `loadCats()` ansprechen.

## Konventionen

- Sprache Deutsch, **Schweizer Rechtschreibung: nie «ß», immer «ss»** (auch im Code und in Kommentaren).
- Texte sachlich und für Sek I verständlich: 3–4 Sätze Beschreibung, 3–4 Steckbrief-Zeilen.
- Richtwert 9 Einträge pro Kategorie (3×3-Raster) und 3 Suchbegriffe. Der Admin warnt, erzwingt es aber nicht.
- Farben nur über die CSS-Variablen in `:root`. Der Dunkelmodus läuft über `prefers-color-scheme`.
- Die Anzeige (`index.html`) bleibt ohne Bibliotheken. supabase-js nur im Admin und in den Tools.
- In `config.js` nur den öffentlichen Schlüssel eintragen, nie den Service-Key.

## Prüfen

- Syntax: Es gibt kein Node. Die Inline-Skripte als `<script type="text/plain">` in eine Prüfseite kopieren, mit `new Function(...)` parsen und die Seite mit headless Chrome (`--dump-dom`) öffnen.
- Kein «ß»: `grep -c "ß" *.html` muss überall 0 ergeben.
- `index.html` im Browser öffnen, eine Kategorie durchklicken. Im Admin einen Eintrag bearbeiten und ein Bild ersetzen.

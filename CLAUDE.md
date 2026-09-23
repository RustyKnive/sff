# Natur und Schweiz (sff)

Lern- und Nachschlageseite in einer einzigen HTML-Datei (ohne Build, ohne Abhängigkeiten).
Sie zeigt 9 Kategorien mit je 9 Einträgen. Jeder Eintrag hat 4 Bilder und einen Steckbrief.
Zielgruppe: Schule (Sek I).

## Ordnerstruktur

```
sff/
├── index.html                   # die ganze App (HTML, CSS, JS in einer Datei)
├── CLAUDE.md
└── bilder/
    ├── bilder.js                # Liste der Bilder mit Quellen: window.OFFLINE_BILDER = { … }
    ├── baeume/fichte-rottanne-1.jpg … -4.jpg
    ├── straeucher/…
    └── …                        # ein Unterordner pro Kategorie-ID
```

- Bildpfad: `bilder/<kategorie-id>/<slug(name)>-<1..4>.jpg`. Bild 1 ist das Hauptbild.
- `slug()`: klein schreiben, ä→ae, ö→oe, ü→ue, alles andere ausser a–z/0–9 wird zu `-`.
- `bilder.js` ist absichtlich eine JS-Datei, keine JSON-Datei: Seiten, die über `file://` geöffnet werden, dürfen kein JSON per `fetch` laden.
  Jeder Eintrag enthält `{ page: <Commons-Dateiseite>, file: <Originaldateiname> }`. Das braucht es für die Lizenzangabe (Knopf «Quelle»).

## Aufbau von index.html

- `CATS`: das Daten-Array (Kategorien → Einträge), ganz oben im `<script>`.
  - Kategorie: `id`, `name`, `desc`, `latin` (true → Untertitel kursiv als lateinischer Name), `cover` (Index des Eintrags, dessen Hauptbild die Übersichtskachel zeigt), `labels` (4 Bildbeschriftungen), `items`.
  - Eintrag: `n` Name, `s` Untertitel (lateinischer Name, Ort oder Gesteinsart), `t` Beschreibung, `f` Steckbrief (Objekt Schlüssel → Wert), `q` 3 Suchbegriffe für die Bilder 2–4, optional `wp` (Titel des englischen Wikipedia-Artikels für das Hauptbild), optional `lb` (eigene 4 Bildbeschriftungen).
- Navigation per Hash: `#/` zeigt die Übersicht, `#/<kategorie-id>` eine Kategorie. Der Browser-Zurück-Knopf funktioniert.
- Karten: 5 Folien (4 Bilder + Text). Pfeile und Punkte erscheinen beim Darüberfahren (auf Touch-Geräten immer sichtbar). Die Pfeiltasten funktionieren, wenn die Karte den Fokus hat.

## Bilder laden

1. Steht ein Bild in `OFFLINE_BILDER`, wird zuerst die lokale Datei geladen.
2. Fehlt sie oder lässt sie sich nicht laden, wird das Bild online gesucht (Fallback):
   - Hauptbild: Titelbild (`pageimages`) des englischen Wikipedia-Artikels `wp` bzw. des lateinischen Namens.
   - Bilder 2–4: Suche auf Wikimedia Commons mit `q[i] filetype:bitmap`. Findet sie nichts, werden die Suchbegriffe schrittweise gekürzt, zuletzt bleibt nur der Grundname. Innerhalb eines Eintrags erscheint kein Bild doppelt.
3. Wikimedia bremst zu viele Anfragen (HTTP 429). Darum laufen höchstens 3 API-Anfragen und 4 Bild-Downloads gleichzeitig (`limiter`), und `retry` versucht es mit wachsender Wartezeit erneut. Bilder 2–4 werden erst beim ersten Darüberfahren geladen.

## Offline-Betrieb

`index.html` ist die Offline-Version ohne Download-Knopf. Die Bilder liegen fertig in `bilder/`.
Die frühere Variante mit dem Knopf «Offline-Paket herunterladen (ZIP)» gehört nicht zum Projekt.
Sollen die Bilder neu zusammengestellt werden, lieber einzelne Dateien in `bilder/` ersetzen, als wieder einen Download-Mechanismus einzubauen.

## Konventionen

- Sprache Deutsch, **Schweizer Rechtschreibung: nie «ß», immer «ss»** (auch im Code und in Kommentaren).
- Texte sachlich und für Sek-I-Schülerinnen und -Schüler verständlich: 3–4 Sätze Beschreibung, 3–4 Steckbrief-Zeilen.
- Pro Kategorie genau 9 Einträge (3×3-Raster), pro Eintrag genau 3 Suchbegriffe in `q`.
- Farben nur über die CSS-Variablen in `:root`. Der Dunkelmodus läuft über `prefers-color-scheme`.
- Keine externen Bibliotheken, alles bleibt in einer Datei.

## Einen Eintrag ändern oder hinzufügen

1. Den Eintrag in `CATS` bearbeiten.
2. Ändert sich der Name `n`, ändert sich auch der Bildpfad (`slug`). Dann die Bilddateien umbenennen und die Schlüssel in `bilder.js` anpassen, sonst lädt die Seite die Bilder wieder online.
3. Ein Bild gezielt ersetzen: die JPG-Datei im Ordner austauschen und `page`/`file` in `bilder.js` nachführen.

## Prüfen

- Syntax: das `<script>` herauslösen und `node --check` ausführen.
- Kein «ß» in der Datei: `grep -c "ß" index.html` muss 0 ergeben.
- `index.html` direkt im Browser öffnen (`file://`) und eine Kategorie durchklicken.

# Natur und Schweiz – Werdegang der Website

Lern- und Nachschlageseite für die Sekundarstufe I: Kategorien wie Bäume, Amphibien oder Berge mit Einträgen,
je bis zu 4 Bilder, Beschreibung und Steckbrief. Diese Datei hält fest, was die Seite kann und wie sie dahin gekommen ist.
Sie wird bei jeder neuen Möglichkeit ergänzt.

**Stand:** 27. September 2026 · 20 Kategorien mit je 16 sichtbaren Einträgen (320) · Bilder der 35 neuen Einträge folgen

---

## Was die Seite heute kann

### Anzeige (index.html)

- **Übersicht** mit einer Kachel pro Kategorie (Titelbild, Anzahl Einträge).
- **Kategorie** mit einer Karte pro Eintrag: durch die Bilder und den Steckbrief blättern (Pfeile, Punkte, Tastatur).
  Es werden nur die vorhandenen Bilder gezeigt.
- **Lightbox:** Ein Klick zeigt Bilder und Text bildschirmfüllend. Bilder lassen sich zoomen
  (Mausrad, Doppelklick, zwei Finger, Tasten `+` `-` `0`), vergrössert verschieben und auf dem Handy wischen.
- **Menü:**
  - *PDF drucken:* eine Kategorie als PDF speichern oder drucken (A4, 8 Einträge pro Seite, Bildquelle klein im jeweiligen Bild).
  - *Einstellungen:* alle Bilder für die Nutzung ohne Internet herunterladen.
  - *Admin:* Hinweisseite mit Link, die Verwaltung öffnet sich in einem neuen Tab.
  - *Copyright:* Urheberrecht und vollständiger Bildnachweis (mit «eigenes Foto» und «zugeschnitten»).
  - *LernApp:* Platzhalter, noch ohne Funktion.
- **Offline-App:** Die Seite lässt sich auf dem Handy installieren und funktioniert ohne Internet.
- Hell- und Dunkelmodus nach Einstellung des Geräts.

### Verwaltung (admin.html)

- Anmeldung mit E-Mail, Passwort und Code aus einer Authenticator-App (Zwei-Faktor).
- Kategorien und Einträge anlegen, bearbeiten, sortieren, ein- und ausblenden, löschen.
- Einträge in eine andere Kategorie verschieben.
- **Bilder:** hochladen, von Wikimedia Commons übernehmen («Fehlende Bilder übernehmen», «Anderes Bild suchen»,
  ein bestimmtes Commons-Bild über seine Adresse oder viele auf einmal über eine Liste), dauerhaft zuschneiden und den Ausschnitt für die kleine Vorschau festlegen.
- **Mit Claude (über claude.ai, ohne Zusatzkosten):**
  - *Neue Kategorie:* Claude prüft die Idee und schreibt alle Einträge; Vorschlag durchsehen, abwählen, korrigieren oder abbrechen.
  - *Neuer Eintrag* über einen Namen oder ein Foto: Claude bestimmt die Art bzw. schreibt den Eintrag,
    das Formular lässt sich vor dem Übernehmen ändern. Ein eigenes Foto wird Bild 1.

### Technik in Kürze

- Reines HTML, CSS und JavaScript ohne Build; die Anzeige kommt ohne Bibliotheken aus.
- Daten und Bilder in **Supabase** (Postgres-Datenbank und Speicher); gehostet auf GitHub Pages.
- Schreiben dürfen nur Admins mit zweitem Faktor (Row Level Security). Strenge Content-Security-Policy:
  Die Seiten laden nur eigene Dateien und die erlaubten Quellen.

---

## Werdegang

### 23. September 2026 – Die erste Version

- **Version 1:** die ganze Seite in einer einzigen HTML-Datei, 9 Kategorien mit je 9 Einträgen.
  Die Bilder lagen als Dateien im Ordner `bilder/`, mit Quellenangabe pro Bild (Knopf «Quelle»).
- Die Seite kam auf GitHub; `CLAUDE.md` beschreibt seither Aufbau und Regeln des Projekts.

### 23. September – Datenbank und Verwaltung

- **Umstieg auf Supabase:** Kategorien, Einträge und Bilder liegen in einer Datenbank, die Bilder im eigenen Speicher.
  Ein einmaliges Werkzeug hat die bestehenden Bilder übertragen.
- **Verwaltung** (`admin.html`) zum Bearbeiten im Browser statt im Code.
- Kategorien und Einträge lassen sich **ein- und ausblenden**.
- Fehlt ein eigenes Bild, sucht die Seite eines auf Wikipedia bzw. Wikimedia Commons (Notlösung).

### 23. September abends – Sicherheit und Offline-App

- **Sicherheit:** Code in eigene Dateien ausgelagert, strenge Content-Security-Policy, Schutz gegen Einbetten in fremde Seiten,
  Links aus Daten nur mit `https://`.
- **Zwei-Faktor-Anmeldung** für die Verwaltung (Authenticator-App); ohne zweiten Faktor gibt die Datenbank keine Schreibrechte.
- **Offline-App (PWA):** Service Worker, installierbar, Steinbock als App-Symbol; Knopf, um alle Bilder herunterzuladen.

### 23./24. September – Mehr Inhalt

- Je 6 neue Einträge pro Kategorie.
- **Wikimedia-Bilder in den eigenen Speicher übernehmen:** schneller, zuverlässiger für ganze Klassen und offline verfügbar.
- Neue Kategorien: Vögel, Wiesenblumen, Reptilien, Falter, Pilze, Berge, Fische, Nutztiere, Gewässer.
  Das Matterhorn kam zu den Bergen, das Martinsloch (Glarus) zu den Sehenswürdigkeiten.
- **Lightbox:** Bilder und Steckbrief per Klick bildschirmfüllend; «Zurück» im Browser schliesst nur die Lightbox.

### 27. September – Menü, Bildbearbeitung und Bildnachweis

- **Menü** oben rechts mit LernApp (Platzhalter), Einstellungen, Admin und Copyright.
- **Bilder zuschneiden** und den **Ausschnitt der Vorschau** festlegen (was in der kleinen Karte zu sehen ist).
- **Bildnachweis** kennzeichnet eigene Fotos und zugeschnittene Bilder (verlangt von den Creative-Commons-Lizenzen)
  und ist immer aktuell, auch in einer offenen Seite oder der installierten App.

### 27. September – Inhalte mit Claude

- **Neue Kategorie mit Claude:** Name und Anzahl eingeben, Claude prüft die Kategorie und schreibt alle Einträge.
  Angelegt wird ausgeblendet, damit alles zuerst durchgesehen werden kann. Abbrechen geht vor und während des Anlegens.
- **Neuer Eintrag mit Claude** über einen Namen oder ein Foto (Claude bestimmt die Art).
- *Entscheid:* Zuerst war ein direkter Aufruf der Claude-API geplant. Weil das pro Anfrage kostet, läuft es jetzt
  per Kopieren und Einfügen über claude.ai (im bestehenden Abo, ohne Zusatzkosten).

### 27. September – Anzeige, Druck und Verwaltung

- Karten zeigen **nur die vorhandenen Bilder**.
- **Zoomen** in der Lightbox.
- **PDF drucken:** eine ganze Kategorie als PDF (A4, Rand 5 mm, 8 Einträge pro Seite, Text klein über dem Hauptbild).
- **Einträge verschieben** in eine andere Kategorie.
- Der Menüpunkt **Admin** führt auf eine eigene Seite; die Verwaltung öffnet sich in einem neuen Tab.
- Diese **Dokumentation** des Werdegangs, die bei jeder neuen Möglichkeit ergänzt wird.
- **Bild von Commons übernehmen:** Adresse eines Commons-Bildes einfügen, die Verwaltung lädt es herunter und trägt die Quelle ein.
  Anlass war die Prüfung der offenen Bildkorrekturen (Rhone, Inn, Ringelnatter, Toggenburger Ziege), für die passende Bilder
  gezielt ausgesucht wurden.
- **PDF:** Die Bildquelle steht neu klein unter dem Text im jeweiligen Bild statt auf einer eigenen Seite am Schluss.
  Der Texthintergrund ist durchsichtiger und die Quelle kleiner, damit mehr vom Bild sichtbar ist.
  Wer «PDF drucken» aus einer Kategorie heraus wählt, findet diese Kategorie schon ausgewählt.
- **16 Einträge pro Kategorie:** Damit ein doppelseitig gedrucktes A4-Blatt kein leeres Feld hat, hat jede Kategorie
  genau 16 sichtbare Einträge. 35 neue Einträge kamen dazu, je ein typischer Schweizer Vertreter, bei den Nutztieren vier.
  Die Sehenswürdigkeiten wurden aufgeteilt: Bauwerke und Orte bleiben, Wasserfälle, Schluchten, Gletscher und Felsen
  bilden die neue Kategorie **Naturwunder**. Bei den Hunden sind die Untertitel keine lateinischen Namen mehr.
- **Bilder aus Liste übernehmen:** Mehrere Bilder auf einmal von Commons übernehmen oder entfernen, indem man eine Liste
  einfügt (Eintrag, Bildnummer, Adresse). Anlass war die Durchsicht der 140 neuen Bilder, bei der gut 20 falsche
  Motive auffielen, etwa ein Schädel statt eines Steinmarders oder eine Gedenktafel von den Philippinen.
- **Neue Versionen sofort sichtbar:** Die Offline-App fragt Seite und Programmdateien jetzt immer beim Server nach,
  statt bis zu 10 Minuten eine ältere Kopie aus dem Browser zu zeigen.

---

## Bewusste Entscheide

| Entscheid | Grund |
|---|---|
| Kein Build, keine Bibliotheken in der Anzeige | einfach zu verstehen und zu pflegen, schnell, funktioniert offline |
| Eigene Kopien aller Bilder statt nur Links | schnell, unabhängig von Wikimedia-Sperren, offline verfügbar |
| Zwei-Faktor-Anmeldung und strenge CSP | Schutz der Verwaltung und der Besucherinnen und Besucher |
| Claude über claude.ai statt über die API | keine zusätzlichen Kosten; nur ein Admin pflegt und prüft die Inhalte |
| PDF über den Druckdialog des Browsers | keine zusätzliche Bibliothek nötig |
| Neue Kategorien zuerst ausgeblendet | Inhalte werden vor dem Veröffentlichen geprüft |
| Einträge nur einzeln verschieben | Mehrfach-Verschieben ist nicht gewünscht |
| Genau 16 sichtbare Einträge pro Kategorie | 2 volle A4-Seiten im PDF, doppelseitig ohne leeres Feld; weitere werden ausgeblendet, nicht gelöscht |
| Schweizer Rechtschreibung (immer «ss») | Zielpublikum Schweizer Schulen |

## Änderungen an der Datenbank

| Datei | Inhalt |
|---|---|
| `schema.sql` | Grundaufbau: Kategorien, Einträge, Bilder, Admins |
| `002_sichtbar.sql` | Ein- und Ausblenden |
| `003_sicherheit.sql` | Quellen nur als `http(s)://`-Adresse, Bild-Uploads nur JPEG bis 5 MB |
| `004_mfa.sql` | Schreibrechte nur mit zweitem Faktor |
| `005`–`009` | neue Einträge und Kategorien |
| `010_bildausschnitt.sql` | Ausschnitt der Vorschau pro Bild |
| `011_bild_bearbeitet.sql` | Kennzeichnung zugeschnittener Bilder |
| `012_16_eintraege.sql` | 16 Einträge pro Kategorie, neue Kategorie Naturwunder, Hunde ohne lateinische Untertitel |

## Offen und geplant

- **LernApp:** Was sie können soll, ist noch offen.
- Einzelne Bildkorrekturen, die in der Verwaltung gemacht werden sollen (z. B. doppelte oder falsche Fotos).

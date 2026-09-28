# Natur und Schweiz – Technische Umsetzung

Diese Datei beschreibt, **wie** die Website gebaut ist und **warum** so: Architektur, Datenhaltung, Sicherheit,
Offline-Betrieb, die wichtigsten Algorithmen, Tests und die Probleme, die unterwegs auftraten. Was die Seite kann und
wie sie entstanden ist, steht in `WERDEGANG.md`; die Arbeitsregeln für die Entwicklung in `CLAUDE.md`.

**Stand:** 28. September 2026 · Version 2.0.0, Datenbank 15 · rund 5600 Zeilen HTML, CSS, JavaScript und SQL · über 70 Commits

---

## 1 Rahmenbedingungen

Vier Vorgaben haben fast jeden technischen Entscheid geprägt:

1. **Keine laufenden Kosten.** Hosting, Datenbank und KI müssen gratis sein oder im bestehenden Abo laufen.
2. **Pflegbar ohne Werkzeugkette.** Kein Build, kein Node, kein Paketmanager: Eine Änderung an einer Datei ist nach dem
   Hochladen sofort live. Das hält die Einstiegshürde tief, auch für eine spätere Übergabe.
3. **Schultauglich.** Funktioniert auf alten Handys, Schul-Tablets und am Beamer, auch ohne Internet (Exkursion),
   ohne Konten für Lernende und ohne Tracking.
4. **Sicher, obwohl öffentlich.** Alle dürfen lesen, nur berechtigte Lehrpersonen schreiben.

## 2 Architektur

```
 Browser (Lernende)                     Browser (Lehrperson)
 index.html + js/index.js               admin.html + js/admin.js
 Service Worker (Offline)               supabase-js, qrcode-generator
        │  REST, nur lesen                     │  REST + Auth, schreiben (RLS, 2FA)
        └──────────────┬───────────────────────┘
                       ▼
              Supabase (Gratis-Stufe)
              Postgres · Storage «bilder» · Auth (TOTP)
                       ▲
 GitHub Pages ─ liefert die statischen Dateien aus
 GitHub Actions ─ fragt die Datenbank täglich ab (Wachhalten)
 Wikimedia Commons ─ Quelle für Bilder und Tierstimmen
 claude.ai ─ Texte für neue Inhalte (Kopieren und Einfügen)
```

Die Seite ist eine **statische Website mit «Backend as a Service»**: Es gibt keinen eigenen Server. Die Browser sprechen
direkt mit der Datenbank; was erlaubt ist, entscheidet die Datenbank selbst über Row Level Security.

### Abwägung der Alternativen

| Variante | Vorteil | Warum nicht |
|---|---|---|
| Nur statische Dateien (Version 1: alles in einer HTML-Datei) | denkbar einfach | Inhalte nur im Code änderbar, Bilder im Repository |
| CMS (z. B. WordPress) | fertige Verwaltung | Hosting kostet, Plugins und Updates, Tracking und Werbung schwer zu vermeiden, offline kaum möglich |
| Eigener Server (Node, PHP) | volle Kontrolle | Betrieb, Updates und Sicherheit selbst; Kosten |
| Tabellenblatt (Google Sheets) als Datenquelle | Pflege im Tabellenblatt | Bilder, Rechte und Zwei-Faktor schlecht lösbar, Datenschutz |
| **Statische Seite + Supabase** | gratis, echte Datenbank, Rechte in der Datenbank, Speicher für Bilder | Abhängigkeit von einem Anbieter; Gratis-Projekte pausieren nach einer Woche ohne Zugriff (siehe 9) |

### Frontend ohne Framework

Anzeige und Verwaltung sind reines JavaScript ohne Framework. Jede Seite hat eine HTML-Datei, ein Skript und ein Stylesheet.
Die Anzeige arbeitet als kleine **Single-Page-App mit Hash-Adressen** (`#/baeume`, `#/voegel/amsel`, `#/lernapp`): Eine
Funktion `render()` liest die Adresse und baut die Ansicht; «Zurück» im Browser funktioniert dadurch von selbst, und
jede Ansicht hat eine teilbare Adresse. HTML entsteht aus Template-Strings; **jeder Wert aus der Datenbank läuft durch
`esc()`**, damit kein eingeschleuster Text als HTML wirkt.

Wiederverwendete Bausteine statt Komponenten-Framework:
- `carousel()` – Blättern mit Pfeilen, Punkten, Tastatur und Fokus; genutzt von Karte, Grossansicht und LernApp.
- `zoomable()` – Zoomen und Verschieben mit Mausrad, Doppelklick, zwei Fingern und Tasten; Grossansicht und LernApp.
- `fillSlide()` – lädt ein Bild (eigenes aus Supabase, sonst Notlösung über Wikimedia) mit Ladeanzeige und Quelle.

**Preis dieser Einfachheit:** `js/index.js` und `js/admin.js` sind je rund 1500 Zeilen lang, Zustand und DOM werden von
Hand abgeglichen. Für ein Projekt dieser Grösse mit einer Person ist das überschaubar; bei mehreren Entwicklerinnen
oder deutlich mehr Funktionen wären Module (ES-Module ohne Build) der nächste Schritt.

## 3 Daten

### Datenmodell

- `categories` – Kennung (zugleich Adresse), Name, Beschreibung, 4 Bildbeschriftungen, Titelbild, Reihenfolge, sichtbar.
- `entries` – Name, Untertitel, Beschreibung, Steckbrief (`jsonb`-Array `[{k, v}]`, damit die Reihenfolge der Zeilen
  bleibt), Suchbegriffe, bewusst leere Bildplätze, Verwechslungsgefahr (`jsonb` `[{name, diff}]`), Tierstimme, sichtbar.
- `images` – Eintrag und Position 1–4, Pfad im Speicher, Quelle und Dateiname (für die Lizenz), Ausschnitt der Vorschau,
  «zugeschnitten».
- `admins` – Konten mit Schreibrecht.

Änderungen am Schema kommen als **nummerierte SQL-Datei** (`002_…` bis `014_…`), die im Supabase-Dashboard ausgeführt
wird, und werden zusätzlich in `schema.sql` nachgeführt. Die neueren Dateien sind möglichst so geschrieben, dass sie sich gefahrlos
mehrmals ausführen lassen (`add column if not exists`, `on conflict`).

### Eine Anfrage für alles

Die Anzeige lädt alle Kategorien mit Einträgen und Bildangaben in **einer einzigen REST-Anfrage** (PostgREST mit
eingebetteten Tabellen). Bei 20 Kategorien, 320 Einträgen und rund 1270 Bildern sind das einige hundert Kilobyte JSON –
weniger als ein einziges Foto. Der Gewinn: eine Antwort, die der Service Worker als Ganzes offline ablegen kann, und
Suche, «Jetzt zu sehen», Quiz und LernApp arbeiten ohne weitere Anfragen im Browser.

Zwei Stolpersteine: Weil `categories` über das Titelbild auch auf `entries` verweist, gibt es zwei Beziehungen; die
Anfrage muss den Fremdschlüssel ausdrücklich nennen (`entries!entries_category_id_fkey`). Und PostgREST liefert
höchstens 1000 Zeilen pro Anfrage; die Sicherung in der Verwaltung holt deshalb blockweise.

### Bilder

Jeder Eintrag soll vier **eigene Kopien** seiner Bilder haben. Links auf Wikimedia allein wären einfacher, aber Wikimedia
sperrt bei vielen Anfragen von derselben Adresse (HTTP 429) – eine ganze Schulklasse hinter einem Router ist genau
dieser Fall –, und offline gingen sie nicht. Die Verwaltung lädt ein Bild von Commons, verkleinert es im Browser per
`canvas` auf höchstens 1600 px (JPEG, Qualität 0.85) und speichert es mit Quelle und Dateiname. Jeder Upload bekommt einen
**neuen Pfad** mit Zeitstempel; so kann kein Cache ein altes Bild zeigen, und die alte Datei wird gelöscht.

Der **Ausschnitt der Vorschau** wird nicht als zweites Bild gespeichert, sondern als Punkt und Zoomfaktor. Die Anzeige
setzt daraus CSS-Variablen (`--fx`, `--fy`, `--z`), und `object-position` und `transform` erledigen den Rest.
**Zuschneiden** dagegen erzeugt per `canvas` eine neue Datei und markiert sie als «zugeschnitten», weil
Creative-Commons-Lizenzen einen Hinweis auf Änderungen verlangen. Der Bildnachweis entsteht automatisch aus diesen Angaben.

## 4 Sicherheit

- **Row Level Security:** Lesen ist für alle erlaubt (nur sichtbare Zeilen), Schreiben nur, wenn `is_admin()` wahr ist.
  Diese Funktion verlangt einen Eintrag in `admins` **und** eine Anmeldung mit zweitem Faktor (`aal2` im JWT).
  Ein gestohlenes Passwort allein genügt also nicht. Im Browser liegt nur der öffentliche Schlüssel; der Dienstschlüssel,
  der RLS umgehen würde, kommt nie ins Projekt.
- **Content-Security-Policy** in beiden HTML-Dateien: Skripte, Stile, Bilder, Töne und Verbindungen nur von der eigenen
  Adresse, dem eigenen Supabase-Projekt und Wikimedia. Eingebetteter Code ist verboten – kein `<script>` mit Inhalt, keine
  `style`- oder `on…`-Attribute. Damit bleibt selbst eingeschleustes HTML wirkungslos. Die Regel hat Folgen im Code:
  Balken und Ausschnitte werden über das CSSOM (`el.style.width = …`) oder Klassen gesetzt, nie über Attribute.
- **Eingaben:** Texte aus der Datenbank laufen durch `esc()`; Links aus Daten (Quelle) nur mit `http(s)://`, was die
  Datenbank zusätzlich mit einem `check` erzwingt. Der Speicher nimmt nur JPEG und MP3 bis 5 MB an.
- **Keine Admin-Daten im Offline-Speicher:** Anfragen mit `Authorization` und die Verwaltung selbst umgehen den Service Worker.
- **Datenschutz:** keine Konten für Lernende, kein Tracking, keine Cookies. Der Lernstand liegt nur im `localStorage` des Geräts.

## 5 Offline-Betrieb (PWA)

Ein Service Worker (`sw.js`) macht die Anzeige installierbar und offline nutzbar:

| Inhalt | Strategie | Begründung |
|---|---|---|
| Seite, Skripte, Styles | Netz zuerst, `cache:"no-cache"` | neue Versionen sofort; GitHub Pages erlaubt sonst 10 Minuten Browser-Cache |
| Daten (die eine Anfrage) | Netz zuerst, nach 4 s der gespeicherte Stand | schlechtes Netz auf Exkursion soll nicht blockieren |
| eigene Bilder | Speicher zuerst | Bilder ändern ihren Pfad bei jeder Änderung, ein gespeichertes Bild ist also nie veraltet |
| Tierstimmen (MP3) | nicht gespeichert | Browser laden Audio mit Range-Anfragen, die der Cache nicht bedienen kann |
| Wikimedia-Notlösung | nicht gespeichert | fremde Dateien, sollen durch eigene ersetzt werden |

«Alle Bilder herunterladen» füllt den Bildspeicher auf einmal und räumt ersetzte Dateien weg. Neue App-Dateien bekommen
eine neue Cache-Version (`sff-app-v5`), damit alte Kopien verschwinden.

## 6 Algorithmen und Lösungen im Detail

### LernApp: Leitner-System

- Fünf Fächer mit Abständen von 0, 1, 3, 7 und 30 Tagen. Richtig → ein Fach weiter, Termin = heute + Abstand des
  neuen Fachs; falsch oder «Weiss nicht» → Fach 1, sofort wieder fällig. Mit Tipp richtig → bleibt im Fach.
- Neue Begriffe warten in «Fach 0» und kommen **dosiert** dazu (höchstens 10 pro Tag), abgefragt wird in **Runden** zu
  höchstens 15 Fragen. Ohne Dosierung wären am ersten Tag alle Begriffe gleichzeitig fällig, und das System verlöre
  seine Wirkung.
- Fach 1: Auswahl aus vier Namen (Wiedererkennen), falsche Vorschläge möglichst aus derselben Kategorie; ab Fach 2
  Eintippen (freies Erinnern).
- **Antwortprüfung** (`lernMatch()`): klein geschrieben, ä → ae, ohne Satzzeichen; bei «Fichte (Rottanne)» gilt jeder
  Teil; kleine Tippfehler über die **Levenshtein-Distanz** (1, ab 10 Zeichen 2) gelten als richtig mit Hinweis.
- **Lernsessions:** Der Speicher `sff-lernen` hält mehrere Sessions mit eigenen Kategorien, Farbe und Karten
  (`{sessions:[…], active, streak}`). Das frühere Format mit nur einer Auswahl wird beim Laden automatisch zur ersten
  Session – bestehende Lernstände gehen bei der Umstellung nicht verloren.
- Grenze: Der Lernstand ist an ein Gerät gebunden. Eine Synchronisation bräuchte Konten und damit Personendaten von
  Lernenden; das ist bewusst nicht umgesetzt.

### Entdeckung des Tages

Die Auswahl soll für alle Geräte am selben Tag gleich sein, ohne Server. Grundlage ist die Tageszahl (Tage seit 1970 nach
lokalem Datum). Ein einfacher Multiplikations-Hash ergab ein sichtbar regelmässiges Muster; ersetzt wurde er durch den
Mischschritt von **MurmurHash3 (fmix32)**. Die Kategorie springt ab einem festen Starttag jeden Tag um 1 bis n−1 Plätze
weiter und ist deshalb **nie dieselbe wie am Vortag**; über ein Jahr kommen so rund 220 verschiedene Einträge vor.

### «Jetzt zu sehen»

Statt einer zusätzlich zu pflegenden Monatsliste liest die Seite die Steckbrief-Zeilen «Blütezeit», «Flugzeit»,
«Laichzeit» usw. und erkennt Monatsnamen und Bereiche («Juni–September», auch über den Jahreswechsel «November–März»).
Wer den Steckbrief pflegt, pflegt die Monatsliste automatisch mit.

### Merksatz

Nach jeder Antwort zeigt die LernApp den ersten Satz der Beschreibung. Ein naives «bis zum ersten Punkt» brach bei
«im 19. Jahrhundert» oder «St. Gallen» ab. Die Regel schliesst nun Punkte nach Zahlen und nach Abkürzungen aus
(Lookbehind im regulären Ausdruck); eine Prüfung über alle 320 Beschreibungen fand danach keinen Fehler mehr.

### Drucken ohne PDF-Bibliothek

Steckbriefe, Arbeitsblatt und Memory sind **Druck-CSS** (`@media print`) mit Massen in Millimetern auf A4. Das Skript füllt
einen unsichtbaren Druckbereich, wartet, bis alle Bilder geladen sind, setzt den Dateinamen über `document.title` und
räumt nach `afterprint` auf. Den PDF-Export übernimmt der Browser («Als PDF speichern»). Genau 16 Einträge pro Kategorie
ergeben zwei volle Seiten ohne Lücke; deshalb ist diese Zahl eine Inhaltsregel.

### Tierstimmen

Commons liefert zu jeder Tonaufnahme (OGG, WAV, FLAC) automatisch eine **MP3-Fassung** (`derivatives` in der API).
Die Verwaltung übernimmt diese Fassung in den eigenen Speicher, weil MP3 in jedem Browser läuft (Safari spielt kein OGG).
Dafür mussten der Speicher (erlaubte Dateitypen) und die CSP (`media-src`) erweitert werden.

### QR-Codes

Die Direktlinks (`#/kategorie/eintrag`) werden mit einem Slug aus dem Namen gebildet (Kleinbuchstaben, Akzente weg,
Leerzeichen → Bindestrich). Die QR-Codes erzeugt die Verwaltung mit der kleinen Bibliothek *qrcode-generator* als SVG;
die Anzeige bleibt ohne Bibliothek. Gedruckt werden 12 Karten pro A4-Seite über Druck-CSS.

### KI ohne Schnittstelle

Neue Kategorien und Einträge schreibt Claude über **claude.ai im bestehenden Abo**: Die Verwaltung baut einen Auftrag mit
allen Regeln, einem Beispiel und den bestehenden Namen (gegen Doppelte); die Antwort ist ein JSON-Block, den die Verwaltung
robust ausliest (Text zwischen erster «{» und letzter «}», Eszett → «ss», Längen begrenzt) und als **Formular zum Prüfen**
anzeigt. Neue Kategorien werden ausgeblendet angelegt. Die direkte API wäre bequemer, kostet aber pro Anfrage; so bleibt
zudem immer ein Mensch zwischen Vorschlag und Veröffentlichung.

## 7 Betrieb

- **Deployment:** Ein Push auf GitHub löst «pages build and deployment» aus; nach 1–2 Minuten ist die Version live.
- **Wachhalten:** Gratis-Projekte von Supabase pausieren nach etwa einer Woche ohne Zugriff – in den Schulferien sicher.
  Ein GitHub-Actions-Workflow fragt deshalb täglich eine Tabelle mit dem öffentlichen Schlüssel ab. GitHub schaltet
  geplante Workflows nach 60 Tagen ohne Commit ab; das muss man wissen.
- **Sicherung:** Die Gratis-Stufe bietet keine herunterladbaren Backups. Die Verwaltung exportiert Kategorien, Einträge und
  Bildangaben als JSON (blockweise wegen der 1000-Zeilen-Grenze). Die Bilddateien selbst sind nicht dabei; sie lassen sich
  über die gespeicherten Quellen wieder von Commons holen.

### Versionierung

Website und Datenbank werden getrennt versioniert, weil sie getrennt ausgeliefert werden: Die Website über einen Push
auf GitHub, die Datenbank über SQL-Dateien, die im Supabase-Dashboard von Hand ausgeführt werden. Genau an dieser Naht
lag das grösste Betriebsrisiko: Eine neue Website, die neue Spalten abfragt, lädt mit der alten Datenbank gar nichts.

- **Website:** `js/version.js` enthält `app` (nach dem Muster Hauptversion.Funktion.Korrektur, «Semantic Versioning»),
  das Datum und die Datenbank-Version, die diese Website mindestens braucht. Die Datei wird von beiden Seiten und vom
  Service Worker geladen; der Offline-Speicher heisst nach der Version (`sff-app-2.0.0`), sodass jede neue Version einen
  frischen Speicher bekommt und alte gelöscht werden. Registriert wird der Service Worker mit `updateViaCache:"none"`,
  damit der Browser auch die importierte Versionsdatei ohne Zwischenspeicher auf Änderungen prüft.
- **Datenbank:** Die Tabelle `app_meta` hat genau eine Zeile mit `schema_version` = Nummer der zuletzt eingespielten
  SQL-Datei (seit `015_versionierung.sql`). Jede weitere Datei setzt diese Nummer am Schluss.
- **Prüfung beim Start:** Die Anzeige fragt `app_meta` parallel zu den Inhalten ab. Fehlt die Tabelle (HTTP 404), gilt
  die Datenbank als «14 oder älter». Scheitert das Laden der Inhalte und ist die Datenbank zu alt, meldet die Startseite
  genau, welche SQL-Dateien fehlen. Die Verwaltung zeigt beide Nummern und warnt in der Übersicht. Ohne Internet bleibt
  die Prüfung stumm; dann kommen die gespeicherten Inhalte.
- **Nachvollziehbarkeit:** Jede Version ist ein annotierter Git-Tag (`v1.0.0` = die ursprüngliche Einzeldatei,
  `v2.0.0` = Einführung der Versionierung). Die Tabelle «Versionen» im Werdegang fasst jede Veröffentlichung in einer
  Zeile zusammen; die Sicherung der Verwaltung enthält beide Versionsnummern.

## 8 Qualitätssicherung

Ohne Build gibt es auch keine Testumgebung von der Stange. Getestet wird mit **Prüfseiten in einem unsichtbaren Chrome**
(headless): Eine Prüfseite lädt den echten Code, ersetzt die Datenbank durch Testdaten oder schaltet die echten Daten
schreibgeschützt dazu, spielt Klicks, Tasten und Gesten durch und schreibt das Ergebnis in die Seite, die dann ausgelesen wird.

Erfahrungen damit:
- Unter **virtueller Zeit** laufen CSS-Übergänge nicht weiter und das `close`-Ereignis von `<dialog>` kommt nicht; solche
  Abläufe brauchen echte Zeit oder abgeschaltete Übergänge.
- Headless Chrome schneidet Fenster unter etwa 500 px ab; **Handybreiten** (320–390 px) werden deshalb in `<iframe>`s
  nebeneinander geprüft.
- Screenshots mit echten Daten dienen zugleich der Sichtprüfung und der Dokumentation.
- Zusätzlich prüft jede Version ein Mensch im Browser und auf dem Handy, bevor sie veröffentlicht wird.

## 9 Probleme und ihre Lösung

| Problem | Ursache | Lösung |
|---|---|---|
| Wikimedia antwortet mit HTTP 429 | zu viele Anfragen, eine Klasse hinter einer Adresse | Warteschlange (3 API-Anfragen, 4 Downloads gleichzeitig), Wiederholen mit wachsender Wartezeit, eigene Bildkopien |
| Neue Version erst nach Minuten sichtbar | GitHub Pages erlaubt 10 Minuten Browser-Cache | Service Worker holt App-Dateien mit `cache:"no-cache"` |
| «Zurück» verliess die Kategorie statt die Grossansicht zu schliessen | Dialog ohne eigenen Verlaufseintrag | `history.pushState` beim Öffnen, `popstate` schliesst |
| Link in «Nicht verwechseln mit» schloss die neue Grossansicht gleich wieder | das `close`-Ereignis des alten Dialogs kommt verzögert | Handler bricht ab, wenn der Dialog schon wieder offen ist |
| Grossansicht zeigte bei Einträgen mit Tierstimme nur den Text | `showModal()` fokussiert das erste Bedienelement (auf der Textseite), der Browser scrollt dorthin | Fokus auf «Schliessen» (`autofocus`), Karussell setzt `scrollLeft` zurück und blättert bei Fokus zur richtigen Seite |
| Beim Beamer-Quiz lagen Auswahl und Text über dem Bild | die ganze Seite wurde in den Vollbildmodus geschaltet und liegt dann im Browser über dem Dialog | nur den Quiz-Dialog in den Vollbildmodus schalten |
| Merksatz brach mitten im Satz ab | Punkt nach Zahl oder Abkürzung | Lookbehind im Satzende-Ausdruck |
| Tagesauswahl wirkte regelmässig | schwacher Hash | fmix32 und Kategorien-Rotation |
| Neue Website lädt nichts, wenn eine SQL-Datei vergessen ging | Website und Datenbank werden getrennt ausgeliefert | Versionsnummern für beide, Prüfung beim Start mit klarer Meldung |
| Datenbank würde in den Ferien pausieren | Gratis-Stufe | täglicher Abruf über GitHub Actions |
| 20 von 140 übernommenen Bildern zeigten falsche Motive | Suchtreffer auf Commons sind unzuverlässig | Durchsicht und Korrektur per Liste («Eintrag \| Nummer \| Adresse») |

## 10 Grenzen und Weiterentwicklung

- **Datenmenge:** Alles in einer Anfrage ist bei einigen tausend Einträgen noch sinnvoll, darüber bräuchte es Nachladen pro Kategorie.
- **Code-Struktur:** Die zwei grossen Skripte in ES-Module aufteilen, sobald mehrere Personen daran arbeiten.
- **Automatische Tests:** Die Prüfseiten könnten in GitHub Actions bei jedem Push laufen.
- **Barrierefreiheit:** Tastatur, Fokus und Beschriftungen sind berücksichtigt, eine systematische Prüfung mit
  Screenreader steht aus.
- **Lernstand auf mehreren Geräten:** nur mit Konten möglich; bewusst verzichtet (Datenschutz, keine Personendaten).
- **Anbieterabhängigkeit:** Supabase ist Open Source und liesse sich selbst betreiben; Schema und Sicherung liegen im Projekt.

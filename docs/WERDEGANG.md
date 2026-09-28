# Natur und Schweiz – Werdegang der Website

Lern- und Nachschlageseite für die Sekundarstufe I: Kategorien wie Bäume, Amphibien oder Berge mit Einträgen,
je bis zu 4 Bilder, Beschreibung und Steckbrief. Diese Datei hält fest, was die Seite kann und wie sie dahin gekommen ist.
Sie wird bei jeder neuen Möglichkeit ergänzt.

**Stand:** 28. September 2026 · 20 Kategorien mit je 16 sichtbaren Einträgen (320) · rund 1270 eigene Bilder ·
36 Verwechslungspaare · Tierstimmen für 28 Arten

---

## Was die Seite heute kann

### Anzeige (index.html)

- **Übersicht** mit einer Kachel pro Kategorie (Titelbild, Anzahl Einträge) und der **Entdeckung des Tages**
  (jeden Tag ein anderer Eintrag aus wechselnden Kategorien, für alle gleich; «Noch eine» zeigt einen weiteren zufälligen Eintrag).
- **Suche** über alle Kategorien: deutscher Name, lateinischer Name oder Kategorie, ohne Rücksicht auf Umlaute und Grossschreibung.
- **Kategorie** mit einer Karte pro Eintrag: durch die Bilder und den Steckbrief blättern (Pfeile, Punkte, Tastatur).
  Es werden nur die vorhandenen Bilder gezeigt.
- **Direktlink auf jeden Eintrag** (z. B. `#/voegel/amsel`): öffnet die Kategorie, hebt die Karte hervor und zeigt sie gross.
  In der Grossansicht teilt der Knopf «Teilen» diesen Link (auf dem Handy über das Teilen-Menü, sonst in die Zwischenablage).
- **Verwechslungsgefahr:** Auf der Textseite steht bei ähnlichen Arten «Nicht verwechseln mit …» mit dem Unterschied
  und einem Link zum anderen Eintrag (z. B. Fichte und Weisstanne, Reh und Rothirsch, Bärlauch und Herbstzeitlose).
- **Tierstimmen:** Bei Tieren mit typischem Ruf spielt ein Knopf auf der Textseite die Aufnahme ab (mit Quellenangabe).
- **Lightbox:** Ein Klick zeigt Bilder und Text bildschirmfüllend. Bilder lassen sich zoomen
  (Mausrad, Doppelklick, zwei Finger, Tasten `+` `-` `0`), vergrössert verschieben und auf dem Handy wischen.
- **Menü:**
  - *Jetzt zu sehen:* was laut Steckbrief in diesem Monat blüht, fliegt, wächst oder laicht, nach Kategorien geordnet.
  - *Quiz für die Klasse:* Bilder einer Kategorie bildschirmfüllend für den Beamer; Leertaste zeigt die Lösung,
    die nächste Leertaste das nächste Bild.
  - *PDF drucken:* eine Kategorie als PDF speichern oder drucken, wahlweise
    als **Steckbriefe** (A4, 8 Einträge pro Seite, Bildquelle klein im jeweiligen Bild),
    als **Arbeitsblatt** (Bilder mit Nummer und Schreiblinie, Lösungsblatt am Schluss) oder
    als **Memory** zum Ausschneiden (eine Seite Bildkarten, eine Seite Namenskarten).
  - *Einstellungen:* Anleitung, wie man die Seite als App installiert (mit Knopf, wo der Browser das anbietet), und alle Bilder für die Nutzung ohne Internet herunterladen.
  - *Admin:* Hinweisseite mit Link, die Verwaltung öffnet sich in einem neuen Tab.
  - *Copyright:* Urheberrecht und vollständiger Bildnachweis (mit «eigenes Foto» und «zugeschnitten»).
  - *LernApp:* Kategorien wählen, Bilder erkennen und den Namen eintippen; wiederholt wird nach dem Leitner-System, der Fortschritt bleibt auf dem Gerät gespeichert.
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
- **Verwechslungsgefahr** pro Eintrag pflegen (Name des anderen Eintrags und Unterschied).
- **Tierstimme** pro Eintrag von Commons übernehmen (Adresse der Tondatei einfügen) oder entfernen, auch über die Liste.
- **QR-Codes:** Jeder Eintrag zeigt seinen Direktlink mit QR-Code; pro Kategorie lassen sich alle QR-Codes als
  Karten (12 pro A4-Seite) drucken, etwa für einen Lehrpfad oder Posten im Schulzimmer.
- **Sicherung:** Ein Knopf lädt alle Kategorien, Einträge und Bildangaben als Datei herunter.

### Technik in Kürze

- Reines HTML, CSS und JavaScript ohne Build; die Anzeige kommt ohne Bibliotheken aus.
- Daten und Bilder in **Supabase** (Postgres-Datenbank und Speicher); gehostet auf GitHub Pages.
- Schreiben dürfen nur Admins mit zweitem Faktor (Row Level Security). Strenge Content-Security-Policy:
  Die Seiten laden nur eigene Dateien und die erlaubten Quellen.
- **Wachhalten:** Ein kostenloses Supabase-Projekt schläft nach etwa einer Woche ohne Zugriff ein. Eine automatische
  Aufgabe auf GitHub (GitHub Actions) fragt die Datenbank darum jeden Morgen einmal ab.

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
- **LernApp: dranbleiben:** Auf der Startseite erinnert ein Hinweis, wenn Begriffe fällig sind («Heute warten 12 Begriffe
  auf dich … Jetzt lernen»). Die LernApp zählt die Lernserie (Tage in Folge) und zeigt den Fortschritt pro Kategorie.
- **LernApp: leichter einsteigen, besser behalten:** Neue Begriffe wählt man zuerst aus 4 Namen aus, erst ab Fach 2
  tippt man selbst. Ein Tipp-Knopf zeigt den ersten Buchstaben und die Länge; mit Tipp richtig zählt nur halb. Nach jeder
  Antwort erscheint ein Merksatz aus der Beschreibung, damit sich der Name mit einer Eigenschaft verknüpft.
- **LernApp in kleinen Portionen:** Neue Begriffe kommen dosiert dazu, höchstens 10 pro Tag (freiwillig mehr möglich),
  statt alle auf einmal. Abgefragt wird in Runden zu höchstens 15 Fragen mit einer kurzen Auswertung am Schluss.
  So bleibt das Leitner-System wirksam und das Lernen überschaubar.
- **LernApp mit allen Bildern:** Während der Abfrage lässt sich zwischen den Bildern eines Eintrags umschalten
  (ohne die Textseite mit der Lösung), und die Bilder lassen sich wie in der Grossansicht vergrössern, ohne dass das
  Eingabefeld verschwindet. Die Quellenangabe erscheint erst nach der Antwort, weil der Dateiname oft den Namen verrät.
- **Bewusst leere Bildplätze:** Wer ein Bild entfernt, lässt den Platz bewusst leer; «Fehlende Bilder übernehmen»
  füllt ihn nicht mehr mit einem zufälligen Suchtreffer. Im Eintrag lässt sich das mit «Leer lassen» bzw.
  «Wieder füllen lassen» ändern, ein neues Bild hebt es von selbst auf.
- **LernApp:** Nach der Wahl beliebiger Kategorien zeigt sie das Bild eines zufälligen Eintrags, und man tippt den Namen ein.
  Kleine Tippfehler und ä/ae spielen keine Rolle. Wiederholt wird nach dem **Leitner-System** mit 5 Fächern:
  Wer richtig antwortet, bekommt den Begriff erst nach 1, 3, 7 und schliesslich 30 Tagen wieder; wer falsch antwortet,
  beginnt beim Begriff wieder vorn. So wandern die Namen ins Langzeitgedächtnis. Angezeigt wird, wie viele Einträge
  zu lernen, wie viele richtig beantwortet und wie viele im Langzeitgedächtnis sind. Auswahl und Fortschritt bleiben
  auf dem Gerät gespeichert; eine neue Auswahl beginnt von vorn.
- **Als App installieren:** Die Einstellungen erklären für iPhone/iPad, Android und Computer, wie man die Seite als App
  installiert. Wo der Browser es anbietet, genügt der Knopf «Jetzt installieren».
- **Neue Versionen sofort sichtbar:** Die Offline-App fragt Seite und Programmdateien jetzt immer beim Server nach,
  statt bis zu 10 Minuten eine ältere Kopie aus dem Browser zu zeigen.

### 28. September – Für den Unterricht und für den Betrieb

Nach der LernApp stand die Frage, was die Seite im Schulalltag noch nützlicher macht. Umgesetzt wurde alles in einem Schritt:

- **Suche** über alle Einträge direkt unter dem Titel.
- **Direktlinks** auf einzelne Einträge und ein Knopf «Teilen» in der Grossansicht. Darauf bauen die **QR-Codes** der
  Verwaltung auf: pro Eintrag einer, pro Kategorie ein Druckbogen mit 12 Karten pro Seite.
- **Jetzt zu sehen:** Die Seite liest aus den Steckbriefen (Blütezeit, Flugzeit, Laichzeit, Aktivzeit …),
  was im laufenden Monat draussen zu finden ist. Zeiträume über den Jahreswechsel («November–März») werden richtig erkannt.
- **Entdeckung des Tages** auf der Startseite.
- **Quiz für die Klasse:** Präsentationsmodus für den Beamer, bedienbar mit Leertaste, Pfeiltasten oder einem
  Präsentations-Klicker, mit Zähler und Abschluss.
- **Arbeitsblätter und Memory** zum Ausdrucken: Das Arbeitsblatt zeigt die Bilder gemischt mit Schreiblinie, das
  Lösungsblatt folgt am Schluss. Das Memory hat 16 Bild- und 16 Namenskarten mit Schnittlinien.
- **Verwechslungsgefahr:** 36 Paare ähnlicher Arten mit dem entscheidenden Unterschied, darunter die für die Sicherheit
  wichtigen Giftpflanzen und Giftpilze (Herbstzeitlose, Weisser Germer, Satans-Röhrling, Pantherpilz).
- **Tierstimmen:** Aufnahmen von Wikimedia Commons (meist von xeno-canto) für Vögel, Frösche, Kröten, Heuschrecken und
  einige Säugetiere. Commons wandelt die Aufnahmen in MP3 um, das jeder Browser abspielt. Die Aufnahmen liegen wie die
  Bilder im eigenen Speicher und stehen im Bildnachweis.
- **Sicherung** der Datenbank als Datei aus der Verwaltung.
- **Wachhalten der Datenbank:** Eine tägliche automatische Abfrage über GitHub Actions verhindert, dass das kostenlose
  Supabase-Projekt wegen Untätigkeit pausiert wird (zum Beispiel in den Sommerferien).
- **Entdeckung des Tages mit «Noch eine»:** Die Tagesauswahl bleibt für alle gleich, wechselt aber die Kategorie von Tag zu Tag
  und wirkt zufälliger; der Knopf «Noch eine» zeigt beliebig viele weitere Einträge.
- **Marke toj-apps:** Titel und Copyright lauten neu «Natur und Schweiz by toj-apps» bzw. «© 2026 toj-apps».

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
| Wachhalten über GitHub Actions statt bezahltem Supabase-Plan | kostenlos; die Abfrage liest nur öffentliche Daten mit dem öffentlichen Schlüssel |
| Sicherung als Datei aus der Verwaltung | die kostenlose Supabase-Stufe hat keine automatischen Sicherungen zum Herunterladen |
| Tierstimmen als MP3 im eigenen Speicher | spielt in allen Browsern, unabhängig von Wikimedia; nicht im Offline-Speicher, weil Browser Töne stückweise laden |
| QR-Codes nur in der Verwaltung | die Anzeige bleibt ohne Bibliothek; gedruckt wird ohnehin von der Lehrperson |
| «Jetzt zu sehen» aus den Steckbriefen gelesen | keine neue Pflegearbeit; wer den Steckbrief pflegt, pflegt die Monatsliste mit |

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
| `013_leere_plaetze.sql` | bewusst leere Bildplätze, die nicht automatisch gefüllt werden |
| `014_verwechslung_tierstimmen.sql` | Verwechslungsgefahr (36 Paare) und Tierstimmen; der Speicher nimmt neu auch MP3 an |

## Offen und geplant

- Weitere Ideen für die LernApp (z. B. Abfrage des lateinischen Namens oder «Welches Tier ruft da?» mit den Tierstimmen).
- Einzelne Bildkorrekturen, die in der Verwaltung gemacht werden sollen (z. B. doppelte oder falsche Fotos).

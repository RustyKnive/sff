| 2.11.1 | 30.9.2026 | Feld mit dem Lernziel so breit wie Suchzeile und Karten, am Computer und auf dem Handy |
| 2.11.0 | 30.9.2026 | Lernziel oben in jeder Kategorie, 37 weitere Verwechslungspaare (Datenbank-Version 19) |
| `019_lernziele_verwechslungen.sql` | Lernziel pro Kategorie (Spalte `goal`, 22 Sätze) und 37 weitere Verwechslungspaare |
| 2.10.0 | 30.9.2026 | Lernfortschritt auf den Kacheln der Startseite: Ring mit «6/16» bzw. «✓ gelernt» über alle Lernsessions |
| 2.9.0 | 30.9.2026 | Besser zurechtfinden: Einführung beim ersten Besuch, «Hilfe» im Menü, «?»-Erklärungen, Spiele auf eigener Seite mit Knopf «Spielen» und Wegen aus jeder Kategorie |
| 2.8.0 | 30.9.2026 | Zwei neue Spiele am Ende der LernApp: Verwechslungs-Duell (zwei ähnliche Arten, danach der Unterschied) und Steckbrief-Detektiv (Hinweise nacheinander, Punkte fürs frühe Erraten) |
| 2.7.0 | 30.9.2026 | Memory am Bildschirm am Ende der LernApp: 4 × 4 Karten, bis zu 8 zufällige Paare aus Bild und Name |
# Natur und Schweiz – Werdegang der Website

Lern- und Nachschlageseite für die Sekundarstufe I: Kategorien wie Bäume, Amphibien oder Berge mit Einträgen,
je bis zu 4 Bilder, Beschreibung und Steckbrief. Diese Datei hält fest, was die Seite kann und wie sie dahin gekommen ist.
Sie wird bei jeder neuen Möglichkeit ergänzt.

**Stand:** 30. September 2026 · Version 2.11.1 (Datenbank 19) · 22 Kategorien mit 357 sichtbaren Einträgen · rund 1420 eigene Bilder (davon 19 KI-Infografiken) ·
73 Verwechslungspaare (71 im Duell) · Tierstimmen für 28 Arten

---

## Was die Seite heute kann

### Anzeige (index.html)

- **Übersicht** mit einer Kachel pro Kategorie (Titelbild, Anzahl Einträge), bei Kategorien in einer Lernsession mit **Lernfortschritt** (Ring und «6/16», ganz gelernt «✓ gelernt»), und der **Entdeckung des Tages**
  (jeden Tag ein anderer Eintrag aus wechselnden Kategorien, für alle gleich; «Noch eine» zeigt einen weiteren zufälligen Eintrag).
- **Suche** über alle Kategorien: deutscher Name, lateinischer Name oder Kategorie, ohne Rücksicht auf Umlaute und Grossschreibung.
- **Knöpfe «Lernen», «Spielen» und «Drucken»** gleich neben der Suche (Übersicht und Kategorien): führen direkt zur LernApp, zu den Spielen und zum PDF-Druck, damit man diese auch ohne Menü findet. Ein «?» daneben erklärt kurz, was die Seite kann.
- **Einführung beim ersten Besuch:** vier kurze Schritte (Ansehen – Lernen – Spielen – Womit beginnen?), überspringbar, erscheint danach nicht mehr von selbst.
- **Kategorie** mit einer Karte pro Eintrag: durch die Bilder und den Steckbrief blättern (Pfeile, Punkte, Tastatur).
  Es werden nur die vorhandenen Bilder gezeigt.
  Unter der Suche führen Knöpfe direkt zu den Spielen mit dieser Kategorie; ein «?» erklärt die Bedienung der Karten.
- **Direktlink auf jeden Eintrag** (z. B. `#/voegel/amsel`): öffnet die Kategorie, hebt die Karte hervor und zeigt sie gross.
  In der Grossansicht teilt der Knopf «Teilen» diesen Link (auf dem Handy über das Teilen-Menü, sonst in die Zwischenablage).
- **Verwechslungsgefahr:** Auf der Textseite steht bei ähnlichen Arten «Nicht verwechseln mit …» mit dem Unterschied
  und einem Link zum anderen Eintrag (z. B. Fichte und Weisstanne, Reh und Rothirsch, Bärlauch und Herbstzeitlose).
- **Tierstimmen:** Bei Tieren mit typischem Ruf spielt ein Knopf auf der Textseite die Aufnahme ab (mit Quellenangabe).
- **Lightbox:** Ein Klick zeigt Bilder und Text bildschirmfüllend. Bilder lassen sich zoomen
  (Mausrad, Doppelklick, zwei Finger, Tasten `+` `-` `0`), vergrössert verschieben und auf dem Handy wischen.
  Passt ein Bild nicht, meldet der Knopf «Melden» es an die Verwaltung (freiwillig mit kurzer Begründung, ohne Namen).
  Einen Fehler im Text meldet der Knopf «Fehler im Text melden» auf der Textseite (mit kurzer Beschreibung, ohne Namen);
  die Meldenden sehen danach eine Nummer, mit der sie den gefundenen Fehler bei der Lehrperson vorweisen können.
- **Menü:**
  - *Jetzt zu sehen:* was laut Steckbrief in diesem Monat blüht, fliegt, wächst oder laicht, nach Kategorien geordnet.
  - *Quiz für die Klasse:* Bilder einer Kategorie bildschirmfüllend für den Beamer, pro Eintrag wechseln die Bilder alle 2 Sekunden; Leertaste zeigt die Lösung,
    die nächste Leertaste den nächsten Eintrag.
  - *PDF drucken:* eine Kategorie als PDF speichern oder drucken, wahlweise
    als **Steckbriefe** (A4, 8 Einträge pro Seite, Bildquelle klein im jeweiligen Bild),
    als **Arbeitsblatt** (Bilder mit Nummer und Schreiblinie, Lösungsblatt am Schluss) oder
    als **Memory** zum Ausschneiden (eine Seite Bildkarten, eine Seite Namenskarten).
    Alle Einträge der Kategorie sind angewählt; einzelne lassen sich vor dem Drucken abwählen.
  - *Hilfe:* was die Seite kann, «Womit beginne ich?», die Einführung zum nochmals Ansehen und eine Anleitung zu allen Möglichkeiten (aufklappbar nach Themen).
  - *Einstellungen:* Anleitung zum Installieren als App (mit Knopf, wo der Browser das anbietet) und alle Bilder für die Nutzung ohne Internet herunterladen.
  - *Admin:* Hinweisseite mit Link, die Verwaltung öffnet sich in einem neuen Tab.
  - *Copyright:* Urheberrecht und vollständiger Bildnachweis (mit «eigenes Foto», «zugeschnitten» und «KI-generiert»).
  - *LernApp:* Kategorien wählen, Bilder erkennen und den Namen eintippen; wiederholt wird nach dem Leitner-System, der Fortschritt bleibt auf dem Gerät gespeichert.
    Mehrere **Lernsessions** nebeneinander, jede mit eigenen Kategorien, eigener Farbe und eigenem Fortschritt; umschalten über die farbige Leiste, löschen unter «Lernsessions verwalten».
    Ein «?» erklärt den Karteikasten mit seinen fünf Fächern.
  - *Spiele:* **Memory** am Bildschirm (4 × 4 Karten, bis zu 8 zufällige Paare aus Bild und Name), **Verwechslungs-Duell** (welches von zwei ähnlichen Bildern zeigt die gesuchte Art, danach der Unterschied) und **Steckbrief-Detektiv** (Hinweise nacheinander, wer früh richtig rät, bekommt mehr Punkte); jeweils für eine Kategorie oder alle gemischt.
- **Offline-App:** Die Seite lässt sich auf dem Handy installieren und funktioniert ohne Internet.
- Hell- und Dunkelmodus nach Einstellung des Geräts.

### Verwaltung (admin.html)

- Anmeldung mit E-Mail, Passwort und Code aus einer Authenticator-App (Zwei-Faktor).
- Kategorien und Einträge anlegen, bearbeiten, sortieren, ein- und ausblenden, löschen.
- Einträge in eine andere Kategorie verschieben.
- **Bilder:** hochladen, von Wikimedia Commons übernehmen («Fehlende Bilder übernehmen», «Anderes Bild suchen»,
  ein bestimmtes Commons-Bild über seine Adresse oder viele auf einmal über eine Liste), dauerhaft zuschneiden und den Ausschnitt für die kleine Vorschau festlegen.
- **Mit Claude (über claude.ai, ohne Zusatzkosten):**
  - *Neue Kategorie* (Thema und Anzahl Einträge frei wählbar): Claude prüft auf Überschneidungen und schreibt alle Einträge; Vorschlag durchsehen, abwählen, korrigieren oder abbrechen.
  - *Neuer Eintrag* über einen Namen oder ein Foto: Claude bestimmt die Art bzw. schreibt den Eintrag,
    das Formular lässt sich vor dem Übernehmen ändern. Ein eigenes Foto wird Bild 1.
- **Verwechslungsgefahr** pro Eintrag pflegen (Name des anderen Eintrags und Unterschied).
- **Tierstimme** pro Eintrag von Commons übernehmen (Adresse der Tondatei einfügen) oder entfernen, auch über die Liste.
- **QR-Codes:** Jeder Eintrag zeigt seinen Direktlink mit QR-Code; pro Kategorie lassen sich alle QR-Codes als
  Karten (12 pro A4-Seite) drucken, etwa für einen Lehrpfad oder Posten im Schulzimmer.
- **Gemeldete Bilder:** Die Übersicht listet die Meldungen aus der Grossansicht mit Vorschau, Anzahl und Begründung;
  «Anderes Bild suchen» wechselt zum Eintrag mit allen 4 Bildern und zeigt dort Vorschläge zur Auswahl, «Erledigt» schliesst die Meldung. Beim Bildplatz im Eintrag steht die Meldung ebenfalls.
  Ein neues Bild oder «Bild entfernen» erledigt sie automatisch.
- **Gemeldete Textfehler:** eigene Liste in der Übersicht mit Nummer, Eintrag, Anzahl und Beschreibung; «Erledigt»
  schliesst die Meldung. Im Eintrag steht die Meldung oben, mit «Meldung erledigt».
- **Sicherung:** Ein Knopf lädt alle Kategorien, Einträge und Bildangaben als Datei herunter.

### Technik in Kürze

- Reines HTML, CSS und JavaScript ohne Build; die Anzeige kommt ohne Bibliotheken aus.
- Daten und Bilder in **Supabase** (Postgres-Datenbank und Speicher); seit 30.9.2026 auf dem eigenen Webspace bei Hostpoint (https://je-net.ch/sff/), vorher auf GitHub Pages.
- Schreiben dürfen nur Admins mit zweitem Faktor (Row Level Security). Strenge Content-Security-Policy:
  Die Seiten laden nur eigene Dateien und die erlaubten Quellen.
- **Wachhalten:** Ein kostenloses Supabase-Projekt schläft nach etwa einer Woche ohne Zugriff ein. Eine automatische
  Aufgabe auf GitHub (GitHub Actions) fragt die Datenbank darum jeden Morgen einmal ab.
- **Versionen:** Website und Datenbank tragen Versionsnummern (siehe «Versionen» unten); passt die Datenbank nicht zur Website,
  meldet die Seite, welches Update fehlt.

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
- **Fehler behoben:** Bei Einträgen mit Tierstimme oder Verwechslungsgefahr zeigte die Grossansicht nur den Text, und die Bilder liessen
  sich nicht anwählen (der Browser sprang zum Knopf bzw. Link auf der Textseite). Jetzt öffnet sie wie gewohnt beim Bild.
- **Mehrere Lernsessions:** Die LernApp kann mehrere Lernsessions gleichzeitig offen haben, z. B. «Bäume» und «Vögel, Amphibien».
  Jede hat eigene Kategorien, eine eigene Farbe (8 zur Auswahl) und einen eigenen Fortschritt. Eine farbige Leiste über der Abfrage
  schaltet um und zeigt, wie viele Begriffe pro Session heute offen sind; der Hinweis auf der Startseite zählt alle zusammen.
  Unter «Lernsessions verwalten» lassen sich Sessions öffnen und löschen. Der bisherige Lernstand wurde zur ersten Session.
- **Darstellung:** Suchfeld, Lernhinweis und Entdeckung des Tages gehen über die ganze Breite der Einträge, der Titel der
  Startseite bleibt auch auf dem Handy auf einer Zeile, und «Lernsessions verwalten» steht in der Leiste neben «+ Neue Lernsession».
- **Anleitung:** Unter Menü → «Einstellungen» steht eine Anleitung zu allen Möglichkeiten der App, nach Themen aufklappbar.
  Dafür ist der Satz «Wähle eine Kategorie.» auf der Startseite weggefallen, die Übersicht erklärt sich selbst.
- **Technische Dokumentation:** `docs/TECHNIK.md` beschreibt Aufbau, Sicherheit, Offline-Betrieb, die wichtigsten Lösungen,
  Tests und die Probleme unterwegs – für alle, die verstehen wollen, wie die Seite gebaut ist.
- **Fehler behoben:** Beim Quiz für die Klasse blieben Auswahl und Text über dem Bild sichtbar, sobald der Vollbildmodus
  ansprang. Jetzt geht nur das Quiz selbst in den Vollbildmodus.
- **Quiz mit allen Bildern:** Pro Eintrag wechseln im Quiz die Bilder alle 2 Sekunden, ohne Text und Beschriftung.
  So hat die Klasse mehr Hinweise (Blätter, Früchte, Rinde …), ohne dass der Name verraten wird.
- **Versionierung (Version 2.0.0):** Website und Datenbank haben jetzt Versionsnummern. Die Website zählt nach dem Muster
  Hauptversion.Funktion.Korrektur (2.1.0 = neue Möglichkeit, 2.0.1 = Korrektur), die Datenbank nach der Nummer der zuletzt
  eingespielten Änderung (15). Beide Nummern stehen unter Einstellungen → «Version» und in der Verwaltung. Fehlt nach einem
  Update der Website eine Datenbank-Änderung, sagt die Seite genau, welche, statt einfach keine Inhalte zu zeigen.
  Jede Version ist auf GitHub als «Tag» abgelegt und lässt sich jederzeit wiederherstellen.

### 29. September – Unpassende Bilder melden (Version 2.1.0)

- **Melden statt suchen:** Einige Bilder passen noch nicht. Damit Schülerinnen, Schüler und Lehrpersonen darauf hinweisen
  können, hat jede Bildseite der Grossansicht den Knopf «Melden». Ein kleines Fenster zeigt das Bild, fragt freiwillig nach
  dem Grund und schickt die Meldung ohne Namen ab.
- **Liste in der Verwaltung:** Die Übersicht zeigt alle Meldungen mit Vorschau, Anzahl und Begründung. «Anderes Bild suchen»
  ersetzt das Bild direkt, «Erledigt» schliesst die Meldung. Ursprünglich war eine Mail pro Meldung gewünscht; dafür bräuchte
  es aber einen Maildienst mit eigenem Schlüssel. Die Liste kostet nichts und funktioniert auch auf Schul-iPads ohne Mail-App.

### 29. September – Einträge fürs PDF abwählen (Version 2.2.0)

- **Auswahl beim Drucken:** Unter «PDF drucken» stehen alle Einträge der gewählten Kategorie, standardmässig angewählt.
  Einzelne lassen sich abwählen («Alle» und «Keine» helfen bei vielen Einträgen). So lässt sich auch aus einer Kategorie
  mit mehr als 16 Einträgen genau die gewünschte Auswahl drucken.
- **Keine feste Zahl mehr:** Die Regel «genau 16 sichtbare Einträge pro Kategorie» fällt weg, ebenso die Obergrenze
  beim Anlegen einer Kategorie mit Claude. Claude prüft auch nicht mehr, ob eine Kategorie zu «Natur und Schweiz» passt;
  welche Kategorien es gibt, entscheidet die Lehrperson. Geprüft werden nur noch Überschneidungen mit Bestehendem.

### 29. September – Ersatzbild selbst auswählen (Version 2.3.0)

- **Vorschläge statt Zufall:** «Anderes Bild suchen» hat bisher gleich den nächsten Treffer gespeichert. Ob der besser war,
  liess sich so nicht beurteilen. Jetzt zeigt die Verwaltung unter den 4 Bildern des Eintrags sechs Vorschläge von
  Wikimedia Commons (der betroffene Platz ist markiert). Ein Klick nimmt das Bild, «Weitere Vorschläge» sucht weiter,
  «Abbrechen» behält das alte Bild.
- **Aus der Meldung direkt zum Eintrag:** «Anderes Bild suchen» bei den gemeldeten Bildern wechselt zum Eintrag und öffnet
  die Auswahl für den gemeldeten Platz. Wird ein Vorschlag gewählt, ist die Meldung erledigt.

### 29. September – KI-Bilder kennzeichnen (Version 2.4.0)

- **Richtiger Bildnachweis:** Die 19 Infografiken der Kategorie Wetterphänomene wurden mit ChatGPT erstellt. Weil sie
  keine Quelle hatten, standen sie im Bildnachweis und im Druck als «eigenes Foto». Neu gilt: Steht bei einem Bild ohne
  Quelle etwas unter «Dateiname», erscheint genau das, hier «KI-generiert mit ChatGPT (OpenAI)». Die Seite «Copyright»
  weist zusätzlich auf die KI-Infografiken hin.
- **Warum nur ein Hinweis:** Rein maschinell erzeugte Bilder sind nach Schweizer Urheberrecht in der Regel nicht geschützt,
  und OpenAI überlässt die Rechte der Person, die sie erzeugt. Ein Copyright-Vermerk ist darum nicht vorgeschrieben,
  die Kennzeichnung sorgt aber für Transparenz.

### 30. September – Eigener Webspace (Version 2.4.1)

- **Neue Adresse:** Die Seite läuft neu unter https://je-net.ch/sff/ auf dem eigenen Webspace bei Hostpoint. Die Datenbank
  und die Bilder bleiben in Supabase, an Inhalten und Funktionen ändert sich nichts.
- **Alte Adresse leitet weiter:** Wer die alte Adresse auf GitHub Pages aufruft, auch über einen gedruckten QR-Code oder
  einen Direktlink zu einem Eintrag, landet automatisch an derselben Stelle der neuen Seite. Die installierte App muss
  man einmal von der neuen Adresse aus neu installieren.
- **Einstellungen des Webservers:** Die Seite erzwingt HTTPS, lässt sich nicht in fremde Seiten einbetten, und neue
  Versionen sind nach dem Hochladen sofort sichtbar.

### 30. September – LernApp und Druck besser sichtbar (Version 2.5.0)

- **Knöpfe neben der Suche:** Wer die Seite zum ersten Mal besucht, fand LernApp und PDF-Druck nur über das Menü. Neu
  stehen «Lernen» und «Drucken» auf derselben Zeile wie die Suche, auf der Übersicht und in jeder Kategorie. Aus einer
  Kategorie heraus ist diese beim Drucken schon gewählt. Auf schmalen Handys bleibt «Lernen» beschriftet (ab 2.5.1),
  «Drucken» zeigt nur das Symbol, das Suchfeld wird dafür etwas schmaler.

### 30. September – Fehler im Text melden (Version 2.6.0)

- **Fehler finden lohnt sich:** Die Seite soll auch in anderen Fächern eingesetzt werden, darum müssen die Inhalte stimmen.
  Für gefundene Fehler gibt es einen kleinen Preis. Bisher liessen sich nur Bilder melden; neu hat die Textseite der
  Grossansicht den Knopf «Fehler im Text melden». Man beschreibt, was falsch ist und wie es richtig wäre.
- **Nummer statt Name:** Nach dem Melden erscheint gross eine Nummer. Damit können Schülerinnen und Schüler den Fund bei
  der Lehrperson vorweisen, ohne dass ihr Name in der Datenbank landet.
- **In der Verwaltung:** Die Übersicht hat eine eigene Liste «Gemeldete Textfehler»; im Eintrag steht die Meldung oben.

### 30. September – Memory in der LernApp (Version 2.7.0)

- **Memory am Bildschirm:** Am Ende der LernApp steht neu ein Memory. Man wählt eine Kategorie (oder alle gemischt),
  dann liegen 16 Karten verdeckt im Raster 4 × 4: bis zu 8 zufällige Einträge, je eine Karte mit dem Bild und eine mit
  dem Namen. Zwei aufgedeckte Karten, die zusammengehören, bleiben offen, sonst drehen sie sich nach gut einer Sekunde um.
  Gezählt werden gefundene Paare und Züge. Bisher gab es das Memory nur zum Ausdrucken und Ausschneiden.
- Das Memory zählt nicht für den Lernstand der LernApp; es ist ein spielerischer Zugang zum selben Wissen.

### 30. September – Verwechslungs-Duell und Steckbrief-Detektiv (Version 2.8.0)

- **Verwechslungs-Duell:** Unter dem Memory stehen zwei ähnliche Arten nebeneinander, zum Beispiel Rotauge und Alet oder
  Fichte und Weisstanne. Gefragt wird nach einer der beiden; wer auf ein Bild tippt, sieht beide Namen und den
  Unterschied aus der Verwechslungsgefahr. Ein Duell hat bis zu 10 Paare aus der gewählten Kategorie (oder allen).
  Die Paare sind schon in der Datenbank erfasst, es braucht keine zusätzliche Pflege.
- **Steckbrief-Detektiv:** Gesucht ist ein Eintrag. Zuerst erscheint nur die erste Steckbrief-Zeile, dann die weiteren,
  die Beschreibung und zuletzt das Bild. Der Name und seine Teile sind in allen Hinweisen durch «…» ersetzt. Man wählt aus
  vier Namen; je früher die Antwort stimmt, desto mehr Punkte. «Nächster Hinweis» und jede falsche Antwort kosten einen
  Punkt. So wird Wissen über die Arten geübt, nicht nur das Erkennen am Bild.
- Beide Spiele zählen wie das Memory nicht für den Lernstand.

### 30. September – Besser zurechtfinden (Version 2.9.0)

Ein Kollege aus Bildung und Informatik hat die Seite ausführlich getestet. Sein Fazit: Die Inhalte überzeugen, schwierig
sind der allererste Kontakt und das Finden der Erklärungen. Die Spiele entdeckte er eher zufällig. Darum:

- **Einführung beim ersten Besuch:** Wer die Startseite zum ersten Mal öffnet, sieht vier kurze Schritte: Ansehen, Lernen,
  Spielen und «Womit beginnen?». Man kann sie überspringen; danach erscheint sie nicht mehr von selbst. Wer über einen
  Direktlink oder QR-Code kommt, wird nicht unterbrochen.
- **Hilfe im Menü:** Die Anleitung stand bisher unter «Einstellungen». Sie hat jetzt einen eigenen Menüpunkt «Hilfe» mit
  einer kurzen Beschreibung der Seite, dem neuen Thema «Womit beginne ich?» und einem Knopf, der die Einführung nochmals zeigt.
- **«?»-Symbole:** Neben der Suche, in jeder Kategorie und beim Karteikasten der LernApp erklärt ein «?» in wenigen Sätzen,
  was man hier tun kann. Am Computer erscheint die Erklärung schon beim Darüberfahren.
- **Spiele mit eigener Seite:** Memory, Duell und Detektiv stehen nicht mehr am Ende der LernApp, sondern auf der Seite
  «Spiele» (Menü und neuer Knopf «Spielen» neben der Suche). In jeder Kategorie führen Knöpfe direkt zum gewünschten Spiel,
  die Kategorie ist dann schon gewählt.
- Auf dem Handy steht das Suchfeld jetzt allein auf der ersten Zeile, damit es trotz der zusätzlichen Knöpfe breit genug bleibt.

### 30. September – Lernfortschritt auf der Startseite (Version 2.10.0)

- **Fortschritt über die ganze Seite:** Bisher sah man den Lernstand nur in der LernApp. Neu zeigt jede Kachel einer
  Kategorie, die man in einer Lernsession lernt, einen kleinen Ring mit «6/16»: so viele Einträge sind schon richtig
  beantwortet (über alle Lernsessions hinweg). Ist alles gelernt, steht dort «✓ gelernt». Auch dieser Wunsch stammt aus dem
  Feedback des Kollegen. Der Stand bleibt wie bisher nur auf dem Gerät.

### 30. September – Lernziele und mehr Verwechslungen (Version 2.11.0)

- **Lernziel pro Kategorie:** Oben in jeder Kategorie steht jetzt in einem Satz, was man danach können soll, zum Beispiel
  «Die wichtigsten Waldbäume der Schweiz an Wuchs, Blättern oder Nadeln, Früchten und Rinde erkennen und benennen.»
  Das macht aus der Nachschlage-Seite deutlicher ein Lernangebot. Die 22 Sätze hat Claude entworfen, die Lehrperson hat sie
  geprüft. In der Verwaltung lässt sich das Lernziel pro Kategorie ändern; neue Kategorien bekommen über den Claude-Auftrag
  gleich einen Vorschlag.
- **37 weitere Verwechslungspaare:** «Nicht verwechseln mit …» war der Teil, den der Kollege am besten fand, aber nur bei
  einem Teil der Einträge vorhanden. Neu dazu kommen zum Beispiel Blindschleiche und Kreuzotter, Vipernatter und Aspisviper,
  Maronen-Röhrling und Steinpilz, Föhn und Bise oder Wiesen-Fuchsschwanz und Wiesen-Lieschgras. Damit hat auch das
  Verwechslungs-Duell 71 statt 34 Paare. Bei Bergen, Gewässern, Sehenswürdigkeiten und Naturwundern gibt es bewusst keine,
  weil dort kaum echte Verwechslungen vorkommen.
- Auf dem Handy steht das Suchfeld jetzt wirklich allein auf der ersten Zeile (in 2.9.0 hatte eine andere Regel das verhindert).

---

## Versionen

| Version | Datum | Inhalt |
|---|---|---|
| 1.0.0 | 23.9.2026 | erste Version: eine einzige HTML-Datei, 9 Kategorien mit je 9 Einträgen |
| 2.0.0 | 28.9.2026 | Stand nach Datenbank, Verwaltung, Offline-App, LernApp mit Lernsessions, Unterrichtsmaterial, Verwechslungsgefahr, Tierstimmen und Anleitung; Einführung der Versionierung (Datenbank-Version 15) |
| 2.1.0 | 29.9.2026 | Unpassende Bilder melden: Knopf «Melden» in der Grossansicht, Liste «Gemeldete Bilder» in der Verwaltung (Datenbank-Version 16) |
| 2.2.0 | 29.9.2026 | PDF: einzelne Einträge abwählen; keine feste Zahl von 16 Einträgen und keine Themenprüfung mehr beim Anlegen mit Claude |
| 2.3.0 | 29.9.2026 | «Anderes Bild suchen» zeigt Vorschläge zur Auswahl unter den 4 Bildern des Eintrags, auch aus den gemeldeten Bildern |
| 2.4.0 | 29.9.2026 | KI-generierte Bilder im Bildnachweis und im Druck gekennzeichnet (Datenbank-Version 17) |
| 2.4.1 | 30.9.2026 | Umzug auf den eigenen Webspace bei Hostpoint (https://je-net.ch/sff/), alte Adresse leitet weiter; Datenbank bleibt in Supabase |
| 2.5.0 | 30.9.2026 | Knöpfe «Lernen» und «Drucken» neben der Suche, damit LernApp und PDF-Druck ohne Menü zu finden sind |
| 2.5.1 | 30.9.2026 | Auf dem Handy bleibt der Knopf «Lernen» beschriftet, das Suchfeld wird dafür schmaler |
| 2.6.0 | 30.9.2026 | Fehler im Text melden: Knopf auf der Textseite, Meldungsnummer für die Meldenden, Liste «Gemeldete Textfehler» in der Verwaltung (Datenbank-Version 18) |
| 2.6.1 | 30.9.2026 | LernApp: Einzahl bei «1 neuer Begriff wartet noch» und «1 weiterer neuer Begriff» |
| 2.6.2 | 30.9.2026 | Knopf «Lernen» neben der Suche entfällt, solange auf der Übersicht der Lernhinweis erscheint (er führt selbst zur LernApp) |

Ab 2.0.0 bekommt jede Veröffentlichung hier eine Zeile.

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
| Anzahl Einträge pro Kategorie frei (bis 2.1.0 genau 16) | beim Drucken lassen sich einzelne Einträge abwählen; 16 ergeben weiterhin 2 volle A4-Seiten |
| Schweizer Rechtschreibung (immer «ss») | Zielpublikum Schweizer Schulen |
| Wachhalten über GitHub Actions statt bezahltem Supabase-Plan | kostenlos; die Abfrage liest nur öffentliche Daten mit dem öffentlichen Schlüssel |
| Eigener Webspace, Datenbank bleibt in Supabase | eigene Adresse und eigene Einstellungen des Webservers; die Datenbank samt Verwaltung und Anmeldung müsste sonst neu gebaut werden |
| Sicherung als Datei aus der Verwaltung | die kostenlose Supabase-Stufe hat keine automatischen Sicherungen zum Herunterladen |
| Tierstimmen als MP3 im eigenen Speicher | spielt in allen Browsern, unabhängig von Wikimedia; nicht im Offline-Speicher, weil Browser Töne stückweise laden |
| Versionsnummern für Website und Datenbank, Prüfung beim Start | eine neue Website mit veralteter Datenbank ist der gefährlichste Fehler; so wird er sofort und verständlich gemeldet |
| QR-Codes nur in der Verwaltung | die Anzeige bleibt ohne Bibliothek; gedruckt wird ohnehin von der Lehrperson |
| «Jetzt zu sehen» aus den Steckbriefen gelesen | keine neue Pflegearbeit; wer den Steckbrief pflegt, pflegt die Monatsliste mit |
| Bildmeldungen in der Datenbank statt per Mail | eine Mail bräuchte einen eigenen Server bzw. Maildienst mit Schlüssel; so ist es kostenlos, funktioniert auch auf Schulgeräten ohne Mail-App, und die Meldungen stehen gleich neben den Werkzeugen zum Ersetzen |

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
| `015_versionierung.sql` | Die Datenbank kennt ihre Version (Tabelle `app_meta`), damit Website und Datenbank zusammenpassen |
| `016_bildmeldungen.sql` | Meldungen zu unpassenden Bildern (Tabelle `image_reports`, Funktion zum Melden ohne Anmeldung) |
| `017_ki_bilder.sql` | Kennzeichnung der 19 mit ChatGPT erzeugten Infografiken (Wetterphänomene) |
| `018_textmeldungen.sql` | Meldungen zu Fehlern im Text (Platz 0 in `image_reports`, Funktion `report_text` mit Meldungsnummer) |

## Offen und geplant

- Weitere Ideen für die LernApp (z. B. Abfrage des lateinischen Namens oder «Welches Tier ruft da?» mit den Tierstimmen).
- Einzelne Bildkorrekturen, die in der Verwaltung gemacht werden sollen (z. B. doppelte oder falsche Fotos).

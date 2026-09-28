-- Verwechslungsgefahr und Tierstimmen.
--   entries.confusions: [{name, diff}], «Nicht verwechseln mit …» auf der Textseite (Link, falls es den Eintrag gibt)
--   entries.sound_path / sound_page / sound_file: Tierstimme (MP3 im Bucket «bilder») mit Quelle wie bei den Bildern
--   Bucket «bilder»: erlaubt neu auch MP3 (Tierstimmen)
-- Einmal im Supabase-Dashboard unter «SQL Editor» ausführen, BEVOR die neue index.js online ist
-- (die Anzeige fragt die Spalten ab). Lässt sich gefahrlos mehrmals ausführen.

begin;

alter table public.entries
  add column if not exists confusions jsonb not null default '[]'::jsonb,
  add column if not exists sound_path text,
  add column if not exists sound_page text constraint entries_sound_page_http check (sound_page is null or sound_page ~* '^https?://'),
  add column if not exists sound_file text;

update storage.buckets
   set allowed_mime_types = array['image/jpeg', 'audio/mpeg']
 where id = 'bilder';

-- Verwechslungspaare: der Satz erscheint bei beiden Einträgen. Gibt es den zweiten Namen nicht als Eintrag
-- (z. B. Weisser Germer), erscheint der Hinweis nur beim ersten, ohne Link.
with pairs(a, b, diff) as (values
  ('Fichte (Rottanne)', 'Weisstanne', 'Die Fichte hat spitze, rundum abstehende Nadeln und hängende Zapfen, die ganz abfallen; die Weisstanne hat stumpfe Nadeln mit zwei weissen Streifen auf der Unterseite und aufrechte Zapfen, die am Baum zerfallen.'),
  ('Buche', 'Hagebuche', 'Die Buche hat glattrandige, am Rand bewimperte Blätter und eine glatte, silbergraue Rinde; die Hagebuche hat doppelt gesägte, deutlich gefaltete Blätter und einen Stamm mit Längswülsten.'),
  ('Bergahorn', 'Feldahorn', 'Der Bergahorn hat grosse Blätter mit spitzen, gesägten Lappen; der Feldahorn hat kleine Blätter mit stumpfen, abgerundeten Lappen, und die Flügel seiner Früchte stehen waagrecht auseinander.'),
  ('Arve', 'Waldföhre', 'Bei der Arve stehen fünf weiche Nadeln in einem Büschel, bei der Waldföhre nur zwei; die Waldföhre hat oben am Stamm eine auffallend orange Rinde.'),
  ('Schwarzdorn (Schlehe)', 'Weissdorn', 'Der Schwarzdorn blüht schon vor dem Blattaustrieb und trägt blaue, bereifte Früchte; der Weissdorn blüht nach dem Blattaustrieb, hat gelappte Blätter und rote Früchte.'),
  ('Gemeiner Schneeball', 'Wolliger Schneeball', 'Der Gemeine Schneeball hat ahornähnlich gelappte Blätter und rote, glasige Beeren; der Wollige Schneeball hat ungeteilte, unterseits filzige Blätter, und seine Beeren werden von rot zu schwarz.'),
  ('Steinpilz', 'Satans-Röhrling', 'Der Steinpilz hat weisse bis gelbgrüne Poren und einen hellen Stiel mit weissem Netz; der giftige Satans-Röhrling hat rote Poren, einen roten Stiel mit Netz und blau anlaufendes Fleisch.'),
  ('Parasol', 'Pantherpilz', 'Der Parasol ist viel grösser, sein Stiel ist genattert und hat einen verschiebbaren Ring; der giftige Pantherpilz hat weisse Flocken auf dem braunen Hut und am Stielgrund eine Knolle mit scharfem Rand.'),
  ('Reh', 'Rothirsch', 'Das Reh ist viel kleiner, hat einen hellen Spiegel und beim Bock ein kurzes Geweih mit höchstens drei Enden pro Stange; der Rothirsch ist gross, und das Männchen trägt ein weit verzweigtes Geweih.'),
  ('Gämse', 'Alpensteinbock', 'Die Gämse hat kurze, schwarze, hakenförmig nach hinten gebogene Hörner und ein weiss-schwarz gezeichnetes Gesicht; der Steinbock ist kräftiger, und die Böcke tragen lange, gebogene Hörner mit Querwülsten.'),
  ('Hermelin', 'Steinmarder', 'Das Hermelin ist viel kleiner, hat eine schwarze Schwanzspitze und ist im Winter weiss; der Steinmarder ist grösser, braun und hat einen weissen, gegabelten Kehlfleck.'),
  ('Bartgeier', 'Steinadler', 'Der Bartgeier hat lange, schmale Flügel und einen keilförmigen Schwanz, Kopf und Bauch sind hell bis rostrot; der Steinadler hat breitere Flügel, einen kürzeren Schwanz und ist fast ganz dunkelbraun.'),
  ('Mäusebussard', 'Steinadler', 'Der Mäusebussard ist deutlich kleiner, oft hell gefleckt und kreist mit breiten, runden Flügeln über dem Flachland; der Steinadler ist viel grösser, dunkel und lebt vor allem im Gebirge.'),
  ('Schlingnatter', 'Kreuzotter', 'Die ungiftige Schlingnatter hat runde Pupillen und einen dunklen Streifen durch das Auge; die giftige Kreuzotter hat senkrechte Schlitzpupillen und meist ein dunkles Zickzackband auf dem Rücken.'),
  ('Aspisviper', 'Kreuzotter', 'Die Aspisviper hat eine leicht aufgebogene Schnauzenspitze und quer stehende Flecken auf dem Rücken; die Kreuzotter hat eine gerade Schnauze und meist ein durchgehendes Zickzackband.'),
  ('Barren-Ringelnatter', 'Östliche Ringelnatter', 'Die Barren-Ringelnatter hat an den Flanken dunkle, senkrechte Balken, ihre Halbmondflecken am Hinterkopf sind oft blass; bei der Östlichen Ringelnatter fallen die gelben Halbmondflecken stärker auf.'),
  ('Zauneidechse', 'Mauereidechse', 'Die Zauneidechse ist gedrungen mit kurzem Kopf, die Männchen haben im Frühling grüne Flanken; die Mauereidechse ist schlank und flach gebaut, hat einen sehr langen Schwanz und klettert oft an Mauern.'),
  ('Grasfrosch', 'Springfrosch', 'Der Springfrosch hat sehr lange Hinterbeine (nach vorn gelegt reicht das Fersengelenk über die Schnauze hinaus) und einen hellen, ungefleckten Bauch; beim Grasfrosch reicht es kaum bis zur Schnauze, und der Bauch ist oft marmoriert.'),
  ('Erdkröte', 'Kreuzkröte', 'Die Kreuzkröte hat einen hellgelben Streifen über den Rücken und läuft eher, statt zu hüpfen; die Erdkröte ist grösser, braun, ohne Rückenstreifen und hat kupferrote Augen.'),
  ('Feuersalamander', 'Alpensalamander', 'Der Feuersalamander ist schwarz mit gelben Flecken und lebt in Laubwäldern tieferer Lagen; der Alpensalamander ist ganz schwarz, lebt in den Bergen und bringt fertig entwickelte Junge zur Welt.'),
  ('Laubfrosch', 'Italienischer Laubfrosch', 'Die beiden sehen fast gleich aus; der Italienische Laubfrosch lebt in der Schweiz nur im Tessin, der Laubfrosch nördlich der Alpen. Sicher unterscheiden lassen sie sich am ehesten am Ruf.'),
  ('Bergmolch', 'Fadenmolch', 'Der Bergmolch hat einen leuchtend orangen, ungefleckten Bauch; der Fadenmolch hat einen hellen, gelblichen Bauch, und das Männchen trägt zur Paarungszeit einen kurzen Faden am Schwanzende.'),
  ('Bachforelle', 'Äsche', 'Die Äsche hat eine auffallend grosse, fahnenartige Rückenflosse und ein kleines Maul; die Bachforelle hat eine kleine Rückenflosse und rote, hell umrandete Punkte.'),
  ('Alet', 'Rotauge', 'Das Rotauge hat ein rotes Auge und einen seitlich abgeflachten, hochrückigen Körper; der Alet hat einen fast runden Körper, einen breiten Kopf und dunkel umrandete Schuppen.'),
  ('Honigbiene', 'Gemeine Wespe', 'Die Honigbiene ist bräunlich und behaart; die Gemeine Wespe ist leuchtend schwarz-gelb, fast unbehaart und hat eine deutliche Wespentaille.'),
  ('Hornisse', 'Gemeine Wespe', 'Die Hornisse ist mit bis 3,5 cm viel grösser und an Kopf und Brust rotbraun; die Gemeine Wespe ist kleiner und schwarz-gelb.'),
  ('Stängelloser Enzian', 'Frühlings-Enzian', 'Der Stängellose Enzian hat eine grosse, glockenförmige Blüte; der Frühlings-Enzian ist viel kleiner, seine Blüte ist flach ausgebreitet wie ein fünfzackiger Stern.'),
  ('Gelber Enzian', 'Weisser Germer', 'Achtung, der sehr giftige Weisse Germer sieht ohne Blüten ähnlich aus: Beim Gelben Enzian stehen die kahlen Blätter gegenständig, beim Germer wechselständig und unterseits behaart.'),
  ('Herbstzeitlose', 'Krokus', 'Die giftige Herbstzeitlose blüht im Herbst ohne Blätter und hat sechs Staubblätter; der Krokus blüht im Frühling und hat drei Staubblätter.'),
  ('Herbstzeitlose', 'Bärlauch', 'Im Frühling sehen die Blätter der giftigen Herbstzeitlose ähnlich aus wie Bärlauch: Bärlauch riecht beim Zerreiben stark nach Knoblauch und hat gestielte Blätter, die Herbstzeitlose nicht.'),
  ('Margerite', 'Gänseblümchen', 'Die Margerite wird 30–60 cm hoch und hat Blätter am Stängel; das Gänseblümchen bleibt niedrig, seine Blätter wachsen nur als Rosette am Boden.'),
  ('Granit', 'Gneis', 'Granit ist gleichmässig körnig, ohne Richtung; im Gneis sind die Minerale in Bändern oder Lagen angeordnet, weil das Gestein unter Druck umgewandelt wurde.'),
  ('Kalkstein', 'Dolomit', 'Mit einem Tropfen verdünnter Salzsäure schäumt Kalkstein stark auf; Dolomit reagiert kaum, erst als Pulver.'),
  ('Berner Sennenhund', 'Grosser Schweizer Sennenhund', 'Der Berner Sennenhund hat langes, weiches Fell; der Grosse Schweizer Sennenhund hat kurzes Stockhaar und ist noch grösser und schwerer.'),
  ('Appenzeller Sennenhund', 'Entlebucher Sennenhund', 'Der Appenzeller trägt seinen Schwanz als Ringel über dem Rücken; der Entlebucher ist der kleinste Sennenhund und hat oft einen angeborenen Stummelschwanz.'),
  ('Schweizer Laufhund', 'Schweizer Niederlaufhund', 'Der Schweizer Niederlaufhund ist deutlich kurzbeiniger und kleiner als der Schweizer Laufhund; Farben und Schläge sind bei beiden ähnlich.'),
  ('Labrador Retriever', 'Golden Retriever', 'Der Labrador hat kurzes, dichtes Fell in Schwarz, Braun oder Gelb; der Golden Retriever hat längeres, goldfarbenes, oft gewelltes Fell.')
),
dirs as (select a as von, b as zu, diff from pairs union all select b, a, diff from pairs)
update public.entries e
   set confusions = (select jsonb_agg(jsonb_build_object('name', d.zu, 'diff', d.diff) order by d.zu) from dirs d where d.von = e.name)
 where e.name in (select von from dirs);

commit;

-- Kontrolle: Einträge mit Verwechslungsgefahr
select c.name as kategorie, e.name as eintrag, jsonb_array_length(e.confusions) as hinweise
from public.entries e join public.categories c on c.id = e.category_id
where jsonb_array_length(e.confusions) > 0
order by c.sort, e.sort;

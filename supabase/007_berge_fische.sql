-- Daten: Kategorien «Berge» und «Fische» mit je 15 Einträgen
-- Einmal im Supabase-Dashboard unter «SQL Editor» ausführen (nach 006_neue_kategorien.sql).
-- Das Matterhorn fehlt bei den Bergen absichtlich: Es steht schon bei den Sehenswürdigkeiten.
-- Doppelte werden übersprungen; die Datei lässt sich gefahrlos mehrmals ausführen.
-- Bilder danach in der Verwaltung mit «Fehlende Bilder von Wikimedia übernehmen» holen.

begin;

insert into public.categories (id, name, description, latin, labels, sort) values
  ('fische', 'Fische', 'Fische aus Schweizer Bächen, Flüssen und Seen', true,
   array['Fisch','Nahaufnahme','Unter Wasser','Lebensraum'], 10),
  ('berge', 'Berge', 'Vom Jura bis zu den Viertausendern', false,
   array['Berg','Gipfel','Umgebung','Stimmung'], 14)
on conflict (id) do nothing;

-- Reihenfolge: Pflanzen, Tiere, Steine, Berge, Orte (in der Verwaltung mit ↑↓ änderbar)
update public.categories set sort = s.sort
from (values ('baeume',0),('straeucher',1),('alpenblumen',2),('wiesenblumen',3),('graeser',4),('pilze',5),
             ('saeugetiere',6),('voegel',7),('reptilien',8),('amphibien',9),('fische',10),('insekten',11),
             ('falter',12),('steine',13),('berge',14),('sehenswuerdigkeiten',15)) as s(id, sort)
where categories.id = s.id;

insert into public.entries (category_id, name, subtitle, description, facts, search_terms, wp, sort)
select n.cat, n.name, n.sub, n.descr, n.facts::jsonb, n.terms, n.wp,
       coalesce((select max(e.sort) from public.entries e where e.category_id = n.cat), -1) + n.nr
from (values

-- ---------------------------------------------------------------- Berge
('berge', 1, 'Tödi', 'Glarus / Graubünden',
 'Der Tödi ist mit 3614 m der höchste Berg der Glarner Alpen und wird «König der Glarner Alpen» genannt. Er steht an der Grenze zwischen Glarus und Graubünden; an seinem Fuss entspringt die Linth. Die Erstbesteigung gelang 1824 zwei Gämsjägern, die der Bündner Pater Placidus a Spescha losgeschickt hatte. Er selbst schaute von unten zu.',
 '[{"k":"Höhe","v":"3614 m (Piz Russein)"},{"k":"Lage","v":"Grenze Glarus–Graubünden"},{"k":"Erstbesteigung","v":"1824"},{"k":"Besonderes","v":"höchster Berg der Glarner Alpen"}]',
 array['Tödi summit','Tödi glacier','Tödi Linthal'], 'Tödi'),
('berge', 2, 'Dufourspitze', 'Monte Rosa, Wallis',
 'Die Dufourspitze im Monte-Rosa-Massiv ist mit 4634 m der höchste Berg der Schweiz. Sie ist nach General Guillaume-Henri Dufour benannt, der die erste genaue Karte der Schweiz erstellen liess. Die Erstbesteigung gelang 1855. Unterhalb liegt die Monte-Rosa-Hütte, ein moderner Bau, der sich weitgehend selbst mit Energie versorgt.',
 '[{"k":"Höhe","v":"4634 m"},{"k":"Lage","v":"Wallis, Grenze zu Italien"},{"k":"Erstbesteigung","v":"1855"},{"k":"Besonderes","v":"höchster Berg der Schweiz"}]',
 array['Dufourspitze summit','Monte Rosa glacier','Monte Rosa hut'], 'Dufourspitze'),
('berge', 3, 'Dom', 'Mischabel, Wallis',
 'Der Dom ist mit 4545 m der höchste Berg, der ganz auf Schweizer Boden steht. Er gehört zur Mischabelgruppe zwischen Saas-Fee und Randa. Seinen Namen bekam er zu Ehren eines Domherrn aus Sitten, der das Gebiet vermessen hatte. Die Erstbesteigung gelang 1858.',
 '[{"k":"Höhe","v":"4545 m"},{"k":"Lage","v":"Wallis, zwischen Saas- und Mattertal"},{"k":"Erstbesteigung","v":"1858"},{"k":"Besonderes","v":"höchster Berg ganz in der Schweiz"}]',
 array['Dom Mischabel summit','Mischabel glacier','Dom Mischabel Saas-Fee'], 'Dom (mountain)'),
('berge', 4, 'Weisshorn', 'Wallis',
 'Das Weisshorn ist eine fast perfekte, dreikantige Pyramide und gilt bei vielen Bergsteigern als einer der schönsten Berge der Alpen. Es erhebt sich über dem Mattertal und dem Val d''Anniviers. Erstbestiegen wurde es 1861 vom irischen Naturforscher John Tyndall, der auch Gletscher erforschte.',
 '[{"k":"Höhe","v":"4506 m"},{"k":"Lage","v":"Wallis"},{"k":"Erstbesteigung","v":"1861"},{"k":"Besonderes","v":"regelmässige Pyramide"}]',
 array['Weisshorn summit','Weisshorn glacier','Weisshorn sunset'], 'Weisshorn'),
('berge', 5, 'Eiger', 'Berner Oberland',
 'Der Eiger ist berühmt für seine gewaltige Nordwand, die rund 1800 m fast senkrecht über Grindelwald aufragt. Sie wurde erst 1938 durchstiegen und gilt als eine der schwierigsten Wände der Alpen. Durch den Eiger führt der Tunnel der Jungfraubahn. Zusammen mit Mönch und Jungfrau bildet er ein berühmtes Dreigestirn.',
 '[{"k":"Höhe","v":"3967 m"},{"k":"Lage","v":"Bern, über Grindelwald"},{"k":"Erstbesteigung","v":"1858 (Nordwand 1938)"},{"k":"Besonderes","v":"1800 m hohe Nordwand"}]',
 array['Eiger north face','Eiger Mönch Jungfrau','Eiger Grindelwald'], 'Eiger'),
('berge', 6, 'Finsteraarhorn', 'Bern / Wallis',
 'Das Finsteraarhorn ist mit 4274 m der höchste Berg der Berner Alpen. Es liegt mitten in einer riesigen Gletscherlandschaft, die zum UNESCO-Welterbe Jungfrau-Aletsch gehört. Weil es so abgelegen ist, sieht man es von den Tälern aus kaum. Die Erstbesteigung gelang 1829.',
 '[{"k":"Höhe","v":"4274 m"},{"k":"Lage","v":"Grenze Bern–Wallis"},{"k":"Erstbesteigung","v":"1829"},{"k":"Besonderes","v":"höchster Berg der Berner Alpen"}]',
 array['Finsteraarhorn summit','Finsteraarhorn glacier','Finsteraarhorn hut'], 'Finsteraarhorn'),
('berge', 7, 'Piz Bernina', 'Oberengadin, Graubünden',
 'Der Piz Bernina ist mit 4049 m der einzige Viertausender der Ostalpen und der höchste Berg Graubündens. Berühmt ist sein scharfer, verschneiter Nordgrat, der Biancograt, auch «Himmelsleiter» genannt. Erstbestiegen wurde er 1850 vom Bündner Vermesser Johann Coaz.',
 '[{"k":"Höhe","v":"4049 m"},{"k":"Lage","v":"Graubünden, bei Pontresina"},{"k":"Erstbesteigung","v":"1850"},{"k":"Besonderes","v":"einziger Viertausender der Ostalpen"}]',
 array['Piz Bernina Biancograt','Piz Bernina Morteratsch glacier','Piz Bernina sunset'], 'Piz Bernina'),
('berge', 8, 'Titlis', 'Engelberg, Obwalden / Bern',
 'Der Titlis über Engelberg ist einer der bekanntesten Ausflugsberge der Zentralschweiz. Mönche des Klosters Engelberg bestiegen ihn schon 1744; das war eine der ersten Besteigungen eines vergletscherten Gipfels. Auf dem Weg nach oben dreht sich die Gondel der «Rotair» einmal um sich selbst.',
 '[{"k":"Höhe","v":"3238 m"},{"k":"Lage","v":"Grenze Obwalden–Bern"},{"k":"Erstbesteigung","v":"1744"},{"k":"Besonderes","v":"drehende Gondel, Gletscher"}]',
 array['Titlis summit glacier','Titlis Rotair','Titlis Engelberg'], 'Titlis'),
('berge', 9, 'Säntis', 'Appenzell / St. Gallen',
 'Der Säntis ist der höchste Berg im Alpstein und ein Wahrzeichen der Ostschweiz. Bei klarem Wetter sieht man vom Gipfel bis in sechs Länder. Seit 1882 gibt es hier eine Wetterstation, und der hohe Sendeturm ist von weit her zu sehen. Auf dem Gipfel treffen sich die Kantone Appenzell Ausserrhoden, Appenzell Innerrhoden und St. Gallen.',
 '[{"k":"Höhe","v":"2502 m"},{"k":"Lage","v":"Alpstein, AR / AI / SG"},{"k":"Besonderes","v":"Wetterstation seit 1882"},{"k":"Aussicht","v":"bis in sechs Länder"}]',
 array['Säntis summit','Säntis Alpstein','Säntis sunset'], 'Säntis'),
('berge', 10, 'Pilatus', 'Luzern / Obwalden',
 'Der Pilatus ist der Hausberg von Luzern. Um ihn ranken sich viele Sagen über Drachen, die in seinen Felsen gewohnt haben sollen. Die Pilatusbahn ab Alpnachstad ist seit 1889 die steilste Zahnradbahn der Welt, mit bis zu 48 Prozent Steigung.',
 '[{"k":"Höhe","v":"2128 m (Tomlishorn)"},{"k":"Lage","v":"Grenze Luzern–Obwalden"},{"k":"Besonderes","v":"steilste Zahnradbahn der Welt"},{"k":"Sage","v":"Drachen"}]',
 array['Pilatus summit','Pilatus cogwheel railway','Pilatus Lake Lucerne'], 'Pilatus (mountain)'),
('berge', 11, 'Rigi', 'Luzern / Schwyz',
 'Die Rigi wird «Königin der Berge» genannt. Sie steht fast allein zwischen dem Vierwaldstättersee, dem Zugersee und dem Lauerzersee. Von Vitznau aus fährt seit 1871 die erste Bergbahn Europas hinauf. Von der Rigi Kulm sieht man über die Seen des Mittellandes und auf viele Alpengipfel.',
 '[{"k":"Höhe","v":"1798 m (Rigi Kulm)"},{"k":"Lage","v":"Grenze Luzern–Schwyz"},{"k":"Besonderes","v":"erste Bergbahn Europas (1871)"},{"k":"Aussicht","v":"Seen und Alpen"}]',
 array['Rigi Kulm summit','Rigi railway Vitznau','Rigi sea of fog'], 'Rigi'),
('berge', 12, 'Grosser Mythen', 'Schwyz',
 'Der Grosse Mythen ragt als felsiger Zahn über Schwyz auf. Geologisch ist er eine Besonderheit: Sein Gestein ist älter als der Untergrund, auf dem er steht. Es wurde bei der Alpenbildung von weit her über jüngere Schichten geschoben. Ein steiler Weg mit vielen Kehren führt bis zum Gipfel.',
 '[{"k":"Höhe","v":"1898 m"},{"k":"Lage","v":"Schwyz"},{"k":"Besonderes","v":"altes Gestein auf jüngerem Untergrund"},{"k":"Weg","v":"steiler Zickzackweg zum Gipfel"}]',
 array['Grosser Mythen summit','Mythen Schwyz','Grosser Mythen sunset'], 'Grosser Mythen'),
('berge', 13, 'Niesen', 'Berner Oberland',
 'Der Niesen ist eine fast regelmässige Pyramide am Thunersee. Eine Standseilbahn fährt seit 1910 auf den Gipfel. Neben ihren Schienen führt eine Diensttreppe mit 11 674 Stufen hinauf, die längste Treppe der Welt. Einmal im Jahr darf man sie bei einem Treppenlauf benutzen.',
 '[{"k":"Höhe","v":"2362 m"},{"k":"Lage","v":"Bern, am Thunersee"},{"k":"Besonderes","v":"längste Treppe der Welt (11 674 Stufen)"},{"k":"Bahn","v":"Standseilbahn seit 1910"}]',
 array['Niesen pyramid','Niesen funicular','Niesen Lake Thun'], 'Niesen'),
('berge', 14, 'Chasseral', 'Berner Jura',
 'Der Chasseral ist der höchste Gipfel des Berner Juras. Von seinem breiten Rücken sieht man bei klarem Wetter die ganze Alpenkette vom Säntis bis zum Mont Blanc und die Seen des Mittellandes. Weithin sichtbar ist sein hoher Sendeturm. Rundherum liegen Wytweiden, die typischen Jura-Weiden mit einzelnen grossen Bäumen.',
 '[{"k":"Höhe","v":"1606 m"},{"k":"Lage","v":"Berner Jura"},{"k":"Besonderes","v":"höchster Gipfel des Berner Juras"},{"k":"Aussicht","v":"Alpen vom Säntis bis zum Mont Blanc"}]',
 array['Chasseral summit','Chasseral Jura pasture','Chasseral sea of fog'], 'Chasseral'),
('berge', 15, 'Monte Generoso', 'Tessin',
 'Der Monte Generoso liegt ganz im Süden der Schweiz an der Grenze zu Italien. Seit 1890 fährt eine Zahnradbahn von Capolago am Luganersee hinauf. Auf dem Gipfel steht das Restaurant «Fiore di pietra» (Steinblume) des Tessiner Architekten Mario Botta. Von oben sieht man über die Seen bis in die Po-Ebene.',
 '[{"k":"Höhe","v":"1701 m"},{"k":"Lage","v":"Tessin, Grenze zu Italien"},{"k":"Besonderes","v":"«Fiore di pietra» von Mario Botta"},{"k":"Bahn","v":"Zahnradbahn seit 1890"}]',
 array['Monte Generoso summit','Monte Generoso Fiore di pietra','Monte Generoso Lake Lugano'], 'Monte Generoso'),

-- ---------------------------------------------------------------- Fische
('fische', 1, 'Bachforelle', 'Salmo trutta',
 'Die Bachforelle lebt in kühlen, sauerstoffreichen Bächen und Flüssen bis hoch in die Alpen. Typisch sind die roten Punkte mit hellem Rand auf den Flanken. Sie laicht im Winter im Kies. Weil sie warmes Wasser schlecht erträgt, setzen ihr heisse Sommer stark zu.',
 '[{"k":"Grösse","v":"20–60 cm"},{"k":"Nahrung","v":"Insektenlarven, Bachflohkrebse, kleine Fische"},{"k":"Lebensraum","v":"kühle Bäche und Flüsse"},{"k":"Besonderes","v":"rote Punkte mit hellem Rand"}]',
 array['Salmo trutta fario close-up','Salmo trutta underwater','Salmo trutta mountain stream'], null),
('fische', 2, 'Äsche', 'Thymallus thymallus',
 'Die Äsche hat eine grosse, fahnenartige Rückenflosse. Sie lebt in schnell fliessenden, klaren Flüssen, zum Beispiel im Rhein bei Schaffhausen. Im Hitzesommer 2003 starben dort viele Äschen, weil das Wasser zu warm wurde. Ihr frisches Fleisch soll leicht nach Thymian riechen, daher der lateinische Name.',
 '[{"k":"Grösse","v":"30–50 cm"},{"k":"Nahrung","v":"Insektenlarven, Kleintiere"},{"k":"Lebensraum","v":"schnell fliessende, klare Flüsse"},{"k":"Besonderes","v":"grosse Rückenflosse («Fahne»)"}]',
 array['Thymallus thymallus close-up','Thymallus thymallus underwater','Thymallus thymallus river'], null),
('fische', 3, 'Felchen', 'Coregonus',
 'Felchen sind die wichtigsten Speisefische der Schweizer Seen. In vielen grossen Seen leben eigene Arten, die sich seit der letzten Eiszeit getrennt entwickelt haben, zum Beispiel der Blaufelchen im Bodensee. Sie leben im offenen Wasser und fressen Plankton. Je nach Region heissen sie auch Balchen, Albeli oder Bondelle.',
 '[{"k":"Grösse","v":"25–50 cm"},{"k":"Nahrung","v":"Plankton (Kleinkrebse)"},{"k":"Lebensraum","v":"offenes Wasser grosser Seen"},{"k":"Besonderes","v":"eigene Arten in vielen Seen"}]',
 array['Coregonus close-up','Coregonus underwater','Coregonus lake fishing'], null),
('fische', 4, 'Egli', 'Perca fluviatilis',
 'Das Egli, auch Flussbarsch genannt, ist einer der häufigsten Fische der Schweizer Seen. Es hat dunkle Querbänder, rote Bauch- und Afterflossen und eine stachelige Rückenflosse. Junge Egli leben in Schwärmen. Eglifilets sind ein bekanntes Schweizer Gericht.',
 '[{"k":"Grösse","v":"20–40 cm"},{"k":"Nahrung","v":"Kleintiere, kleine Fische"},{"k":"Lebensraum","v":"Seen, langsame Flüsse"},{"k":"Besonderes","v":"stachelige Rückenflosse"}]',
 array['Perca fluviatilis close-up','Perca fluviatilis underwater','Perca fluviatilis lake'], null),
('fische', 5, 'Hecht', 'Esox lucius',
 'Der Hecht ist ein Raubfisch mit langem, flachem Maul voller spitzer Zähne. Er lauert gut getarnt zwischen Wasserpflanzen und schiesst blitzschnell auf seine Beute zu. Er kann über einen Meter lang werden. Im Frühling laicht er in überschwemmten Uferwiesen und im Schilf.',
 '[{"k":"Grösse","v":"50–130 cm"},{"k":"Nahrung","v":"Fische, Frösche"},{"k":"Lebensraum","v":"pflanzenreiche Seeufer, Flüsse"},{"k":"Besonderes","v":"Lauerjäger"}]',
 array['Esox lucius close-up','Esox lucius underwater','Esox lucius reeds'], null),
('fische', 6, 'Seesaibling', 'Salvelinus umbla',
 'Der Seesaibling lebt in tiefen, kalten Seen der Alpen und Voralpen. Zur Laichzeit färbt sich der Bauch der Männchen leuchtend orangerot. Er ist ein geschätzter Speisefisch und lebt auch in vielen Bergseen.',
 '[{"k":"Grösse","v":"25–50 cm"},{"k":"Nahrung","v":"Plankton, Kleintiere, Fische"},{"k":"Lebensraum","v":"tiefe, kalte Seen"},{"k":"Besonderes","v":"orangeroter Bauch zur Laichzeit"}]',
 array['Salvelinus umbla close-up','Salvelinus umbla underwater','Salvelinus alpine lake'], null),
('fische', 7, 'Karpfen', 'Cyprinus carpio',
 'Der Karpfen wurde schon von den Römern gezüchtet; im Mittelalter hielten ihn Mönche in Klosterweihern als Fastenspeise. Mit vier Barteln am Maul wühlt er im Schlamm nach Nahrung. Er liebt warmes Wasser und kann über 40 Jahre alt werden.',
 '[{"k":"Grösse","v":"30–100 cm"},{"k":"Nahrung","v":"Würmer, Insektenlarven, Pflanzen"},{"k":"Lebensraum","v":"warme, ruhige Gewässer"},{"k":"Besonderes","v":"vier Barteln am Maul"}]',
 array['Cyprinus carpio close-up','Cyprinus carpio underwater','Cyprinus carpio pond'], null),
('fische', 8, 'Wels', 'Silurus glanis',
 'Der Wels ist der grösste Süsswasserfisch der Schweiz und kann über 2 m lang werden. Er hat keine Schuppen, ein breites Maul und lange Barteln, mit denen er nachts seine Beute ertastet. Weil er warmes Wasser mag, breitet er sich in Schweizer Seen und Flüssen aus.',
 '[{"k":"Grösse","v":"bis über 2 m"},{"k":"Nahrung","v":"Fische, Frösche, Wasservögel"},{"k":"Lebensraum","v":"grosse Seen und Flüsse"},{"k":"Besonderes","v":"grösster Süsswasserfisch der Schweiz"}]',
 array['Silurus glanis close-up','Silurus glanis underwater','Silurus glanis river'], null),
('fische', 9, 'Barbe', 'Barbus barbus',
 'Die Barbe lebt am Grund von Flüssen mit Kiesboden, zum Beispiel im Rhein und in der Aare. Mit ihren vier Barteln tastet sie den Grund nach Kleintieren ab. Nach ihr ist die «Barbenregion» benannt, ein Flussabschnitt mit schnellem Wasser und Kies. Ihre Eier (Rogen) sind giftig.',
 '[{"k":"Grösse","v":"30–70 cm"},{"k":"Nahrung","v":"Kleintiere am Grund"},{"k":"Lebensraum","v":"Flüsse mit Kiesgrund"},{"k":"Besonderes","v":"Rogen giftig"}]',
 array['Barbus barbus close-up','Barbus barbus underwater','Barbus barbus river'], null),
('fische', 10, 'Groppe', 'Cottus gobio',
 'Die Groppe ist ein kleiner Fisch mit grossem, breitem Kopf und ohne Schwimmblase. Sie kann darum nicht im Wasser schweben und bewegt sich ruckartig über den Grund. Tagsüber versteckt sie sich unter Steinen. Das Männchen bewacht die Eier, die das Weibchen unter einen Stein klebt.',
 '[{"k":"Grösse","v":"10–15 cm"},{"k":"Nahrung","v":"Insektenlarven"},{"k":"Lebensraum","v":"klare Bäche mit Steingrund"},{"k":"Besonderes","v":"keine Schwimmblase"}]',
 array['Cottus gobio close-up','Cottus gobio underwater','Cottus gobio stream'], null),
('fische', 11, 'Nase', 'Chondrostoma nasus',
 'Die Nase hat eine vorstehende, nasenartige Schnauze und ein Maul auf der Unterseite. Damit weidet sie Algen von Steinen ab. Früher zog sie im Frühling in riesigen Schwärmen zum Laichen die Flüsse hinauf; heute ist sie in der Schweiz vom Aussterben bedroht.',
 '[{"k":"Grösse","v":"25–50 cm"},{"k":"Nahrung","v":"Algen"},{"k":"Lebensraum","v":"Flüsse"},{"k":"Besonderes","v":"vom Aussterben bedroht"}]',
 array['Chondrostoma nasus close-up','Chondrostoma nasus underwater','Chondrostoma nasus river'], null),
('fische', 12, 'Rotauge', 'Rutilus rutilus',
 'Das Rotauge ist einer der häufigsten Fische in Schweizer Seen. Es hat eine rote Iris und rötliche Flossen. Rotaugen leben in grossen Schwärmen und sind eine wichtige Nahrung für Hecht, Egli und Kormoran.',
 '[{"k":"Grösse","v":"15–30 cm"},{"k":"Nahrung","v":"Plankton, Pflanzen, Kleintiere"},{"k":"Lebensraum","v":"Seen, langsame Flüsse"},{"k":"Besonderes","v":"rotes Auge"}]',
 array['Rutilus rutilus close-up','Rutilus rutilus underwater school','Rutilus rutilus lake'], null),
('fische', 13, 'Aal', 'Anguilla anguilla',
 'Der Aal hat ein erstaunliches Leben: Er schlüpft in der Sargassosee im Atlantik und treibt als Larve mit dem Golfstrom nach Europa. In Schweizer Flüssen und Seen wächst er heran und schwimmt nach vielen Jahren zurück ins Meer, um zu laichen. Kraftwerke versperren ihm oft den Weg, darum ist er stark gefährdet.',
 '[{"k":"Grösse","v":"50–100 cm"},{"k":"Nahrung","v":"Kleintiere, Fische"},{"k":"Lebensraum","v":"Flüsse, Seen"},{"k":"Besonderes","v":"laicht in der Sargassosee"}]',
 array['Anguilla anguilla close-up','Anguilla anguilla underwater','Anguilla anguilla glass eel'], null),
('fische', 14, 'Trüsche', 'Lota lota',
 'Die Trüsche ist der einzige Dorschfisch im Süsswasser. Sie hat einen einzelnen Bartfaden am Kinn und lebt versteckt am Grund von Seen und Flüssen. Anders als die meisten Fische laicht sie mitten im Winter, von Dezember bis Februar, wenn das Wasser am kältesten ist.',
 '[{"k":"Grösse","v":"30–60 cm"},{"k":"Nahrung","v":"Kleintiere, Fische"},{"k":"Lebensraum","v":"Seegrund, Flüsse"},{"k":"Besonderes","v":"laicht im Winter"}]',
 array['Lota lota close-up','Lota lota underwater','Lota lota lake bottom'], null),
('fische', 15, 'Elritze', 'Phoxinus phoxinus',
 'Die Elritze ist ein kleiner Schwarmfisch klarer Bäche und Bergseen bis über 2000 m. Zur Laichzeit bekommen die Männchen einen roten Bauch und weisse Punkte am Kopf. Sie ist eine wichtige Nahrung für Forellen.',
 '[{"k":"Grösse","v":"6–10 cm"},{"k":"Nahrung","v":"Insektenlarven, Algen"},{"k":"Lebensraum","v":"klare Bäche, Bergseen"},{"k":"Besonderes","v":"roter Bauch zur Laichzeit"}]',
 array['Phoxinus phoxinus close-up','Phoxinus phoxinus underwater school','Phoxinus phoxinus stream'], null)

) as n(cat, nr, name, sub, descr, facts, terms, wp)
where exists (select 1 from public.categories c where c.id = n.cat)
  and not exists (
    select 1 from public.entries e
    where lower(e.name) = lower(n.name)
       or (n.cat = 'fische' and lower(e.subtitle) = lower(n.sub))
  );

commit;

-- Kontrolle: Einträge pro Kategorie (je 15; ausgeblendete zählen mit)
select c.sort, c.id, count(e.id) from public.categories c left join public.entries e on e.category_id = c.id
group by c.sort, c.id order by c.sort;

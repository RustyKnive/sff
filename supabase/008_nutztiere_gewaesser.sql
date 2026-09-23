-- Daten: Kategorien «Nutztiere» (Schweizer Rassen) und «Gewässer» (Seen und Flüsse) mit je 15 Einträgen
-- Einmal im Supabase-Dashboard unter «SQL Editor» ausführen (nach 007_berge_fische.sql).
-- Doppelte werden übersprungen; die Datei lässt sich gefahrlos mehrmals ausführen.
-- Bilder danach in der Verwaltung mit «Fehlende Bilder von Wikimedia übernehmen» holen.

begin;

insert into public.categories (id, name, description, latin, labels, sort) values
  ('nutztiere', 'Nutztiere', 'Schweizer Rassen von Hof und Alp', false,
   array['Tier','Porträt','Jungtier','Auf der Weide'], 13),
  ('gewaesser', 'Gewässer', 'Die grossen Seen und Flüsse der Schweiz', false,
   array['Ansicht','Ufer','Umgebung','Stimmung'], 16)
on conflict (id) do nothing;

-- Reihenfolge: Pflanzen, Tiere, Steine, Berge, Gewässer, Orte (18 Kacheln = volles 3er-Raster)
update public.categories set sort = s.sort
from (values ('baeume',0),('straeucher',1),('alpenblumen',2),('wiesenblumen',3),('graeser',4),('pilze',5),
             ('saeugetiere',6),('voegel',7),('reptilien',8),('amphibien',9),('fische',10),('insekten',11),
             ('falter',12),('nutztiere',13),('steine',14),('berge',15),('gewaesser',16),
             ('sehenswuerdigkeiten',17)) as s(id, sort)
where categories.id = s.id;

insert into public.entries (category_id, name, subtitle, description, facts, search_terms, wp, sort)
select n.cat, n.name, n.sub, n.descr, n.facts::jsonb, n.terms, n.wp,
       coalesce((select max(e.sort) from public.entries e where e.category_id = n.cat), -1) + n.nr
from (values

-- ---------------------------------------------------------------- Nutztiere
('nutztiere', 1, 'Braunvieh', 'Rind',
 'Das Braunvieh ist die typische Kuh der Innerschweiz und eine der ältesten Rinderrassen der Welt. Es hat ein graubraunes Fell und ein helles Maul. Als «Brown Swiss» wird es heute auf der ganzen Welt gezüchtet, vor allem wegen der Milch.',
 '[{"k":"Tierart","v":"Rind"},{"k":"Herkunft","v":"Innerschweiz"},{"k":"Nutzung","v":"Milch, Fleisch"},{"k":"Besonderes","v":"weltweit als «Brown Swiss» verbreitet"}]',
 array['Braunvieh cow portrait','Braunvieh calf','Braunvieh alpine pasture'], 'Braunvieh'),
('nutztiere', 2, 'Eringer', 'Rind',
 'Die Eringerkuh ist klein, kräftig und schwarz bis dunkel rotbraun. Bekannt ist sie für ihren Kampfgeist: Bei den Ringkuhkämpfen im Wallis messen die Kühe ihre Kräfte, die Siegerin wird «Königin». Dabei legen sie, wie auf der Alp, ihre Rangordnung fest und verletzen sich kaum.',
 '[{"k":"Tierart","v":"Rind"},{"k":"Herkunft","v":"Wallis (Val d''Hérens)"},{"k":"Nutzung","v":"Fleisch, Milch"},{"k":"Besonderes","v":"Ringkuhkämpfe"}]',
 array['Hérens cattle portrait','Hérens cattle calf','Hérens cattle fight Valais'], 'Hérens cattle'),
('nutztiere', 3, 'Simmentaler', 'Rind',
 'Das Simmentaler Fleckvieh stammt aus dem Simmental im Berner Oberland. Es ist rotbraun und weiss gefleckt und hat einen weissen Kopf. Die Rasse liefert viel Milch und gutes Fleisch und gehört heute weltweit zu den häufigsten Rinderrassen.',
 '[{"k":"Tierart","v":"Rind"},{"k":"Herkunft","v":"Simmental (Bern)"},{"k":"Nutzung","v":"Milch, Fleisch"},{"k":"Besonderes","v":"rot-weiss gefleckt, weisser Kopf"}]',
 array['Simmental cattle portrait','Simmental cattle calf','Simmental cattle pasture'], 'Simmental cattle'),
('nutztiere', 4, 'Rätisches Grauvieh', 'Rind',
 'Das Rätische Grauvieh ist eine kleine, leichte und genügsame Rinderrasse aus Graubünden. Es klettert gut und eignet sich darum für steile Alpweiden. In der Schweiz war es fast ausgestorben; ab 1985 holte man verwandte Tiere aus dem Tirol zurück und baute die Zucht wieder auf.',
 '[{"k":"Tierart","v":"Rind"},{"k":"Herkunft","v":"Graubünden"},{"k":"Nutzung","v":"Fleisch, Milch, Landschaftspflege"},{"k":"Besonderes","v":"war fast ausgestorben"}]',
 array['Rätisches Grauvieh portrait','Rätisches Grauvieh calf','Rätisches Grauvieh alp'], 'Rätisches Grauvieh'),
('nutztiere', 5, 'Freiberger', 'Pferd',
 'Der Freiberger stammt aus den Freibergen im Jura. Er ist kräftig, ruhig und vielseitig: Man kann ihn reiten, vor eine Kutsche spannen, und früher trug er auch Lasten für die Armee. Die meisten Freiberger sind braun. Das Nationalgestüt in Avenches fördert die Zucht.',
 '[{"k":"Tierart","v":"Pferd"},{"k":"Herkunft","v":"Freiberge (Jura)"},{"k":"Nutzung","v":"Reiten, Fahren"},{"k":"Besonderes","v":"ruhig und vielseitig"}]',
 array['Franches-Montagnes horse portrait','Franches-Montagnes foal','Franches-Montagnes horses pasture'], 'Freiberger'),
('nutztiere', 6, 'Einsiedler', 'Pferd',
 'Das Einsiedler Pferd wird seit dem Mittelalter im Kloster Einsiedeln gezüchtet; das Gestüt gilt als das älteste noch bestehende Europas. Früher waren diese Pferde als «Cavalli della Madonna» bis nach Italien begehrt. Heute sind es elegante Reit- und Fahrpferde.',
 '[{"k":"Tierart","v":"Pferd"},{"k":"Herkunft","v":"Kloster Einsiedeln (Schwyz)"},{"k":"Nutzung","v":"Reiten, Fahren"},{"k":"Besonderes","v":"ältestes Gestüt Europas"}]',
 array['Einsiedler Pferd','Einsiedeln Marstall foal','Kloster Einsiedeln horses'], 'Einsiedler'),
('nutztiere', 7, 'Walliser Schwarznasenschaf', 'Schaf',
 'Das Walliser Schwarznasenschaf hat ein langes, weisses Fell, eine schwarze Nase, schwarze Flecken um die Augen und schwarze Ohren. Weibchen und Böcke tragen gedrehte Hörner. Es ist sehr robust und verbringt den Sommer auf den Alpen des Oberwallis. Wegen seines Aussehens ist es weltweit bekannt geworden.',
 '[{"k":"Tierart","v":"Schaf"},{"k":"Herkunft","v":"Oberwallis"},{"k":"Nutzung","v":"Fleisch, Wolle, Landschaftspflege"},{"k":"Besonderes","v":"schwarze Nase und Ohren"}]',
 array['Valais Blacknose sheep portrait','Valais Blacknose lamb','Valais Blacknose sheep alp'], 'Valais Blacknose'),
('nutztiere', 8, 'Saanenziege', 'Ziege',
 'Die Saanenziege ist ganz weiss und meist hornlos. Sie stammt aus dem Saanenland im Berner Oberland und gibt sehr viel Milch. Heute ist sie die wichtigste Milchziege der Welt.',
 '[{"k":"Tierart","v":"Ziege"},{"k":"Herkunft","v":"Saanenland (Bern)"},{"k":"Nutzung","v":"Milch"},{"k":"Besonderes","v":"wichtigste Milchziege der Welt"}]',
 array['Saanen goat portrait','Saanen goat kid','Saanen goats pasture'], 'Saanen goat'),
('nutztiere', 9, 'Toggenburger Ziege', 'Ziege',
 'Die Toggenburger Ziege ist hell- bis mausbraun und hat typische weisse Streifen im Gesicht und weisse Beine. Sie stammt aus dem Toggenburg und ist eine gute Milchziege. Sie wurde in viele Länder exportiert, besonders nach England und Amerika.',
 '[{"k":"Tierart","v":"Ziege"},{"k":"Herkunft","v":"Toggenburg (St. Gallen)"},{"k":"Nutzung","v":"Milch"},{"k":"Besonderes","v":"weisse Streifen im Gesicht"}]',
 array['Toggenburg goat portrait','Toggenburg goat kid','Toggenburg goats pasture'], 'Toggenburger'),
('nutztiere', 10, 'Walliser Schwarzhalsziege', 'Ziege',
 'Die Walliser Schwarzhalsziege ist vorne schwarz und hinten weiss, wie zweigeteilt. Sie hat lange Haare und grosse Hörner. Früher zogen Ziegenhirten im Oberwallis jeden Tag mit den Ziegen aller Familien eines Dorfes auf die Weide. Die Rasse war selten geworden und wird heute gezielt erhalten.',
 '[{"k":"Tierart","v":"Ziege"},{"k":"Herkunft","v":"Oberwallis"},{"k":"Nutzung","v":"Fleisch, Milch, Landschaftspflege"},{"k":"Besonderes","v":"vorne schwarz, hinten weiss"}]',
 array['Valais Blackneck goat portrait','Valais Blackneck goat kid','Walliser Schwarzhalsziege alp'], 'Valais Blackneck'),
('nutztiere', 11, 'Bündner Strahlenziege', 'Ziege',
 'Die Bündner Strahlenziege ist schwarz und hat helle Streifen im Gesicht, die wie Strahlen aussehen, dazu helle Beine. Sie ist robust, genügsam und klettert gut. Die alte Bündner Rasse war stark gefährdet und wird heute wieder gezüchtet.',
 '[{"k":"Tierart","v":"Ziege"},{"k":"Herkunft","v":"Graubünden"},{"k":"Nutzung","v":"Milch, Fleisch"},{"k":"Besonderes","v":"helle «Strahlen» im Gesicht"}]',
 array['Grisons Striped goat portrait','Bündner Strahlenziege kid','Bündner Strahlenziege alp'], 'Grisons Striped'),
('nutztiere', 12, 'Bernhardiner', 'Hund',
 'Der Bernhardiner stammt vom Hospiz am Grossen St. Bernhard, wo Mönche die grossen Hunde seit dem 17. Jahrhundert hielten. Sie begleiteten Reisende über den Pass und suchten Verschüttete im Schnee. Der berühmteste war Barry, der über 40 Menschen gerettet haben soll. Das Fässchen um den Hals ist allerdings eine Legende.',
 '[{"k":"Tierart","v":"Hund"},{"k":"Herkunft","v":"Grosser St. Bernhard (Wallis)"},{"k":"Nutzung","v":"früher Rettungshund"},{"k":"Besonderes","v":"Barry rettete über 40 Menschen"}]',
 array['St. Bernard dog portrait','St. Bernard puppy','St. Bernard dog snow'], 'St. Bernard (dog breed)'),
('nutztiere', 13, 'Berner Sennenhund', 'Hund',
 'Der Berner Sennenhund ist ein grosser, dreifarbiger Hund: schwarz, rostbraun und weiss. Früher bewachte er Bauernhöfe und zog Milchkarren zur Käserei. Heute ist er ein beliebter Familienhund. Er ist die bekannteste der vier Schweizer Sennenhundrassen.',
 '[{"k":"Tierart","v":"Hund"},{"k":"Herkunft","v":"Kanton Bern"},{"k":"Nutzung","v":"früher Hof- und Zughund"},{"k":"Besonderes","v":"dreifarbig, zog Milchkarren"}]',
 array['Bernese Mountain Dog portrait','Bernese Mountain Dog puppy','Bernese Mountain Dog cart'], 'Bernese Mountain Dog'),
('nutztiere', 14, 'Appenzeller Sennenhund', 'Hund',
 'Der Appenzeller Sennenhund ist mittelgross, dreifarbig und trägt seinen Schwanz als Ringel über dem Rücken. Er ist lebhaft und wachsam und half auf den Bauernhöfen im Appenzellerland beim Treiben des Viehs. Er bellt gern und meldet jeden Besuch.',
 '[{"k":"Tierart","v":"Hund"},{"k":"Herkunft","v":"Appenzellerland"},{"k":"Nutzung","v":"Treib- und Hofhund"},{"k":"Besonderes","v":"Ringelschwanz"}]',
 array['Appenzeller Sennenhund portrait','Appenzeller Sennenhund puppy','Appenzeller Sennenhund cattle'], 'Appenzeller Sennenhund'),
('nutztiere', 15, 'Appenzeller Spitzhaubenhuhn', 'Huhn',
 'Das Appenzeller Spitzhaubenhuhn trägt eine spitze, nach vorne geneigte Federhaube und einen kleinen, hörnchenförmigen Kamm. Weil der Kamm so klein ist, erfriert er im Winter nicht. Es ist eine alte Schweizer Rasse, die weisse Eier legt und gut fliegen kann.',
 '[{"k":"Tierart","v":"Huhn"},{"k":"Herkunft","v":"Appenzellerland"},{"k":"Nutzung","v":"Eier"},{"k":"Besonderes","v":"spitze Federhaube"}]',
 array['Appenzeller Spitzhauben portrait','Appenzeller Spitzhauben chick','Appenzeller Spitzhauben chickens'], 'Appenzeller Spitzhauben'),

-- ---------------------------------------------------------------- Gewässer: Seen
('gewaesser', 1, 'Genfersee', 'See, Waadt / Wallis / Genf',
 'Der Genfersee ist mit 580 km² der grösste See der Alpen; rund 60 Prozent gehören zur Schweiz, der Rest zu Frankreich. Die Rhone fliesst durch ihn hindurch. An seinem Ufer liegen Genf, Lausanne, Vevey und Montreux, dazu die Rebberge des Lavaux. Im Französischen heisst er «Lac Léman».',
 '[{"k":"Fläche","v":"580 km²"},{"k":"Tiefe","v":"bis 310 m"},{"k":"Lage","v":"Waadt, Wallis, Genf, Frankreich"},{"k":"Besonderes","v":"grösster See der Alpen"}]',
 array['Lake Geneva Lausanne','Lake Geneva shore Montreux','Lake Geneva sunset'], 'Lake Geneva'),
('gewaesser', 2, 'Bodensee', 'See, Thurgau / St. Gallen',
 'Der Bodensee liegt zwischen der Schweiz, Deutschland und Österreich. Er ist 536 km² gross, und der Rhein fliesst durch ihn hindurch. Eine Besonderheit: Auf dem grössten Teil des Sees ist nie festgelegt worden, wo genau die Landesgrenzen verlaufen. Im Sommer wird er zum Badeparadies, im Winter ist er oft neblig.',
 '[{"k":"Fläche","v":"536 km²"},{"k":"Tiefe","v":"bis 251 m"},{"k":"Lage","v":"Schweiz, Deutschland, Österreich"},{"k":"Besonderes","v":"Grenzen auf dem See nicht festgelegt"}]',
 array['Lake Constance Romanshorn','Lake Constance shore Rorschach','Lake Constance sunset'], 'Lake Constance'),
('gewaesser', 3, 'Vierwaldstättersee', 'See, Luzern / Uri / Schwyz / Nid- und Obwalden',
 'Der Vierwaldstättersee ist nach den vier «Waldstätten» Uri, Schwyz, Unterwalden und Luzern benannt. Mit seinen vielen verzweigten Armen zwischen steilen Bergen gilt er als einer der schönsten Seen der Schweiz. Am Ufer liegt die Rütliwiese, wo der Sage nach der Bund der Eidgenossen geschworen wurde. Die Reuss fliesst durch den See.',
 '[{"k":"Fläche","v":"114 km²"},{"k":"Tiefe","v":"bis 214 m"},{"k":"Lage","v":"Luzern, Uri, Schwyz, Nid- und Obwalden"},{"k":"Besonderes","v":"Rütliwiese"}]',
 array['Lake Lucerne steamboat','Lake Lucerne Rütli','Lake Lucerne sunset'], 'Lake Lucerne'),
('gewaesser', 4, 'Zürichsee', 'See, Zürich / Schwyz / St. Gallen',
 'Der Zürichsee erstreckt sich über 40 km von der Stadt Zürich bis in die Linthebene. Der Seedamm bei Rapperswil teilt ihn in den Zürichsee und den kleineren Obersee. In Zürich fliesst die Limmat aus dem See. Er liefert auch einen grossen Teil des Zürcher Trinkwassers.',
 '[{"k":"Fläche","v":"88 km²"},{"k":"Tiefe","v":"bis 136 m"},{"k":"Lage","v":"Zürich, Schwyz, St. Gallen"},{"k":"Besonderes","v":"Seedamm bei Rapperswil"}]',
 array['Lake Zurich city','Lake Zurich Rapperswil shore','Lake Zurich sunset'], 'Lake Zurich'),
('gewaesser', 5, 'Neuenburgersee', 'See, Neuenburg / Waadt / Freiburg / Bern',
 'Der Neuenburgersee ist mit 218 km² der grösste See, der ganz in der Schweiz liegt. An seinem Südufer liegt die Grande Cariçaie, das grösste Seeufer-Feuchtgebiet der Schweiz mit Schilf und vielen Vögeln. Bei der Juragewässerkorrektion wurde sein Wasserspiegel gesenkt, damit das Seeland nicht mehr überschwemmt wird.',
 '[{"k":"Fläche","v":"218 km²"},{"k":"Tiefe","v":"bis 152 m"},{"k":"Lage","v":"Neuenburg, Waadt, Freiburg, Bern"},{"k":"Besonderes","v":"grösster See ganz in der Schweiz"}]',
 array['Lake Neuchâtel Neuchâtel city','Grande Cariçaie reeds','Lake Neuchâtel sunset'], 'Lake Neuchâtel'),
('gewaesser', 6, 'Lago Maggiore', 'See, Tessin',
 'Der Lago Maggiore gehört nur zu einem kleinen Teil zur Schweiz, der grösste Teil liegt in Italien. Seine Oberfläche ist mit rund 193 m über Meer der tiefste Punkt der Schweiz. Das milde Klima lässt am Ufer Palmen und Kamelien wachsen. Auf den Brissago-Inseln gibt es einen botanischen Garten.',
 '[{"k":"Fläche","v":"212 km² (Schweizer Teil rund 40 km²)"},{"k":"Tiefe","v":"bis 372 m"},{"k":"Lage","v":"Tessin, Italien"},{"k":"Besonderes","v":"tiefster Punkt der Schweiz"}]',
 array['Lake Maggiore Locarno','Brissago Islands','Lake Maggiore sunset'], 'Lake Maggiore'),
('gewaesser', 7, 'Walensee', 'See, St. Gallen / Glarus',
 'Der Walensee liegt zwischen den steilen Felswänden der Churfirsten im Norden und den Glarner Alpen im Süden. Am Nordufer gibt es Dörfer wie Quinten, die nur zu Fuss oder mit dem Schiff erreichbar sind. Dort ist es so mild, dass Reben und Feigen wachsen. Vom Nordufer stürzt der Seerenbachfall in mehreren Stufen herab.',
 '[{"k":"Fläche","v":"24 km²"},{"k":"Tiefe","v":"bis 145 m"},{"k":"Lage","v":"St. Gallen, Glarus"},{"k":"Besonderes","v":"Quinten ohne Strassenanschluss"}]',
 array['Walensee Churfirsten','Walensee Quinten','Walensee sunset'], 'Walensee'),
('gewaesser', 8, 'Silsersee', 'See, Oberengadin',
 'Der Silsersee (romanisch Lej da Segl) liegt auf 1797 m im Oberengadin und ist der grösste See des Engadins. Der Inn fliesst durch ihn hindurch. Im Winter friert er zu, dann kann man auf dem Eis wandern, und der Engadiner Skimarathon führt über ihn hinweg. Viele Maler und Dichter liessen sich von seiner Landschaft begeistern.',
 '[{"k":"Fläche","v":"4 km²"},{"k":"Höhe","v":"1797 m ü. M."},{"k":"Lage","v":"Oberengadin (Graubünden)"},{"k":"Besonderes","v":"friert im Winter zu"}]',
 array['Lej da Segl','Lake Sils Isola','Lake Sils winter'], 'Lake Sils'),

-- ---------------------------------------------------------------- Gewässer: Flüsse
('gewaesser', 9, 'Rhein', 'Fluss, Graubünden bis Basel',
 'Der Rhein entsteht in Graubünden aus Vorder- und Hinterrhein und fliesst durch den Bodensee und über den Rheinfall nach Basel. Von dort führt er durch Deutschland und die Niederlande in die Nordsee. In Basel ist er ein wichtiger Schifffahrtsweg mit einem grossen Hafen. Im Sommer lassen sich viele Menschen im Wasser durch die Stadt treiben.',
 '[{"k":"Länge","v":"rund 1230 km"},{"k":"Quelle","v":"Graubünden (Vorder- und Hinterrhein)"},{"k":"Mündung","v":"Nordsee"},{"k":"Besonderes","v":"Rheinhafen Basel"}]',
 array['Rhine Basel','Rhine Anterior source Tomasee','Rhine Ruinaulta gorge'], 'Rhine'),
('gewaesser', 10, 'Rhone', 'Fluss, Wallis bis Genf',
 'Die Rhone entspringt am Rhonegletscher beim Furkapass und fliesst durch das ganze Wallis. Im Oberwallis heisst sie auf Deutsch «Rotten». Sie mündet bei Le Bouveret in den Genfersee, verlässt ihn in Genf wieder und fliesst durch Frankreich ins Mittelmeer.',
 '[{"k":"Länge","v":"rund 810 km"},{"k":"Quelle","v":"Rhonegletscher (Wallis)"},{"k":"Mündung","v":"Mittelmeer"},{"k":"Besonderes","v":"fliesst durch den Genfersee"}]',
 array['Rhône Valais','Rhône Glacier','Rhône Geneva'], 'Rhône'),
('gewaesser', 11, 'Aare', 'Fluss, Grimsel bis Koblenz AG',
 'Die Aare ist mit 288 km der längste Fluss, der ganz in der Schweiz fliesst. Sie entspringt an den Aaregletschern an der Grimsel und fliesst durch den Brienzersee, den Thunersee, die Stadt Bern und den Bielersee. In Bern schwimmen im Sommer viele Leute in der Aare. Bei Koblenz AG mündet sie in den Rhein und führt dort mehr Wasser als er.',
 '[{"k":"Länge","v":"288 km"},{"k":"Quelle","v":"Aaregletscher (Grimsel)"},{"k":"Mündung","v":"Rhein bei Koblenz AG"},{"k":"Besonderes","v":"längster Fluss ganz in der Schweiz"}]',
 array['Aare Bern','Aare Gorge Meiringen','Aare swimming Bern'], 'Aare'),
('gewaesser', 12, 'Reuss', 'Fluss, Gotthard bis Brugg',
 'Die Reuss entspringt im Gotthardgebiet und stürzt durch die wilde Schöllenenschlucht mit der Teufelsbrücke. Danach fliesst sie durch den Vierwaldstättersee und die Stadt Luzern unter der Kapellbrücke hindurch. Bei Brugg mündet sie in die Aare, dort, wo auch die Limmat dazukommt.',
 '[{"k":"Länge","v":"164 km"},{"k":"Quelle","v":"Gotthardgebiet (Uri)"},{"k":"Mündung","v":"Aare bei Brugg"},{"k":"Besonderes","v":"Schöllenenschlucht, Teufelsbrücke"}]',
 array['Reuss Schöllenen Devil''s Bridge','Reuss Lucerne','Reuss river Aargau'], 'Reuss (river)'),
('gewaesser', 13, 'Inn', 'Fluss, Engadin',
 'Der Inn entspringt beim Malojapass und fliesst durch das ganze Engadin, dem er seinen Namen gab: Engadin bedeutet «Tal des Inn». Danach fliesst er durch Österreich und mündet in Passau in die Donau. Sein Wasser gelangt so bis ins Schwarze Meer.',
 '[{"k":"Länge","v":"rund 520 km"},{"k":"Quelle","v":"Lunghinsee bei Maloja"},{"k":"Mündung","v":"Donau bei Passau"},{"k":"Besonderes","v":"Wasser fliesst ins Schwarze Meer"}]',
 array['Inn river Engadin','Inn river Scuol','Inn river autumn Engadin'], 'Inn (river)'),
('gewaesser', 14, 'Ticino', 'Fluss, Tessin',
 'Der Ticino entspringt beim Nufenenpass und gab dem Kanton Tessin seinen Namen. Er fliesst durch die Leventina und die Riviera bis in den Lago Maggiore. Danach fliesst er in Italien in den Po und mit ihm in die Adria.',
 '[{"k":"Länge","v":"rund 250 km"},{"k":"Quelle","v":"Nufenenpass"},{"k":"Mündung","v":"Po (Italien)"},{"k":"Besonderes","v":"gab dem Kanton den Namen"}]',
 array['Ticino river Leventina','Ticino river Bellinzona','Ticino river Lake Maggiore'], 'Ticino (river)'),
('gewaesser', 15, 'Doubs', 'Fluss, Jura / Neuenburg',
 'Der Doubs bildet über viele Kilometer die Grenze zwischen der Schweiz und Frankreich. Er fliesst in grossen Schleifen durch tiefe Jura-Täler; im Clos du Doubs macht er eine fast vollständige Kehrtwende. Beim Saut du Doubs stürzt er 27 m in die Tiefe. Er mündet in Frankreich in die Saône.',
 '[{"k":"Länge","v":"453 km"},{"k":"Quelle","v":"französischer Jura"},{"k":"Mündung","v":"Saône (Frankreich)"},{"k":"Besonderes","v":"Saut du Doubs (27 m)"}]',
 array['Doubs Saut du Doubs','Doubs Saint-Ursanne','Doubs river Jura autumn'], 'Doubs (river)')

) as n(cat, nr, name, sub, descr, facts, terms, wp)
where exists (select 1 from public.categories c where c.id = n.cat)
  and not exists (select 1 from public.entries e where lower(e.name) = lower(n.name));

commit;

-- Kontrolle: Einträge pro Kategorie (je 15; ausgeblendete zählen mit)
select c.sort, c.id, count(e.id) from public.categories c left join public.entries e on e.category_id = c.id
group by c.sort, c.id order by c.sort;

-- Glarner Einträge (Daten, keine Änderung am Aufbau; die Website braucht weiterhin mindestens Version 22):
--   16 neue Einträge aus dem Kanton Glarus in Berge, Gewässer, Sehenswürdigkeiten und Naturwunder,
--   alle dem Kanton Glarus zugeordnet (bestätigt, weil sie ausdrücklich für Glarus erstellt wurden).
--   Dazu 6 weitere Vorschläge aus bestehenden Einträgen (Insekten, Falter, Schädlinge), damit auch diese
--   Kategorien im Kanton erscheinen; sie sind wie in 022 als Vorschlag markiert.
-- Bilder: danach in der Verwaltung unter «Zu erledigen» → «Fehlende Bilder von Wikimedia übernehmen».
-- Einmal im Supabase-Dashboard unter «SQL Editor» ausführen. Lässt sich gefahrlos mehrmals ausführen
-- (gibt es einen Eintrag mit gleichem Namen in der Kategorie schon, wird er nicht nochmals angelegt).

begin;

with neu(cat, name, subtitle, description, facts, terms, wp, nr) as (values
  -- Berge (Bildbeschriftungen: Berg, Gipfel, Umgebung, Stimmung)
  ('berge', 'Glärnisch', 'Glarus',
   'Der Glärnisch ist das mächtige Bergmassiv über der Stadt Glarus und dem Klöntal. Er hat drei Hauptgipfel: Bächistock, Vrenelisgärtli und Ruchen, alle über 2900 m hoch. Dazwischen liegt der Glärnischfirn, ein Gletscher, der wegen der Klimaerwärmung stark schrumpft. Eine Glarner Sage erzählt vom Vreneli, das auf dem Berg einen Garten anlegen wollte und dabei im Schnee begraben wurde.',
   '[{"k":"Höhe","v":"2915 m (Bächistock)"},{"k":"Gipfel","v":"Bächistock, Vrenelisgärtli, Ruchen"},{"k":"Gletscher","v":"Glärnischfirn"},{"k":"Hütte","v":"Glärnischhütte (rund 1990 m)"}]',
   array['Vrenelisgärtli', 'Klöntalersee Glärnisch', 'Glärnisch Glarus'], 'Glärnisch', 1),
  ('berge', 'Hausstock', 'Glarus / Graubünden',
   'Der Hausstock gehört mit 3158 m zu den höchsten Gipfeln der Glarner Alpen. Er steht im Süden des Kantons an der Grenze zu Graubünden. Von der Alp Erbs oberhalb von Elm sieht man seine mächtige Nordostwand.',
   '[{"k":"Höhe","v":"3158 m"},{"k":"Lage","v":"Grenze Glarus–Graubünden"},{"k":"Aussicht","v":"Nordostwand von Erbs ob Elm"}]',
   array['Hausstock Glarus', 'Hausstock Elm', 'Hausstock summit'], 'Hausstock', 2),
  ('berge', 'Kärpf', 'Glarus',
   'Der Grosse Kärpf ist der höchste Gipfel im Freiberg Kärpf zwischen Linthtal und Sernftal. Schon 1548 verbot der Glarner Rat hier die Jagd, damit Gämsen und Murmeltiere nicht ausgerottet wurden. Der Freiberg gilt darum als ältestes Wildschutzgebiet Europas. Heute leben hier Gämsen, Steinböcke, Hirsche und Murmeltiere.',
   '[{"k":"Höhe","v":"2794 m (Grosser Kärpf)"},{"k":"Schutzgebiet","v":"Freiberg Kärpf, seit 1548"},{"k":"Hütte","v":"Leglerhütte (2273 m)"},{"k":"Tiere","v":"Gämsen, Steinböcke, Murmeltiere"}]',
   array['Kärpf Glarus', 'Leglerhütte', 'Freiberg Kärpf'], 'Kärpf', 3),
  ('berge', 'Ortstock', 'Glarus / Schwyz',
   'Der Ortstock steht an der Grenze zwischen Glarus und Schwyz und ist der Hausberg von Braunwald. Seine Nord- und seine Südwand sind sehr steil. Über die weniger steile Westflanke führt ein Bergweg auf den Gipfel.',
   '[{"k":"Höhe","v":"2717 m"},{"k":"Lage","v":"Grenze Glarus–Schwyz"},{"k":"Ausgangspunkt","v":"Braunwald"}]',
   array['Ortstock Braunwald', 'Ortstock Glattalp', 'Ortstock summit'], 'Ortstock', 4),
  -- Gewässer (Ansicht, Ufer, Umgebung, Stimmung)
  ('gewaesser', 'Klöntalersee', 'See, Glarus',
   'Der Klöntalersee liegt im Klöntal westlich von Glarus, direkt unter den steilen Felswänden des Glärnischs. Entstanden ist er durch einen Bergsturz, der das Tal abriegelte. Seit 1908 staut ein Damm ihn zusätzlich auf; sein Wasser treibt das Kraftwerk Löntsch bei Netstal an. Am Ufer entlang führt die Strasse über den Pragelpass in den Kanton Schwyz.',
   '[{"k":"Fläche","v":"rund 3,3 km²"},{"k":"Länge","v":"rund 5 km"},{"k":"Höhe","v":"848 m ü. M."},{"k":"Besonderes","v":"Stausee für das Kraftwerk Löntsch"}]',
   array['Klöntalersee shore', 'Klöntal', 'Klöntalersee winter'], 'Klöntalersee', 1),
  ('gewaesser', 'Linth', 'Fluss, Glarus bis Zürichsee',
   'Die Linth entsteht oberhalb der Pantenbrücke bei Linthal, wo sich Sand- und Limmerenbach aus dem Tödigebiet vereinigen. Sie fliesst nach Norden durch das ganze Glarnerland. Seit 1811 leitet der Escherkanal sie in den Walensee, von dort fliesst ihr Wasser durch den Linthkanal in den Zürichsee. Früher überschwemmte sie mit ihrem Geröll immer wieder die Linthebene.',
   '[{"k":"Ursprung","v":"Sand- und Limmerenbach (Tödigebiet)"},{"k":"Mündung","v":"Walensee, weiter in den Zürichsee"},{"k":"Besonderes","v":"Linthkorrektion 1807–1816"}]',
   array['Linth Glarus', 'Linth Schwanden', 'Linthkanal'], 'Linth', 2),
  ('gewaesser', 'Limmernsee', 'Stausee, Linthal',
   'Der Limmernsee ist ein Stausee hoch über Linthal im Tödigebiet. Zusammen mit dem höher gelegenen Muttsee bildet er das Pumpspeicherwerk Limmern: Gibt es viel Strom, wird Wasser rund 600 m hinauf in den Muttsee gepumpt; braucht man Strom, fliesst es durch die Turbinen zurück. Das Kraftwerk liegt tief im Berg. Die Staumauer des Muttsees ist mit über 1 km die längste der Schweiz.',
   '[{"k":"Typ","v":"Stausee"},{"k":"Kraftwerk","v":"Pumpspeicherwerk Limmern (seit 2016)"},{"k":"Leistung","v":"1000 MW"},{"k":"Besonderes","v":"längste Staumauer der Schweiz am Muttsee"}]',
   array['Limmernsee', 'Muttsee Staumauer', 'Linth-Limmern'], 'Limmernsee', 3),
  ('gewaesser', 'Obersee', 'Bergsee ob Näfels, Glarus',
   'Der Obersee liegt in einem stillen Hochtal oberhalb von Näfels. Eine Bergstrasse führt von Näfels hinauf. Bei ruhigem Wetter spiegeln sich die Berge im Wasser. Er ist ein beliebtes Ziel für Wanderungen.',
   '[{"k":"Höhe","v":"rund 980 m ü. M."},{"k":"Fläche","v":"rund 24 ha"},{"k":"Lage","v":"Oberseetal ob Näfels"}]',
   array['Obersee Näfels', 'Oberseetal', 'Obersee Glarus'], 'Obersee (Glarus)', 4),
  -- Sehenswürdigkeiten (Ansicht, Detail, Umgebung, Stimmung)
  ('sehenswuerdigkeiten', 'Freulerpalast', 'Näfels, Glarus',
   'Der Freulerpalast in Näfels gehört zu den bedeutendsten Herrenhäusern der Schweiz aus dem 17. Jahrhundert. Gardeoberst Kaspar Freuler, der als Offizier dem französischen König diente, liess ihn 1642–1648 bauen. Die prunkvollen Säle mit Stuck, Täfer und Kassettendecken sind bis heute erhalten. Seit 1946 ist hier das Museum des Landes Glarus untergebracht.',
   '[{"k":"Bauzeit","v":"1642–1648"},{"k":"Bauherr","v":"Kaspar Freuler"},{"k":"Heute","v":"Museum des Landes Glarus (seit 1946)"}]',
   array['Freulerpalast Näfels', 'Freulerpalast Saal', 'Näfels'], null, 1),
  ('sehenswuerdigkeiten', 'Landsgemeinde', 'Zaunplatz, Glarus',
   'An der Landsgemeinde versammeln sich die Stimmberechtigten des Kantons Glarus einmal im Jahr unter freiem Himmel im «Ring» auf dem Zaunplatz in Glarus. Sie entscheiden durch Handerheben über Gesetze und Wahlen; der Landammann schätzt ab, welche Seite die Mehrheit hat. Neben Glarus kennt nur noch Appenzell Innerrhoden diese alte Form der Demokratie. Seit 2007 dürfen in Glarus schon 16-Jährige mitstimmen, als erste in der Schweiz.',
   '[{"k":"Termin","v":"in der Regel erster Sonntag im Mai"},{"k":"Ort","v":"Zaunplatz, Glarus"},{"k":"Abstimmen","v":"durch Handerheben"},{"k":"Stimmrechtsalter","v":"16 Jahre (seit 2007)"}]',
   array['Landsgemeinde Glarus', 'Zaunplatz Glarus', 'Landsgemeinde Glarus Ring'], 'Landsgemeinde', 2),
  ('sehenswuerdigkeiten', 'Landesplattenberg Engi', 'Engi, Glarus',
   'Im Landesplattenberg in Engi im Sernftal wurde jahrhundertelang Schiefer abgebaut, belegt seit 1565 und bis 1961. Aus den Platten entstanden unter anderem Tischplatten, Dachschiefer und Schreibtafeln für Schulen. Im Schiefer fand man versteinerte Fische, die schon ab 1705 der Naturforscher Johann Jakob Scheuchzer sammelte. Heute führen Führungen durch die Stollen und Hallen des Besucherbergwerks.',
   '[{"k":"Abbau","v":"1565 bis 1961"},{"k":"Gestein","v":"Schiefer"},{"k":"Fossilien","v":"versteinerte Fische"},{"k":"Heute","v":"Besucherbergwerk mit Führungen"}]',
   array['Landesplattenberg Engi', 'Engi Schiefer', 'Sernftal Engi'], null, 3),
  ('sehenswuerdigkeiten', 'Pantenbrücke', 'Linthal, Glarus',
   'Die Pantenbrücke überquert hinter Linthal die tiefe Linthschlucht. Eine erste Steinbrücke ist schon für 1457 belegt; Lawinen und Steinschlag zerstörten die Brücke mehrmals. Heute stehen zwei Brücken übereinander: unten eine steinerne Bogenbrücke von 1853/54, darüber eine neuere. Kurz oberhalb vereinigen sich Sand- und Limmerenbach zur Linth.',
   '[{"k":"Erste Steinbrücke","v":"1457"},{"k":"Untere Brücke","v":"1853/54"},{"k":"Lage","v":"Linthschlucht bei Linthal"}]',
   array['Pantenbrücke', 'Linthschlucht', 'Tierfehd'], null, 4),
  ('sehenswuerdigkeiten', 'Escherkanal', 'Mollis / Walensee, Glarus',
   'Der Escherkanal leitet die Linth seit 1811 bei Mollis in den Walensee. Früher lagerte der Fluss so viel Geröll in der Linthebene ab, dass sie versumpfte und immer wieder überschwemmt wurde. Hans Conrad Escher setzte sich für die Linthkorrektion ein; zu seinen Ehren hiess er später «Escher von der Linth». Im Walensee setzt sich das Geröll ab, und das Wasser fliesst durch den Linthkanal weiter in den Zürichsee.',
   '[{"k":"Eröffnet","v":"1811"},{"k":"Länge","v":"5 km"},{"k":"Initiant","v":"Hans Conrad Escher"},{"k":"Zweck","v":"Schutz vor Hochwasser und Geröll"}]',
   array['Escherkanal', 'Escherkanal Walensee', 'Linthkanal'], null, 5),
  ('sehenswuerdigkeiten', 'Braunwald', 'autofreies Dorf, Glarus',
   'Braunwald liegt auf einer Sonnenterrasse rund 600 m über Linthal und ist autofrei. Hinauf kommt man nur zu Fuss oder mit der Standseilbahn, die in rund 7 Minuten oben ist. Im Sommer ist das Dorf Ausgangspunkt für Wanderungen, etwa zum Ortstock, im Winter ein Skigebiet für Familien.',
   '[{"k":"Höhe","v":"rund 1256 m ü. M."},{"k":"Zugang","v":"Standseilbahn ab Linthal"},{"k":"Besonderes","v":"autofrei"}]',
   array['Braunwald Glarus', 'Braunwaldbahn', 'Braunwald winter'], 'Braunwald', 6),
  -- Naturwunder (Ansicht, Detail, Umgebung, Stimmung)
  ('naturwunder', 'Lochsite', 'Glarner Hauptüberschiebung, Schwanden',
   'Bei der Lochsite in Schwanden sieht man die Glarner Hauptüberschiebung aus nächster Nähe und kann den Finger auf die Linie legen. Oben liegt der alte Verrucano, unten der viel jüngere Flysch, dazwischen eine dünne, helle Kalkschicht. Ältere Gesteine liegen hier über jüngeren, weil bei der Entstehung der Alpen riesige Gesteinspakete über weite Strecken geschoben wurden. Die Stelle gehört zum UNESCO-Welterbe Tektonikarena Sardona.',
   '[{"k":"Lage","v":"Schwanden (Glarus Süd)"},{"k":"Welterbe","v":"Tektonikarena Sardona (seit 2008)"},{"k":"Besonderes","v":"altes Gestein liegt auf jüngerem"}]',
   array['Lochsite Schwanden', 'Glarus thrust', 'Tschingelhörner'], 'Glarus thrust', 1),
  ('naturwunder', 'Berglistüber', 'Linthal, Glarus',
   'Der Berglistüber ist ein Wasserfall an der Klausenpassstrasse oberhalb von Linthal. Der Fätschbach stürzt hier über eine Felsstufe rund 40 m in die Tiefe. Vom Parkplatz an der Strasse sind es nur wenige Minuten zu Fuss. Früher konnte man hinter den Wasserfall gehen; heute ist das aus Sicherheitsgründen nicht mehr erlaubt.',
   '[{"k":"Fallhöhe","v":"rund 40 m"},{"k":"Bach","v":"Fätschbach"},{"k":"Zugang","v":"wenige Minuten ab der Klausenstrasse"}]',
   array['Berglistüber', 'Fätschbach', 'Klausenpass Linthal'], null, 2)
)
insert into public.entries (category_id, name, subtitle, description, facts, search_terms, wp, visible, sort)
select n.cat, n.name, n.subtitle, n.description, n.facts::jsonb, n.terms, n.wp, true,
       coalesce((select max(e.sort) from public.entries e where e.category_id = n.cat), 0) + n.nr
  from neu n
 where not exists (select 1 from public.entries e where e.category_id = n.cat and e.name = n.name);

-- Die neuen Einträge gehören zu Glarus (bestätigt)
insert into public.entry_regions (entry_id, region_id, note, confirmed)
select e.id, 'glarus', '', true
  from public.entries e
  join (values ('berge', 'Glärnisch'), ('berge', 'Hausstock'), ('berge', 'Kärpf'), ('berge', 'Ortstock'),
               ('gewaesser', 'Klöntalersee'), ('gewaesser', 'Linth'), ('gewaesser', 'Limmernsee'), ('gewaesser', 'Obersee'),
               ('sehenswuerdigkeiten', 'Freulerpalast'), ('sehenswuerdigkeiten', 'Landsgemeinde'),
               ('sehenswuerdigkeiten', 'Landesplattenberg Engi'), ('sehenswuerdigkeiten', 'Pantenbrücke'),
               ('sehenswuerdigkeiten', 'Escherkanal'), ('sehenswuerdigkeiten', 'Braunwald'),
               ('naturwunder', 'Lochsite'), ('naturwunder', 'Berglistüber')) as v(cat, name)
    on e.category_id = v.cat and e.name = v.name
on conflict (entry_id, region_id) do nothing;

-- Weitere Vorschläge aus bestehenden Einträgen (auch im Glarnerland verbreitet)
insert into public.entry_regions (entry_id, region_id, note, confirmed)
select e.id, 'glarus', '', false
  from public.entries e
  join (values ('insekten', 'Honigbiene'), ('insekten', 'Rote Waldameise'),
               ('falter', 'Tagpfauenauge'), ('falter', 'Kleiner Fuchs'), ('falter', 'Schwalbenschwanz'),
               ('schaedlinge', 'Buchdrucker')) as v(cat, name)
    on e.category_id = v.cat and e.name = v.name
on conflict (entry_id, region_id) do nothing;

update public.app_meta set schema_version = 23, updated_at = now();

commit;

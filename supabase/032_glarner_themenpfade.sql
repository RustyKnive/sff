-- Glarner Themenpfade (Version 2.27.0): vier neue Pfade mit Bezug zum Kanton Glarus, aus vorhandenen Einträgen und Aufträgen.
-- Schritte {cat, entry, text}: Kategorie, Name des Eintrags, Leitfrage. Bearbeiten seit 2.27.0 in der Verwaltung («Pfade und Netze»).
-- Einmal im Supabase-Dashboard unter «SQL Editor» ausführen. Lässt sich gefahrlos mehrmals ausführen (bestehende Pfade bleiben).

begin;

insert into public.paths (id, title, intro, steps, tasks, sort) values
('glarner-hauptueberschiebung', 'Die Glarner Hauptüberschiebung',
 'Im Glarnerland liegen alte Gesteine über jüngeren. Dieses Rätsel hat Forschende lange beschäftigt; heute gehört die Gegend zum UNESCO-Welterbe Tektonikarena Sardona. Geh den Pfad und finde heraus, wie das möglich ist.',
 '[
  {"cat":"naturwunder","entry":"Lochsite","text":"Hier sieht man die Grenze zwischen den Gesteinen aus der Nähe. Welches Gestein liegt oben, welches unten?"},
  {"cat":"steine","entry":"Verrucano","text":"Das rötliche Gestein ist viel älter als die Schichten darunter. Woran erkennst du es?"},
  {"cat":"steine","entry":"Flysch","text":"Flysch ist jünger als der Verrucano und liegt trotzdem darunter. Wie kann das sein?"},
  {"cat":"naturwunder","entry":"Martinsloch","text":"Im Fels über Elm sieht man die Linie der Überschiebung von weitem. Und was hat das Loch mit der Sonne zu tun?"},
  {"cat":"berge","entry":"Glärnisch","text":"Auch der Glärnisch besteht aus Gesteinsdecken, die übereinander geschoben wurden. Aus welchem Gestein ist er grösstenteils?"},
  {"cat":"steine","entry":"Kalkstein","text":"Kalkstein ist im Meer entstanden. Wie kommt er auf die Glarner Berge?"},
  {"cat":"steine","entry":"Schiefer","text":"Glarner Schiefer lässt sich in dünne Platten spalten. Wofür wurde er gebraucht?"},
  {"cat":"sehenswuerdigkeiten","entry":"Landesplattenberg Engi","text":"Im Schiefer fand man versteinerte Fische. Was verraten sie über die Zeit, als das Gestein entstand?"},
  {"cat":"geschichte","entry":"Bergsturz von Elm","text":"Der Abbau von Schiefer hatte 1881 schlimme Folgen. Was ist passiert?"}
 ]'::jsonb, '{gl-lochsite,gl-martinsloch,gl-elm}', 20),
('wasser-glarnerland', 'Wasser im Glarnerland',
 'Von den Gletschern am Tödi bis zum Walensee: Folge dem Wasser durch das Glarnerland, durch Schluchten, Stauseen und Kanäle, und lerne, wie die Menschen es zähmen und nutzen.',
 '[
  {"cat":"berge","entry":"Tödi","text":"Am höchsten Glarner Berg beginnt die Reise des Wassers. Welcher Fluss entspringt hier?"},
  {"cat":"gewaesser","entry":"Limmernsee","text":"Hoch über Linthal liegt ein Stausee. Wozu wird sein Wasser genutzt?"},
  {"cat":"sehenswuerdigkeiten","entry":"Pantenbrücke","text":"Hier hat sich die Linth tief in den Fels gegraben. Wie entsteht so eine Schlucht?"},
  {"cat":"naturwunder","entry":"Berglistüber","text":"Wo im Glarnerland stürzt dieser Wasserfall herab, und woher kommt sein Wasser?"},
  {"cat":"gewaesser","entry":"Linth","text":"Die Linth fliesst durch das ganze Tal. Warum trat sie früher so oft über die Ufer?"},
  {"cat":"gewaesser","entry":"Klöntalersee","text":"Ein Bergsee am Fuss des Glärnisch. Wie ist er entstanden?"},
  {"cat":"gewaesser","entry":"Obersee","text":"Ein kleiner Bergsee hoch über Näfels. Was erfährst du über ihn?"},
  {"cat":"sehenswuerdigkeiten","entry":"Escherkanal","text":"Hans Conrad Escher leitete die Linth in den Walensee. Was sollte das bewirken?"},
  {"cat":"gewaesser","entry":"Walensee","text":"Hier mündet der Escherkanal. Wohin fliesst das Wasser danach?"},
  {"cat":"fische","entry":"Bachforelle","text":"In den kühlen Bergbächen lebt die Bachforelle. Was braucht sie zum Leben?"}
 ]'::jsonb, '{sg-quinten}', 30),
('glarner-geschichte', 'Glarner Geschichte und Politik',
 'Vom heiligen Fridolin bis zum Stimmrecht ab 16: Wie ist das Glarnerland zu dem geworden, was es heute ist, und wie bestimmen seine Bürgerinnen und Bürger mit?',
 '[
  {"cat":"geschichte","entry":"Heiliger Fridolin","text":"Er ist im Glarner Wappen zu sehen. Wer war er?"},
  {"cat":"geschichte","entry":"Schlacht bei Näfels","text":"1388 verteidigten sich die Glarner bei Näfels. Wie wird noch heute jedes Jahr daran erinnert?"},
  {"cat":"sehenswuerdigkeiten","entry":"Freulerpalast","text":"Ein prächtiger Palast in Näfels. Wer liess ihn bauen, und was ist heute darin?"},
  {"cat":"geschichte","entry":"Huldrych Zwingli","text":"Bevor er nach Zürich ging, war der Reformator Pfarrer in Glarus. Was hat er später verändert?"},
  {"cat":"geschichte","entry":"Brand von Glarus","text":"1861 brannte der Hauptort fast ganz ab. Warum sind die Strassen im Zentrum heute so gerade?"},
  {"cat":"politik","entry":"Landsgemeinde","text":"Jedes Jahr im Mai entscheiden die Glarnerinnen und Glarner unter freiem Himmel. Wie funktioniert das?"},
  {"cat":"politik","entry":"Landrat Glarus","text":"Was macht das Kantonsparlament, bevor die Landsgemeinde abstimmt?"},
  {"cat":"politik","entry":"Stimmrecht ab 16","text":"Glarus war der erste Kanton mit Stimmrecht ab 16. Seit wann gilt es?"},
  {"cat":"politik","entry":"Glarner Gemeindereform","text":"Aus vielen kleinen Gemeinden wurden drei. Wie heissen sie?"},
  {"cat":"spezialitaeten","entry":"Schabziger","text":"Schon vor über 500 Jahren gab es Regeln für diesen Käse. Was ist das Besondere an ihm?"}
 ]'::jsonb, '{gl-naefelser-fahrt,gl-glarus-strassen,gl-stimmrecht,gl-schabziger}', 40),
('glarner-alpen', 'Tiere und Pflanzen der Glarner Alpen',
 'Über der Waldgrenze leben Tiere und Pflanzen, die mit Kälte, Wind und kurzen Sommern zurechtkommen. Im Freiberg Kärpf sind sie seit Jahrhunderten geschützt.',
 '[
  {"cat":"berge","entry":"Kärpf","text":"Der Freiberg Kärpf gilt als ältestes Wildschutzgebiet Europas. Seit wann gibt es ihn?"},
  {"cat":"saeugetiere","entry":"Gämse","text":"Wie schafft es die Gämse, im steilen Fels sicher zu klettern?"},
  {"cat":"saeugetiere","entry":"Alpensteinbock","text":"Der Steinbock war in der Schweiz einmal ausgerottet. Wie kam er zurück?"},
  {"cat":"saeugetiere","entry":"Murmeltier","text":"Wie überlebt das Murmeltier den langen Winter?"},
  {"cat":"voegel","entry":"Steinadler","text":"Wovon ernährt sich der grosse Greifvogel der Glarner Berge?"},
  {"cat":"voegel","entry":"Alpenschneehuhn","text":"Im Winter ist es weiss, im Sommer braun gesprenkelt. Wozu?"},
  {"cat":"alpenblumen","entry":"Edelweiss","text":"Warum ist das Edelweiss so filzig behaart?"},
  {"cat":"alpenblumen","entry":"Alpenrose","text":"Wo wächst die Alpenrose besonders gern?"},
  {"cat":"sehenswuerdigkeiten","entry":"Braunwald","text":"Im autofreien Dorf beginnen viele Wanderungen in die Alpen. Welche Tiere und Pflanzen könntest du dort sehen?"}
 ]'::jsonb, '{gl-kaerpf-jubilaeum,steinbock,edelweiss}', 50)
on conflict (id) do nothing;

update public.app_meta set schema_version = 32, updated_at = now();

commit;

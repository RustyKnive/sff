-- Lernziele pro Kategorie und 37 weitere Verwechslungspaare (Wunsch aus dem Feedback eines Kollegen, 30.9.2026).
--   categories.goal: ein Satz «Lernziel», steht oben in der Kategorie (leer = kein Lernziel)
--   entries.confusions: neue Paare in beide Richtungen; bestehende Hinweise bleiben, doppelte werden nicht angelegt
-- Einmal im Supabase-Dashboard unter «SQL Editor» ausführen, BEVOR die neue index.js online ist
-- (die Anzeige fragt die Spalte goal ab). Lässt sich gefahrlos mehrmals ausführen.

begin;

alter table public.categories
  add column if not exists goal text not null default ''
    constraint categories_goal_len check (char_length(goal) <= 300);

update public.categories c
   set goal = g.goal
  from (values
    ('baeume', 'Die wichtigsten Waldbäume der Schweiz an Wuchs, Blättern oder Nadeln, Früchten und Rinde erkennen und benennen.'),
    ('straeucher', 'Häufige Sträucher von Hecke und Waldrand an Blättern, Blüten und Früchten erkennen und giftige Früchte meiden.'),
    ('alpenblumen', 'Blumen über der Waldgrenze an Blüte und Blättern erkennen und wissen, welche geschützt oder giftig sind.'),
    ('wiesenblumen', 'Blumen der Wiesen und Weiden erkennen und die giftige Herbstzeitlose sicher von ähnlichen Pflanzen unterscheiden.'),
    ('graeser', 'Wiesen- und Ufergräser an Blütenstand und Ährchen unterscheiden und wissen, wo sie wachsen.'),
    ('pilze', 'Speise- und Giftpilze erkennen und ihre gefährlichen Doppelgänger kennen; gegessen wird nur nach der Pilzkontrolle.'),
    ('saeugetiere', 'Wildtiere aus Wald und Gebirge erkennen und ähnliche Arten wie Reh und Rothirsch sicher unterscheiden.'),
    ('hunde', 'Schweizer und häufige Hunderassen erkennen und die vier Sennenhunde sowie die Laufhunde auseinanderhalten.'),
    ('voegel', 'Vögel vom Bartgeier bis zum Rotkehlchen an Gestalt, Gefieder und Lebensraum erkennen, einige auch an der Stimme.'),
    ('reptilien', 'Eidechsen, Schlangen und Schildkröten erkennen und die beiden Giftschlangen Kreuzotter und Aspisviper sicher bestimmen.'),
    ('amphibien', 'Frösche, Kröten, Molche und Salamander erkennen und ihren Nachwuchs der richtigen Art zuordnen.'),
    ('fische', 'Einheimische Fische an Körperform, Flossen und Färbung erkennen und wissen, in welchen Gewässern sie leben.'),
    ('insekten', 'Insekten von der Honigbiene bis zum Hirschkäfer erkennen und ihre Larven zuordnen.'),
    ('falter', 'Tagfalter und tagaktive Nachtfalter an Farbe und Flügelmuster erkennen und ihre Raupen zuordnen.'),
    ('nutztiere', 'Schweizer Rassen von Hof und Alp erkennen: Rinder, Pferde, Schafe, Ziegen, Schweine und Hühner.'),
    ('steine', 'Gesteine und Mineralien der Schweiz an Farbe, Körnung und Aufbau erkennen und wissen, wo sie vorkommen.'),
    ('berge', 'Bekannte Berge der Schweiz an ihrer Gestalt erkennen und auf der Landkarte finden.'),
    ('gewaesser', 'Die grossen Seen und Flüsse der Schweiz erkennen und wissen, in welcher Gegend sie liegen.'),
    ('sehenswuerdigkeiten', 'Berühmte Bauwerke und Orte der Schweiz erkennen und wissen, wo sie stehen und wofür sie bekannt sind.'),
    ('naturwunder', 'Wasserfälle, Schluchten, Gletscher und Felsen der Schweiz erkennen und erklären, wie sie entstanden sind.'),
    ('schaedlinge', 'Schädlinge in Wald, Feld und Garten an Tier, Larve und Schadbild erkennen.'),
    ('wetterphaenomene', 'Wetter und Himmelserscheinungen der Schweiz erkennen und in einfachen Worten erklären, wie sie entstehen.')
  ) as g(id, goal)
 where c.id = g.id;

-- Verwechslungspaare: der Satz erscheint bei beiden Einträgen (wie in 014), nur wenn der Hinweis dort noch fehlt
with pairs(a, b, diff) as (values
  ('Eibe', 'Weisstanne', 'Die Eibe hat weiche, zugespitzte Nadeln ohne weisse Streifen und rote Samenmäntel statt Zapfen; die Weisstanne hat stumpfe Nadeln mit zwei weissen Streifen auf der Unterseite und aufrechte Zapfen. Die Eibe ist fast überall giftig.'),
  ('Esche', 'Vogelbeere', 'Beide haben gefiederte Blätter. Die Vogelbeere hat gesägte Fiederblättchen und leuchtend rote Beeren in Dolden; die Esche hat grössere Fiederblättchen, schwarze Knospen und geflügelte Nüsschen.'),
  ('Hasel', 'Hagebuche', 'Die Hasel hat rundliche, weich behaarte Blätter und wächst als vielstämmiger Strauch mit Haselnüssen; die Hagebuche hat längliche, doppelt gesägte, gefaltete Blätter und geflügelte Nüsschen.'),
  ('Trollblume', 'Scharfer Hahnenfuss', 'Die Trollblume hat grosse, kugelig geschlossene gelbe Blüten; der Scharfe Hahnenfuss hat kleinere, offene, glänzend gelbe Schalenblüten.'),
  ('Silberwurz', 'Gletscher-Hahnenfuss', 'Die Silberwurz hat meist acht weisse Kronblätter und kleine, eichenblattähnliche Blätter; der Gletscher-Hahnenfuss hat fünf Kronblätter, die sich oft rosa färben, und dicke, handförmig geteilte Blätter.'),
  ('Türkenbund', 'Feuerlilie', 'Beide sind Lilien. Die Feuerlilie hat aufrechte, orangerote Blüten; der Türkenbund hat nickende, rosa Blüten mit stark zurückgerollten Blütenblättern.'),
  ('Löwenzahn', 'Wiesen-Bocksbart', 'Der Wiesen-Bocksbart hat schmale, grasartige Blätter am Stängel und schliesst seine Blüte schon am Mittag; der Löwenzahn hat grob gezähnte Blätter in einer Rosette und blattlose, hohle Stängel.'),
  ('Wiesen-Flockenblume', 'Acker-Witwenblume', 'Die Flockenblume hat unter dem Blütenkopf eine kugelige Hülle aus braunen, gefransten Schuppen; die Witwenblume hat flache, hellviolette Blütenköpfe ohne solche Schuppen und behaarte Stängel.'),
  ('Wiesen-Fuchsschwanz', 'Wiesen-Lieschgras', 'Beide haben walzenförmige Ähren. Der Wiesen-Fuchsschwanz blüht schon im Mai, seine Ähre ist weich und seidig; das Wiesen-Lieschgras blüht erst im Sommer, seine Ähre fühlt sich rau an.'),
  ('Glatthafer', 'Goldhafer', 'Der Glatthafer ist hoch und hat grössere, nickende Ährchen mit einer geknieten Granne; der Goldhafer ist niedriger, seine lockere Rispe glänzt goldgelb.'),
  ('Maronen-Röhrling', 'Steinpilz', 'Der Maronen-Röhrling hat gelbe Röhren, die bei Druck blau anlaufen, und einen Stiel ohne Netz; der Steinpilz hat weisse bis olivgrüne Röhren, die nicht blau werden, und ein helles Netz am dicken Stiel.'),
  ('Wolf', 'Deutscher Schäferhund', 'Der Wolf hat längere Beine, eine schmale Brust, kleinere Ohren und einen geraden Rücken, den Schwanz trägt er hängend; der Schäferhund hat einen abfallenden Rücken und grosse, steil aufgestellte Ohren.'),
  ('Graureiher', 'Weissstorch', 'Der Weissstorch ist weiss mit schwarzen Flügeln und rotem Schnabel und fliegt mit gestrecktem Hals; der Graureiher ist grau, hat einen gelben Schnabel und zieht im Flug den Hals S-förmig ein.'),
  ('Blindschleiche', 'Kreuzotter', 'Die Blindschleiche ist eine harmlose, beinlose Eidechse: glatte, glänzende Haut, kein abgesetzter Kopf, bewegliche Augenlider; die Kreuzotter hat einen abgesetzten Kopf, ein dunkles Zickzackband und senkrechte Pupillen.'),
  ('Waldeidechse', 'Zauneidechse', 'Die Waldeidechse ist kleiner und schlanker, braun mit dunklem Rückenstreif und bringt lebende Junge zur Welt; die Zauneidechse ist kräftiger, das Männchen im Frühling an den Seiten grün.'),
  ('Westliche Smaragdeidechse', 'Zauneidechse', 'Die Smaragdeidechse ist viel grösser (bis 40 cm) und fast ganz leuchtend grün, die Männchen mit blauer Kehle; bei der Zauneidechse ist nur das Männchen an den Seiten grün.'),
  ('Europäische Sumpfschildkröte', 'Rotwangen-Schmuckschildkröte', 'Die einheimische Sumpfschildkröte ist dunkel mit feinen gelben Punkten; die ausgesetzte Rotwangen-Schmuckschildkröte hat einen roten Fleck hinter dem Auge.'),
  ('Würfelnatter', 'Barren-Ringelnatter', 'Die Würfelnatter hat würfelartige dunkle Flecken und keine hellen Flecken am Hinterkopf; die Ringelnatter hat meist zwei helle, gelbliche Flecken hinter dem Kopf.'),
  ('Vipernatter', 'Aspisviper', 'Die harmlose Vipernatter ahmt mit ihrem Zickzackband die Aspisviper nach, hat aber runde Pupillen und grosse Schilde auf dem Kopf; die giftige Aspisviper hat senkrechte Pupillen, eine aufgestülpte Schnauze und kleine Schuppen auf dem Kopf.'),
  ('Äskulapnatter', 'Gelbgrüne Zornnatter', 'Die Äskulapnatter ist einfarbig olivbraun mit gelblichem Bauch; die Gelbgrüne Zornnatter ist schwarz mit gelbgrüner Fleckenzeichnung.'),
  ('Fadenmolch', 'Teichmolch', 'Das Fadenmolch-Männchen hat am Schwanzende einen dünnen Faden und nur eine niedrige Rückenleiste; das Teichmolch-Männchen trägt zur Paarungszeit einen hohen, gewellten Rückenkamm.'),
  ('Seesaibling', 'Bachforelle', 'Der Seesaibling hat helle, rötliche Punkte auf dunklem Grund und weiss gesäumte Bauchflossen; die Bachforelle hat schwarze und rote Punkte, oft hell umrandet.'),
  ('Barbe', 'Nase', 'Die Barbe hat vier Barteln am Maul; die Nase hat keine Barteln, dafür eine vorstehende Schnauze und ein Maul mit harter Hornkante.'),
  ('Groppe', 'Trüsche', 'Die Trüsche hat einen langen, aalartigen Körper und eine Bartel am Kinn; die Groppe ist klein, hat einen breiten, flachen Kopf und keine Barteln.'),
  ('Blauflügel-Prachtlibelle', 'Blaugrüne Mosaikjungfer', 'Die Prachtlibelle ist zierlich, hat blau gefärbte Flügel und legt sie in Ruhe über dem Körper zusammen; die Mosaikjungfer ist gross und hält die durchsichtigen Flügel in Ruhe ausgebreitet.'),
  ('Aurorafalter', 'Grosser Kohlweissling', 'Das Aurorafalter-Männchen hat orange Flügelspitzen, beide Geschlechter eine grün marmorierte Unterseite; der Grosse Kohlweissling hat schwarze Flügelspitzen und eine gelbliche Unterseite.'),
  ('Toggenburger Ziege', 'Bündner Strahlenziege', 'Beide haben helle Streifen am Kopf. Die Toggenburger Ziege ist hell- bis mausbraun; die Bündner Strahlenziege ist schwarz mit weissen «Strahlen» am Kopf und an den Beinen.'),
  ('Eringer', 'Evolèner', 'Das Eringer Rind ist einfarbig schwarz bis dunkel rotbraun, kurz und kräftig; das Evolèner ist rot oder schwarz mit weissen Flecken.'),
  ('Marmor', 'Kalkstein', 'Marmor ist umgewandelter Kalkstein: körnig-kristallin und oft weiss glitzernd; Kalkstein ist feinkörnig und dicht, oft grau, und enthält manchmal Fossilien.'),
  ('Nagelfluh', 'Sandstein (Molasse)', 'Nagelfluh besteht aus runden, groben Kieseln, die wie Beton verkittet sind; im Sandstein sind die Körner so klein, dass man sie kaum einzeln sieht.'),
  ('Speckstein (Giltstein)', 'Serpentinit', 'Beide sind grünlich. Speckstein ist so weich, dass man ihn mit dem Fingernagel ritzen kann, und fühlt sich seifig an; Serpentinit ist härter und oft gefleckt wie eine Schlangenhaut.'),
  ('Gips', 'Steinsalz', 'Beide sind hell und weich. Steinsalz schmeckt salzig und löst sich in Wasser; Gips lässt sich mit dem Fingernagel ritzen und schmeckt nach nichts.'),
  ('Nebelmeer', 'Stratus-Wolke', 'Das Nebelmeer ist eine Stratus-Schicht von oben gesehen: Wer auf einem Berg darüber steht, sieht ein Meer aus Nebel; von unten ist dieselbe Schicht eine graue Hochnebeldecke.'),
  ('Raureif', 'Glatteis', 'Raureif sind Eiskristalle, die aus Nebel oder feuchter Luft an Ästen und Zäunen wachsen; Glatteis ist eine glatte Eisschicht auf dem Boden, wenn Regen auf gefrorenen Boden fällt.'),
  ('Föhn', 'Bise', 'Der Föhn ist ein warmer, trockener Fallwind aus Süden in den Alpentälern; die Bise ist ein kalter, trockener Wind aus Nordosten über dem Mittelland.'),
  ('Kirschenfliege', 'Kirschessigfliege', 'Die Kirschenfliege hat dunkel gebänderte Flügel und befällt reifende Kirschen; die Kirschessigfliege ist eine kleine Taufliege mit roten Augen, die Männchen haben einen dunklen Fleck an der Flügelspitze.'),
  ('Japankäfer', 'Goldglänzender Rosenkäfer', 'Der Japankäfer ist nur etwa 1 cm gross, hat einen grün glänzenden Kopf, kupferbraune Flügeldecken und weisse Haarbüschel am Hinterleib; der Rosenkäfer ist grösser und ganz goldgrün.')
),
dirs as (select a as von, b as zu, diff from pairs union all select b, a, diff from pairs),
neu as (
  select e.id, jsonb_agg(jsonb_build_object('name', d.zu, 'diff', d.diff) order by d.zu) as dazu
    from public.entries e
    join dirs d on d.von = e.name
   where not exists (select 1 from jsonb_array_elements(e.confusions) x where x->>'name' = d.zu)
   group by e.id
)
update public.entries e
   set confusions = e.confusions || n.dazu
  from neu n
 where e.id = n.id;

update public.app_meta set schema_version = 19, updated_at = now();

commit;

-- Kontrolle: Kategorien ohne Lernziel (sollte leer sein) und Zahl der Einträge mit Verwechslungshinweis
select id, name from public.categories where goal = '';
select count(*) as eintraege_mit_verwechslung from public.entries where jsonb_array_length(confusions) > 0;
select schema_version, updated_at from public.app_meta;

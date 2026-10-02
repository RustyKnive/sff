-- Textkorrekturen aus der KI-Vorprüfung der Inhalte (Prüfliste vom 30.9.2026, Spalte «KI-Hinweis»), 2.10.2026.
--   Nur die genannten Textstellen werden ersetzt (replace), der übrige Text bleibt; ist eine Stelle schon korrigiert, ändert sich nichts.
-- Einmal im Supabase-Dashboard unter «SQL Editor» ausführen. Lässt sich gefahrlos mehrmals ausführen.

begin;

-- Bergahorn: Die Buchten zwischen den Lappen sind spitz (stumpfe Buchten hat der Spitzahorn)
update public.entries set description = replace(description,
  'fünflappig mit stumpfen Buchten.',
  'fünflappig mit spitzen Buchten und grob gesägtem Rand.')
 where id = '6c3f542f-e343-4f69-aa45-6b6e63c20d18';

-- Vogelbeere und Esche: Beerenfarbe überall «orangerot» wie in Beschreibung und Steckbrief der Vogelbeere
update public.entries set confusions = replace(confusions::text,
  'leuchtend rote Beeren in Dolden',
  'orangerote Beeren in Dolden')::jsonb
 where id in ('aa1faea9-701e-43cb-b4a3-ec1e73b6d393', 'cc8fa67d-956f-4a03-9c4f-0723e363f350');

-- Westliche Smaragdeidechse: auch die Weibchen sind grün, typisch für die Männchen ist die blaue Kehle
update public.entries set description = replace(description,
  'Die Männchen sind leuchtend grün und haben zur Paarungszeit eine blaue Kehle.',
  'Sie ist leuchtend grün, die Männchen haben zur Paarungszeit eine blaue Kehle.')
 where id = '514bbd0f-7f5e-477e-9535-a8dd647caf90';

-- Alpensteinbock: 1906 kamen die ersten Tiere in die Schweiz (Wildpark), ausgesetzt wurden sie ab 1911
update public.entries set description = replace(description,
  'Ab 1906 wurden Tiere aus dem Gran-Paradiso-Gebiet in Italien wieder angesiedelt',
  'Ab 1906 wurden Tiere aus dem Gran-Paradiso-Gebiet in Italien in die Schweiz gebracht und ab 1911 wieder ausgesetzt')
 where id = '26678569-5de2-413b-86d5-b5084c461ebd';

-- Raureif: Fachbegriff Raueis ergänzen
update public.entries set description = replace(description,
  'die gegen die Windrichtung immer länger werden.',
  'die gegen die Windrichtung immer länger werden. Genau genommen spricht man dabei von Raueis.')
 where id = '1ec544a4-cfa7-47e4-951b-4492366f1c0f'
   and description not like '%Raueis%';

-- Admiral: inzwischen überwintern auch Admirale in der Schweiz
update public.entries set description = replace(description,
  'über die Alpen zu uns.',
  'über die Alpen zu uns; wegen der milderen Winter überwintern inzwischen auch immer mehr in der Schweiz.')
 where id = 'b496d943-76be-4535-a97a-9bfafe5d942a'
   and description not like '%überwintern%';

-- Erdhummel: Mindesttemperatur unsicher, darum ohne genaue Zahl
update public.entries set facts = replace(facts::text,
  'fliegt schon ab ca. 2 °C',
  'fliegt schon bei wenigen Grad über null')::jsonb
 where id = '7f358a76-460e-47f6-a71f-69f95635da46';

-- Kartoffelkäfer: erste Funde in Europa 1877, Ausbreitung ab den 1920er-Jahren
update public.entries set description = replace(description,
  'stammt aus Nordamerika und wurde im 20. Jahrhundert nach Europa eingeschleppt.',
  'stammt aus Nordamerika, wurde Ende des 19. Jahrhunderts erstmals nach Europa eingeschleppt und breitete sich ab den 1920er-Jahren aus.')
 where id = '657401bc-a1c9-446f-87b6-743fefd4e4bf';

-- Hundsrose: Blütezeit meist Mai bis Juni (zählt auch für «Jetzt zu sehen»)
update public.entries set facts = replace(facts::text,
  '"Blütezeit", "v": "Juni"',
  '"Blütezeit", "v": "Mai–Juni"')::jsonb
 where id = '5f96757b-8941-46a4-aa01-83a1aa08d1ec';

-- Alpenglühen: Alpenglühen im engeren Sinn ergänzen
update public.entries set description = replace(description,
  'Besonders schön ist es an hohen, freistehenden Bergen.',
  'Im engeren Sinn ist Alpenglühen nur das Leuchten, wenn die Sonne schon untergegangen oder noch nicht aufgegangen ist und die Gipfel bloss noch vom roten Himmel angestrahlt werden. Besonders schön ist es an hohen, freistehenden Bergen.')
 where id = '56a05a81-d363-4873-b76a-9d2ba54636ee'
   and description not like '%Im engeren Sinn%';

update public.app_meta set schema_version = 20, updated_at = now();

commit;

-- Kontrolle: alle 11 Zeilen sollten «ok» zeigen
select e.name, case when x.ok then 'ok' else 'NICHT geändert' end as stand
  from public.entries e
  join (values
    ('6c3f542f-e343-4f69-aa45-6b6e63c20d18'::uuid, 'description', 'spitzen Buchten'),
    ('aa1faea9-701e-43cb-b4a3-ec1e73b6d393'::uuid, 'confusions', 'orangerote Beeren in Dolden'),
    ('cc8fa67d-956f-4a03-9c4f-0723e363f350'::uuid, 'confusions', 'orangerote Beeren in Dolden'),
    ('514bbd0f-7f5e-477e-9535-a8dd647caf90'::uuid, 'description', 'Sie ist leuchtend grün'),
    ('26678569-5de2-413b-86d5-b5084c461ebd'::uuid, 'description', 'ab 1911 wieder ausgesetzt'),
    ('1ec544a4-cfa7-47e4-951b-4492366f1c0f'::uuid, 'description', 'Raueis'),
    ('b496d943-76be-4535-a97a-9bfafe5d942a'::uuid, 'description', 'überwintern'),
    ('7f358a76-460e-47f6-a71f-69f95635da46'::uuid, 'facts', 'wenigen Grad über null'),
    ('657401bc-a1c9-446f-87b6-743fefd4e4bf'::uuid, 'description', 'Ende des 19. Jahrhunderts'),
    ('5f96757b-8941-46a4-aa01-83a1aa08d1ec'::uuid, 'facts', 'Mai–Juni'),
    ('56a05a81-d363-4873-b76a-9d2ba54636ee'::uuid, 'description', 'Im engeren Sinn')
  ) as c(id, feld, text) on c.id = e.id
  cross join lateral (select case c.feld
      when 'description' then e.description
      when 'facts' then e.facts::text
      else e.confusions::text end like '%' || c.text || '%' as ok) x
 order by e.name;

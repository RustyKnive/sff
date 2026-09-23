-- Daten: Matterhorn von den Sehenswürdigkeiten zu den Bergen verschieben (mit seinen Bildern),
-- dafür neu das Martinsloch (Glarus) bei den Sehenswürdigkeiten.
-- Einmal im Supabase-Dashboard unter «SQL Editor» ausführen. Lässt sich gefahrlos mehrmals ausführen.
-- Das Bild fürs Martinsloch danach in der Verwaltung mit «Fehlende Bilder von Wikimedia übernehmen» holen.

begin;

-- Titelbild der Sehenswürdigkeiten war das Matterhorn: neu die Kapellbrücke
update public.categories
   set cover_entry_id = (select id from public.entries where category_id = 'sehenswuerdigkeiten' and name = 'Kapellbrücke')
 where id = 'sehenswuerdigkeiten'
   and cover_entry_id = (select id from public.entries where category_id = 'sehenswuerdigkeiten' and name = 'Matterhorn');

-- Matterhorn zu den Bergen (Bilder, Steckbrief und Suchbegriffe bleiben)
update public.entries
   set category_id = 'berge',
       sort = (select coalesce(max(e.sort), -1) + 1 from public.entries e where e.category_id = 'berge')
 where name = 'Matterhorn' and category_id = 'sehenswuerdigkeiten';

-- Neu: Martinsloch
insert into public.entries (category_id, name, subtitle, description, facts, search_terms, wp, sort)
select 'sehenswuerdigkeiten', 'Martinsloch', 'Elm, Glarus',
  'Das Martinsloch ist ein grosses Felsenfenster in den Tschingelhörnern hoch über Elm. Zweimal im Jahr, im März und Ende September, scheint die Morgensonne genau durch das Loch auf den Kirchturm von Elm. Unterhalb des Lochs sieht man als scharfe Linie die Glarner Hauptüberschiebung: Hier liegt uraltes Gestein auf viel jüngerem. Das Gebiet gehört als Tektonikarena Sardona zum UNESCO-Welterbe.',
  '[{"k":"Lage","v":"Tschingelhörner über Elm (Glarus)"},{"k":"UNESCO-Welterbe","v":"seit 2008 (Tektonikarena Sardona)"},{"k":"Besonderes","v":"Sonne scheint zweimal im Jahr auf die Kirche von Elm"}]'::jsonb,
  array['Martinsloch Elm','Tschingelhörner Glarus thrust','Elm Glarus church'],
  'Martinsloch',
  (select coalesce(max(e.sort), -1) + 1 from public.entries e where e.category_id = 'sehenswuerdigkeiten')
where not exists (select 1 from public.entries where lower(name) = 'martinsloch');

commit;

-- Kontrolle
select category_id, count(*) from public.entries
 where category_id in ('berge', 'sehenswuerdigkeiten') group by category_id;

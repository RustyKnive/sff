-- KI-generierte Bilder kennzeichnen: Die Infografiken der Kategorie Wetterphänomene (je Bild 2) wurden mit ChatGPT
-- erstellt und hatten keine Quelle; der Bildnachweis zeigte sie deshalb als «eigenes Foto».
-- Seit Website 2.4.0 gilt: Bild ohne Quelle, aber mit Angabe unter «Dateiname» → diese Angabe steht im Bildnachweis
-- und im Druck. Hier wird sie für die bestehenden Infografiken gesetzt; neue in der Verwaltung unter «Dateiname» eintragen.
-- Im Supabase-Dashboard unter «SQL Editor» ausführen. Lässt sich gefahrlos mehrmals ausführen.

begin;

update public.images i
set source_file = 'KI-generiert mit ChatGPT (OpenAI)'
from public.entries e
where e.id = i.entry_id
  and e.category_id = 'wetterphaenomene'
  and i.position = 2
  and i.source_page is null
  and i.source_file is null;

update public.app_meta set schema_version = 17, updated_at = now();

commit;

-- Kontrolle: sollte 19 Zeilen zeigen
select e.name, i.position, i.source_file
from public.images i join public.entries e on e.id = i.entry_id
where i.source_file like 'KI-generiert%'
order by e.sort;

-- Bewusst leere Bildplätze: «Fehlende Bilder von Wikimedia übernehmen» füllt sie nicht wieder.
-- Einmal im Supabase-Dashboard unter «SQL Editor» ausführen, BEVOR die neue Verwaltung (js/admin.js) benutzt wird.
-- Lässt sich gefahrlos mehrmals ausführen.
-- Die Verwaltung setzt einen Platz beim Entfernen eines Bildes auf «leer» und hebt das auf, sobald dort wieder ein Bild gespeichert wird.

alter table public.entries
  add column if not exists empty_slots smallint[] not null default '{}'
  constraint entries_empty_slots_1_4 check (empty_slots <@ array[1,2,3,4]::smallint[]);

-- Die heute leeren Plätze gelten als bewusst leer (nur bei Einträgen, die schon eigene Bilder haben)
update public.entries e
   set empty_slots = array(select p::smallint from generate_series(1, 4) p
                            where not exists (select 1 from public.images i where i.entry_id = e.id and i.position = p)
                            order by p)
 where cardinality(e.empty_slots) = 0
   and exists (select 1 from public.images i where i.entry_id = e.id);

-- Kontrolle: Einträge mit bewusst leeren Plätzen
select c.name as kategorie, e.name as eintrag, e.empty_slots
from public.entries e join public.categories c on c.id = e.category_id
where cardinality(e.empty_slots) > 0
order by c.sort, e.sort;

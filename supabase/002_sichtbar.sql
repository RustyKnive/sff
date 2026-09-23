-- Kategorien und Einträge ein- und ausblenden
-- Einmal im Supabase-Dashboard unter «SQL Editor» ausführen (nach schema.sql).
-- Ausgeblendete Zeilen sieht nur ein Admin; die öffentliche Seite bekommt sie gar nicht erst.

alter table public.categories add column if not exists visible boolean not null default true;
alter table public.entries    add column if not exists visible boolean not null default true;

drop policy if exists "lesen" on public.categories;
create policy "lesen" on public.categories
  for select to anon, authenticated using (visible or public.is_admin());

drop policy if exists "lesen" on public.entries;
create policy "lesen" on public.entries
  for select to anon, authenticated using (visible or public.is_admin());

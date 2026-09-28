-- Versionierung: Die Datenbank kennt ihre Schema-Version (Nummer der zuletzt eingespielten SQL-Datei).
-- Anzeige und Verwaltung vergleichen sie mit der Version, die sie brauchen (js/version.js, «schema»),
-- und melden klar, wenn ein Datenbank-Update fehlt.
-- Jede neue SQL-Datei setzt ab jetzt am Schluss ihre Nummer:
--   update public.app_meta set schema_version = <Nummer>, updated_at = now();
-- Einmal im Supabase-Dashboard unter «SQL Editor» ausführen, BEVOR die Website-Version 2.0.0 online ist.
-- Lässt sich gefahrlos mehrmals ausführen.

begin;

create table if not exists public.app_meta (
  id int primary key default 1 check (id = 1),   -- genau eine Zeile
  schema_version int not null,
  updated_at timestamptz not null default now()
);

alter table public.app_meta enable row level security;
drop policy if exists "lesen" on public.app_meta;
create policy "lesen" on public.app_meta for select to anon, authenticated using (true);
grant select on public.app_meta to anon, authenticated;

insert into public.app_meta (id, schema_version) values (1, 15)
  on conflict (id) do update set schema_version = excluded.schema_version, updated_at = now();

commit;

-- Kontrolle
select schema_version, updated_at from public.app_meta;

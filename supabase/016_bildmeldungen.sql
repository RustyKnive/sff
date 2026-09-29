-- Bildmeldungen: Besucherinnen und Besucher melden in der Grossansicht ein unpassendes Bild («Melden»).
-- Die Meldung landet in image_reports; die Verwaltung zeigt sie in der Übersicht unter «Gemeldete Bilder».
-- Schreiben nur über die Funktion report_image() (prüft Eintrag und Bildnummer, fasst gleiche Meldungen zusammen);
-- lesen und löschen dürfen nur Admins. Keine Mail, keine Kosten.
-- Einmal im Supabase-Dashboard unter «SQL Editor» ausführen, BEVOR die Website-Version 2.1.0 online ist.
-- Lässt sich gefahrlos mehrmals ausführen.

begin;

create table if not exists public.image_reports (
  id           bigint generated always as identity primary key,
  entry_id     uuid not null references public.entries (id) on delete cascade,
  position     smallint not null check (position between 1 and 4),
  storage_path text,                                                   -- gemeldetes Bild; null = Online-Ersatz (kein eigenes Bild)
  reason       text not null default '' check (char_length(reason) <= 300),  -- freiwillige Begründungen, mit « · » getrennt
  times        integer not null default 1,                            -- so oft gemeldet
  created_at   timestamptz not null default now(),
  last_at      timestamptz not null default now()
);
create index if not exists image_reports_entry_idx on public.image_reports (entry_id, position);

alter table public.image_reports enable row level security;
drop policy if exists "admin_lesen_loeschen" on public.image_reports;
create policy "admin_lesen_loeschen" on public.image_reports
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.image_reports from anon;
grant select, delete on public.image_reports to authenticated;

-- Melden (auch ohne Anmeldung). Dieselbe Datei am selben Platz ergibt keine neue Zeile, sondern zählt hoch.
create or replace function public.report_image(p_entry uuid, p_position integer, p_reason text default '')
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_path   text;
  v_reason text := left(btrim(coalesce(p_reason, '')), 200);
begin
  if p_position is null or p_position not between 1 and 4 then
    raise exception 'Bildnummer muss 1–4 sein';
  end if;
  if not exists (select 1 from public.entries where id = p_entry and visible) then
    raise exception 'Eintrag nicht gefunden';
  end if;
  -- Schutz vor Missbrauch: höchstens 500 offene Meldungen
  if (select count(*) from public.image_reports) >= 500 then
    raise exception 'Zu viele offene Meldungen';
  end if;
  select storage_path into v_path from public.images where entry_id = p_entry and position = p_position;
  update public.image_reports
     set times = times + 1, last_at = now(),
         reason = case when v_reason = '' or strpos(reason, v_reason) > 0 then reason
                       else left(concat_ws(' · ', nullif(reason, ''), v_reason), 300) end
   where entry_id = p_entry and position = p_position and storage_path is not distinct from v_path;
  if not found then
    insert into public.image_reports (entry_id, position, storage_path, reason)
    values (p_entry, p_position, v_path, v_reason);
  end if;
end;
$$;
revoke all on function public.report_image(uuid, integer, text) from public;
grant execute on function public.report_image(uuid, integer, text) to anon, authenticated;

update public.app_meta set schema_version = 16, updated_at = now();

commit;

-- Kontrolle
select schema_version, updated_at from public.app_meta;

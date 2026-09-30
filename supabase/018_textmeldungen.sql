-- Textmeldungen: Besucherinnen und Besucher melden auf der Textseite der Grossansicht einen Fehler in Beschreibung,
-- Steckbrief oder Verwechslungsgefahr («Fehler melden»). Die Meldung landet wie die Bildmeldungen in image_reports,
-- mit position = 0 (Text). Die Funktion gibt die Nummer der Meldung zurück; die Anzeige zeigt sie an, damit
-- Lernende einen gefundenen Fehler ohne Namen in der Datenbank bei der Lehrperson vorweisen können.
-- Einmal im Supabase-Dashboard unter «SQL Editor» ausführen, BEVOR die Website-Version 2.6.0 online ist.
-- Lässt sich gefahrlos mehrmals ausführen.

begin;

-- Platz 0 = Text; längere Begründungen, weil sich bei Texten mehrere Meldungen sammeln
alter table public.image_reports drop constraint if exists image_reports_position_check;
alter table public.image_reports add constraint image_reports_position_check check (position between 0 and 4);
alter table public.image_reports drop constraint if exists image_reports_reason_check;
alter table public.image_reports add constraint image_reports_reason_check check (char_length(reason) <= 1000);

-- Melden (auch ohne Anmeldung). Eine Beschreibung ist Pflicht. Weitere Meldungen zum selben Eintrag zählen hoch und
-- hängen ihren Text an. Rückgabe: Nummer der Meldung.
create or replace function public.report_text(p_entry uuid, p_reason text)
returns bigint language plpgsql security definer set search_path = ''
as $$
declare
  v_reason text := left(btrim(coalesce(p_reason, '')), 300);
  v_id     bigint;
begin
  if char_length(v_reason) < 3 then
    raise exception 'Bitte beschreiben, was nicht stimmt';
  end if;
  if not exists (select 1 from public.entries where id = p_entry and visible) then
    raise exception 'Eintrag nicht gefunden';
  end if;
  -- Schutz vor Missbrauch: höchstens 500 offene Meldungen (Bilder und Texte zusammen)
  if (select count(*) from public.image_reports) >= 500 then
    raise exception 'Zu viele offene Meldungen';
  end if;
  update public.image_reports
     set times = times + 1, last_at = now(),
         reason = case when strpos(reason, v_reason) > 0 then reason
                       else left(concat_ws(' · ', nullif(reason, ''), v_reason), 1000) end
   where entry_id = p_entry and position = 0
  returning id into v_id;
  if v_id is null then
    insert into public.image_reports (entry_id, position, storage_path, reason)
    values (p_entry, 0, null, v_reason)
    returning id into v_id;
  end if;
  return v_id;
end;
$$;
revoke all on function public.report_text(uuid, text) from public;
grant execute on function public.report_text(uuid, text) to anon, authenticated;

update public.app_meta set schema_version = 18, updated_at = now();

commit;

-- Kontrolle
select schema_version, updated_at from public.app_meta;

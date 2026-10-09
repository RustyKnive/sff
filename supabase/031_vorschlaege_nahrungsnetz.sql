-- Steckbriefe vorschlagen und Nahrungsnetze (Version 2.26.0):
--   entry_proposals: Lernende schlagen einen fehlenden Eintrag vor (ohne Namen, wie die Textmeldungen). Schreiben nur über
--     propose_entry(), die eine Nummer zurückgibt (für den Preis); lesen und löschen nur Admins.
--   foodwebs: Nahrungsnetze pro Lebensraum. links = [{"f":[kat, eintrag], "e":[kat, eintrag]}] heisst
--     «f wird von e gefressen» (Pfeil von f nach e, in Richtung des Energieflusses). Einträge über Kategorie und Namen,
--     wie bei den Themenpfaden; fehlt ein Eintrag, lässt die Anzeige den Pfeil weg.
-- Einmal im Supabase-Dashboard unter «SQL Editor» ausführen, BEVOR die neue Website online ist.
-- Lässt sich gefahrlos mehrmals ausführen.

begin;

create table if not exists public.entry_proposals (
  id          bigint generated always as identity primary key,
  category_id text references public.categories(id) on update cascade on delete set null,
  name        text not null check (char_length(name) between 2 and 80),
  text        text not null check (char_length(text) between 10 and 600),
  place       text not null default '' check (char_length(place) <= 120),
  created_at  timestamptz not null default now()
);
alter table public.entry_proposals enable row level security;
drop policy if exists "admin" on public.entry_proposals;
create policy "admin" on public.entry_proposals for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.entry_proposals from anon;
grant select, delete on public.entry_proposals to authenticated;

-- Vorschlagen (auch ohne Anmeldung). Rückgabe: Nummer des Vorschlags.
create or replace function public.propose_entry(p_category text, p_name text, p_text text, p_place text)
returns bigint language plpgsql security definer set search_path = ''
as $$
declare
  v_name  text := left(btrim(coalesce(p_name, '')), 80);
  v_text  text := left(btrim(coalesce(p_text, '')), 600);
  v_place text := left(btrim(coalesce(p_place, '')), 120);
  v_cat   text := nullif(btrim(coalesce(p_category, '')), '');
  v_id    bigint;
begin
  if char_length(v_name) < 2 then raise exception 'Bitte einen Namen angeben'; end if;
  if char_length(v_text) < 10 then raise exception 'Bitte etwas mehr dazu schreiben'; end if;
  if v_cat is not null and not exists (select 1 from public.categories where id = v_cat and visible) then
    v_cat := null;
  end if;
  -- Schutz vor Missbrauch: höchstens 300 offene Vorschläge
  if (select count(*) from public.entry_proposals) >= 300 then
    raise exception 'Zu viele offene Vorschläge';
  end if;
  insert into public.entry_proposals (category_id, name, text, place)
  values (v_cat, v_name, v_text, v_place)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.propose_entry(text, text, text, text) from public;
grant execute on function public.propose_entry(text, text, text, text) to anon, authenticated;

create table if not exists public.foodwebs (
  id      text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title   text not null check (char_length(title) between 3 and 80),
  intro   text not null default '' check (char_length(intro) <= 600),
  links   jsonb not null default '[]'::jsonb check (jsonb_typeof(links) = 'array'),
  sort    integer not null default 0,
  visible boolean not null default true
);
alter table public.foodwebs enable row level security;
drop policy if exists "lesen" on public.foodwebs;
create policy "lesen" on public.foodwebs for select to anon, authenticated using (visible or public.is_admin());
drop policy if exists "admin_schreiben" on public.foodwebs;
create policy "admin_schreiben" on public.foodwebs for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.foodwebs to anon, authenticated;
grant insert, update, delete on public.foodwebs to authenticated;

insert into public.foodwebs (id, title, intro, links, sort) values
('wald', 'Nahrungsnetz Wald',
 'Buchen und Fichten, Beeren und Pilze ernähren viele Tiere, die wiederum Jägern als Beute dienen. Verbinde, wer von wem gefressen wird.',
 '[
  {"f":["baeume","Buche"],"e":["saeugetiere","Reh"]},
  {"f":["baeume","Buche"],"e":["saeugetiere","Wildschwein"]},
  {"f":["baeume","Buche"],"e":["saeugetiere","Eichhörnchen"]},
  {"f":["baeume","Buche"],"e":["insekten","Maikäfer"]},
  {"f":["baeume","Fichte (Rottanne)"],"e":["schaedlinge","Buchdrucker"]},
  {"f":["baeume","Fichte (Rottanne)"],"e":["saeugetiere","Eichhörnchen"]},
  {"f":["baeume","Fichte (Rottanne)"],"e":["saeugetiere","Rothirsch"]},
  {"f":["straeucher","Heidelbeere"],"e":["saeugetiere","Reh"]},
  {"f":["straeucher","Heidelbeere"],"e":["saeugetiere","Rotfuchs"]},
  {"f":["straeucher","Heidelbeere"],"e":["saeugetiere","Wildschwein"]},
  {"f":["pilze","Steinpilz"],"e":["saeugetiere","Eichhörnchen"]},
  {"f":["pilze","Steinpilz"],"e":["saeugetiere","Wildschwein"]},
  {"f":["schaedlinge","Buchdrucker"],"e":["voegel","Buntspecht"]},
  {"f":["insekten","Maikäfer"],"e":["saeugetiere","Wildschwein"]},
  {"f":["insekten","Maikäfer"],"e":["saeugetiere","Rotfuchs"]},
  {"f":["saeugetiere","Reh"],"e":["saeugetiere","Luchs"]},
  {"f":["saeugetiere","Reh"],"e":["saeugetiere","Wolf"]},
  {"f":["saeugetiere","Reh"],"e":["saeugetiere","Rotfuchs"]},
  {"f":["saeugetiere","Rothirsch"],"e":["saeugetiere","Wolf"]},
  {"f":["saeugetiere","Wildschwein"],"e":["saeugetiere","Wolf"]}
 ]'::jsonb, 10),
('gebirge', 'Nahrungsnetz Gebirge',
 'Über der Waldgrenze leben Pflanzenfresser von Gräsern, Kräutern und Beeren. Adler, Fuchs und Luchs jagen sie, der Bartgeier frisst die Knochen toter Tiere.',
 '[
  {"f":["graeser","Blaugras"],"e":["saeugetiere","Gämse"]},
  {"f":["graeser","Blaugras"],"e":["saeugetiere","Alpensteinbock"]},
  {"f":["graeser","Blaugras"],"e":["saeugetiere","Murmeltier"]},
  {"f":["graeser","Borstgras"],"e":["saeugetiere","Schneehase"]},
  {"f":["alpenblumen","Silberwurz"],"e":["voegel","Alpenschneehuhn"]},
  {"f":["straeucher","Heidelbeere"],"e":["voegel","Alpenschneehuhn"]},
  {"f":["straeucher","Heidelbeere"],"e":["saeugetiere","Schneehase"]},
  {"f":["baeume","Arve"],"e":["voegel","Tannenhäher"]},
  {"f":["saeugetiere","Murmeltier"],"e":["voegel","Steinadler"]},
  {"f":["saeugetiere","Murmeltier"],"e":["saeugetiere","Rotfuchs"]},
  {"f":["saeugetiere","Schneehase"],"e":["voegel","Steinadler"]},
  {"f":["saeugetiere","Schneehase"],"e":["saeugetiere","Rotfuchs"]},
  {"f":["voegel","Alpenschneehuhn"],"e":["voegel","Steinadler"]},
  {"f":["voegel","Alpenschneehuhn"],"e":["saeugetiere","Rotfuchs"]},
  {"f":["saeugetiere","Gämse"],"e":["saeugetiere","Luchs"]},
  {"f":["saeugetiere","Gämse"],"e":["saeugetiere","Wolf"]},
  {"f":["saeugetiere","Gämse"],"e":["voegel","Steinadler"]},
  {"f":["saeugetiere","Gämse"],"e":["voegel","Bartgeier"]},
  {"f":["saeugetiere","Alpensteinbock"],"e":["voegel","Bartgeier"]},
  {"f":["saeugetiere","Alpensteinbock"],"e":["voegel","Steinadler"]}
 ]'::jsonb, 20),
('gewaesser', 'Nahrungsnetz Bach und Teich',
 'Im und am Wasser fressen Fische Insektenlarven und kleinere Fische. Reiher, Taucher, Hecht und Ringelnatter stehen weiter oben im Netz.',
 '[
  {"f":["insekten","Blauflügel-Prachtlibelle"],"e":["fische","Bachforelle"]},
  {"f":["insekten","Blauflügel-Prachtlibelle"],"e":["fische","Groppe"]},
  {"f":["insekten","Blaugrüne Mosaikjungfer"],"e":["fische","Egli"]},
  {"f":["amphibien","Grasfrosch"],"e":["insekten","Blaugrüne Mosaikjungfer"]},
  {"f":["amphibien","Grasfrosch"],"e":["reptilien","Barren-Ringelnatter"]},
  {"f":["amphibien","Grasfrosch"],"e":["voegel","Graureiher"]},
  {"f":["amphibien","Erdkröte"],"e":["reptilien","Barren-Ringelnatter"]},
  {"f":["fische","Elritze"],"e":["fische","Bachforelle"]},
  {"f":["fische","Elritze"],"e":["voegel","Graureiher"]},
  {"f":["fische","Groppe"],"e":["fische","Bachforelle"]},
  {"f":["fische","Bachforelle"],"e":["voegel","Graureiher"]},
  {"f":["fische","Rotauge"],"e":["fische","Hecht"]},
  {"f":["fische","Rotauge"],"e":["voegel","Haubentaucher"]},
  {"f":["fische","Egli"],"e":["fische","Hecht"]},
  {"f":["fische","Egli"],"e":["voegel","Haubentaucher"]},
  {"f":["graeser","Schilf"],"e":["saeugetiere","Biber"]},
  {"f":["baeume","Hängebirke"],"e":["saeugetiere","Biber"]}
 ]'::jsonb, 30),
('wiese', 'Nahrungsnetz Wiese',
 'Gräser und Blumen ernähren Insekten und Kühe. Eidechsen, Vögel und Schlangen leben von den Insekten und voneinander.',
 '[
  {"f":["wiesenblumen","Löwenzahn"],"e":["insekten","Honigbiene"]},
  {"f":["wiesenblumen","Rot-Klee"],"e":["insekten","Erdhummel"]},
  {"f":["wiesenblumen","Wiesen-Salbei"],"e":["insekten","Erdhummel"]},
  {"f":["wiesenblumen","Rot-Klee"],"e":["nutztiere","Braunvieh"]},
  {"f":["graeser","Knaulgras"],"e":["nutztiere","Braunvieh"]},
  {"f":["graeser","Knaulgras"],"e":["insekten","Feldgrille"]},
  {"f":["wiesenblumen","Gewöhnlicher Hornklee"],"e":["falter","Hauhechel-Bläuling"]},
  {"f":["graeser","Aufrechte Trespe"],"e":["falter","Schachbrett"]},
  {"f":["insekten","Honigbiene"],"e":["insekten","Hornisse"]},
  {"f":["insekten","Feldgrille"],"e":["reptilien","Zauneidechse"]},
  {"f":["insekten","Feldgrille"],"e":["voegel","Weissstorch"]},
  {"f":["insekten","Grünes Heupferd"],"e":["reptilien","Zauneidechse"]},
  {"f":["insekten","Grünes Heupferd"],"e":["voegel","Weissstorch"]},
  {"f":["falter","Schachbrett"],"e":["voegel","Kohlmeise"]},
  {"f":["falter","Hauhechel-Bläuling"],"e":["voegel","Kohlmeise"]},
  {"f":["reptilien","Zauneidechse"],"e":["reptilien","Schlingnatter"]},
  {"f":["reptilien","Zauneidechse"],"e":["voegel","Mäusebussard"]},
  {"f":["amphibien","Grasfrosch"],"e":["voegel","Weissstorch"]}
 ]'::jsonb, 40)
on conflict (id) do nothing;

update public.app_meta set schema_version = 31, updated_at = now();

commit;

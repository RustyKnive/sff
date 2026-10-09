-- Verknüpfte Einträge und Häkchen «von Hand geprüft» (Version 2.25.0):
--   entries.checked_at, categories.checked_at: Zeitpunkt der Prüfung von Hand, leer = noch nicht geprüft.
--     Ändert sich danach der Text (Name, Untertitel, Beschreibung, einfache Fassung, Steckbrief, Verwechslungen bzw. bei der
--     Kategorie Name, Beschreibung, Lernziel, Bildbeschriftungen), fällt das Häkchen weg – ausser die Änderung setzt es selbst
--     neu (so speichert die Verwaltung, wenn beim Bearbeiten «geprüft» angehakt bleibt).
--   entry_links: zwei Einträge, die zusammengehören (z. B. Kärpf und Gämse), in beide Richtungen sichtbar, mit kurzem Hinweis.
--     confirmed = false: Vorschlag (schon sichtbar), in der Verwaltung zu bestätigen. 71 Vorschläge von Claude.
-- Einmal im Supabase-Dashboard unter «SQL Editor» ausführen, BEVOR die neue Website online ist.
-- Lässt sich gefahrlos mehrmals ausführen.

begin;

alter table public.entries add column if not exists checked_at timestamptz;
alter table public.categories add column if not exists checked_at timestamptz;

create or replace function public.entries_check_reset() returns trigger language plpgsql as $$
begin
  if (new.name, new.subtitle, new.description, new.simple, new.facts, new.confusions)
       is distinct from (old.name, old.subtitle, old.description, old.simple, old.facts, old.confusions)
     and new.checked_at is not distinct from old.checked_at then
    new.checked_at := null;
  end if;
  return new;
end $$;
drop trigger if exists entries_check_reset on public.entries;
create trigger entries_check_reset before update on public.entries
  for each row execute function public.entries_check_reset();

create or replace function public.categories_check_reset() returns trigger language plpgsql as $$
begin
  if (new.name, new.description, new.goal, new.labels) is distinct from (old.name, old.description, old.goal, old.labels)
     and new.checked_at is not distinct from old.checked_at then
    new.checked_at := null;
  end if;
  return new;
end $$;
drop trigger if exists categories_check_reset on public.categories;
create trigger categories_check_reset before update on public.categories
  for each row execute function public.categories_check_reset();

create table if not exists public.entry_links (
  a          uuid not null references public.entries(id) on delete cascade,
  b          uuid not null references public.entries(id) on delete cascade,
  note       text not null default '' check (char_length(note) <= 160),
  confirmed  boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (a, b),
  check (a < b)                                   -- jedes Paar nur einmal, Richtung egal
);
create index if not exists entry_links_b_idx on public.entry_links (b);
alter table public.entry_links enable row level security;
drop policy if exists "lesen" on public.entry_links;
create policy "lesen" on public.entry_links for select to anon, authenticated using (true);
drop policy if exists "admin_schreiben" on public.entry_links;
create policy "admin_schreiben" on public.entry_links for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.entry_links to anon, authenticated;
grant insert, update, delete on public.entry_links to authenticated;

-- Vorschläge: Kategorie und Name beider Einträge, Hinweis (für beide Seiten verständlich)
insert into public.entry_links (a, b, note, confirmed)
select least(x.id, y.id), greatest(x.id, y.id), v.note, false
from (values
  -- Glarnerland
  ('berge', 'Kärpf', 'saeugetiere', 'Gämse', 'Im Freiberg Kärpf, einem der ältesten Wildschutzgebiete Europas (seit 1548)'),
  ('berge', 'Kärpf', 'saeugetiere', 'Alpensteinbock', 'Im Wildschutzgebiet Freiberg Kärpf'),
  ('berge', 'Kärpf', 'saeugetiere', 'Murmeltier', 'Im Wildschutzgebiet Freiberg Kärpf'),
  ('berge', 'Kärpf', 'steine', 'Verrucano', 'Das rote Gestein der Glarner Hauptüberschiebung prägt das Kärpfgebiet'),
  ('naturwunder', 'Martinsloch', 'steine', 'Verrucano', 'Glarner Hauptüberschiebung: älterer Verrucano liegt über jüngerem Flysch'),
  ('naturwunder', 'Martinsloch', 'steine', 'Flysch', 'Glarner Hauptüberschiebung: älterer Verrucano liegt über jüngerem Flysch'),
  ('naturwunder', 'Lochsite', 'steine', 'Verrucano', 'An der Lochsite sieht man die Überschiebungsfläche aus der Nähe'),
  ('naturwunder', 'Lochsite', 'steine', 'Flysch', 'An der Lochsite sieht man die Überschiebungsfläche aus der Nähe'),
  ('naturwunder', 'Lochsite', 'naturwunder', 'Martinsloch', 'Beide zeigen die Glarner Hauptüberschiebung (UNESCO-Welterbe Tektonikarena Sardona)'),
  ('sehenswuerdigkeiten', 'Landesplattenberg Engi', 'steine', 'Schiefer', 'Hier wurde Glarner Schiefer abgebaut, mit berühmten Fischfossilien'),
  ('geschichte', 'Bergsturz von Elm', 'steine', 'Schiefer', 'Der Schieferabbau am Plattenberg löste den Bergsturz aus'),
  ('berge', 'Glärnisch', 'steine', 'Kalkstein', 'Der Glärnisch besteht grösstenteils aus Kalkstein'),
  ('berge', 'Glärnisch', 'gewaesser', 'Klöntalersee', 'Der See liegt am Fuss des Glärnisch'),
  ('gewaesser', 'Linth', 'berge', 'Tödi', 'Die Linth entspringt am Tödi'),
  ('gewaesser', 'Linth', 'sehenswuerdigkeiten', 'Pantenbrücke', 'Die Brücke führt über die Schlucht der Linth'),
  ('gewaesser', 'Linth', 'sehenswuerdigkeiten', 'Escherkanal', 'Der Kanal leitet die Linth in den Walensee'),
  ('gewaesser', 'Linth', 'gewaesser', 'Walensee', 'Die Linth fliesst durch den Escherkanal in den Walensee'),
  ('gewaesser', 'Linth', 'gewaesser', 'Zürichsee', 'Vom Walensee fliesst die Linth durch den Linthkanal in den Zürichsee'),
  ('sehenswuerdigkeiten', 'Escherkanal', 'gewaesser', 'Walensee', 'Der Kanal mündet in den Walensee'),
  ('geschichte', 'Schlacht bei Näfels', 'sehenswuerdigkeiten', 'Freulerpalast', 'Beide in Näfels'),
  ('geschichte', 'Brand von Glarus', 'wetterphaenomene', 'Föhn', 'Ein Föhnsturm trieb 1861 das Feuer durch den Hauptort'),
  ('politik', 'Landsgemeinde', 'politik', 'Landrat Glarus', 'Das Kantonsparlament bereitet die Geschäfte der Landsgemeinde vor'),
  ('politik', 'Landsgemeinde', 'politik', 'Stimmrecht ab 16', 'Die Glarner Landsgemeinde beschloss 2007 das Stimmrecht ab 16'),
  ('politik', 'Landsgemeinde', 'politik', 'Glarner Gemeindereform', 'Die Landsgemeinde beschloss 2006, aus 25 Gemeinden drei zu machen'),
  ('sehenswuerdigkeiten', 'Braunwald', 'berge', 'Ortstock', 'Der Ortstock erhebt sich über Braunwald'),
  -- Gewässer und Orte der Schweiz
  ('naturwunder', 'Rheinfall', 'gewaesser', 'Rhein', 'Einer der grössten Wasserfälle Europas'),
  ('sehenswuerdigkeiten', 'Munot', 'gewaesser', 'Rhein', 'Schaffhausen liegt am Rhein'),
  ('gewaesser', 'Rhein', 'gewaesser', 'Bodensee', 'Der Rhein fliesst durch den Bodensee'),
  ('gewaesser', 'Rhein', 'fische', 'Äsche', 'Bei Schaffhausen lebt eine bekannte Äschenpopulation'),
  ('gewaesser', 'Rhein', 'naturwunder', 'Ruinaulta', 'Der Vorderrhein hat die Schlucht ins Bergsturzmaterial gegraben'),
  ('gewaesser', 'Rhein', 'naturwunder', 'Viamala-Schlucht', 'Schlucht des Hinterrheins'),
  ('gewaesser', 'Rhein', 'naturwunder', 'Taminaschlucht', 'Die Tamina mündet bei Bad Ragaz in den Rhein'),
  ('gewaesser', 'Rhone', 'naturwunder', 'Rhonegletscher', 'Die Rhone entspringt am Rhonegletscher'),
  ('gewaesser', 'Rhone', 'gewaesser', 'Genfersee', 'Die Rhone fliesst durch den Genfersee'),
  ('gewaesser', 'Genfersee', 'sehenswuerdigkeiten', 'Jet d''eau', 'Die Fontäne steht in Genf im See'),
  ('gewaesser', 'Genfersee', 'sehenswuerdigkeiten', 'Schloss Chillon', 'Das Schloss steht auf einem Felsen im See'),
  ('gewaesser', 'Genfersee', 'sehenswuerdigkeiten', 'Lavaux', 'Die Rebterrassen liegen über dem See'),
  ('gewaesser', 'Aare', 'naturwunder', 'Aareschlucht', 'Schlucht der Aare bei Meiringen'),
  ('gewaesser', 'Aare', 'gewaesser', 'Thunersee', 'Die Aare fliesst durch den Thunersee'),
  ('gewaesser', 'Thunersee', 'berge', 'Niesen', 'Die Pyramide des Niesen steht am Thunersee'),
  ('gewaesser', 'Reuss', 'gewaesser', 'Vierwaldstättersee', 'Die Reuss fliesst durch den Vierwaldstättersee'),
  ('gewaesser', 'Reuss', 'sehenswuerdigkeiten', 'Kapellbrücke', 'Die Brücke führt in Luzern über die Reuss'),
  ('gewaesser', 'Vierwaldstättersee', 'sehenswuerdigkeiten', 'Rütli', 'Die Wiese liegt am Urnersee'),
  ('gewaesser', 'Vierwaldstättersee', 'berge', 'Rigi', 'Die Rigi liegt zwischen Vierwaldstätter- und Zugersee'),
  ('gewaesser', 'Vierwaldstättersee', 'berge', 'Pilatus', 'Der Hausberg von Luzern'),
  ('sehenswuerdigkeiten', 'Rütli', 'geschichte', 'Rütlirapport 1940', 'General Guisan versammelte die Offiziere auf dem Rütli'),
  ('gewaesser', 'Inn', 'gewaesser', 'Silsersee', 'Der Inn fliesst durch die Oberengadiner Seen'),
  ('naturwunder', 'Morteratschgletscher', 'berge', 'Piz Bernina', 'Der Gletscher fliesst vom Berninamassiv herab'),
  ('gewaesser', 'Ticino', 'gewaesser', 'Lago Maggiore', 'Der Ticino mündet in den Lago Maggiore'),
  ('gewaesser', 'Ticino', 'sehenswuerdigkeiten', 'Burgen von Bellinzona', 'Die Burgen sperrten das Tal des Ticino'),
  ('naturwunder', 'Seealpsee', 'berge', 'Säntis', 'Beide im Alpstein'),
  ('naturwunder', 'Hölloch', 'steine', 'Kalkstein', 'Wasser hat die Höhle aus dem Kalkstein gelöst'),
  ('naturwunder', 'Staubbachfall', 'naturwunder', 'Trümmelbachfälle', 'Beide im Lauterbrunnental'),
  ('naturwunder', 'Creux du Van', 'saeugetiere', 'Alpensteinbock', 'In den Felsen des Creux du Van lebt eine Steinbock-Kolonie'),
  ('naturwunder', 'Creux du Van', 'saeugetiere', 'Gämse', 'Gämsen leben in den Felsen des Creux du Van'),
  ('naturwunder', 'Grosser Aletschgletscher', 'baeume', 'Arve', 'Im Aletschwald am Gletscher wachsen jahrhundertealte Arven'),
  ('naturwunder', 'Grosser Aletschgletscher', 'sehenswuerdigkeiten', 'Jungfraujoch', 'Vom Jungfraujoch sieht man auf den Gletscher'),
  ('berge', 'Eiger', 'sehenswuerdigkeiten', 'Jungfraujoch', 'Die Jungfraubahn fährt durch den Eiger'),
  ('sehenswuerdigkeiten', 'Kloster Einsiedeln', 'nutztiere', 'Einsiedler', 'Die Pferderasse wird seit Jahrhunderten im Kloster gezüchtet'),
  ('geschichte', 'Huldrych Zwingli', 'sehenswuerdigkeiten', 'Grossmünster', 'Zwingli predigte am Grossmünster'),
  ('politik', 'Bundesrat', 'sehenswuerdigkeiten', 'Bundeshaus', 'Sitz von Regierung und Parlament'),
  ('politik', 'Nationalrat', 'sehenswuerdigkeiten', 'Bundeshaus', 'Sitz von Regierung und Parlament'),
  ('politik', 'Ständerat', 'sehenswuerdigkeiten', 'Bundeshaus', 'Sitz von Regierung und Parlament'),
  ('geschichte', 'Bundesverfassung 1848', 'politik', 'Bundesrat', 'Die Verfassung von 1848 schuf den Bundesrat'),
  -- Natur: wer lebt wovon, wer wächst wo
  ('schaedlinge', 'Buchdrucker', 'baeume', 'Fichte (Rottanne)', 'Der Käfer befällt vor allem geschwächte Fichten'),
  ('schaedlinge', 'Kastaniengallwespe', 'baeume', 'Edelkastanie', 'Die Wespe bildet Gallen an Kastanien'),
  ('schaedlinge', 'Eichenprozessionsspinner', 'baeume', 'Stieleiche', 'Die Raupen fressen Eichenlaub'),
  ('insekten', 'Alpenbock', 'baeume', 'Buche', 'Die Larven entwickeln sich in altem Buchenholz'),
  ('voegel', 'Tannenhäher', 'baeume', 'Arve', 'Er versteckt Arvennüsse und verbreitet so die Arve'),
  ('pilze', 'Fliegenpilz', 'baeume', 'Hängebirke', 'Er lebt in Gemeinschaft mit Birken und Fichten'),
  ('pilze', 'Steinpilz', 'baeume', 'Fichte (Rottanne)', 'Wächst oft unter Fichten, auch unter Buchen und Eichen')
) as v(ca, na, cb, nb, note)
join public.entries x on x.category_id = v.ca and x.name = v.na
join public.entries y on y.category_id = v.cb and y.name = v.nb
on conflict (a, b) do nothing;

update public.app_meta set schema_version = 30, updated_at = now();

commit;

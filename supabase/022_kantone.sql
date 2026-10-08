-- Kantone (Version 2.17.0): eigener Bereich pro Kanton mit eigenem Erscheinungsbild.
--   regions:       ein Kanton (id = Adresse, z. B. «glarus» → je-net.ch/sff/glarus), Name, Kürzel, Einleitung,
--                  Farben aus dem Wappen (color Hauptfarbe, color2 Zweitfarbe, color3 Akzent, on_color Schrift auf der Hauptfarbe)
--                  und Kantonszeichen (emblem: «icons/…» = Datei der Website, sonst Pfad im Bucket «bilder»)
--   entry_regions: welcher Eintrag zu welchem Kanton gehört (ein Eintrag kann zu mehreren Kantonen gehören),
--                  note = kurzer Hinweis «Im Kanton …», confirmed = false: Vorschlag, in der Verwaltung noch nicht bestätigt
--   Bucket «bilder»: erlaubt neu auch PNG (Kantonszeichen mit durchsichtigem Hintergrund)
-- Einmal im Supabase-Dashboard unter «SQL Editor» ausführen, BEVOR die neue index.js online ist
-- (die Anzeige lädt die Zuordnung mit den Einträgen). Lässt sich gefahrlos mehrmals ausführen.

begin;

create table if not exists public.regions (
  id         text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name       text not null check (char_length(name) between 2 and 60),
  title      text not null default '' check (char_length(title) <= 80),
  code       text not null default '' check (code ~ '^[A-Z]{0,3}$'),
  intro      text not null default '' check (char_length(intro) <= 400),
  color      text not null default '#d7261e' check (color ~ '^#[0-9a-f]{6}$'),
  color2     text not null default '#1b1b1b' check (color2 ~ '^#[0-9a-f]{6}$'),
  color3     text not null default '#f0b323' check (color3 ~ '^#[0-9a-f]{6}$'),
  on_color   text not null default '#ffffff' check (on_color ~ '^#[0-9a-f]{6}$'),
  emblem     text,
  visible    boolean not null default true,
  sort       integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists regions_updated_at on public.regions;
create trigger regions_updated_at before update on public.regions
  for each row execute function public.set_updated_at();

create table if not exists public.entry_regions (
  entry_id   uuid not null references public.entries(id) on delete cascade,
  region_id  text not null references public.regions(id) on update cascade on delete cascade,
  note       text not null default '' check (char_length(note) <= 200),
  confirmed  boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (entry_id, region_id)
);
create index if not exists entry_regions_region_idx on public.entry_regions (region_id);

alter table public.regions enable row level security;
drop policy if exists "lesen" on public.regions;
create policy "lesen" on public.regions for select to anon, authenticated using (visible or public.is_admin());
drop policy if exists "admin_schreiben" on public.regions;
create policy "admin_schreiben" on public.regions for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.entry_regions enable row level security;
drop policy if exists "lesen" on public.entry_regions;
create policy "lesen" on public.entry_regions for select to anon, authenticated using (true);
drop policy if exists "admin_schreiben" on public.entry_regions;
create policy "admin_schreiben" on public.entry_regions for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.regions, public.entry_regions to anon, authenticated;
grant insert, update, delete on public.regions, public.entry_regions to authenticated;

update storage.buckets
   set allowed_mime_types = array['image/jpeg', 'image/png', 'audio/mpeg']
 where id = 'bilder';

-- Kanton Glarus: Farben aus dem Wappen (Rot, Schwarz, Gold), Zeichen nach Fridolin (Pilgerstab, Buch, Heiligenschein).
-- Bestehende Angaben bleiben unverändert.
insert into public.regions (id, name, title, code, intro, color, color2, color3, on_color, emblem, sort)
values ('glarus', 'Glarus', 'Kanton Glarus', 'GL',
  'Pflanzen, Tiere, Gesteine und Landschaften, die im Glarnerland zu Hause sind: vom Walensee bis zum Tödi.',
  '#d7261e', '#1b1b1b', '#f0b323', '#ffffff', 'icons/kanton-glarus.svg', 10)
on conflict (id) do nothing;

-- Vorschläge für Glarus (confirmed = false): in der Verwaltung unter «Kantone» bestätigen oder entfernen.
-- Fehlt ein Eintrag (umbenannt, gelöscht), wird er übersprungen. Bestehende Zuordnungen bleiben unverändert.
insert into public.entry_regions (entry_id, region_id, note, confirmed)
select e.id, 'glarus', v.note, false
  from (values
  ('baeume', 'Fichte (Rottanne)', ''),
  ('baeume', 'Buche', ''),
  ('baeume', 'Weisstanne', ''),
  ('baeume', 'Lärche', ''),
  ('baeume', 'Bergahorn', ''),
  ('baeume', 'Esche', ''),
  ('baeume', 'Vogelbeere', ''),
  ('baeume', 'Eibe', ''),
  ('straeucher', 'Hasel', ''),
  ('straeucher', 'Schwarzer Holunder', ''),
  ('straeucher', 'Grünerle', ''),
  ('straeucher', 'Heidelbeere', ''),
  ('straeucher', 'Seidelbast', ''),
  ('alpenblumen', 'Edelweiss', ''),
  ('alpenblumen', 'Stängelloser Enzian', ''),
  ('alpenblumen', 'Frühlings-Enzian', ''),
  ('alpenblumen', 'Alpenrose', ''),
  ('alpenblumen', 'Türkenbund', ''),
  ('alpenblumen', 'Silberwurz', ''),
  ('alpenblumen', 'Trollblume', ''),
  ('alpenblumen', 'Alpen-Anemone', ''),
  ('alpenblumen', 'Alpenglöckchen', ''),
  ('alpenblumen', 'Gelber Enzian', ''),
  ('alpenblumen', 'Blauer Eisenhut', ''),
  ('alpenblumen', 'Silberdistel', ''),
  ('wiesenblumen', 'Margerite', ''),
  ('wiesenblumen', 'Löwenzahn', ''),
  ('wiesenblumen', 'Rot-Klee', ''),
  ('wiesenblumen', 'Herbstzeitlose', ''),
  ('graeser', 'Blaugras', ''),
  ('graeser', 'Borstgras', ''),
  ('pilze', 'Steinpilz', ''),
  ('pilze', 'Eierschwamm', ''),
  ('pilze', 'Fliegenpilz', ''),
  ('saeugetiere', 'Gämse', 'Im Freiberg Kärpf, dem ältesten Wildschutzgebiet Europas (seit 1548), leben viele Gämsen.'),
  ('saeugetiere', 'Alpensteinbock', 'Lebt heute wieder in den Glarner Alpen.'),
  ('saeugetiere', 'Rothirsch', ''),
  ('saeugetiere', 'Reh', ''),
  ('saeugetiere', 'Murmeltier', ''),
  ('saeugetiere', 'Schneehase', ''),
  ('saeugetiere', 'Hermelin', ''),
  ('saeugetiere', 'Rotfuchs', ''),
  ('saeugetiere', 'Wolf', ''),
  ('voegel', 'Steinadler', ''),
  ('voegel', 'Bartgeier', ''),
  ('voegel', 'Alpendohle', ''),
  ('voegel', 'Alpenschneehuhn', ''),
  ('voegel', 'Tannenhäher', ''),
  ('reptilien', 'Kreuzotter', ''),
  ('reptilien', 'Waldeidechse', ''),
  ('reptilien', 'Blindschleiche', ''),
  ('amphibien', 'Alpensalamander', ''),
  ('amphibien', 'Grasfrosch', ''),
  ('amphibien', 'Bergmolch', ''),
  ('amphibien', 'Erdkröte', ''),
  ('fische', 'Bachforelle', ''),
  ('fische', 'Seesaibling', ''),
  ('fische', 'Felchen', ''),
  ('nutztiere', 'Braunvieh', 'Typische Rinderrasse auf den Glarner Alpweiden.'),
  ('steine', 'Verrucano', 'Bei der Glarner Hauptüberschiebung liegt der alte Verrucano über jüngerem Gestein, gut sichtbar an den Tschingelhörnern.'),
  ('steine', 'Flysch', 'Liegt bei der Glarner Hauptüberschiebung unter dem viel älteren Verrucano.'),
  ('steine', 'Schiefer', 'Im Landesplattenberg in Engi wurde jahrhundertelang Glarner Schiefer abgebaut.'),
  ('steine', 'Kalkstein', ''),
  ('berge', 'Tödi', 'Höchster Gipfel des Kantons, an der Grenze zu Graubünden; an seinem Fuss entspringt die Linth.'),
  ('gewaesser', 'Walensee', 'Das Ufer bei Mühlehorn und unterhalb des Kerenzerbergs gehört zum Kanton Glarus.'),
  ('naturwunder', 'Martinsloch', 'Über Elm, in der Tektonikarena Sardona (UNESCO-Welterbe).'),
  ('wetterphaenomene', 'Föhn', 'Weht oft kräftig durchs Linthtal. 1861 fachte er den Brand an, der grosse Teile der Stadt Glarus zerstörte.'),
  ('wetterphaenomene', 'Alpenglühen', '')
  ) as v(cat, name, note)
  join public.entries e on e.category_id = v.cat and e.name = v.name
on conflict (entry_id, region_id) do nothing;

update public.app_meta set schema_version = 22, updated_at = now();

commit;

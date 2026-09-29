-- Natur und Schweiz: Datenbankschema für Supabase
-- Einmal im Supabase-Dashboard unter «SQL Editor» ausführen.
-- Das Skript lässt sich gefahrlos mehrmals ausführen.

-- ------------------------------------------------------------------
-- Admins: nur Benutzer in dieser Tabelle dürfen Inhalte ändern
-- ------------------------------------------------------------------
create table if not exists public.admins (
  user_id uuid primary key references auth.users on delete cascade
);
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  -- nur mit bestätigtem zweitem Faktor (aal2), siehe 004_mfa.sql
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
     and exists (select 1 from public.admins where user_id = auth.uid());
$$;

drop policy if exists "admins_selbst_lesen" on public.admins;
create policy "admins_selbst_lesen" on public.admins
  for select to authenticated using (user_id = auth.uid());

-- ------------------------------------------------------------------
-- Tabellen
-- ------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.categories (
  id             text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name           text not null,
  description    text not null default '',
  latin          boolean not null default false,        -- Untertitel = lateinischer Name (kursiv)
  labels         text[] not null default array['Bild 1','Bild 2','Bild 3','Bild 4']
                 check (cardinality(labels) = 4),       -- Beschriftungen der 4 Bilder
  cover_entry_id uuid,                                  -- Eintrag, dessen Hauptbild die Kachel zeigt
  visible        boolean not null default true,         -- false = auf der Seite ausgeblendet
  sort           integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.entries (
  id           uuid primary key default gen_random_uuid(),
  category_id  text not null references public.categories (id) on update cascade on delete cascade,
  name         text not null,
  subtitle     text not null default '',               -- lateinischer Name, Ort oder Gesteinsart
  description  text not null default '',
  facts        jsonb not null default '[]'::jsonb,     -- Steckbrief: [{"k":"Höhe","v":"bis 50 m"}, …] (Reihenfolge bleibt erhalten)
  search_terms text[] not null default '{}',           -- Suchbegriffe für den Online-Fallback der Bilder 2–4
  wp           text,                                   -- Titel des englischen Wikipedia-Artikels (Fallback Hauptbild)
  labels       text[] check (labels is null or cardinality(labels) = 4),  -- eigene Bildbeschriftungen
  visible      boolean not null default true,          -- false = auf der Seite ausgeblendet
  -- bewusst leere Bildplätze, die «Fehlende Bilder übernehmen» nicht füllt (013_leere_plaetze.sql)
  empty_slots  smallint[] not null default '{}' constraint entries_empty_slots_1_4 check (empty_slots <@ array[1,2,3,4]::smallint[]),
  -- «Nicht verwechseln mit …»: [{name, diff}] (014_verwechslung_tierstimmen.sql)
  confusions   jsonb not null default '[]'::jsonb,
  -- Tierstimme (MP3 im Bucket «bilder») mit Quelle wie bei den Bildern (014)
  sound_path   text,
  sound_page   text constraint entries_sound_page_http check (sound_page is null or sound_page ~* '^https?://'),
  sound_file   text,
  sort         integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists entries_category_idx on public.entries (category_id, sort);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'categories_cover_fk') then
    alter table public.categories add constraint categories_cover_fk
      foreign key (cover_entry_id) references public.entries (id) on delete set null;
  end if;
end $$;

create table if not exists public.images (
  entry_id     uuid not null references public.entries (id) on delete cascade,
  position     smallint not null check (position between 1 and 4),  -- 1 = Hauptbild
  storage_path text not null,                                        -- Pfad im Bucket «bilder»
  source_page  text constraint images_source_page_http
               check (source_page is null or source_page ~* '^https?://'),  -- Commons-Dateiseite (Knopf «Quelle»)
  source_file  text,                                                 -- Originaldateiname
  -- Ausschnitt in den 4:3-Kacheln (010_bildausschnitt.sql): Punkt in %, Vergrösserung; null = Mitte, 1
  thumb_x      real constraint images_thumb_x check (thumb_x between 0 and 100),
  thumb_y      real constraint images_thumb_y check (thumb_y between 0 and 100),
  thumb_zoom   real constraint images_thumb_zoom check (thumb_zoom between 1 and 4),
  edited       boolean not null default false,                      -- zugeschnitten (Hinweis im Bildnachweis, 011)
  updated_at  timestamptz not null default now(),
  primary key (entry_id, position)
);

drop trigger if exists categories_updated_at on public.categories;
create trigger categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();
drop trigger if exists entries_updated_at on public.entries;
create trigger entries_updated_at before update on public.entries
  for each row execute function public.set_updated_at();
drop trigger if exists images_updated_at on public.images;
create trigger images_updated_at before update on public.images
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------------
-- Zugriffsregeln: alle lesen, nur Admins schreiben
-- ------------------------------------------------------------------
grant select on public.categories, public.entries, public.images to anon, authenticated;
grant insert, update, delete on public.categories, public.entries, public.images to authenticated;
grant select on public.admins to authenticated;

do $$
declare t text;
begin
  foreach t in array array['categories','entries','images'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "lesen" on public.%I', t);
    execute format('create policy "lesen" on public.%I for select to anon, authenticated using (true)', t);
    execute format('drop policy if exists "admin_schreiben" on public.%I', t);
    execute format('create policy "admin_schreiben" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- Ausgeblendete Kategorien und Einträge sieht nur ein Admin
alter table public.categories add column if not exists visible boolean not null default true;
alter table public.entries    add column if not exists visible boolean not null default true;
drop policy if exists "lesen" on public.categories;
create policy "lesen" on public.categories for select to anon, authenticated using (visible or public.is_admin());
drop policy if exists "lesen" on public.entries;
create policy "lesen" on public.entries for select to anon, authenticated using (visible or public.is_admin());

-- ------------------------------------------------------------------
-- Storage: öffentlicher Bucket «bilder», nur Admins laden hoch
-- ------------------------------------------------------------------
-- Nur JPEG (Bilder) und MP3 (Tierstimmen, 014), höchstens 5 MB pro Datei (der Admin verkleinert Bilder auf 1600 px)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bilder', 'bilder', true, 5242880, array['image/jpeg', 'audio/mpeg'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "bilder_admin_insert" on storage.objects;
create policy "bilder_admin_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'bilder' and public.is_admin());
drop policy if exists "bilder_admin_update" on storage.objects;
create policy "bilder_admin_update" on storage.objects
  for update to authenticated using (bucket_id = 'bilder' and public.is_admin());
drop policy if exists "bilder_admin_delete" on storage.objects;
create policy "bilder_admin_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'bilder' and public.is_admin());
drop policy if exists "bilder_admin_select" on storage.objects;
create policy "bilder_admin_select" on storage.objects
  for select to authenticated using (bucket_id = 'bilder' and public.is_admin());

-- ------------------------------------------------------------------
-- Versionierung (015): Schema-Version der Datenbank = Nummer der letzten SQL-Datei.
-- Jede neue SQL-Datei setzt am Schluss: update public.app_meta set schema_version = <Nummer>, updated_at = now();
-- ------------------------------------------------------------------
create table if not exists public.app_meta (
  id int primary key default 1 check (id = 1),
  schema_version int not null,
  updated_at timestamptz not null default now()
);
alter table public.app_meta enable row level security;
drop policy if exists "lesen" on public.app_meta;
create policy "lesen" on public.app_meta for select to anon, authenticated using (true);
grant select on public.app_meta to anon, authenticated;
insert into public.app_meta (id, schema_version) values (1, 16)
  on conflict (id) do update set schema_version = excluded.schema_version, updated_at = now();

-- ------------------------------------------------------------------
-- Bildmeldungen (016): «Melden» in der Grossansicht, Liste «Gemeldete Bilder» in der Verwaltung.
-- Schreiben nur über report_image() (auch ohne Anmeldung), lesen und löschen nur Admins.
-- ------------------------------------------------------------------
create table if not exists public.image_reports (
  id           bigint generated always as identity primary key,
  entry_id     uuid not null references public.entries (id) on delete cascade,
  position     smallint not null check (position between 1 and 4),
  storage_path text,                                                   -- gemeldetes Bild; null = Online-Ersatz
  reason       text not null default '' check (char_length(reason) <= 300),
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
-- Melden: prüft Eintrag und Bildnummer, höchstens 500 offene Meldungen; gleiche Datei am selben Platz zählt hoch
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

-- ------------------------------------------------------------------
-- Danach: dein Konto zum Admin machen (E-Mail anpassen)
--   1. Authentication → Users → «Add user» (E-Mail + Passwort, «Auto Confirm»)
--   2. insert into public.admins (user_id)
--        select id from auth.users where email = 'DEINE@EMAIL.CH';
-- Empfohlen: Authentication → Sign In / Providers → «Allow new users to sign up» ausschalten.
-- ------------------------------------------------------------------

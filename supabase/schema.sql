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
  updated_at   timestamptz not null default now(),
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
-- Nur JPEG, höchstens 5 MB pro Datei (der Admin verkleinert auf 1600 px)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bilder', 'bilder', true, 5242880, array['image/jpeg'])
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
-- Danach: dein Konto zum Admin machen (E-Mail anpassen)
--   1. Authentication → Users → «Add user» (E-Mail + Passwort, «Auto Confirm»)
--   2. insert into public.admins (user_id)
--        select id from auth.users where email = 'DEINE@EMAIL.CH';
-- Empfohlen: Authentication → Sign In / Providers → «Allow new users to sign up» ausschalten.
-- ------------------------------------------------------------------

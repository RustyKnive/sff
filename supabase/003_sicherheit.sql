-- Sicherheit: Quellen-Links und Bild-Uploads einschränken
-- Einmal im Supabase-Dashboard unter «SQL Editor» ausführen (nach 002_sichtbar.sql).

-- Quelle nur als http(s)-Adresse (kein «javascript:»-Link unter «Quelle»)
alter table public.images drop constraint if exists images_source_page_http;
alter table public.images add constraint images_source_page_http
  check (source_page is null or source_page ~* '^https?://');

-- Bucket «bilder»: nur JPEG, höchstens 5 MB pro Datei (der Admin verkleinert auf 1600 px)
update storage.buckets
   set file_size_limit = 5242880, allowed_mime_types = array['image/jpeg']
 where id = 'bilder';

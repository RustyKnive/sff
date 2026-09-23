-- Zwei-Faktor-Anmeldung für Admins erzwingen
-- Einmal im Supabase-Dashboard unter «SQL Editor» ausführen (nach 003_sicherheit.sql).
-- Admin-Rechte gibt es nur noch mit bestätigtem zweitem Faktor (aal2). Mit Passwort allein
-- ist man zwar angemeldet, darf aber nichts ändern und sieht keine ausgeblendeten Inhalte.

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
     and exists (select 1 from public.admins where user_id = auth.uid());
$$;

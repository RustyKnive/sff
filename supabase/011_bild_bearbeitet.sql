-- Bearbeitete Bilder kennzeichnen: CC BY / CC BY-SA 4.0 verlangen einen Hinweis, wenn ein Bild verändert wurde.
-- «Zuschneiden» in der Verwaltung setzt edited = true, der Bildnachweis zeigt dann «(zugeschnitten)».
-- Einmal im Supabase-Dashboard unter «SQL Editor» ausführen, BEVOR die neue index.js online ist
-- (die Anzeige fragt die Spalte ab). Lässt sich gefahrlos mehrmals ausführen.

alter table public.images add column if not exists edited boolean not null default false;

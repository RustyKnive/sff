-- Ausschnitt der Vorschau: welcher Teil eines Bildes in den 4:3-Kacheln (Karte, Übersicht) zu sehen ist.
-- Einmal im Supabase-Dashboard unter «SQL Editor» ausführen, BEVOR die neue index.js online ist
-- (die Anzeige fragt die Spalten ab). Lässt sich gefahrlos mehrmals ausführen.
-- thumb_x/thumb_y: Punkt im Bild in Prozent (wie CSS object-position), thumb_zoom: Vergrösserung 1–4.
-- null = Standard (Mitte, nicht vergrössert). Die Lightbox zeigt immer das ganze Bild.

alter table public.images
  add column if not exists thumb_x    real constraint images_thumb_x    check (thumb_x between 0 and 100),
  add column if not exists thumb_y    real constraint images_thumb_y    check (thumb_y between 0 and 100),
  add column if not exists thumb_zoom real constraint images_thumb_zoom check (thumb_zoom between 1 and 4);

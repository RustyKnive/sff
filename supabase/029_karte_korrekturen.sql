-- Entdeckungskarte (Version 2.23.0): Korrekturen zu den Koordinaten aus 028.
-- Abgeglichen mit der Ortssuche von swisstopo (api3.geo.admin.ch, Namen aus dem Landeskartenwerk). Geändert wird nur,
-- wer noch genau auf dem Vorschlag aus 028 steht; in der Verwaltung bereits angepasste Orte bleiben.
-- Noch nicht bestätigt (in der Ortssuche nicht gefunden): Berglistüber und Bundesgericht (Park Mon-Repos), bitte in der Verwaltung prüfen.
-- Einmal im Supabase-Dashboard unter «SQL Editor» ausführen. Lässt sich gefahrlos mehrmals ausführen.

begin;

update public.entries e set lat = v.lat, lon = v.lon
from (values
  ('73804339-a284-4315-bd61-7d518cd0b25a'::uuid, 46.9265, 9.0730, 46.9144, 9.0897),  -- Kärpf (Massiv)
  ('9e778b17-0bb1-4c04-9286-69ddabdb75f5', 46.9255, 8.9020, 46.9254, 8.9482),  -- Ortstock (Gipfel)
  ('0013d2ef-1c54-4c53-951c-b0fe5c519c44', 46.8250, 8.9900, 46.8360, 9.0134),  -- Limmernsee (Limmerensee)
  ('d843f23b-2068-4889-b251-6e484f237950', 47.0855, 9.0160, 47.0867, 9.0143),  -- Obersee (Näfels)
  ('69b4f1c3-90c6-444b-a087-aa229b7b0f57', 46.4500, 8.0500, 46.4595, 8.0651),  -- Grosser Aletschgletscher
  ('476601ed-359b-4813-bc79-37c0aa45fa5b', 46.5970, 7.9050, 46.5896, 7.9051),  -- Staubbachfall
  ('4d3f8807-f824-4dda-8cb0-275b68bf988c', 46.9030, 9.1720, 46.8995, 9.2226),  -- Martinsloch (Felsloch über Elm)
  ('fcc45c57-c1e2-4ca2-8a74-06ca4e81c07b', 46.8150, 9.3200, 46.8059, 9.3201),  -- Ruinaulta
  ('b68f59a7-a8f0-4a3c-9914-b46617b62e5d', 46.9640, 8.7480, 46.9769, 8.7827),  -- Hölloch (Eingang, Haltestelle)
  ('7e39b0f7-8797-41cc-9fa3-0a0bec650112', 46.9570, 9.4920, 46.9813, 9.4884),  -- Taminaschlucht
  ('a7423eb3-639b-4c5c-b82e-38590de50bb8', 46.9900, 9.0730, 46.9967, 9.0917),  -- Lochsite (Flurname Lochsiten)
  ('86195e00-50ff-45ba-a7ca-344247cf2282', 47.2690, 9.3990, 47.2684, 9.4008),  -- Seealpsee
  ('33ebabad-982e-44cf-a3e6-2e7472ace869', 46.7210, 8.2150, 46.7177, 8.2139),  -- Aareschlucht
  ('5e4569c8-05db-4580-bd88-b6186ba0f718', 46.9730, 9.1530, 46.9697, 9.1570),  -- Landesplattenberg Engi
  ('4c9ba5ff-5daf-4e6e-90f9-8cd5ca29b19e', 46.8710, 8.9890, 46.8689, 8.9819),  -- Pantenbrücke (Pantenbrugg)
  ('4af763f4-47e6-4c00-874d-ebc845fe3ef3', 47.1150, 9.0850, 47.1047, 9.0726),  -- Escherkanal
  ('9e61c57e-4ea8-4bf4-b075-92179b43e1ef', 47.1000, 9.0640, 47.0991, 9.0640),  -- Freulerpalast
  ('1384bee3-8031-4108-a75e-933971559493', 46.8810, 8.6440, 46.8818, 8.6439),  -- Wilhelm Tell (Telldenkmal)
  ('6ce58a77-b1a8-43e4-9762-4090edcedbad', 47.1030, 8.6260, 47.1069, 8.6425),  -- Schlacht am Morgarten (Denkmal)
  ('317a87dc-bad9-4d0c-a75b-aacb1debee58', 47.1450, 8.2050, 47.1456, 8.2133),  -- Schlacht bei Sempach (Denkmal)
  ('c3cd81b9-bfc1-4ae0-9abc-22d1a4bfde4d', 47.0960, 9.0610, 47.1012, 9.0663),  -- Schlacht bei Näfels (Schlachtdenkmal)
  ('8f0d135b-1fef-452a-b5b0-02b76d7c4b98', 47.0410, 9.0670, 47.0389, 9.0676),  -- Landsgemeinde (Zaunplatz)
  ('d21880e8-e02f-4bea-ad99-0fa1a6be9f79', 47.0403, 9.0688, 47.0401, 9.0683),  -- Landrat Glarus (Rathaus)
  ('4beff925-7b55-4d8c-bd3d-44e87f784781', 46.5260, 6.6370, 46.5183, 6.6433)   -- Bundesgericht (Mon-Repos, Lausanne)
) as v(id, old_lat, old_lon, lat, lon)
where e.id = v.id and e.lat = v.old_lat and e.lon = v.old_lon;

update public.app_meta set schema_version = 29, updated_at = now();

commit;

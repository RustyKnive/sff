-- Entdeckungskarte (Version 2.23.0):
--   entries.lat / entries.lon: Ort eines Eintrags in Grad (WGS84, wie map.geo.admin.ch oder Google Maps), beide leer = nicht auf der Karte
--   Vorschläge für 85 Einträge mit festem Ort (Berge, Seen, Naturwunder, Sehenswürdigkeiten, Orte aus Geschichte und Politik).
--   Flüsse, Spezialitäten, Tiere und Pflanzen haben keinen festen Punkt und bleiben ohne Ort.
--   Die Koordinaten sind Vorschläge von Claude: in der Verwaltung im Eintrag mit «Auf der Karte prüfen» kontrollieren.
-- Einmal im Supabase-Dashboard unter «SQL Editor» ausführen, BEVOR die neue index.js online ist.
-- Lässt sich gefahrlos mehrmals ausführen.

begin;

alter table public.entries add column if not exists lat double precision;
alter table public.entries add column if not exists lon double precision;
alter table public.entries drop constraint if exists entries_geo_check;
alter table public.entries add constraint entries_geo_check check (
  (lat is null and lon is null)
  or (lat between 45.0 and 48.5 and lon between 5.0 and 11.5));

update public.entries e set lat = v.lat, lon = v.lon
from (values
  -- Berge
  ('369c7da7-857a-4a7f-aad1-dba7c863066c'::uuid, 46.8114, 8.9150),  -- Tödi
  ('e37dcf4f-0059-4d3c-b72f-8a6b5603d314', 45.9369, 7.8668),  -- Dufourspitze
  ('583ccb0f-b16f-4d7e-9345-c2f19b38d009', 46.0939, 7.8586),  -- Dom
  ('a9816723-bc8f-4733-ac7a-3a059dd9b517', 46.1014, 7.7161),  -- Weisshorn
  ('823120e9-b598-4362-9d18-1db46e6c2e16', 46.5776, 8.0053),  -- Eiger
  ('a5687857-f754-416f-9fa5-12394f4df2a1', 46.5372, 8.1261),  -- Finsteraarhorn
  ('fb805d5b-4072-462b-8313-b588477d6269', 46.3826, 9.9078),  -- Piz Bernina
  ('9666c1a9-8303-4a89-a0d8-26a036907724', 46.7720, 8.4252),  -- Titlis
  ('638eb160-68cd-422a-a670-ebcddc9feaa1', 47.2494, 9.3433),  -- Säntis
  ('63362dfa-2306-4545-9ad7-e553cc991879', 46.9786, 8.2554),  -- Pilatus
  ('34f1028a-a30f-422e-98d5-15909eb979da', 47.0565, 8.4851),  -- Rigi
  ('2770d4b7-1ec3-4c6b-bdc1-3e0497941569', 47.0309, 8.6869),  -- Grosser Mythen
  ('22241738-f17c-46e7-8e07-b55db6da0945', 46.6450, 7.6522),  -- Niesen
  ('536bda00-5c94-4239-89a6-419688c4e90f', 47.1328, 7.0590),  -- Chasseral
  ('620fdd12-cc5d-4d0c-85f8-d05dc1184fd4', 45.9311, 9.0197),  -- Monte Generoso
  ('67f33767-cd1a-4b8b-be2e-d9ec032cead5', 45.9763, 7.6586),  -- Matterhorn
  ('a46c708b-f507-4f6b-8362-92f032fbb973', 47.0000, 8.9950),  -- Glärnisch
  ('327dcd01-6b91-419b-9c08-843918d860b4', 46.8720, 9.0610),  -- Hausstock
  ('73804339-a284-4315-bd61-7d518cd0b25a', 46.9265, 9.0730),  -- Kärpf
  ('9e778b17-0bb1-4c04-9286-69ddabdb75f5', 46.9255, 8.9020),  -- Ortstock
  -- Seen
  ('d810085b-a3ad-4e01-bbca-7323c55b9899', 46.4500, 6.5500),  -- Genfersee
  ('3b807a52-cfb6-4a14-a59f-f7079c32271f', 47.6300, 9.3700),  -- Bodensee
  ('416b03cf-29b2-4c18-a10f-97df3761bb96', 46.9900, 8.4800),  -- Vierwaldstättersee
  ('7d74b15d-9aef-4589-8c8e-21f3f9f77728', 47.2500, 8.6500),  -- Zürichsee
  ('5ab7d1bd-4820-4171-8433-fbc10fa0e648', 46.9000, 6.8500),  -- Neuenburgersee
  ('3b2d2ad5-c47c-4cf3-abf6-27c3fe6c306f', 46.1500, 8.8000),  -- Lago Maggiore
  ('05a5cc51-e6f4-42c6-9c83-b44797b9789a', 47.1230, 9.2000),  -- Walensee
  ('7a698cc0-9df8-45b4-bfcf-1a7203016d71', 46.4250, 9.7300),  -- Silsersee
  ('05ea3200-3831-49ba-bafc-3d67c28b804f', 46.6900, 7.7300),  -- Thunersee
  ('dd171d77-322e-4d5f-a269-0b6f7d1ff95c', 47.0270, 8.9800),  -- Klöntalersee
  ('0013d2ef-1c54-4c53-951c-b0fe5c519c44', 46.8250, 8.9900),  -- Limmernsee
  ('d843f23b-2068-4889-b251-6e484f237950', 47.0855, 9.0160),  -- Obersee (Näfels)
  -- Naturwunder
  ('7abc1505-fcab-4793-86b4-89d9965ad778', 47.6779, 8.6155),  -- Rheinfall
  ('69b4f1c3-90c6-444b-a087-aa229b7b0f57', 46.4500, 8.0500),  -- Grosser Aletschgletscher
  ('5793857d-f309-41c2-b73d-81d2a13364cb', 46.4985, 7.7270),  -- Oeschinensee
  ('f0cd1880-f232-42a5-9723-af5d99408309', 46.9330, 6.7270),  -- Creux du Van
  ('476601ed-359b-4813-bc79-37c0aa45fa5b', 46.5970, 7.9050),  -- Staubbachfall
  ('4d3f8807-f824-4dda-8cb0-275b68bf988c', 46.9030, 9.1720),  -- Martinsloch
  ('90d23324-2b22-43a0-9477-90c8619cdd80', 46.5680, 7.9120),  -- Trümmelbachfälle
  ('33ebabad-982e-44cf-a3e6-2e7472ace869', 46.7210, 8.2150),  -- Aareschlucht
  ('943b3220-1f0b-416e-a176-0c7b76a823f6', 46.6000, 8.3900),  -- Rhonegletscher
  ('e1da8f07-d5e4-45e7-9dcd-819d8789109f', 46.6650, 9.4430),  -- Viamala-Schlucht
  ('fcc45c57-c1e2-4ca2-8a74-06ca4e81c07b', 46.8150, 9.3200),  -- Ruinaulta
  ('b68f59a7-a8f0-4a3c-9914-b46617b62e5d', 46.9640, 8.7480),  -- Hölloch
  ('cb12231a-7678-4edd-94c6-d2f306f6db29', 46.7380, 8.0200),  -- Giessbachfälle
  ('86195e00-50ff-45ba-a7ca-344247cf2282', 47.2690, 9.3990),  -- Seealpsee
  ('247122d3-73fe-42d2-b1ad-5edddf0bcf1e', 46.4300, 9.9330),  -- Morteratschgletscher
  ('7e39b0f7-8797-41cc-9fa3-0a0bec650112', 46.9570, 9.4920),  -- Taminaschlucht
  ('a7423eb3-639b-4c5c-b82e-38590de50bb8', 46.9900, 9.0730),  -- Lochsite
  ('eae051c2-090c-4797-8dc6-4d3cfd9b0abf', 46.9190, 8.9960),  -- Berglistüber
  -- Sehenswürdigkeiten
  ('c913fdff-a844-408e-b446-0338f5dd7700', 47.0517, 8.3075),  -- Kapellbrücke
  ('6e6a7d97-0f97-4127-9a45-5c3e8ff6a2a4', 46.4142, 6.9273),  -- Schloss Chillon
  ('531cc741-11c1-49ed-a524-a60a0a99ea6a', 46.9480, 7.4475),  -- Zytglogge
  ('83c686f1-a1dd-408f-b5fe-78b5ce96c469', 46.6806, 9.6755),  -- Landwasserviadukt
  ('54db7c2f-5bab-442f-ae1e-f62a0ae62829', 46.4920, 6.7400),  -- Lavaux
  ('a206fcbc-1d2a-43a6-9ad4-59d50b6c69cf', 46.5475, 7.9853),  -- Jungfraujoch
  ('de2eeaa3-b523-4982-bbe6-fd1ace5e2ff1', 47.4233, 9.3770),  -- Stiftsbezirk St. Gallen
  ('06a9f8c5-c106-431b-b770-b0743cf154a2', 46.1930, 9.0200),  -- Burgen von Bellinzona
  ('25b652d4-5954-4281-9595-b172f75c6dba', 46.2073, 6.1559),  -- Jet d'eau
  ('cbce71bb-808e-491f-bf6e-d83519be9925', 46.9466, 7.4440),  -- Bundeshaus
  ('d50825f4-3d81-4f40-9f80-6051529eb6f4', 47.3700, 8.5440),  -- Grossmünster
  ('525f3029-d6bb-4e5e-b83b-21b90f77627c', 47.1270, 8.7520),  -- Kloster Einsiedeln
  ('db6d00f5-41de-4bed-9770-47676e48a8e1', 46.9690, 8.5930),  -- Rütli
  ('e58cdb1d-53cc-4097-afb6-cdbb0fed6882', 46.5880, 7.0820),  -- Schloss Greyerz
  ('54a4bba2-5831-4fd4-96c2-6541a6b45f8f', 47.6970, 8.6380),  -- Munot
  ('e5fb3091-677e-46e6-8102-51d3b3d74eca', 46.6290, 10.4480), -- Kloster St. Johann, Müstair
  ('9e61c57e-4ea8-4bf4-b075-92179b43e1ef', 47.1000, 9.0640),  -- Freulerpalast
  ('5e4569c8-05db-4580-bd88-b6186ba0f718', 46.9730, 9.1530),  -- Landesplattenberg Engi
  ('4c9ba5ff-5daf-4e6e-90f9-8cd5ca29b19e', 46.8710, 8.9890),  -- Pantenbrücke
  ('4af763f4-47e6-4c00-874d-ebc845fe3ef3', 47.1150, 9.0850),  -- Escherkanal
  ('7dbface4-69a7-4383-ab37-3d42aa20b4f6', 46.9420, 8.9980),  -- Braunwald
  -- Geschichte (Ort des Ereignisses bzw. Denkmal, Museum)
  ('30a1c996-75ed-41eb-95e0-c19850d0a1e5', 47.0220, 8.6540),  -- Bundesbrief 1291 (Bundesbriefmuseum Schwyz)
  ('1384bee3-8031-4108-a75e-933971559493', 46.8810, 8.6440),  -- Wilhelm Tell (Telldenkmal Altdorf)
  ('6ce58a77-b1a8-43e4-9762-4090edcedbad', 47.1030, 8.6260),  -- Schlacht am Morgarten
  ('317a87dc-bad9-4d0c-a75b-aacb1debee58', 47.1450, 8.2050),  -- Schlacht bei Sempach
  ('c3cd81b9-bfc1-4ae0-9abc-22d1a4bfde4d', 47.0960, 9.0610),  -- Schlacht bei Näfels
  ('7a29b15d-0477-47a0-85dd-febe479182b8', 47.3712, 8.5434),  -- Huldrych Zwingli (Grossmünster)
  ('056f8a22-8c39-49a0-93f7-51c0eefc9249', 46.2040, 6.1430),  -- Henri Dunant (Genf)
  ('ad8e81a8-9275-4ecb-b257-e5cfdc79acba', 46.6660, 8.5860),  -- Gotthardtunnel (Nordportal Göschenen)
  ('00430ef2-969e-449e-ada6-d1d6742d0d2c', 47.0400, 9.0680),  -- Brand von Glarus
  ('b39bdf78-8882-4041-8c39-0ceb3c54d21d', 46.9170, 9.1720),  -- Bergsturz von Elm
  ('6e749eba-33b0-4df9-a291-4a96bfa982d1', 46.9686, 8.5924),  -- Rütlirapport 1940
  -- Politik
  ('4beff925-7b55-4d8c-bd3d-44e87f784781', 46.5260, 6.6370),  -- Bundesgericht (Lausanne)
  ('8f0d135b-1fef-452a-b5b0-02b76d7c4b98', 47.0410, 9.0670),  -- Landsgemeinde (Zaunplatz Glarus)
  ('d21880e8-e02f-4bea-ad99-0fa1a6be9f79', 47.0403, 9.0688)   -- Landrat Glarus (Rathaus)
) as v(id, lat, lon)
where e.id = v.id and e.lat is null;

update public.app_meta set schema_version = 28, updated_at = now();

commit;

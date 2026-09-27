-- Daten: jede Kategorie mit 16 sichtbaren Einträgen (2 volle A4-Seiten im PDF, doppelseitig ohne leeres Feld).
--   - 14 Kategorien bekommen einen typischen Schweizer Vertreter dazu, die Nutztiere vier.
--   - Neue Kategorie «Naturwunder»: die Naturorte aus «Sehenswürdigkeiten» ziehen um, dazu 10 neue.
--     «Sehenswürdigkeiten» enthält danach Bauwerke und Orte, dazu 7 neue.
--   - Hunde: Untertitel sind keine lateinischen Namen (latin = false), drei Untertitel ergänzt.
-- Einmal im Supabase-Dashboard unter «SQL Editor» ausführen (nach 011_bild_bearbeitet.sql).
-- Lässt sich gefahrlos mehrmals ausführen: Doppelte werden übersprungen.
-- Bilder danach in der Verwaltung (Übersicht) mit «Fehlende Bilder von Wikimedia übernehmen» holen.

begin;

-- ---------------------------------------------------------------- Kategorien
insert into public.categories (id, name, description, latin, labels, sort) values
  ('naturwunder', 'Naturwunder', 'Wasserfälle, Schluchten, Gletscher und Felsen', false,
   array['Ansicht','Detail','Umgebung','Stimmung'], 19)
on conflict (id) do nothing;

update public.categories set description = 'Berühmte Bauwerke und Orte der Schweiz'
 where id = 'sehenswuerdigkeiten';

-- Naturorte aus den Sehenswürdigkeiten verschieben (mit ihren Bildern)
update public.entries set category_id = 'naturwunder'
 where category_id = 'sehenswuerdigkeiten'
   and name in ('Rheinfall', 'Grosser Aletschgletscher', 'Oeschinensee', 'Creux du Van', 'Staubbachfall', 'Martinsloch');

-- Titelbilder: Naturwunder = Rheinfall; zeigt eine Kachel auf einen Eintrag einer anderen Kategorie, zurücksetzen
update public.categories set cover_entry_id =
  (select id from public.entries where category_id = 'naturwunder' and name = 'Rheinfall')
 where id = 'naturwunder' and cover_entry_id is null;
update public.categories c set cover_entry_id = null
 where cover_entry_id is not null
   and not exists (select 1 from public.entries e where e.id = c.cover_entry_id and e.category_id = c.id);

-- Hunde: Untertitel sind Gruppe und Herkunft, keine lateinischen Namen
update public.categories set latin = false where id = 'hunde';
update public.entries set subtitle = s.sub
from (values ('Bernhardiner', 'Rettungshund, Wallis'),
             ('Berner Sennenhund', 'Sennenhund, Kanton Bern'),
             ('Appenzeller Sennenhund', 'Sennenhund, Appenzellerland')) as s(name, sub)
where entries.category_id = 'hunde' and entries.name = s.name and entries.subtitle = 'Hund';

-- ---------------------------------------------------------------- Neue Einträge
create temporary table neu (cat text, nr int, name text, sub text, descr text, facts text, terms text[], wp text) on commit drop;
insert into neu values

-- Sträucher (Strauch, Blätter, Blüten, Früchte)
('straeucher', 1, 'Brombeere', 'Rubus fruticosus',
 'Die Brombeere wächst an Waldrändern, in Hecken und auf Brachflächen und bildet oft dichte, stachlige Gestrüppe. Ihre Ranken werden mehrere Meter lang und schlagen an der Spitze neue Wurzeln, wenn sie den Boden berühren. Aus den weissen bis rosa Blüten entstehen die schwarzen Beeren, die im Spätsommer reifen. Sie sind bei Menschen, Vögeln und Füchsen beliebt.',
 '[{"k":"Höhe","v":"1–3 m, Ranken länger"},{"k":"Blütezeit","v":"Mai–August"},{"k":"Früchte","v":"schwarze Brombeeren (essbar)"},{"k":"Standort","v":"Waldränder, Hecken, Brachen"}]',
 array['Rubus fruticosus leaves','Rubus fruticosus flowers','Rubus fruticosus fruit'], null),

-- Alpenblumen (Pflanze, Blüte, Blätter, Lebensraum)
('alpenblumen', 1, 'Blauer Eisenhut', 'Aconitum napellus',
 'Der Blaue Eisenhut trägt dunkelblaue Blüten, deren oberes Blütenblatt wie ein Helm aussieht. Er wächst an feuchten, nährstoffreichen Stellen, zum Beispiel bei Alphütten und an Bachufern. Er gilt als giftigste Pflanze Europas: Sein Gift kann sogar über die Haut aufgenommen werden. Darum nie pflücken.',
 '[{"k":"Blütezeit","v":"Juni–August"},{"k":"Höhenlage","v":"bis über 2000 m"},{"k":"Standort","v":"Hochstaudenfluren, Bachufer, bei Alphütten"},{"k":"Achtung","v":"sehr stark giftig"}]',
 array['Aconitum napellus flower','Aconitum napellus leaves','Aconitum napellus alpine meadow'], null),

-- Wiesenblumen (Pflanze, Blüte, Blätter, Lebensraum)
('wiesenblumen', 1, 'Gänseblümchen', 'Bellis perennis',
 'Das Gänseblümchen blüht fast das ganze Jahr, sogar an milden Wintertagen. Es wächst in Rasen, auf Weiden und an Wegrändern und verträgt häufiges Mähen und Betreten. Wie bei der Margerite ist die «Blüte» ein Körbchen aus vielen kleinen Blüten. Nachts und bei Regen schliessen sich die Körbchen.',
 '[{"k":"Blütezeit","v":"März–November, oft fast ganzjährig"},{"k":"Höhe","v":"5–15 cm"},{"k":"Standort","v":"Rasen, Weiden, Wegränder"},{"k":"Merkmal","v":"Blätter als Rosette am Boden"}]',
 array['Bellis perennis flower','Bellis perennis leaves','Bellis perennis lawn'], null),

-- Gräser (Gras, Blütenstand, Ährchen, Lebensraum)
('graeser', 1, 'Wolliges Honiggras', 'Holcus lanatus',
 'Das Wollige Honiggras ist an seinen weich behaarten, graugrünen Blättern leicht zu erkennen. Seine Rispen sind weisslich bis rosa-violett überlaufen. Es wächst auf feuchten Wiesen, Weiden und an Waldrändern. Weil es so weich und behaart ist, frisst das Vieh es nicht besonders gern.',
 '[{"k":"Höhe","v":"30–100 cm"},{"k":"Blütezeit","v":"Juni–August"},{"k":"Standort","v":"feuchte Wiesen und Weiden"},{"k":"Merkmal","v":"ganze Pflanze weich behaart"}]',
 array['Holcus lanatus inflorescence','Holcus lanatus spikelets','Holcus lanatus meadow'], null),

-- Pilze (Pilz, Unterseite, Junger Pilz, Lebensraum)
('pilze', 1, 'Schopf-Tintling', 'Coprinus comatus',
 'Der Schopf-Tintling hat einen hohen, walzenförmigen weissen Hut mit abstehenden Schuppen. Er wächst oft in Gruppen auf Wiesen, an Wegrändern und in Parks. Jung ist er ein Speisepilz, doch schon nach kurzer Zeit zerfliesst er von unten her zu einer schwarzen, tintenartigen Flüssigkeit. Früher wurde diese Flüssigkeit tatsächlich als Tinte verwendet.',
 '[{"k":"Hut","v":"5–15 cm hoch, walzenförmig"},{"k":"Zeit","v":"Mai–November"},{"k":"Standort","v":"Wiesen, Wegränder, Parks"},{"k":"Speisewert","v":"nur jung essbar (Pilzkontrolle!)"}]',
 array['Coprinus comatus gills','Coprinus comatus young','Coprinus comatus meadow'], null),

-- Säugetiere (Tier, Porträt, Jungtier, Im Winter)
('saeugetiere', 1, 'Steinmarder', 'Martes foina',
 'Der Steinmarder lebt oft ganz in der Nähe des Menschen, in Scheunen, auf Dachböden und in Gärten. Er ist nachtaktiv, klettert sehr gut und frisst Mäuse, Vögel, Eier und Früchte. Bekannt ist er dafür, dass er in Motorräume von Autos kriecht und dort Kabel und Schläuche anbeisst. Vom Baummarder unterscheidet ihn der weisse, gegabelte Kehlfleck.',
 '[{"k":"Grösse","v":"Körper 40–50 cm, Schwanz ca. 25 cm"},{"k":"Gewicht","v":"1–2,5 kg"},{"k":"Nahrung","v":"Mäuse, Vögel, Eier, Früchte"},{"k":"Merkmal","v":"weisser, gegabelter Kehlfleck"}]',
 array['Martes foina portrait','Martes foina young','Martes foina snow'], null),

-- Vögel (Vogel, Porträt, Nest/Jungvogel, Lebensraum)
('voegel', 1, 'Mäusebussard', 'Buteo buteo',
 'Der Mäusebussard ist der häufigste Greifvogel der Schweiz. Man sieht ihn oft auf Zaunpfählen oder am Waldrand sitzen oder mit breiten Flügeln über Feldern kreisen. Er frisst vor allem Mäuse. Sein Gefieder ist sehr unterschiedlich gefärbt, von fast weiss bis dunkelbraun, und sein Ruf klingt wie ein miauendes «hiäh».',
 '[{"k":"Spannweite","v":"110–130 cm"},{"k":"Nahrung","v":"vor allem Mäuse"},{"k":"Nest","v":"Horst hoch in Bäumen"},{"k":"Lebensraum","v":"Waldränder und offenes Kulturland"}]',
 array['Buteo buteo portrait','Buteo buteo chicks nest','Buteo buteo flight'], null),

-- Reptilien (Tier, Nahaufnahme, Jungtier, Lebensraum)
('reptilien', 1, 'Rotwangen-Schmuckschildkröte', 'Trachemys scripta elegans',
 'Die Rotwangen-Schmuckschildkröte stammt aus Nordamerika und wurde früher oft als Haustier verkauft. Viele ausgesetzte Tiere leben heute in Weihern und Seen der Schweiz und sonnen sich auf Ästen und Steinen. Man erkennt sie am roten Fleck hinter dem Auge. Als eingeschleppte Art macht sie der seltenen einheimischen Sumpfschildkröte Futter und Sonnenplätze streitig, darum dürfen Haustiere nie ausgesetzt werden.',
 '[{"k":"Herkunft","v":"Nordamerika (eingeschleppt)"},{"k":"Panzerlänge","v":"20–30 cm"},{"k":"Merkmal","v":"roter Fleck hinter dem Auge"},{"k":"Lebensraum","v":"Weiher und Seen mit Sonnenplätzen"}]',
 array['Trachemys scripta elegans close-up','Trachemys scripta elegans hatchling','Trachemys scripta elegans basking pond'], null),

-- Amphibien (Tier, Nahaufnahme, Nachwuchs, Lebensraum)
('amphibien', 1, 'Kleiner Wasserfrosch', 'Pelophylax lessonae',
 'Der Kleine Wasserfrosch ist der kleinste der Wasserfrösche in der Schweiz. Er lebt in kleinen, pflanzenreichen Weihern und Mooren und sonnt sich gern am Ufer. Zusammen mit dem Seefrosch ist er ein Elternteil des Teichfroschs, der aus einer Kreuzung der beiden entstanden ist. Die Männchen quaken mit zwei weissen Schallblasen an den Mundwinkeln.',
 '[{"k":"Länge","v":"bis 8 cm"},{"k":"Aktiv","v":"April–Oktober"},{"k":"Lebensraum","v":"kleine, pflanzenreiche Weiher, Moore"},{"k":"Merkmal","v":"grün mit dunklen Flecken, weisse Schallblasen"}]',
 array['Pelophylax lessonae close-up','Pelophylax lessonae tadpole','Pelophylax lessonae pond'], null),

-- Fische (Fisch, Nahaufnahme, Unter Wasser, Lebensraum)
('fische', 1, 'Alet', 'Squalius cephalus',
 'Der Alet, auch Döbel genannt, ist einer der häufigsten Fische in Schweizer Flüssen und Seen. Er hat einen kräftigen, fast runden Körper, einen breiten Kopf und grosse, dunkel umrandete Schuppen. Der Alet frisst fast alles: Insekten, Schnecken, Pflanzen, kleine Fische und sogar Früchte, die ins Wasser fallen. Er verträgt wärmeres Wasser als die Forelle.',
 '[{"k":"Länge","v":"30–50 cm"},{"k":"Nahrung","v":"Allesfresser"},{"k":"Lebensraum","v":"Flüsse, Bäche und Seen"},{"k":"Merkmal","v":"dunkel umrandete Schuppen (Netzmuster)"}]',
 array['Squalius cephalus head','Squalius cephalus underwater','Squalius cephalus river'], null),

-- Insekten (Insekt, Nahaufnahme, Larve, Lebensraum)
('insekten', 1, 'Gemeine Wespe', 'Vespula vulgaris',
 'Die Gemeine Wespe ist die Wespe, die im Spätsommer an Kuchen und süssen Getränken auftaucht. Sie baut ihr Nest aus zerkautem Holz, das wie graues Papier aussieht, oft in Erdlöchern oder auf Dachböden. Ein Volk umfasst im Sommer mehrere Tausend Tiere und stirbt im Herbst ab; nur die jungen Königinnen überwintern. Wespen fangen viele andere Insekten und sind darum auch nützlich.',
 '[{"k":"Länge","v":"ca. 12–15 mm (Arbeiterin)"},{"k":"Volk","v":"bis mehrere Tausend Tiere"},{"k":"Nest","v":"aus Holzfasern («Wespenpapier»)"},{"k":"Überwinterung","v":"nur junge Königinnen"}]',
 array['Vespula vulgaris close-up','Vespula vulgaris larvae nest','Vespula vulgaris nest'], null),

-- Falter (Falter, Nahaufnahme, Raupe, Lebensraum)
('falter', 1, 'Grosses Ochsenauge', 'Maniola jurtina',
 'Das Grosse Ochsenauge ist einer der häufigsten Tagfalter auf Schweizer Wiesen. Seine Flügel sind oben braun, beim Weibchen mit orangen Flecken, und tragen an der Spitze der Vorderflügel einen schwarzen Augenfleck mit weissem Punkt. Die Raupen fressen verschiedene Gräser. Der Falter fliegt von Juni bis September, auch bei bedecktem Himmel.',
 '[{"k":"Spannweite","v":"4–5 cm"},{"k":"Flugzeit","v":"Juni–September"},{"k":"Raupe","v":"frisst Gräser"},{"k":"Lebensraum","v":"Wiesen, Wegränder, Waldlichtungen"}]',
 array['Maniola jurtina close-up','Maniola jurtina caterpillar','Maniola jurtina meadow'], null),

-- Steine (Gestein, Nahaufnahme, Handstück, Vorkommen)
('steine', 1, 'Verrucano', 'Sedimentgestein (Konglomerat)',
 'Verrucano ist ein rotes bis violettes, grobkörniges Gestein aus Sand und Geröll, das vor 250 bis 300 Millionen Jahren abgelagert wurde. In den Glarner Alpen liegt dieses alte Gestein über viel jüngerem Kalk und Flysch: Bei der Entstehung der Alpen wurde es über weite Strecken darüber geschoben. Diese Glarner Hauptüberschiebung ist bei den Tschingelhörnern mit dem Martinsloch gut zu sehen und gehört zum UNESCO-Welterbe «Tektonikarena Sardona».',
 '[{"k":"Gesteinsart","v":"Sedimentgestein (Konglomerat)"},{"k":"Alter","v":"ca. 250–300 Mio. Jahre (Perm)"},{"k":"Farbe","v":"rot bis violett"},{"k":"Vorkommen","v":"Glarnerland, Sarganserland"}]',
 array['Verrucano rock close-up','Verrucano Glarus stone','Glarus thrust Tschingelhörner'], 'Verrucano'),

-- Gewässer (Ansicht, Ufer, Umgebung, Stimmung)
('gewaesser', 1, 'Thunersee', 'See, Bern',
 'Der Thunersee liegt im Berner Oberland zwischen Thun und Interlaken und wird von der Aare durchflossen. Er ist bis 217 m tief. An seinen Ufern stehen Schlösser wie Oberhofen und Spiez, im Hintergrund erheben sich Eiger, Mönch und Jungfrau. Beim Bödeli von Interlaken grenzt er an den Brienzersee, mit dem er früher einen einzigen See bildete.',
 '[{"k":"Fläche","v":"48 km²"},{"k":"Tiefe","v":"bis 217 m"},{"k":"Kanton","v":"Bern"},{"k":"Fluss","v":"Aare"}]',
 array['Lake Thun shore','Lake Thun Oberhofen castle','Lake Thun sunset'], 'Lake Thun'),

-- Nutztiere (Tier, Porträt, Jungtier, Auf der Weide)
('nutztiere', 1, 'Schweizer Edelschwein', 'Schwein',
 'Das Schweizer Edelschwein ist eine der wichtigsten Schweinerassen der Schweiz. Es ist ganz weiss, hat aufrecht stehende Ohren und einen langen Körper. Gezüchtet wurde es aus dem englischen Large White. Die Sauen bekommen viele Ferkel und sind gute Mütter.',
 '[{"k":"Tierart","v":"Schwein"},{"k":"Herkunft","v":"Schweiz (aus dem Large White)"},{"k":"Nutzung","v":"Fleisch"},{"k":"Besonderes","v":"ganz weiss, Stehohren"}]',
 array['Large White pig portrait','Large White piglets','pigs pasture Switzerland'], 'Large White pig'),
('nutztiere', 2, 'Weisses Alpenschaf', 'Schaf',
 'Das Weisse Alpenschaf ist die häufigste Schafrasse der Schweiz. Es ist gross, ganz weiss und hat keine Hörner. Im Sommer weiden viele Herden auf den Alpen. Gezüchtet wird es vor allem wegen des Fleisches, die Wolle ist ein Nebenprodukt.',
 '[{"k":"Tierart","v":"Schaf"},{"k":"Herkunft","v":"Schweiz"},{"k":"Nutzung","v":"Fleisch, Wolle"},{"k":"Besonderes","v":"häufigste Schafrasse der Schweiz"}]',
 array['Weisses Alpenschaf','Weisses Alpenschaf lamb','sheep alpine pasture Switzerland'], null),
('nutztiere', 3, 'Schweizerhuhn', 'Huhn',
 'Das Schweizerhuhn ist eine alte Schweizer Hühnerrasse aus dem frühen 20. Jahrhundert. Es ist ganz weiss und hat einen kleinen roten Rosenkamm, der im Winter weniger leicht erfriert als ein hoher Kamm. Die Hennen legen Eier, die Hähne liefern Fleisch. Heute ist die Rasse selten und wird von Pro Specie Rara erhalten.',
 '[{"k":"Tierart","v":"Huhn"},{"k":"Herkunft","v":"Schweiz"},{"k":"Nutzung","v":"Eier, Fleisch"},{"k":"Besonderes","v":"seltene Rasse (Pro Specie Rara)"}]',
 array['Schweizerhuhn','Schweizerhuhn chick','Schweizerhuhn free range'], null),
('nutztiere', 4, 'Evolèner', 'Rind',
 'Das Evolènerrind stammt aus dem Val d''Hérens im Wallis und ist eng mit der Eringerkuh verwandt. Es ist klein und leicht und rotbraun bis schwarz mit weissen Flecken. Die robusten Tiere kommen gut mit steilen Alpweiden zurecht. Die Rasse war fast ausgestorben und wird heute von Pro Specie Rara erhalten.',
 '[{"k":"Tierart","v":"Rind"},{"k":"Herkunft","v":"Val d''Hérens (Wallis)"},{"k":"Nutzung","v":"Milch, Fleisch"},{"k":"Besonderes","v":"seltene Rasse (Pro Specie Rara)"}]',
 array['Evolèner cattle','Evolèner calf','Evolèner cow alp'], null),

-- Naturwunder (Ansicht, Detail, Umgebung, Stimmung)
('naturwunder', 1, 'Trümmelbachfälle', 'Lauterbrunnen, Bern',
 'Die Trümmelbachfälle sind zehn Gletscherwasserfälle im Innern eines Berges im Lauterbrunnental. Ihr Wasser stammt von den Gletschern von Eiger, Mönch und Jungfrau und stürzt durch enge, gewundene Schluchten in die Tiefe. Bis zu 20 000 Liter pro Sekunde donnern durch den Fels. Ein Lift im Berg und Wege führen zu den Fällen.',
 '[{"k":"Wasserfälle","v":"10, im Berginnern"},{"k":"Wassermenge","v":"bis 20 000 Liter pro Sekunde"},{"k":"Herkunft des Wassers","v":"Gletscher von Eiger, Mönch und Jungfrau"},{"k":"Ort","v":"Lauterbrunnental"}]',
 array['Trümmelbach Falls inside','Trümmelbach Falls Lauterbrunnen valley','Trümmelbach waterfall'], 'Trümmelbach Falls'),
('naturwunder', 2, 'Aareschlucht', 'Meiringen, Bern',
 'Die Aareschlucht bei Meiringen ist 1,4 km lang und bis 200 m tief. Die Aare hat sie im Lauf von Jahrtausenden in einen Kalkfelsriegel gegraben. An der engsten Stelle ist die Schlucht nur etwa einen Meter breit. Ein Steg führt an den Felswänden entlang durch die ganze Schlucht.',
 '[{"k":"Länge","v":"1,4 km"},{"k":"Tiefe","v":"bis 200 m"},{"k":"Engste Stelle","v":"ca. 1 m"},{"k":"Gestein","v":"Kalk"}]',
 array['Aare Gorge walkway','Aare Gorge Meiringen','Aareschlucht'], 'Aare Gorge'),
('naturwunder', 3, 'Rhonegletscher', 'Furkapass, Wallis',
 'Der Rhonegletscher am Furkapass ist der Ursprung der Rhone. Er ist rund 8 km lang, hat sich seit 1850 aber stark zurückgezogen: Damals reichte er bis ins Tal bei Gletsch. Jeden Sommer wird eine Eisgrotte in den Gletscher gehauen, die man begehen kann. Um das Schmelzen zu verlangsamen, wird ein Teil des Eises mit weissen Tüchern abgedeckt.',
 '[{"k":"Länge","v":"ca. 8 km"},{"k":"Ort","v":"Furkapass, Wallis"},{"k":"Gewässer","v":"Quelle der Rhone"},{"k":"Besonderes","v":"Eisgrotte, Abdeckung mit Tüchern"}]',
 array['Rhône Glacier ice grotto','Rhône Glacier Furka','Rhône Glacier Gletsch'], 'Rhône Glacier'),
('naturwunder', 4, 'Viamala-Schlucht', 'Thusis, Graubünden',
 'Die Viamala ist eine tiefe, enge Schlucht des Hinterrheins südlich von Thusis. Ihr Name bedeutet «schlechter Weg»: Früher war sie für Säumer und Reisende ein gefährliches Hindernis auf dem Weg über den Splügen und den San Bernardino. Über 300 Treppenstufen führen hinunter zum Fluss, die Felswände sind an manchen Stellen bis 300 m hoch.',
 '[{"k":"Fluss","v":"Hinterrhein"},{"k":"Ort","v":"bei Thusis"},{"k":"Name","v":"«schlechter Weg»"},{"k":"Zugang","v":"über 300 Treppenstufen"}]',
 array['Viamala gorge','Viamala bridge','Viamala Schlucht stairs'], 'Via Mala'),
('naturwunder', 5, 'Ruinaulta', 'Rheinschlucht, Graubünden',
 'Die Ruinaulta ist die Schlucht des Vorderrheins zwischen Ilanz und Reichenau und wird auch «Swiss Grand Canyon» genannt. Sie entstand, nachdem vor rund 10 000 Jahren der Flimser Bergsturz, der grösste bekannte Bergsturz der Alpen, das Tal verschüttete. Der Rhein hat sich seither durch die hellen Schuttmassen gegraben und bizarre Felswände geformt. Eine Bahnlinie der Rhätischen Bahn führt direkt am Fluss entlang.',
 '[{"k":"Fluss","v":"Vorderrhein"},{"k":"Länge","v":"ca. 13 km"},{"k":"Entstehung","v":"Flimser Bergsturz vor rund 10 000 Jahren"},{"k":"Übername","v":"«Swiss Grand Canyon»"}]',
 array['Ruinaulta gorge','Ruinaulta Rhaetian Railway','Rhine Gorge Flims'], 'Ruinaulta'),
('naturwunder', 6, 'Hölloch', 'Muotathal, Schwyz',
 'Das Hölloch im Muotathal ist eine der längsten Höhlen der Welt. Bisher wurden über 200 km Gänge erforscht, und jedes Jahr kommen neue dazu. Entdeckt wurde es 1875 von einem Bauern aus dem Tal. Ein kleiner Teil kann auf Führungen besucht werden, tiefer hinein geht es nur mit Höhlenforschern.',
 '[{"k":"Länge","v":"über 200 km Gänge"},{"k":"Entdeckt","v":"1875"},{"k":"Gestein","v":"Kalk (Karsthöhle)"},{"k":"Ort","v":"Muotathal"}]',
 array['Hölloch cave','Hölloch Muotathal','Hölloch cave formations'], 'Hölloch'),
('naturwunder', 7, 'Giessbachfälle', 'Brienz, Bern',
 'Die Giessbachfälle stürzen in 14 Stufen über rund 500 Höhenmeter hinunter in den Brienzersee. Ein Wanderweg führt an einer Stelle sogar hinter dem Wasserfall hindurch. Hoch über dem See steht das historische Grandhotel Giessbach, das man seit 1879 mit einer Standseilbahn erreicht. Am Abend werden die Fälle beleuchtet.',
 '[{"k":"Stufen","v":"14"},{"k":"Höhe","v":"rund 500 m"},{"k":"See","v":"Brienzersee"},{"k":"Besonderes","v":"Weg hinter dem Wasserfall"}]',
 array['Giessbach Falls','Giessbach Grandhotel','Giessbach Brienz lake'], 'Giessbach Falls'),
('naturwunder', 8, 'Seealpsee', 'Alpstein, Appenzell Innerrhoden',
 'Der Seealpsee liegt am Fuss des Säntis im Alpstein auf rund 1140 m. Im klaren, grünen Wasser spiegeln sich die steilen Kalkwände. Man erreicht ihn zu Fuss in etwa einer Stunde von Wasserauen aus. Rund um den See gibt es Alphütten und Gasthäuser.',
 '[{"k":"Höhe","v":"ca. 1140 m ü. M."},{"k":"Gebirge","v":"Alpstein"},{"k":"Zugang","v":"ab Wasserauen, ca. 1 Stunde"},{"k":"Kanton","v":"Appenzell Innerrhoden"}]',
 array['Seealpsee Alpstein','Seealpsee reflection','Seealpsee Ebenalp view'], 'Seealpsee'),
('naturwunder', 9, 'Morteratschgletscher', 'Pontresina, Graubünden',
 'Der Morteratschgletscher ist der grösste Gletscher der Berninagruppe und fliesst vom Piz Bernina in Richtung Pontresina. Ein Gletscherlehrpfad führt vom Bahnhof Morteratsch zur Gletscherzunge. Tafeln am Weg zeigen, wo das Eis in früheren Jahren lag: Seit dem Ende des 19. Jahrhunderts hat sich der Gletscher um mehr als zwei Kilometer zurückgezogen.',
 '[{"k":"Länge","v":"ca. 6 km"},{"k":"Gebirge","v":"Berninagruppe"},{"k":"Ort","v":"bei Pontresina"},{"k":"Besonderes","v":"Gletscherlehrpfad"}]',
 array['Morteratsch Glacier tongue','Morteratsch Glacier Bernina','Morteratsch Glacier trail'], 'Morteratsch Glacier'),
('naturwunder', 10, 'Taminaschlucht', 'Pfäfers, St. Gallen',
 'Die Taminaschlucht bei Bad Ragaz ist eine enge, tiefe Felsschlucht. In ihr entspringt eine warme Quelle mit rund 36,5 °C, die im Mittelalter von Jägern entdeckt wurde. Früher liess man Kranke an Seilen in die Schlucht hinunter, damit sie im Thermalwasser baden konnten. Heute führt ein Weg durch die Schlucht bis zur Quellgrotte, das Wasser wird nach Bad Ragaz geleitet.',
 '[{"k":"Quelle","v":"Thermalwasser, ca. 36,5 °C"},{"k":"Entdeckt","v":"im Mittelalter"},{"k":"Ort","v":"bei Bad Ragaz"},{"k":"Fluss","v":"Tamina"}]',
 array['Taminaschlucht','Tamina Gorge thermal spring','Altes Bad Pfäfers'], null),

-- Sehenswürdigkeiten (Ansicht, Detail, Umgebung, Stimmung)
('sehenswuerdigkeiten', 1, 'Bundeshaus', 'Bern',
 'Im Bundeshaus in Bern tagen der Nationalrat und der Ständerat, zudem hat der Bundesrat hier seine Büros. Das Parlamentsgebäude mit der grünen Kuppel wurde 1902 eingeweiht. Im Innern zeigen Bilder und Figuren die Geschichte und die Kantone der Schweiz. Auf dem Bundesplatz davor springen im Sommer 26 Wasserfontänen, eine für jeden Kanton.',
 '[{"k":"Eingeweiht","v":"1902"},{"k":"Funktion","v":"Parlament und Regierung"},{"k":"Ort","v":"Bern"},{"k":"Besonderes","v":"26 Fontänen auf dem Bundesplatz"}]',
 array['Federal Palace Bern interior dome','Bundesplatz Bern fountains','Federal Palace Bern Aare'], 'Federal Palace of Switzerland'),
('sehenswuerdigkeiten', 2, 'Grossmünster', 'Zürich',
 'Das Grossmünster mit seinen zwei Türmen ist das Wahrzeichen von Zürich. Hier predigte ab 1519 Huldrych Zwingli und begann die Reformation in der deutschen Schweiz. Die Kirchenfenster stammen von Augusto Giacometti und Sigmar Polke. Fast 200 Stufen führen auf den Karlsturm mit Blick über Stadt und See.',
 '[{"k":"Erbaut","v":"ab ca. 1100"},{"k":"Reformation","v":"Zwingli ab 1519"},{"k":"Türme","v":"2, der Karlsturm ist begehbar"},{"k":"Ort","v":"Zürich"}]',
 array['Grossmünster Zürich towers','Grossmünster window Giacometti','Grossmünster Limmat view'], 'Grossmünster'),
('sehenswuerdigkeiten', 3, 'Kloster Einsiedeln', 'Einsiedeln, Schwyz',
 'Das Benediktinerkloster Einsiedeln wurde 934 gegründet und ist der wichtigste Wallfahrtsort der Schweiz. Die heutige barocke Klosterkirche entstand im 18. Jahrhundert. In der Gnadenkapelle steht die berühmte Schwarze Madonna, zu der jedes Jahr viele Pilger reisen. Auch auf dem Jakobsweg ist Einsiedeln ein wichtiger Halt.',
 '[{"k":"Gegründet","v":"934"},{"k":"Baustil","v":"Barock"},{"k":"Besonderes","v":"Schwarze Madonna"},{"k":"Ort","v":"Einsiedeln"}]',
 array['Einsiedeln Abbey church interior','Einsiedeln Black Madonna','Einsiedeln Abbey square'], 'Einsiedeln Abbey'),
('sehenswuerdigkeiten', 4, 'Rütli', 'Seelisberg, Uri',
 'Das Rütli ist eine Wiese hoch über dem Urnersee. Nach der Sage schworen hier Vertreter von Uri, Schwyz und Unterwalden den Rütlischwur und gründeten so die Eidgenossenschaft. Jedes Jahr am 1. August findet hier eine Bundesfeier statt. Man erreicht das Rütli mit dem Schiff oder zu Fuss.',
 '[{"k":"Ort","v":"Seelisberg, am Urnersee"},{"k":"Bedeutung","v":"Rütlischwur (Sage, 1291)"},{"k":"Feier","v":"1. August"},{"k":"Zugang","v":"Schiff oder zu Fuss"}]',
 array['Rütli meadow','Rütli Lake Uri view','Rütli boat landing'], 'Rütli'),
('sehenswuerdigkeiten', 5, 'Schloss Greyerz', 'Gruyères, Freiburg',
 'Das Schloss Greyerz thront auf einem Hügel über dem gleichnamigen Städtchen im Kanton Freiburg. Es wurde im 13. Jahrhundert gebaut und war lange Sitz der Grafen von Greyerz. Heute ist es ein Museum mit Rittersälen und Gärten. Das Städtchen ist auch für seinen Käse bekannt, den Gruyère.',
 '[{"k":"Erbaut","v":"13. Jahrhundert"},{"k":"Ort","v":"Gruyères"},{"k":"Heute","v":"Museum"},{"k":"Besonderes","v":"Heimat des Gruyère-Käses"}]',
 array['Gruyères Castle courtyard','Gruyères Castle interior','Gruyères town'], 'Gruyères Castle'),
('sehenswuerdigkeiten', 6, 'Munot', 'Schaffhausen',
 'Der Munot ist eine runde Festung aus dem 16. Jahrhundert, die über der Altstadt von Schaffhausen thront. Über eine Wendelrampe im Innern konnten früher sogar Pferde bis auf die Zinne gelangen. Im Turm wohnt bis heute ein Munotwächter, der jeden Abend um 21 Uhr das Munotglöggli läutet. Rund um den Munot wachsen Reben.',
 '[{"k":"Erbaut","v":"1564–1589"},{"k":"Ort","v":"Schaffhausen"},{"k":"Form","v":"Rundbau mit Turm"},{"k":"Besonderes","v":"Munotglöggli jeden Abend um 21 Uhr"}]',
 array['Munot Schaffhausen fortress','Munot spiral ramp','Munot vineyard Schaffhausen'], 'Munot'),
('sehenswuerdigkeiten', 7, 'Kloster St. Johann', 'Müstair, Graubünden',
 'Das Kloster St. Johann in Müstair wurde um 775 gegründet, der Legende nach von Karl dem Grossen. In der Klosterkirche sind Wandmalereien aus der Zeit um 800 erhalten, die zu den ältesten ihrer Art gehören. Seit 1983 gehört das Kloster zum UNESCO-Welterbe. Bis heute leben hier Benediktinerinnen.',
 '[{"k":"Gegründet","v":"um 775"},{"k":"Welterbe","v":"seit 1983"},{"k":"Besonderes","v":"Wandmalereien aus der Zeit um 800"},{"k":"Ort","v":"Val Müstair"}]',
 array['Müstair convent church frescoes','Müstair convent','Val Müstair'], 'Convent of Saint John');

-- Ist ein Eintrag gleichen Namens in der Kategorie nur ausgeblendet, wird er wieder eingeblendet statt doppelt angelegt
update public.entries e set visible = true
from neu n where e.category_id = n.cat and lower(e.name) = lower(n.name) and not e.visible;

insert into public.entries (category_id, name, subtitle, description, facts, search_terms, wp, sort)
select n.cat, n.name, n.sub, n.descr, n.facts::jsonb, n.terms, n.wp,
       coalesce((select max(e.sort) from public.entries e where e.category_id = n.cat), -1) + n.nr
from neu n
where exists (select 1 from public.categories c where c.id = n.cat)
  and not exists (select 1 from public.entries e where lower(e.name) = lower(n.name));

commit;

-- Kontrolle: sichtbare Einträge pro Kategorie (Ziel: überall 16)
select c.sort, c.id, count(e.id) filter (where e.visible) as sichtbar, count(e.id) as alle
from public.categories c left join public.entries e on e.category_id = c.id
group by c.sort, c.id order by c.sort;

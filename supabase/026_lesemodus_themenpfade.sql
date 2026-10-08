-- Einfacher Lesemodus und Themenpfade (Version 2.21.0):
--   entries.simple: Kurzfassung in einfacher Sprache (Mittelstufe, Deutsch als Zweitsprache), Texte in 027
--   paths:          Themenpfade = ein Thema Schritt für Schritt: Karten ansehen (steps [{cat, entry, text}]), dann Aufträge
--   Themenpfad «Klimawandel in der Schweiz» mit 11 Schritten und 6 Aufträgen (5 neue, dazu gr-morteratsch aus 025)
-- Einmal im Supabase-Dashboard unter «SQL Editor» ausführen, BEVOR die neue index.js online ist, danach 027.
-- Lässt sich gefahrlos mehrmals ausführen.

begin;

alter table public.entries
  add column if not exists simple text not null default '' constraint entries_simple_len check (char_length(simple) <= 400);

create table if not exists public.paths (
  id         text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title      text not null check (char_length(title) between 3 and 80),
  intro      text not null default '' check (char_length(intro) <= 600),
  steps      jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array'),   -- [{cat, entry, text}]
  tasks      text[] not null default '{}',                                                -- Kennungen aus tasks
  sort       integer not null default 0,
  visible    boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.paths enable row level security;
drop policy if exists "lesen" on public.paths;
create policy "lesen" on public.paths for select to anon, authenticated using (visible or public.is_admin());
drop policy if exists "admin_schreiben" on public.paths;
create policy "admin_schreiben" on public.paths for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.paths to anon, authenticated;
grant insert, update, delete on public.paths to authenticated;

-- Aufträge zum Klima-Pfad (die Antwort steht jeweils in der Karte)
insert into public.tasks (id, category_id, entry_id, kind, question, guess, answer_type, choices, answer, hint, explanation, sort)
select t.id, t.cat, (select e.id from public.entries e where e.category_id = t.cat and e.name = t.entry),
       t.kind, t.question, t.guess, t.answer_type, t.choices::jsonb, t.answer, t.hint, t.explanation, t.sort
  from (values
  ('klima-aletsch', 'naturwunder', 'Grosser Aletschgletscher', 'rechnen',
   'Der Grosse Aletschgletscher zieht sich jedes Jahr um bis zu 50 m zurück. Wie viele Jahre dauert es bei diesem Tempo, bis er einen ganzen Kilometer kürzer ist?',
   true, 'text', '[]', '20',
   'Ein Kilometer sind 1000 m. Wie oft passen 50 m hinein?',
   '1000 m : 50 m pro Jahr = 20 Jahre. Der Aletschgletscher ist der grösste Gletscher der Alpen; er schmilzt wegen der Klimaerwärmung.',
   600),
  ('klima-tropennacht', 'wetterphaenomene', 'Hitzewelle', 'frage',
   'Im Wetterbericht hörst du: «Heute Nacht gibt es eine Tropennacht.» Was bedeutet das?',
   false, 'choice',
   '["Es kühlt in der Nacht nicht unter 20 °C ab.", "Es regnet in der Nacht so stark wie in den Tropen.", "Es ist in der Nacht über 30 °C heiss."]',
   'Es kühlt in der Nacht nicht unter 20 °C ab.',
   'Schau im Steckbrief der Hitzewelle nach.',
   'In einer Tropennacht kühlt es nicht unter 20 °C ab. Solche Nächte sind belastend, weil sich der Körper nicht erholen kann. Durch den Klimawandel werden Hitzewellen in der Schweiz häufiger und stärker.',
   610),
  ('klima-tuecher', 'naturwunder', 'Rhonegletscher', 'frage',
   'Am Rhonegletscher wird im Sommer ein Teil des Eises mit grossen weissen Tüchern zugedeckt. Wozu?',
   true, 'choice',
   '["Damit das Eis langsamer schmilzt.", "Damit die Touristen das Eis nicht betreten.", "Damit der Gletscher im Sommer nicht zu nass wird."]',
   'Damit das Eis langsamer schmilzt.',
   'Lies den Eintrag Rhonegletscher bei den Naturwundern.',
   'Die weissen Tücher werfen das Sonnenlicht zurück, darunter bleibt das Eis kühler und schmilzt langsamer. Aufhalten lässt sich der Rückgang so aber nicht: Seit 1850 hat sich der Rhonegletscher stark zurückgezogen.',
   620),
  ('klima-aesche', 'fische', 'Äsche', 'situation',
   'Im Hitzesommer 2003 fanden Fischer im Rhein bei Schaffhausen viele tote Äschen. Was war passiert?',
   true, 'choice',
   '["Das Wasser war zu warm geworden.", "Der Rhein war ausgetrocknet.", "Die Fische hatten zu wenig Futter."]',
   'Das Wasser war zu warm geworden.',
   'Schau bei den Fischen nach der Äsche.',
   'Äschen und Bachforellen brauchen kühles, sauerstoffreiches Wasser. Im Hitzesommer 2003 wurde der Rhein so warm, dass viele Äschen starben. Heisse Sommer setzen diesen Fischen stark zu.',
   630),
  ('klima-buchdrucker', 'schaedlinge', 'Buchdrucker', 'frage',
   'Nach heissen, trockenen Sommern sterben in manchen Wäldern viele Fichten ab, und Förster finden unter der Rinde kleine Käfer. Wie hängt das zusammen?',
   true, 'free', '[]', '',
   'Lies die Einträge Fichte und Buchdrucker: Was macht die Trockenheit mit der Fichte, und was macht der Käfer?',
   'Die Fichte hat flache Wurzeln und leidet bei Trockenheit. Geschwächte Bäume können sich schlecht wehren. Der Buchdrucker legt seine Eier unter die Rinde, die Larven fressen Gänge und unterbrechen die Wasser- und Nährstoffleitung, und der Baum stirbt. In trockenen, heissen Sommern kann sich der Käfer massenhaft vermehren.',
   640)
  ) as t(id, cat, entry, kind, question, guess, answer_type, choices, answer, hint, explanation, sort)
on conflict (id) do nothing;

insert into public.paths (id, title, intro, steps, tasks, sort) values
  ('klimawandel', 'Klimawandel in der Schweiz',
   'Gletscher schmelzen, Sommer werden heisser, und Tiere und Pflanzen müssen sich anpassen. Geh den Pfad Schritt für Schritt: Schau dir jede Karte an und denk über die Frage nach. Am Schluss warten Forscheraufträge.',
   '[
     {"cat":"wetterphaenomene","entry":"Hitzewelle","text":"Was ist eine Tropennacht? Und warum gibt es in der Schweiz immer mehr Hitzewellen?"},
     {"cat":"naturwunder","entry":"Grosser Aletschgletscher","text":"Der grösste Gletscher der Alpen wird jedes Jahr kürzer. Wie schnell?"},
     {"cat":"naturwunder","entry":"Morteratschgletscher","text":"Auf dem Gletscherlehrpfad zeigen Tafeln, wo das Eis früher lag. Wie weit ist es schon zurückgewichen?"},
     {"cat":"naturwunder","entry":"Rhonegletscher","text":"Warum deckt man hier Eis mit weissen Tüchern zu, und kann das den Gletscher retten?"},
     {"cat":"berge","entry":"Glärnisch","text":"Auch vor der Haustür: Was passiert mit dem Glärnischfirn über Glarus?"},
     {"cat":"fische","entry":"Bachforelle","text":"Warum setzen heisse Sommer der Bachforelle zu?"},
     {"cat":"fische","entry":"Äsche","text":"Was geschah im Hitzesommer 2003 im Rhein bei Schaffhausen?"},
     {"cat":"baeume","entry":"Fichte (Rottanne)","text":"Der häufigste Baum der Schweiz hat flache Wurzeln. Was bedeutet das bei Trockenheit?"},
     {"cat":"schaedlinge","entry":"Buchdrucker","text":"Wann kann sich dieser kleine Käfer massenhaft vermehren?"},
     {"cat":"wetterphaenomene","entry":"Starkregen","text":"Überlege: Warme Luft kann mehr Wasser aufnehmen. Was kann das für Regen und Gewitter bedeuten?"},
     {"cat":"saeugetiere","entry":"Schneehase","text":"Sein Fell wird im Winter weiss. Was passiert, wenn der Schnee später kommt oder früher schmilzt?"}
   ]'::jsonb,
   array['klima-tropennacht', 'klima-aletsch', 'gr-morteratsch', 'klima-tuecher', 'klima-aesche', 'klima-buchdrucker'], 10)
on conflict (id) do nothing;

update public.app_meta set schema_version = 26, updated_at = now();

commit;

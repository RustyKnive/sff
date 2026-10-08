/* Versionen von Website und Datenbank â€“ bei jeder VerÃ¶ffentlichung nachfÃ¼hren (siehe CLAUDE.md, Â«VersionierungÂ»).
   app:    Hauptversion.Funktion.Korrektur (2.1.0 = neue MÃ¶glichkeit, 2.0.1 = Korrektur, 3.0.0 = grosser Umbau)
   datum:  Tag der VerÃ¶ffentlichung
   schema: Datenbank-Version, die diese Website mindestens braucht (= Nummer der letzten SQL-Datei supabase/0NN_â€¦)
   Wird von index.html, admin.html und sw.js geladen (self = window bzw. der Service Worker). */
self.SFF_VERSION = { app:"2.23.0", datum:"2026-10-08", schema:28 };

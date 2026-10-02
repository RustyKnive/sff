/* Versionen von Website und Datenbank – bei jeder Veröffentlichung nachführen (siehe CLAUDE.md, «Versionierung»).
   app:    Hauptversion.Funktion.Korrektur (2.1.0 = neue Möglichkeit, 2.0.1 = Korrektur, 3.0.0 = grosser Umbau)
   datum:  Tag der Veröffentlichung
   schema: Datenbank-Version, die diese Website mindestens braucht (= Nummer der letzten SQL-Datei supabase/0NN_…)
   Wird von index.html, admin.html und sw.js geladen (self = window bzw. der Service Worker). */
self.SFF_VERSION = { app:"2.14.1", datum:"2026-10-02", schema:21 };

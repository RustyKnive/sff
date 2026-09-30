/* Die Seite ist nach https://je-net.ch/sff/ umgezogen.
   Dieser Service Worker ersetzt den alten: Er löscht dessen Speicher, meldet sich ab
   und lädt offene Fenster neu, damit sie auf die neue Adresse weitergeleitet werden. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil((async () => {
  for(const k of await caches.keys()) await caches.delete(k);
  await self.registration.unregister();
  for(const c of await self.clients.matchAll({ type:"window" })) c.navigate(c.url);
})()));

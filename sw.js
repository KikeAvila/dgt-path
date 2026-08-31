/* Service worker — cachea la app para uso OFFLINE.
   Sube CACHE cada vez que cambies ficheros para forzar la actualización. */
const CACHE = "dgt-path-v1";
const ASSETS = [
  "./",
  "index.html",
  "styles.css",
  "app.js",
  "data.js",
  "manifest.webmanifest",
  "icon-180.png",
  "icon-192.png",
  "icon-512.png",
  "images/stop.svg",
  "images/ceda_el_paso.svg",
  "images/prohibido_adelantar.svg",
  "images/velocidad_max_50.svg",
  "images/velocidad_max_120.svg",
  "images/peligro_curva.svg",
  "images/peligro_peatones.svg",
  "images/prohibido_estacionar.svg",
  "images/direccion_prohibida.svg",
  "images/sentido_obligatorio.svg",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match("index.html")))
  );
});

/* Service worker — cachea la app para uso OFFLINE.
   Sube CACHE cada vez que cambies ficheros para forzar la actualización. */
const CACHE = "dgt-path-v5";
const ASSETS = [
  "./",
  "index.html",
  "styles.css",
  "app.js",
  "data.js",
  "teoria.js",
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

// El código y los datos van "red primero" para que las actualizaciones se
// apliquen en cuanto haya conexión; las imágenes/iconos van "caché primero"
// (no cambian y así cargan al instante y funcionan offline).
const NETWORK_FIRST = /(index\.html|app\.js|data\.js|teoria\.js|styles\.css|manifest\.webmanifest)(\?|$)/;

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = e.request.url;
  const esCodigo = e.request.mode === "navigate" || NETWORK_FIRST.test(url);

  if (esCodigo) {
    // Red primero, con la caché como respaldo (offline).
    e.respondWith(
      fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(e.request).then((hit) => hit || caches.match("index.html")))
    );
  } else {
    // Caché primero para el resto (imágenes, iconos).
    e.respondWith(
      caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match("index.html")))
    );
  }
});

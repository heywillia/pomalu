// Service worker simple: cachea el shell de la app y las imágenes para que
// el catálogo funcione instalado / con conexión débil. Al actualizar el
// sitio, subí CACHE_VERSION para invalidar la caché vieja de los clientes.
const CACHE_VERSION = "v1";
const CACHE_NAME = "cn-catalogo-" + CACHE_VERSION;
const SHELL = ["./", "index.html", "style.css", "app.js", "manifest.json", "catalog.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  if (url.pathname.includes("/images/")) {
    // cache-first para fotos de producto (no cambian)
    e.respondWith(
      caches.match(e.request).then((cached) => cached || fetch(e.request).then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
        return res;
      }))
    );
    return;
  }

  // network-first para el shell (html/css/js/catalog) con fallback a caché
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

/* ============================================
   CALCULADORA PWA — sw.js (Service Worker)

   Este archivo es el CORAZÓN de la PWA.
   Corre en background, separado de la página.
   Intercepta todas las peticiones de red y
   decide si responder desde caché o de internet.

   CICLO DE VIDA DEL SERVICE WORKER:
   1. install   → se descarga e instala
   2. activate  → toma el control de la página
   3. fetch     → intercepta peticiones de red
   ============================================ */


/* ==========================================
   CONFIGURACIÓN
   ========================================== */

// Nombre del caché — cambia la versión para
// forzar actualización cuando despliegues cambios
const CACHE_NAME = 'calculadora-pwa-v1';

// Lista de archivos a cachear en la instalación
// Estos son los archivos "shell" de la app:
// todo lo necesario para funcionar offline.
const ARCHIVOS_A_CACHEAR = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];


/* ==========================================
   EVENTO: install
   Se ejecuta UNA VEZ cuando el SW se instala.
   Aquí descargamos y guardamos todos los
   archivos del app shell en el caché.
   ========================================== */
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando Service Worker...');

  // waitUntil() le dice al navegador que espere
  // hasta que terminemos de cachear los archivos.
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Cacheando archivos del app shell...');
        return cache.addAll(ARCHIVOS_A_CACHEAR);
      })
      .then(() => {
        console.log('[SW] ✅ Todos los archivos cacheados.');
        // skipWaiting() hace que el nuevo SW tome control
        // inmediatamente, sin esperar que se cierren las tabs.
        return self.skipWaiting();
      })
  );
});


/* ==========================================
   EVENTO: activate
   Se ejecuta cuando el SW toma el control.
   Ideal para limpiar cachés viejos de
   versiones anteriores.
   ========================================== */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activando Service Worker...');

  event.waitUntil(
    caches.keys().then((nombresCaches) => {
      return Promise.all(
        nombresCaches
          // Filtrar cachés que NO sean el actual
          .filter((nombre) => nombre !== CACHE_NAME)
          .map((nombre) => {
            console.log('[SW] 🗑️ Eliminando caché viejo:', nombre);
            return caches.delete(nombre);
          })
      );
    }).then(() => {
      console.log('[SW] ✅ Service Worker activo y en control.');
      // clients.claim() toma control de todas las tabs
      // abiertas sin necesidad de recargar.
      return self.clients.claim();
    })
  );
});


/* ==========================================
   EVENTO: fetch
   Se ejecuta EN CADA petición de red que
   hace la página (HTML, CSS, JS, imágenes...).

   ESTRATEGIA: Cache First (Caché primero)
   ─────────────────────────────────────────
   1. ¿Está en caché? → Devolver del caché ✅
   2. ¿No está? → Ir a la red 🌐
   3. ¿Sin red tampoco? → Error offline ❌

   Esta estrategia es ideal para apps cuyo
   contenido no cambia frecuentemente, como
   esta calculadora.
   ========================================== */
self.addEventListener('fetch', (event) => {

  // Solo manejamos peticiones GET
  // (POST, PUT, etc. van directo a la red)
  if (event.request.method !== 'GET') return;

  event.respondWith(
    // Buscar en el caché primero
    caches.match(event.request)
      .then((respuestaCache) => {

        // ✅ ENCONTRADO EN CACHÉ → devolver sin tocar la red
        if (respuestaCache) {
          console.log('[SW] 📦 Sirviendo desde caché:', event.request.url);
          return respuestaCache;
        }

        // 🌐 NO EN CACHÉ → ir a la red
        console.log('[SW] 🌐 Descargando de la red:', event.request.url);

        return fetch(event.request)
          .then((respuestaRed) => {

            // Verificar que sea una respuesta válida
            if (!respuestaRed || respuestaRed.status !== 200 || respuestaRed.type !== 'basic') {
              return respuestaRed;
            }

            // Guardar una COPIA en el caché para la próxima vez.
            // (clone() porque la respuesta es un stream que solo
            // se puede leer una vez — una copia va al caché,
            // la otra va al navegador)
            const copiaParaCache = respuestaRed.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, copiaParaCache);
            });

            return respuestaRed;
          })
          .catch(() => {
            // ❌ Sin red y sin caché
            // En una app más completa, devolveríamos una
            // página offline.html personalizada aquí.
            console.warn('[SW] ⚠️ Sin red y sin caché para:', event.request.url);
          });
      })
  );
});


/* ==========================================
   NOTA ACADÉMICA — Otras estrategias de caché:

   🔵 Network First (Red primero):
      Intenta la red, si falla usa caché.
      Ideal para APIs con datos en tiempo real.

   🟡 Stale While Revalidate:
      Devuelve caché inmediatamente Y actualiza
      en background. Ideal para recursos que
      cambian poco (avatares, datos secundarios).

   🔴 Cache Only:
      Solo caché, nunca va a la red.
      Útil para assets que nunca cambian.

   🟢 Network Only:
      Solo red, nunca usa caché.
      Para operaciones críticas (pagos, auth).
   ========================================== */

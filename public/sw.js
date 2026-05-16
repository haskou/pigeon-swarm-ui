const cacheVersion = 'pigeon-swarm-v1';
const appShell = [
  '/',
  '/favicon/site.webmanifest',
  '/favicon/android-chrome-192x192.png',
  '/favicon/android-chrome-512x512.png',
  '/favicon/apple-touch-icon.png',
  '/logo.png',
  '/connectionLost.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(cacheVersion)
      .then((cache) => cache.addAll(appShell))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== cacheVersion)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();

          caches.open(cacheVersion).then((cache) => cache.put('/', copy));

          return response;
        })
        .catch(() => caches.match('/')),
    );

    return;
  }

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request).then((response) => {
          if (!response.ok) return response;

          const copy = response.clone();

          caches.open(cacheVersion).then((cache) => cache.put(request, copy));

          return response;
        }),
    ),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';
  const url = new URL(targetUrl, self.location.origin).toString();

  event.waitUntil(
    self.clients
      .matchAll({ includeUncontrolled: true, type: 'window' })
      .then((clients) => {
        const focusedClient = clients.find((client) => client.url === url);

        if (focusedClient) return focusedClient.focus();

        return self.clients.openWindow(url);
      }),
  );
});

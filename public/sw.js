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
  if (request.headers.has('range')) return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  if (
    url.pathname.startsWith('/node_modules/.vite/') ||
    url.pathname.startsWith('/@vite/') ||
    url.pathname.startsWith('/@react-refresh') ||
    url.pathname.startsWith('/src/')
  ) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (!canCacheResponse(response)) return response;

          const copy = response.clone();

          caches
            .open(cacheVersion)
            .then((cache) => cache.put('/', copy))
            .catch(() => undefined);

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
        fetch(request)
          .then((response) => {
            if (!canCacheResponse(response)) return response;

            const copy = response.clone();

            caches
              .open(cacheVersion)
              .then((cache) => cache.put(request, copy))
              .catch(() => undefined);

            return response;
          })
          .catch(() => cached ?? Response.error()),
    ),
  );
});

function canCacheResponse(response) {
  return response.ok && response.status === 200 && response.type === 'basic';
}

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

self.addEventListener('push', (event) => {
  const payload = pushPayload(event.data);

  if (!payload) return;

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      badge: payload.badge || '/favicon/favicon-32x32.png',
      body: payload.body,
      data: {
        url: payload.url || '/',
      },
      icon: payload.icon || '/favicon/android-chrome-192x192.png',
      tag: payload.tag,
    }),
  );
});

function pushPayload(data) {
  if (!data) {
    return {
      body: '',
      title: 'Pigeon Swarm',
      url: '/',
    };
  }

  try {
    const payload = data.json();

    if (!payload || typeof payload !== 'object') return null;

    return {
      badge: typeof payload.badge === 'string' ? payload.badge : undefined,
      body: typeof payload.body === 'string' ? payload.body : '',
      icon: typeof payload.icon === 'string' ? payload.icon : undefined,
      tag: typeof payload.tag === 'string' ? payload.tag : undefined,
      title: typeof payload.title === 'string' ? payload.title : 'Pigeon Swarm',
      url: typeof payload.url === 'string' ? payload.url : '/',
    };
  } catch {
    return {
      body: data.text(),
      title: 'Pigeon Swarm',
      url: '/',
    };
  }
}

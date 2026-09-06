import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

const clientOrigin = 'https://client.example';
const workerSource = readFileSync(join(process.cwd(), 'public/sw.js'), 'utf8');

function serviceWorker(independent = true) {
  const handlers = new Map<string, (event: Record<string, unknown>) => void>();
  const cachedResponse = { body: 'stale cached HTML' };
  const cache = {
    addAll: jest.fn(() => Promise.resolve(undefined)),
    put: jest.fn(() => Promise.resolve(undefined)),
  };
  const caches = {
    delete: jest.fn(() => Promise.resolve(true)),
    keys: jest.fn(() =>
      Promise.resolve(['pigeon-swarm-v1', 'pigeon-swarm-old', 'other-app']),
    ),
    match: jest.fn(() => Promise.resolve(cachedResponse)),
    open: jest.fn(() => Promise.resolve(cache)),
  };
  const clients = {
    claim: jest.fn(() => Promise.resolve(undefined)),
    matchAll: jest.fn(() => Promise.resolve([])),
    openWindow: jest.fn(() => Promise.resolve(undefined)),
  };
  const fetch = jest.fn(() => Promise.reject(new Error('offline')));
  const skipWaiting = jest.fn(() => Promise.resolve(undefined));

  runInNewContext(workerSource, {
    caches,
    fetch,
    self: {
      addEventListener: (
        name: string,
        handler: (event: Record<string, unknown>) => void,
      ) => handlers.set(name, handler),
      clients,
      location: {
        href: `${clientOrigin}/sw.js${independent ? '?independent=1' : ''}`,
        origin: clientOrigin,
      },
      registration: { getNotifications: () => Promise.resolve([]) },
      skipWaiting,
    },
    URL,
  });

  async function dispatch(name: string, event: Record<string, unknown> = {}) {
    const pending: Promise<unknown>[] = [];
    const respondWith = jest.fn((result: Promise<unknown>) =>
      pending.push(result),
    );

    handlers.get(name)?.({
      respondWith,
      waitUntil: (result: Promise<unknown>) => pending.push(result),
      ...event,
    });
    const results = await Promise.all(pending);

    return { respondWith, results };
  }

  return {
    cache,
    cachedResponse,
    caches,
    clients,
    dispatch,
    fetch,
    skipWaiting,
  };
}

function request(mode: string, path = '/') {
  return {
    headers: { has: () => false },
    method: 'GET',
    mode,
    url: clientOrigin + path,
  };
}

describe('independent client service worker', () => {
  it('installs without caching executable resources or the app shell', async () => {
    const worker = serviceWorker();

    await worker.dispatch('install');

    expect(worker.skipWaiting).toHaveBeenCalledTimes(1);
    expect(worker.caches.open).not.toHaveBeenCalled();
    expect(worker.fetch).not.toHaveBeenCalled();
  });

  it('removes only Pigeon caches before claiming clients', async () => {
    const worker = serviceWorker();

    await worker.dispatch('activate');

    expect(worker.caches.delete.mock.calls).toEqual([
      ['pigeon-swarm-v1'],
      ['pigeon-swarm-old'],
    ]);
    expect(worker.clients.claim).toHaveBeenCalledTimes(1);
  });

  it.each(['navigate', 'cors'])(
    'does not intercept %s requests even when stale HTML is cached',
    async (mode) => {
      const worker = serviceWorker();
      const event = await worker.dispatch('fetch', { request: request(mode) });

      expect(event.respondWith).not.toHaveBeenCalled();
      expect(worker.caches.match).not.toHaveBeenCalled();
      expect(worker.fetch).not.toHaveBeenCalled();
    },
  );

  it.each([
    'https://backend.example/login',
    '//backend.example/login',
    'javascript:alert(1)',
    'data:text/html,untrusted',
    'https://[malformed',
    'https://user:password@client.example/private',
  ])(
    'confines notification navigation for %s to the client origin',
    async (url) => {
      const worker = serviceWorker();
      const close = jest.fn();

      await worker.dispatch('notificationclick', {
        notification: { close, data: { url } },
      });

      expect(close).toHaveBeenCalledTimes(1);
      expect(worker.clients.openWindow).toHaveBeenCalledWith(
        `${clientOrigin}/`,
      );
    },
  );

  it('preserves valid same-origin notification destinations', async () => {
    const worker = serviceWorker();

    await worker.dispatch('notificationclick', {
      notification: { close: jest.fn(), data: { url: '/?conversation=123' } },
    });

    expect(worker.clients.openWindow).toHaveBeenCalledWith(
      `${clientOrigin}/?conversation=123`,
    );
  });
});

describe('combined client service worker compatibility', () => {
  it('continues to cache its app shell on install', async () => {
    const worker = serviceWorker(false);

    await worker.dispatch('install');

    expect(worker.caches.open).toHaveBeenCalledWith('pigeon-swarm-v1');
    expect(worker.cache.addAll).toHaveBeenCalledWith(
      expect.arrayContaining(['/']),
    );
    expect(worker.skipWaiting).toHaveBeenCalledTimes(1);
  });

  it('keeps the current cache when activating', async () => {
    const worker = serviceWorker(false);

    await worker.dispatch('activate');

    expect(worker.caches.delete.mock.calls).toEqual([
      ['pigeon-swarm-old'],
      ['other-app'],
    ]);
  });

  it('continues to serve cached navigation when offline', async () => {
    const worker = serviceWorker(false);
    const event = await worker.dispatch('fetch', {
      request: request('navigate'),
    });

    expect(event.respondWith).toHaveBeenCalledTimes(1);
    expect(worker.fetch).toHaveBeenCalledTimes(1);
    expect(event.results).toEqual([worker.cachedResponse]);
  });

  it.each(['no-store', 'no-cache'])(
    'does not intercept %s API requests under a custom prefix',
    async (cacheMode) => {
      const worker = serviceWorker(false);
      const event = await worker.dispatch('fetch', {
        request: {
          ...request('cors', '/backend/conversations/'),
          cache: cacheMode,
        },
      });

      expect(event.respondWith).not.toHaveBeenCalled();
      expect(worker.caches.match).not.toHaveBeenCalled();
      expect(worker.caches.open).not.toHaveBeenCalled();
      expect(worker.fetch).not.toHaveBeenCalled();
    },
  );

  it('continues to serve cached assets before the network', async () => {
    const worker = serviceWorker(false);
    const event = await worker.dispatch('fetch', {
      request: request('cors', '/assets/app.js'),
    });

    expect(event.respondWith).toHaveBeenCalledTimes(1);
    expect(worker.fetch).not.toHaveBeenCalled();
    expect(event.results).toEqual([worker.cachedResponse]);
  });
});

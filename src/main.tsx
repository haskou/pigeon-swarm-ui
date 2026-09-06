import React from 'react';
import { createRoot } from 'react-dom/client';

import './index.css';
import { IndependentClient } from './app/presentation/client/IndependentClient';
import { ClientNodeSelection } from './shared/infrastructure/client/ClientNodeSelection';
import { isIndependentClient } from './shared/infrastructure/client/isIndependentClient';

const App = React.lazy(() => import('./app/app'));

function preventMobileZoom(): void {
  const preventDefault = (event: Event) => event.preventDefault();
  const preventMultiTouch = (event: TouchEvent) => {
    if (event.touches.length > 1) event.preventDefault();
  };

  document.addEventListener('gesturestart', preventDefault, {
    passive: false,
  });
  document.addEventListener('gesturechange', preventDefault, {
    passive: false,
  });
  document.addEventListener('gestureend', preventDefault, {
    passive: false,
  });
  document.addEventListener('touchmove', preventMultiTouch, {
    passive: false,
  });
}

preventMobileZoom();

if (isIndependentClient()) {
  window.addEventListener('storage', (event) => {
    if (event.storageArea !== window.localStorage) return;

    if (event.key !== null && event.key !== ClientNodeSelection.storageKey)
      return;

    if (window.location.pathname.startsWith('/invite/community/')) {
      const destination = new URL(window.location.href);
      destination.searchParams.set('choose-node', '1');
      window.history.replaceState(null, '', destination.href);
      window.location.reload();

      return;
    }
    window.location.replace('/connect');
  });
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isIndependentClient() ? (
      <IndependentClient />
    ) : (
      <React.Suspense>
        <App />
      </React.Suspense>
    )}
  </React.StrictMode>,
);

const serviceWorkerPath = isIndependentClient()
  ? '/sw.js?independent=1'
  : '/sw.js';

function isJavaScriptMimeType(contentType: string): boolean {
  return (
    contentType.includes('javascript') || contentType.includes('ecmascript')
  );
}

async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;

  if (import.meta.env.DEV) {
    const registrations = await navigator.serviceWorker.getRegistrations();

    await Promise.all(
      registrations.map((registration) => registration.unregister()),
    );

    return;
  }

  const response = await fetch(serviceWorkerPath, {
    cache: 'no-store',
    credentials: 'same-origin',
  });
  const contentType = response.headers.get('content-type') ?? '';

  if (!response.ok || !isJavaScriptMimeType(contentType)) {
    console.warn(
      'Service worker registration skipped: invalid script response',
      {
        contentType,
        status: response.status,
        url: serviceWorkerPath,
      },
    );

    return;
  }

  await navigator.serviceWorker.register(serviceWorkerPath, {
    updateViaCache: 'none',
  });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void registerServiceWorker().catch((error: unknown) => {
      console.warn('Service worker registration failed', error);
    });
  });
}

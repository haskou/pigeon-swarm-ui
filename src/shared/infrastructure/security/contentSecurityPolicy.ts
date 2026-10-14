// Injected as a meta tag by the build-only plugin in vite.config.ts.
// frame-ancestors is ignored in meta tags. Clickjacking protection must come
// from the hosting server's Content-Security-Policy response header.
// Images load only from the app, embedded data, blobs and the build's API
// origin (stickers), so content from other users cannot make the browser
// contact a third party.
export function contentSecurityPolicy(apiServerUrl?: string): string {
  return [
    "default-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "frame-src 'none'",
    "form-action 'self'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    [
      'img-src',
      "'self'",
      'data:',
      'blob:',
      ...absoluteOrigin(apiServerUrl),
    ].join(' '),
    "media-src 'self' blob:",
    "font-src 'self' data:",
    "connect-src 'self' blob: http: https: ws: wss:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
  ].join('; ');
}

// A relative API URL (the combined image serves it at /api) is already 'self'.
function absoluteOrigin(url?: string): string[] {
  if (!url) return [];

  try {
    const { origin } = new URL(url);

    return origin === 'null' ? [] : [origin];
  } catch {
    return [];
  }
}

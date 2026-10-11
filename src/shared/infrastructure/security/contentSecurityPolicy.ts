// Injected as a meta tag by the build-only plugin in vite.config.ts.
// frame-ancestors is ignored in meta tags. Clickjacking protection must come
// from the hosting server's Content-Security-Policy response header.
const directives = [
  "default-src 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "form-action 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: http: https:",
  "media-src 'self' blob:",
  "font-src 'self' data:",
  "connect-src 'self' blob: http: https: ws: wss:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
];

export const contentSecurityPolicy = directives.join('; ');

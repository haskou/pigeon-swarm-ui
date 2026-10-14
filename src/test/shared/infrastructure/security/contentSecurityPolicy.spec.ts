import { describe, expect, it } from '@jest/globals';

import { contentSecurityPolicy } from '../../../../shared/infrastructure/security/contentSecurityPolicy';

function sourcesOf(policy: string): Record<string, string[]> {
  return Object.fromEntries(
    policy.split(';').map((directive) => {
      const [name, ...values] = directive.trim().split(/\s+/);

      return [name, values];
    }),
  );
}

describe('contentSecurityPolicy', () => {
  const sources = sourcesOf(contentSecurityPolicy());

  it('allows scripts only from the app origin and wasm compilation', () => {
    expect(sources['script-src']).toEqual(["'self'", "'wasm-unsafe-eval'"]);
  });

  it('blocks plugins, framing, and base URL injection', () => {
    expect(sources['object-src']).toEqual(["'none'"]);
    expect(sources['frame-src']).toEqual(["'none'"]);
    expect(sources['base-uri']).toEqual(["'none'"]);
  });

  it('falls back to the app origin for unlisted resource types', () => {
    expect(sources['default-src']).toEqual(["'self'"]);
  });

  it('loads images only from the app origin, embedded data and blobs', () => {
    expect(sources['img-src']).toEqual(["'self'", 'data:', 'blob:']);
  });

  it('keeps images of a same-origin API on the app origin', () => {
    expect(sourcesOf(contentSecurityPolicy('/api'))['img-src']).toEqual([
      "'self'",
      'data:',
      'blob:',
    ]);
  });

  it('allows images from the origin of a separately hosted API', () => {
    expect(
      sourcesOf(contentSecurityPolicy('https://api.example.org/pigeon/'))[
        'img-src'
      ],
    ).toEqual(["'self'", 'data:', 'blob:', 'https://api.example.org']);
  });
});

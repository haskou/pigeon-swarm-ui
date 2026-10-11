import { describe, expect, it } from '@jest/globals';

import { contentSecurityPolicy } from '../../../../shared/infrastructure/security/contentSecurityPolicy';

describe('contentSecurityPolicy', () => {
  const sources: Record<string, string[]> = Object.fromEntries(
    contentSecurityPolicy.split(';').map((directive) => {
      const [name, ...values] = directive.trim().split(/\s+/);

      return [name, values];
    }),
  );

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
});

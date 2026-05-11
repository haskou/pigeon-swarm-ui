import type { IdentityResource } from '../domain/types';

import { identityName, isValidHandle, normalizeHandle } from './identityDisplay';

const identity = {
  profile: {
    handle: 'ada_42',
    name: 'Ada',
  },
} as IdentityResource;

describe('identity display helpers', () => {
  it('formats display names with handles', () => {
    expect(identityName(identity)).toBe('Ada (@ada_42)');
  });

  it('normalizes handles', () => {
    expect(normalizeHandle('@Ada_42')).toBe('ada_42');
  });

  it('validates handles', () => {
    expect(isValidHandle('ada_42')).toBe(true);
    expect(isValidHandle('@al')).toBe(false);
    expect(isValidHandle('Ada!')).toBe(false);
  });
});

import { describe, expect, it } from '@jest/globals';

import { normalizeIdentityLookup } from '../../../../../app/presentation/workspace/components/normalizeIdentityLookup';

describe(normalizeIdentityLookup.name, () => {
  it.each([
    ['@ada', 'ada'],
    ['  @ada  ', 'ada'],
    ['identity-id', 'identity-id'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizeIdentityLookup(input)).toBe(expected);
  });
});

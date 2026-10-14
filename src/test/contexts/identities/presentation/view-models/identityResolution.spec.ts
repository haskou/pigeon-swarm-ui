import type { IdentityResource } from '../../../../../contexts/identities/infrastructure/http/resources/IdentityResource';

import {
  identityIdsAwaitingResolution,
  resolvedIdentityNames,
  unresolvedIdentityIdsAfter,
} from '../../../../../contexts/identities/presentation/view-models/identityResolution';

const ada = {
  id: 'ada',
  profile: { name: 'Ada Lovelace' },
} as IdentityResource;

describe('identity resolution', () => {
  it('keeps the last known name when the node cannot be reached', () => {
    expect(
      resolvedIdentityNames({ ada: 'Ada', grace: 'Grace' }, [
        ['ada', null],
        ['grace', null],
        ['linus', null],
      ]),
    ).toEqual({ ada: 'Ada', grace: 'Grace', linus: 'linus' });
  });

  it('takes the name of a resolved profile', () => {
    expect(resolvedIdentityNames({ ada: 'Ada' }, [['ada', ada]])).toEqual({
      ada: 'Ada Lovelace',
    });
  });

  it('waits for the next refresh before retrying an identity that failed to resolve', () => {
    expect(
      identityIdsAwaitingResolution(
        ['ada', 'grace', 'linus'],
        { ada },
        new Set(['grace']),
      ),
    ).toEqual(['linus']);
  });

  it('marks failed reads for the next refresh and clears them once resolved', () => {
    expect([
      ...unresolvedIdentityIdsAfter(new Set(['ada', 'grace']), [
        ['ada', ada],
        ['linus', null],
      ]),
    ]).toEqual(['grace', 'linus']);
  });
});

import type { Session } from '../../../../../shared/domain/pigeonResources.types';

import { CommunityIdentityId } from '../../../../../contexts/communities/domain/value-objects/CommunityIdentityId';
import { CommunityAccessContexts } from '../../../../../contexts/communities/infrastructure/http/CommunityAccessContexts';
import { CommunityAccessContextNotFoundError } from '../../../../../contexts/communities/infrastructure/http/errors/CommunityAccessContextNotFoundError';

describe(CommunityAccessContexts.name, () => {
  it('keeps transport access outside application messages', () => {
    const contexts = new CommunityAccessContexts();
    const session = { identity: { id: 'identity-a' } } as Session;

    contexts.register(session);

    expect(contexts.find(CommunityIdentityId.fromString('identity-a'))).toBe(
      session,
    );
  });

  it('rejects identities without a registered transport context', () => {
    const contexts = new CommunityAccessContexts();

    expect(() =>
      contexts.find(CommunityIdentityId.fromString('identity-a')),
    ).toThrow(CommunityAccessContextNotFoundError);
  });
});

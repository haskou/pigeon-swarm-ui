import type { Session } from '../../../../../shared/domain/pigeonResources.types';

import { CallIdentityId } from '../../../../../contexts/calls/domain/value-objects/CallIdentityId';
import { CallAccessContexts } from '../../../../../contexts/calls/infrastructure/http/CallAccessContexts';
import { CallAccessContextNotFoundError } from '../../../../../contexts/calls/infrastructure/http/errors/CallAccessContextNotFoundError';

describe(CallAccessContexts.name, () => {
  it('resolves a registered session by domain identity id', () => {
    const contexts = new CallAccessContexts();
    const session = { identity: { id: 'identity-a' } } as Session;

    contexts.register(session);

    expect(contexts.find(CallIdentityId.fromString('identity-a'))).toBe(
      session,
    );
  });

  it('normalizes a PEM identity before registering its session', () => {
    const contexts = new CallAccessContexts();
    const session = {
      identity: {
        id: [
          '-----BEGIN PUBLIC KEY-----',
          'identity-a',
          '-----END PUBLIC KEY-----',
        ].join('\n'),
      },
    } as Session;

    contexts.register(session);

    expect(contexts.find(CallIdentityId.fromString('identity-a'))).toBe(
      session,
    );
  });

  it('rejects access without a registered infrastructure context', () => {
    expect(() =>
      new CallAccessContexts().find(CallIdentityId.fromString('identity-a')),
    ).toThrow(CallAccessContextNotFoundError);
  });
});

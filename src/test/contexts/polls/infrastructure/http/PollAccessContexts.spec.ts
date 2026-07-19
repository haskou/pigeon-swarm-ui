import type { Session } from '../../../../../shared/domain/pigeonResources.types';

import { PollActorId } from '../../../../../contexts/polls/domain/value-objects/PollActorId';
import { PollAccessContexts } from '../../../../../contexts/polls/infrastructure/http/PollAccessContexts';

describe(PollAccessContexts.name, () => {
  it('keeps browser sessions outside application and domain', () => {
    const contexts = new PollAccessContexts();
    const session = {
      identity: { id: 'identity-a' },
    } as unknown as Session;

    contexts.register(session);

    expect(contexts.find(PollActorId.fromString('identity-a'))).toBe(session);
    expect(() => contexts.find(PollActorId.fromString('identity-b'))).toThrow(
      'Poll access context is not registered.',
    );
  });
});

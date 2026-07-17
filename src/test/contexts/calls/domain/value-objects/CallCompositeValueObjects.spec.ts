import { Timestamp } from '@haskou/value-objects';

import { CallLifecycle } from '../../../../../contexts/calls/domain/value-objects/CallLifecycle';
import { CallParticipantTimeline } from '../../../../../contexts/calls/domain/value-objects/CallParticipantTimeline';
import { CallScope } from '../../../../../contexts/calls/domain/value-objects/CallScope';

describe('call composite value objects', () => {
  it('hydrates call lifecycle without changing persisted state', () => {
    const lifecycle = CallLifecycle.fromPrimitives({
      createdAt: 100,
      endedAt: 200,
      status: 'ended',
    });

    expect(lifecycle.isEnded()).toBe(true);
    expect(lifecycle.toPrimitives()).toEqual({
      createdAt: 100,
      endedAt: 200,
      status: 'ended',
    });
  });

  it('returns new participant timelines for lifecycle changes', () => {
    const original = CallParticipantTimeline.fromPrimitives({});
    const joined = original.join(new Timestamp(100));

    expect(original.toPrimitives()).toEqual({});
    expect(joined.toPrimitives()).toEqual({ joinedAt: 100 });
  });

  it('hydrates scopes from their serialized contracts', () => {
    const scope = CallScope.fromPrimitives({
      channelId: 'channel-a',
      communityId: 'community-a',
      type: 'community_channel',
    });

    expect(scope.toPrimitives()).toEqual({
      channelId: 'channel-a',
      communityId: 'community-a',
      type: 'community_channel',
    });
  });
});

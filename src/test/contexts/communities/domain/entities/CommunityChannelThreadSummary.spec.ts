import { CommunityChannelThreadSummary } from '../../../../../contexts/communities/domain/entities/CommunityChannelThreadSummary';

describe(CommunityChannelThreadSummary.name, () => {
  it('restores and serializes a channel thread summary', () => {
    const primitives = {
      lastReplyAt: 300,
      lastReplyMessageId: 'reply-a',
      replyCount: 2,
      rootMessageId: 'root-a',
    };

    expect(
      CommunityChannelThreadSummary.fromPrimitives(primitives).toPrimitives(),
    ).toEqual(primitives);
  });
});

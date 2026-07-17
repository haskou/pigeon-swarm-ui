import { CommunityThreadReplyCountNegativeError } from '../../../../../contexts/communities/domain/errors/CommunityThreadReplyCountNegativeError';
import { CommunityThreadReplyCount } from '../../../../../contexts/communities/domain/value-objects/CommunityThreadReplyCount';

describe(CommunityThreadReplyCount.name, () => {
  it('rejects a negative reply count', () => {
    expect(() => CommunityThreadReplyCount.fromNumber(-1)).toThrow(
      CommunityThreadReplyCountNegativeError,
    );
  });
});

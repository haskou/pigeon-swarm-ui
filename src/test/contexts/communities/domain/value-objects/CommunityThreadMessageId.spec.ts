import { CommunityThreadMessageIdRequiredError } from '../../../../../contexts/communities/domain/errors/CommunityThreadMessageIdRequiredError';
import { CommunityThreadMessageId } from '../../../../../contexts/communities/domain/value-objects/CommunityThreadMessageId';

describe(CommunityThreadMessageId.name, () => {
  it('rejects an empty message id', () => {
    expect(() => CommunityThreadMessageId.fromString(' ')).toThrow(
      CommunityThreadMessageIdRequiredError,
    );
  });
});

import { ConversationType } from '../../../../contexts/conversations/domain/value-objects/ConversationType';
import { GroupMailboxEligibility } from '../../../../contexts/mailboxes/domain/GroupMailboxEligibility';

describe(GroupMailboxEligibility.name, () => {
  it('accepts a group conversation', () => {
    expect(
      GroupMailboxEligibility.isEligible(
        ConversationType.tryFromPrimitives('group'),
      ),
    ).toBe(true);
  });

  it('rejects a one-to-one conversation', () => {
    expect(
      GroupMailboxEligibility.isEligible(
        ConversationType.tryFromPrimitives('one-to-one'),
      ),
    ).toBe(false);
  });

  it('rejects an unknown conversation type', () => {
    expect(
      GroupMailboxEligibility.isEligible(
        ConversationType.tryFromPrimitives('community-voice'),
      ),
    ).toBe(false);
  });
});

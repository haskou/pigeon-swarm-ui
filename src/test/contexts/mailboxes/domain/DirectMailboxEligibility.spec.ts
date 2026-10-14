import { ConversationType } from '../../../../contexts/conversations/domain/value-objects/ConversationType';
import { DirectMailboxEligibility } from '../../../../contexts/mailboxes/domain/DirectMailboxEligibility';

describe(DirectMailboxEligibility.name, () => {
  it('accepts a one-to-one conversation', () => {
    expect(
      DirectMailboxEligibility.isEligible(
        ConversationType.tryFromPrimitives('one-to-one'),
      ),
    ).toBe(true);
  });

  it('rejects a group conversation', () => {
    expect(
      DirectMailboxEligibility.isEligible(
        ConversationType.tryFromPrimitives('group'),
      ),
    ).toBe(false);
  });

  it('rejects an unknown conversation type', () => {
    expect(
      DirectMailboxEligibility.isEligible(
        ConversationType.tryFromPrimitives('community-voice'),
      ),
    ).toBe(false);
  });
});

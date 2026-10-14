import { GroupMailboxEligibility } from '../../../../contexts/mailboxes/domain/GroupMailboxEligibility';

describe(GroupMailboxEligibility.name, () => {
  it('accepts a group conversation', () => {
    expect(GroupMailboxEligibility.isEligible('group')).toBe(true);
  });

  it('rejects a one-to-one conversation', () => {
    expect(GroupMailboxEligibility.isEligible('one-to-one')).toBe(false);
  });

  it('rejects an unknown conversation type', () => {
    expect(GroupMailboxEligibility.isEligible('community-voice')).toBe(false);
  });
});

import { DirectMailboxEligibility } from '../../../../contexts/mailboxes/domain/DirectMailboxEligibility';

describe(DirectMailboxEligibility.name, () => {
  it('accepts a one-to-one conversation', () => {
    expect(DirectMailboxEligibility.isEligible('one-to-one')).toBe(true);
  });

  it('rejects a group conversation', () => {
    expect(DirectMailboxEligibility.isEligible('group')).toBe(false);
  });

  it('rejects an unknown conversation type', () => {
    expect(DirectMailboxEligibility.isEligible('community-voice')).toBe(false);
  });
});

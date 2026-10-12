import { MailboxCreationDifficultyPolicy } from '../../../../contexts/mailboxes/domain/MailboxCreationDifficultyPolicy';

describe(MailboxCreationDifficultyPolicy.name, () => {
  const defaultBits = 16;

  it('does not re-mine at the default difficulty or below it', () => {
    expect(
      MailboxCreationDifficultyPolicy.allowsRaisedDifficulty(defaultBits, 16),
    ).toBe(false);
    expect(
      MailboxCreationDifficultyPolicy.allowsRaisedDifficulty(defaultBits, 15),
    ).toBe(false);
  });

  it('re-mines when the node names a difficulty above the default, up to the ceiling', () => {
    expect(
      MailboxCreationDifficultyPolicy.allowsRaisedDifficulty(defaultBits, 17),
    ).toBe(true);
    expect(
      MailboxCreationDifficultyPolicy.allowsRaisedDifficulty(defaultBits, 24),
    ).toBe(true);
  });

  it('does not re-mine above the ceiling', () => {
    expect(
      MailboxCreationDifficultyPolicy.allowsRaisedDifficulty(defaultBits, 25),
    ).toBe(false);
  });
});

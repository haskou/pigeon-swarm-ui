/**
 * The node refused a mailbox creation proof and named the difficulty it
 * requires. Carries that value so the caller can mine once more.
 */
export class MailboxCreationDifficultyError extends Error {
  public constructor(public readonly requiredDifficultyBits: number) {
    super(
      `Mailbox creation requires ${requiredDifficultyBits} difficulty bits`,
    );
    this.name = MailboxCreationDifficultyError.name;
  }
}

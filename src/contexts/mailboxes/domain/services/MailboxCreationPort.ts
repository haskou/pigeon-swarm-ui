/** Creates one inbox with a proof-of-work mined at the given difficulty. */
export interface MailboxCreationPort {
  createWithDifficulty(difficultyBits: number): Promise<void>;
}

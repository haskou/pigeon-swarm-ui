import type { MailboxCreationPort } from './MailboxCreationPort';

import { MailboxCreationDifficultyError } from '../errors/MailboxCreationDifficultyError';
import { MailboxCreationDifficultyPolicy } from '../MailboxCreationDifficultyPolicy';

/**
 * Negotiates inbox creation. The first attempt uses the default difficulty.
 * When the node names a higher difficulty that the policy allows, the inbox
 * is created once more at that value. Any other failure is rethrown.
 */
export class MailboxCreationDomainService {
  public static async create(
    port: MailboxCreationPort,
    defaultDifficultyBits: number,
  ): Promise<void> {
    try {
      await port.createWithDifficulty(defaultDifficultyBits);
    } catch (error: unknown) {
      if (
        !(error instanceof MailboxCreationDifficultyError) ||
        !MailboxCreationDifficultyPolicy.allowsRaisedDifficulty(
          defaultDifficultyBits,
          error.requiredDifficultyBits,
        )
      ) {
        throw error;
      }

      await port.createWithDifficulty(error.requiredDifficultyBits);
    }
  }
}

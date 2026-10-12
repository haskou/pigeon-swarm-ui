import { MailboxHomeBase } from '../../../../shared/infrastructure/client/MailboxHomeBase';
import { PrivateBlobReplicaPolicy } from '../../domain/PrivateBlobReplicaPolicy';

export class PrivateBlobReplicaPlanner {
  public constructor(
    private readonly homes: {
      home(): string | undefined;
      verifiedRecipientHome(identityId: string): Promise<string | undefined>;
    },
  ) {}

  /**
   * Plans the replica origins for a private blob: the sender's home first, then
   * the verified recipient home. Origins that fail the canonical check and
   * duplicates are dropped.
   */
  public async plan(recipientIdentityId?: string): Promise<string[]> {
    let recipientHome: string | undefined;

    if (recipientIdentityId !== undefined) {
      try {
        recipientHome =
          await this.homes.verifiedRecipientHome(recipientIdentityId);
      } catch {
        // An unverifiable recipient contributes no origin.
      }
    }

    return PrivateBlobReplicaPolicy.plannedOrigins([
      MailboxHomeBase.parse(this.homes.home()),
      MailboxHomeBase.parse(recipientHome),
    ]);
  }
}

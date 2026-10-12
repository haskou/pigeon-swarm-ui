import { MailboxHomeBase } from '../../../../shared/infrastructure/client/MailboxHomeBase';

export class PrivateBlobReplicaPlanner {
  private static readonly maximumOrigins = 3;

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

    const origins = [
      MailboxHomeBase.parse(this.homes.home()),
      MailboxHomeBase.parse(recipientHome),
    ].filter((origin): origin is string => origin !== undefined);

    return [...new Set(origins)].slice(
      0,
      PrivateBlobReplicaPlanner.maximumOrigins,
    );
  }
}

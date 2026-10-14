import type { ConversationType } from '../../conversations/domain/value-objects/ConversationType';

/** Only group conversations travel through the MLS group mailboxes. */
export class GroupMailboxEligibility {
  /** An unknown conversation type is not eligible. */
  public static isEligible(
    conversationType: ConversationType | undefined,
  ): boolean {
    return conversationType?.isGroup() ?? false;
  }
}

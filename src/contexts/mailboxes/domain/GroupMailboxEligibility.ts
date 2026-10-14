import { ConversationType } from '../../conversations/domain/value-objects/ConversationType';

/** Only group conversations travel through the MLS group mailboxes. */
export class GroupMailboxEligibility {
  /** An unknown conversation type is not eligible. */
  public static isEligible(conversationType: string): boolean {
    const type = ConversationType.tryFromPrimitives(conversationType);

    return type?.isGroup() ?? false;
  }
}

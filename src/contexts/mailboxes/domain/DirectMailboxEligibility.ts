import { ConversationType } from '../../conversations/domain/value-objects/ConversationType';

/** Only one-to-one conversations travel through the direct mailbox. */
export class DirectMailboxEligibility {
  /** An unknown conversation type is not eligible. */
  public static isEligible(conversationType: string): boolean {
    return (
      ConversationType.tryFromPrimitives(conversationType)?.isOneToOne() ?? false
    );
  }
}

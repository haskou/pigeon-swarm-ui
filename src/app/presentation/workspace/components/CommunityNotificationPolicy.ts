import { IdentityMatch } from '../../../../contexts/identities/domain/IdentityMatch';

/** Whether a realtime community message raises a notification. */
export class CommunityNotificationPolicy {
  /**
   * Suppressed in the open channel, when settings disallow it, and for this
   * identity's own messages in either id form.
   */
  public static isSuppressed(
    active: boolean,
    allowed: boolean,
    authorIdentityId: string | undefined,
    currentIdentityId: string,
  ): boolean {
    return (
      active ||
      !allowed ||
      IdentityMatch.isSame(authorIdentityId, currentIdentityId)
    );
  }
}

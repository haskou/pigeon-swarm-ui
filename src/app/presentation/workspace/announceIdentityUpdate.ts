import type { ConversationResource } from '../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { Session } from '../../../contexts/identities/infrastructure/session/Session';

import { ConversationType } from '../../../contexts/conversations/domain/value-objects/ConversationType';
import { GroupMailboxEligibility } from '../../../contexts/mailboxes/domain/GroupMailboxEligibility';
import { applicationContainer } from '../../composition/applicationContainer';

/**
 * Tells every group conversation that this identity updated its profile, as
 * an MLS record through the group mailboxes, so the members fetch it again.
 * The node tells no group co-member. Each announcement is ephemeral and best
 * effort: one failing group leaves the others announced.
 */
export function announceIdentityUpdate(
  session: Session,
  conversations: readonly ConversationResource[],
): void {
  for (const conversation of conversations) {
    if (
      GroupMailboxEligibility.isEligible(
        ConversationType.tryFromPrimitives(conversation.type),
      )
    ) {
      void applicationContainer.groupMessages
        .identityUpdated(session, conversation.id)
        .catch(() => undefined);
    }
  }
}

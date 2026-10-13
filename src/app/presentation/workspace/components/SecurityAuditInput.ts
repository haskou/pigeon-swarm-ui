import type { CommunityResource as Community } from '../../../../contexts/communities/infrastructure/http/resources/CommunityResource';
import type { MlsGroupCredentials } from '../../../../contexts/communities/infrastructure/mls/MlsGroupCredentials';
import type { ConversationResource } from '../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { ContactPins } from '../../../../contexts/identities/domain/ContactPins';
import type { IdentityResource } from '../../../../contexts/identities/infrastructure/http/resources/IdentityResource';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';
import type { IdentityNames } from '../../../../contexts/identities/presentation/view-models/identityDisplay';
import type { DirectMessageOutboxItem } from '../../../../contexts/messages/infrastructure/mailbox/DirectMessageOutboxItem';

export type SecurityAuditInput = {
  communities: Community[];
  conversations: ConversationResource[];
  /** Device credentials of the catalog; `null` while they load. */
  devices: string[] | null;
  groups: Record<string, MlsGroupCredentials>;
  identityNames: IdentityNames;
  identityProfiles: Record<string, IdentityResource>;
  mailboxId: (
    conversationId: string,
    recipientIdentityId: string,
  ) => string | null;
  outbox: DirectMessageOutboxItem[];
  pins: ContactPins;
  sealedRootGeneration: number | null;
  session: Session;
};

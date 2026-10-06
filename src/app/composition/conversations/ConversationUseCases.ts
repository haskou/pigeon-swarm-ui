import type { ConversationCreator } from '../../../contexts/conversations/application/create-conversation/ConversationCreator';
import type { GroupConversationCreator } from '../../../contexts/conversations/application/create-group-conversation/GroupConversationCreator';
import type { ConversationAdminDemoter } from '../../../contexts/conversations/application/demote-conversation-admin/ConversationAdminDemoter';
import type { ConversationParticipantInviter } from '../../../contexts/conversations/application/invite-to-group-conversation/ConversationParticipantInviter';
import type { ConversationLeaver } from '../../../contexts/conversations/application/leave-conversation/ConversationLeaver';
import type { ConversationReadMarker } from '../../../contexts/conversations/application/mark-conversation-read-until/ConversationReadMarker';
import type { ConversationAdminPromoter } from '../../../contexts/conversations/application/promote-conversation-admin/ConversationAdminPromoter';
import type { ConversationParticipantRemover } from '../../../contexts/conversations/application/remove-conversation-participant/ConversationParticipantRemover';
import type { ConversationsSearcher } from '../../../contexts/conversations/application/search-conversations/ConversationsSearcher';

export interface ConversationUseCases {
  adminDemoter: ConversationAdminDemoter;
  adminPromoter: ConversationAdminPromoter;
  creator: ConversationCreator;
  groupCreator: GroupConversationCreator;
  leaver: ConversationLeaver;
  participantInviter: ConversationParticipantInviter;
  participantRemover: ConversationParticipantRemover;
  readMarker: ConversationReadMarker;
  searcher: ConversationsSearcher;
}

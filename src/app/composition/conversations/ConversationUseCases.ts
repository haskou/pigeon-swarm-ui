import type { ConversationCreator } from '../../../contexts/conversations/application/create-conversation/ConversationCreator';
import type { GroupConversationCreator } from '../../../contexts/conversations/application/create-group-conversation/GroupConversationCreator';
import type { ConversationParticipantInviter } from '../../../contexts/conversations/application/invite-to-group-conversation/ConversationParticipantInviter';
import type { ConversationReadMarker } from '../../../contexts/conversations/application/mark-conversation-read-until/ConversationReadMarker';
import type { ConversationsSearcher } from '../../../contexts/conversations/application/search-conversations/ConversationsSearcher';

export interface ConversationUseCases {
  creator: ConversationCreator;
  groupCreator: GroupConversationCreator;
  participantInviter: ConversationParticipantInviter;
  readMarker: ConversationReadMarker;
  searcher: ConversationsSearcher;
}

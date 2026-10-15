import type { ConversationCreator } from '../../../contexts/conversations/application/create-conversation/ConversationCreator';
import type { ConversationReadMarker } from '../../../contexts/conversations/application/mark-conversation-read-until/ConversationReadMarker';
import type { ConversationsSearcher } from '../../../contexts/conversations/application/search-conversations/ConversationsSearcher';

export interface ConversationUseCases {
  creator: ConversationCreator;
  readMarker: ConversationReadMarker;
  searcher: ConversationsSearcher;
}

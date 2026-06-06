import type { ConversationResource } from '../../conversations/domain/conversationResources.types';
import type { Session } from './Session';

export type LoginResult = {
  conversations: ConversationResource[];
  session: Session;
};

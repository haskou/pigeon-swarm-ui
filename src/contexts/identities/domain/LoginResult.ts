import type { ConversationResource } from '../../conversations/infrastructure/http/ConversationResource';
import type { Session } from './Session';

export type LoginResult = {
  conversations: ConversationResource[];
  session: Session;
};

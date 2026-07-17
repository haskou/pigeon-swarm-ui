import type { ConversationResource } from '../../../../conversations/infrastructure/http/ConversationResource';
import type { Session } from '../../session/Session';

export type LoginResult = {
  conversations: ConversationResource[];
  session: Session;
};

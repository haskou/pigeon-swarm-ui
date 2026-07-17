import type { ConversationResource } from '../../../../conversations/infrastructure/http/ConversationResource';
import type { Session } from '../../../domain/Session';

export type LoginResult = {
  conversations: ConversationResource[];
  session: Session;
};

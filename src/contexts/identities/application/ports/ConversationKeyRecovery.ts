import type {
  ConversationResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export interface ConversationKeyRecovery {
  recover(session: Session, conversations: ConversationResource[]): Session;
}

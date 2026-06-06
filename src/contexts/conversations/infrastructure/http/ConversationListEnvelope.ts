import type { ConversationResource } from '../../../../shared/domain/pigeonResources.types';

export type ConversationListEnvelope = {
  conversations?: ConversationResource[];
  data?: ConversationResource[];
  items?: ConversationResource[];
};

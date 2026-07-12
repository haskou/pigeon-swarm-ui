import type { ConversationDraftResource } from '../infrastructure/http/ConversationDraftResource';

export type ConversationDraft = ConversationDraftResource & {
  content: string;
};

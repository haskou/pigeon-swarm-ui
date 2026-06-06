import type { ConversationDraftResource } from './ConversationDraftResource';

export type ConversationDraft = ConversationDraftResource & {
  content: string;
};

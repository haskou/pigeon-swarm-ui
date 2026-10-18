import type { ConversationDraftResource } from './ConversationDraftResource';

export type ConversationDraftsResource = {
  drafts: ConversationDraftResource[];
  nextCursor: string | null;
};

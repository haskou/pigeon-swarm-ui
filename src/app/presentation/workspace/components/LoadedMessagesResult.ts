import type { ChatMessage } from '../../../../shared/domain/pigeonResources.types';

export type LoadedMessagesResult = {
  messages: ChatMessage[];
  nextCursor?: null | string;
};

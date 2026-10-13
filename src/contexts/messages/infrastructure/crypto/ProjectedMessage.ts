import type { ChatMessage } from '../../presentation/view-models/ChatMessage';

/**
 * A message as the projection built it, with whether its payload could be
 * read. `readable` is false only for a missing conversation key or a failed
 * decrypt; the message is then a placeholder.
 */
export type ProjectedMessage = {
  message: ChatMessage;
  readable: boolean;
};

import type { GroupMailboxOutboxCopy } from './GroupMailboxOutboxCopy';

/**
 * One group record not yet appended to every recipient's inbox of
 * generation `generationIndex`. `id` is random and never leaves the device:
 * it seeds the envelope ids of a message, so no recipient can derive the id
 * of another one's copy. `body` is the application plaintext of a message,
 * kept so that a copy stranded by a generation change is re-encrypted; a
 * commit has none. Binary fields are base64url.
 */
export type GroupMailboxOutboxRow = {
  readonly attempts: number;
  readonly body?: string;
  readonly conversationId: string;
  readonly copies: readonly GroupMailboxOutboxCopy[];
  readonly createdAt: number;
  readonly generationIndex: number;
  readonly id: string;
  readonly record: string;
  readonly reference: string;
  readonly retryAt: number;
};

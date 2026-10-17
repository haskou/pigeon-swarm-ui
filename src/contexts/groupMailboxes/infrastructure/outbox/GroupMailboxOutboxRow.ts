import type { GroupMailboxOutboxCopy } from './GroupMailboxOutboxCopy';
import type { GroupMailboxOutboxLanding } from './GroupMailboxOutboxLanding';

/**
 * One group record whose `copies` are not yet appended to their recipients'
 * inboxes of generation `generationIndex`, the one whose secret has the
 * fingerprint `generation`: a rival commit that wins an epoch back makes
 * another generation of the same index. `landed` lists the copies of a
 * message that a rival commit could still strand; a row with no copy left
 * is kept for them only. `id` is random and never leaves the device: it
 * seeds the envelope ids of a message, so no recipient can derive the id
 * of another one's copy. `body` is the application plaintext of a message,
 * kept so that a copy stranded by a generation change is re-encrypted; a
 * commit has none and lands nothing. `failed` marks a message given up on:
 * it keeps its body and pending recipients and is never sent again until
 * an explicit retry. Binary fields are base64url.
 */
export type GroupMailboxOutboxRow = {
  readonly attempts: number;
  readonly body?: string;
  readonly conversationId: string;
  readonly copies: readonly GroupMailboxOutboxCopy[];
  readonly createdAt: number;
  readonly failed?: true;
  readonly generation: string;
  readonly generationIndex: number;
  readonly id: string;
  readonly landed: readonly GroupMailboxOutboxLanding[];
  readonly record: string;
  readonly reference: string;
  readonly retryAt: number;
};

import type { DirectRecordBase } from './DirectRecordBase';

/** Read receipt for this identity. Sent only to its own inbox. */
export type DirectReadRecord = DirectRecordBase & {
  targetMessageId: string;
  type: 'read';
};

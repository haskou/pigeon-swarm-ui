import type { DirectRecordBase } from './DirectRecordBase';

/** Replaces the content of an earlier sent message. */
export type DirectEditedRecord = DirectRecordBase & {
  encryptedPayload: string;
  previousMessageIds: string[];
  targetMessageId: string;
  type: 'edited';
};

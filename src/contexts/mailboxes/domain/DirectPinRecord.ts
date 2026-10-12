import type { DirectRecordBase } from './DirectRecordBase';

/** Pin or unpin of a message. Applied last-writer-wins by createdAt. */
export type DirectPinRecord = DirectRecordBase & {
  action: 'pin' | 'unpin';
  targetMessageId: string;
  type: 'pin';
};

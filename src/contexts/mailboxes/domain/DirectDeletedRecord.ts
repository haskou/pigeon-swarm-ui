import type { DirectRecordBase } from './DirectRecordBase';

export type DirectDeletedRecord = DirectRecordBase & {
  targetMessageId: string;
  type: 'deleted';
};

import type { DirectRecordBase } from './DirectRecordBase';

export type DirectReactionRecord = DirectRecordBase & {
  action: 'add' | 'remove';
  emoji: string;
  targetMessageId: string;
  type: 'reaction';
};

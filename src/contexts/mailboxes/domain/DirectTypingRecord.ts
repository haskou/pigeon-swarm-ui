import type { DirectRecordBase } from './DirectRecordBase';

/**
 * Tells a group that its author is typing. Ephemeral: sent at most once per
 * 10 seconds, never stored, never retried.
 */
export type DirectTypingRecord = DirectRecordBase & {
  type: 'typing';
};

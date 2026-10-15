import type { DirectRecordBase } from './DirectRecordBase';

/**
 * Tells a group that its author updated its identity, so the members fetch
 * it again. Ephemeral: never stored, never retried.
 */
export type DirectIdentityUpdatedRecord = DirectRecordBase & {
  type: 'identity_updated';
};

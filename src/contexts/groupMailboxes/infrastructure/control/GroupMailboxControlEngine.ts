import type { GroupMailboxMlsEngine } from '../mls/GroupMailboxMlsEngine';

/** The engine operations control traffic drives. */
export type GroupMailboxControlEngine = Pick<
  GroupMailboxMlsEngine,
  | 'add'
  | 'applyCommit'
  | 'createKeyPackage'
  | 'devices'
  | 'join'
  | 'remove'
  | 'removeDevices'
>;

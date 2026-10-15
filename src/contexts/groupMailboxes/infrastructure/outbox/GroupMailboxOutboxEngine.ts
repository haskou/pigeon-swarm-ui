import type { GroupMailboxMlsEngine } from '../mls/GroupMailboxMlsEngine';

export type GroupMailboxOutboxEngine = Pick<
  GroupMailboxMlsEngine,
  | 'awaitsConfirmation'
  | 'encrypt'
  | 'generation'
  | 'members'
  | 'readableGenerations'
>;

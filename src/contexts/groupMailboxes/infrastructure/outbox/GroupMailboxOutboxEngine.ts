import type { GroupMailboxMlsEngine } from '../mls/GroupMailboxMlsEngine';

export type GroupMailboxOutboxEngine = Pick<
  GroupMailboxMlsEngine,
  'encrypt' | 'generation' | 'members' | 'readableGenerations'
>;

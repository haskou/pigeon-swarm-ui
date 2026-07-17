import type { PresenceStatusResource } from './PresenceStatusResource';

export type SelectablePresenceStatusResource = Exclude<
  PresenceStatusResource,
  'disconnected'
>;

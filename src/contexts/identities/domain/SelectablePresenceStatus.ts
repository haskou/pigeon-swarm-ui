import type { PresenceStatus } from './PresenceStatus';

export type SelectablePresenceStatus = Exclude<PresenceStatus, 'disconnected'>;

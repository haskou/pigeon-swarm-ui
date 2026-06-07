import type { PresenceStatus } from './PresenceStatus';

export type IdentityPresence = {
  identityId: string;
  lastActivityAt?: number;
  lastHeartbeatAt?: number;
  networkIds?: string[];
  status: PresenceStatus;
  updatedAt: number;
};

import type { PresenceStatusResource } from './PresenceStatusResource';

export type IdentityPresenceResource = {
  identityId: string;
  lastActivityAt?: number;
  lastHeartbeatAt?: number;
  networkIds?: string[];
  status: PresenceStatusResource;
  updatedAt: number;
};

import type { CommunityVisibility } from '../../../shared/domain/pigeonResources.types';

export type CreateCommunityInput = {
  autoJoinEnabled?: boolean | undefined;
  avatar?: File | null;
  banner?: File | null;
  channels?: Array<{ name: string; type: 'text' | 'voice' }>;
  description: string;
  discoverable?: boolean | undefined;
  name: string;
  networkId: string;
  visibility?: CommunityVisibility;
};

import type { CommunityVisibilityResource as CommunityVisibility } from '../../../../contexts/communities/infrastructure/http/resources/CommunityVisibilityResource';

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

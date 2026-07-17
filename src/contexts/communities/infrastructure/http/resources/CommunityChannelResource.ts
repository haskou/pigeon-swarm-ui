import type { CommunityTextChannelResource } from './CommunityTextChannelResource';
import type { CommunityVoiceChannelResource } from './CommunityVoiceChannelResource';

export type CommunityChannelResource =
  | CommunityTextChannelResource
  | CommunityVoiceChannelResource;

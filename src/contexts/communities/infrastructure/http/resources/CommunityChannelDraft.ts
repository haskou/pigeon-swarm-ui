import type { CommunityChannelDraftResource } from '../../../../messages/infrastructure/http/CommunityChannelDraftResource';

export type CommunityChannelDraft = CommunityChannelDraftResource & {
  content: string;
};

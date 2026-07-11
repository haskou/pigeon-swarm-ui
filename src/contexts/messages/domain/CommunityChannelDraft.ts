import type { CommunityChannelDraftResource } from '../infrastructure/http/CommunityChannelDraftResource';

export type CommunityChannelDraft = CommunityChannelDraftResource & {
  content: string;
};

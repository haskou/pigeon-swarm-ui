import type { CommunityMessageMentionResource as CommunityMessageMention } from '../../../communities/infrastructure/http/resources/CommunityMessageMentionResource';
import type {
  PollOption,
  PollResource,
  PollScope,
  PollVote,
} from '../../../polls/domain/pollResources.types';
import type { MessageReaction } from './MessageReaction';

export type MessageResource = {
  actorIdentityId?: string;
  allowsMultipleVotes?: boolean;
  authorId?: string;
  authorIdentityId?: string;
  callEventType?: 'declined' | 'ended' | 'missed';
  callId?: string;
  channelId?: string;
  communityId?: string;
  content?: string;
  conversationId?: string;
  createdAt?: number;
  creatorIdentityId?: string;
  durationMs?: number;
  encryptedPayload?: string;
  editedAt?: number;
  expiresAt?: number;
  id?: string;
  mentions?: CommunityMessageMention[];
  messageId?: string;
  options?: PollOption[];
  payload?: string;
  plaintextPayload?: string;
  poll?: PollResource;
  pollId?: string;
  pinnedByIdentityId?: string;
  previousMessageIds?: string[];
  question?: string;
  reactions?: MessageReaction[];
  replyToMessageId?: string;
  scope?: PollScope;
  signature?: string;
  status?: 'closed' | 'open';
  targetMessageId?: string;
  timestamp?: number;
  type?: string;
  votes?: PollVote[];
};

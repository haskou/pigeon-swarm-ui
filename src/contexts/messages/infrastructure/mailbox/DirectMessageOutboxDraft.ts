import type { DirectSentRecord } from '../../../mailboxes/domain/DirectSentRecord';

export type DirectMessageOutboxDraft = {
  conversationId: string;
  peerIdentityId: string;
  record: DirectSentRecord;
};

import type { DirectSentRecord } from '../../../mailboxes/domain/DirectSentRecord';

/**
 * A one-to-one send that is not yet written to both inboxes. The record is the
 * built wire record, so a resume never uploads attachments again.
 */
export type DirectMessageOutboxRow = {
  conversationId: string;
  id: string;
  peerDelivered: boolean;
  peerIdentityId: string;
  record: DirectSentRecord;
  state: 'failed' | 'pending';
};

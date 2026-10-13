import type { DirectSentRecord } from '../../../mailboxes/domain/DirectSentRecord';
import type { DirectMessageOutboxState } from './DirectMessageOutboxState';

export type DirectMessageOutboxItem = {
  conversationId: string;
  id: string;
  record: DirectSentRecord;
  state: DirectMessageOutboxState;
};

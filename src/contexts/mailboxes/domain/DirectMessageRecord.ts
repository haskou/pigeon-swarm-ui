import type { DirectDeletedRecord } from './DirectDeletedRecord';
import type { DirectEditedRecord } from './DirectEditedRecord';
import type { DirectIdentityUpdatedRecord } from './DirectIdentityUpdatedRecord';
import type { DirectPinRecord } from './DirectPinRecord';
import type { DirectPollCloseRecord } from './DirectPollCloseRecord';
import type { DirectPollRecord } from './DirectPollRecord';
import type { DirectPollVoteRecord } from './DirectPollVoteRecord';
import type { DirectReactionRecord } from './DirectReactionRecord';
import type { DirectReadRecord } from './DirectReadRecord';
import type { DirectSentRecord } from './DirectSentRecord';
import type { DirectTypingRecord } from './DirectTypingRecord';

export type DirectMessageRecord =
  | DirectDeletedRecord
  | DirectEditedRecord
  | DirectIdentityUpdatedRecord
  | DirectPinRecord
  | DirectPollCloseRecord
  | DirectPollRecord
  | DirectPollVoteRecord
  | DirectReactionRecord
  | DirectReadRecord
  | DirectSentRecord
  | DirectTypingRecord;

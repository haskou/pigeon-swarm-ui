import type { DirectDeletedRecord } from './DirectDeletedRecord';
import type { DirectEditedRecord } from './DirectEditedRecord';
import type { DirectPinRecord } from './DirectPinRecord';
import type { DirectReactionRecord } from './DirectReactionRecord';
import type { DirectReadRecord } from './DirectReadRecord';
import type { DirectSentRecord } from './DirectSentRecord';

export type DirectMessageRecord =
  | DirectDeletedRecord
  | DirectEditedRecord
  | DirectPinRecord
  | DirectReactionRecord
  | DirectReadRecord
  | DirectSentRecord;

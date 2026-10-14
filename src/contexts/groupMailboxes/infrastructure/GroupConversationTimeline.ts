import type { Session } from '../../identities/infrastructure/session/Session';
import type { DirectEditedRecord } from '../../mailboxes/domain/DirectEditedRecord';
import type { DirectMessageRecord } from '../../mailboxes/domain/DirectMessageRecord';
import type { DirectSentRecord } from '../../mailboxes/domain/DirectSentRecord';
import type { MessageProjector } from '../../messages/infrastructure/crypto/MessageProjector';
import type { DirectMessageTimelineChange } from '../../messages/presentation/view-models/DirectMessageTimelineChange';

import { DirectMailboxRecords } from '../../mailboxes/domain/DirectMailboxRecords';
import { DirectMessageMailboxRecord } from '../../messages/infrastructure/mailbox/DirectMessageMailboxRecord';

/**
 * Turns accepted group records into timeline changes, in record order. The
 * inbox already checked who may write each record; a message whose payload
 * does not read drops only its own change. Read receipts never travel in a
 * group.
 */
export class GroupConversationTimeline {
  public constructor(
    private readonly projector: Pick<MessageProjector, 'projectPlaintext'>,
  ) {}

  private message(
    session: Session,
    record: DirectEditedRecord | DirectSentRecord,
  ): DirectMessageTimelineChange[] {
    const { message, readable } = this.projector.projectPlaintext(
      session,
      DirectMessageMailboxRecord.toResource(record),
    );

    if (!readable) return [];

    return [
      record.type === DirectMailboxRecords.TYPE.sent
        ? { kind: 'message', message }
        : { kind: 'edit', message },
    ];
  }

  public changes(
    session: Session,
    records: DirectMessageRecord[],
  ): DirectMessageTimelineChange[] {
    return records.flatMap((record): DirectMessageTimelineChange[] => {
      switch (record.type) {
        case DirectMailboxRecords.TYPE.sent:
        case DirectMailboxRecords.TYPE.edited:
          return this.message(session, record);
        case DirectMailboxRecords.TYPE.deleted:
          return [{ kind: 'removed', messageId: record.targetMessageId }];
        case DirectMailboxRecords.TYPE.reaction:
          return [
            {
              action: record.action,
              authorId: record.authorId,
              createdAt: record.createdAt,
              emoji: record.emoji,
              kind: 'reaction',
              messageId: record.targetMessageId,
            },
          ];
        case DirectMailboxRecords.TYPE.pin:
          return [
            {
              action: record.action,
              createdAt: record.createdAt,
              kind: 'pin',
              messageId: record.targetMessageId,
            },
          ];
        case DirectMailboxRecords.TYPE.read:
          return [];
      }
    });
  }
}

import type { Session } from '../../identities/infrastructure/session/Session';
import type { DirectEditedRecord } from '../../mailboxes/domain/DirectEditedRecord';
import type { DirectMessageRecord } from '../../mailboxes/domain/DirectMessageRecord';
import type { DirectPollCloseRecord } from '../../mailboxes/domain/DirectPollCloseRecord';
import type { DirectPollRecord } from '../../mailboxes/domain/DirectPollRecord';
import type { DirectPollVoteRecord } from '../../mailboxes/domain/DirectPollVoteRecord';
import type { DirectSentRecord } from '../../mailboxes/domain/DirectSentRecord';
import type { DirectMessageTimelineChange } from '../../messages/domain/DirectMessageTimelineChange';
import type { MessageProjector } from '../../messages/infrastructure/crypto/MessageProjector';

import { DirectMailboxRecords } from '../../mailboxes/domain/DirectMailboxRecords';
import { DirectMessageMailboxRecord } from '../../messages/infrastructure/mailbox/DirectMessageMailboxRecord';

/**
 * Turns accepted group records into timeline changes, in record order. The
 * inbox already checked who may write each record; a message whose payload
 * does not read drops only its own change. Polls, votes and closes pass
 * through as they are; the poll board validates and folds them. A typing
 * notice becomes a typing change for its author. Read receipts never travel
 * in a group.
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

  private groupOnlyChanges(
    record: DirectMessageRecord,
  ): DirectMessageTimelineChange[] {
    switch (record.type) {
      case DirectMailboxRecords.TYPE.poll:
        return [this.poll(record)];
      case DirectMailboxRecords.TYPE.pollVote:
        return [this.pollVote(record)];
      case DirectMailboxRecords.TYPE.pollClose:
        return [this.pollClose(record)];
      case DirectMailboxRecords.TYPE.typing:
        return [
          {
            createdAt: record.createdAt,
            identityId: record.authorId,
            kind: 'typing',
          },
        ];
      default:
        return [];
    }
  }

  public poll(
    record: DirectPollRecord,
  ): Extract<DirectMessageTimelineChange, { kind: 'poll' }> {
    return {
      allowsMultipleVotes: record.allowsMultipleVotes,
      createdAt: record.createdAt,
      creatorIdentityId: record.authorId,
      id: record.id,
      kind: 'poll',
      options: record.options,
      question: record.question,
    };
  }

  public pollVote(
    record: DirectPollVoteRecord,
  ): Extract<DirectMessageTimelineChange, { kind: 'poll_vote' }> {
    return {
      createdAt: record.createdAt,
      kind: 'poll_vote',
      optionIds: record.optionIds,
      pollId: record.targetPollId,
      voterIdentityId: record.authorId,
    };
  }

  public pollClose(
    record: DirectPollCloseRecord,
  ): Extract<DirectMessageTimelineChange, { kind: 'poll_close' }> {
    return {
      closerIdentityId: record.authorId,
      createdAt: record.createdAt,
      kind: 'poll_close',
      pollId: record.targetPollId,
    };
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
        default:
          return this.groupOnlyChanges(record);
      }
    });
  }
}

import { Timestamp } from '@haskou/value-objects';

import { ConversationActivity } from '../../../../contexts/conversations/domain/entities/ConversationActivity';
import { ConversationParticipants } from '../../../../contexts/conversations/domain/entities/ConversationParticipants';
import { ConversationIdRequiredError } from '../../../../contexts/conversations/domain/errors/ConversationIdRequiredError';
import { ConversationParticipantAlreadyExistsError } from '../../../../contexts/conversations/domain/errors/ConversationParticipantAlreadyExistsError';
import { ConversationParticipantNotFoundError } from '../../../../contexts/conversations/domain/errors/ConversationParticipantNotFoundError';
import { ConversationUnreadCountInvalidError } from '../../../../contexts/conversations/domain/errors/ConversationUnreadCountInvalidError';
import { GroupConversationNameRequiredError } from '../../../../contexts/conversations/domain/errors/GroupConversationNameRequiredError';
import { ConversationId } from '../../../../contexts/conversations/domain/value-objects/ConversationId';
import { ConversationName } from '../../../../contexts/conversations/domain/value-objects/ConversationName';
import { ConversationParticipantId } from '../../../../contexts/conversations/domain/value-objects/ConversationParticipantId';
import { ConversationPreview } from '../../../../contexts/conversations/domain/value-objects/ConversationPreview';
import { ConversationType } from '../../../../contexts/conversations/domain/value-objects/ConversationType';
import { ConversationUnreadCount } from '../../../../contexts/conversations/domain/value-objects/ConversationUnreadCount';

describe('conversation value objects', () => {
  it('requires a conversation id', () => {
    expect(() => ConversationId.fromString('  ')).toThrow(
      ConversationIdRequiredError,
    );
  });

  it('requires a group name', () => {
    expect(() =>
      ConversationName.fromOptional().assertPresentFor(ConversationType.GROUP),
    ).toThrow(GroupConversationNameRequiredError);
  });

  it('rejects negative unread counts', () => {
    expect(() => ConversationUnreadCount.fromNumber(-1)).toThrow(
      ConversationUnreadCountInvalidError,
    );
  });

  it('enforces participant membership and uniqueness', () => {
    const participants = ConversationParticipants.fromPrimitives([
      'identity-a',
    ]);
    const identityA = ConversationParticipantId.fromString('identity-a');

    expect(() => participants.add(identityA)).toThrow(
      ConversationParticipantAlreadyExistsError,
    );
    expect(() =>
      participants.assertIncludes(
        ConversationParticipantId.fromString('identity-b'),
      ),
    ).toThrow(ConversationParticipantNotFoundError);
  });

  it('keeps the current preview when activity has no new preview', () => {
    const activity = ConversationActivity.fromPrimitives({
      latestMessageAt: 100,
      latestMessagePreview: 'hello',
      unreadCount: 1,
    });

    activity.record(new Timestamp(200));

    expect(activity.toPrimitives()).toEqual({
      latestMessageAt: 200,
      latestMessagePreview: 'hello',
      unreadCount: 1,
    });
    expect(
      activity.record(
        new Timestamp(150),
        ConversationPreview.fromOptional('old'),
      ),
    ).toBe(false);
  });
});

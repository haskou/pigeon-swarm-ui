import type {
  ChatMessage,
  PollResource,
} from '../../../shared/domain/pigeonResources.types';

import { MessageEditPolicy } from './MessageEditPolicy';

describe(MessageEditPolicy.name, () => {
  const editableMessage: ChatMessage = {
    attachments: [],
    authorIdentityId: 'identity-1',
    content: 'Editable text',
    encrypted: false,
    id: 'message-1',
    mine: true,
    raw: { id: 'message-1', type: 'sent' },
    reactions: [],
    timestamp: 1,
  };

  it('allows the message author to edit a delivered text message', () => {
    expect(MessageEditPolicy.canEdit(editableMessage, 'identity-1')).toBe(true);
  });

  it('rejects messages that should not expose text editing', () => {
    expect(MessageEditPolicy.canEdit(editableMessage, 'identity-2')).toBe(
      false,
    );
    expect(
      MessageEditPolicy.canEdit(
        { ...editableMessage, deliveryStatus: 'pending' },
        'identity-1',
      ),
    ).toBe(false);
    expect(
      MessageEditPolicy.canEdit(
        { ...editableMessage, content: '   ' },
        'identity-1',
      ),
    ).toBe(false);
    expect(
      MessageEditPolicy.canEdit(
        { ...editableMessage, poll: { id: 'poll-1' } as PollResource },
        'identity-1',
      ),
    ).toBe(false);
  });
});

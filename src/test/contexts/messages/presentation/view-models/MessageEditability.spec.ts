import type { ChatMessage } from '../../../../../shared/domain/pigeonResources.types';

import { MessageEditability } from '../../../../../contexts/messages/presentation/view-models/MessageEditability';

const message = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  attachments: [],
  authorIdentityId: 'identity-1',
  content: 'Editable text',
  encrypted: false,
  id: 'message-1',
  mine: true,
  raw: { id: 'message-1', type: 'sent' },
  reactions: [],
  timestamp: 1,
  ...overrides,
});

describe(MessageEditability.name, () => {
  it('allows the message author to edit a delivered text message', () => {
    expect(MessageEditability.canEdit(message(), 'identity-1')).toBe(true);
  });

  it('rejects unreadable, special, pending, and blank messages', () => {
    expect(
      MessageEditability.canEdit(message({ encrypted: true }), 'identity-1'),
    ).toBe(false);
    expect(
      MessageEditability.canEdit(message({ kind: 'call-event' }), 'identity-1'),
    ).toBe(false);
    expect(
      MessageEditability.canEdit(
        message({ deliveryStatus: 'pending' }),
        'identity-1',
      ),
    ).toBe(false);
    expect(
      MessageEditability.canEdit(message({ content: '   ' }), 'identity-1'),
    ).toBe(false);
  });
});

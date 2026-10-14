import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { ConversationResource } from '../../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { UnreadMessages } from '../../../../../contexts/messages/presentation/hooks/UnreadMessages';

import { useUnreadMessages } from '../../../../../contexts/messages/presentation/hooks/useUnreadMessages';

/** The hook slots of one mounted component, in call order. */
const mockSlots: unknown[] = [];
let mockSlot = 0;

jest.mock('react', () => ({
  useCallback: <T>(callback: T) => callback,
  useMemo: <T>(factory: () => T) => factory(),
  useRef: (value: unknown) => {
    const slot = mockSlot;

    mockSlot += 1;

    if (!(slot in mockSlots)) mockSlots[slot] = { current: value };

    return mockSlots[slot];
  },
  useState: (initial: unknown) => {
    const slot = mockSlot;

    mockSlot += 1;

    if (!(slot in mockSlots)) mockSlots[slot] = initial;

    return [
      mockSlots[slot],
      (update: unknown) => {
        mockSlots[slot] =
          typeof update === 'function'
            ? (update as (current: unknown) => unknown)(mockSlots[slot])
            : update;
      },
    ];
  },
}));

const conversations = [
  { id: 'peer', latestMessageAt: 20, type: 'one-to-one' },
  { id: 'team', latestMessageAt: 10, type: 'group' },
] as unknown as ConversationResource[];

function render(): UnreadMessages {
  mockSlot = 0;

  return useUnreadMessages(conversations);
}

function unreadOf(conversationId: string): number | undefined {
  return render().conversationsWithUnread.find(
    ({ id }) => id === conversationId,
  )?.unreadCount;
}

describe('useUnreadMessages', () => {
  beforeEach(() => {
    mockSlots.length = 0;
  });

  it('shows the device count of a group beside the marked messages of a peer', () => {
    const { markUnreadMessage, setGroupUnread } = render();

    markUnreadMessage('peer', 'message-1');
    markUnreadMessage('peer', 'message-1');
    setGroupUnread('team', 3);

    expect(unreadOf('peer')).toBe(1);
    expect(unreadOf('team')).toBe(3);
  });

  it('replaces a group count rather than adding to it', () => {
    const { setGroupUnread } = render();

    setGroupUnread('team', 3);
    setGroupUnread('team', 5);

    expect(unreadOf('team')).toBe(5);

    setGroupUnread('team', 0);

    expect(unreadOf('team')).toBe(0);
  });

  it('adds a group count to the marked messages of the same conversation', () => {
    const { markUnreadMessage, setGroupUnread } = render();

    markUnreadMessage('team', 'message-1');
    setGroupUnread('team', 2);

    expect(unreadOf('team')).toBe(3);
  });

  it('clears both counts of an opened conversation, and counts later arrivals again', () => {
    const { clearUnreadMessages, markUnreadMessage, setGroupUnread } = render();

    markUnreadMessage('team', 'message-1');
    setGroupUnread('team', 2);
    clearUnreadMessages('team');

    expect(unreadOf('team')).toBe(0);

    setGroupUnread('team', 1);

    expect(unreadOf('team')).toBe(1);
  });
});

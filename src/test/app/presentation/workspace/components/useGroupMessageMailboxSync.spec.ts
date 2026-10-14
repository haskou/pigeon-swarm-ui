import type { SetStateAction } from 'react';

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import type { ConversationResource } from '../../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { ChatMessage } from '../../../../../contexts/messages/domain/ChatMessage';
import type { DirectMessageTimelineChange } from '../../../../../contexts/messages/domain/DirectMessageTimelineChange';

import { applicationContainer } from '../../../../../app/composition/applicationContainer';
import { useGroupMessageMailboxSync } from '../../../../../app/presentation/workspace/components/useGroupMessageMailboxSync';
import { copy } from '../../../../../shared/presentation/i18n/copy';

type MockEffect = () => void | (() => void);

const mockEffects: MockEffect[] = [];

jest.mock('react', () => ({
  useEffect: (effect: MockEffect) => {
    mockEffects.push(effect);
  },
}));
jest.mock('../../../../../app/composition/applicationContainer', () => ({
  applicationContainer: {
    groupMessages: {
      markRead: jest.fn(),
      restore: jest.fn(),
      sync: jest.fn(),
      withOutboxState: jest.fn(),
    },
  },
}));

const POLL_MS = 5000;
const sync = jest.mocked(applicationContainer.groupMessages.sync);
const restore = jest.mocked(applicationContainer.groupMessages.restore);
const markRead = jest.mocked(applicationContainer.groupMessages.markRead);
const withOutboxState = jest.mocked(
  applicationContainer.groupMessages.withOutboxState,
);
const group = {
  id: 'group-1',
  type: 'group',
} as unknown as ConversationResource;
const session = {} as Session;
const message = {
  attachments: [],
  authorIdentityId: 'bob',
  content: 'hello',
  encrypted: false,
  id: 'group-message-1',
  mine: false,
  raw: { conversationId: 'group-1', id: 'group-message-1', type: 'sent' },
  reactions: [],
  timestamp: 100,
} as unknown as ChatMessage;

async function settle(): Promise<void> {
  for (let tick = 0; tick < 10; tick += 1) {
    await Promise.resolve();
  }
}

function mountSync(activeConversation: ConversationResource = group) {
  let error: null | string = null;
  let messages: ChatMessage[] = [];
  let pinned = new Set<string>();
  const onErrorChange = jest.fn((update: SetStateAction<null | string>) => {
    error = typeof update === 'function' ? update(error) : update;
  });
  const onMessagesChange = jest.fn((update: SetStateAction<ChatMessage[]>) => {
    messages = typeof update === 'function' ? update(messages) : update;
  });
  const onHistoryRestored = jest.fn<(conversationId: string) => void>();
  const setPinnedMessageIds = jest.fn((update: SetStateAction<Set<string>>) => {
    pinned = typeof update === 'function' ? update(pinned) : update;
  });

  const refreshConversations = jest.fn(() => Promise.resolve([]));
  const onPollChanges =
    jest.fn<(changes: DirectMessageTimelineChange[]) => void>();

  mockEffects.length = 0;
  useGroupMessageMailboxSync({
    activeConversation,
    onErrorChange,
    onHistoryRestored,
    onMessagesChange,
    onPollChanges,
    refreshConversations,
    session,
    setPinnedMessageIds,
  });
  const cleanup = mockEffects[0]() as (() => void) | undefined;

  return {
    cleanup: () => cleanup?.(),
    error: () => error,
    messages: () => messages,
    onHistoryRestored,
    onPollChanges,
    pinnedIds: () => pinned,
    refreshConversations,
  };
}

describe('useGroupMessageMailboxSync', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    Reflect.set(globalThis, 'window', {
      clearTimeout: (id: number | undefined) => globalThis.clearTimeout(id),
      setTimeout: (callback: () => void, ms: number) =>
        globalThis.setTimeout(callback, ms),
    });
    restore.mockReset().mockResolvedValue(undefined);
    sync.mockReset().mockResolvedValue({ removed: false });
    markRead.mockReset().mockResolvedValue(undefined);
    withOutboxState
      .mockReset()
      .mockImplementation((_session, _id, messages) => [...messages]);
  });

  afterEach(() => {
    jest.useRealTimers();
    Reflect.deleteProperty(globalThis, 'window');
  });

  it('does not touch the group mailboxes for a one-to-one conversation', async () => {
    const mounted = mountSync({
      ...group,
      type: 'one-to-one',
    } as ConversationResource);

    await settle();

    expect(restore).not.toHaveBeenCalled();
    expect(sync).not.toHaveBeenCalled();
    mounted.cleanup();
  });

  it('restores the stored history, reports it, then syncs', async () => {
    restore.mockImplementationOnce((_session, _id, _signal, apply) => {
      apply([{ kind: 'message', message }]);

      return Promise.resolve();
    });
    const mounted = mountSync();

    await settle();

    expect(mounted.messages()).toEqual([message]);
    expect(mounted.onHistoryRestored).toHaveBeenCalledWith('group-1');
    expect(restore.mock.invocationCallOrder[0]).toBeLessThan(
      sync.mock.invocationCallOrder[0],
    );
    mounted.cleanup();
  });

  it('polls the group inboxes again after each settled pass', async () => {
    const mounted = mountSync();

    await settle();
    jest.advanceTimersByTime(POLL_MS);
    await settle();

    expect(sync).toHaveBeenCalledTimes(2);
    expect(sync).toHaveBeenCalledWith(
      session,
      'group-1',
      expect.any(AbortSignal),
      expect.any(Function),
    );
    mounted.cleanup();
  });

  it('applies synced pins to the pinned set', async () => {
    sync.mockImplementationOnce((_session, _id, _signal, apply) => {
      apply([
        {
          action: 'pin',
          createdAt: 300,
          kind: 'pin',
          messageId: 'group-message-1',
        },
      ]);

      return Promise.resolve({ removed: false });
    });
    const mounted = mountSync();

    await settle();

    expect(mounted.pinnedIds()).toEqual(new Set(['group-message-1']));
    mounted.cleanup();
  });

  it('hands restored and synced poll changes to the poll board', async () => {
    const poll: DirectMessageTimelineChange = {
      allowsMultipleVotes: false,
      createdAt: 300,
      creatorIdentityId: 'bob',
      id: 'poll-1',
      kind: 'poll',
      options: [
        { id: 'tea', text: 'Tea' },
        { id: 'coffee', text: 'Coffee' },
      ],
      question: 'Which one?',
    };
    const vote: DirectMessageTimelineChange = {
      createdAt: 400,
      kind: 'poll_vote',
      optionIds: ['tea'],
      pollId: 'poll-1',
      voterIdentityId: 'carol',
    };
    restore.mockImplementationOnce((_session, _id, _signal, apply) => {
      apply([poll]);

      return Promise.resolve();
    });
    sync.mockImplementationOnce((_session, _id, _signal, apply) => {
      apply([vote]);

      return Promise.resolve({ removed: false });
    });
    const mounted = mountSync();

    await settle();

    expect(mounted.onPollChanges.mock.calls).toEqual([[[poll]], [[vote]]]);
    expect(mounted.messages()).toEqual([]);
    mounted.cleanup();
  });

  it('shows one sync notice for a failing streak and clears it on success', async () => {
    sync
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce({ removed: false });
    const mounted = mountSync();

    await settle();
    expect(mounted.error()).toBe(copy.workspace.groupMailboxSyncError);

    jest.advanceTimersByTime(POLL_MS);
    await settle();
    jest.advanceTimersByTime(POLL_MS);
    await settle();

    expect(mounted.error()).toBeNull();
    mounted.cleanup();
  });

  it('refreshes the conversation list once after this member was removed', async () => {
    sync.mockResolvedValue({ removed: true });
    const mounted = mountSync();

    await settle();
    jest.advanceTimersByTime(POLL_MS);
    await settle();

    expect(sync).toHaveBeenCalledTimes(2);
    expect(mounted.refreshConversations).toHaveBeenCalledTimes(1);
    mounted.cleanup();
  });

  it('leaves the conversation list alone while this member stays', async () => {
    const mounted = mountSync();

    await settle();

    expect(mounted.refreshConversations).not.toHaveBeenCalled();
    mounted.cleanup();
  });

  it('stops polling once cleaned up', async () => {
    const mounted = mountSync();

    await settle();
    mounted.cleanup();
    jest.advanceTimersByTime(POLL_MS);
    await settle();

    expect(sync).toHaveBeenCalledTimes(1);
  });

  it('marks the open group read after the restore and after each pass', async () => {
    const mounted = mountSync();

    await settle();
    expect(markRead).toHaveBeenCalledTimes(2);
    expect(markRead).toHaveBeenCalledWith(session, 'group-1');
    expect(restore.mock.invocationCallOrder[0]).toBeLessThan(
      markRead.mock.invocationCallOrder[0],
    );

    jest.advanceTimersByTime(POLL_MS);
    await settle();

    expect(markRead).toHaveBeenCalledTimes(3);
    mounted.cleanup();
  });

  it('keeps polling when the read marker cannot be stored', async () => {
    markRead.mockRejectedValue(new Error('quota exceeded'));
    const mounted = mountSync();

    await settle();
    jest.advanceTimersByTime(POLL_MS);
    await settle();

    expect(sync).toHaveBeenCalledTimes(2);
    expect(mounted.error()).toBeNull();
    mounted.cleanup();
  });

  it('shows the outbox state of sent messages after each pass', async () => {
    restore.mockImplementationOnce((_session, _id, _signal, apply) => {
      apply([{ kind: 'message', message: { ...message, mine: true } }]);

      return Promise.resolve();
    });
    withOutboxState.mockImplementation((_session, _id, messages) =>
      messages.map((current) => ({ ...current, deliveryStatus: 'held' })),
    );
    const mounted = mountSync();

    await settle();

    expect(withOutboxState).toHaveBeenCalledWith(
      session,
      'group-1',
      expect.any(Array),
    );
    expect(mounted.messages()[0].deliveryStatus).toBe('held');
    mounted.cleanup();
  });
});

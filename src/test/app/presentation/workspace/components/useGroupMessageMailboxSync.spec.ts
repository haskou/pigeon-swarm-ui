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
    groupMessages: { restore: jest.fn(), sync: jest.fn() },
  },
}));

const POLL_MS = 5000;
const sync = jest.mocked(applicationContainer.groupMessages.sync);
const restore = jest.mocked(applicationContainer.groupMessages.restore);
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

  mockEffects.length = 0;
  useGroupMessageMailboxSync({
    activeConversation,
    onErrorChange,
    onHistoryRestored,
    onMessagesChange,
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
});

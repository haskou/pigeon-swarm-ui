import type { SetStateAction } from 'react';

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import type {
  ChatMessage,
  ConversationResource,
  Session,
} from '../../../../../shared/domain/pigeonResources.types';

import { applicationContainer } from '../../../../../app/composition/applicationContainer';
import { subscribeRealtimeMailboxHints } from '../../../../../app/presentation/realtime/useRealtimeEvents';
import { useDirectMessageMailboxSync } from '../../../../../app/presentation/workspace/components/useDirectMessageMailboxSync';
import { MailboxReaderLimitError } from '../../../../../contexts/mailboxes/infrastructure/http/MailboxReaderLimitError';
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
    directMessages: { hintTarget: jest.fn(), sync: jest.fn() },
  },
}));
jest.mock('../../../../../app/presentation/realtime/useRealtimeEvents', () => ({
  subscribeRealtimeMailboxHints: jest.fn(),
}));

const POLL_MS = 5000;
const sync = jest.mocked(applicationContainer.directMessages.sync);
const conversation = {
  id: 'conversation-1',
  type: 'one-to-one',
} as unknown as ConversationResource;
const session = {} as Session;

async function settle(): Promise<void> {
  for (let tick = 0; tick < 10; tick += 1) {
    await Promise.resolve();
  }
}

function mountSync(initialError: string | null = null) {
  let error = initialError;
  const onErrorChange = jest.fn((update: SetStateAction<string | null>) => {
    error = typeof update === 'function' ? update(error) : update;
  });
  const onMessagesChange =
    jest.fn<(update: SetStateAction<ChatMessage[]>) => void>();
  const onConversationRead = jest.fn<(conversationId: string) => void>();
  let pinned = new Set<string>();
  const setPinnedMessageIds = jest.fn((update: SetStateAction<Set<string>>) => {
    pinned = typeof update === 'function' ? update(pinned) : update;
  });

  mockEffects.length = 0;
  useDirectMessageMailboxSync({
    activeConversation: conversation,
    onConversationRead,
    onErrorChange,
    onMessagesChange,
    session,
    setPinnedMessageIds,
  });
  const cleanup = mockEffects[0]() as () => void;

  return {
    cleanup,
    error: () => error,
    onConversationRead,
    onErrorChange,
    onMessagesChange,
    pinnedIds: () => pinned,
    replaceError: (value: string) => {
      error = value;
    },
    setPinnedMessageIds,
  };
}

describe('useDirectMessageMailboxSync notice', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    Reflect.set(globalThis, 'window', {
      clearTimeout: (id: number | undefined) => globalThis.clearTimeout(id),
      setTimeout: (callback: () => void, ms: number) =>
        globalThis.setTimeout(callback, ms),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    Reflect.deleteProperty(globalThis, 'window');
    sync.mockReset();
  });

  it('shows one notice for a failing streak and does not repeat it', async () => {
    sync.mockRejectedValue(new Error('offline'));
    const mounted = mountSync();

    await settle();
    jest.advanceTimersByTime(POLL_MS);
    await settle();
    jest.advanceTimersByTime(POLL_MS);
    await settle();

    expect(sync).toHaveBeenCalledTimes(3);
    expect(mounted.onErrorChange).toHaveBeenCalledTimes(1);
    expect(mounted.error()).toBe('offline');
    mounted.cleanup();
  });

  it('does not replace an error that is already shown', async () => {
    sync.mockRejectedValue(new Error('offline'));
    const mounted = mountSync('Another error');

    await settle();

    expect(mounted.error()).toBe('Another error');
    mounted.cleanup();
  });

  it('clears its own notice on the next successful pass', async () => {
    sync
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined);
    const mounted = mountSync();

    await settle();
    expect(mounted.error()).toBe('offline');

    jest.advanceTimersByTime(POLL_MS);
    await settle();

    expect(mounted.error()).toBeNull();
    mounted.cleanup();
  });

  it('leaves another error in place when its notice was replaced', async () => {
    sync
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined);
    const mounted = mountSync();

    await settle();
    mounted.replaceError('Another error');

    jest.advanceTimersByTime(POLL_MS);
    await settle();

    expect(mounted.error()).toBe('Another error');
    mounted.cleanup();
  });

  it('shows the reader-limit notice when the reader set is full', async () => {
    sync.mockRejectedValue(new MailboxReaderLimitError());
    const mounted = mountSync();

    await settle();

    expect(mounted.error()).toBe(copy.workspace.directMailboxReaderLimitError);
    mounted.cleanup();
  });
});

describe('useDirectMessageMailboxSync changes', () => {
  const timelineMessage = {
    attachments: [],
    authorIdentityId: 'alice',
    content: 'hello',
    encrypted: false,
    id: 'message-1',
    mine: true,
    raw: { conversationId: 'conversation-1', id: 'message-1', type: 'sent' },
    reactions: [],
    timestamp: 100,
  } as unknown as ChatMessage;

  beforeEach(() => {
    jest.useFakeTimers();
    Reflect.set(globalThis, 'window', {
      clearTimeout: (id: number | undefined) => globalThis.clearTimeout(id),
      setTimeout: (callback: () => void, ms: number) =>
        globalThis.setTimeout(callback, ms),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    Reflect.deleteProperty(globalThis, 'window');
    sync.mockReset();
  });

  it('applies reported changes to the timeline', async () => {
    sync.mockImplementation((_session, _conversationId, _signal, apply) => {
      apply([
        {
          action: 'add',
          authorId: 'bob',
          createdAt: 300,
          emoji: '👍',
          kind: 'reaction',
          messageId: 'message-1',
        },
      ]);

      return Promise.resolve();
    });
    const mounted = mountSync();

    await settle();

    const update = mounted.onMessagesChange.mock.calls[0][0] as (
      current: ChatMessage[],
    ) => ChatMessage[];
    expect(update([timelineMessage])[0].reactions).toEqual([
      { authorIdentityId: 'bob', createdAt: 300, emoji: '👍' },
    ]);
    mounted.cleanup();
  });

  it('does not touch the timeline when a pass reports no changes', async () => {
    sync.mockImplementation((_session, _conversationId, _signal, apply) => {
      apply([]);

      return Promise.resolve();
    });
    const mounted = mountSync();

    await settle();

    expect(mounted.onMessagesChange).not.toHaveBeenCalled();
    mounted.cleanup();
  });

  it('signals the conversation read on a read change', async () => {
    sync.mockImplementation((_session, _conversationId, _signal, apply) => {
      apply([{ kind: 'read', messageId: 'message-1' }]);

      return Promise.resolve();
    });
    const mounted = mountSync();

    await settle();

    expect(mounted.onConversationRead).toHaveBeenCalledWith('conversation-1');
    mounted.cleanup();
  });
});

describe('useDirectMessageMailboxSync pins', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    Reflect.set(globalThis, 'window', {
      clearTimeout: (id: number | undefined) => globalThis.clearTimeout(id),
      setTimeout: (callback: () => void, ms: number) =>
        globalThis.setTimeout(callback, ms),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    Reflect.deleteProperty(globalThis, 'window');
    sync.mockReset();
  });

  it('adds the message to the pinned set on a pin change', async () => {
    sync.mockImplementation((_session, _conversationId, _signal, apply) => {
      apply([
        { action: 'pin', createdAt: 300, kind: 'pin', messageId: 'message-1' },
      ]);

      return Promise.resolve();
    });
    const mounted = mountSync();

    await settle();

    expect(mounted.pinnedIds()).toEqual(new Set(['message-1']));
    mounted.cleanup();
  });

  it('removes the message from the pinned set on a later unpin change in the same pass', async () => {
    sync.mockImplementation((_session, _conversationId, _signal, apply) => {
      apply([
        { action: 'pin', createdAt: 300, kind: 'pin', messageId: 'message-1' },
        {
          action: 'unpin',
          createdAt: 400,
          kind: 'pin',
          messageId: 'message-1',
        },
      ]);

      return Promise.resolve();
    });
    const mounted = mountSync();

    await settle();

    expect(mounted.pinnedIds()).toEqual(new Set());
    mounted.cleanup();
  });

  it('keeps the newest write when an out-of-order pass delivers an older pin last', async () => {
    sync.mockImplementation((_session, _conversationId, _signal, apply) => {
      apply([
        {
          action: 'unpin',
          createdAt: 400,
          kind: 'pin',
          messageId: 'message-1',
        },
        { action: 'pin', createdAt: 300, kind: 'pin', messageId: 'message-1' },
      ]);

      return Promise.resolve();
    });
    const mounted = mountSync();

    await settle();

    expect(mounted.pinnedIds()).toEqual(new Set());
    mounted.cleanup();
  });

  it('ignores a pin older than the last applied write across passes', async () => {
    sync
      .mockImplementationOnce((_session, _conversationId, _signal, apply) => {
        apply([
          {
            action: 'pin',
            createdAt: 300,
            kind: 'pin',
            messageId: 'message-1',
          },
        ]);

        return Promise.resolve();
      })
      .mockImplementationOnce((_session, _conversationId, _signal, apply) => {
        apply([
          {
            action: 'unpin',
            createdAt: 400,
            kind: 'pin',
            messageId: 'message-1',
          },
        ]);

        return Promise.resolve();
      })
      .mockImplementationOnce((_session, _conversationId, _signal, apply) => {
        apply([
          {
            action: 'pin',
            createdAt: 300,
            kind: 'pin',
            messageId: 'message-1',
          },
        ]);

        return Promise.resolve();
      });
    const mounted = mountSync();

    await settle();
    jest.advanceTimersByTime(POLL_MS);
    await settle();
    jest.advanceTimersByTime(POLL_MS);
    await settle();

    expect(sync).toHaveBeenCalledTimes(3);
    expect(mounted.pinnedIds()).toEqual(new Set());
    mounted.cleanup();
  });

  it('does not change the pinned set again for a replayed pin', async () => {
    sync
      .mockImplementationOnce((_session, _conversationId, _signal, apply) => {
        apply([
          {
            action: 'pin',
            createdAt: 300,
            kind: 'pin',
            messageId: 'message-1',
          },
        ]);

        return Promise.resolve();
      })
      .mockImplementationOnce((_session, _conversationId, _signal, apply) => {
        apply([
          {
            action: 'pin',
            createdAt: 300,
            kind: 'pin',
            messageId: 'message-1',
          },
        ]);

        return Promise.resolve();
      });
    const mounted = mountSync();

    await settle();
    jest.advanceTimersByTime(POLL_MS);
    await settle();

    expect(mounted.setPinnedMessageIds).toHaveBeenCalledTimes(1);
    expect(mounted.pinnedIds()).toEqual(new Set(['message-1']));
    mounted.cleanup();
  });

  it('does not signal a conversation read for a pin change', async () => {
    sync.mockImplementation((_session, _conversationId, _signal, apply) => {
      apply([
        { action: 'pin', createdAt: 300, kind: 'pin', messageId: 'message-1' },
      ]);

      return Promise.resolve();
    });
    const mounted = mountSync();

    await settle();

    expect(mounted.onConversationRead).not.toHaveBeenCalled();
    mounted.cleanup();
  });
});

describe('useDirectMessageMailboxSync hints', () => {
  const hintTarget = jest.mocked(
    applicationContainer.directMessages.hintTarget,
  );
  const subscribe = jest.mocked(subscribeRealtimeMailboxHints);
  const target = { mailboxId: 'mailbox-1', readToken: 'token-1' };

  function hint(): () => void {
    const call = subscribe.mock.calls[0];

    if (!call) throw new Error('No hint subscription.');

    return call[2];
  }

  beforeEach(() => {
    jest.useFakeTimers();
    Reflect.set(globalThis, 'window', {
      clearTimeout: (id: number | undefined) => globalThis.clearTimeout(id),
      setTimeout: (callback: () => void, ms: number) =>
        globalThis.setTimeout(callback, ms),
    });
    sync.mockReset();
    hintTarget.mockReturnValue(target);
    subscribe.mockReset();
    subscribe.mockReturnValue(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    Reflect.deleteProperty(globalThis, 'window');
  });

  it('subscribes to the inbox hints once a pass succeeds, not on every pass', async () => {
    sync.mockResolvedValue(undefined);
    const mounted = mountSync();

    await settle();
    jest.advanceTimersByTime(POLL_MS);
    await settle();

    expect(sync).toHaveBeenCalledTimes(2);
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(subscribe).toHaveBeenCalledWith(
      session,
      target,
      expect.any(Function),
    );
    mounted.cleanup();
  });

  it('runs a pass as soon as a hint arrives instead of waiting for the poll', async () => {
    sync.mockResolvedValue(undefined);
    const mounted = mountSync();
    await settle();

    hint()();
    await settle();

    expect(sync).toHaveBeenCalledTimes(2);
    mounted.cleanup();
  });

  it('replaces the scheduled poll with the hint pass instead of adding a second one', async () => {
    sync.mockResolvedValue(undefined);
    const mounted = mountSync();
    await settle();

    jest.advanceTimersByTime(1000);
    hint()();
    await settle();
    jest.advanceTimersByTime(POLL_MS - 1000);
    await settle();
    expect(sync).toHaveBeenCalledTimes(2);

    jest.advanceTimersByTime(1000);
    await settle();
    expect(sync).toHaveBeenCalledTimes(3);
    mounted.cleanup();
  });

  it('queues one follow-up pass for hints that arrive during a running pass', async () => {
    let finish: () => void = () => undefined;
    sync
      .mockResolvedValueOnce(undefined)
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      )
      .mockResolvedValue(undefined);
    const mounted = mountSync();
    await settle();

    hint()();
    hint()();
    expect(sync).toHaveBeenCalledTimes(2);

    finish();
    await settle();
    expect(sync).toHaveBeenCalledTimes(3);
    mounted.cleanup();
  });

  it('drops its hint subscription on cleanup', async () => {
    const unsubscribe = jest.fn();
    subscribe.mockReturnValue(unsubscribe);
    sync.mockResolvedValue(undefined);
    const mounted = mountSync();
    await settle();

    mounted.cleanup();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});

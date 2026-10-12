import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import type {
  ConversationResource,
  Session,
} from '../../../../../shared/domain/pigeonResources.types';

import { applicationContainer } from '../../../../../app/composition/applicationContainer';
import { useDirectMessageBackgroundReadSync } from '../../../../../app/presentation/workspace/components/useDirectMessageBackgroundReadSync';

type MockEffect = () => void | (() => void);

const mockEffects: MockEffect[] = [];

jest.mock('react', () => ({
  useEffect: (effect: MockEffect) => {
    mockEffects.push(effect);
  },
  useRef: <T>(value: T) => ({ current: value }),
}));
jest.mock('../../../../../app/composition/applicationContainer', () => ({
  applicationContainer: { directMessages: { syncReads: jest.fn() } },
}));

const TICK_MS = 5000;
const VISIT_MS = 30_000;
const syncReads = jest.mocked(applicationContainer.directMessages.syncReads);
const session = {} as Session;

function conversation(
  id: string,
  type: 'group' | 'one-to-one' = 'one-to-one',
  unreadCount = 1,
): ConversationResource {
  return { id, type, unreadCount } as unknown as ConversationResource;
}

async function settle(): Promise<void> {
  for (let tick = 0; tick < 10; tick += 1) {
    await Promise.resolve();
  }
}

async function advance(ms: number): Promise<void> {
  jest.advanceTimersByTime(ms);
  await settle();
}

function mountBackgroundReadSync(
  conversations: ConversationResource[],
  activeConversationId: string | null = null,
) {
  const onConversationRead = jest.fn<(conversationId: string) => void>();

  mockEffects.length = 0;
  useDirectMessageBackgroundReadSync({
    activeConversationId,
    conversations,
    onConversationRead,
    session,
  });
  const cleanup = mockEffects[0]() as () => void;

  return {
    cleanup,
    onConversationRead,
    visited: () =>
      syncReads.mock.calls.map(([, conversationId]) => conversationId),
  };
}

describe('useDirectMessageBackgroundReadSync', () => {
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
    syncReads.mockReset();
    jest.restoreAllMocks();
  });

  it('visits only non-active one-to-one conversations that have unread messages', async () => {
    const mounted = mountBackgroundReadSync(
      [
        conversation('active'),
        conversation('team', 'group'),
        conversation('caught-up', 'one-to-one', 0),
        conversation('peer'),
      ],
      'active',
    );

    await settle();

    expect(mounted.visited()).toEqual(['peer']);
    mounted.cleanup();
  });

  it('visits at most two conversations per tick', async () => {
    const mounted = mountBackgroundReadSync([
      conversation('a'),
      conversation('b'),
      conversation('c'),
    ]);

    await settle();

    expect(mounted.visited()).toEqual(['a', 'b']);
    mounted.cleanup();
  });

  it('revisits a conversation only after 30 seconds', async () => {
    const mounted = mountBackgroundReadSync([
      conversation('a'),
      conversation('b'),
      conversation('c'),
      conversation('d'),
    ]);

    await settle();
    expect(mounted.visited()).toEqual(['a', 'b']);

    await advance(TICK_MS);
    expect(mounted.visited()).toEqual(['a', 'b', 'c', 'd']);

    await advance(TICK_MS * 4);
    expect(mounted.visited()).toEqual(['a', 'b', 'c', 'd']);

    await advance(TICK_MS);
    expect(mounted.visited()).toEqual(['a', 'b', 'c', 'd', 'a', 'b']);

    await advance(TICK_MS);
    expect(mounted.visited()).toEqual(['a', 'b', 'c', 'd', 'a', 'b', 'c', 'd']);
    mounted.cleanup();
  });

  it('reports a read to the conversation list only when a clear was applied', async () => {
    syncReads.mockImplementation((_session, conversationId, _signal, apply) => {
      apply(
        conversationId === 'peer'
          ? [{ kind: 'read', messageId: 'message-1' }]
          : [{ kind: 'removed', messageId: 'message-2' }],
      );

      return Promise.resolve();
    });
    const mounted = mountBackgroundReadSync([
      conversation('quiet'),
      conversation('peer'),
    ]);

    await settle();

    expect(mounted.onConversationRead).toHaveBeenCalledTimes(1);
    expect(mounted.onConversationRead).toHaveBeenCalledWith('peer');
    mounted.cleanup();
  });

  it('logs one count-only line for a failed visit and keeps visiting the others', async () => {
    const debug = jest
      .spyOn(console, 'debug')
      .mockImplementation(() => undefined);
    syncReads
      .mockRejectedValueOnce(new Error('peer-identity-id'))
      .mockResolvedValue(undefined);
    const mounted = mountBackgroundReadSync([
      conversation('first'),
      conversation('second'),
    ]);

    await settle();

    expect(mounted.visited()).toEqual(['first', 'second']);
    expect(mounted.onConversationRead).not.toHaveBeenCalled();
    expect(debug).toHaveBeenCalledTimes(1);
    expect(debug).toHaveBeenCalledWith(
      'Background read sync failed; retried later.',
    );
    mounted.cleanup();
  });

  it('aborts an in-flight visit on cleanup and starts no further visits', async () => {
    let captured: AbortSignal | undefined;
    syncReads.mockImplementation(
      (_session, _conversationId, signal) =>
        new Promise<void>((resolve) => {
          captured = signal;
          signal.addEventListener('abort', () => resolve());
        }),
    );
    const mounted = mountBackgroundReadSync([conversation('peer')]);

    await settle();
    mounted.cleanup();
    await settle();
    await advance(VISIT_MS * 2);

    expect(captured?.aborted).toBe(true);
    expect(syncReads).toHaveBeenCalledTimes(1);
  });
});

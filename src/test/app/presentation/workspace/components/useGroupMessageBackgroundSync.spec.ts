import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import type { ConversationResource } from '../../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { GroupConversationActivity } from '../../../../../contexts/groupMailboxes/infrastructure/GroupConversationActivity';
import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';

import { applicationContainer } from '../../../../../app/composition/applicationContainer';
import { useGroupMessageBackgroundSync } from '../../../../../app/presentation/workspace/components/useGroupMessageBackgroundSync';

type MockEffect = () => void | (() => void);

const mockEffects: MockEffect[] = [];
/** The refs of one mounted hook, in call order, kept across renders. */
const mockRefs: { current: unknown }[] = [];
let mockRefIndex = 0;

jest.mock('react', () => ({
  useEffect: (effect: MockEffect) => {
    mockEffects.push(effect);
  },
  useRef: (value: unknown) => {
    const ref = mockRefs[mockRefIndex] ?? { current: value };

    mockRefs[mockRefIndex] = ref;
    mockRefIndex += 1;

    return ref;
  },
}));
jest.mock('../../../../../app/composition/applicationContainer', () => ({
  applicationContainer: {
    groupMessages: { activity: jest.fn(), receive: jest.fn() },
  },
}));

const TICK_MS = 5000;
const VISIT_MS = 30_000;
const activity = jest.mocked(applicationContainer.groupMessages.activity);
const receive = jest.mocked(applicationContainer.groupMessages.receive);
const session = {} as Session;
const quiet: GroupConversationActivity = {
  latestMessageAt: undefined,
  unreadCount: 0,
};

function conversation(
  id: string,
  type: 'group' | 'one-to-one' = 'group',
): ConversationResource {
  return { id, type } as unknown as ConversationResource;
}

async function settle(): Promise<void> {
  for (let tick = 0; tick < 20; tick += 1) {
    await Promise.resolve();
  }
}

async function advance(ms: number): Promise<void> {
  jest.advanceTimersByTime(ms);
  await settle();
}

function mountBackgroundSync(
  conversations: ConversationResource[],
  activeConversationId: null | string = null,
) {
  const onActivity =
    jest.fn<
      (conversationId: string, activity: GroupConversationActivity) => void
    >();
  const input = {
    activeConversationId,
    conversations,
    onActivity,
    session,
  };

  mockEffects.length = 0;
  mockRefs.length = 0;
  mockRefIndex = 0;
  useGroupMessageBackgroundSync(input);
  const cleanup = mockEffects[0]() as () => void;

  return {
    cleanup,
    onActivity,
    /** Renders again, as after the user opened another conversation. */
    rerender: (next: null | string) => {
      mockEffects.length = 0;
      mockRefIndex = 0;
      useGroupMessageBackgroundSync({ ...input, activeConversationId: next });
    },
    seeded: () =>
      activity.mock.calls.map(([, conversationId]) => conversationId),
    visited: () =>
      receive.mock.calls.map(([, conversationId]) => conversationId),
  };
}

describe('useGroupMessageBackgroundSync', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    Reflect.set(globalThis, 'window', {
      clearTimeout: (id: number | undefined) => globalThis.clearTimeout(id),
      setTimeout: (callback: () => void, ms: number) =>
        globalThis.setTimeout(callback, ms),
    });
    activity.mockReset().mockResolvedValue(quiet);
    receive.mockReset().mockResolvedValue(quiet);
  });

  afterEach(() => {
    jest.useRealTimers();
    Reflect.deleteProperty(globalThis, 'window');
    jest.restoreAllMocks();
  });

  it('seeds every group but the open one from this device, once', async () => {
    const mounted = mountBackgroundSync(
      [
        conversation('open'),
        conversation('peer', 'one-to-one'),
        conversation('team'),
        conversation('family'),
      ],
      'open',
    );

    await settle();
    await advance(TICK_MS);

    expect(mounted.seeded()).toEqual(['team', 'family']);
    mounted.cleanup();
  });

  it('reports the stored count of a group before reading its inboxes', async () => {
    activity.mockResolvedValue({ latestMessageAt: 50, unreadCount: 3 });
    receive.mockImplementation(() => new Promise(() => undefined));
    const mounted = mountBackgroundSync([conversation('team')]);

    await settle();

    expect(mounted.onActivity).toHaveBeenCalledWith('team', {
      latestMessageAt: 50,
      unreadCount: 3,
    });
    mounted.cleanup();
  });

  it('reads the inboxes of at most two groups per tick, each once per 30 seconds', async () => {
    const mounted = mountBackgroundSync([
      conversation('a'),
      conversation('b'),
      conversation('c'),
      conversation('d', 'one-to-one'),
    ]);

    await settle();
    expect(mounted.visited()).toEqual(['a', 'b']);

    await advance(TICK_MS);
    expect(mounted.visited()).toEqual(['a', 'b', 'c']);

    await advance(VISIT_MS - TICK_MS);
    expect(mounted.visited()).toEqual(['a', 'b', 'c', 'a', 'b']);
    mounted.cleanup();
  });

  it('reports what a visit brought in', async () => {
    receive.mockResolvedValue({ latestMessageAt: 900, unreadCount: 2 });
    const mounted = mountBackgroundSync([conversation('team')]);

    await settle();

    expect(mounted.onActivity).toHaveBeenLastCalledWith('team', {
      latestMessageAt: 900,
      unreadCount: 2,
    });
    mounted.cleanup();
  });

  it('drops the result of a visit to a group opened meanwhile, and stops visiting it', async () => {
    let finish = (_activity: GroupConversationActivity): void => undefined;

    // The lib targets ES2020, which predates Promise.withResolvers.
    receive.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const mounted = mountBackgroundSync([conversation('team')]);

    await settle();
    mounted.rerender('team');
    finish({ latestMessageAt: 900, unreadCount: 2 });
    await settle();
    await advance(VISIT_MS);

    expect(mounted.onActivity).not.toHaveBeenCalledWith(
      'team',
      expect.objectContaining({ unreadCount: 2 }),
    );
    expect(mounted.visited()).toEqual(['team']);
    mounted.cleanup();
  });

  it('logs one generic line for a failed visit and keeps visiting the others', async () => {
    const debug = jest
      .spyOn(console, 'debug')
      .mockImplementation(() => undefined);

    receive
      .mockRejectedValueOnce(new Error('group-1 secret'))
      .mockResolvedValue({ latestMessageAt: 10, unreadCount: 1 });
    const mounted = mountBackgroundSync([
      conversation('first'),
      conversation('second'),
    ]);

    await settle();

    expect(mounted.visited()).toEqual(['first', 'second']);
    expect(mounted.onActivity).toHaveBeenLastCalledWith('second', {
      latestMessageAt: 10,
      unreadCount: 1,
    });
    expect(debug).toHaveBeenCalledTimes(1);
    expect(debug).toHaveBeenCalledWith(
      'Background group sync failed; retried later.',
    );
    mounted.cleanup();
  });

  it('aborts a running visit on cleanup and starts no further one', async () => {
    let captured: AbortSignal | undefined;

    receive.mockImplementation(
      (_session, _conversationId, signal) =>
        new Promise((resolve) => {
          captured = signal;
          signal.addEventListener('abort', () => resolve(quiet));
        }),
    );
    const mounted = mountBackgroundSync([conversation('team')]);

    await settle();
    mounted.cleanup();
    await settle();
    await advance(VISIT_MS * 2);

    expect(captured?.aborted).toBe(true);
    expect(receive).toHaveBeenCalledTimes(1);
    expect(mounted.onActivity).toHaveBeenCalledTimes(1);
  });
});

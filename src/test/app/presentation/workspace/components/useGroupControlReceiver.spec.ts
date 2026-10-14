import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';

import { applicationContainer } from '../../../../../app/composition/applicationContainer';
import { useGroupControlReceiver } from '../../../../../app/presentation/workspace/components/useGroupControlReceiver';

type MockEffect = () => void | (() => void);

const mockEffects: MockEffect[] = [];

jest.mock('react', () => ({
  useCallback: <T>(callback: T) => callback,
  useEffect: (effect: MockEffect) => {
    mockEffects.push(effect);
  },
}));
jest.mock('../../../../../app/composition/applicationContainer', () => ({
  applicationContainer: { groupMessages: { receiveControl: jest.fn() } },
}));

const RECEIVE_MS = 15_000;
const receiveControl = jest.mocked(
  applicationContainer.groupMessages.receiveControl,
);
const session = { identity: { id: 'alice' } } as unknown as Session;
const refreshConversations = jest.fn<() => Promise<unknown>>();

async function settle(): Promise<void> {
  for (let tick = 0; tick < 5; tick += 1) {
    await Promise.resolve();
  }
}

function mountReceiver(): { cleanup: () => void; receiveNow: () => void } {
  mockEffects.length = 0;
  const receiveNow = useGroupControlReceiver(session, refreshConversations);

  return { cleanup: mockEffects[0]() as () => void, receiveNow };
}

describe('useGroupControlReceiver', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    Reflect.set(globalThis, 'window', {
      clearTimeout: (id: number | undefined) => globalThis.clearTimeout(id),
      setTimeout: (callback: () => void, ms: number) =>
        globalThis.setTimeout(callback, ms),
    });
    receiveControl.mockReset().mockResolvedValue([]);
    refreshConversations.mockReset().mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
    Reflect.deleteProperty(globalThis, 'window');
  });

  it('reads the control letters at once and again after each settled run', async () => {
    const { cleanup } = mountReceiver();

    await settle();
    expect(receiveControl).toHaveBeenCalledWith(session);

    jest.advanceTimersByTime(RECEIVE_MS);
    await settle();

    expect(receiveControl).toHaveBeenCalledTimes(2);
    cleanup();
  });

  it('stops reading once cleaned up', async () => {
    const { cleanup } = mountReceiver();

    await settle();
    cleanup();
    jest.advanceTimersByTime(RECEIVE_MS);
    await settle();

    expect(receiveControl).toHaveBeenCalledTimes(1);
  });

  it('refreshes the conversation list when a welcome joined a group', async () => {
    receiveControl.mockResolvedValueOnce(['group:1']);
    const { cleanup } = mountReceiver();

    await settle();
    expect(refreshConversations).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(RECEIVE_MS);
    await settle();

    expect(receiveControl).toHaveBeenCalledTimes(2);
    expect(refreshConversations).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it('leaves the list alone when no group was joined', async () => {
    const { cleanup } = mountReceiver();

    await settle();

    expect(refreshConversations).not.toHaveBeenCalled();
    cleanup();
  });

  it('reads at once on demand and refreshes on a join', async () => {
    const { cleanup, receiveNow } = mountReceiver();

    await settle();
    receiveControl.mockResolvedValueOnce(['group:1']);
    receiveNow();
    await settle();

    expect(receiveControl).toHaveBeenCalledTimes(2);
    expect(refreshConversations).toHaveBeenCalledTimes(1);
    cleanup();
  });
});

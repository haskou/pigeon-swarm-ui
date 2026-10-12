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

import { applicationContainer } from '../../../../../app/composition/applicationContainer';
import { useDirectMessageInboxPrewarm } from '../../../../../app/presentation/workspace/components/useDirectMessageInboxPrewarm';

type MockEffect = () => void | (() => void);

const mockEffects: MockEffect[] = [];
const mockDeps: unknown[][] = [];

jest.mock('react', () => ({
  useEffect: (effect: MockEffect, deps: unknown[]) => {
    mockEffects.push(effect);
    mockDeps.push(deps);
  },
}));
jest.mock('../../../../../app/composition/applicationContainer', () => ({
  applicationContainer: { directMessages: { openInboxes: jest.fn() } },
}));

const RETRY_MS = 60_000;
const openInboxes = jest.mocked(
  applicationContainer.directMessages.openInboxes,
);
const conversations = [
  { id: 'conversation-1', type: 'one-to-one' },
] as unknown as ConversationResource[];
const session = {} as Session;

async function settle(): Promise<void> {
  for (let tick = 0; tick < 10; tick += 1) {
    await Promise.resolve();
  }
}

function mountPrewarm(): () => void {
  mockEffects.length = 0;
  mockDeps.length = 0;
  useDirectMessageInboxPrewarm({ conversations, session });

  return mockEffects[0]() as () => void;
}

describe('useDirectMessageInboxPrewarm', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    openInboxes.mockResolvedValue(true);
    Reflect.set(globalThis, 'window', {
      clearTimeout: globalThis.clearTimeout,
      setTimeout: globalThis.setTimeout,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    Reflect.deleteProperty(globalThis, 'window');
    openInboxes.mockReset();
  });

  it('opens the inboxes of the session conversations on mount', async () => {
    mountPrewarm();
    await settle();

    expect(openInboxes).toHaveBeenCalledTimes(1);
    expect(openInboxes).toHaveBeenCalledWith(
      session,
      conversations,
      expect.any(AbortSignal),
    );
  });

  it('runs again when the session or the conversations change', () => {
    mountPrewarm();

    expect(mockDeps[0]).toHaveLength(2);
    expect(mockDeps[0]).toContain(session);
    expect(mockDeps[0]).toContain(conversations);
  });

  it('retries a pass that left an inbox unopened, after the retry window', async () => {
    openInboxes.mockResolvedValueOnce(false);
    mountPrewarm();
    await settle();

    jest.advanceTimersByTime(RETRY_MS);
    await settle();

    expect(openInboxes).toHaveBeenCalledTimes(2);
  });

  it('does not retry a complete pass', async () => {
    mountPrewarm();
    await settle();

    jest.advanceTimersByTime(10 * RETRY_MS);
    await settle();

    expect(openInboxes).toHaveBeenCalledTimes(1);
  });

  it('treats a rejected pass as incomplete and retries it', async () => {
    openInboxes.mockRejectedValueOnce(new Error('offline'));
    mountPrewarm();
    await settle();

    jest.advanceTimersByTime(RETRY_MS);
    await settle();

    expect(openInboxes).toHaveBeenCalledTimes(2);
  });

  it('aborts the running pass and stops retrying on cleanup', async () => {
    openInboxes.mockResolvedValue(false);
    const cleanup = mountPrewarm();
    await settle();
    const signal = openInboxes.mock.calls[0][2];

    cleanup();
    await settle();
    jest.advanceTimersByTime(10 * RETRY_MS);
    await settle();

    expect(signal.aborted).toBe(true);
    expect(openInboxes).toHaveBeenCalledTimes(1);
  });
});

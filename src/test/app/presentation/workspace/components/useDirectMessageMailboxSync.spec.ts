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
  ConversationResource,
  Session,
} from '../../../../../shared/domain/pigeonResources.types';

import { applicationContainer } from '../../../../../app/composition/applicationContainer';
import { useDirectMessageMailboxSync } from '../../../../../app/presentation/workspace/components/useDirectMessageMailboxSync';

type MockEffect = () => void | (() => void);

const mockEffects: MockEffect[] = [];

jest.mock('react', () => ({
  useEffect: (effect: MockEffect) => {
    mockEffects.push(effect);
  },
}));
jest.mock('../../../../../app/composition/applicationContainer', () => ({
  applicationContainer: { directMessages: { sync: jest.fn() } },
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

  mockEffects.length = 0;
  useDirectMessageMailboxSync({
    activeConversation: conversation,
    onErrorChange,
    onMessagesChange: jest.fn(),
    session,
  });
  const cleanup = mockEffects[0]() as () => void;

  return {
    cleanup,
    error: () => error,
    onErrorChange,
    replaceError: (value: string) => {
      error = value;
    },
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
});

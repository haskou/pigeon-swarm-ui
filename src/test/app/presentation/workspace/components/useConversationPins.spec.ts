import type { Dispatch, SetStateAction } from 'react';

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { MessageCollectionState } from '../../../../../app/presentation/workspace/components/conversationThreadState';
import type {
  ChatMessage,
  ConversationResource,
  Session,
} from '../../../../../shared/domain/pigeonResources.types';

import { applicationContainer } from '../../../../../app/composition/applicationContainer';
import { useConversationPins } from '../../../../../app/presentation/workspace/components/useConversationPins';
import { captureUnhandledRejections } from '../../../../captureUnhandledRejections';

jest.mock('react', () => ({
  useEffect: () => undefined,
  useState: <T>(initial: T | (() => T)) => [
    typeof initial === 'function' ? (initial as () => T)() : initial,
    jest.fn(),
  ],
}));
jest.mock('../../../../../app/composition/applicationContainer', () => ({
  applicationContainer: {
    directMessages: { deliverPin: jest.fn() },
    messages: { pin: jest.fn(), unpin: jest.fn() },
  },
}));

const conversation = {
  id: 'conversation-1',
  participantIds: ['alice', 'bob'],
  type: 'one-to-one',
} as unknown as ConversationResource;
const session = { identity: { id: 'alice' } } as unknown as Session;
const message = { id: 'message-1' } as unknown as ChatMessage;

const pinnedCollection = {
  error: null,
  messages: [message],
  state: 'ready',
} as unknown as MessageCollectionState;

// Hook state setters are fresh jest.fn()s; the hook passes them updaters.
function pinnedUpdaterOf(
  setPinnedMessageIds: Dispatch<SetStateAction<Set<string>>>,
): (current: Set<string>) => Set<string> {
  return jest.mocked(setPinnedMessageIds).mock.calls[0]?.[0] as (
    current: Set<string>,
  ) => Set<string>;
}

function collectionUpdaterOf(
  setCollection: Dispatch<SetStateAction<MessageCollectionState | null>>,
): (current: MessageCollectionState | null) => MessageCollectionState | null {
  return jest.mocked(setCollection).mock.calls[0]?.[0] as (
    current: MessageCollectionState | null,
  ) => MessageCollectionState | null;
}

function mountPins() {
  const onError = jest.fn<(error: string | null) => void>();
  const closeMessageContextMenu = jest.fn<() => void>();
  const pins = useConversationPins({
    activeConversation: conversation,
    closeMessageContextMenu,
    onError,
    session,
  });

  return { onError, pins };
}

describe('useConversationPins mailbox delivery', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('delivers a pin record to the peer after the legacy pin succeeds', async () => {
    jest.mocked(applicationContainer.messages.pin).mockResolvedValue(undefined);
    const { pins } = mountPins();

    await pins.pin(message);

    expect(applicationContainer.directMessages.deliverPin).toHaveBeenCalledWith(
      session,
      conversation,
      {
        action: 'pin',
        createdAt: expect.any(Number),
        messageId: 'message-1',
      },
    );
    expect(
      jest.mocked(applicationContainer.messages.pin).mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      jest.mocked(applicationContainer.directMessages.deliverPin).mock
        .invocationCallOrder[0],
    );
  });

  it('does not deliver a pin record when the legacy pin fails', async () => {
    jest
      .mocked(applicationContainer.messages.pin)
      .mockRejectedValue(new Error('offline'));
    const { onError, pins } = mountPins();

    await pins.pin(message);

    expect(
      applicationContainer.directMessages.deliverPin,
    ).not.toHaveBeenCalled();
    expect(onError).toHaveBeenLastCalledWith(expect.any(String));
  });

  it('delivers an unpin record to the peer after the legacy unpin succeeds', async () => {
    jest
      .mocked(applicationContainer.messages.unpin)
      .mockResolvedValue(undefined);
    const { pins } = mountPins();

    await pins.unpin(message);

    expect(applicationContainer.directMessages.deliverPin).toHaveBeenCalledWith(
      session,
      conversation,
      {
        action: 'unpin',
        createdAt: expect.any(Number),
        messageId: 'message-1',
      },
    );
  });

  it('does not deliver an unpin record when the legacy unpin fails', async () => {
    jest
      .mocked(applicationContainer.messages.unpin)
      .mockRejectedValue(new Error('offline'));
    const { pins } = mountPins();

    await pins.unpin(message);

    expect(
      applicationContainer.directMessages.deliverPin,
    ).not.toHaveBeenCalled();
  });

  it('keeps the pin applied when inbox delivery throws synchronously', async () => {
    jest.mocked(applicationContainer.messages.pin).mockResolvedValue(undefined);
    jest
      .mocked(applicationContainer.directMessages.deliverPin)
      .mockImplementation(() => {
        throw new Error('inbox unavailable');
      });
    const { onError, pins } = mountPins();

    await pins.pin(message);

    expect(onError).toHaveBeenLastCalledWith(null);
    expect(pinnedUpdaterOf(pins.setPinnedMessageIds)(new Set())).toEqual(
      new Set(['message-1']),
    );
  });

  it('keeps the pin applied with no unhandled rejection when inbox delivery rejects', async () => {
    jest.mocked(applicationContainer.messages.pin).mockResolvedValue(undefined);
    jest
      .mocked(applicationContainer.directMessages.deliverPin)
      .mockRejectedValue(new Error('inbox unavailable'));
    const { onError, pins } = mountPins();

    const unhandled = await captureUnhandledRejections(() => pins.pin(message));

    expect(unhandled).toEqual([]);
    expect(onError).toHaveBeenLastCalledWith(null);
    expect(pinnedUpdaterOf(pins.setPinnedMessageIds)(new Set())).toEqual(
      new Set(['message-1']),
    );
  });

  it('keeps the unpin applied when inbox delivery throws synchronously', async () => {
    jest
      .mocked(applicationContainer.messages.unpin)
      .mockResolvedValue(undefined);
    jest
      .mocked(applicationContainer.directMessages.deliverPin)
      .mockImplementation(() => {
        throw new Error('inbox unavailable');
      });
    const { pins } = mountPins();

    await pins.unpin(message);

    expect(collectionUpdaterOf(pins.setCollection)(pinnedCollection)).toEqual({
      error: null,
      messages: [],
      state: 'ready',
    });
  });

  it('keeps the unpin applied with no unhandled rejection when inbox delivery rejects', async () => {
    jest
      .mocked(applicationContainer.messages.unpin)
      .mockResolvedValue(undefined);
    jest
      .mocked(applicationContainer.directMessages.deliverPin)
      .mockRejectedValue(new Error('inbox unavailable'));
    const { pins } = mountPins();

    const unhandled = await captureUnhandledRejections(() =>
      pins.unpin(message),
    );

    expect(unhandled).toEqual([]);
    expect(collectionUpdaterOf(pins.setCollection)(pinnedCollection)).toEqual({
      error: null,
      messages: [],
      state: 'ready',
    });
  });
});

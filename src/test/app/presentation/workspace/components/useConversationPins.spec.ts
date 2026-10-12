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

jest.mock('react', () => ({
  useEffect: () => undefined,
  useState: <T>(initial: T | (() => T)) => [
    typeof initial === 'function' ? (initial as () => T)() : initial,
    jest.fn(),
  ],
}));
jest.mock('../../../../../app/composition/applicationContainer', () => ({
  applicationContainer: {
    directMessages: { pin: jest.fn() },
    messages: { listPins: jest.fn(), pin: jest.fn(), unpin: jest.fn() },
  },
}));

const oneToOne = {
  id: 'conversation-1',
  participantIds: ['alice', 'bob'],
  type: 'one-to-one',
} as unknown as ConversationResource;
const group = {
  id: 'group-1',
  participantIds: ['alice', 'bob', 'carol'],
  type: 'group',
} as unknown as ConversationResource;
const session = { identity: { id: 'alice' } } as unknown as Session;
const message = { id: 'message-1' } as unknown as ChatMessage;
const other = { id: 'message-2' } as unknown as ChatMessage;

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

function mountPins({
  activeConversation = oneToOne,
  messages = [message],
}: {
  activeConversation?: ConversationResource;
  messages?: ChatMessage[];
} = {}) {
  const onError = jest.fn<(error: string | null) => void>();
  const closeMessageContextMenu = jest.fn<() => void>();
  const pins = useConversationPins({
    activeConversation,
    closeMessageContextMenu,
    messages,
    onError,
    session,
  });

  return { onError, pins };
}

describe('useConversationPins one-to-one mailbox', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('pins a one-to-one message through the mailbox only', async () => {
    jest
      .mocked(applicationContainer.directMessages.pin)
      .mockResolvedValue(undefined);
    const { pins } = mountPins();

    await pins.pin(message);

    expect(applicationContainer.directMessages.pin).toHaveBeenCalledWith(
      session,
      oneToOne,
      {
        action: 'pin',
        createdAt: expect.any(Number),
        messageId: 'message-1',
      },
    );
    expect(applicationContainer.messages.pin).not.toHaveBeenCalled();
    expect(pinnedUpdaterOf(pins.setPinnedMessageIds)(new Set())).toEqual(
      new Set(['message-1']),
    );
  });

  it('shows the pin error and does not mark the message pinned when the mailbox pin rejects', async () => {
    jest
      .mocked(applicationContainer.directMessages.pin)
      .mockRejectedValue(new Error('pin refused'));
    const { onError, pins } = mountPins();

    await pins.pin(message);

    expect(applicationContainer.messages.pin).not.toHaveBeenCalled();
    expect(onError).toHaveBeenLastCalledWith('pin refused');
    expect(pins.setPinnedMessageIds).not.toHaveBeenCalled();
  });

  it('unpins a one-to-one message through the mailbox only', async () => {
    jest
      .mocked(applicationContainer.directMessages.pin)
      .mockResolvedValue(undefined);
    const { pins } = mountPins();

    await pins.unpin(message);

    expect(applicationContainer.directMessages.pin).toHaveBeenCalledWith(
      session,
      oneToOne,
      {
        action: 'unpin',
        createdAt: expect.any(Number),
        messageId: 'message-1',
      },
    );
    expect(applicationContainer.messages.unpin).not.toHaveBeenCalled();
    expect(collectionUpdaterOf(pins.setCollection)(pinnedCollection)).toEqual({
      error: null,
      messages: [],
      state: 'ready',
    });
  });

  it('shows the unpin error in the pins view when the mailbox unpin rejects', async () => {
    jest
      .mocked(applicationContainer.directMessages.pin)
      .mockRejectedValue(new Error('unpin refused'));
    const { pins } = mountPins();

    await pins.unpin(message);

    expect(applicationContainer.messages.unpin).not.toHaveBeenCalled();
    expect(collectionUpdaterOf(pins.setCollection)(pinnedCollection)).toEqual({
      error: 'unpin refused',
      messages: [message],
      state: 'ready',
    });
  });

  it('builds the one-to-one pins view from pinned timeline messages without a legacy listing', async () => {
    const { pins } = mountPins({ messages: [message, other] });
    pins.pinnedMessageIds.add('message-1');

    await pins.open();

    expect(applicationContainer.messages.listPins).not.toHaveBeenCalled();
    expect(pins.setCollection).toHaveBeenLastCalledWith({
      error: null,
      messages: [message],
      state: 'ready',
    });
  });

  it('pins a group message through the legacy endpoint only', async () => {
    jest.mocked(applicationContainer.messages.pin).mockResolvedValue(undefined);
    const { pins } = mountPins({ activeConversation: group });

    await pins.pin(message);

    expect(applicationContainer.messages.pin).toHaveBeenCalledWith(
      session,
      'group-1',
      'message-1',
    );
    expect(applicationContainer.directMessages.pin).not.toHaveBeenCalled();
  });
});

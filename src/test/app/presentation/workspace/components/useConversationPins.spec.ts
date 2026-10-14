import type { Dispatch, SetStateAction } from 'react';

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import type { MessageCollectionState } from '../../../../../app/presentation/workspace/components/conversationThreadState';
import type { ConversationResource } from '../../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { ChatMessage } from '../../../../../contexts/messages/domain/ChatMessage';

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
    groupMessages: { pin: jest.fn() },
    messages: { pin: jest.fn(), unpin: jest.fn() },
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

describe('useConversationPins', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('pins a one-to-one message through the messages use cases only', async () => {
    jest.mocked(applicationContainer.messages.pin).mockResolvedValue(undefined);
    const { pins } = mountPins();

    await pins.pin(message);

    expect(applicationContainer.messages.pin).toHaveBeenCalledWith(
      session,
      oneToOne,
      'message-1',
    );
    expect(applicationContainer.directMessages.pin).not.toHaveBeenCalled();
    expect(pinnedUpdaterOf(pins.setPinnedMessageIds)(new Set())).toEqual(
      new Set(['message-1']),
    );
  });

  it('shows the pin error and does not mark the message pinned when the pin rejects', async () => {
    jest
      .mocked(applicationContainer.messages.pin)
      .mockRejectedValue(new Error('pin refused'));
    const { onError, pins } = mountPins();

    await pins.pin(message);

    expect(onError).toHaveBeenLastCalledWith('pin refused');
    expect(pins.setPinnedMessageIds).not.toHaveBeenCalled();
  });

  it('unpins a one-to-one message through the messages use cases only', async () => {
    jest
      .mocked(applicationContainer.messages.unpin)
      .mockResolvedValue(undefined);
    const { pins } = mountPins();

    await pins.unpin(message);

    expect(applicationContainer.messages.unpin).toHaveBeenCalledWith(
      session,
      oneToOne,
      'message-1',
    );
    expect(applicationContainer.directMessages.pin).not.toHaveBeenCalled();
    expect(collectionUpdaterOf(pins.setCollection)(pinnedCollection)).toEqual({
      error: null,
      messages: [],
      state: 'ready',
    });
  });

  it('shows the unpin error in the pins view when the unpin rejects', async () => {
    jest
      .mocked(applicationContainer.messages.unpin)
      .mockRejectedValue(new Error('unpin refused'));
    const { pins } = mountPins();

    await pins.unpin(message);

    expect(collectionUpdaterOf(pins.setCollection)(pinnedCollection)).toEqual({
      error: 'unpin refused',
      messages: [message],
      state: 'ready',
    });
  });

  it.each([
    ['one-to-one', oneToOne],
    ['group', group],
  ])(
    'builds the %s pins view from pinned timeline messages',
    (_type, activeConversation) => {
      const { pins } = mountPins({
        activeConversation,
        messages: [message, other],
      });
      pins.pinnedMessageIds.add('message-1');

      pins.open();

      expect(pins.setCollection).toHaveBeenLastCalledWith({
        error: null,
        messages: [message],
        state: 'ready',
      });
    },
  );

  it('pins a group message through the group mailbox only', async () => {
    jest
      .mocked(applicationContainer.groupMessages.pin)
      .mockResolvedValue(undefined);
    const { pins } = mountPins({ activeConversation: group });

    await pins.pin(message);

    expect(applicationContainer.groupMessages.pin).toHaveBeenCalledWith(
      session,
      group,
      { action: 'pin', messageId: 'message-1' },
    );
    expect(applicationContainer.messages.pin).not.toHaveBeenCalled();
    expect(pinnedUpdaterOf(pins.setPinnedMessageIds)(new Set())).toEqual(
      new Set(['message-1']),
    );
  });

  it('unpins a group message through the group mailbox only', async () => {
    jest
      .mocked(applicationContainer.groupMessages.pin)
      .mockResolvedValue(undefined);
    const { pins } = mountPins({ activeConversation: group });

    await pins.unpin(message);

    expect(applicationContainer.groupMessages.pin).toHaveBeenCalledWith(
      session,
      group,
      { action: 'unpin', messageId: 'message-1' },
    );
    expect(applicationContainer.messages.unpin).not.toHaveBeenCalled();
  });
});

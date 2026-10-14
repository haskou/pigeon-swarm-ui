import type { SetStateAction } from 'react';

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { ConversationResource } from '../../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { ChatMessage } from '../../../../../contexts/messages/domain/ChatMessage';
import type { DirectMessageOutboxEvent } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageOutboxEvent';
import type { DirectMessageOutboxItem } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageOutboxItem';

import { applicationContainer } from '../../../../../app/composition/applicationContainer';
import { useDirectMessageOutboxSync } from '../../../../../app/presentation/workspace/components/useDirectMessageOutboxSync';

type MockEffect = () => void | (() => void);

const mockEffects: MockEffect[] = [];

jest.mock('react', () => ({
  useEffect: (effect: MockEffect) => {
    mockEffects.push(effect);
  },
}));
jest.mock('../../../../../app/composition/applicationContainer', () => ({
  applicationContainer: {
    directMessages: {
      outboxItems: jest.fn(),
      queuedMessages: jest.fn(),
      subscribeOutbox: jest.fn(),
    },
  },
}));

const directMessages = jest.mocked(applicationContainer.directMessages);
const session = { identity: { id: 'identity-1' } } as unknown as Session;
const conversation = {
  id: 'conversation-1',
  type: 'one-to-one',
} as unknown as ConversationResource;
const groupConversation = {
  id: 'conversation-2',
  type: 'group',
} as unknown as ConversationResource;

async function settle(): Promise<void> {
  for (let tick = 0; tick < 10; tick += 1) {
    await Promise.resolve();
  }
}

function message(id: string, timestamp: number): ChatMessage {
  return { id, raw: {}, text: id, timestamp } as unknown as ChatMessage;
}

function queuedItem(
  id: string,
  state: DirectMessageOutboxItem['state'],
): DirectMessageOutboxItem {
  return {
    conversationId: 'conversation-1',
    id,
    record: {} as DirectMessageOutboxItem['record'],
    state,
  };
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });

  return { promise, resolve };
}

function mountOutbox(activeConversation = conversation) {
  let messages: ChatMessage[] = [];
  const onMessagesChange = jest.fn((update: SetStateAction<ChatMessage[]>) => {
    messages = typeof update === 'function' ? update(messages) : update;
  });
  let listener: ((event: DirectMessageOutboxEvent) => void) | undefined;
  const unsubscribe = jest.fn();

  directMessages.subscribeOutbox.mockImplementation((next) => {
    listener = next;

    return unsubscribe;
  });

  mockEffects.length = 0;
  useDirectMessageOutboxSync({
    activeConversation,
    onMessagesChange,
    session,
  });
  const cleanup = mockEffects[0]() as () => void;

  return {
    cleanup,
    emit: (event: DirectMessageOutboxEvent) => listener?.(event),
    messages: () => messages,
    onMessagesChange,
    unsubscribe,
  };
}

describe('useDirectMessageOutboxSync', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    directMessages.outboxItems.mockReturnValue([]);
    directMessages.queuedMessages.mockResolvedValue([]);
  });

  it('shows each queued one-to-one send with its state once mounted', async () => {
    directMessages.queuedMessages.mockResolvedValue([
      message('a', 1),
      message('b', 2),
    ]);
    directMessages.outboxItems.mockReturnValue([
      queuedItem('a', 'retry'),
      queuedItem('b', 'pending'),
    ]);

    const outbox = mountOutbox();
    await settle();

    expect(outbox.messages()).toEqual([
      expect.objectContaining({ deliveryStatus: 'retry', id: 'a' }),
      expect.objectContaining({ deliveryStatus: 'pending', id: 'b' }),
    ]);
  });

  it('updates the state of a queued send when the outbox reports a change', async () => {
    directMessages.queuedMessages.mockResolvedValue([message('a', 1)]);
    directMessages.outboxItems.mockReturnValue([queuedItem('a', 'pending')]);

    const outbox = mountOutbox();
    await settle();

    directMessages.outboxItems.mockReturnValue([queuedItem('a', 'failed')]);
    outbox.emit({ kind: 'changed' });
    await settle();

    expect(outbox.messages()).toEqual([
      expect.objectContaining({ deliveryStatus: 'failed', id: 'a' }),
    ]);
  });

  it('clears the state of a send once the outbox reports it delivered', async () => {
    directMessages.queuedMessages.mockResolvedValue([message('a', 1)]);
    directMessages.outboxItems.mockReturnValue([queuedItem('a', 'pending')]);

    const outbox = mountOutbox();
    await settle();

    directMessages.outboxItems.mockReturnValue([]);
    outbox.emit({
      conversationId: 'conversation-1',
      id: 'a',
      kind: 'delivered',
    });
    await settle();

    expect(outbox.messages()[0]?.deliveryStatus).toBeUndefined();
  });

  it('ignores a delivered event for another conversation', async () => {
    directMessages.queuedMessages.mockResolvedValue([message('a', 1)]);
    directMessages.outboxItems.mockReturnValue([queuedItem('a', 'pending')]);

    const outbox = mountOutbox();
    await settle();
    outbox.onMessagesChange.mockClear();

    outbox.emit({
      conversationId: 'conversation-2',
      id: 'a',
      kind: 'delivered',
    });
    await settle();

    expect(outbox.onMessagesChange).not.toHaveBeenCalled();
    expect(outbox.messages()[0]?.deliveryStatus).toBe('pending');
  });

  it('does not bring back a send that left the queue while its refresh was pending', async () => {
    const queued = deferred<ChatMessage[]>();

    directMessages.queuedMessages.mockReturnValueOnce(queued.promise);
    directMessages.outboxItems.mockReturnValue([queuedItem('a', 'pending')]);

    const outbox = mountOutbox();

    directMessages.outboxItems.mockReturnValue([]);
    outbox.emit({
      conversationId: 'conversation-1',
      id: 'a',
      kind: 'delivered',
    });
    queued.resolve([message('a', 1)]);
    await settle();

    expect(outbox.messages()).toEqual([]);
  });

  it('leaves group conversations to the group send queue', async () => {
    mountOutbox(groupConversation);
    await settle();

    expect(directMessages.queuedMessages).not.toHaveBeenCalled();
    expect(directMessages.subscribeOutbox).not.toHaveBeenCalled();
  });

  it('unsubscribes from the outbox on cleanup', () => {
    const outbox = mountOutbox();

    outbox.cleanup();

    expect(outbox.unsubscribe).toHaveBeenCalledTimes(1);
  });
});

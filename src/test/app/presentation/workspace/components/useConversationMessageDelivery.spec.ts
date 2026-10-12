import type { SetStateAction } from 'react';

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type {
  ChatMessage,
  ConversationResource,
  MessageResource,
  Session,
  StickerMessageReference,
} from '../../../../../shared/domain/pigeonResources.types';

import { applicationContainer } from '../../../../../app/composition/applicationContainer';
import { useConversationMessageDelivery } from '../../../../../app/presentation/workspace/components/useConversationMessageDelivery';

const mockRefs: Array<{ current: unknown }> = [];

jest.mock('react', () => ({
  startTransition: (callback: () => void) => callback(),
  useCallback: <T>(callback: T) => callback,
  useRef: <T>(initial: T) => {
    const ref = { current: initial };

    mockRefs.push(ref);

    return ref;
  },
  useState: <T>(initial: T) => [initial, jest.fn()],
}));
jest.mock('../../../../../app/composition/applicationContainer', () => ({
  applicationContainer: {
    directMessages: { deliverSent: jest.fn() },
    messages: { send: jest.fn() },
    stickers: { markUsed: jest.fn() },
  },
}));

const send = jest.mocked(applicationContainer.messages.send);
const deliverSent = jest.mocked(
  applicationContainer.directMessages.deliverSent,
);
const markUsed = jest.mocked(applicationContainer.stickers.markUsed);

const session = { identity: { id: 'identity-1' } } as unknown as Session;
const conversation = {
  id: 'conversation-1',
  networkId: 'network-1',
  type: 'one-to-one',
} as unknown as ConversationResource;
const sentRaw = {
  conversationId: 'conversation-1',
  id: 'message-1',
  type: 'sent',
} as unknown as MessageResource;
const sentMessage = {
  attachments: [],
  authorIdentityId: 'identity-1',
  content: 'hello',
  encrypted: false,
  id: 'message-1',
  mine: true,
  raw: sentRaw,
  reactions: [],
  timestamp: 2000,
} as unknown as ChatMessage;
const sticker = {
  id: 'sticker-1',
  packId: 'pack-1',
} as unknown as StickerMessageReference;

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });

  return { promise, resolve };
}

async function flushMicrotasks(): Promise<void> {
  for (let tick = 0; tick < 10; tick += 1) {
    await Promise.resolve();
  }
}

async function drain(queue: { current: unknown }): Promise<void> {
  await (queue.current as Promise<void>);
}

function mountDelivery(activeConversation = conversation) {
  const state: { error: string | null; messages: ChatMessage[] } = {
    error: null,
    messages: [],
  };
  const messagesRef = { current: state.messages };
  const onErrorChange = jest.fn((error: string | null) => {
    state.error = error;
  });
  const onMessagesChange = jest.fn((update: SetStateAction<ChatMessage[]>) => {
    state.messages =
      typeof update === 'function' ? update(state.messages) : update;
    messagesRef.current = state.messages;
  });
  const delivery = useConversationMessageDelivery({
    activeConversation,
    messagesRef,
    onAttachmentProgressChange: jest.fn(),
    onConversationsChange: jest.fn(),
    onErrorChange,
    onMessagesChange,
    onReplyTargetChange: jest.fn(),
    replyTarget: null,
    scrollToBottom: jest.fn(),
    session,
  });

  return {
    ...delivery,
    queue: mockRefs[mockRefs.length - 1],
    state,
  };
}

describe('useConversationMessageDelivery inbox delivery', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockRefs.length = 0;
    send.mockResolvedValue(sentMessage);
    deliverSent.mockResolvedValue('delivered');
    markUsed.mockResolvedValue(undefined);
  });

  it('delivers the sent copy to the active conversation inbox after the legacy send resolves', async () => {
    const delivery = mountDelivery();

    await delivery.sendMessage('hello', [], {});
    await drain(delivery.queue);

    expect(send).toHaveBeenCalledTimes(1);
    expect(deliverSent).toHaveBeenCalledTimes(1);
    expect(deliverSent).toHaveBeenCalledWith(session, conversation, sentRaw);
    expect(deliverSent.mock.calls[0]?.[1]).toBe(conversation);
    expect(deliverSent.mock.calls[0]?.[2]).toBe(sentRaw);
    expect(deliverSent.mock.invocationCallOrder[0]).toBeGreaterThan(
      send.mock.invocationCallOrder[0] ?? Infinity,
    );
  });

  it('does not deliver to the inbox while the legacy send is still pending', async () => {
    const pendingSend = deferred<ChatMessage>();

    send.mockReturnValue(pendingSend.promise);
    const delivery = mountDelivery();

    await delivery.sendMessage('hello', [], {});
    await flushMicrotasks();

    expect(send).toHaveBeenCalledTimes(1);
    expect(deliverSent).not.toHaveBeenCalled();

    pendingSend.resolve(sentMessage);
    await drain(delivery.queue);

    expect(deliverSent).toHaveBeenCalledTimes(1);
    expect(deliverSent).toHaveBeenCalledWith(session, conversation, sentRaw);
  });

  it('does not deliver to the inbox when the legacy send fails', async () => {
    send.mockRejectedValue(new Error('send refused'));
    const delivery = mountDelivery();

    await delivery.sendMessage('hello', [], {});
    await drain(delivery.queue);

    expect(deliverSent).not.toHaveBeenCalled();
    expect(delivery.state.error).toBe('send refused');
  });

  it.each(['failed', 'skipped'] as const)(
    'keeps the legacy send delivered when the inbox reports %s',
    async (outcome) => {
      deliverSent.mockResolvedValue(outcome);
      const delivery = mountDelivery();

      await delivery.sendMessage('hello', [], {});
      await drain(delivery.queue);

      expect(send).toHaveBeenCalledTimes(1);
      expect(deliverSent).toHaveBeenCalledWith(session, conversation, sentRaw);
      expect(delivery.state.error).toBeNull();
      expect(delivery.state.messages).toEqual([sentMessage]);
    },
  );

  it('still makes the legacy send when inbox delivery throws', async () => {
    deliverSent.mockImplementation(() => {
      throw new Error('inbox unavailable');
    });
    const delivery = mountDelivery();

    await delivery.sendMessage('hello', [], {});
    await drain(delivery.queue);

    expect(send).toHaveBeenCalledWith(
      session,
      conversation.id,
      'hello',
      expect.objectContaining({ attachments: [] }),
    );
  });

  it('delivers sticker sends to the active conversation inbox with the sent copy', async () => {
    const delivery = mountDelivery();

    await delivery.sendSticker(sticker);
    await drain(delivery.queue);

    expect(send).toHaveBeenCalledWith(
      session,
      conversation.id,
      '',
      expect.objectContaining({ sticker }),
    );
    expect(deliverSent).toHaveBeenCalledWith(session, conversation, sentRaw);
    expect(deliverSent.mock.calls[0]?.[1]).toBe(conversation);
  });
});

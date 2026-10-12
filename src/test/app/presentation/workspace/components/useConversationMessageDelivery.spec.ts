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
import { copy } from '../../../../../shared/presentation/i18n/copy';
import { captureUnhandledRejections } from '../../../../captureUnhandledRejections';

const mockRefs: Array<{ current: unknown }> = [];
let mockRefIndex = 0;

jest.mock('react', () => ({
  startTransition: (callback: () => void) => callback(),
  useCallback: <T>(callback: T) => callback,
  useRef: <T>(initial: T) => {
    const index = mockRefIndex;

    mockRefIndex += 1;

    const ref = mockRefs[index] ?? { current: initial };

    mockRefs[index] = ref;

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

function mountDelivery(initialConversation = conversation) {
  mockRefs.length = 0;
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
  // Re-renders reuse the same refs, as a mounted component does.
  const render = (activeConversation: ConversationResource) => {
    mockRefIndex = 0;

    return useConversationMessageDelivery({
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
  };
  const delivery = render(initialConversation);

  return {
    ...delivery,
    onErrorChange,
    queue: mockRefs[mockRefs.length - 1],
    rerender: (activeConversation: ConversationResource) => {
      render(activeConversation);
    },
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

  it.each(['skipped'] as const)(
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

  it('keeps a delivered send delivered when inbox delivery throws synchronously', async () => {
    deliverSent.mockImplementation(() => {
      throw new Error('inbox unavailable');
    });
    const delivery = mountDelivery();

    await delivery.sendMessage('hello', [], {});
    await drain(delivery.queue);

    expect(send).toHaveBeenCalledTimes(1);
    expect(delivery.state.error).toBeNull();
    expect(delivery.state.messages).toEqual([sentMessage]);
  });

  it('keeps a delivered send delivered when inbox delivery rejects, with no unhandled rejection', async () => {
    deliverSent.mockRejectedValue(new Error('inbox unavailable'));
    const delivery = mountDelivery();

    const unhandled = await captureUnhandledRejections(async () => {
      await delivery.sendMessage('hello', [], {});
      await drain(delivery.queue);
    });

    expect(unhandled).toEqual([]);
    expect(delivery.state.error).toBeNull();
    expect(delivery.state.messages).toEqual([sentMessage]);
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

  it('keeps a delivered sticker send delivered when sticker usage throws synchronously', async () => {
    markUsed.mockImplementation(() => {
      throw new Error('usage unavailable');
    });
    const delivery = mountDelivery();

    await delivery.sendSticker(sticker);
    await drain(delivery.queue);

    expect(send).toHaveBeenCalledTimes(1);
    expect(deliverSent).toHaveBeenCalledWith(session, conversation, sentRaw);
    expect(delivery.state.error).toBeNull();
    expect(delivery.state.messages).toEqual([sentMessage]);
  });

  it('keeps a delivered sticker send delivered when sticker usage rejects, with no unhandled rejection', async () => {
    markUsed.mockRejectedValue(new Error('usage unavailable'));
    const delivery = mountDelivery();

    const unhandled = await captureUnhandledRejections(async () => {
      await delivery.sendSticker(sticker);
      await drain(delivery.queue);
    });

    expect(unhandled).toEqual([]);
    expect(send).toHaveBeenCalledTimes(1);
    expect(delivery.state.error).toBeNull();
    expect(delivery.state.messages).toEqual([sentMessage]);
  });

  it('shows the direct copy notice when the inbox copy fails after the legacy send delivers', async () => {
    deliverSent.mockResolvedValue('failed');
    const mounted = mountDelivery();

    await mounted.sendMessage('hello', [], {});
    await drain(mounted.queue);
    await flushMicrotasks();

    expect(send).toHaveBeenCalledTimes(1);
    expect(mounted.state.error).toBe(copy.workspace.directMailboxDeliveryError);
    expect(mounted.state.messages).toEqual([sentMessage]);
  });

  it('clears the direct copy notice once a later inbox copy is delivered', async () => {
    deliverSent
      .mockResolvedValueOnce('failed')
      .mockResolvedValueOnce('delivered');
    const mounted = mountDelivery();

    await mounted.sendMessage('hello', [], {});
    await drain(mounted.queue);
    await flushMicrotasks();
    expect(mounted.state.error).toBe(copy.workspace.directMailboxDeliveryError);

    await mounted.sendMessage('again', [], {});
    await drain(mounted.queue);
    await flushMicrotasks();

    expect(mounted.state.error).toBeNull();
  });

  it('keeps one copy notice steady across repeated inbox failures', async () => {
    deliverSent.mockResolvedValue('failed');
    const mounted = mountDelivery();

    await mounted.sendMessage('hello', [], {});
    await drain(mounted.queue);
    await flushMicrotasks();
    await mounted.sendMessage('again', [], {});
    await drain(mounted.queue);
    await flushMicrotasks();

    const errors = mounted.onErrorChange.mock.calls.map(([error]) => error);
    const firstNotice = errors.indexOf(
      copy.workspace.directMailboxDeliveryError,
    );

    expect(firstNotice).toBeGreaterThanOrEqual(0);
    expect(errors.slice(firstNotice)).not.toContain(null);
    expect(mounted.state.error).toBe(copy.workspace.directMailboxDeliveryError);
  });

  it('does not show the copy notice on a conversation that is no longer active', async () => {
    const pendingCopy = deferred<'delivered' | 'failed' | 'skipped'>();
    const otherConversation = {
      ...conversation,
      id: 'conversation-2',
    } as unknown as ConversationResource;
    deliverSent.mockReturnValue(pendingCopy.promise);
    const mounted = mountDelivery();

    await mounted.sendMessage('hello', [], {});
    await drain(mounted.queue);
    mounted.rerender(otherConversation);
    pendingCopy.resolve('failed');
    await flushMicrotasks();

    expect(mounted.onErrorChange).not.toHaveBeenCalledWith(
      copy.workspace.directMailboxDeliveryError,
    );
    expect(mounted.state.error).toBeNull();
  });

  it('does not keep a stale send error behind the copy notice', async () => {
    deliverSent
      .mockResolvedValueOnce('failed')
      .mockResolvedValueOnce('skipped');
    const mounted = mountDelivery();

    await mounted.sendMessage('hello', [], {});
    await drain(mounted.queue);
    await flushMicrotasks();
    send.mockRejectedValueOnce(new Error('send refused'));
    await mounted.sendMessage('again', [], {});
    await drain(mounted.queue);
    await flushMicrotasks();
    expect(mounted.state.error).toBe('send refused');

    await mounted.sendMessage('third', [], {});
    await drain(mounted.queue);
    await flushMicrotasks();

    expect(mounted.state.error).toBeNull();
  });
});

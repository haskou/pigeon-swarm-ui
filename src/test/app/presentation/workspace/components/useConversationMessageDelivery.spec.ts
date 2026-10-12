import type { SetStateAction } from 'react';

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type {
  ChatMessage,
  ConversationResource,
  Session,
  StickerMessageReference,
} from '../../../../../shared/domain/pigeonResources.types';

import { applicationContainer } from '../../../../../app/composition/applicationContainer';
import { useConversationMessageDelivery } from '../../../../../app/presentation/workspace/components/useConversationMessageDelivery';
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
    directMessages: { send: jest.fn() },
    messages: { send: jest.fn() },
    stickers: { markUsed: jest.fn() },
  },
}));

const directSend = jest.mocked(applicationContainer.directMessages.send);
const legacySend = jest.mocked(applicationContainer.messages.send);
const markUsed = jest.mocked(applicationContainer.stickers.markUsed);

const session = { identity: { id: 'identity-1' } } as unknown as Session;
const conversation = {
  id: 'conversation-1',
  networkId: 'network-1',
  participantIds: ['identity-1', 'identity-2'],
  type: 'one-to-one',
} as unknown as ConversationResource;
const groupConversation = {
  id: 'conversation-2',
  networkId: 'network-1',
  participantIds: ['identity-1', 'identity-3'],
  type: 'group',
} as unknown as ConversationResource;
const sentMessage = {
  attachments: [],
  authorIdentityId: 'identity-1',
  content: 'hello',
  encrypted: false,
  id: 'message-1',
  raw: { id: 'message-1', type: 'sent' },
  mine: true,
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

describe('useConversationMessageDelivery one-to-one mailbox send', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockRefs.length = 0;
    directSend.mockResolvedValue(sentMessage);
    legacySend.mockResolvedValue(sentMessage);
    markUsed.mockResolvedValue(undefined);
  });

  it('sends a one-to-one message through the mailbox and never the legacy message endpoint', async () => {
    const delivery = mountDelivery();

    await delivery.sendMessage('hello', [], {});
    await drain(delivery.queue);

    expect(directSend).toHaveBeenCalledTimes(1);
    expect(directSend).toHaveBeenCalledWith(
      session,
      conversation,
      'hello',
      expect.objectContaining({ attachments: [], previousMessageIds: [] }),
    );
    expect(legacySend).not.toHaveBeenCalled();
  });

  it('passes the one-to-one recipient identity with attachment uploads to the mailbox send', async () => {
    const delivery = mountDelivery();

    await delivery.sendMessage('hello', [], {});
    await drain(delivery.queue);

    expect(directSend).toHaveBeenCalledWith(
      session,
      conversation,
      'hello',
      expect.objectContaining({
        attachmentUpload: {
          networkId: 'network-1',
          recipientIdentityId: 'identity-2',
        },
      }),
    );
  });

  it('shows the mailbox-projected sent message in place of the optimistic one', async () => {
    const delivery = mountDelivery();

    await delivery.sendMessage('hello', [], {});
    await drain(delivery.queue);

    expect(delivery.state.error).toBeNull();
    expect(delivery.state.messages).toEqual([sentMessage]);
  });

  it('marks the message failed with the send error when the mailbox send rejects', async () => {
    directSend.mockRejectedValue(new Error('send refused'));
    const delivery = mountDelivery();

    await delivery.sendMessage('hello', [], {});
    await drain(delivery.queue);

    expect(delivery.state.error).toBe('send refused');
    expect(delivery.state.messages).toEqual([
      expect.objectContaining({ deliveryStatus: 'failed' }),
    ]);
    expect(legacySend).not.toHaveBeenCalled();
  });

  it('clears a previous send error when the next one-to-one send starts', async () => {
    directSend.mockRejectedValueOnce(new Error('send refused'));
    const delivery = mountDelivery();

    await delivery.sendMessage('hello', [], {});
    await drain(delivery.queue);
    expect(delivery.state.error).toBe('send refused');

    await delivery.sendMessage('again', [], {});
    await drain(delivery.queue);

    expect(delivery.state.error).toBeNull();
  });

  it('delivers one-to-one sticker sends through the mailbox', async () => {
    const delivery = mountDelivery();

    await delivery.sendSticker(sticker);
    await drain(delivery.queue);

    expect(directSend).toHaveBeenCalledWith(
      session,
      conversation,
      '',
      expect.objectContaining({ sticker }),
    );
    expect(legacySend).not.toHaveBeenCalled();
    expect(markUsed).toHaveBeenCalledWith(session, sticker);
  });

  it('keeps a delivered sticker send delivered when sticker usage throws synchronously', async () => {
    markUsed.mockImplementation(() => {
      throw new Error('usage unavailable');
    });
    const delivery = mountDelivery();

    await delivery.sendSticker(sticker);
    await drain(delivery.queue);

    expect(directSend).toHaveBeenCalledTimes(1);
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
    expect(directSend).toHaveBeenCalledTimes(1);
    expect(delivery.state.error).toBeNull();
    expect(delivery.state.messages).toEqual([sentMessage]);
  });

  it('keeps the optimistic message pending while the mailbox send is still running', async () => {
    const pendingSend = deferred<ChatMessage>();

    directSend.mockReturnValue(pendingSend.promise);
    const delivery = mountDelivery();

    await delivery.sendMessage('hello', [], {});
    await flushMicrotasks();

    expect(directSend).toHaveBeenCalledTimes(1);
    expect(delivery.state.messages).toEqual([
      expect.objectContaining({ content: 'hello' }),
    ]);

    pendingSend.resolve(sentMessage);
    await drain(delivery.queue);

    expect(delivery.state.messages).toEqual([sentMessage]);
  });
});

describe('useConversationMessageDelivery group send', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockRefs.length = 0;
    directSend.mockResolvedValue(sentMessage);
    legacySend.mockResolvedValue(sentMessage);
    markUsed.mockResolvedValue(undefined);
  });

  it('sends group messages through the legacy message endpoint only', async () => {
    const delivery = mountDelivery(groupConversation);

    await delivery.sendMessage('hello', [], {});
    await drain(delivery.queue);

    expect(legacySend).toHaveBeenCalledWith(
      session,
      groupConversation.id,
      'hello',
      expect.objectContaining({ attachments: [] }),
    );
    expect(directSend).not.toHaveBeenCalled();
  });

  it('sends no recipient identity for group attachment uploads', async () => {
    const delivery = mountDelivery(groupConversation);

    await delivery.sendMessage('hello', [], {});
    await drain(delivery.queue);

    expect(legacySend).toHaveBeenCalledTimes(1);
    expect(
      legacySend.mock.calls[0]?.[3]?.attachmentUpload?.recipientIdentityId,
    ).toBeUndefined();
  });

  it('shows the send error for a failed group send', async () => {
    legacySend.mockRejectedValue(new Error('send refused'));
    const delivery = mountDelivery(groupConversation);

    await delivery.sendMessage('hello', [], {});
    await drain(delivery.queue);

    expect(delivery.state.error).toBe('send refused');
    expect(delivery.state.messages).toEqual([
      expect.objectContaining({ deliveryStatus: 'failed' }),
    ]);
  });
});

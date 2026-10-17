import type { SetStateAction } from 'react';

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { ConversationResource } from '../../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { ChatMessage } from '../../../../../contexts/messages/domain/ChatMessage';
import type { DirectMessageOutboxItem } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageOutboxItem';
import type { StickerMessageReference } from '../../../../../contexts/stickers/infrastructure/http/resources/StickerMessageReference';

import { applicationContainer } from '../../../../../app/composition/applicationContainer';
import { useConversationMessageDelivery } from '../../../../../app/presentation/workspace/components/useConversationMessageDelivery';
import { GroupMailboxUpdateFailedError } from '../../../../../contexts/groupMailboxes/infrastructure/control/GroupMailboxUpdateFailedError';
import { HttpJsonError } from '../../../../../shared/infrastructure/http/HttpJsonError';
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
    directMessages: {
      outboxItems: jest.fn(),
      retry: jest.fn(),
      send: jest.fn(),
    },
    groupMessages: {
      retry: jest.fn(),
      send: jest.fn(),
      withOutboxState: jest.fn(),
    },
    stickers: { markUsed: jest.fn() },
  },
}));

const directSend = jest.mocked(applicationContainer.directMessages.send);
const directRetry = jest.mocked(applicationContainer.directMessages.retry);
const outboxItems = jest.mocked(
  applicationContainer.directMessages.outboxItems,
);
const groupSend = jest.mocked(applicationContainer.groupMessages.send);
const groupRetry = jest.mocked(applicationContainer.groupMessages.retry);
const groupOutboxState = jest.mocked(
  applicationContainer.groupMessages.withOutboxState,
);
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
  mine: true,
  raw: { id: 'message-1', type: 'sent' },
  reactions: [],
  timestamp: 2000,
} as unknown as ChatMessage;
const sticker = {
  id: 'sticker-1',
  packId: 'pack-1',
} as unknown as StickerMessageReference;
const commandIdentity = expect.objectContaining({
  createdAt: expect.any(Number),
  id: expect.any(String),
});

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });

  return { promise, resolve };
}

async function flushMicrotasks(): Promise<void> {
  for (let tick = 0; tick < 10; tick += 1) {
    await Promise.resolve();
  }
}

// Waits for every chained microtask, including the group send queue.
async function drain(): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

function onlyMessage(delivery: {
  state: { messages: ChatMessage[] };
}): ChatMessage {
  const [message] = delivery.state.messages;

  if (!message) throw new Error('expected one message');

  return message;
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
    directRetry.mockResolvedValue(null);
    outboxItems.mockReturnValue([]);
    markUsed.mockResolvedValue(undefined);
  });

  it('sends a one-to-one message through the mailbox', async () => {
    const delivery = mountDelivery();

    await delivery.sendMessage('hello', [], {});
    await drain();

    expect(directSend).toHaveBeenCalledTimes(1);
    expect(directSend).toHaveBeenCalledWith(
      session,
      conversation,
      'hello',
      expect.objectContaining({ attachments: [], previousMessageIds: [] }),
      commandIdentity,
    );
  });

  it('passes the one-to-one recipient identity with attachment uploads to the mailbox send', async () => {
    const delivery = mountDelivery();

    await delivery.sendMessage('hello', [], {});
    await drain();

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
      commandIdentity,
    );
  });

  it('uses the optimistic message id as the mailbox record id', async () => {
    const pendingSend = deferred<ChatMessage>();

    directSend.mockReturnValue(pendingSend.promise);
    const delivery = mountDelivery();

    await delivery.sendMessage('hello', [], {});
    await flushMicrotasks();

    expect(directSend.mock.calls[0]?.[4]).toEqual({
      createdAt: onlyMessage(delivery).timestamp,
      id: onlyMessage(delivery).id,
    });

    pendingSend.resolve(sentMessage);
    await drain();
  });

  it('starts the next one-to-one send without waiting for an earlier one to finish', async () => {
    const firstSend = deferred<ChatMessage>();

    directSend
      .mockReturnValueOnce(firstSend.promise)
      .mockResolvedValueOnce(sentMessage);
    const delivery = mountDelivery();

    await delivery.sendMessage('first', [], {});
    await delivery.sendMessage('second', [], {});
    await flushMicrotasks();

    expect(directSend).toHaveBeenCalledTimes(2);

    firstSend.resolve(sentMessage);
    await drain();
  });

  it('shows the mailbox-projected sent message in place of the optimistic one', async () => {
    const delivery = mountDelivery();

    await delivery.sendMessage('hello', [], {});
    await drain();

    expect(delivery.state.error).toBeNull();
    expect(delivery.state.messages).toEqual([sentMessage]);
  });

  it('keeps a one-to-one send pending while it waits in the outbox', async () => {
    outboxItems.mockReturnValue([
      {
        conversationId: conversation.id,
        id: sentMessage.id,
        record: {} as DirectMessageOutboxItem['record'],
        state: 'retry',
      },
    ]);
    const delivery = mountDelivery();

    await delivery.sendMessage('hello', [], {});
    await drain();

    expect(delivery.state.messages).toEqual([
      expect.objectContaining({ deliveryStatus: 'retry', id: sentMessage.id }),
    ]);
  });

  it('marks the message failed with the send error when the mailbox send rejects', async () => {
    directSend.mockRejectedValue(new Error('send refused'));
    const delivery = mountDelivery();

    await delivery.sendMessage('hello', [], {});
    await drain();

    expect(delivery.state.error).toBe('send refused');
    expect(delivery.state.messages).toEqual([
      expect.objectContaining({ deliveryStatus: 'failed' }),
    ]);
  });

  it('shows a refused peer write to the composer as the user error', async () => {
    directSend.mockRejectedValue(new HttpJsonError(404, 'Not Found', ''));
    const delivery = mountDelivery();

    await delivery.sendMessage('hello', [], {});
    await drain();

    expect(delivery.state.error).toBe(copy.errors.notFound);
    expect(delivery.state.messages).toEqual([
      expect.objectContaining({ deliveryStatus: 'failed' }),
    ]);
  });

  it('retries a queued one-to-one message through the outbox without sending it again', async () => {
    directSend.mockRejectedValueOnce(new Error('send refused'));
    directRetry.mockResolvedValueOnce(sentMessage);
    const delivery = mountDelivery();

    await delivery.sendMessage('hello', [], {});
    await drain();

    const failed = onlyMessage(delivery);

    delivery.retryMessage(failed);
    await drain();

    expect(directRetry).toHaveBeenCalledWith(session, conversation, failed.id);
    expect(directSend).toHaveBeenCalledTimes(1);
    expect(delivery.state.messages).toEqual([sentMessage]);
    expect(delivery.state.error).toBeNull();
  });

  it('sends a failed one-to-one message again with its record id when the outbox never queued it', async () => {
    directSend
      .mockRejectedValueOnce(new Error('send refused'))
      .mockResolvedValueOnce(sentMessage);
    directRetry.mockResolvedValueOnce(null);
    const delivery = mountDelivery();

    await delivery.sendMessage('hello', [], {});
    await drain();

    const failed = onlyMessage(delivery);

    delivery.retryMessage(failed);
    await drain();

    expect(directSend).toHaveBeenCalledTimes(2);
    expect(directSend).toHaveBeenLastCalledWith(
      session,
      conversation,
      'hello',
      expect.anything(),
      { createdAt: expect.any(Number), id: failed.id },
    );
    expect(delivery.state.messages).toEqual([sentMessage]);
  });

  it('clears a previous send error when the next one-to-one send starts', async () => {
    directSend.mockRejectedValueOnce(new Error('send refused'));
    const delivery = mountDelivery();

    await delivery.sendMessage('hello', [], {});
    await drain();
    expect(delivery.state.error).toBe('send refused');

    await delivery.sendMessage('again', [], {});
    await drain();

    expect(delivery.state.error).toBeNull();
  });

  it('delivers one-to-one sticker sends through the mailbox', async () => {
    const delivery = mountDelivery();

    await delivery.sendSticker(sticker);
    await drain();

    expect(directSend).toHaveBeenCalledWith(
      session,
      conversation,
      '',
      expect.objectContaining({ sticker }),
      commandIdentity,
    );
    expect(markUsed).toHaveBeenCalledWith(session, sticker);
  });

  it('keeps a delivered sticker send delivered when sticker usage throws synchronously', async () => {
    markUsed.mockImplementation(() => {
      throw new Error('usage unavailable');
    });
    const delivery = mountDelivery();

    await delivery.sendSticker(sticker);
    await drain();

    expect(directSend).toHaveBeenCalledTimes(1);
    expect(delivery.state.error).toBeNull();
    expect(delivery.state.messages).toEqual([sentMessage]);
  });

  it('keeps a delivered sticker send delivered when sticker usage rejects, with no unhandled rejection', async () => {
    markUsed.mockRejectedValue(new Error('usage unavailable'));
    const delivery = mountDelivery();

    const unhandled = await captureUnhandledRejections(async () => {
      await delivery.sendSticker(sticker);
      await drain();
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
    await drain();

    expect(delivery.state.messages).toEqual([sentMessage]);
  });
});

describe('useConversationMessageDelivery group send', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockRefs.length = 0;
    directSend.mockResolvedValue(sentMessage);
    groupSend.mockResolvedValue(sentMessage);
    markUsed.mockResolvedValue(undefined);
  });

  it('sends group messages through the group mailbox only', async () => {
    const delivery = mountDelivery(groupConversation);

    await delivery.sendMessage('hello', [], {});
    await drain();

    expect(groupSend).toHaveBeenCalledWith(
      session,
      groupConversation,
      'hello',
      expect.objectContaining({ attachments: [] }),
    );
    expect(directSend).not.toHaveBeenCalled();
  });

  it('sends no recipient identity for group attachment uploads', async () => {
    const delivery = mountDelivery(groupConversation);

    await delivery.sendMessage('hello', [], {});
    await drain();

    expect(groupSend).toHaveBeenCalledTimes(1);
    expect(
      groupSend.mock.calls[0]?.[3]?.attachmentUpload?.recipientIdentityId,
    ).toBeUndefined();
  });

  it('shows the send error for a failed group send', async () => {
    groupSend.mockRejectedValue(new Error('send refused'));
    const delivery = mountDelivery(groupConversation);

    await delivery.sendMessage('hello', [], {});
    await drain();

    expect(delivery.state.error).toBe('send refused');
    expect(delivery.state.messages).toEqual([
      expect.objectContaining({ deliveryStatus: 'failed' }),
    ]);
  });

  it('shows a group send whose leaf update failed as failed, and sends it on retry', async () => {
    groupSend
      .mockRejectedValueOnce(new GroupMailboxUpdateFailedError())
      .mockResolvedValueOnce(sentMessage);
    const delivery = mountDelivery(groupConversation);

    await delivery.sendMessage('hello', [], {});
    await drain();

    expect(delivery.state.error).toBe(
      copy.errors.backend.GroupMailboxUpdateFailedError,
    );
    const failed = onlyMessage(delivery);

    expect(failed).toEqual(
      expect.objectContaining({ content: 'hello', deliveryStatus: 'failed' }),
    );

    delivery.retryMessage(failed);
    await drain();

    expect(groupSend).toHaveBeenCalledTimes(2);
    expect(groupSend.mock.calls[1]?.[2]).toBe('hello');
    expect(delivery.state.messages).toEqual([sentMessage]);
    expect(delivery.state.error).toBeNull();
  });

  it('retries a group message the outbox kept as failed and shows its new state', async () => {
    const failed = { ...sentMessage, deliveryStatus: 'failed' as const };
    const queued = { ...sentMessage, deliveryStatus: 'pending' as const };

    groupRetry.mockResolvedValue(true);
    groupOutboxState.mockReturnValue([queued]);
    const delivery = mountDelivery(groupConversation);

    delivery.state.messages = [failed];
    delivery.retryMessage(failed);
    await drain();

    expect(groupRetry).toHaveBeenCalledWith(
      session,
      groupConversation.id,
      failed.id,
    );
    expect(groupOutboxState).toHaveBeenCalledWith(
      session,
      groupConversation.id,
      [failed],
    );
    expect(groupSend).not.toHaveBeenCalled();
    expect(delivery.state.messages).toEqual([queued]);
    expect(delivery.state.error).toBeNull();
  });

  it('keeps a group message failed and shows why when its retry is refused', async () => {
    const failed = { ...sentMessage, deliveryStatus: 'failed' as const };

    groupRetry.mockRejectedValue(new Error('retry refused'));
    const delivery = mountDelivery(groupConversation);

    delivery.state.messages = [failed];
    delivery.retryMessage(failed);
    await drain();

    expect(delivery.state.messages).toEqual([failed]);
    expect(delivery.state.error).toBe('retry refused');
  });
});

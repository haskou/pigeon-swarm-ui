import { beforeEach, describe, expect, it, jest } from '@jest/globals';

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
    jest.clearAllMocks();
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
});

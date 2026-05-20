import type {
  ChatMessage,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { SendMessagePort } from '../ports/sendMessagePort';

import { SendMessageMessage } from './messages/sendMessageMessage';
import { SendMessage } from './sendMessage';

describe(SendMessage.name, () => {
  it('delegates message sending to the pigeon API gateway', async () => {
    const session = { password: 'secret' } as Session;
    const expected = { content: 'hello' } as ChatMessage;
    const gateway = {
      sendMessage: jest.fn().mockResolvedValue(expected),
    } as unknown as SendMessagePort;
    const useCase = new SendMessage(gateway);

    await expect(
      useCase.send(
        new SendMessageMessage({
          content: 'hello',
          conversationId: 'conversation-1',
          options: { previousMessageIds: ['previous'] },
          session,
        }),
      ),
    ).resolves.toBe(expected);
    expect(gateway.sendMessage).toHaveBeenCalledWith(
      session,
      'conversation-1',
      'hello',
      { previousMessageIds: ['previous'] },
    );
  });

  it('passes selected attachments to the gateway', async () => {
    const session = { password: 'secret' } as Session;
    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });
    const expected = { content: 'hello' } as ChatMessage;
    const gateway = {
      sendMessage: jest.fn().mockResolvedValue(expected),
    } as unknown as SendMessagePort;
    const useCase = new SendMessage(gateway);

    await expect(
      useCase.send(
        new SendMessageMessage({
          content: 'hello',
          conversationId: 'conversation-1',
          options: { attachments: [file] },
          session,
        }),
      ),
    ).resolves.toBe(expected);
    expect(gateway.sendMessage).toHaveBeenCalledWith(
      session,
      'conversation-1',
      'hello',
      { attachments: [file] },
    );
  });

  it('passes reply targets to the gateway', async () => {
    const session = { password: 'secret' } as Session;
    const expected = { content: 'hello' } as ChatMessage;
    const gateway = {
      sendMessage: jest.fn().mockResolvedValue(expected),
    } as unknown as SendMessagePort;
    const replyPreview = {
      authorIdentityId: 'identity-2',
      content: 'original',
      messageId: 'message-1',
    };
    const useCase = new SendMessage(gateway);

    await expect(
      useCase.send(
        new SendMessageMessage({
          content: 'hello',
          conversationId: 'conversation-1',
          options: {
            replyPreview,
            replyToMessageId: 'message-1',
          },
          session,
        }),
      ),
    ).resolves.toBe(expected);
    expect(gateway.sendMessage).toHaveBeenCalledWith(
      session,
      'conversation-1',
      'hello',
      {
        replyPreview,
        replyToMessageId: 'message-1',
      },
    );
  });
});

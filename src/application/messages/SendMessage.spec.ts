import type { ChatMessage, Session } from '../../domain/types';
import type { PigeonApiGateway } from '../../infrastructure/pigeon-api/PigeonApiGateway';

import { SendMessage } from './SendMessage';

describe(SendMessage.name, () => {
  it('delegates message sending to the pigeon API gateway', async () => {
    const session = { password: 'secret' } as Session;
    const expected = { content: 'hello' } as ChatMessage;
    const gateway = {
      sendMessage: jest.fn().mockResolvedValue(expected),
    } as unknown as PigeonApiGateway;
    const useCase = new SendMessage(gateway);

    await expect(
      useCase.execute(session, 'conversation-1', 'hello', {
        previousMessageIds: ['previous'],
      }),
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
    } as unknown as PigeonApiGateway;
    const useCase = new SendMessage(gateway);

    await expect(
      useCase.execute(session, 'conversation-1', 'hello', {
        attachments: [file],
      }),
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
    } as unknown as PigeonApiGateway;
    const replyPreview = {
      authorIdentityId: 'identity-2',
      content: 'original',
      messageId: 'message-1',
    };
    const useCase = new SendMessage(gateway);

    await expect(
      useCase.execute(session, 'conversation-1', 'hello', {
        replyPreview,
        replyToMessageId: 'message-1',
      }),
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

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
      useCase.execute(session, 'conversation-1', 'hello', ['previous']),
    ).resolves.toBe(expected);
    expect(gateway.sendMessage).toHaveBeenCalledWith(
      session,
      'conversation-1',
      'hello',
      ['previous'],
    );
  });
});

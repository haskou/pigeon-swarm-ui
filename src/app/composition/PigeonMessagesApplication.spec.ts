import type {
  ChatMessage,
  Session,
} from '../../shared/domain/pigeonResources.types';

import { PigeonApiGateway } from './PigeonApiGateway';
import { PigeonMessagesApplication } from './PigeonMessagesApplication';

describe(PigeonMessagesApplication.name, () => {
  function gatewayDouble(): jest.Mocked<PigeonApiGateway> {
    return {
      addMessageReaction: jest.fn(),
      loadMessages: jest.fn(),
      sendMessage: jest.fn(),
    } as unknown as jest.Mocked<PigeonApiGateway>;
  }

  const session = {
    identity: { id: 'identity-1' },
  } as unknown as Session;

  it('sends messages through the message application boundary', async () => {
    const gateway = gatewayDouble();
    const sent = { id: 'message-1' } as ChatMessage;
    gateway.sendMessage.mockResolvedValue(sent);
    const application = new PigeonMessagesApplication(gateway);

    await expect(
      application.send(session, 'conversation-1', 'Hello'),
    ).resolves.toBe(sent);
    expect(gateway.sendMessage).toHaveBeenCalledWith(
      session,
      'conversation-1',
      'Hello',
      {},
    );
  });

  it('loads paginated messages through the load use case', async () => {
    const gateway = gatewayDouble();
    const result = { messages: [], nextCursor: null };
    gateway.loadMessages.mockResolvedValue(result);
    const application = new PigeonMessagesApplication(gateway);

    await expect(
      application.load(session, 'conversation-1', 'message-20', {
        limit: 20,
      }),
    ).resolves.toBe(result);
    expect(gateway.loadMessages).toHaveBeenCalledWith(
      session,
      'conversation-1',
      'message-20',
      { limit: 20 },
    );
  });

  it('adds reactions through validated message identifiers', async () => {
    const gateway = gatewayDouble();
    const application = new PigeonMessagesApplication(gateway);

    await application.addReactionTo(
      session,
      'conversation-1',
      'message-1',
      'heart',
    );

    expect(gateway.addMessageReaction).toHaveBeenCalledWith(
      session,
      'conversation-1',
      'message-1',
      'heart',
    );
  });
});

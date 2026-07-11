import type {
  ConversationResource,
  Session,
} from '../../../shared/domain/pigeonResources.types';
import type { ConversationsGateway } from './ports/ConversationsGateway';

import { PigeonConversationsApplication } from './PigeonConversationsApplication';

describe(PigeonConversationsApplication.name, () => {
  function gatewayDouble(): jest.Mocked<ConversationsGateway> {
    return {
      createConversation: jest.fn(),
      listConversations: jest.fn(),
      markConversationReadUntil: jest.fn(),
    } as unknown as jest.Mocked<ConversationsGateway>;
  }

  const session = {
    identity: { id: 'identity-1' },
  } as unknown as Session;

  it('creates conversations through validated application messages', async () => {
    const gateway = gatewayDouble();
    const created = {
      conversation: { id: 'conversation-1', networkId: 'network-1' },
      keychain: { conversations: {}, version: 1 },
      keychainExternalIdentifier: 'keychain-cid',
    };
    gateway.createConversation.mockResolvedValue(created);
    const application = new PigeonConversationsApplication(gateway);

    await expect(
      application.create(session, 'identity-2', 'network-1'),
    ).resolves.toBe(created);
    expect(gateway.createConversation).toHaveBeenCalledWith(
      session,
      'identity-2',
      'network-1',
    );
  });

  it('lists conversations through the timeline use case boundary', async () => {
    const gateway = gatewayDouble();
    const conversations = [{ id: 'conversation-1' }] as ConversationResource[];
    gateway.listConversations.mockResolvedValue(conversations);
    const application = new PigeonConversationsApplication(gateway);

    await expect(application.list(session)).resolves.toEqual(conversations);
    expect(gateway.listConversations).toHaveBeenCalledWith(session);
  });

  it('marks the explicit message boundary as read', async () => {
    const gateway = gatewayDouble();
    const application = new PigeonConversationsApplication(gateway);

    await application.markReadUntil(session, 'conversation-1', 'message-1');

    expect(gateway.markConversationReadUntil).toHaveBeenCalledWith(
      session,
      'conversation-1',
      'message-1',
    );
  });
});

import { ConversationParticipantId } from '../../../../../contexts/conversations/domain/value-objects/ConversationParticipantId';
import { ConversationAccessContexts } from '../../../../../contexts/conversations/infrastructure/http/ConversationAccessContexts';
import { ConversationAccessContextNotFoundError } from '../../../../../contexts/conversations/infrastructure/http/errors/ConversationAccessContextNotFoundError';
import { sessionFixture } from '../../ConversationFixture';

describe(ConversationAccessContexts.name, () => {
  it('finds a registered session by domain identity', () => {
    const contexts = new ConversationAccessContexts();
    const session = sessionFixture();

    contexts.register(session);

    expect(
      contexts.find(ConversationParticipantId.fromString('identity-a')),
    ).toBe(session);
  });

  it('fails explicitly when no access context was registered', () => {
    expect(() =>
      new ConversationAccessContexts().find(
        ConversationParticipantId.fromString('identity-a'),
      ),
    ).toThrow(ConversationAccessContextNotFoundError);
  });
});

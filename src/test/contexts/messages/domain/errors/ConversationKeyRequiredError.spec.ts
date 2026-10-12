import { DomainError } from '@haskou/value-objects';

import { ConversationKeyRequiredError } from '../../../../../contexts/messages/domain/errors/ConversationKeyRequiredError';

describe(ConversationKeyRequiredError.name, () => {
  it('keeps the conversation key message', () => {
    expect(new ConversationKeyRequiredError().message).toBe(
      'Conversation key is required.',
    );
  });

  it('is a domain error', () => {
    expect(new ConversationKeyRequiredError()).toBeInstanceOf(DomainError);
  });
});

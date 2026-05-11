import { MessageSignaturePayloadFactory } from './MessageSignaturePayloadFactory';

describe(MessageSignaturePayloadFactory.name, () => {
  it('builds the canonical sent-message payload expected by the backend', () => {
    const payload = new MessageSignaturePayloadFactory().createSent({
      attachmentExternalIdentifiers: [],
      authorId: 'identity-1',
      conversationId: 'one-to-one:conversation',
      createdAt: 123,
      encryptedPayload: 'encrypted',
      id: 'message-1',
      previousMessageIds: ['previous-message'],
    });

    expect(Object.keys(payload)).toEqual([
      'attachmentExternalIdentifiers',
      'authorId',
      'conversationId',
      'createdAt',
      'encryptedPayload',
      'id',
      'previousMessageIds',
      'targetMessageId',
      'type',
    ]);
    expect(payload).toEqual({
      attachmentExternalIdentifiers: [],
      authorId: 'identity-1',
      conversationId: 'one-to-one:conversation',
      createdAt: 123,
      encryptedPayload: 'encrypted',
      id: 'message-1',
      previousMessageIds: ['previous-message'],
      targetMessageId: undefined,
      type: 'sent',
    });
    expect(JSON.stringify(payload)).not.toContain('targetMessageId');
  });
});

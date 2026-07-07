import { MessageSignaturePayloadFactory } from './MessageSignaturePayloadFactory';

describe(MessageSignaturePayloadFactory.name, () => {
  it('builds the canonical deleted-message payload expected by the backend', () => {
    const payload = new MessageSignaturePayloadFactory().createDeleted({
      authorId: 'identity-1',
      conversationId: 'one-to-one:conversation',
      createdAt: 123,
      id: 'delete-message-1',
      targetMessageId: 'message-1',
    });

    expect(Object.keys(payload)).toEqual([
      'authorId',
      'conversationId',
      'createdAt',
      'encryptedPayload',
      'id',
      'previousMessageIds',
      'replyToMessageId',
      'targetMessageId',
      'type',
    ]);
    expect(payload).toEqual({
      authorId: 'identity-1',
      conversationId: 'one-to-one:conversation',
      createdAt: 123,
      encryptedPayload: undefined,
      id: 'delete-message-1',
      previousMessageIds: ['message-1'],
      replyToMessageId: undefined,
      targetMessageId: 'message-1',
      type: 'deleted',
    });
    expect(JSON.stringify(payload)).not.toContain('encryptedPayload');
  });

  it('builds the canonical sent-message payload expected by the backend', () => {
    const payload = new MessageSignaturePayloadFactory().createSent({
      authorId: 'identity-1',
      conversationId: 'one-to-one:conversation',
      createdAt: 123,
      encryptedPayload: 'encrypted',
      id: 'message-1',
      previousMessageIds: ['previous-message'],
      replyToMessageId: 'original-message',
    });

    expect(Object.keys(payload)).toEqual([
      'authorId',
      'conversationId',
      'createdAt',
      'encryptedPayload',
      'id',
      'previousMessageIds',
      'replyToMessageId',
      'targetMessageId',
      'type',
    ]);
    expect(payload).toEqual({
      authorId: 'identity-1',
      conversationId: 'one-to-one:conversation',
      createdAt: 123,
      encryptedPayload: 'encrypted',
      id: 'message-1',
      previousMessageIds: ['previous-message'],
      replyToMessageId: 'original-message',
      targetMessageId: undefined,
      type: 'sent',
    });
    expect(JSON.stringify(payload)).not.toContain('targetMessageId');
  });

  it('builds the canonical edited-message payload expected by the backend', () => {
    const payload = new MessageSignaturePayloadFactory().createEdited({
      authorId: 'identity-1',
      conversationId: 'one-to-one:conversation',
      createdAt: 123,
      encryptedPayload: 'encrypted',
      id: 'edit-message-1',
      targetMessageId: 'message-1',
    });

    expect(Object.keys(payload)).toEqual([
      'authorId',
      'conversationId',
      'createdAt',
      'encryptedPayload',
      'id',
      'previousMessageIds',
      'replyToMessageId',
      'targetMessageId',
      'type',
    ]);
    expect(payload).toEqual({
      authorId: 'identity-1',
      conversationId: 'one-to-one:conversation',
      createdAt: 123,
      encryptedPayload: 'encrypted',
      id: 'edit-message-1',
      previousMessageIds: ['message-1'],
      replyToMessageId: undefined,
      targetMessageId: 'message-1',
      type: 'edited',
    });
    expect(JSON.stringify(payload)).not.toContain('replyToMessageId');
  });
});

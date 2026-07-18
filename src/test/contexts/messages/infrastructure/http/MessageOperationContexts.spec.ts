import { MessageOperationContexts } from '../../../../../contexts/messages/infrastructure/http/MessageOperationContexts';

describe(MessageOperationContexts.name, () => {
  it('keeps transport-only options outside application messages', () => {
    const contexts = new MessageOperationContexts();
    const controller = new AbortController();
    const sendOptions = { previousMessageIds: ['message-a'] };

    contexts.registerSend('message-b', sendOptions);
    contexts.registerEdit('message-a', {});
    contexts.registerLoadSignal(
      'author-a',
      'conversation-a',
      controller.signal,
    );

    expect(contexts.consumeSend('message-b')).toBe(sendOptions);
    expect(contexts.consumeSend('message-b')).toEqual({});
    expect(contexts.consumeEdit('message-a')).toEqual({});
    expect(contexts.findLoadSignal('author-a', 'conversation-a')).toBe(
      controller.signal,
    );
  });
});

import type { EditMessagePort } from '../../../../../contexts/messages/application/edit-message/EditMessagePort';
import type {
  ChatMessage,
  Session,
} from '../../../../../shared/domain/pigeonResources.types';

import { EditMessage } from '../../../../../contexts/messages/application/edit-message/EditMessage';
import { EditMessageMessage } from '../../../../../contexts/messages/application/edit-message/messages/EditMessageMessage';

describe(EditMessage.name, () => {
  it('delegates message edits to the pigeon API gateway', async () => {
    const session = {} as Session;
    const expected = {
      content: 'edited',
      raw: { targetMessageId: 'message-1', type: 'edited' },
    } as ChatMessage;
    const gateway = {
      editMessage: jest.fn().mockResolvedValue(expected),
    } as unknown as EditMessagePort;
    const useCase = new EditMessage(gateway);

    await expect(
      useCase.edit(
        new EditMessageMessage({
          content: 'edited',
          conversationId: 'conversation-1',
          messageId: 'message-1',
          options: {},
          session,
        }),
      ),
    ).resolves.toBe(expected);
    expect(gateway.editMessage).toHaveBeenCalledWith(
      session,
      'conversation-1',
      'message-1',
      'edited',
      {},
    );
  });
});

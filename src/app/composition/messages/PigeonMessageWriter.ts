import { UUID } from '@haskou/value-objects';

import type { IdentityAccessContexts } from '../../../contexts/identities/infrastructure/http/IdentityAccessContexts';
import type { MessageDeleter } from '../../../contexts/messages/application/delete-message/MessageDeleter';
import type { MessageEditor } from '../../../contexts/messages/application/edit-message/MessageEditor';
import type { MessageSender } from '../../../contexts/messages/application/send-message/MessageSender';
import type { MessageMapper } from '../../../contexts/messages/infrastructure/http/MessageMapper';
import type { MessageOperationContexts } from '../../../contexts/messages/infrastructure/http/MessageOperationContexts';
import type {
  ChatMessage,
  EditMessageOptions,
  SendMessageOptions,
  Session,
} from '../../../shared/domain/pigeonResources.types';

import { DeleteMessageMessage } from '../../../contexts/messages/application/delete-message/messages/DeleteMessageMessage';
import { EditMessageMessage } from '../../../contexts/messages/application/edit-message/messages/EditMessageMessage';
import { SendMessageMessage } from '../../../contexts/messages/application/send-message/messages/SendMessageMessage';

export class PigeonMessageWriter {
  public constructor(
    private readonly identityContexts: IdentityAccessContexts,
    private readonly operationContexts: MessageOperationContexts,
    private readonly mapper: MessageMapper,
    private readonly sender: MessageSender,
    private readonly editor: MessageEditor,
    private readonly deleter: MessageDeleter,
  ) {}

  private register(session: Session): void {
    this.identityContexts.register(session);
  }

  private mutationInput(
    session: Session,
    conversationId: string,
    messageId: string,
  ) {
    return {
      authorIdentityId: session.identity.id,
      conversationId,
      messageId,
      occurredAt: Date.now(),
    };
  }

  public async delete(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    this.register(session);
    await this.deleter.delete(
      new DeleteMessageMessage(
        this.mutationInput(session, conversationId, messageId),
      ),
    );
  }

  public async edit(
    session: Session,
    conversationId: string,
    messageId: string,
    content: string,
    options: EditMessageOptions = {},
  ): Promise<ChatMessage> {
    this.register(session);
    this.operationContexts.registerEdit(messageId, options);
    const edited = await this.editor.edit(
      new EditMessageMessage({
        ...this.mutationInput(session, conversationId, messageId),
        content,
      }),
    );

    return this.mapper.toChatMessage(edited);
  }

  public async send(
    session: Session,
    conversationId: string,
    content: string,
    options: SendMessageOptions = {},
  ): Promise<ChatMessage> {
    this.register(session);
    const occurredAt = Date.now();
    const messageId = `${conversationId}:${occurredAt}:${UUID.generate().toString()}`;

    this.operationContexts.registerSend(messageId, options);
    const sent = await this.sender.send(
      new SendMessageMessage({
        authorIdentityId: session.identity.id,
        content,
        conversationId,
        encrypted: true,
        kind: options.sticker ? 'sticker' : 'message',
        messageId,
        occurredAt,
      }),
    );

    return this.mapper.toChatMessage(sent);
  }
}

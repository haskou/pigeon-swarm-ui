import { SymmetricKey, UUID } from '@haskou/value-objects';

import type {
  ChatMessage,
  EditMessageOptions,
  MessageResource,
  SendMessageOptions,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';
import type { EncryptMessagePayloadInput } from '../crypto/EncryptMessagePayloadInput';
import type { MessageProjectionPort } from '../crypto/MessageProjectionPort';
import type { MessageAttachmentPublisher } from './MessageAttachmentPublisher';

import { signSessionPayload } from '../../../../shared/infrastructure/crypto/signSessionPayload';
import { ConversationKeychain } from '../../../identities/infrastructure/keychain/ConversationKeychain';
import { MessageLinkPreviews } from '../../domain/MessageLinkPreviews';
import { MessageSignaturePayloadFactory } from '../../domain/MessageSignaturePayloadFactory';
import { PigeonMessagesApi } from './PigeonMessagesApi';

export class PigeonMessageCommandsApi {
  public constructor(
    private readonly http: HttpJsonClient,
    private readonly signer: RequestSigner,
    private readonly messages: PigeonMessagesApi,
    private readonly projection: MessageProjectionPort,
    private readonly attachments: MessageAttachmentPublisher,
    private readonly signatures: MessageSignaturePayloadFactory,
  ) {}

  private async linkPreviewForContent(session: Session, content: string) {
    const url = MessageLinkPreviews.firstUrl(content);

    if (!url) return undefined;

    return await this.messages
      .createLinkPreview(session, url)
      .catch(() => undefined);
  }

  private async linkPreviewForMessage(
    session: Session,
    content: string,
    options: SendMessageOptions,
  ) {
    if (options.linkPreview || options.sticker) return options.linkPreview;

    return await this.linkPreviewForContent(session, content);
  }

  private encryptPayload(input: EncryptMessagePayloadInput): string {
    return SymmetricKey.fromBase64(input.key.key)
      .encrypt(
        JSON.stringify({
          attachments: input.messageAttachments,
          authorIdentityId: input.session.identity.id,
          content: input.sticker ? '' : input.content,
          conversationId: input.conversationId,
          ...(input.linkPreview ? { linkPreview: input.linkPreview } : {}),
          ...(input.replyPreview ? { reply: input.replyPreview } : {}),
          ...(input.sticker ? { sticker: input.sticker } : {}),
          ...(input.threadRootMessageId
            ? { threadRootMessageId: input.threadRootMessageId }
            : {}),
          timestamp: input.timestamp,
          type:
            input.eventType ??
            (input.sticker ? 'StickerMessageSent' : 'MessageSent'),
        }),
      )
      .toString();
  }

  public async send(
    session: Session,
    conversationId: string,
    content: string,
    options: SendMessageOptions = {},
  ): Promise<ChatMessage> {
    const key = ConversationKeychain.entry(
      session.keychain,
      session.identity.id,
      conversationId,
    );

    if (!key) throw new Error('Conversation key is required.');

    const {
      attachments = [],
      attachmentUpload,
      onAttachmentProgress,
      previousMessageIds = [],
      replyPreview,
      replyToMessageId,
      threadRootMessageId,
    } = options;
    const timestamp = Date.now();
    const messageAttachments = await this.attachments.publishMessageAttachments(
      session,
      attachments,
      onAttachmentProgress,
      attachmentUpload,
    );
    const linkPreview = await this.linkPreviewForMessage(
      session,
      content,
      options,
    );
    const encryptedPayload = this.encryptPayload({
      content,
      conversationId,
      eventType: threadRootMessageId
        ? options.sticker
          ? 'ThreadStickerMessageSent'
          : 'ThreadMessageSent'
        : undefined,
      key,
      linkPreview,
      messageAttachments,
      replyPreview,
      session,
      sticker: options.sticker,
      threadRootMessageId,
      timestamp,
    });
    const id = `${conversationId}:${timestamp}:${UUID.generate().toString()}`;
    const signature = await signSessionPayload(
      session,
      JSON.stringify(
        this.signatures.createSent({
          authorId: session.identity.id,
          conversationId,
          createdAt: timestamp,
          encryptedPayload,
          id,
          previousMessageIds,
          replyToMessageId,
        }),
      ),
    );
    const body = {
      createdAt: timestamp,
      encryptedPayload,
      id,
      previousMessageIds,
      ...(replyToMessageId ? { replyToMessageId } : {}),
      signature: signature.toString(),
    };
    const path = `/conversations/${encodeURIComponent(
      conversationId,
    )}/messages`;
    const created = await this.http.request<MessageResource>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'POST', path, body),
      method: 'POST',
    });

    return await this.projection.decrypt(session, conversationId, created);
  }

  public async edit(
    session: Session,
    conversationId: string,
    messageId: string,
    content: string,
    options: EditMessageOptions = {},
  ): Promise<ChatMessage> {
    const key = ConversationKeychain.entry(
      session.keychain,
      session.identity.id,
      conversationId,
    );

    if (!key) throw new Error('Conversation key is required.');

    const timestamp = Date.now();
    const linkPreview =
      options.linkPreview ??
      (await this.linkPreviewForContent(session, content));
    const encryptedPayload = this.encryptPayload({
      content,
      conversationId,
      eventType: 'MessageEdited',
      key,
      linkPreview,
      messageAttachments: [],
      session,
      timestamp,
    });
    const id = `${conversationId}:${timestamp}:${UUID.generate().toString()}:edited`;
    const previousMessageIds = [messageId];
    const signature = await signSessionPayload(
      session,
      JSON.stringify(
        this.signatures.createEdited({
          authorId: session.identity.id,
          conversationId,
          createdAt: timestamp,
          encryptedPayload,
          id,
          targetMessageId: messageId,
        }),
      ),
    );
    /* eslint-disable perfectionist/sort-objects */
    const body = {
      id,
      createdAt: timestamp,
      encryptedPayload,
      previousMessageIds,
      signature: signature.toString(),
    };
    /* eslint-enable perfectionist/sort-objects */
    const path = `/conversations/${encodeURIComponent(
      conversationId,
    )}/messages/${encodeURIComponent(messageId)}`;
    const edited = await this.http.request<MessageResource>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'PUT', path, body),
      method: 'PUT',
    });

    return await this.projection.decrypt(session, conversationId, edited);
  }

  public async delete(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    const createdAt = Date.now();
    const id = `${conversationId}:${createdAt}:${UUID.generate().toString()}:deleted`;
    const signature = await signSessionPayload(
      session,
      JSON.stringify(
        this.signatures.createDeleted({
          authorId: session.identity.id,
          conversationId,
          createdAt,
          id,
          targetMessageId: messageId,
        }),
      ),
    );
    const body = { createdAt, id, signature: signature.toString() };
    const path = `/conversations/${encodeURIComponent(
      conversationId,
    )}/messages/${encodeURIComponent(messageId)}`;

    await this.http.request(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'DELETE', path, body),
      method: 'DELETE',
    });
  }
}

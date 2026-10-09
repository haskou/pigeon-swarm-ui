import { SymmetricKey } from '@haskou/pigeon-swarm-crypto';
import { UUID } from '@haskou/value-objects';

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
import type { MessageCommandIdentity } from './resources/MessageCommandIdentity';

import { PublicMutationSigner } from '../../../../shared/infrastructure/crypto/PublicMutationSigner';
import { ScopeFrontierReader } from '../../../../shared/infrastructure/http/ScopeFrontierReader';
import { submitPublicMutation } from '../../../../shared/infrastructure/http/submitPublicMutation';
import { ConversationKeychain } from '../../../identities/infrastructure/keychain/ConversationKeychain';
import { MessageContent } from '../../domain/value-objects/MessageContent';
import { PigeonMessagesApi } from './PigeonMessagesApi';

export class PigeonMessageCommandsApi {
  public constructor(
    private readonly http: HttpJsonClient,
    private readonly signer: RequestSigner,
    private readonly messages: PigeonMessagesApi,
    private readonly projection: MessageProjectionPort,
    private readonly attachments: MessageAttachmentPublisher,
    private readonly mutations: PublicMutationSigner,
    private readonly frontiers = new ScopeFrontierReader(http, signer),
  ) {}

  private async submit<T>(
    session: Session,
    method: 'DELETE' | 'POST' | 'PUT',
    path: string,
    input: {
      fields: Record<string, unknown>;
      record: Record<string, unknown> & { id: string };
    },
  ): Promise<T> {
    let response: T | undefined;
    const frontier = await this.frontiers.ofPayload(session, input.record);

    await submitPublicMutation(
      PublicMutationSigner.FIRST_POSITION,
      (position) =>
        this.mutations.sign(
          session,
          {
            frontier,
            kind: 'put',
            payload: input.record,
            recordId: input.record.id,
            store: 'messages',
          },
          position,
        ),
      async (mutation) => {
        const body = { ...input.fields, mutation };

        response = await this.http.request<T>(path, {
          body: JSON.stringify(body),
          headers: await this.signer.headers(session, method, path, body),
          method,
        });
      },
    );

    return response as T;
  }

  private async linkPreviewForContent(session: Session, content: string) {
    const url = MessageContent.fromString(content).findFirstLinkPreviewUrl();

    if (!url) return undefined;

    return await this.messages
      .createLinkPreview(session, url.toString())
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
    commandIdentity?: MessageCommandIdentity,
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
    const timestamp = commandIdentity?.createdAt ?? Date.now();
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
    const id =
      commandIdentity?.id ??
      `${conversationId}:${timestamp}:${UUID.generate().toString()}`;
    const path = `/conversations/${encodeURIComponent(
      conversationId,
    )}/messages`;
    const created = await this.submit<MessageResource>(session, 'POST', path, {
      fields: {
        createdAt: timestamp,
        encryptedPayload,
        id,
        previousMessageIds,
        ...(replyToMessageId ? { replyToMessageId } : {}),
      },
      record: {
        authorId: this.mutations.authorOf(session),
        conversationId,
        createdAt: timestamp,
        encryptedPayload,
        id,
        previousMessageIds,
        replyToMessageId: replyToMessageId || undefined,
        scopeType: 'conversation',
        type: 'sent',
      },
    });

    return await this.projection.decrypt(session, conversationId, created);
  }

  public async edit(
    session: Session,
    conversationId: string,
    messageId: string,
    content: string,
    options: EditMessageOptions = {},
    commandIdentity?: MessageCommandIdentity,
  ): Promise<ChatMessage> {
    const key = ConversationKeychain.entry(
      session.keychain,
      session.identity.id,
      conversationId,
    );

    if (!key) throw new Error('Conversation key is required.');

    const timestamp = commandIdentity?.createdAt ?? Date.now();
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
    const path = `/conversations/${encodeURIComponent(
      conversationId,
    )}/messages/${encodeURIComponent(messageId)}`;
    const edited = await this.submit<MessageResource>(session, 'PUT', path, {
      fields: {
        createdAt: timestamp,
        encryptedPayload,
        id,
        previousMessageIds,
      },
      record: {
        authorId: this.mutations.authorOf(session),
        conversationId,
        createdAt: timestamp,
        encryptedPayload,
        id,
        previousMessageIds,
        scopeType: 'conversation',
        targetMessageId: messageId,
        type: 'edited',
      },
    });

    return await this.projection.decrypt(session, conversationId, edited);
  }

  public async delete(
    session: Session,
    conversationId: string,
    messageId: string,
    commandIdentity?: MessageCommandIdentity,
  ): Promise<void> {
    const createdAt = commandIdentity?.createdAt ?? Date.now();
    const id = `${conversationId}:${createdAt}:${UUID.generate().toString()}:deleted`;
    const path = `/conversations/${encodeURIComponent(
      conversationId,
    )}/messages/${encodeURIComponent(messageId)}`;

    await this.submit<void>(session, 'DELETE', path, {
      fields: { createdAt, id },
      record: {
        authorId: this.mutations.authorOf(session),
        conversationId,
        createdAt,
        id,
        previousMessageIds: [messageId],
        scopeType: 'conversation',
        targetMessageId: messageId,
        type: 'deleted',
      },
    });
  }
}

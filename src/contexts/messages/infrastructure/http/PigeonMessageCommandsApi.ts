import { SymmetricKey } from '@haskou/pigeon-swarm-crypto';
import { UUID } from '@haskou/value-objects';

import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';
import type { MessageAttachment } from '../../../attachments/application/contracts/MessageAttachment';
import type { Session } from '../../../identities/infrastructure/session/Session';
import type { ChatMessage } from '../../presentation/view-models/ChatMessage';
import type { EncryptMessagePayloadInput } from '../crypto/EncryptMessagePayloadInput';
import type { MessageProjectionPort } from '../crypto/MessageProjectionPort';
import type { MessageAttachmentPublisher } from './MessageAttachmentPublisher';
import type { MessageResource } from './MessageResource';
import type { EditMessageOptions } from './resources/EditMessageOptions';
import type { MessageCommandIdentity } from './resources/MessageCommandIdentity';
import type { SendMessageOptions } from './resources/SendMessageOptions';

import { PublicMutationSigner } from '../../../../shared/infrastructure/crypto/PublicMutationSigner';
import { HttpJsonError } from '../../../../shared/infrastructure/http/HttpJsonError';
import { ScopeFrontierReader } from '../../../../shared/infrastructure/http/ScopeFrontierReader';
import { submitPublicMutation } from '../../../../shared/infrastructure/http/submitPublicMutation';
import { ConversationKeychain } from '../../../identities/infrastructure/keychain/ConversationKeychain';
import { ConversationKeyRequiredError } from '../../domain/errors/ConversationKeyRequiredError';
import { MessageContent } from '../../domain/value-objects/MessageContent';
import { PigeonMessagesApi } from './PigeonMessagesApi';

type CommandRecord = MessageResource & { id: string };

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

  private async abandonAttachmentsOnFailure<T>(
    session: Session,
    attachments: MessageAttachment[],
    run: () => Promise<T>,
  ): Promise<T> {
    try {
      return await run();
    } catch (error) {
      await this.attachments.abandonMessageAttachments(session, attachments);

      throw error;
    }
  }

  /**
   * Abandons the attachments only when the node answered 4xx, which proves the
   * message was not stored. Any other failure may hide an accepted message, so
   * the replicas stay until node retention reclaims them.
   */
  private async abandonAttachmentsOnRejection<T>(
    session: Session,
    attachments: MessageAttachment[],
    run: () => Promise<T>,
  ): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (
        error instanceof HttpJsonError &&
        error.status >= 400 &&
        error.status < 500
      ) {
        await this.attachments.abandonMessageAttachments(session, attachments);
      }

      throw error;
    }
  }

  /**
   * Builds the sent record for a message and hands it to `deliver`. Attachments
   * are published first and settled only once `deliver` resolves. A failure
   * before delivery abandons them. A failure in `deliver` abandons them only
   * when the node answered 4xx, which proves the message was not stored. Any
   * other failure may hide an accepted message, so the replicas stay until node
   * retention reclaims them. Nothing is sent here, so the caller decides where
   * it goes.
   */
  public async withSentRecord<T>(
    session: Session,
    conversationId: string,
    content: string,
    options: SendMessageOptions,
    deliver: (sent: CommandRecord) => Promise<T>,
    commandIdentity?: MessageCommandIdentity,
  ): Promise<T> {
    const key = ConversationKeychain.entry(
      session.keychain,
      session.identity.id,
      conversationId,
    );

    if (!key) throw new ConversationKeyRequiredError();

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
    const sent = await this.abandonAttachmentsOnFailure(
      session,
      messageAttachments,
      async (): Promise<CommandRecord> => {
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

        return {
          authorId: this.mutations.authorOf(session),
          conversationId,
          createdAt: timestamp,
          encryptedPayload,
          id,
          previousMessageIds,
          replyToMessageId: replyToMessageId || undefined,
          type: 'sent',
        };
      },
    );
    const result = await this.abandonAttachmentsOnRejection(
      session,
      messageAttachments,
      () => deliver(sent),
    );

    this.attachments.settleMessageAttachments(session, messageAttachments);

    return result;
  }

  public async send(
    session: Session,
    conversationId: string,
    content: string,
    options: SendMessageOptions = {},
    commandIdentity?: MessageCommandIdentity,
  ): Promise<ChatMessage> {
    const created = await this.withSentRecord(
      session,
      conversationId,
      content,
      options,
      async (sent) => {
        const path = `/conversations/${encodeURIComponent(
          conversationId,
        )}/messages`;

        return await this.submit<MessageResource>(session, 'POST', path, {
          fields: {
            createdAt: sent.createdAt,
            encryptedPayload: sent.encryptedPayload,
            id: sent.id,
            previousMessageIds: sent.previousMessageIds,
            ...(sent.replyToMessageId
              ? { replyToMessageId: sent.replyToMessageId }
              : {}),
          },
          record: { ...sent, scopeType: 'conversation' },
        });
      },
      commandIdentity,
    );

    return await this.projection.decrypt(session, conversationId, created);
  }

  /**
   * Builds the edit record for one message: the encrypted payload and the
   * record a sender writes. Nothing is submitted here.
   */
  public async composeEdit(
    session: Session,
    conversationId: string,
    messageId: string,
    content: string,
    options: EditMessageOptions = {},
    commandIdentity?: MessageCommandIdentity,
  ): Promise<CommandRecord> {
    const key = ConversationKeychain.entry(
      session.keychain,
      session.identity.id,
      conversationId,
    );

    if (!key) throw new ConversationKeyRequiredError();

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

    return {
      authorId: this.mutations.authorOf(session),
      conversationId,
      createdAt: timestamp,
      encryptedPayload,
      id: `${conversationId}:${timestamp}:${UUID.generate().toString()}:edited`,
      previousMessageIds: [messageId],
      targetMessageId: messageId,
      type: 'edited',
    };
  }

  public async edit(
    session: Session,
    conversationId: string,
    messageId: string,
    content: string,
    options: EditMessageOptions = {},
    commandIdentity?: MessageCommandIdentity,
  ): Promise<ChatMessage> {
    const edited = await this.composeEdit(
      session,
      conversationId,
      messageId,
      content,
      options,
      commandIdentity,
    );
    const path = `/conversations/${encodeURIComponent(
      conversationId,
    )}/messages/${encodeURIComponent(messageId)}`;
    const result = await this.submit<MessageResource>(session, 'PUT', path, {
      fields: {
        createdAt: edited.createdAt,
        encryptedPayload: edited.encryptedPayload,
        id: edited.id,
        previousMessageIds: edited.previousMessageIds,
      },
      record: { ...edited, scopeType: 'conversation' },
    });

    return await this.projection.decrypt(session, conversationId, result);
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

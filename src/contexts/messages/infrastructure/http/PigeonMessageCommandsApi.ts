import { SymmetricKey } from '@haskou/pigeon-swarm-crypto';
import { UUID } from '@haskou/value-objects';

import type { PublicMutationSigner } from '../../../../shared/infrastructure/crypto/PublicMutationSigner';
import type { MessageAttachment } from '../../../attachments/application/contracts/MessageAttachment';
import type { Session } from '../../../identities/infrastructure/session/Session';
import type { EncryptMessagePayloadInput } from '../crypto/EncryptMessagePayloadInput';
import type { MessagePayloadSeal } from '../crypto/MessagePayloadSeal';
import type { MessageAttachmentPublisher } from './MessageAttachmentPublisher';
import type { MessageResource } from './MessageResource';
import type { PigeonLinkPreviewsApi } from './PigeonLinkPreviewsApi';
import type { EditMessageOptions } from './resources/EditMessageOptions';
import type { MessageCommandIdentity } from './resources/MessageCommandIdentity';
import type { SendMessageOptions } from './resources/SendMessageOptions';

import { HttpJsonError } from '../../../../shared/infrastructure/http/HttpJsonError';
import { ConversationKeychain } from '../../../identities/infrastructure/keychain/ConversationKeychain';
import { ConversationKeyRequiredError } from '../../domain/errors/ConversationKeyRequiredError';
import { MessageContent } from '../../domain/value-objects/MessageContent';

type CommandRecord = MessageResource & { id: string };

export class PigeonMessageCommandsApi {
  public constructor(
    private readonly linkPreviews: PigeonLinkPreviewsApi,
    private readonly attachments: MessageAttachmentPublisher,
    private readonly mutations: PublicMutationSigner,
  ) {}

  private async linkPreviewForContent(session: Session, content: string) {
    const url = MessageContent.fromString(content).findFirstLinkPreviewUrl();

    if (!url) return undefined;

    return await this.linkPreviews
      .create(session, url.toString())
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

  /**
   * How a payload is sealed: `seal` when given, else encryption under the
   * conversation key, which must exist before anything is published.
   */
  private sealFor(
    session: Session,
    conversationId: string,
    seal?: MessagePayloadSeal,
  ): MessagePayloadSeal {
    if (seal) return seal;
    const key = ConversationKeychain.entry(
      session.keychain,
      session.identity.id,
      conversationId,
    );

    if (!key) throw new ConversationKeyRequiredError();
    const symmetricKey = SymmetricKey.fromBase64(key.key);

    return (plainMessage) => symmetricKey.encrypt(plainMessage).toString();
  }

  private encryptPayload(input: EncryptMessagePayloadInput): string {
    return input.seal(
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
    );
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
    seal?: MessagePayloadSeal,
  ): Promise<T> {
    const sealPayload = this.sealFor(session, conversationId, seal);

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
          linkPreview,
          messageAttachments,
          replyPreview,
          seal: sealPayload,
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

  /**
   * Builds the edit record for one message: the sealed payload and the
   * record a sender writes. Nothing is submitted here.
   */
  public async composeEdit(
    session: Session,
    conversationId: string,
    messageId: string,
    content: string,
    options: EditMessageOptions = {},
    commandIdentity?: MessageCommandIdentity,
    seal?: MessagePayloadSeal,
  ): Promise<CommandRecord> {
    const sealPayload = this.sealFor(session, conversationId, seal);

    const timestamp = commandIdentity?.createdAt ?? Date.now();
    const linkPreview =
      options.linkPreview ??
      (await this.linkPreviewForContent(session, content));
    const encryptedPayload = this.encryptPayload({
      content,
      conversationId,
      eventType: 'MessageEdited',
      linkPreview,
      messageAttachments: [],
      seal: sealPayload,
      session,
      timestamp,
    });

    return {
      authorId: this.mutations.authorOf(session),
      conversationId,
      createdAt: timestamp,
      encryptedPayload,
      id:
        commandIdentity?.id ??
        `${conversationId}:${timestamp}:${UUID.generate().toString()}:edited`,
      previousMessageIds: [messageId],
      targetMessageId: messageId,
      type: 'edited',
    };
  }
}

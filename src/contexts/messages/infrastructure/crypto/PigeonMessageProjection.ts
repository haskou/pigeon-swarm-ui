import type {
  ChatMessage,
  MessageResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { MessageDecryptWorkerPort } from './MessageDecryptWorkerPort';
import type { MessageProjectionCopy } from './MessageProjectionCopy';
import type { MessageProjectionPort } from './MessageProjectionPort';

import { ConversationKeychain } from '../../../identities/infrastructure/keychain/ConversationKeychain';
import { throwIfMessageLoadAborted } from '../http/throwIfMessageLoadAborted';
import { hasEncryptedPayload } from './hasEncryptedPayload';
import { MessageProjector } from './MessageProjector';
import { yieldAfterMessageDecryptBatch } from './yieldAfterMessageDecryptBatch';

const messageDecryptBatchSize = 8;

export class PigeonMessageProjection implements MessageProjectionPort {
  private decryptWorker: MessageDecryptWorkerPort | null = null;

  public constructor(
    private readonly projector: MessageProjector,
    private readonly copy: MessageProjectionCopy,
  ) {}

  private async decryptDirectly(
    session: Session,
    conversationId: string,
    messages: MessageResource[],
    signal?: AbortSignal,
  ): Promise<ChatMessage[]> {
    const decrypted = new Array<ChatMessage>(messages.length);

    for (
      let endIndex = messages.length;
      endIndex > 0;
      endIndex -= messageDecryptBatchSize
    ) {
      throwIfMessageLoadAborted(signal);

      const startIndex = Math.max(0, endIndex - messageDecryptBatchSize);
      const batch = messages.slice(startIndex, endIndex);
      const decryptedBatch = await Promise.all(
        batch.map((message) =>
          this.projector.toChatMessage(session, conversationId, message),
        ),
      );

      decrypted.splice(startIndex, decryptedBatch.length, ...decryptedBatch);
      throwIfMessageLoadAborted(signal);

      if (startIndex > 0) await yieldAfterMessageDecryptBatch();
    }

    return decrypted;
  }

  private async getDecryptWorker(): Promise<MessageDecryptWorkerPort> {
    if (this.decryptWorker) return this.decryptWorker;

    const { MessageDecryptWorkerClient } =
      await import('./MessageDecryptWorkerClient');
    const { createMessageDecryptWorker } =
      await import('./createMessageDecryptWorker');

    this.decryptWorker = new MessageDecryptWorkerClient(
      createMessageDecryptWorker(),
    );

    return this.decryptWorker;
  }

  public async decrypt(
    session: Session,
    conversationId: string,
    message: MessageResource,
  ): Promise<ChatMessage> {
    const [projected] = await this.decryptMany(session, conversationId, [
      message,
    ]);

    return projected;
  }

  public async decryptMany(
    session: Session,
    conversationId: string,
    messages: MessageResource[],
    signal?: AbortSignal,
  ): Promise<ChatMessage[]> {
    const pendingMessages = messages.filter(
      (message) => message.type !== 'deleted',
    );

    if (typeof Worker === 'undefined') {
      return await this.decryptDirectly(
        session,
        conversationId,
        pendingMessages,
        signal,
      );
    }

    const key = pendingMessages.some(hasEncryptedPayload)
      ? ConversationKeychain.entry(
          session.keychain,
          session.identity.id,
          conversationId,
        )
      : undefined;
    const worker = await this.getDecryptWorker();

    return await worker.decrypt(
      {
        conversationId,
        copy: this.copy,
        currentIdentityId: session.identity.id,
        messages: pendingMessages,
        symmetricKey: key?.key,
      },
      signal,
    );
  }

  public list(value: unknown): {
    messages: MessageResource[];
    nextCursor?: null | string;
  } {
    return this.projector.list(value);
  }
}

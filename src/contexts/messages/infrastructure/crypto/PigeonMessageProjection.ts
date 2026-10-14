import type { Session } from '../../../identities/infrastructure/session/Session';
import type { ChatMessage } from '../../domain/ChatMessage';
import type { MessageResource } from '../http/MessageResource';
import type { MessageProjectionCopy } from './MessageProjectionCopy';
import type { MessageProjectionPort } from './MessageProjectionPort';
import type { ProjectedMessage } from './ProjectedMessage';

import { ConversationKeychain } from '../../../identities/infrastructure/keychain/ConversationKeychain';
import { throwIfMessageLoadAborted } from '../http/throwIfMessageLoadAborted';
import { createMessageDecryptWorker } from './createMessageDecryptWorker';
import { hasEncryptedPayload } from './hasEncryptedPayload';
import { MessageDecryptWorkerClient } from './MessageDecryptWorkerClient';
import { MessageProjector } from './MessageProjector';
import { yieldAfterMessageDecryptBatch } from './yieldAfterMessageDecryptBatch';

const messageDecryptBatchSize = 8;

export class PigeonMessageProjection implements MessageProjectionPort {
  private decryptWorker: MessageDecryptWorkerClient | null = null;

  public constructor(
    private readonly projector: MessageProjector,
    private readonly copy: MessageProjectionCopy,
  ) {}

  private async decryptDirectly(
    session: Session,
    conversationId: string,
    messages: MessageResource[],
    signal?: AbortSignal,
  ): Promise<ProjectedMessage[]> {
    const decrypted = new Array<ProjectedMessage>(messages.length);

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
          this.projector.project(session, conversationId, message),
        ),
      );

      decrypted.splice(startIndex, decryptedBatch.length, ...decryptedBatch);
      throwIfMessageLoadAborted(signal);

      if (startIndex > 0) await yieldAfterMessageDecryptBatch();
    }

    return decrypted;
  }

  private getDecryptWorker(): MessageDecryptWorkerClient {
    this.decryptWorker ??= new MessageDecryptWorkerClient(
      createMessageDecryptWorker(),
    );

    return this.decryptWorker;
  }

  private async projectMany(
    session: Session,
    conversationId: string,
    messages: MessageResource[],
    signal?: AbortSignal,
  ): Promise<ProjectedMessage[]> {
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

    return await this.getDecryptWorker().decrypt(
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

  public dispose(): void {
    this.decryptWorker?.terminate();
    this.decryptWorker = null;
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
    const projected = await this.projectMany(
      session,
      conversationId,
      messages,
      signal,
    );

    return projected.map(({ message }) => message);
  }

  public async decryptReadable(
    session: Session,
    conversationId: string,
    messages: MessageResource[],
    signal?: AbortSignal,
  ): Promise<ChatMessage[]> {
    const projected = await this.projectMany(
      session,
      conversationId,
      messages,
      signal,
    );

    return projected.flatMap(({ message, readable }) =>
      readable ? [message] : [],
    );
  }
}

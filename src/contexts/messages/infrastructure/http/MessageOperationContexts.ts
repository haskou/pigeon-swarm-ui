import type {
  EditMessageOptions,
  SendMessageOptions,
} from '../../../../shared/domain/pigeonResources.types';

export class MessageOperationContexts {
  private readonly editOptions = new Map<string, EditMessageOptions>();

  private readonly loadSignals = new Map<string, AbortSignal>();

  private readonly sendOptions = new Map<string, SendMessageOptions>();

  private key(actorIdentityId: string, conversationId: string): string {
    return `${actorIdentityId}\u0000${conversationId}`;
  }

  public consumeEdit(messageId: string): EditMessageOptions {
    const options = this.editOptions.get(messageId) ?? {};

    this.editOptions.delete(messageId);

    return options;
  }

  public consumeSend(messageId: string): SendMessageOptions {
    const options = this.sendOptions.get(messageId) ?? {};

    this.sendOptions.delete(messageId);

    return options;
  }

  public findLoadSignal(
    actorIdentityId: string,
    conversationId: string,
  ): AbortSignal | undefined {
    return this.loadSignals.get(this.key(actorIdentityId, conversationId));
  }

  public registerEdit(messageId: string, options: EditMessageOptions): void {
    this.editOptions.set(messageId, options);
  }

  public registerLoadSignal(
    actorIdentityId: string,
    conversationId: string,
    signal?: AbortSignal,
  ): void {
    const key = this.key(actorIdentityId, conversationId);

    if (signal) this.loadSignals.set(key, signal);
    else this.loadSignals.delete(key);
  }

  public registerSend(messageId: string, options: SendMessageOptions): void {
    this.sendOptions.set(messageId, options);
  }
}

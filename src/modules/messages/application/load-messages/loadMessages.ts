import type { ChatMessage, Session } from '../../../../shared/domain/pigeonResources.types';

import { PigeonApiGateway } from '../../../../app/composition/pigeonApiGateway';

export class LoadMessages {
  public constructor(private readonly gateway: PigeonApiGateway) {}

  public async execute(
    session: Session,
    conversationId: string,
    before?: null | string,
    options?: { signal?: AbortSignal },
  ): Promise<{ messages: ChatMessage[]; nextCursor?: null | string }> {
    return await this.gateway.loadMessages(
      session,
      conversationId,
      before,
      options,
    );
  }
}

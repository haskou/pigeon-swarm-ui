import type { ChatMessage, Session } from '../../domain/types';

import { PigeonApiGateway } from '../../infrastructure/pigeon-api/PigeonApiGateway';

export class LoadMessagesAround {
  public constructor(private readonly gateway: PigeonApiGateway) {}

  public async execute(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<{
    messages: ChatMessage[];
    nextCursor?: null | string;
    previousCursor?: null | string;
  }> {
    return await this.gateway.loadMessagesAround(
      session,
      conversationId,
      messageId,
    );
  }
}

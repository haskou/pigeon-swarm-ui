import type { ChatMessage, Session } from '../../../../shared/domain/pigeonResources.types';

import { PigeonApiGateway } from '../../../../app/composition/pigeonApiGateway';

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

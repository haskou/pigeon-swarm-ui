import type { ChatMessage, Session } from '../../../../shared/domain/pigeonResources.types';

import { PigeonApiGateway } from '../../../../app/composition/pigeonApiGateway';

export class LoadMessage {
  public constructor(private readonly gateway: PigeonApiGateway) {}

  public async execute(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<ChatMessage | null> {
    return await this.gateway.loadMessage(session, conversationId, messageId);
  }
}

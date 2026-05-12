import type { ChatMessage, Session } from '../../domain/types';

import { PigeonApiGateway } from '../../infrastructure/pigeon-api/PigeonApiGateway';

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

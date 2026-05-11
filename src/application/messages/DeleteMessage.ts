import type { Session } from '../../domain/types';

import { PigeonApiGateway } from '../../infrastructure/pigeon-api/PigeonApiGateway';

export class DeleteMessage {
  public constructor(private readonly gateway: PigeonApiGateway) {}

  public async execute(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    await this.gateway.deleteMessage(session, conversationId, messageId);
  }
}

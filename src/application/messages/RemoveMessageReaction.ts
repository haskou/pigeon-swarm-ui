import type { Session } from '../../domain/types';

import { PigeonApiGateway } from '../../infrastructure/pigeon-api/PigeonApiGateway';

export class RemoveMessageReaction {
  public constructor(private readonly gateway: PigeonApiGateway) {}

  public async execute(
    session: Session,
    conversationId: string,
    messageId: string,
    emoji: string,
  ): Promise<void> {
    await this.gateway.removeMessageReaction(
      session,
      conversationId,
      messageId,
      emoji,
    );
  }
}

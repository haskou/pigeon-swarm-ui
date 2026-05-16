import type { Session } from '../../domain/types';

import { PigeonApiGateway } from '../../infrastructure/pigeon-api/PigeonApiGateway';

export class AddMessageReaction {
  public constructor(private readonly gateway: PigeonApiGateway) {}

  public async execute(
    session: Session,
    conversationId: string,
    messageId: string,
    emoji: string,
  ): Promise<void> {
    await this.gateway.addMessageReaction(
      session,
      conversationId,
      messageId,
      emoji,
    );
  }
}

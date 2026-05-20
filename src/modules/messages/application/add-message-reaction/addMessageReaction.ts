import type { Session } from '../../../../shared/domain/pigeonResources.types';

import { PigeonApiGateway } from '../../../../app/composition/pigeonApiGateway';

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

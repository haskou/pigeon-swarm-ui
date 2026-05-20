import type {
  ChatMessage,
  SendMessageOptions,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

import { PigeonApiGateway } from '../../../../app/composition/pigeonApiGateway';

export class SendMessage {
  public constructor(private readonly gateway: PigeonApiGateway) {}

  public async execute(
    session: Session,
    conversationId: string,
    content: string,
    options: SendMessageOptions = {},
  ): Promise<ChatMessage> {
    return await this.gateway.sendMessage(
      session,
      conversationId,
      content,
      options,
    );
  }
}

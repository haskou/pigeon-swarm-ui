import type {
  ChatMessage,
  SendMessageOptions,
  Session,
} from '../../domain/types';

import { PigeonApiGateway } from '../../infrastructure/pigeon-api/PigeonApiGateway';

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

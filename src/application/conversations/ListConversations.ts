import type { ConversationResource, Session } from '../../domain/types';

import { PigeonApiGateway } from '../../infrastructure/pigeon-api/PigeonApiGateway';

export class ListConversations {
  public constructor(private readonly gateway: PigeonApiGateway) {}

  public async execute(session: Session): Promise<ConversationResource[]> {
    return await this.gateway.listConversations(session);
  }
}

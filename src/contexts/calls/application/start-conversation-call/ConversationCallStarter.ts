import type { Call } from '../../domain/Call';
import type { CallRepository } from '../../domain/repositories/CallRepository';

import { StartConversationCallMessage } from './messages/StartConversationCallMessage';

export class ConversationCallStarter {
  public constructor(private readonly calls: CallRepository) {}

  public async start(message: StartConversationCallMessage): Promise<Call> {
    return await this.calls.create(
      message.getScope(),
      message.getActorIdentityId(),
    );
  }
}

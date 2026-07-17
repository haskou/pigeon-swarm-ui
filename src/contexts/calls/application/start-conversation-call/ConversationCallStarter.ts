import type { Call } from '../../domain/Call';
import type { CallRepository } from '../../domain/repositories/CallRepository';

import { StartConversationCallMessage } from './messages/StartConversationCallMessage';

export class ConversationCallStarter {
  public constructor(private readonly callRepository: CallRepository) {}

  public async start(message: StartConversationCallMessage): Promise<Call> {
    return await this.callRepository.create(
      message.getScope(),
      message.getActorIdentityId(),
    );
  }
}

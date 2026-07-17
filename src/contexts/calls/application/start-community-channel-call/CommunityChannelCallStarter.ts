import type { Call } from '../../domain/Call';
import type { CallRepository } from '../../domain/repositories/CallRepository';

import { StartCommunityChannelCallMessage } from './messages/StartCommunityChannelCallMessage';

export class CommunityChannelCallStarter {
  public constructor(private readonly callRepository: CallRepository) {}

  public async start(message: StartCommunityChannelCallMessage): Promise<Call> {
    return await this.callRepository.create(
      message.getScope(),
      message.getActorIdentityId(),
    );
  }
}

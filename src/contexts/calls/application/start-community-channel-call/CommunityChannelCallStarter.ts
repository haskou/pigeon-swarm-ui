import type { Call } from '../../domain/Call';
import type { CallRepository } from '../../domain/repositories/CallRepository';

import { StartCommunityChannelCallMessage } from './messages/StartCommunityChannelCallMessage';

export class CommunityChannelCallStarter {
  public constructor(private readonly calls: CallRepository) {}

  public async start(message: StartCommunityChannelCallMessage): Promise<Call> {
    return await this.calls.create(
      message.getScope(),
      message.getActorIdentityId(),
    );
  }
}

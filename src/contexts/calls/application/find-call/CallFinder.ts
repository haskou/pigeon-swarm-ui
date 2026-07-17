import type { Call } from '../../domain/Call';
import type { CallRepository } from '../../domain/repositories/CallRepository';

import { FindCallMessage } from './messages/FindCallMessage';

export class CallFinder {
  public constructor(private readonly callRepository: CallRepository) {}

  public async find(message: FindCallMessage): Promise<Call> {
    return await this.callRepository.find(
      message.getCallId(),
      message.getActorIdentityId(),
    );
  }
}

import type { Call } from '../../domain/Call';
import type { CallRepository } from '../../domain/repositories/CallRepository';

import { FindCallMessage } from './messages/FindCallMessage';

export class CallFinder {
  public constructor(private readonly calls: CallRepository) {}

  public async find(message: FindCallMessage): Promise<Call> {
    return await this.calls.find(
      message.getCallId(),
      message.getActorIdentityId(),
    );
  }
}

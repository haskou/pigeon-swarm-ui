import type { NodeRegistrationCode } from '../../domain/NodeRegistrationCode';
import type { NodeRegistrationCodeRepository } from '../../domain/repositories/NodeRegistrationCodeRepository';

import { SearchNodeRegistrationCodesMessage } from './messages/SearchNodeRegistrationCodesMessage';

export class NodeRegistrationCodesSearcher {
  public constructor(private readonly codes: NodeRegistrationCodeRepository) {}

  public async search(
    message: SearchNodeRegistrationCodesMessage,
  ): Promise<NodeRegistrationCode[]> {
    return await this.codes.search(message.getActorId());
  }
}

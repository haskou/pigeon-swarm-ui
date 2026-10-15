import type { NodeRegistrationCodeRepository } from '../../domain/repositories/NodeRegistrationCodeRepository';

import { RevokeNodeRegistrationCodeMessage } from './messages/RevokeNodeRegistrationCodeMessage';

export class NodeRegistrationCodeRevoker {
  public constructor(private readonly codes: NodeRegistrationCodeRepository) {}

  public async revoke(
    message: RevokeNodeRegistrationCodeMessage,
  ): Promise<void> {
    await this.codes.revoke(message.getCodeId(), message.getActorId());
  }
}

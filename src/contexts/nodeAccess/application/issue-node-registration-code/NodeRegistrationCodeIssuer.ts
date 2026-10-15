import type { IssuedNodeRegistrationCode } from '../../domain/IssuedNodeRegistrationCode';
import type { NodeRegistrationCodeRepository } from '../../domain/repositories/NodeRegistrationCodeRepository';

import { IssueNodeRegistrationCodeMessage } from './messages/IssueNodeRegistrationCodeMessage';

export class NodeRegistrationCodeIssuer {
  public constructor(private readonly codes: NodeRegistrationCodeRepository) {}

  public async issue(
    message: IssueNodeRegistrationCodeMessage,
  ): Promise<IssuedNodeRegistrationCode> {
    return await this.codes.issue(
      message.getMaxUses(),
      message.getExpiresAt(),
      message.getActorId(),
    );
  }
}

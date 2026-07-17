import { DomainError } from '@haskou/value-objects';

export class CommunityRoleNameRequiredError extends DomainError {
  public constructor() {
    super('Community role name is required.');
  }
}

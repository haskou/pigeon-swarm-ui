import { DomainError } from '@haskou/value-objects';

export class CommunityRoleNotFoundError extends DomainError {
  public constructor() {
    super('Community role was not found.');
  }
}

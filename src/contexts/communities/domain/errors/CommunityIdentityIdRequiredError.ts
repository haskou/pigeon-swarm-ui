import { DomainError } from '@haskou/value-objects';

export class CommunityIdentityIdRequiredError extends DomainError {
  public constructor() {
    super('Community identity id is required.');
  }
}

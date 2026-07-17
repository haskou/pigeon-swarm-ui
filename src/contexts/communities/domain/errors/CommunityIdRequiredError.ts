import { DomainError } from '@haskou/value-objects';

export class CommunityIdRequiredError extends DomainError {
  public constructor() {
    super('Community id is required.');
  }
}

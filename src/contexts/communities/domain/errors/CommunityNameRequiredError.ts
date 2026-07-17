import { DomainError } from '@haskou/value-objects';

export class CommunityNameRequiredError extends DomainError {
  public constructor() {
    super('Community name is required.');
  }
}

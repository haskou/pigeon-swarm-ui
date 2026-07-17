import { DomainError } from '@haskou/value-objects';

export class CommunityNetworkIdRequiredError extends DomainError {
  public constructor() {
    super('Community network id is required.');
  }
}

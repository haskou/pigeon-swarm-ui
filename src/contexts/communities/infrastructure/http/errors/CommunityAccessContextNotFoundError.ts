import { DomainError } from '@haskou/value-objects';

export class CommunityAccessContextNotFoundError extends DomainError {
  public constructor() {
    super('Community access context was not registered.');
  }
}

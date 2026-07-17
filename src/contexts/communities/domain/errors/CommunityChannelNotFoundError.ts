import { DomainError } from '@haskou/value-objects';

export class CommunityChannelNotFoundError extends DomainError {
  public constructor() {
    super('Community channel was not found.');
  }
}

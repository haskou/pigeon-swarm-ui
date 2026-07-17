import { DomainError } from '@haskou/value-objects';

export class CommunityChannelNameRequiredError extends DomainError {
  public constructor() {
    super('Community channel name is required.');
  }
}

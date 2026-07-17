import { DomainError } from '@haskou/value-objects';

export class CommunityThreadMessageIdRequiredError extends DomainError {
  public constructor() {
    super('Community thread message id is required.');
  }
}

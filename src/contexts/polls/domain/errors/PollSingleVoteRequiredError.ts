import { DomainError } from '@haskou/value-objects';

export class PollSingleVoteRequiredError extends DomainError {
  public constructor() {
    super('This poll accepts one option per vote.');
  }
}

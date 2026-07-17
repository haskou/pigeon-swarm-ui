import { DomainError } from '@haskou/value-objects';

export class CallParticipantNotFoundError extends DomainError {
  public constructor() {
    super('Call participant was not found.');
  }
}

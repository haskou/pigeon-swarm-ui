import { DomainError } from '@haskou/value-objects';

export class PollClosedError extends DomainError {
  public constructor() {
    super('Closed polls cannot receive votes.');
  }
}

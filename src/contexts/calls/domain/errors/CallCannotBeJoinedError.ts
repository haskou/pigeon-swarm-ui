import { DomainError } from '@haskou/value-objects';

export class CallCannotBeJoinedError extends DomainError {
  public constructor() {
    super('Only active calls can be joined.');
  }
}

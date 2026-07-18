import { DomainError } from '@haskou/value-objects';

export class MessagePageLimitInvalidError extends DomainError {
  public constructor() {
    super('Message page limit must be greater than zero.');
  }
}

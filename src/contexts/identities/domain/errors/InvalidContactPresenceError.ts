import { DomainError } from '@haskou/value-objects';

export class InvalidContactPresenceError extends DomainError {
  public constructor() {
    super('Contact presence update is invalid.');
  }
}

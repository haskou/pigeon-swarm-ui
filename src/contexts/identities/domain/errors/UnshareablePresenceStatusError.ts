import { DomainError } from '@haskou/value-objects';

export class UnshareablePresenceStatusError extends DomainError {
  public constructor() {
    super('Only available, away and busy are shared with contacts.');
  }
}

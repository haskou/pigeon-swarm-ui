import { DomainError } from '@haskou/value-objects';

export class CommunityThreadReplyCountNegativeError extends DomainError {
  public constructor() {
    super('Community thread reply count cannot be negative.');
  }
}

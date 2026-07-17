import { DomainError } from '@haskou/value-objects';

export class CommunityMemberNotFoundError extends DomainError {
  public constructor() {
    super('Community member was not found.');
  }
}

import { DomainError } from '@haskou/value-objects';

export class CommunityOperationRejectedError extends DomainError {
  public constructor() {
    super('The community operation is not allowed by its signed history.');
  }
}

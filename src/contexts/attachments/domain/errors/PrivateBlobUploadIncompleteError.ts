import { DomainError } from '@haskou/value-objects';

export class PrivateBlobUploadIncompleteError extends DomainError {
  public constructor() {
    super('Private blob upload is incomplete.');
  }
}

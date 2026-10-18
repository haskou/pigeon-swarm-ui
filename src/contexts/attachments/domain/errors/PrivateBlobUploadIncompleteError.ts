import { DomainError } from '@haskou/value-objects';

export class PrivateBlobUploadIncompleteError extends DomainError {
  /**
   * Distinct, non-sensitive labels of the failed attempts, such as "HTTP 500"
   * or an error class name. Never a message, body, or identifier.
   */
  public readonly reasons: readonly string[];

  public constructor(reasons: readonly string[] = []) {
    super('Private blob upload is incomplete.');
    this.reasons = reasons;
  }
}

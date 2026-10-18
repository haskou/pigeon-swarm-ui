import { DomainError } from '@haskou/value-objects';

export class PrivateBlobUploadIncompleteError extends DomainError {
  /**
   * Distinct, non-sensitive labels of the failed attempts, such as "HTTP 500"
   * or an error class name. Never a message, body, or identifier.
   */
  public readonly reasons: readonly string[];

  public constructor(reasons: readonly string[] = []) {
    super(
      reasons.length === 0
        ? 'Private blob upload is incomplete.'
        : `Private blob upload is incomplete (${reasons.join(', ')}).`,
    );
    this.reasons = reasons;
  }
}

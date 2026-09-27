export class PasskeyPrfRequestFailedError extends Error {
  public constructor() {
    super('The passkey request was cancelled or timed out.');
    this.name = 'PasskeyPrfRequestFailedError';
  }
}

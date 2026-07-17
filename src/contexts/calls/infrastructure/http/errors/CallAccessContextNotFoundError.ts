export class CallAccessContextNotFoundError extends Error {
  public constructor() {
    super('Call access context was not registered.');
  }
}

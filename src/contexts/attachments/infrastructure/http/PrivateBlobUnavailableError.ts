export class PrivateBlobUnavailableError extends Error {
  public constructor() {
    super('Private blob is unavailable.');
    this.name = PrivateBlobUnavailableError.name;
  }
}

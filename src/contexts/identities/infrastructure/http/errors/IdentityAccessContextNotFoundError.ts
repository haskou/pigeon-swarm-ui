export class IdentityAccessContextNotFoundError extends Error {
  public constructor() {
    super('Identity access context was not registered.');
  }
}

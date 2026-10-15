export class InvalidNodeAccessIdentityIdError extends Error {
  public constructor() {
    super('Identity ids must be public keys in base64 form.');
    this.name = InvalidNodeAccessIdentityIdError.name;
  }
}

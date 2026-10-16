export class InvalidNodeRegistrationCodeExpiryError extends Error {
  public constructor() {
    super('Registration codes must expire in the future.');
    this.name = InvalidNodeRegistrationCodeExpiryError.name;
  }
}

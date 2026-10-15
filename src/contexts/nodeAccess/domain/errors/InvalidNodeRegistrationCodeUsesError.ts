export class InvalidNodeRegistrationCodeUsesError extends Error {
  public constructor() {
    super('Registration codes must allow between 1 and 100 uses.');
    this.name = InvalidNodeRegistrationCodeUsesError.name;
  }
}

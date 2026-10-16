export class InvalidNodeRegistrationCodeIdError extends Error {
  public constructor() {
    super('Registration code ids must not be empty.');
    this.name = InvalidNodeRegistrationCodeIdError.name;
  }
}

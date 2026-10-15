export class InvalidIdentityRegistrationCodeError extends Error {
  public constructor() {
    super('The registration code is not valid.');
    this.name = InvalidIdentityRegistrationCodeError.name;
  }
}

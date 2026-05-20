export class LoginIdentityMessage {
  public constructor(
    private readonly input: {
      identityId: string;
      password: string;
    },
  ) {}

  public getIdentityId(): string {
    return this.input.identityId;
  }

  public getPassword(): string {
    return this.input.password;
  }
}

import type { LoginIdentityProgressReporter } from '../../ports/LoginIdentityProgressReporter';

export class LoginIdentityMessage {
  public constructor(
    private readonly input: {
      identityId: string;
      onProgress?: LoginIdentityProgressReporter;
      password: string;
    },
  ) {}

  public getIdentityId(): string {
    return this.input.identityId;
  }

  public getProgressReporter(): LoginIdentityProgressReporter | undefined {
    return this.input.onProgress;
  }

  public getPassword(): string {
    return this.input.password;
  }
}

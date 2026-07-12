import type { LoginIdentityProgressReporter } from '../LoginIdentityProgressReporter';

export class LoginIdentityMessage {
  public constructor(
    private readonly input: {
      identityId: string;
      onProgress?: LoginIdentityProgressReporter;
      password: string;
      recoveryKey?: string;
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

  public getRecoveryKey(): string | undefined {
    return this.input.recoveryKey;
  }
}

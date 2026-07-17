import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { LoginIdentityProgressReporter } from '../../application/login-identity/LoginIdentityProgressReporter';
import type { IdentityId } from '../../domain/value-objects/IdentityId';
import type { IdentityAccessContext } from './IdentityAccessContext';

import { IdentityAccessContextNotFoundError } from './errors/IdentityAccessContextNotFoundError';

export class IdentityAccessContexts {
  private readonly contexts = new Map<string, IdentityAccessContext>();

  private readonly progressReporters = new Map<
    string,
    LoginIdentityProgressReporter
  >();

  public find(identityId: IdentityId): IdentityAccessContext {
    const context = this.contexts.get(identityId.toString());

    if (!context) throw new IdentityAccessContextNotFoundError();

    return context;
  }

  public register(
    session: Session,
    newPassword?: string,
    options: IdentityAccessContext['options'] = {},
  ): void {
    this.contexts.set(session.identity.id, { newPassword, options, session });
  }

  public registerProgress(
    identityId: string,
    reporter?: LoginIdentityProgressReporter,
  ): void {
    if (!reporter) {
      this.progressReporters.delete(identityId.trim());

      return;
    }

    this.progressReporters.set(identityId.trim(), reporter);
  }

  public reportProgress(
    identityId: IdentityId,
  ): LoginIdentityProgressReporter | undefined {
    return this.progressReporters.get(identityId.toString());
  }
}

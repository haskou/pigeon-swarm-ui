import type { Session } from '../../../../shared/domain/pigeonResources.types';

import { CallIdentityId } from '../../domain/value-objects/CallIdentityId';
import { CallAccessContextNotFoundError } from './errors/CallAccessContextNotFoundError';

export class CallAccessContexts {
  private readonly sessions = new Map<string, Session>();

  public register(session: Session): void {
    const identityId = CallIdentityId.fromString(session.identity.id);

    this.sessions.set(identityId.toString(), session);
  }

  public find(identityId: CallIdentityId): Session {
    const session = this.sessions.get(identityId.toString());

    if (!session) throw new CallAccessContextNotFoundError();

    return session;
  }
}

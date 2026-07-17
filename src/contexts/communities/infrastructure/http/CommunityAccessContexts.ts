import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { CommunityIdentityId } from '../../domain/value-objects/CommunityIdentityId';

import { CommunityAccessContextNotFoundError } from './errors/CommunityAccessContextNotFoundError';

export class CommunityAccessContexts {
  private readonly sessions = new Map<string, Session>();

  public find(identityId: CommunityIdentityId): Session {
    const session = this.sessions.get(identityId.toString());

    if (!session) throw new CommunityAccessContextNotFoundError();

    return session;
  }

  public register(session: Session): void {
    this.sessions.set(session.identity.id, session);
  }
}

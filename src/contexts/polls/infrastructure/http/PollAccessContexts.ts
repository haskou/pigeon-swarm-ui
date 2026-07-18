import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { PollActorId } from '../../domain/value-objects/PollActorId';

import { PollAccessContextNotFoundError } from './errors/PollAccessContextNotFoundError';

export class PollAccessContexts {
  private readonly sessions = new Map<string, Session>();

  public find(actorId: PollActorId): Session {
    const session = this.sessions.get(actorId.toString());

    if (!session) throw new PollAccessContextNotFoundError();

    return session;
  }

  public register(session: Session): void {
    this.sessions.set(session.identity.id, session);
  }
}

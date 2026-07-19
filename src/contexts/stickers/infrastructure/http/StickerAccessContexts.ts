import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { StickerOwnerId } from '../../domain/value-objects/StickerOwnerId';

import { StickerAccessContextNotFoundError } from './errors/StickerAccessContextNotFoundError';

export class StickerAccessContexts {
  private readonly sessions = new Map<string, Session>();

  public find(ownerId: StickerOwnerId): Session {
    const session = this.sessions.get(ownerId.toString());

    if (!session) throw new StickerAccessContextNotFoundError();

    return session;
  }

  public register(session: Session): void {
    this.sessions.set(session.identity.id, session);
  }
}

import type { Session } from '../session/Session';
import type { PigeonPresenceApi } from './PigeonPresenceApi';
import type { IdentityPresenceResource as IdentityPresence } from './resources/IdentityPresenceResource';
import type { SelectablePresenceStatusResource as SelectablePresenceStatus } from './resources/SelectablePresenceStatusResource';

export class PigeonPresenceGateway {
  public constructor(private readonly presence: PigeonPresenceApi) {}

  public async get(
    session: Session,
    identityId: string,
  ): Promise<IdentityPresence> {
    return await this.presence.get(session, identityId);
  }

  public async update(
    session: Session,
    status: SelectablePresenceStatus,
  ): Promise<IdentityPresence> {
    return await this.presence.update(session, { status });
  }
}

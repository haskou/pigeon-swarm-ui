import type { Session } from '../../../identities/infrastructure/session/Session';
import type { DeviceSealedEntryStore } from '../../../messages/infrastructure/mailbox/DeviceSealedEntryStore';

const KIND = 'verifier-floor';

/**
 * The highest authorization revision this device has verified for each
 * identity. A served chain below it is a rollback. Clearing site storage
 * resets it.
 */
export class VerifierFloorStore {
  public constructor(private readonly entries: DeviceSealedEntryStore) {}

  public async get(session: Session, identityId: string): Promise<number> {
    const stored = await this.entries.get(session, KIND, identityId);

    return stored ? Number(new TextDecoder().decode(stored)) : 0;
  }

  public async raise(
    session: Session,
    identityId: string,
    revision: number,
  ): Promise<void> {
    if (revision <= (await this.get(session, identityId))) return;

    await this.entries.put(
      session,
      KIND,
      identityId,
      new TextEncoder().encode(String(revision)),
    );
  }
}

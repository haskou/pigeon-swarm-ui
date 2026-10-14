import type { Session } from '../../../identities/infrastructure/session/Session';
import type { DeviceSealedEntryStore } from '../../../messages/infrastructure/mailbox/DeviceSealedEntryStore';

/**
 * The control letters this device is handling or has handled, each kept
 * until the end of its answer window, sealed under the device-sealed root
 * (`DeviceSealedEntryStore`). Every session of the device shares them, so a
 * claim made before a reload or in another tab holds. Only the identity id,
 * the kind and the number of letters are readable at rest.
 */
export class GroupMailboxLetterClaims {
  private static readonly KIND = 'control-letter';

  public constructor(
    private readonly entries: DeviceSealedEntryStore,
    private readonly session: () => Session,
  ) {}

  /**
   * Claims `id` until `until` (ms since the epoch). Resolves false when this
   * device already holds a claim on it, from any session.
   */
  public claim(id: string, until: number): Promise<boolean> {
    return this.entries.add(
      this.session(),
      GroupMailboxLetterClaims.KIND,
      id,
      new TextEncoder().encode(String(until)),
    );
  }

  /** Drops the claims whose window ended before `now`. */
  public async prune(now: number): Promise<void> {
    const session = this.session();

    for (const { id, value } of await this.entries.list(
      session,
      GroupMailboxLetterClaims.KIND,
    )) {
      if (Number(new TextDecoder().decode(value)) < now) {
        await this.entries.delete(session, GroupMailboxLetterClaims.KIND, id);
      }
    }
  }

  /** Gives up a claim, so a later run may handle the letter again. */
  public release(id: string): Promise<void> {
    return this.entries.delete(
      this.session(),
      GroupMailboxLetterClaims.KIND,
      id,
    );
  }
}

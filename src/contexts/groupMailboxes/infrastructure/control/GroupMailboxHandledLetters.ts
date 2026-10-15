import type { Session } from '../../../identities/infrastructure/session/Session';
import type { DeviceSealedEntryStore } from '../../../messages/infrastructure/mailbox/DeviceSealedEntryStore';
import type { GroupMailboxHandledLetter } from './GroupMailboxHandledLetter';

/**
 * The control letters this device is handling or has handled, under their
 * sealed keys, sealed under the device-sealed root
 * (`DeviceSealedEntryStore`). Every session of the device shares them, so a
 * claim made before a reload or in another tab holds. An entry is pruned
 * once its `until` passed; an entry that does not decode is pruned too.
 * Only the identity id, the kind and the number of letters are readable at
 * rest.
 */
export class GroupMailboxHandledLetters {
  private static readonly KIND = 'control-letter';

  /** The entry `value` holds, undefined when it does not decode. */
  private static decode(
    value: Uint8Array,
  ): GroupMailboxHandledLetter | undefined {
    const { notificationId, state, until } =
      GroupMailboxHandledLetters.fieldsOf(value);

    return typeof notificationId === 'string' &&
      typeof until === 'number' &&
      Number.isFinite(until) &&
      (state === undefined || state === 'accepted' || state === 'declined')
      ? { notificationId, ...(state ? { state } : {}), until }
      : undefined;
  }

  private static encode(letter: GroupMailboxHandledLetter): Uint8Array {
    return new TextEncoder().encode(JSON.stringify(letter));
  }

  private static fieldsOf(value: Uint8Array): Record<string, unknown> {
    try {
      const parsed: unknown = JSON.parse(new TextDecoder().decode(value));

      return typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  public constructor(
    private readonly entries: DeviceSealedEntryStore,
    private readonly session: () => Session,
  ) {}

  /**
   * Claims `key` for notification `notificationId` until `until` (ms since
   * the epoch). Resolves false when this device already holds it, from any
   * session.
   */
  public claim(
    key: string,
    notificationId: string,
    until: number,
  ): Promise<boolean> {
    return this.entries.add(
      this.session(),
      GroupMailboxHandledLetters.KIND,
      key,
      GroupMailboxHandledLetters.encode({ notificationId, until }),
    );
  }

  /** Records the state decided for the letter under `key`. */
  public decide(key: string, letter: GroupMailboxHandledLetter): Promise<void> {
    return this.entries.put(
      this.session(),
      GroupMailboxHandledLetters.KIND,
      key,
      GroupMailboxHandledLetters.encode(letter),
    );
  }

  /** What this device holds under `key`, if anything that decodes. */
  public async held(
    key: string,
  ): Promise<GroupMailboxHandledLetter | undefined> {
    const value = await this.entries.get(
      this.session(),
      GroupMailboxHandledLetters.KIND,
      key,
    );

    return value ? GroupMailboxHandledLetters.decode(value) : undefined;
  }

  /** Drops the entries whose `until` is before `now`, and undecodable ones. */
  public async prune(now: number): Promise<void> {
    const session = this.session();

    for (const { id, value } of await this.entries.list(
      session,
      GroupMailboxHandledLetters.KIND,
    )) {
      const letter = GroupMailboxHandledLetters.decode(value);

      if (!letter || letter.until < now) {
        await this.entries.delete(session, GroupMailboxHandledLetters.KIND, id);
      }
    }
  }

  /** Gives up the claim on `key`, so a later run may handle it again. */
  public release(key: string): Promise<void> {
    return this.entries.delete(
      this.session(),
      GroupMailboxHandledLetters.KIND,
      key,
    );
  }
}

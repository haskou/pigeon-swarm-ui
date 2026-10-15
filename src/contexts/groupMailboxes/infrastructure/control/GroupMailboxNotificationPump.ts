import { SHA256Hash } from '@haskou/pigeon-swarm-crypto';

import type { Session } from '../../../identities/infrastructure/session/Session';
import type { GroupConversationInvitationNotificationResource } from '../../../notifications/infrastructure/http/resources/GroupConversationInvitationNotificationResource';
import type { NotificationResource } from '../../../notifications/infrastructure/http/resources/NotificationResource';
import type { GroupMailboxControl } from './GroupMailboxControl';
import type { GroupMailboxControlFields } from './GroupMailboxControlFields';
import type { GroupMailboxControlOutcome } from './GroupMailboxControlOutcome';
import type { GroupMailboxHandledLetter } from './GroupMailboxHandledLetter';
import type { GroupMailboxHandledLetters } from './GroupMailboxHandledLetters';
import type { GroupMailboxInvitation } from './GroupMailboxInvitation';
import type { GroupMailboxLetterState } from './GroupMailboxLetterState';
import type { GroupMailboxNotificationInbox } from './GroupMailboxNotificationInbox';
import type { GroupMailboxNotificationLetter } from './GroupMailboxNotificationLetter';

import { encodeBase64Url } from '../../../../shared/infrastructure/encoding/base64url';
import { IdentityId } from '../../../identities/domain/value-objects/IdentityId';
import { GroupMailboxControlRecord } from './GroupMailboxControlRecord';
import { GroupMailboxControlSeal } from './GroupMailboxControlSeal';

/**
 * Reads the control letters peers sent this identity as pending
 * notifications, hands each valid one to the control, its signer as the
 * peer, and signs a state record for every letter it decides, so the node
 * stops serving it. Notification ids are hashes, so pages are not
 * chronological and a run reads them all.
 *
 * A letter that does not open, verify or decode, whose record names another
 * conversation than its seal, carries no request, response or welcome, or is
 * not timely is declined without being handed over. Timely is from
 * `LETTER_WINDOW_MS` before now to `ANSWER_WINDOW_MS` after. The node never
 * learns the conversation: it travels only inside the seal.
 *
 * Every other letter is keyed from inside the seal
 * (`GroupMailboxNotificationLetter.key`) in `GroupMailboxHandledLetters`,
 * which every session of the device shares. The pump claims the key before
 * handing the letter over, so of two sessions only one does, and this device
 * answers a letter at most once. A letter the control applied is accepted,
 * one it rejected is declined, and the decision is kept with the key until
 * the letter's window ends; one it ignored (for another device or session)
 * gives the key back and stays pending. A request the control deferred, from
 * an identity that is not a contact, gives the key back too and is listed in
 * `invitations` until the user accepts it (`accept`, answered as consented)
 * or declines it (`decline`). A letter whose key this device holds under
 * another notification is a replay and is declined; under the same one, a
 * decided state is signed again, as when signing failed. A handling that
 * throws gives the key back and is retried on the next run; a reload or
 * crash in between leaves the claim held until its lease ends, so a request
 * or response is then declined as stale rather than answered twice, and a
 * welcome is retried. A run resolves with the conversations a welcome joined
 * during it. Logs carry counts only.
 */
export class GroupMailboxNotificationPump {
  private static readonly STATES: Record<
    Exclude<GroupMailboxControlOutcome, 'deferred' | 'ignored'>,
    GroupMailboxLetterState
  > = { applied: 'accepted', rejected: 'declined' };

  /** How far ahead a letter may be dated, and how long a welcome is claimed. */
  public static readonly ANSWER_WINDOW_MS = 5 * 60_000;
  /** How old a letter may be and still be handed over to the control. */
  public static readonly LETTER_WINDOW_MS = 30 * 24 * 60 * 60_000;
  /** Pages one run reads at most, so a node cannot keep it reading. */
  public static readonly MAX_PAGES = 200;
  public static readonly PAGE_SIZE = 100;

  private again = false;
  /** The deferred requests, by notification id, as the last run left them. */
  private deferred = new Map<
    string,
    {
      invitation: GroupMailboxInvitation;
      letter: GroupMailboxNotificationLetter;
    }
  >();

  private found = new Map<
    string,
    {
      invitation: GroupMailboxInvitation;
      letter: GroupMailboxNotificationLetter;
    }
  >();

  private joined = new Set<string>();
  private running: Promise<ReadonlySet<string>> | undefined;

  /**
   * What makes a letter of `record`'s kind distinct, from inside the seal;
   * undefined for kinds no letter carries.
   */
  private static refsOf(
    record: GroupMailboxControlFields,
  ): (number | string)[] | undefined {
    switch (record.type) {
      case 'key-package-request':
        return [record.requestId];
      case 'key-package-response':
        return [SHA256Hash.from(encodeBase64Url(record.keyPackage)).toString()];
      case 'welcome':
        return [record.index, record.deviceCredential];
      default:
        return undefined;
    }
  }

  public constructor(
    private readonly session: Session,
    private readonly control: Pick<GroupMailboxControl, 'receiveDirect'>,
    private readonly notifications: GroupMailboxNotificationInbox,
    private readonly letters: Pick<
      GroupMailboxHandledLetters,
      'claim' | 'decide' | 'held' | 'prune' | 'release'
    >,
    private readonly now: () => number,
  ) {}

  private async drain(): Promise<ReadonlySet<string>> {
    do {
      this.again = false;
      await this.scan();
    } while (this.again);

    return this.joined;
  }

  /**
   * Claims `letter`, hands it to the control, and signs the state decided;
   * gives the key back when the handling throws, or when the letter is not
   * for this device or session or waits for the user. Resolves with the
   * outcome, undefined when another session holds the claim.
   */
  private async decided(
    notificationId: string,
    letter: GroupMailboxNotificationLetter,
    consented: boolean,
  ): Promise<GroupMailboxControlOutcome | undefined> {
    if (!(await this.letters.claim(letter.key, notificationId, letter.lease))) {
      return undefined;
    }
    let outcome: GroupMailboxControlOutcome;

    try {
      outcome = await this.control.receiveDirect(
        letter.sender,
        letter.plaintext,
        consented,
      );
    } catch (error: unknown) {
      await this.letters.release(letter.key);
      throw error;
    }

    if (outcome === 'ignored' || outcome === 'deferred') {
      await this.letters.release(letter.key);

      return outcome;
    }
    await this.settle(notificationId, letter, outcome);

    return outcome;
  }

  /**
   * Hands `letter` to the control unless this device holds its key, and
   * lists it among the invitations when the control defers it.
   */
  private async hand(
    notificationId: string,
    letter: GroupMailboxNotificationLetter,
  ): Promise<void> {
    const held = await this.letters.held(letter.key);

    if (held) {
      await this.resign(notificationId, held);

      return;
    }

    if ((await this.decided(notificationId, letter, false)) === 'deferred') {
      this.found.set(notificationId, {
        invitation: {
          conversationId: letter.conversationId,
          inviterIdentityId: letter.sender,
          notificationId,
          sentAt: letter.sentAt,
        },
        letter,
      });
    }
  }

  /** Decides one pending group control letter; resolves 1 when it failed. */
  private async handle(notification: NotificationResource): Promise<number> {
    if (
      notification.type !== 'group_conversation_invitation' ||
      notification.state !== 'pending'
    ) {
      return 0;
    }

    try {
      const letter = this.safeLetterOf(notification);

      if (letter) {
        await this.hand(notification.id, letter);
      } else {
        await this.notifications.update(
          this.session,
          notification.id,
          'declined',
        );
      }

      return 0;
    } catch {
      return 1;
    }
  }

  /** The letter `notification` carries, if it is valid and timely. */
  private letterOf(
    notification: GroupConversationInvitationNotificationResource,
  ): GroupMailboxNotificationLetter | undefined {
    const { encryptedConversationKey, inviterIdentityId } =
      notification.payload;
    const opened = GroupMailboxControlSeal.open(
      this.session,
      encryptedConversationKey,
      inviterIdentityId,
    );

    if (!opened) return undefined;
    const { conversationId, sentAt } = opened;
    const record = GroupMailboxControlRecord.decode(opened.plaintext);

    if (record?.conversationId !== conversationId) return undefined;
    const refs = GroupMailboxNotificationPump.refsOf(record);
    const now = this.now();

    if (
      !refs ||
      sentAt < now - GroupMailboxNotificationPump.LETTER_WINDOW_MS ||
      sentAt > now + GroupMailboxNotificationPump.ANSWER_WINDOW_MS
    ) {
      return undefined;
    }
    const sender = IdentityId.normalize(inviterIdentityId);
    const until = sentAt + GroupMailboxNotificationPump.LETTER_WINDOW_MS;
    const welcome = record.type === 'welcome';

    return {
      conversationId,
      key: JSON.stringify([sender, conversationId, record.type, ...refs]),
      lease: welcome
        ? now + GroupMailboxNotificationPump.ANSWER_WINDOW_MS
        : until,
      plaintext: opened.plaintext,
      sender,
      sentAt,
      until,
      welcome,
    };
  }

  /**
   * Signs again what this device decided for a letter whose key it holds: a
   * decline for a replay under another notification, the decided state for
   * the same one, and nothing while that one is still being handled.
   */
  private async resign(
    notificationId: string,
    held: GroupMailboxHandledLetter,
  ): Promise<void> {
    const state =
      held.notificationId === notificationId ? held.state : 'declined';

    if (state) {
      await this.notifications.update(this.session, notificationId, state);
    }
  }

  /** Like `letterOf`, for a notification the node may have malformed. */
  private safeLetterOf(
    notification: GroupConversationInvitationNotificationResource,
  ): GroupMailboxNotificationLetter | undefined {
    try {
      return this.letterOf(notification);
    } catch {
      return undefined;
    }
  }

  private async scan(): Promise<void> {
    this.found = new Map();
    const size = GroupMailboxNotificationPump.PAGE_SIZE;
    let before: string | undefined;
    let failed = 0;
    let pages = 0;
    let page: NotificationResource[];
    let previous: string | undefined;

    try {
      await this.letters.prune(this.now());
    } catch {
      // eslint-disable-next-line no-console
      console.debug('Group control letters left to prune on the next run.');
    }

    do {
      page = await this.notifications.listPage(this.session, size, before);
      pages += 1;
      for (const notification of page)
        failed += await this.handle(notification);
      previous = before;
      before = page[page.length - 1]?.id;
    } while (
      page.length === size &&
      before !== previous &&
      pages < GroupMailboxNotificationPump.MAX_PAGES
    );

    this.deferred = this.found;

    if (failed > 0) {
      // eslint-disable-next-line no-console
      console.debug(`Group control letters left for retry: ${failed}.`);
    }
  }

  /** Keeps the decision for `letter` and signs it. */
  private async settle(
    notificationId: string,
    letter: GroupMailboxNotificationLetter,
    outcome: Exclude<GroupMailboxControlOutcome, 'deferred' | 'ignored'>,
  ): Promise<void> {
    const state = GroupMailboxNotificationPump.STATES[outcome];

    await this.letters.decide(letter.key, {
      notificationId,
      state,
      until: letter.until,
    });

    if (outcome === 'applied' && letter.welcome) {
      this.joined.add(letter.conversationId);
    }
    await this.notifications.update(this.session, notificationId, state);
  }

  /**
   * Answers a deferred request the user accepted; resolves false when it
   * is no longer listed, or another session is handling it. Rejects when
   * the control cannot answer it now, the request staying listed.
   */
  public async accept(notificationId: string): Promise<boolean> {
    const letter = this.deferred.get(notificationId)?.letter;

    if (!letter) return false;
    const outcome = await this.decided(notificationId, letter, true);

    if (outcome === undefined) return false;

    if (outcome === 'ignored' || outcome === 'deferred') {
      throw new Error('The invitation cannot be answered now');
    }
    this.deferred.delete(notificationId);

    return outcome === 'applied';
  }

  /** Declines a deferred request; false when it is no longer listed. */
  public async decline(notificationId: string): Promise<boolean> {
    const letter = this.deferred.get(notificationId)?.letter;

    if (
      !letter ||
      !(await this.letters.claim(letter.key, notificationId, letter.lease))
    ) {
      return false;
    }
    await this.settle(notificationId, letter, 'rejected');
    this.deferred.delete(notificationId);

    return true;
  }

  /** The deferred requests the last run found, oldest first. */
  public invitations(): GroupMailboxInvitation[] {
    return [...this.deferred.values()]
      .map(({ invitation }) => invitation)
      .sort((left, right) => left.sentAt - right.sentAt);
  }

  /**
   * Reads every letter; a call during a run makes that run read again and
   * shares its result.
   */
  public run(): Promise<ReadonlySet<string>> {
    if (this.running) {
      this.again = true;

      return this.running;
    }
    this.joined = new Set();
    this.running = this.drain().finally(() => {
      this.running = undefined;
    });

    return this.running;
  }
}

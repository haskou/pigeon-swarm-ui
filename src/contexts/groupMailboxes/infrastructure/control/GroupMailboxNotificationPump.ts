import type { Session } from '../../../identities/infrastructure/session/Session';
import type { NotificationResource } from '../../../notifications/infrastructure/http/resources/NotificationResource';
import type { GroupMailboxControl } from './GroupMailboxControl';
import type { GroupMailboxControlOutcome } from './GroupMailboxControlOutcome';
import type { GroupMailboxLetterClaims } from './GroupMailboxLetterClaims';
import type { GroupMailboxNotificationLetter } from './GroupMailboxNotificationLetter';
import type { GroupMailboxNotificationPages } from './GroupMailboxNotificationPages';

import { IdentityId } from '../../../identities/domain/value-objects/IdentityId';
import { GroupMailboxControlRecord } from './GroupMailboxControlRecord';
import { GroupMailboxControlSeal } from './GroupMailboxControlSeal';

/**
 * Reads the control letters peers sent this identity as notifications and
 * hands each valid one to the control, its signer as the peer. Notification
 * ids are hashes, so pages are not chronological and a run reads them all.
 * Key package requests and responses count only within `ANSWER_WINDOW_MS` of
 * their send time, and this device hands each one over at most once across
 * reloads and sessions: before handling it, the pump claims the letter (its
 * type, sender, conversation and request id) in `GroupMailboxLetterClaims`,
 * which every session of the device shares and which keeps the claim until
 * the window ends. A letter already claimed, or replayed under another
 * notification id, is skipped, so a replay makes this device answer no
 * second time and re-runs no response; once the window ended the letter is
 * stale anyway. Claiming before acting means that of two sessions reading
 * the same letter only one hands it over. A handling that throws releases
 * its claim and is retried on the next run; a reload or crash in between
 * leaves the claim held, so that letter is dropped rather than answered
 * twice, and the inviter's request times out. A claim that cannot be stored
 * leaves the letter for the next run. Welcomes are not claimed: the MLS
 * engine judges a late or replayed one. A run resolves with the
 * conversations a welcome joined during it. Logs carry counts only.
 */
export class GroupMailboxNotificationPump {
  public static readonly ANSWER_WINDOW_MS = 5 * 60_000;
  /** Pages one run reads at most, so a node cannot keep it reading. */
  public static readonly MAX_PAGES = 200;
  public static readonly PAGE_SIZE = 100;

  private again = false;
  /** Notifications this session handled or found not to be valid letters. */
  private readonly handled = new Set<string>();
  private joined = new Set<string>();
  private running: Promise<ReadonlySet<string>> | undefined;

  public constructor(
    private readonly session: Session,
    private readonly control: Pick<GroupMailboxControl, 'receiveDirect'>,
    private readonly notifications: GroupMailboxNotificationPages,
    private readonly claims: Pick<
      GroupMailboxLetterClaims,
      'claim' | 'prune' | 'release'
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
   * Hands `letter` to the control unless this device already claimed it;
   * gives the claim back when the handling throws.
   */
  private async hand(letter: GroupMailboxNotificationLetter): Promise<void> {
    const { claim } = letter;

    if (claim && !(await this.claims.claim(claim.id, claim.until))) return;
    let outcome: GroupMailboxControlOutcome;

    try {
      outcome = await this.control.receiveDirect(
        letter.sender,
        letter.plaintext,
      );
    } catch (error: unknown) {
      if (claim) await this.claims.release(claim.id);
      throw error;
    }

    if (outcome === 'applied' && letter.welcome) {
      this.joined.add(letter.conversationId);
    }
  }

  private async handle(notification: NotificationResource): Promise<number> {
    if (this.handled.has(notification.id)) return 0;
    const letter = this.safeLetterOf(notification);

    try {
      if (letter) await this.hand(letter);
      this.handled.add(notification.id);

      return 0;
    } catch {
      return 1;
    }
  }

  /** The record `notification` carries, if it is a valid letter. */
  private letterOf(
    notification: NotificationResource,
  ): GroupMailboxNotificationLetter | undefined {
    if (notification.type !== 'group_conversation_invitation') {
      return undefined;
    }
    const { conversationId, encryptedConversationKey, inviterIdentityId } =
      notification.payload;
    const opened = GroupMailboxControlSeal.open(
      this.session,
      encryptedConversationKey,
      { conversationId, senderIdentityId: inviterIdentityId },
    );

    if (!opened) return undefined;
    const record = GroupMailboxControlRecord.decode(opened.plaintext);
    const sender = IdentityId.normalize(inviterIdentityId);

    if (record?.conversationId !== conversationId) return undefined;

    if (record.type === 'welcome') {
      return {
        conversationId,
        plaintext: opened.plaintext,
        sender,
        welcome: true,
      };
    }

    if (!this.timely(opened.sentAt)) return undefined;
    const claim =
      record.type === 'key-package-request' ||
      record.type === 'key-package-response'
        ? {
            id: JSON.stringify([
              record.type,
              sender,
              conversationId,
              record.requestId,
            ]),
            until:
              opened.sentAt + GroupMailboxNotificationPump.ANSWER_WINDOW_MS,
          }
        : undefined;

    return {
      claim,
      conversationId,
      plaintext: opened.plaintext,
      sender,
      welcome: false,
    };
  }

  /** Like `letterOf`, for a notification the node may have malformed. */
  private safeLetterOf(
    notification: NotificationResource,
  ): GroupMailboxNotificationLetter | undefined {
    try {
      return this.letterOf(notification);
    } catch {
      return undefined;
    }
  }

  private async scan(): Promise<void> {
    const size = GroupMailboxNotificationPump.PAGE_SIZE;
    let before: string | undefined;
    let failed = 0;
    let pages = 0;
    let page: NotificationResource[];
    let previous: string | undefined;

    try {
      await this.claims.prune(this.now());
    } catch {
      // eslint-disable-next-line no-console
      console.debug('Group control letter claims left for the next run.');
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

    if (failed > 0) {
      // eslint-disable-next-line no-console
      console.debug(`Group control letters left for retry: ${failed}.`);
    }
  }

  private timely(sentAt: number): boolean {
    return (
      Math.abs(this.now() - sentAt) <=
      GroupMailboxNotificationPump.ANSWER_WINDOW_MS
    );
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

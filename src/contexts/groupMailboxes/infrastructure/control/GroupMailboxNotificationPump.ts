import { SHA256Hash } from '@haskou/pigeon-swarm-crypto';

import type { Session } from '../../../identities/infrastructure/session/Session';
import type { ConversationInvitationNotificationResource } from '../../../notifications/infrastructure/http/resources/ConversationInvitationNotificationResource';
import type { NotificationResource } from '../../../notifications/infrastructure/http/resources/NotificationResource';
import type { GroupMailboxControl } from './GroupMailboxControl';
import type { GroupMailboxControlFields } from './GroupMailboxControlFields';
import type { GroupMailboxControlOutcome } from './GroupMailboxControlOutcome';
import type { GroupMailboxHandledLetter } from './GroupMailboxHandledLetter';
import type { GroupMailboxHandledLetters } from './GroupMailboxHandledLetters';
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
 * A letter that does not open, verify or decode, names another conversation,
 * carries no request, response or welcome, or is not timely is declined
 * without being handed over. Timely is `ANSWER_WINDOW_MS` either side of its
 * send time for a key package request or response, and from
 * `WELCOME_WINDOW_MS` before now to `ANSWER_WINDOW_MS` after for a welcome.
 *
 * Every other letter is keyed from inside the seal
 * (`GroupMailboxNotificationLetter.key`) in `GroupMailboxHandledLetters`,
 * which every session of the device shares. The pump claims the key before
 * handing the letter over, so of two sessions only one does, and this device
 * answers a letter at most once. A letter the control applied is accepted,
 * one it rejected is declined, and the decision is kept with the key until
 * the letter's window ends; one it ignored (for another device or session)
 * gives the key back and stays pending. A letter whose key this device holds
 * under another notification is a replay and is declined; under the same
 * one, a decided state is signed again, as when signing failed. A handling
 * that throws gives the key back and is retried on the next run; a reload or
 * crash in between leaves the claim held until its lease ends, so a request
 * or response is then declined as stale rather than answered twice, and a
 * welcome is retried. A run resolves with the conversations a welcome joined
 * during it. Logs carry counts only.
 */
export class GroupMailboxNotificationPump {
  private static readonly STATES: Record<
    Exclude<GroupMailboxControlOutcome, 'ignored'>,
    GroupMailboxLetterState
  > = { applied: 'accepted', rejected: 'declined' };

  public static readonly ANSWER_WINDOW_MS = 5 * 60_000;
  /** Pages one run reads at most, so a node cannot keep it reading. */
  public static readonly MAX_PAGES = 200;
  public static readonly PAGE_SIZE = 100;
  /** How old a welcome may be and still be handed over to the engine. */
  public static readonly WELCOME_WINDOW_MS = 30 * 24 * 60 * 60_000;

  private again = false;
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
   * Hands `letter` to the control unless this device holds its key, and
   * signs the state it decided; gives the key back when the handling throws
   * or the letter is not for this device or session.
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

    if (!(await this.letters.claim(letter.key, notificationId, letter.lease))) {
      return;
    }
    let outcome: GroupMailboxControlOutcome;

    try {
      outcome = await this.control.receiveDirect(
        letter.sender,
        letter.plaintext,
      );
    } catch (error: unknown) {
      await this.letters.release(letter.key);
      throw error;
    }

    if (outcome === 'ignored') {
      await this.letters.release(letter.key);

      return;
    }
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
    notification: ConversationInvitationNotificationResource,
  ): GroupMailboxNotificationLetter | undefined {
    const { conversationId, encryptedConversationKey, inviterIdentityId } =
      notification.payload;
    const opened = GroupMailboxControlSeal.open(
      this.session,
      encryptedConversationKey,
      { conversationId, senderIdentityId: inviterIdentityId },
    );

    if (!opened) return undefined;
    const record = GroupMailboxControlRecord.decode(opened.plaintext);

    if (record?.conversationId !== conversationId) return undefined;
    const refs = GroupMailboxNotificationPump.refsOf(record);
    const welcome = record.type === 'welcome';
    const horizon = welcome
      ? GroupMailboxNotificationPump.WELCOME_WINDOW_MS
      : GroupMailboxNotificationPump.ANSWER_WINDOW_MS;
    const now = this.now();
    const { sentAt } = opened;

    if (
      !refs ||
      sentAt < now - horizon ||
      sentAt > now + GroupMailboxNotificationPump.ANSWER_WINDOW_MS
    ) {
      return undefined;
    }
    const sender = IdentityId.normalize(inviterIdentityId);
    const until = sentAt + horizon;

    return {
      conversationId,
      key: JSON.stringify([sender, conversationId, record.type, ...refs]),
      lease: welcome
        ? now + GroupMailboxNotificationPump.ANSWER_WINDOW_MS
        : until,
      plaintext: opened.plaintext,
      sender,
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
    notification: ConversationInvitationNotificationResource,
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

    if (failed > 0) {
      // eslint-disable-next-line no-console
      console.debug(`Group control letters left for retry: ${failed}.`);
    }
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

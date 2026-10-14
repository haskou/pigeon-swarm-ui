import type { Session } from '../../../identities/infrastructure/session/Session';
import type { NotificationResource } from '../../../notifications/infrastructure/http/resources/NotificationResource';
import type { GroupMailboxControl } from './GroupMailboxControl';
import type { GroupMailboxNotificationPages } from './GroupMailboxNotificationPages';

import { IdentityId } from '../../../identities/domain/value-objects/IdentityId';
import { GroupMailboxControlRecord } from './GroupMailboxControlRecord';
import { GroupMailboxControlSeal } from './GroupMailboxControlSeal';

/**
 * Reads the control letters peers sent this identity as notifications and
 * hands each valid one to the control once per session, its signer as the
 * peer. Notification ids are hashes, so pages are not chronological and a
 * run reads them all. Key package requests and responses count only within
 * `ANSWER_WINDOW_MS` of their send time, so letters the node keeps forever
 * cannot make this device answer again after a reload; the MLS engine
 * judges a late welcome. A letter whose handling failed is retried on the
 * next run. Logs carry counts only.
 */
export class GroupMailboxNotificationPump {
  public static readonly ANSWER_WINDOW_MS = 5 * 60_000;
  /** Pages one run reads at most, so a node cannot keep it reading. */
  public static readonly MAX_PAGES = 200;
  public static readonly PAGE_SIZE = 100;

  private again = false;
  private readonly handled = new Set<string>();
  private running: Promise<void> | undefined;

  public constructor(
    private readonly session: Session,
    private readonly control: Pick<GroupMailboxControl, 'receiveDirect'>,
    private readonly notifications: GroupMailboxNotificationPages,
    private readonly now: () => number,
  ) {}

  private async drain(): Promise<void> {
    do {
      this.again = false;
      await this.scan();
    } while (this.again);
  }

  private async handle(notification: NotificationResource): Promise<number> {
    if (this.handled.has(notification.id)) return 0;
    const letter = this.safeLetterOf(notification);

    try {
      if (letter) {
        await this.control.receiveDirect(letter.sender, letter.plaintext);
      }
      this.handled.add(notification.id);

      return 0;
    } catch {
      return 1;
    }
  }

  /** The record `notification` carries, if it is a valid letter. */
  private letterOf(
    notification: NotificationResource,
  ): { plaintext: Uint8Array; sender: string } | undefined {
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

    return record?.conversationId === conversationId &&
      (record.type === 'welcome' || this.timely(opened.sentAt))
      ? {
          plaintext: opened.plaintext,
          sender: IdentityId.normalize(inviterIdentityId),
        }
      : undefined;
  }

  /** Like `letterOf`, for a notification the node may have malformed. */
  private safeLetterOf(
    notification: NotificationResource,
  ): { plaintext: Uint8Array; sender: string } | undefined {
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

  /** Reads every letter; a call during a run makes that run read again. */
  public run(): Promise<void> {
    if (this.running) {
      this.again = true;

      return this.running;
    }
    this.running = this.drain().finally(() => {
      this.running = undefined;
    });

    return this.running;
  }
}

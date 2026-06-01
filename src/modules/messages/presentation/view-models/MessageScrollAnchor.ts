export type MessageScrollAnchorSnapshot = {
  expiresAt: number;
  messageId: string;
  offsetTop: number;
};

const messageSelector = '[data-message-id]';
const defaultAnchorTtlMs = 5000;

export class MessageScrollAnchor {
  public static capture(
    scroller: HTMLElement,
    ttlMs = defaultAnchorTtlMs,
  ): MessageScrollAnchorSnapshot | null {
    const scrollerTop = scroller.getBoundingClientRect().top;
    const element = MessageScrollAnchor.messageElements(scroller).find(
      (candidate) => candidate.getBoundingClientRect().bottom >= scrollerTop,
    );
    const messageId = element?.dataset.messageId;

    if (!element || !messageId) return null;

    return {
      expiresAt: Date.now() + ttlMs,
      messageId,
      offsetTop: element.getBoundingClientRect().top - scrollerTop,
    };
  }

  public static restore(
    scroller: HTMLElement,
    anchor: MessageScrollAnchorSnapshot | null,
  ): number | null {
    if (!anchor || Date.now() > anchor.expiresAt) return null;

    const element = MessageScrollAnchor.messageElements(scroller).find(
      (candidate) => candidate.dataset.messageId === anchor.messageId,
    );

    if (!element) return null;

    const currentOffset =
      element.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top;
    const nextTop = scroller.scrollTop + currentOffset - anchor.offsetTop;

    scroller.scrollTop = nextTop;

    return nextTop;
  }

  private static messageElements(scroller: HTMLElement): HTMLElement[] {
    return Array.from(scroller.querySelectorAll<HTMLElement>(messageSelector));
  }
}

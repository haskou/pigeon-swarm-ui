import { MessageScrollAnchor } from './MessageScrollAnchor';

type FakeMessageElement = {
  dataset: {
    messageId: string;
  };
  getBoundingClientRect: () => DOMRect;
};

type FakeScroller = {
  getBoundingClientRect: () => DOMRect;
  querySelectorAll: () => FakeMessageElement[];
  scrollHeight: number;
  scrollTop: number;
};

function rect(top: number, bottom: number): DOMRect {
  return {
    bottom,
    height: bottom - top,
    left: 0,
    right: 0,
    toJSON: () => ({}),
    top,
    width: 0,
    x: 0,
    y: top,
  };
}

function elementWithRect(
  messageId: string,
  top: number,
  bottom: number,
): FakeMessageElement {
  return {
    dataset: { messageId },
    getBoundingClientRect: () => rect(top, bottom),
  };
}

function scrollerWithRect(
  top: number,
  scrollHeight: number,
  scrollTop: number,
  elements: FakeMessageElement[] = [],
): FakeScroller {
  return {
    getBoundingClientRect: () => rect(top, top + 400),
    querySelectorAll: () => elements,
    scrollHeight,
    scrollTop,
  };
}

describe(MessageScrollAnchor.name, () => {
  it('keeps the same visual message offset when the anchor is still mounted', () => {
    const scroller = scrollerWithRect(100, 1200, 200, [
      elementWithRect('message-1', 150, 190),
    ]);

    const nextTop = MessageScrollAnchor.restoreOrPreserveOffset(
      scroller as unknown as HTMLElement,
      {
        expiresAt: Date.now() + 1000,
        messageId: 'message-1',
        offsetTop: 20,
      },
      1000,
      120,
    );

    expect(nextTop).toBe(230);
    expect(scroller.scrollTop).toBe(230);
  });

  it('preserves the previous height delta when the anchor is not mounted', () => {
    const scroller = scrollerWithRect(100, 1200, 80);

    const nextTop = MessageScrollAnchor.restoreOrPreserveOffset(
      scroller as unknown as HTMLElement,
      {
        expiresAt: Date.now() + 1000,
        messageId: 'missing-message',
        offsetTop: 20,
      },
      1000,
      80,
    );

    expect(nextTop).toBe(280);
    expect(scroller.scrollTop).toBe(280);
  });
});

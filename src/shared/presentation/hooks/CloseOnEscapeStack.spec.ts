import { CloseOnEscapeStack } from './CloseOnEscapeStack';

describe(CloseOnEscapeStack.name, () => {
  it('treats the latest registered overlay as the only topmost overlay', () => {
    const stack = new CloseOnEscapeStack();
    const first = stack.add();
    const second = stack.add();

    expect(stack.isTopmost(first)).toBe(false);
    expect(stack.isTopmost(second)).toBe(true);
  });

  it('restores the previous overlay when the topmost overlay is removed', () => {
    const stack = new CloseOnEscapeStack();
    const first = stack.add();
    const second = stack.add();

    stack.remove(second);

    expect(stack.isTopmost(first)).toBe(true);
    expect(stack.count()).toBe(1);
  });

  it('ignores duplicate removals for already closed overlays', () => {
    const stack = new CloseOnEscapeStack();
    const token = stack.add();

    stack.remove(token);
    stack.remove(token);

    expect(stack.count()).toBe(0);
  });
});

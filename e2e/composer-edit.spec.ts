import { expect, test } from '@playwright/test';

type HeldAnimationFrames = { releaseAnimationFrames: () => void };

test.beforeEach(async ({ page }) => {
  await page.goto('/e2e/fixtures/composer-edit.html');
  // A busy main thread runs the next animation frame late. Holding the frame
  // callbacks until the test releases them makes that delay deterministic.
  await page.evaluate(() => {
    const held: FrameRequestCallback[] = [];
    const requestAnimationFrame = window.requestAnimationFrame.bind(window);

    window.requestAnimationFrame = (callback) => held.push(callback);
    (window as unknown as HeldAnimationFrames).releaseAnimationFrames = () => {
      window.requestAnimationFrame = requestAnimationFrame;
      for (const callback of held.splice(0)) callback(performance.now());
    };
  });
  await page.getByRole('button', { name: 'Edit message' }).click();
});

test('focuses the edited text with the caret at its end before the next frame', async ({
  page,
}) => {
  const input = page.getByTestId('message-composer-input');

  await expect(input).toHaveValue('original text');
  await expect(input).toBeFocused();
  expect(
    await input.evaluate((element: HTMLTextAreaElement) => [
      element.selectionStart,
      element.selectionEnd,
    ]),
  ).toEqual(['original text'.length, 'original text'.length]);
});

test('replaces the edited text selected before a late frame', async ({
  page,
}) => {
  const input = page.getByTestId('message-composer-input');

  await expect(input).toHaveValue('original text');
  // `fill` selects the text and inserts the new text in two separate steps.
  // A late frame can run between them.
  await input.selectText();
  await page.evaluate(() =>
    (window as unknown as HeldAnimationFrames).releaseAnimationFrames(),
  );
  await page.keyboard.insertText('edited text');

  await expect(input).toHaveValue('edited text');
});

import { expect, test } from '@playwright/test';

test('keeps the desktop members background independent of layers behind it', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.route('**/members-background-fixture', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><html><body><div id="fixture"></div></body></html>',
    }),
  );
  await page.goto('/members-background-fixture');
  await page.evaluate(async () => {
    const refreshPath = '/@react-refresh';
    const { default: refresh } = await import(refreshPath);
    refresh.injectIntoGlobalHook(window);
    Object.assign(window, {
      $RefreshReg$: () => undefined,
      $RefreshSig$: () => (type: unknown) => type,
      __vite_plugin_react_preamble_installed__: true,
    });
    const reactPath = '/node_modules/.vite/deps/react.js';
    const domPath = '/node_modules/.vite/deps/react-dom_client.js';
    const componentPath =
      '/src/contexts/identities/presentation/components/IdentityMembersAside.tsx';
    const cssPath = '/src/index.css';
    const { default: React } = await import(reactPath);
    const { default: ReactDOM } = await import(domPath);
    const { IdentityMembersAside } = await import(componentPath);
    await import(cssPath);
    const backdrop = document.createElement('div');
    backdrop.id = 'backdrop';
    Object.assign(backdrop.style, {
      position: 'fixed',
      right: '0',
      top: '0',
      width: '150px',
      height: '100vh',
      background: 'white',
    });
    document.body.prepend(backdrop);
    const fixture = document.getElementById('fixture')!;
    Object.assign(fixture.style, {
      position: 'fixed',
      right: '0',
      top: '0',
      width: '300px',
      height: '100vh',
    });
    ReactDOM.createRoot(fixture).render(
      React.createElement(IdentityMembersAside, {
        variant: 'desktop',
        items: [],
        emptyLabel: '',
        animateEntries: false,
        onItemClick: () => undefined,
      }),
    );
  });
  const panel = page.getByTestId('identity-members-aside');
  await expect(panel).toBeVisible();
  const withLightLayer = await panel.screenshot();
  await page.evaluate(() => {
    document.getElementById('backdrop')!.style.background = 'black';
  });
  const withDarkLayer = await panel.screenshot();
  expect(withDarkLayer.equals(withLightLayer)).toBe(true);
});

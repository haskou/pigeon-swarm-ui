type InstallPromptWindow = Window & {
  __pigeonAppInstalled?: boolean;
  __pigeonInstallPrompt?: Event | null;
};

// Runs from main.tsx before React mounts so a prompt fired early is not lost.
export function captureInstallPromptEvents(): void {
  const target: InstallPromptWindow = window;

  target.__pigeonInstallPrompt = null;
  target.__pigeonAppInstalled = false;
  target.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    target.__pigeonInstallPrompt = event;
    target.dispatchEvent(new Event('pigeon-beforeinstallprompt'));
  });
  target.addEventListener('appinstalled', () => {
    target.__pigeonAppInstalled = true;
    target.__pigeonInstallPrompt = null;
    target.dispatchEvent(new Event('pigeon-appinstalled'));
  });
}

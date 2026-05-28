import { useEffect, useState } from 'react';

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export type InstallState =
  | 'checking'
  | 'fallback'
  | 'installed'
  | 'prompting'
  | 'ready';

type InstallPromptSnapshot = {
  installPrompt: BeforeInstallPromptEvent | null;
  installState: InstallState;
};

type InstallOutcome = 'accepted' | 'fallback';

const fallbackDelayMs = 1600;
const subscribers = new Set<(snapshot: InstallPromptSnapshot) => void>();

let snapshot: InstallPromptSnapshot = {
  installPrompt: null,
  installState: 'checking',
};
let initialized = false;
let fallbackTimer: number | null = null;

export function useInstallPrompt(): {
  installState: InstallState;
  requestInstall: () => Promise<InstallOutcome>;
} {
  const [currentSnapshot, setCurrentSnapshot] = useState(snapshot);

  useEffect(() => {
    initializeInstallPrompt();
    subscribers.add(setCurrentSnapshot);
    setCurrentSnapshot(snapshot);

    return () => {
      subscribers.delete(setCurrentSnapshot);
    };
  }, []);

  return {
    installState: currentSnapshot.installState,
    requestInstall,
  };
}

async function requestInstall(): Promise<InstallOutcome> {
  if (!snapshot.installPrompt || snapshot.installState !== 'ready') {
    if (snapshot.installState !== 'installed') {
      updateInstallPrompt({
        installPrompt: null,
        installState: 'fallback',
      });
    }

    return 'fallback';
  }

  const installPrompt = snapshot.installPrompt;

  updateInstallPrompt({
    ...snapshot,
    installState: 'prompting',
  });

  try {
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;

    if (choice.outcome === 'accepted') {
      updateInstallPrompt({
        installPrompt: null,
        installState: 'installed',
      });

      return 'accepted';
    }
  } catch {
    updateInstallPrompt({
      installPrompt: null,
      installState: 'fallback',
    });

    return 'fallback';
  }

  updateInstallPrompt({
    installPrompt: null,
    installState: 'fallback',
  });

  return 'fallback';
}

function initializeInstallPrompt(): void {
  if (initialized) return;

  initialized = true;

  if (isPwaStandalone()) {
    updateInstallPrompt({
      installPrompt: null,
      installState: 'installed',
    });

    return;
  }

  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  window.addEventListener('appinstalled', handleAppInstalled);

  fallbackTimer = window.setTimeout(() => {
    if (snapshot.installState === 'checking') {
      updateInstallPrompt({
        ...snapshot,
        installState: 'fallback',
      });
    }
  }, fallbackDelayMs);
}

function handleBeforeInstallPrompt(event: Event): void {
  event.preventDefault();
  updateInstallPrompt({
    installPrompt: event as BeforeInstallPromptEvent,
    installState: 'ready',
  });
}

function handleAppInstalled(): void {
  updateInstallPrompt({
    installPrompt: null,
    installState: 'installed',
  });
}

function updateInstallPrompt(nextSnapshot: InstallPromptSnapshot): void {
  snapshot = nextSnapshot;
  subscribers.forEach((subscriber) => subscriber(snapshot));
}

function isPwaStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';

import type { Session } from '../../../../shared/domain/pigeonResources.types';

import { runWhenBrowserIdle } from '../../../../shared/presentation/runWhenBrowserIdle';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { copy } from '../../../../shared/presentation/i18n/copy';
import {
  currentPwaNotificationPermission,
  ensurePwaPushSubscription,
  type PwaNotificationPermission,
} from '../../infrastructure/browser/pwaNotifications';

type PushNotificationRegistrationState = 'error' | 'idle' | 'loading';

type PushNotificationRegistration = {
  dismissPrompt: () => void;
  enable: () => Promise<void>;
  enableError: null | string;
  enableState: PushNotificationRegistrationState;
  permission: PwaNotificationPermission;
  promptDismissed: boolean;
  promptReady: boolean;
  refreshPermission: () => void;
};

export function usePushNotificationRegistration(
  session: Session,
): PushNotificationRegistration {
  const [permission, setPermission] = useState<PwaNotificationPermission>(() =>
    currentPwaNotificationPermission(),
  );
  const [enableState, setEnableState] =
    useState<PushNotificationRegistrationState>('idle');
  const [enableError, setEnableError] = useState<null | string>(null);
  const [promptDismissed, setPromptDismissed] = useState(false);
  const [promptReady, setPromptReady] = useState(false);
  const enableInFlightRef = useRef(false);

  const refreshPermission = useCallback(() => {
    setPermission(currentPwaNotificationPermission());
  }, []);

  const enable = useCallback(async (): Promise<void> => {
    if (enableInFlightRef.current) return;

    enableInFlightRef.current = true;
    setEnableState('loading');
    setEnableError(null);

    try {
      const registrationState = await ensurePwaPushSubscription(session, {
        requestPermission: true,
      });

      if (registrationState === 'granted') {
        setPermission('granted');
        setPromptDismissed(true);
        setEnableState('idle');

        return;
      }

      refreshPermission();
      setEnableState('error');
      setEnableError(
        registrationState === 'permission_denied'
          ? copy.notifications.enablePushDenied
          : registrationState === 'server_disabled'
            ? copy.notifications.enablePushServerDisabled
            : copy.notifications.enablePushUnsupported,
      );
    } catch (caught) {
      refreshPermission();
      setEnableState('error');
      setEnableError(
        toUserErrorMessage(caught, copy.notifications.enablePushError),
      );
    } finally {
      enableInFlightRef.current = false;
    }
  }, [refreshPermission, session]);

  useEffect(() => {
    let cancelled = false;
    const cancelIdleWork = runWhenBrowserIdle(() => {
      void ensurePwaPushSubscription(session)
        .catch(() => undefined)
        .finally(() => {
          if (!cancelled) refreshPermission();
        });
    });

    return () => {
      cancelled = true;
      cancelIdleWork();
    };
  }, [refreshPermission, session]);

  useEffect(() => {
    setPromptReady(false);
    const timeoutId = window.setTimeout(() => setPromptReady(true), 2800);

    return () => window.clearTimeout(timeoutId);
  }, [session.identity.id]);

  return {
    dismissPrompt: () => setPromptDismissed(true),
    enable,
    enableError,
    enableState,
    permission,
    promptDismissed,
    promptReady,
    refreshPermission,
  };
}

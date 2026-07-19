import type { Dispatch, RefObject, SetStateAction } from 'react';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  NotificationScopeSettingInput,
  NotificationScopeSetting,
  NotificationSettingScope,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { NotificationScopeSettingsTarget } from '../components/NotificationScopeSettingsDialog';
import type { NotificationSettingMap } from '../view-models/NotificationSettingMap';

import { applicationContainer } from '../../../../app/composition/applicationContainer';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { NotificationSettingsPolicy } from '../view-models/NotificationSettingsPolicy';

type UseNotificationScopeSettingsInput = {
  session: Session;
};

export function useNotificationScopeSettings({
  session,
}: UseNotificationScopeSettingsInput): {
  close: () => void;
  error: string | null;
  open: Dispatch<SetStateAction<NotificationScopeSettingsTarget | null>>;
  reset: (scope: NotificationSettingScope) => void;
  save: (setting: NotificationScopeSettingInput) => void;
  setting: NotificationScopeSetting | null;
  settingsByScopeKey: NotificationSettingMap;
  settingsRef: RefObject<NotificationSettingMap>;
  target: NotificationScopeSettingsTarget | null;
  toggleMute: (scope: NotificationSettingScope) => void;
} {
  const [settingsByScopeKey, setSettingsByScopeKey] =
    useState<NotificationSettingMap>({});
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<NotificationScopeSettingsTarget | null>(
    null,
  );
  const settingsRef = useRef<NotificationSettingMap>({});

  useEffect(() => {
    settingsRef.current = settingsByScopeKey;
  }, [settingsByScopeKey]);

  useEffect(() => {
    let cancelled = false;

    void applicationContainer.notifications
      .listNotificationSettings(session)
      .then((settings) => {
        if (cancelled) return;

        setError(null);
        setSettingsByScopeKey(NotificationSettingsPolicy.map(settings));
      })
      .catch(() => {
        if (!cancelled) {
          setError(copy.notifications.settingsError);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session]);

  const applySavedSetting = useCallback((saved: NotificationScopeSetting) => {
    setSettingsByScopeKey((current) => ({
      ...current,
      [NotificationSettingsPolicy.key(saved.scope)]:
        NotificationSettingsPolicy.normalize(saved),
    }));
  }, []);

  const save = useCallback(
    (setting: NotificationScopeSettingInput) => {
      const optimistic = NotificationSettingsPolicy.normalize(setting);
      const key = NotificationSettingsPolicy.key(optimistic.scope);

      setError(null);
      setSettingsByScopeKey((current) => ({
        ...current,
        [key]: optimistic,
      }));

      void applicationContainer.notifications
        .saveNotificationSetting(session, setting)
        .then(applySavedSetting)
        .catch(() => {
          setError(copy.notifications.settingsError);
        });
    },
    [applySavedSetting, session],
  );

  const reset = useCallback(
    (scope: NotificationSettingScope) => {
      const key = NotificationSettingsPolicy.key(scope);

      setError(null);
      setSettingsByScopeKey((current) => {
        const next = { ...current };

        delete next[key];

        return next;
      });

      void applicationContainer.notifications
        .resetNotificationSetting(session, scope)
        .catch(() => {
          setError(copy.notifications.settingsError);
        });
    },
    [session],
  );

  const toggleMute = useCallback(
    (scope: NotificationSettingScope) => {
      const current = NotificationSettingsPolicy.resolve(
        settingsByScopeKey,
        scope,
      );
      const muted = NotificationSettingsPolicy.isMuted(current);

      save({
        ...current,
        mutedUntil: muted ? undefined : null,
        notificationLevel: muted ? 'all' : 'none',
        scope,
      });
    },
    [save, settingsByScopeKey],
  );

  const setting = useMemo(
    () =>
      target
        ? NotificationSettingsPolicy.resolve(settingsByScopeKey, target.scope)
        : null,
    [settingsByScopeKey, target],
  );

  const close = useCallback(() => {
    setError(null);
    setTarget(null);
  }, []);

  return {
    close,
    error,
    open: setTarget,
    reset,
    save,
    setting,
    settingsByScopeKey,
    settingsRef,
    target,
    toggleMute,
  };
}

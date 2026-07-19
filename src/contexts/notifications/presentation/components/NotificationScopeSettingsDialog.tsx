import type { ReactNode } from 'react';

import type {
  NotificationLevel,
  NotificationScopeSetting,
  NotificationScopeSettingInput,
  NotificationSettingScope,
} from '../../../../shared/domain/pigeonResources.types';

import { DialogHeader } from '../../../../shared/presentation/components/DialogHeader';
import { cx } from '../../../../shared/presentation/cx';
import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';
import { useCloseTransition } from '../../../../shared/presentation/hooks/useCloseTransition';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { NotificationSettingsPolicy } from '../view-models/NotificationSettingsPolicy';

export type NotificationScopeSettingsTarget = {
  scope: NotificationSettingScope;
  subtitle?: string;
  title: string;
};

type NotificationScopeSettingsDialogProps = {
  error?: null | string;
  onClose: () => void;
  onReset: (scope: NotificationSettingScope) => void;
  onSave: (setting: NotificationScopeSettingInput) => void;
  setting: NotificationScopeSetting;
  target: NotificationScopeSettingsTarget;
};

const muteDurations = [
  { label: copy.notifications.mute15MinutesShort, value: 15 * 60 * 1000 },
  { label: copy.notifications.mute1HourShort, value: 60 * 60 * 1000 },
  { label: copy.notifications.mute3HoursShort, value: 3 * 60 * 60 * 1000 },
  { label: copy.notifications.mute8HoursShort, value: 8 * 60 * 60 * 1000 },
  { label: copy.notifications.mute24HoursShort, value: 24 * 60 * 60 * 1000 },
] as const;

export function NotificationScopeSettingsDialog({
  error,
  onClose,
  onReset,
  onSave,
  setting,
  target,
}: NotificationScopeSettingsDialogProps) {
  const { close, state } = useCloseTransition(onClose);

  useCloseOnEscape(close);

  const current = NotificationSettingsPolicy.normalize({
    ...setting,
    scope: target.scope,
  });
  const muted = NotificationSettingsPolicy.isMuted(current);

  const save = (partial: Partial<NotificationScopeSettingInput>) => {
    onSave({
      hideMutedChannels: current.hideMutedChannels,
      mobilePushEnabled: current.mobilePushEnabled,
      mutedUntil: current.mutedUntil,
      notificationLevel: current.notificationLevel,
      scope: target.scope,
      suppressEveryoneAndHere: current.suppressEveryoneAndHere,
      suppressRoleMentions: current.suppressRoleMentions,
      ...partial,
    });
  };

  return (
    <>
      <button
        type="button"
        className="app-overlay-scrim fixed inset-0 z-[120] bg-black/55 backdrop-blur-sm"
        data-state={state}
        onClick={close}
        aria-label={copy.dialog.close}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={copy.notifications.settingsTitle}
        className="app-overlay-surface ui-dialog-surface fixed left-1/2 top-1/2 z-[130] flex max-h-[86vh] w-[min(92vw,500px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden text-white"
        data-state={state}
      >
        <DialogHeader
          description={
            target.subtitle
              ? `${target.title} · ${target.subtitle}`
              : target.title
          }
          title={copy.notifications.settingsTitle}
          onClose={close}
        />

        <div className="min-h-0 space-y-5 overflow-y-auto px-5 py-4">
          <section className="grid gap-2">
            <SectionTitle label={copy.notifications.receiveNotifications} />
            <NotificationLevelOption
              checked={current.notificationLevel === 'all' && !muted}
              label={copy.notifications.levelAll}
              onSelect={() =>
                save({ mutedUntil: undefined, notificationLevel: 'all' })
              }
              value="all"
            />
            <NotificationLevelOption
              checked={current.notificationLevel === 'mentions' && !muted}
              label={copy.notifications.levelMentions}
              onSelect={() =>
                save({ mutedUntil: undefined, notificationLevel: 'mentions' })
              }
              value="mentions"
            />
            <NotificationLevelOption
              checked={current.notificationLevel === 'none' || muted}
              label={copy.notifications.levelNone}
              onSelect={() =>
                save({ mutedUntil: null, notificationLevel: 'none' })
              }
              value="none"
            />
          </section>

          <section className="grid gap-2">
            <SectionTitle label={copy.notifications.muteDuring} />
            <div className="grid grid-cols-5 gap-2">
              {muteDurations.map((duration) => (
                <button
                  key={duration.value}
                  type="button"
                  onClick={() =>
                    save({
                      mutedUntil: Date.now() + duration.value,
                      notificationLevel:
                        current.notificationLevel === 'none'
                          ? 'all'
                          : current.notificationLevel,
                    })
                  }
                  className="ui-button min-h-10 px-2 text-center text-sm"
                >
                  {duration.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                save({ mutedUntil: null, notificationLevel: 'none' })
              }
              className={cx(
                'ui-button min-h-11 px-3 text-center text-sm',
                muted && current.mutedUntil === null
                  ? 'border-violet-200/30 bg-violet-400/20 text-white'
                  : 'border-white/10 bg-white/[0.06] text-white/75 hover:border-violet-200/30 hover:bg-violet-400/10 hover:text-white',
              )}
            >
              {copy.notifications.muteIndefinitely}
            </button>
          </section>

          <section className="grid gap-3">
            <SectionTitle label={copy.notifications.advancedOptions} />
            <div className="border-y border-white/10 py-1">
              <ToggleGroup title={copy.notifications.mentionsOptions}>
                <SwitchRow
                  checked={current.suppressEveryoneAndHere}
                  label={copy.notifications.suppressEveryoneAndHere}
                  onChange={(checked) =>
                    save({ suppressEveryoneAndHere: checked })
                  }
                />
                <SwitchRow
                  checked={current.suppressRoleMentions}
                  label={copy.notifications.suppressRoleMentions}
                  onChange={(checked) =>
                    save({ suppressRoleMentions: checked })
                  }
                />
              </ToggleGroup>
              <ToggleGroup title={copy.notifications.visibilityOptions}>
                <SwitchRow
                  checked={current.hideMutedChannels}
                  label={copy.notifications.hideMutedChannels}
                  onChange={(checked) => save({ hideMutedChannels: checked })}
                />
              </ToggleGroup>
              <ToggleGroup title={copy.notifications.mobileOptions}>
                <SwitchRow
                  checked={current.mobilePushEnabled}
                  label={copy.notifications.mobilePushEnabled}
                  onChange={(checked) => save({ mobilePushEnabled: checked })}
                />
              </ToggleGroup>
            </div>
          </section>

          {error ? (
            <div className="ui-inline-notice border-rose-300/20 bg-rose-500/10 text-sm font-bold text-rose-100">
              {error}
            </div>
          ) : null}

          <footer className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={() => onReset(target.scope)}
              className="ui-button"
            >
              {copy.notifications.restoreDefault}
            </button>
            <button
              type="button"
              onClick={close}
              className="ui-button ui-button-primary"
            >
              {copy.notifications.done}
            </button>
          </footer>
        </div>
      </section>
    </>
  );
}

function SectionTitle({ label }: { label: string }) {
  return (
    <h3 className="text-xs font-black uppercase tracking-[0.12em] text-white/40">
      {label}
    </h3>
  );
}

function NotificationLevelOption({
  checked,
  label,
  onSelect,
}: {
  checked: boolean;
  label: string;
  onSelect: () => void;
  value: NotificationLevel;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cx(
        'flex min-h-12 w-full cursor-pointer items-center gap-3 border-l-2 px-3 text-left text-sm font-bold transition',
        checked
          ? 'border-l-cyan-300/80 bg-cyan-300/10 text-cyan-50'
          : 'border-l-transparent text-white/70 hover:bg-white/[0.06] hover:text-white',
      )}
    >
      <span
        className={cx(
          'grid h-5 w-5 shrink-0 place-items-center rounded-full border transition',
          checked
            ? 'border-cyan-200 bg-cyan-400/70'
            : 'border-white/25 bg-transparent',
        )}
      >
        {checked ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
      </span>
      <span className="min-w-0 flex-1">{label}</span>
    </button>
  );
}

function ToggleGroup({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <div className="border-b border-white/10 px-1 py-2 last:border-b-0">
      <div className="px-2 pb-1 text-[0.68rem] font-black uppercase tracking-[0.12em] text-white/30">
        {title}
      </div>
      <div className="grid gap-1">{children}</div>
    </div>
  );
}

function SwitchRow({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 px-2 py-1 text-sm font-semibold text-white/75 transition hover:bg-white/[0.06] hover:text-white">
      <span className="min-w-0 flex-1 leading-5">{label}</span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className={cx(
          'relative h-6 w-11 shrink-0 rounded-full border transition',
          checked
            ? 'border-violet-200/30 bg-[#7f6cff]'
            : 'border-white/12 bg-white/12',
        )}
      >
        <span
          className={cx(
            'absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow-sm transition',
            checked ? 'left-[1.3rem]' : 'left-0.5',
          )}
        />
      </span>
    </label>
  );
}

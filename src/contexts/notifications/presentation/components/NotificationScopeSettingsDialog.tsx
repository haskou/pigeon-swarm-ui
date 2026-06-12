import type { ReactNode } from 'react';

import type {
  NotificationLevel,
  NotificationScopeSetting,
  NotificationScopeSettingInput,
  NotificationSettingScope,
} from '../../../../shared/domain/pigeonResources.types';

import { NotificationSettingsPolicy } from '../../domain/NotificationSettingsPolicy';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { cx } from '../../../../shared/presentation/cx';
import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';
import { useCloseTransition } from '../../../../shared/presentation/hooks/useCloseTransition';

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
        className="app-overlay-surface fixed left-1/2 top-1/2 z-[130] max-h-[86vh] w-[min(92vw,500px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-white/10 bg-[#1f2029] p-5 text-white shadow-2xl shadow-black/50"
        data-state={state}
      >
        <header className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-black leading-tight text-white">
              {copy.notifications.settingsTitle}
            </h2>
            <p className="mt-1 truncate text-sm font-semibold text-white/50">
              {target.title}
              {target.subtitle ? (
                <span className="font-medium text-white/35">
                  {' '}
                  · {target.subtitle}
                </span>
              ) : null}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[0.06] text-lg font-black leading-none text-white/50 transition hover:bg-white/[0.12] hover:text-white"
            aria-label={copy.dialog.close}
          >
            ×
          </button>
        </header>

        <div className="space-y-5">
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
                  className="min-h-10 rounded-xl border border-white/10 bg-white/[0.06] px-2 text-center text-sm font-black text-white/75 transition hover:border-violet-200/30 hover:bg-violet-400/10 hover:text-white"
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
                'min-h-11 rounded-xl border px-3 text-center text-sm font-black transition',
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
            <div className="rounded-2xl bg-black/12 p-2">
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
            <div className="rounded-2xl border border-rose-300/20 bg-rose-500/10 p-3 text-sm font-black text-rose-100">
              {error}
            </div>
          ) : null}

          <footer className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={() => onReset(target.scope)}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-black text-white/55 transition hover:bg-white/10 hover:text-white"
            >
              {copy.notifications.restoreDefault}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-[#8b6cff] px-5 py-2 text-sm font-black text-white shadow-lg shadow-[#8b6cff]/20 transition hover:bg-[#9b7dff]"
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
        'flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-xl border px-3 text-left text-sm font-black transition',
        checked
          ? 'border-violet-200/30 bg-violet-400/20 text-white shadow-[inset_0_0_0_1px_rgba(196,181,253,0.08)]'
          : 'border-transparent bg-white/[0.03] text-white/70 hover:bg-white/10 hover:text-white',
      )}
    >
      <span
        className={cx(
          'grid h-5 w-5 shrink-0 place-items-center rounded-full border transition',
          checked
            ? 'border-violet-200 bg-[#7f6cff]'
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
    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 py-1 text-sm font-black text-white/75 transition hover:bg-white/10 hover:text-white">
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

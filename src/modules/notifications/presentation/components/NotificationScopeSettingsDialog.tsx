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
  { label: copy.notifications.mute15Minutes, value: 15 * 60 * 1000 },
  { label: copy.notifications.mute1Hour, value: 60 * 60 * 1000 },
  { label: copy.notifications.mute3Hours, value: 3 * 60 * 60 * 1000 },
  { label: copy.notifications.mute8Hours, value: 8 * 60 * 60 * 1000 },
  { label: copy.notifications.mute24Hours, value: 24 * 60 * 60 * 1000 },
] as const;

export function NotificationScopeSettingsDialog({
  error,
  onClose,
  onReset,
  onSave,
  setting,
  target,
}: NotificationScopeSettingsDialogProps) {
  useCloseOnEscape(onClose);

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
        className="fixed inset-0 z-[120] bg-black/55 backdrop-blur-sm"
        onClick={onClose}
        aria-label={copy.dialog.close}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={copy.notifications.settingsTitle}
        className="fixed left-1/2 top-1/2 z-[130] max-h-[86vh] w-[min(92vw,480px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-white/10 bg-[#1f2029] p-4 text-white shadow-2xl shadow-black/50"
      >
        <header className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-white/40">
              {copy.notifications.settingsTitle}
            </p>
            <h2 className="mt-1 truncate text-lg font-black">{target.title}</h2>
            {target.subtitle ? (
              <p className="mt-1 truncate text-sm text-white/45">
                {target.subtitle}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/8 text-white/60 transition hover:bg-white/12 hover:text-white"
            aria-label={copy.dialog.close}
          >
            x
          </button>
        </header>

        <div className="space-y-4">
          <section className="rounded-2xl border border-white/10 bg-black/15 p-2">
            <NotificationLevelOption
              checked={current.notificationLevel === 'all' && !muted}
              label={copy.notifications.levelAll}
              onSelect={() => save({ mutedUntil: undefined, notificationLevel: 'all' })}
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
              onSelect={() => save({ mutedUntil: null, notificationLevel: 'none' })}
              value="none"
            />
          </section>

          <section className="grid gap-2">
            <div className="text-xs font-black uppercase tracking-[0.14em] text-white/35">
              {copy.notifications.muteScope}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
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
                  className="rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-left text-sm font-black text-white/75 transition hover:bg-white/10 hover:text-white"
                >
                  {duration.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => save({ mutedUntil: null, notificationLevel: 'none' })}
                className="rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-left text-sm font-black text-white/75 transition hover:bg-white/10 hover:text-white sm:col-span-2"
              >
                {copy.notifications.muteIndefinitely}
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-black/15 p-2">
            <ToggleRow
              checked={current.suppressEveryoneAndHere}
              label={copy.notifications.suppressEveryoneAndHere}
              onChange={(checked) =>
                save({ suppressEveryoneAndHere: checked })
              }
            />
            <ToggleRow
              checked={current.suppressRoleMentions}
              label={copy.notifications.suppressRoleMentions}
              onChange={(checked) => save({ suppressRoleMentions: checked })}
            />
            <ToggleRow
              checked={current.hideMutedChannels}
              label={copy.notifications.hideMutedChannels}
              onChange={(checked) => save({ hideMutedChannels: checked })}
            />
            <ToggleRow
              checked={current.mobilePushEnabled}
              label={copy.notifications.mobilePushEnabled}
              onChange={(checked) => save({ mobilePushEnabled: checked })}
            />
          </section>

          {error ? (
            <div className="rounded-2xl border border-rose-300/20 bg-rose-500/10 p-3 text-sm font-black text-rose-100">
              {error}
            </div>
          ) : null}

          <footer className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => onReset(target.scope)}
              className="rounded-xl border border-white/10 bg-white/6 px-4 py-2 text-sm font-black text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              {copy.notifications.useDefault}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-fuchsia-500 px-4 py-2 text-sm font-black text-white transition hover:bg-fuchsia-400"
            >
              {copy.dialog.close}
            </button>
          </footer>
        </div>
      </section>
    </>
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
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-black text-white/80 transition hover:bg-white/8"
    >
      <span className="min-w-0 flex-1">{label}</span>
      <span
        className={cx(
          'grid h-5 w-5 place-items-center rounded-full border transition',
          checked
            ? 'border-fuchsia-300 bg-fuchsia-500'
            : 'border-white/25 bg-transparent',
        )}
      >
        {checked ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
      </span>
    </button>
  );
}

function ToggleRow({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm font-black text-white/80 transition hover:bg-white/8">
      <span className="min-w-0 flex-1">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 rounded border-white/25 bg-transparent accent-fuchsia-500"
      />
    </label>
  );
}

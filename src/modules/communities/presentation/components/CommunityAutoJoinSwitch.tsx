import { copy } from '../../../../shared/presentation/i18n/copy';
import { cx } from '../../../../shared/presentation/cx';

type CommunityAutoJoinSwitchProps = {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
};

export function CommunityAutoJoinSwitch({
  checked,
  disabled = false,
  onChange,
}: CommunityAutoJoinSwitchProps) {
  return (
    <label
      className={cx(
        'flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 p-4',
        disabled
          ? 'cursor-not-allowed opacity-55'
          : 'cursor-pointer transition hover:bg-white/8',
      )}
    >
      <span className="min-w-0">
        <span className="block text-sm font-black text-white">
          {copy.communities.autoJoin}
        </span>
        <span className="mt-1 block text-xs leading-relaxed text-white/45">
          {copy.communities.autoJoinHelp}
        </span>
      </span>
      <span className="relative shrink-0">
        <input
          aria-label={copy.communities.autoJoin}
          checked={checked}
          className="peer sr-only"
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          role="switch"
          type="checkbox"
        />
        <span
          aria-hidden="true"
          className={cx(
            'block h-8 w-14 rounded-full border transition peer-focus-visible:ring-2 peer-focus-visible:ring-amber-200/70 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-slate-950',
            checked
              ? 'border-amber-200/55 bg-amber-300/85'
              : 'border-white/10 bg-white/12',
          )}
        >
          <span
            className={cx(
              'block h-7 w-7 rounded-full bg-white shadow-lg shadow-black/35 transition-transform',
              checked ? 'translate-x-6' : 'translate-x-0',
            )}
          />
        </span>
      </span>
    </label>
  );
}

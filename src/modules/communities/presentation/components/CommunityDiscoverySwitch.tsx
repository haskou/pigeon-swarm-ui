import { copy } from '../../../../shared/presentation/i18n/copy';
import { cx } from '../../../../shared/presentation/cx';

type CommunityDiscoverySwitchProps = {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
};

export function CommunityDiscoverySwitch({
  checked,
  disabled = false,
  onChange,
}: CommunityDiscoverySwitchProps) {
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
          {copy.communities.appearInDiscovery}
        </span>
        <span className="mt-1 block text-xs leading-relaxed text-white/45">
          {copy.communities.appearInDiscoveryHelp}
        </span>
      </span>
      <span className="relative shrink-0">
        <input
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          className="peer sr-only"
          aria-label={copy.communities.appearInDiscovery}
        />
        <span
          aria-hidden="true"
          className={cx(
            'block h-8 w-14 rounded-full border transition peer-focus-visible:ring-2 peer-focus-visible:ring-cyan-200/70 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-slate-950',
            checked
              ? 'border-cyan-200/55 bg-cyan-300/85'
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

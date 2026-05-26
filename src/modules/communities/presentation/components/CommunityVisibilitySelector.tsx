import type { CommunityVisibility } from '../../../../shared/domain/pigeonResources.types';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { cx } from '../../../../shared/presentation/cx';

type CommunityVisibilitySelectorProps = {
  disabled?: boolean;
  onChange: (visibility: CommunityVisibility) => void;
  value: CommunityVisibility;
};

const visibilityOptions: CommunityVisibility[] = ['private', 'public'];

export function CommunityVisibilitySelector({
  disabled = false,
  onChange,
  value,
}: CommunityVisibilitySelectorProps) {
  return (
    <fieldset className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <legend className="text-xs font-black uppercase tracking-[0.16em] text-white/35">
        {copy.communities.visibility}
      </legend>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {visibilityOptions.map((option) => {
          const selected = value === option;

          return (
            <button
              aria-pressed={selected}
              className={cx(
                'rounded-2xl border px-4 py-3 text-left transition',
                selected
                  ? 'border-cyan-300/60 bg-cyan-300/15 text-white'
                  : 'border-white/10 bg-white/6 text-white/60 hover:bg-white/10',
                disabled ? 'cursor-not-allowed opacity-60' : '',
              )}
              disabled={disabled}
              key={option}
              onClick={() => onChange(option)}
              type="button"
            >
              <span className="block text-sm font-black">
                {option === 'public'
                  ? copy.communities.publicCommunity
                  : copy.communities.privateCommunity}
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-white/45">
                {option === 'public'
                  ? copy.communities.publicCommunityHelp
                  : copy.communities.privateCommunityHelp}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

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
    <fieldset className="border-t border-white/10 pt-4">
      <legend className="text-xs font-black uppercase tracking-[0.16em] text-white/35">
        {copy.communities.visibility}
      </legend>
      <div className="mt-3 grid gap-4">
        {visibilityOptions.map((option) => {
          const selected = value === option;
          const title =
            option === 'public'
              ? copy.communities.publicCommunity
              : copy.communities.privateCommunity;
          const description =
            option === 'public'
              ? copy.communities.publicCommunityHelp
              : copy.communities.privateCommunityHelp;

          return (
            <button
              aria-pressed={selected}
              className={cx(
                'flex items-start justify-between gap-6 text-left transition',
                selected ? 'text-white' : 'text-white/70 hover:text-white',
                disabled ? 'cursor-not-allowed opacity-60' : '',
              )}
              disabled={disabled}
              key={option}
              onClick={() => onChange(option)}
              type="button"
            >
              <span className="min-w-0">
                <span className="block text-sm font-black">{title}</span>
                <span className="mt-1 block text-xs leading-relaxed text-white/45">
                  {description}
                </span>
              </span>
              <span
                aria-hidden="true"
                className={cx(
                  'mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border transition',
                  selected
                    ? 'border-fuchsia-200 bg-fuchsia-300'
                    : 'border-white/20 bg-white/10',
                )}
              >
                <span
                  className={cx(
                    'h-2.5 w-2.5 rounded-full bg-slate-950 transition-opacity',
                    selected ? 'opacity-100' : 'opacity-0',
                  )}
                />
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

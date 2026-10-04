import { SearchIcon } from '../../../../shared/presentation/components/ClearableSearchInput';
import { copy } from '../../../../shared/presentation/i18n/copy';

type CommunityMessageSearchToggleProps = {
  onToggle: () => void;
  open: boolean;
};

export function CommunityMessageSearchToggle({
  onToggle,
  open,
}: CommunityMessageSearchToggleProps) {
  return (
    <button
      aria-expanded={open}
      aria-label={copy.communities.searchMessages}
      className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 text-white/70 transition hover:bg-white/15 sm:flex sm:h-auto sm:w-auto sm:gap-2 sm:px-3 sm:py-2 sm:text-sm sm:font-black"
      onClick={onToggle}
      title={copy.communities.searchMessages}
      type="button"
    >
      <SearchIcon className="h-5 w-5 sm:h-4 sm:w-4" />
      <span className="hidden sm:inline">
        {copy.communities.searchMessages}
      </span>
    </button>
  );
}

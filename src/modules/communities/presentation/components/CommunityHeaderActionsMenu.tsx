import type { ReactNode } from 'react';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';

type CommunityHeaderActionsMenuProps = {
  communityLeaving: boolean;
  hasCommunityKey: boolean;
  open: boolean;
  showCommunityKeyAction?: boolean;
  onClose: () => void;
  onCommunityDataOpen: () => void;
  onCommunityKeyOpen: () => void;
  onLeaveCommunity: () => void;
  onOpenPins?: () => void;
};

export function CommunityHeaderActionsMenu({
  communityLeaving,
  hasCommunityKey,
  open,
  showCommunityKeyAction = true,
  onClose,
  onCommunityDataOpen,
  onCommunityKeyOpen,
  onLeaveCommunity,
  onOpenPins,
}: CommunityHeaderActionsMenuProps): ReactNode {
  useCloseOnEscape(onClose, open);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-30 cursor-default"
        onClick={onClose}
        aria-label={copy.dialog.close}
      />
      <div className="absolute right-0 top-[calc(100%+.5rem)] z-40 min-w-44 overflow-hidden rounded-2xl border border-white/10 bg-[#15172d] p-1 text-sm shadow-2xl shadow-black/40">
        {onOpenPins ? (
          <button
            type="button"
            onClick={() => {
              onOpenPins();
              onClose();
            }}
            className="block w-full rounded-2xl px-3 py-2 text-left font-black text-white/80 transition hover:bg-white/10 sm:hidden"
          >
            {copy.messages.viewPinned}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onCommunityDataOpen}
          className="block w-full rounded-2xl px-3 py-2 text-left font-black text-white/80 transition hover:bg-white/10"
        >
          {copy.chat.viewData}
        </button>
        {showCommunityKeyAction ? (
          <button
            type="button"
            onClick={onCommunityKeyOpen}
            className="block w-full rounded-2xl px-3 py-2 text-left font-black text-white/80 transition hover:bg-white/10"
          >
            {hasCommunityKey
              ? copy.chat.copyPrivateKey
              : copy.chat.addPrivateKey}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onLeaveCommunity}
          disabled={communityLeaving}
          className="block w-full rounded-2xl px-3 py-2 text-left font-black text-rose-100 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:text-white/30 disabled:hover:bg-transparent"
        >
          {communityLeaving ? copy.communities.leaving : copy.communities.leave}
        </button>
      </div>
    </>
  );
}

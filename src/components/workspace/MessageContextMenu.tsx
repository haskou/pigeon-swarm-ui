import type { ChatMessage } from '../../domain/types';

import { copy } from '../../i18n/en';

export type MessageContextMenuState = {
  message: ChatMessage;
  x: number;
  y: number;
};

export function MessageContextMenu({
  menu,
  onClose,
  onDelete,
  onReply,
  onViewRaw,
}: {
  menu: MessageContextMenuState;
  onClose: () => void;
  onDelete?: () => void;
  onReply?: () => void;
  onViewRaw: () => void;
}) {
  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[80] cursor-default"
        onClick={onClose}
        aria-label={copy.dialog.close}
      />
      <div
        className="fixed z-[90] min-w-44 overflow-hidden rounded-2xl border border-white/10 bg-[#15172d] p-1 text-sm shadow-2xl shadow-black/40"
        style={{ left: menu.x, top: menu.y }}
      >
        {onReply ? (
          <button
            type="button"
            onClick={onReply}
            className="block w-full rounded-xl px-3 py-2 text-left font-black text-white/80 transition hover:bg-white/10"
          >
            {copy.messages.reply}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onViewRaw}
          className="block w-full rounded-xl px-3 py-2 text-left font-black text-white/80 transition hover:bg-white/10"
        >
          {copy.messages.viewRaw}
        </button>
        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            className="block w-full rounded-xl px-3 py-2 text-left font-black text-rose-200 transition hover:bg-rose-500/15"
          >
            {copy.messages.delete}
          </button>
        ) : null}
      </div>
    </>
  );
}

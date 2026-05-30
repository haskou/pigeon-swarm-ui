import type { CallSession } from '../../domain/callSession.types';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { callSessionTitle } from './callSessionDisplay';
import { SpeakerIcon } from './callIcons';

export function CallStageHeader({
  call,
  dataOpen,
  onClose,
  onDataToggle,
  subtitle,
}: {
  call: CallSession;
  dataOpen: boolean;
  onClose: () => void;
  onDataToggle: () => void;
  subtitle: string;
}) {
  const title = callSessionTitle(call);

  return (
    <header className="flex flex-wrap items-center gap-2 border-b border-white/10 p-2.5 sm:gap-3 sm:p-5">
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-400/15 text-emerald-200 sm:h-12 sm:w-12 sm:rounded-2xl">
        <SpeakerIcon />
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-base font-black text-white sm:text-xl">
          {title}
        </h2>
        <p className="truncate text-xs text-white/50 sm:text-sm">
          {call.status === 'permission-denied'
            ? copy.calls.microphoneUnavailable
            : subtitle || copy.calls.waitingForParticipants}
        </p>
        {!call.hasMicrophone && (
          <p className="mt-1 text-xs font-bold text-amber-200/85">
            {copy.calls.microphoneUnavailable}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onDataToggle}
        className="rounded-xl bg-white/10 px-3 py-2 text-xs font-black text-white transition hover:bg-white/15 sm:rounded-2xl sm:px-4 sm:text-sm"
      >
        {dataOpen ? copy.calls.hideCallData : copy.calls.viewCallData}
      </button>
      <button
        type="button"
        onClick={onClose}
        className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-white/70 transition hover:bg-white/15 hover:text-white sm:h-10 sm:w-10 sm:rounded-2xl"
        aria-label={copy.dialog.close}
      >
        x
      </button>
    </header>
  );
}

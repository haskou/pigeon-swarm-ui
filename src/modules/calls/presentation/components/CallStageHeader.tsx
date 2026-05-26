import type { CallSession } from '../../domain/callSession.types';

import { copy } from '../../../../shared/presentation/i18n/copy';
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
  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-white/10 p-4 sm:p-5">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-400/15 text-emerald-200">
        <SpeakerIcon />
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-xl font-black text-white">{call.title}</h2>
        <p className="truncate text-sm text-white/50">
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
        className="rounded-2xl bg-white/10 px-4 py-2 text-sm font-black text-white transition hover:bg-white/15"
      >
        {dataOpen ? 'Hide call data' : 'View call data'}
      </button>
      <button
        type="button"
        onClick={onClose}
        className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10 text-white/70 transition hover:bg-white/15 hover:text-white"
        aria-label={copy.dialog.close}
      >
        x
      </button>
    </header>
  );
}

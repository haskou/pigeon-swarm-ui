import type { CallParticipant } from '../../domain/callSession.types';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { callParticipantDisplayName } from './callParticipantDisplayName';
import { ScreenShareVolumeControl } from './ScreenShareVolumeControl';
import { VideoPreview } from './VideoPreview';

export function ExpandedScreenShare({
  onClose,
  onScreenShareVolumeChange,
  participant,
  screenShareVolumePercent,
}: {
  onClose: () => void;
  onScreenShareVolumeChange: (volumePercent: number) => void;
  participant: CallParticipant;
  screenShareVolumePercent: number;
}) {
  if (!participant.screenStream) return null;

  const participantName = callParticipantDisplayName(participant);

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/95 p-4 text-white"
      onClick={(event) => {
        event.stopPropagation();
        onClose();
      }}
    >
      <div
        className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#05060b]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-white">
              {participantName}
            </p>
            <p className="text-xs text-white/45">{copy.calls.screen}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10 text-white/70 transition hover:bg-white/15 hover:text-white"
            aria-label={copy.dialog.close}
          >
            x
          </button>
        </header>
        <div className="min-h-0 flex-1 bg-black">
          <VideoPreview
            fit="contain"
            label={`${copy.calls.screen} ${participantName}`}
            muted
            stream={participant.screenStream}
          />
        </div>
        <div className="border-t border-white/10 px-4 py-3">
          <ScreenShareVolumeControl
            className="mx-auto w-full max-w-sm sm:max-w-md"
            placement="inline"
            onChange={onScreenShareVolumeChange}
            value={screenShareVolumePercent}
          />
        </div>
      </div>
    </div>
  );
}

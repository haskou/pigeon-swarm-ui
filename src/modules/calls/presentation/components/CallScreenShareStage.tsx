import type { CallParticipant } from '../../domain/callSession.types';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { callParticipantDisplayName } from './callParticipantDisplayName';
import { ScreenShareVolumeControl } from './ScreenShareVolumeControl';
import { VideoPreview } from './VideoPreview';

export function CallScreenShareStage({
  onExpand,
  onScreenShareVolumeChange,
  participant,
  screenShareVolumePercent,
}: {
  onExpand: () => void;
  onScreenShareVolumeChange: (volumePercent: number) => void;
  participant: CallParticipant;
  screenShareVolumePercent: number;
}) {
  if (!participant.screenStream) return null;

  const participantName = callParticipantDisplayName(participant);

  return (
    <div
      className="group relative min-h-0 flex-1 overflow-hidden rounded-xl border border-white/10 bg-black text-left shadow-2xl shadow-black/45 sm:rounded-[1.35rem]"
      title={copy.calls.screen}
    >
      <button
        type="button"
        onClick={onExpand}
        className="absolute inset-0 z-10 cursor-zoom-in"
        aria-label={`${copy.calls.screen} ${participantName}`}
      />
      <VideoPreview
        fit="contain"
        label={`${copy.calls.screen} ${participantName}`}
        muted
        stream={participant.screenStream}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between bg-gradient-to-b from-black/75 to-transparent px-3 py-2 sm:px-4 sm:py-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-black text-white sm:text-sm">
            {participantName}
          </p>
          <p className="text-[0.65rem] font-bold text-emerald-200/85 sm:text-xs">
            {copy.calls.screen}
          </p>
        </div>
        <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[0.65rem] font-black text-white shadow-lg shadow-black/30 sm:px-2.5 sm:py-1 sm:text-xs">
          {copy.calls.live}
        </span>
      </div>
      <ScreenShareVolumeControl
        className="hidden sm:block"
        onChange={onScreenShareVolumeChange}
        value={screenShareVolumePercent}
      />
    </div>
  );
}

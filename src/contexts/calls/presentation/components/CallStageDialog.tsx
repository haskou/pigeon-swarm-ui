import { useState } from 'react';

import type { CallSession } from '../../domain/callSession.types';

import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';
import { CallStageBody } from './CallStageBody';
import { CallStageFooter } from './CallStageFooter';
import { CallStageHeader } from './CallStageHeader';
import { ExpandedScreenShare } from './ExpandedScreenShare';

export function CallStageDialog({
  call,
  dataOpen,
  onClose,
  onDataToggle,
  onEnd,
  onParticipantScreenShareVolumeChange,
  onParticipantVolumeChange,
  onScreenShareQualityChange,
  onToggleCamera,
  onToggleDeafen,
  onToggleMute,
  onToggleNoiseCancellation,
  onRetryMicrophone,
  onToggleScreenShare,
  subtitle,
}: {
  call: CallSession;
  dataOpen: boolean;
  onClose: () => void;
  onDataToggle: () => void;
  onEnd: () => void;
  onParticipantVolumeChange: (
    identityId: string,
    volumePercent: number,
  ) => void;
  onParticipantScreenShareVolumeChange: (
    identityId: string,
    volumePercent: number,
  ) => void;
  onScreenShareQualityChange: (
    quality: CallSession['screenShareQuality'],
  ) => void;
  onToggleCamera: () => void;
  onToggleDeafen: () => void;
  onToggleMute: () => void;
  onToggleNoiseCancellation: () => void;
  onRetryMicrophone: () => void;
  onToggleScreenShare: () => void;
  subtitle: string;
}) {
  useCloseOnEscape(onClose);

  const [expandedScreen, setExpandedScreen] = useState<
    CallSession['participants'][number] | null
  >(null);

  return (
    <div
      data-testid="call-stage-dialog"
      className="fixed inset-0 z-[110] bg-[#060712]/95 p-0 text-white backdrop-blur-xl sm:p-4"
      onClick={onClose}
    >
      <section
        className="ui-dialog-surface mx-auto flex h-full max-w-6xl flex-col overflow-hidden sm:rounded-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <CallStageHeader
          call={call}
          dataOpen={dataOpen}
          onClose={onClose}
          onDataToggle={onDataToggle}
          onRetryMicrophone={onRetryMicrophone}
          subtitle={subtitle}
        />
        <CallStageBody
          call={call}
          dataOpen={dataOpen}
          onExpandScreen={setExpandedScreen}
          onParticipantScreenShareVolumeChange={
            onParticipantScreenShareVolumeChange
          }
          onParticipantVolumeChange={onParticipantVolumeChange}
          onScreenShareQualityChange={onScreenShareQualityChange}
          onToggleMute={onToggleMute}
        />
        <CallStageFooter
          call={call}
          onEnd={onEnd}
          onToggleCamera={onToggleCamera}
          onToggleDeafen={onToggleDeafen}
          onToggleMute={onToggleMute}
          onToggleNoiseCancellation={onToggleNoiseCancellation}
          onToggleScreenShare={onToggleScreenShare}
        />
      </section>
      {expandedScreen?.screenStream && (
        <ExpandedScreenShare
          onClose={() => setExpandedScreen(null)}
          onScreenShareVolumeChange={(volumePercent) =>
            onParticipantScreenShareVolumeChange(
              expandedScreen.identityId,
              volumePercent,
            )
          }
          onScreenShareQualityChange={onScreenShareQualityChange}
          participant={expandedScreen}
          qualityEditable={expandedScreen.identityId === call.currentIdentityId}
          screenShareQuality={call.screenShareQuality}
          screenShareVolumePercent={
            call.screenShareVolumes[expandedScreen.identityId] ?? 100
          }
        />
      )}
    </div>
  );
}

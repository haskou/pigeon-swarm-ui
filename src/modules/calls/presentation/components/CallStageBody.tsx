import type { CallSession } from '../../domain/callSession.types';

import { cx } from '../../../../shared/presentation/cx';
import { CallDataPanel } from './CallDataPanel';
import { callParticipantHasActiveScreenShare } from './callParticipantHasActiveScreenShare';
import { CallParticipantTiles } from './CallParticipantTiles';
import { CallScreenShareStage } from './CallScreenShareStage';
import { ScreenShareVolumeControl } from './ScreenShareVolumeControl';

export function CallStageBody({
  call,
  dataOpen,
  onExpandScreen,
  onParticipantScreenShareVolumeChange,
  onParticipantVolumeChange,
  onToggleMute,
}: {
  call: CallSession;
  dataOpen: boolean;
  onExpandScreen: (participant: CallSession['participants'][number]) => void;
  onParticipantScreenShareVolumeChange: (
    identityId: string,
    volumePercent: number,
  ) => void;
  onParticipantVolumeChange: (
    identityId: string,
    volumePercent: number,
  ) => void;
  onToggleMute: () => void;
}) {
  const screenParticipant =
    call.participants.find(
      (participant) =>
        participant.identityId !== call.currentIdentityId &&
        callParticipantHasActiveScreenShare(participant),
    ) ?? call.participants.find(callParticipantHasActiveScreenShare);

  if (screenParticipant?.screenStream) {
    const screenShareVolumePercent =
      call.screenShareVolumes[screenParticipant.identityId] ?? 100;

    return (
      <div
        className={cx(
          'min-h-0 flex-1 gap-2 overflow-hidden p-2.5 sm:gap-4 sm:p-5',
          dataOpen ? 'flex flex-col xl:flex-row' : 'flex flex-col',
        )}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-2 sm:gap-4">
          <CallScreenShareStage
            onExpand={() => onExpandScreen(screenParticipant)}
            participant={screenParticipant}
          />
          <ScreenShareVolumeControl
            className="mx-auto w-full max-w-sm sm:max-w-md"
            placement="inline"
            onChange={(volumePercent) =>
              onParticipantScreenShareVolumeChange(
                screenParticipant.identityId,
                volumePercent,
              )
            }
            value={screenShareVolumePercent}
          />
          <CallParticipantTiles
            call={call}
            onParticipantScreenShareVolumeChange={
              onParticipantScreenShareVolumeChange
            }
            onParticipantVolumeChange={onParticipantVolumeChange}
            onToggleMute={onToggleMute}
            variant="strip"
          />
        </div>
        {dataOpen && (
          <div className="min-h-0 w-full shrink-0 xl:h-full xl:w-[360px]">
            <CallDataPanel call={call} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={cx(
        'min-h-0 flex-1 gap-2 overflow-y-auto p-2.5 sm:gap-4 sm:p-5',
        dataOpen ? 'flex flex-col lg:flex-row' : 'flex',
      )}
    >
      <CallParticipantTiles
        call={call}
        onExpandScreen={onExpandScreen}
        onParticipantScreenShareVolumeChange={
          onParticipantScreenShareVolumeChange
        }
        onParticipantVolumeChange={onParticipantVolumeChange}
        onToggleMute={onToggleMute}
        variant="grid"
      />
      {dataOpen && (
        <div className="min-h-0 w-full shrink-0 lg:h-full lg:w-[360px]">
          <CallDataPanel call={call} />
        </div>
      )}
    </div>
  );
}

import type { CallSession } from '../view-models/CallSession';

import { ParticipantTile } from './ParticipantTile';

export function CallParticipantTiles({
  call,
  onExpandScreen,
  onParticipantScreenShareVolumeChange,
  onParticipantVolumeChange,
  onToggleMute,
  variant,
}: {
  call: CallSession;
  onExpandScreen?: (participant: CallSession['participants'][number]) => void;
  onParticipantScreenShareVolumeChange: (
    identityId: string,
    volumePercent: number,
  ) => void;
  onParticipantVolumeChange: (
    identityId: string,
    volumePercent: number,
  ) => void;
  onToggleMute: () => void;
  variant: 'grid' | 'strip';
}) {
  const tiles = call.participants.map((participant) => (
    <ParticipantTile
      key={participant.identityId}
      call={call}
      onExpandScreen={onExpandScreen}
      onParticipantScreenShareVolumeChange={
        onParticipantScreenShareVolumeChange
      }
      onParticipantVolumeChange={onParticipantVolumeChange}
      onToggleMute={onToggleMute}
      participant={participant}
      variant={variant}
    />
  ));

  if (variant === 'strip') {
    return (
      <div className="w-full shrink-0 overflow-x-auto pb-1">
        <div className="inline-flex min-w-full justify-center gap-3">
          {tiles}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-wrap content-center items-center justify-center gap-4">
      {tiles}
    </div>
  );
}
